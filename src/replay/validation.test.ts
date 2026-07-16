import { describe, expect, it } from 'vitest';

import { ReplayError } from './types';
import {
  MAX_DEMO_BYTES,
  SOURCE_2_DEMO_SIGNATURE,
  isSource2DemoSignature,
  validateDemoFile,
  validateDemoMetadata,
  validateDemoSignature,
} from './validation';

function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

describe('demo validation', () => {
  it('accepts case-insensitive .dem metadata at both size boundaries', () => {
    expect(() => validateDemoMetadata({ name: 'match.DEM', size: 1 })).not.toThrow();
    expect(() => validateDemoMetadata({ name: 'match.dem', size: MAX_DEMO_BYTES })).not.toThrow();
  });

  it('rejects compressed and unrelated file extensions', () => {
    for (const name of ['match.dem.gz', 'match.zip', 'match', '.dem.txt']) {
      expect(() => validateDemoMetadata({ name, size: 20 })).toThrowError(
        expect.objectContaining({ code: 'UNSUPPORTED_DEMO_TYPE' }),
      );
    }
  });

  it('rejects empty, invalid and oversized metadata', () => {
    for (const size of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateDemoMetadata({ name: 'match.dem', size })).toThrowError(
        expect.objectContaining({ code: 'INVALID_DEMO' }),
      );
    }
    expect(() =>
      validateDemoMetadata({ name: 'match.dem', size: MAX_DEMO_BYTES + 1 }),
    ).toThrowError(expect.objectContaining({ code: 'FILE_TOO_LARGE' }));
  });

  it('recognizes PBDEMS2 in an ArrayBuffer and a sliced view', () => {
    const signature = ascii(`${SOURCE_2_DEMO_SIGNATURE}more bytes`);
    expect(isSource2DemoSignature(signature.buffer)).toBe(true);

    const padded = new Uint8Array(signature.length + 4);
    padded.set(signature, 2);
    expect(isSource2DemoSignature(padded.subarray(2, 10))).toBe(true);
    expect(() => validateDemoSignature(padded.subarray(2))).not.toThrow();
  });

  it('distinguishes Source 1 from invalid or truncated files', () => {
    expect(() => validateDemoSignature(ascii('HL2DEMO\0'))).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_DEMO_TYPE' }),
    );
    for (const header of [ascii('PBDEM'), ascii('PBDEMS2X'), ascii('notademo'), new Uint8Array()]) {
      expect(() => validateDemoSignature(header)).toThrowError(
        expect.objectContaining({ code: 'INVALID_DEMO' }),
      );
    }
  });

  it('validates metadata before the header and exposes a typed error', () => {
    expect(() => validateDemoFile({ name: 'bad.txt', size: 0 }, ascii('bad'))).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_DEMO_TYPE' }),
    );

    const error = new ReplayError('PARSER_FAILED', 'Parser failed', {
      cause: new Error('root cause'),
    });
    expect(error).toMatchObject({
      name: 'ReplayError',
      code: 'PARSER_FAILED',
      message: 'Parser failed',
    });
    expect(error.cause).toBeInstanceOf(Error);
  });
});
