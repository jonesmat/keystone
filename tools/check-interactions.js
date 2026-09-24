// Interaction, niche and keystone checks (Phase 3, P3-M6 part 2).
//   node tools/check-interactions.js
// Checks that:
//   - real species feed in their EltonTraits strata, and predators reach prey only in the strata they hunt
//   - big animals trample plants (amensalism) and small ones don't
//   - parasite loads stay under their cap, and cleaners lower their hosts' loads (protocooperation)
//   - commensal followers keep near their hosts
//   - a flowering plant sets no fruit once its pollinator is gone (obligate mutualism)
//   - interior woodland shrinks faster than woodland area when a strip is cleared, interior specialists breed only
//     inside, and nest parasites lay only near edges
//   - monocultures get pest outbreaks, complete competitors trigger Gause's warning, and Shannon H is ln S for S equal species
//   - keystone tests are deterministic and flag a removal that collapses the community
//   - ledgers are conserved and saves keep parasite loads and badges
const T = require('./load.js');
const B = T.BALANCE;

let failures = 0;
const check = (ok, text) => { if (!ok) failures++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + text); };
const world = (seed, opts) => T.createWorld(Object.assign({ seed, roster: T.Gen.meadowRoster(), player: null, difficulty: B.difficulties.standard, closed: true }, opts || {}));
const round = w => { while (!w.roundOver()) w.tick(); w.updateMeans(); w.beginRound(w.round + 1); };
const ticks = (w, n) => { for (let k = 0; k < n; k++) w.tick(); };
const conserved = w => w.ledger.maxErr < 1e-3 && w.nledger.maxErr < 1e-3;
const byName = (w, n) => w.species.find(sp => sp.name === n);
B.succession.natural = false;

T.Catalog.load('9.4.6', cat => {
  // ---------- strata ----------
  console.log('Strata (Edwards Plateau cast)');
  const roster = T.Catalog.roster(cat, T.scenarioById('songbird'), 1001);
  const cw = T.createWorld({ seed: 1001, roster, player: null, biome: roster.biome, difficulty: B.difficulties.standard, closed: true });
  ticks(cw, 1);
  const byStratum = {};
  for (const sp of cw.species) byStratum[T.STRATA[sp.strat]] = (byStratum[T.STRATA[sp.strat]] || 0) + 1;
  console.log('    ' + Object.entries(byStratum).map(([k, v]) => k + ' ' + v).join(', '));
  check(Object.keys(byStratum).length >= 3, 'the cast feeds in at least 3 strata');
  const raptor = cw.species.find(sp => sp.strat === 0 && sp.stats.canMeat), under = cw.species.find(sp => sp.strat === 3), ground = cw.species.find(sp => sp.strat === 4);
  if (raptor && ground) check(cw.reachMult(raptor, ground) === 1 && (!under || cw.reachMult(raptor, under) < 1), raptor.name + ' (above canopy) reaches ground prey but not prey under cover');

  // ---------- mutualism ----------
  console.log('\nObligate mutualism (pollinators)');
  {
    const paired = cw.producers.filter(P => P && P.pollinator != null);
    check(paired.length > 0, paired.length + ' flowering producers are paired with a pollinator species');
    if (paired.length) {
      const P = paired[0], pol = cw.species[P.pollinator];
      const save = JSON.parse(JSON.stringify(cw.serialize()));
      const a = T.loadWorld(JSON.parse(JSON.stringify(save)), {}), b = T.loadWorld(save, {});
      T.removeSpecies(b, [pol.id]);
      for (const w of [a, b]) { w._pollinatorPresence(); while (!w.roundOver()) w.tick(); }
      const fa = a.pbook.unpollinated[P.idx], fb = b.pbook.unpollinated[P.idx];
      console.log('    ' + P.name + ' paired with ' + pol.name + ': fruit not set ' + Math.round(fa) + ' EU with it, ' + Math.round(fb) + ' EU without it');
      check(fb > fa && fb > 0, 'without its pollinator, ' + P.name + ' sets far less fruit');
      check(conserved(a) && conserved(b), 'ledgers conserved');
    }
  }

  // ---------- nest parasitism and interior specialists ----------
  console.log('\nEdges, interiors and nest parasites');
  {
    const w = cw, N = w.N;
    const wood = w.producers.find(P => P && P.stage === 4) || w.producers.find(P => P && P.stage === 3);
    const block = [];
    for (let y = 16; y < 44; y++) for (let x = 16; x < 44; x++) { const i = y * N + x; if (!w.terrain[i]) { w._switchProducer(i, wood); block.push(i); } }
    w.edgeDirty = true;
    const h0 = w.habitatSummary();
    for (let y = 16; y < 44; y++) for (const x of [29, 30]) { const i = y * N + x; if (!w.terrain[i]) w._clearTile(i); }
    w.edgeDirty = true;
    const h1 = w.habitatSummary();
    console.log('    woodland ' + h0.wood + ' → ' + h1.wood + ' tiles (−' + Math.round(100 * (1 - h1.wood / h0.wood)) + '%); interior ' + h0.interior + ' → ' + h1.interior + ' (−' + Math.round(100 * (1 - h1.interior / h0.interior)) + '%)');
    check(1 - h1.interior / h0.interior > 2 * (1 - h1.wood / h0.wood), 'a cleared strip shrinks interior habitat much faster than woodland area (fragmentation)');
    const host = w.species.find(sp => sp.stats.flight && !sp.stats.ecto && !sp.flags.nestParasite && sp.level !== 'carnivore2' && !sp.grid && sp.meta && sp.meta.roles.includes('songbird'));
    const par = w.species.find(sp => sp.flags.nestParasite);
    if (host && par) {
      // An edge woodland tile beside the cleared strip, and a tile deep in the interior.
      const edgeTile = block.find(i => w.ptype[i] && !w.isInterior(i) && Math.abs((i % N) - 28) <= 0), inTile = block.find(i => w.isInterior(i) && w.edgeDist[i] >= 5);
      const at = i => [(i % N) + 0.5, ((i / N) | 0) + 0.5];
      const [ex, ey] = at(edgeTile), [ix, iy] = at(inTile);
      const f = w.spawn(host, ex, ey, 50, T.sampleGenome(host.genome, w.rng, 0), { grow: 1, sex: 'F' });
      const c = w.spawn(par, ex, ey + 0.5, 50, T.sampleGenome(par.genome, w.rng, 0), { grow: 1, sex: 'F' });
      w._rebuildGrid();
      let atEdge = 0, inside = 0;
      for (let k = 0; k < 200; k++) if (w._nestParasite(f)) atEdge++;
      f.x = ix; f.y = iy; c.x = ix; c.y = iy + 0.5; w._rebuildGrid();
      for (let k = 0; k < 200; k++) if (w._nestParasite(f)) inside++;
      console.log('    ' + par.name + ' in ' + host.name + ' broods: ' + atEdge + ' of 200 at the edge, ' + inside + ' of 200 in the interior');
      check(atEdge > 50 && inside === 0, 'the nest parasite lays in edge nests only');
      f.x = ex; f.y = ey;
      const saved = host.flags.interior;
      host.flags.interior = true;
      const edgeOk = w._canBreedHere(f);
      f.x = ix; f.y = iy;
      const inOk = w._canBreedHere(f);
      host.flags.interior = saved;
      check(!edgeOk && inOk, 'an interior specialist breeds only in interior woodland');
    } else console.log('    (no songbird host or nest parasite in this cast)');
  }

  meadowChecks();
});

function meadowChecks() {
  // ---------- amensalism ----------
  console.log('\nAmensalism (trampling) and parasites, Meadow, 2 rounds');
  const w = world(T.Gen.hashSeed(9100, 1));
  round(w); round(w);
  const trampled = w.species.map((sp, i) => ({ sp, t: w.rstats[i].trampled || 0 }));
  const lastRs = w.lastInteractions;
  const heavy = w.species.filter(sp => sp.stats.mass >= B.interactions.trampleMass), light = w.species.filter(sp => sp.stats.mass < B.interactions.trampleMass);
  console.log('    ' + (lastRs.items.filter(i => i.type === 'amensalism').map(i => i.text).join('; ') || 'no trampling'));
  check(heavy.length > 0 && lastRs.items.some(i => i.type === 'amensalism'), 'animals heavier than ' + B.interactions.trampleMass + ' trample plants');
  check(light.every(sp => !trampled[sp.idx].t), 'lighter animals trample nothing');
  const hosts = w.ents.filter(e => e.alive && e.sp.parasiteHost);
  const over = hosts.filter(e => e.para > B.interactions.paraCap * e.st.maxE * 1.01);
  console.log('    ' + hosts.length + ' parasite hosts, mean load ' + (hosts.reduce((a, e) => a + e.para, 0) / Math.max(1, hosts.length)).toFixed(2) + ' EU');
  check(hosts.length > 0 && hosts.some(e => e.para > 0) && !over.length, 'hosts carry parasite loads within their cap');
  check(conserved(w), 'ledgers conserved with trampling and parasites');

  // ---------- cleaners ----------
  console.log('\nCleaners (protocooperation)');
  {
    const seed = T.Gen.hashSeed(9200, 1);
    const a = world(seed), b = world(seed);
    for (const w2 of [a, b]) { round(w2); }
    byName(b, 'Scuttler').flags.cleaner = true;
    for (const w2 of [a, b]) {
      for (const e of w2.ents) if (e.sp.parasiteHost) e.para = B.interactions.paraCap * e.st.maxE;
      w2.ledger.initial += w2.totalPools() - w2.checkLedger().expected;   // the loads were put there by the test
      w2.ledger.maxErr = 0;
    }
    const load = w2 => { const h = w2.ents.filter(e => e.alive && e.sp.parasiteHost); return h.reduce((s, e) => s + e.para / (B.interactions.paraCap * e.st.maxE), 0) / Math.max(1, h.length); };
    ticks(a, 600); ticks(b, 600);
    const cleaned = Object.values(b.rstats[byName(b, 'Scuttler').idx].cleaned || {}).reduce((x, y) => x + y, 0);
    console.log('    mean host load (share of cap) after half a round: ' + load(a).toFixed(2) + ' without cleaners, ' + load(b).toFixed(2) + ' with Scuttlers cleaning (' + Math.round(cleaned) + ' EU eaten)');
    check(cleaned > 0 && load(b) < load(a), 'cleaners eat parasites and lower their hosts\' loads');
    check(conserved(a) && conserved(b), 'ledgers conserved');
  }

  // ---------- followers ----------
  console.log('\nCommensal followers');
  {
    // Thornbacks trail Tuskbeasts (the cattle egret pattern). Share of Thornbacks within 6 tiles of one, with and without.
    const run = follow => {
      const w2 = world(T.Gen.hashSeed(9300, 1));
      const f = byName(w2, 'Thornback');
      if (!follow) delete f.flags.follower;
      w2._interactionsRefresh();
      let near = 0, n = 0;
      for (let k = 0; k < B.roundTicks; k++) {
        w2.tick();
        if (k % 50) continue;
        const hosts = w2.ents.filter(e => e.alive && e.sp.name === 'Tuskbeast');
        for (const e of w2.ents) if (e.alive && e.sp === f) { n++; if (hosts.some(h => Math.hypot(h.x - e.x, h.y - e.y) < 6)) near++; }
      }
      return { share: near / Math.max(1, n), hosts: [...(f.hosts || [])].map(h => w2.species[h].name), w: w2 };
    };
    const a = run(false), b = run(true);
    console.log('    Thornbacks within 6 tiles of a Tuskbeast: ' + Math.round(a.share * 100) + '% on their own, ' + Math.round(b.share * 100) + '% as followers (hosts: ' + b.hosts.join(', ') + ')');
    check(b.share > a.share * 1.5, 'followers keep near their hosts');
    const sc = byName(b.w, 'Scuttler');
    check(sc.hosts && ![...sc.hosts].some(h => b.w.edible[h][sc.idx]), 'a follower never takes a host that preys on it (Scuttlers: ' + ([...(sc.hosts || [])].map(h => b.w.species[h].name).join(', ') || 'none') + ')');
  }

  // ---------- pests, competition, diversity ----------
  console.log('\nMonocultures, competition and diversity');
  {
    const w2 = world(T.Gen.hashSeed(9400, 1));
    w2._interactionsRefresh();
    const moss = w2.producers.find(P => P && P.stage === 2);
    for (let i = 0; i < w2.N * w2.N; i++) if (!w2.terrain[i]) w2._switchProducer(i, moss);
    const saved = B.interactions.pestChance;
    B.interactions.pestChance = 1;
    const out = w2._monoculturePests();
    B.interactions.pestChance = saved;
    check(out.length && out[0].tiles > 20, 'a ' + moss.name + ' monoculture gets a pest outbreak (' + (out[0] ? out[0].tiles : 0) + ' tiles)');
    const [x, y] = [byName(w2, 'Grazeling'), byName(w2, 'Burrow Hopper')];
    for (const rs of [w2.rstats[x.idx], w2.rstats[y.idx]]) rs.eaten = { Sunmoss: 100 };
    y.strat = x.strat; y.activity = x.activity;
    const o = w2.nicheOverlap(x, y);
    let warn = [];
    for (let r = 0; r < 3; r++) warn = w2._competition(w2.countPops().count);
    check(o > 0.95 && warn.some(c => (c.a === x.name && c.b === y.name) || (c.b === x.name && c.a === y.name)), 'identical niches (overlap ' + o.toFixed(2) + ') trigger Gause\'s warning after 3 rounds');
    const fake = { countPops: () => ({ count: [10, 10, 10, 10], energy: [1, 1, 1, 1] }), species: [0, 1, 2, 3].map(i => ({ idx: i, id: 's' + i })), producers: [null], N: 1, ptype: [0] };
    const d = T.World.prototype.diversity.call(fake);
    check(Math.abs(d.H - Math.log(4)) < 1e-9, 'Shannon H of 4 equally common species is ln 4 (' + d.H.toFixed(3) + ')');
  }

  // ---------- keystone tests ----------
  console.log('\nKeystone tests');
  {
    const w2 = world(T.Gen.hashSeed(9500, 1));
    round(w2);
    while (!w2.roundOver()) w2.tick();
    const save = JSON.parse(JSON.stringify(w2.serialize()));
    const c1 = T.keystoneRun(save, null, 2), c2 = T.keystoneRun(save, null, 2);
    check(JSON.stringify(c1) === JSON.stringify(c2), 'a forked world replays identically (the test is deterministic)');
    const herb = w2.species.filter(sp => sp.level === 'herbivore').map(sp => sp.id);
    const items = [{ ids: herb, name: 'all herbivores', guild: true }, T.keystoneCandidates(w2).find(it => !it.guild)];
    const res = T.keystoneBatch(w2, items, B.keystone.rounds);
    for (const r of res) console.log('    without ' + r.name + ': richness −' + Math.round(r.dropRichness * 100) + '%, diversity −' + Math.round(r.dropDiversity * 100) + '%' + (r.keystone ? ' → Keystone' : '') + (r.effects.length ? ' (' + r.effects.join('; ') + ')' : ''));
    check(res[0].keystone, 'removing every herbivore collapses the community and earns a badge');
    T.keystoneRecord(w2, Object.assign({}, res[0], { keystone: true }), w2.round);
    const s = JSON.parse(JSON.stringify(w2.serialize()));
    const w3 = T.loadWorld(s, {});
    check(Object.keys(w3.keystones).length === herb.length && w3.ents.reduce((a, e) => a + e.para, 0) > 0, 'saves keep keystone badges and parasite loads');
    ticks(w3, 300);
    check(conserved(w3), 'ledgers stay conserved after loading');
  }

  if (failures) { console.log('\n' + failures + ' interaction check(s) failed'); process.exit(1); }
  console.log('\nall interaction checks passed');
}
