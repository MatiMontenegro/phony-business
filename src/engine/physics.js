// Rapier physics: a Rust engine compiled to WebAssembly.
import RAPIER from '@dimforge/rapier3d-compat';
import { GROUP, groups } from '../config.js';

export let R = null;

export async function initPhysics() {
  if (R) return R;
  await RAPIER.init();
  R = RAPIER;
  return R;
}

export const FIXED_DT = 1 / 60;

export class Physics {
  constructor() {
    this.world = new R.World({ x: 0, y: -20, z: 0 });
    this.world.timestep = FIXED_DT;
    this.world.numSolverIterations = 6;
    this.acc = 0;
    this.alpha = 0;
    this.staticBody = this.world.createRigidBody(R.RigidBodyDesc.fixed());
  }

  // Static axis-aligned box collider (center + half extents)
  addStaticBox(cx, cy, cz, hx, hy, hz, opts = {}) {
    const desc = R.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(cx, cy, cz)
      .setFriction(opts.friction ?? 0.8)
      .setRestitution(opts.restitution ?? 0.05)
      .setCollisionGroups(groups(GROUP.STATIC, 0xffff));
    if (opts.rotation) desc.setRotation(opts.rotation);
    return this.world.createCollider(desc, this.staticBody);
  }

  addStaticCylinder(cx, cy, cz, halfHeight, radius) {
    const desc = R.ColliderDesc.cylinder(halfHeight, radius)
      .setTranslation(cx, cy, cz)
      .setCollisionGroups(groups(GROUP.STATIC, 0xffff));
    return this.world.createCollider(desc, this.staticBody);
  }

  // Fixed-timestep stepping. `beforeStep(dt)` runs once per substep.
  step(dt, beforeStep) {
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= FIXED_DT && n < 5) {
      if (beforeStep) beforeStep(FIXED_DT);
      this.world.step();
      this.acc -= FIXED_DT;
      n++;
    }
    if (n === 5) this.acc = 0;
    this.alpha = this.acc / FIXED_DT;
    return n;
  }

  castRay(origin, dir, maxToi, filterGroups) {
    const ray = new R.Ray(origin, dir);
    const hit = this.world.castRay(ray, maxToi, true, undefined, filterGroups);
    return hit ? hit.timeOfImpact : null;
  }
}
