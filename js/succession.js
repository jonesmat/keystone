// Keystone — Phase 3 succession, disturbance and biomes (P3-M6, part 1).
// Each land tile sits at a seral stage and moves toward the climax its biome's climate allows:
//   0 bare rock → 1 pioneers (lichens, mosses) → 2 grasses and forbs → 3 shrubs and young trees → 4 mature forest.
// A tile advances when a producer of the next stage seeds into it (from a neighbour within its dispersal range, the
// tile's own seed bank, or a rare long-distance seed) and its soil has built up enough organic matter and nitrogen.
// Old woody tiles die at the end of their longevity and open light gaps; fire, floods and windthrow reset tiles to
// the grasses stage, which regrows from the seed bank (secondary succession). A volcanic-isle world starts as bare
// rock (primary succession).
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const W = T.World.prototype;
  const clamp = T.util.clamp;
  const S = () => B.succession;

  T.SERAL_STAGES = ['Bare rock', 'Pioneers (lichens, mosses)', 'Grasses and forbs', 'Shrubs and young trees', 'Mature forest'];

  // The textbook's Whittaker diagram: biome from mean annual temperature (°C) and precipitation (cm/yr), and the
  // stage its climax community reaches.
  T.WHITTAKER = [
    { id: 'tundra', name: 'Tundra', climax: 2, climaxName: 'Lichen, moss and sedge mat' },
    { id: 'taiga', name: 'Taiga', climax: 4, climaxName: 'Conifer forest' },
    { id: 'desert', name: 'Desert', climax: 3, climaxName: 'Desert scrub' },
    { id: 'grassland', name: 'Temperate grassland', climax: 2, climaxName: 'Tallgrass prairie' },
    { id: 'forest', name: 'Temperate forest', climax: 4, climaxName: 'Deciduous forest' },
    { id: 'tropSeasonal', name: 'Tropical seasonal forest', climax: 4, climaxName: 'Seasonal forest' },
    { id: 'rainforest', name: 'Tropical rainforest', climax: 4, climaxName: 'Rainforest' },
  ];
  T.whittaker = function (t, rain) {
    const by = id => T.WHITTAKER.find(b => b.id === id);
    if (t < -5) return by('tundra');
    if (rain < 30) return by('desert');
    if (t > 20 && rain >= 100) return by(rain > 250 ? 'rainforest' : 'tropSeasonal');
    if (t < 5) return by('taiga');
    return by(rain >= 90 ? 'forest' : 'grassland');
  };

  // The built-in pioneer, added to a world that starts as bare rock and has none of its own.
  T.PIONEER = {
    id: 'lichen', name: 'Crust lichen', kind: 'ground', habit: 'lichen', max: 40, resp: 0.5, edible: 0.2, height: 0, leaf: 0.8, regrowDelay: 0,
    fruit: false, fixer: true, tough: 0.6, moist: 0.35, color: [168, 170, 150],
    note: 'A pioneer: fungus and alga together, with cyanobacteria that fix nitrogen. Breaks bare rock into the first soil.',
  };

  // Seral stage of a producer: by growth habit where it has one (catalog species), else by map kind.
  T.sereOf = function (P) {
    if (!P || P.kind === 'aquatic' || P.kind === 'plankton') return 0;
    if (P.stage) return P.stage;
    const byHabit = { lichen: 1, moss: 1, grass: 2, forb: 2, shrub: 3, vine: 3, tree: 4 }[P.habit];
    if (byHabit) return byHabit;
    return P.kind === 'woody' ? 4 : 2;
  };

  // Fugitive producers seed far and die young; climax producers seed near and live long. Jittered per species.
  function jitter(id, f) {
    let h = 0;
    for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) >>> 0;
    return 1 + ((h % 1000) / 1000 - 0.5) * f;
  }

  // ---------- setup ----------

  W._initSuccession = function (primary) {
    const n = this.N * this.N, P = S();
    this.som = new Float32Array(n);        // soil organic matter (an index: established soils start near 150)
    this.sAge = new Float32Array(n);       // rounds since the tile's producer established
    this.bank = new Uint8Array(n * 3);     // seed bank: the last three producer types that grew here
    this.rock = new Uint8Array(n);         // 1 = bare rock, no soil yet
    this.burn = new Uint8Array(n);         // rounds a burn scar stays visible
    this.biomeClass = T.whittaker(this.biome.tMean, this.biome.rain);
    this.disturbLog = [];
    this._producerSeralTraits();
    for (let i = 0; i < n; i++) {
      if (this.terrain[i] === 1) continue;
      const t = this.ptype[i], Pr = this.producers[t];
      this.som[i] = P.startSom * (0.8 + 0.4 * this.rng.next());
      this.sAge[i] = Pr ? this.rng.next() * Pr.longevity : 0;
      if (t) this._bankPush(i, t);
      // Every soil's seed bank holds grasses and forbs that suit its moisture (another species where this one is one).
      const herbs = this.producersOfStage(2);
      const alt = this._seedFromList(herbs.length ? herbs : this.producersOfStage(T.sereOf(Pr)), this.moist[i], t);
      if (alt) this._bankPush(i, alt.idx);
      if (t) this._bankPush(i, t);
    }
    if (primary) this._makeRock();
    this._successionCover();
  };

  W._producerSeralTraits = function () {
    const P = S();
    for (const Pr of this.producers) {
      if (!Pr) continue;
      Pr.stage = T.sereOf(Pr);
      const s = Pr.stage;
      if (Pr.dispersal == null) Pr.dispersal = +(P.dispersal[s] * jitter(Pr.id, 0.4)).toFixed(1);
      if (Pr.longevity == null) Pr.longevity = +(P.longevity[s] * jitter(Pr.id + 'L', 0.5)).toFixed(1);
    }
    this.stagesPresent = [...new Set(this.producers.filter(Pr => Pr && Pr.stage > 0).map(Pr => Pr.stage))].sort((a, b) => a - b);
  };

  W.producersOfStage = function (s) { return this.producers.filter(Pr => Pr && Pr.stage === s); };

  // The climax a tile can reach: the biome's, plus gallery woodland along wet ground in grassland and desert.
  W.climaxAt = function (i) {
    const c = this.biomeClass.climax;
    if (c < 4 && this.moist[i] >= S().riparianMoist) return Math.min(4, c + 2);
    return c;
  };

  // Volcanic isle: every land tile starts as bare rock with no soil, seed bank or producer.
  W._makeRock = function () {
    const n = this.N * this.N;
    if (!this.producersOfStage(1).length) {
      this.producers.push(Object.assign({}, T.PIONEER, { idx: this.producers.length }));
      this.plantNames.add(T.PIONEER.name); this.producerIds.add(T.PIONEER.id);
      this.pbook = this._newProducerBook();
      this._producerCycleTraits();
      this._producerSeralTraits();
    }
    for (let i = 0; i < n; i++) {
      if (this.terrain[i] === 1) continue;
      this.ptype[i] = 0; this.pE[i] = 0; this.fruit[i] = 0; this.detr[i] = 0; this.detrN[i] = 0;
      this.nh4[i] *= 0.05; this.no3[i] *= 0.05; this.no2[i] = 0; this.salt[i] = 0;
      this.som[i] = 0; this.sAge[i] = 0; this.rock[i] = 1;
      this.bank[i * 3] = this.bank[i * 3 + 1] = this.bank[i * 3 + 2] = 0;
    }
    this._computeShade();
  };

  W._bankPush = function (i, t) {
    const b = this.bank, k = i * 3;
    if (b[k] === t) return;
    b[k + 2] = b[k + 1]; b[k + 1] = b[k]; b[k] = t;
  };

  // Tiles each producer covers (for long-distance seed and the report).
  W._successionCover = function () {
    const cover = new Array(this.producers.length).fill(0);
    for (let i = 0; i < this.N * this.N; i++) if (this.ptype[i]) cover[this.ptype[i]]++;
    this.cover = cover;
  };

  // Pick a producer from a list, weighted by how well it suits the moisture (and, for long-distance seed, its cover).
  W._seedFromList = function (list, m, not, byCover) {
    const ws = list.map(Pr => (Pr.idx === not ? 0 : 1) * Math.exp(-8 * Math.pow((Pr.moist == null ? 0.5 : Pr.moist) - m, 2)) *
      (byCover ? 1 + (this.cover[Pr.idx] || 0) + (Pr.seedbank ? 5 : 0) : 1));
    const tot = ws.reduce((a, b) => a + b, 0);
    if (tot <= 0) return null;
    let r = this.rng.next() * tot, k = 0;
    while (k < list.length - 1 && (r -= ws[k]) > 0) k++;
    return list[k];
  };

  // ---------- the succession step ----------

  W._successionTick = function () {
    const P = S();
    if (this.t % P.every !== 0) return;
    const n = this.N * this.N, N = this.N, dt = P.every / B.roundTicks;
    let changed = 0;
    for (let i = 0; i < n; i++) {
      if (this.terrain[i] === 1) continue;
      const t = this.ptype[i], Pr = t ? this.producers[t] : null, s = Pr ? Pr.stage : 0;
      this.sAge[i] += dt;
      // Soil organic matter: humus from the tile's litter, slowly mineralized; pioneers weather rock into soil.
      this.som[i] += P.humify * this.detr[i] - P.mineralize * this.som[i] + (s === 1 ? P.pioneerSoil : 0);
      if (this.rock[i] && this.som[i] > P.som[2] * 0.5) this.rock[i] = 0;
      // Light gaps: shrubs and trees die at the end of their longevity.
      if (Pr && s >= 3 && this.sAge[i] > Pr.longevity) { this._reset(i, 'gap'); changed++; continue; }
      // Bare soil (burned, flooded, cleared) regrows from the seed bank at once.
      if (!Pr && !this.rock[i]) { if (!(this.bareHold && this.bareHold[i]) && this._regrow(i)) changed++; continue; }
      const climax = this.climaxAt(i);
      if (s >= climax) continue;
      // The next stage present in the world (stages the roster lacks are skipped).
      const next = this.stagesPresent.find(x => x > s && x <= climax);
      if (!next) continue;
      if (this.som[i] < P.som[next] || this.nh4[i] + this.no3[i] < P.nMin[next]) continue;
      if (this.rng.next() > P.establish) continue;
      const seed = this._seedRain(i, next);
      if (seed) { this._switchProducer(i, seed); changed++; }
    }
    if (changed) { this._computeShade(); this._successionCover(); this.edgeDirty = true; }
    this.cumSuccession = (this.cumSuccession || 0) + changed;
  };

  // A seed of the given stage reaching tile i: from a neighbour within its dispersal range, the seed bank, or far away.
  W._seedRain = function (i, stage) {
    const P = S(), N = this.N, x = i % N, y = (i / N) | 0, m = this.moist[i];
    const list = this.producersOfStage(stage);
    if (!list.length) return null;
    const reach = Math.max(...list.map(Pr => Pr.dispersal));
    for (let k = 0; k < P.seedTries; k++) {
      const a = this.rng.next() * Math.PI * 2, d = 1 + this.rng.next() * reach;
      const xx = Math.round(x + Math.cos(a) * d), yy = Math.round(y + Math.sin(a) * d);
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const Pr = this.producers[this.ptype[yy * N + xx]];
      if (Pr && Pr.stage === stage && d <= Pr.dispersal && this.rng.next() < Math.exp(-8 * Math.pow((Pr.moist == null ? 0.5 : Pr.moist) - m, 2))) return Pr;
    }
    for (let k = 0; k < 3; k++) {
      const Pr = this.producers[this.bank[i * 3 + k]];
      if (Pr && Pr.stage === stage) return Pr;
    }
    // Wind, birds and floods: occasionally a seed from anywhere on the map (pioneers, which disperse far, most often).
    if (this.rng.next() < P.longSeed * (stage === 1 ? 20 : 1)) return this._seedFromList(list, m, 0, true);
    return null;
  };

  // A new producer takes the tile: the old standing crop and fruit fall as litter (the replacement shades it out).
  W._switchProducer = function (i, Pr) {
    const t = this.ptype[i];
    if (t) {
      const old = this.producers[t], dead = this.pE[i] + this.fruit[i];
      this.detr[i] += dead;
      this.detrN[i] += dead * old.nContent;
      this.pbook.litter[t] += this.pE[i];
      this._bankPush(i, t);
    }
    this.pE[i] = 0; this.fruit[i] = 0; this.regrow[i] = 0;
    this.ptype[i] = Pr.idx;
    this.rock[i] = 0;
    this.sAge[i] = 0;
    this.pgGrowth[i] = 1;
    this.pgTough[i] = clamp(Pr.tough || 0.3, 0, 3);
    this.pgTol[i] = clamp(0.5 * (Pr.moist == null ? 0.5 : Pr.moist) + 0.5 * this.moist[i], 0, 1);
    this._bankPush(i, Pr.idx);
  };

  // Clear a tile to bare soil (its crop to litter); it regrows from the seed bank at the grasses stage.
  W._clearTile = function (i) {
    const t = this.ptype[i];
    if (!t) return;
    const old = this.producers[t], dead = this.pE[i] + this.fruit[i];
    this.detr[i] += dead;
    this.detrN[i] += dead * old.nContent;
    this.pbook.litter[t] += this.pE[i];
    this._bankPush(i, t);
    this.pE[i] = 0; this.fruit[i] = 0; this.ptype[i] = 0; this.sAge[i] = 0;
  };

  W._reset = function (i, why) {
    this._clearTile(i);
    this._regrow(i);
    if (why) this.gaps = (this.gaps || 0) + 1;
  };

  // Secondary succession: the soil survives, so the tile regrows at once from its seed bank (else a neighbour's or a
  // far seed), at the highest stage up to grasses that its soil supports; young soil gets pioneers.
  W._regrow = function (i) {
    const P = S(), n = this.nh4[i] + this.no3[i];
    const ok = s => this.som[i] >= P.som[s] && n >= P.nMin[s];
    let Pr = null;
    for (let k = 0; k < 3 && !Pr; k++) {
      const c = this.producers[this.bank[i * 3 + k]];
      if (c && c.stage <= 2 && ok(c.stage)) Pr = c;
    }
    for (const s of [2, 1]) if (!Pr && this.stagesPresent.includes(s) && ok(s)) Pr = this._seedRain(i, s);
    if (!Pr) return false;
    this._switchProducer(i, Pr);
    return true;
  };

  // ---------- disturbances ----------

  // Wildfire: spreads from a start tile through dry fuel. Standing crop burns to litter; secondary succession follows.
  W.wildfire = function (start, maxTiles) {
    const N = this.N, P = S(), rng = this.wrng;
    maxTiles = maxTiles || Math.round((P.fireSize[0] + rng.int(P.fireSize[1] - P.fireSize[0] + 1)) * B.areaScale);
    if (start == null) {
      for (let k = 0; k < 200 && start == null; k++) { const i = rng.int(N * N); if (!this.terrain[i] && this.ptype[i]) start = i; }
    }
    if (start == null) return { tiles: 0 };
    // The fire front tries to jump from a burning tile to a random neighbour; dry, well-stocked tiles catch most
    // often. Water, bare ground and wet ground stop it, so it burns out before its size if it runs out of fuel.
    const burned = new Set([start]), front = [start], DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let tries = 0; front.length && burned.size < maxTiles && tries < maxTiles * 25; tries++) {
      const k = rng.int(front.length), i = front[k], d = DIRS[rng.int(4)];
      const xx = (i % N) + d[0], yy = ((i / N) | 0) + d[1];
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = yy * N + xx;
      if (burned.has(j) || this.terrain[j] || !this.ptype[j]) continue;
      const Pr = this.producers[this.ptype[j]];
      const fuel = Math.min(1, this.pE[j] / Pr.max), dry = 1 - this.moist[j];
      if (rng.next() < Math.min(0.95, P.fireSpread * (0.5 + fuel) * (0.4 + dry))) { burned.add(j); front.push(j); }
      else if (rng.next() < 0.1) front.splice(k, 1);   // this part of the front burns out
    }
    for (const i of burned) {
      this._clearTile(i);
      this.burn[i] = P.burnScar;
      for (const sp of this.species) if (sp.grid && sp.grid.nA[i] + sp.grid.nJ[i] + sp.grid.nO[i] > 0 && !sp.stats.flight) {
        this._popBodiesToDetritus(sp, i, P.fireKill);
        const g = sp.grid;
        g.nJ[i] *= 1 - P.fireKill; g.nA[i] *= 1 - P.fireKill; g.nO[i] *= 1 - P.fireKill;
      }
    }
    for (const sp of this.species) if (sp.grid) this._popTotals(sp);
    this._computeShade(); this._successionCover(); this.edgeDirty = true;
    const out = { type: 'wildfire', round: this.round, tiles: burned.size, x: start % N, y: (start / N) | 0 };
    this.disturbLog.push(out);
    return out;
  };

  // Flood: low land near water loses its standing crop and is waterlogged, which raises denitrification for a while.
  W.flood = function (rise) {
    const n = this.N * this.N, lim = this.waterLine + (rise || S().floodRise);
    let tiles = 0;
    for (let i = 0; i < n; i++) {
      if (this.terrain[i] || this.elev[i] > lim) continue;
      this._clearTile(i);
      this.sw[i] = 1; this.moist[i] = 1;
      tiles++;
    }
    this._computeShade(); this._successionCover(); this.edgeDirty = true;
    const out = { type: 'flood', round: this.round, tiles };
    this.disturbLog.push(out);
    return out;
  };

  // Windthrow: scattered light gaps in shrubland and woodland.
  W.windthrow = function (share) {
    const n = this.N * this.N, p = share || S().windthrowShare, rng = this.wrng;
    let tiles = 0;
    for (let i = 0; i < n; i++) {
      const Pr = this.producers[this.ptype[i]];
      if (!Pr || Pr.stage < 3 || rng.next() > p) continue;
      this._reset(i, 'gap');
      tiles++;
    }
    this._computeShade(); this._successionCover(); this.edgeDirty = true;
    const out = { type: 'windthrow', round: this.round, tiles };
    this.disturbLog.push(out);
    return out;
  };

  // Natural disturbance each round (on the weather stream): lightning fires, more likely in dry, grassy biomes.
  W._successionBeginRound = function () {
    if (!this.som || this.loading) return;
    for (let i = 0; i < this.N * this.N; i++) if (this.burn[i]) this.burn[i]--;
    if (this.round <= 1 || !S().natural) return;
    const P = S(), c = this.biomeClass.id;
    const p = P.fireChance[c] != null ? P.fireChance[c] : 0.1;
    if (this.wrng.next() < p) this.wildfire();
    if (this.biomeClass.climax >= 4 && this.wrng.next() < P.windthrowChance) this.windthrow(P.windthrowShare * 0.5);
  };

  // ---------- summaries ----------

  // Share of land tiles at each stage, and whether the map is a mosaic (at least 3 stages with 10% or more).
  W.seralSummary = function () {
    const n = this.N * this.N, counts = [0, 0, 0, 0, 0];
    let land = 0;
    for (let i = 0; i < n; i++) {
      if (this.terrain[i]) continue;
      land++;
      const Pr = this.producers[this.ptype[i]];
      counts[this.rock[i] ? 0 : Pr ? Pr.stage : 0]++;
    }
    const share = counts.map(c => (land ? c / land : 0));
    return { counts, share, mosaic: share.filter(s => s >= 0.1).length >= 3, biome: this.biomeClass };
  };

  // ---------- saves ----------

  const r1 = v => Math.round(v * 10) / 10;
  W._successionState = function () {
    return { som: Array.from(this.som, r1), sAge: Array.from(this.sAge, r1), bank: Array.from(this.bank), rock: Array.from(this.rock), burn: Array.from(this.burn),
      disturbLog: this.disturbLog, gaps: this.gaps || 0 };
  };
  W._successionRestore = function (s) {
    this._initSuccession(false);
    this.som.set(s.som); this.sAge.set(s.sAge); this.bank.set(s.bank); this.rock.set(s.rock); this.burn.set(s.burn);
    this.disturbLog = s.disturbLog; this.gaps = s.gaps;
    this._successionCover();
  };
})(window.Trophic);
