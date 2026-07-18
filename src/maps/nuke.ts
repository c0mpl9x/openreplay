import type { MapConfigV1 } from './types';

const upperImage = new URL('./assets/de_nuke.png', import.meta.url).href;
const lowerImage = new URL('./assets/de_nuke_lower.png', import.meta.url).href;

/** Valve overview transform values for de_nuke, including both levels. */
export const NUKE_MAP_CONFIG = {
  schemaVersion: 1,
  id: 'de_nuke',
  displayName: 'Nuke',
  image: upperImage,
  resolution: { width: 1024, height: 1024 },
  posX: -3453,
  posY: 2887,
  scale: 7,
  levels: [
    { id: 'upper', image: upperImage, minZ: -495, maxZ: 10000 },
    { id: 'lower', image: lowerImage, minZ: -10000, maxZ: -495 },
  ],
} as const satisfies MapConfigV1;
