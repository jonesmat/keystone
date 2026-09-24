# Keystone

A single-player HTML5 ecosystem game about energy flowing through a living food web. Phase 3 turns it into a stewardship game: you keep a real U.S. ecosystem in balance.

Keystone was called Trophic until Phase 3, and the code still uses `Trophic` as its internal namespace (`window.Trophic`).

- Game design: [Keystone_Game_Design_Document.md](Keystone_Game_Design_Document.md)
- Phase 2 design (living genomes): [Keystone_Phase2_Design_Document.md](Keystone_Phase2_Design_Document.md)
- Phase 3 design (textbook energy flow, ecosystem steward): [Keystone_Phase3_Design_Document.md](Keystone_Phase3_Design_Document.md)
- UI mockups: [Keystone_UI_Design.html](Keystone_UI_Design.html)

Plain HTML5, CSS and vanilla JavaScript. No build step, no dependencies. Fonts come from Google Fonts and fall back to system fonts offline.

## Run it

Open `index.html` in a browser. Everything uses classic `<script>` tags, so it also works from `file://`.

To serve it locally instead (optional):

```bash
node tools/serve.js 8080
```

Add `?debug=1` to show the live energy-ledger check.

The game keeps no backward compatibility while it's in development: saves carry a version (`T.SAVE_VERSION`), and a save from an older version shows a message and isn't loaded. Phase 2's energetics switch and the Phase 1 save migration were removed.

## How it plays

You are the steward of a whole ecosystem, not one of its species. A run is 30 rounds (a round is a year) in a real U.S. ecoregion with its real species, or in one of the fictional worlds (Temperate Meadow, Open Channel, a generated world). Each round:

- **Plan:** spend Stewardship Points on management actions (burns, discing, overseeding natives, reforesting, wetlands, exclosures, reintroductions and more), placed on the map, and set harvest limits. Answer the community's asks and bid on land that comes up for sale.
- **Season:** the simulation runs and the community responds. Nothing is under your direct control.
- **Report:** the Ecosystem Health Index (0–100, from seven textbook components), the energy through the consumers, demography for every species, interactions, keystone tests and your SP income.

Win a scenario by finishing with an average EHI of 70 or more and every restoration goal met. The run ends early if the EHI stays below 30 for 2 rounds, the producers collapse, or the community's mandate stays below 25% for 2 rounds. Species don't evolve: each has a fixed trait sheet.

## Layout

| File | What it does |
| --- | --- |
| `js/balance.js` | Every tuning knob, including Phase 2 evolution, speciation and safeguard parameters |
| `js/genes.js` | The trait schema each species' fixed trait sheet is written in (range, step, upkeep), and helpers |
| `js/data.js` | Trophic levels, the hand-authored Meadow roster, templates, directives, events, tutorial, Codex ecology notes |
| `js/sim.js` | Fixed-step simulation (10 ticks/s): per-individual stats, juveniles, aging, mate-finding, behaviour genes, producer tile genes, microhabitats, energy ledger, versioned saves (older versions are refused, not migrated). Phase 3: GPP/NPP booking per producer, litterfall, upkeep-only metabolism with thermoregulation, body tissue, ectotherm temperature response |
| `js/cycles.js` | Phase 3 nutrient, water and carbon cycles: soil nitrogen pools and their bacteria, legume and free-living fixation, excretion by body plan, the nitrogen ledger, rain events, infiltration, runoff, evapotranspiration, groundwater, compaction, peat, open-water carbon uptake and the CO₂/climate trend |
| `js/populations.js` | Phase 3 two-tier simulation: small taxa as Populations (per-tile densities by age class, pooled reserves, tissue and nitrogen), their feeding, metabolism, births, deaths and dispersal; regions that split and merge with place-based names; herd, pack and flock regions for individually simulated vertebrates |
| `js/demography.js` | Phase 3 demography: the regional pool behind the map edges (immigration with a rescue effect, emigration above 0.8 K, recolonization, regional extinction, reintroduction), carrying capacity per species, exponential/logistic curve labels, the round's N1 = N0 + B + I − D − E table, mating systems with the Allee threshold, territories, age structure, density-dependent disease |
| `js/succession.js` | Phase 3 succession, disturbance and biomes: seral stages per tile (bare rock, pioneers, grasses and forbs, shrubs, mature forest), soil organic matter, seed banks, dispersal and longevity, light gaps, wildfire, flood and windthrow, the Whittaker biome classification and each biome's climax |
| `js/interactions.js` | Phase 3 species interactions and niches: feeding strata and predator reach, niche overlap and Gause's warning, trampling (amensalism), parasite loads and cleaners (protocooperation), commensal followers, pollinator mutualism, edge vs interior woodland with interior specialists and nest parasites, monoculture pests, Shannon diversity and the extinction rate |
| `js/keystone.js`, `js/keystone-worker.js` | Phase 3 automatic keystone tests: candidates each round, forked 3-round replays without each one, badges; in a Web Worker over http, in slices between frames from file:// |
| `js/scenarios.js` | Phase 3 scenarios in the niche-slot format: each names an ecoregion and lists slots (role, count, native, conservation status, foraging layer, start in the regional pool or seed bank), never species; plus the Sandbox slots and domestic cattle |
| `js/catalog.js` | Phase 3 catalogs at runtime: on-demand loading, deterministic slot draws weighted by how widely a species is recorded, real traits → game definitions, the food web from real diets, the starting-number budget, slot-level stability redraws and shareable seeds |
| `js/catalogs/*.js` | Generated real-species catalogs, one per ecoregion, plus `index.js` listing them (built by `tools/catalog/build.js`) |
| `js/energy.js` | Phase 3 energy chain: measures each round's GPP, NPP, harvesting, assimilation, tissue growth and energy passed up per level, with the textbook ranges and each mode's target bands. Also the three pyramids (numbers, biomass, energy) and the notes that explain an inversion |
| `js/generator.js` | Generated worlds: archetypes, niche slots, trait sheets with quirks, food webs, names and colours, and the stability test |
| `js/sprites.js` | Side-view creature art built from genes (limbs, tail, head, coat, armour, spines, wings, jaws) |
| `js/render.js` | World view: tile map, level-shape icons, Variation tint, close-up sprites, energy motes |
| `js/ui.js` | HUD, pyramids and cycles panel, floating inspector, Sankey, population chart |
| `js/screens.js` | New world, the round report, the Codex and the run end screen |
| `js/knowledge.js` | What the steward knows: knowledge levels, chance sightings, survey methods and estimates, staleness, the previous steward's records, soil tests, well gauges, radio collars, and the EHI as a range |
| `js/steward.js` | The steward's game: the Ecosystem Health Index, Stewardship Points, management actions, harvest limits, scenario damage and goals, win, loss and score |
| `js/stewardui.js` | The steward panel (Plan: goals, action card, queue, harvest limits; Season: watch list) and the action bar |
| `js/game.js` | Controller: New world setup, the Plan → Season → Report loop, events, the end of a run, saves, input |
| `tools/headless.js` | Run one world in Node: `node tools/headless.js 10 12345 [meadow\|generated]` |
| `tools/check-events.js` | Smoke tests: fixed trait sheets, events, save round-trip, refusing an older version's save, generator rules |
| `js/overlays.js` | Map overlays: soil nitrogen (from soil tests), seral stage, vegetation layers, edge vs interior, soil water, soil carbon, harvest pressure, territories, survey coverage and staleness, land use |
| `js/concepts.js` | The Codex's Concepts tab: textbook-neutral definitions of the ecology terms the game uses, and where each appears in play |
| `tools/check-catalog-mix.js` | Catalog species-mix audit: can every catalog fill the slots its scenarios and Sandbox need? `node tools/check-catalog-mix.js [code …]` |
| `js/stakeholders.js` | The steward's community: stakeholder types, asks, trust and the mandate, cost modifiers, land parcels, arrivals and departures, land sales and conservation easements |
| `tools/check-stakeholders.js` | Stakeholder checks: the starting community, private land, asks, trust from actions, ally and opponent costs, the mandate and its loss condition, land sales, timber, water rights, the separate random stream, saves: `node tools/check-stakeholders.js` |
| `tools/check-knowledge.js` | Knowledge checks: starting records, what each survey method detects and how accurate it is, combining surveys, staleness, studying and collars, sightings and discovery SP, the EHI range, instruments, the monitoring program, saves: `node tools/check-knowledge.js` |
| `tools/check-steward.js` | Steward checks: the EHI, every management action, harvest limits, Rewilding's damage and goals, collapse, score and saves: `node tools/check-steward.js` |
| `tools/catalog/build.js` | Builds an ecoregion catalog from open data (EPA ecoregions, GBIF occurrences and taxonomy, GRIIS, EltonTraits, USDA PLANTS, Open-Meteo), caching every download in `tools/catalog/cache/`: `node tools/catalog/build.js <9.3 \| 9.4.6 \| all> [--quota-scale 1.6]` |
| `tools/check-catalog.js` | Phase 3 catalog draw checks: deterministic seeds, slot constraints, 60–150 species, a sane food web, stability with slot redraws, ledgers and tick cost: `node tools/check-catalog.js 9.4.6 songbird` |
| `tools/check-demography.js` | Phase 3 demography checks: the round table balances exactly, half the founders are female and a species with no males doesn't breed, a species wiped out locally recolonizes (a regionally extinct one doesn't), emigration only above 0.8 K, territories don't overlap and are released on death, the Allee threshold, disease targets the highest N/K, saves keep sexes, territories and K: `node tools/check-demography.js` |
| `tools/check-succession.js` | Phase 3 succession checks: the Whittaker table, a volcanic isle going rock → pioneers → grasses with every advance meeting its soil thresholds, a burned woodland regrowing from its seed bank and returning toward forest in about 10 rounds, grassland staying prairie away from water, light gaps, floods and windthrow, ledgers and saves: `node tools/check-succession.js` |
| `tools/check-interactions.js` | Phase 3 interaction checks: strata and reach, pollinator loss ending fruit set, fragmentation shrinking interior habitat, nest parasites at edges only, interior specialists, trampling, parasite caps, cleaners, followers, pests, Gause's warning, Shannon H, deterministic keystone replays and a badge, saves: `node tools/check-interactions.js` |
| `tools/check-populations.js` | Phase 3 Population checks: ledgers conserved, a cleared strip splits a region and closing it merges them back, predators' kills from Populations are booked, every herd member belongs to one group region, saves keep Populations: `node tools/check-populations.js` |
| `tools/check-cycles.js` | Phase 3 cycle checks: nitrogen and energy conserved; removing decomposers slows producers; compaction denitrifies and sheds rain; legumes enrich soil; warming hits the south first: `node tools/check-cycles.js [--seeds 2] [--rounds 6]` |
| `tools/check-pyramids.js` | Phase 3 pyramid checks: in Temperate Meadow and Open Channel the energy pyramid must narrow every round; numbers and biomass are checked against the design's validation table: `node tools/check-pyramids.js [--seeds 3] [--rounds 8]` |
| `tools/check-energy.js` | Phase 3 energy checks: the textbook's 100,000-unit example must come back within ±10%, then hands-off worlds are measured against each mode's bands: `node tools/check-energy.js [--seeds 3] [--rounds 8] [--mode game\|realism\|both] [--set key=value]` |

## Phase 3 progress

**P3-M1 Energy chain: built.**

- **GPP and NPP** are booked separately per producer. Each producer has its own respiration share (`resp`, NPP efficiency 25–80%) and an **edible share** (`edible`): only leaf and fruit join the grazeable standing crop, while stems, roots and wood drop as litter. Standing crop also turns over as litter, so uneaten NPP feeds decomposers.
- **No per-meal P.** Every assimilated EU is kept, and all respiration is upkeep: basal × a per-level field metabolic rate, activity, and thermoregulation `c × M^0.67 × max(0, T_body − T_air)` for endotherms. Biomes have a mean temperature and a seasonal swing.
- **Body tissue.** Animals carry tissue energy on top of reserves. Parents pay for newborns' tissue, juveniles build it as they grow, and carcasses carry it, so NSP is real food for the next level.
- **Ectotherms** slow with air temperature and go torpid below freezing, replacing Phase 2's light-based slowdown.
- **Game and Realism modes** (`BALANCE.energyMode`): Game captures 20% of sunlight; Realism captures 1% of 20× the sunlight and triples thermoregulation.

Last `check-energy.js` run, 5 seeds × 10 rounds, hands-off Meadow:

| Efficiency | Phase 2 build | Phase 3 Game | Game band |
| --- | --- | --- | --- |
| Harvesting | 102% | 19% | 10–30% |
| Tissue growth, ectotherm | 2–9% | 24% | 20–50% |
| Tissue growth, endotherm | 6–10% | 12% | 6–12% |
| Passed up, NPP → herbivores | 18–24% | 8.5% | 8–15% |
| Passed up, herbivores → carnivores | about 1% | 4% | 8–15% |

**P3-M2 Three pyramids: built.**

- **Pyramid panel** (World view, left): Numbers · Biomass · Energy tabs over the textbook's four levels, where omnivores count with the herbivores. Bars use a log scale. Numbers and biomass can invert, and a note explains why; energy shows the share passed up from each level below.
- **Plant counts:** each producer kind holds a number of individual plants per tile, from 5,000 phytoplankton cells down to a quarter of a tree, so plants can be counted next to animals.
- **Biomass** is standing crop in g/m², treating a tile as a 1 m² sample plot at 1 g per EU.
- **Energy fixed per level** follows Lindeman's trophic positions: a species' assimilation counts at the level above its food, so an apex predator eating herbivores fixes that energy at level 3. Carcasses from starvation, old age or disease feed the detrital chain rather than passing energy up, because only kills move energy up the grazing chain.
- **Energy-pyramid assertion:** every world checks at the end of each round that energy narrows at every level. It warns in debug builds and records the result on `world.lastPyramids`.
- **Open Channel** (New world tab): 90% open water around a few islands, and a new phytoplankton producer kind (30 EU max, regrows in about a second). Swimmers move only in water; filter-feeders strain plankton from whatever tile they drift through. The hand-authored roster: Driftbloom and Eelgrass; Driftling and Glassclam (filter-feeders); Tidecrab; Silverfin and Skimgull; Greyseal; Siltworm. The player's lineage swims there, and a plant-eater filter-feeds. The default founder switches to the Opportunist, because a warm-blooded Grazer can't stay warm on filtered plankton.

Last `check-pyramids.js` run, 4 seeds × 8 rounds: energy narrowed in every round of both worlds. The Meadow was upright on numbers and biomass in 100% of rounds; the Open Channel's biomass was inverted (grazers outweigh phytoplankton) in 89%. The Open Channel's predators still boom and bust: Greyseals usually die out, and Silverfin do in some seeds.

**P3-M3 Nutrient, water and carbon cycles: built** (`js/cycles.js`, updating a tenth of the tiles each tick).

- **Nitrogen** replaces the old single soil-nutrient value. Each tile holds ammonium, nitrite, dissolved nitrate, nitrate salts, urea, uric acid and the nitrogen in dead matter. Nitrifying bacteria turn ammonium into nitrite and then nitrate, only in soil with oxygen. Waterlogged or compacted soil denitrifies instead, returning N₂ to the air. Dry soil locks nitrate up as salts, and rain dissolves them again.
- **Plants and nitrogen:** plants draw 80% of their nitrogen as nitrate and 20% as ammonium, at their own C:N ratio, and stop growing when the soil runs out. Legumes (Bloomvine, and generated vines) use soil nitrogen when it's there and have their root nodules fix the shortfall, at a cost of 15% of their growth, leaking a little ammonium to the tiles around them. Free-living bacteria and lightning add a little more.
- **Animals and nitrogen:** animals carry nitrogen in body tissue plus a small store. Feces take the egested share, and surplus nitrogen is excreted by body plan: swimmers and decomposers release ammonium, mammals urea (quick to break down), and birds and ectotherms uric acid (slow).
- **Decomposers are a keystone guild.** Soil microbes' decomposition scales with the decomposer guild. In the check tool, killing every Rotmite halves producer growth within 4 rounds.
- **Nitrogen ledger:** air + soil + bodies + dead matter stays constant, checked every 50 ticks (every tick with `?debug=1`). Errors run about 1e-6%.
- **Water:** biomes have rainfall (Meadow 60 cm/yr). Rain falls in drifting events, and storms bring lightning. Leaves intercept some rain. Loose, covered soil soaks the rest in; compacted or bare soil sheds it as runoff downhill, carrying dissolved nitrate to low ground and lakes. Soil water above field capacity percolates to a map-wide water table, which keeps low ground moist and drains to lakes as baseflow. Soil moisture now comes from this budget, and a Drought event also cuts rain. `world.irrigation` draws groundwater down (for the aquifer scenario later). Open water mixes its dissolved nitrogen.
- **Compaction:** heavy land animals pack the soil they cross, and it recovers slowly, faster under roots.
- **Carbon** is booked alongside energy at 1 unit per EU. Waterlogged tiles decompose slowly and store part of their detritus as peat, which is an energy pool on the ledger. Open water absorbs CO₂, less as it warms. The HUD shows each round's balance as a net sink or source.
- **Climate:** a New world checkbox, *Climate change*, turns on a CO₂ trend of +10 ppm per round, at 3 °C of warming per doubling. The map is 4 °C colder at its north edge. Each producer has a temperature envelope, so warming thins producers in the south first. Warming also speeds decomposition and brings fewer, heavier rains with more storms.
- **HUD:** the left panel adds Soil nitrogen, Water and Carbon readouts, with a warning when plant growth is nitrogen-limited more than 10% of the time. The tile inspector shows ammonium and nitrate, moisture, compaction, peat and legumes.
- **Energy-pyramid assertion:** now sums the last 3 rounds, allowing for stock the level below lost. A last predator eating the last prey no longer counts as a violation.
- **Saves** carry the cycles; older saves start fresh soil pools.

Last `check-cycles.js` run (2 seeds × 5 rounds): all five checks pass. Per round, fixation was about 2,700 N against 2,100 denitrified or leached. Runoff was about a third of rain. Plants were nitrogen-limited up to about 20% of the time, levelling off by round 8. `check-energy.js` and `check-pyramids.js` results are unchanged from milestone 2.

**P3-M4 Ecoregion catalogs: in progress.** The two-tier simulation, the catalog build tool, the niche-slot format and draws are built. Catalogs for all 20 Level II ecoregions are being generated.

- **Level II count:** the EPA's own data has **20** CEC Level II ecoregions in the continental U.S., not the 25 the design doc assumed; the build tool lists them from the EPA service.
- **Edwards Plateau (Level III 9.4.6)** has its own catalog of **499 species** (the build tool also takes Level III codes, and `--quota-scale 1.6` makes it richer than the ~310 of a Level II catalog). It includes the Golden-cheeked Warbler, Black-capped Vireo, the Plateau's endemic cave salamanders and spring fish, and the Hill Country's established exotics (aoudad, axis deer, blackbuck, feral hogs), marked non-native. The *Endangered songbird* scenario is set there, with a full juniper–oak woodland slot list: 67–88 species per world, and the at-risk slot draws an endangered woodland songbird, the Golden-cheeked Warbler about three times in four.
- **The build tool** (`tools/catalog/build.js`) grids the ecoregion, tallies GBIF occurrence records per taxon group by cell, and sweeps separately for IUCN at-risk species. It picks about 310 species by how widely each is recorded, with at-risk species first. Common names come from ITIS, USDA and EltonTraits; native status from USDA (plants) and GRIIS (animals); traits from EltonTraits (with old-name matching via GBIF synonyms) and USDA; climate normals from Open-Meteo. Captive and ranch exotics (vertebrates with no North American native range) are left out.
- **Real ecoregion worlds** (New world tab): pick an ecoregion and a scenario (or Sandbox). The cast is drawn from the scenario's niche slots, weighted by how widely each species is recorded, and stability-tested; failing slots are redrawn on their own. The seed to share appears under the controls (e.g. `9.4.6-songbird-1001`), and pasting one into the seed box rebuilds the same world. Real traits map to game traits (body mass → size, life history and lifespan; diet → meat share; endotherm/ectotherm; flight, swimming, herds and packs), the food web comes from real diets, and starting numbers share a vertebrate budget of about 280 individuals. Catalog species keep fixed traits (no mutation). The in-game menu's *Data sources* section credits every source.
- **Engine changes that came with real species:** Populations forage over nearby tiles and eat other Populations; grazers crop as they walk; endotherms are insulated for their ecoregion's climate; grasses set seed and seed-eaters start the year with some; prairie grasses and forbs carry more standing crop than moss-like ground cover.

**Open:** species tweak sets for sprites aren't built yet, and there's no Hawaiʻi catalog. With P3-M5's regional pool, cast survival after 3 hands-off rounds is about 81% on 9.3 *Rewilding the ranch* (was about 45% after 5) and 94–98% on the Edwards Plateau (was about 70%).

- **Populations:** species flagged `population` (Rotmite, Siltworm, Driftling, Glassclam, and generated decomposers) aren't simulated as individuals. Each keeps a density grid: juveniles, breeding adults and post-reproductive individuals per tile, with pooled reserves, body tissue and nitrogen.
- **The update:** every 10 ticks each tile feeds from its own food (detritus, plants, fruit), pays metabolism (with thermoregulation and ectotherm torpor), matures, ages, breeds when well fed, and dies of starvation or age. Bodies go to detritus. Crowded or hungry tiles send dispersers to neighbouring tiles the species can live on. Every flow goes through the same energy and nitrogen ledgers and round stats as individuals, so efficiencies, pyramids and the report include them.
- **Predation:** individual predators graze on Populations where they're densest (Silverfin and Skimgulls on Driftlings), and the prey's deaths are booked as kills.
- **Regions:** every 50 ticks each species' grid is split into connected regions, which are matched to the previous ones by overlap. A region keeps its place-based name ("Southwest open water", "West thicket") and history. A region cut in two becomes two Populations, one marked as split from the other; touching regions merge. Edges have hysteresis so they don't flicker. The round's notes record splits and merges of real size.
- **Herds, packs and flocks** of individual animals get group regions from their members' combined home ranges, with a member list.
- **On the map:** regions are shaded by density and outlined. Zoomed in, they show a scatter of representative icons, which can't be selected. Clicking a region opens its inspector: N, area, density, trend, age classes (or members), and its split and merge history. An individual's inspector links to its group.
- **Weather** now has its own random stream, so a seed brings the same rain whatever the animals do.

Last `check-populations.js` run: all checks pass. A cleared strip split *West meadow* into *West meadow* and *West marsh*, which merged back once the gap was resettled. Tick cost is about 0.4 ms. Energy, pyramid and cycle checks all still pass.

**P3-M5 Demography: built.** In `js/demography.js`, wired into `sim.js`.

- **The regional pool:** every species (except the player's and invaders) has a regional population behind the map edges. Small groups of both sexes, or patches of a Population, arrive at an edge at about 0.4 groups per round, up to 7 times more often as the species falls toward zero (the rescue effect), so a species wiped out locally recolonizes. Pool-only species (a scenario's `start: 'pool'` slots, like the extirpated apex predator in *Rewilding the ranch*) never arrive on their own; `reintroduce()` releases founders. A regionally extinct species never returns. Arrivals and departures go through the energy and nitrogen ledgers as imports and exports.
- **Emigration:** above 0.8 K, young adults without a territory head for the nearest edge and leave. Populations send dispersers off from their edge tiles.
- **Carrying capacity:** each round, K = the food energy available to the species (its share of each food's production, times its assimilation efficiency) ÷ one individual's upkeep over the round, smoothed across rounds.
- **The round table:** every species gets N0, B, I, D, E, N1 and r = ((B + I) − (D + E)) ÷ N0 × 100, balancing exactly for individual animals, plus a curve label: exponential, logistic, stable, overshoot, declining or recolonizing.
- **Sexes and mating systems:** individuals are male or female, and only females start breeding. Birds and pack canids are monogamous (pairs stay together), other mammals polygynous (males breed without a rest), and ectotherms breed explosively and need at least 2 others of their kind within 5 tiles (the Allee threshold). Decomposers stay asexual. There are no lonely clones: a female without a male doesn't breed.
- **Territories:** a female of a territorial species must claim a territory that doesn't overlap another of her species (radius 2–10 tiles, growing with body mass) before breeding; floaters can't breed. A territory is freed when its holder dies or emigrates.
- **Disease** strikes the species furthest above its K, not simply the most numerous.
- **In the inspector:** N / K, the curve, the mating system, regional pool status, last round's equation with its numbers, and an age pyramid (juvenile, breeding, post-reproductive; males left, females right). Individuals show their sex, and whether they hold a territory or are emigrating.
- **Closed worlds:** `createWorld({ closed: true })` shuts the regional pool. The energy and cycle checks use it, since the textbook's efficiencies describe a closed system.

Last `check-demography.js` run: all checks pass; 108 species-rounds balanced exactly. Pyramid, cycle, population and catalog checks pass. The cycle check's compaction test now sums 3 seeds against a 1.10× denitrification threshold (fewer animals, since breeding needs a male, leave less nitrate to denitrify). `check-energy.js` Game mode is unchanged. Realism mode's endotherm tissue growth now reads −3.7% (it was blank before, with no endotherms left to measure), which is still the known Realism imbalance.

**P3-M6 Interactions and succession: part 1 (succession, disturbance and biomes) built.** In `js/succession.js`.

- **Seral stages:** every land tile is at a stage: bare rock, pioneers (lichens, mosses), grasses and forbs, shrubs and young trees, or mature forest. A producer's stage comes from its growth habit (catalog species) or its map kind. A tile advances to the next stage the roster has when a seed of that stage reaches it (from a neighbour within the producer's dispersal range, its own seed bank, or occasionally from anywhere) and its soil has enough organic matter and mineral nitrogen. One stage takes about 2–4 rounds; the old growth is shaded out and falls as litter.
- **Soil organic matter** builds from each tile's detritus and slowly mineralizes; pioneers weather rock into the first soil.
- **Dispersal and longevity:** fugitive producers seed far and live short lives, climax producers seed near and live long. Shrubs and trees die at the end of their longevity and open light gaps.
- **Seed banks:** each tile remembers the last three producers that grew there, always including grasses and forbs; catalog species from `start: 'seedbank'` slots are weighted up. Burned, flooded or cleared ground regrows from it at once (secondary succession), at the highest stage up to grasses its soil supports.
- **Climax by biome:** the biome comes from the world's mean temperature and rainfall (the Whittaker diagram), and sets the stage succession stops at: mature forest in temperate forest and taiga, tallgrass prairie in temperate grassland, desert scrub in desert. Wet ground in grassland and desert can grow gallery woodland. The Meadow is a temperate grassland, so its woods thin over the run as old trees fall and prairie takes their place, except along wet ground.
- **Disturbances:** wildfire spreads through dry, well-stocked growth (burning 30–160 tiles, killing half the ground-living small fauna on burned tiles); floods clear and waterlog low ground; windstorms fell scattered shrubs and trees. They happen on their own each round (lightning fires are most likely in grassland) on the weather's random stream, and as events. Burn scars show on the map.
- **Volcanic isle:** a New world option starting every land tile as bare rock, adding a crust lichen pioneer if the roster has none; the whole run is primary succession. (The player's species starves at the start on bare rock until the Phase 2 player species is retired in P3-M7.)
- **On screen:** the New world screen shows a small Whittaker diagram with the world's climate, biome and climax. The tile inspector shows the seral stage, the climax the tile can reach, soil organic matter, age against longevity for shrubs and trees, and the seed bank. The left panel shows the share of each stage.

Last `check-succession.js` run: all checks pass. A volcanic isle was 93% colonized by round 10 (62% pioneers, 31% grasses). A 120-tile fire through a woodland regrew from the seed bank within one step and was 88% woody again after 10 rounds. The cycle checks now run without natural disturbance, so they measure only their own mechanism. With natural fires in the hands-off Meadow, Game mode's endotherm tissue growth sits at the bottom of its band (6.0%).

**P3-M6 part 2 (interactions, niches and keystone species): built.** In `js/interactions.js` and `js/keystone.js`.

- **Strata:** every producer and consumer has a stratum (above canopy, canopy, midstory, understory, ground, wetland). Catalog animals take theirs from EltonTraits; others from swimming, flight and diet. A consumer prefers food in its own stratum, and a predator hunts prey outside the strata it reaches at 30% of the usual rate, so similar species on the same food can split it by layer.
- **Competition:** each round, species on the same level get a niche-overlap score (diet overlap × stratum similarity × activity overlap). Above 0.8 for 3 rounds, the report gives Gause's warning and names the likely loser.
- **Amensalism:** animals heavier than 8 (bison, elk, cattle, Tuskbeasts) crush the plants they walk over, to litter; trees are spared.
- **Parasites:** warm-blooded animals of size 3 or more carry a parasite load that grows on their reserves (up to 2% of full) and respires, a steady drain. Their bodies carry it to carcasses.
- **Protocooperation:** cleaners (magpies, grackles, starlings, cowbirds in the catalogs) seek parasitized hosts and eat their parasites; both gain.
- **Commensalism:** followers forage near a host species and prefer food close to it: cattle egrets and cowbirds by big grazers (catching more of the small prey they flush), scavenging birds by predators (booked when they eat the host's kills). A follower isn't frightened by a well-fed host and never takes a host that preys on it. In the Meadow, Thornbacks trail Tuskbeasts and Scuttlers trail Stalkers and Dreadmaws.
- **Obligate mutualism:** each insect-pollinated producer (forbs, shrubs and vines; not grasses or trees) is paired with one of the world's pollinator species and sets fruit only within about 8–16 tiles of where it lives. Losing a pollinator ends that fruit, and the fruit-eaters feel it (the fig pattern).
- **Edges and interiors:** woodland 3 or more tiles from open ground is interior. The at-risk songbird slot in *Endangered songbird* is an interior specialist and breeds only there. Nest parasites (the Brown-headed Cowbird) lay in other birds' nests near edges only, and their chick is raised on the host's energy. A cleared strip shrinks interior habitat much faster than woodland area.
- **Diversity and extinctions:** the report shows species richness and Shannon H (by individuals, as in the textbook, and for plants by cover), the share of woodland that is interior, local extinctions, and the extinction rate per round against the fossil background. Producers covering over 35% of the land in uniform blocks get pest outbreaks.
- **Keystone tests:** at every round end the world is forked. A control copy and one copy without each candidate run 3 rounds; a removal that drops the rest of the community's richness or biomass diversity by more than 25% earns a ★ Keystone badge. Candidates are the 10 species with the strongest interactions, any species whose numbers changed by more than half, and Populations as guilds by level. Over http the tests run in a Web Worker (10 tests take about 30 s); from file://, browsers block workers, so they run in 6 ms slices between frames. Results arrive during the next season in the report's *Keystone tests* list, as a toast, in the inspector and in the Codex entry, which explains what changed.
- **On screen:** a new *Interactions and diversity* card in the round report; the inspector shows each species' stratum, host and cleaner roles, keystone badge, and each host's parasite load.

Last `check-interactions.js` run: all checks pass. Removing the Edwards Plateau cast's Queen butterfly cut its paired sandmat's fruit; a cleared strip cut woodland 2% and interior 11%; cowbirds parasitized 94 of 200 edge broods and none inside; cleaners lowered host loads from 52% to 38% of their cap; Thornbacks were within 6 tiles of a Tuskbeast 39% of the time as followers against 16% on their own; removing every herbivore dropped richness 57% and earned a badge. The other suites pass. Hands-off Meadow carnivores remain the weak spot: Game mode's herbivore → carnivore transfer is 3.5% over 6 seeds (4.9% before this part; band 8–15%), since carnivores barely hang on with or without the new interactions.

**P3-M7 Steward play: part 1 (the steward's loop) built.** In `js/steward.js`, `js/stewardui.js` and a rewritten `js/game.js` and `js/screens.js`.

- **Retired:** the player species, genomes that vary by individual, inheritance, mutation, speciation, the Species editor, Mutation Points, directives, the territory marker, Champion and Cull, rivals, the Phylogeny screen, the variation tint and producer tile-gene evolution. Every individual shares its species' fixed trait sheet.
- **The loop:** Plan (the world paused, an action bar under the map, the steward panel on the right) → Season → Report. Area actions are placed with a brush on the map and paid for up front; species actions pick a species in the panel. Standing orders (invasive control, protection) cost SP every round they stay on.
- **Management actions:** prescribed burn, shred, disc (bare for a round, a nitrogen flush), overseed natives, plant natives, plant legumes, loosen soil, reforest, wildlife corridor, restore wetland, riparian buffer, grazing exclosure (keeps grazers and browsers of fence size and up out for 3 rounds), reintroduction from the regional pool (native wildlife only), translocation, invasive control and protect species (no harvest; fire and heavy work stay out of its range).
- **Harvest limits:** a bag limit per species per round, taken through the season and booked as deaths in the demography. It pays SP by body mass, half value while the species is below ½K.
- **The Ecosystem Health Index:** energy pyramid integrity (20), biodiversity (20), population stability (15), nutrient, water and carbon balance (15), keystone and mutualist presence (10), habitat structure (10) and small-population viability (10), each with its main cause.
- **Scenarios** now set the damage the steward inherits (Rewilding: compacted soil, cattle overstocked 2.5×, a non-native brome monoculture on about 60% of the land) and restoration goals checked every round.
- **Win, loss and score:** finish 30 rounds with an average EHI of 70 or more and every goal met; lose if the EHI stays below 30 for 2 rounds or producers collapse. Score = average EHI × rounds + 40 per species recovered and per reintroduction − 40 per avoidable extinction, times the difficulty.

Last `check-steward.js` run: all checks pass.

**P3-M7 part 2 (what the steward knows): built.** In `js/knowledge.js`.

- **Knowledge levels** per species: *Unknown* (acts on the map, drawn as a grey shape, absent from the Codex, watch list, pyramids, report and harvest table), *Sighted* (name, level, sketch, a coarse abundance word), *Surveyed* (an estimate of N ± error), *Studied* (surveyed in 3 rounds or radio-collared: K, diet and predators, demography terms and age structure).
- **Sightings:** each round a species is seen by chance with probability 1 − exp(−0.05 × conspicuousness × √N), where conspicuousness grows with body mass and falls for nocturnal, canopy-dwelling and small pooled taxa. A new species earns 3 SP (8 if at risk).
- **Survey methods** (new Monitor actions, painted on the map): point counts and transects (birds, large mammals), camera traps (nocturnal and cryptic mammals), live traps and mist nets (small mammals, bats, songbirds), pitfalls and soil cores (invertebrates, decomposers, reptiles, amphibians), dip nets and water sampling (aquatic animals). Each catches individuals in the area with its detection probability and scales up by the area's share of the habitat; the error combines sampling and patchiness. Two surveys in one round combine. Catching none in a small area is inconclusive, not zero. Also a vegetation transect (native vs non-native cover and seed bank), soil test and well gauge (the side panel's soil and water figures need one from the last 3 rounds), a radio collar (tracks one animal's fate and makes its species Studied), and a monitoring program that repeats this round's surveys every round at half cost.
- **Staleness:** error bars widen by 15% of N a round; trend arrows fade after 2 rounds; after 5 rounds a species drops back to Sighted detail.
- **The previous steward's records:** 5–10 key species (livestock, at-risk species, scenario key slots, apex predators, conspicuous species) start Surveyed with estimates 1–5 years old.
- **The EHI as a range:** each component is certain only as far as the steward knows its inputs (surveyed share of species, sighted share, fresh soil tests and well gauges); the rest spans its full range. The true EHI, used for scoring, appears at the end. Harvest limits are set against estimates, so stale data risks overharvest.

Last `check-knowledge.js` run: all checks pass. 13 of 14 big-survey estimates fall within two error bars of the truth; a blind start discovers 6 Meadow species by chance in 4 rounds; the EHI range goes from about 77 points wide to 78–85 (true 84) after surveying everything.

**P3-M7 part 3 (the community): built.** In `js/stakeholders.js`.

- **Stakeholders:** 3–6 at the start from ten types (ranching family, farmers and irrigators, timber company, hunters and anglers, conservation group, outfitters and tourism, town water utility, beekeepers, traditional land users, research station), weighted by the world (timber companies where there's forest, a water utility where there's water). A scenario can require types: Rewilding always has a ranch and a conservation group. Each has trust (0–100), influence, demand and flexibility.
- **Likes and dislikes:** each type likes some actions and dislikes others (a ranch dislikes reintroductions and Protect orders; a conservation group likes them). Doing them moves trust every round. **Allies** (trust > 70) make actions they like 20% cheaper; **opponents** (< 30) make actions they dislike 30% dearer.
- **Asks:** each round 1–3 stakeholders ask for something, tied to the world's real species: keep the cattle herd, take a predator that's taking stock, open a game season, protect an at-risk species (which names it to the steward), raise native cover, keep an animal for visitors, don't cap irrigation, plant for the bees, harvest timber, keep nitrogen losses below fixation, hold a cultural burn, survey a species. Accept or decline in Plan. A met ask pays SP and trust; a failed one costs more trust than declining; refusals past a stakeholder's flexibility cost more each time.
- **The mandate** is the influence-weighted mean trust. Below 25% for 2 rounds, the board replaces the steward (a loss). Rewilding's goals include a mandate of 50% or more, and the score adds a point per mandate point above 50.
- **Land:** landholders (ranch, farm, timber, traditional users) hold parcels of the map, drawn with dashed outlines. The steward's area actions do nothing on private land. With the **Changing community** option (on by default), stakeholders leave (more often when they're opponents, and ranchers and farmers in a drought) and arrive (outfitters are drawn by a returning apex predator). A departing landholder's land goes up for sale: bid for a conservation easement (allies chip in on the price) and it becomes land the steward manages; otherwise it goes to a subdivision or cropland (cleared and compacted for good), a ranch, a hunting lease or a private reserve, with lower mandates favouring development.
- **New Community actions:** timber harvest (cuts mature forest, exporting the logs, for SP) and cap irrigation (buys back water rights; the aquifer draw falls 40%).
- The community draws on its own random stream, so it never changes how the ecosystem plays out. The keystone worker now loads the steward modules, so its replays keep exclosures and harvest limits. Save version 9.

Last `check-stakeholders.js` run: all checks pass.

**P3-M8 part 1 (UI and classroom): built.**

- **Map overlays** (picker at the map's top left, with a legend): soil nitrogen (only where a fresh soil test measured it), seral stage, vegetation layers, edge vs interior, soil water (with the water table if a well gauge is fresh), soil carbon, harvest pressure, territories, survey coverage and staleness, and land use.
- **The energy chain** in the round report: the five textbook steps (GPP → NPP → ingested → GSP → NSP) through herbivores to carnivores, or for one surveyed species, on a log scale, each loss named with its efficiency and target band. **Textbook example** puts the 100,000-unit worked example beside the ecosystem's own chain rescaled to 100,000 units of GPP. The old flow diagram is the Consumer flow tab.
- **Top bar:** the EHI with its trend, and the community's trust (the mandate).
- **Realism** option on the New world screen (every efficiency in the textbook's range; runs are labelled Realism in the header, report and score). Experimental: not balanced yet.
- **CSV export** from the report: efficiencies and the chain, the three pyramids, and demography (known species only; estimates where they aren't studied), every round so far.
- **Concepts tab** in the Codex: 47 textbook-neutral entries in six topics, each with where it appears in play, related concepts, and a button to open the matching map overlay.

**P3-M8 part 2 (UI and classroom): built.**

- **Rapid responses** in the action bar during the season: an emergency survey placed on the map (1.5× the cost of point counts), a fire crew on call (lightning fires now strike in summer, not at the start of the round, and a crew holds one to a fifth of its size; a wildfire alert shows when one starts), and spot removal of 15% of a known non-native species.
- **Watch list** (Season panel): species at risk (crashing this season, below a minimum viable population, or below ½K when studied), invasives and keystones, each with its survey status (sighted, surveyed N rounds ago, studied), then the biggest movers.
- **Action cards** say when an action takes effect and which EHI components it tends to move (+, −, or either way).
- **Harvest sliders** from 0 to half the estimate, with a tick at the take that would bring a studied species' estimate down to ½K.
- **Inspector efficiency bars:** the species' assimilation and tissue growth this round against the target band (Surveyed species and up).
- **Codex Ecology card** per species: last round's interactions with their +/0/− signs, the age and sex structure (juveniles, adults, elders by sex; or age classes for Populations), measured efficiencies, keystone test history and the steward's management history.
- **Ecoregion map** on the New world screen: the 20 Level II ecoregions of the lower 48 (`build.js map` writes `js/catalogs/usmap.js` from the EPA outlines), coloured by biome where a catalog is built; click one to choose it. The Whittaker diagram sits beside it.

**Catalog role guarantees.** Occurrence records follow what people photograph, so the most-recorded species left most catalogs with 0–1 native grasses (even the Temperate Prairies), few decomposers and few raptors. The builder now tops up each role that's short with its own per-cell GBIF query: native grasses (8), non-native grasses (2), native legumes (4), decomposers (6), raptors (4), scavengers (2) and apex predators (2). `build.js all --topup` adds them to built catalogs without rebuilding. `tools/check-catalog-mix.js` checks every catalog can fill its scenarios' and Sandbox's slots.

**Meadow balance after retiring evolution.** Without evolution to mask it, the hands-off Meadow's herbivores crashed and its carnivores died out. Three causes, all fixed:

- Decomposer Populations kept all they assimilated (individual decomposers respire 70%), so the Rotmites locked up about 40% of the world's nitrogen in their bodies and plants were nitrogen-limited 32% of the time. Now they respire like individual decomposers; nitrogen limitation is 13–17%.
- Open water never denitrified, so leached nitrate piled up in lakes. Its sediments now denitrify (`nitrogen.sedimentDenit`).
- Warm-blooded herbivores spent 73–79% of their upkeep staying warm, so the Meadow's cold-blooded omnivores beat them to every plant. The Game mode heat cost (`thermoCoef`) is down from 0.009 to 0.0055.

Over 6 hands-off seeds every trophic level now survives the test in every seed (herbivores 28–111, apex predators 2–6). Game mode's plants → herbivores transfer is 9.3% (in band); endotherm tissue growth is 13.5% (just above its 6–12% band) and herbivores → carnivores 5.7% (below its band). The energy pyramid's bars are now to scale (linear), with each row's share passed up printed beside it.

**The map is now 96 × 96 tiles** (was 64 × 64). Numbers tuned on 64 × 64 (starting populations, the entity budget, the decomposer cap, Population seeding, fire sizes) scale with the area (`BALANCE.areaScale`, 2.25); distances stay in tiles, and terrain noise scales so lakes and woods keep their size. On the bigger map the rarest species sit well clear of extinction: hands-off Meadow, 6 seeds × 10 rounds, every level alive in every seed, and the lowest carnivore and apex counts rose from 5 and 2 to 13 and 5. To keep the tick cost down, plants grow on alternate tiles each tick with a two-tick step, and each Population updates every 20 ticks with species taking turns. Tick cost is 2.8–3.5 ms in real-species worlds (the check's budget is now 4 ms), and a save is about 1.3 MB.
**Realism mode isn't balanced yet.**
