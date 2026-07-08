const fs = require('fs');
const path = require('path');

const ALLOWED_SHELLS = new Set(['cmd.exe', 'powershell.exe', 'pwsh.exe']);
const ALLOWED_AUTORUN = new Set(['claude', 'rojo serve']);
const SESSION_ID_RE = /^[a-zA-Z0-9:_-]{1,96}$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toBoundedInt(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function normalizeShell(shell, defaultShell) {
  const shellPath = typeof shell === 'string' && shell.trim() ? shell.trim() : defaultShell;
  const basename = path.basename(shellPath).toLowerCase();
  if (!ALLOWED_SHELLS.has(basename)) {
    return { ok: false, error: `Unsupported shell: ${basename || 'unknown'}` };
  }
  return { ok: true, shellPath };
}

function normalizeFolderArg(folder) {
  if (typeof folder !== 'string' || folder.trim().length === 0) {
    return { ok: false, error: 'Expected a project folder path' };
  }
  const normalized = path.resolve(folder);
  try {
    if (!fs.statSync(normalized).isDirectory()) {
      return { ok: false, error: 'Project folder path is not a directory' };
    }
  } catch (err) {
    return { ok: false, error: 'Project folder path does not exist' };
  }
  return { ok: true, folder: normalized };
}

function normalizeCwd(cwd, defaultCwd) {
  if (cwd === undefined || cwd === null || cwd === '') {
    return normalizeFolderArg(defaultCwd);
  }
  return normalizeFolderArg(cwd);
}

function normalizeAutoRun(autoRun) {
  if (autoRun === undefined || autoRun === null || autoRun === '') {
    return { ok: true, autoRun: null };
  }
  if (typeof autoRun !== 'string' || !ALLOWED_AUTORUN.has(autoRun)) {
    return { ok: false, error: 'Unsupported terminal autorun command' };
  }
  return { ok: true, autoRun };
}

function sanitizeTerminalSpawnOptions(opts, defaults) {
  if (!isPlainObject(opts)) {
    return { ok: false, error: 'Expected terminal options' };
  }
  if (typeof opts.id !== 'string' || !SESSION_ID_RE.test(opts.id)) {
    return { ok: false, error: 'Invalid terminal id' };
  }

  const shellResult = normalizeShell(opts.shell, defaults.defaultShell);
  if (!shellResult.ok) return shellResult;

  const cwdResult = normalizeCwd(opts.cwd, defaults.defaultCwd);
  if (!cwdResult.ok) return cwdResult;

  const autoRunResult = normalizeAutoRun(opts.autoRun);
  if (!autoRunResult.ok) return autoRunResult;

  return {
    ok: true,
    value: {
      id: opts.id,
      shellPath: shellResult.shellPath,
      cwd: cwdResult.folder,
      cols: toBoundedInt(opts.cols, 80, 20, 400),
      rows: toBoundedInt(opts.rows, 30, 5, 200),
      autoRun: autoRunResult.autoRun,
    },
  };
}

function sanitizeWidget(widget) {
  if (!isPlainObject(widget)) return null;
  if (typeof widget.type !== 'string' || widget.type.length > 80) return null;
  return {
    type: widget.type,
    x: toBoundedInt(widget.x, 0, 0, 48),
    y: toBoundedInt(widget.y, 0, 0, 200),
    w: toBoundedInt(widget.w, 3, 1, 12),
    h: toBoundedInt(widget.h, 3, 1, 20),
  };
}

function sanitizeConfig(config) {
  if (!isPlainObject(config)) {
    return { projectFolder: null, widgets: [] };
  }
  const projectFolder =
    typeof config.projectFolder === 'string' && config.projectFolder.trim()
      ? config.projectFolder
      : null;
  const widgets = Array.isArray(config.widgets)
    ? config.widgets.slice(0, 50).map(sanitizeWidget).filter(Boolean)
    : [];
  return { projectFolder, widgets };
}

module.exports = {
  sanitizeConfig,
  sanitizeTerminalSpawnOptions,
  normalizeFolderArg,
};
