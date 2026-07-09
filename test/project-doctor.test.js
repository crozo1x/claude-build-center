const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { diagnoseProjectFolder } = require('../lib/project-doctor');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'baseplate-project-doctor-'));
}

function cleanup(folder) {
  fs.rmSync(folder, { recursive: true, force: true });
}

test('diagnoseProjectFolder reports missing paths as setup blockers', () => {
  const missingPath = path.join(os.tmpdir(), 'baseplate-missing-' + Date.now());
  const result = diagnoseProjectFolder(missingPath);
  assert.equal(result.ok, false);
  assert.equal(result.summary, 'needs-setup');
  assert.equal(result.checks[0].status, 'blocker');
});

test('diagnoseProjectFolder recognizes a ready Rojo-backed Roblox project', () => {
  const folder = makeTempProject();
  try {
    fs.writeFileSync(path.join(folder, 'default.project.json'), '{}');
    fs.writeFileSync(path.join(folder, 'Game.rbxlx'), '<roblox></roblox>');
    fs.mkdirSync(path.join(folder, 'src'));
    fs.mkdirSync(path.join(folder, 'src', 'server'), { recursive: true });
    fs.mkdirSync(path.join(folder, '.git'));

    const result = diagnoseProjectFolder(folder);
    assert.equal(result.ok, true);
    assert.equal(result.summary, 'ready');
    assert.equal(result.checks.find((check) => check.id === 'place-file').status, 'ok');
    assert.equal(result.checks.find((check) => check.id === 'rojo-config').status, 'ok');
    assert.equal(result.checks.find((check) => check.id === 'source-layout').status, 'ok');
    assert.equal(result.checks.find((check) => check.id === 'git-repo').status, 'ok');
  } finally {
    cleanup(folder);
  }
});

test('diagnoseProjectFolder gives actionable warnings for a bare folder', () => {
  const folder = makeTempProject();
  try {
    const result = diagnoseProjectFolder(folder);
    assert.equal(result.ok, true);
    assert.equal(result.summary, 'review');
    const warnings = result.checks.filter((check) => check.status === 'warning');
    assert.equal(warnings.length, 4);
    assert.ok(warnings.every((check) => typeof check.action === 'string' && check.action.length > 0));
  } finally {
    cleanup(folder);
  }
});

test('diagnoseProjectFolder accepts Roblox service folders as source layout', () => {
  const folder = makeTempProject();
  try {
    fs.mkdirSync(path.join(folder, 'ServerScriptService'));
    const result = diagnoseProjectFolder(folder);
    assert.equal(result.checks.find((check) => check.id === 'source-layout').status, 'ok');
  } finally {
    cleanup(folder);
  }
});