# Contributing

Thank you for helping build **OpenReplay — CS2 2D Demo Viewer**. v0.1 is a
privacy-first, static viewer for local Mirage GOTV demos; keep changes within
that product boundary unless an issue explicitly expands it.

## Set up

Use Node.js 24 and the committed npm lockfile:

```bash
git clone --recurse-submodules https://github.com/c0mpl9x/openreplay.git
cd openreplay
npm ci
npm run parser:verify
npx playwright install chromium firefox webkit
npm run dev
```

Rust 1.97.0 is optional for normal frontend work and required for parser
rebuilds. `npm ci` installs the exact `wasm-pack` 0.15.0 runner from the
lockfile.

## Development rules

- Keep demo parsing entirely in the browser and off the main thread.
- Transfer demo buffers to the Worker; do not clone or persist them.
- Keep playback-frame Canvas rendering outside React state/render cycles.
- Preserve strict TypeScript and the versioned `ReplayV1`/`MapConfigV1` public
  contracts.
- Add visible UI strings to the centralized English message catalog.
- Escape/render player names and all demo-derived strings as untrusted data.
- Do not add accounts, analytics, telemetry, remote storage, or network upload.
- Do not add Valve logos or material with unclear redistribution rights.

## Validate a change

Run the same checks as CI:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run parser:verify
npm run build
npm run test:e2e
```

Unit changes should cover validation, round pairing, sampling, coordinates,
side changes, interpolation, events, and Worker errors as applicable. UI flows
should use synthetic replay fixtures in Playwright and pass in Chromium,
Firefox, and WebKit. The sole real-file integration fixture is the public `test_demo.dem`
already tracked inside the pinned upstream parser submodule.

## Parser and asset changes

Parser source is pinned under `vendor/demoparser`. If that source is present, a
parser change must pass:

```bash
git submodule update --init --recursive
npm run parser:build
npm run parser:verify
```

Commit the intended browser artifacts and metadata, and update
`THIRD_PARTY_NOTICES.md` with the immutable upstream commit, retained copyright
notice, local paths, and SHA-256 hashes. CI does not accept a missing or no-op
parser. Apply the same provenance process to every copied or derived map asset.

## Private demos

`*.dem` and `fixtures/private/` are intentionally ignored. Never commit a user
or private demo or upload one to a pull request, issue, release, Pages, or
Actions artifact. Use synthetic fixtures for new automated coverage; the only
exception is the public test demo that remains inside the attributed upstream
submodule. If manual validation is needed, record behavior and timing in the
pull request without attaching the demo.

## Pull requests

- Keep each pull request focused and explain user-visible behavior.
- Link an issue when one exists and describe privacy/security implications.
- Add or update automated tests and documentation.
- Confirm that no demo-derived data appears in network requests.
- Complete the checklist in the pull request template.

Maintainers should squash or rebase as appropriate; contributors do not need to
rewrite unrelated history.

## Repository settings

Files alone cannot enable branch protection. An administrator must apply the
rules in [`.github/BRANCH_PROTECTION.md`](.github/BRANCH_PROTECTION.md) after the
repository is created and whenever required job names change.

For vulnerabilities, follow [`SECURITY.md`](SECURITY.md) instead of opening a
public issue.
