let grid;

const WIDGET_CATALOG = [];

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
  catalogEntry.render(bodyEl);
  el.querySelector('.widget-close').addEventListener('click', () => {
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
  window.api.config.save({ projectFolder: window.BuildCenter.getProjectFolder(), widgets: items });
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
  const config = await window.api.config.load();
  window.BuildCenter.setProjectFolder(config.projectFolder);
  grid = GridStack.init({ float: true, cellHeight: 80, column: 12 }, '#widgetCanvas');
  config.widgets.forEach((w) => addWidgetToGrid(w.type, w));
  grid.on('change', persistConfig);
  buildWidgetPicker();
  document.getElementById('btnAddWidget').addEventListener('click', toggleWidgetPicker);
  window.BuildCenter.persistConfig = persistConfig;
}

initWidgets();
