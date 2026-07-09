function renderScriptsToCreate(scriptsToCreate, escapeHtml) {
  const scripts = Array.isArray(scriptsToCreate) ? scriptsToCreate : [];
  if (scripts.length === 0) {
    return '<p class="widget-empty">No specific scripts recommended yet — pick a genre chip on the Idea tab for tailored recommendations.</p>';
  }
  return `<ul>${scripts
    .map(
      (s) =>
        `<li><strong>${escapeHtml(s.name)}</strong> (${escapeHtml(s.type)}) — ${escapeHtml(
          s.path
        )}<br>${escapeHtml(s.purpose)}</li>`
    )
    .join('')}</ul>`;
}

function renderPlan(plan) {
  const container = document.getElementById('planContent');
  if (!plan) {
    container.innerHTML = '<p class="widget-empty">No plan yet — describe your idea and click "Generate Plan" on the Idea tab.</p>';
    return;
  }

  const escapeHtml = window.BuildCenter.escapeHtml;

  container.innerHTML = `
    <h2>Concept</h2>
    <p>${escapeHtml(plan.conceptSummary)}</p>

    <h3>Core Loop</h3>
    <p>${escapeHtml(plan.coreLoop)}</p>

    <h3>Roblox Services You'll Use</h3>
    <ul>${plan.services.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>

    <h3>Object / Folder Tree</h3>
    <pre class="plan-tree">${plan.folderTree.map((line) => escapeHtml(line)).join('\n')}</pre>

    <h3>Scripts to Create</h3>
    ${renderScriptsToCreate(plan.scriptsToCreate, escapeHtml)}

    <h3>Setup Checklist</h3>
    <ol>${plan.setupChecklist.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>

    <h3>Playtest Checklist</h3>
    <ol>${plan.playtestChecklist.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>

    <h3>Client/Server Safety Notes</h3>
    <ul class="safety-notes">${plan.safetyNotes.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
  `;
}

function initPlanView() {
  const state = window.BuildCenter.getBuilderState();
  renderPlan(state.plan);
  window.BuildCenter.onBuilderPlanChanged(renderPlan);
}

initPlanView();
