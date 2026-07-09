const GENRE_TEMPLATES = {
  simulator: {
    label: 'Simulator',
    coreLoop: 'Collect resources or currency by repeating a simple action, spend it on upgrades that make the action more efficient, and periodically "rebirth" to reset progress for a permanent multiplier.',
    services: ['ReplicatedStorage (for shared upgrade data)'],
    scripts: [
      {
        name: 'UpgradeConfig',
        path: 'ReplicatedStorage/UpgradeConfig.lua',
        type: 'ModuleScript',
        purpose: 'Shared table of upgrade tiers (cost, effect) that both the server (to apply effects) and client (to display prices) require — one source of truth instead of duplicating numbers in two scripts.',
      },
      {
        name: 'RebirthManager',
        path: 'ServerScriptService/RebirthManager.server.lua',
        type: 'Script',
        purpose: 'Resets a player\'s currency and owned upgrades and grants a permanent multiplier stat when they choose to rebirth. Runs entirely server-side so a client can\'t grant itself extra rebirths.',
      },
    ],
    safetyNote: 'Recompute your per-second earn rate from the player\'s actual owned upgrades server-side on every payout — never trust a client-reported income rate, or a modified client can pay itself unlimited currency.',
    playtestNote: 'Playtest a full rebirth: earn enough to rebirth, confirm currency resets and the multiplier actually applies to future earnings, not just that the button is clickable.',
  },
  obby: {
    label: 'Obby',
    coreLoop: 'Navigate a linear sequence of checkpoints and obstacles, avoiding hazards that reset you to the last checkpoint, until you reach the finish.',
    services: [],
    scripts: [
      {
        name: 'CheckpointManager',
        path: 'ServerScriptService/CheckpointManager.server.lua',
        type: 'Script',
        purpose: 'Watches a Checkpoints folder in Workspace and updates each player\'s SpawnLocation (or a saved checkpoint value) whenever they touch a new checkpoint part, so death/reset always respawns them at the furthest one reached.',
      },
    ],
    safetyNote: 'Keep checkpoint progress authoritative on the server (e.g. an IntValue under the player, or Roblox\'s own SpawnLocation handling) — don\'t let a LocalScript decide which checkpoint the player "reached".',
    playtestNote: 'Playtest touching every checkpoint in order, then deliberately fall in a kill zone or void to confirm you respawn at the LAST checkpoint touched, not the start.',
  },
  tycoon: {
    label: 'Tycoon',
    coreLoop: 'Claim a plot, place generators or droppers that produce cash over time, collect that cash, and spend it on upgrades that unlock more of the plot.',
    services: ['ReplicatedStorage (for purchasable item definitions)'],
    scripts: [
      {
        name: 'PlotManager',
        path: 'ServerScriptService/PlotManager.server.lua',
        type: 'Script',
        purpose: 'Assigns each unclaimed plot in a Plots folder to the first player who touches its claim button, and prevents a second player from claiming a plot that\'s already owned.',
      },
      {
        name: 'DropperPayout',
        path: 'ServerScriptService/DropperPayout.server.lua',
        type: 'Script',
        purpose: 'On a loop, pays each plot owner cash for every dropper/generator they own — the payout rate is computed here, server-side, not reported by the client.',
      },
    ],
    safetyNote: 'Recompute cash-per-second from what the player actually owns, server-side, on every payout — don\'t let the client report its own income rate or claim a plot it doesn\'t already own.',
    playtestNote: 'Playtest with 2 simulated players claiming different plots at the same time to confirm one plot can\'t end up claimed by both.',
  },
  petGame: {
    label: 'Pet Game',
    coreLoop: 'Hatch pets from eggs (often bought with in-game currency), equip a loadout of pets, and use their passive bonuses to earn currency faster.',
    services: ['ReplicatedStorage (for pet definitions and rarities)', 'RemoteEvents for hatch requests'],
    scripts: [
      {
        name: 'PetConfig',
        path: 'ReplicatedStorage/PetConfig.lua',
        type: 'ModuleScript',
        purpose: 'Shared table of pet names, rarities, and drop weights, required by the server (to roll a pet) and client (to display odds) from a single source of truth.',
      },
      {
        name: 'HatchRequest',
        path: 'StarterPlayerScripts/HatchRequest.client.lua',
        type: 'LocalScript',
        purpose: 'Fires a RequestHatch RemoteEvent when the player clicks an egg. Does not decide the outcome — only asks the server to hatch one.',
      },
      {
        name: 'HatchHandler',
        path: 'ServerScriptService/HatchHandler.server.lua',
        type: 'Script',
        purpose: 'The only place a pet is actually rolled: validates the player can afford/owns an egg, then picks a pet from PetConfig using server-side randomness and grants it.',
      },
    ],
    safetyNote: 'Roll pet rarity on the SERVER inside the RemoteEvent handler, never on the client — if the client rolls its own pet and just reports the result, every player can trivially get the rarest pet every time.',
    playtestNote: 'Playtest hatching many times as 2 simulated players simultaneously and confirm rarities still look randomly distributed and no player receives a pet they didn\'t pay for.',
  },
  fightingArena: {
    label: 'Fighting Arena',
    coreLoop: 'Queue into a match against other players, fight using abilities or combat mechanics, and earn currency or rank based on match outcomes.',
    services: ['RemoteEvents for combat actions'],
    scripts: [
      {
        name: 'CombatHandler',
        path: 'ServerScriptService/CombatHandler.server.lua',
        type: 'Script',
        purpose: 'Validates and applies damage from a combat RemoteEvent — always applies the server\'s own damage number for a move, never a client-reported amount.',
      },
    ],
    safetyNote: 'Damage amounts and hit validation must be decided by the server — if the client tells the server "I hit them for 500", apply the server\'s own damage number for that move instead, and use server-side hit detection if precision hits matter.',
    playtestNote: 'Playtest a full match with 2 simulated players including a loss (health hits 0) to confirm the match ends and resets cleanly, not just that a single hit registers.',
  },
  roundBased: {
    label: 'Round-Based Minigame',
    coreLoop: 'Players join a lobby, a round starts and runs for a fixed time or until a win condition is met, a winner (or winners) is determined and rewarded, then the game resets for the next round.',
    services: ['Teams (for tracking round wins per team)'],
    scripts: [
      {
        name: 'RoundManager',
        path: 'ServerScriptService/RoundManager.server.lua',
        type: 'Script',
        purpose: 'The single source of truth for round state (lobby / active / ended). Every other script should read round state from here rather than tracking its own copy.',
      },
    ],
    safetyNote: 'Guard RoundManager against starting a new round while one is already active (a state flag checked before starting) — a duplicate round-start call can otherwise corrupt round state or double-reward the same round.',
    playtestNote: 'Playtest a round ending naturally AND playtest all players leaving mid-round, to confirm the round manager resets cleanly either way instead of getting stuck.',
  },
};

const FEATURE_TEMPLATES = {
  leaderstats: {
    label: 'Leaderstats',
    checklistSetup: 'Create a Script in ServerScriptService that builds a "leaderstats" Folder under each Player on join, with IntValue/NumberValue children for each stat you want visible on the Roblox leaderboard.',
    services: ['Players service (leaderstats convention)'],
    scripts: [
      {
        name: 'Leaderstats',
        path: 'ServerScriptService/Leaderstats.server.lua',
        type: 'Script',
        purpose: 'Creates the "leaderstats" folder Roblox\'s built-in leaderboard looks for, with a Cash stat, on every player join.',
      },
    ],
  },
  shop: {
    label: 'Shop',
    checklistSetup: 'Add a RemoteEvent (e.g. "PurchaseItem") in ReplicatedStorage for purchase requests, and validate every purchase server-side — never trust a client-reported price.',
    services: ['RemoteEvents for purchase requests'],
    scripts: [
      {
        name: 'ShopConfig',
        path: 'ReplicatedStorage/ShopConfig.lua',
        type: 'ModuleScript',
        purpose: 'Shared table of item names and prices, required by both the purchase handler (source of truth for price) and the client shop UI (to display prices).',
      },
      {
        name: 'ShopPurchaseHandler',
        path: 'ServerScriptService/ShopPurchaseHandler.server.lua',
        type: 'Script',
        purpose: 'Handles the PurchaseItem RemoteEvent: looks up the real price from ShopConfig server-side and only deducts currency and grants the item if the player can actually afford it — never trusts a client-sent price.',
      },
    ],
  },
  dataSaving: {
    label: 'Data Saving',
    checklistSetup: 'Use DataStoreService to save player data on PlayerRemoving (and periodically during play) — wrap every DataStore call in pcall so a failure doesn\'t crash your script.',
    services: ['DataStoreService'],
    scripts: [
      {
        name: 'DataManager',
        path: 'ServerScriptService/DataManager.server.lua',
        type: 'Script',
        purpose: 'Loads a player\'s saved data on join and saves it on PlayerRemoving, with every DataStore call wrapped in pcall so a throttled or failed request doesn\'t crash the script.',
      },
    ],
  },
  uiPolish: {
    label: 'UI Polish',
    checklistSetup: 'Build UI in a ScreenGui under StarterGui so it\'s cloned per-player automatically; keep purely visual state client-side and send meaningful actions to the server via RemoteEvents.',
    services: ['StarterGui / ScreenGui'],
    scripts: [
      {
        name: 'CurrencyGui',
        path: 'StarterPlayerScripts/CurrencyGui.client.lua',
        type: 'LocalScript',
        purpose: 'Builds a simple on-screen currency label that reads from leaderstats and updates live — purely visual, never writes to leaderstats itself.',
      },
    ],
  },
};

function generatePlan({ ideaText, chips }) {
  const chipList = Array.isArray(chips) ? chips : [];
  const genreChips = [...new Set(chipList)].filter((c) => GENRE_TEMPLATES[c]);
  const featureChips = [...new Set(chipList)].filter((c) => FEATURE_TEMPLATES[c]);
  const trimmedIdea = (ideaText || '').trim();
  const scriptsToCreate = buildScriptsToCreate(genreChips, featureChips);

  return {
    conceptSummary: buildConceptSummary(genreChips, trimmedIdea),
    coreLoop: buildCoreLoop(genreChips, featureChips, trimmedIdea),
    services: buildServicesList(genreChips, featureChips),
    folderTree: buildFolderTree(scriptsToCreate),
    scriptsToCreate,
    setupChecklist: buildSetupChecklist(featureChips),
    playtestChecklist: buildPlaytestChecklist(genreChips),
    safetyNotes: buildSafetyNotes(genreChips),
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

// One script can appear in both a genre and a feature template (rare, but
// possible as more templates are added); de-duplicate by path so the same
// file isn't listed twice.
function buildScriptsToCreate(genreChips, featureChips) {
  const seenPaths = new Set();
  const scripts = [];
  [...genreChips.map((c) => GENRE_TEMPLATES[c]), ...featureChips.map((c) => FEATURE_TEMPLATES[c])].forEach(
    (template) => {
      (template.scripts || []).forEach((script) => {
        if (seenPaths.has(script.path)) return;
        seenPaths.add(script.path);
        scripts.push(script);
      });
    }
  );
  return scripts;
}

// Derived directly from scriptsToCreate (grouped by top-level Explorer
// folder) rather than a hand-maintained parallel list, so the folder tree
// can never drift out of sync with what's actually recommended — e.g. it no
// longer shows Leaderstats.server.lua unless the leaderstats chip is active.
function buildFolderTree(scriptsToCreate) {
  const STANDARD_FOLDERS = ['ServerScriptService/', 'ReplicatedStorage/', 'StarterGui/', 'Workspace/'];
  const childrenByFolder = new Map();
  const folderOrder = [];

  function ensureFolder(folder) {
    if (!childrenByFolder.has(folder)) {
      childrenByFolder.set(folder, []);
      folderOrder.push(folder);
    }
    return childrenByFolder.get(folder);
  }

  STANDARD_FOLDERS.forEach(ensureFolder);
  scriptsToCreate.forEach((script) => {
    const [topFolder, ...rest] = script.path.split('/');
    ensureFolder(topFolder + '/').push('  ' + rest.join('/'));
  });

  const orderedFolders = [
    ...STANDARD_FOLDERS.filter((f) => folderOrder.includes(f)),
    ...folderOrder.filter((f) => !STANDARD_FOLDERS.includes(f)),
  ];
  return orderedFolders.flatMap((folder) => [folder, ...childrenByFolder.get(folder)]);
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

function buildPlaytestChecklist(genreChips) {
  const checklist = [
    'Playtest solo first (Studio\'s "Play" button) to confirm nothing errors on join.',
    'Playtest with 2+ simulated players (Studio\'s multi-client "Start" test) — many bugs (leaderstats not appearing for the second player, RemoteEvents firing for the wrong player) only show up with multiple clients.',
    'Check the Output window for red error text after every test — silent failures are common in Roblox and easy to miss.',
    'If using DataStores, verify "Enable Studio Access to API Services" is on and playtest saving, leaving, and rejoining to confirm data actually persists.',
  ];
  genreChips.forEach((c) => {
    const note = GENRE_TEMPLATES[c].playtestNote;
    if (note) checklist.push(note);
  });
  return checklist;
}

function buildSafetyNotes(genreChips) {
  const notes = [
    'The server is the only thing that should ever be trusted to decide what actually happens in your game — never let a client tell the server how much currency to award, what item was purchased, or that an action succeeded.',
    'Every RemoteEvent your server listens to should validate its arguments (type, range, ownership) before acting on them, exactly as if the message came from an attacker, not your own game\'s client code.',
    'DataStore calls can fail or be throttled — wrap every read/write in pcall and have a plan for what happens if a save genuinely fails, rather than assuming it always succeeds.',
    'Test any feature involving currency, purchases, or shared state with 2+ real or simulated players before trusting it — client-only testing hides an entire category of Roblox bugs.',
  ];
  genreChips.forEach((c) => {
    const note = GENRE_TEMPLATES[c].safetyNote;
    if (note) notes.push(note);
  });
  return notes;
}

module.exports = { generatePlan, GENRE_TEMPLATES, FEATURE_TEMPLATES };
