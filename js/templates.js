// Keystone — species sprite templates (P3-ART): one hand-drawn, layered template per taxon group, drawn from a tweak
// set (js/spritetweaks.js). Side view facing right, in a unit frame: the creature is about 1 unit long, centred on
// (0, 0), with the ground at y = +0.3. This file holds the shared parts, the quadruped skeleton (canid, felid, cervid,
// bovid, ursid, mustelid, rodent, lagomorph), bats, marine mammals and the bird skeleton; js/templates-more.js adds
// reptiles, amphibians, fish, invertebrates and plants. See docs/art-style-guide.md.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const INK = '#1F2A24';
  const G = 0.3;           // ground line
  const LW = 0.022;        // outline weight, 2.2% of body length
  const SK = (T.SpriteTemplates = { skeletons: {}, INK, G, LW });
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;

  // ---------- colour ----------
  const css = (c, dl, ds) => 'hsl(' + Math.round(c[0]) + ',' + Math.round(clamp(c[1] + (ds || 0), 0, 100)) + '%,' + Math.round(clamp(c[2] + (dl || 0), 4, 97)) + '%)';
  SK.css = css;

  // A tiny deterministic generator per species, for spot and speckle placement.
  function rng(seed) {
    let s = 2166136261;
    for (const ch of String(seed)) s = Math.imul(s ^ ch.charCodeAt(0), 16777619);
    return () => { s = Math.imul(s ^ (s >>> 15), 2246822507); s = Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; };
  }

  // ---------- drawing context ----------
  // D wraps the canvas and the tweak set: D.c('body', dl) is a region colour, D.p('leg') a proportion, D.m('spots') a mark.
  function makeD(ctx, tw, opts) {
    return {
      ctx, tw, opts: opts || {}, lw: LW, t: (opts && opts.t) || 0,
      c: (k, dl, ds) => css(tw.col[k] || tw.col.body || [30, 20, 50], dl, ds),
      raw: k => tw.col[k] || tw.col.body || [30, 20, 50],
      p: k => (tw.p && tw.p[k] != null ? tw.p[k] : 1),
      m: k => (tw.marks && tw.marks[k]) || 0,
      part: k => tw.parts && tw.parts[k],
      rnd: rng(tw.key),
    };
  }
  SK.makeD = makeD;

  // ---------- path helpers ----------
  // Smooth closed (or open) curve through points, using midpoints as on-curve anchors.
  function smooth(ctx, pts, closed) {
    const n = pts.length;
    if (n < 3) { ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]); return; }
    if (closed) {
      const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
      ctx.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
      ctx.closePath();
    } else {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) { const a = pts[i], b = pts[i + 1]; const mx = i === n - 2 ? b[0] : (a[0] + b[0]) / 2, my = i === n - 2 ? b[1] : (a[1] + b[1]) / 2; ctx.quadraticCurveTo(a[0], a[1], mx, my); }
    }
  }
  SK.smooth = smooth;
  const blobPath = (ctx, pts) => { ctx.beginPath(); smooth(ctx, pts, true); };
  SK.blobPath = blobPath;
  const ellPath = (ctx, x, y, rx, ry, rot) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(1e-4, rx), Math.max(1e-4, ry), rot || 0, 0, TAU); };
  SK.ellPath = ellPath;

  function fillStroke(D, fill, lw) {
    const ctx = D.ctx;
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = lw || D.lw; ctx.stroke();
  }
  SK.fillStroke = fillStroke;

  // Several shapes outlined as one silhouette: an ink pass (strokes at double width), then the fills on top.
  function group(D, shapes) {
    const ctx = D.ctx;
    ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 2;
    for (const s of shapes) { s.path(); ctx.stroke(); }
    for (const s of shapes) { s.path(); ctx.fillStyle = s.fill; ctx.fill(); }
  }
  SK.group = group;

  // Draw fn clipped to a path (markings stay inside their region).
  function clipTo(D, pathFn, fn) { const ctx = D.ctx; ctx.save(); pathFn(); ctx.clip(); fn(); ctx.restore(); }
  SK.clipTo = clipTo;

  // A tapered stroke along a quadratic curve p0 → (ctrl) → p1 with widths w0 → wm → w1: tails, necks, limbs, stems.
  function taperPts(p0, c, p1, w0, wm, w1, n) {
    n = n || 10;
    const L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
      const dx = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]), dy = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
      const len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      const w = (t < 0.5 ? w0 + (wm - w0) * (t / 0.5) : wm + (w1 - wm) * ((t - 0.5) / 0.5)) / 2;
      L.push([x + nx * w, y + ny * w]); R.push([x - nx * w, y - ny * w]);
    }
    return L.concat(R.reverse());
  }
  SK.taperPts = taperPts;
  function taperPath(ctx, p0, c, p1, w0, wm, w1) {
    const pts = taperPts(p0, c, p1, w0, wm, w1);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
    ctx.closePath();
  }
  SK.taperPath = taperPath;

  // A limb or stalk: an ink stroke under a coloured stroke, round-capped.
  function limb(D, pts, w, fill) {
    const ctx = D.ctx;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); smooth(ctx, pts, false);
    ctx.strokeStyle = INK; ctx.lineWidth = w + D.lw * 2; ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
  }
  SK.limb = limb;
  function line(D, pts, w, color) {
    const ctx = D.ctx; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); smooth(ctx, pts, false); ctx.strokeStyle = color || INK; ctx.lineWidth = w; ctx.stroke();
  }
  SK.line = line;

  function eye(D, x, y, r, opts) {
    const ctx = D.ctx;
    opts = opts || {};
    if (opts.ring) { ctx.fillStyle = opts.ring; ellPath(ctx, x, y, r * 1.7, r * 1.7); ctx.fill(); }
    ctx.fillStyle = opts.iris || INK; ellPath(ctx, x, y, r, r); ctx.fill();
    if (opts.iris) { ctx.fillStyle = INK; ellPath(ctx, x + r * 0.15, y, r * 0.55, r * 0.55); ctx.fill(); }
    ctx.fillStyle = '#FBF8F1'; ellPath(ctx, x + r * 0.35, y - r * 0.35, r * 0.32, r * 0.32); ctx.fill();
  }
  SK.eye = eye;

  function shadow(D, x, w) {
    if (D.opts.noShadow) return;
    const ctx = D.ctx;
    ctx.fillStyle = 'rgba(31,42,36,0.13)';
    ellPath(ctx, x || 0, G + 0.012, w, 0.03); ctx.fill();
  }
  SK.shadow = shadow;

  // Spots scattered inside a box (drawn inside a clip).
  function spots(D, x0, y0, x1, y1, n, r, color) {
    const ctx = D.ctx; ctx.fillStyle = color;
    for (let k = 0; k < n; k++) { const x = x0 + D.rnd() * (x1 - x0), y = y0 + D.rnd() * (y1 - y0), rr = r * (0.7 + 0.6 * D.rnd()); ellPath(ctx, x, y, rr, rr * 0.85, D.rnd()); ctx.fill(); }
  }
  SK.spots = spots;

  // Scale around the ground point so tall sprites fit the frame (1.5 wide, 0.95 above the ground).
  function fit(D, w, h) {
    const k = Math.min(1, 1.45 / Math.max(0.01, w), 0.95 / Math.max(0.01, h));
    if (k < 1) { D.ctx.translate(0, G); D.ctx.scale(k, k); D.ctx.translate(0, -G); }
    return k;
  }
  SK.fit = fit;

  const rot = (o, a) => (x, y) => { const dx = x - o[0], dy = y - o[1], c = Math.cos(a), s = Math.sin(a); return [o[0] + dx * c - dy * s, o[1] + dx * s + dy * c]; };
  SK.rot = rot;

  // ---------- quadruped skeleton ----------
  // Anchors: shoulder and hip (legs), neck base (neck and head), tail base. Layers, back to front: shadow, far legs,
  // tail, ears, body + neck + head (one silhouette), body markings, near legs, face, horns or antlers.
  const HEADS = {
    //         skull, snout length, snout width, droop, neck angle (rad, negative = up), ear set
    dog: { s: 1, sn: 1.15, sw: 0.55, drop: 0.12, na: -0.75 },
    cat: { s: 1.05, sn: 0.45, sw: 0.6, drop: 0.05, na: -0.55 },
    deer: { s: 0.85, sn: 1.25, sw: 0.5, drop: 0.45, na: -1.15 },
    cow: { s: 1.05, sn: 1.05, sw: 0.8, drop: 0.55, na: -0.35 },
    horse: { s: 0.9, sn: 1.5, sw: 0.6, drop: 0.55, na: -1.1 },
    bear: { s: 1.1, sn: 0.8, sw: 0.6, drop: 0.15, na: -0.3 },
    weasel: { s: 0.85, sn: 0.6, sw: 0.5, drop: 0.05, na: -0.45 },
    raccoon: { s: 1.0, sn: 0.75, sw: 0.45, drop: 0.1, na: -0.45 },
    badger: { s: 0.95, sn: 0.8, sw: 0.5, drop: 0.2, na: -0.2 },
    mouse: { s: 1.1, sn: 0.55, sw: 0.5, drop: 0.1, na: -0.3 },
    rabbit: { s: 1.05, sn: 0.5, sw: 0.65, drop: 0.2, na: -0.6 },
    pig: { s: 1.0, sn: 1.0, sw: 0.7, drop: 0.25, na: -0.15 },
    shrew: { s: 0.9, sn: 1.2, sw: 0.35, drop: 0.1, na: -0.2 },
    mole: { s: 0.9, sn: 0.9, sw: 0.35, drop: 0.1, na: -0.05 },
    beaver: { s: 1.05, sn: 0.55, sw: 0.7, drop: 0.2, na: -0.25 },
  };
  const QUAD = {
    canid: { bl: 0.6, bh: 0.11, leg: 0.2, hs: 0.085, legW: 0.045 },
    felid: { bl: 0.6, bh: 0.11, leg: 0.18, hs: 0.085, legW: 0.05 },
    cervid: { bl: 0.6, bh: 0.12, leg: 0.2, hs: 0.075, legW: 0.035 },
    bovid: { bl: 0.62, bh: 0.15, leg: 0.19, hs: 0.09, legW: 0.055 },
    ursid: { bl: 0.62, bh: 0.15, leg: 0.2, hs: 0.1, legW: 0.075 },
    mustelid: { bl: 0.62, bh: 0.1, leg: 0.2, hs: 0.075, legW: 0.045 },
    rodent: { bl: 0.52, bh: 0.13, leg: 0.2, hs: 0.1, legW: 0.045 },
    lagomorph: { bl: 0.52, bh: 0.14, leg: 0.2, hs: 0.1, legW: 0.05 },
  };

  SK.skeletons.quad = function (D) {
    const ctx = D.ctx, tw = D.tw, Q = QUAD[tw.tpl] || QUAD.canid;
    const H = HEADS[D.part('head')] || HEADS.dog;
    const pose = tw.pose || 'stand';
    const bx = Q.bl / 2, bh = Q.bh * D.p('depth');
    const legLen = Q.leg * D.p('leg') * (tw.tpl === 'rodent' || tw.tpl === 'lagomorph' ? 0.9 : 1);
    const hump = tw.parts.extra === 'hump' ? 0.45 : D.m('hump') ? 0.25 : 0;
    const tilt = pose === 'sit' ? -0.75 : pose === 'hop' ? -0.35 : pose === 'crouch' ? -0.12 : 0;
    const float = pose === 'float';
    // Body centre: legs under it, the body sitting on them (or on the haunches when seated).
    const haunch = tilt !== 0;
    const cy = float ? 0.1 : haunch ? G - bh * 1.05 - legLen * 0.25 : G - legLen - bh * 0.55;
    const hip = [-bx * 0.62, cy + bh * 0.2];
    const T0 = rot(hip, tilt);
    const L = (x, y) => T0(x, y + cy);            // body-local (y relative to cy) → world
    // head anchor along the neck
    const neckLen = (0.09 + 0.06 * (Q.leg > 0.19 ? 1 : 0)) * D.p('neck') * (tw.tpl === 'cervid' ? 1.4 : tw.tpl === 'rodent' || tw.tpl === 'lagomorph' ? 0.35 : 1);
    const hs = Q.hs * D.p('head') * H.s;
    const nb = L(bx * 0.72, -bh * 0.35);
    const na = H.na + (tilt ? -tilt * 0.8 : 0) + (float ? 0.4 : 0);
    const hc = [nb[0] + Math.cos(na) * (neckLen + hs * 0.6), nb[1] + Math.sin(na) * (neckLen + hs * 0.6)];
    // overall extent for fitting
    const top = Math.min(hc[1] - hs * 2.2 - (tw.parts.horn && tw.parts.horn !== 'none' && tw.parts.horn !== 'tusk' ? 0.25 * D.p('horn') : 0), cy - bh * 1.5);
    fit(D, bx * 2 + 0.5, G - top);

    const body = D.c('body'), far = D.c('body', -12), dark = D.c('body', -18);
    if (float) {
      ctx.fillStyle = 'rgba(96,160,200,0.35)'; ellPath(ctx, 0, cy + bh * 0.6, bx * 1.5, 0.04); ctx.fill();
    } else shadow(D, 0, bx * 1.15);

    // --- legs ---
    const legW = Q.legW * 0.85 * (0.75 + 0.25 * D.p('depth'));
    const sockC = D.m('socks') ? D.c('leg') : null;
    const drawLeg = (front, farSide) => {
      const off = farSide ? 0.035 : 0;
      const col = farSide ? far : body;
      if (!front && haunch) {
        // Seated or hopping: a big haunch and a long hind foot on the ground.
        const hx = hip[0] + off, hy = hip[1];
        ctx.save(); ellPath(ctx, hx + 0.02, hy + bh * 0.2, bh * 0.95, bh * 0.85, -0.3); fillStroke(D, col); ctx.restore();
        limb(D, [[hx + 0.04, G - 0.02], [hx + 0.12 * (pose === 'hop' ? 1.4 : 1), G - 0.012]], legW * 0.7, sockC && !farSide ? sockC : col);
        return;
      }
      const a = front ? L(bx * 0.58, bh * 0.25) : L(-bx * 0.55, bh * 0.25);
      const x = a[0] + off;
      const gy = float ? a[1] + legLen * 0.5 : G;
      let pts;
      if (front) pts = haunch ? [[x, a[1]], [x + 0.03, a[1] + (G - a[1]) * 0.55], [x + 0.025, G]] : [[x, a[1]], [x + 0.005, a[1] + (gy - a[1]) * 0.55], [x, gy]];
      else pts = [[x, a[1]], [x + 0.03, a[1] + (gy - a[1]) * 0.35], [x - 0.025, a[1] + (gy - a[1]) * 0.7], [x - 0.005, gy]];
      if (float) pts = [[x, a[1]], [x + (front ? 0.06 : -0.06), a[1] + 0.03]];
      limb(D, pts, legW, col);
      if (sockC && !float) { const s = pts.length - 1; limb(D, [[pts[s][0] + (pts[s - 1][0] - pts[s][0]) * 0.45, pts[s][1] - (pts[s][1] - pts[s - 1][1]) * 0.45], pts[s]], legW * 0.98, farSide ? D.c('leg', -10) : D.c('leg')); }
      const f = pts[pts.length - 1];
      if (float) return;
      if (tw.parts.feet === 'hoof') { ctx.fillStyle = INK; ellPath(ctx, f[0] + 0.004, f[1] - legW * 0.25, legW * 0.55, legW * 0.35); ctx.fill(); }
      else if (tw.parts.extra === 'digger' && front) { ellPath(ctx, f[0] + legW * 0.6, f[1] - legW * 0.4, legW * 1.1, legW * 0.6, -0.3); fillStroke(D, D.c('body', 25, -20)); }
      else { ellPath(ctx, f[0] + legW * 0.35, f[1] - legW * 0.3, legW * 0.75, legW * 0.42); fillStroke(D, sockC && !farSide ? D.c('leg') : col); }
    };
    drawLeg(true, true); drawLeg(false, true);
    if (!haunch) { drawLeg(false, false); drawLeg(true, false); }

    // --- tail (behind the body) ---
    const tb = L(-bx * 0.95, -bh * 0.35);
    drawQuadTail(D, tb, bx, bh, tilt);

    // --- ears (behind the head) ---
    drawEars(D, hc, hs, H);

    // glide membrane (flying squirrels)
    if (tw.parts.extra === 'glide') { ctx.beginPath(); const a = L(bx * 0.55, bh * 0.2), b = L(-bx * 0.55, bh * 0.2); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(0, cy + bh * 1.6, b[0], b[1]); ctx.closePath(); fillStroke(D, D.c('body', 8)); }

    // --- body + neck + head as one silhouette ---
    const bodyPts = [
      [bx * 1.0, -bh * 0.15], [bx * 0.62, -bh * (1 + hump)], [bx * 0.1, -bh * (0.95 + hump * 0.4)], [-bx * 0.62, -bh * 0.98],
      [-bx * 1.02, -bh * 0.25], [-bx * 0.82, bh * 0.82], [0, bh * 1.02], [bx * 0.78, bh * 0.78],
    ].map(q => L(q[0], q[1]));
    const bodyPath = () => blobPath(ctx, bodyPts);
    const neckW = hs * 1.3 * (tw.tpl === 'cervid' || tw.tpl === 'bovid' ? 1.15 : 1) * (tw.tpl === 'mustelid' ? 1.1 : 1);
    const neckPath = () => taperPath(ctx, L(bx * 0.45, -bh * 0.2), [(nb[0] + hc[0]) / 2, (nb[1] + hc[1]) / 2], hc, bh * 1.7, neckW, neckW * 0.9);
    const head = headShape(D, hc, hs, H);
    group(D, [{ path: neckPath, fill: body }, { path: bodyPath, fill: body }, { path: head.skull, fill: D.c('head') }, { path: head.snout, fill: D.c('head') }]);

    // --- body markings ---
    clipTo(D, bodyPath, () => quadBodyMarks(D, L, bx, bh, cy));
    clipTo(D, neckPath, () => quadNeckMarks(D, nb, hc, hs));
    if (tw.parts.extra === 'quills') {
      ctx.strokeStyle = D.c('mark'); ctx.lineWidth = D.lw * 0.8;
      for (let k = 0; k < 16; k++) { const u = -0.9 + 1.7 * (k / 15); const a = L(bx * u, -bh * (0.9 - 0.2 * Math.abs(u))); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] - 0.05, a[1] - 0.06 - 0.02 * (k % 3)); ctx.stroke(); }
    }
    if (D.m('bristle')) { const a = L(bx * 0.6, -bh * 1.05), b = L(-bx * 0.4, -bh * 1.0); line(D, [a, [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 0.01], b], 0.018, dark); }

    // --- near legs (seated animals: over the body, as the haunch sits in front) ---
    if (haunch) { drawLeg(false, false); drawLeg(true, false); }

    // --- face and head parts ---
    headDetails(D, hc, hs, H, head);
    drawHorns(D, hc, hs);
  };

  function headShape(D, hc, hs, H) {
    const ctx = D.ctx;
    const sn = H.sn * D.p('snout'), drop = H.drop;
    const tipX = hc[0] + hs * (0.55 + sn), tipY = hc[1] + hs * (0.1 + drop * sn * 0.8);
    const sw = hs * H.sw;
    const skull = () => ellPath(ctx, hc[0], hc[1], hs, hs * 0.88, drop * 0.3);
    const snout = () => blobPath(ctx, [[hc[0] + hs * 0.2, hc[1] - hs * 0.6], [tipX - sw * 0.2, tipY - sw * 0.55], [tipX + sw * 0.15, tipY], [tipX - sw * 0.2, tipY + sw * 0.5], [hc[0] + hs * 0.2, hc[1] + hs * 0.75]]);
    return { skull, snout, tip: [tipX, tipY], sw };
  }

  function drawEars(D, hc, hs, H) {
    const ctx = D.ctx, tw = D.tw, ear = D.part('ear') || 'point';
    const e = D.p('ear');
    const col = D.c('head'), inner = D.c('belly', 8);
    const one = (dx, farSide) => {
      const bxp = hc[0] + hs * dx, byp = hc[1] - hs * 0.55;
      const fill = farSide ? D.c('head', -12) : col;
      ctx.save();
      if (ear === 'point' || ear === 'tuft') { blobPath(ctx, [[bxp - hs * 0.42, byp + hs * 0.2], [bxp - hs * 0.2 * e, byp - hs * 1.15 * e], [bxp + hs * 0.35, byp + hs * 0.15]]); fillStroke(D, fill); }
      else if (ear === 'round') { ellPath(ctx, bxp - hs * 0.05, byp - hs * 0.2 * e, hs * 0.36 * e, hs * 0.32 * e); fillStroke(D, fill); }
      else if (ear === 'long') {
        const len = tw.tpl === 'lagomorph' ? 1.9 : 0.95;
        const tilt = tw.tpl === 'lagomorph' ? -1.9 : tw.tpl === 'cervid' ? -2.6 : -0.6;
        ellPath(ctx, bxp - hs * 0.2 + Math.cos(tilt) * hs * len * e * 0.5, byp + Math.sin(tilt) * hs * len * e * 0.5, hs * len * 0.5 * e, hs * 0.26 * Math.sqrt(e), tilt);
        fillStroke(D, fill);
        if (!farSide) { ellPath(ctx, bxp - hs * 0.2 + Math.cos(tilt) * hs * len * e * 0.5, byp + Math.sin(tilt) * hs * len * e * 0.5, hs * len * 0.36 * e, hs * 0.12 * Math.sqrt(e), tilt); ctx.fillStyle = inner; ctx.fill(); }
        if (D.m('earTip')) { ellPath(ctx, bxp - hs * 0.2 + Math.cos(tilt) * hs * len * e * 0.95, byp + Math.sin(tilt) * hs * len * e * 0.95, hs * 0.16, hs * 0.18, tilt); ctx.fillStyle = D.c('mark'); ctx.fill(); }
      } else if (ear === 'side') { ellPath(ctx, bxp - hs * 0.45, byp + hs * 0.25, hs * 0.45 * e, hs * 0.18, -0.35); fillStroke(D, fill); }
      else if (ear === 'tiny') { ellPath(ctx, bxp - hs * 0.25, byp + hs * 0.05, hs * 0.18 * e, hs * 0.14 * e); fillStroke(D, fill); }
      if ((ear === 'point' || ear === 'tuft') && (D.m('earBack') || D.m('earTuft'))) {
        if (D.m('earBack')) { blobPath(ctx, [[bxp - hs * 0.3, byp - hs * 0.35 * e], [bxp - hs * 0.2 * e, byp - hs * 1.15 * e], [bxp + hs * 0.2, byp - hs * 0.4 * e]]); ctx.fillStyle = D.c('mark'); ctx.fill(); }
        if (D.m('earTuft')) line(D, [[bxp - hs * 0.2 * e, byp - hs * 1.1 * e], [bxp - hs * 0.25 * e, byp - hs * 1.55 * e]], D.lw * 1.4, INK);
      }
      if (ear === 'point' && !farSide) { blobPath(ctx, [[bxp - hs * 0.25, byp + hs * 0.05], [bxp - hs * 0.17 * e, byp - hs * 0.8 * e], [bxp + hs * 0.18, byp + hs * 0.02]]); ctx.fillStyle = inner; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.restore();
    };
    if (ear === 'none') return;
    one(-0.15, true); one(0.2, false);
  }

  function headDetails(D, hc, hs, H, head) {
    const ctx = D.ctx, tw = D.tw;
    const [tx, ty] = head.tip;
    // muzzle and face markings, clipped to the snout
    const snoutClip = fn => clipTo(D, head.snout, fn);
    if (D.m('snoutMark')) snoutClip(() => { ctx.fillStyle = tw.tpl === 'ursid' || tw.tpl === 'canid' ? D.c('belly', tw.tpl === 'ursid' ? -10 : 0) : D.c('mark'); ellPath(ctx, tx - hs * 0.2, ty, hs * 0.75, hs * 0.8); ctx.fill(); });
    if (D.m('mask')) {
      ctx.save(); ctx.globalAlpha = 0.95;
      clipTo(D, () => { ctx.beginPath(); ellPath(ctx, hc[0], hc[1], hs, hs * 0.88); }, () => { ctx.fillStyle = D.c('mark'); ellPath(ctx, hc[0] + hs * 0.45, hc[1] - hs * 0.1, hs * 0.75, hs * 0.32, 0.15); ctx.fill(); });
      snoutClip(() => { ctx.fillStyle = D.c('mark'); ellPath(ctx, hc[0] + hs * 0.65, hc[1] - hs * 0.05, hs * 0.5, hs * 0.28, 0.2); ctx.fill(); });
      ctx.restore();
    }
    if (D.m('blaze')) {
      const b = () => { ctx.fillStyle = D.c('mark'); ctx.beginPath(); ctx.moveTo(hc[0] - hs * 0.9, hc[1] - hs * 0.75); ctx.quadraticCurveTo(hc[0] + hs * 0.4, hc[1] - hs * 0.9, tx, ty - head.sw * 0.3); ctx.lineTo(tx, ty - head.sw * 0.05); ctx.quadraticCurveTo(hc[0] + hs * 0.4, hc[1] - hs * 0.55, hc[0] - hs * 0.9, hc[1] - hs * 0.4); ctx.closePath(); ctx.fill(); };
      clipTo(D, () => { ctx.beginPath(); ellPath(ctx, hc[0], hc[1], hs, hs * 0.88); }, b);
      snoutClip(b);
    }
    if (D.m('eyering')) { ctx.fillStyle = D.c('belly', 12); ellPath(ctx, hc[0] + hs * 0.4, hc[1] - hs * 0.2, hs * 0.26, hs * 0.26); ctx.fill(); }
    // eye, nose, mouth
    const er = Math.max(0.006, hs * (tw.tpl === 'rodent' || tw.tpl === 'lagomorph' ? 0.2 : 0.15));
    if (D.part('head') !== 'mole') eye(D, hc[0] + hs * 0.42, hc[1] - hs * 0.2, er);
    ctx.fillStyle = INK;
    if (D.part('head') === 'pig') { ellPath(ctx, tx + head.sw * 0.1, ty, head.sw * 0.18, head.sw * 0.42); fillStroke(D, D.c('head', 10, -10)); }
    else { ellPath(ctx, tx - hs * 0.02, ty - head.sw * 0.12, hs * 0.14, hs * 0.11); ctx.fill(); }
    line(D, [[tx - hs * 0.05, ty + head.sw * 0.2], [tx - hs * 0.35, ty + head.sw * 0.28]], D.lw * 0.7, INK);
    if (tw.parts.extra === 'star') { ctx.fillStyle = 'hsl(345,60%,66%)'; for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ellPath(ctx, tx + hs * 0.1 + Math.cos(a) * hs * 0.18, ty + Math.sin(a) * hs * 0.18, hs * 0.1, hs * 0.05, a); ctx.fill(); } }
    if (tw.parts.extra === 'cheek') { ellPath(ctx, hc[0] + hs * 0.1, hc[1] + hs * 0.55, hs * 0.45, hs * 0.38); fillStroke(D, D.c('head', 6)); }
    if (D.part('head') === 'beaver' || tw.tpl === 'rodent' && D.part('head') === 'mouse' && tw.p.depth > 1.2) { ctx.fillStyle = 'hsl(30,70%,60%)'; ctx.fillRect(tx - hs * 0.2, ty + head.sw * 0.3, hs * 0.14, hs * 0.22); }
    if (D.m('beard')) { blobPath(ctx, [[hc[0] + hs * 0.6, hc[1] + hs * 0.6], [hc[0] + hs * 0.8, hc[1] + hs * 1.7], [hc[0] + hs * 1.05, hc[1] + hs * 0.6]]); fillStroke(D, D.c('mark', 0)); }
    if (D.m('bell')) { ellPath(ctx, hc[0] + hs * 0.2, hc[1] + hs * 1.25, hs * 0.18, hs * 0.45); fillStroke(D, D.c('body', -8)); }
    if (tw.tpl === 'canid' || tw.tpl === 'felid') { ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 0.35; for (const dy of [-0.05, 0.08]) { ctx.beginPath(); ctx.moveTo(tx - hs * 0.2, ty + dy * hs); ctx.lineTo(tx + hs * 0.35, ty + dy * hs * 2 - hs * 0.05); ctx.stroke(); } }
  }

  function drawHorns(D, hc, hs) {
    const ctx = D.ctx, horn = D.part('horn');
    if (!horn || horn === 'none') return;
    const k = D.p('horn') || 1;
    const bx0 = hc[0] - hs * 0.1, by0 = hc[1] - hs * 0.75;
    const bone = 'hsl(38,35%,78%)', antlerC = 'hsl(30,30%,58%)';
    if (horn === 'antler') {
      const H = 0.3 * k;
      for (const [dx, far] of [[0.02, true], [0, false]]) {
        const c = far ? 'hsl(30,25%,48%)' : antlerC, x = bx0 + dx;
        limb(D, [[x, by0], [x - H * 0.45, by0 - H * 0.35], [x - H * 0.35, by0 - H * 0.8], [x + H * 0.2, by0 - H * 1.0]], D.lw * 1.6, c);
        for (const [f, dy] of [[0.25, 0.55], [0.5, 0.75], [0.75, 0.95]]) { const q = [x - H * 0.45 + H * 0.6 * f, by0 - H * dy]; limb(D, [q, [q[0] + H * 0.05, q[1] - H * 0.3]], D.lw * 1.2, c); }
      }
    } else if (horn === 'antlerPalm') {
      const H = 0.18 * k;
      limb(D, [[bx0, by0], [bx0 - H * 0.4, by0 - H * 0.3]], D.lw * 1.8, antlerC);
      blobPath(ctx, [[bx0 - H * 0.35, by0 - H * 0.25], [bx0 - H * 1.1, by0 - H * 0.6], [bx0 - H * 0.9, by0 - H * 1.1], [bx0 - H * 0.2, by0 - H * 0.95], [bx0 + H * 0.1, by0 - H * 0.5]]);
      fillStroke(D, antlerC);
      for (let t = 0; t < 4; t++) limb(D, [[bx0 - H * (1.0 - t * 0.25), by0 - H * (0.9 + (t % 2) * 0.1)], [bx0 - H * (1.05 - t * 0.25), by0 - H * (1.2 + (t % 2) * 0.1)]], D.lw, antlerC);
    } else if (horn === 'spike') {
      limb(D, [[bx0, by0], [bx0 - 0.02, by0 - 0.09 * k]], D.lw * 1.3, antlerC);
    } else if (horn === 'hook') {
      limb(D, [[bx0, by0], [bx0 + 0.005, by0 - 0.08 * k], [bx0 - 0.02, by0 - 0.1 * k]], D.lw * 1.6, INK);
      limb(D, [[bx0 + 0.004, by0 - 0.05 * k], [bx0 + 0.02, by0 - 0.06 * k]], D.lw * 1.1, INK);
    } else if (horn === 'hornCurl') {
      ctx.beginPath(); ctx.arc(bx0 - hs * 0.2, by0 + hs * 0.35, hs * 0.72 * k, -2.3, 1.3); ctx.strokeStyle = INK; ctx.lineWidth = hs * 0.42 + D.lw * 2; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = bone; ctx.lineWidth = hs * 0.42; ctx.stroke();
    } else if (horn === 'hornShort' || horn === 'hornLyre') {
      const s = horn === 'hornLyre' ? 1.5 : 1;
      limb(D, [[bx0 + hs * 0.1, by0 + hs * 0.2], [bx0 + hs * 0.45 * s, by0 - hs * 0.2], [bx0 + hs * 0.3 * s, by0 - hs * 0.7 * s]], hs * 0.22, bone);
    } else if (horn === 'hornSpike') {
      limb(D, [[bx0, by0 + hs * 0.1], [bx0 - hs * 0.4, by0 - hs * 0.8 * k]], hs * 0.2, INK);
    } else if (horn === 'hornSpiral') {
      const pts = []; for (let i = 0; i <= 6; i++) pts.push([bx0 - i * 0.022 + Math.sin(i * 1.6) * 0.012, by0 - i * 0.035 * k]);
      limb(D, pts, hs * 0.2, 'hsl(30,20%,30%)');
      for (let i = 1; i < 6; i++) line(D, [[pts[i][0] - 0.008, pts[i][1] + 0.004], [pts[i][0] + 0.008, pts[i][1] - 0.004]], D.lw * 0.6, INK);
    } else if (horn === 'tusk') {
      const tx = hc[0] + hs * 1.2, ty = hc[1] + hs * 0.55;
      blobPath(ctx, [[tx - hs * 0.2, ty], [tx + hs * 0.05, ty - hs * 0.45], [tx + hs * 0.12, ty + hs * 0.05]]); fillStroke(D, bone);
    }
  }

  function drawQuadTail(D, tb, bx, bh, tilt) {
    const ctx = D.ctx, tw = D.tw, kind = D.part('tail') || 'thin', k = D.p('tail');
    const body = D.c('tail'), mark = D.c('mark');
    const L = 0.28 * k;
    const tip = (p0, c, p1, w0, wm, w1, frac, color) => {
      // Tail tip in a second colour: the last `frac` of the tail.
      const pts = taperPts(p0, c, p1, w0, wm, w1, 20);
      clipTo(D, () => { ctx.beginPath(); smooth(ctx, pts, true); }, () => { ctx.fillStyle = color; ellPath(ctx, p1[0], p1[1], L * frac * 1.2, L * frac * 1.2); ctx.fill(); });
    };
    const x0 = tb[0], y0 = tb[1];
    if (kind === 'bushy' || kind === 'brush' || kind === 'ringed' || kind === 'plume') {
      const up = kind === 'plume';
      const w = (kind === 'brush' ? 0.085 : kind === 'plume' ? 0.1 : 0.07) * Math.sqrt(k);
      const p1 = up ? [x0 - 0.02, y0 - L * 1.3] : [x0 - L * 1.05, y0 + L * (kind === 'ringed' ? 0.25 : 0.55) - tilt * 0.2];
      const c = up ? [x0 - L * 0.9, y0 - L * 0.1] : [x0 - L * 0.55, y0 - L * 0.05];
      const path = () => blobPath(ctx, taperPts([x0 + 0.02, y0], c, p1, w * 0.45, w, w * 0.25, 12));
      path(); fillStroke(D, body);
      if (kind === 'ringed' || D.m('tailRings')) clipTo(D, path, () => { ctx.strokeStyle = mark; ctx.lineWidth = w * 0.4; for (let i = 1; i <= 5; i++) { const t = i / 5.5; const x = x0 + (p1[0] - x0) * t, y = y0 + (p1[1] - y0) * t; ctx.beginPath(); ctx.moveTo(x - w, y - w * 0.6); ctx.lineTo(x + w * 0.4, y + w); ctx.stroke(); } });
      if (D.m('tailTip')) { clipTo(D, path, () => { ctx.fillStyle = D.m('tailTip') >= 1 && tw.tpl === 'canid' && tw.col.mark[2] < 50 && /18,/.test(String(tw.col.body)) ? '#F4EFE3' : tw.tpl === 'canid' && tw.col.body[0] < 25 && tw.col.body[1] > 45 ? '#F4EFE3' : mark; ellPath(ctx, p1[0], p1[1], w * 1.2, w * 1.2); ctx.fill(); }); }
      if (D.m('stripe') && tw.tpl === 'canid') clipTo(D, path, () => { line(D, [[x0, y0 - w * 0.4], [c[0], c[1] - w * 0.4], p1], w * 0.25, mark); });
      path(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
    } else if (kind === 'long' || kind === 'thin' || kind === 'naked' || kind === 'tufted' || kind === 'furred') {
      const len = L * (kind === 'long' ? 1.35 : 1.25);
      const p1 = kind === 'long' ? [x0 - len * 0.8, y0 + len * 0.3] : [x0 - len, y0 + len * 0.25 - tilt * 0.1];
      const c = kind === 'long' ? [x0 - len * 0.4, y0 + len * 0.75] : [x0 - len * 0.5, y0 + len * 0.45];
      const w = (kind === 'long' ? 0.045 : kind === 'furred' ? 0.035 : 0.02);
      const col = kind === 'naked' ? 'hsl(350,25%,72%)' : body;
      blobPath(ctx, taperPts([x0 + 0.01, y0], c, p1, w, w * 0.8, w * 0.45, 10)); fillStroke(D, col);
      if (D.m('tailTip') || kind === 'tufted') { ellPath(ctx, p1[0], p1[1], w * 1.5, w * 1.1); fillStroke(D, D.m('tailTip') ? mark : body); }
    } else if (kind === 'tuft') {
      const p1 = [x0 - 0.02, y0 + L * 0.9];
      line(D, [[x0, y0], [x0 - 0.05, y0 + L * 0.4], p1], 0.03 + D.lw * 2, INK); line(D, [[x0, y0], [x0 - 0.05, y0 + L * 0.4], p1], 0.03, body);
      ellPath(ctx, p1[0], p1[1] + 0.02, 0.025, 0.045); fillStroke(D, D.c('body', -20));
    } else if (kind === 'bob' || kind === 'short') {
      ellPath(ctx, x0 - 0.02, y0 + 0.01, 0.045 * k + 0.01, 0.03); fillStroke(D, body);
    } else if (kind === 'puff' || kind === 'blacktop') {
      ellPath(ctx, x0 - 0.01, y0 + 0.01, 0.05, 0.045); fillStroke(D, '#F4EFE3');
      if (kind === 'blacktop') { clipTo(D, () => ellPath(ctx, x0 - 0.01, y0 + 0.01, 0.05, 0.045), () => { ctx.fillStyle = INK; ctx.fillRect(x0 - 0.07, y0 - 0.05, 0.12, 0.045); }); }
    } else if (kind === 'flag') {
      blobPath(ctx, [[x0 + 0.01, y0 + 0.02], [x0 - 0.06, y0 - 0.06], [x0 - 0.02, y0 - 0.1], [x0 + 0.03, y0 - 0.02]]); fillStroke(D, body);
      ellPath(ctx, x0 - 0.02, y0 - 0.04, 0.02, 0.04, -0.6); ctx.fillStyle = '#F4EFE3'; ctx.fill();
    } else if (kind === 'paddle') {
      ellPath(ctx, x0 - 0.1 * k, y0 + 0.06, 0.1 * k, 0.035, 0.25); fillStroke(D, 'hsl(25,20%,25%)');
      clipTo(D, () => ellPath(ctx, x0 - 0.1 * k, y0 + 0.06, 0.1 * k, 0.035, 0.25), () => { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = D.lw * 0.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x0 - 0.2 + i * 0.03, y0); ctx.lineTo(x0 - 0.18 + i * 0.03, y0 + 0.12); ctx.stroke(); } });
    } else if (kind === 'flat') {
      blobPath(ctx, taperPts([x0, y0], [x0 - L * 0.5, y0 + L * 0.35], [x0 - L, y0 + L * 0.3], 0.03, 0.035, 0.015)); fillStroke(D, D.c('body', -15));
    } else if (kind === 'thick') {
      blobPath(ctx, taperPts([x0 + 0.02, y0], [x0 - L * 0.5, y0 + L * 0.2], [x0 - L, y0 + L * 0.35], 0.07, 0.05, 0.015)); fillStroke(D, body);
    }
  }

  function quadBodyMarks(D, L, bx, bh, cy) {
    const ctx = D.ctx, tw = D.tw, mark = D.c('mark');
    const at = (x, y) => L(x, y);
    if (D.m('belly')) { ctx.fillStyle = D.c('belly'); ctx.globalAlpha = Math.min(1, 0.55 + 0.45 * D.m('belly')); const c = at(0, bh * 0.95); ellPath(ctx, c[0], c[1], bx * 0.95, bh * 0.55); ctx.fill(); ctx.globalAlpha = 1; }
    if (D.m('patches')) { ctx.fillStyle = mark; for (let i = 0; i < 4; i++) { const c = at(-bx * 0.7 + i * bx * 0.45 + D.rnd() * 0.04, -bh * 0.3 + D.rnd() * bh * 0.8); ellPath(ctx, c[0], c[1], bh * 0.45, bh * 0.35, D.rnd()); ctx.fill(); } }
    if (D.m('spots')) spots(D, at(-bx, 0)[0], cy - bh, at(bx, 0)[0], cy + bh * 0.4, Math.round(10 + 8 * D.m('spots')), bh * 0.12, mark);
    if (D.m('stripes')) { ctx.strokeStyle = mark; ctx.lineWidth = bh * 0.18; for (let i = 0; i < 6; i++) { const a = at(-bx * 0.8 + i * bx * 0.3, -bh * 1.1), b = at(-bx * 0.85 + i * bx * 0.3, bh * 0.3); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(a[0] - 0.02, (a[1] + b[1]) / 2, b[0], b[1]); ctx.stroke(); } }
    if (D.m('stripe')) {
      const w = bh * (tw.tpl === 'mustelid' && tw.col.body[2] < 25 ? 0.45 : 0.3) * Math.min(1.5, D.m('stripe'));
      const a = at(bx * 0.95, -bh * 0.9), m = at(0, -bh * 1.02), b = at(-bx * 1.05, -bh * 0.7);
      if (tw.tpl === 'mustelid' && tw.col.body[2] < 25) {
        // Skunk: two white stripes forking from the nape.
        ctx.strokeStyle = mark; ctx.lineWidth = w;
        for (const dy of [-0.35, 0.25]) { ctx.beginPath(); ctx.moveTo(a[0], a[1] + bh * 0.1); ctx.quadraticCurveTo(m[0], m[1] + bh * (0.25 + dy), b[0], b[1] + bh * (0.15 + dy * 0.8)); ctx.stroke(); }
      } else if (tw.tpl === 'rodent') {
        ctx.strokeStyle = mark; ctx.lineWidth = w * 0.6; ctx.beginPath(); ctx.moveTo(a[0], a[1] + bh * 0.2); ctx.quadraticCurveTo(m[0], m[1] + bh * 0.2, b[0], b[1] + bh * 0.2); ctx.stroke();
      } else { ctx.strokeStyle = mark; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]); ctx.stroke(); }
    }
    if (D.m('rump')) { ctx.fillStyle = tw.tpl === 'cervid' || tw.tpl === 'bovid' ? '#F4EFE3' : D.c('mark'); const c = at(-bx * 0.98, -bh * 0.1); ellPath(ctx, c[0], c[1], bh * 0.6, bh * 0.75); ctx.fill(); }
    if (D.m('mane')) { ctx.fillStyle = D.c('head', -8); const c = at(bx * 0.75, -bh * 0.1); ellPath(ctx, c[0], c[1], bx * 0.4, bh * 1.1, 0.3); ctx.fill(); }
    if (D.m('collar')) { ctx.fillStyle = tw.tpl === 'bovid' ? '#E9E1CC' : mark; const c = at(bx * 0.85, -bh * 0.1); ellPath(ctx, c[0], c[1], bh * 0.2, bh * 1.2, 0.2); ctx.fill(); }
    if (D.m('hump')) { ctx.fillStyle = D.c('body', 8); const c = at(bx * 0.55, -bh * 1.05); ellPath(ctx, c[0], c[1], bx * 0.3, bh * 0.35); ctx.fill(); }
  }
  function quadNeckMarks(D, nb, hc, hs) {
    const ctx = D.ctx;
    if (D.m('bib') || D.m('throat')) { ctx.fillStyle = D.m('throat') ? '#F4EFE3' : D.c('mark'); ellPath(ctx, (nb[0] + hc[0]) / 2 + hs * 0.35, (nb[1] + hc[1]) / 2 + hs * 0.55, hs * 0.55, hs * 0.75); ctx.fill(); }
    if (D.m('nape')) { ctx.fillStyle = D.c('mark'); ellPath(ctx, (nb[0] + hc[0]) / 2 - hs * 0.3, (nb[1] + hc[1]) / 2 - hs * 0.3, hs * 0.5, hs * 0.35); ctx.fill(); }
  }

  // ---------- marine mammals ----------
  SK.skeletons.marine = function (D) {
    const ctx = D.ctx, tw = D.tw, kind = D.part('kind');
    const L = 0.95 * D.p('len'), dep = 0.13 * D.p('depth');
    fit(D, L + 0.2, 0.7);
    const cy = 0.08;
    ctx.fillStyle = 'rgba(96,160,200,0.35)'; ellPath(ctx, 0, cy + dep * 0.9, L * 0.62, 0.035); ctx.fill();
    const body = D.c('body');
    let pts, flipper, fluke;
    if (kind === 'seal' || kind === 'sealion' || kind === 'walrus') {
      const up = kind === 'sealion' ? 0.14 : 0.03;
      pts = [[L * 0.42, cy - dep * 0.6 - up], [L * 0.25, cy - dep * 1.0 - up * 0.6], [0, cy - dep * 1.05], [-L * 0.3, cy - dep * 0.6], [-L * 0.48, cy - 0.01], [-L * 0.3, cy + dep * 0.75], [0, cy + dep * 0.95], [L * 0.32, cy + dep * 0.5], [L * 0.48, cy - dep * 0.3 - up]];
      flipper = () => blobPath(ctx, [[L * 0.12, cy + dep * 0.4], [L * 0.2, cy + dep * 1.25], [L * 0.02, cy + dep * 1.1]]);
      fluke = () => blobPath(ctx, [[-L * 0.45, cy], [-L * 0.62, cy - dep * 0.35], [-L * 0.56, cy + dep * 0.05], [-L * 0.62, cy + dep * 0.45]]);
    } else if (kind === 'manatee') {
      pts = [[L * 0.46, cy - dep * 0.2], [L * 0.3, cy - dep * 0.95], [-L * 0.2, cy - dep * 1.1], [-L * 0.42, cy - dep * 0.4], [-L * 0.4, cy + dep * 0.5], [0, cy + dep * 1.05], [L * 0.35, cy + dep * 0.7]];
      flipper = () => blobPath(ctx, [[L * 0.2, cy + dep * 0.4], [L * 0.25, cy + dep * 1.1], [L * 0.1, cy + dep * 0.9]]);
      fluke = () => ellPath(ctx, -L * 0.52, cy, L * 0.12, dep * 0.6);
    } else {
      pts = [[L * 0.5, cy + dep * 0.05], [L * 0.35, cy - dep * 0.9], [0, cy - dep * 1.05], [-L * 0.35, cy - dep * 0.45], [-L * 0.46, cy - 0.005], [-L * 0.3, cy + dep * 0.45], [0, cy + dep], [L * 0.35, cy + dep * 0.7]];
      flipper = () => blobPath(ctx, [[L * 0.22, cy + dep * 0.45], [L * 0.1, cy + dep * 1.3], [L * 0.06, cy + dep * 0.6]]);
      fluke = () => blobPath(ctx, [[-L * 0.42, cy], [-L * 0.58, cy - dep * 0.6], [-L * 0.52, cy], [-L * 0.58, cy + dep * 0.6]]);
    }
    const bodyPath = () => blobPath(ctx, pts);
    group(D, [{ path: fluke, fill: body }, { path: bodyPath, fill: body }]);
    clipTo(D, bodyPath, () => {
      if (D.m('belly')) { ctx.fillStyle = D.c('belly'); ellPath(ctx, L * 0.05, cy + dep * 0.95, L * 0.45, dep * 0.55 * D.m('belly')); ctx.fill(); }
      if (D.m('spots')) spots(D, -L * 0.4, cy - dep, L * 0.4, cy + dep * 0.5, 16, dep * 0.08, D.c('mark'));
      if (D.m('patch')) { ctx.fillStyle = '#F4EFE3'; ellPath(ctx, L * 0.3, cy - dep * 0.35, L * 0.06, dep * 0.25); ctx.fill(); ellPath(ctx, -L * 0.1, cy + dep * 0.3, L * 0.12, dep * 0.3, -0.3); ctx.fill(); }
      if (D.m('pleats')) { ctx.strokeStyle = D.c('body', -10); ctx.lineWidth = D.lw * 0.6; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(L * 0.45, cy + dep * (0.3 + i * 0.15)); ctx.lineTo(0, cy + dep * (0.5 + i * 0.12)); ctx.stroke(); } }
      if (D.m('callus')) { ctx.fillStyle = '#E9E1CC'; spots(D, L * 0.35, cy - dep * 0.6, L * 0.5, cy, 5, dep * 0.08, '#E9E1CC'); }
      if (D.m('stripe')) { ctx.strokeStyle = D.c('mark'); ctx.lineWidth = dep * 0.2; ctx.beginPath(); ctx.moveTo(L * 0.4, cy); ctx.lineTo(-L * 0.35, cy + dep * 0.2); ctx.stroke(); }
    });
    if (kind === 'dolphin' || kind === 'whale') { blobPath(ctx, [[-L * 0.02, cy - dep * 0.95], [-L * 0.12, cy - dep * (1.2 + 0.6 * D.p('fin'))], [-L * 0.16, cy - dep * 0.8]]); fillStroke(D, D.c('body', -5)); }
    flipper(); fillStroke(D, D.c('body', -8));
    const hx = kind === 'seal' || kind === 'sealion' || kind === 'walrus' ? L * 0.38 : L * 0.36, hy = cy - dep * (kind === 'sealion' ? 0.75 : 0.35);
    eye(D, hx, hy, 0.012);
    if (kind === 'walrus') { limb(D, [[L * 0.44, cy - dep * 0.1], [L * 0.46, cy + dep * 1.1]], 0.018, '#F4EFE3'); }
    if (kind === 'dolphin') line(D, [[L * 0.44, cy + dep * 0.15], [L * 0.52, cy + dep * 0.12]], D.lw, INK);
  };

  // ---------- bats ----------
  SK.skeletons.bat = function (D) {
    const ctx = D.ctx, tw = D.tw;
    const span = 0.55 * D.p('wing'), cy = -0.05, t = D.t || 0;
    fit(D, span * 2 + 0.1, 0.9);
    const flap = Math.sin(t * 12) * 0.08;
    const wingC = D.c('wing'), body = D.c('body');
    // wings: finger bones fan out from the wrist; the membrane scallops between them.
    const wing = side => {
      const s = side;
      const wrist = [s * span * 0.45, cy - 0.12 - flap];
      const tips = [[s * span, cy - 0.02 - flap * 1.5], [s * span * 0.85, cy + 0.12 - flap], [s * span * 0.55, cy + 0.17 - flap * 0.5]];
      const pts = [[s * 0.04, cy - 0.05], wrist, tips[0], [s * span * 0.82, cy + 0.06 - flap], tips[1], [s * span * 0.62, cy + 0.12 - flap], tips[2], [s * span * 0.3, cy + 0.1], [s * 0.05, cy + 0.08]];
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath();
      fillStroke(D, side > 0 ? wingC : D.c('wing', -10));
      ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 0.6;
      for (const q of tips) { ctx.beginPath(); ctx.moveTo(wrist[0], wrist[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
    };
    wing(-1); wing(1);
    if (D.m('tail')) { line(D, [[0, cy + 0.1], [0, cy + 0.2]], D.lw * 1.2, INK); }
    // body and head
    const bw = 0.08, bhh = 0.13;
    group(D, [{ path: () => ellPath(ctx, 0, cy + 0.02, bw, bhh), fill: body }, { path: () => ellPath(ctx, 0, cy - 0.12, 0.065, 0.058), fill: D.c('head') }]);
    clipTo(D, () => ellPath(ctx, 0, cy + 0.02, bw, bhh), () => {
      if (D.m('belly')) { ctx.fillStyle = D.c('belly'); ellPath(ctx, 0, cy + 0.07, bw * 0.7, bhh * 0.7); ctx.fill(); }
      if (D.m('spots')) { ctx.fillStyle = '#F4EFE3'; for (const [x, y] of [[-0.03, -0.02], [0.03, -0.02], [0, 0.08]]) { ellPath(ctx, x, cy + y, 0.018, 0.018); ctx.fill(); } }
      if (D.m('frost')) spots(D, -bw, cy - bhh, bw, cy + bhh, 14, 0.008, 'hsl(40,15%,85%)');
      if (D.m('collar') || D.m('shoulder')) { ctx.fillStyle = D.m('shoulder') ? '#F4EFE3' : D.c('mark'); ellPath(ctx, 0, cy - 0.08, bw, 0.03); ctx.fill(); }
    });
    // ears
    const ear = D.part('ear'), e = D.p('ear');
    for (const s of [-1, 1]) {
      if (ear === 'big') ellPath(ctx, s * 0.045, cy - 0.2 - 0.04 * e, 0.03 * e, 0.075 * e, s * 0.35);
      else if (ear === 'round') ellPath(ctx, s * 0.045, cy - 0.17, 0.028 * e, 0.03 * e);
      else blobPath(ctx, [[s * 0.02, cy - 0.15], [s * 0.05 * e, cy - 0.23 * Math.sqrt(e)], [s * 0.065, cy - 0.13]]);
      fillStroke(D, D.c('head', -5));
    }
    if (D.m('mask')) { ctx.fillStyle = INK; ellPath(ctx, 0, cy - 0.125, 0.06, 0.018); ctx.fill(); }
    for (const s of [-1, 1]) eye(D, s * 0.025, cy - 0.125, 0.009);
    if (D.part('nose') === 'leaf') { blobPath(ctx, [[-0.012, cy - 0.095], [0, cy - 0.125], [0.012, cy - 0.095]]); fillStroke(D, D.c('head', 10)); }
    else { ctx.fillStyle = INK; ellPath(ctx, 0, cy - 0.095, 0.01, 0.007); ctx.fill(); }
    // feet
    for (const s of [-1, 1]) line(D, [[s * 0.03, cy + 0.14], [s * 0.04, cy + 0.18]], D.lw * 1.2, INK);
  };

  // ---------- bird skeleton ----------
  // Anchors: the body's centre and tilt, the neck base, head, bill root, tail root, and the hip where the legs attach.
  // Poses: perch, tall (herons, cranes), swim, cling (woodpeckers), clingDown (nuthatches), upright (raptors),
  // hunch (vultures), fly, glide, hover.
  SK.skeletons.bird = function (D) {
    const ctx = D.ctx, tw = D.tw, pose = tw.pose || 'perch';
    const pb = D.p('body');
    const rx = 0.22 * pb, ry = 0.13 * pb;
    const flying = pose === 'fly' || pose === 'glide' || pose === 'hover';
    const TILT = { perch: -0.3, tall: -0.35, swim: -0.05, cling: -1.35, clingDown: 1.2, upright: -1.05, hunch: -0.6, fly: -0.05, glide: 0, hover: -0.7 };
    const tilt = TILT[pose] != null ? TILT[pose] : -0.3;
    const legLen = pose === 'tall' ? 0.2 * D.p('leg') : pose === 'swim' || flying || pose === 'cling' || pose === 'clingDown' ? 0 : 0.085 * D.p('leg') * (tw.tpl === 'wader' ? 1.2 : 1);
    const cy = pose === 'swim' ? G - 0.05 : flying ? -0.02 : pose === 'cling' || pose === 'clingDown' ? -0.02 : G - legLen - ry * (pose === 'upright' ? 1.35 : 0.85);
    const cx = pose === 'cling' || pose === 'clingDown' ? 0.02 : 0;
    const R = rot([cx, cy], tilt);
    const B = (x, y) => R(cx + x, cy + y);                     // body-local → world
    const neckL = 0.05 * D.p('neck') * (pose === 'tall' ? 2.2 : tw.tpl === 'waterfowl' ? 1.7 : 1);
    const hr = 0.075 * D.p('head') * (tw.parts.head === 'small' ? 0.8 : tw.parts.head === 'owl' ? 1.45 : 1) * Math.sqrt(pb) * (tw.tpl === 'wader' && pose === 'tall' ? 0.85 : 1);
    const nb = B(rx * 0.72, -ry * 0.45);
    // Neck direction: up and forward, whatever the body tilt (so a clinging woodpecker still looks ahead).
    const na = pose === 'tall' ? -1.35 : pose === 'swim' ? (tw.tpl === 'waterfowl' ? -1.3 : -1.1) : pose === 'cling' ? -0.9 : pose === 'clingDown' ? 0.9 : pose === 'upright' ? -1.3 : flying ? -0.2 : -0.9;
    const hc = [nb[0] + Math.cos(na) * (neckL + hr * 0.6) + (pose === 'tall' ? 0.03 : 0), nb[1] + Math.sin(na) * (neckL + hr * 0.6)];
    const top = Math.min(hc[1] - hr * 1.6, cy - ry * 2) - (tw.parts.crest && tw.parts.crest !== 'none' ? 0.06 : 0) - (flying ? 0.25 : 0);
    fit(D, 1.0 + (tw.parts.tail === 'long' ? 0.25 * D.p('tail') : 0) + (pose === 'glide' ? 0.3 * D.p('wing') : 0), G - top);

    const body = D.c('body'), wingC = D.c('wing'), belly = D.c('belly');
    if (pose === 'cling' || pose === 'clingDown') {
      // a trunk to cling to
      ctx.fillStyle = 'hsl(28,25%,38%)'; ctx.fillRect(cx - rx * 0.55 - 0.12, -0.6, 0.1, 0.95);
      ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.strokeRect(cx - rx * 0.55 - 0.12, -0.6, 0.1, 0.95);
    } else if (pose === 'swim') {
      ctx.fillStyle = 'rgba(96,160,200,0.35)'; ellPath(ctx, cx, G, rx * 1.5, 0.035); ctx.fill();
    } else if (!flying) shadow(D, cx, rx * 1.0);

    // Swimmers are cut at the waterline.
    ctx.save();
    if (pose === 'swim') { ctx.beginPath(); ctx.rect(-2, -2, 4, 2 + G - 0.005); ctx.clip(); }

    // raised wings behind the body when flying
    const span = (pose === 'glide' ? 0.62 : pose === 'hover' ? 0.3 : 0.42) * D.p('wing');
    if (flying) {
      const flap = Math.sin((D.t || 0) * (pose === 'hover' ? 30 : 10)) * 0.05;
      const w0 = B(rx * 0.1, -ry * 0.6);
      const far = pose === 'glide' ? [[w0[0] + span * 0.1, w0[1] - 0.05], [w0[0] - span * 0.45, w0[1] - 0.22 - flap], [w0[0] - span * 0.1, w0[1] - 0.02]] :
        pose === 'hover' ? [[w0[0] + 0.04, w0[1]], [w0[0] - span * 0.2, w0[1] - span * 0.9 - flap], [w0[0] - span * 0.45, w0[1] - span * 0.7 - flap], [w0[0] - 0.06, w0[1] + 0.01]] :
        [[w0[0] + 0.05, w0[1]], [w0[0] - span * 0.25, w0[1] - span * 0.45 - flap], [w0[0] - span * 1.0, w0[1] - span * 0.5 - flap], [w0[0] - span * 0.35, w0[1] - span * 0.2], [w0[0] - 0.08, w0[1] + 0.01]];
      blobPath(ctx, far); fillStroke(D, D.c('wing', -10));
    }

    // legs
    const hip = B(-rx * 0.05, ry * 0.75);
    const legC = D.c('leg');
    const legs = () => {
      if (legLen <= 0) return;
      for (const [dx, f] of [[0.025, 1], [-0.01, 0]]) {
        const x = hip[0] + dx;
        const knee = [x - legLen * 0.1, hip[1] + (G - hip[1]) * 0.5];
        limb(D, [[x, hip[1]], knee, [x + 0.005, G]], Math.max(0.012, 0.018 * Math.sqrt(pb)) * (pose === 'upright' ? 1.6 : 1), f ? legC : D.c('leg', -12));
        line(D, [[x - 0.03, G], [x + 0.05, G]], D.lw * 1.1, INK);
      }
    };
    if (pose !== 'swim') legs();

    // tail
    drawBirdTail(D, B, rx, ry, pose);

    // body, neck and head as one silhouette
    const bodyPts = [[rx, -ry * 0.1], [rx * 0.55, -ry * 0.95], [-rx * 0.3, -ry * 0.9], [-rx * 1.05, -ry * 0.2], [-rx * 0.6, ry * 0.75], [rx * 0.2, ry * 1.0], [rx * 0.85, ry * 0.55]].map(q => B(q[0], q[1]));
    const bodyPath = () => blobPath(ctx, bodyPts);
    const neckPath = () => taperPath(ctx, B(rx * 0.45, -ry * 0.2), [nb[0] + Math.cos(na) * neckL * 0.4 - (pose === 'tall' ? 0.04 : 0), nb[1] + Math.sin(na) * neckL * 0.5], hc, ry * 1.25, Math.max(hr * 1.05, ry * 0.7), hr * 1.1);
    const headPath = () => birdHeadPath(D, hc, hr);
    group(D, [{ path: neckPath, fill: body }, { path: bodyPath, fill: body }, { path: headPath, fill: D.c('head') }]);
    // belly and breast
    clipTo(D, bodyPath, () => birdBodyMarks(D, B, rx, ry, belly));
    clipTo(D, neckPath, () => { ctx.fillStyle = belly; const q = B(rx * 0.95, ry * 0.2); ellPath(ctx, q[0] + hr * 0.3, (q[1] + hc[1]) / 2 + hr * 0.3, hr * 0.8, Math.abs(q[1] - hc[1]) * 0.6 + hr * 0.4, na + Math.PI / 2); if (tw.tpl !== 'raptor' || tw.parts.head !== 'bald') ctx.fill(); birdNeckMarks(D, nb, hc, hr); });
    // folded wing
    if (!flying) {
      const wl = rx * 1.3 * (tw.tpl === 'songbird' && tw.parts.bill === 'tiny' ? 1.35 : 1);
      const wingPts = [[rx * 0.55, -ry * 0.55], [rx * 0.1, -ry * 0.85], [-rx * 0.6, -ry * 0.55], [-wl, -ry * 0.05], [-rx * 0.5, ry * 0.3], [rx * 0.35, ry * 0.15]].map(q => B(q[0], q[1]));
      const wingPath = () => blobPath(ctx, wingPts);
      wingPath(); fillStroke(D, wingC);
      clipTo(D, wingPath, () => birdWingMarks(D, B, rx, ry, wl));
      wingPath(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
    } else {
      const w0 = B(rx * 0.2, -ry * 0.5);
      const flap = Math.sin((D.t || 0) * (pose === 'hover' ? 30 : 10)) * 0.05;
      const near = pose === 'glide' ? [[w0[0] + span * 0.15, w0[1]], [w0[0] - span * 0.3, w0[1] - 0.16 - flap], [w0[0] - span * 0.9, w0[1] - 0.12 - flap], [w0[0] - span * 0.25, w0[1] + 0.03]] :
        pose === 'hover' ? [[w0[0] + 0.06, w0[1]], [w0[0] + span * 0.1, w0[1] - span * 1.05 - flap], [w0[0] - span * 0.25, w0[1] - span * 0.95 - flap], [w0[0] - 0.07, w0[1] + 0.02]] :
        [[w0[0] + 0.07, w0[1]], [w0[0] - span * 0.1, w0[1] - span * 0.55 - flap], [w0[0] - span * 1.05, w0[1] - span * 0.75 - flap], [w0[0] - span * 0.3, w0[1] - span * 0.2], [w0[0] - 0.08, w0[1] + 0.02]];
      const wp = () => blobPath(ctx, near);
      wp(); fillStroke(D, wingC);
      clipTo(D, wp, () => { if (D.m('wingTip') || D.m('wingEdge')) { ctx.fillStyle = INK; const q = near[pose === 'hover' ? 1 : 2]; ellPath(ctx, q[0], q[1], 0.07, 0.07); ctx.fill(); } if (D.m('wingbar')) { ctx.strokeStyle = '#F4EFE3'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(w0[0], w0[1] - 0.05); ctx.lineTo(near[1][0], near[1][1] + 0.08); ctx.stroke(); } });
    }
    ctx.restore();
    // head details over everything
    birdHead(D, hc, hr, na);
  };

  function birdHeadPath(D, hc, hr) {
    const ctx = D.ctx, h = D.part('head');
    if (h === 'owl') { ellPath(D.ctx, hc[0], hc[1], hr * 0.95, hr * 0.85); return; }
    if (h === 'flat') { ellPath(ctx, hc[0], hc[1], hr * 1.1, hr * 0.75); return; }
    ellPath(ctx, hc[0], hc[1], hr, hr * 0.92);
  }

  function drawBirdTail(D, B, rx, ry, pose) {
    const ctx = D.ctx, kind = D.part('tail') || 'short', k = D.p('tail');
    const col = D.c('tail');
    const r0 = B(-rx * 0.85, -ry * 0.1);
    const dirA = B(-rx * 2, 0), dx = dirA[0] - r0[0], dy = dirA[1] - r0[1], dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl, uy = dy / dl, nx = -uy, ny = ux;
    const pt = (a, b) => [r0[0] + ux * a + nx * b, r0[1] + uy * a + ny * b];
    let L = 0.16 * k, w = 0.05;
    let pts;
    if (kind === 'none') return;
    if (kind === 'long') L = 0.28 * k;
    if (kind === 'pin') L = 0.24 * k;
    if (kind === 'fork') { L = 0.22 * k; pts = [pt(0, -w * 0.8), pt(L, -w * 1.5), pt(L * 0.6, 0), pt(L, w * 1.5), pt(0, w * 0.8)]; }
    else if (kind === 'notch') pts = [pt(0, -w * 0.8), pt(L, -w * 1.1), pt(L * 0.85, 0), pt(L, w * 1.1), pt(0, w * 0.8)];
    else if (kind === 'fan') pts = [pt(0, -w * 0.7), pt(L * 0.95, -w * 1.7), pt(L * 1.05, 0), pt(L * 0.95, w * 1.7), pt(0, w * 0.7)];
    else if (kind === 'wedge' || kind === 'pin') pts = [pt(0, -w * 0.8), pt(L * 0.7, -w * 0.6), pt(L, 0), pt(L * 0.7, w * 0.6), pt(0, w * 0.8)];
    else if (kind === 'cocked') { const u = B(-rx * 1.3, -ry * 1.6); pts = [pt(0, -w * 0.6), [u[0] - 0.03, u[1]], [u[0] + 0.02, u[1] - 0.01], pt(0, w * 0.6)]; }
    else if (kind === 'stiff') pts = [pt(0, -w * 0.6), pt(L * 1.1, -w * 0.5), pt(L * 1.2, 0), pt(L * 1.1, w * 0.3), pt(0, w * 0.6)];
    else if (kind === 'bustle') pts = [pt(-0.02, -w), pt(L * 0.6, -w * 0.5), pt(L * 0.9, w * 1.5), pt(L * 0.3, w * 2.2), pt(0, w)];
    else pts = [pt(0, -w * 0.7), pt(L, -w * 0.8), pt(L * 1.05, 0), pt(L, w * 0.6), pt(0, w * 0.7)];
    const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); };
    path(); fillStroke(D, col);
    if (D.m('tailTip') || D.m('tailBands') || D.m('rump')) clipTo(D, path, () => {
      if (D.m('tailTip')) { ctx.fillStyle = D.tw.tpl === 'songbird' ? 'hsl(50,80%,60%)' : '#F4EFE3'; const q = pt(L * 1.05, 0); ellPath(ctx, q[0], q[1], 0.05, 0.12); ctx.fill(); }
      if (D.m('tailBands')) { ctx.strokeStyle = INK; ctx.lineWidth = 0.012; for (let i = 1; i <= 3; i++) { const a = pt(L * i / 3.6, -0.1), b = pt(L * i / 3.6, 0.1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
      if (D.m('rump')) { ctx.fillStyle = '#F4EFE3'; const q = pt(0.01, 0); ellPath(ctx, q[0], q[1], 0.04, 0.06); ctx.fill(); }
    });
  }

  function birdBodyMarks(D, B, rx, ry, belly) {
    const ctx = D.ctx, tw = D.tw, mark = D.c('mark');
    const q = B(rx * 0.2, ry * 0.65);
    ctx.fillStyle = belly; ellPath(ctx, q[0], q[1], rx * 0.95, ry * 0.7, 0); ctx.fill();
    const bx0 = Math.min(B(-rx, 0)[0], B(rx, 0)[0]), bx1 = Math.max(B(-rx, 0)[0], B(rx, 0)[0]);
    const by0 = Math.min(B(0, -ry)[1], B(0, ry)[1]), by1 = Math.max(B(0, -ry)[1], B(0, ry)[1]);
    if (D.m('spots')) spots(D, q[0] - rx * 0.4, q[1] - ry * 0.4, q[0] + rx * 0.6, q[1] + ry * 0.3, Math.round(8 + 6 * D.m('spots')), ry * 0.1, D.c('mark'));
    if (D.m('streaks')) { ctx.strokeStyle = D.c('mark', 5); ctx.lineWidth = ry * 0.09; for (let i = 0; i < 7; i++) { const x = q[0] - rx * 0.4 + i * rx * 0.15, y = q[1] - ry * 0.35 + (i % 2) * ry * 0.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 0.008, y + ry * 0.35); ctx.stroke(); } }
    if (D.m('bars') || D.m('scales')) { ctx.strokeStyle = D.c(D.m('scales') ? 'mark' : 'body', D.m('scales') ? 0 : -14); ctx.lineWidth = ry * 0.07; for (let y = by0 + ry * 0.2; y < by1; y += ry * 0.28) { ctx.beginPath(); ctx.moveTo(bx0, y); for (let x = bx0; x < bx1; x += 0.03) ctx.quadraticCurveTo(x + 0.008, y + 0.012, x + 0.015, y); ctx.stroke(); } }
    if (D.m('mottle') || D.m('checker')) spots(D, bx0, by0, bx1, q[1] - ry * 0.2, D.m('checker') ? 30 : 18, ry * 0.08, D.m('checker') ? '#F4EFE3' : D.c('body', -14));
    if (D.m('bellyPatch')) { ctx.fillStyle = INK; ellPath(ctx, q[0] + rx * 0.1, q[1] + ry * 0.2, rx * 0.3, ry * 0.25); ctx.fill(); }
    if (D.m('sidePatch')) { ctx.fillStyle = D.tw.tpl === 'waterfowl' ? '#F4EFE3' : mark; const s = B(-rx * 0.35, ry * 0.25); ellPath(ctx, s[0], s[1], rx * 0.35, ry * 0.3); ctx.fill(); }
    if (D.m('airSac')) { ctx.fillStyle = D.c('mark'); const s = B(rx * 0.85, -ry * 0.1); ellPath(ctx, s[0], s[1], ry * 0.35, ry * 0.3); ctx.fill(); }
    if (D.m('backPatch')) { ctx.fillStyle = '#F4EFE3'; const s = B(0, -ry * 0.8); ellPath(ctx, s[0], s[1], rx * 0.4, ry * 0.25); ctx.fill(); }
  }
  function birdWingMarks(D, B, rx, ry, wl) {
    const ctx = D.ctx, tw = D.tw;
    if (D.m('wingbar')) { ctx.strokeStyle = '#F4EFE3'; ctx.lineWidth = ry * 0.1; for (const f of D.m('wingbar') >= 1 ? [0.1, 0.35] : [0.2]) { const a = B(rx * (0.5 - f), -ry * 0.7), b = B(rx * (0.2 - f), ry * 0.2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
    if (D.m('wingTip') || D.m('wingEdge')) { ctx.fillStyle = INK; const a = B(-wl, 0); ellPath(ctx, a[0], a[1], rx * 0.45, ry * 0.5); ctx.fill(); if (D.m('wingTip')) { ctx.fillStyle = '#F4EFE3'; ellPath(ctx, a[0] - 0.005, a[1] - 0.005, 0.01, 0.01); ctx.fill(); } }
    if (D.m('speculum')) { ctx.fillStyle = tw.col.mark ? D.c('mark') : 'hsl(220,55%,45%)'; if (tw.col.mark && tw.col.mark[2] < 22) ctx.fillStyle = 'hsl(215,55%,45%)'; const a = B(-rx * 0.45, ry * 0.02); ellPath(ctx, a[0], a[1], rx * 0.3, ry * 0.14); ctx.fill(); }
    if (D.m('shoulder')) { ctx.fillStyle = D.c('mark'); const a = B(rx * 0.35, -ry * 0.55); ellPath(ctx, a[0], a[1], rx * 0.18, ry * 0.2); ctx.fill(); if (tw.tpl === 'songbird') { ctx.fillStyle = 'hsl(50,70%,70%)'; ellPath(ctx, a[0], a[1] + ry * 0.15, rx * 0.16, ry * 0.06); ctx.fill(); } }
    if (D.m('patch')) { ctx.fillStyle = '#F4EFE3'; const a = B(-rx * 0.1, -ry * 0.3); ellPath(ctx, a[0], a[1], rx * 0.35, ry * 0.25); ctx.fill(); }
    if (D.m('mottle') || D.m('checker')) spots(D, B(-wl, 0)[0] - 0.05, B(0, -ry)[1] - 0.1, B(rx, 0)[0] + 0.05, B(0, ry)[1] + 0.1, 20, ry * 0.07, D.m('checker') ? '#F4EFE3' : D.c('wing', -14));
    if (D.m('bars') && tw.tpl === 'woodpecker') { ctx.strokeStyle = '#F4EFE3'; ctx.lineWidth = ry * 0.1; for (let i = 0; i < 5; i++) { const a = B(rx * 0.4 - i * rx * 0.3, -ry), b = B(rx * 0.4 - i * rx * 0.3, ry); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
  }
  function birdNeckMarks(D, nb, hc, hr) {
    const ctx = D.ctx;
    if (D.m('collar')) { ctx.fillStyle = D.tw.tpl === 'waterfowl' || D.c('mark') === D.c('body') ? '#F4EFE3' : D.c('mark'); const n = D.m('collar') >= 2 ? 2 : 1; for (let i = 0; i < n; i++) { ellPath(ctx, (nb[0] + hc[0]) / 2, (nb[1] + hc[1]) / 2 + hr * (0.45 + i * 0.5), hr * 1.5, hr * 0.17); ctx.fill(); } }
    if (D.m('bib') || D.m('throat')) { ctx.fillStyle = D.m('throat') ? 'hsl(40,60%,60%)' : D.c('mark'); ellPath(ctx, hc[0] + hr * 0.25, hc[1] + hr * 0.95, hr * 0.6, hr * 0.7); ctx.fill(); }
    if (D.m('wattle')) { ctx.fillStyle = D.c('mark'); ellPath(ctx, hc[0] + hr * 0.6, hc[1] + hr * 1.0, hr * 0.18, hr * 0.45); ctx.fill(); }
  }

  const BILLS = {
    //       length, depth at root, curve (+down), hook, tip style
    cone: [0.55, 0.55, 0.05, 0], thin: [0.75, 0.3, 0.05, 0], short: [0.45, 0.35, 0.05, 0], tiny: [0.25, 0.25, 0.05, 0], stout: [0.9, 0.5, 0.1, 0.1],
    spike: [0.9, 0.35, 0.02, 0], hook: [0.6, 0.5, 0.2, 0.35], curve: [1.0, 0.3, 0.45, 0], flat: [0.6, 0.4, 0.05, 0.05], parrot: [0.6, 0.8, 0.5, 0.5],
    needle: [1.6, 0.18, 0.05, 0], tube: [0.9, 0.4, 0.1, 0.3], owl: [0.3, 0.4, 0.4, 0.3], dagger: [1.3, 0.35, 0.0, 0], probe: [1.3, 0.22, 0.08, 0],
    upcurve: [1.3, 0.25, -0.25, 0], gull: [0.9, 0.4, 0.05, 0.2], hookThin: [1.1, 0.3, 0.05, 0.25], pouch: [1.9, 0.35, 0.0, 0.15], duck: [0.85, 0.4, 0, 0],
    goose: [0.75, 0.5, 0, 0], shovel: [1.0, 0.45, 0, 0], merg: [1.0, 0.25, 0, 0.1], chisel: [1.0, 0.4, 0, 0],
  };
  function birdHead(D, hc, hr, na) {
    const ctx = D.ctx, tw = D.tw;
    const bill = D.part('bill') || 'thin';
    const Bd = BILLS[bill] || BILLS.thin;
    const bl = hr * 1.2 * Bd[0] * D.p('bill'), bd = hr * Bd[1];
    const bx0 = hc[0] + hr * (D.part('head') === 'owl' ? 0.55 : 0.8), by0 = hc[1] + hr * 0.1;
    const down = D.tw.pose === 'clingDown' ? 0.7 : D.tw.pose === 'upright' || D.tw.pose === 'hunch' ? 0.2 : 0;
    const R = rot([bx0, by0], down);
    const P = (x, y) => R(bx0 + x, by0 + y);
    const billC = D.c('bill');
    // crest behind the eye first
    const crest = D.part('crest');
    if (crest && crest !== 'none') {
      const cc = D.c(tw.marks.cap ? 'mark' : 'head');
      if (crest === 'point') blobPath(ctx, [[hc[0] - hr * 0.3, hc[1] - hr * 0.7], [hc[0] - hr * 1.3, hc[1] - hr * 1.6], [hc[0] + hr * 0.3, hc[1] - hr * 0.85]]);
      else if (crest === 'knot' || crest === 'plume') blobPath(ctx, [[hc[0], hc[1] - hr * 0.85], [hc[0] + hr * 0.5, hc[1] - hr * 1.7], [hc[0] + hr * 0.3, hc[1] - hr * 0.8]]);
      else if (crest === 'tufts') { for (const dx of [-0.35, 0.25]) { blobPath(ctx, [[hc[0] + hr * (dx - 0.18), hc[1] - hr * 0.6], [hc[0] + hr * (dx - 0.1), hc[1] - hr * 1.35], [hc[0] + hr * (dx + 0.18), hc[1] - hr * 0.7]]); fillStroke(D, cc); } }
      else if (crest === 'shag') blobPath(ctx, [[hc[0] + hr * 0.2, hc[1] - hr * 0.85], [hc[0] - hr * 1.5, hc[1] - hr * 0.6], [hc[0] - hr * 1.1, hc[1] - hr * 0.1], [hc[0] - hr * 0.5, hc[1] + hr * 0.1]]);
      else if (crest === 'nub' || crest === 'cap') blobPath(ctx, [[hc[0] - hr * 0.6, hc[1] - hr * 0.6], [hc[0] - hr * 0.7, hc[1] - hr * 1.05], [hc[0] + hr * 0.2, hc[1] - hr * 0.9]]);
      else if (crest === 'pinnae') blobPath(ctx, [[hc[0] - hr * 0.6, hc[1] - hr * 0.2], [hc[0] - hr * 1.5, hc[1] - hr * 0.9], [hc[0] - hr * 0.7, hc[1] - hr * 0.6]]);
      else if (crest === 'comb') blobPath(ctx, [[hc[0] - hr * 0.3, hc[1] - hr * 0.8], [hc[0], hc[1] - hr * 1.4], [hc[0] + hr * 0.4, hc[1] - hr * 0.8]]);
      if (crest !== 'tufts') fillStroke(D, cc);
      if (crest === 'plume') { ellPath(ctx, hc[0] + hr * 0.6, hc[1] - hr * 1.7, hr * 0.28, hr * 0.2, 0.5); fillStroke(D, cc); }
    }
    // head markings (clipped to the head)
    clipTo(D, () => birdHeadPath(D, hc, hr), () => {
      if (D.m('cap')) { ctx.fillStyle = D.c(tw.col.mark ? 'mark' : 'head'); ellPath(ctx, hc[0] - hr * 0.1, hc[1] - hr * 0.85, hr * 1.1, hr * 0.55); ctx.fill(); }
      if (D.m('nape')) { ctx.fillStyle = D.c('mark'); ellPath(ctx, hc[0] - hr * 0.75, hc[1] - hr * 0.35, hr * 0.45, hr * 0.4); ctx.fill(); }
      if (D.m('mask')) { ctx.fillStyle = tw.tpl === 'gamebird' ? '#F4EFE3' : INK; ellPath(ctx, hc[0] + hr * 0.25, hc[1] - hr * 0.05, hr * 1.0, hr * 0.26, 0.1); ctx.fill(); if (tw.tpl === 'gamebird') { ctx.fillStyle = INK; ellPath(ctx, hc[0] + hr * 0.3, hc[1] + hr * 0.45, hr * 0.6, hr * 0.28); ctx.fill(); } }
      if (D.m('eyestripe')) { ctx.fillStyle = '#F4EFE3'; ellPath(ctx, hc[0] + hr * 0.1, hc[1] - hr * 0.4, hr * 0.9, hr * 0.12, 0.1); ctx.fill(); }
      if (D.m('cheek')) { ctx.fillStyle = tw.tpl === 'waterfowl' || tw.tpl === 'woodpecker' ? '#F4EFE3' : D.c('mark'); ellPath(ctx, hc[0] + hr * 0.05, hc[1] + hr * 0.3, hr * 0.45, hr * 0.38); ctx.fill(); }
      if (D.m('faceDisc')) { ctx.fillStyle = D.c('belly', 8); ellPath(ctx, hc[0] + hr * 0.35, hc[1] + hr * 0.05, hr * 0.62, hr * 0.7); ctx.fill(); ctx.strokeStyle = D.c('body', -15); ctx.lineWidth = D.lw * 0.8; ctx.stroke(); }
      if (D.m('moustache')) { ctx.fillStyle = D.tw.tpl === 'woodpecker' ? D.c('mark') : INK; ellPath(ctx, hc[0] + hr * 0.35, hc[1] + hr * 0.5, hr * 0.14, hr * 0.42, -0.2); ctx.fill(); }
      if (D.m('stripe')) { ctx.fillStyle = '#F4EFE3'; ellPath(ctx, hc[0], hc[1] + hr * 0.3, hr * 1.0, hr * 0.13, -0.15); ctx.fill(); }
      if (D.m('eyeTuft')) { ctx.fillStyle = D.c('mark'); ellPath(ctx, hc[0] - hr * 0.2, hc[1] - hr * 0.35, hr * 0.7, hr * 0.2, -0.2); ctx.fill(); }
    });
    birdHeadPath(D, hc, hr); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
    // bill
    const curve = Bd[2], hook = Bd[3];
    const tip = P(bl, bl * curve * 0.6);
    ctx.beginPath();
    const p0 = P(0, -bd * 0.5), p1 = P(0, bd * 0.5);
    if (bill === 'pouch') {
      ctx.moveTo(p0[0], p0[1]); ctx.lineTo(tip[0], tip[1]); const pc = P(bl * 0.5, bd * 2.2); ctx.quadraticCurveTo(pc[0], pc[1], p1[0], p1[1] + bd);
    } else if (bill === 'duck' || bill === 'goose' || bill === 'shovel' || bill === 'chisel') {
      const w = bill === 'shovel' ? 1.25 : 1;
      const a = P(bl * 0.9, -bd * 0.3 * w), b = P(bl, bd * 0.05), c = P(bl * 0.9, bd * 0.45 * w);
      ctx.moveTo(p0[0], p0[1]); ctx.lineTo(a[0], a[1]); ctx.quadraticCurveTo(P(bl * 1.05, -bd * 0.1)[0], P(bl * 1.05, -bd * 0.1)[1], b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(p1[0], p1[1]);
    } else {
      const cu = P(bl * 0.5, -bd * 0.5 + bl * curve * 0.25), cl = P(bl * 0.55, bd * 0.3 + bl * curve * 0.35);
      ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(cu[0], cu[1], tip[0], tip[1]);
      if (hook) { const hk = P(bl * (1 - hook * 0.3), bl * curve * 0.6 + bd * hook * 1.1); ctx.lineTo(hk[0], hk[1]); }
      ctx.quadraticCurveTo(cl[0], cl[1], p1[0], p1[1]);
    }
    ctx.closePath(); fillStroke(D, billC);
    if (D.m('billRing')) { const a = P(bl * 0.7, -bd * 0.5), b = P(bl * 0.7, bd * 0.5); line(D, [a, b], D.lw * 1.4, INK); }
    if (D.m('shield')) { ellPath(ctx, bx0 - hr * 0.1, by0 - hr * 0.4, hr * 0.22, hr * 0.35); fillStroke(D, billC); }
    if (D.m('knob')) { ellPath(ctx, bx0 + hr * 0.15, by0 - hr * 0.2, hr * 0.3, hr * 0.28); fillStroke(D, billC); }
    // eye
    const owl = D.part('head') === 'owl';
    const er = hr * (owl ? 0.24 : D.part('head') === 'flat' ? 0.2 : 0.17);
    if (owl) { for (const dx of [0.05, 0.6]) eye(D, hc[0] + hr * dx, hc[1] - hr * 0.1, er, { iris: 'hsl(48,85%,55%)' }); }
    else eye(D, hc[0] + hr * 0.35, hc[1] - hr * 0.12, er, D.m('eyering') ? { ring: '#F4EFE3' } : null);
  }

  // ---------- entry points ----------
  SK.has = tw => !!(tw && T.SpriteTweaks && T.SpriteTweaks.TEMPLATES[tw.tpl] && SK.skeletons[T.SpriteTweaks.TEMPLATES[tw.tpl].skeleton]);

  // Draw a tweak set centred at the current origin, `len` px long, facing right. opts: { t, noShadow }.
  SK.draw = function (ctx, tw, len, opts) {
    const spec = T.SpriteTweaks.TEMPLATES[tw.tpl];
    const fn = spec && SK.skeletons[spec.skeleton];
    if (!fn) return false;
    ctx.save();
    ctx.scale(len, len);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const D = makeD(ctx, tw, opts);
    try { fn(D); } finally { ctx.restore(); }
    return true;
  };
})(window.Trophic);
