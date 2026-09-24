// Keystone — Phase 3 scenarios in the niche-slot format (P3-M4).
// A scenario names an ecoregion catalog and lists niche slots, never species: each world fills every slot with a fresh
// draw of real species from the catalog that fit the slot's role and constraints. Slot fields:
//   role        a catalog role ('grass', 'large grazer', 'mesopredator', 'pollinator', 'nest parasite', …)
//   count       [min, max] species drawn for the slot
//   native      true / false to require native or non-native species (omit for either)
//   status      'threatened' to require an IUCN category of NT, VU, EN or CR; 'endangered' for VU, EN or CR
//   start       'map' (default), 'pool' (in the regional pool only at the start) or 'seedbank' (producers present only as seed)
//   startShare  producers: share of their kind's tiles to start on ('dominant' slots start covering most of the map)
//   strata      animals: the foraging layers allowed (EltonTraits: canopy, midstory, understory, ground, water, air)
//   need        extra constraints on the draw as a whole, e.g. { fixer: 1 } for at least one nitrogen-fixer
//   interior    animals: interior-woodland specialists, which breed only 3 or more tiles from open ground
// A scenario's `damage` sets the conditions the steward inherits and `goals` the restoration targets for round 30
// (see T.Steward.setupScenario and T.Steward.goals).
// `stakeholders` lists stakeholder types the scenario always has (see T.Stakeholders).
//   domestic    a domestic species the slot always holds (cattle), since occurrence data rarely records livestock
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';

  T.DOMESTIC = {
    cattle: {
      key: 'domestic-cattle', sci: 'Bos taurus', common: 'Cattle', group: 'mammal', family: 'Bovidae', order: 'Artiodactyla', native: false, iucn: null,
      level: 'herbivore', roles: ['domestic livestock', 'large grazer'], taxon: 'bovid', mass: 600, diet: { plant: 1, meat: 0, scav: 0 },
      endotherm: true, flight: false, swim: false, activity: 'diurnal', strata: 'ground', population: false, traits: 'breed average (beef cattle)', occupancy: 1,
    },
  };

  // Every world, scenario or Sandbox, gets at least this much of a working community.
  const CORE = [
    { role: 'grass', count: [3, 5], native: true },
    { role: 'forb', count: [3, 6], need: { fixer: 1 } },
    { role: 'small herbivore', count: [4, 8] },
    { role: 'pollinator', count: [2, 4] },
    { role: 'songbird', count: [3, 6] },
    { role: 'insect predator', count: [2, 4] },
    { role: 'raptor', count: [1, 2] },
    { role: 'mesopredator', count: [1, 3] },
    { role: 'decomposer', count: [2, 4] },
  ];

  T.SCENARIOS = [
    {
      id: 'rewilding', name: 'Rewilding the ranch', ecoregion: '9.3', place: 'northeastern Montana',
      start: 'A cattle ranch stocked above K for decades: compacted soil, non-native forage grass monocultures, cattle as nearly the only large herbivore, native grazers and predators gone.',
      goal: 'Phase cattle down, restore native grass cover above 60%, bring back native grazers and then an apex predator.',
      damage: { compaction: 0.6, overstock: { slot: 'livestock', factor: 2.5 } },
      stakeholders: ['rancher', 'conservation'],
      goals: [
        { type: 'mandate', min: 50, text: 'Keep the community with you (mandate ≥ 50%)' },
        { type: 'reduce', slot: 'livestock', max: 0.25, text: 'Phase cattle down to a quarter of the starting herd' },
        { type: 'compaction', max: 0.2, text: 'Loosen compacted soil (mean compaction ≤ 20%)' },
        { type: 'nativeCover', min: 0.6, text: 'Native plant cover above 60%' },
        { type: 'present', slot: 'grazers', text: 'A native grazer re-established' },
        { type: 'present', slot: 'apex', text: 'An apex predator re-established' },
        { type: 'levels', min: 4, text: '4 or more trophic levels' },
      ],
      slots: [
        { id: 'forage', role: 'grass', count: [1, 2], native: false, startShare: 'dominant' },
        { id: 'natives', role: 'grass', count: [3, 6], native: true, start: 'seedbank' },
        { id: 'forbs', role: 'forb', count: [4, 10], native: true, need: { fixer: 1 } },
        { id: 'shrubs', role: 'shrub', count: [1, 2], native: true },
        { id: 'livestock', role: 'domestic livestock', count: [1, 1], domestic: 'cattle' },
        { id: 'grazers', role: 'large grazer', count: [1, 2], native: true, start: 'pool' },
        { id: 'smallHerb', role: 'small herbivore', count: [6, 15] },
        { id: 'pollinators', role: 'pollinator', count: [4, 10] },
        { id: 'birds', role: 'songbird', count: [5, 12] },
        { id: 'parasite', role: 'nest parasite', count: [1, 1] },
        { id: 'raptors', role: 'raptor', count: [2, 4] },
        { id: 'meso', role: 'mesopredator', count: [2, 4] },
        { id: 'apex', role: 'apex predator', count: [1, 1], start: 'pool' },
        { id: 'insectPred', role: 'insect predator', count: [2, 5] },
        { id: 'scavengers', role: 'scavenger', count: [1, 2] },
        { id: 'decomposers', role: 'decomposer', count: [3, 6] },
      ],
    },
    {
      id: 'oldfield', name: 'Old-field restoration', ecoregion: '9.2', place: 'Iowa and Illinois prairie',
      stakeholders: ['farmer'],
      start: 'Abandoned cropland, mostly bare with a seed bank.', goal: 'A tallgrass prairie climax with 4 or more trophic levels.',
      damage: { bare: 0.8 },
      goals: [
        { type: 'climax', min: 0.7, text: 'Native prairie (or later stages) on 70% of the land' },
        { type: 'levels', min: 4, text: '4 or more trophic levels' },
      ],
      slots: CORE.concat([{ role: 'grass', count: [1, 2], native: false }, { role: 'amphibian', count: [1, 2] }]),
    },
    {
      id: 'predator', name: 'Predator return', ecoregion: '6.2', place: 'Greater Yellowstone',
      stakeholders: ['rancher', 'hunters', 'outfitters'],
      start: 'Streamside willow and aspen overbrowsed by abundant elk, with no apex predator.', goal: 'Reintroduce an apex predator and see a trophic cascade restore the producers.',
      damage: { overbrowsed: 0.8, overstock: { slot: 'large grazer', factor: 2 } },
      goals: [
        { type: 'present', slot: 'apex predator', text: 'An apex predator re-established' },
        { type: 'woody', min: 1.3, text: 'Shrub and tree cover 30% above the start (the trophic cascade)' },
      ],
      slots: CORE.concat([
        { role: 'tree', count: [2, 4], native: true }, { role: 'shrub', count: [2, 3], native: true },
        { role: 'large grazer', count: [2, 3], native: true }, { role: 'apex predator', count: [1, 1], start: 'pool' },
        { role: 'scavenger', count: [1, 2] },
      ]),
    },
    {
      id: 'invasive', name: 'Invasive outbreak', ecoregion: '15.4', place: 'Everglades',
      stakeholders: ['outfitters', 'conservation'],
      start: 'A generalist invader drawn from the catalog\'s non-native species, spreading from one corner.', goal: 'Hold native richness at baseline while the invader declines.',
      damage: { corner: 'invader' },
      goals: [
        { type: 'nativeRichness', min: 1, text: 'Native animal richness at or above the start' },
        { type: 'reduce', slot: 'invader', max: 0.5, text: 'The invader below half its starting numbers' },
      ],
      slots: CORE.concat([{ role: 'waterbird', count: [3, 6] }, { role: 'reptile', count: [2, 4] }, { role: 'fish', count: [2, 4] },
        { id: 'invader', role: 'any animal', count: [1, 1], native: false, invader: true }]),
    },
    {
      id: 'songbird', name: 'Endangered songbird', ecoregion: '9.4.6', place: 'Edwards Plateau, Texas Hill Country',
      stakeholders: ['rancher', 'conservation'],
      start: 'A fragmented juniper–oak woodland with an endangered interior-nesting songbird and a nest parasite.', goal: 'Grow the songbird to a self-sustaining population.',
      damage: { fragment: 3 },
      goals: [
        { type: 'grow', slot: 'atRisk', min: 2, atLeast: 20, text: 'The endangered songbird at twice its starting numbers (and at least 20)' },
      ],
      // The Edwards Plateau (Level III 9.4.6) catalog is a rich one (about 500 species), so this world draws a full
      // juniper–oak woodland community: 60–110 species, most of them plants and small taxa.
      slots: [
        { id: 'grasses', role: 'grass', count: [4, 7], native: true },
        { id: 'forbs', role: 'forb', count: [6, 12], native: true, need: { fixer: 1 } },
        { id: 'shrubs', role: 'shrub', count: [3, 6], native: true },
        { id: 'trees', role: 'tree', count: [3, 5], native: true },
        { id: 'vines', role: 'vine', count: [1, 2] },
        { id: 'grazers', role: 'large grazer', count: [1, 3] },
        { id: 'smallHerb', role: 'small herbivore', count: [6, 12] },
        { id: 'pollinators', role: 'pollinator', count: [5, 10] },
        { id: 'birds', role: 'songbird', count: [8, 14] },
        { id: 'atRisk', role: 'songbird', count: [1, 1], status: 'endangered', strata: ['canopy', 'midstory', 'understory'], interior: true },   // an interior-woodland nester
        { id: 'parasite', role: 'nest parasite', count: [1, 1] },
        { id: 'raptors', role: 'raptor', count: [2, 3] },
        { id: 'meso', role: 'mesopredator', count: [2, 4] },
        { id: 'apex', role: 'apex predator', count: [0, 1], start: 'pool' },
        { id: 'insectPred', role: 'insect predator', count: [4, 8] },
        { id: 'reptiles', role: 'reptile', count: [2, 4] },
        { id: 'amphibians', role: 'amphibian', count: [1, 3] },
        { id: 'bats', role: 'bat', count: [1, 2] },
        { id: 'scavengers', role: 'scavenger', count: [1, 2] },
        { id: 'decomposers', role: 'decomposer', count: [3, 5] },
      ],
    },
    {
      id: 'aquifer', name: 'Dry plains aquifer', ecoregion: '9.4', place: 'High Plains over the Ogallala Aquifer',
      stakeholders: ['farmer', 'utility'],
      start: 'Irrigated prairie over a falling water table, with compacted, nitrate-leaching fields.', goal: 'Bring withdrawal down to recharge and stop nitrate runoff.',
      damage: { compaction: 0.4, irrigation: 0.6, aquiferStart: 0.7 },
      goals: [
        { type: 'aquifer', text: 'The water table back at or above the start' },
        { type: 'leaching', text: 'Nitrogen lost no faster than it is fixed' },
      ],
      slots: CORE.concat([{ role: 'large grazer', count: [1, 2], native: true }]),
    },
    {
      id: 'warming', name: 'Warming world', ecoregion: '8.4', place: 'Central Appalachians',
      stakeholders: ['timber'],
      start: 'A temperate hardwood forest under rising CO₂ and a climate envelope moving north.', goal: 'Keep forest cover and richness at 80% of baseline and the map a net carbon sink.',
      goals: [
        { type: 'forest', min: 0.8, text: 'Forest cover at 80% of the start or more' },
        { type: 'richness', min: 0.8, text: 'Species richness at 80% of the start or more' },
        { type: 'sink', text: 'The map a net carbon sink' },
      ],
      slots: CORE.concat([{ role: 'tree', count: [3, 5], native: true }, { role: 'shrub', count: [1, 3], native: true },
        { role: 'large grazer', count: [1, 1], native: true }, { role: 'amphibian', count: [2, 3] }]),
      climateTrend: true,
    },
  ];

  // Sandbox: any ecoregion, a balanced cast drawn from the core slots plus whatever else the catalog offers.
  T.SANDBOX_SLOTS = CORE.concat([
    { role: 'shrub', count: [0, 2] }, { role: 'tree', count: [0, 3] }, { role: 'large grazer', count: [1, 2], native: true },
    { role: 'apex predator', count: [0, 1] }, { role: 'scavenger', count: [0, 1] }, { role: 'reptile', count: [0, 2] }, { role: 'amphibian', count: [0, 2] },
  ]);

  T.scenarioById = id => T.SCENARIOS.find(s => s.id === id) || null;
})(window.Trophic);
