// Kinematic character controller (Rapier KCC) with acceleration, jumping
// and interpolation between fixed physics steps.
import * as THREE from 'three';
import { R } from '../engine/physics.js';
import { TUNE, GROUP, groups } from '../config.js';

export class Controller {
  constructor(physics, character) {
    this.physics = physics;
    this.char = character;
    const k = physics.world.createCharacterController(0.03);
    k.setUp({ x: 0, y: 1, z: 0 });
    k.enableAutostep(0.32, 0.18, false);
    k.enableSnapToGround(0.3);
    k.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    k.setMinSlopeSlideAngle((35 * Math.PI) / 180);
    k.setApplyImpulsesToDynamicBodies(true);
    k.setCharacterMass(4);
    this.kcc = k;
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.grounded = true;
    this.prev = new THREE.Vector3();
    this.curr = new THREE.Vector3();
    this.wish = new THREE.Vector3();
    this.run = false;
    this.jumpQueued = false;
    this.locked = false;
    this.speedMul = 1;
    this.filter = groups(GROUP.CHAR, GROUP.STATIC | GROUP.PROP | GROUP.CHAR);
    this.justLanded = false;
  }

  teleport(p) {
    this.curr.copy(p);
    this.prev.copy(p);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.char.body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    this.char.body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
  }

  setInput(wish, run, jump) {
    this.wish.copy(wish);
    this.run = run;
    if (jump) this.jumpQueued = true;
  }

  fixedUpdate(dt) {
    if (this.locked) { this.prev.copy(this.curr); return; }
    const sp = (this.run ? TUNE.runSpeed : TUNE.walkSpeed) * this.speedMul;
    const tx = this.wish.x * sp, tz = this.wish.z * sp;
    const a = (this.grounded ? TUNE.accel : TUNE.accel * TUNE.airControl) * dt;
    this.vel.x += THREE.MathUtils.clamp(tx - this.vel.x, -a, a);
    this.vel.z += THREE.MathUtils.clamp(tz - this.vel.z, -a, a);
    if (this.jumpQueued && this.grounded) { this.vy = TUNE.jumpVel; this.grounded = false; }
    this.jumpQueued = false;
    this.vy += TUNE.gravity * dt;
    const want = { x: this.vel.x * dt, y: this.vy * dt, z: this.vel.z * dt };
    this.kcc.computeColliderMovement(this.char.collider, want, R.QueryFilterFlags.EXCLUDE_SENSORS, this.filter);
    const mv = this.kcc.computedMovement();
    const was = this.grounded;
    this.grounded = this.kcc.computedGrounded();
    this.prev.copy(this.curr);
    this.curr.x += mv.x; this.curr.y += mv.y; this.curr.z += mv.z;
    if (this.curr.y < -2) { this.curr.set(0, 0.1, 0); this.vy = 0; }
    this.char.body.setNextKinematicTranslation({ x: this.curr.x, y: this.curr.y, z: this.curr.z });
    if (this.grounded && this.vy < 0) this.vy = 0;
    if (this.vy > 0 && mv.y < want.y * 0.5) this.vy = 0;
    if (Math.abs(mv.x) < Math.abs(want.x) * 0.5) this.vel.x *= 0.5;
    if (Math.abs(mv.z) < Math.abs(want.z) * 0.5) this.vel.z *= 0.5;
    this.justLanded = !was && this.grounded;
  }

  renderPosition(alpha, out) { return out.copy(this.prev).lerp(this.curr, alpha); }
  horizontalSpeed() { return Math.hypot(this.vel.x, this.vel.z); }
}
