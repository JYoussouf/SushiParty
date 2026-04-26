# Sushi Party 🍣

A mobile scoreboard for all-you-can-eat sushi restaurants. Tap to count, submit your tally, and share eating history with friends.

Built with React Native + Expo, a Cloudflare Worker API, D1, Durable Objects, and Reanimated.

---

## Quick Start

### Prerequisites
- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — `npm install -g expo-cli`
- iOS Simulator (Xcode) or Android emulator, or the **Expo Go** app on your phone

### 1. Install dependencies

```bash
cd sushi-party
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is still useful with this Expo/React dependency set.

### 2. Configure Cloudflare API

```bash
cp .env.example .env
```

For local API development, keep:

```
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8787
```

After deploying the Worker, replace that with your `https://...workers.dev` or custom domain URL.
If you test on a physical device with Expo Go, use your computer's LAN IP instead of `127.0.0.1`.

### 3. Start the Cloudflare API

```bash
cd api
npm install
npm run d1:apply:local
npm run dev
```

### 4. Start the Expo dev server

```bash
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.

---

## Project Structure

```
sushi-party/
├── app/                        # Expo Router route tree
│   ├── _layout.tsx             # Root layout
│   ├── (tabs)/                 # Bottom tab bar
│   │   ├── _layout.tsx
│   │   ├── scoreboard.tsx      # ← Main screen (working)
│   │   ├── history.tsx
│   │   ├── friends.tsx
│   │   └── profile.tsx
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── restaurant/picker.tsx
│   └── session/
│       ├── mode-select.tsx
│       └── group-join.tsx
│
├── src/
│   ├── components/             # Shared UI components
│   │   └── SushiCounter.tsx    # Animated counter row
│   ├── hooks/
│   │   ├── useSession.ts       # Local session state
│   │   ├── useMenu.ts          # Menu toggle
│   │   └── useFriends.ts       # Friend list (M4)
│   ├── lib/
│   │   ├── cloudflare/         # Worker API client + data helpers
│   │   ├── menus/globalMenu.ts # 28-item default sushi menu
│   │   └── stats/              # Anomaly detection (Welford algorithm)
│   └── types/index.ts          # Shared TypeScript interfaces
│
├── api/                        # Cloudflare Worker + D1 + Durable Objects
│   ├── src/index.ts            # HTTP API and group WebSocket backend
│   ├── migrations/             # D1 schema migrations
│   └── wrangler.jsonc          # Cloudflare bindings
│
├── assets/
│   └── images/sushi/           # Drop PNG sushi images here
│       └── README.md           # Naming convention for designer
│
├── docs/
│   ├── ARCHITECTURE.md         # Schema, sync strategy, auth flow
│   ├── UX_FLOW.md              # Screen list, nav graph, per-screen spec
│   └── ROADMAP.md              # Milestones M0–M7 with definition of done
│
├── .env.example                # Cloudflare API URL template
├── babel.config.js             # Reanimated plugin
└── README.md
```

---

## Development

```bash
# Lint
npm run lint

# Format
npm run format
```

## Cloudflare Deployment

```bash
cd api
npx wrangler login
npx wrangler d1 create sushi-party
```

Copy the returned `database_id` into `api/wrangler.jsonc`, then set a token signing secret and deploy:

```bash
npx wrangler secret put JWT_SECRET
npm run d1:apply:remote
npm run deploy
```

Set the app env var to the deployed Worker URL:

```bash
EXPO_PUBLIC_API_BASE_URL=https://<your-worker>.<your-account>.workers.dev
```

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React Native + Expo SDK 54 |
| Navigation | Expo Router 6 (file-based) |
| Language | TypeScript (strict) |
| Database | Cloudflare D1 |
| Auth | Worker-issued device token |
| Realtime | Cloudflare Durable Objects + WebSockets |
| Animations | React Native Reanimated 4 |
| Location | expo-location |
| Secure storage | expo-secure-store |
| Linting | ESLint + Prettier |

---

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full milestone breakdown.

| Milestone | Status |
|-----------|--------|
| M0 — Scaffolding | ✅ Complete |
| M1 — Auth + Single-User Counter | ✅ Complete |
| M2 — Menus + Locations | ✅ Complete |
| M3 — History | 🔜 Next |
| M4 — Friends | Planned |
| M5 — Group Sessions | Planned |
| M6 — Anomaly Detection | Planned |
| M7 — Polish + Animations | Planned |

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the Cloudflare API, D1 schema, real-time sync strategy, and anomaly detection design.

## Privacy Policy

A draft privacy policy for App Store publishing is included at [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md).

Before submission:
- Replace the placeholder business/contact details
- Host the policy at a public HTTPS URL
- Ensure App Store Connect privacy disclosures match the app’s actual behavior
