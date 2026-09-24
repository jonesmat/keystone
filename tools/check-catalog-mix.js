// Catalog species-mix audit: can every built catalog fill the slots its scenarios (and Sandbox) need?
//   node tools/check-catalog-mix.js [code …]
// For each catalog: Sandbox's slots, plus the slots of every scenario set in that ecoregion. A slot fails if a draw can
// leave it below its minimum count (candidates are shared between slots with the same role, so this draws 20 casts),
// or if a slot that needs a nitrogen-fixer can't get one. Slots whose candidates fall short of their maximum are
// listed as thin. Exits 1 on any failure, printing what's missing, so the builder can be re-run with a larger quota.
const T = require('./load.js');
const fs = require('fs'), path = require('path');
const Cat = T.Catalog;

require('../js/catalogs/index.js');
const codes = process.argv.slice(2).length ? process.argv.slice(2) : T.CATALOG_INDEX.map(c => c.code);
let failures = 0;
const THREAT = new Set(['NT', 'VU', 'EN', 'CR']);

function candidates(cat, slot) {
  const all = slot.domestic ? [T.DOMESTIC[slot.domestic]] : cat.species;
  return all.filter(s => {
    if (slot.role === 'any animal') { if (s.level === 'producer' || s.level === 'decomposer') return false; }
    else if (!s.roles.includes(slot.role)) return false;
    if (slot.native === true && !s.native) return false;
    if (slot.native === false && s.native) return false;
    if (slot.status === 'threatened' && !THREAT.has(s.iucn)) return false;
    if (slot.status === 'endangered' && !['VU', 'EN', 'CR'].includes(s.iucn)) return false;
    if (slot.strata && !slot.strata.includes(s.strata)) return false;
    return true;
  });
}
const label = sl => (sl.id ? sl.id + ' (' : '') + sl.role + (sl.native === true ? ', native' : sl.native === false ? ', non-native' : '') + (sl.status ? ', ' + sl.status : '') + (sl.strata ? ', ' + sl.strata.join('/') : '') + (sl.id ? ')' : '');

for (const code of codes) {
  const file = path.join(__dirname, '..', 'js', 'catalogs', code.replace(/\./g, '_') + '.js');
  if (!fs.existsSync(file)) { console.log(code + ': NOT BUILT'); failures++; continue; }
  let cat = null;
  Cat.load(code, c => { cat = c; });
  const sets = [['Sandbox', T.SANDBOX_SLOTS]].concat(T.SCENARIOS.filter(s => s.ecoregion === code).map(s => [s.name, s.slots]));
  const problems = [], thin = [];
  for (const [name, slots] of sets) {
    const short = new Map();
    for (let seed = 1; seed <= 20; seed++) {
      const fills = Cat.draw(cat, slots, new T.RNG(seed * 7919));
      fills.forEach((f, k) => {
        const sl = slots[k];
        const bad = f.species.length < sl.count[0] || (sl.need && sl.need.fixer && sl.count[0] > 0 && !f.species.some(s => s.fixer));
        if (bad) short.set(k, Math.min(short.has(k) ? short.get(k) : 99, f.species.length));
      });
    }
    slots.forEach((sl, k) => {
      const n = candidates(cat, sl).length;
      if (short.has(k)) problems.push(name + ': ' + label(sl) + ' needs ' + sl.count[0] + (sl.need && sl.need.fixer ? ' incl. a fixer' : '') + ', got ' + short.get(k) + ' (' + n + ' candidates)');
      else if (n < sl.count[1]) thin.push(name + ': ' + label(sl) + ' ' + n + ' of up to ' + sl.count[1]);
    });
  }
  console.log(code + ' · ' + cat.name + ' · ' + cat.species.length + ' species' + (problems.length ? '' : ' · ok'));
  for (const p of problems) console.log('    MISSING  ' + p);
  for (const t of thin) console.log('    thin     ' + t);
  if (problems.length) failures++;
}
if (failures) { console.log('\n' + failures + ' catalog(s) can’t fill their slots'); process.exit(1); }
console.log('\nevery catalog fills its slots');
