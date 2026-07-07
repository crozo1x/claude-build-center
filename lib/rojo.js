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

module.exports = { checkRojoInstalled };
