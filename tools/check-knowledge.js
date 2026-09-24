// Knowledge checks (Phase 3, P3-M7 part 2).
//   node tools/check-knowledge.js
// Checks that:
//   - a run starts with the previous steward's records (5–10 key species, 1–5 years old) and most species unknown
//   - each survey method detects only the taxa it suits, and its estimates bracket the truth
//   - two surveys in a round tighten the error; estimates go stale (±15% of N a round, Sighted after 5 rounds)
//   - surveys in 3 rounds or a radio collar make a species Studied, and a collar reports its animal's fate
//   - chance sightings favour big, day-active animals over soil fauna, and discoveries pay SP
//   - the EHI range the steward sees contains the true EHI and narrows as they learn
//   - soil tests and well gauges stay fresh for 3 rounds; a monitoring program repeats surveys at half cost
//   - the knowledge records save and load with the run
const T = require('./load.js');
const B = T.BALANCE, St = T.Steward, K = T.Knowledge;

let failures = 0;
const check = (ok, text) => { if (!ok) failures++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + text); };
const season = (w, run) => { w.beginRound(run.round); St.startSeason(w, run); while (!w.roundOver()) w.tick(); w.updateMeans(); const r = St.endRound(w, run); run.round++; w.round = run.round; return r; };
const levels = (w, run) => { const c = [0, 0, 0, 0]; for (const sp of w.species) if (w.countPops().count[sp.idx] && !sp.transient) c[K.level(run, sp)]++; return c; };

T.Catalog.load('9.3', cat => {
  console.log('Starting knowledge (Rewilding the ranch)');
  const roster = T.Catalog.roster(cat, T.scenarioById('rewilding'), 1001);
  const w = T.createWorld({ seed: 1001, roster, biome: roster.biome });
  const run = St.startRun(w, { scenario: 'rewilding' });
  const c0 = levels(w, run);
  const recs = w.species.filter(sp => run.know[sp.id] && run.know[sp.id].found === 'records');
  const ages = recs.map(sp => K.estimate(run, sp).age);
  console.log('    unknown ' + c0[0] + ', sighted ' + c0[1] + ', surveyed ' + c0[2] + ', studied ' + c0[3] + ' · records: ' + recs.map(sp => sp.name).join(', '));
  check(recs.length >= B.knowledge.recordsMin && recs.length <= B.knowledge.recordsMax && ages.every(a => a >= 1 && a <= 5), recs.length + ' key species start in the previous steward’s records, 1–5 years old');
  check(recs.some(sp => sp.domestic), 'the ranch’s cattle are in the records');
  check(c0[0] > c0[1] + c0[2] + c0[3], 'most species start unknown');
  const old = recs.map(sp => K.estimate(run, sp)).find(e => e.age >= 2);
  if (old) check(Math.abs(old.err - (old.err - B.knowledge.stalePerRound * old.N * old.age) - B.knowledge.stalePerRound * old.N * old.age) < 1e-9 && old.err > B.knowledge.stalePerRound * old.N * old.age, 'old records carry error bars widened by their age');
  meadow();
});

function meadow() {
  console.log('\nSurvey methods (Meadow)');
  const w = T.createWorld({ seed: 4242, roster: T.Gen.meadowRoster() });
  const run = St.startRun(w, {});
  run.sp = 9999;
  w.beginRound(1);
  const pops = w.countPops().count;
  const fits = {};
  for (const m in K.METHODS) fits[m] = w.species.filter(sp => K.METHODS[m].fits(sp)).map(sp => sp.name);
  console.log('    ' + Object.entries(fits).map(([m, l]) => m + ': ' + (l.join(', ') || 'none')).join(' · '));
  const res = K.survey(w, run, 'count', w.N / 2, w.N / 2, 30);
  check(res.length && res.every(x => K.METHODS.count.fits(x.sp)), 'point counts estimate only the species they suit');
  // Accuracy over several big surveys.
  let inside = 0, n = 0;
  for (const m of ['count', 'camera', 'traps', 'pitfall']) {
    const w2 = T.createWorld({ seed: 4243 + n, roster: T.Gen.meadowRoster() }), r2 = St.startRun(w2, {});
    w2.beginRound(1);
    const p2 = w2.countPops().count;
    for (const x of K.survey(w2, r2, m, w2.N / 2, w2.N / 2, 30)) { const e = K.estimate(r2, x.sp); n++; if (Math.abs(e.N - p2[x.sp.idx]) <= 2 * e.err) inside++; }
  }
  check(inside >= 0.8 * n, inside + ' of ' + n + ' survey estimates within two error bars of the truth');
  // Two surveys in a round tighten the error.
  const graz = w.species.find(sp => sp.name === 'Grazeling');
  const r3 = St.startRun(w, {});
  K.survey(w, r3, 'traps', 30, 30, 12);
  const e1 = K.estimate(r3, graz);
  K.survey(w, r3, 'traps', 66, 66, 12);
  const e2 = K.estimate(r3, graz);
  if (e1 && e2) check(e2.err < e1.err, 'a second survey this round tightens the estimate (±' + e1.err + ' → ±' + e2.err + ')');

  console.log('\nStaleness, studying and collars');
  {
    const w = T.createWorld({ seed: 5151, roster: T.Gen.meadowRoster() });
    const run = St.startRun(w, {});
    run.sp = 9999;
    const tusk = w.species.find(sp => sp.name === 'Tuskbeast');
    St.queue(w, run, { id: 'survey-count', x: w.N / 2, y: w.N / 2, r: 40 });
    season(w, run);
    check(K.level(run, tusk) >= 2, 'a big survey makes Tuskbeasts Surveyed');
    const eA = K.estimate(run, tusk);
    for (let k = 0; k < 6; k++) season(w, run);
    const eB = K.estimate(run, tusk);
    check(Math.abs(eB.err - eA.err - B.knowledge.stalePerRound * eA.N * (eB.age - eA.age)) < 1e-6 && K.level(run, tusk) === 1, 'unsurveyed for 6 rounds, the error grows 15% of N a round and the species drops to Sighted');
    for (let k = 0; k < 3; k++) { St.queue(w, run, { id: 'survey-count', x: w.N / 2, y: w.N / 2, r: 40 }); season(w, run); }
    check(K.level(run, tusk) === 3, 'surveyed in 3 rounds, Tuskbeasts are Studied');
    const graz = w.species.find(sp => sp.name === 'Grazeling');
    const e = K.collar(w, run, graz);
    check(e && K.level(run, graz) === 3, 'a radio collar makes Grazelings Studied');
    w._die(e, 'starved', -1);
    check(w.collarFates[e.id] && w.collarFates[e.id].cause === 'starved', 'the collar reports its animal’s fate (' + (w.collarFates[e.id] || {}).cause + ')');
  }

  console.log('\nSightings, discoveries and the EHI range');
  {
    const w = T.createWorld({ seed: 6161, roster: T.Gen.meadowRoster() });
    const run = St.startRun(w, {});
    run.know = {};   // start blind, so chance sightings have something to find
    const tusk = w.species.find(sp => sp.name === 'Tuskbeast'), rot = w.species.find(sp => sp.name === 'Rotmite');
    check(K.conspicuous(w, tusk) > 20 * K.conspicuous(w, rot), 'Tuskbeasts are far more conspicuous than soil Rotmites');
    const views = [];
    let found = 0, spEarned = 0, contains = 0, rounds = 0;
    for (let k = 0; k < 4; k++) {
      const r = season(w, run);
      found += r.discovered.length;
      const d = r.parts.find(p => /^Discovered/.test(p[0]));
      if (d) spEarned += d[1];
      if (r.view.lo <= r.ehi.total && r.ehi.total <= r.view.hi) contains++;
      rounds++;
      views.push(r.view.hi - r.view.lo);
    }
    console.log('    ' + found + ' discoveries by chance sightings over 4 rounds (+' + spEarned + ' SP); EHI range widths ' + views.join(', '));
    check(found > 0 && spEarned > 0, 'chance sightings discover species and pay SP');
    check(contains === rounds, 'the EHI range the steward sees always contains the true EHI');
    run.sp = 9999;
    for (const m of ['survey-count', 'survey-camera', 'survey-traps', 'survey-pitfall']) St.queue(w, run, { id: m, x: w.N / 2, y: w.N / 2, r: 40 });
    St.queue(w, run, { id: 'soiltest', x: w.N / 2, y: w.N / 2, r: 6 });
    St.queue(w, run, { id: 'wellgauge' });
    const r = season(w, run);
    console.log('    after surveying everything: EHI seen as ' + r.view.lo + '–' + r.view.hi + ' (true ' + r.ehi.total + ')');
    check(r.view.hi - r.view.lo < views[views.length - 1] && r.view.lo <= r.ehi.total && r.ehi.total <= r.view.hi, 'surveys narrow the EHI range, which still contains the truth');
    check(K.fresh(run, run.soilTests[run.soilTests.length - 1]) && K.fresh(run, run.wellGauge), 'the soil test and well gauge are fresh');
    for (let k = 0; k < 3; k++) season(w, run);
    check(!K.fresh(run, run.wellGauge), 'after 3 more rounds the well gauge reading is stale');
  }

  console.log('\nMonitoring program and saves');
  {
    const w = T.createWorld({ seed: 7171, roster: T.Gen.meadowRoster() });
    const run = St.startRun(w, {});
    run.sp = 200;
    St.queue(w, run, { id: 'survey-count', x: 40, y: 40, r: 10 });
    const full = run.queue[0].cost;
    St.queue(w, run, { id: 'monitor' });
    season(w, run);
    const sp0 = run.sp;
    const n0 = Object.values(run.know).reduce((a, k) => a + k.surveyRounds.length, 0);
    w.beginRound(run.round); St.startSeason(w, run);
    const n1 = Object.values(run.know).reduce((a, k) => a + k.surveyRounds.length, 0);
    check(n1 > n0 && sp0 - run.sp === Math.ceil(full / 2), 'the monitoring program repeats the survey next round at half cost (' + (sp0 - run.sp) + ' of ' + full + ' SP)');
    const s = JSON.parse(JSON.stringify(w.serialize())), runCopy = JSON.parse(JSON.stringify(run));
    const w2 = T.loadWorld(s, {});
    const graz = w2.species.find(sp => sp.name === 'Grazeling');
    check(K.level(runCopy, graz) === K.level(run, w.species.find(sp => sp.name === 'Grazeling')), 'knowledge records save and load with the run');
  }

  if (failures) { console.log('\n' + failures + ' knowledge check(s) failed'); process.exit(1); }
  console.log('\nall knowledge checks passed');
}
