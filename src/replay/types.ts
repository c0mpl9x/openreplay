/** Team numbers used by Source/CS2 network properties. */
export type TeamNumber = 2 | 3;

export const TEAMS = {
  TERRORIST: 2,
  COUNTER_TERRORIST: 3,
} as const satisfies Record<string, TeamNumber>;

/**
 * Flags stored for every player in every frame.
 *
 * A player can be present but dead. An unset Present bit means that the parser
 * did not provide a trustworthy state for that player at that tick.
 */
export const ReplayFrameFlags = {
  Present: 1 << 0,
  Alive: 1 << 1,
} as const;

export type ReplayFrameFlag = (typeof ReplayFrameFlags)[keyof typeof ReplayFrameFlags];

export interface ReplayMeta {
  readonly fileName: string;
  readonly mapName: string;
  readonly serverName?: string;
  readonly tickRate: number;
  readonly durationTicks: number;
}

export interface ReplayPlayer {
  /** Stable numeric identifier used by frame matrices and events. */
  readonly id: number;
  readonly steamId: string;
  readonly name: string;
}

export interface ReplayRound {
  readonly number: number;
  readonly startTick: number;
  /** Always defined after normalization; falls back to startTick. */
  readonly freezeEndTick: number;
  readonly endTick: number;
  readonly winner?: TeamNumber;
  readonly reason?: string;
}

interface ReplayEventBase {
  readonly tick: number;
  readonly roundNumber: number;
}

export interface KillReplayEvent extends ReplayEventBase {
  readonly type: 'kill';
  readonly killerId?: number;
  readonly victimId: number;
  readonly assisterId?: number;
  readonly headshot: boolean;
  readonly weapon?: string;
}

export type Bombsite = 'A' | 'B';

interface BombReplayEventBase extends ReplayEventBase {
  readonly playerId?: number;
  readonly site?: Bombsite;
}

export interface BombPlantedReplayEvent extends BombReplayEventBase {
  readonly type: 'bomb_planted';
}

export interface BombDefusedReplayEvent extends BombReplayEventBase {
  readonly type: 'bomb_defused';
}

export interface BombExplodedReplayEvent extends BombReplayEventBase {
  readonly type: 'bomb_exploded';
}

export type BombReplayEvent =
  BombPlantedReplayEvent | BombDefusedReplayEvent | BombExplodedReplayEvent;

export type ReplayEvent = KillReplayEvent | BombReplayEvent;

/**
 * Column-major-by-frame storage: index = frameIndex * playerCount + playerIndex.
 * `ticks` has one entry per frame. All other arrays have
 * `ticks.length * playerCount` entries. Missing positions are represented by
 * NaN and an unset Present flag.
 */
export interface ReplayFrames {
  readonly ticks: Uint32Array;
  readonly playerCount: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly yaw: Float32Array;
  readonly health: Uint8Array;
  readonly armor: Uint8Array;
  /** Source team number (2/3), or 0 when unavailable. */
  readonly team: Uint8Array;
  readonly flags: Uint8Array;
}

export interface ReplayV1 {
  readonly schemaVersion: 1;
  readonly meta: ReplayMeta;
  readonly players: readonly ReplayPlayer[];
  readonly rounds: readonly ReplayRound[];
  readonly events: readonly ReplayEvent[];
  readonly frames: ReplayFrames;
}

export type ReplayErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_DEMO'
  | 'UNSUPPORTED_DEMO_TYPE'
  | 'UNSUPPORTED_MAP'
  | 'PARSER_FAILED'
  | 'OUT_OF_MEMORY';

export class ReplayError extends Error {
  public readonly code: ReplayErrorCode;

  public constructor(code: ReplayErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ReplayError';
    this.code = code;
  }
}
