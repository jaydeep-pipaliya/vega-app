import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type React from 'react';

/**
 * Library category icons. A category stores either an icon key from this
 * list or an emoji. Keys are shared with vega-desktop (same list in
 * src/lib/library/libraryIcons.ts there), so a category made on one app
 * shows the same icon on the other after sync.
 */
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const LIBRARY_ICONS: Record<string, IconName> = {
  bookmark: 'bookmark',
  heart: 'heart',
  star: 'star',
  fire: 'fire',
  clock: 'clock-outline',
  check: 'check-circle',
  popcorn: 'popcorn',
  film: 'filmstrip',
  tv: 'television-classic',
  clapper: 'movie-open',
  drama: 'drama-masks',
  ghost: 'ghost',
  skull: 'skull',
  sword: 'sword',
  bomb: 'bomb',
  rocket: 'rocket-launch',
  laugh: 'emoticon-happy-outline',
  smile: 'emoticon-outline',
  heartbreak: 'heart-broken',
  baby: 'baby-face-outline',
  music: 'music',
  gamepad: 'gamepad-variant',
  trophy: 'trophy',
  crown: 'crown',
  gem: 'diamond-stone',
  sparkles: 'creation',
  zap: 'lightning-bolt',
  party: 'party-popper',
  moon: 'weather-night',
  sun: 'weather-sunny',
  cloud: 'cloud',
  snowflake: 'snowflake',
  leaf: 'leaf',
  flower: 'flower',
  tree: 'pine-tree',
  mountain: 'image-filter-hdr',
  globe: 'earth',
  plane: 'airplane',
  car: 'car',
  bike: 'bike',
  home: 'home',
  coffee: 'coffee',
  pizza: 'pizza',
  cake: 'cake-variant',
  gift: 'gift',
  users: 'account-group',
  user: 'account',
  cat: 'cat',
  dog: 'dog',
  paw: 'paw',
  fish: 'fish',
  bird: 'bird',
  brain: 'brain',
  book: 'book-open-variant',
  graduation: 'school',
  flask: 'flask',
  eye: 'eye',
  lock: 'lock',
  key: 'key',
  flag: 'flag',
  pin: 'pin',
  archive: 'archive',
  folder: 'folder',
  calendar: 'calendar',
  bell: 'bell',
  target: 'target',
  anchor: 'anchor',
  shield: 'shield',
  dumbbell: 'dumbbell',
  palette: 'palette',
  camera: 'camera',
  mic: 'microphone',
  headphones: 'headphones',
  infinity: 'infinity',
  hourglass: 'timer-sand',
  list: 'format-list-bulleted',
  thumbsup: 'thumb-up',
};

export const LIBRARY_ICON_KEYS = Object.keys(LIBRARY_ICONS);

export const LIBRARY_EMOJIS = [
  '🍿', '🎬', '📺', '🎞️', '⭐', '❤️', '🔥', '✨',
  '😂', '😱', '😭', '🥰', '🤯', '😎', '👻', '💀',
  '🧟', '👽', '🤖', '🦸', '🧙', '🐉', '🦄', '🐱',
  '🐶', '🌙', '☀️', '🌊', '🌸', '🍂', '❄️', '🌍',
  '🚀', '⚔️', '🏆', '👑', '💎', '🎮', '🎵', '🎉',
  '🍕', '🍣', '☕', '🎁', '📚', '🧠', '🕵️', '💘',
  '👨‍👩‍👧', '🏠', '✈️', '⏳', '📌', '✅', '🕒', '🌈',
];

/** Category accent colors. Undefined means the theme primary color. */
export const LIBRARY_COLORS = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#14B8A6',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#A16207',
  '#64748B',
];

export const isLibraryIconKey = (icon: string): boolean =>
  Object.prototype.hasOwnProperty.call(LIBRARY_ICONS, icon);
