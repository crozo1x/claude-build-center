const test = require('node:test');
const assert = require('node:assert/strict');
const { findPlaceFile } = require('../lib/find-place-file');

test('findPlaceFile returns null when no place file is present', () => {
  assert.equal(findPlaceFile(['README.md', 'default.project.json']), null);
});

test('findPlaceFile finds an .rbxlx file', () => {
  assert.equal(findPlaceFile(['default.project.json', 'MyGame.rbxlx']), 'MyGame.rbxlx');
});

test('findPlaceFile finds an .rbxl file', () => {
  assert.equal(findPlaceFile(['MyGame.rbxl', 'README.md']), 'MyGame.rbxl');
});
