// src/main.js
import { createGL } from "./gl.js";
import { Renderer } from "./renderer.js";
import { initUI } from "./ui.js";
import { createSmoothCubeMesh } from "./geometry.js";

function main() {
  const canvas = document.getElementById("glcanvas");
  const statusEl = document.getElementById("status");

  const gl = createGL(canvas);
  statusEl.textContent = "WebGL2 OK";

  const renderer = new Renderer(gl, canvas);

  renderer.setMesh(createSmoothCubeMesh(1.6));

  initUI(renderer);

  function loop(t) {
    renderer.render(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}


main();