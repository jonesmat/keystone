// Keystone — Web Worker for the automatic keystone tests (P3-M6). Loads the simulation, runs the control copy and
// one copy per candidate without it, and posts each result as it finishes.
self.window = self;
importScripts('balance.js', 'genes.js', 'data.js', 'sim.js', 'cycles.js', 'populations.js', 'demography.js', 'succession.js',
  'interactions.js', 'energy.js', 'evolution.js', 'generator.js', 'keystone.js');

self.onmessage = function (ev) {
  const T = self.Trophic, m = ev.data;
  self.postMessage({ control: T.keystoneRun(m.save, null, m.rounds) });
  m.items.forEach((ids, k) => self.postMessage({ k, result: T.keystoneRun(m.save, ids, m.rounds) }));
};
