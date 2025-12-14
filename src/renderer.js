// src/renderer.js
import { createProgram } from "./gl.js";
import {
  degToRad,
  mat4Multiply,
  mat4Perspective,
  mat4RotateX,
  mat4RotateY,
  mat4Translate,
} from "./utils.js";

const VS = `#version 300 es
precision highp float;

in vec3 aPos;
in vec3 aNormal;

uniform mat4 uMVP;

out vec3 vNormal;

void main() {
  vNormal = aNormal;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
`;

const FS = `#version 300 es
precision highp float;

in vec3 vNormal;

uniform int uWire; // 0=fill, 1=wire overlay
out vec4 outColor;

void main() {
  if (uWire == 1) {
    outColor = vec4(0.2, 0.9, 1.0, 1.0);
    return;
  }

  vec3 N = normalize(vNormal);
  vec3 L = normalize(vec3(0.4, 0.8, 0.2));
  float diff = max(dot(N, L), 0.0);

  vec3 base = vec3(0.2, 0.7, 1.0);
  vec3 color = base * (0.25 + 0.75 * diff);

  outColor = vec4(color, 1.0);
}
`;

export class Renderer {
  constructor(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;

    // UI state (NPR daha yok, placeholder)
    this.shaderMode = "toon";
    this.compareMode = false;

    this.autoRotate = true;
    this.wireOverlay = false;

    // mouse orbit
    this.yaw = 0;
    this.pitch = 0;
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this._setupMouse();

    this.program = createProgram(gl, VS, FS);
    this.uMVP = gl.getUniformLocation(this.program, "uMVP");
    this.uWire = gl.getUniformLocation(this.program, "uWire");
  }

  setShaderMode(mode) { this.shaderMode = mode; }          // placeholder
  setCompareMode(on) { this.compareMode = on; }
  setAutoRotate(on) { this.autoRotate = on; }
  setWireOverlay(on) { this.wireOverlay = on; }

  setMesh(mesh) {
    const gl = this.gl;
    this.mesh = mesh;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    // positions
    this.posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program, "aPos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    // normals
    this.nBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);

    const nLoc = gl.getAttribLocation(this.program, "aNormal");
    gl.enableVertexAttribArray(nLoc);
    gl.vertexAttribPointer(nLoc, 3, gl.FLOAT, false, 0, 0);

    // triangle indices
    this.iBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    this.indexCount = mesh.indices.length;

    // wire indices
    this.wBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.lineIndices, gl.STATIC_DRAW);
    this.wireCount = mesh.lineIndices.length;

    gl.bindVertexArray(null);
  }

  _setupMouse() {
    this.canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener("mouseup", () => (this.isDragging = false));
    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      const s = 0.01;
      this.yaw += dx * s;
      this.pitch += dy * s;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
    });
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

  render(timeMs) {
    const gl = this.gl;
    this.resizeIfNeeded();

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.08, 0.08, 0.10, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // ortak model/view rotate
    const view = mat4Translate(0, 0, -5);

    let ry = this.yaw, rx = this.pitch;
    if (this.autoRotate) {
      const t = timeMs * 0.001;
      ry += t;
      rx += t * 0.7;
    }
    const model = mat4Multiply(mat4RotateY(ry), mat4RotateX(rx));

    if (!this.compareMode) {
      // tek viewport
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      const aspect = this.canvas.width / this.canvas.height;
      const proj = mat4Perspective(degToRad(60), aspect, 0.1, 100.0);
      const mvp = mat4Multiply(proj, mat4Multiply(view, model));

      gl.uniformMatrix4fv(this.uMVP, false, mvp);

      this._drawFill();
      if (this.wireOverlay) this._drawWire();

    } else {
      // compare: sol=fill, sağ=fill+wire (hocanın demo mantığı)
      const W = this.canvas.width;
      const H = this.canvas.height;
      const halfW = Math.floor(W / 2);

      // LEFT
      gl.viewport(0, 0, halfW, H);
      {
        const aspect = halfW / H;
        const proj = mat4Perspective(degToRad(60), aspect, 0.1, 100.0);
        const mvp = mat4Multiply(proj, mat4Multiply(view, model));
        gl.uniformMatrix4fv(this.uMVP, false, mvp);
        this._drawFill();
      }

      // RIGHT
      gl.viewport(halfW, 0, W - halfW, H);
      {
        const aspect = (W - halfW) / H;
        const proj = mat4Perspective(degToRad(60), aspect, 0.1, 100.0);
        const mvp = mat4Multiply(proj, mat4Multiply(view, model));
        gl.uniformMatrix4fv(this.uMVP, false, mvp);
        this._drawFill();
        this._drawWire(); // sağ tarafta always overlay
      }
    }

    gl.bindVertexArray(null);
  }

  _drawFill() {
    const gl = this.gl;
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 1.0);

    gl.uniform1i(this.uWire, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuf);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  _drawWire() {
    const gl = this.gl;
    gl.uniform1i(this.uWire, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wBuf);
    gl.drawElements(gl.LINES, this.wireCount, gl.UNSIGNED_SHORT, 0);
  }
}
