import { describe, expect, it, vi } from 'vitest';

import type { ReplayV1 } from '../replay/types';
import { MAX_DEMO_BYTES } from '../replay/validation';
import { DemoParserClient, type DemoFile, type ParserWorker } from './client';
import type { ParseRequest } from './protocol';

function arrayBuffer(bytes: readonly number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function demoFile(name = 'match.dem'): DemoFile {
  const bytes = [0x50, 0x42, 0x44, 0x45, 0x4d, 0x53, 0x32, 0x00, 0x01];
  return {
    name,
    size: bytes.length,
    arrayBuffer: () => Promise.resolve(arrayBuffer(bytes)),
    slice: (start = 0, end = bytes.length) => new Blob([Uint8Array.from(bytes.slice(start, end))]),
  };
}

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

class FakeWorker implements ParserWorker {
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public readonly requests: ParseRequest[] = [];
  public readonly transfers: Transferable[][] = [];
  public terminated = false;
  public postError: Error | undefined;

  public postMessage(message: ParseRequest, transfer: Transferable[]): void {
    if (this.postError !== undefined) {
      throw this.postError;
    }
    this.requests.push(message);
    this.transfers.push(transfer);
  }

  public terminate(): void {
    this.terminated = true;
  }

  public emit(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: message }));
  }

  public crash(message: string): void {
    this.onerror?.(new ErrorEvent('error', { message }));
  }
}

async function waitForRequest(worker: FakeWorker): Promise<void> {
  await vi.waitFor(() => expect(worker.requests).toHaveLength(1));
}

describe('DemoParserClient', () => {
  it('validates before creating a worker and resolves its progress/result messages', async () => {
    const worker = new FakeWorker();
    const factory = vi.fn(() => worker);
    const stages: string[] = [];
    const client = new DemoParserClient(factory);

    const promise = client.parse(demoFile(), {
      onStage: (stage) => stages.push(stage),
      wasmModuleUrl: 'https://example.test/parser/demoparser2.js',
    });
    expect(factory).not.toHaveBeenCalled();
    await waitForRequest(worker);

    expect(worker.requests[0]?.wasmModuleUrl).toBe('https://example.test/parser/demoparser2.js');
    expect(worker.transfers[0]?.[0]).toBe(worker.requests[0]?.buffer);
    worker.emit({ type: 'progress', stage: 'events' });
    worker.emit({ type: 'result', replay: replayFixture() });

    await expect(promise).resolves.toEqual(replayFixture());
    expect(stages).toEqual(['events']);
    expect(worker.terminated).toBe(true);
  });

  it('does not create a worker for invalid file metadata or signatures', async () => {
    const factory = vi.fn(() => new FakeWorker());
    const client = new DemoParserClient(factory);
    await expect(client.parse(demoFile('match.txt'))).rejects.toMatchObject({
      code: 'UNSUPPORTED_DEMO_TYPE',
    });

    const invalid = demoFile();
    const badSignature: DemoFile = {
      ...invalid,
      slice: () => new Blob([Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8)]),
    };
    await expect(client.parse(badSignature)).rejects.toMatchObject({ code: 'INVALID_DEMO' });
    expect(factory).not.toHaveBeenCalled();
  });

  it('rejects an oversized demo before reading its body', async () => {
    let read = false;
    const oversized: DemoFile = {
      ...demoFile(),
      size: MAX_DEMO_BYTES + 1,
      arrayBuffer: () => {
        read = true;
        return Promise.resolve(arrayBuffer([0x50, 0x42, 0x44, 0x45, 0x4d, 0x53, 0x32, 0x00]));
      },
    };
    const factory = vi.fn(() => new FakeWorker());
    const client = new DemoParserClient(factory);

    await expect(client.parse(oversized)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    expect(read).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });

  it('converts worker errors and malformed messages into parser failures', async () => {
    const worker = new FakeWorker();
    const client = new DemoParserClient(() => worker);
    const errorPromise = client.parse(demoFile());
    await waitForRequest(worker);
    worker.emit({
      type: 'error',
      error: { code: 'UNSUPPORTED_MAP', message: 'Mirage only' },
    });
    await expect(errorPromise).rejects.toMatchObject({ code: 'UNSUPPORTED_MAP' });

    const secondWorker = new FakeWorker();
    const malformedClient = new DemoParserClient(() => secondWorker);
    const malformedPromise = malformedClient.parse(demoFile());
    await waitForRequest(secondWorker);
    secondWorker.emit({ type: 'not-a-message' });
    await expect(malformedPromise).rejects.toMatchObject({ code: 'PARSER_FAILED' });

    const thirdWorker = new FakeWorker();
    const crashClient = new DemoParserClient(() => thirdWorker);
    const crashPromise = crashClient.parse(demoFile());
    await waitForRequest(thirdWorker);
    thirdWorker.crash('worker crashed');
    await expect(crashPromise).rejects.toThrow('The demo parser could not read this file.');

    const oomWorker = new FakeWorker();
    const oomClient = new DemoParserClient(() => oomWorker);
    const oomPromise = oomClient.parse(demoFile());
    await waitForRequest(oomWorker);
    oomWorker.crash('WebAssembly failed to grow memory: out of memory');
    await expect(oomPromise).rejects.toMatchObject({ code: 'OUT_OF_MEMORY' });
  });

  it('terminates the worker and rejects with AbortError when cancelled', async () => {
    const worker = new FakeWorker();
    const client = new DemoParserClient(() => worker);
    const promise = client.parse(demoFile());
    await waitForRequest(worker);
    client.cancel();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminated).toBe(true);
    client.dispose();
  });

  it('aborts a native FileReader while the full local file is still loading', async () => {
    let activeReader: PendingFileReader | undefined;
    class PendingFileReader {
      public static readonly LOADING = 1;
      public readyState = 0;
      public result: ArrayBuffer | string | null = null;
      public error: DOMException | null = null;
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public onabort: (() => void) | null = null;
      public readonly abort = vi.fn(() => {
        this.readyState = 2;
        this.onabort?.();
      });

      public constructor() {
        // Expose the fake instance so the test can observe native cancellation.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        activeReader = this;
      }

      public readAsArrayBuffer(): void {
        this.readyState = PendingFileReader.LOADING;
      }
    }
    vi.stubGlobal('FileReader', PendingFileReader);

    const file = Object.assign(
      new Blob([Uint8Array.of(0x50, 0x42, 0x44, 0x45, 0x4d, 0x53, 0x32, 0x00, 0x01)]),
      { name: 'match.dem' },
    );
    const factory = vi.fn(() => new FakeWorker());
    const client = new DemoParserClient(factory);
    const promise = client.parse(file);
    await vi.waitFor(() => expect(activeReader?.readyState).toBe(PendingFileReader.LOADING));
    client.cancel();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(activeReader?.abort).toHaveBeenCalledOnce();
    expect(factory).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('cleans up failures before worker creation and synchronous postMessage failures', async () => {
    const readFailure: DemoFile = {
      ...demoFile(),
      arrayBuffer: async () => Promise.reject(new Error('read failed')),
    };
    const unusedWorker = new FakeWorker();
    const client = new DemoParserClient(() => unusedWorker);
    await expect(client.parse(readFailure)).rejects.toThrow('read failed');
    expect(unusedWorker.requests).toHaveLength(0);

    const throwingWorker = new FakeWorker();
    throwingWorker.postError = new Error('post failed');
    const postClient = new DemoParserClient(() => throwingWorker);
    await expect(postClient.parse(demoFile())).rejects.toThrow('post failed');
    expect(throwingWorker.terminated).toBe(true);
  });
});
