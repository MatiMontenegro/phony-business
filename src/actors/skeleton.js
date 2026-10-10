// Human proportions, bone list and forward kinematics shared by the avatar
// builder, the animator, the ragdoll and the portrait renderer.
import * as THREE from 'three';

// Metres, for scale 1 (about 1.78 m to the crown). Characters face +Z.
export const DIM = {
  hipY: 0.97, // standing height of the pelvis origin
  spineY: 0.09, // waist pivot above the pelvis origin
  neckY: 0.4, // neck base above the waist pivot
  shoulderX: 0.185, shoulderY: 0.35, shoulderZ: -0.012,
  upperArmLen: 0.285, foreArmLen: 0.25, handLen: 0.19,
  hipX: 0.092, hipJointY: -0.045,
  thighLen: 0.43, shinLen: 0.42, footH: 0.075,
  crown: 0.3, // top of the head above the neck base
  eyeY: 0.176, // eye height above the neck base
  jawPivot: [0, 0.128, -0.012], // head space
  jawRest: -0.088, // closes the sculpted mouth
};

// physics parts (each gets a rigid body in a ragdoll)
export const PARTS = ['torso', 'head', 'uArmL', 'fArmL', 'uArmR', 'fArmR', 'thighL', 'shinL', 'thighR', 'shinR'];
export const PARENT = { head: 'torso', uArmL: 'torso', uArmR: 'torso', fArmL: 'uArmL', fArmR: 'uArmR', thighL: 'torso', thighR: 'torso', shinL: 'thighL', shinR: 'thighR' };
// skinning bones (pelvis follows the hips; jaw is a child of the head)
export const BONES = ['pelvis', 'torso', 'head', 'jaw', 'uArmL', 'fArmL', 'uArmR', 'fArmR', 'thighL', 'shinL', 'thighR', 'shinR'];
export const BONE_INDEX = Object.fromEntries(BONES.map((b, i) => [b, i]));
export const POSE_PARTS = ['pelvis', ...PARTS];

export function defaultPose() {
  return {
    hipsX: 0, hipsY: DIM.hipY, hipsZ: 0, hipsPitch: 0, hipsYaw: 0, hipsRoll: 0,
    torsoPitch: 0, torsoYaw: 0, torsoRoll: 0,
    headPitch: 0, headYaw: 0, headRoll: 0,
    armLPitch: 0, armLYaw: 0, armLRoll: 0.09, elbowL: -0.12,
    armRPitch: 0, armRYaw: 0, armRRoll: -0.09, elbowR: -0.12,
    legLPitch: 0, legLRoll: 0.02, kneeL: 0,
    legRPitch: 0, legRRoll: -0.02, kneeR: 0,
    breath: 0,
  };
}

// A-pose the meshes are sculpted (and skinned) in: arms away from the body
export function bindPose() {
  const p = defaultPose();
  p.armLRoll = 0.8; p.armRRoll = -0.8;
  p.elbowL = 0; p.elbowR = 0;
  p.legLRoll = 0.045; p.legRRoll = -0.045;
  return p;
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const M = { h: new THREE.Matrix4(), t: new THREE.Matrix4(), tmp: new THREE.Matrix4(), off: new THREE.Matrix4(), a: new THREE.Matrix4(), b: new THREE.Matrix4() };

function rot(out, x, y, z, order = 'XYZ') {
  _e.set(x, y, z, order);
  _q.setFromEuler(_e);
  return out.makeRotationFromQuaternion(_q);
}
function trans(out, x, y, z) { return out.makeTranslation(x, y, z); }
function write(target, m) { m.decompose(target.p, target.q, _v); }

export function makePoseBuffer() {
  const o = {};
  for (const p of POSE_PARTS) o[p] = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  return o;
}

// pose params -> part transforms in character space (root at origin)
export function solvePose(P, out) {
  const H = M.h;
  rot(H, P.hipsPitch, P.hipsYaw, P.hipsRoll);
  H.setPosition(P.hipsX, P.hipsY, P.hipsZ);
  write(out.pelvis, H);
  const T = M.t.copy(H).multiply(trans(M.off, 0, DIM.spineY, 0)).multiply(rot(M.tmp, P.torsoPitch, P.torsoYaw, P.torsoRoll));
  write(out.torso, T);
  M.a.copy(T).multiply(trans(M.off, 0, DIM.neckY, 0)).multiply(rot(M.tmp, P.headPitch, P.headYaw, P.headRoll));
  write(out.head, M.a);
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    M.a.copy(T).multiply(trans(M.off, DIM.shoulderX * s, DIM.shoulderY, DIM.shoulderZ))
      .multiply(rot(M.tmp, P['arm' + side + 'Pitch'], P['arm' + side + 'Yaw'], P['arm' + side + 'Roll'], 'ZXY'));
    write(out['uArm' + side], M.a);
    M.a.multiply(trans(M.off, 0, -DIM.upperArmLen, 0)).multiply(rot(M.tmp, P['elbow' + side], 0, 0));
    write(out['fArm' + side], M.a);
  }
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    M.b.copy(H).multiply(trans(M.off, DIM.hipX * s, DIM.hipJointY, 0))
      .multiply(rot(M.tmp, P['leg' + side + 'Pitch'], 0, P['leg' + side + 'Roll'], 'ZXY'));
    write(out['thigh' + side], M.b);
    M.b.multiply(trans(M.off, 0, -DIM.thighLen, 0)).multiply(rot(M.tmp, P['knee' + side], 0, 0));
    write(out['shin' + side], M.b);
  }
  return out;
}

export function blendPose(out, a, b, k) {
  for (const p of POSE_PARTS) {
    out[p].p.copy(a[p].p).lerp(b[p].p, k);
    out[p].q.copy(a[p].q).slerp(b[p].q, k);
  }
  return out;
}

// world matrices of the bind pose (character space)
let _bind = null;
export function bindMatrices() {
  if (_bind) return _bind;
  const buf = solvePose(bindPose(), makePoseBuffer());
  const out = {};
  for (const p of POSE_PARTS) out[p] = new THREE.Matrix4().compose(buf[p].p, buf[p].q, new THREE.Vector3(1, 1, 1));
  out.jaw = out.head.clone().multiply(new THREE.Matrix4().makeTranslation(...DIM.jawPivot));
  _bind = out;
  return out;
}

// transform a bone-local point into bind (character) space
export function toBind(bone, x, y, z) {
  const m = bindMatrices()[bone];
  return new THREE.Vector3(x, y, z).applyMatrix4(m).toArray();
}
