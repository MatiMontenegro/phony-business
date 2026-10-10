// Third-person follow camera with wall avoidance, plus scripted shots
// (sitting down, flying into a monitor) that blend in and out smoothly.
import * as THREE from 'three';
import { GROUP, groups } from '../config.js';
import { settings } from '../settings.js';

const _dir = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _want = new THREE.Vector3();
const _right = new THREE.Vector3();
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class FollowCamera {
  constructor(camera, physics) {
    this.camera = camera;
    this.physics = physics;
    this.yaw = Math.PI;
    this.pitch = 0.3;
    this.distance = 3.6;
    this.targetDistance = 3.6;
    this.lookAt = new THREE.Vector3();
    this.mode = 'follow';
    this.fixedPos = new THREE.Vector3();
    this.fixedLook = new THREE.Vector3();
    this.fovBase = settings.get('graphics.fov') || 60;
    this.fovTarget = null;
    this.rayFilter = groups(GROUP.CHAR, GROUP.STATIC);
    this.shift = 0;
    this.shiftNow = 0;
    this.shot = null;
    settings.onChange((p, v) => { if (p === 'graphics.fov') this.fovBase = v; });
  }

  // forward / right on the ground plane for movement input
  basis(fwd, right) {
    fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  look(dx, dy, k = 1) {
    const sens = settings.get('controls.sensitivity') || 1;
    const inv = settings.get('controls.invertY') ? -1 : 1;
    this.yaw -= dx * 0.0024 * k * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.002 * k * sens * inv, -0.45, 1.2);
  }

  zoom(d) { this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + d * 0.4, 1.6, 7); }

  setFixed(pos, look, fov = null) {
    this.mode = 'fixed';
    this.shot = null;
    this.fixedPos.copy(pos);
    this.fixedLook.copy(look);
    this.fovTarget = fov;
  }

  setFollow() { this.mode = 'follow'; this.shot = null; this.fovTarget = null; }

  // scripted move from the current view to (pos, look) with an arc through `via`
  flyTo(pos, look, { duration = 1.2, fov = null, via = null, onDone = null } = {}) {
    const cam = this.camera;
    this.shot = {
      t: 0,
      dur: duration,
      p0: cam.position.clone(),
      l0: this.lookAt.clone(),
      f0: cam.fov,
      p1: pos.clone(),
      l1: look.clone(),
      f1: fov ?? cam.fov,
      via: via ? via.clone() : null,
      onDone,
    };
    this.mode = 'shot';
  }

  get shotProgress() { return this.shot ? Math.min(1, this.shot.t / this.shot.dur) : this.mode === 'shot' ? 1 : 0; }

  applyShift(dt) {
    const cam = this.camera;
    this.shiftNow += (this.shift - this.shiftNow) * Math.min(1, dt * 5);
    if (Math.abs(this.shiftNow) < 0.002) {
      if (cam.view && cam.view.enabled) cam.clearViewOffset();
      return;
    }
    const w = 1000, h = Math.round(1000 / cam.aspect);
    cam.setViewOffset(w, h, Math.round(this.shiftNow * w), 0, w, h);
  }

  update(dt, target, o = {}) {
    const cam = this.camera;
    this.applyShift(dt);
    if (this.mode === 'shot' && this.shot) {
      const s = this.shot;
      s.t += dt;
      const k = ease(Math.min(1, s.t / s.dur));
      if (s.via) {
        // quadratic bezier p0 -> via -> p1
        const a = s.p0.clone().lerp(s.via, k), b = s.via.clone().lerp(s.p1, k);
        cam.position.copy(a.lerp(b, k));
      } else cam.position.copy(s.p0).lerp(s.p1, k);
      this.lookAt.copy(s.l0).lerp(s.l1, k);
      cam.lookAt(this.lookAt);
      const f = s.f0 + (s.f1 - s.f0) * k;
      if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix(); }
      if (s.t >= s.dur) {
        const done = s.onDone;
        this.fixedPos.copy(s.p1);
        this.fixedLook.copy(s.l1);
        this.fovTarget = s.f1;
        this.shot = null;
        this.mode = 'fixed';
        if (done) done();
      }
      return;
    }
    if (this.mode === 'fixed') {
      cam.position.lerp(this.fixedPos, 1 - Math.exp(-dt * 6));
      this.lookAt.lerp(this.fixedLook, 1 - Math.exp(-dt * 7));
      cam.lookAt(this.lookAt);
      const f = this.fovTarget ?? this.fovBase;
      if (Math.abs(cam.fov - f) > 0.05) { cam.fov += (f - cam.fov) * Math.min(1, dt * 5); cam.updateProjectionMatrix(); }
      return;
    }
    const k = 1 - Math.exp(-dt * (o.snappy ? 20 : 10));
    this.distance += (this.targetDistance - this.distance) * Math.min(1, dt * 8);
    _pivot.copy(target);
    _pivot.y += o.pivotHeight ?? 1.58;
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    _pivot.addScaledVector(_right, o.shoulder ?? 0.38);
    _dir.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    let d = this.distance;
    if (this.physics) {
      const hit = this.physics.castRay({ x: _pivot.x, y: _pivot.y, z: _pivot.z }, { x: _dir.x, y: _dir.y, z: _dir.z }, d + 0.3, this.rayFilter);
      if (hit !== null) d = Math.max(0.55, hit - 0.3);
    }
    _want.copy(_pivot).addScaledVector(_dir, d);
    _want.y = Math.min(_want.y, 3.95);
    cam.position.lerp(_want, k);
    this.lookAt.lerp(_pivot, Math.min(1, k * 1.4));
    cam.lookAt(this.lookAt);
    const f = this.fovBase + (o.sprint ? 6 : 0);
    if (Math.abs(cam.fov - f) > 0.05) { cam.fov += (f - cam.fov) * Math.min(1, dt * 5); cam.updateProjectionMatrix(); }
  }
}
