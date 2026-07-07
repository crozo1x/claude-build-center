# Build Center (v1)

Local Electron app: a control-center window that opens real terminal panes (PowerShell/cmd) in a grid, so you can run multiple Claude Code sessions side by side. Each pane is a real pty-backed shell via `node-pty` + `xterm.js` — full interactivity, colors, prompts, everything.

Currently being reworked into a Roblox-first "vibe coding" control center — see `docs/superpowers/specs/` for design docs as they land.

## Recent Changes

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

## What v1 does

- "+ Terminal" — opens a new plain shell pane.
- "+ Claude Session" — opens a new pane and auto-types `claude` on launch.
- Panes lay out in a responsive grid. Click the ⤢ icon to maximize/restore a pane. Click × to close and kill that shell.
- Each pane resizes its pty automatically when you resize the window.

This is a v1 scaffold, not a finished product — the obvious next layer (not built yet) is a local agent/process manager panel and saved workspace layouts. See "Next steps" below.

## Prerequisites (Windows)

1. **Node.js** (LTS, 18+) — https://nodejs.org
2. **Python 3** — required by `node-gyp` to compile `node-pty`'s native module.
3. **Visual Studio Build Tools** with the "Desktop development with C++" workload — same reason. Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - If you already have Visual Studio installed with the C++ workload, you're covered.
4. **Claude Code CLI** installed and authenticated (`claude` should work from a plain terminal already) — this app just launches it inside a pane, it doesn't install or auth it.

The native-compile step for `node-pty` is the one place this can go sideways on a fresh machine. If step 3 is missing, `npm install` will fail with a `gyp` or `MSBuild` error — install the Build Tools and re-run.

## Install & run

```
cd claude-build-center
npm install
npm start
```

If `npm install` fails specifically on `node-pty`, and you're sure Build Tools + Python are installed, try:

```
npm run rebuild
```

which forces an Electron-ABI-matched rebuild of the native module.

## Project layout

```
claude-build-center/
  package.json
  main.js            Electron main process: window + pty lifecycle over IPC
  preload.js         contextBridge: exposes a minimal window.api to the renderer
  renderer/
    index.html       Toolbar + grid container
    renderer.js       Pane creation, xterm wiring, resize handling
    style.css        Dark control-center theme
```

## How it works

- `main.js` owns real `node-pty` processes, keyed by an id generated per pane.
- `preload.js` exposes `window.api.{spawn,input,resize,kill,onData,onExit}` to the renderer over a locked-down contextBridge (no `nodeIntegration`, no raw `require` in the page).
- `renderer.js` creates one `xterm.js` Terminal per pane, pipes keystrokes to the matching pty via IPC, and writes pty output back into the terminal.

## Extending it

- **Add a shell option** (e.g. WSL, Git Bash): add an `<option>` to `#shellSelect` in `index.html` with the shell's executable path.
- **Change what "+ Claude Session" runs**: edit the `autoRun: 'claude'` call in `renderer.js` (e.g. `claude --resume`, or a wrapper script that `cd`s somewhere first).
- **Default working directory per pane**: pass a `cwd` in the `window.api.spawn(...)` call in `renderer.js`.

## Next steps (not built yet, natural v2 scope)

1. **Local agent/process manager** — a side panel listing local AI agent processes (Ollama models, custom Python agent loops, etc.) with start/stop/status/log tail, separate from the terminal grid.
2. **Workspace persistence** — save the current set of open panes (shell type, cwd, title) to disk and restore on next launch, so you don't rebuild your layout every time.
3. **True split-pane resizing** — current layout is a responsive auto-grid; draggable resize handles between panes would make it feel more like a real tiling terminal.
4. **Command palette** — `Ctrl+K`-style launcher to spawn a named terminal/agent without touching the mouse.

Build these in a local Claude Code terminal (inside this same folder) once v1 is running — that gives you a real Windows environment to test pty behavior, native module quirks, and actual window rendering, none of which can be verified from a sandboxed environment.
