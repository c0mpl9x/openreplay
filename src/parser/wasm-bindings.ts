import { ReplayError } from '../replay/types';
import type { DemoparserBindings } from './adapter';

interface WasmPackModule {
  readonly default?: unknown;
  readonly parseHeader?: unknown;
  readonly parseEvents?: unknown;
  readonly parseTicks?: unknown;
}

function isInitializer(value: unknown): value is () => unknown {
  return typeof value === 'function';
}

function asWasmPackModule(value: unknown): WasmPackModule {
  return typeof value === 'object' && value !== null ? value : {};
}

/**
 * Load the wasm-pack `--target web` module generated into public/parser.
 * Keeping this behind an interface lets unit tests exercise normalization
 * without checking a large wasm binary into the repository.
 */
export async function loadDemoparserBindings(moduleUrl: string): Promise<DemoparserBindings> {
  let imported: unknown;
  try {
    imported = await import(/* @vite-ignore */ moduleUrl);
  } catch (error) {
    throw new ReplayError(
      'PARSER_FAILED',
      'The local demoparser2 WASM runtime is missing. Run `npm run parser:build` before starting OpenReplay.',
      { cause: error },
    );
  }

  const module = asWasmPackModule(imported);
  if (!isInitializer(module.default)) {
    throw new ReplayError(
      'PARSER_FAILED',
      'The demoparser2 JavaScript binding has no wasm-pack initializer. Rebuild it with `npm run parser:build`.',
    );
  }

  try {
    await module.default();
  } catch (error) {
    throw new ReplayError(
      'PARSER_FAILED',
      'The demoparser2 WebAssembly module could not be initialized.',
      { cause: error },
    );
  }

  if (
    typeof module.parseHeader !== 'function' ||
    typeof module.parseEvents !== 'function' ||
    typeof module.parseTicks !== 'function'
  ) {
    throw new ReplayError(
      'PARSER_FAILED',
      'The demoparser2 bindings are incomplete. Expected parseHeader, parseEvents, and parseTicks exports.',
    );
  }

  return {
    parseHeader: module.parseHeader as DemoparserBindings['parseHeader'],
    parseEvents: module.parseEvents as DemoparserBindings['parseEvents'],
    parseTicks: module.parseTicks as DemoparserBindings['parseTicks'],
  };
}
