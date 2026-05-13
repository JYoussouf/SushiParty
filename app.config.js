// Dynamic Expo config — extends app.json with env-driven native settings.
// Expo reads this file when present instead of app.json (it re-exports the base config).

const base = require('./app.json');

// The iOS OAuth client ID from Google Cloud Console (Application type: iOS).
// To create: https://console.cloud.google.com → Credentials → Create → OAuth client → iOS
// Bundle ID to enter: com.sushiparty.app
// After creating, set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in .env.local to the new client ID.
// The reversed scheme is derived automatically below.
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const reversedClientId = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`
  : null;

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...base.expo,
  ios: {
    ...base.expo.ios,
    ...(reversedClientId
      ? {
          infoPlist: {
            CFBundleURLTypes: [{ CFBundleURLSchemes: [reversedClientId] }],
          },
        }
      : {}),
  },
};
