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
    $('zoom-in').addEventListener('click', () => { const r = G.renderer; r.zoomAt(r.w / 2, r.h / 2, 1.3); });
    $('zoom-out').addEventListener('click', () => { const r = G.renderer; r.zoomAt(r.w / 2, r.h / 2, 1 / 1.3); });
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
    for (const s of ['world', 'newworld', 'report', 'codex', 'end']) $('screen-' + s).hidden = s !== name;
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

  // ---------- legend ----------

  UI.buildLegend = function () {
    const box = $('level-legend');
    box.innerHTML = '';
    const names = { producer: 'Producer', herbivore: 'Herbivore', omnivore: 'Omnivore', carnivore1: 'Carnivore', carnivore2: 'Apex', decomposer: 'Decomposer' };
    for (const lv of T.LEVEL_ORDER) box.append(el('span', null, shapeIcon(lv), names[lv]));
  };

  // ---------- HUD ----------

  UI.updateHUD = function () {
    const w = G.world, run = G.run;
    if (!w || !run) return;
    $('tb-biome').textContent = run.worldName;
    $('tb-round').textContent = 'Round ' + run.round;
    $('tb-of').textContent = 'of ' + B.maxRounds + ' · ' + (G.state === 'plan' ? 'Plan' : 'Season');
    $('tb-sp').textContent = Math.round(run.sp);
    $('tb-ehi').textContent = run.ehiHistory.length ? run.ehi.total : '—';
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
    document.querySelectorAll('#screen-world .speed button').forEach(b => { b.classList.toggle('on', +b.dataset.speed === (G.paused ? 0 : G.speed)); b.disabled = G.state === 'plan'; });

    UI.updatePyramid();
    UI.renderStewardPanel();

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
    const w = G.world;
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
          el('div', { class: 'pyr-bar', style: { background: T.LEVELS[L.key].color } })));
      }
    }
    const kind = UI.pyrKind;
    document.querySelectorAll('#pyr-tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
    $('pyr-caption').textContent = PYR_CAPTION[kind];
    const pd = T.Energy.pyramids(w);
    const vals = pd[kind];
    const logMax = Math.log10(1 + Math.max(1, ...vals));
    for (const row of box.children) {
      const k = +row.dataset.k, v = vals[k];
      row.querySelector('.pyr-bar').style.width = (v > 0 ? 6 + 94 * (Math.log10(1 + v) / logMax) : 0) + '%';
      const text = kind === 'biomass' ? (v >= 10 ? fmt(v) : v.toFixed(v >= 1 ? 1 : 2)) + ' g/m²' : kind === 'energy' ? fmt(v) + ' EU' : v >= 10 ? fmt(v) : v.toFixed(v > 0 ? 2 : 0);
      row.querySelector('b').textContent = text;
      // Energy: the share passed up from the level below (the 10% rule).
      row.querySelector('em').textContent = kind === 'energy' && k > 0 && vals[k - 1] > 0 && v > 0 ? '▲ ' + (v / vals[k - 1] >= 0.01 ? pct(v / vals[k - 1]) : '<1%') : '';
    }
    const note = kind === 'energy'
      ? (pd.violations.length ? 'Energy failed to narrow at ' + pd.violations.map(k => levels[k].name.toLowerCase()).join(', ') + ' this round.' : null)
      : T.Energy.inversionNote(pd, kind);
    $('pyr-note').hidden = !note;
    $('pyr-note').textContent = note || '';
    UI.updateCycles();
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
    const sr = w.seralSummary(), bc = w.biomeClass;
    const sere = el('div', { class: 'cy-block' }, el('div', { class: 'cy-title', text: 'Succession · ' + bc.name }),
      row('Pioneers · grasses', pct(sr.share[1]) + ' · ' + pct(sr.share[2])),
      row('Shrubs · mature forest', pct(sr.share[3]) + ' · ' + pct(sr.share[4])),
      row('Climax', bc.climaxName));
    if (sr.share[0] > 0.02) sere.append(el('div', { class: 'cy-warn', text: pct(sr.share[0]) + ' bare rock or bare ground' }));
    box.replaceChildren(n, water, carbon, sere);
  };

  // A Population: one species' group in one connected region. Individuals in small-taxa Populations can't be
  // selected; herds, packs and flocks list their members instead.
  // Phase 3 demography for a species: N against K with its growth curve, last round's N1 = N0 + B + I − D − E,
  // and an age pyramid (juveniles, breeding adults, post-reproductive; males left, females right).
  const CURVE_TEXT = { exponential: 'exponential growth', logistic: 'logistic, toward K', stable: 'stable', overshoot: 'overshooting K',
    declining: 'declining', recolonizing: 'recolonizing', absent: 'absent' };
  function demographyBlock(sp) {
    const w = G.world;
    if (!w.demography) return null;
    const d = w.demography.find(x => x.id === sp.id);
    const n = w.countPops().count[sp.idx];
    const pool = w.pool && w.pool[sp.id];
    const wrap = el('div', { class: 'demog' });
    wrap.append(el('div', { class: 'ins-kv' },
      el('div', null, 'N / K ', el('b', { text: fmt(n) + ' / ' + (sp.K ? fmt(Math.round(sp.K)) : '—') })),
      el('div', null, 'Curve ', el('b', { text: d ? CURVE_TEXT[d.curve] || d.curve : 'first round' })),
      el('div', null, 'Mating ', el('b', { text: sp.mating || '—' })),
      el('div', null, 'Feeds in ', el('b', { text: T.STRATA[sp.strat != null ? sp.strat : 4] + (sp.hosts ? ' · follows ' + [...sp.hosts].map(h => w.species[h].name).join(', ') : '') + (sp.flags.cleaner ? ' · cleaner' : '') })),
      w.keystones && w.keystones[sp.id] ? el('div', null, 'Keystone ', el('b', { text: '★ −' + Math.round(w.keystones[sp.id].drop * 100) + '% without it' })) : el('span'),
      el('div', null, 'Regional pool ', el('b', { text: !pool ? '—' : pool.regionallyExtinct ? 'regionally extinct' : pool.poolOnly ? 'reintroduction only' : 'arrivals ' + Math.round(pool.level * 100) + '%' }))));
    if (d) wrap.append(el('p', { class: 'caption eq', text: 'Last round: N1 = N0 + B + I − D − E = ' + d.N0 + ' + ' + d.B + ' + ' + d.I + ' − ' + d.D + ' − ' + d.E + ' = ' + d.N1 +
      (d.r == null ? '' : ' · r = ' + (d.r >= 0 ? '+' : '') + d.r.toFixed(0) + '%') }));
    const a = w.ageStructure(sp), max = Math.max(1, a.juvenile[0], a.juvenile[1], a.breeding[0], a.breeding[1], a.post[0], a.post[1]);
    const pyr = el('div', { class: 'age-pyr', title: 'Age structure: males left, females right' });
    for (const [k, label] of [['post', 'Post-reproductive'], ['breeding', 'Breeding'], ['juvenile', 'Juvenile']]) {
      pyr.append(el('div', { class: 'age-row' },
        el('div', { class: 'bar m' }, el('i', { style: { width: (a[k][0] / max) * 100 + '%' } })),
        el('span', { text: label }),
        el('div', { class: 'bar f' }, el('i', { style: { width: (a[k][1] / max) * 100 + '%' } }))));
    }
    wrap.append(pyr);
    return wrap;
  }

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
    const dg = demographyBlock(sp);
    if (dg) box.append(dg);
    UI.placeInspector(((r.tiles[0] % w.N) + 0.5), (((r.tiles[0] / w.N) | 0) + 0.5));
  };

  // ---------- inspector ----------

  const STATE_TEXT = {
    graze: e => (e.food === 'fruit' ? 'Eating fruit' : e.food === 'detr' ? 'Decomposing detritus' : 'Grazing ' + ((G.world.producers[G.world.ptype[e.ti]] || {}).name || '')),
    hunt: e => 'Hunting ' + (e.te ? e.te.sp.name : 'prey'),
    fight: e => 'Charging ' + (e.te ? e.te.sp.name : 'an attacker'),
    flee: e => 'Fleeing ' + (e.threat ? e.threat.sp.name : 'danger'),
    scavenge: e => 'Eating ' + (e.tc && e.tc.src ? e.tc.src + ' carcass' : 'carrion'),
    wander: () => 'Wandering', follow: e => 'Following ' + (e.te ? e.te.sp.name : 'its host'), clean: e => 'Cleaning ' + (e.te ? e.te.sp.name : 'a host'),
    seek: () => 'Looking for a mate', migrate: () => 'Migrating', swarm: () => 'Swarming to the marker', hide: () => 'Hiding', rest: () => 'Resting',
  };

  // A species' fixed trait sheet (Phase 3): real values where the catalog has them, else the game's.
  function traitSheet(sp) {
    const st = sp.stats, m = sp.meta;
    const diet = st.meat >= 0.7 ? 'mostly meat' : st.meat <= 0.3 ? 'mostly plants' : 'plants and animals';
    const rows = [['Body mass', m && m.massKg ? (m.massKg >= 1 ? m.massKg.toFixed(m.massKg >= 10 ? 0 : 1) + ' kg' : Math.round(m.massKg * 1000) + ' g') : 'size ' + st.mass.toFixed(1)],
      ['Diet', diet], ['Metabolism', st.ecto ? 'ectotherm' : 'endotherm'], ['Lifespan', (st.lifeTicks / B.roundTicks).toFixed(1) + ' rounds'],
      ['Litter', String(st.litter)], ['Speed · senses', (st.speed * 10).toFixed(1) + ' · ' + st.sight.toFixed(0) + ' tiles']];
    if (m && m.sci) rows.unshift(['Species', m.sci + (m.native === false ? ' · non-native' : '') + (m.iucn && !['LC', 'DD', 'NE'].includes(m.iucn) ? ' · IUCN ' + m.iucn : '')]);
    return el('div', { class: 'ins-kv trait-sheet' }, rows.map(([k, v]) => el('div', null, k + ' ', el('b', { text: v }))));
  }

  UI.renderInspector = function () {
    const box = $('inspector');
    const sel = G.renderer.selected;
    const w = G.world;
    if (!sel || (G.state !== 'simulate' && G.state !== 'plan')) { box.hidden = true; return; }
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
        el('div', null, 'Sex ', el('b', { text: (e.sex === 'F' ? 'female' : 'male') + (e.terr ? ' · territory' : '') + (e.emigrating ? ' · emigrating' : '') })),
        e.sp.parasiteHost ? el('div', null, 'Parasites ', el('b', { text: e.para.toFixed(1) + ' EU' })) : el('span'),
        (() => {
          const rid = sp.regionMap ? sp.regionMap[w.tileAt(e.x, e.y)] : 0, reg = rid && w.regionById(sp.idx, rid);
          return reg ? el('div', null, 'Group ', el('button', { class: 'linklike', text: reg.label + ' (' + reg.n + ')', onclick: () => { G.renderer.selected = { region: { sp: sp.idx, id: rid } }; UI.renderInspector(); } })) : el('span');
        })(),
        el('div', { style: { gridColumn: '1 / -1' } }, (STATE_TEXT[e.state] || (() => e.state))(e) + (e.E < B.starvationThreshold * st.maxE ? ' · starving' : ''))));
      box.append(el('div', { class: 'eyebrow', text: 'Trait sheet · fixed for the species' }), traitSheet(sp));
      const dg = demographyBlock(sp);
      if (dg) box.append(dg);
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
      if (P && P.fixer) kv.append(el('div', null, 'Fixes nitrogen ', el('b', { text: P.habit === 'lichen' ? 'cyanobacteria (lichen)' : 'root nodules (legume)' })));
      if (!w.terrain[i] && w.som) {
        const stg = w.rock[i] ? 0 : P ? P.stage : 0;
        kv.append(el('div', null, 'Seral stage ', el('b', { text: (P || w.rock[i] ? T.SERAL_STAGES[stg] : 'Bare ground') + (w.burn[i] ? ' · burned' : '') })),
          el('div', null, 'Climax here ', el('b', { text: T.SERAL_STAGES[w.climaxAt(i)] })),
          el('div', null, 'Soil organic matter ', el('b', { text: fmt(w.som[i]) })));
        if (P && P.stage >= 3) kv.append(el('div', null, 'Age ', el('b', { text: w.sAge[i].toFixed(1) + ' / ' + P.longevity + ' rounds' })));
        const bank = [0, 1, 2].map(k => w.producers[w.bank[i * 3 + k]]).filter(Boolean).map(p => p.name);
        if (bank.length) kv.append(el('div', { style: { gridColumn: '1 / -1' } }, 'Seed bank ', el('b', { text: [...new Set(bank)].join(', ') })));
      }
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

  // Sankey: sources → Eaten → {Assimilated, Egested}; Assimilated → {New tissue, Metabolism → heat}.
  // rs is one species' round stats, or the consumers' combined (see T.StewardUI.combinedStats).
  // New tissue is GSP minus all respiration (NSP). When a species burned reserves, it shows as zero.
  UI.drawSankey = function (box, rs) {
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

  // Populations as a percent of round start.
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
    ctx.fillStyle = '#8C8A80'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    B.seasons.forEach((s, k) => ctx.fillText(s.name, x(((k + 0.5) * B.roundTicks) / 4), H - Bt + 6));
    const dashes = [[], [6, 3], [2, 3], [8, 3, 2, 3], [1, 2]];
    rep.lines.forEach((ln, n) => {
      ctx.beginPath();
      rep.history.pops.forEach((row, k) => { const v = (row[ln.idx] || 0) / Math.max(1, ln.start); const px = x(rep.history.t[k]), py = y(v); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.strokeStyle = T.speciesColor(ln.level, ln.hue, -0.05);
      ctx.lineWidth = 1.8;
      ctx.setLineDash(dashes[n % dashes.length]);
      ctx.stroke(); ctx.setLineDash([]);
      ln.dash = dashes[n % dashes.length];
    });
  };
})(window.Trophic);
