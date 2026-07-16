import { describe, expect, it } from 'vitest';

import { ReplayError, type ReplayV1 } from '../replay/types';
import { isParserMessage, parserErrorPayload, replayTransferables } from './protocol';

function replayFixture(): ReplayV1 {
  return {
    schemaVersion: 1,
    meta: {
      fileName: 'match.dem',
      mapName: 'de_mirage',
      tickRate: 64,
      durationTicks: 8,
    },
    players: [],
    rounds: [],
    events: [],
    frames: {
      ticks: Uint32Array.of(8),
      playerCount: 0,
      x: new Float32Array(),
      y: new Float32Array(),
      z: new Float32Array(),
      yaw: new Float32Array(),
      health: new Uint8Array(),
      armor: new Uint8Array(),
      team: new Uint8Array(),
      flags: new Uint8Array(),
    },
  };
}

describe('parser protocol', () => {
  it('narrows each valid worker message variant', () => {
    expect(isParserMessage({ type: 'progress', stage: 'events' })).toBe(true);
    expect(isParserMessage({ type: 'result', replay: replayFixture() })).toBe(true);
    expect(
      isParserMessage({
        type: 'error',
        error: { code: 'UNSUPPORTED_MAP', message: 'Mirage only' },
      }),
    ).toBe(true);
  });

  it.each([
    null,
    {},
    { type: 'progress', stage: 'unknown' },
    { type: 'result', replay: { schemaVersion: 2 } },
    { type: 'error', error: { code: 'UNKNOWN', message: 'nope' } },
    { type: 'error', error: { code: 'PARSER_FAILED', message: 1 } },
  ])('rejects malformed messages', (message) => {
    expect(isParserMessage(message)).toBe(false);
  });

  it('preserves public errors and classifies runtime failures', () => {
    expect(parserErrorPayload(new ReplayError('UNSUPPORTED_MAP', 'Dust 2'))).toEqual({
      code: 'UNSUPPORTED_MAP',
      message: 'Dust 2',
    });
    expect(parserErrorPayload(new RangeError('allocation failed')).code).toBe('OUT_OF_MEMORY');
    expect(parserErrorPayload(new Error('wasm out of memory')).code).toBe('OUT_OF_MEMORY');
    expect(parserErrorPayload(new Error('unexpected EOF at packet'))).toEqual({
      code: 'INVALID_DEMO',
      message: 'The demo is corrupt, truncated, or incomplete.',
    });
    expect(parserErrorPayload(new Error('DemoEndsEarly("demo ends early")'))).toEqual({
      code: 'INVALID_DEMO',
      message: 'The demo is corrupt, truncated, or incomplete.',
    });
    expect(parserErrorPayload(new Error('ClassMapperNotFoundFirstPass'))).toEqual({
      code: 'INVALID_DEMO',
      message: 'The demo is corrupt, truncated, or incomplete.',
    });
    expect(parserErrorPayload('plain failure')).toEqual({
      code: 'PARSER_FAILED',
      message: 'The demo parser could not read this file.',
    });
  });

  it('returns each typed-array buffer only once', () => {
    const replay = replayFixture();
    const transferables = replayTransferables(replay);
    expect(transferables).toHaveLength(new Set(transferables).size);
    expect(transferables).toContain(replay.frames.ticks.buffer);
  });
});
