// Smoke tests: world events, inheritance, speciation, save/load round-trip, refusing old saves, and ledger conservation.
//   node tools/check-events.js
const T = require('./load.js');
const B = T.BALANCE;
let fails = 0;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); fails++; } else console.log('ok  ', m); };

const w = T.createWorld({ seed: 42, roster: T.Gen.meadowRoster(), player: T.Gen.templateFounder(T.TEMPLATES[1]) });
for (let i = 0; i < 300; i++) w.tick();

// individual variation and inheritance
const p = w.player;
w.updateMeans();
assert(p.sd[T.G.speed] > 0 || p.sd[T.G.bite] > 0, 'founders vary (sd speed ' + p.sd[T.G.speed].toFixed(3) + ', bite ' + p.sd[T.G.bite].toFixed(3) + ')');
const a = T.newGenome(), b = T.newGenome();
a[T.G.bite] = 2; b[T.G.bite] = 4;
const kids = Array.from({ length: 200 }, () => T.Evo.inherit(w, a, b, p, 1));
const meanBite = kids.reduce((s, g) => s + g[T.G.bite], 0) / kids.length;
assert(Math.abs(meanBite - 3) < 0.1, 'child genes average the parents (bite ' + meanBite.toFixed(2) + ' ≈ 3)');
assert(kids.some(g => Math.abs(g[T.G.bite] - 3) > 0.01), 'some children carry mutations');

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

// guided mutation and speciation mechanics
const s0 = p.mean[T.G.speed];
T.Evo.applyGuided(w, p, 'speed', 1);
w.updateMeans(p);
assert(Math.abs(p.mean[T.G.speed] - s0 - 1) < 0.3, 'guided mutation shifts the mean by about one level (' + s0.toFixed(2) + ' → ' + p.mean[T.G.speed].toFixed(2) + ')');
const members = w.ents.filter(e => e.alive && e.sp === p);
const half = members.slice(0, Math.floor(members.length / 2));
for (const e of half) for (let k = 0; k < 8; k++) e.g[T.G.m0 + k] = 0.98;
for (const e of members.slice(half.length)) for (let k = 0; k < 8; k++) e.g[T.G.m0 + k] = 0.02;
const c = T.Evo.cluster(w, members);
assert(c.dist > B.speciationDistance, 'two marker clusters are far apart (distance ' + c.dist.toFixed(2) + ')');
const nsp = w.species.length;
const ev = T.Evo.split(w, p, half, 3, c.dist);
assert(w.species.length === nsp + 1 && ev.child.parentId === p.id, 'split creates ' + ev.child.name + ' from ' + p.name);
for (let i = 0; i < 200; i++) w.tick();
assert(w.checkLedger().err < 1e-6, 'ledger conserved after a split');

// save / load v2
const s = JSON.parse(JSON.stringify(w.serialize()));
const w2 = T.loadWorld(s, {});
assert(w2.ents.length === w.ents.filter(e => e.alive).length, 'save/load keeps all ' + w2.ents.length + ' organisms');
assert(w2.species.length === w.species.length && w2.player.isPlayer, 'save/load keeps species and player');
const e1 = w.ents.find(e => e.alive), e2 = w2.ents[0];
assert(e2 && Math.abs(e1.g[T.G.bite] - e2.g[T.G.bite]) < 1e-5, 'individual genomes survive the round-trip');
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
