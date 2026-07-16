import { ReplayError } from './types';

export const MAX_DEMO_BYTES = 500 * 1024 * 1024;
export const SOURCE_2_DEMO_SIGNATURE = 'PBDEMS2\0';

const SOURCE_1_DEMO_SIGNATURE = 'HL2DEMO\0';

export type DemoFileMetadata = {
  readonly size: number;
} & (
  | { readonly name: string; readonly fileName?: string }
  | { readonly fileName: string; readonly name?: string }
);

type ByteSource = ArrayBufferLike | ArrayBufferView;

function bytesOf(source: ByteSource): Uint8Array {
  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }

  return new Uint8Array(source);
}

function startsWithAscii(bytes: Uint8Array, value: string): boolean {
  if (bytes.byteLength < value.length) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (bytes[index] !== value.charCodeAt(index)) {
      return false;
    }
  }

  return true;
}

export function validateDemoMetadata(file: DemoFileMetadata): void {
  const name = file.name ?? file.fileName;
  if (name === undefined || !name.toLocaleLowerCase('en-US').endsWith('.dem')) {
    throw new ReplayError('UNSUPPORTED_DEMO_TYPE', 'Choose an uncompressed CS2 GOTV .dem file.');
  }

  if (!Number.isSafeInteger(file.size) || file.size < 1) {
    throw new ReplayError('INVALID_DEMO', 'The demo file is empty or has an invalid size.');
  }

  if (file.size > MAX_DEMO_BYTES) {
    throw new ReplayError(
      'FILE_TOO_LARGE',
      `The demo is larger than the ${String(MAX_DEMO_BYTES / 1024 / 1024)} MiB limit.`,
    );
  }
}

export function isSource2DemoSignature(header: ByteSource): boolean {
  return startsWithAscii(bytesOf(header), SOURCE_2_DEMO_SIGNATURE);
}

export function validateDemoSignature(header: ByteSource): void {
  const bytes = bytesOf(header);

  if (startsWithAscii(bytes, SOURCE_1_DEMO_SIGNATURE)) {
    throw new ReplayError(
      'UNSUPPORTED_DEMO_TYPE',
      'This is a Source 1 demo. Only CS2 GOTV demos are supported.',
    );
  }

  if (!isSource2DemoSignature(bytes)) {
    throw new ReplayError(
      'INVALID_DEMO',
      'The file does not contain a valid CS2 Source 2 demo header.',
    );
  }
}

/** Validate cheap metadata first, then the small header read from the file. */
export function validateDemoFile(file: DemoFileMetadata, header: ByteSource): void {
  validateDemoMetadata(file);
  validateDemoSignature(header);
}
