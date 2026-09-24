// P3-ART look-alike check: derives every catalog species' sprite tweak set (js/spritetweaks.js), runs the per-catalog
// separation step, then flags any two species in the same catalog whose sprites are still too similar, using a feature
// space of what's visible (template, parts, proportions, marks, and each colour region's CIELAB colour).
// Candidates for the same slot (sharing a role) must be further apart. Exits 1 on any unresolved look-alike.
//   node tools/check-sprites.js [catalog code ...] [--verbose]
const T = require('./load.js');
const path = require('path');
const ST = T.SpriteTweaks;

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const want = args.filter(a => !a.startsWith('--'));
const dir = path.join(__dirname, '..', 'js', 'catalogs');
require(path.join(dir, 'index.js'));
const codes = T.CATALOG_INDEX.map(c => c.code).filter(c => !want.length || want.includes(c));

let bad = 0, total = 0, drawn = 0, collisions = 0, separated = 0;
const taxa = {}, tplCount = {}, fallbackTaxa = {};
console.log('Sprite look-alike check: threshold ' + ST.THRESHOLD + ', same-slot ' + ST.SLOT_THRESHOLD + '\n');
console.log('catalog   species  drawn  fallback  collisions  separated  nudges  unresolved  closest same-slot pair');
for (const code of codes) {
  require(path.join(dir, code.replace(/\./g, '_') + '.js'));
  const cat = T.CATALOGS[code];
  const res = ST.forCatalog(cat, { fresh: true });
  const s = res.stats;
  const left = ST.lookalikes(res);
  total += s.species; drawn += s.drawn; collisions += s.collisions; separated += s.separated;
  for (const e of cat.species) {
    taxa[e.taxon] = (taxa[e.taxon] || 0) + 1;
    const tw = res.byKey.get(String(e.key));
    if (tw) tplCount[tw.tpl] = (tplCount[tw.tpl] || 0) + 1; else fallbackTaxa[e.taxon] = (fallbackTaxa[e.taxon] || 0) + 1;
  }
  // The nearest pair among same-slot candidates, for a feel of the margin.
  let best = null;
  const byTpl = {};
  for (const it of res.list) (byTpl[it.tw.tpl] = byTpl[it.tw.tpl] || []).push(it);
  for (const g of Object.values(byTpl)) for (let i = 0; i < g.length; i++) for (let j = 0; j < i; j++) {
    if (ST.thresholdFor(g[i].e, g[j].e) !== ST.SLOT_THRESHOLD) continue;
    const d = ST.distance(g[i].tw, g[j].tw);
    if (!best || d < best.d) best = { d, a: g[j].e, b: g[i].e };
  }
  const nm = e => e.common || e.sci;
  console.log(code.padEnd(9) + String(s.species).padStart(8) + String(s.drawn).padStart(7) + String(s.fallback).padStart(10) + String(s.collisions).padStart(12) +
    String(s.separated).padStart(11) + String(s.nudges).padStart(8) + String(left.length).padStart(12) + '  ' + (best ? best.d.toFixed(2) + ' ' + nm(best.a) + ' / ' + nm(best.b) : '—'));
  for (const l of left) { bad++; console.log('   LOOK-ALIKE ' + l.d.toFixed(2) + ' < ' + l.thr + ': ' + nm(l.a) + ' / ' + nm(l.b) + ' (' + res.byKey.get(String(l.a.key)).tpl + ')'); }
  if (verbose) for (const it of res.list) if (it.tw.sep) console.log('   separated: ' + nm(it.e) + ' (' + it.tw.tpl + ', ' + it.tw.sep + ' nudges)');
}

// A spot check that should always hold, even before separation: the coyote and the foxes read as different animals
// (the design's own example). Pairs from different catalogs are listed for information.
const canids = [];
for (const code of codes) for (const e of T.CATALOGS[code].species) if (e.taxon === 'canid' && !canids.some(c => c.key === e.key)) canids.push(e);
if (canids.length > 1) {
  console.log('\nCanids across catalogs (unseparated distances):');
  for (let i = 0; i < canids.length; i++) for (let j = 0; j < i; j++) {
    const d = ST.distance(ST.derive(canids[i]), ST.derive(canids[j]));
    const shared = codes.some(c => T.CATALOGS[c].species.some(e => e.key === canids[i].key) && T.CATALOGS[c].species.some(e => e.key === canids[j].key));
    const close = d < ST.SLOT_THRESHOLD && shared;
    console.log('  ' + d.toFixed(2).padStart(5) + '  ' + canids[j].common + ' / ' + canids[i].common + (shared ? '' : '  (never in one catalog)') + (close ? '   TOO CLOSE' : ''));
    if (close) bad++;
  }
}

console.log('\nTemplates used (catalog species): ' + Object.entries(tplCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
console.log('Fallback (no template): ' + (Object.keys(fallbackTaxa).length ? Object.entries(fallbackTaxa).map(([k, v]) => k + ' ' + v).join(', ') : 'none'));
console.log('Coverage: ' + drawn + ' of ' + total + ' species (' + (100 * drawn / total).toFixed(1) + '%, incl. domestic cattle per catalog); ' +
  collisions + ' look-alike collisions found before separation, ' + separated + ' separated.');
console.log(bad ? '\nFAIL: ' + bad + ' unresolved look-alike pair(s).' : '\nPASS: no look-alikes left in ' + codes.length + ' catalog(s).');
process.exit(bad ? 1 : 0);
