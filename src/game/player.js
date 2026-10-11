// The local player: movement, desks, toilets, urinals, peeing anywhere,
// farting, flopping and slapstick.
import * as THREE from 'three';
import { Character } from '../actors/character.js';
import { Controller } from './controller.js';
import { Stream } from '../fx/particles.js';
import { TUNE } from '../config.js';
import { t } from '../i18n.js';
import { keyLabel, settings } from '../settings.js';

const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3(), _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

// crotch position and stream velocity for this frame (shared with remotes)
export function streamEmitter(c, t, outO, outV) {
  const pel = c.rig.parts.pelvis;
  c.rig.root.updateMatrixWorld(true);
  outO.set(0, -0.1, 0.11).applyMatrix4(pel.matrixWorld);
  const yaw = c.yaw;
  const wob = Math.sin(t * 9) * 0.15;
  outV.set(Math.sin(yaw + wob * 0.3) * 1.55, 0.85 + Math.sin(t * 5.3) * 0.1, Math.cos(yaw + wob * 0.3) * 1.55);
}

export class Player {
  constructor(game, profile) {
    this.game = game;
    this.profile = profile;
    this.char = new Character(game.scene, game.physics, { ...profile.look, badge: profile.name, badgeColor: '#ff4d5e', headset: true }, { id: 'me', async: true });
    this.char.groundHeightAt = () => 0;
    this.controller = new Controller(game.physics, this.char);
    this.mode = 'walk';
    this.bladder = 0.12;
    this.gas = 0.25;
    this.charge = 0;
    this.charging = false;
    this.desk = null;
    this.toilet = null;
    this.urinal = null;
    this.toiletT = 0;
    this.emote = null;
    this.emoteT = 0;
    this.awayT = 0;
    this.speedBoost = 0;
    this.warnedBladder = false;
    this.coughT = 0;
    this.stats = { farts: 0, pees: 0, flops: 0, accidents: 0 };
    this.stepPhase = 0;
    this.ragdollMin = 0;
    this.prompt = null;
    this.target = null;
    this.stream = new Stream(game.scene);
    this.peeing = false;
    this.peeT = 0;
    this.peeFined = false;
    this.peeSound = null;
    this.peeOrigin = new THREE.Vector3();
    this.peeVel = new THREE.Vector3();
    this.char.onGetUp = (p) => { this.controller.teleport(p); this.mode = 'walk'; this.game.emitNet('up', {}); };
  }

  get position() { return this.char.position; }
  get isRagdoll() { return this.char.isRagdoll; }

  spawn(p, yaw) {
    this.char.setTransform(p, yaw);
    this.controller.teleport(p);
  }

  blocked() { return this.game.ui && this.game.ui.capturesKeys(); }

  preUpdate() {
    const g = this.game, inp = g.input, cam = g.cam;
    const busy = this.blocked();
    if (this.mode === 'walk' && !this.isRagdoll && !this.peeing) {
      const ax = busy ? { x: 0, y: 0 } : inp.axis();
      cam.basis(_f, _r);
      _w.set(0, 0, 0).addScaledVector(_f, ax.y).addScaledVector(_r, ax.x);
      if (_w.lengthSq() > 1) _w.normalize();
      const run = !busy && inp.action('run');
      const urgent = this.bladder > 0.85;
      this.controller.speedMul = (this.charging ? 0.35 : 1) * (urgent ? 0.8 : 1) * (this.speedBoost > 0 ? 1.25 : 1);
      const jump = !busy && inp.actionPressed('jump');
      this.controller.setInput(_w, run && !this.charging, jump);
      if (jump && this.controller.grounded) g.audio.boing(this.char.position);
    } else {
      this.controller.setInput(_w.set(0, 0, 0), false, false);
    }
  }

  update(dt) {
    const g = this.game, inp = g.input, c = this.char;
    const busy = this.blocked();
    // free mode: pee and gas never build up or run out, and there are no
    // accidents. Players pee and fart whenever they feel like it.
    this.bladder = 0.6;
    this.gas = 0.6;
    if (this.speedBoost > 0) this.speedBoost -= dt;
    if (this.isRagdoll) {
      this.stopPee();
      this.ragdollMin -= dt;
      const rd = c.ragdoll;
      if ((rd && rd.speed() < 0.5 && this.ragdollMin <= 0) || c.ragdollT > TUNE.ragdollMaxTime || (this.ragdollMin <= 0 && !busy && inp.actionPressed('jump'))) c.endRagdoll();
      this.updateStream(dt);
      return;
    }
    if (this.mode === 'walk') this.updateWalk(dt);
    else if (this.mode === 'seated') this.updateSeated(dt);
    else if (this.mode === 'toilet') this.updateToilet(dt);
    else if (this.mode === 'urinal') this.updateUrinal(dt);
    else if (this.mode === 'couch') this.updateCouch(dt);
    this.updateStream(dt);
    if (busy) { this.prompt = null; return; }
    // fart: hold to charge
    if (inp.actionPressed('fart')) { this.charging = true; this.charge = 0; }
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt * 0.8);
      if (this.charge > 0.3 && Math.random() < dt * 8) g.renderer.addShake(0.02);
      if (inp.actionReleased('fart') || !inp.action('fart')) { this.charging = false; this.fart(this.charge); this.charge = 0; }
    }
    if (this.mode === 'walk') {
      if (inp.actionPressed('flop')) this.flop();
      if (inp.actionPressed('wave')) { this.emote = 'wave'; this.emoteT = 2; g.emitNet('emote', { e: 'wave' }); }
      if (inp.actionPressed('dance')) { this.emote = 'dance'; this.emoteT = 4; g.emitNet('emote', { e: 'dance' }); }
    }
    // pee: hold the key
    if (inp.actionPressed('pee')) this.peeKey();
    if (this.peeing && !inp.action('pee')) this.stopPee();
    this.prompt = this.findPrompt();
    if (inp.actionPressed('use')) this.interact();
    if (this.bladder > 0.82 && !this.warnedBladder) { this.warnedBladder = true; g.toast(t('needToGo', g.lang), 'warn'); }
    if (this.bladder < 0.5) this.warnedBladder = false;
    if (this.bladder >= 1 && this.mode !== 'toilet' && this.mode !== 'urinal' && !this.peeing) this.accident();
  }

  updateWalk(dt) {
    const g = this.game, c = this.char;
    this.controller.renderPosition(g.physics.alpha, c.position);
    const sp = this.controller.horizontalSpeed();
    if (sp > 0.2 && !this.peeing) {
      let d = Math.atan2(this.controller.vel.x, this.controller.vel.z) - c.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      c.yaw += d * Math.min(1, dt * 12);
    }
    if (this.controller.grounded && sp > 0.5) {
      this.stepPhase += (sp * dt) / 0.75;
      if (this.stepPhase >= 1) { this.stepPhase -= 1; g.audio.step(c.position, (Math.random() * 2) | 0); }
    }
    if (this.controller.justLanded) g.audio.thud(c.position, 0.2);
    let st = this.controller.grounded ? (sp > 0.25 ? 'move' : 'idle') : 'air';
    if (this.peeing) st = 'pee';
    else if (this.charging) st = 'charge';
    else if (this.emoteT > 0) { this.emoteT -= dt; st = this.emote; }
    else if (st === 'idle' && this.bladder > 0.8) st = 'potty';
    else if (this.coughT > 0) { this.coughT -= dt; if (st === 'idle') st = 'cough'; }
    c.animState.state = st;
    c.animState.speed = sp;
    c.animState.vy = this.controller.vy;
    c.animState.charge = this.charge;
    c.animState.wobble = this.bladder > 0.85;
    c.animState.relief = this.peeing;
    c.rig.setExpression(this.charging ? 'strain' : this.peeing ? 'relief' : this.bladder > 0.85 ? 'sad' : this.coughT > 0 ? 'sick' : 'neutral');
    this.awayT += dt;
    if (this.awayT > 45 && !this.slackReported) { this.slackReported = true; g.emit('slacking', 'idle'); }
    if (g.puddles.at(c.position) && sp > TUNE.slipSpeed) this.slip(sp);
    if (sp > TUNE.tackleSpeed) this.checkTackle(sp);
    if (g.fx.gasAt(c.position) > 0.35 && this.coughT <= 0 && Math.random() < dt * 2) {
      this.coughT = 1.2;
      g.audio.cough(c.headWorld(_v));
      if (g.fx.gasAt(c.position, g.net.selfId) > 0.35 && Math.random() < 0.35) g.toast(t('gassed', g.lang), 'warn');
    }
  }

  updateSeated() {
    const g = this.game, c = this.char, d = this.desk;
    c.position.copy(d.seat);
    c.yaw = d.facing;
    c.animState.state = 'sit';
    const onCall = g.calls.state === 'connected';
    c.animState.typing = g.ui ? g.ui.isTyping() : false;
    c.animState.talking = onCall && !c.animState.typing;
    c.animState.noGesture = true; // keep your hands off the monitor in the over-the-shoulder view
    c.rig.setMicLive(onCall && g.mic.state === 'granted');
    c.rig.setExpression(this.charging ? 'strain' : onCall ? 'happy' : 'neutral');
    this.awayT = 0;
    this.slackReported = false;
  }

  updateToilet(dt) {
    const g = this.game, c = this.char, s = this.toilet;
    c.position.copy(s.pos);
    c.yaw = 0;
    c.animState.state = 'toilet';
    this.toiletT += dt;
    const relief = this.toiletT > 0.6 && this.toiletT < 0.6 + TUNE.peeDuration;
    c.animState.relief = relief;
    c.rig.setExpression(relief ? 'relief' : 'neutral');
    if (relief) {
      this.bladder = Math.max(0, this.bladder - dt / TUNE.peeDuration);
      this.peeSound ||= g.audio.pee(s.pos.clone().setY(0.5), true);
      if (Math.random() < 0.5) g.fx.splash(s.pos.clone().setY(0.42).add(_v.set(0, 0, 0.05)), '#ffe46b', 1, 0.6);
    } else if (this.peeSound) { this.peeSound.stop(); this.peeSound = null; }
    if (this.toiletT > 1.0 + TUNE.peeDuration) this.leaveToilet(true);
    if (this.toiletT > 40 && !this.toiletWarned) { this.toiletWarned = true; g.emit('slacking', 'toilet'); }
  }

  updateUrinal(dt) {
    const c = this.char, u = this.urinal;
    c.position.copy(u.pos);
    c.yaw = u.facing;
    c.animState.state = 'pee';
    c.animState.relief = true;
    c.rig.setExpression('relief');
    this.urinalT = (this.urinalT || 0) + dt;
    if (this.urinalT > TUNE.peeDuration) this.leaveUrinal();
  }

  updateCouch() {
    const c = this.char;
    c.position.set(-11.9, 0, 9.15);
    c.yaw = Math.PI;
    c.animState.state = 'couch';
    c.rig.setExpression('relief');
  }

  // ---- peeing ------------------------------------------------------------------------
  peeKey() {
    const g = this.game;
    if (this.isRagdoll || this.peeing) return;
    if (this.mode === 'seated' || this.mode === 'couch') { g.toast(t('standFirst', g.lang), 'info'); return; }
    if (this.mode !== 'walk') return;
    // nearest toilet / urinal first
    const near = this.nearest(['toilet', 'urinal']);
    if (near && near.kind === 'toilet' && !near.ref.occupant) { this.useToilet(near.ref); return; }
    if (near && near.kind === 'urinal' && !near.ref.occupant) { this.useUrinal(near.ref); return; }
    if (this.bladder < 0.05) { g.audio.blip(200, 0.08, 'triangle', 0.08); return; }
    this.startPee();
  }

  startPee() {
    const g = this.game;
    this.peeing = true;
    this.peeT = 0;
    this.peeFined = false;
    this.stats.pees++;
    this.controller.setInput(_w.set(0, 0, 0), false, false);
    g.emitNet('pee', { on: 1 });
  }

  stopPee() {
    if (!this.peeing) return;
    this.peeing = false;
    if (this.peeSound) { this.peeSound.stop(); this.peeSound = null; }
    this.game.emitNet('pee', { on: 0 });
  }

  peeEmitter(outO, outV) { streamEmitter(this.char, this.peeT, outO, outV); }

  updateStream(dt) {
    const g = this.game;
    let on = false, floorY = 0;
    if (this.peeing && this.mode === 'walk' && !this.isRagdoll) {
      on = this.bladder > 0.005;
      this.peeT += dt;
      this.bladder = Math.max(0, this.bladder - dt / TUNE.peeDuration);
      if (!on) this.stopPee();
    } else if (this.mode === 'urinal') {
      on = true;
      this.peeT += dt;
      floorY = 0.62;
    }
    if (on || this.stream.flow > 0.03) this.peeEmitter(this.peeOrigin, this.peeVel);
    const land = this.stream.update(dt, on, this.peeOrigin, this.peeVel, floorY);
    if (on && land) {
      if (this.mode === 'urinal') {
        this.peeSound ||= g.audio.pee(land, true);
        if (Math.random() < 0.3) g.fx.splash(land.clone().setY(0.64), '#ffe46b', 1, 0.5);
        return;
      }
      this.peeSound ||= g.audio.pee(land, false);
      this.peeSound.move(land);
      if (Math.random() < 0.6) g.fx.splash(land.clone().setY(0.03), '#ffe46b', 1, 0.9);
      // plants are happy, floors are not
      const plant = g.office.plants.find((p) => p.pos.distanceTo(_v.set(land.x, 0, land.z)) < 0.55);
      if (plant) {
        plant.watered += dt;
        if (!this.wateredToast && plant.watered > 0.6) { this.wateredToast = true; g.toast(t('plantWatered', g.lang), 'good'); }
      } else {
        g.puddles.feed(land, dt * 0.22);
        if (this.peeT > 0.5 && !this.peeFined) {
          this.peeFined = true;
          g.addMoney(-TUNE.publicPeeFine, 'hr');
          g.toast(t('peeFine', g.lang, { n: TUNE.publicPeeFine }), 'bad');
          g.emit('puddle', land.clone());
          g.emitNet('puddle', { p: [+land.x.toFixed(2), +land.z.toFixed(2)], s: 0.3 });
        }
      }
    } else if (!on) {
      this.wateredToast = false;
      if (this.peeSound && this.mode !== 'toilet') { this.peeSound.stop(); this.peeSound = null; }
    }
  }

  // ---- prompts and interactions --------------------------------------------------------
  nearest(kinds) {
    const p = this.char.position;
    let best = null, bd = 1e9;
    for (const it of this.game.office.interactables) {
      if (!kinds.includes(it.kind)) continue;
      const d = Math.hypot(it.pos.x - p.x, it.pos.z - p.z);
      if (d < it.radius && d < bd) { best = it; bd = d; }
    }
    return best;
  }

  findPrompt() {
    const g = this.game, L = g.lang;
    const use = keyLabel(settings.data.controls.bindings.use[0]);
    if (this.mode === 'seated' || this.mode === 'toilet' || this.mode === 'couch') return { key: use, label: t('stand', L) };
    if (this.mode !== 'walk' || this.peeing) return null;
    const it = this.nearest(['desk', 'toilet', 'urinal', 'water', 'coffee', 'beans', 'couch', 'plant']);
    this.target = it;
    if (!it) return null;
    switch (it.kind) {
      case 'desk': {
        const d = it.ref;
        if (d.owner && d.owner !== g.net.selfId) return { key: use, label: t('deskTaken', L), disabled: true };
        const ring = g.switchboard.ringAt(d.index);
        return { key: use, label: ring ? t('answerOnPc', L) : t('sitHere', L), hot: !!ring };
      }
      case 'toilet': return { key: use, label: it.ref.occupant ? t('occupied', L) : t('toilet', L), disabled: !!it.ref.occupant };
      case 'urinal': return { key: keyLabel(settings.data.controls.bindings.pee[0]), label: t('urinal', L), disabled: !!it.ref.occupant };
      case 'water': return { key: use, label: t('water', L) };
      case 'coffee': return { key: use, label: t('coffee', L) };
      case 'beans': return { key: use, label: t('beans', L) };
      case 'couch': return { key: use, label: L === 'es' ? 'Tirarse en el sillón' : 'Flop on the couch' };
      case 'plant': return this.bladder > 0.3 ? { key: keyLabel(settings.data.controls.bindings.pee[0]), label: L === 'es' ? 'Regar la planta' : 'Water the plant' } : null;
      default: return null;
    }
  }

  interact() {
    const g = this.game;
    if (this.mode === 'seated') { this.standUp(); return; }
    if (this.mode === 'toilet') { this.leaveToilet(false); return; }
    if (this.mode === 'couch') { this.leaveCouch(); return; }
    if (this.mode !== 'walk' || !this.target || this.peeing) return;
    const it = this.target;
    switch (it.kind) {
      case 'desk': this.sitAt(it.ref); break;
      case 'toilet': if (!it.ref.occupant) this.useToilet(it.ref); break;
      case 'urinal': if (!it.ref.occupant) this.useUrinal(it.ref); break;
      case 'water':
        this.bladder = Math.min(1, this.bladder + TUNE.bladderWaterBoost);
        this.emote = 'drink'; this.emoteT = 1.4;
        g.audio.gulp(this.char.headWorld(_v));
        break;
      case 'coffee':
        this.bladder = Math.min(1, this.bladder + TUNE.bladderCoffeeBoost);
        this.speedBoost = 25;
        this.emote = 'drink'; this.emoteT = 1.4;
        g.audio.gulp(this.char.headWorld(_v));
        break;
      case 'beans':
        this.gas = Math.min(1, this.gas + TUNE.gasBeansBoost);
        g.audio.can(this.char.headWorld(_v));
        this.emote = 'drink'; this.emoteT = 1.2;
        break;
      case 'couch': this.useCouch(); break;
      default: break;
    }
  }

  sitAt(desk) {
    const g = this.game;
    if (desk.owner && desk.owner !== g.net.selfId) return;
    this.mode = 'seated';
    this.desk = desk;
    desk.owner = g.net.selfId;
    this.controller.locked = true;
    this.controller.teleport(desk.seat);
    this.char.collider.setEnabled(false);
    g.props.holdChair(desk.chair, desk.seat, desk.facing);
    g.onSeated(desk);
  }

  standUp() {
    const g = this.game, d = this.desk;
    if (!d) return;
    this.mode = 'walk';
    const out = d.seat.clone().add(_v.set(Math.sin(d.facing + Math.PI) * 0.55, 0, Math.cos(d.facing + Math.PI) * 0.55));
    this.controller.locked = false;
    this.controller.teleport(out);
    this.char.position.copy(out);
    this.char.collider.setEnabled(true);
    g.props.releaseChair(d.chair);
    d.owner = null;
    this.desk = null;
    g.onStood(d);
  }

  useToilet(s) {
    const g = this.game;
    this.stopPee();
    this.mode = 'toilet';
    this.toilet = s;
    this.toiletT = 0;
    this.toiletWarned = false;
    s.occupant = g.net.selfId;
    s.targetOpen = 0;
    this.controller.locked = true;
    this.controller.teleport(s.pos);
    this.char.collider.setEnabled(false);
    this.stats.pees++;
    g.emitNet('toilet', { i: s.index, on: 1 });
    g.onToilet(true, s);
  }

  leaveToilet(flush) {
    const g = this.game, s = this.toilet;
    if (!s) return;
    if (this.peeSound) { this.peeSound.stop(); this.peeSound = null; }
    if (flush || this.toiletT > 1.5) g.audio.flush(s.pos.clone().setY(0.5));
    s.occupant = null;
    s.targetOpen = 1;
    this.mode = 'walk';
    this.controller.locked = false;
    this.controller.teleport(s.entry);
    this.char.position.copy(s.entry);
    this.char.yaw = 0;
    this.char.collider.setEnabled(true);
    this.toilet = null;
    g.emitNet('toilet', { i: s.index, on: 0 });
    g.onToilet(false, s);
  }

  useUrinal(u) {
    const g = this.game;
    this.stopPee();
    if (this.bladder < 0.05) { g.audio.blip(200, 0.08, 'triangle', 0.08); return; }
    this.mode = 'urinal';
    this.urinalT = 0;
    this.urinal = u;
    u.occupant = g.net.selfId;
    this.controller.locked = true;
    this.controller.teleport(u.pos);
    this.char.collider.setEnabled(false);
    this.stats.pees++;
    this.peeT = 0;
    g.emitNet('urinal', { i: u.index, on: 1 });
  }

  leaveUrinal() {
    const g = this.game, u = this.urinal;
    if (!u) return;
    if (this.peeSound) { this.peeSound.stop(); this.peeSound = null; }
    u.occupant = null;
    this.mode = 'walk';
    const out = u.pos.clone().add(_v.set(-0.5, 0, 0));
    this.controller.locked = false;
    this.controller.teleport(out);
    this.char.position.copy(out);
    this.char.collider.setEnabled(true);
    this.urinal = null;
    g.audio.flush(u.target);
    g.emitNet('urinal', { i: u.index, on: 0 });
  }

  useCouch() {
    this.mode = 'couch';
    this.controller.locked = true;
    this.char.collider.setEnabled(false);
    this.game.emitNet('couch', { on: 1 });
  }

  leaveCouch() {
    const p = new THREE.Vector3(-11.9, 0, 8.3);
    this.mode = 'walk';
    this.controller.locked = false;
    this.controller.teleport(p);
    this.char.position.copy(p);
    this.char.collider.setEnabled(true);
    this.game.emitNet('couch', { on: 0 });
  }

  // ---- slapstick -------------------------------------------------------------------------
  fart(power) {
    const g = this.game, c = this.char;
    if (this.gas < 0.08) { g.audio.blip(90, 0.12, 'sawtooth', 0.15, c.position); return; }
    const big = power > 0.3 && this.gas >= TUNE.bigFartMin;
    const p = big ? Math.min(1, power * (0.6 + this.gas * 0.6)) : Math.min(0.3, 0.12 + this.gas * 0.2);
    this.gas = Math.max(0, this.gas - (big ? 0.25 + p * 0.45 : TUNE.smallFartCost));
    this.stats.farts++;
    const fwd = _v.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const at = c.position.clone().add(new THREE.Vector3(-fwd.x * 0.22, this.mode === 'seated' ? 0.5 : 0.82, -fwd.z * 0.22));
    const dir = new THREE.Vector3(-fwd.x, 0, -fwd.z);
    g.audio.fart(at, p);
    g.fx.fartCloud(at, dir, p, g.net.selfId);
    g.emitNet('fart', { p: [at.x, at.y, at.z].map((x) => +x.toFixed(2)), d: [+dir.x.toFixed(2), +dir.z.toFixed(2)], w: +p.toFixed(2) });
    if (g.calls.state === 'connected') g.calls.addEvent(p > 0.5 ? 'an enormous, rumbling fart sound on the line' : 'a loud fart sound on the line');
    g.emit('fart', { pos: at, power: p });
    if (big && this.mode === 'walk') {
      const up = 4.5 + p * 8, fw = 2 + p * 5.5;
      this.launch({ x: fwd.x * fw, y: up, z: fwd.z * fw }, { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 6 });
      g.renderer.addShake(0.4 + p * 0.5);
    } else if (this.mode === 'walk') { this.emote = 'fartpop'; this.emoteT = 0.35; }
  }

  launch(v, spin = null, minT = TUNE.ragdollMinTime) {
    const g = this.game;
    this.stopPee();
    if (this.mode === 'seated') this.standUp();
    if (this.mode === 'toilet') this.leaveToilet(false);
    if (this.mode === 'urinal') this.leaveUrinal();
    if (this.mode === 'couch') this.leaveCouch();
    this.charging = false;
    this.char.startRagdoll(v, spin);
    this.ragdollMin = minT;
    this.mode = 'ragdoll';
    this.stats.flops++;
    g.emitNet('rag', { v: [v.x, v.y, v.z].map((x) => +x.toFixed(2)) });
  }

  flop() {
    const v = this.controller.vel;
    this.launch({ x: v.x * 0.8, y: 1.5, z: v.z * 0.8 }, { x: Math.random() - 0.5, y: 0, z: Math.random() - 0.5 }, 0.8);
    this.game.audio.whoosh(this.char.position, 0.3);
  }

  slip(speed) {
    const c = this.char;
    const f = _v.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    this.launch({ x: f.x * speed * 1.3, y: 3.2, z: f.z * speed * 1.3 }, { x: -Math.cos(c.yaw) * 9, y: 0, z: Math.sin(c.yaw) * 9 });
    this.game.fx.splash(c.position.clone().setY(0.05), '#ffe46b', 24, 2.4);
    this.game.audio.whoosh(c.position, 0.4);
    setTimeout(() => this.game.audio.thud(this.char.centerWorld(_v), 0.9), 450);
  }

  getHit(v, dizzy = true) {
    this.launch(v, { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 10 }, 1.8);
    if (dizzy) this.game.fx.addDizzy(this.char, 3.5);
    this.game.audio.thud(this.char.centerWorld(_v), 1);
    this.game.renderer.addShake(0.6);
    this.game.renderer.hitFlash(1);
  }

  checkTackle(speed) {
    const g = this.game;
    for (const r of g.remotes.values()) {
      if (r.char.isRagdoll || r.mode === 'seated' || r.mode === 'toilet') continue;
      if (r.char.position.distanceTo(this.char.position) > 0.75 || (r.tackleCD && r.tackleCD > 0)) continue;
      r.tackleCD = 2;
      const d = r.char.position.clone().sub(this.char.position).setY(0).normalize();
      const v = { x: d.x * speed * 1.4, y: 3.5, z: d.z * speed * 1.4 };
      g.emitNet('tackle', { to: r.id, v: [v.x, v.y, v.z].map((x) => +x.toFixed(2)) });
      r.char.startRagdoll(v, { x: 3, y: 0, z: 3 });
      g.audio.thud(r.char.centerWorld(_v), 1);
      g.toast(t('youTackled', g.lang, { name: r.name }), 'info');
      this.launch({ x: -d.x * 1.5, y: 2, z: -d.z * 1.5 }, null, 0.9);
      return;
    }
  }

  accident() {
    const g = this.game;
    if (this.mode === 'seated') this.standUp();
    this.bladder = 0;
    this.stats.accidents++;
    const p = this.char.position.clone();
    g.puddles.add(p, 0.9);
    g.fx.splash(p.clone().setY(0.1), '#ffe46b', 30, 1.5);
    g.emitNet('puddle', { p: [+p.x.toFixed(2), +p.z.toFixed(2)], s: 0.9 });
    g.addMoney(-TUNE.accidentFine, 'hr');
    g.toast(t('accident', g.lang), 'bad');
    this.emote = 'potty';
    this.emoteT = 1.5;
    g.emit('puddle', p);
  }

  dispose() {
    this.stopPee();
    this.stream.dispose();
    this.char.dispose();
  }
}
