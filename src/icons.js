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
