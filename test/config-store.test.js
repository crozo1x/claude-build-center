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
    builder: {
      ideaText: 'a tycoon about running a bakery',
      chips: ['tycoon', 'leaderstats'],
      plan: null,
      scriptsTested: { 'Leaderstats.server.lua': true },
    },
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

test('loadConfig defaults builder state when missing from an older config file', () => {
  const filePath = path.join(os.tmpdir(), `config-store-test-${Date.now()}-legacy.json`);
  fs.writeFileSync(filePath, JSON.stringify({ projectFolder: 'C:\\Old', widgets: [] }), 'utf8');
  const result = loadConfig(filePath);
  assert.deepEqual(result.builder, { ideaText: '', chips: [], plan: null, scriptsTested: {} });
  fs.unlinkSync(filePath);
});

test('loadConfig defaults builder state when it is present but malformed', () => {
  const filePath = path.join(os.tmpdir(), `config-store-test-${Date.now()}-malformed.json`);
  fs.writeFileSync(filePath, JSON.stringify({ projectFolder: null, widgets: [], builder: 'not an object' }), 'utf8');
  const result = loadConfig(filePath);
  assert.deepEqual(result.builder, { ideaText: '', chips: [], plan: null, scriptsTested: {} });
  fs.unlinkSync(filePath);
});

test('loadConfig defaults plan to null when it is an array instead of an object', () => {
  const filePath = path.join(os.tmpdir(), `config-store-test-${Date.now()}-plan-array.json`);
  fs.writeFileSync(filePath, JSON.stringify({ projectFolder: null, widgets: [], builder: { plan: [1, 2, 3] } }), 'utf8');
  const result = loadConfig(filePath);
  assert.equal(result.builder.plan, null);
  fs.unlinkSync(filePath);
});
