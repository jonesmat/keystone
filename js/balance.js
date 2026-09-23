// Keystone — all tuning parameters (GDD "Balancing and tuning parameters").
// Kept as a JS file instead of balance.json so the game runs from file:// without a server.
window.Trophic = window.Trophic || {};

Trophic.BALANCE = {
  version: 1,

  // World
  worldSize: 64,            // tiles per side
  tilePx: 16,               // world pixels per tile (renderer)
  ticksPerSecond: 10,
  roundTicks: 1200,         // 120 s at 1x
  maxConsumers: 2000,

  // Sunlight
  sunlightPerTile: 10,      // EU per tile per tick at 100% light
  seasons: [
    { name: 'Spring', light: 1.10 },
    { name: 'Summer', light: 1.30 },
    { name: 'Autumn', light: 0.90 },
    { name: 'Winter', light: 0.50 },
  ],
  waterLight: 0.80,         // open water -20%
  canopyShade: 0.40,        // max shade from tall neighbours (-40%)

  // Producers
  C_photo: 0.20,            // Phase 2 value; Phase 3 reads it from the energy mode
  R_plant: 0.50,            // fallback for producers without their own resp trait
  leafFloor: 0.25,          // logistic regrowth: grazed-down plants capture less light
  nutrientStart: 0.75,
  nutrientUse: 0.0004,      // nutrient drawn per EU stored
  nutrientReturn: 0.004,    // nutrient returned per EU of detritus decomposed
  detritusDecay: 0.02,      // fraction of detritus respired by soil microbes per tick
  nutrientBaseline: 0.55,   // soil weathering slowly pulls nutrients toward this
  nutrientWeathering: 0.0005,
  grazeFloor: 0.12,         // grazers leave this fraction of a plant's max as rootstock
  fruitShare: 0.35,         // share of Bloomvine growth that becomes fruit in spring/summer
  fruitBonusA: 0.20,

  // Consumers — digestion (interpolated by diet: 0 = pure plant, 0.5 = omnivore, 1 = pure meat)
  plantA: [0.50, 0.35, 0.20],
  meatA: [0.60, 0.70, 0.80],
  levelP: [0.30, 0.28, 0.18],   // GDD 0.25 omnivores / 0.15 carnivores, tuned up so higher levels stay playable
  apexP: 0.14,                  // GDD 0.12
  meatStorageCut: 0.5,          // max EU per mass shrinks by up to 50% for pure meat-eaters (not apex)
  apexRestUpkeep: 0.6,          // apex predators' basal upkeep multiplier
  endothermP: 0.00,         // GDD default −0.05; 0 (inside the −0.10..0 test range) keeps carnivores viable
  ectothermP: +0.08,
  ectoColdLight: 0.60,      // Phase 2: below 60% light ectotherms slow down
  ectoColdSpeed: 0.60,      // -40% speed
  // Phase 3: ectotherm speed and eat rate follow air temperature; below freezing they go torpid.
  ectoFullTemp: 25,         // °C at which ectotherms reach full speed and eat rate
  ectoMinPerf: 0.3,         // performance just above freezing
  ectoTorpidTemp: 0,        // °C below which ectotherms go torpid (rest, 30% upkeep)
  decomposerA: 0.60,
  decomposerP: 0.30,

  // Upkeep (U = k * M^0.75 + traits + activity)
  k: 0.02,
  kleiber: 0.75,
  // Sim-scale multiplier on all upkeep so EU budgets feel tight at the chosen body-energy scale.
  upkeepScale: 6,
  activityCost: 0.3,        // extra fraction of basal cost at full speed

  // Bodies
  energyPerMass: 400,       // max EU per unit mass
  hpPerMass: 10,
  eatRate: 20,              // EU eaten per tick = eatRate * M^0.75
  biteCoef: 4,              // damage per attack = biteCoef * M^0.75
  attackInterval: 5,        // ticks between attacks
  healPerTick: 0.004,       // fraction of max HP healed per tick when fed
  healCost: 1.0,            // EU per HP healed
  chaseLimit: 70,           // ticks before a hunter gives up
  sprintTicks: 35,          // hunters sprint at the start of a chase...
  sprintMult: 1.35,         // ...at this multiple of their speed (prey flee at 1.15)
  preyRarity: 20,           // Type III response: prey species with n individuals get n/(n+20) hunting attention
  ironbarkHandling: 0.25,   // eat-rate multiplier for eaters under mass 8

  starvationThreshold: 0.20,
  breedingThreshold: 0.70,
  offspringShare: 0.40,
  minYoungEnergy: 0.15,     // litters shrink so each young starts with at least this share of max EU
  carrionDecay: 0.01,       // per tick, into detritus
  decisionInterval: 5,      // ticks between utility-AI re-evaluations (0.5 s)

  // Directives
  directiveDuration: 150,
  directiveCooldown: 300,
  territoryRadius: 8,       // tiles

  // Round loop
  mpBase: 5,
  mpPerOffspring: 4,        // 1 MP per 4 offspring
  mpEnergyDivisor: 5000,    // 1 MP per this many EU banked (GDD 500, rescaled for body-energy scale)
  mpPerRival: 3,
  mpCap: 25,
  mpAdaptive: 3,
  cardDiscount: 0.30,
  rareCardChance: 0.05,
  rerollCost: 2,
  devolveRefund: 0.50,
  maxRounds: 30,
  rivalDefeatFrac: 0.10,
  rivalDefeatRounds: 2,
  collapseFrac: 0.15,
  collapseRounds: 2,
  dominanceShare: 0.35,
  apexShare: 0.50,
  apexRounds: 3,
  eventStartRound: 4,
  eventChance: 0.25,

  // Score
  scoreEnergyDivisor: 100,  // score counts assimilated EU / 100
  scorePerRival: 1000,
  scoreVictory: 5000,
  scorePerRound: 100,

  // ---------- Phase 2: living genomes ----------
  mutationRate: 0.15,       // μ: chance per gene per birth
  mutationSigma: 0.04,      // σ as a fraction of the gene's range
  markerRate: 0.35,         // neutral markers mutate more often, so relatedness is measurable
  markerSigma: 0.08,
  founderSigma: 0.06,       // starting populations sampled around the founder genome
  mateRadius: 4,            // tiles
  loneRadius: 8,            // no conspecific this close for loneTicks → asexual clone
  loneTicks: 200,
  juvenileMass: 0.4,        // young are born at 40% of adult mass
  juvenileUpkeep: 1.2,      // growth is paid as extra upkeep
  agingUpkeep: 0.02,        // +2% upkeep per round after maturity
  lifespanMult: 3,          // scales the longevity gene into ticks (1 = gene value in rounds; 3 keeps predators viable)
  densityShare: 0.15,       // above 15% of the entity budget, breeding gets harder
  densityStep: 0.05,        // +5 threshold points per extra 5% of the budget
  decomposerCap: 150,       // decomposers above this stop breeding (soil microbes carry the rest)
  rescuePop: 10,            // below this, μ doubles (evolutionary rescue)
  pressureThreshold: 0.60,  // Selection pressure: top 25% breed at this energy share
  pressureCost: 2,          // MP per pinned gene (max 2)
  focusCost: 3,             // MP per Mutation focus (max 2)
  championCost: 2,
  championShare: 1.2,       // a Champion's young take +20% of its EU
  cullCooldown: 300,        // ticks
  speciationMinPop: 16,
  speciationMinCluster: 8,
  speciationDistance: 0.55,   // GDD draft said 0.35; ordinary unimodal populations measure ~0.25–0.3
  speciationHold: 2,        // rounds the gap must hold
  speciationGeneScale: 0.1, // distance unit = 10% of each gene's range
  speciesCap: 24,
  producerMutation: 0.05,   // σ for producer tile genes when a tile reseeds from a neighbour
  preySwitchFrac: 0.2,
  predatorGraceRounds: 2,   // NPC predators ignore the player's lineage in rounds 1–2 (tutorial introduces them in round 3)
  dominanceLimit: 0.6,      // stability test: no species above this share of consumer biomass (design draft said 40%)
  rolledFounderMP: 5,
  customFounderMP: 40,
  descendantShare: 0.25,
  whatEvolvedLevels: 0.25,  // report mean shifts above this many levels

  // ---------- Phase 3: textbook energy chain ----------
  // GPP -> plant respiration -> NPP -> harvesting -> assimilation -> metabolism -> tissue growth (NSP).
  legacyMealP: 0,           // 1 = Phase 2 per-meal P, kept for comparison runs; 0 = all consumer respiration is upkeep
  energyMode: 'game',
  modes: {
    // Game: scaled efficiencies that keep endotherm predators viable on a 64 x 64 map.
    game:    { id: 'game',    name: 'Game',    C_photo: 0.20, sunMult: 3,  thermoScale: 1 },
    // Realism: the textbook's ranges; sunlight x 20 of Game's so absolute EU stay workable at 1% capture.
    // sunMult is 3 in Game because only a third of NPP is edible (edibleDefault), so grazers see Phase 2's growth.
    realism: { id: 'realism', name: 'Realism', C_photo: 0.01, sunMult: 60, thermoScale: 3 },
  },
  plantRespRange: [0.20, 0.75],  // share of GPP a producer respires (NPP efficiency 25–80%)
  edibleDefault: 0.33,      // share of NPP grown as grazeable leaf and fruit; the rest (stems, roots, wood) drops as litter
  litterRate: 0.0005,       // share of standing crop shed as litter per tick, so uneaten NPP feeds decomposers
  bodyTemp: 38,             // endotherm body temperature, °C
  thermoCoef: 0.009,        // c_thermo in U = c × M^0.67 × max(0, T_body − T_air), before upkeepScale (tuned by tools/check-energy.js)
  metabScale: 2.9,          // time-based metabolism that replaces the per-meal P (field metabolic rate)
  levelMetab: { herbivore: 1.0, omnivore: 1.05, carnivore1: 1.0, carnivore2: 0.3, decomposer: 1.0 },   // predators' hunting cost
  apexRestP3: 0.3,          // apex predators rest most of the day: scales their whole metabolism, thermoregulation included
  // Body tissue: energy built into an animal's body (not its reserves). Parents pay for newborns' tissue,
  // juveniles build it as they grow, and a carcass carries tissue plus reserves: the NSP the next level harvests.
  tissuePerMass: 200,       // EU of body tissue per unit of adult mass

  biomes: {
    meadow:  { id: 'meadow',  name: 'Meadow',  light: 1.0, water: 0.09, winter: 0.50, tMean: 10, tAmp: 12 },
    wetland: { id: 'wetland', name: 'Wetland', light: 1.1, water: 0.22, winter: 0.55, tMean: 12, tAmp: 10 },
    taiga:   { id: 'taiga',   name: 'Taiga',   light: 0.7, water: 0.07, winter: 0.35, tMean: -2, tAmp: 16 },
    // Mostly open water around a few islands; the sea keeps temperatures mild.
    channel: { id: 'channel', name: 'Open Channel', light: 1.0, water: 0.9, winter: 0.60, tMean: 12, tAmp: 5, aquatic: true },
  },

  // Pyramids (Phase 3). Standing crop is shown as g/m² by treating a tile as a 1 m² sample plot of its ground
  // or water, at 1 g dry weight per EU. Plant counts come from T.PRODUCER_KINDS[kind].perTile.
  gramsPerEU: 1,
  plantFullAt: 0.5,         // a tile holds its full count of plants once standing crop reaches this share of max

  difficulties: {
    seedling: { name: 'Seedling', npcMu: 0.7, response: 0.5, startMP: 25, scoreMult: 0.75 },
    standard: { name: 'Standard', npcMu: 1.0, response: 1.0, startMP: 20, scoreMult: 1.0 },
    apex:     { name: 'Apex',     npcMu: 1.4, response: 1.5, startMP: 15, scoreMult: 1.5 },
  },
};
