// Energy-chain checks (Phase 3).
//   node tools/check-energy.js [--rounds 8] [--seeds 3] [--mode game|realism|both] [--legacy] [--set key=value ...] [--skip-live]
// Part 1 books the textbook's worked example (pp. 192–193) through the real sim's photosynthesis, digestion and
// ledger, then reads it back through T.Energy.measure. Every row must land within ±10% of the textbook.
// Part 2 plays hands-off Meadow worlds and reports each measured efficiency against the mode's target band.
const T = require('./load.js');
const B = T.BALANCE;

const args = process.argv.slice(2);
const opt = { rounds: 8, seeds: 3, mode: 'both', legacy: false, skipLive: false, set: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--legacy') opt.legacy = true;
  else if (a === '--skip-live') opt.skipLive = true;
  else if (a === '--set') opt.set.push(args[++i]);
  else if (a.startsWith('--')) opt[a.slice(2)] = args[++i];
}
for (const kv of opt.set) {
  // Dotted keys reach nested settings, e.g. levelMetab.carnivore1=1.1 or modes.game.thermoScale=0.8
  const [k, v] = kv.split('=');
  const path = k.split('.'), last = path.pop();
  const obj = path.reduce((o, p) => o[p], B);
  obj[last] = v.includes(',') ? v.split(',').map(Number) : Number(v);
}
opt.rounds = +opt.rounds; opt.seeds = +opt.seeds;
const pct = v => (v == null ? '   —  ' : (100 * v).toFixed(v < 0.01 ? 2 : 1).padStart(5) + '%');
let failures = 0;

// ---------- Part 1: the textbook example ----------

// One closed world: a single producer (NPP efficiency 50%), one herbivore and one primary carnivore,
// with harvesting, assimilation and tissue growth fixed at the textbook's values.
function bookExample(tissue) {
  const saved = { litterRate: B.litterRate, legacyMealP: B.legacyMealP };
  B.litterRate = 0; B.legacyMealP = 0;
  const biome = Object.assign({}, B.biomes.meadow, { water: 0 });
  const w = new T.World({ seed: 7, biome, mode: 'game' });
  w.setProducers([{ id: 'test', name: 'Testgrass', kind: 'ground', max: 1e12, resp: 0.5, height: 0, leaf: 1, regrowDelay: 0,
    fruit: false, tough: 0, moist: 0.5, color: [0, 0, 0] }]);
  w._generateTerrain();
  w._initCycles(true);
  const roster = T.Gen.meadowRoster().species;
  const hDef = roster.find(s => s.level === 'herbivore'), cDef = roster.find(s => s.level === 'carnivore1');
  const H = w.addSpecies(hDef, false), C = w.addSpecies(cDef, false);
  const ent = sp => { const e = { sp, g: sp.genome, E: 0, tissue: 0, nT: 0, nS: 0, alive: true, x: 1, y: 1 }; w.ents.push(e); return e; };
  const eH = ent(H), eC = ent(C);
  w.ledger.initial = w.totalPools();
  w.beginRound(1);
  for (let k = 0; k < 40; k++) w._photosynthesis();
  const gpp = w.pbook.gpp[1], npp = w.pbook.npp[1];
  const s = gpp / 100000;   // express every flow per 100,000 units of GPP, as the text does
  // Metabolism: charge the share of GSP that tissue growth doesn't keep, as upkeep heat.
  const respire = (e, amt) => { e.E -= amt; w.ledger.heat += amt; w.rstats[e.sp.idx].upkeepHeat += amt; };
  // Herbivores harvest 20% of NPP and assimilate 45% (textbook 30–60%).
  const hIn = 0.20 * npp;
  w.pE[0] -= hIn; w.pbook.eaten[1] += hIn;
  w._digest(eH, hIn, 0.45, 1, 'Testgrass', 0, 'producer');
  const hGSP = w.rstats[H.idx].assimilated;
  respire(eH, hGSP * (1 - tissue.herb));
  // Primary carnivores eat 2,000 units of herbivore tissue ("most herbivores eaten") and assimilate 90%.
  // The herd's standing stock covers it even when endotherm herbivores add little new tissue.
  const stock = 2500 * s;
  eH.E += stock; w.ledger.imported += stock;
  const cIn = 2000 * s;
  eH.E -= cIn;
  w._digest(eC, cIn, 0.90, 1, H.name, 0, 'herbivore');
  respire(eC, w.rstats[C.idx].assimilated * (1 - tissue.carn));
  const m = T.Energy.measure(w);
  const led = w.checkLedger();
  Object.assign(B, saved);
  return { s, m, ledgerErr: led.err, H, C };
}

function textbookCheck() {
  console.log('Part 1 · textbook worked example (per 100,000 units of GPP), tolerance ±10%');
  const ecto = bookExample({ herb: 0.45, carn: 0.35 });   // ectotherm tissue growth 20–50%
  const endo = bookExample({ herb: 0.02, carn: 0.02 });   // endotherm tissue growth 1–3%
  const per = (r, v) => v / r.s;
  const L = r => r.m.levels;
  const got = {
    gpp: per(ecto, ecto.m.producers.gpp),
    npp: per(ecto, ecto.m.producers.npp),
    hIngested: per(ecto, L(ecto).herbivore.ingested),
    hGSP: per(ecto, L(ecto).herbivore.assimilated),
    hNSPecto: per(ecto, L(ecto).herbivore.nsp),
    hNSPendo: per(endo, L(endo).herbivore.nsp),
    cIngested: per(ecto, L(ecto).carnivore1.ingested),
    cGSP: per(ecto, L(ecto).carnivore1.assimilated),
    cNSPecto: per(ecto, L(ecto).carnivore1.nsp),
    cNSPendo: per(endo, L(endo).carnivore1.nsp),
  };
  for (const row of T.Energy.TEXTBOOK) {
    const v = got[row.key];
    const ok = v >= row.lo * 0.9 && v <= row.hi * 1.1;
    if (!ok) failures++;
    const want = row.lo === row.hi ? String(row.lo) : row.lo + '–' + row.hi;
    console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + row.name.padEnd(32) + Math.round(v).toString().padStart(8) + '   text ' + want);
  }
  const eff = ecto.m.eff;
  console.log('  efficiencies: NPP ' + pct(eff.nppEff) + ' · harvesting ' + pct(eff.harvest) + ' · assimilation ' + pct(eff.assimPlant) +
    ' · herbivore tissue ' + pct(L(ecto).herbivore.tissue) + ' (ecto) / ' + pct(L(endo).herbivore.tissue) + ' (endo)');
  for (const r of [ecto, endo]) {
    if (r.ledgerErr > 1e-6) { failures++; console.log('  FAIL  energy ledger error ' + (r.ledgerErr * 100).toFixed(5) + '%'); }
  }
  if (Math.max(ecto.ledgerErr, endo.ledgerErr) <= 1e-6) console.log('  PASS  energy ledger balances');
}

// ---------- Part 2: live worlds ----------

const KEYS = ['nppEff', 'harvest', 'assimPlant', 'assimMeat', 'tissueEcto', 'tissueEndo', 'transfer', 'transferC1', 'twoLevel'];
const median = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

function liveRun(modeId) {
  const vals = {};
  KEYS.forEach(k => (vals[k] = []));
  const levelsAlive = [], ends = [];
  let err = 0, ms = 0;
  for (let s = 1; s <= opt.seeds; s++) {
    const seed = T.Gen.hashSeed(2000, s);
    const w = T.createWorld({ seed, roster: T.Gen.meadowRoster(), player: null, mode: modeId, difficulty: B.difficulties.standard });
    const prod0 = w.producerBiomass();
    for (let r = 1; r <= opt.rounds; r++) {
      const t0 = Date.now();
      while (!w.roundOver()) w.tick();
      ms = Math.max(ms, (Date.now() - t0) / B.roundTicks);
      const m = T.Energy.measure(w);
      if (r >= 2) for (const k of KEYS) vals[k].push(m.eff[k]);   // round 1 is warm-up
      err = Math.max(err, w.ledger.maxErr);
      w.updateMeans();
      w.beginRound(r + 1);
    }
    const pops = w.countPops().count;
    levelsAlive.push(new Set(w.species.filter((sp, i) => pops[i] > 0).map(sp => sp.level)).size);
    const byLv = {};
    w.species.forEach((sp, i) => (byLv[sp.level] = (byLv[sp.level] || 0) + pops[i]));
    let nut = 0;
    for (let i = 0; i < w.nutr.length; i++) nut += w.nutr[i];
    ends.push('    seed ' + s + ': ' + ['herbivore', 'omnivore', 'carnivore1', 'carnivore2', 'decomposer'].map(L => L.slice(0, 5) + ' ' + (byLv[L] || 0)).join(' · ') +
      ' · producers ' + Math.round((100 * w.producerBiomass()) / prod0) + '% of start · soil nutrients ' + (nut / w.nutr.length).toFixed(2));
  }
  console.log('Part 2 · ' + B.modes[modeId].name + ' mode' + (B.legacyMealP ? ' (legacy Phase 2 per-meal P)' : '') +
    ' · Meadow, hands-off, ' + opt.seeds + ' seeds × ' + opt.rounds + ' rounds (median of rounds 2+)');
  for (const k of KEYS) {
    const v = median(vals[k]);
    const bk = k === 'transferC1' ? 'transfer' : k;
    const band = T.Energy.BANDS[bk][modeId];
    const ok = T.Energy.inBand(bk, v, modeId);
    const name = k === 'transferC1' ? 'Passed up, herbivores → carnivores' : k === 'transfer' ? 'Passed up, NPP → herbivores' : T.Energy.BANDS[k].name;
    console.log('  ' + (ok == null ? '  — ' : ok ? ' in ' : 'OUT ') + ' ' + name.padEnd(34) + pct(v) + '   band ' + pct(band[0]).trim() + '–' + pct(band[1]).trim());
  }
  console.log('  consumer levels alive at the end: ' + levelsAlive.join(', ') + ' · ledger error ' + (err * 100).toFixed(5) + '% · worst tick ' + ms.toFixed(2) + ' ms');
  for (const line of ends) console.log(line);
}

textbookCheck();
if (!opt.skipLive) {
  if (opt.legacy) B.legacyMealP = 1;
  const modes = opt.mode === 'both' ? ['game', 'realism'] : [opt.mode];
  for (const m of modes) { console.log(''); liveRun(m); }
}
if (failures) { console.log('\n' + failures + ' textbook check(s) failed'); process.exit(1); }
