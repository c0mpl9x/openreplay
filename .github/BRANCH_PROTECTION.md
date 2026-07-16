# Required repository rules

Repository administrators must create a ruleset targeting `main` in the
[repository rules settings](https://github.com/c0mpl9x/openreplay/settings/rules).
This cannot be enforced by a tracked file alone.

## Initial single-maintainer mode

Until a second maintainer is available, configure the ruleset to:

- require a pull request before merging;
- require branches to be up to date before merging;
- require conversation resolution;
- block force pushes and branch deletion;
- require these CI status checks:
  - `Quality`
  - `Parser integrity`
  - `Production build`
  - `E2E (chromium)`
  - `E2E (firefox)`
  - `Analyze JavaScript and TypeScript`
- do not require an approval, because the sole maintainer cannot approve their
  own pull request.

The initial commit may be pushed before this ruleset exists. After the ruleset
is active, normal changes must use a pull request and pass every required check.
Do not configure a routine bypass for the sole maintainer.

## GitHub platform settings

Configure [**Settings → Pages**](https://github.com/c0mpl9x/openreplay/settings/pages)
→ **Build and deployment → Source** to **GitHub Actions**, then protect the
`github-pages` environment so only `main` can deploy.

The `Pages` workflow is triggered only by a successful `CI` run on `main`,
checks out that run's exact commit, and requests only `pages: write` and
`id-token: write` for its deployment job.

Enable
[**Settings → Code security → Private vulnerability reporting**](https://github.com/c0mpl9x/openreplay/settings/security_analysis)
so the private reporting route documented in `SECURITY.md` is available. Enable
Dependabot alerts/security updates alongside the version-update configuration
tracked in `.github/dependabot.yml`.

## Multi-maintainer mode

When a second maintainer is available, add the following requirements:

- require at least one approval before merging;
- dismiss stale approvals after new commits;
- prevent bypass except for an explicitly documented emergency maintainer path.

Review this file whenever a workflow or job display name changes; required check
names must match exactly or merges will remain blocked.
