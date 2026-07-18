export * from './coordinates';
export * from './ancient';
export * from './anubis';
export * from './cache';
export * from './dust2';
export * from './inferno';
export * from './mirage';
export * from './nuke';
export type * from './types';

import { ANCIENT_MAP_CONFIG } from './ancient';
import { ANUBIS_MAP_CONFIG } from './anubis';
import { CACHE_MAP_CONFIG } from './cache';
import { DUST2_MAP_CONFIG } from './dust2';
import { INFERNO_MAP_CONFIG } from './inferno';
import { MIRAGE_MAP_CONFIG } from './mirage';
import { NUKE_MAP_CONFIG } from './nuke';
import type { MapConfigV1 } from './types';

export const MAP_CONFIGS = {
  de_ancient: ANCIENT_MAP_CONFIG,
  de_anubis: ANUBIS_MAP_CONFIG,
  de_cache: CACHE_MAP_CONFIG,
  de_dust2: DUST2_MAP_CONFIG,
  de_inferno: INFERNO_MAP_CONFIG,
  de_mirage: MIRAGE_MAP_CONFIG,
  de_nuke: NUKE_MAP_CONFIG,
} as const;

export type SupportedMapName = keyof typeof MAP_CONFIGS;

export const SUPPORTED_MAP_NAMES = Object.keys(MAP_CONFIGS) as SupportedMapName[];

export function isSupportedMap(mapName: string | undefined): mapName is SupportedMapName {
  return mapName !== undefined && Object.hasOwn(MAP_CONFIGS, mapName);
}

export function getMapConfig(mapName: string): MapConfigV1 | undefined {
  return isSupportedMap(mapName) ? MAP_CONFIGS[mapName] : undefined;
}
