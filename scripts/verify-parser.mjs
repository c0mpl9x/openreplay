import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(root, 'public', 'parser');
const expectedRepository = 'https://github.com/LaihoE/demoparser.git';
const expectedCommit = 'ba39cc44cd5abfd7f34df2b3c0a7dd3630048311';

function readArtifact(fileName) {
  const path = join(outputDirectory, fileName);
  let stat;
  try {
    stat = statSync(path);
  } catch {
    throw new Error(`Missing public/parser/${fileName}. Run \`npm run parser:build\` first.`);
  }
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`public/parser/${fileName} is empty or is not a file.`);
  }
  return readFileSync(path);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

try {
  const javascript = readArtifact('demoparser2.js');
  const wasm = readArtifact('demoparser2_bg.wasm');
  const versionBytes = readArtifact('version.json');

  if (!wasm.subarray(0, 4).equals(Buffer.from([0x00, 0x61, 0x73, 0x6d]))) {
    throw new Error('public/parser/demoparser2_bg.wasm has an invalid WebAssembly header.');
  }

  const combinedBindings = javascript.toString('utf8');
  for (const exportName of ['parseHeader', 'parseEvents', 'parseTicks']) {
    if (!combinedBindings.includes(exportName)) {
      throw new Error(`The generated bindings do not export ${exportName}.`);
    }
  }
  if (!javascript.toString('utf8').includes('demoparser2_bg.wasm')) {
    throw new Error('The generated JavaScript does not reference demoparser2_bg.wasm.');
  }

  let version;
  try {
    version = JSON.parse(versionBytes.toString('utf8'));
  } catch {
    throw new Error('public/parser/version.json is not valid JSON.');
  }
  if (
    version.schemaVersion !== 1 ||
    version.upstreamRepository !== expectedRepository ||
    version.upstreamCommit !== expectedCommit ||
    typeof version.wasmPackVersion !== 'string' ||
    version.wasmPackVersion.length === 0 ||
    version.wasmBindgenCliVersion !== '0.2.100' ||
    typeof version.buildDriver !== 'string' ||
    !version.buildDriver.includes('wasm-pack 0.15.0') ||
    typeof version.buildAdjustment !== 'string' ||
    !version.buildAdjustment.includes('protobuf.rs') ||
    !version.buildAdjustment.includes('message_type.rs') ||
    !version.buildAdjustment.includes('maps.rs') ||
    !version.buildAdjustment.includes('wasm-bindgen-file-reader') ||
    !version.buildAdjustment.includes('Instant::now') ||
    !Array.isArray(version.artifacts)
  ) {
    throw new Error('public/parser/version.json has invalid or stale source metadata.');
  }

  const expectedArtifacts = new Map([
    ['public/parser/demoparser2.js', javascript],
    ['public/parser/demoparser2_bg.wasm', wasm],
  ]);
  for (const [path, contents] of expectedArtifacts) {
    const metadata = version.artifacts.find((artifact) => artifact?.path === path);
    if (metadata?.bytes !== contents.byteLength || metadata?.sha256 !== sha256(contents)) {
      throw new Error(`${path} does not match its version.json checksum.`);
    }
  }

  for (const [fileName, contents] of [
    ['demoparser2.js', javascript],
    ['demoparser2_bg.wasm', wasm],
    ['version.json', versionBytes],
  ]) {
    console.log(`${sha256(contents)}  public/parser/${fileName}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
