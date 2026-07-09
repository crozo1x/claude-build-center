function initDebugView() {
  const input = document.getElementById('debugInput');
  const button = document.getElementById('btnDiagnose');
  const result = document.getElementById('debugResult');
  const escapeHtml = window.BuildCenter.escapeHtml;

  button.addEventListener('click', () => {
    const diagnosis = window.BuildCenter.matchError(input.value);
    const heading = diagnosis.matched ? escapeHtml(diagnosis.label) : 'No exact match found';
    result.innerHTML = `
      <div class="debug-result-card">
        <h3>${heading}</h3>
        <p><strong>Problem:</strong> ${escapeHtml(diagnosis.problem)}</p>
        <p><strong>Likely cause:</strong> ${escapeHtml(diagnosis.likelyCause)}</p>
        <strong>Fix steps:</strong>
        <ol>${diagnosis.fixSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
        <p><strong>What to test next:</strong> ${escapeHtml(diagnosis.testNext)}</p>
      </div>
    `;
  });
}

initDebugView();
