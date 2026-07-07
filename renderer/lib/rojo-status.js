function computeRojoStatus(sessions) {
  const syncing = (sessions || []).some(
    (s) => s.kind === 'sync-to-studio' && !s.exited
  );
  return { connected: syncing };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeRojoStatus };
} else {
  window.BuildCenter = window.BuildCenter || {};
  window.BuildCenter.computeRojoStatus = computeRojoStatus;
}
