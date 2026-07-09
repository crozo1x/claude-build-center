function initIdeaView() {
  const ideaTextEl = document.getElementById('ideaText');
  const chipButtons = document.querySelectorAll('.chip');
  const generateBtn = document.getElementById('btnGeneratePlan');

  function hydrateFromState(state) {
    ideaTextEl.value = state.ideaText;
    chipButtons.forEach((btn) => {
      btn.classList.toggle('active', state.chips.includes(btn.dataset.chip));
    });
  }

  hydrateFromState(window.BuildCenter.getBuilderState());
  window.BuildCenter.onBuilderStateLoaded(hydrateFromState);

  let saveTimer = null;
  ideaTextEl.addEventListener('input', () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      window.BuildCenter.setBuilderIdeaText(ideaTextEl.value);
    }, 800);
  });

  chipButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const activeChips = Array.from(document.querySelectorAll('.chip.active')).map((el) => el.dataset.chip);
      window.BuildCenter.setBuilderChips(activeChips);
    });
  });

  generateBtn.addEventListener('click', () => {
    const activeChips = Array.from(document.querySelectorAll('.chip.active')).map((el) => el.dataset.chip);
    const plan = window.BuildCenter.generatePlan({ ideaText: ideaTextEl.value, chips: activeChips });
    window.BuildCenter.setBuilderPlan(plan);
    document.querySelector('.tab-btn[data-tab="plan"]').click();
  });
}

initIdeaView();
