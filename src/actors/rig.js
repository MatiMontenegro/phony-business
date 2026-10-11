// A character: skinned sculpted body + head on the shared skeleton, with eyes,
// lids, brows, teeth, hair, hands, shoes, clothing details and accessories.
// Bones are flat children of the root (character space), the jaw hangs from
// the head. The animator, ragdoll and portraits all drive `rig.parts`.
import * as THREE from 'three';
import { DIM, BONES, POSE_PARTS, bindMatrices } from './skeleton.js';
import * as A from './avatar.js';
import * as M from './materials.js';
import { raymarch } from './sdf.js';

// ---- palettes ---------------------------------------------------------------------
// dark back-face shell pushed out along the normals: a cheap cartoon outline
const _outlineMats = new Map();
const _RED = new THREE.Color('#ff2a2a');
function outlineMaterial(w) {
  if (_outlineMats.has(w)) return _outlineMats.get(w);
  const m = new THREE.MeshBasicMaterial({ color: '#1a1030', side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  transformed += normalize(objectNormal) * ' + w.toFixed(4) + ';');
  };
  m.customProgramCacheKey = () => 'outline' + w;
  _outlineMats.set(w, m);
  return m;
}

export const SKIN_TONES = ['#f6d3b8', '#eec0a0', '#e0a77e', '#c98b62', '#a86d48', '#6b3f28', '#ff8a3d', '#ffb347', '#ff7eb3', '#a77bff', '#5aa0ff', '#3fc7b0', '#7bd36a', '#ffd84d'];
// vivid cartoon tones used for random looks most of the time
export const TOON_SKINS = ['#ff8a3d', '#ffb347', '#ff7eb3', '#a77bff', '#5aa0ff', '#3fc7b0', '#7bd36a', '#ffd84d'];
export const HAIR_COLORS = ['#1c1410', '#3b2416', '#5a3a22', '#8a5a32', '#c48a4a', '#e2c27a', '#a33a1e', '#d8d4e2', '#2e2a3a'];
export const EYE_COLORS = ['#4a2e1a', '#6b4423', '#3f6b8a', '#4f7a4a', '#7a7a6a', '#2a1a10'];
export const SHIRT_COLORS = ['#ff4d5e', '#ffd84d', '#46e3a0', '#8fa7ff', '#ff9f6b', '#c78bff', '#4dd6ff', '#f6f1e3', '#2c3a5a', '#8b1e2e'];
export const PANTS_COLORS = ['#2b2550', '#1f2a44', '#3a3a40', '#4a3a2a', '#2a3a2a', '#1a1a22', '#5a4a3a'];
export const SHIRT_STYLES = ['buttonup', 'polo', 'tee', 'hoodie', 'sweater', 'cardigan', 'suit'];
export const HAT_STYLES = ['none', 'cap', 'beanie', 'propeller', 'crown', 'cowboy', 'party'];
export const BUILD_STYLES = ['slim', 'average', 'broad', 'heavy'];

const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];

export function randomLook(r = Math.random) {
  const fem = r() < 0.45 ? 1 : 0;
  const hairF = ['bob', 'long', 'bun', 'ponytail', 'curly', 'afro', 'sidepart'];
  const hairM = ['crop', 'quiff', 'sidepart', 'buzz', 'curly', 'afro', 'balding', 'slick', 'mohawk'];
  return {
    build: pick(BUILD_STYLES, r),
    fem,
    skin: r() < 0.7 ? pick(TOON_SKINS, r) : pick(SKIN_TONES, r),
    face: { preset: Math.floor(r() * A.FACES.length), stubble: !fem && r() < 0.3 },
    eyes: pick(EYE_COLORS, r),
    hair: pick(fem ? hairF : hairM, r),
    hairColor: pick(HAIR_COLORS.slice(0, 8), r),
    beard: !fem && r() < 0.18 ? 'full' : null,
    shirt: { style: pick(SHIRT_STYLES, r), color: pick(SHIRT_COLORS, r) },
    pants: { color: pick(PANTS_COLORS, r), style: r() < 0.5 ? 'jeans' : 'slacks' },
    shoes: { style: r() < 0.35 ? 'dress' : 'sneaker', color: r() < 0.5 ? '#f6f1e3' : pick(['#1a1433', '#5a3a22', '#ff4d5e', '#8fa7ff'], r) },
    hat: r() < 0.3 ? pick(HAT_STYLES.slice(1), r) : 'none',
    glasses: r() < 0.2 ? pick(['round', 'square'], r) : null,
    headset: true,
  };
}

// Accepts old profiles ({skin, shirt:'#hex', hat}) and fills every field.
export function normalizeLook(look = {}) {
  const shirt = typeof look.shirt === 'string' ? { style: 'buttonup', color: look.shirt } : { style: 'buttonup', color: '#8fa7ff', ...(look.shirt || {}) };
  const pants = typeof look.pants === 'string' ? { color: look.pants, style: 'slacks' } : { color: '#2b2550', style: 'slacks', ...(look.pants || {}) };
  const shoes = typeof look.shoes === 'string' ? { style: 'sneaker', color: look.shoes } : { style: 'sneaker', color: '#f6f1e3', ...(look.shoes || {}) };
  const extras = look.extras || [];
  const out = {
    build: look.build || 'average',
    fem: look.fem || 0,
    scale: look.scale || 1,
    skin: look.skin || SKIN_TONES[1],
    face: { preset: 0, type: 'human', stubble: false, ...(look.face || {}) },
    eyes: look.eyes || EYE_COLORS[0],
    pupil: look.pupil || 'round',
    hair: look.hair === undefined ? (look.hat === 'tuft' ? 'curly' : 'crop') : look.hair,
    hairColor: look.hairColor || HAIR_COLORS[1],
    beard: look.beard || null,
    mustache: !!look.mustache || extras.includes('mustache'),
    shirt,
    pants,
    shoes,
    tie: look.tie === undefined ? null : look.tie,
    hat: look.hat && look.hat !== 'tuft' ? look.hat : 'none',
    glasses: look.glasses || (extras.includes('glasses') ? 'round' : extras.includes('sunglasses') ? 'sun' : null),
    headset: look.headset !== false,
    badge: look.badge || null,
    badgeColor: look.badgeColor || shirt.color,
    extras,
    ghost: extras.includes('ghostly'),
  };
  if (extras.includes('robot')) out.face.type = 'robot';
  if (extras.includes('antennae')) out.face.type = 'alien';
  if (extras.includes('catEars')) out.face.type = 'cat';
  if (extras.includes('beard') && !out.beard) out.beard = 'full';
  return out;
}

// ---- compact look codec (network presence) ---------------------------------------------
// One short string per player; everything is validated on decode because it
// arrives from other people's browsers.
const HEX = /^[0-9a-f]{6}$/i;
const BUILD_CODE = { s: 'slim', a: 'average', b: 'broad', h: 'heavy' };
const HATS = ['none', 'cap', 'beanie', 'propeller', 'crown', 'cowboy', 'party'];
const GLASSES = ['', 'round', 'square', 'sun'];

export function encodeLook(look) {
  const n = normalizeLook(look);
  const h = (c) => String(c || '').replace('#', '').slice(0, 6);
  return [
    (n.build || 'average')[0], n.fem ? 1 : 0, h(n.skin), (n.face.preset | 0) % A.FACES.length, n.face.stubble ? 1 : 0, h(n.eyes),
    A.HAIR_STYLES.includes(n.hair) ? n.hair : 'crop', h(n.hairColor), n.beard ? 1 : 0,
    SHIRT_STYLES.includes(n.shirt.style) ? n.shirt.style : 'buttonup', h(n.shirt.color),
    h(n.pants.color), n.pants.style === 'jeans' ? 1 : 0, n.shoes.style === 'dress' ? 1 : 0, h(n.shoes.color),
    n.tie ? h(n.tie) : '', HATS.includes(n.hat) ? n.hat : 'none', GLASSES.includes(n.glasses || '') ? n.glasses || '' : '',
  ].join('|');
}

export function decodeLook(code) {
  const f = String(code || '').slice(0, 200).split('|');
  const col = (v, d) => (HEX.test(v || '') ? '#' + v.toLowerCase() : d);
  const one = (v, list, d) => (list.includes(v) ? v : d);
  const fem = f[1] === '1' ? 1 : 0;
  return {
    build: BUILD_CODE[f[0]] || 'average',
    fem,
    skin: col(f[2], SKIN_TONES[1]),
    face: { preset: Math.min(A.FACES.length - 1, Math.max(0, parseInt(f[3], 10) || 0)), stubble: f[4] === '1' && !fem },
    eyes: col(f[5], EYE_COLORS[0]),
    hair: one(f[6], A.HAIR_STYLES, 'crop'),
    hairColor: col(f[7], HAIR_COLORS[1]),
    beard: f[8] === '1' && !fem ? 'full' : null,
    shirt: { style: one(f[9], SHIRT_STYLES, 'buttonup'), color: col(f[10], SHIRT_COLORS[3]) },
    pants: { color: col(f[11], PANTS_COLORS[0]), style: f[12] === '1' ? 'jeans' : 'slacks' },
    shoes: { style: f[13] === '1' ? 'dress' : 'sneaker', color: col(f[14], '#f6f1e3') },
    tie: f[15] ? col(f[15], null) : null,
    hat: one(f[16], HATS, 'none'),
    glasses: one(f[17] || '', GLASSES, '') || null,
    headset: true,
  };
}

// ---- small geometry helpers ------------------------------------------------------------
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
function invBind(bone) { return _m.copy(bindMatrices()[bone]).invert(); }
function toBone(bone, p) { return new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(invBind(bone)); }

function mesh(geo, mat, parent, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, cast = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  m.castShadow = cast;
  m.receiveShadow = true;
  m.frustumCulled = false;
  parent.add(m);
  return m;
}

const G = new Map();
function geo(key, make) { if (!G.has(key)) G.set(key, make()); return G.get(key); }

// ring of surface points around the body at height y (bind space)
function bodyRing(body, y, n = 40, cx = 0, cz = 0.0, out = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const dx = Math.sin(a), dz = Math.cos(a);
    const o = [cx + dx * 0.45, y, cz + dz * 0.45];
    const t = raymarch(body.sdf, o, [-dx, 0, -dz], 0.6, 0.0004);
    const d = t === null ? 0.3 : 0.45 - t;
    pts.push(new THREE.Vector3(cx + dx * (d + out), y, cz + dz * (d + out)));
  }
  return pts;
}

// points draped on the shoulders around the neck at radius r (bind space)
function neckRing(body, r, n = 40, cz = -0.016, a0 = 0, a1 = Math.PI * 2, closed = true) {
  const pts = [];
  const count = closed ? n : n + 1;
  for (let i = 0; i < count; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = Math.sin(a) * r, z = cz + Math.cos(a) * r;
    const top = A.COLLAR_Y + 0.07;
    const t = raymarch(body.sdf, [x, top, z], [0, -1, 0], 0.45, 0.0004);
    pts.push(new THREE.Vector3(x, t === null ? A.COLLAR_Y : top - t, z));
  }
  return pts;
}

// closed band (rectangular section) through ring points; `h` height, `t` thickness
function bandGeometry(pts, h, t, tilt = 0) {
  const n = pts.length;
  const pos = [], idx = [];
  const c = new THREE.Vector3();
  for (const p of pts) c.add(p);
  c.multiplyScalar(1 / n);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const nrm = new THREE.Vector3(p.x - c.x, 0, p.z - c.z).normalize();
    const lo = p.clone();
    const hi = p.clone().addScaledVector(nrm, tilt).setY(p.y + h);
    const loO = lo.clone().addScaledVector(nrm, t), hiO = hi.clone().addScaledVector(nrm, t);
    pos.push(...lo.toArray(), ...hi.toArray(), ...hiO.toArray(), ...loO.toArray());
  }
  for (let i = 0; i < n; i++) {
    const a = i * 4, b = ((i + 1) % n) * 4;
    const quad = (p, q, r, s) => idx.push(p, q, r, p, r, s);
    quad(a + 3, b + 3, b + 2, a + 2); // outer
    quad(a + 1, a + 2, b + 2, b + 1); // top
    quad(a + 0, b + 0, b + 3, a + 3); // bottom
    quad(a + 0, a + 1, b + 1, b + 0); // inner
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// open strip (collar) from a point list, height `h`, leaning outward by `lean`
function stripGeometry(pts, h, lean, t = 0.004) {
  const n = pts.length;
  const pos = [], idx = [];
  const c = new THREE.Vector3();
  for (const p of pts) c.add(p);
  c.multiplyScalar(1 / n);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const nrm = new THREE.Vector3(p.x - c.x, 0, p.z - c.z).normalize();
    const lo = p.clone();
    const hi = p.clone().addScaledVector(nrm, lean).setY(p.y + h);
    pos.push(...lo.toArray(), ...hi.toArray(), ...hi.clone().addScaledVector(nrm, t).toArray(), ...lo.clone().addScaledVector(nrm, t).toArray());
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 4, b = (i + 1) * 4;
    const quad = (p, q, r, s) => idx.push(p, q, r, p, r, s);
    quad(a + 3, b + 3, b + 2, a + 2);
    quad(a + 0, a + 1, b + 1, b + 0);
    quad(a + 1, a + 2, b + 2, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---- the rig --------------------------------------------------------------------------
export class Rig {
  constructor(look = {}, { async = false, onReady = null } = {}) {
    this.look = normalizeLook(look);
    // cartoon bobble head (the boss keeps a slightly smaller one)
    this.headBase = this.look.build === 'boss' ? 1.28 : 1.48;
    this.root = new THREE.Group();
    this.root.name = 'rig';
    this.root.scale.setScalar(this.look.scale);
    this.bones = {};
    const bind = bindMatrices();
    const boneList = [];
    for (const name of BONES) {
      const b = new THREE.Bone();
      b.name = name;
      this.bones[name] = b;
      boneList.push(b);
    }
    for (const name of BONES) {
      const b = this.bones[name];
      if (name === 'jaw') {
        this.bones.head.add(b);
        b.position.set(...DIM.jawPivot);
        b.rotation.x = DIM.jawRest;
      } else {
        this.root.add(b);
        bind[name].decompose(b.position, b.quaternion, _v);
      }
    }
    this.parts = this.bones;
    const inverses = BONES.map((n) => bind[n].clone().invert());
    this.skeleton = new THREE.Skeleton(boneList, inverses);
    this.mouthOpen = 0;
    this.expression = 'neutral';
    this.blinkT = 1.5 + Math.random() * 3;
    this.blink = 0;
    this.lookDir = new THREE.Vector2();
    this.lookT = 0;
    this.speed = 0;
    this.breath = 0;
    this.micLive = false;
    this.sleeping = false;
    this.sway = { tie: 0, tieV: 0, badge: 0, badgeV: 0, lastTorso: new THREE.Vector3(), init: false };
    this.face = { browY: 0, browTilt: 0, lidU: 0, lidL: 0, mouth: 0 };
    this.meshes = [];
    this.ready = false;
    this.root.visible = false;
    if (async) {
      this.whenReady = this.buildAsync().then(() => { this.assemble(); if (onReady) onReady(this); return this; });
    } else {
      this.assemble();
      this.whenReady = Promise.resolve(this);
    }
  }

  // queue every mesh this look needs; resolves when they are all built
  buildAsync() {
    const L = this.look;
    const jobs = [
      A.bodyAsync(this.bodySpec()),
      A.headAsync(this.faceSpec()),
      A.hairAsync(this.hairStyle(), this.faceSpec()),
      A.handAsync('L'),
      A.handAsync('R'),
      A.shoeAsync(L.shoes.style === 'dress' ? 'dress' : 'sneaker', this.shoeColors()),
    ];
    if (L.beard) jobs.push(A.beardAsync(this.faceSpec(), L.beard));
    return Promise.all(jobs);
  }

  bodySpec() {
    const L = this.look;
    const st = A.SHIRTS[L.shirt.style] || A.SHIRTS.buttonup;
    return { build: L.build, fem: L.fem, sleeves: st.sleeves, vneck: st.vneck, vdepth: st.vdepth, inner: !!st.inner, legs: L.pants.legs || 'long' };
  }

  faceSpec() {
    const L = this.look;
    return L.fem ? { ...L.face, fem: L.fem } : L.face;
  }

  hairStyle() {
    const L = this.look;
    if (L.extras.includes('helmet')) return 'bald';
    if (L.extras.includes('bun')) return 'bun';
    if (L.extras.includes('slick')) return 'slick';
    return L.hair;
  }

  shoeColors() {
    const L = this.look;
    const dress = L.shoes.style === 'dress';
    return [L.shoes.color, dress ? '#1a1410' : (L.shoes.sole || '#2a2440'), dress ? L.shoes.color : '#f6f1e3'];
  }

  assemble() {
    const L = this.look;
    const ghost = L.ghost;
    const robot = L.face.type === 'robot';
    const B = this.bones;
    // body
    this.body = A.bodyGeometry(this.bodySpec());
    const skinBody = M.skinMaterial(L.skin, { ghost, metal: robot });
    const shirtKind = L.shirt.style === 'buttonup' || L.shirt.style === 'polo' || L.shirt.style === 'tee' ? L.shirt.style : L.shirt.style;
    // head skin is cloned per rig so the greed tint stays on this character only
    const headSkin = M.skinMaterial(L.skin, { head: true, ghost, metal: robot }).clone();
    this.mats = {
      skin: skinBody,
      skinHead: headSkin,
      shirt: M.fabricMaterial(L.shirt.color, shirtKind, { ghost }),
      pants: M.fabricMaterial(L.pants.color, L.pants.style === 'jeans' ? 'jeans' : 'slacks', { ghost }),
      hair: M.hairMaterial(L.hairColor),
      dark: M.plainMaterial('#1a1433', { roughness: 0.4 }),
      white: M.plainMaterial('#f6f1e3', { roughness: 0.55 }),
      gold: M.plainMaterial('#f2c14e', { metalness: 1, roughness: 0.24 }),
      chrome: M.plainMaterial('#dfe3ec', { metalness: 1, roughness: 0.18 }),
      teeth: M.plainMaterial('#f1ece0', { roughness: 0.32, clearcoat: 0.6 }),
      lens: M.plainMaterial('#050407', { roughness: 0.12, metalness: 0, clearcoat: 1, env: 0.35 }),
      micOff: M.plainMaterial('#3a3355', { roughness: 0.35 }),
      micOn: M.plainMaterial('#000000', { emissive: '#ff4d5e', emissiveIntensity: 5 }),
    };
    this.mats.inner = M.fabricMaterial(L.innerShirt || '#f6f1e3', 'buttonup', { ghost });
    this.headMat = headSkin;
    this.headMat._baseEmis = headSkin.emissiveIntensity || 0;
    const bodyMesh = new THREE.SkinnedMesh(this.body.geometry, [skinBody, this.mats.shirt, this.mats.pants, this.mats.inner].map((m, i) => M.regionMaterial(m, i)));
    this.addSkinned(bodyMesh);
    this.bodyMesh = bodyMesh;
    // head
    const head = A.headGeometry(this.faceSpec());
    this.head = head;
    this.headMesh = new THREE.SkinnedMesh(head.geometry, this.mats.skinHead);
    this.addSkinned(this.headMesh);
    this.buildFace(head.meta);
    // hair
    const hg = A.hairGeometry(this.hairStyle(), this.faceSpec());
    if (hg) this.hairMesh = mesh(hg, this.mats.hair, B.head);
    if (L.beard) {
      const bg = A.beardGeometry(this.faceSpec(), L.beard);
      if (bg) mesh(bg, this.mats.hair, B.jaw);
    }
    if (L.mustache) this.buildMustache();
    // hands
    const handMat = robot ? M.skinMaterial('#9aa3b5', { metal: true }) : skinBody;
    mesh(A.handGeometry('L'), handMat, B.fArmL);
    mesh(A.handGeometry('R'), handMat, B.fArmR);
    // shoes
    const sg = A.shoeGeometry(L.shoes.style === 'dress' ? 'dress' : 'sneaker', this.shoeColors());
    const shoeMat = M.plainMaterial('#ffffff', { vertexColors: true, roughness: L.shoes.style === 'dress' ? 0.3 : 0.6, clearcoat: L.shoes.style === 'dress' ? 0.8 : 0 });
    mesh(sg, shoeMat, B.shinL);
    mesh(sg, shoeMat, B.shinR);
    // clothes and accessories
    this.buildClothes();
    this.buildHeadwear(head.meta);
    for (const e of L.extras) this.buildExtra(e, head.meta);
    this.ready = true;
    this.root.visible = true;
  }

  addSkinned(m) {
    m.bind(this.skeleton, new THREE.Matrix4());
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    this.root.add(m);
    this.meshes.push(m);
    // cartoon ink outline (inverted hull sharing the same skeleton)
    if (false) {
      const o = new THREE.SkinnedMesh(m.geometry, outlineMaterial(m === this.headMesh ? 0.0065 : 0.0085));
      o.bind(this.skeleton, new THREE.Matrix4());
      o.frustumCulled = false;
      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = -1;
      this.root.add(o);
      this.outlines = this.outlines || [];
      this.outlines.push(o);
    }
  }

  // ---- face ------------------------------------------------------------------------
  buildFace(meta) {
    const L = this.look;
    const H = this.bones.head;
    this.eyes = [];
    this.lids = [];
    if (L.face.type === 'robot') {
      const led = M.plainMaterial('#000000', { emissive: '#7fe8ff', emissiveIntensity: 3 });
      for (const s of [1, -1]) {
        mesh(geo('robotEye', () => new THREE.CylinderGeometry(0.014, 0.014, 0.006, 24)), led, H, { x: 0.034 * s, y: 0.19, z: 0.098, rx: Math.PI / 2, cast: false });
      }
      this.robotLeds = led;
      // speaker grille mouth
      for (let i = 0; i < 4; i++) mesh(geo('grille', () => new THREE.BoxGeometry(0.1, 0.0025, 0.004)), this.mats.dark, H, { y: 0.1 + i * 0.006, z: 0.112, cast: false });
      return;
    }
    const alien = L.face.type === 'alien';
    const cat = L.face.type === 'cat';
    const r = meta.eyeRadius;
    const eyeColor = alien ? '#0b0a10' : cat ? '#9bd14a' : L.eyes;
    const pupil = alien ? 'big' : cat ? 'slit' : L.pupil;
    const eyeMat = M.eyeMaterial(eyeColor, pupil);
    const lidMat = L.ghost ? this.mats.skin : M.skinMaterial(new THREE.Color(L.skin).multiplyScalar(0.94).getStyle(), {});
    const ball = geo('eyeball' + r.toFixed(4), () => { const g = new THREE.SphereGeometry(r, 32, 24); g.rotateX(Math.PI / 2); return g; });
    const upper = geo('lidU' + r.toFixed(4), () => new THREE.SphereGeometry(r * 1.085, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.56));
    const lower = geo('lidL' + r.toFixed(4), () => { const g = new THREE.SphereGeometry(r * 1.075, 28, 8, 0, Math.PI * 2, 0, Math.PI * 0.4); g.rotateX(Math.PI); return g; });
    const lash = geo('lash' + r.toFixed(4), () => {
      const th = Math.PI * 0.56;
      const g = new THREE.TorusGeometry(r * 1.085 * Math.sin(th), r * 0.07, 4, 24, Math.PI);
      g.rotateX(Math.PI / 2);
      g.translate(0, r * 1.085 * Math.cos(th), 0);
      return g;
    });
    for (const [i, e] of [meta.eyeL, meta.eyeR].entries()) {
      const g = new THREE.Group();
      g.position.set(e[0], e[1], e[2]);
      H.add(g);
      const eyeball = mesh(ball, eyeMat, g, { cast: false });
      const lu = new THREE.Group();
      g.add(lu);
      mesh(upper, lidMat, lu, { cast: false });
      if (!alien) mesh(lash, this.mats.dark, lu, { cast: false });
      const ll = new THREE.Group();
      g.add(ll);
      mesh(lower, lidMat, ll, { cast: false });
      this.eyes.push({ group: g, ball: eyeball, side: i === 0 ? 1 : -1 });
      this.lids.push({ up: lu, low: ll });
    }
    // brows follow the forehead surface
    if (!alien) {
      const browMat = L.face.type === 'cat' ? this.mats.skinHead : M.hairMaterial(L.hairColor);
      this.brows = [];
      for (const s of [1, -1]) {
        const pts = [];
        for (let k = 0; k < 5; k++) {
          const x = s * (0.013 + k * 0.0085);
          const y = meta.browY - 0.002 + Math.sin((k / 4) * Math.PI) * 0.003 - k * 0.0009;
          const t = raymarch(this.head.sdfLocal, [x, y, 0.2], [0, 0, -1], 0.3, 0.0003);
          const z = t === null ? 0.09 : 0.2 - t;
          pts.push(new THREE.Vector3(x, y, z + 0.0018));
        }
        const pivot = pts[0].clone();
        const curve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone().sub(pivot)));
        const tg = new THREE.TubeGeometry(curve, 12, cat ? 0.001 : 0.0016 * (L.fem ? 0.8 : 1), 6, false);
        const grp = new THREE.Group();
        grp.position.copy(pivot);
        H.add(grp);
        mesh(tg, browMat, grp, { cast: false, sy: 1.7 });
        this.brows.push({ g: grp, base: pivot.clone(), side: s });
      }
    }
    // teeth: upper on the head, lower on the jaw
    const arch = (y, zFront, w, h) => {
      const shape = [];
      for (let i = 0; i <= 10; i++) {
        const a = -1.05 + (i / 10) * 2.1;
        shape.push(new THREE.Vector3(Math.sin(a) * w, y, zFront - (1 - Math.cos(a)) * 0.011));
      }
      const curve = new THREE.CatmullRomCurve3(shape);
      const g = new THREE.TubeGeometry(curve, 16, h, 6, false);
      g.scale(1, 1.6, 0.7);
      return g;
    };
    const mw = (meta.mouthW / 0.025);
    const ut = arch(0, 0, 0.0175 * mw, 0.0026);
    mesh(ut, this.mats.teeth, H, { y: A.MOUTH_Y + 0.0042, z: 0.0965, cast: false });
    const lt = arch(0, 0, 0.0158 * mw, 0.0024);
    const jp = DIM.jawPivot;
    mesh(lt, this.mats.teeth, this.bones.jaw, { y: A.MOUTH_Y - 0.0045 - jp[1], z: 0.093 - jp[2], cast: false });
    if (cat) {
      // whiskers
      const wMat = M.plainMaterial('#f6f1e3', { roughness: 0.4 });
      for (const s of [1, -1]) {
        for (const k of [-1, 0, 1]) {
          mesh(geo('whisker', () => new THREE.CylinderGeometry(0.0007, 0.0004, 0.09, 4)), wMat, H, { x: s * 0.06, y: 0.128 + k * 0.006, z: 0.1, rz: Math.PI / 2 + k * 0.12 * s, ry: -0.25 * s, cast: false });
        }
      }
    }
  }

  buildMustache() {
    const g = A.blobGeometry('mustache', () => {
      const n = [];
      for (const s of [1, -1]) {
        n.push(A.node.cone([0.004 * s, 0.1285, 0.111], [0.024 * s, 0.123, 0.101], 0.0062, 0.0042, 0.006));
        n.push(A.node.cone([0.024 * s, 0.123, 0.101], [0.033 * s, 0.114, 0.094], 0.0042, 0.0024, 0.004));
      }
      return n;
    }, 0.0024);
    if (g) mesh(g, this.mats.hair, this.bones.head, { cast: false });
  }

  // ---- clothes -----------------------------------------------------------------------
  buildClothes() {
    const L = this.look;
    const style = L.shirt.style;
    const B = this.bones;
    const body = this.body;
    const T = bindMatrices().torso;
    const torsoY = new THREE.Vector3().setFromMatrixPosition(T).y;
    const pelvisY = new THREE.Vector3().setFromMatrixPosition(bindMatrices().pelvis).y;
    const shirtMat = this.mats.shirt;
    const trim = M.fabricMaterial(new THREE.Color(L.shirt.color).multiplyScalar(0.82).getStyle(), style === 'suit' ? 'suit' : 'tee');
    const front = (x, y, off = 0.002) => {
      const t = raymarch(body.sdf, [x, y, 0.4], [0, 0, -1], 0.6, 0.0003);
      return t === null ? null : 0.4 - t + off;
    };
    // belt (not with robes/armor or tucked hoodies)
    if (!['robe', 'armor'].includes(style)) {
      const ring = bodyRing(body, A.BELT_Y - 0.026, 56, 0, 0.0, 0.0025);
      for (const p of ring) p.y -= pelvisY;
      const belt = bandGeometry(ring, 0.032, 0.0045);
      mesh(belt, M.plainMaterial('#2a1d14', { roughness: 0.45, clearcoat: 0.4, detail: 'pebble', scale: 180, amp: 0.0002 }), B.pelvis, { cast: false });
      const z = front(0, A.BELT_Y - 0.01) ?? 0.11;
      mesh(geo('buckle', () => new THREE.BoxGeometry(0.04, 0.03, 0.006)), this.mats.chrome, B.pelvis, { y: A.BELT_Y - 0.01 - pelvisY, z: z + 0.004, cast: false });
    }
    const collarY = A.COLLAR_Y;
    const neckR = body.spec.neckR;
    if (style === 'buttonup' || style === 'polo' || style === 'suit') {
      // folded collar band standing on the shoulders, open at the front
      const open = style === 'polo' ? 0.32 : 0.4;
      const pts = neckRing(body, neckR + 0.003, 36, -0.016, open, Math.PI * 2 - open, false);
      for (const p of pts) p.y -= torsoY + 0.004;
      const collarMat = style === 'suit' ? this.mats.white : shirtMat;
      mesh(stripGeometry(pts, 0.024, 0.005, 0.0032), collarMat, B.torso, { cast: false });
      // collar points fold down over the chest
      for (const s of [1, -1]) {
        const p0 = pts[s > 0 ? 0 : pts.length - 1];
        const tri = geo('collarTip', () => {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.03, 0, 0.034, 0.0, 0.004, 0.012, -0.012, 0.012, 0, 0.03, 0.003, 0.034, 0.0, 0.007, 0.012, -0.012, 0.015], 3));
          g.setIndex([0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5]);
          g.computeVertexNormals();
          return g;
        });
        mesh(tri, collarMat, B.torso, { x: p0.x * 0.75, y: p0.y - 0.006, z: p0.z + 0.003, sx: s, ry: 0.3 * s, rx: 0.5, cast: false });
      }
    } else if (['tee', 'sweater', 'tank', 'hoodie'].includes(style)) {
      const pts = neckRing(body, neckR + 0.002, 40);
      for (const p of pts) p.y -= torsoY + 0.004;
      mesh(bandGeometry(pts, 0.011, 0.0045, 0.002), trim, B.torso, { cast: false });
    }
    // V-neck edges (plackets / knit trim) along the opening
    if ((A.SHIRTS[style] || {}).vneck) {
      const depth = body.spec.vdepth;
      for (const s of [1, -1]) {
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const y = collarY - depth + (k / 8) * (depth - 0.006);
          const x = s * (y - (collarY - depth)) * 0.55;
          const z = front(x, y, 0.0015);
          if (z !== null) pts.push(new THREE.Vector3(x, y - torsoY, z));
        }
        if (pts.length > 2) {
          const curve = new THREE.CatmullRomCurve3(pts);
          const g = new THREE.TubeGeometry(curve, 16, 0.0042, 5, false);
          g.scale(1, 1, 0.55);
          mesh(g, style === 'cardigan' || style === 'sweater' ? trim : shirtMat, B.torso, { cast: false });
        }
      }
    }
    // placket buttons
    const buttons = style === 'buttonup' ? [0.06, 0.14, 0.22, 0.3] : style === 'polo' ? [0.05, 0.085] : style === 'cardigan' ? [0.15, 0.22, 0.29] : style === 'suit' ? [0.3, 0.36] : [];
    const btnMat = M.plainMaterial(new THREE.Color(L.shirt.color).lerp(new THREE.Color('#ffffff'), 0.6).getStyle(), { roughness: 0.3, clearcoat: 0.7 });
    for (const dy of buttons) {
      const y = collarY - dy;
      const z = front(0, y);
      if (z === null) continue;
      mesh(geo('button', () => new THREE.CylinderGeometry(0.0048, 0.0048, 0.0022, 14)), style === 'suit' ? this.mats.dark : btnMat, B.torso, { y: y - torsoY, z: z + 0.0008, rx: Math.PI / 2, cast: false });
    }
    // breast pocket + pen
    if (style === 'buttonup') {
      const y = collarY - 0.12, x = 0.062;
      const z = front(x, y);
      if (z !== null) {
        mesh(geo('pocket', () => new THREE.BoxGeometry(0.058, 0.064, 0.0025)), shirtMat, B.torso, { x, y: y - torsoY, z: z + 0.0005, ry: 0.18, cast: false });
        mesh(geo('pen', () => new THREE.CylinderGeometry(0.0036, 0.0036, 0.06, 8)), M.plainMaterial('#2a4fd1', { roughness: 0.3, clearcoat: 0.8 }), B.torso, { x: x + 0.012, y: y + 0.03 - torsoY, z: z + 0.004, cast: false });
        mesh(geo('penClip', () => new THREE.BoxGeometry(0.002, 0.024, 0.002)), this.mats.chrome, B.torso, { x: x + 0.012, y: y + 0.034 - torsoY, z: z + 0.0085, cast: false });
      }
    }
    // suit lapels: fold back along the V opening
    if (style === 'suit') {
      const depth = body.spec.vdepth;
      const lapMat = M.fabricMaterial(new THREE.Color(L.shirt.color).multiplyScalar(0.78).getStyle(), 'suit');
      lapMat.side = THREE.DoubleSide;
      for (const s of [1, -1]) {
        const pos = [], idx = [];
        const N = 8;
        for (let k = 0; k <= N; k++) {
          const f = k / N;
          const y = collarY - depth + f * (depth + 0.008);
          const xe = s * (y - (collarY - depth)) * 0.55;
          const w = 0.012 + Math.sin(Math.min(1, f * 1.15) * Math.PI * 0.85) * 0.04;
          const z0 = front(xe, y, 0.003);
          const z1 = front(xe + s * w, y + 0.006, 0.004);
          if (z0 === null || z1 === null) continue;
          pos.push(xe, y - torsoY, z0, xe + s * w, y + 0.006 - torsoY, z1);
        }
        const n = pos.length / 6;
        for (let k = 0; k < n - 1; k++) { const a2 = k * 2; idx.push(a2, a2 + 2, a2 + 1, a2 + 1, a2 + 2, a2 + 3); }
        if (n > 1) {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          g.setIndex(idx);
          g.computeVertexNormals();
          mesh(g, lapMat, B.torso, { cast: false });
        }
      }
      // pocket square
      const zp = front(0.075, collarY - 0.17, 0.003);
      if (zp !== null) mesh(geo('square', () => new THREE.ConeGeometry(0.012, 0.022, 3)), M.fabricMaterial(L.tie || '#ff4d5e', 'suit'), B.torso, { x: 0.075, y: collarY - 0.16 - torsoY, z: zp, rz: Math.PI, cast: false });
    }
    // hoodie: hood bunched behind the neck + drawstrings
    if (style === 'hoodie') {
      const hood = A.blobGeometry('hood|' + L.build, () => {
        const n = [];
        n.push(A.node.ellipsoid([0, collarY + 0.02, -0.085], [0.12, 0.05, 0.05], 0.03));
        n.push(A.node.cone([-0.1, collarY - 0.005, -0.03], [0.1, collarY - 0.005, -0.03], 0.03, 0.03, 0.03));
        n.push(A.node.sub(((x, y, z) => (Math.hypot(x / 0.075, (z + 0.02) / 0.07) - 1) * 0.07), 0.02));
        return n;
      }, 0.006);
      if (hood) mesh(hood, shirtMat, B.torso, { y: -torsoY });
      for (const s of [1, -1]) {
        const z = front(0.03 * s, collarY - 0.06) ?? 0.12;
        mesh(geo('string', () => new THREE.CylinderGeometry(0.0022, 0.0022, 0.12, 6)), this.mats.white, B.torso, { x: 0.03 * s, y: collarY - 0.08 - torsoY, z: z + 0.004, cast: false });
      }
    }
    // cuffs / sleeve hems
    const st = A.SHIRTS[style] || A.SHIRTS.buttonup;
    for (const side of ['L', 'R']) {
      if (st.sleeves === 'rolled') this.cuffRing('fArm' + side, 0.088, 0.013, shirtMat, 0.006);
      else if (st.sleeves === 'long') this.cuffRing('fArm' + side, 0.212, 0.012, style === 'suit' ? this.mats.white : trim, 0.002);
      else if (st.sleeves === 'short') this.cuffRing('uArm' + side, 0.128, 0.01, trim, 0.002);
    }
    // tie
    if (L.tie && (style === 'buttonup' || style === 'suit')) this.buildTie(front, collarY, torsoY);
    // id badge with the agent's name
    if (L.badge) this.buildBadge(front, collarY, torsoY);
  }

  cuffRing(bone, t, h, mat, out) {
    const m = bindMatrices()[bone];
    // measure the arm radius at distance t along the bone
    let rsum = 0, n = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const o = new THREE.Vector3(0, -t, 0).addScaledVector(dir, 0.12).applyMatrix4(m);
      const d = dir.clone().negate().transformDirection(m);
      const hit = raymarch(this.body.sdf, o.toArray(), d.toArray(), 0.2, 0.0003);
      if (hit !== null) { rsum += 0.12 - hit; n++; }
    }
    const r = n ? rsum / n : 0.045;
    const g = geo(`cuff${r.toFixed(3)}|${h}|${out}`, () => {
      const pts = [];
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * (r + out * 0.5), 0, Math.sin(a) * (r + out * 0.5)));
      }
      return bandGeometry(pts, h, Math.max(0.0025, out));
    });
    mesh(g, mat, this.bones[bone], { y: -t - h * 0.5, cast: false });
  }

  buildTie(front, collarY, torsoY) {
    const L = this.look;
    const tie = new THREE.Group();
    const top = collarY - 0.032;
    const zTop = front(0, top, 0.006) ?? 0.11;
    tie.position.set(0, top - torsoY, zTop);
    this.bones.torso.add(tie);
    const mat = M.fabricMaterial(L.tie, 'suit');
    mesh(geo('knot', () => { const g = new THREE.CylinderGeometry(0.014, 0.009, 0.026, 10); return g; }), mat, tie, { y: -0.006, rx: 0.2, sz: 0.6, cast: false });
    // blade follows the chest
    const pts = [];
    const len = 0.36;
    for (let k = 0; k <= 12; k++) {
      const y = top - 0.016 - (k / 12) * len;
      const z = front(0, y, 0.006);
      pts.push([y - top, (z ?? zTop) - zTop]);
    }
    const pos = [], idx = [];
    pts.forEach(([y, z], k) => {
      const w = 0.018 + (k / 12) * 0.024;
      pos.push(-w, y, z + 0.001, w, y, z + 0.001);
    });
    const [ty, tz] = pts[pts.length - 1];
    pos.push(0, ty - 0.03, tz + 0.001);
    for (let k = 0; k < 12; k++) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const last = 24;
    idx.push(last, 26, last + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const blade = mat.clone();
    blade.side = THREE.DoubleSide;
    mesh(g, blade, tie, { cast: true });
    this.tie = tie;
  }

  buildBadge(front, collarY, torsoY) {
    const L = this.look;
    const x = -0.068, y = collarY - 0.17;
    const z = front(x, y, 0.004);
    if (z === null) return;
    const badge = new THREE.Group();
    badge.position.set(x, y - torsoY, z);
    badge.rotation.y = -0.16;
    this.bones.torso.add(badge);
    const tex = M.badgeTexture(L.badge, L.badgeColor);
    const face = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
    mesh(geo('badgeCard', () => new THREE.BoxGeometry(0.06, 0.038, 0.0016)), [this.mats.white, this.mats.white, this.mats.white, this.mats.white, face, this.mats.white], badge, { cast: false });
    mesh(geo('badgeClip', () => new THREE.BoxGeometry(0.012, 0.012, 0.003)), this.mats.chrome, badge, { y: 0.024, cast: false });
    // lanyard around the neck
    const lanyardMat = M.fabricMaterial(L.badgeColor, 'tee');
    const ring = neckRing(this.body, this.body.spec.neckR + 0.012, 24);
    const back = ring.filter((p) => p.z < -0.01).sort((a, b) => a.x - b.x).map((p) => p.setY(p.y + 0.004));
    const pts = [new THREE.Vector3(x - 0.004, y + 0.03, z + 0.001)];
    const zl = front(-0.05, collarY - 0.06, 0.005) ?? z;
    pts.push(new THREE.Vector3(-0.05, collarY - 0.06, zl));
    for (let i = 0; i < back.length; i += 2) pts.push(back[i]);
    const zr = front(0.05, collarY - 0.06, 0.005) ?? z;
    pts.push(new THREE.Vector3(0.05, collarY - 0.06, zr));
    pts.push(new THREE.Vector3(x + 0.004, y + 0.03, z + 0.001));
    for (const p of pts) p.y -= torsoY;
    const curve = new THREE.CatmullRomCurve3(pts);
    mesh(new THREE.TubeGeometry(curve, 48, 0.0022, 5, false), lanyardMat, this.bones.torso, { cast: false, sz: 1 });
    this.badge = badge;
  }

  // ---- hats, glasses, headset ------------------------------------------------------------
  hairTop(meta) {
    const lift = { afro: 0.05, curly: 0.022, quiff: 0.03, mohawk: 0.04, bun: 0.01, long: 0.018, bob: 0.019, sidepart: 0.016, crop: 0.012, buzz: 0.005, balding: 0.01, slick: 0.008, ponytail: 0.01, bald: 0 };
    const st = this.hairStyle();
    return lift[st] ?? 0.012;
  }

  buildHeadwear(meta) {
    const L = this.look;
    const H = this.bones.head;
    const cr = meta.cranium;
    const lift = this.hairTop(meta);
    const top = cr.c[1] + cr.r[1] + lift;
    const R = Math.max(cr.r[0], cr.r[2]) + lift * 0.85;
    const hatColor = new THREE.Color(L.shirt.color);
    const capMat = M.fabricMaterial(hatColor.getStyle(), 'tee');
    const knit = M.fabricMaterial(L.hat === 'beanie' ? '#ff4d5e' : '#8fa7ff', 'sweater');
    const dome = (r, frac) => new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI * frac);
    switch (L.hat) {
      case 'cap': {
        mesh(geo('capDome' + R.toFixed(3), () => dome(R + 0.006, 0.5)), capMat, H, { y: cr.c[1] + lift * 0.5 + 0.004, z: cr.c[2], sy: (cr.r[1] + lift * 0.4) / R, sz: (cr.r[2] + lift) / R });
        mesh(geo('capBrim', () => { const g = new THREE.CylinderGeometry(0.075, 0.075, 0.006, 24, 1, false, -Math.PI / 2, Math.PI); g.scale(1, 1, 0.95); return g; }), capMat, H, { y: cr.c[1] + 0.012, z: cr.c[2] + cr.r[2] + 0.008, rx: 0.16 });
        mesh(geo('capBtn', () => new THREE.SphereGeometry(0.008, 10, 8)), capMat, H, { y: top + 0.004, z: cr.c[2] });
        break;
      }
      case 'beanie':
      case 'propeller': {
        mesh(geo('beanie' + R.toFixed(3), () => dome(R + 0.004, 0.52)), knit, H, { y: cr.c[1] + 0.012, z: cr.c[2] - 0.004, sy: (cr.r[1] + lift + 0.006) / R });
        const cuff = new THREE.TorusGeometry(R + 0.003, 0.0105, 10, 32);
        mesh(cuff, M.fabricMaterial(L.hat === 'beanie' ? '#ffd84d' : '#ff4d5e', 'sweater'), H, { y: cr.c[1] + 0.012, z: cr.c[2] - 0.004, rx: Math.PI / 2 });
        if (L.hat === 'beanie') {
          mesh(geo('pompom', () => new THREE.IcosahedronGeometry(0.03, 2)), M.fabricMaterial('#ffd84d', 'hoodie'), H, { y: top + 0.03, z: cr.c[2] - 0.004 });
        } else {
          mesh(geo('propStem', () => new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8)), this.mats.dark, H, { y: top + 0.024, z: cr.c[2] });
          const prop = new THREE.Group();
          prop.position.set(0, top + 0.046, cr.c[2]);
          H.add(prop);
          mesh(geo('propBlade', () => new THREE.BoxGeometry(0.2, 0.004, 0.032)), M.plainMaterial('#ffd84d', { roughness: 0.3, clearcoat: 0.6 }), prop, { rx: 0.15 });
          mesh(geo('propBlade', () => new THREE.BoxGeometry(0.2, 0.004, 0.032)), M.plainMaterial('#46e3a0', { roughness: 0.3, clearcoat: 0.6 }), prop, { ry: Math.PI / 2, rx: 0.15 });
          this.propeller = prop;
        }
        break;
      }
      case 'crown': {
        const gold = this.mats.gold;
        mesh(geo('crownBand', () => new THREE.CylinderGeometry(0.068, 0.07, 0.045, 32, 1, true)), gold, H, { y: top - 0.006, z: cr.c[2] });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          mesh(geo('crownSpike', () => new THREE.ConeGeometry(0.014, 0.04, 8)), gold, H, { x: Math.sin(a) * 0.066, y: top + 0.035, z: cr.c[2] + Math.cos(a) * 0.066 });
          mesh(geo('gem', () => new THREE.OctahedronGeometry(0.008)), M.plainMaterial(i % 2 ? '#ff4d5e' : '#46e3a0', { roughness: 0.05, clearcoat: 1 }), H, { x: Math.sin(a) * 0.071, y: top + 0.002, z: cr.c[2] + Math.cos(a) * 0.071 });
        }
        break;
      }
      case 'cowboy': {
        const felt = M.fabricMaterial('#8a5a32', 'sweater');
        mesh(geo('cowBrim', () => { const g = new THREE.CylinderGeometry(0.17, 0.17, 0.008, 40); g.scale(1, 1, 0.82); return g; }), felt, H, { y: top - 0.02, z: cr.c[2] });
        mesh(geo('cowCrown', () => { const g = new THREE.CylinderGeometry(0.068, 0.086, 0.09, 28); return g; }), felt, H, { y: top + 0.025, z: cr.c[2] });
        mesh(geo('cowBand', () => new THREE.CylinderGeometry(0.087, 0.087, 0.016, 28, 1, true)), M.plainMaterial('#ff4d5e', { roughness: 0.6 }), H, { y: top - 0.006, z: cr.c[2] });
        break;
      }
      case 'party': {
        mesh(geo('party', () => new THREE.ConeGeometry(0.06, 0.18, 24)), M.plainMaterial('#c78bff', { roughness: 0.35, clearcoat: 0.6 }), H, { x: 0.02, y: top + 0.07, z: cr.c[2], rz: -0.22 });
        mesh(geo('pompom2', () => new THREE.IcosahedronGeometry(0.02, 2)), M.fabricMaterial('#ffd84d', 'hoodie'), H, { x: 0.04, y: top + 0.16, z: cr.c[2] });
        break;
      }
      default: break;
    }
    // glasses
    if (L.glasses) {
      const sun = L.glasses === 'sun';
      const frame = sun ? this.mats.dark : M.plainMaterial(L.glasses === 'round' ? '#c9a24a' : '#1a1433', { metalness: L.glasses === 'round' ? 1 : 0, roughness: 0.3 });
      const ez = meta.eyeL[2] + meta.eyeRadius + 0.012;
      for (const e of [meta.eyeL, meta.eyeR]) {
        if (L.glasses === 'square' || sun) {
          mesh(geo('frameSq', () => { const g = new THREE.TorusGeometry(0.02, 0.0022, 6, 4); g.rotateZ(Math.PI / 4); g.scale(1.25, 0.85, 1); return g; }), frame, H, { x: e[0], y: e[1], z: ez, cast: false });
        } else {
          mesh(geo('frameRound', () => new THREE.TorusGeometry(0.018, 0.0016, 6, 24)), frame, H, { x: e[0], y: e[1], z: ez, cast: false });
        }
        if (sun) mesh(geo('lensSq', () => { const g = new THREE.CircleGeometry(0.02, 4); g.rotateZ(Math.PI / 4); g.scale(1.22, 0.82, 1); return g; }), this.mats.lens, H, { x: e[0], y: e[1], z: ez + 0.001, cast: false });
        else mesh(geo('lensR', () => new THREE.CircleGeometry(0.0175, 24)), M.plainMaterial('#cfe6ff', { transparent: true, opacity: 0.18, roughness: 0.02, depthWrite: false }), H, { x: e[0], y: e[1], z: ez, cast: false });
      }
      mesh(geo('bridge', () => new THREE.CylinderGeometry(0.0016, 0.0016, 0.022, 6)), frame, H, { y: meta.eyeL[1] + 0.006, z: ez + 0.002, rz: Math.PI / 2, cast: false });
      for (const s of [1, -1]) {
        mesh(geo('temple', () => new THREE.BoxGeometry(0.003, 0.003, 0.1)), frame, H, { x: s * (meta.earX - 0.004), y: meta.eyeL[1] + 0.004, z: ez - 0.05, ry: -0.06 * s, cast: false });
      }
    }
    // call-center headset
    if (L.headset && !L.extras.includes('helmet')) {
      const ax = meta.earX + 0.014, by = top + 0.008 - 0.165;
      const arc = [];
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI;
        arc.push(new THREE.Vector3(Math.cos(a) * ax, 0.165 + Math.sin(a) * by, -0.008));
      }
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 32, 0.0042, 8, false), this.mats.dark, H, { sx: 1, sz: 1 });
      for (const s of [1, -1]) {
        mesh(geo('cup', () => new THREE.CylinderGeometry(0.03, 0.03, 0.018, 24)), this.mats.dark, H, { x: s * (meta.earX + 0.01), y: 0.165, z: -0.006, rz: Math.PI / 2 });
        mesh(geo('cushion', () => new THREE.TorusGeometry(0.024, 0.008, 8, 20)), M.plainMaterial('#2a2440', { roughness: 0.8 }), H, { x: s * (meta.earX + 0.002), y: 0.165, z: -0.006, ry: Math.PI / 2, cast: false });
      }
      const s = 1;
      const mx = meta.earX + 0.016;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * mx, 0.155, 0.0),
        new THREE.Vector3(s * (mx - 0.004), 0.13, 0.05),
        new THREE.Vector3(s * 0.045, 0.112, 0.098),
        new THREE.Vector3(s * 0.022, 0.108, 0.118),
      ]);
      mesh(new THREE.TubeGeometry(curve, 20, 0.0028, 6, false), this.mats.dark, H, { cast: false });
      this.micTip = mesh(geo('micTip', () => new THREE.SphereGeometry(0.008, 12, 10)), this.mats.micOff, H, { x: s * 0.02, y: 0.108, z: 0.12, sx: 1.3, cast: false });
    }
  }

  buildExtra(e, meta) {
    const L = this.look;
    const H = this.bones.head;
    const T = this.bones.torso;
    const cr = meta.cranium;
    const torsoY = new THREE.Vector3().setFromMatrixPosition(bindMatrices().torso).y;
    switch (e) {
      case 'helmet': {
        const steel = M.plainMaterial('#b9c0cf', { metalness: 0.9, roughness: 0.28, detail: 'pebble', scale: 60, amp: 0.0002 });
        const helm = A.blobGeometry('helmet', () => [
          A.node.ellipsoid([0, 0.17, 0.0], [0.108, 0.135, 0.125], 0),
          A.node.sub(((x, y, z) => (Math.hypot(x / 0.095, (y - 0.15) / 0.12, z / 0.112) - 1) * 0.095), 0.01),
          A.node.sub(((x, y, z) => Math.max(Math.abs(x) - 0.07, Math.abs(y - 0.18) - 0.006, -(z - 0.06))), 0.004),
          A.node.sub(((x, y, z) => Math.max(y - 0.07, Math.abs(x) - 0.2)), 0.01),
        ], 0.005);
        if (helm) mesh(helm, steel, H);
        mesh(geo('plume', () => new THREE.CapsuleGeometry(0.03, 0.12, 6, 12)), M.fabricMaterial('#ff4d5e', 'hoodie'), H, { y: 0.32, z: -0.05, rx: -0.9 });
        for (const ey of this.eyes || []) ey.group.visible = false;
        break;
      }
      case 'antennae': {
        for (const s of [1, -1]) {
          mesh(geo('ant', () => new THREE.CylinderGeometry(0.0035, 0.004, 0.13, 8)), M.skinMaterial(L.skin), H, { x: 0.035 * s, y: cr.c[1] + cr.r[1] + 0.05, z: cr.c[2] + 0.01, rz: -0.32 * s });
          mesh(geo('antBall', () => new THREE.SphereGeometry(0.014, 14, 10)), M.plainMaterial('#ffd84d', { emissive: '#ffd84d', emissiveIntensity: 2.2 }), H, { x: 0.057 * s, y: cr.c[1] + cr.r[1] + 0.11, z: cr.c[2] + 0.01, cast: false });
        }
        break;
      }
      case 'cape': {
        const capeMat = M.fabricMaterial('#2a0a1a', 'robe');
        capeMat.side = THREE.DoubleSide;
        const g = new THREE.CylinderGeometry(0.2, 0.36, 1.05, 32, 8, true, Math.PI * 0.6, Math.PI * 0.8);
        g.translate(0, -0.42, -0.02);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i);
          p.setZ(i, p.getZ(i) - 0.04 * Math.sin(p.getX(i) * 30) * Math.max(0, -y) * 0.6);
        }
        g.computeVertexNormals();
        mesh(g, capeMat, T, { y: DIM.shoulderY + 0.06 });
        const collar = new THREE.CylinderGeometry(0.15, 0.1, 0.16, 28, 1, true, Math.PI * 0.55, Math.PI * 0.9);
        const red = M.fabricMaterial('#8b0f2a', 'robe');
        red.side = THREE.DoubleSide;
        mesh(collar, red, T, { y: DIM.neckY + 0.04, z: -0.01, cast: false });
        break;
      }
      case 'fangs': {
        for (const s of [1, -1]) mesh(geo('fang', () => new THREE.ConeGeometry(0.0028, 0.011, 8)), this.mats.teeth, H, { x: 0.0105 * s, y: A.MOUTH_Y - 0.0005, z: 0.0995, rx: Math.PI, cast: false });
        break;
      }
      case 'eyepatch': {
        mesh(geo('patch', () => { const g = new THREE.SphereGeometry(0.019, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.4); g.rotateX(Math.PI / 2); return g; }), this.mats.dark, H, { x: meta.eyeR[0], y: meta.eyeR[1], z: meta.eyeR[2] - 0.008, cast: false });
        mesh(geo('strap', () => new THREE.TorusGeometry(0.097, 0.0022, 6, 40)), this.mats.dark, H, { y: 0.2, z: -0.012, rx: Math.PI / 2 + 0.25, cast: false });
        if (this.eyes) this.eyes[1].group.visible = false;
        break;
      }
      case 'tricorn': {
        const felt = M.fabricMaterial('#1a1424', 'sweater');
        const top = cr.c[1] + cr.r[1] + this.hairTop(meta);
        // sits down on the head: the brim at the forehead
        const brim = cr.c[1] + cr.r[1] * 0.62 + this.hairTop(meta) * 0.5;
        mesh(geo('triCrown', () => new THREE.CylinderGeometry(0.078, 0.098, 0.075, 24)), felt, H, { y: brim + 0.035, z: cr.c[2] });
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          mesh(geo('triFlap', () => new THREE.BoxGeometry(0.21, 0.07, 0.012)), felt, H, { x: Math.sin(a) * 0.095, y: brim + 0.02, z: cr.c[2] + Math.cos(a) * 0.095, ry: a, rx: -0.35 });
        }
        mesh(geo('triTrim', () => new THREE.SphereGeometry(0.012, 10, 8)), this.mats.gold, H, { y: brim + 0.03, z: cr.c[2] + 0.11, cast: false });
        void top;
        break;
      }
      case 'pearls': {
        const pearl = M.plainMaterial('#f6f1e3', { roughness: 0.15, clearcoat: 1 });
        const ring = neckRing(this.body, this.body.spec.neckR + 0.022, 30);
        for (const p of ring) mesh(geo('pearl', () => new THREE.SphereGeometry(0.0072, 10, 8)), pearl, T, { x: p.x, y: p.y - torsoY + 0.004, z: p.z, cast: false });
        break;
      }
      case 'catEars': {
        for (const s of [1, -1]) {
          mesh(geo('catEar', () => { const g = new THREE.ConeGeometry(0.036, 0.075, 4); g.scale(1, 1, 0.45); return g; }), M.skinMaterial(L.skin), H, { x: 0.058 * s, y: cr.c[1] + cr.r[1] + 0.01, z: cr.c[2] + 0.004, rz: -0.38 * s });
          mesh(geo('catEarIn', () => { const g = new THREE.ConeGeometry(0.022, 0.05, 4); g.scale(1, 1, 0.3); return g; }), M.plainMaterial('#ff9fb0', { roughness: 0.6 }), H, { x: 0.058 * s, y: cr.c[1] + cr.r[1] + 0.004, z: cr.c[2] + 0.012, rz: -0.38 * s, cast: false });
        }
        break;
      }
      case 'robotBits': {
        const metal = M.plainMaterial('#9aa3b5', { metalness: 0.85, roughness: 0.3 });
        mesh(geo('robAnt', () => new THREE.CylinderGeometry(0.004, 0.004, 0.09, 8)), metal, H, { y: 0.33, z: 0 });
        mesh(geo('robAntBall', () => new THREE.SphereGeometry(0.014, 12, 10)), M.plainMaterial('#ff4d5e', { emissive: '#ff4d5e', emissiveIntensity: 2.5 }), H, { y: 0.38, cast: false });
        for (const s of [1, -1]) mesh(geo('bolt', () => new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12)), metal, H, { x: 0.1 * s, y: 0.19, rz: Math.PI / 2 });
        break;
      }
      case 'goldChain': {
        const ring = neckRing(this.body, this.body.spec.neckR + 0.028, 36);
        const pts = ring.map((p) => {
          const fz = Math.max(0, p.z) / 0.1;
          const y = p.y - 0.035 * fz;
          const z = (raymarch(this.body.sdf, [p.x, y, 0.4], [0, 0, -1], 0.6, 0.0004) ?? 0.3);
          return new THREE.Vector3(p.x, y - torsoY + 0.004, p.z > 0.02 ? Math.max(p.z, 0.4 - z + 0.004) : p.z);
        });
        const curve = new THREE.CatmullRomCurve3(pts, true);
        mesh(new THREE.TubeGeometry(curve, 80, 0.0045, 6, true), this.mats.gold, T, { cast: false });
        break;
      }
      default: break;
    }
  }

  // ---- runtime -----------------------------------------------------------------------------
  applyPose(buf) {
    for (const n of POSE_PARTS) {
      const b = this.bones[n];
      b.position.copy(buf[n].p);
      b.quaternion.copy(buf[n].q);
      if (n === 'head') b.scale.setScalar(this.headBase || 1);
      else b.scale.set(1, 1, 1);
    }
  }

  setMicLive(on) {
    if (this.micLive === on) return;
    this.micLive = on;
    if (this.micTip) this.micTip.material = on ? this.mats.micOn : this.mats.micOff;
  }

  setExpression(e) { this.expression = e; }

  // greed + shouting: the head swells with earnings while talking, and goes
  // red when yelling (or when a rich player talks a lot). Quiet -> normal.
  setGreed(v) { this.inflateTarget = Math.max(0, Math.min(1, v || 0)); }
  setFlush(v) { this.flushTarget = Math.max(0, Math.min(1, v || 0)); }
  applyGreed(dt) {
    const k = Math.min(1, dt * 9);
    this.inflate = (this.inflate || 0) + ((this.inflateTarget || 0) - (this.inflate || 0)) * k;
    this.flush = (this.flush || 0) + ((this.flushTarget || 0) - (this.flush || 0)) * k;
    this.greed = this.inflate;
    const hb = this.bones.head;
    if (hb) hb.scale.setScalar((this.headBase || 1) * (1 + this.inflate * 0.35));
    const m = this.headMat, r = this.flush;
    if (m && m.emissive) {
      m._baseColor ||= m.color.clone();
      m.color.copy(m._baseColor).lerp(_RED, r * 0.75);
      m.emissive.setRGB(0.7 * r, 0.02 * r, 0.02 * r);
      m.emissiveIntensity = Math.max(m._baseEmis || 0, r * 0.6);
    }
  }

  breathe(b) {
    this.breath = b;
    const t = this.bones.torso;
    t.scale.set(1 + b * 0.012, 1 + b * 0.004, 1 + b * 0.016);
  }

  updateFace(dt, time) {
    const e = this.expression;
    const k = Math.min(1, dt * 14);
    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blink = Math.min(1, -this.blinkT / 0.06);
      if (this.blinkT < -0.14) { this.blinkT = 1.8 + Math.random() * 3.6; this.blink = 0; }
      else if (this.blinkT < -0.07) this.blink = Math.max(0, 1 - (-this.blinkT - 0.07) / 0.07);
    }
    // targets per expression
    let browY = 0, browTilt = 0, lidU = 0.3, lidL = 0.12, mouth = 0;
    switch (e) {
      case 'happy': browY = 0.0025; browTilt = 0.08; lidL = 0.32; mouth = 0.18; break;
      case 'angry': browY = -0.003; browTilt = -0.32; lidU = 0.32; lidL = 0.18; break;
      case 'shocked': browY = 0.006; browTilt = 0.15; lidU = -0.1; lidL = 0; mouth = 0.85; break;
      case 'strain': browY = -0.0035; browTilt = -0.22; lidU = 0.55; lidL = 0.42; break;
      case 'sad': case 'sick': browY = 0.0015; browTilt = 0.32; lidU = 0.38; lidL = 0.08; break;
      case 'relief': browY = 0.003; browTilt = 0.22; lidU = 0.62; lidL = 0.2; mouth = 0.2; break;
      case 'sleep': lidU = 1; lidL = 0.3; mouth = 0.08; break;
      default: break;
    }
    if (this.sleeping) { lidU = 1; lidL = 0.3; }
    const F = this.face;
    F.browY += (browY - F.browY) * k;
    F.browTilt += (browTilt - F.browTilt) * k;
    F.lidU += (Math.max(lidU, this.blink) - F.lidU) * Math.min(1, dt * 30);
    F.lidL += (lidL - F.lidL) * k;
    const open = Math.max(this.mouthOpen, mouth);
    F.mouth += (open - F.mouth) * Math.min(1, dt * 18);
    this.bones.jaw.rotation.x = DIM.jawRest + F.mouth * 0.32;
    // lids: rotate the caps over the eyeball
    if (this.lids) {
      for (const l of this.lids) {
        l.up.rotation.x = -0.62 + F.lidU * 0.86;
        l.low.rotation.x = 0.55 - F.lidL * 0.55;
      }
    }
    // saccades
    this.lookT -= dt;
    if (this.lookT < 0) {
      this.lookT = 0.6 + Math.random() * 2.2;
      this.lookDir.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.25);
    }
    if (this.eyes) {
      for (const ey of this.eyes) {
        ey.group.rotation.y += (this.lookDir.x - ey.group.rotation.y) * Math.min(1, dt * 20);
        ey.group.rotation.x += (-this.lookDir.y - ey.group.rotation.x) * Math.min(1, dt * 20);
      }
    }
    if (this.brows) {
      for (const b of this.brows) {
        b.g.position.set(b.base.x, b.base.y + F.browY, b.base.z);
        b.g.rotation.z = -F.browTilt * b.side;
      }
    }
    if (this.robotLeds) this.robotLeds.emissiveIntensity = 2.5 + Math.sin(time * 3) * 0.6 + (this.mouthOpen > 0.3 ? 1.5 : 0);
    if (this.propeller) this.propeller.rotation.y += dt * (6 + this.speed * 6);
  }

  // secondary motion for the tie and badge (call after the pose is applied)
  updateSway(dt, worldVel = null) {
    const s = this.sway;
    if (!this.tie && !this.badge) return;
    const accel = worldVel ? Math.min(3, Math.hypot(worldVel.x, worldVel.z)) : 0;
    const target = -accel * 0.08;
    for (const key of ['tie', 'badge']) {
      const v = key + 'V';
      s[v] += ((target - s[key]) * 40 - s[v] * 6) * dt;
      s[key] += s[v] * dt;
    }
    if (this.tie) this.tie.rotation.x = s.tie;
    if (this.badge) this.badge.rotation.x = s.badge * 0.6;
  }

  dispose() {
    this.root.removeFromParent();
  }
}

// copy one rig's pose onto another (portraits)
export function copyPose(from, to) {
  for (const n of BONES) {
    to.bones[n].position.copy(from.bones[n].position);
    to.bones[n].quaternion.copy(from.bones[n].quaternion);
  }
}
