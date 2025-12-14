// src/main.js
import { createGL } from "./gl.js";
import { Renderer } from "./renderer.js";
import { initUI } from "./ui.js";
import { createSphereMesh } from "./geometry.js";

function main() {
  const canvas = document.getElementById("glcanvas");
  const statusEl = document.getElementById("status");

  const gl = createGL(canvas);
  statusEl.textContent = "WebGL2 OK";

  const renderer = new Renderer(gl, canvas);

  // TEK OBJECT: SPHERE
  renderer.setMesh(createSphereMesh(1.7, 32, 32)); // istersen 16,16 yapabilirsin

  initUI(renderer);

  function loop(timeMs) {
    renderer.render(timeMs);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();
