import type { MapConfigV1 } from './types';

const image = new URL('./assets/de_ancient.png', import.meta.url).href;

/** Valve overview transform values for de_ancient. */
export const ANCIENT_MAP_CONFIG = {
  schemaVersion: 1,
  id: 'de_ancient',
  displayName: 'Ancient',
  image,
  resolution: { width: 1024, height: 1024 },
  posX: -2953,
  posY: 2164,
  scale: 5,
  levels: [{ id: 'main', image, minZ: -500, maxZ: 2000 }],
} as const satisfies MapConfigV1;
