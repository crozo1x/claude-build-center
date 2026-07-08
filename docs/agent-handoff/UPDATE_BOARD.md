# Update Board

This board turns the product direction into concrete shippable updates. Agents should claim one item at a time.

## P0 - Roblox Builder Coach MVP

Owner: Sonnet 5 by default.

Build the first non-terminal-first experience:

- Main tabs: Idea, Plan, Scripts, Debug, Workspace.
- Idea screen with Roblox game prompt chips.
- Deterministic local plan generator. No API required.
- Plan screen with object tree, services, setup checklist, playtest checklist.
- Scripts screen with script cards, Studio placement, code, copy buttons, tested checkbox.
- Debug screen recognizing common Roblox Studio errors.
- Existing terminal panes move under Workspace/Advanced, not the first experience.

Acceptance criteria:

- App launches to builder, not terminals.
- User can generate a Roblox plan without API keys.
- At least 4 script cards exist for a simulator-style example.
- Existing Rojo/Play/Test still reachable.

## P1 - First-Run Onboarding and UX Polish

Owner: Fable 5 by default.

Make the app understandable for Roblox gamers:

- First-run state when no project folder is selected.
- Clear Roblox language around Workspace, ReplicatedStorage, ServerScriptService, StarterGui, StarterPlayer.
- Prompt examples for simulator, obby, tycoon, pet game, fighting arena.
- Empty states for widgets/Workspace.
- Helpful warnings for client/server trust and RemoteEvents.

Acceptance criteria:

- A beginner can tell what to do in the first 30 seconds.
- No marketing landing page; the app remains a tool.
- Text is concise, Roblox-specific, and actionable.

## P1 - Security and IPC Follow-Up

Owner: Codex by default.

Continue reducing risk from terminal and local process controls:

- Merge or build on PR #5 if not already merged.
- Move terminal launch intents toward named profiles instead of arbitrary renderer commands.
- Validate persisted config and project folder paths.
- Add tests for guard helpers.
- Add Content Security Policy if renderer structure allows it.

Acceptance criteria:

- Renderer cannot request arbitrary shell executable or arbitrary autorun command.
- Tests cover validation behavior.
- Existing terminal UX still works.

## P1 - Installer and Release Verification

Owner: GPT-5.5 medium by default.

Confirm BasePlate is installable by double-click:

- Verify `npm run dist:win` creates `dist/BasePlate-Setup-<version>.exe`.
- Verify `npm run pack:win` creates `dist/win-unpacked/BasePlate.exe`.
- Confirm icon appears in the EXE/installer output.
- Confirm Start Menu and Desktop shortcut config remains in package metadata.

Acceptance criteria:

- Release notes mention unsigned Windows installer if relevant.
- Release workflow produces downloadable assets.

## P2 - Roblox Prompt and Script Pack

Any agent can claim after P0 is stable.

Add a template library for common Roblox systems:

- Leaderstats.
- Coins/currency.
- Collectibles.
- Sell zone.
- Shop system.
- Simple DataStore warning and starter pattern.
- Obby checkpoints.
- Round-based minigame skeleton.

Acceptance criteria:

- Templates are deterministic and testable.
- Script cards explain where each script goes.
- Security warnings call out client/server boundaries.

## P2 - Release v0.1.3

Owner: GPT-5.5 medium release captain.

Release only after stable PRs merge. See `RELEASE_RUNBOOK.md`.
