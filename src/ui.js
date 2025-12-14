// src/ui.js
export function initUI(renderer) {
  // --- shading controls ---
  const shaderSelect  = document.getElementById("shaderSelect");
  const compareToggle = document.getElementById("compareToggle");
  const rotateToggle  = document.getElementById("rotateToggle");
  const wireOverlay   = document.getElementById("wireOverlay");

  const coolColor     = document.getElementById("coolColor");
  const warmColor     = document.getElementById("warmColor");
  const stepsSlider   = document.getElementById("stepsSlider");
  const resetViewBtn  = document.getElementById("resetViewBtn");

  // --- line controls ---
  const lineMode          = document.getElementById("lineMode");
  const lineThickness     = document.getElementById("lineThickness");
  const lineThicknessWrap = document.getElementById("lineThicknessWrap");

  // (optional) screen-space threshold controls (HTML'e eklediysen çalışır)
  const edgeThreshold     = document.getElementById("edgeThreshold");
  const edgeThresholdWrap = document.getElementById("edgeThresholdWrap");

  function hexToRgb01(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return [r, g, b];
  }

  function updateControlVisibility() {
    // shading UI
    const mode = shaderSelect.value;
    const showGooch = mode === "gooch";
    const showToon  = mode === "toon";

    if (coolColor?.parentElement) coolColor.parentElement.style.display = showGooch ? "block" : "none";
    if (warmColor?.parentElement) warmColor.parentElement.style.display = showGooch ? "block" : "none";
    if (stepsSlider?.parentElement) stepsSlider.parentElement.style.display = showToon ? "block" : "none";

    // line UI
    const lm = parseInt(lineMode.value, 10); // 0=off, 1=flipped hull, 2=depth, 3=normal
    if (lineThicknessWrap) lineThicknessWrap.style.display = (lm !== 0) ? "block" : "none";

    // threshold sadece screen-space için (2/3)
    if (edgeThresholdWrap) {
      edgeThresholdWrap.style.display = (lm === 2 || lm === 3) ? "block" : "none";
    }
  }

  // --- events ---
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

  resetViewBtn.addEventListener("click", () => {
    renderer.resetView();
  });

  // line controls
  lineMode.addEventListener("change", (e) => {
    renderer.setLineMode(parseInt(e.target.value, 10));
    updateControlVisibility();
  });

  lineThickness.addEventListener("input", (e) => {
    renderer.setLineThickness(parseFloat(e.target.value));
  });

  // (optional) threshold
  if (edgeThreshold) {
    edgeThreshold.addEventListener("input", (e) => {
      renderer.setEdgeThreshold(parseFloat(e.target.value));
    });
  }

  // --- initial sync ---
  renderer.setShaderMode(shaderSelect.value);
  renderer.setCompareMode(compareToggle.checked);
  renderer.setAutoRotate(rotateToggle.checked);
  renderer.setWireOverlay(wireOverlay.checked);

  renderer.setGoochCool(hexToRgb01(coolColor.value));
  renderer.setGoochWarm(hexToRgb01(warmColor.value));
  renderer.setToonSteps(parseFloat(stepsSlider.value));

  renderer.setLineMode(parseInt(lineMode.value, 10));
  renderer.setLineThickness(parseFloat(lineThickness.value));

  if (edgeThreshold) {
    renderer.setEdgeThreshold(parseFloat(edgeThreshold.value));
  }

  updateControlVisibility();
}
