import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlaybackClock } from './PlaybackClock';

describe('PlaybackClock', () => {
  let nextFrame: FrameRequestCallback | undefined;
  let frameId = 0;

  beforeEach(() => {
    nextFrame = undefined;
    frameId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      nextFrame = callback;
      frameId += 1;
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  function advance(time: number): void {
    const callback = nextFrame;
    nextFrame = undefined;
    if (callback === undefined) throw new Error('No animation frame was scheduled.');
    callback(time);
  }

  it('clamps seeks, changes ranges, validates speeds, and notifies subscribers', () => {
    const clock = new PlaybackClock(64, 10, 100);
    const listener = vi.fn();
    const unsubscribe = clock.subscribe(listener);

    clock.seek(-20);
    expect(clock.getTick()).toBe(10);
    clock.seek(120);
    expect(clock.getTick()).toBe(100);
    clock.setSpeed(4);
    expect(clock.getSnapshot().speed).toBe(4);
    clock.setRange(20, 80, false);
    expect(clock.getSnapshot()).toMatchObject({ tick: 80, minTick: 20, maxTick: 80 });
    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    clock.seek(40);
    expect(listener).toHaveBeenCalledTimes(4);
    expect(() => clock.setSpeed(3)).toThrow(RangeError);
    expect(() => clock.setRange(20, 10)).toThrow(RangeError);
  });

  it('advances at the selected rate, stops at the end, and restarts from the beginning', () => {
    const clock = new PlaybackClock(64, 0, 10);
    clock.play();
    expect(clock.getSnapshot().playing).toBe(true);

    advance(1_000);
    advance(1_100);
    expect(clock.getTick()).toBeCloseTo(6.4);
    advance(1_200);
    expect(clock.getSnapshot()).toMatchObject({ tick: 10, playing: false });
    expect(nextFrame).toBeUndefined();

    clock.play();
    expect(clock.getSnapshot()).toMatchObject({ tick: 0, playing: true });
    clock.pause();
    expect(clock.getSnapshot().playing).toBe(false);
  });

  it('does not start empty ranges and disposes a pending frame', () => {
    const clock = new PlaybackClock(64, 5, 5);
    clock.play();
    expect(clock.getSnapshot().playing).toBe(false);

    clock.setRange(0, 64);
    clock.play();
    clock.dispose();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
