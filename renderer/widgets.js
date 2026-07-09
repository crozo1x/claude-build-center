let grid;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderActiveSessions(container) {
  function draw(sessions) {
    if (!sessions || sessions.length === 0) {
      container.innerHTML = '<p class="widget-empty">No sessions open. Use "Ask Claude" or "+ Terminal" above to start one.</p>';
      return;
    }
    container.innerHTML =
      '<ul class="session-list">' +
      sessions
        .map(
          (s) =>
            `<li class="${s.exited ? 'exited' : ''}">${escapeHtml(s.title)} <span class="kind">${escapeHtml(
              s.kind
            )}</span></li>`
        )
        .join('') +
      '</ul>';
  }
  draw(window.BuildCenter.getSessions());
  window.BuildCenter.onSessionsChanged(draw);
  return () => window.BuildCenter.offSessionsChanged(draw);
}

function renderGitStatus(container) {
  async function draw() {
    const folder = window.BuildCenter.getProjectFolder();
    if (!folder) {
      container.innerHTML = '<p class="widget-empty">Set a project folder above to enable this.</p>';
      return;
    }
    const status = await window.api.git.status(folder);
    if (!status.isRepo) {
      container.innerHTML = '<p class="widget-empty">Not a git repository</p>';
      return;
    }
    container.innerHTML = `
      <p class="git-branch">${escapeHtml(status.branch)}</p>
      <p class="git-dirty">${status.dirty ? status.dirtyCount + ' uncommitted change(s)' : 'clean'}</p>
    `;
  }
  draw();
  window.BuildCenter.onProjectFolderChanged(draw);
  const intervalId = setInterval(draw, 5000);
  return () => {
    window.BuildCenter.offProjectFolderChanged(draw);
    clearInterval(intervalId);
  };
}

function renderRojoStatus(container) {
  // Note: 'not-installed' is not a state this widget shows — install
  // detection (Task 6) only runs when "Sync to Studio" is clicked and
  // drives the toolbar notice, not this per-pane status map. Before that
  // click, an uninstalled Rojo looks identical to 'not-started' here.
  const STATE_LABELS = {
    'not-started': 'Not syncing',
    starting: 'Starting…',
    serving: 'Serving',
    error: 'Error',
  };

  function draw(status) {
    const folder = window.BuildCenter.getProjectFolder();
    if (!folder) {
      container.innerHTML = '<p class="widget-empty">Set a project folder above to enable this.</p>';
      return;
    }
    const state = (status && status.state) || 'not-started';
    const label = STATE_LABELS[state] || state;
    const detail = status && status.detail ? ` (${escapeHtml(status.detail)})` : '';
    container.innerHTML = `<p class="rojo-state ${state}">${escapeHtml(label)}${detail}</p>`;
  }

  function refresh() {
    const folder = window.BuildCenter.getProjectFolder();
    if (!folder) {
      draw(null);
      return;
    }
    window.api.rojo.getStatus(folder).then((status) => {
      if (window.BuildCenter.getProjectFolder() === folder) draw(status);
    });
  }

  function onStatus(payload) {
    if (payload.folder === window.BuildCenter.getProjectFolder()) draw(payload);
  }

  refresh();
  const unsubscribeStatus = window.api.rojo.onStatus(onStatus);
  window.BuildCenter.onProjectFolderChanged(refresh);

  return () => {
    unsubscribeStatus();
    window.BuildCenter.offProjectFolderChanged(refresh);
  };
}


function renderProjectDoctor(container) {
  const STATUS_LABELS = {
    ok: 'OK',
    warning: 'Review',
    blocker: 'Blocked',
  };

  function drawEmpty() {
    container.innerHTML = '<p class="widget-empty">Set a project folder above to check Roblox project readiness.</p>';
  }

  function draw(result) {
    if (!result || !Array.isArray(result.checks)) {
      container.innerHTML = '<p class="widget-empty">Project check unavailable.</p>';
      return;
    }

    const summaryLabel = result.summary === 'ready' ? 'Ready' : result.summary === 'review' ? 'Needs review' : 'Needs setup';
    const checksHtml = result.checks
      .map((check) => {
        const status = STATUS_LABELS[check.status] || check.status;
        const action = check.action ? `<p class="project-doctor-action">${escapeHtml(check.action)}</p>` : '';
        return `
          <li class="project-doctor-check ${escapeHtml(check.status)}">
            <div class="project-doctor-row">
              <span class="project-doctor-title">${escapeHtml(check.title)}</span>
              <span class="project-doctor-badge">${escapeHtml(status)}</span>
            </div>
            <p>${escapeHtml(check.detail)}</p>
            ${action}
          </li>
        `;
      })
      .join('');

    container.innerHTML = `
      <p class="project-doctor-summary ${escapeHtml(result.summary)}">${escapeHtml(summaryLabel)}</p>
      <ul class="project-doctor-list">${checksHtml}</ul>
    `;
  }

  async function refresh() {
    const folder = window.BuildCenter.getProjectFolder();
    if (!folder) {
      drawEmpty();
      return;
    }
    try {
      const result = await window.api.project.diagnose(folder);
      if (window.BuildCenter.getProjectFolder() === folder) draw(result);
    } catch (err) {
      container.innerHTML = '<p class="widget-empty">Project check failed.</p>';
    }
  }

  refresh();
  window.BuildCenter.onProjectFolderChanged(refresh);
  const intervalId = setInterval(refresh, 10000);
  return () => {
    window.BuildCenter.offProjectFolderChanged(refresh);
    clearInterval(intervalId);
  };
}
function renderRobloxAnalytics(container) {
  container.innerHTML = '<p class="widget-empty">Coming soon — requires a Roblox Open Cloud API key.</p>';
}

const WIDGET_CATALOG = [
  { type: 'active-sessions', title: 'Active Sessions', render: renderActiveSessions },
  { type: 'project-doctor', title: 'Project Doctor', render: renderProjectDoctor },
  { type: 'git-status', title: 'Git Status', render: renderGitStatus },
  { type: 'rojo-sync-status', title: 'Rojo Sync Status', render: renderRojoStatus },
  { type: 'roblox-analytics', title: 'Roblox Analytics', render: renderRobloxAnalytics },
];

function addWidgetToGrid(type, position) {
  const catalogEntry = WIDGET_CATALOG.find((w) => w.type === type);
  if (!catalogEntry) return null;
  const widgetId = 'widget-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const contentHtml = `
    <div class="widget-card" data-widget-id="${widgetId}" data-widget-type="${type}">
      <div class="widget-header">
        <span class="widget-title">${catalogEntry.title}</span>
        <button class="widget-close" title="Remove widget">×</button>
      </div>
      <div class="widget-body"></div>
    </div>
  `;
  const el = grid.addWidget({
    w: position && position.w ? position.w : 3,
    h: position && position.h ? position.h : 3,
    x: position ? position.x : undefined,
    y: position ? position.y : undefined,
    id: widgetId,
    content: contentHtml,
  });
  const bodyEl = el.querySelector('.widget-body');
  const dispose = catalogEntry.render(bodyEl);
  el.querySelector('.widget-close').addEventListener('click', () => {
    if (typeof dispose === 'function') dispose();
    grid.removeWidget(el);
    persistConfig();
  });
  return widgetId;
}

function persistConfig() {
  const items = grid
    ? grid.getGridItems().map((el) => {
        const node = el.gridstackNode;
        return {
          type: el.querySelector('.widget-card').dataset.widgetType,
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h,
        };
      })
    : [];
  window.api.config
    .save({
      projectFolder: window.BuildCenter.getProjectFolder(),
      widgets: items,
      builder: window.BuildCenter.getBuilderState(),
    })
    .catch((err) => console.error('Failed to save config:', err));
}

function toggleWidgetPicker() {
  document.getElementById('widgetPicker').classList.toggle('hidden');
}

function buildWidgetPicker() {
  const picker = document.getElementById('widgetPicker');
  picker.innerHTML = WIDGET_CATALOG.map(
    (w) => `<button class="widget-picker-option" data-type="${w.type}">${w.title}</button>`
  ).join('');
  picker.querySelectorAll('.widget-picker-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      addWidgetToGrid(btn.dataset.type);
      persistConfig();
      picker.classList.add('hidden');
    });
  });
}

async function initWidgets() {
  let config;
  try {
    config = await window.api.config.load();
  } catch (err) {
    console.error('Failed to load config, starting with defaults:', err);
    config = { projectFolder: null, widgets: [] };
  }
  window.BuildCenter.setProjectFolder(config.projectFolder);
  window.BuildCenter.setBuilderStateFromConfig(config.builder);
  // GridStack v12 defaults to `el.textContent = w.content` (an XSS-safety
  // default) which breaks every widget here, since addWidgetToGrid's
  // `content` is always a developer-authored HTML template (never raw user
  // input) that must be parsed as real DOM so `.widget-body`/`.widget-close`
  // can be found afterward. Opt back into HTML rendering for our own trusted
  // templates.
  GridStack.renderCB = (el, w) => {
    el.innerHTML = w.content || '';
  };
  grid = GridStack.init({ float: true, cellHeight: 80, column: 12 }, '#widgetCanvas');
  config.widgets.forEach((w) => addWidgetToGrid(w.type, w));
  grid.on('change', persistConfig);
  buildWidgetPicker();
  document.getElementById('btnAddWidget').addEventListener('click', toggleWidgetPicker);
  window.BuildCenter.persistConfig = persistConfig;
}

window.BuildCenter.refreshWidgetGrid = function () {
  if (grid) {
    // GridStack v12 renamed onParentResize() to onResize(); the old name
    // doesn't exist and was throwing on every Advanced tab activation,
    // which silently defeated this whole re-fit hook.
    grid.onResize();
  }
};

initWidgets();
