/* ============================================================
   Sushi Party — Kawaii pixel engine (core)
   A "Pix" is a SIZE×SIZE grid of color-or-null.
   Forms compose ellipses / bands / polys, then get a 1px
   warm-brown silhouette outline. Everything is 24×24.
   ============================================================ */
const SIZE = 24;

class Pix {
  constructor(w = SIZE, h = SIZE) {
    this.w = w; this.h = h;
    this.d = Array.from({ length: h }, () => new Array(w).fill(null));
  }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    this.d[y][x] = c;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.d[y][x];
  }
  rect(x0, y0, x1, y1, c) {
    for (let y = Math.round(y0); y <= Math.round(y1); y++)
      for (let x = Math.round(x0); x <= Math.round(x1); x++) this.set(x, y, c);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  // filled radial band [r0,r1)
  band(cx, cy, r0, r1, c) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d >= r0 && d < r1) this.set(x, y, c);
      }
  }
  line(x0, y0, x1, y1, c, t = 1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 + 1;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
      if (t <= 1) this.set(x, y, c);
      else for (let oy = 0; oy < t; oy++) for (let ox = 0; ox < t; ox++) this.set(x + ox, y + oy, c);
    }
  }
  // filled polygon (even-odd)
  poly(pts, c) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++)
      for (let x = 0; x < this.w; x++)
        if (inPoly(x + 0.5, y + 0.5, pts)) this.set(x, y, c);
  }
  roundRect(x0, y0, x1, y1, r, c) {
    for (let y = Math.round(y0); y <= Math.round(y1); y++)
      for (let x = Math.round(x0); x <= Math.round(x1); x++) {
        let px = x, py = y, ok = true;
        const lx = x0 + r, rx = x1 - r, ty = y0 + r, by = y1 - r;
        if (px < lx && py < ty) ok = Math.hypot(px + 0.5 - lx, py + 0.5 - ty) <= r;
        else if (px > rx && py < ty) ok = Math.hypot(px + 0.5 - rx, py + 0.5 - ty) <= r;
        else if (px < lx && py > by) ok = Math.hypot(px + 0.5 - lx, py + 0.5 - by) <= r;
        else if (px > rx && py > by) ok = Math.hypot(px + 0.5 - rx, py + 0.5 - by) <= r;
        if (ok) this.set(x, y, c);
      }
  }
  // recolor `from` pixels to `to` on a checkerboard (dither texture)
  ditherOver(from, to, phase = 0) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.d[y][x] === from && ((x + y + phase) % 2 === 0)) this.d[y][x] = to;
  }
  // sprinkle: set a few scattered pixels of color `c` only where currently `over`
  sprinkle(coords, c, over) {
    for (const [x, y] of coords) if (!over || this.get(x, y) === over) this.set(x, y, c);
  }
}

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// add a 1px (or t-px) silhouette outline of `color` behind the sprite
function outlined(pix, color, t = 1) {
  const out = new Pix(pix.w, pix.h);
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) out.d[y][x] = pix.d[y][x];
  for (let y = 0; y < pix.h; y++)
    for (let x = 0; x < pix.w; x++) {
      if (pix.d[y][x]) continue;
      let near = false;
      for (let dy = -t; dy <= t && !near; dy++)
        for (let dx = -t; dx <= t; dx++) {
          if (!dx && !dy) continue;
          if (pix.get(x + dx, y + dy)) { near = true; break; }
        }
      if (near) out.d[y][x] = color;
    }
  return out;
}

/* ============================================================
   Kawaii palette library
   ============================================================ */
const INK = '#3b2716';        // warm-brown outline + eyes
const BLUSH = '#ff9d8c';
const PAL = {
  ink: INK, eye: INK, blush: BLUSH,
  rice:   { d: '#f0e2c6', m: '#fffaf2', l: '#ffffff' },
  nori:   { d: '#2c4628', m: '#41613a', l: '#577a48' },
  plate:  { d: '#d8c2a0', m: '#f1e4ca', l: '#fff7e8' },   // bowls / plates
  bowlBlue:{ d: '#3a6ea0', m: '#5b94c6', l: '#9fc4e2' },   // blue ramen bowl
  // proteins / fills
  salmon: { d: '#e2554a', m: '#ff7c6f', l: '#ffd6cb', stripe: '#fff1ea' },
  tuna:   { d: '#c2353c', m: '#ee5d63', l: '#ff9fa4' },
  yellowtail:{ d: '#e0c489', m: '#f4e0aa', l: '#fff4d8' },
  shrimp: { d: '#f0937a', m: '#ffb6a0', l: '#ffe2d6', stripe: '#ff6f57' },
  eel:    { d: '#6a4220', m: '#8f5e2e', l: '#b9854a', glaze: '#3a2410' },
  scallop:{ d: '#ecdcb6', m: '#fff6e2', l: '#ffffff' },
  octopus:{ d: '#a24f6a', m: '#c87e95', l: '#f3e4ea', skin: '#9c3f5a' },
  egg:    { d: '#eab53c', m: '#ffd65e', l: '#ffe89a' },
  avocado:{ d: '#6a9a3c', m: '#9ac457', l: '#c8e488' },
  cucumber:{ d: '#3f9a5c', m: '#6ec885', l: '#aee6b6', core: '#e9f6dd' },
  crab:   { d: '#e07a42', m: '#ff9d5e', l: '#ffc89a' },
  cream:  { d: '#ecd9b0', m: '#fff3d8', l: '#ffffff' },   // cream cheese
  fried:  { d: '#cf953e', m: '#edb85e', l: '#ffd98a', deep: '#a86e28' },
  // broths
  miso:   { d: '#c98a3e', m: '#e6a851', l: '#f3c47a' },
  clear:  { d: '#d9c282', m: '#ecd9a0', l: '#f6ecc4' },
  spicy:  { d: '#bf3f2c', m: '#e3644a', l: '#f59070' },
  eggdrop:{ d: '#e8b53c', m: '#f6cc5e', l: '#ffe089' },
  brown:  { d: '#9c6a3a', m: '#bb8a52', l: '#d6ad77' },   // hot & sour
  // greens
  greens: { d: '#3f8f3f', m: '#5fae45', l: '#88c862' },
  seaweed:{ d: '#1f5836', m: '#2f7344', l: '#469058' },
  mango:  { d: '#e8932e', m: '#ffb24a', l: '#ffd07a' },
  // noodle
  noodle: { d: '#e2c46a', m: '#f3dd92', l: '#fff0bf' },
  sobaN:  { d: '#8a6f4a', m: '#a98c60', l: '#c4ab82' },
  // meats
  chicken:{ d: '#bd8540', m: '#dca461', l: '#f3ca8f' },
  beef:   { d: '#7e3f33', m: '#a85b48', l: '#c98069' },
  tofu:   { d: '#ead9aa', m: '#fff1cc', l: '#fffae6' },
  pork:   { d: '#d98a6a', m: '#f0a986', l: '#ffccb0' },
  glaze:  '#5a2f18',
  scallion: '#6ab84e',
  tomato: '#e2503f',
  // desserts
  vanilla:{ d: '#ecd9a8', m: '#fff2cf', l: '#fffae8' },
  matcha: { d: '#8fae54', m: '#b2cd74', l: '#d8e8a6' },
  choco:  { d: '#4a2c1a', m: '#6b4126', l: '#8a5a38' },
  mochiP: { d: '#f3a8bf', m: '#ffc8d8', l: '#ffe6ee' },
  mochiG: { d: '#a8cf94', m: '#cae8b6', l: '#e6f5d8' },
  mochiW: { d: '#ecd9cc', m: '#fff4ec', l: '#ffffff' },
  caramel:{ d: '#d99a44', m: '#f3bd63', l: '#ffd98a' },
  banana: { d: '#e2bd4a', m: '#f7d96e', l: '#fff0a8' },
  cheese: { d: '#eccf82', m: '#fbe6a8', l: '#fff6d4' },
  berry:  '#d8456a',
  tira:   { d: '#b58a5a', m: '#d6b184', l: '#ecd4b0' },
  cocoa:  '#6b4a2e',
  cherry: '#e23b54',
};

/* shared cute face. cx,cy = eye line; g = half-gap between eyes. */
function drawFace(p, cx, cy, g = 4, opt = {}) {
  cx = Math.round(cx); cy = Math.round(cy);
  const eye = opt.eye || PAL.eye, blush = opt.blush || PAL.blush;
  for (const ex of [cx - g, cx + g - 1]) { p.set(ex, cy, eye); p.set(ex, cy + 1, eye); }
  // smile
  p.set(cx - 2, cy + 3, eye); p.set(cx - 1, cy + 4, eye); p.set(cx, cy + 4, eye); p.set(cx + 1, cy + 3, eye);
  // blush
  if (opt.blush !== false) {
    p.set(cx - g - 2, cy + 2, blush); p.set(cx - g - 1, cy + 2, blush);
    p.set(cx + g, cy + 2, blush); p.set(cx + g + 1, cy + 2, blush);
  }
}
/* tiny face for small centers (maki, cubes) */
function drawFaceMini(p, cx, cy, opt = {}) {
  cx = Math.round(cx); cy = Math.round(cy);
  const eye = opt.eye || PAL.eye;
  p.set(cx - 2, cy, eye); p.set(cx + 1, cy, eye);
  p.set(cx - 1, cy + 2, eye); p.set(cx, cy + 2, eye);
  if (opt.blush !== false) { p.set(cx - 3, cy + 1, PAL.blush); p.set(cx + 2, cy + 1, PAL.blush); }
}

function finish(p) { return outlined(p, PAL.ink, 1); }
