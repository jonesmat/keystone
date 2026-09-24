// Steward checks (Phase 3, P3-M7 part 1).
//   node tools/check-steward.js
// Checks that:
//   - the Ecosystem Health Index is 0–100 from its seven weighted components, each with a cause
//   - every management action does what it says: burns and discs clear ground (a disc keeps it bare for the round),
//     shredding cuts growth, overseeding and planting put natives in, loosening ends compaction, exclosures keep
//     grazers out, wetlands stay wet, reintroduction and translocation add animals, control removes invaders,
//     and protection bans harvest and keeps fire out of the species' range
//   - harvest limits take about the limit, pay SP and keep the ledgers
//   - scenario damage and goals: Rewilding starts compacted and overstocked with a non-native monoculture
//   - a collapse ends the run, the score adds up, and saves keep the steward's state
const T = require('./load.js');
const B = T.BALANCE, St = T.Steward;

let failures = 0;
const check = (ok, text) => { if (!ok) failures++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + text); };
const conserved = w => w.ledger.maxErr < 1e-3 && w.nledger.maxErr < 1e-3;
const season = (w, run) => { w.beginRound(run.round); St.startSeason(w, run); while (!w.roundOver()) w.tick(); w.updateMeans(); const r = St.endRound(w, run); run.round++; w.round = run.round; return r; };
const meadow = seed => { const w = T.createWorld({ seed, roster: T.Gen.meadowRoster() }); return { w, run: St.startRun(w, { community: false }) }; };
B.succession.natural = false;

T.Catalog.load('9.3', cat => {
  // ---------- scenario damage and goals ----------
  console.log('Rewilding the ranch: damage and goals');
  const roster = T.Catalog.roster(cat, T.scenarioById('rewilding'), 1001);
  const w = T.createWorld({ seed: 1001, roster, biome: roster.biome });
  const run = St.startRun(w, { scenario: 'rewilding' });
  let comp = 0, land = 0;
  for (let i = 0; i < w.N * w.N; i++) if (!w.terrain[i]) { comp += w.comp[i]; land++; }
  const cattle = w.species.find(sp => sp.meta && sp.meta.slot === 'livestock');
  console.log('    mean compaction ' + Math.round(100 * comp / land) + '%, native cover ' + Math.round(100 * St.nativeCover(w)) + '%, ' + w.countPops().count[cattle.idx] + ' cattle (roster ' + cattle.startPop + ')');
  check(comp / land > 0.4 && St.nativeCover(w) < 0.5 && w.countPops().count[cattle.idx] > 2 * cattle.startPop, 'the ranch starts compacted, overstocked and under a non-native monoculture');
  const g0 = St.goals(w, run);
  check(g0.length === 7 && !g0.find(g => /compaction/.test(g.text)).met, 'its 7 goals evaluate, and compaction starts unmet');
  // Reintroduction: the native grazers and the apex predator wait in the regional pool; livestock never does.
  const pooled = St.targets(w, St.actionById('reintroduce'));
  check(pooled.length >= 2 && !pooled.some(sp => sp.domestic || (sp.meta && sp.meta.native === false)), 'the regional pool offers ' + pooled.map(sp => sp.name).join(', ') + ' for reintroduction');
  const rsp = pooled[0];
  run.sp = 999;
  St.queue(w, run, { id: 'reintroduce', species: rsp.id });
  // Harvest the cattle hard and loosen the soil everywhere.
  run.harvest[cattle.id] = Math.round(w.countPops().count[cattle.idx] * 0.9);
  run.sp = 999;
  for (let y = 4; y < w.N; y += 8) for (let x = 4; x < w.N; x += 8) St.queue(w, run, { id: 'loosen', x, y, r: 6 });
  const before = w.countPops().count[cattle.idx];
  const res = season(w, run);
  check(run.reintroduced.includes(rsp.id) && w.species[rsp.idx] && (w.rstats[rsp.idx].immig || 0) >= B.steward.reintroduceGroup, 'reintroduction released ' + rsp.name + ' from the regional pool');
  const after = w.countPops().count[cattle.idx];
  const hv = res.parts.find(p => /Harvest/.test(p[0]));
  console.log('    cattle ' + before + ' → ' + after + '; ' + (hv ? hv[0] + ' +' + hv[1] + ' SP' : 'no harvest income'));
  check(after < before * 0.4 && hv && hv[1] > 0, 'a harvest limit takes cattle through the season and pays SP');
  check(res.goals.find(g => /compaction/.test(g.text)).met, 'loosening the soil meets the compaction goal');
  check(res.ehi.total >= 0 && res.ehi.total <= 100 && res.ehi.components.length === 7 && res.ehi.components.every(c => c.cause && c.points <= c.weight + 1e-9),
    'the EHI (' + res.ehi.total + ') sums seven weighted components, each with a cause');
  check(conserved(w), 'ledgers conserved through the season');
  meadowChecks();
});

function meadowChecks() {
  console.log('\nHabitat actions (Meadow)');
  const { w, run } = meadow(T.Gen.hashSeed(9900, 1));
  run.sp = 9999;
  const land = (x, y, r) => St.tilesIn(w, x, y, r, true);
  // Burn.
  const burnAt = land(16, 16, 5);
  St.apply(w, run, { id: 'burn', x: 16, y: 16, r: 5 });
  check(burnAt.every(i => !w.ptype[i] && w.burn[i]), 'a prescribed burn clears ' + burnAt.length + ' tiles to bare, scarred ground');
  // Disc: bare for the round.
  const discAt = land(46, 16, 4);
  St.apply(w, run, { id: 'disc', x: 46, y: 16, r: 4 });
  for (let k = 0; k < B.succession.every * 2; k++) w.tick();
  check(discAt.every(i => !w.ptype[i]), 'a disc leaves the ground bare for the rest of the round');
  check(burnAt.filter(i => w.ptype[i]).length > burnAt.length * 0.9, 'burned ground regrows from the seed bank meanwhile');
  w._stewardBeginRound();
  for (let k = 0; k < B.succession.every; k++) w.tick();
  check(discAt.filter(i => w.ptype[i]).length > discAt.length * 0.9, 'disced ground regrows once the round turns');
  // Shred.
  const shredAt = land(16, 46, 4).filter(i => w.ptype[i] && w.producers[w.ptype[i]].stage <= 2);
  const pe0 = shredAt.reduce((a, i) => a + w.pE[i], 0);
  St.apply(w, run, { id: 'shred', x: 16, y: 46, r: 4 });
  const pe1 = shredAt.reduce((a, i) => a + w.pE[i], 0);
  check(pe1 < pe0 * 0.4 && shredAt.every(i => w.ptype[i]), 'shredding cuts standing growth by more than half and leaves no bare soil');
  // Loosen.
  const loosenAt = land(32, 32, 5);
  for (const i of loosenAt) w.comp[i] = 0.8;
  St.apply(w, run, { id: 'loosen', x: 32, y: 32, r: 5 });
  check(loosenAt.every(i => w.comp[i] === 0), 'loosening ends compaction');
  // Reforest and plant.
  const refAt = land(46, 46, 3);
  St.apply(w, run, { id: 'reforest', x: 46, y: 46, r: 3 });
  check(refAt.filter(i => w.producers[w.ptype[i]] && w.producers[w.ptype[i]].stage === 4).length >= refAt.length * 0.8, 'reforesting plants trees');
  const legAt = land(8, 32, 3);
  for (const i of legAt) w._clearTile(i);
  St.apply(w, run, { id: 'legumes', x: 8, y: 32, r: 3 });
  check(legAt.every(i => w.producers[w.ptype[i]] && w.producers[w.ptype[i]].fixer), 'planting legumes seeds a nitrogen fixer on bare ground');
  // Exclosure: grazers kept out.
  const exAt = land(56, 32, 4);
  St.apply(w, run, { id: 'exclosure', x: 56, y: 32, r: 4 });
  w.beginRound(2);
  const big = w.species.filter(sp => sp.eatsPlants && sp.stats.mass >= B.steward.fenceMass).map(sp => sp.idx);
  let inside = 0;
  for (let k = 0; k < 600; k++) { w.tick(); for (const e of w.ents) if (e.alive && big.includes(e.sp.idx) && e.state === 'graze' && exAt.includes(e.ti)) inside++; }
  check(exAt.every(i => w.exclosure[i] > 0) && inside === 0, 'an exclosure keeps grazers from feeding inside it (' + inside + ' grazing ticks inside)');
  // Wetland.
  const wetAt = land(w.N / 2, w.N / 2, 30).filter(i => w.elev[i] <= w.waterLine + B.steward.wetlandRise).slice(0, 60);
  if (wetAt.length) {
    const i0 = wetAt[0];
    St.apply(w, run, { id: 'wetland', x: (i0 % w.N) + 0.5, y: ((i0 / w.N) | 0) + 0.5, r: 4 });
    for (let k = 0; k < 300; k++) w.tick();
    check(w.wetland[i0] && w.sw[i0] >= 0.9, 'a restored wetland stays saturated');
  }
  check(conserved(w), 'ledgers conserved through every habitat action');

  console.log('\nWildlife actions and harvest (Meadow)');
  {
    const { w, run } = meadow(T.Gen.hashSeed(9900, 2));
    run.sp = 9999;
    const hopper = w.species.find(sp => sp.name === 'Burrow Hopper');
    const n0 = w.countPops().count[hopper.idx];
    St.apply(w, run, { id: 'translocate', species: hopper.id });
    check(w.countPops().count[hopper.idx] === n0 + B.steward.translocateGroup, 'translocation brings in ' + B.steward.translocateGroup + ' ' + hopper.name + 's');
    // Harvest a set number over a season.
    const graz = w.species.find(sp => sp.name === 'Grazeling');
    run.harvest[graz.id] = 12;
    w.beginRound(1); St.startSeason(w, run);
    while (!w.roundOver()) w.tick();
    const took = w.harvested[graz.idx] ? w.harvested[graz.idx].n : 0;
    check(took >= 10 && took <= 12, 'a harvest limit of 12 takes ' + took + ' over the season');
    check((w.rstats[graz.idx].deaths.harvest || 0) === took, 'harvested animals are booked as deaths (D) in the demography');
    const res = St.endRound(w, run); run.round++;
    // Protection bans harvest and keeps fire out.
    St.apply(w, run, { id: 'protect', species: graz.id });
    St.startSeason(w, run);
    check(!w.harvest[graz.idx], 'protecting a species bans its harvest');
    const range = [];
    for (let i = 0; i < w.N * w.N; i++) if (graz.regionMap && graz.regionMap[i] && !w.terrain[i] && w.ptype[i]) range.push(i);
    if (range.length) {
      const i0 = range[0];
      St.apply(w, run, { id: 'burn', x: (i0 % w.N) + 0.5, y: ((i0 / w.N) | 0) + 0.5, r: 1.5 });
      check(w.ptype[i0], 'a prescribed burn skips the protected species’ range');
    }
    // Invasive control.
    const inv = w.importSpecies(T.EVENT_SPECIES.marauder, 20, [20, 20]);
    inv.invasive = true;
    St.apply(w, run, { id: 'control', species: inv.id });
    w.beginRound(run.round); St.startSeason(w, run);
    const c0 = w.countPops().count[inv.idx];
    while (!w.roundOver()) w.tick();
    const removed = w.harvested[inv.idx] ? w.harvested[inv.idx].n : 0;
    check(removed > 0, 'invasive control removed ' + removed + ' of ' + c0 + ' ' + inv.name + 's in a round');
    check(conserved(w), 'ledgers conserved through harvest, translocation and control');
  }

  console.log('\nOutcomes, score and saves');
  {
    const { w, run } = meadow(T.Gen.hashSeed(9900, 3));
    run.lowRounds = 1;
    const saved = B.steward.collapseEHI;
    B.steward.collapseEHI = 101;   // any EHI counts as low
    const res = season(w, run);
    B.steward.collapseEHI = saved;
    check(res.outcome && !res.outcome.win && res.outcome.kind === 'collapse', 'two rounds of low EHI end the run in collapse');
    run.ehiHistory = [80, 75, 70]; run.recovered = ['a']; run.reintroduced = ['b', 'c']; run.extinct = ['d'];
    const sc = St.score(run);
    check(sc.total === Math.round((75 * 3 + 40 + 80 - 40) * B.difficulties.standard.scoreMult), 'score = average EHI × rounds + recoveries + reintroductions − extinctions (' + sc.total + ')');
    const { w: w2, run: run2 } = meadow(T.Gen.hashSeed(9900, 4));
    St.apply(w2, run2, { id: 'exclosure', x: 20, y: 20, r: 4 });
    w2.harvest = { 0: 3 };
    const s = JSON.parse(JSON.stringify(w2.serialize()));
    const w3 = T.loadWorld(s, {});
    check(w3.exclosure.join() === w2.exclosure.join() && w3.harvest[0] === 3, 'saves keep exclosures and harvest limits');
    const r2 = JSON.parse(JSON.stringify(run2));
    check(St.ehi(w3, r2).total >= 0, 'a saved run’s EHI can be computed after loading');
  }

  console.log('\nRapid responses');
  {
    // Lightning strikes mid-season; a fire crew on call holds it to a fifth of its size. Same seed, crew vs none.
    const burnt = crew => {
      const { w, run } = meadow(T.Gen.hashSeed(9950, 1));
      const chance = B.succession.fireChance;
      B.succession.natural = true; B.succession.fireChance = new Proxy({}, { get: () => 1 });   // a fire every round
      w.round = 2; w.beginRound(2); St.startSeason(w, run);
      B.succession.fireChance = chance; B.succession.natural = false;
      const at = w.fireAt, t0 = w.t;
      if (crew) { run.sp = 99; St.rapid(w, run, { id: 'firecrew' }); }
      while (!w.roundOver()) w.tick();
      const f = w.disturbLog.find(d => d.type === 'wildfire');
      return { at: at - t0, tiles: f ? f.tiles : 0, contained: !!(f && f.contained) };
    };
    const open = burnt(false), held = burnt(true);
    check(open.at >= 0.25 * B.roundTicks && open.at <= 0.5 * B.roundTicks, 'lightning fires strike in summer, not at the start of the round (tick ' + open.at + ' of ' + B.roundTicks + ')');
    check(held.contained && held.tiles > 0 && held.tiles <= Math.ceil(open.tiles * 0.35), 'a fire crew on call holds the fire to ' + held.tiles + ' tiles (' + open.tiles + ' without)');
    const { w, run } = meadow(T.Gen.hashSeed(9950, 2));
    const inv = w.species.find(sp => !sp.grid && sp.level !== 'decomposer');
    inv.meta = Object.assign({}, inv.meta, { native: false });
    run.know[inv.id] = { level: 2, sightings: [], estimates: [], surveyRounds: [], collared: null, found: 'test' };
    run.sp = 99;
    const n0 = w.countPops().count[inv.idx], sp0 = run.sp;
    const r = St.rapid(w, run, { id: 'spot', species: inv.id });
    const n1 = w.countPops().count[inv.idx];
    check(r.ok && n0 - n1 === Math.ceil(n0 * 0.15) && sp0 - run.sp === r.cost, 'spot removal takes 15% of a non-native species at once (' + n0 + ' → ' + n1 + ', ' + r.cost + ' SP)');
    const full = St.cost(w, St.actionById('survey-count'), { x: w.N / 2, y: w.N / 2, r: 5 });
    const rs = St.rapid(w, run, { id: 'rapid-survey', x: w.N / 2, y: w.N / 2, r: 5 });
    check(rs.ok && Math.abs(rs.cost - full * 1.5) <= 1 && run.surveyed.length > 0, 'an emergency survey runs at once at 1.5× the cost (' + rs.cost + ' vs ' + full + ' SP)');
  }

  if (failures) { console.log('\n' + failures + ' steward check(s) failed'); process.exit(1); }
  console.log('\nall steward checks passed');
}
