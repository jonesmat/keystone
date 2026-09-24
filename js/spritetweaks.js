// Keystone — species sprite tweak sets (P3-ART). Pure data, no canvas: Node tools load this too.
// Every catalog species maps to its taxon group's template (js/templates.js draws them) plus a tweak set derived
// deterministically from its catalog entry: proportions, variant parts, region colours, markings and pose.
// A per-catalog separation step nudges species that would look alike; tools/check-sprites.js verifies the result.
// See docs/art-style-guide.md.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  const ST = (T.SpriteTweaks = {});
  ST.VERSION = 1;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  const r1 = v => Math.round(v * 100) / 100;

  // ---------- colours ----------
  // Region colours are [hue 0–360, saturation 0–100, lightness 0–100]. Every colour is clamped into the game's
  // flat, muted range (see the style guide) when a tweak set is finished.
  const C = {
    red: [4, 62, 46], scarlet: [356, 68, 48], crimson: [350, 58, 40], vermilion: [8, 72, 50], ruby: [348, 56, 40], rose: [345, 45, 66],
    rosy: [345, 45, 66], pink: [335, 52, 72], orange: [28, 76, 54], flame: [16, 76, 52], fire: [16, 76, 52], amber: [38, 70, 50],
    copper: [22, 56, 45], rust: [18, 52, 42], rusty: [18, 52, 42], rufous: [18, 52, 44], russet: [16, 48, 40], cinnamon: [20, 46, 46],
    chestnut: [12, 46, 32], yellow: [50, 80, 58], lemon: [55, 78, 64], gold: [42, 70, 52], golden: [42, 70, 52], sulphur: [52, 72, 66],
    green: [115, 38, 42], emerald: [140, 46, 40], olive: [68, 30, 40], jade: [150, 35, 50], blue: [212, 55, 52], cerulean: [198, 58, 58],
    azure: [198, 58, 58], sky: [200, 52, 68], indigo: [235, 40, 38], purple: [275, 34, 46], violet: [270, 36, 50], lilac: [280, 30, 70],
    lavender: [265, 34, 72], black: [220, 10, 17], ebony: [220, 10, 15], sooty: [220, 8, 24], dusky: [220, 10, 28], raven: [230, 12, 16],
    white: [42, 18, 90], snowy: [210, 20, 92], snow: [210, 20, 92], ivory: [44, 40, 88], chalk: [40, 12, 88], silver: [210, 8, 78],
    whitewashed: [40, 14, 88], milk: [42, 30, 88], gray: [210, 6, 55], grey: [210, 6, 55], ashy: [200, 6, 62], ash: [200, 6, 62],
    slate: [215, 14, 45], brown: [26, 34, 33], tawny: [32, 44, 50], buff: [36, 42, 70], tan: [33, 36, 62], sand: [38, 34, 68],
    sandy: [38, 34, 68], blond: [42, 44, 72], bronze: [36, 44, 40], cream: [44, 50, 86], cobalt: [220, 60, 45], turquoise: [175, 50, 50],
    lime: [80, 55, 55], plum: [300, 30, 35], maroon: [350, 45, 28], tangerine: [26, 80, 56], saffron: [44, 80, 58], coral: [10, 65, 64],
  };
  // Stems found inside run-together names ("Redback", "Sevenspotted", "Baldfaced").
  const STEMS = ['scarlet', 'crimson', 'vermilion', 'yellow', 'orange', 'purple', 'green', 'black', 'white', 'golden', 'gold', 'silver',
    'ruby', 'blue', 'red', 'gray', 'grey', 'brown', 'rust', 'copper', 'bronze', 'fire', 'flame', 'snow', 'ivory', 'pink', 'rose'];
  // "X-Yed" compounds: which region the colour paints.
  const REGION = {
    tailed: 'tail', tail: 'tail', rumped: 'tail', bellied: 'belly', breasted: 'belly', throated: 'belly', chinned: 'belly', sided: 'belly',
    capped: 'head', crowned: 'head', headed: 'head', hooded: 'head', faced: 'head', necked: 'head', cheeked: 'head', fronted: 'head',
    eared: 'head', masked: 'head', naped: 'head', collared: 'mark', winged: 'wing', wing: 'wing', shouldered: 'wing', billed: 'bill',
    nosed: 'bill', lipped: 'bill', legged: 'leg', footed: 'leg', kneed: 'leg', knee: 'leg', toed: 'leg', backed: 'body', back: 'body',
    spotted: 'mark', spot: 'mark', striped: 'mark', banded: 'mark', lined: 'mark', barred: 'mark', ringed: 'mark', bordered: 'mark',
    margined: 'mark', tipped: 'mark', eyed: 'mark', dotted: 'mark', veined: 'mark', bowed: 'mark', patched: 'mark', spotwing: 'mark',
  };
  const COUNTS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fifteen: 15 };

  // Reads what a common name says about looks: region colours, patterns, counts, sizes and long or short parts.
  function parseName(name) {
    const s = String(name || '').toLowerCase().replace(/[’`]/g, "'");
    const toks = s.split(/[\s,()/]+/).filter(Boolean);
    const out = { col: {}, pat: new Set(), count: 0, size: 0, long: new Set(), short: new Set(), words: new Set(), pale: 0 };
    const PART = { tailed: 'tail', billed: 'bill', legged: 'leg', eared: 'ear', necked: 'neck', horned: 'horn', winged: 'wing', nosed: 'snout', toed: 'leg', snouted: 'snout', bodied: 'depth', headed: 'head' };
    for (const tok of toks) {
      const parts = tok.split('-');
      for (const p of parts) out.words.add(p.replace(/'s$/, ''));
      if (parts.length >= 2) {
        const [a, b] = [parts[parts.length - 2], parts[parts.length - 1]];
        if (C[a] && REGION[b]) out.col[REGION[b]] = out.col[REGION[b]] || C[a];
        if ((a === 'long' || a === 'big' || a === 'large' || a === 'great') && PART[b]) out.long.add(PART[b]);
        if ((a === 'short' || a === 'small' || a === 'little' || a === 'stub') && PART[b]) out.short.add(PART[b]);
      }
    }
    // Plain colour words colour the body (the first one that isn't part of a compound).
    for (const tok of toks) if (!tok.includes('-') && C[tok] && !out.col.body) out.col.body = C[tok];
    const JOINED = { legs: 'leg', leg: 'leg', knee: 'leg', back: 'body', throat: 'belly', breast: 'belly', belly: 'belly', cap: 'head', poll: 'head', head: 'head',
      crown: 'head', tail: 'tail', start: 'tail', rump: 'tail', wing: 'wing', spotted: 'mark', spot: 'mark', striped: 'mark', lined: 'mark', banded: 'mark', faced: 'head' };
    for (const tok of toks) {
      if (tok.includes('-')) continue;
      for (const st of STEMS) {
        if (!tok.startsWith(st) || tok.length <= st.length + 2) continue;
        const rest = tok.slice(st.length), region = JOINED[rest] || JOINED[rest.replace(/s$/, '')];
        if (region) { out.col[region] = out.col[region] || C[st]; }
        else if (!out.col.body) out.col.body = C[st];
        break;
      }
    }
    for (const w of out.words) {
      if (COUNTS[w]) out.count = COUNTS[w];
      for (const [k, v] of Object.entries(COUNTS)) if (w.length > k.length + 2 && w.startsWith(k) && /spot|strip|line|band|dot/.test(w)) out.count = v;
      if (/spot|dot|speck|freckl|pepper|jewel/.test(w)) out.pat.add('spots');
      if (/strip|lined$|^line|zebra|tiger|streak/.test(w)) out.pat.add('stripes');
      if (/band|barred|^bar$|ringed|ring$|girdle|belted/.test(w)) out.pat.add('bands');
      if (/check|marbl|mottl|variegat|painted|harlequin|calico|pinto|dappl|flecked|reticulat|arabesque|ornate/.test(w)) out.pat.add('mottle');
      if (/diamond/.test(w)) out.pat.add('diamonds');
      if (/collar|necked$/.test(w)) out.pat.add('collar');
      if (/mask|hooded|bandit/.test(w)) out.pat.add('mask');
      if (/crest|tuft|topknot|plume/.test(w)) out.pat.add('crest');
      if (/horn/.test(w)) out.pat.add('horns');
      if (/eyed$|eyespot|ocell|owlet|peacock|buckeye/.test(w)) out.pat.add('eyes');
      if (/bordered|margined|edged|fringed|tipped/.test(w)) out.pat.add('border');
      if (/^(giant|great|greater|big|large|grand|king|imperial|jumbo|titan)$/.test(w)) out.size = 1;
      if (/^(little|least|lesser|small|pygmy|dwarf|tiny|miniature|minor|narrow|pigmy)$/.test(w)) out.size = -1;
      if (/^(pale|pallid|pallida|light|bleached|ghost|snowy|whitewashed|albino)$/.test(w)) out.pale = 1;
      if (/^(dark|dusky|sooty|mournful|dingy|obscure|black|shadow|smoky)$/.test(w)) out.pale = -1;
    }
    return out;
  }
  ST.parseName = parseName;

  // ---------- template choice ----------

  // Taxon → template id. Groups share a template where the anatomy is close (listed in the style guide).
  const TEMPLATE_OF = {
    canid: 'canid', felid: 'felid', cervid: 'cervid', bovid: 'bovid', ursid: 'ursid', mustelid: 'mustelid', rodent: 'rodent', shrew: 'rodent',
    lagomorph: 'lagomorph', bat: 'bat', songbird: 'songbird', raptor: 'raptor', wader: 'wader', waterfowl: 'waterfowl', gamebird: 'gamebird',
    woodpecker: 'woodpecker', snake: 'snake', lizard: 'lizard', salamander: 'salamander', turtle: 'turtle', frog: 'frog', amphibian: 'frog',
    fish: 'fish', beetle: 'beetle', butterfly: 'butterfly', dragonfly: 'dragonfly', bee: 'bee', wasp: 'bee', ant: 'ant', bug: 'bug', insect: 'bug',
    grasshopper: 'grasshopper', fly: 'fly', spider: 'spider', arachnid: 'spider', crustacean: 'crustacean', snail: 'snail', worm: 'worm',
    grass: 'grass', forb: 'forb', shrub: 'shrub', tree: 'tree', vine: 'vine', aquatic: 'aquatic', mammal: 'rodent', bird: 'songbird', reptile: 'lizard',
  };
  const MARINE_MAMMALS = new Set(['Balaenidae', 'Balaenopteridae', 'Delphinidae', 'Phocoenidae', 'Physeteridae', 'Monodontidae', 'Ziphiidae', 'Otariidae', 'Phocidae', 'Odobenidae', 'Trichechidae']);
  const TREE_LIKE = new Set(['Pinaceae', 'Cupressaceae', 'Arecaceae', 'Zamiaceae', 'Cycadaceae', 'Podocarpaceae', 'Myrtaceae', 'Magnoliaceae', 'Taxaceae', 'Araucariaceae', 'Rutaceae', 'Lauraceae', 'Moraceae', 'Meliaceae', 'Dipterocarpaceae', 'Sapotaceae']);
  const SUCCULENT = new Set(['Cactaceae', 'Agavaceae', 'Crassulaceae']);
  // Taxa that are never drawn: soil microbes and fungi.
  const NEVER_DRAWN = new Set(['fungus', 'fungi', 'bacteria', 'microbe', 'protist']);

  function templateFor(e) {
    const tax = e.taxon || e.habit || e.group;
    if (!tax || NEVER_DRAWN.has(tax) || NEVER_DRAWN.has(e.group)) return null;
    if (tax === 'mammal') {
      if (MARINE_MAMMALS.has(e.family)) return 'marine';
      if (e.family === 'Ochotonidae') return 'lagomorph';
      if (['Suidae', 'Tayassuidae', 'Equidae', 'Camelidae'].includes(e.family)) return 'bovid';
    }
    if (e.group === 'plant') {
      if (SUCCULENT.has(e.family) || (e.family === 'Asparagaceae' && /agave|yucca|century|sotol|sacahuista|nolina|dasylirion|hesperaloe/i.test(e.sci + ' ' + e.common))) return 'succulent';
      if (TREE_LIKE.has(e.family) && tax !== 'tree' && tax !== 'shrub') return 'tree';
      if (e.family === 'Poaceae' || e.family === 'Cyperaceae' || e.family === 'Juncaceae') return tax === 'aquatic' ? 'aquatic' : 'grass';
    }
    return TEMPLATE_OF[tax] || null;
  }
  ST.templateFor = templateFor;

  // ---------- derivation helpers ----------

  function ctx(e) {
    const key = e.key != null ? e.key : e.sci;
    const nm = parseName(e.common || '');
    const genus = String(e.sci || '').split(' ')[0];
    const x = {
      e, key, nm, genus, fam: e.family || '', sci: String(e.sci || ''), name: String(e.common || e.sci || '').toLowerCase(),
      h: tag => hash(key + ':' + tag),
      pick: (tag, list) => list[Math.floor(hash(key + ':' + tag) * list.length) % list.length],
      has: re => re.test(String(e.common || '').toLowerCase()) || re.test(String(e.sci || '').toLowerCase()),
      jit: (tag, amt) => 1 + (hash(key + ':' + tag) - 0.5) * 2 * amt,
    };
    return x;
  }
  const shade = (c, dl, ds) => [c[0], clamp(c[1] + (ds || 0), 0, 100), clamp(c[2] + dl, 0, 100)];
  const hueShift = (c, dh) => [((c[0] + dh) % 360 + 360) % 360, c[1], c[2]];
  const mixc = (a, b, t) => { let dh = b[0] - a[0]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360; return [((a[0] + dh * t) % 360 + 360) % 360, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };

  function sizeClass(m) { return m == null ? 'm' : m < 0.005 ? 'xs' : m < 0.1 ? 's' : m < 3 ? 'm' : m < 60 ? 'l' : 'xl'; }

  // Base look for a tweak set; every template's derive fills it in.
  function base(x, tpl, palette) {
    return { v: ST.VERSION, key: String(x.key), tpl, size: sizeClass(x.e.mass), pose: 'stand', p: {}, parts: {}, col: Object.assign({}, palette), marks: {} };
  }
  // Apply colours from the name onto the regions a template has, then jitter hue and lightness a little per species.
  function nameColors(x, tw, map) {
    const nc = x.nm.col;
    for (const [from, to] of Object.entries(map)) if (nc[from]) for (const t of [].concat(to)) tw.col[t] = nc[from].slice();
    if (x.nm.pale > 0) for (const k of ['body', 'wing', 'head']) if (tw.col[k] && !nc[k === 'body' ? 'body' : k]) tw.col[k] = shade(tw.col[k], 16, -10);
    if (x.nm.pale < 0 && !nc.body && tw.col.body) tw.col.body = shade(tw.col.body, -14);
  }
  function jitterColors(x, tw, amtH, amtL) {
    for (const k of Object.keys(tw.col)) {
      if (k === 'eye') continue;
      const c = tw.col[k];
      const dh = (x.h('h' + k) - 0.5) * 2 * (amtH == null ? 10 : amtH), dl = (x.h('l' + k) - 0.5) * 2 * (amtL == null ? 5 : amtL);
      tw.col[k] = [((c[0] + dh) % 360 + 360) % 360, c[1], clamp(c[2] + dl, 0, 100)];
    }
  }
  function props(x, tw, keys, amt) { for (const k of keys) tw.p[k] = r1(x.jit('p' + k, amt == null ? 0.1 : amt) * (tw.p[k] || 1)); }
  function lengthWords(x, tw) {
    for (const k of x.nm.long) tw.p[k] = r1((tw.p[k] || 1) * 1.35);
    for (const k of x.nm.short) tw.p[k] = r1((tw.p[k] || 1) * 0.7);
  }
  const markCount = (x, dflt) => x.nm.count || dflt;

  // ---------- template derivations ----------
  // Each returns a tweak set; `regions` weights the colour regions for the look-alike distance, `nudge` lists what the
  // separation step may change (marks to switch on, parts to swap, the proportion to stretch).

  const TPL = (ST.TEMPLATES = {});
  function def(id, spec) { TPL[id] = Object.assign({ id }, spec); }

  // --- mammals on the quadruped skeleton ---
  const QUAD_REGIONS = { body: 0.42, belly: 0.12, head: 0.12, tail: 0.08, leg: 0.1, mark: 0.16 };
  const QUAD_NAME = { body: ['body', 'head', 'tail'], belly: 'belly', head: 'head', tail: 'tail', leg: 'leg', mark: 'mark', back: 'body', wing: 'body' };
  function quadBase(x, tpl, pal, parts) {
    const tw = base(x, tpl, Object.assign({ belly: shade(pal.body, 22, -10), head: pal.body, tail: pal.body, leg: pal.body, mark: [220, 10, 18] }, pal));
    Object.assign(tw.parts, parts);
    tw.p = { leg: 1, depth: 1, neck: 1, tail: 1, ear: 1, snout: 1, head: 1 };
    return tw;
  }
  function quadFinish(x, tw) {
    nameColors(x, tw, QUAD_NAME);
    if (x.nm.pat.has('spots')) tw.marks.spots = Math.max(tw.marks.spots || 0, 0.8);
    if (x.nm.pat.has('stripes')) tw.marks.stripe = Math.max(tw.marks.stripe || 0, 1);
    if (x.nm.pat.has('mask')) tw.marks.mask = 1;
    if (x.nm.pat.has('collar')) tw.marks.collar = 1;
    lengthWords(x, tw);
    const m = x.e.mass || 1;
    tw.p.depth = r1(tw.p.depth * clamp(0.9 + 0.05 * Math.log10(m + 1), 0.85, 1.2));
    props(x, tw, ['leg', 'depth', 'tail', 'ear', 'snout'], 0.08);
    jitterColors(x, tw, 8, 5);
    return tw;
  }
  const QUAD_NUDGE = { marks: ['socks', 'tailTip', 'stripe', 'mask', 'bib', 'spots', 'collar'], parts: {}, p: ['ear', 'leg', 'tail', 'snout'] };

  def('canid', {
    skeleton: 'quad', regions: QUAD_REGIONS, nudge: Object.assign({}, QUAD_NUDGE, { parts: { tail: ['bushy', 'brush'] } }),
    derive(x) {
      let pal = { body: [32, 38, 52] }, marks = { belly: 1 }, p = {};
      const g = x.genus, sci = x.sci;
      if (/Vulpes vulpes/.test(sci) || /red fox/.test(x.name)) { pal = { body: [18, 64, 48], belly: [40, 30, 88], leg: [15, 30, 18], mark: [15, 25, 15] }; marks = { belly: 1, socks: 1, tailTip: 1, earBack: 1 }; }
      else if (/Urocyon littoralis/.test(sci)) { pal = { body: [210, 6, 45], belly: [18, 60, 50], head: [210, 6, 40], mark: [220, 10, 16] }; marks = { belly: 1, stripe: 1, mask: 1, snoutMark: 1 }; p = { leg: 0.8, ear: 0.9, tail: 0.8 }; }
      else if (g === 'Urocyon') { pal = { body: [210, 5, 52], belly: [22, 52, 52], mark: [220, 10, 16] }; marks = { belly: 1, stripe: 1, tailTip: 0.6 }; p.leg = 0.9; }
      else if (g === 'Vulpes') { pal = { body: [36, 44, 70], belly: [42, 30, 90], mark: [220, 10, 16] }; marks = { belly: 1, tailTip: 0.7, snoutMark: 1 }; p.ear = 1.45; p.leg = 1.05; }
      else if (/Canis latrans/.test(sci)) { pal = { body: [34, 24, 54], belly: [38, 26, 80], leg: [28, 40, 50], mark: [30, 15, 25] }; marks = { belly: 1, tailTip: 0.5, stripe: 0.4 }; p.leg = 1.12; p.snout = 1.1; }
      else if (/Canis lupus/.test(sci)) { pal = { body: [210, 5, 50], belly: [40, 10, 82], mark: [220, 8, 22] }; marks = { belly: 1, mask: 0.5 }; p.leg = 1.15; p.depth = 1.1; }
      else if (g === 'Canis') { pal = { body: [28, 36, 45] }; marks = { belly: 1 }; }
      const tw = quadBase(x, 'canid', pal, { head: 'dog', ear: 'point', tail: g === 'Vulpes' || g === 'Urocyon' ? 'brush' : 'bushy', feet: 'paw' });
      Object.assign(tw.marks, marks); Object.assign(tw.p, p);
      if ((g === 'Vulpes' || g === 'Urocyon') && !p.tail) tw.p.tail = 1.25;
      return quadFinish(x, tw);
    },
  });

  def('felid', {
    skeleton: 'quad', regions: QUAD_REGIONS, nudge: Object.assign({}, QUAD_NUDGE, { marks: ['spots', 'stripes', 'tailTip', 'earTuft', 'mask'], parts: { tail: ['long', 'bob'] } }),
    derive(x) {
      const g = x.genus;
      let pal = { body: [32, 42, 55] }, marks = { belly: 1 }, tail = 'long', ear = 'round', p = {};
      if (g === 'Puma') { pal = { body: [30, 42, 56], mark: [25, 30, 20] }; marks = { belly: 1, tailTip: 1 }; p.tail = 1.3; p.leg = 1.05; }
      else if (g === 'Lynx') { pal = { body: [30, 30, 58], mark: [25, 40, 22] }; marks = { belly: 1, spots: 0.6, earTuft: 1 }; tail = 'bob'; p.leg = 1.15; }
      else if (g === 'Felis') { pal = { body: [30, 10, 50], mark: [220, 10, 22] }; marks = { belly: 0.6, stripes: 0.8 }; p.leg = 0.9; }
      else if (g === 'Leopardus') { pal = { body: [38, 55, 58] }; marks = { belly: 1, spots: 1 }; }
      else if (g === 'Panthera') { pal = { body: [36, 60, 56] }; marks = { belly: 1, spots: 1 }; p.depth = 1.1; }
      else if (g === 'Herpailurus') { pal = { body: [15, 35, 35] }; p.tail = 1.3; p.leg = 0.85; }
      const tw = quadBase(x, 'felid', pal, { head: 'cat', ear, tail, feet: 'paw' });
      Object.assign(tw.marks, marks); Object.assign(tw.p, p);
      return quadFinish(x, tw);
    },
  });

  def('cervid', {
    skeleton: 'quad', regions: QUAD_REGIONS, nudge: Object.assign({}, QUAD_NUDGE, { marks: ['rump', 'spots', 'throat', 'mask', 'socks'], parts: { horn: ['antler', 'antlerPalm', 'spike'] } }),
    derive(x) {
      const g = x.genus;
      let pal = { body: [26, 40, 45] }, marks = { belly: 1, rump: 0.6 }, horn = 'antler', p = { leg: 1.25, neck: 1.2 }, tail = 'puff';
      if (x.fam === 'Antilocapridae') { pal = { body: [30, 50, 55], belly: [40, 25, 90], mark: [220, 10, 18] }; marks = { belly: 1, rump: 1, throat: 1, mask: 0.6 }; horn = 'hook'; p.leg = 1.3; }
      else if (g === 'Alces') { pal = { body: [22, 30, 22], leg: [30, 15, 55] }; marks = { belly: 0.2, bell: 1 }; horn = 'antlerPalm'; p = { leg: 1.45, neck: 0.9, snout: 1.4, depth: 1.2 }; tail = 'bob'; }
      else if (g === 'Cervus') { pal = { body: [22, 40, 40], head: [20, 35, 28] }; marks = { belly: 0.4, rump: 1, mane: 1 }; p.neck = 1.3; }
      else if (g === 'Odocoileus' && /hemionus/.test(x.sci)) { pal = { body: [25, 12, 50] }; marks = { belly: 1, rump: 1, tailTip: 1 }; p.ear = 1.5; }
      else if (g === 'Odocoileus') { pal = { body: [24, 44, 46] }; marks = { belly: 1, rump: 0.4, throat: 1 }; tail = 'flag'; }
      else if (g === 'Axis') { pal = { body: [25, 55, 48] }; marks = { belly: 1, spots: 1 }; }
      else if (g === 'Rangifer') { pal = { body: [30, 12, 50], belly: [40, 10, 88] }; marks = { belly: 1, mane: 1 }; horn = 'antlerPalm'; }
      else if (g === 'Rusa' || g === 'Dama') { pal = { body: [22, 30, 32] }; marks = { belly: 0.5, spots: g === 'Dama' ? 1 : 0 }; }
      const tw = quadBase(x, 'cervid', pal, { head: 'deer', ear: 'long', tail, feet: 'hoof', horn });
      Object.assign(tw.marks, marks); Object.assign(tw.p, p);
      tw.p.horn = r1(clamp(0.7 + 0.15 * Math.log10((x.e.mass || 50) / 20), 0.6, 1.3));
      return quadFinish(x, tw);
    },
  });

  def('bovid', {
    skeleton: 'quad', regions: QUAD_REGIONS, nudge: Object.assign({}, QUAD_NUDGE, { marks: ['patches', 'socks', 'blaze', 'beard', 'rump'], parts: { horn: ['hornCurl', 'hornShort', 'hornSpike', 'hornLyre'] } }),
    derive(x) {
      const g = x.genus;
      let pal = { body: [28, 30, 40] }, marks = { belly: 0.5 }, horn = 'hornShort', head = 'cow', p = {}, extra = 'none', tail = 'tuft';
      if (g === 'Bison') { pal = { body: [22, 42, 24], head: [20, 35, 15] }; marks = { mane: 1 }; extra = 'hump'; p = { leg: 0.85, depth: 1.25 }; }
      else if (g === 'Bos' && /taurus/.test(x.sci) && x.e.key === 'domestic-cattle') { pal = { body: [18, 50, 30], belly: [40, 15, 88], mark: [40, 15, 90] }; marks = { blaze: 1, patches: 0.7 }; }
      else if (g === 'Bos') { pal = { body: [15, 25, 18] }; horn = 'hornLyre'; p.depth = 1.15; }
      else if (g === 'Ovis') { pal = { body: [30, 35, 50], belly: [40, 20, 88] }; marks = { rump: 1, belly: 1 }; horn = 'hornCurl'; p.leg = 1.05; }
      else if (g === 'Ammotragus') { pal = { body: [30, 45, 52] }; marks = { beard: 1 }; horn = 'hornCurl'; }
      else if (g === 'Capra') { pal = { body: [30, 15, 45] }; marks = { beard: 1, patches: 0.5 }; horn = 'hornSpike'; }
      else if (g === 'Oreamnos') { pal = { body: [44, 20, 90] }; marks = { beard: 1 }; horn = 'hornSpike'; }
      else if (g === 'Antilope') { pal = { body: [25, 40, 30], belly: [40, 15, 92] }; marks = { belly: 1, mask: 0.6 }; horn = 'hornSpiral'; p.leg = 1.2; }
      else if (x.fam === 'Suidae' || x.fam === 'Tayassuidae') { pal = { body: x.fam === 'Suidae' ? [25, 20, 30] : [30, 8, 35] }; marks = { collar: x.fam === 'Tayassuidae' ? 1 : 0, bristle: 1 }; horn = 'tusk'; head = 'pig'; tail = 'thin'; p = { leg: 0.7, depth: 1.05, tail: 0.35 }; }
      else if (x.fam === 'Equidae') { pal = { body: [26, 35, 38] }; horn = 'none'; head = 'horse'; marks = { mane: 1 }; p.leg = 1.2; p.neck = 1.3; }
      const tw = quadBase(x, 'bovid', pal, { head, ear: head === 'pig' ? 'point' : 'side', tail, feet: 'hoof', horn, extra });
      Object.assign(tw.marks, marks); Object.assign(tw.p, p);
      return quadFinish(x, tw);
    },
  });

  def('ursid', {
    skeleton: 'quad', regions: QUAD_REGIONS, nudge: Object.assign({}, QUAD_NUDGE, { marks: ['snoutMark', 'bib', 'hump', 'mask'] }),
    derive(x) {
      let pal = { body: [20, 15, 18] }, marks = { snoutMark: 1 }, p = { leg: 0.85, depth: 1.2, tail: 0.3 };
      if (/maritimus/.test(x.sci)) { pal = { body: [44, 25, 90], mark: [220, 10, 18] }; marks = {}; p.neck = 1.3; }
      else if (/arctos/.test(x.sci)) { pal = { body: [25, 40, 32] }; marks = { hump: 1 }; }
      const tw = quadBase(x, 'ursid', pal, { head: 'bear', ear: 'round', tail: 'bob', feet: 'paw' });
      tw.col.belly = tw.col.body; Object.assign(tw.marks, marks); Object.assign(tw.p, p);
      return quadFinish(x, tw);
    },
  });

  def('mustelid', {
    skeleton: 'quad', regions: QUAD_REGIONS, nudge: Object.assign({}, QUAD_NUDGE, { marks: ['stripe', 'spots', 'mask', 'bib', 'tailRings', 'blaze'], parts: { tail: ['bushy', 'thin', 'ringed'] } }),
    derive(x) {
      const g = x.genus, f = x.fam;
      let pal = { body: [25, 40, 30] }, marks = { belly: 0.4 }, tail = 'thin', head = 'weasel', p = { leg: 0.6, depth: 0.8, tail: 1 };
      if (f === 'Mephitidae') {
        pal = { body: [220, 10, 15], mark: [42, 20, 92] }; tail = 'bushy'; p = { leg: 0.65, depth: 1.05, tail: 1.1 };
        marks = g === 'Spilogale' ? { spots: 1, stripe: 0.5 } : g === 'Conepatus' ? { stripe: 1.4, blaze: 0 } : { stripe: 1, blaze: 1 };
        if (x.has(/hooded/)) marks.collar = 1;
      } else if (g === 'Procyon') { pal = { body: [210, 6, 48], mark: [220, 10, 17] }; marks = { mask: 1, tailRings: 1, belly: 0.5 }; tail = 'ringed'; head = 'raccoon'; p = { leg: 0.85, depth: 1.05, tail: 0.9 }; }
      else if (g === 'Bassariscus') { pal = { body: [35, 30, 55] }; marks = { tailRings: 1, eyering: 1 }; tail = 'ringed'; p = { leg: 0.7, depth: 0.85, tail: 1.5 }; }
      else if (g === 'Nasua') { pal = { body: [25, 40, 38] }; marks = { tailRings: 0.6, snoutMark: 1 }; tail = 'ringed'; p.snout = 1.6; }
      else if (g === 'Taxidea') { pal = { body: [35, 15, 55], head: [220, 10, 18], mark: [40, 20, 92] }; marks = { blaze: 1, belly: 0.3 }; tail = 'bob'; head = 'badger'; p = { leg: 0.55, depth: 1.1, tail: 0.5 }; }
      else if (g === 'Lontra' || g === 'Enhydra') { pal = { body: [25, 35, 26], belly: [30, 20, 55] }; marks = { bib: 0.8 }; tail = g === 'Enhydra' ? 'thin' : 'thick'; p = { leg: 0.5, depth: 0.95, tail: 1.2 }; }
      else if (g === 'Mustela' || g === 'Neogale') { pal = { body: [28, 45, 40], belly: [45, 50, 85] }; marks = { belly: 1, tailTip: /nigripes/.test(x.sci) ? 1 : 0.6, mask: /nigripes/.test(x.sci) ? 1 : 0, socks: /nigripes/.test(x.sci) ? 1 : 0 }; p = { leg: 0.5, depth: 0.65, tail: 0.8 }; if (/nigripes/.test(x.sci)) pal.body = [38, 40, 70]; }
      else if (g === 'Martes') { pal = { body: [25, 45, 32], mark: [35, 70, 62] }; marks = { bib: 1 }; tail = 'bushy'; p = { leg: 0.7, depth: 0.8 }; }
      else if (g === 'Pekania') { pal = { body: [20, 20, 18], head: [30, 10, 40] }; tail = 'bushy'; p = { leg: 0.7, depth: 0.85 }; }
      else if (g === 'Gulo') { pal = { body: [22, 35, 20], mark: [35, 40, 55] }; marks = { stripe: 1 }; tail = 'bushy'; p = { leg: 0.75, depth: 1.15 }; }
      const tw = quadBase(x, 'mustelid', pal, { head, ear: 'round', tail, feet: 'paw' });
      Object.assign(tw.marks, marks); Object.assign(tw.p, p);
      if (g === 'Enhydra') tw.pose = 'float';
      return quadFinish(x, tw);
    },
  });

  def('rodent', {
    skeleton: 'quad', regions: QUAD_REGIONS, nudge: Object.assign({}, QUAD_NUDGE, { marks: ['stripe', 'stripes', 'belly', 'eyering', 'spots', 'tailTip'], parts: { tail: ['thin', 'bushy', 'short', 'tufted'] } }),
    derive(x) {
      const g = x.genus, f = x.fam;
      let pal = { body: [30, 30, 45] }, marks = { belly: 1 }, tail = 'thin', head = 'mouse', ear = 'round', p = { leg: 0.5, depth: 1.05, tail: 1, ear: 1 }, extra = 'none', pose = 'stand';
      if (x.e.taxon === 'shrew') {
        head = f === 'Talpidae' ? 'mole' : 'shrew'; ear = 'tiny'; pal = { body: f === 'Talpidae' ? [220, 8, 25] : [25, 18, 32] }; marks = { belly: 0.4 };
        p = { leg: 0.4, depth: 0.95, tail: f === 'Talpidae' ? 0.3 : 0.6, snout: 1.3 };
        if (/star-nosed|Condylura/i.test(x.sci + x.name)) extra = 'star';
        if (f === 'Talpidae') extra = extra === 'star' ? 'star' : 'digger';
      } else if (f === 'Sciuridae') {
        if (/Tamias|Neotamias|Ammospermophilus/.test(g)) { pal = { body: [25, 45, 50], mark: [220, 10, 20] }; marks = { belly: 1, stripes: 1 }; tail = 'bushy'; p = { leg: 0.6, tail: 0.9, ear: 1 }; }
        else if (/Sciurus|Tamiasciurus/.test(g)) { pal = { body: /niger/.test(x.sci) ? [22, 45, 42] : /carolinensis|griseus|arizonensis/.test(x.sci) ? [210, 5, 52] : [15, 45, 40] }; marks = { belly: 1, eyering: 1 }; tail = 'plume'; p = { leg: 0.65, tail: 1.3, ear: 1.1 }; pose = 'sit'; }
        else if (/Glaucomys/.test(g)) { pal = { body: [30, 25, 50] }; marks = { belly: 1 }; tail = 'flat'; extra = 'glide'; p = { leg: 0.5, tail: 1 }; }
        else if (/Marmota/.test(g)) { pal = { body: [28, 30, 35] }; marks = { belly: 0.6, snoutMark: 1 }; tail = 'bushy'; p = { leg: 0.5, depth: 1.25, tail: 0.6, ear: 0.6 }; }
        else if (/Cynomys/.test(g)) { pal = { body: [34, 40, 60] }; marks = { belly: 1 }; tail = 'short'; p = { leg: 0.5, depth: 1.1, tail: 0.4, ear: 0.5 }; pose = 'sit'; }
        else { pal = { body: [32, 28, 55] }; marks = { belly: 1, spots: x.has(/spotted|thirteen/) ? 1 : 0, stripes: x.has(/lined|antelope/) ? 0.7 : 0 }; tail = 'bushy'; p = { leg: 0.55, tail: 0.7, ear: 0.6 }; pose = 'sit'; }
      } else if (f === 'Castoridae') { pal = { body: [22, 45, 28] }; tail = 'paddle'; head = 'beaver'; ear = 'tiny'; marks = {}; p = { leg: 0.45, depth: 1.25, tail: 1 }; }
      else if (f === 'Myocastoridae') { pal = { body: [25, 35, 30] }; tail = 'thin'; head = 'beaver'; ear = 'tiny'; marks = { snoutMark: 1 }; p = { leg: 0.5, depth: 1.15, tail: 1.1 }; }
      else if (f === 'Erethizontidae') { pal = { body: [30, 15, 25], mark: [42, 25, 85] }; marks = {}; extra = 'quills'; tail = 'short'; p = { leg: 0.55, depth: 1.3, tail: 0.5 }; }
      else if (f === 'Geomyidae') { pal = { body: [28, 40, 45] }; marks = { belly: 0.5 }; ear = 'tiny'; tail = 'short'; extra = 'cheek'; p = { leg: 0.4, depth: 1.1, tail: 0.5 }; }
      else if (f === 'Heteromyidae') {
        const kr = /Dipodomys/.test(g);
        pal = { body: [35, 42, 62] }; marks = { belly: 1, tailTip: kr ? 1 : 0, stripe: kr ? 0.6 : 0 }; tail = kr ? 'tufted' : 'thin'; extra = kr ? 'hop' : 'cheek';
        p = { leg: kr ? 0.9 : 0.5, depth: 1, tail: kr ? 1.6 : 1.1, ear: 0.9 }; pose = kr ? 'hop' : 'stand';
      } else if (f === 'Dipodidae') { pal = { body: [35, 50, 55] }; marks = { belly: 1, stripe: 0.8 }; extra = 'hop'; p = { leg: 0.85, tail: 1.8, ear: 0.9 }; pose = 'hop'; }
      else if (f === 'Aplodontiidae') { pal = { body: [25, 30, 30] }; tail = 'short'; ear = 'tiny'; p = { leg: 0.45, depth: 1.2, tail: 0.2 }; }
      else if (f === 'Didelphidae') { pal = { body: [210, 5, 62], head: [42, 15, 90], mark: [220, 10, 18] }; marks = { mask: 0.5, socks: 1 }; tail = 'naked'; head = 'shrew'; ear = 'round'; p = { leg: 0.6, depth: 1.05, tail: 1.2, snout: 1.4 }; }
      else if (f === 'Cricetidae') {
        if (/Microtus|Myodes|Arborimus|Lemmus|Phenacomys|Clethrionomys|Synaptomys/.test(g)) { pal = { body: [25, 35, 34] }; marks = { belly: 0.5 }; tail = 'short'; ear = 'tiny'; p = { leg: 0.4, depth: 1.1, tail: 0.35 }; }
        else if (/Neotoma/.test(g)) { pal = { body: [30, 20, 48] }; marks = { belly: 1 }; tail = 'furred'; p = { leg: 0.55, tail: 1.1, ear: 1.4 }; }
        else if (/Ondatra/.test(g)) { pal = { body: [22, 40, 30] }; tail = 'flat'; ear = 'tiny'; p = { leg: 0.45, depth: 1.2, tail: 1 }; }
        else if (/Onychomys/.test(g)) { pal = { body: [30, 20, 45] }; marks = { belly: 1, tailTip: 1 }; tail = 'short'; p = { leg: 0.5, tail: 0.5 }; }
        else if (/Sigmodon/.test(g)) { pal = { body: [35, 20, 40] }; marks = { belly: 0.6, spots: 0.3 }; tail = 'thin'; p = { leg: 0.5, tail: 0.8, ear: 0.8 }; }
        else { pal = { body: [30, 40, 50] }; marks = { belly: 1 }; tail = 'thin'; p = { leg: 0.5, tail: 1.2, ear: 1.3 }; }
      } else if (f === 'Muridae') { pal = { body: /rattus/i.test(x.sci) ? [220, 8, 30] : [30, 12, 55] }; marks = { belly: 0.4 }; tail = 'naked'; p = { leg: 0.5, tail: 1.3, ear: 1.1 }; }
      const tw = quadBase(x, 'rodent', pal, { head, ear, tail, feet: 'paw', extra });
      Object.assign(tw.marks, marks); Object.assign(tw.p, p); tw.pose = pose;
      return quadFinish(x, tw);
    },
  });

  def('lagomorph', {
    skeleton: 'quad', regions: QUAD_REGIONS, nudge: Object.assign({}, QUAD_NUDGE, { marks: ['earTip', 'nape', 'belly', 'eyering', 'socks'], parts: { tail: ['puff', 'blacktop'] } }),
    derive(x) {
      const g = x.genus;
      let pal = { body: [30, 30, 50] }, marks = { belly: 1, eyering: 0.5 }, tail = 'puff', ear = 'long', p = { leg: 0.7, ear: 1, depth: 1.05 }, pose = 'crouch';
      if (x.fam === 'Ochotonidae') { pal = { body: [30, 20, 45] }; ear = 'round'; tail = 'none'; marks = { belly: 0.5, earTip: 1 }; p = { leg: 0.4, ear: 0.6, depth: 1.1 }; }
      else if (g === 'Lepus') {
        pal = { body: [32, 30, 55] }; p = { leg: 1, ear: 1.5, depth: 0.95 }; marks = { belly: 1, earTip: 1 }; pose = 'sit';
        if (/americanus|arcticus|townsendii/.test(x.sci)) { pal = /americanus/.test(x.sci) ? [30, 35, 40] : [36, 20, 72]; pal = { body: pal, belly: [40, 15, 92] }; p.ear = 1.2; marks.socks = 0.6; }
        if (/californicus/.test(x.sci)) tail = 'blacktop';
      } else if (g === 'Sylvilagus') { pal = { body: [28, 30, 44] }; marks = { belly: 1, nape: 1 }; }
      else if (g === 'Oryctolagus') { pal = { body: [30, 18, 50] }; marks = { belly: 0.7 }; }
      else if (g === 'Brachylagus') { pal = { body: [210, 5, 50] }; p.ear = 0.7; }
      const tw = quadBase(x, 'lagomorph', pal, { head: 'rabbit', ear, tail, feet: 'paw' });
      Object.assign(tw.marks, marks); Object.assign(tw.p, p); tw.pose = pose;
      return quadFinish(x, tw);
    },
  });

  def('marine', {
    skeleton: 'marine', regions: { body: 0.55, belly: 0.25, mark: 0.2 }, nudge: { marks: ['belly', 'spots', 'patch', 'stripe'], parts: {}, p: ['len', 'fin'] },
    derive(x) {
      const f = x.fam;
      let kind = 'whale', pal = { body: [215, 12, 35], belly: [210, 8, 75], mark: [0, 0, 90] }, marks = { belly: 1 }, p = { len: 1, fin: 1, depth: 1 };
      if (f === 'Delphinidae' || f === 'Phocoenidae') { kind = 'dolphin'; pal.body = /Pseudorca|Orcinus|Globicephala/.test(x.genus) ? [220, 10, 18] : [210, 12, 55]; if (/Orcinus/.test(x.genus)) marks.patch = 1; p.fin = 1.2; }
      else if (f === 'Otariidae') { kind = 'sealion'; pal = { body: [28, 40, 32], belly: [30, 30, 40] }; marks = { belly: 0.3 }; }
      else if (f === 'Phocidae') { kind = 'seal'; pal = { body: [210, 8, 50], mark: [220, 10, 25] }; marks = { spots: 1, belly: 0.5 }; }
      else if (f === 'Odobenidae') { kind = 'walrus'; pal = { body: [18, 40, 55] }; marks = { belly: 0 }; p.depth = 1.2; }
      else if (f === 'Trichechidae') { kind = 'manatee'; pal = { body: [200, 6, 50] }; marks = { belly: 0 }; }
      else if (f === 'Balaenidae') { pal.body = [220, 10, 18]; marks = { callus: 1, belly: 0.3 }; p.depth = 1.25; }
      else if (f === 'Balaenopteridae') { marks = { belly: 1, pleats: 1 }; p.len = 1.1; }
      const tw = base(x, 'marine', pal); tw.parts.kind = kind; tw.p = p; tw.marks = marks; tw.pose = 'swim';
      nameColors(x, tw, { body: 'body', belly: 'belly', mark: 'mark' });
      props(x, tw, ['len', 'fin', 'depth'], 0.08); jitterColors(x, tw, 6, 4);
      return tw;
    },
  });

  def('bat', {
    skeleton: 'bat', regions: { body: 0.35, wing: 0.35, belly: 0.1, head: 0.1, mark: 0.1 }, nudge: { marks: ['mask', 'belly', 'collar', 'shoulder'], parts: { ear: ['big', 'pointed', 'round'] }, p: ['ear', 'wing'] },
    derive(x) {
      const g = x.genus, f = x.fam;
      let pal = { body: [25, 35, 35], wing: [20, 20, 18] }, ear = 'pointed', nose = 'plain', marks = { belly: 0.5 }, p = { ear: 1, wing: 1 };
      if (f === 'Molossidae') { pal.body = [25, 20, 28]; ear = 'round'; marks.tail = 1; p.wing = 1.15; }
      else if (f === 'Phyllostomidae') { nose = 'leaf'; pal.body = [30, 20, 40]; }
      else if (/Corynorhinus|Euderma|Antrozous|Idionycteris/.test(g)) { ear = 'big'; p.ear = 1.4; pal.body = /Antrozous/.test(g) ? [38, 35, 65] : [28, 30, 40]; if (/Euderma/.test(g)) { pal.body = [220, 10, 18]; marks.spots = 1; } }
      else if (/Lasiurus|Aeorestes/.test(g)) { pal.body = /cinereus|Aeorestes/.test(x.sci + g) ? [30, 15, 55] : [15, 60, 45]; marks.shoulder = 1; ear = 'round'; }
      else if (/Lasionycteris/.test(g)) { pal.body = [220, 12, 16]; marks.frost = 1; }
      else if (/Eptesicus/.test(g)) { pal.body = [25, 40, 35]; p.wing = 1.05; }
      else if (/Myotis/.test(g)) { pal.body = [28, 30, 42]; p.wing = 0.92; }
      else if (/Tadarida/.test(g)) { pal.body = [25, 20, 32]; }
      const tw = base(x, 'bat', Object.assign({ belly: shade(pal.body, 15), head: pal.body, mark: [42, 20, 85] }, pal));
      tw.parts = { ear, nose }; tw.p = p; tw.marks = marks; tw.pose = 'fly';
      nameColors(x, tw, { body: ['body', 'head'], belly: 'belly', head: 'head', wing: 'wing', mark: 'mark' });
      lengthWords(x, tw); props(x, tw, ['ear', 'wing'], 0.08); jitterColors(x, tw, 8, 5);
      return tw;
    },
  });

  // --- birds ---
  const BIRD_REGIONS = { body: 0.3, belly: 0.18, head: 0.16, wing: 0.1, tail: 0.04, bill: 0.06, leg: 0.03, mark: 0.13 };
  const BIRD_NAME = { body: ['body', 'wing', 'head', 'tail'], belly: 'belly', head: 'head', wing: 'wing', tail: 'tail', bill: 'bill', leg: 'leg', mark: 'mark', back: 'body' };
  const BIRD_NUDGE = { marks: ['cap', 'mask', 'wingbar', 'bib', 'spots', 'eyering', 'collar', 'streaks'], parts: { tail: ['short', 'long', 'fork', 'fan'] }, p: ['bill', 'tail', 'leg', 'neck'] };
  function birdBase(x, tpl, pal, parts, p) {
    const col = Object.assign({ belly: shade(pal.body, 25, -10), head: pal.body, wing: shade(pal.body, -8), tail: shade(pal.body, -8), bill: [30, 15, 22], leg: [25, 20, 35], mark: [220, 10, 17] }, pal);
    if (!pal.wing && pal.body) col.wing = shade(col.body, -8);
    if (!pal.tail) col.tail = col.wing;
    const tw = base(x, tpl, col);
    tw.parts = Object.assign({ bill: 'thin', crest: 'none', tail: 'short', head: 'round' }, parts);
    tw.p = Object.assign({ leg: 1, neck: 1, bill: 1, tail: 1, body: 1, head: 1, wing: 1 }, p || {});
    tw.pose = 'perch';
    return tw;
  }
  function birdFinish(x, tw) {
    nameColors(x, tw, BIRD_NAME);
    const nm = x.nm;
    if (nm.pat.has('crest') && tw.parts.crest === 'none') tw.parts.crest = 'point';
    if (nm.pat.has('horns') && tw.parts.crest === 'none') tw.parts.crest = 'tufts';
    if (nm.pat.has('spots')) tw.marks.spots = Math.max(tw.marks.spots || 0, 0.8);
    if (nm.pat.has('stripes')) tw.marks.streaks = Math.max(tw.marks.streaks || 0, 0.8);
    if (nm.pat.has('bands')) tw.marks.bars = Math.max(tw.marks.bars || 0, 0.7);
    if (nm.pat.has('collar')) tw.marks.collar = 1;
    if (nm.pat.has('mask')) tw.marks.mask = 1;
    if (nm.col.head && !tw.marks.cap) tw.marks.cap = 1;
    if (x.has(/scissor|long-tailed|paradise/) && tw.parts.tail !== 'fork') tw.parts.tail = x.has(/scissor/) ? 'fork' : 'long';
    if (x.has(/fork-tailed|swallow-tailed/)) tw.parts.tail = 'fork';
    lengthWords(x, tw);
    if (nm.size > 0) tw.p.body = r1(tw.p.body * 1.1);
    props(x, tw, ['leg', 'neck', 'bill', 'tail'], 0.08);
    jitterColors(x, tw, 8, 5);
    return tw;
  }

  const SONG_FAM = {
    Alaudidae: { pal: { body: [32, 30, 55], belly: [40, 20, 88], head: [48, 60, 60] }, parts: { bill: 'thin', crest: 'tufts' }, marks: { mask: 1, bib: 1 } },
    Alcidae: { pal: { body: [220, 10, 20], belly: [40, 10, 92] }, parts: { bill: 'short' }, pose: 'swim', marks: {} },
    Apodidae: { pal: { body: [220, 8, 22] }, parts: { bill: 'tiny', tail: 'fork' }, pose: 'fly', p: { wing: 1.3 } },
    Bombycillidae: { pal: { body: [30, 35, 55], belly: [48, 50, 70], tail: [210, 5, 40] }, parts: { bill: 'short', crest: 'point' }, marks: { mask: 1, tailTip: 1 } },
    Calcariidae: { pal: { body: [32, 30, 45], belly: [220, 10, 20] }, parts: { bill: 'cone' }, marks: { collar: 1, streaks: 0.6 } },
    Caprimulgidae: { pal: { body: [30, 30, 38], mark: [35, 30, 65] }, parts: { bill: 'tiny', head: 'flat' }, marks: { mottle: 1, collar: 0.6 }, p: { leg: 0.3, wing: 1.2 } },
    Cardinalidae: { pal: { body: [5, 60, 45] }, parts: { bill: 'cone' }, p: { bill: 1.2 } },
    Columbidae: { pal: { body: [25, 15, 55], belly: [15, 20, 72], head: [210, 8, 60] }, parts: { bill: 'short', head: 'small' }, marks: { spots: 0.4 }, p: { body: 1.15, tail: 1.2 } },
    Corvidae: { pal: { body: [220, 12, 18] }, parts: { bill: 'stout' }, p: { body: 1.2, leg: 1.1 } },
    Diomedeidae: { pal: { body: [30, 15, 30], belly: [40, 10, 90], head: [40, 10, 90] }, parts: { bill: 'tube' }, pose: 'glide', p: { wing: 1.6 } },
    Procellariidae: { pal: { body: [220, 8, 30], belly: [210, 8, 70] }, parts: { bill: 'tube' }, pose: 'glide', p: { wing: 1.4 } },
    Hydrobatidae: { pal: { body: [220, 8, 22], mark: [40, 10, 92] }, parts: { bill: 'tube', tail: 'fork' }, pose: 'glide', marks: { rump: 1 }, p: { wing: 1.2 } },
    Fringillidae: { pal: { body: [45, 60, 50] }, parts: { bill: 'cone' }, marks: { wingbar: 1 } },
    Hirundinidae: { pal: { body: [220, 50, 30], belly: [30, 40, 80] }, parts: { bill: 'tiny', tail: 'fork' }, p: { wing: 1.3, leg: 0.5 } },
    Icteridae: { pal: { body: [220, 12, 18] }, parts: { bill: 'spike', tail: 'long' }, p: { body: 1.1 } },
    Laniidae: { pal: { body: [210, 6, 58], belly: [40, 10, 92] }, parts: { bill: 'hook' }, marks: { mask: 1, wingbar: 1 } },
    Mimidae: { pal: { body: [210, 6, 52] }, parts: { bill: 'curve', tail: 'long' }, p: { tail: 1.3 } },
    Motacillidae: { pal: { body: [34, 30, 50] }, parts: { bill: 'thin' }, marks: { streaks: 1 } },
    Paridae: { pal: { body: [210, 8, 55], belly: [35, 30, 85], mark: [220, 10, 17] }, parts: { bill: 'short' }, marks: { cap: 1, bib: 1 } },
    Parulidae: { pal: { body: [70, 45, 45], belly: [52, 80, 60] }, parts: { bill: 'thin' }, marks: { wingbar: 0.6 }, p: { body: 0.85 } },
    Passerellidae: { pal: { body: [28, 38, 42], belly: [35, 18, 80], mark: [25, 40, 30] }, parts: { bill: 'cone' }, marks: { streaks: 1, cap: 0.5 } },
    Passeridae: { pal: { body: [28, 40, 42], belly: [30, 10, 70], head: [210, 6, 50] }, parts: { bill: 'cone' }, marks: { bib: 1, wingbar: 1 } },
    Polioptilidae: { pal: { body: [210, 20, 62], belly: [210, 10, 90] }, parts: { bill: 'thin', tail: 'long' }, marks: { eyering: 1 }, p: { body: 0.8, tail: 1.4 } },
    Psittacidae: { pal: { body: [110, 55, 40], head: [5, 60, 48] }, parts: { bill: 'parrot', tail: 'long' }, p: { body: 1.2 } },
    Regulidae: { pal: { body: [75, 30, 45], mark: [5, 65, 50] }, parts: { bill: 'thin' }, marks: { cap: 1, wingbar: 1 }, p: { body: 0.75 } },
    Remizidae: { pal: { body: [210, 6, 58], head: [52, 80, 58] }, parts: { bill: 'thin' }, p: { body: 0.8 } },
    Sittidae: { pal: { body: [210, 25, 55], belly: [30, 20, 88] }, parts: { bill: 'thin', tail: 'short' }, pose: 'clingDown', marks: { cap: 1 }, p: { bill: 1.2, tail: 0.6 } },
    Sturnidae: { pal: { body: [260, 15, 20] }, parts: { bill: 'spike' }, marks: { spots: 0.8 } },
    Trochilidae: { pal: { body: [120, 45, 38], belly: [40, 10, 85] }, parts: { bill: 'needle' }, pose: 'hover', marks: { bib: 1 }, p: { body: 0.7, bill: 1.4 } },
    Troglodytidae: { pal: { body: [26, 40, 38] }, parts: { bill: 'curve', tail: 'cocked' }, marks: { bars: 0.8, eyestripe: 1 }, p: { body: 0.85 } },
    Turdidae: { pal: { body: [30, 20, 38], belly: [40, 15, 85] }, parts: { bill: 'thin' }, marks: { spots: 0.8, eyering: 0.6 }, p: { leg: 1.2 } },
    Tyrannidae: { pal: { body: [210, 8, 45], belly: [52, 60, 70] }, parts: { bill: 'flat', crest: 'nub' }, marks: {} },
    Vireonidae: { pal: { body: [75, 25, 48], belly: [55, 30, 85] }, parts: { bill: 'short' }, marks: { eyering: 1 } },
    Cuculidae: { pal: { body: [30, 25, 45], belly: [40, 10, 90] }, parts: { bill: 'curve', tail: 'long' }, marks: { spots: 0.5 }, p: { tail: 1.5 } },
    Alcedinidae: { pal: { body: [210, 35, 45], belly: [40, 10, 90] }, parts: { bill: 'dagger', crest: 'shag' }, marks: { collar: 1 }, p: { bill: 1.4, head: 1.2 } },
    Emberizidae: { pal: { body: [28, 38, 42] }, parts: { bill: 'cone' }, marks: { streaks: 1 } },
  };
  const GENUS_SONG = {
    Cardinalis: { pal: { body: [3, 60, 45], head: [3, 60, 45], mark: [220, 10, 15], bill: [15, 70, 55] }, parts: { crest: 'point' }, marks: { mask: 1 } },
    Passerina: { pal: { body: [140, 45, 45], head: [220, 55, 50], belly: [4, 60, 50] }, marks: {} },
    Piranga: { pal: { body: [355, 55, 48] } },
    Cyanocitta: { pal: { body: [212, 50, 48], belly: [210, 10, 88] }, parts: { crest: 'point' }, marks: { collar: 1, wingbar: 1 } },
    Aphelocoma: { pal: { body: [212, 45, 50], belly: [210, 8, 75] }, marks: { mask: 0.5 } },
    Gymnorhinus: { pal: { body: [210, 35, 55] } },
    Pica: { pal: { body: [220, 12, 16], belly: [40, 10, 92] }, parts: { tail: 'long' }, marks: { patch: 1 }, p: { tail: 1.6 } },
    Corvus: { pal: { body: [230, 12, 15], belly: [230, 12, 17], bill: [220, 10, 12], leg: [220, 10, 15] } },
    Spinus: { pal: { body: [52, 82, 58], mark: [220, 10, 15] }, marks: { cap: 1, wingbar: 1 } },
    Haemorhous: { pal: { body: [28, 30, 45], head: [355, 55, 50] }, marks: { streaks: 0.8 } },
    Coccothraustes: { pal: { body: [45, 60, 50], head: [30, 45, 32], mark: [220, 10, 15] }, p: { bill: 1.4 }, marks: { wingbar: 1 } },
    Leucosticte: { pal: { body: [25, 30, 30], belly: [340, 30, 55], head: [210, 8, 60] } },
    Sturnella: { pal: { body: [32, 35, 45], belly: [50, 80, 58] }, marks: { bib: 1, streaks: 0.6 }, parts: { tail: 'short' } },
    Agelaius: { pal: { body: [220, 12, 16], mark: [5, 70, 48] }, marks: { shoulder: 1 } },
    Dolichonyx: { pal: { body: [220, 10, 16], head: [45, 45, 80] }, marks: { patch: 1 } },
    Icterus: { pal: { body: [28, 80, 55], head: [220, 10, 16], wing: [220, 10, 16] }, marks: { wingbar: 1 } },
    Molothrus: { pal: { body: [220, 12, 16], head: [25, 35, 32] }, parts: { bill: 'cone' } },
    Quiscalus: { pal: { body: [250, 25, 17] }, p: { tail: 1.5 } },
    Euphagus: { pal: { body: [220, 14, 19] }, marks: { eyering: 0.6 } },
    Xanthocephalus: { pal: { body: [220, 10, 16], head: [48, 80, 58] }, marks: { wingbar: 1 } },
    Sialia: { pal: { body: [212, 55, 52], belly: [22, 55, 55] } },
    Turdus: { pal: { body: [210, 8, 32], belly: [18, 60, 48], head: [220, 10, 20] }, marks: { eyering: 1 } },
    Catharus: { pal: { body: [28, 25, 42], belly: [40, 10, 88] }, marks: { spots: 1 } },
    Hylocichla: { pal: { body: [22, 40, 40], belly: [40, 10, 92] }, marks: { spots: 1.2 } },
    Mimus: { pal: { body: [210, 6, 58], belly: [210, 5, 85] }, parts: { bill: 'thin' }, marks: { wingbar: 1 } },
    Dumetella: { pal: { body: [210, 8, 40], mark: [220, 10, 15] }, parts: { bill: 'thin' }, marks: { cap: 1 } },
    Toxostoma: { pal: { body: [25, 40, 40], belly: [35, 30, 78] }, marks: { spots: 0.5 }, p: { bill: 1.4 } },
    Poecile: { marks: { cap: 1, bib: 1 } },
    Baeolophus: { pal: { body: [210, 8, 55] }, parts: { crest: 'point' }, marks: { cap: 0.6 } },
    Sitta: { },
    Tyrannus: { pal: { body: [210, 8, 40], belly: [52, 70, 65], head: [210, 8, 50] } },
    Sayornis: { pal: { body: [30, 10, 35], belly: [40, 15, 85] } },
    Pyrocephalus: { pal: { body: [25, 15, 30], belly: [5, 75, 50], head: [5, 75, 50] } },
    Setophaga: { pal: { body: [55, 60, 50], belly: [52, 80, 62] }, marks: { streaks: 0.6, wingbar: 1 } },
    Geothlypis: { pal: { body: [70, 35, 42], belly: [52, 80, 60], mark: [220, 10, 16] }, marks: { mask: 1 } },
    Vermivora: { pal: { body: [210, 8, 60], head: [52, 80, 60] }, marks: { mask: 1, wingbar: 1 } },
    Mniotilta: { pal: { body: [220, 10, 30], belly: [40, 10, 92] }, marks: { streaks: 1.4 } },
    Junco: { pal: { body: [210, 10, 38], belly: [40, 10, 92], bill: [30, 30, 80] }, marks: {} },
    Spizella: { pal: { head: [15, 50, 40] }, marks: { cap: 1, eyestripe: 1, streaks: 0.4 } },
    Zonotrichia: { pal: { head: [220, 10, 18], mark: [40, 10, 92] }, marks: { cap: 1, eyestripe: 1 } },
    Melospiza: { marks: { streaks: 1.3, spots: 0.5 } },
    Passer: { },
    Zenaida: { pal: { body: [30, 25, 58], belly: [20, 25, 72] }, marks: { spots: 0.5 }, parts: { tail: 'wedge' } },
    Columba: { pal: { body: [210, 10, 55], head: [200, 15, 35] }, marks: { wingbar: 1, collar: 0.5 } },
    Streptopelia: { pal: { body: [35, 25, 72] }, marks: { collar: 1 } },
    Columbina: { pal: { body: [30, 20, 62] }, marks: { bars: 1 } },
    Patagioenas: { pal: { body: [220, 12, 35], head: [40, 10, 92] } },
    Archilochus: { pal: { belly: [40, 10, 85], mark: [300, 40, 30] } },
    Selasphorus: { pal: { body: [22, 60, 50], mark: [15, 70, 50] } },
    Calypte: { pal: { mark: [335, 55, 50] } },
    Hirundo: { pal: { belly: [22, 50, 60] }, marks: {} },
    Tachycineta: { pal: { body: [190, 50, 35], belly: [40, 10, 92] }, parts: { tail: 'notch' } },
    Petrochelidon: { pal: { body: [220, 30, 25], belly: [30, 20, 80], head: [18, 50, 40] }, parts: { tail: 'notch' }, marks: { rump: 1 } },
    Progne: { pal: { body: [240, 35, 22] } },
    Chordeiles: { },
    Antrostomus: { },
    Chaetura: { pal: { body: [30, 10, 32] }, parts: { tail: 'short' } },
    Cypseloides: { },
    Amazona: { },
    Polioptila: { },
    Regulus: { },
    Auriparus: { },
    Troglodytes: { },
    Thryomanes: { marks: { eyestripe: 1.2 } },
    Lanius: { },
    Bombycilla: { },
  };

  def('songbird', {
    skeleton: 'bird', regions: BIRD_REGIONS, nudge: BIRD_NUDGE,
    derive(x) {
      const F = SONG_FAM[x.fam] || { pal: { body: [30, 30, 42] }, parts: { bill: 'cone' } };
      const G = GENUS_SONG[x.genus] || {};
      const pal = Object.assign({}, F.pal, G.pal);
      const tw = birdBase(x, 'songbird', pal, Object.assign({}, F.parts, G.parts), Object.assign({}, F.p, G.p));
      Object.assign(tw.marks, F.marks, G.marks);
      tw.pose = G.pose || F.pose || 'perch';
      if (!F.pal.belly && !(G.pal && G.pal.belly)) tw.col.belly = shade(tw.col.body, 25, -10);
      const m = x.e.mass || 0.03;
      tw.p.body = r1(tw.p.body * clamp(1 + 0.1 * Math.log10(m / 0.03), 0.8, 1.3));
      return birdFinish(x, tw);
    },
  });

  def('raptor', {
    skeleton: 'bird', regions: BIRD_REGIONS, nudge: Object.assign({}, BIRD_NUDGE, { marks: ['bars', 'streaks', 'mask', 'moustache', 'tailBands', 'cap'], parts: { crest: ['none', 'tufts'] } }),
    derive(x) {
      const f = x.fam, g = x.genus;
      let pal = { body: [25, 38, 32], belly: [35, 30, 80] }, parts = { bill: 'hook', head: 'round', tail: 'fan' }, marks = { streaks: 0.6 }, p = { body: 1.2, leg: 0.9 }, pose = 'upright';
      if (f === 'Strigidae' || f === 'Tytonidae') {
        parts.head = 'owl'; parts.bill = 'owl'; marks = { bars: 0.8, faceDisc: 1 }; pal = { body: [30, 25, 40], belly: [35, 25, 72] };
        if (/Bubo|Megascops|Asio|Otus/.test(g) && !/scandiacus/.test(x.sci)) parts.crest = 'tufts';
        if (/scandiacus/.test(x.sci)) { pal = { body: [40, 15, 93], belly: [40, 10, 95], mark: [220, 10, 25] }; marks = { spots: 0.6 }; }
        if (f === 'Tytonidae') { pal = { body: [35, 50, 65], belly: [40, 20, 92] }; marks = { faceDisc: 1.3, spots: 0.4 }; }
        if (/Athene/.test(g)) { p.leg = 1.8; pal = { body: [30, 30, 45], belly: [40, 15, 85] }; marks = { spots: 1, bars: 0.5 }; }
        if (/Strix/.test(g)) marks = { bars: 1.2, spots: /occidentalis/.test(x.sci) ? 1 : 0 };
      } else if (f === 'Cathartidae') {
        parts.head = 'bald'; pal = { body: [220, 10, 17], belly: [220, 10, 18], head: /Coragyps/.test(g) ? [210, 5, 35] : [2, 55, 50] }; marks = { wingEdge: 1 }; p.body = 1.35; pose = 'hunch';
        if (/Gymnogyps/.test(g)) { pal.head = [20, 60, 60]; marks.collar = 1; }
      } else if (f === 'Falconidae') {
        if (/Caracara/.test(g)) { pal = { body: [220, 10, 18], belly: [40, 10, 88], head: [15, 70, 50] }; parts.crest = 'cap'; marks = { bars: 0.8 }; p.leg = 1.3; }
        else { pal = { body: [18, 55, 48], belly: [35, 30, 85], wing: [210, 25, 55] }; marks = { moustache: 1, spots: 0.6 }; p.body = 0.95; }
      } else if (f === 'Pandionidae') { pal = { body: [25, 30, 25], belly: [40, 10, 92], head: [40, 10, 92] }; marks = { mask: 1 }; }
      else if (f === 'Accipitridae') {
        if (/Haliaeetus/.test(g)) { pal = { body: [25, 40, 22], belly: [25, 40, 22], head: [40, 10, 92], tail: [40, 10, 92], bill: [48, 80, 55] }; marks = {}; p.body = 1.4; if (/pelagicus/.test(x.sci)) marks.shoulder = 1; }
        else if (/Aquila/.test(g)) { pal = { body: [25, 35, 25], belly: [25, 35, 28], head: [38, 50, 50] }; marks = {}; p.body = 1.4; }
        else if (/Circus/.test(g)) { pal = { body: [210, 6, 58], belly: [40, 10, 90] }; marks = { rump: 1, faceDisc: 0.5 }; parts.tail = 'long'; p.tail = 1.3; }
        else if (/Buteo/.test(g)) { pal = { body: [25, 38, 32], belly: [35, 30, 85], tail: /jamaicensis/.test(x.sci) ? [15, 55, 48] : [25, 30, 40] }; marks = { streaks: 0.6, bib: /swainsoni/.test(x.sci) ? 1 : 0 }; }
        else if (/Accipiter|Astur/.test(g)) { pal = { body: [210, 15, 40], belly: [20, 40, 75] }; marks = { bars: 1, tailBands: 1 }; parts.tail = 'long'; p.tail = 1.3; }
        else if (/Elanus|Ictinia|Elanoides/.test(g)) { pal = { body: [210, 8, 55], belly: [40, 10, 92] }; marks = { mask: 0.5 }; parts.tail = /Elanoides/.test(g) ? 'fork' : 'long'; }
      }
      const tw = birdBase(x, 'raptor', pal, parts, p);
      Object.assign(tw.marks, marks); tw.pose = pose;
      tw.col.bill = pal.bill || [220, 10, 20]; tw.col.leg = [48, 70, 55];
      if (!pal.tail) tw.col.tail = pal.body;
      return birdFinish(x, tw);
    },
  });

  const WADER_FAM = {
    Ardeidae: { pal: { body: [210, 15, 55], belly: [210, 10, 70] }, parts: { bill: 'dagger', crest: 'plume' }, pose: 'tall', p: { leg: 1.8, neck: 1.9, bill: 1.5 } },
    Threskiornithidae: { pal: { body: [5, 40, 40] }, parts: { bill: 'curve' }, pose: 'tall', p: { leg: 1.5, neck: 1.4, bill: 1.8 } },
    Ciconiidae: { pal: { body: [40, 10, 92], wing: [220, 10, 18], head: [210, 5, 40] }, parts: { bill: 'dagger', head: 'bald' }, pose: 'tall', p: { leg: 1.8, neck: 1.3, bill: 1.5 } },
    Gruidae: { pal: { body: [210, 6, 62], head: [210, 6, 62], mark: [2, 65, 48] }, parts: { bill: 'dagger', tail: 'bustle' }, pose: 'tall', marks: { cap: 1 }, p: { leg: 2, neck: 1.8, bill: 1.1 } },
    Charadriidae: { pal: { body: [32, 30, 55], belly: [40, 10, 92] }, parts: { bill: 'short', head: 'round' }, marks: { collar: 1, mask: 0.5 }, p: { leg: 1.1, neck: 0.8, bill: 0.8 } },
    Scolopacidae: { pal: { body: [30, 30, 45], belly: [35, 20, 85] }, parts: { bill: 'probe' }, marks: { mottle: 1 }, p: { leg: 1.25, neck: 1, bill: 1.5 } },
    Recurvirostridae: { pal: { body: [220, 10, 18], belly: [40, 10, 92] }, parts: { bill: 'upcurve' }, pose: 'tall', p: { leg: 2, neck: 1.2, bill: 1.6 } },
    Haematopodidae: { pal: { body: [220, 10, 18], belly: [40, 10, 92], bill: [15, 75, 50] }, parts: { bill: 'dagger' }, p: { leg: 1, bill: 1.5 } },
    Laridae: { pal: { body: [40, 10, 93], wing: [210, 10, 62], bill: [50, 75, 55], leg: [48, 60, 60] }, parts: { bill: 'gull' }, marks: { wingTip: 1 }, p: { leg: 0.9, body: 1.2 } },
    Gaviidae: { pal: { body: [220, 10, 17], belly: [40, 10, 92], head: [150, 20, 20] }, parts: { bill: 'dagger' }, pose: 'swim', marks: { checker: 1, collar: 1 }, p: { neck: 1.1, bill: 1.2, body: 1.4 } },
    Podicipedidae: { pal: { body: [30, 20, 32], belly: [30, 30, 70] }, parts: { bill: 'short', tail: 'none' }, pose: 'swim', p: { neck: 1.1, body: 0.95 } },
    Phalacrocoracidae: { pal: { body: [220, 12, 17], bill: [40, 60, 55] }, parts: { bill: 'hookThin' }, pose: 'swim', marks: { throat: 1 }, p: { neck: 1.6, bill: 1.3, body: 1.2 } },
    Anhingidae: { pal: { body: [220, 12, 17] }, parts: { bill: 'dagger', tail: 'long' }, pose: 'swim', p: { neck: 2, bill: 1.3 } },
    Pelecanidae: { pal: { body: [40, 10, 93], wing: [220, 10, 18], bill: [40, 70, 60] }, parts: { bill: 'pouch' }, pose: 'swim', p: { neck: 1.3, bill: 2, body: 1.5 } },
    Rallidae: { pal: { body: [28, 30, 35], belly: [20, 40, 50] }, parts: { bill: 'short', tail: 'cocked' }, marks: { bars: 0.8 }, p: { leg: 1.3, neck: 1.1, bill: 1.2 } },
    Aramidae: { pal: { body: [25, 40, 28], mark: [40, 10, 90] }, parts: { bill: 'curve' }, pose: 'tall', marks: { spots: 1 }, p: { leg: 1.6, neck: 1.5, bill: 1.5 } },
    Stercorariidae: { pal: { body: [25, 25, 25], belly: [40, 15, 80] }, parts: { bill: 'gull', tail: 'pin' }, p: { body: 1.2 } },
    Sulidae: { pal: { body: [40, 10, 92], wing: [25, 30, 30], bill: [210, 20, 55] }, parts: { bill: 'dagger' }, pose: 'swim', p: { body: 1.4, bill: 1.3 } },
    Fregatidae: { pal: { body: [220, 12, 16], mark: [0, 70, 45] }, parts: { bill: 'hookThin', tail: 'fork' }, pose: 'glide', marks: { throat: 1 }, p: { wing: 1.8 } },
  };
  def('wader', {
    skeleton: 'bird', regions: BIRD_REGIONS, nudge: Object.assign({}, BIRD_NUDGE, { marks: ['cap', 'mask', 'collar', 'bib', 'mottle', 'wingTip', 'eyering'] }),
    derive(x) {
      const F = WADER_FAM[x.fam] || { pal: { body: [30, 20, 45] }, parts: { bill: 'dagger' }, p: { leg: 1.3 } };
      let pal = Object.assign({}, F.pal), parts = Object.assign({ tail: 'short' }, F.parts), p = Object.assign({}, F.p), marks = Object.assign({}, F.marks);
      const g = x.genus;
      if (x.fam === 'Ardeidae') {
        if (/Ardea alba|Egretta thula|Bubulcus|egret/i.test(x.sci + ' ' + x.name) && !/reddish/i.test(x.name)) { pal.body = [40, 10, 94]; pal.belly = [40, 10, 94]; pal.bill = /Egretta/.test(g) ? [220, 10, 17] : [48, 75, 55]; }
        if (/herodias|cinerea/.test(x.sci)) { pal.body = [210, 18, 52]; pal.head = [40, 10, 92]; marks.cap = 1; }
        if (/Nycticorax|Nyctanassa/.test(g)) { pal.body = [210, 15, 60]; pal.head = [215, 25, 22]; p.leg = 1.2; p.neck = 1; }
        if (/Botaurus|Ixobrychus/.test(g)) { pal.body = [32, 40, 50]; marks.streaks = 1; p.neck = 1.2; }
        if (/rufescens/.test(x.sci)) { pal.body = [210, 15, 50]; pal.head = [12, 50, 52]; }
        if (/Butorides/.test(g)) { pal.body = [150, 20, 30]; pal.head = [10, 40, 38]; p.leg = 1.1; p.neck = 1.1; }
      } else if (x.fam === 'Laridae') {
        if (/Sterna|Thalasseus|Sternula|Gelochelidon|Hydroprogne|Chlidonias|Rynchops|Onychoprion/.test(g)) { parts.bill = 'dagger'; parts.tail = 'fork'; marks = { cap: 1 }; pal.head = pal.body; pal.mark = [220, 10, 17]; pal.bill = /elegans|maxima|caspia/.test(x.sci) ? [20, 75, 55] : [220, 10, 17]; p.leg = 0.6; }
        if (/heermanni/.test(x.sci)) { pal.body = [210, 8, 40]; pal.head = [40, 10, 92]; pal.bill = [2, 70, 50]; }
        if (/Pagophila/.test(g)) { pal.wing = [40, 10, 94]; marks = {}; }
        if (/Rissa/.test(g)) { p.leg = 0.5; if (/brevirostris/.test(x.sci)) pal.leg = [5, 70, 50]; }
        if (/delawarensis/.test(x.sci)) marks.billRing = 1;
      } else if (x.fam === 'Scolopacidae') {
        if (/Numenius/.test(g)) { parts.bill = 'curve'; p.bill = 2.2; p.leg = 1.5; }
        else if (/Limosa/.test(g)) { parts.bill = 'upcurve'; p.bill = 2; p.leg = 1.5; pal.belly = [22, 40, 65]; }
        else if (/Limnodromus/.test(g)) { p.bill = 2; pal.belly = [20, 45, 55]; }
        else if (/Tringa/.test(g)) { pal.leg = [52, 75, 55]; p.leg = 1.7; marks.spots = 0.6; }
        else if (/Calidris/.test(g)) { p.bill = 1.1; p.leg = 0.9; if (/alpina/.test(x.sci)) marks.bellyPatch = 1; if (/minutilla/.test(x.sci)) { p.body = 0.8; pal.leg = [60, 50, 50]; } }
        else if (/Gallinago|Scolopax/.test(g)) { p.bill = 2; p.leg = 0.8; marks.stripes = 1; }
        else if (/Actitis/.test(g)) { marks.spots = 1; }
        else if (/Phalaropus/.test(g)) { pal.body = [210, 8, 45]; pal.head = [12, 50, 45]; }
        else if (/Bartramia/.test(g)) { p.neck = 1.3; p.bill = 0.9; }
        else if (/Arenaria/.test(g)) { pal.body = [18, 50, 40]; marks.bib = 1; pal.leg = [22, 70, 55]; p.bill = 0.8; }
      } else if (x.fam === 'Charadriidae') {
        if (/vociferus/.test(x.sci)) { marks.collar = 2; pal.body = [28, 35, 42]; pal.tail = [20, 55, 50]; }
        if (/montanus/.test(x.sci)) { marks.collar = 0; marks.cap = 1; }
        if (/Pluvialis/.test(g)) { pal.belly = [220, 10, 17]; pal.body = [210, 5, 60]; marks = { mottle: 1 }; }
        if (/melodus|nivosus/.test(x.sci)) { pal.body = [38, 25, 75]; marks.collar = /melodus/.test(x.sci) ? 1 : 0.5; }
      } else if (x.fam === 'Rallidae') {
        if (/Fulica/.test(g)) { pal = { body: [220, 10, 18], belly: [220, 10, 20], bill: [40, 10, 92] }; marks = { shield: 1 }; x.swim = true; }
        if (/Porphyrio/.test(g)) { pal = { body: [250, 45, 42], belly: [250, 45, 42], bill: [2, 70, 50] }; marks = { shield: 1 }; }
        if (/Gallinula/.test(g)) { pal = { body: [220, 10, 22], bill: [2, 70, 50] }; marks = { shield: 1, streaks: 0.5 }; }
        if (/Laterallus/.test(g)) { pal.body = [220, 10, 20]; p.body = 0.7; marks.spots = 1; }
        if (/Rallus/.test(g)) { p.bill = 1.6; pal.belly = /elegans|obsoletus|crepitans/.test(x.sci) ? [20, 50, 50] : [30, 30, 60]; }
      } else if (x.fam === 'Podicipedidae') {
        if (/auritus|nigricollis/.test(x.sci)) { parts.crest = 'tufts'; pal.head = [220, 10, 18]; pal.belly = [10, 50, 45]; pal.mark = [45, 70, 60]; marks.eyeTuft = 1; }
        if (/Podilymbus/.test(g)) { marks.billRing = 1; parts.bill = 'short'; p.bill = 0.9; }
        if (/Aechmophorus/.test(g)) { p.neck = 1.8; pal.belly = [40, 10, 92]; marks.cap = 1; }
      } else if (x.fam === 'Gaviidae' && /adamsii/.test(x.sci)) { pal.bill = [50, 60, 75]; }
      const tw = birdBase(x, 'wader', pal, parts, p);
      Object.assign(tw.marks, marks);
      tw.pose = x.swim ? 'swim' : F.pose || 'perch';
      if (!pal.head) tw.col.head = tw.col.body;
      if (!pal.bill) tw.col.bill = [220, 10, 20];
      if (!pal.leg) tw.col.leg = tw.pose === 'tall' ? [220, 10, 20] : [40, 20, 35];
      return birdFinish(x, tw);
    },
  });

  def('waterfowl', {
    skeleton: 'bird', regions: BIRD_REGIONS, nudge: Object.assign({}, BIRD_NUDGE, { marks: ['speculum', 'cheek', 'collar', 'bib', 'eyering', 'sidePatch', 'cap'], parts: { crest: ['none', 'shag'] } }),
    derive(x) {
      const g = x.genus;
      let pal = { body: [30, 30, 45], belly: [32, 25, 55], head: [30, 30, 45], bill: [45, 30, 35] }, parts = { bill: 'duck', tail: 'short' }, marks = { speculum: 1 }, p = { neck: 1, body: 1.1, leg: 0.6 };
      if (/Branta/.test(g)) { pal = { body: [30, 20, 40], belly: [35, 15, 75], head: [220, 10, 17], bill: [220, 10, 17], mark: [40, 10, 92] }; marks = { cheek: 1 }; p = { neck: 1.8, body: 1.35, leg: 0.8 }; parts.bill = 'goose'; if (/bernicla/.test(x.sci)) { p.neck = 1.2; pal.body = [220, 10, 25]; } }
      else if (/Anser|Chen/.test(g)) { pal = { body: /caerulescens|rossii/.test(x.sci) ? [40, 10, 93] : [30, 15, 50], head: /caerulescens|rossii/.test(x.sci) ? [40, 10, 93] : [30, 15, 45], bill: [15, 70, 60], mark: [220, 10, 17] }; marks = { wingTip: 1 }; p = { neck: 1.5, body: 1.3, leg: 0.8 }; parts.bill = 'goose'; }
      else if (/Cygnus/.test(g)) { pal = { body: [40, 10, 94], head: [40, 10, 94], bill: [220, 10, 17] }; marks = {}; p = { neck: 2.4, body: 1.6 }; parts.bill = 'goose'; }
      else if (/Anas/.test(g) && /platyrhynchos/.test(x.sci)) { pal = { body: [210, 8, 70], belly: [210, 8, 72], head: [150, 50, 30], bill: [50, 75, 55], mark: [220, 55, 45] }; marks = { speculum: 1, collar: 1, bib: 1 }; }
      else if (/Mareca/.test(g)) { pal = { body: [15, 25, 50], head: /americana/.test(x.sci) ? [210, 8, 70] : [15, 50, 45], bill: [210, 20, 60] }; marks = { cap: 1, speculum: 1 }; }
      else if (/Spatula/.test(g)) { pal = { body: [22, 45, 48], head: [150, 45, 30], bill: [220, 10, 17] }; parts.bill = 'shovel'; marks = { speculum: 1, sidePatch: 1 }; if (/discors|cyanoptera/.test(x.sci)) { pal.head = /cyanoptera/.test(x.sci) ? [10, 60, 40] : [215, 25, 45]; parts.bill = 'duck'; marks = { cheek: /discors/.test(x.sci) ? 1 : 0, speculum: 1 }; } }
      else if (/Anas/.test(g)) { pal = { body: [28, 35, 38], head: [28, 30, 45], bill: [45, 40, 45] }; if (/acuta/.test(x.sci)) { pal = { body: [210, 6, 60], head: [25, 40, 30], belly: [40, 10, 92] }; parts.tail = 'pin'; p.neck = 1.4; } if (/crecca|carolinensis/.test(x.sci)) { pal.head = [15, 50, 40]; marks.cheek = 1; p.body = 0.9; } }
      else if (/Aix/.test(g)) { pal = { body: [25, 40, 40], head: [150, 45, 30], belly: [30, 40, 60], bill: [5, 65, 50], mark: [40, 10, 92] }; parts.crest = 'shag'; marks = { cheek: 1, collar: 1 }; }
      else if (/Aythya/.test(g)) { pal = { body: [210, 6, 65], belly: [210, 6, 70], head: /valisineria|americana/.test(x.sci) ? [12, 55, 45] : [220, 12, 20], bill: [210, 15, 55], mark: [220, 10, 17] }; marks = { bib: 1 }; }
      else if (/Melanitta/.test(g)) { pal = { body: [220, 10, 15], belly: [220, 10, 16], head: [220, 10, 15], bill: [40, 75, 55] }; marks = { knob: 1 }; parts.bill = 'goose'; }
      else if (/Somateria|Polysticta/.test(g)) { pal = { body: [40, 10, 90], belly: [220, 10, 17], head: [40, 10, 90], bill: [70, 30, 55], mark: [110, 40, 60] }; marks = { cap: 1, sidePatch: 1 }; p.body = 1.35; if (/Polysticta/.test(g)) { pal.belly = [25, 55, 50]; pal.body = [220, 10, 20]; } }
      else if (/Clangula/.test(g)) { pal = { body: [40, 10, 90], belly: [40, 10, 92], head: [40, 10, 90], mark: [25, 30, 25] }; parts.tail = 'pin'; marks = { cheek: 1, bib: 1 }; }
      else if (/Bucephala/.test(g)) { pal = { body: [40, 10, 92], head: [150, 30, 20], mark: [40, 10, 95] }; marks = { cheek: 1 }; p.head = 1.2; }
      else if (/Mergus|Lophodytes/.test(g)) { pal = { body: [210, 6, 60], head: /Lophodytes/.test(g) ? [220, 10, 17] : [150, 35, 25], bill: [2, 60, 45] }; parts.crest = 'shag'; parts.bill = 'merg'; marks = { bib: 0.6 }; }
      else if (/Oxyura/.test(g)) { pal = { body: [12, 55, 40], head: [220, 10, 17], bill: [205, 60, 55], mark: [40, 10, 92] }; parts.tail = 'stiff'; marks = { cheek: 1 }; }
      else if (/Dendrocygna/.test(g)) { pal = { body: [18, 50, 40], head: [30, 20, 60], bill: [5, 65, 55] }; p = { neck: 1.5, leg: 1.4, body: 1.1 }; marks = { wingbar: 1 }; }
      const tw = birdBase(x, 'waterfowl', pal, parts, p);
      Object.assign(tw.marks, marks); tw.pose = 'swim';
      tw.col.leg = [28, 70, 55];
      return birdFinish(x, tw);
    },
  });

  def('gamebird', {
    skeleton: 'bird', regions: BIRD_REGIONS, nudge: Object.assign({}, BIRD_NUDGE, { marks: ['bars', 'spots', 'wattle', 'collar', 'mask', 'airSac', 'scales'], parts: { tail: ['fan', 'long', 'short', 'pin'] } }),
    derive(x) {
      const g = x.genus;
      let pal = { body: [28, 35, 40], belly: [35, 30, 70] }, parts = { bill: 'short', tail: 'fan', head: 'small' }, marks = { bars: 1 }, p = { body: 1.35, leg: 0.8, neck: 0.8 };
      if (/Tympanuchus/.test(g)) { pal.mark = [30, 70, 55]; marks = { bars: 1.2, airSac: 1 }; parts.crest = 'pinnae'; parts.tail = 'short'; }
      else if (/Centrocercus/.test(g)) { pal = { body: [32, 20, 45], belly: [220, 10, 18], head: [220, 10, 25], mark: [40, 10, 92] }; marks = { bib: 1, airSac: 0.8 }; parts.tail = 'pin'; p.body = 1.5; }
      else if (/Phasianus/.test(g)) { pal = { body: [22, 55, 42], head: [150, 45, 28], mark: [2, 65, 48] }; marks = { wattle: 1, collar: 1, scales: 1 }; parts.tail = 'long'; p.tail = 2.2; }
      else if (/Meleagris/.test(g)) { pal = { body: [25, 30, 22], head: [210, 30, 60], mark: [2, 65, 48] }; parts.head = 'bald'; marks = { wattle: 1, bars: 0.6 }; parts.tail = 'fan'; p = { body: 1.6, leg: 1.1, neck: 1.2, tail: 1.3 }; }
      else if (/Bonasa|Dendragapus|Falcipennis|Canachites/.test(g)) { pal = { body: /Bonasa/.test(g) ? [25, 35, 42] : [210, 8, 35] }; marks = { bars: 1, collar: /Bonasa/.test(g) ? 1 : 0, wattle: /Dendragapus|Canachites/.test(g) ? 0.6 : 0 }; }
      else if (/Lagopus/.test(g)) { pal = { body: [40, 10, 92], belly: [40, 10, 94], mark: [2, 65, 48] }; marks = { wattle: 0.5 }; parts.tail = 'short'; }
      else if (x.fam === 'Odontophoridae') {
        pal = { body: [28, 40, 42], belly: [30, 35, 70], head: [25, 40, 35], mark: [40, 10, 92] }; parts.tail = 'short'; marks = { mask: 1, scales: 1 }; p = { body: 1.1, leg: 0.7, neck: 0.7 };
        if (/Callipepla|Oreortyx/.test(g)) { parts.crest = 'plume'; pal.body = [210, 12, 50]; }
        if (/Cyrtonyx/.test(g)) { marks = { mask: 1.3, spots: 1 }; }
      } else if (/Alectoris|Perdix/.test(g)) { pal = { body: [30, 20, 55] }; marks = { mask: 1, bars: 1 }; parts.tail = 'short'; }
      const tw = birdBase(x, 'gamebird', pal, parts, p);
      Object.assign(tw.marks, marks); tw.pose = 'perch';
      return birdFinish(x, tw);
    },
  });

  def('woodpecker', {
    skeleton: 'bird', regions: BIRD_REGIONS, nudge: Object.assign({}, BIRD_NUDGE, { marks: ['cap', 'bars', 'spots', 'moustache', 'bib', 'nape', 'backPatch'] }),
    derive(x) {
      const g = x.genus;
      let pal = { body: [220, 10, 18], belly: [40, 10, 90], head: [220, 10, 18], mark: [2, 65, 48] }, parts = { bill: 'chisel', tail: 'stiff' }, marks = { nape: 1, bars: 1 }, p = { bill: 1.1 };
      if (/Colaptes/.test(g)) { pal = { body: [28, 30, 50], belly: [35, 30, 85], head: [210, 6, 60], mark: [220, 10, 17] }; marks = { spots: 1, bib: 1, bars: 0.8, moustache: 1 }; p.bill = 1; }
      else if (/Melanerpes/.test(g)) {
        if (/formicivorus/.test(x.sci)) { marks = { cap: 1, mask: 1, backPatch: 0 }; pal.head = [40, 10, 92]; }
        else if (/erythrocephalus/.test(x.sci)) { pal.head = [2, 65, 48]; marks = { backPatch: 1 }; }
        else { pal = { body: [220, 10, 25], belly: [35, 20, 72], head: [35, 20, 72], mark: [2, 65, 48] }; marks = { bars: 1.2, cap: 0.6 }; }
      } else if (/Dryocopus|Campephilus/.test(g)) { pal = { body: [220, 10, 15], belly: [220, 10, 17], head: [220, 10, 15], mark: [2, 65, 48] }; parts.crest = 'point'; marks = { cap: 1, stripe: 1 }; p = { bill: 1.4, body: 1.4 }; if (/Campephilus/.test(g)) { pal.bill = [40, 30, 90]; marks.backPatch = 1; } }
      else if (/Sphyrapicus/.test(g)) { marks = { cap: 1, bib: 1, bars: 0.8, backPatch: 0.6 }; pal.belly = [52, 50, 80]; }
      else if (/Dryobates|Picoides|Leuconotopicus/.test(g)) { marks = { nape: 1, bars: /scalaris|borealis|nuttallii/.test(x.sci) ? 1.3 : 0, backPatch: /scalaris|borealis|nuttallii/.test(x.sci) ? 0 : 1, cheek: /borealis/.test(x.sci) ? 1 : 0 }; p.body = /villosus/.test(x.sci) ? 1.15 : 0.9; }
      const tw = birdBase(x, 'woodpecker', pal, parts, p);
      Object.assign(tw.marks, marks); tw.pose = 'cling';
      if (!pal.bill) tw.col.bill = [220, 10, 20];
      return birdFinish(x, tw);
    },
  });

  // --- reptiles and amphibians ---
  def('snake', {
    skeleton: 'snake', regions: { body: 0.5, belly: 0.15, mark: 0.35 }, nudge: { marks: ['bands', 'blotches', 'stripe', 'speckle', 'collar', 'diamonds'], parts: { head: ['round', 'viper'] }, p: ['thick', 'len'] },
    derive(x) {
      const g = x.genus;
      let pal = { body: [30, 30, 40], belly: [40, 30, 75], mark: [25, 30, 20] }, marks = { blotches: 1 }, head = x.fam === 'Viperidae' ? 'viper' : 'round', tail = /Crotalus|Sistrurus/.test(g) ? 'rattle' : 'point', p = { thick: 1, len: 1 };
      if (/Thamnophis/.test(g)) { pal = { body: [150, 15, 25], belly: [55, 40, 70], mark: [52, 70, 62] }; marks = { stripe: 1, checker: 0.5 }; }
      else if (/Pituophis/.test(g)) { pal = { body: [42, 45, 62], mark: [25, 35, 25] }; marks = { blotches: 1.2 }; p.thick = 1.2; }
      else if (/Crotalus/.test(g)) { pal = { body: [35, 25, 55], mark: [25, 30, 28] }; marks = { diamonds: 1, tailBands: 1 }; p.thick = 1.25; }
      else if (/Diadophis/.test(g)) { pal = { body: [210, 15, 25], belly: [40, 80, 55], mark: [40, 80, 58] }; marks = { collar: 1 }; p.thick = 0.7; }
      else if (/Opheodrys/.test(g)) { pal = { body: [100, 50, 45], belly: [55, 50, 75] }; marks = {}; p.thick = 0.7; }
      else if (/Storeria/.test(g)) { pal = { body: [25, 30, 35], belly: [5, 60, 50] }; marks = { speckle: 0.6 }; p.thick = 0.7; }
      else if (/Lampropeltis/.test(g)) { pal = { body: [220, 10, 17], mark: /getula|holbrooki|californiae/.test(x.sci) ? [45, 30, 88] : [3, 65, 48] }; marks = { bands: 1, rings: /triangulum|elapsoides|pyromelana|zonata/.test(x.sci) ? 1 : 0 }; }
      else if (/Micrurus/.test(g)) { pal = { body: [3, 65, 48], mark: [50, 80, 58] }; marks = { bands: 1, rings: 1 }; }
      else if (/Coluber|Masticophis/.test(g)) { pal = { body: /flagellum/.test(x.sci) ? [15, 40, 45] : [215, 25, 25], belly: [210, 10, 70] }; marks = { stripe: /taeniatus|lateralis/.test(x.sci) ? 1 : 0 }; p.len = 1.2; p.thick = 0.85; }
      else if (/Nerodia/.test(g)) { pal = { body: [30, 25, 30], mark: [25, 30, 18] }; marks = { bands: 1 }; p.thick = 1.2; }
      else if (/Heterodon/.test(g)) { pal = { body: [35, 40, 55] }; marks = { blotches: 1 }; head = 'hog'; p.thick = 1.15; }
      else if (/Charina|Lichanura/.test(g)) { pal = { body: [30, 30, 40] }; marks = {}; head = 'blunt'; tail = 'blunt'; p.thick = 1.2; p.len = 0.8; }
      else if (/Agkistrodon/.test(g)) { pal = { body: /contortrix/.test(x.sci) ? [25, 40, 55] : [30, 15, 25], mark: [18, 45, 35] }; marks = { bands: 1 }; }
      else if (/Pantherophis|Elaphe/.test(g)) { pal = { body: /guttatus/.test(x.sci) ? [15, 60, 55] : [220, 10, 20], mark: [5, 60, 40] }; marks = { blotches: /guttatus|emoryi/.test(x.sci) ? 1.2 : 0.3 }; p.len = 1.15; }
      else if (/Tantilla|Sonora|Virginia|Carphophis|Rena|Leptotyphlops/.test(g)) { p.thick = 0.6; p.len = 0.8; marks = { collar: /Tantilla/.test(g) ? 1 : 0 }; }
      else if (/Salvadora/.test(g)) { pal = { body: [40, 30, 60], mark: [25, 35, 25] }; marks = { stripe: 1.2 }; }
      else if (/Arizona/.test(g)) { pal = { body: [40, 35, 72], mark: [25, 30, 40] }; marks = { blotches: 1 }; }
      const tw = base(x, 'snake', pal); tw.parts = { head, tail }; tw.p = p; tw.marks = marks; tw.pose = 'coil';
      nameColors(x, tw, { body: 'body', belly: 'belly', mark: 'mark', head: 'mark', tail: 'mark', back: 'body' });
      if (x.nm.pat.has('stripes')) tw.marks.stripe = 1;
      if (x.nm.pat.has('bands')) tw.marks.bands = 1;
      if (x.nm.pat.has('diamonds')) tw.marks.diamonds = 1;
      if (x.nm.pat.has('spots')) tw.marks.blotches = 1;
      if (x.nm.pat.has('collar')) tw.marks.collar = 1;
      props(x, tw, ['thick', 'len'], 0.08); jitterColors(x, tw, 8, 5);
      return tw;
    },
  });

  const SPRAWL_NUDGE = { marks: ['stripes', 'spots', 'bands', 'collar', 'bellyFlash', 'mottle'], parts: {}, p: ['tail', 'leg', 'depth', 'head'] };
  def('lizard', {
    skeleton: 'sprawl', regions: { body: 0.45, belly: 0.12, head: 0.08, mark: 0.35 }, nudge: Object.assign({}, SPRAWL_NUDGE, { parts: { crest: ['none', 'spikes'] } }),
    derive(x) {
      const f = x.fam, g = x.genus;
      let pal = { body: [35, 30, 50], belly: [40, 25, 78], mark: [25, 30, 25] }, parts = { head: 'wedge', crest: 'none', tail: 'thin' }, marks = { spots: 0.6 }, p = { leg: 1, tail: 1, depth: 1, head: 1, body: 1 };
      if (f === 'Phrynosomatidae') {
        if (/Phrynosoma/.test(g)) { pal = { body: [30, 30, 62], mark: [20, 35, 35] }; parts.crest = 'horns'; marks = { blotches: 1, spikes: 1 }; p = { leg: 0.7, tail: 0.45, depth: 0.8, head: 1, body: 1.5 }; }
        else if (/Sceloporus/.test(g)) { pal = { body: [30, 20, 42], belly: [210, 55, 50] }; marks = { chevrons: 1, bellyFlash: 1 }; parts.crest = 'spikes'; }
        else if (/Uta|Urosaurus/.test(g)) { pal = { body: [30, 20, 45] }; marks = { speckle: 1, bellyFlash: 0.6 }; }
        else if (/Holbrookia|Cophosaurus/.test(g)) { pal = { body: [35, 25, 68], mark: [220, 10, 18] }; marks = { bars: 1, spots: 0.4 }; }
        else { marks = { stripes: 0.6 }; }
      } else if (f === 'Crotaphytidae') { pal = { body: /Gambelia/.test(g) ? [38, 30, 70] : [140, 30, 42], mark: /Gambelia/.test(g) ? [20, 40, 35] : [220, 10, 17], head: /Gambelia/.test(g) ? [38, 30, 70] : [50, 60, 60] }; marks = /Gambelia/.test(g) ? { spots: 1.3 } : { collar: 2, spots: 0.4 }; parts.head = 'big'; p = { leg: 1.25, tail: 1.3, head: 1.3 }; }
      else if (f === 'Dactyloidae') { pal = { body: [110, 55, 42], mark: [340, 60, 55] }; marks = { dewlap: 1 }; parts.head = 'long'; p = { leg: 0.9, tail: 1.3, body: 0.8 }; }
      else if (f === 'Gekkonidae' || f === 'Eublepharidae') { pal = { body: [35, 15, 72], mark: [25, 30, 40] }; marks = { spots: 1 }; parts.head = 'big'; parts.tail = 'thick'; p = { leg: 0.9, depth: 0.9, head: 1.2 }; }
      else if (f === 'Helodermatidae') { pal = { body: [20, 60, 55], mark: [220, 10, 17] }; marks = { beads: 1, bands: 1 }; parts.head = 'blunt'; parts.tail = 'thick'; p = { leg: 0.7, tail: 0.7, depth: 1.2, body: 1.3 }; }
      else if (f === 'Scincidae') { pal = { body: [30, 30, 35], mark: [45, 50, 75], tail: [210, 60, 50] }; marks = { stripes: 1.2 }; parts.head = 'blunt'; p = { leg: 0.6, tail: 1.1, depth: 0.85 }; if (/fasciatus|inexpectatus|laticeps/.test(x.sci)) marks.blueTail = 1; }
      else if (f === 'Teiidae') { pal = { body: [30, 30, 30], mark: [48, 50, 72] }; marks = { stripes: 1, spots: /gularis|grahamii|sonorae|tesselata/.test(x.sci) ? 1 : 0.3 }; parts.head = 'long'; p = { leg: 1.1, tail: 1.6, body: 0.9 }; }
      else if (f === 'Anguidae') { pal = { body: [30, 35, 42], mark: [25, 30, 25] }; marks = { bands: 1 }; p = { leg: 0.45, tail: 1.5, depth: 0.8, body: 1.2 }; if (/Ophisaurus/.test(g)) { p.leg = 0; marks = { stripes: 1 }; } }
      else if (f === 'Xantusiidae') { pal = { body: [35, 20, 45] }; marks = { speckle: 1 }; }
      else if (f === 'Iguanidae') { pal = { body: /Dipsosaurus/.test(g) ? [35, 20, 65] : [30, 20, 35] }; parts.crest = 'spikes'; p = { body: 1.2, tail: 1.3 }; }
      const tw = base(x, 'lizard', pal); tw.parts = parts; tw.p = p; tw.marks = marks; tw.pose = 'sprawl';
      if (!pal.head) tw.col.head = tw.col.body;
      return sprawlFinish(x, tw);
    },
  });
  function sprawlFinish(x, tw) {
    nameColors(x, tw, { body: ['body', 'head'], belly: 'belly', head: 'head', mark: 'mark', tail: 'mark', leg: 'mark', back: 'body' });
    const pt = x.nm.pat;
    if (pt.has('stripes')) tw.marks.stripes = Math.max(1, tw.marks.stripes || 0);
    if (pt.has('spots')) tw.marks.spots = Math.max(1, tw.marks.spots || 0);
    if (pt.has('bands')) tw.marks.bands = Math.max(1, tw.marks.bands || 0);
    if (pt.has('collar')) tw.marks.collar = Math.max(1, tw.marks.collar || 0);
    if (pt.has('mottle')) tw.marks.mottle = 1;
    if (pt.has('horns') && tw.parts.crest === 'none') tw.parts.crest = 'horns';
    if (x.nm.count) tw.marks.count = Math.min(12, x.nm.count);
    lengthWords(x, tw);
    if (x.nm.size > 0) tw.p.body = r1((tw.p.body || 1) * 1.15);
    if (x.nm.size < 0) tw.p.body = r1((tw.p.body || 1) * 0.9);
    props(x, tw, ['leg', 'tail', 'depth', 'head'], 0.08); jitterColors(x, tw, 8, 5);
    return tw;
  }

  def('salamander', {
    skeleton: 'sprawl', regions: { body: 0.45, belly: 0.15, head: 0.05, mark: 0.35 }, nudge: Object.assign({}, SPRAWL_NUDGE, { parts: { tail: ['thin', 'paddle'] } }),
    derive(x) {
      const f = x.fam, g = x.genus;
      let pal = { body: [25, 25, 25], belly: [40, 30, 55], mark: [48, 70, 60] }, parts = { head: 'blunt', crest: 'none', tail: 'paddle', gills: 'none' }, marks = { spots: 0.6 }, p = { leg: 0.7, tail: 1, depth: 0.85, head: 1, body: 1 };
      if (f === 'Ambystomatidae') {
        if (/tigrinum|mavortium|californiense/.test(x.sci)) { pal = { body: [220, 12, 20], mark: [50, 75, 58] }; marks = { blotches: 1.2 }; }
        else if (/maculatum/.test(x.sci)) { pal = { body: [220, 12, 18], mark: [48, 85, 58] }; marks = { spots: 1.2 }; }
        else if (/laterale/.test(x.sci)) { pal = { body: [220, 15, 18], mark: [210, 55, 70] }; marks = { speckle: 1 }; }
        else if (/opacum/.test(x.sci)) { pal = { body: [220, 10, 16], mark: [40, 10, 90] }; marks = { bands: 1 }; }
        else if (/Dicamptodon/.test(g)) { pal = { body: [30, 30, 38], mark: [25, 30, 22] }; marks = { mottle: 1 }; p.body = 1.3; }
        p.body = (p.body || 1) * 1.15;
      } else if (f === 'Dicamptodontidae') { pal = { body: [30, 30, 38], mark: [25, 30, 22] }; marks = { mottle: 1 }; p.body = 1.3; }
      else if (f === 'Plethodontidae') {
        pal = { body: [25, 20, 25], belly: [210, 5, 55], mark: [210, 5, 70] }; parts.tail = 'thin'; marks = { speckle: 0.6 }; p = { leg: 0.55, tail: 1.2, depth: 0.7, head: 0.9, body: 0.85 };
        if (/cinereus|redback|Plethodon/.test(x.sci + x.name) && x.has(/red/)) { pal.mark = [10, 60, 45]; marks = { stripe: 1 }; }
        if (/Eurycea/.test(g)) { pal = { body: [40, 60, 58], mark: [220, 10, 20] }; marks = { stripe: 0.6, spots: 0.8 }; if (/rathbuni|tridentifera|waterlooensis|nana|sosorum/.test(x.sci)) { pal.body = [350, 30, 85]; parts.gills = 'ext'; marks = {}; p.leg = 0.8; } }
        if (/Pseudotriton/.test(g)) { pal = { body: [8, 65, 50], mark: [220, 10, 17] }; marks = { spots: 1 }; }
        if (/Desmognathus/.test(g)) { pal.body = [28, 25, 30]; marks = { mottle: 0.8 }; p.depth = 0.9; }
        if (/Batrachoseps/.test(g)) { p.leg = 0.35; p.tail = 1.5; p.body = 0.75; }
        if (/Ensatina/.test(g)) { pal = { body: [22, 55, 45], mark: [45, 70, 60] }; marks = /klauberi|croceater|eschscholtzii/.test(x.sci) ? { blotches: 1 } : {}; }
        if (/Aneides|Hydromantes/.test(g)) { pal.body = [220, 8, 20]; pal.mark = [60, 30, 60]; marks = { speckle: 1 }; }
      } else if (f === 'Salamandridae') { pal = { body: [30, 40, 38], belly: [40, 80, 58], mark: [5, 65, 48] }; marks = { bellyFlash: 1 }; parts.head = 'wedge'; p.depth = 0.9; if (/viridescens/.test(x.sci)) { pal.body = [80, 30, 40]; marks = { spots: 0.8 }; } if (/rivularis/.test(x.sci)) { pal.belly = [5, 60, 45]; pal.body = [25, 30, 20]; } if (/perstriatus/.test(x.sci)) marks = { stripe: 1 }; }
      else if (f === 'Cryptobranchidae') { pal = { body: [30, 25, 32], mark: [25, 30, 22] }; marks = { mottle: 1, folds: 1 }; parts.head = 'flat'; p = { leg: 0.6, tail: 0.8, depth: 0.75, head: 1.3, body: 1.6 }; }
      else if (f === 'Proteidae') { pal = { body: [25, 35, 35], mark: [220, 10, 20] }; parts.gills = 'ext'; marks = { spots: 0.8 }; p = { leg: 0.55, tail: 0.8, depth: 0.8, head: 1.1, body: 1.3 }; }
      else if (f === 'Rhyacotritonidae') { pal = { body: [40, 30, 32], belly: [50, 80, 58], mark: [220, 10, 17] }; marks = { speckle: 0.6, bellyFlash: 0.6 }; p.body = 0.8; }
      else if (f === 'Sirenidae' || f === 'Amphiumidae') { pal = { body: [210, 8, 30] }; parts.gills = f === 'Sirenidae' ? 'ext' : 'none'; marks = {}; p = { leg: 0.25, tail: 0.8, depth: 0.7, head: 1, body: 1.8 }; }
      const tw = base(x, 'salamander', pal); tw.parts = parts; tw.p = p; tw.marks = marks; tw.pose = 'sprawl';
      tw.col.head = tw.col.body;
      return sprawlFinish(x, tw);
    },
  });

  def('turtle', {
    skeleton: 'turtle', regions: { body: 0.45, belly: 0.1, head: 0.15, mark: 0.3 }, nudge: { marks: ['rays', 'spots', 'rim', 'earStripe', 'neckStripes', 'scutes'], parts: { shell: ['dome', 'flat', 'high'] }, p: ['dome', 'head', 'leg'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      let pal = { body: [80, 20, 30], belly: [48, 50, 60], head: [90, 20, 30], mark: [52, 70, 60] }, parts = { shell: 'dome', limbs: 'legs', head: 'normal' }, marks = { scutes: 1 }, p = { dome: 1, head: 1, leg: 1, tail: 1 };
      if (f === 'Testudinidae') { pal = { body: [30, 30, 42], head: [35, 20, 50], mark: [40, 40, 60] }; parts = { shell: 'high', limbs: 'elephant', head: 'normal' }; marks = { scutes: 1.3, rays: /polyphemus|agassizii|morafkai/.test(x.sci) ? 0 : 0.6 }; p.dome = 1.3; }
      else if (f === 'Cheloniidae' || f === 'Dermochelyidae') { pal = { body: /Caretta/.test(g) ? [22, 45, 38] : [100, 20, 38], head: [25, 40, 42], mark: [40, 30, 70] }; parts = { shell: 'flat', limbs: 'flippers', head: 'big' }; marks = { scutes: 1, headScales: 1 }; }
      else if (f === 'Chelydridae') { pal = { body: [40, 15, 25], head: [40, 15, 28] }; parts = { shell: 'ridged', limbs: 'legs', head: 'big' }; marks = { ridges: 1 }; p = { dome: 0.8, head: 1.4, leg: 1, tail: 1.8 }; }
      else if (f === 'Trionychidae') { pal = { body: [45, 25, 50], head: [45, 25, 50], mark: [220, 10, 25] }; parts = { shell: 'pancake', limbs: 'legs', head: 'snorkel' }; marks = { spots: 1 }; p.dome = 0.4; }
      else if (f === 'Kinosternidae') { pal = { body: [30, 25, 25], head: [30, 20, 30], mark: [48, 60, 60] }; parts.shell = 'dome'; marks = { neckStripes: /baurii|odoratus|Sternotherus/.test(x.sci) || x.has(/striped/) ? 1 : 0.3 }; p = { dome: 1.05, head: 1.1, leg: 0.85, tail: 0.6 }; if (/depressus/.test(x.sci)) { parts.shell = 'flat'; p.dome = 0.6; } }
      else if (f === 'Emydidae') {
        if (/Terrapene/.test(g)) { pal = { body: [30, 40, 30], mark: [45, 75, 58] }; parts.shell = 'high'; marks = { rays: 1, spots: 0.5 }; p.dome = 1.25; }
        else if (/Trachemys/.test(g)) { pal = { body: [90, 25, 30], mark: [52, 70, 60], head: [100, 25, 30] }; marks = { earStripe: 1, neckStripes: 1 }; if (/scripta elegans|elegans/.test(x.sci) || x.has(/red-eared/)) marks.earStripe = 1.2; }
        else if (/Pseudemys/.test(g)) { pal = { body: [80, 20, 28], belly: /rubriventris|nelsoni/.test(x.sci) ? [10, 60, 50] : [48, 50, 60], mark: [52, 70, 60] }; marks = { neckStripes: 1, scutes: 1.2 }; p.dome = 1.1; }
        else if (/Chrysemys/.test(g)) { pal = { body: [80, 15, 22], mark: [5, 60, 50] }; marks = { rim: 1, neckStripes: 1 }; p.dome = 0.85; }
        else if (/Clemmys/.test(g)) { pal = { body: [220, 10, 17], mark: [50, 80, 60] }; marks = { spots: 1.2 }; }
        else if (/Malaclemys/.test(g)) { pal = { body: [30, 15, 38], head: [210, 8, 70], mark: [220, 10, 20] }; marks = { scutes: 1.5, spots: 0.8 }; }
        else if (/Actinemys|Emys|Emydoidea/.test(g)) { pal = { body: [30, 20, 28], mark: [48, 50, 60] }; marks = { speckle: 1 }; if (/Emydoidea/.test(g)) { marks.throat = 1; p.dome = 1.2; } }
        else if (/Graptemys/.test(g)) { pal = { body: [90, 20, 35], mark: [52, 70, 60] }; parts.shell = 'ridged'; marks = { neckStripes: 1, scutes: 1.4 }; }
        else if (/Glyptemys/.test(g)) { pal = { body: [30, 25, 28], head: [15, 60, 45] }; marks = { scutes: 1.6 }; }
        else if (/Deirochelys/.test(g)) { pal = { body: [80, 15, 30], mark: [52, 60, 60] }; marks = { rim: 1 }; p.head = 0.9; p.neck = 1.6; }
      }
      const tw = base(x, 'turtle', pal); tw.parts = parts; tw.p = p; tw.marks = marks; tw.pose = 'walk';
      nameColors(x, tw, { body: 'body', belly: 'belly', head: 'head', mark: 'mark', leg: 'head', back: 'body' });
      if (x.nm.pat.has('spots')) tw.marks.spots = Math.max(1, tw.marks.spots || 0);
      if (x.nm.pat.has('stripes')) tw.marks.neckStripes = 1;
      props(x, tw, ['dome', 'head', 'leg'], 0.08); jitterColors(x, tw, 8, 5);
      return tw;
    },
  });

  def('frog', {
    skeleton: 'frog', regions: { body: 0.5, belly: 0.12, mark: 0.38 }, nudge: { marks: ['spots', 'stripe', 'mask', 'legBars', 'mottle', 'lip'], parts: { skin: ['smooth', 'warty'] }, p: ['leg', 'eye', 'body'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      let pal = { body: [90, 30, 40], belly: [50, 30, 80], mark: [100, 30, 22] }, parts = { skin: 'smooth', toes: 'plain', pose: 'sit' }, marks = { spots: 0.5 }, p = { leg: 1, eye: 1, body: 1 };
      if (f === 'Bufonidae') { pal = { body: [30, 30, 42], belly: [40, 25, 78], mark: [25, 35, 25] }; parts.skin = 'warty'; marks = { warts: 1, spots: 0.6, stripe: /woodhousii|americanus|fowleri/.test(x.sci) ? 0.6 : 0 }; p = { leg: 0.75, eye: 0.9, body: 1.15 }; if (/punctatus/.test(x.sci)) { pal.body = [30, 15, 55]; pal.mark = [5, 65, 50]; marks = { warts: 1, spots: 1 }; } if (/alvarius/.test(x.sci)) { pal.body = [80, 20, 38]; marks = { warts: 0.6, glands: 1 }; p.body = 1.35; } if (/exsul/.test(x.sci)) { pal.body = [220, 10, 20]; pal.mark = [40, 20, 85]; marks = { speckle: 1, warts: 1 }; } }
      else if (f === 'Hylidae') {
        parts.toes = 'pads'; pal = { body: [100, 45, 45], belly: [50, 20, 85], mark: [100, 30, 22] }; marks = { stripe: 0.5 }; p = { leg: 1.1, eye: 1.1, body: 0.8 };
        if (/versicolor|chrysoscelis|arenicolor/.test(x.sci)) { pal.body = [210, 5, 55]; pal.mark = [220, 10, 25]; pal.belly = [45, 70, 60]; marks = { mottle: 1, thighFlash: 1 }; }
        if (/cinerea/.test(x.sci)) { marks = { stripe: 1 }; pal.mark = [40, 10, 90]; }
        if (/crucifer/.test(x.sci)) { pal.body = [30, 35, 55]; marks = { cross: 1 }; }
        if (/Pseudacris/.test(g) && !/crucifer/.test(x.sci)) { pal.body = [30, 20, 50]; marks = { stripes: 1 }; parts.toes = 'plain'; }
        if (/Acris/.test(g)) { pal.body = [40, 25, 45]; marks = { triangle: 1, legBars: 1 }; parts.toes = 'plain'; }
      } else if (f === 'Ranidae') {
        pal = { body: [100, 35, 40], belly: [45, 30, 85], mark: [110, 30, 20] }; parts.skin = 'smooth'; marks = { stripe: 0.6, legBars: 1 }; p = { leg: 1.35, eye: 1, body: 1.1 };
        if (/catesbeianus|clamitans/.test(x.sci)) { marks = { tympanum: 1, legBars: 0.6 }; p.body = 1.4; pal.body = [85, 40, 38]; pal.belly = [55, 50, 80]; }
        if (/pipiens|sphenocephala|chiricahuensis|onca|yavapaiensis|blairi|berlandieri|utricularia|fisheri/.test(x.sci) || x.has(/leopard/)) { pal.body = [110, 35, 45]; marks = { spots: 1.3, stripe: 1 }; }
        if (/aurora|draytonii/.test(x.sci)) { pal.body = [25, 35, 40]; pal.belly = [5, 60, 55]; marks = { spots: 0.6, mask: 0.6 }; }
        if (/boylii|muscosa|sierrae/.test(x.sci)) { pal.body = [45, 20, 45]; pal.belly = [50, 70, 60]; marks = { mottle: 1 }; }
        if (/sylvatica/.test(x.sci)) { pal.body = [25, 40, 45]; marks = { mask: 1.2 }; }
        if (/palustris/.test(x.sci)) { pal.body = [35, 35, 55]; marks = { squares: 1 }; }
        if (/tarahumarae/.test(x.sci)) { pal.body = [80, 20, 30]; marks = { mottle: 0.8 }; }
      } else if (f === 'Scaphiopodidae') { pal = { body: [40, 25, 48], mark: [25, 30, 30] }; parts.skin = 'warty'; marks = { speckle: 1, lyre: /hammondii|intermontana/.test(x.sci) ? 0 : 0.8 }; p = { leg: 0.7, eye: 1.3, body: 1.05 }; }
      else if (f === 'Microhylidae') { pal = { body: [30, 15, 45] }; marks = { fold: 1 }; p = { leg: 0.6, eye: 0.6, body: 0.9 }; parts.head = 'pointed'; }
      else if (f === 'Eleutherodactylidae' || f === 'Craugastoridae') { pal = { body: [30, 25, 48] }; marks = { mottle: 0.8 }; p = { leg: 0.9, eye: 1.2, body: 0.75 }; }
      else if (f === 'Pipidae') { pal = { body: [80, 15, 35] }; parts.pose = 'swim'; }
      const tw = base(x, 'frog', pal); tw.parts = parts; tw.p = p; tw.marks = marks; tw.pose = parts.pose;
      nameColors(x, tw, { body: 'body', belly: 'belly', mark: 'mark', leg: 'mark', back: 'body' });
      if (x.nm.pat.has('spots')) tw.marks.spots = Math.max(1, tw.marks.spots || 0);
      if (x.nm.pat.has('stripes')) tw.marks.stripe = 1;
      if (x.nm.col.leg) tw.marks.legColor = 1;
      if (x.nm.size > 0) tw.p.body = r1(tw.p.body * 1.15);
      props(x, tw, ['leg', 'eye', 'body'], 0.08); jitterColors(x, tw, 8, 5);
      return tw;
    },
  });

  // --- fish ---
  const FISH_FAM = {
    Centrarchidae: { shape: 'deep', tail: 'fork', dorsal: 'spiny', pal: { body: [90, 30, 40], belly: [45, 60, 62], fin: [90, 25, 35] }, marks: { bars: 0.6, earFlap: 1 } },
    Cyprinidae: { shape: 'minnow', tail: 'fork', dorsal: 'single', pal: { body: [70, 15, 55], belly: [40, 10, 88], fin: [30, 20, 55] }, marks: { stripe: 0.5 } },
    Leuciscidae: { shape: 'minnow', tail: 'fork', dorsal: 'single', pal: { body: [70, 15, 55], belly: [40, 10, 88] }, marks: { stripe: 0.5 } },
    Catostomidae: { shape: 'sucker', tail: 'fork', dorsal: 'single', pal: { body: [35, 25, 42], belly: [40, 15, 85] }, marks: {} },
    Ictaluridae: { shape: 'catfish', tail: 'square', dorsal: 'single', pal: { body: [30, 20, 32], belly: [45, 20, 80] }, marks: { barbels: 1 } },
    Percidae: { shape: 'torpedo', tail: 'square', dorsal: 'split', pal: { body: [55, 35, 45], belly: [45, 20, 85] }, marks: { bars: 1 } },
    Salmonidae: { shape: 'torpedo', tail: 'square', dorsal: 'adipose', pal: { body: [120, 15, 42], belly: [40, 10, 88], mark: [220, 10, 18] }, marks: { spots: 1 } },
    Esocidae: { shape: 'pike', tail: 'fork', dorsal: 'rear', pal: { body: [100, 25, 38], belly: [45, 30, 80], mark: [60, 40, 70] }, marks: { spots: 0.8 } },
    Cyprinodontidae: { shape: 'pup', tail: 'round', dorsal: 'single', pal: { body: [210, 40, 55], belly: [40, 20, 85], mark: [220, 10, 20] }, marks: { bars: 0.8 } },
    Fundulidae: { shape: 'pup', tail: 'round', dorsal: 'rear', pal: { body: [70, 20, 50] }, marks: { bars: 0.8 } },
    Poeciliidae: { shape: 'pup', tail: 'round', dorsal: 'rear', pal: { body: [60, 15, 60] }, marks: { spots: 0.4 } },
    Gobiidae: { shape: 'goby', tail: 'round', dorsal: 'split', pal: { body: [35, 25, 55] }, marks: { mottle: 1 } },
    Lutjanidae: { shape: 'deep', tail: 'fork', dorsal: 'spiny', pal: { body: [5, 60, 55], belly: [10, 40, 80] }, marks: {} },
    Serranidae: { shape: 'grouper', tail: 'round', dorsal: 'spiny', pal: { body: [25, 25, 40] }, marks: { mottle: 1 } },
    Sciaenidae: { shape: 'torpedo', tail: 'square', dorsal: 'split', pal: { body: [210, 10, 60] }, marks: { speckle: 1 } },
    Labridae: { shape: 'deep', tail: 'round', dorsal: 'long', pal: { body: [220, 10, 25] }, marks: { mottle: 0.8 } },
    Cichlidae: { shape: 'deep', tail: 'round', dorsal: 'long', pal: { body: [210, 10, 40] }, marks: { bars: 0.6 } },
    Pomatomidae: { shape: 'torpedo', tail: 'fork', dorsal: 'split', pal: { body: [205, 30, 50], belly: [210, 10, 85] }, marks: {} },
    Xiphiidae: { shape: 'sword', tail: 'lunate', dorsal: 'sail', pal: { body: [220, 25, 30], belly: [210, 10, 80] }, marks: {} },
    Moronidae: { shape: 'torpedo', tail: 'fork', dorsal: 'split', pal: { body: [210, 10, 65] }, marks: { stripe: 1.2 } },
    Lepisosteidae: { shape: 'gar', tail: 'round', dorsal: 'rear', pal: { body: [70, 20, 45] }, marks: { spots: 1 } },
    Acipenseridae: { shape: 'sturgeon', tail: 'shark', dorsal: 'rear', pal: { body: [30, 15, 40] }, marks: { scutes: 1 } },
    Clupeidae: { shape: 'minnow', tail: 'fork', dorsal: 'single', pal: { body: [210, 20, 65] }, marks: { spot: 1 } },
    Cottidae: { shape: 'goby', tail: 'round', dorsal: 'split', pal: { body: [35, 30, 40] }, marks: { mottle: 1 } },
    Atherinopsidae: { shape: 'minnow', tail: 'fork', dorsal: 'split', pal: { body: [100, 10, 70] }, marks: { stripe: 1 } },
    Elassomatidae: { shape: 'pup', tail: 'round', dorsal: 'single', pal: { body: [220, 20, 25] }, marks: { speckle: 1 } },
    Amiidae: { shape: 'long', tail: 'round', dorsal: 'long', pal: { body: [90, 20, 35] }, marks: { eyespot: 1 } },
    Anguillidae: { shape: 'eel', tail: 'round', dorsal: 'long', pal: { body: [60, 25, 35] }, marks: {} },
    Petromyzontidae: { shape: 'eel', tail: 'round', dorsal: 'long', pal: { body: [35, 15, 50] }, marks: {} },
  };
  def('fish', {
    skeleton: 'fish', regions: { body: 0.45, belly: 0.12, fin: 0.13, mark: 0.3 }, nudge: { marks: ['bars', 'spots', 'stripe', 'mottle', 'eyespot', 'finEdge'], parts: { tail: ['fork', 'round', 'square'] }, p: ['depth', 'fin', 'len'] },
    derive(x) {
      const F = FISH_FAM[x.fam] || { shape: 'torpedo', tail: 'fork', dorsal: 'single', pal: { body: [200, 15, 50] }, marks: {} };
      const g = x.genus;
      const pal = Object.assign({ belly: shade(F.pal.body, 30, -10), fin: shade(F.pal.body, -6), mark: [220, 10, 20] }, F.pal);
      let parts = { shape: F.shape, tail: F.tail, dorsal: F.dorsal }, marks = Object.assign({}, F.marks), p = { depth: 1, fin: 1, len: 1, mouth: 1 };
      if (x.fam === 'Centrarchidae') {
        if (/Micropterus/.test(g)) { parts.shape = 'bass'; pal.body = [85, 30, 40]; marks = { stripe: /salmoides/.test(x.sci) ? 1 : 0, bars: /dolomieu/.test(x.sci) ? 1 : 0.3 }; p.mouth = 1.5; }
        if (/Pomoxis/.test(g)) { pal.body = [80, 15, 60]; marks = { speckle: 1.2 }; p.fin = 1.4; }
        if (/macrochirus/.test(x.sci)) { pal.body = [200, 25, 40]; pal.belly = [30, 60, 60]; marks = { bars: 1, earFlap: 1 }; }
        if (/gibbosus/.test(x.sci)) { pal.body = [80, 40, 50]; pal.belly = [28, 75, 55]; marks = { speckle: 1, earFlap: 1 }; }
        if (/cyanellus/.test(x.sci)) { pal.body = [150, 25, 40]; marks = { stripes: 1, earFlap: 1 }; p.depth = 0.85; }
        if (/Archoplites/.test(g)) { pal.body = [60, 15, 45]; marks = { bars: 1.2 }; }
      } else if (x.fam === 'Salmonidae') {
        if (/mykiss/.test(x.sci)) { pal.mark = [220, 10, 20]; marks = { spots: 1, stripe: 1 }; pal.stripe = [350, 50, 60]; }
        if (/gilae|apache/.test(x.sci)) { pal.body = [48, 50, 50]; marks = { spots: 1.2 }; }
        if (/clarkii|clarki/.test(x.sci)) { marks = { spots: 1, throat: 1 }; }
        if (/Salvelinus/.test(g)) { pal.body = [150, 20, 30]; pal.mark = [50, 60, 70]; marks = { spots: 1.2, finEdge: 1 }; }
        if (/Coregonus|Prosopium/.test(g)) { pal.body = [210, 12, 65]; marks = {}; parts.shape = 'minnow'; parts.tail = 'fork'; }
        if (/Oncorhynchus/.test(g) && /nerka/.test(x.sci)) { pal.body = [2, 60, 45]; pal.head = [120, 30, 30]; marks = {}; }
      } else if (x.fam === 'Percidae') {
        if (/Etheostoma|Percina|Ammocrypta|Crystallaria/.test(g)) { parts.shape = 'darter'; p.depth = 0.85; pal.body = [40, 30, 50]; marks = { bars: 1, spots: 0.4 }; if (/Ammocrypta/.test(g)) { pal.body = [45, 20, 75]; marks = { spots: 0.6 }; } if (x.h('dc') > 0.5) marks.finEdge = 1; }
        if (/flavescens/.test(x.sci)) { pal.body = [50, 70, 55]; marks = { bars: 1.2 }; }
        if (/Sander/.test(g)) { pal.body = [45, 30, 45]; marks = { mottle: 0.6 }; p.eye = 1.4; }
      } else if (x.fam === 'Cyprinidae' || x.fam === 'Leuciscidae') {
        if (/Gila/.test(g)) { parts.shape = /cypha|elegans/.test(x.sci) ? 'hump' : 'chub'; pal.body = [60, 15, 45]; }
        if (/Cyprinus|Carassius/.test(g)) { parts.shape = 'carp'; pal.body = [40, 45, 45]; marks = { scales: 1, barbels: /Cyprinus/.test(g) ? 1 : 0 }; }
        if (/Ptychocheilus/.test(g)) { parts.shape = 'pike'; pal.body = [100, 15, 50]; }
        if (/Notropis|Cyprinella|Pimephales|Rhinichthys|Lepidomeda|Meda|Plagopterus|Tiaroga/.test(g)) { p.depth = 0.85; marks = { stripe: /Notropis|Rhinichthys/.test(g) ? 1 : 0.4, spots: /Rhinichthys/.test(g) ? 0.8 : 0 }; }
        if (/Meda|Lepidomeda|Plagopterus/.test(g)) { pal.body = [45, 20, 70]; marks = { spines: 1 }; }
      } else if (x.fam === 'Ictaluridae') {
        if (/Noturus/.test(g)) { p.len = 0.8; pal.body = [30, 30, 40]; marks = { barbels: 1, saddles: 1 }; }
        if (/Satan|Trogloglanis|Prietella/.test(g)) { pal.body = [350, 25, 82]; marks = { barbels: 1, blind: 1 }; }
        if (/Ictalurus/.test(g) && /punctatus/.test(x.sci)) { pal.body = [210, 10, 55]; marks = { barbels: 1, spots: 0.8 }; parts.tail = 'fork'; }
        if (/Pylodictis/.test(g)) { pal.body = [40, 30, 42]; marks = { barbels: 1, mottle: 1 }; }
        if (/Ameiurus/.test(g)) { pal.body = [30, 25, 28]; }
      } else if (x.fam === 'Catostomidae') {
        if (/Xyrauchen/.test(g)) { parts.shape = 'hump'; pal.body = [40, 30, 35]; }
        if (/Ictiobus/.test(g)) { parts.shape = 'carp'; }
        if (/Moxostoma/.test(g)) { pal.fin = [5, 55, 50]; marks.finEdge = 1; }
      } else if (x.fam === 'Serranidae') {
        if (/itajara/.test(x.sci)) { p.depth = 1.2; pal.body = [40, 20, 35]; }
        if (/morio/.test(x.sci)) pal.body = [10, 35, 40];
        if (/bonaci|microlepis/.test(x.sci)) { pal.body = [210, 8, 35]; marks = { blotches: 1 }; }
        if (/interstitialis/.test(x.sci)) { pal.mark = [50, 70, 60]; marks = { spots: 1, finEdge: 1 }; }
      } else if (x.fam === 'Lutjanidae') {
        if (/synagris/.test(x.sci)) { pal.body = [0, 50, 65]; marks = { stripe: 1, spot: 1 }; }
        if (/analis/.test(x.sci)) { pal.body = [80, 25, 45]; marks = { spot: 1 }; }
        if (/Rhomboplites/.test(g)) { pal.body = [0, 65, 55]; marks = { stripes: 0.6 }; p.depth = 0.8; }
      } else if (x.fam === 'Cyprinodontidae' && x.h('pf') > 0.5) marks.finEdge = 1;
      const tw = base(x, 'fish', pal); tw.parts = parts; tw.p = p; tw.marks = marks; tw.pose = 'swim';
      nameColors(x, tw, { body: 'body', belly: 'belly', mark: 'mark', tail: 'fin', wing: 'fin', head: 'mark', back: 'body' });
      if (x.nm.pat.has('spots')) tw.marks.spots = Math.max(1, tw.marks.spots || 0);
      if (x.nm.pat.has('stripes')) tw.marks.stripe = 1;
      if (x.nm.pat.has('bands')) tw.marks.bars = 1;
      if (x.nm.pat.has('mottle')) tw.marks.mottle = 1;
      lengthWords(x, tw);
      props(x, tw, ['depth', 'fin', 'len'], 0.08); jitterColors(x, tw, 10, 6);
      return tw;
    },
  });

  // --- insects and other invertebrates ---
  const BUG_REGIONS = { body: 0.45, wing: 0.15, head: 0.1, mark: 0.3 };
  function invFinish(x, tw, map) {
    nameColors(x, tw, map || { body: ['body', 'wing'], wing: 'wing', head: 'head', mark: 'mark', leg: 'leg', back: 'body', belly: 'mark', tail: 'mark' });
    const pt = x.nm.pat;
    if (pt.has('spots')) tw.marks.spots = Math.max(1, tw.marks.spots || 0);
    if (pt.has('stripes')) tw.marks.stripes = Math.max(1, tw.marks.stripes || 0);
    if (pt.has('bands')) tw.marks.bands = Math.max(1, tw.marks.bands || 0);
    if (pt.has('mottle')) tw.marks.mottle = 1;
    if (pt.has('eyes')) tw.marks.eyespots = 1;
    if (pt.has('border')) tw.marks.border = 1;
    // Counted markings ("Sevenspotted", "Four-lined") where the template draws a count.
    if (x.nm.count && ['beetle', 'spider', 'butterfly'].includes(tw.tpl)) tw.marks.count = Math.min(13, x.nm.count);
    lengthWords(x, tw);
    if (x.nm.size > 0) tw.p.body = r1((tw.p.body || 1) * 1.15);
    if (x.nm.size < 0) tw.p.body = r1((tw.p.body || 1) * 0.88);
    props(x, tw, Object.keys(tw.p), 0.08);
    jitterColors(x, tw, 10, 6);
    return tw;
  }

  const BUTTERFLY_FAM = {
    Papilionidae: { shape: 'swallow', pal: { wing: [50, 75, 60], hind: [50, 75, 60], mark: [220, 10, 17] }, marks: { stripes: 1, border: 1, tails: 1 } },
    Pieridae: { shape: 'round', pal: { wing: [52, 70, 72], mark: [220, 10, 25] }, marks: { tipDark: 0.8, spots: 0.4 } },
    Nymphalidae: { shape: 'scallop', pal: { wing: [28, 75, 52], mark: [220, 10, 17] }, marks: { border: 1, spots: 0.6 } },
    Lycaenidae: { shape: 'small', pal: { wing: [215, 50, 62], mark: [220, 10, 25] }, marks: { border: 0.6, dots: 0.6 } },
    Hesperiidae: { shape: 'skipper', pal: { wing: [30, 45, 42], mark: [40, 30, 80] }, marks: { spots: 0.6 }, antenna: 'hook' },
    Riodinidae: { shape: 'small', pal: { wing: [25, 40, 40] }, marks: { dots: 1 } },
    Saturniidae: { shape: 'moth', pal: { wing: [25, 40, 50], mark: [220, 10, 18] }, marks: { eyespots: 1, bands: 0.6 }, antenna: 'feather' },
    Sphingidae: { shape: 'sphinx', pal: { wing: [30, 12, 48], mark: [340, 50, 60] }, marks: { stripes: 0.8, hindFlash: 1 }, antenna: 'thick' },
    Erebidae: { shape: 'moth', pal: { wing: [40, 20, 80], mark: [220, 10, 18] }, marks: { spots: 0.8 }, antenna: 'feather' },
    Noctuidae: { shape: 'moth', pal: { wing: [30, 20, 42], mark: [30, 20, 28] }, marks: { kidney: 1, bands: 0.5 }, antenna: 'thin' },
    Geometridae: { shape: 'broad', pal: { wing: [70, 20, 75], mark: [30, 20, 35] }, marks: { lines: 1 }, antenna: 'thin' },
    Crambidae: { shape: 'narrow', pal: { wing: [38, 25, 65] }, marks: { lines: 0.6 }, antenna: 'thin' },
    Lasiocampidae: { shape: 'moth', pal: { wing: [25, 40, 40] }, marks: { bands: 1 }, antenna: 'feather' },
    Megalopygidae: { shape: 'moth', pal: { wing: [38, 45, 70] }, marks: { fuzz: 1 }, antenna: 'feather' },
    Attevidae: { shape: 'narrow', pal: { wing: [25, 70, 50], mark: [48, 70, 70] }, marks: { spots: 1.2 }, antenna: 'thin' },
    Sesiidae: { shape: 'clear', pal: { wing: [40, 10, 90], mark: [220, 10, 17] }, marks: { bands: 1 }, antenna: 'thin' },
    Notodontidae: { shape: 'moth', pal: { wing: [30, 15, 45] }, marks: { bands: 0.6 }, antenna: 'feather' },
    Tortricidae: { shape: 'narrow', pal: { wing: [30, 30, 45] }, marks: { bands: 0.8 }, antenna: 'thin' },
    Zygaenidae: { shape: 'narrow', pal: { wing: [220, 12, 20], mark: [30, 70, 55] }, marks: { collar: 1 }, antenna: 'thin' },
  };
  const BUTTERFLY_GENUS = {
    Danaus: { pal: { wing: [26, 80, 50], mark: [220, 10, 15] }, marks: { veins: 1, border: 1, dots: 1 } },
    Vanessa: { pal: { wing: [22, 70, 55], mark: [220, 10, 17] }, marks: { tipDark: 1, spots: 1 } },
    Limenitis: { pal: { wing: [26, 70, 50], mark: [220, 10, 17] }, marks: { veins: 1, bands: 0.6 } },
    Speyeria: { pal: { wing: [28, 60, 50], mark: [220, 10, 20] }, marks: { spots: 1.3, checker: 1 } },
    Euptoieta: { pal: { wing: [30, 55, 55] }, marks: { checker: 1 } },
    Phyciodes: { pal: { wing: [25, 65, 50] }, marks: { checker: 1 } },
    Junonia: { pal: { wing: [30, 30, 38], mark: [15, 60, 50] }, marks: { eyespots: 1.3 } },
    Nymphalis: { pal: { wing: [15, 40, 25], mark: [48, 60, 75] }, marks: { border: 1.3 } },
    Polygonia: { pal: { wing: [22, 65, 48] }, marks: { spots: 1 } },
    Agraulis: { pal: { wing: [22, 80, 55] }, marks: { spots: 0.8 } },
    Heliconius: { pal: { wing: [220, 10, 17], mark: [52, 80, 65] }, marks: { stripes: 1 }, shape: 'long' },
    Asterocampa: { pal: { wing: [30, 45, 50] }, marks: { eyespots: 0.8 } },
    Cercyonis: { pal: { wing: [28, 30, 32] }, marks: { eyespots: 1 } },
    Megisto: { pal: { wing: [30, 30, 45] }, marks: { eyespots: 1 } },
    Papilio: { },
    Battus: { pal: { wing: [220, 25, 15], hind: [210, 40, 35], mark: [40, 10, 85] }, marks: { dots: 1, tails: 0.5 } },
    Eurytides: { pal: { wing: [40, 10, 90], mark: [220, 10, 17] }, marks: { stripes: 1.5, tails: 1.4 } },
    Colias: { pal: { wing: [42, 85, 58], mark: [220, 10, 20] }, marks: { border: 1, dots: 0.4 } },
    Zerene: { pal: { wing: [48, 80, 60], mark: [220, 10, 17] }, marks: { border: 1.4 } },
    Pieris: { pal: { wing: [45, 20, 92], mark: [220, 10, 25] }, marks: { tipDark: 1, dots: 0.6 } },
    Pontia: { pal: { wing: [45, 15, 92], mark: [220, 10, 25] }, marks: { checker: 1 } },
    Eurema: { pal: { wing: [30, 80, 58] }, marks: { border: 1 } },
    Nathalis: { pal: { wing: [52, 80, 65] }, marks: { border: 0.6 } },
    Phoebis: { pal: { wing: [52, 80, 62] }, marks: {} },
    Anthocharis: { pal: { wing: [45, 15, 92], mark: [25, 85, 55] }, marks: { tipColor: 1 } },
    Callophrys: { pal: { wing: [100, 40, 45] }, marks: { dots: 0.6 } },
    Strymon: { pal: { wing: [210, 8, 58], mark: [15, 70, 50] }, marks: { dots: 1, tails: 0.5 } },
    Lycaena: { pal: { wing: [22, 75, 55], mark: [220, 10, 20] }, marks: { dots: 1.2 } },
    Hyalophora: { pal: { wing: [15, 40, 35], mark: [40, 10, 90] }, marks: { bands: 1.2, eyespots: 0.8 } },
    Actias: { pal: { wing: [100, 45, 72], mark: [30, 60, 50] }, marks: { eyespots: 0.8, tails: 1.6 }, shape: 'swallow' },
    Antheraea: { pal: { wing: [30, 40, 52] }, marks: { eyespots: 1.5 } },
    Dryocampa: { pal: { wing: [340, 55, 72], mark: [50, 75, 65] }, marks: { bands: 1.4 } },
    Automeris: { pal: { wing: [45, 60, 55] }, marks: { eyespots: 1.4 } },
    Manduca: { pal: { wing: [210, 5, 45], mark: [48, 70, 60] }, marks: { stripes: 1, dots: 1 } },
    Hyles: { pal: { wing: [30, 30, 40], mark: [340, 60, 60] }, marks: { stripes: 1.3, hindFlash: 1 } },
    Hemaris: { shape: 'clear', pal: { wing: [40, 10, 88], body: [80, 40, 40], mark: [5, 50, 40] }, marks: { border: 1 } },
    Pachysphinx: { pal: { wing: [30, 25, 55] }, marks: { lines: 1 } },
    Smerinthus: { pal: { wing: [30, 20, 55], mark: [340, 50, 60] }, marks: { eyespots: 1, hindFlash: 1 } },
    Pyrrharctia: { pal: { wing: [38, 45, 62] }, marks: { dots: 0.6 } },
    Spilosoma: { pal: { wing: [40, 10, 92] }, marks: { dots: 0.8 } },
    Hyphantria: { pal: { wing: [40, 10, 94] }, marks: { dots: 0.4 } },
    Ctenucha: { pal: { wing: [210, 15, 30], body: [220, 50, 40], mark: [30, 80, 55] }, marks: { collar: 1 } },
    Hypoprepia: { pal: { wing: [20, 75, 55], mark: [220, 10, 25] }, marks: { stripes: 1.2 } },
    Lophocampa: { pal: { wing: [40, 30, 80], mark: [30, 40, 45] }, marks: { spots: 1.2 } },
    Apantesis: { pal: { wing: [220, 10, 17], mark: [45, 30, 88], hind: [15, 70, 55] }, marks: { stripes: 1.2, hindFlash: 1 } },
    Grammia: { pal: { wing: [220, 10, 17], mark: [45, 30, 88], hind: [50, 70, 60] }, marks: { stripes: 1.2, hindFlash: 1 } },
    Catocala: { pal: { wing: [30, 10, 45], hind: [5, 65, 50] }, marks: { hindFlash: 1, bands: 1 } },
    Noctua: { pal: { wing: [28, 30, 38], hind: [48, 80, 60] }, marks: { hindFlash: 1 } },
    Malacosoma: { pal: { wing: [30, 40, 45] }, marks: { bands: 1.3 } },
    Megalopyge: { },
    Epargyreus: { pal: { wing: [28, 30, 30], mark: [40, 20, 92] }, marks: { patch: 1 } },
    Erynnis: { pal: { wing: [25, 20, 25] }, marks: { speckle: 1 } },
    Pholisora: { pal: { wing: [220, 12, 17] }, marks: { dots: 0.4 } },
    Pyrgus: { pal: { wing: [210, 5, 30], mark: [40, 10, 92] }, marks: { checker: 1.4 } },
    Hesperia: { pal: { wing: [30, 55, 50] }, marks: { spots: 0.8 } },
    Poanes: { pal: { wing: [35, 60, 52] }, marks: { border: 0.8 } },
    Atalopedes: { pal: { wing: [28, 50, 48] }, marks: { patch: 0.8 } },
  };
  def('butterfly', {
    skeleton: 'butterfly', regions: { wing: 0.45, hind: 0.2, body: 0.05, mark: 0.3 }, nudge: { marks: ['spots', 'border', 'bands', 'eyespots', 'tipDark', 'veins', 'dots', 'checker'], parts: { shape: ['round', 'pointed', 'scallop'] }, p: ['wing', 'hind'] },
    derive(x) {
      const F = BUTTERFLY_FAM[x.fam] || { shape: 'moth', pal: { wing: [30, 25, 50] }, marks: {}, antenna: 'thin' };
      const G = BUTTERFLY_GENUS[x.genus] || {};
      const pal = Object.assign({ mark: [220, 10, 17] }, F.pal, G.pal);
      if (!pal.hind) pal.hind = pal.wing;
      if (!pal.body) pal.body = shade(pal.wing, -25);
      const tw = base(x, 'butterfly', pal);
      tw.parts = { shape: G.shape || F.shape, antenna: F.antenna || 'club' };
      tw.marks = Object.assign({}, F.marks, G.marks);
      if (x.genus === 'Vanessa' && /atalanta/.test(x.sci)) { tw.col.wing = [220, 10, 17]; tw.col.hind = [220, 10, 17]; tw.col.mark = [12, 75, 50]; tw.marks = { bands: 1.3, dots: 1 }; }
      if (x.genus === 'Vanessa' && /annabella|carye/.test(x.sci)) tw.marks.eyespots = 0.6;
      if (x.genus === 'Papilio') {
        if (/polyxenes/.test(x.sci)) { tw.col.wing = [220, 10, 17]; tw.col.hind = [220, 10, 17]; tw.col.mark = [50, 75, 62]; tw.marks = { dots: 1.3, tails: 1, border: 0 }; }
        if (/zelicaon/.test(x.sci)) { tw.marks = { bands: 1.3, border: 1, tails: 1 }; }
        if (/multicaudata/.test(x.sci)) tw.marks.tails = 1.5;
        if (/cresphontes/.test(x.sci)) { tw.col.wing = [30, 30, 20]; tw.col.hind = tw.col.wing; tw.col.mark = [50, 75, 60]; tw.marks = { bands: 1.3, tails: 1 }; }
        if (/troilus/.test(x.sci)) { tw.col.wing = [220, 15, 18]; tw.col.hind = [200, 45, 45]; tw.marks = { dots: 1, tails: 1 }; }
      }
      tw.p = { wing: 1, hind: 1, body: 1 };
      if (tw.parts.shape === 'small' || tw.parts.shape === 'skipper') tw.p.wing = 0.85;
      tw.pose = 'open';
      const tw2 = invFinish(x, tw, { body: ['wing', 'hind'], wing: ['wing', 'hind'], mark: 'mark', head: 'body', tail: 'hind', belly: 'body', back: 'wing', leg: 'body' });
      if (x.has(/swallowtail/) && !tw2.marks.tails) tw2.marks.tails = 1;
      return tw2;
    },
  });

  def('dragonfly', {
    skeleton: 'dragonfly', regions: { body: 0.45, wing: 0.15, eye: 0.1, mark: 0.3 }, nudge: { marks: ['rings', 'wingSpots', 'wingBands', 'tipDark', 'stripe', 'pruinose'], parts: { tip: ['plain', 'club'] }, p: ['abdomen', 'wing'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      const damsel = ['Coenagrionidae', 'Calopterygidae', 'Lestidae', 'Platycnemididae'].includes(f);
      let pal = { body: [200, 50, 50], wing: [200, 20, 90], eye: [200, 50, 45], mark: [220, 10, 17] }, marks = { rings: 0.6 }, tip = 'plain', p = { abdomen: damsel ? 1.15 : 1, wing: 1 };
      if (f === 'Aeshnidae') { pal = { body: [210, 50, 50], eye: [200, 55, 50], mark: [120, 40, 45], wing: [45, 20, 90] }; marks = { rings: 1, stripe: 1 }; p.abdomen = 1.2; if (/junius/.test(x.sci)) { pal.body = [110, 50, 45]; pal.mark = [210, 50, 50]; } }
      else if (f === 'Libellulidae') {
        pal = { body: [30, 30, 45], wing: [40, 15, 92], eye: [15, 40, 35], mark: [220, 10, 20] }; marks = { stripe: 0.6 }; p.abdomen = 0.9;
        if (/Libellula|Plathemis/.test(g)) { marks = { wingSpots: 1, pruinose: /lydia|pulchella|forensis|luctuosa/.test(x.sci) ? 1 : 0 }; p.abdomen = 0.85; if (/pulchella/.test(x.sci)) marks.wingSpots = 1.5; if (/quadrimaculata/.test(x.sci)) marks.wingSpots = 1.2; if (/saturata/.test(x.sci)) { pal.body = [10, 70, 50]; pal.wing = [20, 60, 70]; } }
        if (/Sympetrum/.test(g)) { pal.body = [8, 65, 48]; pal.eye = [8, 50, 40]; marks = { rings: 0.4 }; p.abdomen = 0.8; }
        if (/Pachydiplax/.test(g)) { pal.body = [205, 45, 60]; pal.eye = [150, 50, 45]; marks = { tipDark: 1 }; }
        if (/Erythemis/.test(g)) { pal.body = [100, 50, 45]; marks = { rings: 0.8 }; }
        if (/Pantala|Tramea/.test(g)) { pal.body = [35, 70, 55]; marks = { wingBands: /Tramea/.test(g) ? 1 : 0 }; }
        if (/Ladona/.test(g)) { pal.body = [210, 10, 72]; pal.mark = [220, 10, 17]; marks = { tipDark: 1 }; }
        if (/Celithemis/.test(g)) { pal.body = [15, 60, 50]; pal.wing = [30, 60, 70]; marks = { wingBands: 1 }; }
        if (/Perithemis/.test(g)) { pal.body = [30, 50, 45]; pal.wing = [30, 75, 65]; p.abdomen = 0.65; }
      } else if (f === 'Gomphidae') { pal = { body: [60, 50, 55], eye: [150, 40, 45], mark: [220, 10, 18], wing: [40, 10, 92] }; marks = { stripe: 1.2, rings: 0.8 }; tip = 'club'; if (/Ophiogomphus/.test(g)) pal.body = [110, 45, 48]; }
      else if (f === 'Corduliidae' || f === 'Macromiidae') { pal = { body: [150, 40, 25], eye: [140, 60, 45], wing: [40, 15, 90], mark: [48, 60, 60] }; marks = { rings: 0.4 }; tip = /Epitheca|Somatochlora/.test(g) ? 'plain' : 'club'; if (/Epitheca/.test(g)) marks.wingSpots = 0.6; }
      else if (f === 'Cordulegastridae') { pal = { body: [220, 10, 17], eye: [150, 50, 45], mark: [50, 80, 60] }; marks = { rings: 1.4 }; p.abdomen = 1.3; }
      else if (f === 'Petaluridae') { pal = { body: [220, 10, 20], mark: [45, 60, 60] }; marks = { spots: 1 }; }
      else if (f === 'Calopterygidae') { pal = { body: [150, 60, 30], wing: [220, 15, 20], eye: [220, 10, 17] }; marks = {}; if (/Hetaerina/.test(g)) { pal.body = [5, 55, 35]; pal.wing = [40, 15, 90]; marks.wingBase = 1; pal.mark = [5, 70, 48]; } }
      else if (f === 'Coenagrionidae') {
        pal = { body: [205, 60, 58], wing: [200, 10, 92], eye: [205, 60, 55], mark: [220, 10, 17] }; marks = { rings: 1 };
        if (/Argia/.test(g)) { pal.body = /vivida|plana|moesta|sedula|fumipennis|immunda|apicalis|translata/.test(x.sci) ? [210, 60, 58] : [270, 40, 55]; marks = { rings: 0.8, stripe: 0.5 }; }
        if (/Ischnura/.test(g)) { pal.body = [110, 50, 45]; marks = { tipBlue: 1, rings: 0.4 }; }
        if (/Telebasis|Amphiagrion/.test(g)) { pal.body = [5, 70, 48]; marks = { rings: 0.2 }; }
        if (/Enallagma/.test(g)) marks.rings = 1.2;
        if (/Nehalennia/.test(g)) { pal.body = [150, 50, 30]; p.abdomen = 0.9; marks = {}; }
      } else if (f === 'Lestidae') { pal = { body: [150, 35, 35], wing: [40, 10, 92], eye: [200, 50, 55] }; marks = { pruinose: 0.5 }; }
      const tw = base(x, 'dragonfly', pal); tw.parts = { kind: damsel ? 'damsel' : 'dragon', tip }; tw.p = p; tw.marks = marks; tw.pose = 'top';
      return invFinish(x, tw, { body: 'body', wing: 'wing', head: 'eye', mark: 'mark', back: 'body', tail: 'mark', belly: 'mark', leg: 'mark' });
    },
  });

  def('bee', {
    skeleton: 'hymen', regions: { body: 0.4, band: 0.25, wing: 0.05, mark: 0.3 }, nudge: { marks: ['bands', 'tail', 'face', 'thoraxBand', 'spots', 'metal'], parts: { kind: ['bumble', 'honey', 'sweat'] }, p: ['fuzz', 'abdomen'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      let kind = 'honey', pal = { body: [35, 40, 30], band: [45, 75, 55], wing: [200, 20, 88], mark: [220, 10, 17] }, marks = { bands: 1 }, p = { fuzz: 1, abdomen: 1, body: 1 };
      if (x.e.taxon === 'wasp') {
        kind = 'wasp'; pal = { body: [220, 10, 17], band: [50, 85, 55], wing: [30, 30, 75], mark: [220, 10, 17] }; marks = { bands: 1.2 }; p.fuzz = 0.2;
        if (f === 'Vespidae' && /Dolichovespula maculata/.test(x.sci)) { pal.band = [40, 10, 92]; marks = { face: 1, bands: 0.5 }; }
        if (/Polistes|Mischocyttarus/.test(g) || /paper/.test(x.name)) { kind = 'paper'; pal.body = [20, 55, 38]; pal.band = [50, 80, 55]; marks = { bands: 0.6 }; }
        if (f === 'Mutillidae') { kind = 'velvet'; pal = { body: [220, 10, 17], band: [5, 75, 50], wing: [0, 0, 100], mark: [220, 10, 17] }; marks = { thoraxBand: 1 }; p.fuzz = 1.2; }
        if (f === 'Cynipidae') { kind = 'gall'; pal.body = [15, 50, 35]; marks = {}; p.body = 0.7; }
        if (f === 'Crabronidae' || f === 'Sphecidae') { kind = 'thread'; pal.body = [220, 10, 17]; pal.band = [15, 70, 50]; marks = { bands: 0.5 }; }
        if (f === 'Eumenidae' && /Red bee/i.test(x.name)) { pal.body = [10, 60, 40]; }
      } else if (/Bombus/.test(g)) {
        kind = 'bumble'; pal = { body: [220, 10, 17], band: [48, 80, 58], wing: [30, 20, 60], mark: [220, 10, 17] }; p = { fuzz: 1.5, abdomen: 1.1, body: 1.2 };
        // Bumblebee colour bands (thorax, abdomen, tail) vary by species: a stable pattern from the key.
        const pats = ['yellow-front', 'yellow-rear', 'belted', 'red-tail', 'white-tail', 'mostly-yellow', 'mostly-black'];
        const pat = /pensylvanicus|californicus|fervidus|auricomus/.test(x.sci) ? 'mostly-yellow' : /affinis/.test(x.sci) ? 'belted' : /occidentalis|terricola/.test(x.sci) ? 'white-tail' : /huntii|ternarius|rufocinctus|sylvicola/.test(x.sci) ? 'red-tail' : x.pick('bpat', pats);
        marks = { bumble: pats.indexOf(pat) + 1 };
        if (pat === 'red-tail') pal.mark = [18, 70, 50];
        if (pat === 'white-tail') pal.mark = [40, 10, 92];
      } else if (/Apis/.test(g)) { kind = 'honey'; pal = { body: [30, 45, 32], band: [38, 75, 52], wing: [200, 15, 88], mark: [220, 10, 17] }; marks = { bands: 1.2 }; }
      else if (/Xylocopa/.test(g)) { kind = 'carpenter'; pal = { body: [220, 12, 16], band: [48, 70, 58] }; marks = { thoraxBand: 1 }; p = { fuzz: 1, abdomen: 1.1, body: 1.3 }; }
      else if (f === 'Halictidae') { kind = 'sweat'; pal = { body: /Agapostemon|Augochlor/.test(g) ? [140, 55, 42] : [220, 10, 20], band: [45, 50, 70], wing: [200, 15, 88], mark: [220, 10, 17] }; marks = { metal: /Agapostemon|Augochlor/.test(g) ? 1 : 0, bands: 0.6 }; p = { fuzz: 0.4, abdomen: 0.9, body: 0.7 }; if (/Agapostemon/.test(g)) { marks.bands = 1; pal.band = [52, 80, 58]; } }
      else if (f === 'Andrenidae') { kind = 'mining'; pal = { body: [30, 30, 25], band: [35, 30, 70] }; marks = { bands: 0.7 }; p = { fuzz: 0.8, abdomen: 1, body: 0.85 }; }
      else if (f === 'Colletidae') { kind = 'sweat'; pal = { body: [220, 10, 18], band: [40, 20, 88] }; marks = { bands: 1 }; p = { fuzz: 0.5, abdomen: 1, body: 0.8 }; }
      else if (f === 'Megachilidae') { kind = 'mason'; pal = { body: /Osmia/.test(g) ? [220, 55, 35] : [220, 10, 20], band: [40, 10, 85] }; marks = { metal: /Osmia/.test(g) ? 1 : 0, bands: /Megachile|Anthidium/.test(g) ? 1 : 0.2 }; }
      else if (f === 'Apidae') { kind = /Melissodes|Eucera|Svastra|Anthophora|Habropoda/.test(g) ? 'longhorn' : /Nomada|Triepeolus|Epeolus/.test(g) ? 'cuckoo' : 'honey'; if (kind === 'cuckoo') { pal.body = [10, 55, 40]; pal.band = [50, 75, 60]; p.fuzz = 0.2; marks = { spots: 1 }; } if (kind === 'longhorn') { pal.band = [40, 25, 80]; marks = { bands: 1 }; p.fuzz = 1.2; } }
      const tw = base(x, 'bee', pal); tw.parts = { kind }; tw.p = p; tw.marks = marks; tw.pose = 'side';
      return invFinish(x, tw, { body: 'body', wing: 'wing', mark: 'mark', head: 'body', tail: 'mark', belly: 'band', back: 'body', leg: 'mark' });
    },
  });

  def('ant', {
    skeleton: 'hymen', regions: { body: 0.45, gaster: 0.35, head: 0.1, mark: 0.1 }, nudge: { marks: ['bands', 'hairs', 'shine', 'spots'], parts: { kind: ['ant', 'bighead', 'longleg'] }, p: ['head', 'abdomen', 'leg'] },
    derive(x) {
      const g = x.genus;
      let pal = { body: [15, 45, 30], gaster: [15, 45, 30], head: [15, 45, 30], mark: [40, 30, 80] }, kind = 'ant', marks = {}, p = { head: 1, abdomen: 1, leg: 1, body: 1 };
      const two = x.h('tone');
      if (/Camponotus/.test(g)) { pal = { body: [220, 10, 17], gaster: [220, 10, 17], head: [220, 10, 17] }; p.body = 1.3; if (two > 0.5) pal.body = [12, 50, 35]; }
      else if (/Pogonomyrmex|Solenopsis|Myrmica/.test(g)) { pal = { body: [10, 60, 40], gaster: /Solenopsis/.test(g) ? [15, 30, 22] : [10, 60, 40], head: [10, 60, 40] }; kind = /Pogonomyrmex/.test(g) ? 'bighead' : 'ant'; marks.hairs = /Pogonomyrmex/.test(g) ? 1 : 0; }
      else if (/Formica/.test(g)) { pal = { body: /rufa|obscuripes|integra|sanguinea|pallidefulva/.test(x.sci) ? [15, 55, 42] : [220, 10, 20], gaster: [220, 10, 18], head: [15, 50, 38] }; p.leg = 1.1; }
      else if (/Pheidole|Cephalotes|Colobopsis/.test(g)) { kind = 'bighead'; pal = { body: [25, 45, 42], gaster: [25, 30, 30], head: [25, 45, 42] }; p.head = 1.4; }
      else if (/Crematogaster/.test(g)) { pal = { body: [15, 50, 38], gaster: [220, 10, 17], head: [15, 50, 38] }; marks.heart = 1; }
      else if (/Paratrechina|Nylanderia|Prenolepis|Brachymyrmex|Tapinoma|Lasius|Liometopum|Dorymyrmex|Forelius|Myrmecocystus/.test(g)) { kind = 'longleg'; pal = { body: /Myrmecocystus|Prenolepis/.test(g) ? [35, 45, 55] : [25, 25, 30], gaster: /Myrmecocystus|Prenolepis/.test(g) ? [38, 60, 62] : [25, 20, 25], head: [25, 25, 30] }; p.leg = 1.25; if (/Myrmecocystus|Prenolepis/.test(g)) p.abdomen = 1.6; if (/Liometopum/.test(g)) marks.shine = 1; }
      else if (/Polyergus|Atta|Acromyrmex|Trachymyrmex|Novomessor|Aphaenogaster|Neivamyrmex|Labidus/.test(g)) { pal = { body: [15, 55, 42], gaster: [15, 55, 38], head: [15, 55, 42] }; kind = /Atta|Acromyrmex|Trachymyrmex/.test(g) ? 'spiny' : 'ant'; p.leg = /Novomessor|Aphaenogaster/.test(g) ? 1.3 : 1; }
      else { if (two < 0.33) pal = { body: [220, 10, 18], gaster: [220, 10, 18], head: [220, 10, 18] }; else if (two < 0.66) pal = { body: [30, 45, 50], gaster: [30, 35, 35], head: [30, 45, 50] }; }
      if (x.has(/velvety|hairy/)) marks.hairs = 1;
      const tw = base(x, 'ant', Object.assign({ mark: [40, 30, 80] }, pal)); tw.parts = { kind }; tw.p = p; tw.marks = marks; tw.pose = 'side';
      return invFinish(x, tw, { body: ['body', 'head', 'gaster'], head: 'head', mark: 'mark', belly: 'gaster', tail: 'gaster', back: 'body', wing: 'mark', leg: 'mark' });
    },
  });

  const BEETLE_FAM = {
    Coccinellidae: { shape: 'round', pal: { body: [5, 70, 50], head: [220, 10, 17], mark: [220, 10, 17] }, marks: { spots: 1 }, antenna: 'short' },
    Carabidae: { shape: 'ground', pal: { body: [220, 12, 18], head: [220, 12, 18] }, marks: { ridges: 1 }, antenna: 'long' },
    Cerambycidae: { shape: 'long', pal: { body: [220, 10, 20], head: [220, 10, 20], mark: [40, 10, 90] }, marks: { spots: 0.6 }, antenna: 'huge' },
    Chrysomelidae: { shape: 'oval', pal: { body: [55, 70, 58], head: [220, 10, 17], mark: [220, 10, 17] }, marks: { spots: 0.8 }, antenna: 'thin' },
    Cleridae: { shape: 'long', pal: { body: [5, 55, 45], head: [210, 50, 35], mark: [220, 10, 17] }, marks: { bands: 1 }, antenna: 'club' },
    Curculionidae: { shape: 'weevil', pal: { body: [110, 50, 45], head: [110, 50, 45] }, marks: { scales: 1 }, antenna: 'elbow' },
    Elmidae: { shape: 'oval', pal: { body: [30, 20, 22], head: [30, 20, 22] }, marks: {}, antenna: 'thin' },
    Lampyridae: { shape: 'soft', pal: { body: [30, 20, 22], head: [5, 60, 55], mark: [52, 80, 65] }, marks: { lantern: 1, shieldEdge: 1 }, antenna: 'thin' },
    Scarabaeidae: { shape: 'scarab', pal: { body: [30, 45, 32], head: [30, 45, 30] }, marks: {}, antenna: 'fan' },
    Staphylinidae: { shape: 'rove', pal: { body: [220, 10, 17], head: [220, 10, 17], mark: [22, 75, 55] }, marks: { bands: 1 }, antenna: 'club' },
    Silphidae: { shape: 'flat', pal: { body: [220, 10, 17], head: [220, 10, 17], mark: [22, 75, 55] }, marks: { bands: 1 }, antenna: 'club' },
    Tenebrionidae: { shape: 'dome', pal: { body: [220, 10, 17], head: [220, 10, 17] }, marks: { ridges: 0.6 }, antenna: 'thin' },
    Cantharidae: { shape: 'soft', pal: { body: [220, 10, 20], head: [30, 75, 55], mark: [30, 75, 55] }, marks: { tip: 1 }, antenna: 'thin' },
    Buprestidae: { shape: 'bullet', pal: { body: [140, 55, 35], head: [140, 55, 35] }, marks: { metal: 1 }, antenna: 'short' },
    Lucanidae: { shape: 'stag', pal: { body: [15, 45, 25], head: [15, 45, 22] }, marks: {}, antenna: 'elbow' },
    Meloidae: { shape: 'soft', pal: { body: [220, 30, 20], head: [220, 30, 20] }, marks: {}, antenna: 'thin' },
    Dytiscidae: { shape: 'oval', pal: { body: [80, 20, 22], head: [80, 20, 22], mark: [50, 60, 60] }, marks: { shieldEdge: 1 }, antenna: 'thin' },
    Histeridae: { shape: 'round', pal: { body: [220, 10, 15], head: [220, 10, 15] }, marks: { shine: 1 }, antenna: 'club' },
    Elateridae: { shape: 'bullet', pal: { body: [25, 30, 30], head: [25, 30, 30] }, marks: {}, antenna: 'saw' },
  };
  def('beetle', {
    skeleton: 'beetle', regions: { body: 0.45, head: 0.15, mark: 0.3, leg: 0.1 }, nudge: { marks: ['spots', 'bands', 'stripes', 'shieldEdge', 'tip', 'ridges', 'metal'], parts: { antenna: ['short', 'long', 'club'] }, p: ['dome', 'len', 'antenna'] },
    derive(x) {
      const F = BEETLE_FAM[x.fam] || { shape: 'oval', pal: { body: [25, 30, 28], head: [25, 30, 25] }, marks: {}, antenna: 'thin' };
      const g = x.genus;
      const pal = Object.assign({ mark: [220, 10, 17], leg: [220, 10, 17] }, F.pal);
      let parts = { shape: F.shape, antenna: F.antenna }, marks = Object.assign({}, F.marks), p = { dome: 1, len: 1, antenna: 1, leg: 1, body: 1 };
      if (x.fam === 'Carabidae' && /Cicindel|Cicindela|Cylindera|Habroscelimorpha|Ellipsoptera|Omus|Tetracha|Amblycheila|Eunota/.test(g + x.name)) { parts.shape = 'tiger'; pal.body = [140, 45, 35]; marks = { spots: 0.8 }; p.leg = 1.4; if (/tiger/.test(x.name) && x.h('tc') > 0.5) pal.body = [25, 35, 35]; }
      if (x.fam === 'Coccinellidae') {
        if (/septempunctata/.test(x.sci)) marks.spots = 1.2;
        if (/axyridis/.test(x.sci)) { pal.body = [25, 75, 52]; marks.spots = 1.1; }
        if (/convergens/.test(x.sci)) { marks.spots = 1; pal.head = [220, 10, 17]; marks.shieldEdge = 1; }
        if (/Olla/.test(g)) { pal.body = [210, 6, 70]; marks.spots = 1; }
        if (/Coleomegilla/.test(g)) { pal.body = [350, 55, 62]; marks.spots = 1.3; }
      }
      if (x.fam === 'Cerambycidae') { if (/Tetraopes/.test(g)) { pal.body = [5, 70, 50]; pal.head = [5, 70, 50]; marks = { spots: 0.8 }; parts.antenna = 'long'; } if (/Rosalia/.test(g)) { pal.body = [205, 40, 65]; marks = { bands: 1 }; } if (/Monochamus/.test(g)) { marks = { spots: 0.5 }; } }
      if (x.fam === 'Lampyridae') { if (x.h('lf') > 0.5) marks.stripes = 0.6; p.len = x.jit('lfl', 0.15); }
      if (x.fam === 'Scarabaeidae') { if (/Popillia/.test(g)) { pal.body = [25, 50, 45]; pal.head = [150, 55, 35]; marks = { metal: 1, spots: 0.4 }; } if (/Pleocoma|Polyphylla/.test(g)) { marks = { stripes: 1 }; pal.body = [30, 35, 38]; } if (/Cotinis|Euphoria|Trichiotinus/.test(g)) { pal.body = /Cotinis/.test(g) ? [130, 50, 38] : [35, 45, 40]; marks = { speckle: 1 }; } }
      if (x.fam === 'Staphylinidae' && /Nicrophorus/.test(g)) { parts.shape = 'flat'; marks = { bands: 1.2 }; }
      if (x.fam === 'Staphylinidae' && /Necrophila|Necrodes|Thanatophilus/.test(g)) { parts.shape = 'flat'; pal.head = [48, 60, 60]; marks = { ridges: 1 }; }
      const tw = base(x, 'beetle', pal); tw.parts = parts; tw.p = p; tw.marks = marks; tw.pose = 'side';
      return invFinish(x, tw);
    },
  });

  def('bug', {
    skeleton: 'bug', regions: BUG_REGIONS, nudge: { marks: ['bands', 'spots', 'xmark', 'edge', 'stripes'], parts: {}, p: ['len', 'leg', 'antenna'] },
    derive(x) {
      const f = x.fam;
      let kind = 'shield', pal = { body: [100, 40, 40], wing: [100, 30, 45], head: [100, 40, 40], mark: [220, 10, 17] }, marks = {}, p = { len: 1, leg: 1, antenna: 1, body: 1 };
      if (f === 'Pentatomidae' || f === 'Scutelleridae') { kind = 'shield'; pal = { body: /Halyomorpha/.test(x.genus) ? [28, 30, 38] : [110, 45, 40], wing: [30, 30, 35], head: [30, 30, 38], mark: [45, 30, 75] }; marks = { speckle: 1 }; }
      else if (f === 'Lygaeidae' || f === 'Pyrrhocoridae' || f === 'Rhopalidae') { kind = 'long'; pal = { body: [15, 75, 50], wing: [220, 10, 17], head: [220, 10, 17], mark: [220, 10, 17] }; marks = { xmark: 1 }; if (f === 'Rhopalidae') { pal.body = [220, 10, 20]; pal.mark = [5, 70, 50]; marks = { edge: 1 }; } }
      else if (f === 'Coreidae') { kind = 'leaffoot'; pal = { body: [25, 40, 32], wing: [25, 35, 30], head: [25, 40, 32], mark: [45, 40, 75] }; marks = { band: 1 }; }
      else if (f === 'Reduviidae') { kind = 'assassin'; pal = { body: /Zelus/.test(x.genus) ? [80, 45, 55] : [30, 35, 35], wing: [30, 30, 40], head: [30, 35, 35], mark: [40, 20, 85] }; p.leg = 1.3; if (/Apiomerus/.test(x.genus)) { pal.body = [220, 10, 18]; pal.mark = [5, 70, 50]; marks = { edge: 1 }; } }
      else if (f === 'Cicadidae') { kind = 'cicada'; pal = { body: [120, 25, 25], wing: [200, 15, 88], head: [110, 30, 35], mark: [30, 70, 50] }; marks = { veins: 1 }; if (/Magicicada/.test(x.genus)) { pal.body = [220, 10, 17]; pal.head = [220, 10, 17]; pal.mark = [15, 75, 52]; pal.eye = [5, 70, 48]; marks = { veins: 1, redEye: 1 }; } }
      else if (f === 'Aphididae') { kind = 'aphid'; pal = { body: /nerii/.test(x.sci) ? [45, 85, 58] : [100, 50, 55], wing: [0, 0, 100], head: [100, 50, 55], mark: [220, 10, 17] }; p.body = 0.6; }
      else if (f === 'Aphrophoridae' || f === 'Cercopidae' || f === 'Cicadellidae' || f === 'Membracidae') { kind = 'hopper'; pal = { body: [35, 30, 45], wing: [35, 30, 45], head: [35, 30, 45], mark: [30, 30, 25] }; marks = { bands: 0.5 }; }
      else if (f === 'Gerridae') { kind = 'strider'; pal = { body: [220, 10, 20], wing: [220, 10, 20], head: [220, 10, 20] }; p.leg = 1.6; }
      else if (f === 'Mantidae' || f === 'Mantidae' || f === 'Mantodea') { kind = 'mantis'; pal = { body: /Stagmomantis|Mantis/.test(x.genus) ? [95, 45, 50] : [35, 30, 55], wing: [95, 35, 55], head: [95, 45, 50] }; }
      else if (f === 'Pseudophasmatidae' || f === 'Diapheromeridae' || f === 'Phasmatidae') { kind = 'stick'; pal = { body: [35, 35, 40], wing: [35, 35, 40], head: [35, 35, 40], mark: [48, 70, 60] }; marks = { stripes: 1 }; }
      else if (f === 'Corydalidae' || f === 'Sialidae') { kind = 'fishfly'; pal = { body: [30, 30, 30], wing: [40, 15, 70], head: [30, 30, 28], mark: [220, 10, 25] }; marks = { veins: 1 }; }
      else if (f === 'Myrmeleontidae' || f === 'Chrysopidae') { kind = 'lacewing'; pal = { body: f === 'Chrysopidae' ? [100, 55, 50] : [30, 20, 30], wing: [200, 10, 92], head: [30, 20, 30] }; marks = { veins: 1 }; }
      else if (f === 'Grylloblattidae') { kind = 'icecrawler'; pal = { body: [35, 30, 60], wing: [35, 30, 60], head: [35, 30, 55] }; }
      else if (f === 'Belostomatidae' || f === 'Nepidae' || f === 'Notonectidae' || f === 'Corixidae') { kind = 'waterbug'; pal = { body: [30, 30, 35], wing: [30, 30, 35], head: [30, 30, 35] }; }
      const tw = base(x, 'bug', pal); tw.parts = { kind }; tw.p = p; tw.marks = marks; tw.pose = 'side';
      return invFinish(x, tw);
    },
  });

  def('grasshopper', {
    skeleton: 'hopper', regions: { body: 0.45, wing: 0.2, head: 0.05, mark: 0.3 }, nudge: { marks: ['bands', 'stripes', 'spots', 'hindFlash', 'legBars'], parts: {}, p: ['antenna', 'leg', 'len'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      let kind = 'hopper', pal = { body: [60, 35, 45], wing: [50, 30, 45], head: [60, 35, 45], mark: [30, 30, 25] }, marks = { legBars: 0.6 }, p = { antenna: 1, leg: 1, len: 1, body: 1 };
      if (f === 'Acrididae') { if (/band-winged|Arphia|Dissosteira|Trimerotropis|Hadrotettix|Spharagemon|Circotettix|Derotmema|pallid-winged/i.test(g + ' ' + x.name)) { pal.body = [35, 25, 55]; pal.wing = /Arphia|Hadrotettix/.test(g) ? [5, 70, 50] : [50, 70, 60]; marks = { hindFlash: 1, speckle: 1, bands: 0.8 }; } if (/Melanoplus/.test(g)) { pal.body = [45, 40, 45]; marks = { stripes: 0.6, legBars: 1 }; } if (/Schistocerca/.test(g)) { pal.body = [45, 50, 50]; marks = { stripes: 1 }; p.len = 1.2; } }
      else if (f === 'Romaleidae') { kind = 'lubber'; pal = { body: [48, 70, 55], wing: [5, 60, 50], head: [48, 70, 55], mark: [220, 10, 17] }; marks = { bands: 1 }; p.body = 1.4; }
      else if (f === 'Tettigoniidae') { kind = 'katydid'; pal = { body: [100, 45, 45], wing: [100, 40, 45], head: [100, 45, 45] }; p.antenna = 1.8; if (/shieldback|Neduba|Idiostatus|Aglaothorax|Atlanticus|Decticita/i.test(x.name + g)) { kind = 'shieldback'; pal.body = [30, 25, 40]; } }
      else if (f === 'Gryllidae') { kind = 'cricket'; pal = { body: /Oecanthus/.test(g) ? [80, 40, 70] : [220, 10, 18], wing: /Oecanthus/.test(g) ? [80, 30, 85] : [25, 30, 25], head: /Oecanthus/.test(g) ? [80, 40, 70] : [220, 10, 18] }; p.antenna = 1.6; if (/Oecanthus/.test(g)) p.body = 0.8; }
      else if (f === 'Rhaphidophoridae') { kind = 'camel'; pal = { body: [30, 30, 45], wing: [30, 30, 45], head: [30, 30, 45], mark: [30, 25, 30] }; marks = { bands: 1 }; p.antenna = 2; p.leg = 1.4; }
      else if (f === 'Stenopelmatidae') { kind = 'jerusalem'; pal = { body: [30, 45, 50], wing: [30, 45, 50], head: [28, 55, 55], mark: [220, 10, 20] }; marks = { bands: 1.2 }; }
      else if (f === 'Tetrigidae') { kind = 'pygmy'; pal = { body: [30, 20, 35] }; p.body = 0.7; }
      else if (f === 'Eumastacidae') { kind = 'monkey'; pal = { body: [48, 60, 55], wing: [48, 60, 55], head: [48, 60, 55], mark: [220, 10, 17] }; marks = { stripes: 1 }; }
      else if (f === 'Tridactylidae') { kind = 'pygmy'; pal = { body: [220, 10, 20] }; }
      const tw = base(x, 'grasshopper', pal); tw.parts = { kind }; tw.p = p; tw.marks = marks; tw.pose = 'side';
      if (!tw.col.wing) tw.col.wing = tw.col.body; if (!tw.col.head) tw.col.head = tw.col.body;
      return invFinish(x, tw);
    },
  });

  def('fly', {
    skeleton: 'fly', regions: { body: 0.45, wing: 0.1, eye: 0.15, mark: 0.3 }, nudge: { marks: ['bands', 'stripes', 'spots', 'wingSpot'], parts: { kind: ['house', 'hover'] }, p: ['len', 'wing'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      let kind = 'house', pal = { body: [210, 5, 35], wing: [200, 15, 88], eye: [5, 55, 40], mark: [220, 10, 17] }, marks = { stripes: 0.6 }, p = { len: 1, wing: 1, body: 1, leg: 1 };
      if (f === 'Syrphidae') { kind = 'hover'; pal = { body: [220, 10, 17], wing: [200, 15, 90], eye: [20, 55, 35], mark: [50, 80, 58] }; marks = { bands: 1 }; if (/Eristalis/.test(g)) { kind = 'drone'; pal.body = [30, 40, 30]; pal.mark = [35, 60, 50]; marks = { bands: 0.6 }; } if (/Toxomerus/.test(g)) { marks = { bands: 1, stripes: 0.6 }; p.body = 0.8; } if (/Allograpta|Syrphus|Eupeodes/.test(g)) marks = { bands: 1.2 }; if (/Lejops|Helophilus/.test(g)) marks = { stripes: 1, bands: 0.8 }; }
      else if (f === 'Bibionidae') { kind = 'lovebug'; pal = { body: [220, 10, 17], wing: [220, 10, 30], eye: [220, 10, 17], mark: [5, 70, 50] }; marks = { thorax: 1 }; }
      else if (f === 'Tipulidae') { kind = 'crane'; pal.body = [35, 30, 50]; p.leg = 2; }
      else if (f === 'Culicidae') { kind = 'mosquito'; pal.body = [30, 15, 30]; marks = { bands: 1 }; }
      else if (f === 'Bombyliidae') { kind = 'beefly'; pal.body = [35, 50, 55]; pal.wing = [30, 30, 40]; marks = { fuzz: 1 }; }
      else if (f === 'Asilidae') { kind = 'robber'; pal.body = [35, 25, 35]; p.len = 1.3; }
      else if (f === 'Tabanidae') { kind = 'horse'; pal.body = [30, 20, 30]; pal.eye = [120, 50, 40]; }
      else if (f === 'Calliphoridae') { pal.body = [150, 60, 35]; marks = { metal: 1 }; }
      else if (f === 'Tachinidae') { pal.body = [30, 15, 25]; marks = { bristles: 1 }; }
      const tw = base(x, 'fly', pal); tw.parts = { kind }; tw.p = p; tw.marks = marks; tw.pose = 'side';
      return invFinish(x, tw, { body: 'body', wing: 'wing', head: 'eye', mark: 'mark', back: 'body', tail: 'mark', belly: 'mark', leg: 'mark' });
    },
  });

  def('spider', {
    skeleton: 'spider', regions: { body: 0.25, abdomen: 0.35, leg: 0.1, mark: 0.3 }, nudge: { marks: ['spots', 'stripes', 'chevrons', 'hourglass', 'bands', 'legBands'], parts: {}, p: ['abdomen', 'leg'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      let kind = 'wolf', pal = { body: [30, 30, 32], abdomen: [30, 30, 35], leg: [30, 30, 30], mark: [40, 30, 70] }, marks = { stripes: 0.6 }, p = { abdomen: 1, leg: 1, body: 1 };
      if (f === 'Araneidae' || f === 'Tetragnathidae') {
        kind = 'orb'; pal = { body: [35, 30, 40], abdomen: [38, 45, 55], leg: [35, 30, 38], mark: [220, 10, 20] }; marks = { chevrons: 1 }; p.abdomen = 1.35;
        if (/Argiope/.test(g)) { pal.abdomen = [50, 80, 58]; pal.mark = [220, 10, 17]; marks = { bands: 1.4, legBands: 1 }; }
        if (/Araneus/.test(g)) { marks = { cross: /diadematus/.test(x.sci) ? 1 : 0, chevrons: 1, spots: /marmoreus/.test(x.sci) ? 1 : 0.4 }; if (/marmoreus/.test(x.sci)) pal.abdomen = [30, 70, 58]; }
        if (/Neoscona/.test(g)) { pal.abdomen = [30, 35, 45]; marks = { chevrons: 1.2, spots: 0.6 }; }
        if (/Leucauge/.test(g)) { pal.abdomen = [130, 30, 60]; pal.mark = [40, 70, 60]; marks = { stripes: 1, spots: 0.6 }; kind = 'long'; p.abdomen = 1.1; }
        if (/Tetragnatha|Meta|Dolichognatha/.test(g)) { kind = 'long'; p.leg = 1.4; }
        if (/Micrathena|Gasteracantha/.test(g)) { marks.spines = 1; }
      } else if (f === 'Buthidae' || f === 'Vaejovidae' || f === 'Scorpionidae' || f === 'Iuridae') { kind = 'scorpion'; pal = { body: [40, 50, 58], abdomen: [40, 50, 58], leg: [42, 50, 62], mark: [30, 30, 28] }; marks = { stripes: /vittatus|striped/.test(x.sci + x.name) ? 1 : 0 }; }
      else if (f === 'Lycosidae' || f === 'Pisauridae') { kind = 'wolf'; pal = { body: [30, 25, 32], abdomen: [30, 25, 35], leg: [30, 25, 35], mark: [40, 25, 70] }; marks = { stripes: 1 }; p.leg = 1.15; if (/Dolomedes/.test(g)) { marks = { chevrons: 1, bands: 0.4 }; p.leg = 1.35; } if (/Pisaurina/.test(g)) { marks = { stripes: 1.3 }; pal.body = [35, 30, 55]; } if (/Hogna|Rabidosa/.test(g)) { marks = { stripes: 1, chevrons: /Rabidosa/.test(g) ? 1 : 0 }; } }
      else if (f === 'Salticidae') { kind = 'jumper'; pal = { body: [220, 10, 17], abdomen: [220, 10, 17], leg: [220, 10, 20], mark: [40, 10, 90] }; marks = { spots: 1 }; p = { abdomen: 0.85, leg: 0.7, body: 0.9 }; if (/Phidippus/.test(g) && /audax/.test(x.sci)) marks = { spots: 1.3, iridescent: 1 }; if (/Salticus/.test(g)) marks = { stripes: 1.3, bands: 1 }; if (/Platycryptus|Menemerus/.test(g)) { pal.body = [30, 20, 45]; pal.abdomen = [30, 20, 45]; } if (/johnsoni/.test(x.sci)) { pal.abdomen = [5, 70, 50]; marks = { stripes: 0.6 }; } }
      else if (f === 'Theraphosidae') { kind = 'tarantula'; pal = { body: [30, 30, 25], abdomen: [25, 30, 22], leg: [25, 30, 22], mark: [5, 60, 48] }; marks = { hairs: 1 }; p = { abdomen: 1.1, leg: 1, body: 1.3 }; if (/Brachypelma|redknee|smithi|hamorii/i.test(x.sci + x.name)) marks.legBands = 1; if (/blond|chalcodes/i.test(x.name + x.sci)) pal.body = [40, 40, 62]; if (/Arizona Black|Aphonopelma behlei/i.test(x.name)) { pal.body = [220, 10, 17]; pal.abdomen = [220, 10, 17]; pal.leg = [220, 10, 17]; } }
      else if (f === 'Theridiidae') { kind = 'widow'; pal = { body: [220, 10, 16], abdomen: [220, 10, 16], leg: [220, 10, 16], mark: [2, 70, 48] }; marks = { hourglass: 1 }; p = { abdomen: 1.4, leg: 1.05, body: 0.8 }; if (/Steatoda/.test(g)) { pal.abdomen = [15, 40, 30]; pal.mark = [40, 30, 70]; marks = { chevrons: 0.6 }; } }
      else if (f === 'Thomisidae') { kind = 'crab'; pal = { body: [50, 70, 62], abdomen: [50, 70, 65], leg: [50, 60, 65], mark: [350, 60, 55] }; marks = { stripes: 0.6 }; if (/Misumena/.test(g)) { pal.body = [48, 60, 80]; pal.abdomen = [48, 70, 72]; } }
      else if (f === 'Sparassidae') { kind = 'crab'; pal = { body: [35, 40, 50], abdomen: [35, 35, 50], leg: [35, 40, 52] }; p.leg = 1.4; }
      else if (f === 'Pholcidae') { kind = 'cellar'; pal = { body: [35, 20, 65], abdomen: [35, 20, 60], leg: [35, 20, 55], mark: [30, 20, 35] }; marks = { mottle: 1 }; p = { abdomen: /longbodied|Pholcus/.test(x.name + g) ? 1.4 : 0.9, leg: 1.9, body: 0.6 }; }
      else if (f === 'Oxyopidae') { kind = 'lynx'; pal = { body: [100, 55, 50], abdomen: [100, 50, 52], leg: [95, 40, 55], mark: [2, 55, 48] }; marks = { chevrons: 0.6, spines: 1 }; }
      else if (f === 'Gnaphosidae' || f === 'Clubionidae' || f === 'Trachelidae') { kind = 'wolf'; pal = { body: [220, 10, 18], abdomen: [220, 10, 18], leg: [220, 10, 20], mark: [40, 10, 90] }; marks = { collar: 1 }; p.leg = 0.9; }
      else if (f === 'Sclerosomatidae' || f === 'Phalangiidae') { kind = 'harvestman'; pal = { body: [30, 30, 40], abdomen: [30, 30, 40], leg: [30, 30, 25] }; marks = {}; p.leg = 2; }
      else if (f === 'Ixodidae' || f === 'Trombidiidae') { kind = 'mite'; pal = { body: [5, 60, 45], abdomen: [5, 60, 45], leg: [5, 60, 40] }; marks = {}; }
      const tw = base(x, 'spider', pal); tw.parts = { kind }; tw.p = p; tw.marks = marks; tw.pose = 'side';
      return invFinish(x, tw, { body: ['body', 'abdomen', 'leg'], head: 'body', mark: 'mark', leg: 'leg', belly: 'abdomen', back: 'abdomen', tail: 'abdomen', wing: 'abdomen' });
    },
  });

  def('crustacean', {
    skeleton: 'crust', regions: { body: 0.55, claw: 0.15, mark: 0.3 }, nudge: { marks: ['bands', 'spots', 'clawTip', 'stripe', 'speckle'], parts: {}, p: ['claw', 'len', 'antenna'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      let kind = 'crayfish', pal = { body: [15, 45, 38], claw: [15, 50, 40], mark: [220, 10, 20] }, marks = {}, p = { claw: 1, len: 1, antenna: 1 };
      if (['Armadillidiidae', 'Oniscidae', 'Porcellionidae', 'Philosciidae', 'Trachelipodidae', 'Stenasellidae', 'Cirolanidae', 'Asellidae', 'Ligiidae'].includes(f)) { kind = 'isopod'; pal = { body: [210, 8, 40], claw: [210, 8, 40], mark: [42, 30, 70] }; if (f === 'Armadillidiidae') marks.roll = 1; if (f === 'Philosciidae') marks.stripe = 1; if (f === 'Porcellionidae') marks.speckle = 1; if (f === 'Oniscidae') marks.spots = 1; if (f === 'Stenasellidae' || f === 'Cirolanidae' || f === 'Asellidae') { pal.body = [350, 20, 85]; marks = {}; p.antenna = 1.5; } }
      else if (['Crangonyctidae', 'Gammaridae', 'Hyalellidae', 'Niphargidae', 'Talitridae', 'Hadziidae', 'Bogidiellidae'].includes(f)) { kind = 'amphipod'; pal = { body: /cave|Stygobromus/i.test(x.name + g) ? [350, 20, 86] : [40, 30, 55], claw: [40, 30, 55], mark: [30, 30, 40] }; marks = {}; }
      else if (['Atyidae', 'Palaemonidae', 'Penaeidae'].includes(f)) { kind = 'shrimp'; pal = { body: /cave|Purgatory/i.test(x.name) ? [350, 20, 86] : [30, 25, 70], claw: [30, 25, 70], mark: [15, 50, 50] }; marks = { bands: 0.6 }; p.antenna = 1.4; }
      else if (f === 'Palinuridae') { kind = 'lobster'; pal = { body: [25, 55, 45], claw: [25, 55, 45], mark: [48, 70, 70] }; marks = { spots: 1 }; p.antenna = 1.6; p.claw = 0; }
      else if (f === 'Cambaridae' || f === 'Astacidae' || f === 'Parastacidae') {
        pal = { body: [25, 40, 35], claw: [25, 45, 38], mark: [220, 10, 20] };
        if (/clarkii/.test(x.sci)) { pal = { body: [4, 65, 42], claw: [4, 65, 42], mark: [220, 10, 17] }; marks = { speckle: 1 }; }
        else if (/rusticus/.test(x.sci)) { pal.body = [30, 20, 45]; marks = { spots: 1, clawTip: 1 }; pal.mark = [15, 65, 45]; }
        else if (/leniusculus/.test(x.sci)) { pal.body = [20, 40, 32]; marks = { clawTip: 1 }; pal.mark = [42, 30, 90]; }
        else if (/virilis/.test(x.sci)) { pal.body = [30, 30, 38]; pal.claw = [200, 35, 45]; }
        else if (/cave|Orconectes (inermis|australis|pellucidus)|Cambarus (aculabrum|setosus|tartarus|zophonastes|hubrichti)|Procambarus (erythrops|pallidus)|Troglocambarus/i.test(x.name + ' ' + x.sci)) { pal = { body: [350, 20, 86], claw: [350, 20, 85], mark: [350, 20, 70] }; p.antenna = 1.5; marks = { blind: 1 }; }
        else if (x.h('cm') > 0.5) marks.bands = 0.6;
      }
      const tw = base(x, 'crustacean', pal); tw.parts = { kind }; tw.p = p; tw.marks = marks; tw.pose = 'side';
      return invFinish(x, tw, { body: ['body', 'claw'], mark: 'mark', head: 'body', back: 'body', leg: 'claw', tail: 'body', belly: 'mark', wing: 'claw' });
    },
  });

  def('snail', {
    skeleton: 'snail', regions: { shell: 0.5, body: 0.2, mark: 0.3 }, nudge: { marks: ['bands', 'stripes', 'lip', 'spots', 'speckle'], parts: { kind: ['round', 'tall', 'flat'] }, p: ['shell', 'spire'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      let kind = 'round', pal = { shell: [30, 35, 45], body: [35, 20, 55], mark: [25, 30, 25] }, marks = {}, p = { shell: 1, spire: 1, foot: 1 };
      if (['Agriolimacidae', 'Philomycidae', 'Veronicellidae', 'Limacidae', 'Arionidae', 'Ariolimacidae'].includes(f)) { kind = 'slug'; pal = { shell: [30, 15, 40], body: [30, 15, 40], mark: [25, 20, 25] }; marks = f === 'Philomycidae' ? { mottle: 1 } : f === 'Veronicellidae' ? { speckle: 1 } : { stripes: 0.6 }; if (f === 'Veronicellidae') pal.body = [220, 10, 18]; }
      else if (f === 'Haliotidae') { kind = 'abalone'; pal = { shell: /rufescens|Red/.test(x.sci + x.name) ? [5, 45, 42] : /cracherodii|Black/.test(x.sci + x.name) ? [220, 10, 18] : [150, 25, 40], body: [30, 15, 25], mark: [180, 40, 70] }; marks = { holes: 1 }; if (/kamtschatkana|Pinto/.test(x.sci + x.name)) marks.mottle = 1; if (/walallensis|Flat/.test(x.sci + x.name)) p.spire = 0.5; }
      else if (['Acroloxidae', 'Ancylidae', 'Lottiidae'].includes(f)) { kind = 'limpet'; pal.shell = [35, 20, 60]; }
      else if (['Hydrobiidae', 'Cochliopidae', 'Amnicolidae', 'Assimineidae', 'Pleuroceridae', 'Bulimulidae', 'Achatinidae', 'Vertiginidae', 'Pupillidae', 'Physidae', 'Lymnaeidae', 'Paskentanidae', 'Thiaridae', 'Viviparidae'].includes(f)) {
        kind = 'tall'; p.spire = f === 'Pleuroceridae' || f === 'Achatinidae' ? 1.6 : f === 'Vertiginidae' || f === 'Hydrobiidae' ? 0.9 : 1.2;
        if (f === 'Physidae') { kind = 'leftTall'; pal.shell = [40, 30, 65]; }
        if (f === 'Lymnaeidae') pal.shell = [35, 35, 50];
        if (f === 'Bulimulidae') { pal.shell = [40, 20, 85]; marks = { stripes: /Striped/.test(x.name) ? 1 : 0.3 }; }
        if (f === 'Hydrobiidae' || f === 'Cochliopidae' || f === 'Amnicolidae') { p.shell = 0.7; pal.shell = /cave/i.test(x.name) ? [40, 10, 88] : [30, 20, 42]; }
        if (f === 'Pleuroceridae') marks = { ribs: /Armored|Rugged/.test(x.name) ? 1 : 0, bands: 0.5 };
      }
      else if (f === 'Planorbidae') { kind = 'flat'; pal.shell = [20, 40, 35]; }
      else if (['Polygyridae', 'Helicidae', 'Camaenidae', 'Xanthonychidae', 'Helicinidae', 'Oreohelicidae', 'Helminthoglyptidae', 'Discidae'].includes(f)) {
        kind = 'round'; marks = { bands: 0.6 }; if (f === 'Polygyridae') { marks = { lip: 1 }; p.spire = 0.7; } if (f === 'Helicidae') { pal.shell = [40, 25, 85]; marks = { bands: 1 }; } if (f === 'Helicinidae') { kind = 'flat'; pal.shell = [15, 45, 55]; }
        if (f === 'Oreohelicidae' || f === 'Helminthoglyptidae' || f === 'Xanthonychidae') marks = { bands: 1 };
      }
      const tw = base(x, 'snail', pal); tw.parts = { kind }; tw.p = p; tw.marks = marks; tw.pose = 'crawl';
      return invFinish(x, tw, { body: 'shell', mark: 'mark', head: 'body', back: 'shell', leg: 'body', tail: 'shell', belly: 'body', wing: 'shell' });
    },
  });

  def('worm', {
    skeleton: 'worm', regions: { body: 0.6, mark: 0.4 }, nudge: { marks: ['bands', 'stripes', 'clitellum', 'spots'], parts: {}, p: ['len', 'thick'] },
    derive(x) {
      const f = x.fam;
      let kind = 'earthworm', pal = { body: [8, 40, 55], mark: [355, 35, 45] }, marks = { clitellum: 1 }, p = { len: 1, thick: 1 };
      if (f === 'Lumbriculidae' || f === 'Naididae' || f === 'Tubificidae') { kind = 'thin'; pal.body = [5, 55, 50]; p.thick = 0.6; marks = {}; }
      else if (f === 'Hirudinidae' || f === 'Erpobdellidae' || f === 'Glossiphoniidae') { kind = 'leech'; pal = { body: [120, 20, 25], mark: [30, 60, 55] }; marks = { stripes: 1 }; }
      else if (f === 'Megascolecidae') { pal.body = [25, 30, 40]; marks = { clitellum: 1.3 }; p.thick = 1.1; }
      else if (f === 'Acanthodrilidae') { pal.body = [15, 30, 60]; marks = { clitellum: 0.7 }; }
      else if (f === 'Lumbricidae') {
        if (/Eisenia/.test(x.genus)) { pal.body = [0, 55, 45]; marks = { bands: 1, clitellum: 1 }; p.thick = 0.85; }
        if (/Lumbricus terrestris|Nightcrawler/i.test(x.sci + x.name)) { pal.body = [355, 35, 45]; p.len = 1.3; p.thick = 1.25; }
        if (/Octolasion|Aporrectodea/.test(x.genus)) pal.body = [350, 15, 70];
      }
      const tw = base(x, 'worm', pal); tw.parts = { kind }; tw.p = p; tw.marks = marks; tw.pose = 'crawl';
      return invFinish(x, tw, { body: 'body', mark: 'mark', head: 'mark', back: 'body', tail: 'mark', belly: 'body', leg: 'body', wing: 'body' });
    },
  });

  // --- plants ---
  const PLANT_NAME = { body: 'flower', mark: 'flower', head: 'flower', leg: 'stem', back: 'leaf', belly: 'flower', tail: 'flower', wing: 'leaf', bill: 'flower' };
  // Colour words in a plant's name usually describe its flowers (or its fruit on trees).
  function plantColors(x, tw, target) {
    const nm = x.nm.col;
    const c = nm.body || nm.mark || nm.head || nm.belly;
    if (c && !/leaf|leaved|bark|stem/.test(x.name)) tw.col[target] = c.slice();
    if (/silver|gray|grey|dusty|hoary|woolly|wooly|velvet/.test(x.name)) tw.col.leaf = [100, 12, 62];
    if (/blue(?!bonnet|bell|stem|eyed)/.test(x.name) && target !== 'flower') tw.col.leaf = [170, 22, 45];
  }
  const FLOWER_FAM = {
    Asteraceae: 'daisy', Fabaceae: 'pea', Apiaceae: 'umbel', Lamiaceae: 'spike', Brassicaceae: 'cross', Rosaceae: 'cup', Ranunculaceae: 'cup',
    Orchidaceae: 'orchid', Asparagaceae: 'bell', Liliaceae: 'lily', Melanthiaceae: 'star3', Amaryllidaceae: 'globe', Plantaginaceae: 'tube',
    Scrophulariaceae: 'spike', Euphorbiaceae: 'tiny', Apocynaceae: 'globe', Boraginaceae: 'bell', Campanulaceae: 'bell', Polemoniaceae: 'star',
    Papaveraceae: 'cup', Onagraceae: 'cup', Malvaceae: 'cup', Geraniaceae: 'cup', Solanaceae: 'star', Convolvulaceae: 'trumpet',
    Verbenaceae: 'cluster', Nyctaginaceae: 'trumpet', Caryophyllaceae: 'star', Polygonaceae: 'cluster', Violaceae: 'violet', Iridaceae: 'iris',
    Orobanchaceae: 'spike', Asclepiadaceae: 'globe', Ericaceae: 'bell', Primulaceae: 'star', Gentianaceae: 'bell', Hydrophyllaceae: 'cluster',
    Portulacaceae: 'cup', Montiaceae: 'cup', Loasaceae: 'star', Cactaceae: 'cup', Araceae: 'spathe', Commelinaceae: 'star3', Saxifragaceae: 'tiny',
    Crassulaceae: 'star', Amaranthaceae: 'tiny', Chenopodiaceae: 'tiny', Urticaceae: 'tiny', Acanthaceae: 'tube', Lythraceae: 'spike',
    Zamiaceae: 'none', Cyperaceae: 'none', Poaceae: 'none', Typhaceae: 'none', Juncaceae: 'none', Potamogetonaceae: 'none', Nymphaeaceae: 'cup',
    Rubiaceae: 'star', Linaceae: 'cup', Oxalidaceae: 'cup', Hypericaceae: 'cup', Cistaceae: 'cup', Cleomaceae: 'cross', Rutaceae: 'star',
  };
  const FLOWER_COLORS = { daisy: [[48, 80, 58], [275, 35, 55], [42, 15, 92], [30, 80, 55]], pea: [[270, 40, 55], [48, 80, 60], [330, 45, 60], [42, 15, 92]], umbel: [[42, 15, 92], [52, 70, 65]],
    spike: [[270, 40, 55], [330, 45, 60], [210, 50, 55]], cross: [[52, 75, 62], [42, 15, 92], [300, 30, 65]], cup: [[52, 80, 60], [42, 15, 92], [340, 50, 62], [5, 60, 50]],
    orchid: [[300, 35, 65], [42, 15, 92], [52, 70, 60]], bell: [[240, 40, 60], [42, 15, 92], [300, 30, 60]], lily: [[25, 75, 55], [42, 15, 92], [50, 70, 62]],
    star3: [[350, 45, 40], [42, 15, 92], [100, 30, 55]], globe: [[330, 40, 65], [42, 15, 92], [280, 30, 60]], tube: [[270, 40, 55], [340, 55, 55], [5, 65, 50]],
    tiny: [[70, 30, 60], [42, 15, 90]], star: [[210, 45, 60], [42, 15, 92], [330, 45, 60]], trumpet: [[300, 40, 60], [42, 15, 92], [330, 50, 60]],
    cluster: [[270, 35, 60], [330, 40, 65], [42, 15, 92]], violet: [[265, 45, 55], [52, 75, 62]], iris: [[245, 45, 55], [52, 75, 62]], spathe: [[100, 30, 50], [42, 15, 92]], none: [[80, 25, 50]] };

  def('forb', {
    skeleton: 'plant', regions: { flower: 0.45, leaf: 0.3, center: 0.1, mark: 0.15 }, nudge: { marks: ['spots', 'center', 'stripe', 'variegated'], parts: { flower: ['daisy', 'spike', 'umbel', 'cup', 'bell', 'cluster', 'star'], leaf: ['lance', 'round', 'lobed', 'compound'] }, p: ['height', 'flowerSize', 'leafSize'] },
    derive(x) {
      const f = x.fam;
      let flower = FLOWER_FAM[f] || x.pick('fl', ['cup', 'star', 'cluster', 'spike', 'bell']);
      const LEAF = { Fabaceae: 'compound', Apiaceae: 'lobed', Asteraceae: x.pick('lfA', ['lance', 'lobed', 'lance']), Ranunculaceae: 'lobed', Geraniaceae: 'lobed', Orchidaceae: 'strap', Asparagaceae: 'strap', Liliaceae: 'strap', Amaryllidaceae: 'strap', Iridaceae: 'strap', Melanthiaceae: 'broad', Araceae: 'heart', Violaceae: 'heart', Lamiaceae: 'oval', Rosaceae: 'compound', Euphorbiaceae: 'round' };
      let leaf = LEAF[f] || x.pick('lf', ['lance', 'oval', 'round', 'lobed']);
      if (/Solidago|goldenrod/i.test(x.sci + x.name)) flower = 'plume';
      if (/Helianthus|sunflower/i.test(x.sci + x.name)) flower = 'sun';
      if (/Echinacea|Rudbeckia|Ratibida|coneflower/i.test(x.sci + x.name)) flower = 'cone';
      if (/Liatris|blazing|gayfeather/i.test(x.sci + x.name)) flower = 'spike';
      if (/thistle|Cirsium|Carduus/i.test(x.sci + x.name)) flower = 'thistle';
      if (/Lupinus|lupine/i.test(x.sci + x.name)) flower = 'spike';
      if (/Trillium|wakerobin/i.test(x.sci + x.name)) { flower = 'star3'; leaf = 'broad'; }
      if (/Asclepias|milkweed/i.test(x.sci + x.name)) flower = 'globe';
      if (/Penstemon|beardtongue/i.test(x.sci + x.name)) flower = 'tube';
      if (/Agave|Yucca/.test(x.genus)) { flower = 'spike'; leaf = 'strap'; }
      if (f === 'Zamiaceae' || f === 'Cycadaceae') { flower = 'cone'; leaf = 'frond'; }
      if (/slipper|Cypripedium/i.test(x.sci + x.name)) flower = 'slipper';
      const fc = FLOWER_COLORS[flower] || FLOWER_COLORS.cup;
      const pal = { leaf: [95 + (x.h('lh') - 0.5) * 40, 32, 38 + (x.h('ll') - 0.5) * 12], flower: x.pick('fc', fc).slice(), center: flower === 'daisy' || flower === 'sun' || flower === 'cone' ? [30, 55, 30] : [52, 70, 60], stem: [95, 30, 32], mark: [300, 30, 35] };
      if (flower === 'sun') { pal.flower = [48, 85, 58]; pal.center = [25, 45, 22]; }
      if (flower === 'cone') { pal.center = [20, 50, 25]; }
      const tw = base(x, 'forb', pal);
      tw.parts = { flower, leaf, count: 1 + Math.floor(x.h('fn') * 3) }; tw.p = { height: 1, flowerSize: 1, leafSize: 1 }; tw.marks = {}; tw.pose = 'stand';
      tw.size = 's';
      plantColors(x, tw, 'flower');
      if (x.nm.pat.has('spots')) tw.marks.spots = 1;
      if (x.nm.pat.has('stripes')) tw.marks.stripe = 1;
      if (x.has(/tall|giant|great/)) tw.p.height = 1.3;
      if (x.has(/dwarf|pygmy|creeping|prostrate|sandmat|mat\b|ground|trailing/)) tw.p.height = 0.6;
      props(x, tw, ['height', 'flowerSize', 'leafSize'], 0.12); jitterColors(x, tw, 10, 6);
      return tw;
    },
  });

  def('grass', {
    skeleton: 'plant', regions: { leaf: 0.5, head: 0.3, mark: 0.2 }, nudge: { marks: ['awns'], parts: { head: ['spike', 'panicle', 'plume', 'flag', 'brush'] }, p: ['height', 'blade', 'headSize'] },
    derive(x) {
      const g = x.genus;
      let head = x.pick('gh', ['spike', 'panicle', 'plume']), pal = { leaf: [85 + (x.h('gl') - 0.5) * 30, 30, 45 + (x.h('gll') - 0.5) * 14], head: [40, 35, 62], mark: [15, 40, 45] }, p = { height: 1, blade: 1, headSize: 1 };
      if (/Bouteloua/.test(g)) { head = 'flag'; if (/curtipendula/.test(x.sci)) head = 'sideoats'; }
      if (/Andropogon|Schizachyrium|Bothriochloa|Dichanthium/.test(g)) { head = 'plume'; pal.leaf = [200, 20, 45]; pal.head = [20, 35, 55]; if (/gerardii/.test(x.sci)) head = 'turkeyfoot'; }
      if (/Hordeum|Elymus|Pascopyrum|Aristida|Hesperostipa|Stipa|Nassella|Achnatherum/.test(g)) head = 'awned';
      if (/Panicum|Eragrostis|Sporobolus|Poa|Muhlenbergia|Agrostis/.test(g)) head = 'panicle';
      if (/Sorghastrum/.test(g)) { head = 'plume'; pal.head = [38, 70, 50]; }
      if (/Bromus/.test(g)) head = 'nodding';
      if (/Phragmites|Arundo|Cortaderia|Saccharum|Erianthus/.test(g)) { head = 'plume'; p.height = 1.8; }
      if (/Cenchrus|Setaria|Alopecurus|Phleum|Pennisetum/.test(g)) head = 'brush';
      if (/Tripsacum|Zea|Zizania/.test(g)) { head = 'spike'; p.height = 1.5; }
      if (x.fam === 'Cyperaceae') { head = /Scirpus|Schoenoplectus|Eleocharis/.test(g) ? 'bulrush' : 'sedge'; pal.leaf = [110, 30, 38]; pal.head = [30, 35, 35]; }
      if (x.fam === 'Juncaceae') { head = 'rush'; pal.leaf = [120, 25, 35]; }
      const tw = base(x, 'grass', pal); tw.parts = { head, clump: x.pick('cl', ['tuft', 'spread']) }; tw.p = p; tw.marks = {}; tw.pose = 'stand'; tw.size = 's';
      plantColors(x, tw, 'head');
      if (x.has(/awn|bristle|needle|three-awn|spear/)) tw.marks.awns = 1;
      if (x.has(/tall|giant|big/)) tw.p.height = r1(tw.p.height * 1.3);
      if (x.has(/little|dwarf|sixweeks|tiny|short/)) tw.p.height = r1(tw.p.height * 0.7);
      props(x, tw, ['height', 'blade', 'headSize'], 0.1); jitterColors(x, tw, 8, 5);
      return tw;
    },
  });

  def('shrub', {
    skeleton: 'plant', regions: { leaf: 0.5, fruit: 0.3, stem: 0.1, mark: 0.1 }, nudge: { marks: ['fruit', 'flowers', 'thorns', 'variegated'], parts: { shape: ['round', 'spreading', 'upright', 'mound'], leaf: ['fine', 'broad', 'needle'] }, p: ['height', 'width'] },
    derive(x) {
      const f = x.fam;
      let shape = x.pick('sh', ['round', 'spreading', 'upright', 'mound']), leaf = x.pick('sl', ['fine', 'broad', 'broad']), pal = { leaf: [95 + (x.h('lh') - 0.5) * 40, 28, 36 + (x.h('ll') - 0.5) * 12], fruit: [355, 60, 45], stem: [25, 30, 30], mark: [42, 15, 92] }, marks = { fruit: x.h('fr') > 0.5 ? 1 : 0 }, p = { height: 1, width: 1 };
      if (f === 'Asteraceae') { leaf = 'fine'; pal.leaf = [90, 15, 55]; marks = { flowers: 1 }; pal.fruit = [48, 75, 58]; if (/Artemisia|sage/i.test(x.sci + x.name)) { pal.leaf = [150, 8, 62]; marks = {}; } }
      if (f === 'Rosaceae') { marks = { flowers: x.h('rf') > 0.5 ? 1 : 0, fruit: 1, thorns: /Rubus|Rosa|Crataegus|Pyracantha/.test(x.genus) ? 1 : 0 }; pal.fruit = /Rubus/.test(x.genus) ? [300, 40, 25] : [355, 65, 45]; pal.mark = [340, 40, 80]; }
      if (f === 'Ericaceae') { leaf = 'broad'; pal.stem = [10, 50, 35]; marks = { fruit: 1 }; pal.fruit = /Vaccinium|blueberry/i.test(x.sci + x.name) ? [230, 35, 45] : [5, 55, 45]; }
      if (f === 'Fabaceae') { leaf = 'fine'; marks = { flowers: 1 }; pal.fruit = x.pick('fbc', [[270, 40, 55], [48, 80, 60]]); if (/Mimosa|Acacia|Senegalia|Vachellia|Prosopis/.test(x.genus)) { marks.thorns = 1; pal.fruit = [48, 80, 62]; } }
      if (f === 'Malvaceae') { marks = { flowers: 1 }; pal.fruit = [18, 75, 55]; pal.leaf = [100, 15, 55]; }
      if (f === 'Lamiaceae' || f === 'Verbenaceae') { marks = { flowers: 1 }; pal.fruit = [275, 40, 58]; leaf = 'fine'; }
      if (f === 'Onagraceae') { marks = { flowers: 1 }; pal.fruit = [52, 80, 62]; }
      if (f === 'Oleaceae') { marks = { flowers: 1 }; pal.fruit = x.pick('olc', [[52, 80, 60], [280, 30, 70], [42, 15, 92]]); }
      if (f === 'Anacardiaceae') { marks = { fruit: 1 }; pal.fruit = [5, 65, 45]; leaf = 'broad'; if (/Rhus|sumac/i.test(x.sci + x.name)) leaf = 'compound'; }
      if (f === 'Caprifoliaceae' || f === 'Adoxaceae') { marks = { fruit: 1, flowers: 0.6 }; pal.fruit = [240, 25, 30]; }
      if (f === 'Rhamnaceae') { marks = { flowers: 1 }; pal.fruit = [230, 45, 65]; }
      if (f === 'Zygophyllaceae') { leaf = 'fine'; pal.leaf = [80, 30, 38]; marks = { flowers: 1 }; pal.fruit = [52, 80, 60]; }
      if (f === 'Chenopodiaceae' || f === 'Amaranthaceae') { leaf = 'fine'; pal.leaf = [100, 10, 60]; marks = {}; }
      if (f === 'Pinaceae' || f === 'Cupressaceae' || f === 'Taxaceae') { leaf = 'needle'; pal.leaf = [150, 30, 30]; marks = { fruit: f === 'Cupressaceae' ? 1 : 0 }; pal.fruit = [215, 25, 55]; }
      if (f === 'Ephedraceae') { leaf = 'none'; pal.leaf = [110, 25, 45]; shape = 'upright'; }
      const tw = base(x, 'shrub', pal); tw.parts = { shape, leaf }; tw.p = p; tw.marks = marks; tw.pose = 'stand'; tw.size = 'm';
      plantColors(x, tw, 'fruit');
      if (x.nm.col.body) tw.marks.flowers = Math.max(1, tw.marks.flowers || 0);
      props(x, tw, ['height', 'width'], 0.12); jitterColors(x, tw, 10, 6);
      return tw;
    },
  });

  def('tree', {
    skeleton: 'plant', regions: { leaf: 0.5, trunk: 0.15, fruit: 0.2, mark: 0.15 }, nudge: { marks: ['fruit', 'flowers', 'cones', 'autumn'], parts: { crown: ['round', 'oval', 'cone', 'vase', 'spire', 'irregular'] }, p: ['height', 'crown', 'trunk'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      const CROWN = { Pinaceae: 'cone', Cupressaceae: 'spire', Taxaceae: 'cone', Podocarpaceae: 'oval', Araucariaceae: 'spire', Arecaceae: 'palm', Zamiaceae: 'cycad', Cycadaceae: 'cycad', Fagaceae: 'round', Salicaceae: 'oval', Betulaceae: 'oval', Sapindaceae: 'round', Oleaceae: 'oval', Juglandaceae: 'round', Cannabaceae: 'vase', Ulmaceae: 'vase', Fabaceae: 'umbrella', Myrtaceae: 'irregular', Magnoliaceae: 'oval', Rosaceae: 'round', Platanaceae: 'round', Bignoniaceae: 'round', Lauraceae: 'oval', Malvaceae: 'round', Moraceae: 'round', Cornaceae: 'round', Ebenaceae: 'oval', Hamamelidaceae: 'oval', Altingiaceae: 'cone', Nyssaceae: 'oval', Anacardiaceae: 'round', Rutaceae: 'round', Ericaceae: 'irregular', Aquifoliaceae: 'cone' };
      let crown = CROWN[f] || x.pick('cr', ['round', 'oval', 'vase', 'irregular']);
      const pal = { leaf: [100 + (x.h('lh') - 0.5) * 40, 32, 34 + (x.h('ll') - 0.5) * 12], trunk: [25, 30, 28], fruit: [5, 60, 45], mark: [30, 60, 50] };
      const marks = {}, p = { height: 1, crown: 1, trunk: 1 };
      let bark = 'plain';
      if (crown === 'cone' || crown === 'spire') { pal.leaf = [150, 30, 28 + (x.h('cl') - 0.5) * 10]; marks.cones = x.h('cn') > 0.4 ? 1 : 0; pal.fruit = [25, 40, 35]; }
      if (/Pinus/.test(g)) { crown = x.h('pc') > 0.5 ? 'pine' : 'cone'; p.height = 1.1; }
      if (/Sequoia|Sequoiadendron/.test(g)) { crown = 'spire'; p.height = 1.4; pal.trunk = [12, 50, 35]; }
      if (/Juniperus/.test(g)) { crown = 'irregular'; pal.leaf = [165, 20, 35]; marks.fruit = 1; pal.fruit = [215, 30, 60]; }
      if (/Taxodium/.test(g)) { crown = 'cone'; pal.leaf = [110, 35, 40]; }
      if (/Betula/.test(g)) { bark = 'white'; crown = 'oval'; }
      if (/Populus/.test(g)) { crown = /tremuloides/.test(x.sci) ? 'column' : 'round'; bark = /tremuloides/.test(x.sci) ? 'white' : 'plain'; pal.leaf = [85, 40, 45]; }
      if (/Salix/.test(g)) { crown = 'weeping'; pal.leaf = [85, 35, 50]; }
      if (/Quercus/.test(g)) { crown = 'round'; marks.nuts = 1; pal.fruit = [30, 40, 35]; if (/virginiana|agrifolia|fusiformis|chrysolepis|emoryi|tomentella|wislizeni|lobata/.test(x.sci)) crown = 'spreading'; }
      if (/Acer/.test(g)) { crown = 'round'; if (/rubrum|red/i.test(x.sci + x.name)) marks.autumn = 1, pal.mark = [5, 65, 48]; if (/saccharum/.test(x.sci)) marks.autumn = 0.6, pal.mark = [30, 75, 50]; }
      if (/Carya|Juglans/.test(g)) { marks.nuts = 1; pal.fruit = [80, 30, 40]; }
      if (/Prosopis|Acacia|Vachellia|Senegalia|Olneya|Parkinsonia|Cercidium|Mimosa/.test(g)) { crown = 'umbrella'; pal.leaf = [90, 25, 45]; if (/Parkinsonia|Cercidium/.test(g)) pal.trunk = [80, 40, 50]; }
      if (/Cercis/.test(g)) { marks.flowers = 1; pal.fruit = [320, 45, 65]; }
      if (/Cornus/.test(g)) { marks.flowers = 1; pal.fruit = [42, 15, 92]; }
      if (/Magnolia|Liriodendron/.test(g)) { marks.flowers = 1; pal.fruit = [42, 15, 92]; }
      if (/Prunus|Malus|Crataegus|Amelanchier/.test(g)) { marks.flowers = 1; marks.fruit = 1; pal.fruit = [355, 60, 42]; pal.mark = [340, 40, 88]; }
      if (/Platanus|Arbutus/.test(g)) bark = 'patchy';
      if (/Eucalyptus|Corymbia|Melaleuca/.test(g)) { crown = 'irregular'; pal.leaf = [160, 18, 45]; bark = 'patchy'; }
      if (/Fraxinus/.test(g)) { crown = 'oval'; pal.leaf = [100, 35, 38]; }
      if (/Ulmus|Celtis/.test(g)) { crown = 'vase'; }
      if (/Tsuga|Abies|Picea|Pseudotsuga/.test(g)) { crown = 'cone'; pal.leaf = [155, 30, /Picea pungens/.test(x.sci) ? 55 : 25]; }
      if (/Thuja|Chamaecyparis|Calocedrus|Cupressus|Hesperocyparis|Callitris/.test(g)) { crown = 'spire'; pal.leaf = [140, 25, 35]; }
      if (/Washingtonia|Sabal|Pritchardia|Thrinax|Coccothrinax|Roystonea|Pseudophoenix|Serenoa|Dypsis|Howea|Chamaedorea|Phoenix/.test(g)) crown = 'palm';
      if (/Yucca|Dracaena/.test(g)) crown = 'joshua';
      const tw = base(x, 'tree', pal); tw.parts = { crown, bark }; tw.p = p; tw.marks = marks; tw.pose = 'stand'; tw.size = 'xl';
      plantColors(x, tw, marks.flowers ? 'fruit' : 'fruit');
      if (x.nm.col.body && /red|scarlet|crimson/.test(x.name) && !marks.flowers) { marks.autumn = 1; tw.col.mark = x.nm.col.body.slice(); }
      if (/white|silver|paper|ghost/.test(x.name) && crown !== 'palm') bark = tw.parts.bark = 'white';
      if (/black/.test(x.name)) tw.col.trunk = [25, 15, 18];
      if (/weeping/.test(x.name)) tw.parts.crown = 'weeping';
      if (/dwarf|scrub|shrub|pygmy|pigmy|mallee/.test(x.name)) tw.p.height = 0.75;
      if (/giant|great|tall|king|redwood|sequoia/.test(x.name)) tw.p.height = 1.3;
      props(x, tw, ['height', 'crown', 'trunk'], 0.1); jitterColors(x, tw, 10, 6);
      return tw;
    },
  });

  def('succulent', {
    skeleton: 'plant', regions: { body: 0.5, flower: 0.3, mark: 0.2 }, nudge: { marks: ['flowers', 'spines', 'stripes', 'fruit'], parts: { kind: ['paddle', 'barrel', 'column', 'agave', 'pincushion'] }, p: ['height', 'width'] },
    derive(x) {
      const g = x.genus, n = x.name;
      let kind = 'barrel';
      if (/Opuntia|Cylindropuntia|prickly|pear|cholla/i.test(g + n)) kind = /Cylindropuntia|cholla|cane/i.test(g + n) ? 'cholla' : 'paddle';
      else if (/Carnegiea|Pachycereus|Stenocereus|Cereus|Echinocereus|Peniocereus|Selenicereus|Harrisia|Acanthocereus|Pilosocereus/i.test(g)) kind = /Echinocereus/.test(g) ? 'hedgehog' : 'column';
      else if (/Mammillaria|Coryphantha|Escobaria|Pediocactus|Sclerocactus|Epithelantha|Ancistrocactus|pincushion|nipple|fishhook|foxtail/i.test(g + n)) kind = 'pincushion';
      else if (/Agave|century/i.test(g + n)) kind = 'agave';
      else if (/Yucca|Hesperaloe|Hesperoyucca/i.test(g)) kind = 'yucca';
      else if (/Dasylirion|Nolina|sotol|sacahuista/i.test(g + n)) kind = 'sotol';
      else if (/Schlumbergera|Rhipsalis|Epiphyllum|Christmas/i.test(g + n)) kind = 'paddle';
      else if (x.fam === 'Crassulaceae') kind = 'rosette';
      const pal = { body: kind === 'agave' || kind === 'yucca' || kind === 'sotol' || kind === 'rosette' ? [150, 18, 50] : [120, 25, 40], flower: x.pick('scf', [[340, 55, 60], [50, 80, 60], [15, 70, 55], [42, 15, 92]]), spine: [45, 30, 85], mark: [45, 30, 85] };
      if (kind === 'yucca' || kind === 'agave' || kind === 'sotol') pal.flower = [48, 50, 85];
      const tw = base(x, 'succulent', pal); tw.parts = { kind }; tw.p = { height: 1, width: 1 }; tw.marks = { flowers: x.h('sf') > 0.35 ? 1 : 0, spines: /agave|yucca|sotol|rosette/.test(kind) ? 0 : 1 }; tw.pose = 'stand'; tw.size = 'm';
      plantColors(x, tw, 'flower');
      if (x.nm.col.body) tw.marks.flowers = 1;
      props(x, tw, ['height', 'width'], 0.12); jitterColors(x, tw, 8, 5);
      return tw;
    },
  });

  def('vine', {
    skeleton: 'plant', regions: { flower: 0.4, leaf: 0.45, mark: 0.15 }, nudge: { marks: ['flowers', 'fruit', 'tendrils'], parts: { leaf: ['heart', 'lobed', 'compound', 'palmate'] }, p: ['height', 'leafSize'] },
    derive(x) {
      const f = x.fam;
      let leaf = x.pick('vl', ['heart', 'lobed', 'compound']), flower = 'none', pal = { leaf: [100 + (x.h('lh') - 0.5) * 30, 35, 38], flower: [300, 40, 60], fruit: [260, 35, 30], stem: [30, 30, 35], mark: [5, 60, 45] }, marks = {};
      if (f === 'Convolvulaceae') { leaf = 'heart'; flower = 'trumpet'; pal.flower = x.pick('cvf', [[300, 45, 62], [42, 15, 92], [210, 55, 60], [330, 50, 62]]); }
      if (f === 'Fabaceae') { leaf = 'compound'; flower = 'pea'; pal.flower = x.pick('fvf', [[300, 40, 60], [270, 40, 58], [42, 15, 92], [340, 50, 60]]); marks.tendrils = 1; }
      if (f === 'Vitaceae') { leaf = /Parthenocissus/.test(x.genus) ? 'palmate' : 'lobed'; flower = 'grapes'; if (/Parthenocissus|creeper/i.test(x.genus + x.name)) { flower = 'berries'; pal.fruit = [230, 30, 25]; marks.autumn = 1; } }
      if (f === 'Cucurbitaceae') { leaf = 'lobed'; flower = 'cup'; pal.flower = [50, 80, 60]; marks.tendrils = 1; }
      if (f === 'Passifloraceae') { leaf = 'lobed'; flower = 'passion'; pal.flower = [270, 35, 65]; marks.tendrils = 1; }
      if (f === 'Bignoniaceae') { leaf = 'compound'; flower = 'trumpet'; pal.flower = [18, 75, 52]; }
      if (f === 'Caprifoliaceae') { leaf = 'oval'; flower = 'tube'; pal.flower = [5, 65, 50]; }
      if (f === 'Ranunculaceae') { leaf = 'compound'; flower = 'star'; pal.flower = [42, 15, 92]; }
      if (f === 'Smilacaceae') { leaf = 'heart'; flower = 'berries'; pal.fruit = [230, 30, 22]; marks.thorns = 1; }
      if (f === 'Apocynaceae') { leaf = 'heart'; flower = 'star'; pal.flower = [42, 20, 90]; }
      if (f === 'Anacardiaceae') { leaf = 'compound'; flower = 'berries'; pal.fruit = [45, 20, 85]; }
      if (f === 'Aristolochiaceae') { leaf = 'heart'; flower = 'pipe'; pal.flower = [300, 30, 30]; }
      const tw = base(x, 'vine', pal); tw.parts = { leaf, flower }; tw.p = { height: 1, leafSize: 1 }; tw.marks = marks; tw.pose = 'climb'; tw.size = 'm';
      plantColors(x, tw, 'flower');
      props(x, tw, ['height', 'leafSize'], 0.12); jitterColors(x, tw, 10, 6);
      return tw;
    },
  });

  def('aquatic', {
    skeleton: 'plant', regions: { flower: 0.35, leaf: 0.5, mark: 0.15 }, nudge: { marks: ['flowers', 'spots'], parts: { kind: ['lily', 'reed', 'floating', 'emergent'] }, p: ['height', 'leafSize'] },
    derive(x) {
      const f = x.fam, g = x.genus;
      let kind = x.pick('ak', ['lily', 'emergent', 'floating']), pal = { leaf: [110, 35, 38], flower: [42, 15, 92], water: [200, 40, 60], mark: [52, 75, 60] };
      if (f === 'Nymphaeaceae' || f === 'Nelumbonaceae' || f === 'Cabombaceae') { kind = 'lily'; pal.flower = /Nuphar/.test(g) ? [50, 80, 58] : /Nelumbo/.test(g) ? [48, 60, 75] : [42, 15, 94]; }
      if (f === 'Typhaceae') kind = 'cattail';
      if (f === 'Pontederiaceae') { kind = 'emergent'; pal.flower = [255, 45, 60]; }
      if (f === 'Alismataceae') { kind = 'arrow'; pal.flower = [42, 15, 94]; }
      if (f === 'Araceae') { kind = /Pistia/.test(g) ? 'floating' : 'arum'; pal.flower = /Orontium|Lysichiton/.test(g) ? [50, 80, 58] : [42, 15, 92]; }
      if (f === 'Lemnaceae' || f === 'Salviniaceae') kind = 'floating';
      if (f === 'Potamogetonaceae' || f === 'Hydrocharitaceae' || f === 'Haloragaceae' || f === 'Ceratophyllaceae') kind = 'submerged';
      if (f === 'Poaceae' || f === 'Cyperaceae' || f === 'Juncaceae') kind = 'reed';
      if (f === 'Menyanthaceae') { kind = 'lily'; pal.flower = [48, 75, 62]; }
      const tw = base(x, 'aquatic', pal); tw.parts = { kind }; tw.p = { height: 1, leafSize: 1 }; tw.marks = {}; tw.pose = 'stand'; tw.size = 'm';
      plantColors(x, tw, 'flower');
      props(x, tw, ['height', 'leafSize'], 0.12); jitterColors(x, tw, 8, 5);
      return tw;
    },
  });

  // ---------- public: derive ----------

  function finishColors(tw) {
    for (const k of Object.keys(tw.col)) {
      const c = tw.col[k];
      // The game's flat, muted range: nothing neon, nothing pure black or white.
      tw.col[k] = [Math.round(((c[0] % 360) + 360) % 360), Math.round(clamp(c[1], 0, 82)), Math.round(clamp(c[2], 12, 94))];
    }
  }
  function deepMerge(a, b) {
    for (const [k, v] of Object.entries(b || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v)) a[k] = deepMerge(a[k] && typeof a[k] === 'object' ? a[k] : {}, v);
      else a[k] = Array.isArray(v) ? v.slice() : v;
    }
    return a;
  }

  // A species' tweak set from its catalog entry. Deterministic; null for guilds that are never drawn.
  ST.derive = function (e) {
    const tpl = templateFor(e);
    if (!tpl || !TPL[tpl]) return null;
    const x = ctx(e);
    const tw = TPL[tpl].derive(x);
    for (const k of Object.keys(tw.marks)) if (!tw.marks[k]) delete tw.marks[k];
    for (const k of Object.keys(tw.p)) tw.p[k] = r1(tw.p[k]);
    if (e.tweaks) { deepMerge(tw, e.tweaks); tw.pinned = true; }
    finishColors(tw);
    return tw;
  };

  // ---------- look-alike distance ----------

  function hslToLab(c) {
    const h = c[0] / 360, s = c[1] / 100, l = c[2] / 100;
    const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    const lin = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const r = lin(f(0)), g = lin(f(8)), b = lin(f(4));
    const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const t = v => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
  }
  ST.deltaE = function (a, b) { const p = hslToLab(a), q = hslToLab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

  // Weights: a differing template is a different animal outright; parts, proportions, colours and marks add up.
  const W = { part: 0.3, prop: 0.6, colour: 1 / 40, mark: 0.3, pose: 0.25 };
  ST.distance = function (a, b) {
    if (a.tpl !== b.tpl) return 2;
    const T0 = TPL[a.tpl];
    let d = 0;
    for (const k of new Set(Object.keys(a.parts).concat(Object.keys(b.parts)))) if (a.parts[k] !== b.parts[k]) d += k === 'count' ? W.part * 0.3 : W.part;
    if (a.pose !== b.pose) d += W.pose;
    for (const k of new Set(Object.keys(a.p).concat(Object.keys(b.p)))) d += W.prop * Math.abs(Math.log((a.p[k] || 1) / (b.p[k] || 1))) / Math.max(1, Object.keys(a.p).length / 3);
    const regions = T0.regions;
    const hasMarks = Object.keys(a.marks).length + Object.keys(b.marks).length > 0;
    for (const [k, w] of Object.entries(regions)) {
      if (k === 'mark' && !hasMarks) continue;
      const ca = a.col[k], cb = b.col[k];
      if (ca && cb) d += w * Math.min(60, ST.deltaE(ca, cb)) * W.colour;
    }
    for (const k of new Set(Object.keys(a.marks).concat(Object.keys(b.marks)))) d += W.mark * Math.min(1, Math.abs((a.marks[k] || 0) - (b.marks[k] || 0)));
    return d;
  };

  // Stricter bar for candidates for the same slot (sharing a role), since they're drawn side by side.
  ST.THRESHOLD = 0.5;
  ST.SLOT_THRESHOLD = 0.7;
  const BROAD = new Set(['any animal']);
  function sameSlot(a, b) { return (a.roles || []).some(r => !BROAD.has(r) && (b.roles || []).includes(r)); }
  ST.thresholdFor = (ea, eb) => (sameSlot(ea, eb) ? ST.SLOT_THRESHOLD : ST.THRESHOLD);

  // ---------- separation ----------

  // One deterministic nudge, step k, moving tw away from the look-alike `other`.
  function nudge(tw, other, k, x) {
    const T0 = TPL[tw.tpl], N = T0.nudge || { marks: [], parts: {}, p: [] };
    // Markings and proportions first, colour last, so a nudged species stays plausible for its group.
    const step = [1, 4, 3, 2, 5, 0][k % 6], round = Math.floor(k / 6);
    const main = Object.keys(T0.regions)[0];
    if (step === 0) {
      // Rotate the main region's hue (and lift or drop its lightness) away from the other species.
      const dir = x.h('nd' + k) < 0.5 ? 1 : -1;
      const c = tw.col[main];
      const oc = other.col[main] || c;
      const light = c[2] < 50 ? 1 : -1;
      tw.col[main] = [(c[0] + dir * (50 + 20 * round) + 360) % 360, clamp(Math.max(c[1], 35), 0, 80), clamp(c[2] + light * (oc[2] > c[2] ? -10 : 10), 18, 88)];
    } else if (step === 1) {
      const opts = (N.marks || []).filter(m => !tw.marks[m] && !other.marks[m]);
      if (opts.length) tw.marks[opts[Math.floor(x.h('nm' + k) * opts.length)]] = 1;
      else { const on = N.marks.filter(m => tw.marks[m]); if (on.length) delete tw.marks[on[0]]; }
    } else if (step === 2) {
      const c = tw.col[main], oc = other.col[main] || c;
      tw.col[main] = [c[0], c[1], clamp(c[2] + (c[2] >= oc[2] ? 20 : -20), 15, 90)];
    } else if (step === 3) {
      const parts = Object.entries(N.parts || {});
      if (parts.length) {
        const [part, opts] = parts[Math.floor(x.h('np' + k) * parts.length)];
        const choices = opts.filter(o => o !== tw.parts[part] && o !== other.parts[part]);
        if (choices.length) tw.parts[part] = choices[Math.floor(x.h('npo' + k) * choices.length)];
      }
    } else if (step === 4) {
      const ps = N.p || [];
      if (ps.length) { const pk = ps[Math.floor(x.h('npp' + k) * ps.length)]; const up = (tw.p[pk] || 1) >= (other.p[pk] || 1); tw.p[pk] = r1(clamp((tw.p[pk] || 1) * (up ? 1.3 : 0.77), 0.3, 2.6)); }
    } else {
      // A second region: the markings' colour, or failing that the next region.
      const key = tw.col.mark ? 'mark' : Object.keys(T0.regions)[1];
      const c = tw.col[key];
      if (c) tw.col[key] = [(c[0] + 120) % 360, clamp(Math.max(c[1], 40), 0, 80), c[2] < 45 ? 70 : 25];
      if (key === 'mark' && !Object.keys(tw.marks).length && (N.marks || []).length) tw.marks[N.marks[0]] = 1;
    }
    finishColors(tw);
  }

  // Tweak sets for a whole catalog, with look-alikes separated. Memoized per catalog build.
  const memo = new Map();
  ST.forCatalog = function (cat, opts) {
    opts = opts || {};
    const mk = cat.code + '|' + (cat.built || '') + '|' + (cat.species || []).length;
    if (!opts.fresh && memo.has(mk)) return memo.get(mk);
    const entries = (cat.species || []).concat(Object.values(T.DOMESTIC || {}));
    const byKey = new Map(), list = [];
    const stats = { species: entries.length, drawn: 0, fallback: 0, collisions: 0, separated: 0, nudges: 0, unresolved: [] };
    for (const e of entries) {
      const tw = ST.derive(e);
      if (!tw) { stats.fallback++; continue; }
      stats.drawn++;
      list.push({ e, tw });
      byKey.set(String(e.key), tw);
    }
    const byTpl = {};
    for (const it of list) (byTpl[it.tw.tpl] = byTpl[it.tw.tpl] || []).push(it);
    for (const group of Object.values(byTpl)) {
      for (let i = 1; i < group.length; i++) {
        const A = group[i];
        const x = ctx(A.e);
        let tries = 0, hit;
        const firstHit = () => { for (let j = 0; j < i; j++) { const B = group[j]; if (ST.distance(A.tw, B.tw) < ST.thresholdFor(A.e, B.e)) return B; } return null; };
        hit = firstHit();
        if (!hit) continue;
        stats.collisions++;
        if (A.tw.pinned) { stats.unresolved.push([A.e, hit.e]); continue; }
        while (hit && tries < 24) { nudge(A.tw, hit.tw, tries, x); tries++; hit = firstHit(); }
        stats.nudges += tries;
        A.tw.sep = tries;
        if (hit) stats.unresolved.push([A.e, hit.e]); else stats.separated++;
      }
    }
    const res = { byKey, stats, list };
    memo.set(mk, res);
    return res;
  };

  // The tweak set for one species of a catalog (separated against its catalog-mates).
  ST.forSpecies = function (e, cat) {
    if (cat) { const tw = ST.forCatalog(cat).byKey.get(String(e.key)); if (tw) return JSON.parse(JSON.stringify(tw)); }
    return ST.derive(e);
  };

  // Every pair in a catalog closer than its threshold (after separation). The check tool's verdict.
  ST.lookalikes = function (res) {
    const out = [];
    const byTpl = {};
    for (const it of res.list) (byTpl[it.tw.tpl] = byTpl[it.tw.tpl] || []).push(it);
    for (const group of Object.values(byTpl)) for (let i = 0; i < group.length; i++) for (let j = 0; j < i; j++) {
      const d = ST.distance(group[i].tw, group[j].tw), thr = ST.thresholdFor(group[i].e, group[j].e);
      if (d < thr) out.push({ a: group[j].e, b: group[i].e, d, thr });
    }
    return out;
  };
})(window.Trophic);
