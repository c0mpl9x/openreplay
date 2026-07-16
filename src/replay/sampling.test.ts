import { describe, expect, it } from 'vitest';

import {
  assertReplayFrames,
  compactPlayerSnapshots,
  createEmptyReplayFrames,
  selectSampleTicks,
} from './sampling';
import { ReplayFrameFlags, TEAMS, type ReplayPlayer } from './types';

const players: readonly ReplayPlayer[] = [
  { id: 10, steamId: '10', name: 'Ten' },
  { id: 20, steamId: '20', name: 'Twenty' },
];

describe('selectSampleTicks', () => {
  it('combines anchored 8-tick samples, the end and exact in-range events', () => {
    expect([
      ...selectSampleTicks({ startTick: 10, endTick: 30, eventTicks: [29, 11, 18, 9, 31, 11] }),
    ]).toEqual([10, 11, 18, 26, 29, 30]);
  });

  it('supports a one-tick range and a custom interval', () => {
    expect([...selectSampleTicks({ startTick: 4, endTick: 4 })]).toEqual([4]);
    expect([...selectSampleTicks({ startTick: 0, endTick: 10, intervalTicks: 3 })]).toEqual([
      0, 3, 6, 9, 10,
    ]);
  });

  it('rejects impossible ranges, ticks and intervals', () => {
    expect(() => selectSampleTicks({ startTick: 2, endTick: 1 })).toThrow(RangeError);
    expect(() => selectSampleTicks({ startTick: -1, endTick: 1 })).toThrow(RangeError);
    expect(() => selectSampleTicks({ startTick: 0, endTick: 1, eventTicks: [1.2] })).toThrow(
      RangeError,
    );
    expect(() => selectSampleTicks({ startTick: 0, endTick: 1, intervalTicks: 0 })).toThrow(
      RangeError,
    );
  });
});

describe('frame compaction', () => {
  it('initializes all positions as absent NaN values', () => {
    const frames = createEmptyReplayFrames(new Uint32Array([1, 9]), 2);
    expect([...frames.ticks]).toEqual([1, 9]);
    expect(frames.x.every(Number.isNaN)).toBe(true);
    expect(frames.yaw.every(Number.isNaN)).toBe(true);
    expect([...frames.flags]).toEqual([0, 0, 0, 0]);
    expect(() => assertReplayFrames(frames)).not.toThrow();
  });

  it('writes selected player snapshots in frame-major order', () => {
    const frames = compactPlayerSnapshots({
      startTick: 0,
      endTick: 8,
      players,
      snapshots: [
        {
          tick: 0,
          playerId: 20,
          x: 20,
          y: 21,
          z: 22,
          yaw: 23,
          health: 99.6,
          armor: 300,
          team: TEAMS.COUNTER_TERRORIST,
        },
        {
          tick: 0,
          playerId: 10,
          x: 10,
          y: 11,
          z: 12,
          yaw: 13,
          health: 0,
          armor: -5,
          team: TEAMS.TERRORIST,
          alive: false,
        },
        // Last duplicate wins.
        {
          tick: 0,
          playerId: 10,
          x: 14,
          y: 15,
          z: 16,
          yaw: 17,
          health: 80,
          armor: 50,
          team: TEAMS.TERRORIST,
        },
        // Unselected and unknown rows are ignored.
        { tick: 1, playerId: 10, x: 1, y: 1, z: 1, yaw: 1, health: 1, armor: 1 },
        { tick: 8, playerId: 999, x: 1, y: 1, z: 1, yaw: 1, health: 1, armor: 1 },
      ],
    });

    expect([...frames.x]).toEqual([14, 20, Number.NaN, Number.NaN]);
    expect([...frames.health]).toEqual([80, 100, 0, 0]);
    expect([...frames.armor]).toEqual([50, 255, 0, 0]);
    expect([...frames.team]).toEqual([2, 3, 0, 0]);
    expect([...frames.flags]).toEqual([
      ReplayFrameFlags.Present | ReplayFrameFlags.Alive,
      ReplayFrameFlags.Present | ReplayFrameFlags.Alive,
      0,
      0,
    ]);
  });

  it('marks explicit absence and non-finite transforms as missing', () => {
    const frames = compactPlayerSnapshots({
      startTick: 0,
      endTick: 0,
      players,
      snapshots: [
        { tick: 0, playerId: 10, x: 1, y: 2, z: 3, yaw: 4, health: 90, armor: 0, present: false },
        { tick: 0, playerId: 20, x: Number.NaN, y: 2, z: 3, yaw: 4, health: 90, armor: 0 },
      ],
    });
    expect(frames.x.every(Number.isNaN)).toBe(true);
    expect([...frames.flags]).toEqual([0, 0]);
  });

  it('rejects duplicate catalogs and malformed matrices', () => {
    expect(() =>
      compactPlayerSnapshots({
        startTick: 0,
        endTick: 0,
        players: [players[0]!, players[0]!],
        snapshots: [],
      }),
    ).toThrow(/Duplicate player id/);
    expect(() => createEmptyReplayFrames(new Uint32Array([8, 8]), 1)).toThrow(
      /strictly increasing/,
    );
    expect(() => createEmptyReplayFrames(new Uint32Array(), -1)).toThrow(RangeError);

    const malformed = createEmptyReplayFrames(new Uint32Array([0]), 1);
    const short = { ...malformed, x: new Float32Array() };
    expect(() => assertReplayFrames(short)).toThrow(/matrix/);
  });
});
