# Keystone species art: style guide (P3-ART)

Every catalog species is drawn from its taxon group's **template**, a layered, hand-authored canvas drawing, plus a
**tweak set** worked out from its catalog entry. This guide covers the look, the frame, how templates and tweaks fit
together, how to add a template, and which template each taxon group uses.

Code:

| File | What it holds |
| --- | --- |
| `js/spritetweaks.js` | Pure data, no canvas (Node loads it too): template choice, tweak derivation, the look-alike distance, per-catalog separation |
| `js/templates.js` | Shared parts (paths, outlines, limbs, eyes, spots), the quadruped skeleton, bats, marine mammals and the bird skeleton |
| `js/templates-more.js` | Snakes, lizards and salamanders, turtles, frogs, fish, insects, spiders, crustaceans, snails, worms and the plants |
| `js/sprites.js` | `T.getSprite` (the per-species cache) and `T.paintCreature` (Codex portraits) draw a template when the species has a tweak set, and fall back to Phase 2's genome creature otherwise |
| `tools/check-sprites.js` | The look-alike check over every built catalog |
| `tools/sprite-gallery.html` | A dev page showing every species of a catalog, grouped by template (`?c=9.4.6`, `&t=canid,felid`, `&n=6`, `&sheet=1` for a single contact sheet) |

## The look

- **Flat and friendly.** Rounded shapes, flat fills, no gradients or textures. Depth comes from one lighter or darker
  shade of a region's colour: far legs and far ears are 12 points darker, highlights 10 points lighter.
- **Outline.** One ink colour, `#1F2A24`, at **2.2% of body length** (`LW = 0.022` in the unit frame). Parts that make
  up one silhouette (body, neck and head; a frog's body and thigh) are outlined together: an ink pass at double
  width, then the fills on top, so no seams show between them. Small details (veins, toes, whiskers) use 0.4 to 0.8 of
  the outline weight.
- **Eyes.** An ink dot with a small cream highlight (`#FBF8F1`); raptors, owls, snakes, fish and frogs get a coloured
  iris. The eye is always drawn, except for moles and blind cave fish.
- **Shadow.** A soft ink ellipse at 13% opacity under the feet in portraits. Map sprites are drawn without it (the map
  has its own tiles under them).
- **Palette.** Colours are naturalistic, not trophic-level colours: a red fox is rufous, a gray fox grey. Every colour
  is stored as HSL and clamped to saturation ≤ 82% and lightness 12–94%, so nothing is neon, pure black or pure
  white. Cream (`#F4EFE3`) stands in for white markings; ink stands in for black ones. Water is a light blue ellipse at
  35% opacity. The trophic level still shows everywhere else: zoomed-out icons, the Codex list, pyramids.
- **Facing.** Side view, facing right. The map flips a sprite horizontally when the animal walks left. Butterflies
  and dragonflies are drawn from above, since that's how people recognise them.

## The frame and anchor points

Templates draw in a **unit frame**: the creature is about 1 unit long, centred on (0, 0), with the **ground at
y = +0.3**. Room is 1.45 units wide and 0.95 above the ground; a template whose tweaks make it bigger (a heron's neck,
a moose's antlers, a tall tree) scales itself down about the ground point (`SK.fit`). `T.getSprite` draws at 1.3× the
cache bucket (28, 56 or 112 px); `T.paintCreature` fits the frame to a Codex canvas.

Each skeleton computes its anchor points from the tweak set's proportions and attaches parts there:

- **Quadruped:** shoulder and hip (legs), neck base (neck, then the head along the neck angle), tail base, the head's
  skull centre (ears, eye, horns or antlers) and snout tip (nose, mouth, muzzle markings). A seated or hopping pose
  rotates the body about the hip and swaps the hind leg for a haunch.
- **Bird:** body centre and tilt (per pose), neck base, head centre, bill root, tail root, hip (legs), shoulder (the
  folded wing, or raised wings when flying).
- **Sprawl (lizards, salamanders):** body centre, fore and hind hips, tail root, head.
- **Fish:** snout, gill line, dorsal and anal fin roots, tail stalk.
- **Insects:** head, thorax and abdomen centres, leg roots on the thorax, wing root.
- **Plants:** ground point, stem tops (flower heads), leaf nodes along the stem, crown centre.

Layers go back to front (quadruped): shadow, far legs, near legs (their tops tucked under the body), tail, ears, the
body silhouette (body + neck + head), body markings (clipped to the body), face details, horns or antlers. Seated
animals draw their haunch and near legs over the body instead.

## Recolourable regions

A tweak set's `col` maps region names to `[hue, saturation, lightness]`. The regions a template uses:

| Group | Regions |
| --- | --- |
| Mammals | `body`, `belly`, `head`, `tail`, `leg` (socks), `mark` (stripes, spots, mask, tail tip) |
| Birds | `body` (upperparts), `belly`, `head`, `wing`, `tail`, `bill`, `leg`, `mark` (cap, mask, bib, spots) |
| Reptiles, amphibians | `body`, `belly`, `head`, `mark` |
| Fish | `body`, `belly`, `fin`, `mark` |
| Insects | `body`, `wing` (or `hind` for butterflies' hindwings, `band` for bee bands, `gaster` for ants), `eye`, `mark` |
| Spiders | `body` (cephalothorax), `abdomen`, `leg`, `mark` |
| Plants | `leaf`, `flower` or `fruit`, `center`, `stem` or `trunk`, `mark` |

## How tweaks work

`T.SpriteTweaks.derive(entry)` turns a catalog entry into a tweak set:

```js
{ v: 1, key: '<catalog key>', tpl: 'canid', size: 'm', pose: 'stand',   // a red fox, abridged
  p: { leg: 1.05, depth: 0.96, neck: 1, tail: 1.25, ear: 1.1, snout: 1.02, head: 1 },   // proportions (×)
  parts: { head: 'dog', ear: 'point', tail: 'brush', feet: 'paw' },                      // variant parts
  col: { body: [18, 64, 48], belly: [40, 30, 88], leg: [15, 30, 18], mark: [15, 25, 15] },
  marks: { belly: 1, socks: 1, tailTip: 1, earBack: 1 } }                               // markings on/off/size
```

It is deterministic, and built in this order:

1. **Template** from the entry's taxon (and family for a few: marine mammals, pikas, pigs; cacti, agaves and yuccas;
   trees filed as forbs).
2. **Family and genus looks.** Each template's `derive` has tables of what its families and iconic genera look like:
   a Vulpes fox is rufous with a white tail tip and black socks; Urocyon is grey with a rufous belly and a black
   dorsal stripe; a Crotalus has diamonds and a rattle; Papilio is a yellow tiger-striped swallowtail.
3. **The common name.** `parseName` reads colour words and which region they paint ("Red-tailed" → tail, "Black-capped"
   → head, "Yellowlegs" → legs, a plain "Gray Fox" → body), patterns ("spotted", "striped", "banded", "collared",
   "masked", "crested", "horned", "diamond", "checkered"), counts ("Sevenspotted", "Four-lined"), size words
   ("Giant", "Least") and part lengths ("Long-tailed", "Big-eared", "Short-horned").
4. **Mass.** The size class (xs < 5 g, s < 100 g, m < 3 kg, l < 60 kg, xl) and body depth; antler size in deer; body
   size in songbirds. The on-map size still comes from the game's body mass (`render.js`).
5. **A small per-species jitter** from a hash of the key: ±8% on proportions, ±8–10° hue and ±5 lightness per region.
6. **Overrides.** A catalog entry may carry `tweaks` (any subset of the fields above); it is merged last, and the
   species is then pinned (the separation step won't nudge it).

Guilds that are never drawn (soil fungi, bacteria, microbes) get no tweak set; nor do the fictional worlds' species,
which keep the genome-driven creature from Phase 2.

At runtime `Catalog.speciesDef` and `Catalog.producerDef` store the separated tweak set on the definition, the world
keeps it in `sp.meta.tweaks` (animals) or on the producer, and saves carry it.

## Look-alikes and separation

Two species of the same template can come out too close. `T.SpriteTweaks.distance(a, b)` measures what is visible:

- a different template: 2 (always distinct);
- each differing part: 0.3 (a differing marking count: 0.09); a differing pose: 0.25;
- proportions: 0.6 × |ln(a/b)| per proportion (scaled down when a template has many);
- colour: each region's CIELAB ΔE76 (capped at 60) ÷ 40, times the region's area weight (the body counts most);
- markings: 0.3 × the difference in each marking's strength (capped at 1).

The threshold is **0.5**, and **0.7 for candidates for the same slot** (two species sharing a role), since those
appear side by side. A coyote, red fox and gray fox score 1.4–2.4 apart before any separation.

`T.SpriteTweaks.forCatalog(cat)` derives every species of a catalog (plus domestic cattle), then walks each template's
species in catalog order: whenever one lands within the threshold of an earlier one, it is **nudged** until it
clears all of them. Nudges go markings first and colour last, so a nudged species still looks like its group: switch
on a marking the other lacks, stretch a proportion, swap a variant part, shift lightness, recolour the markings, then
rotate the main hue. The result is memoized per catalog build.

`node tools/check-sprites.js` re-runs this for every catalog in `js/catalogs/index.js`, lists how many collisions
needed separating, verifies no pair is left under its threshold, spot-checks the canids, and **exits 1** on any
unresolved look-alike. `--verbose` lists every nudged species.

## Adding a template

1. Pick or write a **skeleton** in `js/templates.js` or `js/templates-more.js` (`SK.skeletons.<name> = function (D)`).
   `D.c(region, dl)` gives a colour, `D.p(name)` a proportion, `D.m(name)` a marking's strength, `D.part(name)` a
   variant, `D.rnd()` a per-species random number. Use the shared parts: `blobPath`, `ellPath`, `taperPath`,
   `group` (one outline for several shapes), `clipTo` (markings inside a region), `limb`, `line`, `eye`, `spots`,
   `shadow` and `fit`.
2. Register the template in `js/spritetweaks.js` with `def(id, { skeleton, regions, nudge, derive })`: `regions` are
   the colour regions and their share of what the eye sees (they weight the distance), `nudge` lists the markings,
   parts and proportions the separation step may change, and `derive(x)` returns the tweak set (`x.fam`, `x.genus`,
   `x.sci`, `x.nm` (the parsed name), `x.h(tag)` and `x.pick(tag, list)` for stable choices).
3. Map the taxon (or family) to it in `TEMPLATE_OF` / `templateFor`.
4. Draw every marking the derive can set; `tools/check-sprites.js` must pass, and the gallery page should look right
   at both portrait size and 28 px.

Adding a species needs no art: its catalog entry is enough, unless its taxon group has no template yet.

## Taxon groups and their templates

Counts are species entries across the 18 built catalogs (5,801 entries; a species in two catalogs counts twice).

| Template | Taxon groups (catalog `taxon`) | Entries | Skeleton | Variants |
| --- | --- | --- | --- | --- |
| `forb` | forb | 768 | plant | flower head (daisy, sunflower, coneflower, spike, plume, umbel, bell, tube, trumpet, pea, cup, star, 3-petal, globe, cluster, thistle, iris, orchid, slipper, spathe), leaf shape, stem count |
| `tree` | tree; plus pines, palms, cycads and the like filed as forbs | 828 | plant | crown (round, oval, vase, umbrella, spreading, column, weeping, cone, spire, pine, palm, cycad, Joshua tree), bark, fruit, flowers, cones, nuts, autumn colour |
| `shrub` | shrub | 229 | plant | shape, leaf texture (fine, broad, needle, leafless), berries, flowers, thorns |
| `succulent` | cacti, agaves, yuccas, sotols, stonecrops (any habit) | 80 | plant | paddle, cholla, column, hedgehog, barrel, pincushion, agave, yucca, sotol, rosette |
| `grass` | grass; sedges and rushes | 75 | plant | seed head (spike, panicle, plume, turkeyfoot, flag, sideoats, awned, nodding, bottlebrush, sedge, rush, bulrush), clump |
| `vine` | vine | 51 | plant | leaf, flower (trumpet, pea, grapes, berries, passionflower…), tendrils |
| `aquatic` | aquatic | 15 | plant | lily pad, cattail, reed, arrowhead, arum, floating, submerged |
| `songbird` | songbird (all perching birds, doves, parrots, swifts, hummingbirds, nightjars, seabirds that key out here) | 539 | bird | bill (cone, thin, stout, spike, hook, curved, flat, parrot, needle, tube…), crest, tail (short, long, fork, notch, wedge, cocked), pose (perch, swim, fly, glide, hover, cling) |
| `wader` | wader (herons, egrets, cranes, shorebirds, gulls, terns, rails, grebes, loons, pelicans, cormorants) | 435 | bird | pose tall/perch/swim, bill (dagger, probe, curved, upcurved, gull, pouch…), plumes, collars |
| `raptor` | raptor (hawks, eagles, falcons, owls, vultures) | 38 | bird | owl head and face disc, ear tufts, bald head, moustache, tail bands; upright or hunched |
| `waterfowl` | waterfowl (ducks, geese, swans) | 57 | bird | bill (duck, goose, shoveler, merganser), neck length, crest, speculum, cheek patches |
| `gamebird` | gamebird (grouse, quail, pheasants, turkeys) | 29 | bird | tail (fan, long, pin), topknot plume, wattle, air sacs |
| `woodpecker` | woodpecker | 18 | bird | clinging pose, chisel bill, nape and cap colour, barring, back patch |
| `canid` | canid | 27 | quadruped | tail (bushy, brush), mask, socks, tail tip |
| `felid` | felid | 32 | quadruped | tail (long, bobbed), ear tufts, spots, stripes |
| `cervid` | cervid (deer, elk, moose, pronghorn) | 34 | quadruped | antlers (branched, palmate, spike), pronghorn horns, rump patch, spots |
| `bovid` | bovid; pigs and peccaries | 34 | quadruped | horns (curled, short, lyre, spike, spiral), hump, beard, tusks, pig snout |
| `ursid` | ursid | 14 | quadruped | round ears, muzzle, shoulder hump |
| `mustelid` | mustelid (weasels, otters, badgers, skunks, raccoons, ringtails) | 82 | quadruped | skunk stripes and spots, raccoon mask and ringed tail, badger blaze, floating otter |
| `rodent` | rodent; shrew and mole; opossum | 237 | quadruped | head (mouse, shrew, mole, beaver), tail (thin, naked, bushy, plume, paddle, tufted, short), cheek pouches, quills, star nose, seated and hopping poses |
| `lagomorph` | lagomorph; pika | 55 | quadruped | ear length, tail (puff, black-topped), seated pose |
| `bat` | bat | 93 | bat | ears (big, pointed, round), nose leaf, frosted fur |
| `marine` | marine mammals (whales, dolphins, seals, sea lions, walrus, manatee) | 43 | marine | body plan per kind, dorsal fin, pleats, callosities |
| `snake` | snake | 51 | snake | head (round, viper, hognose), tail (point, rattle), bands, blotches, diamonds, stripes, collar |
| `lizard` | lizard | 33 | sprawl | horns, spikes, dewlap, collars, stripes, blue tail, beads |
| `salamander` | salamander | 68 | sprawl | external gills, paddle tail, spots, stripes, folds |
| `turtle` | turtle | 139 | turtle | shell (dome, high, flat, ridged, pancake), flippers or elephant legs, ear stripe, neck stripes |
| `frog` | frog | 81 | frog | smooth or warty skin, toe pads, spots, stripes, mask, tympanum, parotoid glands |
| `fish` | fish | 223 | fish | body shape (deep, bass, minnow, chub, humpback, sucker, catfish, darter, pike, pupfish, goby, grouper, carp, swordfish, gar, sturgeon, eel), tail and fins, barbels, bars, spots, stripes |
| `butterfly` | butterfly (butterflies and moths) | 435 | butterfly (top view) | wing shape (round, scalloped, swallowtail, skipper, moth, sphinx, narrow, clearwing), eyespots, borders, tiger stripes, veins, hindwing flash, antennae |
| `dragonfly` | dragonfly (dragonflies and damselflies) | 185 | dragonfly (top view) | dragon or damsel, clubbed tail, wing spots and bands, abdomen rings, pruinose |
| `bee` | bee, wasp | 178 | hymen | bumble, honey, sweat, mining, mason, carpenter, longhorn, cuckoo, wasp, paper wasp, velvet ant, gall wasp; bumblebee band patterns |
| `ant` | ant | 79 | hymen | worker, big-headed, long-legged, spiny; two-tone gaster |
| `beetle` | beetle | 120 | beetle | shape (round, oval, long, ground, tiger, weevil, soft, scarab, rove, flat, dome, bullet, stag), antennae (short, long, huge, club, fan, elbowed, saw), spots, bands, lantern |
| `bug` | bug (true bugs, cicadas, mantises, stick insects, fishflies…) | 58 | bug | shield, long, leaf-footed, assassin, cicada, aphid, hopper, strider, mantis, stick, fishfly, lacewing, ice crawler, water bug |
| `grasshopper` | grasshopper (grasshoppers, crickets, katydids) | 40 | hopper | hopper, lubber, katydid, shieldback, cricket, camel cricket, Jerusalem cricket, pygmy, monkey grasshopper |
| `fly` | fly | 21 | fly | house, hover, drone, lovebug, crane, mosquito, bee fly, robber, horse fly |
| `spider` | spider (arachnids, scorpions included) | 112 | spider | orb weaver, long-jawed, wolf, jumper, tarantula, widow, crab, cellar, lynx, harvestman, mite, scorpion |
| `crustacean` | crustacean | 74 | crust | crayfish, spiny lobster, shrimp, isopod, amphipod; cave forms pale and eyeless |
| `snail` | snail | 56 | snail | round, tall, left-handed, flat, slug, abalone, limpet |
| `worm` | worm | 35 | worm | earthworm, thin aquatic worm, leech |

Shared templates, where the anatomy is close enough that tweaks carry the difference: shrews, moles and the opossum
use `rodent`; pikas use `lagomorph`; pigs and peccaries use `bovid`; wasps use `bee`; scorpions use `spider`; sedges and
rushes use `grass`; conifers, palms and cycads filed as forbs use `tree`. The fallback taxa `mammal`, `bird`,
`reptile`, `amphibian`, `insect` and `arachnid` map to `rodent`, `songbird`, `lizard`, `frog`, `bug` and `spider`.
Every species in the 18 launch catalogs currently has a real template (no fallback).

## Known limits

- Map sprites are single frames (no walk cycle) at three cache sizes; the Codex portrait passes `t` for a hint of
  wing flap only.
- Separation runs per catalog, so a species present in two catalogs can get a different nudge in each (always the
  same within one catalog and one world).
- About a third of species need at least one nudge. The nudged species are listed by `--verbose`, and the gallery
  marks them; the ones that matter most can be given hand-picked `tweaks` overrides in the catalog.
