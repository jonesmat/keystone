# Keystone

A single-player HTML5 ecosystem game about energy flowing through a living food web. Phase 3 turns it into a stewardship game: you keep a real U.S. ecosystem in balance.

Keystone was called Trophic until Phase 3, and the code still uses `Trophic` as its internal namespace (`window.Trophic`) and in its save keys, so existing saves keep loading.

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

## Phase 2 in one paragraph

Every individual now carries its own genome (32 genes plus 8 neutral markers). Offspring blend two parents and pick up random mutations, so natural selection happens inside each population. When a population forms two distinct genetic clusters for two rounds, it splits into a new named species. A *Generated world* rolls a fresh roster of 10–16 consumers and 3–6 producers from archetypes, then runs a 5-round headless stability test before play. The player breeds rather than sculpts:

- **Guided mutation** shifts the population mean.
- **Selection pressure** favours the top 25% for a pinned gene.
- **Mutation focus** triples μ for one gene.
- **Mutant cards** spread a real outlier's gene.
- **Champion**, **Cull** and **Isolate** act on individuals and groups during a season.
- A split of your own lineage lets you choose which branch to keep. The other becomes a *Descendant* species.

## Layout

| File | What it does |
| --- | --- |
| `js/balance.js` | Every tuning knob, including Phase 2 evolution, speciation and safeguard parameters |
| `js/genes.js` | Gene schema (range, step, MP cost, upkeep), genome helpers, base64 packing for saves |
| `js/data.js` | Trophic levels, the hand-authored Meadow roster, templates, directives, events, tutorial, Codex ecology notes |
| `js/sim.js` | Fixed-step simulation (10 ticks/s): per-individual stats, juveniles, aging, mate-finding, behaviour genes, producer tile genes, microhabitats, energy ledger, save v2 plus v1 migration. Phase 3: GPP/NPP booking per producer, litterfall, upkeep-only metabolism with thermoregulation, body tissue, ectotherm temperature response |
| `js/cycles.js` | Phase 3 nutrient, water and carbon cycles: soil nitrogen pools and their bacteria, legume and free-living fixation, excretion by body plan, the nitrogen ledger, rain events, infiltration, runoff, evapotranspiration, groundwater, compaction, peat, open-water carbon uptake and the CO₂/climate trend |
| `js/populations.js` | Phase 3 two-tier simulation: small taxa as Populations (per-tile densities by age class, pooled reserves, tissue and nitrogen), their feeding, metabolism, births, deaths and dispersal; regions that split and merge with place-based names; herd, pack and flock regions for individually simulated vertebrates |
| `js/scenarios.js` | Phase 3 scenarios in the niche-slot format: each names an ecoregion and lists slots (role, count, native, conservation status, foraging layer, start in the regional pool or seed bank), never species; plus the Sandbox slots and domestic cattle |
| `js/catalog.js` | Phase 3 catalogs at runtime: on-demand loading, deterministic slot draws weighted by how widely a species is recorded, real traits → game definitions, the food web from real diets, the starting-number budget, slot-level stability redraws and shareable seeds |
| `js/catalogs/*.js` | Generated real-species catalogs, one per ecoregion, plus `index.js` listing them (built by `tools/catalog/build.js`) |
| `js/energy.js` | Phase 3 energy chain: measures each round's GPP, NPP, harvesting, assimilation, tissue growth and energy passed up per level, with the textbook ranges and each mode's target bands. Also the three pyramids (numbers, biomass, energy) and the notes that explain an inversion |
| `js/evolution.js` | Inheritance and mutation, 2-means speciation, lineage splits, "What evolved" attribution, mutant detection, guided mutation and pressure |
| `js/generator.js` | Archetypes, niche slots, genome sampling with quirks, food webs, names and colours, founder rolls, stability test |
| `js/sprites.js` | Side-view creature art built from genes (limbs, tail, head, coat, armour, spines, wings, jaws) |
| `js/render.js` | World view: tile map, level-shape icons, Variation tint, close-up sprites, energy motes |
| `js/ui.js` | HUD, floating inspector, histograms, radar, Sankey, population chart |
| `js/screens.js` | New world, Species editor, Selection report, Phylogeny, Codex, End |
| `js/game.js` | Controller: setup, round loop, orders economy, speciation choices, phylogeny records, events, saves, input |
| `tools/headless.js` | Run one world in Node: `node tools/headless.js grazer 10 12345 [meadow\|generated]` |
| `tools/sweep.js` | Seed sweep against the Phase 2 balance targets: `node tools/sweep.js --seeds 20 --rounds 30 [--mode generated] [--set key=value] [--csv out.csv]` |
| `tools/check-events.js` | Smoke tests: inheritance, events, speciation, save round-trip, v1 migration, generator rules |
| `tools/catalog/build.js` | Builds an ecoregion catalog from open data (EPA ecoregions, GBIF occurrences and taxonomy, GRIIS, EltonTraits, USDA PLANTS, Open-Meteo), caching every download in `tools/catalog/cache/`: `node tools/catalog/build.js <9.3 \| 9.4.6 \| all> [--quota-scale 1.6]` |
| `tools/check-catalog.js` | Phase 3 catalog draw checks: deterministic seeds, slot constraints, 60–150 species, a sane food web, stability with slot redraws, ledgers and tick cost: `node tools/check-catalog.js 9.4.6 songbird` |
| `tools/check-populations.js` | Phase 3 Population checks: ledgers conserved, a cleared strip splits a region and closing it merges them back, predators' kills from Populations are booked, every herd member belongs to one group region, saves keep Populations: `node tools/check-populations.js` |
| `tools/check-cycles.js` | Phase 3 cycle checks: nitrogen and energy conserved; removing decomposers slows producers; compaction denitrifies and sheds rain; legumes enrich soil; warming hits the south first: `node tools/check-cycles.js [--seeds 2] [--rounds 6]` |
| `tools/check-pyramids.js` | Phase 3 pyramid checks: in Temperate Meadow and Open Channel the energy pyramid must narrow every round; numbers and biomass are checked against the design's validation table: `node tools/check-pyramids.js [--seeds 3] [--rounds 8]` |
| `tools/check-energy.js` | Phase 3 energy checks: the textbook's 100,000-unit example must come back within ±10%, then hands-off worlds are measured against each mode's bands: `node tools/check-energy.js [--seeds 3] [--rounds 8] [--mode game\|realism\|both] [--legacy] [--set key=value]` |

## Where it deviates from the Phase 2 design

- **Genome storage:** each entity owns a `Float32Array`, rather than using one shared pool. Saves still pack all genomes as a single base64 `Float32Array`.
- **Simulation thread:** the sim still runs on the main thread (about 0.5–1 ms per tick at 400–600 organisms). The planned Blob-URL Web Worker hasn't been built.
- **Speciation distance:** 0.55 instead of 0.35, because ordinary single-cluster populations already measure 0.25–0.3.
- **Stability test:**
  - Dominance is judged by consumer *biomass*, with a 60% limit rather than 40% of individuals, since small r-strategists are naturally the most numerous.
  - A roster takes about 3 s per attempt in the browser, and some seeds need several attempts.
- **Decomposers** reproduce asexually. That settles one of the design's open questions.
- **Tuning beyond the design:**
  - A 3× lifespan multiplier on the longevity gene.
  - A two-round grace period before NPC predators target the player, matching the GDD tutorial.
  - A predator sprint at the start of each chase.
  - A Type III functional response (predators pay less attention to rare prey).
  - Smaller energy stores for meat-eaters.
  - Lower resting upkeep for apex predators.
  - Carnivore P raised to 0.18 and apex P to 0.14.
- **Not built yet:** Sandbox mode (its tab is disabled), the Wetland and Taiga biomes as full campaigns (the generator's biome budget changes sunlight, water and winter only), and the Web Worker.

## Phase 3 progress

**P3-M1 Energy chain: built.** The rest of Phase 3 (genomes, the player species and the Phase 2 screens retired; stewardship) hasn't started, so the game still plays as Phase 2 on top of the new energy model.

- **GPP and NPP** are booked separately per producer. Each producer has its own respiration share (`resp`, NPP efficiency 25–80%) and an **edible share** (`edible`): only leaf and fruit join the grazeable standing crop, while stems, roots and wood drop as litter. Standing crop also turns over as litter, so uneaten NPP feeds decomposers.
- **No per-meal P.** Every assimilated EU is kept, and all respiration is upkeep: basal × a per-level field metabolic rate, activity, and thermoregulation `c × M^0.67 × max(0, T_body − T_air)` for endotherms. Biomes have a mean temperature and a seasonal swing.
- **Body tissue.** Animals carry tissue energy on top of reserves. Parents pay for newborns' tissue, juveniles build it as they grow, and carcasses carry it, so NSP is real food for the next level.
- **Ectotherms** slow with air temperature and go torpid below freezing, replacing Phase 2's light-based slowdown.
- **Game and Realism modes** (`BALANCE.energyMode`): Game captures 20% of sunlight; Realism captures 1% of 20× the sunlight and triples thermoregulation.
- `BALANCE.legacyMealP = 1` restores the Phase 2 model for comparison runs.

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

**Open:** in colder or more crowded draws (9.3 *Rewilding the ranch*), only about 45% of starting species survive 5 hands-off rounds; on the Edwards Plateau it's about 70% after 3. Balancing real-species casts is its own tuning pass, and P3-M5's regional pool (immigration and the rescue effect) is the design's counter to local extinction. Species tweak sets for sprites aren't built yet.

- **Populations:** species flagged `population` (Rotmite, Siltworm, Driftling, Glassclam, and generated decomposers) aren't simulated as individuals. Each keeps a density grid: juveniles, breeding adults and post-reproductive individuals per tile, with pooled reserves, body tissue and nitrogen.
- **The update:** every 10 ticks each tile feeds from its own food (detritus, plants, fruit), pays metabolism (with thermoregulation and ectotherm torpor), matures, ages, breeds when well fed, and dies of starvation or age. Bodies go to detritus. Crowded or hungry tiles send dispersers to neighbouring tiles the species can live on. Every flow goes through the same energy and nitrogen ledgers and round stats as individuals, so efficiencies, pyramids and the report include them.
- **Predation:** individual predators graze on Populations where they're densest (Silverfin and Skimgulls on Driftlings), and the prey's deaths are booked as kills.
- **Regions:** every 50 ticks each species' grid is split into connected regions, which are matched to the previous ones by overlap. A region keeps its place-based name ("Southwest open water", "West thicket") and history. A region cut in two becomes two Populations, one marked as split from the other; touching regions merge. Edges have hysteresis so they don't flicker. The round's notes record splits and merges of real size.
- **Herds, packs and flocks** of individual animals get group regions from their members' combined home ranges, with a member list.
- **On the map:** regions are shaded by density and outlined. Zoomed in, they show a scatter of representative icons, which can't be selected. Clicking a region opens its inspector: N, area, density, trend, age classes (or members), and its split and merge history. An individual's inspector links to its group.
- **Weather** now has its own random stream, so a seed brings the same rain whatever the animals do.

Last `check-populations.js` run: all checks pass. A cleared strip split *West meadow* into *West meadow* and *West marsh*, which merged back once the gap was resettled. Tick cost is about 0.4 ms. Energy, pyramid and cycle checks all still pass.

Predators last longer than in Phase 2: with a Grazer player, apex predators now survive all 10 test rounds, and primary carnivores mostly do. **Realism mode isn't balanced yet:** endotherms and predators die out within 10 rounds.

## Balance status

Run `tools/sweep.js` for current numbers. Last sweep, hands-off (no directives or orders), 8–10 seeds:

| Setup | Every level alive at round 5 | Carnivores (median last round) | Player median survival | Rosters passing within 5 tries |
| --- | --- | --- | --- | --- |
| Meadow · Grazer · 15 rounds | 80% | 8 (apex 8) | 15 rounds | — |
| Meadow · Hunter · 15 rounds | 40% | 8 (apex 6) | 4 rounds | — |
| Generated · Grazer · 12 rounds | 63% | 11 (apex 6) | 12 rounds | 50% (the game allows 20) |

Two Phase 2 targets aren't met yet: every level alive at round 15 (0% of runs; the target is ≥ 70%), and one species holding more than half of consumers (it happens in nearly every run; the target is ≤ 15%). Tick cost stays under 1.2 ms.
