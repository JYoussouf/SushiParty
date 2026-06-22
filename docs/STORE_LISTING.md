# Sushi Party — Store Listing Copy

Paste these into App Store Connect / Google Play Console. Values are tuned to each
store's character limits.

---

## Shared

- **App name:** Sushi Party
- **Bundle ID / Package:** `com.joseppy.sushiparty`
- **Category:** Food & Drink (primary). Secondary: Lifestyle / Entertainment
- **Privacy Policy URL:** https://sushi-party-api.joseppy-workers.workers.dev/privacy
- **Support email (Apple):** contact@joseppy.ca
- **Support email (Google):** contact.joseppy@gmail.com
- **Publisher / developer name:** Apple = legal name (Individual account, cannot change); Google Play = set **public developer name** to "JoseppyCo"
- **Content rating:** 4+ / Everyone (no objectionable content)

---

## Apple App Store

**Subtitle** (max 30 chars):
```
All-you-can-eat scoreboard
```

**Promotional text** (max 170 chars):
```
Tap to count every plate, settle who ate the most, and keep your all-you-can-eat sushi history with friends.
```

**Description** (max 4000 chars):
```
Sushi Party is the scoreboard for all-you-can-eat sushi.

Tap to count every plate as it lands. Submit your tally when you're done, see who out-ate who, and build a running history of every sushi run with your friends.

FEATURES
• Fast tap-to-count scoreboard built for a busy table
• Item-by-item logging from a built-in sushi menu
• Group sessions — scan a QR code to count together in real time
• Eating history that follows you across devices
• Friends and tagged attendees, so every session remembers who was there
• Nearby restaurant lookup to attach the right spot to each session
• Sign in with email, Google, or Apple

Whether you're chasing a personal record or just settling a friendly debate, Sushi Party keeps the count so you can keep eating.
```

**Keywords** (max 100 chars, comma-separated):
```
sushi,all you can eat,counter,scoreboard,food,tally,restaurant,eating,friends,party,ayce
```

**What's New** (release notes, first version):
```
First release of Sushi Party. Tap to count, submit your tally, and share your all-you-can-eat sushi history with friends.
```

**Screenshots required:** 6.7" iPhone (1290×2796) — minimum 1, up to 10. Optionally
6.5" and iPad if you enable iPad later (currently `supportsTablet: false`, so iPhone
only).

---

## Google Play

**Short description** (max 80 chars):
```
Tap to count plates and track your all-you-can-eat sushi history with friends.
```

**Full description** (max 4000 chars):
```
Sushi Party is the scoreboard for all-you-can-eat sushi.

Tap to count every plate as it lands. Submit your tally when you're done, see who out-ate who, and build a running history of every sushi run with your friends.

FEATURES
• Fast tap-to-count scoreboard built for a busy table
• Item-by-item logging from a built-in sushi menu
• Group sessions — scan a QR code to count together in real time
• Eating history that follows you across devices
• Friends and tagged attendees, so every session remembers who was there
• Nearby restaurant lookup to attach the right spot to each session
• Sign in with email, Google, or Apple

Whether you're chasing a personal record or just settling a friendly debate, Sushi Party keeps the count so you can keep eating.
```

**Screenshots required:** Phone — 2 to 8, min 1080px on the longest side, 16:9 or 9:16.
Plus a **feature graphic** (1024×500 PNG/JPG) and the **512×512 app icon** (the
`assets/icon.png` works).

---

## Data safety / App Privacy answers (must match the privacy policy)

Declare collection of:
- **Personal info:** name, email address, user IDs
- **Location:** approximate and/or precise (session location), optional/permission-gated
- **App activity:** in-app content you create (sessions, counts, notes)
- **Credentials:** email/password (stored hashed)

For each: collected, linked to the user's identity, NOT shared with third parties for
advertising, NOT sold. Used for app functionality and account management. Data is
encrypted in transit (HTTPS). Users can request deletion via contact@joseppy.ca.

Third-party services in use: Cloudflare (hosting/DB), Google (Sign-In + Places), Apple
(Sign in with Apple).
