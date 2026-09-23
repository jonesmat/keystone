// Trophic — Phase 2 controller: New world setup (generated rosters + stability test), the round loop
// (Evolve → Simulate → Selection report), breeding orders, speciation choices, phylogeny records,
// victory/defeat, events, save/load (v2 with v1 migration) and input.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const SAVE_KEY = 'trophic.save.v2', OLD_SAVE_KEY = 'trophic.save.v1', SETTINGS_KEY = 'trophic.settings.v1';
  const clone = o => JSON.parse(JSON.stringify(o));
  const $ = id => document.getElementById(id);
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function loadKey(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function removeKey(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  const randSeed = () => ((Math.random() * 99999) | 0) + 1;

  const G = (T.Game = {
    state: 'newworld', run: null, world: null, renderer: null,
    speed: 1, paused: false, acc: 0, last: 0, tickMs: 0,
    settings: { music: 0.35, sfx: 0.6, hints: true, debug: false },
    placing: false, keys: {}, mouse: { x: 0, y: 0, inside: false }, menuOpen: false, overlayReturn: null,
  });
  const UI = () => T.UI, S = () => T.Screens;

  // ---------- boot ----------

  G.init = function () {
    const s = loadKey(SETTINGS_KEY);
    if (s) Object.assign(G.settings, s);
    if (/[?&]debug=1/.test(location.search)) G.settings.debug = true;
    G.renderer = new T.Renderer($('world'));
    G.setup = {
      mode: 'meadow', seed: randSeed(), biome: 'meadow', roster: T.Gen.meadowRoster(), stability: { state: 'idle' },
      ftab: 'templates', templateId: 'grazer', archetypeId: 'pack-hunter', rollSeed: randSeed(), rerolls: 0, rolled: null,
      customLevel: 'herbivore', difficulty: 'standard',
    };
    T.UI.init(G);
    bindInput();
    window.addEventListener('resize', () => { if (G.state === 'simulate') { G.renderer.resize(); G.renderer.clampCam(); } });
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
    UI().show('newworld');
    G.renderNewWorld();
  };
  G.renderNewWorld = function () {
    const v2 = loadKey(SAVE_KEY), v1 = loadKey(OLD_SAVE_KEY);
    S().renderNewWorld(v2 && (!v1 || v2.savedAt >= (v1.savedAt || 0)) ? v2 : v1 || v2);
  };

  G.setMode = function (m) {
    if (m === 'sandbox') return;
    G.setup.mode = m;
    if (m === 'generated') G.regenerate();
    else { G.cancelGen(); G.setup.roster = T.Gen.meadowRoster(); G.setup.biome = 'meadow'; G.setup.stability = { state: 'idle' }; }
    G.renderNewWorld();
  };
  G.setSeed = function (seed) {
    G.setup.seed = seed || 1;
    if (G.setup.mode === 'generated') G.regenerate();
    G.renderNewWorld();
  };
  G.newSeed = function () { G.setSeed(randSeed()); };
  G.setBiome = function (b) { G.setup.biome = b; if (G.setup.mode === 'generated') G.regenerate(); G.renderNewWorld(); };
  G.setDifficulty = function (d) { G.setup.difficulty = d; G.renderNewWorld(); };

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

  G.setFounderTab = function (t) {
    G.setup.ftab = t;
    if (t === 'roll' && !G.setup.rolled) G.setup.rolled = T.Gen.rollFounder(G.setup.archetypeId, G.setup.rollSeed);
    G.renderNewWorld();
  };
  G.selectTemplate = function (id) { G.setup.templateId = id; G.setup.ftab = 'templates'; G.renderNewWorld(); };
  G.selectArchetype = function (id) { G.setup.archetypeId = id; G.setup.rolled = T.Gen.rollFounder(id, G.setup.rollSeed); G.renderNewWorld(); };
  G.selectCustomLevel = function (lv) { G.setup.customLevel = lv; G.renderNewWorld(); };
  G.rerollFounder = function () {
    const st = G.setup;
    if (st.rerolls >= 3) return;
    st.rerolls++;
    st.rollSeed = T.Gen.hashSeed(st.rollSeed, st.rerolls + 7);
    st.rolled = T.Gen.rollFounder(st.archetypeId, st.rollSeed);
    T.Audio.cue('click');
    G.renderNewWorld();
  };

  G.currentFounder = function () {
    const st = G.setup;
    if (st.ftab === 'roll') return st.rolled || (st.rolled = T.Gen.rollFounder(st.archetypeId, st.rollSeed));
    if (st.ftab === 'custom') {
      const d = T.Gen.customFounder(st.customLevel);
      d.name = { herbivore: 'Meadowlings', omnivore: 'Mixlings', carnivore1: 'Duskrunners', carnivore2: 'Gravemaws' }[st.customLevel];
      return d;
    }
    return T.Gen.templateFounder(T.TEMPLATES.find(t => t.id === st.templateId));
  };

  G.beginRun = function () {
    const st = G.setup;
    G.cancelGen();
    const diff = B.difficulties[st.difficulty];
    const founder = clone(Object.assign({}, G.currentFounder(), { genome: null }));
    founder.genome = new Float32Array(G.currentFounder().genome);
    const seed = st.mode === 'generated' ? st.worldSeed || st.seed : st.seed;
    const biome = B.biomes[st.mode === 'generated' ? st.biome : 'meadow'];
    const world = T.createWorld({ seed, roster: st.roster, player: founder, biome, difficulty: diff, debug: G.settings.debug });
    G.world = world;
    let mp = diff.startMP;
    if (st.ftab === 'roll') mp += B.rolledFounderMP;
    if (st.ftab === 'custom') mp = B.customFounderMP;
    G.run = {
      v: 2, seed, mode: st.mode, biome: biome.id, difficulty: st.difficulty, speciesName: founder.name,
      founder: { tab: st.ftab, id: st.ftab === 'templates' ? st.templateId : st.ftab === 'roll' ? st.archetypeId : st.customLevel },
      round: 1, mp, orders: [], mutants: [], championUsed: false, prevMean: null,
      rivals: [], rivalRecords: {}, collapseCount: 0, apexCount: 0, startProducer: world.producerBiomass(),
      scoreEU: 0, rivalsDefeatedTotal: 0, activeEvents: [], pendingEvent: null, eventRolledRound: 0, eventThisRound: null,
      roundStartPop: founder.startPop, outcome: null, history: [], pendingSplit: null, guidedLast: {}, mutantsLast: {},
      phylo: { lastRound: 1, species: {}, producers: {} },
    };
    G.recordPhylo(1);
    G.updateRivals(true);
    G.enterEvolve();
  };

  // ---------- phylogeny records ----------

  const PHYLO_KEYS = T.BUYABLE_GENES.map(d => d.key);
  function pickMeans(g) { const o = {}; for (const k of PHYLO_KEYS) o[k] = Math.round(g[T.G[k]] * 1000) / 1000; return o; }

  G.recordPhylo = function (round) {
    const w = G.world, ph = G.run.phylo;
    ph.lastRound = Math.max(ph.lastRound || 1, round);
    const pops = w.countPops().count;
    for (const sp of w.species) {
      if (sp.transient) continue;
      let r = ph.species[sp.id];
      if (!r) r = ph.species[sp.id] = { id: sp.id, name: sp.name, level: sp.level, hue: sp.hue, parentId: sp.parentId, origin: sp.originRound || round, extinct: null,
        arrival: !!sp.arrival, archetype: sp.archetype, archetypeName: sp.archetypeName, pops: [], means: [], founder: pickMeans(sp.genome), splitDist: sp.splitDist || 0 };
      r.name = sp.name; r.level = sp.level; r.descendant = !!sp.descendant;
      r.pops[round] = pops[sp.idx];
      if (pops[sp.idx] > 0) { r.means[round] = pickMeans(sp.mean); r.latest = r.means[round]; r.genome = Array.from(sp.mean, v => Math.round(v * 1000) / 1000); r.extinct = null; }
      else if (!r.extinct && r.pops.some(v => v > 0)) r.extinct = round;
    }
    const pm = w.producerMeans();
    w.producers.forEach((P, t) => {
      if (!P) return;
      let r = ph.producers[P.id];
      const m = { growth: pm[t].growth, tough: pm[t].tough, tol: pm[t].tol };
      if (!r) r = ph.producers[P.id] = { id: P.id, name: P.name, level: 'producer', hue: P.hue, origin: 1, pops: [], means: [], founder: m, archetypeName: T.PRODUCER_KINDS[P.kind].name, kind: P.kind };
      r.pops[round] = Math.round(pm[t].biomass / 1000);
      r.tiles = pm[t].n;
      r.means[round] = m; r.latest = m;
    });
  };

  // ---------- Evolve ----------

  G.enterEvolve = function () {
    const run = G.run, w = G.world;
    G.state = 'evolve';
    G.placing = false;
    run.orders = [];
    run.championUsed = false;
    w.player.pressure = []; w.player.focus = {};
    for (const e of w.ents) e.champ = false;
    if (run.eventRolledRound !== run.round) {
      run.eventRolledRound = run.round;
      run.pendingEvent = null;
      const blocking = run.activeEvents.some(a => a.left > 0 && (a.id === 'volcanic' || a.id === 'drought'));
      if (run.round >= B.eventStartRound && !blocking && w.rng.chance(B.eventChance)) run.pendingEvent = w.rng.pick(T.EVENTS).id;
    }
    G.save();
    UI().show('evolve');
    S().renderEvolve();
  };

  G.committedMP = function () { return G.run.orders.reduce((a, o) => a + o.cost, 0); };
  G.guidedOrder = function (key) { return G.run.orders.find(o => o.type === 'guided' && o.gene === key); };
  G.guidedDelta = function (key) { const o = G.guidedOrder(key); return o ? o.delta : 0; };
  G.hasOrder = function (type, key) { return G.run.orders.some(o => o.type === type && o.gene === key); };
  G.hasMutantOrder = function (i) { return G.run.orders.some(o => o.type === 'mutant' && o.idx === i); };
  G.canAdd = function (type) {
    const cost = type === 'pressure' ? B.pressureCost : B.focusCost;
    return G.run.orders.filter(o => o.type === type).length < 2 && G.run.mp - G.committedMP() >= cost;
  };
  const guidedCost = (d, delta) => (delta >= 0 ? delta * d.mp : -Math.floor(-delta * d.mp * B.devolveRefund));

  G.canGuided = function (key, dir) {
    const d = T.GENE_BY_KEY[key], p = G.world.player;
    const cur = G.guidedDelta(key), next = cur + dir;
    const target = p.mean[d.i] + next * d.step;
    if (dir > 0 && target > d.max + 1e-6 && !(d.discrete && p.mean[d.i] + cur * d.step < d.max)) return false;
    if (dir < 0 && target < d.min - 1e-6 && !(d.discrete && p.mean[d.i] + cur * d.step > d.min)) return false;
    const extra = guidedCost(d, next) - guidedCost(d, cur);
    return G.run.mp - G.committedMP() - extra >= 0;
  };
  G.guided = function (key, dir) {
    if (!G.canGuided(key, dir)) return;
    const d = T.GENE_BY_KEY[key];
    let o = G.guidedOrder(key);
    if (!o) { o = { type: 'guided', gene: key, delta: 0, cost: 0 }; G.run.orders.push(o); }
    o.delta += dir;
    o.cost = guidedCost(d, o.delta);
    if (!o.delta) G.run.orders.splice(G.run.orders.indexOf(o), 1);
    T.Audio.cue(dir > 0 ? 'buy' : 'click');
    S().renderEvolve();
  };
  G.toggleOrder = function (type, key) {
    const run = G.run;
    const i = run.orders.findIndex(o => o.type === type && o.gene === key);
    if (i >= 0) run.orders.splice(i, 1);
    else if (G.canAdd(type)) run.orders.push({ type, gene: key, cost: type === 'pressure' ? B.pressureCost : B.focusCost });
    T.Audio.cue('click');
    S().renderEvolve();
  };
  G.toggleMutant = function (i) {
    const run = G.run, m = run.mutants[i];
    const k = run.orders.findIndex(o => o.type === 'mutant' && o.idx === i);
    if (k >= 0) run.orders.splice(k, 1);
    else if (run.mp - G.committedMP() >= m.price) run.orders.push({ type: 'mutant', idx: i, gene: m.gene, cost: m.price });
    T.Audio.cue('buy');
    S().renderEvolve();
  };
  G.removeOrder = function (o) { G.run.orders.splice(G.run.orders.indexOf(o), 1); S().renderEvolve(); };

  // One genome with this round's guided shifts (and mutant spreads, halfway) applied.
  G.applyOrdersTo = function (g) {
    const out = new Float32Array(g);
    for (const o of G.run.orders) {
      const d = T.GENE_BY_KEY[o.gene];
      if (o.type === 'guided') out[d.i] = T.clampGene(d.i, out[d.i] + o.delta * d.step);
    }
    return out;
  };
  G.draftMean = function () {
    const p = G.world.player;
    const g = G.applyOrdersTo(p.mean);
    for (const o of G.run.orders) if (o.type === 'mutant') { const m = G.run.mutants[o.idx]; const i = T.G[m.gene]; g[i] = (g[i] + Math.max(g[i], m.value)) / 2; }
    return g;
  };

  G.startSeason = function () {
    const run = G.run, w = G.world, p = w.player;
    const committed = G.committedMP();
    if (committed > run.mp) return;
    run.guidedLast = {}; run.mutantsLast = {};
    const pressure = [];
    p.focus = {};
    for (const o of run.orders) {
      if (o.type === 'guided') { T.Evo.applyGuided(w, p, o.gene, o.delta); run.guidedLast[o.gene] = o.delta; }
      else if (o.type === 'mutant') { const m = run.mutants[o.idx]; T.Evo.applyMutant(w, p, m.gene, m.value); run.mutantsLast[m.gene] = true; }
      else if (o.type === 'pressure') pressure.push(o.gene);
      else if (o.type === 'focus') p.focus[T.G[o.gene]] = 3;
    }
    run.mp -= committed;
    run.orders = [];
    p.name = run.speciesName;
    w.restatSpecies(p);
    T.Evo.setPressure(w, p, pressure);
    G.updateRivals(false);
    w.beginRound(run.round);
    run.roundStartPop = w.countPops().count[p.idx];
    run.eventThisRound = null;
    if (run.pendingEvent) { G.applyEvent(run.pendingEvent); run.eventThisRound = { id: run.pendingEvent }; run.pendingEvent = null; }
    G.applyEventMods();
    G.state = 'simulate';
    G.acc = 0;
    G.paused = false;
    if (!G.speed) G.speed = 1;
    G.renderer.selected = null;
    G.renderer.dirtyTiles = true;
    G.lastPops = w.countPops().count;
    G.starveWarned = false;
    UI().show('world');
    const tip = T.TUTORIAL[run.round];
    if (G.settings.hints && tip) UI().showHint(tip.sim); else UI().hideHint();
    requestAnimationFrame(() => { G.renderer.resize(); G.renderer.fit(); UI().updateHUD(); });
  };

  // ---------- rivals ----------

  G.updateRivals = function (initial) {
    const w = G.world, run = G.run, p = w.player;
    const pops = w.countPops().count;
    const names = {};
    w.producers.forEach(P => { if (P) names[P.id] = P.name; });
    names.fruit = 'fruit'; names.carrion = 'carrion';
    const scored = [];
    for (const sp of w.species) {
      if (sp.isPlayer || sp.level === 'decomposer' || sp.transient) continue;
      const rec = run.rivalRecords[sp.id];
      if (pops[sp.idx] === 0 && !rec) continue;
      let score = 0;
      const why = [];
      const shared = [...p.foods].filter(f => sp.foods.has(f));
      if (shared.length) { score += shared.length; why.push('eats ' + shared.map(f => names[f] || f).join(', ')); }
      const prey = w.species.filter(x => x !== p && x !== sp && w.edible[p.idx][x.idx] && w.edible[sp.idx][x.idx]);
      if (prey.length) { score += 1.5 * prey.length; why.push('hunts ' + prey.map(x => x.name).join(', ')); }
      if (w.edible[sp.idx][p.idx] || (w.round <= B.predatorGraceRounds && sp.stats.canMeat && sp.preyLevels.has(p.level))) { score += 3; why.push('preys on you'); }
      if (sp.descendant && !shared.length) continue;   // descendants are only rivals if they compete for food
      if (score >= 1) scored.push({ sp, score, why: why.join(' · ') });
    }
    scored.sort((a, b) => b.score - a.score);
    const before = run.rivals.map(r => r.id).join();
    run.rivals = scored.slice(0, 6).map(({ sp, why }) => {
      let r = run.rivalRecords[sp.id];
      if (!r) r = run.rivalRecords[sp.id] = { id: sp.id, name: sp.name, startPop: Math.max(1, pops[sp.idx]), low: 0, defeated: pops[sp.idx] === 0, defeatedRound: 0 };
      r.why = why; r.name = sp.name;
      return r;
    });
    if (!initial && before !== run.rivals.map(r => r.id).join()) UI().toast('Your niche shifted: rival list updated.');
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
    w.ectoSlowAll = act.includes('volcanic');
  };

  // ---------- Simulate ----------

  G.setSpeed = function (s) {
    if (s === 0) { G.paused = !G.paused; if (!G.paused && !G.speed) G.speed = 1; }
    else { G.speed = s; G.paused = false; }
    T.Audio.cue('click');
    if (G.state === 'simulate') UI().updateHUD();
  };

  G.issueDirective = function (id) {
    if (G.state !== 'simulate') return;
    const w = G.world;
    const d = T.DIRECTIVES.find(x => x.id === id);
    if (id === 'hunt' && !w.player.stats.canMeat) { UI().toast('Your species cannot digest meat yet.'); return; }
    if (w.activeDirective() === id) return;
    if (!w.issueDirective(id)) { UI().toast(d.name + ' ready in ' + Math.ceil((w.directiveReady[id] - w.t) / B.ticksPerSecond) + ' s'); return; }
    T.Audio.cue('click');
    UI().toast(id === 'isolate' ? 'Isolated ' + w.lastIsolated + ' individuals: they now only mate inside their group.' : 'Directive: ' + d.name);
    UI().updateHUD();
  };

  G.togglePlacing = function () {
    if (G.state !== 'simulate') return;
    G.placing = !G.placing;
    $('world').classList.toggle('placing', G.placing);
    UI().updateHUD();
  };
  G.placeMarker = function (tx, ty) {
    const N = B.worldSize;
    G.world.marker = { x: Math.max(0.5, Math.min(N - 0.5, tx)), y: Math.max(0.5, Math.min(N - 0.5, ty)) };
    for (const e of G.world.ents) if (e.sp.isPlayer) e.think = 0;
    G.placing = false;
    $('world').classList.remove('placing');
    T.Audio.cue('click');
    UI().updateHUD();
  };
  G.clearMarker = function () { G.world.marker = null; UI().updateHUD(); };

  G.champion = function (e) {
    const run = G.run;
    if (run.championUsed || run.mp < B.championCost || !e.alive || e.grow < 1) return;
    run.mp -= B.championCost;
    run.championUsed = true;
    e.champ = true;
    T.Audio.cue('buy');
    UI().toast(e.sp.name + ' #' + String(e.num).padStart(4, '0') + ' is your Champion: first pick of mates, stronger young.', 'good');
    UI().renderInspector();
  };
  G.cull = function (e) {
    if (G.world.cull(e)) { T.Audio.cue('kill'); UI().toast('Culled #' + String(e.num).padStart(4, '0') + '. Its genes leave the pool.'); G.renderer.selected = null; UI().renderInspector(); }
  };

  G.frame = function (now) {
    requestAnimationFrame(G.frame);
    const dt = Math.min(0.1, (now - (G.last || now)) / 1000);
    G.last = now;
    if (G.state !== 'simulate' || !G.world) return;
    const w = G.world;
    panKeys(dt);
    if (!G.paused && !G.menuOpen) {
      G.acc += dt * B.ticksPerSecond * G.speed;
      let n = 0;
      const t0 = performance.now();
      while (G.acc >= 1 && n < 24) {
        w.tick();
        G.acc -= 1; n++;
        if (w.roundTick % 10 === 0) G.watchPops();
        if (w.roundOver() || G.playerCount() === 0) break;
      }
      if (n) G.tickMs = G.tickMs * 0.9 + ((performance.now() - t0) / n) * 0.1;
      if (G.acc > 24) G.acc = 0;
      if (w.roundOver() || G.playerCount() === 0) { G.renderer.consumeEvents(w); G.endRound(); return; }
    }
    for (const ev of w.events) {
      if (ev.player && ev.type === 'bite') T.Audio.cue('bite');
      else if (ev.type === 'kill') T.Audio.cue('kill');
      else if (ev.type === 'birth' && ev.player) T.Audio.cue('birth');
    }
    G.renderer.consumeEvents(w);
    G.renderer.draw(w, G.paused ? 1 : Math.min(1, G.acc), G.paused ? 0 : dt);
    if (!G.hudT || now - G.hudT > 250) {
      G.hudT = now;
      if (w.t % 60 < 30) w.updateMeans(w.player);
      UI().updateHUD();
      UI().renderInspector();
      T.Audio.setSeason(w.seasonIdx);
    }
  };

  G.playerCount = function () {
    let n = 0;
    for (const e of G.world.ents) if (e.alive && e.sp.isPlayer) n++;
    return n;
  };

  G.watchPops = function () {
    const w = G.world, pops = w.countPops().count, prev = G.lastPops || pops;
    w.species.forEach((sp, i) => {
      if (prev[i] > 0 && pops[i] === 0 && !sp.transient) {
        UI().toast(T.UI.plural(sp.name) + ' are extinct.', sp.isPlayer ? 'bad' : 'good');
        if (!sp.isPlayer && G.run.rivals.some(r => r.id === sp.id)) T.Audio.cue('rival');
      }
    });
    G.lastPops = pops;
    const p = w.player;
    let e = 0, n = 0;
    for (const x of w.ents) if (x.alive && x.sp === p) { e += x.E / x.st.maxE; n++; }
    if (n && e / n < 0.25 && !G.starveWarned) {
      G.starveWarned = true;
      T.Audio.cue('starve');
      UI().toast('Your species is starving. Try Forage, or move your territory to fresh food.', 'bad');
    }
  };

  // ---------- round end / Selection report ----------

  G.endRound = function () {
    const w = G.world, run = G.run;
    const diff = B.difficulties[run.difficulty];
    G.state = 'report';
    G.placing = false;
    for (const e of w.ents) if (e.alive && e.sp.transient) { w.ledger.exported += e.E + e.tissue; e.E = 0; e.tissue = 0; e.alive = false; }
    w.ents = w.ents.filter(e => e.alive);
    w.updateMeans();
    const p = w.player;
    const pops = w.countPops();
    const pPop = pops.count[p.idx], pE = pops.energy[p.idx];
    const rs = w.rstats[p.idx];

    // rivals
    const defeatedNow = [];
    for (const r of run.rivals) {
      if (r.defeated) continue;
      const sp = w.speciesById(r.id);
      const n = sp ? pops.count[sp.idx] : 0;
      if (n === 0) r.defeated = true;
      else if (n < B.rivalDefeatFrac * r.startPop) { r.low++; if (r.low >= B.rivalDefeatRounds) r.defeated = true; }
      else r.low = 0;
      if (r.defeated) { r.defeatedRound = run.round; defeatedNow.push(r.name); }
    }
    run.rivalsDefeatedTotal += defeatedNow.length;

    // MP
    const parts = [['Base', B.mpBase], ['Offspring ' + rs.births + ' ÷ ' + B.mpPerOffspring, Math.floor(rs.births / B.mpPerOffspring)],
      ['Banked ' + T.UI.fmt(pE) + ' EU ÷ ' + T.UI.fmt(B.mpEnergyDivisor), Math.floor(pE / B.mpEnergyDivisor)]];
    for (const n of defeatedNow) parts.push(['Rival defeated: ' + n, B.mpPerRival]);
    let raw = parts.reduce((a, b) => a + b[1], 0);
    if (raw > B.mpCap) { parts.push(['Cap (' + B.mpCap + ')', B.mpCap - raw]); raw = B.mpCap; }
    if (pPop > 0 && pPop < run.roundStartPop) { parts.push(['Adaptive pressure', B.mpAdaptive]); raw += B.mpAdaptive; }
    run.scoreEU += rs.assimilated;

    // outcome
    const pyr = w.pyramid();
    const share = pyr.levels[p.level] > 0 ? pyr.player[p.level] / pyr.levels[p.level] : 0;
    const consumers = pyr.levels.herbivore + pyr.levels.omnivore + pyr.levels.carnivore1 + pyr.levels.carnivore2;
    let descE = 0;
    for (const lv in pyr.descendant) if (lv !== 'producer' && lv !== 'decomposer') descE += pyr.descendant[lv];
    const apexShare = consumers > 0 ? (pE + B.descendantShare * descE) / consumers : 0;
    run.apexCount = apexShare >= B.apexShare ? run.apexCount + 1 : 0;
    run.collapseCount = w.producerBiomass() < B.collapseFrac * run.startProducer ? run.collapseCount + 1 : 0;
    let outcome = null;
    const allRivals = run.rivals.length > 0 && run.rivals.every(r => r.defeated);
    if (pPop === 0) outcome = { win: false, kind: 'extinction', headline: 'Extinction. ' + p.name + ' have died out.' };
    else if (run.collapseCount >= B.collapseRounds) outcome = { win: false, kind: 'collapse', headline: 'Collapse. Producers fell below 15% for two rounds and the pyramid starved.' };
    else if (allRivals && share >= B.dominanceShare) outcome = { win: true, kind: 'dominance', headline: 'Dominance victory! Every rival is defeated and you hold ' + Math.round(share * 100) + '% of your level.' };
    else if (run.apexCount >= B.apexRounds) outcome = { win: true, kind: 'apex', headline: 'Apex victory! Your lineage held half of all consumer biomass for three rounds.' };
    else if (run.round >= B.maxRounds) outcome = { win: false, kind: 'time', headline: 'Round limit reached without victory.' };

    const notes = w.notes.splice(0);
    if (allRivals && !outcome) notes.push('All rivals defeated, but you hold only ' + Math.round(share * 100) + '% of your trophic level (need ' + Math.round(B.dominanceShare * 100) + '%).');
    if (run.apexCount > 0 && !outcome) notes.push('Apex progress: ' + run.apexCount + '/' + B.apexRounds + ' rounds holding half of consumer biomass.');
    if (run.collapseCount > 0 && !outcome) notes.push('Warning: producer biomass is below 15% of its starting value. One more round like this and the ecosystem collapses.');

    // evolution between rounds
    const evolved = T.Evo.whatEvolved(w, { guided: run.guidedLast, mutants: run.mutantsLast }).map(x => Object.assign(x, { hue: (w.species.find(s => s.name === x.species) || {}).hue || 0 }));
    run.mutants = outcome ? [] : T.Evo.findMutants(w, p);
    run.prevMean = Array.from(w.roundStartMeans[p.idx] || p.mean);
    const extinct = w.species.filter(s => !s.transient && w.rstats[s.idx].startPop > 0 && pops.count[s.idx] === 0).map(s => s.name);
    const speciation = [];
    if (!outcome) {
      for (const ev of T.Evo.checkSpeciation(w, run.round)) {
        speciation.push({ parentId: ev.parent.id, childId: ev.child.id, dist: ev.dist, nParent: ev.nParent, nChild: ev.nChild, player: ev.player });
        if (ev.player) run.pendingSplit = { parentId: ev.parent.id, childId: ev.child.id };
        T.Audio.cue('rival');
      }
    }
    for (const a of run.activeEvents) a.left--;
    run.activeEvents = run.activeEvents.filter(a => a.left > 0);
    G.recordPhylo(run.round);

    const lines = [{ idx: p.idx, name: p.name, level: p.level, hue: p.hue, player: true, start: w.rstats[p.idx].startPop, end: pPop }];
    for (const r of run.rivals.slice(0, 5)) {
      const sp = w.speciesById(r.id);
      if (sp) lines.push({ idx: sp.idx, name: sp.name, level: sp.level, hue: sp.hue, start: w.rstats[sp.idx].startPop, end: pops.count[sp.idx] });
    }
    run.report = {
      round: run.round, playerName: p.name, rs: clone(Object.assign({}, rs, { birthMids: [] })), mpParts: parts, mpTotal: raw,
      outcome, evolved, defeatedNow, extinct, speciation, notes, lines,
      history: { t: w.history.t.slice(), pops: w.history.pops.map(r => r.slice()) },
    };
    run.history.push({ round: run.round, pop: pPop, mp: raw, share });
    if (outcome) run.outcome = outcome;
    else run.mp += raw;
    if (defeatedNow.length) T.Audio.cue('rival');
    if (pPop === 0) T.Audio.cue('extinct');
    T.Audio.setSeason(0, pPop < run.roundStartPop ? -1 : 1);
    UI().show('report');
    requestAnimationFrame(() => S().renderReport(run.report));
  };

  G.chooseBranch = function (keepChild) {
    const run = G.run, w = G.world;
    const ps = run.pendingSplit;
    if (!ps) return;
    const parent = w.speciesById(ps.parentId), child = w.speciesById(ps.childId);
    if (keepChild) {
      T.Evo.swapPlayerBranch(w, { parent, child });
      run.speciesName = child.name;
      UI().toast('You now guide ' + child.name + '. ' + parent.name + ' continue as a Descendant species.', 'good');
    } else {
      child.descendant = true;
      UI().toast(child.name + ' go their own way as a Descendant species.', 'good');
    }
    run.pendingSplit = null;
    run.mutants = T.Evo.findMutants(w, w.player);
    G.recordPhylo(run.round);
    G.updateRivals(false);
    S().renderReport(run.report);
  };

  G.continueFromReport = function () {
    const run = G.run;
    if (run.pendingSplit) return;
    if (run.outcome) { G.showEnd(); return; }
    run.round++;
    G.world.round = run.round;
    G.world.rebuildDiet();
    G.enterEvolve();
  };

  G.showEnd = function () {
    const run = G.run, diff = B.difficulties[run.difficulty];
    const o = run.outcome;
    const euPts = Math.round(run.scoreEU / B.scoreEnergyDivisor);
    const rivalPts = run.rivalsDefeatedTotal * B.scorePerRival;
    const winPts = o.win ? B.scoreVictory : 0;
    const roundPts = -run.round * B.scorePerRound;
    const score = Math.max(0, Math.round((euPts + rivalPts + winPts + roundPts) * diff.scoreMult));
    const titles = { dominance: 'Dominance', apex: 'Apex', extinction: 'Extinction', collapse: 'Collapse', time: 'Out of time' };
    S().renderEnd({
      round: run.round, difficulty: diff.name, title: titles[o.kind], sub: o.headline, score,
      rows: [['Energy assimilated (' + T.UI.fmt(run.scoreEU) + ' EU ÷ ' + B.scoreEnergyDivisor + ')', T.UI.fmt(euPts)],
        ['Rivals defeated (' + run.rivalsDefeatedTotal + ' × ' + B.scorePerRival + ')', T.UI.fmt(rivalPts)],
        ['Victory bonus', T.UI.fmt(winPts)], ['Rounds used (' + run.round + ' × −' + B.scorePerRound + ')', T.UI.fmt(roundPts)],
        ['Difficulty multiplier', '×' + diff.scoreMult]],
    });
    removeKey(SAVE_KEY);
    G.state = 'end';
    UI().show('end');
  };

  // ---------- overlays ----------

  G.openOverlay = function (name, id) {
    if (!G.run) return;
    if (G.state !== 'phylogeny' && G.state !== 'codex') G.overlayReturn = G.state;
    G.state = name;
    UI().show(name);
    if (name === 'phylogeny') S().renderPhylogeny(id);
    else S().renderCodex(id);
  };
  G.closeOverlay = function () {
    const back = G.overlayReturn || 'evolve';
    G.state = back;
    if (back === 'evolve') { UI().show('evolve'); S().renderEvolve(); }
    else if (back === 'report') { UI().show('report'); S().renderReport(G.run.report); }
    else if (back === 'end') UI().show('end');
    else UI().show(back === 'simulate' ? 'world' : back);
  };

  // ---------- save / load ----------

  G.saveData = function () {
    const run = Object.assign({}, G.run, { report: null });
    return { v: 2, savedAt: Date.now(), run, world: G.world.serialize() };
  };
  G.save = function () {
    if (!G.run || !G.world) return;
    if (!store(SAVE_KEY, G.saveData())) UI().toast('Autosave failed (browser storage full or unavailable). Export your save from the menu.', 'bad');
    else if (G.run.migratedFrom === 1) removeKey(OLD_SAVE_KEY);   // a Phase 1 save is only retired once it has been migrated
  };
  G.continueRun = function () {
    const v2 = loadKey(SAVE_KEY), v1 = loadKey(OLD_SAVE_KEY);
    const data = v2 && (!v1 || v2.savedAt >= (v1.savedAt || 0)) ? v2 : v1 || v2;
    if (!data) { UI().toast('No saved run found.', 'bad'); return; }
    G.loadData(data);
  };

  // Phase 1 run objects: carry over MP, round, rivals and score; start Phase 2 records.
  function migrateRunV1(r, w) {
    return {
      v: 2, seed: r.seed, mode: 'meadow', biome: 'meadow', difficulty: r.difficulty || 'standard', speciesName: r.speciesName,
      founder: { tab: 'templates', id: r.templateId }, round: r.round, mp: r.mp, orders: [], mutants: [], championUsed: false, prevMean: null,
      rivals: r.rivals || [], rivalRecords: r.rivalRecords || {}, collapseCount: r.collapseCount || 0, apexCount: r.apexCount || 0,
      startProducer: r.startProducer || w.producerBiomass(), scoreEU: r.scoreEU || 0, rivalsDefeatedTotal: r.rivalsDefeatedTotal || 0,
      activeEvents: r.activeEvents || [], pendingEvent: r.pendingEvent || null, eventRolledRound: r.eventRolledRound || 0, eventThisRound: null,
      roundStartPop: r.roundStartPop || 0, outcome: null, history: r.history || [], pendingSplit: null, guidedLast: {}, mutantsLast: {},
      phylo: { lastRound: r.round, species: {}, producers: {} }, migratedFrom: 1,
    };
  }

  G.loadData = function (data) {
    try {
      if (!data || !data.world || !data.run || (data.v !== 1 && data.v !== 2)) throw new Error('Not a Trophic save file');
      G.cancelGen();
      const w = T.loadWorld(data.world, { debug: G.settings.debug });
      G.world = w;
      G.run = data.v === 1 ? migrateRunV1(data.run, w) : data.run;
      w.round = G.run.round;
      w.player.name = G.run.speciesName;
      w.rebuildDiet();
      if (data.v === 1) { G.recordPhylo(G.run.round); UI().toast('Phase 1 save migrated: your species now has individual genomes.', 'good'); }
      G.enterEvolve();
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
    a.download = 'trophic-' + (G.run.speciesName || 'run').replace(/\W+/g, '-').toLowerCase() + '-round-' + data.run.round + '.json';
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
    let drag = null, pinch = null, longPress = null;
    const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const placeAt = (x, y) => { const [wx, wy] = G.renderer.screenToWorld(x, y); G.placeMarker(wx / B.tilePx, wy / B.tilePx); };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      if (G.state !== 'simulate') return;
      cv.setPointerCapture(e.pointerId);
      const [x, y] = local(e);
      ptrs.set(e.pointerId, { x, y });
      if (e.button === 2) { placeAt(x, y); return; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; drag = null; clearTimeout(longPress); return; }
      drag = { x, y, cx: G.renderer.cam.x, cy: G.renderer.cam.y, moved: false };
      if (e.pointerType === 'touch') longPress = setTimeout(() => { if (drag && !drag.moved) { placeAt(x, y); drag = null; } }, 550);
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
        if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; cv.classList.add('dragging'); clearTimeout(longPress); }
        if (drag.moved) { G.renderer.cam.x = drag.cx - dx / G.renderer.cam.zoom; G.renderer.cam.y = drag.cy - dy / G.renderer.cam.zoom; G.renderer.clampCam(); }
      }
    });
    const up = e => {
      ptrs.delete(e.pointerId);
      clearTimeout(longPress);
      cv.classList.remove('dragging');
      if (ptrs.size < 2) pinch = null;
      if (drag && !drag.moved && e.button !== 2 && G.state === 'simulate') {
        const [x, y] = local(e);
        if (G.placing) placeAt(x, y);
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
      if (G.state !== 'simulate') return;
      e.preventDefault();
      const [x, y] = local(e);
      G.renderer.zoomAt(x, y, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (G.menuOpen) G.closeMenu();
        else if (G.state === 'phylogeny' || G.state === 'codex') G.closeOverlay();
        else if (G.state === 'simulate' && G.renderer.selected) { G.renderer.selected = null; UI().renderInspector(); }
        else G.openMenu();
        return;
      }
      if (G.state !== 'simulate' || G.menuOpen) return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { G.keys[k] = true; e.preventDefault(); return; }
      if (k === ' ') { e.preventDefault(); G.setSpeed(0); return; }
      if (k === '+' || k === '=') { G.setSpeed(G.paused ? G.speed || 1 : Math.min(4, (G.speed || 1) * 2)); return; }
      if (k === '-' || k === '_') { if (G.speed <= 1) G.setSpeed(0); else G.setSpeed(G.speed / 2); return; }
      if (k === 't') { if (G.mouse.inside) placeAt(G.mouse.x, G.mouse.y); else G.togglePlacing(); return; }
      const d = T.DIRECTIVES.find(x => x.key === k);
      if (d) G.issueDirective(d.id);
    });
    window.addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { G.keys = {}; });
  }

  window.addEventListener('DOMContentLoaded', G.init);
})(window.Trophic);
