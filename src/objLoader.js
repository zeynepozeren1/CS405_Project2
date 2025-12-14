// src/objLoader.js
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

function normalize3(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

function add3(a, ax, ay, az) {
  a[0] += ax; a[1] += ay; a[2] += az;
}

function cross(ax, ay, az, bx, by, bz) {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx
  ];
}

export function parseOBJ(text, opts = {}) {
  const targetSize = opts.targetSize ?? 1.6;

  const pos = [];   // [[x,y,z], ...]
  const nor = [];   // [[x,y,z], ...]
  const faces = []; // array of faces, each face: [{vi, ni|null}, ...]

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split(/\s+/);
    const tag = parts[0];

    if (tag === "v" && parts.length >= 4) {
      pos.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (tag === "vn" && parts.length >= 4) {
      const n = normalize3(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      nor.push(n);
    } else if (tag === "f" && parts.length >= 4) {
      // f v/vt/vn or v//vn or v
      const verts = [];
      for (let i = 1; i < parts.length; i++) {
        const tok = parts[i];
        const seg = tok.split("/");
        let vi = parseInt(seg[0], 10);
        let ni = seg.length >= 3 && seg[2] !== "" ? parseInt(seg[2], 10) : null;

        // handle negative indices
        if (vi < 0) vi = pos.length + 1 + vi;
        if (ni !== null && ni < 0) ni = nor.length + 1 + ni;

        // OBJ is 1-based
        vi = vi - 1;
        if (ni !== null) ni = ni - 1;

        verts.push({ vi, ni });
      }
      faces.push(verts);
    }
  }

  if (pos.length === 0 || faces.length === 0) {
    throw new Error("OBJ parse: no vertices/faces found.");
  }

  // Triangulate faces (fan)
  const triFaceVerts = []; // each tri: [{vi,ni},{vi,ni},{vi,ni}]
  for (const f of faces) {
    for (let i = 1; i + 1 < f.length; i++) {
      triFaceVerts.push([f[0], f[i], f[i + 1]]);
    }
  }

  const hasNormals = nor.length > 0 && triFaceVerts.some(t => t[0].ni !== null);

  let outPositions = [];
  let outNormals = [];
  let outIndices = [];

  if (!hasNormals) {
    // Use position index as vertex index; compute smooth normals by accumulation
    outPositions = pos.map(p => p.slice());
    const acc = new Array(pos.length).fill(0).map(() => [0, 0, 0]);

    outIndices = new Array(triFaceVerts.length * 3);
    let k = 0;

    for (const tri of triFaceVerts) {
      const i0 = tri[0].vi, i1 = tri[1].vi, i2 = tri[2].vi;
      outIndices[k++] = i0;
      outIndices[k++] = i1;
      outIndices[k++] = i2;

      const p0 = pos[i0], p1 = pos[i1], p2 = pos[i2];
      const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      const n = cross(e1[0], e1[1], e1[2], e2[0], e2[1], e2[2]);

      add3(acc[i0], n[0], n[1], n[2]);
      add3(acc[i1], n[0], n[1], n[2]);
      add3(acc[i2], n[0], n[1], n[2]);
    }

    outNormals = acc.map(a => normalize3(a[0], a[1], a[2]));
  } else {
    // Build unique vertices by (vi, ni)
    const map = new Map(); // key -> newIndex

    function getIndex(vi, ni) {
      const key = `${vi}/${ni}`;
      const hit = map.get(key);
      if (hit !== undefined) return hit;

      const p = pos[vi];
      const n = nor[ni];

      const newIndex = outPositions.length;
      outPositions.push([p[0], p[1], p[2]]);
      outNormals.push([n[0], n[1], n[2]]);

      map.set(key, newIndex);
      return newIndex;
    }

    for (const tri of triFaceVerts) {
      const a = tri[0], b = tri[1], c = tri[2];
      if (a.ni === null || b.ni === null || c.ni === null) {
        throw new Error("OBJ parse: mixed normals (some faces missing vn). Export with normals or remove vn fully.");
      }
      outIndices.push(getIndex(a.vi, a.ni));
      outIndices.push(getIndex(b.vi, b.ni));
      outIndices.push(getIndex(c.vi, c.ni));
    }
  }

  // Center + scale to target size
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const p of outPositions) {
    minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); minZ = Math.min(minZ, p[2]);
    maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); maxZ = Math.max(maxZ, p[2]);
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;

  const ex = maxX - minX, ey = maxY - minY, ez = maxZ - minZ;
  const extent = Math.max(ex, ey, ez) || 1;
  const s = targetSize / extent;

  for (const p of outPositions) {
    p[0] = (p[0] - cx) * s;
    p[1] = (p[1] - cy) * s;
    p[2] = (p[2] - cz) * s;
  }

  const vCount = outPositions.length;
  if (vCount > 65535) {
    throw new Error(`OBJ too large: ${vCount} vertices (needs Uint32 indices). Use a smaller model.`);
  }

  // Pack typed arrays
  const positionsFlat = new Float32Array(vCount * 3);
  const normalsFlat = new Float32Array(vCount * 3);

  for (let i = 0; i < vCount; i++) {
    const p = outPositions[i];
    const n = outNormals[i] ?? [0, 1, 0];
    positionsFlat[i * 3 + 0] = p[0];
    positionsFlat[i * 3 + 1] = p[1];
    positionsFlat[i * 3 + 2] = p[2];
    normalsFlat[i * 3 + 0] = n[0];
    normalsFlat[i * 3 + 1] = n[1];
    normalsFlat[i * 3 + 2] = n[2];
  }

  const tri = new Uint16Array(outIndices);
  const lineIndices = buildLineIndicesFromTriangles(tri);

  return {
    positions: positionsFlat,
    normals: normalsFlat,
    indices: tri,
    lineIndices,
  };
}
