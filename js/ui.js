// Keystone — shared UI: DOM helpers, World view HUD, floating inspector, and chart drawing
// (histograms, radar, Sankey, population chart). Full screens live in js/screens.js.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const $ = id => document.getElementById(id);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const INK = '#1F2A24', ACCENT = '#1D6570';

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  }
  function svg(tag, attrs, ...kids) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  }
  function fmt(n) {
    n = Math.round(n);
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1e4) return Math.round(n / 1e3) + 'k';
    return n.toLocaleString('en-US');
  }
  const pct = v => Math.round(v * 100) + '%';
  const plural = n => (/s$/.test(n) ? n : n + 's');
  const signed = (v, d) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d == null ? 2 : d);
  const pad2 = n => String(n).padStart(2, '0');

  // Level icon as a small inline element (colour + shape).
  function shapeIcon(level, hue) {
    const L = T.LEVELS[level] || T.LEVELS.herbivore;
    const c = T.speciesColor(level, hue || 0, 0);
    if (L.shape === 'triangle') return el('i', { class: 'sh triangle', style: { color: c } });
    return el('i', { class: 'sh ' + L.shape, style: { background: c } });
  }

  function hiDPI(cv, w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = w || cv.clientWidth || cv.width, H = h || cv.clientHeight || cv.height;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W, H };
  }

  const UI = (T.UI = { el, svg, fmt, pct, plural, signed, shapeIcon, hiDPI });
  let G = null;

  UI.init = function (game) {
    G = game;
    UI.buildDirectives();
    UI.buildLegend();
    document.querySelectorAll('#screen-world .speed button').forEach(b => b.addEventListener('click', () => G.setSpeed(+b.dataset.speed)));
    document.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => G.openMenu()));
    document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => G.openOverlay(b.dataset.open)));
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => G.closeOverlay()));
    $('pyr-tabs').addEventListener('click', ev => {
      const b = ev.target.closest('button[data-kind]');
      if (!b) return;
      UI.pyrKind = b.dataset.kind;
      UI.pyrAt = 0;
      UI.updatePyramid();
    });
    $('btn-toggle-left').addEventListener('click', () => { $('panel-left').classList.toggle('open'); $('panel-right').classList.remove('open'); });
    $('btn-toggle-right').addEventListener('click', () => { $('panel-right').classList.toggle('open'); $('panel-left').classList.remove('open'); });
    $('btn-marker').addEventListener('click', () => G.togglePlacing());
    $('btn-clear-marker').addEventListener('click', () => G.clearMarker());
    $('zoom-in').addEventListener('click', () => { const r = G.renderer; r.zoomAt(r.w / 2, r.h / 2, 1.3); });
    $('zoom-out').addEventListener('click', () => { const r = G.renderer; r.zoomAt(r.w / 2, r.h / 2, 1 / 1.3); });
    const sel = $('tint-gene');
    for (const k of ['speed', 'size', 'bite', 'senses', 'camo', 'armor', 'boldness', 'aggression', 'plantGut', 'meatGut', 'diet', 'fat']) sel.append(el('option', { value: k, text: T.GENE_BY_KEY[k].name }));
    sel.addEventListener('change', () => { G.renderer.tint.gene = sel.value; UI.updateTint(); });
    $('tint-toggle').addEventListener('click', () => {
      const on = !G.renderer.tint.on;
      G.renderer.tint.on = on;
      $('tint-toggle').setAttribute('aria-checked', String(on));
      $('tint-card').classList.toggle('on', on);
      UI.updateTint();
    });
    // menu
    $('menu-resume').addEventListener('click', () => G.closeMenu());
    $('menu-export').addEventListener('click', () => G.exportSave());
    $('menu-quit').addEventListener('click', () => { G.closeMenu(); G.showNewWorld(); });
    $('modal-menu').addEventListener('click', e => { if (e.target.id === 'modal-menu') G.closeMenu(); });
    const s = G.settings;
    $('set-music').value = s.music; $('set-sfx').value = s.sfx; $('set-hints').checked = s.hints; $('set-debug').checked = s.debug;
    $('set-music').addEventListener('input', e => G.setSetting('music', +e.target.value));
    $('set-sfx').addEventListener('input', e => G.setSetting('sfx', +e.target.value));
    $('set-hints').addEventListener('change', e => G.setSetting('hints', e.target.checked));
    $('set-debug').addEventListener('change', e => G.setSetting('debug', e.target.checked));
    $('file-import').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) f.text().then(txt => G.importSave(txt));
    });
    T.Screens.init(G);
  };

  UI.show = function (name) {
    for (const s of ['world', 'newworld', 'evolve', 'report', 'phylogeny', 'codex', 'end']) $('screen-' + s).hidden = s !== name;
    if (name !== 'world') { $('inspector').hidden = true; }
  };

  UI.toast = function (msg, kind) {
    const box = $('toasts');
    const t = el('div', { class: 'toast' + (kind ? ' ' + kind : ''), text: msg });
    box.append(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.remove(), 3600);
  };

  UI.showHint = function (text) {
    const h = $('hint');
    h.innerHTML = '';
    h.append(el('p', { text }), el('button', { 'aria-label': 'Dismiss hint', onclick: () => (h.hidden = true), html: '&times;' }));
    h.hidden = false;
  };
  UI.hideHint = () => ($('hint').hidden = true);

  // ---------- directives + legend ----------

  const ICONS = {
    forage: '<path d="M12 21c0-7 0-11 7-15-1 7-3 11-7 11M12 21c0-5-1-8-6-10 0 5 2 8 6 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    hunt: '<path d="M4 7l4 10 4-6 4 6 4-10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    hide: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 20 20 4" stroke="currentColor" stroke-width="1.8"/>',
    migrate: '<path d="M5 8h10l-3-3M19 16H9l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    swarm: '<circle cx="12" cy="7" r="2.3" fill="currentColor"/><circle cx="7" cy="15" r="2.3" fill="currentColor"/><circle cx="17" cy="15" r="2.3" fill="currentColor"/>',
    isolate: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2.4"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/>',
  };

  UI.buildDirectives = function () {
    const box = $('directives');
    box.innerHTML = '';
    for (const d of T.DIRECTIVES) {
      const b = el('button', { class: 'dir-btn', 'data-dir': d.id, title: d.name + ' (' + d.key + '): ' + d.desc, onclick: () => G.issueDirective(d.id) });
      b.innerHTML = '<span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[d.id] + '</svg></span>';
      b.append(el('span', { class: 'txt' }, el('b', { text: d.name }), el('small', null, el('kbd', { text: d.key }), el('span', { class: 'st' }))));
      box.append(b);
    }
  };

  UI.buildLegend = function () {
    const box = $('level-legend');
    box.innerHTML = '';
    const names = { producer: 'Producer', herbivore: 'Herbivore', omnivore: 'Omnivore', carnivore1: 'Carnivore', carnivore2: 'Apex', decomposer: 'Decomposer' };
    for (const lv of T.LEVEL_ORDER) box.append(el('span', null, shapeIcon(lv), names[lv]));
  };

  // ---------- HUD ----------

  UI.updateHUD = function () {
    const w = G.world, run = G.run, p = w.player;
    if (!p) return;
    $('tb-biome').textContent = run.mode === 'generated' ? 'Generated · ' + B.biomes[run.biome].name : run.mode === 'channel' ? 'Open Channel' : run.mode === 'catalog' ? run.worldName : 'Temperate Meadow';
    $('tb-round').textContent = 'Round ' + run.round;
    $('tb-of').textContent = 'of ' + B.maxRounds + ' · Simulate';
    // season bar
    const sb = $('tb-season');
    if (!sb.children.length) sb.append(el('div', { class: 'labels' }), el('div', { class: 'segs' }, el('i'), el('i'), el('i'), el('i')));
    const labels = sb.firstChild;
    labels.innerHTML = '';
    B.seasons.forEach((s, k) => {
      if (k === w.seasonIdx) labels.append(el('b', { text: s.name + ' · light ' + Math.round(w.lightFrac * 100) + '%' }));
      else if (Math.abs(k - w.seasonIdx) <= 1 || k === 0 || k === 3) labels.append(el('span', { text: s.name }));
    });
    const prog = (w.roundTick / (B.roundTicks / 4)) - w.seasonIdx;
    [...sb.lastChild.children].forEach((seg, k) => {
      seg.className = k < w.seasonIdx ? 'done' : k === w.seasonIdx ? 'now' : '';
      seg.style.setProperty('--p', Math.min(100, prog * 100) + '%');
    });
    const ev = run.activeEvents.find(a => a.left > 0) || run.eventThisRound;
    const chip = $('tb-event');
    if (ev) { const d = T.EVENTS.find(x => x.id === ev.id); chip.hidden = false; chip.textContent = d.name + ' · ' + d.chip; chip.className = 'chip ' + (ev.id === 'bloom' ? 'chip-green' : 'chip-gold'); }
    else chip.hidden = true;
    const left = Math.max(0, B.roundTicks - w.roundTick) / B.ticksPerSecond;
    $('tb-timer').textContent = pad2(Math.floor(left / 60)) + ':' + pad2(Math.floor(left % 60));
    document.querySelectorAll('#screen-world .speed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === (G.paused ? 0 : G.speed)));

    UI.updatePyramid();
    UI.updateRightPanel();
    UI.updateDirectives();
    UI.updateTint();
    $('btn-clear-marker').hidden = !w.marker;
    $('btn-marker').classList.toggle('placing', !!G.placing);
    $('marker-status').textContent = G.placing ? 'click the map' : w.marker ? 'T · placed' : 'T · ready';

    const dbg = $('debug-overlay');
    dbg.hidden = !G.settings.debug;
    if (G.settings.debug) {
      const L = w.ledger;
      dbg.textContent = 'tick ' + w.t + '  entities ' + w.ents.length + '  carrion ' + w.carrion.length + '\nsim ' + (G.tickMs || 0).toFixed(2) + ' ms/tick' +
        '\nledger err ' + (L.lastErr * 100).toFixed(5) + '% (max ' + (L.maxErr * 100).toFixed(5) + '%)\ncaptured ' + fmt(L.captured) + '  heat ' + fmt(L.heat);
    }
  };

  // Pyramids of numbers, biomass and energy (textbook levels, top row first). Numbers and biomass may invert;
  // energy always narrows. Bars use a log scale because the levels span several orders of magnitude.
  UI.pyrKind = 'energy';
  UI.pyrAt = 0;
  const PYR_CAPTION = {
    numbers: 'Individuals at each level right now',
    biomass: 'Standing crop at each level right now, g/m²',
    energy: 'Energy fixed at each level this round',
  };
  UI.updatePyramid = function () {
    const w = G.world, p = w.player;
    const box = $('pyramid');
    const now = performance.now();
    if (box.children.length && now - UI.pyrAt < 500) return;   // recount twice a second, not every frame
    UI.pyrAt = now;
    const levels = T.Energy.PYRAMID_LEVELS;
    if (!box.children.length) {
      for (let k = levels.length - 1; k >= 0; k--) {
        const L = levels[k];
        box.append(el('div', { class: 'pyr-row', 'data-k': k },
          el('div', { class: 'pyr-label' }, el('span', { text: L.name }), el('span', null, el('b'), el('em'))),
          el('div', { class: 'pyr-bar', style: { background: T.LEVELS[L.key].color } }, el('i', { class: 'you' }))));
      }
    }
    const kind = UI.pyrKind;
    document.querySelectorAll('#pyr-tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
    $('pyr-caption').textContent = PYR_CAPTION[kind];
    const pd = T.Energy.pyramids(w);
    const vals = pd[kind];
    const logMax = Math.log10(1 + Math.max(1, ...vals));
    // The player's share of their row: individuals, standing crop, or energy assimilated this round.
    const pk = levels.findIndex(L => L.levels.includes(p.level));
    let mine = 0;
    if (kind === 'energy') {
      let rowAs = 0;
      w.species.forEach((sp, i) => { if (levels[pk].levels.includes(sp.level)) rowAs += w.rstats[i].assimilated; });
      mine = rowAs > 0 ? w.rstats[p.idx].assimilated / rowAs : 0;
    } else {
      let n = 0, b = 0, rn = 0, rb = 0;
      for (const e of w.ents) {
        if (!e.alive || !levels[pk].levels.includes(e.sp.level)) continue;
        rn++; rb += e.E + e.tissue;
        if (e.sp === p) { n++; b += e.E + e.tissue; }
      }
      mine = kind === 'numbers' ? (rn ? n / rn : 0) : rb ? b / rb : 0;
    }
    for (const row of box.children) {
      const k = +row.dataset.k, v = vals[k];
      row.querySelector('.pyr-bar').style.width = (v > 0 ? 6 + 94 * (Math.log10(1 + v) / logMax) : 0) + '%';
      row.querySelector('.you').style.width = (k === pk ? mine * 100 : 0) + '%';
      const text = kind === 'biomass' ? (v >= 10 ? fmt(v) : v.toFixed(v >= 1 ? 1 : 2)) + ' g/m²' : kind === 'energy' ? fmt(v) + ' EU' : v >= 10 ? fmt(v) : v.toFixed(v > 0 ? 2 : 0);
      row.querySelector('b').textContent = text;
      // Energy: the share passed up from the level below (the 10% rule).
      row.querySelector('em').textContent = kind === 'energy' && k > 0 && vals[k - 1] > 0 && v > 0 ? '▲ ' + (v / vals[k - 1] >= 0.01 ? pct(v / vals[k - 1]) : '<1%') : '';
      row.classList.toggle('player', k === pk);
    }
    const note = kind === 'energy'
      ? (pd.violations.length ? 'Energy failed to narrow at ' + pd.violations.map(k => levels[k].name.toLowerCase()).join(', ') + ' this round.' : null)
      : T.Energy.inversionNote(pd, kind);
    $('pyr-note').hidden = !note;
    $('pyr-note').textContent = note || '';
    UI.updateCycles();
    const pyr = w.pyramid();
    const share = pyr.levels[p.level] > 0 ? pyr.player[p.level] / pyr.levels[p.level] : 0;
    $('share-note').textContent = 'Your share of ' + T.LEVELS[p.level].name.toLowerCase() + ': ' + pct(share) + ' (need ' + pct(B.dominanceShare) + ')';
    $('sun-note').textContent = 'Sunlight captured this tick: ' + fmt(w.capturedTick) + ' EU';
  };

  // Nitrogen, water and carbon for the whole map, this round (Phase 3 cycles).
  UI.updateCycles = function () {
    const w = G.world, box = $('cycles-strip');
    const s = w.soilSummary();
    const row = (label, value) => el('div', { class: 'cy-row' }, el('span', { text: label }), el('b', { text: value }));
    const sign = v => (v >= 0 ? '+' : '−') + fmt(Math.abs(v));
    const n = el('div', { class: 'cy-block' }, el('div', { class: 'cy-title', text: 'Soil nitrogen' }),
      row('Ammonium · nitrate', fmt(s.nh4) + ' · ' + fmt(s.no3)),
      row('Fixed this round', '+' + fmt(s.fixation)),
      row('Lost (denitrified, leached)', '−' + fmt(s.losses)));
    if (s.nLimitedShare > 0.1) n.append(el('div', { class: 'cy-warn', text: 'Plant growth is nitrogen-limited ' + pct(s.nLimitedShare) + ' of the time' }));
    const water = el('div', { class: 'cy-block' }, el('div', { class: 'cy-title', text: 'Water' }),
      row('Soil moisture', pct(s.moisture)),
      row('Water table, vs start', pct(s.waterTable)),
      row('Compacted · waterlogged', pct(s.compactedShare) + ' · ' + pct(s.waterloggedShare)));
    const carbon = el('div', { class: 'cy-block' }, el('div', { class: 'cy-title', text: 'Carbon' }),
      row(s.carbonBalance >= 0 ? 'Net sink this round' : 'Net source this round', sign(s.carbonBalance)),
      row('CO₂', Math.round(s.co2) + ' ppm' + (s.tOffset > 0.05 ? ' · +' + s.tOffset.toFixed(1) + ' °C' : '')));
    box.replaceChildren(n, water, carbon);
  };

  // A Population: one species' group in one connected region. Individuals in small-taxa Populations can't be
  // selected; herds, packs and flocks list their members instead.
  UI.renderRegionInspector = function (box, sel, close) {
    const w = G.world, sp = w.species[sel.region.sp];
    const r = sp && w.regionById(sp.idx, sel.region.id);
    if (!r) { box.hidden = true; G.renderer.selected = null; return; }
    box.append(el('div', { class: 'ins-head' }, shapeIcon(sp.level, sp.hue), el('b', { text: sp.name + ' · ' + r.label }),
      el('span', { class: 'caption', text: sp.grid ? '· Population' : '· group' }), close));
    const trend = r.n0 > 0 ? r.n / r.n0 - 1 : 0;
    const kv = el('div', { class: 'ins-kv' },
      el('div', null, 'N ', el('b', { text: fmt(Math.round(r.n)) })),
      el('div', null, 'Area ', el('b', { text: r.area + ' tiles' })),
      el('div', null, 'Density ', el('b', { text: (r.density || 0).toFixed(1) + ' / tile' })),
      el('div', null, 'Since round start ', el('b', { text: (trend >= 0 ? '+' : '') + Math.round(trend * 100) + '%' })));
    box.append(kv);
    if (sp.grid) {
      const a = { j: 0, b: 0, o: 0 }, g = sp.grid;
      for (const i of r.tiles) { a.j += g.nJ[i]; a.b += g.nA[i]; a.o += g.nO[i]; }
      box.append(el('div', { class: 'ins-kv' },
        el('div', null, 'Juveniles ', el('b', { text: fmt(Math.round(a.j)) })),
        el('div', null, 'Breeding ', el('b', { text: fmt(Math.round(a.b)) })),
        el('div', null, 'Post-reproductive ', el('b', { text: fmt(Math.round(a.o)) }))));
    } else if (r.members && r.members.length) {
      const list = el('div', { class: 'ins-kv' });
      for (const id of r.members.slice(0, 8)) {
        const e = w.ents.find(x => x.id === id && x.alive);
        if (e) list.append(el('button', { class: 'linklike', text: '#' + String(e.num).padStart(4, '0'), onclick: () => { G.renderer.selected = { ent: e }; UI.renderInspector(); } }));
      }
      if (r.members.length > 8) list.append(el('span', { class: 'caption', text: '+' + (r.members.length - 8) + ' more' }));
      box.append(list);
    }
    const hist = (r.history || []).slice(-3).map(h => 'Round ' + h.round + ': ' + h.text);
    box.append(el('p', { class: 'caption', text: (hist.length ? hist.join(' · ') + '. ' : 'Formed round ' + r.born + '. ') +
      (sp.grid ? 'Simulated as a Population: individuals can\'t be selected.' : 'The combined home ranges of its members.') }));
    UI.placeInspector(((r.tiles[0] % w.N) + 0.5), (((r.tiles[0] / w.N) | 0) + 0.5));
  };

  UI.updateRightPanel = function () {
    const w = G.world, run = G.run, p = w.player;
    $('pr-name').textContent = p.name;
    $('pr-sub').textContent = 'Your lineage · ' + T.LEVELS[p.level].short.toLowerCase();
    const ic = $('pr-icon');
    if (ic.dataset.key !== p.spriteKey) {
      ic.dataset.key = p.spriteKey;
      const { ctx } = hiDPI(ic, 44, 44);
      ctx.clearRect(0, 0, 44, 44);
      ctx.fillStyle = T.speciesColor(p.level, p.hue, 0.6);
      ctx.beginPath(); ctx.arc(22, 22, 21, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = T.speciesColor(p.level, p.hue, 0); ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      T.iconPath(ctx, T.LEVELS[p.level].shape, 22, 23, 9); ctx.fill(); ctx.stroke();
    }
    let n = 0, e = 0, juv = 0;
    const fr = [];
    for (const x of w.ents) if (x.alive && x.sp === p) { n++; const f = x.E / x.st.maxE; e += f; fr.push(f); if (x.grow < 1) juv++; }
    const rs = w.rstats[p.idx];
    let deaths = 0, eaten = 0, starved = 0;
    for (const k in rs.deaths) { deaths += rs.deaths[k]; if (k.startsWith('k:')) eaten += rs.deaths[k]; if (k.startsWith('starved')) starved += rs.deaths[k]; }
    $('pr-pop').textContent = n;
    $('pr-pop-sub').textContent = 'started round at ' + rs.startPop;
    $('pr-energy').textContent = n ? pct(e / n) : '—';
    $('pr-energy').style.color = n && e / n < 0.25 ? 'var(--bad)' : '';
    $('pr-births').textContent = rs.births;
    $('pr-births-sub').textContent = juv + ' still juvenile';
    $('pr-deaths').textContent = deaths;
    $('pr-deaths-sub').textContent = eaten + ' eaten · ' + starved + ' starved';
    UI.drawEnergyStrip($('pr-energy-strip'), fr);
    UI.renderRivals($('rival-list'), true);
  };

  UI.drawEnergyStrip = function (cv, fracs) {
    const { ctx, W, H } = hiDPI(cv, cv.clientWidth || 240, 16);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#E7E0CD'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(201,72,63,0.12)'; ctx.fillRect(0, 0, W * B.starvationThreshold, H);
    const bins = new Array(25).fill(0);
    for (const f of fracs) bins[Math.min(24, Math.floor(f * 25))]++;
    const mx = Math.max(1, ...bins);
    bins.forEach((b, k) => {
      if (!b) return;
      const h = 3 + (H - 4) * (b / mx);
      ctx.fillStyle = ACCENT;
      ctx.fillRect((k / 25) * W + 1, H - h, W / 25 - 2, h);
    });
    ctx.fillStyle = INK;
    ctx.fillRect(W * B.starvationThreshold, 0, 1.5, H);
    ctx.fillRect(W * B.breedingThreshold, 0, 1.5, H);
  };

  UI.renderRivals = function (ul, live) {
    const run = G.run, w = G.world;
    ul.innerHTML = '';
    const pops = w.countPops().count;
    const def = run.rivals.filter(r => r.defeated).length;
    if (live) $('rivals-count').textContent = def + ' of ' + run.rivals.length + ' defeated';
    if (!run.rivals.length) { ul.append(el('li', { class: 'caption', text: 'No rivals share your niche.' })); return; }
    for (const r of run.rivals) {
      const sp = w.speciesById(r.id);
      const n = sp ? pops[sp.idx] : 0;
      const frac = n / Math.max(1, r.startPop);
      const low = !r.defeated && frac < B.rivalDefeatFrac;
      const preys = sp && w.player && w.edible[sp.idx][w.player.idx];
      let val, sub;
      if (r.defeated) { val = 'defeated'; sub = 'round ' + r.defeatedRound; }
      else if (preys && r.startPop <= 6) { val = n + ' of ' + r.startPop; sub = 'preys on you'; }
      else { val = pct(frac); sub = low ? (r.low + 1 === 1 ? '1st' : '2nd') + ' round < 10%' : 'of start'; }
      ul.append(el('li', { class: r.defeated ? 'defeated' : low ? 'warn' : '', title: r.why },
        sp ? shapeIcon(sp.level, sp.hue) : el('i'), el('span', { class: 'nm', text: r.name }),
        el('span', { class: 'val' }, val, el('small', { text: sub })),
        !live ? el('span', { class: 'why', text: r.why }) : null));
    }
  };

  UI.updateDirectives = function () {
    const w = G.world;
    const active = w.activeDirective();
    document.querySelectorAll('#directives .dir-btn').forEach(b => {
      const id = b.dataset.dir;
      const ready = w.directiveReady[id] || 0;
      const cooling = w.t < ready && active !== id;
      b.classList.toggle('active', active === id);
      const noMeat = id === 'hunt' && !w.player.stats.canMeat;
      b.disabled = noMeat;
      let p = 0, st = '';
      if (active === id) { p = 100 * (1 - (w.directive.until - w.t) / B.directiveDuration); st = 'Active'; }
      else if (cooling) { p = 100 * ((ready - w.t) / B.directiveCooldown); st = Math.ceil((ready - w.t) / B.ticksPerSecond) + ' s'; }
      if (id === 'isolate' && !cooling && w.isoCounter) st = 'set';
      b.querySelector('.ico').style.setProperty('--p', p + '%');
      b.querySelector('.st').textContent = st;
    });
  };

  UI.updateTint = function () {
    const w = G.world, p = w && w.player;
    if (!p) return;
    const gi = T.G[G.renderer.tint.gene];
    let lo = Infinity, hi = -Infinity;
    for (const e of w.ents) if (e.alive && e.sp === p) { lo = Math.min(lo, e.g[gi]); hi = Math.max(hi, e.g[gi]); }
    const spans = $('tint-scale').children;
    if (lo === Infinity) { spans[0].textContent = spans[1].textContent = spans[2].textContent = ''; return; }
    spans[0].textContent = lo.toFixed(2) + ' low';
    spans[1].textContent = 'mean ' + p.mean[gi].toFixed(2);
    spans[2].textContent = 'high ' + hi.toFixed(2);
  };

  // ---------- inspector ----------

  const STATE_TEXT = {
    graze: e => (e.food === 'fruit' ? 'Eating fruit' : e.food === 'detr' ? 'Decomposing detritus' : 'Grazing ' + ((G.world.producers[G.world.ptype[e.ti]] || {}).name || '')),
    hunt: e => 'Hunting ' + (e.te ? e.te.sp.name : 'prey'),
    fight: e => 'Charging ' + (e.te ? e.te.sp.name : 'an attacker'),
    flee: e => 'Fleeing ' + (e.threat ? e.threat.sp.name : 'danger'),
    scavenge: e => 'Eating ' + (e.tc && e.tc.src ? e.tc.src + ' carcass' : 'carrion'),
    wander: e => (e.sp.isPlayer && G.world.marker ? 'Roaming its territory' : 'Wandering'),
    seek: () => 'Looking for a mate', migrate: () => 'Migrating', swarm: () => 'Swarming to the marker', hide: () => 'Hiding', rest: () => 'Resting',
  };

  function inspectorGenes(sp) {
    const keys = ['speed', sp.stats.canMeat ? 'bite' : 'plantGut', 'senses', sp.stats.canMeat ? 'meatGut' : 'camo', 'boldness', 'aggression'];
    for (const k of ['armor', 'spines', 'venom', 'burrow', 'camo']) if (keys.length < 7 && !keys.includes(k) && sp.mean[T.G[k]] > 0.3) keys.push(k);
    return keys;
  }

  UI.renderInspector = function () {
    const box = $('inspector');
    const sel = G.renderer.selected;
    const w = G.world;
    if (!sel || G.state !== 'simulate') { box.hidden = true; return; }
    if (sel.ent && !sel.ent.alive) { box.hidden = true; G.renderer.selected = null; return; }
    box.hidden = false;
    box.innerHTML = '';
    const close = el('button', { class: 'close', 'aria-label': 'Close inspector', html: '&times;', onclick: () => { G.renderer.selected = null; box.hidden = true; } });
    if (sel.region) {
      UI.renderRegionInspector(box, sel, close);
      return;
    }
    if (sel.ent) {
      const e = sel.ent, sp = e.sp, st = e.st;
      const stage = e.grow < 1 ? 'juvenile' : e.age > e.life * 0.8 ? 'elder' : 'adult';
      box.append(el('div', { class: 'ins-head' }, shapeIcon(sp.level, sp.hue), el('b', { text: sp.name + ' #' + String(e.num).padStart(4, '0') }),
        el('span', { class: 'caption', text: '· ' + stage }), close));
      box.append(el('div', { class: 'ins-kv' },
        el('div', null, 'Energy ', el('b', { text: Math.round(e.E) + ' / ' + Math.round(st.maxE) + ' EU' })),
        el('div', null, 'Age ', el('b', { text: (e.age / B.roundTicks).toFixed(1) + ' / ' + (e.life / B.roundTicks).toFixed(1) + ' rounds' })),
        el('div', null, 'Parents ', el('b', { text: e.parents ? '#' + String(e.parents[0]).padStart(4, '0') + ' × #' + String(e.parents[1]).padStart(4, '0') : 'founder' })),
        el('div', null, 'Offspring ', el('b', { text: String(e.offspring) })),
        (() => {
          const rid = sp.regionMap ? sp.regionMap[w.tileAt(e.x, e.y)] : 0, reg = rid && w.regionById(sp.idx, rid);
          return reg ? el('div', null, 'Group ', el('button', { class: 'linklike', text: reg.label + ' (' + reg.n + ')', onclick: () => { G.renderer.selected = { region: { sp: sp.idx, id: rid } }; UI.renderInspector(); } })) : el('span');
        })(),
        el('div', { style: { gridColumn: '1 / -1' } }, (STATE_TEXT[e.state] || (() => e.state))(e) + (e.E < B.starvationThreshold * st.maxE ? ' · starving' : ''))));
      const rows = el('div', { class: 'gene-rows' }, el('div', { class: 'hdr' }, el('span', { text: 'Genes vs species mean' }), el('span', { text: '| Mean' })));
      for (const k of inspectorGenes(sp)) {
        const d = T.GENE_BY_KEY[k];
        const v = e.g[d.i], m = sp.mean[d.i];
        const f = x => ((x - d.min) / (d.max - d.min)) * 100 + '%';
        rows.append(el('div', { class: 'gene-row' }, el('span', { text: d.name.split(' ·')[0].replace(' / claws', '') }),
          el('div', { class: 'trk' }, el('i', { class: 'm', style: { left: f(m) } }), el('i', { class: 'd', style: { left: f(v) } })),
          el('span', { class: 'v' }, v.toFixed(2) + ' ', el('span', { class: v - m >= 0 ? 'pos' : 'neg', text: signed(v - m) }))));
      }
      box.append(rows);
      if (sp.isPlayer) {
        const run = G.run;
        const cd = Math.max(0, w.cullReady - w.t);
        box.append(el('div', { class: 'ins-actions' },
          el('button', { class: 'btn accent', disabled: run.championUsed || run.mp < 2 || e.grow < 1, onclick: () => G.champion(e),
            text: e.champ ? 'Champion ★' : 'Champion · 2 MP' }),
          el('button', { class: 'btn cull', disabled: cd > 0, onclick: () => G.cull(e), text: cd > 0 ? 'Cull · ' + Math.ceil(cd / B.ticksPerSecond) + ' s' : 'Cull · ready' })));
      }
      UI.placeInspector(e.x, e.y);
    } else {
      const i = sel.tile, t = w.ptype[i], P = t ? w.producers[t] : null;
      const light = B.sunlightPerTile * w.lightFrac * w.shade[i];
      box.append(el('div', { class: 'ins-head' }, shapeIcon('producer', P ? P.hue : 0), el('b', { text: P ? P.name : 'Open water' }), close));
      const kv = el('div', { class: 'ins-kv' });
      if (P) kv.append(el('div', null, 'Stored ', el('b', { text: fmt(w.pE[i]) + ' / ' + fmt(P.max) + ' EU' })));
      kv.append(el('div', null, 'Light ', el('b', { text: light.toFixed(1) + ' EU/t' })),
        el('div', null, 'Ammonium · nitrate ', el('b', { text: w.nh4[i].toFixed(2) + ' · ' + w.no3[i].toFixed(2) })),
        el('div', null, 'Moisture ', el('b', { text: pct(w.moist[i]) })));
      if (!w.terrain[i]) {
        const anaerobic = w.sw[i] > B.water.waterlogged ? 'waterlogged · denitrifying' : w.comp[i] > B.soil.anaerobicAt ? 'compacted · denitrifying' : null;
        kv.append(el('div', null, 'Compaction ', el('b', { text: pct(w.comp[i]) })));
        if (anaerobic) kv.append(el('div', null, 'Soil ', el('b', { text: anaerobic })));
        if (w.peat[i] > 1) kv.append(el('div', null, 'Peat ', el('b', { text: fmt(w.peat[i]) + ' EU' })));
      }
      if (P && P.fixer) kv.append(el('div', null, 'Legume ', el('b', { text: 'fixes nitrogen' })));
      if (w.fruit[i] > 0.5) kv.append(el('div', null, 'Fruit ', el('b', { text: fmt(w.fruit[i]) + ' EU' })));
      box.append(kv);
      if (P) {
        const pm = w.producerMeans()[t];
        const rows = el('div', { class: 'gene-rows' }, el('div', { class: 'hdr' }, el('span', { text: 'Tile genes vs ' + P.name + ' mean' }), el('span')));
        const row = (name, v, m, lo, hi) => rows.append(el('div', { class: 'gene-row' }, el('span', { text: name }),
          el('div', { class: 'trk' }, el('i', { class: 'm', style: { left: ((m - lo) / (hi - lo)) * 100 + '%' } }), el('i', { class: 'd', style: { left: ((v - lo) / (hi - lo)) * 100 + '%' } })),
          el('span', { class: 'v' }, v.toFixed(2) + ' ', el('span', { class: v - m >= 0 ? 'pos' : 'neg', text: signed(v - m) }))));
        row('Growth', w.pgGrowth[i], pm.growth, 0.6, 1.4);
        row('Toughness', w.pgTough[i], pm.tough, 0, 3);
        row('Moisture fit', w.pgTol[i], pm.tol, 0, 1);
        box.append(rows, el('p', { class: 'caption', text: P.note }));
      }
      UI.placeInspector((i % w.N) + 0.5, ((i / w.N) | 0) + 0.5);
    }
  };

  UI.placeInspector = function (tx, ty) {
    const box = $('inspector'), r = G.renderer;
    if (window.innerWidth <= 900) return;
    const [sx, sy] = r.worldToScreen(tx * B.tilePx, ty * B.tilePx);
    const W = box.offsetWidth || 320, H = box.offsetHeight || 300;
    let x = sx + 28, y = sy - H / 2;
    if (x + W > r.w - 56) x = sx - W - 28;
    x = Math.max(8, Math.min(r.w - W - 8, x));
    y = Math.max(8, Math.min(r.h - H - 8, y));
    box.style.left = x + 'px'; box.style.top = y + 'px';
  };

  // ---------- charts ----------

  // Histogram of a gene across the population: solid line = mean, dashed = last round's mean.
  UI.drawHist = function (cv, vals, d, mean, last) {
    const { ctx, W, H } = hiDPI(cv, cv.clientWidth || 200, 38);
    ctx.clearRect(0, 0, W, H);
    if (!vals.length) return;
    let sd = 0;
    for (const v of vals) sd += (v - mean) * (v - mean);
    sd = Math.sqrt(sd / vals.length);
    const half = Math.max(sd * 3.2, d.step * 1.2, (d.max - d.min) * 0.06);
    const lo = Math.max(d.min, mean - half), hi = Math.min(d.max, mean + half);
    const nb = 22, bins = new Array(nb).fill(0);
    for (const v of vals) bins[Math.max(0, Math.min(nb - 1, Math.floor(((v - lo) / (hi - lo || 1)) * nb)))]++;
    const mx = Math.max(...bins, 1);
    const bw = W / nb;
    ctx.fillStyle = '#9CC3C6';
    bins.forEach((b, k) => { if (b) { const h = 2 + (H - 6) * (b / mx); ctx.fillRect(k * bw + 1, H - h, bw - 2, h); } });
    const xOf = v => ((v - lo) / (hi - lo || 1)) * W;
    if (last != null && last >= lo && last <= hi) {
      ctx.strokeStyle = '#555C55'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(xOf(last), 0); ctx.lineTo(xOf(last), H); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = INK; ctx.fillRect(xOf(mean) - 1, 0, 2, H);
  };

  UI.radarValues = function (st) {
    const eff = Math.max(st.canPlants ? st.plantA * st.P : 0, st.canMeat ? st.meatA * st.P : 0);
    const effTop = B.legacyMealP ? 0.3 : 0.9;   // Phase 3 has no per-meal P, so assimilation alone fills the axis
    return [
      Math.min(1, (st.dmg * (1 + 0.25 * st.venom)) / 50), Math.min(1, (st.armor + st.reflect + st.maxHp / 150) / 1.4),
      Math.min(1, st.speed / 0.32), Math.min(1, st.sight / 13), Math.min(1, eff / effTop),
      Math.min(1, (st.litter / 4) * 0.6 + (1 - st.breedCd / 420) * 0.4 + 0.1),
    ];
  };

  UI.drawRadar = function (cv, now, was) {
    const { ctx, W, H } = hiDPI(cv, cv.clientWidth || 260, (cv.clientWidth || 260) * 0.85);
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 + 4, R = Math.min(W, H) * 0.33;
    const axes = ['Offense', 'Defense', 'Speed', 'Senses', 'Efficiency', 'Fertility'];
    const pt = (k, r) => { const a = -Math.PI / 2 + (k * Math.PI * 2) / 6; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    ctx.strokeStyle = '#DCD3C0'; ctx.lineWidth = 1;
    for (let r = 1; r <= 4; r++) { ctx.beginPath(); for (let k = 0; k <= 6; k++) { const [x, y] = pt(k % 6, (R * r) / 4); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    ctx.fillStyle = '#555C55'; ctx.font = '11px "IBM Plex Sans", system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    axes.forEach((n, k) => { const [x, y] = pt(k, R); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); const [lx, ly] = pt(k, R + 18); ctx.fillText(n, lx, ly); });
    const poly = (v, stroke, fill, dash) => {
      ctx.beginPath();
      v.forEach((val, k) => { const [x, y] = pt(k, R * Math.max(0.05, val)); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.setLineDash(dash || []);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    };
    if (was) poly(UI.radarValues(was), '#8C8A80', null, [4, 3]);
    poly(UI.radarValues(now), ACCENT, 'rgba(29,101,112,0.18)');
  };

  // Sankey: sources → Eaten → {Assimilated, Egested}; Assimilated → {New tissue, Metabolism → heat}.
  // New tissue is GSP minus all respiration (NSP). When a species burned reserves, it shows as zero.
  UI.drawSankey = function (box, rs, spName) {
    box.innerHTML = '';
    const src = Object.entries(rs.eaten).sort((a, b) => b[1] - a[1]);
    const eaten = src.reduce((a, b) => a + b[1], 0);
    if (eaten < 1) { box.append(el('p', { class: 'caption', text: 'Nothing eaten this round.' })); return 0; }
    const top = src.slice(0, 4), rest = src.slice(4).reduce((a, b) => a + b[1], 0);
    if (rest > 0) top.push(['Other food', rest]);
    const W = 900, Hh = 300, NW = 12, MINH = 26;
    // Scale so the eaten column fits; small sources still get room for their two-line label.
    const k = (Hh - 40 - 10 * (top.length - 1) - MINH * top.length * 0.5) / eaten;
    const s = svg('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Energy flow diagram' });
    let y = 20;
    const srcNodes = top.map(([name, v]) => { const h = Math.max(2, v * k); const n = { name, v, y, h, color: sourceColor(name) }; y += Math.max(h, MINH) + 10; return n; });
    const eatenNode = { x: 280, y: 20, h: eaten * k };
    const assim = rs.assimilated, exc = rs.excreted;
    const resp = rs.upkeepHeat + rs.digestHeat;
    const gain = Math.max(0, assim - resp), heat = assim - gain;
    const aNode = { x: 560, y: 20, h: assim * k }, xNode = { x: 560, y: 20 + assim * k + 20, h: exc * k };
    const gNode = { x: W - NW - 150, y: 20, h: gain * k }, hNode = { x: W - NW - 150, y: 20 + gain * k + 20, h: heat * k };
    const band = (x0, y0, x1, y1, h, color, op) => {
      const xm = (x0 + x1) / 2;
      s.append(svg('path', { d: 'M' + x0 + ',' + y0 + ' C' + xm + ',' + y0 + ' ' + xm + ',' + y1 + ' ' + x1 + ',' + y1 + ' L' + x1 + ',' + (y1 + h) + ' C' + xm + ',' + (y1 + h) + ' ' + xm + ',' + (y0 + h) + ' ' + x0 + ',' + (y0 + h) + ' Z', fill: color, 'fill-opacity': op || 0.45 }));
    };
    const SX = 130;
    let ey = eatenNode.y;
    for (const n of srcNodes) { band(SX + NW, n.y, eatenNode.x, ey, n.h, n.color); ey += n.h; }
    band(eatenNode.x + NW, eatenNode.y, aNode.x, aNode.y, aNode.h, ACCENT, 0.35);
    band(eatenNode.x + NW, eatenNode.y + aNode.h, xNode.x, xNode.y, xNode.h, '#8C8A80', 0.35);
    band(aNode.x + NW, aNode.y, gNode.x, gNode.y, gNode.h, ACCENT, 0.5);
    band(aNode.x + NW, aNode.y + gNode.h, hNode.x, hNode.y, hNode.h, '#E0813A', 0.35);
    const rect = (x, y2, h, c) => s.append(svg('rect', { x, y: y2, width: NW, height: Math.max(2, h), fill: c, rx: 2 }));
    const label = (x, y2, a, b, anchor) => s.append(svg('text', { x, y: y2, 'text-anchor': anchor || 'start' }, svg('tspan', { class: 'lbl', x, dy: 0 }, a), svg('tspan', { class: 'val', x, dy: 14 }, b)));
    for (const n of srcNodes) { rect(SX, n.y, n.h, n.color); label(SX - 8, n.y + n.h / 2 - 4, n.name, fmt(n.v) + ' EU', 'end'); }
    rect(eatenNode.x, eatenNode.y, eatenNode.h, INK);
    s.append(svg('text', { x: eatenNode.x - 6, y: 12, class: 'lbl' }, 'Eaten ' + fmt(eaten)));
    rect(aNode.x, aNode.y, aNode.h, ACCENT);
    s.append(svg('text', { x: aNode.x - 6, y: 12, class: 'lbl' }, 'Assimilated ' + fmt(assim) + ' · assimilation ' + pct(assim / eaten)));
    rect(xNode.x, xNode.y, xNode.h, '#8C8A80');
    label(xNode.x + NW + 8, xNode.y + xNode.h / 2 - 4, 'Egested → detritus', fmt(exc) + ' EU · ' + pct(exc / eaten));
    rect(gNode.x, gNode.y, gNode.h, ACCENT);
    label(gNode.x + NW + 8, gNode.y + Math.max(8, gNode.h / 2) - 4, 'New tissue · growth ' + (assim > 0 ? pct(gain / assim) : '0%'), fmt(gain) + ' EU');
    rect(hNode.x, hNode.y, hNode.h, '#E0813A');
    label(hNode.x + NW + 8, hNode.y + hNode.h / 2 - 4, 'Metabolism → heat', fmt(heat) + ' EU · ' + pct(heat / eaten));
    box.append(s);
    return gain / eaten;
  };

  function sourceColor(name) {
    const w = G.world;
    const P = w.producers.find(p => p && p.name === name);
    if (P) return T.speciesColor('producer', P.hue, 0);
    if (name === 'Fruit') return '#D94F7A';
    if (name === 'Detritus') return '#8E7355';
    const sp = w.species.find(s => s.name === name);
    return sp ? T.speciesColor(sp.level, sp.hue, 0) : '#8C8A80';
  }
  UI.sourceColor = sourceColor;

  // Populations as a percent of round start, with the 10% defeat line.
  UI.drawPopChart = function (cv, rep) {
    const { ctx, W, H } = hiDPI(cv, cv.clientWidth || 360, Math.round((cv.clientWidth || 360) * 0.62));
    ctx.clearRect(0, 0, W, H);
    const L = 34, R = 8, Tp = 8, Bt = 22, pw = W - L - R, ph = H - Tp - Bt;
    const maxP = 1.5;
    const y = v => Tp + ph - (Math.min(maxP, v) / maxP) * ph;
    const x = t => L + (t / B.roundTicks) * pw;
    ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8C8A80'; ctx.strokeStyle = '#E7E0CD'; ctx.lineWidth = 1;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const v of [0, 0.5, 1, 1.5]) { ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(L + pw, y(v)); ctx.stroke(); ctx.fillText(Math.round(v * 100) + '%', L - 4, y(v)); }
    ctx.strokeStyle = '#C9483F'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(L, y(B.rivalDefeatFrac)); ctx.lineTo(L + pw, y(B.rivalDefeatFrac)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#C9483F'; ctx.textAlign = 'right'; ctx.fillText('Defeat line 10%', L + pw, y(B.rivalDefeatFrac) - 8);
    ctx.fillStyle = '#8C8A80'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    B.seasons.forEach((s, k) => ctx.fillText(s.name, x(((k + 0.5) * B.roundTicks) / 4), H - Bt + 6));
    const dashes = [[], [6, 3], [2, 3], [8, 3, 2, 3], [1, 2]];
    rep.lines.forEach((ln, n) => {
      ctx.beginPath();
      rep.history.pops.forEach((row, k) => { const v = (row[ln.idx] || 0) / Math.max(1, ln.start); const px = x(rep.history.t[k]), py = y(v); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.strokeStyle = ln.player ? ACCENT : T.speciesColor(ln.level, ln.hue, -0.05);
      ctx.lineWidth = ln.player ? 3 : 1.6;
      ctx.setLineDash(ln.player ? [] : dashes[n % dashes.length]);
      ctx.stroke(); ctx.setLineDash([]);
      ln.dash = ln.player ? [] : dashes[n % dashes.length];
    });
  };
})(window.Trophic);
