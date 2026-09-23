// Keystone — Phase 2 evolution: inheritance with mutation, speciation by genetic clustering,
// lineage splits, "What evolved" attribution and mutant detection for the player's tray.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const G = T.G, GENES = T.GENES, NG = T.NG;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // Distance weights: neutral markers count double, cosmetic body plan counts half.
  // Discrete and on/off genes are measured against their full range, so one flipped gene can't split a species.
  const W = GENES.map(d => (d.marker ? 2 : d.discrete || d.special || d.cat === 'Body plan' ? 0.5 : 1));
  const WSUM = W.reduce((a, b) => a + b, 0);
  const SCALE = GENES.map(d => (d.max - d.min) * (d.discrete || d.special ? 1 : B.speciationGeneScale) || 1);

  const Evo = (T.Evo = {});

  // Child genome: midparent value (or one parent's for discrete genes) plus Gaussian mutation.
  Evo.inherit = function (w, a, b, sp, muMult) {
    const rng = w.rng;
    const g = new Float32Array(NG);
    const mutab = (a[G.mutability] + b[G.mutability]) / 2;
    const base = B.mutationRate * (sp.mu == null ? 1 : sp.mu) * (muMult || 1) * mutab;   // mu 0: fixed traits (real species)
    const focus = sp.focus || {};
    for (let i = 0; i < NG; i++) {
      const d = GENES[i];
      let v = d.discrete ? (rng.next() < 0.5 ? a[i] : b[i]) : (a[i] + b[i]) / 2;
      const rate = d.marker ? B.markerRate * (muMult || 1) : base * (focus[i] || 1);
      if (rng.next() < rate) {
        if (d.discrete) v += rng.next() < 0.5 ? -1 : 1;
        else if (d.rel) v *= 1 + rng.gauss() * B.mutationSigma * 1.5;
        else v += rng.gauss() * (d.marker ? B.markerSigma : B.mutationSigma) * (d.max - d.min);
      }
      g[i] = clamp(d.discrete ? Math.round(v) : v, d.min, d.max);
    }
    return g;
  };

  // Weighted RMS distance between two genomes, in units of 10% of each gene's range.
  Evo.distance = function (a, b) {
    let s = 0;
    for (let i = 0; i < NG; i++) { const d = (a[i] - b[i]) / SCALE[i]; s += W[i] * d * d; }
    return Math.sqrt(s / WSUM);
  };

  // 2-means clustering of one species. Returns { sizes, dist, assign, members } or null.
  Evo.cluster = function (w, members) {
    const rng = w.rng, n = members.length;
    let c0 = new Float64Array(NG), c1 = new Float64Array(NG);
    const seed = members[rng.int(n)];
    let far = seed, fd = -1;
    for (const e of members) { const d = Evo.distance(e.g, seed.g); if (d > fd) { fd = d; far = e; } }
    let far2 = far; fd = -1;
    for (const e of members) { const d = Evo.distance(e.g, far.g); if (d > fd) { fd = d; far2 = e; } }
    c0.set(far.g); c1.set(far2.g);
    const assign = new Uint8Array(n);
    const dist = (g, c) => { let s = 0; for (let i = 0; i < NG; i++) { const d = (g[i] - c[i]) / SCALE[i]; s += W[i] * d * d; } return s; };
    for (let it = 0; it < 10; it++) {
      let changed = false;
      for (let k = 0; k < n; k++) {
        const a = dist(members[k].g, c0) <= dist(members[k].g, c1) ? 0 : 1;
        if (a !== assign[k]) { assign[k] = a; changed = true; }
      }
      const s0 = new Float64Array(NG), s1 = new Float64Array(NG);
      let n0 = 0, n1 = 0;
      for (let k = 0; k < n; k++) {
        const g = members[k].g;
        if (assign[k]) { n1++; for (let i = 0; i < NG; i++) s1[i] += g[i]; }
        else { n0++; for (let i = 0; i < NG; i++) s0[i] += g[i]; }
      }
      if (n0) for (let i = 0; i < NG; i++) c0[i] = s0[i] / n0;
      if (n1) for (let i = 0; i < NG; i++) c1[i] = s1[i] / n1;
      if (!changed && it > 0) break;
    }
    let n1 = 0;
    for (let k = 0; k < n; k++) n1 += assign[k];
    return { sizes: [n - n1, n1], dist: Evo.distance(c0, c1), assign, c0, c1 };
  };

  // Once per round: split any species whose population has formed two distinct clusters for 2 rounds.
  Evo.checkSpeciation = function (w, round) {
    const events = [];
    const living = () => w.species.filter(s => (w.popCount[s.idx] || 0) > 0 || w.countPops().count[s.idx] > 0).length;
    for (const sp of w.species.slice()) {
      if (sp.transient) continue;
      const members = w.ents.filter(e => e.alive && e.sp === sp);
      sp.lastClusterDist = 0;
      if (members.length < B.speciationMinPop) { sp.splitStreak = 0; continue; }
      const c = Evo.cluster(w, members);
      sp.lastClusterDist = c.dist;
      const small = Math.min(c.sizes[0], c.sizes[1]);
      // Clonal (asexual) lineages drift apart freely, so they need a much larger gap to count as new species.
      const need = B.speciationDistance * (sp.flags.asexual ? 2 : 1);
      if (small < B.speciationMinCluster || c.dist <= need) { sp.splitStreak = 0; continue; }
      sp.splitStreak++;
      if (sp.splitStreak < B.speciationHold || living() >= B.speciesCap) continue;
      const smallIdx = c.sizes[0] <= c.sizes[1] ? 0 : 1;
      const branch = members.filter((e, k) => c.assign[k] === smallIdx);
      events.push(Evo.split(w, sp, branch, round, c.dist));
      sp.splitStreak = 0;
    }
    return events;
  };

  Evo.split = function (w, sp, branch, round, dist) {
    const rng = w.rng;
    const mean = new Float32Array(NG);
    for (const e of branch) for (let i = 0; i < NG; i++) mean[i] += e.g[i] / branch.length;
    const name = T.Gen ? T.Gen.daughterName(sp.name, w.species.map(s => s.name), rng, mean) : sp.name + ' II';
    let eats = sp.eats.slice();
    if (sp.isPlayer) {
      eats = [...sp.foods];
      for (const b of w.species) if (b !== sp && w.edible[sp.idx][b.idx]) eats.push(b.id);
    }
    const def = {
      id: sp.id.split('~')[0] + '~' + round + '-' + rng.int(10000), name, level: sp.level, archetype: sp.archetype, archetypeName: sp.archetypeName,
      base: Object.assign({}, sp.base), eats, flags: Object.assign({}, sp.flags), genome: mean,
      startPop: branch.length, herdSize: sp.herdSize, hue: (sp.hue || 0) + (rng.next() < 0.5 ? -1 : 1) * (8 + rng.int(10)),
      parentId: sp.id, originRound: round, descendant: sp.isPlayer || sp.descendant, mu: sp.mu,
      behavior: sp.behavior, weakness: sp.weakness,
    };
    const child = w.addSpecies(def, false);
    child.initialPop = branch.length;
    child.splitDist = dist;
    for (const e of branch) { e.sp = child; e.num = ++child.counter; w._restat(e); }
    // Anything that hunted the parent also hunts the new species.
    for (const a of w.species) {
      if (a === child || a.isPlayer) continue;
      if (w.edible[a.idx][sp.idx] && !a.eats.includes(child.id)) a.eats.push(child.id);
    }
    w.updateMeans();
    const pops = w.countPops().count;
    return { parent: sp, child, dist, nParent: pops[sp.idx], nChild: pops[child.idx], player: sp.isPlayer, round };
  };

  // Player chose to keep the new branch: swap control.
  Evo.swapPlayerBranch = function (w, ev) {
    const oldP = ev.parent, newP = ev.child;
    w.convertToNPC(oldP);
    oldP.descendant = true;
    w.convertToPlayer(newP);
    newP.descendant = false;
    w.rebuildDiet();
  };

  // Mean shifts above 0.25 levels this round, each with its main cause.
  Evo.whatEvolved = function (w, opts) {
    opts = opts || {};
    const out = [];
    const start = w.roundStartMeans || [];
    for (const sp of w.species) {
      const m0 = start[sp.idx];
      if (!m0 || !sp.n || sp.transient) continue;
      const rs = w.rstats[sp.idx];
      if (sp.n < 8) continue;
      const shifts = [];
      for (const d of GENES) {
        if (d.marker || d.discrete || d.cat === 'Body plan' || d.key === 'mutability') continue;
        const delta = sp.mean[d.i] - m0[d.i];
        const lv = delta / d.step;
        if (Math.abs(lv) >= B.whatEvolvedLevels && Math.abs(delta) >= 0.05 * (d.max - d.min)) shifts.push({ d, delta, lv });
      }
      shifts.sort((a, b) => Math.abs(b.lv) - Math.abs(a.lv));
      for (const s of shifts.slice(0, 2)) {
        out.push({ species: sp.name, level: sp.level, isPlayer: sp.isPlayer, gene: s.d.name, key: s.d.key, delta: s.delta, lv: s.lv,
          cause: causeFor(w, sp, s, rs, m0, opts) });
      }
    }
    // Producers evolve too.
    const p0 = w.roundStartProducers || [], p1 = w.producerMeans();
    w.producers.forEach((P, t) => {
      if (!P || !p0[t] || !p0[t].n) return;
      const dT = p1[t].tough - p0[t].tough;
      if (Math.abs(dT) >= 0.25) out.push({ species: P.name, level: 'producer', gene: 'Toughness', key: 'tough', delta: dT, lv: dT, cause: grazerCause(w, P) });
      const dG = p1[t].growth - p0[t].growth;
      if (Math.abs(dG) >= 0.025) out.push({ species: P.name, level: 'producer', gene: 'Growth rate', key: 'growth', delta: dG, lv: dG * 10, cause: grazerCause(w, P) });
    });
    out.sort((a, b) => Math.abs(b.lv) - Math.abs(a.lv));
    return out.slice(0, 8);
  };

  function grazerCause(w, P) {
    let best = null, bv = 0;
    w.species.forEach((s, i) => { const v = (w.rstats[i].eaten || {})[P.name] || 0; if (v > bv) { bv = v; best = s; } });
    return best ? 'Heavy grazing by ' + (best.isPlayer ? 'your ' : '') + best.name + (best.name.endsWith('s') ? '' : 's') : 'Selection on regrowth';
  }

  const DEFENSIVE = new Set(['speed', 'camo', 'armor', 'spines', 'senses', 'burrow', 'charge', 'social', 'size']);
  const EFFICIENCY = new Set(['fat', 'plantGut', 'meatGut', 'metabolism', 'hibernation', 'symbiotic']);

  function causeFor(w, sp, s, rs, m0, opts) {
    const key = s.d.key;
    if (sp.isPlayer) {
      if (opts.guided && opts.guided[key]) return 'Guided mutation (' + (opts.guided[key] > 0 ? '+' : '') + opts.guided[key] + ')';
      if (opts.mutants && opts.mutants[key]) return 'Mutant spread to half your breeders';
      const mids = rs.birthMids;
      if (mids.length >= 3) {
        const sd = Math.max(sp.sd[s.d.i], s.d.step * 0.05);
        const cut = m0[s.d.i] + (s.delta > 0 ? 0.43 : -0.43) * sd;
        const n = mids.filter(m => (s.delta > 0 ? m[s.d.i] >= cut : m[s.d.i] <= cut)).length;
        const word = s.delta > 0 ? 'Top' : 'Bottom';
        return word + '-' + s.d.name.split(' ')[0].toLowerCase() + ' third parented ' + n + ' of your ' + mids.length + ' young';
      }
      return 'Drift in a small population';
    }
    const causes = {};
    for (const k in rs.deaths) { const c = k.startsWith('starved') ? 'starved' : k; causes[c] = (causes[c] || 0) + rs.deaths[k]; }
    let top = null, tn = 0;
    for (const k in causes) if (causes[k] > tn) { tn = causes[k]; top = k; }
    if (top && top.startsWith('k:') && (DEFENSIVE.has(key) || key === 'boldness')) {
      const killer = w.speciesById(top.slice(2));
      const kn = killer ? (killer.isPlayer ? 'your ' + killer.name : killer.name) + (killer.name.endsWith('s') ? '' : 's') : 'predators';
      if (key === 'boldness' && s.delta < 0) return 'Bold individuals were caught by ' + kn;
      return 'Hunted by ' + kn + '; ' + (s.delta > 0 ? 'the weakest were caught first' : 'selection shifted');
    }
    if (top === 'starved' && (EFFICIENCY.has(key) || key === 'size')) return 'Starvation removed the costliest individuals';
    if (top === 'old') return 'Longer-lived breeders left more young';
    return 'Individuals with ' + (s.delta > 0 ? 'more ' : 'less ') + s.d.name.split(' ·')[0].toLowerCase() + ' left more young';
  }

  // Real outliers among the player's young born this round, for the mutant tray.
  Evo.findMutants = function (w, sp) {
    const cands = {};
    for (const e of w.ents) {
      if (!e.alive || e.sp !== sp || e.born < (w.roundStartT || 0)) continue;
      for (const d of GENES) {
        if (d.marker || d.cat === 'Body plan' || !d.mp) continue;
        const mean = sp.mean[d.i], sd = Math.max(sp.sd[d.i], d.step * 0.1);
        const v = e.g[d.i];
        const up = (v - mean) / d.step;
        if (up < 0.5 || v < mean + 2 * sd) continue;
        if (!cands[d.key] || up > cands[d.key].up) cands[d.key] = { up, e, d, v, mean };
      }
    }
    return Object.values(cands)
      .sort((a, b) => b.up * b.d.mp - a.up * a.d.mp)
      .slice(0, 3)
      .map(c => ({
        num: c.e.num, gene: c.d.key, value: c.v, mean: c.mean, offspring: c.e.offspring, juvenile: c.e.grow < 1,
        price: Math.max(1, Math.round(c.d.mp * (1 - B.cardDiscount))), full: c.d.mp, genome: Array.from(c.e.g), bought: false,
      }));
  };

  // Guided mutation: shift every individual's gene by delta levels; spread and variance are kept.
  Evo.applyGuided = function (w, sp, key, levels) {
    const d = T.GENE_BY_KEY[key];
    for (const e of w.ents) if (e.alive && e.sp === sp) e.g[d.i] = T.clampGene(d.i, e.g[d.i] + levels * d.step);
  };

  // Mutant card: half of the adult breeders take on the mutant's gene value.
  Evo.applyMutant = function (w, sp, key, value) {
    const d = T.GENE_BY_KEY[key];
    const adults = w.ents.filter(e => e.alive && e.sp === sp && e.grow >= 1);
    for (let k = adults.length - 1; k > 0; k--) { const j = w.rng.int(k + 1); const t = adults[k]; adults[k] = adults[j]; adults[j] = t; }
    const n = Math.ceil(adults.length / 2);
    for (let k = 0; k < n; k++) adults[k].g[d.i] = Math.max(adults[k].g[d.i], value);
  };

  // Selection pressure: individuals in the top 25% for pinned genes breed at a lower energy threshold.
  Evo.setPressure = function (w, sp, keys) {
    sp.pressure = keys.map(k => T.G[k]);
    sp.pressureCut = {};
    for (const gi of sp.pressure) {
      const vals = w.ents.filter(e => e.alive && e.sp === sp).map(e => e.g[gi]).sort((a, b) => a - b);
      sp.pressureCut[gi] = vals.length ? vals[Math.floor(vals.length * 0.75)] : Infinity;
    }
  };
})(window.Trophic);
