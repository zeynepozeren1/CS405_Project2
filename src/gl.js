//“WebGL’in sinir sistemi”: shader kurma, program oluşturma, FBO/texture gibi temel parçalar.
export function createGL(canvas) {
  const gl = canvas.getContext("webgl2", { antialias: true });

  if (!gl) {
    alert("WebGL2 not supported on this browser/device.");
    throw new Error("WebGL2 not supported");
  }

  console.log("WebGL2 OK:", gl.getParameter(gl.VERSION));
  gl.enable(gl.DEPTH_TEST);

  return gl;
}
export function createShader(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);

  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("Shader compile error:\n" + log);
  }
  return sh;
}

export function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error("Program link error:\n" + log);
  }
  return prog;
}
