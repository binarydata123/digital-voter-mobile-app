# Publish a Politic Ease app update

This guide uses your existing **local Gradle build**, with no EAS or Expo Prebuild command. Run local commands from the project root unless a step says otherwise.

- VPS: `root@187.127.129.103`
- Server directory: `/var/www/digital-voter-management-system/Downloads`
- Update JSON: `https://voter-app.ai-developer.cloud/download/politic-ease.json`
- APK: `https://voter-app.ai-developer.cloud/download/politic-ease.apk`

## 1. Increase the APK version

In `android/app/build.gradle`, find `defaultConfig` and increase the version code for EVERY release:

```gradle
versionCode 3
versionName "1.0.2"
```

These are example values for the release after code 2 / version 1.0.1. Use a code higher than the APK currently installed on users' phones. Gradle does not increment it automatically.

Keep `applicationId` as `com.binarydatasteam.digitalvoter`. Use the SAME signing key across updates. Keep `app.json` version settings consistent if you maintain them, but direct Gradle builds use the Android configuration above.

## 2. Check and build locally

```bash
npm run lint
npx tsc --noEmit
cd android
./gradlew assembleDebug
cd ..
```

Debug output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

For a release APK instead, run `./gradlew assembleRelease` inside `android/`. Its usual output is `android/app/build/outputs/apk/release/app-release.apk`. Use the chosen APK consistently for all following commands.

The current project config signs both debug and release builds with `signingConfigs.debug`. For production distribution, configure a production signing key and preserve it across releases. Switching to another key will not update existing installations signed with the old key.

## 3. Verify the built APK and calculate its checksum

For the debug APK, run locally:

```bash
~/Android/Sdk/build-tools/36.0.0/aapt dump badging \
  android/app/build/outputs/apk/debug/app-debug.apk | head -n 1

sha256sum android/app/build/outputs/apk/debug/app-debug.apk
```

Adapt the SDK tool path if needed. The first command must show the expected package name, versionCode and versionName. Copy the 64-character hash from the second command.

Calculate the checksum AFTER the final build. Rebuilding usually changes it. Do not use a debug APK's checksum for a release APK, or vice versa.

## 4. Upload the APK to your VPS

Run locally:

```bash
scp android/app/build/outputs/apk/debug/app-debug.apk \
  root@187.127.129.103:/var/www/digital-voter-management-system/Downloads/politic-ease.apk
```

Then connect to the server:

```bash
ssh root@187.127.129.103
```

Run on the server:

```bash
cd /var/www/digital-voter-management-system/Downloads
sha256sum politic-ease.apk.new
chmod 644 politic-ease.apk.new
mv politic-ease.apk.new politic-ease.apk
```

The server hash must match your local hash. Uploading to `.new` before renaming prevents users downloading a partially uploaded file.

## 5. Publish the JSON last

On the server, prepare a new JSON file:

```bash
cd /var/www/digital-voter-management-system/Downloads
cp politic-ease.json politic-ease.json.new
nano politic-ease.json.new
```

Use this structure, replacing the version/code with the APK's actual values and sha256 with the real hash:

```json
{
  "appName": "Politic Ease",
  "packageName": "com.binarydatasteam.digitalvoter",
  "version": "1.0.2",
  "versionCode": 3,
  "platform": "android",
  "downloadUrl": "https://voter-app.ai-developer.cloud/download/politic-ease.apk",
  "websiteUrl": "https://voter-app.ai-developer.cloud/",
  "fileType": "apk",
  "mandatory": false,
  "releaseNotes": "Describe the changes in this release.",
  "sha256": "PASTE_THE_ACTUAL_64_CHARACTER_HASH_HERE"
}
```

Save the file, validate it, and publish:

```bash
python3 -m json.tool politic-ease.json.new > /dev/null
chmod 644 politic-ease.json.new
mv politic-ease.json.new politic-ease.json
```

- `mandatory: false`: users can choose Later.
- `mandatory: true`: users must install the advertised update to continue once the popup appears.
- `versionCode`, `version`, and `sha256` must all describe the exact uploaded APK.
- Changing JSON alone does not change an installed app.
- Editing `deployment/apk-updates/politic-ease.example.json` locally does not publish the server JSON.

For future releases, prefer a versioned APK filename such as `politic-ease-3.apk` and point downloadUrl at it. This avoids older sessions downloading a replaced APK with a different hash. Keep older versioned APKs available while users may still have their update metadata.

## 6. Verify the public files and test on your phone

Run locally after publication:

```bash
curl --fail --max-time 20 \
  https://voter-app.ai-developer.cloud/download/politic-ease.json

curl --fail --location --max-time 180 \
  --output /tmp/politic-ease-published.apk \
  https://voter-app.ai-developer.cloud/download/politic-ease.apk

sha256sum /tmp/politic-ease-published.apk
```

The public APK hash must match the public JSON. Fully close and reopen the app to fetch fresh update metadata. Test from a phone with the OLD APK installed:

1. Confirm the advertised version and notes.
2. Tap Update Now and wait for download/verification.
3. If Android asks, enable “Allow from this source” and return to the app.
4. Tap Install update and confirm Android's installer.
5. Open the updated app; the same update should no longer be offered. Confirm voter data remains.

Do not uninstall the old app to test an upgrade: uninstalling can remove its local data. Test optional Later and mandatory gating, interrupted downloads, bad checksums and installer cancellation before making a release mandatory.

## Common errors

| Error | What to check |
| --- | --- |
| Download failed | The exact downloadUrl must exist and return HTTP 200. |
| APK could not be verified | Hash the publicly hosted APK; its SHA-256 must match JSON. |
| APK does not match advertised version | Rebuild with the correct versionCode/versionName, then re-upload APK and JSON. |
| Different signing key | Build using the same key as the installed APK. |
| No update popup | JSON must be valid, contain versionCode and sha256, and advertise a code higher than the installed build. Restart the app. |
| Old popup after changing JSON | The app checks at startup. Close and reopen it. |

An unreachable or invalid update server does not block startup. APK updates run on Android native builds, not Expo Go or iPhone. A debug build may also need your local Metro development server (`npx expo start --dev-client`); use a signed release build for normal distribution.
