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
