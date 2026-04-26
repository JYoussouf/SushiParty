# Sushi Party — Implementation Roadmap

## Milestone Overview

| # | Name | Focus | DoD |
|---|------|-------|-----|
| M0 | Scaffolding | Project setup | `npx expo start` runs; docs written | ✅ |
| M1 | Auth + Single-User Counter | Core loop | Sign-up/in works; session submits to Cloudflare D1 | ✅ |
| M2 | Menus + Locations | Restaurant context | GPS locates restaurant; restaurant menu loads | ✅ |
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
- [x] Cloudflare API URL wired to `.env`
- [x] Global sushi menu seed data (`globalMenu.ts` — 28 items)
- [x] `SushiCounter` component with Reanimated spring feedback
- [x] `useSession` hook (local state before submit)
- [x] Anomaly detection logic (`isAnomaly`, `updateRestaurantStats`)
- [x] ESLint + Prettier + TypeScript strict configured
- [x] `assets/images/sushi/README.md` with naming convention
- [x] `docs/ARCHITECTURE.md`, `docs/UX_FLOW.md`, `docs/ROADMAP.md`
- [x] Git initialized, initial commit
- [x] `npx expo start` runs without errors

---

## M1 — Auth + Single-User Counter ✅

**Goal:** A real user can sign up, count sushi, and submit a session that persists.

**Tasks:**
- [x] `AuthContext` with Worker-issued device auth, signIn, signUp, signOut
- [x] Implement Login screen (email/password + friendly error messages)
- [x] Implement Register screen (email/password + display name + username)
- [x] Username uniqueness check against D1 (`isUsernameTaken`)
- [x] Device auth bootstrap → redirect to app shell (root `_layout.tsx`)
- [x] Persist auth token via SecureStore
- [x] `src/lib/cloudflare/users.ts` — createUserDoc, getUserDoc
- [x] `src/lib/cloudflare/sessions.ts` — submitSession, getUserSessions
- [x] Scoreboard: write session row to D1 through the Worker on submit
- [x] Scoreboard: category section headers with subtotals
- [x] Scoreboard: restaurant badge + mode icon in header (navigation stubs)
- [x] Profile screen: avatar initials, display name, username, email, sign out
- [x] Session Mode selector UI (Single / Individual / Group cards with availability badges)

**Definition of Done:**
- [x] User can create an account and it persists across app restarts
- [x] Tapping submit on the Scoreboard writes a session row to D1 through the Worker
- [x] Sign out and sign in again returns the user to their profile

---

## M2 — Menus + Locations ✅

**Goal:** Sessions are tied to a real restaurant; restaurant-specific menus load.

**Tasks:**
- [x] Request location permission via `expo-location` (`useLocation` hook)
- [x] `src/lib/geo.ts` — haversine distance + latitude bounding box for geo queries
- [x] `src/lib/cloudflare/restaurants.ts` — getNearbyRestaurants, search, create, get
- [x] `src/lib/cloudflare/menus.ts` — getMenu with global-default fallback
- [x] `restaurant/picker` screen: GPS nearby list sorted by distance
- [x] Manual restaurant search by name (D1 prefix query on `name_lower`)
- [x] "Add new restaurant" modal (uses current GPS location, writes to D1)
- [x] `RestaurantContext` — selected restaurant + active menu state app-wide
- [x] Menu toggle UI on Scoreboard (global ↔ restaurant menu, only shown when they differ)
- [x] Restaurant name badge in Scoreboard header (tappable)
- [x] Store `restaurantId`, `restaurantName`, `menuId`, `location` on session submit
- [x] Clear restaurant selection after successful submit

**Definition of Done:**
- [x] GPS detects approximate location; user confirms or manually selects restaurant
- [x] Restaurant-specific menu loads on Scoreboard when available
- [x] Submitted sessions contain correct restaurant and location metadata

---

## M3 — History

**Goal:** Users can see and review all their past sessions.

**Tasks:**
- [ ] History tab: Worker query `sessions` where `owner_uid == uid` ordered by `submitted_at DESC`
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
- [ ] "Add Friend" modal: search by username (D1 query)
- [ ] Friend request / mutual-follow model vs. direct add (decision: start with direct add — username lookup + confirm)
- [ ] Friends list screen with last session info
- [ ] Activity feed: recent sessions from `friendIds` (fan-out read or D1 query)
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
- [ ] "Create Group" flow: generate 6-char `groupCode`, create Durable Object draft
- [ ] "Join Group" flow: enter code → connect to Durable Object WebSocket
- [ ] Scoreboard shows all participants' live counts (grouped by participant)
- [ ] Per-participant count updates handled by the Durable Object
- [ ] `session/group-join` screen with QR display + manual code entry
- [ ] Group code expiry (8-hour TTL, enforced by Durable Object storage)
- [ ] Graceful handling of participant disconnect/reconnect

**Definition of Done:**
- Two devices in the same group session see each other's counts update in near-real-time
- All participants' data is included in the submitted session doc
- Group sessions appear correctly in each participant's History

---

## M6 — Anomaly Detection

**Goal:** Statistically unusual submissions are flagged and confirmed before saving.

**Tasks:**
- [ ] Worker session submit route calls `updateRestaurantStats` if `!flagged`
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

- **Offline support:** queue Worker writes locally so counter works without connectivity; sync on reconnect
- **Error boundaries:** React error boundary wrapping tab screens
- **Analytics:** Expo analytics or Cloudflare Analytics Engine for basic screen tracking (optional, add in M3)
- **Testing:** Jest + React Native Testing Library; target hooks and stats utilities first

---

## Continuous Feature Requests

These are post-milestone product requests that users are likely to ask for once the core loop is stable. Each request includes a concrete build prompt so it can be picked up and implemented independently.

### CFR1 — Personal Stats Dashboard

**Why users will ask for it:** Once history exists, users will want a fast summary of their own habits without manually reading every session.

**Implementation prompt:**
Build a profile analytics dashboard that summarizes the current user’s own eating history. Use saved sessions to compute total sessions, total pieces personally eaten, average pieces per session, favorite restaurant, most ordered item, and a recent activity streak. Make the UI live on the Profile tab, refresh when the screen regains focus, and handle the empty-history case gracefully. Stats should be based on the current user’s participant record inside each session, not the full table total. Keep the implementation local-first, typed, and reusable so the same calculation helpers can later power leaderboards and achievements.

### CFR2 — Export Session History

**Why users will ask for it:** Users who track seriously will want to move their data into Notes, Sheets, or messages.

**Implementation prompt:**
Add a history export flow that lets the user generate a shareable plain-text or CSV summary of their sessions. Include date, restaurant, mode, personal piece count, tagged attendees, and top items for each session. Start with local generation and the system share sheet or copy-to-clipboard fallback. The export action should be available from History and Profile, work offline, and avoid blocking the UI on large histories.

### CFR3 — Top Dishes And Favorites

**Why users will ask for it:** After enough sessions, users will want to know which sushi they actually order most often.

**Implementation prompt:**
Add a favorites analytics view that ranks the user’s most ordered sushi items across all sessions, including counts and percentage of sessions ordered. Show top 5 items and let the user expand to a full ranked list. Use existing menu metadata when available so item names stay human-readable even when sessions were saved under different restaurants. Keep the aggregation logic reusable and stable for future recommendation features.

### CFR4 — Session Notes

**Why users will ask for it:** People remember meals by context, not just counts, and will want to attach quick notes like “birthday dinner” or “service was slow.”

**Implementation prompt:**
Add optional notes to each session. Let users write or edit a short note from the session summary screen and display it on History cards and the detail view. Persist notes inside the session record, keep editing lightweight, and do not require a note for submission. Notes should be searchable later without changing the core counting flow.

### CFR5 — Favorite Restaurants And Restaurant Insights

**Why users will ask for it:** The current app tracks restaurants already, so users will naturally want restaurant-specific summaries.

**Implementation prompt:**
Add restaurant insights for the current user: favorite restaurant by visits, total pieces eaten per restaurant, most recent visit date, and top items at that restaurant. Surface a compact summary in Profile and make each restaurant row expandable or navigable to a detail screen. Build the aggregation from existing session metadata and keep the helpers reusable for future public leaderboards.

### CFR6 — Search And Filter History

**Why users will ask for it:** As history grows, the current reverse-chronological list becomes hard to use without search.

**Implementation prompt:**
Add search and filter controls to History so users can filter by restaurant name, mode, tagged friend, and date range. Results should update client-side from already-loaded local data first, with a structure that can later support backend filtering. Preserve pagination behavior and keep the empty state specific to the active filter when no matches are found.

### CFR7 — Achievements And Milestones

**Why users will ask for it:** A tracking app with friends and history naturally invites milestone badges and progress mechanics.

**Implementation prompt:**
Implement a lightweight achievements system with locally computed badges such as first session, 100 total pieces, 10 sessions, 5 different restaurants, and first group session. Show earned badges on Profile and optionally surface a newly-earned badge on session summary after submission. Keep the achievement engine data-driven so new badges can be added without rewriting the screen logic.

### CFR8 — Session Templates And Quick Start

**Why users will ask for it:** Frequent diners will want to avoid repeating the same setup for favorite restaurants or common group configurations.

**Implementation prompt:**
Add quick-start templates that save a preferred restaurant, menu preference, and default mode. Let users launch a new session from a saved template on the Scoreboard or Profile tab. Templates should be editable, stored locally, and designed so cloud sync can be added later without changing the UI contract.

### CFR9 — Friend Challenges

**Why users will ask for it:** Once Friends and group sessions exist, users will want more competitive or cooperative social mechanics.

**Implementation prompt:**
Add lightweight friend challenges such as “first to 50 pieces this week” or “visit 3 sushi spots this month.” Start with local challenge definitions and progress computed from saved sessions for the current user and locally available friend data. Show active challenges in Friends and summary progress on Profile. Keep the logic modular so synced/shared challenges can replace the local model later.

### CFR10 — Backup And Restore

**Why users will ask for it:** A local-first app needs a way to protect data before users trust it long term.

**Implementation prompt:**
Add a backup and restore flow for local data. Let users export their profile, sessions, friends, and templates to a JSON bundle and re-import it on the same or another device. Validate imported data carefully, prevent malformed merges, and keep the flow explicit so users understand whether they are replacing or augmenting existing local data.
