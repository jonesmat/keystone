// Demography checks (Phase 3, P3-M5).
//   node tools/check-demography.js
// Checks that:
//   - each round's table balances: N1 = N0 + B + I − D − E, exactly, for individually simulated species
//   - founders are about half female, and a species with no males doesn't breed (no lonely clones)
//   - a species wiped out locally returns from the regional pool, and a regionally extinct one doesn't
//   - young adults emigrate above 0.8 K and not below it
//   - territories don't overlap, and breeding females of territorial species each hold one
//   - explosive breeders need company (the Allee threshold)
//   - disease strikes the species furthest above its K
//   - sexes, territories and the pool survive save and load
const T = require('./load.js');
const B = T.BALANCE;

let failures = 0;
const check = (ok, text) => { if (!ok) failures++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + text); };
const world = (seed, opts) => T.createWorld(Object.assign({ seed, roster: T.Gen.meadowRoster(), player: null, difficulty: B.difficulties.standard }, opts || {}));
const round = w => { while (!w.roundOver()) w.tick(); w.updateMeans(); w.beginRound(w.round + 1); };
const byName = (w, n) => w.species.find(sp => sp.name === n);
const count = (w, sp) => w.countPops().count[sp.idx];

// ---------- the demography equation ----------
console.log('Demography table (Meadow, 3 seeds × 4 rounds)');
{
  let rows = 0, bad = [], curves = {}, withK = 0, active = 0;
  for (let s = 1; s <= 3; s++) {
    const w = world(T.Gen.hashSeed(7100, s));
    for (let r = 0; r < 4; r++) {
      round(w);
      for (const d of w.demography) {
        if (d.population) continue;
        rows++;
        if (!d.balanced) bad.push(d.name + ' r' + (w.round - 1) + ': ' + d.N0 + '+' + d.B + '+' + d.I + '−' + d.D + '−' + d.E + '≠' + d.N1);
        curves[d.curve] = (curves[d.curve] || 0) + 1;
      }
      for (const d of w.demography) if (d.N1 > 0) { active++; if (d.K > 0) withK++; }
    }
    if (s === 1) {
      console.log('    seed 1, round 4:');
      for (const d of w.demography) console.log('      ' + d.name.padEnd(14) + ' N0 ' + String(d.N0).padStart(5) + '  B ' + String(d.B).padStart(4) + '  I ' + String(d.I).padStart(3) +
        '  D ' + String(d.D).padStart(4) + '  E ' + String(d.E).padStart(3) + '  N1 ' + String(d.N1).padStart(5) + '  r ' + (d.r == null ? '—' : d.r.toFixed(0) + '%').padStart(5) +
        '  K ' + String(d.K).padStart(5) + '  ' + d.curve);
    }
  }
  console.log('    curve labels: ' + Object.entries(curves).map(([k, v]) => k + ' ' + v).join(', '));
  check(!bad.length, rows + ' species-rounds balance exactly: N1 = N0 + B + I − D − E' + (bad.length ? ' (' + bad.slice(0, 4).join('; ') + ')' : ''));
  check(withK >= active * 0.9, withK + ' of ' + active + ' living species-rounds have a carrying capacity estimate');
}

// ---------- sexes ----------
console.log('\nSexes and mating systems');
{
  const w = world(T.Gen.hashSeed(7200, 1));
  const f = w.ents.filter(e => e.sex === 'F').length / w.ents.length;
  console.log('    founders ' + (f * 100).toFixed(0) + '% female · mating: ' + w.species.map(sp => sp.name + ' ' + sp.mating).join(', '));
  check(f > 0.4 && f < 0.6, 'founders are about half female');
  // Only females of one species: no births, ever.
  const w2 = world(T.Gen.hashSeed(7200, 2), { closed: true });
  const sp = byName(w2, 'Burrow Hopper');
  for (const e of w2.ents) if (e.sp === sp) e.sex = 'F';
  let births = 0;
  for (let r = 0; r < 2; r++) { while (!w2.roundOver()) w2.tick(); births += w2.rstats[sp.idx].births; w2.beginRound(w2.round + 1); }
  check(births === 0, 'an all-female species has no births (' + births + '): no lonely clones in Phase 3');
  const w3 = world(T.Gen.hashSeed(7200, 2), { closed: true });
  const sp3 = byName(w3, 'Burrow Hopper');
  let b3 = 0;
  for (let r = 0; r < 2; r++) { while (!w3.roundOver()) w3.tick(); b3 += w3.rstats[sp3.idx].births; w3.beginRound(w3.round + 1); }
  check(b3 > 0, 'the same species with both sexes breeds (' + b3 + ' births)');
  // Allee threshold: an explosive breeder alone can't spawn.
  const ex = w3.species.find(s => s.mating === 'explosive' && !s.grid);
  const lone = w3.ents.find(e => e.sp === ex && e.alive && e.grow >= 1);
  if (lone) {
    const others = w3.ents.filter(e => e !== lone && e.sp === ex);
    for (const e of others) { e.x = 1; e.y = 1; }
    lone.x = w3.N - 5; lone.y = w3.N - 5;
    w3._rebuildGrid();
    const alone = w3._canBreedHere(lone);
    const company = others.filter(o => o.alive && o.grow >= 1).slice(0, 3);
    while (company.length < 3) company.push(w3.spawn(ex, 1, 1, lone.E, ex.genome, { grow: 1 }));
    for (const e of company) { e.x = lone.x + 1; e.y = lone.y; }
    w3._rebuildGrid();
    check(!alone && w3._canBreedHere(lone), ex.name + ' (explosive) spawns only with others of its kind nearby');
  }
}

// ---------- the regional pool ----------
console.log('\nRegional pool');
{
  const w = world(T.Gen.hashSeed(7300, 1));
  const sp = byName(w, 'Scuttler');
  for (const e of w.ents) if (e.sp === sp) w._die(e, 'culled', -1);
  w.ents = w.ents.filter(e => e.alive);
  let back = -1;
  for (let r = 0; r < 4 && back < 0; r++) { round(w); if (count(w, sp) > 0) back = r + 1; }
  check(back > 0, 'Scuttler, wiped out locally, recolonizes from the regional pool' + (back > 0 ? ' within ' + back + ' round(s)' : ''));
  const w2 = world(T.Gen.hashSeed(7300, 1));
  const sp2 = byName(w2, 'Scuttler');
  w2.pool[sp2.id].regionallyExtinct = true;
  for (const e of w2.ents) if (e.sp === sp2) w2._die(e, 'culled', -1);
  w2.ents = w2.ents.filter(e => e.alive);
  for (let r = 0; r < 3; r++) round(w2);
  check(count(w2, sp2) === 0, 'a regionally extinct species does not return on its own');
  check(w.ledger.maxErr < 1e-3 && w.nledger.maxErr < 1e-3, 'ledgers conserved with arrivals and departures');
}

// ---------- emigration ----------
console.log('\nEmigration above 0.8 K');
{
  const out = {};
  for (const [label, kMult] of [['N at 2 × K', 0.5], ['N at 0.5 × K', 2]]) {
    const w = world(T.Gen.hashSeed(7400, 1));
    const sp = byName(w, 'Burrow Hopper');
    let emig = 0;
    for (let k = 0; k < B.roundTicks; k++) {
      if (k % 100 === 0) sp.K = Math.max(1, count(w, sp) * kMult);
      w.tick();
    }
    emig = w.rstats[sp.idx].emig || 0;
    out[label] = emig;
  }
  console.log('    Burrow Hopper emigrants in a round: ' + Object.entries(out).map(([k, v]) => k + ' ' + v).join(', '));
  check(out['N at 2 × K'] > 0 && out['N at 0.5 × K'] === 0, 'young adults leave above 0.8 K and stay below it');
}

// ---------- territories ----------
console.log('\nTerritories');
{
  const w = world(T.Gen.hashSeed(7500, 1), { closed: true });
  const sp = w.species.find(s => s.flags.territorial && !s.grid);
  // Give the territorial species plenty of breeders to crowd the map.
  for (let k = 0; k < 30; k++) { const p = w._randomLand(w.N / 2, w.N / 2, w.N / 2 - 2, sp.stats.swim); const e = w.spawn(sp, p[0], p[1], 0, sp.genome, { grow: 1 }); e.E = e.st.maxE; }
  w.ledger.initial = w.totalPools(); w.nledger.initial = w.totalNitrogen();
  const females = w.ents.filter(e => e.sp === sp && e.sex === 'F');
  for (const e of females) w._canBreedHere(e);
  const list = w.territories[sp.id] || [], r = w.territoryRadius(sp);
  let overlap = 0;
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) if (Math.hypot(list[a].x - list[b].x, list[a].y - list[b].y) < 2 * r - 1e-6) overlap++;
  const cap = Math.floor((w.N * w.N) / (Math.PI * r * r));
  console.log('    ' + sp.name + ': radius ' + r.toFixed(1) + ' tiles, ' + list.length + ' territories for ' + females.length + ' females (map fits about ' + cap + ')');
  check(!overlap && list.length > 0 && list.length <= cap, 'territories do not overlap and are capped by map area');
  check(females.filter(e => e.terr).length === list.length, 'each territory has one female holder; floaters hold none');
  const holder = females.find(e => e.terr), before = list.length;
  w._die(holder, 'culled', -1);
  const after = w.territories[sp.id] || [];
  check(after.length === before - 1 && !after.some(t => t.owner === holder.id), 'a territory is released when its holder dies');
}

// ---------- disease ----------
console.log('\nDensity-dependent disease');
{
  const w = world(T.Gen.hashSeed(7600, 1), { closed: true });
  round(w);
  const pops = w.countPops().count;
  const target = w.plagueTarget(pops);
  const ratio = (i) => (w.species[i].K ? pops[i] / w.species[i].K : 0);
  const best = w.species.reduce((b, sp, i) => (!sp.transient && pops[i] >= 2 && ratio(i) > ratio(b) ? i : b), 0);
  const most = pops.indexOf(Math.max(...pops));
  console.log('    most numerous ' + w.species[most].name + ' (N/K ' + ratio(most).toFixed(2) + '); disease targets ' + w.species[target].name + ' (N/K ' + ratio(target).toFixed(2) + ')');
  check(target === best, 'disease targets the species furthest above its carrying capacity');
}

// ---------- saves ----------
console.log('\nSaves');
{
  const w = world(T.Gen.hashSeed(7700, 1));
  round(w);
  const s = JSON.parse(JSON.stringify(w.serialize()));
  const w2 = T.loadWorld(s, {});
  const sexA = w.ents.map(e => e.sex).join(''), sexB = w2.ents.map(e => e.sex).join('');
  const terrA = JSON.stringify(Object.values(w.territories).map(l => l.length)), terrB = JSON.stringify(Object.values(w2.territories).map(l => l.length));
  check(sexA === sexB, 'sexes survive save and load');
  check(terrA === terrB && w2.ents.filter(e => e.terr).length === w.ents.filter(e => e.alive && e.terr).length, 'territories survive save and load');
  check(w2.species.every(sp => (sp.K || 0) === (w.species[sp.idx].K || 0)), 'carrying capacities survive save and load');
  for (let k = 0; k < 600; k++) w2.tick();
  check(w2.ledger.maxErr < 1e-3 && w2.nledger.maxErr < 1e-3, 'ledgers stay conserved after loading');
}

if (failures) { console.log('\n' + failures + ' demography check(s) failed'); process.exit(1); }
console.log('\nall demography checks passed');
