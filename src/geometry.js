// src/geometry.js
function buildLineIndicesFromTriangles(triIndices) {
  const lines = new Uint16Array(triIndices.length * 2);
  let k = 0;
  for (let i = 0; i < triIndices.length; i += 3) {
    const a = triIndices[i];
    const b = triIndices[i + 1];
    const c = triIndices[i + 2];
    lines[k++] = a; lines[k++] = b;
    lines[k++] = b; lines[k++] = c;
    lines[k++] = c; lines[k++] = a;
  }
  return lines;
}

export function createSphereMesh(radius = 1.0, slices = 48, stacks = 32) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let i = 0; i <= stacks; i++) {
    const v = i / stacks;
    const phi = v * Math.PI; // [0, pi]
    const y = Math.cos(phi);
    const r = Math.sin(phi);

    for (let j = 0; j <= slices; j++) {
      const u = j / slices;
      const theta = u * 2 * Math.PI;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);

      positions.push(radius * x, radius * y, radius * z);
      normals.push(x, y, z);
    }
  }

  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * (slices + 1) + j;
      const b = a + slices + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  const tri = new Uint16Array(indices);
  const lineIndices = buildLineIndicesFromTriangles(tri);

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: tri,
    lineIndices,
  };
}

export function createCubeMesh(size = 1.6) {
  const s = size * 0.5;

  // 6 face * 4 vertex = 24 vertex (hard edges için her yüz ayrı vertex)
  const positions = new Float32Array([
    // +Z (front)
    -s,-s, s,   s,-s, s,   s, s, s,  -s, s, s,
    // -Z (back)
    -s,-s,-s,  -s, s,-s,   s, s,-s,   s,-s,-s,
    // -X (left)
    -s,-s,-s,  -s,-s, s,  -s, s, s,  -s, s,-s,
    // +X (right)
     s,-s,-s,   s, s,-s,   s, s, s,   s,-s, s,
    // +Y (top)
    -s, s,-s,  -s, s, s,   s, s, s,   s, s,-s,
    // -Y (bottom)
    -s,-s,-s,   s,-s,-s,   s,-s, s,  -s,-s, s,
  ]);

  const normals = new Float32Array([
    // +Z
    0,0,1,  0,0,1,  0,0,1,  0,0,1,
    // -Z
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    // -X
    -1,0,0, -1,0,0, -1,0,0, -1,0,0,
    // +X
    1,0,0,  1,0,0,  1,0,0,  1,0,0,
    // +Y
    0,1,0,  0,1,0,  0,1,0,  0,1,0,
    // -Y
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
  ]);

  const idx = [];
  for (let f = 0; f < 6; f++) {
    const o = f * 4;
    idx.push(o, o+1, o+2,  o, o+2, o+3);
  }

  const tri = new Uint16Array(idx);
  const lineIndices = buildLineIndicesFromTriangles(tri);

  return {
    positions,
    normals,
    indices: tri,
    lineIndices,
  };
}
export function createSmoothCubeMesh(size = 1.6) {
  const s = size * 0.5;

  // 8 unique corners
  const positions = new Float32Array([
    -s,-s,-s,   s,-s,-s,   s, s,-s,  -s, s,-s,  // back quad corners
    -s,-s, s,   s,-s, s,   s, s, s,  -s, s, s,  // front quad corners
  ]);

  // corner normals = normalized corner direction
  const normals = new Float32Array([
    -1,-1,-1,  1,-1,-1,  1, 1,-1, -1, 1,-1,
    -1,-1, 1,  1,-1, 1,  1, 1, 1, -1, 1, 1,
  ].map((v, i, arr) => {
    // normalize every triple
    const k = i - (i % 3);
    if (i % 3 !== 0) return v; // we'll normalize after (below)
    const x = arr[k], y = arr[k+1], z = arr[k+2];
    const len = Math.hypot(x,y,z) || 1;
    arr[k]   = x/len;
    arr[k+1] = y/len;
    arr[k+2] = z/len;
    return arr[i];
  }));

  // indices using the 8 corners
  const idx = new Uint16Array([
    // front (4,5,6,7)
    4,5,6,  4,6,7,
    // back (0,1,2,3)
    0,2,1,  0,3,2,
    // left (0,4,7,3)
    0,4,7,  0,7,3,
    // right (1,2,6,5)
    1,6,2,  1,5,6,
    // top (3,7,6,2)
    3,7,6,  3,6,2,
    // bottom (0,1,5,4)
    0,5,1,  0,4,5,
  ]);

  const lineIndices = (function buildLines(tri) {
    const lines = new Uint16Array(tri.length * 2);
    let k = 0;
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i+1], c = tri[i+2];
      lines[k++] = a; lines[k++] = b;
      lines[k++] = b; lines[k++] = c;
      lines[k++] = c; lines[k++] = a;
    }
    return lines;
  })(idx);

  return {
    positions,
    normals,
    indices: idx,
    lineIndices,
  };
}


