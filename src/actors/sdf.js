// Signed-distance modeling + Surface Nets meshing. No dependencies, runs in
// the browser or Node. Characters are sculpted from smooth-blended primitives
// and turned into one seamless mesh per body part.

// ---- blending ---------------------------------------------------------------
export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return (a < b ? a : b) - h * h * k * 0.25;
}
export function smax(a, b, k) { return -smin(-a, -b, k); }
export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// ---- primitives (closures: (x, y, z) -> signed distance) --------------------
export function sphere(c, r) {
  const [cx, cy, cz] = c;
  return (x, y, z) => Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) - r;
}

// rot: optional 3x3 row-major matrix mapping world offsets into the ellipsoid frame
export function ellipsoid(c, r, rot = null) {
  const [cx, cy, cz] = c;
  const [rx, ry, rz] = r;
  const rx2 = rx * rx, ry2 = ry * ry, rz2 = rz * rz;
  const rmin = Math.min(rx, ry, rz);
  return (x, y, z) => {
    let px = x - cx, py = y - cy, pz = z - cz;
    if (rot) {
      const lx = rot[0] * px + rot[1] * py + rot[2] * pz;
      const ly = rot[3] * px + rot[4] * py + rot[5] * pz;
      const lz = rot[6] * px + rot[7] * py + rot[8] * pz;
      px = lx; py = ly; pz = lz;
    }
    const k0 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
    const k1 = Math.sqrt((px / rx2) ** 2 + (py / ry2) ** 2 + (pz / rz2) ** 2);
    if (k1 < 1e-12) return -rmin;
    return (k0 * (k0 - 1)) / k1;
  };
}

// Exact round cone (capsule with two radii) after Inigo Quilez
export function roundCone(a, b, r1, r2) {
  const [ax, ay, az] = a;
  const bax = b[0] - ax, bay = b[1] - ay, baz = b[2] - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const srr = Math.sign(rr);
  return (x, y, z) => {
    const pax = x - ax, pay = y - ay, paz = z - az;
    const yy = pax * bax + pay * bay + paz * baz;
    const zz = yy - l2;
    const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const k = srr * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
}

export function capsule(a, b, r) { return roundCone(a, b, r, r); }

export function roundBox(c, half, r, rot = null) {
  const [cx, cy, cz] = c;
  const [hx, hy, hz] = half;
  return (x, y, z) => {
    let px = x - cx, py = y - cy, pz = z - cz;
    if (rot) {
      const lx = rot[0] * px + rot[1] * py + rot[2] * pz;
      const ly = rot[3] * px + rot[4] * py + rot[5] * pz;
      const lz = rot[6] * px + rot[7] * py + rot[8] * pz;
      px = lx; py = ly; pz = lz;
    }
    const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r, qz = Math.abs(pz) - hz + r;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
  };
}

// rotation helpers (row-major 3x3, world -> local)
export function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; }
export function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, s, 0, -s, c]; }
export function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, -s, c, 0, 0, 0, 1]; }

// cheap smooth pseudo-noise in [-1, 1]
export function wobble(x, y, z, f) {
  return (Math.sin(x * f + Math.sin(z * f * 1.31) * 1.7) +
    Math.sin(y * f * 1.13 + Math.sin(x * f * 0.87) * 1.3) +
    Math.sin(z * f * 1.21 + Math.sin(y * f * 1.41) * 1.1)) / 3;
}

// ---- model: an ordered list of nodes -----------------------------------------
// node: { f, op: 'add' | 'sub' | 'int', k, bones?: [[boneIndex, weight], ...], tau?, box: [minx,miny,minz,maxx,maxy,maxz] }
export function compile(nodes, post = null) {
  const n = nodes.length;
  const fs = nodes.map((o) => o.f);
  const ops = new Int8Array(n);
  const ks = new Float64Array(n);
  nodes.forEach((o, i) => { ops[i] = o.op === 'sub' ? 1 : o.op === 'int' ? 2 : 0; ks[i] = o.k || 0; });
  const fn = (x, y, z) => {
    let d = 1e9;
    for (let i = 0; i < n; i++) {
      const di = fs[i](x, y, z);
      const op = ops[i];
      if (op === 0) d = smin(d, di, ks[i]);
      else if (op === 1) d = smax(d, -di, ks[i]);
      else d = smax(d, di, ks[i]);
    }
    return post ? post(d, x, y, z) : d;
  };
  return fn;
}

// Spatially culled evaluation: `make(subset)` builds an SDF closure from a node
// subset; local(box) returns the closure for nodes that can influence the box.
// Nodes far from a block cannot change the result there (their distance is
// larger than the nearest node's plus the blend radius), so skipping them is
// exact for the narrow band and 3-8x faster.
export function localizer(nodes, make, margin) {
  const full = make(nodes);
  const memo = new Map();
  const boxes = nodes.map((o) => o.box || null);
  return {
    full,
    local(box) {
      const keep = [];
      for (let i = 0; i < nodes.length; i++) {
        const b = boxes[i];
        if (!b) { keep.push(i); continue; }
        const m = margin + (nodes[i].k || 0);
        if (b[0] - m > box[3] || b[3] + m < box[0] || b[1] - m > box[4] || b[4] + m < box[1] || b[2] - m > box[5] || b[5] + m < box[2]) continue;
        keep.push(i);
      }
      if (!keep.length) return full;
      const key = keep.join(',');
      let fn = memo.get(key);
      if (!fn) { fn = make(keep.map((i) => nodes[i])); memo.set(key, fn); }
      return fn;
    },
  };
}

export function compileLocal(nodes, margin, post = null) {
  return localizer(nodes, (sub) => compile(sub, post), margin);
}

// AABB of a node list (with padding)
export function boundsOf(nodes, pad = 0.02) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const o of nodes) {
    if (o.op === 'sub' || !o.box) continue;
    for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], o.box[i]); b[i + 3] = Math.max(b[i + 3], o.box[i + 3]); }
  }
  return [b[0] - pad, b[1] - pad, b[2] - pad, b[3] + pad, b[4] + pad, b[5] + pad];
}

export function boxSphere(c, r) { return [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r]; }
export function boxSeg(a, b, r) {
  return [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r];
}

// ---- time slicing --------------------------------------------------------------
// Long builds are generators that yield when `slice.due` (a performance.now()
// timestamp) has passed, so meshing can be spread over many frames.
export const slice = { due: Infinity };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
export function overdue() { return slice.due !== Infinity && now() > slice.due; }
export function runSync(gen) {
  const prev = slice.due;
  slice.due = Infinity;
  try {
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
  } finally { slice.due = prev; }
}

// ---- Surface Nets ------------------------------------------------------------
// sdf: (x,y,z)=>d ; bounds: [minx,miny,minz,maxx,maxy,maxz] ; h: cell size
// opts.local(box) -> sdf restricted to nodes near `box` (see localizer)
export function surfaceNets(sdf, bounds, h, opts = {}) { return runSync(surfaceNetsGen(sdf, bounds, h, opts)); }

export function* surfaceNetsGen(sdf, bounds, h, opts = {}) {
  const lip = opts.lipschitz || 1.15;
  const local = opts.local || null;
  const B = 4;
  const [x0, y0, z0] = bounds;
  const nx = Math.max(2, Math.ceil((bounds[3] - x0) / h) + 1);
  const ny = Math.max(2, Math.ceil((bounds[4] - y0) / h) + 1);
  const nz = Math.max(2, Math.ceil((bounds[5] - z0) / h) + 1);
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const nxy = nx * ny;
  const vals = new Float32Array(nx * ny * nz);
  const done = new Uint8Array(nx * ny * nz);
  let f = sdf;
  const sample = (i, j, k) => {
    const idx = i + nx * j + nxy * k;
    if (!done[idx]) { vals[idx] = f(x0 + i * h, y0 + j * h, z0 + k * h); done[idx] = 1; }
    return vals[idx];
  };
  const bx = Math.ceil(cx / B), by = Math.ceil(cy / B), bz = Math.ceil(cz / B);
  const blockR = (Math.sqrt(3) * B * h * 0.5 + h * 1.5) * lip;
  const cellVert = new Int32Array(cx * cy * cz).fill(-1);
  const cxy = cx * cy;
  let pos = new Float32Array(1 << 16);
  let vfn = new Uint16Array(1 << 14);
  const fns = [];
  const fnId = new Map();
  let vcount = 0;
  const corner = new Float64Array(8);
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const activeCells = [];
  const box = [0, 0, 0, 0, 0, 0];
  let tick = 0;
  for (let bk = 0; bk < bz; bk++) {
    for (let bj = 0; bj < by; bj++) {
      for (let bi = 0; bi < bx; bi++) {
        if ((++tick & 7) === 0 && overdue()) yield;
        const i0 = bi * B, j0 = bj * B, k0 = bk * B;
        if (local) {
          box[0] = x0 + i0 * h; box[1] = y0 + j0 * h; box[2] = z0 + k0 * h;
          box[3] = box[0] + B * h; box[4] = box[1] + B * h; box[5] = box[2] + B * h;
          f = local(box);
        }
        const ccx = x0 + (i0 + B * 0.5) * h, ccy = y0 + (j0 + B * 0.5) * h, ccz = z0 + (k0 + B * 0.5) * h;
        if (Math.abs(f(ccx, ccy, ccz)) > blockR) continue;
        let fid = 0;
        if (local) {
          fid = fnId.get(f);
          if (fid === undefined) { fid = fns.length; fns.push(f); fnId.set(f, fid); }
        }
        const i1 = Math.min(i0 + B, cx), j1 = Math.min(j0 + B, cy), k1 = Math.min(k0 + B, cz);
        for (let k = k0; k < k1; k++) {
          for (let j = j0; j < j1; j++) {
            for (let i = i0; i < i1; i++) {
              let mask = 0;
              for (let c = 0; c < 8; c++) {
                const v = sample(i + CO[c][0], j + CO[c][1], k + CO[c][2]);
                corner[c] = v;
                if (v < 0) mask |= 1 << c;
              }
              if (mask === 0 || mask === 255) continue;
              let sx = 0, sy = 0, sz = 0, ne = 0;
              for (let e = 0; e < 12; e++) {
                const a = EDGES[e][0], b = EDGES[e][1];
                const va = corner[a], vb = corner[b];
                if ((va < 0) === (vb < 0)) continue;
                const t = va / (va - vb);
                sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t;
                sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t;
                sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t;
                ne++;
              }
              if (vcount * 3 + 3 > pos.length) { const np = new Float32Array(pos.length * 2); np.set(pos); pos = np; }
              if (vcount + 1 > vfn.length) { const nf = new Uint16Array(vfn.length * 2); nf.set(vfn); vfn = nf; }
              pos[vcount * 3] = x0 + (i + sx / ne) * h;
              pos[vcount * 3 + 1] = y0 + (j + sy / ne) * h;
              pos[vcount * 3 + 2] = z0 + (k + sz / ne) * h;
              vfn[vcount] = fid;
              const ci = i + cx * j + cxy * k;
              cellVert[ci] = vcount++;
              activeCells.push(ci);
            }
          }
        }
      }
    }
  }
  // faces
  let idx = new Uint32Array(1 << 17);
  let icount = 0;
  const P = pos;
  const pushQuad = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (icount + 6 > idx.length) { const ni = new Uint32Array(idx.length * 2); ni.set(idx); idx = ni; }
    // split along the shorter diagonal
    const dac = (P[a * 3] - P[c * 3]) ** 2 + (P[a * 3 + 1] - P[c * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[c * 3 + 2]) ** 2;
    const dbd = (P[b * 3] - P[d * 3]) ** 2 + (P[b * 3 + 1] - P[d * 3 + 1]) ** 2 + (P[b * 3 + 2] - P[d * 3 + 2]) ** 2;
    if (dac <= dbd) { idx[icount++] = a; idx[icount++] = b; idx[icount++] = c; idx[icount++] = a; idx[icount++] = c; idx[icount++] = d; }
    else { idx[icount++] = a; idx[icount++] = b; idx[icount++] = d; idx[icount++] = b; idx[icount++] = c; idx[icount++] = d; }
  };
  const V = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= cx || j >= cy || k >= cz ? -1 : cellVert[i + cx * j + cxy * k]);
  for (const ci of activeCells) {
    const k = Math.floor(ci / cxy), rem = ci - k * cxy, j = Math.floor(rem / cx), i = rem - j * cx;
    const v0 = vals[i + nx * j + nxy * k];
    const in0 = v0 < 0;
    // x edge
    if (j > 0 && k > 0 && done[i + 1 + nx * j + nxy * k]) {
      const v1 = vals[i + 1 + nx * j + nxy * k];
      if (in0 !== (v1 < 0)) {
        const a = V(i, j - 1, k - 1), b = V(i, j, k - 1), c = V(i, j, k), d = V(i, j - 1, k);
        if (in0) pushQuad(a, b, c, d); else pushQuad(d, c, b, a);
      }
    }
    // y edge
    if (i > 0 && k > 0 && done[i + nx * (j + 1) + nxy * k]) {
      const v1 = vals[i + nx * (j + 1) + nxy * k];
      if (in0 !== (v1 < 0)) {
        const a = V(i - 1, j, k - 1), b = V(i - 1, j, k), c = V(i, j, k), d = V(i, j, k - 1);
        if (in0) pushQuad(a, b, c, d); else pushQuad(d, c, b, a);
      }
    }
    // z edge
    if (i > 0 && j > 0 && done[i + nx * j + nxy * (k + 1)]) {
      const v1 = vals[i + nx * j + nxy * (k + 1)];
      if (in0 !== (v1 < 0)) {
        const a = V(i - 1, j - 1, k), b = V(i, j - 1, k), c = V(i, j, k), d = V(i - 1, j, k);
        if (in0) pushQuad(a, b, c, d); else pushQuad(d, c, b, a);
      }
    }
  }
  const positions = pos.slice(0, vcount * 3);
  const indices = idx.slice(0, icount);
  // project onto the surface and compute normals from the gradient
  const normals = new Float32Array(vcount * 3);
  const e = h * 0.25;
  const steps = opts.project ?? 1;
  for (let v = 0; v < vcount; v++) {
    if ((v & 255) === 0 && overdue()) yield;
    const g = local ? fns[vfn[v]] : sdf;
    let x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    // pull the vertex onto the zero set (forward-difference gradient)
    for (let s = 0; s < steps; s++) {
      const d = g(x, y, z);
      let gx = g(x + e, y, z) - d, gy = g(x, y + e, z) - d, gz = g(x, y, z + e) - d;
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      gx /= gl; gy /= gl; gz /= gl;
      const step = Math.max(-h * 0.5, Math.min(h * 0.5, d));
      x -= gx * step; y -= gy * step; z -= gz * step;
    }
    // smooth normal (central differences)
    let gx = g(x + e, y, z) - g(x - e, y, z);
    let gy = g(x, y + e, z) - g(x, y - e, z);
    let gz = g(x, y, z + e) - g(x, y, z - e);
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    positions[v * 3] = x; positions[v * 3 + 1] = y; positions[v * 3 + 2] = z;
    normals[v * 3] = gx / gl; normals[v * 3 + 1] = gy / gl; normals[v * 3 + 2] = gz / gl;
  }
  return { positions, normals, indices, vertexCount: vcount, triangleCount: icount / 3, blockR };
}

// Find the surface along a ray (sphere tracing). Returns distance or null.
export function raymarch(sdf, o, dir, maxT = 1, eps = 0.0005) {
  let t = 0;
  for (let i = 0; i < 128 && t < maxT; i++) {
    const d = sdf(o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t);
    if (Math.abs(d) < eps) return t;
    t += Math.max(d * 0.8, eps);
  }
  return null;
}
