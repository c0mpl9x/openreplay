import { ReplayError, type ReplayErrorCode, type ReplayV1 } from '../replay/types';

export type ParserErrorCode = ReplayErrorCode;
export { ReplayError as ParserError };

export type ParserStage = 'validating' | 'metadata' | 'events' | 'positions' | 'normalizing';

/** A single transferable request. A fresh worker handles each request. */
export interface ParseRequest {
  readonly type: 'parse';
  readonly fileName: string;
  readonly size: number;
  readonly buffer: ArrayBuffer;
  /** URL of the wasm-pack generated ES module, resolved by the browser client. */
  readonly wasmModuleUrl: string;
}

export interface ParserErrorPayload {
  readonly code: ParserErrorCode;
  readonly message: string;
}

export type ParserMessage =
  | {
      readonly type: 'progress';
      readonly stage: ParserStage;
    }
  | {
      readonly type: 'result';
      readonly replay: ReplayV1;
    }
  | {
      readonly type: 'error';
      readonly error: ParserErrorPayload;
    };

const ERROR_CODES = new Set<ParserErrorCode>([
  'FILE_TOO_LARGE',
  'INVALID_DEMO',
  'UNSUPPORTED_DEMO_TYPE',
  'UNSUPPORTED_MAP',
  'PARSER_FAILED',
  'OUT_OF_MEMORY',
]);

const STAGES = new Set<ParserStage>([
  'validating',
  'metadata',
  'events',
  'positions',
  'normalizing',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Narrow untrusted messages before exposing them to the application. */
export function isParserMessage(value: unknown): value is ParserMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  if (value.type === 'progress') {
    return typeof value.stage === 'string' && STAGES.has(value.stage as ParserStage);
  }

  if (value.type === 'result') {
    return isRecord(value.replay) && value.replay.schemaVersion === 1;
  }

  if (value.type === 'error' && isRecord(value.error)) {
    return (
      typeof value.error.code === 'string' &&
      ERROR_CODES.has(value.error.code as ParserErrorCode) &&
      typeof value.error.message === 'string'
    );
  }

  return false;
}

export function parserErrorPayload(error: unknown): ParserErrorPayload {
  if (error instanceof ReplayError) {
    return { code: error.code, message: error.message };
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLocaleLowerCase('en-US');

  if (
    error instanceof RangeError ||
    lowerMessage.includes('out of memory') ||
    lowerMessage.includes('memory access out of bounds') ||
    lowerMessage.includes('failed to grow')
  ) {
    return {
      code: 'OUT_OF_MEMORY',
      message:
        'The browser ran out of memory while parsing this demo. Close other tabs or try a smaller file.',
    };
  }

  if (
    lowerMessage.includes('unexpected eof') ||
    lowerMessage.includes('unexpected end') ||
    lowerMessage.includes('demo ends early') ||
    lowerMessage.includes('demoendsearly') ||
    lowerMessage.includes('outofbitserror') ||
    lowerMessage.includes('outofbyteserror') ||
    lowerMessage.includes('failedbyteread') ||
    lowerMessage.includes('classmappernotfoundfirstpass') ||
    lowerMessage.includes('malformedmessage') ||
    lowerMessage.includes('decompressionfailure') ||
    lowerMessage.includes('corrupt') ||
    lowerMessage.includes('invalid demo')
  ) {
    return {
      code: 'INVALID_DEMO',
      message: 'The demo is corrupt, truncated, or incomplete.',
    };
  }

  return {
    code: 'PARSER_FAILED',
    message: 'The demo parser could not read this file.',
  };
}

/** Transfer frame storage back to the main thread instead of cloning it. */
export function replayTransferables(replay: ReplayV1): Transferable[] {
  const buffers = [
    replay.frames.ticks.buffer,
    replay.frames.x.buffer,
    replay.frames.y.buffer,
    replay.frames.z.buffer,
    replay.frames.yaw.buffer,
    replay.frames.health.buffer,
    replay.frames.armor.buffer,
    replay.frames.team.buffer,
    replay.frames.flags.buffer,
  ];

  return [...new Set(buffers)] as Transferable[];
}
