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
