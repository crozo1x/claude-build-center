# Rojo Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake "Rojo Sync Status" (which just checks if a terminal pane is alive) with real Rojo detection — CLI install check, `rojo serve` output classification, and HTTP health polling — and make "Sync to Studio" and "Play/Test" behave sensibly when Rojo isn't actually working.

**Architecture:** A new pure-logic module `lib/rojo.js` (install check, output classifier, health poll) gets wired into `main.js`'s existing pty output pipeline, which already sees `rojo serve`'s raw stdout before forwarding it to the renderer. Status is tracked per-pane in `main.js` and pushed to the renderer over a new `rojo:status` IPC event; the renderer's "Rojo Sync Status" widget and the "Play/Test" button both consume it.

**Tech Stack:** Node.js `child_process.execFile`, Node's built-in `http` module, Electron IPC (`ipcMain`/`ipcRenderer` via `preload.js`), `node --test`.

---

## Reference: spec

Full design rationale is in `docs/superpowers/specs/2026-07-07-rojo-integration-design.md`. Read it once before starting — this plan assumes its scope decisions (no auto-install, no Studio-client-count detection, non-blocking Play/Test warning).

---

### Task 1: Rojo install-check module

**Files:**
- Create: `lib/rojo.js`
- Test: `test/rojo-installed.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkRojoInstalled } = require('../lib/rojo');

test('checkRojoInstalled reports installed with a version on success', async () => {
  const fakeExecFile = (cmd, args, cb) => cb(null, 'Rojo 7.4.0\n');
  const result = await checkRojoInstalled(fakeExecFile);
  assert.deepEqual(result, { installed: true, version: 'Rojo 7.4.0' });
});

test('checkRojoInstalled reports not installed when the binary is missing', async () => {
  const fakeExecFile = (cmd, args, cb) => cb(new Error('spawn rojo ENOENT'));
  const result = await checkRojoInstalled(fakeExecFile);
  assert.deepEqual(result, { installed: false });
});

test('checkRojoInstalled reports not installed when the command exits non-zero', async () => {
  const fakeExecFile = (cmd, args, cb) => cb(new Error('Command failed'));
  const result = await checkRojoInstalled(fakeExecFile);
  assert.deepEqual(result, { installed: false });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/rojo-installed.test.js`
Expected: FAIL — `Cannot find module '../lib/rojo'`

- [ ] **Step 3: Write the minimal implementation**

```js
const { execFile } = require('child_process');

function checkRojoInstalled(execFileFn = execFile) {
  return new Promise((resolve) => {
    execFileFn('rojo', ['--version'], (err, stdout) => {
      if (err) {
        resolve({ installed: false });
        return;
      }
      resolve({ installed: true, version: stdout.trim() });
    });
  });
}

module.exports = { checkRojoInstalled };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/rojo-installed.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/rojo.js test/rojo-installed.test.js
git commit -m "Add Rojo install-check module"
```

---

### Task 2: Rojo output classifier

**Files:**
- Modify: `lib/rojo.js`
- Test: `test/rojo-classify.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyRojoLine } = require('../lib/rojo');

test('classifyRojoLine returns null for a blank line', () => {
  assert.equal(classifyRojoLine(''), null);
  assert.equal(classifyRojoLine('   '), null);
});

test('classifyRojoLine returns null for unrelated output', () => {
  assert.equal(classifyRojoLine('Watching for file changes...'), null);
});

test('classifyRojoLine detects a listening server with its port', () => {
  assert.deepEqual(
    classifyRojoLine('Rojo server listening on port 34872'),
    { type: 'listening', port: 34872 }
  );
});

test('classifyRojoLine detects a port-in-use error', () => {
  const result = classifyRojoLine('Error: address already in use (os error 10048)');
  assert.equal(result.type, 'error');
  assert.equal(result.reason, 'port-in-use');
});

test('classifyRojoLine detects a missing project file error', () => {
  const result = classifyRojoLine("Couldn't find project file default.project.json");
  assert.equal(result.type, 'error');
  assert.equal(result.reason, 'no-project-file');
});

test('classifyRojoLine falls back to unknown for other error lines', () => {
  const result = classifyRojoLine('Error: something unexpected happened');
  assert.equal(result.type, 'error');
  assert.equal(result.reason, 'unknown');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/rojo-classify.test.js`
Expected: FAIL — `classifyRojoLine is not a function`

- [ ] **Step 3: Write the minimal implementation**

Add to `lib/rojo.js` (keep the existing `checkRojoInstalled` above it):

```js
function classifyRojoLine(line) {
  const text = (line || '').trim();
  if (!text) return null;

  const portMatch = text.match(/port:?\s*(\d+)/i);
  if (/listening/i.test(text) && portMatch) {
    return { type: 'listening', port: Number(portMatch[1]) };
  }

  if (/address already in use|port.*in use/i.test(text)) {
    return { type: 'error', reason: 'port-in-use', raw: text };
  }

  if (/couldn't find|could not find|no project file/i.test(text)) {
    return { type: 'error', reason: 'no-project-file', raw: text };
  }

  if (/^error/i.test(text)) {
    return { type: 'error', reason: 'unknown', raw: text };
  }

  return null;
}
```

Update the `module.exports` line at the bottom of `lib/rojo.js`:

```js
module.exports = { checkRojoInstalled, classifyRojoLine };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/rojo-classify.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Manual verification against real Rojo output**

The regexes above are written against representative sample lines, not a captured real log. If Rojo is installed locally, run `rojo serve` in a project folder from a plain terminal and watch its actual stdout. If real output doesn't match (e.g. a different phrasing for "listening" or the port), adjust the regexes in `classifyRojoLine` now and re-run Step 4 until the real output classifies correctly. If Rojo isn't available to test with right now, skip this step and re-verify during Task 5's manual verification instead (it wires this classifier into a live `rojo serve` pane).

- [ ] **Step 6: Commit**

```bash
git add lib/rojo.js test/rojo-classify.test.js
git commit -m "Add Rojo serve output classifier"
```

---

### Task 3: Rojo health-check module

**Files:**
- Modify: `lib/rojo.js`
- Test: `test/rojo-health.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { checkRojoHealth } = require('../lib/rojo');

function withServer(handler, fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', async () => {
      try {
        await fn(server.address().port);
        server.close(() => resolve());
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

test('checkRojoHealth reports healthy for a valid Rojo API response', async () => {
  await withServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ name: 'MyGame' }));
    },
    async (port) => {
      const result = await checkRojoHealth(port);
      assert.deepEqual(result, { healthy: true, projectName: 'MyGame' });
    }
  );
});

test('checkRojoHealth reports unhealthy for a non-JSON response', async () => {
  await withServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('not json');
    },
    async (port) => {
      const result = await checkRojoHealth(port);
      assert.deepEqual(result, { healthy: false });
    }
  );
});

test('checkRojoHealth reports unhealthy when nothing is listening on the port', async () => {
  const result = await checkRojoHealth(65530);
  assert.deepEqual(result, { healthy: false });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/rojo-health.test.js`
Expected: FAIL — `checkRojoHealth is not a function`

- [ ] **Step 3: Write the minimal implementation**

Add to `lib/rojo.js`:

```js
const http = require('http');

function checkRojoHealth(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: 'localhost', port, path: '/api/rojo', timeout: 1500 }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ healthy: true, projectName: parsed.name || null });
        } catch (err) {
          resolve({ healthy: false });
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ healthy: false });
    });
    req.on('error', () => {
      resolve({ healthy: false });
    });
  });
}
```

Update `module.exports`:

```js
module.exports = { checkRojoInstalled, classifyRojoLine, checkRojoHealth };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/rojo-health.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/rojo.js test/rojo-health.test.js
git commit -m "Add Rojo health-check module"
```

---

### Task 4: Pass pane `kind` through to the main process

**Why:** `main.js`'s `pty:spawn` handler has no idea which pane is the "Sync to Studio" one — `kind` is currently a renderer-only concept (`renderer/state.js`). Task 5 needs `main.js` to know this to track Rojo status per pane.

**Files:**
- Modify: `renderer/renderer.js:89-94`
- Modify: `main.js:57-58`

- [ ] **Step 1: Send `kind` from the renderer's spawn call**

In `renderer/renderer.js`, change the `window.api.spawn` call inside `createPane`:

```js
  window.api.spawn(id, {
    shell: shellSelect.value,
    cols: term.cols,
    rows: term.rows,
    autoRun,
    cwd,
    kind: kind || 'terminal',
  }).then((res) => {
```

- [ ] **Step 2: Accept `kind` in the main-process handler**

In `main.js`, change the destructuring at the top of `pty:spawn`:

```js
ipcMain.handle('pty:spawn', (event, opts) => {
  const { id, shell, cwd, cols, rows, autoRun, kind } = opts;
```

(`kind` isn't used yet in this task — that's Task 5. This task only wires the value through.)

- [ ] **Step 3: Manual verification**

Run `npm start`. Open a plain Terminal and a Sync to Studio pane (with a project folder set). No visible behavior change is expected yet — this step just confirms the app still launches and both pane types still spawn correctly (check the DevTools console for errors: View menu is removed, so open DevTools via `Ctrl+Shift+I`).

- [ ] **Step 4: Commit**

```bash
git add renderer/renderer.js main.js
git commit -m "Pass pane kind through to the main process"
```

---

### Task 5: Rojo status tracking in the main process

**Files:**
- Modify: `main.js`
- Modify: `preload.js`

- [ ] **Step 1: Add status tracking state and helpers to `main.js`**

Add near the top, alongside the existing `const terminals = new Map();`:

```js
const { checkRojoInstalled, classifyRojoLine, checkRojoHealth } = require('./lib/rojo');

const paneMeta = new Map(); // id -> { kind, cwd }
const rojoStatus = new Map(); // id -> { state, detail, port, folder }
const rojoHealthTimers = new Map(); // id -> interval handle

function setRojoStatus(id, patch) {
  const meta = paneMeta.get(id);
  const folder = meta ? meta.cwd : null;
  const next = Object.assign(
    { state: 'not-started', detail: null, port: null },
    rojoStatus.get(id),
    patch,
    { folder }
  );
  rojoStatus.set(id, next);
  if (mainWindow) {
    mainWindow.webContents.send('rojo:status', Object.assign({ paneId: id }, next));
  }
}

function clearRojoHealthTimer(id) {
  const timer = rojoHealthTimers.get(id);
  if (timer) {
    clearInterval(timer);
    rojoHealthTimers.delete(id);
  }
}
```

- [ ] **Step 2: Track pane metadata and hook the classifier into pty output**

Modify the `pty:spawn` handler in `main.js` (building on Task 4's destructuring):

```js
ipcMain.handle('pty:spawn', (event, opts) => {
  const { id, shell, cwd, cols, rows, autoRun, kind } = opts;
  const shellPath = shell || process.env.COMSPEC || 'powershell.exe';

  let term;
  try {
    term = pty.spawn(shellPath, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 30,
      cwd: cwd || os.homedir(),
      env: process.env,
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  terminals.set(id, term);
  paneMeta.set(id, { kind: kind || 'terminal', cwd: cwd || null });
  if (kind === 'sync-to-studio') {
    setRojoStatus(id, { state: 'starting' });
  }

  term.onData((data) => {
    if (mainWindow) mainWindow.webContents.send('pty:data', { id, data });

    const meta = paneMeta.get(id);
    if (meta && meta.kind === 'sync-to-studio') {
      data.split(/\r?\n/).forEach((line) => {
        const parsed = classifyRojoLine(line);
        if (!parsed) return;

        if (parsed.type === 'listening') {
          clearRojoHealthTimer(id);
          setRojoStatus(id, { state: 'serving', detail: null, port: parsed.port });
          const timer = setInterval(async () => {
            const health = await checkRojoHealth(parsed.port);
            if (health.healthy) {
              setRojoStatus(id, { state: 'serving', detail: null, port: parsed.port });
            } else {
              setRojoStatus(id, { state: 'error', detail: 'server stopped responding', port: parsed.port });
            }
          }, 3000);
          rojoHealthTimers.set(id, timer);
        } else if (parsed.type === 'error') {
          clearRojoHealthTimer(id);
          setRojoStatus(id, { state: 'error', detail: parsed.reason, port: null });
        }
      });
    }
  });

  term.onExit(({ exitCode }) => {
    if (mainWindow) mainWindow.webContents.send('pty:exit', { id, code: exitCode });
    terminals.delete(id);
    const meta = paneMeta.get(id);
    if (meta && meta.kind === 'sync-to-studio') {
      clearRojoHealthTimer(id);
      setRojoStatus(id, { state: 'not-started', detail: null, port: null });
    }
    paneMeta.delete(id);
  });

  if (autoRun) {
    setTimeout(() => {
      if (terminals.has(id)) term.write(autoRun + '\r');
    }, 600);
  }

  return { ok: true };
});
```

- [ ] **Step 3: Add the install-check and status-query IPC handlers**

Add near the other `roblox:*` handler in `main.js`:

```js
ipcMain.handle('rojo:checkInstalled', () => checkRojoInstalled());

ipcMain.handle('rojo:getStatus', (event, folder) => {
  let matchId = null;
  for (const [id, meta] of paneMeta.entries()) {
    if (meta.kind === 'sync-to-studio' && meta.cwd === folder) {
      matchId = id;
    }
  }
  if (!matchId) {
    return { state: 'not-started', detail: null, port: null, folder };
  }
  return Object.assign(
    { paneId: matchId },
    rojoStatus.get(matchId) || { state: 'not-started', detail: null, port: null, folder }
  );
});
```

- [ ] **Step 4: Expose the new API in `preload.js`**

Add a `rojo` section to the `contextBridge.exposeInMainWorld('api', {...})` object:

```js
  rojo: {
    checkInstalled: () => ipcRenderer.invoke('rojo:checkInstalled'),
    getStatus: (folder) => ipcRenderer.invoke('rojo:getStatus', folder),
    onStatus: (cb) => {
      const listener = (_event, payload) => cb(payload);
      ipcRenderer.on('rojo:status', listener);
      return () => ipcRenderer.removeListener('rojo:status', listener);
    },
  },
```

- [ ] **Step 5: Manual verification**

Run `npm start`. Set a project folder that has a `default.project.json`, click "Sync to Studio", and open DevTools (`Ctrl+Shift+I`) → Console. Add a temporary `console.log` inside the `onStatus` callback if needed to confirm `rojo:status` events arrive with `state: 'starting'` then `state: 'serving'` (assuming Rojo is installed and the folder has a valid project file). Try it once with an invalid folder (no `default.project.json`) to confirm you get `state: 'error', detail: 'no-project-file'`. If the classification doesn't fire correctly, revisit `classifyRojoLine`'s regexes (Task 2, Step 5) against what you're actually seeing. Remove any temporary `console.log` before committing.

- [ ] **Step 6: Commit**

```bash
git add main.js preload.js
git commit -m "Track real Rojo serve status in the main process"
```

---

### Task 6: Gate "Sync to Studio" on install detection, add install guidance

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/style.css`
- Modify: `renderer/renderer.js`

- [ ] **Step 1: Add the notice element to the toolbar**

In `renderer/index.html`, add a new `<span>` between the `btnPlayTest` and `btnAddWidget` buttons:

```html
    <button id="btnSyncStudio" disabled title="Set a project folder first">Sync to Studio</button>
    <button id="btnPlayTest" disabled title="Set a project folder first">Play / Test</button>
    <span id="toolbarNotice" class="toolbar-notice hidden"></span>
    <button id="btnAddWidget">+ Widget</button>
```

- [ ] **Step 2: Style the notice**

Add to `renderer/style.css`:

```css
.toolbar-notice {
  font-size: 12px;
  color: #d29922;
  cursor: pointer;
}

.toolbar-notice.hidden {
  display: none;
}

.toolbar-notice a {
  color: #58a6ff;
}
```

- [ ] **Step 3: Add a notice helper and gate the Sync to Studio handler**

In `renderer/renderer.js`, add near the top (after the other `document.getElementById` calls):

```js
const toolbarNotice = document.getElementById('toolbarNotice');
let toolbarNoticeTimer = null;

function showToolbarNotice(html, durationMs) {
  toolbarNotice.innerHTML = html;
  toolbarNotice.classList.remove('hidden');
  if (toolbarNoticeTimer) clearTimeout(toolbarNoticeTimer);
  if (durationMs) {
    toolbarNoticeTimer = setTimeout(() => {
      toolbarNotice.classList.add('hidden');
    }, durationMs);
  }
}

toolbarNotice.addEventListener('click', () => {
  toolbarNotice.classList.add('hidden');
});
```

Replace the existing `btnSyncStudio` click handler:

```js
btnSyncStudio.addEventListener('click', async () => {
  const installed = await window.api.rojo.checkInstalled();
  if (!installed.installed) {
    showToolbarNotice(
      'Rojo not found — see the <a href="https://rojo.space/docs/installation/" target="_blank">install guide</a>',
      null
    );
    return;
  }
  const folder = window.BuildCenter.getProjectFolder();
  createPane({ title: 'Sync to Studio', kind: 'sync-to-studio', autoRun: 'rojo serve', cwd: folder });
});
```

- [ ] **Step 4: Manual verification**

Run `npm start`. If Rojo is installed, clicking "Sync to Studio" should behave exactly as before (spawns the pane). To test the missing-install path without uninstalling Rojo, temporarily rename `lib/rojo.js`'s `checkRojoInstalled` to always resolve `{ installed: false }`, reload the app (`Ctrl+R`), click the button, confirm the notice appears with a clickable install link, and clicking the notice dismisses it. Revert the temporary change afterward.

- [ ] **Step 5: Commit**

```bash
git add renderer/index.html renderer/style.css renderer/renderer.js
git commit -m "Gate Sync to Studio on Rojo install detection"
```

---

### Task 7: Wire the "Rojo Sync Status" widget to real status

**Files:**
- Modify: `renderer/widgets.js`
- Modify: `renderer/style.css`
- Modify: `renderer/index.html`
- Delete: `renderer/lib/rojo-status.js`

- [ ] **Step 1: Replace `renderRojoStatus` in `renderer/widgets.js`**

```js
function renderRojoStatus(container) {
  // Note: 'not-installed' is not a state this widget shows — install
  // detection (Task 6) only runs when "Sync to Studio" is clicked and
  // drives the toolbar notice, not this per-pane status map. Before that
  // click, an uninstalled Rojo looks identical to 'not-started' here.
  const STATE_LABELS = {
    'not-started': 'Not syncing',
    starting: 'Starting…',
    serving: 'Serving',
    error: 'Error',
  };

  function draw(status) {
    const folder = window.BuildCenter.getProjectFolder();
    if (!folder) {
      container.innerHTML = '<p class="widget-empty">Not configured — set a project folder</p>';
      return;
    }
    const state = (status && status.state) || 'not-started';
    const label = STATE_LABELS[state] || state;
    const detail = status && status.detail ? ` (${escapeHtml(status.detail)})` : '';
    container.innerHTML = `<p class="rojo-state ${state}">${escapeHtml(label)}${detail}</p>`;
  }

  function refresh() {
    const folder = window.BuildCenter.getProjectFolder();
    if (!folder) {
      draw(null);
      return;
    }
    window.api.rojo.getStatus(folder).then(draw);
  }

  function onStatus(payload) {
    if (payload.folder === window.BuildCenter.getProjectFolder()) draw(payload);
  }

  refresh();
  const unsubscribeStatus = window.api.rojo.onStatus(onStatus);
  window.BuildCenter.onProjectFolderChanged(refresh);

  return () => {
    unsubscribeStatus();
    window.BuildCenter.offProjectFolderChanged(refresh);
  };
}
```

This replaces the old body of the function (which called `window.BuildCenter.computeRojoStatus(...)`) — the function signature and its entry in `WIDGET_CATALOG` stay the same.

- [ ] **Step 2: Update the CSS state classes**

In `renderer/style.css`, replace:

```css
.rojo-state.connected {
  color: #3fb950;
}

.rojo-state.disconnected {
  color: #8b949e;
}
```

with:

```css
.rojo-state.serving {
  color: #3fb950;
}

.rojo-state.starting {
  color: #d29922;
}

.rojo-state.error {
  color: #f85149;
}

.rojo-state.not-started {
  color: #8b949e;
}
```

- [ ] **Step 3: Remove the old fake module**

Delete `renderer/lib/rojo-status.js`, and remove its script tag from `renderer/index.html`:

```html
    <script src="lib/rojo-status.js"></script>
```

- [ ] **Step 4: Manual verification**

Run `npm start`, add the "Rojo Sync Status" widget via "+ Widget", set a project folder, click "Sync to Studio". Confirm the widget shows "Starting…" then "Serving" (amber then green, per the new CSS), and shows "Not syncing" (grey) before you start it. If Rojo isn't installed in this environment, the widget will still show "Not syncing" rather than a distinct message — that's expected (see the note in `renderRojoStatus`); the actual install guidance is Task 6's toolbar notice, which fires from the button click regardless of what this widget shows.

- [ ] **Step 5: Commit**

```bash
git add renderer/widgets.js renderer/style.css renderer/index.html
git rm renderer/lib/rojo-status.js
git commit -m "Wire Rojo Sync Status widget to real status tracking"
```

---

### Task 8: Play/Test staleness warning

**Files:**
- Modify: `renderer/renderer.js`

- [ ] **Step 1: Check status before opening the place file**

Replace the `btnPlayTest` click handler in `renderer/renderer.js`:

```js
btnPlayTest.addEventListener('click', async () => {
  const folder = window.BuildCenter.getProjectFolder();
  const status = await window.api.rojo.getStatus(folder);
  const result = await window.api.roblox.playTest(folder);
  if (!result.ok) {
    alert('Play/Test failed: ' + result.error);
    return;
  }
  if (status.state !== 'serving') {
    showToolbarNotice("Rojo isn't syncing — this may open a stale place.", 4000);
  }
});
```

- [ ] **Step 2: Manual verification**

Run `npm start` with a project folder set. Click "Play/Test" without starting "Sync to Studio" first — confirm the place file still opens AND the toolbar notice appears for ~4 seconds with the staleness warning. Then start "Sync to Studio", wait for it to reach "Serving", click "Play/Test" again, and confirm no warning appears this time.

- [ ] **Step 3: Commit**

```bash
git add renderer/renderer.js
git commit -m "Warn on Play/Test when Rojo isn't currently serving"
```

---

### Task 9: Update README and push

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a changelog entry**

In `README.md`, add a new line directly under `## Recent Changes` (above the existing `2026-07-06` entries):

```markdown
- **2026-07-07** — Rojo Integration: replaced the fake Rojo sync status with real detection — install check, `rojo serve` output parsing, and HTTP health polling — plus install guidance and a staleness warning on Play/Test.
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — all `test/*.test.js` files, including the three new `rojo-*.test.js` files, pass with no failures.

- [ ] **Step 3: Commit and push**

```bash
git add README.md
git commit -m "Update README for Rojo Integration"
git push -u origin feature/rojo-integration
```
