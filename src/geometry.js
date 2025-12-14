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

export function createSphereMesh(radius = 1.7, slices = 16, stacks = 16) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let i = 0; i <= stacks; i++) {
    const v = i / stacks;
    const phi = v * Math.PI - Math.PI / 2;

    for (let j = 0; j <= slices; j++) {
      const u = j / slices;
      const theta = u * 2 * Math.PI;

      const x = radius * Math.cos(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi);
      const z = radius * Math.cos(phi) * Math.sin(theta);

      positions.push(x, y, z);

      const len = Math.hypot(x, y, z) || 1.0;
      normals.push(x / len, y / len, z / len);
    }
  }

  const cols = slices + 1;
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const i0 = i * cols + j;
      const i1 = i0 + 1;
      const i2 = i0 + cols;
      const i3 = i2 + 1;

      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  const tri = new Uint16Array(indices);
  const lineIndices = buildLineIndicesFromTriangles(tri);

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: tri,
    lineIndices
  };
}
