// Keystone — the steward's panels (P3-M7): the right-hand panel (Plan: goals, the action palette, the queue and
// harvest limits; Season: the EHI and a watch list) and the action bar under the map.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE, UI = T.UI, St = T.Steward;
  const { el, fmt, pct, plural, shapeIcon } = UI;
  const $ = id => document.getElementById(id);
  const G = () => T.Game;
  const SU = (T.StewardUI = {});

  // All consumers' round stats added together (for the report's energy diagram).
  SU.combinedStats = function (w) {
    const out = { eaten: {}, assimilated: 0, excreted: 0, upkeepHeat: 0, digestHeat: 0 };
    w.species.forEach((sp, i) => {
      const rs = w.rstats[i];
      if (!rs || sp.level === 'decomposer') return;
      for (const k in rs.eaten) {
        const lab = w.plantNames.has(k) ? (k === 'Fruit' ? 'Fruit' : k === 'Detritus' ? 'Detritus' : 'Plants') : 'Animals';
        out.eaten[lab] = (out.eaten[lab] || 0) + rs.eaten[k];
      }
      out.assimilated += rs.assimilated; out.excreted += rs.excreted; out.upkeepHeat += rs.upkeepHeat; out.digestHeat += rs.digestHeat;
    });
    return out;
  };

  // The EHI as the steward sees it: each component a range, narrow where they know the inputs.
  const rangeTxt = (lo, hi) => (Math.round(lo) === Math.round(hi) ? String(Math.round(lo)) : Math.round(lo) + '–' + Math.round(hi));
  const ehiBars = view => el('div', { class: 'ehi-bars' }, view.components.map(c => el('div', { class: 'ehi-row', title: c.known >= 0.5 ? c.cause : 'Not enough data: survey more' },
    el('span', { text: c.name }), el('div', { class: 'trk' }, el('i', { style: { width: (100 * c.lo / c.weight) + '%' } }), el('i', { class: 'unc', style: { width: (100 * (c.hi - c.lo) / c.weight) + '%' } })),
    el('b', { class: 'mono', text: rangeTxt(c.lo, c.hi) + '/' + c.weight }))));
  SU.ehiBars = ehiBars; SU.rangeTxt = rangeTxt;

  // Stakeholders with trust bars: allies above 70, opponents below 30.
  SU.stakeList = function (list) {
    const P = B.stakeholders;
    return el('ul', { class: 'stake-list' }, list.map(s => {
      const Ty = T.Stakeholders.TYPES[s.type], role = s.trust > P.ally ? 'ally' : s.trust < P.opponent ? 'opponent' : '';
      const tip = 'Likes: ' + (Ty.likes.map(id => St.actionById(id).name).join(', ') || 'nothing in particular') + '. Dislikes: ' + (Ty.dislikes.map(id => St.actionById(id).name).join(', ') || 'nothing in particular') + '.';
      return el('li', { class: role, title: tip }, el('div', { class: 'row between' }, el('span', null, el('b', { text: s.name }), el('small', { text: ' ' + Ty.name + (s.parcel != null ? ' · landholder' : '') })),
        el('span', { class: 'mono', text: Math.round(s.trust) + (role ? ' · ' + role : '') })),
        el('div', { class: 'trk' }, el('i', { style: { width: s.trust + '%' } })));
    }));
  };

  // The community in Plan: the mandate, stakeholders, their asks and any land for sale.
  function renderCommunity(box) {
    const g = G(), run = g.run, st = run.stake;
    if (!st || !st.list.length) return;
    const P = B.stakeholders;
    box.append(el('div', { class: 'row between' }, el('h3', { class: 'h-serif', text: 'The community' }), el('b', { class: 'mono' + (st.mandate < P.loseMandate ? ' neg' : ''), text: 'mandate ' + st.mandate + '%' })));
    box.append(SU.stakeList(st.list.filter(s => s.active)));
    if (run.mandateLow) box.append(el('p', { class: 'event-note', text: '⚠ Your mandate is below ' + P.loseMandate + '%: one more round like this and the board replaces you.' }));
    st.asks.forEach((a, k) => {
      const s = st.list[a.from];
      const card = el('div', { class: 'ask card' + (a.state !== 'open' ? ' answered' : '') }, el('div', { class: 'caption', text: s.name + ' asks · +' + a.reward + ' SP if met' }), el('p', { text: a.text }));
      if (a.state === 'open') card.append(el('div', { class: 'row gap' }, el('button', { class: 'btn primary small', text: 'Accept', onclick: () => g.answerAsk(k, true) }),
        el('button', { class: 'btn small', text: 'Decline', onclick: () => g.answerAsk(k, false) })));
      else card.append(el('div', { class: 'caption', text: a.state === 'accepted' ? '✓ Accepted: checked at the end of the round' : 'Declined' }));
      box.append(card);
    });
    if (st.sale) {
      const w = g.world, pc = w.parcels[st.sale.parcel];
      box.append(el('div', { class: 'ask card sale' }, el('div', { class: 'caption', text: 'Land for sale' }),
        el('p', { text: st.sale.from + '’s land (' + pc.tiles + ' tiles) is on the market. Bid for a conservation easement and it’s protected and yours to manage; otherwise another buyer takes it this round.' + (st.sale.allies ? ' Your allies chip in toward the price.' : '') }),
        el('button', { class: 'btn primary small', disabled: run.sp < st.sale.price, text: 'Bid · ' + st.sale.price + ' SP', onclick: () => g.bidSale() })));
    }
  }

  // What each action tends to do: how soon, and which EHI components it usually moves (+ up, − down, ± either way,
  // depending on the land). Predictions, not promises: the community decides.
  SU.EFFECTS = {
    'survey-count': { lag: 'at once', knowledge: true }, 'survey-camera': { lag: 'at once', knowledge: true }, 'survey-traps': { lag: 'at once', knowledge: true },
    'survey-pitfall': { lag: 'at once', knowledge: true }, 'survey-water': { lag: 'at once', knowledge: true }, transect: { lag: 'at once', knowledge: true },
    soiltest: { lag: 'at once', knowledge: true }, wellgauge: { lag: 'at once', knowledge: true }, collar: { lag: 'at once', knowledge: true }, monitor: { lag: 'every round', knowledge: true },
    burn: { lag: '1–3 rounds', ehi: { habitat: '±', biodiversity: '+', cycles: '−' } },
    shred: { lag: 'next round', ehi: { biodiversity: '+' } },
    disc: { lag: '1–3 rounds', ehi: { cycles: '−', habitat: '−', biodiversity: '+' } },
    overseed: { lag: '1–3 rounds', ehi: { biodiversity: '+', habitat: '+' } },
    plant: { lag: '1–2 rounds', ehi: { biodiversity: '+', keystone: '+' } },
    legumes: { lag: '1–2 rounds', ehi: { cycles: '+', energy: '+' } },
    loosen: { lag: 'next round', ehi: { cycles: '+' } },
    reforest: { lag: '5+ rounds', ehi: { habitat: '+', cycles: '+' } },
    corridor: { lag: '3–5 rounds', ehi: { habitat: '+', viability: '+' } },
    wetland: { lag: '1–2 rounds', ehi: { cycles: '+', biodiversity: '+' } },
    buffer: { lag: '2–4 rounds', ehi: { cycles: '+' } },
    exclosure: { lag: '1–3 rounds', ehi: { habitat: '+', energy: '+' } },
    timber: { lag: 'at once', ehi: { habitat: '−', cycles: '−' } },
    water: { lag: '2–5 rounds', ehi: { cycles: '+' } },
    reintroduce: { lag: '2–5 rounds', ehi: { energy: '±', keystone: '+', biodiversity: '+', stability: '−' } },
    translocate: { lag: 'next round', ehi: { viability: '+' } },
    control: { lag: '2–4 rounds', ehi: { biodiversity: '+', stability: '+' } },
    protect: { lag: 'every round', ehi: { viability: '+' } },
    'rapid-survey': { lag: 'at once', knowledge: true }, firecrew: { lag: 'this season', ehi: { habitat: '+' } }, spot: { lag: 'at once', ehi: { biodiversity: '+' } },
  };
  SU.effectRow = function (id) {
    const e = SU.EFFECTS[id];
    if (!e) return el('span');
    const row = el('div', { class: 'effects' }, el('span', { class: 'lag', text: 'Takes effect: ' + e.lag }));
    if (e.knowledge) row.append(el('span', { class: 'chip', text: 'Knowledge: narrows the EHI range' }));
    for (const c of St.COMPONENTS) if (e.ehi && e.ehi[c.key]) row.append(el('span', { class: 'chip ' + (e.ehi[c.key] === '+' ? 'up' : e.ehi[c.key] === '−' ? 'down' : ''), text: e.ehi[c.key] + ' ' + c.name }));
    return row;
  };

  const goalList = (goals) => el('ul', { class: 'goal-list' }, goals.map(g => el('li', { class: g.met ? 'met' : '' }, el('span', { class: 'tick', text: g.met ? '✓' : '○' }), el('span', null, g.text, el('small', { text: g.now })))));

  // ---------- right panel ----------

  UI.renderStewardPanel = function (force) {
    const g = G(), w = g.world, run = g.run, box = $('steward-panel');
    if (!w || !run) return;
    const now = performance.now();
    // The season view refreshes once a second, and not while a species is being picked for a rapid response.
    if (g.state === 'simulate' && !force && SU.panelAt && (now - SU.panelAt < 1000 || (g.chosen && box.contains(document.activeElement)))) return;
    // In Plan, redraw only when something changed, so a harvest limit being typed isn't wiped out.
    const key = g.state + '|' + run.round + '|' + Math.round(run.sp) + '|' + g.chosen + '|' + run.queue.length + '|' + run.standing.length + '|' + JSON.stringify(run.harvest) + '|' + (run.ehiHistory.length) +
      '|' + (run.stake ? run.stake.asks.map(a => a.state).join() + (run.stake.sale ? 's' : '') + run.stake.mandate : '');
    if (g.state === 'plan' && key === SU.planKey && box.children.length) return;
    SU.planKey = key;
    SU.panelAt = now;
    box.innerHTML = '';
    const ehiTxt = run.ehiHistory.length && run.ehiView ? rangeTxt(run.ehiView.lo, run.ehiView.hi) : '—';
    box.append(el('div', { class: 'sp-head' }, el('div', null, el('h3', { class: 'h-serif', text: g.state === 'plan' ? 'Plan · round ' + run.round : 'Season · round ' + run.round }),
      el('div', { class: 'caption', text: run.scenarioName || 'Sandbox: no goals, watch the EHI' }))));
    box.append(el('div', { class: 'stat-cards' },
      el('div', { class: 'stat' }, el('div', { class: 'eyebrow', text: 'Stewardship Points' }), el('div', { class: 'mono big', text: String(Math.round(run.sp)) }), el('div', { class: 'caption', text: run.queue.length ? run.queue.length + ' action' + (run.queue.length > 1 ? 's' : '') + ' queued' : 'fund your actions' })),
      el('div', { class: 'stat' }, el('div', { class: 'eyebrow', text: 'Ecosystem Health' }), el('div', { class: 'mono big', text: ehiTxt }), el('div', { class: 'caption', text: run.ehiHistory.length ? 'of 100 · your estimate' : 'after the first round' }))));
    if (run.ehiHistory.length && run.ehiView) box.append(ehiBars(run.ehiView));
    const goals = St.goals(w, run);
    if (goals.length) box.append(el('h3', { class: 'h-serif', text: 'Restoration goals' }), goalList(goals));
    if (g.state === 'plan') { renderPlan(box); renderCommunity(box); }
    else renderWatch(box);
  };

  function renderPlan(box) {
    const g = G(), w = g.world, run = g.run;
    if (run.pendingEvent) {
      const e = T.EVENTS.find(x => x.id === run.pendingEvent);
      box.append(el('div', { class: 'event-note' }, el('b', { text: '⚠ This season: ' + e.name }), ' ' + e.effect));
    }
    // The chosen action: area actions are placed on the map, species actions pick a species here.
    const a = g.chosen ? St.actionById(g.chosen) : null;
    if (a) {
      const card = el('div', { class: 'action-card card' }, el('div', { class: 'row between' }, el('b', { text: a.name }), el('button', { class: 'linklike', text: 'cancel', onclick: () => g.chooseAction(null) })),
        el('p', { class: 'caption', text: a.desc }), SU.effectRow(a.id), el('p', { class: 'caption', text: 'Teaches: ' + a.teach }));
      if (a.target === 'area') card.append(el('p', { class: 'note-teal', text: 'Click the map to place it (about ' + St.cost(w, a, { x: w.N / 2, y: w.N / 2, r: a.r }) + ' SP for a full circle; less at the edges).' }),
        a.method ? el('p', { class: 'caption', text: 'Detects: ' + T.Knowledge.METHODS[a.method].taxa + '.' }) : el('span'));
      else if (a.target === 'none') card.append(el('button', { class: 'btn primary small', disabled: run.sp < a.base || (a.id === 'monitor' && !run.queue.some(q => /^survey-/.test(q.id))),
        text: a.id === 'monitor' ? 'Start with this round\u2019s surveys' : 'Queue · ' + a.base + ' SP', onclick: () => g.queueSpecies(a.id, null) }));
      else {
        const list = St.targets(w, a);
        if (!list.length) card.append(el('p', { class: 'caption', text: a.who === 'pool' ? 'No species is waiting in the regional pool.' : 'No species to target.' }));
        const sel = el('select', { 'aria-label': 'Species' }, list.map(sp => el('option', { value: sp.id, text: sp.name + (sp.meta && sp.meta.sci ? ' (' + sp.meta.sci + ')' : '') })));
        card.append(sel, el('button', { class: 'btn primary small', disabled: !list.length || run.sp < a.base, text: 'Queue · ' + a.base + ' SP' + (a.standing ? ' per round' : ''),
          onclick: () => g.queueSpecies(a.id, sel.value) }));
      }
      box.append(card);
    }
    // The queue.
    if (run.queue.length || run.standing.length) {
      box.append(el('h3', { class: 'h-serif', text: 'This round' }));
      const ul = el('ul', { class: 'queue' });
      run.queue.forEach((q, k) => {
        const qa = St.actionById(q.id), sp = q.species && w.speciesById(q.species);
        ul.append(el('li', null, el('span', { text: qa.name + (sp ? ' · ' + sp.name : '') }), el('b', { class: 'mono', text: q.cost + ' SP' }), el('button', { 'aria-label': 'Remove', html: '&times;', onclick: () => g.unqueue(k) })));
      });
      for (const s of run.standing) {
        const qa = St.actionById(s.id), sp = w.speciesById(s.species);
        const cost = s.id === 'monitor' ? (run.monitoring || []).reduce((a2, m) => a2 + m.cost, 0) : qa.base;
        ul.append(el('li', { class: 'standing' }, el('span', { text: qa.name + (sp ? ' · ' + sp.name : s.id === 'monitor' ? ' · ' + (run.monitoring || []).length + ' surveys' : '') + ' (standing)' }), el('b', { class: 'mono', text: cost + '/round' }), el('button', { 'aria-label': 'Stop', html: '&times;', onclick: () => g.stopStanding(s) })));
      }
      box.append(ul);
    }
    // Harvest limits: a bag limit per round, against the species' carrying capacity.
    box.append(el('h3', { class: 'h-serif', text: 'Harvest limits' }), el('p', { class: 'caption', text: 'Bag limits per round, set against your survey estimates. Yield is greatest near ½K; below ½K a harvest earns half and risks the population. Stale estimates risk overharvest. For studied species the tick on the slider marks the take that would bring the estimate to ½K.' }));
    const pops = w.countPops().count, KN = T.Knowledge;
    const game = w.species.filter(sp => pops[sp.idx] > 0 && !sp.grid && !sp.transient && sp.level !== 'decomposer' && KN.level(run, sp) >= 2 &&
      (sp.domestic || (sp.meta && sp.meta.massKg >= 1) || (!sp.meta && sp.stats.mass >= 2.5)));
    const tbl = el('table', { class: 'harvest' }, el('tr', null, el('th', { text: 'Species' }), el('th', { text: 'N (est.) · K' }), el('th', { text: 'Limit' })));
    for (const sp of game) {
      const prot = w.protected && w.protected.has(sp.id), est = KN.estimate(run, sp), studied = KN.level(run, sp) >= 3;
      // A slider from 0 to half the estimate; what the population would be after the take is marked against ½K.
      const max = Math.max(1, Math.round(est.N / 2)), cur = run.harvest[sp.id] || 0;
      const num = el('input', { type: 'number', min: 0, max, value: cur, disabled: prot, 'aria-label': 'Harvest limit for ' + sp.name, onchange: e => g.setHarvest(sp.id, +e.target.value) });
      const slider = el('input', { type: 'range', min: 0, max, step: 1, value: cur, disabled: prot, 'aria-label': 'Harvest limit slider for ' + sp.name,
        oninput: e => { num.value = e.target.value; }, onchange: e => g.setHarvest(sp.id, +e.target.value) });
      const halfK = studied && sp.K ? Math.round(sp.K / 2) : null;
      // The take that would bring the estimate down to ½K, marked on the slider's track.
      const toHalfK = halfK != null ? Math.max(0, Math.min(max, Math.round(est.N - halfK))) : null;
      const track = el('div', { class: 'hv-slider' }, slider);
      if (toHalfK != null) track.append(el('i', { class: 'halfk', title: 'Taking ' + toHalfK + ' brings the estimate to ½K (' + halfK + ')', style: { left: (100 * toHalfK / max) + '%' } }));
      tbl.append(el('tr', null, el('td', null, shapeIcon(sp.level, sp.hue), ' ' + sp.name + (sp.domestic ? ' (livestock)' : '') + (prot ? ' · protected' : '')),
        el('td', { class: 'mono' + (est.age > 2 ? ' stale' : ''), text: fmt(est.N) + '±' + fmt(est.err) + ' · ' + (studied && sp.K ? Math.round(sp.K) : '?') }), el('td', { class: 'hv-cell' }, track, num)));
    }
    box.append(game.length ? tbl : el('p', { class: 'caption', text: 'Survey a game species to set a harvest limit on it.' }));
    if (run.lastLog && run.lastLog.length) box.append(el('p', { class: 'caption', text: 'Last season: ' + run.lastLog.join('; ') }));
  }

  // During the season: the species that moved most, and what's being harvested.
  function renderWatch(box) {
    const g = G(), w = g.world, pops = w.countPops().count;
    const ra = g.chosen && St.RAPID.find(x => x.id === g.chosen);
    if (ra) {
      const card = el('div', { class: 'action-card card' }, el('div', { class: 'row between' }, el('b', { text: ra.name }), el('button', { class: 'linklike', text: 'cancel', onclick: () => g.chooseAction(null) })),
        el('p', { class: 'caption', text: ra.desc }), SU.effectRow(ra.id));
      if (ra.target === 'area') card.append(el('p', { class: 'note-teal', text: 'Click the map to survey there now.' }));
      else {
        const list = St.targets(w, ra), sel = el('select', { 'aria-label': 'Species' }, list.map(sp => el('option', { value: sp.id, text: sp.name })));
        card.append(list.length ? sel : el('p', { class: 'caption', text: 'No non-native species you know of.' }),
          el('button', { class: 'btn primary small', disabled: !list.length, text: 'Remove now · ' + ra.base + ' SP', onclick: () => g.rapid(ra.id, { species: sel.value }) }));
      }
      box.append(card);
    }
    // The watch list: species at risk (below ½K, below a minimum viable population, or crashing this season),
    // invasives and keystones, each with what the steward knows of it; then the rest of the biggest movers.
    const run = g.run, KN = T.Knowledge;
    const live = w.species.filter(sp => !sp.transient && UI.known(sp) && (w.rstats[sp.idx].startPop > 0 || pops[sp.idx] > 0));
    const f = sp => pops[sp.idx] / Math.max(1, w.rstats[sp.idx].startPop);
    const why = sp => {
      const n = pops[sp.idx], lv = KN.level(run, sp);
      if (n === 0) return 'unseen this season';
      if (f(sp) < 0.5) return 'crashing';
      if (n < St.mvp(sp)) return 'below a viable population';
      if (lv >= 3 && sp.K && n < 0.5 * sp.K) return 'below ½K';
      return null;
    };
    const status = sp => {
      const lv = KN.level(run, sp), e = lv >= 2 ? KN.estimate(run, sp) : null;
      return lv >= 3 ? 'studied' : lv === 2 ? 'surveyed' + (e && e.age ? ' ' + e.age + ' rd ago' : ' this round') : 'sighted';
    };
    const nonNative = sp => !sp.domestic && (sp.invasive || (sp.meta && sp.meta.native === false));
    const groups = [
      ['At risk', live.filter(sp => why(sp) && !nonNative(sp)), sp => why(sp)],
      ['Invasive', live.filter(nonNative), sp => (f(sp) > 1.2 ? 'spreading' : '')],
      ['Keystone', live.filter(sp => w.keystones && w.keystones[sp.id]), () => '★ tested'],
    ];
    const shown = new Set();
    box.append(el('h3', { class: 'h-serif', text: 'Watch list' }), el('p', { class: 'caption', text: 'Species you know, by what you can see of them this season, with what your surveys tell you.' }));
    const row = (sp, note, cls) => el('li', { class: cls || '' }, shapeIcon(sp.level, sp.hue), el('span', { class: 'nm', text: sp.name }),
      el('span', { class: 'val mono', text: KN.abundance(pops[sp.idx]) }), el('small', { text: [note, status(sp)].filter(Boolean).join(' · ') }));
    for (const [name, list, note] of groups) {
      if (!list.length) continue;
      const ul = el('ul', { class: 'watch' });
      for (const sp of list.slice(0, 8)) { shown.add(sp.id); ul.append(row(sp, note(sp), name === 'At risk' ? (pops[sp.idx] === 0 ? 'gone' : 'warn') : '')); }
      box.append(el('div', { class: 'eyebrow', text: name }), ul);
    }
    const movers = live.filter(sp => !shown.has(sp.id)).sort((a, b) => Math.abs(Math.log(f(b) + 0.05)) - Math.abs(Math.log(f(a) + 0.05))).slice(0, 6);
    if (movers.length) {
      const ul = el('ul', { class: 'watch' });
      for (const sp of movers) ul.append(row(sp, f(sp) > 1.5 ? 'more' : f(sp) < 0.8 ? 'fewer' : '', ''));
      box.append(el('div', { class: 'eyebrow', text: 'Moving most' }), ul);
    }
    const h = w.harvested || {};
    const taken = Object.keys(h).filter(k => h[k].n >= 1).map(k => Math.round(h[k].n) + ' ' + w.species[+k].name + (h[k].cause === 'controlled' ? ' removed' : ' harvested'));
    if (taken.length) box.append(el('p', { class: 'caption', text: 'So far: ' + taken.join(', ') + '.' }));
  }

  // ---------- action bar ----------

  UI.renderActionBar = function () {
    const g = G(), bar = $('action-bar');
    bar.innerHTML = '';
    if (g.state !== 'plan') {
      // The season: rapid responses only.
      const strip = el('div', { class: 'act-strip', role: 'toolbar', 'aria-label': 'Rapid responses' }, el('div', { class: 'eyebrow', text: 'Rapid responses' }));
      for (const a of St.RAPID) {
        const on = a.id === 'firecrew' && g.world.fireCrew;
        strip.append(el('button', { class: 'dir-btn act' + (g.chosen === a.id || on ? ' active' : ''), disabled: on, title: a.name + ': ' + a.desc,
          onclick: () => (a.target === 'none' ? g.rapid(a.id) : g.chooseAction(g.chosen === a.id ? null : a.id)) },
          el('span', { class: 'txt' }, el('b', { text: a.name }), el('small', { text: on ? 'on call' : a.target === 'area' ? 'from ' + Math.round(a.base * 1.5) + ' SP' : a.base + ' SP' }))));
      }
      bar.append(strip, el('span', { class: 'caption', text: 'The season runs on. Click any animal, group or tile to inspect it.' }));
      return;
    }
    // Actions scroll sideways; Start season stays in reach.
    const strip = el('div', { class: 'act-strip', role: 'toolbar', 'aria-label': 'Management actions' });
    for (const cat of ['Monitor', 'Habitat', 'Wildlife', 'Community']) {
      strip.append(el('div', { class: 'eyebrow', text: cat }));
      for (const a of St.ACTIONS.filter(x => x.cat === cat)) {
        strip.append(el('button', { class: 'dir-btn act' + (g.chosen === a.id ? ' active' : ''), title: a.name + ': ' + a.desc, onclick: () => g.chooseAction(g.chosen === a.id ? null : a.id) },
          el('span', { class: 'txt' }, el('b', { text: a.name }), el('small', { text: a.target === 'area' ? 'from ' + a.base + ' SP' : a.id === 'monitor' ? 'half cost/rd' : a.base + ' SP' + (a.standing ? '/rd' : '') }))));
      }
    }
    bar.append(strip, el('button', { class: 'btn accent start-season', onclick: () => g.startSeason() }, 'Start season ', el('span', { 'aria-hidden': 'true', text: '→' })));
  };
})(window.Trophic);
