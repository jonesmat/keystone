// Keystone — what the steward knows (P3-M7, part 2): knowledge levels, sightings, survey methods, staleness, the
// previous steward's records, and the EHI as a range built from what's known.
//   Unknown   the species acts on the map but appears nowhere in the steward's tools
//   Sighted   seen by chance (or caught in a survey): name, level, a sketch and a coarse abundance word
//   Surveyed  a survey estimate of N with an error bar that widens as it ages; stale after 5 rounds
//   Studied   surveyed in 3 or more rounds, or radio-collared: K, diet, age structure and demography
// Records live on the run (plain JSON), so they save with it.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const KB = () => B.knowledge;
  const K = (T.Knowledge = {});
  K.LEVELS = ['unknown', 'sighted', 'surveyed', 'studied'];

  const rec = (run, sp) => run.know[sp.id] || (run.know[sp.id] = { level: 0, sightings: [], estimates: [], surveyRounds: [], collared: null, found: null });

  // Knowledge level of a species right now (estimates go stale).
  K.level = function (run, sp) {
    const r = run.know && run.know[sp.id];
    if (!r) return 0;
    const est = K.estimate(run, sp);
    let lv = r.level;
    // A working radio collar keeps its species Studied.
    if (r.collared && run.round - r.collared.round <= KB().staleAfter) return 3;
    if (lv >= 2 && (!est || est.age > KB().staleAfter)) lv = 1;
    if (lv >= 2 && (r.surveyRounds.length >= KB().studyRounds || r.collared)) lv = 3;
    return lv;
  };
  K.known = (run, sp) => K.level(run, sp) >= 1;
  K.levelName = (run, sp) => K.LEVELS[K.level(run, sp)];

  // The latest estimate, with its error bar widened by age.
  K.estimate = function (run, sp) {
    const r = run.know && run.know[sp.id];
    if (!r || !r.estimates.length) return null;
    const e = r.estimates[r.estimates.length - 1];
    const age = run.round - e.round;
    return { N: e.N, err: e.err + KB().stalePerRound * e.N * Math.max(0, age), round: e.round, age, method: e.method, stale: age > KB().staleAfter,
      trend: r.estimates.length >= 2 && age <= KB().trendFades ? Math.sign(Math.round(e.N - r.estimates[r.estimates.length - 2].N)) : 0 };
  };

  // A coarse abundance word for a sighted species.
  K.abundance = n => (n <= 0 ? 'not seen lately' : n < 10 ? 'rare' : n < 50 ? 'uncommon' : n < 400 ? 'common' : 'abundant');

  // ---------- starting knowledge ----------

  // The previous steward's records: a few key species surveyed 1–5 years before the start. Each was accurate when
  // taken; the population has moved since. Big, day-active, conspicuous species are already sighted.
  K.init = function (w, run, scenario) {
    run.know = {};
    run.soilTests = [];      // { round, tiles, nh4, no3, moisture }
    run.wellGauge = null;    // { round, gw, recharge, withdrawal }
    run.monitoring = [];     // standing surveys repeated every round
    const pops = w.countPops().count, rng = w.rng;
    const key = w.species.filter(sp => pops[sp.idx] > 0 && !sp.transient).map(sp => ({ sp, score: keyScore(w, sp, scenario) })).sort((a, b) => b.score - a.score);
    const n = KB().recordsMin + rng.int(KB().recordsMax - KB().recordsMin + 1);
    for (const { sp } of key.slice(0, n)) {
      const r = rec(run, sp), age = 1 + rng.int(5);
      const drift = Math.exp(rng.gauss() * 0.12 * age);   // what the population was then, as best we can say
      const N = Math.max(1, Math.round(pops[sp.idx] / drift));
      r.level = 2; r.found = 'records';
      r.estimates.push({ N, err: Math.round(N * 0.12), round: 1 - age, method: 'the previous steward’s records' });
      r.surveyRounds.push(1 - age);
    }
    for (const sp of w.species) if (pops[sp.idx] > 0 && conspicuous(w, sp) >= KB().obviousAt && !run.know[sp.id]) { rec(run, sp).level = 1; run.know[sp.id].found = 'obvious'; }
  };
  function keyScore(w, sp, sc) {
    const m = sp.meta || {};
    let s = 0;
    if (sp.domestic) s += 10;
    if (m.iucn && ['VU', 'EN', 'CR'].includes(m.iucn)) s += 8;
    if (sc && m.slot && ['atRisk', 'livestock', 'grazers', 'apex', 'invader', 'forage'].includes(m.slot)) s += 6;
    if (sp.level === 'carnivore2') s += 3;
    s += Math.min(4, conspicuous(w, sp));
    return s + w.rng.next();
  }

  // How easily a species is noticed: body size, day activity, open habitat; swarms of small taxa much less.
  function conspicuous(w, sp) {
    const kg = sp.meta && sp.meta.massKg ? sp.meta.massKg : sp.stats.mass * sp.stats.mass * 0.1;
    let c = Math.pow(Math.max(0.001, kg), 0.3);
    c *= { nocturnal: 0.3, crepuscular: 0.6 }[sp.activity] || 1;
    c *= [1, 0.5, 0.6, 0.7, 1, 0.8][sp.strat != null ? sp.strat : 4];
    if (sp.grid) c *= sp.level === 'decomposer' ? 0.03 : 0.25;
    return c;
  }
  K.conspicuous = conspicuous;

  // ---------- round end: sightings, discoveries ----------

  K.roundEnd = function (w, run) {
    const pops = w.countPops().count, rng = w.rng, found = [];
    for (const sp of w.species) {
      if (sp.transient || !pops[sp.idx]) continue;
      const p = 1 - Math.exp(-KB().sightRate * conspicuous(w, sp) * Math.sqrt(pops[sp.idx]));
      if (rng.next() >= p) continue;
      const r = rec(run, sp);
      // Where it was seen: a random individual, or a random occupied tile of a Population.
      let at = null;
      if (sp.grid) { for (let k = 0; k < 40 && !at; k++) { const i = rng.int(w.N * w.N); if (w.popDensity(sp, i) > 0.5) at = [i % w.N, (i / w.N) | 0]; } }
      else { const list = w.ents.filter(e => e.alive && e.sp === sp); if (list.length) { const e = list[rng.int(list.length)]; at = [Math.round(e.x), Math.round(e.y)]; } }
      if (at) { r.sightings.push({ round: run.round, x: at[0], y: at[1] }); if (r.sightings.length > 12) r.sightings.shift(); }
      r.lastSeen = run.round;
      if (!r.level) { r.level = 1; r.found = 'sighting'; found.push(sp); }
    }
    return found;
  };

  // SP for discoveries (more for an at-risk species).
  K.discoverySP = function (sps) {
    return sps.reduce((a, sp) => a + (sp.meta && ['NT', 'VU', 'EN', 'CR'].includes(sp.meta.iucn) ? KB().discoverAtRisk : KB().discover), 0);
  };

  // ---------- surveys ----------

  // Which species a method can detect, and how well (per individual in the surveyed area).
  const kg = sp => (sp.meta && sp.meta.massKg ? sp.meta.massKg : sp.stats.mass * sp.stats.mass * 0.1);
  K.METHODS = {
    count: { name: 'Point counts and transects', taxa: 'birds, large mammals', p: 0.6,
      fits: sp => !sp.grid && !sp.stats.swim && ((sp.stats.flight && !sp.stats.ecto) || kg(sp) >= 5) && sp.activity !== 'nocturnal' },
    camera: { name: 'Camera traps', taxa: 'nocturnal and cryptic mammals', p: 0.5,
      fits: sp => !sp.grid && !sp.stats.flight && !sp.stats.ecto && !sp.stats.swim && kg(sp) >= 0.3 },
    traps: { name: 'Live traps and mist nets', taxa: 'small mammals, bats, songbirds', p: 0.45,
      fits: sp => !sp.grid && !sp.stats.swim && ((!sp.stats.ecto && kg(sp) < 1) || (sp.meta && ['bat', 'songbird'].includes(sp.meta.taxon))) },
    pitfall: { name: 'Pitfall traps and soil cores', taxa: 'invertebrates, decomposers, reptiles and amphibians', p: 0.5,
      fits: sp => !sp.stats.swim && (sp.grid || sp.stats.ecto) },
    water: { name: 'Dip nets and water sampling', taxa: 'aquatic animals and plankton', p: 0.5,
      fits: sp => sp.stats.swim || (sp.grid && sp.stratum === 'water') },
  };

  // Survey an area with a method: every species the method fits gets an estimate from what was caught.
  K.survey = function (w, run, method, x, y, r) {
    const M = K.METHODS[method], St = T.Steward, pops = w.countPops().count;
    const land = St.tilesIn(w, x, y, r, false);
    const inArea = new Uint8Array(w.N * w.N);
    for (const i of land) inArea[i] = 1;
    let landN = 0, waterN = 0, aLand = 0, aWater = 0;
    for (let i = 0; i < w.N * w.N; i++) { if (w.terrain[i]) { waterN++; if (inArea[i]) aWater++; } else { landN++; if (inArea[i]) aLand++; } }
    const out = [];
    for (const sp of w.species) {
      if (sp.transient || !M.fits(sp)) continue;
      const share = sp.stats.swim ? aWater / Math.max(1, waterN) : aLand / Math.max(1, landN);
      if (share <= 0) continue;
      let caught = 0;
      if (sp.grid) {
        let d = 0;
        for (const i of land) d += w.popDensity(sp, i);
        caught = d * M.p * (0.8 + 0.4 * w.rng.next());
      } else for (const e of w.ents) if (e.alive && e.sp === sp && inArea[w.tileAt(e.x, e.y)] && w.rng.next() < M.p) caught++;
      const r = rec(run, sp);
      if (caught < 0.5 && !r.level) continue;   // nothing caught of a species nobody knows: still unknown
      // Nothing caught in a small part of its habitat says little: inconclusive, not an estimate of zero.
      if (caught < 0.5 && share < KB().zeroNeedsShare) continue;
      const Nest = caught / (M.p * share);
      // Error: sampling (Poisson-like) plus patchiness (animals aren't spread evenly).
      const err = Math.sqrt(Math.max(1, caught)) / (M.p * share) + KB().patchiness * Nest;
      const prev = r.estimates.length && r.estimates[r.estimates.length - 1].round === run.round ? r.estimates.pop() : null;
      // Two surveys in one round combine, weighted by precision.
      const e = prev ? combine(prev, { N: Nest, err }) : { N: Nest, err };
      r.estimates.push({ N: Math.round(e.N), err: Math.max(1, Math.round(e.err)), round: run.round, method: M.name });
      if (r.estimates.length > 12) r.estimates.shift();
      if (!r.surveyRounds.includes(run.round)) r.surveyRounds.push(run.round);
      const wasUnknown = !r.level;
      r.level = Math.max(r.level, 2);
      if (wasUnknown) { r.found = 'survey'; out.push({ sp, discovered: true }); }
      else out.push({ sp });
    }
    return out;
  };
  function combine(a, b) {
    const wa = 1 / Math.max(1, a.err * a.err), wb = 1 / Math.max(1, b.err * b.err);
    return { N: (a.N * wa + b.N * wb) / (wa + wb), err: Math.sqrt(1 / (wa + wb)) };
  }

  // Vegetation transect: native vs non-native cover and the seed bank's make-up along the painted area.
  K.vegetation = function (w, run, x, y, r) {
    const tiles = T.Steward.tilesIn(w, x, y, r, true);
    let native = 0, nonNative = 0, bankNative = 0, bankAll = 0;
    const cover = {};
    for (const i of tiles) {
      const P = w.producers[w.ptype[i]];
      if (P) { cover[P.name] = (cover[P.name] || 0) + 1; if (P.native === false) nonNative++; else native++; }
      for (let k = 0; k < 3; k++) { const Q = w.producers[w.bank[i * 3 + k]]; if (Q) { bankAll++; if (Q.native !== false) bankNative++; } }
    }
    const res = { round: run.round, tiles: tiles.length, nativeShare: (native + nonNative) ? native / (native + nonNative) : 0, bankNative: bankAll ? bankNative / bankAll : 0,
      cover: Object.entries(cover).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => k + ' ' + Math.round(100 * v / tiles.length) + '%') };
    run.vegetation = res;
    return res;
  };

  // Soil test: nitrogen pools and moisture on the area. Well gauge: the water table and this round's recharge vs
  // withdrawal. Both show in the cycles panel until they're 3 rounds old.
  K.soilTest = function (w, run, x, y, r) {
    const tiles = T.Steward.tilesIn(w, x, y, r, true);
    let nh4 = 0, no3 = 0, m = 0;
    for (const i of tiles) { nh4 += w.nh4[i]; no3 += w.no3[i]; m += w.moist[i]; }
    const n = Math.max(1, tiles.length);
    const res = { round: run.round, tiles: tiles.length, nh4: nh4 / n, no3: no3 / n, moisture: m / n, x, y, r };
    run.soilTests.push(res);
    if (run.soilTests.length > 6) run.soilTests.shift();
    return res;
  };
  K.wellGauge = function (w, run) {
    const cb = w.cbook;
    run.wellGauge = { round: run.round, gw: w.gw, ref: w.gwRef, recharge: cb.percolated || 0, withdrawal: cb.irrigation || 0 };
    return run.wellGauge;
  };
  K.fresh = (run, rec) => rec && run.round - rec.round <= KB().instrumentFresh;

  // Radio collar: one individual tracked (its range, diet and fate), and its species counts as studied.
  K.collar = function (w, run, sp) {
    const list = w.ents.filter(e => e.alive && e.sp === sp && e.grow >= 1);
    if (!list.length) return null;
    const e = list[w.rng.int(list.length)];
    e.collared = true;
    const r = rec(run, sp);
    r.collared = { num: e.num, id: e.id, round: run.round, fate: null };
    r.level = Math.max(r.level, 2);
    if (!r.estimates.length) r.estimates.push({ N: w.countPops().count[sp.idx], err: Math.round(w.countPops().count[sp.idx] * 0.5), round: run.round, method: 'radio collar (rough)' });
    return e;
  };

  // ---------- the EHI as the steward sees it ----------

  // Each component's points are certain only as far as the steward knows its inputs; the rest spans its full range.
  K.ehiRange = function (w, run, ehi) {
    const S = w.species.filter(sp => !sp.transient && w.countPops().count[sp.idx] > 0);
    const share = f => (S.length ? S.filter(f).length / S.length : 1);
    const sighted = share(sp => K.level(run, sp) >= 1), surveyed = share(sp => K.level(run, sp) >= 2);
    const soil = run.soilTests.some(t => K.fresh(run, t)) ? 1 : 0, well = K.fresh(run, run.wellGauge) ? 1 : 0;
    const cover = { energy: surveyed, biodiversity: sighted, stability: surveyed, cycles: 0.25 + 0.5 * soil + 0.25 * well, keystone: sighted, habitat: 1, viability: surveyed };
    let lo = 0, hi = 0;
    const comps = ehi.components.map(c => {
      const k = Math.min(1, cover[c.key]), a = c.points * k, b = c.points * k + c.weight * (1 - k);
      lo += a; hi += b;
      return Object.assign({}, c, { lo: a, hi: b, known: k });
    });
    return { lo: Math.round(lo), hi: Math.round(hi), components: comps };
  };
})(window.Trophic);
