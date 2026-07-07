const test = require('node:test');
const assert = require('node:assert/strict');
const { checkRojoInstalled } = require('../lib/rojo');

test('checkRojoInstalled reports installed with a version on success', async () => {
  const fakeExecFile = (cmd, args, cb) => cb(null, 'Rojo 7.4.0\n');
  const result = await checkRojoInstalled(fakeExecFile);
  assert.deepEqual(result, { installed: true, version: 'Rojo 7.4.0' });
});

test('checkRojoInstalled reports not installed when the binary is missing', async () => {
  const fakeExecFile = (cmd, args, cb) => cb(new Error('spawn rojo ENOENT'));
  const result = await checkRojoInstalled(fakeExecFile);
  assert.deepEqual(result, { installed: false });
});

test('checkRojoInstalled reports not installed when the command exits non-zero', async () => {
  const fakeExecFile = (cmd, args, cb) => cb(new Error('Command failed'));
  const result = await checkRojoInstalled(fakeExecFile);
  assert.deepEqual(result, { installed: false });
});
