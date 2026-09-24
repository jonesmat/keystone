// Keystone — Phase 3 ecoregion catalogs at runtime (P3-M4): loading, niche-slot draws, and turning real species'
// traits into game definitions. Catalogs are built offline by tools/catalog/build.js into js/catalogs/<code>.js.
// A draw is deterministic for a (catalog, scenario, seed), so a shared seed gives a whole class the same cast.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const B = T.BALANCE;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const Cat = (T.Catalog = {});

  // Ecoregions with a built catalog (kept in step with js/catalogs/ by the build tool's output).
  Cat.available = () => Object.keys(T.CATALOGS || {}).sort((a, b) => parseFloat(a) - parseFloat(b));
  const fileFor = code => 'js/catalogs/' + code.replace(/\./g, '_') + '.js';

  // Load a catalog script on demand (works from file:// too). Node tools require() it instead.
  Cat.load = function (code, done) {
    T.CATALOGS = T.CATALOGS || {};
    if (T.CATALOGS[code]) { done(T.CATALOGS[code]); return; }
    if (typeof document === 'undefined') { require('../' + fileFor(code)); done(T.CATALOGS[code]); return; }
    const s = document.createElement('script');
    s.src = fileFor(code);
    s.onload = () => done(T.CATALOGS[code] || null);
    s.onerror = () => done(null);
    document.head.appendChild(s);
  };

  // Shareable seeds: "<ecoregion>-<scenario or sandbox>-<number>", e.g. "9.3-rewilding-48213" or "9.4.6-songbird-7".
  Cat.seedString = (code, scenarioId, seed) => code + '-' + (scenarioId || 'sandbox') + '-' + seed;
  Cat.parseSeed = function (str) {
    const m = /^(\d+(?:\.\d+){1,2})-([a-z]+)-(\d+)$/.exec(String(str).trim());
    return m ? { code: m[1], scenario: m[2] === 'sandbox' ? null : m[2], seed: +m[3] } : null;
  };

  // A stable per-species number for small, deterministic variations (sizes, colours).
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

  // ---------- biome ----------

  Cat.biome = function (cat) {
    const c = cat.climate;
    const wet = /everglades|coastal|alluvial|marine/i.test(cat.name);
    return {
      id: 'eco-' + cat.code, name: cat.name, ecoregion: cat.code, biomeType: c.biome,
      light: 1.0, winter: clamp(0.45 + c.tMean * 0.015, 0.3, 0.8),
      water: wet ? 0.3 : c.biome === 'desert' ? 0.03 : c.biome === 'temperate forest' ? 0.08 : 0.06,
      tMean: c.tMean, tAmp: c.tAmp, rain: c.rain,
    };
  };

  // ---------- drawing a cast ----------

  const THREATENED = new Set(['NT', 'VU', 'EN', 'CR']);

  function candidates(cat, slot, taken) {
    const all = slot.domestic ? [T.DOMESTIC[slot.domestic]] : cat.species;
    return all.filter(s => {
      if (taken.has(s.key)) return false;
      if (slot.role === 'any animal') { if (s.level === 'producer' || s.level === 'decomposer') return false; }
      else if (!s.roles.includes(slot.role)) return false;
      if (slot.native === true && !s.native) return false;
      if (slot.native === false && s.native) return false;
      if (slot.status === 'threatened' && !THREATENED.has(s.iucn)) return false;
      if (slot.status === 'endangered' && !['VU', 'EN', 'CR'].includes(s.iucn)) return false;
      if (slot.strata && !slot.strata.includes(s.strata)) return false;
      return true;
    });
  }

  // Weighted pick without replacement: common species (widely recorded in the ecoregion) are drawn more often.
  function pickWeighted(rng, list, n, weight) {
    const out = [], pool = list.slice();
    while (out.length < n && pool.length) {
      const ws = pool.map(weight), tot = ws.reduce((a, b) => a + b, 0);
      let r = rng.next() * tot, k = 0;
      while (k < pool.length - 1 && (r -= ws[k]) > 0) k++;
      out.push(pool.splice(k, 1)[0]);
    }
    return out;
  }

  // Fill every slot. Returns the cast as slot fills, so a failing slot can be redrawn on its own.
  // Narrow slots draw first (a nest parasite before the songbirds, which could otherwise take every cowbird).
  Cat.draw = function (cat, slots, rng, avoid) {
    const taken = new Set(), fills = new Array(slots.length);
    const order = slots.map((sl, k) => ({ k, n: candidates(cat, sl, new Set()).length })).sort((a, b) => a.n - b.n || a.k - b.k);
    for (const { k } of order) {
      const slot = slots[k];
      const n = slot.count[0] + rng.int(slot.count[1] - slot.count[0] + 1);
      fills[k] = Cat.fillSlot(cat, slot, n, rng, taken, avoid && avoid[k]);
    }
    return fills;
  };

  Cat.fillSlot = function (cat, slot, n, rng, taken, avoid) {
    let list = candidates(cat, slot, taken);
    if (avoid) { const rest = list.filter(s => !avoid.has(s.key)); if (rest.length >= Math.min(n, 1)) list = rest; }
    // At-risk slots favour the most endangered candidates; everything else favours the widespread.
    const SEVERITY = { CR: 8, EN: 4, VU: 1, NT: 0.5 };
    const weight = slot.status ? s => (SEVERITY[s.iucn] || 0.2) * (0.05 + s.occupancy) : s => 0.05 + s.occupancy;
    let picked = pickWeighted(rng, list, n, weight);
    // Slot-wide needs, e.g. at least one nitrogen-fixer among the forbs.
    if (slot.need && slot.need.fixer && !picked.some(s => s.fixer)) {
      const fixers = list.filter(s => s.fixer && !picked.includes(s));
      if (fixers.length) picked[picked.length - 1 >= 0 ? picked.length - 1 : 0] = pickWeighted(rng, fixers, 1, s => 0.05 + s.occupancy)[0];
    }
    picked = picked.filter(Boolean);
    for (const s of picked) taken.add(s.key);
    return { slot, species: picked };
  };

  // ---------- species → game definitions ----------

  const KIND = {
    ground: { max: 150, height: 0, leaf: 1.0, regrow: 0, tough: 0.35, resp: 0.55, edible: 0.35 },
    tall: { max: 400, height: 2, leaf: 1.1, regrow: 60, tough: 1.0, resp: 0.45, edible: 0.3 },
    woody: { max: 1500, height: 3, leaf: 1.2, regrow: 40, tough: 2.0, resp: 0.55, edible: 0.3 },
    vine: { max: 250, height: 1, leaf: 1.0, regrow: 0, tough: 0.4, resp: 0.5, edible: 0.35 },
    aquatic: { max: 60, height: 0, leaf: 1.0, regrow: 20, tough: 0.3, resp: 0.45, edible: 0.3 },
  };
  const HABIT_COLOR = { grass: [176, 190, 120], forb: [150, 186, 116], shrub: [128, 158, 96], tree: [96, 140, 84], vine: [150, 180, 110], aquatic: [110, 160, 120] };
  const WET_FAMILIES = new Set(['Cyperaceae', 'Juncaceae', 'Typhaceae', 'Salicaceae', 'Nymphaeaceae', 'Potamogetonaceae', 'Alismataceae']);

  // Standing crop per habit where it differs from its map kind: prairie grasses and forbs carry far more than moss-like
  // ground cover, which is most of a grazer's forage in a grassland ecoregion.
  const HABIT_MAX = { grass: 300, forb: 200 };

  Cat.producerDef = function (s, cat, idx, share) {
    const K = KIND[s.kind] || KIND.ground, h = hash(s.key);
    const j = f => 1 + (h - 0.5) * f;
    const col = HABIT_COLOR[s.habit] || HABIT_COLOR.forb;
    return {
      id: 'p' + s.key, name: s.common || s.sci, sci: s.sci, kind: s.kind, habit: s.habit,
      max: Math.round((HABIT_MAX[s.habit] || K.max) * j(0.2)), resp: +(K.resp * j(0.1)).toFixed(2), edible: K.edible, height: K.height, leaf: +(K.leaf * j(0.1)).toFixed(2),
      // "fruit" is the seasonal pool of flowers, seeds and berries: forbs, shrubs and vines flower and fruit, grasses set seed.
      regrowDelay: K.regrow, fruit: s.habit !== 'tree' && s.habit !== 'aquatic', tough: +(K.tough * j(0.3)).toFixed(2),
      moist: WET_FAMILIES.has(s.family) || s.habit === 'aquatic' ? 0.8 : s.habit === 'tree' ? 0.55 : 0.45,
      fixer: !!s.fixer, native: s.native, iucn: s.iucn, catalogKey: s.key, hue: Math.round((h - 0.5) * 30),
      color: col.map((c, k) => clamp(Math.round(c + (hash(s.key + ':' + k) - 0.5) * 24), 0, 255)), pattern: 'plain',
      tOpt: cat.climate.tMean, share: share || 1,
      tweaks: T.SpriteTweaks ? T.SpriteTweaks.forSpecies(s, cat) : null,   // P3-ART sprite (Codex portrait)
      note: codexNote(s, cat),
    };
  };

  const SPEED = { bovid: 0.14, cervid: 0.18, canid: 0.19, felid: 0.2, mustelid: 0.16, ursid: 0.15, lagomorph: 0.17, rodent: 0.14, shrew: 0.12, bat: 0.22,
    raptor: 0.24, songbird: 0.2, waterfowl: 0.18, wader: 0.16, gamebird: 0.15, woodpecker: 0.18, snake: 0.1, lizard: 0.12, turtle: 0.06, frog: 0.1,
    salamander: 0.06, fish: 0.18, mammal: 0.15 };
  const SIGHT = { raptor: 11, canid: 8, felid: 8, songbird: 7, waterfowl: 7, wader: 8, bovid: 6, cervid: 7, bat: 8 };

  Cat.speciesDef = function (s, cat) {
    const g = Math.max(0.1, s.mass * 1000);   // grams
    const lg = Math.log10(g);
    const size = clamp(0.9 * Math.log(g) - 3, 0.3, 15);
    const meat = clamp(s.diet.meat + s.diet.scav, 0, 1);
    const genome = {
      size: +size.toFixed(2), diet: Math.round(meat * 10), repro: +clamp(1 + 1.4 * lg, 0, 10).toFixed(1),
      longevity: +clamp(2 + 0.6 * lg, 2, 6).toFixed(1), tail: s.taxon === 'bovid' || s.taxon === 'canid' ? 2 : 1,
    };
    if (!s.endotherm) genome.metabolism = 'ecto';
    if (s.flight && !s.population) genome.organs = { flight: true };
    const flags = {};
    if (s.population) flags.population = true;
    if (s.swim) flags.swim = true;
    if (s.roles.includes('scavenger')) flags.scavenger = true;
    if (['rodent', 'lagomorph', 'shrew'].includes(s.taxon)) flags.burrow = true;
    if (s.taxon === 'felid' || s.taxon === 'snake') flags.ambush = true;
    if (s.level === 'carnivore2') flags.territorial = true;
    if (s.level === 'decomposer') { flags.decomposer = true; flags.asexual = true; }
    // Interaction roles: commensal followers (cattle egrets and cowbirds by big grazers, scavengers by predators),
    // cleaners (birds that pick ticks off big mammals), nest parasites and pollinators.
    const genus = s.sci.split(' ')[0];
    if (['Bubulcus', 'Molothrus'].includes(genus)) flags.follower = 'grazer';
    else if (s.roles.includes('scavenger') && s.flight) flags.follower = 'predator';
    if (['Pica', 'Quiscalus', 'Sturnus', 'Molothrus'].includes(genus)) flags.cleaner = true;
    if (s.roles.includes('nest parasite')) flags.nestParasite = true;
    if (s.roles.includes('pollinator')) flags.pollinator = true;
    let herdSize = null;
    if ((s.taxon === 'bovid' || s.taxon === 'cervid') && s.mass > 20) { genome.social = 2; genome.cohesion = 0.8; herdSize = [4, 12]; }
    else if (s.taxon === 'canid' && s.mass > 25) { genome.social = 3; genome.cohesion = 0.85; flags.pack = true; herdSize = [3, 6]; }
    else if (s.taxon === 'songbird' && s.diet.plant > 0.3) { genome.social = 1; }
    const level = s.level;
    // Starting numbers aim at the design's 400–800 individual vertebrates per world (Populations are separate):
    // enough of each species to find mates, fewer for big animals and predators.
    const bird = s.flight && s.endotherm;
    const startPop = s.population ? Math.round(120 + 280 * s.occupancy)
      : level === 'carnivore2' ? 3 : level === 'carnivore1' ? (s.mass < 0.2 ? 16 : s.mass < 2 ? 12 : 8)
      : level === 'omnivore' ? (bird ? 24 : 20)
      : s.mass >= 50 ? 12 : s.mass >= 1 ? 25 : bird ? 30 : 40;
    return {
      id: 'c' + s.key, name: s.common || s.sci, sci: s.sci, level, archetype: s.taxon, archetypeName: s.taxon[0].toUpperCase() + s.taxon.slice(1),
      startPop, herdSize, base: { speed: SPEED[s.taxon] || (s.population ? 0.07 : 0.15), sight: SIGHT[s.taxon] || (s.population ? 3 : 6), apex: level === 'carnivore2' || undefined },
      eats: [], genome, flags, native: s.native, iucn: s.iucn, catalogKey: s.key, roles: s.roles, taxon: s.taxon, massKg: s.mass,
      stratum: s.strata || null, activity: s.activity || null,
      hue: Math.round((hash(s.key) - 0.5) * 40),
      behavior: roleLine(s), weakness: '', note: codexNote(s, cat),
      tweaks: T.SpriteTweaks ? T.SpriteTweaks.forSpecies(s, cat) : null,   // P3-ART sprite
    };
  };

  const IUCN = { LC: 'Least Concern', NT: 'Near Threatened', VU: 'Vulnerable', EN: 'Endangered', CR: 'Critically Endangered', DD: 'Data Deficient' };
  function roleLine(s) {
    const r = s.roles.filter(x => x !== 'small mammal')[0] || s.level;
    const food = s.level === 'decomposer' ? 'dead matter' : s.diet.plant >= 0.7 ? 'plants' : s.diet.inv >= 0.5 ? 'invertebrates' : s.diet.meat >= 0.5 ? 'other animals' : 'plants and animals';
    return r[0].toUpperCase() + r.slice(1) + '; eats mostly ' + food + '.';
  }
  function codexNote(s, cat) {
    const bits = [(s.native ? 'Native' : 'Non-native') + ' to the ' + cat.name + ' (' + cat.code + ')'];
    if (s.iucn && IUCN[s.iucn]) bits.push('IUCN: ' + IUCN[s.iucn]);
    if (s.level !== 'producer') bits.push('about ' + (s.mass >= 1 ? s.mass.toFixed(s.mass >= 10 ? 0 : 1) + ' kg' : Math.round(s.mass * 1000 * 10) / 10 + ' g'));
    bits.push('traits: ' + s.traits);
    return s.sci + '. ' + bits.join(' · ') + '. Behaviour in the simulation is simplified.';
  }

  // ---------- the food web ----------

  // Who eats whom in this cast, from real diets: plant-eaters by habit, invertebrate-eaters on the small taxa,
  // vertebrate predators on prey within a plausible size range, scavengers on carrion, decomposers on detritus.
  Cat.foodWeb = function (defs, entries, producers) {
    const byHabit = h => producers.filter(p => p.habit === h).map(p => p.id);
    const grass = byHabit('grass'), forb = byHabit('forb'), shrub = byHabit('shrub'), tree = byHabit('tree'), vine = byHabit('vine'), aquatic = byHabit('aquatic');
    const E = new Map(entries.map(e => [e.key, e]));
    for (const d of defs) {
      const s = E.get(d.catalogKey);
      const eats = new Set();
      if (d.level === 'decomposer') { eats.add('detritus'); eats.add('carrion'); d.eats = [...eats]; continue; }
      if (s.diet.plant >= 0.25) {
        const t = s.taxon;
        const add = ids => ids.forEach(x => eats.add(x));
        if (s.roles.includes('pollinator') || s.diet.nectar >= 0.3) eats.add('fruit');
        if (t === 'bovid') { add(grass); add(forb); }
        else if (t === 'cervid') { add(grass); add(forb); add(shrub); add(tree); }
        else if (t === 'grasshopper') { add(grass); add(forb); }
        else if (['rodent', 'lagomorph', 'gamebird', 'snail', 'turtle', 'bug', 'beetle', 'mammal'].includes(t)) { add(grass); add(forb); eats.add('fruit'); }
        else if (t === 'waterfowl' || t === 'fish') { add(aquatic); add(grass); }
        else if (['songbird', 'woodpecker', 'butterfly', 'bee', 'fly', 'ant'].includes(t)) eats.add('fruit');
        else { add(forb); eats.add('fruit'); }
        if (vine.length && eats.has('fruit')) add(vine);
      }
      if (s.diet.scav >= 0.2 || s.roles.includes('scavenger')) eats.add('carrion');
      if (s.diet.meat >= 0.2) {
        const prey = [];
        for (const o of defs) {
          if (o === d || o.level === 'carnivore2') continue;
          const p = E.get(o.catalogKey);
          const ratio = p.mass / s.mass;
          const smallPrey = p.population || p.mass < 0.005;
          if (smallPrey) {
            // Invertebrate-eaters take the small taxa smaller than themselves.
            if (s.diet.inv >= 0.3 && p.mass < s.mass && o.level !== 'carnivore1' || (s.diet.inv >= 0.3 && p.group === 'arachnid' && s.mass > p.mass * 10)) prey.push(o.id);
          } else if (s.diet.meat - s.diet.inv >= 0.2 || d.level === 'carnivore2') {
            // Vertebrate predators: prey from a small fraction of their size up to about their own (apex: bigger).
            const hi = d.level === 'carnivore2' ? 6 : 1.1;
            if (ratio >= 0.004 && ratio <= hi && p.family !== s.family) prey.push(o.id);
          }
        }
        prey.forEach(x => eats.add(x));
      }
      d.eats = [...eats];
    }
    return defs;
  };

  // Starting numbers for individual vertebrates: the world's budget split by level, then within a level by body
  // size (smaller species are more numerous), with enough of each to find mates. Pool-only species stay at 0.
  Cat.shareBudget = function (defs) {
    const ind = defs.filter(d => !d.flags.population && d.startPop > 0);
    for (const lv in B.budgetShare) {
      const list = ind.filter(d => d.level === lv);
      if (!list.length) continue;
      const total = B.vertebrateBudget * B.budgetShare[lv];
      // Predators thin out faster with size than prey do.
      const w = list.map(d => Math.pow(Math.max(0.01, d.massKg), lv === 'carnivore1' || lv === 'carnivore2' ? -0.5 : -0.25));
      const sum = w.reduce((a, b) => a + b, 0);
      list.forEach((d, k) => { d.startPop = Math.max(lv === 'carnivore2' ? 2 : 6, Math.round((total * w[k]) / sum)); });
    }
  };

  // ---------- a whole roster ----------

  // Draw a cast for a scenario (or Sandbox) and turn it into a roster createWorld accepts.
  Cat.roster = function (cat, scenario, seed, avoid) {
    const slots = scenario ? scenario.slots : T.SANDBOX_SLOTS;
    const rng = new T.RNG(seed);
    const fills = Cat.draw(cat, slots, rng, avoid);
    const producers = [], animals = [], entries = [], pool = [];
    for (const f of fills) {
      for (const s of f.species) {
        entries.push(s);
        if (s.level === 'producer') {
          const d = Cat.producerDef(s, cat, producers.length, f.slot.startShare === 'dominant' ? 20 : f.slot.start === 'seedbank' ? 0.15 : 1);
          if (f.slot.start === 'seedbank') d.seedbank = true;   // weighted up in tiles' seed banks
          producers.push(d);
        }
        else {
          const d = Cat.speciesDef(s, cat);
          d.slot = f.slot.id || f.slot.role;
          if (f.slot.start === 'pool') { d.startPop = 0; pool.push(d.id); }
          if (f.slot.invader) d.invasive = true;
          if (f.slot.interior) d.flags.interior = true;   // nests only in interior woodland
          if (f.slot.domestic) d.domestic = true;   // livestock: managed, not wildlife
          animals.push(d);
        }
      }
    }
    Cat.foodWeb(animals, entries, producers);
    Cat.shareBudget(animals);
    return {
      mode: 'catalog', ecoregion: cat.code, scenario: scenario ? scenario.id : null, seed, seedString: Cat.seedString(cat.code, scenario && scenario.id, seed),
      biome: Cat.biome(cat), producers, species: animals, pool, fills: fills.map(f => ({ slot: f.slot.id || f.slot.role, keys: f.species.map(s => s.key) })),
    };
  };

  // Draw, then run the stability test; when it fails, redraw only the slots whose species failed (went extinct or
  // took over), keeping everything else. Synchronous; for tools. The browser runs the same loop a step at a time.
  Cat.rosterStable = function (cat, scenario, seed, maxAttempts, rounds) {
    const slots = scenario ? scenario.slots : T.SANDBOX_SLOTS;
    const avoid = slots.map(() => new Set());
    let roster, test, attempt = 0;
    for (attempt = 1; attempt <= (maxAttempts || 6); attempt++) {
      roster = Cat.roster(cat, scenario, seed + (attempt - 1) * 7919, avoid);
      test = new T.Gen.StabilityTest(roster, seed, roster.biome, rounds);
      while (!test.step(1e9));
      if (test.pass) break;
      const failed = new Set(test.failedIds || []);
      roster.species.forEach(d => {
        if (!failed.has(d.id)) return;
        const k = slots.findIndex(sl => (sl.id || sl.role) === d.slot);
        if (k >= 0) avoid[k].add(d.catalogKey);
      });
    }
    return { roster, attempt: Math.min(attempt, maxAttempts || 6), pass: test.pass, reason: test.reason };
  };
})(window.Trophic);
