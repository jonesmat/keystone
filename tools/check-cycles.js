// Nutrient, water and carbon cycle checks (Phase 3, P3-M3).
//   node tools/check-cycles.js [--seeds 2] [--rounds 6] [--set key=value ...]
// Plays hands-off Temperate Meadow worlds and checks the cycles against the design:
//   - nitrogen and energy are conserved (error < 0.1%)
//   - removing the decomposer guild slows producer growth within 2–3 rounds (decomposers are a keystone guild)
//   - compacted soil stops nitrifying, denitrifies and sheds rain as runoff
//   - legumes enrich the soil around them
//   - with the CO2 trend on, the warm south edge loses producers faster than the cool north edge
const T = require('./load.js');
const B = T.BALANCE;
B.succession.natural = false;   // cycle tests isolate their own mechanism; disturbances are tested in check-succession.js

const args = process.argv.slice(2);
const opt = { seeds: 2, rounds: 6, set: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--set') opt.set.push(args[++i]);
  else if (a.startsWith('--')) opt[a.slice(2)] = args[++i];
}
for (const kv of opt.set) {
  const [k, v] = kv.split('=');
  const path = k.split('.'), last = path.pop();
  path.reduce((o, p) => o[p], B)[last] = v.includes(',') ? v.split(',').map(Number) : Number(v);
}
opt.seeds = +opt.seeds; opt.rounds = +opt.rounds;
let failures = 0;
const check = (ok, text) => { if (!ok) failures++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + text); };
const pct = v => (100 * v).toFixed(1) + '%';

function world(seed, tweak, opts) {
  const roster = T.Gen.meadowRoster();
  if (tweak) tweak(roster);
  return T.createWorld(Object.assign({ seed, roster, player: null, closed: true, difficulty: B.difficulties.standard }, opts || {}));
}
function play(w, rounds, each) {
  for (let r = 1; r <= rounds; r++) {
    while (!w.roundOver()) w.tick();
    if (each) each(w, r);
    w.updateMeans();
    w.beginRound(r + 1);
  }
}
const npp = w => T.Energy.measure(w).producers.npp;

// ---------- conservation and budgets ----------
console.log('Conservation and budgets · ' + opt.seeds + ' seeds × ' + opt.rounds + ' rounds');
let nErr = 0, eErr = 0;
const budget = { fix: 0, denit: 0, leach: 0, rain: 0, et: 0, runoff: 0, perc: 0, sink: 0, peat: 0, nLim: [] };
for (let s = 1; s <= opt.seeds; s++) {
  const w = world(T.Gen.hashSeed(5000, s));
  play(w, opt.rounds, (w, r) => {
    const sum = w.soilSummary(), cb = w.cbook;
    budget.fix += sum.fixation; budget.denit += cb.denitrified; budget.leach += cb.leachedToWater + cb.leachedToGround;
    budget.rain += cb.rain; budget.et += cb.et + cb.intercepted; budget.runoff += cb.runoff; budget.perc += cb.percolated;
    budget.sink += sum.carbonBalance; budget.peat += cb.peat; budget.nLim.push(sum.nLimitedShare);
  });
  nErr = Math.max(nErr, w.nledger.maxErr);
  eErr = Math.max(eErr, w.ledger.maxErr);
}
check(nErr < 0.001, 'nitrogen conserved: N_air + N_soil + N_bodies + N_dead constant (max error ' + (nErr * 100).toExponential(1) + '%)');
check(eErr < 0.001, 'energy conserved with peat as a pool (max error ' + (eErr * 100).toExponential(1) + '%)');
const rounds = opt.seeds * opt.rounds;
console.log('    per round: fixation ' + Math.round(budget.fix / rounds) + ' N, denitrification ' + Math.round(budget.denit / rounds) +
  ', leaching ' + Math.round(budget.leach / rounds) + ' · rain ' + Math.round(budget.rain / rounds) + ', evapotranspiration ' +
  Math.round(budget.et / rounds) + ', runoff ' + Math.round(budget.runoff / rounds) + ', to groundwater ' + Math.round(budget.perc / rounds) +
  ' · carbon balance ' + Math.round(budget.sink / rounds) + ' (peat ' + Math.round(budget.peat / rounds) + ') · N-limited plant ticks, last round ' +
  pct(budget.nLim[budget.nLim.length - 1]));

// ---------- decomposers are a keystone guild ----------
console.log('\nDecomposers as a keystone guild (Rotmites removed at the start)');
let ctrl = 0, noDec = 0, soilCtrl = 0, soilNo = 0;
const R = 3;
for (let s = 1; s <= opt.seeds; s++) {
  const seed = T.Gen.hashSeed(5100, s);
  const a = world(seed), b = world(seed);
  for (const e of b.ents) if (e.alive && e.sp.level === 'decomposer') b._die(e, 'culled', -1);
  b.ents = b.ents.filter(e => e.alive);
  // Decomposer Populations: clear every tile (their bodies go to detritus).
  for (const sp of b.species) if (sp.grid && sp.level === 'decomposer') { for (let i = 0; i < b.N * b.N; i++) b._popClear(sp, i); b._popTotals(sp); }
  play(a, R); play(b, R);
  // Measure the round after: producer growth and plant-available soil N.
  while (!a.roundOver()) a.tick();
  while (!b.roundOver()) b.tick();
  ctrl += npp(a); noDec += npp(b);
  const sa = a.soilSummary(), sb = b.soilSummary();
  soilCtrl += sa.nh4 + sa.no3; soilNo += sb.nh4 + sb.no3;
}
const drop = 1 - noDec / ctrl, soilDrop = 1 - soilNo / soilCtrl;
console.log('    round ' + (R + 1) + ': NPP ' + pct(noDec / ctrl) + ' of the control, soil ammonium + nitrate ' + pct(soilNo / soilCtrl));
check(drop > 0.05 && soilDrop > 0.1, 'without decomposers, soil nitrogen and producer growth fall within ' + (R + 1) + ' rounds');

// ---------- compaction ----------
console.log('\nCompaction (half the map packed at the start)');
{
  // Summed over 3 seeds: animal behaviour differs between the paired worlds, so one seed is noisy.
  const savedRecover = B.soil.compactRecover;
  B.soil.compactRecover = 0;   // hold it for the test
  let dA = 0, dB = 0, runA = 0, runB = 0, rainA = 0, rainB = 0;
  for (let s = 1; s <= 3; s++) {
    const seed = T.Gen.hashSeed(5200, s);
    const a = world(seed), b = world(seed);
    const n = b.N * b.N;
    for (let i = 0; i < n; i++) if ((i % b.N) < b.N / 2 && b.terrain[i] === 0) b.comp[i] = 0.9;
    for (const w of [a, b]) while (!w.roundOver()) w.tick();
    dA += a.cbook.denitrified; dB += b.cbook.denitrified;
    runA += a.cbook.runoff; rainA += a.cbook.rain; runB += b.cbook.runoff; rainB += b.cbook.rain;
  }
  const rA = runA / Math.max(1, rainA), rB = runB / Math.max(1, rainB);
  B.soil.compactRecover = savedRecover;
  console.log('    denitrification ' + Math.round(dA) + ' → ' + Math.round(dB) + ' N; runoff share of rain ' + pct(rA) + ' → ' + pct(rB));
  check(dB > dA * 1.1 && rB > rA + 0.03, 'compacted soil denitrifies more and sheds more rain as runoff');
}

// ---------- legumes ----------
console.log('\nLegumes (Bloomvine fixes nitrogen)');
{
  const w = world(T.Gen.hashSeed(5300, 1));
  play(w, 2);
  const legume = w.producers.findIndex(P => P && P.fixer);
  let nl = 0, sl = 0, no = 0, so = 0;
  for (let i = 0; i < w.N * w.N; i++) {
    if (w.terrain[i] === 1 || !w.ptype[i]) continue;
    const soil = w.nh4[i] + w.no3[i];
    if (w.ptype[i] === legume) { nl++; sl += soil; } else { no++; so += soil; }
  }
  console.log('    soil ammonium + nitrate: legume tiles ' + (sl / nl).toFixed(2) + ' vs others ' + (so / no).toFixed(2) + ' per tile');
  check(sl / nl > so / no, 'soil under legumes is richer in nitrogen');
}

// ---------- climate trend ----------
console.log('\nClimate trend (CO2 +50 ppm per round, the Warming world pace) vs a steady climate');
{
  // At the Warming world scenario's pace: about a doubling of CO2 over the test (+3 °C).
  const seed = T.Gen.hashSeed(5400, 1), rounds = 8, savedPpm = B.climate.ppmPerRound;
  B.climate.ppmPerRound = 50;
  const a = world(seed), b = world(seed, null, { climateTrend: true });
  play(a, rounds); play(b, rounds);
  B.climate.ppmPerRound = savedPpm;
  const half = w => { let n = 0, s = 0; for (let i = 0; i < w.N * w.N; i++) { if ((i / w.N | 0) < w.N / 2) n += w.pE[i]; else s += w.pE[i]; } return { n, s }; };
  const ha = half(a), hb = half(b);
  const north = hb.n / ha.n, south = hb.s / ha.s;
  console.log('    after ' + rounds + ' rounds: CO2 ' + Math.round(b.co2) + ' ppm, +' + b.tOffset.toFixed(1) + ' °C; standing crop vs steady climate: north half ' +
    pct(north) + ', south half ' + pct(south));
  check(south < north, 'warming pushes producers out of their envelopes in the warm south first');
}

if (failures) { console.log('\n' + failures + ' cycle check(s) failed'); process.exit(1); }
console.log('\nall cycle checks passed');
