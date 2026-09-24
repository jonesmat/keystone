// Keystone — automatic keystone tests (P3-M6, part 2).
// At the end of every round the world is forked: a control copy runs on for 3 rounds, and for each candidate species
// (or guild of small pooled taxa) a copy runs on without it. A removal that drops the community's species richness
// or its biomass diversity by more than 25% earns the species a Keystone badge, with a note on what changed.
// Candidates only, to keep it cheap: the 10 species with the strongest interactions this round, any species whose
// numbers changed by more than half, and Populations tested as guilds. In the browser the tests run in a Web Worker
// (served over http) or, from file://, in small slices between frames, and results arrive during the next season.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const K = () => B.keystone;

  // ---------- candidates ----------

  T.keystoneCandidates = function (w) {
    const S = w.species, pops = w.countPops().count;
    const strength = S.map(() => 0);
    S.forEach((sp, i) => {
      const rs = w.rstats[i];
      if (!rs) return;
      strength[i] += rs.ingested;
      for (const k in rs.eaten) { const j = S.findIndex(s => s.name === k); if (j >= 0) strength[j] += rs.eaten[k]; }
    });
    const tot = strength.reduce((a, b) => a + b, 0) || 1;
    const ok = sp => !sp.transient && !sp.grid && pops[sp.idx] > 0;
    const items = S.filter(ok).sort((a, b) => strength[b.idx] - strength[a.idx]).slice(0, K().top)
      .map(sp => ({ ids: [sp.id], name: sp.name, why: 'strong interactions (' + Math.round(100 * strength[sp.idx] / tot) + '% of the round\'s flows)' }));
    for (const sp of S) {
      if (!ok(sp) || items.some(it => it.ids[0] === sp.id)) continue;
      const n0 = w.rstats[sp.idx].startPop, n1 = pops[sp.idx];
      if (n0 > 0 && Math.abs(n1 - n0) / n0 > K().changed) items.push({ ids: [sp.id], name: sp.name, why: 'numbers changed ' + Math.round(100 * (n1 - n0) / n0) + '%' });
    }
    // Pooled small taxa as guilds, by trophic level.
    const guilds = {};
    for (const sp of S) if (sp.grid && pops[sp.idx] > 0) (guilds[sp.level] = guilds[sp.level] || []).push(sp);
    for (const lv in guilds) {
      const g = guilds[lv];
      items.push({ ids: g.map(sp => sp.id), name: (T.LEVELS[lv] ? T.LEVELS[lv].name : lv) + ' guild (' + g.map(sp => sp.name).join(', ') + ')', guild: true, why: 'pooled small taxa' });
    }
    return items.slice(0, K().maxItems);
  };

  // ---------- one test ----------

  // Take species out of a world for good: their bodies leave the ledgers as exports, and the regional pool is closed.
  T.removeSpecies = function (w, ids) {
    const set = new Set(ids);
    for (const e of w.ents) {
      if (!e.alive || !set.has(e.sp.id)) continue;
      w.ledger.exported += e.E + e.tissue + e.para;
      w.nledger.exported += e.nT + e.nS;
      e.E = 0; e.tissue = 0; e.para = 0; e.nT = 0; e.nS = 0; e.alive = false;
      if (e.terr) w._releaseTerritory(e);
    }
    w.ents = w.ents.filter(e => e.alive);
    for (const sp of w.species) {
      if (!set.has(sp.id)) continue;
      if (sp.grid) {
        const g = sp.grid;
        for (let i = 0; i < w.N * w.N; i++) {
          w.ledger.exported += g.E[i] + g.Tt[i]; w.nledger.exported += g.Nn[i];
          g.nJ[i] = g.nA[i] = g.nO[i] = g.E[i] = g.Tt[i] = g.Nn[i] = 0;
        }
        w._popTotals(sp);
      }
      if (w.pool && w.pool[sp.id]) w.pool[sp.id].regionallyExtinct = true;
    }
  };

  function snapshot(w) {
    const d = w.diversity(), c = w.countPops().count;
    return { richness: d.animals, H: d.H, Hb: d.Hbiomass, counts: Object.fromEntries(w.species.map(sp => [sp.id, c[sp.idx]])) };
  }

  // Run a copy of the saved world for some rounds, optionally without some species (synchronously; used by the
  // worker, the file:// fallback and the tools).
  T.keystoneRun = function (save, ids, rounds) {
    const w = T.loadWorld(JSON.parse(JSON.stringify(save)), {});
    if (ids && ids.length) T.removeSpecies(w, ids);
    for (let r = 0; r < rounds; r++) { while (!w.roundOver()) w.tick(); w.beginRound(w.round + 1); }
    return snapshot(w);
  };

  // Compare a removal with the control: richness and biomass diversity of the rest of the community.
  T.keystoneCompare = function (control, removed, item, names) {
    const drop = (a, b) => (a > 0 ? Math.max(0, (a - b) / a) : 0);
    const others = id => !item.ids.includes(id);
    const rc = Object.keys(control.counts).filter(id => others(id) && control.counts[id] > 0).length;
    const rr = Object.keys(removed.counts).filter(id => others(id) && removed.counts[id] > 0).length;
    const dRich = drop(rc, rr), dH = drop(control.Hb, removed.Hb);
    const change = Object.keys(control.counts).filter(others).map(id => ({ id, a: control.counts[id], b: removed.counts[id] || 0 }))
      .filter(x => x.a > 0 || x.b > 0).map(x => Object.assign(x, { f: (x.b + 1) / (x.a + 1) }));
    change.sort((p, q) => p.f - q.f);
    const lost = change.filter(x => x.f < 0.5).slice(0, 3).map(x => names[x.id] + (x.b === 0 ? ' died out' : ' fell ' + Math.round(100 * (1 - x.f)) + '%'));
    const rose = change.filter(x => x.f > 2).slice(-2).reverse().map(x => names[x.id] + ' rose ×' + x.f.toFixed(1));
    const drops = Math.max(dRich, dH);
    return { ids: item.ids, name: item.name, guild: !!item.guild, why: item.why, dropRichness: dRich, dropDiversity: dH, drop: drops,
      keystone: drops > K().threshold, effects: lost.concat(rose) };
  };

  // A whole batch, synchronously (tools).
  T.keystoneBatch = function (w, items, rounds) {
    rounds = rounds || K().rounds;
    const save = JSON.parse(JSON.stringify(w.serialize()));
    const names = Object.fromEntries(w.species.map(sp => [sp.id, sp.name]));
    const control = T.keystoneRun(save, null, rounds);
    return (items || T.keystoneCandidates(w)).map(it => T.keystoneCompare(control, T.keystoneRun(save, it.ids, rounds), it, names));
  };

  // Record a result on the world: a badge and the Codex's explanation.
  T.keystoneRecord = function (w, res, round) {
    w.keystones = w.keystones || {};
    for (const id of res.ids) {
      if (res.keystone) w.keystones[id] = { round, drop: res.drop, guild: res.guild ? res.name : null, effects: res.effects };
      else if (w.keystones[id] && w.keystones[id].round < round) delete w.keystones[id];
    }
  };

  // ---------- in the browser ----------

  const Runner = (T.KeystoneRunner = { worker: null, job: null, results: [], onResult: null });

  // Start this round's tests; any unfinished batch from the last round is dropped.
  Runner.start = function (w, onResult) {
    Runner.cancel();
    const items = T.keystoneCandidates(w);
    if (!items.length) return;
    const save = w.serialize(), round = w.round;
    const names = Object.fromEntries(w.species.map(sp => [sp.id, sp.name]));
    const job = (Runner.job = { round, items, names, save, control: null, next: 0, done: [], onResult });
    if (typeof Worker !== 'undefined' && /^https?:/.test(location.protocol)) {
      try {
        const wk = (Runner.worker = new Worker('js/keystone-worker.js'));
        wk.onmessage = ev => {
          if (Runner.job !== job) return;
          const m = ev.data;
          if (m.control) { job.control = m.control; return; }
          const res = T.keystoneCompare(job.control, m.result, job.items[m.k], job.names);
          job.done.push(res);
          if (job.onResult) job.onResult(res, job);
        };
        wk.postMessage({ save, items: items.map(it => it.ids), rounds: K().rounds });
        return;
      } catch (e) { Runner.worker = null; }
    }
    Runner._slice(job);
  };

  // file:// fallback: step the copies a few milliseconds per frame on the main thread.
  Runner._slice = function (job) {
    let cur = null;
    const begin = ids => { const w = T.loadWorld(JSON.parse(JSON.stringify(job.save)), {}); if (ids) T.removeSpecies(w, ids); return { w, rounds: 0 }; };
    const step = () => {
      if (Runner.job !== job) return;
      const t0 = performance.now();
      while (performance.now() - t0 < K().sliceMs) {
        if (!cur) {
          if (!job.control) cur = Object.assign(begin(null), { control: true });
          else if (job.next < job.items.length) cur = Object.assign(begin(job.items[job.next].ids), { k: job.next++ });
          else { Runner.job = null; return; }
        }
        const w = cur.w;
        for (let k = 0; k < 20 && !w.roundOver(); k++) w.tick();
        if (w.roundOver()) {
          w.beginRound(w.round + 1);
          if (++cur.rounds >= K().rounds) {
            const snap = snapshot(w);
            if (cur.control) job.control = snap;
            else {
              const res = T.keystoneCompare(job.control, snap, job.items[cur.k], job.names);
              job.done.push(res);
              if (job.onResult) job.onResult(res, job);
            }
            cur = null;
          }
        }
      }
      setTimeout(step, 16);   // about a third of the main thread, between frames
    };
    setTimeout(step, 16);
  };

  Runner.cancel = function () {
    if (Runner.worker) { Runner.worker.terminate(); Runner.worker = null; }
    Runner.job = null;
  };

  T.keystoneSnapshot = snapshot;
})(window.Trophic);
