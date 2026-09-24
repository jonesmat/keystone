// Keystone — static game data: trophic levels, the hand-authored Meadow roster, templates, directives, events,
// tutorial text and Codex ecology notes. Generated worlds come from js/generator.js.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  // Fixed trophic colour language. Shapes also differ per level for colour-blind play.
  T.LEVELS = {
    producer:   { name: 'Producers',            short: 'Producer',   color: '#5E9E45', shape: 'square' },
    herbivore:  { name: 'Herbivores',           short: 'Herbivore',  color: '#E0B03A', shape: 'circle' },
    omnivore:   { name: 'Omnivores',            short: 'Omnivore',   color: '#E0813A', shape: 'diamond' },
    carnivore1: { name: 'Primary carnivores',   short: 'Primary carnivore', color: '#C9483F', shape: 'triangle' },
    carnivore2: { name: 'Secondary carnivores', short: 'Secondary carnivore', color: '#7C55A8', shape: 'square' },
    decomposer: { name: 'Decomposers',          short: 'Decomposer', color: '#8C8A80', shape: 'dot' },
  };
  T.LEVEL_ORDER = ['producer', 'herbivore', 'omnivore', 'carnivore1', 'carnivore2', 'decomposer'];

  // Producer kinds decide where a producer grows on the map. perTile is how many individual plants a full
  // tile holds, so the numbers pyramid can count plants next to animals (one tree spans about four tiles).
  T.PRODUCER_KINDS = {
    ground:   { name: 'ground cover',  height: 0, perTile: 400 },
    tall:     { name: 'tall shader',   height: 2, perTile: 40 },
    vine:     { name: 'fruiting vine', height: 1, perTile: 20 },
    woody:    { name: 'woody store',   height: 3, perTile: 0.25 },
    aquatic:  { name: 'aquatic mat',   height: 0, perTile: 60 },
    plankton: { name: 'phytoplankton', height: 0, perTile: 5000 },
  };

  T.MEADOW_PRODUCERS = [
    { id: 'moss',  name: 'Sunmoss',   kind: 'ground', max: 150,  resp: 0.55, edible: 0.35, height: 0, leaf: 1.00, regrowDelay: 0,  fruit: false, tough: 0.3, moist: 0.5, color: [172, 196, 128],
      note: 'Ground cover that regrows quickly. Low energy density; shaded out by tall plants.' },
    { id: 'reed',  name: 'Reedstalk', kind: 'tall',   max: 400,  resp: 0.45, edible: 0.30, height: 2, leaf: 1.10, regrowDelay: 80, fruit: false, tough: 0.8, moist: 0.75, color: [150, 172, 96],
      note: 'Grows tall and shades neighbours. Slow to regrow after grazing.' },
    { id: 'bloom', name: 'Bloomvine', kind: 'vine',   max: 250,  fixer: true, resp: 0.50, edible: 0.35, height: 1, leaf: 1.00, regrowDelay: 0,  fruit: true,  tough: 0.4, moist: 0.55, color: [158, 190, 122],
      note: 'A legume vine: root nodules fix nitrogen. Drops fruit in spring and summer (easier to digest: A +0.2).' },
    { id: 'iron',  name: 'Ironbark',  kind: 'woody',  max: 1500, resp: 0.55, edible: 0.30, height: 3, leaf: 1.20, regrowDelay: 40, fruit: false, tough: 2.0, moist: 0.45, color: [104, 146, 88],
      note: 'Huge energy store behind tough bark. Slow to eat unless you are big.' },
  ];

  // Phase 1-style genome objects, converted to Phase 2 genomes by T.genomeFrom.
  T.NPC_SPECIES = [
    { id: 'grazeling', name: 'Grazeling', level: 'herbivore', archetype: 'herd-grazer', startPop: 80, herdSize: [10, 30],
      base: { speed: 0.16, sight: 6 }, eats: ['moss', 'reed'],
      genome: { size: 3, diet: 0, social: 2, repro: 3, cohesion: 0.8, boldness: 0.5, tail: 1 }, flags: { stampede: true },
      behavior: 'Herds of 10–30; stampede when attacked.', weakness: 'Overgrazes and crashes in winter.' },
    { id: 'hopper', name: 'Burrow Hopper', level: 'herbivore', archetype: 'burrower', startPop: 70,
      base: { speed: 0.15, sight: 5 }, eats: ['moss', 'bloom', 'fruit'],
      genome: { size: 1, diet: 0, repro: 2, camo: 1, longevity: 2.5, tail: 0, roam: 5 }, flags: { burrow: true },
      behavior: 'Breeds fast (r-strategist); hides in burrows.', weakness: 'Tiny energy per kill.' },
    { id: 'tuskbeast', name: 'Tuskbeast', level: 'herbivore', archetype: 'browser', startPop: 12, herdSize: [4, 6],
      base: { speed: 0.11, sight: 5 }, eats: ['iron', 'reed'],
      genome: { size: 10, diet: 0, social: 2, repro: 9, bite: 2, armor: 1, longevity: 5, tail: 3, cohesion: 0.8 }, flags: { charge: true },
      behavior: 'Charges predators; slow breeder.', weakness: 'Calves unprotected at herd edges.' },
    { id: 'scuttler', name: 'Scuttler', level: 'omnivore', archetype: 'scavenger', startPop: 25,
      base: { speed: 0.10, sight: 6 }, eats: ['fruit', 'carrion', 'moss'],
      genome: { size: 2, diet: 5, repro: 3, metabolism: 'ecto', limbs: 6, tail: 0 }, flags: { skittish: true, scavenger: true },
      behavior: 'Scavenges kills; flees everything.', weakness: 'Low speed, predictable routes.' },
    { id: 'thornback', name: 'Thornback', level: 'omnivore', archetype: 'armored-forager', startPop: 15,
      base: { speed: 0.09, sight: 3.5 }, eats: ['moss', 'reed', 'bloom', 'fruit', 'hopper'],
      genome: { size: 5, diet: 4, spines: 3, armor: 1, repro: 6, metabolism: 'ecto', boldness: 0.9, tail: 3 },
      behavior: 'Spined; costly to attack.', weakness: 'Poor senses; easy to ambush.' },
    { id: 'stalker', name: 'Stalker', level: 'carnivore1', archetype: 'ambusher', startPop: 5,
      base: { speed: 0.19, sight: 7 }, eats: ['grazeling', 'hopper'],
      genome: { size: 4, diet: 10, camo: 2, bite: 1, repro: 6, metabolism: 'ecto', coat: 2, tail: 1 }, flags: { ambush: true },
      behavior: 'Solo ambush from tall cover.', weakness: 'Weak in open ground.' },
    { id: 'packjaw', name: 'Packjaw', level: 'carnivore1', archetype: 'pack-hunter', startPop: 6, herdSize: [3, 6],
      base: { speed: 0.19, sight: 7 }, eats: ['grazeling', 'scuttler', 'carrion'],
      genome: { size: 5, diet: 9, social: 3, bite: 1, repro: 5, cohesion: 0.85, tail: 2 }, flags: { pack: true },
      behavior: 'Hunts in packs of 3–6.', weakness: 'Pack collapses if the alpha dies.' },
    { id: 'glidewing', name: 'Glidewing', level: 'carnivore1', archetype: 'aerial', startPop: 5,
      base: { speed: 0.22, sight: 9 }, eats: ['hopper', 'scuttler'],
      genome: { size: 2, diet: 10, repro: 5, organs: { flight: true }, limbs: 2, roam: 10 }, flags: { aerial: true },
      behavior: 'Aerial; dives from above.', weakness: 'Grounded in rain events.' },
    { id: 'dreadmaw', name: 'Dreadmaw', level: 'carnivore2', archetype: 'apex-territorial', startPop: 3,
      base: { speed: 0.14, sight: 8, apex: true }, eats: ['packjaw', 'stalker', 'tuskbeast', 'carrion'],
      genome: { size: 14, diet: 10, bite: 3, armor: 2, repro: 10, longevity: 6, boldness: 1, tail: 3, head: 2 }, flags: { territorial: true },
      behavior: 'Apex, territorial; 2–4 individuals.', weakness: 'Very high upkeep; starves fast.' },
    { id: 'rotmite', name: 'Rotmite', level: 'decomposer', archetype: 'detritivore', startPop: 40,
      base: { speed: 0.06, sight: 3 }, eats: ['detritus', 'carrion'],
      genome: { size: 0.5, diet: 5, repro: 6, metabolism: 'ecto', limbs: 6, longevity: 3 }, flags: { decomposer: true, asexual: true, population: true },
      behavior: 'Returns nutrients to soil.', weakness: 'Not a rival; killing them hurts producers.' },
  ];

  // Species that only arrive through world events.
  // Open Channel: mostly open water. Phytoplankton holds little standing crop but regrows in about a second,
  // so the grazers outweigh it at any moment while it still out-produces them: an inverted biomass pyramid
  // (the English Channel example, P 4 → H 21 g/m²). swim = moves in water only; filter = strains plankton while drifting.
  T.CHANNEL_PRODUCERS = [
    { id: 'drift', name: 'Driftbloom', kind: 'plankton', max: 30, resp: 0.35, edible: 0.9, height: 0, leaf: 1.4, regrowDelay: 0, fruit: false, tough: 0, moist: 1,
      color: [96, 170, 150], note: 'Single-celled algae across the open water. Almost no standing crop; regrows in about a second.' },
    { id: 'eelgrass', name: 'Eelgrass', kind: 'aquatic', max: 30, resp: 0.45, edible: 0.3, height: 0, leaf: 1.0, regrowDelay: 20, fruit: false, tough: 0.3, moist: 0.95,
      color: [110, 160, 120], note: 'Meadows in the shallows around the islands.' },
  ];

  T.CHANNEL_SPECIES = [
    { id: 'driftling', name: 'Driftling', level: 'herbivore', archetype: 'filter-feeder', startPop: 450, herdSize: [15, 30],
      base: { speed: 0.07, sight: 3 }, eats: ['drift'],
      genome: { size: 0.3, diet: 0, repro: 0, metabolism: 'ecto', limbs: 6, longevity: 2, tail: 0, roam: 4, cohesion: 0.4 }, flags: { swim: true, filter: true, population: true },
      behavior: 'Drifting swarms that strain phytoplankton from the water.', weakness: 'Tiny and defenceless; everything eats them.' },
    { id: 'glassclam', name: 'Glassclam', level: 'herbivore', archetype: 'filter-feeder', startPop: 90,
      base: { speed: 0.02, sight: 2 }, eats: ['drift'],
      genome: { size: 1.2, diet: 0, repro: 4, armor: 3, metabolism: 'ecto', limbs: 2, longevity: 4, tail: 0, roam: 1 }, flags: { swim: true, filter: true, population: true },
      behavior: 'Barely moves; filters whatever the current brings.', weakness: 'Cannot flee.' },
    { id: 'tidecrab', name: 'Tidecrab', level: 'omnivore', archetype: 'scavenger', startPop: 30,
      base: { speed: 0.08, sight: 4 }, eats: ['eelgrass', 'drift', 'carrion'],
      genome: { size: 1.5, diet: 3, armor: 2, repro: 3, metabolism: 'ecto', limbs: 6, tail: 0 }, flags: { swim: true, scavenger: true },
      behavior: 'Picks over the shallows and the sea floor.', weakness: 'Slow in open water.' },
    { id: 'silverfin', name: 'Silverfin', level: 'carnivore1', archetype: 'schooling-fish', startPop: 20, herdSize: [8, 15],
      base: { speed: 0.2, sight: 6 }, eats: ['driftling', 'glassclam'],
      genome: { size: 1.5, diet: 9, repro: 8, longevity: 5, metabolism: 'ecto', limbs: 2, tail: 2, social: 2, cohesion: 0.8 }, flags: { swim: true },
      behavior: 'Schools that sweep through Driftling swarms.', weakness: 'Easy prey for seals and gulls.' },
    { id: 'skimgull', name: 'Skimgull', level: 'carnivore1', archetype: 'aerial', startPop: 4,
      base: { speed: 0.24, sight: 9 }, eats: ['driftling', 'carrion'],
      genome: { size: 1.2, diet: 9, repro: 8, longevity: 5, organs: { flight: true }, limbs: 2, roam: 12 }, flags: { aerial: true },
      behavior: 'Picks Driftlings from the surface.', weakness: 'Burns energy fast to stay warm.' },
    { id: 'greyseal', name: 'Greyseal', level: 'carnivore2', archetype: 'apex-swimmer', startPop: 2,
      base: { speed: 0.2, sight: 8, apex: true }, eats: ['silverfin', 'carrion'],
      genome: { size: 10, diet: 10, bite: 2, repro: 10, longevity: 6, fat: 3, tail: 2, limbs: 2 }, flags: { swim: true },
      behavior: 'Apex swimmer; a thick blubber layer holds its warmth.', weakness: 'Needs many fish.' },
    { id: 'siltworm', name: 'Siltworm', level: 'decomposer', archetype: 'detritivore', startPop: 60,
      base: { speed: 0.05, sight: 3 }, eats: ['detritus', 'carrion'],
      genome: { size: 0.4, diet: 5, repro: 5, metabolism: 'ecto', limbs: 0, longevity: 3 }, flags: { decomposer: true, asexual: true, swim: true, population: true },
      behavior: 'Works through sinking detritus on the sea floor.', weakness: 'Not a rival; killing them starves the plankton.' },
  ];

  T.EVENT_SPECIES = {
    marauder: { id: 'marauder', name: 'Mirefang', level: 'omnivore', archetype: 'opportunist', startPop: 8, invasive: true,
      base: { speed: 0.15, sight: 6 }, eats: ['moss', 'bloom', 'fruit', 'hopper', 'scuttler', 'carrion'],
      genome: { size: 4, diet: 6, bite: 1, repro: 2, coat: 3 },
      behavior: 'Invasive generalist.', weakness: 'No local adaptations yet.' },
    wanderbuck: { id: 'wanderbuck', name: 'Wanderbuck', level: 'herbivore', archetype: 'herd-grazer', startPop: 24, transient: true,
      base: { speed: 0.13, sight: 5 }, eats: ['moss', 'reed'],
      genome: { size: 4, diet: 0, social: 3, repro: 10, cohesion: 0.9 },
      behavior: 'Migrating herd crossing the map.', weakness: 'Leaves at the far edge.' },
  };

  // Phase 1 founder templates (still offered on the New world screen).
  T.TEMPLATES = [
    { id: 'grazer', name: 'Grazer', level: 'herbivore', niche: 'Herbivore', startPop: 20, strength: 'Huge energy base', risk: 'Hunted by everything',
      base: { speed: 0.15, sight: 6 }, genome: { size: 3, diet: 0, speed: 1, senses: 1, plantGut: 1, social: 2, repro: 3, cohesion: 0.7 } },
    { id: 'opportunist', name: 'Opportunist', level: 'omnivore', niche: 'Omnivore', startPop: 12, strength: 'Flexible diet', risk: 'Mediocre digestion',
      base: { speed: 0.15, sight: 6 }, genome: { size: 3, diet: 5, senses: 1, bite: 1, speed: 1, repro: 5 } },
    { id: 'hunter', name: 'Hunter', level: 'carnivore1', niche: 'Carnivore', startPop: 8, strength: 'Strong offense', risk: 'Depends on prey numbers',
      base: { speed: 0.17, sight: 7 }, genome: { size: 4, diet: 9, bite: 2, speed: 2, meatGut: 1, social: 1, repro: 6, coat: 2, tail: 2 } },
    { id: 'tyrant', name: 'Tyrant', level: 'carnivore2', niche: 'Apex', startPop: 3, strength: 'Kills anything', risk: 'Tiny, fragile population (hard mode)',
      base: { speed: 0.14, sight: 8, apex: true }, genome: { size: 11, diet: 10, bite: 3, armor: 1, repro: 9, longevity: 5, head: 2, tail: 3 } },
  ];

  T.DIRECTIVES = [
    { id: 'forage',  key: '1', name: 'Forage',  desc: 'Prioritise eating; ignore distant threats.' },
    { id: 'hunt',    key: '2', name: 'Hunt',    desc: 'Seek prey aggressively, including larger prey.' },
    { id: 'hide',    key: '3', name: 'Hide',    desc: 'Freeze in cover: +40% camouflage, no eating.' },
    { id: 'migrate', key: '4', name: 'Migrate', desc: 'Travel to the territory marker.' },
    { id: 'swarm',   key: '5', name: 'Swarm',   desc: 'Gather at the marker and defend each other.' },
    { id: 'isolate', key: '6', name: 'Isolate', desc: 'Your individuals inside the marker only mate with each other, to encourage a split.' },
  ];

  T.EVENTS = [
    { id: 'drought',  name: 'Drought',          effect: 'Sunlight −30% for 1 round. High-upkeep individuals will starve first.', chip: 'sunlight −30%', rounds: 1 },
    { id: 'volcanic', name: 'Volcanic winter',  effect: 'Sunlight −50% for 2 rounds; ectotherms slowed all round.', chip: 'sunlight −50%', rounds: 2 },
    { id: 'invasive', name: 'Invasive species', effect: 'Mirefangs arrive in one corner. Permanent.', chip: 'new arrivals', rounds: 0 },
    { id: 'plague',   name: 'Plague',           effect: 'The most populous species loses 30% of individuals.', chip: 'plague', rounds: 0 },
    { id: 'bloom',    name: 'Bloom',            effect: 'Producer growth +50% for 1 round.', chip: 'producer growth +50%', rounds: 1 },
    { id: 'migration', name: 'Migration wave',  effect: 'A herd of Wanderbucks crosses the map.', chip: 'herd crossing', rounds: 1 },
    { id: 'wildfire', name: 'Wildfire',         effect: 'A fire spreads through dry growth; burned tiles restart at the grasses stage.', chip: 'wildfire', rounds: 0 },
    { id: 'flood',    name: 'Flood',            effect: 'Low ground loses its growth and is waterlogged, so it denitrifies for a while.', chip: 'flood', rounds: 0 },
    { id: 'windthrow', name: 'Windstorm',       effect: 'Scattered shrubs and trees fall, opening light gaps.', chip: 'light gaps', rounds: 0 },
  ];

  T.TUTORIAL = {
    1: { evolve: 'Every creature runs on energy (EU). Sunlight feeds producers, and your species eats to capture a share of it. Queue orders with Mutation Points, then start the season.',
         sim: 'Producers store about 10% of the sunlight that reaches them. The pyramid on the left shows the energy flowing into each level — each step up gets far less. Click any creature to inspect its genes.' },
    2: { evolve: 'Upkeep: every trait costs EU every tick. The meter shows the spread of your individuals — the costliest starve first when food runs short.',
         sim: 'Directives (keys 1–6) steer your species. Place a territory marker with right-click, the T key, or a long-press on touch screens.' },
    3: { evolve: 'Rivals share your food or hunt you. Defeat them by out-eating, out-hunting or starving them — but if producers collapse, the whole pyramid starves with them.',
         sim: 'A rival is defeated when it goes extinct or stays below 10% of its starting population for 2 rounds.' },
    4: { evolve: 'Your individuals are not identical. Each histogram shows how a gene varies across the population. Pin a gene to favour its top 25% as breeders, or buy a real mutant from the tray.',
         sim: 'Selection is happening now: the individuals that eat and survive pass on their genes. Turn on Variation tint to see who is fast and who is slow.' },
  };

  // Codex "real-world ecology" notes, chosen by archetype, level or event.
  T.ECOLOGY = {
    speciation: { title: 'Splitting without a barrier', text: 'Most species split after a mountain or river divides them. Some split in place, by food and habitat. The apple maggot fly Rhagoletis pomonella is a real case: after apples reached North America, some flies shifted from hawthorn to apple trees, and the two groups are now diverging.' },
    'herd-grazer': { title: 'Safety in numbers', text: 'In a herd, each animal can spend less time watching for predators and more time eating, because many eyes share the job. Wildebeest herds on the Serengeti also time births so that predators are swamped by calves all at once.' },
    burrower: { title: 'Living fast', text: 'r-strategists such as rabbits breed early and often and invest little in each young. Most offspring die, but the population can rebound quickly after a crash. Ecologists Robert MacArthur and E. O. Wilson popularised the r/K contrast in 1967.' },
    browser: { title: 'Big bodies, slow lives', text: 'Kleiber\'s law says metabolic rate scales with mass to the 0.75 power, so large animals burn less energy per kilogram. That lets elephants live on low-quality food, but they breed slowly and recover slowly from losses.' },
    'fruit-specialist': { title: 'Fruit is easy energy', text: 'Fruit is rich in sugars and easy to digest, so fruit-eaters assimilate more of each meal than leaf-eaters. In return they must track a food supply that comes and goes with the seasons.' },
    scavenger: { title: 'Cleaning up', text: 'Scavengers such as vultures recycle carcasses quickly. Where vulture numbers crashed in South Asia in the 1990s, carcasses lingered and feral dog populations grew.' },
    'armored-forager': { title: 'Paying for armour', text: 'Defences cost energy to grow and carry. Armoured animals such as armadillos and porcupines trade speed and efficiency for being too costly to attack.' },
    opportunist: { title: 'Generalists and invasions', text: 'Generalists that eat many foods often make successful invaders. Cane toads, released in Australia in 1935, spread across millions of square kilometres partly because they eat almost anything that fits in their mouth.' },
    ambusher: { title: 'Waiting pays', text: 'Ambush predators spend little energy searching. Many snakes and crocodiles can go weeks between meals because they sit still, strike rarely and rely on camouflage.' },
    'pack-hunter': { title: 'Hunting together', text: 'Pack hunters such as wolves and African wild dogs can bring down prey much larger than themselves. Sharing each kill is the price of that reach.' },
    aerial: { title: 'Flight is expensive', text: 'Flapping flight is one of the most energy-hungry ways to move, but it covers ground fast and ignores terrain. Birds of prey soar on rising air to save energy while they search.' },
    'venomous-stalker': { title: 'Chemical weapons', text: 'Venom lets a small predator subdue large prey without a long fight. Making venom costs energy, so some snakes meter how much they inject.' },
    'apex-territorial': { title: 'Top of the pyramid', text: 'Apex predators are rare because each trophic step keeps only about a tenth of the energy below it. Raymond Lindeman described this energy loss in 1942. When wolves returned to Yellowstone in 1995, their effect on elk rippled down to the plants — a trophic cascade.' },
    'apex-scavenger': { title: 'Stealing kills', text: 'Large carnivores often take food from smaller ones. Spotted hyenas and lions steal kills from each other, and cheetahs lose a share of theirs to both.' },
    detritivore: { title: 'The recyclers', text: 'Decomposers return nutrients from dead matter to the soil, where producers can use them again. Energy flows one way through a food web, but nutrients go round in a cycle.' },
    'carrion-specialist': { title: 'Recycling bodies', text: 'Carrion beetles bury small carcasses and raise their young on them, turning a dead body back into soil nutrients within days.' },
    producer: { title: 'Where the energy starts', text: 'Real plants store only about 1–3% of the sunlight that hits them as new growth. Keystone raises that for playability, but the shape of the pyramid is the same.' },
    evolution: { title: 'Selection you can measure', text: 'During a 1977 drought on the Galápagos island Daphne Major, medium ground finches with deeper beaks survived better because they could crack the hard seeds that remained. Peter and Rosemary Grant measured the change in the next generation.' },
  };
})(window.Trophic);
