import type { MapConfigV1 } from './types';

const image = new URL('./assets/de_cache.png', import.meta.url).href;

/** Valve overview transform values for de_cache. */
export const CACHE_MAP_CONFIG = {
  schemaVersion: 1,
  id: 'de_cache',
  displayName: 'Cache',
  image,
  resolution: { width: 1024, height: 1024 },
  posX: -2000,
  posY: 3250,
  scale: 5.5,
  levels: [{ id: 'main', image, minZ: -1000, maxZ: 1000 }],
} as const satisfies MapConfigV1;
