# PoliticEase Android APK updates

Startup manifest: https://voter-app.ai-developer.cloud/download/politic-ease.json
APK download: https://voter-app.ai-developer.cloud/download/politic-ease.apk
Prefer immutable filenames (politic-ease-123.apk) in the manifest, while retaining politic-ease.apk as a direct download alias. This prevents an old manifest from downloading a different APK during publication.

## App setup

The local Expo module in modules/apk-installer is autolinked in native Android builds. Expo Go and iOS skip APK checks. Rebuild the app with EAS; existing binaries without this module cannot use this updater. The manifest URL defaults to the URL above and can be overridden with EXPO_PUBLIC_APK_UPDATE_URL at build time. No OTA update can add the native installer to an old binary.

dont Use `npx eas-cli@latest build --platform android --profile apkProduction`. The new profile produces APKs; the existing production profile is unchanged. EAS manages version codes remotely and increments them automatically. Keep the same Android application ID (`com.binarydatasteam.digitalvoter`) and EAS Android keystore for ALL releases. Never regenerate the keystore. Before building, update `expo.version` in app.json. Inspect the APK's actual version code/name; do not guess the remote version code or use a local app.json value as the manifest's build number.

## VPS setup (run on your server)

1. Create the directory: `sudo mkdir -p /var/www/politic-ease-updates`.
2. Grant your deployment user write access; grant the Nginx user read/traverse access. Files should be 0644, directory 0755. Keep signing keys off this public directory.
3. Merge nginx-location.conf into the EXISTING HTTPS virtual host. Adapt the path if your server already serves /download/; do not replace unrelated downloads or the existing TLS configuration.
4. Confirm the site's certificate is valid. Run `sudo nginx -t`, then `sudo systemctl reload nginx`.
5. Upload the signed APK and manifest as described below. This repository does not contain VPS SSH credentials and does not deploy automatically.

## Release procedure

1. Build a new APK using the SAME production signing key and application ID and a HIGHER version code.
2. Read metadata: `$ANDROID_HOME/cmdline-tools/latest/bin/apkanalyzer manifest version-code release.apk` and `.../apkanalyzer manifest version-name release.apk`. Check application-id too. (Use your installed SDK tool path.)
3. Calculate `sha256sum release.apk` AFTER downloading the final signed build. Copy the digest into JSON. Use the JSON example but replace version, versionCode, checksum, releaseNotes and mandatory. Release notes are a plain string; use JSON escaping for newlines.
4. Upload the APK first, using an immutable filename: `scp release.apk USER@HOST:/var/www/politic-ease-updates/politic-ease-123.apk`. Replace 123 with its actual versionCode.
5. Verify the server-side SHA-256 matches and the HTTPS APK download returns 200. Optionally update the politic-ease.apk direct-download alias atomically.
6. Upload the complete manifest to politic-ease.json.new, then atomically rename it to politic-ease.json on the VPS. Publish JSON LAST. Set downloadUrl to the immutable HTTPS filename (apkUrl is also supported).
7. Check `curl --fail https://voter-app.ai-developer.cloud/download/politic-ease.json` and verify a downloaded APK's SHA-256. Keep the previous APK while clients may still have its manifest.
8. Set mandatory=true only after a successful optional rollout. A known mandatory update blocks navigation until installed; an unreachable/invalid startup manifest allows the app to open. Changing the server manifest does not unlock a mandatory modal already shown; restart to fetch again.

## Installer behavior

The app downloads to private cache, displays progress, and hashes the APK in a native streaming operation. Before Android's installer opens it verifies the hash again, package ID, version/name and SAME current signing certificate. Signing-key rotation is intentionally rejected. Android's “Allow from this source” settings opens when needed; after returning the user taps Install update. Android requires explicit installation confirmation. Cancellation/failure leaves the modal retryable. APKs in cache are replaced on the next download.

This flow is for VPS-distributed APKs. If distributing on Google Play, review Play's restrictions on REQUEST_INSTALL_PACKAGES and use Play's update mechanism for that distribution channel. Device policy can prohibit unknown-source installs; no app can bypass that policy.

## Validation and device acceptance checklist

Run `node --test scripts/app-updates.test.cjs`, `npx expo lint`, `npx tsc --noEmit` and `npx expo-modules-autolinking resolve --platform android`.

Full install testing requires TWO signed APKs containing this native module, a reachable VPS manifest, and a physical Android device. This is not verified by TypeScript or Expo Go:

- Install older APK A; publish APK B with higher code. Verify popup version/notes, progress, SHA verification, permission settings, installer confirmation, and B version after launch. Confirm local voter data survives (do not uninstall A).
- Optional: Later/back closes modal and app works; restart prompts again.
- Mandatory: no Later; Android back cannot dismiss; cancellation or failed download keeps gate visible; installation succeeds and updated app no longer prompts.
- Offline/server 404/timeout/malformed JSON: startup remains usable.
- Disconnect during download: error and retry; timeout is bounded at 15 minutes.
- Corrupt checksum or APK: no installer launch. Wrong package, wrong signing key and mismatched version metadata must be rejected.
- Deny unknown-source permission; return and retry. Cancel installer; verify retry button. Test device storage exhaustion and device-policy installation denial.
- Test both Android 8 permission behavior and a current Android version. iPhone has no APK updater.

Keep this checklist as pending until tested with actual signed releases; repository checks do not prove the OS install flow.

Implementation validation performed: eight automated metadata/network/checksum tests, lint, TypeScript, Expo Android autolinking, and `:apk-installer:compileReleaseKotlin` pass. Full signed APK upgrade/device acceptance remains pending. The configured public JSON endpoint returned HTTP 404 when checked during implementation.

The existing website JSON fields (appName, packageName, platform, downloadUrl, websiteUrl, fileType) are supported. Add versionCode and sha256 for app updates. mandatory defaults to false and releaseNotes to an empty string when omitted. Version/build/checksum must describe the actual hosted APK.
