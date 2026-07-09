# Auto-Update System — Design Spec

**Date:** 2026-07-07
**Status:** Approved, pending implementation plan
**Follows:** GUI Modernization (merged, PR #1), Roblox Integration (PR #2, pending review)

## Problem

`claude-build-center` currently has no packaging or distribution story at all — it only runs via `npm start` (`electron .`) from a source checkout. There is no `electron-builder`/`electron-forge` config, no CI, and no way for a non-technical user (family/friends, per the target audience for the first release) to install or update it.

Goal: give the app a real, installable Windows distribution with a working auto-update flow, sized appropriately for a small, known user base rather than a public software product.

## Scope

**In scope:**
- Package the app as a Windows installer (NSIS) via `electron-builder`.
- A GitHub Actions workflow that builds and publishes the installer to a GitHub Release whenever a version tag is pushed.
- In-app update detection via `electron-updater`, checking once shortly after launch.
- A toolbar button that appears only when an update is available; clicking it downloads the update and restarts the app to apply it.

**Out of scope (explicitly not doing, per user decisions):**
- Code signing. The installer will trigger Windows SmartScreen's "unrecognized app" warning on first run — accepted for now, revisit if/when the user base grows beyond family/friends.
- macOS/Linux builds. Windows-only, matching everything else in this codebase (PowerShell/cmd shell handling, no cross-platform code paths).
- Silent background downloading. The update downloads only when the user clicks the "Update Available" button, not automatically in the background before that.
- Periodic re-checking while the app is running. Checks happen once, shortly after launch, not on a recurring timer. (Easy to add later if needed — not needed for a family/friends audience who relaunch the app reasonably often.)
- Delta/differential updates, update channels (beta/stable), or rollback — `electron-updater` supports these but they're unneeded complexity for this scope.

## Architecture

### Packaging (`electron-builder`)

Add `electron-builder` as a devDependency. Configure via a `build` key in `package.json`:

```json
"build": {
  "appId": "com.crozo1x.claude-build-center",
  "productName": "Build Center",
  "win": {
    "target": "nsis"
  },
  "publish": {
    "provider": "github",
    "owner": "crozo1x",
    "repo": "claude-build-center"
  }
}
```

A new `npm run dist` script (`electron-builder --publish never`) builds an installer locally without publishing, for manual testing before a real release.

### CI pipeline (`.github/workflows/release.yml`)

Triggered on push of a tag matching `v*`. Runs on `windows-latest` (needed because `node-pty` is a native module and must be built on the target OS):

1. Checkout, `npm ci`
2. `npm run rebuild` (rebuilds `node-pty` for the Electron ABI — already an existing script)
3. `npx electron-builder --publish always`

Needs `permissions: contents: write` in the workflow so the built-in `GITHUB_TOKEN` can create the Release and upload assets — no separate secret needed since this publishes to the same repo the workflow runs in.

### In-app update flow

New `lib/updater.js` (main process) wrapping `electron-updater`'s `autoUpdater`:
- `autoUpdater.autoDownload = false` (download only happens on explicit user action, per the "click it, update, restart" requirement — not silently pre-downloaded).
- On app ready (`main.js`), call `autoUpdater.checkForUpdates()` once, ~5 seconds after `createWindow()` (a short delay so it doesn't compete with app startup, mirroring the existing `autoRun` 600ms delay pattern already used for pty panes).
- `autoUpdater` events wire to a small state tracker (mirrors the `rojo:status` push pattern from the Roblox Integration work): `checking` → `available` (or `not-available`) → (`downloading` → `downloaded`) → the renderer only cares about `available` and `downloaded`.
- New IPC: `ipcMain.handle('update:check')` (manual trigger, unused by the UI in this scope but harmless to expose for future use / debugging), `ipcMain.handle('update:download')` (triggered by the toolbar button click — calls `autoUpdater.downloadUpdate()`), and a push event `update:status` sent to the renderer on each state change.
- The toolbar button click is the only user action needed: it calls `update:download`, which starts the download; when `electron-updater` reports the `downloaded` event, the main process immediately calls `autoUpdater.quitAndInstall()` itself, with no second click required — matching "click it, update, restart" as one action from the user's perspective, not two.
- `quitAndInstall()` closes the whole app immediately (needed to replace the running executable) — any open terminal/Sync-to-Studio panes are killed along with it, the same as closing the app normally. Worth surfacing to the user once, but not worth a confirmation dialog for this scope (family/friends audience, and the button's own label already implies a restart is coming).

### Renderer

- `preload.js` gains an `update` section: `onStatus(cb)` (returns unsubscribe, same pattern as `rojo.onStatus`).
- `renderer/index.html` gains a new toolbar button, hidden by default: `<button id="btnUpdateAvailable" class="hidden">Update Available</button>`.
- `renderer/renderer.js`: subscribes to `update:status` on load; shows the button when state is `available`; clicking it calls `window.api.update.download()` and disables/relabels the button (e.g. "Updating…") until the app restarts itself (which it will, via `quitAndInstall()`, so no further UI state is needed after that point).

### Versioning workflow

To ship a release: bump `version` in `package.json`, commit, `git tag vX.Y.Z`, `git push --tags`. CI does the rest. `electron-updater` compares the running app's `package.json` version against the latest GitHub Release tag to decide if an update is available.

## Testing

`electron-updater`'s actual check/download/install behavior is a live network call to GitHub's release API plus OS-level installer invocation — not practically unit-testable, and this is a genuine departure from this codebase's otherwise TDD-everything convention. What CAN be unit-tested with plain `node:test` (matching the existing `lib/*.test.js` pattern):
- The small state-transition logic in `lib/updater.js` (mapping `autoUpdater` events to the pushed status shape), by wrapping `autoUpdater` behind a thin interface the tests can substitute a fake for — same dependency-injection style already used in `lib/rojo.js`'s `checkRojoInstalled`.

What requires manual verification instead (called out explicitly, not glossed over):
- Publishing a real test release (e.g. `v0.1.1`) and confirming a running `v0.1.0` build detects it, downloads on button click, and restarts into the new version. This should happen once during implementation and does not need to repeat on every future release once proven working.
