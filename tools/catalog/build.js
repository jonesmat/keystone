// Keystone — ecoregion species catalog builder (Phase 3, P3-M4). Runs offline in Node; the game only reads its output.
//   node tools/catalog/build.js <Level II or III code | all> [--quota-scale 1] [--refresh]
//   e.g. node tools/catalog/build.js 9.3            (Level II: West-Central Semi-Arid Prairies)
//        node tools/catalog/build.js 9.4.6 --quota-scale 1.6   (Level III: Edwards Plateau, a richer catalog)
// Writes js/catalogs/<code>.js (a static script, so the game still runs from file://). Every download is cached under
// tools/catalog/cache/ (git-ignored), so rebuilding is cheap and repeatable.
//
// Sources, all openly licensed and credited in each catalog:
//   EPA/CEC ecoregions, Level III polygons grouped by NA_L2CODE (U.S. EPA, public domain)
//   GBIF occurrence records → which species occur in the ecoregion, and how widely (GBIF.org, CC0/CC-BY data)
//   GBIF backbone taxonomy → names, common names, IUCN Red List category
//   GRIIS United States (Contiguous) 2022 → introduced animals (Pagad et al., via GBIF, CC-BY)
//   EltonTraits 1.0 → bird and mammal body mass, diet and foraging (Wilman et al. 2014, CC0)
//   USDA PLANTS → plant growth habit, duration and lower-48 native status (USDA NRCS, public domain)
//   Open-Meteo historical archive → 1991–2020 climate normals (ERA5, CC-BY 4.0)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const CACHE = path.join(__dirname, 'cache');
const OUT = path.join(ROOT, 'js', 'catalogs');
const EPA = 'https://gispub.epa.gov/arcgis/rest/services/ORD/USEPA_Ecoregions_Level_III_and_IV/MapServer/11';
const GBIF = 'https://api.gbif.org/v1';
const GRIIS_US = '32ad19ed-6b89-447a-9242-795c0897f345';
const ELTON = { bird: 'https://ndownloader.figshare.com/files/5631081', mammal: 'https://ndownloader.figshare.com/files/5631084' };

const args = process.argv.slice(2);
const opt = { code: args[0], quotaScale: 1, refresh: false };
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--refresh') opt.refresh = true;
  else if (args[i] === '--quota-scale') opt.quotaScale = +args[++i];
}
if (!opt.code) { console.error('usage: node tools/catalog/build.js <Level II code | all>'); process.exit(1); }

// Taxon groups queried per cell, with how many species each contributes to a catalog (about 300 in all).
// Keys are GBIF backbone taxa; reptiles and ray-finned fish are split across several keys in the backbone.
const GROUPS = [
  { id: 'plant', keys: [7707728], quota: 110, facet: 600 },
  { id: 'insect', keys: [216], quota: 60, facet: 600 },
  { id: 'arachnid', keys: [367], quota: 6, facet: 100 },
  { id: 'crustacean', keys: [229], quota: 4, facet: 100 },
  { id: 'worm', keys: [255], quota: 3, facet: 100 },
  { id: 'snail', keys: [225], quota: 3, facet: 100 },
  { id: 'bird', keys: [212], quota: 60, facet: 400 },
  { id: 'mammal', keys: [359], quota: 35, facet: 200 },
  { id: 'reptile', keys: [11592253, 11418114, 11493978], quota: 12, facet: 100 },
  { id: 'amphibian', keys: [131], quota: 8, facet: 100 },
  { id: 'fish', keys: [1153, 1313, 708, 548, 547, 587], quota: 12, facet: 100 },
];

// ---------- fetching with a disk cache ----------

fs.mkdirSync(CACHE, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cachePath = key => path.join(CACHE, crypto.createHash('sha1').update(key).digest('hex').slice(0, 20) + '.json');
let requests = 0, cached = 0;

// Public APIs throttle and time out under load: back off exponentially (up to a minute) before giving up.
async function fetchWithRetry(url, asText) {
  let last = '';
  for (let attempt = 0; attempt < 9; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Keystone ecology game catalog builder (github.com/jonesmat/keystone)' },
        signal: AbortSignal.timeout(60000) });
      if (r.status === 429 || r.status >= 500) { last = 'HTTP ' + r.status; await sleep(Math.min(60000, 2000 * 2 ** attempt)); continue; }
      if (!r.ok) return null;
      return asText ? await r.text() : await r.json();
    } catch (e) {
      last = e.name + ': ' + e.message;
      await sleep(Math.min(60000, 2000 * 2 ** attempt));
    }
  }
  throw new Error('failed after retries (' + last + '): ' + url);
}

async function getJSON(url) {
  const p = cachePath(url);
  if (!opt.refresh && fs.existsSync(p)) { cached++; return JSON.parse(fs.readFileSync(p, 'utf8')); }
  requests++;
  const j = await fetchWithRetry(url, false);
  fs.writeFileSync(p, JSON.stringify(j));
  return j;
}

async function getFile(url, name) {
  const p = path.join(CACHE, name);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'latin1');
  requests++;
  const r = await fetch(url);
  if (!r.ok) throw new Error('download failed ' + url);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(p, buf);
  return buf.toString('latin1');
}

// Run async jobs with limited concurrency (be polite to the public APIs).
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const k = next++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// ---------- geometry ----------

// Level II codes have two parts (9.4); Level III codes have three (9.4.6, the Edwards Plateau).
const isLevel3 = code => code.split('.').length === 3;

async function ecoregionGeometry(code) {
  const feats = [];
  const field = isLevel3(code) ? 'NA_L3CODE' : 'NA_L2CODE';
  for (let offset = 0; ; offset += 1000) {
    const url = EPA + '/query?where=' + encodeURIComponent(field + "='" + code + "'") +
      '&outFields=US_L3CODE,US_L3NAME,NA_L2NAME&returnGeometry=true&outSR=4326&maxAllowableOffset=0.03&geometryPrecision=3' +
      '&resultOffset=' + offset + '&resultRecordCount=1000&f=geojson';
    const j = await getJSON(url);
    if (!j || !j.features) throw new Error('no geometry for ' + code);
    feats.push(...j.features);
    if (!j.exceededTransferLimit && !(j.properties && j.properties.exceededTransferLimit)) break;
  }
  if (!feats.length) throw new Error('no ecoregion ' + code);
  const polys = [];
  for (const f of feats) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') polys.push(g.coordinates);
    else if (g.type === 'MultiPolygon') polys.push(...g.coordinates);
  }
  const l3 = [...new Set(feats.map(f => f.properties.US_L3CODE + ' ' + f.properties.US_L3NAME))].sort();
  return { name: isLevel3(code) ? feats[0].properties.US_L3NAME : feats[0].properties.NA_L2NAME, level: isLevel3(code) ? 3 : 2,
    parent: isLevel3(code) ? code.split('.').slice(0, 2).join('.') : null, polys, l3 };
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolys(x, y, polys) {
  for (const p of polys) {
    if (!inRing(x, y, p[0])) continue;
    let hole = false;
    for (let h = 1; h < p.length; h++) if (inRing(x, y, p[h])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
}

// Grid cells over the ecoregion, each with the share of it that lies inside (from a 4×4 sample).
function cellsFor(polys) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  for (const p of polys) for (const [x, y] of p[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (const size of [0.5, 1, 1.5, 2, 3, 4]) {
    const cells = [];
    for (let x = Math.floor(x0 / size) * size; x < x1; x += size) for (let y = Math.floor(y0 / size) * size; y < y1; y += size) {
      let hit = 0;
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (inPolys(x + (a + 0.5) * size / 4, y + (b + 0.5) * size / 4, polys)) hit++;
      if (hit >= 3) cells.push({ x, y, size, share: hit / 16 });
    }
    if (cells.length <= 45) return cells;
  }
  throw new Error('ecoregion too large for the grid');
}
const wkt = c => {
  const r = v => +v.toFixed(3);
  const a = r(c.x), b = r(c.y), cc = r(c.x + c.size), d = r(c.y + c.size);
  return 'POLYGON((' + a + ' ' + b + ',' + cc + ' ' + b + ',' + cc + ' ' + d + ',' + a + ' ' + d + ',' + a + ' ' + b + '))';
};

// ---------- occurrences ----------

// At-risk species (IUCN NT, VU, EN, CR) recorded in the ecoregion, by group: a second, filtered pass per cell, so a
// localised endangered species (the Golden-cheeked Warbler) is a candidate even if it isn't among the most widespread.
async function threatenedTallies(cells) {
  const out = {};
  for (const g of GROUPS) out[g.id] = new Map();
  const jobs = [];
  for (const c of cells) for (const g of GROUPS) jobs.push({ c, g });
  await pool(jobs, 3, async ({ c, g }) => {
    const url = GBIF + '/occurrence/search?geometry=' + encodeURIComponent(wkt(c)) + g.keys.map(k => '&taxonKey=' + k).join('') +
      '&iucnRedListCategory=NT&iucnRedListCategory=VU&iucnRedListCategory=EN&iucnRedListCategory=CR' +
      '&country=US&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&year=1980,2025&limit=0&facet=speciesKey&facetLimit=50';
    const j = await getJSON(url);
    for (const { name, count } of (j && j.facets && j.facets[0] && j.facets[0].counts) || []) {
      const t = out[g.id].get(name) || { count: 0, cells: 0, weight: 0 };
      t.count += count; t.cells++; t.weight += c.share;
      out[g.id].set(name, t);
    }
  });
  return out;
}

// Share of a species' GBIF records that are in the United States. Animals that aren't established aliens (GRIIS)
// and are rarely recorded here are captive or ranch exotics (addax, oryx, zebra on Hill Country game ranches).
async function usShare(key) {
  const j = await getJSON(GBIF + '/occurrence/search?taxonKey=' + key + '&limit=0&facet=country&facetLimit=200');
  const counts = (j && j.facets && j.facets[0] && j.facets[0].counts) || [];
  const total = counts.reduce((a, c) => a + c.count, 0);
  const us = (counts.find(c => c.name === 'US') || { count: 0 }).count;
  return total ? us / total : 0;
}

async function occurrenceTallies(cells) {
  const tallies = {};   // group id -> speciesKey -> { count, cells, weight }
  for (const g of GROUPS) tallies[g.id] = new Map();
  const jobs = [];
  for (const c of cells) for (const g of GROUPS) jobs.push({ c, g });
  let done = 0;
  await pool(jobs, 3, async ({ c, g }) => {
    // Several taxon keys (reptiles, fish) go in one query: GBIF ORs repeated taxonKey parameters.
    const url = GBIF + '/occurrence/search?geometry=' + encodeURIComponent(wkt(c)) + g.keys.map(k => '&taxonKey=' + k).join('') +
      '&country=US&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&year=1980,2025&limit=0&facet=speciesKey&facetLimit=' + g.facet;
    const j = await getJSON(url);
    const counts = (j && j.facets && j.facets[0] && j.facets[0].counts) || [];
    const m = tallies[g.id];
    for (const { name, count } of counts) {
      const t = m.get(name) || { count: 0, cells: 0, weight: 0 };
      t.count += count; t.cells++; t.weight += c.share;
      m.set(name, t);
    }
    if (++done % 50 === 0) console.log('  occurrences ' + done + '/' + jobs.length);
  });
  return tallies;
}

// ---------- names, status, traits ----------

async function speciesInfo(key) {
  const s = await getJSON(GBIF + '/species/' + key);
  if (!s || !s.canonicalName) return null;
  // Common names: ITIS first (the backbone's default is often an odd regional or subspecies name), then any plain
  // English name, then the backbone's. Plants and birds are overridden later by USDA and EltonTraits names.
  const v = await getJSON(GBIF + '/species/' + key + '/vernacularNames?limit=100');
  const eng = ((v && v.results) || []).filter(x => x.language === 'eng' && x.vernacularName && !/[()]/.test(x.vernacularName));
  // The name most sources agree on wins (ITIS, then Catalogue of Life, break ties): one source's first-listed name
  // is often a colour morph or regional form ("Cross Fox" for the red fox).
  const votes = new Map();
  for (const x of eng) {
    const k = x.vernacularName.trim().toLowerCase();
    const w = 1 + (/Integrated Taxonomic|ITIS/i.test(x.source || '') ? 0.5 : 0) + (/Catalogue of Life/i.test(x.source || '') ? 0.25 : 0);
    const o = votes.get(k) || { name: x.vernacularName.trim(), w: 0 };
    o.w += w;
    votes.set(k, o);
  }
  const best = [...votes.values()].sort((a, b) => b.w - a.w)[0];
  let common = best ? best.name : s.vernacularName || null;
  const iucn = await getJSON(GBIF + '/species/' + key + '/iucnRedListCategory');
  return {
    key: +key, sci: s.canonicalName, common: common ? common[0].toUpperCase() + common.slice(1) : null,
    kingdom: s.kingdom, klass: s.class, order: s.order, family: s.family, genus: s.genus, rank: s.rank,
    iucn: (iucn && iucn.code) || null,
  };
}

let griis = null;
async function introducedSet() {
  if (griis) return griis;
  griis = new Set();
  for (let offset = 0; ; offset += 1000) {
    const j = await getJSON(GBIF + '/species/search?datasetKey=' + GRIIS_US + '&limit=1000&offset=' + offset);
    for (const r of j.results) { if (r.nubKey) griis.add(r.nubKey); if (r.canonicalName) griis.add(r.canonicalName); }
    if (j.endOfRecords || !j.results.length) break;
  }
  return griis;
}

let elton = null;
async function eltonTraits() {
  if (elton) return elton;
  elton = { bird: new Map(), mammal: new Map() };
  for (const k of ['bird', 'mammal']) {
    const txt = await getFile(ELTON[k], 'elton-' + k + '.txt');
    const lines = txt.split(/\r?\n/).filter(Boolean);
    const head = lines[0].split('\t');
    for (const line of lines.slice(1)) {
      const cells = line.split('\t'), o = {};
      head.forEach((h, i) => (o[h] = cells[i]));
      if (o.Scientific) elton[k].set(o.Scientific.trim(), o);
    }
  }
  return elton;
}

// EltonTraits (2014) uses older names for many species (Dendroica chrysoparia for the Golden-cheeked Warbler, now
// Setophaga): try the current name, then GBIF synonyms, then the same epithet within the family, and finally the
// family's average traits, so renamed species are kept rather than dropped.
const familyAvg = { bird: new Map(), mammal: new Map() };
async function eltonFor(group, info) {
  const map = elton[group];
  if (!map) return null;
  let r = map.get(info.sci);
  if (r) return r;
  const syn = await getJSON(GBIF + '/species/' + info.key + '/synonyms?limit=50');
  for (const x of (syn && syn.results) || []) { r = map.get(x.canonicalName); if (r) return Object.assign({}, r, { _via: 'synonym ' + x.canonicalName }); }
  const fam = group === 'bird' ? 'BLFamilyLatin' : 'MSWFamilyLatin';
  const epithet = info.sci.split(' ')[1];
  const same = [...map.values()].filter(o => o[fam] === info.family && (o.Scientific || '').split(' ')[1] === epithet);
  if (same.length === 1) return Object.assign({}, same[0], { _via: 'epithet match ' + same[0].Scientific });
  return familyAverage(group, info.family);
}
function familyAverage(group, family) {
  const cache = familyAvg[group];
  if (cache.has(family)) return cache.get(family);
  const fam = group === 'bird' ? 'BLFamilyLatin' : 'MSWFamilyLatin';
  const rows = [...elton[group].values()].filter(o => o[fam] === family);
  let out = null;
  if (rows.length) {
    out = { _via: 'family average (' + family + ')' };
    const numeric = Object.keys(rows[0]).filter(k => /^(Diet-(Inv|Vend|Vect|Vfish|Vunk|Scav|Fruit|Nect|Seed|PlantO)|ForStrat-(wat|ground|under|mid|canopy|aerial)|BodyMass-Value)/.test(k));
    for (const k of numeric) out[k] = String(rows.reduce((a, o) => a + (+o[k] || 0), 0) / rows.length);
    for (const k of ['Nocturnal', 'Activity-Nocturnal', 'Activity-Crepuscular', 'Activity-Diurnal', 'ForStrat-Value']) {
      const votes = {};
      for (const o of rows) votes[o[k]] = (votes[o[k]] || 0) + 1;
      out[k] = Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
    }
  }
  cache.set(family, out);
  return out;
}

// Whether a species' native range (GBIF distributions, largely from IUCN) includes North America. Species with no
// distribution data count as native to where they're recorded.
async function nativeToNorthAmerica(key) {
  const d = await getJSON(GBIF + '/species/' + key + '/distributions?limit=300');
  const rows = (d && d.results) || [];
  if (!rows.length) return true;
  return rows.some(r => /United States|U\.S\.A|North America|Nearctic|Canada|Mexico|Texas|^US$|^CA$|^MX$/i.test((r.locality || '') + ' ' + (r.country || '')) &&
    !/introduced|alien|naturali[sz]ed/i.test((r.establishmentMeans || '') + ' ' + (r.status || '')));
}

async function usdaPlant(sci) {
  const hits = await getJSON('https://plantsservices.sc.egov.usda.gov/api/PlantSearch?searchText=' + encodeURIComponent(sci));
  const strip = t => (t || '').replace(/<[^>]+>/g, '').trim();
  const hit = (hits || []).map(h => h.Plant).find(p => p && p.Rank === 'Species' && strip(p.ScientificName).startsWith(sci));
  if (!hit) return null;
  const p = await getJSON('https://plantsservices.sc.egov.usda.gov/api/PlantProfile?symbol=' + hit.Symbol);
  if (!p) return null;
  // Lower-48 status can list both native and introduced (native and introduced strains of one species).
  const l48 = (p.NativeStatuses || []).filter(s => s.Region === 'L48').map(s => s.Status);
  return { symbol: hit.Symbol, habits: p.GrowthHabits || [], durations: p.Durations || [], nativeN: l48.includes('N'), introducedI: l48.includes('I'),
    known: l48.length > 0, common: p.CommonName || hit.CommonName || null };
}

// ---------- classification into game terms ----------

const ACTINORHIZAL = new Set(['Alnus', 'Ceanothus', 'Shepherdia', 'Purshia', 'Elaeagnus', 'Myrica', 'Morella', 'Cercocarpus', 'Dryas', 'Casuarina', 'Comptonia']);
const AQUATIC_FAMILIES = new Set(['Nymphaeaceae', 'Potamogetonaceae', 'Typhaceae', 'Lemnaceae', 'Alismataceae', 'Pontederiaceae', 'Haloragaceae', 'Ceratophyllaceae', 'Hydrocharitaceae', 'Nelumbonaceae', 'Zosteraceae']);
const DUNG = new Set(['Onthophagus', 'Phanaeus', 'Canthon', 'Aphodius', 'Copris', 'Ateuchus', 'Dichotomius', 'Melanocanthon', 'Deltochilum']);
const BEES = new Set(['Apidae', 'Halictidae', 'Megachilidae', 'Andrenidae', 'Colletidae', 'Melittidae']);
const RAPTORS = new Set(['Accipitridae', 'Falconidae', 'Strigidae', 'Tytonidae', 'Pandionidae']);
const WATERBIRDS = new Set(['Anatidae', 'Ardeidae', 'Rallidae', 'Podicipedidae', 'Laridae', 'Gaviidae', 'Phalacrocoracidae', 'Pelecanidae', 'Scolopacidae', 'Charadriidae', 'Recurvirostridae', 'Threskiornithidae', 'Gruidae', 'Ciconiidae', 'Anhingidae']);
const MESO = new Set(['Canidae', 'Mustelidae', 'Procyonidae', 'Mephitidae', 'Felidae', 'Didelphidae', 'Ursidae']);

// Plants: growth habit and roles from USDA, falling back on family for anything USDA doesn't have.
function classifyPlant(info, usda) {
  const habits = (usda && usda.habits) || [];
  let habit = 'forb';
  if (habits.includes('Tree')) habit = 'tree';
  else if (habits.includes('Shrub') || habits.includes('Subshrub')) habit = 'shrub';
  else if (habits.includes('Vine')) habit = 'vine';
  else if (habits.includes('Graminoid') || ['Poaceae', 'Cyperaceae', 'Juncaceae'].includes(info.family)) habit = 'grass';
  if (AQUATIC_FAMILIES.has(info.family)) habit = 'aquatic';
  const fixer = info.family === 'Fabaceae' || ACTINORHIZAL.has(info.genus);
  const roles = [habit === 'grass' ? 'grass' : habit];
  if (fixer) roles.push('legume');
  const kind = { grass: 'ground', forb: 'ground', shrub: 'tall', tree: 'woody', vine: 'vine', aquatic: 'aquatic' }[habit];
  return { level: 'producer', habit, kind, fixer, roles, taxon: habit, perennial: !usda || (usda.durations || []).includes('Perennial') };
}

// Animals: diet and mass from EltonTraits for birds and mammals; defaults by order and family for the rest
// (flagged as defaults, so the Codex can say so).
function classifyAnimal(info, group, et) {
  let mass = null, plant = 0, meat = 0, scav = 0, nectar = 0, inv = 0, source = 'taxon default', activity = null, strata = null;
  if (et) {
    source = 'EltonTraits 1.0' + (et._via ? ' (' + et._via + ')' : '');
    mass = +et['BodyMass-Value'] / 1000;
    // A few EltonTraits rows lack a body mass: fall back on a typical songbird or small mammal.
    if (!isFinite(mass) || mass <= 0) { mass = group === 'bird' ? 0.03 : 0.1; source = 'EltonTraits 1.0 (mass: group default)'; }
    const n = k => +et[k] || 0;
    plant = n('Diet-Fruit') + n('Diet-Nect') + n('Diet-Seed') + n('Diet-PlantO');
    nectar = n('Diet-Nect');
    meat = n('Diet-Inv') + n('Diet-Vend') + n('Diet-Vect') + n('Diet-Vfish') + n('Diet-Vunk');
    scav = n('Diet-Scav');
    inv = n('Diet-Inv');
    const tot = plant + meat + scav || 100;
    plant /= tot; meat /= tot; scav /= tot; nectar /= tot; inv /= tot;
    if (group === 'bird') {
      activity = et['Nocturnal'] === '1' ? 'nocturnal' : 'diurnal';
      const fs = { water: n('ForStrat-watbelowsurf') + n('ForStrat-wataroundsurf'), ground: n('ForStrat-ground'), understory: n('ForStrat-understory'),
        midstory: n('ForStrat-midhigh'), canopy: n('ForStrat-canopy'), air: n('ForStrat-aerial') };
      strata = Object.keys(fs).sort((a, b) => fs[b] - fs[a])[0];
    } else {
      activity = et['Activity-Nocturnal'] === '1' ? 'nocturnal' : et['Activity-Crepuscular'] === '1' ? 'crepuscular' : 'diurnal';
      strata = { G: 'ground', S: 'understory', Ar: 'canopy', A: 'air', M: 'water' }[et['ForStrat-Value']] || 'ground';
    }
  } else {
    const d = animalDefaults(info, group);
    if (!d) return null;
    ({ mass, plant, meat, scav } = d);
    nectar = d.nectar || 0;
    // Small predators without trait data (spiders, lizards, frogs, predatory insects) eat invertebrates.
    inv = d.inv != null ? d.inv : mass < 0.1 ? meat : 0;
    strata = d.strata || 'ground';
  }
  let level = meat + scav < 0.3 ? 'herbivore' : meat + scav < 0.7 ? 'omnivore' : 'carnivore1';
  const decomposerGuild = ['worm', 'crustacean'].includes(group) && strata !== 'water' ? true : group === 'insect' && (DUNG.has(info.genus) || ['Silphidae', 'Calliphoridae', 'Sarcophagidae'].includes(info.family));
  if (decomposerGuild) level = 'decomposer';
  const apex = level === 'carnivore1' && ((group === 'mammal' && mass >= 20) || info.order === 'Crocodylia' || info.genus === 'Esox' || (group === 'bird' && mass >= 3 && RAPTORS.has(info.family)));
  if (apex) level = 'carnivore2';
  const roles = [];
  const small = mass < 0.02;
  if (group === 'mammal') {
    if (level === 'herbivore' && mass >= 20) roles.push('large grazer');
    else if (level === 'herbivore') roles.push('small herbivore', 'small mammal');
    if (['Rodentia', 'Eulipotyphla', 'Soricomorpha'].includes(info.order) && level !== 'herbivore') roles.push('small mammal');
    if (info.order === 'Chiroptera') roles.push('insect predator', 'bat');
    if (MESO.has(info.family) && mass < 20 && level !== 'herbivore') roles.push('mesopredator');
    if (level === 'carnivore2') roles.push('apex predator');
  } else if (group === 'bird') {
    if (RAPTORS.has(info.family)) roles.push('raptor');
    else if (WATERBIRDS.has(info.family)) roles.push('waterbird');
    else if (info.family === 'Cathartidae' || scav >= 0.2) roles.push('scavenger');
    else roles.push('songbird');
    if (info.genus === 'Molothrus') roles.push('nest parasite');
    if (info.family === 'Trochilidae' || nectar >= 0.4) roles.push('pollinator');
    if (info.family === 'Corvidae') roles.push('scavenger');
  } else if (group === 'insect') {
    if (level === 'decomposer') roles.push(DUNG.has(info.genus) ? 'dung beetle' : 'carrion feeder', 'decomposer');
    else if (BEES.has(info.family) || info.order === 'Lepidoptera' || info.family === 'Syrphidae') roles.push('pollinator');
    else if (level === 'herbivore') roles.push('small herbivore', 'insect herbivore');
    else roles.push('insect predator');
  } else if (group === 'arachnid') roles.push('insect predator');
  else if (level === 'decomposer') roles.push('decomposer');
  else if (group === 'snail') roles.push('small herbivore');
  else if (group === 'reptile') roles.push(info.order === 'Testudines' || info.klass === 'Testudines' ? 'turtle' : 'reptile', 'insect predator');
  else if (group === 'amphibian') roles.push('amphibian', 'insect predator');
  else if (group === 'fish') roles.push('fish');
  else if (group === 'crustacean') roles.push('aquatic invertebrate');
  if (level === 'carnivore2' && !roles.includes('apex predator')) roles.push('apex predator');
  const taxon = animalTaxon(info, group);
  // Small, numerous taxa run as Populations; vertebrates stay individuals.
  const population = ['insect', 'arachnid', 'crustacean', 'worm', 'snail'].includes(group) || small && group === 'amphibian';
  return {
    level, roles, taxon, mass: +mass.toFixed(5), diet: { plant: +plant.toFixed(2), meat: +meat.toFixed(2), scav: +scav.toFixed(2), inv: +inv.toFixed(2), nectar: +nectar.toFixed(2) },
    endotherm: group === 'bird' || group === 'mammal', flight: group === 'bird' || info.order === 'Chiroptera' || (group === 'insect' && !['Orthoptera'].includes(info.order) && info.family !== 'Formicidae'),
    swim: group === 'fish' || (group === 'crustacean' && strata === 'water'), activity, strata, population, traits: source,
  };
}

function animalDefaults(info, group) {
  const f = info.family, o = info.order, g = info.genus;
  switch (group) {
    case 'insect': {
      if (o === 'Orthoptera') return { mass: 0.001, plant: 0.95, meat: 0.05, scav: 0 };
      if (o === 'Lepidoptera') return { mass: 0.0003, plant: 1, meat: 0, scav: 0, nectar: 0.8 };
      if (BEES.has(f)) return { mass: 0.0002, plant: 1, meat: 0, scav: 0, nectar: 0.8 };
      if (f === 'Formicidae') return { mass: 0.00001, plant: 0.4, meat: 0.4, scav: 0.2 };
      if (o === 'Hymenoptera') return { mass: 0.0001, plant: 0.2, meat: 0.8, scav: 0 };
      if (o === 'Coleoptera') {
        if (DUNG.has(g)) return { mass: 0.0005, plant: 0, meat: 0, scav: 1 };
        if (f === 'Silphidae') return { mass: 0.0006, plant: 0, meat: 0.1, scav: 0.9 };
        if (['Carabidae', 'Coccinellidae', 'Cicindelidae', 'Staphylinidae', 'Dytiscidae', 'Lampyridae'].includes(f)) return { mass: 0.0002, plant: 0.1, meat: 0.9, scav: 0 };
        return { mass: 0.0003, plant: 0.95, meat: 0.05, scav: 0 };
      }
      if (o === 'Diptera') {
        if (f === 'Syrphidae') return { mass: 0.00005, plant: 0.9, meat: 0.1, scav: 0, nectar: 0.8 };
        if (['Asilidae', 'Tachinidae', 'Dolichopodidae'].includes(f)) return { mass: 0.00005, plant: 0.1, meat: 0.9, scav: 0 };
        if (['Calliphoridae', 'Sarcophagidae'].includes(f)) return { mass: 0.00005, plant: 0, meat: 0, scav: 1 };
        if (['Culicidae', 'Ceratopogonidae', 'Tabanidae', 'Simuliidae'].includes(f)) return null;   // blood-feeders: out of scope
        return { mass: 0.00002, plant: 0.7, meat: 0.1, scav: 0.2 };
      }
      if (o === 'Hemiptera') {
        if (['Triatoma', 'Paratriatoma', 'Cimex'].includes(g)) return null;   // blood-feeders (kissing bugs, bed bugs): out of scope
        if (['Reduviidae', 'Nabidae', 'Belostomatidae', 'Notonectidae', 'Anthocoridae'].includes(f)) return { mass: 0.0001, plant: 0.1, meat: 0.9, scav: 0 };
        return { mass: 0.00005, plant: 1, meat: 0, scav: 0 };
      }
      if (['Odonata', 'Neuroptera', 'Mantodea', 'Megaloptera'].includes(o)) return { mass: 0.0005, plant: 0, meat: 1, scav: 0, strata: 'air' };
      if (['Ephemeroptera', 'Trichoptera', 'Plecoptera'].includes(o)) return { mass: 0.00005, plant: 0.8, meat: 0.1, scav: 0.1 };
      if (['Phthiraptera', 'Siphonaptera'].includes(o)) return null;
      return { mass: 0.0001, plant: 0.8, meat: 0.1, scav: 0.1 };
    }
    case 'arachnid':
      if (o === 'Araneae') return { mass: 0.0005, plant: 0, meat: 1, scav: 0 };
      if (o === 'Opiliones') return { mass: 0.0002, plant: 0.3, meat: 0.4, scav: 0.3 };
      if (o === 'Scorpiones') return { mass: 0.002, plant: 0, meat: 1, scav: 0 };
      return null;   // ticks and mites: parasites and specks, out of scope
    case 'crustacean':
      if (o === 'Isopoda') return { mass: 0.0001, plant: 0.2, meat: 0, scav: 0.8, strata: 'ground' };
      if (o === 'Decapoda') return { mass: 0.03, plant: 0.4, meat: 0.3, scav: 0.3, strata: 'water' };
      if (o === 'Amphipoda') return { mass: 0.00005, plant: 0.3, meat: 0, scav: 0.7, strata: 'water' };
      return null;
    case 'worm':
      if (['Crassiclitellata', 'Opisthopora', 'Haplotaxida'].includes(o) || /Lumbric|Megascolec|Acanthodril/.test(f || '')) return { mass: 0.002, plant: 0.1, meat: 0, scav: 0.9 };
      return null;   // leeches
    case 'snail':
      return { mass: 0.005, plant: 0.8, meat: 0, scav: 0.2 };
    case 'bird':   // a bird or mammal with no EltonTraits match even at family level
      return { mass: 0.03, plant: 0.3, meat: 0.7, scav: 0 };
    case 'mammal':
      return { mass: 0.1, plant: 0.6, meat: 0.4, scav: 0 };
    case 'reptile':
      if (info.klass === 'Crocodylia' || o === 'Crocodylia') return { mass: 200, plant: 0, meat: 1, scav: 0, strata: 'water' };
      if (info.klass === 'Testudines' || o === 'Testudines') {
        if (['Testudinidae'].includes(f)) return { mass: 4, plant: 0.95, meat: 0.05, scav: 0 };
        if (['Chelydridae'].includes(f)) return { mass: 8, plant: 0.3, meat: 0.6, scav: 0.1, strata: 'water' };
        return { mass: 1.2, plant: 0.5, meat: 0.5, scav: 0, strata: 'water' };
      }
      if (['Viperidae', 'Colubridae', 'Elapidae', 'Boidae', 'Natricidae', 'Dipsadidae', 'Leptotyphlopidae'].includes(f) || /Serpentes/.test(o || '')) return { mass: g === 'Crotalus' ? 0.7 : 0.3, plant: 0, meat: 1, scav: 0 };
      return { mass: 0.02, plant: 0.05, meat: 0.95, scav: 0 };
    case 'amphibian':
      if (o === 'Anura') return { mass: g === 'Lithobates' || g === 'Rana' ? 0.08 : 0.02, plant: 0, meat: 1, scav: 0, strata: 'water' };
      return { mass: 0.01, plant: 0, meat: 1, scav: 0 };
    case 'fish':
      if (['Cyprinidae', 'Catostomidae', 'Leuciscidae'].includes(f)) return { mass: g === 'Cyprinus' ? 4 : 0.2, plant: 0.5, meat: 0.4, scav: 0.1, strata: 'water' };
      if (f === 'Ictaluridae') return { mass: 1.5, plant: 0.2, meat: 0.6, scav: 0.2, strata: 'water' };
      if (f === 'Esocidae') return { mass: 3, plant: 0, meat: 1, scav: 0, strata: 'water' };
      return { mass: 0.4, plant: 0.1, meat: 0.9, scav: 0, strata: 'water' };
  }
  return null;
}

// The sprite template (taxon group) a species renders from.
function animalTaxon(info, group) {
  const f = info.family, o = info.order;
  if (group === 'mammal') {
    if (f === 'Bovidae') return 'bovid';
    if (['Cervidae', 'Antilocapridae'].includes(f)) return 'cervid';
    if (f === 'Canidae') return 'canid';
    if (f === 'Felidae') return 'felid';
    if (['Mustelidae', 'Mephitidae', 'Procyonidae'].includes(f)) return 'mustelid';
    if (f === 'Ursidae') return 'ursid';
    if (f === 'Leporidae') return 'lagomorph';
    if (o === 'Chiroptera') return 'bat';
    if (['Soricidae', 'Talpidae'].includes(f)) return 'shrew';
    if (o === 'Rodentia') return 'rodent';
    return 'mammal';
  }
  if (group === 'bird') {
    if (RAPTORS.has(f) || f === 'Cathartidae') return 'raptor';
    if (f === 'Anatidae') return 'waterfowl';
    if (WATERBIRDS.has(f)) return 'wader';
    if (['Phasianidae', 'Odontophoridae'].includes(f)) return 'gamebird';
    if (f === 'Picidae') return 'woodpecker';
    return 'songbird';
  }
  if (group === 'insect') {
    if (o === 'Orthoptera') return 'grasshopper';
    if (o === 'Coleoptera') return 'beetle';
    if (o === 'Lepidoptera') return 'butterfly';
    if (f === 'Formicidae') return 'ant';
    if (o === 'Hymenoptera') return BEES.has(f) ? 'bee' : 'wasp';
    if (o === 'Odonata') return 'dragonfly';
    if (o === 'Diptera') return 'fly';
    return 'bug';
  }
  return { arachnid: 'spider', crustacean: 'crustacean', worm: 'worm', snail: 'snail', amphibian: o === 'Anura' ? 'frog' : 'salamander',
    fish: 'fish', reptile: /Testudines/.test(info.klass + o) ? 'turtle' : ['Viperidae', 'Colubridae', 'Elapidae', 'Boidae', 'Natricidae', 'Dipsadidae'].includes(f) ? 'snake' : 'lizard' }[group] || group;
}

// ---------- climate ----------

async function climateNormals(cells) {
  const pts = [cells[0], cells[Math.floor(cells.length / 2)], cells[cells.length - 1]].map(c => [+(c.y + c.size / 2).toFixed(2), +(c.x + c.size / 2).toFixed(2)]);
  let t = 0, p = 0, amp = 0;
  for (const [lat, lon] of pts) {
    const j = await getJSON('https://archive-api.open-meteo.com/v1/archive?latitude=' + lat + '&longitude=' + lon +
      '&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=UTC');
    const d = j.daily, months = Array.from({ length: 12 }, () => [0, 0]);
    let tt = 0, pp = 0;
    d.time.forEach((day, k) => {
      const m = +day.slice(5, 7) - 1, v = d.temperature_2m_mean[k];
      if (v != null) { months[m][0] += v; months[m][1]++; tt += v; }
      pp += d.precipitation_sum[k] || 0;
    });
    const mm = months.map(([s, n]) => s / n);
    t += tt / d.time.length; p += pp / 30 / 10; amp += (Math.max(...mm) - Math.min(...mm)) / 2;
  }
  const n = pts.length;
  return { tMean: +(t / n).toFixed(1), tAmp: +(amp / n).toFixed(1), rain: Math.round(p / n) };
}

// Whittaker biome from climate (the design's table).
function biomeFor(c) {
  const T = c.tMean, P = c.rain;
  if (T < -5) return 'tundra';
  if (P < 30) return 'desert';
  if (T > 20 && P >= 100) return P > 250 ? 'tropical rainforest' : 'tropical seasonal forest';
  if (T < 5) return 'taiga';
  if (P >= 90) return 'temperate forest';
  return 'temperate grassland';
}

// ---------- build one catalog ----------

async function build(code) {
  const t0 = Date.now();
  requests = 0; cached = 0;
  console.log('Ecoregion ' + code);
  const geo = await ecoregionGeometry(code);
  const cells = cellsFor(geo.polys);
  console.log('  ' + geo.name + ' · ' + geo.l3.length + ' Level III regions · ' + cells.length + ' grid cells of ' + cells[0].size + '°');
  const tallies = await occurrenceTallies(cells);
  const atRiskTallies = await threatenedTallies(cells);
  const totalWeight = cells.reduce((a, c) => a + c.share, 0);
  const intro = await introducedSet();
  const et = await eltonTraits();
  const species = [];
  for (const g of GROUPS) {
    const quota = Math.round(g.quota * opt.quotaScale);
    // Rank by occupancy (share of the ecoregion's cells with records), then by record count.
    const ranked = [...tallies[g.id].entries()].sort((a, b) => b[1].weight - a[1].weight || b[1].count - a[1].count);
    const picked = [];
    let k = 0;
    // Candidates: the most widespread species, plus every at-risk species recorded in the ecoregion.
    const batch = ranked.slice(0, quota * 2);
    for (const [key, t] of atRiskTallies[g.id]) {
      if (!tallies[g.id].has(key)) tallies[g.id].set(key, t);
      if (!batch.some(b => b[0] === key)) batch.push([key, tallies[g.id].get(key)]);
    }
    const infos = await pool(batch, 4, async ([key]) => speciesInfo(key));
    // Threatened species (IUCN NT, VU, EN, CR) go first, so at-risk species the scenarios need make the quota.
    const atRisk = i => (i && ['NT', 'VU', 'EN', 'CR'].includes(i.iucn) ? 0 : 1);
    infos.sort((a, b) => atRisk(a) - atRisk(b));
    for (const info of infos) {
      k++;
      if (!info || info.rank !== 'SPECIES' || picked.length >= quota) continue;
      const tally = tallies[g.id].get(String(info.key));
      let entry;
      if (g.id === 'plant') {
        const usda = await usdaPlant(info.sci);
        const cls = classifyPlant(info, usda);
        // Native if USDA lists it as native in the lower 48; where it lists both, the GRIIS register decides.
        const inGriis = intro.has(info.key) || intro.has(info.sci);
        const native = usda && usda.known ? usda.nativeN && !(usda.introducedI && inGriis) : !inGriis;
        const common = usda && usda.common ? usda.common[0].toUpperCase() + usda.common.slice(1) : info.common;
        entry = Object.assign({ key: info.key, sci: info.sci, common, group: g.id, family: info.family, native, iucn: info.iucn }, cls,
          { traits: usda ? 'USDA PLANTS' : 'family default' });
      } else {
        const inGriis = intro.has(info.key) || intro.has(info.sci);
        if (info.sci === 'Bos taurus') continue;   // scenarios add domestic cattle themselves
        // Captive and ranch exotics (addax, oryx, zebra on Hill Country game ranches; pet tortoises): vertebrates that
        // GRIIS doesn't list as established aliens and whose native range isn't in North America or that are rarely
        // recorded in the U.S.
        if (!inGriis && ['mammal', 'bird', 'reptile', 'amphibian', 'fish'].includes(g.id) &&
          (!(await nativeToNorthAmerica(info.key)) || (await usShare(info.key)) < 0.15)) continue;
        const trait = g.id === 'bird' || g.id === 'mammal' ? await eltonFor(g.id, info) : null;
        const cls = classifyAnimal(info, g.id, trait);
        if (!cls) continue;
        if (g.id === 'bird' && trait && trait.English) info.common = trait.English.trim();
        entry = Object.assign({ key: info.key, sci: info.sci, common: info.common, group: g.id, family: info.family, order: info.order,
          native: !intro.has(info.key) && !intro.has(info.sci), iucn: info.iucn }, cls);
      }
      entry.occupancy = +(tally.weight / totalWeight).toFixed(3);
      entry.records = tally.count;
      picked.push(entry);
    }
    console.log('  ' + g.id.padEnd(11) + picked.length + ' of ' + ranked.length + ' recorded species');
    species.push(...picked);
  }
  const climate = await climateNormals(cells);
  const catalog = {
    code, name: titleCase(geo.name), level: geo.level, parent: geo.parent, level3: geo.l3, built: new Date().toISOString().slice(0, 10),
    climate: Object.assign(climate, { biome: biomeFor(climate) }),
    cells: cells.length, species,
    sources: [
      'U.S. EPA Level III ecoregions of the conterminous United States (Dec 2011)' + (geo.level === 3 ? '' : ', grouped by CEC Level II'),
      'GBIF.org occurrence records, 1980–2025 (queried ' + new Date().toISOString().slice(0, 10) + ')',
      'GBIF Backbone Taxonomy; IUCN Red List categories via GBIF',
      'GRIIS United States (Contiguous) ver. 2.0, 2022 (Pagad et al.), via GBIF',
      'EltonTraits 1.0 (Wilman et al. 2014, Ecology 95:2027), CC0',
      'USDA NRCS PLANTS Database',
      'Open-Meteo historical weather (ERA5), 1991–2020, CC BY 4.0',
    ],
  };
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, code.replace(/\./g, '_') + '.js');
  fs.writeFileSync(file, '// Generated by tools/catalog/build.js — do not edit by hand.\n' +
    'window.Trophic = window.Trophic || {};\n(Trophic.CATALOGS = Trophic.CATALOGS || {})[' + JSON.stringify(code) + '] = ' + JSON.stringify(catalog) + ';\n');
  writeIndex(catalog);
  console.log('  climate ' + climate.tMean + ' °C ±' + climate.tAmp + ', ' + climate.rain + ' cm/yr → ' + catalog.climate.biome);
  console.log('  wrote ' + path.relative(ROOT, file) + ' · ' + species.length + ' species · ' + requests + ' requests (' + cached + ' cached) · ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  return catalog;
}

// js/catalogs/index.js: a small list of the built catalogs, so the New world screen can offer them without loading each.
function writeIndex(cat) {
  const file = path.join(OUT, 'index.js');
  let index = [];
  if (fs.existsSync(file)) {
    const m = /= (\[.*\]);/s.exec(fs.readFileSync(file, 'utf8'));
    if (m) index = JSON.parse(m[1]);
  }
  index = index.filter(e => e.code !== cat.code);
  index.push({ code: cat.code, name: cat.name, level: cat.level, species: cat.species.length, biome: cat.climate.biome, tMean: cat.climate.tMean, rain: cat.climate.rain, built: cat.built });
  index.sort((a, b) => parseFloat(a.code) - parseFloat(b.code));
  fs.writeFileSync(file, '// Generated by tools/catalog/build.js — the ecoregion catalogs that have been built.\n' +
    'window.Trophic = window.Trophic || {};\nTrophic.CATALOG_INDEX = ' + JSON.stringify(index) + ';\n');
}

const titleCase = s => s.toLowerCase().replace(/(^|[\s/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bUsa\b/, 'USA');

async function listCodes() {
  const j = await getJSON(EPA + '/query?where=1%3D1&outFields=NA_L2CODE&returnGeometry=false&returnDistinctValues=true&f=json');
  return [...new Set(j.features.map(f => f.attributes.NA_L2CODE))].sort((a, b) => parseFloat(a) - parseFloat(b));
}

(async () => {
  const codes = opt.code === 'all' ? await listCodes() : [opt.code];
  const failed = [];
  for (const c of codes) {
    try { await build(c); }
    catch (e) { failed.push(c); console.log('  FAILED ' + c + ': ' + e.message.slice(0, 200)); }
  }
  if (failed.length) { console.log('failed: ' + failed.join(', ') + ' (rerun them; finished downloads are cached)'); process.exitCode = 1; }
})().catch(e => { console.error(e); process.exit(1); });
