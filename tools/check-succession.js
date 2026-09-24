// Succession, disturbance and biome checks (Phase 3, P3-M6 part 1).
//   node tools/check-succession.js
// Checks that:
//   - the Whittaker classification matches the design's table, for test climates and the game's biomes
//   - a volcanic isle goes rock → pioneers → grasses, and every advance met its stage's soil thresholds
//   - a burned patch regrows from its seed bank at once, and a forest patch returns toward woodland in about 10 rounds
//   - grassland stays grassland away from water (its climax), and old woody tiles open light gaps
//   - floods waterlog low ground and raise denitrification; windthrow fells only shrubs and trees
//   - energy and nitrogen are conserved through every disturbance, and saves keep the seral state
const T = require('./load.js');
const B = T.BALANCE;

let failures = 0;
const check = (ok, text) => { if (!ok) failures++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + text); };
const world = (seed, opts) => T.createWorld(Object.assign({ seed, roster: T.Gen.meadowRoster(), player: null, difficulty: B.difficulties.standard }, opts || {}));
const round = w => { while (!w.roundOver()) w.tick(); w.updateMeans(); w.beginRound(w.round + 1); };
const pct = v => (v * 100).toFixed(0) + '%';
const conserved = w => w.ledger.maxErr < 1e-3 && w.nledger.maxErr < 1e-3;
const stageOf = (w, i) => (w.rock[i] ? 0 : w.producers[w.ptype[i]] ? w.producers[w.ptype[i]].stage : 0);

// ---------- biomes ----------
console.log('Biomes from climate (the Whittaker diagram)');
{
  const cases = [[-10, 30, 'tundra'], [0, 50, 'taiga'], [20, 20, 'desert'], [10, 60, 'grassland'], [12, 120, 'forest'], [25, 150, 'tropSeasonal'], [26, 300, 'rainforest']];
  const bad = cases.filter(([t, p, id]) => T.whittaker(t, p).id !== id);
  check(!bad.length, 'test climates classify as the design table says' + (bad.length ? ' (not: ' + bad.map(c => c.join('/')).join(', ') + ')' : ''));
  const shown = Object.values(B.biomes).map(b => b.name + ' → ' + T.whittaker(b.tMean, b.rain).name + ' (climax: ' + T.whittaker(b.tMean, b.rain).climaxName + ')');
  console.log('    ' + shown.join('; '));
}

// ---------- primary succession ----------
console.log('\nPrimary succession (volcanic isle, 10 rounds)');
{
  const P = B.succession;
  const w = world(T.Gen.hashSeed(8100, 1), { primary: true });
  const bad = [];
  const orig = w._switchProducer;
  w._switchProducer = function (i, Pr) {
    const from = stageOf(this, i), bare = !this.rock[i] && !this.ptype[i];   // bare soil regrows (secondary succession)
    if (Pr.stage > from && (this.som[i] < P.som[Pr.stage] || this.nh4[i] + this.no3[i] < P.nMin[Pr.stage])) bad.push(i);
    if (!bare && Pr.stage > from + 1 && this.stagesPresent.some(s => s > from && s < Pr.stage)) bad.push(i);
    return orig.call(this, i, Pr);
  };
  const s0 = w.seralSummary().share;
  const firstAt = {};
  for (let r = 1; r <= 10; r++) {
    round(w);
    const sh = w.seralSummary().share;
    sh.forEach((v, s) => { if (v > 0.005 && firstAt[s] == null && s > 0) firstAt[s] = r; });
    if (r % 2 === 0) console.log('    round ' + r + ': ' + sh.map((v, s) => T.SERAL_STAGES[s].split(' (')[0] + ' ' + pct(v)).join(', '));
  }
  const s1 = w.seralSummary().share;
  check(s0[0] > 0.99, 'the isle starts as bare rock (' + pct(s0[0]) + ')');
  check(firstAt[1] != null && (firstAt[2] == null || firstAt[1] < firstAt[2]), 'pioneers arrive before grasses (pioneers round ' + firstAt[1] + ', grasses round ' + firstAt[2] + ')');
  check(s1[0] < 0.5 && s1[2] > 0.05, 'most rock is colonized and grasses are spreading by round 10');
  check(!bad.length, 'every advance met its stage\'s soil organic matter and nitrogen and skipped no stage (' + bad.length + ' violations)');
  check(conserved(w), 'ledgers conserved');
}

// ---------- secondary succession ----------
console.log('\nSecondary succession after fire (a woodland in the forest biome)');
{
  const w = world(T.Gen.hashSeed(8200, 1), { biome: B.biomes.wetland, closed: true });
  B.succession.natural = false;
  const wood = w.producers.find(P => P && P.stage === 4);
  // A 20 × 20 block of mature woodland, then a fire through its middle.
  const N = w.N, block = [];
  for (let y = 22; y < 42; y++) for (let x = 22; x < 42; x++) { const i = y * N + x; if (!w.terrain[i]) { w._switchProducer(i, wood); w.pE[i] = wood.max * 0.7; w.sAge[i] = 1; block.push(i); } }
  w._computeShade(); w._successionCover();
  w.ledger.initial = w.totalPools(); w.nledger.initial = w.totalNitrogen();
  const banksBefore = new Map(block.map(i => [i, [w.bank[i * 3], w.bank[i * 3 + 1], w.bank[i * 3 + 2]]]));
  const fire = w.wildfire(32 * N + 32, 120);
  const burned = block.filter(i => w.burn[i]);
  for (let k = 0; k < B.succession.every; k++) w.tick();
  const regrown = burned.filter(i => w.ptype[i]).length, fromBank = burned.filter(i => w.ptype[i] && banksBefore.get(i).includes(w.ptype[i])).length;
  console.log('    fire burned ' + fire.tiles + ' tiles (' + burned.length + ' in the woodland)');
  check(fire.tiles >= 40, 'the fire spreads through the woodland');
  check(regrown >= burned.length * 0.95 && fromBank >= regrown * 0.9, regrown + ' of ' + burned.length + ' burned tiles regrew from their seed bank within one step, at the grasses stage');
  check(burned.every(i => stageOf(w, i) <= 2), 'burned tiles restart at the grasses stage (secondary succession)');
  const woodyShare = () => burned.filter(i => stageOf(w, i) >= 3).length / burned.length;
  const track = [];
  for (let r = 1; r <= 10; r++) { round(w); track.push(woodyShare()); }
  console.log('    woody share of the burn by round: ' + track.map(pct).join(' '));
  check(track[9] >= 0.6, 'the woodland returns toward climax within about 10 rounds (' + pct(track[9]) + ' woody)');
  check(conserved(w), 'ledgers conserved through the fire and regrowth');
  B.succession.natural = true;
}

// ---------- grassland climax and light gaps ----------
console.log('\nClimax and light gaps (Meadow, a temperate grassland, 6 rounds)');
{
  const w = world(T.Gen.hashSeed(8300, 1));
  const riparian = B.succession.riparianMoist;
  let dryWoody = 0;
  const orig = w._switchProducer;
  w._switchProducer = function (i, Pr) { if (Pr.stage >= 3 && this.moist[i] < riparian && !this.rock[i]) dryWoody++; return orig.call(this, i, Pr); };
  const woody0 = w.seralSummary().share[4];
  for (let r = 0; r < 6; r++) round(w);
  const s = w.seralSummary();
  console.log('    ' + w.biomeClass.name + ', climax ' + w.biomeClass.climaxName + ' · woodland ' + pct(woody0) + ' → ' + pct(s.share[4]) + ' · light gaps ' + (w.gaps || 0) +
    ' · disturbances: ' + (w.disturbLog.map(d => d.type + ' ' + d.tiles).join(', ') || 'none'));
  check(dryWoody === 0, 'no shrubs or trees establish on dry grassland (its climax is prairie; ' + dryWoody + ' did)');
  check((w.gaps || 0) > 0, 'old woody tiles die at their longevity and open light gaps');
  check(conserved(w), 'ledgers conserved');
}

// ---------- flood and windthrow ----------
console.log('\nFlood and windthrow');
{
  const seed = T.Gen.hashSeed(8400, 1);
  B.succession.natural = false;
  const a = world(seed, { closed: true }), b = world(seed, { closed: true });
  round(a); round(b);
  const f = b.flood(0.06);
  const low = []; for (let i = 0; i < b.N * b.N; i++) if (!b.terrain[i] && b.elev[i] <= b.waterLine + 0.06) low.push(i);
  check(f.tiles > 0 && low.every(i => b.sw[i] >= 0.99 && !b.pE[i]), 'a flood clears and waterlogs ' + f.tiles + ' low tiles');
  for (const w of [a, b]) while (!w.roundOver()) w.tick();
  const dA = a.cbook.denitrified, dB = b.cbook.denitrified;
  console.log('    denitrification the round after: ' + Math.round(dA) + ' → ' + Math.round(dB) + ' N');
  check(dB > dA, 'the flooded world denitrifies more');
  const w = world(T.Gen.hashSeed(8500, 1), { biome: B.biomes.wetland, closed: true });
  const before = new Map();
  for (let i = 0; i < w.N * w.N; i++) before.set(i, stageOf(w, i));
  const wt = w.windthrow(0.2);
  let wrong = 0;
  for (let i = 0; i < w.N * w.N; i++) if (stageOf(w, i) !== before.get(i) && before.get(i) < 3) wrong++;
  check(wt.tiles > 0 && !wrong, 'windthrow felled ' + wt.tiles + ' shrub and woodland tiles and nothing else');
  for (let k = 0; k < 300; k++) w.tick();
  check(conserved(a) && conserved(b) && conserved(w), 'ledgers conserved through floods and windthrow');
  B.succession.natural = true;
}

// ---------- saves ----------
console.log('\nSaves');
{
  const w = world(T.Gen.hashSeed(8600, 1), { primary: true });
  round(w); round(w);
  const s = JSON.parse(JSON.stringify(w.serialize()));
  const w2 = T.loadWorld(s, {});
  const same = w.seralSummary().counts.join() === w2.seralSummary().counts.join();
  check(same && !!w2.producerById('lichen') && w2.bank.join() === w.bank.join(), 'seral stages, seed banks and the pioneer survive save and load');
  for (let k = 0; k < 600; k++) w2.tick();
  check(conserved(w2), 'ledgers stay conserved after loading');
}

if (failures) { console.log('\n' + failures + ' succession check(s) failed'); process.exit(1); }
console.log('\nall succession checks passed');
