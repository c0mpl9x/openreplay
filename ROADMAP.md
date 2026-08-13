# OpenReplay roadmap

OpenReplay remains local-first while the MVP is being hardened. A selected
demo is parsed in the browser and is never uploaded, persisted, or included in
GitHub artifacts.

## v0.1.0 — Publish the MVP

- Publish the public repository and GitHub Pages site.
- Keep CI green in Chromium and Firefox.
- Validate the real Mirage GOTV acceptance demo locally.
- Keep parser artifacts, map assets, and provenance reproducible.

## v0.2 — Compatibility and stability

- [x] Exercise the WASM worker in Playwright WebKit. Validation in a real Safari
      installation remains a separate pending check.
- [x] Add public or synthetic coverage for truncated, invalid, POV, Source 1,
      near-limit, oversized, and unsupported-map demos.
- [x] Harden cancellation, reload, consecutive opens, memory release, and error
      recovery.
- [ ] Measure parse time and memory locally without telemetry.
- [ ] Validate responsive layouts and supported desktop browsers. Real Safari
      validation remains pending because no Safari-capable device is available.
- [x] Support the current Active Duty pool with compatible fixtures and recorded
      map-data provenance: Ancient, Anubis, Cache, Dust II, Inferno, Mirage, and
      Nuke (including Nuke's upper and lower levels).
- [x] Complete a dedicated stress validation with a demo at the 500 MiB limit.

### v0.2 compatibility fixes completed

- [x] Nuke: render upper and lower radars side by side so players remain visible
      when a replay contains players on both levels.
- [x] GOTV round lifecycle compatibility: accept valid recordings whose
      `round_end` metadata uses a different round-number offset than
      `round_start`, as seen in some Dust II demos.

## Future — Optional online layer

An online product is deliberately deferred. If it becomes worthwhile, keep the
existing `ReplayV1` model as the parser boundary and evaluate this separate
pipeline:

```text
ingestion/upload -> temporary storage -> isolated parsing -> ReplayV1/indexing -> API
```

That work requires explicit decisions about authentication, storage,
retention, quotas, moderation, demo copyright, abuse prevention, and ongoing
costs. It must not weaken the privacy guarantees of the local-first viewer by
default.
