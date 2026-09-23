// Loads the game's simulation modules into Node (no DOM needed).
globalThis.window = globalThis;
for (const f of ['balance', 'genes', 'data', 'sim', 'cycles', 'populations', 'energy', 'scenarios', 'catalog', 'evolution', 'generator']) require('../js/' + f + '.js');
module.exports = globalThis.Trophic;
