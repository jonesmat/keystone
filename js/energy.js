// Keystone — the textbook energy chain, measured from one round's bookings.
// GPP -> NPP (plant respiration) -> ingested (harvesting) -> GSP (assimilation) -> NSP (tissue growth).
// Pure functions over a World's round stats, so the report, the Codex and tools/check-energy.js share one definition.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';

  const CONSUMER_LEVELS = ['herbivore', 'omnivore', 'carnivore1', 'carnivore2'];
  const LEVELS = ['producer'].concat(CONSUMER_LEVELS, ['decomposer']);

  // Textbook ranges (Unit 5, pp. 192–193) and each mode's target band.
  const BANDS = {
    nppEff:        { text: [0.25, 0.80], game: [0.25, 0.80], realism: [0.25, 0.80], name: 'NPP efficiency' },
    harvest:       { text: [0.05, 0.30], game: [0.10, 0.30], realism: [0.05, 0.30], name: 'Harvesting' },
    assimPlant:    { text: [0.30, 0.60], game: [0.30, 0.60], realism: [0.30, 0.60], name: 'Herbivore assimilation' },
    assimMeat:     { text: [0.60, 0.90], game: [0.60, 0.90], realism: [0.60, 0.90], name: 'Carnivore assimilation' },
    tissueEcto:    { text: [0.20, 0.50], game: [0.20, 0.50], realism: [0.20, 0.50], name: 'Tissue growth, ectotherm' },
    tissueEndo:    { text: [0.01, 0.03], game: [0.06, 0.12], realism: [0.01, 0.03], name: 'Tissue growth, endotherm' },
    // Energy fixed at a level ÷ energy fixed at the level it eats (NPP for plants, GSP for consumers): the energy
    // pyramid's "passed up". Realism's band follows from the textbook's harvesting × assimilation ranges.
    transfer:      { text: [0.015, 0.18], game: [0.08, 0.15], realism: [0.015, 0.18], name: 'Passed up per level' },
    // The textbook's two-level loss: herbivore tissue as a share of GPP (50–2,500 of 100,000).
    twoLevel:      { text: [0.0005, 0.025], game: [0.0005, 0.025], realism: [0.0005, 0.025], name: 'GPP → herbivore tissue' },
  };

  // The textbook's "packet of energy" walk-through, starting from 100,000 units of GPP.
  const TEXTBOOK = [
    { key: 'gpp',       name: 'Gross primary production',      lo: 100000, hi: 100000 },
    { key: 'npp',       name: 'Net primary production',        lo: 50000,  hi: 50000 },
    { key: 'hIngested', name: 'Ingested by herbivores',        lo: 10000,  hi: 10000 },
    { key: 'hGSP',      name: 'Assimilated (GSP)',             lo: 3000,   hi: 6000 },
    { key: 'hNSPecto',  name: 'Herbivore tissue, ectotherm',   lo: 1000,   hi: 2500 },
    { key: 'hNSPendo',  name: 'Herbivore tissue, endotherm',   lo: 50,     hi: 150 },
    { key: 'cIngested', name: 'Ingested by primary carnivores', lo: 2000,  hi: 2000 },
    { key: 'cGSP',      name: 'Assimilated by carnivores',     lo: 1800,   hi: 1800 },
    { key: 'cNSPecto',  name: 'Carnivore tissue, ectotherm',   lo: 360,    hi: 900 },
    { key: 'cNSPendo',  name: 'Carnivore tissue, endotherm',   lo: 18,     hi: 54 },
  ];

  const div = (a, b) => (b > 0 ? a / b : null);

  // Measure one round. Returns producer totals, one row per consumer level, per-species rows,
  // and the chain's named efficiencies (null where a level is empty).
  function measure(w) {
    const pb = w.pbook;
    const prod = { gpp: 0, resp: 0, npp: 0, litter: 0, eaten: 0, byType: [] };
    for (let t = 1; t < w.producers.length; t++) {
      const p = w.producers[t];
      const row = { name: p.name, gpp: pb.gpp[t], resp: pb.resp[t], npp: pb.npp[t], litter: pb.litter[t], eaten: pb.eaten[t] };
      row.nppEff = div(row.npp, row.gpp);
      prod.byType.push(row);
      for (const k of ['gpp', 'resp', 'npp', 'litter', 'eaten']) prod[k] += row[k];
    }
    prod.nppEff = div(prod.npp, prod.gpp);

    const lv = {};
    for (const L of CONSUMER_LEVELS.concat(['decomposer'])) {
      lv[L] = { level: L, species: 0, ingested: 0, from: {}, assimilated: 0, respired: 0, thermo: 0, nsp: 0,
        endo: { assimilated: 0, respired: 0 }, ecto: { assimilated: 0, respired: 0 } };
    }
    const species = [];
    w.species.forEach((sp, i) => {
      const rs = w.rstats[i];
      if (!rs) return;
      const o = lv[sp.level] || lv.herbivore;
      const resp = rs.upkeepHeat + rs.digestHeat;
      const row = {
        id: sp.id, name: sp.name, level: sp.level, ecto: !!(sp.stats && sp.stats.ecto),
        ingested: rs.ingested, assimilated: rs.assimilated, respired: resp, thermo: rs.thermoHeat,
        nsp: rs.assimilated - resp, from: rs.eatenLv,
      };
      row.assim = div(row.assimilated, row.ingested);
      row.tissue = row.assimilated > 0 ? row.nsp / row.assimilated : null;
      species.push(row);
      if (!rs.ingested && !rs.upkeepHeat) return;
      o.species++;
      o.ingested += rs.ingested;
      for (const k in rs.eatenLv) o.from[k] = (o.from[k] || 0) + rs.eatenLv[k];
      o.assimilated += rs.assimilated;
      o.respired += resp;
      o.thermo += rs.thermoHeat;
      const m = row.ecto ? o.ecto : o.endo;
      m.assimilated += rs.assimilated;
      m.respired += resp;
    });

    // Production available to the level above (NPP for producers, NSP for consumers), and energy fixed
    // at each level (NPP for producers, GSP for consumers), which is what the energy pyramid shows.
    const production = { producer: prod.npp };
    const fixed = { producer: prod.npp };
    for (const L in lv) {
      const o = lv[L];
      o.nsp = o.assimilated - o.respired;
      o.assim = div(o.assimilated, o.ingested);
      o.tissue = o.assimilated > 0 ? o.nsp / o.assimilated : null;
      o.tissueEndo = o.endo.assimilated > 0 ? 1 - o.endo.respired / o.endo.assimilated : null;
      o.tissueEcto = o.ecto.assimilated > 0 ? 1 - o.ecto.respired / o.ecto.assimilated : null;
      production[L] = Math.max(0, o.nsp);
      fixed[L] = o.assimilated;
    }
    // Harvesting of a level: how much of its production every consumer together ate.
    const harvestOf = {};
    for (const src of ['producer'].concat(CONSUMER_LEVELS)) {
      let eaten = 0;
      for (const L of CONSUMER_LEVELS) eaten += lv[L].from[src] || 0;
      harvestOf[src] = { eaten, eff: div(eaten, production[src]) };
    }
    // Passed up: energy fixed at a level over energy fixed at the level it mostly eats.
    for (const L of CONSUMER_LEVELS) {
      const o = lv[L];
      let main = null, mv = 0;
      for (const k in o.from) if (k !== 'detritus' && k !== 'other' && k !== 'carrion' && o.from[k] > mv) { mv = o.from[k]; main = k; }
      o.mainFood = main;
      o.transfer = main ? div(o.assimilated, fixed[main]) : null;
    }
    // Primary consumers (herbivores and omnivores) against NPP; predators against the primary consumers.
    const primary = lv.herbivore.assimilated + lv.omnivore.assimilated;
    const predators = lv.carnivore1.assimilated + lv.carnivore2.assimilated;
    const herb = lv.herbivore;
    const endo = { assimilated: 0, respired: 0 }, ecto = { assimilated: 0, respired: 0 };
    for (const L of CONSUMER_LEVELS) {
      endo.assimilated += lv[L].endo.assimilated; endo.respired += lv[L].endo.respired;
      ecto.assimilated += lv[L].ecto.assimilated; ecto.respired += lv[L].ecto.respired;
    }
    const plantEaters = ['herbivore', 'omnivore'].reduce((a, L) => a + (lv[L].from.producer || 0), 0);
    const meatEaters = ['carnivore1', 'carnivore2'];
    let meatIn = 0, meatAs = 0;
    for (const L of meatEaters) { meatIn += lv[L].ingested; meatAs += lv[L].assimilated; }
    // A group holding under 1% of consumer assimilation (a remnant on its way out) is too small to measure.
    const totalAs = endo.assimilated + ecto.assimilated;
    const measurable = x => x.assimilated > 0 && x.assimilated >= 0.01 * totalAs;
    const eff = {
      nppEff: prod.nppEff,
      harvest: harvestOf.producer.eff,
      assimPlant: herb.assim,
      assimMeat: div(meatAs, meatIn),
      tissueEndo: measurable(endo) ? 1 - endo.respired / endo.assimilated : null,
      tissueEcto: measurable(ecto) ? 1 - ecto.respired / ecto.assimilated : null,
      transfer: div(primary, prod.npp),
      transferC1: primary > 0 && predators > 0 ? predators / primary : null,
      twoLevel: herb.assimilated > 0 ? div(Math.max(0, herb.nsp), prod.gpp) : null,
    };
    return { mode: w.mode.id, producers: prod, levels: lv, species, harvestOf, production, fixed, plantEaters, eff };
  }

  // Whether a measured efficiency sits inside the mode's target band (null when unmeasured).
  function inBand(key, v, mode) {
    const b = BANDS[key];
    if (!b || v == null) return null;
    const r = b[mode] || b.text;
    return v >= r[0] && v <= r[1];
  }

  T.Energy = { LEVELS, CONSUMER_LEVELS, BANDS, TEXTBOOK, measure, inBand };
})(window.Trophic);
