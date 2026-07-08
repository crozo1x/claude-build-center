# Prompt: Any Agent - Roblox Script and Prompt Pack

Claim this after the Builder Coach MVP is stable.

## Goal

Expand BasePlate's deterministic Roblox content library so the app can generate more useful script cards and prompt templates without an AI API.

## Systems to Add

Add templates for:

- Leaderstats.
- Coins/currency.
- Collectibles.
- Sell zone.
- Basic shop.
- Obby checkpoints.
- Pet follow placeholder.
- Daily reward placeholder.
- Round-based minigame skeleton.

## Template Requirements

Each template should include:

- Title.
- Studio placement path.
- Script type: Script, LocalScript, or ModuleScript.
- Purpose.
- Dependencies or objects to create.
- Luau code.
- Test checklist.
- Safety note if it touches RemoteEvents, purchases, or DataStore.

## Engineering Requirements

- Keep templates in data/helper modules, not giant inline renderer strings if avoidable.
- Add unit tests for template selection logic.
- No external API required.

## Acceptance Criteria

- User can select at least 5 Roblox systems and see script cards.
- Generated scripts are coherent starter code.
- No template teaches insecure client-authoritative currency changes.
