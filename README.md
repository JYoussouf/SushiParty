# Sushi Smackdown 🍣

A mobile scoreboard for all-you-can-eat sushi restaurants. Tap to count, submit your tally, and share eating history with friends.

Built with React Native + Expo, Firebase Firestore, and Reanimated.

---

## Quick Start

### Prerequisites
- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — `npm install -g expo-cli`
- iOS Simulator (Xcode) or Android emulator, or the **Expo Go** app on your phone

### 1. Install dependencies

```bash
cd sushi-smackdown
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required because Firebase 12 has a react-dom peer conflict with React 19.

### 2. Configure Firebase

```bash
cp .env.example .env
```

Fill in your values from the [Firebase console](https://console.firebase.google.com/):

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

> The app will boot without valid Firebase keys — screens that require Firestore will show errors until M1 is complete.

### 3. Start the dev server

```bash
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.

---

## Project Structure

```
sushi-smackdown/
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
│   │   ├── firebase/           # Firebase init + Firestore constants
│   │   ├── menus/globalMenu.ts # 28-item default sushi menu
│   │   └── stats/              # Anomaly detection (Welford algorithm)
│   └── types/index.ts          # Shared TypeScript interfaces
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
├── .env.example                # Firebase config template
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

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React Native + Expo SDK 54 |
| Navigation | Expo Router 6 (file-based) |
| Language | TypeScript (strict) |
| Database | Firebase Firestore |
| Auth | Firebase Auth |
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
| M1 — Auth + Single-User Counter | 🔜 Next |
| M2 — Menus + Locations | Planned |
| M3 — History | Planned |
| M4 — Friends | Planned |
| M5 — Group Sessions | Planned |
| M6 — Anomaly Detection | Planned |
| M7 — Polish + Animations | Planned |

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for Firestore schema, security rules, real-time sync strategy, and anomaly detection design.
