// Procedural characters: sculpted with signed-distance primitives, meshed with
// Surface Nets, skinned to the shared skeleton. Geometry only (no materials),
// so it also runs in Node for tests. Results are cached by their parameters.
import * as THREE from 'three';
import * as S from './sdf.js';
import { DIM, BONES, BONE_INDEX as BI, bindMatrices } from './skeleton.js';

const RES = {
  high: { body: 0.014, head: 0.0046, hands: 0.004, hair: 0.006, shoes: 0.0056, beard: 0.005 },
  low: { body: 0.02, head: 0.0062, hands: 0.0055, hair: 0.0075, shoes: 0.007, beard: 0.0065 },
};
let detail = 'high';
export function setAvatarDetail(d) { detail = d === 'low' ? 'low' : 'high'; }
export function avatarDetail() { return detail; }

// ---- part cache + background build queue ----------------------------------------
// Every part is built by a generator (see sdf.slice). Parts can be built right
// away (sync) or queued and pumped a few milliseconds per frame.
const cache = new Map(); // key -> result
const pending = new Map(); // key -> { gen, resolvers }
const queue = [];
// culling margin for a Surface Nets block of 4 cells (see sdf.localizer)
function localMargin(h, lip) { return (Math.sqrt(3) * 2 * h + h * 1.5) * lip * 2 + 0.02; }
function cachedSync(key, makeGen) {
  if (cache.has(key)) return cache.get(key);
  const p = pending.get(key);
  const r = S.runSync(p ? p.gen : makeGen());
  cache.set(key, r);
  if (p) { pending.delete(key); const i = queue.indexOf(key); if (i >= 0) queue.splice(i, 1); for (const fn of p.res) fn(r); }
  return r;
}
function cachedAsync(key, makeGen) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  let p = pending.get(key);
  if (!p) { p = { gen: makeGen(), res: [] }; pending.set(key, p); queue.push(key); }
  return new Promise((resolve) => p.res.push(resolve));
}
export function clearAvatarCache() { cache.clear(); }
export function buildsPending() { return queue.length; }
// run queued builds for up to `ms` milliseconds
export function pumpBuilds(ms = 4) {
  if (!queue.length) return 0;
  const end = performance.now() + ms;
  S.slice.due = end;
  try {
    while (queue.length && performance.now() < end) {
      const key = queue[0];
      const p = pending.get(key);
      const r = p.gen.next();
      if (r.done) {
        queue.shift();
        pending.delete(key);
        cache.set(key, r.value);
        for (const fn of p.res) fn(r.value);
      }
    }
  } finally { S.slice.due = Infinity; }
  return queue.length;
}

const _v = new THREE.Vector3();
function L(bone, x, y, z) { return _v.set(x, y, z).applyMatrix4(bindMatrices()[bone]).toArray(); }
function limbOf(bone) {
  const m = bindMatrices()[bone];
  const o = new THREE.Vector3().setFromMatrixPosition(m);
  const a = new THREE.Vector3(0, -1, 0).transformDirection(m);
  return { o: o.toArray(), a: a.toArray() };
}

export const NECK_BASE_Y = DIM.hipY + DIM.spineY + DIM.neckY;
export const BELT_Y = DIM.hipY + 0.07;
export const COLLAR_Y = NECK_BASE_Y - 0.036;
const SHIRT_T = 0.0065;
const PANTS_T = 0.006;

export const BUILDS = {
  slim: { hw: 0.94, ww: 0.86, cw: 0.92, cd: 0.9, sw: 0.95, armT: 0.88, legT: 0.9, belly: 0, nk: 0.95 },
  average: { hw: 1, ww: 1, cw: 1, cd: 1, sw: 1, armT: 1, legT: 1, belly: 0.22, nk: 1 },
  broad: { hw: 1.02, ww: 1.04, cw: 1.12, cd: 1.08, sw: 1.14, armT: 1.14, legT: 1.08, belly: 0.1, nk: 1.12 },
  heavy: { hw: 1.16, ww: 1.3, cw: 1.18, cd: 1.2, sw: 1.08, armT: 1.2, legT: 1.2, belly: 1, nk: 1.15 },
  boss: { hw: 1.18, ww: 1.38, cw: 1.24, cd: 1.26, sw: 1.16, armT: 1.24, legT: 1.18, belly: 1.25, nk: 1.25 },
};

// shirt style -> geometry needs
export const SHIRTS = {
  buttonup: { sleeves: 'rolled', vneck: true, vdepth: 0.04 },
  polo: { sleeves: 'short', vneck: false },
  tee: { sleeves: 'short', vneck: false },
  hoodie: { sleeves: 'long', vneck: false },
  sweater: { sleeves: 'long', vneck: false },
  cardigan: { sleeves: 'long', vneck: true, vdepth: 0.12 },
  suit: { sleeves: 'long', vneck: true, vdepth: 0.13, inner: true },
  tank: { sleeves: 'none', vneck: false },
  armor: { sleeves: 'long', vneck: false },
  robe: { sleeves: 'long', vneck: false },
};

// ---- node helpers ---------------------------------------------------------
function nSphere(c, r, k, bones, cover, extra = {}) {
  return { f: S.sphere(c, r), op: 'add', k, box: S.boxSphere(c, r), bones, cover, ...extra };
}
function nEll(c, r, k, bones, cover, extra = {}) {
  return { f: S.ellipsoid(c, r, extra.rot || null), op: 'add', k, box: S.boxSphere(c, Math.max(...r)), bones, cover, ...extra };
}
function nCone(a, b, r1, r2, k, bones, cover, extra = {}) {
  return { f: S.roundCone(a, b, r1, r2), op: 'add', k, box: S.boxSeg(a, b, Math.max(r1, r2)), bones, cover, ...extra };
}
function nBox(c, half, r, k, bones, cover, extra = {}) {
  return { f: S.roundBox(c, half, r, extra.rot || null), op: 'add', k, box: S.boxSphere(c, Math.hypot(...half)), bones, cover, ...extra };
}
function nSub(f, k) { return { f, op: 'sub', k }; }

// ---- body -----------------------------------------------------------------
// Clothing coverage as signed distances (metres, positive = covered) for the
// shirt (S), pants (P) and an inner shirt under a jacket (I). The SDF uses a
// sharp version for the cloth thickness; the shader gets a linear ramp per
// vertex so every fragment knows exactly which material it belongs to.
const SD = { s: -1, p: -1, i: -1 };
function coverSD(node, x, y, z, spec) {
  SD.s = -1; SD.p = -1; SD.i = -1;
  if (!node) return SD;
  const c = node.cover;
  if (c === 'torso') {
    const belt = y - BELT_Y;
    const cyl = Math.hypot(x, z + 0.016) - spec.neckR; // + outside the neck cylinder
    let skinOut = cyl;
    let vIn = 1;
    if (spec.vneck) {
      const depthY = COLLAR_Y - spec.vdepth;
      // approx. signed distance to the V opening (negative inside)
      vIn = Math.max((Math.abs(x) - (y - depthY) * 0.55) * 0.875, depthY - y, -z + 0.01);
      if (!spec.inner) skinOut = Math.min(cyl, vIn);
    }
    SD.p = -belt;
    SD.s = Math.min(belt, skinOut);
    if (spec.inner) SD.i = Math.min(belt, -vIn, cyl);
    return SD;
  }
  const lm = node.limb;
  const t = lm ? (x - lm.o[0]) * lm.a[0] + (y - lm.o[1]) * lm.a[1] + (z - lm.o[2]) * lm.a[2] : 0;
  switch (c) {
    case 'shoulder': SD.s = spec.sleeves === 'none' ? -1 : 1; break;
    case 'upper': SD.s = spec.sleeves === 'none' ? -1 : spec.sleeves === 'short' ? 0.129 - t : 1; break;
    case 'fore': SD.s = spec.sleeves === 'long' ? 0.216 - t : spec.sleeves === 'rolled' ? 0.089 - t : -1; break;
    case 'thigh': SD.p = spec.legs === 'shorts' ? 0.254 - t : 1; break;
    case 'shin': SD.p = spec.legs === 'shorts' ? -1 : 1; break;
    default: break;
  }
  return SD;
}
// 0 skin, 1 shirt/jacket, 2 pants, 3 inner shirt (same rule as the shader)
export function regionOf(cs, cp, ci) { return cp > 0.5 ? 2 : ci > 0.5 ? 3 : cs > 0.5 ? 1 : 0; }
let COV_S = 0, COV_P = 0, COV_I = 0;
function cover(node, x, y, z, spec) {
  const d = coverSD(node, x, y, z, spec);
  const ss = S.smoothstep;
  // the cloth thickness ramps over ~2 cells so the mesh edge stays smooth;
  // the crisp edge comes from the shader masks
  COV_S = ss(-0.012, 0.012, d.s);
  COV_P = ss(-0.012, 0.012, d.p);
  COV_I = ss(-0.012, 0.012, d.i);
  if (COV_P > 0) COV_S *= 1 - COV_P;
}

function bodyNodes(spec) {
  const b = { ...(BUILDS[spec.build] || BUILDS.average) };
  const fem = spec.fem || 0;
  b.hw += 0.09 * fem; b.ww -= 0.08 * fem; b.sw -= 0.07 * fem; b.armT -= 0.06 * fem; b.nk -= 0.08 * fem;
  const P = BI.pelvis, T = BI.torso, H = BI.head;
  const nodes = [];
  // pelvis
  nodes.push(nEll(L('pelvis', 0, -0.015, 0), [0.152 * b.hw, 0.105, 0.108 * Math.max(0.92, b.cd * 0.96)], 0, [[P, 1]], 'torso'));
  for (const s of [1, -1]) nodes.push(nSphere(L('pelvis', 0.058 * s * b.hw, -0.045, -0.05), 0.08 * Math.min(1.15, b.hw), 0.05, [[P, 1]], 'torso'));
  nodes.push(nEll(L('pelvis', 0, 0.06, 0.018), [0.132 * b.ww, 0.085, 0.098 * b.cd], 0.05, [[P, 0.6], [T, 0.4]], 'torso'));
  // torso
  nodes.push(nEll(L('torso', 0, 0.02, 0.004), [0.128 * b.ww, 0.1, 0.096 * b.cd], 0.06, [[T, 0.8], [P, 0.2]], 'torso'));
  nodes.push(nEll(L('torso', 0, 0.19, 0), [0.15 * b.cw, 0.15, 0.108 * b.cd], 0.07, [[T, 1]], 'torso'));
  nodes.push(nCone(L('torso', -0.13 * b.sw, 0.3, -0.016), L('torso', 0.13 * b.sw, 0.3, -0.016), 0.064, 0.064, 0.06, [[T, 1]], 'torso'));
  for (const s of [1, -1]) nodes.push(nCone(L('torso', 0.035 * s, 0.355, -0.03), L('torso', 0.12 * s * b.sw, 0.318, -0.022), 0.038 * b.nk, 0.03, 0.05, [[T, 1]], 'torso'));
  for (const s of [1, -1]) {
    nodes.push(nSphere(L('torso', 0.066 * s * b.cw, 0.215, 0.064 * b.cd), 0.057, 0.05, [[T, 1]], 'torso'));
    if (fem > 0.05) nodes.push(nSphere(L('torso', 0.062 * s * b.cw, 0.198, 0.074 * b.cd), 0.062 * (0.75 + 0.35 * fem), 0.045, [[T, 1]], 'torso'));
  }
  if (b.belly > 0.01) nodes.push(nSphere(L('torso', 0, 0.035, 0.05 + 0.01 * b.belly), 0.1 * b.belly * b.ww, 0.07, [[T, 0.7], [P, 0.3]], 'torso'));
  const neck = nCone(L('torso', 0, 0.35, -0.016), L('head', 0, 0.085, -0.004), 0.06 * b.nk, 0.052 * b.nk, 0.04, null, 'torso');
  neck.boneFn = (x, y) => {
    const hf = S.smoothstep(NECK_BASE_Y + 0.0, NECK_BASE_Y + 0.07, y);
    return [[T, 1 - hf], [H, hf]];
  };
  nodes.push(neck);
  // arms
  for (const side of ['L', 'R']) {
    const U = BI['uArm' + side], F = BI['fArm' + side];
    const ul = limbOf('uArm' + side), fl = limbOf('fArm' + side);
    nodes.push(nSphere(L('uArm' + side, 0, -0.04, -0.004), 0.055 * b.armT, 0.045, [[U, 0.55], [T, 0.45]], 'shoulder', { limb: ul }));
    nodes.push(nCone(L('uArm' + side, 0, -0.035, 0), L('uArm' + side, 0, -0.268, 0), 0.046 * b.armT, 0.038 * b.armT, 0.03, [[U, 1]], 'upper', { limb: ul }));
    nodes.push(nCone(L('fArm' + side, 0, 0.0, 0), L('fArm' + side, 0, -0.236, 0), 0.042 * b.armT, 0.03, 0.03, [[F, 1]], 'fore', { limb: fl }));
    nodes.push(nCone(L('fArm' + side, 0, -0.02, 0.004), L('fArm' + side, 0, -0.14, 0.002), 0.046 * b.armT, 0.035 * b.armT, 0.035, [[F, 1]], 'fore', { limb: fl }));
  }
  // legs
  for (const side of ['L', 'R']) {
    const Th = BI['thigh' + side], Sh = BI['shin' + side];
    const tl = limbOf('thigh' + side), sl = limbOf('shin' + side);
    nodes.push(nCone(L('thigh' + side, 0, 0.0, 0.004), L('thigh' + side, 0, -0.405, 0), 0.087 * b.legT, 0.058 * b.legT, 0.05, [[Th, 1]], 'thigh', { limb: tl }));
    nodes.push(nCone(L('thigh' + side, 0, -0.06, 0.018), L('thigh' + side, 0, -0.33, 0.012), 0.072 * b.legT, 0.05 * b.legT, 0.04, [[Th, 1]], 'thigh', { limb: tl }));
    nodes.push(nCone(L('shin' + side, 0, 0, 0), L('shin' + side, 0, -0.39, 0), 0.055 * b.legT, 0.04, 0.035, [[Sh, 1]], 'shin', { limb: sl }));
    nodes.push(nCone(L('shin' + side, 0, -0.05, -0.022), L('shin' + side, 0, -0.2, -0.012), 0.052 * b.legT, 0.04, 0.04, [[Sh, 1]], 'shin', { limb: sl }));
  }
  return nodes;
}

function bodySDF(nodes, spec) {
  nodes = nodes.filter((o) => o.op !== 'sub');
  const n = nodes.length;
  const fs = nodes.map((o) => o.f);
  const ks = nodes.map((o) => o.k || 0);
  return (x, y, z) => {
    let d = 1e9, best = 1e9, owner = null;
    for (let i = 0; i < n; i++) {
      const di = fs[i](x, y, z);
      d = S.smin(d, di, ks[i]);
      if (di < best) { best = di; owner = nodes[i]; }
    }
    cover(owner, x, y, z, spec);
    return d - COV_S * SHIRT_T - COV_P * PANTS_T;
  };
}

function ownerOf(nodes, x, y, z) {
  let best = 1e9, owner = null;
  for (const o of nodes) {
    if (o.op !== 'add') continue;
    const d = o.f(x, y, z);
    if (d < best) { best = d; owner = o; }
  }
  return owner;
}

function* computeWeights(nodes, positions, tau) {
  const n = positions.length / 3;
  const idx = new Uint16Array(n * 4);
  const wts = new Float32Array(n * 4);
  const acc = new Float64Array(BONES.length);
  const all = nodes.filter((o) => o.op === 'add' && (o.bones || o.boneFn));
  const dist = new Float64Array(all.length);
  const loc = S.localizer(all, (sub) => sub, tau * 6);
  const box = [0, 0, 0, 0, 0, 0];
  for (let v = 0; v < n; v++) {
    if ((v & 127) === 0 && S.overdue()) yield;
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    box[0] = x - 0.01; box[1] = y - 0.01; box[2] = z - 0.01; box[3] = x + 0.01; box[4] = y + 0.01; box[5] = z + 0.01;
    const live = loc.local(box);
    let dmin = Infinity;
    for (let i = 0; i < live.length; i++) { const d = live[i].f(x, y, z); dist[i] = d; if (d < dmin) dmin = d; }
    acc.fill(0);
    for (let i = 0; i < live.length; i++) {
      const w = Math.exp(-(dist[i] - dmin) / (live[i].tau || tau));
      if (w < 1e-4) continue;
      const bl = live[i].boneFn ? live[i].boneFn(x, y, z) : live[i].bones;
      for (const [bi, bw] of bl) acc[bi] += w * bw;
    }
    writeTop4(acc, idx, wts, v);
  }
  return { index: idx, weight: wts };
}

function writeTop4(acc, idx, wts, v) {
  const order = [...acc.keys()].sort((a, b) => acc[b] - acc[a]).slice(0, 4);
  let sum = 0;
  for (const b of order) sum += acc[b];
  for (let k = 0; k < 4; k++) {
    idx[v * 4 + k] = order[k];
    wts[v * 4 + k] = sum > 0 ? acc[order[k]] / sum : (k === 0 ? 1 : 0);
  }
}

function buildGeometry(mesh, { skin = null, colors = null, regions = null, nRegions = 1, lists: preLists = null } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  if (skin) {
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skin.index, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skin.weight, 4));
  }
  if (colors) g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (regions || preLists) {
    const I = mesh.indices;
    const lists = preLists || Array.from({ length: nRegions }, () => []);
    if (!preLists) for (let t = 0; t < I.length / 3; t++) lists[regions[t]].push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]);
    const all = new Uint32Array(lists.reduce((n, l) => n + l.length, 0));
    let off = 0;
    lists.forEach((l, r) => {
      all.set(l, off);
      g.addGroup(off, l.length, r);
      off += l.length;
    });
    g.setIndex(new THREE.BufferAttribute(all, 1));
  } else {
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  }
  g.computeBoundingSphere();
  return g;
}

export function neckScale(build, fem = 0) { return (BUILDS[build] || BUILDS.average).nk - 0.08 * fem; }
function bodyKey(spec) {
  const s = { build: spec.build || 'average', fem: +(spec.fem || 0).toFixed(2), sleeves: spec.sleeves || 'long', vneck: !!spec.vneck, legs: spec.legs || 'long', vdepth: spec.vdepth || 0.07, inner: !!spec.inner };
  s.neckR = +(0.066 * neckScale(s.build, s.fem) + 0.004).toFixed(4);
  return ['body|' + detail + '|' + JSON.stringify(s), s];
}
export function bodyGeometry(spec) { const [k, s] = bodyKey(spec); return cachedSync(k, () => bodyGen(s)); }
export function bodyAsync(spec) { const [k, s] = bodyKey(spec); return cachedAsync(k, () => bodyGen(s)); }
function* bodyGen(s) {
  {
    const nodes = bodyNodes(s);
    const h = RES[detail].body;
    const loc = S.localizer(nodes, (sub) => bodySDF(sub, s), localMargin(h, 1.25));
    const sdf = loc.full;
    const bounds = S.boundsOf(nodes, 0.03);
    const mesh = yield* S.surfaceNetsGen(sdf, bounds, h, { lipschitz: 1.25, local: loc.local });
    const skin = yield* computeWeights(nodes, mesh.positions, 0.02);
    const Pp = mesh.positions;
    const nv = mesh.vertexCount;
    const coverAttr = new Float32Array(nv * 3);
    const vreg = new Uint8Array(nv);
    const adds = S.localizer(nodes.filter((o) => o.op === 'add'), (sub) => sub, 0.06);
    const tb = [0, 0, 0, 0, 0, 0];
    const ramp = (d) => Math.min(1, Math.max(0, 0.5 + d / (2 * h)));
    for (let v = 0; v < nv; v++) {
      if ((v & 255) === 0 && S.overdue()) yield;
      const x = Pp[v * 3], y = Pp[v * 3 + 1], z = Pp[v * 3 + 2];
      tb[0] = x - 0.005; tb[1] = y - 0.005; tb[2] = z - 0.005; tb[3] = x + 0.005; tb[4] = y + 0.005; tb[5] = z + 0.005;
      const d = coverSD(ownerOf(adds.local(tb), x, y, z), x, y, z, s);
      const cs = ramp(d.s), cp = ramp(d.p), ci = ramp(d.i);
      coverAttr[v * 3] = cs; coverAttr[v * 3 + 1] = cp; coverAttr[v * 3 + 2] = ci;
      vreg[v] = regionOf(cs, cp, ci);
    }
    // triangles on a boundary go to every region they touch; the shader
    // keeps each fragment in exactly one of them
    const I = mesh.indices;
    const lists = [[], [], [], []];
    for (let t = 0; t < I.length / 3; t++) {
      const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
      const ra = vreg[a], rb = vreg[b], rc = vreg[c];
      lists[ra].push(a, b, c);
      if (rb !== ra) lists[rb].push(a, b, c);
      if (rc !== ra && rc !== rb) lists[rc].push(a, b, c);
    }
    const geometry = buildGeometry(mesh, { skin, lists });
    geometry.setAttribute('cover', new THREE.BufferAttribute(coverAttr, 3));
    return { geometry, sdf, spec: s, tris: mesh.triangleCount };
  }
}

// ---- head -------------------------------------------------------------------
export const FACES = [
  { jaw: 1, chin: 1, cheek: 1, cheekbone: 1, brow: 1, nose: 1, noseW: 1, lips: 1, mouthW: 1, ears: 1, hw: 1 },
  { jaw: 1.24, chin: 1.08, cheek: 0.92, cheekbone: 1.05, brow: 1.14, nose: 1.06, noseW: 1.08, lips: 0.92, mouthW: 1.04, ears: 1.04, hw: 1.03 },
  { jaw: 1.05, chin: 0.9, cheek: 1.28, cheekbone: 0.9, brow: 0.9, nose: 0.94, noseW: 1.05, lips: 1.08, mouthW: 0.96, ears: 0.96, hw: 1.05 },
  { jaw: 0.94, chin: 1.16, cheek: 0.9, cheekbone: 1.08, brow: 1.02, nose: 1.14, noseW: 0.94, lips: 0.95, mouthW: 1, ears: 1.05, hw: 0.95 },
  { jaw: 0.95, chin: 0.94, cheek: 1.12, cheekbone: 1, brow: 0.82, nose: 0.86, noseW: 0.92, lips: 1.16, mouthW: 0.98, ears: 0.95, hw: 0.98 },
  { jaw: 1.14, chin: 1.22, cheek: 0.86, cheekbone: 1.26, brow: 1.1, nose: 1.2, noseW: 0.9, lips: 0.94, mouthW: 1.02, ears: 1.08, hw: 1 },
];

export const MOUTH_Y = 0.1125;
const EYE = { x: 0.031, y: 0.176, z: 0.0905, r: 0.0118 };

function faceParams(face) {
  const base = FACES[(face && face.preset) || 0] || FACES[0];
  const f = { ...base, type: (face && face.type) || 'human', eye: 1, stubble: !!(face && face.stubble) };
  const fem = (face && face.fem) || 0;
  if (fem) {
    f.fem = fem;
    f.jaw *= 1 - 0.12 * fem; f.chin *= 1 - 0.1 * fem; f.brow *= 1 - 0.2 * fem; f.nose *= 1 - 0.1 * fem;
    f.noseW *= 1 - 0.08 * fem; f.lips *= 1 + 0.14 * fem; f.hw *= 1 - 0.03 * fem; f.cheekbone *= 1 + 0.05 * fem;
  }
  if (f.type === 'alien') Object.assign(f, { hw: 1.12, nose: 0.42, noseW: 0.8, ears: 0.55, mouthW: 0.82, eye: 1.55, lips: 0.85, chin: 0.85, cheek: 0.85 });
  if (f.type === 'cat') Object.assign(f, { nose: 0.78, noseW: 0.8, lips: 0.9 });
  return f;
}

export function headMeta(face) {
  const f = faceParams(face);
  const es = f.eye;
  const eyeX = f.type === 'alien' ? 0.037 : EYE.x;
  const eyeR = EYE.r * es;
  return {
    type: f.type,
    eyeL: [eyeX, EYE.y + (es - 1) * 0.004, EYE.z - (es - 1) * 0.008],
    eyeR: [-eyeX, EYE.y + (es - 1) * 0.004, EYE.z - (es - 1) * 0.008],
    eyeRadius: eyeR,
    mouthY: MOUTH_Y,
    mouthW: 0.025 * f.mouthW,
    cranium: { c: [0, 0.19, -0.012], r: [0.078 * f.hw, f.type === 'alien' ? 0.112 : 0.097, 0.1] },
    browY: 0.195,
    noseTip: [0, 0.145, 0.116 + 0.004 * (f.nose - 1)],
    earX: 0.0805 * f.hw,
  };
}

function headNodes(f) {
  const nodes = [];
  const hw = f.hw;
  const meta = headMeta(f);
  if (f.type === 'robot') {
    nodes.push(nBox([0, 0.192, 0.0], [0.088, 0.096, 0.092], 0.032, 0));
    nodes.push(nBox([0, 0.094, 0.02], [0.07, 0.036, 0.07], 0.02, 0.006));
    nodes.push(nCone([0, -0.01, 0], [0, 0.07, 0], 0.04, 0.04, 0.01));
    nodes.push(nSub(S.roundBox([0, 0.1165, 0.09], [0.06, 0.0045, 0.04], 0.002), 0.002));
    for (const s of [1, -1]) nodes.push(nSub(S.sphere([0.034 * s, 0.19, 0.098], 0.017), 0.004));
    return nodes;
  }
  const cr = meta.cranium;
  nodes.push(nEll(cr.c, cr.r, 0));
  // face mass, cheekbones, soft cheeks
  nodes.push(nEll([0, 0.148, 0.03], [0.062 * hw, 0.082, 0.074], 0.03));
  for (const s of [1, -1]) {
    nodes.push(nEll([0.049 * s * hw, 0.159, 0.05], [0.02 * f.cheekbone, 0.012, 0.02], 0.02));
    nodes.push(nSphere([0.04 * s, 0.128, 0.05], 0.024 * f.cheek, 0.026));
    // jaw line: gonion -> chin
    nodes.push(nCone([0.051 * s * f.jaw, 0.106, -0.004], [0.017 * s, 0.075, 0.068], 0.0175 * f.jaw, 0.0155, 0.03));
  }
  // chin and the muzzle around the mouth
  nodes.push(nSphere([0, 0.073 - 0.004 * (f.chin - 1), 0.072 + 0.006 * (f.chin - 1)], 0.019 * f.chin, 0.026));
  nodes.push(nEll([0, 0.118, 0.077], [0.031, 0.03, 0.03], 0.024));
  // brow ridge
  nodes.push(nCone([-0.039, 0.196, 0.08], [0.039, 0.196, 0.08], 0.0115 * f.brow, 0.0115 * f.brow, 0.026));
  // eye sockets
  for (const e of [meta.eyeL, meta.eyeR]) nodes.push(nSub(S.sphere([e[0], e[1], e[2] + 0.003], 0.0168 * f.eye), 0.009));
  // nose
  if (f.nose > 0.5) {
    nodes.push(nCone([0, 0.187, 0.094], [0, 0.151, 0.112 + 0.004 * (f.nose - 1)], 0.0072, 0.0105 * f.nose, 0.012));
    nodes.push(nSphere(meta.noseTip, 0.0122 * f.nose, 0.008));
    for (const s of [1, -1]) nodes.push(nSphere([0.0118 * s * f.noseW, 0.14, 0.104], 0.0088 * f.nose, 0.008));
  } else {
    nodes.push(nSphere([0, 0.15, 0.104], 0.008, 0.008));
  }
  if (f.type === 'cat') for (const s of [1, -1]) nodes.push(nSphere([0.015 * s, 0.127, 0.101], 0.0165, 0.012));
  // lips + the carved mouth (the jaw bone closes it at rest)
  const mw = f.mouthW;
  nodes.push(nCone([-0.02 * mw, 0.1195, 0.0985], [0.02 * mw, 0.1195, 0.0985], 0.0062 * f.lips, 0.0062 * f.lips, 0.008));
  nodes.push(nCone([-0.017 * mw, 0.1062, 0.0955], [0.017 * mw, 0.1062, 0.0955], 0.0076 * f.lips, 0.0076 * f.lips, 0.008));
  nodes.push(nSub(S.ellipsoid([0, MOUTH_Y, 0.104], [0.024 * mw, 0.0048, 0.03]), 0.003));
  // ears
  if (f.ears > 0.3) {
    for (const s of [1, -1]) {
      nodes.push(nEll([meta.earX * s, 0.163, -0.01], [0.0095, 0.027 * f.ears, 0.017 * f.ears], 0.006, null, null, { rot: S.rotY(0.36 * s) }));
      nodes.push(nSub(S.sphere([(meta.earX + 0.006) * s, 0.164, -0.006], 0.0098 * f.ears), 0.004));
    }
  }
  // neck stub (hidden inside the body's neck)
  nodes.push(nCone([0, -0.012, -0.01], [0, 0.1, -0.004], 0.049, 0.049, 0.03));
  return nodes;
}

function jawWeight(x, y, z, type) {
  const ss = S.smoothstep;
  if (type === 'robot') return ss(0.119, 0.113, y) * ss(-0.06, -0.02, z) * ss(0.04, 0.06, y);
  const below = ss(MOUTH_Y + 0.003, MOUTH_Y - 0.004, y);
  const front = ss(-0.035, 0.015, z);
  const side = 1 - ss(0.052, 0.074, Math.abs(x));
  const neck = ss(0.045, 0.072, y);
  return below * front * side * neck;
}

function headColors(positions, f) {
  const n = positions.length / 3;
  const col = new Float32Array(n * 3);
  const ss = S.smoothstep;
  const meta = headMeta(f);
  const upper = S.capsule([-0.02 * f.mouthW, 0.1195, 0.0985], [0.02 * f.mouthW, 0.1195, 0.0985], 0.0062 * f.lips);
  const lower = S.capsule([-0.017 * f.mouthW, 0.1062, 0.0955], [0.017 * f.mouthW, 0.1062, 0.0955], 0.0076 * f.lips);
  const carve = S.ellipsoid([0, MOUTH_Y, 0.104], [0.024 * f.mouthW, 0.0048, 0.03]);
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    let r = 1, g = 1, b = 1;
    if (f.type !== 'robot') {
      const dl = Math.min(upper(x, y, z), lower(x, y, z));
      const lip = (1 - ss(0.0005, 0.004, dl)) * ss(0.084, 0.093, z);
      const tint = f.type === 'cat' ? [0.92, 0.72, 0.74] : [0.86, 0.6, 0.6];
      r += (tint[0] - 1) * lip; g += (tint[1] - 1) * lip; b += (tint[2] - 1) * lip;
      // cheeks, nose tip and ears carry a little more blood
      const ch = Math.exp(-((Math.abs(x) - 0.046) ** 2 + (y - 0.14) ** 2 + (z - 0.07) ** 2) / (0.024 ** 2));
      g -= 0.07 * ch; b -= 0.08 * ch;
      const nt = Math.exp(-((x - meta.noseTip[0]) ** 2 + (y - meta.noseTip[1]) ** 2 + (z - meta.noseTip[2]) ** 2) / (0.014 ** 2));
      g -= 0.06 * nt; b -= 0.07 * nt;
      const ear = ss(0.072, 0.082, Math.abs(x)) * ss(0.13, 0.15, y) * (1 - ss(0.19, 0.2, y));
      g -= 0.07 * ear; b -= 0.08 * ear;
      // eye sockets slightly shadowed
      const so = Math.min(Math.hypot(x - meta.eyeL[0], y - meta.eyeL[1], z - meta.eyeL[2]), Math.hypot(x - meta.eyeR[0], y - meta.eyeR[1], z - meta.eyeR[2]));
      const sock = 1 - ss(0.013, 0.024, so);
      r -= 0.06 * sock; g -= 0.07 * sock; b -= 0.05 * sock;
      // inside of the carved mouth: dark, wet red (seen when the jaw opens)
      const inMouth = (1 - ss(0.0008, 0.0035, Math.abs(carve(x, y, z)))) * ss(0.1, 0.092, z) * (1 - lip);
      r += (0.42 - r) * inMouth; g += (0.13 - g) * inMouth; b += (0.15 - b) * inMouth;
      if (f.type === 'cat') {
        // white muzzle
        const mz = Math.exp(-((Math.abs(x) - 0.015) ** 2 + (y - 0.127) ** 2 + (z - 0.11) ** 2) / (0.018 ** 2));
        r += (1.35 - r) * mz; g += (1.35 - g) * mz; b += (1.35 - b) * mz;
        const nose = Math.exp(-((x - meta.noseTip[0]) ** 2 + (y - meta.noseTip[1]) ** 2 + (z - meta.noseTip[2]) ** 2) / (0.009 ** 2));
        r += (1.25 - r) * nose; g += (0.62 - g) * nose; b += (0.7 - b) * nose;
      }
      if (f.stubble) {
        const zone = ss(0.135, 0.12, y) * ss(-0.01, 0.03, z) * (1 - lip) * ss(0.05, 0.07, y) * (1 - ss(0.07, 0.08, Math.abs(x)));
        const grain = 0.75 + 0.25 * S.wobble(x, y, z, 900);
        const k = zone * 0.32 * grain;
        r -= k; g -= k; b -= k * 0.9;
      }
    }
    col[v * 3] = r; col[v * 3 + 1] = g; col[v * 3 + 2] = b;
  }
  return col;
}

function headKey(face) { const f = faceParams(face); return ['head|' + detail + '|' + JSON.stringify(f), f]; }
export function headGeometry(face) { const [k, f] = headKey(face); return cachedSync(k, () => headGen(f)); }
export function headAsync(face) { const [k, f] = headKey(face); return cachedAsync(k, () => headGen(f)); }
function* headGen(f) {
  {
    const nodes = headNodes(f);
    const h = RES[detail].head;
    const loc = S.compileLocal(nodes, localMargin(h, 1.3));
    const sdf = loc.full;
    const bounds = S.boundsOf(nodes, 0.02);
    const mesh = yield* S.surfaceNetsGen(sdf, bounds, h, { lipschitz: 1.3, local: loc.local });
    const n = mesh.vertexCount;
    const idx = new Uint16Array(n * 4), wts = new Float32Array(n * 4);
    const P = mesh.positions;
    for (let v = 0; v < n; v++) {
      const w = jawWeight(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], f.type);
      idx[v * 4] = BI.head; wts[v * 4] = 1 - w;
      idx[v * 4 + 1] = BI.jaw; wts[v * 4 + 1] = w;
    }
    const colors = headColors(P, f);
    // head space -> bind space
    const m = bindMatrices().head;
    for (let v = 0; v < n; v++) {
      _v.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).applyMatrix4(m);
      P[v * 3] = _v.x; P[v * 3 + 1] = _v.y; P[v * 3 + 2] = _v.z;
    }
    const geometry = buildGeometry(mesh, { skin: { index: idx, weight: wts }, colors });
    return { geometry, meta: headMeta(f), tris: mesh.triangleCount, sdfLocal: sdf };
  }
}

// ---- hair (head space, rigid) ---------------------------------------------------
export const HAIR_STYLES = ['crop', 'quiff', 'sidepart', 'buzz', 'curly', 'bob', 'long', 'bun', 'ponytail', 'afro', 'mohawk', 'balding', 'slick', 'bald'];

function hairline(x, y, z, front, side, back, peak = 0) {
  const th = Math.abs(Math.atan2(x, z));
  let H = front - peak * Math.exp(-(x * x) / 0.0004);
  H += (side - H) * S.smoothstep(0.45, 1.25, th);
  H += (back - H) * S.smoothstep(1.85, 2.6, th);
  return H - y;
}

function hairKey(style, face) { const f = faceParams(face); return ['hair|' + detail + '|' + style + '|' + f.hw + '|' + f.type, f]; }
function hairSkip(style, face) { return !style || style === 'bald' || faceParams(face).type === 'robot'; }
export function hairGeometry(style, face) { if (hairSkip(style, face)) return null; const [k, f] = hairKey(style, face); return cachedSync(k, () => hairGen(style, f)); }
export function hairAsync(style, face) { if (hairSkip(style, face)) return Promise.resolve(null); const [k, f] = hairKey(style, face); return cachedAsync(k, () => hairGen(style, f)); }
function* hairGen(style, f) {
  {
    const meta = headMeta(f);
    const [cx, cy, cz] = meta.cranium.c;
    const [rx, ry, rz] = meta.cranium.r;
    const shell = (t) => S.ellipsoid([cx, cy, cz], [rx + t, ry + t, rz + t]);
    let t = 0.012, amp = 0.0025, freq = 70;
    let front = 0.229, side = 0.172, back = 0.1, peak = 0;
    const extra = [];
    let faceCut = false, bottom = null, strip = 0, topCut = false;
    switch (style) {
      case 'buzz': t = 0.0045; amp = 0.0006; freq = 140; break;
      case 'quiff': extra.push(S.ellipsoid([0, 0.27, 0.048], [0.058, 0.032, 0.054])); front = 0.234; break;
      case 'sidepart': t = 0.015; extra.push(S.ellipsoid([0.025, 0.278, 0.02], [0.072, 0.03, 0.09])); break;
      case 'curly': t = 0.022; amp = 0.0065; freq = 120; break;
      case 'bob': t = 0.019; side = 0.095; back = 0.08; faceCut = true; bottom = 0.085; extra.push(S.ellipsoid([0, 0.14, -0.018], [0.103 * f.hw, 0.085, 0.108])); break;
      case 'long': t = 0.018; side = 0.09; back = -0.03; faceCut = true; extra.push(S.roundCone([0, 0.15, -0.072], [0, -0.035, -0.09], 0.068, 0.058)); extra.push(S.ellipsoid([0, 0.13, -0.02], [0.1 * f.hw, 0.09, 0.105])); break;
      case 'bun': t = 0.009; extra.push(S.sphere([0, 0.246, -0.098], 0.042)); break;
      case 'ponytail': t = 0.01; extra.push(S.roundCone([0, 0.205, -0.104], [0, 0.07, -0.142], 0.026, 0.013)); break;
      case 'afro': t = 0.048; amp = 0.009; freq = 85; front = 0.226; side = 0.15; break;
      case 'mohawk': t = 0.038; strip = 0.017; front = 0.225; back = 0.16; break;
      case 'balding': t = 0.01; topCut = true; break;
      case 'slick': t = 0.0075; amp = 0.0008; freq = 40; peak = 0.016; front = 0.24; break;
      default: break;
    }
    const sh = shell(t);
    const faceKeep = S.ellipsoid([0, 0.148, 0.034], [0.062 * f.hw, 0.08, 0.072]);
    const sdf = (x, y, z) => {
      let d = sh(x, y, z);
      for (const e of extra) d = S.smin(d, e(x, y, z), 0.025);
      if (amp) d += amp * S.wobble(x, y, z, freq);
      d = S.smax(d, hairline(x, y, z, front, side, back, peak), 0.008);
      if (faceCut) d = S.smax(d, Math.min(z - 0.022, 0.236 - y), 0.012);
      if (bottom !== null) d = S.smax(d, bottom - y, 0.01);
      if (strip) d = S.smax(d, Math.abs(x) - strip, 0.004);
      if (topCut) d = S.smax(d, -Math.max(y - 0.252, -(Math.abs(x) - 0.06)), 0.01);
      // keep clear of the face and ears
      d = S.smax(d, -(faceKeep(x, y, z) - 0.002), 0.004);
      return d;
    };
    const b = [cx - rx - t - 0.09, back - 0.08, cz - rz - t - 0.09, cx + rx + t + 0.09, cy + ry + t + 0.07, cz + rz + t + 0.06];
    const mesh = yield* S.surfaceNetsGen(sdf, b, RES[detail].hair, { lipschitz: 1.6 });
    if (!mesh.vertexCount) return null;
    const n = mesh.vertexCount;
    const col = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const x = mesh.positions[v * 3], y = mesh.positions[v * 3 + 1], z = mesh.positions[v * 3 + 2];
      const k = 0.92 + 0.12 * S.wobble(x, y * 3, z, 160);
      col[v * 3] = k; col[v * 3 + 1] = k; col[v * 3 + 2] = k;
    }
    return buildGeometry(mesh, { colors: col });
  }
}

// ---- beard (jaw space, rigid) -------------------------------------------------------
function beardKey(face, style) { const f = faceParams(face); return ['beard|' + detail + '|' + style + '|' + JSON.stringify(f), f]; }
export function beardGeometry(face, style = 'full') { const [k, f] = beardKey(face, style); return cachedSync(k, () => beardGen(f, style)); }
export function beardAsync(face, style = 'full') { const [k, f] = beardKey(face, style); return cachedAsync(k, () => beardGen(f, style)); }
function* beardGen(f, style) {
  {
    const head = headNodes(f);
    const h = RES[detail].beard;
    const hloc = S.compileLocal(head, localMargin(h, 1.5));
    const [jx, jy, jz] = DIM.jawPivot;
    const make = (hs) => (x, y, z) => {
      // x,y,z are jaw space; sample the head in head space
      const hx = x + jx, hy = y + jy, hz = z + jz;
      const full = style === 'full';
      let d = hs(hx, hy, hz) - (full ? 0.0062 : 0.0035);
      d += 0.0014 * S.wobble(hx, hy, hz, 190);
      // cheek line: from the sideburns down to the mouth corners
      const ax = Math.abs(hx);
      const cheekLine = 0.112 + S.smoothstep(0.03, 0.075, ax) * 0.05;
      const zone = Math.max(hy - cheekLine, -(hz + 0.012), ax - 0.081, (full ? 0.052 : 0.07) - hy - Math.max(0, hz) * 0.25);
      d = S.smax(d, zone, 0.005);
      // keep the lips clear
      d = S.smax(d, -(lipsKeep(hx, hy, hz) - 0.0035), 0.003);
      return d;
    };
    const lipsKeep = S.ellipsoid([0, MOUTH_Y + 0.001, 0.098], [0.028, 0.0125, 0.03]);
    const mouthHole = S.ellipsoid([0, MOUTH_Y - 0.004, 0.1], [0.024, 0.009, 0.03]);
    const memo = new Map();
    const local = (bx) => {
      const hsf = hloc.local([bx[0] + jx, bx[1] + jy, bx[2] + jz, bx[3] + jx, bx[4] + jy, bx[5] + jz]);
      let fn = memo.get(hsf);
      if (!fn) { fn = make(hsf); memo.set(hsf, fn); }
      return fn;
    };
    const sdf = make(hloc.full);
    const b = [-0.11, 0.02 - jy, -0.06 - jz, 0.11, 0.14 - jy, 0.15 - jz];
    const mesh = yield* S.surfaceNetsGen(sdf, b, h, { lipschitz: 1.5, local });
    return mesh.vertexCount ? buildGeometry(mesh) : null;
  }
}

// ---- hands (forearm space, rigid) -------------------------------------------------
export function handGeometry(side) { return cachedSync('hand|' + detail + '|' + side, () => handGen(side)); }
export function handAsync(side) { return cachedAsync('hand|' + detail + '|' + side, () => handGen(side)); }
function* handGen(side) {
  {
    const s = side === 'R' ? -1 : 1;
    const nodes = [];
    nodes.push(nCone([0, -0.222, 0], [0, -0.262, 0], 0.029, 0.027, 0));
    nodes.push(nBox([0, -0.305, 0.002], [0.0135, 0.047, 0.04], 0.012, 0.012));
    const fingers = [[0.026, 0.074, 0.0084], [0.0088, 0.081, 0.0088], [-0.0088, 0.076, 0.0085], [-0.026, 0.062, 0.0078]];
    for (const [fz, len, r] of fingers) {
      const a = [-0.001, -0.345, fz], m = [-0.004, -0.345 - len * 0.55, fz], e = [-0.014, -0.345 - len, fz * 0.96];
      nodes.push(nCone(a, m, r, r * 0.95, 0.005));
      nodes.push(nCone(m, e, r * 0.95, r * 0.86, 0.004));
    }
    nodes.push(nCone([-0.004, -0.268, 0.03], [-0.016, -0.312, 0.052], 0.0118, 0.0108, 0.008));
    nodes.push(nCone([-0.016, -0.312, 0.052], [-0.024, -0.34, 0.058], 0.0108, 0.0098, 0.005));
    const h = RES[detail].hands;
    const loc = S.compileLocal(nodes, localMargin(h, 1.2));
    const mir = (f) => (s > 0 ? f : (x, y, z) => f(-x, y, z));
    const sdf = mir(loc.full);
    const local = (bx) => mir(loc.local(s > 0 ? bx : [-bx[3], bx[1], bx[2], -bx[0], bx[4], bx[5]]));
    const b = [-0.05, -0.45, -0.06, 0.05, -0.2, 0.08];
    const mesh = yield* S.surfaceNetsGen(sdf, b, h, { lipschitz: 1.2, local });
    return buildGeometry(mesh);
  }
}

// ---- shoes (shin space, rigid, vertex colored) ---------------------------------------
export function shoeGeometry(style, colors) { return cachedSync('shoe|' + detail + '|' + style + '|' + colors.join(','), () => shoeGen(style, colors)); }
export function shoeAsync(style, colors) { return cachedAsync('shoe|' + detail + '|' + style + '|' + colors.join(','), () => shoeGen(style, colors)); }
function* shoeGen(style, colors) {
  {
    const nodes = [];
    const y0 = -DIM.shinLen;
    const dress = style === 'dress';
    nodes.push(nBox([0, y0 - 0.033, 0.04], [0.043, dress ? 0.028 : 0.033, 0.104], dress ? 0.026 : 0.03, 0));
    nodes.push(nEll([0, y0 - 0.044, 0.118], [0.044, dress ? 0.024 : 0.03, 0.054], 0.02));
    nodes.push(nEll([0, y0 - 0.037, -0.035], [0.04, 0.036, 0.04], 0.02));
    nodes.push(nCone([0, y0 - 0.025, -0.006], [0, y0 + 0.025, -0.008], 0.043, 0.043, 0.025));
    nodes.push(nBox([0, y0 - 0.067, 0.042], [0.047, 0.008, 0.115], 0.006, 0.003));
    const h = RES[detail].shoes;
    const loc = S.compileLocal(nodes, localMargin(h, 1.2));
    const b = [-0.07, y0 - 0.09, -0.1, 0.07, y0 + 0.06, 0.2];
    const mesh = yield* S.surfaceNetsGen(loc.full, b, h, { lipschitz: 1.2, local: loc.local });
    const n = mesh.vertexCount;
    const col = new Float32Array(n * 3);
    const up = new THREE.Color(colors[0]), sole = new THREE.Color(colors[1]), lace = new THREE.Color(colors[2] || colors[1]);
    for (let v = 0; v < n; v++) {
      const x = mesh.positions[v * 3], y = mesh.positions[v * 3 + 1], z = mesh.positions[v * 3 + 2];
      let c = up;
      if (y < y0 - 0.059) c = sole;
      else if (!dress && y > y0 - 0.035 && z > 0.01 && z < 0.105 && Math.abs(x) < 0.022 && Math.sin(z * 260) > 0.2) c = lace;
      col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
    }
    return buildGeometry(mesh, { colors: col });
  }
}

// ---- helpers for placing accessories on the body surface -----------------------------
// distance from (x, y, startZ) marching along -z until the body surface; returns z
export function frontSurfaceZ(body, x, y, startZ = 0.5) {
  const t = S.raymarch(body.sdf, [x, y, startZ], [0, 0, -1], 1);
  return t === null ? null : startZ - t;
}
export function surfaceAlong(body, origin, dir, maxT = 0.6) {
  const t = S.raymarch(body.sdf, origin, dir, maxT);
  return t === null ? null : [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
}

// ---- small sculpted accessories (rigid, any bone space) -------------------------------
// nodes built with the helpers below; cached by key
export function blobGeometry(key, makeNodes, h = 0.004, pad = 0.01) {
  return cachedSync('blob|' + detail + '|' + key, () => (function* () {
    const nodes = makeNodes();
    const loc = S.compileLocal(nodes, localMargin(h, 1.3));
    const b = S.boundsOf(nodes, pad);
    const mesh = yield* S.surfaceNetsGen(loc.full, b, h, { lipschitz: 1.3, local: loc.local });
    return mesh.vertexCount ? buildGeometry(mesh) : null;
  })());
}
export const node = { sphere: nSphere, ellipsoid: nEll, cone: nCone, box: nBox, sub: nSub };
