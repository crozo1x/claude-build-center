# Release QA — 2026-07-09

**Scope:** Release readiness for the first real Windows build. No new product features. Builder Coach content untouched.

**Checkout:** fresh worktree at `agent/release-qa`, branched from `origin/main` at commit `c14d45f` (`Merge pull request #2 from crozo1x/feature/rojo-integration`) — includes the Roblox Builder Coach MVP (#11), Rojo Integration (#2), and the just-merged launch-time auto-spawn fix (#20).

**Machine:** real Windows 11 desktop (not CI), Node v24.12.0, npm 11.6.2.

## Summary

**No release-blocking bugs found.** The build, install, and full builder/terminal/Rojo smoke test all pass. One non-blocking UX-consistency issue is documented below as a recommended fast-follow, not fixed here (see "Findings").

## 1–2. Pull latest main, install dependencies

```
git fetch origin main
git worktree add .worktrees/release-qa -b agent/release-qa origin/main
cd .worktrees/release-qa
npm ci
```

Result: **PASS.** 375 packages installed, 0 install errors. `npm audit` flags 6 high-severity advisories — see "Dependency audit" below (not fixed, per scope: "do not touch dependency versions unless explicitly required").

## 3. Test suite

```
npm test
```

Result: **PASS — 64/64 tests**, 0 failures. Suite covers `plan-generator`, `debug-matcher`, `config-store`, `ipc-guards` (including the pane-`kind` and terminal-payload guards), `git-status`, `find-place-file`, `rojo` (classify/health/installed), `security-policy`, and `updater`.

## 4. Windows installer build

```
npm run dist:win
```

Result: **PASS.** Ran `scripts/generate-icon.js` (regenerated `assets/icon.{svg,png,ico}`), then `electron-builder --win --publish never`. Output:

- `dist/BasePlate-Setup-0.1.2.exe` (81,477,242 bytes)
- `dist/BasePlate-Setup-0.1.2.exe.blockmap`
- `dist/win-unpacked/` (unpacked build, `BasePlate.exe` + resources)
- `dist/latest.yml`, `dist/builder-debug.yml`

**Installer artifact confirmed present** (task step 3): `dist/BasePlate-Setup-0.1.2.exe` exists and is a valid NSIS installer.

**Signing status:** confirmed via `Get-AuthenticodeSignature` — `Status: NotSigned`. This matches `RELEASE_RUNBOOK.md`'s documented expectation (unsigned installer, SmartScreen warning expected). electron-builder's build log shows `signing with signtool.exe` lines, but these do not indicate an actual Authenticode signature was applied (no code-signing certificate is configured in this repo) — verified directly against the built artifact, not just the log.

**Icon:** `assets/icon.ico` is a real multi-resolution icon (6 sizes, 16×16 through at least 32×32, RGBA PNG-compressed frames) — not a placeholder. `package.json`'s `build.win.icon` correctly points to it.

## 5. Install and smoke test

### Install

Installed via silent NSIS install for reproducible, non-interactive verification:

```powershell
Start-Process -FilePath "dist\BasePlate-Setup-0.1.2.exe" -ArgumentList "/S" -PassThru -Wait
# Exit code: 0
```

Verified post-install:
- **Desktop shortcut** (`%USERPROFILE%\Desktop\BasePlate.lnk`): exists, target `C:\Users\<user>\AppData\Local\Programs\BasePlate\BasePlate.exe` resolves to a real file, icon reference present. **Confirmed working**, not just present.
- **Start Menu shortcut**: exists at `%APPDATA%\Microsoft\Windows\Start Menu\Programs\BasePlate.lnk`.
- **Registry uninstall entry**: `BasePlate 0.1.2`, correct version, publisher `crozo1x`, valid uninstaller path (`Uninstall BasePlate.exe" /currentuser`).
- **Install location**: `%LOCALAPPDATA%\Programs\BasePlate` (per-user install, no admin elevation required — matches `nsis.perMachine: false`).

### Automated smoke test

No native desktop-automation tool was available, so the actual **installed** `BasePlate.exe` was driven end-to-end with Playwright's `_electron` module (ad hoc `npm install --no-save playwright` in a scratch directory outside the repo — not added to `package.json`/`package-lock.json`). This exercises the real packaged renderer and real `node-pty` processes, not `npm start` dev mode.

**27/27 automated checks passed:**

| # | Check | Result |
|---|---|---|
| 1 | App process launches from installed EXE | PASS |
| 2 | Main window opens | PASS (title: "BasePlate") |
| 3 | No terminal auto-spawned on cold launch | PASS (0 panes at launch — regression check for the just-merged #20 fix) |
| 4 | Idea tab active by default | PASS |
| 5–9 | All 5 tabs (Idea/Plan/Scripts/Debug/Advanced) become active on click | PASS |
| 10 | Idea tab has textarea + all 10 genre/feature chips | PASS |
| 11 | Scripts tab renders all 4 script cards | PASS |
| 12 | Debug tab has input + Diagnose button | PASS |
| 13 | "+ Terminal" opens a pane | PASS |
| 14 | New terminal pane shows real shell output | PASS (`"Windows PowerShell\nCopyright (C) Microsoft Corporation..."` captured live) |
| 15 | Plain "+ Terminal" does not auto-launch Claude | PASS |
| 16 | "Ask Claude" opens a second pane without crashing the app | PASS |
| 17 | App renderer still responsive after Ask Claude pane opens | PASS |
| 18 | Set Project Folder updates label (native dialog stubbed for automation) | PASS |
| 19 | Play/Test button enables once a folder is set | PASS |
| 20 | Sync to Studio button enables once a folder is set | PASS |
| 21 | Play/Test with missing place file does not call `shell.openPath` | PASS |
| 22 | Play/Test with missing place file surfaces a clear message | PASS — see Finding 1 below |
| 23 | Play/Test with a present `.rbxl` file calls `shell.openPath` on exactly that file | PASS |
| 24 | Widget picker opens | PASS |
| 25 | Rojo Sync Status widget option present in picker | PASS |
| 26 | Sync to Studio shows install guidance when Rojo is genuinely not installed | PASS (real, unstubbed check — Rojo is not on PATH on this machine; notice text: *"Rojo not found — see the install guide"*) |
| 27 | Rojo Sync Status widget shows a useful sync-state label | PASS (`"Not syncing"` — correct default; see note below) |

**Note on Rojo widget scope:** the widget intentionally shows only sync state (not-started/starting/serving/error), not install state — install detection is a separate, on-demand check triggered by "Sync to Studio" (check 26). This is a documented design decision in `renderer/widgets.js` (`renderRojoStatus` comment), not a gap.

### Process cleanup verification

A separate, targeted check confirmed no orphaned processes after app close: captured the real descendant PIDs (conpty host + shell) of the running app's main process while a terminal pane was open, closed the app, and re-checked those exact PIDs 5 seconds later.

```
Descendant PIDs while running: [ 38476, 24152, 37220, 30748, 40532 ]
Still alive after close + 5s: []
RESULT: PASS - all pty descendant processes cleaned up on close
```

(An earlier naive check using `Get-Process | Where ProcessName -match powershell` produced false-positive "lingering process" noise — that was catching the PowerShell tool's own per-command host process, not anything BasePlate spawned. The targeted PID-tracking check above is the reliable result.)

## Findings

### Finding 1 (non-blocking, not fixed): Play/Test's missing-file error uses a native `alert()` instead of the app's own toast pattern

`renderer/renderer.js`, `btnPlayTest` click handler:

```js
if (!result.ok) {
  alert('Play/Test failed: ' + result.error);
  return;
}
if (status.state !== 'serving') {
  showToolbarNotice("Rojo isn't syncing — this may open a stale place.", 4000);
}
```

The missing-file case (`alert(...)`) uses a blocking native dialog, while the very next branch (`status.state !== 'serving'`) uses the app's own non-blocking `showToolbarNotice(...)` pattern — the same pattern used everywhere else in this file (Sync to Studio's install guidance, the staleness warning). The `alert()` message itself is accurate and clear (*"Play/Test failed: No .rbxl or .rbxlx file found in project folder"*), so this does not fail the "handles missing files clearly" bar on content — it's a UX-consistency and modal-blocking issue, not a correctness bug.

**Not fixed in this pass**, per the QA scope ("fix only release-blocking bugs, keep changes small"). Recommend a follow-up: replace the `alert(...)` call with `showToolbarNotice(result.error, null)` (persistent, dismissed on click, matching the Sync to Studio pattern) — a 2-line change, low risk, but out of scope for a release-readiness pass since it doesn't block shipping.

### Dependency audit (not fixed, informational only)

`npm audit` reports 6 high-severity advisories, all in **devDependencies / build tooling**, not runtime app code shipped to users:

- `@electron/node-gyp`, `@electron/rebuild`, `cacache`, `make-fetch-happen`, `tar` — all transitive build-time tooling (native module rebuild chain). Not present in the packaged app.
- `electron` itself (pinned `^31.3.0`) — flagged for several CVEs fixed in later Electron majors (ASAR integrity, various use-after-free issues, IPC spoofing, etc.). This one **does** ship to users (it's the runtime), so it's worth a maintainer's attention — but bumping Electron's major version is a real compatibility-risk change (native module ABI, `node-pty` rebuild, testing surface) that shouldn't be done inside a QA pass. Flagging for a dedicated, deliberate upgrade task, not fixing here per "do not touch dependency versions unless explicitly required."

## Commands run (verbatim, for reproducibility)

```bash
git fetch origin main
git worktree add .worktrees/release-qa -b agent/release-qa origin/main
npm ci
npm test
npm run dist:win
```

```powershell
Get-AuthenticodeSignature "dist\BasePlate-Setup-0.1.2.exe"
Start-Process -FilePath "dist\BasePlate-Setup-0.1.2.exe" -ArgumentList "/S" -PassThru -Wait
```

```bash
# in a scratch dir outside the repo (not added to package.json)
npm install --no-save playwright@latest
node qa-smoke.js         # 27/27 checks, drives the installed EXE end-to-end
node pty-cleanup-check.js  # targeted descendant-PID leak check
```

## Verdict

**Ready to release from a QA standpoint.** No release-blocking bugs found. `npm test` (64/64), the Windows installer build, the real silent install (shortcuts, registry, icon), and a 27-point automated smoke test against the actual installed EXE all pass. One non-blocking UX-consistency recommendation is logged above for a future fast-follow.
