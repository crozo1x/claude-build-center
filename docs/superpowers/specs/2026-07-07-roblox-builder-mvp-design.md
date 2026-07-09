# Roblox Vibe Coding Coach MVP — Design Spec

**Date:** 2026-07-07
**Status:** Approved, pending implementation plan
**Follows:** GUI Modernization, Roblox Integration (PR #2, pending), Auto-Update System — all merged/in-flight on `main`
**Amended 2026-07-08 (Task 5.5):** reconciling against `docs/agent-handoff/prompts/01-sonnet-builder-coach-mvp.md` (a more detailed official prompt that surfaced after this spec was written, via a separate multi-agent coordination effort) added a 6th genre chip ("Round-Based Minigame"), an always-present "Client/server safety notes" Plan section, and restructured Debug output from a flat fix string into Problem/Likely cause/Fix steps/What to test next. The rest of this spec is unchanged and still accurate — see `docs/superpowers/plans/2026-07-07-roblox-builder-mvp.md`'s Task 5.5 for the exact amendment.

## Problem

BasePlate's default experience today is a terminal/pty grid — useful for an experienced developer running Claude Code sessions, but it drops a beginner Roblox creator straight into raw shells with no guidance. The product goal is to make the *first* thing a user sees be a guided path from "I have a game idea" to "I have a build plan, real scripts, and a way to debug common mistakes" — with the terminal grid preserved as a power-user escape hatch, not the entry point.

This is a repositioning, not a rename: the app keeps its "BasePlate" identity (name, `productName`, GitHub repo, npm package — all left alone, per explicit decision). "Roblox Vibe Coding Coach" describes the new guided-builder experience the app now leads with.

## Scope

**In scope (MVP):**
- A tab bar (`Idea | Plan | Scripts | Debug | Advanced`) as the app's top-level navigation. Default tab on launch: Idea.
- **Idea tab**: free-text game description + multi-select genre/feature chips (Simulator, Obby, Tycoon, Pet Game, Fighting Arena, Leaderstats, Shop, Data Saving, UI Polish) → "Generate Plan."
- **Plan tab**: deterministically generated (no AI/network call) concept summary, core loop, Roblox services list, an object/folder tree matching Roblox Studio's Explorer, a setup checklist, and a playtest checklist (including explicit multi-player testing guidance).
- **Scripts tab**: 4 static, hand-written reference Luau script cards (`Leaderstats.server.lua`, `CollectibleManager.server.lua`, `SellZone.server.lua`, `CurrencyGui.client.lua`), each with filename, Studio placement path, purpose, code, copy-code, copy-path, and a persisted "tested" checkbox.
- **Debug tab**: paste Roblox Studio Output text → deterministic pattern-matching against 6 named beginner error signatures, each returning a practical fix; unrecognized input gets a generic troubleshooting fallback, not silence.
- **Advanced tab**: the entire current UI (toolbar, terminal grid, widget canvas, widget picker) unchanged in behavior, reparented under one tab container.
- IPC hardening: `main.js`'s `pty:spawn` handler validates `shell` against an explicit allowlist (`powershell.exe`, `cmd.exe`) instead of accepting any string.
- Persistence: idea text, active chips, generated plan, and per-script "tested" state survive app restarts via the existing `lib/config-store.js` pattern.
- README rewritten to lead with the builder experience; package.json `description` updated to reflect the new positioning (name/productName/appId/GitHub repo untouched).

**Explicitly out of scope for this MVP (per user's own scoping and "smallest coherent implementation" instruction):**
- Any live AI/LLM API call anywhere in Idea/Plan/Scripts/Debug — everything is deterministic template logic and pattern matching. (The existing "New Script" button in Advanced already gives access to a real Claude Code session for anything the deterministic tools can't handle.)
- Conditional/generated script templates based on chip selection — the same 4 scripts show every time. A chip-aware script library is a natural fast-follow, not part of this pass.
- Any change to `main.js`'s pty/terminal/Rojo/update logic beyond the shell allowlist. Auto-update, Rojo integration (once merged), and the terminal grid's actual behavior are untouched.
- A public rename of the app itself — this is a UI/positioning change layered onto the existing "BasePlate" product.

## Architecture

### Tab shell

A new top-level `<div id="tabBar">` with 5 buttons and a `<div id="tabPanels">` containing 5 section `<div>`s (`#tabIdea`, `#tabPlan`, `#tabScripts`, `#tabDebug`, `#tabAdvanced`). Switching tabs toggles a `.active`/`.hidden`-style class, exactly the same show/hide mechanism already used for the widget picker — no new UI framework, no router.

`#tabAdvanced` wraps the *entire current* `#toolbar` + `#workspace` + `#widgetPicker` markup verbatim. No behavior in Advanced changes; it just moves one level deeper in the DOM tree. This is the single highest-leverage design decision for de-risking the whole feature: the existing, already-tested terminal/widget/Rojo/update code paths are not touched, only relocated.

### New pure-logic modules (mirrors this codebase's established `lib/*.js` pattern)

- `lib/plan-generator.js` — `generatePlan({ ideaText, chips })` → returns the structured plan object (concept summary, core loop, services, folder tree, setup checklist, playtest checklist). Pure function, fully unit-testable, one core-loop fragment per genre chip plus additive logic per feature chip. Edge cases, resolved now rather than left ambiguous:
  - **Zero genre chips selected** (a beginner may just type free text and hit Generate without picking any): falls back to a generic "custom game" core-loop template built only from `ideaText` and any feature chips, rather than erroring or producing an empty section.
  - **Multiple genre chips selected** (e.g. both Simulator and Tycoon): their core-loop fragments are joined into one combined description ("A Tycoon-style game with Simulator elements: ...") rather than only honoring one and silently dropping the other.
- `lib/debug-matcher.js` — `matchError(outputText)` → returns `{ matched: true, pattern, fix }` for a recognized signature, or `{ matched: false, fix: <generic fallback> }` otherwise. Pure function, table-driven over the 6 named patterns, unit-testable the same way `classifyRojoLine` was.

Both live in `lib/` (main-process-agnostic, plain Node/JS) even though they're only ever called from the renderer — they get `require`d directly by `renderer.js` the same way browser-side code already reuses `escapeHtml` etc.; no IPC round-trip needed since there's no privileged operation involved (pure string/data transformation, no filesystem/process access). This keeps them testable with plain `node --test` without spinning up Electron.

### Scripts tab content

The 4 script cards' Luau source and metadata live as a plain data array (`SCRIPT_TEMPLATES` in `renderer/scripts-data.js` or similar) — filename, Studio path, purpose blurb, and code string per entry. Rendering, copy-to-clipboard (via the renderer's existing `contextIsolation`-safe APIs — `navigator.clipboard.writeText`, no IPC needed), and the tested-checkbox wiring are the only "logic" here; the Luau content itself is hand-written once, not templated.

### Debug tab

Textarea + "Diagnose" button → `matchError()` → rendered fix card(s). The 6 signatures (`attempt to index nil`, `is not a valid member`, `Infinite yield possible`, missing `RemoteEvent`, DataStore problems, wrong script location) each map to a short, practical explanation plus 2-4 concrete next steps, written once as static content alongside the matcher's pattern table.

### IPC hardening

`main.js`'s `pty:spawn` handler currently accepts any `shell` string and passes it straight to `pty.spawn()`. It changes to:
```js
const ALLOWED_SHELLS = ['powershell.exe', 'cmd.exe'];
...
const shellPath = ALLOWED_SHELLS.includes(shell) ? shell : (process.env.COMSPEC || 'powershell.exe');
```
This is the only `main.js`/`preload.js` change in this entire feature. Builder tabs (Idea/Plan/Scripts/Debug) never call `window.api.spawn`/`input`/`resize`/`kill` at all — those remain exclusively wired to Advanced's existing buttons, so the isolation the user asked for ("do not let normal builder UI trigger arbitrary shell commands") holds structurally, not just by convention; the allowlist is defense-in-depth on top of that.

### Persistence

`lib/config-store.js`'s `defaultConfig()`/`loadConfig()` gain a `builder` key:
```js
builder: { ideaText: '', chips: [], plan: null, scriptsTested: {} }
```
validated the same defensive way `widgets` already is (type/array checks, fall back to default on anything malformed). Saved via the existing generic `config:save` IPC handler — no new IPC surface needed, the renderer just includes `builder` in the object it already sends.

Save-trigger strategy (not saving on every keystroke): chip toggles, plan generation, and tested-checkbox changes save immediately (discrete, infrequent events — same as how a widget being added already triggers a save today). Idea-text typing debounces the save by ~800ms after the user stops typing, rather than firing on every keystroke — a small, self-contained `setTimeout`-based debounce in the renderer, no new dependency.

## Testing

- `lib/plan-generator.js` and `lib/debug-matcher.js`: full `node --test` coverage — one test per genre/chip combination for the generator, one test per error signature (plus the fallback case) for the matcher. This is the majority of this feature's real test coverage, matching the project's existing pattern of testing pure logic thoroughly and verifying DOM/IPC manually.
- Tab switching, chip toggling, script-card rendering/copy buttons, and the Advanced tab's continued correctness: manual verification by running the app, consistent with how this codebase already treats renderer/UI code (not meaningfully unit-testable, per the existing README's own stated testing philosophy).
- Explicit regression check: after reparenting the current toolbar/workspace/widget-canvas into Advanced, re-verify every existing button (Set Project Folder, +Terminal, New Script, Sync to Studio, Play/Test, +Widget, Update Available) still works exactly as before — this is the one place a MVP-sized feature could silently regress a lot of already-shipped functionality if the reparenting is done carelessly.

## Security and architecture notes to flag, not fix, in this pass

(Per the user's explicit ask to "note any security or architecture concerns you do not fix.")

- `main.js`'s `BrowserWindow` still uses `sandbox: false`. The shell allowlist added here reduces (doesn't eliminate) the blast radius of a compromised renderer; a full sandboxed-renderer hardening pass is a separate, larger effort not attempted in this MVP.
- `preload.js` still exposes `input`/`resize`/`kill` with no sender/origin validation beyond Electron's default `contextIsolation`. Fine today (no remote/untrusted content ever loads in this renderer), but worth remembering if this app ever loads any non-local content.
- The Debug tab's pattern matching is deliberately narrow (6 signatures) — it will confidently say nothing useful for any error outside that list. The generic fallback message mitigates this but doesn't replace real debugging help; a future pass could route unmatched errors into an actual Claude Code session in Advanced instead of a static fallback.
