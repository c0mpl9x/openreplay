import { ReplayFrameFlags, type ReplayFrames, type TeamNumber } from './types';

export const DEFAULT_MAX_INTERPOLATION_GAP_TICKS = 8;

export interface FrameWindow {
  readonly previousIndex: number;
  readonly nextIndex: number;
  readonly alpha: number;
}

export interface PlayerFrameState {
  readonly tick: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly health: number;
  readonly armor: number;
  readonly team?: TeamNumber;
  readonly alive: boolean;
  /** False for step transitions such as death, respawn or a team change. */
  readonly interpolated: boolean;
}

export interface InterpolationOptions {
  /** Prevents interpolation across round gaps or missing parser samples. */
  readonly maxGapTicks?: number;
}

function valueAt(values: ArrayLike<number>, index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError('Frame matrix index is out of bounds.');
  }
  return value;
}

function teamNumber(value: number): TeamNumber | undefined {
  return value === 2 || value === 3 ? value : undefined;
}

export function findFrameWindow(ticks: Uint32Array, targetTick: number): FrameWindow | undefined {
  if (!Number.isFinite(targetTick)) {
    throw new RangeError('targetTick must be finite.');
  }
  if (ticks.length === 0) {
    return undefined;
  }

  const firstTick = ticks[0];
  const lastIndex = ticks.length - 1;
  const lastTick = ticks[lastIndex];
  if (firstTick === undefined || lastTick === undefined) {
    return undefined;
  }
  if (targetTick <= firstTick) {
    return { previousIndex: 0, nextIndex: 0, alpha: 0 };
  }
  if (targetTick >= lastTick) {
    return { previousIndex: lastIndex, nextIndex: lastIndex, alpha: 0 };
  }

  let low = 0;
  let high = lastIndex;
  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    const middleTick = ticks[middle];
    if (middleTick === undefined) {
      throw new RangeError('Frame tick index is out of bounds.');
    }
    if (middleTick === targetTick) {
      return { previousIndex: middle, nextIndex: middle, alpha: 0 };
    }
    if (middleTick < targetTick) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const previousIndex = low - 1;
  const nextIndex = low;
  const previousTick = ticks[previousIndex];
  const nextTick = ticks[nextIndex];
  if (previousTick === undefined || nextTick === undefined) {
    throw new RangeError('Unable to bracket target tick.');
  }

  return {
    previousIndex,
    nextIndex,
    alpha: (targetTick - previousTick) / (nextTick - previousTick),
  };
}

export function readPlayerFrame(
  frames: ReplayFrames,
  playerIndex: number,
  frameIndex: number,
): PlayerFrameState | undefined {
  if (!Number.isSafeInteger(playerIndex) || playerIndex < 0 || playerIndex >= frames.playerCount) {
    throw new RangeError('playerIndex is out of bounds.');
  }
  if (!Number.isSafeInteger(frameIndex) || frameIndex < 0 || frameIndex >= frames.ticks.length) {
    throw new RangeError('frameIndex is out of bounds.');
  }

  const offset = frameIndex * frames.playerCount + playerIndex;
  const flags = valueAt(frames.flags, offset);
  if ((flags & ReplayFrameFlags.Present) === 0) {
    return undefined;
  }

  const tick = frames.ticks[frameIndex];
  const x = valueAt(frames.x, offset);
  const y = valueAt(frames.y, offset);
  const z = valueAt(frames.z, offset);
  const yaw = valueAt(frames.yaw, offset);
  if (
    tick === undefined ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z) ||
    !Number.isFinite(yaw)
  ) {
    return undefined;
  }

  const team = teamNumber(valueAt(frames.team, offset));
  return {
    tick,
    x,
    y,
    z,
    yaw,
    health: valueAt(frames.health, offset),
    armor: valueAt(frames.armor, offset),
    ...(team === undefined ? {} : { team }),
    alive: (flags & ReplayFrameFlags.Alive) !== 0,
    interpolated: false,
  };
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

/** Interpolate degrees over the shortest arc and normalize to [0, 360). */
export function interpolateYaw(start: number, end: number, alpha: number): number {
  const shortestDelta = ((end - start + 540) % 360) - 180;
  return (start + shortestDelta * alpha + 360) % 360;
}

/**
 * Return a player's state at a fractional tick.
 *
 * Position/yaw interpolate only when both endpoints are present, alive, on the
 * same team and within the expected sampling gap. Death, respawn and team
 * changes are step transitions; absent/non-finite data returns no state.
 */
export function interpolatePlayerFrame(
  frames: ReplayFrames,
  playerIndex: number,
  targetTick: number,
  { maxGapTicks = DEFAULT_MAX_INTERPOLATION_GAP_TICKS }: InterpolationOptions = {},
): PlayerFrameState | undefined {
  if (!Number.isFinite(maxGapTicks) || maxGapTicks < 0) {
    throw new RangeError('maxGapTicks must be a non-negative finite number.');
  }

  const window = findFrameWindow(frames.ticks, targetTick);
  if (window === undefined) {
    return undefined;
  }
  const previous = readPlayerFrame(frames, playerIndex, window.previousIndex);
  if (previous === undefined) {
    return undefined;
  }
  if (window.previousIndex === window.nextIndex) {
    return { ...previous, tick: targetTick };
  }

  const next = readPlayerFrame(frames, playerIndex, window.nextIndex);
  if (next === undefined) {
    return undefined;
  }
  if (next.tick - previous.tick > maxGapTicks) {
    return undefined;
  }

  const continuous = previous.alive && next.alive && previous.team === next.team;
  if (!continuous) {
    return { ...previous, tick: targetTick };
  }

  return {
    tick: targetTick,
    x: lerp(previous.x, next.x, window.alpha),
    y: lerp(previous.y, next.y, window.alpha),
    z: lerp(previous.z, next.z, window.alpha),
    yaw: interpolateYaw(previous.yaw, next.yaw, window.alpha),
    health: previous.health,
    armor: previous.armor,
    ...(previous.team === undefined ? {} : { team: previous.team }),
    alive: true,
    interpolated: true,
  };
}
