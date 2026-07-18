# OpenReplay — CS2 2D Demo Viewer

[![CI](https://github.com/c0mpl9x/openreplay/actions/workflows/ci.yml/badge.svg)](https://github.com/c0mpl9x/openreplay/actions/workflows/ci.yml)
[![CodeQL](https://github.com/c0mpl9x/openreplay/actions/workflows/codeql.yml/badge.svg)](https://github.com/c0mpl9x/openreplay/actions/workflows/codeql.yml)
[![Pages](https://github.com/c0mpl9x/openreplay/actions/workflows/pages.yml/badge.svg)](https://github.com/c0mpl9x/openreplay/actions/workflows/pages.yml)

OpenReplay is a free, open-source 2D replay viewer for Counter-Strike 2 GOTV
demos. A demo is opened from your device, parsed in a Web Worker with
WebAssembly, and rendered on a Canvas radar. There is no application server,
account, upload, or demo storage.

> **Project status:** v0.1 is intentionally narrow: uncompressed CS2 GOTV
> `.dem` files, `de_mirage`, desktop Chrome/Edge/Firefox, and files up to
> 500 MiB.

## Privacy by design

The selected demo never leaves the browser. The application transfers its
`ArrayBuffer` to a local Worker, parses it locally, and keeps the normalized
replay in memory for the current tab only. Opening another demo or reloading the
page releases the previous replay.

GitHub Pages serves only the static HTML, CSS, JavaScript, map asset, and WASM
needed to run the viewer. It is not used to receive demos. Do not add analytics,
remote error reporting, or any request containing demo bytes or extracted match
data without an explicit privacy review and a visible user-facing opt-in.

## v0.1 capabilities

- Local drag-and-drop/file selection with Source 2 and GOTV validation.
- Mirage radar with CT/T markers, facing direction, health, armor, and deaths.
- Round navigation, seek, play/pause, and 0.5x/1x/2x/4x playback.
- Synchronized kills, timeline event markers, and bomb state.
- Typed-array replay data and Canvas rendering outside React's per-frame render
  cycle.
- Explicit, user-readable errors for invalid, unsupported, or oversized demos.

POV demos, Source 1 demos, compressed archives, other maps, mobile/Safari,
accounts, persistence, shareable links, HLTV ingestion, grenades, inventories,
statistics, and heatmaps are out of scope for v0.1.

## Requirements

- [Node.js 24](https://nodejs.org/) (the version is also recorded in
  `.node-version`)
- npm, using the committed lockfile
- Rust 1.97.0 only when rebuilding the parser; npm installs the lockfile-pinned
  `wasm-pack` 0.15.0 runner

## Local development

```bash
npm ci
npm run parser:verify
npm run dev
```

Vite prints the local URL. The normal development path uses the versioned parser
artifacts in `public/parser`; rebuilding Rust is not required just to run the
viewer.

Useful commands:

| Command                 | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Start the Vite development server                      |
| `npm run format:check`  | Check formatting without rewriting files               |
| `npm run lint`          | Run ESLint                                             |
| `npm run typecheck`     | Run strict TypeScript checks                           |
| `npm run test:unit`     | Run Vitest with coverage thresholds                    |
| `npm run build`         | Type-check and produce the static site in `dist/`      |
| `npm run test:e2e`      | Run Playwright in Chromium, Firefox, and WebKit        |
| `npm run parser:verify` | Validate parser files, metadata, and recorded hashes   |
| `npm run parser:build`  | Rebuild browser bindings from the pinned parser source |

Install Playwright browsers once before the first local end-to-end run:

```bash
npx playwright install chromium firefox webkit
npm run test:e2e
```

WebKit coverage is the local browser-compatibility gate for the v0.2 work;
validation in a real Safari installation remains a separate release check.

## Parser artifacts and reproducibility

The browser parser contract consists of:

```text
public/parser/demoparser2.js
public/parser/demoparser2_bg.wasm
public/parser/version.json
```

`version.json` is deterministic: it records schema version 1, the upstream
repository and commit, the exact WASM tooling, the reproducible isolated-build
adjustments, and SHA-256 values for the versioned JavaScript/WASM artifacts. It
contains no build timestamp, hostname, or absolute path.

`npm run parser:verify` is always required. It must fail when an artifact is
missing, its hash does not match metadata, or its adapter contract is invalid.
It must never silently replace the parser with a no-op implementation.

The exact upstream source is pinned as the `vendor/demoparser` Git submodule.
To rebuild it:

```bash
git submodule update --init --recursive
npm run parser:build
npm run parser:verify
```

The build script expects
`vendor/demoparser/src/wasm/Cargo.toml`. CI recompiles when that file is
available and treats a configured submodule/build failure as a real failure. A
checkout that intentionally relies only on the committed browser artifacts
still runs `parser:verify`, so it remains independently verifiable without a
Rust build.

The pinned upstream commit already contains generated `protobuf.rs`,
`message_type.rs`, and `maps.rs` files, but its build scripts otherwise clone
moving game data and start a nested Cargo generator. OpenReplay builds an
isolated copy using those committed files, removes an unused browser dependency,
and excludes native-only profiling timers that trap on
`wasm32-unknown-unknown`. Every adjustment is checked against exact source text,
fails closed if upstream changes, and keeps the submodule worktree untouched.
Linux CI rebuilds through `wasm-pack` and rejects any byte-level drift from the
committed artifacts.

Whenever the parser or a map asset changes, update its upstream commit, license,
local paths, and SHA-256 values in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and parser metadata in the
same pull request.

## Architecture

1. The main thread validates the filename, size, and Source 2 header before
   reading the complete file.
2. The demo `ArrayBuffer` is transferred—not cloned—to a dedicated Worker.
3. The WASM adapter emits metadata, players, rounds, events, and sampled player
   state. The normalizer compacts that data into the versioned `ReplayV1`
   typed-array model.
4. React owns file/loading/error states and replay controls. Canvas 2D owns radar
   drawing on `requestAnimationFrame`; playback ticks do not trigger React
   renders.
5. Cancel terminates the Worker. No parsed data is persisted or sent over the
   network.

Map transforms live in versioned `MapConfigV1` data rather than Canvas code, so
future maps—including multi-level maps—can be added without changing the player.

## Testing with real demos

All `*.dem` files and `fixtures/private/` are ignored by Git. Put private
acceptance demos under `fixtures/private/`; never add them to commits, releases,
Actions artifacts, bug reports, or Pages.

Before tagging v0.1.0, manually validate a representative Mirage GOTV demo:

- ten players align with the radar and side changes are correct;
- rounds, kills, and bomb events match the source match;
- parsing completes within 90 seconds on the reference development machine,
  without UI blocking, crashes, or out-of-memory errors;
- playback is smooth and no network request contains demo or match data;
- cancel, reload, and opening a second demo release the previous state.

Synthetic fixtures cover replay UI behavior. Browser parser integration also
uses `test_demo.dem`, a public Mirage fixture already tracked and licensed
inside the pinned `demoparser2` submodule; it is not copied into the root
repository or published as user data. Private demos remain strictly excluded.

For a local-only acceptance run with a private demo, set
`OPENREPLAY_PRIVATE_DEMO` to a file under `fixtures/private/`. The optional
Playwright check is skipped in CI and never publishes the file:

```powershell
$env:OPENREPLAY_PRIVATE_DEMO = 'fixtures/private/your-demo.dem'
npm run test:e2e -- --project=chromium --grep 'private acceptance'
```

The current pinned artifact was also exercised end to end against that
60,601,900-byte fixture: 10 players, 10 rounds, 71 match events, 5,157 sampled
frames, and 51,531 finite present-player states were normalized in about 1.03
seconds on the development machine, with every replay event tick represented.
This proves parser compatibility for the public fixture; it does not replace
the private pre-release acceptance pass or a dedicated 500 MiB stress test.

## CI and deployment

Every pull request and push runs formatting, lint, type checks, unit tests,
parser verification/rebuild, the production build, and Playwright in Chromium,
Firefox, and WebKit. Failed test reports are retained for seven days. CodeQL and weekly
Dependabot updates cover the TypeScript/JavaScript and workflow supply chain.

The zero-cost setup assumes a public repository: GitHub Pages is available on
GitHub Free for public repositories, and standard GitHub-hosted runners are free
for public repositories, subject to GitHub's current
[Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
and [Actions billing and usage rules](https://docs.github.com/en/actions/concepts/billing-and-usage).
Actions artifacts are used only for the Pages bundle and short-lived failure
reports, never as demo storage.

A successful `CI` run on `main` triggers the least-privilege Pages workflow,
which checks out the exact tested commit, verifies the same parser bytes tested
by CI, builds `dist/`, and deploys it to the protected `github-pages`
environment. Configure Pages to use **GitHub Actions** as its source. No secret
is required.

Repository owners must apply the settings documented in
[`BRANCH_PROTECTION.md`](.github/BRANCH_PROTECTION.md); repository rules cannot
be enforced by files in a clone alone.

## Contributing and security

See [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. Report
vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md), and do
not attach a private demo to a public issue.

The release roadmap is tracked in [`ROADMAP.md`](ROADMAP.md). The current
priority after v0.1 is browser compatibility, parser robustness, and local
performance; online ingestion and persistence remain future work.

## Legal

This independent project is not affiliated with, endorsed by, or sponsored by
Valve Corporation. Counter-Strike, Counter-Strike 2, Steam, and related marks
and game content are the property of their respective owners. No official Valve
logos are used.

`OpenReplay` is a working project name and may be confused with an existing
unrelated project; always use the full descriptor **OpenReplay — CS2 2D Demo
Viewer** in public-facing text.

The project code is available under the [MIT License](LICENSE). Third-party code
and assets remain subject to their own notices and licenses in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Canonical repository: [c0mpl9x/openreplay](https://github.com/c0mpl9x/openreplay).
