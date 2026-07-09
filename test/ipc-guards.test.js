const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const {
  normalizeFolderArg,
  sanitizeConfig,
  sanitizeTerminalIdPayload,
  sanitizeTerminalInputPayload,
  sanitizeTerminalResizePayload,
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

test('sanitizeTerminalSpawnOptions rejects renderer-supplied shell paths', () => {
  assert.equal(
    sanitizeTerminalSpawnOptions(
      { id: 'term-path', shell: 'C:\\Temp\\powershell.exe' },
      defaults
    ).ok,
    false
  );

  const defaultShellResult = sanitizeTerminalSpawnOptions(
    { id: 'term-default' },
    { defaultShell: 'C:\\Windows\\System32\\cmd.exe', defaultCwd: os.tmpdir() }
  );
  assert.equal(defaultShellResult.ok, true);
  assert.equal(defaultShellResult.value.shellPath, 'C:\\Windows\\System32\\cmd.exe');
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
    builder: { ideaText: '', chips: [], plan: null, scriptsTested: {} },
  });
});

test('sanitizeConfig preserves valid persisted builder state', () => {
  const result = sanitizeConfig({
    projectFolder: null,
    widgets: [],
    builder: {
      ideaText: 'a tycoon about running a bakery',
      chips: ['tycoon', 'leaderstats'],
      plan: { conceptSummary: 'x' },
      scriptsTested: { 'Leaderstats.server.lua': true },
    },
  });

  assert.deepEqual(result.builder, {
    ideaText: 'a tycoon about running a bakery',
    chips: ['tycoon', 'leaderstats'],
    plan: { conceptSummary: 'x' },
    scriptsTested: { 'Leaderstats.server.lua': true },
  });
});

test('sanitizeConfig defaults builder state when missing or malformed', () => {
  const missing = sanitizeConfig({ projectFolder: null, widgets: [] });
  assert.deepEqual(missing.builder, { ideaText: '', chips: [], plan: null, scriptsTested: {} });

  const malformed = sanitizeConfig({
    projectFolder: null,
    widgets: [],
    builder: { ideaText: 123, chips: 'not-an-array', plan: [1, 2, 3], scriptsTested: 'nope' },
  });
  assert.deepEqual(malformed.builder, { ideaText: '', chips: [], plan: null, scriptsTested: {} });
});

test('terminal control payload guards reject malformed renderer messages', () => {
  assert.equal(sanitizeTerminalIdPayload(null).ok, false);
  assert.equal(sanitizeTerminalIdPayload({ id: '../term' }).ok, false);
  assert.deepEqual(sanitizeTerminalIdPayload({ id: 'term:1_ok' }), { ok: true, id: 'term:1_ok' });

  assert.equal(sanitizeTerminalInputPayload({ id: 'term-1', data: Buffer.from('x') }).ok, false);
  assert.deepEqual(sanitizeTerminalInputPayload({ id: 'term-1', data: 'help\r' }), {
    ok: true,
    id: 'term-1',
    data: 'help\r',
  });
});

test('terminal resize payload guard clamps dimensions', () => {
  assert.deepEqual(sanitizeTerminalResizePayload({ id: 'term-1', cols: 1, rows: 999 }), {
    ok: true,
    id: 'term-1',
    cols: 20,
    rows: 200,
  });
});
