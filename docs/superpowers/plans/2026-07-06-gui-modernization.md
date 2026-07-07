# GUI Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Build Center's chrome into a Roblox-first control center: no native menu bar, a Modern SaaS Dashboard theme, a targetable project folder, three real skill-launch buttons (New Script / Sync to Studio / Play-Test), and a freeform widget canvas with live Git status, active-session roster, Rojo sync status, and a stubbed Roblox analytics card.

**Architecture:** Pure logic (config persistence, git-status parsing, place-file lookup, rojo-status inference) lives in small standalone modules under `lib/` (main-process-testable) and `renderer/lib/` (dual Node+browser, for renderer-only pure logic) so it's unit-testable with Node's built-in test runner. Everything that touches Electron APIs, the DOM, or child processes is wired in `main.js`/`preload.js`/`renderer/*.js` and verified manually by running the app, per the spec's own testing section — Electron UI isn't meaningfully unit-testable.

**Tech Stack:** Electron (existing), vanilla JS/HTML/CSS (existing, no bundler), GridStack.js (new, for the freeform widget canvas), Node's built-in `node:test` + `node:assert/strict` (new, zero extra dependency).

**Spec:** `docs/superpowers/specs/2026-07-06-gui-modernization-design.md`

---

## Resolved open questions from the spec

The spec flagged two open questions for planning. Resolutions:

1. **GridStack integration with no build step:** load it the same way `@xterm/xterm` already is — a `<script>` tag pointing at `../node_modules/gridstack/dist/gridstack-all.js` (UMD bundle, no bundler needed).
2. **Rojo sync status with no real status subcommand:** infer it from local app state — "synced" means a "Sync to Studio" terminal pane is currently open and hasn't exited. This is exactly what the spec itself suggested as the fallback.

---

### Task 1: Test runner + config persistence module

**Files:**
- Modify: `package.json`
- Create: `lib/config-store.js`
- Test: `test/config-store.test.js`

- [ ] **Step 1: Add the test script**

In `package.json`, add a `test` entry to `scripts`:

```json
{
  "name": "claude-build-center",
  "version": "0.1.0",
  "description": "Local control center for Claude Code terminals and local AI agents",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "rebuild": "electron-rebuild -f -w node-pty",
    "test": "node --test"
  },
  "dependencies": {
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/xterm": "^5.5.0",
    "node-pty": "^1.0.0"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.6.1",
    "electron": "^31.3.0"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `test/config-store.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { defaultConfig, loadConfig, saveConfig } = require('../lib/config-store');

test('loadConfig returns defaults when the file does not exist', () => {
  const filePath = path.join(os.tmpdir(), `config-store-test-${Date.now()}-missing.json`);
  const result = loadConfig(filePath);
  assert.deepEqual(result, defaultConfig());
});

test('saveConfig then loadConfig round-trips data', () => {
  const filePath = path.join(os.tmpdir(), `config-store-test-${Date.now()}-roundtrip.json`);
  const config = {
    projectFolder: 'C:\\Roblox\\MyGame',
    widgets: [{ type: 'git-status', x: 0, y: 0, w: 3, h: 3 }],
  };
  saveConfig(filePath, config);
  const result = loadConfig(filePath);
  assert.deepEqual(result, config);
  fs.unlinkSync(filePath);
});

test('loadConfig falls back to defaults on invalid JSON', () => {
  const filePath = path.join(os.tmpdir(), `config-store-test-${Date.now()}-invalid.json`);
  fs.writeFileSync(filePath, '{not valid json', 'utf8');
  const result = loadConfig(filePath);
  assert.deepEqual(result, defaultConfig());
  fs.unlinkSync(filePath);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/config-store'`

- [ ] **Step 4: Write the minimal implementation**

Create `lib/config-store.js`:

```js
const fs = require('fs');

function defaultConfig() {
  return { projectFolder: null, widgets: [] };
}

function loadConfig(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      projectFolder: typeof parsed.projectFolder === 'string' ? parsed.projectFolder : null,
      widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [],
    };
  } catch (err) {
    return defaultConfig();
  }
}

function saveConfig(filePath, config) {
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = { defaultConfig, loadConfig, saveConfig };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 3 tests passing

- [ ] **Step 6: Commit**

```bash
git add package.json lib/config-store.js test/config-store.test.js
git commit -m "Add config persistence module with tests"
```

---

### Task 2: Git status parser module

**Files:**
- Create: `lib/git-status.js`
- Test: `test/git-status.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/git-status.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGitStatus } = require('../lib/git-status');

test('parseGitStatus reports not a repo when branch output is empty', () => {
  const result = parseGitStatus('', '');
  assert.deepEqual(result, { isRepo: false });
});

test('parseGitStatus reports a clean repo', () => {
  const result = parseGitStatus('main\n', '');
  assert.deepEqual(result, { isRepo: true, branch: 'main', dirty: false, dirtyCount: 0 });
});

test('parseGitStatus reports a dirty repo with a file count', () => {
  const statusOutput = ' M renderer/style.css\n?? new-file.js\n';
  const result = parseGitStatus('feature/gui-modernization\n', statusOutput);
  assert.deepEqual(result, {
    isRepo: true,
    branch: 'feature/gui-modernization',
    dirty: true,
    dirtyCount: 2,
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/git-status'`

- [ ] **Step 3: Write the minimal implementation**

Create `lib/git-status.js`:

```js
function parseGitStatus(branchOutput, statusOutput) {
  const branch = (branchOutput || '').trim();
  if (!branch) {
    return { isRepo: false };
  }
  const lines = (statusOutput || '').split('\n').filter((line) => line.trim().length > 0);
  return {
    isRepo: true,
    branch,
    dirty: lines.length > 0,
    dirtyCount: lines.length,
  };
}

module.exports = { parseGitStatus };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 6 tests passing (3 from Task 1 + 3 here)

- [ ] **Step 5: Commit**

```bash
git add lib/git-status.js test/git-status.test.js
git commit -m "Add git status parser module with tests"
```

---

### Task 3: Place-file lookup module

**Files:**
- Create: `lib/find-place-file.js`
- Test: `test/find-place-file.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/find-place-file.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { findPlaceFile } = require('../lib/find-place-file');

test('findPlaceFile returns null when no place file is present', () => {
  assert.equal(findPlaceFile(['README.md', 'default.project.json']), null);
});

test('findPlaceFile finds an .rbxlx file', () => {
  assert.equal(findPlaceFile(['default.project.json', 'MyGame.rbxlx']), 'MyGame.rbxlx');
});

test('findPlaceFile finds an .rbxl file', () => {
  assert.equal(findPlaceFile(['MyGame.rbxl', 'README.md']), 'MyGame.rbxl');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/find-place-file'`

- [ ] **Step 3: Write the minimal implementation**

Create `lib/find-place-file.js`:

```js
function findPlaceFile(fileNames) {
  const match = (fileNames || []).find(
    (name) => name.endsWith('.rbxlx') || name.endsWith('.rbxl')
  );
  return match || null;
}

module.exports = { findPlaceFile };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 9 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/find-place-file.js test/find-place-file.test.js
git commit -m "Add place-file lookup module with tests"
```

---

### Task 4: Rojo sync status module

**Files:**
- Create: `renderer/lib/rojo-status.js`
- Test: `test/rojo-status.test.js`

This module is loaded two ways: via `require` in this test (Node), and via a `<script>` tag in the renderer (browser, no `require`). It detects its environment and exports accordingly.

- [ ] **Step 1: Write the failing test**

Create `test/rojo-status.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeRojoStatus } = require('../renderer/lib/rojo-status');

test('computeRojoStatus is disconnected with no sessions', () => {
  assert.deepEqual(computeRojoStatus([]), { connected: false });
});

test('computeRojoStatus is disconnected when the sync session has exited', () => {
  const sessions = [{ kind: 'sync-to-studio', exited: true }];
  assert.deepEqual(computeRojoStatus(sessions), { connected: false });
});

test('computeRojoStatus is connected when a sync-to-studio session is running', () => {
  const sessions = [
    { kind: 'terminal', exited: false },
    { kind: 'sync-to-studio', exited: false },
  ];
  assert.deepEqual(computeRojoStatus(sessions), { connected: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../renderer/lib/rojo-status'`

- [ ] **Step 3: Write the minimal implementation**

Create `renderer/lib/rojo-status.js`:

```js
function computeRojoStatus(sessions) {
  const syncing = (sessions || []).some(
    (s) => s.kind === 'sync-to-studio' && !s.exited
  );
  return { connected: syncing };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeRojoStatus };
} else {
  window.BuildCenter = window.BuildCenter || {};
  window.BuildCenter.computeRojoStatus = computeRojoStatus;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 12 tests passing

- [ ] **Step 5: Commit**

```bash
git add renderer/lib/rojo-status.js test/rojo-status.test.js
git commit -m "Add Rojo sync status module with tests"
```

---

### Task 5: Remove the native menu bar

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Update the import and startup sequence**

In `main.js`, change:

```js
const { app, BrowserWindow, ipcMain } = require('electron');
```

to:

```js
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
```

Then change:

```js
app.whenReady().then(createWindow);
```

to:

```js
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});
```

- [ ] **Step 2: Manual verification**

Run: `npm start`
Expected: The window opens with no File/Edit/View/Window/Help menu bar at the top of the window (or the OS window chrome, depending on platform). The existing "BUILD CENTER" toolbar is unaffected.

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "Remove native Electron menu bar"
```

---

### Task 6: Config load/save IPC

**Files:**
- Modify: `main.js`
- Modify: `preload.js`

- [ ] **Step 1: Wire up main.js**

In `main.js`, add near the top with the other requires:

```js
const { loadConfig, saveConfig } = require('./lib/config-store');
```

Add after `let mainWindow;`:

```js
const configPath = path.join(app.getPath('userData'), 'config.json');
```

Add after the existing `ipcMain.on('pty:kill', ...)` block, before the end of the file:

```js
ipcMain.handle('config:load', () => {
  return loadConfig(configPath);
});

ipcMain.handle('config:save', (event, config) => {
  saveConfig(configPath, config);
  return { ok: true };
});
```

- [ ] **Step 2: Expose it in preload.js**

In `preload.js`, add to the object passed to `contextBridge.exposeInMainWorld`:

```js
contextBridge.exposeInMainWorld('api', {
  spawn: (id, opts) => ipcRenderer.invoke('pty:spawn', { id, ...opts }),
  input: (id, data) => ipcRenderer.send('pty:input', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.send('pty:resize', { id, cols, rows }),
  kill: (id) => ipcRenderer.send('pty:kill', { id }),
  onData: (cb) => ipcRenderer.on('pty:data', (_event, payload) => cb(payload)),
  onExit: (cb) => ipcRenderer.on('pty:exit', (_event, payload) => cb(payload)),
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (config) => ipcRenderer.invoke('config:save', config),
  },
});
```

- [ ] **Step 3: Manual verification**

Run: `npm start`. Open DevTools (Ctrl+Shift+I) and in the console run:

```js
await window.api.config.load()
```

Expected: `{ projectFolder: null, widgets: [] }`

Then run:

```js
await window.api.config.save({ projectFolder: 'C:\\test', widgets: [] })
await window.api.config.load()
```

Expected: second call returns `{ projectFolder: 'C:\\test', widgets: [] }`. Close and restart the app, run `await window.api.config.load()` again — same result, confirming it persisted to disk.

- [ ] **Step 4: Commit**

```bash
git add main.js preload.js
git commit -m "Add config load/save IPC handlers"
```

---

### Task 7: Project folder picker

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `renderer/index.html`
- Modify: `renderer/renderer.js`
- Create: `renderer/state.js`

- [ ] **Step 1: Add the dialog IPC handler in main.js**

Change the import line to include `dialog`:

```js
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
```

Add alongside the config IPC handlers:

```js
ipcMain.handle('project:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  return { canceled: false, folder: result.filePaths[0] };
});
```

- [ ] **Step 2: Expose it in preload.js**

Add to the exposed `api` object:

```js
project: {
  selectFolder: () => ipcRenderer.invoke('project:selectFolder'),
},
```

- [ ] **Step 3: Create the shared renderer state module**

Create `renderer/state.js`:

```js
window.BuildCenter = (function () {
  const listeners = { sessionsChanged: [], projectFolderChanged: [] };
  let sessions = [];
  let projectFolder = null;

  function emit(event, payload) {
    listeners[event].forEach((cb) => cb(payload));
  }

  return {
    getSessions() {
      return sessions.slice();
    },
    setSessions(next) {
      sessions = next;
      emit('sessionsChanged', sessions);
    },
    onSessionsChanged(cb) {
      listeners.sessionsChanged.push(cb);
    },
    getProjectFolder() {
      return projectFolder;
    },
    setProjectFolder(folder) {
      projectFolder = folder;
      emit('projectFolderChanged', projectFolder);
    },
    onProjectFolderChanged(cb) {
      listeners.projectFolderChanged.push(cb);
    },
  };
})();
```

- [ ] **Step 4: Add the toolbar control in index.html**

In `renderer/index.html`, change:

```html
  <div id="toolbar">
    <div id="brand">BUILD CENTER</div>
    <select id="shellSelect" title="Shell for new terminals">
      <option value="powershell.exe">PowerShell</option>
      <option value="cmd.exe">cmd</option>
    </select>
    <button id="btnNewTerminal">+ Terminal</button>
    <button id="btnNewClaude">+ Claude Session</button>
  </div>
```

to:

```html
  <div id="toolbar">
    <div id="brand">BUILD CENTER</div>
    <button id="btnProjectFolder" title="Set the Roblox project folder">Set Project Folder</button>
    <span id="projectFolderLabel">No project set</span>
    <select id="shellSelect" title="Shell for new terminals">
      <option value="powershell.exe">PowerShell</option>
      <option value="cmd.exe">cmd</option>
    </select>
    <button id="btnNewTerminal">+ Terminal</button>
    <button id="btnNewScript">New Script</button>
  </div>
```

Also change the script tags at the bottom of `renderer/index.html` from:

```html
  <script src="../node_modules/@xterm/xterm/lib/xterm.js"></script>
  <script src="../node_modules/@xterm/addon-fit/lib/addon-fit.js"></script>
  <script src="renderer.js"></script>
```

to:

```html
  <script src="../node_modules/@xterm/xterm/lib/xterm.js"></script>
  <script src="../node_modules/@xterm/addon-fit/lib/addon-fit.js"></script>
  <script src="state.js"></script>
  <script src="renderer.js"></script>
```

(The `+ Claude Session` button is being renamed to `New Script` here — its behavior is rewired in Task 9. Leaving the id as `btnNewClaude` in the DOM would be confusing, so it's already renamed to `btnNewScript` above; Task 9 adds its click handler.)

- [ ] **Step 5: Wire the button in renderer.js**

In `renderer/renderer.js`, add near the top (after the existing `const` declarations for `shellSelect`, etc.):

```js
const btnProjectFolder = document.getElementById('btnProjectFolder');
const projectFolderLabel = document.getElementById('projectFolderLabel');

function updateProjectFolderUI(folder) {
  projectFolderLabel.textContent = folder || 'No project set';
}

window.BuildCenter.onProjectFolderChanged(updateProjectFolderUI);
updateProjectFolderUI(window.BuildCenter.getProjectFolder());

btnProjectFolder.addEventListener('click', async () => {
  const result = await window.api.project.selectFolder();
  if (result.canceled) return;
  window.BuildCenter.setProjectFolder(result.folder);
});
```

Remove the old `btnNewClaude` reference and its click handler for now — they're replaced in Task 9:

```js
const btnNewClaude = document.getElementById('btnNewClaude');
...
btnNewClaude.addEventListener('click', () => {
  createPane({ title: 'Claude Code', autoRun: 'claude' });
});
```

(Delete both the declaration line and the listener block. Task 9 reintroduces equivalent behavior under the `btnNewScript` id.)

- [ ] **Step 6: Manual verification**

Run: `npm start`. Click "Set Project Folder", pick any folder. Expected: the label next to the button updates to show the folder path. Open DevTools console and run `window.BuildCenter.getProjectFolder()` — expected: the folder path you picked.

- [ ] **Step 7: Commit**

```bash
git add main.js preload.js renderer/index.html renderer/renderer.js renderer/state.js
git commit -m "Add project folder picker"
```

---

### Task 8: Git status IPC handler

**Files:**
- Modify: `main.js`
- Modify: `preload.js`

- [ ] **Step 1: Add the handler in main.js**

Add to the imports:

```js
const { execFile } = require('child_process');
const { parseGitStatus } = require('./lib/git-status');
```

Add alongside the other IPC handlers:

```js
ipcMain.handle('git:status', (event, folder) => {
  return new Promise((resolve) => {
    execFile('git', ['branch', '--show-current'], { cwd: folder }, (branchErr, branchOut) => {
      if (branchErr) {
        resolve({ isRepo: false });
        return;
      }
      execFile('git', ['status', '--short'], { cwd: folder }, (statusErr, statusOut) => {
        resolve(parseGitStatus(branchOut, statusErr ? '' : statusOut));
      });
    });
  });
});
```

- [ ] **Step 2: Expose it in preload.js**

Add to the exposed `api` object:

```js
git: {
  status: (folder) => ipcRenderer.invoke('git:status', folder),
},
```

- [ ] **Step 3: Manual verification**

Run: `npm start`. In DevTools console:

```js
await window.api.git.status('C:\\Users\\lucas\\Projects\\claude-build-center')
```

Expected: `{ isRepo: true, branch: 'feature/gui-modernization', dirty: <true or false>, dirtyCount: <number> }` reflecting the actual state of this repo at the time you run it.

```js
await window.api.git.status('C:\\Users\\lucas')
```

Expected: `{ isRepo: false }` (not a git repo).

- [ ] **Step 4: Commit**

```bash
git add main.js preload.js
git commit -m "Add git status IPC handler"
```

---

### Task 9: New Script button and session state tracking

**Files:**
- Modify: `renderer/renderer.js`

This task rewires session bookkeeping so every pane tracks a `title`, `kind`, and `exited` flag, and publishes that list to `window.BuildCenter` whenever it changes — the Active Sessions and Rojo Sync Status widgets (Task 12) depend on this.

- [ ] **Step 1: Update `createPane` to accept and store `kind`/`cwd`, and publish session state**

Replace the whole `createPane` function in `renderer/renderer.js` with:

```js
function createPane({ title, autoRun, kind, cwd }) {
  const id = makeId();
  const paneEl = document.createElement('div');
  paneEl.className = 'pane';
  paneEl.innerHTML = `
    <div class="pane-header">
      <span class="title">${title}</span>
      <span class="status"></span>
      <div class="pane-actions">
        <button class="btn-max" title="Maximize / restore">⤢</button>
        <button class="btn-close" title="Close">×</button>
      </div>
    </div>
    <div class="pane-body"></div>
  `;
  panesEl.appendChild(paneEl);

  const term = new Terminal({
    fontSize: 13,
    fontFamily: 'Cascadia Code, Consolas, monospace',
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
    },
    cursorBlink: true,
    scrollback: 5000,
  });
  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(paneEl.querySelector('.pane-body'));
  fitAddon.fit();

  term.onData((data) => window.api.input(id, data));

  sessions.set(id, { term, fitAddon, paneEl, title, kind: kind || 'terminal', exited: false });
  publishSessions();

  window.api.spawn(id, {
    shell: shellSelect.value,
    cols: term.cols,
    rows: term.rows,
    autoRun,
    cwd,
  }).then((res) => {
    if (res && res.ok === false) {
      term.write(`\r\n[failed to start shell: ${res.error}]\r\n`);
      paneEl.classList.add('exited');
      sessions.get(id).exited = true;
      publishSessions();
    }
  });

  const resizeObserver = new ResizeObserver(() => {
    try {
      fitAddon.fit();
      window.api.resize(id, term.cols, term.rows);
    } catch (e) {
      // ignore transient resize races
    }
  });
  resizeObserver.observe(paneEl.querySelector('.pane-body'));

  paneEl.querySelector('.btn-close').addEventListener('click', () => {
    window.api.kill(id);
    resizeObserver.disconnect();
    term.dispose();
    sessions.delete(id);
    publishSessions();
    paneEl.remove();
  });

  paneEl.querySelector('.btn-max').addEventListener('click', () => {
    document.querySelectorAll('.pane.maximized').forEach((el) => {
      if (el !== paneEl) el.classList.remove('maximized');
    });
    paneEl.classList.toggle('maximized');
    setTimeout(() => fitAddon.fit(), 60);
  });

  paneEl.addEventListener('click', () => term.focus());

  term.focus();
}

function publishSessions() {
  window.BuildCenter.setSessions(
    Array.from(sessions.entries()).map(([id, s]) => ({
      id,
      title: s.title,
      kind: s.kind,
      exited: s.exited,
    }))
  );
}
```

- [ ] **Step 2: Update the exit handler to track `exited` and publish**

Replace the existing `window.api.onExit` block:

```js
window.api.onExit(({ id }) => {
  const s = sessions.get(id);
  if (s) {
    const statusEl = s.paneEl.querySelector('.status');
    statusEl.textContent = 'exited';
    s.paneEl.classList.add('exited');
    s.exited = true;
    publishSessions();
  }
});
```

- [ ] **Step 3: Add the New Script button handler**

Add near the other button handlers (replacing the deleted `btnNewClaude` block from Task 9's Step 1):

```js
const btnNewScript = document.getElementById('btnNewScript');

btnNewScript.addEventListener('click', () => {
  createPane({ title: 'New Script', autoRun: 'claude' });
});
```

- [ ] **Step 4: Manual verification**

Run: `npm start`. Click "New Script" — expected: a new pane opens titled "New Script" and auto-types `claude`, same as the old "+ Claude Session" button did. In DevTools console, run `window.BuildCenter.getSessions()` — expected: an array including an entry with `title: 'New Script'`, `kind: 'terminal'`, `exited: false`. Close that pane — run the same call again, expected: the entry is gone from the array.

- [ ] **Step 5: Commit**

```bash
git add renderer/renderer.js
git commit -m "Rename Claude Session button to New Script, track session state"
```

---

### Task 10: Sync to Studio and Play/Test buttons

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `renderer/index.html`
- Modify: `renderer/renderer.js`

- [ ] **Step 1: Add the roblox:playTest IPC handler in main.js**

Add to the imports:

```js
const fs = require('fs');
const { findPlaceFile } = require('./lib/find-place-file');
```

Change the electron import line to include `shell`:

```js
const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
```

Add alongside the other IPC handlers:

```js
ipcMain.handle('roblox:playTest', (event, folder) => {
  let files;
  try {
    files = fs.readdirSync(folder);
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  const placeFile = findPlaceFile(files);
  if (!placeFile) {
    return { ok: false, error: 'No .rbxl or .rbxlx file found in project folder' };
  }
  shell.openPath(path.join(folder, placeFile));
  return { ok: true };
});
```

- [ ] **Step 2: Expose it in preload.js**

Add to the exposed `api` object:

```js
roblox: {
  playTest: (folder) => ipcRenderer.invoke('roblox:playTest', folder),
},
```

- [ ] **Step 3: Add the buttons in index.html**

Change:

```html
    <button id="btnNewTerminal">+ Terminal</button>
    <button id="btnNewScript">New Script</button>
  </div>
```

to:

```html
    <button id="btnNewTerminal">+ Terminal</button>
    <button id="btnNewScript">New Script</button>
    <button id="btnSyncStudio" disabled title="Set a project folder first">Sync to Studio</button>
    <button id="btnPlayTest" disabled title="Set a project folder first">Play / Test</button>
  </div>
```

- [ ] **Step 4: Wire the buttons in renderer.js**

Replace the `updateProjectFolderUI` function added in Task 7 with a version that also toggles these two buttons:

```js
const btnSyncStudio = document.getElementById('btnSyncStudio');
const btnPlayTest = document.getElementById('btnPlayTest');

function updateProjectFolderUI(folder) {
  projectFolderLabel.textContent = folder || 'No project set';
  btnSyncStudio.disabled = !folder;
  btnSyncStudio.title = folder ? '' : 'Set a project folder first';
  btnPlayTest.disabled = !folder;
  btnPlayTest.title = folder ? '' : 'Set a project folder first';
}
```

Add the button handlers:

```js
btnSyncStudio.addEventListener('click', () => {
  const folder = window.BuildCenter.getProjectFolder();
  createPane({ title: 'Sync to Studio', kind: 'sync-to-studio', autoRun: 'rojo serve', cwd: folder });
});

btnPlayTest.addEventListener('click', async () => {
  const folder = window.BuildCenter.getProjectFolder();
  const result = await window.api.roblox.playTest(folder);
  if (!result.ok) {
    alert('Play/Test failed: ' + result.error);
  }
});
```

- [ ] **Step 5: Manual verification**

Run: `npm start`. Before setting a project folder, confirm "Sync to Studio" and "Play/Test" are disabled (greyed out, tooltip explains why). Set a project folder to any directory containing a `.rbxlx` or `.rbxl` file (create an empty one for testing if needed, e.g. `type nul > test.rbxlx` on Windows). Click "Play/Test" — expected: the OS opens that file with its default handler (Roblox Studio if installed, otherwise whatever the OS has associated with that extension — either way, `shell.openPath` was invoked without error). Click "Sync to Studio" — expected: a new pane opens titled "Sync to Studio" and runs `rojo serve` (if `rojo` isn't installed, expected: the pane shows a shell error for the unrecognized command, not a silent failure).

- [ ] **Step 6: Commit**

```bash
git add main.js preload.js renderer/index.html renderer/renderer.js
git commit -m "Add Sync to Studio and Play/Test buttons"
```

---

### Task 11: GridStack dependency and widget canvas skeleton

**Files:**
- Modify: `package.json`
- Modify: `renderer/index.html`
- Modify: `renderer/style.css`
- Create: `renderer/widgets.js`

- [ ] **Step 1: Add the dependency**

Run: `npm install gridstack`
Expected: `gridstack` added to `dependencies` in `package.json`, installed into `node_modules/gridstack`.

- [ ] **Step 2: Add the canvas container and script tags in index.html**

Change:

```html
  <div id="panes"></div>
```

to:

```html
  <div id="workspace">
    <div id="panes"></div>
    <div id="widgetCanvas" class="grid-stack"></div>
  </div>
  <div id="widgetPicker" class="widget-picker hidden"></div>
```

Add the `+ Widget` button to the toolbar, after `btnPlayTest`:

```html
    <button id="btnPlayTest" disabled title="Set a project folder first">Play / Test</button>
    <button id="btnAddWidget">+ Widget</button>
  </div>
```

Add the CSS link and script tags. Change:

```html
  <link rel="stylesheet" href="../node_modules/@xterm/xterm/css/xterm.css" />
  <link rel="stylesheet" href="style.css" />
```

to:

```html
  <link rel="stylesheet" href="../node_modules/@xterm/xterm/css/xterm.css" />
  <link rel="stylesheet" href="../node_modules/gridstack/dist/gridstack.min.css" />
  <link rel="stylesheet" href="style.css" />
```

Change:

```html
  <script src="../node_modules/@xterm/xterm/lib/xterm.js"></script>
  <script src="../node_modules/@xterm/addon-fit/lib/addon-fit.js"></script>
  <script src="state.js"></script>
  <script src="renderer.js"></script>
```

to:

```html
  <script src="../node_modules/@xterm/xterm/lib/xterm.js"></script>
  <script src="../node_modules/@xterm/addon-fit/lib/addon-fit.js"></script>
  <script src="../node_modules/gridstack/dist/gridstack-all.js"></script>
  <script src="state.js"></script>
  <script src="lib/rojo-status.js"></script>
  <script src="widgets.js"></script>
  <script src="renderer.js"></script>
```

- [ ] **Step 3: Position the canvas as an overlay in style.css**

`#panes` currently fills the workspace directly. Change:

```css
#panes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
  grid-auto-rows: 420px;
  gap: 8px;
  padding: 8px;
  height: calc(100vh - 46px);
  overflow: auto;
  align-content: start;
}
```

to:

```css
#workspace {
  position: relative;
  height: calc(100vh - 46px);
}

#panes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
  grid-auto-rows: 420px;
  gap: 8px;
  padding: 8px;
  height: 100%;
  overflow: auto;
  align-content: start;
}

#widgetCanvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

#widgetCanvas .grid-stack-item {
  pointer-events: auto;
}

.widget-picker {
  position: absolute;
  top: 46px;
  right: 8px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
}

.widget-picker.hidden {
  display: none;
}

.widget-picker-option {
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.widget-picker-option:hover {
  border-color: #58a6ff;
}

.widget-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 8px;
  overflow: hidden;
}

.widget-header {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  background: #161b22;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid #21262d;
}

.widget-close {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #8b949e;
  cursor: pointer;
  font-size: 14px;
}

.widget-close:hover {
  color: #c9d1d9;
}

.widget-body {
  flex: 1;
  padding: 8px 10px;
  font-size: 12px;
  overflow: auto;
}

.widget-empty {
  color: #8b949e;
  font-style: italic;
}
```

- [ ] **Step 4: Create the widget system skeleton**

Create `renderer/widgets.js`:

```js
let grid;

const WIDGET_CATALOG = [];

function addWidgetToGrid(type, position) {
  const catalogEntry = WIDGET_CATALOG.find((w) => w.type === type);
  if (!catalogEntry) return null;
  const widgetId = 'widget-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const contentHtml = `
    <div class="widget-card" data-widget-id="${widgetId}" data-widget-type="${type}">
      <div class="widget-header">
        <span class="widget-title">${catalogEntry.title}</span>
        <button class="widget-close" title="Remove widget">×</button>
      </div>
      <div class="widget-body"></div>
    </div>
  `;
  const el = grid.addWidget({
    w: position && position.w ? position.w : 3,
    h: position && position.h ? position.h : 3,
    x: position ? position.x : undefined,
    y: position ? position.y : undefined,
    id: widgetId,
    content: contentHtml,
  });
  const bodyEl = el.querySelector('.widget-body');
  catalogEntry.render(bodyEl);
  el.querySelector('.widget-close').addEventListener('click', () => {
    grid.removeWidget(el);
    persistConfig();
  });
  return widgetId;
}

function persistConfig() {
  const items = grid
    ? grid.getGridItems().map((el) => {
        const node = el.gridstackNode;
        return {
          type: el.querySelector('.widget-card').dataset.widgetType,
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h,
        };
      })
    : [];
  window.api.config.save({ projectFolder: window.BuildCenter.getProjectFolder(), widgets: items });
}

function toggleWidgetPicker() {
  document.getElementById('widgetPicker').classList.toggle('hidden');
}

function buildWidgetPicker() {
  const picker = document.getElementById('widgetPicker');
  picker.innerHTML = WIDGET_CATALOG.map(
    (w) => `<button class="widget-picker-option" data-type="${w.type}">${w.title}</button>`
  ).join('');
  picker.querySelectorAll('.widget-picker-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      addWidgetToGrid(btn.dataset.type);
      persistConfig();
      picker.classList.add('hidden');
    });
  });
}

async function initWidgets() {
  const config = await window.api.config.load();
  window.BuildCenter.setProjectFolder(config.projectFolder);
  grid = GridStack.init({ float: true, cellHeight: 80, column: 12 }, '#widgetCanvas');
  config.widgets.forEach((w) => addWidgetToGrid(w.type, w));
  grid.on('change', persistConfig);
  buildWidgetPicker();
  document.getElementById('btnAddWidget').addEventListener('click', toggleWidgetPicker);
  window.BuildCenter.persistConfig = persistConfig;
}

initWidgets();
```

`WIDGET_CATALOG` is intentionally empty for now — Task 12 populates it. This task just proves the canvas, drag/resize, add/remove, and persistence plumbing work end-to-end before any real widget content exists.

- [ ] **Step 5: Manual verification**

Run: `npm start`. Expected: no console errors on load (an empty `WIDGET_CATALOG` means the "+ Widget" picker shows no options yet — that's expected here). In DevTools console, temporarily test the plumbing directly:

```js
WIDGET_CATALOG.push({ type: 'test', title: 'Test Widget', render: (el) => { el.textContent = 'hello'; } });
addWidgetToGrid('test');
```

Expected: a draggable, resizable card labeled "Test Widget" containing "hello" appears over the terminal pane area, and dragging it around doesn't block clicks on the terminal panes underneath when you're not directly over the widget.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json renderer/index.html renderer/style.css renderer/widgets.js
git commit -m "Add GridStack widget canvas skeleton"
```

---

### Task 12: Widget catalog — Active Sessions, Git Status, Rojo Sync Status, Roblox Analytics

**Files:**
- Modify: `renderer/widgets.js`

- [ ] **Step 1: Populate the catalog with real render functions**

In `renderer/widgets.js`, replace:

```js
const WIDGET_CATALOG = [];
```

with:

```js
function renderActiveSessions(container) {
  function draw(sessions) {
    if (!sessions || sessions.length === 0) {
      container.innerHTML = '<p class="widget-empty">No sessions open</p>';
      return;
    }
    container.innerHTML =
      '<ul class="session-list">' +
      sessions
        .map((s) => `<li class="${s.exited ? 'exited' : ''}">${s.title} <span class="kind">${s.kind}</span></li>`)
        .join('') +
      '</ul>';
  }
  draw(window.BuildCenter.getSessions());
  window.BuildCenter.onSessionsChanged(draw);
}

function renderGitStatus(container) {
  async function draw() {
    const folder = window.BuildCenter.getProjectFolder();
    if (!folder) {
      container.innerHTML = '<p class="widget-empty">Not configured — set a project folder</p>';
      return;
    }
    const status = await window.api.git.status(folder);
    if (!status.isRepo) {
      container.innerHTML = '<p class="widget-empty">Not a git repository</p>';
      return;
    }
    container.innerHTML = `
      <p class="git-branch">${status.branch}</p>
      <p class="git-dirty">${status.dirty ? status.dirtyCount + ' uncommitted change(s)' : 'clean'}</p>
    `;
  }
  draw();
  window.BuildCenter.onProjectFolderChanged(draw);
  setInterval(draw, 5000);
}

function renderRojoStatus(container) {
  function draw() {
    const folder = window.BuildCenter.getProjectFolder();
    if (!folder) {
      container.innerHTML = '<p class="widget-empty">Not configured — set a project folder</p>';
      return;
    }
    const status = window.BuildCenter.computeRojoStatus(window.BuildCenter.getSessions());
    container.innerHTML = `<p class="rojo-state ${status.connected ? 'connected' : 'disconnected'}">${
      status.connected ? 'Synced' : 'Not syncing'
    }</p>`;
  }
  draw();
  window.BuildCenter.onSessionsChanged(draw);
  window.BuildCenter.onProjectFolderChanged(draw);
}

function renderRobloxAnalytics(container) {
  container.innerHTML = '<p class="widget-empty">Coming soon — requires a Roblox Open Cloud API key.</p>';
}

const WIDGET_CATALOG = [
  { type: 'active-sessions', title: 'Active Sessions', render: renderActiveSessions },
  { type: 'git-status', title: 'Git Status', render: renderGitStatus },
  { type: 'rojo-sync-status', title: 'Rojo Sync Status', render: renderRojoStatus },
  { type: 'roblox-analytics', title: 'Roblox Analytics', render: renderRobloxAnalytics },
];
```

- [ ] **Step 2: Add supporting styles**

Add to `renderer/style.css`:

```css
.session-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.session-list li {
  padding: 4px 0;
  border-bottom: 1px solid #21262d;
}

.session-list li.exited {
  color: #f85149;
}

.session-list .kind {
  color: #8b949e;
  font-size: 10px;
  margin-left: 6px;
}

.git-branch {
  font-weight: 600;
  margin: 0 0 4px;
}

.git-dirty {
  color: #8b949e;
  margin: 0;
}

.rojo-state.connected {
  color: #3fb950;
}

.rojo-state.disconnected {
  color: #8b949e;
}
```

- [ ] **Step 3: Manual verification**

Run: `npm start`. Click "+ Widget" — expected: a picker with four options (Active Sessions, Git Status, Rojo Sync Status, Roblox Analytics). Add each one:
- **Active Sessions**: shows the currently open panes (at least the default "Terminal" pane) with their kind; open/close a pane and confirm the list updates live.
- **Git Status**: shows "Not configured" until you set a project folder; set it to this repo's path and confirm it shows the current branch and dirty state within 5 seconds.
- **Rojo Sync Status**: shows "Not configured" until a project folder is set; once set, shows "Not syncing"; click "Sync to Studio" and confirm it flips to "Synced"; close that pane and confirm it flips back.
- **Roblox Analytics**: shows the "Coming soon" stub immediately, no loading state.

Drag and resize each widget — confirm they move/resize independently and can overlap the terminal pane area.

- [ ] **Step 4: Commit**

```bash
git add renderer/widgets.js renderer/style.css
git commit -m "Add widget catalog: Active Sessions, Git Status, Rojo Sync Status, Roblox Analytics"
```

---

### Task 13: Widget layout and project folder persist across restarts

**Files:**
- Modify: `renderer/renderer.js`

Task 6/11 already wired `config:save`/`config:load` and `persistConfig()` (called on every grid change and widget add/remove). The one gap: setting the project folder via the button (Task 7) updates in-memory state but doesn't call `persistConfig()`, so it's lost on restart.

- [ ] **Step 1: Persist on project folder change**

In `renderer/renderer.js`, change the `btnProjectFolder` click handler from:

```js
btnProjectFolder.addEventListener('click', async () => {
  const result = await window.api.project.selectFolder();
  if (result.canceled) return;
  window.BuildCenter.setProjectFolder(result.folder);
});
```

to:

```js
btnProjectFolder.addEventListener('click', async () => {
  const result = await window.api.project.selectFolder();
  if (result.canceled) return;
  window.BuildCenter.setProjectFolder(result.folder);
  if (window.BuildCenter.persistConfig) window.BuildCenter.persistConfig();
});
```

- [ ] **Step 2: Manual verification**

Run: `npm start`. Set a project folder, add two widgets, drag one to a new position and resize the other. Fully quit the app (not just close the window — quit it) and run `npm start` again. Expected: the project folder label shows the same folder, and both widgets reappear in their last positions/sizes.

- [ ] **Step 3: Commit**

```bash
git add renderer/renderer.js
git commit -m "Persist project folder selection across restarts"
```

---

### Task 14: Visual theme pass — Modern SaaS Dashboard polish

**Files:**
- Modify: `renderer/style.css`

- [ ] **Step 1: Tighten the toolbar and add depth to panels**

In `renderer/style.css`, change the `#toolbar` rule from:

```css
#toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #0d1117;
  border-bottom: 1px solid #21262d;
  -webkit-app-region: drag;
}
```

to:

```css
#toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #0d1117;
  border-bottom: 1px solid #21262d;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
  -webkit-app-region: drag;
}

#projectFolderLabel {
  font-size: 11px;
  color: #8b949e;
  margin-right: 8px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Change the `.pane` rule from:

```css
.pane {
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 8px;
  overflow: hidden;
}
```

to:

```css
.pane {
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}
```

Add a matching shadow to `.widget-card` (defined in Task 11):

```css
.widget-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}
```

(This replaces the `.widget-card` block from Task 11 rather than adding a duplicate rule.)

- [ ] **Step 2: Style disabled buttons consistently**

Add:

```css
#toolbar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

#toolbar button:disabled:hover {
  background: #161b22;
  border-color: #30363d;
}
```

- [ ] **Step 3: Manual verification**

Run: `npm start`. Visually confirm: toolbar has a subtle shadow separating it from the workspace, terminal panes and widget cards have a soft drop shadow giving them depth against the background, and the disabled "Sync to Studio"/"Play/Test" buttons (before a project folder is set) look visibly greyed-out rather than just non-functional.

- [ ] **Step 4: Commit**

```bash
git add renderer/style.css
git commit -m "Polish visual theme: shadows, disabled states, toolbar spacing"
```

---

### Task 15: Update README and push

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Update the top of `README.md` — change:

```markdown
# Build Center (v1)

Local Electron app: a control-center window that opens real terminal panes (PowerShell/cmd) in a grid, so you can run multiple Claude Code sessions side by side. Each pane is a real pty-backed shell via `node-pty` + `xterm.js` — full interactivity, colors, prompts, everything.

Currently being reworked into a Roblox-first "vibe coding" control center — see `docs/superpowers/specs/` for design docs as they land.

## Recent Changes

- **2026-07-06** — Initial commit: Electron control center with terminal pane grid (v1 scaffold).
```

to:

```markdown
# Build Center

A Roblox-first "vibe coding" control center built on Electron: real terminal panes (PowerShell/cmd) for running Claude Code sessions, plus a live widget dashboard and quick-launch buttons for Roblox dev workflows (Rojo sync, Play/Test in Studio).

See `docs/superpowers/specs/` for design docs and `docs/superpowers/plans/` for implementation plans as they land.

## What it does

- **Set Project Folder** — point Build Center at a Roblox project directory. Widgets and the Sync/Play buttons operate on this folder.
- **New Script** / **+ Terminal** — open a Claude Code session or plain shell pane.
- **Sync to Studio** — runs `rojo serve` against the project folder in a pane.
- **Play / Test** — opens the project's `.rbxl`/`.rbxlx` file with its default handler (Roblox Studio).
- **Widget canvas** — drag/resize/add/remove widgets showing live Git status, active sessions, and Rojo sync state. Layout persists across restarts.

## Recent Changes

- **2026-07-06** — GUI Modernization: removed the native menu bar, added the Modern SaaS Dashboard theme, project folder targeting, Roblox skill-launch buttons, and a freeform widget canvas (Git Status, Active Sessions, Rojo Sync Status, stubbed Roblox Analytics).
- **2026-07-06** — Initial commit: Electron control center with terminal pane grid (v1 scaffold).
```

- [ ] **Step 2: Commit and push**

```bash
git add README.md
git commit -m "Update README for GUI Modernization"
git push -u origin feature/gui-modernization
```

- [ ] **Step 3: Open a pull request**

```bash
gh pr create --title "GUI Modernization: Roblox-first control center" --body "$(cat <<'EOF'
## Summary
- Removes the native Electron menu bar
- Modern SaaS Dashboard theme pass
- Project folder targeting with a folder picker
- New Script / Sync to Studio / Play-Test skill-launch buttons
- Freeform widget canvas (GridStack.js): Git Status, Active Sessions, Rojo Sync Status, stubbed Roblox Analytics
- Config (project folder + widget layout) persists across restarts

## Test plan
- [ ] `npm test` passes (12 unit tests across config-store, git-status, find-place-file, rojo-status)
- [ ] `npm start` — confirm no native menu bar
- [ ] Set a project folder, confirm Sync to Studio / Play-Test enable
- [ ] Add all four widget types, confirm each shows correct live/stub data
- [ ] Restart the app, confirm project folder and widget layout persisted

🤖 Generated with Claude Code
EOF
)"
```

Report the PR URL back to the user rather than merging automatically — merging to `main` is their call.

---

## Self-review notes

- **Spec coverage:** menu bar removal (Task 5), theme (Task 14), project folder targeting (Task 7), all three skill buttons (Tasks 9–10), widget system with all four v1 widgets and persistence (Tasks 11–13), error handling for "not configured" and missing commands (built into Tasks 8, 10, 12) — all spec sections have a corresponding task.
- **Deferred by spec, not by this plan:** Roblox Open Cloud analytics (stub only, Task 12), Luau skill content for "New Script" (Task 9 just opens a plain Claude session, per spec non-goals), auto-updater (separate spec entirely).
- **Type/naming consistency check:** `kind`/`exited`/`title` session fields are introduced in Task 9 and consumed identically in Task 12's `renderActiveSessions`/`renderRojoStatus`; `computeRojoStatus` signature (`sessions` array with `{kind, exited}`) matches between Task 4's test and Task 12's usage; `persistConfig`/`addWidgetToGrid` names are consistent from their introduction in Task 11 through use in Tasks 12–13; IPC channel names (`config:load`, `config:save`, `project:selectFolder`, `git:status`, `roblox:playTest`) match between each task's `main.js` handler and `preload.js` exposure.
