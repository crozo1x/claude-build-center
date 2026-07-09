# Roblox Vibe Coding Coach MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a guided Idea → Plan → Scripts → Debug builder workflow the app's default experience, with the existing terminal/pty grid preserved unchanged under a new "Advanced" tab.

**Architecture:** A tab bar toggles between 5 panel `<div>`s via CSS class, no framework. Advanced wraps the entire current toolbar/workspace/widget-canvas verbatim. Two new pure-logic `lib/` modules (`plan-generator.js`, `debug-matcher.js`) do all the "smart" work deterministically — no AI/network calls anywhere in this feature.

**Tech Stack:** Plain HTML/CSS/JS (no new dependencies), `node --test` for the two new lib modules, existing `lib/config-store.js` pattern extended for persistence.

---

## Reference: spec

Full design rationale is in `docs/superpowers/specs/2026-07-07-roblox-builder-mvp-design.md`. Read it once before starting — this plan assumes its scope decisions (BasePlate branding unchanged, no AI calls, same 4 scripts regardless of chips, persistence via config-store).

---

### Task 1: Plan generator module

**Files:**
- Create: `lib/plan-generator.js`
- Test: `test/plan-generator.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/plan-generator.test.js`
Expected: FAIL — `Cannot find module '../lib/plan-generator'`

- [ ] **Step 3: Write the minimal implementation**

```js
const GENRE_TEMPLATES = {
  simulator: {
    label: 'Simulator',
    coreLoop: 'Collect resources or currency by repeating a simple action, spend it on upgrades that make the action more efficient, and periodically "rebirth" to reset progress for a permanent multiplier.',
    services: ['ReplicatedStorage (for shared upgrade data)'],
  },
  obby: {
    label: 'Obby',
    coreLoop: 'Navigate a linear sequence of checkpoints and obstacles, avoiding hazards that reset you to the last checkpoint, until you reach the finish.',
    services: [],
  },
  tycoon: {
    label: 'Tycoon',
    coreLoop: 'Claim a plot, place generators or droppers that produce cash over time, collect that cash, and spend it on upgrades that unlock more of the plot.',
    services: ['ReplicatedStorage (for purchasable item definitions)'],
  },
  petGame: {
    label: 'Pet Game',
    coreLoop: 'Hatch pets from eggs (often bought with in-game currency), equip a loadout of pets, and use their passive bonuses to earn currency faster.',
    services: ['ReplicatedStorage (for pet definitions and rarities)'],
  },
  fightingArena: {
    label: 'Fighting Arena',
    coreLoop: 'Queue into a match against other players, fight using abilities or combat mechanics, and earn currency or rank based on match outcomes.',
    services: ['RemoteEvents for combat actions'],
  },
};

const FEATURE_TEMPLATES = {
  leaderstats: {
    label: 'Leaderstats',
    checklistSetup: 'Create a Script in ServerScriptService that builds a "leaderstats" Folder under each Player on join, with IntValue/NumberValue children for each stat you want visible on the Roblox leaderboard.',
    services: ['Players service (leaderstats convention)'],
  },
  shop: {
    label: 'Shop',
    checklistSetup: 'Add a RemoteEvent (e.g. "PurchaseItem") in ReplicatedStorage for purchase requests, and validate every purchase server-side — never trust a client-reported price.',
    services: ['RemoteEvents for purchase requests'],
  },
  dataSaving: {
    label: 'Data Saving',
    checklistSetup: 'Use DataStoreService to save player data on PlayerRemoving (and periodically during play) — wrap every DataStore call in pcall so a failure doesn\'t crash your script.',
    services: ['DataStoreService'],
  },
  uiPolish: {
    label: 'UI Polish',
    checklistSetup: 'Build UI in a ScreenGui under StarterGui so it\'s cloned per-player automatically; keep purely visual state client-side and send meaningful actions to the server via RemoteEvents.',
    services: ['StarterGui / ScreenGui'],
  },
};

function generatePlan({ ideaText, chips }) {
  const chipList = Array.isArray(chips) ? chips : [];
  const genreChips = [...new Set(chipList)].filter((c) => GENRE_TEMPLATES[c]);
  const featureChips = [...new Set(chipList)].filter((c) => FEATURE_TEMPLATES[c]);
  const trimmedIdea = (ideaText || '').trim();

  return {
    conceptSummary: buildConceptSummary(genreChips, trimmedIdea),
    coreLoop: buildCoreLoop(genreChips, featureChips, trimmedIdea),
    services: buildServicesList(genreChips, featureChips),
    folderTree: buildFolderTree(featureChips),
    setupChecklist: buildSetupChecklist(featureChips),
    playtestChecklist: buildPlaytestChecklist(),
  };
}

function buildConceptSummary(genreChips, trimmedIdea) {
  const genreLabels = genreChips.map((c) => GENRE_TEMPLATES[c].label);
  const genrePart = genreLabels.length > 0 ? genreLabels.join(' + ') : 'Custom';
  const ideaPart = trimmedIdea ? `"${trimmedIdea}"` : 'a game you\'re still describing';
  return `A ${genrePart} Roblox game based on your idea: ${ideaPart}.`;
}

function buildCoreLoop(genreChips, featureChips, trimmedIdea) {
  let base;
  if (genreChips.length === 0) {
    base = trimmedIdea
      ? `Based on your description, the core loop should center on: ${trimmedIdea}.`
      : 'Describe what a player repeatedly does to get a tailored core loop — for now, this is a generic placeholder loop: the player performs an action, earns a reward, and spends that reward on progression.';
  } else if (genreChips.length === 1) {
    base = GENRE_TEMPLATES[genreChips[0]].coreLoop;
  } else {
    base = genreChips
      .map((c, i) => (i === 0 ? GENRE_TEMPLATES[c].coreLoop : `Also mix in ${GENRE_TEMPLATES[c].label} elements: ${GENRE_TEMPLATES[c].coreLoop}`))
      .join(' ');
  }
  if (featureChips.length === 0) return base;
  const labels = featureChips.map((c) => FEATURE_TEMPLATES[c].label).join(', ');
  return `${base} Layer in: ${labels}.`;
}

function buildServicesList(genreChips, featureChips) {
  const services = new Set();
  genreChips.forEach((c) => GENRE_TEMPLATES[c].services.forEach((s) => services.add(s)));
  featureChips.forEach((c) => FEATURE_TEMPLATES[c].services.forEach((s) => services.add(s)));
  services.add('ServerScriptService (server-side game logic)');
  services.add('Workspace (physical game objects)');
  return Array.from(services);
}

function buildFolderTree(featureChips) {
  const tree = [
    'ServerScriptService/',
    '  Leaderstats.server.lua',
    'ReplicatedStorage/',
    '  RemoteEvents/ (if using shop, combat, or other client-server actions)',
    'StarterGui/',
    'Workspace/',
  ];
  if (featureChips.includes('shop')) {
    tree.splice(3, 0, '  ShopConfig (ModuleScript)');
  }
  if (featureChips.includes('dataSaving')) {
    tree.splice(1, 0, '  DataManager.server.lua');
  }
  return tree;
}

function buildSetupChecklist(featureChips) {
  const checklist = [
    'Open Roblox Studio and create/open your place.',
    'Insert a Script into ServerScriptService for each server-side system described above.',
  ];
  featureChips.forEach((c) => checklist.push(FEATURE_TEMPLATES[c].checklistSetup));
  checklist.push('Save the place and publish it so changes are testable outside Studio too.');
  return checklist;
}

function buildPlaytestChecklist() {
  return [
    'Playtest solo first (Studio\'s "Play" button) to confirm nothing errors on join.',
    'Playtest with 2+ simulated players (Studio\'s multi-client "Start" test) — many bugs (leaderstats not appearing for the second player, RemoteEvents firing for the wrong player) only show up with multiple clients.',
    'Check the Output window for red error text after every test — silent failures are common in Roblox and easy to miss.',
    'If using DataStores, verify "Enable Studio Access to API Services" is on and playtest saving, leaving, and rejoining to confirm data actually persists.',
  ];
}

module.exports = { generatePlan, GENRE_TEMPLATES, FEATURE_TEMPLATES };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/plan-generator.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/plan-generator.js test/plan-generator.test.js
git commit -m "Add deterministic plan generator module"
```

---

### Task 2: Debug error-pattern matcher module

**Files:**
- Create: `lib/debug-matcher.js`
- Test: `test/debug-matcher.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { matchError } = require('../lib/debug-matcher');

test('matchError recognizes "attempt to index nil"', () => {
  const result = matchError('ServerScriptService.Leaderstats:5: attempt to index nil with \'Name\'');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'index-nil');
});

test('matchError recognizes "is not a valid member of"', () => {
  const result = matchError('Workspace.Part is not a valid member of Model "Workspace"');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'not-valid-member');
});

test('matchError recognizes "Infinite yield possible"', () => {
  const result = matchError('Infinite yield possible on \'ReplicatedStorage:WaitForChild("RemoteEvent")\'');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'infinite-yield');
});

test('matchError recognizes RemoteEvent-related errors', () => {
  const result = matchError('attempt to call a nil value (RemoteEvent is not a valid member)');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'remote-event');
});

test('matchError recognizes DataStore-related errors', () => {
  const result = matchError('DataStore request was added to queue and is throttled');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'datastore');
});

test('matchError recognizes wrong-script-location errors', () => {
  const result = matchError('Players.LocalScript is not a valid Script');
  assert.equal(result.matched, true);
  assert.equal(result.pattern, 'wrong-script-location');
});

test('matchError falls back to a generic fix for unrecognized text', () => {
  const result = matchError('some completely unrelated custom error message');
  assert.equal(result.matched, false);
  assert.match(result.fix, /New Script/);
});

test('matchError falls back to a generic fix for empty input', () => {
  const result = matchError('');
  assert.equal(result.matched, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/debug-matcher.test.js`
Expected: FAIL — `Cannot find module '../lib/debug-matcher'`

- [ ] **Step 3: Write the minimal implementation**

```js
const ERROR_PATTERNS = [
  {
    id: 'index-nil',
    test: (text) => /attempt to index nil/i.test(text),
    label: 'Attempt to index nil',
    fix: 'You tried to use a variable that turned out to be nil (empty) as if it were an object — e.g. `workspace.Part.Name` when "Part" doesn\'t exist under Workspace yet. Check: (1) the exact spelling/case of every name in the chain, (2) whether the object exists yet when this line runs (use WaitForChild instead of direct indexing for anything that might load late), (3) the line number tells you exactly which variable was nil.',
  },
  {
    id: 'not-valid-member',
    test: (text) => /is not a valid member of|is not a valid Script/i.test(text) === false && /is not a valid member of/i.test(text),
    label: 'X is not a valid member of Y',
    fix: 'You referenced a child object/property that doesn\'t exist under the given parent. Check: (1) exact spelling and capitalization (Roblox names are case-sensitive), (2) whether you renamed something in Studio\'s Explorer without updating the script, (3) whether the object is created by another script that hasn\'t run yet.',
  },
  {
    id: 'infinite-yield',
    test: (text) => /infinite yield possible/i.test(text),
    label: 'Infinite yield possible',
    fix: 'A WaitForChild (or similar wait) is stuck because the thing it\'s waiting for never appears. Check: (1) the path/name you\'re waiting for is spelled correctly, (2) whether the object is actually supposed to exist there, (3) whether you\'re waiting on the client for something only the server creates (or vice versa).',
  },
  {
    id: 'remote-event',
    test: (text) => /remoteevent/i.test(text),
    label: 'Missing or misused RemoteEvent',
    fix: 'RemoteEvents are how client and server scripts talk to each other — this usually means one side references a RemoteEvent that doesn\'t exist yet. Check: (1) the RemoteEvent instance actually exists in ReplicatedStorage, (2) both client and server reference the exact same path, (3) never trust data the CLIENT sends via a RemoteEvent without validating it on the server.',
  },
  {
    id: 'datastore',
    test: (text) => /datastore/i.test(text),
    label: 'DataStore problem',
    fix: 'DataStore errors are usually about request throttling or Studio\'s API access setting. Check: (1) "Enable Studio Access to API Services" is on in Game Settings > Security, (2) every DataStore call is wrapped in pcall, (3) you\'re not calling DataStore methods too frequently — save periodically and on PlayerRemoving, not on every small change.',
  },
  {
    id: 'wrong-script-location',
    test: (text) => /is not a valid script|expected script|is not a valid Script/i.test(text),
    label: 'Script in the wrong location / wrong script type',
    fix: 'Roblox has 3 script types (Script, LocalScript, ModuleScript) and each only runs in specific places. Check: (1) server logic → Script in ServerScriptService, (2) client/UI logic → LocalScript under StarterPlayerScripts, (3) shared reusable code → ModuleScript in ReplicatedStorage, required by both sides.',
  },
];

function matchError(outputText) {
  const text = (outputText || '').trim();
  if (!text) {
    return { matched: false, fix: genericFallback() };
  }
  const found = ERROR_PATTERNS.find((p) => p.test(text));
  if (found) {
    return { matched: true, pattern: found.id, label: found.label, fix: found.fix };
  }
  return { matched: false, fix: genericFallback() };
}

function genericFallback() {
  return 'This doesn\'t match one of the common patterns this tool recognizes yet. Check: (1) the exact line number and script name in the error, (2) whether the script is a Script, LocalScript, or ModuleScript and whether that matches where it\'s placed, (3) the Output window for any EARLIER errors — the first error in a sequence is often the real cause. For anything more involved, use "New Script" in the Advanced tab to ask Claude directly with the full error and your script.';
}

module.exports = { matchError, ERROR_PATTERNS };
```

Note on the `not-valid-member` pattern: it's written to explicitly exclude the wrong-script-location phrasing ("is not a valid Script") so a "LocalScript is not a valid Script" error matches `wrong-script-location` instead of being ambiguously caught by a naive substring check — `ERROR_PATTERNS` is checked in array order via `.find()`, so this only matters if pattern order ever changes; keep `wrong-script-location`-shaped phrasing distinguishable from generic member-access phrasing if you add more patterns later.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/debug-matcher.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/debug-matcher.js test/debug-matcher.test.js
git commit -m "Add deterministic Roblox error-pattern matcher module"
```

---

### Task 3: Extend config-store for builder persistence

**Files:**
- Modify: `lib/config-store.js`
- Modify: `test/config-store.test.js`

- [ ] **Step 1: Update the existing round-trip test's fixture**

The existing round-trip test currently saves/loads a config object with only `projectFolder`/`widgets`. Since `loadConfig` will now always return a `builder` key too, that test's fixture must include one so the round-trip still asserts exact equality. In `test/config-store.test.js`, replace the `saveConfig then loadConfig round-trips data` test:

```js
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
```

- [ ] **Step 2: Add a new test for backward-compatible defaulting**

Add this test to `test/config-store.test.js` (a legacy config file saved before this feature existed, with no `builder` key at all, must still load cleanly):

```js
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/config-store.test.js`
Expected: FAIL — the round-trip test fails on the extra `builder` key not yet returned by `loadConfig`; the two new tests fail with `result.builder` being `undefined`.

- [ ] **Step 4: Write the minimal implementation**

Replace `lib/config-store.js` in full:

```js
const fs = require('fs');

function defaultConfig() {
  return {
    projectFolder: null,
    widgets: [],
    builder: defaultBuilderState(),
  };
}

function defaultBuilderState() {
  return { ideaText: '', chips: [], plan: null, scriptsTested: {} };
}

function loadConfig(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const builder = parsed.builder && typeof parsed.builder === 'object' && !Array.isArray(parsed.builder)
      ? parsed.builder
      : {};
    return {
      projectFolder: typeof parsed.projectFolder === 'string' ? parsed.projectFolder : null,
      widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [],
      builder: {
        ideaText: typeof builder.ideaText === 'string' ? builder.ideaText : '',
        chips: Array.isArray(builder.chips) ? builder.chips : [],
        plan: builder.plan && typeof builder.plan === 'object' ? builder.plan : null,
        scriptsTested: builder.scriptsTested && typeof builder.scriptsTested === 'object' && !Array.isArray(builder.scriptsTested)
          ? builder.scriptsTested
          : {},
      },
    };
  } catch (err) {
    return defaultConfig();
  }
}

function saveConfig(filePath, config) {
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = { defaultConfig, loadConfig, saveConfig };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/config-store.test.js`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/config-store.js test/config-store.test.js
git commit -m "Extend config-store with persisted builder state"
```

---

### Task 4: Shell allowlist on pty:spawn

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Add the allowlist check**

In `main.js`, inside the `pty:spawn` handler, change:

```js
ipcMain.handle('pty:spawn', (event, opts) => {
  const { id, shell, cwd, cols, rows, autoRun } = opts;
  const shellPath = shell || process.env.COMSPEC || 'powershell.exe';
```

to:

```js
const ALLOWED_SHELLS = ['powershell.exe', 'cmd.exe'];

ipcMain.handle('pty:spawn', (event, opts) => {
  const { id, shell, cwd, cols, rows, autoRun } = opts;
  const shellPath = ALLOWED_SHELLS.includes(shell) ? shell : (process.env.COMSPEC || 'powershell.exe');
```

(Place the `ALLOWED_SHELLS` constant near the top of the file with the other top-level constants, not inline inside the handler — it's only shown inline above for clarity of the diff.)

- [ ] **Step 2: Manual verification**

Run `npm start`. In the Advanced tab, confirm "+ Terminal" still opens a working PowerShell pane (the dropdown only ever offers `powershell.exe`/`cmd.exe`, both on the allowlist, so behavior is unchanged for normal use). This step exists to confirm the allowlist doesn't accidentally break the two shells the UI actually offers — it protects against a hypothetical malicious/malformed IPC payload, not normal usage.

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "Validate shell against an allowlist in pty:spawn"
```

---

### Task 5: Tab shell — restructure index.html, add tabs.js and CSS

**Files:**
- Modify: `renderer/index.html`
- Create: `renderer/tabs.js`
- Modify: `renderer/style.css`

- [ ] **Step 1: Restructure `renderer/index.html`**

Replace the `<body>` content. The existing `#toolbar`, `#workspace`, and `#widgetPicker` move verbatim into a new `#tabAdvanced` panel; everything else is new empty panel scaffolding that later tasks fill in:

```html
<body>
  <div id="tabBar">
    <button class="tab-btn active" data-tab="idea">Idea</button>
    <button class="tab-btn" data-tab="plan">Plan</button>
    <button class="tab-btn" data-tab="scripts">Scripts</button>
    <button class="tab-btn" data-tab="debug">Debug</button>
    <button class="tab-btn" data-tab="advanced">Advanced</button>
  </div>

  <div id="tabPanels">
    <div id="tabIdea" class="tab-panel active"></div>
    <div id="tabPlan" class="tab-panel"></div>
    <div id="tabScripts" class="tab-panel"></div>
    <div id="tabDebug" class="tab-panel"></div>
    <div id="tabAdvanced" class="tab-panel">
      <div id="toolbar">
        <div id="brand">BASEPLATE</div>
        <button id="btnProjectFolder" title="Set the Roblox project folder">Set Project Folder</button>
        <span id="projectFolderLabel">No project set</span>
        <select id="shellSelect" title="Shell for new terminals">
          <option value="powershell.exe">PowerShell</option>
          <option value="cmd.exe">cmd</option>
        </select>
        <button id="btnNewTerminal">+ Terminal</button>
        <button id="btnNewScript">New Script</button>
        <button id="btnSyncStudio" disabled title="Set a project folder first">Sync to Studio</button>
        <button id="btnPlayTest" disabled title="Set a project folder first">Play / Test</button>
        <button id="btnAddWidget">+ Widget</button>
        <button id="btnUpdateAvailable" class="hidden">Update Available</button>
      </div>
      <div id="workspace">
        <div id="panes"></div>
        <div id="widgetCanvas" class="grid-stack"></div>
      </div>
      <div id="widgetPicker" class="widget-picker hidden"></div>
    </div>
  </div>

  <script src="../node_modules/@xterm/xterm/lib/xterm.js"></script>
  <script src="../node_modules/@xterm/addon-fit/lib/addon-fit.js"></script>
  <script src="../node_modules/gridstack/dist/gridstack-all.js"></script>
  <script src="state.js"></script>
  <script src="lib/rojo-status.js"></script>
  <script src="widgets.js"></script>
  <script src="tabs.js"></script>
  <script src="renderer.js"></script>
</body>
```

(`renderer.js`'s existing `document.getElementById` calls for toolbar elements are unaffected — the elements keep the exact same ids, just nested one level deeper in the DOM, which doesn't matter for `getElementById`.)

- [ ] **Step 2: Create `renderer/tabs.js`**

```js
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  function activateTab(tabName) {
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    panels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });
}

initTabs();
```

- [ ] **Step 3: Add tab bar and panel CSS to `renderer/style.css`**

Add near the top of the file, after the existing `html, body` rule:

```css
#tabBar {
  display: flex;
  gap: 4px;
  padding: 8px 14px 0;
  background: #05070a;
  border-bottom: 1px solid #21262d;
}

.tab-btn {
  background: transparent;
  color: #8b949e;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
}

.tab-btn:hover {
  color: #c9d1d9;
  background: #161b22;
}

.tab-btn.active {
  color: #58a6ff;
  background: #0d1117;
  border-color: #21262d;
}

.tab-panel {
  display: none;
  height: calc(100vh - 40px);
  overflow-y: auto;
}

.tab-panel.active {
  display: block;
}

#tabAdvanced.active {
  display: flex;
  flex-direction: column;
}
```

Note: `#tabAdvanced`'s existing children (`#toolbar`, `#workspace`) already have their own height/layout rules (`#workspace { height: calc(100vh - 46px); }`) written assuming they're direct children of `<body>`. Wrapping them in `#tabPanels > .tab-panel` (height `calc(100vh - 40px)` for the tab bar) changes the available height slightly. This is a cosmetic-only discrepancy (a few pixels of extra/missing space) — Step 4's manual verification below explicitly checks for this and any resulting visual glitch (e.g. a scrollbar appearing where one didn't before) should be fixed by adjusting `#workspace`'s `calc()` to account for the new tab bar height, not worked around any other way.

- [ ] **Step 4: Manual verification — full regression check on Advanced**

Run `npm start`. Confirm the app opens on the Idea tab (empty for now — filled in by later tasks) with no console errors. Click the Advanced tab and verify, one by one, that every existing feature still works exactly as before this restructuring:
- The default "Terminal" pane from launch is visible and interactive.
- "+ Terminal" and "New Script" still spawn working panes.
- "Set Project Folder" still opens the native picker and updates the label.
- "Sync to Studio" and "Play / Test" are still disabled until a folder is set, then work.
- "+ Widget" still opens the widget picker and added widgets still render/persist.
- No layout glitches (scrollbars, clipped panes) from the height/nesting change in Step 3 — fix the CSS `calc()` now if anything looks off, don't defer it.

- [ ] **Step 5: Commit**

```bash
git add renderer/index.html renderer/tabs.js renderer/style.css
git commit -m "Add tab shell, move existing UI into an Advanced tab"
```

---

### Task 6: Script template data

**Files:**
- Create: `renderer/scripts-data.js`

- [ ] **Step 1: Write the script template data**

```js
const SCRIPT_TEMPLATES = [
  {
    filename: 'Leaderstats.server.lua',
    path: 'ServerScriptService/Leaderstats.server.lua',
    purpose: 'Creates the "leaderstats" folder Roblox\'s built-in leaderboard looks for, with a Cash stat. Other server scripts read/write player.leaderstats.Cash.Value directly once this has run.',
    code: `-- Leaderstats.server.lua
-- Place in: ServerScriptService

local Players = game:GetService("Players")

local function onPlayerAdded(player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	leaderstats.Parent = player

	local cash = Instance.new("IntValue")
	cash.Name = "Cash"
	cash.Value = 0
	cash.Parent = leaderstats
end

Players.PlayerAdded:Connect(onPlayerAdded)

for _, player in ipairs(Players:GetPlayers()) do
	if not player:FindFirstChild("leaderstats") then
		onPlayerAdded(player)
	end
end
`,
  },
  {
    filename: 'CollectibleManager.server.lua',
    path: 'ServerScriptService/CollectibleManager.server.lua',
    purpose: 'Watches a "Collectibles" folder in Workspace. Any part inside it awards Cash and destroys itself when touched by a player — server-authoritative so a modified client can\'t fake collecting an item it never touched.',
    code: `-- CollectibleManager.server.lua
-- Place in: ServerScriptService
-- Requires Leaderstats.server.lua to have run first.

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local COLLECTIBLE_VALUE = 5

local collectiblesFolder = Workspace:FindFirstChild("Collectibles")
if not collectiblesFolder then
	collectiblesFolder = Instance.new("Folder")
	collectiblesFolder.Name = "Collectibles"
	collectiblesFolder.Parent = Workspace
end

local debounces = {}

local function awardCash(player, amount)
	local leaderstats = player:FindFirstChild("leaderstats")
	if not leaderstats then
		return
	end
	local cash = leaderstats:FindFirstChild("Cash")
	if cash then
		cash.Value += amount
	end
end

local function onCollectibleTouched(collectible, otherPart)
	if debounces[collectible] then
		return
	end
	local character = otherPart.Parent
	local player = character and Players:GetPlayerFromCharacter(character)
	if not player then
		return
	end

	debounces[collectible] = true
	awardCash(player, COLLECTIBLE_VALUE)
	collectible:Destroy()
end

local function watchCollectible(collectible)
	if not collectible:IsA("BasePart") then
		return
	end
	collectible.Touched:Connect(function(otherPart)
		onCollectibleTouched(collectible, otherPart)
	end)
end

for _, child in ipairs(collectiblesFolder:GetChildren()) do
	watchCollectible(child)
end

collectiblesFolder.ChildAdded:Connect(watchCollectible)
`,
  },
  {
    filename: 'SellZone.server.lua',
    path: 'ServerScriptService/SellZone.server.lua',
    purpose: 'A tycoon-style sell pad: standing on a part named "SellZone" converts a player\'s PendingSales counter into Cash, rate-limited so standing still doesn\'t sell repeatedly. This is a standalone pattern example — wire your own production system to increment PendingSales.',
    code: `-- SellZone.server.lua
-- Place in: ServerScriptService
-- Expects a part named "SellZone" in Workspace, and a "PendingSales"
-- IntValue under each player (created by your production/collection
-- system) that this script converts into Cash.

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local SELL_COOLDOWN_SECONDS = 2

local sellZone = Workspace:FindFirstChild("SellZone")
if not sellZone then
	warn("SellZone.server.lua: no part named 'SellZone' found in Workspace yet.")
end

local lastSellTime = {}

local function sell(player)
	local pendingSales = player:FindFirstChild("PendingSales")
	local leaderstats = player:FindFirstChild("leaderstats")
	if not pendingSales or not leaderstats then
		return
	end
	local cash = leaderstats:FindFirstChild("Cash")
	if not cash or pendingSales.Value <= 0 then
		return
	end

	cash.Value += pendingSales.Value
	pendingSales.Value = 0
end

local function onTouched(otherPart)
	local character = otherPart.Parent
	local player = character and Players:GetPlayerFromCharacter(character)
	if not player then
		return
	end

	local now = os.clock()
	if lastSellTime[player] and (now - lastSellTime[player]) < SELL_COOLDOWN_SECONDS then
		return
	end
	lastSellTime[player] = now

	sell(player)
end

if sellZone then
	sellZone.Touched:Connect(onTouched)
end

Players.PlayerRemoving:Connect(function(player)
	lastSellTime[player] = nil
end)
`,
  },
  {
    filename: 'CurrencyGui.client.lua',
    path: 'StarterPlayerScripts/CurrencyGui.client.lua',
    purpose: 'Displays the local player\'s Cash in a simple on-screen label that updates live. Purely visual — reads from leaderstats, never writes to it (all currency changes happen server-side).',
    code: `-- CurrencyGui.client.lua
-- Place in: StarterPlayerScripts (as a LocalScript)

local Players = game:GetService("Players")
local player = Players.LocalPlayer

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "CurrencyGui"
screenGui.ResetOnSpawn = false
screenGui.Parent = player:WaitForChild("PlayerGui")

local label = Instance.new("TextLabel")
label.Name = "CashLabel"
label.Size = UDim2.new(0, 200, 0, 40)
label.Position = UDim2.new(0, 12, 0, 12)
label.BackgroundTransparency = 0.3
label.BackgroundColor3 = Color3.fromRGB(13, 17, 23)
label.TextColor3 = Color3.fromRGB(255, 255, 255)
label.Font = Enum.Font.GothamBold
label.TextScaled = true
label.Text = "Cash: 0"
label.Parent = screenGui

local function updateLabel(cashValue)
	label.Text = "Cash: " .. tostring(cashValue)
end

local function onLeaderstatsAdded(leaderstats)
	local cash = leaderstats:WaitForChild("Cash")
	updateLabel(cash.Value)
	cash.Changed:Connect(updateLabel)
end

local existingLeaderstats = player:FindFirstChild("leaderstats")
if existingLeaderstats then
	onLeaderstatsAdded(existingLeaderstats)
else
	player.ChildAdded:Connect(function(child)
		if child.Name == "leaderstats" then
			onLeaderstatsAdded(child)
		end
	end)
end
`,
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCRIPT_TEMPLATES };
} else {
  window.BuildCenter = window.BuildCenter || {};
  window.BuildCenter.SCRIPT_TEMPLATES = SCRIPT_TEMPLATES;
}
```

(This follows the existing dual CommonJS/browser-global export pattern already used elsewhere in `renderer/` — check `renderer/lib/rojo-status.js` for the precedent if unsure.)

- [ ] **Step 2: Add the script tag**

In `renderer/index.html`, add `<script src="scripts-data.js"></script>` before `<script src="tabs.js"></script>`.

- [ ] **Step 3: Manual verification**

Open DevTools console after `npm start` and confirm `window.BuildCenter.SCRIPT_TEMPLATES` exists and has 4 entries with the expected filenames.

- [ ] **Step 4: Commit**

```bash
git add renderer/scripts-data.js renderer/index.html
git commit -m "Add static Roblox reference script templates"
```

---

### Task 7: Idea tab

**Files:**
- Modify: `renderer/index.html`
- Create: `renderer/idea-view.js`
- Modify: `renderer/style.css`

- [ ] **Step 1: Add the Idea panel markup**

In `renderer/index.html`, replace the empty `<div id="tabIdea" class="tab-panel active"></div>` with:

```html
    <div id="tabIdea" class="tab-panel active">
      <div class="builder-panel">
        <h2>Describe your game idea</h2>
        <textarea id="ideaText" placeholder="e.g. a pet-collecting game where players hatch eggs and battle for currency"></textarea>
        <h3>Pick what fits (choose any number)</h3>
        <div class="chip-group" id="genreChips">
          <button class="chip" data-chip="simulator">Simulator</button>
          <button class="chip" data-chip="obby">Obby</button>
          <button class="chip" data-chip="tycoon">Tycoon</button>
          <button class="chip" data-chip="petGame">Pet Game</button>
          <button class="chip" data-chip="fightingArena">Fighting Arena</button>
          <button class="chip" data-chip="roundBased">Round-Based Minigame</button>
        </div>
        <div class="chip-group" id="featureChips">
          <button class="chip" data-chip="leaderstats">Leaderstats</button>
          <button class="chip" data-chip="shop">Shop</button>
          <button class="chip" data-chip="dataSaving">Data Saving</button>
          <button class="chip" data-chip="uiPolish">UI Polish</button>
        </div>
        <button id="btnGeneratePlan" class="primary-action">Generate Plan</button>
      </div>
    </div>
```

- [ ] **Step 2: Create `renderer/idea-view.js`**

```js
function initIdeaView() {
  const ideaTextEl = document.getElementById('ideaText');
  const chipButtons = document.querySelectorAll('.chip');
  const generateBtn = document.getElementById('btnGeneratePlan');

  const state = window.BuildCenter.getBuilderState();
  ideaTextEl.value = state.ideaText;
  chipButtons.forEach((btn) => {
    btn.classList.toggle('active', state.chips.includes(btn.dataset.chip));
  });

  let saveTimer = null;
  ideaTextEl.addEventListener('input', () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      window.BuildCenter.setBuilderIdeaText(ideaTextEl.value);
    }, 800);
  });

  chipButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const activeChips = Array.from(document.querySelectorAll('.chip.active')).map((el) => el.dataset.chip);
      window.BuildCenter.setBuilderChips(activeChips);
    });
  });

  generateBtn.addEventListener('click', () => {
    const activeChips = Array.from(document.querySelectorAll('.chip.active')).map((el) => el.dataset.chip);
    const plan = window.BuildCenter.generatePlan({ ideaText: ideaTextEl.value, chips: activeChips });
    window.BuildCenter.setBuilderPlan(plan);
    document.querySelector('.tab-btn[data-tab="plan"]').click();
  });
}

initIdeaView();
```

- [ ] **Step 3: Style the Idea panel**

Add to `renderer/style.css`:

```css
.builder-panel {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px;
  color: #c9d1d9;
}

.builder-panel h2 {
  margin: 0 0 12px;
  font-size: 20px;
}

.builder-panel h3 {
  margin: 20px 0 8px;
  font-size: 14px;
  color: #8b949e;
  font-weight: 600;
}

#ideaText {
  width: 100%;
  min-height: 100px;
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 10px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  background: #161b22;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 16px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}

.chip:hover {
  border-color: #58a6ff;
}

.chip.active {
  background: #1f6feb;
  border-color: #58a6ff;
  color: #ffffff;
}

.primary-action {
  margin-top: 24px;
  background: #238636;
  border: 1px solid #2ea043;
  color: #ffffff;
  border-radius: 6px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
}

.primary-action:hover {
  background: #2ea043;
}
```

**Note:** this task references `window.BuildCenter.getBuilderState()`, `setBuilderIdeaText()`, `setBuilderChips()`, `setBuilderPlan()`, and `window.BuildCenter.generatePlan()` — none of these exist yet. **Do not implement stubs for them here.** Task 9 (builder state module) creates the state functions, and this task's script tag ordering (added in Step 4 below) must load `builder-state.js` before `idea-view.js`. Until Task 9 lands, this tab will throw a console error on load — that's expected and resolved by Task 9, not a bug to fix now. (This ordering-dependency is called out explicitly because it's the one place in this plan where a task is deliberately left non-functional until a later task completes — see the note in Task 9 confirming this wiring.)

- [ ] **Step 4: Add script tags**

In `renderer/index.html`, add `<script src="idea-view.js"></script>` after `tabs.js` (before `renderer.js`). Leave it as the last new script tag for now — Task 9 will insert `builder-state.js` before it.

- [ ] **Step 5: Commit**

```bash
git add renderer/index.html renderer/idea-view.js renderer/style.css
git commit -m "Add Idea tab UI (depends on Task 9's builder state, wired there)"
```

---

### Task 8: Plan tab

**Files:**
- Modify: `renderer/index.html`
- Create: `renderer/plan-view.js`
- Modify: `renderer/style.css`

- [ ] **Step 1: Add the Plan panel markup**

Replace `<div id="tabPlan" class="tab-panel"></div>` with:

```html
    <div id="tabPlan" class="tab-panel">
      <div class="builder-panel" id="planContent">
        <p class="widget-empty">No plan yet — describe your idea and click "Generate Plan" on the Idea tab.</p>
      </div>
    </div>
```

- [ ] **Step 2: Create `renderer/plan-view.js`**

```js
function renderPlan(plan) {
  const container = document.getElementById('planContent');
  if (!plan) {
    container.innerHTML = '<p class="widget-empty">No plan yet — describe your idea and click "Generate Plan" on the Idea tab.</p>';
    return;
  }

  const escapeHtml = window.BuildCenter.escapeHtml;

  container.innerHTML = `
    <h2>Concept</h2>
    <p>${escapeHtml(plan.conceptSummary)}</p>

    <h3>Core Loop</h3>
    <p>${escapeHtml(plan.coreLoop)}</p>

    <h3>Roblox Services You'll Use</h3>
    <ul>${plan.services.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>

    <h3>Object / Folder Tree</h3>
    <pre class="plan-tree">${plan.folderTree.map((line) => escapeHtml(line)).join('\n')}</pre>

    <h3>Setup Checklist</h3>
    <ol>${plan.setupChecklist.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>

    <h3>Playtest Checklist</h3>
    <ol>${plan.playtestChecklist.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>

    <h3>Client/Server Safety Notes</h3>
    <ul class="safety-notes">${plan.safetyNotes.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
  `;
}

function initPlanView() {
  const state = window.BuildCenter.getBuilderState();
  renderPlan(state.plan);
  window.BuildCenter.onBuilderPlanChanged(renderPlan);
}

initPlanView();
```

- [ ] **Step 3: Style plan content**

Add to `renderer/style.css`:

```css
#planContent h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

#planContent h3 {
  margin: 20px 0 8px;
  font-size: 14px;
  color: #8b949e;
  font-weight: 600;
}

#planContent ul,
#planContent ol {
  margin: 0;
  padding-left: 20px;
  line-height: 1.6;
}

.plan-tree {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 12px;
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  white-space: pre;
  overflow-x: auto;
}

.safety-notes {
  background: rgba(210, 153, 34, 0.1);
  border: 1px solid #d29922;
  border-radius: 8px;
  padding: 12px 12px 12px 32px;
}
```

**Note:** this references `window.BuildCenter.escapeHtml`, `getBuilderState()`, and `onBuilderPlanChanged()`, provided by Task 9. Same non-functional-until-Task-9 situation as the Idea tab — expected, not a bug.

- [ ] **Step 4: Add script tag**

In `renderer/index.html`, add `<script src="plan-view.js"></script>` after `idea-view.js`.

- [ ] **Step 5: Commit**

```bash
git add renderer/index.html renderer/plan-view.js renderer/style.css
git commit -m "Add Plan tab UI (depends on Task 9's builder state, wired there)"
```

---

### Task 9: Builder state module (shared state + persistence)

**Files:**
- Create: `renderer/builder-state.js`
- Modify: `renderer/index.html`
- Modify: `renderer/widgets.js`
- Modify: `preload.js`

This is the task that makes Tasks 7 and 8 (and 10, 11) actually work — it provides the shared state object, the pub/sub the other tabs subscribe to, and the load/save wiring into the existing config IPC.

- [ ] **Step 1: Create `renderer/builder-state.js`**

Follows the exact same pattern as the existing `renderer/state.js` (a self-invoking function attaching to `window.BuildCenter`):

```js
window.BuildCenter = window.BuildCenter || {};

(function () {
  const listeners = { planChanged: [] };
  let builderState = { ideaText: '', chips: [], plan: null, scriptsTested: {} };

  function emitPlanChanged() {
    listeners.planChanged.forEach((cb) => cb(builderState.plan));
  }

  window.BuildCenter.getBuilderState = function () {
    return builderState;
  };

  window.BuildCenter.setBuilderStateFromConfig = function (builder) {
    builderState = builder || { ideaText: '', chips: [], plan: null, scriptsTested: {} };
    emitPlanChanged();
  };

  window.BuildCenter.setBuilderIdeaText = function (ideaText) {
    builderState.ideaText = ideaText;
    window.BuildCenter.saveBuilderState();
  };

  window.BuildCenter.setBuilderChips = function (chips) {
    builderState.chips = chips;
    window.BuildCenter.saveBuilderState();
  };

  window.BuildCenter.setBuilderPlan = function (plan) {
    builderState.plan = plan;
    emitPlanChanged();
    window.BuildCenter.saveBuilderState();
  };

  window.BuildCenter.setScriptTested = function (filename, tested) {
    builderState.scriptsTested[filename] = tested;
    window.BuildCenter.saveBuilderState();
  };

  window.BuildCenter.onBuilderPlanChanged = function (cb) {
    listeners.planChanged.push(cb);
  };

  window.BuildCenter.saveBuilderState = async function () {
    try {
      const config = await window.api.config.load();
      config.builder = builderState;
      await window.api.config.save(config);
    } catch (err) {
      console.error('Failed to save builder state:', err);
    }
  };

  window.BuildCenter.escapeHtml = function (str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };
})();
```

- [ ] **Step 2: Wire `generatePlan`/`matchError` onto `window.BuildCenter`**

`lib/plan-generator.js` and `lib/debug-matcher.js` are plain CommonJS modules, but this renderer runs with `contextIsolation: true` / `nodeIntegration: false`, so `require` isn't available in renderer scripts loaded via `<script>` tags. Expose both functions through `preload.js`'s context bridge instead — the same pattern already used for every other main-process-adjacent capability (`preload.js` itself runs in a privileged context where `require` works even under `contextIsolation: true`; `contextBridge.exposeInMainWorld` copies the function reference across the isolation boundary, no IPC round-trip needed since there's no privileged operation involved).

In `preload.js`, add to the exposed API:
```js
  logic: {
    generatePlan: (input) => require('../lib/plan-generator').generatePlan(input),
    matchError: (text) => require('../lib/debug-matcher').matchError(text),
  },
```

In `renderer/builder-state.js`, add at the bottom:
```js
window.BuildCenter.generatePlan = window.api.logic.generatePlan;
window.BuildCenter.matchError = window.api.logic.matchError;
```

- [ ] **Step 3: Load builder state on startup, and fix a real config-clobbering bug**

Config load/save actually lives in `renderer/widgets.js`, not `renderer.js` — read that file's `initWidgets()` and `persistConfig()` functions before editing (current line numbers below, but verify against the real file since earlier tasks in this plan don't touch this file and line numbers should still match).

**3a. Load builder state on startup.** In `initWidgets()`, add one line right after the existing `window.BuildCenter.setProjectFolder(config.projectFolder);`:

```js
window.BuildCenter.setProjectFolder(config.projectFolder);
window.BuildCenter.setBuilderStateFromConfig(config.builder);
```

**3b. Fix a real bug this task would otherwise introduce.** `persistConfig()` currently does:

```js
window.api.config.save({ projectFolder: window.BuildCenter.getProjectFolder(), widgets: items })
  .catch((err) => console.error('Failed to save config:', err));
```

This constructs a brand-new config object containing ONLY `projectFolder`/`widgets` and saves it, which — once `builder` exists as a config key — would silently overwrite/erase any persisted builder state (idea text, chips, plan, tested checkboxes) every single time a widget is added or moved, since `saveConfig` does a full-file overwrite, not a merge. Fix `persistConfig()` to preserve whatever `builder` state is currently in memory instead of dropping it:

```js
function persistConfig() {
  const items = grid
    ? grid.engine.nodes.map((node) => {
        const el = node.el;
        return {
          type: el.querySelector('.widget-card').dataset.widgetType,
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h,
        };
      })
    : [];
  window.api.config
    .save({
      projectFolder: window.BuildCenter.getProjectFolder(),
      widgets: items,
      builder: window.BuildCenter.getBuilderState(),
    })
    .catch((err) => console.error('Failed to save config:', err));
}
```

(Keep the rest of `persistConfig()`'s body — the widget-mapping logic above it — exactly as it already is; only the final `window.api.config.save(...)` call changes.) This makes `persistConfig()` (triggered by widget changes) and `saveBuilderState()` (triggered by builder changes, added in Step 1 of this task) both always include all three top-level config sections, so neither one can silently erase what the other owns.

- [ ] **Step 4: Add script tags in the right order**

In `renderer/index.html`, add `<script src="builder-state.js"></script>` immediately after `scripts-data.js` and before `idea-view.js`:

```html
  <script src="state.js"></script>
  <script src="lib/rojo-status.js"></script>
  <script src="widgets.js"></script>
  <script src="scripts-data.js"></script>
  <script src="builder-state.js"></script>
  <script src="tabs.js"></script>
  <script src="idea-view.js"></script>
  <script src="plan-view.js"></script>
  <script src="renderer.js"></script>
```

- [ ] **Step 5: Manual verification**

Run `npm start`. Open DevTools console — confirm no errors on load. Type something in the Idea tab's textarea, toggle a couple of chips, click "Generate Plan" — confirm it switches to the Plan tab and renders real content (not the empty-state message). Restart the app (`Ctrl+R` or fully quit and `npm start` again) — confirm the idea text, chip selection, and generated plan are all still there (this is the persistence requirement — verify it for real, don't assume the config round-trip works just because the unit tests pass).

- [ ] **Step 6: Commit**

```bash
git add renderer/builder-state.js renderer/index.html renderer/widgets.js preload.js
git commit -m "Add builder state module wiring Idea and Plan tabs together with persistence"
```

---

### Task 10: Scripts tab

**Files:**
- Modify: `renderer/index.html`
- Create: `renderer/scripts-view.js`
- Modify: `renderer/style.css`

- [ ] **Step 1: Add the Scripts panel markup**

Replace `<div id="tabScripts" class="tab-panel"></div>` with:

```html
    <div id="tabScripts" class="tab-panel">
      <div class="builder-panel" id="scriptsContent"></div>
    </div>
```

- [ ] **Step 2: Create `renderer/scripts-view.js`**

```js
function renderScriptCards() {
  const container = document.getElementById('scriptsContent');
  const state = window.BuildCenter.getBuilderState();
  const escapeHtml = window.BuildCenter.escapeHtml;

  container.innerHTML = window.BuildCenter.SCRIPT_TEMPLATES.map((script, index) => {
    const tested = Boolean(state.scriptsTested[script.filename]);
    return `
      <div class="script-card" data-index="${index}">
        <div class="script-card-header">
          <span class="script-filename">${escapeHtml(script.filename)}</span>
          <label class="script-tested">
            <input type="checkbox" class="script-tested-checkbox" ${tested ? 'checked' : ''} />
            Tested
          </label>
        </div>
        <div class="script-path">${escapeHtml(script.path)}</div>
        <p class="script-purpose">${escapeHtml(script.purpose)}</p>
        <pre class="script-code">${escapeHtml(script.code)}</pre>
        <div class="script-actions">
          <button class="script-copy-code">Copy Code</button>
          <button class="script-copy-path">Copy Path</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.script-card').forEach((card) => {
    const index = Number(card.dataset.index);
    const script = window.BuildCenter.SCRIPT_TEMPLATES[index];

    card.querySelector('.script-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(script.code);
    });
    card.querySelector('.script-copy-path').addEventListener('click', () => {
      navigator.clipboard.writeText(script.path);
    });
    card.querySelector('.script-tested-checkbox').addEventListener('change', (event) => {
      window.BuildCenter.setScriptTested(script.filename, event.target.checked);
    });
  });
}

function initScriptsView() {
  renderScriptCards();
}

initScriptsView();
```

- [ ] **Step 3: Style script cards**

Add to `renderer/style.css`:

```css
.script-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.script-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.script-filename {
  font-family: 'Cascadia Code', Consolas, monospace;
  font-weight: 600;
  color: #58a6ff;
}

.script-tested {
  font-size: 12px;
  color: #8b949e;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.script-path {
  font-size: 12px;
  color: #8b949e;
  margin: 4px 0 8px;
}

.script-purpose {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
}

.script-code {
  background: #05070a;
  border: 1px solid #21262d;
  border-radius: 6px;
  padding: 12px;
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre;
  max-height: 300px;
  overflow-y: auto;
}

.script-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.script-actions button {
  background: #161b22;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}

.script-actions button:hover {
  border-color: #58a6ff;
}
```

- [ ] **Step 4: Add script tags**

In `renderer/index.html`, add `<script src="scripts-view.js"></script>` after `plan-view.js`.

- [ ] **Step 5: Manual verification**

Run `npm start`, open the Scripts tab, confirm all 4 script cards render with correct filenames/paths/code. Click "Copy Code" on one, paste into a text editor, confirm the full Luau source copied correctly (not truncated/escaped oddly). Check the "Tested" checkbox on one card, switch tabs and back — confirm it stayed checked. Restart the app — confirm the checkbox state persisted.

- [ ] **Step 6: Commit**

```bash
git add renderer/index.html renderer/scripts-view.js renderer/style.css
git commit -m "Add Scripts tab with copy-to-clipboard and tested-state persistence"
```

---

### Task 11: Debug tab

**Files:**
- Modify: `renderer/index.html`
- Create: `renderer/debug-view.js`
- Modify: `renderer/style.css`

- [ ] **Step 1: Add the Debug panel markup**

Replace `<div id="tabDebug" class="tab-panel"></div>` with:

```html
    <div id="tabDebug" class="tab-panel">
      <div class="builder-panel">
        <h2>Paste your Roblox Studio Output error</h2>
        <textarea id="debugInput" placeholder="Paste the red error text from Studio's Output window here"></textarea>
        <button id="btnDiagnose" class="primary-action">Diagnose</button>
        <div id="debugResult"></div>
        <div class="debug-warning">
          <strong>Roblox-specific reminders:</strong>
          <ul>
            <li>Never trust data a client sends via a RemoteEvent — validate everything server-side (price, item ID, amount).</li>
            <li>DataStore writes can fail or throttle — always wrap them in <code>pcall</code> and don't rely on a single save attempt.</li>
            <li>Always test with 2+ simulated players before assuming something works — many bugs only appear with multiple clients.</li>
          </ul>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Create `renderer/debug-view.js`**

```js
function initDebugView() {
  const input = document.getElementById('debugInput');
  const button = document.getElementById('btnDiagnose');
  const result = document.getElementById('debugResult');
  const escapeHtml = window.BuildCenter.escapeHtml;

  button.addEventListener('click', () => {
    const diagnosis = window.BuildCenter.matchError(input.value);
    const heading = diagnosis.matched ? escapeHtml(diagnosis.label) : 'No exact match found';
    result.innerHTML = `
      <div class="debug-result-card">
        <h3>${heading}</h3>
        <p><strong>Problem:</strong> ${escapeHtml(diagnosis.problem)}</p>
        <p><strong>Likely cause:</strong> ${escapeHtml(diagnosis.likelyCause)}</p>
        <strong>Fix steps:</strong>
        <ol>${diagnosis.fixSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
        <p><strong>What to test next:</strong> ${escapeHtml(diagnosis.testNext)}</p>
      </div>
    `;
  });
}

initDebugView();
```

Note: `lib/debug-matcher.js`'s `matchError()` was restructured (Task 5.5, after this task was originally drafted) from a flat `{matched, fix}` shape to `{matched, problem, likelyCause, fixSteps, testNext}` — the code above already reflects the current, correct shape. If you're reading an older version of this plan or any cached copy, do not use a `diagnosis.fix` reference; that field no longer exists on either the matched or fallback return value.

- [ ] **Step 3: Style the Debug panel**

Add to `renderer/style.css`:

```css
#debugInput {
  width: 100%;
  min-height: 120px;
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 10px;
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  resize: vertical;
}

.debug-result-card {
  margin-top: 20px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 16px;
}

.debug-result-card h3 {
  margin: 0 0 8px;
  color: #58a6ff;
}

.debug-result-card p {
  margin: 0 0 8px;
  line-height: 1.5;
}

.debug-result-card ol {
  margin: 4px 0 12px;
  padding-left: 20px;
  line-height: 1.6;
}

.debug-warning {
  margin-top: 32px;
  padding: 16px;
  background: rgba(210, 153, 34, 0.1);
  border: 1px solid #d29922;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
}

.debug-warning ul {
  margin: 8px 0 0;
  padding-left: 20px;
}
```

- [ ] **Step 4: Add script tag**

In `renderer/index.html`, add `<script src="debug-view.js"></script>` after `scripts-view.js`.

- [ ] **Step 5: Manual verification**

Run `npm start`, open the Debug tab, paste a sample error like `Workspace.Part is not a valid member of Model "Workspace"` and click Diagnose — confirm it shows the "X is not a valid member of Y" heading with distinct Problem/Likely cause/Fix steps/What to test next sections populated (not the generic fallback, and not the literal text "undefined" anywhere — that would indicate a stale `.fix` reference). Paste something unrelated (e.g. "asdf") and confirm the generic fallback's four sections appear instead of nothing.

- [ ] **Step 6: Commit**

```bash
git add renderer/index.html renderer/debug-view.js renderer/style.css
git commit -m "Add Debug tab with deterministic error pattern matching"
```

---

### Task 12: README and package metadata

**Files:**
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Rewrite the README's opening to lead with the builder experience**

Replace the first section of `README.md` (title through "What it does") with:

```markdown
# BasePlate - Roblox Vibe Coding Coach

A guided path from "I have a Roblox game idea" to a real build plan, reference Luau scripts, and practical debugging help — built for beginners, not just developers. The existing terminal/Claude Code control center is still here, now under the **Advanced** tab, for anyone who wants direct shell/AI-session access.

See `docs/superpowers/specs/` for design docs and `docs/superpowers/plans/` for implementation plans as they land.

## What it does

- **Idea** — describe your game in your own words and pick genre/feature chips (Simulator, Obby, Tycoon, Pet Game, Fighting Arena, Round-Based Minigame, Leaderstats, Shop, Data Saving, UI Polish).
- **Plan** — a deterministically generated (no AI call) build plan: concept summary, core loop, Roblox services you'll need, an Explorer-style folder tree, a setup checklist, a playtest checklist that explicitly calls out multi-player testing, and client/server safety notes.
- **Scripts** — 4 ready-to-use reference Luau scripts (leaderstats, a collectible pickup, a sell zone, a currency display) with filename, exact Studio placement path, purpose, one-click copy for code and path, and a persisted "tested" checkbox per script.
- **Debug** — paste a Roblox Studio Output error and get a structured diagnosis (problem, likely cause, fix steps, what to test next) for the most common beginner mistakes (nil indexing, missing members, infinite yields, RemoteEvent issues, DataStore problems, wrong script type/location).
- **Advanced** — the original terminal/Claude Code control center: real pty-backed terminal panes, Rojo sync, Play/Test, and the widget dashboard, unchanged.

**Current limitations (MVP):** Plan generation and Scripts are template-based, not AI-generated — they cover common beginner patterns, not every possible game. Debug recognizes 6 specific error signatures; anything else gets general troubleshooting guidance and a pointer to use Advanced's "New Script" for a real Claude Code session on harder problems.
```

Leave everything from "Prerequisites" onward unchanged except the "Extending it" section's Advanced-tab-specific instructions, which still apply as-is (they're about the terminal grid, now inside Advanced, not removed).

- [ ] **Step 2: Update package.json's description**

```json
"description": "BasePlate - Roblox Vibe Coding Coach: a guided Roblox game-building assistant with a terminal/Claude Code control center underneath",
```

(name, productName, appId, and the GitHub `publish.repo` field are unchanged per the spec's explicit scope decision.)

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all `test/*.test.js` files, including the new `plan-generator.test.js`, `debug-matcher.test.js`, and updated `config-store.test.js`, pass with no failures.

- [ ] **Step 4: Commit**

```bash
git add README.md package.json
git commit -m "Update README and package description for the Roblox builder MVP"
```

---

### Task 13: End-to-end verification and changelog

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full manual user-journey verification**

Run `npm start`. Walk through the entire intended flow in one sitting:
1. App opens on the Idea tab by default.
2. Type a game idea, select 2-3 chips across both genre and feature groups, click "Generate Plan."
3. Confirm the Plan tab shows content reflecting your specific choices (not generic placeholder text).
4. Open the Scripts tab, copy one script's code and one script's path, verify both pasted correctly elsewhere. Check one "Tested" box.
5. Open the Debug tab, paste a sample DataStore-related error, confirm the DataStore-specific fix appears.
6. Switch to Advanced, confirm the terminal grid/widgets/toolbar all still work exactly as before this feature existed.
7. Fully quit and relaunch the app. Confirm idea text, chips, plan, and the tested checkbox all survived the restart.

Fix anything that doesn't hold up before considering this task done — do not defer any of these 7 checks.

- [ ] **Step 2: Add a changelog entry**

In `README.md`, add a new line directly under `## Recent Changes`:

```markdown
- **2026-07-07** — Roblox Vibe Coding Coach MVP: added a guided Idea/Plan/Scripts/Debug builder workflow as the app's default experience, with the terminal/Claude Code control center preserved under a new Advanced tab. Deterministic plan generation and error-pattern matching (no AI/network calls); persisted across restarts.
```

- [ ] **Step 3: Run the full test suite one more time**

Run: `npm test`
Expected: PASS, same count as Task 12.

- [ ] **Step 4: Commit and push**

```bash
git add README.md
git commit -m "Update README changelog for Roblox builder MVP"
git push -u origin feature/roblox-builder-mvp
```
