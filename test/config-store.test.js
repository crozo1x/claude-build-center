const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { defaultConfig, loadConfig, saveConfig } = require('../lib/config-store');

test('loadConfig returns defaults when the file does not exist', () => {
  const filePath = path.join(os.tmpdir(), `config-store-test-${Date.now()}-missing.json`);
  const result = loadConfig(filePath);
  assert.deepEqual(result, defaultConfig());
});

test('saveConfig then loadConfig round-trips data', () => {
  const filePath = path.join(os.tmpdir(), `config-store-test-${Date.now()}-roundtrip.json`);
  const config = {
    projectFolder: 'C:\\Roblox\\MyGame',
    widgets: [{ type: 'git-status', x: 0, y: 0, w: 3, h: 3 }],
  };
  saveConfig(filePath, config);
  const result = loadConfig(filePath);
  assert.deepEqual(result, config);
  fs.unlinkSync(filePath);
});

test('loadConfig falls back to defaults on invalid JSON', () => {
  const filePath = path.join(os.tmpdir(), `config-store-test-${Date.now()}-invalid.json`);
  fs.writeFileSync(filePath, '{not valid json', 'utf8');
  const result = loadConfig(filePath);
  assert.deepEqual(result, defaultConfig());
  fs.unlinkSync(filePath);
});
