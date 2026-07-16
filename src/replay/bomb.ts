import type { BombReplayEvent, ReplayEvent } from './types';

/** Returns the planted-bomb state for one round at a specific replay tick. */
export function findActiveBombEvent(
  events: readonly ReplayEvent[],
  tick: number,
  roundNumber: number | undefined,
): BombReplayEvent | undefined {
  if (roundNumber === undefined) return undefined;

  let state: BombReplayEvent | undefined;
  for (const event of events) {
    if (event.tick > tick) break;
    if (event.roundNumber !== roundNumber) continue;
    if (event.type === 'bomb_planted') state = event;
    if (event.type === 'bomb_defused' || event.type === 'bomb_exploded') state = undefined;
  }
  return state;
}
