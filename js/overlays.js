// Keystone — map overlays (P3-M8): per-tile layers drawn over the map, each a value per tile and a colour ramp.
// Layers that depend on data the steward has to collect (soil nitrogen, survey coverage) show only what they've
// measured; everything else is left as the plain map. The renderer calls T.Overlays.compute once when the layer or the
// round changes and blends the result over its tile colours.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const O = (T.Overlays = {});
  const K = () => T.Knowledge, St = () => T.Steward;

  // Colour ramps: [value, [r, g, b]] stops, value 0–1.
  const RAMPS = {
    seq: [[0, [247, 240, 214]], [0.5, [210, 150, 60]], [1, [120, 50, 30]]],          // low → high (cream → rust)
    green: [[0, [240, 236, 214]], [0.5, [140, 185, 100]], [1, [40, 100, 50]]],
    blue: [[0, [245, 238, 220]], [0.5, [120, 175, 200]], [1, [30, 80, 140]]],
    div: [[0, [178, 58, 49]], [0.5, [240, 236, 214]], [1, [47, 125, 50]]],             // source ↔ sink
    fresh: [[0, [29, 101, 112]], [0.6, [200, 190, 110]], [1, [224, 129, 58]]],        // fresh → stale
  };
  const SERAL = [[196, 186, 160], [170, 170, 150], [214, 200, 110], [150, 170, 80], [60, 110, 60]];
  const STRATA = [[230, 222, 190], [200, 205, 120], [140, 170, 90], [60, 110, 60]];
  const LAND = [null, [180, 120, 60], [70, 150, 80], [120, 120, 120]];

  function ramp(name, v) {
    const r = RAMPS[name];
    for (let k = 1; k < r.length; k++) if (v <= r[k][0]) {
      const [a, ca] = r[k - 1], [b, cb] = r[k], f = (v - a) / Math.max(1e-9, b - a);
      return [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f];
    }
    return r[r.length - 1][1];
  }

  // Tiles inside any of a list of circles { x, y, r }.
  function circles(w, list) {
    const out = new Int16Array(w.N * w.N).fill(-1);
    list.forEach((c, k) => { for (const i of St().tilesIn(w, c.x, c.y, c.r, false)) out[i] = k; });
    return out;
  }
  const hi = (arr, q) => { const s = Array.from(arr).filter(v => v > 0).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) * q)] : 1; };

  // Each layer: name, legend stops, a caption, and compute(w, run) → { rgb: Uint8ClampedArray (N*N*3), alpha: Float32Array }.
  O.LAYERS = [
    { id: 'nitrogen', name: 'Soil nitrogen', legend: [['low', RAMPS.seq[0][1]], ['high', RAMPS.seq[2][1]]],
      caption: 'Ammonium + nitrate, where a soil test from the last 3 rounds measured it. Test more ground to see more.',
      tile: (w, run) => {
        const tests = (run && run.soilTests || []).filter(t => t.x != null && K().fresh(run, t));
        const inT = circles(w, tests), N = w.N * w.N, v = new Float32Array(N).fill(NaN);
        const tot = new Float32Array(N); for (let i = 0; i < N; i++) tot[i] = w.nh4[i] + w.no3[i];
        const top = hi(tot, 0.95);
        for (let i = 0; i < N; i++) if (inT[i] >= 0 && !w.terrain[i]) v[i] = Math.min(1, tot[i] / top);
        return { v, ramp: 'seq', note: tests.length ? tests.length + ' fresh soil test' + (tests.length > 1 ? 's' : '') : 'No fresh soil test: place one from the Monitor actions.' };
      } },
    { id: 'seral', name: 'Seral stage', legend: [['bare', SERAL[0]], ['pioneer', SERAL[1]], ['grasses', SERAL[2]], ['shrubs', SERAL[3]], ['forest', SERAL[4]]],
      caption: 'Succession: bare ground, pioneers, grasses and forbs, shrubs, forest.',
      tile: w => { const N = w.N * w.N, c = new Float32Array(N).fill(NaN); for (let i = 0; i < N; i++) if (!w.terrain[i]) c[i] = w.ptype[i] ? T.sereOf(w.producers[w.ptype[i]]) : 0; return { v: c, cat: SERAL }; } },
    { id: 'stratum', name: 'Vegetation layers', legend: [['ground', STRATA[0]], ['herb layer', STRATA[1]], ['shrub layer', STRATA[2]], ['canopy', STRATA[3]]],
      caption: 'How many layers the vegetation has: more layers, more strata for animals to forage in.',
      tile: w => { const N = w.N * w.N, c = new Float32Array(N).fill(NaN); for (let i = 0; i < N; i++) if (!w.terrain[i]) { const P = w.producers[w.ptype[i]]; c[i] = !P ? 0 : P.stage >= 4 ? 3 : P.stage === 3 ? 2 : 1; } return { v: c, cat: STRATA }; } },
    { id: 'edge', name: 'Edge vs interior', legend: [['open', [240, 236, 214]], ['edge woodland', [214, 170, 80]], ['interior', [40, 100, 50]]],
      caption: 'Woodland 3 or more tiles from open ground is interior; interior specialists breed only there.',
      tile: w => {
        if (w._computeEdge && (w.edgeDirty || !w.edgeDist)) w._computeEdge();
        const N = w.N * w.N, c = new Float32Array(N).fill(NaN), D = T.BALANCE.interactions.interiorDist;
        for (let i = 0; i < N; i++) if (!w.terrain[i]) { const P = w.producers[w.ptype[i]]; c[i] = !(P && P.stage >= 3) ? 0 : w.edgeDist[i] >= D ? 2 : 1; }
        return { v: c, cat: [[240, 236, 214], [214, 170, 80], [40, 100, 50]] };
      } },
    { id: 'moisture', name: 'Soil water', legend: [['dry', RAMPS.blue[0][1]], ['saturated', RAMPS.blue[2][1]]],
      caption: 'Soil moisture per tile. The water table, map-wide, needs a well gauge.',
      tile: (w, run) => {
        const N = w.N * w.N, v = new Float32Array(N).fill(NaN);
        for (let i = 0; i < N; i++) if (!w.terrain[i]) v[i] = Math.min(1, w.moist[i]);
        const g = run && run.wellGauge && K().fresh(run, run.wellGauge) ? run.wellGauge : null;
        return { v, ramp: 'blue', note: g ? 'Water table ' + Math.round(100 * g.gw / Math.max(1, g.ref)) + '% of normal (well gauge, round ' + g.round + ')' : 'Water table unknown: read a well gauge.' };
      } },
    { id: 'carbon', name: 'Soil carbon', legend: [['little', RAMPS.green[0][1]], ['rich', RAMPS.green[2][1]]],
      caption: 'Soil organic matter: carbon stored in the soil. Bare, disced and burned ground loses it; grassland and forest build it.',
      tile: w => { const N = w.N * w.N, v = new Float32Array(N).fill(NaN), top = hi(w.som, 0.95); for (let i = 0; i < N; i++) if (!w.terrain[i]) v[i] = Math.min(1, w.som[i] / top); return { v, ramp: 'green' }; } },
    { id: 'harvest', name: 'Harvest pressure', legend: [['none', RAMPS.seq[0][1]], ['heavy', RAMPS.seq[2][1]]],
      caption: 'Where harvest and invasive control took animals, fading by half each round.',
      tile: w => {
        const N = w.N * w.N, v = new Float32Array(N).fill(NaN), m = w.harvestMap;
        if (!m) return { v, ramp: 'seq', note: 'Nothing harvested yet.' };
        const top = Math.max(1, hi(m, 0.98));
        for (let i = 0; i < N; i++) if (m[i] > 0) v[i] = Math.min(1, m[i] / top);
        return { v, ramp: 'seq', note: v.some(x => x > 0) ? null : 'Nothing harvested recently.' };
      } },
    { id: 'territories', name: 'Territories', legend: [['held', [214, 110, 60]]],
      caption: 'Territories held by territorial species. Floaters without one can’t breed.',
      tile: (w, run) => {
        const N = w.N * w.N, v = new Float32Array(N).fill(NaN);
        for (const id in w.territories || {}) {
          const sp = w.speciesById(id);
          if (!sp || (run && T.Knowledge && !T.Knowledge.known(run, sp))) continue;
          const r = w.territoryRadius(sp);
          for (const t of w.territories[id]) for (const i of St().tilesIn(w, t.x, t.y, r, false)) v[i] = 1;
        }
        return { v, cat: [null, [214, 110, 60]] };
      } },
    { id: 'survey', name: 'Survey coverage', legend: [['this round', RAMPS.fresh[0][1]], ['stale (5+ rounds)', RAMPS.fresh[2][1]]],
      caption: 'Where your surveys have been and how old they are. Estimates beyond the surveyed ground are scaled up, not counted.',
      tile: (w, run) => {
        const N = w.N * w.N, v = new Float32Array(N).fill(NaN), list = (run && run.surveyed) || [];
        const age = new Float32Array(N).fill(Infinity);
        for (const s of list) { const a = run.round - s.round; for (const i of St().tilesIn(w, s.x, s.y, s.r, false)) if (a < age[i]) age[i] = a; }
        const S = T.BALANCE.knowledge.staleAfter;
        for (let i = 0; i < N; i++) if (age[i] < Infinity) v[i] = Math.min(1, age[i] / S);
        return { v, ramp: 'fresh', note: list.length ? null : 'No surveys yet.' };
      } },
    { id: 'land', name: 'Land use', legend: [['private', LAND[1]], ['easement', LAND[2]], ['developed', LAND[3]]],
      caption: 'Who holds the land. Your actions work on public land and conservation easements only.',
      tile: w => { const N = w.N * w.N, v = new Float32Array(N).fill(NaN); if (w.landUse) for (let i = 0; i < N; i++) if (w.landUse[i]) v[i] = w.landUse[i]; return { v, cat: LAND }; } },
  ];
  O.byId = id => O.LAYERS.find(l => l.id === id) || null;

  // One layer as per-tile colours and blend strengths.
  O.compute = function (w, run, id) {
    const L = O.byId(id);
    if (!L) return null;
    const res = L.tile(w, run), N = w.N * w.N;
    const rgb = new Uint8ClampedArray(N * 3), alpha = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = res.v[i];
      if (Number.isNaN(x)) continue;
      const c = res.cat ? res.cat[x | 0] : ramp(res.ramp, x);
      if (!c) continue;
      rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2];
      alpha[i] = 0.72;
    }
    return { id, rgb, alpha, note: res.note || null, layer: L };
  };
})(window.Trophic);
