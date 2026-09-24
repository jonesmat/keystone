// Keystone — full screens: New world, the round report, the Codex and the run end screen.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE, UI = T.UI;
  const { el, svg, fmt, pct, plural, signed, shapeIcon, hiDPI } = UI;
  const $ = id => document.getElementById(id);
  const INK = '#1F2A24', ACCENT = '#1D6570';
  let G = null;
  const S = (T.Screens = {});

  S.init = function (game) {
    G = game;
    document.querySelectorAll('#mode-tabs button').forEach(b => b.addEventListener('click', () => G.setMode(b.dataset.mode)));
    $('nw-new').addEventListener('click', () => G.newSeed());
    $('nw-seed').addEventListener('change', e => G.setSeedString(e.target.value));
    $('nw-biome').addEventListener('change', e => G.setBiome(e.target.value));
    $('nw-begin').addEventListener('click', () => G.beginRun());
    $('nw-climate').addEventListener('change', e => G.setClimateTrend(e.target.checked));
    $('nw-volcanic').addEventListener('change', e => G.setPrimary(e.target.checked));
    $('nw-changing').addEventListener('change', e => G.setChanging(e.target.checked));
    $('nw-eco').addEventListener('change', e => G.setEcoregion(e.target.value));
    $('nw-scen').addEventListener('change', e => G.setScenario(e.target.value));
    $('btn-continue').addEventListener('click', () => G.continueRun());
    // Generated worlds are land rosters; the aquatic Open Channel is listed but only reachable from its own tab.
    for (const k in B.biomes) {
      const b = B.biomes[k], opt = el('option', { value: k, text: b.name + ' · sunlight ' + Math.round(b.light * 100) + '%' });
      if (b.aquatic) opt.disabled = true;
      $('nw-biome').append(opt);
    }
    const seg = $('nw-difficulty');
    for (const k in B.difficulties) seg.append(el('button', { 'data-diff': k, text: B.difficulties[k].name, onclick: () => G.setDifficulty(k) }));
    $('rp-continue').addEventListener('click', () => G.continueFromReport());
    $('end-new').addEventListener('click', () => G.showNewWorld());
  };

  // ======================= New world =======================

  S.renderNewWorld = function (save) {
    const st = G.setup;
    document.querySelectorAll('#mode-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === st.mode)));
    $('continue-box').hidden = !save;
    $('btn-continue').disabled = !!(save && save.old);
    if (save && save.old) $('continue-info').textContent = '— from an older version of Keystone; it cannot be loaded. Start a new world.';
    else if (save) {
      const r = save.run;
      $('continue-info').textContent = '— ' + r.worldName + ', round ' + r.round + ' · ' + B.difficulties[r.difficulty].name;
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
    renderWhittaker(cat ? st.roster && st.roster.biome : B.biomes[st.mode === 'generated' ? st.biome : st.mode === 'channel' ? 'channel' : 'meadow']);
    renderRoster(st.roster, st.stability.state === 'running');
    renderScenario();
    document.querySelectorAll('#nw-difficulty button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.diff === st.difficulty)));
    const d = B.difficulties[st.difficulty];
    $('nw-diff-note').textContent = d.name + ': start with ' + d.startSP + ' SP, income ×' + d.income + ', score ×' + d.scoreMult + '.';
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
        el('div', { class: 'track' }, el('i', { style: { width: '100%' } })), el('span', { class: 'caption', text: 'A fictional community for learning the ropes' }));
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
    $('nw-begin').disabled = s.state === 'running';
  };

  // A small Whittaker diagram (mean temperature against precipitation) with the world's climate on it.
  const WHIT_COLORS = { tundra: '#C9D3D6', taiga: '#8FAE9A', desert: '#E6CFA0', grassland: '#D6D48E', forest: '#9CC08A', tropSeasonal: '#B7C97A', rainforest: '#6FA57A' };
  function renderWhittaker(biome) {
    const box = $('nw-whittaker');
    if (!biome) { box.replaceChildren(); return; }
    const W0 = 220, H0 = 120, maxP = 400, minT = -15, maxT = 30;
    const px = p => (Math.min(p, maxP) / maxP) * W0, py = t => H0 - ((t - minT) / (maxT - minT)) * H0;
    const g = T.UI.svg('svg', { viewBox: '0 0 ' + W0 + ' ' + H0, class: 'whit-svg', role: 'img', 'aria-label': 'Whittaker biome diagram' });
    const cols = 40, rows = 24;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const p = ((c + 0.5) / cols) * maxP, t = maxT - ((r + 0.5) / rows) * (maxT - minT);
      g.append(T.UI.svg('rect', { x: (c / cols) * W0, y: (r / rows) * H0, width: W0 / cols + 0.3, height: H0 / rows + 0.3, fill: WHIT_COLORS[T.whittaker(t, p).id] }));
    }
    g.append(T.UI.svg('circle', { cx: px(biome.rain), cy: py(biome.tMean), r: 4.5, fill: '#1F2A24', stroke: '#fff', 'stroke-width': 1.5 }));
    const b = T.whittaker(biome.tMean, biome.rain);
    box.replaceChildren(el('div', { class: 'whit-fig' }, g,
      el('div', { class: 'whit-axes caption', text: 'Precipitation 0–400 cm/yr → · temperature −15 to 30 °C ↑' })),
      el('p', { class: 'caption' }, el('b', { text: b.name }), ' · ' + biome.tMean.toFixed(0) + ' °C, ' + Math.round(biome.rain) + ' cm/yr · climax: ' + b.climaxName));
  }

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
      if (list.length) rows.push([lv, list.map(x => ({ name: x.name, level: lv, hue: x.hue, sub: x.sci ? realTxt(x) : x.behavior || x.archetypeName || '' }))]);
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

  // The Stewardship card: the scenario's starting situation and goals, or a Sandbox note.
  function renderScenario() {
    const st = G.setup, box = $('nw-scenario');
    box.innerHTML = '';
    const sc = st.mode === 'catalog' && st.scenario ? T.scenarioById(st.scenario) : null;
    if (sc) {
      box.append(el('div', { class: 'eyebrow', text: 'Scenario · ' + sc.place }), el('h3', { class: 'h-serif', text: sc.name }),
        el('p', { class: 'caption', text: 'You inherit: ' + sc.start }), el('div', { class: 'caption', text: 'Goals by round ' + B.maxRounds + ':' }),
        el('ul', { class: 'goal-list' }, (sc.goals || []).map(g => el('li', null, el('span', { class: 'tick', text: '○' }), el('span', { text: g.text })))),
        el('p', { class: 'caption', text: 'Win by finishing with an average Ecosystem Health Index of ' + B.steward.winEHI + ' or more and every goal met.' }));
    } else {
      box.append(el('div', { class: 'eyebrow', text: 'Sandbox' }), el('h3', { class: 'h-serif', text: 'Keep the ecosystem healthy' }),
        el('p', { class: 'caption', text: 'No restoration goals: steward the community for ' + B.maxRounds + ' rounds and watch the Ecosystem Health Index. ' +
          'The run ends early if the EHI stays below ' + B.steward.collapseEHI + ' for 2 rounds.' }));
    }
    box.append(el('p', { class: 'caption', text: 'You don’t control any animal. You fund habitat work, harvest limits and reintroductions with Stewardship Points, and the community responds.' }));
  }

  // ======================= Round report =======================

  S.renderReport = function (rep) {
    const run = G.run, w = G.world;
    $('rp-round').textContent = 'Round ' + rep.round;
    const chips = $('rp-chips'); chips.innerHTML = '';
    for (const n of rep.gone) chips.append(el('span', { class: 'chip chip-red' }, n + ' lost'));
    const ob = $('rp-outcome');
    ob.hidden = !rep.outcome;
    if (rep.outcome) { ob.className = 'outcome ' + (rep.outcome.win ? 'win' : 'lose'); ob.textContent = rep.outcome.headline; }
    // EHI as the steward sees it: each component a range, with its cause where they know enough to say.
    const SUI = T.StewardUI, v = rep.view;
    $('rp-ehi-total').textContent = SUI.rangeTxt(v.lo, v.hi);
    const eb = $('rp-ehi'); eb.innerHTML = '';
    v.components.forEach((c, k) => {
      const d = rep.deltas[k];
      eb.append(el('div', { class: 'ehi-row' }, el('span', { text: c.name }),
        el('div', { class: 'trk' }, el('i', { style: { width: (100 * c.lo / c.weight) + '%' } }), el('i', { class: 'unc', style: { width: (100 * (c.hi - c.lo) / c.weight) + '%' } })),
        el('b', { class: 'mono', text: SUI.rangeTxt(c.lo, c.hi) + '/' + c.weight }),
        el('span', { class: 'mono ' + (d.delta >= 0 ? 'pos' : 'neg'), text: rep.round > 1 && c.known >= 0.5 ? (d.delta >= 0 ? '+' : '−') + Math.abs(d.delta).toFixed(1) : '' }),
        el('small', { text: c.known >= 0.5 ? d.cause : 'Not enough data to say: survey more (' + Math.round(c.known * 100) + '% known)' })));
    });
    if (rep.discovered && rep.discovered.length) eb.append(el('p', { class: 'caption', text: 'New this round: ' + rep.discovered.join(', ') + '.' }));
    const gb = $('rp-goals'); gb.innerHTML = '';
    if (rep.goals.length) gb.append(el('h3', { class: 'h-serif', text: 'Restoration goals' }),
      el('ul', { class: 'goal-list' }, rep.goals.map(g => el('li', { class: g.met ? 'met' : '' }, el('span', { class: 'tick', text: g.met ? '✓' : '○' }), el('span', null, g.text, el('small', { text: g.now }))))));
    // Energy through the consumers.
    const eff = UI.drawSankey($('rp-sankey'), rep.energy);
    $('rp-sankey-note').textContent = eff ? 'Only ' + Math.round(eff * 100) + '% of what the consumers ate became new tissue' : '';
    // Populations chart.
    const lg = $('rp-legend');
    requestAnimationFrame(() => {
      lg.innerHTML = '';
      UI.drawPopChart($('rp-popchart'), rep);
      for (const ln of rep.lines) {
        const c = T.speciesColor(ln.level, ln.hue, -0.05);
        lg.append(el('li', null, el('i', { style: { borderTop: '2px ' + (ln.dash && ln.dash.length ? 'dashed' : 'solid') + ' ' + c } }), ln.name, el('span', { class: 'n', text: pct(ln.end / Math.max(1, ln.start)) })));
      }
    });
    // Demography for every species.
    const db = $('rp-demog'); db.innerHTML = '';
    const tbl = el('table', null, el('tr', null, ['Species', 'N0', 'B', 'I', 'D', 'E', 'N1', 'r', 'K', 'Curve'].map(h => el('th', { text: h }))));
    // Studied species show every term; surveyed ones an estimate; sighted ones a word. Unknown species aren't listed.
    const rows = rep.demography.filter(d => (d.N0 > 0 || d.N1 > 0) && w.speciesById(d.id) && UI.known(w.speciesById(d.id)))
      .sort((a, b) => (T.LEVEL_ORDER.indexOf(a.level) - T.LEVEL_ORDER.indexOf(b.level)) || b.N1 - a.N1);
    for (const d of rows) {
      const sp = w.speciesById(d.id), lv = UI.knowLevel(sp);
      const cells = lv >= 3 ? [d.N0, d.B, d.I, d.D, d.E, d.N1].map(x => el('td', { class: 'mono', text: fmt(x) }))
        : [el('td', { class: 'mono', text: '' }), el('td'), el('td'), el('td'), el('td'), el('td', { class: 'mono', text: UI.popText(sp, d.N1) })];
      tbl.append(el('tr', { class: d.N1 === 0 && lv >= 2 ? 'gone' : '' }, el('td', null, shapeIcon(d.level, sp.hue), ' ' + d.name), ...cells,
        el('td', { class: 'mono ' + (lv < 3 || d.r == null ? '' : d.r >= 0 ? 'pos' : 'neg'), text: lv < 3 || d.r == null ? '—' : (d.r >= 0 ? '+' : '') + Math.round(d.r) + '%' }),
        el('td', { class: 'mono', text: lv >= 3 && d.K ? fmt(d.K) : '—' }), el('td', { text: lv >= 3 ? d.curve : ['', 'sighted', 'surveyed'][lv] })));
    }
    db.append(tbl);
    // Notes: what changed and why.
    const nb = $('rp-notes'); nb.innerHTML = '';
    for (const n of rep.notes) nb.append(el('li', null, el('span', { class: 'chip', text: 'Note' }), el('span', { text: n })));
    S.renderCommunity(rep);
    // SP.
    $('rp-sp-total').textContent = Math.round(run.sp);
    const t = $('rp-sp'); t.innerHTML = '';
    for (const [k, v] of rep.parts) t.append(el('tr', null, el('td', { text: k }), el('td', { text: (v > 0 ? '+' : '') + v })));
    t.append(el('tr', { class: 'total' }, el('td', { text: 'Earned this round' }), el('td', { text: '+' + rep.income })));
    const cont = $('rp-continue');
    cont.innerHTML = '';
    cont.append(rep.outcome ? 'See final score ' : 'Plan next round ', el('span', { 'aria-hidden': 'true', text: '→' }));
    S.renderInteractions(rep);
  };

  // The community card: the mandate, each stakeholder's trust, asks met or failed, arrivals, departures and land sales.
  S.renderCommunity = function (rep) {
    const box = $('rp-community'), c = rep.community;
    box.innerHTML = '';
    $('rp-mandate').textContent = rep.mandate != null ? rep.mandate + '%' : '—';
    if (!c || !rep.stake) return;
    box.append(el('p', { class: 'caption', text: 'Mandate: the community’s trust, weighted by each stakeholder’s influence. Below ' + B.stakeholders.loseMandate + '% for ' + B.stakeholders.loseRounds + ' rounds, the board replaces you.' }));
    box.append(T.StewardUI.stakeList(rep.stake.filter(s => s.active)));
    const items = [];
    for (const a of c.asks) items.push(el('li', null, el('span', { class: 'chip', text: a.ok ? 'Ask met' : 'Ask failed' }), el('span', { text: a.who + ': ' + a.text + (a.ok ? ' (+' + a.reward + ' SP)' : '') })));
    for (const ch of c.changes) items.push(el('li', null, el('span', { class: 'chip', text: 'Community' }), el('span', { text: ch[0].toUpperCase() + ch.slice(1) + '.' })));
    if (c.sale) items.push(el('li', null, el('span', { class: 'chip', text: 'Land' }), el('span', { text: c.sale.text })));
    const log = G.run.stake.log.filter(l => l.round === rep.round);
    const byWho = {};
    for (const l of log) (byWho[l.who] = byWho[l.who] || []).push((l.d > 0 ? '+' : '') + l.d + ' ' + l.why);
    for (const who in byWho) items.push(el('li', null, el('span', { class: 'chip', text: 'Trust' }), el('span', { text: who + ': ' + byWho[who].join(', ') })));
    if (items.length) box.append(el('ul', { class: 'inter-list' }, items));
  };

  // Interactions card: diversity, this round's interactions and the keystone tests' results as they arrive.
  const INTER_CHIP = { commensalism: '+ / 0', protocooperation: '+ / +', amensalism: '0 / −', parasitism: '+ / −', mutualism: '+ / +', competition: '− / −' };
  S.renderInteractions = function (rep) {
    const ir = rep.interactions, list = $('rp-inter'), kbox = $('rp-keystone');
    list.innerHTML = ''; kbox.innerHTML = '';
    if (!ir) { $('rp-div').textContent = ''; return; }
    const d = ir.diversity;
    $('rp-div').textContent = 'Richness ' + d.richness + ' (' + d.animals + ' animal, ' + d.plants + ' plant species) · Shannon H ' + d.H.toFixed(2) + ' animals, ' + d.Hplants.toFixed(2) + ' plants';
    if (!ir.items.length) list.append(el('li', null, el('span', { class: 'caption', text: 'No notable interactions this round beyond feeding.' })));
    for (const it of ir.items) list.append(el('li', { class: 'it-' + it.type }, el('span', { class: 'chip', text: it.type[0].toUpperCase() + it.type.slice(1) + ' ' + INTER_CHIP[it.type] }), el('span', { text: it.text })));
    const hab = ir.habitat;
    const ext = ir.extinctions.length ? ir.extinctions.join(', ') + ' went locally extinct. ' : '';
    list.append(el('li', null, el('span', { class: 'chip', text: 'Habitat' }), el('span', { text: (hab.wood ? Math.round(hab.interiorShare * 100) + '% of woodland is interior (3+ tiles from open ground). ' : 'No woodland. ') +
      ext + 'Extinction rate: ' + ir.extinctionRate.toFixed(2) + ' per round (a round is a year; the fossil background for mammals is 0.002–0.02 per year, the 20th century about 0.25).' })));
    const ks = rep.keystone;
    kbox.append(el('h3', { class: 'h-serif', text: 'Keystone tests' }),
      el('p', { class: 'caption', text: ks.total ? (ks.running ? 'Running during the next season: ' + ks.done.length + ' of ' + ks.total + ' done. ' : 'All ' + ks.total + ' done. ') +
        'Each test replays 3 rounds without the species; a drop of more than 25% in richness or diversity earns a badge.' : 'No candidates this round.' }));
    const knownRes = r => r.ids.some(id => { const sp = G.world.speciesById(id); return sp && UI.known(sp); });
    const found = ks.done.filter(r => r.keystone && knownRes(r)), other = ks.done.filter(r => !r.keystone && knownRes(r));
    for (const r of found) kbox.append(el('div', { class: 'ks-row ks-yes' }, el('b', { text: '★ ' + r.name }), el('span', { text: ' −' + Math.round(r.drop * 100) + '% without it' + (r.effects.length ? ': ' + r.effects.join('; ') : '') })));
    if (other.length) kbox.append(el('p', { class: 'caption', text: 'Not keystone: ' + other.map(r => r.name.split(' (')[0] + ' (−' + Math.round(r.drop * 100) + '%)').join(', ') }));
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

  function deathLabel(k) {
    if (k.startsWith('k:')) {
      const sp = G.world.speciesById(k.slice(2));
      return 'Eaten by ' + (sp ? plural(sp.name) : 'predators');
    }
    if (k.startsWith('starved')) { const s = k.split('@')[1]; return 'Starved' + (s ? ' in ' + s.toLowerCase() : ''); }
    return { plague: 'Plague', emigrated: 'Left the map', old: 'Old age', harvest: 'Harvested', controlled: 'Removed (invasive control)' }[k] || k;
  }
  S.deathLabel = deathLabel;

  // ======================= Codex =======================

  // Every species in the world: its fixed trait sheet, food web links, population history and ecology notes.
  S.renderCodex = function (id) {
    const w = G.world, run = G.run, pops = w.countPops().count;
    const entries = w.producers.filter(Boolean).map(P => ({ id: P.id, name: P.name, level: 'producer', hue: P.hue, P }))
      .concat(w.species.filter(sp => !sp.transient && UI.known(sp)).map(sp => ({ id: sp.id, name: sp.name, level: sp.level, hue: sp.hue, sp, gone: !pops[sp.idx] && UI.knowLevel(sp) >= 2 })));
    $('cx-sub').textContent = '· ' + entries.length + ' entries';
    const list = $('cx-list'); list.innerHTML = '';
    const groups = [['producer', 'Producers'], ['herbivore', 'Herbivores'], ['omnivore', 'Omnivores'], ['carnivore1', 'Carnivores'], ['carnivore2', 'Apex'], ['decomposer', 'Decomposers']];
    if (!id || !entries.some(e => e.id === id)) id = entries[0].id;
    for (const [lv, label] of groups) {
      const es = entries.filter(e => e.level === lv);
      if (!es.length) continue;
      list.append(el('div', { class: 'eyebrow', text: label, style: { color: T.speciesColor(lv, 0, -0.3) } }));
      for (const e of es) list.append(el('button', { class: e.gone ? 'extinct' : '', 'aria-current': String(e.id === id), onclick: () => S.renderCodex(e.id) },
        shapeIcon(lv, e.hue), el('span', { text: e.name + (w.keystones && w.keystones[e.id] ? ' ★' : '') })));
    }
    renderEntry(entries.find(e => e.id === id));
  };

  function renderEntry(ent) {
    const main = $('cx-main'); main.innerHTML = '';
    const w = G.world, run = G.run, sp = ent.sp, P = ent.P;
    const cv = el('canvas', { width: 600, height: 380 });
    const m = sp ? sp.meta : P;
    const eyebrow = T.LEVELS[ent.level].short + ' · ' + (P ? T.PRODUCER_KINDS[P.kind].name + (P.habit ? ' · ' + P.habit : '') : sp.archetypeName || 'native');
    const n = sp ? w.countPops().count[sp.idx] : (w.cover ? w.cover[P.idx] : 0);
    const meta = (m && m.sci ? m.sci + ' · ' : '') + (m && m.native === false ? 'non-native · ' : '') + (m && m.iucn && !['LC', 'DD', 'NE'].includes(m.iucn) ? 'IUCN ' + m.iucn + ' · ' : '') +
      (P ? n + ' tiles · stage: ' + T.SERAL_STAGES[P.stage] : ['', 'Sighted', 'Surveyed', 'Studied'][UI.knowLevel(sp)] + ' · ' + UI.popText(sp, n));
    const links = el('div');
    const eats = [], eatenBy = [];
    const studied = !sp || UI.knowLevel(sp) >= 3;
    if (sp && studied) {
      for (const f of sp.foods) { const pp = w.producerById(f); eats.push(pp ? { name: pp.name, level: 'producer', hue: pp.hue, id: pp.id } : { name: f[0].toUpperCase() + f.slice(1), level: f === 'fruit' ? 'producer' : 'decomposer', hue: 0 }); }
      for (const b of w.species) if (b !== sp && w.edible[sp.idx][b.idx]) eats.push({ name: b.name, level: b.level, hue: b.hue, id: b.id });
      for (const b of w.species) if (b !== sp && w.edible[b.idx][sp.idx]) eatenBy.push({ name: b.name, level: b.level, hue: b.hue, id: b.id });
    } else for (const b of w.species) if (b.foods.has(P.id)) eatenBy.push({ name: b.name, level: b.level, hue: b.hue, id: b.id });
    const chipRow = (label, items) => el('div', { class: 'link-row' }, el('span', { class: 'lbl', text: label }),
      items.length ? items.map(it => el('button', { onclick: it.id ? () => S.renderCodex(it.id) : null }, shapeIcon(it.level, it.hue), it.name)) : el('span', { text: 'nothing' }));
    // Diet and predators are known once the species is Studied.
    const knownLinks = list => list.filter(it => it.level === 'producer' || it.level === 'decomposer' || !w.speciesById(it.id) || UI.known(w.speciesById(it.id)));
    if (sp && studied) links.append(chipRow('Eats', knownLinks(eats)));
    if (studied) links.append(chipRow('Eaten by', knownLinks(eatenBy)));
    else links.append(el('p', { class: 'caption', text: 'Study it (surveys in 3 rounds, or a radio collar) to learn its diet and predators.' }));
    main.append(el('div', { class: 'cx-hero' }, el('div', null, cv), el('div', null, el('div', { class: 'eyebrow', text: eyebrow }), el('h1', { text: ent.name }), el('p', { class: 'caption', text: meta }), links)));
    paintEntry(cv, sp, P);
    // Population history and the trait sheet.
    const chart = el('canvas', { width: 640, height: 240 });
    const hist = el('div', { class: 'card pad-l' }, el('h3', { class: 'h-serif', text: sp ? 'Population by round' : 'Tiles covered' }), chart);
    const table = el('table', { class: 'genes-table' });
    const rows = sp ? traitRows(sp) : [['Standing crop, max', fmt(P.max) + ' EU'], ['Seral stage', T.SERAL_STAGES[P.stage]], ['Seed range', P.dispersal + ' tiles'], ['Lives', P.longevity + ' rounds'],
      ['Edible share', Math.round((P.edible == null ? B.edibleDefault : P.edible) * 100) + '%'], ['Nitrogen', P.fixer ? 'fixes its own' : 'from the soil']];
    for (const [k, v] of rows) table.append(el('tr', null, el('td', { text: k }), el('td', { text: v })));
    main.append(el('div', { class: 'cx-row' }, hist, el('div', { class: 'card pad-l' }, el('h3', { class: 'h-serif', text: 'Trait sheet' }), table,
      el('p', { class: 'caption', text: 'Traits are fixed for the species: one round is a year, far too short for evolution. Individuals differ only in age, sex, condition and position.' }))));
    const collar = sp && run.know[sp.id] && run.know[sp.id].collared;
    if (collar) {
      const fate = w.collarFates && w.collarFates[collar.id];
      main.append(el('div', { class: 'eco' }, el('b', { text: 'Radio collar · #' + String(collar.num).padStart(4, '0') + ' (collared round ' + collar.round + ')' }),
        el('p', { text: fate ? 'Its collar stopped moving in round ' + fate.round + ': ' + (fate.cause === 'k' ? 'killed by ' + (fate.by ? plural(fate.by) : 'a predator') : fate.cause === 'emigrated' ? 'it left the map' : fate.cause.startsWith('starved') ? 'it starved' : fate.cause) + '.' : 'Still transmitting. Select it on the map to follow it.' })));
    }
    // Its history as the steward measured it: survey estimates by round.
    const series = sp ? ((run.know[sp.id] || {}).estimates || []).filter(e => e.round >= 1).map(e => e.N) : null;
    requestAnimationFrame(() => drawHistory(chart, series));
    const ksRec = w.keystones && w.keystones[ent.id];
    if (ksRec) main.append(el('div', { class: 'eco' }, el('b', { text: '★ Keystone species (tested round ' + ksRec.round + ')' }),
      el('p', { text: 'When the world was replayed for 3 rounds without ' + (ksRec.guild || ent.name) + ', the rest of the community lost ' + Math.round(ksRec.drop * 100) +
        '% of its richness or diversity' + (ksRec.effects.length ? ': ' + ksRec.effects.join('; ') + '.' : '.') + ' A keystone species has an effect far larger than its abundance, like the sea star Pisaster, whose removal let mussels crowd out most other species.' })));
    const note = (sp && sp.note) || (P && P.note);
    if (note) main.append(el('div', { class: 'eco' }, el('b', { text: 'About this species' }), el('p', { text: note })));
    const eco = T.ECOLOGY[P ? 'producer' : sp.archetype];
    if (eco) main.append(el('div', { class: 'eco' }, el('b', { text: 'Real-world ecology · ' + eco.title.toLowerCase() }), el('p', { text: eco.text })));
  }

  function traitRows(sp) {
    const st = sp.stats, m = sp.meta;
    return [['Body mass', m && m.massKg ? (m.massKg >= 1 ? m.massKg.toFixed(m.massKg >= 10 ? 0 : 1) + ' kg' : Math.round(m.massKg * 1000) + ' g') : 'size ' + st.mass.toFixed(1)],
      ['Diet', st.meat >= 0.7 ? 'mostly meat' : st.meat <= 0.3 ? 'mostly plants' : 'plants and animals'], ['Metabolism', st.ecto ? 'ectotherm' : 'endotherm'],
      ['Lifespan', (st.lifeTicks / B.roundTicks).toFixed(1) + ' rounds'], ['Litter or clutch', String(st.litter)], ['Mating', sp.mating || '—'],
      ['Feeds in', T.STRATA[sp.strat != null ? sp.strat : 4]], ['Simulated as', sp.grid ? 'Populations (densities)' : 'individuals']];
  }

  function paintEntry(cv, sp, P) {
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
      if (P.tweaks) T.paintCreature(cv, { tweaks: P.tweaks }, { keep: true, scale: 1.05 });   // P3-ART plant template
      return;
    }
    T.paintCreature(cv, { genome: sp.genome, level: sp.level, hue: sp.hue, id: sp.id, tweaks: sp.meta && sp.meta.tweaks }, { t: 0.3, scale: 1.05 });
  }

  function drawHistory(cv, series) {
    const { ctx, W, H } = hiDPI(cv, cv.clientWidth || 600, Math.round((cv.clientWidth || 600) * 0.38));
    ctx.clearRect(0, 0, W, H);
    ctx.font = '12px "IBM Plex Sans"'; ctx.fillStyle = '#8C8A80';
    if (!series || series.length < 2) { ctx.fillText(series ? 'History builds up round by round.' : 'Cover is tracked on the map.', 20, 30); return; }
    const hi = Math.max(1, ...series), L = 44, Rm = 14, Tp = 12, Bt = 24, pw = W - L - Rm, ph = H - Tp - Bt;
    const x = k => L + (k / (series.length - 1)) * pw, y = v => Tp + ph - (v / hi) * ph;
    ctx.font = '10px "IBM Plex Mono", monospace'; ctx.strokeStyle = '#E7E0CD'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let t = 0; t <= 3; t++) { const v = (hi * t) / 3; ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(L + pw, y(v)); ctx.stroke(); ctx.fillText(fmt(v), L - 4, y(v)); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    series.forEach((_, k) => { if (series.length < 16 || k % 5 === 0) ctx.fillText(k === 0 ? 'start' : 'R' + k, x(k), H - Bt + 8); });
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2.2;
    ctx.beginPath(); series.forEach((v, k) => (k ? ctx.lineTo(x(k), y(v)) : ctx.moveTo(x(k), y(v)))); ctx.stroke();
  }

  // ======================= End =======================

  S.renderEnd = function (end) {
    $('end-eyebrow').textContent = 'Run complete · round ' + end.round + ' · ' + end.difficulty;
    $('end-title').textContent = end.title;
    $('end-sub').textContent = end.sub;
    const t = $('end-score'); t.innerHTML = '';
    for (const [k, v] of end.rows) t.append(el('tr', null, el('td', { text: k }), el('td', { text: fmt(v) })));
    t.append(el('tr', { class: 'total' }, el('td', { text: 'Final score' }), el('td', { text: fmt(end.score) })));
  };
})(window.Trophic);
