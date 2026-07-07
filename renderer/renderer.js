const panesEl = document.getElementById('panes');
const shellSelect = document.getElementById('shellSelect');
const btnNewTerminal = document.getElementById('btnNewTerminal');
const btnProjectFolder = document.getElementById('btnProjectFolder');
const projectFolderLabel = document.getElementById('projectFolderLabel');
const btnSyncStudio = document.getElementById('btnSyncStudio');
const btnPlayTest = document.getElementById('btnPlayTest');
const toolbarNotice = document.getElementById('toolbarNotice');
let toolbarNoticeTimer = null;

function showToolbarNotice(html, durationMs) {
  toolbarNotice.innerHTML = html;
  toolbarNotice.classList.remove('hidden');
  if (toolbarNoticeTimer) clearTimeout(toolbarNoticeTimer);
  if (durationMs) {
    toolbarNoticeTimer = setTimeout(() => {
      toolbarNotice.classList.add('hidden');
    }, durationMs);
  }
}

toolbarNotice.addEventListener('click', () => {
  toolbarNotice.classList.add('hidden');
});

function updateProjectFolderUI(folder) {
  projectFolderLabel.textContent = folder || 'No project set';
  btnSyncStudio.disabled = !folder;
  btnSyncStudio.title = folder ? '' : 'Set a project folder first';
  btnPlayTest.disabled = !folder;
  btnPlayTest.title = folder ? '' : 'Set a project folder first';
}

window.BuildCenter.onProjectFolderChanged(updateProjectFolderUI);
updateProjectFolderUI(window.BuildCenter.getProjectFolder());

btnProjectFolder.addEventListener('click', async () => {
  const result = await window.api.project.selectFolder();
  if (result.canceled) return;
  window.BuildCenter.setProjectFolder(result.folder);
  if (window.BuildCenter.persistConfig) window.BuildCenter.persistConfig();
});

const sessions = new Map(); // id -> { term, fitAddon, paneEl }
let counter = 0;

window.api.onData(({ id, data }) => {
  const s = sessions.get(id);
  if (s) s.term.write(data);
});

window.api.onExit(({ id }) => {
  const s = sessions.get(id);
  if (s) {
    const statusEl = s.paneEl.querySelector('.status');
    statusEl.textContent = 'exited';
    s.paneEl.classList.add('exited');
    s.exited = true;
    publishSessions();
  }
});

function makeId() {
  counter += 1;
  return 'term-' + counter + '-' + Date.now();
}

function createPane({ title, autoRun, kind, cwd }) {
  const id = makeId();
  const paneEl = document.createElement('div');
  paneEl.className = 'pane';
  paneEl.innerHTML = `
    <div class="pane-header">
      <span class="title">${title}</span>
      <span class="status"></span>
      <div class="pane-actions">
        <button class="btn-max" title="Maximize / restore">⤢</button>
        <button class="btn-close" title="Close">×</button>
      </div>
    </div>
    <div class="pane-body"></div>
  `;
  panesEl.appendChild(paneEl);

  const term = new Terminal({
    fontSize: 13,
    fontFamily: 'Cascadia Code, Consolas, monospace',
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
    },
    cursorBlink: true,
    scrollback: 5000,
  });
  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(paneEl.querySelector('.pane-body'));
  fitAddon.fit();

  term.onData((data) => window.api.input(id, data));

  sessions.set(id, { term, fitAddon, paneEl, title, kind: kind || 'terminal', exited: false });
  publishSessions();

  window.api.spawn(id, {
    shell: shellSelect.value,
    cols: term.cols,
    rows: term.rows,
    autoRun,
    cwd,
    kind: kind || 'terminal',
  }).then((res) => {
    if (res && res.ok === false) {
      term.write(`\r\n[failed to start shell: ${res.error}]\r\n`);
      paneEl.classList.add('exited');
      const s = sessions.get(id);
      if (s) {
        s.exited = true;
        publishSessions();
      }
    }
  });

  const resizeObserver = new ResizeObserver(() => {
    try {
      fitAddon.fit();
      window.api.resize(id, term.cols, term.rows);
    } catch (e) {
      // ignore transient resize races
    }
  });
  resizeObserver.observe(paneEl.querySelector('.pane-body'));

  paneEl.querySelector('.btn-close').addEventListener('click', () => {
    window.api.kill(id);
    resizeObserver.disconnect();
    term.dispose();
    sessions.delete(id);
    publishSessions();
    paneEl.remove();
  });

  paneEl.querySelector('.btn-max').addEventListener('click', () => {
    document.querySelectorAll('.pane.maximized').forEach((el) => {
      if (el !== paneEl) el.classList.remove('maximized');
    });
    paneEl.classList.toggle('maximized');
    setTimeout(() => fitAddon.fit(), 60);
  });

  paneEl.addEventListener('click', () => term.focus());

  term.focus();
}

function publishSessions() {
  window.BuildCenter.setSessions(
    Array.from(sessions.entries()).map(([id, s]) => ({
      id,
      title: s.title,
      kind: s.kind,
      exited: s.exited,
    }))
  );
}

btnNewTerminal.addEventListener('click', () => {
  createPane({ title: 'Terminal' });
});

const btnNewScript = document.getElementById('btnNewScript');

btnNewScript.addEventListener('click', () => {
  createPane({ title: 'New Script', autoRun: 'claude' });
});

btnSyncStudio.addEventListener('click', async () => {
  const installed = await window.api.rojo.checkInstalled();
  if (!installed.installed) {
    showToolbarNotice(
      'Rojo not found — see the <a href="https://rojo.space/docs/installation/" target="_blank">install guide</a>',
      null
    );
    return;
  }
  const folder = window.BuildCenter.getProjectFolder();
  createPane({ title: 'Sync to Studio', kind: 'sync-to-studio', autoRun: 'rojo serve', cwd: folder });
});

btnPlayTest.addEventListener('click', async () => {
  const folder = window.BuildCenter.getProjectFolder();
  const result = await window.api.roblox.playTest(folder);
  if (!result.ok) {
    alert('Play/Test failed: ' + result.error);
  }
});

// Start with one plain terminal open so the app isn't empty on launch.
createPane({ title: 'Terminal' });
