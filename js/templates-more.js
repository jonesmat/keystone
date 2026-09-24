// Keystone — species sprite templates, part 2 (P3-ART): reptiles, amphibians, fish, invertebrates and plants.
// Same unit frame and shared parts as js/templates.js (loaded first). See docs/art-style-guide.md.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const SK = T.SpriteTemplates;
  const { INK, G } = SK;
  const { smooth, blobPath, ellPath, fillStroke, group, clipTo, taperPts, taperPath, limb, line, eye, shadow, spots, fit } = SK;
  const TAU = Math.PI * 2;
  const WHITE = '#F4EFE3';

  // A tube along a polyline with a width per point: snakes, worms, abdomens, tails.
  function tubePts(c, w) {
    const L = [], R = [];
    for (let i = 0; i < c.length; i++) {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      L.push([c[i][0] + nx * w[i] / 2, c[i][1] + ny * w[i] / 2]); R.push([c[i][0] - nx * w[i] / 2, c[i][1] - ny * w[i] / 2]);
    }
    return L.concat(R.reverse());
  }
  const polyPath = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); };
  // Bands across a centreline (drawn inside a clip): every `step` points, a stroke perpendicular to the line.
  function crossBands(D, c, w, from, step, color, width) {
    const ctx = D.ctx; ctx.strokeStyle = color; ctx.lineWidth = width;
    for (let i = from; i < c.length - 1; i += step) {
      const a = c[i - 1] || c[i], b = c[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      ctx.beginPath(); ctx.moveTo(c[i][0] + nx * w[i], c[i][1] + ny * w[i]); ctx.lineTo(c[i][0] - nx * w[i], c[i][1] - ny * w[i]); ctx.stroke();
    }
  }

  // ---------- snake ----------
  SK.skeletons.snake = function (D) {
    const ctx = D.ctx, tw = D.tw;
    const len = D.p('len'), th = 0.075 * D.p('thick');
    fit(D, 1.0 * len + 0.1, 0.5);
    shadow(D, 0, 0.45 * len);
    const n = 40, c = [], w = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (-0.48 + 0.86 * t) * len;
      const y = G - th * 0.55 - Math.sin(t * Math.PI * 2.2 + 0.4) * 0.07 * (1 - t * 0.3) - (t > 0.88 ? (t - 0.88) * 0.9 : 0);
      c.push([x, y]);
      w.push(th * (t < 0.25 ? 0.25 + 0.75 * (t / 0.25) : t > 0.92 ? 0.85 : 1));
    }
    const tail = D.part('tail');
    if (tail === 'blunt') w[0] = th * 0.8, w[1] = th * 0.85;
    const pts = tubePts(c, w);
    const body = () => { ctx.beginPath(); smooth(ctx, pts, true); };
    body(); fillStroke(D, D.c('body'));
    clipTo(D, body, () => {
      ctx.strokeStyle = D.c('belly'); ctx.lineWidth = th * 0.25;
      ctx.beginPath(); smooth(ctx, c.map((q, i) => [q[0], q[1] + w[i] * 0.42]), false); ctx.stroke();
      const mk = D.c('mark');
      if (D.m('stripe')) { ctx.strokeStyle = mk; ctx.lineWidth = th * 0.2; ctx.beginPath(); smooth(ctx, c.map((q, i) => [q[0], q[1] - w[i] * 0.05]), false); ctx.stroke(); }
      if (D.m('bands') || D.m('rings')) { crossBands(D, c, w, 3, 3, mk, th * 0.5); if (D.m('rings')) crossBands(D, c, w, 4, 6, 'hsl(50,80%,60%)', th * 0.2); }
      if (D.m('blotches')) { ctx.fillStyle = mk; for (let i = 4; i < n - 3; i += 3) { ellPath(ctx, c[i][0], c[i][1] - w[i] * 0.15, th * 0.55, th * 0.35); ctx.fill(); } }
      if (D.m('diamonds')) { ctx.strokeStyle = mk; ctx.lineWidth = th * 0.12; for (let i = 4; i < n - 3; i += 3) { const q = c[i]; ctx.beginPath(); ctx.moveTo(q[0] - th * 0.6, q[1]); ctx.lineTo(q[0], q[1] - th * 0.45); ctx.lineTo(q[0] + th * 0.6, q[1]); ctx.lineTo(q[0], q[1] + th * 0.45); ctx.closePath(); ctx.stroke(); } }
      if (D.m('checker')) { ctx.fillStyle = mk; for (let i = 3; i < n - 3; i += 2) { ellPath(ctx, c[i][0], c[i][1] + (i % 4 ? 0.2 : -0.2) * th, th * 0.15, th * 0.15); ctx.fill(); } }
      if (D.m('speckle')) spots(D, -0.5 * len, G - 0.2, 0.4 * len, G, 40, th * 0.07, mk);
      if (D.m('tailBands')) crossBands(D, c, w, 2, 2, INK, th * 0.35);
      if (D.m('collar')) crossBands(D, c, w, n - 7, 100, mk, th * 0.45);
    });
    body(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
    if (tail === 'rattle') for (let k = 0; k < 3; k++) { ellPath(ctx, c[0][0] - 0.02 - k * 0.022, c[0][1] - 0.01, 0.015, 0.018); fillStroke(D, 'hsl(38,35%,72%)'); }
    // head
    const hd = c[n], hs = th * (D.part('head') === 'viper' ? 1.05 : 0.8) * 0.9;
    if (D.part('head') === 'viper') blobPath(ctx, [[hd[0] - hs * 0.6, hd[1] - hs * 0.7], [hd[0] + hs * 1.1, hd[1] - hs * 0.25], [hd[0] + hs * 1.2, hd[1] + hs * 0.25], [hd[0] - hs * 0.6, hd[1] + hs * 0.75]]);
    else ellPath(ctx, hd[0] + hs * 0.35, hd[1], hs * 1.0, hs * 0.72, -0.1);
    fillStroke(D, D.part('head') === 'hog' ? D.c('body', 8) : D.c('body'));
    if (D.part('head') === 'hog') { blobPath(ctx, [[hd[0] + hs, hd[1] - hs * 0.3], [hd[0] + hs * 1.6, hd[1] - hs * 0.7], [hd[0] + hs * 1.3, hd[1] + hs * 0.1]]); fillStroke(D, D.c('body')); }
    eye(D, hd[0] + hs * 0.55, hd[1] - hs * 0.2, hs * 0.2, { iris: 'hsl(45,70%,55%)' });
    line(D, [[hd[0] + hs * 1.2, hd[1] + hs * 0.1], [hd[0] + hs * 1.7, hd[1] + hs * 0.1], [hd[0] + hs * 1.9, hd[1] - hs * 0.05]], D.lw * 0.8, 'hsl(355,65%,50%)');
  };

  // ---------- sprawling lizards and salamanders ----------
  SK.skeletons.sprawl = function (D) {
    const ctx = D.ctx, tw = D.tw, sal = tw.tpl === 'salamander';
    const pb = D.p('body'), depth = 0.1 * D.p('depth') * (tw.parts.crest === 'horns' ? 1.1 : 1);
    const bl = 0.36 * pb, tl = 0.4 * D.p('tail'), leg = 0.085 * D.p('leg');
    fit(D, bl + tl + 0.22, 0.5);
    const cy = G - depth * 0.6 - leg * 0.55;
    shadow(D, 0, (bl + tl) * 0.45);
    const x0 = -bl * 0.35;
    const body = D.c('body'), mk = D.c('mark');
    // legs, far then near
    const legs = far => {
      const col = far ? D.c('body', -12) : body;
      for (const [ax, dir] of [[x0 + bl * 0.4, 1], [x0 - bl * 0.42, -1]]) {
        if (leg <= 0.005) continue;
        const a = [ax + (far ? 0.02 : 0), cy + depth * 0.3];
        limb(D, [a, [a[0] + dir * leg * 0.6, a[1] - leg * 0.2 + (far ? -0.01 : 0)], [a[0] + dir * leg * 0.9, G - 0.005]], Math.max(0.018, depth * 0.35), col);
        if (tw.parts.toes !== 'none') for (const dx of [-0.012, 0, 0.012]) line(D, [[a[0] + dir * leg * 0.9, G - 0.005], [a[0] + dir * leg * 0.9 + dx + dir * 0.012, G]], D.lw * 0.8, INK);
      }
    };
    legs(true);
    // tail + body + head as one silhouette
    const tp = tw.parts.tail === 'paddle' ? 0.9 : tw.parts.tail === 'thick' ? 1.3 : 1;
    const tail = () => taperPath(ctx, [x0 - bl * 0.4, cy], [x0 - bl * 0.4 - tl * 0.5, cy + depth * 0.2], [x0 - bl * 0.4 - tl, G - 0.012], depth * 1.2 * tp, depth * 0.7 * tp, 0.006);
    const bodyP = () => ellPath(ctx, x0, cy, bl * 0.58, depth * (tw.parts.crest === 'horns' ? 0.75 : 0.62));
    const hl = 0.075 * D.p('head') * (tw.parts.head === 'big' ? 1.25 : tw.parts.head === 'flat' ? 1.2 : 1);
    const hx = x0 + bl * 0.55 + hl * 0.5, hy = cy - depth * 0.15;
    const head = () => {
      if (tw.parts.head === 'wedge' || tw.parts.head === 'long') blobPath(ctx, [[hx - hl * 0.8, hy - depth * 0.5], [hx + hl * (tw.parts.head === 'long' ? 1.25 : 0.95), hy + depth * 0.05], [hx - hl * 0.7, hy + depth * 0.55]]);
      else ellPath(ctx, hx, hy, hl * 0.95, depth * (tw.parts.head === 'flat' ? 0.45 : 0.55));
    };
    group(D, [{ path: tail, fill: body }, { path: bodyP, fill: body }, { path: head, fill: D.c('head') }]);
    const all = [tail, bodyP, head];
    const inAll = fn => { for (const p of all) clipTo(D, p, fn); };
    inAll(() => {
      ctx.fillStyle = D.c('belly'); ctx.fillRect(x0 - bl - tl, cy + depth * 0.25, bl + tl + 0.4, depth);
      const x1 = x0 - bl * 0.4 - tl, x2 = hx + hl;
      const cnt = tw.marks.count;
      if (D.m('stripes') || D.m('stripe')) { ctx.strokeStyle = mk; ctx.lineWidth = depth * 0.16; for (const dy of D.m('stripe') && !D.m('stripes') ? [-0.25] : [-0.4, 0.0]) { ctx.beginPath(); ctx.moveTo(x1, G - 0.01 + dy * depth * 0.3); ctx.quadraticCurveTo(x0, cy + dy * depth, x2, hy + dy * depth * 0.6); ctx.stroke(); } }
      if (D.m('spots')) spots(D, x1 + tl * 0.3, cy - depth, x2, cy + depth * 0.3, cnt || Math.round(10 + 6 * D.m('spots')), depth * 0.14, mk);
      if (D.m('blotches')) spots(D, x1 + tl * 0.4, cy - depth * 0.8, x0 + bl * 0.5, cy + depth * 0.1, 7, depth * 0.3, mk);
      if (D.m('bands') || D.m('bars') || D.m('chevrons')) { ctx.strokeStyle = mk; ctx.lineWidth = depth * (D.m('bars') ? 0.18 : 0.28); for (let x = x1 + 0.04; x < x0 + bl * 0.5; x += 0.06) { ctx.beginPath(); if (D.m('chevrons')) { ctx.moveTo(x - 0.015, cy - depth); ctx.lineTo(x + 0.01, cy - depth * 0.3); ctx.lineTo(x - 0.015, cy + depth * 0.3); } else { ctx.moveTo(x, cy - depth); ctx.lineTo(x - 0.01, cy + depth); } ctx.stroke(); } }
      if (D.m('speckle') || D.m('mottle') || D.m('beads')) spots(D, x1, cy - depth, x2, cy + depth * 0.4, D.m('beads') ? 40 : 30, depth * (D.m('mottle') ? 0.22 : 0.07), D.m('beads') ? WHITE : mk);
      if (D.m('collar')) { ctx.fillStyle = mk; const n = D.m('collar') >= 2 ? 2 : 1; for (let i = 0; i < n; i++) ctx.fillRect(x0 + bl * (0.42 - i * 0.12), cy - depth, bl * 0.06, depth * 2); }
      if (D.m('bellyFlash')) { ctx.fillStyle = D.c('belly', -5, 15); ellPath(ctx, x0, cy + depth * 0.45, bl * 0.4, depth * 0.3); ctx.fill(); }
      if (D.m('blueTail')) { ctx.fillStyle = 'hsl(205,65%,55%)'; ctx.fillRect(x1 - 0.01, cy - depth, tl * 0.7, depth * 2); }
      if (D.m('folds')) { ctx.strokeStyle = D.c('body', -12); ctx.lineWidth = D.lw * 0.6; for (let x = x0 - bl * 0.4; x < x0 + bl * 0.5; x += 0.025) { ctx.beginPath(); ctx.moveTo(x, cy + depth * 0.1); ctx.lineTo(x - 0.005, cy + depth * 0.6); ctx.stroke(); } }
    });
    for (const p of all) { p(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke(); }
    // spikes, horns, gills, dewlap
    if (tw.parts.crest === 'spikes' || D.m('spikes')) { ctx.fillStyle = D.c('body', -10); for (let i = 0; i < 7; i++) { const x = x0 - bl * 0.45 + i * bl * 0.15; blobPath(ctx, [[x - 0.012, cy - depth * 0.55], [x, cy - depth * 0.95], [x + 0.012, cy - depth * 0.55]]); fillStroke(D, D.c('body', -10), D.lw * 0.6); } }
    if (tw.parts.crest === 'horns') for (let i = 0; i < 4; i++) { const x = hx - hl * 0.9 + i * 0.012; blobPath(ctx, [[x - 0.01, hy - depth * 0.3], [x - 0.02 - i * 0.004, hy - depth * 0.95], [x + 0.01, hy - depth * 0.35]]); fillStroke(D, 'hsl(35,30%,72%)', D.lw * 0.6); }
    if (tw.parts.gills === 'ext') for (let i = 0; i < 3; i++) { const a = [hx - hl * 0.6, hy - depth * 0.1 + i * depth * 0.2]; limb(D, [a, [a[0] - 0.02, a[1] - depth * 0.45 + i * depth * 0.2]], depth * 0.18, 'hsl(355,55%,62%)'); }
    if (D.m('dewlap')) { ellPath(ctx, hx - hl * 0.1, hy + depth * 0.65, hl * 0.4, depth * 0.45); fillStroke(D, mk); }
    legs(false);
    eye(D, hx + hl * 0.2, hy - depth * 0.15, Math.max(0.008, depth * (sal ? 0.14 : 0.12)), sal ? null : { iris: 'hsl(40,50%,50%)' });
    line(D, [[hx + hl * 0.3, hy + depth * 0.2], [hx + hl * 0.8, hy + depth * 0.12]], D.lw * 0.6, INK);
  };

  // ---------- turtle ----------
  SK.skeletons.turtle = function (D) {
    const ctx = D.ctx, tw = D.tw, shell = D.part('shell'), limbs = D.part('limbs');
    const sw = 0.36, dome = 0.2 * D.p('dome') * (shell === 'flat' ? 0.6 : shell === 'pancake' ? 0.35 : shell === 'high' ? 1.1 : 0.85);
    const leg = 0.07 * D.p('leg') * (limbs === 'elephant' ? 1.1 : 1);
    fit(D, 1, 0.5);
    const base = G - leg * 0.75;
    shadow(D, 0, sw * 1.1);
    const skin = D.c('head');
    const legAt = (x, far) => {
      if (limbs === 'flippers') { blobPath(ctx, [[x, base - 0.01], [x + (x > 0 ? 0.14 : -0.08), base + 0.05], [x + (x > 0 ? 0.02 : -0.02), base + 0.03]]); fillStroke(D, far ? D.c('head', -12) : skin); return; }
      limb(D, [[x, base - 0.02], [x + 0.01, G - 0.005]], limbs === 'elephant' ? 0.06 : 0.045, far ? D.c('head', -12) : skin);
    };
    legAt(sw * 0.55 + 0.02, true); legAt(-sw * 0.55 + 0.02, true);
    // tail and neck + head
    line(D, [[-sw * 0.95, base - 0.01], [-sw * 1.1 - 0.05 * D.p('tail'), base + 0.02]], 0.03 + D.lw * 2, INK); line(D, [[-sw * 0.95, base - 0.01], [-sw * 1.1 - 0.05 * D.p('tail'), base + 0.02]], 0.03, skin);
    const hl = 0.07 * D.p('head') * (D.part('head') === 'big' ? 1.3 : 1);
    const neckLen = 0.1 * D.p('neck');
    const hx = sw + neckLen, hy = base - dome * 0.35 - 0.02;
    const neck = () => taperPath(ctx, [sw * 0.8, base - 0.03], [sw + neckLen * 0.4, hy + 0.02], [hx, hy], 0.08, 0.06, hl * 1.1);
    const head = () => D.part('head') === 'snorkel' ? blobPath(ctx, [[hx - hl * 0.6, hy - hl * 0.5], [hx + hl * 1.6, hy], [hx - hl * 0.6, hy + hl * 0.55]]) : ellPath(ctx, hx + hl * 0.3, hy, hl * 1.05, hl * 0.72);
    group(D, [{ path: neck, fill: skin }, { path: head, fill: skin }]);
    clipTo(D, neck, () => { if (D.m('neckStripes')) { ctx.strokeStyle = D.c('mark'); ctx.lineWidth = 0.008; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sw * 0.8, base - 0.05 + i * 0.02); ctx.lineTo(hx, hy - 0.02 + i * 0.02); ctx.stroke(); } } if (D.m('throat')) { ctx.fillStyle = 'hsl(50,80%,60%)'; ctx.fillRect(sw, hy, 0.2, 0.05); } });
    clipTo(D, head, () => { if (D.m('earStripe')) { ctx.fillStyle = D.m('earStripe') > 1 ? 'hsl(5,70%,50%)' : D.c('mark'); ellPath(ctx, hx - hl * 0.1, hy, hl * 0.45, hl * 0.18); ctx.fill(); } if (D.m('neckStripes')) { ctx.strokeStyle = D.c('mark'); ctx.lineWidth = 0.007; ctx.beginPath(); ctx.moveTo(hx - hl, hy + hl * 0.3); ctx.lineTo(hx + hl, hy + hl * 0.2); ctx.stroke(); } if (D.m('headScales') || D.m('spots')) spots(D, hx - hl, hy - hl, hx + hl, hy + hl, 8, hl * 0.12, D.c('mark')); });
    eye(D, hx + hl * 0.45, hy - hl * 0.15, hl * 0.17);
    // shell
    const shellP = () => { ctx.beginPath(); ctx.moveTo(-sw, base); ctx.bezierCurveTo(-sw * 0.95, base - dome * 1.25, sw * 0.95, base - dome * 1.25, sw, base); ctx.quadraticCurveTo(0, base + 0.03, -sw, base); ctx.closePath(); };
    shellP(); fillStroke(D, D.c('body'));
    clipTo(D, shellP, () => {
      const mk = D.c('mark');
      if (D.m('scutes') || D.m('ridges') || shell === 'ridged') {
        ctx.strokeStyle = D.c('body', -14); ctx.lineWidth = D.lw * 0.9 * Math.min(1.6, D.m('scutes') || 1);
        for (let i = -2; i <= 2; i++) { const x = i * sw * 0.36; ctx.beginPath(); ctx.moveTo(x - sw * 0.14, base - dome * 0.95); ctx.lineTo(x + sw * 0.14, base - dome * 0.95); ctx.lineTo(x + sw * 0.18, base - dome * 0.35); ctx.lineTo(x - sw * 0.18, base - dome * 0.35); ctx.closePath(); ctx.stroke(); }
      }
      if (shell === 'ridged') { ctx.fillStyle = D.c('body', -12); for (let i = -2; i <= 2; i++) { blobPath(ctx, [[i * sw * 0.3 - 0.03, base - dome * 0.9], [i * sw * 0.3, base - dome * 1.15], [i * sw * 0.3 + 0.03, base - dome * 0.9]]); ctx.fill(); } }
      if (D.m('rays')) { ctx.strokeStyle = mk; ctx.lineWidth = 0.008; for (let i = -2; i <= 2; i++) for (let a = -1; a <= 1; a++) { const x = i * sw * 0.36, y = base - dome * 0.65; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + a * 0.035, y - 0.04); ctx.stroke(); } }
      if (D.m('spots') || D.m('speckle')) spots(D, -sw, base - dome * 1.1, sw, base, D.m('spots') ? 18 : 40, D.m('spots') ? 0.012 : 0.005, mk);
      if (D.m('rim')) { ctx.strokeStyle = mk; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-sw, base); ctx.quadraticCurveTo(0, base + 0.03, sw, base); ctx.stroke(); }
      ctx.fillStyle = D.c('belly'); ctx.fillRect(-sw, base - 0.006, sw * 2, 0.04);
    });
    shellP(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
    legAt(sw * 0.5, false); legAt(-sw * 0.6, false);
  };

  // ---------- frog ----------
  SK.skeletons.frog = function (D) {
    const ctx = D.ctx, tw = D.tw;
    const pb = D.p('body'), leg = D.p('leg');
    const bw = 0.26 * pb, bh = 0.16 * pb;
    fit(D, 0.9, 0.6);
    const cx = -0.02, cy = G - bh * 0.95;
    shadow(D, cx, bw * 1.2);
    const body = D.c('body'), mk = D.c('mark');
    // far hind foot, thigh
    const thigh = () => ellPath(ctx, cx - bw * 0.5, G - bh * 0.5, bw * 0.55 * Math.sqrt(leg), bh * 0.5, -0.35);
    const foot = () => blobPath(ctx, [[cx - bw * 0.35, G - 0.015], [cx - bw * 0.1 + leg * 0.12, G - 0.01], [cx + leg * 0.1, G], [cx - bw * 0.4, G + 0.005]]);
    const bodyP = () => blobPath(ctx, [[cx + bw * 0.95, cy - bh * 0.25], [cx + bw * 0.55, cy - bh * 0.95], [cx - bw * 0.35, cy - bh * 0.7], [cx - bw * 0.95, cy + bh * 0.1], [cx - bw * 0.6, cy + bh * 0.8], [cx + bw * 0.5, cy + bh * 0.75], [cx + bw * 1.0, cy + bh * 0.15]]);
    foot(); fillStroke(D, D.c('body', -8));
    group(D, [{ path: bodyP, fill: body }, { path: thigh, fill: body }]);
    const marks = () => {
      ctx.fillStyle = D.c('belly'); ellPath(ctx, cx + bw * 0.2, cy + bh * 0.8, bw * 0.8, bh * 0.35); ctx.fill();
      if (D.m('spots')) spots(D, cx - bw, cy - bh, cx + bw * 0.6, cy + bh * 0.4, Math.round(8 + 6 * D.m('spots')), bh * 0.12, mk);
      if (D.m('mottle') || D.m('speckle')) spots(D, cx - bw, cy - bh, cx + bw, cy + bh * 0.5, D.m('mottle') ? 12 : 30, bh * (D.m('mottle') ? 0.2 : 0.05), mk);
      if (D.m('warts')) spots(D, cx - bw, cy - bh, cx + bw * 0.8, cy + bh * 0.4, 18, bh * 0.07, D.c('body', -14));
      if (D.m('stripe') || D.m('stripes')) { ctx.strokeStyle = D.m('stripes') ? mk : D.c('belly', 5); ctx.lineWidth = bh * 0.1; for (const dy of D.m('stripes') ? [-0.55, -0.2, 0.15] : [-0.45]) { ctx.beginPath(); ctx.moveTo(cx + bw * 0.7, cy + bh * dy); ctx.quadraticCurveTo(cx, cy + bh * (dy - 0.25), cx - bw * 0.9, cy + bh * (dy + 0.3)); ctx.stroke(); } }
      if (D.m('legBars')) { ctx.strokeStyle = mk; ctx.lineWidth = bh * 0.1; for (let i = 0; i < 3; i++) { const x = cx - bw * 0.85 + i * bw * 0.22; ctx.beginPath(); ctx.moveTo(x, G - bh); ctx.lineTo(x + 0.02, G); ctx.stroke(); } }
      if (D.m('cross') || D.m('triangle') || D.m('lyre')) { ctx.strokeStyle = mk; ctx.lineWidth = bh * 0.1; ctx.beginPath(); if (D.m('cross')) { ctx.moveTo(cx - bw * 0.4, cy - bh * 0.6); ctx.lineTo(cx + bw * 0.1, cy); ctx.moveTo(cx + bw * 0.1, cy - bh * 0.6); ctx.lineTo(cx - bw * 0.4, cy); } else { ctx.moveTo(cx - bw * 0.5, cy - bh * 0.3); ctx.quadraticCurveTo(cx, cy - bh * 0.9, cx + bw * 0.4, cy - bh * 0.5); } ctx.stroke(); }
      if (D.m('squares')) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = mk; ctx.fillRect(cx - bw * 0.6 + i * bw * 0.35, cy - bh * 0.6 + j * bh * 0.35, bw * 0.15, bh * 0.2); }
      if (D.m('thighFlash')) { ctx.fillStyle = D.c('belly', 0, 20); ellPath(ctx, cx - bw * 0.5, G - bh * 0.3, bw * 0.3, bh * 0.15); ctx.fill(); }
      if (D.m('legColor')) { ctx.fillStyle = mk; ellPath(ctx, cx - bw * 0.5, G - bh * 0.3, bw * 0.5, bh * 0.2, -0.3); ctx.fill(); }
      if (D.m('mask')) { ctx.fillStyle = INK; ellPath(ctx, cx + bw * 0.62, cy - bh * 0.3, bw * 0.35, bh * 0.14, 0.3); ctx.fill(); }
      if (D.m('lip')) { ctx.fillStyle = WHITE; ellPath(ctx, cx + bw * 0.65, cy + bh * 0.08, bw * 0.3, bh * 0.07, 0.2); ctx.fill(); }
      if (D.m('fold')) line(D, [[cx + bw * 0.7, cy - bh * 0.55], [cx + bw * 0.55, cy - bh * 0.68]], D.lw, INK);
    };
    clipTo(D, bodyP, marks); clipTo(D, thigh, marks);
    if (D.m('glands')) { ellPath(ctx, cx + bw * 0.3, cy - bh * 0.6, bw * 0.25, bh * 0.15, -0.2); fillStroke(D, D.c('body', 8)); }
    if (D.m('tympanum')) { ellPath(ctx, cx + bw * 0.35, cy - bh * 0.2, bh * 0.17, bh * 0.17); fillStroke(D, D.c('body', -8)); }
    // front leg
    const fx = cx + bw * 0.55;
    limb(D, [[fx, cy + bh * 0.3], [fx + 0.02, G - 0.03], [fx + 0.035, G]], bh * 0.18, body);
    if (tw.parts.toes === 'pads') for (const dx of [0.02, 0.045]) { ellPath(ctx, fx + dx, G - 0.004, 0.009, 0.009); fillStroke(D, D.c('body', 8), D.lw * 0.6); }
    // eye on top of the head, mouth line
    const er = bh * 0.2 * D.p('eye');
    ellPath(ctx, cx + bw * 0.6, cy - bh * 0.7, er * 1.3, er * 1.2); fillStroke(D, body);
    eye(D, cx + bw * 0.62, cy - bh * 0.72, er * 0.9, { iris: tw.tpl === 'frog' && D.part('skin') === 'warty' ? 'hsl(35,60%,50%)' : 'hsl(45,70%,55%)' });
    line(D, [[cx + bw * 0.98, cy + bh * 0.08], [cx + bw * 0.4, cy + bh * 0.1]], D.lw * 0.8, INK);
  };

  // ---------- fish ----------
  const FISH = {
    //        depth, head, tail-stalk, mouth, snout
    deep: [0.62, 0.35, 0.12, 0.2, 0.2], minnow: [0.3, 0.3, 0.12, 0.2, 0.3], chub: [0.34, 0.32, 0.12, 0.2, 0.35], hump: [0.4, 0.3, 0.08, 0.2, 0.5],
    sucker: [0.34, 0.35, 0.12, 0.3, 0.4], catfish: [0.3, 0.45, 0.13, 0.5, 0.2], torpedo: [0.34, 0.33, 0.12, 0.3, 0.3], bass: [0.4, 0.4, 0.13, 0.5, 0.25],
    darter: [0.26, 0.3, 0.1, 0.2, 0.35], pike: [0.22, 0.4, 0.1, 0.6, 0.6], pup: [0.38, 0.3, 0.16, 0.2, 0.15], goby: [0.28, 0.45, 0.12, 0.3, 0.2],
    grouper: [0.46, 0.45, 0.15, 0.5, 0.25], carp: [0.42, 0.3, 0.13, 0.2, 0.3], sword: [0.3, 0.3, 0.07, 0.3, 1.2], gar: [0.18, 0.4, 0.1, 0.6, 1.0],
    sturgeon: [0.24, 0.35, 0.08, 0.3, 0.6], long: [0.28, 0.35, 0.14, 0.4, 0.3], eel: [0.16, 0.3, 0.16, 0.3, 0.2],
  };
  SK.skeletons.fish = function (D) {
    const ctx = D.ctx, tw = D.tw, F = FISH[D.part('shape')] || FISH.torpedo;
    const len = 0.8 * D.p('len'), dep = len * F[0] * 0.5 * D.p('depth');
    fit(D, len + 0.3, 0.5);
    const cy = 0.05, x0 = -len * 0.42, x1 = len * 0.45;
    ctx.fillStyle = 'rgba(96,160,200,0.22)'; ellPath(ctx, 0, G, len * 0.55, 0.03); ctx.fill();
    const body = D.c('body'), fin = D.c('fin'), mk = D.c('mark');
    // tail
    const tk = D.part('tail'), ts = [x0 - 0.01, cy], tl = 0.16 * D.p('fin');
    let tp;
    if (tk === 'fork') tp = [[ts[0] + 0.02, cy], [ts[0] - tl, cy - dep * 0.95], [ts[0] - tl * 0.55, cy], [ts[0] - tl, cy + dep * 0.95]];
    else if (tk === 'lunate') tp = [[ts[0] + 0.02, cy], [ts[0] - tl, cy - dep * 1.3], [ts[0] - tl * 0.7, cy], [ts[0] - tl, cy + dep * 1.3]];
    else if (tk === 'square') tp = [[ts[0] + 0.02, cy - dep * 0.2], [ts[0] - tl, cy - dep * 0.8], [ts[0] - tl * 0.95, cy + dep * 0.8], [ts[0] + 0.02, cy + dep * 0.2]];
    else if (tk === 'shark') tp = [[ts[0] + 0.02, cy], [ts[0] - tl, cy - dep * 1.1], [ts[0] - tl * 0.5, cy + dep * 0.5]];
    else tp = [[ts[0] + 0.02, cy - dep * 0.2], [ts[0] - tl * 0.7, cy - dep * 0.8], [ts[0] - tl * 1.05, cy], [ts[0] - tl * 0.7, cy + dep * 0.8], [ts[0] + 0.02, cy + dep * 0.2]];
    const tailP = () => { if (tk === 'round') blobPath(ctx, tp); else polyPath(ctx, tp); };
    tailP(); fillStroke(D, fin);
    // fins (dorsal, anal, pelvic)
    const dk = D.part('dorsal'), fh = dep * 0.8 * D.p('fin');
    const finP = pts => { polyPath(ctx, pts); fillStroke(D, fin); if (D.m('finEdge')) { ctx.save(); polyPath(ctx, pts); ctx.clip(); ctx.strokeStyle = D.c('mark', 20); ctx.lineWidth = fh * 0.3; polyPath(ctx, pts); ctx.stroke(); ctx.restore(); } };
    if (dk === 'split' || dk === 'spiny') { finP([[-len * 0.1, cy - dep * 0.85], [-len * 0.02, cy - dep - fh * (dk === 'spiny' ? 0.9 : 0.8)], [len * 0.12, cy - dep * 0.9]]); finP([[-len * 0.3, cy - dep * 0.7], [-len * 0.22, cy - dep - fh * 0.6], [-len * 0.1, cy - dep * 0.85]]); }
    else if (dk === 'sail') finP([[-len * 0.05, cy - dep * 0.9], [len * 0.1, cy - dep - fh * 2.2], [len * 0.18, cy - dep * 0.8]]);
    else if (dk === 'long') finP([[-len * 0.35, cy - dep * 0.6], [-len * 0.2, cy - dep - fh * 0.5], [len * 0.12, cy - dep - fh * 0.4], [len * 0.15, cy - dep * 0.85]]);
    else if (dk === 'rear') finP([[-len * 0.35, cy - dep * 0.6], [-len * 0.28, cy - dep - fh * 0.7], [-len * 0.18, cy - dep * 0.75]]);
    else finP([[-len * 0.1, cy - dep * 0.9], [-len * 0.02, cy - dep - fh], [len * 0.1, cy - dep * 0.9]]);
    if (dk === 'adipose') { finP([[-len * 0.05, cy - dep * 0.9], [len * 0.02, cy - dep - fh * 0.9], [len * 0.1, cy - dep * 0.9]]); ellPath(ctx, -len * 0.3, cy - dep * 0.7, 0.02, 0.012); fillStroke(D, fin); }
    finP([[-len * 0.25, cy + dep * 0.75], [-len * 0.2, cy + dep + fh * 0.55], [-len * 0.1, cy + dep * 0.85]]);
    // body
    const sn = F[4], hump = D.part('shape') === 'hump' ? 0.4 : 0;
    const bodyPts = [[x1 + len * sn * 0.1, cy + dep * 0.1], [x1 - len * 0.1, cy - dep * 0.8], [len * 0.1, cy - dep * (1 + hump)], [-len * 0.2, cy - dep * 0.8], [x0, cy - dep * F[2] * 2], [x0, cy + dep * F[2] * 2], [-len * 0.2, cy + dep * 0.8], [len * 0.1, cy + dep], [x1 - len * 0.1, cy + dep * 0.7]];
    const bodyP = () => blobPath(ctx, bodyPts);
    bodyP(); fillStroke(D, body);
    clipTo(D, bodyP, () => {
      ctx.fillStyle = D.c('belly'); ellPath(ctx, 0, cy + dep * 0.95, len * 0.5, dep * 0.55); ctx.fill();
      if (D.m('bars')) { ctx.fillStyle = mk; ctx.globalAlpha = 0.75; for (let i = 0; i < 6; i++) { ctx.fillRect(-len * 0.32 + i * len * 0.11, cy - dep, len * 0.04, dep * 1.6); } ctx.globalAlpha = 1; }
      if (D.m('saddles') || D.m('blotches')) { ctx.fillStyle = mk; for (let i = 0; i < 4; i++) { ellPath(ctx, -len * 0.3 + i * len * 0.17, cy - dep * 0.8, len * 0.05, dep * 0.4); ctx.fill(); } }
      if (D.m('stripe') || D.m('stripes')) { ctx.strokeStyle = tw.col.stripe ? SK.css(tw.col.stripe) : mk; ctx.lineWidth = dep * (D.m('stripes') ? 0.1 : 0.2); for (const dy of D.m('stripes') ? [-0.4, 0, 0.4] : [0]) { ctx.beginPath(); ctx.moveTo(x0, cy + dy * dep); ctx.lineTo(x1, cy - dep * 0.1 + dy * dep); ctx.stroke(); } }
      if (D.m('spots')) spots(D, x0, cy - dep, x1 - len * 0.1, cy + dep * 0.4, Math.round(12 + 10 * D.m('spots')), dep * 0.08, mk);
      if (D.m('speckle')) spots(D, x0, cy - dep, x1, cy + dep, 40, dep * 0.05, mk);
      if (D.m('mottle')) spots(D, x0, cy - dep, x1, cy + dep * 0.5, 14, dep * 0.25, D.c('body', -14));
      if (D.m('scales') || D.m('scutes')) { ctx.strokeStyle = D.c('body', -12); ctx.lineWidth = D.lw * 0.5; for (let x = x0 + 0.02; x < x1 - 0.1; x += 0.035) for (let y = cy - dep; y < cy + dep; y += 0.03) { ctx.beginPath(); ctx.arc(x, y, 0.016, -1.2, 1.2); ctx.stroke(); } }
      if (D.m('spot')) { ctx.fillStyle = INK; ellPath(ctx, -len * 0.05, cy - dep * 0.1, dep * 0.2, dep * 0.2); ctx.fill(); }
      if (D.m('eyespot')) { ctx.fillStyle = INK; ellPath(ctx, x0 + 0.04, cy - dep * 0.1, dep * 0.25, dep * 0.25); ctx.fill(); ctx.strokeStyle = 'hsl(40,70%,60%)'; ctx.lineWidth = D.lw; ctx.stroke(); }
    });
    bodyP(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
    // head: gill line, ear flap, eye, mouth, barbels, sword
    const gx = x1 - len * F[1] * 0.5;
    line(D, [[gx, cy - dep * 0.6], [gx - 0.01, cy], [gx, cy + dep * 0.55]], D.lw * 0.8, INK);
    if (D.m('earFlap')) { ellPath(ctx, gx - 0.012, cy - dep * 0.15, 0.022, 0.016); ctx.fillStyle = INK; ctx.fill(); }
    if (D.m('throat')) { line(D, [[gx + 0.02, cy + dep * 0.55], [gx + 0.05, cy + dep * 0.45]], D.lw * 2, 'hsl(5,70%,50%)'); }
    finP([[gx - 0.02, cy + dep * 0.2], [gx - 0.09, cy + dep * 0.45], [gx - 0.03, cy + dep * 0.45]]);
    const er = Math.max(0.01, dep * 0.16) * (D.p('eye') || 1);
    if (!D.m('blind')) eye(D, x1 - len * F[1] * 0.2, cy - dep * 0.25, er, { iris: 'hsl(45,60%,60%)' });
    line(D, [[x1 + len * sn * 0.1, cy + dep * 0.12], [x1 + len * sn * 0.1 - len * 0.05 * F[3] * 1.5, cy + dep * 0.2]], D.lw * 0.9, INK);
    if (D.m('barbels')) for (const dy of [0.15, 0.3]) line(D, [[x1, cy + dep * dy], [x1 + 0.03, cy + dep * (dy + 0.3)], [x1 + 0.01, cy + dep * (dy + 0.6)]], D.lw * 0.7, INK);
    if (D.part('shape') === 'sword') { blobPath(ctx, [[x1, cy - dep * 0.2], [x1 + 0.28, cy - 0.005], [x1, cy + dep * 0.05]]); fillStroke(D, D.c('body', -10)); }
    if (D.m('spines')) for (let i = 0; i < 2; i++) line(D, [[-len * 0.05 + i * 0.03, cy - dep * 0.9], [-len * 0.05 + i * 0.03 - 0.01, cy - dep - 0.06]], D.lw, INK);
  };

  // ---------- butterflies and moths (seen from above) ----------
  SK.skeletons.butterfly = function (D) {
    const ctx = D.ctx, tw = D.tw, shape = D.part('shape'), t = D.t || 0;
    const span = 0.36 * D.p('wing') * (shape === 'small' || shape === 'skipper' ? 0.8 : 1), hind = D.p('hind');
    fit(D, span * 2 + 0.1, 0.9);
    const cy = -0.05, open = 0.85 + 0.15 * Math.cos(t * 8);
    const moth = shape === 'moth' || shape === 'sphinx' || shape === 'narrow' || shape === 'broad';
    const fore = s => {
      const w = span * open;
      if (shape === 'sphinx' || shape === 'narrow') return [[s * 0.02, cy - 0.04], [s * w * 1.05, cy - 0.17], [s * w * 1.0, cy - 0.08], [s * 0.03, cy + 0.02]];
      if (shape === 'skipper') return [[s * 0.02, cy - 0.04], [s * w * 0.95, cy - 0.2], [s * w * 0.85, cy - 0.02], [s * 0.03, cy + 0.02]];
      if (moth) return [[s * 0.02, cy - 0.05], [s * w, cy - 0.16], [s * w * 0.95, cy + 0.02], [s * 0.03, cy + 0.04]];
      return [[s * 0.02, cy - 0.05], [s * w * 0.7, cy - 0.25], [s * w, cy - 0.2], [s * w * 0.85, cy + 0.02], [s * 0.03, cy + 0.03]];
    };
    const hindW = s => {
      const w = span * open * 0.75 * hind;
      if (shape === 'sphinx' || shape === 'narrow') return [[s * 0.02, cy], [s * w * 0.7, cy + 0.02], [s * w * 0.55, cy + 0.1], [s * 0.02, cy + 0.08]];
      const pts = [[s * 0.02, cy], [s * w * 0.95, cy + 0.02], [s * w * 0.85, cy + 0.16 * hind], [s * w * 0.35, cy + 0.22 * hind], [s * 0.02, cy + 0.12]];
      return pts;
    };
    const sm = shape !== 'sphinx' && shape !== 'narrow' && shape !== 'skipper';
    const wingPath = pts => { if (sm) blobPath(ctx, pts.concat()); else polyPath(ctx, pts); };
    const tails = D.m('tails') || shape === 'swallow';
    const drawSide = s => {
      if (tails) { const a = hindW(s)[3]; limb(D, [[a[0], a[1] - 0.02], [a[0] + s * 0.01, a[1] + 0.09 * Math.max(1, D.m('tails'))]], 0.025, D.c('hind')); }
      const hp = () => wingPath(hindW(s)), fp = () => wingPath(fore(s));
      hp(); fillStroke(D, shape === 'clear' ? 'rgba(240,240,235,0.55)' : D.c('hind'));
      clipTo(D, hp, () => wingMarks(D, s, span * open, cy, true));
      hp(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
      fp(); fillStroke(D, shape === 'clear' ? 'rgba(240,240,235,0.6)' : D.c('wing'));
      clipTo(D, fp, () => wingMarks(D, s, span * open, cy, false));
      fp(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
    };
    drawSide(-1); drawSide(1);
    // body and antennae
    const bw = moth ? 0.035 : 0.022;
    group(D, [{ path: () => ellPath(ctx, 0, cy + 0.02, bw, 0.13), fill: D.c('body') }, { path: () => ellPath(ctx, 0, cy - 0.12, bw * 1.05, bw * 1.05), fill: D.c('body') }]);
    if (D.m('collar')) { ctx.fillStyle = D.c('mark'); ellPath(ctx, 0, cy - 0.095, bw, 0.012); ctx.fill(); }
    if (D.m('fuzz')) { ctx.fillStyle = D.c('wing', 10); ellPath(ctx, 0, cy - 0.05, bw * 1.3, 0.06); ctx.fill(); }
    const ant = D.part('antenna');
    for (const s of [-1, 1]) {
      const tip = [s * 0.07, cy - 0.26];
      if (ant === 'feather') { blobPath(ctx, [[s * 0.01, cy - 0.14], [s * 0.1, cy - 0.23], [s * 0.05, cy - 0.25]]); fillStroke(D, D.c('body', 10), D.lw * 0.6); }
      else { line(D, [[s * 0.01, cy - 0.14], [s * 0.04, cy - 0.21], tip], D.lw * 0.8, INK); if (ant === 'club' || ant === 'hook') { ctx.fillStyle = INK; ellPath(ctx, tip[0], tip[1], 0.01, 0.012); ctx.fill(); } }
    }
  };
  function wingMarks(D, s, w, cy, hindWing) {
    const ctx = D.ctx, mk = D.c('mark'), tw = D.tw;
    const cnt = tw.marks.count;
    if (D.m('veins')) { ctx.strokeStyle = mk; ctx.lineWidth = 0.007; for (let a = -0.9; a <= 0.6; a += 0.3) { ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(s * Math.cos(a) * w, cy + Math.sin(a) * w * (hindWing ? -0.8 : 0.9) * (hindWing ? -1 : 1)); ctx.stroke(); } }
    if (D.m('border')) { ctx.strokeStyle = mk; ctx.lineWidth = 0.05 * Math.min(1.4, D.m('border')); ellPath(ctx, 0, cy, w * 1.02, 0.28); ctx.stroke(); spots(D, s * w * 0.6, cy - 0.25, s * w * 0.95, cy + 0.2, 6, 0.008, WHITE); }
    if (!hindWing && D.m('tipDark')) { ctx.fillStyle = mk; ellPath(ctx, s * w * 0.95, cy - 0.2, w * 0.35, 0.1); ctx.fill(); if (D.m('spots')) spots(D, s * w * 0.75, cy - 0.23, s * w * 0.95, cy - 0.12, 4, 0.012, WHITE); }
    if (!hindWing && D.m('tipColor')) { ctx.fillStyle = mk; ellPath(ctx, s * w * 0.9, cy - 0.17, w * 0.3, 0.09); ctx.fill(); }
    if (D.m('stripes')) { ctx.strokeStyle = mk; ctx.lineWidth = 0.022; for (let i = 1; i <= 4; i++) { const x = s * w * i * 0.2; ctx.beginPath(); ctx.moveTo(x, cy - 0.3); ctx.lineTo(x + s * 0.03, cy + 0.25); ctx.stroke(); } }
    if (D.m('bands') || D.m('lines')) { ctx.strokeStyle = D.m('bands') ? mk : D.c('wing', -18); ctx.lineWidth = D.m('bands') ? 0.03 : 0.008; for (const f of D.m('lines') ? [0.35, 0.65] : [0.55]) { ctx.beginPath(); ctx.moveTo(s * w * f, cy - 0.28); ctx.quadraticCurveTo(s * w * (f + 0.1), cy, s * w * f * 0.9, cy + 0.25); ctx.stroke(); } }
    if (D.m('spots') && !D.m('tipDark')) spots(D, s * w * 0.3, cy - (hindWing ? -0.02 : 0.2), s * w * 0.85, cy + (hindWing ? 0.18 : -0.02), cnt ? Math.ceil(cnt / 2) : Math.round(4 + 3 * D.m('spots')), 0.016, tw.col.mark[2] < 30 && tw.col.wing[2] < 30 ? WHITE : mk);
    if (D.m('dots')) spots(D, s * w * 0.4, cy - 0.15, s * w * 0.9, cy + 0.15, 7, 0.01, tw.col.wing[2] < 35 ? WHITE : mk);
    if (hindWing && (D.m('eyespots') || D.m('eyes'))) { const x = s * w * 0.5, y = cy + 0.1; ctx.fillStyle = 'hsl(45,70%,60%)'; ellPath(ctx, x, y, 0.035, 0.035); ctx.fill(); ctx.fillStyle = INK; ellPath(ctx, x, y, 0.022, 0.022); ctx.fill(); ctx.fillStyle = 'hsl(200,50%,60%)'; ellPath(ctx, x + 0.006, y - 0.006, 0.008, 0.008); ctx.fill(); }
    if (!hindWing && D.m('eyespots') > 1) { const x = s * w * 0.6, y = cy - 0.1; ctx.fillStyle = INK; ellPath(ctx, x, y, 0.02, 0.02); ctx.fill(); }
    if (hindWing && D.m('hindFlash')) { ctx.fillStyle = D.c('mark'); ellPath(ctx, s * w * 0.4, cy + 0.08, w * 0.35, 0.07); ctx.fill(); }
    if (D.m('checker')) { ctx.fillStyle = mk; for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) ctx.fillRect(s * w * (0.15 + i * 0.17), cy - 0.25 + j * 0.12, s * w * 0.1, 0.05); }
    if (!hindWing && D.m('kidney')) { ctx.strokeStyle = mk; ctx.lineWidth = 0.008; ellPath(ctx, s * w * 0.55, cy - 0.08, 0.025, 0.035); ctx.stroke(); }
    if (!hindWing && D.m('patch')) { ctx.fillStyle = WHITE; ellPath(ctx, s * w * 0.5, cy - 0.1, 0.05, 0.03); ctx.fill(); }
    if (D.m('speckle') || D.m('mottle')) spots(D, 0, cy - 0.3, s * w, cy + 0.25, 25, 0.008, mk);
  }

  // ---------- dragonflies and damselflies (seen from above) ----------
  SK.skeletons.dragonfly = function (D) {
    const ctx = D.ctx, tw = D.tw, damsel = D.part('kind') === 'damsel';
    const ab = 0.55 * D.p('abdomen'), wl = 0.33 * D.p('wing') * (damsel ? 0.85 : 1);
    fit(D, ab + 0.25, wl * 2 + 0.1);
    const cy = -0.08, tx = 0.18;
    const wingC = D.c('wing');
    const wing = (x, s, back) => {
      const len = wl * (back ? 0.95 : 1), wd = damsel ? 0.055 : back ? 0.11 : 0.09;
      const pts = [[x, cy], [x + (back ? -0.03 : 0.01), cy + s * len * 0.5 - wd * 0.2], [x - 0.01, cy + s * len], [x - wd, cy + s * len * 0.6], [x - wd * 0.6, cy + s * 0.02]];
      blobPath(ctx, pts);
      ctx.fillStyle = wingC; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 0.8; ctx.stroke();
      clipTo(D, () => blobPath(ctx, pts), () => {
        ctx.strokeStyle = 'rgba(31,42,36,0.25)'; ctx.lineWidth = D.lw * 0.4; ctx.beginPath(); ctx.moveTo(x - wd * 0.4, cy); ctx.lineTo(x - wd * 0.4, cy + s * len); ctx.stroke();
        if (D.m('wingSpots')) { ctx.fillStyle = D.c('mark', 5); for (const f of D.m('wingSpots') > 1.2 ? [0.25, 0.55, 0.9] : [0.5, 0.9]) { ellPath(ctx, x - wd * 0.4, cy + s * len * f, wd * 0.5, len * 0.07); ctx.fill(); } }
        if (D.m('wingBands')) { ctx.fillStyle = D.c('mark'); ctx.fillRect(x - wd, cy + s * len * 0.35 - (s < 0 ? len * 0.15 : 0), wd * 1.2, len * 0.15); }
        if (D.m('wingBase')) { ctx.fillStyle = D.c('mark'); ellPath(ctx, x, cy + s * len * 0.1, wd, len * 0.12); ctx.fill(); }
        ctx.fillStyle = INK; ellPath(ctx, x - wd * 0.3, cy + s * len * 0.93, wd * 0.2, len * 0.03); ctx.fill();
      });
    };
    for (const s of [-1, 1]) { wing(tx - 0.08, s, true); wing(tx - 0.02, s, false); }
    // abdomen
    const n = 16, c = [], w = [];
    const aw = damsel ? 0.03 : 0.05;
    for (let i = 0; i <= n; i++) { const t = i / n; c.push([tx - 0.08 - ab * t, cy]); w.push(aw * (t < 0.1 ? 1.2 : D.part('tip') === 'club' && t > 0.75 ? 1.35 : 0.85 - 0.1 * t)); }
    const abP = () => { ctx.beginPath(); smooth(ctx, tubePts(c, w), true); };
    abP(); fillStroke(D, D.c('body'));
    clipTo(D, abP, () => {
      const mk = D.c('mark');
      if (D.m('rings')) crossBands(D, c, w, 2, 2, mk, aw * 0.22 * Math.min(1.4, D.m('rings')));
      if (D.m('stripe')) { ctx.strokeStyle = mk; ctx.lineWidth = aw * 0.25; ctx.beginPath(); ctx.moveTo(c[0][0], cy); ctx.lineTo(c[n][0], cy); ctx.stroke(); }
      if (D.m('spots')) for (let i = 2; i < n; i += 2) { ctx.fillStyle = mk; ellPath(ctx, c[i][0], cy, aw * 0.25, aw * 0.25); ctx.fill(); }
      if (D.m('pruinose')) { ctx.fillStyle = 'hsl(205,35%,78%)'; ctx.fillRect(c[n][0], cy - 0.05, ab * 0.6 * D.m('pruinose'), 0.1); ctx.fillRect(c[0][0] - ab * 0.5, cy - 0.05, ab * 0.5, 0.1); }
      if (D.m('tipDark')) { ctx.fillStyle = INK; ctx.fillRect(c[n][0] - 0.01, cy - 0.05, ab * 0.3, 0.1); }
      if (D.m('tipBlue')) { ctx.fillStyle = 'hsl(205,60%,55%)'; ctx.fillRect(c[n][0] + ab * 0.08, cy - 0.05, ab * 0.12, 0.1); }
    });
    abP(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
    // thorax and head with big eyes
    ellPath(ctx, tx - 0.04, cy, 0.06, aw * 1.3); fillStroke(D, D.c('body'));
    if (D.m('stripe')) { ctx.fillStyle = D.c('mark'); ellPath(ctx, tx - 0.04, cy, 0.05, aw * 0.3); ctx.fill(); }
    const ec = D.c('eye');
    if (damsel) for (const s of [-1, 1]) { ellPath(ctx, tx + 0.035, cy + s * 0.03, 0.022, 0.022); fillStroke(D, ec); }
    else { ellPath(ctx, tx + 0.04, cy, 0.045, 0.055); fillStroke(D, ec); line(D, [[tx + 0.015, cy], [tx + 0.08, cy]], D.lw * 0.6, INK); }
  };

  // ---------- bees, wasps and ants (side view) ----------
  SK.skeletons.hymen = function (D) {
    const ctx = D.ctx, tw = D.tw, kind = D.part('kind'), ant = tw.tpl === 'ant';
    const fuzz = D.p('fuzz'), pb = D.p('body');
    const waist = ant || kind === 'wasp' || kind === 'paper' || kind === 'thread' || kind === 'velvet' || kind === 'cuckoo';
    const abL = 0.32 * D.p('abdomen') * (kind === 'bumble' || kind === 'carpenter' ? 1 : kind === 'thread' ? 0.7 : 0.9) * pb;
    const abH = abL * (kind === 'bumble' || kind === 'carpenter' ? 0.72 : ant ? 0.62 : kind === 'wasp' || kind === 'paper' ? 0.5 : 0.6);
    fit(D, 1, 0.8);
    const cy = ant ? G - 0.12 : -0.02;
    const thx = 0.06, thr = 0.1 * pb * (kind === 'bumble' ? 1.1 : 1) * (ant ? 0.7 : 1);
    const hx = thx + thr + 0.07 * D.p('head') * (ant ? 1.1 : 0.85), hr = 0.07 * D.p('head') * pb * (kind === 'bighead' ? 1.4 : 1);
    const ax = thx - thr - (waist ? 0.07 : 0) - abL * 0.45;
    if (ant) shadow(D, 0, 0.35);
    const body = D.c('body'), band = D.c(ant ? 'gaster' : 'band');
    // wings behind
    if (!ant && kind !== 'velvet') {
      const wp = () => blobPath(ctx, [[thx, cy - thr * 0.7], [thx - 0.12, cy - thr * 2.2], [thx - 0.34, cy - thr * 1.6], [thx - 0.1, cy - thr * 0.8]]);
      wp(); ctx.fillStyle = D.c('wing'); ctx.globalAlpha = 0.65; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 0.7; ctx.stroke();
    }
    // legs
    const legC = D.c(ant ? 'body' : 'mark', ant ? -8 : 0);
    const legL = (ant ? 0.2 : 0.16) * D.p('leg') * (kind === 'paper' ? 1.3 : kind === 'longleg' ? 1.2 : 1);
    for (let i = 0; i < 3; i++) {
      const a = [thx - thr * 0.5 + i * thr * 0.5, cy + thr * 0.5];
      const f = ant ? [a[0] + (i - 1) * 0.1, G] : [a[0] + (i - 1) * 0.07, cy + thr * 0.5 + legL];
      limb(D, [a, [a[0] + (i - 1) * 0.06, a[1] + legL * 0.4 - 0.02], f], 0.014, legC);
      if (!ant && kind === 'bumble' && i === 2) { ellPath(ctx, a[0] + 0.07, a[1] + legL * 0.6, 0.02, 0.028); fillStroke(D, 'hsl(40,70%,55%)', D.lw * 0.6); }
    }
    // abdomen, waist, thorax, head
    const abP = () => ellPath(ctx, ax, cy + (ant ? 0 : 0.02), abL * 0.5, abH * 0.5, ant || kind === 'bumble' ? 0 : 0.12);
    const thP = () => ellPath(ctx, thx, cy, thr, thr * 0.85);
    const hdP = () => ellPath(ctx, hx, cy - (ant ? 0 : 0.01), hr, hr * (kind === 'bighead' ? 0.85 : 0.95));
    const shapes = [{ path: abP, fill: ant ? band : body }, { path: thP, fill: body }, { path: hdP, fill: D.c(ant ? 'head' : 'body') }];
    if (waist) shapes.unshift({ path: () => { ctx.beginPath(); ctx.moveTo(thx - thr * 0.8, cy); ctx.lineTo(ax + abL * 0.45, cy); ctx.lineWidth = 0.02; }, fill: body });
    if (waist) { line(D, [[thx - thr * 0.8, cy], [ax + abL * 0.45, cy + 0.01]], 0.02 + D.lw * 2, INK); line(D, [[thx - thr * 0.8, cy], [ax + abL * 0.45, cy + 0.01]], 0.02, body); shapes.shift(); }
    group(D, shapes);
    clipTo(D, abP, () => {
      const nb = Math.round(3 + (D.m('bands') >= 1.2 ? 1 : 0));
      if (D.m('bumble')) {
        const pat = D.m('bumble');
        const order = [[1, 0, 0], [0, 1, 1], [1, 1, 0], [1, 0, 2], [1, 0, 3], [1, 1, 1], [0, 0, 0]][pat - 1] || [1, 0, 0];
        ctx.fillStyle = band;
        if (order[0]) ctx.fillRect(ax + abL * 0.2, cy - abH, abL * 0.3, abH * 2);
        if (order[1]) ctx.fillRect(ax - abL * 0.2, cy - abH, abL * 0.3, abH * 2);
        if (order[2]) { ctx.fillStyle = order[2] === 1 ? band : D.c('mark'); ctx.fillRect(ax - abL * 0.6, cy - abH, abL * 0.3, abH * 2); }
      } else if (D.m('bands')) { ctx.fillStyle = band; for (let i = 0; i < nb; i++) ctx.fillRect(ax + abL * 0.35 - i * abL * (0.8 / nb) - abL * 0.08, cy - abH, abL * 0.1 * (kind === 'wasp' ? 1.4 : 1), abH * 2); }
      if (D.m('metal')) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ellPath(ctx, ax + abL * 0.1, cy - abH * 0.2, abL * 0.25, abH * 0.12); ctx.fill(); }
      if (D.m('spots')) spots(D, ax - abL * 0.4, cy - abH * 0.4, ax + abL * 0.3, cy + abH * 0.2, 5, abH * 0.08, band);
      if (D.m('tail')) { ctx.fillStyle = D.c('mark'); ctx.fillRect(ax - abL * 0.6, cy - abH, abL * 0.25, abH * 2); }
      if (D.m('shine') || kind === 'carpenter') { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ellPath(ctx, ax + abL * 0.1, cy - abH * 0.25, abL * 0.2, abH * 0.1); ctx.fill(); }
      if (D.m('heart')) { ctx.fillStyle = D.c('mark'); ellPath(ctx, ax, cy - abH * 0.2, abL * 0.1, abH * 0.1); ctx.fill(); }
      if (D.m('hairs')) spots(D, ax - abL * 0.5, cy - abH * 0.5, ax + abL * 0.5, cy + abH * 0.5, 16, 0.004, 'hsl(40,40%,80%)');
    });
    clipTo(D, thP, () => {
      if (D.m('thoraxBand') || (D.m('bumble') && [1, 3, 6].includes(D.m('bumble')))) { ctx.fillStyle = D.m('thoraxBand') ? band : band; ctx.fillRect(thx - thr * 0.3, cy - thr, thr * 1.4, thr * 2); }
      if (D.m('metal') && kind !== 'mason') { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ellPath(ctx, thx, cy - thr * 0.4, thr * 0.5, thr * 0.2); ctx.fill(); }
    });
    if (fuzz > 0.6 && !ant) { ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 0.5; for (let a = -2.6; a < 0; a += 0.35) { ctx.beginPath(); ctx.moveTo(thx + Math.cos(a) * thr, cy + Math.sin(a) * thr * 0.85); ctx.lineTo(thx + Math.cos(a) * thr * (1 + 0.12 * fuzz), cy + Math.sin(a) * thr * 0.85 * (1 + 0.12 * fuzz)); ctx.stroke(); } }
    if (D.m('face')) { ctx.fillStyle = WHITE; ellPath(ctx, hx + hr * 0.4, cy, hr * 0.5, hr * 0.7); ctx.fill(); }
    if (kind === 'spiny') for (let i = 0; i < 3; i++) line(D, [[thx - thr * 0.5 + i * thr * 0.4, cy - thr * 0.8], [thx - thr * 0.6 + i * thr * 0.4, cy - thr * 1.3]], D.lw, INK);
    // eye, antennae, mandibles, stinger
    ctx.fillStyle = ant ? INK : D.c('body', -10); ellPath(ctx, hx + hr * 0.25, cy - hr * 0.2, hr * (ant ? 0.25 : 0.45), hr * (ant ? 0.3 : 0.6)); ctx.fill();
    const al = (ant ? 0.13 : kind === 'longhorn' ? 0.22 : 0.12) * (kind === 'bighead' ? 0.9 : 1);
    line(D, [[hx + hr * 0.5, cy - hr * 0.7], [hx + hr * 0.6 + al * 0.3, cy - hr - al * 0.7], [hx + hr + al * 0.8, cy - hr - al * 0.4]], D.lw * 0.9, INK);
    if (ant) line(D, [[hx + hr * 0.8, cy + hr * 0.4], [hx + hr * 1.3, cy + hr * 0.5]], D.lw * 1.2, INK);
    else if (kind !== 'bumble' && kind !== 'honey' && kind !== 'carpenter') line(D, [[ax - abL * 0.5, cy + 0.02], [ax - abL * 0.5 - 0.035, cy + 0.03]], D.lw * 0.8, INK);
  };

  // ---------- beetles ----------
  const BEETLE = {
    //      length, dome, pronotum, head
    round: [0.5, 0.55, 0.12, 0.08], oval: [0.56, 0.42, 0.14, 0.08], long: [0.62, 0.28, 0.13, 0.08], ground: [0.6, 0.3, 0.16, 0.09], weevil: [0.5, 0.45, 0.14, 0.07],
    soft: [0.6, 0.22, 0.14, 0.07], scarab: [0.55, 0.45, 0.16, 0.08], rove: [0.62, 0.2, 0.15, 0.09], flat: [0.58, 0.22, 0.15, 0.08], dome: [0.52, 0.5, 0.13, 0.08],
    bullet: [0.6, 0.3, 0.16, 0.07], stag: [0.6, 0.35, 0.16, 0.1], tiger: [0.55, 0.3, 0.12, 0.1],
  };
  SK.skeletons.beetle = function (D) {
    const ctx = D.ctx, tw = D.tw, shape = D.part('shape'), B = BEETLE[shape] || BEETLE.oval;
    const L = B[0] * 1.3 * D.p('len') * D.p('body'), H = L * B[1] * 0.55 * D.p('dome');
    const leg = 0.12 * D.p('leg') * (shape === 'tiger' ? 1.5 : 1);
    fit(D, L + 0.35, 0.6);
    shadow(D, 0, L * 0.55);
    const base = G - leg * 0.75, ex0 = -L * 0.45, ex1 = L * 0.15;
    const legC = D.c('leg');
    const legs = far => { for (let i = 0; i < 3; i++) { const a = [ex1 - (ex1 - ex0) * (0.1 + i * 0.35) + (far ? 0.02 : 0), base - 0.01]; limb(D, [a, [a[0] + (i - 1) * 0.06, a[1] - leg * 0.2], [a[0] + (i - 1) * 0.1, G]], 0.014, far ? D.c('leg', 8) : legC); } };
    legs(true);
    // elytra dome, pronotum, head
    const ely = () => { ctx.beginPath(); ctx.moveTo(ex1, base); ctx.bezierCurveTo(ex1, base - H * 1.35, ex0 - L * 0.08, base - H * 1.2, ex0, base - (shape === 'rove' ? H * 0.2 : 0)); ctx.quadraticCurveTo((ex0 + ex1) / 2, base + H * 0.12, ex1, base); ctx.closePath(); };
    const pw = L * B[2];
    const pro = () => ellPath(ctx, ex1 + pw * 0.8, base - H * 0.45, pw, H * 0.5);
    const hr = L * B[3];
    const hx = ex1 + pw * 1.8 + hr * 0.5;
    const hd = () => { if (shape === 'weevil') blobPath(ctx, [[hx - hr, base - H * 0.6], [hx + hr * 2.2, base - H * 0.1], [hx + hr * 2.3, base + 0.005], [hx - hr, base - H * 0.1]]); else ellPath(ctx, hx, base - H * 0.35, hr, hr * 0.85); };
    const mk = D.c('mark');
    group(D, [{ path: hd, fill: D.c('head') }, { path: pro, fill: D.c('head') }, { path: ely, fill: D.c('body') }]);
    clipTo(D, ely, () => {
      const cnt = tw.marks.count;
      if (D.m('spots')) { ctx.fillStyle = mk; const n = cnt ? Math.ceil(cnt / 2) + 1 : Math.round(3 + 3 * D.m('spots')); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; ellPath(ctx, ex1 - (ex1 - ex0) * t, base - H * (0.35 + 0.45 * ((i * 7) % 3) / 2), H * 0.14, H * 0.14); ctx.fill(); } }
      if (D.m('bands') || D.m('checker')) { ctx.fillStyle = mk; for (const f of D.m('bands') >= 1.2 ? [0.3, 0.65] : [0.45]) ctx.fillRect(ex1 - (ex1 - ex0) * f - L * 0.05, base - H * 1.5, L * 0.1, H * 2); }
      if (D.m('stripes')) { ctx.strokeStyle = mk; ctx.lineWidth = H * 0.12; for (const f of [0.45, 0.8]) { ctx.beginPath(); ctx.moveTo(ex1, base - H * f); ctx.lineTo(ex0, base - H * f * 0.3); ctx.stroke(); } }
      if (D.m('ridges')) { ctx.strokeStyle = D.c('body', 12); ctx.lineWidth = D.lw * 0.6; for (const f of [0.3, 0.6, 0.9]) { ctx.beginPath(); ctx.moveTo(ex1, base - H * f); ctx.quadraticCurveTo((ex0 + ex1) / 2, base - H * f * 1.1, ex0, base - H * f * 0.3); ctx.stroke(); } }
      if (D.m('tip')) { ctx.fillStyle = mk; ellPath(ctx, ex0, base - H * 0.1, L * 0.12, H); ctx.fill(); }
      if (D.m('lantern')) { ctx.fillStyle = mk; ctx.fillRect(ex0 - 0.02, base - H * 0.25, L * 0.18, H * 0.4); }
      if (D.m('metal') || D.m('shine')) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ellPath(ctx, (ex0 + ex1) / 2 + L * 0.05, base - H * 0.85, L * 0.15, H * 0.12, -0.1); ctx.fill(); }
      if (D.m('scales') || D.m('speckle')) spots(D, ex0, base - H * 1.2, ex1, base, 25, H * 0.05, D.c('body', 18));
      if (D.m('shieldEdge')) { ctx.strokeStyle = mk; ctx.lineWidth = H * 0.12; ely(); ctx.stroke(); }
    });
    ely(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
    line(D, [[ex1, base - H * 0.15], [ex1 - (ex1 - ex0) * 0.55, base - H * 1.02]], D.lw * 0.6, INK);
    if (D.m('lantern')) { ctx.fillStyle = 'rgba(250,230,90,0.35)'; ellPath(ctx, ex0 + 0.03, base - H * 0.1, 0.06, 0.05); ctx.fill(); }
    legs(false);
    // antennae and jaws
    const ant = D.part('antenna'), al = 0.1 * D.p('antenna') * (ant === 'huge' ? 3.2 : ant === 'long' ? 1.8 : ant === 'short' ? 0.5 : 1);
    const a0 = [hx + hr * (shape === 'weevil' ? 1.4 : 0.5), base - H * 0.35 - hr * 0.6];
    if (ant === 'huge') line(D, [a0, [a0[0] - al * 0.3, a0[1] - al * 0.5], [a0[0] - al * 0.8, a0[1] - al * 0.4]], D.lw * 1.2, INK);
    else if (ant === 'elbow') line(D, [a0, [a0[0] + al * 0.2, a0[1] - al * 0.5], [a0[0] + al * 0.7, a0[1] - al * 0.55]], D.lw * 0.9, INK);
    else line(D, [a0, [a0[0] + al * 0.4, a0[1] - al * 0.6], [a0[0] + al * 0.8, a0[1] - al * 0.8]], D.lw * 0.9, INK);
    if (ant === 'club' || ant === 'fan') { const p = [a0[0] + al * 0.8, a0[1] - al * 0.8]; ellPath(ctx, p[0], p[1], 0.014, ant === 'fan' ? 0.022 : 0.012); ctx.fillStyle = INK; ctx.fill(); }
    if (shape === 'stag') for (const dy of [-0.2, 0.25]) { blobPath(ctx, [[hx + hr * 0.6, base - H * 0.35 + hr * dy], [hx + hr * 2.2, base - H * 0.35 + hr * (dy - 0.7)], [hx + hr * 1.9, base - H * 0.35 + hr * dy]]); fillStroke(D, D.c('head', -5)); }
    if (shape === 'tiger') line(D, [[hx + hr * 0.8, base - H * 0.2], [hx + hr * 1.4, base - H * 0.1]], D.lw * 1.5, 'hsl(40,40%,80%)');
    eye(D, hx + hr * 0.35, base - H * 0.4 - hr * 0.1, hr * (shape === 'tiger' ? 0.45 : 0.3));
  };

  // ---------- true bugs and allies ----------
  SK.skeletons.bug = function (D) {
    const ctx = D.ctx, tw = D.tw, kind = D.part('kind');
    const L = 0.72 * D.p('len') * D.p('body') * (kind === 'stick' ? 1.4 : kind === 'aphid' ? 0.7 : 1);
    const H = L * ({ shield: 0.35, cicada: 0.4, aphid: 0.55, hopper: 0.35, mantis: 0.12, stick: 0.06, strider: 0.12, waterbug: 0.25, icecrawler: 0.16 }[kind] || 0.22);
    const leg = 0.1 * D.p('leg') * (kind === 'strider' ? 1.8 : kind === 'assassin' ? 1.2 : kind === 'mantis' ? 1.4 : 1);
    fit(D, L + 0.4, 0.7);
    shadow(D, 0, L * 0.5);
    const base = G - leg * 0.7, x0 = -L * 0.5, x1 = L * 0.3;
    const body = D.c('body'), mk = D.c('mark');
    const legs = far => { for (let i = 0; i < 3; i++) { if (kind === 'mantis' && i === 2) continue; const a = [x1 - (x1 - x0) * (0.05 + i * 0.3) + (far ? 0.02 : 0), base]; const sp = kind === 'strider' ? 0.2 : 0.07; limb(D, [a, [a[0] + (i - 1) * sp * 0.6, a[1] - leg * 0.35], [a[0] + (i - 1) * sp, G]], kind === 'stick' ? 0.01 : 0.013, far ? D.c('body', -12) : D.c('body', -6)); } };
    legs(true);
    // wings (cicada, fishfly, lacewing) behind
    if (kind === 'cicada' || kind === 'fishfly' || kind === 'lacewing' || kind === 'hopper') {
      const wp = () => blobPath(ctx, [[x1 - 0.02, base - H * 0.9], [x0 - L * 0.25, base - H * 1.1], [x0 - L * 0.2, base - H * 0.1], [x1 - 0.05, base - H * 0.3]]);
      wp(); ctx.fillStyle = D.c('wing'); ctx.globalAlpha = kind === 'hopper' ? 1 : 0.6; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 0.8; ctx.stroke();
      if (D.m('veins')) clipTo(D, wp, () => { ctx.strokeStyle = D.c('mark', -10); ctx.lineWidth = D.lw * 0.5; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x1, base - H * 0.6); ctx.lineTo(x0 - L * 0.25, base - H * (0.1 + i * 0.25)); ctx.stroke(); } });
    }
    // body
    let bodyP;
    if (kind === 'shield') bodyP = () => blobPath(ctx, [[x1 + L * 0.05, base - H * 0.6], [x1 - L * 0.1, base - H * 1.3], [x0 + L * 0.1, base - H * 0.6], [x0, base - H * 0.1], [(x0 + x1) / 2, base + H * 0.1], [x1, base]]);
    else if (kind === 'aphid') bodyP = () => ellPath(ctx, (x0 + x1) / 2, base - H * 0.55, L * 0.42, H * 0.6);
    else bodyP = () => ellPath(ctx, (x0 + x1) / 2, base - H * 0.55, L * 0.42, H * 0.55);
    const hr = Math.max(0.03, H * 0.5) * (kind === 'mantis' ? 1.2 : 1) * (kind === 'stick' ? 1.3 : 1);
    const hx = x1 + L * 0.12 + (kind === 'mantis' ? L * 0.2 : 0), hy = base - H * 0.55 - (kind === 'mantis' ? 0.1 : 0);
    const headP = () => { if (kind === 'mantis') blobPath(ctx, [[hx - hr, hy - hr * 0.5], [hx, hy - hr * 0.9], [hx + hr, hy - hr * 0.5], [hx, hy + hr * 0.8]]); else ellPath(ctx, hx, hy, hr, hr * 0.8); };
    const shapes = [{ path: bodyP, fill: body }, { path: headP, fill: D.c('head') }];
    if (kind === 'mantis') shapes.unshift({ path: () => taperPath(ctx, [x1 - 0.02, base - H * 0.5], [x1 + L * 0.08, base - H], [hx - hr * 0.5, hy], 0.03, 0.025, 0.02), fill: body });
    group(D, shapes);
    clipTo(D, bodyP, () => {
      if (D.m('xmark')) { ctx.strokeStyle = mk; ctx.lineWidth = H * 0.25; ctx.beginPath(); ctx.moveTo(x1, base - H); ctx.lineTo(x0, base); ctx.moveTo(x1, base); ctx.lineTo(x0, base - H); ctx.stroke(); }
      if (D.m('edge')) { ctx.strokeStyle = mk; ctx.lineWidth = H * 0.3; bodyP(); ctx.stroke(); }
      if (D.m('band') || D.m('bands')) { ctx.fillStyle = mk; ctx.fillRect((x0 + x1) / 2 - L * 0.04, base - H * 2, L * 0.08, H * 3); }
      if (D.m('speckle') || D.m('spots')) spots(D, x0, base - H * 1.2, x1, base, D.m('spots') ? 8 : 25, H * (D.m('spots') ? 0.12 : 0.05), mk);
      if (D.m('stripes')) { ctx.strokeStyle = mk; ctx.lineWidth = H * 0.18; ctx.beginPath(); ctx.moveTo(x0, base - H * 0.6); ctx.lineTo(x1, base - H * 0.6); ctx.stroke(); }
    });
    legs(false);
    if (kind === 'mantis') limb(D, [[hx - hr * 0.4, hy + hr], [hx + hr * 0.4, hy + hr * 2.2], [hx + hr * 0.9, hy + hr * 0.9]], 0.02, body);
    ctx.fillStyle = D.m('redEye') ? 'hsl(5,70%,48%)' : INK; ellPath(ctx, hx + hr * 0.3, hy - hr * 0.25, hr * (kind === 'cicada' || kind === 'mantis' ? 0.4 : 0.25), hr * 0.3); ctx.fill();
    const al = 0.12 * D.p('antenna') * (kind === 'stick' ? 2 : kind === 'aphid' ? 1.2 : 1);
    if (kind !== 'cicada') line(D, [[hx + hr * 0.5, hy - hr * 0.6], [hx + hr + al * 0.4, hy - hr - al * 0.5], [hx + hr + al, hy - hr - al * 0.3]], D.lw * 0.8, INK);
    if (kind === 'assassin' || kind === 'shield' || kind === 'long' || kind === 'leaffoot') line(D, [[hx + hr * 0.6, hy + hr * 0.4], [hx + hr * 0.2, hy + hr * 1.3]], D.lw, INK);
    if (kind === 'leaffoot') { ellPath(ctx, x0 + L * 0.2, G - 0.03, 0.03, 0.012); fillStroke(D, body); }
    if (kind === 'aphid') for (const dx of [0.0, 0.03]) line(D, [[x0 + L * 0.15 + dx, base - H * 0.9], [x0 + dx, base - H * 1.3]], D.lw * 1.1, INK);
  };

  // ---------- grasshoppers, crickets, katydids ----------
  SK.skeletons.hopper = function (D) {
    const ctx = D.ctx, tw = D.tw, kind = D.part('kind');
    const L = 0.6 * D.p('len') * D.p('body') * (kind === 'pygmy' ? 0.7 : 1), H = L * (kind === 'lubber' || kind === 'jerusalem' ? 0.3 : kind === 'camel' ? 0.28 : 0.2);
    const legL = 0.28 * D.p('leg') * (kind === 'camel' ? 1.3 : kind === 'jerusalem' ? 0.7 : 1);
    fit(D, L + 0.4, 0.75);
    shadow(D, 0, L * 0.5);
    const base = G - 0.07, x0 = -L * 0.45, x1 = L * 0.3;
    const body = D.c('body'), mk = D.c('mark');
    const hump = kind === 'camel' ? H * 0.9 : 0;
    // far hind leg
    const hind = far => {
      const knee = [x0 + L * 0.05 + (far ? 0.02 : 0), base - H - legL * 0.35];
      const thigh = () => taperPath(ctx, [x1 - L * 0.4 + (far ? 0.02 : 0), base - H * 0.3], [x0 + L * 0.3, base - H * 1.2], knee, H * 0.7, H * 0.55, H * 0.2);
      thigh(); fillStroke(D, far ? D.c('body', -12) : body);
      if (!far && (D.m('legBars') || D.m('bands'))) clipTo(D, thigh, () => { ctx.strokeStyle = mk; ctx.lineWidth = H * 0.18; for (let i = 0; i < 3; i++) { const x = x0 + L * (0.15 + i * 0.12); ctx.beginPath(); ctx.moveTo(x, base - H * 2); ctx.lineTo(x + 0.03, base); ctx.stroke(); } });
      limb(D, [knee, [x0 - L * 0.1 + (far ? 0.02 : 0), G - 0.005]], 0.012, far ? D.c('body', -12) : body);
    };
    hind(true);
    for (let i = 0; i < 2; i++) { const a = [x1 - L * 0.15 * (i + 1), base]; limb(D, [a, [a[0] + 0.03, a[1] + 0.03], [a[0] + 0.05 - i * 0.08, G]], 0.012, D.c('body', -6)); }
    // body + wing + head
    const bodyP = () => blobPath(ctx, [[x1, base - H * 0.2], [x1 - L * 0.1, base - H - hump], [x0 + L * 0.2, base - H * 0.9 - hump * 0.6], [x0, base - H * 0.3], [x0 + L * 0.1, base + H * 0.1], [x1, base + H * 0.05]]);
    const hr = H * 0.75 * (kind === 'jerusalem' ? 1.4 : 1);
    const hx = x1 + hr * 0.6, hy = base - H * 0.35;
    const headP = () => kind === 'monkey' || kind === 'hopper' || kind === 'lubber' ? blobPath(ctx, [[hx - hr, hy - hr * 0.8], [hx + hr * 0.5, hy - hr * 0.7], [hx + hr * 0.8, hy + hr * 0.9], [hx - hr * 0.6, hy + hr * 0.6]]) : ellPath(ctx, hx, hy, hr, hr * 0.9);
    group(D, [{ path: bodyP, fill: body }, { path: headP, fill: D.c('head') }]);
    clipTo(D, bodyP, () => {
      if (D.m('bands') && kind !== 'hopper') crossBands(D, [[x0, base - H * 0.5], [x0 + L * 0.15, base - H * 0.5], [x0 + L * 0.3, base - H * 0.5], [x0 + L * 0.45, base - H * 0.5], [x0 + L * 0.6, base - H * 0.5], [x1, base - H * 0.5]], [H * 2, H * 2, H * 2, H * 2, H * 2, H * 2], 1, 1, mk, H * 0.15);
      if (D.m('stripes')) { ctx.strokeStyle = mk; ctx.lineWidth = H * 0.12; ctx.beginPath(); ctx.moveTo(x1, base - H * 0.7); ctx.lineTo(x0, base - H * 0.5); ctx.stroke(); }
      if (D.m('speckle') || D.m('spots')) spots(D, x0, base - H, x1, base, D.m('spots') ? 8 : 25, H * 0.07, mk);
    });
    // folded wing along the back
    if (kind !== 'camel' && kind !== 'jerusalem' && kind !== 'pygmy' && kind !== 'monkey') {
      const wp = () => blobPath(ctx, [[x1 - L * 0.12, base - H * 0.85], [x0 - L * (kind === 'katydid' ? 0.15 : 0.08), base - H * 0.75], [x0 - L * 0.05, base - H * 0.35], [x1 - L * 0.15, base - H * 0.4]]);
      wp(); fillStroke(D, D.c('wing'));
      if (D.m('hindFlash')) clipTo(D, wp, () => { ctx.fillStyle = D.c('wing', 5, 10); ctx.fillRect(x0 - L * 0.2, base - H * 0.6, L * 0.3, H * 0.3); });
      if (D.m('bands') && kind === 'hopper') clipTo(D, wp, () => { ctx.fillStyle = mk; ctx.fillRect(x0 + L * 0.2, base - H, L * 0.06, H); });
    }
    if (kind === 'shieldback') { blobPath(ctx, [[x1 + 0.01, base - H * 0.3], [x1 - L * 0.05, base - H * 1.4], [x1 - L * 0.3, base - H * 1.2], [x1 - L * 0.3, base - H * 0.4]]); fillStroke(D, D.c('body', -6)); }
    hind(false);
    ctx.fillStyle = INK; ellPath(ctx, hx + hr * 0.1, hy - hr * 0.3, hr * 0.25, hr * 0.3); ctx.fill();
    const al = 0.15 * D.p('antenna') * (kind === 'katydid' || kind === 'cricket' || kind === 'camel' ? 2.2 : 1);
    line(D, [[hx + hr * 0.2, hy - hr * 0.7], [hx + al * 0.4, hy - hr - al * 0.4], [hx - al * 0.2 + (al > 0.2 ? al : al * 0.9), hy - hr - al * (al > 0.2 ? 0.2 : 0.7)]], D.lw * 0.8, INK);
  };

  // ---------- flies ----------
  SK.skeletons.fly = function (D) {
    const ctx = D.ctx, tw = D.tw, kind = D.part('kind');
    const L = 0.48 * D.p('len') * D.p('body') * (kind === 'robber' ? 1.2 : 1), thin = kind === 'crane' || kind === 'mosquito' || kind === 'robber';
    const legL = 0.13 * D.p('leg') * (thin ? 1.8 : 1);
    fit(D, L + 0.4, 0.8);
    shadow(D, 0, L * 0.45);
    const cy = G - legL * 0.8 - 0.05;
    const thr = L * (thin ? 0.14 : 0.2), thx = 0.02;
    const abL = L * (thin ? 0.6 : 0.5), abH = abL * (thin ? 0.25 : kind === 'hover' ? 0.42 : 0.55), ax = thx - thr - abL * 0.42;
    const body = D.c('body');
    // wings
    const wp = () => blobPath(ctx, [[thx, cy - thr * 0.6], [thx - L * 0.15, cy - thr * 1.8], [thx - L * (thin ? 0.8 : 0.65), cy - thr * 1.4], [thx - L * 0.2, cy - thr * 0.4]]);
    wp(); ctx.fillStyle = D.c('wing'); ctx.globalAlpha = kind === 'lovebug' || kind === 'beefly' ? 0.85 : 0.55; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 0.7; ctx.stroke();
    if (D.m('wingSpot')) clipTo(D, wp, () => { ctx.fillStyle = D.c('mark'); ellPath(ctx, thx - L * 0.35, cy - thr * 1.4, L * 0.08, thr * 0.3); ctx.fill(); });
    for (let i = 0; i < 3; i++) { const a = [thx - thr * 0.5 + i * thr * 0.5, cy + thr * 0.5]; limb(D, [a, [a[0] + (i - 1) * 0.05, a[1] + legL * 0.4], [a[0] + (i - 1) * 0.1, G]], 0.01, D.c('body', -10)); }
    const abP = () => ellPath(ctx, ax, cy + thr * 0.1, abL * 0.5, abH * 0.5, 0.1);
    const thP = () => ellPath(ctx, thx, cy, thr, thr * 0.9);
    const hr = thr * 0.8, hx = thx + thr + hr * 0.6;
    const hdP = () => ellPath(ctx, hx, cy, hr, hr);
    group(D, [{ path: abP, fill: body }, { path: thP, fill: body }, { path: hdP, fill: body }]);
    clipTo(D, abP, () => {
      if (D.m('bands')) { ctx.fillStyle = D.c('mark'); for (let i = 0; i < 3; i++) ctx.fillRect(ax + abL * 0.3 - i * abL * 0.28, cy - abH, abL * 0.1, abH * 2); }
      if (D.m('metal') || D.m('shine')) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ellPath(ctx, ax, cy - abH * 0.15, abL * 0.2, abH * 0.1); ctx.fill(); }
      if (D.m('fuzz')) spots(D, ax - abL * 0.5, cy - abH * 0.5, ax + abL * 0.5, cy + abH * 0.5, 20, 0.004, 'hsl(40,40%,80%)');
    });
    clipTo(D, thP, () => {
      if (D.m('stripes')) { ctx.strokeStyle = D.c('mark'); ctx.lineWidth = thr * 0.12; for (const dy of [-0.35, 0]) { ctx.beginPath(); ctx.moveTo(thx - thr, cy + dy * thr); ctx.lineTo(thx + thr, cy + dy * thr - 0.01); ctx.stroke(); } }
      if (D.m('thorax')) { ctx.fillStyle = D.c('mark'); ctx.fillRect(thx - thr, cy - thr, thr * 2, thr * 1.2); }
      if (D.m('bristles')) spots(D, thx - thr, cy - thr, thx + thr, cy, 10, 0.004, INK);
    });
    ctx.fillStyle = D.c('eye'); ellPath(ctx, hx + hr * 0.2, cy - hr * 0.1, hr * (kind === 'horse' || kind === 'hover' || kind === 'house' || kind === 'drone' ? 0.75 : 0.5), hr * 0.8); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 0.6; ctx.stroke();
    if (kind === 'mosquito' || kind === 'robber' || kind === 'beefly') line(D, [[hx + hr * 0.8, cy + hr * 0.3], [hx + hr * 0.8 + (kind === 'robber' ? 0.03 : 0.08), cy + hr * (kind === 'beefly' ? 0.4 : 0.8)]], D.lw, INK);
    else line(D, [[hx + hr * 0.5, cy + hr * 0.7], [hx + hr * 0.6, cy + hr * 1.3]], D.lw * 1.3, INK);
  };

  // ---------- spiders and scorpions ----------
  SK.skeletons.spider = function (D) {
    const ctx = D.ctx, tw = D.tw, kind = D.part('kind');
    const ab = 0.12 * D.p('abdomen') * D.p('body') * (kind === 'orb' || kind === 'widow' ? 1.15 : kind === 'cellar' ? 0.8 : 1);
    const legL = 0.34 * D.p('leg') * (kind === 'cellar' || kind === 'harvestman' ? 1.3 : kind === 'jumper' ? 0.85 : 1);
    const ceph = 0.09 * D.p('body') * (kind === 'tarantula' ? 1.3 : kind === 'harvestman' || kind === 'mite' ? 0 : 1);
    fit(D, legL * 2.5 + 0.1, legL * 0.9 + 0.3);
    shadow(D, 0, 0.3);
    const legC = D.c('leg'), mk = D.c('mark');
    if (kind === 'scorpion') return scorpion(D);
    const cy = G - legL * 0.35 - (kind === 'cellar' || kind === 'harvestman' ? 0.08 : 0);
    const cx = 0.07, ax = kind === 'harvestman' || kind === 'mite' ? 0 : cx - ceph - ab * 0.85;
    const legW = kind === 'tarantula' ? 0.036 : kind === 'cellar' || kind === 'harvestman' ? 0.011 : 0.022;
    const legs = far => {
      for (let i = 0; i < 4; i++) {
        const dir = i < 2 ? 1 : -1, spread = kind === 'crab' ? 1.2 : 1;
        const a = [cx + (i - 1.5) * 0.02 + (far ? 0.015 : 0), cy];
        const knee = [a[0] + dir * legL * (0.35 + 0.1 * (i % 2)) * spread, cy - legL * (kind === 'cellar' || kind === 'harvestman' ? 0.8 : 0.45) + (far ? 0.03 : 0)];
        const foot = [a[0] + dir * legL * (0.7 + 0.25 * (i === 0 || i === 3 ? 1 : 0)) * spread, G];
        limb(D, [a, knee, foot], legW, far ? D.c('leg', -12) : legC);
        if (!far && D.m('legBands')) { const m = [(knee[0] + foot[0]) / 2, (knee[1] + foot[1]) / 2]; line(D, [[m[0] - 0.008, m[1] - 0.01], [m[0] + 0.008, m[1] + 0.01]], legW * 1.2, mk); }
      }
    };
    legs(true);
    const abP = () => kind === 'long' ? ellPath(ctx, ax - ab * 0.2, cy - ab * 0.1, ab * 1.3, ab * 0.5, -0.15) : ellPath(ctx, ax, cy - ab * 0.35, ab, ab * (kind === 'crab' ? 0.8 : 0.88), -0.2);
    const ceP = () => ellPath(ctx, cx, cy - ceph * 0.2, ceph, ceph * 0.75);
    const shapes = [{ path: abP, fill: D.c('abdomen') }];
    if (ceph > 0) shapes.push({ path: ceP, fill: D.c('body') });
    group(D, shapes);
    clipTo(D, abP, () => {
      if (D.m('chevrons')) { ctx.strokeStyle = mk; ctx.lineWidth = ab * 0.1; for (let i = 0; i < 4; i++) { const x = ax + ab * 0.5 - i * ab * 0.35; ctx.beginPath(); ctx.moveTo(x, cy - ab * 1.2); ctx.lineTo(x - ab * 0.2, cy - ab * 0.4); ctx.lineTo(x, cy + ab * 0.4); ctx.stroke(); } }
      if (D.m('stripes')) { ctx.strokeStyle = mk; ctx.lineWidth = ab * 0.18; for (const dy of [-0.8, -0.2]) { ctx.beginPath(); ctx.moveTo(ax + ab, cy + ab * dy); ctx.lineTo(ax - ab * 1.2, cy + ab * (dy + 0.4)); ctx.stroke(); } }
      if (D.m('bands')) { ctx.fillStyle = mk; for (let i = 0; i < 3; i++) ctx.fillRect(ax + ab * 0.5 - i * ab * 0.55, cy - ab * 1.5, ab * 0.18, ab * 2.2); }
      if (D.m('spots')) spots(D, ax - ab * 0.6, cy - ab, ax + ab * 0.6, cy, (tw.marks.count || 6), ab * 0.12, mk);
      if (D.m('cross')) { ctx.strokeStyle = WHITE; ctx.lineWidth = ab * 0.1; ctx.beginPath(); ctx.moveTo(ax - ab * 0.3, cy - ab * 0.4); ctx.lineTo(ax + ab * 0.3, cy - ab * 0.4); ctx.moveTo(ax, cy - ab * 0.9); ctx.lineTo(ax, cy + ab * 0.1); ctx.stroke(); }
      if (D.m('hourglass')) { ctx.fillStyle = mk; ctx.beginPath(); ctx.moveTo(ax - ab * 0.3, cy + ab * 0.2); ctx.lineTo(ax + ab * 0.3, cy + ab * 0.55); ctx.lineTo(ax + ab * 0.3, cy + ab * 0.2); ctx.lineTo(ax - ab * 0.3, cy + ab * 0.55); ctx.closePath(); ctx.fill(); }
      if (D.m('mottle')) spots(D, ax - ab, cy - ab, ax + ab, cy + ab * 0.3, 10, ab * 0.18, mk);
      if (D.m('hairs')) spots(D, ax - ab, cy - ab, ax + ab, cy + ab * 0.5, 20, 0.004, 'hsl(35,30%,70%)');
      if (D.m('iridescent')) { ctx.fillStyle = 'hsl(160,60%,50%)'; ellPath(ctx, cx, cy, 0.1, 0.1); }
      if (D.m('collar')) { ctx.fillStyle = mk; ctx.fillRect(ax + ab * 0.5, cy - ab * 1.5, ab * 0.2, ab * 2); }
    });
    if (D.m('spines')) for (let i = 0; i < 2; i++) { blobPath(ctx, [[ax - ab * 0.4 + i * ab * 0.8 - 0.01, cy - ab * 1.1], [ax - ab * 0.4 + i * ab * 0.8, cy - ab * 1.45], [ax - ab * 0.4 + i * ab * 0.8 + 0.01, cy - ab * 1.1]]); fillStroke(D, mk, D.lw * 0.6); }
    legs(false);
    if (ceph > 0) {
      const ex = cx + ceph * 0.7, ey = cy - ceph * 0.35;
      if (kind === 'jumper') { eye(D, ex, ey, ceph * 0.28); eye(D, ex - ceph * 0.45, ey - ceph * 0.35, ceph * 0.13); }
      else { ctx.fillStyle = INK; for (const [dx, dy] of [[0, 0], [-0.3, -0.25], [-0.15, 0.1]]) { ellPath(ctx, ex + dx * ceph, ey + dy * ceph, ceph * 0.1, ceph * 0.1); ctx.fill(); } }
      limb(D, [[cx + ceph * 0.8, cy + ceph * 0.2], [cx + ceph * 1.3, cy + ceph * 0.3]], 0.014, legC);
    } else { eye(D, ax + ab * 0.3, cy - ab * 0.7, 0.012); }
  };
  function scorpion(D) {
    const ctx = D.ctx, mk = D.c('mark'), body = D.c('body'), legC = D.c('leg');
    const cy = G - 0.05;
    for (let i = 0; i < 4; i++) { const a = [0.05 - i * 0.05, cy]; limb(D, [a, [a[0] + 0.02 - i * 0.01, cy - 0.04], [a[0] + 0.05 - i * 0.03, G]], 0.012, D.c('leg', -8)); }
    // tail arching over the back
    const c = [[-0.14, cy - 0.01], [-0.26, cy - 0.04], [-0.32, cy - 0.14], [-0.28, cy - 0.26], [-0.18, cy - 0.32], [-0.09, cy - 0.28]];
    const w = [0.05, 0.045, 0.042, 0.04, 0.036, 0.03];
    const tp = () => { ctx.beginPath(); smooth(ctx, tubePts(c, w), true); };
    tp(); fillStroke(D, body);
    clipTo(D, tp, () => crossBands(D, c, w, 1, 1, D.c('body', -12), D.lw * 0.8));
    blobPath(ctx, [[-0.1, cy - 0.3], [-0.03, cy - 0.28], [-0.06, cy - 0.22]]); fillStroke(D, 'hsl(20,40%,30%)');
    const bp = () => ellPath(ctx, -0.02, cy - 0.015, 0.14, 0.045);
    bp(); fillStroke(D, body);
    clipTo(D, bp, () => { if (D.m('stripes')) { ctx.fillStyle = mk; ctx.fillRect(-0.16, cy - 0.05, 0.3, 0.02); } crossBands(D, [[-0.13, cy], [-0.08, cy], [-0.03, cy], [0.02, cy], [0.07, cy], [0.12, cy]], [0.1, 0.1, 0.1, 0.1, 0.1, 0.1], 1, 1, D.c('body', -12), D.lw * 0.7); });
    limb(D, [[0.1, cy - 0.01], [0.18, cy - 0.04], [0.23, cy - 0.01]], 0.02, legC);
    blobPath(ctx, [[0.22, cy - 0.03], [0.32, cy - 0.06], [0.33, cy], [0.25, cy + 0.02]]); fillStroke(D, legC);
    ctx.fillStyle = INK; ellPath(ctx, 0.09, cy - 0.04, 0.008, 0.008); ctx.fill();
  }

  // ---------- crustaceans ----------
  SK.skeletons.crust = function (D) {
    const ctx = D.ctx, tw = D.tw, kind = D.part('kind');
    const L = 0.6 * D.p('len'), body = D.c('body'), claw = D.c('claw'), mk = D.c('mark');
    fit(D, L + 0.45, 0.6);
    shadow(D, 0, L * 0.5);
    if (kind === 'isopod') {
      const H = 0.13 * (D.m('roll') ? 1.3 : 1), cy = G - 0.02;
      for (let i = 0; i < 5; i++) limb(D, [[-L * 0.3 + i * L * 0.13, cy - 0.02], [-L * 0.33 + i * L * 0.13, G]], 0.01, D.c('body', -12));
      const bp = () => { ctx.beginPath(); ctx.moveTo(-L * 0.45, cy); ctx.bezierCurveTo(-L * 0.45, cy - H * 1.4, L * 0.4, cy - H * 1.4, L * 0.4, cy); ctx.closePath(); };
      bp(); fillStroke(D, body);
      clipTo(D, bp, () => {
        ctx.strokeStyle = D.c('body', -14); ctx.lineWidth = D.lw * 0.8;
        for (let i = 1; i < 8; i++) { const x = -L * 0.45 + i * L * 0.11; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + 0.01, cy - H * 1.2); ctx.stroke(); }
        if (D.m('spots') || D.m('speckle')) spots(D, -L * 0.45, cy - H, L * 0.4, cy, D.m('spots') ? 10 : 25, H * 0.07, mk);
        if (D.m('stripe') || D.m('bands')) { ctx.fillStyle = mk; ctx.fillRect(-L * 0.45, cy - H * 0.9, L, H * 0.15); }
      });
      const al = 0.1 * D.p('antenna');
      line(D, [[L * 0.38, cy - H * 0.3], [L * 0.38 + al * 0.6, cy - H * 0.3 - al * 0.6], [L * 0.38 + al, cy - H * 0.2 - al * 0.2]], D.lw, INK);
      ctx.fillStyle = INK; ellPath(ctx, L * 0.33, cy - H * 0.45, 0.009, 0.009); ctx.fill();
      return;
    }
    // crayfish, lobster, shrimp, amphipod: a segmented body along a curve
    const curl = kind === 'amphipod' ? 0.9 : kind === 'shrimp' ? 0.5 : 0.15;
    const n = 9, c = [], w = [];
    const th = kind === 'amphipod' ? 0.09 : kind === 'shrimp' ? 0.1 : 0.12;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = Math.PI - curl * Math.PI * (1 - t) * 0.9;
      const r = L * 0.5;
      c.push([Math.cos(a) * r * (1 - t) + t * L * 0.3 - (1 - t) * 0.0, G - 0.07 - Math.sin(a) * r * curl * 0.5 * (1 - t) - t * 0.02]);
      w.push(th * (t < 0.3 ? 0.55 + 1.5 * t : t > 0.85 ? 1.1 : 1));
    }
    for (let i = 1; i < n; i += 2) limb(D, [[c[i][0], c[i][1] + w[i] * 0.3], [c[i][0] - 0.01, G]], 0.01, D.c('body', -12));
    if (kind !== 'amphipod' && kind !== 'shrimp') { blobPath(ctx, [[c[0][0] + 0.02, c[0][1]], [c[0][0] - 0.06, c[0][1] - 0.04], [c[0][0] - 0.07, c[0][1] + 0.03]]); fillStroke(D, body); }
    const bp = () => { ctx.beginPath(); smooth(ctx, tubePts(c, w), true); };
    bp(); fillStroke(D, body);
    clipTo(D, bp, () => {
      crossBands(D, c, w, 1, 1, D.c('body', -14), D.lw * 0.7);
      if (D.m('bands')) crossBands(D, c, w, 2, 3, mk, th * 0.25);
      if (D.m('spots') || D.m('speckle')) spots(D, -L * 0.5, G - 0.2, L * 0.4, G, D.m('spots') ? 12 : 30, th * (D.m('spots') ? 0.12 : 0.05), mk);
      if (D.m('stripe')) { ctx.strokeStyle = mk; ctx.lineWidth = th * 0.15; ctx.beginPath(); smooth(ctx, c.map((q, i) => [q[0], q[1] - w[i] * 0.2]), false); ctx.stroke(); }
    });
    const hd = c[n];
    const al = 0.2 * D.p('antenna') * (kind === 'lobster' || kind === 'shrimp' ? 1.6 : 1);
    line(D, [[hd[0] + 0.02, hd[1] - th * 0.3], [hd[0] + al * 0.5, hd[1] - al * 0.5], [hd[0] + al, hd[1] - al * 0.2]], D.lw, INK);
    line(D, [[hd[0] + 0.02, hd[1] - th * 0.2], [hd[0] + al * 0.3, hd[1] - al * 0.8], [hd[0] + al * 0.5, hd[1] - al]], D.lw * 0.8, INK);
    if (kind === 'crayfish' && D.p('claw') > 0) {
      const ck = D.p('claw');
      limb(D, [[hd[0] - 0.02, hd[1] + th * 0.2], [hd[0] + 0.06, hd[1] + th * 0.5], [hd[0] + 0.1, hd[1] + th * 0.1]], 0.02, claw);
      const cp = () => blobPath(ctx, [[hd[0] + 0.09, hd[1] + th * 0.25], [hd[0] + 0.1 + 0.12 * ck, hd[1] - th * 0.3], [hd[0] + 0.14 + 0.1 * ck, hd[1] + th * 0.05], [hd[0] + 0.1 + 0.1 * ck, hd[1] + th * 0.45]]);
      cp(); fillStroke(D, claw);
      if (D.m('clawTip')) clipTo(D, cp, () => { ctx.fillStyle = mk; ellPath(ctx, hd[0] + 0.14 + 0.1 * ck, hd[1], 0.04, 0.04); ctx.fill(); });
    }
    if (!D.m('blind')) { ctx.fillStyle = INK; ellPath(ctx, hd[0] + 0.005, hd[1] - th * 0.4, 0.01, 0.01); ctx.fill(); }
  };

  // ---------- snails and slugs ----------
  SK.skeletons.snail = function (D) {
    const ctx = D.ctx, tw = D.tw, kind = D.part('kind');
    fit(D, 0.9, 0.6);
    shadow(D, 0, 0.3);
    const sh = D.c('shell'), body = D.c('body'), mk = D.c('mark');
    const foot = () => blobPath(ctx, [[-0.3, G], [-0.25, G - 0.06], [0.2, G - 0.07], [0.33, G - 0.12], [0.37, G - 0.08], [0.3, G]]);
    foot(); fillStroke(D, body);
    const fl = D.p('foot');
    if (kind !== 'abalone' && kind !== 'limpet') {
      for (const dx of [0, 0.03]) line(D, [[0.33 + dx * 0.3, G - 0.11], [0.37 + dx, G - 0.19 - dx]], D.lw * 1.2, body);
      ctx.fillStyle = INK; ellPath(ctx, 0.4, G - 0.2, 0.01, 0.01); ctx.fill();
    }
    const s = 0.2 * D.p('shell');
    if (kind === 'slug') {
      foot(); fillStroke(D, body);
      const mp = () => ellPath(ctx, 0.05, G - 0.07, 0.15, 0.05);
      mp(); fillStroke(D, D.c('body', -8));
      clipTo(D, foot, () => { if (D.m('stripes')) { ctx.strokeStyle = mk; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.3, G - 0.035); ctx.lineTo(0.3, G - 0.05); ctx.stroke(); } if (D.m('mottle') || D.m('speckle') || D.m('spots')) spots(D, -0.3, G - 0.12, 0.35, G, D.m('mottle') ? 10 : 25, D.m('mottle') ? 0.02 : 0.006, mk); });
      return;
    }
    let shellP, cx = -0.02, cy = G - 0.07 - s * 0.8;
    if (kind === 'tall' || kind === 'leftTall') {
      const sp = D.p('spire');
      shellP = () => blobPath(ctx, [[cx - s * 0.6, G - 0.06], [cx - s * 0.7, cy], [cx - s * 0.2 * (kind === 'leftTall' ? -1 : 1), cy - s * 1.2 * sp], [cx + s * 0.5, cy + s * 0.1], [cx + s * 0.4, G - 0.06]]);
    } else if (kind === 'flat') shellP = () => ellPath(ctx, cx, G - 0.07 - s * 0.55, s * 0.9, s * 0.55);
    else if (kind === 'abalone') { cy = G - 0.05; shellP = () => { ctx.beginPath(); ctx.moveTo(-0.32, G - 0.04); ctx.bezierCurveTo(-0.3, G - 0.2 * D.p('spire'), 0.3, G - 0.18 * D.p('spire'), 0.32, G - 0.04); ctx.closePath(); }; }
    else if (kind === 'limpet') { shellP = () => { ctx.beginPath(); ctx.moveTo(-0.25, G - 0.04); ctx.quadraticCurveTo(0.05, G - 0.35, 0.25, G - 0.04); ctx.closePath(); }; }
    else shellP = () => ellPath(ctx, cx, cy, s, s * 0.88);
    shellP(); fillStroke(D, sh);
    clipTo(D, shellP, () => {
      if (kind === 'round' || kind === 'flat') { ctx.strokeStyle = D.c('shell', -18); ctx.lineWidth = D.lw * 0.8; ctx.beginPath(); for (let a = 0; a < 5 * Math.PI; a += 0.2) { const r = s * 0.9 * (1 - a / (5.2 * Math.PI)); const x = cx + Math.cos(a) * r * (kind === 'flat' ? 0.95 : 1), y = (kind === 'flat' ? G - 0.07 - s * 0.55 : cy) + Math.sin(a) * r * (kind === 'flat' ? 0.55 : 0.88); a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
      if (kind === 'tall' || kind === 'leftTall') { ctx.strokeStyle = D.c('shell', -18); ctx.lineWidth = D.lw * 0.8; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(cx - s, cy + s * 0.4 - i * s * 0.3); ctx.lineTo(cx + s, cy + s * 0.6 - i * s * 0.3); ctx.stroke(); } }
      if (D.m('bands')) { ctx.strokeStyle = mk; ctx.lineWidth = s * 0.12; ellPath(ctx, cx, cy, s * 0.65, s * 0.55); ctx.stroke(); }
      if (D.m('stripes') || D.m('ribs')) { ctx.strokeStyle = mk; ctx.lineWidth = s * 0.07; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - s + i * s * 0.35, G); ctx.lineTo(cx - s * 0.8 + i * s * 0.35, cy - s * 1.5); ctx.stroke(); } }
      if (D.m('spots') || D.m('speckle') || D.m('mottle')) spots(D, cx - s, cy - s * 1.2, cx + s, G, D.m('mottle') ? 10 : 20, s * (D.m('mottle') ? 0.15 : 0.05), mk);
      if (D.m('holes')) { ctx.fillStyle = INK; for (let i = 0; i < 5; i++) { ellPath(ctx, -0.2 + i * 0.07, G - 0.1 - Math.sin(i / 4 * Math.PI) * 0.03, 0.01, 0.008); ctx.fill(); } }
    });
    shellP(); ctx.strokeStyle = INK; ctx.lineWidth = D.lw; ctx.stroke();
    if (D.m('lip')) { ellPath(ctx, cx + s * 0.6, cy + s * 0.5, s * 0.22, s * 0.14); fillStroke(D, WHITE, D.lw * 0.7); }
  };

  // ---------- worms and leeches ----------
  SK.skeletons.worm = function (D) {
    const ctx = D.ctx, kind = D.part('kind');
    const len = D.p('len'), th = 0.055 * D.p('thick') * (kind === 'leech' ? 1.3 : 1);
    fit(D, len * 0.95 + 0.1, 0.4);
    shadow(D, 0, 0.35 * len);
    const n = 30, c = [], w = [];
    for (let i = 0; i <= n; i++) { const t = i / n; c.push([(-0.42 + 0.84 * t) * len, G - th * 0.55 - Math.sin(t * Math.PI * 2 + 1) * 0.05 - (t > 0.85 ? (t - 0.85) * 0.5 : 0)]); w.push(th * (kind === 'leech' ? 0.6 + 0.4 * Math.sin(t * Math.PI) : t < 0.1 ? 0.5 + 5 * t : t > 0.92 ? 0.8 : 1)); }
    const bp = () => { ctx.beginPath(); smooth(ctx, tubePts(c, w), true); };
    bp(); fillStroke(D, D.c('body'));
    clipTo(D, bp, () => {
      crossBands(D, c, w, 1, 1, D.c('body', -8), D.lw * 0.4);
      if (D.m('clitellum')) crossBands(D, c, w, Math.round(n * 0.68), 100, D.c('mark'), th * 1.2 * Math.min(1.4, D.m('clitellum')));
      if (D.m('bands')) crossBands(D, c, w, 2, 3, D.c('mark'), th * 0.3);
      if (D.m('stripes')) { ctx.strokeStyle = D.c('mark'); ctx.lineWidth = th * 0.15; ctx.beginPath(); smooth(ctx, c.map((q, i) => [q[0], q[1] - w[i] * 0.15]), false); ctx.stroke(); }
      if (D.m('spots')) spots(D, -0.45 * len, G - 0.2, 0.45 * len, G, 15, th * 0.12, D.c('mark'));
    });
  };

  // ---------- plants ----------
  const leafShape = (D, x, y, len, ang, kind, fill) => {
    const ctx = D.ctx;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const w = kind === 'lance' || kind === 'strap' ? 0.22 : kind === 'round' || kind === 'heart' ? 0.55 : kind === 'broad' ? 0.5 : 0.38;
    if (kind === 'compound' || kind === 'frond') {
      line(D, [[0, 0], [len, 0]], D.lw * 0.8, INK);
      for (let i = 1; i <= 4; i++) for (const s of [-1, 1]) { ellPath(ctx, len * i / 4.5, s * len * 0.12, len * 0.1, len * 0.05, s * 0.5); fillStroke(D, fill, D.lw * 0.6); }
    } else if (kind === 'lobed') { blobPath(ctx, [[0, 0], [len * 0.3, -len * 0.3], [len * 0.45, -len * 0.1], [len * 0.7, -len * 0.25], [len, 0], [len * 0.7, len * 0.25], [len * 0.45, len * 0.1], [len * 0.3, len * 0.3]]); fillStroke(D, fill, D.lw * 0.8); }
    else { blobPath(ctx, [[0, 0], [len * 0.35, -len * w * 0.5], [len, 0], [len * 0.35, len * w * 0.5]].concat(kind === 'heart' ? [[len * 0.05, len * 0.2]] : [])); fillStroke(D, fill, D.lw * 0.8); }
    ctx.restore();
  };

  function flowerHead(D, x, y, r, kind) {
    const ctx = D.ctx, fc = D.c('flower'), cc = D.c('center');
    const petals = (n, pl, pw, color, rot0) => { for (let k = 0; k < n; k++) { const a = rot0 + (k / n) * TAU; ellPath(ctx, x + Math.cos(a) * r * pl * 0.55, y + Math.sin(a) * r * pl * 0.55, r * pl * 0.55, r * pw, a); fillStroke(D, color, D.lw * 0.6); } };
    switch (kind) {
      case 'daisy': case 'sun': petals(kind === 'sun' ? 14 : 10, 1, 0.22, fc, 0); ellPath(ctx, x, y, r * 0.38, r * 0.38); fillStroke(D, cc, D.lw * 0.6); break;
      case 'cone': for (let k = 0; k < 8; k++) { const a = 0.3 + (k / 8) * Math.PI * 0.8 + Math.PI * 0.1; ellPath(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.55 + r * 0.2, r * 0.6, r * 0.14, a); fillStroke(D, fc, D.lw * 0.6); } ellPath(ctx, x, y - r * 0.1, r * 0.35, r * 0.5); fillStroke(D, cc, D.lw * 0.6); break;
      case 'star': case 'cross': case 'violet': petals(kind === 'cross' ? 4 : 5, 0.9, 0.3, fc, -Math.PI / 2); ellPath(ctx, x, y, r * 0.18, r * 0.18); ctx.fillStyle = cc; ctx.fill(); break;
      case 'star3': petals(3, 1.1, 0.35, fc, -Math.PI / 2); break;
      case 'cup': case 'lily': case 'passion': petals(5, 0.95, 0.45, fc, -Math.PI / 2); ellPath(ctx, x, y, r * 0.25, r * 0.25); ctx.fillStyle = cc; ctx.fill(); break;
      case 'bell': case 'tube': case 'trumpet': case 'slipper': case 'pipe': case 'orchid': {
        const flare = kind === 'trumpet' ? 0.9 : kind === 'tube' ? 0.4 : 0.65;
        blobPath(ctx, [[x - r * 0.25, y - r * 0.6], [x + r * 0.25, y - r * 0.6], [x + r * flare, y + r * 0.7], [x, y + r * 0.5], [x - r * flare, y + r * 0.7]]); fillStroke(D, fc, D.lw * 0.7);
        if (kind === 'slipper' || kind === 'orchid') { ellPath(ctx, x, y + r * 0.5, r * 0.4, r * 0.35); fillStroke(D, D.c('center'), D.lw * 0.6); }
        break;
      }
      case 'pea': for (let k = 0; k < 5; k++) { ellPath(ctx, x, y - r * 1.2 + k * r * 0.55, r * 0.35, r * 0.25); fillStroke(D, fc, D.lw * 0.5); } break;
      case 'spike': case 'plume': for (let k = 0; k < 7; k++) { ellPath(ctx, x + (kind === 'plume' ? k * r * 0.1 : 0), y - r * 1.4 + k * r * 0.4, r * (0.3 - k * 0.01), r * 0.2); fillStroke(D, fc, D.lw * 0.5); } break;
      case 'umbel': case 'globe': case 'cluster': case 'tiny': {
        const n = kind === 'tiny' ? 5 : 9, rr = kind === 'globe' ? r * 0.25 : r * 0.2;
        for (let k = 0; k < n; k++) { const a = (k / n) * TAU; const dx = Math.cos(a) * r * 0.7, dy = kind === 'umbel' ? -Math.abs(Math.sin(a)) * r * 0.25 : Math.sin(a) * r * 0.6; if (kind === 'umbel') line(D, [[x, y + r * 0.6], [x + dx, y + dy]], D.lw * 0.4, D.c('stem')); ellPath(ctx, x + dx, y + dy, rr, rr); fillStroke(D, fc, D.lw * 0.5); }
        if (kind !== 'umbel') { ellPath(ctx, x, y, rr, rr); fillStroke(D, fc, D.lw * 0.5); }
        break;
      }
      case 'thistle': ellPath(ctx, x, y + r * 0.3, r * 0.4, r * 0.4); fillStroke(D, D.c('leaf')); ctx.strokeStyle = fc; ctx.lineWidth = r * 0.12; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + k * r * 0.15, y - r * 0.7); ctx.stroke(); } break;
      case 'iris': petals(3, 1, 0.4, fc, Math.PI / 2); petals(3, 0.7, 0.2, D.c('center'), -Math.PI / 2); break;
      case 'spathe': blobPath(ctx, [[x, y + r * 0.6], [x - r * 0.5, y - r * 0.2], [x, y - r * 1.1], [x + r * 0.5, y - r * 0.2]]); fillStroke(D, fc, D.lw * 0.7); line(D, [[x, y + r * 0.4], [x + r * 0.1, y - r * 0.5]], r * 0.18, D.c('center')); break;
      default: break;
    }
  }

  SK.skeletons.plant = function (D) {
    const fn = PLANTS[D.tw.tpl];
    if (fn) fn(D);
  };
  const PLANTS = {
    forb(D) {
      const ctx = D.ctx, tw = D.tw;
      const h = 0.62 * D.p('height'), n = tw.parts.count || 1, fr = 0.07 * D.p('flowerSize');
      fit(D, 0.8, h + 0.2);
      shadow(D, 0, 0.18);
      const leafC = D.c('leaf'), stem = D.c('stem');
      const leaf = tw.parts.leaf;
      if (leaf === 'strap' || leaf === 'frond') for (let k = -2; k <= 2; k++) leafShape(D, 0, G, h * 0.55 * D.p('leafSize'), -Math.PI / 2 + k * 0.35, leaf === 'frond' ? 'frond' : 'lance', leafC);
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.13, top = G - h * (1 - 0.12 * Math.abs(i - (n - 1) / 2)), bend = (i - (n - 1) / 2) * 0.06;
        line(D, [[x * 0.4, G], [x + bend * 0.3, (G + top) / 2], [x + bend, top]], D.lw * 2.4, INK);
        line(D, [[x * 0.4, G], [x + bend * 0.3, (G + top) / 2], [x + bend, top]], D.lw * 1.2, stem);
        if (leaf !== 'strap' && leaf !== 'frond') for (let j = 0; j < 3; j++) { const y = G - h * (0.15 + j * 0.25), ll = 0.13 * D.p('leafSize') * (1 - j * 0.2); leafShape(D, x * 0.4 + bend * 0.2 * j, y, ll, j % 2 ? -2.6 : -0.5, leaf, leafC); }
        if (tw.parts.flower !== 'none') flowerHead(D, x + bend, top, fr, tw.parts.flower);
        else { ellPath(ctx, x + bend, top, fr * 0.4, fr * 0.8); fillStroke(D, D.c('leaf', 10)); }
      }
      if (D.m('spots') || D.m('stripe') || D.m('variegated') || D.m('center')) { ctx.fillStyle = D.c('mark'); for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 0.13 * 1.45; ellPath(ctx, x, G - h * 0.98, fr * 0.12, fr * 0.12); ctx.fill(); } }
    },
    grass(D) {
      const ctx = D.ctx, tw = D.tw;
      const h = 0.62 * D.p('height'), hd = D.part('head'), bw = 0.022 * D.p('blade');
      fit(D, 0.8, h + 0.15);
      shadow(D, 0, 0.2);
      const leaf = D.c('leaf'), headC = D.c('head');
      const spread = tw.parts.clump === 'spread' ? 1.4 : 1;
      for (let k = -4; k <= 4; k++) {
        const a = k * 0.13 * spread, L = h * (0.7 - Math.abs(k) * 0.05);
        const tip = [Math.sin(a) * L + k * 0.03, G - Math.cos(a) * L];
        ctx.beginPath(); ctx.moveTo(k * 0.012 - bw / 2, G); ctx.quadraticCurveTo(tip[0] * 0.4, G - L * 0.6, tip[0], tip[1]); ctx.quadraticCurveTo(tip[0] * 0.4 + bw, G - L * 0.6, k * 0.012 + bw / 2, G); ctx.closePath();
        fillStroke(D, k % 2 ? D.c('leaf', -6) : leaf, D.lw * 0.7);
      }
      const stems = hd === 'sedge' || hd === 'rush' || hd === 'bulrush' ? 2 : 3;
      for (let i = 0; i < stems; i++) {
        const x = (i - (stems - 1) / 2) * 0.08, top = [x * 2 + (hd === 'nodding' ? 0.08 : 0), G - h * (1 - Math.abs(i - 1) * 0.08)];
        line(D, [[x * 0.3, G], [x * 1.4, (G + top[1]) / 2], top], D.lw * 1.1, D.c('leaf', -10));
        const hl = 0.13 * D.p('headSize');
        if (hd === 'spike' || hd === 'brush' || hd === 'awned') { ellPath(ctx, top[0], top[1] - hl * 0.5, hl * 0.12 * (hd === 'brush' ? 1.6 : 1), hl * 0.5); fillStroke(D, headC, D.lw * 0.7); }
        else if (hd === 'panicle') { for (let k = 0; k < 6; k++) { const y = top[1] + k * hl * 0.15, s = (k % 2 ? 1 : -1); line(D, [[top[0], y], [top[0] + s * hl * 0.25, y + hl * 0.08]], D.lw * 0.5, headC); ellPath(ctx, top[0] + s * hl * 0.25, y + hl * 0.08, 0.008, 0.008); ctx.fillStyle = headC; ctx.fill(); } }
        else if (hd === 'plume' || hd === 'turkeyfoot') { if (hd === 'turkeyfoot') for (const a of [-0.4, 0, 0.4]) line(D, [top, [top[0] + Math.sin(a) * hl * 0.8, top[1] - Math.cos(a) * hl * 0.8]], D.lw * 1.6, headC); else { blobPath(ctx, [[top[0], top[1] + 0.02], [top[0] - hl * 0.2, top[1] - hl * 0.6], [top[0] + hl * 0.05, top[1] - hl * 1.1], [top[0] + hl * 0.2, top[1] - hl * 0.5]]); fillStroke(D, headC, D.lw * 0.7); } }
        else if (hd === 'flag' || hd === 'sideoats') { for (let k = 0; k < (hd === 'sideoats' ? 7 : 2); k++) { const y = top[1] + k * (hd === 'sideoats' ? hl * 0.18 : 0.02); ctx.save(); ctx.translate(top[0], y); ctx.rotate(hd === 'flag' ? -0.2 + k * 0.4 : 0); ctx.fillStyle = headC; ctx.fillRect(0, 0, hl * (hd === 'flag' ? 0.5 : 0.25), hl * 0.1); ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 0.5; ctx.strokeRect(0, 0, hl * (hd === 'flag' ? 0.5 : 0.25), hl * 0.1); ctx.restore(); } }
        else if (hd === 'nodding') { for (let k = 0; k < 4; k++) { ellPath(ctx, top[0] + k * 0.015, top[1] + k * hl * 0.2, hl * 0.08, hl * 0.18, 0.4); fillStroke(D, headC, D.lw * 0.5); } }
        else if (hd === 'sedge' || hd === 'bulrush' || hd === 'rush') { for (let k = 0; k < 3; k++) { ellPath(ctx, top[0] + (k - 1) * 0.02, top[1] + k * 0.01, hl * 0.12, hl * 0.22); fillStroke(D, headC, D.lw * 0.6); } }
        if (D.m('awns') || hd === 'awned') for (let k = 0; k < 5; k++) line(D, [[top[0], top[1] - hl * k * 0.2], [top[0] + 0.05, top[1] - hl * k * 0.2 - 0.06]], D.lw * 0.4, headC);
      }
    },
    shrub(D) {
      const ctx = D.ctx, tw = D.tw;
      const shape = D.part('shape'), H = 0.45 * D.p('height') * (shape === 'upright' ? 1.3 : shape === 'mound' ? 0.75 : 1), W = 0.35 * D.p('width') * (shape === 'spreading' ? 1.4 : shape === 'upright' ? 0.75 : 1);
      fit(D, W * 2 + 0.2, H + 0.15);
      shadow(D, 0, W);
      const leafC = D.c('leaf'), stem = D.c('stem');
      for (const a of [-0.5, 0, 0.5]) line(D, [[0, G], [Math.sin(a) * W * 0.5, G - H * 0.5]], D.lw * 2.5, stem);
      if (D.part('leaf') === 'none') { ctx.strokeStyle = leafC; ctx.lineWidth = D.lw * 1.4; for (let k = -6; k <= 6; k++) { ctx.beginPath(); ctx.moveTo(k * 0.01, G); ctx.lineTo(k * W * 0.13, G - H * (0.8 + 0.2 * Math.cos(k))); ctx.stroke(); } return; }
      const blobs = [];
      const n = D.part('leaf') === 'fine' ? 11 : 8;
      for (let k = 0; k < n; k++) { const a = Math.PI + (k / (n - 1)) * Math.PI; blobs.push([Math.cos(a) * W * 0.75, G - H * 0.45 + Math.sin(a) * H * 0.5, W * (D.part('leaf') === 'fine' ? 0.28 : 0.36)]); }
      blobs.push([0, G - H * 0.45, W * 0.55]);
      const paths = blobs.map(b => ({ path: () => ellPath(ctx, b[0], b[1], b[2], b[2] * 0.9), fill: leafC }));
      group(D, paths);
      if (D.part('leaf') === 'needle') { ctx.strokeStyle = D.c('leaf', -12); ctx.lineWidth = D.lw * 0.6; for (let k = 0; k < 30; k++) { const x = -W + D.rnd() * W * 2, y = G - H * (0.15 + D.rnd() * 0.8); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.02, y - 0.02); ctx.stroke(); } }
      else for (const b of blobs) { ctx.fillStyle = D.c('leaf', 10); ellPath(ctx, b[0] - b[2] * 0.3, b[1] - b[2] * 0.35, b[2] * 0.35, b[2] * 0.2, -0.4); ctx.fill(); }
      if (D.m('fruit') || D.m('flowers')) { for (let k = 0; k < 12; k++) { const x = -W * 0.9 + D.rnd() * W * 1.8, y = G - H * (0.2 + D.rnd() * 0.75); ellPath(ctx, x, y, 0.017, 0.017); fillStroke(D, D.m('flowers') && !D.m('fruit') ? D.c('fruit') : D.c('fruit'), D.lw * 0.5); if (D.m('flowers') && D.m('fruit') && k % 2) { ellPath(ctx, x, y, 0.017, 0.017); ctx.fillStyle = D.c('mark'); ctx.fill(); } } }
      if (D.m('thorns')) { ctx.strokeStyle = INK; ctx.lineWidth = D.lw * 0.6; for (let k = 0; k < 10; k++) { const x = -W + D.rnd() * W * 2, y = G - H * D.rnd(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.012, y - 0.012); ctx.stroke(); } }
      if (D.m('variegated')) spots(D, -W, G - H, W, G, 12, 0.01, WHITE);
    },
    tree(D) {
      const ctx = D.ctx, tw = D.tw, crown = D.part('crown');
      const H = 0.9 * D.p('height'), cw = 0.3 * D.p('crown'), tr = 0.035 * D.p('trunk');
      fit(D, cw * 2.6, H + 0.05);
      shadow(D, 0, cw * 1.1);
      const leafC = D.c('leaf'), trunkC = D.c('trunk');
      const bark = D.part('bark');
      const trunkTop = crown === 'palm' || crown === 'joshua' ? G - H * 0.85 : crown === 'cycad' ? G - H * 0.3 : G - H * 0.45;
      const trunkP = () => { ctx.beginPath(); ctx.moveTo(-tr * 1.4, G); ctx.quadraticCurveTo(-tr, (G + trunkTop) / 2, -tr * 0.7, trunkTop); ctx.lineTo(tr * 0.7, trunkTop); ctx.quadraticCurveTo(tr, (G + trunkTop) / 2, tr * 1.4, G); ctx.closePath(); };
      trunkP(); fillStroke(D, bark === 'white' ? 'hsl(40,15%,90%)' : trunkC);
      if (bark === 'white' || bark === 'patchy') clipTo(D, trunkP, () => { ctx.fillStyle = bark === 'white' ? INK : D.c('trunk', 15); for (let y = trunkTop; y < G; y += 0.05) { ellPath(ctx, (D.rnd() - 0.5) * tr, y, tr * 0.5, 0.006); ctx.fill(); } });
      const cyc = G - H * 0.7;
      const blobs = [];
      const fill = leafC;
      const layer = (pts, col) => { blobPath(ctx, pts); fillStroke(D, col || fill); };
      if (crown === 'cone' || crown === 'spire' || crown === 'pine') {
        const n = crown === 'pine' ? 3 : 4;
        for (let i = 0; i < n; i++) { const t = i / n, y0 = G - H * (0.25 + t * 0.65), w = cw * (crown === 'spire' ? 0.55 : 1) * (1 - t * 0.75); ctx.beginPath(); ctx.moveTo(-w, y0); ctx.lineTo(0, y0 - H * (crown === 'pine' ? 0.22 : 0.32)); ctx.lineTo(w, y0); ctx.closePath(); fillStroke(D, i % 2 ? D.c('leaf', 5) : fill); }
      } else if (crown === 'palm' || crown === 'cycad') {
        const top = [0, trunkTop];
        for (let k = 0; k < 7; k++) { const a = -Math.PI + (k / 6) * Math.PI; const tip = [Math.cos(a) * cw * 1.2, top[1] + Math.sin(a) * cw * 0.5 + cw * 0.35]; blobPath(ctx, taperPts(top, [(top[0] + tip[0]) / 2, top[1] - cw * 0.3], tip, 0.03, 0.07, 0.01)); fillStroke(D, k % 2 ? D.c('leaf', -6) : fill); }
      } else if (crown === 'joshua') {
        for (const a of [-0.7, 0.6]) { const e = [Math.sin(a) * cw, trunkTop - 0.1]; line(D, [[0, trunkTop + 0.1], e], tr * 1.4 + D.lw * 2, INK); line(D, [[0, trunkTop + 0.1], e], tr * 1.4, trunkC); ellPath(ctx, e[0], e[1] - 0.04, 0.06, 0.06); fillStroke(D, fill); }
      } else if (crown === 'weeping') {
        ellPath(ctx, 0, cyc, cw, H * 0.3); fillStroke(D, fill);
        ctx.strokeStyle = fill; ctx.lineWidth = D.lw * 2; for (let k = -5; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(k * cw * 0.18, cyc); ctx.quadraticCurveTo(k * cw * 0.22, cyc + H * 0.2, k * cw * 0.2, G - H * 0.1); ctx.stroke(); }
      } else {
        const shapeK = { round: [1, 0.35, 0], oval: [0.75, 0.42, 0.05], vase: [1.05, 0.32, 0.05], umbrella: [1.3, 0.18, 0.12], irregular: [1, 0.33, 0], column: [0.45, 0.45, 0.05], spreading: [1.35, 0.28, 0.02] }[crown] || [1, 0.35, 0];
        const n = 7;
        for (let k = 0; k < n; k++) { const a = Math.PI + (k / (n - 1)) * Math.PI; blobs.push([Math.cos(a) * cw * shapeK[0] * 0.7 + (crown === 'irregular' ? (D.rnd() - 0.5) * 0.1 : 0), cyc + shapeK[2] + Math.sin(a) * H * shapeK[1] * 0.6, cw * shapeK[0] * 0.42]); }
        blobs.push([0, cyc + shapeK[2], cw * shapeK[0] * 0.65]);
        if (crown === 'vase' || crown === 'umbrella' || crown === 'spreading') for (const a of [-0.6, 0.6]) line(D, [[0, trunkTop + 0.05], [Math.sin(a) * cw * shapeK[0] * 0.7, cyc + 0.05]], tr * 1.2, trunkC);
        group(D, blobs.map(b => ({ path: () => ellPath(ctx, b[0], b[1], b[2], b[2] * (crown === 'umbrella' ? 0.5 : 0.85)), fill })));
        for (const b of blobs) { ctx.fillStyle = D.c('leaf', 10); ellPath(ctx, b[0] - b[2] * 0.3, b[1] - b[2] * 0.3, b[2] * 0.32, b[2] * 0.18, -0.4); ctx.fill(); }
        if (D.m('autumn')) for (const b of blobs.slice(0, 4)) { ctx.fillStyle = D.c('mark'); ctx.globalAlpha = 0.8; ellPath(ctx, b[0], b[1], b[2] * 0.7, b[2] * 0.6); ctx.fill(); ctx.globalAlpha = 1; }
      }
      const inCrown = (n, r, col, stroke) => { for (let k = 0; k < n; k++) { const x = (D.rnd() - 0.5) * cw * 1.5, y = cyc + (D.rnd() - 0.5) * H * 0.35; ellPath(ctx, x, y, r, r * (stroke === 'cone' ? 1.6 : 1)); fillStroke(D, col, D.lw * 0.5); } };
      if (D.m('fruit')) inCrown(10, 0.018, D.c('fruit'));
      if (D.m('flowers')) inCrown(14, 0.02, D.c('fruit'));
      if (D.m('cones')) inCrown(6, 0.015, D.c('fruit'), 'cone');
      if (D.m('nuts')) inCrown(8, 0.014, D.c('fruit'));
    },
    succulent(D) {
      const ctx = D.ctx, kind = D.part('kind');
      const H = 0.5 * D.p('height'), W = D.p('width');
      fit(D, 0.9, H + 0.3);
      shadow(D, 0, 0.25 * W);
      const body = D.c('body'), fc = D.c('flower');
      const spines = (x, y, r) => { if (!D.m('spines')) return; ctx.strokeStyle = D.c('mark'); ctx.lineWidth = D.lw * 0.5; for (let k = 0; k < 6; k++) { const a = D.rnd() * TAU, px = x + Math.cos(a) * r * 0.8, py = y + Math.sin(a) * r * 0.8; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * 0.02, py + Math.sin(a) * 0.02); ctx.stroke(); } };
      const flowers = pts => { if (!D.m('flowers')) return; for (const p of pts) { ellPath(ctx, p[0], p[1], 0.03, 0.022); fillStroke(D, fc, D.lw * 0.6); } };
      if (kind === 'paddle' || kind === 'cholla') {
        const pads = kind === 'paddle' ? [[0, G - 0.12, 0.1, 0.14, 0], [-0.13, G - 0.3, 0.08, 0.11, -0.4], [0.12, G - 0.32, 0.08, 0.11, 0.4]] : [[0, G - 0.2, 0.035, 0.2, 0], [-0.1, G - 0.35, 0.03, 0.12, -0.7], [0.1, G - 0.38, 0.03, 0.12, 0.7]];
        group(D, pads.map(p => ({ path: () => ellPath(ctx, p[0] * W, p[1], p[2] * W, p[3] * H * 2, p[4]), fill: body })));
        for (const p of pads) spines(p[0] * W, p[1], p[2]);
        flowers(pads.slice(1).map(p => [p[0] * W + Math.sin(p[4]) * 0.1, p[1] - p[3] * H * 1.9]));
      } else if (kind === 'column' || kind === 'hedgehog') {
        const cols = kind === 'column' ? [[0, H * 1.5, 0.07], [-0.12, H * 0.8, 0.05], [0.12, H, 0.05]] : [[0, H * 0.6, 0.06], [-0.08, H * 0.5, 0.05], [0.08, H * 0.55, 0.05]];
        if (kind === 'column') { for (const c of cols.slice(1)) line(D, [[0, G - 0.2], [c[0], G - 0.25]], 0.08 * W + D.lw * 2, INK); for (const c of cols.slice(1)) line(D, [[0, G - 0.2], [c[0], G - 0.25]], 0.08 * W, body); }
        group(D, cols.map(c => ({ path: () => { ctx.beginPath(); const x = c[0] * W, y0 = kind === 'column' && c[0] ? G - 0.25 : G, w = c[2] * W; ctx.moveTo(x - w, y0); ctx.lineTo(x - w, G - c[1]); ctx.arc(x, G - c[1], w, Math.PI, 0); ctx.lineTo(x + w, y0); ctx.closePath(); }, fill: body })));
        ctx.strokeStyle = D.c('body', -12); ctx.lineWidth = D.lw * 0.6; for (const c of cols) { ctx.beginPath(); ctx.moveTo(c[0] * W, G - 0.02); ctx.lineTo(c[0] * W, G - c[1]); ctx.stroke(); spines(c[0] * W, G - c[1] * 0.6, c[2]); }
        flowers(cols.map(c => [c[0] * W, G - c[1] - c[2] * 0.8]));
      } else if (kind === 'barrel' || kind === 'pincushion') {
        const r = (kind === 'barrel' ? 0.16 : 0.1) * W;
        const bodies = kind === 'pincushion' ? [[-0.08, r], [0.08, r * 0.9], [0, r * 1.1]] : [[0, r]];
        group(D, bodies.map(b => ({ path: () => ellPath(ctx, b[0], G - b[1] * 1.05, b[1], b[1] * (kind === 'barrel' ? 1.2 : 1)), fill: body })));
        ctx.strokeStyle = D.c('body', -12); ctx.lineWidth = D.lw * 0.6; for (const b of bodies) { for (const dx of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(b[0], G - b[1] * 1.05, Math.abs(dx) * b[1] + 0.001, b[1] * 1.1, 0, -Math.PI / 2, Math.PI / 2, dx < 0); ctx.stroke(); } spines(b[0], G - b[1], b[1]); }
        flowers(bodies.map(b => [b[0], G - b[1] * 2.1]));
      } else {
        // rosettes: agave, yucca, sotol, stonecrop
        const n = kind === 'sotol' ? 14 : kind === 'rosette' ? 8 : 10, L = (kind === 'rosette' ? 0.14 : kind === 'sotol' ? 0.3 : 0.25) * H * 2.2;
        if (D.m('flowers') || kind === 'yucca' || kind === 'agave') { const sh = kind === 'agave' ? H * 1.8 : H * 1.3; line(D, [[0, G - 0.05], [0, G - sh]], D.lw * 1.4, D.c('body', -20)); for (let k = 0; k < 6; k++) { ellPath(ctx, (k % 2 ? 1 : -1) * 0.03, G - sh + k * 0.035, 0.025, 0.018); fillStroke(D, fc, D.lw * 0.5); } }
        for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * (kind === 'rosette' ? 2.4 : 2.0); const tip = [Math.cos(a) * L, G - 0.02 + Math.sin(a) * L]; if (kind === 'sotol') line(D, [[0, G - 0.02], tip], D.lw * 1.4, k % 2 ? body : D.c('body', -8)); else { blobPath(ctx, taperPts([0, G - 0.02], [tip[0] * 0.5, G - 0.02 + (tip[1] - G) * 0.6], tip, kind === 'agave' ? 0.06 : 0.035, kind === 'agave' ? 0.05 : 0.03, 0.004)); fillStroke(D, k % 2 ? body : D.c('body', -8), D.lw * 0.7); } }
      }
    },
    vine(D) {
      const ctx = D.ctx, tw = D.tw;
      const H = 0.8 * D.p('height');
      fit(D, 0.8, H + 0.1);
      shadow(D, 0, 0.12);
      ctx.fillStyle = 'hsl(30,25%,55%)'; ctx.fillRect(-0.015, G - H, 0.03, H); ctx.strokeStyle = INK; ctx.lineWidth = SK.LW; ctx.strokeRect(-0.015, G - H, 0.03, H);
      const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([Math.sin(t * Math.PI * 4) * 0.05, G - t * H * 0.95]); }
      line(D, pts, D.lw * 2.2, INK); line(D, pts, D.lw * 1.1, D.c('stem'));
      const leafC = D.c('leaf'), lk = D.part('leaf');
      for (let i = 1; i < 16; i += 2) { const p = pts[i], s = i % 4 === 1 ? 1 : -1; leafShape(D, p[0], p[1], 0.12 * D.p('leafSize'), s > 0 ? -0.3 : Math.PI + 0.3, lk === 'palmate' ? 'lobed' : lk === 'oval' ? 'oval' : lk, D.m('autumn') && i > 8 ? D.c('mark') : leafC); }
      if (D.m('tendrils')) for (let i = 2; i < 16; i += 4) { const p = pts[i]; ctx.strokeStyle = D.c('stem'); ctx.lineWidth = D.lw * 0.6; ctx.beginPath(); ctx.arc(p[0] + 0.04, p[1], 0.02, 0, 5); ctx.stroke(); }
      const fl = D.part('flower');
      for (let i = 3; i < 16; i += 5) {
        const p = pts[i], x = p[0] + (i % 2 ? 0.08 : -0.08), y = p[1];
        if (fl === 'grapes' || fl === 'berries') { for (let k = 0; k < (fl === 'grapes' ? 7 : 4); k++) { ellPath(ctx, x + ((k % 3) - 1) * 0.02, y + Math.floor(k / 3) * 0.02, 0.013, 0.013); fillStroke(D, D.c('fruit'), D.lw * 0.5); } }
        else if (fl !== 'none') flowerHead(D, x, y, 0.05, fl);
      }
      if (D.m('thorns')) spots(D, -0.06, G - H, 0.06, G, 10, 0.006, INK);
    },
    aquatic(D) {
      const ctx = D.ctx, kind = D.part('kind');
      const H = 0.6 * D.p('height');
      fit(D, 0.9, H + 0.2);
      ctx.fillStyle = 'rgba(96,160,200,0.35)'; ellPath(ctx, 0, G, 0.4, 0.06); ctx.fill();
      const leafC = D.c('leaf'), fc = D.c('flower');
      if (kind === 'lily' || kind === 'floating') {
        const pads = kind === 'lily' ? [[-0.15, 0.13], [0.12, 0.1], [0.02, 0.07]] : [[-0.1, 0.05], [0.05, 0.06], [0.14, 0.04], [-0.02, 0.04]];
        for (const [x, r] of pads) { ellPath(ctx, x, G, r, r * 0.35); fillStroke(D, leafC); line(D, [[x, G], [x + r * 0.9, G - r * 0.1]], D.lw * 0.6, INK); }
        if (kind === 'lily') flowerHead(D, 0.02, G - 0.05, 0.06, 'cup');
      } else if (kind === 'cattail' || kind === 'reed') {
        for (let k = -3; k <= 3; k++) { const tip = [k * 0.06, G - H * (0.8 + 0.2 * Math.cos(k))]; ctx.beginPath(); ctx.moveTo(k * 0.015 - 0.01, G); ctx.quadraticCurveTo(tip[0] * 0.5, G - H * 0.5, tip[0], tip[1]); ctx.quadraticCurveTo(tip[0] * 0.5 + 0.015, G - H * 0.5, k * 0.015 + 0.01, G); ctx.closePath(); fillStroke(D, leafC, D.lw * 0.7); }
        if (kind === 'cattail') for (const x of [-0.03, 0.04]) { line(D, [[x, G], [x, G - H * 1.1]], D.lw * 1.1, D.c('leaf', -10)); ellPath(ctx, x, G - H * 0.95, 0.022, 0.07); fillStroke(D, 'hsl(22,40%,30%)'); }
        else for (const x of [-0.04, 0.05]) { ellPath(ctx, x + 0.03, G - H, 0.03, 0.06, 0.4); fillStroke(D, fc); }
      } else if (kind === 'submerged') {
        ctx.strokeStyle = leafC; ctx.lineWidth = D.lw * 1.6; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 0.05, G + 0.03); for (let t = 0; t <= 1; t += 0.1) ctx.lineTo(k * 0.05 + Math.sin(t * 9 + k) * 0.02, G + 0.03 - t * H * 0.7); ctx.stroke(); }
        ctx.fillStyle = 'rgba(96,160,200,0.3)'; ctx.fillRect(-0.3, G - H * 0.7, 0.6, H * 0.7 + 0.04);
      } else {
        // emergent, arrowhead, arum: broad leaves on stalks with a flower spike
        for (const [a, s] of [[-0.35, 1], [0.1, 1], [0.45, 0.8]]) { const tip = [Math.sin(a) * H * 0.7, G - Math.cos(a) * H * 0.7 * s]; line(D, [[0, G], tip], D.lw * 1.2, D.c('leaf', -10)); leafShape(D, tip[0], tip[1], 0.14, -Math.PI / 2 + a, kind === 'arrow' ? 'lance' : 'heart', leafC); }
        if (kind === 'arum') flowerHead(D, 0.05, G - H * 0.55, 0.08, 'spathe');
        else if (kind === 'arrow') flowerHead(D, 0.05, G - H * 0.8, 0.04, 'cup');
        else flowerHead(D, 0.03, G - H * 0.9, 0.06, 'spike');
      }
    },
  };
})(window.Trophic);
