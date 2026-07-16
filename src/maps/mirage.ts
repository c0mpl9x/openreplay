import type { MapConfigV1 } from './types';

const image = new URL('./assets/de_mirage.webp', import.meta.url).href;

/** Valve overview transform values for de_mirage. */
export const MIRAGE_MAP_CONFIG = {
  schemaVersion: 1,
  id: 'de_mirage',
  displayName: 'Mirage',
  image,
  resolution: { width: 1024, height: 1024 },
  posX: -3230,
  posY: 1713,
  scale: 5,
  levels: [{ id: 'main', image, minZ: -500, maxZ: 3000 }],
} as const satisfies MapConfigV1;
