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

test('generatePlan scriptsToCreate is empty with no chips and non-empty once a genre chip is picked', () => {
  const empty = generatePlan({ ideaText: '', chips: [] });
  const withObby = generatePlan({ ideaText: '', chips: ['obby'] });
  assert.deepEqual(empty.scriptsToCreate, []);
  assert.ok(withObby.scriptsToCreate.length > 0);
});

test('generatePlan scriptsToCreate entries have name/path/type/purpose and a valid Roblox script type', () => {
  const plan = generatePlan({ ideaText: '', chips: ['petGame', 'shop'] });
  assert.ok(plan.scriptsToCreate.length > 0);
  plan.scriptsToCreate.forEach((script) => {
    assert.equal(typeof script.name, 'string');
    assert.equal(typeof script.path, 'string');
    assert.equal(typeof script.purpose, 'string');
    assert.ok(['Script', 'LocalScript', 'ModuleScript'].includes(script.type));
  });
});

test('generatePlan scriptsToCreate combines genre and feature scripts with no duplicate paths', () => {
  const plan = generatePlan({ ideaText: '', chips: ['tycoon', 'shop', 'leaderstats'] });
  const paths = plan.scriptsToCreate.map((s) => s.path);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.some((p) => p.includes('PlotClaim') || p.includes('PlotManager') || p.includes('DropperPayout')));
  assert.ok(paths.some((p) => p.includes('ShopConfig')));
  assert.ok(paths.some((p) => p.includes('Leaderstats')));
});

test('generatePlan folder tree only shows Leaderstats.server.lua when the leaderstats chip is active', () => {
  const withLeaderstats = generatePlan({ ideaText: '', chips: ['leaderstats'] });
  const withoutLeaderstats = generatePlan({ ideaText: '', chips: ['obby'] });
  assert.ok(withLeaderstats.folderTree.some((line) => line.includes('Leaderstats.server.lua')));
  assert.ok(!withoutLeaderstats.folderTree.some((line) => line.includes('Leaderstats.server.lua')));
});

test('generatePlan folder tree always shows the four standard top-level folders even with no chips', () => {
  const plan = generatePlan({ ideaText: '', chips: [] });
  ['ServerScriptService/', 'ReplicatedStorage/', 'StarterGui/', 'Workspace/'].forEach((folder) => {
    assert.ok(plan.folderTree.includes(folder));
  });
});

test('generatePlan folder tree groups a ModuleScript under its own ReplicatedStorage entry', () => {
  const plan = generatePlan({ ideaText: '', chips: ['shop'] });
  const replicatedIndex = plan.folderTree.indexOf('ReplicatedStorage/');
  assert.ok(replicatedIndex !== -1);
  assert.ok(plan.folderTree[replicatedIndex + 1].includes('ShopConfig.lua'));
});

test('generatePlan safety notes add a genre-specific note only when that genre chip is active', () => {
  const withFighting = generatePlan({ ideaText: '', chips: ['fightingArena'] });
  const withoutFighting = generatePlan({ ideaText: '', chips: ['obby'] });
  assert.ok(withFighting.safetyNotes.some((line) => line.includes('hit detection')));
  assert.ok(!withoutFighting.safetyNotes.some((line) => line.includes('hit detection')));
});

test('generatePlan playtest checklist adds a genre-specific step only when that genre chip is active', () => {
  const withRoundBased = generatePlan({ ideaText: '', chips: ['roundBased'] });
  const withoutRoundBased = generatePlan({ ideaText: '', chips: ['obby'] });
  assert.ok(withRoundBased.playtestChecklist.some((line) => line.includes('leaving mid-round')));
  assert.ok(!withoutRoundBased.playtestChecklist.some((line) => line.includes('leaving mid-round')));
});

test('generatePlan services list includes RemoteEvents for pet game hatch requests', () => {
  const plan = generatePlan({ ideaText: '', chips: ['petGame'] });
  assert.ok(plan.services.some((s) => s.includes('RemoteEvents')));
});
