import type { MapConfigV1 } from './types';

const image = new URL('./assets/de_dust2.png', import.meta.url).href;

/** Valve overview transform values for de_dust2. */
export const DUST2_MAP_CONFIG = {
  schemaVersion: 1,
  id: 'de_dust2',
  displayName: 'Dust II',
  image,
  resolution: { width: 1024, height: 1024 },
  posX: -2476,
  posY: 3239,
  scale: 4.4,
  levels: [{ id: 'main', image, minZ: -1000, maxZ: 1000 }],
} as const satisfies MapConfigV1;
