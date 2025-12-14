import { createProgram } from "./gl.js";
import {
  degToRad,
  mat4Multiply,
  mat4Perspective,
  mat4RotateX,
  mat4RotateY,
  mat4Translate,
  mat4ScaleUniform, // ✅ NEW
} from "./utils.js";

const VS = `#version 300 es
precision highp float;

in vec3 aPos;
in vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uViewProj;

out vec3 vWorldPos;
out vec3 vNormalW;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = mat3(uModel) * aNormal;
  gl_Position = uViewProj * wp;
}
`;

const FS = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vNormalW;

uniform int uMode;        // 0=Lambert, 1=Gooch, 2=Toon
uniform int uWire;        // 0=fill, 1=wire overlay

uniform vec3  uBaseColor;
uniform vec3  uCoolColor;
uniform vec3  uWarmColor;
uniform float uSteps;

out vec4 outColor;

const vec3 lightDir = normalize(vec3(-0.4, 1.0, 0.3));
const vec3 ambient  = vec3(0.10, 0.10, 0.12);

void main() {
  if (uWire == 1) {
    outColor = vec4(0.2, 0.9, 1.0, 1.0);
    return;
  }

  vec3 N = normalize(vNormalW);
  vec3 L = normalize(lightDir);
  float NdotL = max(dot(N, L), 0.0);

  vec3 color;

  if (uMode == 0) {
    vec3 diffuse = uBaseColor * NdotL;
    color = ambient + diffuse;
  } else if (uMode == 1) {
    float t = clamp(NdotL * 0.5 + 0.5, 0.0, 1.0);
    vec3 gooch = mix(uCoolColor, uWarmColor, t);
    color = gooch * (0.5 + 0.5 * uBaseColor);
  } else {
    float steps = max(uSteps, 2.0);
    float q = floor(NdotL * steps) / (steps - 1.0);
    q = clamp(q, 0.0, 1.0);
    color = ambient + (uBaseColor * q);
  }

  outColor = vec4(color, 1.0);
}
`;

// ✅ NEW: outline fragment shader
const OUTLINE_FS = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

export class Renderer {
  constructor(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;

    // UI states
    this.autoRotate = true;
    this.wireOverlay = false;
    this.compare = false;

    // ✅ NEW: line mode
    this.lineMode = 0;        // 0 disabled, 1 flipped hull
    this.lineThickness = 2.0; // 1..5
    this.edgeThreshold = 0.18;

    // shading params
    this.mode = 0;
    this.baseColor = new Float32Array([0.80, 0.85, 0.95]);
    this.coolColor = new Float32Array([0x33 / 255, 0x66 / 255, 0xcc / 255]);
    this.warmColor = new Float32Array([0xff / 255, 0xcc / 255, 0x66 / 255]);
    this.toonSteps = 3.0;

    // orbit/zoom
    this.yaw = 0.8;
    this.pitch = -0.4;
    this.distance = 4.0;
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this._setupMouse();

    // programs
    this.program = createProgram(gl, VS, FS);
    this.outlineProgram = createProgram(gl, VS, OUTLINE_FS); // ✅ NEW

    // locations (main)
    this.loc = {
      aPos: gl.getAttribLocation(this.program, "aPos"),
      aNormal: gl.getAttribLocation(this.program, "aNormal"),
      uModel: gl.getUniformLocation(this.program, "uModel"),
      uViewProj: gl.getUniformLocation(this.program, "uViewProj"),
      uMode: gl.getUniformLocation(this.program, "uMode"),
      uWire: gl.getUniformLocation(this.program, "uWire"),
      uBaseColor: gl.getUniformLocation(this.program, "uBaseColor"),
      uCoolColor: gl.getUniformLocation(this.program, "uCoolColor"),
      uWarmColor: gl.getUniformLocation(this.program, "uWarmColor"),
      uSteps: gl.getUniformLocation(this.program, "uSteps"),
    };

    // ✅ NEW: locations (outline)
    this.oLoc = {
      uModel: gl.getUniformLocation(this.outlineProgram, "uModel"),
      uViewProj: gl.getUniformLocation(this.outlineProgram, "uViewProj"),
    };

    gl.enable(gl.DEPTH_TEST);
  }

  // ---- UI setters ----
  setAutoRotate(on) { this.autoRotate = on; }
  setWireOverlay(on) { this.wireOverlay = on; }
  setCompareMode(on) { this.compare = on; }

  setLineMode(v) { this.lineMode = v; }                 // 0/1/2/3
  setLineThickness(v) { this.lineThickness = v; }       // 1..5
  setEdgeThreshold(v) { this.edgeThreshold = v; }       // 0.02..0.6


  setShaderMode(modeStr) {
    if (modeStr === "lambert") this.mode = 0;
    else if (modeStr === "gooch") this.mode = 1;
    else if (modeStr === "toon") this.mode = 2;
    else this.mode = 0;
  }

  setGoochCool(rgb01) { this.coolColor = new Float32Array(rgb01); }
  setGoochWarm(rgb01) { this.warmColor = new Float32Array(rgb01); }
  setToonSteps(v) { this.toonSteps = v; }

  resetView() {
    this.yaw = 0.8;
    this.pitch = -0.4;
    this.distance = 4.0;
  }

  setMesh(mesh) {
    const gl = this.gl;
    this.mesh = mesh;

    this.posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

    this.nBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);

    this.iBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    this.indexCount = mesh.indices.length;

    this.wBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.lineIndices, gl.STATIC_DRAW);
    this.wireCount = mesh.lineIndices.length;

    this.vaoFill = gl.createVertexArray();
    gl.bindVertexArray(this.vaoFill);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.enableVertexAttribArray(this.loc.aPos);
    gl.vertexAttribPointer(this.loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuf);
    gl.enableVertexAttribArray(this.loc.aNormal);
    gl.vertexAttribPointer(this.loc.aNormal, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuf);
    gl.bindVertexArray(null);

    this.vaoWire = gl.createVertexArray();
    gl.bindVertexArray(this.vaoWire);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.enableVertexAttribArray(this.loc.aPos);
    gl.vertexAttribPointer(this.loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuf);
    gl.enableVertexAttribArray(this.loc.aNormal);
    gl.vertexAttribPointer(this.loc.aNormal, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wBuf);
    gl.bindVertexArray(null);
  }

  _setupMouse() {
    this.canvas.style.touchAction = "none";

    const onMove = (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      this.yaw += dx * 0.005;
      this.pitch += dy * 0.005;
      this.pitch = Math.max(-1.3, Math.min(0.3, this.pitch));
      e.preventDefault?.();
    };

    const onUp = (e) => {
      this.isDragging = false;
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
      e.preventDefault?.();
    };

    this.canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      try { this.canvas.setPointerCapture(e.pointerId); } catch {}

      window.addEventListener("pointermove", onMove, { passive: false, capture: true });
      window.addEventListener("pointerup", onUp, { passive: false, capture: true });
      window.addEventListener("pointercancel", onUp, { passive: false, capture: true });
      e.preventDefault();
    });

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.distance *= (1 + e.deltaY * 0.001);
      this.distance = Math.max(2.0, Math.min(10.0, this.distance));
    }, { passive: false });

    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  resizeIfNeeded() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  _drawViewport(x, y, w, h, modeForThisPass, timeMs) {
    const gl = this.gl;

    gl.enable(gl.SCISSOR_TEST);
    gl.viewport(x, y, w, h);
    gl.scissor(x, y, w, h);
    gl.clearColor(0.07, 0.08, 0.11, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);

    const aspect = w / h;
    const proj = mat4Perspective(degToRad(60), aspect, 0.1, 100.0);
    const view = mat4Translate(0, 0, -this.distance);

    let ry = this.yaw;
    let rx = this.pitch;
    if (this.autoRotate) {
      const t = timeMs * 0.001;
      ry += t;
      rx += t * 0.7;
    }

    const model = mat4Multiply(mat4RotateY(ry), mat4RotateX(rx));
    const viewProj = mat4Multiply(proj, view);

    // ✅ PASS 0: Flipped Hull outline (object-space)
    if (this.lineMode === 1) {
      const t = this.lineThickness;           // 1..5
      const scaleFactor = 1.0 + t * 0.03;     // demo’daki gibi
      const outlineModel = mat4Multiply(model, mat4ScaleUniform(scaleFactor));

      gl.useProgram(this.outlineProgram);
      gl.uniformMatrix4fv(this.oLoc.uModel, false, outlineModel);
      gl.uniformMatrix4fv(this.oLoc.uViewProj, false, viewProj);

      gl.bindVertexArray(this.vaoFill);

      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);   // only backfaces
      gl.depthMask(false);     // fill pass depth’ini bozma

      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

      gl.depthMask(true);
      gl.cullFace(gl.BACK);
      gl.disable(gl.CULL_FACE);

      gl.bindVertexArray(null);
    }

    // PASS 1: normal fill
    gl.useProgram(this.program);

    gl.uniformMatrix4fv(this.loc.uModel, false, model);
    gl.uniformMatrix4fv(this.loc.uViewProj, false, viewProj);

    gl.uniform1i(this.loc.uMode, modeForThisPass);
    gl.uniform3fv(this.loc.uBaseColor, this.baseColor);
    gl.uniform3fv(this.loc.uCoolColor, this.coolColor);
    gl.uniform3fv(this.loc.uWarmColor, this.warmColor);
    gl.uniform1f(this.loc.uSteps, this.toonSteps);

    gl.bindVertexArray(this.vaoFill);

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 1.0);
    gl.uniform1i(this.loc.uWire, 0);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // wire overlay
    if (this.wireOverlay) {
      gl.bindVertexArray(this.vaoWire);
      gl.uniform1i(this.loc.uWire, 1);
      gl.drawElements(gl.LINES, this.wireCount, gl.UNSIGNED_SHORT, 0);
    }

    gl.bindVertexArray(null);
  }

  render(timeMs) {
    if (!this.mesh) return;

    this.resizeIfNeeded();

    const W = this.canvas.width;
    const H = this.canvas.height;

    if (!this.compare) {
      this._drawViewport(0, 0, W, H, this.mode, timeMs);
    } else {
      const half = Math.floor(W / 2);
      this._drawViewport(0, 0, half, H, 0, timeMs);          // left: Lambert
      this._drawViewport(half, 0, W - half, H, this.mode, timeMs); // right: selected
    }
  }
}
