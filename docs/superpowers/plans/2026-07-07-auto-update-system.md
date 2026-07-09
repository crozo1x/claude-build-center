# Auto-Update System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `claude-build-center` a real, installable Windows distribution (unsigned NSIS installer via `electron-builder`), a GitHub Actions pipeline that builds and publishes a release on every version tag, and an in-app "Update Available" button (via `electron-updater`) that downloads and restarts the app on click.

**Architecture:** `electron-builder` packages the app; a GitHub Actions workflow runs it on tag push and publishes to GitHub Releases; `electron-updater`'s `autoUpdater` (wrapped by a small testable `lib/updater.js` event-mapping module) checks for updates once on startup and drives a toolbar button through the existing IPC push pattern already used elsewhere in this codebase (main process tracks state, pushes to renderer, renderer shows/hides UI).

**Tech Stack:** `electron-builder`, `electron-updater`, GitHub Actions, Electron IPC (`ipcMain`/`ipcRenderer` via `preload.js`), `node --test`.

---

## Reference: spec

Full design rationale is in `docs/superpowers/specs/2026-07-07-auto-update-design.md`. Read it once before starting — this plan assumes its scope decisions (no code signing, Windows-only, no silent background download, no periodic re-checking).

**Important implementation detail not covered at spec altitude, but required for the packaged app to actually work:** `node-pty` is a native module (a compiled `.node` binary). Electron-builder packages the app into an ASAR archive by default, and native `.node` binaries generally cannot be loaded from inside an ASAR archive — without unpacking it, the packaged app's terminals would fail to spawn at all (this would NOT show up in `npm start`, since dev mode never uses ASAR — it would only surface in the actual installed build). Task 1 below includes the `asarUnpack` config needed to avoid this, and its manual verification step specifically checks that terminals still work in the *packaged* build, not just `npm start`.

---

### Task 1: Package the app with electron-builder

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the dependency**

Run: `npm install --save-dev electron-builder`

- [ ] **Step 2: Add the build config and scripts**

In `package.json`, add a `"build"` key (as a sibling of `"scripts"`/`"dependencies"`) and a new script:

```json
{
  "name": "claude-build-center",
  "version": "0.1.0",
  "description": "Local control center for Claude Code terminals and local AI agents",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron .",
    "rebuild": "electron-rebuild -f -w node-pty",
    "test": "node --test",
    "dist": "electron-builder --publish never"
  },
  "build": {
    "appId": "com.crozo1x.claude-build-center",
    "productName": "Build Center",
    "asarUnpack": [
      "**/node_modules/node-pty/**/*"
    ],
    "win": {
      "target": "nsis"
    },
    "publish": {
      "provider": "github",
      "owner": "crozo1x",
      "repo": "claude-build-center"
    }
  },
  "dependencies": {
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/xterm": "^5.5.0",
    "gridstack": "^12.6.0",
    "node-pty": "^1.0.0"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.6.1",
    "electron": "^31.3.0",
    "electron-builder": "^24.13.3"
  }
}
```

(Use whatever exact `electron-builder` version `npm install` actually resolved in Step 1 — don't hand-edit the version string to something you didn't verify was installed.)

- [ ] **Step 3: Build locally and verify the packaged app actually works**

Run: `npm run dist`
Expected: completes successfully, producing an installer under `dist/` (e.g. `dist/Build Center Setup 0.1.0.exe`) — already gitignored, don't commit it.

Install it (run the generated `.exe`), launch "Build Center" from the Start Menu (not `npm start` — this must be the installed build, to actually exercise ASAR packaging), and confirm:
- The app window opens.
- Click "+ Terminal" and confirm a real shell prompt appears and you can type a command and see output (this is the check that `node-pty`'s native binary actually loaded correctly from the unpacked ASAR — if `asarUnpack` were missing or wrong, this is where it would visibly fail).

Uninstall the test install afterward via Windows "Add or remove programs" (searching for "Build Center") to avoid leaving a stale unmanaged version registered on this machine.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Package the app with electron-builder"
```

---

### Task 2: GitHub Actions release pipeline

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - run: npm run rebuild

      - run: npx electron-builder --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "Add GitHub Actions release pipeline"
```

(This workflow can't be fully verified until a real version tag is pushed — that happens in Task 7, once everything else is in place. At that point, watch the Actions tab on GitHub to confirm the run succeeds and produces a Release with the installer attached.)

---

### Task 3: Updater event-mapping module

**Files:**
- Create: `lib/updater.js`
- Test: `test/updater.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { mapUpdaterEvent, attachUpdaterEvents } = require('../lib/updater');

test('mapUpdaterEvent maps known electron-updater events to status strings', () => {
  assert.equal(mapUpdaterEvent('checking-for-update'), 'checking');
  assert.equal(mapUpdaterEvent('update-available'), 'available');
  assert.equal(mapUpdaterEvent('update-not-available'), 'not-available');
  assert.equal(mapUpdaterEvent('download-progress'), 'downloading');
  assert.equal(mapUpdaterEvent('update-downloaded'), 'downloaded');
  assert.equal(mapUpdaterEvent('error'), 'error');
});

test('mapUpdaterEvent returns null for an unrecognized event name', () => {
  assert.equal(mapUpdaterEvent('some-future-event'), null);
});

test('attachUpdaterEvents subscribes to every known event and forwards mapped status', () => {
  const listeners = {};
  const fakeAutoUpdater = {
    on(eventName, cb) {
      listeners[eventName] = cb;
    },
  };
  const seen = [];
  attachUpdaterEvents(fakeAutoUpdater, (status) => seen.push(status));

  assert.ok(listeners['checking-for-update'], 'should subscribe to checking-for-update');
  assert.ok(listeners['update-available'], 'should subscribe to update-available');
  assert.ok(listeners['update-downloaded'], 'should subscribe to update-downloaded');

  listeners['checking-for-update']();
  listeners['update-available']();
  listeners['update-downloaded']();

  assert.deepEqual(seen, ['checking', 'available', 'downloaded']);
});

test('attachUpdaterEvents ignores events with no mapped status', () => {
  const listeners = {};
  const fakeAutoUpdater = {
    on(eventName, cb) {
      listeners[eventName] = cb;
    },
  };
  const seen = [];
  attachUpdaterEvents(fakeAutoUpdater, (status) => seen.push(status));

  // Simulate electron-updater emitting something attachUpdaterEvents didn't explicitly subscribe to
  // by calling a handler that was never registered — this should simply not exist.
  assert.equal(listeners['some-unmapped-event'], undefined);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/updater.test.js`
Expected: FAIL — `Cannot find module '../lib/updater'`

- [ ] **Step 3: Write the minimal implementation**

```js
const EVENT_STATUS_MAP = {
  'checking-for-update': 'checking',
  'update-available': 'available',
  'update-not-available': 'not-available',
  'download-progress': 'downloading',
  'update-downloaded': 'downloaded',
  error: 'error',
};

function mapUpdaterEvent(eventName) {
  return EVENT_STATUS_MAP[eventName] || null;
}

function attachUpdaterEvents(autoUpdaterImpl, onStatus) {
  Object.keys(EVENT_STATUS_MAP).forEach((eventName) => {
    autoUpdaterImpl.on(eventName, () => {
      onStatus(mapUpdaterEvent(eventName));
    });
  });
}

module.exports = { mapUpdaterEvent, attachUpdaterEvents };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/updater.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/updater.js test/updater.test.js
git commit -m "Add updater event-mapping module"
```

---

### Task 4: Wire electron-updater into the main process

**Files:**
- Modify: `main.js`
- Modify: `package.json`

- [ ] **Step 1: Add the dependency**

Run: `npm install electron-updater`

(This is a runtime dependency, not a devDependency — it ships inside the packaged app, unlike `electron-builder`.)

- [ ] **Step 2: Wire it into `main.js`**

Add near the top, with the other `require`s:

```js
const { autoUpdater } = require('electron-updater');
const { attachUpdaterEvents } = require('./lib/updater');
```

Add near the other top-level state (after `const configPath = ...`):

```js
autoUpdater.autoDownload = false;

attachUpdaterEvents(autoUpdater, (state) => {
  if (mainWindow) mainWindow.webContents.send('update:status', { state });
  if (state === 'downloaded') {
    autoUpdater.quitAndInstall();
  }
});
```

Modify the `app.whenReady()` block to trigger a check shortly after launch:

```js
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // No published releases yet, or offline — fail silently, matching the
      // "no update available" UX rather than surfacing a startup error.
    });
  }, 5000);
});
```

Add the two new IPC handlers near the other `ipcMain.handle` calls:

```js
ipcMain.handle('update:check', () => {
  return autoUpdater
    .checkForUpdates()
    .then(() => ({ ok: true }))
    .catch((err) => ({ ok: false, error: String(err) }));
});

ipcMain.handle('update:download', () => {
  return autoUpdater
    .downloadUpdate()
    .then(() => ({ ok: true }))
    .catch((err) => ({ ok: false, error: String(err) }));
});
```

- [ ] **Step 3: Manual verification**

Run `npm start`. Open DevTools (`Ctrl+Shift+I`) and confirm no errors are thrown on launch (since there are no published GitHub Releases for this repo yet at this point in the plan, `checkForUpdates()` is expected to fail gracefully — confirm it does NOT crash the app or throw an unhandled rejection, just silently does nothing, per the `.catch(() => {})` above). Full positive-path verification (an update actually being detected) happens in Task 7, once a real release exists.

- [ ] **Step 4: Commit**

```bash
git add main.js package.json package-lock.json
git commit -m "Wire electron-updater into the main process"
```

---

### Task 5: Expose the update API in preload.js

**Files:**
- Modify: `preload.js`

- [ ] **Step 1: Add the `update` section**

Add to the `contextBridge.exposeInMainWorld('api', {...})` object in `preload.js`:

```js
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    onStatus: (cb) => {
      const listener = (_event, payload) => cb(payload);
      ipcRenderer.on('update:status', listener);
      return () => ipcRenderer.removeListener('update:status', listener);
    },
  },
```

- [ ] **Step 2: Manual verification**

Run `npm start`, open DevTools console, and confirm `window.api.update` exists with `check`, `download`, and `onStatus` functions (type `window.api.update` in the console).

- [ ] **Step 3: Commit**

```bash
git add preload.js
git commit -m "Expose update API in preload.js"
```

---

### Task 6: Toolbar "Update Available" button

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/style.css`
- Modify: `renderer/renderer.js`

- [ ] **Step 1: Add the button, hidden by default**

In `renderer/index.html`, add after the `btnAddWidget` button:

```html
    <button id="btnAddWidget">+ Widget</button>
    <button id="btnUpdateAvailable" class="hidden">Update Available</button>
```

- [ ] **Step 2: Style it**

Add to `renderer/style.css` (mirroring the existing `.widget-picker.hidden` convention of scoping `.hidden` per-element rather than a single global utility class):

```css
#btnUpdateAvailable {
  background: #238636;
  border-color: #2ea043;
  color: #ffffff;
}

#btnUpdateAvailable:hover {
  background: #2ea043;
}

#btnUpdateAvailable.hidden {
  display: none;
}
```

- [ ] **Step 3: Wire it up in `renderer/renderer.js`**

Add near the other `document.getElementById` calls:

```js
const btnUpdateAvailable = document.getElementById('btnUpdateAvailable');
```

Add near the bottom of the file (after the existing button click handlers):

```js
window.api.update.onStatus((payload) => {
  if (payload.state === 'available') {
    btnUpdateAvailable.classList.remove('hidden');
  }
});

btnUpdateAvailable.addEventListener('click', async () => {
  btnUpdateAvailable.disabled = true;
  btnUpdateAvailable.textContent = 'Updating…';
  const result = await window.api.update.download();
  if (!result.ok) {
    alert('Update failed: ' + result.error);
    btnUpdateAvailable.disabled = false;
    btnUpdateAvailable.textContent = 'Update Available';
  }
  // On success, the app will quit and restart itself once the download
  // finishes (see Task 4's 'downloaded' handling in main.js) — no further
  // UI state is needed here.
});
```

- [ ] **Step 4: Manual verification**

Run `npm start` and confirm the button is hidden on normal launch (no update exists to detect yet). Then, since there's no real published release to trigger the `available` state against yet, simulate it directly in the DevTools console (`Ctrl+Shift+I`) to check the button's visual behavior in isolation:

```js
document.getElementById('btnUpdateAvailable').classList.remove('hidden');
```

Confirm the button appears in the toolbar styled correctly (green background, per the CSS above). The full real flow — button appearing because an actual update was detected, clicking it, and the app restarting — is verified end-to-end in Task 7, once a real release exists to check against.

- [ ] **Step 5: Commit**

```bash
git add renderer/index.html renderer/style.css renderer/renderer.js
git commit -m "Add toolbar Update Available button"
```

---

### Task 7: README, first release, and end-to-end verification

**Files:**
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Add a changelog entry**

In `README.md`, add a new line directly under `## Recent Changes` (above the existing entries):

```markdown
- **2026-07-07** — Auto-Update System: packaged the app as a Windows installer (unsigned, via electron-builder), added a GitHub Actions release pipeline, and a toolbar "Update Available" button that downloads and restarts the app on click.
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — all `test/*.test.js` files, including the new `updater.test.js`, pass with no failures.

- [ ] **Step 3: Commit, bump the version, and cut the first real release**

```bash
git add README.md
git commit -m "Update README for Auto-Update System"
git push -u origin feature/auto-update-system
```

At this point, this branch needs to be merged to `main` before tagging a release (the GitHub Actions workflow only exists on this branch until then) — coordinate with whoever is merging PRs for this repo before proceeding to Step 4.

- [ ] **Step 4: End-to-end verification (after merge to main)**

Bump `"version"` in `package.json` to `"0.1.1"`, commit that bump directly to `main` (or via a small follow-up PR), then:

```bash
git tag v0.1.1
git push --tags
```

Watch the Actions tab on GitHub — confirm the `Release` workflow runs successfully and produces a GitHub Release for `v0.1.1` with a `.exe` installer attached.

Then, on a machine with the OLDER `v0.1.0` build still installed (from Task 1's local test install, or a fresh `npm run dist` of the pre-bump code): launch it, wait ~5 seconds, confirm the "Update Available" button appears, click it, confirm it downloads and the app restarts itself into the new version (check the "About"/version — or simplest, confirm the Start Menu / installed version now shows `0.1.1`).

While testing this, open a terminal pane (ideally a "Sync to Studio" pane, if a Roblox project folder is set up) before clicking the update button, so there's a live child process running. After the restart completes, check Task Manager to confirm no orphaned shell/`rojo` process was left behind — `quitAndInstall()` triggers Electron's normal quit sequence, which should route through the existing `window-all-closed` handler's pty cleanup, but this hasn't been exercised end-to-end until now.

This is the one piece of this whole feature that cannot be verified any earlier than this, since it requires a real published release to check against — do not skip it or assume it works from the unit tests and manual launches alone.
