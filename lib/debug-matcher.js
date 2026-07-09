// NOTE: Pattern order matters. `not-valid-member` only matches "is not a
// valid member of" (with "member of"), so it correctly never catches
// "is not a valid Script" (handled by `wrong-script-location`) without
// needing any exclusion logic. If you add a new pattern whose regex could
// also match "is not a valid Script"-style text, place it carefully relative
// to `wrong-script-location`, or this distinction can silently break.
//
// `humanoid-timing` is a narrower variant of the same "is not a valid member
// of" wording, specific to a Humanoid not existing yet at character-spawn
// time — it's placed BEFORE `not-valid-member` so `.find()` picks the more
// specific, more actionable diagnosis first for that one case.
//
// `call-nil`'s regex ("attempt to call a nil value") also matches real-world
// RemoteEvent/DataStore error text that happens to be phrased that way (e.g.
// "attempt to call a nil value (RemoteEvent is not a valid member)"), so it's
// placed AFTER `remote-event` and `datastore` — those more specific
// diagnoses should win when both match.
const ERROR_PATTERNS = [
  {
    id: 'index-nil',
    test: (text) => /attempt to index nil/i.test(text),
    label: 'Attempt to index nil',
    problem: 'You tried to use a variable that turned out to be nil (empty) as if it were an object — e.g. `workspace.Part.Name` when "Part" doesn\'t exist under Workspace yet.',
    likelyCause: 'Something the script expected to already exist (an instance, a child, a returned value) wasn\'t there yet when this line ran, or was never created at all.',
    fixSteps: [
      'Check the exact spelling/case of every name in the chain (Roblox names are case-sensitive).',
      'Check whether the object exists yet when this line runs — use WaitForChild instead of direct indexing for anything that might load late.',
      'The line number tells you exactly which variable was nil — read that line carefully to identify which part of the chain failed.',
    ],
    testNext: 'Re-run the script and confirm the same line no longer errors; if it\'s inside a function called multiple times, trigger it from every path that calls it, not just the first one.',
  },
  {
    id: 'humanoid-timing',
    test: (text) => /humanoid is not a valid member/i.test(text),
    label: 'Humanoid not found yet (character loading timing)',
    problem: 'A script tried to reach a player\'s Humanoid before their character had actually finished loading.',
    likelyCause: 'Character models load asynchronously — a script that runs once at the top level and immediately indexes `player.Character.Humanoid` can execute before the character (and its Humanoid) exists, especially right after PlayerAdded or on a respawn.',
    fixSteps: [
      'Use `player.CharacterAdded:Connect(function(character) ... end)` instead of assuming `player.Character` already exists.',
      'Inside that handler, use `character:WaitForChild("Humanoid")` rather than indexing it directly, in case the Humanoid itself hasn\'t replicated yet.',
      'If you need the CURRENT character on script start, check `player.Character` first and fall back to `CharacterAdded` if it\'s nil.',
    ],
    testNext: 'Playtest joining, dying, and respawning at least once — this bug often only shows up on respawn, not on first join.',
  },
  {
    id: 'not-valid-member',
    test: (text) => /is not a valid member of/i.test(text),
    label: 'X is not a valid member of Y',
    problem: 'You referenced a child object or property that doesn\'t exist under the given parent.',
    likelyCause: 'Either the name is misspelled/miscapitalized, the object was renamed in Studio\'s Explorer without updating the script, or another script creates that object but hasn\'t run yet.',
    fixSteps: [
      'Check the exact spelling and capitalization of the member name (Roblox names are case-sensitive).',
      'Check whether you renamed something in Studio\'s Explorer without updating the script that references it.',
      'Check whether the object is created by another script that hasn\'t run yet — if so, wait for it (e.g. WaitForChild) instead of indexing it immediately.',
    ],
    testNext: 'Re-run the script and confirm the reference now resolves; also check the Explorer at runtime to verify the object exists under the parent you expect, with the exact name your script uses.',
  },
  {
    id: 'infinite-yield',
    test: (text) => /infinite yield possible/i.test(text),
    label: 'Infinite yield possible',
    problem: 'A WaitForChild (or similar wait) is stuck because the thing it\'s waiting for never appears.',
    likelyCause: 'The path or name being waited on is wrong, the object was never actually created, or the object only exists on the other side of the client/server boundary from where you\'re waiting.',
    fixSteps: [
      'Check that the path/name you\'re waiting for is spelled correctly.',
      'Check whether the object is actually supposed to exist there at all.',
      'Check whether you\'re waiting on the client for something only the server creates (or vice versa) — instances need to replicate across that boundary first.',
    ],
    testNext: 'Re-run the script and confirm the warning no longer appears in the Output window, and that whatever code runs after the wait actually executes (add a temporary print after it if you\'re not sure).',
  },
  {
    id: 'remote-event',
    test: (text) => /remoteevent/i.test(text),
    label: 'Missing or misused RemoteEvent',
    problem: 'A script tried to use a RemoteEvent — the mechanism client and server scripts use to talk to each other — that doesn\'t exist or isn\'t where it\'s expected.',
    likelyCause: 'The RemoteEvent instance was never created in ReplicatedStorage, or the client and server scripts reference different paths/names for it.',
    fixSteps: [
      'Check that the RemoteEvent instance actually exists in ReplicatedStorage.',
      'Check that both client and server reference the exact same path and name.',
      'Never trust data the CLIENT sends via a RemoteEvent without validating it on the server — treat every argument as untrusted input.',
    ],
    testNext: 'Fire the RemoteEvent from the client and confirm the server-side handler runs (add a temporary print), then confirm behavior is correct with 2+ simulated players, not just one.',
  },
  {
    id: 'datastore',
    test: (text) => /datastore/i.test(text),
    label: 'DataStore problem',
    problem: 'A DataStore read or write didn\'t behave as expected — either it was rejected, throttled, or the environment isn\'t set up to allow it.',
    likelyCause: 'Most often this is Studio\'s API access setting being off, calls being made too frequently, or a DataStore call that wasn\'t wrapped in pcall so a transient failure crashed the script.',
    fixSteps: [
      'Check that "Enable Studio Access to API Services" is on in Game Settings > Security.',
      'Check that every DataStore call is wrapped in pcall so a failure doesn\'t crash your script.',
      'Check that you\'re not calling DataStore methods too frequently — save periodically and on PlayerRemoving, not on every small change.',
    ],
    testNext: 'Playtest saving, leaving, and rejoining to confirm data actually persists, and temporarily log the pcall\'s success/failure to confirm you\'re not silently swallowing a real error.',
  },
  {
    id: 'wrong-script-location',
    test: (text) => /is not a valid script|expected script|is not a valid Script/i.test(text),
    label: 'Script in the wrong location / wrong script type',
    problem: 'A script is either the wrong type for what it\'s trying to do, or placed somewhere Roblox won\'t run it as expected.',
    likelyCause: 'Roblox has 3 script types (Script, LocalScript, ModuleScript) and each only runs in specific places — mixing them up (e.g. a LocalScript in ServerScriptService) means the code silently never executes, or executes in the wrong context.',
    fixSteps: [
      'For server logic, use a Script in ServerScriptService.',
      'For client/UI logic, use a LocalScript under StarterPlayerScripts.',
      'For shared reusable code, use a ModuleScript in ReplicatedStorage, required by both sides.',
    ],
    testNext: 'Re-run the script and confirm it now executes on the side (client or server) you expect — add a temporary print at the top of the script to verify it actually runs at all.',
  },
  {
    id: 'call-nil',
    test: (text) => /attempt to call a nil value/i.test(text),
    label: 'Attempt to call a nil value',
    problem: 'You tried to call something as a function — `SomeTable.DoThing()` or `event:Connect()` — but it doesn\'t exist, so there was nothing to call.',
    likelyCause: 'Almost always a typo in a method or function name (e.g. `:Conect(` instead of `:Connect(`), or a table/module that failed to load and returned nil instead of the functions you expected.',
    fixSteps: [
      'Check the exact spelling and capitalization of the method/function name — Roblox API names are case-sensitive and typos here are extremely common.',
      'If this is your own function or a required ModuleScript, confirm the module actually returns a table with that function on it, and that requiring it didn\'t error.',
      'The error text names what was nil (a global, a field, or a method) — that tells you exactly what to check first.',
    ],
    testNext: 'Re-run the script and confirm this line executes without erroring, then confirm whatever the call was supposed to do actually happened (add a temporary print if it\'s not visually obvious).',
  },
  {
    id: 'parent-locked',
    test: (text) => /parent property.*is locked|parent is locked/i.test(text),
    label: 'The Parent property is locked',
    problem: 'A script tried to parent an instance somewhere Roblox doesn\'t allow — either a protected service, or a spot that\'s locked while something else (often Roblox itself) is still setting things up.',
    likelyCause: 'Common causes: parenting to Workspace.Terrain, parenting to a service before the game has finished loading, or trying to parent something a security check (like a LocalScript reaching into ServerStorage) correctly blocked.',
    fixSteps: [
      'Check exactly what you\'re parenting to — Terrain and some services reject direct children.',
      'If this runs very early (e.g. at the top of a script, before `game:IsLoaded()`), try waiting for `game.Loaded` or moving the parenting later.',
      'If a LocalScript is trying to reach a server-only location (ServerStorage, ServerScriptService), that\'s expected to fail — move that logic to the server instead.',
    ],
    testNext: 'Re-run and confirm the instance actually appears where you expect it in the Explorer, not just that the error is gone.',
  },
  {
    id: 'http-not-enabled',
    test: (text) => /http requests are not enabled/i.test(text),
    label: 'HTTP requests are not enabled',
    problem: 'A script called HttpService (or something using it, like an API wrapper) to make a web request, but the game hasn\'t allowed that yet.',
    likelyCause: 'Roblox disables outgoing HTTP requests per-game by default; this specific setting has to be turned on before HttpService will do anything.',
    fixSteps: [
      'In Studio, go to Game Settings > Security and enable "Allow HTTP Requests".',
      'Confirm you\'re testing in a context where that setting applies — some API-key-based testing flows need the game published first.',
      'Never put real API keys or secrets directly in a LocalScript — HttpService calls belong in server-side Scripts only.',
    ],
    testNext: 'Re-run the request and confirm it actually returns data (print the response), not just that the "not enabled" error is gone.',
  },
];

function matchError(outputText) {
  const text = (outputText || '').trim();
  if (!text) {
    return { matched: false, ...genericFallback() };
  }
  const found = ERROR_PATTERNS.find((p) => p.test(text));
  if (found) {
    return {
      matched: true,
      pattern: found.id,
      label: found.label,
      problem: found.problem,
      likelyCause: found.likelyCause,
      fixSteps: found.fixSteps,
      testNext: found.testNext,
    };
  }
  return { matched: false, ...genericFallback() };
}

function genericFallback() {
  return {
    problem: 'This doesn\'t match one of the common patterns this tool recognizes yet.',
    likelyCause: 'The error text uses different wording than the patterns this tool looks for, or it\'s a less common Roblox error not covered by this list.',
    fixSteps: [
      'Check the exact line number and script name in the error.',
      'Check whether the script is a Script, LocalScript, or ModuleScript and whether that matches where it\'s placed.',
      'Check the Output window for any EARLIER errors — the first error in a sequence is often the real cause.',
    ],
    testNext: 'For anything more involved, use "Ask Claude" in the Advanced tab to ask Claude directly with the full error and your script.',
  };
}

module.exports = { matchError, ERROR_PATTERNS };
