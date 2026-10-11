// The game: owns the world, players, boss, phones and network, runs the
// frame loop, and choreographs sitting at a desk, logging in, and flying into
// the PC.
import * as THREE from 'three';
import { Renderer, QUALITY_PRESETS } from './engine/renderer.js';
import { Physics } from './engine/physics.js';
import { Input } from './engine/input.js';
import { FollowCamera } from './engine/camera.js';
import { Audio } from './engine/audio.js';
import { HoldMusic } from './engine/music.js';
import { buildOffice, SCREEN } from './world/office.js';
import { Props } from './world/props.js';
import { Screens } from './world/screens.js';
import { Particles } from './fx/particles.js';
import { Puddles } from './fx/puddles.js';
import { Character } from './actors/character.js';
import { pumpBuilds, setAvatarDetail } from './actors/avatar.js';
import { setMaterialQuality } from './actors/materials.js';
import { encodeLook } from './actors/rig.js';
import * as TX from './engine/textures.js';
import { Player } from './game/player.js';
import { RemotePlayer, cleanName } from './game/remote.js';
import { Boss } from './game/boss.js';
import { Calls } from './game/calls.js';
import { Switchboard } from './game/switchboard.js';
import { Net, SoloTransport } from './net/net.js';
import { Voice } from './voice/tts.js';
import { Mic, Ears } from './voice/stt.js';
import { markById, MARKS } from './ai/marks.js';
import { usage } from './ai/usage.js';
import { makeBrain } from './platform.js';
import { portrait } from './ui/portrait.js';
import { TUNE } from './config.js';
import { t } from './i18n.js';
import { settings, keyLabel } from './settings.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const num = (v, lim = 30) => { const n = +v; return Number.isFinite(n) ? Math.max(-lim, Math.min(lim, n)) : 0; };
const kb = (a) => keyLabel((settings.data.controls.bindings[a] || [])[0]);
// codes like MOON-4821 are easier to catch when read digit by digit
// typed shouting: exclamation marks or mostly CAPITALS
const isShout = (s) => { const t = String(s); const letters = (t.match(/\p{L}/gu) || []).join(''); return /!{1,}/.test(t) || (letters.length >= 4 && letters === letters.toUpperCase()); };
const speakable = (s) => String(s).replace(/\b([A-Z]{2,8})-(\d{3,5})\b/g, (_, a, d) => `${a}, ${d.split('').join(' ')}`);

export class Game {
  constructor(container, { platform, quality = 'high', lang = 'en', test = false } = {}) {
    this.container = container;
    this.platform = platform;
    this.lang = lang;
    this.test = test;
    this.qualityName = quality;
    this.time = 0;
    this.running = false;
    this.listeners = {};
    this.remotes = new Map();
    this.mode = 'boot';
    this.money = 0;
    this.shift = { n: 1, t: 0, len: TUNE.shiftSeconds, quota: TUNE.quotaBase, state: 'run', result: null };
    this.ui = null;
    this.extras = [];
    this.partial = '';
    this.micMuted = false;
    this.micLevel = 0;
    this.markSpeaking = false;
    this.pttHeld = false;
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...args) { for (const fn of this.listeners[ev] || []) { try { fn(...args); } catch (e) { console.error(e); } } }

  init() {
    const q = QUALITY_PRESETS[this.qualityName] ? this.qualityName : 'high';
    setAvatarDetail(QUALITY_PRESETS[q].avatar);
    setMaterialQuality(q);
    this.renderer = new Renderer(this.container, { quality: q, preserveDrawingBuffer: this.test });
    this.scene = this.renderer.scene;
    this.scene.background = new THREE.Color('#0d0a1f');
    this.scene.fog = new THREE.FogExp2('#120d26', 0.02);
    this.physics = new Physics();
    this.office = buildOffice(this.scene, this.physics, { lang: this.lang, reflector: this.renderer.reflector });
    this.props = new Props(this.scene, this.physics, this.office, this.lang);
    this.fx = new Particles(this.scene);
    this.puddles = new Puddles(this.scene);
    this.input = new Input(this.renderer.renderer.domElement);
    this.cam = new FollowCamera(this.renderer.camera, this.physics);
    this.audio = new Audio();
    this.music = new HoldMusic(this.audio);
    this.voice = new Voice();
    this.mic = new Mic();
    this.ears = new Ears();
    this.calls = new Calls(this);
    this.switchboard = new Switchboard(this);
    this.net = new Net(new SoloTransport());
    this.screens = new Screens(this);
    for (const d of this.office.desks) this.setDeskName(d, null);
    this.boss = new Boss(this);
    this.office.weather.rain = settings.get('graphics.rain') === false ? 0 : 1;
    this.office.weather.onThunder = (power, delay) => this.audio.thunder(power, delay);
    this.voice.onSpeaking((on) => {
      // the open mic must not hear the marks talking through the speakers
      if (on) this.ears.pause(); else setTimeout(() => { if (!this.voice.speaking) this.ears.resume(); }, 250);
    });
    this.setupHooks();
    this.spawnAmbient();
    this.mode = 'lobby';
  }

  setUI(ui) { this.ui = ui; }
  toast(s, kind = 'info') { if (this.ui) this.ui.toast(s, kind); }

  setLang(l) {
    if (l !== 'en' && l !== 'es') return;
    settings.set('lang', l);
    this.lang = l;
    for (const d of this.office.desks) if (!d.owner) this.setDeskName(d, null);
    if (this.ears.wanted) this.startEars();
    this.emit('lang', l);
  }

  setQuality(name, auto = false) {
    if (!QUALITY_PRESETS[name]) return;
    setAvatarDetail(QUALITY_PRESETS[name].avatar);
    setMaterialQuality(name);
    this.renderer.setQuality(name);
    this.qualityAuto = auto;
    if (!auto) this.qualityDone = true;
    this.emit('qualityChanged', name);
  }

  refreshBrain() { this.calls.setBrain(makeBrain(this.platform)); }

  // ---- ambient office life ------------------------------------------------------------------
  spawnAmbient() {
    const nap = new Character(this.scene, this.physics, { build: 'heavy', skin: '#b97a52', hair: 'curly', hairColor: '#1c1410', shirt: { style: 'hoodie', color: '#4dd6ff' }, hat: 'beanie', headset: false }, { capsule: false, async: true });
    nap.setTransform(new THREE.Vector3(-10.85, 0, 9.12), Math.PI);
    nap.animState = { state: 'couch', speed: 0, sleep: true };
    nap.rig.sleeping = true;
    const sip = new Character(this.scene, this.physics, { build: 'slim', fem: 1, skin: '#f4c9a3', hair: 'ponytail', hairColor: '#a33a1e', shirt: { style: 'cardigan', color: '#c78bff' }, glasses: 'round', headset: false }, { capsule: false, async: true });
    sip.setTransform(new THREE.Vector3(-13.3, 0, 4), -Math.PI / 2 + 0.4);
    sip.animState = { state: 'drink', speed: 0 };
    this.extras.push(nap, sip);
    this.napper = nap;
    this.zzzT = 3;
  }

  updateAmbient(dt) {
    for (const c of this.extras) c.update(dt);
    if (!this.napper || !this.ui) return;
    this.zzzT -= dt;
    if (this.zzzT <= 0) {
      this.zzzT = 6 + Math.random() * 6;
      if (this.renderer.camera.position.distanceTo(this.napper.position) < 12) this.ui.bubble(this.napper.headWorld(new THREE.Vector3()), '', 'Zzz...', 'coworker');
    }
  }

  // ---- hooks -----------------------------------------------------------------------------------
  setupHooks() {
    this.on('slacking', (k) => this.slack(k));
    this.on('linesDown', (code) => this.ui && this.ui.showLinesDown(code));
    this.on('playerSaid', (s) => this.playerSaid(s));
    this.on('fart', ({ pos }) => { if (this.net.isHost() && this.boss.char.position.distanceTo(pos) < 7) this.boss.report('fart', this.net.selfId, pos); });
    this.on('puddle', (p) => { if (this.net.isHost()) this.boss.report('pee', this.net.selfId, p); else this.emitNet('slack', { k: 'pee' }); });
    this.on('answer', () => { this.startEars(); if (this.ui) this.ui.hud.showHint(this.micHint(), 6); });
    this.on('callEnded', () => { this.stopEars(); this.partial = ''; });
    // caller-ID portraits are rendered ahead of time
    this.on('ring', (r) => { portrait(this.markFor(r)); });
    this.on('ring', () => {
      if (!this.firstRing && this.ui && this.me && this.me.mode !== 'seated') { this.firstRing = true; this.ui.hud.showHint(this.lang === 'es' ? '¡Suena un teléfono! Seguí el ☎ y sentate en ese escritorio.' : 'A phone is ringing! Follow the ☎ and sit at that desk.', 7); }
    });
    this.on('voucher', (code) => {
      if (this.ui && !this.ui.desktop.visible) this.ui.hud.showHint(this.lang === 'es' ? `Te pagaron con el voucher ${code}. Abrí la PC (${kb('pc')}) y cargalo en el Registro de clientes.` : `They paid with voucher ${code}. Open the PC (${kb('pc')}) and type it into Lead Registry.`, 8);
    });
  }

  micHint() {
    const L = this.lang;
    if (!this.platform.mic || this.mic.state !== 'granted') return L === 'es' ? `Abrí la PC (${kb('pc')}) para escribirle al cliente.` : `Open the PC (${kb('pc')}) to type to the customer.`;
    if (settings.get('mic.mode') === 'ptt') return t('micPttHint', L, { key: kb('talk') });
    if (settings.get('mic.mode') === 'off') return L === 'es' ? `Micrófono apagado: abrí la PC (${kb('pc')}) para escribir.` : `Mic is off: open the PC (${kb('pc')}) to type.`;
    return t('micOnHint', L);
  }

  slack(kind) {
    if (this.net.isHost()) this.boss.report(kind, this.net.selfId, this.me && this.me.position);
    else this.emitNet('slack', { k: kind });
  }

  emitNet(ev, data) { if (this.net) this.net.emit(ev, data); }

  previewLook(look) {
    if (this.preview) this.preview.dispose();
    this.preview = new Character(this.scene, this.physics, { ...look, headset: true }, { capsule: false, async: true });
    this.preview.setTransform(new THREE.Vector3(-0.2, 0, 5.4), 0.25);
    this.preview.animState.state = 'wave';
  }

  async joinShift(profile, net) {
    this.profile = profile;
    this.lookCode = encodeLook(profile.look);
    if (profile.lang) this.lang = profile.lang;
    if (this.preview) { this.preview.dispose(); this.preview = null; }
    if (net) this.net = net;
    this.setupNet();
    this.me = new Player(this, profile);
    const sp = this.office.spawnPoints[Math.floor(Math.random() * this.office.spawnPoints.length)];
    this.spawnFacingFloor(sp);
    this.mode = 'play';
    this.audio.unlock();
    if (this.mic.stream) this.mic.attach(this.audio.ctx);
    this.ambience ||= this.audio.ambience();
    if (this.ambience) this.ambience.setRain(this.office.weather.rain);
    if (settings.get('audio.musicOn') !== false) this.music.start();
    this.money = 0;
    this.shift.t = 0;
    this.shift.state = 'run';
    this.shift.quota = this.quotaFor(1, this.playerCount());
    this.refreshBrain();
    usage.resetShift();
    this.emit('joined');
  }

  // spawn looking at the cubicles, camera behind you
  spawnFacingFloor(sp) {
    const dx = 0 - sp.x, dz = 0.8 - sp.z;
    this.me.spawn(sp, Math.atan2(dx, dz));
    this.cam.setFollow();
    this.cam.yaw = Math.atan2(-dx, -dz);
    this.cam.pitch = 0.28;
  }

  setupNet() {
    const n = this.net;
    n.on('fart', (d, id) => {
      if (!Array.isArray(d.p)) return;
      const p = new THREE.Vector3(num(d.p[0]), num(d.p[1]), num(d.p[2]));
      const dir = new THREE.Vector3(d.d ? num(d.d[0], 1) : 0, 0, d.d ? num(d.d[1], 1) : 1);
      const w = Math.max(0, Math.min(1, +d.w || 0.3));
      this.fx.fartCloud(p, dir, w, id);
      this.audio.fart(p, w);
      if (n.isHost() && this.boss.char.position.distanceTo(p) < 7) this.boss.report('fart', id, p);
    });
    n.on('rag', (d, id) => {
      const r = this.remotes.get(id);
      if (r && Array.isArray(d.v)) { r.mode = 'ragdoll'; r.char.startRagdoll({ x: num(d.v[0]), y: num(d.v[1]), z: num(d.v[2]) }); }
    });
    n.on('puddle', (d, id) => {
      if (!Array.isArray(d.p)) return;
      const p = new THREE.Vector3(num(d.p[0]), 0, num(d.p[1]));
      this.puddles.add(p, Math.max(0.2, Math.min(1, +d.s || 0.6)));
      this.fx.splash(p.clone().setY(0.1), '#ffe46b', 14, 1.5);
      if (n.isHost()) this.boss.report('pee', id, p);
    });
    n.on('say', (d, id) => {
      const r = this.remotes.get(id), mk = markById(d.mk);
      if (!r || !mk || !d.tx) return;
      const at = r.desk ? r.desk.monitorWorld : r.char.headWorld(new THREE.Vector3());
      const dist = this.listenerPos().distanceTo(at);
      const tx = String(d.tx).slice(0, 220);
      if (this.ui) this.ui.bubble(at.clone(), mk.name, tx, 'mark');
      // you only hear other people's calls when you are close to their desk
      if (dist < 9) this.voice.speak(speakable(tx), { id: mk.id, lang: this.lang, gender: mk.voice.gender, pitch: mk.voice.pitch, rate: mk.voice.rate, style: mk.voice.style, volume: Math.max(0.05, 1 - dist / 9) * 0.75, priority: 1 });
    });
    n.on('me', (d, id) => {
      const r = this.remotes.get(id);
      if (!r || !d.tx) return;
      const tx = String(d.tx).slice(0, 220);
      if (this.ui) this.ui.bubble(r.char.headWorld(new THREE.Vector3()), r.name, tx, 'coworker');
      const dist = this.listenerPos().distanceTo(r.char.position);
      if (dist < 7 && settings.get('voices.coworkers') !== false) this.voice.speak(tx, { id: 'cw-' + id, lang: this.lang, gender: r.look.fem ? 'female' : 'male', volume: Math.max(0.05, 1 - dist / 7) * 0.6, priority: 0 });
      r.char.talking = Math.min(4, tx.length / 14);
      if (isShout(tx)) r.char.shoutT = r.char.talking;
    });
    n.on('tackle', (d, id) => {
      if (d.to !== n.selfId || !this.me || !Array.isArray(d.v)) return;
      this.me.getHit({ x: num(d.v[0]), y: num(d.v[1]), z: num(d.v[2]) }, false);
      const r = this.remotes.get(id);
      this.toast(t('tackled', this.lang, { name: r ? r.name : '?' }), 'warn');
    });
    n.on('slack', (d, id) => { if (n.isHost()) this.boss.report(['idle', 'toilet', 'pee', 'missed', 'slacking'].includes(d.k) ? d.k : 'idle', id); });
    n.on('boss', (d, id) => { if (!n.isHost() && id === n.hostId() && d.tx) this.showBossLine(String(d.tx).slice(0, 160)); });
    n.on('throw', (d, id) => {
      if (n.isHost() || id !== n.hostId() || !Array.isArray(d.f) || !Array.isArray(d.v)) return;
      const f = new THREE.Vector3(num(d.f[0]), num(d.f[1]), num(d.f[2]));
      const v = new THREE.Vector3(num(d.v[0]), num(d.v[1]), num(d.v[2]));
      const s = this.props.spawnStapler(f, v);
      s.target = d.to;
      this.audio.whoosh(f, 0.4);
    });
    n.on('money', (d, id) => {
      const r = this.remotes.get(id);
      if (!r) return;
      const at = r.desk ? r.desk.monitorWorld : r.char.position;
      const amt = +d.n || 0;
      if (amt > 0) { this.audio.chaching(at); this.fx.moneyBurst(at.clone(), Math.min(1000, amt)); }
    });
    n.on('take', (d, id) => { if (n.isHost() && typeof d.id === 'string') this.switchboard.take(d.id.slice(0, 8), id); });
    n.on('missed', (d, id) => { if (!n.isHost() && id === n.hostId()) this.toast(t('missedCall', this.lang), 'warn'); });
    n.on('next', () => { if (n.isHost() && this.shift.state === 'end') this.startNextShift(); });
    n.on('end', (d, id) => { if (!n.isHost() && id === n.hostId()) this.onShiftEnd(d.r === 'promoted' ? 'promoted' : 'fired'); });
    n.on('newshift', (d, id) => { if (!n.isHost() && id === n.hostId()) this.resetForShift(Math.max(1, +d.n | 0 || 1), +d.q || TUNE.quotaBase); });
  }

  listenerPos() { return this.renderer.camera.position; }

  // ---- voices ------------------------------------------------------------------------------
  speakMark(mark, text) {
    const spoken = speakable(text);
    const onstart = () => { this.markSpeaking = true; };
    const onend = () => { this.markSpeaking = false; };
    this.voice.speak(spoken, {
      id: mark.id, lang: this.lang, gender: mark.voice.gender, pitch: mark.voice.pitch, rate: mark.voice.rate, style: mark.voice.style, priority: 2,
      onstart, onend,
    });
    if (this.ui) this.ui.subtitle(mark.name, text, 'mark');
    this.emitNet('say', { mk: mark.id, tx: String(text).slice(0, 200) });
  }

  playerSaid(text) {
    this.emitNet('me', { tx: String(text).slice(0, 200) });
    if (this.me) { this.me.char.talking = Math.min(4, text.length / 14); if (isShout(text)) this.me.char.shoutT = Math.min(4, text.length / 14); }
  }

  bossSay(text) {
    this.showBossLine(text);
    this.emitNet('boss', { tx: text });
    if (this.me && this.calls.state === 'connected' && this.boss.char.position.distanceTo(this.me.position) < 8) this.calls.addEvent('a furious boss yelling in the background');
  }

  showBossLine(text) {
    const d = this.listenerPos().distanceTo(this.boss.char.position);
    this.voice.speak(text, { id: 'boss', lang: this.lang, gender: 'male', pitch: 0.6, rate: 1.05, style: 'gruff', volume: Math.max(0.25, 1 - d / 24), priority: 1 });
    this.boss.char.talking = 2;
    if (this.ui) {
      this.ui.subtitle(t('boss', this.lang), text, 'boss');
      this.ui.bubble(this.boss.char.headWorld(new THREE.Vector3()).add(_v.set(0, 0.4, 0)), t('boss', this.lang), text, 'boss');
    }
  }

  // ---- microphone ------------------------------------------------------------------------------
  micReady() { return this.platform.mic && this.mic.state === 'granted' && this.ears.supported && !this.ears.denied; }

  startEars() {
    if (!this.micReady() || this.micMuted || this.calls.state !== 'connected') return;
    const mode = settings.get('mic.mode');
    if (mode === 'off') return;
    if (mode === 'ptt' && !this.pttHeld) return;
    this.ears.start(this.lang, {
      onPartial: (s) => { this.partial = s; },
      onSend: (s) => { this.partial = ''; if (this.calls.state === 'connected') this.calls.queue(s); },
      onError: (e) => { if (e === 'not-allowed' || e === 'service-not-allowed') this.toast(t('micDenied', this.lang), 'warn'); },
    });
    if (this.voice.speaking) this.ears.pause();
  }

  stopEars(send = false) { this.ears.stop(send); if (!send) this.partial = ''; }

  onMicSettings() { this.stopEars(); this.startEars(); }

  toggleMicMute() {
    this.micMuted = !this.micMuted;
    if (this.micMuted) this.stopEars(); else this.startEars();
    this.toast(this.micMuted ? t('mutedMic', this.lang) : t('liveMic', this.lang), 'info');
  }

  // push-to-talk (key or the mic button). Open mic is always live: the button
  // is only a status light, and tapping it just re-checks the permission.
  micPress() {
    if (!this.micReady()) { if (this.ui) this.ui.micButton(); return; }
    if (settings.get('mic.mode') !== 'ptt') { this.startEars(); return; }
    this.pttHeld = true;
    this.voice.cancel();
    this.startEars();
  }

  micRelease() {
    if (!this.pttHeld) return;
    this.pttHeld = false;
    this.stopEars(true);
  }

  micStatus() {
    const L = this.lang;
    if (!this.platform.mic) return { kind: 'none', level: 0, text: t('typeHere', L) };
    if (this.mic.state === 'denied' || this.ears.denied) return { kind: 'denied', level: 0, text: t('micDenied', L) };
    if (this.mic.state !== 'granted') return { kind: 'off', level: 0, text: t('micAsk', L) };
    const mode = settings.get('mic.mode');
    if (mode === 'off' || this.micMuted) return { kind: 'off', level: 0, text: t('mutedMic', L) };
    const c = this.calls.call;
    if (this.markSpeaking && c) return { kind: 'paused', level: 0, text: (L === 'es' ? `${c.mark.name.split(' ')[0]} está hablando…` : `${c.mark.name.split(' ')[0]} is talking…`) };
    if (this.calls.busy && c) return { kind: 'busy', level: this.micLevel, text: this.partial || `${c.mark.name.split(' ')[0]} ${t('thinking', L)}` };
    if (mode === 'ptt' && !this.pttHeld) return { kind: 'ptt', level: 0, text: t('micPttHint', L, { key: kb('talk') }) };
    return { kind: 'listening', level: this.micLevel, text: this.partial || t('listening', L) };
  }

  // ---- money, desks -------------------------------------------------------------------------
  addMoney(n, reason) {
    this.money += n;
    const at = this.me && this.me.desk ? this.me.desk.monitorWorld : this.me ? this.me.position : null;
    if (n > 0) { this.audio.chaching(at); if (at) this.fx.moneyBurst(at.clone(), n); this.audio.flaps(12); } else this.audio.uiError();
    this.emitNet('money', { n, r: reason });
    if (this.ui) this.ui.moneyPop(n);
  }

  teamMoney() {
    let m = this.money;
    for (const p of this.net.peers()) if (p.presence.sn === this.shift.n && typeof p.presence.mo === 'number') m += Math.max(-5000, Math.min(50000, p.presence.mo));
    return m;
  }

  playerCount() { return 1 + this.net.peers().length; }

  setDeskName(d, name, color) {
    const tex = TX.nameplate(name || (this.lang === 'es' ? 'LIBRE' : 'VACANT'), name ? color || '#ffd84d' : '#5a527a');
    const m = d.nameplate.material;
    if (m.map) m.map.dispose();
    m.map = tex;
    m.needsUpdate = true;
  }

  markFor(ring) { return markById(ring.mk) || MARKS[0]; }

  get isSeated() { return !!(this.me && this.me.mode === 'seated'); }

  // over the left shoulder, close enough to read the monitor
  seatView(d) {
    const left = _w.set(Math.cos(d.facing), 0, -Math.sin(d.facing));
    const pos = d.screenCenter.clone().addScaledVector(d.screenNormal, 1.22).addScaledVector(left, 0.66).setY(1.5);
    const look = d.screenCenter.clone().addScaledVector(left, 0.05).setY(SCREEN.y - 0.02);
    return { pos, look, fov: 42 };
  }

  // straight at the screen so it fills the view
  pcView(d) {
    const cam = this.renderer.camera;
    const fov = 30;
    const tanh = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const dist = Math.max((SCREEN.planeH / 2) / tanh, (SCREEN.planeW / 2) / (tanh * cam.aspect)) * 1.0;
    return { pos: d.screenCenter.clone().addScaledVector(d.screenNormal, dist), look: d.screenCenter.clone(), fov };
  }

  onSeated(d) {
    this.setDeskName(d, this.profile.name, this.profile.look.shirt.color);
    this.screens.startLogin(d);
    const v = this.seatView(d);
    this.cam.flyTo(v.pos, v.look, { duration: 0.9, fov: v.fov });
    this.renderer.setFocus(true, v.pos.distanceTo(v.look));
    this.music.setPhoneMode(false);
    this.input.exitLock();
  }

  onLoggedIn(d) {
    if (!this.me || this.me.desk !== d) return;
    this.audio.login();
    if (this.calls.state === 'hold') { this.calls.resume(); this.startEars(); }
    this.toast(t('welcomeUser', this.lang, { name: this.profile.name }), 'info');
  }

  onStood(d) {
    this.setDeskName(d, null);
    if (this.ui && this.ui.desktop.active) { this.ui.desktop.finishLeave(); }
    this.me.char.setVisible(true);
    this.screens.login = null;
    if (this.calls.state === 'connected') { this.calls.hold(); this.stopEars(); this.music.setPhoneMode(true); }
    this.cam.setFollow();
    this.renderer.setFocus(false);
  }

  onToilet(on, s) {
    if (on) this.cam.setFixed(s.entry.clone().add(_v.set(0.9, 1.7, 2.4)), s.pos.clone().setY(1.1));
    else { this.cam.setFollow(); this.cam.yaw = Math.PI; }
  }

  answerAtMyDesk() {
    const me = this.me;
    if (!me || !me.desk || this.screens.loggingIn || this.calls.state !== 'idle') return false;
    const ring = this.switchboard.ringAt(me.desk.index);
    if (!ring) return false;
    if (this.calls.linesDown) { if (this.ui) this.ui.showLinesDown(); return false; }
    this.switchboard.pickUp(ring);
    return this.calls.answer(ring);
  }

  openPC() {
    const me = this.me, ui = this.ui;
    if (!me || !me.desk || !ui || ui.desktop.active || this.screens.loggingIn) return;
    const v = this.pcView(me.desk);
    ui.desktop.beginEnter();
    this.audio.whoosh(null, 0.25);
    this.cam.flyTo(v.pos, v.look, { duration: 0.8, fov: v.fov, onDone: () => { ui.desktop.settle(); this.renderer.setFocus(false); } });
  }

  closePC(after = null) {
    const me = this.me, ui = this.ui;
    if (!ui || !ui.desktop.active || !me || !me.desk) { if (ui && ui.desktop.active) ui.desktop.finishLeave(); if (after) after(); return; }
    if (ui.desktop.phase === 'leaving') return;
    const v = this.seatView(me.desk);
    ui.desktop.beginLeave();
    this.renderer.setFocus(true, v.pos.distanceTo(v.look));
    this.cam.flyTo(v.pos, v.look, { duration: 0.65, fov: v.fov, onDone: () => { ui.desktop.finishLeave(); me.char.setVisible(true); if (after) after(); } });
  }

  // keep the projected desktop glued to the monitor during the camera move
  updatePCMapping() {
    const ui = this.ui;
    if (!ui || !this.me || !this.me.desk) return;
    const dk = ui.desktop;
    if (dk.phase !== 'entering' && dk.phase !== 'leaving') return;
    const cam = this.renderer.camera;
    cam.updateMatrixWorld();
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const pts = this.me.desk.screenCorners.map((c) => {
      _v.copy(c).project(cam);
      return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h, z: _v.z };
    });
    if (pts.some((p) => p.z > 1)) return;
    const k = this.cam.shotProgress;
    const fade = dk.phase === 'entering' ? Math.min(1, k * 2.2) : Math.max(0, 1 - Math.max(0, k - 0.35) / 0.65);
    dk.mapTo(pts, fade);
    // the camera ends up where your head is: hide yourself while at the PC
    this.me.char.setVisible(dk.phase === 'entering' ? k < 0.35 : k > 0.5);
  }

  screenState(d) {
    const ring = this.switchboard.ringAt(d.index);
    const st = this.calls.state === 'idle' && ring ? 'ringing' : this.calls.state;
    const ms = this.micStatus();
    const c = this.shiftClock;
    return {
      state: st, call: this.calls.call, mark: ring ? this.markFor(ring) : null, name: this.profile.name, color: this.profile.look.shirt.color,
      clock: c ? `${c.h % 12 || 12}:${String(c.m).padStart(2, '0')}` : '', mic: ms.kind === 'listening', speaking: this.markSpeaking,
      listening: ms.kind === 'listening', level: this.micLevel, partial: this.partial, busy: this.calls.busy, vouchers: this.calls.openVouchers.length,
      linesDown: this.calls.linesDown, keys: { pc: kb('pc'), hangup: kb('hangup'), use: kb('use') },
    };
  }

  // ---- staplers ------------------------------------------------------------------------------
  throwStapler(from, v, target) {
    const s = this.props.spawnStapler(from, v);
    s.target = target;
    this.audio.whoosh(from, 0.4);
    this.emitNet('throw', { f: from.toArray().map((x) => +x.toFixed(2)), v: v.toArray().map((x) => +x.toFixed(2)), to: target });
  }

  updateStaplers() {
    const me = this.me;
    if (!me) return;
    for (const s of this.props.staplers) {
      if (!s.armed) continue;
      const p = s.body.translation(), lv = s.body.linvel();
      if (Math.hypot(lv.x, lv.y, lv.z) < 2) { s.armed = false; continue; }
      if (me.isRagdoll || me.mode === 'toilet' || me.mode === 'urinal') continue;
      const c = me.char.centerWorld(_v);
      const dy = Math.max(0, Math.abs(p.y - c.y) - 0.45);
      if (Math.hypot(p.x - c.x, dy, p.z - c.z) < 0.5) {
        s.armed = false;
        if (this.ui && this.ui.desktop.active) this.closePC();
        me.getHit({ x: lv.x * 0.6, y: 3 + Math.abs(lv.y) * 0.2, z: lv.z * 0.6 });
        this.toast(t('gotHit', this.lang), 'bad');
        if (this.calls.state === 'connected') this.calls.addEvent('a loud bonk and a yelp on the line');
      }
    }
  }

  // ---- frame loop -------------------------------------------------------------------------------
  start() {
    this.running = true;
    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      try { this.frame(); } catch (e) { console.error(e); }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  frame(fixedDt) {
    const now = performance.now();
    const dt = fixedDt ?? Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.time += dt;
    // your own avatar first, everyone else a few milliseconds per frame
    pumpBuilds(this.mode === 'lobby' ? 10 : this.me && !this.me.char.rig.ready ? 14 : 3.5);
    this.update(dt);
    // the full-screen PC covers everything: skip most 3D frames
    const covered = this.ui && this.ui.desktop.visible;
    this.coverT = covered ? (this.coverT || 0) + dt : 0;
    if (!covered || this.coverT < 0.3 || Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4)) this.renderer.render(dt);
    this.input.endFrame();
  }

  update(dt) {
    const inp = this.input;
    inp.pollGamepad(dt);
    if (this.mode === 'lobby') { this.updateLobby(dt); return; }
    const me = this.me;
    const busy = this.ui && this.ui.capturesKeys();
    const looking = !busy && !this.isSeated && (inp.locked || inp.dragging);
    if (looking) this.cam.look(inp.mouseDX, inp.mouseDY);
    if (!busy && inp.wheel && !this.isSeated) this.cam.zoom(inp.wheel);
    if (me) me.preUpdate(dt);
    // seated controls: answer, PC, hang up, push-to-talk
    if (me && me.mode === 'seated' && !busy && this.mode === 'play') {
      if (inp.actionPressed('pc')) { if (!this.answerAtMyDesk()) this.openPC(); }
      if (inp.actionPressed('hangup')) this.calls.hangUp();
    }
    if (me && this.calls.state === 'connected' && settings.get('mic.mode') === 'ptt' && !(this.ui && this.ui.desktop.isTyping())) {
      if (inp.actionPressed('talk')) this.micPress();
      if (inp.actionReleased('talk')) this.micRelease();
    }
    const host = this.net.isHost();
    if (host && this.mode === 'play') this.boss.think(dt, this.bossView());
    this.physics.step(dt, (fdt) => {
      if (me) me.controller.fixedUpdate(fdt);
      if (host) this.boss.ctrl.fixedUpdate(fdt);
      for (const r of this.remotes.values()) r.char.syncCapsule();
    });
    if (me) me.update(dt);
    this.boss.update(dt, host);
    this.updateRemotes();
    this.updateStaplers();
    this.props.update(dt);
    this.fx.update(dt);
    this.puddles.update(dt);
    // greed: head swells + reddens with earnings (applied while talking)
    const quota = Math.max(400, this.shift.quota || 1400);
    const greedOf = (m) => Math.max(0, Math.min(1, (m || 0) / (quota * 0.45)));
    if (me) {
      // your avatar's mouth follows your real voice on a call
      const ms = this.micReady() && this.calls.state === 'connected';
      this.micLevel = ms ? this.mic.sample() : this.micLevel * 0.8;
      me.char.speechLevel = ms && this.ears.listening && !this.ears.gated ? this.micLevel : -1;
      if (me.char.speechLevel > 0.6) me.char.shoutT = 0.35; // yelling into the mic
      me.char.greedBase = greedOf(this.money);
      me.char.update(dt);
    }
    this.boss.char.update(dt);
    for (const r of this.remotes.values()) { r.char.greedBase = greedOf(r.pr && r.pr.mo); r.update(dt); r.char.update(dt); }
    this.updateAmbient(dt);
    this.calls.update(dt);
    this.switchboard.update(dt);
    this.updateShift(dt);
    this.publish();
    this.net.update(dt);
    this.updateCamera(dt);
    this.updatePCMapping();
    this.screens.update(dt);
    this.office.update(this.time, dt, this.renderer.camera);
    this.audio.setListener(this.renderer.camera);
    if (this.ambience) this.ambience.setRain(this.office.weather.rain);
    if (this.ui) this.ui.update(dt);
    this.autoQuality(dt);
  }

  autoQuality(dt) {
    if (!this.qualityAuto || this.qualityDone || this.test) return;
    this.perf ||= { t: 0, frames: 0, sum: 0 };
    const p = this.perf;
    p.t += dt;
    if (p.t < 2) return;
    p.frames++;
    p.sum += dt;
    if (p.t < 5) return;
    const avg = p.sum / Math.max(1, p.frames);
    const order = ['ultra', 'high', 'medium', 'low'];
    const i = order.indexOf(this.renderer.qualityName);
    if (avg > 1 / 38 && i < order.length - 1) {
      this.setQuality(order[i + 1], true);
      this.perf = { t: 0.5, frames: 0, sum: 0 };
    } else this.qualityDone = true;
  }

  updateLobby(dt) {
    this.autoQuality(dt);
    const k = this.time * 0.05, cam = this.renderer.camera;
    cam.position.set(1.4 + Math.sin(k) * 0.5, 1.75, 8.2 + Math.cos(k) * 0.3);
    cam.lookAt(-1.4, 1.25, 3);
    if (this.preview) this.preview.update(dt);
    this.updateAmbient(dt);
    this.physics.step(dt);
    this.props.update(dt);
    this.fx.update(dt);
    this.boss.char.update(dt);
    this.office.update(this.time, dt, cam);
    this.screens.update(dt);
  }

  bossView() {
    const m = new Map();
    const me = this.me;
    if (me) m.set(this.net.selfId, { pos: me.isRagdoll ? me.char.centerWorld(new THREE.Vector3()) : me.position, mode: me.isRagdoll ? 'ragdoll' : me.mode, toiletEntry: me.toilet ? me.toilet.entry : null });
    for (const r of this.remotes.values()) {
      const s = this.office.toilets[r.toiletIndex];
      m.set(r.id, { pos: r.char.position, mode: r.mode, toiletEntry: s ? s.entry : null });
    }
    return m;
  }

  updateRemotes() {
    const seen = new Set();
    for (const p of this.net.peers()) {
      seen.add(p.id);
      let r = this.remotes.get(p.id);
      if (!r) {
        r = new RemotePlayer(this, p.id, p.presence);
        this.remotes.set(p.id, r);
        if (this.ui) this.ui.addNameTag(r);
        this.toast(`${cleanName(p.presence.n) || 'Coworker'} ${this.lang === 'es' ? 'fichó entrada' : 'clocked in'}`, 'info');
      }
      if (r.pr !== p.presence) r.apply(p.presence);
    }
    for (const [id, r] of this.remotes) if (!seen.has(id)) { if (this.ui) this.ui.removeNameTag(r); r.dispose(); this.remotes.delete(id); }
    if (!this.net.isHost()) { const hp = this.net.hostPresence(); if (hp && hp.boss) this.boss.applyNet(hp.boss); }
  }

  updateCamera(dt) {
    const me = this.me;
    if (!me) return;
    if (this.mode === 'ending' && this.endingCam) {
      const c = me.char.centerWorld(_v);
      this.cam.setFollow();
      this.cam.update(dt, c.setY(Math.max(-40, c.y - 0.9)), { pivotHeight: 1, snappy: true });
      return;
    }
    let target = me.position;
    const o = { sprint: me.controller.run && me.controller.horizontalSpeed() > TUNE.walkSpeed + 0.5 };
    if (me.isRagdoll) { target = me.char.centerWorld(_v).clone(); target.y = Math.max(0, target.y - 0.9); o.snappy = true; }
    this.cam.update(dt, target, o);
  }

  publish() {
    const me = this.me;
    if (!me) return;
    const c = me.char;
    const p = me.isRagdoll ? c.centerWorld(_v) : c.position;
    const st = {
      n: this.profile.name, lk: this.lookCode,
      p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], r: +c.yaw.toFixed(2),
      a: c.animState.state, s: +(c.animState.speed || 0).toFixed(1),
      m: me.isRagdoll ? 'ragdoll' : me.mode,
      d: me.desk ? me.desk.index : -1, ti: me.toilet ? me.toilet.index : -1, ui: me.urinal ? me.urinal.index : -1,
      rd: me.isRagdoll ? [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] : null,
      oc: +(this.calls.state === 'connected'), ty: +!!c.animState.typing, x: c.rig.expression,
      ch: +(me.charge || 0).toFixed(2), pe: +!!me.peeing, wb: +(me.bladder > 0.85),
      tk: c.speechLevel > 0.15 ? (c.shoutT > 0 ? 2 : 1) : 0,
      mo: Math.round(this.money), sn: this.shift.n,
      st: [this.calls.stats.closed, me.stats.farts, me.stats.pees, me.stats.flops],
    };
    if (this.net.isHost()) {
      st.boss = this.boss.netState();
      st.sh = { n: this.shift.n, t: Math.round(this.shift.t), len: this.shift.len, q: this.shift.quota, st: this.shift.state, r: this.shift.result };
      st.rn = this.switchboard.netState();
    } else { st.boss = null; st.sh = null; st.rn = null; }
    this.net.set(st);
  }

  // ---- the shift ----------------------------------------------------------------------------
  updateShift(dt) {
    const s = this.shift;
    if (this.net.isHost()) {
      if (s.state === 'run' && this.mode === 'play') {
        s.t += dt;
        const q = this.quotaFor(s.n, this.playerCount());
        if (q > s.quota) s.quota = q;
        if (s.t >= s.len) {
          s.state = 'end';
          s.result = this.teamMoney() >= s.quota ? 'promoted' : 'fired';
          this.emitNet('end', { r: s.result });
          this.onShiftEnd(s.result);
        }
      }
    } else {
      const hp = this.net.hostPresence();
      if (hp && hp.sh) {
        if (hp.sh.n !== s.n) this.resetForShift(hp.sh.n, hp.sh.q);
        if (s.state === 'run') s.t += dt + (num(hp.sh.t, 1e5) - s.t) * Math.min(1, dt * 2);
        s.len = num(hp.sh.len, 1e5) || s.len;
        s.quota = num(hp.sh.q, 1e7) || s.quota;
        if (hp.sh.st === 'end' && s.state !== 'end') this.onShiftEnd(hp.sh.r === 'promoted' ? 'promoted' : 'fired');
      } else if (s.state === 'run') s.t += dt;
    }
    const k = Math.min(1, s.t / s.len);
    const mins = 1380 + k * 6 * 60;
    this.office.setClock(Math.floor(mins / 60) % 24, Math.floor(mins % 60), Math.floor((k * 6 * 3600) % 60));
    this.shiftClock = { h: Math.floor(mins / 60) % 24, m: Math.floor(mins % 60) };
  }

  quotaFor(n, players) { return Math.round(((TUNE.quotaBase + TUNE.quotaPerExtraPlayer * (players - 1)) * TUNE.quotaGrowth ** (n - 1)) / 50) * 50; }

  onMissedCall(deskIndex, who) {
    const d = this.office.desks[deskIndex];
    if (who) this.boss.report('missed', who, d ? d.seat : null);
    this.toast(t('missedCall', this.lang), 'warn');
  }

  onShiftEnd(result) {
    if (this.mode === 'ending') return;
    this.shift.state = 'end';
    this.shift.result = result;
    this.mode = 'ending';
    const me = this.me;
    if (this.ui && this.ui.desktop.active) this.ui.desktop.finishLeave();
    if (me.mode === 'seated') me.standUp();
    if (me.mode === 'toilet') me.leaveToilet(true);
    if (me.mode === 'urinal') me.leaveUrinal();
    if (me.mode === 'couch') me.leaveCouch();
    me.stopPee();
    if (this.calls.call && this.calls.active) this.calls.endCall('me');
    this.calls.state = 'idle';
    this.switchboard.reset();
    if (this.net.isHost()) this.boss.yell(result === 'promoted' ? 'promoted' : 'fired');
    if (result === 'promoted') {
      this.fx.confettiRain(new THREE.Vector3(0, 0, 1), 9, 380);
      me.emote = 'dance';
      me.emoteT = 6;
      setTimeout(() => this.ui && this.ui.showEnd(result), 2600);
    } else {
      setTimeout(() => {
        this.office.breakWindows();
        this.audio.glass(new THREE.Vector3(me.position.x, 2, -9.8));
        this.fx.glassBurst(new THREE.Vector3(me.position.x, 1.5, -9.8), new THREE.Vector3(0, 0, -1));
        const dir = new THREE.Vector3(THREE.MathUtils.clamp(me.position.x, -7, 13), 0, -14).sub(me.position).setY(0).normalize();
        me.launch({ x: dir.x * 15, y: 9, z: dir.z * 15 }, { x: 6, y: 2, z: 4 }, 99);
        this.endingCam = true;
      }, 1800);
      setTimeout(() => this.ui && this.ui.showEnd(result), 4600);
    }
  }

  requestNextShift() { if (this.net.isHost()) this.startNextShift(); else this.emitNet('next', {}); }

  startNextShift() {
    const n = this.shift.result === 'promoted' ? this.shift.n + 1 : this.shift.n;
    const q = this.quotaFor(n, this.playerCount());
    this.resetForShift(n, q);
    this.emitNet('newshift', { n, q });
  }

  resetForShift(n, q) {
    this.shift = { n, t: 0, len: TUNE.shiftSeconds, quota: q, state: 'run', result: null };
    this.money = 0;
    this.mode = 'play';
    this.endingCam = false;
    this.office.repairWindows();
    const me = this.me;
    if (me.isRagdoll) me.char.endRagdoll(true);
    const sp = this.office.spawnPoints[Math.floor(Math.random() * this.office.spawnPoints.length)];
    this.spawnFacingFloor(sp);
    me.mode = 'walk';
    me.controller.locked = false;
    me.char.collider.setEnabled(true);
    me.bladder = 0.12;
    me.gas = 0.25;
    me.emoteT = 0;
    this.calls.reset();
    this.switchboard.reset();
    usage.resetShift();
    if (this.ui) this.ui.hideEnd();
  }
}
