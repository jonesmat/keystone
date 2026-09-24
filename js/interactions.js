// Keystone — Phase 3 species interactions and niches (P3-M6, part 2).
// The textbook's seven two-species interactions: neutralism (the default), competition (shared food, with a niche
// overlap score and Gause's early warning), amensalism (big animals trample plants), predation (as before, plus
// parasites that drain hosts without killing them), commensalism (followers that feed near a host), protocooperation
// (cleaners that eat hosts' parasites) and obligate mutualism (a flowering plant sets fruit only where its pollinator
// lives). Every species feeds in a vertical stratum, which sets what it prefers to eat and which predators reach it.
// Also: species richness and Shannon diversity, monoculture pest outbreaks, edge vs interior woodland (interior
// specialists and the cowbird's nest parasitism), and the extinction rate.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const W = T.World.prototype;
  const clamp = T.util.clamp;
  const I = () => B.interactions;

  // ---------- strata ----------

  T.STRATA = ['above canopy', 'canopy', 'midstory', 'understory', 'ground', 'wetland'];
  const SI = { above: 0, air: 0, 'above canopy': 0, canopy: 1, midstory: 2, understory: 3, ground: 4, water: 5, wetland: 5 };
  // Where each consumer stratum prefers to feed (rows) among producer strata (columns).
  const FEED = [
    [0.7, 0.7, 0.7, 0.7, 0.7, 0.7],
    [0.2, 1.0, 0.9, 0.6, 0.4, 0.3],
    [0.2, 0.9, 1.0, 0.8, 0.5, 0.3],
    [0.2, 0.6, 0.8, 1.0, 0.8, 0.4],
    [0.2, 0.4, 0.6, 0.8, 1.0, 0.6],
    [0.2, 0.3, 0.4, 0.4, 0.6, 1.0],
  ];
  // Which prey strata a predator's stratum reaches at full rate; prey elsewhere is harder to get at.
  const REACH = [
    [1, 1, 0, 0, 1, 1],   // raptors and swallows: anything in the open, not under cover
    [1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1],
    [0, 0, 0, 0, 1, 1],
  ];

  T.stratumOfProducer = function (P) {
    if (P.kind === 'aquatic' || P.kind === 'plankton') return 5;
    const h = { tree: 1, shrub: 3, vine: 3, grass: 4, forb: 4, lichen: 4, moss: 4 }[P.habit];
    if (h != null) return h;
    return { woody: 1, tall: 2, vine: 3 }[P.kind] != null ? { woody: 1, tall: 2, vine: 3 }[P.kind] : 4;
  };
  T.stratumOfSpecies = function (sp) {
    if (sp.stratum != null && SI[sp.stratum] != null) return SI[sp.stratum];
    if (sp.flags.swim) return 5;
    if (sp.stats && sp.stats.flight) return sp.stats.meat >= 0.5 ? 0 : 1;
    return 4;
  };

  // Per-species tables, refreshed when species or producers change.
  W._interactionsRefresh = function () {
    const S = this.species;
    for (const sp of S) {
      sp.strat = T.stratumOfSpecies(sp);
      sp.feedMult = this.producers.map(P => (P ? FEED[sp.strat][T.stratumOfProducer(P)] : 1));
      sp.parasiteHost = !sp.transient && !sp.grid && sp.level !== 'decomposer' && !sp.stats.ecto && sp.stats.mass >= I().hostMass;
    }
    this.reach = S.map(a => S.map(b => (REACH[a.strat][b.strat] ? 1 : I().outOfReach)));
    // Followers: each finds its host species (large grazers for flushing followers, predators for kill followers).
    for (const sp of S) {
      sp.hosts = null;
      if (!sp.flags.follower) continue;
      const want = sp.flags.follower;
      const hosts = typeof want === 'string' && want !== 'grazer' && want !== 'predator' ? S.filter(h => h.id === want)
        : want === 'predator' ? S.filter(h => (h.level === 'carnivore1' || h.level === 'carnivore2') && !h.grid && h !== sp && h.stats.mass > sp.stats.mass)
        : S.filter(h => h.level === 'herbivore' && !h.grid && h.stats.mass >= I().flushMass);
      // Never a host that eats the follower.
      sp.hosts = new Set(hosts.filter(h => !(this.edible[h.idx] && this.edible[h.idx][sp.idx])).map(h => h.idx));
    }
    this._pollinatorPairs();
  };

  W.reachMult = function (a, b) { return this.reach && this.reach[a.idx] ? this.reach[a.idx][b.idx] : 1; };

  // ---------- every tick ----------

  W._interactionsTick = function () {
    if (this.t % 10 === 0) this._parasites();
    if (this.t % I().pollinatorEvery === 0) this._pollinatorPresence();
    if (this.edgeDirty) this._computeEdge();
  };

  // ---------- parasites (predation without killing) and cleaners (protocooperation) ----------

  // Warm-blooded vertebrates carry a parasite load that grows on the host's reserves and respires. A heavy load is a
  // steady drain, like a high upkeep. Cleaners eat parasites off hosts, so hosts that visit them pay less.
  W._parasites = function () {
    const P = I(), dt = 10;
    for (const e of this.ents) {
      if (!e.alive || !e.sp.parasiteHost) continue;
      const cap = P.paraCap * e.st.maxE;
      if (e.para < 0.5 && this.rng.next() < P.paraInfect * dt) {
        const seed = Math.min(e.E, 0.5);
        e.E -= seed; e.para += seed;
      }
      if (e.para <= 0) continue;
      const grow = Math.min(e.E, P.paraGrow * e.para * (1 - e.para / cap) * dt);
      const resp = Math.min(e.para, P.paraResp * e.para * dt);
      e.E -= Math.max(0, grow);
      e.para += Math.max(0, grow) - resp;
      this.ledger.heat += resp;
      const rs = this.rstats[e.sp.idx];
      rs.parasiteHeat = (rs.parasiteHeat || 0) + resp;
      rs.parasiteDrain = (rs.parasiteDrain || 0) + Math.max(0, grow) + resp;
    }
  };

  // A cleaner looks for the most parasitized host nearby.
  W._cleanerTarget = function (e) {
    let best = null, bs = 0;
    this.query(e.x, e.y, e.st.sight, (o, d2) => {
      if (o === e || !o.sp.parasiteHost || o.para < 2) return;
      const s = o.para / (1 + Math.sqrt(d2) * 0.3);
      if (s > bs) { bs = s; best = o; }
    });
    return best;
  };

  // The cleaner eats parasites off its host: energy to the cleaner, a lighter load for the host.
  W._clean = function (e, host) {
    const room = e.st.maxE - e.E;
    const amt = Math.min(host.para, e.st.eatRate * 2, room / Math.max(0.1, e.st.meatA));
    if (amt <= 0.01) return 0;
    host.para -= amt;
    this._digest(e, amt, e.st.meatA, 1, 'Parasites', this.tileAt(e.x, e.y), host.sp.level, 0);
    const rs = this.rstats[e.sp.idx];
    rs.cleaned = rs.cleaned || {};
    rs.cleaned[host.sp.idx] = (rs.cleaned[host.sp.idx] || 0) + amt;
    return amt;
  };

  // ---------- commensal followers ----------

  // A follower keeps near a host of its host species: egret-like birds by big grazers (they eat what the grazers
  // flush), scavengers by predators (they eat what the predators leave). A well-fed host isn't a threat to it.
  W._followTarget = function (e) {
    const sp = e.sp;
    if (!sp.hosts || !sp.hosts.size) return null;
    let best = null, bd = Infinity;
    this.query(e.x, e.y, I().followRange, (o, d2) => { if (sp.hosts.has(o.sp.idx) && d2 < bd) { bd = d2; best = o; } });
    return best;
  };
  W.tolerates = function (e, o) {
    return !!(e.sp.hosts && e.sp.hosts.has(o.sp.idx) && o.E > I().satedHost * o.st.maxE);
  };
  // Share of a follower's meal that came thanks to its host (prey flushed, or a kill's leftovers).
  W._commensalBook = function (e, amt, hostIdx) {
    const rs = this.rstats[e.sp.idx];
    rs.commensal = rs.commensal || {};
    rs.commensal[hostIdx] = (rs.commensal[hostIdx] || 0) + amt;
  };
  W.flushBonus = function (e) {
    if (!e.sp.hosts) return -1;
    let host = -1;
    this.query(e.x, e.y, I().flushRadius, o => { if (host < 0 && e.sp.hosts.has(o.sp.idx) && o.sp.level === 'herbivore' && o.st.mass >= I().flushMass) host = o.sp.idx; });
    return host;
  };

  // ---------- amensalism: trampling ----------

  // Big animals crush the plants they walk over; the trampler gains nothing. Trees are spared.
  W._trampleProducers = function (e, i, step) {
    const P = I(), st = e.st;
    if (st.mass < P.trampleMass || !this.ptype[i]) return;
    const Pr = this.producers[this.ptype[i]];
    if (Pr.stage >= 4) return;
    const floor = Pr.max * B.grazeFloor;
    const loss = Math.min(Math.max(0, this.pE[i] - floor), P.trampleK * st.mass * step);
    if (loss <= 0) return;
    this.pE[i] -= loss;
    this.detr[i] += loss;
    this.detrN[i] += loss * Pr.nContent;
    this.pbook.litter[this.ptype[i]] += loss;
    const rs = this.rstats[e.sp.idx];
    rs.trampled = (rs.trampled || 0) + loss;
  };

  // ---------- obligate mutualism: pollination ----------

  // Each insect-pollinated producer (forbs, shrubs and vines; grasses and trees are wind-pollinated) is paired with
  // one pollinator species. It sets fruit only near where that pollinator lives.
  W._pollinatorPairs = function () {
    const pols = this.species.filter(sp => sp.flags.pollinator || (sp.roles && sp.roles.includes('pollinator')));
    this.pollinators = pols;
    for (const P of this.producers) {
      if (!P) continue;
      P.pollinator = null;
      if (!P.fruit || !pols.length || P.habit === 'grass' || P.habit === 'tree' || P.stage === 4) continue;
      let h = 0;
      for (let k = 0; k < P.id.length; k++) h = (h * 31 + P.id.charCodeAt(k)) >>> 0;
      P.pollinator = pols[h % pols.length].idx;
    }
  };

  // Where each pollinator species is: a coarse grid of 8 × 8-tile cells.
  W._pollinatorPresence = function () {
    if (!this.pollinators || !this.pollinators.length) { this.polCells = null; return; }
    const C = I().pollinatorCell, n = Math.ceil(this.N / C), N = this.N;
    const cells = {};
    for (const sp of this.pollinators) cells[sp.idx] = new Uint8Array(n * n);
    for (const e of this.ents) if (e.alive && cells[e.sp.idx]) cells[e.sp.idx][((e.y / C) | 0) * n + ((e.x / C) | 0)] = 1;
    for (const sp of this.pollinators) {
      if (!sp.grid) continue;
      const g = sp.grid, c = cells[sp.idx];
      for (let i = 0; i < N * N; i++) if (g.nA[i] + g.nJ[i] + g.nO[i] > 0.3) c[(((i / N) | 0) / C | 0) * n + ((i % N) / C | 0)] = 1;
    }
    this.polCells = cells; this.polN = n;
  };

  // Can this tile's producer set fruit? Only if its pollinator is in this cell or a neighbouring one.
  W.pollinated = function (i, P) {
    if (P.pollinator == null || !this.polCells) return true;
    const c = this.polCells[P.pollinator];
    if (!c) return true;
    const C = I().pollinatorCell, n = this.polN, cx = ((i % this.N) / C) | 0, cy = ((i / this.N) / C) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < n && y < n && c[y * n + x]) return true;
    }
    return false;
  };

  // ---------- edge and interior ----------

  // Woodland tiles (shrubs and trees) 3 or more tiles from open ground are interior; the rest is edge.
  W._computeEdge = function () {
    const N = this.N, n = N * N, D = I().interiorDist;
    const dist = this.edgeDist || (this.edgeDist = new Uint8Array(n));
    const q = [];
    for (let i = 0; i < n; i++) {
      const Pr = this.producers[this.ptype[i]];
      const wood = !this.terrain[i] && Pr && Pr.stage >= 3;
      if (!wood && !this.terrain[i]) { dist[i] = 0; q.push(i); } else dist[i] = 255;
    }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % N, y = (i / N) | 0, d = dist[i] + 1;
      if (d > D) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const j = yy * N + xx;
        if (dist[j] > d) { dist[j] = d; q.push(j); }
      }
    }
    this.edgeDirty = false;
  };
  W.isInterior = function (i) {
    if (!this.edgeDist || this.edgeDirty) this._computeEdge();
    const Pr = this.producers[this.ptype[i]];
    return !!Pr && Pr.stage >= 3 && !this.terrain[i] && this.edgeDist[i] >= I().interiorDist;
  };
  W.habitatSummary = function () {
    if (!this.edgeDist || this.edgeDirty) this._computeEdge();
    let wood = 0, interior = 0;
    for (let i = 0; i < this.N * this.N; i++) {
      const Pr = this.producers[this.ptype[i]];
      if (this.terrain[i] || !Pr || Pr.stage < 3) continue;
      wood++;
      if (this.edgeDist[i] >= I().interiorDist) interior++;
    }
    return { wood, interior, interiorShare: wood ? interior / wood : 0 };
  };

  // Brood parasitism (the cowbird pattern): a nest parasite lays in the nests of smaller birds breeding near an edge.
  // Returns the parasite species when one of this brood becomes a parasite chick, else null.
  W._nestParasite = function (e) {
    const sp = e.sp, P = I();
    if (!sp.stats.flight || sp.stats.ecto || sp.flags.nestParasite || sp.level === 'carnivore2') return null;
    const i = this.tileAt(e.x, e.y);
    if (this.isInterior(i)) return null;
    let par = null;
    this.query(e.x, e.y, P.parasiteRadius, o => {
      if (!par && o.sp.flags.nestParasite && o.sex === 'F' && o.grow >= 1 && o.st.mass >= sp.stats.mass * 0.5 && o.st.mass <= sp.stats.mass * 4) par = o;
    });
    if (!par || this.rng.next() > P.parasitism) return null;
    const rs = this.rstats[sp.idx];
    rs.parasitized = (rs.parasitized || 0) + 1;
    return par.sp;
  };

  // ---------- diversity, pests and competition ----------

  // Species richness and the Shannon index H = −Σ p ln p over animal counts (the textbook's form), over animal
  // biomass (less swamped by swarms of small taxa), and for plants over tile cover.
  W.diversity = function () {
    const pops = this.countPops(), c = pops.count, en = pops.energy;
    const animals = this.species.filter((sp, i) => c[i] > 0 && !sp.transient);
    const tot = animals.reduce((a, sp) => a + c[sp.idx], 0), totE = animals.reduce((a, sp) => a + en[sp.idx], 0);
    let H = 0, Hb = 0;
    for (const sp of animals) {
      const p = c[sp.idx] / tot; H -= p * Math.log(p);
      const q = en[sp.idx] / totE; if (q > 0) Hb -= q * Math.log(q);
    }
    const cover = new Array(this.producers.length).fill(0);
    let land = 0;
    for (let i = 0; i < this.N * this.N; i++) if (this.ptype[i]) { cover[this.ptype[i]]++; land++; }
    let Hp = 0, plants = 0;
    for (const k of cover) if (k > 0) { plants++; const p = k / land; Hp -= p * Math.log(p); }
    return { richness: animals.length + plants, animals: animals.length, plants, H, Hbiomass: Hb, Hplants: Hp, present: animals.map(sp => sp.id) };
  };

  // Monocultures are unstable: where one producer covers big uniform blocks, pests break out.
  W._monoculturePests = function () {
    const P = I(), N = this.N, n = N * N;
    const cover = new Array(this.producers.length).fill(0);
    let land = 0;
    for (let i = 0; i < n; i++) if (!this.terrain[i]) { land++; if (this.ptype[i]) cover[this.ptype[i]]++; }
    const out = [];
    cover.forEach((k, t) => {
      if (!t || k / Math.max(1, land) < P.monoShare || this.rng.next() > P.pestChance) return;
      const uniform = [];
      for (let i = 0; i < n; i++) {
        if (this.ptype[i] !== t) continue;
        const x = i % N, y = (i / N) | 0;
        let same = 0, all = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
          all++; if (this.ptype[yy * N + xx] === t) same++;
        }
        if (same / all >= 0.9) uniform.push(i);
      }
      if (!uniform.length) return;
      const c = uniform[this.rng.int(uniform.length)], cx = c % N, cy = (c / N) | 0, Pr = this.producers[t];
      let hit = 0;
      for (const i of uniform) {
        if (Math.hypot((i % N) - cx, ((i / N) | 0) - cy) > P.pestRadius) continue;
        const loss = this.pE[i] * P.pestLoss;
        this.pE[i] -= loss; this.detr[i] += loss; this.detrN[i] += loss * Pr.nContent; this.pbook.litter[t] += loss;
        hit++;
      }
      out.push({ producer: Pr.name, tiles: hit });
      this.notes.push('Pest outbreak in the ' + Pr.name + ' monoculture: ' + hit + ' tiles lost half their growth. Monocultures are unstable.');
    });
    return out;
  };

  // Niche overlap per pair of species on the same trophic level: diet overlap (shares of what each ate), times
  // stratum similarity, times activity overlap. Above 0.8 for 3 rounds, Gause's principle predicts a loser.
  W.nicheOverlap = function (a, b) {
    const ra = this.rstats[a.idx], rb = this.rstats[b.idx];
    const ta = Object.values(ra.eaten).reduce((x, y) => x + y, 0), tb = Object.values(rb.eaten).reduce((x, y) => x + y, 0);
    if (ta <= 0 || tb <= 0) return 0;
    let diet = 0;
    for (const k in ra.eaten) if (rb.eaten[k]) diet += Math.min(ra.eaten[k] / ta, rb.eaten[k] / tb);
    const ds = Math.abs(a.strat - b.strat), strat = ds === 0 ? 1 : ds === 1 ? 0.7 : 0.4;
    const act = (x, y) => (!x || !y || x === y ? 1 : x === 'crepuscular' || y === 'crepuscular' ? 0.7 : 0.4);
    return diet * strat * act(a.activity, b.activity);
  };

  W._competition = function (pops) {
    const P = I(), S = this.species, hist = this.overlapHist || (this.overlapHist = {});
    const warn = [];
    for (let x = 0; x < S.length; x++) for (let y = x + 1; y < S.length; y++) {
      const a = S[x], b = S[y];
      if (a.level !== b.level || a.level === 'decomposer' || !pops[x] || !pops[y]) continue;
      const k = a.id + '|' + b.id, o = this.nicheOverlap(a, b);
      hist[k] = o > P.exclusionOverlap ? (hist[k] || 0) + 1 : 0;
      if (hist[k] >= P.exclusionRounds) {
        const da = (this.demography || []).find(d => d.id === a.id), db = (this.demography || []).find(d => d.id === b.id);
        const score = (sp, d) => (d && d.r != null ? d.r : 0) + (sp.K ? 100 * pops[sp.idx] / sp.K : 0);
        const loser = score(a, da) < score(b, db) ? a : b, winner = loser === a ? b : a;
        warn.push({ a: a.name, b: b.name, overlap: o, rounds: hist[k], loser: loser.name, winner: winner.name });
      }
    }
    return warn;
  };

  // ---------- round end ----------

  // The round's interactions, for the report's Interactions card and the tools.
  W._interactionsRoundEnd = function () {
    // Once per round end (the report and beginRound both ask), and not before any round has run.
    if (!this.rstats.length || this.roundStartT == null || this.t === this.roundStartT) return this.lastInteractions || null;
    if (this.interactionsT === this.t) return this.lastInteractions;
    this.interactionsT = this.t;
    const pops = this.countPops().count, S = this.species, out = [];
    const pctOf = (x, rs) => (rs.ingested > 0 ? x / rs.ingested : 0);
    S.forEach((sp, i) => {
      const rs = this.rstats[i];
      if (!rs) return;
      for (const h in rs.commensal || {}) {
        const share = pctOf(rs.commensal[h], rs);
        if (share >= 0.02) out.push({ type: 'commensalism', a: sp.name, b: S[h].name, share, text: plural(sp.name) + ' were commensal with ' + plural(S[h].name) + ' (+' + Math.round(share * 100) + '% of their food ' + (sp.flags.follower === 'predator' || S[h].level.startsWith('carn') ? 'from their kills' : 'flushed by them') + ')' });
      }
      for (const h in rs.cleaned || {}) out.push({ type: 'protocooperation', a: sp.name, b: S[h].name, eu: rs.cleaned[h], text: plural(sp.name) + ' cleaned ' + fmtN(rs.cleaned[h]) + ' EU of parasites off ' + plural(S[h].name) + ' (both gain)' });
      if (rs.trampled > 1) out.push({ type: 'amensalism', a: sp.name, eu: rs.trampled, text: plural(sp.name) + ' trampled ' + fmtN(rs.trampled) + ' EU of plants (they gain nothing; the plants lose)' });
      if (rs.parasitized) out.push({ type: 'parasitism', a: sp.name, n: rs.parasitized, text: rs.parasitized + ' ' + sp.name + ' broods near woodland edges were parasitized by a nest parasite' });
      if (rs.parasiteDrain > 1 && rs.assimilated > 0 && rs.parasiteDrain / rs.assimilated > 0.03) out.push({ type: 'parasitism', a: sp.name, eu: rs.parasiteDrain, text: 'Parasites drained ' + Math.round(100 * rs.parasiteDrain / rs.assimilated) + '% of what ' + plural(sp.name) + ' assimilated' });
    });
    for (let t = 1; t < this.producers.length; t++) {
      const P = this.producers[t];
      if (P.pollinator == null || !this.pbook.unpollinated) continue;
      const lost = this.pbook.unpollinated[t];
      if (lost > 1) out.push({ type: 'mutualism', a: P.name, b: S[P.pollinator].name, eu: lost, text: P.name + ' set ' + fmtN(lost) + ' EU less fruit where its pollinator, ' + S[P.pollinator].name + ', was absent' + (pops[P.pollinator] ? '' : ' (it is gone from the map)') });
    }
    for (const c of this._competition(pops)) out.push({ type: 'competition', a: c.a, b: c.b, text: 'Competitive exclusion warning: ' + plural(c.a) + ' and ' + plural(c.b) + ' have overlapped ' + Math.round(c.overlap * 100) + '% for ' + c.rounds + ' rounds. Gause\'s principle: complete competitors cannot coexist; ' + plural(c.loser) + ' are likely to lose.' });
    // Extinctions (local) this round, and the running rate.
    const gone = S.filter((sp, i) => !sp.transient && this.rstats[i].startPop > 0 && pops[i] === 0);
    this.extinctions = (this.extinctions || []).concat(gone.map(sp => ({ round: this.round, id: sp.id, name: sp.name })));
    const div = this.diversity();
    this.diversityHist = (this.diversityHist || []).concat([{ round: this.round, richness: div.richness, H: div.H, Hplants: div.Hplants }]);
    this.lastInteractions = { round: this.round, items: out, diversity: div, extinctions: gone.map(sp => sp.name),
      extinctionRate: this.extinctions.length / Math.max(1, this.round), habitat: this.habitatSummary() };
    return this.lastInteractions;
  };

  W._interactionsBeginRound = function () {
    if (this.round > 1) this._monoculturePests();
    this.edgeDirty = true;
  };

  const plural = n => (/s$/.test(n) ? n : n + 's');
  const fmtN = v => (v >= 1e4 ? Math.round(v / 1e3) + 'k' : Math.round(v).toLocaleString('en-US'));

  // ---------- saves ----------

  W._interactionsState = function () {
    return { overlapHist: this.overlapHist || {}, extinctions: this.extinctions || [], diversityHist: this.diversityHist || [], keystones: this.keystones || {} };
  };
  W._interactionsRestore = function (s) {
    this.overlapHist = s.overlapHist; this.extinctions = s.extinctions; this.diversityHist = s.diversityHist; this.keystones = s.keystones;
    this.edgeDirty = true;
  };
})(window.Trophic);
