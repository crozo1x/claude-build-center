const { execFile } = require('child_process');

function checkRojoInstalled(execFileFn = execFile) {
  return new Promise((resolve) => {
    execFileFn('rojo', ['--version'], (err, stdout) => {
      if (err) {
        resolve({ installed: false });
        return;
      }
      resolve({ installed: true, version: stdout.trim() });
    });
  });
}

function classifyRojoLine(line) {
  const text = (line || '').trim();
  if (!text) return null;

  const portMatch = text.match(/port:?\s*(\d+)/i);
  if (/listening/i.test(text) && portMatch) {
    return { type: 'listening', port: Number(portMatch[1]) };
  }

  if (/address already in use|port.*in use/i.test(text)) {
    return { type: 'error', reason: 'port-in-use', raw: text };
  }

  if (/couldn't find|could not find|no project file/i.test(text)) {
    return { type: 'error', reason: 'no-project-file', raw: text };
  }

  if (/^error/i.test(text)) {
    return { type: 'error', reason: 'unknown', raw: text };
  }

  return null;
}

module.exports = { checkRojoInstalled, classifyRojoLine };
