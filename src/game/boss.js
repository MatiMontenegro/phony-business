// Big Phil, the boss. Runs on the host: patrols the floor, chases whoever
// farts, pees on the carpet, misses calls or slacks off, yells, and throws
// staplers. Other players see a network copy.
import * as THREE from 'three';
import { Character } from '../actors/character.js';
import { Controller } from './controller.js';
import { BOSS_LINES } from '../i18n.js';

export const BOSS_LOOK = {
  build: 'boss', scale: 1.14, skin: '#f0b48c', hair: 'slick', hairColor: '#2e2a3a',
  shirt: { style: 'suit', color: '#2a2440' }, pants: { color: '#2a2440', style: 'slacks' }, shoes: { style: 'dress', color: '#1a1410' },
  tie: '#f2c14e', glasses: 'sun', mustache: true, extras: ['goldChain'], face: { preset: 5 }, headset: false,
};

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Boss {
  constructor(game) {
    this.game = game;
    this.char = new Character(game.scene, game.physics, BOSS_LOOK, { id: 'boss', async: true });
    this.char.groundHeightAt = () => 0;
    this.ctrl = new Controller(game.physics, this.char);
    this.home = game.office.bossHome.clone();
    this.waypoints = game.office.bossWaypoints;
    this.spawn(this.home);
    this.state = 'office';
    this.stateT = 4 + Math.random() * 6;
    this.wp = 0;
    this.offenses = [];
    this.throwCD = 3;
    this.hypeCD = 30;
    this.target = null;
    this.stuckT = 0;
    this.lastPos = this.home.clone();
    this.anim = 'idle';
    this.speed = 0;
    this.throwT = 0;
    this.thrown = false;
    this.netPos = this.home.clone();
    this.netYaw = 0;
  }

  spawn(p) {
    this.char.setTransform(p, -Math.PI / 2);
    this.ctrl.teleport(p);
  }

  // something happened that the boss should yell about
  report(kind, targetId, pos = null) {
    if (this.offenses.length > 6) return;
    if (this.offenses.some((o) => o.targetId === targetId && o.kind === kind)) return;
    if (this.target && this.target.targetId === targetId && this.target.kind === kind && this.state !== 'office' && this.state !== 'patrol') return;
    this.offenses.push({ kind, targetId, pos: pos ? pos.clone() : null, t: performance.now() });
  }

  // host only: decide where to go; `people` maps id -> {pos, mode, toiletEntry}
  think(dt, people) {
    const c = this.char;
    if (c.isRagdoll) {
      if (c.ragdollT > 3 && c.ragdoll.speed() < 0.6) c.endRagdoll();
      this.ctrl.setInput(_b.set(0, 0, 0), false, false);
      return;
    }
    this.stateT -= dt;
    this.throwCD -= dt;
    this.hypeCD -= dt;
    let goal = null, speed = 1.5;
    switch (this.state) {
      case 'office':
        goal = this.home;
        if (this.stateT <= 0) { this.state = 'patrol'; this.wp = 0; }
        break;
      case 'patrol':
        goal = this.waypoints[this.wp];
        if (_a.copy(c.position).setY(0).distanceTo(_b.copy(goal).setY(0)) < 0.7) {
          this.wp = (this.wp + 1) % this.waypoints.length;
          if (this.wp === 0) { this.state = 'office'; this.stateT = 8 + Math.random() * 10; }
        }
        if (this.hypeCD <= 0) { this.hypeCD = 35 + Math.random() * 30; this.yell('hype'); }
        break;
      case 'chase': {
        const p = people.get(this.target.targetId);
        if (!p) { this.state = 'patrol'; break; }
        goal = p.mode === 'toilet' && p.toiletEntry ? p.toiletEntry : p.pos;
        speed = 2.6;
        if (_a.copy(c.position).setY(0).distanceTo(_b.copy(goal).setY(0)) < 3.6 || this.stateT <= 0) {
          this.yell(this.target.kind);
          this.state = 'yelling';
          this.stateT = 1.6;
        }
        break;
      }
      case 'yelling': {
        const p = people.get(this.target.targetId);
        if (p) this.face(p.pos, dt);
        if (this.stateT <= 0) {
          // the boss only throws for real misbehaviour (pee, farts, slacking),
          // never for a missed call: one agent cannot answer every ringing phone
          const throwable = this.target && this.target.kind !== 'missed';
          if (p && throwable && this.throwCD <= 0 && p.mode !== 'toilet' && p.mode !== 'urinal') { this.state = 'throwing'; this.stateT = 0.7; this.throwT = 0; }
          else this.state = 'patrol';
        }
        break;
      }
      case 'throwing': {
        const p = people.get(this.target.targetId);
        if (p) this.face(p.pos, dt);
        this.throwT += dt;
        if (this.throwT > 0.38 && !this.thrown && p) { this.thrown = true; this.throwAt(p); }
        if (this.stateT <= 0) { this.thrown = false; this.state = 'patrol'; this.throwCD = 12 + Math.random() * 6; }
        break;
      }
      default: this.state = 'patrol';
    }
    if ((this.state === 'patrol' || this.state === 'office') && this.offenses.length) {
      this.target = this.offenses.shift();
      if (people.has(this.target.targetId)) { this.state = 'chase'; this.stateT = 14; }
    }
    if (goal && this.state !== 'yelling' && this.state !== 'throwing') {
      _b.copy(goal).sub(c.position).setY(0);
      const d = _b.length();
      if (d > 0.4) { _b.normalize(); this.ctrl.speedMul = speed / 2.6; this.ctrl.setInput(_b, false, false); }
      else this.ctrl.setInput(_b.set(0, 0, 0), false, false);
      this.stuckT += dt;
      if (this.stuckT > 1.2) {
        if (c.position.distanceTo(this.lastPos) < 0.25 && d > 1) {
          this.wp = (this.wp + 1) % this.waypoints.length;
          if (this.state === 'chase') this.ctrl.setInput(_b.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), false, false);
        }
        this.lastPos.copy(c.position);
        this.stuckT = 0;
      }
    } else this.ctrl.setInput(_b.set(0, 0, 0), false, false);
  }

  face(p, dt) {
    const c = this.char;
    let d = Math.atan2(p.x - c.position.x, p.z - c.position.z) - c.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    c.yaw += d * Math.min(1, dt * 8);
  }

  yell(kind) {
    const L = BOSS_LINES[this.game.lang] || BOSS_LINES.en;
    this.game.bossSay(pick(L[kind] || L.hype));
  }

  throwAt(p) {
    const c = this.char;
    const from = c.position.clone().add(new THREE.Vector3(Math.sin(c.yaw) * 0.5, 2, Math.cos(c.yaw) * 0.5));
    const to = p.pos.clone().setY(p.mode === 'seated' ? 1.2 : 1);
    const T = Math.max(0.35, from.distanceTo(to) / 11);
    const v = new THREE.Vector3((to.x - from.x) / T, (to.y - from.y + 10 * T * T) / T, (to.z - from.z) / T);
    this.game.throwStapler(from, v, this.target.targetId);
  }

  update(dt, isHost) {
    const c = this.char;
    if (isHost) {
      if (!c.isRagdoll) {
        this.ctrl.renderPosition(this.game.physics.alpha, c.position);
        const sp = this.ctrl.horizontalSpeed();
        if (sp > 0.15 && this.state !== 'yelling' && this.state !== 'throwing') {
          let d = Math.atan2(this.ctrl.vel.x, this.ctrl.vel.z) - c.yaw;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          c.yaw += d * Math.min(1, dt * 8);
        }
        this.speed = sp;
        this.anim = this.state === 'yelling' ? 'yell' : this.state === 'throwing' ? 'throw' : sp > 0.2 ? 'bossWalk' : 'idle';
      }
    } else if (!c.isRagdoll) {
      c.position.lerp(this.netPos, 1 - Math.exp(-dt * 10));
      let d = this.netYaw - c.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      c.yaw += d * Math.min(1, dt * 10);
      c.body.setNextKinematicTranslation({ x: c.position.x, y: c.position.y, z: c.position.z });
    }
    c.animState.state = this.anim;
    c.animState.speed = this.speed;
    c.animState.throwT = this.throwT ? Math.min(1, this.throwT / 0.6) : 0;
    c.rig.setExpression(this.anim === 'yell' || this.anim === 'throw' ? 'angry' : 'neutral');
    if (this.anim === 'yell') { c.talking = 0.2; c.shoutT = 0.3; }
  }

  netState() {
    const p = this.char.position;
    return { p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], r: +this.char.yaw.toFixed(2), a: this.anim, s: +this.speed.toFixed(1), tt: this.throwT ? +this.throwT.toFixed(2) : 0 };
  }

  applyNet(s) {
    if (!s || !Array.isArray(s.p)) return;
    const n = (v) => (Number.isFinite(+v) ? Math.max(-40, Math.min(40, +v)) : 0);
    this.netPos.set(n(s.p[0]), n(s.p[1]), n(s.p[2]));
    this.netYaw = n(s.r);
    this.anim = ['idle', 'bossWalk', 'yell', 'throw'].includes(s.a) ? s.a : 'idle';
    this.speed = Math.max(0, Math.min(5, +s.s || 0));
    this.throwT = Math.max(0, Math.min(1, +s.tt || 0));
  }
}
