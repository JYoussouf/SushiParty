# Sushi Party — Architecture

## 1. High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                   React Native / Expo (iOS + Android)         │
│                                                               │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │  Expo Router │  │  React Context  │  │ React Native     │ │
│  │  (navigation)│  │  (session state)│  │ Reanimated       │ │
│  └──────────────┘  └─────────────────┘  └──────────────────┘ │
│            │                │                    │            │
│  ┌─────────▼────────────────▼────────────────────▼─────────┐ │
│  │                      src/                               │ │
│  │  screens  components  hooks  lib/firebase  lib/stats    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                            │                                  │
└────────────────────────────┼──────────────────────────────────┘
                             │ Firebase SDK (client)
                   ┌─────────▼──────────┐
                   │   Firebase Cloud   │
                   │                   │
                   │  Auth (email/pass) │
                   │  Firestore         │
                   │  (real-time sync)  │
                   └────────────────────┘
```

## 2. Module Breakdown

| Module | Path | Responsibility |
|--------|------|----------------|
| Navigation shell | `app/` | Expo Router route tree, layouts |
| Scoreboard | `app/(tabs)/scoreboard.tsx` | Counter UI, session state, submit |
| History | `app/(tabs)/history.tsx` | Past sessions list |
| Friends | `app/(tabs)/friends.tsx` | Friend list + activity feed |
| Profile | `app/(tabs)/profile.tsx` | Account, sign out |
| Auth screens | `app/(auth)/` | Login, register |
| Restaurant picker | `app/restaurant/picker.tsx` | GPS + search, menu toggle |
| Session mode select | `app/session/mode-select.tsx` | Single/individual/group |
| Group join | `app/session/group-join.tsx` | QR/code join for group sessions |
| Types | `src/types/index.ts` | Shared TypeScript interfaces |
| Firebase config | `src/lib/firebase/config.ts` | App init (reads `.env`) |
| Firestore helpers | `src/lib/firebase/firestore.ts` | Collection constants, query wrappers |
| Firebase Auth | `src/lib/firebase/auth.ts` | Auth instance |
| Global menu | `src/lib/menus/globalMenu.ts` | Default 28-item menu seed data |
| Anomaly detection | `src/lib/stats/anomalyDetection.ts` | Z-score flagging + Welford updates |
| useSession hook | `src/hooks/useSession.ts` | Local session state + counts |
| useMenu hook | `src/hooks/useMenu.ts` | Menu toggle (global ↔ restaurant) |
| useFriends hook | `src/hooks/useFriends.ts` | Friend list queries (M4) |
| SushiCounter | `src/components/SushiCounter.tsx` | Animated +/− counter row |
| Sushi images | `assets/images/sushi/` | PNG assets, 1×/2×/3× |

## 3. Firebase Firestore Schema

### Collections

#### `users/{userId}`
```
uid:         string        // same as Firebase Auth UID
username:    string        // unique, lowercase, URL-safe
displayName: string
email:       string
createdAt:   Timestamp
friendIds:   string[]      // array of UIDs
```

#### `sessions/{sessionId}`
```
id:              string
mode:            'single' | 'individual' | 'group'
restaurantId:    string          // ref to restaurants/{id}
restaurantName:  string          // denormalized for display
menuId:          string
menuVersion:     number
location:        GeoPoint
startedAt:       Timestamp
submittedAt:     Timestamp | null
participants:    Participant[]   // embedded array (see below)
groupCode:       string | null   // 6-char code for group sessions
flagged:         boolean
ownerUid:        string
```

**Participant (embedded in sessions)**
```
userId:      string
displayName: string
counts:      map<string, number>   // "itemId" → count
             // or "itemId:size" → count for sized items
```

#### `restaurants/{restaurantId}`
```
id:        string
name:      string
nameLower: string        // lowercased name — enables Firestore prefix search
address:   string
location:  GeoPoint
menuId:    string        // points to menus/{id} or 'global-default'
createdAt: Timestamp
stats: {
  totalSessions:          number
  meanPiecesPerSession:   number
  stdDevPiecesPerSession: number
  updatedAt:              Timestamp
}
```

#### `menus/{menuId}`
```
id:           string
restaurantId: string | null   // null = global default
version:      number
items: [
  {
    id:       string
    name:     string
    category: 'nigiri' | 'sashimi' | 'roll' | 'special' | 'other'
    sizes:    string[] | null
    imageKey: string | null
  }
]
```

#### `groupCodes/{code}`
```
code:      string    // 6-char alphanumeric
sessionId: string
createdAt: Timestamp
expiresAt: Timestamp // TTL: 8 hours
```

### Indexes Required
- `sessions`: `ownerUid ASC, submittedAt DESC` — user history
- `sessions`: `groupCode ASC, submittedAt DESC` — group lookup
- `sessions`: `restaurantId ASC, submittedAt DESC` — per-restaurant stats
- `restaurants`: `location GEO` — nearby restaurant queries (Firestore GeoPoint range or Geohash)

### Security Rules Outline

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own doc; friends can read
    match /users/{userId} {
      allow read: if request.auth != null &&
                     (request.auth.uid == userId ||
                      request.auth.uid in resource.data.friendIds);
      allow write: if request.auth.uid == userId;
    }

    // Sessions: owner can write; participants + their friends can read
    match /sessions/{sessionId} {
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.ownerUid ||
                       request.auth.uid in resource.data.participants[*].userId;
      allow read: if request.auth.uid == resource.data.ownerUid ||
                     request.auth.uid in resource.data.participants[*].userId;
      // Friend visibility enforced at query layer (fan-out reads)
    }

    // Restaurants: public read; authenticated users can create
    // (stats updates are admin-only via Cloud Function in M6)
    match /restaurants/{id} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if false; // Cloud Function only
      allow delete: if false;
    }

    // Menus: public read, admin-only write
    match /menus/{id} {
      allow read: if true;
      allow write: if false;
    }

    // Group codes: authenticated read; creator write
    match /groupCodes/{code} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.creatorUid;
    }
  }
}
```

## 4. Real-Time Sync Strategy (Group-Linked Sessions)

Group sessions use Firestore `onSnapshot` on the shared `sessions/{sessionId}` document.

**Flow:**
1. Session owner creates session doc → generates 6-char `groupCode` → writes to `groupCodes/{code}`.
2. Joining peers look up `groupCodes/{code}` → get `sessionId` → call `onSnapshot(sessions/{sessionId})`.
3. Each peer's local counter increments are **immediately reflected locally** (optimistic UI) then written via `updateDoc` to the `participants` array at their index.
4. Firestore `onSnapshot` propagates updates to all connected peers in ~100–300 ms.
5. On submit: owner marks `submittedAt`; all listeners receive the update and transition to the summary view.

**Conflict avoidance:** Each participant owns only their own `counts` sub-map. Writes use `FieldValue` dot-notation updates (`participants.N.counts.itemId`) to avoid overwriting siblings.

## 5. Anomaly Detection

**Baseline storage:** `restaurants/{id}.stats` holds a running mean and stdDev computed via Welford's online algorithm (`src/lib/stats/anomalyDetection.ts`). Updated by a Cloud Function triggered on session submission (M6).

**Flagging logic:**
1. Client totals piece count before submit.
2. Calls `isAnomaly(total, stats)` — flags if z-score > 3.5 SDs above mean.
3. If flagged: shows confirmation modal ("That's a lot of sushi — are you sure?").
4. User confirms → session submitted with `flagged: true` and baseline NOT updated.
5. User cancels → returns to scoreboard to adjust.
6. No baseline update for confirmed outliers preserves data integrity.
7. Minimum 10 sessions required before flagging activates per restaurant.

## 6. Auth Flow

```
App start
  │
  ├─ Firebase Auth onAuthStateChanged
  │       │
  │       ├─ user == null → redirect to (auth)/login
  │       │
  │       └─ user != null → load user doc from users/{uid}
  │                 │
  │                 ├─ doc exists → enter (tabs) shell
  │                 │
  │                 └─ doc missing → redirect to (auth)/register
  │                       (first-time user finishing profile)
  │
  └─ SecureStore caches auth token across app restarts
```

## 7. The Three Session Modes

| Mode | Description | Data flow |
|------|-------------|-----------|
| **Single (shared phone)** | Multiple people take turns entering counts on one device | One session doc, multiple participant entries, local state only until submit |
| **Individual** | Each friend on their own phone, counts tracked independently | Each device creates its own session doc; optionally tagged with same location/friends |
| **Group-linked** | Multiple phones linked to the same session in real time | One session doc, `onSnapshot` subscription on each device, writes via dot-notation updates |
