# OAuth Setup Guide

This app now supports sign-in via Apple, Google, and Facebook. Here's how to configure each provider:

## Apple Sign In (iOS/macOS)

### Frontend Setup
No additional setup needed - `expo-apple-authentication` is already installed and will work on iOS.

### What Happens
- Users tap "Continue with Apple"
- Apple's native authentication UI appears
- User authenticates and grants access
- Identity token is sent to backend for verification
- User account is created/logged in automatically

## Google Sign In

### Prerequisites
1. Create a Google Cloud Project
2. Enable Google Sign-In API
3. Create OAuth 2.0 credentials

### Configuration

1. **Add to `.env` or `.env.local`:**
```
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

2. **Update `app.json` to configure redirect URL:**
```json
{
  "expo": {
    "scheme": "com.sushiparty",
    "plugins": [
      "expo-auth-session"
    ]
  }
}
```

3. **In Google Cloud Console:**
   - Add OAuth 2.0 Client ID for "iOS" and "Android"
   - Add authorized redirect URIs:
     - `com.sushiparty://oauth/google`
     - `https://auth.expo.io/@your-username/sushi-party`

## Facebook Sign In

### Prerequisites
1. Create a Facebook App at https://developers.facebook.com
2. Enable Facebook Login product
3. Get your App ID

### Configuration

1. **Add to `.env` or `.env.local`:**
```
EXPO_PUBLIC_FACEBOOK_APP_ID=your-facebook-app-id
```

2. **Update `app.json`:**
```json
{
  "expo": {
    "scheme": "com.sushiparty",
    "plugins": [
      "expo-auth-session",
      [
        "expo-facebook",
        {
          "appID": "your-facebook-app-id",
          "displayName": "Sushi Party",
          "scheme": "fb{your-facebook-app-id}"
        }
      ]
    ]
  }
}
```

3. **In Facebook Developer Console:**
   - Add authorized redirect URIs
   - Set up App Domains and OAuth redirect URIs
   - Test and publish your app

## Backend Setup

The backend has three new OAuth endpoints:

### `POST /auth/apple`
- Verifies Apple identity token
- Creates or retrieves user by email
- Returns JWT token and user profile

**Request:**
```json
{
  "idToken": "string",
  "email": "user@example.com",
  "displayName": "User Name"
}
```

### `POST /auth/google`
- Verifies Google ID token
- Creates or retrieves user by email
- Returns JWT token and user profile

**Request:**
```json
{
  "idToken": "string"
}
```

### `POST /auth/facebook`
- Verifies Facebook access token
- Creates or retrieves user by email
- Returns JWT token and user profile

**Request:**
```json
{
  "accessToken": "string"
}
```

## Testing

1. **Local Development:**
   - Email authentication should continue to work
   - To test OAuth, use `expo prebuild` to build native apps
   - Test on physical devices or simulators/emulators

2. **Apple Sign In:**
   - Only works on iOS
   - Can be tested on iOS simulator or device
   - Requires Apple Developer account

3. **Google & Facebook:**
   - Works on both iOS and Android
   - Requires proper OAuth setup in respective developer consoles
   - Test with real credentials during development

## Common Issues

### "Google Client ID is not configured"
- Make sure `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set in `.env.local`

### "Facebook App ID is not configured"
- Make sure `EXPO_PUBLIC_FACEBOOK_APP_ID` is set in `.env.local`

### OAuth requests fail in development
- Ensure redirect URIs match exactly in provider settings
- For Expo Go, use `https://auth.expo.io/@username/project-name`
- For managed build, use the custom scheme you configured

### "User cancelled" errors
- These are expected when users tap Cancel during OAuth flow
- App handles these gracefully and returns to login screen

## Next Steps

1. Create developer accounts if you haven't already:
   - Apple Developer (for Apple Sign In)
   - Google Cloud Console (for Google Sign In)
   - Facebook Developers (for Facebook Sign In)

2. Configure credentials and add them to environment variables

3. Build and test on physical devices

4. Once tested, users can sign in with any of the three methods
