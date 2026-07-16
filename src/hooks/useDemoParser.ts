import { useCallback, useEffect, useRef, useState } from 'react';
import { DemoParserClient, parserErrorPayload, type ParserStage } from '../parser';
import { createSyntheticReplay } from '../replay/synthetic';
import { ReplayError, type ReplayErrorCode, type ReplayV1 } from '../replay/types';

export type DemoParserState =
  | { readonly status: 'idle' }
  | { readonly status: 'parsing'; readonly fileName: string; readonly stage: ParserStage }
  | { readonly status: 'ready'; readonly replay: ReplayV1 }
  | {
      readonly status: 'error';
      readonly code: ReplayErrorCode;
      readonly message: string;
    };

function userFacingError(error: unknown): Extract<DemoParserState, { status: 'error' }> {
  if (error instanceof ReplayError) {
    return { status: 'error', code: error.code, message: error.message };
  }
  const payload = parserErrorPayload(error);
  return { status: 'error', ...payload };
}

export function useDemoParser() {
  const clientRef = useRef<DemoParserClient | null>(null);
  const operationRef = useRef(0);
  const [state, setState] = useState<DemoParserState>({ status: 'idle' });

  if (clientRef.current === null) clientRef.current = new DemoParserClient();

  const reset = useCallback(() => {
    operationRef.current += 1;
    clientRef.current?.cancel();
    setState({ status: 'idle' });
  }, []);

  const openFile = useCallback(async (file: File) => {
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setState({ status: 'parsing', fileName: file.name, stage: 'validating' });

    try {
      const replay = await clientRef.current!.parse(file, {
        onStage: (stage) => {
          if (operationRef.current === operation) {
            setState({ status: 'parsing', fileName: file.name, stage });
          }
        },
      });
      if (operationRef.current === operation) setState({ status: 'ready', replay });
    } catch (error) {
      if (operationRef.current !== operation) return;
      if (error instanceof DOMException && error.name === 'AbortError') {
        setState({ status: 'idle' });
        return;
      }
      setState(userFacingError(error));
    }
  }, []);

  const openPreview = useCallback(() => {
    operationRef.current += 1;
    clientRef.current?.cancel();
    setState({ status: 'ready', replay: createSyntheticReplay() });
  }, []);

  useEffect(
    () => () => {
      operationRef.current += 1;
      clientRef.current?.dispose();
    },
    [],
  );

  return { state, openFile, openPreview, reset } as const;
}
