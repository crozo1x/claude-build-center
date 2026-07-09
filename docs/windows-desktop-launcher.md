# Windows Desktop Launcher

BasePlate can be launched by double-clicking a generated Desktop shortcut while the app is still being developed from this repo.

## Create The Shortcut

From the BasePlate repo root:

```powershell
npm run shortcut
```

This creates `BasePlate.lnk` on the current Windows user's Desktop. The shortcut uses `assets/icon.ico` and runs `scripts/launch-baseplate.ps1`.

## What The Launcher Does

The launcher checks for `dist\win-unpacked\BasePlate.exe` first. If it exists, BasePlate opens like a packaged desktop app.

If the unpacked EXE does not exist, the launcher falls back to `npm start` so agents and developers can still double-click into the local dev version.

## Useful Options

```powershell
npm run shortcut:pack
```

Builds `dist\win-unpacked\BasePlate.exe` first, then creates the Desktop shortcut.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1 -PreferDev
```

Creates a shortcut that always prefers the development launcher path, even if an unpacked EXE exists.

## Troubleshooting

- If the shortcut says dependencies are missing, run `npm install` from the repo root.
- If Windows cannot find `npm.cmd`, install Node.js and reopen PowerShell.
- If packaging fails on `node-pty`, install Python 3 and Visual Studio Build Tools with the C++ workload, then run `npm run rebuild`.