// Smoke tests: fixed trait sheets, world events, save/load round-trip, refusing old saves, and ledger conservation.
//   node tools/check-events.js
const T = require('./load.js');
const B = T.BALANCE;
let fails = 0;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); fails++; } else console.log('ok  ', m); };

const w = T.createWorld({ seed: 42, roster: T.Gen.meadowRoster() });
for (let i = 0; i < 300; i++) w.tick();

// Fixed trait sheets: every individual of a species, newborns included, shares the species' traits.
const shared = w.species.every(sp => w.ents.filter(e => e.alive && e.sp === sp).every(e => e.g === sp.genome));
assert(shared, 'every individual carries the fixed trait sheet of its species (no inheritance or mutation)');

// events
const before = w.countPops().count.reduce((x, y) => x + y, 0);
const pl = w.plague();
assert(pl && pl.killed > 0, 'plague kills ' + (pl && pl.killed) + ' ' + (pl && pl.species.name));
assert(w.countPops().count.reduce((x, y) => x + y, 0) === before - pl.killed, 'plague removes exactly that many');
const m = w.importSpecies(T.EVENT_SPECIES.marauder, 8, [4, 4]);
assert(w.countPops().count[m.idx] === 8, 'invasive Mirefangs arrive (8)');
const wb = w.importSpecies(T.EVENT_SPECIES.wanderbuck, 24, [2, 30], { energy: 0.7 });
for (let i = 0; i < 600; i++) w.tick();
assert(w.countPops().count[wb.idx] < 24, 'migrating Wanderbucks leave the map (' + w.countPops().count[wb.idx] + ' left)');
assert(w.checkLedger().err < 1e-6, 'ledger conserved through events (err ' + w.checkLedger().err.toExponential(2) + ')');

// save / load
const s = JSON.parse(JSON.stringify(w.serialize()));
const w2 = T.loadWorld(s, {});
assert(w2.ents.length === w.ents.filter(e => e.alive).length, 'save/load keeps all ' + w2.ents.length + ' organisms');
assert(w2.species.length === w.species.length, 'save/load keeps every species');
assert(w2.ents.every(e => e.g === e.sp.genome), 'loaded individuals share the traits of their species');
for (let i = 0; i < 300; i++) w2.tick();
assert(w2.checkLedger().err < 1e-6, 'ledger conserved after load');
console.log('     save size', Math.round(JSON.stringify(s).length / 1024), 'KB');

// Saves from an older version are refused, not migrated.
let refused = false;
try { T.loadWorld(Object.assign({}, s, { v: 2 }), {}); } catch (e) { refused = /older version/.test(e.message); }
assert(refused, 'a save from an older version is refused with a message');

// generator
const r = T.Gen.generateRoster(777, 'meadow');
assert(r.species.length >= 10 && r.species.length <= 16, 'generated roster has ' + r.species.length + ' consumers (10–16)');
const herbs = r.species.filter(x => x.level === 'herbivore');
assert(herbs.every(h => r.species.some(x => x.eats.includes(h.id))), 'every generated herbivore has a predator');
assert(r.species.filter(x => x.level === 'carnivore1' || x.level === 'carnivore2').every(x => x.eats.filter(id => r.species.some(y => y.id === id)).length >= 2), 'every generated carnivore has at least two prey species');
const n1 = T.Gen.generateRoster(777, 'meadow').species.map(x => x.name).join();
assert(n1 === r.species.map(x => x.name).join(), 'same seed, same roster');

if (fails) { console.error(fails + ' check(s) failed'); process.exit(1); }
