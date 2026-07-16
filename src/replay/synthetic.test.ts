import { describe, expect, it } from 'vitest';

import { readPlayerFrame } from './interpolation';
import { createSyntheticReplay } from './synthetic';
import { ReplayFrameFlags, TEAMS } from './types';

describe('createSyntheticReplay', () => {
  it('returns a deterministic, structurally complete Mirage replay', () => {
    const first = createSyntheticReplay();
    const second = createSyntheticReplay();

    expect(first).toMatchObject({
      schemaVersion: 1,
      meta: { mapName: 'de_mirage', tickRate: 64, durationTicks: 208 },
    });
    expect(first.players).toHaveLength(10);
    expect(first.rounds).toHaveLength(2);
    expect(first.events).toHaveLength(7);
    expect([...first.frames.ticks]).toEqual([...second.frames.ticks]);
    expect([...first.frames.x]).toEqual([...second.frames.x]);
    expect(first.frames).not.toBe(second.frames);
  });

  it('stores every irregular event tick in the frame timeline', () => {
    const replay = createSyntheticReplay();
    const ticks = new Set(replay.frames.ticks);
    for (const event of replay.events) {
      expect(ticks.has(event.tick)).toBe(true);
    }
    expect([...replay.frames.ticks]).toEqual(
      expect.arrayContaining([43, 57, 67, 89, 151, 167, 201]),
    );
  });

  it('contains a death discontinuity and resets the player next round', () => {
    const replay = createSyntheticReplay();
    const playerIndex = replay.players.findIndex(({ id }) => id === 1);
    const deathFrame = replay.frames.ticks.indexOf(43);
    const respawnFrame = replay.frames.ticks.indexOf(112);

    expect(readPlayerFrame(replay.frames, playerIndex, deathFrame)).toMatchObject({
      alive: false,
      health: 0,
    });
    expect(readPlayerFrame(replay.frames, playerIndex, respawnFrame)).toMatchObject({
      alive: true,
      team: TEAMS.COUNTER_TERRORIST,
    });
  });

  it('leaves the inter-round interval explicitly absent', () => {
    const replay = createSyntheticReplay();
    const gapFrame = replay.frames.ticks.indexOf(104);
    expect(gapFrame).toBeGreaterThanOrEqual(0);
    const offset = gapFrame * replay.frames.playerCount;
    expect(
      replay.frames.flags
        .slice(offset, offset + replay.frames.playerCount)
        .every((flags) => (flags & ReplayFrameFlags.Present) === 0),
    ).toBe(true);
  });
});
