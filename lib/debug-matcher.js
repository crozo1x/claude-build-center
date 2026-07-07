// NOTE: Pattern order matters. `not-valid-member` only matches "is not a
// valid member of" (with "member of"), so it correctly never catches
// "is not a valid Script" (handled by `wrong-script-location`) without
// needing any exclusion logic. If you add a new pattern whose regex could
// also match "is not a valid Script"-style text, place it carefully relative
// to `wrong-script-location`, or this distinction can silently break.
const ERROR_PATTERNS = [
  {
    id: 'index-nil',
    test: (text) => /attempt to index nil/i.test(text),
    label: 'Attempt to index nil',
    fix: 'You tried to use a variable that turned out to be nil (empty) as if it were an object — e.g. `workspace.Part.Name` when "Part" doesn\'t exist under Workspace yet. Check: (1) the exact spelling/case of every name in the chain, (2) whether the object exists yet when this line runs (use WaitForChild instead of direct indexing for anything that might load late), (3) the line number tells you exactly which variable was nil.',
  },
  {
    id: 'not-valid-member',
    test: (text) => /is not a valid member of/i.test(text),
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
