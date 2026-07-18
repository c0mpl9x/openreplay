import type { MapConfigV1 } from './types';

const image = new URL('./assets/de_anubis.png', import.meta.url).href;

/** Valve overview transform values for de_anubis. */
export const ANUBIS_MAP_CONFIG = {
  schemaVersion: 1,
  id: 'de_anubis',
  displayName: 'Anubis',
  image,
  resolution: { width: 1024, height: 1024 },
  posX: -2796,
  posY: 3328,
  scale: 5.22,
  levels: [{ id: 'main', image, minZ: -500, maxZ: 2000 }],
} as const satisfies MapConfigV1;
