// src/ui.js
export function initUI(renderer) {
  const shaderSelect  = document.getElementById("shaderSelect");
  const compareToggle = document.getElementById("compareToggle");
  const rotateToggle  = document.getElementById("rotateToggle");
  const wireOverlay   = document.getElementById("wireOverlay");

  shaderSelect.addEventListener("change", (e) => {
    renderer.setShaderMode(e.target.value); // şimdilik placeholder
    console.log("Shader selected (placeholder):", e.target.value);
  });

  compareToggle.addEventListener("change", (e) => {
    renderer.setCompareMode(e.target.checked);
    console.log("Compare mode:", e.target.checked);
  });

  rotateToggle.addEventListener("change", (e) => {
    renderer.setAutoRotate(e.target.checked);
    console.log("Auto rotate:", e.target.checked);
  });

  wireOverlay.addEventListener("change", (e) => {
    renderer.setWireOverlay(e.target.checked);
    console.log("Wire overlay:", e.target.checked);
  });

  // initial sync
  renderer.setShaderMode(shaderSelect.value);
  renderer.setCompareMode(compareToggle.checked);
  renderer.setAutoRotate(rotateToggle.checked);
  renderer.setWireOverlay(wireOverlay.checked);
}
