window.BuildCenter = window.BuildCenter || {};

(function () {
  const listeners = { planChanged: [], stateLoaded: [] };
  let builderState = { ideaText: '', chips: [], plan: null, scriptsTested: {} };

  function emitPlanChanged() {
    listeners.planChanged.forEach((cb) => cb(builderState.plan));
  }

  function emitStateLoaded() {
    listeners.stateLoaded.forEach((cb) => cb(builderState));
  }

  window.BuildCenter.getBuilderState = function () {
    return builderState;
  };

  window.BuildCenter.setBuilderStateFromConfig = function (builder) {
    builderState = builder || { ideaText: '', chips: [], plan: null, scriptsTested: {} };
    emitPlanChanged();
    emitStateLoaded();
  };

  window.BuildCenter.setBuilderIdeaText = function (ideaText) {
    builderState.ideaText = ideaText;
    window.BuildCenter.saveBuilderState();
  };

  window.BuildCenter.setBuilderChips = function (chips) {
    builderState.chips = chips;
    window.BuildCenter.saveBuilderState();
  };

  window.BuildCenter.setBuilderPlan = function (plan) {
    builderState.plan = plan;
    emitPlanChanged();
    window.BuildCenter.saveBuilderState();
  };

  window.BuildCenter.setScriptTested = function (filename, tested) {
    builderState.scriptsTested[filename] = tested;
    window.BuildCenter.saveBuilderState();
  };

  window.BuildCenter.onBuilderPlanChanged = function (cb) {
    listeners.planChanged.push(cb);
  };

  window.BuildCenter.onBuilderStateLoaded = function (cb) {
    listeners.stateLoaded.push(cb);
  };

  window.BuildCenter.saveBuilderState = async function () {
    try {
      const config = await window.api.config.load();
      config.builder = builderState;
      await window.api.config.save(config);
    } catch (err) {
      console.error('Failed to save builder state:', err);
    }
  };

  window.BuildCenter.escapeHtml = function (str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };
})();

window.BuildCenter.generatePlan = window.api.logic.generatePlan;
window.BuildCenter.matchError = window.api.logic.matchError;
