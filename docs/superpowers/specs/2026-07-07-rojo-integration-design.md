# Rojo Integration — Design Spec

**Date:** 2026-07-07
**Status:** Approved, pending implementation plan
**Follows:** GUI Modernization (merged, PR #1)

## Problem

The GUI Modernization pass added a "Sync to Studio" button and a "Rojo Sync
Status" widget, but both are stubs:

- "Sync to Studio" spawns a terminal pane running `rojo serve`, but nothing
  reads its output.
- "Rojo Sync Status" (`renderer/lib/rojo-status.js`) fakes its answer by
  checking whether that pane's process is still alive — it has no idea
  whether Rojo actually started successfully, is healthy, or ever will be if
  Rojo isn't even installed.
- "Play/Test" (`roblox:playTest` in `main.js`) opens the project's `.rbxl`
  file directly via the OS file association, entirely bypassing Rojo. A user
  can "test" a stale, unsynced place without any warning.

Goal: replace the fake status with real detection, and make the two
Roblox-facing actions (Sync to Studio, Play/Test) aware of that real state.
This is aimed at external users of the app, not just personal use, so
failure modes (Rojo missing, port conflict, no project file) need to be
surfaced clearly rather than silently shown as "not syncing."

## Scope

**In scope:**
- Detect whether the `rojo` CLI is installed and reachable on PATH.
- Classify `rojo serve`'s output into a real status (starting / serving /
  specific error), replacing the alive-check fake.
- Poll Rojo's local HTTP API once serving starts, to distinguish "process
  alive" from "server actually healthy."
- Show inline install guidance (message + link) when Rojo is missing —
  no auto-install.
- Make Play/Test check current Rojo status and warn (non-blocking) if the
  project isn't currently serving.

**Out of scope (explicitly not doing):**
- Auto-installing Rojo (e.g. shelling out to Aftman/Foreman) — link only.
- Detecting whether Roblox Studio's plugin specifically connected. Rojo does
  not expose a connected-client count via its HTTP API; "connected" in this
  design means "the Rojo server is up and answering," not "Studio is
  definitely open." The status widget's copy must reflect this distinction
  (e.g. "Serving" rather than "Studio Connected").
- Any change to how `.rbxl`/`.rbxlx` files are located (`lib/find-place-file.js`
  is unchanged).

## Architecture

New module `lib/rojo.js` (main process), replacing the renderer-side fake
`renderer/lib/rojo-status.js`:

- `checkRojoInstalled()` — runs `rojo --version` via `execFile`. Resolves
  `{ installed: true, version }` or `{ installed: false }`. Missing binary
  and non-zero exit are both treated as `installed: false`.
- `classifyRojoLine(line)` — pure function. Takes one line of `rojo serve`
  stdout/stderr, returns one of:
  - `{ type: 'listening', port }` — server bound and ready
  - `{ type: 'error', reason: 'port-in-use' | 'no-project-file' | 'unknown', raw }`
  - `null` — line carries no status-relevant information (ignored)
- `checkRojoHealth(port)` — issues a GET to `http://localhost:<port>/api/rojo`
  via Node's `http` module with a short timeout. Resolves
  `{ healthy: true, projectName }` on a valid JSON response, otherwise
  `{ healthy: false }`.

These three functions are pure/mockable and independently testable, matching
the existing `lib/git-status.js` / `lib/find-place-file.js` pattern.

## Status state machine

States, in order: `not-installed → not-started → starting → serving → error`.

Tracked per pane in a `Map<paneId, status>` inside `main.js` (mirrors how
`terminals` is already tracked for pty processes). Transitions:

1. Before spawning a `sync-to-studio` pane, `main.js` calls
   `checkRojoInstalled()`. If `installed: false`, the pane is not spawned;
   renderer shows install guidance instead (see below). Status: `not-installed`.
2. On spawn, status starts at `starting`.
3. The existing `pty:data` handler (main.js:~77) already sees raw output
   before forwarding to the renderer. For panes with `kind: 'sync-to-studio'`,
   each chunk is split into lines and run through `classifyRojoLine`:
   - `listening` → status becomes `serving`, and a 3-second interval begins
     calling `checkRojoHealth(port)`.
     - Health check ok → stays `serving`.
     - Health check fails → status becomes `error` (detail: "server stopped responding").
   - `error` → status becomes `error` (detail: the classified reason),
     interval (if any) is cleared.
4. When the pane exits or is killed, status resets to `not-started` and any
   health-check interval is cleared.

Status changes push to the renderer via a new `rojo:status` IPC event,
`{ paneId, state, detail, port }` — replacing the current pull-based
`computeRojoStatus(sessions)` call in `renderer/widgets.js`. The renderer
keeps a small in-memory map of latest status per pane (same pattern as
existing `onSessionsChanged`/`onProjectFolderChanged` subscriptions) and the
"Rojo Sync Status" widget subscribes to it directly instead of recomputing
from session list.

## Install guidance

When "Sync to Studio" is clicked and `checkRojoInstalled()` returns
`installed: false`:
- No pane is spawned (no point running a command that will just fail).
- The toolbar/widget area shows inline text: "Rojo not found — see the
  [Rojo install guide]" linking to Rojo's official install docs.
- This is the only Rojo-missing UX — no bundled installer, no shell-out to
  package managers.

## Play/Test awareness

`roblox:playTest(folder)` gains one check before opening the file: find the
most recent `sync-to-studio` pane whose `cwd` equals `folder` (session state
already tracks `kind`/`cwd` per pane, from Task 9 of the GUI Modernization
plan) and look up its tracked Rojo status.
- If status is `serving`, behavior is unchanged.
- If status is anything else (`not-started`, `starting`, `error`, or no
  matching pane at all), the file still opens (Play/Test is not blocked —
  users can legitimately test without Rojo running), but the renderer flags
  a warning.

There's no existing toast/notification component — today's only precedent
is a blocking `alert()` on Play/Test failure (`renderer/renderer.js:169`),
which is too disruptive for a non-blocking warning. This design adds one
new small piece: a `#toolbarNotice` element (plain div, styled like the
existing disabled-state/toolbar treatment from the GUI Modernization visual
pass) that shows a dismissible one-line warning for ~4 seconds. No new
dependency — this is the only new visual-facing element in an otherwise
logic-only feature, and it's simple enough to build and verify by eye during
implementation without needing a dedicated design pass.

## Testing

Following the existing `test/*.test.js` pattern (`node --test`):
- `test/rojo-classify.test.js` — table of sample `rojo serve` output lines
  (including real Rojo phrasing for "listening on port", "address already
  in use", "no project file found") asserted against `classifyRojoLine`.
- `test/rojo-health.test.js` — mocks `http.get` to return valid/invalid/
  timeout responses, asserts `checkRojoHealth` classification.
- `test/rojo-installed.test.js` — mocks `execFile` success/failure/missing-
  binary cases, asserts `checkRojoInstalled` output.

No new UI/visual test coverage — the widget rendering itself is simple
enough (text + CSS class swap, same shape as the current implementation)
to verify by eye during a home session, per the split of "logic now, visual
polish/verification later" agreed for this round of phone-only work.
