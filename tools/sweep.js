// Seed sweep for balance: plays many seeds hands-off and reports how long each trophic level survives.
//   node tools/sweep.js [--seeds 20] [--rounds 30] [--mode meadow|generated] [--player grazer|hunter|none]
//                       [--set key=value ...] [--csv out.csv]
// Prints a summary against the Phase 2 target bands; --csv writes one row per seed per round.
const T = require('./load.js');
const B = T.BALANCE;
const fs = require('fs');

const args = process.argv.slice(2);
const opt = { seeds: 20, rounds: 30, mode: 'meadow', player: 'grazer', csv: null, set: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--set') opt.set.push(args[++i]);
  else if (a.startsWith('--')) opt[a.slice(2)] = args[++i];
}
for (const kv of opt.set) {
  // Dotted keys reach nested settings, e.g. levelMetab.carnivore1=1.1 or modes.game.thermoScale=0.8
  const [k, v] = kv.split('=');
  const path = k.split('.'), last = path.pop();
  const obj = path.reduce((o, p) => o[p], B);
  obj[last] = v.includes(',') ? v.split(',').map(Number) : Number(v);
}
opt.seeds = +opt.seeds; opt.rounds = +opt.rounds;

const LEVELS = ['herbivore', 'omnivore', 'carnivore1', 'carnivore2', 'decomposer'];
const rows = [];
const results = [];
const t0 = Date.now();
for (let s = 1; s <= opt.seeds; s++) {
  const seed = T.Gen.hashSeed(1000, s);
  let roster, genAttempt = 0, genPass = true;
  if (opt.mode === 'generated') { const r = T.Gen.generateStable(seed, 'meadow', 5); roster = r.roster; genAttempt = r.attempt; genPass = r.pass; }
  else roster = T.Gen.meadowRoster();
  let player = null;
  if (opt.player !== 'none') { player = T.Gen.templateFounder(T.TEMPLATES.find(t => t.id === opt.player)); }
  const w = T.createWorld({ seed, roster, player, difficulty: B.difficulties.standard });
  const present = new Set(w.species.map(sp => sp.level));
  const lastAlive = {};
  let playerRounds = 0, splits = 0, maxShare = 0, tickMs = 0;
  const startProd = w.producerBiomass();
  for (let r = 1; r <= opt.rounds; r++) {
    const a = Date.now();
    while (!w.roundOver()) w.tick();
    tickMs = Math.max(tickMs, (Date.now() - a) / B.roundTicks);
    w.updateMeans();
    const pops = w.countPops();
    const alive = {};
    let cons = 0, top = 0;
    w.species.forEach((sp, i) => {
      if (pops.count[i] > 0) alive[sp.level] = true;
      if (sp.level !== 'decomposer' && sp.level !== 'producer') { cons += pops.count[i]; top = Math.max(top, pops.count[i]); }
    });
    for (const lv of LEVELS) if (alive[lv]) lastAlive[lv] = r;
    if (w.player && pops.count[w.player.idx] > 0) playerRounds = r;
    if (cons) maxShare = Math.max(maxShare, top / cons);
    splits += T.Evo.checkSpeciation(w, r).length;
    rows.push([seed, r, ...LEVELS.map(lv => (alive[lv] ? 1 : 0)), Math.round(w.producerBiomass()), w.player ? pops.count[w.player.idx] : '', splits].join(','));
    w.beginRound(r + 1);
  }
  const res = { seed, present, lastAlive, playerRounds, splits, maxShare, tickMs, genAttempt, genPass, prodFrac: w.producerBiomass() / startProd };
  results.push(res);
  process.stderr.write('.');
}
process.stderr.write('\n');

const pct = f => Math.round(100 * f) + '%';
const allAliveAt = R => results.filter(r => [...r.present].every(lv => lv === 'producer' || (r.lastAlive[lv] || 0) >= R)).length / results.length;
const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log('config:', opt.mode, 'player', opt.player, opt.set.join(' ') || '(defaults)', '|', opt.seeds, 'seeds ×', opt.rounds, 'rounds', '|', ((Date.now() - t0) / 1000).toFixed(0) + 's');
for (const lv of LEVELS) {
  const have = results.filter(r => r.present.has(lv));
  if (!have.length) continue;
  const surv = have.map(r => r.lastAlive[lv] || 0);
  console.log('  ' + lv.padEnd(11), 'median last round alive', String(median(surv)).padStart(3), '  alive at end', pct(surv.filter(x => x >= opt.rounds).length / have.length));
}
console.log('  every level alive at round 5:', pct(allAliveAt(5)), ' round 15:', pct(allAliveAt(15)), '(target ≥ 70%)');
if (opt.player !== 'none') console.log('  player median survival:', median(results.map(r => r.playerRounds)), 'rounds');
console.log('  speciation events per run: median', median(results.map(r => r.splits)), ' | runs where one species > 50% of consumers:', pct(results.filter(r => r.maxShare > 0.5).length / results.length), '(target ≤ 15%)');
console.log('  worst tick cost:', Math.max(...results.map(r => r.tickMs)).toFixed(2), 'ms');
if (opt.mode === 'generated') console.log('  rosters passing within 5 attempts:', pct(results.filter(r => r.genPass).length / results.length), '(target ≥ 95%)');
if (opt.csv) {
  fs.writeFileSync(opt.csv, ['seed,round,' + LEVELS.join(',') + ',producerEU,playerPop,splits'].concat(rows).join('\n'));
  console.log('  wrote', opt.csv);
}
