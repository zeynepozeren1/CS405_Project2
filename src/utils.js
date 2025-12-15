//src/utils.js
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

