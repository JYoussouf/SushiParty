/* ============================================================
   Sushi Party — Kawaii pixel forms (Wave 2: kitchen & desserts)
   Depends on px-core.js + (shares helpers) px-forms.js.
   ============================================================ */

/* ---- BOWL : soup / salad / noodles / rice / donburi ------ */
function bowl(o) {
  const p = new Pix(), B = o.bowl || PAL.plate;
  // body
  p.ellipse(12, 14, 9.7, 7.6, B.d);
  p.ellipse(12, 13.6, 9.4, 7.3, B.m);
  p.ellipse(7.4, 17.6, 3.8, 2.2, B.l);
  if (o.bandColor) { // decorative rim stripe
    p.ellipse(12, 11.4, 9.5, 2.9, o.bandColor);
    p.ellipse(12, 12.0, 9.4, 2.6, B.m);
  }
  // opening
  p.ellipse(12, 8.5, 8.9, 3.0, B.d);
  const surf = o.liquid || o.inside || B.l;
  p.ellipse(12, 8.7, 8.4, 2.6, surf);
  // mounded contents (salad / rice)
  if (o.mound) {
    p.ellipse(12, 7.6, 8.0, 3.7, o.mound.d);
    p.ellipse(12, 7.0, 7.7, 3.3, o.mound.m);
    p.ellipse(9, 5.9, 3.3, 1.6, o.mound.l);
  }
  // noodles
  if (o.noodle) {
    const N = o.noodle;
    for (let i = 0; i < 4; i++) { const yy = 6.8 + i * 1.05; p.line(4.8, yy, 19.2, yy + (i % 2 ? -0.6 : 0.4), N.m); }
    p.ellipse(8, 6.8, 2.4, 1.3, N.l);
    p.ellipse(15, 8.4, 2.0, 1.0, N.d);
  }
  // garnish blobs on top
  (o.garnish || []).forEach(g => {
    if (g.r) { p.ellipse(g.x, g.y, g.r, g.r * 0.82, g.c2 || g.c); p.ellipse(g.x, g.y - 0.3, g.r * 0.85, g.r * 0.6, g.c); }
    else p.set(g.x, g.y, g.c);
  });
  // rim lip highlights
  p.line(3.6, 9.2, 7.5, 11.2, B.l); p.line(20.4, 9.2, 16.5, 11.2, B.l);
  if (o.face !== false) drawFace(p, 12, 15.2, 3, { eye: o.eye });
  return finish(p);
}

/* ---- TEMPURA : fried pieces ------------------------------ */
function tempura(o) {
  const p = new Pix(), Fr = PAL.fried;
  p.ellipse(12, 18.6, 8.8, 2.7, PAL.plate.d);
  p.ellipse(12, 18.2, 8.8, 2.5, PAL.plate.m);
  if (o.kind === 'shrimp') {
    p.ellipse(11, 11.4, 6.6, 4.6, Fr.d);
    p.ellipse(11, 10.8, 6.2, 4.2, Fr.m);
    p.ellipse(8, 8.8, 2.3, 1.3, Fr.l);
    p.line(6.5, 13.2, 14.5, 8.2, Fr.deep);
    p.line(7.5, 14.4, 15.5, 9.4, Fr.deep);
    p.poly([[16.5, 9], [22, 4.5], [21.5, 8.5], [18.5, 10.5]], PAL.shrimp.stripe); // tail
  } else if (o.kind === 'veg') {
    p.ellipse(12, 12, 5.7, 5.6, Fr.d);
    p.ellipse(12, 11.4, 5.3, 5.2, Fr.m);
    p.ellipse(9.6, 9, 2.0, 1.4, Fr.l);
    p.ellipse(12, 16.2, 2.6, 1.2, PAL.greens.m); // green peeking
    p.line(8, 13, 16, 11, Fr.deep);
  } else { // chicken nuggets
    p.ellipse(9, 12, 4.6, 4.1, Fr.d); p.ellipse(9, 11.5, 4.2, 3.7, Fr.m);
    p.ellipse(15.5, 13, 4.2, 3.7, Fr.d); p.ellipse(15.5, 12.6, 3.8, 3.3, Fr.m);
    p.ellipse(7.4, 9.6, 1.8, 1.1, Fr.l);
    p.line(6, 13, 12, 11, Fr.deep);
  }
  if (o.face !== false) drawFace(p, 11, 12.2, 3);
  return finish(p);
}

/* ---- SKEWER : stick + 3 pieces --------------------------- */
function skewer(o) {
  const p = new Pix(), M = o.meat;
  p.rect(11, 1.5, 12.6, 22.5, PAL.eel.d);
  p.rect(11, 1.5, 11.6, 22.5, PAL.eel.m);
  const ys = [7, 12, 17];
  ys.forEach((cy, i) => {
    const col = Array.isArray(M) ? M[i % M.length] : M;
    p.roundRect(5.4, cy - 3.1, 18.6, cy + 2.9, 2, col.d);
    p.roundRect(5.4, cy - 3.5, 18.6, cy + 2.5, 2, col.m);
    p.ellipse(8.6, cy - 1.8, 2.2, 1.2, col.l);
    if (o.glaze) { p.line(6.4, cy + 2.2, 17.6, cy + 2.2, PAL.glaze); p.set(10, cy - 2, '#fff7ea'); }
  });
  if (o.face !== false) drawFaceMini(p, 12, 6.4);
  return finish(p);
}

/* ---- TERIYAKI : glazed slices on a plate ----------------- */
function teriyaki(o) {
  const p = new Pix(), M = o.meat;
  p.ellipse(12, 17.2, 9.6, 3.4, PAL.plate.d);
  p.ellipse(12, 16.8, 9.6, 3.2, PAL.plate.m);
  p.ellipse(7.8, 16, 4, 1.3, PAL.plate.l);
  if (o.cubes) {
    const pos = [[8, 12], [15, 11.5], [11.5, 14]];
    pos.forEach(([x, y]) => {
      p.roundRect(x - 3, y - 2.6, x + 3, y + 2.6, 1, M.d);
      p.roundRect(x - 3, y - 3, x + 3, y + 2.2, 1, M.m);
      p.line(x - 2.4, y - 2.6, x + 2.4, y - 2.6, PAL.glaze);
      p.ellipse(x - 1.2, y - 1.4, 1.3, 0.7, M.l);
    });
  } else {
    for (let i = 0; i < 3; i++) {
      const x = 8.6 + i * 3.0, y = 13.4 - i * 1.7;
      p.roundRect(x - 4.2, y - 2.4, x + 4.2, y + 2.4, 2, M.d);
      p.roundRect(x - 4.2, y - 2.8, x + 4.2, y + 1.8, 2, M.m);
      p.line(x - 3.2, y - 2.4, x + 3.4, y - 2.5, PAL.glaze);
      p.ellipse(x - 1.8, y - 1.2, 1.7, 0.7, M.l);
    }
  }
  p.set(9, 11.5, '#fff7ea'); p.set(14.5, 10.5, '#fff7ea'); // sesame
  if (o.face !== false) drawFace(p, 12, 16.6, 3);
  return finish(p);
}

/* ---- SPRING ROLL ----------------------------------------- */
function springRoll(o) {
  const p = new Pix();
  if (o.fresh) {
    p.roundRect(3.5, 6.5, 20.5, 17.5, 6, PAL.greens.d);
    p.roundRect(4, 6.1, 20, 16.6, 6, '#eef4e2');       // translucent wrap
    p.roundRect(4.6, 6.7, 19.4, 16, 5, '#f6f9ee');
    p.line(6.5, 9.5, 17.5, 9.5, PAL.shrimp.m, 2);       // fillings show through
    p.line(6.5, 12.2, 17.5, 12.2, PAL.greens.m, 1);
    p.line(6.5, 13.6, 17.5, 13.6, PAL.noodle.m, 1);
    if (o.face !== false) drawFace(p, 12, 12.6, 3);
  } else {
    p.roundRect(3.5, 7.5, 20.5, 16.5, 4, PAL.fried.d);
    p.roundRect(3.5, 7, 20.5, 15.8, 4, PAL.fried.m);
    p.ellipse(7, 9.8, 2.6, 1.2, PAL.fried.l);
    p.line(5, 13.5, 19, 12.5, PAL.fried.deep);
    // cut end with filling
    p.ellipse(19.4, 11.4, 2.4, 4.2, PAL.fried.deep);
    p.ellipse(19.2, 11.4, 1.5, 3.1, (o.fill || PAL.greens).m);
    p.ellipse(12, 19.4, 3.2, 1.4, (o.sauce || PAL.spicy).m); // dipping sauce
    if (o.face !== false) drawFace(p, 10.5, 11.4, 3);
  }
  return finish(p);
}

/* ---- EDAMAME : pod + beans ------------------------------- */
function edamame() {
  const p = new Pix(), G = PAL.greens;
  p.ellipse(12, 12.2, 9.2, 4.3, G.d);
  p.ellipse(12, 11.6, 8.8, 3.9, G.m);
  p.ellipse(8.4, 9.8, 3.2, 1.2, G.l);
  // bean bulges
  for (let i = 0; i < 3; i++) {
    const x = 6.6 + i * 4;
    p.ellipse(x, 11.8, 2.1, 2.4, G.d);
    p.ellipse(x, 11.6, 1.7, 2.0, G.m);
    p.ellipse(x - 0.5, 10.8, 0.9, 0.8, G.l);
  }
  // stem tips
  p.line(2.8, 11, 1.2, 9.8, G.d); p.line(21.2, 12.4, 22.8, 11.2, G.d);
  drawFace(p, 12, 12.6, 4);
  return finish(p);
}

/* ---- GYOZA : pleated dumpling ---------------------------- */
function gyoza() {
  const p = new Pix(), Fr = PAL.fried;
  p.ellipse(12, 13.6, 9.2, 6.2, Fr.d);
  for (let y = 16; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[y][x]) p.d[y][x] = null;
  p.ellipse(12, 13.6, 8.8, 5.8, Fr.m);
  for (let y = 16; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[y][x] === Fr.m) p.d[y][x] = null;
  p.rect(3.4, 15.2, 20.6, 16.5, Fr.deep);     // browned base
  p.ellipse(8, 11, 2.6, 1.3, Fr.l);
  for (let i = 0; i < 5; i++) { const x = 5 + i * 3.4; p.line(x, 8.6, x + 1.7, 11.4, Fr.deep); } // pleats
  drawFace(p, 12.5, 13.4, 3);
  return finish(p);
}

/* ---- ICE CREAM : scoop in a cup -------------------------- */
function iceCream(o) {
  const p = new Pix();
  p.poly([[6, 13], [18, 13], [16.2, 21], [7.8, 21]], PAL.plate.d);
  p.poly([[6.6, 13], [17.4, 13], [15.7, 20.6], [8.3, 20.6]], PAL.plate.m);
  p.ellipse(12, 10, 6.3, 5.4, o.scoop.d);
  p.ellipse(12, 9.4, 5.9, 4.9, o.scoop.m);
  p.ellipse(9.4, 7.4, 2.6, 1.6, o.scoop.l);
  if (o.cherry !== false) { p.ellipse(12, 4.4, 1.7, 1.7, PAL.cherry); p.line(12, 3, 13.4, 1.4, PAL.greens.d); }
  drawFace(p, 12, 10, 3);
  return finish(p);
}

/* ---- FRIED ICE CREAM ------------------------------------- */
function friedIceCream(o) {
  const p = new Pix(), Fr = PAL.fried;
  p.ellipse(12, 14, 8.2, 7.1, Fr.d);
  p.ellipse(12, 13.4, 7.8, 6.6, Fr.m);
  p.ellipse(8, 10.6, 2.2, 1.4, Fr.l);
  p.ellipse(15.5, 16.5, 2.2, 1.4, Fr.deep);
  p.line(6, 14, 11, 12, Fr.deep);
  p.ellipse(12, 7, 4.2, 3.0, (o.scoop || PAL.vanilla).m);   // scoop peeking
  p.ellipse(10.4, 6, 1.6, 1.0, (o.scoop || PAL.vanilla).l);
  p.ellipse(12, 3.6, 1.5, 1.5, PAL.cherry);
  drawFace(p, 12, 14, 3);
  return finish(p);
}

/* ---- MOCHI : pastel dusted balls ------------------------- */
function mochi(o) {
  const p = new Pix();
  const cols = o.cols || [PAL.mochiP, PAL.mochiG, PAL.mochiW];
  [[8, 14.5], [16, 14.5], [12, 9]].forEach((q, i) => {
    const c = cols[i % cols.length];
    p.ellipse(q[0], q[1], 4.5, 4.1, c.d);
    p.ellipse(q[0], q[1] - 0.4, 4.1, 3.7, c.m);
    p.ellipse(q[0] - 1.5, q[1] - 1.6, 1.6, 1.0, c.l);
  });
  drawFace(p, 12, 8.6, 3);   // face on the top ball
  return finish(p);
}

/* ---- CAKE SLICE : wedge with layers ---------------------- */
function cakeSlice(o) {
  const p = new Pix(), B = o.body;
  // wedge: tall right edge, point toward lower-left
  const tri = [[4.5, 18.5], [4.5, 9], [20, 7], [20, 18.5]];
  p.poly(tri, B.d);
  p.poly([[5.2, 18], [5.2, 9.6], [19.4, 7.7], [19.4, 18]], B.m);
  p.poly([[5.6, 10.4], [18.8, 8.4], [18.8, 9.8], [5.6, 12]], B.l); // top sheen
  if (o.crust) { p.rect(4.5, 16.4, 20, 18.5, o.crust.d); p.rect(4.5, 16.4, 20, 17.3, o.crust.m); }
  if (o.layers) { p.line(5, 12, 19.4, 10.2, PAL.cocoa); p.line(5, 15, 19.6, 13.4, PAL.cocoa); }
  if (o.molten) { p.ellipse(13, 13.4, 2.6, 2.4, o.molten.d); p.ellipse(13, 13.4, 1.9, 1.7, o.molten.m); }
  if (o.dust) for (let i = 0; i < 7; i++) p.set(6 + i * 2, 8.2 - i * 0.22, o.dust);
  if (o.berry) { p.ellipse(15.5, 6, 1.7, 1.7, PAL.berry); p.set(15.5, 4, PAL.greens.d); }
  drawFace(p, 12.5, 13.4, 3);
  return finish(p);
}

/* ---- PUDDING CUP ----------------------------------------- */
function puddingCup(o) {
  const p = new Pix(), B = o.body;
  p.ellipse(12, 11, 7.2, 6.1, B.d);
  p.ellipse(12, 10.4, 6.8, 5.6, B.m);
  p.ellipse(9.4, 8, 2.6, 1.6, B.l);
  if (o.sauce) { p.ellipse(12, 5.8, 4.2, 1.7, o.sauce); p.line(8.6, 6.6, 8.6, 9, o.sauce); p.line(15.4, 6.6, 15.4, 9, o.sauce); }
  p.poly([[6, 14], [18, 14], [16.4, 20.5], [7.6, 20.5]], PAL.plate.d);
  p.poly([[6.6, 14], [17.4, 14], [16, 20.1], [8, 20.1]], PAL.plate.m);
  drawFace(p, 12, 11.4, 3);
  return finish(p);
}

/* ---- BANANA TEMPURA -------------------------------------- */
function bananaTempura() {
  const p = new Pix(), Fr = PAL.fried;
  p.ellipse(12, 18, 9, 3, PAL.plate.d);
  p.ellipse(12, 17.6, 9, 2.8, PAL.plate.m);
  [[8, 12.5], [15.5, 11.5], [12, 15]].forEach(([x, y]) => {
    p.ellipse(x, y, 3.6, 2.7, Fr.d);
    p.ellipse(x, y - 0.4, 3.2, 2.3, Fr.m);
    p.ellipse(x - 1, y - 1, 1.3, 0.8, Fr.l);
  });
  p.line(5.5, 10, 18.5, 13.5, PAL.choco.d);
  p.line(6.5, 14, 17.5, 9.5, PAL.choco.d);
  drawFace(p, 11.5, 15, 3);
  return finish(p);
}
