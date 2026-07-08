const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const {
  normalizeFolderArg,
  sanitizeConfig,
  sanitizeTerminalSpawnOptions,
} = require('../lib/ipc-guards');

const defaults = {
  defaultShell: 'powershell.exe',
  defaultCwd: os.tmpdir(),
};

test('sanitizeTerminalSpawnOptions accepts known terminal profiles', () => {
  const result = sanitizeTerminalSpawnOptions(
    {
      id: 'term-1',
      shell: 'powershell.exe',
      cols: 999,
      rows: 1,
      autoRun: 'claude',
    },
    defaults
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.id, 'term-1');
  assert.equal(result.value.shellPath, 'powershell.exe');
  assert.equal(result.value.cols, 400);
  assert.equal(result.value.rows, 5);
  assert.equal(result.value.autoRun, 'claude');
});

test('sanitizeTerminalSpawnOptions accepts the Rojo sync autorun profile', () => {
  const result = sanitizeTerminalSpawnOptions(
    { id: 'sync-1', shell: 'cmd.exe', autoRun: 'rojo serve' },
    defaults
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.autoRun, 'rojo serve');
});

test('sanitizeTerminalSpawnOptions rejects arbitrary shells and autorun commands', () => {
  assert.equal(
    sanitizeTerminalSpawnOptions({ id: 'term-2', shell: 'bash.exe' }, defaults).ok,
    false
  );
  assert.equal(
    sanitizeTerminalSpawnOptions(
      { id: 'term-3', shell: 'powershell.exe', autoRun: 'Remove-Item *' },
      defaults
    ).ok,
    false
  );
});

test('sanitizeTerminalSpawnOptions rejects invalid ids and missing folders', () => {
  assert.equal(
    sanitizeTerminalSpawnOptions({ id: '../term', shell: 'powershell.exe' }, defaults).ok,
    false
  );
  assert.equal(
    sanitizeTerminalSpawnOptions(
      { id: 'term-4', shell: 'powershell.exe', cwd: 'Z:/missing/baseplate/project' },
      defaults
    ).ok,
    false
  );
});

test('normalizeFolderArg resolves existing directories', () => {
  const result = normalizeFolderArg(os.tmpdir());
  assert.equal(result.ok, true);
  assert.equal(typeof result.folder, 'string');
});

test('sanitizeConfig strips invalid persisted widget data', () => {
  const result = sanitizeConfig({
    projectFolder: 42,
    widgets: [{ type: 'git-status', x: -5, y: 999, w: 99, h: 0, extra: 'drop' }, null],
  });

  assert.deepEqual(result, {
    projectFolder: null,
    widgets: [{ type: 'git-status', x: 0, y: 200, w: 12, h: 1 }],
  });
});
