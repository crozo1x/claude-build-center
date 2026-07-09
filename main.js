const { app, BrowserWindow, ipcMain, Menu, dialog, shell, session } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pty = require('node-pty');
const { execFile } = require('child_process');
const { loadConfig, saveConfig } = require('./lib/config-store');
const { parseGitStatus } = require('./lib/git-status');
const { findPlaceFile } = require('./lib/find-place-file');
const { diagnoseProjectFolder } = require('./lib/project-doctor');
const { checkRojoInstalled, classifyRojoLine, checkRojoHealth } = require('./lib/rojo');
const {
  normalizeFolderArg,
  sanitizeConfig,
  sanitizeTerminalIdPayload,
  sanitizeTerminalInputPayload,
  sanitizeTerminalResizePayload,
  sanitizeTerminalSpawnOptions,
} = require('./lib/ipc-guards');
const { autoUpdater } = require('electron-updater');
const { attachUpdaterEvents } = require('./lib/updater');
const {
  buildSecurityHeaders,
  isExternalHttpUrl,
  shouldAllowNavigation,
} = require('./lib/security-policy');

const terminals = new Map(); // id -> pty process
const paneMeta = new Map(); // id -> { kind, cwd }
const rojoStatus = new Map(); // id -> { state, detail, port, folder }
const rojoHealthTimers = new Map(); // id -> interval handle
const paneLineBuffers = new Map(); // id -> trailing partial line
let mainWindow;
const configPath = path.join(app.getPath('userData'), 'config.json');

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
  if (mainWindow && isAuthoritativePane(id, folder)) {
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

function isAuthoritativePane(id, folder) {
  let matchId = null;
  for (const [pid, meta] of paneMeta.entries()) {
    if (meta.kind === 'sync-to-studio' && meta.cwd === folder) {
      matchId = pid;
    }
  }
  return matchId === id;
}

function hasLivePaneForFolder(folder) {
  for (const meta of paneMeta.values()) {
    if (meta.kind === 'sync-to-studio' && meta.cwd === folder) return true;
  }
  return false;
}

autoUpdater.autoDownload = false;

attachUpdaterEvents(autoUpdater, (state) => {
  if (mainWindow) mainWindow.webContents.send('update:status', { state });
  if (state === 'downloaded') {
    autoUpdater.quitAndInstall();
  }
});

function applyRendererSecurityPolicy() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: buildSecurityHeaders(details.responseHeaders) });
  });
}

function bindWindowSecurity(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (shouldAllowNavigation(url, __dirname)) return;
    event.preventDefault();
    if (isExternalHttpUrl(url)) shell.openExternal(url).catch(() => {});
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#05070a',
    title: 'BasePlate',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d1117',
      symbolColor: '#c9d1d9',
      height: 46,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  bindWindowSecurity(mainWindow);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  applyRendererSecurityPolicy();
  createWindow();
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // No published releases yet, or offline — fail silently, matching the
      // "no update available" UX rather than surfacing a startup error.
    });
  }, 5000);
});

app.on('window-all-closed', () => {
  for (const term of terminals.values()) {
    try {
      term.kill();
    } catch (e) {
      // ignore
    }
  }
  terminals.clear();
  for (const timer of rojoHealthTimers.values()) clearInterval(timer);
  rojoHealthTimers.clear();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('pty:spawn', (event, opts) => {
  const options = sanitizeTerminalSpawnOptions(opts, {
    defaultShell: process.env.COMSPEC || 'powershell.exe',
    defaultCwd: os.homedir(),
  });
  if (!options.ok) {
    return { ok: false, error: options.error };
  }

  const { id, shellPath, cwd, cols, rows, autoRun, kind } = options.value;
  if (terminals.has(id)) {
    return { ok: false, error: 'Terminal id is already in use' };
  }

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
  paneMeta.set(id, { kind, cwd: cwd || null });
  if (kind === 'sync-to-studio') {
    setRojoStatus(id, { state: 'starting' });
  }

  term.onData((data) => {
    if (mainWindow) mainWindow.webContents.send('pty:data', { id, data });

    const meta = paneMeta.get(id);
    if (meta && meta.kind === 'sync-to-studio') {
      const combined = (paneLineBuffers.get(id) || '') + data;
      const lines = combined.split(/\r?\n/);
      paneLineBuffers.set(id, lines.pop()); // last element has no trailing newline yet; keep it for next chunk
      lines.forEach((line) => {
        const parsed = classifyRojoLine(line);
        if (!parsed) return;

        if (parsed.type === 'listening') {
          clearRojoHealthTimer(id);
          setRojoStatus(id, { state: 'serving', detail: null, port: parsed.port });
          const timer = setInterval(async () => {
            const health = await checkRojoHealth(parsed.port);
            if (!paneMeta.has(id)) return;
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
      paneMeta.delete(id);
      rojoStatus.delete(id);
      paneLineBuffers.delete(id);
      if (mainWindow && !hasLivePaneForFolder(meta.cwd)) {
        mainWindow.webContents.send('rojo:status', { paneId: id, state: 'not-started', detail: null, port: null, folder: meta.cwd });
      }
    } else {
      paneMeta.delete(id);
    }
  });

  if (autoRun) {
    setTimeout(() => {
      if (terminals.has(id)) term.write(autoRun + '\r');
    }, 600);
  }

  return { ok: true };
});

ipcMain.on('pty:input', (event, payload) => {
  const input = sanitizeTerminalInputPayload(payload);
  if (!input.ok) return;
  const term = terminals.get(input.id);
  if (term) term.write(input.data);
});

ipcMain.on('pty:resize', (event, payload) => {
  const resize = sanitizeTerminalResizePayload(payload);
  if (!resize.ok) return;
  const term = terminals.get(resize.id);
  if (term) {
    try {
      term.resize(resize.cols, resize.rows);
    } catch (e) {
      // ignore resize races
    }
  }
});

ipcMain.on('pty:kill', (event, payload) => {
  const terminal = sanitizeTerminalIdPayload(payload);
  if (!terminal.ok) return;
  const term = terminals.get(terminal.id);
  if (term) {
    try {
      term.kill();
    } catch (e) {
      // ignore
    }
    terminals.delete(terminal.id);
  }
});

ipcMain.handle('config:load', () => {
  return sanitizeConfig(loadConfig(configPath));
});

ipcMain.handle('config:save', (event, config) => {
  saveConfig(configPath, sanitizeConfig(config));
  return { ok: true };
});

ipcMain.handle('project:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  return { canceled: false, folder: result.filePaths[0] };
});
ipcMain.handle('project:diagnose', (event, folder) => {
  const folderResult = normalizeFolderArg(folder);
  if (!folderResult.ok) {
    return {
      ok: false,
      summary: 'needs-setup',
      checks: [
        {
          id: 'folder-access',
          title: 'Project folder',
          status: 'blocker',
          detail: folderResult.error,
          action: 'Choose an existing Roblox project folder.',
        },
      ],
    };
  }
  return diagnoseProjectFolder(folderResult.folder);
});

ipcMain.handle('git:status', (event, folder) => {
  const folderResult = normalizeFolderArg(folder);
  if (!folderResult.ok) return { isRepo: false, error: folderResult.error };

  return new Promise((resolve) => {
    execFile('git', ['branch', '--show-current'], { cwd: folderResult.folder }, (branchErr, branchOut) => {
      if (branchErr) {
        resolve({ isRepo: false });
        return;
      }
      execFile('git', ['status', '--short'], { cwd: folderResult.folder }, (statusErr, statusOut) => {
        resolve(parseGitStatus(branchOut, statusErr ? '' : statusOut));
      });
    });
  });
});

ipcMain.handle('roblox:playTest', (event, folder) => {
  const folderResult = normalizeFolderArg(folder);
  if (!folderResult.ok) return { ok: false, error: folderResult.error };

  let files;
  try {
    files = fs.readdirSync(folderResult.folder);
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  const placeFile = findPlaceFile(files);
  if (!placeFile) {
    return { ok: false, error: 'No .rbxl or .rbxlx file found in project folder' };
  }
  shell.openPath(path.join(folderResult.folder, placeFile));
  return { ok: true };
});

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
