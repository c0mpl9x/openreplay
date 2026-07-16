import type { ReplayV1 } from '../replay/types';
import { ReplayError } from '../replay/types';
import { validateDemoFile } from '../replay/validation';
import {
  assertSupportedHeader,
  normalizeReplay,
  parserRecord,
  parserRows,
  replayRoundsFromRows,
  selectReplaySampleTicks,
} from './normalizer';
import type { ParseRequest, ParserStage } from './protocol';

export interface DemoparserBindings {
  parseHeader(bytes: Uint8Array): unknown;
  parseEvents(
    bytes: Uint8Array,
    eventNames?: string[],
    playerProperties?: string[],
    otherProperties?: string[],
  ): unknown;
  parseTicks(
    bytes: Uint8Array,
    properties?: string[],
    ticks?: Int32Array,
    players?: string[],
    structOfArrays?: boolean,
  ): unknown;
}

export type StageReporter = (stage: ParserStage) => void;

export const PARSED_EVENT_NAMES = [
  'round_start',
  'round_freeze_end',
  'round_end',
  'player_death',
  'bomb_planted',
  'bomb_defused',
  'bomb_exploded',
] as const;

export const PARSED_PLAYER_PROPERTIES = [
  'X',
  'Y',
  'Z',
  'yaw',
  'health',
  'armor_value',
  'is_alive',
  'team_num',
] as const;

export const PARSED_EVENT_PLAYER_PROPERTIES = ['last_place_name'] as const;

export const PARSED_EVENT_PROPERTIES = [
  'total_rounds_played',
  'is_warmup_period',
  'round_win_reason',
] as const;

export function validateParseRequest(request: ParseRequest): Uint8Array {
  if (request.type !== 'parse' || !(request.buffer instanceof ArrayBuffer)) {
    throw new ReplayError('INVALID_DEMO', 'The parser received an invalid file request.');
  }
  if (request.buffer.byteLength !== request.size) {
    throw new ReplayError(
      'INVALID_DEMO',
      'The transferred demo size does not match the selected file.',
    );
  }

  const bytes = new Uint8Array(request.buffer);
  validateDemoFile(request, bytes.subarray(0, 8));
  return bytes;
}

/** Run the current demoparser2 query API and normalize its untyped output. */
export function parseReplayWithBindings(
  request: ParseRequest,
  bindings: DemoparserBindings,
  report: StageReporter,
): ReplayV1 {
  report('validating');
  const bytes = validateParseRequest(request);

  report('metadata');
  const header = parserRecord(bindings.parseHeader(bytes), 'header');
  assertSupportedHeader(header);

  report('events');
  const eventRows = parserRows(
    bindings.parseEvents(
      bytes,
      [...PARSED_EVENT_NAMES],
      [...PARSED_EVENT_PLAYER_PROPERTIES],
      [...PARSED_EVENT_PROPERTIES],
    ),
    'events',
  );
  const rounds = replayRoundsFromRows(eventRows);
  if (rounds.length === 0) {
    throw new ReplayError(
      'INVALID_DEMO',
      'The demo does not contain any complete non-warmup rounds.',
    );
  }
  const sampleTicks = selectReplaySampleTicks(rounds, eventRows);
  if (sampleTicks.some((tick) => tick > 0x7fff_ffff)) {
    throw new ReplayError('INVALID_DEMO', 'The demo tick range is not supported.');
  }

  report('positions');
  const tickRows = parserRows(
    bindings.parseTicks(
      bytes,
      [...PARSED_PLAYER_PROPERTIES],
      Int32Array.from(sampleTicks),
      [],
      false,
    ),
    'player positions',
  );

  report('normalizing');
  return normalizeReplay({
    fileName: request.fileName,
    header,
    eventRows,
    tickRows,
    rounds,
    sampleTicks,
  });
}
