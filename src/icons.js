// Noto Emoji fruit assets are vendored locally; the back keeps our brand mark.
export const iconNames = Object.freeze([
  'Lemon', 'Strawberry', 'Avocado', 'Cherries', 'Orange', 'Grapes',
  'Kiwi', 'Pear', 'Apple', 'Banana', 'Watermelon', 'Pineapple',
  'Mango', 'Peach', 'Coconut', 'Carrot', 'Corn', 'Eggplant',
]);

const icons = new Map(iconNames.map(name => [name,
  `<img class="tile-icon" src="src/icons/noto/${name.toLowerCase()}.svg" alt="" draggable="false">`,
]));
// Brand geometry scaled from its 24-unit viewBox to the tile's 64 units.
icons.set('face-down', '<svg class="tile-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g transform="scale(2.6666667)" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/></g></svg>');

export function tileIcon(name) {
  if (!icons.has(name)) throw new Error(`Unknown tile icon: ${String(name)}`);
  return icons.get(name);
}

const controlDrawings = new Map([
  ['pause', '<path d="M8 5v14M16 5v14" stroke-width="3"/>'],
  ['play', '<path d="M7 4l14 8-14 8Z" fill="currentColor"/>'],
  ['sound-on', '<path d="M3 9h4l6-5v16l-6-5H3Z"/><path d="M16 8q4 4 0 8m3-11q7 7 0 14"/>'],
  ['sound-off', '<path d="M3 9h4l6-5v16l-6-5H3Z"/><path d="M3 3l18 18"/>'],
  ['restart', '<path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5"/>'],
]);

export function controlIcon(name) {
  if (!controlDrawings.has(name)) throw new Error(`Unknown control icon: ${String(name)}`);
  return `<svg class="control-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${controlDrawings.get(name)}</svg>`;
}
