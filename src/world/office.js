// The night-shift office: two cubicle pods, bathroom, boss office, break
// area, rainy windows with lightning, light shafts and dust. Static pieces
// are merged per material; colliders go to Rapier.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as TX from '../engine/textures.js';
import { TUNE } from '../config.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const SCREEN = { w: 640, h: 480, planeW: 0.44, planeH: 0.33, y: 1.0, z: 0.072 };
export const SEAT_Z = 0.66; // chair distance in front of the desk centre

class Batcher {
  constructor(parent) { this.parent = parent; this.groups = new Map(); }
  add(geo, mat, matrix, cast = true, receive = true) {
    const key = mat.uuid + (cast ? 'c' : '') + (receive ? 'r' : '');
    let g = this.groups.get(key);
    if (!g) { g = { mat, cast, receive, list: [] }; this.groups.set(key, g); }
    const c = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k)) c.deleteAttribute(k);
    if (!c.attributes.uv) c.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
    c.applyMatrix4(matrix);
    g.list.push(c);
  }
  finalize() {
    const out = [];
    for (const g of this.groups.values()) {
      const merged = mergeGeometries(g.list, false);
      g.list.forEach((x) => x.dispose());
      const m = new THREE.Mesh(merged, g.mat);
      m.castShadow = g.cast;
      m.receiveShadow = g.receive;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      this.parent.add(m);
      out.push(m);
    }
    this.groups.clear();
    return out;
  }
}

const GEO = new Map();
function rbox(w, h, d, r = 0.02, s = 2) {
  const k = `rb${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${r}_${s}`;
  if (!GEO.has(k)) GEO.set(k, new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2)));
  return GEO.get(k);
}
function cyl(rt, rb, h, seg = 20, open = false) {
  const k = `cy${rt}_${rb}_${h}_${seg}_${open}`;
  if (!GEO.has(k)) GEO.set(k, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
  return GEO.get(k);
}
function sph(r, w = 20, h = 14) {
  const k = `sp${r}_${w}_${h}`;
  if (!GEO.has(k)) GEO.set(k, new THREE.SphereGeometry(r, w, h));
  return GEO.get(k);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function M(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)).clone();
}

// animated rain on glass + lightning flash
function rainMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uRain: { value: 1 }, tDrops: { value: TX.rainDrops() } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vW;
      void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; uniform float uFlash; uniform float uRain; uniform sampler2D tDrops;
      varying vec2 vUv; varying vec3 vW;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 uv = vW.xy * vec2(0.9, 0.9);
        // static beads
        vec2 b = texture2D(tDrops, uv * 0.7).xy - 0.5;
        float bead = smoothstep(0.08, 0.22, length(b));
        // running drops: columns with a falling head and a trail
        float cols = 60.0;
        float cx = floor(uv.x * cols);
        float sp = 0.5 + h(vec2(cx, 1.0)) * 1.4;
        float yy = fract(uv.y * 0.35 + uTime * sp * 0.25 + h(vec2(cx, 7.0)));
        float lx = abs(fract(uv.x * cols) - 0.5);
        float head = smoothstep(0.08, 0.0, abs(yy - 0.15)) * smoothstep(0.35, 0.05, lx);
        float trail = smoothstep(0.15, 1.0, yy) * smoothstep(0.12, 0.0, lx) * 0.35 * step(0.55, h(vec2(cx, 3.0)));
        float run = (head + trail) * step(0.35, h(vec2(cx, 5.0)));
        float drops = clamp(bead * 0.45 + run, 0.0, 1.0) * uRain;
        vec3 c = vec3(0.62, 0.72, 1.0) * drops * 0.22 + vec3(0.8, 0.85, 1.0) * uFlash * 0.25;
        gl_FragColor = vec4(c, clamp(drops * 0.35 + uFlash * 0.2 + 0.03, 0.0, 0.6));
      }`,
    transparent: true,
    depthWrite: false,
  });
}

function dustMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, map: { value: map }, uScale: { value: 220 } },
    vertexShader: `
      attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * (0.04 + fract(aSeed * 7.3) * 0.05);
        p.x += sin(t * 6.2832 + aSeed * 11.0) * 0.25;
        p.z += cos(t * 5.0 + aSeed * 3.0) * 0.25;
        p.y = mod(p.y - t * 0.6 - 1.0, 3.0) + 1.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // brighter inside the ceiling light shafts (pods at x = +-4.2)
        float inShaft = smoothstep(1.6, 0.4, min(abs(abs(p.x) - 4.2), 3.0)) * smoothstep(3.6, 0.0, abs(p.z - 0.8));
        vA = (0.15 + inShaft * 0.85) * smoothstep(1.0, 1.4, p.y) * smoothstep(4.0, 3.4, p.y);
        gl_PointSize = (2.0 + fract(aSeed * 13.1) * 2.5) * uScale / 220.0 * 6.0 / max(0.4, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; varying float vA;
      void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * t.a, t.a * vA * 0.5); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function buildOffice(scene, physics, { lang = 'en', reflector = null } = {}) {
  const root = new THREE.Group();
  root.name = 'office';
  scene.add(root);
  const B = new Batcher(root);
  const colliders = [];
  const interactables = [];
  const desks = [];
  const toilets = [];
  const urinals = [];
  const plants = [];
  const updaters = [];
  const box = (x, y, z, hx, hy, hz) => { colliders.push({ min: V(x - hx, y - hy, z - hz), max: V(x + hx, y + hy, z + hz) }); return physics.addStaticBox(x, y, z, hx, hy, hz); };
  // add(geometry, matrix, material) or add(geometry, material, matrix)
  const add = (g, a, b, c = true, r = true) => (a && a.isMatrix4 ? B.add(g, b, a, c, r) : B.add(g, a, b, c, r));
  // local placement helper: returns (geo, mat, x,y,z, rx,ry,rz, cast, receive, sx,sy,sz)
  const at = (x, y, z, ry = 0) => {
    const base = M(x, y, z, 0, ry, 0);
    return (g, mat, lx, ly, lz, rx = 0, rry = 0, rz = 0, c = true, r = true, sx = 1, sy = 1, sz = 1) => add(g, mat, base.clone().multiply(M(lx, ly, lz, rx, rry, rz, sx, sy, sz)), c, r);
  };

  // ---- materials -----------------------------------------------------------------
  const m = {};
  const con = TX.concrete();
  m.floor = new THREE.MeshStandardMaterial({ map: con.map, roughnessMap: con.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 2.2 });
  m.carpet = new THREE.MeshStandardMaterial({ ...TX.carpet(), roughness: 0.96 });
  m.tile = new THREE.MeshStandardMaterial({ ...TX.tiles('#bfe3dc', '#5f8784', 10), roughness: 0.22, envMapIntensity: 1.3 });
  m.wood = new THREE.MeshStandardMaterial({ ...TX.wood(), roughness: 0.42 });
  m.ceiling = new THREE.MeshStandardMaterial({ ...TX.ceiling(), roughness: 0.95 });
  m.wall = new THREE.MeshStandardMaterial({ color: '#2a2342', roughness: 0.86 });
  m.wallAccent = new THREE.MeshStandardMaterial({ color: '#352a5e', roughness: 0.8 });
  m.bathWall = new THREE.MeshStandardMaterial({ ...TX.tiles('#d9efe9', '#88a8a3', 12), roughness: 0.3 });
  m.trim = new THREE.MeshStandardMaterial({ color: '#18122c', roughness: 0.6 });
  m.laminate = new THREE.MeshStandardMaterial({ color: '#cdc5b4', roughness: 0.5 });
  m.metal = new THREE.MeshStandardMaterial({ color: '#4a4860', metalness: 0.65, roughness: 0.38 });
  m.chrome = new THREE.MeshStandardMaterial({ color: '#e8eaf2', metalness: 1, roughness: 0.14 });
  m.fabric = new THREE.MeshStandardMaterial({ ...TX.fabric('#36457a'), roughness: 0.95 });
  m.fabricAlt = new THREE.MeshStandardMaterial({ ...TX.fabric('#5a3a72'), roughness: 0.95 });
  m.frame = new THREE.MeshStandardMaterial({ color: '#cfc9b9', roughness: 0.45 });
  m.beige = new THREE.MeshStandardMaterial({ color: '#d8cfba', roughness: 0.48 });
  m.darkPlastic = new THREE.MeshStandardMaterial({ color: '#221c38', roughness: 0.42 });
  m.keyboard = new THREE.MeshStandardMaterial({ map: TX.keyboard(), roughness: 0.55 });
  m.porcelain = new THREE.MeshPhysicalMaterial({ color: '#f4f6fb', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 });
  m.glass = new THREE.MeshPhysicalMaterial({ color: '#9fc0ff', roughness: 0.04, transparent: true, opacity: 0.14, envMapIntensity: 2, depthWrite: false });
  m.mirror = new THREE.MeshStandardMaterial({ color: '#dfe7f3', metalness: 1, roughness: 0.04, envMapIntensity: 1.6 });
  m.leaf = new THREE.MeshStandardMaterial({ color: '#2f9a63', roughness: 0.55 });
  m.leafDark = new THREE.MeshStandardMaterial({ color: '#1f6b47', roughness: 0.6 });
  m.potYellow = new THREE.MeshStandardMaterial({ color: '#ffd84d', roughness: 0.4 });
  m.potRed = new THREE.MeshStandardMaterial({ color: '#ff4d5e', roughness: 0.4 });
  m.mug = new THREE.MeshPhysicalMaterial({ color: '#f6f1e3', roughness: 0.25, clearcoat: 0.6 });
  m.coffee = new THREE.MeshStandardMaterial({ color: '#2a160c', roughness: 0.15 });
  m.leather = new THREE.MeshPhysicalMaterial({ color: '#42141f', roughness: 0.42, clearcoat: 0.35 });
  m.gold = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 1, roughness: 0.25 });
  m.water = new THREE.MeshPhysicalMaterial({ color: '#7fc8ff', roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 });
  m.red = new THREE.MeshStandardMaterial({ color: '#ff4d5e', roughness: 0.5 });
  m.yellow = new THREE.MeshStandardMaterial({ color: '#ffd84d', roughness: 0.5 });
  m.paper = new THREE.MeshStandardMaterial({ color: '#f3f0e8', roughness: 0.9 });
  m.couch = new THREE.MeshStandardMaterial({ ...TX.fabric('#b8443f'), roughness: 0.9 });
  m.whiteboard = new THREE.MeshStandardMaterial({ map: TX.whiteboard(lang), roughness: 0.25 });
  m.lightPanel = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#eaf4ff', emissiveIntensity: 1.9 });
  m.lampBulb = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffc777', emissiveIntensity: 2.2 });
  m.ledGreen = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#46e3a0', emissiveIntensity: 3 });
  m.ledRed = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ff4d5e', emissiveIntensity: 3 });
  m.vendGlow = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#b6d4ff', emissiveIntensity: 1.6 });
  const dot = TX.softDot();
  const pool = (c, k) => new THREE.MeshBasicMaterial({ map: dot, color: new THREE.Color(c).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  m.poolWarm = pool('#ffb257', 0.55);
  m.poolBlue = pool('#6f8dff', 0.42);
  m.poolPink = pool('#ff4d6e', 0.5);
  const quad = new THREE.PlaneGeometry(1, 1);
  const H = 4.2;

  // ---- floor, ceiling --------------------------------------------------------------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), m.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  if (reflector) { reflector.apply(m.floor, { strength: 1, rough: 1.25 }); reflector.hidden.push(floor); }
  physics.addStaticBox(0, -0.5, 0, 17, 0.5, 10);
  const carpetGeo = new THREE.PlaneGeometry(7.6, 6.2);
  for (const x of [-4.2, 4.2]) {
    const c = new THREE.Mesh(carpetGeo, m.carpet);
    c.rotation.x = -Math.PI / 2;
    c.position.set(x, 0.004, 0.8);
    c.receiveShadow = true;
    root.add(c);
  }
  m.tileFloor = m.tile.clone();
  const tileF = new THREE.Mesh(new THREE.PlaneGeometry(6, 9), m.tileFloor);
  tileF.rotation.x = -Math.PI / 2;
  tileF.position.set(-12, 0.005, -5.5);
  tileF.receiveShadow = true;
  root.add(tileF);
  if (reflector) { reflector.apply(m.tileFloor, { strength: 0.8, rough: 1 }); reflector.hidden.push(tileF); }
  m.woodFloor = m.wood.clone();
  const woodF = new THREE.Mesh(new THREE.PlaneGeometry(6, 9), m.woodFloor);
  woodF.rotation.x = -Math.PI / 2;
  woodF.position.set(12, 0.005, -5.5);
  woodF.receiveShadow = true;
  root.add(woodF);
  if (reflector) { reflector.apply(m.woodFloor, { strength: 0.6, rough: 1.4 }); reflector.hidden.push(woodF); }
  physics.addStaticBox(0, 4.5, 0, 15, 0.3, 10);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), m.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  root.add(ceil);

  // ---- walls ---------------------------------------------------------------------------
  const T = 0.2;
  const wall = (x0, z0, x1, z1, y0 = 0, y1 = H, mat = m.wall, solid = true) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = Math.abs(x1 - x0) || T, d = Math.abs(z1 - z0) || T, h = y1 - y0;
    add(rbox(w, h, d, 0.01, 1), M(cx, y0 + h / 2, cz), mat);
    if (solid) box(cx, y0 + h / 2, cz, w / 2, h / 2, d / 2);
  };
  wall(-15, 10, 15, 10);
  wall(-15, -10, -15, 10);
  wall(15, -10, 15, 10);
  wall(-15, -10, -9, -10);
  wall(-9, -10, 15, -10, 0, 0.85);
  wall(-9, -10, 15, -10, 3.2, H, m.wallAccent, false);
  colliders.push({ min: V(-9, 0, -10.1), max: V(15, 4, -9.9) });
  const windowCollider = physics.addStaticBox(3, 2, -10, 12, 2, 0.1);
  for (let x = -9; x <= 15.01; x += 2) add(rbox(0.12, 2.35, 0.16, 0.02), M(x, 2.025, -10), m.trim);
  add(rbox(24, 0.1, 0.36, 0.02), M(3, 0.88, -9.92), m.trim);
  add(rbox(24, 0.1, 0.2, 0.02), M(3, 3.2, -9.95), m.trim);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(24, 2.35), m.glass);
  glass.position.set(3, 2.025, -9.97);
  root.add(glass);
  const rainMat = rainMaterial();
  const rain = new THREE.Mesh(new THREE.PlaneGeometry(24, 2.35), rainMat);
  rain.position.set(3, 2.025, -9.95);
  rain.renderOrder = 4;
  root.add(rain);
  const breakWindows = () => { windowCollider.setEnabled(false); glass.visible = false; rain.visible = false; };
  const repairWindows = () => { windowCollider.setEnabled(true); glass.visible = true; rain.visible = true; };
  const skyMat = new THREE.MeshBasicMaterial({ map: TX.skyline(), fog: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(90, 34), skyMat);
  sky.position.set(4, 6, -40);
  root.add(sky);
  // bathroom walls
  wall(-9, -10, -9, -3.6);
  wall(-9, -1.8, -9, -1);
  wall(-9, -3.6, -9, -1.8, 2.4, H, m.wall, true);
  wall(-15, -1, -9, -1);
  add(rbox(5.9, 2.4, 0.02, 0.005, 1), M(-12, 1.2, -9.88), m.bathWall, false, true);
  add(rbox(0.02, 2.4, 8.8, 0.005, 1), M(-14.88, 1.2, -5.5), m.bathWall, false, true);
  add(rbox(0.02, 2.4, 5.4, 0.005, 1), M(-9.12, 1.2, -6.8), m.bathWall, false, true);
  // boss office glass walls
  const glassWall = (x0, z0, x1, z1) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.abs(x1 - x0) || 0.08, d = Math.abs(z1 - z0) || 0.08;
    add(rbox(w, 0.6, d, 0.01, 1), M(cx, 0.3, cz), m.trim);
    add(rbox(w, 0.06, d + 0.02, 0.01, 1), M(cx, 2.95, cz), m.trim);
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, 2.3, d), m.glass);
    g.position.set(cx, 1.75, cz);
    root.add(g);
    box(cx, 1.5, cz, w / 2, 1.5, d / 2);
  };
  glassWall(9, -10, 9, -3.6);
  glassWall(9, -1.8, 9, -1);
  glassWall(9, -1, 15, -1);
  wall(9, -3.6, 9, -1.8, 3, H, m.wall, false);
  wall(9, -10, 9, -1, 3, H, m.wall, false);
  wall(9, -1, 15, -1, 3, H, m.wall, false);
  for (const z of [-10, -6.8, -3.6, -1.8, -1]) add(rbox(0.12, 3, 0.12, 0.02), M(9, 1.5, z), m.trim);
  for (const x of [11, 13, 15]) add(rbox(0.12, 3, 0.12, 0.02), M(x, 1.5, -1), m.trim);

  // ---- posters, pillars, wainscot ------------------------------------------------------
  const posterDefs = lang === 'es'
    ? [
      { lines: ['¡Atendé!', 'El teléfono no se vende solo.'], art: 'phone', bg: '#ffd84d' },
      { lines: ['Aguantá', 'El baño tiene horario.'], art: 'toilet', bg: '#8fa7ff' },
      { lines: ['Respirá', 'Ventilá antes de la reunión.'], art: 'cloud', bg: '#46e3a0' },
      { lines: ['Crecé', 'Gráfico 100% real.'], art: 'chart', bg: '#ff9f6b' },
    ]
    : [
      { lines: ['Pick Up!', "The phone won't sell itself."], art: 'phone', bg: '#ffd84d' },
      { lines: ['Hold It', 'Bathroom breaks are scheduled.'], art: 'toilet', bg: '#8fa7ff' },
      { lines: ['Breathe', 'Ventilate before meetings.'], art: 'cloud', bg: '#46e3a0' },
      { lines: ['Synergy', 'Chart is 100% real.'], art: 'chart', bg: '#ff9f6b' },
    ];
  const posterMats = posterDefs.map((p) => new THREE.MeshStandardMaterial({ map: TX.poster(p.lines, { bg: p.bg, artShape: p.art }), roughness: 0.6 }));
  const posterGeo = new THREE.PlaneGeometry(0.9, 1.24);
  const posterAt = (i, x, y, z, ry) => {
    const p = new THREE.Mesh(posterGeo, posterMats[i % posterMats.length]);
    p.position.set(x, y, z);
    p.rotation.y = ry;
    p.receiveShadow = true;
    root.add(p);
  };
  for (const [x, z] of [[-7.4, -5], [7.4, -5], [-7.4, 6.2], [7.4, 6.2]]) {
    add(rbox(0.7, H, 0.7, 0.03), M(x, H / 2, z), m.wallAccent);
    add(rbox(0.74, 0.12, 0.74, 0.02), M(x, 0.06, z), m.trim);
    box(x, H / 2, z, 0.35, H / 2, 0.35);
  }
  posterAt(0, -7.04, 1.75, -5, Math.PI / 2);
  posterAt(3, 7.04, 1.75, -5, -Math.PI / 2);
  posterAt(1, -7.04, 1.75, 6.2, Math.PI / 2);
  posterAt(2, 7.04, 1.75, 6.2, -Math.PI / 2);
  posterAt(2, -14.88, 1.8, 0.4, Math.PI / 2);
  posterAt(3, 14.88, 1.8, 4, -Math.PI / 2);
  posterAt(1, 1.2, 1.8, 9.88, Math.PI);
  const wains = new THREE.MeshStandardMaterial({ color: '#1b1630', roughness: 0.65 });
  add(rbox(29.6, 1.1, 0.04, 0.01, 1), M(0, 0.55, 9.88), wains, false, true);
  add(rbox(0.04, 1.1, 10.8, 0.01, 1), M(-14.88, 0.55, 4.5), wains, false, true);
  add(rbox(0.04, 1.1, 10.8, 0.01, 1), M(14.88, 0.55, 4.5), wains, false, true);
  add(rbox(29.6, 0.05, 0.06, 0.01, 1), M(0, 1.12, 9.87), m.trim, false, true);
  add(rbox(0.06, 0.05, 10.8, 0.01, 1), M(-14.87, 1.12, 4.5), m.trim, false, true);
  add(rbox(0.06, 0.05, 10.8, 0.01, 1), M(14.87, 1.12, 4.5), m.trim, false, true);

  // ---- neon sign ---------------------------------------------------------------------------
  const neonMat = new THREE.MeshBasicMaterial({ map: TX.neon('Phony Business', '#ff4d5e'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  neonMat.color.setScalar(3);
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), neonMat);
  neon.position.set(0, 3.72, -9.85);
  root.add(neon);
  const neonBack = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 0.95), new THREE.MeshStandardMaterial({ color: '#120c24', roughness: 0.5, metalness: 0.3 }));
  neonBack.position.set(0, 3.7, -9.88);
  root.add(neonBack);
  updaters.push((t) => { const flick = Math.sin(t * 37) > 0.995 || t % 11 > 10.85 ? 0.35 : 1; neonMat.color.setScalar(3 * flick); });

  // ---- ceiling lights + shafts -----------------------------------------------------------
  for (const x of [-4.2, 4.2]) for (const z of [-0.6, 2.2]) {
    add(rbox(2.6, 0.06, 0.5, 0.02), M(x, 4.16, z), m.trim, false, false);
    add(rbox(2.5, 0.02, 0.4, 0.01), M(x, 4.12, z), m.lightPanel, false, false);
  }
  for (const [x, z] of [[-12, -5.5], [12, -5.5], [-12, 5.5], [0, -7.5], [0, 8.5], [8, 6], [-7, -7]]) {
    add(rbox(1.3, 0.06, 0.5, 0.02), M(x, 4.16, z), m.trim, false, false);
    add(rbox(1.2, 0.02, 0.4, 0.01), M(x, 4.12, z), m.lightPanel, false, false);
  }
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#bcd2ff') }, uStrength: { value: 0.11 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uStrength; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { float facing = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float fall = pow(vUv.y, 1.6); gl_FragColor = vec4(uColor * uStrength * facing * fall, 1.0); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shaftGeo = new THREE.CylinderGeometry(0.9, 1.9, 4.1, 24, 1, true);
  for (const x of [-4.2, 4.2]) for (const z of [-0.6, 2.2]) {
    const s = new THREE.Mesh(shaftGeo, shaftMat);
    s.position.set(x, 4.1 / 2, z);
    s.scale.set(1.5, 1, 0.55);
    s.renderOrder = 5;
    root.add(s);
  }
  // dust motes drifting through the light
  {
    const n = 420;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() < 0.5 ? -4.2 : 4.2) + (Math.random() - 0.5) * 4;
      pos[i * 3 + 1] = 1 + Math.random() * 3;
      pos[i * 3 + 2] = 0.8 + (Math.random() - 0.5) * 6;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const dm = dustMaterial(dot);
    const dust = new THREE.Points(g, dm);
    dust.frustumCulled = false;
    dust.renderOrder = 6;
    root.add(dust);
    updaters.push((t) => { dm.uniforms.uTime.value = t; });
  }
  for (const z of [-3.2, 4.6]) add(cyl(0.28, 0.28, 24, 18), M(0, 3.7, z, 0, 0, Math.PI / 2), m.metal, true, false);

  // ---- cubicle pods and desks ----------------------------------------------------------------
  const deskSpots = [];
  for (const [px, pz] of [[-4.2, 0.8], [4.2, 0.8]]) {
    for (const side of [1, -1]) for (const dx of [-1, 1]) deskSpots.push({ x: px + dx * 0.84, z: pz + side * 0.43, yaw: side === 1 ? 0 : Math.PI });
    const P = at(px, 0, pz, 0);
    P(rbox(3.4, 1.18, 0.07, 0.02), m.fabric, 0, 0.62, 0);
    P(rbox(3.48, 0.05, 0.11, 0.02), m.frame, 0, 1.23, 0);
    for (const ex of [-1.72, 1.72]) {
      P(rbox(0.07, 1.18, 1.7, 0.02), m.fabricAlt, ex, 0.62, 0);
      P(rbox(0.11, 0.05, 1.78, 0.02), m.frame, ex, 1.23, 0);
    }
    box(px, 0.62, pz, 1.72, 0.62, 0.05);
    box(px - 1.72, 0.62, pz, 0.05, 0.62, 0.86);
    box(px + 1.72, 0.62, pz, 0.05, 0.62, 0.86);
  }
  const notes = (lang === 'es'
    ? ['¡llamá a mamá!', 'clave: 1234', 'NO FARTS', 'sonreí :)', 'cuota!!', 'el jefe mira', 'comprar porotos', 'ESCUCHAR']
    : ['call mom!', 'password: 1234', 'no farts', 'smile :)', 'quota!!', 'boss is watching', 'buy beans', 'LISTEN'])
    .map((t, i) => new THREE.MeshStandardMaterial({ map: TX.postIt(t, ['#ffd84d', '#ff9fb0', '#9fe8c4', '#ffd84d'][i % 4]), roughness: 0.8, side: THREE.DoubleSide }));
  const noteGeo = new THREE.PlaneGeometry(0.12, 0.12);
  const screenGeo = new THREE.PlaneGeometry(SCREEN.planeW, SCREEN.planeH);
  deskSpots.forEach((s, i) => {
    const P = at(s.x, 0, s.z, s.yaw);
    P(rbox(1.62, 0.05, 0.78, 0.02), m.laminate, 0, 0.735, 0.02);
    P(rbox(0.04, 0.71, 0.7, 0.01), m.metal, -0.76, 0.355, 0.02);
    P(rbox(0.04, 0.71, 0.7, 0.01), m.metal, 0.76, 0.355, 0.02);
    P(rbox(1.5, 0.3, 0.03, 0.01), m.metal, 0, 0.5, -0.33);
    P(rbox(0.4, 0.6, 0.62, 0.02), m.beige, -0.52, 0.31, 0.02);
    for (let k = 0; k < 3; k++) P(rbox(0.12, 0.02, 0.02, 0.005), m.chrome, -0.52, 0.5 - k * 0.19, 0.34);
    // CRT monitor
    P(rbox(0.5, 0.4, 0.42, 0.06, 3), m.beige, 0, 1.0, -0.17);
    P(rbox(0.28, 0.06, 0.22, 0.02), m.beige, 0, 0.79, -0.17);
    P(rbox(0.18, 0.06, 0.12, 0.02), m.beige, 0, 0.765, -0.17);
    P(rbox(0.56, 0.44, 0.06, 0.04, 3), m.beige, 0, 1.0, 0.04);
    P(rbox(0.46, 0.025, 0.16, 0.01), m.keyboard, 0, 0.775, 0.22);
    P(rbox(0.06, 0.03, 0.1, 0.02), m.beige, 0.34, 0.775, 0.22);
    P(rbox(0.22, 0.06, 0.2, 0.03), m.darkPlastic, 0.56, 0.79, -0.02, -0.12);
    P(rbox(0.2, 0.05, 0.06, 0.025), m.darkPlastic, 0.56, 0.84, -0.08);
    P(cyl(0.045, 0.04, 0.1, 18), m.mug, 0.42, 0.81, 0.28);
    P(cyl(0.039, 0.039, 0.005, 16), m.coffee, 0.42, 0.855, 0.28, 0, 0, 0, false, false);
    P(cyl(0.07, 0.08, 0.02, 18), m.darkPlastic, -0.62, 0.77, -0.24);
    P(cyl(0.012, 0.012, 0.36, 8), m.chrome, -0.62, 0.95, -0.2, 0.35);
    P(cyl(0.05, 0.1, 0.1, 18, true), m.red, -0.62, 1.12, -0.1, 0.9);
    P(sph(0.03), m.lampBulb, -0.62, 1.09, -0.06, 0, 0, 0, false, false);
    P(rbox(0.22, 0.012, 0.3, 0.004, 1), m.paper, -0.3, 0.765, 0.18, 0, 0.3);
    P(rbox(0.22, 0.012, 0.3, 0.004, 1), m.paper, -0.32, 0.778, 0.17, 0, 0.12);
    P(quad, m.poolWarm, -0.5, 0.764, -0.02, -Math.PI / 2, 0, 0, false, false, 0.9, 0.9, 1);
    P(quad, m.poolBlue, 0, 0.765, 0.18, -Math.PI / 2, 0, 0, false, false, 0.9, 0.55, 1);
    P(quad, m.poolBlue, 0, 0.012, 0.75, -Math.PI / 2, 0, 0, false, false, 1.6, 1.4, 1);
    if (i % 3 === 0) {
      P(cyl(0.05, 0.04, 0.08, 14), m.potYellow, 0.62, 0.8, 0.28);
      P(new THREE.CapsuleGeometry(0.025, 0.08, 4, 10), m.leaf, 0.62, 0.89, 0.28);
    }
    box(s.x, 0.38, s.z, 0.81, 0.38, 0.4);
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.yaw;
    root.add(g);
    const sc = TX.canvas(SCREEN.w, SCREEN.h);
    const st = TX.tex(sc);
    st.anisotropy = 4;
    // unlit: a CRT glows on its own and must not catch highlights from the room lights
    const sm = new THREE.MeshBasicMaterial({ map: st, color: new THREE.Color(1.25, 1.25, 1.25) });
    const screen = new THREE.Mesh(screenGeo, sm);
    screen.position.set(0, SCREEN.y, SCREEN.z);
    g.add(screen);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), new THREE.MeshStandardMaterial({ map: TX.nameplate(lang === 'es' ? 'LIBRE' : 'VACANT', '#5a527a'), roughness: 0.4 }));
    plate.position.set(-0.08, 0.81, 0.34);
    plate.rotation.x = -0.5;
    g.add(plate);
    const led = new THREE.Mesh(sph(0.012, 10, 8), m.ledGreen.clone());
    led.position.set(0.48, 0.83, 0.07);
    g.add(led);
    for (let k = 0; k < 2; k++) {
      const n = new THREE.Mesh(noteGeo, notes[(i * 2 + k) % notes.length]);
      n.position.set(k === 0 ? -0.31 : 0.3, k === 0 ? 1.17 : 0.86, 0.075);
      n.rotation.z = k === 0 ? 0.12 : -0.18;
      g.add(n);
    }
    const toWorld = (x, y, z) => V(x, y, z).applyAxisAngle(V(0, 1, 0), s.yaw).add(V(s.x, 0, s.z));
    const seat = toWorld(0, 0, SEAT_Z);
    const hw = SCREEN.planeW / 2, hh = SCREEN.planeH / 2;
    const desk = {
      index: i,
      pos: V(s.x, 0, s.z),
      yaw: s.yaw,
      seat,
      facing: s.yaw + Math.PI,
      chairSpawn: seat.clone(),
      screenCanvas: sc,
      screenTex: st,
      screenMat: sm,
      screen,
      nameplate: plate,
      led,
      owner: null,
      group: g,
      monitorWorld: toWorld(0, SCREEN.y, 0.1),
      screenCenter: toWorld(0, SCREEN.y, SCREEN.z),
      screenNormal: V(Math.sin(s.yaw), 0, Math.cos(s.yaw)),
      screenCorners: [toWorld(-hw, SCREEN.y + hh, SCREEN.z), toWorld(hw, SCREEN.y + hh, SCREEN.z), toWorld(hw, SCREEN.y - hh, SCREEN.z), toWorld(-hw, SCREEN.y - hh, SCREEN.z)],
      ringing: null,
      lastDraw: '',
    };
    desks.push(desk);
    interactables.push({ kind: 'desk', pos: desk.seat, radius: TUNE.sitRadius, ref: desk });
  });

  // ---- bathroom: stalls, urinals, sinks ----------------------------------------------------
  const stallX = [-14.2, -12.9, -11.6];
  for (const x of [-14.85, -13.55, -12.25, -10.95]) {
    add(rbox(0.05, 1.85, 1.5, 0.015), M(x, 1.08, -9.2), m.frame);
    box(x, 1.08, -9.2, 0.03, 0.93, 0.75);
  }
  add(rbox(3.95, 0.06, 0.06, 0.02), M(-12.9, 2.02, -8.45), m.trim);
  stallX.forEach((x, i) => {
    const P = at(x, 0, -9.6, 0);
    P(rbox(0.42, 0.42, 0.18, 0.08, 3), m.porcelain, 0, 0.62, -0.2);
    P(cyl(0.2, 0.15, 0.36, 24), m.porcelain, 0, 0.2, 0.05);
    P(new THREE.TorusGeometry(0.17, 0.035, 10, 24), m.porcelain, 0, 0.4, 0.05, Math.PI / 2);
    P(rbox(0.08, 0.03, 0.03, 0.01), m.chrome, 0.15, 0.78, -0.12);
    P(cyl(0.05, 0.05, 0.12, 14), m.paper, 0.45, 0.6, 0.2, 0, 0, Math.PI / 2);
    const pivot = new THREE.Group();
    pivot.position.set(x - 0.62, 0.15, -8.45);
    root.add(pivot);
    const door = new THREE.Mesh(rbox(1.2, 1.8, 0.04, 0.015), m.frame);
    door.position.set(0.6, 0.92, 0);
    door.castShadow = true;
    door.receiveShadow = true;
    pivot.add(door);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), m.ledGreen.clone());
    sign.position.set(1, 1.15, 0.03);
    pivot.add(sign);
    const t = { index: i, pos: V(x, 0, -9.35), facing: 0, doorPivot: pivot, sign, open: 1, targetOpen: 1, occupant: null, entry: V(x, 0, -7.7) };
    pivot.rotation.y = -1.6;
    toilets.push(t);
    interactables.push({ kind: 'toilet', pos: V(x, 0, -8), radius: 0.85, ref: t });
  });
  updaters.push((t, dt) => {
    for (const s of toilets) {
      s.open += (s.targetOpen - s.open) * Math.min(1, dt * 6);
      s.doorPivot.rotation.y = -1.6 * s.open;
      s.sign.material.emissive.set(s.occupant ? '#ff4d5e' : '#46e3a0');
    }
  });
  // urinals on the bathroom's east wall (facing west)
  for (const [i, z] of [-7.2, -6.1].entries()) {
    const P = at(-9.12, 0, z, -Math.PI / 2);
    P(rbox(0.42, 0.62, 0.3, 0.12, 3), m.porcelain, 0, 0.82, 0.12);
    P(cyl(0.012, 0.012, 0.3, 8), m.chrome, 0, 1.28, 0.05);
    P(rbox(0.06, 0.06, 0.06, 0.02), m.chrome, 0, 1.15, 0.08);
    const u = { index: i, pos: V(-9.62, 0, z), facing: Math.PI / 2, target: V(-9.25, 0.75, z), occupant: null };
    urinals.push(u);
    interactables.push({ kind: 'urinal', pos: u.pos, radius: 0.7, ref: u });
  }
  add(rbox(0.6, 0.1, 3.2, 0.03), M(-14.55, 0.85, -5.4), m.porcelain);
  box(-14.55, 0.45, -5.4, 0.32, 0.45, 1.6);
  for (const z of [-6.3, -4.5]) {
    add(cyl(0.2, 0.14, 0.12, 20), M(-14.5, 0.86, z), m.porcelain);
    add(cyl(0.015, 0.015, 0.2, 8), M(-14.75, 1, z), m.chrome);
    add(rbox(0.16, 0.02, 0.03, 0.01), M(-14.68, 1.1, z), m.chrome);
  }
  add(rbox(0.03, 0.9, 3, 0.01), M(-14.86, 1.65, -5.4), m.mirror, false, false);
  add(rbox(0.06, 1, 3.1, 0.02), M(-14.9, 1.65, -5.4), m.trim, false, false);
  add(rbox(0.28, 0.24, 0.2, 0.06, 3), M(-14.75, 1.3, -2.4), m.chrome);

  // ---- boss office -------------------------------------------------------------------------
  {
    const P = at(12.8, 0, -5.4, -Math.PI / 2);
    P(rbox(2.2, 0.08, 1, 0.03), m.wood, 0, 0.78, 0);
    P(rbox(2.1, 0.7, 0.06, 0.02), m.wood, 0, 0.4, -0.42);
    P(rbox(0.08, 0.74, 0.9, 0.02), m.wood, -1, 0.37, 0);
    P(rbox(0.08, 0.74, 0.9, 0.02), m.wood, 1, 0.37, 0);
    P(rbox(0.5, 0.35, 0.05, 0.03), m.darkPlastic, 0.2, 1, -0.25);
    P(cyl(0.06, 0.055, 0.12, 18), m.gold, -0.6, 0.88, 0.1);
    P(rbox(0.3, 0.02, 0.1, 0.01), m.gold, 0.7, 0.83, 0.32);
    P(rbox(0.75, 0.15, 0.7, 0.06), m.leather, 0, 0.55, -0.9);
    P(rbox(0.75, 1, 0.16, 0.08), m.leather, 0, 1.05, -1.22);
    P(cyl(0.04, 0.04, 0.4, 10), m.chrome, 0, 0.28, -0.9);
    box(12.8, 0.4, -5.4, 0.5, 0.4, 1.1);
    add(rbox(0.4, 2.2, 1.8, 0.02), M(14.75, 1.1, -8.4), m.wood);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
      const bm = [m.red, m.yellow, m.beige, m.fabric][(r + k) % 4];
      add(rbox(0.22, 0.32, 0.16, 0.01), M(14.62, 0.4 + r * 0.5, -9.1 + k * 0.24, 0, 0, k % 3 === 0 ? 0.12 : 0), bm);
    }
    box(14.75, 1.1, -8.4, 0.2, 1.1, 0.9);
    add(cyl(0.12, 0.08, 0.25, 16), M(14.62, 2.35, -8), m.gold);
    add(sph(0.1), M(14.62, 2.55, -8), m.gold);
    add(rbox(0.8, 0.01, 2.6, 0.005, 1), M(11, 0.012, -8.4), m.leaf, false, true);
    add(sph(0.022, 12, 10), M(11.1, 0.035, -7.6), m.porcelain);
  }

  // ---- plants (they appreciate being watered) ----------------------------------------------
  const plantAt = (x, z, pot) => {
    add(cyl(0.26, 0.2, 0.5, 20), M(x, 0.25, z), pot);
    for (let k = 0; k < 6; k++) add(sph(0.26, 14, 10), M(x + Math.sin(k * 2.3) * 0.2, 0.85 + (k % 3) * 0.24, z + Math.cos(k * 2.3) * 0.2), k % 2 ? m.leaf : m.leafDark);
    box(x, 0.5, z, 0.3, 0.5, 0.3);
    const p = { pos: V(x, 0, z), watered: 0 };
    plants.push(p);
    interactables.push({ kind: 'plant', pos: V(x, 0, z), radius: 1.0, ref: p });
  };
  plantAt(9.7, -9.4, m.potRed);
  plantAt(-8.4, 9.3, m.potYellow);
  plantAt(8.3, -9.3, m.potRed);
  plantAt(-8.3, -0.3, m.potYellow);
  plantAt(14.2, 9.2, m.potYellow);

  // ---- break area ------------------------------------------------------------------------------
  add(rbox(0.42, 1, 0.42, 0.05), M(-14.45, 0.5, 2.6), m.beige);
  add(cyl(0.17, 0.17, 0.42, 22), M(-14.45, 1.25, 2.6), m.water, false, false);
  add(rbox(0.06, 0.05, 0.05, 0.01), M(-14.2, 0.85, 2.55), m.red);
  add(rbox(0.06, 0.05, 0.05, 0.01), M(-14.2, 0.85, 2.68), m.potYellow);
  box(-14.45, 0.7, 2.6, 0.22, 0.7, 0.22);
  add(rbox(0.65, 0.9, 1.6, 0.03), M(-14.6, 0.45, 4.7), m.laminate);
  add(rbox(0.4, 0.5, 0.36, 0.04), M(-14.65, 1.15, 4.4), m.darkPlastic);
  add(rbox(0.06, 0.04, 0.12, 0.01), M(-14.44, 1.3, 4.4), m.ledRed, false, false);
  add(cyl(0.045, 0.04, 0.1, 16), M(-14.5, 0.95, 4.42), m.mug);
  add(cyl(0.11, 0.11, 0.3, 18), M(-14.6, 1.05, 5), m.chrome);
  box(-14.6, 0.45, 4.7, 0.33, 0.45, 0.8);
  add(rbox(0.85, 1.95, 0.8, 0.04), M(-14.5, 0.975, 7.1), m.red);
  add(rbox(0.04, 1.3, 0.6, 0.02), M(-14.06, 1.15, 7), m.vendGlow, false, false);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) add(cyl(0.045, 0.045, 0.14, 12), M(-14.15, 1.6 - r * 0.3, 6.82 + k * 0.18, 0, 0, Math.PI / 2), [m.potYellow, m.leaf, m.red][k], false, false);
  box(-14.5, 0.975, 7.1, 0.43, 0.975, 0.4);
  add(rbox(2.2, 0.42, 0.85, 0.12, 3), M(-11.4, 0.25, 9.3), m.couch);
  add(rbox(2.2, 0.75, 0.25, 0.12, 3), M(-11.4, 0.6, 9.7), m.couch);
  add(rbox(0.25, 0.6, 0.85, 0.1, 3), M(-12.55, 0.4, 9.3), m.couch);
  add(rbox(0.25, 0.6, 0.85, 0.1, 3), M(-10.25, 0.4, 9.3), m.couch);
  box(-11.4, 0.4, 9.4, 1.2, 0.4, 0.5);
  add(rbox(1, 0.05, 0.55, 0.02), M(-11.4, 0.42, 8.1), m.wood);
  add(cyl(0.03, 0.03, 0.4, 8), M(-11.8, 0.2, 8.1), m.chrome);
  add(cyl(0.03, 0.03, 0.4, 8), M(-11, 0.2, 8.1), m.chrome);
  box(-11.4, 0.22, 8.1, 0.5, 0.22, 0.28);
  add(rbox(2.4, 3, 0.16, 0.02), M(11, 1.5, 9.9), m.trim);
  add(rbox(1, 2.6, 0.05, 0.01), M(10.49, 1.32, 9.8), m.chrome);
  add(rbox(1, 2.6, 0.05, 0.01), M(11.51, 1.32, 9.8), m.chrome);
  add(rbox(0.5, 0.18, 0.04, 0.02), M(11, 2.85, 9.78), m.ledRed, false, false);
  add(rbox(2.6, 1.3, 0.05, 0.02), M(-4, 1.65, 9.86, 0, Math.PI, 0), m.whiteboard, false, true);
  add(rbox(2.7, 1.4, 0.04, 0.02), M(-4, 1.65, 9.9), m.chrome, false, false);
  add(rbox(0.9, 0.7, 0.6, 0.04), M(6, 0.35, 9.4), m.beige);
  add(rbox(0.7, 0.18, 0.5, 0.04), M(6, 0.79, 9.4), m.beige);
  add(rbox(0.4, 0.01, 0.3, 0.005), M(6, 0.71, 9.05), m.paper);
  box(6, 0.45, 9.4, 0.45, 0.45, 0.3);
  for (const x of [2.4, 3, 3.6]) {
    add(rbox(0.56, 1.3, 0.6, 0.02), M(x, 0.65, 9.55), m.metal);
    for (let k = 0; k < 4; k++) add(rbox(0.16, 0.025, 0.03, 0.01), M(x, 1.15 - k * 0.3, 9.24), m.chrome);
  }
  box(3, 0.65, 9.55, 0.9, 0.65, 0.3);
  add(quad, m.poolPink, M(0, 0.013, -8.6, -Math.PI / 2, 0, 0, 8, 3.5, 1), false, false);
  add(quad, m.poolBlue, M(-13.6, 0.013, 7.1, -Math.PI / 2, 0, 0, 2.6, 2.6, 1), false, false);
  add(quad, m.poolWarm, M(12.8, 0.014, -5.4, -Math.PI / 2, 0, 0, 3.5, 3.5, 1), false, false);

  // ---- wall clock --------------------------------------------------------------------------------
  const clock = new THREE.Group();
  clock.position.set(6.2, 2.75, 9.86);
  clock.rotation.y = Math.PI;
  root.add(clock);
  const face = TX.canvas(256, 256);
  {
    const g = face.getContext('2d');
    g.fillStyle = '#f6f1e3';
    g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1433';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 30px ${TX.FONT.body}`;
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillText(String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); }
    g.font = `14px ${TX.FONT.mono}`;
    g.fillText('NIGHT SHIFT', 128, 170);
  }
  clock.add(new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshStandardMaterial({ map: TX.tex(face), roughness: 0.3 })));
  clock.add(new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 10, 40), m.trim));
  const handMat = new THREE.MeshStandardMaterial({ color: '#1a1433' });
  const hourH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.01), handMat);
  hourH.geometry.translate(0, 0.1, 0); hourH.position.z = 0.01;
  const minH = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.01), handMat);
  minH.geometry.translate(0, 0.15, 0); minH.position.z = 0.02;
  const secH = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.34, 0.01), new THREE.MeshStandardMaterial({ color: '#ff4d5e' }));
  secH.geometry.translate(0, 0.14, 0); secH.position.z = 0.03;
  clock.add(hourH, minH, secH);
  const setClock = (h, mi, se = 0) => {
    hourH.rotation.z = -((h % 12) + mi / 60) / 12 * Math.PI * 2;
    minH.rotation.z = -(mi + se / 60) / 60 * Math.PI * 2;
    secH.rotation.z = -(se / 60) * Math.PI * 2;
  };
  setClock(23, 0);

  // ---- quota board (two-sided, hanging) --------------------------------------------------------
  const boardCanvas = TX.canvas(1024, 256);
  const boardTex = TX.tex(boardCanvas);
  const boardMat = new THREE.MeshBasicMaterial({ map: boardTex });
  boardMat.color.setScalar(1.15);
  const board = new THREE.Group();
  board.position.set(0, 3.1, 0.8);
  root.add(board);
  board.add(new THREE.Mesh(rbox(3, 0.82, 0.16, 0.04), m.trim));
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.86, 0.7), boardMat);
    p.position.z = 0.085 * s;
    if (s < 0) p.rotation.y = Math.PI;
    board.add(p);
  }
  for (const x of [-1.2, 1.2]) { const r = new THREE.Mesh(cyl(0.01, 0.01, 0.75, 6), m.chrome); r.position.set(x, 0.78, 0); board.add(r); }

  // ---- lights -------------------------------------------------------------------------------------
  const lights = new THREE.Group();
  root.add(lights);
  lights.add(new THREE.HemisphereLight('#4b52c9', '#2b1a2c', 0.22));
  const sun = new THREE.DirectionalLight('#dbe5ff', 1);
  sun.position.set(4, 14, 6);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 13, bottom: -13, near: 2, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  lights.add(sun, sun.target);
  const moon = new THREE.DirectionalLight('#7d86ff', 0.55);
  moon.position.set(-3, 6, -20);
  moon.target.position.set(0, 0, 0);
  lights.add(moon, moon.target);
  for (const x of [-4.2, 4.2]) {
    const ra = new THREE.RectAreaLight('#e8f0ff', 3.6, 3.2, 3);
    ra.position.set(x, 4.1, 0.8);
    ra.lookAt(x, 0, 0.8);
    lights.add(ra);
  }
  const point = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 2); l.position.set(x, y, z); lights.add(l); return l; };
  const neonL = point('#ff4d5e', 9, 9, 0, 3.2, -8.8);
  const bathL = point('#c9fff4', 7, 10, -12, 3.5, -5.5);
  point('#ffb06b', 9, 10, -11.5, 2.8, 5.5);
  point('#ffcf8a', 10, 9, 12, 2.8, -5);
  point('#8fa7ff', 4, 8, 8, 2.6, 7);
  updaters.push((t) => { bathL.intensity = 7 * (Math.sin(t * 50) > 0.97 ? 0.25 : 1); neonL.intensity = 9 * neonMat.color.r / 3; });
  const monitorLights = [];
  for (let i = 0; i < 4; i++) monitorLights.push(point('#8fa7ff', 1.5, 3.2, 0, -10, 0));

  // ---- weather: rain + distant lightning -----------------------------------------------------
  // Kept subtle on purpose: a soft glow outside the windows, never a full-frame
  // white flash. It is rare and gentle so it reads as a storm, not a strobe.
  const weather = { rain: 1, flash: 0, next: 30 + Math.random() * 40, onThunder: null };
  updaters.push((t, dt) => {
    rainMat.uniforms.uTime.value = t;
    rainMat.uniforms.uRain.value = weather.rain;
    weather.next -= dt;
    if (weather.rain > 0.3 && weather.next <= 0) {
      weather.next = 35 + Math.random() * 55;
      weather.flash = 0.7;
      weather.pulses = Math.random() < 0.4 ? 2 : 1;
      if (weather.onThunder) weather.onThunder(0.5 + Math.random() * 0.35, 0.6 + Math.random() * 1.8);
    }
    if (weather.flash > 0) {
      weather.flash = Math.max(0, weather.flash - dt * 2.4);
      if (weather.flash < 0.25 && weather.pulses > 1) { weather.flash = 0.55; weather.pulses--; }
    }
    const f = weather.flash;
    rainMat.uniforms.uFlash.value = f * 0.6;
    moon.intensity = 0.55 + f * 1.4;
    skyMat.color.setScalar(1.1 + f * 0.5);
  });

  const meshes = B.finalize();

  // pool of desk-monitor lights follows the screens closest to the camera
  function update(t, dt, camera) {
    for (const u of updaters) u(t, dt);
    if (camera) {
      const near = desks.map((d) => ({ d, k: d.monitorWorld.distanceToSquared(camera.position) })).sort((a, b) => a.k - b.k);
      monitorLights.forEach((l, i) => {
        const d = near[i] && near[i].d;
        if (d) l.position.copy(d.monitorWorld).add(V(Math.sin(d.yaw) * 0.35, 0, Math.cos(d.yaw) * 0.35));
      });
    }
  }

  // interaction spots near the breakroom
  interactables.push({ kind: 'water', pos: V(-13.8, 0, 2.6), radius: 1.1 });
  interactables.push({ kind: 'coffee', pos: V(-13.8, 0, 4.6), radius: 1.1 });
  interactables.push({ kind: 'beans', pos: V(-13.6, 0, 7.1), radius: 1.2 });
  interactables.push({ kind: 'couch', pos: V(-11.4, 0, 8.7), radius: 1.0 });
  const spawnPoints = [];
  for (let i = 0; i < 8; i++) spawnPoints.push(V(8.6 + (i % 4) * 0.9, 0, 7.6 + Math.floor(i / 4) * 0.9));
  const bossHome = V(12, 0, -4.2);
  const bossWaypoints = [V(0, 0, -2.4), V(-8, 0, -2.6), V(-8, 0, 4.4), V(0, 0, 4.3), V(8, 0, 4.4), V(8, 0, -2.6), V(10.2, 0, -2.7), bossHome];

  return {
    root, meshes, colliders, interactables, desks, toilets, urinals, plants, spawnPoints, bossHome, bossWaypoints,
    quotaBoard: { canvas: boardCanvas, tex: boardTex }, setClock, breakWindows, repairWindows, update, materials: m, weather,
    bounds: { minX: -14.8, maxX: 14.8, minZ: -9.8, maxZ: 9.8 },
  };
}
