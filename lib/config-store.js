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
        plan: builder.plan && typeof builder.plan === 'object' && !Array.isArray(builder.plan) ? builder.plan : null,
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
