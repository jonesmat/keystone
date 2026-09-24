// Keystone — Phase 3 nutrient, water and carbon cycles (P3-M3).
// Nitrogen is conserved: air ⇄ soil pools ⇄ plants ⇄ animals ⇄ dead matter, with its own ledger. Water falls in rain
// events and splits into interception, infiltration, runoff (carrying nitrate downhill), evapotranspiration and
// percolation to a map-wide water table. Carbon is booked alongside energy (1 carbon unit per EU), plus peat and
// open-water uptake. Tiles update in staggered groups (B.cycleStagger), so each tile's soil steps every few ticks.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const W = T.World.prototype;
  const clamp = T.util.clamp;

  // ---------- setup ----------

  // Called after terrain generation (new worlds) or before restoring saved arrays (loaded worlds).
  W._initCycles = function (fresh) {
    const n = this.N * this.N, NB = B.nitrogen;
    const f32 = () => new Float32Array(n);
    this.nh4 = f32(); this.no2 = f32(); this.no3 = f32(); this.salt = f32();
    this.urea = f32(); this.uric = f32(); this.detrN = f32();
    this.sw = f32(); this.comp = f32(); this.rainAcc = f32(); this.peat = new Float64Array(n);
    this.gw = 0; this.gwN = 0; this.lake = 0;
    this.rainEvents = [];
    this.rainMod = 1;
    // Weather has its own random stream, so the same seed brings the same rain whatever the animals do.
    this.wrng = new T.RNG(((this.seed * 2654435761) ^ 0x5bd1e995) >>> 0);
    this.tOffset = this.tOffset || 0;
    this.co2 = this.co2 || B.climate.co2Start;
    this.dic = 0;
    this.nledger = { initial: 0, imported: 0, exported: 0, air: 0, lastErr: 0, maxErr: 0 };
    this._newCycleBook();
    this.cumCycles = { fixed: 0, denitrified: 0, peat: 0, ocean: 0 };
    if (!fresh) return;
    let land = 0;
    for (let i = 0; i < n; i++) {
      if (this.terrain[i] === 1) {
        this.sw[i] = 1;
        this.no3[i] = NB.startNO3 * 0.4; this.nh4[i] = NB.startNH4 * 0.2;
      } else {
        land++;
        this.sw[i] = this.moist[i];
        this.nh4[i] = NB.startNH4; this.no3[i] = NB.startNO3; this.salt[i] = NB.startSalt;
      }
    }
    this.gwRef = Math.max(1, land) * 0.5;
    this.gw = this.gwRef;
    this._refreshSoilIndex();
  };

  // The 0–1 soil-nitrogen index the map tint and tile inspector show.
  W._refreshSoilIndex = function () {
    const n = this.N * this.N, ref = B.nitrogen.indexRef;
    for (let i = 0; i < n; i++) this.nutr[i] = clamp((this.nh4[i] + this.no3[i]) / ref, 0, 1);
  };

  // Per-round accumulators for the report and tools.
  W._newCycleBook = function () {
    this.cbook = {
      // nitrogen
      fixLegume: 0, fixFree: 0, fixLightning: 0, denitrified: 0, denitrifiedWater: 0, leachedToWater: 0, leachedToGround: 0, nLimitedTicks: 0, tileTicks: 0,
      // water
      rain: 0, intercepted: 0, infiltrated: 0, runoff: 0, toLake: 0, et: 0, percolated: 0, capillary: 0, baseflow: 0, irrigation: 0,
      // carbon (1 carbon unit per EU)
      absorbed: 0, released: 0, ocean: 0, peat: 0, heatAtStart: this.ledger ? this.ledger.heat : 0,
    };
  };

  // Producers' fixed traits for the cycles: N content, and a temperature envelope centred on the world's climate.
  W._producerCycleTraits = function () {
    const NB = B.nitrogen, CL = B.climate;
    for (const P of this.producers) {
      if (!P) continue;
      if (P.nContent == null) P.nContent = P.fixer ? NB.legume : P.kind === 'plankton' ? NB.plankton : NB.plant;
      if (P.tOpt == null) P.tOpt = this.biome.tMean == null ? 10 : this.biome.tMean;
      if (P.tRange == null) P.tRange = CL.tRange[P.kind] || 12;
    }
    this._envelope();
  };

  // Annual mean temperature on a row: the biome mean plus warming, colder toward the north edge (y = 0).
  W.rowTemp = function (y) {
    const mean = this.biome.tMean == null ? 10 : this.biome.tMean;
    return mean + this.tOffset + B.climate.latGradient * (y / this.N - 0.5);
  };

  // Climate envelope: growth multiplier per producer type and map row, recomputed when the climate shifts.
  W._envelope = function () {
    const N = this.N;
    this.envFit = this.producers.map(P => {
      const row = new Float32Array(N);
      if (!P) return row;
      for (let y = 0; y < N; y++) {
        const d = (this.rowTemp(y) - P.tOpt) / P.tRange;
        row[y] = clamp(1 - d * d, 0.05, 1);
      }
      return row;
    });
  };

  // Round start: the regional CO2 trend (when on) warms the map, and storms and droughts grow more frequent.
  W._cyclesBeginRound = function () {
    // Advance once per new round (loading a save restarts the current round without advancing it again).
    if (this.climateTrend && this.round > (this.climateRound || 1)) {
      this.climateRound = this.round;
      const CL = B.climate;
      this.co2 += CL.ppmPerRound;
      this.tOffset = CL.sensitivity * Math.log2(this.co2 / CL.co2Start);
      this._envelope();
    }
    this._newCycleBook();
  };

  // Warmth factor for microbes, fixation and evaporation: 0 at freezing, 1 at 25 °C.
  const warmth = t => clamp(t / 25, 0, 1.2);

  // ---------- every tick ----------

  W._cyclesTick = function () {
    this._rain();
    const S = B.cycleStagger, g = this.t % S;
    const N = this.N, n = N * N;
    const temp = this.airTemp;
    for (let i = g; i < n; i += S) this._soilStep(i, S, temp + B.climate.latGradient * (((i / N) | 0) / N - 0.5));
    // Open water absorbs CO2, less well as it warms.
    const up = this.waterTiles * B.carbon.oceanUptake * clamp(1 - 0.05 * this.tOffset, 0.2, 1);
    this.dic += up;
    this.cbook.ocean += up;
    this.cumCycles.ocean += up;
    if (this.debug || this.t % 50 === 0) this.checkNitrogen();
  };

  // Rain events: discs of rain that drift across the map; storms bring lightning (nitrate) with them.
  W._rain = function () {
    const WB = B.water, N = this.N;
    const rainfall = this.biome.rain == null ? 60 : this.biome.rain;
    const warm = 1 + 0.05 * this.tOffset;   // a warmer climate: fewer, heavier events, more of them storms
    const pStart = (WB.eventsPerRound / B.roundTicks) * this.rainMod / warm;
    const wr = this.wrng;
    if (wr.chance(pStart)) {
      const r = wr.range(WB.eventRadius[0], WB.eventRadius[1]);
      const ticks = Math.round(wr.range(WB.eventTicks[0], WB.eventTicks[1]));
      // Size each event so a tile averages the biome's annual rainfall over a round.
      const cover = Math.min(1, (Math.PI * r * r) / (N * N));
      const perTile = (rainfall * WB.unitsPerCm) / (WB.eventsPerRound * cover) * warm;
      this.rainEvents.push({ x: wr.range(0, N), y: wr.range(0, N), r, left: ticks, rate: perTile / ticks,
        vx: wr.range(-0.05, 0.05), vy: wr.range(-0.05, 0.05), storm: wr.chance(Math.min(0.8, WB.stormShare * warm)) });
    }
    if (!this.rainEvents.length) return;
    const NB = B.nitrogen;
    for (const ev of this.rainEvents) {
      ev.left--; ev.x += ev.vx; ev.y += ev.vy;
      const r2 = ev.r * ev.r;
      const x0 = Math.max(0, Math.floor(ev.x - ev.r)), x1 = Math.min(N - 1, Math.ceil(ev.x + ev.r));
      const y0 = Math.max(0, Math.floor(ev.y - ev.r)), y1 = Math.min(N - 1, Math.ceil(ev.y + ev.r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - ev.x, dy = y + 0.5 - ev.y;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * N + x;
        this.rainAcc[i] += ev.rate;
        this.cbook.rain += ev.rate;
        // Rain dissolves nitrate salts; lightning fixes a little more as nitrate.
        const s = this.salt[i] * NB.fromSalt;
        this.salt[i] -= s; this.no3[i] += s;
        if (ev.storm) {
          this.no3[i] += NB.lightning;
          this.nledger.air += NB.lightning;
          this.cbook.fixLightning += NB.lightning;
          this.cumCycles.fixed += NB.lightning;
        }
      }
    }
    this.rainEvents = this.rainEvents.filter(ev => ev.left > 0);
  };

  // One tile's water and soil-nitrogen step, covering dt ticks.
  W._soilStep = function (i, dt, temp) {
    const WB = B.water, NB = B.nitrogen, SB = B.soil, cb = this.cbook;
    const land = this.terrain[i] === 0;
    const wf = warmth(temp);
    const rain = this.rainAcc[i];
    this.rainAcc[i] = 0;
    let anaerobic = false;
    if (land) {
      const t = this.ptype[i], P = t ? this.producers[t] : null;
      const cover = P ? Math.min(1, this.pE[i] / P.max) : 0;
      let sw = this.sw[i];
      // Interception: leaves catch rain and return it to the air.
      let r = rain;
      if (r > 0) {
        const ic = r * Math.min(0.5, cover * (WB.intercept[P ? P.kind : 'ground'] || 0));
        r -= ic; cb.intercepted += ic;
        // Infiltration: loose, covered soil soaks rain in; compacted or bare soil sheds it.
        const cap = WB.infiltration * dt * (1 - 0.85 * this.comp[i]) * (cover > 0.2 ? 1 : 0.6);
        const inf = Math.min(r, cap, 1 - sw);
        sw += inf; r -= inf; cb.infiltrated += inf;
        if (r > 1e-6) { this.sw[i] = sw; this._runoff(i, r); sw = this.sw[i]; }
      }
      // Evapotranspiration: warm soil and leafy cover lose water to the air.
      const et = sw * WB.et * dt * wf * (0.4 + 0.6 * cover);
      sw -= et; cb.et += et;
      // Percolation: water above field capacity drains to groundwater, leaching some nitrate with it.
      if (sw > WB.fieldCapacity) {
        const perc = (sw - WB.fieldCapacity) * Math.min(1, WB.percolation * dt);
        const leach = this.no3[i] * Math.min(0.5, perc / (sw + 1e-6)) * 0.3;
        sw -= perc; this.gw += perc; cb.percolated += perc;
        this.no3[i] -= leach; this.gwN += leach; cb.leachedToGround += leach;
      }
      // Capillary rise where the water table sits near the surface.
      if (this.elev[i] < this.waterTable() && sw < 0.85 && this.gw > 0) {
        const up = Math.min(this.gw, (0.85 - sw) * Math.min(1, WB.capillary * dt));
        sw += up; this.gw -= up; cb.capillary += up;
      }
      this.sw[i] = sw = clamp(sw, 0, 1);
      this.moist[i] = sw;
      // Compaction recovers slowly, faster under roots.
      if (this.comp[i] > 0) this.comp[i] = Math.max(0, this.comp[i] - SB.compactRecover * dt * (1 + 2 * cover));
      anaerobic = sw > WB.waterlogged || this.comp[i] > SB.anaerobicAt;
      // Dry soil locks dissolved nitrate up as salts.
      if (sw < 0.35) { const s = this.no3[i] * NB.toSalt * dt; this.no3[i] -= s; this.salt[i] += s; }
    } else {
      if (rain > 0) { this.lake += rain; cb.toLake += rain; }
      this._mixWater(i, dt);
    }
    // Excreta and free-living fixation.
    const u = this.urea[i] * Math.min(1, NB.urea * dt * (0.3 + 0.7 * wf)), ur = this.uric[i] * Math.min(1, NB.uric * dt * (0.3 + 0.7 * wf));
    this.urea[i] -= u; this.uric[i] -= ur; this.nh4[i] += u + ur;
    const fix = NB.freeFix * dt * wf * (land ? this.sw[i] : 1);
    this.nh4[i] += fix; this.nledger.air += fix; cb.fixFree += fix; this.cumCycles.fixed += fix;
    if (!anaerobic) {
      // Nitrification: two groups of aerobic bacteria, ammonia → nitrite → nitrate.
      const a = this.nh4[i] * Math.min(1, NB.nitrify1 * dt * wf);
      this.nh4[i] -= a; this.no2[i] += a;
      const b = this.no2[i] * Math.min(1, NB.nitrify2 * dt * wf);
      this.no2[i] -= b; this.no3[i] += b;
    } else {
      // Denitrification: anaerobic bacteria return nitrate and nitrite to the air as N2.
      const k = Math.min(1, NB.denitrify * dt * (0.3 + 0.7 * wf));
      const d = this.no3[i] * k + this.no2[i] * k;
      this.no3[i] *= 1 - k; this.no2[i] *= 1 - k;
      this.nledger.air -= d; cb.denitrified += d; this.cumCycles.denitrified += d;
    }
    if (!land) {
      // Open water: the oxygen-poor mud beneath it denitrifies nitrate that runs in, so it doesn't pile up.
      const k = Math.min(1, NB.sedimentDenit * dt * (0.3 + 0.7 * wf));
      const d = this.no3[i] * k;
      this.no3[i] -= d;
      this.nledger.air -= d; cb.denitrified += d; cb.denitrifiedWater += d; this.cumCycles.denitrified += d;
    }
    this.nutr[i] = clamp((this.nh4[i] + this.no3[i]) / NB.indexRef, 0, 1);
  };

  // Currents and wind mix open water: dissolved nitrogen evens out with a random neighbouring water tile.
  W._mixWater = function (i, dt) {
    const N = this.N, x = i % N, y = (i / N) | 0;
    const dx = this.rng.int(3) - 1, dy = this.rng.int(3) - 1;
    const xx = x + dx, yy = y + dy;
    if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= N || yy >= N) return;
    const j = yy * N + xx;
    if (this.terrain[j] !== 1) return;
    const k = Math.min(0.5, B.water.mixing * dt);
    for (const pool of [this.nh4, this.no2, this.no3]) {
      const d = (pool[i] - pool[j]) * k;
      pool[i] -= d; pool[j] += d;
    }
  };

  // Runoff: water that can't soak in runs downhill, soaking in where it can, carrying dissolved nitrate.
  // Hilltops lose fertility; low ground and lakes gain it.
  W._runoff = function (i, water) {
    const N = this.N, WB = B.water, cb = this.cbook;
    cb.runoff += water;
    let nitrate = this.no3[i] * Math.min(0.5, water / (this.sw[i] + water + 1e-6));
    this.no3[i] -= nitrate;
    let at = i;
    for (let step = 0; step < 12 && water > 1e-6; step++) {
      const x = at % N, y = (at / N) | 0;
      let best = -1, be = this.elev[at];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const j = yy * N + xx;
        if (this.elev[j] < be) { be = this.elev[j]; best = j; }
      }
      if (best < 0) break;
      at = best;
      if (this.terrain[at] === 1) {
        this.lake += water; cb.toLake += water;
        this.no3[at] += nitrate; cb.leachedToWater += nitrate;
        return;
      }
      const soak = Math.min(water, (1 - this.sw[at]) * 0.5 * (1 - 0.85 * this.comp[at]));
      this.sw[at] += soak; water -= soak; cb.infiltrated += soak;
    }
    // Left in a hollow: it soaks in there with its nitrate, and what the soil can't hold seeps down to groundwater.
    const room = 1 - this.sw[at];
    this.sw[at] += Math.min(room, water);
    if (water > room) { this.gw += water - room; cb.percolated += water - room; }
    this.no3[at] += nitrate;
  };

  // Water table as an elevation: groundwater raises it, drawdown lowers it.
  W.waterTable = function () {
    return this.waterLine - 0.08 + 0.16 * clamp(this.gw / (this.gwRef || 1), 0, 2);
  };

  // Map-wide groundwater exchange once a tick: baseflow to lakes and streams, and irrigation draw.
  W._groundwater = function () {
    const WB = B.water, cb = this.cbook;
    const bf = this.gw * WB.baseflow;
    this.gw -= bf; this.lake += bf; cb.baseflow += bf;
    if (this.irrigation > 0) {
      const d = Math.min(this.gw, this.irrigation);
      this.gw -= d; cb.irrigation += d;
    }
    // Lakes and streams lose water to the air and downstream, so their store settles rather than grows.
    this.lake *= 0.999;
  };

  // ---------- compaction ----------

  // Called from movement: heavy land animals pack the soil they cross (herd paths).
  W._trample = function (e, step) {
    const st = e.st;
    if (st.swim || st.flight || step <= 0) return;
    const i = this.tileAt(e.x, e.y);
    if (this.terrain[i] === 1) return;
    this.comp[i] = Math.min(1, this.comp[i] + B.soil.compactK * Math.pow(st.mass, 0.75) * step);
    this._trampleProducers(e, i, step);   // amensalism
  };

  // ---------- animals' nitrogen ----------

  // Excrete surplus N by body plan: aquatic animals void ammonia at once, mammals make urea (fast to break down),
  // and birds, reptiles and invertebrates make uric acid (slow, lasts on the tile). Decomposers release ammonia.
  W._excrete = function (e, n, i) {
    if (n <= 0) return;
    const st = e.st;
    if (st.swim || e.sp.level === 'decomposer') this.nh4[i] += n;
    else if (st.flight || st.ecto) this.uric[i] += n;
    else this.urea[i] += n;
  };

  // Assimilated N goes to the animal's store; beyond its small capacity it's excreted.
  W._takeN = function (e, n, i) {
    e.nS += n;
    const cap = B.nitrogen.storeShare * e.st.tissueAdult * B.nitrogen.animal;
    if (e.nS > cap) { this._excrete(e, e.nS - cap, i); e.nS = cap; }
  };

  // ---------- ledgers ----------

  W.totalNitrogen = function () {
    const n = this.N * this.N;
    let s = this.gwN;
    for (let i = 0; i < n; i++) {
      s += this.nh4[i] + this.no2[i] + this.no3[i] + this.salt[i] + this.urea[i] + this.uric[i] + this.detrN[i];
      const t = this.ptype[i];
      if (t) s += (this.pE[i] + this.fruit[i]) * this.producers[t].nContent;
    }
    for (const e of this.ents) if (e.alive) s += e.nT + e.nS;
    for (const c of this.carrion) if (c.alive) s += c.N;
    for (const sp of this.species) if (sp.grid) s += this.popNitrogen(sp);
    return s;
  };

  // N_air + N_soil + N_bodies + N_dead = constant; air's change is booked as fixation (−) and denitrification (+).
  W.checkNitrogen = function () {
    const L = this.nledger;
    const now = this.totalNitrogen();
    const expected = L.initial + L.imported - L.exported + L.air;
    const err = Math.abs(now - expected) / Math.max(1, now);
    L.lastErr = err;
    if (err > L.maxErr) L.maxErr = err;
    if (this.debug && err > 0.001) console.warn('[nitrogen] conservation error', (err * 100).toFixed(4) + '%', { now, expected });
    return { now, expected, err };
  };

  // ---------- saves ----------

  const r3 = v => Math.round(v * 1000) / 1000;
  const ARRAYS = ['nh4', 'no2', 'no3', 'salt', 'urea', 'uric', 'detrN', 'sw', 'comp', 'peat'];

  W._cyclesState = function () {
    const o = { gw: this.gw, gwN: this.gwN, gwRef: this.gwRef, lake: this.lake, co2: this.co2, tOffset: this.tOffset, dic: this.dic,
      climateTrend: this.climateTrend, climateRound: this.climateRound, decompRef: this.decompRef, wrng: this.wrng.s, rainEvents: this.rainEvents, cum: this.cumCycles };
    for (const k of ARRAYS) o[k] = Array.from(this[k], r3);
    return o;
  };

  // Loaded worlds: rebuild the water line from the elevation map, then restore the pools (older saves start fresh).
  W._restoreCycles = function (c) {
    const n = this.N * this.N;
    const elevs = Array.from(this.elev).sort((a, b) => a - b);
    this.waterLine = elevs[Math.floor(elevs.length * this.biome.water)];
    this.waterTiles = 0;
    for (let i = 0; i < n; i++) this.waterTiles += this.terrain[i];
    this.tOffset = c ? c.tOffset || 0 : 0;
    this.co2 = c ? c.co2 : B.climate.co2Start;
    this._initCycles(!c);
    if (c) {
      for (const k of ARRAYS) if (c[k]) this[k].set(c[k]);
      this.gw = c.gw; this.gwN = c.gwN || 0; this.gwRef = c.gwRef; this.lake = c.lake || 0; this.dic = c.dic || 0;
      this.climateTrend = !!c.climateTrend; this.climateRound = c.climateRound; this.decompRef = c.decompRef; this.rainEvents = c.rainEvents || [];
      if (c.cum) this.cumCycles = c.cum;
      if (c.wrng != null) this.wrng.s = c.wrng;
      for (let i = 0; i < n; i++) if (this.terrain[i] === 0) this.moist[i] = this.sw[i];
      this._refreshSoilIndex();
    }
    this._envelope();
  };

  // Map summary for the HUD, report and tools.
  W.soilSummary = function () {
    const n = this.N * this.N;
    let nh4 = 0, no3 = 0, salt = 0, sw = 0, comp = 0, land = 0, compacted = 0, waterlogged = 0, peat = 0;
    for (let i = 0; i < n; i++) {
      peat += this.peat[i];
      if (this.terrain[i] === 1) continue;
      land++;
      nh4 += this.nh4[i]; no3 += this.no3[i]; salt += this.salt[i]; sw += this.sw[i]; comp += this.comp[i];
      if (this.comp[i] > B.soil.anaerobicAt) compacted++;
      if (this.sw[i] > B.water.waterlogged) waterlogged++;
    }
    const cb = this.cbook;
    const released = this.ledger.heat - cb.heatAtStart;
    return {
      nh4, no3, salt, land,
      moisture: land ? sw / land : 0, compaction: land ? comp / land : 0,
      compactedShare: land ? compacted / land : 0, waterloggedShare: land ? waterlogged / land : 0,
      nLimitedShare: cb.tileTicks ? cb.nLimitedTicks / cb.tileTicks : 0,
      fixation: cb.fixLegume + cb.fixFree + cb.fixLightning,
      losses: cb.denitrified + cb.leachedToWater + cb.leachedToGround,
      waterTable: clamp(this.gw / (this.gwRef || 1), 0, 2),
      co2: this.co2, tOffset: this.tOffset, peat,
      carbonAbsorbed: cb.absorbed + cb.ocean, carbonReleased: released,
      carbonBalance: cb.absorbed + cb.ocean - released,
    };
  };
})(window.Trophic);
