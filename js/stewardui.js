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

  const ehiBars = ehi => el('div', { class: 'ehi-bars' }, ehi.components.map(c => el('div', { class: 'ehi-row', title: c.cause },
    el('span', { text: c.name }), el('div', { class: 'trk' }, el('i', { style: { width: (100 * c.points / c.weight) + '%' } })), el('b', { class: 'mono', text: c.points.toFixed(0) + '/' + c.weight }))));

  const goalList = (goals) => el('ul', { class: 'goal-list' }, goals.map(g => el('li', { class: g.met ? 'met' : '' }, el('span', { class: 'tick', text: g.met ? '✓' : '○' }), el('span', null, g.text, el('small', { text: g.now })))));

  // ---------- right panel ----------

  UI.renderStewardPanel = function () {
    const g = G(), w = g.world, run = g.run, box = $('steward-panel');
    if (!w || !run) return;
    const now = performance.now();
    if (g.state === 'simulate' && SU.panelAt && now - SU.panelAt < 1000) return;   // the season view refreshes once a second
    // In Plan, redraw only when something changed, so a harvest limit being typed isn't wiped out.
    const key = g.state + '|' + run.round + '|' + Math.round(run.sp) + '|' + g.chosen + '|' + run.queue.length + '|' + run.standing.length + '|' + JSON.stringify(run.harvest) + '|' + (run.ehiHistory.length);
    if (g.state === 'plan' && key === SU.planKey && box.children.length) return;
    SU.planKey = key;
    SU.panelAt = now;
    box.innerHTML = '';
    const ehiTxt = run.ehiHistory.length ? String(run.ehi.total) : '—';
    box.append(el('div', { class: 'sp-head' }, el('div', null, el('h3', { class: 'h-serif', text: g.state === 'plan' ? 'Plan · round ' + run.round : 'Season · round ' + run.round }),
      el('div', { class: 'caption', text: run.scenarioName || 'Sandbox: no goals, watch the EHI' }))));
    box.append(el('div', { class: 'stat-cards' },
      el('div', { class: 'stat' }, el('div', { class: 'eyebrow', text: 'Stewardship Points' }), el('div', { class: 'mono big', text: String(Math.round(run.sp)) }), el('div', { class: 'caption', text: run.queue.length ? run.queue.length + ' action' + (run.queue.length > 1 ? 's' : '') + ' queued' : 'fund your actions' })),
      el('div', { class: 'stat' }, el('div', { class: 'eyebrow', text: 'Ecosystem Health' }), el('div', { class: 'mono big', text: ehiTxt }), el('div', { class: 'caption', text: run.ehiHistory.length ? 'of 100 · last round' : 'after the first round' }))));
    if (run.ehiHistory.length) box.append(ehiBars(run.ehi));
    const goals = St.goals(w, run);
    if (goals.length) box.append(el('h3', { class: 'h-serif', text: 'Restoration goals' }), goalList(goals));
    if (g.state === 'plan') renderPlan(box);
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
        el('p', { class: 'caption', text: a.desc }), el('p', { class: 'caption', text: 'Teaches: ' + a.teach }));
      if (a.target === 'area') card.append(el('p', { class: 'note-teal', text: 'Click the map to place it (about ' + St.cost(w, a, { x: w.N / 2, y: w.N / 2, r: a.r }) + ' SP for a full circle; less at the edges and near water).' }));
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
        ul.append(el('li', { class: 'standing' }, el('span', { text: qa.name + ' · ' + (sp ? sp.name : '?') + ' (standing)' }), el('b', { class: 'mono', text: qa.base + '/round' }), el('button', { 'aria-label': 'Stop', html: '&times;', onclick: () => g.stopStanding(s) })));
      }
      box.append(ul);
    }
    // Harvest limits: a bag limit per round, against the species' carrying capacity.
    box.append(el('h3', { class: 'h-serif', text: 'Harvest limits' }), el('p', { class: 'caption', text: 'Bag limits per round. Yield is greatest near ½K; below ½K a harvest earns half and risks the population.' }));
    const pops = w.countPops().count;
    const game = w.species.filter(sp => pops[sp.idx] > 0 && !sp.grid && !sp.transient && sp.level !== 'decomposer' && (sp.domestic || (sp.meta && sp.meta.massKg >= 1) || (!sp.meta && sp.stats.mass >= 2.5)));
    const tbl = el('table', { class: 'harvest' }, el('tr', null, el('th', { text: 'Species' }), el('th', { text: 'N · K' }), el('th', { text: 'Limit' })));
    for (const sp of game) {
      const prot = w.protected && w.protected.has(sp.id);
      const inp = el('input', { type: 'number', min: 0, max: Math.max(1, Math.round((sp.K || pops[sp.idx]) / 2)), value: run.harvest[sp.id] || 0, disabled: prot, 'aria-label': 'Harvest limit for ' + sp.name,
        onchange: e => g.setHarvest(sp.id, +e.target.value) });
      tbl.append(el('tr', null, el('td', null, shapeIcon(sp.level, sp.hue), ' ' + sp.name + (sp.domestic ? ' (livestock)' : '') + (prot ? ' · protected' : '')),
        el('td', { class: 'mono', text: pops[sp.idx] + ' · ' + (sp.K ? Math.round(sp.K) : '—') }), el('td', null, inp)));
    }
    box.append(game.length ? tbl : el('p', { class: 'caption', text: 'No game species on the map.' }));
    if (run.lastLog && run.lastLog.length) box.append(el('p', { class: 'caption', text: 'Last season: ' + run.lastLog.join('; ') }));
  }

  // During the season: the species that moved most, and what's being harvested.
  function renderWatch(box) {
    const w = G().world, pops = w.countPops().count;
    const rows = w.species.filter(sp => !sp.transient && (w.rstats[sp.idx].startPop > 0 || pops[sp.idx] > 0))
      .map(sp => ({ sp, n: pops[sp.idx], f: pops[sp.idx] / Math.max(1, w.rstats[sp.idx].startPop) }))
      .sort((a, b) => Math.abs(Math.log((b.f + 0.05))) - Math.abs(Math.log((a.f + 0.05)))).slice(0, 10);
    box.append(el('h3', { class: 'h-serif', text: 'Watch list' }), el('p', { class: 'caption', text: 'The biggest movers since the season began.' }));
    const ul = el('ul', { class: 'watch' });
    for (const r of rows) {
      const cls = r.n === 0 ? 'gone' : r.f < 0.5 ? 'warn' : '';
      ul.append(el('li', { class: cls }, shapeIcon(r.sp.level, r.sp.hue), el('span', { class: 'nm', text: r.sp.name }),
        el('span', { class: 'val mono', text: fmt(r.n) }), el('small', { text: r.n === 0 ? 'gone' : (r.f >= 1 ? '+' : '') + Math.round((r.f - 1) * 100) + '%' })));
    }
    box.append(ul);
    const h = w.harvested || {};
    const taken = Object.keys(h).filter(k => h[k].n >= 1).map(k => Math.round(h[k].n) + ' ' + w.species[+k].name + (h[k].cause === 'controlled' ? ' removed' : ' harvested'));
    if (taken.length) box.append(el('p', { class: 'caption', text: 'So far: ' + taken.join(', ') + '.' }));
  }

  // ---------- action bar ----------

  UI.renderActionBar = function () {
    const g = G(), bar = $('action-bar');
    bar.innerHTML = '';
    if (g.state !== 'plan') {
      bar.append(el('div', { class: 'eyebrow', text: 'Season in progress' }), el('span', { class: 'caption', text: 'The community responds to this round’s actions. Click any animal, group or tile to inspect it.' }),
        el('div', { class: 'bar-spacer' }));
      return;
    }
    // Actions scroll sideways; Start season stays in reach.
    const strip = el('div', { class: 'act-strip', role: 'toolbar', 'aria-label': 'Management actions' });
    for (const cat of ['Habitat', 'Wildlife']) {
      strip.append(el('div', { class: 'eyebrow', text: cat }));
      for (const a of St.ACTIONS.filter(x => x.cat === cat)) {
        strip.append(el('button', { class: 'dir-btn act' + (g.chosen === a.id ? ' active' : ''), title: a.name + ': ' + a.desc, onclick: () => g.chooseAction(g.chosen === a.id ? null : a.id) },
          el('span', { class: 'txt' }, el('b', { text: a.name }), el('small', { text: a.target === 'area' ? 'from ' + a.base + ' SP' : a.base + ' SP' + (a.standing ? '/rd' : '') }))));
      }
    }
    bar.append(strip, el('button', { class: 'btn accent start-season', onclick: () => g.startSeason() }, 'Start season ', el('span', { 'aria-hidden': 'true', text: '→' })));
  };
})(window.Trophic);
