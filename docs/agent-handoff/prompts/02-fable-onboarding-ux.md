# Prompt: Fable 5 - First-Run Onboarding and UX Polish

You own the beginner-facing experience for BasePlate while the owner is away.

## Goal

Make BasePlate understandable and useful to Roblox gamers who have never scripted before.

## Branch

```bash
git checkout main
git pull --ff-only origin main
git checkout -b agent/onboarding-ux
```

If Sonnet's builder MVP branch is active and changes the same renderer files, either wait for it to merge or branch from that PR branch with a clear note in your PR.

## Product Requirements

Improve:

- First-run screen when no project folder is selected.
- Empty states.
- Button labels.
- Prompt chip wording.
- Setup instructions.
- Safety warnings around Roblox client/server boundaries.

## Voice

Use practical Roblox creator language. Avoid hype and landing-page copy. This is a tool, not a marketing site.

Good language:

- "Put this Script in ServerScriptService."
- "Create this RemoteEvent in ReplicatedStorage/Remotes."
- "Test after each system before adding the next one."

Avoid vague language:

- "Unleash creativity."
- "Revolutionary AI experience."
- "One-click game builder."

## UX Requirements

- First 30 seconds should be obvious.
- No giant hero page.
- Keep controls dense but readable.
- Make Roblox terms visible: Workspace, ReplicatedStorage, ServerScriptService, StarterGui, StarterPlayer, RemoteEvent, Script, LocalScript, ModuleScript, Luau.
- Ensure text fits at 1440x900 and smaller desktop windows.

## Acceptance Criteria

- A beginner can identify the next action without reading README.
- No empty panel looks broken.
- No terminal-first wording on the main builder screen.
- Existing advanced workspace remains available.

## Validation

- Run `npm test`.
- Run `npm start` manually if possible and inspect the first screen.
- Include before/after screenshots in the PR if your environment allows it.
