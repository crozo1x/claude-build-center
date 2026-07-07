const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pty = require('node-pty');
const { execFile } = require('child_process');
const { loadConfig, saveConfig } = require('./lib/config-store');
const { parseGitStatus } = require('./lib/git-status');
const { findPlaceFile } = require('./lib/find-place-file');

const terminals = new Map(); // id -> pty process
let mainWindow;
const configPath = path.join(app.getPath('userData'), 'config.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#05070a',
    title: 'BasePlate',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
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
  const { id, shell, cwd, cols, rows, autoRun } = opts;
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
  saveConfig(configPath, config);
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
