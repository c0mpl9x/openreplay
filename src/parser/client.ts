import { ReplayError } from '../replay/types';
import { validateDemoMetadata, validateDemoSignature } from '../replay/validation';
import {
  isParserMessage,
  parserErrorPayload,
  type ParseRequest,
  type ParserMessage,
  type ParserStage,
} from './protocol';
import type { ReplayV1 } from '../replay/types';

export interface DemoFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  slice(start?: number, end?: number): Blob;
}

export interface ParserWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: ParseRequest, transfer: Transferable[]): void;
  terminate(): void;
}

export type ParserWorkerFactory = () => ParserWorker;

export interface ParseOptions {
  readonly onStage?: (stage: ParserStage) => void;
  readonly wasmModuleUrl?: string;
}

interface ActiveOperation {
  readonly abortController: AbortController;
  worker?: ParserWorker;
  reject?: (reason: unknown) => void;
  settled: boolean;
}

function terminateWorker(operation: ActiveOperation): void {
  const worker = operation.worker;
  if (worker === undefined) return;

  // Break the worker -> operation callback chain before termination so an
  // already queued message cannot retain the old operation.
  worker.onmessage = null;
  worker.onerror = null;
  worker.terminate();
  operation.worker = undefined;
}

function createAbortError(): DOMException {
  return new DOMException('Demo parsing was cancelled.', 'AbortError');
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(createAbortError());
    signal.addEventListener('abort', abort, { once: true });

    void promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function readDemoBuffer(file: DemoFile, signal: AbortSignal): Promise<ArrayBuffer> {
  if (typeof Blob === 'undefined' || !(file instanceof Blob) || typeof FileReader === 'undefined') {
    return abortable(file.arrayBuffer(), signal);
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
      callback();
    };
    const abort = (): void => {
      if (reader.readyState === FileReader.LOADING) reader.abort();
      finish(() => reject(createAbortError()));
    };

    reader.onload = (): void => {
      const result = reader.result;
      finish(() => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('The browser returned an invalid demo buffer.'));
      });
    };
    reader.onerror = (): void =>
      finish(() => reject(reader.error ?? new Error('The browser could not read this demo.')));
    reader.onabort = (): void => finish(() => reject(createAbortError()));
    signal.addEventListener('abort', abort, { once: true });

    if (signal.aborted) abort();
    else reader.readAsArrayBuffer(file);
  });
}

function defaultWorkerFactory(): ParserWorker {
  return new Worker(new URL('./demo.worker.ts', import.meta.url), {
    type: 'module',
    name: 'cs2-demo-parser',
  });
}

function defaultWasmModuleUrl(): string {
  if (typeof document !== 'undefined') {
    return new URL('parser/demoparser2.js', document.baseURI).href;
  }

  return '/parser/demoparser2.js';
}

async function validateFile(file: DemoFile, signal: AbortSignal): Promise<void> {
  validateDemoMetadata(file);
  const header = await abortable(file.slice(0, 8).arrayBuffer(), signal);
  validateDemoSignature(header);
}

/**
 * Owns at most one parser worker. Starting a new parse cancels the old one;
 * cancellation terminates the worker so wasm execution stops immediately.
 */
export class DemoParserClient {
  private active: ActiveOperation | undefined;

  public constructor(private readonly workerFactory: ParserWorkerFactory = defaultWorkerFactory) {}

  public async parse(file: DemoFile, options: ParseOptions = {}): Promise<ReplayV1> {
    this.cancel();
    const operation: ActiveOperation = {
      abortController: new AbortController(),
      settled: false,
    };
    this.active = operation;

    try {
      await validateFile(file, operation.abortController.signal);
      const buffer = await readDemoBuffer(file, operation.abortController.signal);

      if (this.active !== operation || operation.abortController.signal.aborted) {
        throw createAbortError();
      }

      const worker = this.workerFactory();
      operation.worker = worker;

      return await new Promise<ReplayV1>((resolve, reject) => {
        operation.reject = reject;

        const finish = (): boolean => {
          if (operation.settled) {
            return false;
          }
          operation.settled = true;
          terminateWorker(operation);
          operation.reject = undefined;
          if (this.active === operation) {
            this.active = undefined;
          }
          return true;
        };

        worker.onmessage = (event: MessageEvent<unknown>): void => {
          if (!isParserMessage(event.data)) {
            if (finish()) {
              reject(
                new ReplayError('PARSER_FAILED', 'The parser worker returned an invalid response.'),
              );
            }
            return;
          }

          const message: ParserMessage = event.data;
          if (message.type === 'progress') {
            options.onStage?.(message.stage);
            return;
          }

          if (message.type === 'result') {
            if (finish()) {
              resolve(message.replay);
            }
            return;
          }

          if (finish()) {
            reject(new ReplayError(message.error.code, message.error.message));
          }
        };

        worker.onerror = (event: ErrorEvent): void => {
          if (finish()) {
            const payload = parserErrorPayload(
              new Error(event.message || 'The parser worker stopped unexpectedly.'),
            );
            reject(new ReplayError(payload.code, payload.message));
          }
        };

        const request: ParseRequest = {
          type: 'parse',
          fileName: file.name,
          size: file.size,
          buffer,
          wasmModuleUrl: options.wasmModuleUrl ?? defaultWasmModuleUrl(),
        };
        try {
          worker.postMessage(request, [buffer]);
        } catch (error) {
          if (finish()) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        }
      });
    } finally {
      if (this.active === operation) {
        operation.settled = true;
        terminateWorker(operation);
        operation.reject = undefined;
        this.active = undefined;
      }
    }
  }

  public cancel(): void {
    const operation = this.active;
    if (operation === undefined || operation.settled) {
      return;
    }

    operation.settled = true;
    operation.abortController.abort();
    terminateWorker(operation);
    operation.reject?.(createAbortError());
    operation.reject = undefined;
    this.active = undefined;
  }

  public dispose(): void {
    this.cancel();
  }
}
