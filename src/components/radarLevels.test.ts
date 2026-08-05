import { describe, expect, it } from 'vitest';

import { NUKE_MAP_CONFIG } from '../maps';
import type { PlayerFrameState } from '../replay/interpolation';
import { mapPlayerStatesByLevel } from './radarLevels';

function stateAt(z: number, alive = true): PlayerFrameState {
  return {
    tick: 64,
    x: -3000,
    y: 2400,
    z,
    yaw: 90,
    health: alive ? 100 : 0,
    armor: 50,
    team: 2,
    alive,
    interpolated: false,
  };
}

describe('mapPlayerStatesByLevel', () => {
  it('keeps upper and lower players in separate non-empty buckets', () => {
    const grouped = mapPlayerStatesByLevel(NUKE_MAP_CONFIG, [stateAt(-494), stateAt(-496)]);

    expect([...grouped.keys()]).toEqual(['upper', 'lower']);
    expect(grouped.get('upper')?.map(({ playerIndex }) => playerIndex)).toEqual([0]);
    expect(grouped.get('lower')?.map(({ playerIndex }) => playerIndex)).toEqual([1]);
  });

  it('keeps empty level buckets and does not drop present dead states', () => {
    const grouped = mapPlayerStatesByLevel(NUKE_MAP_CONFIG, [stateAt(-494, false)]);

    expect(grouped.get('upper')).toHaveLength(1);
    expect(grouped.get('upper')?.[0]?.state.alive).toBe(false);
    expect(grouped.get('lower')).toEqual([]);
  });

  it('uses the configured inclusive/exclusive Z boundaries', () => {
    const grouped = mapPlayerStatesByLevel(NUKE_MAP_CONFIG, [stateAt(-495), stateAt(-496)]);

    expect(grouped.get('upper')?.map(({ playerIndex }) => playerIndex)).toEqual([0]);
    expect(grouped.get('lower')?.map(({ playerIndex }) => playerIndex)).toEqual([1]);
  });

  it('ignores unavailable states without changing the level layout', () => {
    const grouped = mapPlayerStatesByLevel(NUKE_MAP_CONFIG, [undefined, stateAt(-496)]);

    expect(grouped.get('upper')).toEqual([]);
    expect(grouped.get('lower')?.map(({ playerIndex }) => playerIndex)).toEqual([1]);
  });
});
