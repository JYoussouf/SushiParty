# Sushi Smackdown — Implementation Roadmap

## Milestone Overview

| # | Name | Focus | DoD |
|---|------|-------|-----|
| M0 | Scaffolding | Project setup | `npx expo start` runs; docs written |
| M1 | Auth + Single-User Counter | Core loop | Sign-up/in works; session submits to Firestore |
| M2 | Menus + Locations | Restaurant context | GPS locates restaurant; restaurant menu loads |
| M3 | History | Persistence | Past sessions list with detail view |
| M4 | Friends | Social layer | Add friends; see their history |
| M5 | Group Sessions | Real-time | 2+ phones sync live counts |
| M6 | Anomaly Detection | Data integrity | Outliers flagged and confirmed |
| M7 | Polish + Animations | Delight | Reanimated gesture feedback; sushi images |

---

## M0 — Scaffolding ✅

**Goal:** Runnable skeleton with all docs in place.

**Definition of Done:**
- [x] Expo SDK 54 project with TypeScript strict mode
- [x] Expo Router with tab bar shell
- [x] 4 tabs: Scoreboard, History, Friends, Profile
- [x] Auth placeholder screens (login, register)
- [x] Additional routes: restaurant/picker, session/mode-select, session/group-join
- [x] Firebase config wired to `.env` (placeholder keys)
- [x] Global sushi menu seed data (`globalMenu.ts` — 28 items)
- [x] `SushiCounter` component with Reanimated spring feedback
- [x] `useSession` hook (local state, no Firestore yet)
- [x] Anomaly detection logic (`isAnomaly`, `updateRestaurantStats`)
- [x] ESLint + Prettier + TypeScript strict configured
- [x] `assets/images/sushi/README.md` with naming convention
- [x] `docs/ARCHITECTURE.md`, `docs/UX_FLOW.md`, `docs/ROADMAP.md`
- [x] Git initialized, initial commit
- [x] `npx expo start` runs without errors

---

## M1 — Auth + Single-User Counter

**Goal:** A real user can sign up, count sushi, and submit a session that persists.

**Tasks:**
- [ ] Install `firebase/auth` React context provider
- [ ] Implement Login screen (email/password)
- [ ] Implement Register screen (email/password + username)
- [ ] Username uniqueness check against Firestore
- [ ] `onAuthStateChanged` listener → redirect to auth or tabs
- [ ] Persist auth token via `expo-secure-store`
- [ ] Scoreboard: write session doc to `sessions/{id}` on submit
- [ ] Profile screen: show display name, sign out
- [ ] Session Mode selector: Single-phone mode UI (multiple participants, one device)
- [ ] Basic error handling (auth errors, network errors)

**Definition of Done:**
- User can create an account and it persists across app restarts
- Tapping submit on the Scoreboard writes a session document to Firestore
- Sign out and sign in again returns the user to their profile

---

## M2 — Menus + Locations

**Goal:** Sessions are tied to a real restaurant; restaurant-specific menus load.

**Tasks:**
- [ ] Request location permission via `expo-location`
- [ ] `restaurant/picker` screen: nearby restaurant list (Firestore GeoPoint query or Geohash)
- [ ] Manual restaurant search by name
- [ ] "Add new restaurant" flow
- [ ] Load restaurant-specific menu from Firestore (fallback to global)
- [ ] Menu toggle UI on Scoreboard (global ↔ restaurant menu)
- [ ] Restaurant name badge in Scoreboard header (tappable)
- [ ] Store `restaurantId`, `restaurantName`, `menuId`, `location` on session submit

**Definition of Done:**
- GPS detects approximate location; user confirms or manually selects restaurant
- Restaurant-specific menu loads on Scoreboard when available
- Submitted sessions contain correct restaurant and location metadata

---

## M3 — History

**Goal:** Users can see and review all their past sessions.

**Tasks:**
- [ ] History tab: Firestore query `sessions` where `ownerUid == uid` ordered by `submittedAt DESC`
- [ ] Session card component: restaurant name, date, total pieces, mode badge
- [ ] `session/summary` detail screen: full breakdown by category + item
- [ ] Display friends who attended (tagged UIDs resolved to display names)
- [ ] Empty state with CTA
- [ ] Pagination (cursor-based, load 20 at a time)

**Definition of Done:**
- All submitted sessions appear in History in reverse-chronological order
- Tapping a session shows full item-level detail

---

## M4 — Friends

**Goal:** Users can add friends and see their eating history.

**Tasks:**
- [ ] "Add Friend" modal: search by username (Firestore query)
- [ ] Friend request / mutual-follow model vs. direct add (decision: start with direct add — username lookup + confirm)
- [ ] Friends list screen with last session info
- [ ] Activity feed: recent sessions from `friendIds` (fan-out read or Firestore array-contains query)
- [ ] Friend profile (read-only): their history visible to you
- [ ] Tag friends on a session (post-submit flow)
- [ ] `useFriends` hook implementation

**Definition of Done:**
- Can search for a user by username and add them as a friend
- Friends' most recent sessions are visible in the Friends tab
- Sessions can be tagged with attendees

---

## M5 — Group Sessions (Real-Time)

**Goal:** Multiple phones linked to the same session, live count updates for all.

**Tasks:**
- [ ] "Create Group" flow: generate 6-char `groupCode`, write to `groupCodes/{code}`
- [ ] "Join Group" flow: enter code → look up sessionId → subscribe to `onSnapshot`
- [ ] Scoreboard shows all participants' live counts (grouped by participant)
- [ ] Dot-notation `updateDoc` writes to prevent participant count conflicts
- [ ] `session/group-join` screen with QR display + manual code entry
- [ ] Group code expiry (8-hour TTL, enforced by Cloud Function cleanup)
- [ ] Graceful handling of participant disconnect/reconnect

**Definition of Done:**
- Two devices in the same group session see each other's counts update in near-real-time
- All participants' data is included in the submitted session doc
- Group sessions appear correctly in each participant's History

---

## M6 — Anomaly Detection

**Goal:** Statistically unusual submissions are flagged and confirmed before saving.

**Tasks:**
- [ ] Cloud Function: `onSessionSubmit` trigger → call `updateRestaurantStats` if `!flagged`
- [ ] Client: call `isAnomaly` before submitting → show confirmation modal if true
- [ ] Anomaly modal UI (see UX_FLOW.md)
- [ ] Store `flagged: true` on confirmed outlier sessions (baseline not updated)
- [ ] Minimum 10 sessions required before flagging activates per restaurant
- [ ] Seed some baseline stats for test restaurants

**Definition of Done:**
- Submitting an extreme count (e.g., 300 pieces) at a restaurant with baseline data triggers the confirmation modal
- Confirmed outliers persist with `flagged: true` and don't skew the baseline
- Normal submissions silently update the baseline

---

## M7 — Polish + Animations

**Goal:** The app feels fun and responsive, with sushi imagery throughout.

**Tasks:**
- [ ] Replace placeholder emoji tabs with custom SVG/icon set
- [ ] `SushiCounter` image: show item image (PNG from `assets/images/sushi/`) next to row
- [ ] Drag/tap gesture on images: `react-native-reanimated` rotate + scale spring
- [ ] Confetti or particle burst animation on session submit
- [ ] Smooth category section header collapse/expand
- [ ] Haptic feedback on counter increment (`expo-haptics`)
- [ ] Loading skeletons for History and Friends lists
- [ ] Dark mode support
- [ ] App icon + splash screen finalized
- [ ] Accessibility: `accessibilityLabel` on all interactive elements

**Definition of Done:**
- All sushi images present and animating on tap
- Haptic feedback fires on every counter increment
- App passes basic accessibility audit (no unlabeled interactive elements)
- Dark mode renders without broken colors

---

## Cross-Cutting Concerns (any milestone)

- **Offline support:** Firestore `enableIndexedDbPersistence` (web) or offline persistence (native) so counter works without connectivity; sync on reconnect
- **Error boundaries:** React error boundary wrapping tab screens
- **Analytics:** Expo + Firebase Analytics for basic screen tracking (optional, add in M3)
- **Testing:** Jest + React Native Testing Library; target hooks and stats utilities first
