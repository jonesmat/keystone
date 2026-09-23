// Keystone — full screens from Keystone_UI_Design: New world, Species editor (Evolve), Selection report,
// Phylogeny, Codex and the run end screen.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE, UI = T.UI;
  const { el, svg, fmt, pct, plural, signed, shapeIcon, hiDPI } = UI;
  const $ = id => document.getElementById(id);
  const G_ = T.G;
  const INK = '#1F2A24', ACCENT = '#1D6570';
  let G = null;
  const S = (T.Screens = {});

  S.init = function (game) {
    G = game;
    document.querySelectorAll('#mode-tabs button').forEach(b => b.addEventListener('click', () => G.setMode(b.dataset.mode)));
    document.querySelectorAll('#founder-tabs button').forEach(b => b.addEventListener('click', () => G.setFounderTab(b.dataset.ftab)));
    $('nw-new').addEventListener('click', () => G.newSeed());
    $('nw-seed').addEventListener('change', e => G.setSeedString(e.target.value));
    $('nw-biome').addEventListener('change', e => G.setBiome(e.target.value));
    $('nw-begin').addEventListener('click', () => G.beginRun());
    $('nw-climate').addEventListener('change', e => G.setClimateTrend(e.target.checked));
    $('nw-eco').addEventListener('change', e => G.setEcoregion(e.target.value));
    $('nw-scen').addEventListener('change', e => G.setScenario(e.target.value));
    $('nw-reroll').addEventListener('click', () => G.rerollFounder());
    $('btn-continue').addEventListener('click', () => G.continueRun());
    // Generated worlds are land rosters; the aquatic Open Channel is listed but only reachable from its own tab.
    for (const k in B.biomes) {
      const b = B.biomes[k], opt = el('option', { value: k, text: b.name + ' · sunlight ' + Math.round(b.light * 100) + '%' });
      if (b.aquatic) opt.disabled = true;
      $('nw-biome').append(opt);
    }
    const seg = $('nw-difficulty');
    for (const k in B.difficulties) seg.append(el('button', { 'data-diff': k, text: B.difficulties[k].name, onclick: () => G.setDifficulty(k) }));
    const row = $('nw-tpl-row');
    for (const t of T.TEMPLATES) row.append(el('button', { 'data-tpl': t.id, onclick: () => G.selectTemplate(t.id) }, el('b', { text: t.name }), el('small', { text: t.niche + ' · ' + t.startPop })));
    $('ev-start').addEventListener('click', () => G.startSeason());
    $('ev-name').addEventListener('input', e => { const v = e.target.value.trim(); if (v) { G.run.speciesName = v; G.world.player.name = v; } });
    $('rp-continue').addEventListener('click', () => G.continueFromReport());
    $('end-new').addEventListener('click', () => G.showNewWorld());
    const f = $('ev-filters');
    for (const c of ['All'].concat(T.GENE_CATS)) f.append(el('button', { 'data-cat': c, text: c, onclick: () => { S.filter = c; S.renderEvolve(); } }));
    S.filter = 'All';
  };

  // ======================= New world =======================

  S.renderNewWorld = function (save) {
    const st = G.setup;
    document.querySelectorAll('#mode-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === st.mode)));
    $('continue-box').hidden = !save;
    if (save) {
      const r = save.run;
      $('continue-info').textContent = '— ' + r.speciesName + ', round ' + r.round + ' · ' + (r.mode === 'generated' ? 'generated world' : r.mode === 'channel' ? 'Open Channel' : r.mode === 'catalog' ? r.worldName : 'Temperate Meadow') + ' · ' + B.difficulties[r.difficulty].name;
    }
    const seedIn = $('nw-seed');
    if (document.activeElement !== seedIn) seedIn.value = st.seed;
    $('nw-biome').value = st.biome;
    $('nw-biome').disabled = st.mode !== 'generated';
    // Real ecoregion worlds: ecoregion and scenario pickers, and the seed to share.
    const cat = st.mode === 'catalog';
    $('nw-biome-field').hidden = cat;
    $('nw-eco-field').hidden = !cat;
    $('nw-scen-field').hidden = !cat;
    seedIn.maxLength = cat ? 32 : 10;
    if (cat) {
      const eco = $('nw-eco'), scen = $('nw-scen');
      eco.replaceChildren(...(T.CATALOG_INDEX || []).map(e => el('option', { value: e.code, text: e.code + ' ' + e.name + ' · ' + e.species + ' species' })));
      eco.value = st.ecoregion;
      const here = T.SCENARIOS.filter(s => s.ecoregion === st.ecoregion);
      scen.replaceChildren(...here.map(s => el('option', { value: s.id, text: s.name })), el('option', { value: '', text: 'Sandbox (no goals)' }));
      scen.value = st.scenario || '';
    }
    const share = $('nw-share');
    share.hidden = !(cat && st.roster && st.roster.seedString);
    if (!share.hidden) share.textContent = 'Share this world: ' + st.roster.seedString + ' (paste it into the seed box)';
    S.renderStability();
    renderRoster(st.roster, st.stability.state === 'running');
    renderFounder();
    document.querySelectorAll('#nw-difficulty button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.diff === st.difficulty)));
    const d = B.difficulties[st.difficulty];
    $('nw-diff-note').textContent = d.name + ': NPC mutation rate ×' + d.npcMu + ', start with ' + d.startMP + ' MP, score ×' + d.scoreMult + '.';
  };

  S.renderStability = function () {
    const st = G.setup;
    const sb = $('nw-stability');
    sb.className = 'stability';
    sb.innerHTML = '';
    const s = st.stability;
    if (s.catalog || (st.mode === 'catalog' && s.state !== 'running')) {
      const r = st.roster, n = r.producers.length + r.species.length;
      const ok = s.state === 'pass';
      sb.className = ok ? 'stability' : 'stability fail';
      sb.append(el('div', { class: 'row' }, el('b', { text: s.state === 'running' ? 'Testing cast…' : ok ? 'Stability test passed' : 'Kept the last draw' }),
        el('span', { text: n + ' real species · draw ' + s.attempt })),
        el('div', { class: 'track' }, el('i', { style: { width: s.state === 'running' ? Math.round((s.progress || 0) * 100) + '%' : '100%' } })),
        el('span', { class: 'caption', text: s.state === 'running' ? 'Round ' + s.round + ' of 5' + (s.last ? ' · redrawing slots after: ' + s.last : '') :
          ok ? r.pool.length + ' species waiting in the regional pool' : s.last || 'Try another seed' }));
    } else if (st.mode === 'meadow' || st.mode === 'channel') {
      const n = st.roster.producers.length + st.roster.species.length;
      sb.append(el('div', { class: 'row' }, el('b', { text: 'Hand-authored roster' }), el('span', { text: n + ' species' })),
        el('div', { class: 'track' }, el('i', { style: { width: '100%' } })), el('span', { class: 'caption', text: 'Individuals still vary and evolve' }));
    } else if (s.state === 'running') {
      sb.append(el('div', { class: 'row' }, el('b', { text: 'Testing roster…', style: { color: 'var(--ink)' } }), el('span', { text: 'attempt ' + s.attempt + ' of 20' })),
        el('div', { class: 'track' }, el('i', { style: { width: Math.round(s.progress * 100) + '%', background: 'var(--accent)' } })),
        el('span', { class: 'caption', text: '5 headless rounds · round ' + s.round + (s.last ? ' · last try: ' + s.last : '') }));
    } else if (s.state === 'pass') {
      sb.append(el('div', { class: 'row' }, el('b', { text: 'Stability test passed' }), el('span', { text: 'attempt ' + s.attempt + ' of 20' })),
        el('div', { class: 'track' }, el('i', { style: { width: '100%' } })), el('span', { class: 'caption', text: '5 headless rounds · every level alive' }));
    } else if (s.state === 'fail') {
      sb.className = 'stability fail';
      sb.append(el('div', { class: 'row' }, el('b', { text: 'No stable roster' }), el('span', { text: '20 of 20' })),
        el('div', { class: 'track' }, el('i', { style: { width: '100%', background: 'var(--bad)' } })), el('span', { class: 'caption', text: 'Fell back to the Meadow roster. Try a new seed.' }));
    }
    $('nw-begin').disabled = st.mode === 'generated' && s.state === 'running';
  };

  function renderRoster(roster, pending) {
    const box = $('nw-roster');
    box.innerHTML = '';
    if (!roster) { box.append(el('p', { class: 'caption', text: 'Generating…' })); $('nw-web').innerHTML = ''; return; }
    const nC = roster.species.length, nP = roster.producers.length;
    $('nw-roster-title').textContent = 'Roster · ' + nC + ' consumers, ' + nP + ' producers' + (pending ? ' · testing' : '');
    const hueTxt = (h, p) => 'hue ' + (h >= 0 ? '+' : '−') + Math.abs(h || 0) + '° · ' + (p || 'plain');
    // Real species: scientific name, and whether it's non-native, at risk or waiting in the regional pool.
    const pool = new Set(roster.pool || []);
    const realTxt = x => x.sci + (x.native === false ? ' · non-native' : '') + (x.iucn && !['LC', 'DD', 'NE'].includes(x.iucn) ? ' · IUCN ' + x.iucn : '') + (pool.has(x.id) ? ' · regional pool' : '');
    const rows = [['producer', roster.producers.map(p => ({ name: p.name, level: 'producer', hue: p.hue, sub: p.sci ? realTxt(p) : hueTxt(p.hue, p.pattern) }))]];
    for (const lv of ['herbivore', 'omnivore', 'carnivore1', 'carnivore2', 'decomposer']) {
      const list = roster.species.filter(x => x.level === lv);
      if (list.length) rows.push([lv, list.map(x => ({ name: x.name, level: lv, hue: x.hue, sub: x.sci ? realTxt(x) : hueTxt(x.hue, x.pattern || T.COAT_WORDS[Math.round((x.genome instanceof Float32Array ? x.genome[G_.coat] : x.genome.coat) || 0)]) }))]);
    }
    for (const [lv, items] of rows) {
      box.append(el('div', { class: 'roster-row' }, el('span', { class: 'lv', style: { color: T.speciesColor(lv, 0, -0.25) }, text: T.LEVELS[lv].name }),
        el('div', { class: 'items' }, items.map(it => el('div', { class: 'r-chip' }, shapeIcon(it.level, it.hue), el('div', null, el('b', { text: it.name }), el('small', { text: it.sub })))))));
    }
    renderFoodWeb(roster);
  }

  function renderFoodWeb(roster) {
    const box = $('nw-web');
    box.innerHTML = '';
    const tiers = [['carnivore2'], ['carnivore1'], ['omnivore'], ['herbivore'], ['producer']];
    const nodes = {};
    const W = 760, H = 300, rowH = H / tiers.length;
    const items = {
      producer: roster.producers.map(p => ({ id: p.id, name: p.name, level: 'producer', hue: p.hue })),
    };
    for (const s of roster.species) if (s.level !== 'decomposer') (items[s.level] = items[s.level] || []).push({ id: s.id, name: s.name, level: s.level, hue: s.hue, eats: s.eats });
    const svgEl = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Food web' });
    tiers.forEach(([lv], t) => {
      const list = items[lv] || [];
      list.forEach((it, k) => { nodes[it.id] = { x: (W * (k + 1)) / (list.length + 1), y: rowH * t + rowH * 0.42, it }; });
    });
    const lines = svg('g', { stroke: '#8C8A80', 'stroke-width': 0.9, 'stroke-opacity': 0.6, fill: 'none' });
    for (const id in nodes) {
      const n = nodes[id];
      for (const food of n.it.eats || []) {
        const src = nodes[food];
        if (src) lines.append(svg('line', { x1: src.x, y1: src.y, x2: n.x, y2: n.y }));
        else if (food === 'fruit') { for (const p of roster.producers) if (p.fruit && nodes[p.id]) lines.append(svg('line', { x1: nodes[p.id].x, y1: nodes[p.id].y, x2: n.x, y2: n.y, 'stroke-dasharray': '3 3' })); }
      }
    }
    svgEl.append(lines);
    for (const id in nodes) {
      const n = nodes[id], L = T.LEVELS[n.it.level];
      const c = T.speciesColor(n.it.level, n.it.hue, 0);
      const r = 7;
      let shape;
      if (L.shape === 'triangle') shape = svg('path', { d: 'M' + n.x + ',' + (n.y - r) + ' L' + (n.x + r) + ',' + (n.y + r * 0.8) + ' L' + (n.x - r) + ',' + (n.y + r * 0.8) + ' Z' });
      else if (L.shape === 'diamond') shape = svg('path', { d: 'M' + n.x + ',' + (n.y - r) + ' L' + (n.x + r) + ',' + n.y + ' L' + n.x + ',' + (n.y + r) + ' L' + (n.x - r) + ',' + n.y + ' Z' });
      else if (L.shape === 'square') shape = svg('rect', { x: n.x - r * 0.8, y: n.y - r * 0.8, width: r * 1.6, height: r * 1.6, rx: 1.5 });
      else shape = svg('circle', { cx: n.x, cy: n.y, r: r * 0.85 });
      shape.setAttribute('fill', c); shape.setAttribute('stroke', INK); shape.setAttribute('stroke-width', 1.2);
      svgEl.append(shape, svg('text', { x: n.x, y: n.y + 19, 'text-anchor': 'middle' }, n.it.name));
    }
    box.append(svgEl);
  }

  function founderDef() { return G.currentFounder(); }

  function renderFounder() {
    const st = G.setup;
    document.querySelectorAll('#founder-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ftab === st.ftab)));
    document.querySelectorAll('#nw-tpl-row button').forEach(b => b.setAttribute('aria-pressed', String(st.ftab === 'templates' && b.dataset.tpl === st.templateId)));
    const body = $('founder-body');
    body.innerHTML = '';
    const def = founderDef();
    const sp = { genome: def.genome, level: def.level, hue: def.hue, id: def.id };
    const stats = T.deriveStats({ base: def.base, level: def.level }, def.genome, 1);
    const proj = T.projection(stats);
    if (st.ftab === 'templates') {
      const grid = el('div', { class: 'tpl-cards' });
      for (const t of T.TEMPLATES) {
        const fd = T.Gen.templateFounder(t);
        const cv = el('canvas', { width: 300, height: 150 });
        grid.append(el('button', { class: 'tpl-card', 'aria-pressed': String(st.templateId === t.id), onclick: () => G.selectTemplate(t.id) },
          cv, el('b', { text: t.name }), el('small', { text: t.niche + ' · starts with ' + t.startPop }), el('small', { text: '+ ' + t.strength + '  − ' + t.risk })));
        T.paintCreature(cv, { genome: fd.genome, level: fd.level, hue: 0, id: t.id }, { t: 0.3 });
      }
      body.append(grid);
    } else if (st.ftab === 'roll') {
      const A = T.Gen.ARCH_BY_ID[st.archetypeId];
      body.append(el('div', { class: 'caption', text: 'Archetype · ' + T.LEVELS[A.level].short.toLowerCase() }));
      const chips = el('div', { class: 'arch-chips' });
      for (const a of T.Gen.ARCHETYPES) {
        if (a.level === 'decomposer') continue;
        chips.append(el('button', { 'aria-pressed': String(a.id === st.archetypeId), onclick: () => G.selectArchetype(a.id) }, shapeIcon(a.level), a.name));
      }
      body.append(chips);
    } else {
      const chips = el('div', { class: 'arch-chips' });
      for (const lv of ['herbivore', 'omnivore', 'carnivore1', 'carnivore2']) {
        chips.append(el('button', { 'aria-pressed': String(lv === st.customLevel), onclick: () => G.selectCustomLevel(lv) }, shapeIcon(lv), T.LEVELS[lv].short));
      }
      body.append(el('div', { class: 'caption', text: 'Pick a trophic level. You start with a bare genome and ' + B.customFounderMP + ' MP to spend in the editor.' }), chips);
    }
    if (st.ftab !== 'templates') {
      const cv = el('canvas', { width: 420, height: 280 });
      const genes = el('table', { class: 'gene-list' });
      const keys = ['size', 'speed', def.level === 'herbivore' ? 'plantGut' : 'bite', 'senses', 'armor', 'social', 'boldness', 'aggression'];
      for (const k of keys) genes.append(el('tr', null, el('td', { text: T.GENE_BY_KEY[k].name.split(' ·')[0] }), el('td', { text: def.genome[G_[k]].toFixed(k === 'boldness' || k === 'aggression' ? 2 : 1) })));
      body.append(el('div', { class: 'founder-main' }, el('div', { class: 'pv' }, cv), genes));
      T.paintCreature(cv, sp, { t: 0.4 });
      const quirk = def.quirks && def.quirks.length ? 'Quirk: ' + def.quirks.map(q => '+' + q.add + ' ' + T.GENE_BY_KEY[q.key].name.toLowerCase()).join(', ') + ' (off-archetype)' : st.ftab === 'roll' ? 'No quirks: a textbook ' + T.Gen.ARCH_BY_ID[st.archetypeId].name.toLowerCase() : 'Bare genome';
      body.append(el('h3', { class: 'h-serif', text: st.ftab === 'custom' ? 'Custom ' + T.LEVELS[def.level].short.toLowerCase() : def.name }), el('p', { class: 'caption', text: quirk }));
      if (st.ftab === 'roll') body.append(el('div', { class: 'note-teal', text: '+' + B.rolledFounderMP + ' starting MP for a rolled founder' }));
    }
    const m = Math.round(proj.margin * 100);
    body.append(el('div', { class: 'proj' }, el('div', { class: 'row between' }, el('span', { text: 'Projected income vs upkeep' }), el('b', { class: 'mono', text: (m >= 0 ? '+' : '') + m + '%' })),
      el('div', { class: 'track' }, el('i', { style: { width: Math.max(4, Math.min(100, 50 + m)) + '%', background: m < 0 ? 'var(--bad)' : 'var(--accent)' } })),
      el('span', { class: 'caption', text: def.startPop + ' founders, sampled with σ ' + Math.round(B.founderSigma * 100) + '% per gene' })));
    document.querySelector('.tpl-row-wrap').hidden = st.ftab === 'templates';
    const rr = $('nw-reroll');
    rr.hidden = st.ftab !== 'roll';
    rr.innerHTML = '';
    rr.append(el('span', { html: '&#8635;' }), ' Reroll · ' + (3 - st.rerolls) + ' of 3 left');
    rr.disabled = st.rerolls >= 3;
  }

  // ======================= Species editor =======================

  S.renderEvolve = function () {
    const run = G.run, w = G.world, p = w.player;
    const draft = G.draftMean();
    const dsp = { base: p.base, level: T.classifyLevel(draft, p.base) };
    const dst = T.deriveStats(dsp, draft, 1);
    const committed = G.committedMP();
    $('ev-round').textContent = 'Round ' + run.round;
    $('ev-mp-left').textContent = run.mp - committed;
    $('ev-mp-sub').textContent = '/ ' + run.mp + ' · ' + committed + ' committed';
    const pops = w.countPops().count;
    $('ev-gen').textContent = 'Generation ' + run.round + ' · ' + pops[p.idx] + ' individuals';
    const nm = $('ev-name');
    if (document.activeElement !== nm) nm.value = run.speciesName;
    $('ev-level').textContent = T.LEVELS[dsp.level].short + (p.archetypeName ? ' · ' + p.archetypeName.toLowerCase() : '') + (dsp.level !== p.level ? ' · niche shift' : '');
    // body plan chips
    const plan = $('ev-plan'); plan.innerHTML = '';
    for (const t of [Math.round(draft[G_.limbs]) + ' limbs', T.TAILS[Math.round(draft[G_.tail])], T.HEADS[Math.round(draft[G_.head])], T.COATS[Math.round(draft[G_.coat])],
      'Lifespan ' + (draft[G_.longevity] * B.lifespanMult).toFixed(1) + ' rounds']) plan.append(el('span', { class: 'chip', text: t }));
    // tutorial
    const tip = T.TUTORIAL[run.round];
    const hint = $('ev-hint');
    hint.hidden = !(G.settings.hints && tip);
    if (tip) hint.innerHTML = '<b>Round ' + run.round + '.</b> ' + tip.evolve;
    renderMeter(dsp, dst, draft);
    UI.drawRadar($('ev-radar'), dst, run.prevMean ? T.deriveStats(dsp, Float32Array.from(run.prevMean), 1) : null);
    $('ev-radar-was').textContent = run.round > 1 ? 'Generation ' + (run.round - 1) : 'Founders';
    renderGeneCards(draft);
    renderOrders();
    renderMutants();
    const ev = $('ev-event');
    ev.hidden = !run.pendingEvent;
    if (run.pendingEvent) {
      const e = T.EVENTS.find(x => x.id === run.pendingEvent);
      ev.innerHTML = '';
      ev.append(el('b', { text: '⚠ Next round: ' + e.name }), e.effect);
    }
    S.startPreview();
  };

  function renderMeter(dsp, dst, draft) {
    const w = G.world, p = w.player;
    const proj = T.projection(dst);
    const spends = [];
    for (const e of w.ents) {
      if (!e.alive || e.sp !== p) continue;
      const g = G.applyOrdersTo(e.g);
      const st = T.deriveStats(dsp, g, 1);
      spends.push(st.basal + st.traitUp + st.basal * B.activityCost * 0.5);
    }
    spends.sort((a, b) => a - b);
    const lo = spends.length ? spends[Math.floor(spends.length * 0.05)] : proj.spend, hi = spends.length ? spends[Math.floor(spends.length * 0.95)] : proj.spend;
    const mean = spends.length ? spends.reduce((a, b) => a + b, 0) / spends.length : proj.spend;
    const max = Math.max(proj.income, hi) * 1.1;
    // Carnivores run leaner than grazers (the 10% rule), so judge the margin against the level's band.
    const floor = (T.Gen.MARGIN[dsp.level] || [0])[0];
    const margin = mean > 0 ? proj.income / mean - 1 : 0;
    const ok = margin >= floor, tight = !ok && margin >= floor - 0.1;
    const status = $('ev-meter-status');
    status.textContent = ok ? 'Sustainable' : tight ? 'Tight' : 'Predicted to starve';
    status.className = 'status' + (ok ? '' : ' bad');
    if (tight) status.style.color = '#B7791F'; else status.style.color = '';
    const box = $('ev-meter'); box.innerHTML = '';
    box.append(el('div', { class: 'meter-line' }, el('div', { class: 'top' }, el('span', { text: 'Projected income' }), el('b', { text: proj.income.toFixed(3) + ' EU/t' })),
      el('div', { class: 'track' }, el('i', { style: { left: 0, width: (100 * proj.income) / max + '%', background: 'var(--producer)' } }))));
    box.append(el('div', { class: 'meter-line' }, el('div', { class: 'top' }, el('span', { text: 'Mean spend (range ' + lo.toFixed(3) + '–' + hi.toFixed(3) + ')' }), el('b', { text: mean.toFixed(3) + ' EU/t' })),
      el('div', { class: 'track' }, el('i', { style: { left: 0, width: (100 * mean) / max + '%', background: ok ? ACCENT : 'var(--bad)' } }),
        el('i', { style: { left: (100 * lo) / max + '%', width: Math.max(1, (100 * (hi - lo)) / max) + '%', background: 'rgba(156,195,198,0.9)' } }))));
  }

  const GENE_ORDER = ['size', 'speed', 'senses', 'camo', 'diet', 'meatGut', 'plantGut', 'metabolism', 'bite', 'venom', 'armor', 'spines', 'social', 'boldness', 'aggression', 'cohesion', 'roam',
    'fat', 'repro', 'longevity', 'mutability', 'ambush', 'burrow', 'charge', 'flight', 'echolocation', 'symbiotic', 'hibernation', 'limbs', 'tail', 'head', 'coat'];

  function renderGeneCards(draft) {
    const run = G.run, w = G.world, p = w.player;
    document.querySelectorAll('#ev-filters button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === S.filter)));
    const grid = $('ev-genes');
    grid.innerHTML = '';
    const inds = w.ents.filter(e => e.alive && e.sp === p);
    for (const key of GENE_ORDER) {
      const d = T.GENE_BY_KEY[key];
      if (S.filter !== 'All' && d.cat !== S.filter) continue;
      if (S.filter === 'All' && d.special && p.mean[d.i] < 0.05 && !G.guidedDelta(key)) continue;
      const mean = p.mean[d.i];
      const last = run.prevMean ? run.prevMean[d.i] : null;
      const delta = G.guidedDelta(key);
      const pinned = G.hasOrder('pressure', key), focused = G.hasOrder('focus', key);
      const card = el('div', { class: 'gene-card' + (pinned ? ' pressure' : focused ? ' focus' : delta ? ' queued' : '') });
      const pin = el('button', { class: 'pin' + (pinned ? ' on' : ''), title: 'Selection pressure (' + B.pressureCost + ' MP): top 25% breed at 60% energy', 'aria-pressed': String(pinned),
        disabled: !pinned && !G.canAdd('pressure'), onclick: () => G.toggleOrder('pressure', key) });
      pin.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2h4l-.5 4 2 2H4.5l2-2zM8 8v6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
      const mu = el('button', { class: 'mu' + (focused ? ' on' : ''), title: 'Mutation focus (' + B.focusCost + ' MP): μ ×3 for this gene next round', 'aria-pressed': String(focused),
        disabled: !focused && !G.canAdd('focus'), onclick: () => G.toggleOrder('focus', key), text: 'μ' });
      card.append(el('div', { class: 'gh' }, el('b', { text: d.name }), el('span', { class: 'tag', text: d.tag }), d.cat !== 'Body plan' ? mu : null, d.cat !== 'Body plan' ? pin : null));
      if (key === 'metabolism') {
        const ecto = inds.filter(e => e.g[d.i] >= 0.5).length / Math.max(1, inds.length);
        card.append(el('div', { class: 'split-pill' }, el('span', { class: ecto < 0.5 ? 'a' : '', text: 'Endotherm ' + pct(1 - ecto) }), el('span', { class: ecto >= 0.5 ? 'a' : '', text: 'Ectotherm ' + pct(ecto) })));
      } else if (d.discrete) {
        const counts = new Array(d.max - d.min + 1).fill(0);
        for (const e of inds) counts[Math.round(e.g[d.i]) - d.min]++;
        const mx = Math.max(1, ...counts);
        const names = key === 'tail' ? ['stub', 'whip', 'blade', 'club'] : key === 'head' ? ['round', 'wedge', 'snout'] : key === 'coat' ? ['plain', 'spot', 'stripe', 'band'] : counts.map((_, k) => String(d.min + k));
        card.append(el('div', { class: 'cat-bars', style: { marginBottom: '14px' } }, counts.map((c, k) => el('div', { style: { height: Math.max(3, (100 * c) / mx) + '%' } }, el('span', { text: names[k] })))));
      } else {
        const cv = el('canvas', { class: 'hist' });
        card.append(cv);
        requestAnimationFrame(() => UI.drawHist(cv, inds.map(e => e.g[d.i]), d, mean, last));
      }
      const dd = last != null ? mean - last : 0;
      const badge = pinned ? 'Pressure · top 25%' : focused ? 'Focus · μ ×3' : delta ? 'Guided ' + (delta > 0 ? '+' : '−') + Math.abs(delta) + ' queued' : null;
      card.append(el('div', { class: 'stats' }, el('span', { text: 'mean ' + mean.toFixed(2) + (last != null ? ' · last ' + last.toFixed(2) : '') }),
        badge ? el('span', { class: 'badge', text: badge }) : last != null ? el('span', { class: dd >= 0 ? 'pos' : 'neg', text: signed(dd) }) : null));
      const up = d.upkeep ? (d.upkeep * d.step * B.upkeepScale).toFixed(3) + '/lv' : d.upkeepText || 'free';
      card.append(el('div', { class: 'gf' }, el('span', { class: 'cost' }, el('b', { text: d.mp + ' MP' }), ' · ' + up),
        el('button', { class: 'step-btn', 'aria-label': 'Devolve ' + d.name, disabled: !G.canGuided(key, -1), onclick: () => G.guided(key, -1), text: '−' }),
        el('button', { class: 'step-btn plus', 'aria-label': 'Guided mutation +1 ' + d.name, disabled: !G.canGuided(key, 1), onclick: () => G.guided(key, 1), text: '+' })));
      grid.append(card);
    }
  }

  function renderOrders() {
    const run = G.run, box = $('ev-orders');
    const committed = G.committedMP();
    $('ev-orders-title').textContent = 'This round\'s orders · ' + committed + ' MP';
    box.innerHTML = '';
    const p = G.world.player;
    for (const o of run.orders) {
      const d = o.gene ? T.GENE_BY_KEY[o.gene] : null;
      let title, sub;
      if (o.type === 'guided') {
        const m = p.mean[d.i];
        title = (o.delta > 0 ? 'Guided mutation · ' : 'Devolve · ') + d.name + ' ' + (o.delta > 0 ? '+' : '−') + Math.abs(o.delta);
        sub = (o.cost >= 0 ? o.cost + ' MP' : 'refund ' + -o.cost + ' MP') + ' · mean ' + m.toFixed(2) + ' → ' + T.clampGene(d.i, m + o.delta * d.step).toFixed(2) + ', spread kept';
      } else if (o.type === 'pressure') { title = 'Selection pressure · ' + d.name; sub = o.cost + ' MP · top 25% breed at ' + Math.round(B.pressureThreshold * 100) + '% energy'; }
      else if (o.type === 'focus') { title = 'Mutation focus · ' + d.name; sub = o.cost + ' MP · μ ' + B.mutationRate + ' → ' + (B.mutationRate * 3).toFixed(2) + ' next round'; }
      else { const mt = run.mutants[o.idx]; title = 'Mutant spread · ' + T.GENE_BY_KEY[mt.gene].name + ' ' + mt.value.toFixed(1); sub = o.cost + ' MP · half of adult breeders take it on'; }
      box.append(el('div', { class: 'order' }, el('b', { text: title }), el('small', { text: sub }), el('button', { 'aria-label': 'Remove order', onclick: () => G.removeOrder(o), html: '&times;' })));
    }
    const pins = run.orders.filter(o => o.type === 'pressure').length, foc = run.orders.filter(o => o.type === 'focus').length;
    if (pins < 2 || foc < 2) box.append(el('div', { class: 'order placeholder' }, el('b', { text: (foc || pins ? 'Second focus or pin' : 'Pin a gene or add a focus') }), el('small', { text: 'Up to 2 of each' })));
  }

  function renderMutants() {
    const run = G.run, box = $('ev-mutants'), p = G.world.player;
    box.innerHTML = '';
    if (!run.mutants.length) {
      box.append(el('div', { class: 'empty', text: run.round === 1 ? 'Mutants appear once your species has bred: real outliers born last round show up here.' : 'No standout mutants were born last round.' }));
      return;
    }
    run.mutants.forEach((m, i) => {
      const d = T.GENE_BY_KEY[m.gene];
      const bought = G.hasMutantOrder(i);
      const left = run.mp - G.committedMP();
      const cv = el('canvas', { width: 152, height: 108 });
      box.append(el('button', { class: 'mutant' + (bought ? ' bought' : ''), disabled: !bought && left < m.price, onclick: () => G.toggleMutant(i) },
        cv, el('div', null, el('div', { class: 'mh' }, el('span', { text: 'Mutant #' + String(m.num).padStart(4, '0') }), el('span', { text: m.juvenile ? 'juvenile' : 'adult' })),
          el('b', { text: 'Born with ' + d.name.split(' ·')[0].toLowerCase().replace(' / claws', '') + ' ' + m.value.toFixed(1) }),
          el('small', { text: 'Species mean ' + m.mean.toFixed(2) + ' · ' + m.offspring + ' offspring so far' }),
          el('div', { class: 'price' }, m.price + ' MP', el('s', { text: m.full + ' MP' }), el('small', { style: { display: 'inline' }, text: bought ? '· queued' : 'spreads to 50% of breeders' })))));
      T.paintCreature(cv, { genome: m.genome, level: p.level, hue: p.hue, id: p.id }, { t: 0.2 });
    });
  }

  S.startPreview = function () {
    if (S._preview) return;
    S._preview = true;
    const cv = $('ev-preview');
    const tick = now => {
      if ($('screen-evolve').hidden || !G.run) { S._preview = false; return; }
      const p = G.world.player;
      const draft = G.draftMean();
      T.paintCreature(cv, { genome: draft, level: T.classifyLevel(draft, p.base), hue: p.hue, id: p.id }, { t: now / 1000, bob: Math.sin(now / 600) * 3 });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // ======================= Selection report =======================

  S.renderReport = function (rep) {
    const run = G.run, w = G.world;
    $('rp-round').textContent = 'Round ' + rep.round;
    const chips = $('rp-chips'); chips.innerHTML = '';
    for (const n of rep.defeatedNow) chips.append(el('span', { class: 'chip chip-red' }, '⊖ ' + n + ' defeated'));
    for (const n of rep.extinct) if (!rep.defeatedNow.includes(n)) chips.append(el('span', { class: 'chip' }, n + ' extinct'));
    const ob = $('rp-outcome');
    ob.hidden = !rep.outcome;
    if (rep.outcome) { ob.className = 'outcome ' + (rep.outcome.win ? 'win' : 'lose'); ob.textContent = rep.outcome.headline; }
    // speciation
    const sb = $('rp-speciation'); sb.innerHTML = '';
    for (const ev of rep.speciation) {
      const par = w.speciesById(ev.parentId), ch = w.speciesById(ev.childId);
      if (!par || !ch) continue;
      const cvA = el('canvas', { width: 124, height: 92 }), cvB = el('canvas', { width: 124, height: 92 });
      const pending = run.pendingSplit && run.pendingSplit.childId === ev.childId;
      const banner = el('div', { class: 'spec-banner' },
        el('div', { class: 't' }, el('div', { class: 'eyebrow', text: ev.player ? 'Your lineage split' : 'Speciation event' }), el('h2', { class: 'h-serif', text: 'A new species split off' })),
        el('div', { class: 'spec-sp' }, cvA, el('div', null, el('b', { text: par.name }), el('span', { class: 'caption', text: 'Parent · ' + ev.nParent + ' remain' }))),
        el('span', { class: 'spec-arrow', text: '→' }),
        el('div', { class: 'spec-sp' }, cvB, el('div', null, el('b', { text: ch.name }), el('span', { class: 'caption', text: 'New · ' + ev.nChild + ' individuals' }))),
        el('div', { class: 'spec-dist' }, el('div', { class: 'caption', text: 'Genetic distance' }), el('div', null, el('b', { class: 'mono big', text: ev.dist.toFixed(2) }),
          el('span', { class: 'caption mono', text: ' > ' + B.speciationDistance + ' for ' + B.speciationHold + ' rounds' }))),
        pending ? el('div', { class: 'spec-choice' }, el('span', { class: 'caption', text: 'Which branch do you keep?' }),
          el('button', { class: 'btn accent small', onclick: () => G.chooseBranch(false), text: 'Keep ' + par.name }),
          el('button', { class: 'btn ghost small', onclick: () => G.chooseBranch(true), text: 'Keep ' + ch.name }))
          : el('button', { class: 'btn ghost small', style: { marginLeft: 'auto' }, onclick: () => G.openOverlay('codex', ch.id), text: 'Codex entry' }));
      sb.append(banner);
      T.paintCreature(cvA, { genome: par.mean, level: par.level, hue: par.hue, id: par.id }, { scale: 1.1 });
      T.paintCreature(cvB, { genome: ch.mean, level: ch.level, hue: ch.hue, id: ch.id }, { scale: 1.1 });
    }
    // sankey
    const eff = UI.drawSankey($('rp-sankey'), rep.rs, w.player.name);
    $('rp-sankey-note').textContent = eff ? 'Only ' + Math.round(eff * 100) + '% of what you ate became new ' + rep.playerName + ' tissue' : '';
    // populations
    const lg = $('rp-legend');
    requestAnimationFrame(() => {
      lg.innerHTML = '';
      UI.drawPopChart($('rp-popchart'), rep);
      for (const ln of rep.lines) {
        const c = ln.player ? ACCENT : T.speciesColor(ln.level, ln.hue, -0.05);
        lg.append(el('li', null, el('i', { style: { borderTop: (ln.player ? 3 : 2) + 'px ' + (ln.dash && ln.dash.length ? 'dashed' : 'solid') + ' ' + c } }), ln.name + (ln.player ? ' (you)' : ''),
          el('span', { class: 'n', text: pct(ln.end / Math.max(1, ln.start)) })));
      }
    });
    // what evolved
    const evo = $('rp-evo'); evo.innerHTML = '';
    if (!rep.evolved.length) evo.append(el('li', null, el('span'), el('span', { class: 'c', text: 'No mean shifted by more than a quarter level this round.' })));
    for (const x of rep.evolved) {
      evo.append(el('li', null, shapeIcon(x.level, x.hue), el('b', { text: x.species + ' ' + x.gene.split(' ·')[0] }),
        el('span', { class: 'd ' + (x.delta >= 0 ? 'pos' : 'neg'), text: signed(x.delta) }), el('span', { class: 'c', text: x.cause })));
    }
    for (const n of rep.notes) evo.append(el('li', null, el('span'), el('span', { class: 'c', style: { gridColumn: '2 / -1' }, text: n })));
    // deaths & sources
    const barRow = (a, b, f) => el('div', { class: 'row2' }, el('div', { class: 'top' }, el('span', { text: a }), el('b', { text: b })), el('div', { class: 'track' }, el('i', { style: { width: Math.max(2, f * 100) + '%' } })));
    const dbox = $('rp-deaths'); dbox.innerHTML = '';
    const merged = {};
    for (const [k, v] of Object.entries(rep.rs.deaths)) { const l = deathLabel(k); merged[l] = (merged[l] || 0) + v; }
    const dl = Object.entries(merged).sort((a, b) => b[1] - a[1]), dt = dl.reduce((a, b) => a + b[1], 0);
    if (!dt) dbox.append(el('p', { class: 'caption', text: 'No deaths this round.' }));
    dl.slice(0, 3).forEach(([k, v]) => dbox.append(barRow(k, pct(v / dt), v / dt)));
    const sbox = $('rp-sources'); sbox.innerHTML = '';
    const src = Object.entries(rep.rs.eaten).sort((a, b) => b[1] - a[1]), stt = src.reduce((a, b) => a + b[1], 0);
    if (!stt) sbox.append(el('p', { class: 'caption', text: 'Nothing eaten this round.' }));
    src.slice(0, 3).forEach(([k, v]) => sbox.append(barRow(w.species.some(s => s.name === k) ? plural(k) : k, pct(v / stt), v / stt)));
    // MP
    $('rp-mp-total').textContent = rep.mpTotal;
    const t = $('rp-mp'); t.innerHTML = '';
    for (const [k, v] of rep.mpParts) t.append(el('tr', null, el('td', { text: k }), el('td', { text: (v > 0 ? '+' : '') + v })));
    const cont = $('rp-continue');
    cont.innerHTML = '';
    cont.append(rep.outcome ? 'See final score ' : 'Continue to Evolve ', el('span', { 'aria-hidden': 'true', text: '→' }));
    cont.disabled = !!run.pendingSplit;
  };

  function deathLabel(k) {
    if (k.startsWith('k:')) {
      const sp = G.world.speciesById(k.slice(2));
      return 'Eaten by ' + (sp ? (sp.isPlayer ? 'your own kind' : plural(sp.name)) : 'predators');
    }
    if (k.startsWith('starved')) { const s = k.split('@')[1]; return 'Starved' + (s ? ' in ' + s.toLowerCase() : ''); }
    return { plague: 'Plague', emigrated: 'Left the map', old: 'Old age', culled: 'Culled by you' }[k] || k;
  }
  S.deathLabel = deathLabel;

  // ======================= Phylogeny =======================

  S.renderPhylogeny = function (selId) {
    const run = G.run, w = G.world, ph = run.phylo;
    const R = Math.max(1, ph.lastRound);
    $('ph-sub').textContent = '· ' + (run.mode === 'generated' ? 'Generated world' : run.mode === 'channel' ? 'Open Channel' : run.mode === 'catalog' ? run.worldName : 'Temperate Meadow') + ' · rounds 1–' + R;
    const recs = Object.values(ph.species);
    const splits = recs.filter(r => r.parentId).length, ext = recs.filter(r => r.extinct).length;
    $('ph-stats').innerHTML = '<b>' + (recs.length + Object.keys(ph.producers).length) + '</b> species seen · <b>' + splits + '</b> split' + (splits === 1 ? '' : 's') + ' · <b>' + ext + '</b> extinct';
    const descs = recs.filter(r => r.descendant);
    $('ph-desc-count').textContent = descs.length ? descs.length : 'none yet';
    // rows
    const rows = [];
    const add = (r, depth) => { rows.push(r); for (const c of recs.filter(x => x.parentId === r.id)) add(c, depth + 1); };
    const groups = [['producer', Object.values(ph.producers)]];
    for (const lv of ['herbivore', 'omnivore', 'carnivore1', 'carnivore2', 'decomposer']) groups.push([lv, recs.filter(r => r.level === lv && !(r.parentId && ph.species[r.parentId] && ph.species[r.parentId].level === lv))]);
    const layout = [];
    for (const [lv, roots] of groups) {
      if (!roots.length) continue;
      const start = rows.length;
      for (const r of roots) add(r, 0);
      layout.push({ lv, from: start, to: rows.length });
    }
    const W = 1000, rowH = 24, gap = 10, labelW = 140, x0 = labelW + 20, x1 = W - 80;
    const xOf = r => x0 + ((r - 1) / Math.max(1, R - 1)) * (x1 - x0);
    let y = 10;
    const yOf = {};
    const s = svg('svg', { viewBox: '0 0 ' + W + ' 100', role: 'img', 'aria-label': 'Phylogeny' });
    const bands = svg('g'), lines = svg('g'), marks = svg('g'), labels = svg('g');
    for (const g of layout) {
      const top = y;
      for (let i = g.from; i < g.to; i++) { yOf[rows[i].id] = y + rowH / 2; y += rowH; }
      bands.append(svg('rect', { x: 0, y: top - 4, width: x1 + 40, height: y - top + 8, fill: T.speciesColor(g.lv, 0, 0.85), rx: 4 }));
      bands.append(svg('rect', { x: 0, y: top - 4, width: 3, height: y - top + 8, fill: T.LEVELS[g.lv].color }));
      y += gap;
    }
    const H = y + 30;
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    let maxPop = 1;
    for (const r of rows) for (const v of r.pops) if (v) maxPop = Math.max(maxPop, v);
    for (const r of rows) {
      const yy = yOf[r.id];
      const color = r.level === 'producer' ? T.LEVELS.producer.color : r.descendant ? ACCENT : T.speciesColor(r.level, r.hue, 0);
      const first = Math.max(1, r.origin), last = r.extinct ? r.extinct : R;
      const isYou = r.id === (w.player && w.player.id);
      for (let k = first; k < last; k++) {
        const pop = r.pops[k] || 0;
        const sw = 1.5 + 8 * Math.sqrt(pop / maxPop);
        if (isYou) lines.append(svg('line', { x1: xOf(k), y1: yy, x2: xOf(k + 1), y2: yy, stroke: INK, 'stroke-width': sw + 3, 'stroke-linecap': 'round' }));
        lines.append(svg('line', { x1: xOf(k), y1: yy, x2: xOf(k + 1), y2: yy, stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round' }));
      }
      if (r.parentId && yOf[r.parentId] != null) {
        const py = yOf[r.parentId], sx = xOf(Math.max(1, r.origin - 0.5));
        lines.append(svg('path', { d: 'M' + sx + ',' + py + ' C' + (sx + 20) + ',' + py + ' ' + (xOf(r.origin) - 20) + ',' + yy + ' ' + xOf(r.origin) + ',' + yy, stroke: color, 'stroke-width': 2, fill: 'none' }));
        marks.append(svg('circle', { cx: sx, cy: py, r: 5, fill: '#fff', stroke: INK, 'stroke-width': 2 }));
      }
      if (r.arrival) marks.append(svg('text', { x: xOf(r.origin) - 4, y: yy + 4, 'font-weight': 700, 'text-anchor': 'middle' }, '+'));
      if (r.extinct) marks.append(svg('circle', { cx: xOf(r.extinct), cy: yy, r: 5, fill: '#fff', stroke: '#C9483F', 'stroke-width': 2 }), svg('line', { x1: xOf(r.extinct) - 3, y1: yy, x2: xOf(r.extinct) + 3, y2: yy, stroke: '#C9483F', 'stroke-width': 2 }));
      else {
        marks.append(svg('circle', { cx: xOf(R), cy: yy, r: 3.5, fill: color, stroke: INK, 'stroke-width': 1 }));
        labels.append(svg('text', { x: xOf(R) + 10, y: yy + 4, class: 'mono', fill: '#555C55' }, String(r.pops[R] || 0)));
      }
      const lab = svg('text', { x: labelW, y: yy + 4, 'text-anchor': 'end', 'font-weight': isYou ? 700 : 500, fill: isYou ? ACCENT : INK, 'text-decoration': r.extinct ? 'line-through' : 'none' },
        r.name + (isYou ? ' (you)' : '') + (r.parentId && r.origin === R ? ' · new' : ''));
      labels.append(lab);
      const hit = svg('rect', { class: 'node', x: 0, y: yy - rowH / 2, width: W, height: rowH, fill: r.id === selId ? 'rgba(29,101,112,0.08)' : 'transparent' });
      hit.addEventListener('click', () => S.renderPhylogeny(r.id));
      labels.append(hit);
    }
    const axis = svg('g');
    for (let k = 1; k <= R; k++) {
      axis.append(svg('line', { x1: xOf(k), y1: 4, x2: xOf(k), y2: H - 26, stroke: '#DCD3C0', 'stroke-width': 1 }));
      axis.append(svg('text', { x: xOf(k), y: H - 8, 'text-anchor': 'middle', fill: '#8C8A80', class: 'mono' }, 'R' + k));
    }
    s.append(bands, axis, lines, marks, labels);
    const box = $('ph-tree'); box.innerHTML = ''; box.append(s);
    renderPhSide(selId || (rows.find(r => r.parentId) || rows.find(r => r.id === (w.player && w.player.id)) || rows[0]).id);
  };

  function entryInfo(id) {
    const run = G.run, w = G.world;
    const rec = run.phylo.species[id] || run.phylo.producers[id];
    const sp = w.speciesById(id);
    const P = w.producerById(id);
    return { rec, sp, P };
  }

  function originText(rec) {
    if (rec.parentId) { const par = G.run.phylo.species[rec.parentId]; return 'split from ' + (par ? par.name : 'an ancestor') + ', round ' + rec.origin; }
    if (rec.arrival) return 'arrived round ' + rec.origin;
    return 'native';
  }

  function renderPhSide(id) {
    const box = $('ph-side'); box.innerHTML = '';
    const { rec, sp, P } = entryInfo(id);
    if (!rec) return;
    const cv = el('canvas', { width: 580, height: 330 });
    box.append(el('div', { class: 'eyebrow', text: 'Selected node' }), el('div', { class: 'hero' }, cv));
    paintEntry(cv, rec, sp, P);
    const R = G.run.phylo.lastRound;
    box.append(el('h2', { class: 'h-serif', text: rec.name }), el('div', { class: 'caption', text: T.LEVELS[rec.level].short + ' · ' + originText(rec) }));
    box.append(el('div', { class: 'mini-stats' },
      el('div', null, el('span', { class: 'caption', text: rec.splitDist ? 'Genetic distance' : rec.level === 'producer' ? 'Biomass' : 'First seen' }), el('b', { text: rec.splitDist ? rec.splitDist.toFixed(2) : rec.level === 'producer' ? (rec.pops[R] || 0) + 'k EU' : 'R' + rec.origin })),
      el('div', null, el('span', { class: 'caption', text: rec.level === 'producer' ? 'Tiles' : 'Population' }), el('b', { text: rec.extinct ? 'extinct R' + rec.extinct : String(rec.level === 'producer' ? rec.tiles || '—' : rec.pops[R] || 0) }))));
    box.append(el('p', { class: 'caption', text: describe(rec, sp, P) }));
    box.append(el('div', { style: { flex: 1 } }), el('button', { class: 'btn primary wide', onclick: () => G.openOverlay('codex', id), text: 'Open Codex entry' }));
  }

  function describe(rec, sp, P) {
    if (P) return P.note;
    if (rec.parentId) {
      const par = G.run.phylo.species[rec.parentId];
      const diffs = keyDiffs(rec, par).slice(0, 2).map(d => (d.a > d.b ? 'more ' : 'less ') + d.name.toLowerCase());
      return 'Diverged from ' + (par ? par.name : 'its parent') + ' with ' + diffs.join(' and ') + '. Mating between them is now blocked.';
    }
    return sp ? [sp.behavior, sp.weakness].filter(Boolean).join(' ') || (sp.archetypeName ? 'A ' + sp.archetypeName.toLowerCase() + '.' : '') : '';
  }

  function paintEntry(cv, rec, sp, P) {
    if (P) {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      const c = P.color;
      for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) {
        const j = ((x * 7 + y * 13) % 9) - 4;
        ctx.fillStyle = 'rgb(' + (c[0] + j * 3) + ',' + (c[1] + j * 3) + ',' + (c[2] + j * 2) + ')';
        ctx.fillRect(x * cv.width / 10, y * cv.height / 6, cv.width / 10 + 1, cv.height / 6 + 1);
      }
      ctx.fillStyle = 'rgba(31,42,36,0.25)';
      if (P.kind === 'woody') for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(60 + k * 90, 90 + (k % 2) * 120, 38, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    const g = sp ? sp.mean : Float32Array.from(rec.genome || T.newGenome());
    T.paintCreature(cv, { genome: g, level: rec.level, hue: rec.hue, id: rec.id }, { t: 0.3, scale: 1.05 });
  }

  function keyDiffs(rec, par) {
    const out = [];
    const a = rec.latest || {}, b = par ? par.latest || {} : rec.founder || {};
    for (const k of Object.keys(a)) {
      const d = T.GENE_BY_KEY[k];
      if (!d || b[k] == null || d.discrete || d.cat === 'Body plan' || k === 'mutability') continue;
      out.push({ key: k, name: d.name.split(' ·')[0], a: a[k], b: b[k], diff: Math.abs(a[k] - b[k]) / (d.max - d.min) });
    }
    return out.sort((x, y) => y.diff - x.diff);
  }

  // ======================= Codex =======================

  S.renderCodex = function (id) {
    const run = G.run, w = G.world, ph = run.phylo;
    const entries = Object.values(ph.producers).concat(Object.values(ph.species));
    $('cx-sub').textContent = '· ' + entries.length + ' entries';
    const list = $('cx-list'); list.innerHTML = '';
    const groups = [['producer', 'Producers'], ['herbivore', 'Herbivores'], ['omnivore', 'Omnivores'], ['carnivore1', 'Carnivores'], ['carnivore2', 'Apex'], ['decomposer', 'Decomposers']];
    if (!id || !entries.some(e => e.id === id)) id = (w.player && w.player.id) || entries[0].id;
    for (const [lv, label] of groups) {
      const es = entries.filter(e => e.level === lv);
      if (!es.length) continue;
      list.append(el('div', { class: 'eyebrow', text: label, style: { color: T.speciesColor(lv, 0, -0.3) } }));
      for (const e of es) {
        list.append(el('button', { class: e.extinct ? 'extinct' : '', 'aria-current': String(e.id === id), onclick: () => S.renderCodex(e.id) },
          shapeIcon(lv, e.hue), el('span', { text: e.name + (e.parentId && e.origin === ph.lastRound ? ' · new' : '') + (e.id === (w.player && w.player.id) ? ' (you)' : '') })));
      }
    }
    renderEntry(id);
  };

  function renderEntry(id) {
    const main = $('cx-main'); main.innerHTML = '';
    const run = G.run, w = G.world;
    const { rec, sp, P } = entryInfo(id);
    if (!rec) return;
    const cv = el('canvas', { width: 600, height: 380 });
    const eyebrow = T.LEVELS[rec.level].short + ' · ' + (rec.archetypeName || (P ? T.PRODUCER_KINDS[P.kind].name : 'native')) + (rec.parentId ? ' lineage' : '');
    const n = rec.pops[run.phylo.lastRound] || 0;
    const meta = (rec.parentId ? 'Split from ' + ((run.phylo.species[rec.parentId] || {}).name || 'its parent') + ' in round ' + rec.origin : rec.arrival ? 'Arrived in round ' + rec.origin : 'Native to this world') +
      ' · ' + (P ? n + 'k EU of biomass' : rec.extinct ? 'extinct since round ' + rec.extinct : n + ' individuals') + ' · first seen by you in round ' + rec.origin;
    const links = el('div');
    const eats = [], eatenBy = [];
    if (sp) {
      for (const f of sp.foods) { const pp = w.producerById(f); eats.push(pp ? { name: pp.name, level: 'producer', hue: pp.hue, id: pp.id } : { name: f[0].toUpperCase() + f.slice(1), level: f === 'fruit' ? 'producer' : 'decomposer', hue: 0 }); }
      for (const b of w.species) if (b !== sp && w.edible[sp.idx][b.idx]) eats.push({ name: b.name, level: b.level, hue: b.hue, id: b.id });
      for (const b of w.species) if (b !== sp && w.edible[b.idx][sp.idx]) eatenBy.push({ name: b.name + (b.isPlayer ? ' (you)' : ''), level: b.level, hue: b.hue, id: b.id });
    } else if (P) {
      for (const b of w.species) if (b.foods.has(P.id)) eatenBy.push({ name: b.name + (b.isPlayer ? ' (you)' : ''), level: b.level, hue: b.hue, id: b.id });
    }
    const chipRow = (label, items) => el('div', { class: 'link-row' }, el('span', { class: 'lbl', text: label }),
      items.length ? items.map(it => el('button', { onclick: it.id ? () => S.renderCodex(it.id) : null }, shapeIcon(it.level, it.hue), it.name)) : el('span', { text: 'nothing' }));
    if (!P) links.append(chipRow('Eats', eats));
    links.append(chipRow('Eaten by', eatenBy));
    main.append(el('div', { class: 'cx-hero' }, el('div', null, cv), el('div', null, el('div', { class: 'eyebrow', text: eyebrow }), el('h1', { text: rec.name }), el('p', { class: 'caption', text: meta }), links)));
    paintEntry(cv, rec, sp, P);
    // trait history + key genes
    const genes = historyGenes(rec);
    S.cxGene = genes.includes(S.cxGene) ? S.cxGene : genes[0];
    const tabs = el('div', { class: 'tabs-small' }, genes.map(k => el('button', { 'aria-pressed': String(k === S.cxGene), onclick: () => { S.cxGene = k; renderEntry(id); }, text: geneName(k) })));
    const chart = el('canvas', { width: 640, height: 260 });
    const hist = el('div', { class: 'card pad-l' }, el('div', { class: 'row between' }, el('h3', { class: 'h-serif', text: 'Trait history · ' + geneName(S.cxGene) }), tabs), chart);
    const table = el('table', { class: 'genes-table' });
    const par = rec.parentId ? run.phylo.species[rec.parentId] : null;
    table.append(el('tr', null, el('th', { text: '' }), el('th', { text: 'This' }), el('th', { text: par ? 'Parent' : 'Round 1' })));
    const diffs = P ? ['growth', 'tough', 'tol'].map(k => ({ key: k, name: geneName(k), a: (rec.latest || {})[k], b: (rec.founder || {})[k] })) : keyDiffs(rec, par).slice(0, 6);
    for (const d of diffs) table.append(el('tr', null, el('td', { text: d.name }), el('td', { text: d.a != null ? d.a.toFixed(2) : '—' }), el('td', { text: d.b != null ? d.b.toFixed(2) : '—' })));
    main.append(el('div', { class: 'cx-row' }, hist, el('div', { class: 'card pad-l' }, el('h3', { class: 'h-serif', text: 'Key genes' }), table)));
    requestAnimationFrame(() => drawHistory(chart, rec, par, S.cxGene));
    const note = T.ECOLOGY[rec.parentId ? 'speciation' : P ? 'producer' : rec.archetype] || T.ECOLOGY.evolution;
    main.append(el('div', { class: 'eco' }, el('b', { text: 'Real-world ecology · ' + note.title.toLowerCase() }), el('p', { text: note.text })));
  }

  function geneName(k) { return { growth: 'Growth', tough: 'Toughness', tol: 'Moisture fit' }[k] || T.GENE_BY_KEY[k].name.split(' ·')[0].replace(' / claws', ''); }

  function historyGenes(rec) {
    if (rec.level === 'producer') return ['tough', 'growth', 'tol'];
    const R = G.run.phylo.lastRound;
    const scores = [];
    const first = rec.means[rec.origin] || rec.means[1] || {};
    const last = rec.means[rec.extinct || R] || rec.latest || {};
    for (const k in last) {
      const d = T.GENE_BY_KEY[k];
      if (d && first[k] != null && !d.discrete && d.cat !== 'Body plan' && k !== 'mutability') scores.push([k, Math.abs(last[k] - first[k]) / (d.max - d.min)]);
    }
    scores.sort((a, b) => b[1] - a[1]);
    const out = scores.slice(0, 3).map(s => s[0]);
    for (const k of ['speed', 'size', 'camo']) if (out.length < 3 && !out.includes(k)) out.push(k);
    return out;
  }

  function drawHistory(cv, rec, par, key) {
    const { ctx, W, H } = hiDPI(cv, cv.clientWidth || 600, Math.round((cv.clientWidth || 600) * 0.4));
    ctx.clearRect(0, 0, W, H);
    const R = Math.max(2, G.run.phylo.lastRound);
    const series = (r) => { const out = []; for (let k = 1; k <= R; k++) if (r.means[k] && r.means[k][key] != null) out.push([k, r.means[k][key]]); return out; };
    const a = series(rec);
    let b = par ? series(par) : [];
    if (par && rec.parentId) b = b.filter(([k]) => k >= 1);
    const all = a.concat(b).map(p => p[1]);
    if (!all.length) { ctx.fillStyle = '#8C8A80'; ctx.font = '12px "IBM Plex Sans"'; ctx.fillText('History builds up round by round.', 20, 30); return; }
    let lo = Math.min(...all), hi = Math.max(...all);
    if (hi - lo < 0.2) { lo -= 0.1; hi += 0.1; }
    const L = 40, Rm = 14, Tp = 12, Bt = 26, pw = W - L - Rm, ph = H - Tp - Bt;
    const x = k => L + ((k - 1) / (R - 1)) * pw, y = v => Tp + ph - ((v - lo) / (hi - lo)) * ph;
    ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8C8A80'; ctx.strokeStyle = '#E7E0CD'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let t = 0; t <= 3; t++) { const v = lo + ((hi - lo) * t) / 3; ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(L + pw, y(v)); ctx.stroke(); ctx.fillText(v.toFixed(1), L - 4, y(v)); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let k = 1; k <= R; k++) ctx.fillText('R' + k, x(k), H - Bt + 8);
    if (rec.parentId && rec.origin > 1) {
      ctx.fillStyle = 'rgba(245,197,66,0.15)';
      ctx.fillRect(x(Math.max(1, rec.origin - 2)), Tp, x(rec.origin) - x(Math.max(1, rec.origin - 2)), ph);
      ctx.fillStyle = '#8A6A10'; ctx.fillText('Two clusters forming', (x(Math.max(1, rec.origin - 2)) + x(rec.origin)) / 2, Tp + 2);
      ctx.strokeStyle = '#555C55'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x(rec.origin - 0.5), Tp); ctx.lineTo(x(rec.origin - 0.5), Tp + ph); ctx.stroke(); ctx.setLineDash([]);
    }
    const line = (pts, color, dash, w) => {
      if (!pts.length) return;
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash);
      ctx.beginPath(); pts.forEach(([k, v], i) => (i ? ctx.lineTo(x(k), y(v)) : ctx.moveTo(x(k), y(v)))); ctx.stroke(); ctx.setLineDash([]);
      const [lk, lv] = pts[pts.length - 1];
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x(lk), y(lv), 4, 0, Math.PI * 2); ctx.fill();
    };
    const colA = rec.level === 'producer' ? T.LEVELS.producer.color : T.speciesColor(rec.level, rec.hue, 0);
    line(b, '#8A6A10', [4, 3], 1.6);
    line(a, colA, [], 2.4);
  }

  // ======================= End =======================

  S.renderEnd = function (end) {
    $('end-eyebrow').textContent = 'Run complete · round ' + end.round + ' · ' + end.difficulty;
    $('end-title').textContent = end.title;
    $('end-sub').textContent = end.sub;
    const t = $('end-score'); t.innerHTML = '';
    for (const [k, v] of end.rows) t.append(el('tr', null, el('td', { text: k }), el('td', { text: v })));
    t.append(el('tr', { class: 'total' }, el('td', { text: 'Final score' }), el('td', { text: fmt(end.score) })));
  };
})(window.Trophic);
