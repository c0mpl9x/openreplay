import { describe, expect, it } from 'vitest';

import {
  findRoundAtTick,
  getRoundPlaybackRange,
  pairRoundEvents,
  type RawRoundEvent,
} from './rounds';
import { TEAMS } from './types';

describe('pairRoundEvents', () => {
  it('sorts and pairs a complete round with winner metadata', () => {
    const events: RawRoundEvent[] = [
      {
        type: 'round_end',
        tick: 90,
        roundNumber: 3,
        winner: TEAMS.COUNTER_TERRORIST,
        reason: 'eliminated',
      },
      { type: 'round_start', tick: 10, roundNumber: 3 },
      { type: 'round_freeze_end', tick: 20, roundNumber: 3 },
    ];
    expect(pairRoundEvents(events)).toEqual([
      {
        number: 3,
        startTick: 10,
        freezeEndTick: 20,
        endTick: 90,
        winner: TEAMS.COUNTER_TERRORIST,
        reason: 'eliminated',
      },
    ]);
  });

  it('uses round_start as the playback fallback without freeze_end', () => {
    expect(
      pairRoundEvents([
        { type: 'round_start', tick: 100 },
        { type: 'round_end', tick: 150, winner: TEAMS.TERRORIST },
      ]),
    ).toEqual([
      {
        number: 1,
        startTick: 100,
        freezeEndTick: 100,
        endTick: 150,
        winner: TEAMS.TERRORIST,
      },
    ]);
  });

  it('drops warmup and incomplete/restarted rounds', () => {
    expect(
      pairRoundEvents([
        { type: 'round_start', tick: 0, warmup: true },
        { type: 'round_end', tick: 10 },
        { type: 'round_start', tick: 20 },
        { type: 'round_freeze_end', tick: 25 },
        // New start abandons the incomplete previous round.
        { type: 'round_start', tick: 30 },
        { type: 'round_end', tick: 40, warmup: true },
        { type: 'round_start', tick: 50 },
      ]),
    ).toEqual([]);
  });

  it('keeps the first competitive round when warmup ends before freeze_end', () => {
    expect(
      pairRoundEvents([
        { type: 'round_start', tick: 65, roundNumber: 1, warmup: true },
        { type: 'round_freeze_end', tick: 1761, roundNumber: 1, warmup: false },
        { type: 'round_end', tick: 8971, roundNumber: 1, warmup: false },
      ]),
    ).toEqual([
      {
        number: 1,
        startTick: 65,
        freezeEndTick: 1761,
        endTick: 8971,
      },
    ]);
  });

  it('ignores lifecycle events explicitly belonging to another round', () => {
    expect(
      pairRoundEvents([
        { type: 'round_start', tick: 0, roundNumber: 7 },
        { type: 'round_freeze_end', tick: 5, roundNumber: 6 },
        { type: 'round_freeze_end', tick: 10, roundNumber: 7 },
        { type: 'round_freeze_end', tick: 11, roundNumber: 7 },
        { type: 'round_end', tick: 20, roundNumber: 6 },
        { type: 'round_end', tick: 30, roundNumber: 7 },
      ]),
    ).toEqual([{ number: 7, startTick: 0, freezeEndTick: 10, endTick: 30 }]);
  });

  it('filters zero-duration rounds and ignores lifecycle events after an end', () => {
    expect(
      pairRoundEvents([
        { type: 'round_start', tick: 10 },
        { type: 'round_end', tick: 10 },
        { type: 'round_start', tick: 20 },
        { type: 'round_freeze_end', tick: 40 },
        { type: 'round_end', tick: 30 },
      ]),
    ).toEqual([{ number: 2, startTick: 20, freezeEndTick: 20, endTick: 30 }]);
  });

  it('rejects malformed ticks and round numbers', () => {
    expect(() => pairRoundEvents([{ type: 'round_start', tick: -1 }])).toThrow(RangeError);
    expect(() => pairRoundEvents([{ type: 'round_start', tick: 1, roundNumber: 0 }])).toThrow(
      RangeError,
    );
  });
});

describe('round playback helpers', () => {
  const rounds = pairRoundEvents([
    { type: 'round_start', tick: 0 },
    { type: 'round_freeze_end', tick: 8 },
    { type: 'round_end', tick: 20 },
  ]);

  it('returns the post-freeze playback range', () => {
    expect(getRoundPlaybackRange(rounds[0]!)).toEqual({ startTick: 8, endTick: 20 });
  });

  it('finds rounds inclusively and ignores freeze time', () => {
    expect(findRoundAtTick(rounds, 7)).toBeUndefined();
    expect(findRoundAtTick(rounds, 8)?.number).toBe(1);
    expect(findRoundAtTick(rounds, 20)?.number).toBe(1);
    expect(findRoundAtTick(rounds, 21)).toBeUndefined();
  });
});
