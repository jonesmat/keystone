// Keystone — Phase 3 Populations: the second tier of the two-tier simulation (P3-M4).
// Small, numerous taxa live as per-tile densities (juveniles, adults, post-reproductive) with pooled reserves (E),
// body tissue (Tt) and nitrogen (Nn). Every few ticks each tile feeds, pays metabolism, breeds, ages, dies and
// sends dispersers to its neighbours, booking the same energy, nitrogen and demography ledgers as individuals.
// A Population is one connected region of a species' grid: regions split when cut in two and merge when they touch,
// and keep their place-based label and history across recomputes. Herds, packs and flocks of individually
// simulated vertebrates get regions too, from their members' combined home ranges.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const W = T.World.prototype;
  const clamp = T.util.clamp;
  const PB = () => B.populations;

  T.isPopulationSpecies = sp => !!(sp && sp.flags && sp.flags.population && !sp.isPlayer);

  // ---------- setup ----------

  W._newGrid = function (sp) {
    const n = this.N * this.N;
    sp.grid = {
      nJ: new Float32Array(n), nA: new Float32Array(n), nO: new Float32Array(n),
      E: new Float64Array(n), Tt: new Float64Array(n), Nn: new Float64Array(n), total: 0, max: 0,
    };
    sp.frac = {};
    sp.regions = sp.regions || [];
    sp.regionMap = new Int32Array(n);
    sp.nextRegion = sp.nextRegion || 1;
  };

  // Tiles a Population can live on: open water for swimmers, land for everything else.
  W.popSuitable = function (sp, i) {
    return sp.stats.swim ? this.terrain[i] === 1 : this.terrain[i] === 0;
  };

  // Founders: a few blobs of individuals on suitable ground, 70% adults, with reserves and tissue.
  W._seedPopulation = function (sp, count) {
    if (!sp.grid) this._newGrid(sp);
    const g = sp.grid, st = sp.stats, N = this.N, rng = this.rng, P = PB();
    const blobs = P.seedBlobs[0] + rng.int(P.seedBlobs[1] - P.seedBlobs[0] + 1);
    const tiles = [];
    for (let b = 0; b < blobs; b++) {
      let c = -1;
      for (let k = 0; k < 60 && c < 0; k++) { const i = rng.int(N * N); if (this.popSuitable(sp, i)) c = i; }
      if (c < 0) continue;
      const r = P.blobRadius[0] + rng.int(P.blobRadius[1] - P.blobRadius[0] + 1);
      const cx = c % N, cy = (c / N) | 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= N || y >= N || dx * dx + dy * dy > r * r) continue;
        const i = y * N + x;
        if (this.popSuitable(sp, i)) tiles.push(i);
      }
    }
    if (!tiles.length) return;
    const per = count / tiles.length, jm = B.juvenileMass, nAn = B.nitrogen.animal;
    for (const i of tiles) {
      const a = per * 0.7, j = per * 0.3;
      g.nA[i] += a; g.nJ[i] += j;
      const tissue = st.tissueAdult * (a + j * jm);
      g.Tt[i] += tissue;
      g.E[i] += st.maxE * 0.6 * (a + j * jm);
      g.Nn[i] += tissue * nAn;
    }
    this._popTotals(sp);
  };

  // ---------- fractional counts ----------

  // Densities give fractional births and deaths; whole individuals are booked as they accumulate.
  function addCount(sp, key, x, into, field) {
    const acc = (sp.frac[key] || 0) + x;
    const whole = Math.floor(acc);
    sp.frac[key] = acc - whole;
    if (whole > 0) into[field] = (into[field] || 0) + whole;
  }
  T.popCount = addCount;

  // ---------- the update ----------

  W._updatePopulations = function () {
    const dt = PB().update;
    for (const sp of this.species) if (sp.grid) this._popStep(sp, dt);
    if (this.t % PB().regionEvery === 0) this.updateRegions();
  };

  W._popStep = function (sp, dt) {
    const g = sp.grid, st = sp.stats, rs = this.rstats[sp.idx], P = PB();
    const NT = this.N * this.N, NB = B.nitrogen, nAn = NB.animal;
    const jm = B.juvenileMass, juvU = Math.pow(jm, 0.75);
    const torpid = st.ecto && this.ectoTorpid;
    const perf = st.ecto ? this.ectoPerf : 1;
    let U1 = st.basal + st.traitUp + st.basal * B.activityCost * 0.5;
    let thermo = st.thermo * this.thermoDT;
    if (torpid || (st.hibernate && this.seasonIdx === 3)) { U1 = (st.basal + st.traitUp) * 0.3; thermo *= 0.3; }
    const maxE = st.maxE, tAd = st.tissueAdult;
    const growTicks = Math.max(50, (1 - jm) / st.growRate);
    const life = Math.max(200, st.lifeTicks);
    const birthRate = st.litter / Math.max(60, st.breedCd);   // young per adult per tick when breeding
    const season = B.seasons[this.seasonIdx].name;
    const decomp = sp.level === 'decomposer';
    let heat = 0, thermoHeat = 0, total = 0, max = 0;
    const moves = [];
    for (let i = 0; i < NT; i++) {
      let nJ = g.nJ[i], nA = g.nA[i], nO = g.nO[i];
      const n = nJ + nA + nO;
      if (n <= 0) continue;
      if (n < 1e-3) { this._popClear(sp, i); continue; }
      const weight = nJ * jm + nA + nO;
      const fullE = maxE * weight;
      // 1. Feeding: hungry individuals eat at their eat rate, slower in the cold.
      if (!torpid) {
        const hunger = clamp(1 - g.E[i] / fullE, 0, 1);
        const demand = weight * st.eatRate * perf * dt * Math.min(1, hunger * 2);
        if (demand > 0.01) this._popFeed(sp, i, demand, decomp);
      }
      // 2. Metabolism, paid from pooled reserves; what can't be paid starves individuals.
      const U = (nA + nO + nJ * juvU) * (U1 + thermo) * dt;
      const pay = Math.min(U, g.E[i]);
      g.E[i] -= pay; heat += pay;
      if (thermo > 0 && U > 0) thermoHeat += pay * thermo / (U1 + thermo);
      const starve = U > 0 ? Math.min(0.5, ((U - pay) / U) * 0.5) : 0;
      // 3. Deaths: starvation, plus natural mortality that rises with age.
      const dJ = nJ * Math.min(1, starve + dt / life), dA = nA * Math.min(1, starve + (0.5 * dt) / life);
      const dO = nO * Math.min(1, starve + dt / (life * (1 - P.oldAt)));
      if (dJ + dA + dO > 0) {
        const share = (dJ * jm + dA + dO) / weight;
        this._popBodiesToDetritus(sp, i, share);
        nJ -= dJ; nA -= dA; nO -= dO;
        addCount(sp, 'dead:' + (starve > 0.01 ? 'starved@' + season : 'old'), dJ + dA + dO, rs.deaths, starve > 0.01 ? 'starved@' + season : 'old');
      }
      // 4. Maturation (juveniles build adult tissue from reserves) and ageing.
      let mat = nJ * Math.min(1, dt / growTicks);
      const build = tAd * (1 - jm);
      if (mat * build > g.E[i]) mat = g.E[i] / build;
      g.E[i] -= mat * build; g.Tt[i] += mat * build;
      nJ -= mat; nA += mat;
      const old = nA * Math.min(1, dt / (life * P.oldAt));
      nA -= old; nO += old;
      // 5. Births: well-fed adults breed; each newborn's tissue comes from the pooled reserves.
      const w2 = nJ * jm + nA + nO;
      if (!torpid && nA > 0 && g.E[i] > P.breedAt * maxE * w2) {
        const cost = tAd * jm;
        const room = g.E[i] - P.breedAt * maxE * w2 * 0.8;
        const births = Math.min(nA * birthRate * dt * Math.min(1, (g.E[i] / (maxE * w2) - P.breedAt) / 0.2), room / cost);
        if (births > 0) {
          g.E[i] -= births * cost; g.Tt[i] += births * cost;
          nJ += births;
          addCount(sp, 'births', births, rs, 'births');
        }
      }
      g.nJ[i] = nJ; g.nA[i] = nA; g.nO[i] = nO;
      // 6. Nitrogen beyond tissue needs plus a small store is excreted by body plan.
      const cap = g.Tt[i] * nAn * (1 + NB.storeShare);
      if (g.Nn[i] > cap) {
        const x = g.Nn[i] - cap;
        g.Nn[i] = cap;
        if (st.swim || decomp) this.nh4[i] += x; else if (st.flight || st.ecto) this.uric[i] += x; else this.urea[i] += x;
      }
      const nn = nJ + nA + nO;
      total += nn;
      if (nn > max) max = nn;
      // 7. Dispersal: crowded, well-fed tiles and hungry ones send some individuals to a neighbouring tile.
      const eShare = g.E[i] / (maxE * (nJ * jm + nA + nO) || 1);
      if ((eShare > P.crowdAt && nn > P.occupied * 4) || (eShare < P.hungryAt && nn > P.occupied)) moves.push(i);
    }
    this.ledger.heat += heat;
    rs.upkeepHeat += heat;
    rs.thermoHeat += thermoHeat;
    for (const i of moves) {
      const j = this._popNeighbour(sp, i);
      if (j >= 0) this._popMove(sp, i, j, P.disperse * (1 + this.rng.next()));
    }
    g.total = total;
    g.max = max;
  };

  // A random neighbouring tile the species can live on (−1 if none).
  W._popNeighbour = function (sp, i) {
    const N = this.N, x = i % N, y = (i / N) | 0;
    for (let k = 0; k < 4; k++) {
      const dx = this.rng.int(3) - 1, dy = this.rng.int(3) - 1;
      const xx = x + dx, yy = y + dy;
      if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = yy * N + xx;
      if (this.popSuitable(sp, j)) return j;
    }
    return -1;
  };

  // Move a share of everything on tile i (individuals, reserves, tissue, nitrogen) to tile j.
  W._popMove = function (sp, i, j, f) {
    const g = sp.grid;
    for (const k of ['nJ', 'nA', 'nO', 'E', 'Tt', 'Nn']) { const d = g[k][i] * f; g[k][i] -= d; g[k][j] += d; }
  };

  // Dead individuals' tissue, reserves and nitrogen go to the tile's detritus (small bodies: no carcass).
  W._popBodiesToDetritus = function (sp, i, share) {
    const g = sp.grid;
    share = Math.min(1, share);
    const e = g.E[i] * share, t = g.Tt[i] * share, n = g.Nn[i] * share;
    g.E[i] -= e; g.Tt[i] -= t; g.Nn[i] -= n;
    this.detr[i] += e + t;
    this.detrN[i] += n;
    const rs = this.rstats[sp.idx];
    rs.otherLoss += e + t;
  };

  W._popClear = function (sp, i) {
    const g = sp.grid;
    this.detr[i] += g.E[i] + g.Tt[i];
    this.detrN[i] += g.Nn[i];
    g.nJ[i] = g.nA[i] = g.nO[i] = 0;
    g.E[i] = g.Tt[i] = g.Nn[i] = 0;
  };

  // Feed a tile's Population: from its own tile first, then from nearby tiles (flying insects range 2 tiles,
  // walkers 1). Food is detritus for decomposers, the plants and fruit (flowers) it eats, and small prey Populations.
  W._popFeed = function (sp, i, demand, decomp) {
    let left = this._popFeedAt(sp, i, i, demand, decomp);
    if (left <= 0.01) return;
    const N = this.N, x = i % N, y = (i / N) | 0, r = sp.stats.flight ? 2 : 1;
    for (let k = 0; k < 4 && left > 0.01; k++) {
      const xx = x + this.rng.int(2 * r + 1) - r, yy = y + this.rng.int(2 * r + 1) - r;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = yy * N + xx;
      if (j !== i) left = this._popFeedAt(sp, i, j, left, decomp);
    }
  };

  // Eat from tile j on behalf of the Population on tile i; returns the demand still unmet.
  W._popFeedAt = function (sp, i, j, demand, decomp) {
    const st = sp.stats;
    let left = demand;
    const prey = this.popPrey && this.popPrey[sp.idx];
    if (prey && prey.length && st.canMeat) {
      for (const b of prey) {
        if (left <= 0.01) break;
        const pg = b.grid, body = pg.E[j] + pg.Tt[j];
        if (body <= 0.5) continue;
        const amt = Math.min(left, body * 0.5);
        const f = amt / body, killed = (pg.nJ[j] + pg.nA[j] + pg.nO[j]) * f, nIn = pg.Nn[j] * f;
        for (const k of ['nJ', 'nA', 'nO', 'E', 'Tt', 'Nn']) pg[k][j] -= pg[k][j] * f;
        const rs = this.rstats[b.idx];
        rs.predLoss += amt;
        addCount(b, 'k:' + sp.id, killed, rs.deaths, 'k:' + sp.id);
        this._popBook(sp, i, amt, st.meatA, b.name, b.level, nIn);
        left -= amt;
      }
    }
    const home = i;   // meals are booked to the eater's tile
    i = j;            // plant, fruit and detritus come from tile j
    if ((decomp || sp.foods.has('detritus')) && this.detr[i] > 0.01) {
      const amt = Math.min(left, this.detr[i]);
      const nIn = this.detrN[i] * (amt / this.detr[i]);
      this.detr[i] -= amt; this.detrN[i] -= nIn;
      this._popBook(sp, home, amt, B.decomposerA, 'Detritus', 'detritus', nIn);
      left -= amt;
    }
    const t = this.ptype[i];
    if (left > 0.01 && t && sp.foods.has(this.producers[t].id)) {
      const P = this.producers[t];
      const avail = this.pE[i] - P.max * B.grazeFloor;
      if (avail > 0) {
        const amt = Math.min(left, avail);
        this.pE[i] -= amt;
        this.pbook.eaten[t] += amt;
        this._popBook(sp, home, amt, st.plantA, P.name, 'producer', amt * P.nContent);
        left -= amt;
      }
    }
    if (left > 0.01 && t && sp.foods.has('fruit') && this.fruit[i] > 0.01) {
      const amt = Math.min(left, this.fruit[i]);
      this.fruit[i] -= amt;
      this.pbook.eaten[t] += amt;
      this._popBook(sp, home, amt, Math.min(0.95, st.plantA + B.fruitBonusA), 'Fruit', 'producer', amt * this.producers[t].nContent);
      left -= amt;
    }
    return left;
  };

  // Book one meal for a Population, exactly as _digest does for an individual.
  W._popBook = function (sp, i, amt, A, src, srcLv, nIn) {
    const g = sp.grid, rs = this.rstats[sp.idx];
    const P = sp.stats.P;
    const gain = amt * A * P, resp = amt * A * (1 - P), exc = amt * (1 - A);
    g.E[i] += gain;
    this.ledger.heat += resp;
    this.detr[i] += exc;
    if (nIn > 0) { this.detrN[i] += nIn * (1 - A); g.Nn[i] += nIn * A; }
    rs.eaten[src] = (rs.eaten[src] || 0) + amt;
    rs.eatenLv[srcLv] = (rs.eatenLv[srcLv] || 0) + amt;
    rs.assimLv[srcLv] = (rs.assimLv[srcLv] || 0) + amt * A;
    rs.ingested += amt;
    rs.assimilated += amt * A;
    rs.gain += gain;
    rs.digestHeat += resp;
    rs.excreted += exc;
    this._flowAcc[sp.level] += gain;
  };

  // An individual predator eats from a Population on tile i: whole bodies (tissue, reserves, nitrogen) up to maxAmt.
  // Returns the energy and nitrogen eaten; the prey's deaths are booked as kills by the predator's species.
  W._eatPopulation = function (pred, prey, i, maxAmt) {
    const g = prey.grid;
    const body = g.E[i] + g.Tt[i];
    if (body <= 0.01) return { amt: 0, nIn: 0 };
    const amt = Math.min(maxAmt, body);
    const f = amt / body;
    const killed = (g.nJ[i] + g.nA[i] + g.nO[i]) * f;
    const nIn = g.Nn[i] * f;
    for (const k of ['nJ', 'nA', 'nO', 'E', 'Tt', 'Nn']) g[k][i] -= g[k][i] * f;
    const rs = this.rstats[prey.idx];
    rs.predLoss += amt;
    addCount(prey, 'k:' + pred.sp.id, killed, rs.deaths, 'k:' + pred.sp.id);
    addCount(prey, 'kills:' + pred.sp.id, killed, this.rstats[pred.sp.idx].kills, prey.id);
    return { amt, nIn };
  };

  // Energy in a Population's bodies on a tile (what a predator can eat there).
  W.popFoodAt = function (sp, i) { return sp.grid ? sp.grid.E[i] + sp.grid.Tt[i] : 0; };
  W.popDensity = function (sp, i) { const g = sp.grid; return g ? g.nJ[i] + g.nA[i] + g.nO[i] : 0; };

  // ---------- totals for ledgers and counts ----------

  W._popTotals = function (sp) {
    const g = sp.grid, n = this.N * this.N;
    let total = 0, max = 0;
    for (let i = 0; i < n; i++) { const d = g.nJ[i] + g.nA[i] + g.nO[i]; total += d; if (d > max) max = d; }
    g.total = total; g.max = max;
  };
  W.popEnergy = function (sp) {
    const g = sp.grid, n = this.N * this.N;
    let s = 0;
    for (let i = 0; i < n; i++) s += g.E[i] + g.Tt[i];
    return s;
  };
  W.popNitrogen = function (sp) {
    const g = sp.grid, n = this.N * this.N;
    let s = 0;
    for (let i = 0; i < n; i++) s += g.Nn[i];
    return s;
  };
  W.popAges = function (sp) {
    const g = sp.grid, n = this.N * this.N;
    let j = 0, a = 0, o = 0;
    for (let i = 0; i < n; i++) { j += g.nJ[i]; a += g.nA[i]; o += g.nO[i]; }
    return { juvenile: j, breeding: a, post: o };
  };

  // ---------- regions ----------

  const COMPASS = (x, y, N) => {
    const v = y < N / 3 ? 'North' : y > (2 * N) / 3 ? 'South' : '';
    const h = x < N / 3 ? 'west' : x > (2 * N) / 3 ? 'east' : '';
    if (v && h) return v + h;
    if (v) return v;
    if (h) return h[0].toUpperCase() + h.slice(1);
    return 'Central';
  };
  const HABITAT = { ground: 'meadow', tall: 'reedbed', vine: 'thicket', woody: 'woods', aquatic: 'shallows', plankton: 'open water' };

  // A place-based name from the region's centre and the habitat most of it covers.
  W._placeLabel = function (tiles) {
    const N = this.N;
    let sx = 0, sy = 0;
    const votes = {};
    for (const i of tiles) {
      sx += i % N; sy += (i / N) | 0;
      let noun;
      if (this.terrain[i] === 1) noun = this.ptype[i] && this.producers[this.ptype[i]].kind === 'aquatic' ? 'shallows' : 'open water';
      else if (this.sw && this.sw[i] > B.water.waterlogged) noun = 'marsh';
      else noun = this.ptype[i] ? HABITAT[this.producers[this.ptype[i]].kind] || 'meadow' : 'flats';
      votes[noun] = (votes[noun] || 0) + 1;
    }
    const noun = Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
    return COMPASS(sx / tiles.length, sy / tiles.length, N) + ' ' + noun;
  };

  // Connected components of an occupancy mask (4-neighbour), largest first.
  W._components = function (occ) {
    const N = this.N, n = N * N;
    const lab = new Int32Array(n);
    const comps = [];
    const stack = [];
    for (let s = 0; s < n; s++) {
      if (!occ[s] || lab[s]) continue;
      const id = comps.length + 1, tiles = [];
      lab[s] = id; stack.push(s);
      while (stack.length) {
        const i = stack.pop();
        tiles.push(i);
        const x = i % N, y = (i / N) | 0;
        if (x > 0 && occ[i - 1] && !lab[i - 1]) { lab[i - 1] = id; stack.push(i - 1); }
        if (x < N - 1 && occ[i + 1] && !lab[i + 1]) { lab[i + 1] = id; stack.push(i + 1); }
        if (y > 0 && occ[i - N] && !lab[i - N]) { lab[i - N] = id; stack.push(i - N); }
        if (y < N - 1 && occ[i + N] && !lab[i + N]) { lab[i + N] = id; stack.push(i + N); }
      }
      comps.push(tiles);
    }
    comps.sort((a, b) => b.length - a.length);
    return comps;
  };

  // Splits and merges are recorded (history, round notes) only for pieces of some size, not edge fragments.
  const MIN_NOTED = 6;
  const notable = r => r.area >= MIN_NOTED;

  // Rebuild a species' regions from an occupancy mask and match them to the previous ones by overlap:
  // the best-overlapping new region keeps an old region's identity (label, history, survey record); other pieces
  // of a cut-up region are new Populations split from it; old regions swallowed by a new one are merged into it.
  W._rebuildRegions = function (sp, occ, measure) {
    const comps = this._components(occ);
    const old = new Map(sp.regions.map(r => [r.id, r]));
    const prevMap = sp.regionMap;
    const claimed = new Set();
    const next = [];
    const newMap = new Int32Array(this.N * this.N);
    const notes = [];
    for (const tiles of comps) {
      const ov = new Map();
      for (const i of tiles) { const o = prevMap[i]; if (o) ov.set(o, (ov.get(o) || 0) + 1); }
      const ranked = [...ov.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).filter(id => old.has(id));
      let region;
      const heir = ranked.find(id => !claimed.has(id));
      if (heir != null) {
        region = old.get(heir);
        claimed.add(heir);
        // Merged: other old regions whose tiles are now part of this one.
        for (const id of ranked) {
          if (id === heir || claimed.has(id)) continue;
          if (ov.get(id) >= Math.max(1, old.get(id).area * 0.5)) {
            claimed.add(id);
            const o = old.get(id);
            if (notable(o)) {
              region.history.push({ round: this.round, text: 'merged with ' + o.label });
              notes.push(sp.name + ': ' + o.label + ' merged into ' + region.label + '.');
            }
          }
        }
      } else {
        const from = ranked.length ? old.get(ranked[0]) : null;
        region = { id: sp.nextRegion++, label: '', born: this.round, history: [], splitFrom: from ? from.id : null, survey: from && from.survey ? Object.assign({}, from.survey) : null };
        if (from && tiles.length >= MIN_NOTED) {
          region.history.push({ round: this.round, text: 'split from ' + from.label });
          from.history.push({ round: this.round, text: 'split in two' });
        }
      }
      region.tiles = tiles;
      region.area = tiles.length;
      if (!region.label) {
        let label = this._placeLabel(tiles), k = 2;
        const base = label;
        while (next.some(r => r.label === label) || [...old.values()].some(r => r.label === label && !claimed.has(r.id) && r !== region)) label = base + ' ' + k++;
        region.label = label;
        if (region.splitFrom && tiles.length >= MIN_NOTED) notes.push(sp.name + ': ' + region.label + ' split off from ' + old.get(region.splitFrom).label + '.');
      }
      Object.assign(region, measure(tiles));
      if (region.n0 == null) region.n0 = region.n;
      for (const i of tiles) newMap[i] = region.id;
      next.push(region);
    }
    sp.regions = next;
    sp.regionMap = newMap;
    return notes;
  };

  // Recompute every species' regions: Population grids by density, vertebrate groups by members' home ranges.
  W.updateRegions = function () {
    const n = this.N * this.N, P = PB();
    for (const sp of this.species) {
      if (!sp.regionMap || sp.regionMap.length !== n) { sp.regionMap = new Int32Array(n); sp.regions = sp.regions || []; sp.nextRegion = sp.nextRegion || 1; }
      const occ = new Uint8Array(n);
      let notes;
      if (sp.grid) {
        const g = sp.grid;
        // Hysteresis: a tile already in a region stays in it down to half the threshold, so edges don't flicker.
        for (let i = 0; i < n; i++) {
          const d = g.nJ[i] + g.nA[i] + g.nO[i];
          if (d >= P.occupied || (sp.regionMap[i] && d >= P.occupied * 0.5)) occ[i] = 1;
        }
        notes = this._rebuildRegions(sp, occ, tiles => {
          let N = 0, E = 0;
          for (const i of tiles) { N += g.nJ[i] + g.nA[i] + g.nO[i]; E += g.E[i] + g.Tt[i]; }
          return { n: N, energy: E, density: N / tiles.length };
        });
      } else {
        const members = this.ents.filter(e => e.alive && e.sp === sp);
        if (!members.length) { sp.regions = []; sp.regionMap = new Int32Array(n); continue; }
        const N = this.N, r = clamp(Math.round(sp.stats.roam / 2), P.groupRadius[0], P.groupRadius[1]);
        for (const e of members) {
          const cx = e.x | 0, cy = e.y | 0;
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            const x = cx + dx, y = cy + dy;
            if (x >= 0 && y >= 0 && x < N && y < N && dx * dx + dy * dy <= r * r) occ[y * N + x] = 1;
          }
        }
        notes = this._rebuildRegions(sp, occ, tiles => {
          const set = new Set(tiles);
          const inside = members.filter(e => set.has(this.tileAt(e.x, e.y)));
          return { n: inside.length, energy: inside.reduce((a, e) => a + e.E + e.tissue, 0), density: inside.length / tiles.length, members: inside.map(e => e.id) };
        });
      }
      // Splits and merges of small-taxa Populations make the round's notes; groups of large animals move too often.
      if (sp.grid) for (const t of notes) this.notes.push(t);
    }
  };

  // Round start: remember each region's size for its trend.
  W._regionsBeginRound = function () {
    for (const sp of this.species) for (const r of sp.regions || []) r.n0 = r.n;
  };

  W.regionById = function (spIdx, id) {
    const sp = this.species[spIdx];
    return sp && sp.regions ? sp.regions.find(r => r.id === id) || null : null;
  };

  // ---------- saves ----------

  const r3 = v => Math.round(v * 1000) / 1000;
  W._popState = function (sp) {
    const g = sp.grid;
    const o = { total: g.total, frac: sp.frac, nextRegion: sp.nextRegion,
      regions: (sp.regions || []).map(r => ({ id: r.id, label: r.label, born: r.born, history: r.history, splitFrom: r.splitFrom, survey: r.survey, n0: r.n0 })),
      regionMap: Array.from(sp.regionMap) };
    for (const k of ['nJ', 'nA', 'nO', 'E', 'Tt', 'Nn']) o[k] = Array.from(g[k], r3);
    return o;
  };
  W._popRestore = function (sp, s) {
    this._newGrid(sp);
    const g = sp.grid;
    for (const k of ['nJ', 'nA', 'nO', 'E', 'Tt', 'Nn']) g[k].set(s[k]);
    sp.frac = s.frac || {};
    sp.nextRegion = s.nextRegion || 1;
    sp.regions = (s.regions || []).map(r => Object.assign({ tiles: [], area: 0, n: 0 }, r));
    if (s.regionMap) sp.regionMap.set(s.regionMap);
    this._popTotals(sp);
  };
})(window.Trophic);
