import { ReplayFrameFlags, type ReplayFrames, type ReplayPlayer, type TeamNumber } from './types';

export const DEFAULT_SAMPLE_INTERVAL_TICKS = 8;

const MAX_UINT32 = 0xffff_ffff;

export interface SampleTickOptions {
  readonly startTick: number;
  readonly endTick: number;
  readonly eventTicks?: Iterable<number>;
  readonly intervalTicks?: number;
}

export interface RawPlayerSnapshot {
  readonly tick: number;
  readonly playerId: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly health: number;
  readonly armor: number;
  readonly team?: TeamNumber;
  readonly present?: boolean;
  readonly alive?: boolean;
}

export interface CompactSnapshotOptions extends SampleTickOptions {
  readonly players: readonly ReplayPlayer[];
  readonly snapshots: Iterable<RawPlayerSnapshot>;
}

function assertTick(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_UINT32) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer.`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
}

/**
 * Select regular samples anchored at startTick, plus exact event ticks and the
 * end boundary. The result is unique and monotonically increasing.
 */
export function selectSampleTicks({
  startTick,
  endTick,
  eventTicks = [],
  intervalTicks = DEFAULT_SAMPLE_INTERVAL_TICKS,
}: SampleTickOptions): Uint32Array {
  assertTick(startTick, 'startTick');
  assertTick(endTick, 'endTick');
  assertPositiveInteger(intervalTicks, 'intervalTicks');

  if (endTick < startTick) {
    throw new RangeError('endTick must be greater than or equal to startTick.');
  }

  const selected = new Set<number>();
  for (let tick = startTick; tick <= endTick; tick += intervalTicks) {
    selected.add(tick);

    // Avoid a precision/overflow loop when endTick is near Uint32.MAX_VALUE.
    if (endTick - tick < intervalTicks) {
      break;
    }
  }
  selected.add(endTick);

  for (const eventTick of eventTicks) {
    assertTick(eventTick, 'eventTick');
    if (eventTick >= startTick && eventTick <= endTick) {
      selected.add(eventTick);
    }
  }

  return Uint32Array.from([...selected].sort((left, right) => left - right));
}

export function createEmptyReplayFrames(ticks: Uint32Array, playerCount: number): ReplayFrames {
  if (!Number.isSafeInteger(playerCount) || playerCount < 0) {
    throw new RangeError('playerCount must be a non-negative integer.');
  }

  for (let index = 1; index < ticks.length; index += 1) {
    const previous = ticks[index - 1];
    const current = ticks[index];
    if (previous === undefined || current === undefined || current <= previous) {
      throw new RangeError('Frame ticks must be strictly increasing.');
    }
  }

  const length = ticks.length * playerCount;
  if (!Number.isSafeInteger(length)) {
    throw new RangeError('Frame matrix is too large.');
  }

  const x = new Float32Array(length);
  const y = new Float32Array(length);
  const z = new Float32Array(length);
  const yaw = new Float32Array(length);
  x.fill(Number.NaN);
  y.fill(Number.NaN);
  z.fill(Number.NaN);
  yaw.fill(Number.NaN);

  return {
    ticks: ticks.slice(),
    playerCount,
    x,
    y,
    z,
    yaw,
    health: new Uint8Array(length),
    armor: new Uint8Array(length),
    team: new Uint8Array(length),
    flags: new Uint8Array(length),
  };
}

function toByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(255, Math.max(0, Math.round(value)));
}

function hasFiniteTransform(snapshot: RawPlayerSnapshot): boolean {
  return (
    Number.isFinite(snapshot.x) &&
    Number.isFinite(snapshot.y) &&
    Number.isFinite(snapshot.z) &&
    Number.isFinite(snapshot.yaw)
  );
}

/**
 * Compact exact-tick parser snapshots into typed frame matrices. Snapshots for
 * ticks that were not selected and unknown player ids are intentionally ignored.
 * If a parser emits a duplicate player/tick pair, the last value wins.
 */
export function compactPlayerSnapshots(options: CompactSnapshotOptions): ReplayFrames {
  const ticks = selectSampleTicks(options);
  const frames = createEmptyReplayFrames(ticks, options.players.length);
  const tickToFrame = new Map<number, number>();
  const playerToColumn = new Map<number, number>();

  ticks.forEach((tick, frameIndex) => tickToFrame.set(tick, frameIndex));
  options.players.forEach((player, playerIndex) => {
    if (playerToColumn.has(player.id)) {
      throw new RangeError(`Duplicate player id ${String(player.id)}.`);
    }
    playerToColumn.set(player.id, playerIndex);
  });

  for (const snapshot of options.snapshots) {
    const frameIndex = tickToFrame.get(snapshot.tick);
    const playerIndex = playerToColumn.get(snapshot.playerId);
    if (frameIndex === undefined || playerIndex === undefined) {
      continue;
    }

    const offset = frameIndex * frames.playerCount + playerIndex;
    const present = snapshot.present !== false && hasFiniteTransform(snapshot);
    if (!present) {
      frames.x[offset] = Number.NaN;
      frames.y[offset] = Number.NaN;
      frames.z[offset] = Number.NaN;
      frames.yaw[offset] = Number.NaN;
      frames.health[offset] = 0;
      frames.armor[offset] = 0;
      frames.team[offset] = 0;
      frames.flags[offset] = 0;
      continue;
    }

    const health = toByte(snapshot.health);
    const alive = snapshot.alive ?? health > 0;
    frames.x[offset] = snapshot.x;
    frames.y[offset] = snapshot.y;
    frames.z[offset] = snapshot.z;
    frames.yaw[offset] = snapshot.yaw;
    frames.health[offset] = health;
    frames.armor[offset] = toByte(snapshot.armor);
    frames.team[offset] = snapshot.team ?? 0;
    frames.flags[offset] = ReplayFrameFlags.Present | (alive ? ReplayFrameFlags.Alive : 0);
  }

  return frames;
}

export function assertReplayFrames(frames: ReplayFrames): void {
  if (!Number.isSafeInteger(frames.playerCount) || frames.playerCount < 0) {
    throw new RangeError('playerCount must be a non-negative integer.');
  }

  const expectedLength = frames.ticks.length * frames.playerCount;
  const matrices: readonly ArrayLike<number>[] = [
    frames.x,
    frames.y,
    frames.z,
    frames.yaw,
    frames.health,
    frames.armor,
    frames.team,
    frames.flags,
  ];

  if (matrices.some((matrix) => matrix.length !== expectedLength)) {
    throw new RangeError('Every frame matrix must contain ticks.length * playerCount values.');
  }

  for (let index = 1; index < frames.ticks.length; index += 1) {
    const previous = frames.ticks[index - 1];
    const current = frames.ticks[index];
    if (previous === undefined || current === undefined || current <= previous) {
      throw new RangeError('Frame ticks must be strictly increasing.');
    }
  }
}
