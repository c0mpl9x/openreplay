import { compactPlayerSnapshots, selectSampleTicks, type RawPlayerSnapshot } from './sampling';
import {
  ReplayFrameFlags,
  TEAMS,
  type ReplayEvent,
  type ReplayPlayer,
  type ReplayRound,
  type ReplayV1,
  type TeamNumber,
} from './types';

const players: readonly ReplayPlayer[] = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  steamId: `765611980000000${String(index).padStart(2, '0')}`,
  name: `Player ${String(index + 1)}`,
}));

const rounds: readonly ReplayRound[] = [
  {
    number: 1,
    startTick: 0,
    freezeEndTick: 16,
    endTick: 96,
    winner: TEAMS.COUNTER_TERRORIST,
    reason: 'bomb_defused',
  },
  {
    number: 2,
    startTick: 112,
    freezeEndTick: 128,
    endTick: 208,
    winner: TEAMS.TERRORIST,
    reason: 'target_bombed',
  },
];

const events: readonly ReplayEvent[] = [
  {
    type: 'kill',
    tick: 43,
    roundNumber: 1,
    killerId: 6,
    victimId: 1,
    headshot: true,
    weapon: 'ak47',
  },
  {
    type: 'bomb_planted',
    tick: 57,
    roundNumber: 1,
    playerId: 2,
    site: 'A',
  },
  {
    type: 'kill',
    tick: 67,
    roundNumber: 1,
    killerId: 3,
    victimId: 8,
    assisterId: 4,
    headshot: false,
    weapon: 'm4a1_silencer',
  },
  {
    type: 'bomb_defused',
    tick: 89,
    roundNumber: 1,
    playerId: 9,
    site: 'A',
  },
  {
    type: 'kill',
    tick: 151,
    roundNumber: 2,
    killerId: 6,
    victimId: 1,
    headshot: false,
    weapon: 'ak47',
  },
  {
    type: 'bomb_planted',
    tick: 167,
    roundNumber: 2,
    playerId: 7,
    site: 'B',
  },
  {
    type: 'bomb_exploded',
    tick: 201,
    roundNumber: 2,
    site: 'B',
  },
];

function teamFor(playerId: number, secondHalf: boolean): TeamNumber {
  const startsT = playerId <= 5;
  const isT = secondHalf ? !startsT : startsT;
  return isT ? TEAMS.TERRORIST : TEAMS.COUNTER_TERRORIST;
}

function deathTickFor(playerId: number, secondHalf: boolean): number | undefined {
  if (!secondHalf && playerId === 1) return 43;
  if (!secondHalf && playerId === 8) return 67;
  if (secondHalf && playerId === 1) return 151;
  return undefined;
}

function snapshotAt(tick: number, player: ReplayPlayer): RawPlayerSnapshot | undefined {
  const inFirstRound = tick >= 0 && tick <= 96;
  const inSecondRound = tick >= 112 && tick <= 208;
  if (!inFirstRound && !inSecondRound) {
    return undefined;
  }

  const secondHalf = inSecondRound;
  const roundStart = secondHalf ? 112 : 0;
  const progress = (tick - roundStart) / 96;
  const team = teamFor(player.id, secondHalf);
  const slot = (player.id - 1) % 5;
  const lane = slot - 2;
  const travel = progress * 760;
  const tDirection = team === TEAMS.TERRORIST ? 1 : -1;
  const deathTick = deathTickFor(player.id, secondHalf);
  const alive = deathTick === undefined || tick < deathTick;

  return {
    tick,
    playerId: player.id,
    x: -1270 + lane * 165 + tDirection * travel,
    y: -720 + lane * 145 - tDirection * travel * 0.55,
    z: 16 + (slot % 2) * 8,
    yaw: team === TEAMS.TERRORIST ? 35 + slot * 8 : 215 + slot * 8,
    health: alive ? Math.max(28, 100 - Math.floor(progress * slot * 11)) : 0,
    armor: 100 - slot * 7,
    team,
    alive,
  };
}

/**
 * A small deterministic replay used by unit tests, Storybook-like development
 * and browser E2E tests. It exercises irregular event ticks, deaths, a round
 * gap, a side swap and all three bomb outcomes without loading a real demo.
 */
export function createSyntheticReplay(): ReplayV1 {
  const eventTicks = events.map(({ tick }) => tick);
  const ticks = selectSampleTicks({ startTick: 0, endTick: 208, eventTicks });
  const snapshots: RawPlayerSnapshot[] = [];
  for (const tick of ticks) {
    for (const player of players) {
      const snapshot = snapshotAt(tick, player);
      if (snapshot !== undefined) {
        snapshots.push(snapshot);
      }
    }
  }

  const frames = compactPlayerSnapshots({
    startTick: 0,
    endTick: 208,
    eventTicks,
    players,
    snapshots,
  });

  // Assert the fixture itself keeps the two distinct missing-data semantics.
  // (This also protects E2E consumers from an accidentally empty fixture.)
  if (
    frames.flags.every((flags) => (flags & ReplayFrameFlags.Present) === 0) ||
    frames.ticks.length === 0
  ) {
    throw new Error('Synthetic replay generation failed.');
  }

  return {
    schemaVersion: 1,
    meta: {
      fileName: 'synthetic-de-mirage.dem',
      mapName: 'de_mirage',
      serverName: 'OpenReplay deterministic fixture',
      tickRate: 64,
      durationTicks: 208,
    },
    players: players.map((player) => ({ ...player })),
    rounds: rounds.map((round) => ({ ...round })),
    events: events.map((event) => ({ ...event })),
    frames,
  };
}
