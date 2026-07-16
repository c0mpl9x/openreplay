/// <reference lib="webworker" />

import { ReplayError } from '../replay/types';
import { parseReplayWithBindings } from './adapter';
import {
  parserErrorPayload,
  replayTransferables,
  type ParseRequest,
  type ParserMessage,
} from './protocol';
import { loadDemoparserBindings } from './wasm-bindings';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

function isParseRequest(value: unknown): value is ParseRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ParseRequest>;
  return (
    candidate.type === 'parse' &&
    typeof candidate.fileName === 'string' &&
    typeof candidate.size === 'number' &&
    candidate.buffer instanceof ArrayBuffer &&
    typeof candidate.wasmModuleUrl === 'string'
  );
}

function post(message: ParserMessage, transfer: Transferable[] = []): void {
  workerScope.postMessage(message, transfer);
}

async function handleRequest(value: unknown): Promise<void> {
  try {
    if (!isParseRequest(value)) {
      throw new ReplayError('INVALID_DEMO', 'The parser worker received an invalid request.');
    }

    const bindings = await loadDemoparserBindings(value.wasmModuleUrl);
    const replay = parseReplayWithBindings(value, bindings, (stage) => {
      post({ type: 'progress', stage });
    });
    post({ type: 'result', replay }, replayTransferables(replay));
  } catch (error) {
    post({ type: 'error', error: parserErrorPayload(error) });
  }
}

workerScope.onmessage = (event: MessageEvent<unknown>): void => {
  void handleRequest(event.data);
};

export {};
