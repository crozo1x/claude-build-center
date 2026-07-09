function renderScriptCards() {
  const container = document.getElementById('scriptsContent');
  const state = window.BuildCenter.getBuilderState();
  const escapeHtml = window.BuildCenter.escapeHtml;

  container.innerHTML = window.BuildCenter.SCRIPT_TEMPLATES.map((script, index) => {
    const tested = Boolean(state.scriptsTested[script.filename]);
    return `
      <div class="script-card" data-index="${index}">
        <div class="script-card-header">
          <span class="script-filename">${escapeHtml(script.filename)}</span>
          <label class="script-tested">
            <input type="checkbox" class="script-tested-checkbox" ${tested ? 'checked' : ''} />
            Tested
          </label>
        </div>
        <div class="script-path">${escapeHtml(script.path)}</div>
        <p class="script-purpose">${escapeHtml(script.purpose)}</p>
        <pre class="script-code">${escapeHtml(script.code)}</pre>
        <div class="script-actions">
          <button class="script-copy-code">Copy Code</button>
          <button class="script-copy-path">Copy Path</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.script-card').forEach((card) => {
    const index = Number(card.dataset.index);
    const script = window.BuildCenter.SCRIPT_TEMPLATES[index];

    card.querySelector('.script-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(script.code);
    });
    card.querySelector('.script-copy-path').addEventListener('click', () => {
      navigator.clipboard.writeText(script.path);
    });
    card.querySelector('.script-tested-checkbox').addEventListener('change', (event) => {
      window.BuildCenter.setScriptTested(script.filename, event.target.checked);
    });
  });
}

function initScriptsView() {
  renderScriptCards();
  // Config (and thus scriptsTested) loads asynchronously and can resolve
  // after this first synchronous render, same race idea-view.js handles for
  // ideaText/chips — without this, persisted "Tested" checkboxes silently
  // stay unchecked in the UI after an app restart even though the
  // underlying builder state loaded correctly.
  window.BuildCenter.onBuilderStateLoaded(renderScriptCards);
}

initScriptsView();
