const fs = require('fs');
const path = require('path');
const { findPlaceFile } = require('./find-place-file');

const ROJO_CONFIG_RE = /(^default\.project\.json$|\.project\.json$)/i;
const EXPECTED_SOURCE_DIRS = ['src', 'src/server', 'src/client', 'src/shared'];
const ROBLOX_SERVICE_DIRS = ['ServerScriptService', 'ReplicatedStorage', 'StarterGui', 'StarterPlayer'];

function pathExists(root, relativePath) {
  try {
    return fs.existsSync(path.join(root, relativePath));
  } catch (err) {
    return false;
  }
}

function readRootEntries(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory(),
    isFile: entry.isFile(),
  }));
}

function makeCheck(id, title, status, detail, action) {
  return { id, title, status, detail, action };
}

function summarize(checks) {
  if (checks.some((check) => check.status === 'blocker')) return 'needs-setup';
  if (checks.some((check) => check.status === 'warning')) return 'review';
  return 'ready';
}

function diagnoseProjectFolder(folder) {
  let stat;
  try {
    stat = fs.statSync(folder);
  } catch (err) {
    return {
      ok: false,
      summary: 'needs-setup',
      checks: [
        makeCheck(
          'folder-access',
          'Project folder',
          'blocker',
          'BasePlate could not read this folder.',
          'Choose an existing Roblox project folder.'
        ),
      ],
    };
  }

  if (!stat.isDirectory()) {
    return {
      ok: false,
      summary: 'needs-setup',
      checks: [
        makeCheck(
          'folder-access',
          'Project folder',
          'blocker',
          'This path is not a folder.',
          'Choose the folder that contains your Roblox project files.'
        ),
      ],
    };
  }

  let entries;
  try {
    entries = readRootEntries(folder);
  } catch (err) {
    return {
      ok: false,
      summary: 'needs-setup',
      checks: [
        makeCheck(
          'folder-access',
          'Project folder',
          'blocker',
          'BasePlate could not list files in this folder.',
          'Check folder permissions or choose a different project folder.'
        ),
      ],
    };
  }

  const entryNames = entries.map((entry) => entry.name);
  const placeFile = findPlaceFile(entryNames);
  const rojoConfig = entries.find((entry) => entry.isFile && ROJO_CONFIG_RE.test(entry.name));
  const sourceDirs = EXPECTED_SOURCE_DIRS.filter((relativePath) => pathExists(folder, relativePath));
  const serviceDirs = ROBLOX_SERVICE_DIRS.filter((name) => pathExists(folder, name));
  const hasGit = pathExists(folder, '.git');

  const checks = [];
  checks.push(
    makeCheck(
      'folder-access',
      'Project folder',
      'ok',
      'BasePlate can read this folder.',
      null
    )
  );

  checks.push(
    placeFile
      ? makeCheck('place-file', 'Roblox place file', 'ok', `Found ${placeFile}.`, null)
      : makeCheck(
          'place-file',
          'Roblox place file',
          'warning',
          'No .rbxl or .rbxlx file was found at the project root.',
          'Add a place file or use Rojo with a connected Studio session before pressing Play / Test.'
        )
  );

  checks.push(
    rojoConfig
      ? makeCheck('rojo-config', 'Rojo project config', 'ok', `Found ${rojoConfig.name}.`, null)
      : makeCheck(
          'rojo-config',
          'Rojo project config',
          'warning',
          'No Rojo .project.json file was found at the project root.',
          'Create default.project.json so Sync to Studio knows what to serve.'
        )
  );

  checks.push(
    sourceDirs.length > 0 || serviceDirs.length > 0
      ? makeCheck(
          'source-layout',
          'Script source layout',
          'ok',
          `Found ${sourceDirs.concat(serviceDirs).join(', ')}.`,
          null
        )
      : makeCheck(
          'source-layout',
          'Script source layout',
          'warning',
          'No common Roblox source folders were found.',
          'Add src/server, src/client, or Roblox service folders like ServerScriptService and ReplicatedStorage.'
        )
  );

  checks.push(
    hasGit
      ? makeCheck('git-repo', 'Git repository', 'ok', 'This folder has a .git directory.', null)
      : makeCheck(
          'git-repo',
          'Git repository',
          'warning',
          'This folder is not a git repository.',
          'Use git before larger AI edits so you can review and undo changes safely.'
        )
  );

  return {
    ok: true,
    summary: summarize(checks),
    checks,
  };
}

module.exports = {
  diagnoseProjectFolder,
  EXPECTED_SOURCE_DIRS,
  ROBLOX_SERVICE_DIRS,
};