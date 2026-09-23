// Population checks (Phase 3, P3-M4: the two-tier simulation).
//   node tools/check-populations.js
// - energy and nitrogen stay conserved with Populations in both hand-authored worlds
// - cutting a strip through a Population's region splits it into two Populations, each keeping its share of N
// - closing the gap merges them back into one
// - individual predators eat from Populations, and the prey's deaths are booked as kills
// - herds, packs and flocks get Population regions listing their members
// - saves keep Populations and their regions
const T = require('./load.js');
const B = T.BALANCE;
let failures = 0;
const check = (ok, text) => { if (!ok) failures++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + text); };
const world = (roster, biome, seed) => T.createWorld({ seed, roster, player: null, biome, difficulty: B.difficulties.standard });
const play = (w, rounds) => { for (let r = 0; r < rounds; r++) { while (!w.roundOver()) w.tick(); w.updateMeans(); w.beginRound(w.round + 1); } };

// ---------- conservation and cost ----------
console.log('Conservation and cost (3 rounds each)');
const meadow = world(T.Gen.meadowRoster(), B.biomes.meadow, 41);
const channel = world(T.Gen.channelRoster(), B.biomes.channel, 42);
let ms = 0;
for (const w of [meadow, channel]) {
  const t0 = Date.now();
  play(w, 3);
  ms = Math.max(ms, (Date.now() - t0) / (3 * B.roundTicks));
}
check(Math.max(meadow.ledger.maxErr, channel.ledger.maxErr) < 1e-3, 'energy conserved (max error ' + (Math.max(meadow.ledger.maxErr, channel.ledger.maxErr) * 100).toExponential(1) + '%)');
check(Math.max(meadow.nledger.maxErr, channel.nledger.maxErr) < 1e-3, 'nitrogen conserved (max error ' + (Math.max(meadow.nledger.maxErr, channel.nledger.maxErr) * 100).toExponential(1) + '%)');
check(ms <= 3, 'tick cost ' + ms.toFixed(2) + ' ms (budget 3 ms)');

// ---------- split and merge ----------
console.log('\nSplit and merge (a cleared strip through a Rotmite region, then refilled)');
{
  const w = meadow, sp = w.species.find(s => s.grid && s.level === 'decomposer');
  w.updateRegions();
  const big = sp.regions[0];
  const N = w.N, g = sp.grid;
  // A two-tile-wide strip down the middle of the region, like a disc strip across a meadow.
  const xs = big.tiles.map(i => i % N).sort((a, b) => a - b);
  const cx = xs[Math.floor(xs.length / 2)];
  const strip = [];
  for (let y = 0; y < N; y++) for (const x of [cx, cx + 1]) if (x < N) strip.push(y * N + x);
  const before = big.n;
  for (const i of strip) if (sp.regionMap[i] === big.id) w._popClear(sp, i);
  w.updateRegions();
  const pieces = sp.regions.filter(r => r.id === big.id || r.splitFrom === big.id);
  const labels = new Set(pieces.map(r => r.label));
  const kept = pieces.reduce((a, r) => a + r.n, 0);
  console.log('    ' + big.label + ' (' + Math.round(before) + ') → ' + pieces.map(r => r.label + ' (' + Math.round(r.n) + ')').join(', '));
  check(pieces.length >= 2 && labels.size === pieces.length, 'the cut region becomes separate Populations with their own place names');
  check(pieces.some(r => r.history.some(h => /split/.test(h.text))), 'the split is in the regions\' history');
  check(kept > 0.5 * before, 'the pieces keep their share of N (' + Math.round(kept) + ' of ' + Math.round(before) + ', less the strip)');
  // Close the gap: resettle the strip from the neighbouring tiles.
  for (const i of strip) {
    if (!w.popSuitable(sp, i)) continue;
    const j = i - 1 >= 0 && sp.regionMap[i - 1] ? i - 1 : i + 2;
    if (j < N * N && g.nA[j] > 0) w._popMove(sp, j, i, 0.5);
  }
  w.updateRegions();
  const heir = sp.regions.find(r => r.id === big.id);
  check(!!heir && heir.history.some(h => /merged/.test(h.text)), 'closing the gap merges them back into ' + (heir ? heir.label : 'one Population'));
}

// ---------- predation on Populations ----------
console.log('\nPredators eating from Populations (Open Channel)');
{
  const w = world(T.Gen.channelRoster(), B.biomes.channel, 43);   // a fresh world, while its predators are all present
  const drift = w.species.find(s => s.id === 'driftling');
  let kills = 0, eaten = 0;
  const saw = {};
  for (let k = 0; k < 600; k++) w.tick();
  for (const sp of w.species) {
    const rs = w.rstats[sp.idx];
    for (const k in rs.kills) if (k === 'driftling' || k === 'glassclam') { kills += rs.kills[k]; saw[sp.name] = true; }
    eaten += rs.eatenLv.herbivore || 0;
  }
  const deaths = Object.entries(w.rstats[drift.idx].deaths).filter(([k]) => k.startsWith('k:')).reduce((a, [, v]) => a + v, 0);
  console.log('    first half-round: predators killed ' + kills + ' Driftlings and Glassclams (' + Object.keys(saw).join(', ') + '); Driftling deaths booked to predators: ' + deaths);
  check(kills > 0 && eaten > 0 && deaths > 0, 'predators eat from Populations, and the prey\'s deaths are booked as kills');
}

// ---------- vertebrate groups ----------
console.log('\nHerds, packs and flocks');
{
  const w = meadow;
  w.updateRegions();
  const grazer = w.species.find(s => s.id === 'grazeling');
  const n = w.ents.filter(e => e.alive && e.sp === grazer).length;
  const listed = grazer.regions.reduce((a, r) => a + (r.members ? r.members.length : 0), 0);
  console.log('    Grazelings: ' + n + ' individuals in ' + grazer.regions.length + ' group regions (' + grazer.regions.slice(0, 3).map(r => r.label + ' ' + r.n).join(', ') + ')');
  check(grazer.regions.length > 0 && listed === n, 'every individual belongs to one group region');
}

// ---------- saves ----------
console.log('\nSaves');
{
  const w = channel;
  const s = JSON.parse(JSON.stringify(w.serialize()));
  const w2 = T.loadWorld(s, {});
  const a = w.countPops().count, b = w2.countPops().count;
  const regionsA = w.species.map(sp => (sp.regions || []).length).join(','), regionsB = w2.species.map(sp => (sp.regions || []).length).join(',');
  for (let k = 0; k < 600; k++) w2.tick();
  console.log('    counts ' + a.join(',') + ' → ' + b.join(',') + '; regions per species ' + regionsA + ' → ' + regionsB);
  check(a.join() === b.join(), 'Population counts survive save and load');
  check(w2.ledger.maxErr < 1e-3 && w2.nledger.maxErr < 1e-3, 'ledgers stay conserved after loading');
}

if (failures) { console.log('\n' + failures + ' population check(s) failed'); process.exit(1); }
console.log('\nall population checks passed');
