import { describe, expect, it } from 'vitest';

import {
  findFrameWindow,
  interpolatePlayerFrame,
  interpolateYaw,
  readPlayerFrame,
} from './interpolation';
import { createEmptyReplayFrames } from './sampling';
import { ReplayFrameFlags, TEAMS, type ReplayFrames } from './types';

function twoFrames(
  previousFlags = ReplayFrameFlags.Present | ReplayFrameFlags.Alive,
  nextFlags = ReplayFrameFlags.Present | ReplayFrameFlags.Alive,
  ticks = new Uint32Array([0, 8]),
): ReplayFrames {
  const frames = createEmptyReplayFrames(ticks, 1);
  frames.x.set([0, 8]);
  frames.y.set([10, 18]);
  frames.z.set([20, 28]);
  frames.yaw.set([350, 10]);
  frames.health.set([90, 50]);
  frames.armor.set([80, 40]);
  frames.team.set([TEAMS.TERRORIST, TEAMS.TERRORIST]);
  frames.flags.set([previousFlags, nextFlags]);
  return frames;
}

describe('findFrameWindow', () => {
  const ticks = new Uint32Array([4, 12, 20]);

  it('brackets fractional ticks with a normalized alpha', () => {
    expect(findFrameWindow(ticks, 10)).toEqual({
      previousIndex: 0,
      nextIndex: 1,
      alpha: 0.75,
    });
  });

  it('returns exact frames and clamps outside the stored range', () => {
    expect(findFrameWindow(ticks, 12)).toEqual({ previousIndex: 1, nextIndex: 1, alpha: 0 });
    expect(findFrameWindow(ticks, -10)).toEqual({ previousIndex: 0, nextIndex: 0, alpha: 0 });
    expect(findFrameWindow(ticks, 99)).toEqual({ previousIndex: 2, nextIndex: 2, alpha: 0 });
  });

  it('handles no frames and rejects non-finite targets', () => {
    expect(findFrameWindow(new Uint32Array(), 1)).toBeUndefined();
    expect(() => findFrameWindow(ticks, Number.NaN)).toThrow(RangeError);
  });
});

describe('player frame interpolation', () => {
  it('reads a finite present frame and interpolates position and shortest yaw', () => {
    const frames = twoFrames();
    expect(readPlayerFrame(frames, 0, 0)).toMatchObject({
      tick: 0,
      x: 0,
      team: TEAMS.TERRORIST,
      alive: true,
      interpolated: false,
    });
    expect(interpolatePlayerFrame(frames, 0, 4)).toEqual({
      tick: 4,
      x: 4,
      y: 14,
      z: 24,
      yaw: 0,
      health: 90,
      armor: 80,
      team: TEAMS.TERRORIST,
      alive: true,
      interpolated: true,
    });
    expect(interpolateYaw(10, 350, 0.5)).toBe(0);
  });

  it('returns exact/clamped samples without interpolation', () => {
    const frames = twoFrames();
    expect(interpolatePlayerFrame(frames, 0, 8)).toMatchObject({
      tick: 8,
      x: 8,
      health: 50,
      interpolated: false,
    });
    expect(interpolatePlayerFrame(frames, 0, -2)).toMatchObject({
      tick: -2,
      x: 0,
      interpolated: false,
    });
  });

  it('uses a step transition for death, respawn and team changes', () => {
    const death = twoFrames(
      ReplayFrameFlags.Present | ReplayFrameFlags.Alive,
      ReplayFrameFlags.Present,
    );
    expect(interpolatePlayerFrame(death, 0, 4)).toMatchObject({
      x: 0,
      alive: true,
      interpolated: false,
    });

    const respawn = twoFrames(
      ReplayFrameFlags.Present,
      ReplayFrameFlags.Present | ReplayFrameFlags.Alive,
    );
    expect(interpolatePlayerFrame(respawn, 0, 4)).toMatchObject({
      x: 0,
      alive: false,
      interpolated: false,
    });

    const sideSwap = twoFrames();
    sideSwap.team[1] = TEAMS.COUNTER_TERRORIST;
    expect(interpolatePlayerFrame(sideSwap, 0, 4)).toMatchObject({
      x: 0,
      team: 2,
      interpolated: false,
    });
  });

  it('does not bridge absent/non-finite samples or long round gaps', () => {
    const absent = twoFrames(ReplayFrameFlags.Present | ReplayFrameFlags.Alive, 0);
    expect(interpolatePlayerFrame(absent, 0, 4)).toBeUndefined();

    const invalid = twoFrames();
    invalid.x[1] = Number.NaN;
    expect(interpolatePlayerFrame(invalid, 0, 4)).toBeUndefined();

    const gap = twoFrames(
      ReplayFrameFlags.Present | ReplayFrameFlags.Alive,
      ReplayFrameFlags.Present | ReplayFrameFlags.Alive,
      new Uint32Array([0, 32]),
    );
    expect(interpolatePlayerFrame(gap, 0, 16)).toBeUndefined();
    expect(interpolatePlayerFrame(gap, 0, 16, { maxGapTicks: 32 })).toMatchObject({
      x: 4,
      interpolated: true,
    });
  });

  it('rejects invalid indexes and interpolation options', () => {
    const frames = twoFrames();
    expect(() => readPlayerFrame(frames, 1, 0)).toThrow(RangeError);
    expect(() => readPlayerFrame(frames, 0, 2)).toThrow(RangeError);
    expect(() => interpolatePlayerFrame(frames, 0, 4, { maxGapTicks: -1 })).toThrow(RangeError);
  });
});
