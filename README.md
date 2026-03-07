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

## Nginx Reverse Proxy On EC2

Use Node on internal port `4000` and expose the app publicly through Nginx on port `80`.

HTTP setup on Ubuntu EC2:

```sh
sudo apt update
sudo apt install -y nginx
sudo cp deploy/nginx/fuelectric-http.conf /etc/nginx/sites-available/fuelectric-api
sudo ln -sfn /etc/nginx/sites-available/fuelectric-api /etc/nginx/sites-enabled/fuelectric-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Backend restart:

```sh
cd /opt/mobile/mobile-web-application
APP_ENV=production pm2 restart mobile-api --update-env
```

Security group / firewall:

- allow inbound `80/tcp`
- allow inbound `443/tcp` when HTTPS is enabled
- once Nginx is working, remove public inbound access to `4000/tcp`

HTTP verification:

```sh
curl http://13.235.49.124/health
curl http://13.235.49.124/api/public/products
curl -X POST http://13.235.49.124/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

HTTPS on `443`:

- use a real domain such as `api.example.com`; do not use a raw IP for production TLS
- use [deploy/nginx/fuelectric-https.conf.example](/Users/piyush/Downloads/my-personal-application/mobile/deploy/nginx/fuelectric-https.conf.example) as the starting point
- set `server_name` and certificate paths
- install a certificate with Certbot or your existing CA flow

When Nginx is in front, the mobile app should call `http://13.235.49.124` now, or `https://<your-domain>` once TLS is ready.

## Forgot Password Email Reset

The backend now supports a standard reset-link flow:

- `POST /api/auth/forgot-password` accepts `{ "username": "<email>" }`
- the server generates a one-time reset token, stores only its SHA-256 hash, and emails the reset link
- `GET /reset-password?token=...` serves the password reset page
- `POST /api/auth/reset-password` accepts `{ "token": "...", "password": "...", "confirmPassword": "..." }`
- all active sessions for that user are revoked after a successful reset

Required config in [config/production.env](/Users/piyush/Downloads/my-personal-application/mobile/config/production.env) and [config/local.env](/Users/piyush/Downloads/my-personal-application/mobile/config/local.env):

```sh
APP_NAME=Mobile Application
AUTH_PUBLIC_BASE_URL=http://13.235.49.124
AUTH_RESET_TOKEN_TTL_MS=900000
AUTH_RESET_REQUEST_COOLDOWN_MS=60000

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey-or-username
SMTP_PASSWORD=change-production-smtp-password
SMTP_FROM=Mobile Application <no-reply@example.com>
```

Mail notes:

- `AUTH_PUBLIC_BASE_URL` must point to the public backend host that can serve `/reset-password`
- `SMTP_FROM` should be a valid sender on your SMTP provider
- if you use Gmail, SendGrid, Mailgun, Brevo, SES, or similar, use their SMTP credentials here
- if `SMTP_SECURE=true`, use the TLS port your provider expects, usually `465`

After updating config on EC2:

```sh
cd /opt/mobile/mobile-web-application
npm install
APP_ENV=production pm2 restart mobile-api --update-env
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

1. Prepare the Android release version.

```sh
npm run prepare:android-release
```

This automatically:

- increments `versionCode` by `1`
- bumps `versionName` by patch version, for example `1.0.0` -> `1.0.1`
- updates `src/app/constants.ts` so the JS fallback version matches

If you want a specific release version:

```sh
npm run prepare:android-release -- 1.2.0
```

Optional:

```sh
npm run prepare:android-release -- 1.2.0 --version-code 42
```

2. Build the signed release APK.
3. Publish the APK and update the manifest:

```sh
npm run publish:android-update -- android/app/build/outputs/apk/release/app-release.apk --notes "Bug fixes and performance improvements."
```

This command:

- copies the APK to `server/data/generated/app-updates/mobile-1.0.1.apk`
- updates `server/data/generated/app_update_manifest.json`
- sets the Android download URL to `/static/app-updates/mobile-1.0.1.apk`
- calculates and stores `checksumSha256`, `fileSizeBytes`, and `publishedAt`

If needed, you can still pass the version explicitly:

```sh
npm run publish:android-update -- android/app/build/outputs/apk/release/app-release.apk 1.0.1 --notes "Bug fixes and performance improvements."
```

Optional flags:

```sh
--mandatory
--min-supported 1.0.0
--app-id com.mobile
--channel production
--notes "Your release notes"
```

Then restart the backend on EC2 or wait for the manifest cache to expire:

```sh
APP_ENV=production pm2 restart mobile-api --update-env
```

Test the update endpoint:

```sh
curl "http://13.235.49.124/api/public/app-update?appId=com.mobile&channel=production&platform=android&currentVersion=1.0.0"
```

Important:

- this is not silent install; Android will open the APK link and the user still installs it through the system installer
- users may need to allow installs from unknown apps on their device
- use a release keystore for long-term updates; debug signing is only a fallback for testing
- for production, prefer HTTPS and a domain instead of a raw HTTP IP

## Auto Release On `git pull`

If you want EC2 to automatically build and publish a new Android APK whenever `git pull` brings new code changes, install the repo-managed Git hooks once:

```sh
cd /opt/mobile/mobile-web-application
npm run install:git-hooks
```

This configures `core.hooksPath` to use `.githooks/`.

What happens after a pull:

- the `post-merge` or `post-rewrite` hook runs `node scripts/ec2-auto-release.js`
- it skips if the pull did not change release-relevant files
- it recreates `android/local.properties` from `ANDROID_SDK_ROOT` or `/home/ubuntu/Android/Sdk`
- it runs `npm ci` only if package files changed or `node_modules` is missing
- it computes the next release version without modifying tracked files
- it builds the APK with Gradle version overrides
- it publishes the APK and update manifest
- it restarts `mobile-api` with `APP_ENV=production`

Runtime-only state written on EC2:

- APKs: `server/data/generated/app-updates/`
- live update manifest: `server/data/generated/app_update_manifest.json`
- auto-release state: `server/data/generated/android_release_state.json`

Useful environment variables on EC2:

```sh
export ANDROID_SDK_ROOT=/home/ubuntu/Android/Sdk
export PM2_APP_NAME=mobile-api
export APP_ENV=production
```

You can also run the same auto-release manually:

```sh
cd /opt/mobile/mobile-web-application
npm run release:android:auto
```

Important tradeoff:

- every qualifying `git pull` will create a new APK version
- if that is too aggressive, use this only on a release branch or trigger it manually
