# GUI Modernization — Design Spec

Date: 2026-07-06
Status: Approved for planning

## Context

Build Center started as a general-purpose Electron control center for running Claude Code terminal sessions in a grid. It's being repositioned as a **Roblox-first "vibe coding" control center** — a dashboard specifically for building Roblox games with Claude Code, alongside real Roblox tooling (Rojo, Roblox Studio).

This spec covers only the **GUI Modernization** sub-project: the visual/interaction shell. Two related efforts are explicitly out of scope here and will get their own specs later:

- **Roblox Integration** — authoring the actual Roblox/Luau Claude Code skill content invoked by the "New Script" button, and the Roblox Open Cloud analytics integration.
- **Auto-Update System** — in-app "update available" → download → restart/relaunch flow for distributing the packaged app itself.

## Goals

1. Remove Electron's default native menu bar (File/Edit/View/Window/Help) — it reads as a stray editor chrome bar and has no purpose here.
2. Reskin the app in a "Modern SaaS Dashboard" visual direction: refined dark neutrals, subtle borders, calm blue accent — evolving the current theme rather than replacing it wholesale.
3. Let the app target a specific Roblox project folder, so widgets and skill buttons have something real to act on.
4. Add quick-launch buttons for the three highest-value Roblox dev actions.
5. Add a freeform widget canvas showing live, real data — not decorative fake data.

## Non-goals

- No changes to the existing terminal pane grid's core behavior (spawn/resize/kill via `node-pty` stays as-is).
- No Roblox Open Cloud analytics wiring (stub only).
- No Luau scripting skill content — "New Script" just opens a Claude Code session pane; what prompt/skill it runs is a follow-up.
- No app auto-updater.

## Design

### 1. Menu bar removal

`main.js` calls `Menu.setApplicationMenu(null)` before `createWindow()`. No user-facing configuration needed — this is just gone.

### 2. Visual theme

Evolve `renderer/style.css` toward the "Modern SaaS Dashboard" direction validated during brainstorming: keep the existing dark palette family (`#0d1117`/`#161b22`/`#21262d`) but tighten spacing, add subtle depth (soft shadows on panels instead of flat borders where it reads better), and keep the current blue accent (`#58a6ff`) as the single accent color rather than introducing new hues. The terminal pane grid keeps its current visual treatment — it was explicitly called out as already working well.

### 3. Project folder targeting

- New top-bar control: **"Set Project Folder"** (shows the current folder name when set, or "No project set" otherwise).
- Clicking it opens a native folder picker (Electron `dialog.showOpenDialog` with `properties: ['openDirectory']`), invoked via a new IPC handler in `main.js`.
- The chosen path is persisted to a JSON config file under Electron's `app.getPath('userData')` (e.g. `config.json`), and reloaded on next launch.
- All project-scoped widgets and skill buttons (below) read this path. When unset, they render a consistent "not configured" state rather than erroring.

### 4. Skill-launch buttons

Added to the top bar, alongside the existing "+ Terminal" / "+ Claude Session" buttons:

| Button | Behavior | Requires project folder? |
|---|---|---|
| **New Script** | Opens a new pane, same mechanism as "+ Claude Session" (auto-types `claude`), titled "New Script". What prompt/skill it eventually seeds is out of scope here — v1 just opens a plain Claude session. | No |
| **Sync to Studio** | Opens a new pane and auto-runs `rojo serve` with `cwd` set to the project folder. | Yes — button is disabled with a tooltip explaining why if no folder is set. |
| **Play / Test** | Shells out (via a new IPC handler, not a terminal pane) to launch Roblox Studio on the project's place file, if one can be found in the project folder (`*.rbxlx`/`*.rbxl`). | Yes — same disabled-with-tooltip treatment. |

If `rojo` isn't installed/on PATH, "Sync to Studio" surfaces a clear one-line error in the opened pane rather than a silent failure — reuses the existing `res.ok === false` pattern already in `renderer.js`.

### 5. Widget system

**Interaction model:** freeform canvas — widgets can be dragged anywhere and resized, not confined to fixed rails (this was an explicit choice over the simpler "confined side rails" option, accepting the added complexity).

**Implementation approach:** use an existing drag/resize library (GridStack.js is the leading candidate — vanilla JS, no framework dependency, matches this project's plain HTML/JS/CSS renderer) rather than hand-rolling drag/resize/collision logic.

**Persistence:** widget layout (which widgets exist, their position/size) is saved to the same userData config file as the project folder path, and restored on launch.

**Widget catalog (v1):**

| Widget | Data source | Behavior when project folder unset |
|---|---|---|
| **Git Status** | Runs `git status --short` / `git branch --show-current` against the project folder via a new IPC handler (`child_process.exec`), polls periodically (e.g. every 5s) or refreshes on window focus. | Shows "not configured" |
| **Active Sessions** | Purely local renderer state — lists currently open terminal panes (title, running/exited status), already tracked in the `sessions` map in `renderer.js`. No IPC needed. | N/A — always available, doesn't depend on project folder |
| **Rojo Sync Status** | Runs a `rojo` status check (exact command TBD during implementation — `rojo` doesn't have a rich status subcommand today, so this may just reflect "is a `rojo serve` pane currently running" rather than a deeper protocol check) against the project folder. | Shows "not configured" |
| **Roblox Analytics** | Stub only — static "Coming soon, requires Roblox Open Cloud API key" card. No live data in this phase. | Same stub regardless |

Widgets are added via a "+ Widget" control that opens a small picker listing the catalog above; removed via a close control on each widget, matching the existing pane close-button pattern for consistency.

### Error handling

- No project folder set → consistent "not configured" empty state across all project-scoped widgets/buttons, not per-widget bespoke messaging.
- Shell command not found (`git`, `rojo`) → widget shows the actual error text, not a generic failure — this project's existing pattern (see `pty:spawn`'s `{ ok: false, error }` shape) is followed for new IPC handlers too.
- Config file read/parse failure on launch → fall back to defaults (no project folder, empty widget canvas) rather than crashing.

### Testing

- Config persistence (load/save project folder + widget layout) is plain logic and gets unit tests.
- Git status / Rojo status parsing logic (turning command output into widget display state) is unit-testable in isolation from the IPC/UI wiring.
- The widget canvas, menu bar removal, and button wiring are verified manually by running the app (Electron UI isn't unit-testable in a meaningful way) — per the `verify` skill, this means actually launching Build Center and exercising: setting a project folder, adding/moving/resizing each widget type, clicking each skill button with and without a project folder set, and confirming the native menu bar is gone.

## Open questions for implementation planning

- Exact GridStack.js (or alternative) integration approach given the current no-build-step, plain-script `<script>` tag setup in `index.html`.
- Exact `rojo` CLI invocation for "sync status" given it doesn't have a dedicated status subcommand — likely needs to infer state from whether a `rojo serve` process/pane is active rather than querying Rojo itself.
