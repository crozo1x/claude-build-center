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
  roundBased: {
    label: 'Round-Based Minigame',
    coreLoop: 'Players join a lobby, a round starts and runs for a fixed time or until a win condition is met, a winner (or winners) is determined and rewarded, then the game resets for the next round.',
    services: ['Teams (for tracking round wins per team)'],
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
    safetyNotes: buildSafetyNotes(),
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

function buildSafetyNotes() {
  return [
    'The server is the only thing that should ever be trusted to decide what actually happens in your game — never let a client tell the server how much currency to award, what item was purchased, or that an action succeeded.',
    'Every RemoteEvent your server listens to should validate its arguments (type, range, ownership) before acting on them, exactly as if the message came from an attacker, not your own game\'s client code.',
    'DataStore calls can fail or be throttled — wrap every read/write in pcall and have a plan for what happens if a save genuinely fails, rather than assuming it always succeeds.',
    'Test any feature involving currency, purchases, or shared state with 2+ real or simulated players before trusting it — client-only testing hides an entire category of Roblox bugs.',
  ];
}

module.exports = { generatePlan, GENRE_TEMPLATES, FEATURE_TEMPLATES };
