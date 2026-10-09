package expo.modules.apkinstaller

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest

class ApkInstallerModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext) { "Application unavailable" }
  private fun allowed() = Build.VERSION.SDK_INT < 26 || context.packageManager.canRequestPackageInstalls()
  private fun file(uri: String): File {
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "Expected a private file URI" }
    val root = File(context.cacheDir, "apk-updates").canonicalFile
    val result = File(requireNotNull(parsed.path)).canonicalFile
    require(result.parentFile == root && result.isFile) { "APK outside update cache or missing" }
    return result
  }
  private fun hash(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(65536)
      while (true) { val size = input.read(buffer); if (size < 0) break; digest.update(buffer, 0, size) }
    }
    return digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
  }
  override fun definition() = ModuleDefinition {
    Name("ApkInstaller")
    Events("onInstallResult")
    Function("isInstallAllowed") { allowed() }
    AsyncFunction("openInstallSettings") {
      requireNotNull(appContext.currentActivity).startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("sha256") { uri: String -> hash(file(uri)) }
    AsyncFunction("install") { uri: String, checksum: String, code: Int, version: String ->
      require(allowed()) { "Allow installation from this app in Android settings" }
      val apk = file(uri)
      require(hash(apk).equals(checksum, ignoreCase = true)) { "APK checksum mismatch" }
      val pm = context.packageManager
      val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
      val archive = requireNotNull(pm.getPackageArchiveInfo(apk.path, flags)) { "Invalid APK" }
      val installed = pm.getPackageInfo(context.packageName, flags)
      fun versionCode(info: android.content.pm.PackageInfo) = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
      require(archive.packageName == context.packageName) { "APK belongs to another app" }
      require(versionCode(archive) == code.toLong() && code.toLong() > versionCode(installed) && archive.versionName == version) { "APK version does not match update metadata" }
      fun signatures(info: android.content.pm.PackageInfo): Set<String> {
        val entries = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
        return entries.orEmpty().map { it.toCharsString() }.toSet()
      }
      require(signatures(archive).isNotEmpty() && signatures(archive) == signatures(installed)) { "APK signing key does not match installed app" }
      val activity = requireNotNull(appContext.currentActivity) { "No active screen" }
      val content = FileProvider.getUriForFile(context, "${context.packageName}.apkupdates.provider", apk)
      activity.runOnUiThread {
        try {
          activity.startActivityForResult(Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
            data = content
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            putExtra(Intent.EXTRA_RETURN_RESULT, true)
          }, 7319)
        } catch (error: Exception) {
          sendEvent("onInstallResult", mapOf("success" to false, "message" to (error.message ?: "Unable to open installer")))
        }
      }
    }
    OnActivityResult { _, result ->
      if (result.requestCode == 7319) sendEvent("onInstallResult", mapOf(
        "success" to (result.resultCode == Activity.RESULT_OK),
        "message" to if (result.resultCode == Activity.RESULT_OK) "Installation completed. Restart the app." else "Installation cancelled or failed. Try again."
      ))
    }
  }
}
