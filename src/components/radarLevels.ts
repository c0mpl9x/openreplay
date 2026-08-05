import { worldToMap } from '../maps';
import type { MapConfigV1, MapPosition } from '../maps';
import type { PlayerFrameState } from '../replay/interpolation';

export interface MappedPlayerState {
  readonly playerIndex: number;
  readonly state: PlayerFrameState;
  readonly point: MapPosition;
}

/**
 * Maps every available player state once and groups it by the configured
 * level. Empty level buckets are kept so a renderer can preserve every level
 * panel even when no player is currently present there.
 */
export function mapPlayerStatesByLevel(
  mapConfig: MapConfigV1,
  states: readonly (PlayerFrameState | undefined)[],
): Map<string, MappedPlayerState[]> {
  const statesByLevel = new Map<string, MappedPlayerState[]>();
  for (const level of mapConfig.levels) statesByLevel.set(level.id, []);

  states.forEach((state, playerIndex) => {
    if (state === undefined) return;
    const point = worldToMap(mapConfig, state);
    statesByLevel.get(point.level.id)?.push({ playerIndex, state, point });
  });

  return statesByLevel;
}
