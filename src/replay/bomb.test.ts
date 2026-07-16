import { describe, expect, it } from 'vitest';
import { findActiveBombEvent } from './bomb';
import type { ReplayEvent } from './types';

const events: ReplayEvent[] = [
  { type: 'bomb_planted', tick: 20, roundNumber: 1, playerId: 1, site: 'A' },
  { type: 'bomb_planted', tick: 120, roundNumber: 2, playerId: 2, site: 'B' },
  { type: 'bomb_defused', tick: 140, roundNumber: 2, playerId: 3, site: 'B' },
];

describe('findActiveBombEvent', () => {
  it('returns a plant only while it is active in the selected round', () => {
    expect(findActiveBombEvent(events, 30, 1)).toMatchObject({ site: 'A' });
    expect(findActiveBombEvent(events, 130, 2)).toMatchObject({ site: 'B' });
    expect(findActiveBombEvent(events, 150, 2)).toBeUndefined();
  });

  it('does not leak an unterminated plant into the next round', () => {
    expect(findActiveBombEvent(events, 110, 2)).toBeUndefined();
  });

  it('returns no state when there is no active round', () => {
    expect(findActiveBombEvent(events, 30, undefined)).toBeUndefined();
  });
});
