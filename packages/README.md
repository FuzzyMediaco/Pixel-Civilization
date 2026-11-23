# Offline editions

Android and Windows ship a complete copy of the production web build. First launch works without an internet connection. The local game runs under `https://pixelcivilization.app` inside each app's private WebView profile. Local saves stay in that profile across game updates. The account API uses the same origin over the network when available.

## Install and play

- **Android 8 or newer.** Download `Pixel-Civilization-Android.apk`. Open the APK on the phone and allow installation from the app that downloaded it if Android asks. An up-to-date Android System WebView with WebGL 2 support is required. For future APK upgrades, install the new APK over the existing one, using the same publisher signature.
- **Windows 10 or 11 x64.** Extract the complete `Pixel-Civilization-Windows-x64.zip` and open `Pixel Civilization.exe`. The game uses the Microsoft Edge WebView2 Runtime, ordinarily installed with Windows. Its local profile lives under `%LOCALAPPDATA%\Pixel Civilization`. An account is optional for offline play.

Each launch checks the canonical site's `/offline-index.json` in the background. Only changed files are downloaded. The game verifies each file's size and SHA-256 digest before committing an entire new edition. The current session continues to use its original edition, so closing during a failed or interrupted update keeps the game playable. Offline updates and account progress use separate storage.

## Build and distribute

On Windows, use Node 24, JDK 21, Android SDK platform 35 and Android SDK build-tools 35.0.0. Set `JAVA_HOME` and `ANDROID_HOME`. For Windows builds the .NET Framework compiler is used with the pinned Microsoft WebView2 SDK; `PIXEL_WEBVIEW_SDK` can point to an unpacked SDK to build without fetching NuGet.

From the repository root, run:

```powershell
bun install --frozen-lockfile
npm run build
./packages/build-windows.ps1
./packages/build-android.ps1
./packages/test-updates.ps1
./packages/verify-editions.ps1
```

Set `PIXEL_ANDROID_KEYSTORE` to the publisher's existing PKCS12 release keystore and `PIXEL_KEYSTORE_PASSWORD` to its password from a secret manager before building Android. The alias is `pixel-civilization`. Keep a separate encrypted backup. Recreating the key changes the app signature and prevents upgrades over existing installs.

The scripts write both downloads into `portable/`. The Android script verifies the resulting APK signature. Upload these two files, with the names above, as GitHub release assets. The manual **Build offline editions** Actions workflow runs the same scripts when the repository secrets `PIXEL_ANDROID_KEYSTORE_BASE64` and `PIXEL_KEYSTORE_PASSWORD` are configured. It produces build artifacts for review.

Deploy the complete `dist/` from the same `npm run build` to Cloudflare. Its small `offline-index.json` describes every game file and determines which files installed copies fetch. The installer and website can share this build. Content updates do not require a new APK or Windows ZIP. Publish a new package for native wrapper changes. Every deployment must have a newer generation than its predecessor; the build defaults to Unix build time in seconds and accepts `SOURCE_DATE_EPOCH` for reproducible release builds.
