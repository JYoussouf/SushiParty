/* ============================================================
   Sushi Party — Kawaii pixel forms (Wave 1: sushi-proper)
   Each form returns a finished 24×24 Pix (outlined).
   Depends on px-core.js (Pix, PAL, drawFace, finish, ...).
   ============================================================ */

/* ---- NIGIRI : rice mound + draped topping ---------------- */
function nigiri(o) {
  const p = new Pix(), R = PAL.rice, F = o.fish;
  // rice mound
  p.ellipse(12, 16.9, 9.5, 4.9, R.d);
  p.ellipse(12, 16.2, 9.5, 4.65, R.m);
  p.ellipse(10.3, 14.9, 5.7, 2.5, R.l);

  if (o.block) {
    // tamago: tall squared block topping
    p.roundRect(2.5, 5.5, 21.5, 13, 2, F.d);
    p.roundRect(2.5, 5, 21.5, 12, 2, F.m);
    p.roundRect(4, 6, 19, 8, 1, F.l);
  } else {
    // draped slab
    const lift = o.plump ? 0.6 : 0;
    p.ellipse(12, 10.9 - lift, 10.7, (o.plump ? 4.6 : 3.95), F.d);
    p.ellipse(12, 10.1 - lift, 10.7, (o.plump ? 4.3 : 3.6), F.m);
    p.ellipse(18.8, 12.4, 3.2, 2.7, F.d);   // right drape
    p.ellipse(18.4, 11.8, 3.0, 2.4, F.m);
    p.ellipse(9.6, 9.1 - lift, 5.7, 1.5, F.l); // sheen
  }
  // marbling stripes
  if (o.stripe) { p.line(7, 10, 11, 12, o.stripe); p.line(12, 9, 16, 11, o.stripe); }
  // octopus skin edge + suckers
  if (o.skin) {
    p.line(2, 9.4, 8, 8, o.skin); p.line(8, 8, 15, 8.2, o.skin); p.line(15, 8.2, 22, 9.6, o.skin);
    p.set(8, 11, o.fish.m); p.set(13, 11, o.fish.m); p.set(17, 12, o.fish.m);
  }
  // eel glaze sheen
  if (o.glaze) { p.line(5, 12, 19, 12.8, o.fish.glaze); p.line(6, 9.4, 15, 9, o.fish.l); }
  // shrimp stripes + tail
  if (o.tail) {
    p.line(7, 11, 9, 9, F.stripe); p.line(11, 11.6, 13, 9.4, F.stripe); p.line(15, 12, 17, 9.8, F.stripe);
    p.poly([[18, 9], [23, 4], [22, 8], [20, 10]], PAL.shrimp.stripe);
  }
  // nori strap (tamago / unagi)
  if (o.band) {
    const N = PAL.nori;
    p.rect(10, (o.block ? 4.5 : 7.5), 13, 19, N.d);
    p.rect(10, (o.block ? 4.5 : 7.5), 11, 19, N.m);
  }
  if (o.face !== false) drawFace(p, 12, 16, 3);
  return finish(p);
}

/* ---- SASHIMI : slices on a plate, no rice ---------------- */
function sashimi(o) {
  const p = new Pix(), F = o.fish;
  // plate
  p.ellipse(12, 18.4, 9.6, 3.2, PAL.plate.d);
  p.ellipse(12, 17.9, 9.6, 3.0, PAL.plate.m);
  p.ellipse(9.5, 17.2, 4.8, 1.2, PAL.plate.l);
  // shiso leaf accent behind
  p.ellipse(6.5, 12.5, 3.4, 2.3, PAL.greens.d);
  p.ellipse(6, 12, 3.0, 1.9, PAL.greens.m);

  if (o.shape === 'disc') {
    // scallop: pale cylinders
    for (let i = 0; i < 3; i++) {
      const x = 8.5 + i * 3.4, y = 14.5 - i * 2.2;
      p.ellipse(x, y, 3.4, 3.0, F.d);
      p.ellipse(x, y - 0.4, 3.2, 2.7, F.m);
      p.ellipse(x - 0.8, y - 1, 1.7, 1.0, F.l);
    }
  } else {
    // 3 fanned slices
    for (let i = 0; i < 3; i++) {
      const x = 9 + i * 3.0, y = 14.6 - i * 2.3;
      p.roundRect(x - 3.6, y - 2.5, x + 3.6, y + 2.5, 2, F.d);
      p.roundRect(x - 3.6, y - 2.9, x + 3.6, y + 1.9, 2, F.m);
      p.line(x - 2.4, y - 1.3, x + 1.6, y + 0.4, F.l);
      if (o.skin) p.line(x - 3.4, y - 2.6, x + 3.4, y - 2.6, o.skin); // octopus edge
    }
  }
  drawFaceMini(p, 15.5, 9.5);
  return finish(p);
}

/* ---- MAKI : top-down ring -------------------------------- */
function maki(o) {
  const p = new Pix(), R = PAL.rice, N = PAL.nori, F = o.fill;
  const cx = 12, cy = 12, max = o.thin ? 9.2 : 11;
  if (o.insideOut) {
    // uramaki: rice on the outside
    p.band(cx, cy, 0, max, R.m);
    p.band(cx, cy, max - 1.5, max, R.d);
    p.band(cx, cy, 0, 6.6, N.d);
    const fr = 5.4;
    fillCenter(p, cx, cy, fr, F, o);
    if (o.sesame !== false) sesameRing(p, cx, cy, 7.8, 10.3);
  } else {
    const nIn = max - 2.4;
    p.band(cx, cy, nIn, max, N.d);
    p.band(cx, cy, nIn, nIn + 0.9, N.m);     // inner sheen
    const rOut = nIn, rIn = o.thin ? 3.4 : 4.4;
    p.band(cx, cy, rIn, rOut, R.m);
    p.band(cx, cy, rOut - 1.3, rOut, R.d);   // rice shadow under nori
    p.band(cx, cy, rIn, rIn + 1, R.l);       // rice highlight near center
    fillCenter(p, cx, cy, rIn, F, o);
    if (o.sesame) sesameRing(p, cx, cy, rIn + 0.6, rOut - 0.6);
  }
  if (o.face !== false) drawFaceMini(p, cx + 0.5, cy - 0.5);
  return finish(p);
}
function fillCenter(p, cx, cy, r, F, o) {
  p.band(cx, cy, 0, r, F.m);
  if (o.fill2) { // two-tone (e.g. salmon + avocado): right half
    for (let y = 0; y < p.h; y++) for (let x = Math.round(cx); x < p.w; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r) p.set(x, y, o.fill2.m);
    }
  }
  // highlight + shadow
  p.ellipse(cx - 1.3, cy - 1.3, r * 0.42, r * 0.42, F.l);
  if (o.fill2) p.ellipse(cx + 1.6, cy - 1.0, r * 0.3, r * 0.3, o.fill2.l);
  p.ellipse(cx + 1.4, cy + 1.5, r * 0.34, r * 0.28, F.d);
  if (o.spicy) { p.set(cx - 2, cy + 2, PAL.spicy.d); p.set(cx + 2, cy - 2, PAL.spicy.d); p.set(cx, cy + 3, PAL.spicy.d); }
}
function sesameRing(p, cx, cy, r0, r1) {
  const pts = [[0, -1], [1, 0.7], [-1, 0.6], [0.7, -0.8], [-0.8, -0.7], [0.5, 1]];
  const rr = (r0 + r1) / 2;
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2 + 0.4;
    p.set(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, '#fff7ea');
  }
}

/* ---- HAND ROLL : nori cone ------------------------------- */
function handroll(o) {
  const p = new Pix(), N = PAL.nori, R = PAL.rice;
  // cone
  p.poly([[4.5, 6], [19.5, 6], [12, 21.5]], N.d);
  p.poly([[6, 7], [9, 7], [11, 19]], N.m);   // sheen stripe
  // rice + fillings poking out the top
  p.ellipse(12, 6.6, 7.2, 2.4, R.m);
  p.ellipse(10, 6, 3.6, 1.2, R.l);
  // fillings sticking up
  const F = o.fill;
  p.rect(6.5, 2.5, 8, 6, F.m); p.rect(9.5, 2, 11, 6, (o.bits || PAL.cucumber).m);
  p.rect(13, 2.8, 14.5, 6, F.d); p.rect(15.5, 3, 17, 6, (o.bits2 || PAL.avocado).m);
  p.rect(11.5, 1.5, 12.8, 6, F.l);
  if (o.face !== false) drawFace(p, 12, 12.5, 3);
  return finish(p);
}

/* ---- ONIGIRI : rice triangle + nori band ----------------- */
function onigiri(o) {
  const p = new Pix(), R = PAL.rice, N = PAL.nori;
  const tri = [[12, 3.5], [3.5, 19], [20.5, 19]];
  // soften via slightly inset shadow triangle + body
  p.poly([[12, 4.4], [4.4, 19.4], [19.6, 19.4]], R.d);
  p.poly(tri, R.m);
  p.poly([[12, 6], [8, 13], [16, 13]], R.l); // top sheen
  // nori band at the bottom
  p.rect(4.5, 14.5, 19.5, 19, N.d);
  p.rect(4.5, 14.5, 19.5, 15.6, N.m);
  // clip the band to the triangle silhouette: redraw triangle edges as transparent outside
  for (let y = 14; y <= 20; y++) for (let x = 0; x < p.w; x++) {
    if (p.d[y][x] === N.d || p.d[y][x] === N.m) {
      if (!inPoly(x + 0.5, y + 0.5, [[12, 3.5], [3.0, 20], [21, 20]])) p.d[y][x] = null;
    }
  }
  if (o.face !== false) drawFace(p, 12, 11, 3);
  return finish(p);
}

/* ---- SPECIAL ROLL : uramaki + fancy toppings ------------- */
function specialRoll(o) {
  const p = new Pix(), R = PAL.rice, N = PAL.nori;
  const cx = 12, cy = 12.5, max = 10.6;
  // base uramaki ring
  p.band(cx, cy, 0, max, R.m);
  p.band(cx, cy, max - 1.4, max, R.d);
  p.band(cx, cy, 0, 6.2, N.d);
  p.band(cx, cy, 0, 4.4, (o.core || PAL.avocado).m);
  sesameRing(p, cx, cy, 7.4, 9.8);

  const drape = (x, col) => { p.ellipse(x, 7.2, 2.5, 1.9, col.d); p.ellipse(x, 6.6, 2.4, 1.7, col.m); p.ellipse(x - 0.6, 6.1, 1.1, 0.7, col.l); };

  if (o.kind === 'rainbow') {
    drape(5.5, PAL.tuna); drape(9.5, PAL.salmon); drape(13.5, PAL.yellowtail); drape(17.5, PAL.avocado);
  } else if (o.kind === 'dragon' || o.kind === 'caterpillar') {
    // overlapping avocado scales across top
    for (let i = 0; i < 5; i++) {
      const x = 4.5 + i * 3.6;
      p.ellipse(x, 7, 2.4, 2.0, PAL.avocado.d);
      p.ellipse(x, 6.5, 2.2, 1.7, PAL.avocado.m);
      p.line(x - 1.4, 6.2, x + 1.4, 6.2, PAL.avocado.l);
    }
    if (o.kind === 'caterpillar') { // antennae + face = cute bug
      p.line(20, 6, 22, 3, PAL.avocado.d); p.set(22, 2.5, PAL.tomato);
      p.line(18, 6.5, 20, 3.6, PAL.avocado.d); p.set(20, 3, PAL.tomato);
      drawFaceMini(p, 6, 6.6);
    } else { // dragon: eel tail tip + eye
      p.poly([[2.5, 8], [5, 6], [5, 9]], PAL.eel.m); p.set(20, 6, PAL.ink);
    }
  } else if (o.kind === 'spider') {
    // fried soft-shell crab legs poking out the sides
    for (const sgn of [-1, 1]) for (let k = 0; k < 3; k++) {
      const bx = cx + sgn * 7, by = 6 + k * 2.2;
      p.line(bx, by, bx + sgn * 5, by - 2 + k, PAL.fried.m);
    }
    p.ellipse(cx, 6.6, 4.5, 2.2, PAL.fried.d); p.ellipse(cx, 6.1, 4.2, 1.9, PAL.fried.m);
    p.ellipse(cx - 1.5, 5.6, 1.8, 0.8, PAL.fried.l);
  } else if (o.kind === 'volcano') {
    // baked spicy mound on top
    p.ellipse(cx, 6.6, 5.2, 3.0, PAL.spicy.d);
    p.ellipse(cx, 6.0, 4.8, 2.6, PAL.spicy.m);
    p.ellipse(cx - 1.6, 5.2, 2.0, 1.0, PAL.spicy.l);
    p.line(7, 8.5, 17, 8.5, '#fff3e0'); p.line(8, 9.4, 16, 9.4, '#fff3e0'); // mayo drizzle
  } else { // dynamite / shrimp_tempura : crunchy bits + drizzle
    const bits = o.kind === 'shrimp_tempura' ? PAL.fried : PAL.crab;
    for (let i = 0; i < 9; i++) {
      const ang = i / 9 * Math.PI * 2, r = 2 + (i % 3);
      p.set(cx + Math.cos(ang) * r, 6.5 + Math.sin(ang) * r * 0.6, bits.m);
    }
    p.ellipse(cx, 6.4, 4.6, 2.4, bits.d); p.ellipse(cx, 5.9, 4.3, 2.1, bits.m);
    p.line(7, 8.6, 17, 8.6, '#fff3e0');
  }
  if (o.face !== false && o.kind !== 'caterpillar') drawFaceMini(p, cx + 0.5, cy + 2.5);
  return finish(p);
}
