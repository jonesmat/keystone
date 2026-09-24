// Headless sim runner for tuning.
//   node tools/headless.js [rounds] [seed] [meadow|generated]
// Env: DEATHS=1 prints deaths per species.
const T = require('./load.js');
const B = T.BALANCE;

const rounds = +(process.argv[2] || 5);
const seed = +(process.argv[3] || 12345);
const mode = process.argv[4] || 'meadow';

let roster;
if (mode === 'generated') {
  const t0 = Date.now();
  const r = T.Gen.generateStable(seed, 'meadow', 20);
  roster = r.roster;
  console.log('generated roster in', ((Date.now() - t0) / 1000).toFixed(1) + 's, attempt', r.attempt, r.pass ? 'PASS' : 'FALLBACK', '-', r.reason);
  console.log('  producers:', roster.producers.map(p => p.name + '(' + p.kind + ')').join(', '));
  console.log('  consumers:', roster.species.map(s => s.name + '[' + s.level + ', m' + s.genome[T.G.size].toFixed(1) + ', eats ' + s.eats.join('/') + ']').join('\n             '));
} else roster = T.Gen.meadowRoster();

const w = T.createWorld({ seed, roster });
const short = s => s.name.slice(0, 8).padStart(8);
const header = () => console.log('round ' + w.species.map(short).join(' ') + '   prodEU  ledgerErr  ms/tick');
header();
let nSpecies = w.species.length;
const pr = (r, ms) => {
  const p = w.countPops().count;
  console.log(String(r).padStart(5) + ' ' + p.map(n => String(n).padStart(8)).join(' ') +
    ' ' + Math.round(w.producerBiomass()).toString().padStart(8) +
    ' ' + (w.ledger.maxErr * 100).toFixed(5) + '%' + (ms ? ' ' + ms.toFixed(2) : ''));
};
pr(0);
for (let r = 1; r <= rounds; r++) {
  const t0 = Date.now();
  while (!w.roundOver()) w.tick();
  const ms = (Date.now() - t0) / B.roundTicks;
  w.updateMeans();
  pr(r, ms);
  if (process.env.DEATHS) for (const sp of w.species) {
    const rs = w.rstats[sp.idx];
    console.log('   ', sp.name.padEnd(14), 'births', rs.births, 'deaths', JSON.stringify(rs.deaths));
  }
  for (const n of w.notes.splice(0)) console.log('    note:', n);
  w.beginRound(r + 1);
  if (w.species.length !== nSpecies) { nSpecies = w.species.length; header(); }
}
const pyr = w.pyramid();
console.log('pyramid EU:', Object.fromEntries(Object.entries(pyr.levels).map(([k, v]) => [k, Math.round(v)])));
