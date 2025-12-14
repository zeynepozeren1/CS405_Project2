// src/renderer.js
import { createProgram } from "./gl.js";
import {
  degToRad,
  mat4Multiply,
  mat4Perspective,
  mat4RotateX,
  mat4RotateY,
  mat4Translate,
  mat4ScaleUniform,
} from "./utils.js";

// -------------------- SHADERS --------------------

// ✅ Attribute locations fixed (CRITICAL)
const VS = `#version 300 es
precision highp float;

layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uViewProj;

out vec3 vNormalW;
out vec3 vPosW;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vPosW = wp.xyz;
  vNormalW = mat3(uModel) * aNormal;
  gl_Position = uViewProj * wp;
}
`;

// Main shading (Lambert/Gooch/Toon/Hatch)
// ✅ Toon uses LUT/ramp texture (uRamp)
// ✅ Hatch is student-designed: procedural triplanar cross-hatching
const FS = `#version 300 es
precision highp float;

in vec3 vNormalW;
in vec3 vPosW;

uniform int uMode;        // 0=Lambert, 1=Gooch, 2=Toon, 3=Hatch
uniform int uWire;        // 0=fill, 1=wire overlay

uniform vec3  uBaseColor;
uniform vec3  uCoolColor;
uniform vec3  uWarmColor;
uniform float uSteps;

// Toon LUT
uniform sampler2D uRamp;  // toon LUT (Nx1)

// Student NPR (Hatch) controls
uniform float uHatchScale;     // density
uniform float uHatchWidth;     // line width (in stripe domain)
uniform float uHatchStrength;  // 0..1

out vec4 outColor;

const vec3 lightDir = normalize(vec3(-0.4, 1.0, 0.3));
const vec3 ambient  = vec3(0.10, 0.10, 0.12);

// ------------- Hatch helpers -------------
float stripe1D(float x, float width) {
  float f = abs(fract(x) - 0.5);
  // 1.0 at line center, 0.0 away from line
  return smoothstep(width, 0.0, f);
}

float hatch2D(vec2 uv, float scale, float width, float darkness) {
  // 3 directions: 0°, 45°, 90°
  vec2 d0 = normalize(vec2(1.0, 0.0));
  vec2 d1 = normalize(vec2(0.7071, 0.7071));
  vec2 d2 = normalize(vec2(0.0, 1.0));

  float t0 = dot(uv, d0) * scale;
  float t1 = dot(uv, d1) * scale;
  float t2 = dot(uv, d2) * scale;

  float l0 = stripe1D(t0, width);
  float l1 = stripe1D(t1, width);
  float l2 = stripe1D(t2, width);

  // darker -> more layers appear
  float w1 = smoothstep(0.30, 0.60, darkness);
  float w2 = smoothstep(0.55, 0.85, darkness);

  float lines = max(l0, max(l1 * w1, l2 * w2));
  return clamp(lines, 0.0, 1.0);
}

float triplanarHatch(vec3 posW, vec3 nW, float scale, float width, float darkness) {
  vec3 an = abs(nW);
  float s = an.x + an.y + an.z + 1e-5;
  vec3 w = an / s;

  float hXY = hatch2D(posW.xy, scale, width, darkness); // normal ~Z
  float hXZ = hatch2D(posW.xz, scale, width, darkness); // normal ~Y
  float hYZ = hatch2D(posW.yz, scale, width, darkness); // normal ~X

  // weights: xy uses z, xz uses y, yz uses x
  return hXY * w.z + hXZ * w.y + hYZ * w.x;
}

void main() {
  if (uWire == 1) {
    outColor = vec4(0.2, 0.9, 1.0, 1.0);
    return;
  }

  vec3 N = normalize(vNormalW);
  vec3 L = normalize(lightDir);

  // NOTE: keep raw dot for Gooch (needs -1..1)
  float d = dot(N, L);          // -1..1
  float NdotL = max(d, 0.0);    // 0..1

  vec3 color;

  if (uMode == 0) {
    // Lambert
    vec3 diffuse = uBaseColor * NdotL;
    color = ambient + diffuse;

  } else if (uMode == 1) {
    // Gooch (fixed: use raw dot so cool side actually appears)
    float t = clamp(d * 0.5 + 0.5, 0.0, 1.0);
    vec3 gooch = mix(uCoolColor, uWarmColor, t);
    color = gooch * (0.5 + 0.5 * uBaseColor);

  } else if (uMode == 2) {
    // Toon via LUT texture
    float shade = texture(uRamp, vec2(NdotL, 0.5)).r; // 0..1
    color = ambient + (uBaseColor * shade);

  } else {
    // Student NPR: Procedural Cross-Hatching (triplanar, shadow-dependent)
    float darkness = 1.0 - clamp(NdotL, 0.0, 1.0);

    // "paper + paint" base
    float lit = 0.25 + 0.75 * clamp(NdotL, 0.0, 1.0);
    vec3 paper = ambient + uBaseColor * lit;

    float hatch = triplanarHatch(vPosW, N, uHatchScale, uHatchWidth, darkness);

    vec3 ink = vec3(0.02);
    float a = clamp(uHatchStrength * hatch, 0.0, 1.0);
    color = mix(paper, ink, a);
  }

  outColor = vec4(color, 1.0);
}
`;

// Flipped hull outline
const OUTLINE_FS = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

// Normal+Depth pass to texture (RGBA: normal in rgb, depth in a)
const ND_FS = `#version 300 es
precision highp float;

in vec3 vNormalW;
out vec4 outColor;

void main() {
  vec3 n = normalize(vNormalW);
  vec3 encN = 0.5 * (n + 1.0);  // [-1,1] -> [0,1]
  float depth = gl_FragCoord.z; // non-linear ok for edges
  outColor = vec4(encN, depth);
}
`;

// Fullscreen quad edge detect
const EDGE_VS = `#version 300 es
precision highp float;

layout(location=0) in vec2 aPos;
out vec2 vUV;

void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const EDGE_FS = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 outColor;

uniform sampler2D uND;
uniform vec2 uTexel;        // (1/width, 1/height)
uniform int uEdgeMode;      // 2 = depth, 3 = normal
uniform float uThreshold;   // 0.02..0.6
uniform float uThickness;   // 1..5 (pixels)

vec3 decodeNormal(vec3 enc) {
  return normalize(enc * 2.0 - 1.0);
}

void main() {
  vec2 off = uTexel * uThickness;

  vec4 c   = texture(uND, vUV);
  vec4 cx  = texture(uND, vUV + vec2(off.x, 0.0));
  vec4 cxm = texture(uND, vUV - vec2(off.x, 0.0));
  vec4 cy  = texture(uND, vUV + vec2(0.0, off.y));
  vec4 cym = texture(uND, vUV - vec2(0.0, off.y));

  float edgeValue = 0.0;

  if (uEdgeMode == 2) {
    float d  = c.a;
    float dx = abs(cx.a  - d) + abs(cxm.a - d);
    float dy = abs(cy.a  - d) + abs(cym.a - d);
    edgeValue = dx + dy;
  } else if (uEdgeMode == 3) {
    vec3 n  = decodeNormal(c.rgb);
    vec3 nx = decodeNormal(cx.rgb);
    vec3 nxm= decodeNormal(cxm.rgb);
    vec3 ny = decodeNormal(cy.rgb);
    vec3 nym= decodeNormal(cym.rgb);

    float dx = length(nx - n) + length(nxm - n);
    float dy = length(ny - n) + length(nym - n);
    edgeValue = dx + dy;
  }

  float a = smoothstep(uThreshold, uThreshold * 2.5, edgeValue);
  a = clamp(a, 0.0, 1.0);

  if (a <= 0.001) discard;
  outColor = vec4(0.0, 0.0, 0.0, a);
}
`;

// -------------------- RENDERER --------------------

export class Renderer {
  constructor(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;

    // UI states
    this.autoRotate = true;
    this.wireOverlay = false;
    this.compare = false;

    // Lines
    this.lineMode = 0;          // 0 disabled, 1 hull, 2 depth, 3 normal
    this.lineThickness = 2.0;   // 1..5
    this.edgeThreshold = 0.18;  // 0.02..0.6

    // shading params
    this.mode = 0; // 0 lambert, 1 gooch, 2 toon, 3 hatch
    this.baseColor = new Float32Array([0.20, 0.85, 0.55]);
    this.coolColor = new Float32Array([0x33 / 255, 0x66 / 255, 0xcc / 255]);
    this.warmColor = new Float32Array([0xff / 255, 0xcc / 255, 0x66 / 255]);

    // Student NPR (Hatch) params
    this.hatchScale = 12.0;
    this.hatchWidth = 0.10;
    this.hatchStrength = 0.75;

    // Toon (LUT)
    this.toonSteps = 3.0;
    this.rampSize = 256;
    this.rampTex = this._createToonRampTexture(this.toonSteps);

    // orbit/zoom
    this.yaw = 0.8;
    this.pitch = -0.4;
    this.distance = 4.0;
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this._setupMouse();

    // Programs
    this.program = createProgram(gl, VS, FS);
    this.outlineProgram = createProgram(gl, VS, OUTLINE_FS);
    this.ndProgram = createProgram(gl, VS, ND_FS);
    this.edgeProgram = createProgram(gl, EDGE_VS, EDGE_FS);

    // Uniform locations (main)
    this.loc = {
      uModel: gl.getUniformLocation(this.program, "uModel"),
      uViewProj: gl.getUniformLocation(this.program, "uViewProj"),
      uMode: gl.getUniformLocation(this.program, "uMode"),
      uWire: gl.getUniformLocation(this.program, "uWire"),
      uBaseColor: gl.getUniformLocation(this.program, "uBaseColor"),
      uCoolColor: gl.getUniformLocation(this.program, "uCoolColor"),
      uWarmColor: gl.getUniformLocation(this.program, "uWarmColor"),
      uSteps: gl.getUniformLocation(this.program, "uSteps"),

      // Toon LUT
      uRamp: gl.getUniformLocation(this.program, "uRamp"),

      // Hatch uniforms
      uHatchScale: gl.getUniformLocation(this.program, "uHatchScale"),
      uHatchWidth: gl.getUniformLocation(this.program, "uHatchWidth"),
      uHatchStrength: gl.getUniformLocation(this.program, "uHatchStrength"),
    };

    // Uniform locations (outline)
    this.oLoc = {
      uModel: gl.getUniformLocation(this.outlineProgram, "uModel"),
      uViewProj: gl.getUniformLocation(this.outlineProgram, "uViewProj"),
    };

    // Uniform locations (ND)
    this.ndLoc = {
      uModel: gl.getUniformLocation(this.ndProgram, "uModel"),
      uViewProj: gl.getUniformLocation(this.ndProgram, "uViewProj"),
    };

    // Uniform locations (edge)
    this.eLoc = {
      uND: gl.getUniformLocation(this.edgeProgram, "uND"),
      uTexel: gl.getUniformLocation(this.edgeProgram, "uTexel"),
      uEdgeMode: gl.getUniformLocation(this.edgeProgram, "uEdgeMode"),
      uThreshold: gl.getUniformLocation(this.edgeProgram, "uThreshold"),
      uThickness: gl.getUniformLocation(this.edgeProgram, "uThickness"),
    };

    // Fullscreen quad (VAO)
    this._initQuad();

    // ND framebuffer
    this.ndFBO = null;
    this.ndTex = null;
    this.ndDepth = null;
    this.ndW = 0;
    this.ndH = 0;

    gl.enable(gl.DEPTH_TEST);
  }

  // ---- UI setters ----
  setAutoRotate(on) { this.autoRotate = on; }
  setWireOverlay(on) { this.wireOverlay = on; }
  setCompareMode(on) { this.compare = on; }

  setShaderMode(modeStr) {
    if (modeStr === "lambert") this.mode = 0;
    else if (modeStr === "gooch") this.mode = 1;
    else if (modeStr === "toon") this.mode = 2;
    else if (modeStr === "hatch") this.mode = 3;
    else this.mode = 0;
  }

  setGoochCool(rgb01) { this.coolColor = new Float32Array(rgb01); }
  setGoochWarm(rgb01) { this.warmColor = new Float32Array(rgb01); }

  // Student NPR (Hatch)
  setHatchScale(v) { this.hatchScale = v; }
  setHatchWidth(v) { this.hatchWidth = v; }
  setHatchStrength(v) { this.hatchStrength = v; }

  // ✅ IMPORTANT: steps değişince ramp texture yeniden üretiliyor
  setToonSteps(v) {
    this.toonSteps = v;

    const gl = this.gl;
    if (this.rampTex) gl.deleteTexture(this.rampTex);
    this.rampTex = this._createToonRampTexture(this.toonSteps);
  }

  setLineMode(v) { this.lineMode = v; }
  setLineThickness(v) { this.lineThickness = v; }
  setEdgeThreshold(v) { this.edgeThreshold = v; }

  resetView() {
    this.yaw = 0.8;
    this.pitch = -0.4;
    this.distance = 4.0;
  }

  // ---- Toon LUT texture generator ----
  _createToonRampTexture(steps) {
    const gl = this.gl;

    const size = this.rampSize || 256;
    const data = new Uint8Array(size * 4);

    const s = Math.max(2, Math.floor(steps));

    for (let i = 0; i < size; i++) {
      const x = i / (size - 1);              // 0..1
      const q = Math.floor(x * s) / (s - 1); // quantize
      const v = Math.max(0, Math.min(255, Math.round(q * 255)));

      data[i * 4 + 0] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);

    // band’ler net olsun diye NEAREST
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  // ---- mesh upload ----
  setMesh(mesh) {
    const gl = this.gl;
    this.mesh = mesh;

    // VBOs
    this.posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

    this.nBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);

    // EBOs
    this.iBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    this.indexCount = mesh.indices.length;

    this.wBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.lineIndices, gl.STATIC_DRAW);
    this.wireCount = mesh.lineIndices.length;

    // ✅ VAO fill (location 0/1 fixed)
    this.vaoFill = gl.createVertexArray();
    gl.bindVertexArray(this.vaoFill);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuf);
    gl.bindVertexArray(null);

    // ✅ VAO wire
    this.vaoWire = gl.createVertexArray();
    gl.bindVertexArray(this.vaoWire);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wBuf);
    gl.bindVertexArray(null);
  }

  _initQuad() {
    const gl = this.gl;

    const quad = new Float32Array([
      -1, -1,
       1, -1,
       1,  1,
      -1, -1,
       1,  1,
      -1,  1,
    ]);

    this.quadVAO = gl.createVertexArray();
    this.quadVBO = gl.createBuffer();

    gl.bindVertexArray(this.quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    // ✅ EDGE_VS uses layout(location=0)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  _ensureNDFBO(w, h) {
    const gl = this.gl;
    if (this.ndFBO && this.ndW === w && this.ndH === h) return;

    if (this.ndFBO) {
      gl.deleteFramebuffer(this.ndFBO);
      gl.deleteTexture(this.ndTex);
      gl.deleteRenderbuffer(this.ndDepth);
    }

    this.ndW = w;
    this.ndH = h;

    this.ndFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ndFBO);

    this.ndTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.ndTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.ndDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.ndDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.ndTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.ndDepth);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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

    const wantsScreenEdges = (this.lineMode === 2 || this.lineMode === 3);

    // PASS A: Normal+Depth into FBO
    if (wantsScreenEdges) {
      this._ensureNDFBO(w, h);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.ndFBO);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);

      gl.useProgram(this.ndProgram);
      gl.uniformMatrix4fv(this.ndLoc.uModel, false, model);
      gl.uniformMatrix4fv(this.ndLoc.uViewProj, false, viewProj);

      gl.bindVertexArray(this.vaoFill);
      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // PASS B: Clear viewport (dark background)
    gl.enable(gl.SCISSOR_TEST);
    gl.viewport(x, y, w, h);
    gl.scissor(x, y, w, h);
    gl.clearColor(0.7, 0.5, 0.5, 1.0); // arka plan
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);

    // PASS 0: Flipped hull
    if (this.lineMode === 1) {
      const scaleFactor = 1.0 + this.lineThickness * 0.03;
      const outlineModel = mat4Multiply(model, mat4ScaleUniform(scaleFactor));

      gl.useProgram(this.outlineProgram);
      gl.uniformMatrix4fv(this.oLoc.uModel, false, outlineModel);
      gl.uniformMatrix4fv(this.oLoc.uViewProj, false, viewProj);

      gl.bindVertexArray(this.vaoFill);

      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);
      gl.depthMask(false);

      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

      gl.depthMask(true);
      gl.cullFace(gl.BACK);
      gl.disable(gl.CULL_FACE);

      gl.bindVertexArray(null);
    }

    // PASS 1: Main shading
    gl.useProgram(this.program);

    // ✅ bind toon ramp texture (always bound; only used when uMode==2)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.rampTex);
    gl.uniform1i(this.loc.uRamp, 0);

    gl.uniformMatrix4fv(this.loc.uModel, false, model);
    gl.uniformMatrix4fv(this.loc.uViewProj, false, viewProj);
    gl.uniform1i(this.loc.uMode, modeForThisPass);
    gl.uniform3fv(this.loc.uBaseColor, this.baseColor);
    gl.uniform3fv(this.loc.uCoolColor, this.coolColor);
    gl.uniform3fv(this.loc.uWarmColor, this.warmColor);
    gl.uniform1f(this.loc.uSteps, this.toonSteps);

    // Hatch uniforms (used when uMode==3)
    gl.uniform1f(this.loc.uHatchScale, this.hatchScale);
    gl.uniform1f(this.loc.uHatchWidth, this.hatchWidth);
    gl.uniform1f(this.loc.uHatchStrength, this.hatchStrength);

    gl.bindVertexArray(this.vaoFill);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 1.0);
    gl.uniform1i(this.loc.uWire, 0);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);

    if (this.wireOverlay) {
      gl.bindVertexArray(this.vaoWire);
      gl.uniform1i(this.loc.uWire, 1);
      gl.drawElements(gl.LINES, this.wireCount, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);

    // PASS 2: Screen-space edges overlay
    if (wantsScreenEdges) {
      gl.enable(gl.SCISSOR_TEST);
      gl.viewport(x, y, w, h);
      gl.scissor(x, y, w, h);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);

      gl.useProgram(this.edgeProgram);
      gl.bindVertexArray(this.quadVAO);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.ndTex);
      gl.uniform1i(this.eLoc.uND, 0);

      gl.uniform2f(this.eLoc.uTexel, 1.0 / w, 1.0 / h);
      gl.uniform1i(this.eLoc.uEdgeMode, this.lineMode); // 2 or 3
      gl.uniform1f(this.eLoc.uThreshold, this.edgeThreshold);
      gl.uniform1f(this.eLoc.uThickness, this.lineThickness);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.bindVertexArray(null);

      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.SCISSOR_TEST);
    }
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
      this._drawViewport(0, 0, half, H, 0, timeMs);
      this._drawViewport(half, 0, W - half, H, this.mode, timeMs);
    }
  }
}
