
package expo.modules.simphonenumber

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SimPhoneNumberModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SimPhoneNumber")

    Function("getPhoneNumber") {
      val context = appContext.reactContext
        ?: return@Function null

      if (
        context.checkSelfPermission(
          Manifest.permission.READ_PHONE_NUMBERS
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        throw SecurityException("READ_PHONE_NUMBERS permission not granted")
      }

      try {
        val number: String? =
          if (Build.VERSION.SDK_INT >= 33) {
            val manager = context.getSystemService(
              Context.TELEPHONY_SUBSCRIPTION_SERVICE
            ) as SubscriptionManager

            val subscriptionId =
              SubscriptionManager.getDefaultVoiceSubscriptionId()

            if (SubscriptionManager.isValidSubscriptionId(subscriptionId)) {
              manager.getPhoneNumber(subscriptionId)
            } else {
              null
            }
          } else {
            val manager = context.getSystemService(
              Context.TELEPHONY_SERVICE
            ) as TelephonyManager

            manager.line1Number
          }

        number?.trim()?.takeIf { it.isNotEmpty() }
      } catch (_: Exception) {
        null
      }
    }
  }
}
