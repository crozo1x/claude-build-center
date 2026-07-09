const test = require('node:test');
const assert = require('node:assert/strict');
const { matchError } = require('../lib/debug-matcher');

test('matchError recognizes "attempt to index nil"', () => {
  const result = matchError('ServerScriptService.Leaderstats:5: attempt to index nil with \'Name\'');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'index-nil');
  assert.match(result.problem, /nil/i);
  assert.match(result.likelyCause, /didn't exist|wasn't there|expected to already exist/i);
  assert.ok(result.fixSteps.some((step) => /WaitForChild/.test(step)));
  assert.match(result.testNext, /same line no longer errors/i);
});

test('matchError recognizes "is not a valid member of"', () => {
  const result = matchError('Workspace.Part is not a valid member of Model "Workspace"');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'not-valid-member');
  assert.match(result.problem, /child object or property/i);
  assert.match(result.likelyCause, /renamed|misspelled/i);
  assert.ok(result.fixSteps.some((step) => /capitalization/i.test(step)));
  assert.match(result.testNext, /Explorer at runtime/i);
});

test('matchError recognizes "Infinite yield possible"', () => {
  const result = matchError('Infinite yield possible on \'ReplicatedStorage:WaitForChild("RemoteEvent")\'');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'infinite-yield');
  assert.match(result.problem, /WaitForChild/i);
  assert.match(result.likelyCause, /never appears|client\/server boundary/i);
  assert.ok(result.fixSteps.some((step) => /client for something only the server creates/i.test(step)));
  assert.match(result.testNext, /Output window/i);
});

test('matchError recognizes RemoteEvent-related errors', () => {
  const result = matchError('attempt to call a nil value (RemoteEvent is not a valid member)');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'remote-event');
  assert.match(result.problem, /RemoteEvent/i);
  assert.match(result.likelyCause, /ReplicatedStorage/i);
  assert.ok(result.fixSteps.some((step) => /never trust data the CLIENT/i.test(step)));
  assert.match(result.testNext, /2\+ simulated players/i);
});

test('matchError recognizes DataStore-related errors', () => {
  const result = matchError('DataStore request was added to queue and is throttled');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'datastore');
  assert.match(result.problem, /DataStore/i);
  assert.match(result.likelyCause, /API access|throttled|pcall/i);
  assert.ok(result.fixSteps.some((step) => /Enable Studio Access to API Services/i.test(step)));
  assert.match(result.testNext, /saving, leaving, and rejoining/i);
});

test('matchError recognizes wrong-script-location errors', () => {
  const result = matchError('Players.LocalScript is not a valid Script');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'wrong-script-location');
  assert.match(result.problem, /wrong location|wrong type/i);
  assert.match(result.likelyCause, /Script, LocalScript, ModuleScript|silently never executes/i);
  assert.ok(result.fixSteps.some((step) => /ServerScriptService/i.test(step)));
  assert.match(result.testNext, /print at the top of the script/i);
});

test('matchError falls back to generic guidance for unrecognized text', () => {
  const result = matchError('some completely unrelated custom error message');
  assert.equal(result.matched, false);
  assert.match(result.problem, /doesn't match one of the common patterns/i);
  assert.match(result.likelyCause, /different wording|less common/i);
  assert.ok(result.fixSteps.some((step) => /line number and script name/i.test(step)));
  assert.match(result.testNext, /New Script/);
});

test('matchError falls back to generic guidance for empty input', () => {
  const result = matchError('');
  assert.equal(result.matched, false);
  assert.match(result.problem, /doesn't match one of the common patterns/i);
  assert.ok(Array.isArray(result.fixSteps));
  assert.match(result.testNext, /New Script/);
});
