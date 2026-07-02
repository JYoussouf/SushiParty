# Sushi Party — Kawaii pixel assets

Auto-generated from the kawaii pixel engine. Every sprite is 24×24 pixel art exported as a **transparent PNG**, in the cream-&-salmon kawaii style (soft outline, little face).

## Folders
- **`sprites/<imageKey>.png`** — static thumbnail, **96×96** (4× the 24px source, nearest-neighbour crisp).
- **`idle/<imageKey>.png`** — 2-frame idle "hover" **sprite sheet**, **192×96** (two 96×96 frames side by side). Frame 0 = rest (identical to `sprites/`), frame 1 = raised 1px.
- **`engine/`** — the generator (`px-menu.js`, backed by `px-core.js` + `px-forms.js`/`px-forms2.js`). Re-render at any size/format from here.
- **`manifest.json`** — every menu `imageKey` → its file, display name, category, and whether it shares art with a hero design.

## Using the static sprite (recommended)
Drop `sprites/<imageKey>.png` in and animate it **in code** — you already use `react-native-reanimated`. A gentle `translateY` bob + scale-pulse on press gives the same life shown in the gallery, with no frames to manage.

## Using the baked idle sheet
Each `idle/<key>.png` is 2 frames of 96px. Loop frame 0 / 1 at ~3 fps (≈160 ms each) for a calm hover: render the 192-wide image inside a 96px-wide window and animate `translateX` between `0` and `-96`.

## Naming
Files are named by `imageKey` (e.g. `nigiri_salmon.png`) to match `src/lib/itemEmoji.ts`. The 15 `*_any` keys and a few near-identical items reuse a hero design — they still get their own (identical) file so **every key resolves**; `manifest.json`'s `sharesWith` notes the source.

## Need other sizes / SVG?
The art is shape-defined, so it scales to any integer multiple cleanly. Edit the render loop in `engine/` (or ask) for @2x/@3x buckets or SVG output.

## Suggested placement in the app
`assets/pixel/` — then resolve `require('../../assets/pixel/sprites/' + imageKey + '.png')` (static map) in place of the emoji lookup.
