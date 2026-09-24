// Keystone — the steward's community (P3-M7, part 3): stakeholders with competing asks, trust and the mandate,
// arrivals and departures (the Changing community option), and land sales with conservation easement bids.
// Stakeholders hold parcels of the map the steward can't manage; public land and easements they can.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const SB = () => B.stakeholders;
  const SH = (T.Stakeholders = {});

  // ---------- the ten stakeholder types ----------
  // likes / dislikes: management actions that raise or lower their trust when the steward does them.
  // land: holds a parcel of the map. weight(biome, w): how likely they are in this world.
  SH.TYPES = {
    rancher: { name: 'Ranching family', land: true, likes: ['exclosure'], dislikes: ['reintroduce', 'protect', 'disc'], asks: ['stock', 'predators'],
      weight: b => (b === 'grassland' || b === 'desert' ? 3 : 1) },
    farmer: { name: 'Farmers and irrigators', land: true, likes: ['legumes', 'plant'], dislikes: ['wetland', 'water'], asks: ['water', 'pollination'],
      weight: b => (b === 'grassland' ? 2 : 1) },
    timber: { name: 'Timber company', land: true, likes: ['reforest', 'timber'], dislikes: ['protect', 'corridor'], asks: ['timber'],
      weight: (b, w) => (T.Steward.forestCover(w) > 0.15 ? 3 : 0.2) },
    hunters: { name: 'Hunters and anglers', land: false, likes: ['exclosure', 'overseed'], dislikes: ['protect'], asks: ['game'],
      weight: () => 2 },
    conservation: { name: 'Conservation group', land: false, likes: ['protect', 'corridor', 'reintroduce', 'control', 'overseed'], dislikes: ['disc', 'timber'], asks: ['protect', 'native'],
      weight: () => 2 },
    outfitters: { name: 'Outfitters and tourism', land: false, likes: ['reintroduce', 'wetland'], dislikes: ['disc', 'timber', 'burn'], asks: ['sighting'],
      weight: () => 1.5 },
    utility: { name: 'Town water utility', land: false, likes: ['buffer', 'wetland', 'water'], dislikes: ['disc'], asks: ['nitrate'],
      weight: (b, w) => (w.terrain.reduce((a, t) => a + (t ? 1 : 0), 0) > 0.05 * w.N * w.N ? 2 : 0.5) },
    beekeepers: { name: 'Beekeepers and orchardists', land: false, likes: ['plant', 'legumes'], dislikes: [], asks: ['flowers'],
      weight: () => 1 },
    traditional: { name: 'Traditional land users', land: true, likes: ['burn', 'reintroduce'], dislikes: ['timber'], asks: ['cultural'],
      weight: () => 1 },
    research: { name: 'Research station', land: false, likes: ['survey-count', 'survey-camera', 'survey-traps', 'survey-pitfall', 'survey-water', 'collar', 'monitor'], dislikes: [], asks: ['survey'],
      weight: () => 1 },
  };
  const NAMES = {
    rancher: ['the Halvorsen ranch', 'the Two Creeks ranch', 'the Delgado family ranch', 'the Box R ranch'],
    farmer: ['the Riverbend co-op', 'the Nakamura farms', 'the county irrigation district'],
    timber: ['Ridgeline Timber', 'North Fork Lumber'],
    hunters: ['the county sportsmen’s club', 'the rod and gun club'],
    conservation: ['the Prairie Land Trust', 'the local Audubon chapter', 'the watershed alliance'],
    outfitters: ['Wild Country Outfitters', 'the lodge and guide service'],
    utility: ['the town water utility'],
    beekeepers: ['the valley beekeepers', 'Sunfield orchards'],
    traditional: ['the tribal natural resources office', 'the traditional gatherers’ council'],
    research: ['the university field station', 'the state research station'],
  };

  // The community draws from its own random stream (kept in the run), so it never shifts the simulation's.
  function srng(w) {
    const st = w.run.stake;
    return { next() { const r = new T.RNG(st.rs), v = r.next(); st.rs = r.s; return v; }, int(n) { return Math.floor(this.next() * n); } };
  }

  // ---------- generation ----------

  SH.init = function (w, run, opts) {
    run.stake = { rs: ((w.seed * 2246822519) ^ 0x27d4eb2f) >>> 0 };
    const P = SB(), rng = srng(w), biome = w.biomeClass.id;
    const sc = run.scenario ? T.scenarioById(run.scenario) : null;
    const want = (sc && sc.stakeholders) || [];
    // opts.community === false: no stakeholders and all land public (the checks of the ecology use this).
    const n = opts.community === false ? 0 : Math.max(want.length, P.count[0] + rng.int(P.count[1] - P.count[0] + 1));
    const types = n ? want.slice() : [];
    while (types.length < n) {
      const pool = Object.keys(SH.TYPES).filter(t => !types.includes(t));
      const ws = pool.map(t => SH.TYPES[t].weight(biome, w));
      let r = rng.next() * ws.reduce((a, b) => a + b, 0), k = 0;
      while (k < pool.length - 1 && (r -= ws[k]) > 0) k++;
      types.push(pool[k]);
    }
    Object.assign(run.stake, { list: [], asks: [], sale: null, log: [], changing: n > 0 && opts.changing !== false, mandateHistory: [] });
    w.landUse = new Uint8Array(w.N * w.N);        // 0 public, 1 private, 2 easement, 3 developed
    w.parcelOwner = new Int16Array(w.N * w.N).fill(-1);
    w.parcels = [];
    for (const t of types) SH.add(w, run, t, P.startTrust[0] + rng.int(P.startTrust[1] - P.startTrust[0] + 1));
    run.stake.mandate = SH.mandate(run);
    SH.newAsks(w, run);
  };

  // A stakeholder joins: its demand, flexibility and influence, and (for landholders) a parcel of the map.
  SH.add = function (w, run, type, trust, parcel) {
    const rng = srng(w), Ty = SH.TYPES[type], list = run.stake.list;
    const names = NAMES[type].filter(nm => !list.some(s => s.name === nm));
    const s = { id: list.length, type, name: names.length ? names[rng.int(names.length)] : Ty.name, trust, influence: +(0.6 + rng.next() * 1.4).toFixed(2),
      demand: +(0.6 + rng.next() * 0.8).toFixed(2), flex: 1 + rng.int(3), refused: 0, active: true, joined: run.round, parcel: null };
    list.push(s);
    if (Ty.land) s.parcel = parcel != null ? parcel : SH.claimParcel(w, s);
    if (s.parcel != null) { const p = w.parcels[s.parcel]; p.owner = s.id; p.use = 'private'; paintParcel(w, p); }
    return s;
  };

  // Parcels: blocks of the map (a 4 × 4 grid of blocks). A landholder takes one or two unclaimed blocks with land.
  SH.claimParcel = function (w, s) {
    const G = 4, bs = w.N / G, rng = srng(w);
    const free = [];
    for (let by = 0; by < G; by++) for (let bx = 0; bx < G; bx++) {
      const taken = w.parcels.some(p => p.blocks.some(b => b[0] === bx && b[1] === by));
      if (taken) continue;
      let land = 0;
      for (let y = by * bs; y < (by + 1) * bs; y++) for (let x = bx * bs; x < (bx + 1) * bs; x++) if (!w.terrain[y * w.N + x]) land++;
      if (land > bs * bs * 0.4) free.push([bx, by]);
    }
    // Keep at least half the land public.
    const privateBlocks = w.parcels.reduce((a, p) => a + (p.use !== 'public' ? p.blocks.length : 0), 0);
    if (!free.length || privateBlocks >= G * G * SB().maxPrivateShare) return null;
    const first = free.splice(rng.int(free.length), 1)[0], blocks = [first];
    const next = free.find(b => Math.abs(b[0] - first[0]) + Math.abs(b[1] - first[1]) === 1);
    if (next && rng.next() < 0.5) blocks.push(next);
    w.parcels.push({ id: w.parcels.length, blocks, owner: s.id, use: 'private', tiles: 0 });
    return w.parcels.length - 1;
  };
  function paintParcel(w, p) {
    const G = 4, bs = w.N / G, code = { public: 0, private: 1, easement: 2, developed: 3 }[p.use];
    p.tiles = 0;
    for (const [bx, by] of p.blocks) for (let y = by * bs; y < (by + 1) * bs; y++) for (let x = bx * bs; x < (bx + 1) * bs; x++) {
      const i = y * w.N + x;
      if (w.terrain[i]) continue;
      w.landUse[i] = code; w.parcelOwner[i] = p.use === 'private' ? p.owner : -1; p.tiles++;
    }
  }
  // Can the steward work this tile? Public land and easements, yes; private and developed land, no.
  SH.manageable = (w, i) => !w.landUse || w.landUse[i] === 0 || w.landUse[i] === 2;

  // ---------- trust and the mandate ----------

  const active = run => run.stake.list.filter(s => s.active);
  SH.mandate = function (run) {
    const a = active(run), tw = a.reduce((x, s) => x + s.influence, 0);
    return tw ? Math.round(a.reduce((x, s) => x + s.influence * s.trust, 0) / tw) : 50;
  };
  SH.adjust = function (run, s, d, why) {
    const before = s.trust;
    s.trust = Math.max(0, Math.min(100, s.trust + d));
    if (Math.round(s.trust) !== Math.round(before)) run.stake.log.push({ round: run.round, who: s.name, d: Math.round(s.trust - before), why });
  };

  // Allies (trust > 70) make the actions they like cheaper; opponents (< 30) make the ones they dislike dearer.
  SH.costFactor = function (run, id) {
    if (!run || !run.stake) return 1;
    let f = 1;
    for (const s of active(run)) {
      const Ty = SH.TYPES[s.type];
      if (s.trust > SB().ally && Ty.likes.includes(id)) f *= SB().allyDiscount;
      if (s.trust < SB().opponent && Ty.dislikes.includes(id)) f *= SB().opponentMarkup;
    }
    return f;
  };

  // Each action done this round pleases those who like it and upsets those who dislike it.
  SH.onActions = function (run, ids) {
    for (const s of active(run)) {
      const Ty = SH.TYPES[s.type];
      for (const id of new Set(ids)) {
        const a = T.Steward.actionById(id);
        if (Ty.likes.includes(id)) SH.adjust(run, s, SB().likeGain, a.name);
        if (Ty.dislikes.includes(id)) SH.adjust(run, s, -SB().dislikeLoss, a.name);
      }
    }
  };

  // ---------- asks ----------

  // Each round 1–3 asks arrive from different stakeholders; the steward accepts or declines each in Plan.
  SH.newAsks = function (w, run) {
    const rng = srng(w), P = SB(), list = active(run).slice();
    run.stake.asks = [];
    const n = Math.min(list.length, 1 + rng.int(3));
    for (let k = 0; k < n; k++) {
      const s = list.splice(rng.int(list.length), 1)[0];
      const kinds = SH.TYPES[s.type].asks;
      const ask = makeAsk(w, run, s, kinds[rng.int(kinds.length)]);
      if (ask) run.stake.asks.push(ask);
    }
  };

  const pops = w => w.countPops().count;
  const known = (run, sp) => T.Knowledge.known(run, sp);
  const pick = (w, list) => (list.length ? list[srng(w).int(list.length)] : null);
  function makeAsk(w, run, s, kind) {
    const p = pops(w), P = SB(), reward = Math.round(P.askReward * s.demand);
    const base = { from: s.id, kind, reward, state: 'open', round: run.round };
    const liveSp = f => w.species.filter(sp => p[sp.idx] > 0 && !sp.transient && f(sp));
    const kgOf = sp => (sp.meta && sp.meta.massKg ? sp.meta.massKg : sp.stats.mass * sp.stats.mass * 0.1);
    switch (kind) {
      case 'stock': {
        const cattle = w.species.find(sp => sp.domestic && p[sp.idx] > 0);
        if (!cattle) return makeAsk(w, run, s, 'predators');
        const q = Math.max(2, Math.round(p[cattle.idx] * (0.5 + 0.3 * s.demand)));
        return Object.assign(base, { species: cattle.id, target: q, text: 'Keep at least ' + q + ' cattle on the ranch through this round (no deep cuts to the herd).' });
      }
      case 'predators': {
        const sp = pick(w, liveSp(sp => (sp.level === 'carnivore1' || sp.level === 'carnivore2') && !sp.grid && known(run, sp) && kgOf(sp) >= 5));
        if (!sp) return null;
        const q = Math.max(1, Math.round(p[sp.idx] * 0.3));
        return Object.assign(base, { species: sp.id, target: q, text: 'Take ' + q + ' ' + sp.name + ' this round: they’re taking stock.' });
      }
      case 'game': {
        const sp = pick(w, liveSp(sp => sp.level === 'herbivore' && !sp.grid && !sp.domestic && kgOf(sp) >= 1 && T.Knowledge.level(run, sp) >= 2));
        if (!sp) return makeAsk(w, run, s, 'survey');
        const q = Math.max(1, Math.round(p[sp.idx] * 0.1 * s.demand));
        return Object.assign(base, { species: sp.id, target: q, text: 'Open a season: a harvest limit of at least ' + q + ' ' + sp.name + ' this round.' });
      }
      case 'protect': {
        const sp = pick(w, liveSp(sp => sp.meta && ['NT', 'VU', 'EN', 'CR'].includes(sp.meta.iucn))) || pick(w, liveSp(sp => sp.meta && sp.meta.native && p[sp.idx] < 20 && !sp.grid));
        if (!sp) return makeAsk(w, run, s, 'native');
        // They may champion a species the steward hasn't found yet: the ask names it, which counts as a report.
        if (!known(run, sp)) { const r = run.know[sp.id] || (run.know[sp.id] = { level: 0, sightings: [], estimates: [], surveyRounds: [], collared: null }); r.level = 1; r.found = 'report'; }
        return Object.assign(base, { species: sp.id, text: 'Protect ' + sp.name + ' (a standing Protect order this round).' });
      }
      case 'native': {
        const now = T.Steward.nativeCover(w), t = Math.min(0.95, now + 0.02);
        return Object.assign(base, { target: t, text: 'Raise native plant cover to ' + Math.round(t * 100) + '% (it’s ' + Math.round(now * 100) + '% now).' });
      }
      case 'sighting': {
        const sp = pick(w, liveSp(sp => known(run, sp) && !sp.grid && (sp.level === 'carnivore2' || kgOf(sp) >= 20 || (sp.meta && sp.meta.taxon === 'raptor'))));
        if (!sp) return Object.assign(base, { kind: 'noDisturb', text: 'No discing, burns or timber harvest this round: it’s the visitor season.' });
        const q = Math.max(1, Math.round(p[sp.idx] * 0.6));
        return Object.assign(base, { species: sp.id, target: q, text: 'Keep ' + sp.name + ' for our visitors: at least ' + q + ' at the end of the round.' });
      }
      case 'water': return Object.assign(base, { kind: 'water', text: 'Don’t cap irrigation this round.' });
      case 'pollination': case 'flowers': {
        const pol = w.pollinators && w.pollinators.filter(sp => p[sp.idx] > 0);
        if (kind === 'flowers' || !pol || !pol.length) return Object.assign(base, { kind: 'flowers', text: 'Plant natives or legumes somewhere this round, for the bees.' });
        const sp = pick(w, pol);
        return Object.assign(base, { kind: 'pollination', species: sp.id, target: Math.round(p[sp.idx] * 0.8), text: 'Keep ' + sp.name + ' pollinating our fields: at least ' + Math.round(p[sp.idx] * 0.8) + ' at the end of the round.' });
      }
      case 'timber': {
        const q = Math.max(5, Math.round(20 * s.demand));
        return Object.assign(base, { target: q, text: 'Harvest timber from at least ' + q + ' mature forest tiles this round.' });
      }
      case 'nitrate': return Object.assign(base, { text: 'Keep nitrogen lost to leaching and denitrification below what’s fixed this round.' });
      case 'cultural': {
        const sp = pick(w, liveSp(sp => sp.meta && sp.meta.native && !sp.grid && kgOf(sp) >= 1)) || pick(w, liveSp(sp => !sp.grid && kgOf(sp) >= 1));
        if (!sp || srng(w).next() < 0.4) return Object.assign(base, { kind: 'burn', text: 'Hold a cultural burn (a prescribed burn) this round.' });
        return Object.assign(base, { species: sp.id, target: Math.max(2, Math.round(p[sp.idx] * 0.7)), text: 'Keep ' + sp.name + ', a culturally important species: at least ' + Math.max(2, Math.round(p[sp.idx] * 0.7)) + ' at the end of the round.' });
      }
      case 'survey': {
        const sp = pick(w, liveSp(sp => known(run, sp)));
        if (!sp) return null;
        return Object.assign(base, { species: sp.id, text: 'Survey ' + sp.name + ' this round (any survey that estimates it, or a radio collar).' });
      }
    }
    return null;
  }

  SH.answer = function (run, k, accept) {
    const a = run.stake.asks[k];
    if (!a || a.state !== 'open') return;
    a.state = accept ? 'accepted' : 'declined';
    const s = run.stake.list[a.from];
    if (!accept) {
      s.refused++;
      // Past their flexibility, each refusal costs more.
      SH.adjust(run, s, -(SB().declineLoss + Math.max(0, s.refused - s.flex) * SB().declineLoss), 'declined: ' + a.text);
    }
  };

  // At round end: was each accepted ask met?
  function met(w, run, a, done) {
    const p = pops(w), sp = a.species ? w.speciesById(a.species) : null;
    switch (a.kind) {
      case 'stock': case 'sighting': case 'pollination': case 'cultural': return sp && p[sp.idx] >= a.target;
      case 'predators': return sp && w.harvested && w.harvested[sp.idx] && w.harvested[sp.idx].n >= a.target;
      case 'game': return sp && (run.harvest[sp.id] || 0) >= a.target;
      case 'protect': return sp && w.protected.has(sp.id);
      case 'native': return T.Steward.nativeCover(w) >= a.target;
      case 'noDisturb': return !done.some(id => ['disc', 'burn', 'timber'].includes(id));
      case 'water': return !done.includes('water');
      case 'flowers': return done.includes('plant') || done.includes('legumes');
      case 'burn': return done.includes('burn');
      case 'timber': return (run.timberTiles || 0) >= a.target;
      case 'nitrate': { const s = w.soilSummary(); return s.losses <= s.fixation; }
      case 'survey': { const r = run.know[a.species]; return !!r && (r.surveyRounds.includes(run.round) || (r.collared && r.collared.round === run.round)); }
    }
    return false;
  }

  // ---------- round end ----------

  SH.roundEnd = function (w, run, events) {
    const P = SB(), st = run.stake, rng = srng(w), out = { asks: [], changes: [], sale: null };
    const done = run.doneActions || [];
    // Asks.
    for (const a of st.asks) {
      const s = st.list[a.from];
      if (a.state === 'accepted') {
        if (met(w, run, a, done)) { SH.adjust(run, s, P.askTrust, 'ask met'); run.sp += a.reward; out.asks.push({ text: a.text, who: s.name, ok: true, reward: a.reward }); }
        else { SH.adjust(run, s, -P.failLoss, 'ask accepted but not met'); out.asks.push({ text: a.text, who: s.name, ok: false }); }
      } else if (a.state === 'open') { SH.adjust(run, s, -P.declineLoss, 'ask ignored'); s.refused++; }
    }
    // A land sale the steward didn't bid on goes to another buyer.
    if (st.sale && st.sale.round < run.round) out.sale = SH.settleSale(w, run, false);
    // Arrivals and departures.
    if (st.changing) {
      const drought = events.includes('drought'), apex = w.species.some(sp => sp.level === 'carnivore2' && pops(w)[sp.idx] > 0 && run.reintroduced.includes(sp.id));
      for (const s of active(run)) {
        let p = P.leaveChance + (s.trust < P.opponent ? 0.05 : 0);
        if (drought && (s.type === 'rancher' || s.type === 'farmer')) p += 0.15;   // a drought can ruin a ranch
        if (rng.next() < p && active(run).length > 2) {
          s.active = false; s.left = run.round;
          out.changes.push(s.name + ' left');
          if (s.parcel != null && !st.sale) {
            const pc = w.parcels[s.parcel];
            const demand = 0.8 + rng.next() * 0.6;
            const allies = active(run).filter(o => o.trust > P.ally).length;
            st.sale = { parcel: s.parcel, from: s.name, round: run.round, price: Math.max(5, Math.round(pc.tiles * P.pricePerTile * demand * (1 - P.allyShare * allies))), allies };
            out.changes.push('its land is for sale: bid ' + st.sale.price + ' SP for a conservation easement next Plan');
          }
        }
      }
      let pa = P.arriveChance + (apex ? 0.15 : 0);   // a returning wolf pack can draw tourism
      if (active(run).length < P.count[1] && rng.next() < pa) {
        const pool = Object.keys(SH.TYPES).filter(t => !active(run).some(s => s.type === t) && !SH.TYPES[t].land);
        const t = apex && pool.includes('outfitters') ? 'outfitters' : pool[rng.int(pool.length)];
        if (t) { const s = SH.add(w, run, t, 50); out.changes.push(s.name + ' arrived'); }
      }
    }
    st.mandate = SH.mandate(run);
    st.mandateHistory.push(st.mandate);
    SH.newAsks(w, run);   // next round's asks
    return out;
  };

  // The steward's bid for a conservation easement on land for sale.
  SH.bid = function (w, run) {
    const sale = run.stake.sale;
    if (!sale || run.sp < sale.price) return false;
    run.sp -= sale.price;
    SH.settleSale(w, run, true);
    return true;
  };
  // Settle a sale: an easement (the steward won), or a new use rolled by biome and mandate.
  SH.settleSale = function (w, run, won) {
    const sale = run.stake.sale, pc = w.parcels[sale.parcel], rng = srng(w);
    run.stake.sale = null;
    if (won) {
      pc.use = 'easement'; pc.owner = -1; paintParcel(w, pc);
      for (const s of active(run)) if (SH.TYPES[s.type].likes.includes('protect')) SH.adjust(run, s, 5, 'conservation easement');
      return { text: 'You bought a conservation easement on ' + sale.from + '’s land (' + pc.tiles + ' tiles): it’s protected and yours to manage.', use: 'easement' };
    }
    const m = run.stake.mandate, grass = w.biomeClass.id === 'grassland';
    const uses = [['subdivision', m < 50 ? 3 : 1], ['ranch', grass ? 2 : 0.5], ['cropland', grass ? 1.5 : 0.5], ['hunting lease', 1], ['private reserve', m >= 60 ? 2 : 0.7]];
    let r = rng.next() * uses.reduce((a, u) => a + u[1], 0), k = 0;
    while (k < uses.length - 1 && (r -= uses[k][1]) > 0) k++;
    const use = uses[k][0];
    if (use === 'subdivision' || use === 'cropland') {
      // Houses and fields: the land is cleared and stays cleared, and packed down.
      pc.use = 'developed'; pc.owner = -1; paintParcel(w, pc);
      for (let i = 0; i < w.N * w.N; i++) if (w.landUse[i] === 3) { if (w.ptype[i]) w._clearTile(i); w.comp[i] = Math.max(w.comp[i], 0.7); }
      w._computeShade(); w._successionCover(); w.edgeDirty = true;
      if (use === 'cropland') { w.irrigation = (w.irrigation || 0) + 0.2; SH.add(w, run, 'farmer', 45, null); }
    } else {
      const type = use === 'ranch' ? 'rancher' : use === 'hunting lease' ? 'hunters' : 'conservation';
      const s = SH.add(w, run, type, 50, null);
      pc.use = 'private'; pc.owner = s.id; paintParcel(w, pc);
      s.parcel = pc.id;
    }
    return { text: sale.from + '’s land went to another buyer: it’s now ' + (use === 'private reserve' ? 'a private reserve' : use === 'hunting lease' ? 'a hunting lease' : 'a ' + use) + '.', use };
  };

  // ---------- saves ----------

  const W = T.World.prototype;
  W._landState = function () { return this.landUse ? { landUse: Array.from(this.landUse), parcelOwner: Array.from(this.parcelOwner), parcels: this.parcels } : null; };
  W._landRestore = function (s) { if (!s) return; this.landUse = Uint8Array.from(s.landUse); this.parcelOwner = Int16Array.from(s.parcelOwner); this.parcels = s.parcels; };
})(window.Trophic);
