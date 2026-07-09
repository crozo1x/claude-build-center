# Prompt: Sonnet 5 - Core Roblox Builder Coach MVP

You are the primary product builder for BasePlate while the owner is away.

## Goal

Transform BasePlate from a Roblox-flavored terminal dashboard into the first true Roblox Vibe Coding Coach MVP.

## Branch

```bash
git checkout main
git pull --ff-only origin main
git checkout -b agent/builder-coach-mvp
```

## Product Requirements

Build a default first-screen workflow with these sections:

1. Idea
2. Plan
3. Scripts
4. Debug
5. Workspace or Advanced

The existing terminal/widget workspace should move behind Workspace/Advanced. Do not delete it.

## Idea Section

- Text area for a Roblox game idea.
- Prompt chips: Simulator, Obby, Tycoon, Pet Game, Fighting Arena, Round-Based Minigame, Shop, Leaderstats, Data Saving, UI Polish.
- Button: Generate Build Plan.

## Plan Section

Generate deterministic local output. No API key needed.

Include:

- Concept summary.
- Core gameplay loop.
- Roblox services needed.
- Studio object tree.
- Setup checklist.
- Playtest checklist.
- Client/server safety notes.

## Scripts Section

Generate script cards with:

- Filename.
- Roblox Studio placement path.
- Purpose.
- Luau code block.
- Copy code button.
- Copy path button.
- Mark tested checkbox.

At minimum include:

- `Leaderstats.server.lua`
- `CollectibleManager.server.lua`
- `SellZone.server.lua`
- `CurrencyGui.client.lua`

## Debug Section

Allow pasting Roblox Studio Output errors. Recognize:

- attempt to index nil
- is not a valid member
- Infinite yield possible
- missing RemoteEvent
- DataStore errors
- wrong script location

Return:

- Problem.
- Likely cause.
- Exact fix steps.
- What to test next.

## Engineering Constraints

- Prefer existing plain HTML/CSS/JS structure.
- Avoid new dependencies.
- Keep `npm start` working.
- Preserve Rojo sync, Play/Test, widgets, and terminal panes.
- Run `npm test` before pushing.
- If changing IPC or terminal spawn behavior, coordinate with Codex hardening lane.

## Acceptance Criteria

- App opens into Roblox builder workflow.
- User can generate a deterministic plan.
- User can inspect and copy script cards.
- Debug helper returns useful deterministic advice.
- Workspace/Advanced still gives access to existing terminal functionality.
- README reflects the new product behavior if changed.

## PR

Open a draft PR first. Mark ready only after tests pass and you have manually sanity-checked the UI.
