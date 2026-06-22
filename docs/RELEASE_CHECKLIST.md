# Sushi Party — Release Checklist

## ✅ Already done (by Claude)
- [x] EAS project linked (`@joseppy/sushi-party`, id `4dd74eba-2b10-4a65-8003-ea12b7bad396`)
- [x] `eas.json` created (build + submit profiles)
- [x] Privacy policy rewritten + hosted: https://sushi-party-api.joseppy-workers.workers.dev/privacy
- [x] Backend redeployed, remote D1 migrations confirmed current
- [x] Store listing copy written → `docs/STORE_LISTING.md`
- [x] Android production build started (EAS cloud)

---

## 🔑 Credentials to set up

### Apple — App Store Connect API key (recommended; no password/2FA needed by EAS)
- [ ] App Store Connect → Users and Access → Integrations → App Store Connect API → **+**
- [ ] Role: **Admin** (or App Manager)
- [ ] Download the **`.p8`** file (one-time download) → place in project root
- [ ] Record **Key ID**, **Issuer ID**
- [ ] Record **Apple Team ID** (Developer portal → Membership)

### Google — Play service account JSON
- [ ] Play Console → Setup → API access → create/link service account
- [ ] Grant it release permissions in Play Console
- [ ] Download JSON key → save as `play-service-account.json` in project root (gitignored)

---

## 📱 App records
- ⛔ **BLOCKED: Google Play account identity verification pending** — Android submit
  (app record creation + upload) cannot proceed until Google verifies the account.
  The Android `.aab` build artifact is ready on EAS and will submit once unblocked.
- [ ] **Play Console:** create app "Sushi Party", package `com.joseppy.sushiparty` (after verification)
  - Note: Google may require the **first AAB uploaded manually** before API submits work
- [x] **iOS credentials:** distribution cert + provisioning profile created on EAS
- [ ] **App Store Connect:** can be auto-created by EAS during submit (skip manual)

### Can do while waiting on Google verification
- [ ] Generate Play **service account JSON** (Google Cloud Console part needs no Play verification) → `play-service-account.json` in root
- [ ] Update **Google iOS OAuth client** bundle ID → `com.joseppy.sushiparty` (needed for Google Sign-In on iOS)

---

## 🖼️ Screenshots (Claude can auto-generate from simulator on request)
- [ ] iOS: 6.9" iPhone (1320×2868) — 1–10 shots. iPhone 17 Pro Max simulator
- [ ] Android: phone 2–8 shots, min 1080px long side
- [ ] Android: **feature graphic** 1024×500
- [ ] App icon 512×512 (use `assets/icon.png`)

---

## 🚀 Build & submit (Claude runs these once credentials are in place)
- [ ] Fill `eas.json` submit config: `ascAppId`, `appleTeamId`, service account path
- [ ] `eas build -p ios --profile production`
- [ ] `eas submit -p ios --profile production` → TestFlight
- [ ] `eas submit -p android --profile production --track internal` → Play internal testing
- [ ] (Android Build already running — check status at the EAS build URL)

---

## 📝 Store listing forms (web consoles — copy from `docs/STORE_LISTING.md`)
- [ ] Apple: subtitle, description, keywords, screenshots, support URL, support email `contact@joseppy.ca`
- [ ] Apple: App Privacy questionnaire (match `docs/STORE_LISTING.md` data-safety section)
- [ ] Apple: age rating (4+), category Food & Drink
- [ ] Google: short + full description, screenshots, feature graphic
- [ ] Google: **Data safety** form, content rating questionnaire, support email `contact.joseppy@gmail.com`
- [ ] Both: privacy policy URL (above)

---

## ✔️ Final verification
- [ ] iOS build appears in TestFlight, installs on device, can sign in / count
- [ ] Android build appears in Play internal testing, installs, can sign in / count
- [ ] Add testers to both tracks
