// Keystone — Phase 2 gene schema. Every individual carries a Float32Array genome indexed by T.G.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';

  // cat = editor filter group, tag = card label, step = one "level" (Guided mutation moves the mean by one step),
  // upkeep = EU/tick per unit of gene value before BALANCE.upkeepScale, discrete = inherited from one parent.
  const GENES = [
    { key: 'size', name: 'Body size', cat: 'Body', tag: 'BODY', min: 0.3, max: 15, def: 3, step: 1, mp: 3, upkeep: 0, upkeepText: 'Kleiber', rel: true,
      effect: '+1 mass: more HP, bite and energy storage; basal upkeep grows with mass^0.75.' },
    { key: 'fat', name: 'Fat reserves', cat: 'Body', tag: 'BODY', min: 0, max: 4, def: 0, step: 1, mp: 2, upkeep: 0.002,
      effect: '+15% max energy storage, −5% speed.' },
    { key: 'repro', name: 'Reproduction · K', cat: 'Body', tag: 'LIFE', min: 0, max: 1, def: 0.5, step: 0.1, mp: 2, upkeep: 0,
      effect: 'Low = many cheap young (r). High = few strong young that grow slowly (K).' },
    { key: 'longevity', name: 'Longevity', cat: 'Body', tag: 'LIFE', min: 2, max: 6, def: 3.5, step: 0.5, mp: 2, upkeep: 0,
      effect: 'Lifespan in rounds. Upkeep rises 2% per round after maturity.' },
    { key: 'mutability', name: 'Mutability', cat: 'Body', tag: 'LIFE', min: 0.5, max: 2, def: 1, step: 0.1, mp: 2, upkeep: 0,
      effect: 'Multiplies the mutation rate of this lineage\'s young.' },
    { key: 'hibernation', name: 'Hibernation', cat: 'Body', tag: 'SPECIAL', min: 0, max: 1, def: 0, step: 1, mp: 5, upkeep: 0, special: true,
      effect: 'Above 0.5: upkeep −70% in winter, but no activity.' },

    { key: 'speed', name: 'Speed', cat: 'Move & sense', tag: 'MOVE', min: 0, max: 8, def: 0, step: 1, mp: 2, upkeep: 0.010,
      effect: '+8% move speed.' },
    { key: 'senses', name: 'Senses', cat: 'Move & sense', tag: 'SENSE', min: 0, max: 6, def: 0, step: 1, mp: 2, upkeep: 0.005,
      effect: '+10% sight and smell radius.' },
    { key: 'camo', name: 'Camouflage', cat: 'Move & sense', tag: 'SENSE', min: 0, max: 4, def: 0, step: 1, mp: 3, upkeep: 0.004,
      effect: '−15% chance to be detected.' },
    { key: 'flight', name: 'Flight', cat: 'Move & sense', tag: 'SPECIAL', min: 0, max: 1, def: 0, step: 1, mp: 8, upkeep: 0, special: true,
      effect: 'Above 0.5: ignores water, +15% speed, +50% basal upkeep.' },
    { key: 'echolocation', name: 'Echolocation', cat: 'Move & sense', tag: 'SPECIAL', min: 0, max: 1, def: 0, step: 1, mp: 6, upkeep: 0.004, special: true,
      effect: 'Above 0.5: sees through cover and camouflage.' },

    { key: 'diet', name: 'Diet · meat share', cat: 'Diet', tag: 'DIET', min: 0, max: 1, def: 0, step: 0.1, mp: 1, upkeep: 0, upkeepText: 'free',
      effect: 'Shifts 10% between plant and meat. Plants below 0.7, meat from 0.3.' },
    { key: 'plantGut', name: 'Plant gut', cat: 'Diet', tag: 'DIET', min: 0, max: 5, def: 0, step: 1, mp: 3, upkeep: 0.004,
      effect: '+0.05 plant assimilation.' },
    { key: 'meatGut', name: 'Meat gut', cat: 'Diet', tag: 'DIET', min: 0, max: 3, def: 0, step: 1, mp: 3, upkeep: 0.004,
      effect: '+0.05 meat assimilation.' },
    { key: 'metabolism', name: 'Metabolism', cat: 'Diet', tag: 'DIET', min: 0, max: 1, def: 0, step: 1, mp: 4, upkeep: 0, upkeepText: 'toggle', discrete: true,
      effect: 'Endotherm: full winter activity. Ectotherm: P +0.08 but −40% speed below 60% light.' },
    { key: 'symbiotic', name: 'Symbiotic gut', cat: 'Diet', tag: 'SPECIAL', min: 0, max: 1, def: 0, step: 1, mp: 7, upkeep: 0.004, special: true,
      effect: 'Above 0.5: +0.15 plant assimilation.' },

    { key: 'bite', name: 'Bite / claws', cat: 'Offense', tag: 'OFFENSE', min: 0, max: 6, def: 0, step: 1, mp: 3, upkeep: 0.006,
      effect: '+12% damage.' },
    { key: 'venom', name: 'Venom', cat: 'Offense', tag: 'OFFENSE', min: 0, max: 3, def: 0, step: 1, mp: 5, upkeep: 0.010,
      effect: 'Damage over time; prey slows.' },
    { key: 'ambush', name: 'Ambush', cat: 'Offense', tag: 'SPECIAL', min: 0, max: 1, def: 0, step: 0.25, mp: 2, upkeep: 0,
      effect: 'Up to double damage on unaware prey when striking from tall cover.' },

    { key: 'armor', name: 'Armor', cat: 'Defense & social', tag: 'DEFENSE', min: 0, max: 5, def: 0, step: 1, mp: 3, upkeep: 0.008,
      effect: '−10% damage taken.' },
    { key: 'spines', name: 'Spines / toxin', cat: 'Defense & social', tag: 'DEFENSE', min: 0, max: 3, def: 0, step: 1, mp: 4, upkeep: 0.006,
      effect: 'Reflects 15% damage to attackers.' },
    { key: 'social', name: 'Sociality', cat: 'Defense & social', tag: 'SOCIAL', min: 0, max: 4, def: 0, step: 1, mp: 4, upkeep: 0.003,
      effect: 'Herd (shared vigilance) for plant-eaters, pack (coordinated hunts) for meat-eaters.' },
    { key: 'burrow', name: 'Burrowing', cat: 'Defense & social', tag: 'SPECIAL', min: 0, max: 1, def: 0, step: 0.25, mp: 2, upkeep: 0,
      effect: 'Chance to vanish into a burrow when chased.' },
    { key: 'charge', name: 'Charge', cat: 'Defense & social', tag: 'SPECIAL', min: 0, max: 1, def: 0, step: 0.25, mp: 2, upkeep: 0,
      effect: 'Turns and fights predators that are not much bigger.' },

    { key: 'boldness', name: 'Boldness', cat: 'Behavior', tag: 'BEHAVIOR', min: 0.3, max: 1, def: 0.6, step: 0.1, mp: 2, upkeep: 0, upkeepText: 'no upkeep',
      effect: 'Flee distance: 0.3 = runs at full sight range, 1.0 = waits until 30% of sight.' },
    { key: 'aggression', name: 'Aggression', cat: 'Behavior', tag: 'BEHAVIOR', min: 0.1, max: 0.6, def: 0.3, step: 0.05, mp: 2, upkeep: 0, upkeepText: 'no upkeep',
      effect: 'Higher = starts hunting while less hungry.' },
    { key: 'cohesion', name: 'Cohesion', cat: 'Behavior', tag: 'BEHAVIOR', min: 0, max: 1, def: 0.5, step: 0.1, mp: 2, upkeep: 0, upkeepText: 'no upkeep',
      effect: 'How strongly herd or pack mates stay together.' },
    { key: 'roam', name: 'Roam radius', cat: 'Behavior', tag: 'BEHAVIOR', min: 3, max: 12, def: 6, step: 1, mp: 1, upkeep: 0, upkeepText: 'no upkeep',
      effect: 'Wander radius in tiles.' },

    { key: 'limbs', name: 'Limbs', cat: 'Body plan', tag: 'PLAN', min: 2, max: 6, def: 4, step: 1, mp: 1, upkeep: 0, discrete: true, upkeepText: 'cosmetic',
      effect: 'Body plan. Drifts freely between lineages.' },
    { key: 'tail', name: 'Tail', cat: 'Body plan', tag: 'PLAN', min: 0, max: 3, def: 1, step: 1, mp: 1, upkeep: 0, discrete: true, upkeepText: 'cosmetic',
      effect: 'Stub, whip, blade or club.' },
    { key: 'head', name: 'Head', cat: 'Body plan', tag: 'PLAN', min: 0, max: 2, def: 0, step: 1, mp: 1, upkeep: 0, discrete: true, upkeepText: 'cosmetic',
      effect: 'Round head, wedge snout or long snout.' },
    { key: 'coat', name: 'Coat', cat: 'Body plan', tag: 'PLAN', min: 0, max: 3, def: 0, step: 1, mp: 1, upkeep: 0, discrete: true, upkeepText: 'cosmetic',
      effect: 'Plain, spotted, striped or banded.' },
  ];
  // Neutral markers: no effect, drift freely, used to measure relatedness.
  for (let k = 0; k < 8; k++) GENES.push({ key: 'm' + k, name: 'Marker ' + k, cat: 'hidden', tag: 'MARKER', min: 0, max: 1, def: 0.5, step: 0.1, mp: 0, upkeep: 0, marker: true });

  const G = {};
  GENES.forEach((g, i) => { g.i = i; G[g.key] = i; });
  T.GENES = GENES;
  T.G = G;
  T.NG = GENES.length;
  T.GENE_BY_KEY = {};
  GENES.forEach(g => (T.GENE_BY_KEY[g.key] = g));
  T.GENE_CATS = ['Body', 'Move & sense', 'Diet', 'Offense', 'Defense & social', 'Behavior', 'Body plan'];
  T.BUYABLE_GENES = GENES.filter(g => !g.marker);

  T.TAILS = ['Stub tail', 'Whip tail', 'Blade tail', 'Club tail'];
  T.HEADS = ['Round head', 'Wedge snout', 'Long snout'];
  T.COATS = ['Plain coat', 'Spotted coat', 'Striped coat', 'Banded coat'];
  T.COAT_WORDS = ['plain', 'spots', 'stripes', 'bands'];

  T.newGenome = function () {
    const g = new Float32Array(T.NG);
    for (const d of GENES) g[d.i] = d.def;
    return g;
  };

  T.clampGene = function (i, v) {
    const d = GENES[i];
    v = v < d.min ? d.min : v > d.max ? d.max : v;
    return d.discrete ? Math.round(v) : v;
  };

  // Phase 1-style genome object (diet 0–10, repro 0–10, organs, flags) -> Phase 2 genome.
  T.genomeFrom = function (obj, flags, level) {
    const g = T.newGenome();
    obj = obj || {};
    flags = flags || {};
    const set = (k, v) => { if (v != null && !Number.isNaN(v)) g[G[k]] = T.clampGene(G[k], v); };
    for (const k of ['size', 'fat', 'speed', 'senses', 'camo', 'plantGut', 'meatGut', 'bite', 'venom', 'armor', 'spines', 'social',
      'boldness', 'aggression', 'cohesion', 'roam', 'longevity', 'limbs', 'tail', 'head', 'coat', 'ambush', 'burrow', 'charge', 'mutability']) {
      if (typeof obj[k] === 'number') set(k, obj[k]);
    }
    // Hand-authored defs and Phase 1 saves use 0–10 for diet and reproduction.
    if (typeof obj.diet === 'number') set('diet', obj.diet / 10);
    if (typeof obj.repro === 'number') set('repro', obj.repro / 10);
    if (obj.metabolism != null) set('metabolism', obj.metabolism === 'ecto' || obj.metabolism === 1 ? 1 : 0);
    const o = obj.organs || {};
    for (const k of ['flight', 'echolocation', 'hibernation', 'symbiotic']) if (o[k] || obj[k] === 1) set(k, 1);
    if (flags.ambush) set('ambush', 1);
    if (flags.burrow) set('burrow', 1);
    if (flags.charge) set('charge', 1);
    if (flags.skittish) set('boldness', 0.3);
    if (flags.pack && typeof obj.cohesion !== 'number') set('cohesion', 0.8);
    if (level && typeof obj.aggression !== 'number') set('aggression', level === 'carnivore2' ? 0.4 : level === 'carnivore1' ? 0.35 : 0.25);
    if (typeof obj.head !== 'number') set('head', g[G.diet] >= 0.5 ? (g[G.bite] >= 2 ? 2 : 1) : 0);
    if (typeof obj.coat !== 'number' && g[G.camo] > 0) set('coat', 1);
    return g;
  };

  // A sampled individual around a species genome (founder variance).
  T.sampleGenome = function (base, rng, sigmaFrac) {
    const g = new Float32Array(T.NG);
    for (const d of GENES) {
      let v = base[d.i];
      if (d.marker) v = base[d.i] + rng.gauss() * 0.05;
      else if (d.discrete) v = rng.next() < 0.04 ? v + (rng.next() < 0.5 ? -1 : 1) : v;
      else if (d.special && v === 0) v = 0;
      else if (d.rel) v = v * (1 + rng.gauss() * sigmaFrac * 1.5);   // body size varies relative to itself
      else v = v + rng.gauss() * sigmaFrac * (d.max - d.min);
      g[d.i] = T.clampGene(d.i, v);
    }
    return g;
  };

  // Genome -> plain view object used by the sprite drawer and UI.
  T.geneView = function (g) {
    const v = {};
    for (const d of GENES) if (!d.marker) v[d.key] = g[d.i];
    return v;
  };

  T.fmtGene = function (key, v) {
    const d = T.GENE_BY_KEY[key];
    if (key === 'metabolism') return v >= 0.5 ? 'Ectotherm' : 'Endotherm';
    if (key === 'tail') return T.TAILS[Math.round(v)];
    if (key === 'head') return T.HEADS[Math.round(v)];
    if (key === 'coat') return T.COATS[Math.round(v)];
    if (key === 'limbs') return Math.round(v) + ' limbs';
    if (d && d.step < 1) return v.toFixed(2);
    return v.toFixed(2);
  };

  // Base64 packing for Float32Array saves (browser and Node).
  T.b64 = {
    encode(f32) {
      const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
      if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    },
    decode(str) {
      let u8;
      if (typeof Buffer !== 'undefined') { const b = Buffer.from(str, 'base64'); u8 = new Uint8Array(b.buffer, b.byteOffset, b.length); u8 = new Uint8Array(u8); }
      else { const s = atob(str); u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); }
      return new Float32Array(u8.buffer);
    },
  };
})(window.Trophic);
