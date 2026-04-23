# Sushi Smackdown — UX Flow & Screen Inventory

## Screen List

| Screen | Route | Purpose |
|--------|-------|---------|
| Login | `(auth)/login` | Email + password sign-in |
| Register | `(auth)/register` | New account + username selection |
| Scoreboard | `(tabs)/scoreboard` | Main counter; tap to tally sushi |
| History | `(tabs)/history` | Past sessions with location + friends |
| Friends | `(tabs)/friends` | Friend list + activity feed |
| Profile | `(tabs)/profile` | Account settings, stats, sign out |
| Restaurant Picker | `restaurant/picker` | GPS locate or manually search restaurant |
| Session Mode Select | `session/mode-select` | Choose single / individual / group |
| Group Join | `session/group-join` | Enter code or scan QR to join group |
| Session Summary | `session/summary` (M3) | Post-submit recap with total counts |
| Anomaly Confirm | modal (inline M6) | Confirm unusually high count |

---

## Navigation Graph

```
                        ┌────────────────────────────────────────┐
                        │           App Start                    │
                        └──────────────┬─────────────────────────┘
                                       │ onAuthStateChanged
                         ┌─────────────┴──────────────┐
                         ▼                            ▼
                   Not logged in               Logged in
                         │                            │
                   ┌─────▼──────┐           ┌─────────▼───────────┐
                   │   Login    │           │   (tabs) Tab Bar    │
                   └─────┬──────┘           │                     │
                         │                 │  Scoreboard          │
                   ┌─────▼──────┐          │  History             │
                   │  Register  │          │  Friends             │
                   └─────┬──────┘          │  Profile             │
                         │                 └─────────────────────-┘
                         └──────────────────────────┘
                                (enter tabs)

  From Scoreboard:
    → restaurant/picker    (tap restaurant badge in header)
    → session/mode-select  (tap mode icon in header)
      → session/group-join (if group mode selected)
    → session/summary      (after successful submit — M3)
    → Anomaly Confirm modal (if z-score flag triggered — M6)

  From History:
    → session/summary      (tap a past session to expand)

  From Friends:
    → user profile (read-only, tap a friend)
    → Add Friend modal (tap + button)

  From Profile:
    → (auth)/login         (after sign out)
```

---

## Per-Screen Responsibilities

### `(auth)/login`
- Email + password fields
- "Sign In" button → Firebase `signInWithEmailAndPassword`
- Link to Register
- Error display (wrong password, no account)
- On success: onAuthStateChanged fires → redirects to tabs

### `(auth)/register`
- Email, password, display name, username fields
- Username uniqueness check (Firestore query)
- On submit: Firebase `createUserWithEmailAndPassword` → write `users/{uid}` doc
- On success: redirects to tabs

### `(tabs)/scoreboard`
- Header: restaurant name badge (tappable → picker), session mode icon, total piece count
- Scrollable list of `SushiCounter` rows grouped by category (nigiri, sashimi, rolls, specials)
- Category headers with count subtotals
- "Menu" toggle button: switch global ↔ restaurant-specific menu (M2)
- "+" / "−" buttons on each row; animated count badge
- Sticky bottom footer: Reset button + Submit button (disabled if total = 0)
- Submit flow:
  1. (M6) Check anomaly → show confirmation modal if flagged
  2. Write session to Firestore (M1)
  3. Update restaurant stats (M6, Cloud Function)
  4. Navigate to session/summary (M3)

### `(tabs)/history`
- Chronological list of past sessions
- Each card: restaurant name, date, total pieces, friend avatars who attended
- Tap card → session/summary detail view
- Empty state with CTA to start first session

### `(tabs)/friends`
- Friend list with username, avatar, last session info (restaurant + pieces)
- Activity feed: recent sessions from friends, sorted by recency
- "Add Friend" button → search by username modal
- Pending friend requests section

### `(tabs)/profile`
- Avatar (placeholder initials)
- Username + display name
- Stats: total sessions, total pieces eaten all time, favorite restaurant
- Sign Out button
- (Future: edit profile, notifications)

### `restaurant/picker`
- Map view centered on GPS location
- Nearby restaurant list (sorted by distance)
- Search bar for manual entry
- Tap restaurant → confirm selection → load restaurant menu
- "Use global menu" fallback option
- "Add new restaurant" option (creates skeleton doc + uses global menu)

### `session/mode-select`
- Three large cards: Single Phone, Individual, Group Linked
- Each card has icon + description of the mode
- Selecting Group Linked → navigates to session/group-join
- Selecting other modes → returns to Scoreboard in chosen mode

### `session/group-join`
- "Create Group" button → generates 6-char code, shows it for others to enter
- "Join Group" input → enter code → look up groupCodes → subscribe to session
- QR code display/scanner option (M5)

### `session/summary` (M3)
- Total pieces for current session per participant
- Breakdown by category
- Restaurant + date + session mode badge
- Share button (screenshot or deep link)
- "Tag Friends" button to add attendees who haven't linked yet
- "Done" → returns to Scoreboard (reset state)

### Anomaly Confirm Modal (M6)
- Triggered inline from Scoreboard submit flow
- Shows: "You logged N pieces at [Restaurant]. The average is M ± SD."
- Two buttons: "Yes, that's right" (submit with flagged=true) and "Let me recheck" (dismiss)
