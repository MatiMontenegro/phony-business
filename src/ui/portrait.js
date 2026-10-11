// Caller-ID portraits: renders a mark's bust once (in a tiny offscreen
// renderer) and caches it as an image URL for the Phone app.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Rig } from '../actors/rig.js';
import { defaultPose, solvePose, makePoseBuffer } from '../actors/skeleton.js';

let R = null;
// a friendly wave for the caller ID (upper arm out, forearm up, not twisted)
const PHONE_POSE = { headYaw: -0.16, headRoll: 0.06, headPitch: -0.03, armRRoll: -1.4, armRPitch: -0.15, elbowR: -1.65, armRYaw: -1.45, torsoYaw: 0.05, torsoRoll: 0.03 };
export const portraitPose = { override: null };
const cache = new Map();
const waiting = new Map();

function studio() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(256, 256, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pm.dispose();
  const key = new THREE.DirectionalLight('#fff1dc', 2.4);
  key.position.set(1.5, 2.6, 3);
  const rim = new THREE.DirectionalLight('#8fa7ff', 2.6);
  rim.position.set(-2.5, 1.8, -2);
  scene.add(key, rim, new THREE.HemisphereLight('#c7d0ff', '#40285a', 0.6));
  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 20);
  return { renderer, scene, camera };
}

export function portrait(mark) {
  if (cache.has(mark.id)) return Promise.resolve(cache.get(mark.id));
  if (waiting.has(mark.id)) return waiting.get(mark.id);
  const p = (async () => {
    try {
      R ||= studio();
      const rig = new Rig(mark.look, { async: true });
      await rig.whenReady;
      const P = defaultPose();
      Object.assign(P, PHONE_POSE, portraitPose.override || {});
      const buf = makePoseBuffer();
      solvePose(P, buf);
      rig.applyPose(buf);
      rig.root.rotation.y = 0.18;
      rig.setExpression('happy');
      rig.mouthOpen = 0.25;
      for (let i = 0; i < 20; i++) rig.updateFace(0.05, i * 0.05);
      const s = rig.look.scale || 1;
      const { renderer, scene, camera } = R;
      camera.position.set(0.32 * s, 1.6 * s, 1.55 * s);
      camera.lookAt(0, 1.5 * s, 0);
      scene.add(rig.root);
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(rig.root);
      rig.dispose();
      cache.set(mark.id, url);
      return url;
    } catch (e) {
      console.warn('portrait failed', e);
      return '';
    } finally {
      waiting.delete(mark.id);
    }
  })();
  waiting.set(mark.id, p);
  return p;
}

// fill an <img> when the portrait is ready
export function setPortrait(img, mark) {
  const url = cache.get(mark.id);
  if (url) { img.src = url; return; }
  img.removeAttribute('src');
  portrait(mark).then((u) => { if (u && img.isConnected) img.src = u; });
}
