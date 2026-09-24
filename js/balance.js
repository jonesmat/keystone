// Keystone — all tuning parameters (GDD "Balancing and tuning parameters").
// Kept as a JS file instead of balance.json so the game runs from file:// without a server.
window.Trophic = window.Trophic || {};

Trophic.BALANCE = {

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
  R_plant: 0.50,            // fallback for producers without their own resp trait
  leafFloor: 0.25,          // logistic regrowth: grazed-down plants capture less light
  nutrientStart: 0.75,
  detritusDecay: 0.02,      // fraction of detritus respired by soil microbes per tick
  grazeFloor: 0.12,         // grazers leave this fraction of a plant's max as rootstock
  fruitShare: 0.35,         // share of Bloomvine growth that becomes fruit in spring/summer
  fruitBonusA: 0.20,

  // Consumers — digestion (interpolated by diet: 0 = pure plant, 0.5 = omnivore, 1 = pure meat)
  plantA: [0.50, 0.35, 0.20],
  meatA: [0.60, 0.70, 0.80],
  ectoColdSpeed: 0.60,      // cold-snap event: -40% ectotherm speed
  // Ectotherm speed and eat rate follow air temperature; below freezing they go torpid.
  ectoFullTemp: 25,         // °C at which ectotherms reach full speed and eat rate
  ectoMinPerf: 0.3,         // performance just above freezing
  ectoTorpidTemp: 0,        // °C below which ectotherms go torpid (rest, 30% upkeep)
  decomposerA: 0.60,
  decomposerP: 0.30,        // individual decomposers keep 30% of what they assimilate; the rest is respired

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

  // Round loop
  maxRounds: 30,
  collapseFrac: 0.15,
  collapseRounds: 2,
  eventStartRound: 4,
  eventChance: 0.25,

  // Breeding and bodies
  mateRadius: 4,            // tiles
  juvenileMass: 0.4,        // young are born at 40% of adult mass
  agingUpkeep: 0.02,        // +2% upkeep per round after maturity
  lifespanMult: 3,          // scales the longevity gene into ticks (1 = gene value in rounds; 3 keeps predators viable)
  densityShare: 0.15,       // above 15% of the entity budget, breeding gets harder
  densityStep: 0.05,        // +5 threshold points per extra 5% of the budget
  decomposerCap: 150,       // decomposers above this stop breeding (soil microbes carry the rest)
  preySwitchFrac: 0.2,
  dominanceLimit: 0.6,      // stability test: no species above this share of consumer biomass (design draft said 40%)

  // ---------- Phase 3: textbook energy chain ----------
  // GPP -> plant respiration -> NPP -> harvesting -> assimilation -> metabolism -> tissue growth (NSP).
  energyMode: 'game',
  modes: {
    // Game: scaled efficiencies that keep endotherm predators viable on a 64 x 64 map.
    game:    { id: 'game',    name: 'Game',    C_photo: 0.20, sunMult: 3,  thermoScale: 1 },
    // Realism: the textbook's ranges; sunlight x 20 of Game's so absolute EU stay workable at 1% capture.
    // sunMult is 3 in Game because only a third of NPP is edible (edibleDefault), so grazers see Phase 2's growth.
    realism: { id: 'realism', name: 'Realism', C_photo: 0.01, sunMult: 60, thermoScale: 3 },
  },
  edibleDefault: 0.33,      // share of NPP grown as grazeable leaf and fruit; the rest (stems, roots, wood) drops as litter
  litterRate: 0.0005,       // share of standing crop shed as litter per tick, so uneaten NPP feeds decomposers
  bodyTemp: 38,             // endotherm body temperature, °C
  insulationRef: 28,        // body-to-air difference (°C) at the annual mean that thermoCoef was tuned for (the Meadow, 10 °C)
  thermoCoef: 0.009,        // c_thermo in U = c × M^0.67 × max(0, T_body − T_air), before upkeepScale (tuned by tools/check-energy.js)
  metabScale: 2.9,          // time-based metabolism that replaces the per-meal P (field metabolic rate)
  levelMetab: { herbivore: 1.0, omnivore: 1.05, carnivore1: 1.0, carnivore2: 0.3, decomposer: 1.0 },   // predators' hunting cost
  apexRestP3: 0.3,          // apex predators rest most of the day: scales their whole metabolism, thermoregulation included
  // Body tissue: energy built into an animal's body (not its reserves). Parents pay for newborns' tissue,
  // juveniles build it as they grow, and a carcass carries tissue plus reserves: the NSP the next level harvests.
  tissuePerMass: 200,       // EU of body tissue per unit of adult mass

  biomes: {
    meadow:  { id: 'meadow',  name: 'Meadow',  light: 1.0, water: 0.09, winter: 0.50, tMean: 10, tAmp: 12, rain: 60 },
    wetland: { id: 'wetland', name: 'Wetland', light: 1.1, water: 0.22, winter: 0.55, tMean: 12, tAmp: 10, rain: 110 },
    taiga:   { id: 'taiga',   name: 'Taiga',   light: 0.7, water: 0.07, winter: 0.35, tMean: -2, tAmp: 16, rain: 50 },
    // Mostly open water around a few islands; the sea keeps temperatures mild.
    channel: { id: 'channel', name: 'Open Channel', light: 1.0, water: 0.9, winter: 0.60, tMean: 12, tAmp: 5, rain: 80, aquatic: true },
  },

  // ---------- Phase 3: nutrient, water and carbon cycles (js/cycles.js) ----------
  // Tiles update in ten staggered groups, so each tile's cycles step every 10 ticks.
  cycleStagger: 10,
  nitrogen: {
    plant: 0.010,           // N per EU of plant tissue (C:N); legumes are protein-rich
    legume: 0.020,
    plankton: 0.015,
    animal: 0.040,          // N per EU of animal body tissue (protein ~50% of dry weight); reserves hold none
    storeShare: 0.02,       // an animal's N store holds 2% of its tissue N; the surplus is excreted
    legumeCost: 0.15,       // share of a legume's NPP its root-nodule bacteria take
    legumeLeak: 0.003,      // extra N fixed per EU of legume NPP beyond the plant's shortfall, released to the soil as ammonia
    freeFix: 0.00004,       // free-living bacteria, per tile per tick at full warmth and moisture
    lightning: 0.001,       // nitrate per tick on tiles under a storm (5–10% of fixation, per the text)
    urea: 0.02,             // urea → ammonia per tick (mammals; fast)
    uric: 0.003,            // uric acid → ammonia per tick (birds, reptiles, invertebrates; slow)
    nitrify1: 0.004,        // ammonia → nitrite per tick, aerobic soil only
    nitrify2: 0.02,         // nitrite → nitrate per tick
    denitrify: 0.004,       // nitrate → N2 per tick in waterlogged or compacted soil
    sedimentDenit: 0.002,   // nitrate → N2 per tick in the sediments under open water
    toSalt: 0.001,          // dissolved nitrate → nitrate salts per tick in dry soil
    fromSalt: 0.02,         // salts → dissolved nitrate per tick under rain
    nitrateShare: 0.8,      // plants take 80% of their N as nitrate, 20% as ammonia
    startNH4: 0.6, startNO3: 1.5, startSalt: 2.0, startWater: 0.4,   // soil pools per tile at world start
    indexRef: 3,            // soil N (ammonia + nitrate) that reads as 100% on the map's nutrient tint
  },
  water: {
    // rainfall per biome is biome.rain (cm/yr); one round is one year
    unitsPerCm: 0.1,        // soil-water units per cm of rain on a tile
    eventsPerRound: 40,
    eventRadius: [10, 22], eventTicks: [20, 50],
    stormShare: 0.3,        // share of rain events with lightning
    intercept: { ground: 0.1, tall: 0.25, vine: 0.15, woody: 0.4, aquatic: 0, plankton: 0 },
    infiltration: 0.06,     // soil water taken in per tick on loose, covered soil
    fieldCapacity: 0.6, waterlogged: 0.9,
    et: 0.012,              // evapotranspiration per tick at full soil water, warmth and cover
    percolation: 0.004,     // share of water above field capacity draining to groundwater per tick
    capillary: 0.004,       // rise toward 0.85 per tick where the water table is near the surface
    baseflow: 0.002,        // groundwater draining to lakes and streams per tick
    mixing: 0.04,           // open water: share of the difference in dissolved N evened out with a neighbour per tick
  },
  soil: {
    compactK: 0.015,        // compaction per tile of travel per mass^0.75 (large herds pack the soil)
    compactRecover: 0.00008, // per tick, faster under roots
    anaerobicAt: 0.5,       // compaction above this stops nitrification and starts denitrification
    microbeFloor: 0.05,     // soil microbes' decomposition rate with no decomposer guild left (×1 at the starting guild)
    peatShare: 0.4,         // share of decomposing detritus that becomes peat on waterlogged tiles
    peatSlow: 0.2,          // decomposition speed on waterlogged tiles
  },
  carbon: {
    oceanUptake: 0.02,      // carbon absorbed per open-water tile per tick, less as the water warms
  },
  climate: {
    co2Start: 350,          // ppm (the textbook's Keeling curve runs 310 → 360 over 1958–1992)
    ppmPerRound: 10,        // with the trend on; about a doubling in 30 rounds
    sensitivity: 3,         // °C of warming per doubling of CO2
    latGradient: 4,         // °C colder at the map's north edge than its south edge
    tRange: { ground: 14, tall: 11, vine: 12, woody: 8, aquatic: 10, plankton: 10 },   // producers' temperature envelope half-width
  },

  // ---------- Phase 3: Populations (js/populations.js) ----------
  // Small, numerous taxa (soil fauna, decomposers, plankton grazers, insects) aren't simulated as individuals but as
  // Populations: per-tile densities of juveniles, adults and old individuals, with pooled reserves, tissue and nitrogen.
  populations: {
    update: 10,             // ticks between Population updates
    regionEvery: 50,        // ticks between recomputing regions (connected areas) and matching them to the last ones
    occupied: 0.5,          // a tile is part of a region above this many individuals
    breedAt: 0.55,          // reserves (share of full) above which adults breed
    crowdAt: 0.75,          // well-fed tiles above this reserve share send dispersers to their neighbours
    hungryAt: 0.25,         // hungry tiles below this reserve share send dispersers looking for food
    disperse: 0.05,         // share of a tile's individuals dispersing per update
    oldAt: 0.55,            // share of lifespan spent as a breeding adult before post-reproductive age
    seedBlobs: [8, 14], blobRadius: [3, 6],   // small taxa start widespread, so the animals that eat them can find them
    groupRadius: [2, 6],    // vertebrate groups: tiles within this of a member (by roam) make up the group's region
  },

  // ---------- Phase 3: succession and disturbance (js/succession.js) ----------
  // Stages: 0 bare rock, 1 pioneers, 2 grasses and forbs, 3 shrubs and young trees, 4 mature forest.
  succession: {
    every: 60,              // ticks between succession steps (20 per round)
    startSom: 150,          // soil organic matter of an established soil
    som: [0, 0, 20, 45, 70],        // organic matter a tile needs to reach each stage
    nMin: [0, 0, 0.3, 0.8, 1.2],    // mineral nitrogen (ammonium + nitrate) it needs
    humify: 0.004,          // share of the tile's detritus turned into organic matter per step
    mineralize: 0.002,      // share of organic matter lost per step
    pioneerSoil: 0.6,       // organic matter pioneers add per step by weathering rock
    establish: 0.02,        // chance per step that a seed that has arrived establishes (a stage takes 2–4 rounds)
    seedTries: 5,           // neighbouring tiles sampled for seed rain per step
    longSeed: 0.03,         // chance per step of a seed from anywhere on the map
    dispersal: [0, 14, 8, 5, 4],    // seed range in tiles, by stage: fugitives far, climax species near (birds and squirrels carry nuts)
    longevity: [0, 3, 4, 10, 30],   // rounds a tile's producer lives, by stage (shrubs and trees then leave a gap)
    riparianMoist: 0.72,    // grassland and desert tiles this wet can grow gallery woodland (climax + 2)
    natural: true,          // lightning fires and windthrow happen on their own
    fireChance: { grassland: 0.3, desert: 0.1, forest: 0.08, taiga: 0.12, tundra: 0.02, tropSeasonal: 0.15, rainforest: 0.02 },
    fireSize: [30, 160],    // tiles a fire burns
    fireSpread: 0.9,
    fireKill: 0.5,          // share of ground-living Population individuals on a burned tile that die
    burnScar: 2,            // rounds a burn scar stays visible
    floodRise: 0.05,        // elevation above the water line a flood reaches
    windthrowShare: 0.06,   // share of shrub and woodland tiles a windstorm fells
    windthrowChance: 0.15,
  },

  // ---------- Phase 3: interactions (js/interactions.js) ----------
  interactions: {
    outOfReach: 0.3,        // hunting-score multiplier for prey outside the predator's reachable strata
    hostMass: 3,            // warm-blooded animals at least this big carry parasites
    paraCap: 0.02,          // parasite load a host can carry, as a share of its full reserves
    paraInfect: 0.002,      // chance per tick an uninfected host picks up parasites
    paraGrow: 0.004,        // parasites' growth rate on the host (logistic, per tick)
    paraResp: 0.001,        // parasites' respiration per tick (the host's steady cost)
    satedHost: 0.6,         // a follower doesn't flee a host this well fed
    followRange: 20,        // tiles a follower looks for its host
    followNear: 5,          // food within this many tiles of the host is preferred
    flushMass: 5,           // grazers at least this big flush prey for followers
    flushRadius: 2.5,
    flushBonus: 0.5,        // followers catch this much more prey near a host
    trampleMass: 8,         // animals heavier than this trample plants (amensalism)
    trampleK: 0.5,          // EU of plants crushed per unit of mass per tile walked
    pollinatorEvery: 50,    // ticks between updates of where pollinators are
    pollinatorCell: 8,      // tiles per side of a pollinator presence cell (fruit sets within about one cell)
    interiorDist: 3,        // woodland this many tiles from open ground is interior
    parasiteRadius: 5,      // a nest parasite this close to an edge nest can lay in it
    parasitism: 0.5,        // chance it does
    monoShare: 0.35,        // a producer covering this share of land is a monoculture
    pestChance: 0.5,        // chance per round of a pest outbreak in a monoculture
    pestRadius: 6, pestLoss: 0.5,
    exclusionOverlap: 0.8,  // niche overlap above which Gause's principle applies
    exclusionRounds: 3,
  },

  // ---------- Phase 3: the steward (js/steward.js) ----------
  steward: {
    baseIncome: 12,         // SP granted every round
    healthyBonus: 6,        // extra SP in a round that ends with EHI ≥ 70
    harvestValue: 0.3,      // SP per harvested individual × √(body mass in kg); half value when the species is below ½K
    harvestEvery: 100,      // ticks between harvest takes (a round's bag limit is spread over the season)
    controlShare: 0.25,     // share of an invasive species removed per round under control
    reintroduceGroup: 6, translocateGroup: 5,
    exclosureRounds: 3, fenceMass: 2,   // fences keep out animals this size and up
    wetlandRise: 0.08,      // restore wetland reaches ground this far above the water line
    mvpIndividuals: 6, mvpPopulation: 40,   // minimum viable population: breeding adults, or Population individuals
    interiorMin: 0.3,       // interior share of woodland below which the Habitat component falls
    collapseEHI: 30, winEHI: 70,
    scoreRecovered: 40, scoreReintroduced: 40, scoreExtinction: 40,
  },

  // ---------- Phase 3: automatic keystone tests (js/keystone.js) ----------
  keystone: {
    rounds: 3,              // rounds each forked copy runs
    threshold: 0.25,        // a removal that drops richness or diversity by more than this earns a Keystone badge
    top: 10,                // species tested each round, by interaction strength
    changed: 0.5,           // plus any species whose numbers changed by more than this share
    maxItems: 14,
    sliceMs: 6,             // file:// fallback: milliseconds of test work per slice
  },

  // ---------- Phase 3: demography (js/demography.js) ----------
  // The regional pool behind the map edges, emigration above 0.8 K, mating systems and territories.
  demography: {
    immigration: 0.4,       // arrivals per round from a healthy regional pool, for a species at its starting numbers
    apexImmigration: 0.3,   // apex predators arrive this much less often (large ranges, few animals)
    rescue: 6,              // up to this many times more arrivals as a species falls toward zero (the rescue effect)
    groupSize: [2, 3],      // individuals arriving together (a male and female at least); herds use their herd size
    popArrival: 12,
    reintroduce: 6,         // founders released in a reintroduction         // individuals in a Population patch arriving at the edge
    emigrationEvery: 100,   // ticks between emigration checks
    emigrateAt: 0.8,        // share of K above which young adults leave
    emigrateRate: 0.15,     // chance per check for a young adult, reached at 100% of K
    emigrateMax: 0.25,
    alleeRadius: 5,         // explosive breeders need this many others of their kind within this radius to spawn
    alleeCount: 2,
  },

  // Catalog worlds: individual vertebrates at the start, shared out by trophic level (smaller species get more).
  // About what the 64 × 64 map's producers carry at the current energetics; Populations are counted separately.
  vertebrateBudget: 280,
  budgetShare: { herbivore: 0.62, omnivore: 0.23, carnivore1: 0.12, carnivore2: 0.03 },

  // Pyramids (Phase 3). Standing crop is shown as g/m² by treating a tile as a 1 m² sample plot of its ground
  // or water, at 1 g dry weight per EU. Plant counts come from T.PRODUCER_KINDS[kind].perTile.
  gramsPerEU: 1,
  plantFullAt: 0.5,         // a tile holds its full count of plants once standing crop reaches this share of max

  difficulties: {
    seedling: { name: 'Seedling', startSP: 60, income: 1.25, scoreMult: 0.75 },
    standard: { name: 'Standard', startSP: 40, income: 1.0, scoreMult: 1.0 },
    apex:     { name: 'Apex',     startSP: 25, income: 0.8, scoreMult: 1.5 },
  },
};
