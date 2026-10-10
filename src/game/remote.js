// Another player in the office, driven by their presence: interpolated
// movement, desks (logged in under their name), toilets, urinals, the couch,
// ragdolls and their pee stream.
import * as THREE from 'three';
import { Character } from '../actors/character.js';
import { decodeLook } from '../actors/rig.js';
import { Stream } from '../fx/particles.js';
import { streamEmitter } from './player.js';

const _v = new THREE.Vector3();
const _o = new THREE.Vector3();
const _vel = new THREE.Vector3();
const COUCH = new THREE.Vector3(-11.9, 0, 9.15);
const MODES = ['walk', 'seated', 'toilet', 'urinal', 'couch', 'ragdoll'];
const STATES = ['idle', 'move', 'air', 'sit', 'couch', 'toilet', 'pee', 'potty', 'charge', 'fartpop', 'cough', 'wave', 'dance', 'drink'];
const EXPR = ['neutral', 'happy', 'sad', 'angry', 'strain', 'relief', 'sick', 'surprised'];

export function cleanName(s) {
  return String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 18);
}

const num = (v, d = 0, lim = 60) => { const n = +v; return Number.isFinite(n) ? Math.max(-lim, Math.min(lim, n)) : d; };

export class RemotePlayer {
  constructor(game, id, pr) {
    this.game = game;
    this.id = id;
    this.name = cleanName(pr.n) || 'Coworker';
    this.lookCode = String(pr.lk || '');
    this.look = decodeLook(this.lookCode);
    this.targetPos = new THREE.Vector3(...(Array.isArray(pr.p) ? pr.p.map((x) => num(x)) : [0, 0, 0]));
    this.targetYaw = num(pr.r);
    this.mode = 'walk';
    this.deskIndex = -1;
    this.toiletIndex = -1;
    this.urinalIndex = -1;
    this.tackleCD = 0;
    this.pr = pr;
    this.peeT = 0;
    this.peeSound = null;
    this.stream = new Stream(game.scene);
    this.makeChar(this.targetPos, this.targetYaw);
  }

  get color() { return this.look.shirt.color; }

  makeChar(pos, yaw) {
    if (this.char) this.char.dispose();
    this.char = new Character(this.game.scene, this.game.physics, { ...this.look, badge: this.name, badgeColor: '#8fa7ff', headset: true }, { id: this.id, async: true });
    this.char.groundHeightAt = () => 0;
    this.char.setTransform(pos, yaw);
  }

  apply(pr) {
    this.pr = pr;
    const g = this.game;
    if (pr.n) this.name = cleanName(pr.n) || this.name;
    if (pr.lk && pr.lk !== this.lookCode) {
      this.lookCode = String(pr.lk);
      this.look = decodeLook(this.lookCode);
      this.makeChar(this.char.position.clone(), this.char.yaw);
    }
    if (Array.isArray(pr.p)) this.targetPos.set(num(pr.p[0]), num(pr.p[1]), num(pr.p[2]));
    if (typeof pr.r === 'number') this.targetYaw = num(pr.r, 0, 10);
    this.mode = MODES.includes(pr.m) ? pr.m : 'walk';
    // desk: logged in under their name
    const di = Number.isInteger(pr.d) ? pr.d : -1;
    if (di !== this.deskIndex) {
      const old = g.office.desks[this.deskIndex];
      if (old && old.owner === this.id) { old.owner = null; g.props.releaseChair(old.chair); g.setDeskName(old, null); }
      this.deskIndex = di;
      const d = g.office.desks[di];
      if (d && (!d.owner || d.owner === this.id)) { d.owner = this.id; g.props.holdChair(d.chair, d.seat, d.facing); g.setDeskName(d, this.name, this.color); }
    }
    const ti = Number.isInteger(pr.ti) ? pr.ti : -1;
    if (ti !== this.toiletIndex) {
      const old = g.office.toilets[this.toiletIndex];
      if (old && old.occupant === this.id) { old.occupant = null; old.targetOpen = 1; }
      this.toiletIndex = ti;
      const s = g.office.toilets[ti];
      if (s) { s.occupant = this.id; s.targetOpen = 0; }
    }
    const ui = Number.isInteger(pr.ui) ? pr.ui : -1;
    if (ui !== this.urinalIndex) {
      const old = g.office.urinals[this.urinalIndex];
      if (old && old.occupant === this.id) old.occupant = null;
      this.urinalIndex = ui;
      const u = g.office.urinals[ui];
      if (u) u.occupant = this.id;
    }
  }

  get desk() { return this.game.office.desks[this.deskIndex] || null; }
  get onCall() { return !!(this.pr && this.pr.oc); }

  update(dt) {
    const c = this.char, pr = this.pr || {}, g = this.game;
    this.tackleCD -= dt;
    let streamOn = false, floorY = 0;
    if (this.mode === 'ragdoll') {
      if (!c.isRagdoll) c.startRagdoll({ x: 0, y: 0.5, z: 0 });
      if (Array.isArray(pr.rd) && c.ragdoll) c.ragdoll.steerTorso(_v.set(num(pr.rd[0]), num(pr.rd[1]), num(pr.rd[2])), 4, dt);
    } else {
      if (c.isRagdoll) c.endRagdoll();
      const d = this.desk, s = g.office.toilets[this.toiletIndex], u = g.office.urinals[this.urinalIndex];
      const st = c.animState;
      if (this.mode === 'seated' && d) {
        c.position.copy(d.seat);
        c.yaw = d.facing;
        st.state = 'sit';
        st.typing = !!pr.ty;
        st.talking = !!pr.oc;
        c.rig.setMicLive(!!pr.oc);
        if (pr.tk) c.talking = Math.max(c.talking, 0.15);
      } else if (this.mode === 'toilet' && s) {
        c.position.copy(s.pos); c.yaw = 0; st.state = 'toilet'; st.relief = true;
      } else if (this.mode === 'urinal' && u) {
        c.position.copy(u.pos); c.yaw = u.facing; st.state = 'pee'; st.relief = true;
        streamOn = true; floorY = 0.62;
      } else if (this.mode === 'couch') {
        c.position.copy(COUCH); c.yaw = Math.PI; st.state = 'couch';
      } else {
        if (c.position.distanceTo(this.targetPos) > 4) c.position.copy(this.targetPos);
        c.position.lerp(this.targetPos, 1 - Math.exp(-dt * 12));
        let dy = this.targetYaw - c.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        c.yaw += dy * Math.min(1, dt * 12);
        st.state = STATES.includes(pr.a) ? pr.a : 'idle';
        st.speed = num(pr.s, 0, 10);
        st.charge = num(pr.ch, 0, 1);
        st.wobble = pr.a === 'move' && !!pr.wb;
        st.relief = !!pr.pe;
        if (pr.pe) { streamOn = true; st.state = 'pee'; }
      }
      c.rig.setExpression(EXPR.includes(pr.x) ? pr.x : 'neutral');
      c.syncCapsule();
    }
    // their stream, purely cosmetic here (their own client makes the puddles)
    if (streamOn && c.rig.ready) {
      this.peeT += dt;
      streamEmitter(c, this.peeT, _o, _vel);
    }
    const land = this.stream.update(dt, streamOn && c.rig.ready, _o, _vel, floorY);
    if (streamOn && land) {
      if (!this.peeSound) this.peeSound = g.audio.pee(land, floorY > 0);
      else if (this.peeSound.move) this.peeSound.move(land);
      if (Math.random() < 0.4) g.fx.splash(land.clone().setY(floorY > 0 ? 0.64 : 0.03), '#ffe46b', 1, 0.7);
    } else if (!streamOn && this.peeSound) { this.peeSound.stop(); this.peeSound = null; }
  }

  dispose() {
    const g = this.game;
    const d = g.office.desks[this.deskIndex];
    if (d && d.owner === this.id) { d.owner = null; g.props.releaseChair(d.chair); g.setDeskName(d, null); }
    const s = g.office.toilets[this.toiletIndex];
    if (s && s.occupant === this.id) { s.occupant = null; s.targetOpen = 1; }
    const u = g.office.urinals[this.urinalIndex];
    if (u && u.occupant === this.id) u.occupant = null;
    if (this.peeSound) this.peeSound.stop();
    this.stream.dispose();
    this.char.dispose();
  }
}
