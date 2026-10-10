// Visual test bench: a row of characters under studio light.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Rig, randomLook } from '../src/actors/rig.js';
import { defaultPose, solvePose, makePoseBuffer } from '../src/actors/skeleton.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#241c46');
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const key = new THREE.DirectionalLight('#fff1dc', 2.6);
key.position.set(2, 4, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 3; key.shadow.camera.bottom = -1;
key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
scene.add(key);
const rim = new THREE.DirectionalLight('#8fa7ff', 2.2);
rim.position.set(-3, 2.5, -3);
scene.add(rim);
scene.add(new THREE.HemisphereLight('#c7d0ff', '#40285a', 0.5));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#3a3352', roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const looks = [
  { build: 'average', skin: '#eec0a0', hair: 'quiff', hairColor: '#3b2416', shirt: { style: 'buttonup', color: '#8fa7ff' }, tie: '#1a1433', badge: 'Matias', face: { preset: 0 }, headset: true },
  { build: 'slim', fem: 1, skin: '#c98b62', hair: 'bob', hairColor: '#1c1410', shirt: { style: 'cardigan', color: '#c78bff' }, face: { preset: 4 }, glasses: 'round', headset: true, badge: 'Nuria' },
  { build: 'heavy', skin: '#8a5537', hair: 'buzz', hairColor: '#1c1410', beard: 'full', shirt: { style: 'hoodie', color: '#46e3a0' }, face: { preset: 1 }, hat: 'beanie', headset: false },
  { build: 'boss', skin: '#f0b48c', hair: 'slick', hairColor: '#2e2a3a', shirt: { style: 'suit', color: '#2a2440' }, tie: '#f2c14e', glasses: 'sun', mustache: true, extras: ['goldChain'], face: { preset: 5 }, headset: false, scale: 1.06 },
  { build: 'broad', skin: '#f6d3b8', hair: 'afro', hairColor: '#a33a1e', shirt: { style: 'tee', color: '#ff4d5e' }, pants: { color: '#1f2a44', style: 'jeans' }, face: { preset: 2, stubble: true }, headset: true },
];
const sel = q.get('only');
const list = sel ? looks.filter((_, i) => String(i) === sel) : looks;
const pose = defaultPose();
const buf = solvePose(pose, makePoseBuffer());
const rigs = [];
const t0 = performance.now();
list.forEach((look, i) => {
  const r = new Rig(look);
  r.root.position.set((i - (list.length - 1) / 2) * 0.85, 0, 0);
  r.applyPose(buf);
  r.updateFace(0.016, 0);
  scene.add(r.root);
  rigs.push(r);
});
console.log('built in', (performance.now() - t0).toFixed(0), 'ms');
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 50);
const mode = q.get('cam') || 'full';
if (mode === 'face') { cam.position.set(0, 1.62, 0.75); cam.lookAt(0, 1.6, 0); }
else if (mode === 'bust') { cam.position.set(0, 1.5, 1.6); cam.lookAt(0, 1.45, 0); }
else { cam.position.set(0, 1.2, 5.2 + list.length * 0.25); cam.lookAt(0, 0.95, 0); }
if (q.get('yaw')) for (const r of rigs) r.root.rotation.y = +q.get('yaw');
renderer.render(scene, cam);
window.__ready = true;
