# Integration Readiness

Last updated: 2026-07-09

This file is for agents coordinating BasePlate work while multiple branches are open. Keep merges small, verify each branch, and do not overwrite another agent's in-progress UI work.

## Current State

Merged and available on `main`:

- PR #14 `agent/windows-desktop-launcher`: Windows desktop shortcut launcher, `npm run shortcut`, and `npm run shortcut:pack`.
- PR #13 `agent/pr-template`: Pull request template.
- PR #12 `agent/ci-pr-checks`: Windows CI for icon generation, JavaScript syntax, and tests.
- PR #8 `agent/security-policy-guards`: Renderer CSP/navigation guards.
- PR #5 `codex/ipc-hardening`: IPC input validation guards.
- PR #4 `feature/auto-update-system`: Installer/release/update workflow.
- PR #1 `feature/gui-modernization`: Dashboard, widgets, project persistence, and Roblox workflow buttons.

Open PRs at the time of this audit:

| PR | Branch | Status | Main Risk |
| --- | --- | --- | --- |
| #11 | `agent/builder-coach-mvp` | Draft, mergeable, CI pending | Touches renderer UI and IPC guard/config files. Needs completion before merge. |
| #10 | `agent/onboarding-ux` | Open, no checks reported | Touches the same renderer files as #11 and #2. Needs rebase/checks before merge. |
| #9 | `hardening-integration` | Open, no checks reported | Likely overlaps with already-merged PR #5 and may be redundant. |
| #2 | `feature/rojo-integration` | Open, no checks reported | Large older branch touching core Rojo, main/preload, renderer, widgets, and tests. High rebase risk. |

## Recommended Merge Order

1. **PR #11 Builder Coach MVP** after it is complete and CI passes.
   - It is the highest product value branch and currently reports as mergeable.
   - It adds core Roblox vibe-coding behavior, not only infrastructure.

2. **PR #10 Onboarding UX** after rebasing on top of the Builder Coach result.
   - It shares renderer files with #11: `renderer/index.html`, `renderer/renderer.js`, `renderer/style.css`, and `renderer/widgets.js`.
   - Rebase after #11 reduces the chance of losing Builder Coach UI wiring.

3. **PR #2 Rojo Integration** after #10 lands, or split it into smaller PRs.
   - It is older and touches many of the same renderer files as #10/#11.
   - If rebase is difficult, salvage pure Rojo modules/tests first, then integrate UI separately.

4. **PR #9 Terminal IPC payload hardening** only after a duplicate audit.
   - PR #5 already merged IPC validation guards.
   - Do not merge #9 blindly. Rebase it and keep only unique tests/behavior that #5 did not cover.

## File Hotspots

These files are touched by multiple open PRs and should be treated as conflict-prone:

- `main.js`: #2, #9
- `preload.js`: #2
- `lib/ipc-guards.js`: #9, #11
- `lib/config-store.js`: #11
- `renderer/index.html`: #2, #10, #11
- `renderer/renderer.js`: #2, #9, #10, #11
- `renderer/style.css`: #2, #10, #11
- `renderer/widgets.js`: #2, #10, #11
- `renderer/lib/rojo-status.js`: #2
- `test/ipc-guards.test.js`: #9, #11
- `test/config-store.test.js`: #11
- `test/rojo-status.test.js`: #2

## PR Notes

### PR #11 Builder Coach MVP

Files touched:

- `docs/superpowers/plans/2026-07-07-roblox-builder-mvp.md`
- `docs/superpowers/specs/2026-07-07-roblox-builder-mvp-design.md`
- `lib/config-store.js`
- `lib/debug-matcher.js`
- `lib/ipc-guards.js`
- `lib/plan-generator.js`
- `renderer/index.html`
- `renderer/renderer.js`
- `renderer/style.css`
- `renderer/tabs.js`
- `renderer/widgets.js`
- `test/config-store.test.js`
- `test/debug-matcher.test.js`
- `test/ipc-guards.test.js`
- `test/plan-generator.test.js`

Next action: finish the remaining checklist, wait for CI, then merge before onboarding/Rojo UI branches.

### PR #10 First-run Onboarding UX

Files touched:

- `renderer/index.html`
- `renderer/lib/onboarding-content.js`
- `renderer/onboarding.js`
- `renderer/renderer.js`
- `renderer/style.css`
- `renderer/widgets.js`
- `test/onboarding-content.test.js`

Next action: rebase after #11, run `npm test`, and manually inspect the first-run flow for layout collisions.

### PR #9 Terminal IPC Payload Hardening

Files touched:

- `README.md`
- `lib/ipc-guards.js`
- `main.js`
- `renderer/renderer.js`
- `test/ipc-guards.test.js`

Next action: compare against main's current `lib/ipc-guards.js` and `test/ipc-guards.test.js`. If the only value is duplicate validation already merged in #5, close it or replace it with a small PR that adds only missing test cases.

### PR #2 Rojo Integration

Files touched:

- `README.md`
- `docs/superpowers/plans/2026-07-07-rojo-integration.md`
- `docs/superpowers/specs/2026-07-07-rojo-integration-design.md`
- `lib/rojo.js`
- `main.js`
- `preload.js`
- `renderer/index.html`
- `renderer/lib/rojo-status.js`
- `renderer/renderer.js`
- `renderer/style.css`
- `renderer/widgets.js`
- `test/rojo-classify.test.js`
- `test/rojo-health.test.js`
- `test/rojo-installed.test.js`
- `test/rojo-status.test.js`

Next action: rebase after #10/#11 or split into a smaller Rojo module/test PR first. The pure `lib/rojo.js` and Rojo tests are likely easier to salvage than the renderer integration.

## Required Validation

For feature or app-code PRs:

```powershell
npm test
```

For packaging/icon/shortcut PRs:

```powershell
npm run icon
npm test
```

For release work:

```powershell
gh pr checks <number> --repo crozo1x/baseplate
npm run dist:win
```

Only run `npm run dist:win` from a short local path such as `C:\tmp\baseplate` or `C:\Users\<you>\Projects\baseplate`; deep Claude/Codex session folders can hit Windows path-length problems.

## Agent Rules

- Do not use `git reset --hard` or overwrite another agent's branch.
- Prefer one PR per coherent update.
- Before merging, confirm the PR is based on current `main` and CI has run after the latest push.
- If two PRs touch the same renderer files, merge the higher product-value branch first and rebase the other.
- If a branch has no checks reported, push a no-op rebase or update after CI exists, then wait for checks.
- Update this file whenever a major PR merges or an open branch is closed as superseded.