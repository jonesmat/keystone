// Keystone — procedural side-view creature art assembled from genes (body plan, coat, armour, weapons),
// tinted by trophic level and each species' hue shift. Used by the editor, Codex, cards and close-up map view.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const INK = '#1F2A24';

  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hsl(h, s, l) { return 'hsl(' + (((h % 360) + 360) % 360).toFixed(0) + ',' + (s * 100).toFixed(0) + '%,' + (l * 100).toFixed(0) + '%)'; }

  // Level colour with the species' hue shift; f lightens (>0) or darkens (<0).
  T.speciesColor = function (level, hue, f) {
    const L = T.LEVELS[level] || T.LEVELS.herbivore;
    const [h, s, l0] = hexToHsl(L.color);
    // Species differ mostly by lightness plus a small hue nudge, so they stay inside their trophic colour family.
    const shift = Math.max(-20, Math.min(20, hue || 0));
    hue = shift * 0.25;
    const l = Math.max(0.2, Math.min(0.8, l0 + (shift / 20) * 0.1));
    let ll = l;
    if (f) ll = f > 0 ? l + (1 - l) * f : l * (1 + f);
    return hsl(h + (hue || 0), s, ll);
  };

  function view(g) { return g instanceof Float32Array || Array.isArray(g) ? T.geneView(Float32Array.from(g)) : g; }

  // Side view, facing right, centred on (0,0), about `len` px long. sp: { genome, level, hue, id }.
  T.drawCreature = function (ctx, sp, len, opts) {
    opts = opts || {};
    const v = view(sp.genome);
    const t = opts.t || 0;
    const base = T.speciesColor(sp.level, sp.hue, 0), dark = T.speciesColor(sp.level, sp.hue, -0.3), light = T.speciesColor(sp.level, sp.hue, 0.35);
    const meat = v.diet;
    const lw = Math.max(1, len * 0.022);
    const bw = len * 0.3;                                  // half body length
    const bh = len * (0.13 + 0.02 * Math.min(4, v.fat) + (meat < 0.5 ? 0.02 : 0)); // half body height
    const limbs = Math.round(v.limbs), tail = Math.round(v.tail), head = Math.round(v.head), coat = Math.round(v.coat);
    const flight = v.flight >= 0.5;
    const legLen = len * (0.16 + 0.012 * v.speed) * (flight ? 0.6 : 1);
    const bodyY = -legLen * 0.55;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.translate(0, bodyY + legLen * 0.2);

    // shadow
    if (!opts.noShadow) {
      ctx.fillStyle = 'rgba(31,42,36,0.12)';
      ctx.beginPath(); ctx.ellipse(0, legLen * 0.9 - bodyY * 0.0, bw * 1.1, len * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    }

    // legs (far side first, darker)
    const pairs = Math.max(1, Math.round(limbs / 2));
    const stride = Math.sin(t * 10);
    const legX = k => (pairs === 1 ? 0 : -bw * 0.62 + (k * bw * 1.24) / (pairs - 1));
    for (const far of [1, 0]) {
      ctx.strokeStyle = far ? dark : T.speciesColor(sp.level, sp.hue, -0.15);
      ctx.lineWidth = lw * (2.4 + v.size * 0.08);
      for (let k = 0; k < pairs; k++) {
        const x = legX(k) + (far ? len * 0.03 : 0);
        const sw = (k % 2 ? 1 : -1) * (far ? -1 : 1) * stride * len * 0.04;
        ctx.beginPath();
        ctx.moveTo(x, bh * 0.4);
        ctx.lineTo(x + sw * 0.5 + len * 0.02, bh * 0.4 + legLen * 0.55);
        ctx.lineTo(x + sw, bh * 0.4 + legLen);
        ctx.stroke();
      }
    }

    // tail
    const tx = -bw * 0.95;
    ctx.strokeStyle = INK; ctx.fillStyle = base; ctx.lineWidth = lw;
    const wag = Math.sin(t * 4) * len * 0.02;
    if (tail === 0) {
      ctx.beginPath(); ctx.ellipse(tx - len * 0.02, -bh * 0.3, len * 0.045, len * 0.035, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (tail === 1) {
      ctx.strokeStyle = dark; ctx.lineWidth = lw * 2.2;
      ctx.beginPath(); ctx.moveTo(tx, -bh * 0.2);
      ctx.quadraticCurveTo(tx - len * 0.18, -bh * 0.9 + wag, tx - len * 0.3, -bh * 0.4 + wag); ctx.stroke();
    } else if (tail === 2) {
      ctx.beginPath(); ctx.moveTo(tx + len * 0.02, -bh * 0.55); ctx.lineTo(tx - len * 0.28, -bh * 1.0 + wag); ctx.lineTo(tx - len * 0.12, -bh * 0.1); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else {
      ctx.strokeStyle = dark; ctx.lineWidth = lw * 3;
      ctx.beginPath(); ctx.moveTo(tx, -bh * 0.1); ctx.lineTo(tx - len * 0.2, bh * 0.1 + wag); ctx.stroke();
      ctx.fillStyle = dark; ctx.strokeStyle = INK; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(tx - len * 0.22, bh * 0.12 + wag, len * 0.05, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (v.venom > 0.3) {
      ctx.fillStyle = '#7C55A8';
      ctx.beginPath(); ctx.arc(tx - len * (tail === 1 ? 0.3 : 0.2), -bh * 0.5 + wag, len * (0.015 + 0.01 * v.venom), 0, Math.PI * 2); ctx.fill();
    }

    // wings behind body
    if (flight) {
      const flap = Math.sin(t * 9) * 0.35;
      ctx.fillStyle = light; ctx.strokeStyle = INK; ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(-bw * 0.3, -bh * 0.6);
      ctx.quadraticCurveTo(-bw * 0.2, -bh * (3.2 + flap * 2), bw * 0.5, -bh * (2.4 + flap * 2));
      ctx.quadraticCurveTo(bw * 0.2, -bh * 1.2, bw * 0.3, -bh * 0.6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    // body
    const bodyPath = () => {
      ctx.beginPath();
      if (meat >= 0.7) {
        ctx.moveTo(bw, -bh * 0.35);
        ctx.bezierCurveTo(bw * 0.6, -bh * 1.25, -bw * 0.8, -bh * 1.15, -bw, -bh * 0.2);
        ctx.bezierCurveTo(-bw * 0.9, bh * 0.9, bw * 0.7, bh * 0.95, bw, -bh * 0.35);
      } else {
        ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
      }
    };
    ctx.fillStyle = base; bodyPath(); ctx.fill();
    ctx.save(); bodyPath(); ctx.clip();
    // belly highlight
    ctx.fillStyle = light; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.ellipse(bw * 0.05, bh * 0.75, bw * 0.8, bh * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = dark; ctx.strokeStyle = dark;
    if (coat === 1) {
      const rng = new T.RNG(((sp.id || 'x').length * 7919 + Math.round((v.m0 || 0.5) * 1e4)) >>> 0);
      for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(rng.range(-bw, bw), rng.range(-bh, bh * 0.4), len * rng.range(0.018, 0.035), 0, Math.PI * 2); ctx.fill(); }
    } else if (coat === 2) {
      ctx.lineWidth = len * 0.028;
      for (let k = 0; k < 6; k++) { const x = -bw * 0.75 + k * bw * 0.3; ctx.beginPath(); ctx.moveTo(x + len * 0.03, -bh * 1.2); ctx.quadraticCurveTo(x - len * 0.02, -bh * 0.1, x + len * 0.01, bh * 0.35); ctx.stroke(); }
    } else if (coat === 3) {
      ctx.globalAlpha = 0.6;
      ctx.fillRect(-bw, -bh * 0.35, bw * 2, bh * 0.3);
      ctx.globalAlpha = 1;
    }
    if (v.camo > 0.5) {
      ctx.globalAlpha = 0.25;
      for (let k = 0; k < Math.round(v.camo * 4); k++) { ctx.beginPath(); ctx.ellipse(-bw + (k * 37 % 100) / 100 * bw * 2, -bh * 0.3 + (k * 53 % 60) / 100 * bh, len * 0.05, len * 0.025, 0.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = lw; bodyPath(); ctx.stroke();

    // armour plates and spines along the back
    if (v.armor > 0.4) {
      const n = Math.max(2, Math.round(v.armor) + 2);
      ctx.fillStyle = T.speciesColor(sp.level, sp.hue, -0.1); ctx.lineWidth = lw * 0.8;
      for (let k = 0; k < n; k++) {
        const u = -0.65 + (1.3 * k) / (n - 1);
        const x = u * bw, y = -bh * Math.sqrt(Math.max(0.05, 1 - u * u)) * 0.95;
        ctx.beginPath(); ctx.ellipse(x, y + bh * 0.1, len * 0.05, len * 0.03, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (v.spines > 0.4) {
      const n = 3 + Math.round(v.spines * 2);
      ctx.fillStyle = '#F4EFE3'; ctx.lineWidth = lw * 0.8;
      for (let k = 0; k < n; k++) {
        const u = -0.7 + (1.3 * k) / (n - 1);
        const x = u * bw, y = -bh * Math.sqrt(Math.max(0.05, 1 - u * u)) * 0.95;
        const sl = len * (0.05 + 0.02 * v.spines);
        ctx.beginPath(); ctx.moveTo(x - len * 0.018, y); ctx.lineTo(x - len * 0.01, y - sl); ctx.lineTo(x + len * 0.018, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }

    // head
    const hr = len * (0.1 + 0.004 * Math.min(15, v.size));
    const hx = bw * 0.92, hy = -bh * 0.75;
    ctx.fillStyle = base; ctx.strokeStyle = INK; ctx.lineWidth = lw;
    // ears for small plant-eaters and burrowers
    if (meat < 0.5 && (v.burrow > 0.4 || v.size < 2.5)) {
      ctx.fillStyle = base;
      for (const dx of [-0.25, 0.1]) {
        ctx.beginPath(); ctx.ellipse(hx + hr * dx, hy - hr * 1.3, hr * 0.28, hr * (v.burrow > 0.4 ? 1.0 : 0.6), -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else if (meat >= 0.5) {
      ctx.beginPath(); ctx.moveTo(hx - hr * 0.5, hy - hr * 0.6); ctx.lineTo(hx - hr * 0.35, hy - hr * 1.35); ctx.lineTo(hx + hr * 0.05, hy - hr * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath();
    if (head === 0) ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    else if (head === 1) {
      ctx.moveTo(hx - hr * 0.8, hy - hr * 0.8);
      ctx.quadraticCurveTo(hx + hr * 0.6, hy - hr * 0.9, hx + hr * 1.5, hy + hr * 0.15);
      ctx.quadraticCurveTo(hx + hr * 0.4, hy + hr * 0.9, hx - hr * 0.8, hy + hr * 0.7);
      ctx.closePath();
    } else {
      ctx.moveTo(hx - hr * 0.8, hy - hr * 0.85);
      ctx.lineTo(hx + hr * 1.9, hy - hr * 0.3);
      ctx.lineTo(hx + hr * 1.9, hy + hr * 0.35);
      ctx.lineTo(hx - hr * 0.8, hy + hr * 0.8);
      ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
    // teeth
    if (v.bite > 0.4) {
      const n = 2 + Math.round(v.bite);
      const mx0 = hx + hr * (head === 0 ? 0.2 : 0.3), mx1 = hx + hr * (head === 2 ? 1.85 : head === 1 ? 1.3 : 0.95);
      const my = hy + hr * (head === 2 ? 0.35 : 0.3);
      ctx.fillStyle = '#FBF8F1'; ctx.lineWidth = lw * 0.6;
      for (let k = 0; k < n; k++) {
        const x = mx0 + ((mx1 - mx0) * (k + 0.5)) / n;
        ctx.beginPath(); ctx.moveTo(x - hr * 0.1, my); ctx.lineTo(x, my + hr * (0.18 + 0.03 * v.bite)); ctx.lineTo(x + hr * 0.1, my); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    // eye
    const er = Math.max(1, hr * (0.16 + 0.03 * Math.min(6, v.senses)));
    ctx.fillStyle = '#FBF8F1';
    ctx.beginPath(); ctx.arc(hx + hr * 0.3, hy - hr * 0.25, er, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(hx + hr * 0.38, hy - hr * 0.25, er * 0.55, 0, Math.PI * 2); ctx.fill();
    if (v.echolocation >= 0.5) {
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.6;
      for (const r of [1.8, 2.3]) { ctx.beginPath(); ctx.arc(hx + hr, hy - hr * 0.2, hr * r, -0.5, 0.5); ctx.stroke(); }
    }
    ctx.restore();
  };

  // Catalog species (Phase 3) carry a tweak set and draw from their taxon group's template (js/templates.js);
  // everything else (the fictional worlds' species) keeps the genome-driven creature above.
  const templated = sp => !!(sp && sp.tweaks && T.SpriteTemplates && T.SpriteTemplates.has(sp.tweaks));
  function drawAny(ctx, sp, len, opts) {
    if (templated(sp)) T.SpriteTemplates.draw(ctx, sp.tweaks, len, opts);
    else T.drawCreature(ctx, sp, len, opts);
  }
  T.drawSpecies = drawAny;

  // Cached sprite canvases, per species (template sprites) or quantized genome, and size bucket.
  const cache = new Map();
  T.getSprite = function (key, sp, px) {
    const bucket = px <= 28 ? 28 : px <= 56 ? 56 : 112;
    const k = (templated(sp) ? 'tw:' + sp.tweaks.tpl + ':' + sp.tweaks.key : key) + '|' + bucket;
    let c = cache.get(k);
    if (!c) {
      c = document.createElement('canvas');
      c.width = bucket * 2; c.height = Math.round(bucket * 1.5);
      const ctx = c.getContext('2d');
      ctx.translate(bucket, bucket * 0.9);
      drawAny(ctx, sp, bucket * 1.3, { t: 0, noShadow: true });
      cache.set(k, c);
      if (cache.size > 300) cache.delete(cache.keys().next().value);
    }
    return c;
  };

  // Convenience: draw a creature into a canvas element, centred and fitted.
  T.paintCreature = function (canvas, sp, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    if (!opts.keep) ctx.clearRect(0, 0, W, H);
    if (templated(sp)) {
      // Template frame: about 1 unit long, ground 0.3 below the origin, room for 0.95 above it.
      const len = Math.min(W * 0.62, H * 0.82) * (opts.scale || 1);
      ctx.save(); ctx.translate(W * 0.5, H * 0.88 - len * 0.3 + (opts.bob || 0));
      T.SpriteTemplates.draw(ctx, sp.tweaks, len, opts);
      ctx.restore();
      return;
    }
    ctx.save();
    const v = view(sp.genome);
    const flight = v.flight >= 0.5;
    ctx.translate(W * 0.5 - W * 0.02, H * (flight ? 0.66 : 0.6) + (opts.bob || 0));
    const len = Math.min(W * 0.62, H * 1.05) * (opts.scale || 1);
    T.drawCreature(ctx, sp, len, opts);
    ctx.restore();
  };
})(window.Trophic);
