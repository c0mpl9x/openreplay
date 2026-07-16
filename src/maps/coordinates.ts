import type { MapConfigV1, MapLevelV1, MapPosition, WorldPosition } from './types';

export interface WorldToMapOptions {
  /** Clamp returned pixels to the image bounds while preserving the inside flag. */
  readonly clamp?: boolean;
}

function assertMapConfig(config: MapConfigV1): void {
  if (
    !Number.isFinite(config.posX) ||
    !Number.isFinite(config.posY) ||
    !Number.isFinite(config.scale) ||
    config.scale <= 0 ||
    !Number.isFinite(config.resolution.width) ||
    config.resolution.width <= 0 ||
    !Number.isFinite(config.resolution.height) ||
    config.resolution.height <= 0 ||
    config.levels.length === 0
  ) {
    throw new RangeError('Map configuration has invalid geometry.');
  }
}

export function selectMapLevel(config: MapConfigV1, z = 0): MapLevelV1 {
  if (!Number.isFinite(z)) {
    throw new RangeError('World Z must be finite.');
  }

  const level = config.levels.find(
    ({ minZ = Number.NEGATIVE_INFINITY, maxZ = Number.POSITIVE_INFINITY }) => z >= minZ && z < maxZ,
  );
  if (level !== undefined) {
    return level;
  }
  const fallback = config.levels[0];
  if (fallback === undefined) {
    throw new RangeError('Map configuration must contain at least one level.');
  }
  return fallback;
}

/** Transform CS2 world units into source-radar image pixels. */
export function worldToMap(
  config: MapConfigV1,
  position: WorldPosition,
  { clamp = false }: WorldToMapOptions = {},
): MapPosition {
  assertMapConfig(config);
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    (position.z !== undefined && !Number.isFinite(position.z))
  ) {
    throw new RangeError('World coordinates must be finite.');
  }

  const rawX = (position.x - config.posX) / config.scale;
  const rawY = (config.posY - position.y) / config.scale;
  const inside =
    rawX >= 0 && rawX <= config.resolution.width && rawY >= 0 && rawY <= config.resolution.height;
  const x = clamp ? Math.min(config.resolution.width, Math.max(0, rawX)) : rawX;
  const y = clamp ? Math.min(config.resolution.height, Math.max(0, rawY)) : rawY;

  return {
    x,
    y,
    inside,
    level: selectMapLevel(config, position.z),
  };
}

export function mapToWorld(
  config: MapConfigV1,
  position: Pick<MapPosition, 'x' | 'y'>,
): Required<Pick<WorldPosition, 'x' | 'y'>> {
  assertMapConfig(config);
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new RangeError('Map coordinates must be finite.');
  }
  return {
    x: config.posX + position.x * config.scale,
    y: config.posY - position.y * config.scale,
  };
}
