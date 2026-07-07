const test = require('node:test');
const assert = require('node:assert/strict');
const { computeRojoStatus } = require('../renderer/lib/rojo-status');

test('computeRojoStatus is disconnected with no sessions', () => {
  assert.deepEqual(computeRojoStatus([]), { connected: false });
});

test('computeRojoStatus is disconnected when the sync session has exited', () => {
  const sessions = [{ kind: 'sync-to-studio', exited: true }];
  assert.deepEqual(computeRojoStatus(sessions), { connected: false });
});

test('computeRojoStatus is connected when a sync-to-studio session is running', () => {
  const sessions = [
    { kind: 'terminal', exited: false },
    { kind: 'sync-to-studio', exited: false },
  ];
  assert.deepEqual(computeRojoStatus(sessions), { connected: true });
});
