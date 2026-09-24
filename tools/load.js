// Loads the game's simulation modules into Node (no DOM needed).
globalThis.window = globalThis;
for (const f of ['balance', 'genes', 'data', 'sim', 'cycles', 'populations', 'demography', 'succession', 'interactions', 'keystone', 'steward', 'energy', 'scenarios', 'catalog', 'generator']) require('../js/' + f + '.js');
module.exports = globalThis.Trophic;
