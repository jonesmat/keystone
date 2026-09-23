// Pyramid checks (Phase 3, P3-M2).
//   node tools/check-pyramids.js [--seeds 3] [--rounds 8] [--set key=value ...]
// Plays hands-off Temperate Meadow and Open Channel worlds. Every round, in both, the energy pyramid must narrow
// at each level (a hard failure otherwise). Numbers and biomass may invert; they're checked against the design's
// validation table at the producer → herbivore step: Meadow upright in both, Open Channel biomass inverted.
const T = require('./load.js');
const B = T.BALANCE;

const args = process.argv.slice(2);
const opt = { seeds: 3, rounds: 8, set: [] };
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

// Expected shape at producers → herbivores, and the share of rounds that must show it.
const WORLDS = [
  { name: 'Temperate Meadow', roster: () => T.Gen.meadowRoster(), biome: B.biomes.meadow, numbers: 'upright', biomass: 'upright' },
  { name: 'Open Channel', roster: () => T.Gen.channelRoster(), biome: B.biomes.channel, numbers: 'upright', biomass: 'inverted' },
];
const NEED = 0.7;
const fmt = v => (v >= 1000 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(0) : v.toFixed(2));
let failures = 0;

for (const W of WORLDS) {
  let rounds = 0, violations = 0;
  const invCount = { numbers: 0, biomass: 0 };
  let sample = null;
  for (let s = 1; s <= opt.seeds; s++) {
    const w = T.createWorld({ seed: T.Gen.hashSeed(3000, s), roster: W.roster(), player: null, biome: W.biome, difficulty: B.difficulties.standard });
    for (let r = 1; r <= opt.rounds; r++) {
      while (!w.roundOver()) w.tick();
      const p = T.Energy.pyramids(w);
      if (r >= 2) {   // round 1 is warm-up
        rounds++;
        if (p.violations.length) violations++;
        for (const kind of ['numbers', 'biomass']) if (p[kind][1] > p[kind][0]) invCount[kind]++;
        if (!sample && r === 4) sample = p;
      }
      w.updateMeans();
      w.beginRound(r + 1);
    }
  }
  console.log(W.name + ' · ' + opt.seeds + ' seeds × ' + opt.rounds + ' rounds (rounds 2+)');
  const ok = violations === 0;
  if (!ok) failures++;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  energy narrows at every level in every round' + (ok ? '' : ' (' + violations + ' of ' + rounds + ' rounds failed)'));
  for (const kind of ['numbers', 'biomass']) {
    const share = rounds ? invCount[kind] / rounds : 0;
    const want = W[kind];
    const got = want === 'inverted' ? share : 1 - share;
    const pass = got >= NEED;
    if (!pass) failures++;
    console.log('  ' + (pass ? 'PASS' : 'FAIL') + '  ' + kind.padEnd(8) + ' ' + want + ' at producers → herbivores in ' + Math.round(100 * got) + '% of rounds (need ' + Math.round(100 * NEED) + '%)');
  }
  if (sample) {
    const row = (label, a, unit) => console.log('    ' + label.padEnd(8) + a.map(fmt).join(' → ') + unit);
    console.log('  round 4, seed 1 (producers → herbivores → primary → secondary carnivores):');
    row('numbers', sample.numbers, '');
    row('biomass', sample.biomass, ' g/m²');
    row('energy', sample.energy, ' EU fixed');
  }
  console.log('');
}
if (failures) { console.log(failures + ' pyramid check(s) failed'); process.exit(1); }
console.log('all pyramid checks passed');
