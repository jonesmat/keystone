// Keystone — Canvas 2D world renderer: camera, tile map, level-shape icons, management areas, energy motes.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const N = B.worldSize, TP = B.tilePx, WORLD_PX = N * TP;
  const INK = '#1F2A24', ACCENT = '#1D6570';

  const SEASON_TINT = ['rgba(170,230,140,0.05)', 'rgba(255,220,120,0.04)', 'rgba(230,160,60,0.10)', 'rgba(200,220,245,0.20)'];
  const GROUND = [214, 205, 160];
  const WATER = [156, 195, 198];

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: WORLD_PX / 2, y: WORLD_PX / 2, zoom: 1 };
    this.dpr = 1;
    this.w = 0; this.h = 0;
    this.tileCanvas = document.createElement('canvas');
    this.tileCanvas.width = N; this.tileCanvas.height = N;
    this.tileCtx = this.tileCanvas.getContext('2d');
    this.tileImg = this.tileCtx.createImageData(N, N);
    this.frame = 0;
    this.particles = [];
    this.selected = null;
    this.planMarks = [];   // management action areas to outline: { x, y, r, color, label }
    this.brush = null;     // the area the steward is placing: { x, y, r, color }
    this.insets = { left: 0, right: 0, top: 0, bottom: 0 };
    this.resize();
  }
  T.Renderer = Renderer;

  Renderer.prototype.resize = function () {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
  };

  Renderer.prototype.minZoom = function () { return Math.min(this.w, this.h) / (WORLD_PX * 1.15); };

  Renderer.prototype.fit = function () {
    const aw = Math.max(200, this.w - 24), ah = Math.max(200, this.h - 24);
    this.cam.zoom = Math.min(aw, ah) / (WORLD_PX * 1.0);
    this.cam.x = WORLD_PX / 2;
    this.cam.y = WORLD_PX / 2;
  };

  Renderer.prototype.clampCam = function () {
    const c = this.cam;
    c.zoom = Math.max(this.minZoom(), Math.min(6, c.zoom));
    const m = WORLD_PX * 0.1;
    c.x = Math.max(-m, Math.min(WORLD_PX + m, c.x));
    c.y = Math.max(-m, Math.min(WORLD_PX + m, c.y));
  };

  Renderer.prototype.screenToWorld = function (sx, sy) {
    const c = this.cam;
    return [(sx - this.w / 2) / c.zoom + c.x, (sy - this.h / 2) / c.zoom + c.y];
  };
  Renderer.prototype.worldToScreen = function (wx, wy) {
    const c = this.cam;
    return [(wx - c.x) * c.zoom + this.w / 2, (wy - c.y) * c.zoom + this.h / 2];
  };

  Renderer.prototype.zoomAt = function (sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.cam.zoom *= factor;
    this.clampCam();
    const after = this.screenToWorld(sx, sy);
    this.cam.x += before[0] - after[0];
    this.cam.y += before[1] - after[1];
    this.clampCam();
  };

  Renderer.prototype.pick = function (world, sx, sy) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    const tx = wx / TP, ty = wy / TP;
    let best = null, bd = Math.max(0.7, 14 / (this.cam.zoom * TP));
    for (const e of world.ents) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - tx, e.y - ty);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) return { ent: best };
    if (tx >= 0 && ty >= 0 && tx < N && ty < N) {
      const i = (ty | 0) * N + (tx | 0);
      // A Population region under the pointer: the densest species there.
      let top = null, td = 0;
      for (const sp of world.species) {
        if (!sp.grid || !sp.regionMap[i]) continue;
        const d = world.popDensity(sp, i);
        if (d > td) { td = d; top = sp; }
      }
      if (top) return { region: { sp: top.idx, id: top.regionMap[i] }, tile: i };
      return { tile: i };
    }
    return null;
  };

  Renderer.prototype._updateTiles = function (world) {
    const d = this.tileImg.data;
    for (let i = 0; i < N * N; i++) {
      let r, g, b;
      const t = world.ptype[i];
      const P = t ? world.producers[t] : null;
      const f = P ? Math.min(1, world.pE[i] / P.max) : 0;
      // per-tile jitter so the grid reads as a patchwork, like the mockup
      const jit = (((i * 2654435761) >>> 0) % 13) - 6;
      if (world.terrain[i] === 1) {
        [r, g, b] = WATER;
        if (P) { const k = 0.35 * f; r += (P.color[0] - r) * k; g += (P.color[1] - g) * k; b += (P.color[2] - b) * k; }
        r += jit * 0.3; g += jit * 0.3; b += jit * 0.3;
      } else {
        const col = P ? P.color : GROUND;
        const n = world.nutr[i];
        const gr = GROUND[0] + (1 - n) * 8, gg = GROUND[1] - (1 - n) * 6, gb = GROUND[2] - (1 - n) * 16;
        const k = 0.15 + 0.85 * Math.sqrt(f);
        r = gr + (col[0] - gr) * k + jit;
        g = gg + (col[1] - gg) * k + jit;
        b = gb + (col[2] - gb) * k + jit * 0.6;
        if (world.fruit[i] > 5) { const fk = Math.min(0.3, world.fruit[i] / 220); r += (224 - r) * fk; g += (130 - g) * fk; b += (150 - b) * fk; }
        // Bare rock is grey; a burn scar stays dark for a round or two.
        if (world.rock && world.rock[i]) { r = 150 + jit; g = 148 + jit; b = 140 + jit; }
        if (world.burn && world.burn[i]) { const bk = 0.25 * world.burn[i]; r *= 1 - bk; g *= 1 - bk * 1.1; b *= 1 - bk * 1.1; }
        const det = Math.min(0.2, world.detr[i] / 500);
        r *= 1 - det; g *= 1 - det * 1.1; b *= 1 - det * 1.3;
      }
      const ov = this.overlay;
      if (ov && ov.alpha[i]) { const a = ov.alpha[i], o = i * 3; r += (ov.rgb[o] - r) * a; g += (ov.rgb[o + 1] - g) * a; b += (ov.rgb[o + 2] - b) * a; }
      else if (ov) { r = r * 0.8 + 40; g = g * 0.8 + 40; b = b * 0.8 + 40; }   // outside the layer: washed out
      const j = i * 4;
      d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255;
    }
    this.tileCtx.putImageData(this.tileImg, 0, 0);
  };

  Renderer.prototype.consumeEvents = function (world) {
    for (const ev of world.events) {
      const x = ev.x * TP, y = ev.y * TP;
      if (ev.type === 'bite') {
        for (let k = 0; k < 1; k++) this._spawn(x + rand(-6, 6), y + rand(-6, 6), rand(-4, 4), rand(-14, -4), 0.9, ev.meat ? '#E0813A' : '#F5C542', 1.6);
      } else if (ev.type === 'kill') {
        for (let k = 0; k < 8; k++) this._spawn(x, y, rand(-30, 30), rand(-30, 30), 0.6, '#C9483F', 2);
      } else if (ev.type === 'birth') {
        for (let k = 0; k < 5; k++) this._spawn(x, y, rand(-18, 18), rand(-24, -4), 0.8, '#FFF3B0', 1.4);
      } else if (ev.type === 'death') {
        for (let k = 0; k < 4; k++) this._spawn(x, y, rand(-6, 6), rand(-14, -6), 1.2, 'rgba(90,90,90,0.8)', 2.5);
      } else if (ev.type === 'hit') this._spawn(x, y, rand(-10, 10), rand(-10, 10), 0.3, '#FFFFFF', 1.5);
    }
    world.events.length = 0;
  };
  function rand(a, b) { return a + Math.random() * (b - a); }
  Renderer.prototype._spawn = function (x, y, vx, vy, life, color, size) {
    if (this.particles.length < 500) this.particles.push({ x, y, vx, vy, life, max: life, color, size });
  };

  Renderer.prototype.draw = function (world, alpha, dt) {
    const ctx = this.ctx, c = this.cam, dpr = this.dpr;
    this.frame++;
    // Map overlay (T.Overlays): recomputed when the layer changes and every 2 seconds or so.
    if (this.overlayId && T.Overlays && (!this.overlay || this.overlay.id !== this.overlayId || this.frame - this.overlayAt > 120)) {
      this.overlay = T.Overlays.compute(world, world.run, this.overlayId); this.overlayAt = this.frame; this.dirtyTiles = true;
      if (this.onOverlay) this.onOverlay(this.overlay);
    }
    if (!this.overlayId && this.overlay) { this.overlay = null; this.dirtyTiles = true; }
    if (this.frame % 4 === 1 || this.dirtyTiles) { this._updateTiles(world); this.dirtyTiles = false; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#E7E0CD';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.setTransform(dpr * c.zoom, 0, 0, dpr * c.zoom, dpr * (this.w / 2 - c.x * c.zoom), dpr * (this.h / 2 - c.y * c.zoom));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.tileCanvas, 0, 0, WORLD_PX, WORLD_PX);
    ctx.imageSmoothingEnabled = true;

    const tileScreen = TP * c.zoom;
    const [vx0, vy0] = this.screenToWorld(0, 0), [vx1, vy1] = this.screenToWorld(this.w, this.h);
    const tx0 = Math.max(0, Math.floor(vx0 / TP) - 1), ty0 = Math.max(0, Math.floor(vy0 / TP) - 1);
    const tx1 = Math.min(N - 1, Math.ceil(vx1 / TP) + 1), ty1 = Math.min(N - 1, Math.ceil(vy1 / TP) + 1);
    // faint tile grid
    if (tileScreen >= 7) {
      ctx.strokeStyle = 'rgba(31,42,36,0.07)'; ctx.lineWidth = 1 / c.zoom;
      ctx.beginPath();
      for (let x = tx0; x <= tx1 + 1; x++) { ctx.moveTo(x * TP, ty0 * TP); ctx.lineTo(x * TP, (ty1 + 1) * TP); }
      for (let y = ty0; y <= ty1 + 1; y++) { ctx.moveTo(tx0 * TP, y * TP); ctx.lineTo((tx1 + 1) * TP, y * TP); }
      ctx.stroke();
    }
    this._drawPlantGlyphs(world, tx0, ty0, tx1, ty1, tileScreen);
    ctx.fillStyle = SEASON_TINT[world.seasonIdx];
    ctx.fillRect(0, 0, WORLD_PX, WORLD_PX);
    this._drawAreas(world);

    this._drawPopulations(world, tx0, ty0, tx1, ty1, tileScreen);

    for (const cr of world.carrion) {
      if (!cr.alive) continue;
      const x = cr.x * TP, y = cr.y * TP, s = 2 + Math.min(5, Math.sqrt(cr.E) / 6);
      ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
    }

    // creatures
    const sprites = tileScreen >= 38;
    const minX = tx0 - 1, maxX = tx1 + 2, minY = ty0 - 1, maxY = ty1 + 2;
    // Species the steward hasn't identified show as grey shapes.
    const run = world.run, unknown = new Set();
    if (run && T.Knowledge) for (const sp of world.species) if (!T.Knowledge.known(run, sp)) unknown.add(sp.idx);
    const iconPx = Math.max(3.2, Math.min(9, tileScreen * 0.3));
    for (const e of world.ents) {
      if (!e.alive) continue;
      const ex = e.px + (e.x - e.px) * alpha, ey = e.py + (e.y - e.py) * alpha;
      if (ex < minX || ex > maxX || ey < minY || ey > maxY) continue;
      const x = ex * TP, y = ey * TP;
      const sp = e.sp;
      const hidden = e.state === 'hide' || e.hideT > 0;
      ctx.globalAlpha = hidden ? 0.45 : 1;
      const r = (iconPx * (0.75 + 0.2 * Math.sqrt(e.st.mass)) * (e.grow < 1 ? 0.75 : 1)) / c.zoom;
      if (unknown.has(sp.idx)) this._drawIcon(sp.level, x, y, r, '#A3A39A', c.zoom);
      else if (sprites) this._drawSprite(e, x, y, tileScreen);
      else this._drawIcon(sp.level, x, y, r, T.speciesColor(sp.level, sp.hue, 0), c.zoom);
      ctx.globalAlpha = 1;
    }

    const sel = this.selected;
    const t = performance.now() / 1000;
    if (sel && sel.ent && sel.ent.alive) {
      const e = sel.ent;
      const ex = (e.px + (e.x - e.px) * alpha) * TP, ey = (e.py + (e.y - e.py) * alpha) * TP;
      ctx.setLineDash([5 / c.zoom, 4 / c.zoom]);
      ctx.strokeStyle = INK; ctx.lineWidth = 2 / c.zoom;
      ctx.beginPath(); ctx.arc(ex, ey, Math.max(12 / c.zoom, TP * 0.7), t * 2, t * 2 + Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      if (e.te && e.te.alive && (e.state === 'hunt' || e.state === 'fight')) this._line(ex, ey, e.te.x * TP, e.te.y * TP, 'rgba(201,72,63,0.85)');
      if (e.threat && e.threat.alive && e.state === 'flee') this._line(ex, ey, e.threat.x * TP, e.threat.y * TP, 'rgba(29,101,112,0.8)');
      if (e.state === 'graze' && e.ti >= 0) this._line(ex, ey, ((e.ti % N) + 0.5) * TP, (((e.ti / N) | 0) + 0.5) * TP, 'rgba(94,158,69,0.9)');
    } else if (sel && sel.region) {
      const sp = world.species[sel.region.sp];
      if (sp && sp.regionMap) {
        ctx.setLineDash([5 / c.zoom, 4 / c.zoom]);
        this._regionOutline(sp.regionMap, sel.region.id, INK, 2.2 / c.zoom, tx0, ty0, tx1, ty1);
        ctx.setLineDash([]);
      }
    } else if (sel && sel.tile != null) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2 / c.zoom;
      ctx.strokeRect((sel.tile % N) * TP, ((sel.tile / N) | 0) * TP, TP, TP);
    }

    for (let k = this.particles.length - 1; k >= 0; k--) {
      const p = this.particles[k];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(k, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  // Populations: each region shaded by density and outlined; zoomed in, a scatter of representative icons
  // (flavour only: individuals in a Population can't be selected).
  Renderer.prototype._drawPopulations = function (world, x0, y0, x1, y1, tileScreen) {
    const ctx = this.ctx, zoom = this.cam.zoom;
    const scatter = tileScreen >= 38;
    for (const sp of world.species) {
      const g = sp.grid;
      if (!g || !g.total) continue;
      const color = T.speciesColor(sp.level, sp.hue, 0);
      const top = Math.max(1, g.max * 0.6);
      ctx.fillStyle = color;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * N + x;
        if (!sp.regionMap[i]) continue;
        const d = g.nJ[i] + g.nA[i] + g.nO[i];
        ctx.globalAlpha = 0.07 + 0.23 * Math.min(1, d / top);
        ctx.fillRect(x * TP, y * TP, TP, TP);
      }
      ctx.globalAlpha = 0.85;
      this._regionOutline(sp.regionMap, 0, color, 1.4 / zoom, x0, y0, x1, y1);
      ctx.globalAlpha = 1;
      if (scatter) {
        const r = Math.max(2, tileScreen * 0.07) / zoom;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const i = y * N + x, d = g.nJ[i] + g.nA[i] + g.nO[i];
          if (d < 0.5) continue;
          const k = Math.min(5, Math.ceil(Math.log2(1 + d)));
          for (let m = 0; m < k; m++) {
            const h = ((i * 2654435761 + m * 40503 + sp.idx * 97) >>> 0);
            this._drawIcon(sp.level, (x + 0.15 + 0.7 * ((h & 255) / 255)) * TP, (y + 0.15 + 0.7 * (((h >> 8) & 255) / 255)) * TP, r, color, zoom);
          }
        }
      }
    }
  };

  // Outline the edges of a region map: every edge between a tile in a region and one outside it (id 0 = all regions).
  Renderer.prototype._regionOutline = function (map, id, color, width, x0, y0, x1, y1) {
    const ctx = this.ctx;
    const inside = i => (id ? map[i] === id : map[i] > 0);
    const same = (i, j) => (id ? map[j] === id : map[j] === map[i]);
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * N + x;
      if (!inside(i)) continue;
      const X = x * TP, Y = y * TP;
      if (y === 0 || !same(i, i - N)) { ctx.moveTo(X, Y); ctx.lineTo(X + TP, Y); }
      if (y === N - 1 || !same(i, i + N)) { ctx.moveTo(X, Y + TP); ctx.lineTo(X + TP, Y + TP); }
      if (x === 0 || !same(i, i - 1)) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + TP); }
      if (x === N - 1 || !same(i, i + 1)) { ctx.moveTo(X + TP, Y); ctx.lineTo(X + TP, Y + TP); }
    }
    ctx.stroke();
  };

  Renderer.prototype._line = function (x0, y0, x1, y1, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5 / this.cam.zoom;
    ctx.setLineDash([3 / this.cam.zoom, 3 / this.cam.zoom]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
  };

  // Level icon: colour + shape (colour-blind safe), outlined in ink.
  Renderer.prototype._drawIcon = function (level, x, y, r, fill, zoom) {
    const ctx = this.ctx;
    ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(0.6, 1.1 / zoom);
    T.iconPath(ctx, T.LEVELS[level].shape, x, y, level === 'decomposer' ? r * 0.55 : r);
    ctx.fill(); ctx.stroke();
  };
  T.iconPath = function (ctx, shape, x, y, r) {
    ctx.beginPath();
    switch (shape) {
      case 'square': ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8); break;
      case 'triangle': ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.1, y + r * 0.8); ctx.lineTo(x - r * 1.1, y + r * 0.8); ctx.closePath(); break;
      case 'diamond': ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.1, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 1.1, y); ctx.closePath(); break;
      default: ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  };

  Renderer.prototype._drawSprite = function (e, x, y, tileScreen) {
    const ctx = this.ctx, sp = e.sp;
    const lenTiles = (0.55 + 0.3 * Math.sqrt(e.st.mass)) * (e.grow < 1 ? 0.8 : 1);
    const px = lenTiles * tileScreen;
    const img = T.getSprite(sp.spriteKey, { genome: sp.mean, level: sp.level, hue: sp.hue, id: sp.id }, px);
    const bucket = img.width / 2;
    const scale = (lenTiles * TP) / (bucket * 1.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(e.hx < 0 ? -scale : scale, scale);
    ctx.drawImage(img, -bucket, -bucket * 0.9);
    ctx.restore();
  };

  Renderer.prototype._drawPlantGlyphs = function (world, x0, y0, x1, y1, tileScreen) {
    const ctx = this.ctx;
    const detail = tileScreen >= 14;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const i = ty * N + tx;
      const t = world.ptype[i];
      if (!t) continue;
      const P = world.producers[t];
      const f = world.pE[i] / P.max;
      if (f < 0.25) continue;
      const cx = tx * TP + TP / 2, cy = ty * TP + TP / 2;
      const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
      const jx = ((h & 7) - 3.5) * 0.5, jy = (((h >> 3) & 7) - 3.5) * 0.5;
      if (P.kind === 'woody') {
        if (h % 3) continue;
        const r = 4 + 5 * f;
        ctx.fillStyle = '#3F6B3A';
        ctx.beginPath(); ctx.arc(cx + jx, cy + jy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2B4A2A'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(cx + jx - r * 0.3, cy + jy - r * 0.3, r * 0.45, 0, Math.PI * 2); ctx.fill();
      } else if (!detail) continue;
      else if (P.kind === 'tall') {
        if (h % 2) continue;
        ctx.strokeStyle = 'rgba(60,90,35,0.75)'; ctx.lineWidth = 1.1;
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx + k * 2.5 + jx, cy + 5); ctx.lineTo(cx + k * 3 + jx, cy + 5 - 9 * f); ctx.stroke(); }
      } else if (P.kind === 'vine') {
        ctx.strokeStyle = 'rgba(40,100,60,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx + jx, cy + jy, 3 * f + 1, 0.5, 5); ctx.stroke();
        if (world.fruit[i] > 5) { ctx.fillStyle = '#D94F7A'; ctx.beginPath(); ctx.arc(cx + jx + 2, cy + jy - 2, 1.6, 0, Math.PI * 2); ctx.fill(); }
      } else if (P.kind === 'aquatic') {
        ctx.fillStyle = 'rgba(80,140,110,0.5)';
        ctx.beginPath(); ctx.ellipse(cx + jx, cy + jy, 3 * f + 1, 2 * f + 1, 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  // Management areas: fenced exclosures and protected tiles on the map, queued actions, and the brush being placed.
  Renderer.prototype._drawAreas = function (world) {
    const ctx = this.ctx, z = this.cam.zoom;
    // Land parcels: private land dashed brown, conservation easements green, developed land greyed out.
    if (world.parcels && world.parcels.length) {
      const bs = world.N / 4;
      for (const p of world.parcels) {
        if (p.use === 'public') continue;
        const col = p.use === 'easement' ? 'rgba(94,158,69,0.9)' : p.use === 'developed' ? 'rgba(90,90,90,0.9)' : 'rgba(140,90,40,0.85)';
        for (const [bx, by] of p.blocks) {
          const x = bx * bs * TP, y = by * bs * TP, s = bs * TP;
          if (p.use === 'developed') { ctx.fillStyle = 'rgba(120,120,120,0.35)'; ctx.fillRect(x, y, s, s); }
          ctx.strokeStyle = col; ctx.lineWidth = 2 / z;
          ctx.setLineDash(p.use === 'private' ? [8 / z, 5 / z] : []);
          ctx.strokeRect(x + 1 / z, y + 1 / z, s - 2 / z, s - 2 / z);
        }
        ctx.setLineDash([]);
        const [bx, by] = p.blocks[0], owner = p.owner >= 0 && world.run && world.run.stake ? world.run.stake.list[p.owner] : null;
        const label = p.use === 'easement' ? 'Conservation easement' : p.use === 'developed' ? 'Developed' : owner ? owner.name + ' (private)' : 'Private';
        ctx.fillStyle = col; ctx.font = (12 / z) + 'px system-ui, sans-serif';
        ctx.fillText(label, bx * bs * TP + 6 / z, by * bs * TP + 16 / z);
      }
    }
    if (world.exclosure) {
      ctx.strokeStyle = 'rgba(122,74,30,0.8)'; ctx.lineWidth = 1.2 / z;
      ctx.beginPath();
      for (let i = 0; i < N * N; i++) if (world.exclosure[i]) ctx.rect((i % N) * TP + 1, ((i / N) | 0) * TP + 1, TP - 2, TP - 2);
      ctx.stroke();
    }
    const ring = (m, dash) => {
      ctx.fillStyle = m.fill || 'rgba(29,101,112,0.08)';
      ctx.strokeStyle = m.color || ACCENT; ctx.lineWidth = 1.6 / z;
      ctx.setLineDash(dash ? [6 / z, 4 / z] : []);
      ctx.beginPath(); ctx.arc(m.x * TP, m.y * TP, m.r * TP, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      if (m.label) {
        ctx.fillStyle = INK; ctx.font = (11 / z) + 'px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(m.label, m.x * TP, (m.y - m.r) * TP - 4 / z);
      }
    };
    for (const m of this.planMarks) ring(m, true);
    if (this.brush) ring(this.brush, false);
  };
})(window.Trophic);
