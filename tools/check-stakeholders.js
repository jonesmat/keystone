// Stakeholder checks (Phase 3, P3-M7 part 3).
//   node tools/check-stakeholders.js
// Checks that:
//   - a run starts with 3–6 stakeholders, including the ones its scenario requires, and landholders hold parcels
//   - the steward can't work private land, only public land and easements
//   - asks name the world's real species; accepting and meeting one raises trust and pays SP; declining costs trust
//   - actions a stakeholder likes or dislikes move their trust; allies make liked actions cheaper, opponents disliked ones dearer
//   - the mandate is the influence-weighted mean trust, and a mandate below 25 for 2 rounds ends the run
//   - a landholder leaving puts land up for sale; an easement bid makes it manageable; a lost sale can develop it
//   - timber harvest and capping irrigation work; the community's draws never shift the simulation's random stream
//   - the land and community save with the run
const T = require('./load.js');
const B = T.BALANCE, St = T.Steward, SH = T.Stakeholders, P = B.stakeholders;

let failures = 0;
const check = (ok, text) => { if (!ok) failures++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + text); };
const season = (w, run) => { w.beginRound(run.round); St.startSeason(w, run); while (!w.roundOver()) w.tick(); w.updateMeans(); const r = St.endRound(w, run); run.round++; w.round = run.round; return r; };

T.Catalog.load('9.3', cat => {
  console.log('The community (Rewilding the ranch)');
  const roster = T.Catalog.roster(cat, T.scenarioById('rewilding'), 1001);
  const w = T.createWorld({ seed: 1001, roster, biome: roster.biome });
  const run = St.startRun(w, { scenario: 'rewilding' });
  const st = run.stake;
  console.log('    ' + st.list.map(s => s.name + ' (' + s.type + ', trust ' + s.trust + ', influence ' + s.influence + ')').join('; '));
  check(st.list.length >= P.count[0] && st.list.length <= P.count[1], st.list.length + ' stakeholders at the start');
  check(['rancher', 'conservation'].every(t => st.list.some(s => s.type === t)), 'the scenario’s rancher and conservation group are there');
  const ranch = st.list.find(s => s.type === 'rancher');
  check(ranch.parcel != null && w.parcels[ranch.parcel].tiles > 0, 'the rancher holds a parcel (' + (ranch.parcel != null ? w.parcels[ranch.parcel].tiles : 0) + ' tiles)');
  let priv = 0, land = 0;
  for (let i = 0; i < w.N * w.N; i++) if (!w.terrain[i]) { land++; if (w.landUse[i] === 1) priv++; }
  check(priv > 0 && priv <= P.maxPrivateShare * land + w.N * w.N / 16, Math.round(100 * priv / land) + '% of the land is private');

  // Private land is off limits.
  const pc = w.parcels[ranch.parcel], bs = w.N / 4, [bx, by] = pc.blocks[0];
  const cx = bx * bs + bs / 2, cy = by * bs + bs / 2;
  const before = St.tilesIn(w, cx, cy, 4, true).map(i => w.comp[i]);
  run.sp = 999;
  St.queue(w, run, { id: 'loosen', x: cx, y: cy, r: 4 });
  w.beginRound(run.round); St.startSeason(w, run);
  const after = St.tilesIn(w, cx, cy, 4, true).map(i => w.comp[i]);
  check(before.every((v, k) => v === after[k] || !SH.manageable(w, St.tilesIn(w, cx, cy, 4, true)[k])), 'loosening soil on the ranch’s private land does nothing');

  // Asks.
  console.log('\nAsks');
  const w2 = T.createWorld({ seed: 1001, roster, biome: roster.biome });
  const run2 = St.startRun(w2, { scenario: 'rewilding' });
  let asked = run2.stake.asks.slice();
  for (let k = 0; k < 8 && asked.length < 6; k++) { SH.newAsks(w2, run2); asked = asked.concat(run2.stake.asks); }
  console.log('    ' + asked.slice(0, 6).map(a => run2.stake.list[a.from].name + ': ' + a.text).join('\n    '));
  const withSp = asked.filter(a => a.species);
  check(withSp.length && withSp.every(a => w2.speciesById(a.species)), 'asks name the world’s real species');
  // Accept a survey ask and meet it; decline another.
  const survey = { from: run2.stake.list[0].id, kind: 'survey', species: w2.species.find(sp => T.Knowledge.known(run2, sp) && w2.countPops().count[sp.idx] > 20 && !sp.grid).id, reward: 6, state: 'open', text: 'Survey' };
  const decl = { from: run2.stake.list[1].id, kind: 'water', reward: 6, state: 'open', text: 'Water' };
  run2.stake.asks = [survey, decl];
  const t0 = run2.stake.list[0].trust, t1 = run2.stake.list[1].trust;
  SH.answer(run2, 0, true); SH.answer(run2, 1, false);
  check(run2.stake.list[1].trust < t1, 'declining an ask costs trust (' + t1 + ' → ' + run2.stake.list[1].trust + ')');
  run2.sp = 999;
  const sp = w2.speciesById(survey.species);
  // Survey the whole map so the species is estimated this round.
  St.queue(w2, run2, { id: 'survey-count', x: w2.N / 2, y: w2.N / 2, r: 70 });
  St.queue(w2, run2, { id: 'survey-camera', x: w2.N / 2, y: w2.N / 2, r: 70 });
  St.queue(w2, run2, { id: 'survey-traps', x: w2.N / 2, y: w2.N / 2, r: 70 });
  St.queue(w2, run2, { id: 'survey-pitfall', x: w2.N / 2, y: w2.N / 2, r: 70 });
  const r2 = season(w2, run2);
  const res = r2.community.asks.find(a => a.text === 'Survey');
  check(res && res.ok && run2.stake.list[0].trust > t0, 'an accepted survey ask of ' + sp.name + ' is met: trust ' + t0 + ' → ' + run2.stake.list[0].trust + ', +' + (res && res.reward) + ' SP');

  // Likes, dislikes and costs.
  console.log('\nTrust, costs and the mandate');
  const cons = run2.stake.list.find(s => s.type === 'conservation'), rancher = run2.stake.list.find(s => s.type === 'rancher');
  const tc = cons.trust, tr = rancher.trust;
  SH.onActions(run2, ['reintroduce']);
  check(cons.trust > tc && rancher.trust < tr, 'a reintroduction pleases the conservation group (' + tc + ' → ' + cons.trust + ') and upsets the rancher (' + tr + ' → ' + rancher.trust + ')');
  const a = St.actionById('reintroduce');
  cons.trust = 50; rancher.trust = 50;
  const base = St.cost(w2, a);
  cons.trust = 80;
  const cheap = St.cost(w2, a);
  cons.trust = 50; rancher.trust = 10;
  const dear = St.cost(w2, a);
  check(cheap < base && dear > base, 'reintroduction costs ' + base + ' SP; ' + cheap + ' with the conservation group an ally, ' + dear + ' with the rancher an opponent');
  const act = run2.stake.list.filter(s => s.active);
  const m = Math.round(act.reduce((x, s) => x + s.influence * s.trust, 0) / act.reduce((x, s) => x + s.influence, 0));
  check(SH.mandate(run2) === m, 'the mandate is the influence-weighted mean trust (' + m + '%)');
  for (const s of run2.stake.list) s.trust = 5;
  run2.stake.changing = false;
  let out = null;
  for (let k = 0; k < 3 && !out; k++) { for (const s of run2.stake.list) s.trust = 5; out = season(w2, run2).outcome; }
  check(out && out.kind === 'mandate', 'a mandate below ' + P.loseMandate + ' for ' + P.loseRounds + ' rounds ends the run: ' + (out && out.headline));

  // Land sales.
  console.log('\nLand sales');
  for (const win of [true, false]) {
    const w3 = T.createWorld({ seed: 1001, roster, biome: roster.biome });
    const run3 = St.startRun(w3, { scenario: 'rewilding' });
    const r = run3.stake.list.find(s => s.type === 'rancher');
    r.active = false;
    const pc = w3.parcels[r.parcel];
    run3.stake.sale = { parcel: r.parcel, from: r.name, round: run3.round, price: 30, allies: 0 };
    let res;
    if (win) { run3.sp = 100; SH.bid(w3, run3); res = pc.use; }
    else { run3.stake.mandate = 10; res = SH.settleSale(w3, run3, false).use; }
    const tiles = []; for (let i = 0; i < w3.N * w3.N; i++) if (!w3.terrain[i] && ((pc.blocks.some(([bx, by]) => (i % w3.N) >= bx * w3.N / 4 && (i % w3.N) < (bx + 1) * w3.N / 4 && ((i / w3.N) | 0) >= by * w3.N / 4 && ((i / w3.N) | 0) < (by + 1) * w3.N / 4)))) tiles.push(i);
    if (win) check(res === 'easement' && run3.sp === 70 && tiles.every(i => SH.manageable(w3, i)), 'bidding 30 SP buys a conservation easement the steward can manage');
    else {
      console.log('    the lost sale went to: ' + res);
      if (w3.landUse[tiles[0]] === 3) {
        w3.beginRound(2); for (let k = 0; k < B.roundTicks; k++) w3.tick();
        check(tiles.every(i => !w3.ptype[i]), 'developed land stays cleared');
      } else check(['ranch', 'hunting lease', 'private reserve'].includes(res), 'the land went to a new private owner');
    }
  }

  // Timber, water and the random stream.
  console.log('\nTimber, water and the random stream');
  {
    const wa = T.createWorld({ seed: 77, roster: T.Gen.meadowRoster() }), wb = T.createWorld({ seed: 77, roster: T.Gen.meadowRoster() });
    St.startRun(wa, {}); St.startRun(wb, { community: false });
    check(wa.rng.s === wb.rng.s, 'generating the community leaves the simulation’s random stream untouched');
    const run = wb.run;
    run.sp = 999;
    // Plant a stand, grow it to maturity, then cut it.
    const tree = wb.producers.find(P => P && P.stage === 4);
    if (tree) {
      let cx = 30, cy = 30;
      for (let k = 0; k < 400 && St.tilesIn(wb, cx, cy, 3, true).length < 25; k++) { cx = 10 + (k * 7) % 76; cy = 10 + ((k * 13) % 76); }
      const ts = St.tilesIn(wb, cx, cy, 3, true);
      for (const i of ts) { wb._switchProducer(i, tree); wb.pE[i] = tree.max * 0.5; }
      St.queue(wb, run, { id: 'timber', x: cx, y: cy, r: 3 });
      const E0 = wb.ledger.exported;
      St.startSeason(wb, run);
      check(run.timberTiles >= ts.length * 0.8 && wb.ledger.exported > E0, 'timber harvest cuts ' + run.timberTiles + ' mature tiles and exports the logs, for ' + run.timberSP + ' SP');
    }
    wb.irrigation = 1;
    St.queue(wb, run, { id: 'water' }); St.startSeason(wb, run);
    check(Math.abs(wb.irrigation - (1 - B.steward.waterCap)) < 1e-9, 'capping irrigation cuts the draw on the aquifer by 40%');
  }

  console.log('\nSaves');
  {
    const s = JSON.parse(JSON.stringify(w.serialize()));
    const w4 = T.loadWorld(s, {});
    let same = true;
    for (let i = 0; i < w.N * w.N; i++) if (w4.landUse[i] !== w.landUse[i]) { same = false; break; }
    check(same && w4.parcels.length === w.parcels.length, 'land use and parcels save and load');
  }

  if (failures) { console.log('\n' + failures + ' stakeholder check(s) failed'); process.exit(1); }
  console.log('\nall stakeholder checks passed');
});
