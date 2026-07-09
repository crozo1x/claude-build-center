const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyRojoLine } = require('../lib/rojo');

test('classifyRojoLine returns null for a blank line', () => {
  assert.equal(classifyRojoLine(''), null);
  assert.equal(classifyRojoLine('   '), null);
});

test('classifyRojoLine returns null for unrelated output', () => {
  assert.equal(classifyRojoLine('Watching for file changes...'), null);
});

test('classifyRojoLine detects a listening server with its port', () => {
  assert.deepEqual(
    classifyRojoLine('Rojo server listening on port 34872'),
    { type: 'listening', port: 34872 }
  );
});

test('classifyRojoLine detects a port-in-use error', () => {
  const result = classifyRojoLine('Error: address already in use (os error 10048)');
  assert.equal(result.type, 'error');
  assert.equal(result.reason, 'port-in-use');
});

test('classifyRojoLine detects a missing project file error', () => {
  const result = classifyRojoLine("Couldn't find project file default.project.json");
  assert.equal(result.type, 'error');
  assert.equal(result.reason, 'no-project-file');
});

test('classifyRojoLine falls back to unknown for other error lines', () => {
  const result = classifyRojoLine('Error: something unexpected happened');
  assert.equal(result.type, 'error');
  assert.equal(result.reason, 'unknown');
});
