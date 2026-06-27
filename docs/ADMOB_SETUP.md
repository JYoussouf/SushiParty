# AdMob Ads — Setup & Go-Live

An interstitial ad shows at the **natural break after a party** — when the user leaves the
post-party summary ("Let's Go Home!", `app/session/summary.tsx` → `handleDone` →
`showInterstitialIfDue()` in `src/lib/ads.ts`). It's preloaded during the party
(`scoreboard.tsx` calls `prepareInterstitial()` on mount).

It is **OFF by default** behind `EXPO_PUBLIC_ADS_ENABLED`. With the flag off, the native
ads module is never even loaded, so testing and Expo Go behave exactly as before.

## Designed to not be clunky
- **Never blocks results** — submit → summary is instant; the ad only appears when leaving.
- **Preloaded** while the party happens → shows instantly, no loading spinner.
- **Frequency-capped** — at most once every `EXPO_PUBLIC_ADS_EVERY_N` parties (default 3) and
  never within a 2-minute cooldown. Party count is tracked even when no ad shows, so the
  cadence stays steady.
- **Easy to dismiss** — a standard interstitial with the system close button; requests
  non-personalized ads (avoids the iOS ATT prompt).
- **Fail-safe** — if the ad isn't loaded in time, fails, or the module is missing, it silently
  skips and continues home (8s safety timeout). It can never hang the flow.

## How it's wired
- **Flag:** `EXPO_PUBLIC_ADS_ENABLED` (`.env.development` / `.env.production`). Default `false`.
- **Cadence:** `EXPO_PUBLIC_ADS_EVERY_N` (optional, default `3`).
- **Ad unit IDs:** `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID` / `_IOS`. When unset, Google's
  official **test** ad unit IDs are used (safe to ship, always serve test ads).
- **App IDs:** in `app.json` under the `react-native-google-mobile-ads` plugin. Currently set
  to Google's **test** app IDs.
- The native module is `require()`d lazily only when the flag is on, so flag-off builds and
  Expo Go don't need the native module.

## To turn ads on (when ready)
1. **Create an AdMob account:** https://admob.google.com → add the app (Android + iOS),
   get the **App IDs** (`ca-app-pub-…~…`) and create an **Interstitial** ad unit per platform
   (`ca-app-pub-…/…`).
2. **Replace the app IDs** in `app.json` (the `androidAppId` / `iosAppId` under the
   `react-native-google-mobile-ads` plugin) with your real App IDs.
3. **Set the real ad unit IDs** in `.env.production`:
   ```
   EXPO_PUBLIC_ADS_ENABLED=true
   EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID=ca-app-pub-XXXX/XXXX
   EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS=ca-app-pub-XXXX/XXXX
   ```
4. **Rebuild** (the SDK is a native dependency): `eas build -p android` / `-p ios`.
5. **Host `app-ads.txt`** at your developer domain and add your AdMob publisher line (AdMob →
   App settings shows the exact line). Add the website to your store listings.

## Store/compliance updates required when ads go live
- **Google Play Data safety:** add purpose **Advertising or marketing**, declare **Advertising ID**
  collection, and mark relevant data as **Shared** with Google.
- **Play "Ads" declaration:** change "Does your app contain ads?" to **Yes**.
- **Apple:** answer the App Privacy "Advertising" questions; the plugin adds SKAdNetwork IDs.
  Consider App Tracking Transparency (currently requesting **non-personalized** ads, which
  avoids the ATT prompt).
- **Privacy policy:** update `docs/PRIVACY_POLICY.md` + the hosted `/privacy` page to mention
  AdMob and advertising identifiers.

## Notes
- Current TestFlight / internal-testing builds were made **before** this change, so they don't
  contain the ads module yet. The next build will. With the flag off, that next build still
  shows no ads.
- The ad call is best-effort: if it fails to load or the module is missing, it silently skips
  and never blocks the submit → summary flow (8s safety timeout).
