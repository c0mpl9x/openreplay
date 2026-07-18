import type { MapConfigV1 } from './types';

const image = new URL('./assets/de_inferno.png', import.meta.url).href;

/** Valve overview transform values for de_inferno. */
export const INFERNO_MAP_CONFIG = {
  schemaVersion: 1,
  id: 'de_inferno',
  displayName: 'Inferno',
  image,
  resolution: { width: 1024, height: 1024 },
  posX: -2087,
  posY: 3870,
  scale: 4.9,
  levels: [{ id: 'main', image, minZ: -1000, maxZ: 1000 }],
} as const satisfies MapConfigV1;
