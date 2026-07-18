import { describe, expect, it } from 'vitest';

import { selectMapLevel } from './coordinates';
import { MAP_CONFIGS, NUKE_MAP_CONFIG, SUPPORTED_MAP_NAMES, getMapConfig } from './index';

const EXPECTED_TRANSFORMS = {
  de_ancient: { posX: -2953, posY: 2164, scale: 5 },
  de_anubis: { posX: -2796, posY: 3328, scale: 5.22 },
  de_cache: { posX: -2000, posY: 3250, scale: 5.5 },
  de_dust2: { posX: -2476, posY: 3239, scale: 4.4 },
  de_inferno: { posX: -2087, posY: 3870, scale: 4.9 },
  de_mirage: { posX: -3230, posY: 1713, scale: 5 },
  de_nuke: { posX: -3453, posY: 2887, scale: 7 },
} as const;

describe('Active Duty map registry', () => {
  it('contains the current seven-map pool in a stable order', () => {
    expect(SUPPORTED_MAP_NAMES).toEqual([
      'de_ancient',
      'de_anubis',
      'de_cache',
      'de_dust2',
      'de_inferno',
      'de_mirage',
      'de_nuke',
    ]);
  });

  it.each(SUPPORTED_MAP_NAMES)('declares a usable config and radar asset for %s', (mapName) => {
    const config = MAP_CONFIGS[mapName];
    expect(config).toMatchObject({
      schemaVersion: 1,
      id: mapName,
      resolution: { width: 1024, height: 1024 },
      ...EXPECTED_TRANSFORMS[mapName],
    });
    expect(config.image).toMatch(/^.+\.(?:png|webp)$/u);
    expect(config.levels.length).toBeGreaterThan(0);
    expect(config.levels.every((level) => level.image.length > 0)).toBe(true);
  });

  it('returns undefined for maps outside the supported pool', () => {
    expect(getMapConfig('de_train')).toBeUndefined();
    expect(getMapConfig('cs_office')).toBeUndefined();
  });
});

describe('Nuke level selection', () => {
  it('uses the upper radar at the inclusive boundary and lower below it', () => {
    expect(selectMapLevel(NUKE_MAP_CONFIG, -495).id).toBe('upper');
    expect(selectMapLevel(NUKE_MAP_CONFIG, -496).id).toBe('lower');
  });
});
