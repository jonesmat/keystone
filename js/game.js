// Keystone — controller: New world setup (rosters, catalogs and their stability tests), the steward's round loop
// (Plan → Season → Report), events, the end of a run, save/load and input.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE, St = T.Steward;
  // Saves from older versions of the game aren't migrated: they're recognised and refused.
  const SAVE_KEY = 'keystone.save', OLD_SAVE_KEYS = ['trophic.save.v2', 'trophic.save.v1'], SETTINGS_KEY = 'trophic.settings.v1';
  const $ = id => document.getElementById(id);
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function loadKey(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function removeKey(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  const randSeed = () => ((Math.random() * 99999) | 0) + 1;

  const G = (T.Game = {
    state: 'newworld', run: null, world: null, renderer: null,
    speed: 1, paused: false, acc: 0, last: 0, tickMs: 0,
    settings: { music: 0.35, sfx: 0.6, hints: true, debug: false },
    chosen: null, keys: {}, mouse: { x: 0, y: 0, inside: false }, menuOpen: false, overlayReturn: null,
  });
  const UI = () => T.UI, S = () => T.Screens;

  // ---------- boot ----------

  G.init = function () {
    const s = loadKey(SETTINGS_KEY);
    if (s) Object.assign(G.settings, s);
    if (/[?&]debug=1/.test(location.search)) G.settings.debug = true;
    G.renderer = new T.Renderer($('world'));
    G.setup = { mode: 'meadow', seed: randSeed(), biome: 'meadow', roster: T.Gen.meadowRoster(), stability: { state: 'idle' }, difficulty: 'standard' };
    T.UI.init(G);
    bindInput();
    window.addEventListener('resize', () => { if (G.state === 'simulate' || G.state === 'plan') { G.renderer.resize(); G.renderer.clampCam(); } });
    const unlock = () => { T.Audio.init(); T.Audio.setVolumes(G.settings.music, G.settings.sfx); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    G.showNewWorld();
    requestAnimationFrame(G.frame);
  };

  G.setSetting = function (k, v) {
    G.settings[k] = v;
    store(SETTINGS_KEY, G.settings);
    if (k === 'music' || k === 'sfx') T.Audio.setVolumes(G.settings.music, G.settings.sfx);
    if (k === 'debug' && G.world) G.world.debug = v;
    if (k === 'hints' && !v) UI().hideHint();
  };

  // ---------- New world ----------

  G.showNewWorld = function () {
    G.state = 'newworld';
    G.run = null;
    if (T.KeystoneRunner) T.KeystoneRunner.cancel();
    UI().show('newworld');
    G.renderNewWorld();
  };
  G.renderNewWorld = function () { S().renderNewWorld(storedSave()); };

  G.setMode = function (m) {
    G.setup.mode = m;
    if (m === 'catalog') {
      const idx = T.CATALOG_INDEX || [];
      if (!idx.length) { UI().toast('No ecoregion catalogs are built yet (tools/catalog/build.js).', 'bad'); G.setup.mode = 'meadow'; return; }
      if (!G.setup.ecoregion || !idx.some(e => e.code === G.setup.ecoregion)) G.setup.ecoregion = idx[0].code;
      if (G.setup.scenario === undefined) G.setup.scenario = (T.SCENARIOS.find(s => s.ecoregion === G.setup.ecoregion) || {}).id || null;
      G.regenerateCatalog();
    } else if (m === 'generated') G.regenerate();
    else if (m === 'channel') { G.cancelGen(); G.setup.roster = T.Gen.channelRoster(); G.setup.biome = 'channel'; G.setup.stability = { state: 'idle' }; }
    else { G.cancelGen(); G.setup.roster = T.Gen.meadowRoster(); G.setup.biome = 'meadow'; G.setup.stability = { state: 'idle' }; }
    G.renderNewWorld();
  };
  G.setSeed = function (seed) {
    G.setup.seed = seed || 1;
    if (G.setup.mode === 'generated') G.regenerate();
    else if (G.setup.mode === 'catalog') G.regenerateCatalog();
    G.renderNewWorld();
  };
  // A shared seed like "9.3-rewilding-48213" sets the ecoregion, scenario and seed at once.
  G.setSeedString = function (str) {
    const p = T.Catalog.parseSeed(str);
    if (!p) { G.setSeed(parseInt(str, 10) >>> 0); return; }
    if (!(T.CATALOG_INDEX || []).some(e => e.code === p.code)) { UI().toast('Ecoregion ' + p.code + ' isn\'t built in this copy of the game.', 'bad'); return; }
    Object.assign(G.setup, { mode: 'catalog', ecoregion: p.code, scenario: p.scenario, seed: p.seed });
    G.regenerateCatalog();
    G.renderNewWorld();
  };
  G.setEcoregion = function (code) {
    G.setup.ecoregion = code;
    G.setup.scenario = (T.SCENARIOS.find(s => s.ecoregion === code) || {}).id || null;
    G.regenerateCatalog();
    G.renderNewWorld();
  };
  G.setScenario = function (id) { G.setup.scenario = id || null; G.regenerateCatalog(); G.renderNewWorld(); };
  G.newSeed = function () { G.setSeed(randSeed()); };
  G.setBiome = function (b) { G.setup.biome = b; if (G.setup.mode === 'generated') G.regenerate(); G.renderNewWorld(); };
  G.setDifficulty = function (d) { G.setup.difficulty = d; G.renderNewWorld(); };
  G.setClimateTrend = function (on) { G.setup.climateTrend = !!on; };
  G.setPrimary = function (on) { G.setup.primary = !!on; };
  G.setChanging = function (on) { G.setup.changing = !!on; };
  G.setRealism = function (on) { G.setup.realism = !!on; };

  G.cancelGen = function () { G.genToken = (G.genToken || 0) + 1; };

  // Generate + stability-test rosters in small time slices so the page stays responsive.
  G.regenerate = function () {
    G.cancelGen();
    const token = G.genToken, st = G.setup;
    const biome = B.biomes[st.biome];
    let attempt = 1, test = null, roster = null, last = '';
    const startAttempt = () => {
      const sub = attempt === 1 ? st.seed : T.Gen.hashSeed(st.seed, attempt);
      roster = T.Gen.generateRoster(sub, biome.id);
      roster.subSeed = sub;
      test = new T.Gen.StabilityTest(roster, sub, biome);
      st.roster = roster;
    };
    startAttempt();
    st.stability = { state: 'running', attempt, progress: 0, round: 1 };
    let lastPaint = 0;
    const step = () => {
      if (token !== G.genToken) return;
      const done = test.step(40);
      st.stability.progress = test.progress();
      st.stability.round = test.round;
      if (done) {
        if (test.pass) { st.stability = { state: 'pass', attempt }; st.worldSeed = roster.subSeed; G.renderNewWorld(); return; }
        last = test.reason;
        if (++attempt > 20) { st.roster = T.Gen.meadowRoster(); st.stability = { state: 'fail', attempt: 20 }; G.renderNewWorld(); return; }
        startAttempt();
        st.stability = { state: 'running', attempt, progress: 0, round: 1, last };
        if (G.state === 'newworld') G.renderNewWorld();
      }
      const now = performance.now();
      if (now - lastPaint > 200) { lastPaint = now; if (G.state === 'newworld') S().renderStability(); }
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  };

  // Real ecoregion worlds: load the catalog, draw a cast for the scenario's niche slots, and stability-test it in
  // small slices, redrawing only the slots whose species failed (the same loop as T.Catalog.rosterStable).
  G.regenerateCatalog = function () {
    G.cancelGen();
    const token = G.genToken, st = G.setup;
    st.stability = { state: 'running', attempt: 1, progress: 0, round: 1, catalog: true };
    st.roster = { producers: [], species: [] };
    T.Catalog.load(st.ecoregion, cat => {
      if (token !== G.genToken) return;
      if (!cat) { st.stability = { state: 'fail', attempt: 0 }; G.renderNewWorld(); return; }
      const scenario = st.scenario ? T.scenarioById(st.scenario) : null;
      const slots = scenario ? scenario.slots : T.SANDBOX_SLOTS;
      const avoid = slots.map(() => new Set());
      const maxAttempts = 6;
      let attempt = 1, test = null, roster = null, last = '';
      const startAttempt = () => {
        roster = T.Catalog.roster(cat, scenario, st.seed + (attempt - 1) * 7919, avoid);
        test = new T.Gen.StabilityTest(roster, st.seed, roster.biome, 5);
        st.roster = roster;
      };
      startAttempt();
      let lastPaint = 0;
      const step = () => {
        if (token !== G.genToken) return;
        const done = test.step(40);
        st.stability.progress = test.progress();
        st.stability.round = test.round;
        if (done) {
          if (test.pass || attempt >= maxAttempts) {
            st.stability = { state: test.pass ? 'pass' : 'fail', attempt, catalog: true, last: test.reason };
            st.worldSeed = st.seed;
            G.renderNewWorld();
            return;
          }
          const failed = new Set(test.failedIds || []);
          roster.species.forEach(d => { if (failed.has(d.id)) { const k = slots.findIndex(sl => (sl.id || sl.role) === d.slot); if (k >= 0) avoid[k].add(d.catalogKey); } });
          last = test.reason;
          attempt++;
          startAttempt();
          st.stability = { state: 'running', attempt, progress: 0, round: 1, last, catalog: true };
          if (G.state === 'newworld') G.renderNewWorld();
        }
        const now = performance.now();
        if (now - lastPaint > 200) { lastPaint = now; if (G.state === 'newworld') S().renderStability(); }
        setTimeout(step, 0);
      };
      G.renderNewWorld();
      setTimeout(step, 0);
    });
  };

  G.worldName = function (st) {
    if (st.mode === 'catalog') { const sc = st.scenario ? T.scenarioById(st.scenario) : null; return (sc ? sc.name + ' · ' : 'Sandbox · ') + st.roster.biome.name; }
    return st.mode === 'generated' ? 'Generated · ' + B.biomes[st.biome].name : st.mode === 'channel' ? 'Open Channel' : 'Temperate Meadow';
  };

  G.beginRun = function () {
    const st = G.setup;
    if (st.stability.state === 'running') return;
    G.cancelGen();
    const seed = st.mode === 'generated' ? st.worldSeed || st.seed : st.seed;
    const scen = st.mode === 'catalog' && st.scenario ? T.scenarioById(st.scenario) : null;
    const biome = st.mode === 'catalog' ? st.roster.biome : B.biomes[st.mode === 'generated' ? st.biome : st.mode === 'channel' ? 'channel' : 'meadow'];
    const world = T.createWorld({ seed, roster: st.roster, biome, debug: G.settings.debug, mode: st.realism ? 'realism' : 'game',
      climateTrend: !!st.climateTrend || !!(scen && scen.climateTrend), primary: !!st.primary });
    G.world = world;
    G.renderer.fitted = false;
    const run = St.startRun(world, { scenario: scen ? scen.id : null, difficulty: st.difficulty, changing: st.changing !== false });
    Object.assign(run, {
      v: T.SAVE_VERSION, seed, mode: st.mode, biome: biome.id, ecoregion: st.mode === 'catalog' ? st.ecoregion : null,
      worldName: G.worldName(st), scenarioName: scen ? scen.name : null, seedString: st.mode === 'catalog' ? st.roster.seedString : null,
      activeEvents: [], pendingEvent: null, eventRolledRound: 0, eventThisRound: null, report: null,
      realism: !!st.realism, records: [],
    });
    if (run.realism) run.worldName += ' · Realism';
    G.run = run;
    G.enterPlan();
  };

  // ---------- Plan ----------

  G.enterPlan = function () {
    const run = G.run, w = G.world;
    G.state = 'plan';
    G.chosen = null;
    G.paused = true;
    if (run.eventRolledRound !== run.round) {
      run.eventRolledRound = run.round;
      run.pendingEvent = null;
      const blocking = run.activeEvents.some(a => a.left > 0 && (a.id === 'volcanic' || a.id === 'drought'));
      // Events with fictional species only come to the fictional worlds.
      const pool = T.EVENTS.filter(e => !(run.mode === 'catalog' && (e.id === 'invasive' || e.id === 'migration')));
      if (run.round >= B.eventStartRound && !blocking && w.rng.chance(B.eventChance)) run.pendingEvent = w.rng.pick(pool).id;
    }
    G.save();
    G.renderer.selected = null;
    G.renderer.brush = null;
    G.refreshMarks();
    UI().show('world');
    UI().renderActionBar();
    if (G.settings.hints && run.round === 1) UI().showHint('You are the steward. Pick an action below, click the map to place area actions, and set harvest limits on the right. Then start the season and watch the community respond.');
    else UI().hideHint();
    requestAnimationFrame(() => { G.renderer.resize(); if (!G.renderer.fitted) { G.renderer.fit(); G.renderer.fitted = true; } UI().updateHUD(); G.renderer.dirtyTiles = true; G.renderer.draw(w, 1, 0); });
  };

  G.chooseAction = function (id) {
    G.chosen = id;
    const a = id && St.actionById(id);
    G.renderer.brush = null;
    $('world').classList.toggle('placing', !!(a && a.target === 'area'));
    UI().renderActionBar();
    T.UI.renderStewardPanel();
  };

  // Place an area action where the steward clicked.
  G.placeAt = function (tx, ty) {
    const a = St.actionById(G.chosen);
    if (!a || a.target !== 'area') return;
    if (a.cat === 'Rapid') return G.rapid(a.id, { x: tx, y: ty, r: a.r });
    const res = St.queue(G.world, G.run, { id: a.id, x: tx, y: ty, r: a.r });
    if (!res.ok) { UI().toast(res.why, 'bad'); return; }
    T.Audio.cue('buy');
    UI().toast(a.name + ' queued · ' + res.cost + ' SP');
    G.refreshMarks();
    UI().updateHUD();
  };
  // Rapid responses act at once, mid-season.
  G.rapid = function (id, q) {
    const res = St.rapid(G.world, G.run, Object.assign({ id }, q || {}));
    if (!res.ok) { UI().toast(res.why, 'bad'); return; }
    T.Audio.cue('buy');
    UI().toast(St.actionById(id).name + ': ' + res.text + ' · ' + res.cost + ' SP');
    G.chosen = null;
    $('world').classList.remove('placing');
    G.renderer.brush = null;
    UI().renderActionBar();
    T.UI.renderStewardPanel(true);
    UI().updateHUD();
  };
  G.queueSpecies = function (id, spId) {
    const res = St.queue(G.world, G.run, { id, species: spId });
    if (!res.ok) { UI().toast(res.why, 'bad'); return; }
    T.Audio.cue('buy');
    G.chosen = null;
    UI().renderActionBar();
    UI().updateHUD();
  };
  G.unqueue = function (k) { St.unqueue(G.run, k); G.refreshMarks(); UI().updateHUD(); };
  G.stopStanding = function (s) {
    const run = G.run;
    run.standing.splice(run.standing.indexOf(s), 1);
    if (s.id === 'protect') G.world.protected.delete(s.species);
    UI().updateHUD();
  };
  G.setHarvest = function (spId, n) {
    const sp = G.world.speciesById(spId);
    const est = T.Knowledge.estimate(G.run, sp);
    const max = Math.max(1, Math.round((est ? est.N : 0) / 2));
    G.run.harvest[spId] = Math.max(0, Math.min(max, Math.round(n || 0)));
    UI().updateHUD();
  };

  // The community: answer a stakeholder's ask, or bid for an easement on land for sale.
  G.answerAsk = function (k, accept) { T.Stakeholders.answer(G.run, k, accept); UI().updateHUD(); T.UI.renderStewardPanel(); };
  G.bidSale = function () {
    const sale = G.run.stake.sale;
    if (!sale) return;
    if (!T.Stakeholders.bid(G.world, G.run)) { UI().toast('Needs ' + sale.price + ' SP', 'bad'); return; }
    T.Audio.cue('buy');
    UI().toast('Conservation easement bought: the land is yours to manage');
    G.renderer.dirtyTiles = true;
    UI().updateHUD(); T.UI.renderStewardPanel();
  };

  G.refreshMarks = function () {
    const COL = { Habitat: 'rgba(94,158,69,0.95)', Wildlife: 'rgba(29,101,112,0.95)', Community: 'rgba(160,110,40,0.95)' };
    G.renderer.planMarks = G.run.queue.filter(q => q.x != null).map(q => { const a = St.actionById(q.id); return { x: q.x, y: q.y, r: q.r || a.r, color: COL[a.cat], label: a.name }; });
  };

  // ---------- Season ----------

  G.startSeason = function () {
    const run = G.run, w = G.world;
    w.beginRound(run.round);
    St.startSeason(w, run);   // after the round starts, so releases count as immigration (I) this round
    G.seenDisturb = w.disturbLog ? w.disturbLog.length : 0;
    run.eventThisRound = null;
    if (run.pendingEvent) { G.applyEvent(run.pendingEvent); run.eventThisRound = { id: run.pendingEvent }; run.pendingEvent = null; }
    G.applyEventMods();
    G.state = 'simulate';
    G.chosen = null;
    $('world').classList.remove('placing');
    G.renderer.planMarks = [];
    G.renderer.brush = null;
    G.acc = 0;
    G.paused = false;
    if (!G.speed) G.speed = 1;
    G.renderer.dirtyTiles = true;
    G.lastPops = w.countPops().count;
    UI().hideHint();
    UI().renderActionBar();
    if (run.lastLog.length) UI().toast(run.lastLog.join(' · '));
    UI().updateHUD();
  };

  // ---------- events ----------

  G.applyEvent = function (id) {
    const w = G.world, run = G.run;
    const ev = T.EVENTS.find(e => e.id === id);
    switch (id) {
      case 'drought': case 'bloom': run.activeEvents.push({ id, left: 1 }); break;
      case 'volcanic': run.activeEvents.push({ id, left: 2 }); break;
      case 'invasive': w.importSpecies(T.EVENT_SPECIES.marauder, T.EVENT_SPECIES.marauder.startPop, w.rng.pick([[4, 4], [60, 4], [4, 60], [60, 60]])); break;
      case 'plague': { const r = w.plague(); if (r) UI().toast('Plague: ' + r.species.name + ' lost ' + r.killed + ' individuals.', 'bad'); break; }
      case 'wildfire': { const r = w.wildfire(); UI().toast('Wildfire burned ' + r.tiles + ' tiles. They regrow from the seed bank.', 'bad'); break; }
      case 'flood': { const r = w.flood(); UI().toast('Flood: ' + r.tiles + ' low tiles under water.', 'bad'); break; }
      case 'windthrow': { const r = w.windthrow(); UI().toast('Windstorm: ' + r.tiles + ' shrub and woodland tiles felled, opening light gaps.', 'bad'); break; }
      case 'migration':
        w.importSpecies(T.EVENT_SPECIES.wanderbuck, T.EVENT_SPECIES.wanderbuck.startPop, [2, 10 + w.rng.int(44)], { energy: 0.7 });
        run.activeEvents.push({ id, left: 1 });
        break;
    }
    UI().toast('Event: ' + ev.name + ' — ' + ev.effect);
  };
  G.applyEventMods = function () {
    const w = G.world, act = G.run.activeEvents.filter(a => a.left > 0).map(a => a.id);
    w.eventLight = (act.includes('drought') ? 0.7 : 1) * (act.includes('volcanic') ? 0.5 : 1);
    w.growthMod = act.includes('bloom') ? 1.5 : 1;
    w.rainMod = act.includes('drought') ? 0.3 : 1;
    w.ectoSlowAll = act.includes('volcanic');
  };

  G.setSpeed = function (s) {
    if (G.state !== 'simulate') return;
    if (s === 0) { G.paused = !G.paused; if (!G.paused && !G.speed) G.speed = 1; }
    else { G.speed = s; G.paused = false; }
    T.Audio.cue('click');
    UI().updateHUD();
  };

  G.frame = function (now) {
    requestAnimationFrame(G.frame);
    const dt = Math.min(0.1, (now - (G.last || now)) / 1000);
    G.last = now;
    if ((G.state !== 'simulate' && G.state !== 'plan') || !G.world) return;
    const w = G.world;
    panKeys(dt);
    if (G.state === 'simulate' && !G.paused && !G.menuOpen) {
      G.acc += dt * B.ticksPerSecond * G.speed;
      let n = 0;
      const t0 = performance.now();
      while (G.acc >= 1 && n < 24) {
        w.tick();
        G.acc -= 1; n++;
        if (w.roundTick % 10 === 0) G.watchPops();
        if (w.roundOver()) break;
      }
      if (n) G.tickMs = G.tickMs * 0.9 + ((performance.now() - t0) / n) * 0.1;
      if (G.acc > 24) G.acc = 0;
      if (w.roundOver()) { G.renderer.consumeEvents(w); G.endRound(); return; }
    }
    for (const ev of w.events) if (ev.type === 'kill') T.Audio.cue('kill');
    G.renderer.consumeEvents(w);
    // The brush follows the pointer while placing an area action.
    // Wildfire alerts: a fire that started this frame.
    if (G.state === 'simulate' && w.disturbLog && w.disturbLog.length > (G.seenDisturb || 0)) {
      for (const d of w.disturbLog.slice(G.seenDisturb || 0)) if (d.type === 'wildfire' && d.tiles) UI().toast('Wildfire: ' + d.tiles + ' tiles burned' + (d.contained ? ', held by the fire crew' : ''), d.contained ? '' : 'bad');
      G.seenDisturb = w.disturbLog.length;
    }
    const a = (G.state === 'plan' || G.state === 'simulate') && G.chosen && St.actionById(G.chosen);
    if (a && a.target === 'area' && G.mouse.inside) {
      const [wx, wy] = G.renderer.screenToWorld(G.mouse.x, G.mouse.y);
      G.renderer.brush = { x: wx / B.tilePx, y: wy / B.tilePx, r: a.r, color: 'rgba(31,42,36,0.9)', fill: 'rgba(245,197,66,0.18)', label: a.name + ' · ' + St.cost(w, a, { x: wx / B.tilePx, y: wy / B.tilePx, r: a.r }) + ' SP' };
    } else G.renderer.brush = null;
    G.renderer.draw(w, G.paused ? 1 : Math.min(1, G.acc), G.paused ? 0 : dt);
    if (!G.hudT || now - G.hudT > 250) {
      G.hudT = now;
      UI().updateHUD();
      UI().renderInspector();
      T.Audio.setSeason(w.seasonIdx);
    }
  };

  G.watchPops = function () {
    const w = G.world, pops = w.countPops().count, prev = G.lastPops || pops;
    w.species.forEach((sp, i) => {
      if (prev[i] > 0 && pops[i] === 0 && !sp.transient && T.UI.known(sp)) UI().toast(T.UI.plural(sp.name) + ' may have died out here.', 'bad');
    });
    G.lastPops = pops;
  };

  // ---------- Report ----------

  G.endRound = function () {
    const w = G.world, run = G.run;
    G.state = 'report';
    for (const e of w.ents) if (e.alive && e.sp.transient) { w.ledger.exported += e.E + e.tissue + e.para; w.nledger.exported += e.nT + e.nS; e.E = 0; e.tissue = 0; e.para = 0; e.nT = 0; e.nS = 0; e.alive = false; }
    w.ents = w.ents.filter(e => e.alive);
    w.updateMeans();
    w._demographyRoundEnd();
    const inter = w._interactionsRoundEnd();
    run.extinct = run.extinct || [];
    const res = St.endRound(w, run);
    const pops = w.countPops().count;
    // The biggest movers for the population chart.
    const known = sp => T.Knowledge.known(run, sp);
    const lines = w.species.filter(sp => !sp.transient && w.rstats[sp.idx].startPop > 0 && known(sp))
      .map(sp => ({ idx: sp.idx, name: sp.name, level: sp.level, hue: sp.hue, start: w.rstats[sp.idx].startPop, end: pops[sp.idx] }))
      .sort((a, b) => Math.abs(Math.log((b.end + 1) / (b.start + 1))) - Math.abs(Math.log((a.end + 1) / (a.start + 1)))).slice(0, 6);
    const ks = { running: true, total: 0, done: [] };
    // The report shows only what the steward knows: no undiscovered species by name.
    const hidden = w.species.filter(sp => !known(sp)).map(sp => sp.name);
    const mentionsHidden = t => hidden.some(n => t.includes(n));
    if (inter) inter.items = inter.items.filter(it => !mentionsHidden(it.text));
    const report = run.report = {
      view: res.view, discovered: res.discovered, community: res.community, mandate: res.mandate, stake: JSON.parse(JSON.stringify(run.stake.list)),
      round: run.round, ehi: res.ehi, deltas: res.deltas, goals: res.goals, income: res.income, parts: res.parts, outcome: res.outcome, gone: res.gone.filter(n => !hidden.includes(n)),
      interactions: inter ? JSON.parse(JSON.stringify(inter)) : null, keystone: ks, notes: w.notes.splice(0).filter(n => !mentionsHidden(n)),
      demography: JSON.parse(JSON.stringify(w.demography || [])), energy: SU().combinedStats(w), measure: T.Energy.measure(w), lines,
      history: { t: w.history.t.slice(), pops: w.history.pops.map(r => r.slice()) },
    };
    // What the CSV export reports for this round: efficiencies, the chain, the three pyramids, and demography for the
    // species the steward knows (estimates only where they haven't studied a species).
    (run.records || (run.records = [])).push(G.roundRecord(w, run, report));
    // Keystone tests fork the world and report during the next season.
    if (T.KeystoneRunner && !res.outcome) {
      const round = run.round;
      T.KeystoneRunner.start(w, (r, job) => {
        ks.total = job.items.length; ks.done.push(r);
        ks.running = job.done.length < job.items.length;
        T.keystoneRecord(G.world, r, round);
        // Each species' test history, for its Codex entry.
        const kh = G.run.ksHistory || (G.run.ksHistory = {});
        for (const id of r.ids) (kh[id] || (kh[id] = [])).push({ round, drop: +r.drop.toFixed(3), keystone: !!r.keystone });
        if (r.keystone && r.ids.some(id => { const sp = G.world.speciesById(id); return sp && T.Knowledge.known(G.run, sp); })) UI().toast('Keystone found: ' + r.name + '. Without it, diversity dropped ' + Math.round(r.drop * 100) + '%.', 'good');
        if (G.state === 'report' && G.run.report === report) S().renderInteractions(report);
      });
      ks.total = T.KeystoneRunner.job ? T.KeystoneRunner.job.items.length : 0;
    }
    for (const a of run.activeEvents) a.left--;
    run.activeEvents = run.activeEvents.filter(a => a.left > 0);
    if (res.gone.length) T.Audio.cue('extinct');
    UI().show('report');
    requestAnimationFrame(() => S().renderReport(report));
  };
  const SU = () => T.StewardUI;

  G.continueFromReport = function () {
    const run = G.run;
    if (run.outcome) { G.showEnd(); return; }
    run.round++;
    G.world.round = run.round;
    G.world.rebuildDiet();
    G.enterPlan();
  };

  G.roundRecord = function (w, run, rep) {
    const m = rep.measure, pyr = T.Energy.pyramids(w, UI().hiddenSpecies ? UI().hiddenSpecies() : null), KN = T.Knowledge;
    const r4 = v => (v == null ? null : +(+v).toFixed(4));
    const L = m.levels, prim = ['herbivore', 'omnivore'], pred = ['carnivore1', 'carnivore2'];
    const sum = (ls, k) => ls.reduce((a, l) => a + L[l][k], 0);
    const demog = [];
    for (const d of rep.demography) {
      const sp = w.speciesById(d.id);
      if (!sp || !KN.known(run, sp)) continue;
      const lv = KN.level(run, sp), est = KN.estimate(run, sp);
      demog.push(lv >= 3 ? { species: d.name, sci: (sp.meta && sp.meta.sci) || '', level: d.level, knowledge: 'studied', N0: d.N0, B: d.B, I: d.I, D: d.D, E: d.E, N1: d.N1, r: d.r, K: d.K ? Math.round(d.K) : null, curve: d.curve }
        : { species: d.name, sci: (sp.meta && sp.meta.sci) || '', level: d.level, knowledge: lv >= 2 ? 'surveyed' : 'sighted', N1: lv >= 2 && est ? Math.round(est.N) + ' ± ' + Math.round(est.err) : T.Knowledge.abundance(d.N1) });
    }
    return {
      round: rep.round, mode: m.mode, ehiLow: rep.view.lo, ehiHigh: rep.view.hi,
      eff: Object.fromEntries(Object.entries(m.eff).map(([k, v]) => [k, r4(v)])),
      chain: { gpp: m.producers.gpp, npp: m.producers.npp, herbIngested: sum(prim, 'ingested'), herbGSP: sum(prim, 'assimilated'), herbNSP: sum(prim, 'nsp'),
        carnIngested: sum(pred, 'ingested'), carnGSP: sum(pred, 'assimilated'), carnNSP: sum(pred, 'nsp') },
      pyramids: pyr.levels.map((lv, k) => ({ level: lv.name, individuals: Math.round(pyr.numbers[k]), biomass: r4(pyr.biomass[k]), energy: Math.round(pyr.energy[k]) })),
      demography: demog,
    };
  };

  // CSV files for a lab write-up: every round so far, one table per file.
  G.exportCSV = function (kind) {
    const run = G.run, recs = run.records || [];
    if (!recs.length) { UI().toast('Nothing to export until a round has finished', 'bad'); return; }
    const q = v => (v == null ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
    const rows = [];
    if (kind === 'efficiencies') {
      const keys = Object.keys(recs[0].eff), ck = Object.keys(recs[0].chain);
      rows.push(['round', 'mode', 'ehi_low', 'ehi_high'].concat(ck.map(k => k + '_EU'), keys));
      for (const r of recs) rows.push([r.round, r.mode, r.ehiLow, r.ehiHigh].concat(ck.map(k => Math.round(r.chain[k])), keys.map(k => r.eff[k])));
    } else if (kind === 'pyramids') {
      rows.push(['round', 'level', 'individuals', 'biomass_g_per_m2', 'energy_EU_fixed']);
      for (const r of recs) for (const p of r.pyramids) rows.push([r.round, p.level, p.individuals, p.biomass, p.energy]);
    } else {
      rows.push(['round', 'species', 'scientific_name', 'level', 'knowledge', 'N0', 'B', 'I', 'D', 'E', 'N1', 'r_percent', 'K', 'curve']);
      for (const r of recs) for (const d of r.demography) rows.push([r.round, d.species, d.sci, d.level, d.knowledge, d.N0, d.B, d.I, d.D, d.E, d.N1, d.r == null ? null : Math.round(d.r), d.K, d.curve]);
    }
    const csv = rows.map(r => r.map(q).join(',')).join('\n') + '\n';
    const name = (run.worldName || 'keystone').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + kind + '.csv';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  G.showEnd = function () {
    const run = G.run, o = run.outcome, sc = St.score(run), diff = B.difficulties[run.difficulty];
    if (T.KeystoneRunner) T.KeystoneRunner.cancel();
    S().renderEnd({ round: run.round, difficulty: diff.name + (run.realism ? ' · Realism' : ''), title: o.win ? 'Restored' : o.kind === 'collapse' ? 'Collapse' : o.kind === 'mandate' ? 'Replaced' : 'Out of time',
      sub: o.headline + ' The true Ecosystem Health Index, round by round: ' + run.ehiHistory.join(', ') + '.', score: sc.total, rows: sc.rows });
    removeKey(SAVE_KEY);
    G.state = 'end';
    UI().show('end');
  };

  // ---------- overlays ----------

  G.openOverlay = function (name, id) {
    if (!G.run) return;
    if (G.state !== 'codex') G.overlayReturn = G.state;
    G.state = name;
    UI().show(name);
    S().renderCodex(id);
  };
  G.closeOverlay = function () {
    const back = G.overlayReturn || 'plan';
    G.state = back;
    if (back === 'report') { UI().show('report'); S().renderReport(G.run.report); }
    else if (back === 'end') UI().show('end');
    else { UI().show('world'); UI().renderActionBar(); requestAnimationFrame(() => { G.renderer.resize(); UI().updateHUD(); }); }
  };

  // ---------- save / load ----------

  // The run in storage: the current save, or { old: true } when only an older version's save is there.
  function storedSave() {
    const data = loadKey(SAVE_KEY);
    if (data) return data.v === T.SAVE_VERSION ? data : { old: true };
    return OLD_SAVE_KEYS.some(k => loadKey(k)) ? { old: true } : null;
  }
  const OLD_SAVE = 'This save is from an older version of Keystone and cannot be loaded. Start a new world.';

  G.saveData = function () {
    const run = Object.assign({}, G.run, { report: null });
    return { v: T.SAVE_VERSION, savedAt: Date.now(), run, world: G.world.serialize() };
  };
  G.save = function () {
    if (!G.run || !G.world) return;
    if (!store(SAVE_KEY, G.saveData())) UI().toast('Autosave failed (browser storage full or unavailable). Export your save from the menu.', 'bad');
    else for (const k of OLD_SAVE_KEYS) removeKey(k);   // a new run replaces an old version's save
  };
  G.continueRun = function () {
    const data = storedSave();
    if (!data) { UI().toast('No saved run found.', 'bad'); return; }
    G.loadData(data);
  };

  G.loadData = function (data) {
    try {
      if (data && (data.old || (data.v != null && data.v !== T.SAVE_VERSION))) { UI().toast(OLD_SAVE, 'bad'); return; }
      if (!data || !data.world || !data.run) throw new Error('Not a Keystone save file');
      G.cancelGen();
      const w = T.loadWorld(data.world, { debug: G.settings.debug });
      G.world = w;
      G.run = data.run;
      w.run = G.run;
      w.round = G.run.round;
      w.rebuildDiet();
      G.enterPlan();
      UI().toast('Save loaded: round ' + G.run.round, 'good');
    } catch (e) {
      console.error(e);
      UI().toast('Could not load save: ' + e.message, 'bad');
    }
  };
  G.exportSave = function () {
    if (!G.run || !G.world) { UI().toast('No run in progress to export.'); return; }
    const data = loadKey(SAVE_KEY) || G.saveData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'keystone-' + (G.run.worldName || 'run').replace(/\W+/g, '-').toLowerCase() + '-round-' + data.run.round + '.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  G.importSave = function (txt) {
    let data;
    try { data = JSON.parse(txt); } catch (e) { UI().toast('That file is not valid JSON.', 'bad'); return; }
    G.closeMenu();
    G.loadData(data);
  };

  // ---------- menu ----------

  G.openMenu = function () {
    G.menuOpen = true;
    $('modal-menu').hidden = false;
    $('menu-title').textContent = G.state === 'simulate' ? 'Paused' : 'Menu';
    $('menu-export').disabled = !G.run;
    $('menu-quit').hidden = G.state === 'newworld';
    // Credits for the real-species data: every source behind the catalogs this copy of the game carries.
    const idx = T.CATALOG_INDEX || [];
    const cat = G.run && G.run.ecoregion && T.CATALOGS && T.CATALOGS[G.run.ecoregion];
    const box = $('credits-body');
    box.replaceChildren();
    if (!idx.length) box.append(document.createTextNode('This copy of the game has no real-species catalogs.'));
    else {
      box.append(document.createTextNode('Real-species catalogs for ' + idx.length + ' EPA Level II ecoregion' + (idx.length > 1 ? 's' : '') + ', built from:'));
      const ul = document.createElement('ul');
      const src = (cat || {}).sources || ['U.S. EPA Level III ecoregions (2011), grouped by CEC Level II', 'GBIF.org occurrence records and Backbone Taxonomy, with IUCN Red List categories',
        'GRIIS United States (Contiguous) ver. 2.0, 2022', 'EltonTraits 1.0 (Wilman et al. 2014), CC0', 'USDA NRCS PLANTS Database', 'Open-Meteo historical weather (ERA5), CC BY 4.0'];
      for (const s of src) { const li = document.createElement('li'); li.textContent = s; ul.append(li); }
      box.append(ul, document.createTextNode('Traits are real; behaviour in the simulation is simplified.'));
    }
    $('menu-resume').focus();
  };
  G.closeMenu = function () { G.menuOpen = false; $('modal-menu').hidden = true; };

  // ---------- input ----------

  function panKeys(dt) {
    const k = G.keys, r = G.renderer;
    const v = (600 * dt) / r.cam.zoom;
    let moved = false;
    if (k.w || k.arrowup) { r.cam.y -= v; moved = true; }
    if (k.s || k.arrowdown) { r.cam.y += v; moved = true; }
    if (k.a || k.arrowleft) { r.cam.x -= v; moved = true; }
    if (k.d || k.arrowright) { r.cam.x += v; moved = true; }
    if (moved) r.clampCam();
  }

  function bindInput() {
    const cv = $('world');
    const ptrs = new Map();
    let drag = null, pinch = null;
    const onMap = () => G.state === 'simulate' || G.state === 'plan';
    const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const placing = () => (G.state === 'plan' || G.state === 'simulate') && G.chosen && St.actionById(G.chosen).target === 'area';
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      if (!onMap()) return;
      cv.setPointerCapture(e.pointerId);
      const [x, y] = local(e);
      ptrs.set(e.pointerId, { x, y });
      if (e.button === 2) { if (placing()) G.chooseAction(null); return; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; drag = null; return; }
      drag = { x, y, cx: G.renderer.cam.x, cy: G.renderer.cam.y, moved: false };
    });
    cv.addEventListener('pointermove', e => {
      const [x, y] = local(e);
      G.mouse.x = x; G.mouse.y = y; G.mouse.inside = true;
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x, y });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        G.renderer.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d);
        pinch.d = d;
        return;
      }
      if (drag) {
        const dx = x - drag.x, dy = y - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; cv.classList.add('dragging'); }
        if (drag.moved) { G.renderer.cam.x = drag.cx - dx / G.renderer.cam.zoom; G.renderer.cam.y = drag.cy - dy / G.renderer.cam.zoom; G.renderer.clampCam(); }
      }
    });
    const up = e => {
      ptrs.delete(e.pointerId);
      cv.classList.remove('dragging');
      if (ptrs.size < 2) pinch = null;
      if (drag && !drag.moved && e.button !== 2 && onMap()) {
        const [x, y] = local(e);
        const [wx, wy] = G.renderer.screenToWorld(x, y);
        if (placing()) G.placeAt(wx / B.tilePx, wy / B.tilePx);
        else {
          const hit = G.renderer.pick(G.world, x, y);
          G.renderer.selected = hit;
          if (hit && hit.ent) T.Audio.cue('call', hit.ent.st.mass);
          UI().renderInspector();
        }
      }
      drag = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { G.mouse.inside = false; });
    cv.addEventListener('wheel', e => {
      if (!onMap()) return;
      e.preventDefault();
      const [x, y] = local(e);
      G.renderer.zoomAt(x, y, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (G.menuOpen) G.closeMenu();
        else if (G.state === 'codex') G.closeOverlay();
        else if (G.chosen) G.chooseAction(null);
        else if (onMap() && G.renderer.selected) { G.renderer.selected = null; UI().renderInspector(); }
        else G.openMenu();
        return;
      }
      if (!onMap() || G.menuOpen) return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { G.keys[k] = true; e.preventDefault(); return; }
      if (k === ' ') { e.preventDefault(); G.setSpeed(0); return; }
      if (k === '+' || k === '=') { G.setSpeed(G.paused ? G.speed || 1 : Math.min(4, (G.speed || 1) * 2)); return; }
      if (k === '-' || k === '_') { if (G.speed <= 1) G.setSpeed(0); else G.setSpeed(G.speed / 2); }
    });
    window.addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { G.keys = {}; });
  }

  window.addEventListener('DOMContentLoaded', G.init);
})(window.Trophic);
