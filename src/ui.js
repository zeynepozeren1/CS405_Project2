export function initUI(renderer) {
  const shaderSelect = document.getElementById("shaderSelect");
  const compareToggle = document.getElementById("compareToggle");
  const rotateToggle = document.getElementById("rotateToggle");
  const wireOverlay = document.getElementById("wireOverlay");

  const coolColor = document.getElementById("coolColor");
  const warmColor = document.getElementById("warmColor");
  const stepsSlider = document.getElementById("stepsSlider");
  const resetViewBtn = document.getElementById("resetViewBtn");

  // ✅ NEW
  const lineMode = document.getElementById("lineMode");
  const lineThickness = document.getElementById("lineThickness");
  const lineThicknessWrap = document.getElementById("lineThicknessWrap");

  function hexToRgb01(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return [r, g, b];
  }

  function updateControlVisibility() {
    const mode = shaderSelect.value;
    const showGooch = mode === "gooch";
    const showToon = mode === "toon";

    coolColor.parentElement.style.display = showGooch ? "block" : "none";
    warmColor.parentElement.style.display = showGooch ? "block" : "none";
    stepsSlider.parentElement.style.display = showToon ? "block" : "none";

    // ✅ NEW: thickness sadece line açıkken
    const lm = parseInt(lineMode.value, 10);
    lineThicknessWrap.style.display = (lm !== 0) ? "block" : "none";
  }

  shaderSelect.addEventListener("change", (e) => {
    renderer.setShaderMode(e.target.value);
    updateControlVisibility();
  });

  compareToggle.addEventListener("change", (e) => {
    renderer.setCompareMode(e.target.checked);
  });

  rotateToggle.addEventListener("change", (e) => {
    renderer.setAutoRotate(e.target.checked);
  });

  wireOverlay.addEventListener("change", (e) => {
    renderer.setWireOverlay(e.target.checked);
  });

  coolColor.addEventListener("input", (e) => {
    renderer.setGoochCool(hexToRgb01(e.target.value));
  });
  warmColor.addEventListener("input", (e) => {
    renderer.setGoochWarm(hexToRgb01(e.target.value));
  });

  stepsSlider.addEventListener("input", (e) => {
    renderer.setToonSteps(parseFloat(e.target.value));
  });

  resetViewBtn.addEventListener("click", () => renderer.resetView());

  // ✅ NEW: line controls
  lineMode.addEventListener("change", (e) => {
    renderer.setLineMode(parseInt(e.target.value, 10));
    updateControlVisibility();
  });

  lineThickness.addEventListener("input", (e) => {
    renderer.setLineThickness(parseFloat(e.target.value));
  });

  // initial sync
  renderer.setShaderMode(shaderSelect.value);
  renderer.setCompareMode(compareToggle.checked);
  renderer.setAutoRotate(rotateToggle.checked);
  renderer.setWireOverlay(wireOverlay.checked);

  renderer.setGoochCool(hexToRgb01(coolColor.value));
  renderer.setGoochWarm(hexToRgb01(warmColor.value));
  renderer.setToonSteps(parseFloat(stepsSlider.value));

  // ✅ NEW
  renderer.setLineMode(parseInt(lineMode.value, 10));
  renderer.setLineThickness(parseFloat(lineThickness.value));

  updateControlVisibility();
}
