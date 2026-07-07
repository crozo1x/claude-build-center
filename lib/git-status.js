function parseGitStatus(branchOutput, statusOutput) {
  const branch = (branchOutput || '').trim();
  if (!branch) {
    return { isRepo: false };
  }
  const lines = (statusOutput || '').split('\n').filter((line) => line.trim().length > 0);
  return {
    isRepo: true,
    branch,
    dirty: lines.length > 0,
    dirtyCount: lines.length,
  };
}

module.exports = { parseGitStatus };
