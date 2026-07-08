const { app, BrowserWindow, ipcMain, Menu, dialog, shell, session } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pty = require('node-pty');
const { execFile } = require('child_process');
const { loadConfig, saveConfig } = require('./lib/config-store');
const { parseGitStatus } = require('./lib/git-status');
const { findPlaceFile } = require('./lib/find-place-file');
const {
  normalizeFolderArg,
  sanitizeConfig,
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
let mainWindow;
const configPath = path.join(app.getPath('userData'), 'config.json');

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

  const { id, shellPath, cwd, cols, rows, autoRun } = options.value;
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

  term.onData((data) => {
    if (mainWindow) mainWindow.webContents.send('pty:data', { id, data });
  });

  term.onExit(({ exitCode }) => {
    if (mainWindow) mainWindow.webContents.send('pty:exit', { id, code: exitCode });
    terminals.delete(id);
  });

  if (autoRun) {
    setTimeout(() => {
      if (terminals.has(id)) term.write(autoRun + '\r');
    }, 600);
  }

  return { ok: true };
});

ipcMain.on('pty:input', (event, { id, data }) => {
  const term = terminals.get(id);
  if (term) term.write(data);
});

ipcMain.on('pty:resize', (event, { id, cols, rows }) => {
  const term = terminals.get(id);
  if (term && cols > 0 && rows > 0) {
    try {
      term.resize(cols, rows);
    } catch (e) {
      // ignore resize races
    }
  }
});

ipcMain.on('pty:kill', (event, { id }) => {
  const term = terminals.get(id);
  if (term) {
    try {
      term.kill();
    } catch (e) {
      // ignore
    }
    terminals.delete(id);
  }
});

ipcMain.handle('config:load', () => {
  return loadConfig(configPath);
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
