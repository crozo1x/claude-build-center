const fs = require('fs');

function defaultConfig() {
  return { projectFolder: null, widgets: [] };
}

function loadConfig(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      projectFolder: typeof parsed.projectFolder === 'string' ? parsed.projectFolder : null,
      widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [],
    };
  } catch (err) {
    return defaultConfig();
  }
}

function saveConfig(filePath, config) {
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = { defaultConfig, loadConfig, saveConfig };
