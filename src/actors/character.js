// A character in the world: rig + animator + optional kinematic capsule +
// ragdoll switching with a blended get-up.
import * as THREE from 'three';
import { R } from '../engine/physics.js';
import { Rig } from './rig.js';
import { Animator } from './animator.js';
import { Ragdoll } from './ragdoll.js';
import { POSE_PARTS, solvePose, makePoseBuffer, blendPose } from './skeleton.js';
import { GROUP, groups } from '../config.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _mi = new THREE.Matrix4();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
export const CAPSULE = { hh: 0.64, r: 0.24 };

export class Character {
  constructor(scene, physics, look = {}, opts = {}) {
    this.scene = scene;
    this.physics = physics;
    this.rig = new Rig(look, { async: !!opts.async, onReady: () => this.onRigReady && this.onRigReady() });
    this.scale = this.rig.look.scale || 1;
    scene.add(this.rig.root);
    this.anim = new Animator();
    this.pose = makePoseBuffer();
    this.blendFrom = makePoseBuffer();
    this.tmpPose = makePoseBuffer();
    this.position = new THREE.Vector3();
    this.yaw = 0;
    this.velocity = new THREE.Vector3();
    this.lastPos = new THREE.Vector3();
    this.animState = { state: 'idle', speed: 0 };
    this.ragdoll = null;
    this.ragdollT = 0;
    this.getUpT = 0;
    this.getUpDur = 0.65;
    this.t = 0;
    this.talking = 0;
    this.greedBase = 0;
    this.speechLevel = -1; // >= 0 when driven by real audio levels
    this.id = opts.id || Math.random().toString(36).slice(2, 8);
    if (opts.capsule !== false) {
      const hh = CAPSULE.hh * this.scale, r = CAPSULE.r * this.scale;
      this.body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
      this.collider = physics.world.createCollider(
        R.ColliderDesc.capsule(hh, r).setTranslation(0, hh + r, 0)
          .setCollisionGroups(groups(GROUP.CHAR, GROUP.STATIC | GROUP.PROP | GROUP.RAGDOLL | GROUP.CHAR | GROUP.PROJECTILE)),
        this.body,
      );
      this.collider.userData = { character: this };
    }
  }

  get isRagdoll() { return !!this.ragdoll; }

  setTransform(p, yaw) {
    this.position.copy(p);
    this.lastPos.copy(p);
    this.yaw = yaw;
    if (this.body) this.body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
  }

  syncCapsule() {
    if (!this.body) return;
    const y = this.ragdoll ? -50 : this.position.y;
    this.body.setNextKinematicTranslation({ x: this.position.x, y, z: this.position.z });
  }

  update(dt) {
    this.t += dt;
    const rig = this.rig;
    rig.speed = this.animState.speed || 0;
    if (this.ragdoll) {
      if (!this.ragdoll.isValid()) { this.endRagdoll(true); return; }
      rig.root.position.set(0, 0, 0);
      rig.root.quaternion.identity();
      this.ragdoll.syncToRig(rig);
      this.ragdollT += dt;
      this.ragdoll.torsoPosition(_v);
      this.position.set(_v.x, 0, _v.z);
    } else {
      rig.root.position.copy(this.position);
      rig.root.rotation.set(0, this.yaw, 0);
      const P = this.anim.update(dt, this.animState);
      solvePose(P, this.pose);
      if (this.getUpT > 0) {
        this.getUpT -= dt;
        const k = 1 - Math.max(0, this.getUpT) / this.getUpDur;
        blendPose(this.tmpPose, this.blendFrom, this.pose, k * k * (3 - 2 * k));
        rig.applyPose(this.tmpPose);
      } else {
        rig.applyPose(this.pose);
      }
      rig.breathe(P.breath);
    }
    // mouth: audio-driven when available, otherwise a talking flap
    if (this.speechLevel >= 0) {
      rig.mouthOpen += (Math.min(1, this.speechLevel * 1.6) - rig.mouthOpen) * Math.min(1, dt * 25);
    } else if (this.talking > 0) {
      this.talking -= dt;
      rig.mouthOpen = 0.25 + Math.abs(Math.sin(this.t * 16)) * 0.5 * (0.6 + Math.random() * 0.4);
    } else {
      rig.mouthOpen *= Math.exp(-dt * 12);
    }
    rig.updateFace(dt, this.t);
    // cartoon head bob while talking (bigger when yelling)
    const talk = Math.min(1, rig.mouthOpen * 1.35);
    this.shoutT = Math.max(0, (this.shoutT || 0) - dt);
    const shout = this.shoutT > 0 ? 1 : 0;
    if (!this.ragdoll && talk > 0.04 && rig.bones.head) {
      const amp = 1 + shout * 0.8;
      rig.bones.head.rotateX(Math.sin(this.t * 11) * 0.09 * talk * amp - 0.04 * shout);
      rig.bones.head.rotateZ(Math.sin(this.t * 6.7) * 0.06 * talk * amp);
      rig.bones.head.rotateY(Math.sin(this.t * 4.1) * 0.05 * talk);
    }
    // greed swells the head while talking; yelling (or a rich mouth) turns it red
    const greed = (this.greedBase || 0) * talk;
    rig.setGreed(greed);
    rig.setFlush(Math.max(shout * Math.max(0.6, talk), greed * 0.6));
    rig.applyGreed(dt);
    // secondary motion from the actual movement
    if (dt > 0) {
      this.velocity.copy(this.position).sub(this.lastPos).divideScalar(dt);
      this.lastPos.copy(this.position);
    }
    rig.updateSway(dt, this.velocity);
  }

  startRagdoll(vel = { x: 0, y: 0, z: 0 }, spin = null) {
    if (this.ragdoll) {
      this.ragdoll.addVelocity(vel);
      this.ragdollT = Math.min(this.ragdollT, 0.3);
      return;
    }
    const rig = this.rig;
    rig.root.position.copy(this.position);
    rig.root.rotation.set(0, this.yaw, 0);
    rig.root.updateMatrixWorld(true);
    if (this.collider) this.collider.setEnabled(false);
    if (this.body) this.body.setTranslation({ x: this.position.x, y: -50, z: this.position.z }, true);
    this.ragdoll = new Ragdoll(this.physics);
    this.ragdoll.spawn(rig, vel, spin, this.scale);
    this.ragdollT = 0;
    this.getUpT = 0;
  }

  endRagdoll(instant = false) {
    if (!this.ragdoll) return;
    const rd = this.ragdoll;
    const ok = rd.isValid();
    const tp = ok ? rd.torsoPosition(new THREE.Vector3()) : this.position.clone();
    const tq = ok ? rd.torsoQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(tq);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(tq);
    const dir = new THREE.Vector3(fwd.x, 0, fwd.z);
    if (dir.lengthSq() < 0.05) dir.set(-up.x, 0, -up.z);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    this.yaw = Math.atan2(dir.x, dir.z);
    this.position.set(tp.x, Math.max(0, this.groundHeightAt ? this.groundHeightAt(tp) : 0), tp.z);
    // remember the floppy pose in character space to blend out of it
    const rig = this.rig;
    _m.compose(this.position, _q.setFromAxisAngle(UP, this.yaw), _s.set(this.scale, this.scale, this.scale));
    _mi.copy(_m).invert();
    for (const n of POSE_PARTS) {
      const b = rig.parts[n];
      const w = new THREE.Matrix4().compose(b.position.clone().multiplyScalar(this.scale), b.quaternion, _s.set(1, 1, 1));
      new THREE.Matrix4().multiplyMatrices(_mi, w).decompose(this.blendFrom[n].p, this.blendFrom[n].q, _s);
      this.blendFrom[n].p.divideScalar(1);
    }
    rd.dispose();
    this.ragdoll = null;
    this.getUpT = instant ? 0 : this.getUpDur;
    if (this.body) {
      this.body.setTranslation({ x: this.position.x, y: this.position.y, z: this.position.z }, true);
      this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y, z: this.position.z });
    }
    if (this.collider) this.collider.setEnabled(true);
    this.lastPos.copy(this.position);
    if (this.onGetUp) this.onGetUp(this.position);
  }

  headWorld(out = new THREE.Vector3()) {
    if (this.ragdoll) return this.ragdoll.headPosition(out);
    const h = this.rig.parts.head;
    if (this.rig.ready) {
      this.rig.root.updateMatrixWorld(true);
      return out.setFromMatrixPosition(h.matrixWorld).add(_v.set(0, 0.16 * this.scale, 0));
    }
    return out.set(this.position.x, this.position.y + 1.62 * this.scale, this.position.z);
  }

  centerWorld(out = new THREE.Vector3()) {
    if (this.ragdoll) return this.ragdoll.torsoPosition(out);
    return out.set(this.position.x, this.position.y + 1.0 * this.scale, this.position.z);
  }

  setVisible(v) { this.rig.root.visible = v && this.rig.ready; }

  dispose() {
    if (this.ragdoll) this.ragdoll.dispose();
    if (this.body) this.physics.world.removeRigidBody(this.body);
    this.rig.dispose();
  }
}
