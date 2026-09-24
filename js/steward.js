// Keystone — the steward's game (P3-M7): the Ecosystem Health Index, Stewardship Points, management actions,
// harvest limits, scenario start conditions and restoration goals, and win, loss and score.
// The steward never controls an animal: they change habitat, harvest and which species are present, and the
// community responds. Everything here works on a world and a plain `run` object, so it runs the same in Node.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const W = T.World.prototype;
  const clamp = T.util.clamp;
  const ST = () => B.steward;
  const St = (T.Steward = {});

  // ---------- helpers ----------

  const landTiles = w => { const out = []; for (let i = 0; i < w.N * w.N; i++) if (!w.terrain[i]) out.push(i); return out; };
  const tilesIn = (w, x, y, r, land) => {
    const out = [], N = w.N;
    for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(N - 1, Math.ceil(y + r)); yy++)
      for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(N - 1, Math.ceil(x + r)); xx++) {
        const i = yy * N + xx;
        if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) > r) continue;
        if (land && w.terrain[i]) continue;
        out.push(i);
      }
    return out;
  };
  St.tilesIn = tilesIn;
  const isNative = P => P && P.native !== false;
  // Minimum viable population: enough breeding adults to ride out a bad year (Populations: enough individuals).
  St.mvp = sp => (sp.grid ? ST().mvpPopulation : ST().mvpIndividuals);
  const adults = (w, sp) => (sp.grid ? w.countPops().count[sp.idx] : w.ents.filter(e => e.alive && e.sp === sp && e.grow >= 1).length);

  // ---------- starting a run ----------

  // A run's steward state, and the baseline the Biodiversity component and goals compare against.
  St.startRun = function (w, opts) {
    opts = opts || {};
    const diff = B.difficulties[opts.difficulty || 'standard'];
    const scenario = opts.scenario ? T.scenarioById(opts.scenario) : null;
    if (scenario) St.setupScenario(w, scenario);
    w.updateMeans();
    w.ledger.initial = w.totalPools(); w.nledger.initial = w.totalNitrogen();
    w.ledger.imported = w.ledger.exported = w.ledger.heat = w.ledger.captured = 0;
    w.nledger.imported = w.nledger.exported = w.nledger.air = 0;
    const div = w.diversity(), pops = w.countPops().count;
    const run = {
      scenario: scenario ? scenario.id : null, difficulty: opts.difficulty || 'standard', round: 1,
      sp: diff.startSP, spHistory: [], ehiHistory: [], queue: [], standing: [], harvest: {}, protect: [],
      baseline: { richness: div.richness, animals: div.animals, H: div.H, Hb: div.Hbiomass, forest: St.forestCover(w), native: St.nativeCover(w),
        woody: St.woodyCover(w), waterTable: w.gw, producers: w.producerBiomass(), counts: Object.fromEntries(w.species.map(sp => [sp.id, pops[sp.idx]])),
        nativeAnimals: w.species.filter(sp => sp.meta && sp.meta.native && pops[sp.idx] > 0).length },
      reintroduced: [], recovered: [], lowRounds: 0, collapseRounds: 0, extinct: [], outcome: null,
      popHistory: Object.fromEntries(w.species.map(sp => [sp.id, [pops[sp.idx]]])),
    };
    w.exclosure = new Uint8Array(w.N * w.N);
    w.wetland = new Uint8Array(w.N * w.N);
    w.bareHold = new Uint8Array(w.N * w.N);
    w.harvestMap = new Float32Array(w.N * w.N);   // animals taken per tile (harvest and control), fading each round
    w.harvest = {};
    w.protected = new Set();
    w.run = run;
    T.Knowledge.init(w, run, scenario);
    T.Stakeholders.init(w, run, opts);
    run.mandateLow = 0;
    run.ehi = St.ehi(w, run);
    run.ehiView = T.Knowledge.ehiRange(w, run, run.ehi);
    return run;
  };

  // Scenario start conditions: the damage the steward inherits.
  St.setupScenario = function (w, sc) {
    const land = landTiles(w), rng = w.rng, slot = id => w.species.filter(sp => sp.meta && sp.meta.slot === id);
    const S = sc.damage || {};
    if (S.compaction) for (const i of land) w.comp[i] = Math.max(w.comp[i], S.compaction * (0.8 + 0.4 * rng.next()));
    if (S.overstock) for (const sp of slot(S.overstock.slot)) w.spawnGroup(sp, Math.round(sp.startPop * (S.overstock.factor - 1)), null);
    if (S.bare) {
      // An abandoned field: most tiles bare (the seed bank survives), soil organic matter and nitrogen run down.
      for (const i of land) if (rng.next() < S.bare) { w._clearTile(i); w.som[i] *= 0.4; w.nh4[i] *= 0.5; w.no3[i] *= 0.5; }
    }
    if (S.overbrowsed) for (const i of land) {
      const P = w.producers[w.ptype[i]];
      if (P && P.stage >= 3) { const cut = w.pE[i] * (1 - S.overbrowsed); w.pE[i] -= cut; w.detr[i] += cut; w.detrN[i] += cut * P.nContent; }
    }
    if (S.corner) for (const sp of slot(S.corner)) {
      // The invader starts in one corner.
      for (const e of w.ents) if (e.alive && e.sp === sp) { const p = w._randomLand(6, 6, 5, sp.stats.swim); e.x = e.px = p[0]; e.y = e.py = p[1]; e.home = null; }
    }
    if (S.fragment) {
      // Cleared strips through the woodland: roads and pastures breaking it into pieces.
      const N = w.N;
      for (let k = 0; k < S.fragment; k++) {
        const vertical = k % 2 === 0, at = Math.floor(N * (k + 1) / (S.fragment + 1));
        for (let t = 0; t < N; t++) for (let d = 0; d < 2; d++) {
          const i = vertical ? t * N + at + d : (at + d) * N + t;
          if (!w.terrain[i]) w._clearTile(i);
        }
      }
      w._computeShade(); w.edgeDirty = true;
    }
    if (S.irrigation) { w.irrigation = S.irrigation; w.gw *= S.aquiferStart || 1; }
    if (sc.climateTrend) w.climateTrend = true;
    w._successionCover();
  };

  // ---------- measures used by the EHI and goals ----------

  St.nativeCover = function (w) {
    let land = 0, n = 0;
    for (let i = 0; i < w.N * w.N; i++) { if (w.terrain[i]) continue; land++; const P = w.producers[w.ptype[i]]; if (P && isNative(P)) n++; }
    return land ? n / land : 0;
  };
  St.forestCover = function (w) {
    let land = 0, n = 0;
    for (let i = 0; i < w.N * w.N; i++) { if (w.terrain[i]) continue; land++; const P = w.producers[w.ptype[i]]; if (P && P.stage === 4) n++; }
    return land ? n / land : 0;
  };
  St.woodyCover = function (w) {
    let land = 0, n = 0;
    for (let i = 0; i < w.N * w.N; i++) { if (w.terrain[i]) continue; land++; const P = w.producers[w.ptype[i]]; if (P && P.stage >= 3) n++; }
    return land ? n / land : 0;
  };
  St.levelsPresent = function (w) {
    const pops = w.countPops().count;
    // Trophic levels: producers, primary consumers (herbivores and omnivores), primary carnivores, apex.
    let n = 1;
    if (w.species.some((sp, i) => pops[i] > 0 && (sp.level === 'herbivore' || sp.level === 'omnivore'))) n++;
    if (w.species.some((sp, i) => pops[i] > 0 && sp.level === 'carnivore1')) n++;
    if (w.species.some((sp, i) => pops[i] > 0 && sp.level === 'carnivore2')) n++;
    return n;
  };

  // ---------- the Ecosystem Health Index ----------

  St.COMPONENTS = [
    { key: 'energy', name: 'Energy pyramid integrity', weight: 20 },
    { key: 'biodiversity', name: 'Biodiversity', weight: 20 },
    { key: 'stability', name: 'Population stability', weight: 15 },
    { key: 'cycles', name: 'Nutrient, water and carbon balance', weight: 15 },
    { key: 'keystone', name: 'Keystone and mutualist presence', weight: 10 },
    { key: 'habitat', name: 'Habitat structure', weight: 10 },
    { key: 'viability', name: 'Small-population viability', weight: 10 },
  ];

  // Each component scores 0–1 with its main cause, from what's true in the world (the steward's own estimate
  // comes with knowledge levels).
  St.ehi = function (w, run) {
    const pops = w.countPops().count, out = {};
    const live = w.species.filter((sp, i) => !sp.transient && pops[i] > 0);
    // Energy: levels present, transfer within the mode's band, and a narrowing energy pyramid.
    {
      const lv = St.levelsPresent(w);
      // Energy passed up per level against the textbook's range (1.5–18%).
      const m = T.Energy.measure(w), band = T.Energy.BANDS.transfer.text;
      const tr = [m.eff.transfer, m.eff.transferC1].filter(v => v != null);
      const inBand = tr.length ? tr.filter(v => v >= band[0] && v <= band[1]).length / tr.length : 0;
      const narrows = w.pyramidCheck && w.pyramidCheck.violations.length ? 0 : 1;
      const lvScore = clamp((lv - 2) / 2, 0, 1);
      out.energy = { score: 0.5 * lvScore + 0.25 * inBand + 0.25 * narrows,
        cause: lv < 3 ? 'only ' + lv + ' trophic levels' : !narrows ? 'the energy pyramid failed to narrow' : inBand < 1 ? 'energy passed up is outside the ' + Math.round(band[0] * 100) + '–' + Math.round(band[1] * 100) + '% band' : lv + ' trophic levels, energy narrowing' };
    }
    // Biodiversity: richness and Shannon diversity against the starting baseline.
    {
      const d = w.diversity(), b = run.baseline;
      const r = clamp(d.richness / Math.max(1, b.richness), 0, 1), h = clamp(d.Hbiomass / Math.max(0.01, b.Hb), 0, 1);
      const ext = (run.extinct || []).length;
      out.biodiversity = { score: clamp(0.5 * r + 0.5 * h - 0.05 * ext, 0, 1),
        cause: ext ? ext + ' species lost' : r < 0.95 ? 'richness ' + d.richness + ' of ' + b.richness + ' at the start' : h < 0.95 ? 'diversity below the start' : 'richness and diversity at or above the start' };
    }
    // Stability: most species between ½K and K, and no boom–bust over 3×.
    {
      let ok = 0, n = 0, worst = null, wv = 0;
      for (const sp of live) {
        if (!sp.K) continue;
        n++;
        const f = pops[sp.idx] / sp.K;
        const hist = (run.popHistory[sp.id] || []).slice(1).slice(-3).filter(v => v > 0);   // rounds played, not the seeded start
        const swing = hist.length >= 2 ? Math.max(...hist) / Math.max(1, Math.min(...hist)) : 1;
        if (f >= 0.4 && f <= 1.25 && swing <= 3) ok++;
        const bad = Math.max(f > 1 ? f - 1 : 0, f < 0.5 ? 0.5 - f : 0, swing > 3 ? swing / 3 - 1 : 0);
        if (bad > wv) { wv = bad; worst = { sp, f, swing }; }
      }
      out.stability = { score: n ? ok / n : 1,
        cause: !worst ? 'populations near carrying capacity' : worst.swing > 3 ? plural(worst.sp.name) + ' swung ' + worst.swing.toFixed(1) + '× over 3 rounds' : worst.f > 1 ? plural(worst.sp.name) + ' overshot K by ' + worst.f.toFixed(1) + '×' : plural(worst.sp.name) + ' at ' + Math.round(worst.f * 100) + '% of K' };
    }
    // Cycles: nitrogen in band, losses below fixation, groundwater held, carbon a sink.
    {
      const s = w.soilSummary();
      const nOk = s.nLimitedShare < 0.3 ? 1 : 0, lossOk = s.losses <= s.fixation * 1.2 ? 1 : 0;
      const gwOk = w.gw >= run.baseline.waterTable * 0.95 ? 1 : 0, cOk = s.carbonBalance >= 0 ? 1 : 0;
      out.cycles = { score: (nOk + lossOk + gwOk + cOk) / 4,
        cause: !cOk ? 'the map was a net carbon source' : !gwOk ? 'the water table is falling' : !lossOk ? 'nitrogen lost faster than it was fixed' : !nOk ? 'plants short of nitrogen' : 'nitrogen, water and carbon in balance' };
    }
    // Keystones and obligate partners still present.
    {
      const ks = Object.keys(w.keystones || {}).map(id => w.speciesById(id)).filter(Boolean);
      const partners = [...new Set(w.producers.filter(P => P && P.pollinator != null && w.cover && w.cover[P.idx] > 0).map(P => P.pollinator))].map(i => w.species[i]);
      const need = [...new Set(ks.concat(partners))];
      const gone = need.filter(sp => !pops[sp.idx]);
      out.keystone = { score: need.length ? 1 - gone.length / need.length : 1,
        cause: gone.length ? plural(gone[0].name) + ' (a ' + (ks.includes(gone[0]) ? 'keystone' : 'pollinator partner') + ') are gone' : need.length ? 'every keystone and partner present' : 'no keystones identified yet' };
    }
    // Habitat: a mosaic of seral stages, and interior woodland not fragmented.
    {
      const sr = w.seralSummary(), hab = w.habitatSummary();
      const stages = sr.share.slice(1).filter(v => v >= 0.05).length;
      const want = Math.min(3, w.biomeClass.climax);
      const mosaic = clamp(stages / want, 0, 1);
      const interior = hab.wood < 20 ? 1 : clamp(hab.interiorShare / ST().interiorMin, 0, 1);
      const mono = w.producers.some(P => P && !isNative(P) && w.cover && w.cover[P.idx] > 0.35 * landTiles(w).length) ? 0.5 : 1;
      out.habitat = { score: (0.5 * mosaic + 0.5 * interior) * mono,
        cause: mono < 1 ? 'a non-native monoculture covers much of the land' : interior < 1 ? 'interior woodland fragmented (' + Math.round(hab.interiorShare * 100) + '%)' : mosaic < 1 ? 'few seral stages' : 'a mosaic of seral stages' };
    }
    // Viability: every species at or above its minimum viable population.
    {
      const tracked = w.species.filter(sp => !sp.transient && (run.baseline.counts[sp.id] > 0 || run.reintroduced.includes(sp.id)));
      const low = tracked.filter(sp => adults(w, sp) < St.mvp(sp));
      out.viability = { score: tracked.length ? 1 - low.length / tracked.length : 1,
        cause: low.length ? low.length + ' species below a viable population' + (low[0] ? ', e.g. ' + low[0].name : '') : 'every species viable' };
    }
    let total = 0;
    const components = St.COMPONENTS.map(c => { const o = out[c.key]; const pts = o.score * c.weight; total += pts; return Object.assign({}, c, o, { points: pts }); });
    return { total: Math.round(total), components };
  };
  const plural = n => (/s$/.test(n) ? n : n + 's');

  // ---------- management actions ----------

  // Area actions take a centre and radius (tiles); species actions take a species id.
  St.ACTIONS = [
    { id: 'survey-count', cat: 'Monitor', name: 'Point counts', target: 'area', r: 6, base: 3, perTile: 0.02, method: 'count', teach: 'Managers track estimates, not exact counts',
      desc: 'Counts along transects: birds and large mammals seen or heard. Gives an estimate of N with an error bar.' },
    { id: 'survey-camera', cat: 'Monitor', name: 'Camera traps', target: 'area', r: 6, base: 4, perTile: 0.02, method: 'camera', teach: 'Detection probability',
      desc: 'Cameras catch nocturnal and cryptic mammals that counts miss.' },
    { id: 'survey-traps', cat: 'Monitor', name: 'Live traps and mist nets', target: 'area', r: 5, base: 4, perTile: 0.03, method: 'traps', teach: 'Mark and recapture',
      desc: 'Small mammals, bats and songbirds, caught, counted and released.' },
    { id: 'survey-pitfall', cat: 'Monitor', name: 'Pitfalls and soil cores', target: 'area', r: 5, base: 3, perTile: 0.02, method: 'pitfall', teach: 'Sampling small taxa',
      desc: 'Invertebrates, decomposers, reptiles and amphibians: densities scaled up from the samples.' },
    { id: 'survey-water', cat: 'Monitor', name: 'Dip nets and water sampling', target: 'area', r: 5, base: 3, perTile: 0.02, method: 'water', teach: 'Aquatic sampling',
      desc: 'Aquatic animals and plankton in the water inside the area.' },
    { id: 'transect', cat: 'Monitor', name: 'Vegetation transect', target: 'area', r: 6, base: 3, perTile: 0.01, teach: 'Monitoring restoration',
      desc: 'Native vs non-native cover and the seed bank\u2019s make-up along the area.' },
    { id: 'soiltest', cat: 'Monitor', name: 'Soil test', target: 'area', r: 5, base: 2, perTile: 0.01, teach: 'Nutrient limitation',
      desc: 'Ammonium, nitrate and moisture on the area. Soil figures in the side panel need a test from the last 3 rounds.' },
    { id: 'wellgauge', cat: 'Monitor', name: 'Well gauge', target: 'none', base: 3, teach: 'Groundwater, aquifers',
      desc: 'The water table, and this round\u2019s recharge against withdrawal.' },
    { id: 'collar', cat: 'Monitor', name: 'Radio collar', target: 'species', base: 6, who: 'known', teach: 'Home ranges',
      desc: 'Tracks one individual\u2019s range, diet and fate, and makes its species Studied.' },
    { id: 'monitor', cat: 'Monitor', name: 'Monitoring program', target: 'none', base: 0, standing: true, teach: 'Long-term monitoring',
      desc: 'Repeats every survey queued this round, every round, at half their cost, so estimates never go stale.' },
    { id: 'burn', cat: 'Habitat', name: 'Prescribed burn', target: 'area', r: 5, base: 4, perTile: 0.03, teach: 'Succession, fire ecology',
      desc: 'Resets the patch to the grasses stage and clears litter, restarting secondary succession. Burned in spring, it sets back cool-season non-native grasses.' },
    { id: 'shred', cat: 'Habitat', name: 'Shred (mow)', target: 'area', r: 5, base: 3, perTile: 0.02, teach: 'Seed banks, disturbance',
      desc: 'Cuts standing growth before seed set, cutting non-natives’ seed rain. Leaves no bare soil, but needs repeating.' },
    { id: 'disc', cat: 'Habitat', name: 'Disc', target: 'area', r: 4, base: 6, perTile: 0.05, teach: 'Disturbance, erosion',
      desc: 'Turns the sod and kills roots: the stand is gone at once, but the soil is bare for a round and releases a nitrogen flush.' },
    { id: 'overseed', cat: 'Habitat', name: 'Overseed natives', target: 'area', r: 5, base: 4, perTile: 0.03, teach: 'Competition, restoration',
      desc: 'Adds native grass and forb seed to the seed bank; natives take bare or just-disturbed tiles at once.' },
    { id: 'plant', cat: 'Habitat', name: 'Plant natives', target: 'area', r: 3, base: 5, perTile: 0.08, teach: 'Restoration', producer: 'native',
      desc: 'Seeds a native grass or forb on bare or disturbed tiles.' },
    { id: 'legumes', cat: 'Habitat', name: 'Plant legumes', target: 'area', r: 3, base: 5, perTile: 0.08, teach: 'Symbiotic nitrogen fixation', producer: 'fixer',
      desc: 'Seeds a nitrogen-fixing legume whose root nodules add soil nitrogen.' },
    { id: 'loosen', cat: 'Habitat', name: 'Loosen compacted soil', target: 'area', r: 5, base: 3, perTile: 0.03, teach: 'Infiltration, denitrification',
      desc: 'Ends compaction, so rain soaks in again and nitrification resumes.' },
    { id: 'reforest', cat: 'Habitat', name: 'Reforest', target: 'area', r: 3, base: 8, perTile: 0.12, teach: 'Carbon storage', producer: 'tree',
      desc: 'Plants woody producers: a slow but lasting carbon sink, and in time interior habitat.' },
    { id: 'corridor', cat: 'Habitat', name: 'Wildlife corridor', target: 'area', r: 2, base: 4, perTile: 0.1, teach: 'Fragmentation, edge effects', producer: 'shrub',
      desc: 'Plants shrubs to link fragments, so woodland species can cross and isolated groups rejoin.' },
    { id: 'wetland', cat: 'Habitat', name: 'Restore wetland', target: 'area', r: 4, base: 8, perTile: 0.06, teach: 'Hydrarch habitats, nitrogen loss',
      desc: 'Keeps low ground near water saturated: more denitrification, carbon stored as peat, wetland habitat.' },
    { id: 'buffer', cat: 'Habitat', name: 'Riparian buffer', target: 'area', r: 3, base: 6, perTile: 0.06, teach: 'Runoff, leaching', producer: 'shrub',
      desc: 'Plants a vegetated strip along the water that catches runoff and the nitrate in it.' },
    { id: 'exclosure', cat: 'Habitat', name: 'Grazing exclosure', target: 'area', r: 4, base: 5, perTile: 0.04, teach: 'Harvesting efficiency, recovery',
      desc: 'Fences the patch against grazers and browsers for 3 rounds so plants can recover.' },
    { id: 'timber', cat: 'Community', name: 'Timber harvest', target: 'area', r: 4, base: 2, perTile: 0.01, teach: 'Ecosystem services, disturbance',
      desc: 'Cuts mature forest for sale: pays SP per tile cut and opens the canopy, restarting succession. Timber companies like it; conservationists don\u2019t.' },
    { id: 'water', cat: 'Community', name: 'Cap irrigation', target: 'none', base: 10, teach: 'Groundwater, water rights',
      desc: 'Buys back water rights: the draw on the aquifer falls by 40% for good. Irrigators lose out.' },
    { id: 'reintroduce', cat: 'Wildlife', name: 'Reintroduction', target: 'species', base: 20, teach: 'Keystone predators, trophic cascades', who: 'pool',
      desc: 'Releases a founding group from the regional pool, for example a returning apex predator.' },
    { id: 'translocate', cat: 'Wildlife', name: 'Translocation', target: 'species', base: 12, teach: 'Minimum viable populations', who: 'present',
      desc: 'Brings in a few individuals from elsewhere to bolster a small, isolated population.' },
    { id: 'control', cat: 'Wildlife', name: 'Invasive control', target: 'species', base: 8, standing: true, teach: 'Invasive species', who: 'nonnative',
      desc: 'Removes a share of a non-native species every round it stays on. Costly and slow.' },
    { id: 'protect', cat: 'Wildlife', name: 'Protect species', target: 'species', base: 3, standing: true, teach: 'Endangered species', who: 'present',
      desc: 'Bans harvest and keeps fire and heavy work out of the species’ range while it stays on.' },
  ];
  St.actionById = id => St.ACTIONS.find(a => a.id === id) || St.RAPID.find(a => a.id === id);

  // Rapid responses: bought during the season, acting at once.
  St.RAPID = [
    { id: 'rapid-survey', cat: 'Rapid', name: 'Emergency survey', target: 'area', r: 5, base: 3, perTile: 0.02, method: 'count', teach: 'Managers track estimates, not exact counts',
      desc: 'Point counts now, mid-season, at 1.5 times the usual cost.' },
    { id: 'firecrew', cat: 'Rapid', name: 'Fire crew on call', target: 'none', base: 5, teach: 'Fire ecology, disturbance',
      desc: 'For the rest of this season, a lightning fire is held to a fifth of its size. Fires strike in summer.' },
    { id: 'spot', cat: 'Rapid', name: 'Spot invasive removal', target: 'species', base: 6, who: 'nonnative', teach: 'Invasive species',
      desc: 'Removes 15% of a non-native species now, once.' },
  ];
  St.rapid = function (w, run, q) {
    const a = St.RAPID.find(x => x.id === q.id), cost = St.cost(w, a, q);
    if (cost > run.sp) return { ok: false, why: 'Needs ' + cost + ' SP' };
    let text = '';
    if (a.id === 'rapid-survey') {
      const res = T.Knowledge.survey(w, run, a.method, q.x, q.y, q.r || a.r);
      const found = res.filter(x => x.discovered).map(x => x.sp);
      run.discovered = (run.discovered || []).concat(found.map(sp => sp.id));
      text = res.length + ' species estimated' + (found.length ? '; new: ' + found.map(sp => sp.name).join(', ') : '');
    } else if (a.id === 'firecrew') {
      if (w.fireCrew) return { ok: false, why: 'A crew is already on call' };
      w.fireCrew = true;
      text = 'a fire crew is on call for the rest of the season';
    } else if (a.id === 'spot') {
      const sp = w.speciesById(q.species);
      if (!sp) return { ok: false, why: 'Species gone' };
      const n = w.cull(sp, Math.ceil(w.countPops().count[sp.idx] * 0.15), 'controlled');
      text = Math.round(n) + ' ' + sp.name + ' removed';
      St.logSpecies(run, sp.id, 'Spot removal: ' + text);
      T.Stakeholders.onActions(run, ['control']);
    }
    run.sp -= cost;
    (run.rapidLog || (run.rapidLog = [])).push({ round: run.round, id: a.id, text });
    return { ok: true, cost, text };
  };

  // What an action costs: allies of the community make the actions they like cheaper, opponents the ones they dislike dearer.
  St.cost = function (w, a, target) {
    let f = T.Stakeholders ? T.Stakeholders.costFactor(w.run, a.id) : 1;
    if (a.id === 'rapid-survey') f *= 1.5;
    if (a.target === 'area') return Math.round((a.base + a.perTile * tilesIn(w, target.x, target.y, target.r || a.r, false).length) * f);
    return Math.round(a.base * f);
  };
  const isSurvey = q => /^survey-/.test(q.id);

  // Which species an action can target.
  St.targets = function (w, a) {
    const pops = w.countPops().count;
    // Reintroduction brings back native wildlife that's gone from the map, not livestock or non-natives.
    if (a.who === 'pool') return w.species.filter(sp => !pops[sp.idx] && w.pool && w.pool[sp.id] && !w.pool[sp.id].regionallyExtinct && !sp.transient &&
      !sp.domestic && !sp.invasive && !(sp.meta && sp.meta.native === false));
    // Everything else needs the steward to know the species is there.
    const known = sp => !T.Knowledge || !w.run || T.Knowledge.known(w.run, sp);
    if (a.who === 'nonnative') return w.species.filter(sp => pops[sp.idx] && (sp.invasive || (sp.meta && sp.meta.native === false)) && !sp.domestic && known(sp));
    return w.species.filter(sp => pops[sp.idx] && !sp.transient && known(sp));
  };

  // A producer to plant for an action: natives that suit the tile's moisture, by kind.
  St.plantFor = function (w, a, i) {
    const m = w.moist[i];
    const ok = P => P && isNative(P) && (a.producer === 'fixer' ? P.fixer && P.stage <= 3 : a.producer === 'tree' ? P.stage === 4 : a.producer === 'shrub' ? P.stage === 3 : P.stage === 2);
    let list = w.producers.filter(ok);
    if (!list.length && a.producer === 'shrub') list = w.producers.filter(P => P && isNative(P) && P.stage === 4);
    if (!list.length) return null;
    return w._seedFromList(list, m, 0, false);
  };

  // Carry out an action now. Returns a short description of what happened.
  St.apply = function (w, run, q) {
    const a = St.actionById(q.id);
    const KN = T.Knowledge;
    if (a.method) {
      const res = KN.survey(w, run, a.method, q.x, q.y, q.r || a.r);
      const found = res.filter(x => x.discovered).map(x => x.sp);
      run.discovered = (run.discovered || []).concat(found.map(sp => sp.id));
      return res.length + ' species estimated' + (found.length ? '; new: ' + found.map(sp => sp.name).join(', ') : '');
    }
    if (a.id === 'transect') { const v = KN.vegetation(w, run, q.x, q.y, q.r || a.r); return Math.round(v.nativeShare * 100) + '% native cover, seed bank ' + Math.round(v.bankNative * 100) + '% native'; }
    if (a.id === 'soiltest') { const t = KN.soilTest(w, run, q.x, q.y, q.r || a.r); return 'NH4 ' + t.nh4.toFixed(2) + ', NO3 ' + t.no3.toFixed(2) + ' per tile'; }
    if (a.id === 'water') { const before = w.irrigation || 0; w.irrigation = before * (1 - ST().waterCap); return before ? 'irrigation cut to ' + Math.round(100 * w.irrigation / before) + '% of what it was' : 'no irrigation to cap'; }
    if (a.id === 'wellgauge') { const g = KN.wellGauge(w, run); return 'water table ' + Math.round(100 * g.gw / Math.max(1, g.ref)) + '% of normal'; }
    if (a.id === 'monitor') {
      run.monitoring = run.queue.filter(isSurvey).map(x => ({ id: x.id, x: x.x, y: x.y, r: x.r, cost: Math.ceil(x.cost / 2) }));
      if (!run.standing.some(s => s.id === 'monitor')) run.standing.push({ id: 'monitor', started: true });
      return run.monitoring.length + ' surveys repeat every round';
    }
    if (a.target === 'area') return St.applyArea(w, run, a, q);
    const sp = w.speciesById(q.species);
    if (!sp) return 'species gone';
    switch (a.id) {
      case 'reintroduce': {
        const n = w.reintroduce(sp, ST().reintroduceGroup);
        if (n && !run.reintroduced.includes(sp.id)) run.reintroduced.push(sp.id);
        return n + ' ' + sp.name + ' released';
      }
      case 'translocate': return w.immigrate(sp, ST().translocateGroup) + ' ' + sp.name + ' brought in';
      case 'control': { if (!run.standing.some(s => s.id === 'control' && s.species === sp.id)) run.standing.push({ id: 'control', species: sp.id }); return 'control of ' + sp.name + ' begins'; }
      case 'collar': { const e = T.Knowledge.collar(w, run, sp); return e ? sp.name + ' #' + String(e.num).padStart(4, '0') + ' collared' : 'none to collar'; }
      case 'protect': { if (!run.standing.some(s => s.id === 'protect' && s.species === sp.id)) run.standing.push({ id: 'protect', species: sp.id }); w.protected.add(sp.id); run.harvest[sp.id] = 0; w.harvest[sp.idx] = 0; return sp.name + ' protected'; }
    }
    return '';
  };

  St.applyArea = function (w, run, a, q) {
    const r = q.r || a.r;
    // Private and developed land is off limits: the steward manages public land and conservation easements.
    let tiles = tilesIn(w, q.x, q.y, r, true).filter(i => T.Stakeholders.manageable(w, i));
    // Protected species' ranges are off limits to fire and heavy work.
    if (['burn', 'disc', 'shred'].includes(a.id)) tiles = tiles.filter(i => !St.protectedTile(w, i));
    let n = 0;
    const nonNativeOut = i => { for (let k = 0; k < 3; k++) { const P = w.producers[w.bank[i * 3 + k]]; if (P && !isNative(P) && w.rng.next() < 0.6) w.bank[i * 3 + k] = 0; } };
    const nativeIn = i => { const list = w.producers.filter(P => P && isNative(P) && P.stage === 2); if (list.length) { const P = w._seedFromList(list, w.moist[i], 0, false); if (P) { w._bankPush(i, P.idx); w._bankPush(i, P.idx); } } };
    switch (a.id) {
      case 'burn':
        for (const i of tiles) { if (!w.ptype[i]) continue; w._clearTile(i); w.burn[i] = B.succession.burnScar; nonNativeOut(i); n++; }
        break;
      case 'shred':
        for (const i of tiles) {
          const P = w.producers[w.ptype[i]];
          if (!P || P.stage > 2) continue;
          const cut = w.pE[i] * 0.7 + w.fruit[i];
          w.pE[i] -= w.pE[i] * 0.7; w.fruit[i] = 0;
          w.detr[i] += cut; w.detrN[i] += cut * P.nContent; w.pbook.litter[w.ptype[i]] += cut;
          if (!isNative(P) && w.rng.next() < 0.35) nonNativeOut(i);
          n++;
        }
        break;
      case 'disc':
        for (const i of tiles) {
          w._clearTile(i);
          w.comp[i] = 0;
          const flush = w.detrN[i] * 0.5; w.detrN[i] -= flush; w.nh4[i] += flush;   // the nitrogen flush
          w.bareHold[i] = 1;   // bare, open to runoff, until next round
          n++;
        }
        break;
      case 'overseed':
        for (const i of tiles) {
          nativeIn(i);
          if (!w.ptype[i] || w.burn[i] || w.bareHold[i]) { w.bareHold[i] = 0; const P = w.producers[w.bank[i * 3]]; if (P && P.stage === 2) { w._switchProducer(i, P); n++; } }
          else n++;
        }
        break;
      case 'plant': case 'legumes': case 'reforest': case 'corridor': case 'buffer': {
        const cand = a.id === 'buffer' ? tiles.filter(i => St.nearWater(w, i, 2)) : tiles;
        for (const i of cand) {
          const cur = w.producers[w.ptype[i]];
          if (a.id !== 'reforest' && a.id !== 'corridor' && a.id !== 'buffer' && cur && cur.stage > 2 && !w.burn[i]) continue;
          const P = St.plantFor(w, a, i);
          if (!P || (cur && cur.idx === P.idx)) continue;
          w._switchProducer(i, P);
          w.bareHold[i] = 0;
          w.pE[i] = P.max * 0.1;   // nursery stock arrives with some growth
          w.ledger.imported += P.max * 0.1; w.nledger.imported += P.max * 0.1 * P.nContent;
          if (a.id === 'buffer') w.comp[i] = 0;
          n++;
        }
        w._computeShade(); w.edgeDirty = true;
        break;
      }
      case 'loosen': for (const i of tiles) { if (w.comp[i] > 0.05) n++; w.comp[i] = 0; } break;
      case 'wetland': for (const i of tiles) if (w.elev[i] <= w.waterLine + ST().wetlandRise) { w.wetland[i] = 1; w.sw[i] = 1; w.moist[i] = 1; n++; } break;
      case 'exclosure': for (const i of tiles) { w.exclosure[i] = ST().exclosureRounds; n++; } break;
      case 'timber':
        for (const i of tiles) {
          const P = w.producers[w.ptype[i]];
          if (!P || P.stage !== 4) continue;
          // The logs leave the map; slash stays as litter.
          const logs = w.pE[i] * 0.7, slash = w.pE[i] - logs;
          w.ledger.exported += logs; w.nledger.exported += logs * P.nContent;
          w.pE[i] = 0; w.detr[i] += slash; w.detrN[i] += slash * P.nContent;
          w._clearTile(i);
          n++;
        }
        run.timberTiles = (run.timberTiles || 0) + n;
        run.timberSP = (run.timberSP || 0) + Math.round(n * ST().timberValue);
        w._computeShade(); w.edgeDirty = true;
        break;
    }
    w._successionCover();
    return n + ' tiles';
  };
  St.nearWater = function (w, i, r) {
    const N = w.N, x = i % N, y = (i / N) | 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N && w.terrain[yy * N + xx]) return true; }
    return false;
  };
  St.protectedTile = function (w, i) {
    for (const id of w.protected || []) { const sp = w.speciesById(id); if (sp && sp.regionMap && sp.regionMap[i]) return true; }
    return false;
  };

  // ---------- during the season ----------

  // Harvest limits (a bag limit per species per round, taken through the season), invasive control, exclosures
  // and wetlands. Called every tick from the world.
  W._stewardTick = function () {
    if (!this.exclosure) return;
    const P = ST();
    if (this.t % P.harvestEvery === 0) {
      const share = P.harvestEvery / B.roundTicks;
      for (const k in this.harvest) {
        const sp = this.species[+k], limit = this.harvest[k];
        if (!sp || !limit) continue;
        this._harvestAcc = this._harvestAcc || {};
        this._harvestAcc[k] = (this._harvestAcc[k] || 0) + limit * share;
        const take = Math.floor(this._harvestAcc[k]);
        if (take > 0) { this._harvestAcc[k] -= take; this.cull(sp, take, 'harvest'); }
      }
      for (const id in this.controlShare || {}) {
        const sp = this.speciesById(id);
        if (sp) this.cull(sp, Math.ceil(this.countPops().count[sp.idx] * this.controlShare[id] * share), 'controlled');
      }
    }
    if (this.t % 60 === 0) for (let i = 0; i < this.N * this.N; i++) if (this.wetland[i]) { this.sw[i] = Math.max(this.sw[i], 0.95); this.moist[i] = Math.max(this.moist[i], 0.95); }
  };

  // Remove up to n adults of a species (harvest or control): their bodies leave the map, booked as deaths.
  W.cull = function (sp, n, cause) {
    if (n <= 0) return 0;
    const rs = this.rstats[sp.idx];
    let took = 0, eu = 0;
    if (sp.grid) {
      const g = sp.grid, tot = g.total || 0;
      if (tot <= 0) return 0;
      const f = Math.min(0.9, n / tot);
      for (let i = 0; i < this.N * this.N; i++) {
        if (g.nA[i] <= 0) continue;
        const k = g.nA[i] * f, share = k / Math.max(1e-9, g.nA[i] + g.nJ[i] + g.nO[i]);
        const E = g.E[i] * share, Tt = g.Tt[i] * share, Nn = g.Nn[i] * share;
        g.nA[i] -= k; g.E[i] -= E; g.Tt[i] -= Tt; g.Nn[i] -= Nn;
        if (this.harvestMap) this.harvestMap[i] += k;
        this.ledger.exported += E + Tt; this.nledger.exported += Nn; eu += E + Tt; took += k;
      }
      this._popTotals(sp);
      T.popCount(sp, cause, took, rs.deaths, cause);
    } else {
      const pool = this.ents.filter(e => e.alive && e.sp === sp && e.grow >= 1);
      for (let k = 0; k < n && pool.length; k++) {
        const e = pool.splice(this.rng.int(pool.length), 1)[0];
        eu += e.E + e.tissue + e.para;
        this.ledger.exported += e.E + e.tissue + e.para; this.nledger.exported += e.nT + e.nS;
        e.E = e.tissue = e.para = e.nT = e.nS = 0; e.alive = false;
        if (this.harvestMap) this.harvestMap[Math.min(this.N - 1, e.y | 0) * this.N + Math.min(this.N - 1, e.x | 0)] += 1;
        if (e.terr) this._releaseTerritory(e);
        rs.deaths[cause] = (rs.deaths[cause] || 0) + 1;
        took++;
      }
      rs.otherLoss += eu;
    }
    this.harvested = this.harvested || {};
    const h = this.harvested[sp.idx] || (this.harvested[sp.idx] = { n: 0, eu: 0, cause });
    h.n += took; h.eu += eu;
    return took;
  };

  // ---------- plan and round ----------

  // Queue an action for the coming season (paid now); apply the queue when the season starts.
  St.queue = function (w, run, q) {
    const a = St.actionById(q.id);
    const cost = St.cost(w, a, q);
    if (cost > run.sp) return { ok: false, why: 'Needs ' + cost + ' SP' };
    run.sp -= cost;
    run.queue.push(Object.assign({ cost }, q));
    return { ok: true, cost };
  };
  // A species' management history, for its Codex entry.
  St.logSpecies = function (run, id, text) { (run.mgmt || (run.mgmt = [])).push({ round: run.round, species: id, text }); if (run.mgmt.length > 600) run.mgmt.shift(); };

  St.unqueue = function (run, k) { const q = run.queue.splice(k, 1)[0]; if (q) run.sp += q.cost; };

  St.startSeason = function (w, run) {
    const log = [];
    w.run = run;
    const monitored = run.standing.some(s => s.id === 'monitor');
    run.doneActions = run.queue.map(q => q.id);
    run.timberTiles = 0; run.timberSP = 0;
    const order = run.queue.filter(q => q.id !== 'monitor').concat(run.queue.filter(q => q.id === 'monitor'));
    for (const q of order) {
      const text = St.apply(w, run, q);
      log.push(St.actionById(q.id).name + ': ' + text);
      if (q.species) St.logSpecies(run, q.species, St.actionById(q.id).name + ': ' + text);
    }
    // A standing monitoring program repeats its surveys (paid at half cost) in the rounds after it starts.
    if (monitored && !run.queue.some(q => q.id === 'monitor')) for (const m of run.monitoring || []) {
      if (run.sp < m.cost) { log.push('Monitoring: not enough SP for ' + St.actionById(m.id).name); continue; }
      run.sp -= m.cost;
      log.push('Monitoring · ' + St.actionById(m.id).name + ': ' + St.apply(w, run, m));
    }
    run.queue = [];
    // Standing orders cost every round.
    w.controlShare = {};
    for (const s of run.standing) {
      const a = St.actionById(s.id);
      if (s.id === 'monitor') continue;   // paid per survey above
      if (s.id === 'control') w.controlShare[s.species] = ST().controlShare;
      if (!s.started) { s.started = true; continue; }
      run.sp -= a.base;
    }
    // Harvest limits by species index for the sim.
    w.harvest = {};
    for (const id in run.harvest) { const sp = w.speciesById(id); if (sp && run.harvest[id] > 0 && !w.protected.has(id)) w.harvest[sp.idx] = run.harvest[id]; }
    w.harvested = {};
    // The community reacts to what the steward does.
    T.Stakeholders.onActions(run, run.doneActions.concat(run.standing.filter(x => x.id === 'protect' || x.id === 'control').map(x => x.id)));
    run.lastLog = log;
    return log;
  };

  // Round end: SP income, EHI, goals, extinctions, win or loss.
  St.endRound = function (w, run) {
    const P = ST(), diff = B.difficulties[run.difficulty];
    const pops = w.countPops().count;
    for (const sp of w.species) (run.popHistory[sp.id] = run.popHistory[sp.id] || []).push(pops[sp.idx]);
    // Extinctions that count against the steward: species present at the start (or reintroduced) now gone.
    const gone = w.species.filter(sp => !sp.transient && !run.extinct.includes(sp.id) && pops[sp.idx] === 0 &&
      (run.baseline.counts[sp.id] > 0 || run.reintroduced.includes(sp.id)) && !(sp.invasive || (sp.meta && sp.meta.native === false)));
    for (const sp of gone) run.extinct.push(sp.id);
    // Recovered: species that climbed from below a viable population to above it.
    for (const sp of w.species) {
      if (run.recovered.includes(sp.id)) continue;
      const h = run.popHistory[sp.id];
      if (h && h.some(v => v > 0 && v < St.mvp(sp)) && pops[sp.idx] >= 2 * St.mvp(sp)) run.recovered.push(sp.id);
    }
    const prev = run.ehi;
    // Chance sightings, and what the round's surveys discovered.
    const seen = T.Knowledge.roundEnd(w, run);
    const discovered = seen.concat((run.discovered || []).map(id => w.speciesById(id)).filter(Boolean));
    run.discovered = [];
    const ehi = St.ehi(w, run);
    run.ehi = ehi;
    run.ehiView = T.Knowledge.ehiRange(w, run, ehi);
    run.ehiHistory.push(ehi.total);
    (run.ehiViewHistory || (run.ehiViewHistory = [])).push((run.ehiView.lo + run.ehiView.hi) / 2);
    // Income: a base grant, the value of what was harvested sustainably, and a bonus for a healthy ecosystem.
    const parts = [['Base grant', P.baseIncome]];
    let harvestSP = 0;
    for (const k in w.harvested || {}) {
      const h = w.harvested[k], sp = w.species[+k];
      if (!h.n || h.cause !== 'harvest') continue;
      const v = Math.round(h.n * P.harvestValue * Math.sqrt(Math.max(0.05, (sp.meta && sp.meta.massKg) || sp.stats.mass * 3)));
      const sustainable = sp.K && pops[sp.idx] >= 0.5 * sp.K;
      const got = sustainable ? v : Math.round(v * 0.5);
      harvestSP += got;
      St.logSpecies(run, sp.id, 'Harvested ' + Math.round(h.n) + (sustainable ? '' : ' (below ½K)'));
      parts.push(['Harvest: ' + Math.round(h.n) + ' ' + sp.name + (sustainable ? '' : ' (below ½K: half value)'), got]);
    }
    if (run.timberSP) parts.push(['Timber: ' + run.timberTiles + ' tiles', run.timberSP]);
    if (discovered.length) parts.push(['Discovered: ' + discovered.map(sp => sp.name).join(', '), T.Knowledge.discoverySP(discovered)]);
    if (ehi.total >= 70) parts.push(['Healthy ecosystem (EHI ≥ 70)', P.healthyBonus]);
    const income = Math.round(parts.reduce((a, p) => a + p[1], 0) * diff.income);
    if (diff.income !== 1) parts.push([diff.name + ' difficulty ×' + diff.income, income - parts.reduce((a, p) => a + p[1], 0)]);
    run.sp += income;
    // The community: asks met or failed (their rewards go straight to SP), arrivals, departures and land sales.
    const sp0 = run.sp;
    const community = T.Stakeholders.roundEnd(w, run, (run.activeEvents || []).map(e => e.id || e));
    if (run.sp > sp0) parts.push(['Stakeholder asks met', run.sp - sp0]);
    run.spHistory.push(income + run.sp - sp0);
    // Goals and outcome.
    const goals = St.goals(w, run);
    run.lowRounds = ehi.total < P.collapseEHI ? run.lowRounds + 1 : 0;
    run.mandateLow = run.stake.mandate < B.stakeholders.loseMandate ? run.mandateLow + 1 : 0;
    run.collapseRounds = w.producerBiomass() < B.collapseFrac * run.baseline.producers ? run.collapseRounds + 1 : 0;
    let outcome = null;
    if (run.lowRounds >= 2) outcome = { win: false, kind: 'collapse', headline: 'Ecosystem collapse: the Ecosystem Health Index stayed below ' + P.collapseEHI + ' for 2 rounds.' };
    else if (run.mandateLow >= B.stakeholders.loseRounds) outcome = { win: false, kind: 'mandate', headline: 'The community withdrew its support: the mandate stayed below ' + B.stakeholders.loseMandate + '% for ' + B.stakeholders.loseRounds + ' rounds, and the board replaced the steward.' };
    else if (run.collapseRounds >= B.collapseRounds) outcome = { win: false, kind: 'collapse', headline: 'Ecosystem collapse: producers fell below 15% of the start for 2 rounds.' };
    else if (run.round >= B.maxRounds) {
      const avg = run.ehiHistory.reduce((a, b) => a + b, 0) / run.ehiHistory.length;
      const allGoals = goals.every(g => g.met);
      outcome = avg >= P.winEHI && allGoals
        ? { win: true, kind: 'restored', headline: 'Restored. Average EHI ' + Math.round(avg) + (goals.length ? ' and every restoration goal met.' : '.') }
        : { win: false, kind: 'time', headline: 'The ' + B.maxRounds + ' rounds are over: average EHI ' + Math.round(avg) + (allGoals ? '' : ', with goals unmet') + '.' };
    }
    run.outcome = outcome;
    const deltas = ehi.components.map((c, k) => ({ key: c.key, name: c.name, points: c.points, weight: c.weight, delta: prev ? c.points - prev.components[k].points : 0, cause: c.cause }));
    return { ehi, view: run.ehiView, deltas, income, parts, goals, outcome, community, mandate: run.stake.mandate, gone: gone.map(sp => sp.name), discovered: discovered.map(sp => sp.name) };
  };

  // ---------- goals ----------

  St.goals = function (w, run) {
    const sc = run.scenario ? T.scenarioById(run.scenario) : null;
    if (!sc || !sc.goals) return [];
    const pops = w.countPops().count, slot = id => w.species.filter(sp => sp.meta && sp.meta.slot === id);
    const b = run.baseline;
    return sc.goals.map(g => {
      let met = false, now = '';
      switch (g.type) {
        case 'nativeCover': { const v = St.nativeCover(w); met = v >= g.min; now = Math.round(v * 100) + '% native cover (goal ' + Math.round(g.min * 100) + '%)'; break; }
        case 'reduce': {
          const list = slot(g.slot), start = list.reduce((a, sp) => a + (b.counts[sp.id] || 0), 0), n = list.reduce((a, sp) => a + pops[sp.idx], 0);
          met = start > 0 && n <= g.max * start; now = n + ' of ' + start + ' at the start (goal ≤ ' + Math.round(g.max * 100) + '%)'; break;
        }
        case 'present': {
          const list = slot(g.slot), ok = list.filter(sp => adults(w, sp) >= St.mvp(sp));
          met = ok.length > 0; now = ok.length ? ok.map(sp => sp.name).join(', ') + ' established' : 'not yet established'; break;
        }
        case 'levels': { const v = St.levelsPresent(w); met = v >= g.min; now = v + ' trophic levels (goal ' + g.min + ')'; break; }
        case 'compaction': { let s = 0, n = 0; for (let i = 0; i < w.N * w.N; i++) if (!w.terrain[i]) { s += w.comp[i]; n++; } const v = s / n; met = v <= g.max; now = 'mean compaction ' + Math.round(v * 100) + '% (goal ≤ ' + Math.round(g.max * 100) + '%)'; break; }
        case 'climax': { const v = St.nativeCover(w) * (w.seralSummary().share[2] + w.seralSummary().share[3] + w.seralSummary().share[4]); met = v >= g.min; now = Math.round(v * 100) + '% native prairie or later (goal ' + Math.round(g.min * 100) + '%)'; break; }
        case 'woody': { const v = St.woodyCover(w) / Math.max(0.01, b.woody); met = v >= g.min; now = 'shrub and tree cover ×' + v.toFixed(2) + ' of the start (goal ×' + g.min + ')'; break; }
        case 'nativeRichness': { const v = w.species.filter(sp => sp.meta && sp.meta.native && pops[sp.idx] > 0).length; met = v >= g.min * b.nativeAnimals; now = v + ' native animal species (baseline ' + b.nativeAnimals + ')'; break; }
        case 'grow': {
          const list = slot(g.slot), start = list.reduce((a, sp) => a + (b.counts[sp.id] || 0), 0), n = list.reduce((a, sp) => a + pops[sp.idx], 0);
          met = n >= Math.max(g.min * start, g.atLeast || 0); now = n + ' (start ' + start + '; goal ' + Math.max(Math.ceil(g.min * start), g.atLeast || 0) + ')'; break;
        }
        case 'aquifer': { met = w.gw >= b.waterTable; now = 'water table ' + Math.round(100 * w.gw / Math.max(1, b.waterTable)) + '% of the start'; break; }
        case 'leaching': { const s = w.soilSummary(); met = s.losses <= s.fixation; now = 'nitrogen lost ' + Math.round(s.losses) + ' vs fixed ' + Math.round(s.fixation); break; }
        case 'forest': { const v = St.forestCover(w) / Math.max(0.01, b.forest); met = v >= g.min; now = 'forest cover ' + Math.round(v * 100) + '% of the start (goal ' + Math.round(g.min * 100) + '%)'; break; }
        case 'richness': { const v = w.diversity().richness / Math.max(1, b.richness); met = v >= g.min; now = 'richness ' + Math.round(v * 100) + '% of the start (goal ' + Math.round(g.min * 100) + '%)'; break; }
        case 'mandate': { const v = run.stake ? run.stake.mandate : 0; met = v >= g.min; now = 'mandate ' + v + '% (goal ' + g.min + '%)'; break; }
        case 'sink': { const v = w.soilSummary().carbonBalance; met = v >= 0; now = v >= 0 ? 'a net carbon sink' : 'a net carbon source'; break; }
      }
      return { text: g.text, met, now };
    });
  };

  // ---------- score ----------

  St.score = function (run) {
    const P = ST(), diff = B.difficulties[run.difficulty];
    const avg = run.ehiHistory.length ? run.ehiHistory.reduce((a, b) => a + b, 0) / run.ehiHistory.length : 0;
    const rows = [['Average EHI ' + Math.round(avg) + ' × ' + run.ehiHistory.length + ' rounds', Math.round(avg * run.ehiHistory.length)],
      ['Species recovered (' + run.recovered.length + ' × ' + P.scoreRecovered + ')', run.recovered.length * P.scoreRecovered],
      ['Species reintroduced (' + run.reintroduced.length + ' × ' + P.scoreReintroduced + ')', run.reintroduced.length * P.scoreReintroduced],
      ['Community mandate ' + (run.stake ? run.stake.mandate : 50) + '%', Math.max(0, ((run.stake ? run.stake.mandate : 50) - 50) * P.scoreMandate)],
      ['Avoidable extinctions (' + run.extinct.length + ' × −' + P.scoreExtinction + ')', -run.extinct.length * P.scoreExtinction]];
    const raw = rows.reduce((a, r) => a + r[1], 0);
    rows.push(['Difficulty ×' + diff.scoreMult, Math.round(raw * diff.scoreMult) - raw]);
    return { rows, total: Math.max(0, Math.round(raw * diff.scoreMult)), avg };
  };

  // ---------- saves ----------

  W._stewardState = function () {
    return this.exclosure ? { exclosure: Array.from(this.exclosure), wetland: Array.from(this.wetland), bareHold: Array.from(this.bareHold), harvest: this.harvest,
      protected: [...this.protected], controlShare: this.controlShare || {}, irrigation: this.irrigation, land: this._landState(),
      harvestMap: this.harvestMap ? Array.from(this.harvestMap, v => +v.toFixed(2)) : null, fireCrew: !!this.fireCrew } : null;
  };
  W._stewardRestore = function (s) {
    if (!s) return;
    this.exclosure = Uint8Array.from(s.exclosure); this.wetland = Uint8Array.from(s.wetland); this.bareHold = Uint8Array.from(s.bareHold);
    this.harvest = s.harvest; this.protected = new Set(s.protected); this.controlShare = s.controlShare; this.irrigation = s.irrigation || 0;
    this._landRestore(s.land);
    this.harvestMap = s.harvestMap ? Float32Array.from(s.harvestMap) : new Float32Array(this.N * this.N);
    this.fireCrew = !!s.fireCrew;
  };

  // Round start in the world: exclosures count down, discs stop holding bare soil.
  W._stewardBeginRound = function () {
    if (!this.exclosure || this.loading) return;
    // Developed land (houses, fields) stays cleared.
    if (this.harvestMap) for (let i = 0; i < this.N * this.N; i++) this.harvestMap[i] *= 0.5;
    this.fireCrew = false;
    for (let i = 0; i < this.N * this.N; i++) { if (this.exclosure[i]) this.exclosure[i]--; this.bareHold[i] = this.landUse && this.landUse[i] === 3 ? 1 : 0; }
  };
})(window.Trophic);
