// Keystone — Phase 3 demography (P3-M5): the regional pool, carrying capacity, growth curves, mating systems and
// territories. Each species' round is summarised with the textbook's equation N(t+1) = N + B + I − D − E and
// r = ((B + I) − (D + E)) ÷ N × 100, and compared against its own carrying capacity K.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const W = T.World.prototype;
  const clamp = T.util.clamp;
  const D = () => B.demography;

  // ---------- setup ----------

  // Mating system for a species: from its definition, or from its biology.
  function matingOf(sp) {
    if (sp.flags.asexual || sp.level === 'decomposer') return 'asexual';
    if (sp.mating) return sp.mating;
    const st = sp.stats;
    if (st.ecto) return 'explosive';                        // frogs, fish, insects: mass spawning
    if (st.flight || sp.flags.pack) return 'monogamous';     // most birds; wolves and other pack canids
    return 'polygynous';                                     // most mammals
  }

  // closed: no regional pool (no arrivals or departures), for measuring a closed system as the textbook does.
  W._initDemography = function (poolIds, closed) {
    this.closed = !!closed;
    const pool = new Set(poolIds || []);
    this.pool = {};
    for (const sp of this.species) this._poolEntry(sp, pool.has(sp.id));
    this.territories = {};
    this.demography = [];
  };

  // The regional pool behind the map edges: how healthy it is (0–1) and whether the species can arrive on its own.
  W._poolEntry = function (sp, poolOnly) {
    sp.mating = matingOf(sp);
    if (!this.pool[sp.id]) this.pool[sp.id] = { level: 1, poolOnly: !!poolOnly, regionallyExtinct: false };
    return this.pool[sp.id];
  };

  // ---------- every tick ----------

  W._demographyTick = function () {
    if (this.closed) return;
    const P = D();
    // Immigration from the regional pool: arrivals at the map edge, far more often when the species is scarce here.
    for (const sp of this.species) {
      if (sp.isPlayer || sp.transient || sp.invasive) continue;
      const pool = this.pool[sp.id] || this._poolEntry(sp, false);
      if (pool.poolOnly || pool.regionallyExtinct || pool.level <= 0) continue;
      const n = this.popCount[sp.idx] || 0, n0 = Math.max(2, sp.initialPop || sp.startPop || 2);
      const deficit = clamp(1 - n / n0, 0, 1);
      const rate = P.immigration * (sp.level === 'carnivore2' ? P.apexImmigration : 1) * pool.level * (1 + P.rescue * deficit);
      if (this.rng.next() < rate / B.roundTicks) this.immigrate(sp);
    }
    if (this.t % P.emigrationEvery === 0) this._emigration();
    // Emigrants that reach the edge leave the map.
    if (this.t % 5 === 0) for (const e of this.ents) {
      if (e.alive && e.emigrating && Math.hypot(e.x - e.emigrating[0], e.y - e.emigrating[1]) < 1) this._leaveMap(e);
    }
  };

  // The closest point on the map edge.
  W._nearEdge = function (e) {
    const N = this.N, d = [e.x, N - e.x, e.y, N - e.y], k = d.indexOf(Math.min(...d));
    return k === 0 ? [0.3, e.y] : k === 1 ? [N - 0.3, e.y] : k === 2 ? [e.x, 0.3] : [e.x, N - 0.3];
  };

  // A point on the map edge the species can arrive on (water for swimmers), or null.
  W._edgePoint = function (sp) {
    const N = this.N, swim = sp.stats.swim;
    for (let k = 0; k < 40; k++) {
      const side = this.rng.int(4), u = this.rng.range(1, N - 1);
      const x = side === 0 ? 0.6 : side === 1 ? N - 0.6 : u, y = side === 2 ? 0.6 : side === 3 ? N - 0.6 : u;
      if (this.isWater(x, y) === !!swim) return [x, y];
    }
    return null;
  };

  // Individuals (a small mixed-sex group) or a patch of a Population arrive at the edge from the regional pool.
  W.immigrate = function (sp, count) {
    const P = D(), rs = this.rstats[sp.idx];
    const at = this._edgePoint(sp);
    if (!at) return 0;
    if (sp.grid) {
      const n = count || P.popArrival;
      const i = this.tileAt(at[0], at[1]);
      const g = sp.grid, st = sp.stats, jm = B.juvenileMass;
      const tiles = [i];
      for (const j of [i - 1, i + 1, i - this.N, i + this.N]) if (j >= 0 && j < this.N * this.N && this.popSuitable(sp, j)) tiles.push(j);
      for (const j of tiles) {
        const a = (n * 0.7) / tiles.length, jv = (n * 0.3) / tiles.length;
        const tissue = st.tissueAdult * (a + jv * jm), E = st.maxE * 0.6 * (a + jv * jm), N2 = tissue * B.nitrogen.animal;
        g.nA[j] += a; g.nJ[j] += jv; g.Tt[j] += tissue; g.E[j] += E; g.Nn[j] += N2;
        this.ledger.imported += tissue + E; this.nledger.imported += N2;
      }
      T.popCount(sp, 'immig', n, rs, 'immig');
      this._popTotals(sp);
      return n;
    }
    // A few individuals at a time (dispersers, not whole herds), always both sexes.
    const size = count || P.groupSize[0] + this.rng.int(P.groupSize[1] - P.groupSize[0] + 1);
    let k = 0;
    for (; k < size; k++) {
      const p = this._randomLand(at[0], at[1], 1.5, sp.stats.swim);
      const g = T.sampleGenome(sp.genome, this.rng, B.founderSigma * 0.5);
      const e = this.spawn(sp, p[0], p[1], 0, g, { grow: 1, sex: k % 2 ? 'M' : 'F' });
      e.E = e.st.maxE * 0.6;
      e.age = Math.floor(this.rng.range(0.1, 0.3) * e.life);
      this.ledger.imported += e.E + e.tissue;
      this.nledger.imported += e.nT + e.nS;
    }
    rs.immig = (rs.immig || 0) + k;
    this.events.push({ type: 'birth', x: at[0], y: at[1], player: false });
    return k;
  };

  // The player brings a pool-only species (an extirpated apex predator, say) back: founders released at the edge.
  W.reintroduce = function (sp, count) {
    const pool = this.pool[sp.id] || this._poolEntry(sp, true);
    pool.regionallyExtinct = false;
    const n = this.immigrate(sp, count || D().reintroduce);
    if (n && !sp.initialPop) sp.initialPop = n;
    return n;
  };

  // Emigration: when a species passes 80% of its K, young adults head for the map edge and leave.
  W._emigration = function () {
    const P = D();
    for (const sp of this.species) {
      if (!sp.K || sp.isPlayer || sp.transient) continue;
      const n = this.popCount[sp.idx] || 0;
      const over = n / sp.K - P.emigrateAt;
      if (over <= 0) continue;
      const p = Math.min(P.emigrateMax, P.emigrateRate * over / (1 - P.emigrateAt));
      if (sp.grid) { this._popEmigrate(sp, p); continue; }
      for (const e of this.ents) {
        if (!e.alive || e.sp !== sp || e.grow < 1 || e.emigrating || e.terr || e.age > e.life * 0.5) continue;
        if (this.rng.next() < p) e.emigrating = this._nearEdge(e);
      }
    }
  };

  // Called from movement when an emigrant reaches the edge: it leaves the map with its energy and nitrogen.
  W._leaveMap = function (e) {
    e.alive = false;
    this.ledger.exported += e.E + e.tissue + e.para;
    this.nledger.exported += e.nT + e.nS;
    e.para = 0;
    const rs = this.rstats[e.sp.idx];
    rs.emig = (rs.emig || 0) + 1;
    rs.otherLoss += e.E + e.tissue;
    this._releaseTerritory(e);
    const pool = this.pool[e.sp.id];
    if (pool) pool.level = Math.min(1, pool.level + 0.01);   // emigrants join the regional population
    e.E = 0; e.tissue = 0; e.nT = 0; e.nS = 0;
  };

  // Populations send dispersers off the map from their edge tiles.
  W._popEmigrate = function (sp, p) {
    const g = sp.grid, N = this.N, rs = this.rstats[sp.idx];
    let gone = 0;
    for (let i = 0; i < N * N; i++) {
      const x = i % N, y = (i / N) | 0;
      if (x > 2 && y > 2 && x < N - 3 && y < N - 3) continue;
      const n = g.nJ[i] + g.nA[i] + g.nO[i];
      if (n <= 0) continue;
      const f = p * 0.5;
      this.ledger.exported += (g.E[i] + g.Tt[i]) * f;
      this.nledger.exported += g.Nn[i] * f;
      for (const k of ['nJ', 'nA', 'nO', 'E', 'Tt', 'Nn']) g[k][i] -= g[k][i] * f;
      gone += n * f;
    }
    this._popTotals(sp);
    if (gone > 0) T.popCount(sp, 'emig', gone, rs, 'emig');
  };

  // ---------- mating ----------

  // Whether this female may breed where she is: explosive breeders need company (the Allee threshold), and
  // territorial species need a territory of their own.
  W._canBreedHere = function (e) {
    const sp = e.sp, P = D();
    if (sp.mating === 'explosive') {
      let n = 0;
      this.query(e.x, e.y, P.alleeRadius, o => { if (o !== e && o.sp === sp && o.grow >= 1) n++; });
      if (n < P.alleeCount) return false;
    }
    // Interior specialists nest only in woodland 3 or more tiles from open ground.
    if (sp.flags.interior && !this.isInterior(this.tileAt(e.x, e.y))) return false;
    if (sp.flags.territorial && !e.terr) return this._claimTerritory(e);
    return true;
  };

  // Radius in tiles grows with body mass (kg from the catalog; game size units otherwise).
  W.territoryRadius = sp => clamp(2 + 1.5 * Math.sqrt(sp.meta && sp.meta.massKg ? sp.meta.massKg : sp.stats.mass * 0.1), 2, 10);

  // Claim a territory that doesn't overlap another of the same species; floaters without one can't breed.
  W._claimTerritory = function (e) {
    const sp = e.sp, r = this.territoryRadius(sp);
    const list = this.territories[sp.id] || (this.territories[sp.id] = []);
    for (let k = 0; k < 4; k++) {
      const p = k === 0 ? [e.x, e.y] : this._randomLand(e.x, e.y, r * 2, sp.stats.swim);
      if (list.some(t => Math.hypot(t.x - p[0], t.y - p[1]) < 2 * r)) continue;
      list.push({ x: p[0], y: p[1], owner: e.id });
      e.terr = true;
      e.home = [p[0], p[1]];
      return true;
    }
    return false;
  };

  W._releaseTerritory = function (e) {
    if (!e.terr) return;
    const list = this.territories[e.sp.id];
    if (list) { const k = list.findIndex(t => t.owner === e.id); if (k >= 0) list.splice(k, 1); }
    e.terr = false;
  };

  // ---------- round end: K, curves and the demography table ----------

  W._demographyRoundEnd = function () {
    if (this.loading) { this.loading = false; return; }
    if (this.roundStartT == null || this.t === this.roundStartT) return;   // no round has run yet
    if (!this.rstats.length || !this.pbook) return;
    const pops = this.countPops().count;
    const Ks = this._estimateK(pops);
    const rows = [];
    this.species.forEach((sp, i) => {
      const rs = this.rstats[i];
      if (!rs) return;
      const N0 = rs.startPop, N1 = pops[i];
      let Dd = 0;
      for (const k in rs.deaths) if (k !== 'emigrated') Dd += rs.deaths[k];
      const Bb = rs.births, I = rs.immig || 0, E = (rs.emig || 0) + (rs.deaths.emigrated || 0);
      if (Ks[i] != null) sp.K = sp.K ? 0.5 * sp.K + 0.5 * Ks[i] : Ks[i];
      const r = N0 > 0 ? ((Bb + I - (Dd + E)) / N0) * 100 : null;
      const curve = this._fitCurve(i, sp.K, N0, N1);
      sp.curve = curve;
      rows.push({ id: sp.id, name: sp.name, level: sp.level, population: !!sp.grid, N0, B: Bb, I, D: Dd, E, N1, r, K: sp.K ? Math.round(sp.K) : null, curve,
        balanced: sp.grid ? null : N0 + Bb + I - Dd - E === N1 });
    });
    this.demography = rows;
  };

  // K: the food energy available to the species over a round (its share of each food's production) times its
  // assimilation, divided by one individual's upkeep over the round.
  W._estimateK = function (pops) {
    const S = this.species, prod = {}, eatersOf = {};
    for (let t = 1; t < this.producers.length; t++) {
      const P = this.producers[t];
      const edible = P.edible == null ? B.edibleDefault : P.edible;
      prod[P.name] = this.pbook.npp[t] * edible * (P.fruit ? 1 - B.fruitShare * 0.5 : 1);
      if (P.fruit) prod.Fruit = (prod.Fruit || 0) + this.pbook.npp[t] * edible * B.fruitShare * 0.5;
    }
    let litter = 0, excreted = 0;
    for (let t = 1; t < this.producers.length; t++) litter += this.pbook.litter[t];
    const standingE = this.countPops().energy;
    S.forEach((sp, i) => {
      const rs = this.rstats[i];
      excreted += rs.excreted;
      // Prey: its new tissue this round, plus a fifth of its standing bodies (what predators can crop from stock).
      const standing = standingE[i] || 0;
      prod[sp.name] = Math.max(0, rs.assimilated - rs.upkeepHeat - rs.digestHeat) + 0.2 * standing;
    });
    prod.Detritus = litter + excreted;
    const total = {};
    S.forEach((sp, i) => { for (const k in this.rstats[i].eaten) total[k] = (total[k] || 0) + this.rstats[i].eaten[k]; });
    // Declared foods, by name, and how many species share each (for foods nobody ate this round).
    const nameOf = id => (id === 'fruit' ? 'Fruit' : id === 'detritus' ? 'Detritus' : (this.producerById(id) || this.speciesById(id) || {}).name);
    const foods = S.map(sp => [...new Set((sp.eats.length ? sp.eats : [...(sp.foods || [])]).map(nameOf).filter(Boolean))]);
    foods.forEach(list => list.forEach(f => (eatersOf[f] = (eatersOf[f] || 0) + 1)));
    return S.map((sp, i) => {
      if (sp.transient) return null;
      const rs = this.rstats[i], st = sp.stats;
      let avail = 0;
      for (const f of foods[i]) {
        const p = prod[f] || 0;
        if (!p) continue;
        // Its share of what was eaten; an equal share among its eaters if it ate nothing this round (absent or arriving).
        const share = total[f] > 0 && rs.ingested > 0 ? (rs.eaten[f] || 0) / total[f] : 1 / (eatersOf[f] || 1);
        const A = f === 'Detritus' ? B.decomposerA : this.plantNames.has(f) ? st.plantA : st.meatA;
        avail += p * share * A;
      }
      const meanN = (rs.startPop + pops[i]) / 2;
      const perInd = meanN >= 1 && rs.upkeepHeat > 0 ? rs.upkeepHeat / meanN
        : (st.basal + st.traitUp + st.thermo * 28) * B.roundTicks;
      return perInd > 0 ? avail / perInd : null;
    });
  };

  // Fit the round's counts to exponential and logistic growth and label the better fit (or an overshoot or decline).
  W._fitCurve = function (i, K, N0, N1) {
    if (N0 <= 0 && N1 <= 0) return 'absent';
    if (N0 <= 0) return 'recolonizing';
    if (K && N1 > 1.2 * K && N1 >= N0) return 'overshoot';
    if (N1 < 0.75 * N0) return 'declining';
    if (Math.abs(N1 - N0) <= Math.max(1, 0.1 * N0)) return 'stable';
    if (N1 < N0) return 'declining';
    const ts = this.history.t, ns = this.history.pops.map(row => row[i] || 0);
    const pts = ts.map((t, k) => [t, ns[k]]).filter(p => p[1] > 0);
    if (pts.length < 4 || !K || K <= N0) return 'exponential';
    // Exponential: least squares on ln N.
    const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + Math.log(p[1]), 0) / n;
    let sxy = 0, sxx = 0;
    for (const [t, v] of pts) { sxy += (t - mx) * (Math.log(v) - my); sxx += (t - mx) * (t - mx); }
    const r = sxx ? sxy / sxx : 0, a = my - r * mx;
    let sseExp = 0;
    for (const [t, v] of pts) sseExp += Math.pow(v - Math.exp(a + r * t), 2);
    // Logistic toward K: the best growth rate on a grid.
    const n0 = pts[0][1], t0 = pts[0][0];
    let sseLog = Infinity;
    for (let g = 1; g <= 40; g++) {
      const rr = g * 0.0005;
      let s = 0;
      for (const [t, v] of pts) { const m = K / (1 + ((K - n0) / n0) * Math.exp(-rr * (t - t0))); s += (v - m) * (v - m); }
      if (s < sseLog) sseLog = s;
    }
    return sseExp < sseLog * 0.9 ? 'exponential' : 'logistic';
  };

  // Juveniles, breeding adults and post-reproductive individuals (the Codex's age pyramid), by sex for individuals.
  W.ageStructure = function (sp) {
    if (sp.grid) { const a = this.popAges(sp); return { juvenile: [a.juvenile / 2, a.juvenile / 2], breeding: [a.breeding / 2, a.breeding / 2], post: [a.post / 2, a.post / 2] }; }
    const out = { juvenile: [0, 0], breeding: [0, 0], post: [0, 0] };
    for (const e of this.ents) {
      if (!e.alive || e.sp !== sp) continue;
      const k = e.sex === 'M' ? 0 : 1;
      const cls = e.grow < 1 ? 'juvenile' : e.age > e.life * B.populations.oldAt ? 'post' : 'breeding';
      out[cls][k]++;
    }
    return out;
  };

  // Disease strikes where density is highest relative to carrying capacity (N/K), not simply the most numerous.
  W.plagueTarget = function (pops) {
    let bi = -1, best = 0;
    this.species.forEach((s, i) => {
      if (s.transient || pops[i] < 2) return;
      const v = s.K ? pops[i] / s.K : pops[i] / 1e6;   // before any K is known, the most numerous
      if (v > best) { best = v; bi = i; }
    });
    return bi;
  };

  // ---------- saves ----------

  W._demographyState = function () {
    const terr = {};
    for (const id in this.territories) terr[id] = this.territories[id].map(t => [+t.x.toFixed(2), +t.y.toFixed(2), t.owner]);
    return { closed: this.closed, pool: this.pool, territories: terr, K: Object.fromEntries(this.species.map(sp => [sp.id, sp.K || 0])) };
  };
  W._demographyRestore = function (s, idMap) {
    this._initDemography([], s && s.closed);
    if (!s) return;
    if (s.pool) this.pool = s.pool;
    for (const sp of this.species) if (s.K && s.K[sp.id]) sp.K = s.K[sp.id];
    for (const id in s.territories || {}) this.territories[id] = s.territories[id].map(([x, y, owner]) => ({ x, y, owner: idMap[owner] || owner }));
  };
})(window.Trophic);
