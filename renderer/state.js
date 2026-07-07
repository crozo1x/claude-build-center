window.BuildCenter = (function () {
  const listeners = { sessionsChanged: [], projectFolderChanged: [] };
  let sessions = [];
  let projectFolder = null;

  function emit(event, payload) {
    listeners[event].forEach((cb) => cb(payload));
  }

  return {
    getSessions() {
      return sessions.slice();
    },
    setSessions(next) {
      sessions = next;
      emit('sessionsChanged', sessions);
    },
    onSessionsChanged(cb) {
      listeners.sessionsChanged.push(cb);
    },
    getProjectFolder() {
      return projectFolder;
    },
    setProjectFolder(folder) {
      projectFolder = folder;
      emit('projectFolderChanged', projectFolder);
    },
    onProjectFolderChanged(cb) {
      listeners.projectFolderChanged.push(cb);
    },
  };
})();
