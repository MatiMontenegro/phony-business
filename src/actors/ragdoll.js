// Active ragdoll: one Rapier rigid body per body part, joined at the joints.
import * as THREE from 'three';
import { R } from '../engine/physics.js';
import { PARTS, PARENT, DIM } from './skeleton.js';
import { GROUP, groups } from '../config.js';

// collision shapes in each part's local frame
const SHAPES = {
  torso: { center: [0, 0.13, 0], hh: 0.16, r: 0.15, density: 0.7 },
  head: { center: [0, 0.16, 0.01], ball: 0.11, density: 0.9 },
  uArmL: { center: [0, -0.14, 0], hh: 0.09, r: 0.05, density: 3 },
  uArmR: { center: [0, -0.14, 0], hh: 0.09, r: 0.05, density: 3 },
  fArmL: { center: [0, -0.2, 0], hh: 0.17, r: 0.045, density: 3 },
  fArmR: { center: [0, -0.2, 0], hh: 0.17, r: 0.045, density: 3 },
  thighL: { center: [0, -0.215, 0], hh: 0.15, r: 0.075, density: 2.5 },
  thighR: { center: [0, -0.215, 0], hh: 0.15, r: 0.075, density: 2.5 },
  shinL: { center: [0, -0.24, 0.02], hh: 0.17, r: 0.06, density: 2.5 },
  shinR: { center: [0, -0.24, 0.02], hh: 0.17, r: 0.06, density: 2.5 },
};
// hinge limits (elbows bend forward, knees bend back)
const HINGES = { fArmL: [-2.5, 0.05], fArmR: [-2.5, 0.05], shinL: [-0.05, 2.5], shinR: [-0.05, 2.5] };

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _iq = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0);

function localAnchor(body, world) {
  const t = body.translation();
  const r = body.rotation();
  _iq.set(r.x, r.y, r.z, r.w).invert();
  return _v.set(world.x - t.x, world.y - t.y, world.z - t.z).applyQuaternion(_iq).clone();
}

export class Ragdoll {
  constructor(physics) {
    this.physics = physics;
    this.bodies = {};
    this.joints = [];
    this.alive = false;
    this.scale = 1;
  }

  spawn(rig, vel = { x: 0, y: 0, z: 0 }, spin = null, scale = 1) {
    const world = this.physics.world;
    rig.root.updateMatrixWorld(true);
    const pose = {};
    for (const name of PARTS) {
      rig.parts[name].matrixWorld.decompose(_p, _q, _s);
      pose[name] = { p: _p.clone(), q: _q.clone() };
      const sh = SHAPES[name];
      const center = new THREE.Vector3(...sh.center).multiplyScalar(scale);
      const c = center.clone().applyQuaternion(_q).add(_p);
      const desc = R.RigidBodyDesc.dynamic()
        .setTranslation(c.x, c.y, c.z)
        .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
        .setLinearDamping(0.12)
        .setAngularDamping(name === 'torso' ? 1 : 2.2)
        .setCcdEnabled(name === 'torso' || name === 'head');
      const body = world.createRigidBody(desc);
      body.setLinvel(vel, true);
      const cd = sh.ball ? R.ColliderDesc.ball(sh.ball * scale) : R.ColliderDesc.capsule(sh.hh * scale, sh.r * scale);
      cd.setDensity(sh.density).setFriction(0.75).setRestitution(0.15)
        .setCollisionGroups(groups(GROUP.RAGDOLL, GROUP.STATIC | GROUP.PROP | GROUP.RAGDOLL | GROUP.CHAR | GROUP.PROJECTILE));
      const collider = world.createCollider(cd, body);
      this.bodies[name] = { body, collider, center };
    }
    if (spin) this.bodies.torso.body.setAngvel(spin, true);
    for (const name of PARTS) {
      const parent = PARENT[name];
      if (!parent) continue;
      const a = this.bodies[parent].body, b = this.bodies[name].body;
      const pivot = pose[name].p;
      const la = localAnchor(a, pivot), lb = localAnchor(b, pivot);
      let data;
      if (HINGES[name]) {
        const qa = pose[parent].q, qb = pose[name].q;
        const axis = X.clone().applyQuaternion(qb).applyQuaternion(qa.clone().invert());
        data = R.JointData.revoluteWithAxes ? R.JointData.revoluteWithAxes(la, lb, axis, { x: 1, y: 0, z: 0 }) : R.JointData.revolute(la, lb, axis);
      } else {
        data = R.JointData.spherical(la, lb);
      }
      const j = world.createImpulseJoint(data, a, b, true);
      j.setContactsEnabled(false);
      if (HINGES[name] && j.setLimits) j.setLimits(HINGES[name][0], HINGES[name][1]);
      this.joints.push(j);
    }
    this.alive = true;
    this.scale = scale;
  }

  // write the simulated parts back into the rig (root must be at the origin)
  syncToRig(rig) {
    const s = this.scale;
    for (const name of PARTS) {
      const b = this.bodies[name];
      const t = b.body.translation();
      const r = b.body.rotation();
      _q.set(r.x, r.y, r.z, r.w);
      _v.copy(b.center).applyQuaternion(_q);
      const bone = rig.parts[name];
      bone.position.set((t.x - _v.x) / s, (t.y - _v.y) / s, (t.z - _v.z) / s);
      bone.quaternion.copy(_q);
    }
    // the pelvis has no body of its own: it hangs under the torso
    const torso = rig.parts.torso, pelvis = rig.parts.pelvis;
    pelvis.quaternion.copy(torso.quaternion);
    pelvis.position.copy(_v.set(0, -DIM.spineY, 0).applyQuaternion(torso.quaternion).add(torso.position));
  }

  torsoPosition(out = new THREE.Vector3()) { const t = this.bodies.torso.body.translation(); return out.set(t.x, t.y, t.z); }
  torsoQuaternion(out = new THREE.Quaternion()) { const r = this.bodies.torso.body.rotation(); return out.set(r.x, r.y, r.z, r.w); }
  headPosition(out = new THREE.Vector3()) { const t = this.bodies.head.body.translation(); return out.set(t.x, t.y, t.z); }
  speed() { const v = this.bodies.torso.body.linvel(); return Math.hypot(v.x, v.y, v.z); }

  addVelocity(v, limbs = 1) {
    for (const name of PARTS) {
      const b = this.bodies[name].body;
      const l = b.linvel();
      const k = name === 'torso' || name === 'head' ? 1 : limbs;
      b.setLinvel({ x: l.x + v.x * k, y: l.y + v.y * k, z: l.z + v.z * k }, true);
    }
  }

  // pull the torso toward a target (remote players' ragdolls follow the network)
  steerTorso(target, strength = 6, dt = 1 / 60) {
    const b = this.bodies.torso.body;
    const t = b.translation();
    const l = b.linvel();
    const k = strength * dt * 10;
    b.setLinvel({ x: l.x + (target.x - t.x) * k, y: l.y + (target.y - t.y) * k, z: l.z + (target.z - t.z) * k }, true);
  }

  isValid() {
    if (!this.alive) return false;
    const t = this.bodies.torso.body.translation();
    return Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z);
  }

  dispose() {
    if (!this.alive) return;
    const world = this.physics.world;
    for (const j of this.joints) world.removeImpulseJoint(j, true);
    for (const name of PARTS) world.removeRigidBody(this.bodies[name].body);
    this.joints = [];
    this.bodies = {};
    this.alive = false;
  }
}
