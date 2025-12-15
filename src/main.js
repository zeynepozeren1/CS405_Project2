// src/main.js
import { createGL } from "./gl.js";
import { Renderer } from "./renderer.js";
import { initUI } from "./ui.js";
import { createSmoothCubeMesh } from "./geometry.js";
import { parseOBJ } from "./objLoader.js";

function main() {
  const canvas = document.getElementById("glcanvas");
  const statusEl = document.getElementById("status");
  const fpsEl = document.getElementById("fps");

  const gl = createGL(canvas);
  statusEl.textContent = "WebGL2 OK";

  const renderer = new Renderer(gl, canvas);

  // Default: built-in cube
  const builtinMesh = createSmoothCubeMesh(1.6);
  renderer.setMesh(builtinMesh);

  initUI(renderer);

  //OBJ Loader UI
  const fileInput = document.getElementById("objFile");
  const useBuiltinBtn = document.getElementById("useBuiltinBtn");

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      statusEl.textContent = `Loading OBJ: ${file.name} …`;
      const text = await file.text();
      const mesh = parseOBJ(text, { targetSize: 1.6 });
      renderer.setMesh(mesh);
      statusEl.textContent = `OBJ loaded: ${file.name}`;
    } catch (err) {
      console.error(err);
      statusEl.textContent = `OBJ load error: ${err?.message ?? String(err)}`;
    }
  });

  useBuiltinBtn.addEventListener("click", () => {
    renderer.setMesh(builtinMesh);
    statusEl.textContent = "Using built-in cube";
    if (fileInput) fileInput.value = "";
  });

  //FPS Counter
  let frames = 0;
  let last = performance.now();

  function loop(t) {
    renderer.render(t);
    frames++;

    const dt = t - last;
    if (dt >= 500) {
      const fps = (frames * 1000) / dt;
      fpsEl.textContent = `FPS: ${fps.toFixed(1)}`;
      frames = 0;
      last = t;
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main();
