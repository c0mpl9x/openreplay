import type { ReplayRound, TeamNumber } from './types';

interface RawRoundEventBase {
  readonly tick: number;
  readonly roundNumber?: number;
  readonly warmup?: boolean;
}

export interface RawRoundStartEvent extends RawRoundEventBase {
  readonly type: 'round_start';
}

export interface RawRoundFreezeEndEvent extends RawRoundEventBase {
  readonly type: 'round_freeze_end';
}

export interface RawRoundEndEvent extends RawRoundEventBase {
  readonly type: 'round_end';
  readonly winner?: TeamNumber;
  readonly reason?: string;
}

export type RawRoundEvent = RawRoundStartEvent | RawRoundFreezeEndEvent | RawRoundEndEvent;

interface OpenRound {
  readonly number: number;
  readonly explicitNumber?: number;
  readonly startTick: number;
  freezeEndTick?: number;
  warmup: boolean;
}

function assertRawRoundEvent(event: RawRoundEvent): void {
  if (!Number.isInteger(event.tick) || event.tick < 0 || event.tick > 0xffff_ffff) {
    throw new RangeError('Round event ticks must be unsigned 32-bit integers.');
  }
  if (
    event.roundNumber !== undefined &&
    (!Number.isSafeInteger(event.roundNumber) || event.roundNumber < 1)
  ) {
    throw new RangeError('Round numbers must be positive integers when provided.');
  }
}

function eventBelongsToRound(event: RawRoundEvent, round: OpenRound): boolean {
  return (
    event.roundNumber === undefined ||
    round.explicitNumber === undefined ||
    event.roundNumber === round.explicitNumber ||
    // Some demoparser2 GOTV recordings increment `total_rounds_played`
    // before emitting round_end. In that shape the end is reported as the
    // next round even though it closes the currently open one.
    (event.type === 'round_end' && event.roundNumber === round.explicitNumber + 1)
  );
}

/**
 * Pair lifecycle events into complete, playable rounds.
 *
 * A new round_start abandons any still-open incomplete round. Warmup and rounds
 * without a valid end are excluded. Missing freeze_end falls back to startTick.
 */
export function pairRoundEvents(events: readonly RawRoundEvent[]): ReplayRound[] {
  const ordered = events.map((event, inputIndex) => {
    assertRawRoundEvent(event);
    return { event, inputIndex };
  });
  ordered.sort(
    (left, right) => left.event.tick - right.event.tick || left.inputIndex - right.inputIndex,
  );

  const rounds: ReplayRound[] = [];
  let openRound: OpenRound | undefined;
  let nextFallbackNumber = 1;

  for (const { event } of ordered) {
    if (event.type === 'round_start') {
      const number = event.roundNumber ?? nextFallbackNumber;
      nextFallbackNumber = Math.max(nextFallbackNumber + 1, number + 1);
      openRound = {
        number,
        explicitNumber: event.roundNumber,
        startTick: event.tick,
        warmup: event.warmup === true,
      };
      continue;
    }

    if (openRound === undefined || !eventBelongsToRound(event, openRound)) {
      continue;
    }

    // demoparser exposes the game-wide warmup flag at each event. The first
    // competitive round can start on the final warmup tick and then report
    // `false` at freeze_end, so the latest explicit value must win.
    if (event.warmup !== undefined) {
      openRound.warmup = event.warmup;
    }

    if (event.type === 'round_freeze_end') {
      if (openRound.freezeEndTick === undefined && event.tick >= openRound.startTick) {
        openRound.freezeEndTick = event.tick;
      }
      continue;
    }

    const freezeEndTick = openRound.freezeEndTick ?? openRound.startTick;
    if (!openRound.warmup && event.tick > openRound.startTick && freezeEndTick <= event.tick) {
      const round: ReplayRound = {
        number:
          event.type === 'round_end' &&
          event.roundNumber !== undefined &&
          openRound.explicitNumber !== undefined &&
          event.roundNumber === openRound.explicitNumber + 1
            ? event.roundNumber
            : openRound.number,
        startTick: openRound.startTick,
        freezeEndTick,
        endTick: event.tick,
      };
      if (event.winner !== undefined) {
        Object.assign(round, { winner: event.winner });
      }
      if (event.reason !== undefined) {
        Object.assign(round, { reason: event.reason });
      }
      rounds.push(round);
    }
    openRound = undefined;
  }

  return rounds;
}

export interface TickRange {
  readonly startTick: number;
  readonly endTick: number;
}

export function getRoundPlaybackRange(round: ReplayRound): TickRange {
  return { startTick: round.freezeEndTick, endTick: round.endTick };
}

export function findRoundAtTick(
  rounds: readonly ReplayRound[],
  tick: number,
): ReplayRound | undefined {
  return rounds.find((round) => tick >= round.freezeEndTick && tick <= round.endTick);
}
