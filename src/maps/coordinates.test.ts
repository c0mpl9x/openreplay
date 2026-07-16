import { describe, expect, it } from 'vitest';

import { mapToWorld, selectMapLevel, worldToMap } from './coordinates';
import { MIRAGE_MAP_CONFIG } from './mirage';
import type { MapConfigV1 } from './types';

describe('Mirage map configuration', () => {
  it('declares the standard 1024px overview transform', () => {
    expect(MIRAGE_MAP_CONFIG).toMatchObject({
      schemaVersion: 1,
      id: 'de_mirage',
      posX: -3230,
      posY: 1713,
      scale: 5,
      resolution: { width: 1024, height: 1024 },
    });
    expect(MIRAGE_MAP_CONFIG.levels).toHaveLength(1);
    expect(MIRAGE_MAP_CONFIG.image).not.toBe('');
    expect(MIRAGE_MAP_CONFIG.levels[0]).toMatchObject({
      id: 'main',
      image: MIRAGE_MAP_CONFIG.image,
      minZ: -500,
      maxZ: 3000,
    });
  });

  it('maps the overview corners and inverts the world Y axis', () => {
    expect(worldToMap(MIRAGE_MAP_CONFIG, { x: -3230, y: 1713 })).toMatchObject({
      x: 0,
      y: 0,
      inside: true,
    });
    expect(worldToMap(MIRAGE_MAP_CONFIG, { x: 1890, y: -3407 })).toMatchObject({
      x: 1024,
      y: 1024,
      inside: true,
    });
    expect(worldToMap(MIRAGE_MAP_CONFIG, { x: -3225, y: 1708 })).toMatchObject({
      x: 1,
      y: 1,
    });
  });

  it('reports off-map positions and optionally clamps pixels', () => {
    expect(worldToMap(MIRAGE_MAP_CONFIG, { x: -4000, y: 3000 })).toMatchObject({
      x: -154,
      y: -257.4,
      inside: false,
    });
    expect(worldToMap(MIRAGE_MAP_CONFIG, { x: -4000, y: 3000 }, { clamp: true })).toMatchObject({
      x: 0,
      y: 0,
      inside: false,
    });
  });

  it('round-trips map pixels and world coordinates', () => {
    const source = { x: -800, y: -600 };
    const mapped = worldToMap(MIRAGE_MAP_CONFIG, source);
    expect(mapToWorld(MIRAGE_MAP_CONFIG, mapped)).toEqual(source);
  });
});

describe('multi-level map support', () => {
  const config: MapConfigV1 = {
    schemaVersion: 1,
    id: 'test',
    displayName: 'Test',
    image: 'lower.png',
    resolution: { width: 100, height: 100 },
    posX: 0,
    posY: 0,
    scale: 1,
    levels: [
      { id: 'lower', image: 'lower.png', maxZ: 10 },
      { id: 'upper', image: 'upper.png', minZ: 10 },
    ],
  };

  it('uses inclusive lower and exclusive upper Z boundaries', () => {
    expect(selectMapLevel(config, 9.999).id).toBe('lower');
    expect(selectMapLevel(config, 10).id).toBe('upper');
    expect(worldToMap(config, { x: 1, y: -1, z: 20 }).level.id).toBe('upper');
  });

  it('falls back to the first level for an uncovered height', () => {
    const withGap = {
      ...config,
      levels: [
        { id: 'low', image: 'low.png', maxZ: 0 },
        { id: 'high', image: 'high.png', minZ: 10 },
      ],
    } satisfies MapConfigV1;
    expect(selectMapLevel(withGap, 5).id).toBe('low');
  });

  it('rejects non-finite coordinates and invalid map geometry', () => {
    expect(() => worldToMap(config, { x: Number.NaN, y: 0 })).toThrow(RangeError);
    expect(() => selectMapLevel(config, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => mapToWorld(config, { x: 0, y: Number.NaN })).toThrow(RangeError);
    expect(() => worldToMap({ ...config, scale: 0 }, { x: 0, y: 0 })).toThrow(RangeError);
    expect(() => worldToMap({ ...config, levels: [] }, { x: 0, y: 0 })).toThrow(RangeError);
  });
});
