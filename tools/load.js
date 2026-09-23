// Loads the game's simulation modules into Node (no DOM needed).
globalThis.window = globalThis;
for (const f of ['balance', 'genes', 'data', 'sim', 'cycles', 'energy', 'evolution', 'generator']) require('../js/' + f + '.js');
module.exports = globalThis.Trophic;
