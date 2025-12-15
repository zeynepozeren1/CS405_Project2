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

  // Student NPR section + controls
  const studentNPRTitle = document.getElementById("studentNPRTitle");
  const studentNPRSection = document.getElementById("studentNPRSection");
  const hatchScale = document.getElementById("hatchScale");
  const hatchWidth = document.getElementById("hatchWidth");
  const hatchStrength = document.getElementById("hatchStrength");

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
    const showHatch = mode === "hatch";

    // Gooch controls
    coolColor.parentElement.style.display = showGooch ? "block" : "none";
    warmColor.parentElement.style.display = showGooch ? "block" : "none";

    // Toon steps
    stepsSlider.parentElement.style.display = showToon ? "block" : "none";

    // Student NPR group
    if (studentNPRTitle) studentNPRTitle.style.display = showHatch ? "block" : "none";
    if (studentNPRSection) studentNPRSection.style.display = showHatch ? "block" : "none";

    // Lines visibility rules
    const lm = parseInt(lineMode.value, 10);
    const screen = (lm === 2 || lm === 3);
    lineThicknessWrap.style.display = (lm !== 0) ? "block" : "none";
    edgeThresholdWrap.style.display = screen ? "block" : "none";
  }

  //Events

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

  // Student NPR (Hatch) sliders
  if (hatchScale) {
    hatchScale.addEventListener("input", (e) => {
      renderer.setHatchScale?.(parseFloat(e.target.value));
    });
  }
  if (hatchWidth) {
    hatchWidth.addEventListener("input", (e) => {
      renderer.setHatchWidth?.(parseFloat(e.target.value));
    });
  }
  if (hatchStrength) {
    hatchStrength.addEventListener("input", (e) => {
      renderer.setHatchStrength?.(parseFloat(e.target.value));
    });
  }

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

  // Initial sync 

  renderer.setShaderMode(shaderSelect.value);
  renderer.setCompareMode(compareToggle.checked);
  renderer.setAutoRotate(rotateToggle.checked);
  renderer.setWireOverlay(wireOverlay.checked);

  renderer.setGoochCool(hexToRgb01(coolColor.value));
  renderer.setGoochWarm(hexToRgb01(warmColor.value));
  renderer.setToonSteps(parseFloat(stepsSlider.value));

  // Hatch initial sync (if renderer supports it)
  renderer.setHatchScale?.(parseFloat(hatchScale?.value ?? 12));
  renderer.setHatchWidth?.(parseFloat(hatchWidth?.value ?? 0.1));
  renderer.setHatchStrength?.(parseFloat(hatchStrength?.value ?? 0.75));

  renderer.setLineMode(parseInt(lineMode.value, 10));
  renderer.setLineThickness(parseFloat(lineThickness.value));
  renderer.setEdgeThreshold?.(parseFloat(edgeThreshold.value));

  updateControlVisibility();
}

//Small helpers 
export function degToRad(d) {
  return (d * Math.PI) / 180;
}

export function mat4Identity() {
  return new Float32Array([
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1
  ]);
}

export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c*4 + r] =
        a[0*4 + r] * b[c*4 + 0] +
        a[1*4 + r] * b[c*4 + 1] +
        a[2*4 + r] * b[c*4 + 2] +
        a[3*4 + r] * b[c*4 + 3];
    }
  }
  return out;
}

export function mat4Perspective(fovyRad, aspect, near, far) {
  const f = 1.0 / Math.tan(fovyRad / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = (2 * far * near) * nf;
  return out;
}

export function mat4Translate(tx, ty, tz) {
  const out = mat4Identity();
  out[12] = tx;
  out[13] = ty;
  out[14] = tz;
  return out;
}

export function mat4RotateY(rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return new Float32Array([
     c,0,-s,0,
     0,1, 0,0,
     s,0, c,0,
     0,0, 0,1
  ]);
}

export function mat4RotateX(rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return new Float32Array([
    1,0,0,0,
    0, c, s,0,
    0,-s, c,0,
    0,0,0,1
  ]);
}

export function mat4ScaleUniform(s) {
  return new Float32Array([
    s,0,0,0,
    0,s,0,0,
    0,0,s,0,
    0,0,0,1
  ]);
}
