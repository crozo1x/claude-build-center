const test = require('node:test');
const assert = require('node:assert/strict');
const { SCRIPT_TEMPLATES } = require('../renderer/scripts-data');

const VALID_TYPES = ['Script', 'LocalScript', 'ModuleScript'];

test('every script template has the required fields, non-empty', () => {
  SCRIPT_TEMPLATES.forEach((script) => {
    assert.equal(typeof script.filename, 'string');
    assert.ok(script.filename.length > 0, `${script.filename}: filename`);
    assert.equal(typeof script.path, 'string');
    assert.ok(script.path.length > 0, `${script.filename}: path`);
    assert.equal(typeof script.purpose, 'string');
    assert.ok(script.purpose.length > 0, `${script.filename}: purpose`);
    assert.equal(typeof script.code, 'string');
    assert.ok(script.code.length > 0, `${script.filename}: code`);
    assert.ok(VALID_TYPES.includes(script.type), `${script.filename}: type "${script.type}" is not a valid Roblox script type`);
    assert.ok(Array.isArray(script.testingChecklist), `${script.filename}: testingChecklist`);
    assert.ok(script.testingChecklist.length > 0, `${script.filename}: testingChecklist should not be empty`);
    script.testingChecklist.forEach((step) => {
      assert.equal(typeof step, 'string');
      assert.ok(step.length > 0);
    });
  });
});

test('script filenames end in the suffix matching their declared type', () => {
  SCRIPT_TEMPLATES.forEach((script) => {
    if (script.type === 'Script') {
      assert.match(script.filename, /\.server\.lua$/, `${script.filename} should end in .server.lua`);
    } else if (script.type === 'LocalScript') {
      assert.match(script.filename, /\.client\.lua$/, `${script.filename} should end in .client.lua`);
    } else if (script.type === 'ModuleScript') {
      assert.doesNotMatch(script.filename, /\.(server|client)\.lua$/, `${script.filename} (ModuleScript) should not use a .server/.client suffix`);
      assert.match(script.filename, /\.lua$/, `${script.filename} should end in .lua`);
    }
  });
});

test('script path ends with the filename', () => {
  SCRIPT_TEMPLATES.forEach((script) => {
    assert.ok(script.path.endsWith(script.filename), `${script.path} should end with ${script.filename}`);
  });
});

test('no two script templates share the same Explorer path', () => {
  const paths = SCRIPT_TEMPLATES.map((s) => s.path);
  assert.equal(new Set(paths).size, paths.length);
});

test('every ModuleScript template ends its code with a return statement', () => {
  SCRIPT_TEMPLATES.filter((s) => s.type === 'ModuleScript').forEach((script) => {
    assert.match(script.code.trim(), /return \w+\s*$/, `${script.filename}: ModuleScript should return a value`);
  });
});

test('covers all three Roblox script types across the library', () => {
  const types = new Set(SCRIPT_TEMPLATES.map((s) => s.type));
  VALID_TYPES.forEach((type) => {
    assert.ok(types.has(type), `no template uses type "${type}"`);
  });
});
