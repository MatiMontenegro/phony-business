// Visual test bench for animation states.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Character } from '../src/actors/character.js';
import { initPhysics, Physics } from '../src/engine/physics.js';

await initPhysics();
const physics = new Physics();
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
key.position.set(3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 3; key.shadow.camera.bottom = -1;
scene.add(key);
const rim = new THREE.DirectionalLight('#8fa7ff', 2); rim.position.set(-3, 2.5, -3); scene.add(rim);
scene.add(new THREE.HemisphereLight('#c7d0ff', '#40285a', 0.5));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#3a3352', roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const look = { build: 'average', skin: '#eec0a0', hair: 'quiff', hairColor: '#3b2416', shirt: { style: 'buttonup', color: '#8fa7ff' }, tie: '#1a1433', badge: 'Matias', headset: true };
const states = (q.get('states') || 'idle,move:1.4,move:4.5,sit,sit:t,pee,toilet,wave,charge,dance').split(',');
const yaw = +(q.get('yaw') || 0.5);
states.forEach((st, i) => {
  const [name, arg] = st.split(':');
  const c = new Character(scene, physics, look, { capsule: false });
  c.setTransform(new THREE.Vector3((i - (states.length - 1) / 2) * 1.1, 0, 0), yaw);
  c.animState = { state: name, speed: name === 'move' ? +arg : 0, typing: arg === 't', talking: arg === 'k', charge: 0.6, relief: true };
  if (name === 'sit' || name === 'toilet') {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: '#2c2a4a' }));
    seat.position.set(c.position.x, name === 'toilet' ? 0.4 : 0.44, 0); seat.rotation.y = yaw; seat.castShadow = true; scene.add(seat);
    if (name === 'sit') {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: '#cdc5b4' }));
      const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      desk.position.set(c.position.x + fwd.x * 0.55, 0.735, fwd.z * 0.55); desk.rotation.y = yaw; scene.add(desk);
    }
  }
  for (let k = 0; k < 40; k++) c.update(1 / 60);
});
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 80);
const zoom = +(q.get("zoom") || 11.5); cam.position.set(0, 1.2, zoom);
cam.lookAt(0, 0.8, 0);
renderer.render(scene, cam);
window.__ready = true;
