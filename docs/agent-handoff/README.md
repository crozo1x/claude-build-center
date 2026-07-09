# BasePlate Two-Day Agent Handoff

Owner is away for about 2 days. This folder is the operating manual for agents building, pushing, merging, and releasing BasePlate updates during that window.

Start here, then read the prompt file for your assigned lane in `docs/agent-handoff/prompts/`.

## Current Product Direction

BasePlate is the Roblox vibe coding app. The goal is not just a terminal dashboard. The next product shape is a guided Roblox build coach that helps a beginner go from game idea to Roblox Studio object tree, Luau scripts, testing checklist, and error debugging.

Current foundation:

- Electron app with pty/xterm terminal panes.
- BasePlate branding and Windows installer packaging.
- Project folder picker.
- Rojo sync and Play/Test commands.
- Widget canvas for sessions, Git, Rojo status, and analytics stub.
- Unit tests using Node's built-in `node --test` runner.

## Agent Roster

Use these lanes unless the owner gives a newer instruction:

| Agent | Primary lane | Prompt |
| --- | --- | --- |
| Sonnet 5 | Core Roblox Builder Coach MVP | `prompts/01-sonnet-builder-coach-mvp.md` |
| Fable 5 | First-run onboarding, copy, UX polish | `prompts/02-fable-onboarding-ux.md` |
| GPT-5.5 medium | Release captain, merge queue, installer verification | `prompts/03-gpt55-release-captain.md` |
| Codex | IPC/security hardening, integration fixes, tests | `prompts/04-codex-hardening-integration.md` |

If an agent is unavailable, another agent may take its lane after checking open PRs and branches.

## Non-Negotiable Rules

1. Always start from latest `main` unless explicitly continuing a named branch.
2. Never push directly to `main` for feature work. Use a branch and PR.
3. Keep PRs narrow enough to review and merge independently.
4. Run relevant checks before pushing. At minimum run `npm test` for JS changes.
5. If packaging changed, run `npm run icon` and at least one packaging smoke command if dependencies are installed.
6. If two agents touch the same files, coordinate through PR comments or rebase. Do not force-push over another agent's work.
7. Do not create a release tag until the release captain verifies `main` is green and has the intended commits.
8. Do not add paid APIs, external services, secrets, or telemetry without explicit owner approval.

## Branch Naming

Use this pattern:

```text
agent/<lane-name>
```

Examples:

```text
agent/builder-coach-mvp
agent/onboarding-ux
agent/release-v0.1.3
agent/ipc-hardening-followup
```

## PR Expectations

Every PR body should include:

```markdown
## Summary
- what changed
- why it matters

## Validation
- commands run
- manual checks performed

## Coordination Notes
- files likely to conflict
- follow-up work needed
```

Open as draft if the work is not ready to merge. Mark ready only after tests pass and the branch is current with `main`.

## Update Queue

Priority order while the owner is away:

1. Core Builder Coach MVP.
2. Onboarding and Roblox beginner UX polish.
3. IPC/security and config validation follow-up.
4. Installer/package smoke verification.
5. Release `v0.1.3` after stable PRs merge.

Details are in `UPDATE_BOARD.md` and the prompt files.

## Release Ownership

GPT-5.5 medium should act as release captain unless the owner says otherwise. Release instructions are in `RELEASE_RUNBOOK.md`.

## If Things Go Wrong

- If tests fail: do not merge. Fix or document the blocker.
- If a branch conflicts with active work: pause and ask in the PR comment instead of force-resolving blindly.
- If release workflow fails: inspect GitHub Actions logs before retagging.
- If installer builds fail on `node-pty`: check Node/Electron ABI and native rebuild notes in README.
