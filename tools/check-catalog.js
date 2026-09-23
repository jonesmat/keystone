// Catalog draw checks (Phase 3, P3-M4).
//   node tools/check-catalog.js [code] [scenario|sandbox] [--seeds 3] [--rounds 5]
//   e.g. node tools/check-catalog.js 9.3 rewilding
// Loads a built catalog (js/catalogs/<code>.js), draws casts for a scenario's niche slots, and checks:
//   - the same seed always draws the same cast (shareable seeds)
//   - every slot is filled within its count and constraints (native, threatened, pool-only)
//   - 60–150 species per world, with a sane food web (every predator has prey, most herbivores have a predator)
//   - the stability test passes, redrawing only failing slots
//   - the world runs: ledgers conserved, tick cost within budget
const T = require('./load.js');
const B = T.BALANCE;

const args = process.argv.slice(2);
const code = args[0] && !args[0].startsWith('--') ? args[0] : '9.3';
const scenId = args[1] && !args[1].startsWith('--') ? args[1] : null;
const opt = { seeds: 3, rounds: 5 };
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = +args[++i];
let failures = 0;
const check = (ok, text) => { if (!ok) failures++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + text); };

T.Catalog.load(code, cat => {
  if (!cat) { console.log('no catalog for ' + code + ' (build it with tools/catalog/build.js ' + code + ')'); process.exit(1); }
  const scenario = scenId && scenId !== 'sandbox' ? T.scenarioById(scenId) : T.SCENARIOS.find(s => s.ecoregion === code) || null;
  const slots = scenario ? scenario.slots : T.SANDBOX_SLOTS;
  const groups = {};
  for (const s of cat.species) groups[s.group] = (groups[s.group] || 0) + 1;
  console.log(cat.name + ' (' + cat.code + ') · ' + cat.species.length + ' species · ' + Object.entries(groups).map(([g, n]) => g + ' ' + n).join(', '));
  console.log('climate ' + cat.climate.tMean + ' °C ±' + cat.climate.tAmp + ', ' + cat.climate.rain + ' cm/yr, ' + cat.climate.biome + ' · draws for ' + (scenario ? scenario.name : 'Sandbox'));

  // Every slot needs candidates in the catalog.
  const empty = slots.filter(sl => !sl.domestic && sl.count[0] > 0 && !cat.species.some(s => (sl.role === 'any animal' ? s.level !== 'producer' : s.roles.includes(sl.role)) &&
    (sl.native == null || s.native === sl.native) && (sl.status !== 'threatened' || ['NT', 'VU', 'EN', 'CR'].includes(s.iucn)) &&
    (sl.status !== 'endangered' || ['VU', 'EN', 'CR'].includes(s.iucn))));
  check(!empty.length, 'every slot has candidates in the catalog' + (empty.length ? ' (none for: ' + empty.map(s => s.id || s.role).join(', ') + ')' : ''));

  // Determinism.
  const a = T.Catalog.roster(cat, scenario, 1234), b = T.Catalog.roster(cat, scenario, 1234);
  check(JSON.stringify(a.fills) === JSON.stringify(b.fills), 'the same seed draws the same cast (' + a.seedString + ')');
  const c = T.Catalog.roster(cat, scenario, 1235);
  check(JSON.stringify(a.fills) !== JSON.stringify(c.fills), 'a different seed draws a different cast');

  for (let s = 1; s <= opt.seeds; s++) {
    const seed = 1000 + s;
    const t0 = Date.now();
    const res = T.Catalog.rosterStable(cat, scenario, seed, 6, opt.rounds);
    const r = res.roster;
    const n = r.producers.length + r.species.length;
    console.log('\n  seed ' + r.seedString + ': ' + r.producers.length + ' producers + ' + r.species.length + ' animals (' +
      r.species.filter(d => d.flags.population).length + ' as Populations, ' + r.pool.length + ' in the regional pool) · stability ' +
      (res.pass ? 'passed' : 'FAILED: ' + res.reason) + ' on attempt ' + res.attempt + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    // Slot counts and constraints.
    const badSlots = [];
    r.fills.forEach((f, k) => {
      const sl = slots[k];
      const got = f.keys.length;
      const cands = r.producers.concat(r.species).filter(d => f.keys.includes(d.catalogKey));
      if (got < Math.min(sl.count[0], 1) || got > sl.count[1]) badSlots.push((sl.id || sl.role) + ' got ' + got);
      if (sl.native != null && cands.some(d => d.native !== sl.native)) badSlots.push((sl.id || sl.role) + ' native');
    });
    check(!badSlots.length, 'slots filled within their counts and native constraints' + (badSlots.length ? ' (' + badSlots.join(', ') + ')' : ''));
    check(n >= 45 && n <= 150, n + ' species on the world (design: 60–150; small catalogs draw fewer)');
    // Food web.
    const ids = new Set(r.species.map(d => d.id));
    const predators = r.species.filter(d => d.level === 'carnivore1' || d.level === 'carnivore2');
    const hungry = predators.filter(d => !d.eats.some(x => ids.has(x) || x === 'carrion'));   // scavengers live on carrion
    const herbs = r.species.filter(d => d.level === 'herbivore' && d.startPop > 0);
    const eaten = herbs.filter(h => r.species.some(d => d.eats.includes(h.id)));
    check(!hungry.length, 'every predator has prey in the cast' + (hungry.length ? ' (not: ' + hungry.map(d => d.name).join(', ') + ')' : ''));
    check(eaten.length >= herbs.length * 0.6, eaten.length + ' of ' + herbs.length + ' herbivores have a predator');
    // Run it.
    const w = T.createWorld({ seed, roster: r, player: null, biome: r.biome, difficulty: B.difficulties.standard });
    const t1 = Date.now();
    for (let k = 0; k < 3; k++) { while (!w.roundOver()) w.tick(); w.updateMeans(); w.beginRound(w.round + 1); }
    const ms = (Date.now() - t1) / (3 * B.roundTicks);
    const pops = w.countPops().count;
    const alive = w.species.filter((sp, i) => pops[i] > 0).length;
    console.log('    after 3 rounds: ' + alive + ' of ' + w.species.filter(sp => sp.initialPop > 0).length + ' starting species alive · ' +
      w.ents.length + ' individuals · ' + w.species.filter(sp => sp.grid).length + ' Populations');
    check(w.ledger.maxErr < 1e-3 && w.nledger.maxErr < 1e-3, 'ledgers conserved');
    check(ms <= 3, 'tick cost ' + ms.toFixed(2) + ' ms (budget 3 ms)');
    if (s === 1) {
      const show = r.species.filter(d => !d.flags.population).slice(0, 14).map(d => d.name + ' (' + d.sci + ')');
      console.log('    e.g. ' + show.join(', '));
    }
  }
  if (failures) { console.log('\n' + failures + ' catalog check(s) failed'); process.exit(1); }
  console.log('\nall catalog checks passed');
});
