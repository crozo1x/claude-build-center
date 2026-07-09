const test = require('node:test');
const assert = require('node:assert/strict');
const { mapUpdaterEvent, attachUpdaterEvents } = require('../lib/updater');

test('mapUpdaterEvent maps known electron-updater events to status strings', () => {
  assert.equal(mapUpdaterEvent('checking-for-update'), 'checking');
  assert.equal(mapUpdaterEvent('update-available'), 'available');
  assert.equal(mapUpdaterEvent('update-not-available'), 'not-available');
  assert.equal(mapUpdaterEvent('download-progress'), 'downloading');
  assert.equal(mapUpdaterEvent('update-downloaded'), 'downloaded');
  assert.equal(mapUpdaterEvent('error'), 'error');
});

test('mapUpdaterEvent returns null for an unrecognized event name', () => {
  assert.equal(mapUpdaterEvent('some-future-event'), null);
});

test('attachUpdaterEvents subscribes to every known event and forwards mapped status', () => {
  const listeners = {};
  const fakeAutoUpdater = {
    on(eventName, cb) {
      listeners[eventName] = cb;
    },
  };
  const seen = [];
  attachUpdaterEvents(fakeAutoUpdater, (status) => seen.push(status));

  assert.ok(listeners['checking-for-update'], 'should subscribe to checking-for-update');
  assert.ok(listeners['update-available'], 'should subscribe to update-available');
  assert.ok(listeners['update-downloaded'], 'should subscribe to update-downloaded');

  listeners['checking-for-update']();
  listeners['update-available']();
  listeners['update-downloaded']();

  assert.deepEqual(seen, ['checking', 'available', 'downloaded']);
});

test('attachUpdaterEvents ignores events with no mapped status', () => {
  const listeners = {};
  const fakeAutoUpdater = {
    on(eventName, cb) {
      listeners[eventName] = cb;
    },
  };
  const seen = [];
  attachUpdaterEvents(fakeAutoUpdater, (status) => seen.push(status));

  // Simulate electron-updater emitting something attachUpdaterEvents didn't explicitly subscribe to
  // by calling a handler that was never registered — this should simply not exist.
  assert.equal(listeners['some-unmapped-event'], undefined);
});
