const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const os = require('os');
const pty = require('node-pty');

const terminals = new Map(); // id -> pty process
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#05070a',
    title: 'Build Center',
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
