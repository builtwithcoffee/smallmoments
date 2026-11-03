export const DIFFICULTIES = { easy: { pairs: 8, columns: 4 }, hard: { pairs: 18, columns: 6 } };

export const symbols = [
  ['🍋', 'Lemon'], ['🍓', 'Strawberry'], ['🥑', 'Avocado'], ['🍒', 'Cherries'],
  ['🍊', 'Orange'], ['🍇', 'Grapes'], ['🥝', 'Kiwi'], ['🍐', 'Pear'],
  ['🍎', 'Apple'], ['🍌', 'Banana'], ['🍉', 'Watermelon'], ['🍍', 'Pineapple'],
  ['🥭', 'Mango'], ['🍑', 'Peach'], ['🥥', 'Coconut'], ['🥕', 'Carrot'],
  ['🌽', 'Corn'], ['🍆', 'Eggplant'],
];

export function createGame(random = Math.random, pairCount = 8) {
  const tiles = symbols.slice(0, pairCount).flatMap(([symbol, name], pair) =>
    [0, 1].map(copy => ({ id: pair * 2 + copy, pair, symbol, name, matched: false })));
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return { tiles, selected: [], moves: 0, pairs: 0, pairCount, locked: false, paused: false };
}

export function restoreGame(game, { matched, selected, moves }) {
  game.tiles.forEach((tile, index) => { tile.matched = matched.includes(index); });
  game.pairs = matched.length / 2;
  game.selected = selected;
  game.moves = moves;
  game.locked = false;
  return game;
}

export function canPause(game) {
  return (game.moves > 0 || game.selected.length > 0 || game.pairs > 0) &&
    game.pairs < game.pairCount && !game.paused;
}

export function pauseGame(game) {
  if (!canPause(game)) return false;
  game.paused = true;
  return true;
}

export function resumeGame(game) {
  if (!game.paused) return false;
  game.paused = false;
  return true;
}

export function selectTile(game, index) {
  const tile = game.tiles[index];
  if (game.paused || !tile || tile.matched || game.locked || game.selected.includes(index)) return 'ignored';
  game.selected.push(index);
  if (game.selected.length === 1) return 'first';
  game.moves++;
  const [first, second] = game.selected.map(i => game.tiles[i]);
  if (first.pair === second.pair) {
    first.matched = second.matched = true;
    game.pairs++;
    game.selected = [];
    return game.pairs === game.pairCount ? 'won' : 'match';
  }
  game.locked = true;
  return 'mismatch';
}

export function hideMismatch(game) {
  if (game.paused || !game.locked) return;
  game.selected = [];
  game.locked = false;
}
