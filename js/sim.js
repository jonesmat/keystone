// Keystone — deterministic fixed-step ecosystem simulation (Phase 2: every individual carries a genome).
// Pure logic: no DOM access, so it also runs headless under Node for tuning and seed sweeps.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const N = B.worldSize, NT = N * N;
  const CELL = 4, CN = Math.ceil(N / CELL);
  const G = T.G, GENES = T.GENES, NG = T.NG;

  // ---------- helpers ----------

  // mulberry32, with state kept as a plain integer so it can be saved.
  function RNG(seed) { this.s = seed >>> 0; }
  RNG.prototype.next = function () {
    let a = (this.s = (this.s + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
  RNG.prototype.int = function (n) { return Math.floor(this.next() * n); };
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.gauss = function () {
    let u = 0;
    while (u === 0) u = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  };
  T.RNG = RNG;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const interp3 = (arr, t) => (t <= 0.5 ? lerp(arr[0], arr[1], t * 2) : lerp(arr[1], arr[2], (t - 0.5) * 2));
  T.util = { lerp, clamp, interp3 };

  T.classifyLevel = function (g, base) {
    const meat = g[G.diet];
    if (meat < 0.3) return 'herbivore';
    if (meat < 0.7) return 'omnivore';
    return base.apex || g[G.size] >= 10 ? 'carnivore2' : 'carnivore1';
  };

  // Genome (+ growth stage) -> derived stats. Computed once per individual at birth and at growth steps.
  T.deriveStats = function (sp, g, grow) {
    grow = grow == null ? 1 : grow;
    const b = sp.base;
    const mass = Math.max(0.1, g[G.size] * grow);
    const meat = g[G.diet];
    const m75 = Math.pow(mass, B.kleiber);
    const decomp = sp.level === 'decomposer';
    const ecto = g[G.metabolism] >= 0.5, flight = g[G.flight] >= 0.5;
    let plantA = interp3(B.plantA, meat) + 0.05 * g[G.plantGut] + (g[G.symbiotic] >= 0.5 ? 0.15 : 0);
    let meatA = interp3(B.meatA, meat) + 0.05 * g[G.meatGut];
    const apex = b.apex || sp.level === 'carnivore2';
    // Every assimilated EU is kept (no per-meal P); metabolism is paid as upkeep instead.
    if (decomp) { plantA = B.decomposerA; meatA = B.decomposerA; }
    let traitUp = 0;
    for (let i = 0; i < NG; i++) { const u = GENES[i].upkeep; if (u) traitUp += u * g[i]; }
    traitUp *= B.upkeepScale;
    let basal = B.k * m75 * B.upkeepScale;
    basal *= B.metabScale * (B.levelMetab[apex ? 'carnivore2' : sp.level] || 1);
    if (flight) basal *= 1.5;
    const apexRest = B.apexRestP3;
    if (apex) basal *= apexRest;   // big predators spend most of the day resting
    // Endotherms pay to hold body temperature (per °C below T_body); small bodies lose heat fastest (M^0.67).
    let thermo = ecto || decomp ? 0 : B.thermoCoef * Math.pow(mass, 0.67) * B.upkeepScale;
    if (apex) thermo *= apexRest;   // resting in a den or bedded down saves heat as well
    const K = g[G.repro];
    const social = g[G.social];
    return {
      mass, meat, m75, grow,
      // Predators keep full reserves: metabolism is a steady cost, so they must last between kills.
      maxE: B.energyPerMass * mass * (1 + 0.15 * g[G.fat]),
      maxHp: B.hpPerMass * mass,
      speed: b.speed * (1 + 0.08 * g[G.speed]) * (1 - 0.05 * g[G.fat]) * (flight ? 1.15 : 1) * (0.8 + 0.2 * grow),
      sight: b.sight * (1 + 0.1 * g[G.senses]),
      // Assimilation stays inside the textbook's ranges: plants 30–60% (less for omnivores), meat 60–90%.
      plantA: clamp(plantA, 0.2, 0.6),
      meatA: clamp(meatA, decomp ? 0.3 : 0.6, 0.9),
      basal, traitUp, thermo,
      eatRate: B.eatRate * m75,
      dmg: B.biteCoef * m75 * (1 + 0.12 * g[G.bite]),
      armor: 0.1 * g[G.armor], reflect: 0.15 * g[G.spines], venom: g[G.venom], camo: 0.15 * g[G.camo],
      herd: meat < 0.5 ? social : 0, pack: meat >= 0.5 ? social : 0,
      litter: Math.max(1, Math.round(4 - 3 * K)), breedCd: Math.round(120 + 300 * K), youngHp: 0.5 + 0.5 * K,
      growRate: (1 - B.juvenileMass) / (300 + 600 * K),
      ecto, flight, echo: g[G.echolocation] >= 0.5, hibernate: g[G.hibernation] >= 0.5,
      canPlants: meat <= 0.7, canMeat: meat >= 0.3,
      radius: 0.12 + 0.1 * Math.pow(mass, 0.45),
      bold: g[G.boldness], aggr: g[G.aggression], cohesion: g[G.cohesion], roam: g[G.roam],
      ambush: g[G.ambush], burrow: g[G.burrow], charge: g[G.charge],
      lifeTicks: g[G.longevity] * B.roundTicks * B.lifespanMult,
      tissueAdult: B.tissuePerMass * Math.max(0.1, g[G.size]),
      // Swimmers move in water only; filter-feeders strain plankton from whatever tile they drift through.
      swim: !!(sp.flags && sp.flags.swim), filter: !!(sp.flags && sp.flags.filter),
    };
  };

  // Projected income vs spend per individual (EU/tick). Duty cycles calibrated from headless runs.
  T.projection = function (st, biome, mode) {
    biome = biome || B.biomes.meadow;
    const m = typeof mode === 'object' && mode ? mode : B.modes[mode || B.energyMode];
    // Thermoregulation at the biome's mean air temperature (the seasons average out close to it).
    const dT = Math.max(0, B.bodyTemp - (biome.tMean == null ? 10 : biome.tMean));
    const spend = st.basal + st.traitUp + st.basal * B.activityCost * 0.5 + (st.thermo || 0) * m.thermoScale * dT;
    const plantInc = st.canPlants ? st.eatRate * st.plantA * 0.075 : 0;
    const meatInc = st.canMeat ? st.eatRate * st.meatA * 0.055 : 0;
    let income;
    if (plantInc && meatInc) income = (1 - st.meat) * plantInc + st.meat * meatInc + 0.1 * Math.min(plantInc, meatInc);
    else income = plantInc + meatInc;
    return { spend, income, margin: spend > 0 ? income / spend - 1 : 0 };
  };

  function makeNoise(rng, cells) {
    const g = [];
    for (let i = 0; i <= cells; i++) { g.push([]); for (let j = 0; j <= cells; j++) g[i].push(rng.next()); }
    return function (x, y) {
      const fx = (x / N) * cells, fy = (y / N) * cells;
      const ix = Math.min(cells - 1, Math.floor(fx)), iy = Math.min(cells - 1, Math.floor(fy));
      let tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = lerp(g[iy][ix], g[iy][ix + 1], tx), c = lerp(g[iy + 1][ix], g[iy + 1][ix + 1], tx);
      return lerp(a, c, ty);
    };
  }

  // ---------- World ----------

  function World(opts) {
    this.rng = new RNG(opts.seed || 1);
    this.seed = opts.seed || 1;
    this.t = 0;
    this.roundTick = 0;
    this.round = 1;
    this.nextId = 1;
    this.debug = !!opts.debug;
    this.biome = opts.biome || B.biomes.meadow;
    this.biomeLight = this.biome.light;
    this.mode = B.modes[opts.mode || B.energyMode] || B.modes.game;
    this.airTemp = this.biome.tMean == null ? 10 : this.biome.tMean;
    // Endotherms are insulated for the climate they live in: the cost per °C is normalised so an animal of a cold
    // ecoregion pays at its annual mean what a Meadow animal pays at the Meadow's. Later warming still counts.
    this.insulation = B.insulationRef / Math.max(10, B.bodyTemp - (this.biome.tMean == null ? 10 : this.biome.tMean));
    this.thermoDT = Math.max(0, B.bodyTemp - this.airTemp) * this.mode.thermoScale * this.insulation;
    this._ectoPerf();
    this.eventLight = 1.0;
    this.growthMod = 1.0;
    this.climate = 1.0;
    this.ectoSlowAll = false;
    this.events = [];
    this.species = [];
    this.producers = [null];
    this.ents = [];
    this.carrion = [];
    this.cells = [];
    for (let i = 0; i < CN * CN; i++) this.cells.push([]);
    this.terrain = new Uint8Array(NT);
    this.ptype = new Uint8Array(NT);
    this.pE = new Float64Array(NT);
    this.fruit = new Float64Array(NT);
    this.detr = new Float64Array(NT);
    this.nutr = new Float32Array(NT);
    this.shade = new Float32Array(NT);
    this.regrow = new Uint16Array(NT);
    this.moist = new Float32Array(NT);
    this.elev = new Float32Array(NT);
    this.pgGrowth = new Float32Array(NT);  // producer tile genes
    this.pgTough = new Float32Array(NT);
    this.pgTol = new Float32Array(NT);
    this.ledger = { initial: 0, captured: 0, heat: 0, imported: 0, exported: 0, lastErr: 0, maxErr: 0 };
    this.cumulative = { captured: 0 };
    this.history = { t: [], pops: [] };
    this.rstats = [];
    this.popCount = [];
    this.flow = { producer: 0, herbivore: 0, omnivore: 0, carnivore1: 0, carnivore2: 0, decomposer: 0 };
    this._flowAcc = { producer: 0, herbivore: 0, omnivore: 0, carnivore1: 0, carnivore2: 0, decomposer: 0 };
    this.capturedTick = 0;
    this.seasonIdx = 0;
    this.lightFrac = 1;
    this.notes = [];
    this.pbook = null;   // per-round producer booking (GPP, respiration, NPP, litter, eaten), set up in setProducers
    this.tOffset = 0;     // warming above the biome's climate, °C (js/cycles.js)
    this.co2 = B.climate.co2Start;
    this.climateTrend = !!opts.climateTrend;
    this.irrigation = 0;  // groundwater drawn per tick by irrigation (scenarios with farming)
  }

  // Round accumulators for each producer type: the first two steps of the energy chain, plus what happened to NPP.
  World.prototype._newProducerBook = function () {
    const n = this.producers.length;
    const z = () => new Float64Array(n);
    return { gpp: z(), resp: z(), npp: z(), litter: z(), eaten: z(), unpollinated: z() };
  };

  // Ectotherm performance from air temperature (Phase 3); Phase 2 keeps its light-based slowdown instead.
  World.prototype._ectoPerf = function () {
    const T0 = B.ectoTorpidTemp;
    this.ectoTorpid = this.airTemp < T0;
    this.ectoPerf = clamp(B.ectoMinPerf + (1 - B.ectoMinPerf) * (this.airTemp - T0) / (B.ectoFullTemp - T0), B.ectoMinPerf, 1);
  };

  // Air temperature for a season: spring and autumn at the biome mean, summer and winter one amplitude away.
  World.prototype.seasonTemp = function (i) {
    const b = this.biome, mean = b.tMean == null ? 10 : b.tMean, amp = b.tAmp == null ? 10 : b.tAmp;
    return mean + (i === 1 ? amp : i === 3 ? -amp : 0);
  };
  T.World = World;
  World.prototype.N = N;

  // opts: { seed, roster: {producers, species, pool}, biome, mode, closed, primary, climateTrend, debug }
  T.createWorld = function (opts) {
    const w = new World(opts);
    w.setProducers(opts.roster.producers);
    w._generateTerrain();
    w._initCycles(true);
    w._initSuccession(!!opts.primary);
    // Every species has a fixed trait sheet (Phase 3): individuals share it and nothing evolves.
    // Rosters give starting numbers for a 64 × 64 area; they scale with the map.
    for (const def of opts.roster.species) w.addSpecies(Object.assign({}, def, { startPop: Math.round((def.startPop || 0) * B.areaScale) }));
    w._initDemography(opts.roster.pool || [], opts.closed);
    w._populate();
    for (const sp of w.species) sp.initialPop = w.countPops().count[sp.idx];
    w.decompRef = w.species.filter(sp => sp.level === 'decomposer').reduce((a, sp) => a + sp.initialPop, 0);
    w.updateMeans();
    w.ledger.initial = w.totalPools();
    w.nledger.initial = w.totalNitrogen();
    w.updateRegions();
    w.beginRound(1);
    return w;
  };

  World.prototype.setProducers = function (list) {
    this.producers = [null].concat(list.map(p => Object.assign({}, p)));
    this.producers.forEach((p, i) => { if (p) p.idx = i; });
    this.plantNames = new Set(list.map(p => p.name).concat(['Fruit', 'Detritus']));
    this.producerIds = new Set(list.map(p => p.id));
    this.pbook = this._newProducerBook();
    this._producerCycleTraits();
  };

  World.prototype.producerById = function (id) { return this.producers.find(p => p && p.id === id) || null; };

  World.prototype.addSpecies = function (def) {
    const genome = def.genome instanceof Float32Array ? new Float32Array(def.genome) : T.genomeFrom(def.genome, def.flags, def.level);
    const sp = {
      idx: this.species.length, id: def.id, name: def.name,
      level: def.level || 'herbivore', archetype: def.archetype || null, archetypeName: def.archetypeName || null,
      base: Object.assign({}, def.base), eats: (def.eats || []).slice(),
      flags: Object.assign({}, def.flags || {}), genome, mean: new Float32Array(genome), sd: new Float32Array(NG),
      startPop: def.startPop || 0, initialPop: def.initialPop || 0, herdSize: def.herdSize || null,
      invasive: !!def.invasive, transient: !!def.transient, domestic: !!def.domestic,
      originRound: def.originRound || 1, hue: def.hue || 0,
      behavior: def.behavior || '', weakness: def.weakness || '', note: def.note || '',
      stratum: def.stratum || null, activity: def.activity || null,
      counter: def.counter || 0,
      stats: null, foods: null, preyLevels: null, spriteKey: '', extinctRound: null,
      // Catalog species (Phase 3): the real species behind the definition.
      meta: def.meta || (def.catalogKey ? { sci: def.sci, native: def.native, iucn: def.iucn, catalogKey: def.catalogKey, taxon: def.taxon,
        roles: def.roles, massKg: def.massKg, slot: def.slot } : null),
    };
    this.species.push(sp);
    this.refreshSpecies(sp);
    if (T.isPopulationSpecies(sp)) this._newGrid(sp);
    this.rstats.push(this._newRoundStats(sp));
    this.popCount.push(0);
    this.rebuildDiet();
    this.reach = null;   // interaction tables rebuild on the next tick
    return sp;
  };

  World.prototype.speciesById = function (id) { return this.species.find(s => s.id === id) || null; };

  World.prototype.refreshSpecies = function (sp) {
    sp.stats = T.deriveStats(sp, sp.genome, 1);
    const f = new Set();
    for (const t of sp.eats) if (this.producerIds.has(t) || t === 'fruit' || t === 'carrion' || t === 'detritus') f.add(t);
    sp.foods = f;
    sp.eatsPlants = [...this.producerIds].some(t => f.has(t));
    let key = sp.level + '|' + sp.hue;
    for (let i = 0; i < NG; i++) if (!GENES[i].marker) key += '|' + Math.round(sp.genome[i] / GENES[i].step * 2);
    sp.spriteKey = key;
  };

  // Re-derive each species' stats from its fixed trait sheet and count its living individuals.
  World.prototype.updateMeans = function (only) {
    for (const sp of this.species) {
      if (only && sp !== only) continue;
      let n = 0;
      for (const e of this.ents) if (e.alive && e.sp === sp) n++;
      sp.n = n;
      this.refreshSpecies(sp);
    }
    this.rebuildDiet();
  };

  World.prototype.rebuildDiet = function () {
    const S = this.species;
    for (const a of S) {
      a.preyLevels = new Set();
      for (const id of a.eats) {
        const b = S.find(s => s.id === id);
        if (b) a.preyLevels.add(b.level);
        const d = T.NPC_SPECIES.find(s => s.id === id) || T.EVENT_SPECIES[id];
        if (d) a.preyLevels.add(d.level);
      }
    }
    this.edible = S.map(a => S.map(b => this._canEat(a, b)));
    // Populations a predator can graze on (small prey it eats by the mouthful rather than chases one by one).
    this.popPrey = S.map(a => S.filter(b => b.grid && this.edible[a.idx][b.idx]));
  };

  World.prototype._canEat = function (a, b) {
    return a !== b && a.level !== 'decomposer' && a.eats.includes(b.id);
  };

  // Individual-level check: species diet, plus juveniles of bigger species of a level it hunts are fair game.
  World.prototype.canHunt = function (e, o) {
    if (e === o || !e.alive || !o.alive) return false;
    const a = e.sp, b = o.sp;
    if (this.edible[a.idx][b.idx]) return true;
    if (o.grow >= 1 || a === b || a.level === 'decomposer' || !e.st.canMeat) return false;
    return a.preyLevels.has(b.level) && o.st.mass <= e.st.mass * 1.5;
  };

  // ---------- terrain ----------

  World.prototype._generateTerrain = function () {
    const rng = this.rng;
    // Noise cells scale with the map, so lakes, woods and wet ground keep their size in tiles.
    const k = N / 64, cells = c => Math.max(2, Math.round(c * k));
    const nE1 = makeNoise(rng, cells(4)), nE2 = makeNoise(rng, cells(9)), nM = makeNoise(rng, cells(5));
    const nWood = makeNoise(rng, cells(6)), nTall = makeNoise(rng, cells(8)), nVine = makeNoise(rng, cells(7));
    const elevs = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const e = 0.72 * nE1(x, y) + 0.28 * nE2(x, y);
      this.elev[i] = e;
      elevs.push(e);
    }
    elevs.sort((a, b) => a - b);
    const waterLine = elevs[Math.floor(elevs.length * this.biome.water)];
    this.waterLine = waterLine;
    for (let i = 0; i < NT; i++) {
      const x = i % N, y = (i / N) | 0;
      this.terrain[i] = this.elev[i] < waterLine ? 1 : 0;
      this.moist[i] = clamp(0.55 * nM(x, y) + 0.45 * (1 - (this.elev[i] - waterLine) * 2.2), 0, 1);
    }
    const byKind = {};
    this.producers.forEach(p => { if (p) (byKind[p.kind] = byKind[p.kind] || []).push(p); });
    const choose = (kind, m) => {
      const list = byKind[kind];
      if (!list) return null;
      if (list.length > 1 && list.some(p => p.share != null)) {
        // Catalog worlds: several species of a kind share its tiles, by their starting share and moisture fit.
        const ws = list.map(p => (p.share == null ? 1 : p.share) * Math.exp(-8 * Math.pow((p.moist == null ? 0.5 : p.moist) - m, 2)));
        let r = rng.next() * ws.reduce((a, b) => a + b, 0), k = 0;
        while (k < list.length - 1 && (r -= ws[k]) > 0) k++;
        return list[k];
      }
      let best = list[0], bd = Infinity;
      for (const p of list) { const d = Math.abs((p.moist == null ? 0.5 : p.moist) - m); if (d < bd) { bd = d; best = p; } }
      return best;
    };
    const nearWater = (x, y, r) => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < N && yy < N && this.terrain[yy * N + xx] === 1) return true;
      }
      return false;
    };
    const ground = byKind.ground ? 'ground' : Object.keys(byKind).find(k => k !== 'aquatic' && k !== 'plankton') || 'ground';
    const shallowLine = waterLine - 0.04;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, m = this.moist[i];
      this.nutr[i] = clamp(B.nutrientStart + rng.range(-0.15, 0.15), 0.2, 1);
      let P = null;
      if (this.terrain[i] === 1) {
        // Phytoplankton fills open water; rooted aquatic mats keep the shallows.
        if (byKind.plankton && !(byKind.aquatic && this.elev[i] > shallowLine)) P = choose('plankton', m);
        else if (byKind.aquatic && rng.chance(0.8)) P = choose('aquatic', m);
      } else {
        let kind = ground;
        if (byKind.woody && nWood(x, y) > 0.66) kind = 'woody';
        else if (byKind.tall && ((nearWater(x, y, 2) && rng.chance(0.65)) || nTall(x, y) > 0.74)) kind = 'tall';
        else if (byKind.vine && nVine(x, y) > 0.64) kind = 'vine';
        P = choose(kind, m) || choose(ground, m);
      }
      if (!P) { this.ptype[i] = 0; continue; }
      this.ptype[i] = P.idx;
      this.pE[i] = P.max * rng.range(0.45, 0.8);
      // Last season's seeds and dried fruit carry seed-eaters through to this year's flowering (catalog worlds).
      if (P.fruit && P.catalogKey) this.fruit[i] = rng.range(10, 40);
      this.pgGrowth[i] = clamp(1 + rng.gauss() * 0.05, 0.6, 1.4);
      this.pgTough[i] = clamp((P.tough || 0.3) + rng.gauss() * 0.1, 0, 3);
      this.pgTol[i] = clamp(0.5 * (P.moist == null ? 0.5 : P.moist) + 0.5 * m + rng.gauss() * 0.05, 0, 1);
    }
    this._computeShade();
    this.waterTiles = 0;
    for (let i = 0; i < NT; i++) this.waterTiles += this.terrain[i];
  };

  World.prototype._computeShade = function () {
    const H = i => (this.ptype[i] ? this.producers[this.ptype[i]].height || 0 : 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const h = H(i);
      let shade = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const hj = H(yy * N + xx);
        if (hj > h) shade += 0.05 * (hj - h);
      }
      let f = 1 - Math.min(B.canopyShade, shade);
      if (this.terrain[i] === 1) f *= B.waterLight;
      this.shade[i] = f;
    }
  };

  World.prototype.isWater = function (x, y) {
    const tx = x | 0, ty = y | 0;
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return false;
    return this.terrain[ty * N + tx] === 1;
  };

  World.prototype.isCover = function (x, y) {
    const i = (y | 0) * N + (x | 0);
    const t = this.ptype[i];
    if (!t) return false;
    const P = this.producers[t];
    return (P.height || 0) >= 2 && this.pE[i] > P.max * 0.3;
  };

  // A random point near (cx, cy): on land, or in water when wantWater is set (swimmers).
  World.prototype._randomLand = function (cx, cy, r, wantWater) {
    const want = !!wantWater;
    for (let k = 0; k < 30; k++) {
      const x = clamp(cx + this.rng.range(-r, r), 0.5, N - 0.5), y = clamp(cy + this.rng.range(-r, r), 0.5, N - 0.5);
      if (this.isWater(x, y) === want) return [x, y];
    }
    return [clamp(cx, 0.5, N - 0.5), clamp(cy, 0.5, N - 0.5)];
  };

  World.prototype._populate = function () {
    for (const sp of this.species) {
      if (sp.grid) this._seedPopulation(sp, sp.startPop);
      else this.spawnGroup(sp, sp.startPop, null);
    }
  };

  // Founders: individuals of the species at random ages.
  World.prototype.spawnGroup = function (sp, count, center, opts) {
    opts = opts || {};
    const rng = this.rng;
    let left = count;
    const spawned = [];
    while (left > 0) {
      let size = 1;
      if (sp.herdSize) size = Math.min(left, sp.herdSize[0] + rng.int(sp.herdSize[1] - sp.herdSize[0] + 1));
      else size = Math.min(left, 1 + rng.int(3));
      const wet = sp.stats.swim;
      const c = center ? this._randomLand(center[0], center[1], 3, wet) : this._randomLand(N / 2, N / 2, N / 2 - 2, wet);
      for (let k = 0; k < size; k++) {
        const p = this._randomLand(c[0], c[1], 2, wet);
        const e = this.spawn(sp, p[0], p[1], 0, sp.genome, { grow: 1 });
        e.E = e.st.maxE * (opts.energy || rng.range(0.5, 0.75));
        e.age = Math.floor(rng.range(0, 0.3) * e.life);
        if (sp.flags.territorial) e.home = [c[0], c[1]];
        spawned.push(e);
      }
      left -= size;
    }
    return spawned;
  };

  World.prototype.spawn = function (sp, x, y, E, g, opts) {
    opts = opts || {};
    const grow = opts.grow == null ? 1 : opts.grow;
    const st = T.deriveStats(sp, g, grow);
    const e = {
      id: this.nextId++, num: ++sp.counter, sp, g, st, grow, growStep: Math.floor(grow * 10),
      x, y, px: x, py: y, hx: 1, hy: 0, E, hp: st.maxHp,
      tissue: opts.tissue != null ? opts.tissue : st.tissueAdult * grow,
      // Nitrogen: in body tissue (protein) and a small store of assimilated N; energy reserves hold none.
      nT: opts.nT != null ? opts.nT : (opts.tissue != null ? opts.tissue : st.tissueAdult * grow) * B.nitrogen.animal, nS: 0,
      state: 'wander', tk: 0, ti: -1, te: null, tc: null, food: null, threat: null,
      wx: x, wy: y, think: this.rng.int(B.decisionInterval), breedCd: grow >= 1 ? this.rng.int(st.breedCd + 1) : st.breedCd,
      attackCd: 0, chase: 0, fightT: 0, venomT: 0, venomDmg: 0, venomBy: -1, moveFrac: 0,
      hideT: 0, home: null, alive: true, born: this.t, age: 0,
      life: Math.round(st.lifeTicks * this.rng.range(0.85, 1.15)),
      parents: opts.parents || null, offspring: 0, mem: null,
      sex: opts.sex || (this.rng.next() < 0.5 ? 'F' : 'M'), pair: null, terr: false, emigrating: null, para: 0,
    };
    this.ents.push(e);
    return e;
  };

  World.prototype._restat = function (e) {
    const old = e.st;
    e.st = T.deriveStats(e.sp, e.g, e.grow);
    if (old && old.maxHp > 0) e.hp = Math.min(e.st.maxHp, e.hp * e.st.maxHp / old.maxHp);
    if (e.E > e.st.maxE) {
      const x = e.E - e.st.maxE, rs = this.rstats[e.sp.idx];
      e.E -= x;
      this.ledger.heat += x;
      if (rs) rs.upkeepHeat += x;
    }
  };

  // Re-derive stats for every individual of a species (after the player's orders change genomes).
  World.prototype.restatSpecies = function (sp) {
    for (const e of this.ents) if (e.alive && e.sp === sp) this._restat(e);
    this.updateMeans(sp);
  };

  // ---------- rounds ----------

  World.prototype._newRoundStats = function () {
    return {
      // eaten: by food name; eatenLv: by the trophic level it came from ('producer', a consumer level, 'detritus').
      // upkeepHeat is all metabolic respiration (thermoHeat is the thermoregulation share of it).
      eaten: {}, eatenLv: {}, assimLv: {}, ingested: 0, assimilated: 0, gain: 0, digestHeat: 0, excreted: 0, upkeepHeat: 0, thermoHeat: 0,
      predLoss: 0, starveLoss: 0, otherLoss: 0, births: 0, deaths: {}, kills: {},
      startPop: 0, startE: 0,
    };
  };

  World.prototype.beginRound = function (round) {
    this._checkPyramid();
    this._demographyRoundEnd();
    this._interactionsRoundEnd();
    if (round) this.round = round;
    this._cyclesBeginRound();
    this._successionBeginRound();
    this._interactionsBeginRound();
    this._stewardBeginRound();
    this._regionsBeginRound();
    this.roundTick = 0;
    this.seasonIdx = 0;
    if (this.round > 1) this.climate = clamp(this.climate + this.rng.range(-0.05, 0.05), 0.85, 1.15);
    this.updateMeans();
    const pops = this.countPops();
    this.rstats = this.species.map((sp, i) => {
      const r = this._newRoundStats(sp);
      r.startPop = pops.count[i];
      r.startE = pops.energy[i];
      return r;
    });
    this.pbook = this._newProducerBook();
    this.roundStartT = this.t;
    this.roundStartProducers = this.producerMeans();
    this._preySwitch();
    this.history = { t: [], pops: [] };
    this._recordHistory();
    this.loading = false;
  };

  // End-of-round assertion (every biome): energy fixed at each level must be below the level beneath it.
  // Numbers and biomass may invert and are only reported. The result stays on the world for the report and tools.
  // Energy is summed over the last 3 rounds, since the textbook's pyramid is flow over time. A level may still
  // out-fix the one beneath by as much as that lower level's standing stock shrank: a predator eating down stock
  // built up in earlier rounds (the last seal eating the last fish). Anything beyond that is a real violation.
  World.prototype._checkPyramid = function () {
    if (!T.Energy || !this.pbook || !this.rstats.length) return;
    const p = T.Energy.pyramids(this);
    this.lastPyramids = p;
    const stockEU = p.biomass.map(b => (b * this.N * this.N) / B.gramsPerEU);
    const hist = (this.energyHist = (this.energyHist || []).concat([{ energy: p.energy, stock: stockEU }]).slice(-4));
    const win = hist.slice(-3);
    const sum = p.energy.map((_, k) => win.reduce((a, h) => a + h.energy[k], 0));
    const before = hist.length > 3 ? hist[0].stock : null;   // stock at the start of the window, once there is one
    const violations = [];
    for (let k = 1; k < sum.length; k++) {
      const drawdown = before ? Math.max(0, before[k - 1] - stockEU[k - 1]) : 0;
      if (sum[k] > 0 && sum[k] >= sum[k - 1] + drawdown) violations.push(k);
    }
    this.pyramidCheck = { round: this.round, energy: sum, rounds: win.length, violations };
    if (violations.length) {
      this.pyramidViolations = (this.pyramidViolations || 0) + 1;
      if (this.debug) console.warn('[pyramid] energy did not narrow at ' + violations.map(k => p.levels[k].name).join(', ') + ' over rounds ending ' + this.round, sum);
    }
  };

  World.prototype.roundOver = function () { return this.roundTick >= B.roundTicks; };

  World.prototype.countPops = function () {
    const S = this.species.length;
    const count = new Array(S).fill(0), energy = new Array(S).fill(0);
    for (const e of this.ents) if (e.alive) { count[e.sp.idx]++; energy[e.sp.idx] += e.E + e.tissue; }
    for (const sp of this.species) if (sp.grid) { count[sp.idx] += Math.round(sp.grid.total); energy[sp.idx] += this.popEnergy(sp); }
    return { count, energy };
  };

  World.prototype.producerBiomass = function () {
    let s = 0;
    for (let i = 0; i < NT; i++) s += this.pE[i] + this.fruit[i];
    return s;
  };

  // Individual plants on the map: each tile holds its kind's perTile count once its standing crop reaches
  // plantFullAt of the producer's max, fewer when grazed down (the numbers pyramid's bottom row).
  World.prototype.plantCount = function () {
    const full = B.plantFullAt;
    let n = 0;
    for (let i = 0; i < NT; i++) {
      const t = this.ptype[i];
      if (!t) continue;
      const P = this.producers[t];
      const kind = T.PRODUCER_KINDS[P.kind];
      n += (kind ? kind.perTile : 1) * Math.min(1, this.pE[i] / (full * P.max));
    }
    return n;
  };

  // Mean tile genes and biomass per producer type.
  World.prototype.producerMeans = function () {
    const out = this.producers.map(() => ({ n: 0, growth: 0, tough: 0, tol: 0, biomass: 0 }));
    for (let i = 0; i < NT; i++) {
      const t = this.ptype[i];
      if (!t) continue;
      const o = out[t];
      o.n++; o.growth += this.pgGrowth[i]; o.tough += this.pgTough[i]; o.tol += this.pgTol[i]; o.biomass += this.pE[i];
    }
    for (const o of out) if (o.n) { o.growth /= o.n; o.tough /= o.n; o.tol /= o.n; }
    return out;
  };

  World.prototype.pyramid = function () {
    const lv = { producer: this.producerBiomass(), herbivore: 0, omnivore: 0, carnivore1: 0, carnivore2: 0, decomposer: 0 };
    for (const e of this.ents) if (e.alive) lv[e.sp.level] += e.E + e.tissue;
    return { levels: lv };
  };

  World.prototype._recordHistory = function () {
    this.history.t.push(this.roundTick);
    this.history.pops.push(this.countPops().count);
  };

  // Predators whose listed prey have all crashed start hunting the next-best species of the same level.
  World.prototype._preySwitch = function () {
    const pops = this.countPops().count;
    for (const a of this.species) {
      if (a.level === 'decomposer' || !a.stats.canMeat || pops[a.idx] === 0) continue;
      const prey = a.eats.map(id => this.speciesById(id)).filter(Boolean);
      if (!prey.length) continue;
      const ok = prey.some(b => pops[b.idx] >= B.preySwitchFrac * Math.max(1, b.initialPop || b.startPop));
      if (ok) continue;
      let best = null, bn = 0;
      for (const b of this.species) {
        if (b === a || b.level === 'decomposer' || b.level === 'producer' || a.eats.includes(b.id) || b.transient) continue;
        if (!a.preyLevels.has(b.level) || b.stats.mass > a.stats.mass * 1.5) continue;
        if (pops[b.idx] > bn) { bn = pops[b.idx]; best = b; }
      }
      if (best) {
        a.eats.push(best.id);
        this.notes.push(a.name + ' switched to hunting ' + best.name + ' after its prey crashed.');
      }
    }
    this.rebuildDiet();
  };

  // ---------- spatial hash ----------

  World.prototype._rebuildGrid = function () {
    for (const c of this.cells) c.length = 0;
    const pc = this.popCount;
    for (let i = 0; i < pc.length; i++) pc[i] = 0;
    for (const e of this.ents) {
      if (!e.alive) continue;
      pc[e.sp.idx]++;
      const cx = clamp((e.x / CELL) | 0, 0, CN - 1), cy = clamp((e.y / CELL) | 0, 0, CN - 1);
      this.cells[cy * CN + cx].push(e);
    }
    for (const sp of this.species) if (sp.grid) pc[sp.idx] += Math.round(sp.grid.total);
  };

  World.prototype.query = function (x, y, r, fn) {
    const r2 = r * r;
    const x0 = clamp(((x - r) / CELL) | 0, 0, CN - 1), x1 = clamp(((x + r) / CELL) | 0, 0, CN - 1);
    const y0 = clamp(((y - r) / CELL) | 0, 0, CN - 1), y1 = clamp(((y + r) / CELL) | 0, 0, CN - 1);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const cell = this.cells[cy * CN + cx];
      for (let k = 0; k < cell.length; k++) {
        const o = cell[k];
        if (!o.alive) continue;
        const dx = o.x - x, dy = o.y - y, d2 = dx * dx + dy * dy;
        if (d2 <= r2) fn(o, d2);
      }
    }
  };

  // ---------- tick ----------

  World.prototype.tick = function () {
    if (!this.reach || this.reach.length !== this.species.length) this._interactionsRefresh();
    this.t++;
    this.roundTick++;
    this.seasonIdx = Math.min(3, Math.floor(this.roundTick / (B.roundTicks / 4)));
    this.lightFrac = this.seasonLight(this.seasonIdx) * this.biomeLight * this.eventLight * this.climate;
    this.airTemp = this.seasonTemp(this.seasonIdx);
    this.thermoDT = Math.max(0, B.bodyTemp - this.airTemp) * this.mode.thermoScale * this.insulation;
    this._ectoPerf();

    this._photosynthesis();
    this._rebuildGrid();
    const ents = this.ents;
    for (let k = 0; k < ents.length; k++) this._upkeep(ents[k]);
    for (let k = 0; k < ents.length; k++) {
      const e = ents[k];
      if (!e.alive) continue;
      if (--e.think <= 0) { e.think = B.decisionInterval; this._decide(e); }
    }
    for (let k = 0; k < ents.length; k++) if (ents[k].alive) this._move(ents[k]);
    for (let k = 0; k < ents.length; k++) if (ents[k].alive) this._act(ents[k]);
    const n0 = ents.length;
    for (let k = 0; k < n0; k++) if (ents[k].alive) this._reproduce(ents[k]);
    this._decay();
    this._cyclesTick();
    this._successionTick();
    this._interactionsTick();
    this._stewardTick();
    this._updatePopulations();
    this._demographyTick();
    this._groundwater();

    if (this.ents.some(e => !e.alive)) this.ents = this.ents.filter(e => e.alive);
    if (this.carrion.some(c => !c.alive)) this.carrion = this.carrion.filter(c => c.alive);

    for (const k in this.flow) { this.flow[k] = this.flow[k] * 0.95 + this._flowAcc[k] * 0.05; this._flowAcc[k] = 0; }
    if (this.roundTick % 20 === 0) this._recordHistory();
    if (this.debug || this.t % 50 === 0) this.checkLedger();
    if (this.events.length > 600) this.events.splice(0, this.events.length - 600);
  };

  World.prototype.seasonLight = function (i) {
    return i === 3 ? this.biome.winter : B.seasons[i].light;
  };

  // GPP and NPP are booked separately per producer type: GPP is light captured, plant respiration
  // leaves as heat, NPP is what's stored. Standing crop turns over as litter into detritus.
  World.prototype._photosynthesis = function () {
    const L0 = B.sunlightPerTile * this.lightFrac * this.mode.sunMult;
    const C = this.mode.C_photo, floor = B.leafFloor;
    const litterRate = B.litterRate;
    const fruiting = this.seasonIdx <= 1;
    const book = this.pbook, cb = this.cbook, NB = B.nitrogen;
    let captured = 0, heat = 0, stored = 0;
    // Half the tiles grow each tick, with a two-tick step (the map is large; plants change slowly).
    const dt = 2;
    for (let i = this.t % dt; i < NT; i += dt) {
      const t = this.ptype[i];
      if (!t) continue;
      const P = this.producers[t];
      const nP = P.nContent;
      const R = P.resp == null ? B.R_plant : P.resp;
      const gg = this.pgGrowth[i], tough = this.pgTough[i];
      const max = P.max * (1.25 - 0.25 * gg);
      let e = this.pE[i];
      if (litterRate > 0 && e > 0) {
        // Litterfall: old leaves and stems drop, so a stand at its cap keeps producing to replace them.
        const lit = Math.min(e, (e * litterRate + (e > max ? (e - max) * 0.01 : 0)) * dt);
        e -= lit;
        this.pE[i] = e;
        this.detr[i] += lit;
        this.detrN[i] += lit * nP;
        book.litter[t] += lit;
      }
      if (e >= max) continue;
      let leaf = floor + (1 - floor) * Math.min(1, e / P.max);
      if (this.regrow[i] > 0) { this.regrow[i] = Math.max(0, this.regrow[i] - dt); leaf *= 0.3; }
      // Moisture fit (soil water from the water budget) and the producer's temperature envelope.
      const fit = (1 - 0.4 * Math.abs(this.moist[i] - this.pgTol[i])) * this.envFit[t][(i / N) | 0];
      let cap = L0 * this.shade[i] * C * leaf * P.leaf * this.growthMod * gg * fit * (1 - 0.05 * tough) * dt;
      // Legumes feed their root-nodule bacteria part of their production in exchange for fixed nitrogen.
      const cost = P.fixer ? NB.legumeCost : 0;
      // Only the edible share of NPP (leaf and fruit) joins the grazeable standing crop. Stems, roots and wood
      // turn over as litter, which is most of why herbivores harvest only 5–30% of NPP.
      const ed = P.edible == null ? B.edibleDefault : P.edible;
      let npp = cap * (1 - R) * (1 - cost), store = npp * ed;
      if (e + store > max) { store = max - e; npp = store / ed; cap = npp / ((1 - R) * (1 - cost)); }
      // Nitrogen: each EU of growth needs N at the producer's C:N ratio. Plants draw 80% of it as nitrate and
      // 20% as ammonia, and stop growing when the soil runs out. Legumes use soil N when it's there and have their
      // nodule bacteria fix the shortfall, plus a little extra that leaks to the soil as ammonia.
      const need = npp * nP;
      cb.tileTicks += dt;
      if (P.fixer) {
        const fromSoil = Math.min(need, this.no3[i] + this.nh4[i]);
        this._drawSoilN(i, fromSoil);
        const short = need - fromSoil;
        const fixed = short + (npp / (1 - cost)) * NB.legumeLeak;
        this.nledger.air += fixed; cb.fixLegume += fixed; this.cumCycles.fixed += fixed;
        if (fixed > short) this._spreadAmmonia(i, fixed - short);
      } else if (need > 0) {
        const avail = this.no3[i] + this.nh4[i];
        if (avail < need) {
          const k = avail / need;
          npp *= k; store *= k; cap *= k;
          cb.nLimitedTicks += dt;
        }
        this._drawSoilN(i, npp * nP);
      }
      const structure = npp - store;
      captured += cap;
      heat += cap - npp;
      book.gpp[t] += cap;
      book.resp[t] += cap - npp;
      book.npp[t] += npp;
      if (structure > 0) { this.detr[i] += structure; this.detrN[i] += structure * nP; book.litter[t] += structure; }
      if (P.fruit && fruiting && this.fruit[i] < 80) {
        const f = store * B.fruitShare;
        // Obligate mutualism: without its pollinator nearby, the plant sets no fruit (the growth stays in leaves).
        if (this.pollinated(i, P)) { this.fruit[i] += f; store -= f; }
        else book.unpollinated[t] += f;
      }
      this.pE[i] = e + store;
      stored += npp;
    }
    this.ledger.captured += captured;
    this.cumulative.captured += captured;
    this.capturedTick = captured;
    this.ledger.heat += heat;
    cb.absorbed += captured;   // carbon: each EU of GPP draws its carbon from the air
    this._flowAcc.producer += stored;
  };

  // Plant uptake: nitrate first (80% of the need), ammonia for the rest, either pool if one runs short.
  World.prototype._drawSoilN = function (i, need) {
    if (need <= 0) return;
    const a = Math.min(this.no3[i], need * B.nitrogen.nitrateShare);
    this.no3[i] -= a;
    const b = Math.min(this.nh4[i], need - a);
    this.nh4[i] -= b;
    const rest = need - a - b;
    if (rest > 0) this.no3[i] -= Math.min(this.no3[i], rest);
  };

  // A legume's surplus fixed nitrogen: half to its own tile as ammonia, half shared with its four neighbours.
  World.prototype._spreadAmmonia = function (i, n) {
    const x = i % N, y = (i / N) | 0;
    let spread = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      this.nh4[yy * N + xx] += n * 0.125;
      spread += n * 0.125;
    }
    this.nh4[i] += n - spread;
  };

  World.prototype._upkeep = function (e) {
    if (!e.alive) return;
    const st = e.st, rs = this.rstats[e.sp.idx];
    let thermo = st.thermo * this.thermoDT;
    let U = st.basal + st.traitUp + st.basal * B.activityCost * e.moveFrac + thermo;
    if (st.hibernate && this.seasonIdx === 3) { thermo *= 0.3; U = (st.basal + st.traitUp) * 0.3 + thermo; }
    else if (st.ecto && this.ectoTorpid) U = (st.basal + st.traitUp) * 0.3;
    let mult = 1;
    if (e.grow >= 1) {   // juveniles pay for growth as tissue, not heat
      const matureAt = e.life * 0.3;
      if (e.age > matureAt) mult = 1 + B.agingUpkeep * ((e.age - matureAt) / B.roundTicks);
    }
    U *= mult;
    const pay = Math.min(U, e.E);
    e.E -= pay;
    this.ledger.heat += pay;
    rs.upkeepHeat += pay;
    if (thermo > 0) rs.thermoHeat += (pay * thermo * mult) / U;
    e.age++;
    if (e.grow < 1 && e.E > 0.3 * st.maxE) {
      const g1 = Math.min(1, e.grow + st.growRate);
      const build = st.tissueAdult * (g1 - e.grow);
      e.E -= build;
      e.tissue += build;
      const nb = Math.min(e.nS, build * B.nitrogen.animal);   // new tissue takes its protein from the N store
      e.nS -= nb; e.nT += nb;
      e.grow = g1;
      const step = Math.floor(e.grow * 10);
      if (step !== e.growStep || e.grow >= 1) { e.growStep = step; this._restat(e); }
    }
    if (e.venomT > 0) {
      e.venomT--;
      e.hp -= e.venomDmg;
      if (e.hp <= 0) { this._die(e, 'k', e.venomBy); return; }
    }
    if (e.hp < e.st.maxHp && e.E > 0.3 * e.st.maxE) {
      const h = Math.min(e.st.maxHp - e.hp, e.st.maxHp * B.healPerTick);
      const cost = h * B.healCost;
      e.E -= cost; e.hp += h;
      this.ledger.heat += cost;
      rs.upkeepHeat += cost;
    }
    if (e.hideT > 0) { e.hideT--; if (e.hideT === 0 && e.state === 'hide') e.state = 'wander'; }
    if (e.attackCd > 0) e.attackCd--;
    if (e.E <= 1e-9) this._die(e, 'starved', -1);
    else if (e.age >= e.life) this._die(e, 'old', -1);
  };

  World.prototype._detects = function (obs, tgt, d) {
    const ts = tgt.st;
    let camo = ts.camo;
    if (tgt.state === 'hide') camo += 0.4;
    if (tgt.hideT > 0 && ts.burrow > 0.2) camo += 0.9;
    if (ts.ambush > 0 && this.isCover(tgt.x, tgt.y)) camo += 0.4 * ts.ambush;
    if (obs.st.echo) camo *= 0.3;
    const chance = clamp(1 - camo, 0.03, 1) * (1 - 0.4 * d / obs.st.sight);
    return this.rng.next() < chance;
  };

  World.prototype._decide = function (e) {
    const sp = e.sp, st = e.st, rng = this.rng;
    if (e.hideT > 0) return;
    if (st.hibernate && this.seasonIdx === 3) { e.state = 'rest'; e.tk = 0; return; }
    if (st.ecto && this.ectoTorpid && e.state !== 'flee') { e.state = 'rest'; e.tk = 0; return; }
    if (sp.transient) { e.state = 'migrate'; e.tk = 4; return; }
    if (e.state === 'fight' && e.te && e.te.alive && e.fightT > 0) return;

    // --- threats ---
    const sight = st.sight;
    let threat = null, tDist = Infinity, joinFlee = null;
    this.query(e.x, e.y, sight, (o, d2) => {
      if (o === e) return;
      if (this.canHunt(o, e) && !this.tolerates(e, o)) {
        const d = Math.sqrt(d2);
        if (d < tDist && this._detects(e, o, d)) { threat = o; tDist = d; }
      } else if (st.herd > 0 && o.sp === sp && o.state === 'flee' && o.threat && d2 < 16) joinFlee = o;
    });
    if (!threat && joinFlee && joinFlee.threat.alive && rng.chance(0.3 + 0.17 * st.herd)) {
      threat = joinFlee.threat;
      tDist = Math.hypot(threat.x - e.x, threat.y - e.y);
    }
    e.threat = null;
    if (threat) {
      let fleeAt = sight * (1.3 - st.bold);
      if (st.pack > 0) {
        let mates = 0;
        this.query(e.x, e.y, 3, o => { if (o.sp === sp) mates++; });
        if (mates >= 3) fleeAt *= 0.5;
      }
      // Charge: a short defensive burst at close range, not a fight to the death.
      if (e.grow >= 1 && st.charge > 0.2 && threat.st.mass < st.mass * 1.2 && tDist < 2.5 && e.hp > 0.5 * st.maxHp && rng.chance(0.5 * st.charge)) {
        e.state = 'fight'; e.tk = 2; e.te = threat; e.fightT = 20; return;
      }
      if (tDist < fleeAt) {
        e.threat = threat; e.state = 'flee'; e.tk = 0;
        if (st.burrow > 0 && rng.chance(0.35 * st.burrow)) { e.hideT = 40; e.state = 'hide'; }
        return;
      }
    }

    const hunger = 1 - e.E / st.maxE;
    if (hunger > 0.05 && e.state === 'scavenge' && e.tc && e.tc.alive) return;
    // Commit to a chase in progress while the target stays in range.
    if (e.state === 'hunt' && e.te && e.te.alive && e.chase < B.chaseLimit &&
        Math.hypot(e.te.x - e.x, e.te.y - e.y) < sight * 1.2) return;
    if (hunger > 0.05 && e.state === 'graze' && this._tileFood(e) > 8) return;
    // Emigrants head for the map edge (and leave from it, in _demographyTick).
    if (e.emigrating) { e.state = 'migrate'; e.tk = 4; e.wx = e.emigrating[0]; e.wy = e.emigrating[1]; return; }
    // Ready to breed but no mate nearby: go and find one.
    // Females do the seeking, toward males (her pair partner first, for monogamous species).
    if (!sp.transient && !sp.flags.asexual && e.grow >= 1 && e.breedCd <= 0 && e.E >= this._breedThr(e) * st.maxE && e.sex === 'F') {
      let mate = null, md = Infinity;
      this.query(e.x, e.y, Math.max(10, sight * 1.5), (o, d2) => {
        if (o !== e && o.sp === sp && o.grow >= 1 && o.sex === 'M' && (o === e.pair ? (d2 = 0, true) : d2 < md)) { md = d2; mate = o; }
      });
      if (mate && md > B.mateRadius * B.mateRadius * 0.5) {
        e.state = 'seek'; e.tk = 4; e.wx = mate.x; e.wy = mate.y; return;
      }
    }
    // Cleaners go to parasitized hosts; commensal followers keep near their hosts.
    if (sp.flags.cleaner && hunger > 0.05) {
      const host = this._cleanerTarget(e);
      if (host && rng.chance(0.6)) { e.state = 'clean'; e.tk = 2; e.te = host; return; }
    }
    if (sp.hosts && hunger < 0.75 && rng.chance(0.5)) {
      const host = this._followTarget(e);
      if (host) {
        const d = Math.hypot(host.x - e.x, host.y - e.y), keep = sp.flags.follower === 'predator' ? 3.5 : 1.5;
        if (d > keep) { e.state = 'follow'; e.tk = 3; e.wx = host.x + rng.range(-1, 1); e.wy = host.y + rng.range(-1, 1); return; }
      }
    }
    if (hunger < 0.08) { this._wander(e); return; }

    // Filter-feeders don't hunt for food patches: they drift and strain whatever plankton the tile holds.
    if (st.filter) {
      const here = this.tileAt(e.x, e.y), pt = this.ptype[here];
      const food = pt && sp.foods.has(this.producers[pt].id) ? this.pE[here] - this.producers[pt].max * B.grazeFloor : 0;
      if (e.state !== 'filter' || Math.hypot(e.wx - e.x, e.wy - e.y) < 0.6 || food <= 1) {
        const p = this._randomLand(e.x, e.y, 3, st.swim);
        e.wx = p[0]; e.wy = p[1];
      }
      e.state = 'filter'; e.tk = 1;
      return;
    }

    let best = 0, bestKind = 0, bestTile = -1, bestEnt = null, bestCarr = null, bestFood = null;
    // Commensal followers forage near their host: food close to it scores higher, food far from it lower.
    const hostAt = sp.hosts ? this._followTarget(e) : null;
    const terrPen = (x, y) => (hostAt ? (Math.hypot(x - hostAt.x, y - hostAt.y) <= B.interactions.followNear ? 1.4 : 0.6) : 1);
    const foodMult = 1;

    if (st.pack > 0 && st.canMeat && hunger > 0.1) {
      let mateTgt = null;
      this.query(e.x, e.y, 6, o => { if (o !== e && o.sp === sp && o.state === 'hunt' && o.te && o.te.alive) mateTgt = o.te; });
      if (mateTgt && rng.chance((0.4 + 0.15 * st.pack) * (0.5 + st.cohesion * 0.5))) {
        if (e.te !== mateTgt) e.chase = 0;
        e.state = 'hunt'; e.tk = 2; e.te = mateTgt; return;
      }
    }

    // --- plants, fruit, detritus ---
    const decomposer = sp.level === 'decomposer';
    const fenced = this.exclosure && sp.stats.mass >= B.steward.fenceMass;   // exclosures keep out grazers and browsers (young too)
    if (sp.eatsPlants || sp.foods.has('fruit') || decomposer) {
      const r = decomposer ? 3 : Math.min(8, Math.ceil(sight));
      const cx = e.x | 0, cy = e.y | 0;
      const samples = decomposer ? 16 : 40;
      for (let k = -9; k < samples; k++) {
        let x, y;
        if (k < 0) { x = cx + ((k + 9) % 3) - 1; y = cy + (((k + 9) / 3) | 0) - 1; }
        else { x = cx + Math.round(rng.range(-r, r)); y = cy + Math.round(rng.range(-r, r)); }
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const i = y * N + x;
        if (st.swim && this.terrain[i] !== 1) continue;   // swimmers can't reach food on land
        const d = Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y);
        const div = 1 + d * 0.25;
        if (decomposer) {
          if (this.detr[i] > 3) {
            const s = Math.min(this.detr[i], 100) / div;
            if (s > best) { best = s; bestKind = 1; bestTile = i; bestFood = 'detr'; }
          }
          continue;
        }
        const t = this.ptype[i];
        if (fenced && this.exclosure[i]) continue;
        if (t && st.canPlants && sp.foods.has(this.producers[t].id)) {
          const P = this.producers[t];
          const avail = this.pE[i] - P.max * B.grazeFloor;
          if (avail > 8) {
            const h = this._handling(e, i);   // tough plants are less attractive: selection for toughness
            const s = (Math.min(avail, st.eatRate * 15) * st.plantA * h * foodMult * sp.feedMult[t] * terrPen(x, y)) / div;
            if (s > best) { best = s; bestKind = 1; bestTile = i; bestFood = 'plant'; }
          }
        }
        if (this.fruit[i] > 3 && sp.foods.has('fruit')) {
          const A = Math.min(0.95, st.plantA + B.fruitBonusA);
          const s = (Math.min(this.fruit[i], st.eatRate * 15) * A * foodMult * (t ? sp.feedMult[t] : 1) * terrPen(x, y)) / div;
          if (s > best) { best = s; bestKind = 1; bestTile = i; bestFood = 'fruit'; }
        }
      }
    }

    // --- carrion ---
    if (sp.foods.has('carrion') && this.carrion.length) {
      for (const c of this.carrion) {
        if (!c.alive) continue;
        const d = Math.hypot(c.x - e.x, c.y - e.y);
        if (d > sight) continue;
        const A = decomposer ? B.decomposerA : st.meatA;
        const s = (Math.min(c.E, st.eatRate * 15) * A * 1.2 * foodMult * terrPen(c.x, c.y)) / (1 + d * 0.5);
        if (s > best) { best = s; bestKind = 3; bestCarr = c; }
      }
    }

    // --- prey ---
    if (st.canMeat && e.hp > 0.3 * st.maxHp && hunger > 0.7 - st.aggr) {
      const huntMult = 1;
      const mem = e.mem;
      this.query(e.x, e.y, sight, (o, d2) => {
        if (!this.canHunt(e, o)) return;
        const d = Math.sqrt(d2);
        if (!this._detects(e, o, d)) return;
        const os = o.st;
        const catchP = clamp(st.speed / os.speed, 0.25, 1.4) * (o.state === 'flee' ? 0.7 : 1);
        const risk = 1 / (1 + os.reflect * 3 + (os.dmg * 0.5 * (1 - st.armor) * 6) / st.maxHp);
        const learned = mem && mem[o.sp.idx] >= 2 ? 1.1 : 1;
        // Type III response: predators pay less attention to rare prey, letting crashed prey recover.
        const np = this.popCount[o.sp.idx] || 0;
        const rarity = B.preyRarity > 0 ? np / (np + B.preyRarity) : 1;
        const s = (Math.min(o.E + os.maxE * 0.1, st.eatRate * 25) * st.meatA * catchP * risk * huntMult * learned * rarity * this.reachMult(sp, o.sp) * terrPen(o.x, o.y)) / (1 + d * 0.5);
        if (s > best) { best = s; bestKind = 2; bestEnt = o; }
      });
    }

    // --- Populations (swarms, schools of small prey, soil fauna): graze them where they're densest ---
    let bestPop = -1;
    const popPrey = this.popPrey && this.popPrey[sp.idx];
    if (st.canMeat && popPrey && popPrey.length) {
      const r = Math.min(8, Math.ceil(sight)), cx = e.x | 0, cy = e.y | 0;
      for (const b of popPrey) {
        const rarity = B.preyRarity > 0 ? b.grid.total / (b.grid.total + B.preyRarity) : 1;
        for (let k = 0; k < 14; k++) {
          const x = cx + Math.round(rng.range(-r, r)), y = cy + Math.round(rng.range(-r, r));
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          const i = y * N + x;
          if (st.swim && this.terrain[i] !== 1) continue;
          const food = this.popFoodAt(b, i);
          if (food < 5) continue;
          const d = Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y);
          const s = (Math.min(food, st.eatRate * 15) * st.meatA * rarity * foodMult * this.reachMult(sp, b) * terrPen(x, y)) / (1 + d * 0.25);
          if (s > best) { best = s; bestKind = 4; bestTile = i; bestPop = b.idx; }
        }
      }
    }

    if (bestKind === 1) { e.state = 'graze'; e.tk = 1; e.ti = bestTile; e.food = bestFood; }
    else if (bestKind === 4) { e.state = 'graze'; e.tk = 2; e.ti = bestTile; e.food = 'pop'; e.popSp = bestPop; }
    else if (bestKind === 3) { e.state = 'scavenge'; e.tk = 3; e.tc = bestCarr; }
    else if (bestKind === 2) { if (e.te !== bestEnt) e.chase = 0; e.state = 'hunt'; e.tk = 2; e.te = bestEnt; }
    else this._wander(e);
  };

  // Eat-rate multiplier for a tile: Ironbark handling for small eaters, and evolved plant toughness.
  World.prototype._handling = function (e, i) {
    const P = this.producers[this.ptype[i]];
    let h = P.kind === 'woody' && e.st.mass < 8 ? B.ironbarkHandling : 1;
    return h / (1 + 0.2 * this.pgTough[i]);
  };

  World.prototype._tileFood = function (e) {
    const i = e.ti;
    if (i < 0) return 0;
    if (e.food === 'detr') return this.detr[i];
    if (e.food === 'fruit') return this.fruit[i];
    if (e.food === 'pop') return this.popFoodAt(this.species[e.popSp], i);
    if (this.exclosure && this.exclosure[i] && e.sp.stats.mass >= B.steward.fenceMass) return 0;   // fenced off
    return this.ptype[i] ? this.pE[i] - this.producers[this.ptype[i]].max * B.grazeFloor : 0;
  };

  World.prototype._findTile = function (e, r, pred) {
    let best = -1, bd = Infinity;
    const cx = e.x | 0, cy = e.y | 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const i = y * N + x;
      if (!pred(i)) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  World.prototype._wander = function (e) {
    const sp = e.sp, st = e.st, rng = this.rng;
    const reached = Math.hypot(e.wx - e.x, e.wy - e.y) < 0.6;
    const was = e.state;
    e.state = 'wander'; e.tk = 4;
    if (!reached && was === 'wander' && !rng.chance(0.15)) return;
    let cx = e.x, cy = e.y, r = st.roam;
    if (e.home) { cx = e.home[0]; cy = e.home[1]; r = Math.max(6, st.roam); }
    else if ((st.herd > 0 || st.pack > 0) && st.cohesion > 0.05) {
      let sx = 0, sy = 0, n = 0;
      this.query(e.x, e.y, 6, o => { if (o.sp === sp) { sx += o.x; sy += o.y; n++; } });
      if (n > 1) { cx = lerp(e.x, sx / n, st.cohesion); cy = lerp(e.y, sy / n, st.cohesion); r = lerp(st.roam, 3, st.cohesion); }
    }
    const p = this._randomLand(cx, cy, r, st.swim);
    e.wx = p[0]; e.wy = p[1];
  };

  World.prototype._move = function (e) {
    e.px = e.x; e.py = e.y;
    const st = e.st;
    let spd = st.speed;
    if (e.E < B.starvationThreshold * st.maxE) spd *= 0.5;
    if (st.ecto) {
      if (this.ectoSlowAll) spd *= B.ectoColdSpeed;
      spd *= this.ectoPerf;
    }
    if (e.venomT > 0) spd *= 0.6;
    if (st.swim) { if (!this.isWater(e.x, e.y)) spd *= 0.3; }
    else if (!st.flight && this.isWater(e.x, e.y)) spd *= 0.5;
    let tx = e.x, ty = e.y, mult = 0, stop = 0;
    switch (e.state) {
      case 'flee': {
        const th = e.threat;
        if (th && th.alive) {
          let dx = e.x - th.x, dy = e.y - th.y;
          const d = Math.hypot(dx, dy) || 1;
          dx /= d; dy /= d;
          if (e.x < 2) dx += 0.8; if (e.x > N - 2) dx -= 0.8;
          if (e.y < 2) dy += 0.8; if (e.y > N - 2) dy -= 0.8;
          tx = e.x + dx * 3; ty = e.y + dy * 3; mult = 1.15;
        } else { e.state = 'wander'; e.think = 0; }
        break;
      }
      case 'hunt': case 'fight':
        // Predators sprint for the first seconds of a chase, then tire.
        if (e.te && e.te.alive) { tx = e.te.x; ty = e.te.y; mult = e.state === 'hunt' && e.chase < B.sprintTicks ? B.sprintMult : 1.05; stop = st.radius + e.te.st.radius; }
        break;
      case 'graze': tx = (e.ti % N) + 0.5; ty = ((e.ti / N) | 0) + 0.5; mult = 0.8; break;
      case 'scavenge': if (e.tc && e.tc.alive) { tx = e.tc.x; ty = e.tc.y; mult = 0.9; stop = 0.2; } break;
      case 'wander': tx = e.wx; ty = e.wy; mult = 0.45; break;
      case 'filter': tx = e.wx; ty = e.wy; mult = 0.35; break;
      case 'migrate': tx = e.wx; ty = e.wy; mult = 0.85; break;
      case 'seek': tx = e.wx; ty = e.wy; mult = 0.7; break;
      case 'follow': tx = e.wx; ty = e.wy; mult = 0.6; break;
      case 'clean': if (e.te && e.te.alive) { tx = e.te.x; ty = e.te.y; mult = 0.8; stop = e.st.radius + e.te.st.radius + 0.2; } break;
      case 'swarm': tx = e.wx; ty = e.wy; mult = 0.75; break;
      default: mult = 0;
    }
    if (e.sp.transient) { tx = N + 2; ty = e.y; mult = 0.85; }
    e.moveFrac = 0;
    if (mult <= 0) return;
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    const want = d - stop;
    if (want <= 0.01) return;
    const step = Math.min(spd * mult, want);
    e.x += (dx / d) * step;
    e.y += (dy / d) * step;
    e.hx = dx / d; e.hy = dy / d;
    this._trample(e, step);
    if (!e.sp.transient) { e.x = clamp(e.x, 0.1, N - 0.1); e.y = clamp(e.y, 0.1, N - 0.1); }
    // Swimmers can't haul out: a step onto land is undone and they turn back to open water.
    if (st.swim && !this.isWater(e.x, e.y) && this.isWater(e.px, e.py)) {
      e.x = e.px; e.y = e.py;
      const p = this._randomLand(e.x, e.y, 3, true);
      e.wx = p[0]; e.wy = p[1];
      if (e.state === 'graze' || e.state === 'wander' || e.state === 'filter') e.think = 0;
    }
    e.moveFrac = step / st.speed;
  };

  World.prototype._act = function (e) {
    const st = e.st;
    switch (e.state) {
      case 'clean': {
        const h = e.te;
        if (!h || !h.alive || h.para < 0.5) { e.state = 'wander'; e.te = null; e.think = 0; return; }
        if (Math.hypot(h.x - e.x, h.y - e.y) <= st.radius + h.st.radius + 0.4) { if (this._clean(e, h) <= 0) { e.state = 'wander'; e.think = 0; } }
        break;
      }
      case 'hunt': case 'fight': {
        const o = e.te;
        if (!o || !o.alive) { e.state = 'wander'; e.think = 0; return; }
        if (e.state === 'fight') { if (--e.fightT <= 0) { e.state = 'wander'; e.think = 0; return; } }
        else if (++e.chase > B.chaseLimit || e.hp < 0.25 * st.maxHp) { e.state = 'wander'; e.te = null; e.think = 0; return; }
        const reach = st.radius + o.st.radius + 0.25;
        if (Math.hypot(o.x - e.x, o.y - e.y) <= reach && e.attackCd <= 0) this._attack(e, o);
        break;
      }
      case 'graze': {
        const i = e.ti;
        if (e.food !== 'pop' && e.food !== 'detr' && this.exclosure && this.exclosure[i] && e.sp.stats.mass >= B.steward.fenceMass) { e.state = 'wander'; e.think = 0; return; }
        const cx = (i % N) + 0.5, cy = ((i / N) | 0) + 0.5;
        if (Math.hypot(cx - e.x, cy - e.y) > 0.45) {
          // Grazers crop as they walk: a half-rate bite from any plant they eat on the tile they're crossing.
          if (e.food === 'plant') this._grazeOnTheWay(e);
          return;
        }
        const room = st.maxE - e.E;
        if (room < 1) { e.state = 'rest'; e.think = 0; return; }
        if (e.food === 'pop') {
          const prey = this.species[e.popSp], A = st.meatA;
          // Commensal followers catch more of what their big host flushes as it walks.
          const host = this.flushBonus(e), flush = host >= 0 ? 1 + B.interactions.flushBonus : 1;
          const got = this._eatPopulation(e, prey, i, Math.min(st.eatRate * flush * (st.ecto ? this.ectoPerf : 1), room / A));
          if (got.amt <= 0.05) { e.think = 0; return; }
          if (host >= 0) this._commensalBook(e, got.amt * (flush - 1) / flush, host);
          this._digest(e, got.amt, A, 1, prey.name, i, prey.level, got.nIn);
          break;
        }
        if (e.food === 'detr') {
          const A = B.decomposerA, P = B.decomposerP;
          const amt = Math.min(st.eatRate * (st.ecto ? this.ectoPerf : 1), this.detr[i], room / (A * P));
          if (amt <= 0.01) { e.think = 0; return; }
          const nIn = this.detrN[i] * (amt / this.detr[i]);
          this.detr[i] -= amt;
          this.detrN[i] -= nIn;
          this._digest(e, amt, A, P, 'Detritus', i, 'detritus', nIn);
        } else if (e.food === 'fruit') {
          const A = Math.min(0.95, st.plantA + B.fruitBonusA);
          const amt = Math.min(st.eatRate * (st.ecto ? this.ectoPerf : 1), this.fruit[i], room / A);
          if (amt <= 0.01) { e.think = 0; return; }
          this.fruit[i] -= amt;
          this.pbook.eaten[this.ptype[i]] += amt;
          this._digest(e, amt, A, 1, 'Fruit', i, 'producer', amt * this.producers[this.ptype[i]].nContent);
        } else {
          const t = this.ptype[i];
          if (!t) { e.think = 0; return; }
          const P = this.producers[t];
          const avail = this.pE[i] - P.max * B.grazeFloor;
          const amt = Math.min(st.eatRate * this._handling(e, i) * (st.ecto ? this.ectoPerf : 1), avail, room / st.plantA);
          if (amt <= 0.5) { e.think = 0; return; }
          this.pE[i] -= amt;
          this.pbook.eaten[t] += amt;
          if (P.regrowDelay) this.regrow[i] = P.regrowDelay;
          this._digest(e, amt, st.plantA, 1, P.name, i, 'producer', amt * P.nContent);
        }
        break;
      }
      case 'filter': {
        // Strain plankton from the tile underfoot while drifting.
        const i = this.tileAt(e.x, e.y), t = this.ptype[i];
        if (!t || !e.sp.foods.has(this.producers[t].id)) return;
        const room = st.maxE - e.E;
        if (room < 1) { e.state = 'rest'; e.think = 0; return; }
        const P = this.producers[t];
        const avail = this.pE[i] - P.max * B.grazeFloor;
        const amt = Math.min(st.eatRate * (st.ecto ? this.ectoPerf : 1), avail, room / st.plantA);
        if (amt <= 0.05) return;
        this.pE[i] -= amt;
        this.pbook.eaten[t] += amt;
        this._digest(e, amt, st.plantA, 1, P.name, i, 'producer', amt * P.nContent);
        break;
      }
      case 'scavenge': {
        const c = e.tc;
        if (!c || !c.alive) { e.think = 0; e.state = 'wander'; return; }
        if (Math.hypot(c.x - e.x, c.y - e.y) > 0.5) return;
        const room = st.maxE - e.E;
        if (room < 1) { e.state = 'rest'; e.think = 0; return; }
        const dec = e.sp.level === 'decomposer';
        const A = dec ? B.decomposerA : st.meatA, P = dec ? B.decomposerP : 1;
        const amt = Math.min(st.eatRate * (st.ecto ? this.ectoPerf : 1), c.E, room / (A * P));
        const nIn = c.E > 0 ? c.N * (amt / c.E) : 0;
        c.E -= amt; c.N -= nIn;
        if (c.E < 0.5) { const ci = this.tileAt(c.x, c.y); this.detr[ci] += c.E; this.detrN[ci] += c.N; c.E = 0; c.N = 0; c.alive = false; }
        if (e.sp.hosts && c.by != null && e.sp.hosts.has(c.by)) this._commensalBook(e, amt, c.by);
        this._digest(e, amt, A, P, c.src || 'Carrion', this.tileAt(e.x, e.y), c.lv || 'carrion', nIn);
        break;
      }
    }
  };

  World.prototype._grazeOnTheWay = function (e) {
    const st = e.st, j = this.tileAt(e.x, e.y), t = this.ptype[j];
    if (!t || !e.sp.foods.has(this.producers[t].id) || (st.swim && this.terrain[j] !== 1)) return;
    if (this.exclosure && this.exclosure[j] && e.sp.stats.mass >= B.steward.fenceMass) return;
    const room = st.maxE - e.E;
    if (room < 1) return;
    const P = this.producers[t];
    const avail = this.pE[j] - P.max * B.grazeFloor;
    const amt = Math.min(0.5 * st.eatRate * this._handling(e, j) * (st.ecto ? this.ectoPerf : 1), avail, room / st.plantA);
    if (amt <= 0.5) return;
    this.pE[j] -= amt;
    this.pbook.eaten[t] += amt;
    this._digest(e, amt, st.plantA, 1, P.name, j, 'producer', amt * P.nContent);
  };

  World.prototype.tileAt = function (x, y) { return clamp(y | 0, 0, N - 1) * N + clamp(x | 0, 0, N - 1); };

  // Ingested food splits into egestion (feces to detritus) and assimilation. In Phase 3 (P = 1) the whole
  // assimilated share is kept and metabolism is charged later as upkeep; Phase 2 burned (1 − P) here.
  World.prototype._digest = function (e, amt, A, P, src, tile, srcLv, nIn) {
    const gain = amt * A * P, resp = amt * A * (1 - P), exc = amt * (1 - A);
    // Nitrogen follows the food: the egested share goes to the soil with the feces, the rest to the N store.
    if (nIn > 0) { this.detrN[tile] += nIn * (1 - A); this._takeN(e, nIn * A, tile); }
    e.E += gain;
    this.ledger.heat += resp;
    this.detr[tile] += exc;
    const rs = this.rstats[e.sp.idx];
    rs.eaten[src] = (rs.eaten[src] || 0) + amt;
    const lv = srcLv || 'other';
    rs.eatenLv[lv] = (rs.eatenLv[lv] || 0) + amt;
    rs.assimLv[lv] = (rs.assimLv[lv] || 0) + amt * A;
    rs.ingested += amt;
    rs.assimilated += amt * A;
    rs.gain += gain;
    rs.digestHeat += resp;
    rs.excreted += exc;
    this._flowAcc[e.sp.level] += gain;
    if (this.rng.chance(0.02)) this.events.push({ type: 'bite', x: e.x, y: e.y, meat: !this.plantNames.has(src) });
  };

  World.prototype._attack = function (e, o) {
    const st = e.st, os = o.st, rng = this.rng;
    e.attackCd = B.attackInterval;
    let dmg = st.dmg * (1 - os.armor);
    if (e.state === 'fight') dmg *= 0.4;   // defensive charges drive predators off more than they kill
    if (st.pack > 0) {
      let mates = 0;
      this.query(o.x, o.y, 2, m => { if (m !== e && m.sp === e.sp) mates++; });
      dmg *= 1 + 0.1 * st.pack * Math.min(mates, 4);
    }
    const unaware = o.state !== 'flee' && o.state !== 'fight';
    if (unaware && st.ambush > 0 && this.isCover(e.x, e.y)) dmg *= 1 + st.ambush;
    o.hp -= dmg;
    if (os.reflect > 0) e.hp -= dmg * os.reflect;
    if (st.venom > 0) { o.venomT = 40; o.venomDmg = 0.02 * st.dmg * st.venom; o.venomBy = e.sp.idx; }
    if (o.grow >= 1 && os.dmg > 0 && (os.charge > 0.2 || os.mass >= st.mass * 0.8)) {
      e.hp -= os.dmg * (0.25 + 0.35 * os.charge) * (1 - st.armor) * (rng.next() < 0.5 ? 1 : 0);
    }
    if (rng.chance(0.3)) this.events.push({ type: 'hit', x: o.x, y: o.y });
    if (o.hp <= 0) {
      const c = this._die(o, 'k', e.sp.idx);
      const ks = this.rstats[e.sp.idx].kills;
      ks[o.sp.id] = (ks[o.sp.id] || 0) + 1;
      e.mem = e.mem || {};
      e.mem[o.sp.idx] = (e.mem[o.sp.idx] || 0) + 1;
      if (c) { e.state = 'scavenge'; e.tk = 3; e.tc = c; e.te = null; }
      else { e.state = 'wander'; e.think = 0; }
    } else if (o.state !== 'fight' && o.state !== 'hide') {
      o.state = 'flee'; o.threat = e; o.think = B.decisionInterval;
    }
    if (e.hp <= 0) this._die(e, 'k', o.sp.idx);
  };

  World.prototype._die = function (e, cause, by) {
    if (!e.alive) return null;
    e.alive = false;
    if (e.terr) this._releaseTerritory(e);
    const rs = this.rstats[e.sp.idx];
    let key = cause;
    if (e.collared) (this.collarFates = this.collarFates || {})[e.id] = { cause, by: by >= 0 && cause === 'k' ? this.species[by].name : null, round: this.round, x: Math.round(e.x), y: Math.round(e.y) };
    if (cause === 'k') key = 'k:' + (by >= 0 ? this.species[by].id : 'unknown');
    else if (cause === 'starved') key = 'starved@' + B.seasons[this.seasonIdx].name;
    rs.deaths[key] = (rs.deaths[key] || 0) + 1;
    const body = e.E + e.tissue + e.para, bodyN = e.nT + e.nS;
    e.E = body; e.tissue = 0; e.nT = 0; e.nS = 0; e.para = 0;   // the carcass carries body tissue (and parasites) as well as reserves
    if (cause === 'starved') rs.starveLoss += e.E;
    else if (cause === 'k') rs.predLoss += e.E;
    else rs.otherLoss += e.E;
    this.events.push({ type: cause === 'k' ? 'kill' : 'death', x: e.x, y: e.y });
    let c = null;
    if (e.E > 0.5) {
      // A kill passes energy up the grazing chain at the prey's level; a body left by starvation, age or
      // disease feeds the detrital chain, like litter, whoever eats it.
      c = { id: this.nextId++, x: e.x, y: e.y, E: e.E, alive: true, src: e.sp.name, lv: cause === 'k' ? e.sp.level : 'carrion', mass: e.st.mass, N: bodyN, by: cause === 'k' ? by : null };
      this.carrion.push(c);
    } else {
      const i = this.tileAt(e.x, e.y);
      if (e.E > 0) this.detr[i] += e.E;
      this.detrN[i] += bodyN;
    }
    e.E = 0;
    return c;
  };

  // Breeding threshold for one individual: density dependence and the decomposer cap.
  World.prototype._breedThr = function (e) {
    const sp = e.sp;
    const n = this.popCount[sp.idx] || 0;
    if (sp.level === 'decomposer' && n >= B.decomposerCap * B.areaScale) return 2;
    let thr = B.breedingThreshold;
    const cap = B.maxConsumers * B.densityShare;
    if (n > cap) thr += (B.densityStep * (n - cap)) / (B.maxConsumers * 0.05);
    return thr;
  };

  World.prototype._reproduce = function (e) {
    if (e.breedCd > 0) { e.breedCd--; return; }
    const sp = e.sp, st = e.st;
    if (sp.transient || e.grow < 1) return;
    if ((this.t + e.id) % 5 !== 0) return;       // mate search every 0.5 s
    if (e.E < this._breedThr(e) * st.maxE) return;
    if (this.ents.length >= B.maxConsumers) return;
    // Two sexes and a mating system. Only females initiate; a territorial female needs a territory, and
    // explosive breeders need enough of their kind nearby (the Allee threshold).
    const sexed = !sp.flags.asexual;
    if (sexed && (e.sex !== 'F' || !this._canBreedHere(e))) return;
    const mono = sexed && sp.mating === 'monogamous';
    const R = B.mateRadius;
    let mate = null, ms = -1;
    // The initiating parent must pass the breeding threshold; a mate only needs to be in fair condition.
    if (!sp.flags.asexual) this.query(e.x, e.y, R, o => {
      if (o === e || o.sp !== sp || o.grow < 1) return;
      if (o.sex !== 'M') return;
      // Monogamous: her partner, or an unpaired male. Polygynous and explosive males mate again without a rest.
      if (mono && o !== e.pair && o.pair && o.pair.alive) return;
      if (mono && o.breedCd > 0) return;
      if (o.E < 0.5 * o.st.maxE) return;
      const s = o.E / o.st.maxE + (o === e.pair ? 5 : 0);
      if (s > ms) { ms = s; mate = o; }
    });
    let give;
    if (mate) {
      const ga = e.E * (B.offspringShare / 2), gb = mate.E * (B.offspringShare / 2);
      e.E -= ga; mate.E -= gb;
      give = ga + gb;
      if (mono) mate.breedCd = mate.st.breedCd;
      mate.offspring++;
      if (mono) { e.pair = mate; mate.pair = e; }
    } else if (sp.flags.asexual) {
      give = e.E * B.offspringShare;
      e.E -= give;
    } else {
      return;   // no male nearby: no breeding
    }
    e.breedCd = st.breedCd;
    e.offspring++;
    const tissue0 = st.tissueAdult * B.juvenileMass;
    const n = Math.max(1, Math.min(st.litter, Math.floor(give / (B.minYoungEnergy * st.maxE * B.juvenileMass + tissue0)))), each = give / n;
    const tissueEach = Math.min(tissue0, each * 0.6);
    // Newborns' tissue nitrogen comes from the parents' N stores.
    const nPool = e.nS + (mate ? mate.nS : 0);
    e.nS = 0; if (mate) mate.nS = 0;
    const nEach = Math.min(nPool / n, tissueEach * B.nitrogen.animal);
    e.nS += nPool - nEach * n;
    const rs = this.rstats[sp.idx];
    for (let k = 0; k < n; k++) {
      const p = this._randomLand(e.x, e.y, 0.8, st.swim);
      // The cowbird pattern: near an edge, a nest parasite's chick takes one place in the brood, raised on the host's energy.
      const par = k === 0 ? this._nestParasite(e) : null;
      if (par) {
        this.spawn(par, p[0], p[1], each - tissueEach, par.genome, { grow: B.juvenileMass, tissue: tissueEach, nT: nEach });
        this.rstats[par.idx].births++;
        continue;
      }
      const c = this.spawn(sp, p[0], p[1], each - tissueEach, sp.genome, { grow: B.juvenileMass, tissue: tissueEach, nT: nEach, parents: [e.num, mate ? mate.num : e.num] });
      c.hp = c.st.maxHp * c.st.youngHp;
      c.home = e.home;
      if (c.E > c.st.maxE) { this.detr[this.tileAt(c.x, c.y)] += c.E - c.st.maxE; c.E = c.st.maxE; }
    }
    rs.births += n;
    this.events.push({ type: 'birth', x: e.x, y: e.y });
  };

  World.prototype._decay = function () {
    for (const c of this.carrion) {
      if (!c.alive) continue;
      const i = this.tileAt(c.x, c.y);
      const d = c.E * B.carrionDecay, dn = c.N * B.carrionDecay;
      c.E -= d; c.N -= dn;
      this.detr[i] += d; this.detrN[i] += dn;
      if (c.E < 0.5) { this.detr[i] += c.E; this.detrN[i] += c.N; c.E = 0; c.N = 0; c.alive = false; }
    }
    // Soil microbes respire detritus and release its nitrogen as ammonia (ammonification). Their numbers ride on
    // the decomposer guild: with the guild gone, decomposition slows to a crawl and soil nitrogen drains away.
    let dec = 0;
    for (const sp of this.species) if (sp.level === 'decomposer') dec += this.popCount[sp.idx] || 0;
    const SB = B.soil, wet = B.water.waterlogged;
    const microbes = this.decompRef > 0 ? SB.microbeFloor + (1 - SB.microbeFloor) * Math.min(1, dec / this.decompRef) : 1;
    const warm = 0.3 + 0.7 * clamp(this.airTemp / 25, 0, 1.2);   // warming speeds decomposition
    const k0 = B.detritusDecay * microbes * warm;
    let heat = 0, peat = 0;
    for (let i = 0; i < NT; i++) {
      const dd = this.detr[i];
      if (dd <= 0) continue;
      // Waterlogged ground decomposes slowly, and part of what escapes decomposition becomes peat.
      const soggy = this.terrain[i] === 0 && this.sw[i] > wet;
      const d = dd * (soggy ? k0 * SB.peatSlow : k0);
      const dn = this.detrN[i] * (d / dd);
      this.detr[i] = dd - d;
      this.detrN[i] -= dn;
      this.nh4[i] += dn;
      if (soggy) { const pe = d * SB.peatShare; this.peat[i] += pe; peat += pe; heat += d - pe; }
      else heat += d;
    }
    this.ledger.heat += heat;
    this.cbook.peat += peat;
    this.cumCycles.peat += peat;
    for (const e of this.ents) {
      if (e.alive && e.sp.transient && e.x > N - 0.3) {
        e.alive = false;
        this.ledger.exported += e.E + e.tissue;
        this.nledger.exported += e.nT + e.nS;
        const rs = this.rstats[e.sp.idx];
        rs.deaths.emigrated = (rs.deaths.emigrated || 0) + 1;
        rs.otherLoss += e.E + e.tissue;
        e.E = 0; e.tissue = 0; e.nT = 0; e.nS = 0;
      }
    }
  };

  // ---------- energy ledger ----------

  World.prototype.totalPools = function () {
    let s = 0;
    for (let i = 0; i < NT; i++) s += this.pE[i] + this.fruit[i] + this.detr[i] + this.peat[i];
    for (const e of this.ents) if (e.alive) s += e.E + e.tissue + e.para;
    for (const c of this.carrion) if (c.alive) s += c.E;
    for (const sp of this.species) if (sp.grid) s += this.popEnergy(sp);
    return s;
  };

  World.prototype.checkLedger = function () {
    const L = this.ledger;
    const pools = this.totalPools();
    const expected = L.initial + L.captured + L.imported - L.exported - L.heat;
    const err = Math.abs(pools - expected) / Math.max(1, pools);
    L.lastErr = err;
    if (err > L.maxErr) L.maxErr = err;
    if (this.debug && err > 0.001) console.warn('[ledger] conservation error', (err * 100).toFixed(4) + '%', { pools, expected });
    return { pools, expected, err };
  };

  World.prototype.importSpecies = function (def, count, center, opts) {
    let sp = this.speciesById(def.id);
    if (!sp) { sp = this.addSpecies(def, false); sp.originRound = this.round; sp.arrival = true; }
    const spawned = this.spawnGroup(sp, count, center, opts);
    for (const e of spawned) { this.ledger.imported += e.E + e.tissue; this.nledger.imported += e.nT + e.nS; }
    if (!sp.initialPop) sp.initialPop = count;
    this.updateMeans(sp);
    return sp;
  };

  World.prototype.plague = function () {
    const pops = this.countPops().count;
    const bi = this.plagueTarget(pops);
    if (bi < 0) return null;
    const psp = this.species[bi];
    if (psp.grid) {
      // A Population loses 30% everywhere; the bodies go to detritus.
      const g = psp.grid, before = g.total;
      for (let i = 0; i < N * N; i++) {
        if (g.nJ[i] + g.nA[i] + g.nO[i] <= 0) continue;
        this._popBodiesToDetritus(psp, i, 0.3);
        g.nJ[i] *= 0.7; g.nA[i] *= 0.7; g.nO[i] *= 0.7;
      }
      this._popTotals(psp);
      const killed = Math.round(before) - Math.round(g.total);   // matches the rounded counts players see
      this.rstats[bi].deaths.plague = (this.rstats[bi].deaths.plague || 0) + killed;
      return { species: psp, killed };
    }
    const victims = this.ents.filter(e => e.alive && e.sp.idx === bi);
    const kill = Math.round(victims.length * 0.3);
    for (let k = 0; k < kill; k++) {
      const j = k + this.rng.int(victims.length - k);
      const tmp = victims[k]; victims[k] = victims[j]; victims[j] = tmp;
      this._die(victims[k], 'plague', -1);
    }
    this.ents = this.ents.filter(e => e.alive);
    return { species: this.species[bi], killed: kill };
  };

  // ---------- save / load ----------

  const r2 = v => Math.round(v * 100) / 100;
  const r3 = v => Math.round(v * 1000) / 1000;
  const spFields = ['id', 'name', 'level', 'archetype', 'archetypeName', 'base', 'eats', 'flags', 'startPop', 'initialPop', 'herdSize',
    'invasive', 'transient', 'domestic', 'originRound', 'hue', 'behavior', 'weakness', 'note', 'counter', 'extinctRound', 'arrival', 'meta', 'stratum', 'activity'];

  World.prototype.serialize = function () {
    const alive = this.ents.filter(e => e.alive);
    return {
      v: T.SAVE_VERSION, mode: this.mode.id, seed: this.seed, t: this.t, round: this.round, rng: this.rng.s, nextId: this.nextId,
      biome: this.biome, eventLight: this.eventLight, growthMod: this.growthMod, ectoSlowAll: this.ectoSlowAll, climate: this.climate,
      cumulative: this.cumulative, collarFates: this.collarFates || {},
      producers: this.producers.slice(1),
      species: this.species.map(s => {
        const o = {};
        for (const f of spFields) o[f] = s[f];
        o.genome = T.b64.encode(s.genome);
        return o;
      }),
      terrain: Array.from(this.terrain), ptype: Array.from(this.ptype),
      pE: Array.from(this.pE, r2), fruit: Array.from(this.fruit, r2), detr: Array.from(this.detr, r2),
      nutr: Array.from(this.nutr, r3), moist: Array.from(this.moist, r3), elev: Array.from(this.elev, r3),
      pgGrowth: Array.from(this.pgGrowth, r3), pgTough: Array.from(this.pgTough, r3), pgTol: Array.from(this.pgTol, r3),
      ents: alive.map(e => [e.sp.idx, r2(e.x), r2(e.y), r2(e.E), r2(e.hp), e.breedCd, e.home, r3(e.grow), e.age, e.life, e.num, e.offspring, e.parents, r2(e.tissue), r3(e.nT), r3(e.nS), e.sex, e.terr ? 1 : 0, e.id, r2(e.para), e.collared ? 1 : 0]),
      carrion: this.carrion.filter(c => c.alive).map(c => [r2(c.x), r2(c.y), r2(c.E), c.src, c.lv, r3(c.N)]),
      cycles: this._cyclesState(),
      demography: this._demographyState(),
      succession: this._successionState(),
      interactions: this._interactionsState(),
      steward: this._stewardState(),
      populations: Object.fromEntries(this.species.filter(sp => sp.grid).map(sp => [sp.idx, this._popState(sp)])),
    };
  };

  // Saves carry this version; any other is from an older game and isn't loaded (no migrations).
  T.SAVE_VERSION = 9;

  T.loadWorld = function (s, opts) {
    if (!s || s.v !== T.SAVE_VERSION) throw new Error('This save is from an older version of Keystone and cannot be loaded');
    const w = new World({ seed: s.seed, debug: opts && opts.debug, biome: s.biome, mode: s.mode });
    w.t = s.t; w.round = s.round || 1; w.rng.s = s.rng; w.nextId = s.nextId;
    w.eventLight = s.eventLight; w.growthMod = s.growthMod; w.ectoSlowAll = s.ectoSlowAll; w.climate = s.climate || 1;
    w.cumulative = s.cumulative; w.collarFates = s.collarFates;
    w.setProducers(s.producers);
    for (const d of s.species) {
      const def = Object.assign({}, d, { genome: T.b64.decode(d.genome) });
      const sp = w.addSpecies(def);
      for (const f of ['initialPop', 'counter', 'extinctRound', 'arrival']) if (d[f] != null) sp[f] = d[f];
    }
    w.terrain.set(s.terrain); w.ptype.set(s.ptype); w.pE.set(s.pE); w.fruit.set(s.fruit); w.detr.set(s.detr); w.nutr.set(s.nutr);
    w.moist.set(s.moist); w.elev.set(s.elev); w.pgGrowth.set(s.pgGrowth); w.pgTough.set(s.pgTough); w.pgTol.set(s.pgTol);
    w._computeShade();
    w._restoreCycles(s.cycles);
    w._successionRestore(s.succession);
    const idMap = {};
    s.ents.forEach(a => {
      const sp = w.species[a[0]];
      const counter = sp.counter;
      const e = w.spawn(sp, a[1], a[2], a[3], sp.genome, { grow: a[7], parents: a[12], tissue: a[13], nT: a[14] });
      e.nS = a[15]; e.sex = a[16]; e.terr = !!a[17]; e.para = a[19]; e.collared = !!a[20];
      idMap[a[18]] = e.id;
      sp.counter = counter;
      e.hp = a[4]; e.breedCd = a[5]; e.home = a[6]; e.age = a[8]; e.life = a[9]; e.num = a[10]; e.offspring = a[11];
    });
    for (const c of s.carrion) w.carrion.push({ id: w.nextId++, x: c[0], y: c[1], E: c[2], src: c[3], lv: c[4], N: c[5], alive: true });
    for (const k in s.populations) { const sp = w.species[+k]; if (sp) w._popRestore(sp, s.populations[k]); }
    w._demographyRestore(s.demography, idMap);
    w._interactionsRestore(s.interactions);
    w._stewardRestore(s.steward);
    w.loading = true;   // the beginRound below restarts the round; it doesn't end one
    w.updateRegions();
    w.updateMeans();
    w.ledger.initial = w.totalPools();
    w.nledger.initial = w.totalNitrogen();
    w.beginRound(w.round);
    return w;
  };

})(window.Trophic);
