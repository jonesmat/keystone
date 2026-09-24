// Keystone — hover tooltips for ecology concepts (P3-M8). Wherever a concept's term appears in the interface (panels,
// the report, the Codex, the New world screen), it's underlined with a dotted line; hovering shows the concept's
// short definition, and clicking opens its entry in the Codex's Concepts tab. Terms are found in text as it's
// rendered (a MutationObserver), so any panel gets them without its own code.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';

  // The words that point at each concept. Case-sensitive entries (acronyms) are marked with a leading '='.
  const TERMS = {
    gpp: ['=GPP', 'gross primary production'],
    'plant-respiration': ['plant respiration'],
    npp: ['=NPP', 'net primary production', 'NPP efficiency'],
    'trophic-level': ['trophic levels?', 'primary consumers?', 'secondary consumers?', 'secondary carnivores?', 'primary carnivores?'],
    'food-web': ['food webs?', 'food chains?'],
    harvesting: ['harvesting efficiency', 'harvesting'],
    assimilation: ['assimilation efficiency', 'assimilation', 'assimilated'],
    gsp: ['=GSP', '=NSP', 'secondary production'],
    'tissue-growth': ['tissue growth efficiency', 'tissue growth'],
    ectotherm: ['ectotherms?', 'endotherms?'],
    'ten-percent': ['passed up', 'energy transfer'],
    'pyramid-numbers': ['pyramid of numbers', 'numbers pyramid'],
    'pyramid-biomass': ['pyramid of biomass', 'biomass pyramid', 'standing crop'],
    'pyramid-energy': ['pyramid of energy', 'energy pyramid'],
    realism: ['realism mode', 'game mode'],
    'population-change': ['N₁ = N₀ \\+ B \\+ I − D − E', 'N1 = N0 \\+ B \\+ I − D − E', 'immigration', 'emigration'],
    'carrying-capacity': ['carrying capacity', '=½K'],
    'growth-curves': ['logistic', 'exponential', 'overshoot'],
    mvp: ['minimum viable population', 'viable population', 'small-population viability'],
    allee: ['Allee effect', 'Allee'],
    territory: ['territories', 'territory', 'territorial', 'floaters?'],
    estimate: ['detection probability', 'error bars?', 'estimates?'],
    'mark-recapture': ['mark and recapture', 'mark-recapture'],
    keystone: ['keystone species', 'keystones?'],
    'trophic-cascade': ['trophic cascades?'],
    mutualism: ['mutualism', 'mutualists?'],
    commensalism: ['commensalism', 'commensal'],
    amensalism: ['amensalism'],
    parasitism: ['parasitism', 'nest parasites?', 'parasites?'],
    competition: ['competitive exclusion', 'competition'],
    strata: ['stratification', 'strata', 'vegetation layers'],
    diversity: ['Shannon H', 'Shannon', 'species richness', 'richness', 'biodiversity'],
    succession: ['secondary succession', 'primary succession', 'succession', 'seral stages?', 'seral', 'pioneers?'],
    climax: ['climax community', 'climax'],
    disturbance: ['disturbances?', 'windthrow', 'wildfires?'],
    biome: ['Whittaker', 'biomes?'],
    edge: ['edge effects?', 'interior habitat', 'edge vs interior'],
    fragmentation: ['fragmentation', 'fragments?', 'corridors?'],
    invasive: ['invasive species', 'invasives?', 'non-native'],
    'nitrogen-fixation': ['nitrogen fixation', 'nitrogen-fixing', 'nitrogen-fixers?', 'fixation', 'legumes?'],
    nitrification: ['nitrification', 'denitrification', 'ammonium', 'nitrate'],
    leaching: ['leaching', 'runoff'],
    'water-table': ['water table', 'aquifers?', 'groundwater'],
    'carbon-sink': ['carbon sinks?', 'carbon source', 'net carbon sink', 'soil carbon'],
    'sustainable-yield': ['sustainable yield', 'bag limits?', 'overharvest'],
    reintroduction: ['reintroductions?', 'translocation'],
    stakeholders: ['stakeholders?', 'ecosystem services', 'mandate'],
    ehi: ['=EHI', 'Ecosystem Health Index'],
  };

  let RE = null, LOOKUP = null;
  function build() {
    const cs = [], ci = [];
    LOOKUP = [];
    for (const id in TERMS) for (const t of TERMS[id]) {
      if (!T.conceptById(id)) continue;
      const cased = t[0] === '=', src = cased ? t.slice(1) : t;
      LOOKUP.push({ id, re: new RegExp('^(?:' + src + ')$', cased ? '' : 'i') });
      (cased ? cs : ci).push(src);
    }
    // Longest phrases first so "harvesting efficiency" wins over "harvesting". Word boundaries on both sides.
    const byLen = a => a.sort((x, y) => y.length - x.length);
    RE = { ci: new RegExp('(^|[^\\p{L}\\p{N}])(' + byLen(ci).join('|') + ')(?=$|[^\\p{L}\\p{N}])', 'giu'),
      cs: cs.length ? new RegExp('(^|[^\\p{L}\\p{N}])(' + byLen(cs).join('|') + ')(?=$|[^\\p{L}\\p{N}])', 'gu') : null };
  }
  const idFor = word => { const hit = LOOKUP.find(l => l.re.test(word)); return hit ? hit.id : null; };

  // Where not to add tips: form controls, buttons (their clicks do something else), canvases and SVG, code,
  // the tooltip itself, and anything opted out with data-no-tips.
  const SKIP = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON', 'CANVAS', 'SVG', 'svg', 'text', 'tspan', 'title', 'CODE', 'ABBR', 'A', 'LABEL']);
  function skipped(node) {
    for (let p = node.parentNode; p && p !== document.body; p = p.parentNode) {
      if (SKIP.has(p.nodeName) || (p.classList && (p.classList.contains('ctip') || p.classList.contains('brand') || p.id === 'concept-tip')) || (p.dataset && p.dataset.noTips != null)) return true;
    }
    return false;
  }

  function matchesIn(text) {
    const out = [];
    for (const re of [RE.ci, RE.cs]) {
      if (!re) continue;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const start = m.index + m[1].length, word = m[2];
        const id = idFor(word);
        if (id && !out.some(o => start < o.end && start + word.length > o.start)) out.push({ start, end: start + word.length, word, id });
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  function wrapText(node) {
    const text = node.nodeValue;
    if (!text || text.length < 3 || !/\p{L}/u.test(text)) return;
    const ms = matchesIn(text);
    if (!ms.length || skipped(node)) return;
    const frag = document.createDocumentFragment();
    let at = 0;
    for (const m of ms) {
      if (m.start > at) frag.append(text.slice(at, m.start));
      const a = document.createElement('abbr');
      a.className = 'ctip'; a.dataset.concept = m.id; a.textContent = m.word;
      frag.append(a);
      at = m.end;
    }
    if (at < text.length) frag.append(text.slice(at));
    node.parentNode.replaceChild(frag, node);
  }

  function scan(root) {
    if (!RE) build();
    if (root.nodeType === 3) { if (root.parentNode) wrapText(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    for (const n of nodes) if (n.parentNode) wrapText(n);
  }

  // Scan what's added to the page, batched every 30 ms. Text changed in place (the top bar's counters) isn't
  // rescanned: those are numbers.
  const pending = new Set();
  let queued = false;
  function flush() {
    queued = false;
    const roots = [...pending]; pending.clear();
    for (const r of roots) if (r.isConnected) scan(r);
  }
  function observe() {
    new MutationObserver(list => {
      for (const m of list) for (const n of m.addedNodes) if (!(n.classList && n.classList.contains('ctip'))) pending.add(n);
      if (pending.size && !queued) { queued = true; setTimeout(flush, 30); }
    }).observe(document.body, { childList: true, subtree: true });
    scan(document.body);
  }

  // ---------- the tooltip ----------

  let tip = null;
  const firstSentence = s => { const m = /^.*?[.!?](\s|$)/.exec(s); return m ? m[0].trim() : s; };
  function show(a) {
    const c = T.conceptById(a.dataset.concept);
    if (!c) return;
    if (!tip) { tip = document.createElement('div'); tip.id = 'concept-tip'; tip.setAttribute('role', 'tooltip'); document.body.append(tip); }
    tip.replaceChildren();
    const b = document.createElement('b'); b.textContent = c.term;
    const p = document.createElement('p'); p.textContent = firstSentence(c.def);
    const more = document.createElement('small'); more.textContent = T.Game && T.Game.run ? 'Click for more in the Codex' : c.topic;
    tip.append(b, p, more);
    tip.hidden = false;
    const r = a.getBoundingClientRect(), W = tip.offsetWidth, H = tip.offsetHeight;
    let x = r.left + r.width / 2 - W / 2, y = r.bottom + 8;
    if (y + H > innerHeight - 8) y = r.top - H - 8;
    x = Math.max(8, Math.min(innerWidth - W - 8, x));
    tip.style.left = x + 'px'; tip.style.top = Math.max(8, y) + 'px';
    a.setAttribute('aria-describedby', 'concept-tip');
  }
  function hide() { if (tip) tip.hidden = true; }

  function bind() {
    document.addEventListener('mouseover', e => { const a = e.target.closest && e.target.closest('.ctip'); if (a) show(a); });
    document.addEventListener('mouseout', e => { const a = e.target.closest && e.target.closest('.ctip'); if (a && !a.contains(e.relatedTarget)) hide(); });
    document.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('ctip')) show(e.target); });
    document.addEventListener('focusout', hide);
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('.ctip');
      if (!a || !T.Game || !T.Game.run) return;
      e.preventDefault(); e.stopPropagation();
      hide();
      if (T.Game.state === 'codex') { T.Screens.codexTab = 'concepts'; T.Screens.renderConcepts(a.dataset.concept); }
      else T.Game.openOverlay('codex', a.dataset.concept);
    }, true);
    document.addEventListener('scroll', hide, true);
  }

  T.ConceptTips = { TERMS, scan, matchesIn: text => { if (!RE) build(); return matchesIn(text); } };
  if (typeof document !== 'undefined' && document.body) { bind(); observe(); }
  else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => { bind(); observe(); });
})(window.Trophic);
