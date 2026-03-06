This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.

## EC2 Deployment Helpers

The default remote application path for this project is:

```sh
/opt/mobile/mobile-web-application
```

Two helper scripts are available under `scripts/`:

```sh
# Sync the current project to EC2
EC2_HOST=<your-ec2-host> ./scripts/ec2-sync.sh

# Run a command from the remote app directory
EC2_HOST=<your-ec2-host> ./scripts/ec2-run.sh pwd
EC2_HOST=<your-ec2-host> ./scripts/ec2-run.sh npm ci
EC2_HOST=<your-ec2-host> ./scripts/ec2-run.sh pm2 restart <your-process-name>
```

Optional environment variables:

```sh
EC2_USER=ec2-user
SSH_PORT=22
EC2_APP_PATH=/opt/mobile/mobile-web-application
```

If your PM2 process name matches the folder name, the restart command would be:

```sh
EC2_HOST=<your-ec2-host> ./scripts/ec2-run.sh pm2 restart mobile-web-application
```

## Android Self Update

The Android app already checks `GET /api/public/app-update` on startup and shows an update popup when a newer version is available.

Relevant files:

- app update check: `src/app/MainApp.tsx`
- Android installed-version bridge: `src/app/appInfo.ts`
- Android native module: `android/app/src/main/java/com/mobile/AppInfoModule.kt`
- default manifest template: `server/data/app_update_manifest.json`
- runtime manifest on EC2: `server/data/generated/app_update_manifest.json`
- hosted APK directory on the server: `server/data/generated/app-updates/`

For each Android release:

1. Update the Android app version in `android/app/build.gradle`
   - `versionCode` must increase every release
   - `versionName` should match the manifest version, for example `1.0.1`
2. Build the signed release APK.
3. Publish the APK and update the manifest:

```sh
npm run publish:android-update -- android/app/build/outputs/apk/release/app-release.apk 1.0.1 --notes "Bug fixes and performance improvements."
```

This command:

- copies the APK to `server/data/generated/app-updates/mobile-1.0.1.apk`
- updates `server/data/generated/app_update_manifest.json`
- sets the Android download URL to `/static/app-updates/mobile-1.0.1.apk`

Optional flags:

```sh
--mandatory
--min-supported 1.0.0
--notes "Your release notes"
```

Then restart the backend on EC2 or wait for the manifest cache to expire:

```sh
APP_ENV=production pm2 restart mobile-api --update-env
```

Test the update endpoint:

```sh
curl "http://13.235.49.124:4000/api/public/app-update?platform=android&currentVersion=1.0.0"
```

Important:

- this is not silent install; Android will open the APK link and the user still installs it through the system installer
- users may need to allow installs from unknown apps on their device
- for production, prefer HTTPS and a domain instead of a raw HTTP IP
