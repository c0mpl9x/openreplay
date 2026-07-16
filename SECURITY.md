# Security policy

## Supported versions

Until the first stable release, only the current `main` branch is supported with
security fixes. After releases begin, this table must be updated before an older
line is declared unsupported.

| Version                            | Supported |
| ---------------------------------- | --------- |
| `main`                             | Yes       |
| Unreleased forks and older commits | No        |

## Reporting a vulnerability

Please submit a
[private vulnerability report](https://github.com/c0mpl9x/openreplay/security/advisories/new)
through **Security → Advisories → Report a vulnerability**. That creates a
private discussion with maintainers. Do not open a public issue for a suspected
vulnerability.

Include:

- the affected commit and browser;
- impact and the smallest reproducible sequence;
- a minimal synthetic fixture or redacted evidence, if needed;
- any suggested mitigation.

Do not submit a private `.dem`, authentication material, personal data, or
unredacted match data. A demo is normally processed only in your browser, but a
malicious demo may still exercise parser, memory, and rendering code. Describe
the file structure or provide a purpose-built minimal reproducer instead.

Maintainers will acknowledge the report through the private advisory, assess
scope and severity, coordinate a fix, and agree on disclosure timing. Response
times are best effort because this is a volunteer project.

## Security and privacy boundaries

The expected design is a static, local-only application:

- demo bytes and parsed match data must not be transmitted;
- no backend, account, remote storage, or analytics is part of v0.1;
- parser work runs in a disposable Worker and cancellation terminates it;
- file type, Source 2/GOTV shape, supported map, and 500 MiB limit are validated;
- generated DOM text must be treated as untrusted, including player names;
- WASM, map assets, and GitHub Actions must have recorded provenance.

Security reports are appropriate for violations of those boundaries, arbitrary
code execution, cross-site scripting, denial of service beyond documented
limits, dependency compromise, or a way to make the application upload data
without explicit consent. General parser compatibility problems belong in a bug
report with synthetic/redacted data.
