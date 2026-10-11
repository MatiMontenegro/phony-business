// Character materials: skin with soft light bleed, fabrics with a woven
// micro-relief, wet eyes, glossy hair. Surface detail is projected in object
// space (triplanar) so it sticks to the skinned meshes without UVs.
import * as THREE from 'three';

let quality = 'high';
export function setMaterialQuality(q) { quality = q; }
export const isLowQuality = () => quality === 'low';

// ---- tileable height maps (canvas) ------------------------------------------------------
const texCache = new Map();
function heightTex(name, size, fn) {
  if (texCache.has(name)) return texCache.get(name);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(1, fn(x / size, y / size)));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  texCache.set(name, t);
  return t;
}

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
// periodic value noise
function vnoise(u, v, p) {
  const x = u * p, y = v * p;
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const w = (a, b) => hash2(((a % p) + p) % p, ((b % p) + p) % p);
  const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(u, v, p, oct = 4) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(u, v, p) * a; n += a; a *= 0.5; p *= 2; }
  return s / n;
}

export const DETAIL = {
  // plain weave: over-under threads
  weave: () => heightTex('weave', 128, (u, v) => {
    const n = 16;
    const x = u * n, y = v * n;
    const cx = Math.floor(x), cy = Math.floor(y);
    const over = (cx + cy) % 2 === 0;
    const fx = x - cx, fy = y - cy;
    const warp = Math.sin(Math.PI * fx), weft = Math.sin(Math.PI * fy);
    return 0.15 + 0.7 * (over ? warp * (0.6 + 0.4 * weft) : weft * (0.6 + 0.4 * warp)) + 0.15 * fbm(u, v, 32, 2);
  }),
  // twill diagonals (denim, suit)
  twill: () => heightTex('twill', 128, (u, v) => {
    const d = (u * 24 + v * 24) % 1;
    return 0.2 + 0.6 * Math.pow(Math.sin(Math.PI * d), 2) + 0.2 * fbm(u, v, 32, 2);
  }),
  // knit stitches (sweaters, beanies)
  knit: () => heightTex('knit', 128, (u, v) => {
    const n = 10;
    const x = u * n, y = v * n * 1.4;
    const fx = x - Math.floor(x), fy = y - Math.floor(y);
    const side = fx < 0.5 ? fx * 2 : (1 - fx) * 2;
    const vee = Math.abs(fy - side * 0.5 - 0.25);
    return 1 - Math.min(1, vee * 3.2) * 0.85 + 0.1 * fbm(u, v, 24, 2);
  }),
  // skin: pores and fine creases
  pores: () => heightTex('pores', 256, (u, v) => {
    const cell = 48;
    const x = u * cell, y = v * cell;
    const xi = Math.floor(x), yi = Math.floor(y);
    let dmin = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const px = xi + i + hash2(((xi + i) % cell + cell) % cell, ((yi + j) % cell + cell) % cell);
      const py = yi + j + hash2(((yi + j) % cell + cell) % cell + 99, ((xi + i) % cell + cell) % cell);
      dmin = Math.min(dmin, Math.hypot(x - px, y - py));
    }
    return 0.55 + 0.35 * Math.min(1, dmin * 1.6) + 0.1 * fbm(u, v, 16, 3);
  }),
  // hair strands: stretched noise along one axis
  strands: () => heightTex('strands', 128, (u, v) => 0.5 + 0.5 * (fbm(u * 1, v * 0.06 + u * 0.002, 64, 3) - 0.5) * 2),
  // pebbled leather / plastic
  pebble: () => heightTex('pebble', 128, (u, v) => fbm(u, v, 24, 3)),
};

// ---- shader patch: triplanar micro relief (bump from screen derivatives) --------------
const PATCH_VERT_HEAD = `
varying vec3 vTriPos;
varying vec3 vTriN;`;
const PATCH_FRAG_HEAD = `
uniform sampler2D uDetail;
uniform float uDetailScale;
uniform float uDetailStrength;
uniform float uWrap;
uniform vec3 uBleed;
varying vec3 vTriPos;
varying vec3 vTriN;
float triH(vec3 p, vec3 n) {
  vec3 w = pow(abs(normalize(n)), vec3(4.0));
  w /= (w.x + w.y + w.z + 1e-5);
  return texture2D(uDetail, p.zy * uDetailScale).r * w.x
       + texture2D(uDetail, p.xz * uDetailScale).r * w.y
       + texture2D(uDetail, p.xy * uDetailScale).r * w.z;
}
vec3 triBump(vec3 surfPos, vec3 surfNorm, float h, float amp) {
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * amp * r1 + dFdy(h) * amp * r2);
  return normalize(abs(det) * surfNorm - grad);
}`;

function patch(mat, opts) {
  const tex = opts.detail ? DETAIL[opts.detail]() : null;
  const wrap = opts.wrap || 0;
  if (!tex && !wrap) return mat;
  const bleed = new THREE.Color(opts.bleed || '#000000');
  mat.userData.detail = { scale: opts.scale || 300, amp: opts.amp || 0.0004 };
  const fn = (sh) => {
    sh.uniforms.uDetail = { value: tex };
    sh.uniforms.uDetailScale = { value: mat.userData.detail.scale };
    sh.uniforms.uDetailStrength = { value: tex ? mat.userData.detail.amp : 0 };
    sh.uniforms.uWrap = { value: wrap };
    sh.uniforms.uBleed = { value: bleed };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>' + PATCH_VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTriPos = position;\n  vTriN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + PATCH_FRAG_HEAD);
    if (tex) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    float fadeD = smoothstep(7.0, 1.2, length(vViewPosition));
    if (fadeD > 0.001) {
      float hh = triH(vTriPos, vTriN);
      normal = triBump(-vViewPosition, normal, hh, uDetailStrength * fadeD * faceDirection);
    }
  }`);
    }
    if (wrap > 0) {
      // soft light bleed: light wraps past the terminator, tinted (skin, fabric)
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  {
    float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
    float rim = pow(1.0 - ndv, 3.0);
    reflectedLight.indirectDiffuse += diffuseColor.rgb * uBleed * (uWrap * 0.35 + rim * uWrap);
  }`);
    }
  };
  const key = 'pb:' + (opts.detail || '-') + ':' + (wrap > 0 ? 'w' : '-');
  mat.onBeforeCompile = fn;
  mat.customProgramCacheKey = () => key;
  mat.userData.patchFn = fn;
  mat.userData.patchKey = key;
  return mat;
}

// Body regions share triangles along clothing edges; each material keeps only
// the fragments whose interpolated coverage says they belong to it.
const regionCache = new Map();
export function regionMaterial(base, region) {
  const k = base.uuid + '|' + region;
  if (regionCache.has(k)) return regionCache.get(k);
  const m = base.clone();
  const prev = base.userData.patchFn;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uRegion = { value: region };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 cover;\nvarying vec3 vCover;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vCover = cover;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCover;\nuniform float uRegion;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  {
    float rg = vCover.y > 0.5 ? 2.0 : (vCover.z > 0.5 ? 3.0 : (vCover.x > 0.5 ? 1.0 : 0.0));
    if (abs(rg - uRegion) > 0.5) discard;
  }`);
  };
  m.customProgramCacheKey = () => (base.userData.patchKey || 'plain') + '|reg' + region;
  regionCache.set(k, m);
  return m;
}

const matCache = new Map();
function cachedMat(key, make) {
  const k = quality + '|' + key;
  if (!matCache.has(k)) matCache.set(k, make());
  return matCache.get(k);
}
export function clearMaterialCache() { matCache.clear(); }

function physical(params) {
  if (quality === 'low') {
    const p = { ...params };
    for (const k of ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'sheenColor', 'transmission', 'thickness', 'ior', 'iridescence', 'specularIntensity']) delete p[k];
    return new THREE.MeshStandardMaterial(p);
  }
  return new THREE.MeshPhysicalMaterial(params);
}

// ---- public factories --------------------------------------------------------------
export function skinMaterial(color, { head = false, ghost = false, metal = false } = {}) {
  return cachedMat(`skin|${color}|${head}|${ghost}|${metal}`, () => {
    if (metal) {
      return patch(physical({ color, metalness: 0.85, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.25, vertexColors: head }), { detail: 'pebble', scale: 90, amp: 0.00025 });
    }
    const m = physical({
      color,
      roughness: 0.52,
      metalness: 0,
      vertexColors: head,
      sheen: 0.15,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color('#ffd2c4'),
      specularIntensity: 0.6,
      transparent: ghost,
      opacity: ghost ? 0.62 : 1,
      depthWrite: !ghost,
      emissive: ghost ? new THREE.Color('#5a78c0') : new THREE.Color('#000000'),
      emissiveIntensity: ghost ? 0.45 : 0,
    });
    return patch(m, { detail: 'pores', scale: 420, amp: 0.00004, wrap: ghost ? 0 : 0.3, bleed: '#c2453a' });
  });
}

export const FABRIC = {
  buttonup: { detail: 'weave', scale: 360, amp: 0.00045, rough: 0.82, sheen: 0.5 },
  polo: { detail: 'knit', scale: 260, amp: 0.0005, rough: 0.86, sheen: 0.55 },
  tee: { detail: 'knit', scale: 320, amp: 0.0004, rough: 0.88, sheen: 0.6 },
  hoodie: { detail: 'knit', scale: 190, amp: 0.00065, rough: 0.92, sheen: 0.75 },
  sweater: { detail: 'knit', scale: 120, amp: 0.0011, rough: 0.94, sheen: 0.7 },
  cardigan: { detail: 'knit', scale: 130, amp: 0.001, rough: 0.94, sheen: 0.7 },
  suit: { detail: 'twill', scale: 260, amp: 0.00035, rough: 0.7, sheen: 0.4 },
  tank: { detail: 'knit', scale: 320, amp: 0.0004, rough: 0.88, sheen: 0.6 },
  armor: { detail: 'pebble', scale: 60, amp: 0.0003, rough: 0.3, metal: 0.9 },
  robe: { detail: 'weave', scale: 200, amp: 0.0006, rough: 0.9, sheen: 0.8 },
  jeans: { detail: 'twill', scale: 300, amp: 0.0005, rough: 0.86, sheen: 0.35 },
  slacks: { detail: 'twill', scale: 380, amp: 0.0003, rough: 0.74, sheen: 0.4 },
};

export function fabricMaterial(color, kind = 'buttonup', { ghost = false } = {}) {
  return cachedMat(`fab|${color}|${kind}|${ghost}`, () => {
    const f = FABRIC[kind] || FABRIC.buttonup;
    const m = physical({
      color,
      roughness: f.rough,
      metalness: f.metal || 0,
      sheen: f.metal ? 0 : f.sheen,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.45),
      clearcoat: f.metal ? 0.4 : 0,
      transparent: ghost,
      opacity: ghost ? 0.6 : 1,
      depthWrite: !ghost,
      emissive: ghost ? new THREE.Color('#4a66b0') : new THREE.Color('#000000'),
      emissiveIntensity: ghost ? 0.35 : 0,
    });
    return patch(m, { detail: f.detail, scale: f.scale, amp: f.amp, wrap: f.metal ? 0 : 0.12, bleed: color });
  });
}

export function hairMaterial(color) {
  return cachedMat(`hair|${color}`, () => {
    const m = physical({
      color,
      roughness: 0.42,
      metalness: 0,
      vertexColors: true,
      sheen: 0.8,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff4e0'), 0.55),
      clearcoat: 0.25,
      clearcoatRoughness: 0.45,
    });
    return patch(m, { detail: 'strands', scale: 140, amp: 0.0006, wrap: 0.1, bleed: color });
  });
}

export function plainMaterial(color, opts = {}) {
  const key = 'plain|' + color + '|' + JSON.stringify(opts);
  return cachedMat(key, () => {
    const m = physical({
      color,
      roughness: opts.roughness ?? 0.5,
      metalness: opts.metalness ?? 0,
      clearcoat: opts.clearcoat ?? 0,
      clearcoatRoughness: opts.clearcoatRoughness ?? 0.2,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color('#000000'),
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      vertexColors: !!opts.vertexColors,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
      side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: opts.depthWrite ?? true,
      envMapIntensity: opts.env ?? 1,
    });
    if (opts.detail) patch(m, { detail: opts.detail, scale: opts.scale || 200, amp: opts.amp || 0.0004 });
    return m;
  });
}

// ---- eyes ---------------------------------------------------------------------------
// The eyeball's pole points forward; the texture is laid out in latitude
// bands: pupil, iris (radial fibers), limbal ring, sclera.
function irisCanvas(color, pupil = 'round') {
  const W = 256, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const sclera = ctx.createLinearGradient(0, 0, 0, H);
  sclera.addColorStop(0, '#f8f4ee');
  sclera.addColorStop(0.55, '#f1e7df');
  sclera.addColorStop(1, '#d9b9b0');
  ctx.fillStyle = sclera;
  ctx.fillRect(0, 0, W, H);
  // fine veins toward the back
  ctx.strokeStyle = 'rgba(190,70,70,0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * W;
    ctx.beginPath();
    ctx.moveTo(x, H);
    let y = H, xx = x;
    while (y > H * 0.32) { y -= 6 + Math.random() * 8; xx += (Math.random() - 0.5) * 10; ctx.lineTo(xx, y); }
    ctx.stroke();
  }
  const irisEnd = H * 0.235;
  const base = new THREE.Color(color);
  const dark = base.clone().multiplyScalar(0.45);
  const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.35);
  const g = ctx.createLinearGradient(0, 0, 0, irisEnd);
  g.addColorStop(0, '#' + dark.getHexString());
  g.addColorStop(0.45, '#' + light.getHexString());
  g.addColorStop(0.8, '#' + base.getHexString());
  g.addColorStop(1, '#' + dark.getHexString());
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, irisEnd);
  // radial fibers = vertical streaks in latitude space
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * W;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.14)';
    ctx.fillRect(x, H * 0.04, 1 + Math.random() * 1.5, irisEnd * (0.5 + Math.random() * 0.5));
  }
  // limbal ring
  ctx.fillStyle = 'rgba(10,8,12,0.55)';
  ctx.fillRect(0, irisEnd - 5, W, 7);
  // pupil
  ctx.fillStyle = '#060508';
  if (pupil === 'slit') {
    for (let x = 0; x < W; x++) {
      const a = (x / W) * Math.PI * 2;
      const h = H * 0.03 + H * 0.16 * Math.pow(Math.abs(Math.cos(a)), 6);
      ctx.fillRect(x, 0, 1, h);
    }
  } else {
    ctx.fillRect(0, 0, W, H * (pupil === 'big' ? 0.14 : 0.085));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function eyeMaterial(color, pupil = 'round') {
  return cachedMat(`eye|${color}|${pupil}`, () => {
    const map = typeof document !== 'undefined' ? irisCanvas(color, pupil) : null;
    return physical({
      map,
      roughness: 0.18,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      specularIntensity: 1,
      envMapIntensity: 1.3,
    });
  });
}

// ---- name badge texture --------------------------------------------------------------
export function badgeTexture(name, color = '#ff4d5e') {
  if (typeof document === 'undefined') return null;
  const key = 'badge|' + name + '|' + color;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f1e3';
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 44);
  g.fillStyle = '#ffffff';
  g.font = '700 26px "Bricolage Grotesque", sans-serif';
  g.textBaseline = 'middle';
  g.fillText('PHONY BIZ', 14, 23);
  g.fillStyle = '#c9c0a8';
  g.fillRect(14, 58, 56, 76);
  g.fillStyle = '#8a7f6a';
  g.beginPath(); g.arc(42, 84, 14, 0, Math.PI * 2); g.fill();
  g.fillRect(24, 104, 36, 30);
  g.fillStyle = '#1a1433';
  let fs = 34;
  g.font = `800 ${fs}px "Bricolage Grotesque", sans-serif`;
  const label = String(name || '').toUpperCase().slice(0, 14);
  while (g.measureText(label).width > 166 && fs > 14) { fs -= 2; g.font = `800 ${fs}px "Bricolage Grotesque", sans-serif`; }
  g.fillText(label, 80, 88);
  g.font = '600 16px "IBM Plex Mono", monospace';
  g.fillStyle = '#5b4f8a';
  g.fillText('AGENT', 80, 122);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
