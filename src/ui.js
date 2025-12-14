// src/ui.js
export function initUI(renderer) {
  const shaderSelect = document.getElementById("shaderSelect");
  const compareToggle = document.getElementById("compareToggle");
  const rotateToggle = document.getElementById("rotateToggle");
  const wireOverlay = document.getElementById("wireOverlay");

  const coolColor = document.getElementById("coolColor");
  const warmColor = document.getElementById("warmColor");
  const stepsSlider = document.getElementById("stepsSlider");
  const resetViewBtn = document.getElementById("resetViewBtn");

  // Lines
  const lineMode = document.getElementById("lineMode");
  const lineThickness = document.getElementById("lineThickness");
  const edgeThreshold = document.getElementById("edgeThreshold");

  const lineThicknessWrap = document.getElementById("lineThicknessWrap");
  const edgeThresholdWrap = document.getElementById("edgeThresholdWrap");

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

    // Gooch controls
    coolColor.parentElement.style.display = showGooch ? "block" : "none";
    warmColor.parentElement.style.display = showGooch ? "block" : "none";

    // Toon steps
    stepsSlider.parentElement.style.display = showToon ? "block" : "none";

    // Lines visibility rules
    const lm = parseInt(lineMode.value, 10);
    const screen = (lm === 2 || lm === 3);
    lineThicknessWrap.style.display = (lm !== 0) ? "block" : "none";
    edgeThresholdWrap.style.display = screen ? "block" : "none";
  }

  // shading model
  shaderSelect.addEventListener("change", (e) => {
    renderer.setShaderMode(e.target.value);
    updateControlVisibility();
  });

  // compare
  compareToggle.addEventListener("change", (e) => {
    renderer.setCompareMode(e.target.checked);
  });

  // rotate
  rotateToggle.addEventListener("change", (e) => {
    renderer.setAutoRotate(e.target.checked);
  });

  // wire overlay
  wireOverlay.addEventListener("change", (e) => {
    renderer.setWireOverlay(e.target.checked);
  });

  // gooch colors
  coolColor.addEventListener("input", (e) => {
    renderer.setGoochCool(hexToRgb01(e.target.value));
  });
  warmColor.addEventListener("input", (e) => {
    renderer.setGoochWarm(hexToRgb01(e.target.value));
  });

  // toon steps
  stepsSlider.addEventListener("input", (e) => {
    renderer.setToonSteps(parseFloat(e.target.value));
  });

  // reset view
  resetViewBtn.addEventListener("click", () => {
    renderer.resetView();
  });

  // line mode
  lineMode.addEventListener("change", (e) => {
    const v = parseInt(e.target.value, 10);
    renderer.setLineMode(v);
    updateControlVisibility();
  });

  // line thickness
  lineThickness.addEventListener("input", (e) => {
    renderer.setLineThickness(parseFloat(e.target.value));
  });

  // edge threshold (screen-space)
  edgeThreshold.addEventListener("input", (e) => {
    renderer.setEdgeThreshold?.(parseFloat(e.target.value));
  });

  // initial sync
  renderer.setShaderMode(shaderSelect.value);
  renderer.setCompareMode(compareToggle.checked);
  renderer.setAutoRotate(rotateToggle.checked);
  renderer.setWireOverlay(wireOverlay.checked);

  renderer.setGoochCool(hexToRgb01(coolColor.value));
  renderer.setGoochWarm(hexToRgb01(warmColor.value));
  renderer.setToonSteps(parseFloat(stepsSlider.value));

  renderer.setLineMode(parseInt(lineMode.value, 10));
  renderer.setLineThickness(parseFloat(lineThickness.value));
  renderer.setEdgeThreshold?.(parseFloat(edgeThreshold.value));

  updateControlVisibility();
}
