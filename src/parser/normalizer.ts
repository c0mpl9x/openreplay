import { pairRoundEvents, type RawRoundEvent } from '../replay/rounds';
import {
  createEmptyReplayFrames,
  selectSampleTicks,
  type RawPlayerSnapshot,
} from '../replay/sampling';
import {
  ReplayError,
  ReplayFrameFlags,
  type Bombsite,
  type ReplayEvent,
  type ReplayPlayer,
  type ReplayRound,
  type ReplayV1,
  type TeamNumber,
} from '../replay/types';

export type RawParserRow = Readonly<Record<string, unknown>>;

export interface NormalizationInput {
  readonly fileName: string;
  readonly header: RawParserRow;
  readonly eventRows: readonly RawParserRow[];
  readonly tickRows: readonly RawParserRow[];
  readonly rounds: readonly ReplayRound[];
  readonly sampleTicks: Uint32Array;
}

const MAX_UINT32 = 0xffff_ffff;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Map)
  );
}

function mapRecord(value: unknown): RawParserRow | undefined {
  if (!(value instanceof Map)) {
    return undefined;
  }
  const entries = [...value.entries()];
  if (entries.some(([key]) => typeof key !== 'string')) {
    return undefined;
  }
  return Object.fromEntries(entries) as RawParserRow;
}

export function parserRecord(value: unknown, label: string): RawParserRow {
  if (isRecord(value)) {
    return value;
  }
  const mapped = mapRecord(value);
  if (mapped !== undefined) {
    return mapped;
  }
  throw new ReplayError('PARSER_FAILED', `demoparser2 returned an invalid ${label} response.`);
}

export function parserRows(value: unknown, label: string): RawParserRow[] {
  if (!Array.isArray(value)) {
    throw new ReplayError('PARSER_FAILED', `demoparser2 returned an invalid ${label} response.`);
  }
  return value.map((row) => parserRecord(row, label));
}

function firstValue(row: RawParserRow, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const result = value.trim();
    return result.length > 0 ? result : undefined;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return undefined;
}

function stringField(row: RawParserRow, ...keys: string[]): string | undefined {
  return asString(firstValue(row, keys));
}

function numberField(row: RawParserRow, ...keys: string[]): number | undefined {
  const value = firstValue(row, keys);
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'bigint') {
    const result = Number(value);
    return Number.isSafeInteger(result) ? result : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const result = Number(value);
    return Number.isFinite(result) ? result : undefined;
  }
  return undefined;
}

function booleanField(row: RawParserRow, ...keys: string[]): boolean | undefined {
  const value = firstValue(row, keys);
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLocaleLowerCase('en-US');
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }
  return undefined;
}

function uint32Field(row: RawParserRow, ...keys: string[]): number | undefined {
  const value = numberField(row, ...keys);
  return value !== undefined && Number.isInteger(value) && value >= 0 && value <= MAX_UINT32
    ? value
    : undefined;
}

function teamValue(value: unknown): TeamNumber | undefined {
  if (value === 2 || value === '2') {
    return 2;
  }
  if (value === 3 || value === '3') {
    return 3;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLocaleUpperCase('en-US');
  if (normalized === 'T' || normalized === 'TERRORIST' || normalized === 'TERRORISTS') {
    return 2;
  }
  if (
    normalized === 'CT' ||
    normalized === 'COUNTERTERRORIST' ||
    normalized === 'COUNTER-TERRORIST' ||
    normalized === 'COUNTER-TERRORISTS'
  ) {
    return 3;
  }
  return undefined;
}

function teamField(row: RawParserRow, ...keys: string[]): TeamNumber | undefined {
  return teamValue(firstValue(row, keys));
}

function eventName(row: RawParserRow): string | undefined {
  return stringField(row, 'event_name', 'eventName', 'type');
}

function eventRoundNumber(row: RawParserRow): number | undefined {
  // demoparser2 exposes the current round as `round` for some GOTV demos.
  // `total_rounds_played` is not equivalent: on round_end it may already
  // include the round that is ending.
  const explicit = numberField(row, 'round_number', 'roundNumber', 'round');
  if (explicit !== undefined && Number.isSafeInteger(explicit) && explicit >= 1) {
    return explicit;
  }

  const completed = numberField(row, 'total_rounds_played');
  if (completed !== undefined && Number.isSafeInteger(completed) && completed >= 0) {
    return completed + 1;
  }
  return undefined;
}

/** Validate metadata that is only available after the wasm header parse. */
export function assertSupportedHeader(header: RawParserRow): void {
  const stamp = stringField(header, 'demo_file_stamp');
  if (stamp === undefined || !stamp.startsWith('PBDEMS2')) {
    throw new ReplayError('INVALID_DEMO', 'The parser could not verify the CS2 demo header.');
  }

  const clientName = stringField(header, 'client_name')?.toLocaleLowerCase('en-US');
  if (
    clientName === undefined ||
    (!clientName.includes('sourcetv') && !clientName.includes('gotv'))
  ) {
    throw new ReplayError(
      'UNSUPPORTED_DEMO_TYPE',
      'This appears to be a POV demo. Only CS2 GOTV demos are supported.',
    );
  }

  const mapName = stringField(header, 'map_name')?.toLocaleLowerCase('en-US');
  if (mapName !== 'de_mirage') {
    throw new ReplayError(
      'UNSUPPORTED_MAP',
      mapName === undefined
        ? 'The demo does not declare a map. OpenReplay v0.1 supports de_mirage only.'
        : `The map ${mapName} is not supported yet. OpenReplay v0.1 supports de_mirage only.`,
    );
  }
}

export function roundEventsFromRows(rows: readonly RawParserRow[]): RawRoundEvent[] {
  const result: RawRoundEvent[] = [];
  for (const row of rows) {
    const name = eventName(row);
    if (name !== 'round_start' && name !== 'round_freeze_end' && name !== 'round_end') {
      continue;
    }

    const tick = uint32Field(row, 'tick');
    if (tick === undefined) {
      continue;
    }

    const shared = {
      tick,
      roundNumber: eventRoundNumber(row),
      warmup: booleanField(row, 'is_warmup_period', 'warmup'),
    };
    if (name === 'round_end') {
      result.push({
        type: name,
        ...shared,
        winner: teamField(row, 'winner', 'winner_team'),
        reason: stringField(row, 'reason', 'round_win_reason'),
      });
    } else {
      result.push({ type: name, ...shared });
    }
  }
  return result;
}

export function replayRoundsFromRows(rows: readonly RawParserRow[]): ReplayRound[] {
  return pairRoundEvents(roundEventsFromRows(rows));
}

export function selectReplaySampleTicks(
  rounds: readonly ReplayRound[],
  eventRows: readonly RawParserRow[],
): Uint32Array {
  const eventTicks = eventRows
    .map((row) => uint32Field(row, 'tick'))
    .filter((tick): tick is number => tick !== undefined);
  const ticks = new Set<number>();

  for (const round of rounds) {
    const roundTicks = selectSampleTicks({
      startTick: round.freezeEndTick,
      endTick: round.endTick,
      eventTicks,
    });
    roundTicks.forEach((tick) => ticks.add(tick));
  }

  return Uint32Array.from([...ticks].sort((left, right) => left - right));
}

interface PlayerIdentity {
  readonly steamId?: string;
  readonly name?: string;
}

interface MutablePlayer {
  readonly id: number;
  steamId: string;
  name: string;
}

class PlayerRegistry {
  public readonly players: MutablePlayer[] = [];
  private readonly bySteamId = new Map<string, MutablePlayer>();
  private readonly byName = new Map<string, MutablePlayer>();
  private readonly ambiguousNames = new Set<string>();

  public add(identity: PlayerIdentity): MutablePlayer | undefined {
    const steamId = identity.steamId === '0' ? undefined : identity.steamId;
    const name = identity.name?.trim();
    if (steamId === undefined && (name === undefined || /^(world|console|unknown)$/iu.test(name))) {
      return undefined;
    }

    let player: MutablePlayer | undefined;
    if (steamId !== undefined) {
      player = this.bySteamId.get(steamId);
      const nameCandidate =
        name === undefined || this.ambiguousNames.has(name) ? undefined : this.byName.get(name);
      if (
        player === undefined &&
        nameCandidate !== undefined &&
        (nameCandidate.steamId.length === 0 || nameCandidate.steamId === steamId)
      ) {
        player = nameCandidate;
      }
    } else if (name !== undefined && !this.ambiguousNames.has(name)) {
      player = this.byName.get(name);
    }
    if (player === undefined) {
      player = {
        id: this.players.length,
        steamId: steamId ?? '',
        name: name ?? `Player ${String(this.players.length + 1)}`,
      };
      this.players.push(player);
    } else {
      if (player.steamId.length === 0 && steamId !== undefined) {
        player.steamId = steamId;
      }
      if (player.name.startsWith('Player ') && name !== undefined) {
        player.name = name;
      }
    }

    if (steamId !== undefined) {
      this.bySteamId.set(steamId, player);
    }
    if (name !== undefined) {
      const existing = this.byName.get(name);
      if (existing === undefined && !this.ambiguousNames.has(name)) {
        this.byName.set(name, player);
      } else if (existing !== undefined && existing !== player) {
        this.byName.delete(name);
        this.ambiguousNames.add(name);
      }
    }
    return player;
  }
}

function tickIdentity(row: RawParserRow): PlayerIdentity {
  return {
    steamId: stringField(row, 'steamid', 'player_steamid'),
    name: stringField(row, 'name', 'player_name'),
  };
}

function roleIdentity(row: RawParserRow, role: string): PlayerIdentity {
  return {
    steamId: stringField(row, `${role}_steamid`, `${role}SteamId`),
    name: stringField(row, `${role}_name`, `${role}Name`),
  };
}

function bombPlayerIdentity(row: RawParserRow): PlayerIdentity {
  const user = roleIdentity(row, 'user');
  return {
    steamId: user.steamId ?? stringField(row, 'player_steamid', 'steamid'),
    name: user.name ?? stringField(row, 'player_name', 'name'),
  };
}

function buildPlayerRegistry(
  tickRows: readonly RawParserRow[],
  eventRows: readonly RawParserRow[],
): PlayerRegistry {
  const registry = new PlayerRegistry();
  for (const row of tickRows) {
    if (teamField(row, 'team_num', 'team_number', 'team') !== undefined) {
      registry.add(tickIdentity(row));
    }
  }
  for (const row of eventRows) {
    const name = eventName(row);
    if (name === 'player_death') {
      registry.add(roleIdentity(row, 'user'));
      registry.add(roleIdentity(row, 'attacker'));
      registry.add(roleIdentity(row, 'assister'));
    } else if (name === 'bomb_planted' || name === 'bomb_defused' || name === 'bomb_exploded') {
      registry.add(bombPlayerIdentity(row));
    }
  }
  return registry;
}

function snapshotFromRow(
  row: RawParserRow,
  registry: PlayerRegistry,
): RawPlayerSnapshot | undefined {
  const tick = uint32Field(row, 'tick');
  const team = teamField(row, 'team_num', 'team_number', 'team');
  if (team === undefined) {
    return undefined;
  }
  const player = registry.add(tickIdentity(row));
  if (tick === undefined || player === undefined) {
    return undefined;
  }

  const health = numberField(row, 'health') ?? 0;
  return {
    tick,
    playerId: player.id,
    x: numberField(row, 'X', 'x') ?? Number.NaN,
    y: numberField(row, 'Y', 'y') ?? Number.NaN,
    z: numberField(row, 'Z', 'z') ?? Number.NaN,
    yaw: numberField(row, 'yaw') ?? Number.NaN,
    health,
    armor: numberField(row, 'armor_value', 'armor') ?? 0,
    team,
    alive: booleanField(row, 'is_alive', 'alive') ?? health > 0,
  };
}

function toByte(value: number): number {
  return Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) : 0;
}

function compactRows(rows: readonly RawParserRow[], registry: PlayerRegistry, ticks: Uint32Array) {
  const frames = createEmptyReplayFrames(ticks, registry.players.length);
  const frameByTick = new Map<number, number>();
  ticks.forEach((tick, index) => frameByTick.set(tick, index));

  for (const row of rows) {
    const snapshot = snapshotFromRow(row, registry);
    if (snapshot === undefined) {
      continue;
    }
    const frameIndex = frameByTick.get(snapshot.tick);
    if (frameIndex === undefined) {
      continue;
    }

    const offset = frameIndex * frames.playerCount + snapshot.playerId;
    const present =
      Number.isFinite(snapshot.x) &&
      Number.isFinite(snapshot.y) &&
      Number.isFinite(snapshot.z) &&
      Number.isFinite(snapshot.yaw);
    if (!present) {
      continue;
    }

    frames.x[offset] = snapshot.x;
    frames.y[offset] = snapshot.y;
    frames.z[offset] = snapshot.z;
    frames.yaw[offset] = snapshot.yaw;
    frames.health[offset] = toByte(snapshot.health);
    frames.armor[offset] = toByte(snapshot.armor);
    frames.team[offset] = snapshot.team ?? 0;
    frames.flags[offset] =
      ReplayFrameFlags.Present | (snapshot.alive === true ? ReplayFrameFlags.Alive : 0);
  }
  return frames;
}

function roundAtTick(rounds: readonly ReplayRound[], tick: number): ReplayRound | undefined {
  return rounds.find((round) => tick >= round.freezeEndTick && tick <= round.endTick);
}

function siteField(row: RawParserRow): Bombsite | undefined {
  const place = stringField(
    row,
    'user_last_place_name',
    'last_place_name',
    'site',
    'bombsite',
    'bomb_site',
  )?.toLocaleUpperCase('en-US');
  if (place === 'A' || place === 'B') {
    return place;
  }
  if (place === 'BOMBSITEA') {
    return 'A';
  }
  if (place === 'BOMBSITEB') {
    return 'B';
  }

  return undefined;
}

function normalizeEvents(
  rows: readonly RawParserRow[],
  rounds: readonly ReplayRound[],
  registry: PlayerRegistry,
): ReplayEvent[] {
  const result: ReplayEvent[] = [];
  const activeBombsite = new Map<number, Bombsite>();
  const orderedRows = [...rows].sort(
    (left, right) => (uint32Field(left, 'tick') ?? 0) - (uint32Field(right, 'tick') ?? 0),
  );
  for (const row of orderedRows) {
    const name = eventName(row);
    const tick = uint32Field(row, 'tick');
    if (tick === undefined) {
      continue;
    }
    const round = roundAtTick(rounds, tick);
    if (round === undefined) {
      continue;
    }

    if (name === 'player_death') {
      const victim = registry.add(roleIdentity(row, 'user'));
      if (victim === undefined) {
        continue;
      }
      const killer = registry.add(roleIdentity(row, 'attacker'));
      const assister = registry.add(roleIdentity(row, 'assister'));
      const weapon = stringField(row, 'weapon');
      result.push({
        type: 'kill',
        tick,
        roundNumber: round.number,
        victimId: victim.id,
        headshot: booleanField(row, 'headshot') ?? false,
        ...(killer === undefined ? {} : { killerId: killer.id }),
        ...(assister === undefined ? {} : { assisterId: assister.id }),
        ...(weapon === undefined ? {} : { weapon }),
      });
      continue;
    }

    if (name === 'bomb_planted' || name === 'bomb_defused' || name === 'bomb_exploded') {
      const player = registry.add(bombPlayerIdentity(row));
      const parsedSite = siteField(row);
      if (name === 'bomb_planted' && parsedSite !== undefined) {
        activeBombsite.set(round.number, parsedSite);
      }
      // `site` itself is a map-entity index, not a stable A/B enum. Defuse and
      // explosion events can report CTSpawn for the actor, so carry forward the
      // site resolved from the preceding plant in the same round.
      const site = parsedSite ?? activeBombsite.get(round.number);
      result.push({
        type: name,
        tick,
        roundNumber: round.number,
        ...(player === undefined ? {} : { playerId: player.id }),
        ...(site === undefined ? {} : { site }),
      });
      if (name !== 'bomb_planted') {
        activeBombsite.delete(round.number);
      }
    }
  }
  return result.sort((left, right) => left.tick - right.tick);
}

export function normalizeReplay(input: NormalizationInput): ReplayV1 {
  if (input.rounds.length === 0) {
    throw new ReplayError(
      'INVALID_DEMO',
      'The demo does not contain any complete non-warmup rounds.',
    );
  }
  if (input.sampleTicks.length === 0) {
    throw new ReplayError('INVALID_DEMO', 'The demo does not contain playable ticks.');
  }

  const registry = buildPlayerRegistry(input.tickRows, input.eventRows);
  if (registry.players.length === 0) {
    throw new ReplayError('INVALID_DEMO', 'No CS2 players were found in the demo.');
  }

  const frames = compactRows(input.tickRows, registry, input.sampleTicks);
  if (!frames.flags.some((flags) => (flags & ReplayFrameFlags.Present) !== 0)) {
    throw new ReplayError('INVALID_DEMO', 'The demo does not contain finite player positions.');
  }

  const serverName = stringField(input.header, 'server_name');
  const tickRate = numberField(input.header, 'playback_ticks_per_second', 'tick_rate', 'tickrate');
  const players: readonly ReplayPlayer[] = registry.players.map((player) => ({
    id: player.id,
    steamId: player.steamId,
    name: player.name,
  }));
  const lastRound = input.rounds[input.rounds.length - 1];

  return {
    schemaVersion: 1,
    meta: {
      fileName: input.fileName,
      mapName: 'de_mirage',
      ...(serverName === undefined ? {} : { serverName }),
      tickRate: tickRate !== undefined && tickRate > 0 ? tickRate : 64,
      durationTicks: lastRound?.endTick ?? input.sampleTicks[input.sampleTicks.length - 1] ?? 0,
    },
    players,
    rounds: input.rounds,
    events: normalizeEvents(input.eventRows, input.rounds, registry),
    frames,
  };
}
