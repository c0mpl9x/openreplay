import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const DEMOPARSER_REPOSITORY = 'https://github.com/LaihoE/demoparser.git';
export const DEMOPARSER_COMMIT = 'ba39cc44cd5abfd7f34df2b3c0a7dd3630048311';
export const WASM_BINDGEN_CLI_VERSION = '0.2.100';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = join(root, 'vendor', 'demoparser');
const sourceCrateDirectory = join(sourceDirectory, 'src', 'wasm');
const buildDirectory = join(root, '.cache', 'demoparser-build');
const crateDirectory = join(buildDirectory, 'src', 'wasm');
const cargoTargetDirectory = join(root, '.cache', 'demoparser-target');
const outputDirectory = join(root, 'public', 'parser');
const wasmPackRunner = join(root, 'node_modules', 'wasm-pack', 'run.js');
const buildMarker = `${DEMOPARSER_COMMIT}:6`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: false,
  });
  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : '';
    throw new Error(`${command} exited with status ${String(result.status)}.${detail}`);
  }
  return options.capture ? result.stdout.trim() : '';
}

function runWasmPack(args, options = {}) {
  if (!existsSync(wasmPackRunner)) {
    throw new Error('The wasm-pack npm runner is missing. Run `npm ci` before building.');
  }
  return run(process.execPath, [wasmPackRunner, ...args], options);
}

function preparePinnedSource() {
  try {
    run('git', ['--version'], { capture: true });
  } catch (error) {
    throw new Error('Git is required to fetch the pinned demoparser2 source.', {
      cause: error,
    });
  }

  let status;
  try {
    status = run('git', ['submodule', 'status', '--', 'vendor/demoparser'], {
      capture: true,
    });
  } catch (error) {
    throw new Error(
      'vendor/demoparser must be configured as the repository submodule before building.',
      { cause: error },
    );
  }

  if (status.startsWith('-') || !existsSync(sourceCrateDirectory)) {
    run('git', ['submodule', 'update', '--init', '--depth', '1', '--', 'vendor/demoparser']);
    status = run('git', ['submodule', 'status', '--', 'vendor/demoparser'], {
      capture: true,
    });
  }

  const checkedOutCommit = status.match(/[0-9a-f]{40}/u)?.[0];
  if (checkedOutCommit !== DEMOPARSER_COMMIT || status.startsWith('+')) {
    throw new Error(
      `Expected demoparser2 submodule ${DEMOPARSER_COMMIT}, found ${checkedOutCommit ?? 'no commit'}. Run \`git submodule update --init\`.`,
    );
  }
}

function prepareIsolatedSource() {
  const markerPath = join(buildDirectory, '.openreplay-source');
  if (existsSync(markerPath) && readFileSync(markerPath, 'utf8') === buildMarker) {
    return;
  }

  rmSync(buildDirectory, { recursive: true, force: true });
  for (const crateName of ['csgoproto', 'parser', 'wasm']) {
    cpSync(join(sourceDirectory, 'src', crateName), join(buildDirectory, 'src', crateName), {
      recursive: true,
      filter: (path) => {
        const normalized = path.replaceAll('\\', '/');
        return (
          !normalized.includes('/target/') &&
          !normalized.endsWith('/target') &&
          !normalized.includes('/GameTracking-CS2/') &&
          !normalized.endsWith('/GameTracking-CS2') &&
          !normalized.includes('/wasm/www/') &&
          !normalized.endsWith('/wasm/www') &&
          !normalized.endsWith('/parser/test_demo.dem')
        );
      },
    });
  }

  // Upstream's build.rs clones the moving GameTracking-CS2 default branch and
  // regenerates bindings on every build. The pinned commit already contains
  // its generated protobuf.rs; compiling that checked-in file avoids an
  // unpinned network dependency without modifying the submodule worktree.
  writeFileSync(
    join(buildDirectory, 'src', 'csgoproto', 'build.rs'),
    'fn main() { println!("cargo:rerun-if-changed=src/protobuf.rs"); }\n',
    'utf8',
  );
  // parser/build.rs starts a nested Cargo process to regenerate message_type.rs
  // and maps.rs. Besides depending on the omitted moving game-data checkout,
  // that child deadlocks on Cargo's inherited wasm target lock. Both generated
  // files are committed at the pinned revision, so treat them as immutable
  // build inputs just like protobuf.rs.
  writeFileSync(
    join(buildDirectory, 'src', 'parser', 'build.rs'),
    [
      'fn main() {',
      '    println!("cargo:rerun-if-changed=../csgoproto/src/protobuf.rs");',
      '    println!("cargo:rerun-if-changed=../csgoproto/src/message_type.rs");',
      '    println!("cargo:rerun-if-changed=../csgoproto/src/maps.rs");',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );

  const wasmManifestPath = join(crateDirectory, 'Cargo.toml');
  const wasmManifest = readFileSync(wasmManifestPath, 'utf8').replace(
    /^wasm-bindgen-file-reader\s*=.*(?:\r?\n)?/gmu,
    '',
  );
  writeFileSync(wasmManifestPath, wasmManifest, 'utf8');
  const wasmLockPath = join(crateDirectory, 'Cargo.lock');
  const wasmLock = readFileSync(wasmLockPath, 'utf8')
    .replace(/^ "wasm-bindgen-file-reader",\r?\n/mu, '')
    .replace(
      /\[\[package\]\]\r?\nname = "wasm-bindgen-file-reader"[\s\S]*?(?=\r?\n\[\[package\]\])/u,
      '',
    );
  writeFileSync(wasmLockPath, wasmLock, 'utf8');

  // The pinned parser recently added native profiling timers. Rust's
  // std::time::Instant::now() deliberately traps on wasm32-unknown-unknown,
  // even when the CS2_PROF environment flag is absent. Keep the parser logic
  // unchanged and compile only those optional measurements out of the
  // browser-specific isolated copy.
  const parserPath = join(buildDirectory, 'src', 'parser', 'src', 'parse_demo.rs');
  let parserSource = readFileSync(parserPath, 'utf8').replaceAll('\r\n', '\n');
  const profilingStatements = [
    '        let _t = std::time::Instant::now();',
    '        if _prof {\n            eprintln!("[prof] first_pass: {:.3}s", _t.elapsed().as_secs_f64());\n        }',
    '        let mut t = std::time::Instant::now();',
    '        if prof { eprintln!("[prof] second_pass start(): {:.3}s", t.elapsed().as_secs_f64()); t = std::time::Instant::now(); }',
    '        if prof { eprintln!("[prof] create_output: {:.3}s", t.elapsed().as_secs_f64()); t = std::time::Instant::now(); }',
    '        if prof { eprintln!("[prof] combine_outputs: {:.3}s", t.elapsed().as_secs_f64()); t = std::time::Instant::now(); }',
    '        if prof { eprintln!("[prof] post-proc: {:.3}s", t.elapsed().as_secs_f64()); }',
  ];
  for (const statement of profilingStatements) {
    if (!parserSource.includes(statement)) {
      throw new Error(`Pinned parser profiling patch is stale: ${statement}`);
    }
    parserSource = parserSource.replace(
      statement,
      `        #[cfg(not(target_arch = "wasm32"))]\n${statement}`,
    );
  }
  writeFileSync(parserPath, parserSource, 'utf8');

  const secondPassProfiling = [
    {
      relativePath: join('second_pass', 'parser.rs'),
      statements: [
        '                        let _pt = prof_on().then(std::time::Instant::now);',
        '                        if let Some(t) = _pt { PROF_ENTS_NS.with(|c| c.set(c.get() + t.elapsed().as_nanos() as u64)); }',
        '                            let _ct = prof_on().then(std::time::Instant::now);',
        '                            if let Some(t) = _ct { PROF_COLLECT_NS.with(|c| c.set(c.get() + t.elapsed().as_nanos() as u64)); }',
      ],
    },
    {
      relativePath: join('second_pass', 'entities.rs'),
      statements: [
        '        let _pp = crate::second_pass::parser::prof_on().then(std::time::Instant::now);',
        '        if let Some(t) = _pp {\n            crate::second_pass::parser::PROF_PATHS_NS.with(|c| c.set(c.get() + t.elapsed().as_nanos() as u64));\n        }',
        '        let _pd = crate::second_pass::parser::prof_on().then(std::time::Instant::now);',
        '        if let Some(t) = _pd {\n            crate::second_pass::parser::PROF_DECODE_NS.with(|c| c.set(c.get() + t.elapsed().as_nanos() as u64));\n        }',
      ],
    },
  ];
  for (const { relativePath, statements } of secondPassProfiling) {
    const path = join(buildDirectory, 'src', 'parser', 'src', relativePath);
    let source = readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
    for (const statement of statements) {
      if (!source.includes(statement)) {
        throw new Error(`Pinned parser profiling patch is stale: ${relativePath}: ${statement}`);
      }
      const indentation = statement.match(/^\s*/u)?.[0] ?? '';
      source = source.replace(
        statement,
        `${indentation}#[cfg(not(target_arch = "wasm32"))]\n${statement}`,
      );
    }
    writeFileSync(path, source, 'utf8');
  }
  writeFileSync(markerPath, buildMarker, 'utf8');
}

function buildWasm() {
  try {
    run('cargo', ['--version'], { capture: true });
  } catch (error) {
    throw new Error(
      'Rust and Cargo are required. Install the Rust toolchain from https://rustup.rs/ before building the parser.',
      { cause: error },
    );
  }

  let wasmPackVersion;
  try {
    wasmPackVersion = runWasmPack(['--version'], { capture: true });
  } catch (error) {
    throw new Error(
      'wasm-pack is required. Install it from https://rustwasm.github.io/wasm-pack/installer/.',
      { cause: error },
    );
  }

  let useInstalledWasmBindgen = false;
  try {
    const installedVersion = run('wasm-bindgen', ['--version'], { capture: true });
    if (installedVersion === `wasm-bindgen ${WASM_BINDGEN_CLI_VERSION}`) {
      useInstalledWasmBindgen = true;
    }
  } catch {
    // wasm-pack will download the crate-compatible CLI into its own cache.
  }

  mkdirSync(outputDirectory, { recursive: true });
  mkdirSync(cargoTargetDirectory, { recursive: true });
  for (const fileName of [
    'demoparser2.js',
    'demoparser2.d.ts',
    'demoparser2_bg.wasm',
    'demoparser2_bg.wasm.d.ts',
    'version.json',
  ]) {
    rmSync(join(outputDirectory, fileName), { force: true });
  }

  prepareIsolatedSource();
  const buildEnvironment = { ...process.env, CARGO_TARGET_DIR: cargoTargetDirectory };
  if (process.platform === 'win32' && useInstalledWasmBindgen) {
    // wasm-pack 0.15 can deadlock two Cargo processes while discovering its
    // private CLI on locked-down Windows hosts. These are the same two steps
    // and exact CLI version that wasm-pack drives; Linux CI rebuilds with
    // wasm-pack itself and rejects any byte-level drift.
    run(
      'cargo',
      [
        'build',
        '--release',
        '--target',
        'wasm32-unknown-unknown',
        '--locked',
        '--manifest-path',
        join(crateDirectory, 'Cargo.toml'),
      ],
      { env: buildEnvironment },
    );
    run(
      'wasm-bindgen',
      [
        '--target',
        'web',
        '--out-dir',
        outputDirectory,
        '--out-name',
        'demoparser2',
        join(cargoTargetDirectory, 'wasm32-unknown-unknown', 'release', 'demoparser2.wasm'),
      ],
      { env: buildEnvironment },
    );
  } else {
    runWasmPack(
      [
        'build',
        crateDirectory,
        '--release',
        '--target',
        'web',
        '--out-dir',
        outputDirectory,
        '--out-name',
        'demoparser2',
        '--locked',
      ],
      { env: buildEnvironment },
    );
  }

  for (const generatedMetadata of [
    'demoparser2.d.ts',
    'demoparser2_bg.wasm.d.ts',
    'package.json',
    '.gitignore',
  ]) {
    rmSync(join(outputDirectory, generatedMetadata), { force: true });
  }

  const artifacts = ['demoparser2.js', 'demoparser2_bg.wasm'].map((fileName) => {
    const contents = readFileSync(join(outputDirectory, fileName));
    return {
      path: `public/parser/${fileName}`,
      bytes: contents.byteLength,
      sha256: createHash('sha256').update(contents).digest('hex'),
    };
  });
  writeFileSync(
    join(outputDirectory, 'version.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        upstreamRepository: DEMOPARSER_REPOSITORY,
        upstreamCommit: DEMOPARSER_COMMIT,
        wasmPackVersion,
        wasmBindgenCliVersion: WASM_BINDGEN_CLI_VERSION,
        buildDriver:
          'wasm-pack 0.15.0 in CI; exact Cargo plus wasm-bindgen 0.2.100 compatibility path on locked-down Windows',
        buildAdjustment:
          'Uses protobuf.rs, message_type.rs and maps.rs committed at the pinned upstream revision instead of a moving clone or nested generator, removes the unused wasm-bindgen-file-reader dependency, and compiles every Instant::now profiler plus its elapsed-time read out of the isolated wasm32 build.',
        artifacts,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

try {
  preparePinnedSource();
  buildWasm();
  run(process.execPath, [join(root, 'scripts', 'verify-parser.mjs')]);
  console.log(`demoparser2 ${DEMOPARSER_COMMIT} built in public/parser.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
