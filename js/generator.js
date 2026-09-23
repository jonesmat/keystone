// Trophic — Phase 2 procedural worlds: archetypes, niche slots, genome sampling with quirks, food webs,
// names and colours, founder rolls, and the 5-round headless stability test.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const G = T.G, NG = T.NG;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const ARCHETYPES = [
    // herbivores
    { id: 'herd-grazer', name: 'Herd grazer', level: 'herbivore', foods: ['ground', 'tall'], herd: [8, 20], pop: [50, 80], speed: [0.14, 0.17], sight: [5, 6.5],
      genes: { size: [2, 5], social: [1, 3], cohesion: [0.6, 0.9], repro: [0.2, 0.4], boldness: [0.4, 0.6], speed: [0, 2], tail: [1, 1] },
      suffix: ['strider', 'grazer', 'runner'] },
    { id: 'burrower', name: 'r-strategist burrower', level: 'herbivore', foods: ['ground', 'vine', 'fruit'], pop: [35, 55], speed: [0.14, 0.16], sight: [4.5, 5.5],
      genes: { size: [0.8, 1.5], repro: [0.15, 0.35], camo: [0, 1.5], burrow: [0.7, 1], longevity: [2, 2.5], tail: [0, 0] },
      suffix: ['skipper', 'hopper', 'burrower'] },
    { id: 'browser', name: 'Large browser', level: 'herbivore', foods: ['woody', 'tall'], herd: [3, 6], pop: [10, 16], speed: [0.1, 0.12], sight: [4.5, 5.5],
      genes: { size: [8, 12], armor: [0, 2], bite: [1, 2], charge: [0.6, 1], social: [1, 2], repro: [0.8, 1], longevity: [4.5, 6], tail: [3, 3], cohesion: [0.7, 0.9] },
      suffix: ['lumber', 'tusk', 'browser'] },
    { id: 'fruit-specialist', name: 'Fruit specialist', level: 'herbivore', foods: ['vine', 'fruit', 'ground'], pop: [30, 50], speed: [0.15, 0.18], sight: [6, 7],
      genes: { size: [1.5, 3.5], plantGut: [0, 2], senses: [1, 3], speed: [1, 3], repro: [0.3, 0.6] },
      suffix: ['grazer', 'picker', 'nibbler'] },
    // omnivores
    { id: 'scavenger', name: 'Scavenger', level: 'omnivore', foods: ['fruit', 'carrion', 'ground'], pop: [20, 30], speed: [0.1, 0.12], sight: [5.5, 6.5],
      genes: { size: [1.5, 3], diet: [0.4, 0.5], boldness: [0.35, 0.5], limbs: [6, 6], metabolism: [1, 1], tail: [0, 0], plantGut: [1, 2] },
      suffix: ['scuttle', 'picker', 'crawler'] },
    { id: 'armored-forager', name: 'Armored forager', level: 'omnivore', foods: ['ground', 'tall', 'vine', 'fruit'], preyMax: 2, pop: [12, 18], speed: [0.08, 0.1], sight: [3.5, 4.5],
      genes: { size: [4, 6], diet: [0.35, 0.45], spines: [2, 3], armor: [1, 2], metabolism: [1, 1], boldness: [0.8, 1], tail: [3, 3] },
      suffix: ['forager', 'back', 'shell'] },
    { id: 'opportunist', name: 'Opportunist', level: 'omnivore', foods: ['ground', 'vine', 'fruit', 'carrion'], preyMax: 1.2, pop: [10, 16], speed: [0.13, 0.16], sight: [5.5, 6.5],
      genes: { size: [3, 5], diet: [0.5, 0.65], bite: [1, 2], coat: [3, 3] },
      suffix: ['fang', 'snatcher', 'forager'] },
    // primary carnivores
    { id: 'pack-hunter', name: 'Pack hunter', level: 'carnivore1', preyRatio: 3, herd: [3, 6], pop: [6, 9], speed: [0.18, 0.2], sight: [6.5, 7.5],
      genes: { size: [4, 6], diet: [0.9, 1], social: [2.5, 3.5], cohesion: [0.8, 1], bite: [1, 2], tail: [2, 2], aggression: [0.3, 0.4] },
      suffix: ['maw', 'runner', 'jaw'] },
    { id: 'ambusher', name: 'Ambusher', level: 'carnivore1', preyRatio: 1.5, pop: [4, 7], speed: [0.18, 0.2], sight: [6.5, 7.5],
      genes: { size: [3, 5], diet: [1, 1], camo: [1.5, 3], ambush: [0.8, 1], metabolism: [1, 1], bite: [1, 2], coat: [2, 2] },
      suffix: ['stalker', 'lurker'] },
    { id: 'aerial', name: 'Aerial diver', level: 'carnivore1', preyRatio: 1.5, pop: [4, 7], speed: [0.2, 0.23], sight: [8, 10],
      genes: { size: [1.5, 2.5], diet: [1, 1], flight: [1, 1], senses: [1, 3], limbs: [2, 2], roam: [8, 12] },
      suffix: ['reaver', 'wing', 'diver'] },
    { id: 'venomous-stalker', name: 'Venomous stalker', level: 'carnivore1', preyRatio: 2, pop: [4, 7], speed: [0.16, 0.18], sight: [6, 7],
      genes: { size: [2, 4], diet: [0.95, 1], venom: [1.5, 3], camo: [0.5, 1.5], metabolism: [1, 1], coat: [3, 3] },
      suffix: ['stinger', 'fang', 'stalker'] },
    // secondary carnivores
    { id: 'apex-territorial', name: 'Apex territorial', level: 'carnivore2', preyRatio: 1.5, pop: [2, 3], speed: [0.13, 0.15], sight: [7.5, 8.5], territorial: true,
      genes: { size: [12, 15], diet: [1, 1], bite: [2.5, 3.5], armor: [1.5, 2.5], repro: [0.9, 1], longevity: [5, 6], boldness: [1, 1], tail: [3, 3], head: [2, 2] },
      suffix: ['claw', 'maw', 'dread'] },
    { id: 'apex-scavenger', name: 'Apex scavenger', level: 'carnivore2', preyRatio: 1.5, carrion: true, pop: [2, 4], speed: [0.13, 0.15], sight: [8, 9],
      genes: { size: [9, 12], diet: [0.95, 1], bite: [2, 3], senses: [1, 3], repro: [0.8, 1], longevity: [4, 6] },
      suffix: ['gorger', 'claw'] },
    // decomposers
    { id: 'detritivore', name: 'Detritivore', level: 'decomposer', foods: ['detritus', 'carrion'], pop: [30, 40], speed: [0.05, 0.07], sight: [2.5, 3.5],
      genes: { size: [0.4, 0.6], diet: [0.5, 0.5], repro: [0.5, 0.7], metabolism: [1, 1], limbs: [6, 6], longevity: [2, 3] },
      suffix: ['mite', 'worm'] },
    { id: 'carrion-specialist', name: 'Carrion specialist', level: 'decomposer', foods: ['carrion', 'detritus'], pop: [20, 30], speed: [0.06, 0.08], sight: [3.5, 4.5],
      genes: { size: [0.5, 0.8], diet: [0.5, 0.5], repro: [0.5, 0.7], metabolism: [1, 1], limbs: [6, 6], longevity: [2, 3] },
      suffix: ['beetle', 'grub'] },
  ];
  const ARCH_BY_ID = {};
  ARCHETYPES.forEach(a => (ARCH_BY_ID[a.id] = a));

  const PRODUCER_ARCHETYPES = {
    ground:  { max: [120, 180], resp: [0.50, 0.60], edible: 0.35, height: 0, leaf: [0.95, 1.05], regrow: [0, 0],    tough: [0.2, 0.4], moist: [0.4, 0.6], color: [172, 196, 128], suffix: ['veil', 'carpet', 'moss', 'mat'],
      note: 'Ground cover that regrows quickly but holds little energy per tile.' },
    tall:    { max: [320, 450], resp: [0.40, 0.50], edible: 0.30, height: 2, leaf: [1.05, 1.15], regrow: [60, 100], tough: [0.6, 1.0], moist: [0.65, 0.85], color: [150, 172, 96], suffix: ['spire', 'stalk', 'reed'],
      note: 'Grows tall and shades its neighbours; slow to recover after grazing.' },
    vine:    { max: [200, 300], resp: [0.45, 0.55], edible: 0.35, height: 1, leaf: [0.95, 1.05], regrow: [0, 0],    tough: [0.3, 0.5], moist: [0.45, 0.65], color: [158, 190, 122], fruit: true, suffix: ['coil', 'vine', 'trail'],
      note: 'Fruits in spring and summer; fruit is easier to digest than leaves.' },
    woody:   { max: [1200, 1700], resp: [0.50, 0.60], edible: 0.30, height: 3, leaf: [1.15, 1.25], regrow: [30, 50], tough: [1.6, 2.4], moist: [0.35, 0.55], color: [104, 146, 88], suffix: ['hold', 'bark', 'wood'],
      note: 'A huge energy store behind tough bark. Small eaters struggle to get through it.' },
    aquatic: { max: [100, 160], resp: [0.30, 0.45], edible: 0.50, height: 0, leaf: [0.85, 0.95], regrow: [0, 0],    tough: [0.1, 0.3], moist: [0.9, 1.0], color: [120, 170, 150], suffix: ['mat', 'weed', 'lily'],
      note: 'Floats on open water. Only waders and fliers reach it easily.' },
  };
  const PRODUCER_ROOTS = ['Moss', 'Reed', 'Berry', 'Bark', 'Silt', 'Fern', 'Sun', 'Bramble', 'Vine', 'Ash', 'Pond', 'Mire', 'Glow', 'Dew'];

  const ROOTS = {
    armor: ['Plate', 'Shell', 'Scale'], speed: ['Dust', 'Swift', 'Dart'], size: ['Horn', 'Bulk', 'Great'], plantGut: ['Fig', 'Berry', 'Nectar'],
    spines: ['Thorn', 'Needle', 'Barb'], metabolism: ['Ash', 'Bask', 'Ember'], camo: ['Dusk', 'Shade', 'Mottle'], flight: ['Glide', 'Sky', 'Wind'],
    venom: ['Needle', 'Venom', 'Sting'], burrow: ['Burrow', 'Tunnel', 'Den'], social: ['Pack', 'Herd', 'Band'], senses: ['Keen', 'Far', 'Whisker'],
    apex: ['Grave', 'Dread', 'Iron'], decomposer: ['Silt', 'Rot', 'Loam'], none: ['Moor', 'Fen', 'Dale', 'Brook', 'Mead'],
  };
  const DAUGHTER_SUFFIX = ['leaper', 'runner', 'dweller', 'strider', 'walker', 'crawler', 'ling', 'fang', 'back', 'skipper', 'wing', 'maw', 'tail', 'claw'];
  const ALL_SUFFIX = new Set(ARCHETYPES.flatMap(a => a.suffix).concat(DAUGHTER_SUFFIX));

  const SLOTS = { herbivore: [3, 5], omnivore: [2, 3], carnivore1: [2, 4], carnivore2: [1, 2], decomposer: [1, 2] };
  // Projected income/upkeep margin band per level (carnivores run leaner, as the 10% rule predicts).
  const MARGIN = { herbivore: [0.10, 0.40], omnivore: [0.10, 0.40], carnivore1: [-0.15, 0.25], carnivore2: [-0.25, 0.15], decomposer: [-1, 99] };
  const MASS_BAND = { herbivore: [0.8, 12], omnivore: [1.5, 6], carnivore1: [1.5, 7], carnivore2: [9, 15], decomposer: [0.3, 0.8] };
  const FOUNDER_POP = { herbivore: 20, omnivore: 12, carnivore1: 8, carnivore2: 3, decomposer: 20 };

  const Gen = (T.Gen = { ARCHETYPES, ARCH_BY_ID, PRODUCER_ARCHETYPES, MARGIN });

  function rr(rng, pair) { return pair[0] + (pair[1] - pair[0]) * rng.next(); }
  function rint(rng, pair) { return pair[0] + rng.int(pair[1] - pair[0] + 1); }

  Gen.hashSeed = function (seed, k) {
    let h = (seed >>> 0) ^ Math.imul(k + 1, 0x9E3779B1);
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B); h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
    return (h ^ (h >>> 16)) >>> 0 || 1;
  };

  // ---------- genomes ----------

  // Sample a genome inside an archetype, then spend a 0–6 point quirk budget off-archetype.
  Gen.makeGenome = function (arch, rng) {
    const g = T.newGenome();
    g[G.diet] = arch.level === 'herbivore' ? 0 : arch.level === 'carnivore2' ? 1 : arch.level === 'carnivore1' ? 0.95 : 0.5;
    g[G.aggression] = arch.level === 'carnivore2' ? 0.4 : arch.level === 'carnivore1' ? 0.35 : 0.25;
    for (const k in arch.genes) g[G[k]] = T.clampGene(G[k], rr(rng, arch.genes[k]));
    for (let m = 0; m < 8; m++) g[G.m0 + m] = rng.next();
    g[G.limbs] = arch.genes.limbs ? g[G.limbs] : rng.next() < 0.8 ? 4 : rng.pick([2, 6]);
    if (!arch.genes.coat) g[G.coat] = rng.int(4);
    if (!arch.genes.head) g[G.head] = g[G.diet] >= 0.5 ? rng.pick([1, 2]) : 0;
    const quirks = [];
    const budget = arch.level === 'decomposer' ? 0 : rng.int(7);
    const pool = ['speed', 'senses', 'camo', 'armor', 'spines', 'bite', 'venom', 'fat', 'plantGut', 'meatGut', 'social'];
    for (let q = 0; q < budget; q++) {
      const key = rng.pick(pool);
      if (arch.genes[key]) continue;
      if (key === 'plantGut' && g[G.diet] > 0.7) continue;
      if (key === 'meatGut' && g[G.diet] < 0.3) continue;
      const d = T.GENE_BY_KEY[key];
      const add = Math.round(rr(rng, [0.3, 1]) * 10) / 10;
      g[d.i] = T.clampGene(d.i, g[d.i] + add * d.step);
      quirks.push({ key, add });
    }
    return { g, quirks: mergeQuirks(quirks) };
  };

  function mergeQuirks(qs) {
    const m = {};
    for (const q of qs) m[q.key] = (m[q.key] || 0) + q.add;
    return Object.keys(m).map(k => ({ key: k, add: Math.round(m[k] * 10) / 10 }));
  }

  // Keep projected income within the level's margin band by trimming or adding upkeep traits.
  Gen.fitMargin = function (sp, rng) {
    const band = MARGIN[sp.level];
    const g = sp.genome;
    const upkeepGenes = T.GENES.filter(d => d.upkeep > 0 && !d.special);
    for (let it = 0; it < 24; it++) {
      const st = T.deriveStats(sp, g, 1);
      const m = T.projection(st).margin;
      if (m < band[0]) {
        let worst = null, wv = 0;
        for (const d of upkeepGenes) { const v = d.upkeep * g[d.i]; if (v > wv) { wv = v; worst = d; } }
        if (worst && wv > 0.002) g[worst.i] = T.clampGene(worst.i, g[worst.i] - worst.step);
        else if (g[G.size] > MASS_BAND[sp.level][0] + 0.5) g[G.size] -= 0.5;
        else break;
      } else if (m > band[1]) {
        const d = rng.pick(upkeepGenes);
        if ((d.key === 'plantGut' && g[G.diet] > 0.7) || (d.key === 'meatGut' && g[G.diet] < 0.3)) continue;
        g[d.i] = T.clampGene(d.i, g[d.i] + d.step);
      } else break;
    }
  };

  // ---------- names ----------

  function dominantRoot(g, level, rng) {
    if (level === 'carnivore2') return rng.pick(ROOTS.apex);
    if (level === 'decomposer') return rng.pick(ROOTS.decomposer);
    const cand = [['flight', g[G.flight] >= 0.5 ? 3 : 0], ['venom', g[G.venom] / 1.5], ['spines', g[G.spines] / 1.5], ['armor', g[G.armor] / 2],
      ['camo', g[G.camo] / 1.5], ['burrow', g[G.burrow] * 1.2], ['size', (g[G.size] - 5) / 4], ['speed', g[G.speed] / 2.5],
      ['plantGut', g[G.plantGut] / 2], ['social', g[G.social] / 3], ['senses', g[G.senses] / 3], ['metabolism', g[G.metabolism] * 0.6]];
    cand.sort((a, b) => b[1] - a[1]);
    return cand[0][1] > 0.4 ? rng.pick(ROOTS[cand[0][0]]) : rng.pick(ROOTS.none);
  }

  function uniqueName(root, suffix, taken, rng, suffixes, roots) {
    let n = root + suffix, k = 0;
    while (taken.has(n) && k < 30) {
      n = (k % 2 && roots ? rng.pick(roots) : root) + rng.pick(suffixes);
      k++;
    }
    if (taken.has(n)) n = root + suffix + ' ' + (taken.size + 1);
    taken.add(n);
    return n;
  }

  Gen.nameFor = function (g, arch, rng, taken) {
    const root = dominantRoot(g, arch.level, rng);
    return uniqueName(root, rng.pick(arch.suffix), taken, rng, arch.suffix, ROOTS.none);
  };

  // A daughter species keeps its parent's root ("Duskhopper" → "Duskleaper").
  Gen.daughterName = function (parent, existing, rng) {
    const taken = new Set(existing);
    let root = parent.split(' ')[0].replace(/s$/, '');
    let joiner = parent.includes(' ') ? '' : '-';   // "Burrow Hopper" → "Burrowleaper"
    for (const s of ALL_SUFFIX) {
      if (root.toLowerCase().endsWith(s) && root.length > s.length + 2) { root = root.slice(0, root.length - s.length); joiner = ''; break; }
    }
    const pool = DAUGHTER_SUFFIX.filter(s => !parent.toLowerCase().endsWith(s) && !parent.toLowerCase().endsWith(s + 's'));
    for (let k = 0; k < 20; k++) {
      const n = root + joiner + rng.pick(pool);
      if (!taken.has(n)) return n;
    }
    return parent + ' II';
  };

  // ---------- rosters ----------

  Gen.meadowRoster = function () {
    return {
      mode: 'meadow',
      producers: T.MEADOW_PRODUCERS.map(p => Object.assign({ hue: 0, pattern: 'plain' }, p)),
      species: T.NPC_SPECIES.map(d => Object.assign({ hue: 0, archetypeName: (ARCH_BY_ID[d.archetype] || {}).name }, d)),
    };
  };

  function makeProducers(rng) {
    const kinds = ['ground'];
    const extra = ['tall', 'vine', 'woody', 'aquatic', 'ground', 'tall'];
    const n = rint(rng, [3, 6]);
    while (kinds.length < n) {
      const k = rng.pick(extra);
      if (k === 'aquatic' && kinds.includes('aquatic')) continue;
      if (k === 'woody' && kinds.includes('woody')) continue;
      kinds.push(k);
    }
    if (!kinds.includes('tall') && !kinds.includes('woody')) kinds[kinds.length - 1] = 'tall';
    const taken = new Set();
    return kinds.map((kind, i) => {
      const A = PRODUCER_ARCHETYPES[kind];
      const name = uniqueName(rng.pick(PRODUCER_ROOTS), rng.pick(A.suffix), taken, rng, A.suffix, PRODUCER_ROOTS);
      const hue = Math.round(rng.range(-20, 20));
      return {
        id: 'p' + i, name, kind, max: Math.round(rr(rng, A.max)), resp: Math.round(rr(rng, A.resp) * 100) / 100, edible: A.edible, height: A.height, leaf: rr(rng, A.leaf), regrowDelay: Math.round(rr(rng, A.regrow)),
        fruit: !!A.fruit, tough: rr(rng, A.tough), moist: rr(rng, A.moist), color: A.color.map(c => clamp(Math.round(c + rng.range(-10, 10)), 0, 255)),
        hue, pattern: rng.pick(['plain', 'spots', 'bands']), note: A.note, archetypeName: T.PRODUCER_KINDS[kind].name,
      };
    });
  }

  // Generate a roster: producers, then consumer niche slots per level, then diet links.
  Gen.generateRoster = function (seed, biomeId) {
    const rng = new T.RNG(seed);
    const producers = makeProducers(rng);
    const kinds = new Set(producers.map(p => p.kind));
    const taken = new Set(producers.map(p => p.name));
    const species = [];
    let total = 0;
    for (const level of ['herbivore', 'omnivore', 'carnivore1', 'carnivore2', 'decomposer']) {
      let n = rint(rng, SLOTS[level]);
      if (total + n > 16) n = Math.max(level === 'carnivore2' ? 0 : 1, 16 - total);
      const pool = ARCHETYPES.filter(a => a.level === level && (!a.foods || a.foods.some(f => kinds.has(f) || f === 'fruit' || f === 'carrion' || f === 'detritus')));
      for (let s = 0; s < n; s++) {
        const unused = pool.filter(a => !species.some(x => x.archetype === a.id));
        const A = unused.length ? rng.pick(unused) : rng.pick(pool);
        species.push(makeSpeciesDef(A, rng, taken, species.length));
      }
      total += n;
    }
    // Design target: 10–16 consumers. Top up with extra plant-eaters if the dice came up short.
    while (species.length < 10) {
      const lv = rng.chance(0.6) ? 'herbivore' : 'omnivore';
      const pool = ARCHETYPES.filter(a => a.level === lv);
      species.splice(species.findIndex(s => s.level !== 'herbivore' && s.level !== 'omnivore') , 0, makeSpeciesDef(rng.pick(pool), rng, taken, species.length + 20));
    }
    buildFoodWeb(species, producers, rng);
    return { mode: 'generated', seed, biome: biomeId, producers, species };
  };

  function makeSpeciesDef(A, rng, taken, idx) {
    const { g, quirks } = Gen.makeGenome(A, rng);
    const band = MASS_BAND[A.level];
    g[G.size] = clamp(g[G.size], band[0], band[1]);
    const def = {
      id: 'g' + idx + '-' + A.id, name: '', level: A.level, archetype: A.id, archetypeName: A.name,
      base: { speed: rr(rng, A.speed), sight: rr(rng, A.sight), apex: A.level === 'carnivore2' },
      eats: [], flags: Object.assign({}, A.territorial ? { territorial: true } : {}, A.level === 'decomposer' ? { decomposer: true, asexual: true } : {}),
      genome: g, herdSize: A.herd || null,
      startPop: Math.max(2, Math.round(rr(rng, A.pop) * (A.level === 'herbivore' ? clamp(4 / Math.max(1, g[G.size]), 0.4, 1.3) : 1))),
      hue: Math.round(rng.range(-20, 20)), quirks,
    };
    Gen.fitMargin(def, rng);
    def.name = Gen.nameFor(g, A, rng, taken);
    def.pattern = T.COAT_WORDS[Math.round(g[G.coat])];
    return def;
  }

  function buildFoodWeb(species, producers, rng) {
    const byKind = {};
    producers.forEach(p => (byKind[p.kind] = byKind[p.kind] || []).push(p.id));
    const hasFruit = producers.some(p => p.fruit);
    const mass = d => d.genome[G.size];
    const plantFoods = foods => {
      const out = [];
      for (const f of foods) {
        if (f === 'fruit') { if (hasFruit) out.push('fruit'); }
        else if (f === 'carrion' || f === 'detritus') out.push(f);
        else if (byKind[f]) out.push(...byKind[f].slice(0, 2));
      }
      if (!out.some(t => t.startsWith('p')) && !out.includes('detritus') && !out.includes('carrion')) out.push(...byKind.ground);
      return [...new Set(out)];
    };
    const herbs = species.filter(s => s.level === 'herbivore'), omnis = species.filter(s => s.level === 'omnivore');
    const c1 = species.filter(s => s.level === 'carnivore1'), c2 = species.filter(s => s.level === 'carnivore2');
    for (const s of species) {
      const A = ARCH_BY_ID[s.archetype];
      if (s.level === 'herbivore' || s.level === 'decomposer') s.eats = plantFoods(A.foods);
      else if (s.level === 'omnivore') {
        s.eats = plantFoods(A.foods);
        if (A.preyMax) for (const h of herbs) if (mass(h) <= mass(s) * A.preyMax) s.eats.push(h.id);
      }
    }
    const pickPrey = (s, cands, ratio) => {
      let ok = cands.filter(p => mass(p) <= mass(s) * ratio);
      if (ok.length < 2) ok = cands.slice().sort((a, b) => mass(a) - mass(b)).slice(0, 2);
      for (let k = ok.length - 1; k > 0; k--) { const j = rng.int(k + 1); const t = ok[k]; ok[k] = ok[j]; ok[j] = t; }
      return ok.slice(0, Math.min(ok.length, 2 + rng.int(3))).map(p => p.id);
    };
    for (const s of c1) s.eats = pickPrey(s, herbs.concat(omnis), ARCH_BY_ID[s.archetype].preyRatio || 1.5);
    for (const s of c2) {
      s.eats = pickPrey(s, c1.concat(herbs.filter(h => mass(h) >= 5), omnis), 1.5);
      if (ARCH_BY_ID[s.archetype].carrion || rng.chance(0.5)) s.eats.push('carrion');
    }
    for (const s of c1) if (ARCH_BY_ID[s.archetype].id === 'pack-hunter' && rng.chance(0.5)) s.eats.push('carrion');
    // Every herbivore needs at least one predator.
    for (const h of herbs) {
      if (species.some(s => s.eats.includes(h.id))) continue;
      const preds = c1.concat(c2).sort((a, b) => Math.abs(mass(a) * 1.2 - mass(h)) - Math.abs(mass(b) * 1.2 - mass(h)));
      if (preds[0]) preds[0].eats.push(h.id);
    }
  }

  // ---------- founders ----------

  Gen.rollFounder = function (archId, seed) {
    const A = ARCH_BY_ID[archId];
    const rng = new T.RNG(seed);
    const taken = new Set();
    const def = makeSpeciesDef(A, rng, taken, 0);
    def.id = 'player';
    def.flags = {};
    def.startPop = FOUNDER_POP[A.level];
    def.herdSize = null;
    return def;
  };

  Gen.customFounder = function (level) {
    const g = T.newGenome();
    const cfg = {
      herbivore: { size: 3, diet: 0, speed: 0.15, sight: 6 }, omnivore: { size: 3, diet: 0.5, speed: 0.15, sight: 6 },
      carnivore1: { size: 4, diet: 0.9, speed: 0.17, sight: 7 }, carnivore2: { size: 10, diet: 1, speed: 0.14, sight: 8 },
    }[level];
    g[G.size] = cfg.size; g[G.diet] = cfg.diet; g[G.head] = cfg.diet >= 0.5 ? 1 : 0;
    for (let m = 0; m < 8; m++) g[G.m0 + m] = 0.5;
    return { id: 'player', name: '', level, archetype: 'custom', archetypeName: 'Custom build', base: { speed: cfg.speed, sight: cfg.sight, apex: level === 'carnivore2' },
      eats: [], flags: {}, genome: g, startPop: FOUNDER_POP[level], hue: 0 };
  };

  Gen.templateFounder = function (tpl) {
    return { id: 'player', name: tpl.name + 's', level: tpl.level, archetype: 'template-' + tpl.id, archetypeName: tpl.niche + ' template',
      base: Object.assign({}, tpl.base), eats: [], flags: {}, genome: T.genomeFrom(tpl.genome, {}, tpl.level), startPop: tpl.startPop, hue: 0 };
  };

  // ---------- stability test ----------

  // Runs a roster headless (no player) for 5 rounds. step(budgetMs) advances it; returns true when finished.
  Gen.StabilityTest = function (roster, seed, biome) {
    this.world = T.createWorld({ seed, roster, player: null, biome });
    this.round = 1;
    this.rounds = 5;
    this.done = false;
    this.pass = false;
    this.reason = '';
    this.startProd = this.world.producerBiomass();
    this.levels = new Set(roster.species.map(s => s.level));
  };
  Gen.StabilityTest.prototype.progress = function () {
    return Math.min(1, ((this.round - 1) * B.roundTicks + this.world.roundTick) / (this.rounds * B.roundTicks));
  };
  Gen.StabilityTest.prototype.step = function (budgetMs) {
    const w = this.world;
    const t0 = Date.now();
    while (!this.done && Date.now() - t0 < budgetMs) {
      for (let k = 0; k < 50 && !w.roundOver(); k++) w.tick();
      if (w.roundOver()) {
        const why = this.check();
        if (why) { this.done = true; this.pass = false; this.reason = why; break; }
        if (this.round >= this.rounds) { this.done = true; this.pass = true; this.reason = 'every level alive'; break; }
        this.round++;
        w.beginRound(this.round);
      }
    }
    return this.done;
  };
  Gen.StabilityTest.prototype.check = function () {
    const w = this.world, pops = w.countPops().count;
    const alive = {};
    w.species.forEach((s, i) => { if (pops[i] > 0) alive[s.level] = true; });
    for (const lv of this.levels) if (!alive[lv]) return T.LEVELS[lv].name.toLowerCase() + ' went extinct in round ' + this.round;
    if (w.producerBiomass() < 0.3 * this.startProd) return 'producers fell below 30% in round ' + this.round;
    // Dominance is judged by consumer biomass (EU), since small r-strategists are naturally the most numerous.
    const en = w.countPops().energy;
    let cons = 0, max = 0, maxName = '';
    w.species.forEach((s, i) => { if (s.level !== 'decomposer') { cons += en[i]; if (en[i] > max) { max = en[i]; maxName = s.name; } } });
    if (cons > 0 && max > B.dominanceLimit * cons) return maxName + ' took over ' + Math.round((100 * max) / cons) + '% of consumer biomass';
    return null;
  };

  // Generate + test with retries (up to 20 sub-seeds). Synchronous; used by Node tools.
  Gen.generateStable = function (seed, biomeId, maxAttempts) {
    const biome = B.biomes[biomeId] || B.biomes.meadow;
    for (let a = 1; a <= (maxAttempts || 20); a++) {
      const sub = a === 1 ? seed : Gen.hashSeed(seed, a);
      const roster = Gen.generateRoster(sub, biome.id);
      const test = new Gen.StabilityTest(roster, sub, biome);
      while (!test.step(1000)) { /* run */ }
      if (test.pass) return { roster, attempt: a, seed: sub, pass: true, reason: test.reason };
    }
    return { roster: Gen.meadowRoster(), attempt: maxAttempts || 20, seed, pass: false, reason: 'fell back to the Meadow roster' };
  };
})(window.Trophic);
