# BasePlate - Roblox Vibe Coding Coach

A guided path from "I have a Roblox game idea" to a real build plan, reference Luau scripts, and practical debugging help — built for beginners, not just developers. The existing terminal/Claude Code control center is still here, now under the **Advanced** tab, for anyone who wants direct shell/AI-session access.

See `docs/superpowers/specs/` for design docs and `docs/superpowers/plans/` for implementation plans as they land.

## What it does

- **Idea** — describe your game in your own words and pick genre/feature chips (Simulator, Obby, Tycoon, Pet Game, Fighting Arena, Round-Based Minigame, Leaderstats, Shop, Data Saving, UI Polish).
- **Plan** — a deterministically generated (no AI call) build plan: concept summary, core loop, Roblox services you'll need, an Explorer-style folder tree, a setup checklist, a playtest checklist that explicitly calls out multi-player testing, and client/server safety notes.
- **Scripts** — 4 ready-to-use reference Luau scripts (leaderstats, a collectible pickup, a sell zone, a currency display) with filename, exact Studio placement path, purpose, one-click copy for code and path, and a persisted "tested" checkbox per script.
- **Debug** — paste a Roblox Studio Output error and get a structured diagnosis (problem, likely cause, fix steps, what to test next) for the most common beginner mistakes (nil indexing, missing members, infinite yields, RemoteEvent issues, DataStore problems, wrong script type/location).
- **Advanced** — the original terminal/Claude Code control center: real pty-backed terminal panes, Rojo sync, Play/Test, and the widget dashboard, unchanged.

**Current limitations (MVP):** Plan generation and Scripts are template-based, not AI-generated — they cover common beginner patterns, not every possible game. Debug recognizes 6 specific error signatures; anything else gets general troubleshooting guidance and a pointer to use Advanced's "New Script" for a real Claude Code session on harder problems.

## Prerequisites (Windows)

1. **Node.js** (LTS, 18+) — https://nodejs.org
2. **Python 3** — required by `node-gyp` to compile `node-pty`'s native module.
3. **Visual Studio Build Tools** with the "Desktop development with C++" workload — same reason. Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - If you already have Visual Studio installed with the C++ workload, you're covered.
4. **Claude Code CLI** installed and authenticated (`claude` should work from a plain terminal already) — this app just launches it inside a pane, it doesn't install or auth it.
5. **Rojo** (optional) — needed for "Sync to Studio" to do anything real. Without it, that button opens a pane that shows a clear shell error rather than failing silently.

The native-compile step for `node-pty` is the one place `npm install` can go sideways on a fresh machine. If step 3 is missing, it'll fail with a `gyp` or `MSBuild` error — install the Build Tools and re-run.

**A note on working directory (Windows):** if you're running this from a deeply nested folder (e.g. inside another tool's session/temp directory), `npm install` and `git init` can fail with cryptic `ENOENT`/"Filename too long" errors once the path exceeds Windows' 260-character limit — this affects `node-gyp`'s native build step and git's `.git` directory creation. If you hit this, move the project to a short, stable path (e.g. `C:\Users\<you>\Projects\baseplate`) and retry from there.

## Install & run

```
cd baseplate
npm install
npm start
```

(`npm run dev` is an alias for `npm start`.)

### Build a Windows installer or EXE

```
npm run dist:win
```

This generates `dist/BasePlate-Setup-<version>.exe`. Double-click that installer to install BasePlate with the app icon, Start Menu shortcut, and Desktop shortcut.

For a local unpacked build without an installer:

```
npm run pack:win
```

Then double-click `dist/win-unpacked/BasePlate.exe`.

If you change the logo source, regenerate the Windows icon assets with:

```
npm run icon
```

If `npm install` fails specifically on `node-pty`, and you're sure Build Tools + Python are installed, try:

```
npm run rebuild
```

which forces an Electron-ABI-matched rebuild of the native module.

### Running tests

```
npm test
```

Runs the unit test suite (Node's built-in `node --test`) covering the pure logic modules — config persistence, git status parsing, place-file lookup, and Rojo sync status inference. Electron UI/IPC isn't covered by automated tests (not meaningfully unit-testable); those are verified manually by running the app.

## Project layout

```
baseplate/
  package.json
  main.js                    Electron main process: window, pty lifecycle, and all IPC handlers
  preload.js                 contextBridge: exposes a locked-down window.api to the renderer
  assets/                    BasePlate app icon source and generated Windows icon files
  scripts/                   Build helper scripts such as icon generation
  lib/                       Pure, unit-tested logic used by main.js
    config-store.js          Load/save the JSON config file (project folder + widget layout)
    git-status.js            Parses raw `git` CLI output into a status object
    find-place-file.js       Finds a .rbxl/.rbxlx file in a directory listing
  renderer/
    index.html               Toolbar + terminal pane grid + widget canvas containers
    renderer.js               Pane creation, xterm wiring, resize handling, session state publishing
    state.js                  Shared pub/sub (window.BuildCenter) for project folder + session state
    widgets.js                 Widget catalog, GridStack wiring, add/remove/persist
    style.css                 Dark "Modern SaaS Dashboard" theme
    lib/
      rojo-status.js          Dual Node/browser module: infers Rojo sync state from session list
  test/                       Unit tests (node --test) mirroring the lib/ and renderer/lib/ modules
  docs/superpowers/
    specs/                    Design specs written before implementation
    plans/                    Step-by-step implementation plans
```

## How it works

- `main.js` owns real `node-pty` processes (keyed by a per-pane id) and every other IPC handler: config load/save, the project folder dialog, git status (`child_process.execFile`), and Play/Test (`shell.openPath`).
- `preload.js` exposes `window.api.{spawn,input,resize,kill,onData,onExit,config,project,git,roblox}` to the renderer over a locked-down contextBridge (no `nodeIntegration`, no raw `require` in the page).
- `renderer/state.js` is the single shared source of truth in the renderer for the current project folder and the list of open terminal sessions, so `renderer.js` (which owns the panes) and `widgets.js` (which owns the dashboard) can stay decoupled.
- `renderer/widgets.js` uses GridStack.js (loaded via a plain `<script>` tag — no bundler) for the freeform drag/resize canvas, and persists layout + project folder together via `window.api.config`.
- Widget render functions that subscribe to live state (Active Sessions, Git Status, Rojo Sync Status) return a `dispose()` function, called when the widget is removed, to clear timers/unsubscribe listeners and avoid leaks.
- User-influenced text (git branch names, session titles) is HTML-escaped before being inserted into the DOM — branch names in particular can contain arbitrary characters, and this app's own terminal-spawning IPC makes that a real injection path if left unescaped.

## Extending it

- **Add a shell option** (e.g. WSL, Git Bash): add an `<option>` to `#shellSelect` in `index.html` with the shell's executable path.
- **Change what "New Script" runs**: edit the `autoRun: 'claude'` call in `renderer.js` (e.g. `claude --resume`, or a wrapper script that `cd`s somewhere first).
- **Add a new widget type**: add an entry to `WIDGET_CATALOG` in `widgets.js` with a `type`, `title`, and `render(container)` function; return a `dispose()` from `render` if it subscribes to live state or sets a timer.
- **Default working directory per pane**: pass a `cwd` in the `window.api.spawn(...)` call in `renderer.js`.

## Next steps (not built yet)

1. **Roblox skill content** — "New Script" currently just opens a plain Claude Code session; authoring actual Luau/Roblox-specific Claude Code skills for it to invoke is a separate follow-up project.
2. **Roblox Open Cloud analytics** — the Roblox Analytics widget is a stub; wiring up live player/visit counts requires an API key and its own design pass.
3. **Local agent/process manager** — a side panel for other local AI agent processes (Ollama models, custom Python agent loops, etc.), separate from the terminal grid and widget canvas.
4. **True split-pane resizing** — current terminal layout is a responsive auto-grid; draggable resize handles between panes would make it feel more like a real tiling terminal.
5. **Command palette** — `Ctrl+K`-style launcher to spawn a named terminal/agent/widget without touching the mouse.

## Recent Changes

- **2026-07-08** - Windows App Packaging: added BasePlate app icon assets, installer shortcut config, and build scripts for a double-clickable Windows installer or unpacked EXE.
- **2026-07-07** — Auto-Update System: packaged the app as a Windows installer (unsigned, via electron-builder), added a GitHub Actions release pipeline, and a toolbar "Update Available" button that downloads and restarts the app on click.
- **2026-07-06** — GUI Modernization: visual polish pass — toolbar/pane/widget shadows, greyed-out disabled buttons, and fixed a z-index conflict so maximized panes correctly stack above the widget canvas.
- **2026-07-06** — GUI Modernization: project folder selection now survives restarts, saved alongside the widget layout.
- **2026-07-06** — GUI Modernization: populated the widget canvas with Active Sessions, Git Status, Rojo Sync Status, and a stubbed Roblox Analytics widget — live data, safely escaped, with proper cleanup on removal.
- **2026-07-06** — GUI Modernization: added the GridStack-powered freeform widget canvas skeleton (add/remove/drag/resize plumbing, layout persistence) — no widgets yet, that's next.
- **2026-07-06** — GUI Modernization: added "Sync to Studio" (runs `rojo serve`) and "Play/Test" (opens the project's place file) buttons, both gated on a project folder being set.
- **2026-07-06** — GUI Modernization: renamed "+ Claude Session" to "New Script" and added live session state tracking (title/kind/exited) feeding the upcoming widget system.
- **2026-07-06** — GUI Modernization: added a git status IPC handler (`window.api.git.status`), wiring the earlier parser to real `git` CLI calls.
- **2026-07-06** — GUI Modernization: added the project folder picker ("Set Project Folder" button) and a shared renderer state module for the widget system to come.
- **2026-07-06** — GUI Modernization: added config load/save IPC handlers, persisting to a JSON file under Electron's userData directory.
- **2026-07-06** — GUI Modernization: removed the native Electron menu bar (File/Edit/View/Window/Help).
- **2026-07-06** — GUI Modernization: added the Rojo sync status module (`renderer/lib/rojo-status.js`), the last of the four pure logic modules underpinning the widget system.
- **2026-07-06** — GUI Modernization: added a Roblox place-file lookup module (`lib/find-place-file.js`) with tests.
- **2026-07-06** — GUI Modernization: added a git status parser module (`lib/git-status.js`) with tests.
- **2026-07-06** — GUI Modernization in progress (`feature/gui-modernization`): added config persistence module (`lib/config-store.js`) with test coverage, establishing the `node --test` convention for the rest of the rework.
- **2026-07-06** — Initial commit: Electron control center with terminal pane grid (v1 scaffold).
