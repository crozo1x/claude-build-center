const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGitStatus } = require('../lib/git-status');

test('parseGitStatus reports not a repo when branch output is empty', () => {
  const result = parseGitStatus('', '');
  assert.deepEqual(result, { isRepo: false });
});

test('parseGitStatus reports a clean repo', () => {
  const result = parseGitStatus('main\n', '');
  assert.deepEqual(result, { isRepo: true, branch: 'main', dirty: false, dirtyCount: 0 });
});

test('parseGitStatus reports a dirty repo with a file count', () => {
  const statusOutput = ' M renderer/style.css\n?? new-file.js\n';
  const result = parseGitStatus('feature/gui-modernization\n', statusOutput);
  assert.deepEqual(result, {
    isRepo: true,
    branch: 'feature/gui-modernization',
    dirty: true,
    dirtyCount: 2,
  });
});
