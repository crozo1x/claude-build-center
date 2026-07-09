const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePlan } = require('../lib/plan-generator');

test('generatePlan with a single genre chip uses that genre\'s core loop', () => {
  const plan = generatePlan({ ideaText: 'a game about mining', chips: ['tycoon'] });
  assert.match(plan.coreLoop, /generators/);
  assert.match(plan.conceptSummary, /Tycoon/);
});

test('generatePlan with no genre chips falls back to a generic loop built from ideaText', () => {
  const plan = generatePlan({ ideaText: 'players race go-karts', chips: [] });
  assert.match(plan.coreLoop, /players race go-karts/);
  assert.match(plan.conceptSummary, /Custom/);
});

test('generatePlan with no genre chips and no ideaText uses a generic placeholder loop', () => {
  const plan = generatePlan({ ideaText: '', chips: [] });
  assert.match(plan.coreLoop, /generic placeholder loop/);
});

test('generatePlan combines multiple genre chips instead of dropping one', () => {
  const plan = generatePlan({ ideaText: '', chips: ['simulator', 'tycoon'] });
  assert.match(plan.coreLoop, /rebirth/); // simulator fragment
  assert.match(plan.coreLoop, /generators/); // tycoon fragment
});

test('generatePlan appends feature chip notes to the core loop', () => {
  const plan = generatePlan({ ideaText: '', chips: ['obby', 'leaderstats', 'shop'] });
  assert.match(plan.coreLoop, /Leaderstats, Shop/);
});

test('generatePlan services list includes chip-specific and baseline services with no duplicates', () => {
  const plan = generatePlan({ ideaText: '', chips: ['dataSaving', 'dataSaving'] });
  const dataStoreCount = plan.services.filter((s) => s === 'DataStoreService').length;
  assert.equal(dataStoreCount, 1);
  assert.ok(plan.services.includes('ServerScriptService (server-side game logic)'));
});

test('generatePlan folder tree includes DataManager only when dataSaving chip is active', () => {
  const withData = generatePlan({ ideaText: '', chips: ['dataSaving'] });
  const withoutData = generatePlan({ ideaText: '', chips: [] });
  assert.ok(withData.folderTree.some((line) => line.includes('DataManager')));
  assert.ok(!withoutData.folderTree.some((line) => line.includes('DataManager')));
});

test('generatePlan setup checklist includes one entry per active feature chip', () => {
  const plan = generatePlan({ ideaText: '', chips: ['leaderstats', 'shop'] });
  assert.ok(plan.setupChecklist.some((line) => line.includes('leaderstats')));
  assert.ok(plan.setupChecklist.some((line) => line.toLowerCase().includes('purchase')));
});

test('generatePlan playtest checklist always includes multi-player testing guidance', () => {
  const plan = generatePlan({ ideaText: '', chips: [] });
  assert.ok(plan.playtestChecklist.some((line) => line.includes('2+ simulated players')));
});

test('generatePlan with roundBased chip produces a round-focused core loop and concept summary', () => {
  const plan = generatePlan({ ideaText: '', chips: ['roundBased'] });
  assert.match(plan.coreLoop, /round/i);
  assert.match(plan.conceptSummary, /Round-Based Minigame/);
});

test('generatePlan always includes safety notes mentioning RemoteEvent, regardless of chips', () => {
  const withChips = generatePlan({ ideaText: '', chips: ['tycoon', 'shop'] });
  const withoutChips = generatePlan({ ideaText: '', chips: [] });
  assert.ok(Array.isArray(withChips.safetyNotes));
  assert.ok(withChips.safetyNotes.some((line) => line.includes('RemoteEvent')));
  assert.ok(Array.isArray(withoutChips.safetyNotes));
  assert.ok(withoutChips.safetyNotes.some((line) => line.includes('RemoteEvent')));
});
