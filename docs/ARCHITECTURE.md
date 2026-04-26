# Sushi Party — Architecture

## 1. High-Level Architecture

```
React Native / Expo app
  ├─ Expo Router screens
  ├─ React Context state
  └─ src/lib/cloudflare/*
        │
        ▼
Cloudflare Worker API
  ├─ D1 SQL database: users, sessions, restaurants, menus
  ├─ Durable Object: group party realtime state
  └─ Worker-issued device token stored in SecureStore
```

The mobile app never talks to D1 directly. It calls the Worker over HTTPS using
`EXPO_PUBLIC_API_BASE_URL`, and the Worker enforces ownership and persistence.

## 2. Module Breakdown

| Module | Path | Responsibility |
|--------|------|----------------|
| App routes | `app/` | Expo Router route tree, tabs, auth, session screens |
| Cloudflare client | `src/lib/cloudflare/` | API fetch wrapper, auth token, data helpers |
| Backend | `api/src/index.ts` | Worker routes and Durable Object class |
| D1 schema | `api/migrations/` | SQL migrations for backend state |
| Types | `src/types/index.ts` | Shared app TypeScript interfaces |
| Global menu | `src/lib/menus/globalMenu.ts` | Default menu seed data |
| Anomaly detection | `src/lib/stats/anomalyDetection.ts` | Z-score flagging + Welford updates |
| Local preferences | `src/lib/local/` | Device profile, templates, local-only helpers |

## 3. D1 Schema

### `users`

```
uid TEXT PRIMARY KEY
username TEXT UNIQUE
display_name TEXT
email TEXT
friend_ids_json TEXT
created_at TEXT
updated_at TEXT
```

### `sessions`

```
id TEXT PRIMARY KEY
owner_uid TEXT
mode TEXT
restaurant_id TEXT
restaurant_name TEXT
menu_id TEXT
menu_version INTEGER
latitude REAL
longitude REAL
participants_json TEXT
group_code TEXT
note TEXT
flagged INTEGER
started_at TEXT
submitted_at TEXT
created_at TEXT
updated_at TEXT
```

Indexes:
- `sessions_owner_submitted_idx` on `(owner_uid, submitted_at DESC)`
- `sessions_submitted_idx` on `(submitted_at DESC)`

### `restaurants`

```
id TEXT PRIMARY KEY
name TEXT
name_lower TEXT
address TEXT
latitude REAL
longitude REAL
menu_id TEXT
stats_json TEXT
created_at TEXT
updated_at TEXT
```

Indexes:
- `restaurants_latitude_idx` on `latitude`
- `restaurants_name_lower_idx` on `name_lower`

### `menus`

```
id TEXT PRIMARY KEY
restaurant_id TEXT
version INTEGER
items_json TEXT
created_at TEXT
updated_at TEXT
```

## 4. Worker API

```
POST   /auth/device
GET    /users/me
PATCH  /users/me
GET    /users/username/:username/exists

POST   /sessions
GET    /sessions/me
GET    /sessions/:id
PATCH  /sessions/:id

GET    /restaurants/nearby?lat=&lng=&radiusKm=
GET    /restaurants/search?q=&lat=&lng=
GET    /restaurants/:id
POST   /restaurants

GET    /menus/:id

POST   /groups
GET    /groups/:code
POST   /groups/:code/join
POST   /groups/:code/counts
POST   /groups/:code/reset
POST   /groups/:code/avatar
GET    /groups/:code/ws
DELETE /groups/:code
```

## 5. Auth Flow

```
App start
  ├─ Load local device profile from AsyncStorage
  ├─ POST /auth/device
  │    ├─ Worker creates/updates users.uid
  │    └─ Worker returns signed device token
  ├─ Store token in expo-secure-store
  └─ Send Authorization: Bearer <token> on API calls
```

For development, the Worker uses a fallback signing secret. Before a real deploy,
set `JWT_SECRET` with `wrangler secret put JWT_SECRET`.

## 6. Real-Time Group Sessions

Group sessions are coordinated by a Durable Object addressed by the 6-character
party code. The object owns the draft state and accepts WebSocket connections.

Flow:
1. Host calls `POST /groups`; Worker reserves a code and creates a Durable Object draft.
2. Joiners call `POST /groups/:code/join`.
3. Scoreboard count/avatar changes call the group endpoints.
4. The Durable Object broadcasts the updated draft to connected WebSocket clients.
5. Submit writes the finished session to D1 through `POST /sessions`.

## 7. Anomaly Detection

Restaurant stats are stored in `restaurants.stats_json`. On non-flagged session
submission, the Worker updates the running mean and standard deviation. The
client still checks `isAnomaly(total, stats)` before submit so unusual counts can
be confirmed before persistence.

## 8. Session Modes

| Mode | Description | Data flow |
|------|-------------|-----------|
| Single | One device, one participant | Local counter state, submitted to D1 |
| Individual | Multiple people tracked on one device | Multiple participants, submitted to D1 |
| Group-linked | Multiple phones linked live | Durable Object draft, then submitted to D1 |
