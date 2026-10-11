// Synthesized sound effects (no audio files): 3D positional one-shots, loops,
// and separate buses for effects, music and ambience.
import * as THREE from 'three';
import { settings } from '../settings.js';

const _f = new THREE.Vector3();
const _u = new THREE.Vector3();

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.ducked = false; // on a live call: room noise and music step back
    settings.onChange((p) => { if (p.startsWith('audio.')) this.applyVolumes(); });
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = new AC({ latencyHint: 'interactive' });
    this.ctx = c;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.master.connect(this.comp).connect(c.destination);
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(1.4, 2.6);
    this.reverbGain = c.createGain();
    this.reverbGain.gain.value = 0.22;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.sfx = c.createGain();
    this.sfx.connect(this.master);
    this.sfx.connect(this.reverb);
    this.musicBus = c.createGain();
    this.musicBus.connect(this.master);
    this.ambBus = c.createGain();
    this.ambBus.connect(this.master);
    this.noise = this.makeNoise(2);
    this.brown = this.makeBrown(3);
    this.ready = true;
    this.applyVolumes();
  }

  applyVolumes(tau = 0.03) {
    if (!this.ready) return;
    const a = settings.data.audio;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : a.master, t, 0.03);
    this.sfx.gain.setTargetAtTime(a.sfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(a.music * 0.7 * (this.ducked ? 0.5 : 1), t, tau);
    this.ambBus.gain.setTargetAtTime(a.ambience * (this.ducked ? 0.3 : 1), t, tau);
  }

  // rain, HVAC and music duck under a call so the voices (and the open mic) stay clear
  setDuck(on) {
    if (this.ducked === on) return;
    this.ducked = on;
    this.applyVolumes(0.35);
  }

  get volume() { return settings.data.audio.master; }
  setVolume(v) { settings.set('audio.master', v); }
  setMuted(m) { this.muted = m; this.applyVolumes(); }

  impulse(sec, decay) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * sec);
    const b = this.ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decay;
    }
    return b;
  }

  makeNoise(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  makeBrown(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return b;
  }

  noiseSrc(loop = false, brown = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = brown ? this.brown : this.noise;
    s.loop = loop;
    return s;
  }

  setListener(camera) {
    if (!this.ready) return;
    const l = this.ctx.listener;
    camera.getWorldDirection(_f);
    _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const p = camera.position, t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.02); l.positionY.setTargetAtTime(p.y, t, 0.02); l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(_f.x, t, 0.02); l.forwardY.setTargetAtTime(_f.y, t, 0.02); l.forwardZ.setTargetAtTime(_f.z, t, 0.02);
      l.upX.setTargetAtTime(_u.x, t, 0.02); l.upY.setTargetAtTime(_u.y, t, 0.02); l.upZ.setTargetAtTime(_u.z, t, 0.02);
    } else if (l.setPosition) {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z);
    }
  }

  // output node: positional when `pos` is given
  out(pos, gain = 1, o = {}) {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const bus = o.bus || this.sfx;
    if (pos) {
      const p = this.ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = o.ref ?? 1.6;
      p.maxDistance = 60;
      p.rolloffFactor = o.rolloff ?? 1.3;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p).connect(bus);
      g.panner = p;
    } else g.connect(bus);
    return g;
  }

  env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(1e-4, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(1e-4, t + a + hold + rel);
  }

  fart(pos, power = 0.4) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const dur = 0.22 + power * 1.2 + Math.random() * 0.15;
    const f0 = 62 + Math.random() * 46 - power * 18;
    const o = this.out(pos, 0.9 + power * 0.5, { ref: 2 });
    const env = c.createGain();
    env.gain.setValueAtTime(1e-4, t);
    env.gain.linearRampToValueAtTime(1, t + 0.015);
    env.gain.setValueAtTime(1, t + dur * 0.75);
    env.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    env.connect(o);
    const am = c.createGain();
    am.gain.value = 0.55;
    am.connect(env);
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * (1.25 + Math.random() * 0.4), t);
    osc.frequency.exponentialRampToValueAtTime(f0 * (0.6 + Math.random() * 0.2), t + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 5 + Math.random() * 4;
    lp.frequency.setValueAtTime(700 + power * 500, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dur);
    osc.connect(lp).connect(am);
    const flutter = c.createOscillator();
    flutter.type = 'square';
    flutter.frequency.setValueAtTime(20 + Math.random() * 18, t);
    flutter.frequency.linearRampToValueAtTime(9 + Math.random() * 6, t + dur);
    const fg = c.createGain();
    fg.gain.value = 0.45;
    flutter.connect(fg).connect(am.gain);
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 160 + Math.random() * 120;
    bp.Q.value = 1.4;
    const ng = c.createGain();
    ng.gain.value = 0.35 + power * 0.3;
    n.connect(bp).connect(ng).connect(am);
    osc.start(t); flutter.start(t); n.start(t, Math.random());
    osc.stop(t + dur + 0.05); flutter.stop(t + dur + 0.05); n.stop(t + dur + 0.05);
  }

  ringBurst(pos, vol = 0.5) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const o = this.out(pos, vol, { ref: 1.4 });
    const env = c.createGain();
    env.gain.value = 0;
    env.connect(o);
    const mix = c.createGain();
    mix.gain.value = 0.5;
    mix.connect(env);
    for (const f of [1046, 1318]) {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.connect(mix);
      osc.start(t); osc.stop(t + 1.3);
    }
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 22;
    const lg = c.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg).connect(mix.gain);
    lfo.start(t); lfo.stop(t + 1.3);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.8, t + 0.02);
    env.gain.setValueAtTime(0.8, t + 1.15);
    env.gain.linearRampToValueAtTime(0, t + 1.25);
  }

  blip(freq = 880, dur = 0.06, type = 'sine', vol = 0.25, pos = null, bus = null) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = c.createGain();
    osc.connect(g).connect(this.out(pos, vol, bus ? { bus } : {}));
    this.env(g, t, 0.005, 1, dur * 0.3, dur);
    osc.start(t);
    osc.stop(t + dur * 1.5 + 0.05);
  }

  pickup() { this.blip(520, 0.05, 'square', 0.12); setTimeout(() => this.blip(780, 0.07, 'square', 0.12), 60); }
  hangup() { [480, 480, 480].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'square', 0.1), i * 220)); }
  uiClick() { this.blip(1400, 0.03, 'triangle', 0.08); }
  uiError() { this.blip(180, 0.15, 'square', 0.1); }
  notify() { this.blip(1318, 0.08, 'sine', 0.14); setTimeout(() => this.blip(1760, 0.12, 'sine', 0.12), 90); }
  login() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.1), i * 85)); }
  logoff() { [784, 659, 523].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, 'triangle', 0.09), i * 90)); }

  key(pos = null) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400 + Math.random() * 1600;
    bp.Q.value = 3;
    const g = c.createGain();
    n.connect(bp).connect(g).connect(this.out(pos, 0.18));
    this.env(g, t, 0.001, 1, 0.004, 0.03);
    n.start(t, Math.random());
    n.stop(t + 0.05);
  }

  chaching(pos) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const o = this.out(pos, 0.7);
    const n = this.noiseSrc();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = c.createGain();
    n.connect(lp).connect(g).connect(o);
    this.env(g, t, 0.003, 0.9, 0.03, 0.12);
    n.start(t, Math.random()); n.stop(t + 0.3);
    for (const [f, d] of [[2093, 1.1], [2637, 0.9], [3136, 0.8], [4186, 0.5]]) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const og = c.createGain();
      osc.connect(og).connect(o);
      this.env(og, t + 0.08, 0.002, 0.18, 0, d);
      osc.start(t + 0.08); osc.stop(t + 0.1 + d);
    }
    for (let i = 0; i < 6; i++) {
      const st = t + 0.15 + i * 0.05 + Math.random() * 0.04;
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 3500 + Math.random() * 2500;
      const og = c.createGain();
      osc.connect(og).connect(o);
      this.env(og, st, 0.001, 0.08, 0, 0.12);
      osc.start(st); osc.stop(st + 0.2);
    }
  }

  // continuous stream; `intoWater` makes it tinkly (toilet), else a hiss on the floor
  pee(pos, intoWater = true) {
    if (!this.ready) return { stop() {}, move() {} };
    const c = this.ctx, t = c.currentTime;
    const o = this.out(pos, 0.5, { ref: 1.4 });
    const n = this.noiseSrc(true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = intoWater ? 3200 : 1800;
    bp.Q.value = intoWater ? 0.9 : 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(1e-4, t);
    g.gain.linearRampToValueAtTime(intoWater ? 0.7 : 0.55, t + 0.3);
    const lfo = c.createOscillator();
    lfo.frequency.value = 6;
    const lg = c.createGain();
    lg.gain.value = intoWater ? 600 : 300;
    lfo.connect(lg).connect(bp.frequency);
    n.connect(bp).connect(g).connect(o);
    n.start(t); lfo.start(t);
    const tink = intoWater ? setInterval(() => this.blip(600 + Math.random() * 500, 0.05, 'sine', 0.06, pos), 180) : null;
    return {
      stop: () => {
        const e = c.currentTime;
        g.gain.cancelScheduledValues(e);
        g.gain.setValueAtTime(g.gain.value, e);
        g.gain.exponentialRampToValueAtTime(1e-4, e + 0.4);
        n.stop(e + 0.45); lfo.stop(e + 0.45);
        if (tink) clearInterval(tink);
      },
      move: (p) => {
        const pn = o.panner;
        if (!pn) return;
        if (pn.positionX) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } else pn.setPosition(p.x, p.y, p.z);
      },
    };
  }

  flush(pos) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const o = this.out(pos, 0.8, { ref: 2 });
    const n = this.noiseSrc();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 2.4);
    const g = c.createGain();
    n.connect(lp).connect(g).connect(o);
    this.env(g, t, 0.05, 0.9, 1.2, 1.2);
    n.start(t, Math.random()); n.stop(t + 2.6);
    for (let i = 0; i < 8; i++) {
      const st = t + 0.6 + Math.random() * 1.6;
      const osc = c.createOscillator();
      osc.frequency.setValueAtTime(140 + Math.random() * 120, st);
      osc.frequency.exponentialRampToValueAtTime(70, st + 0.12);
      const og = c.createGain();
      osc.connect(og).connect(o);
      this.env(og, st, 0.005, 0.25, 0, 0.12);
      osc.start(st); osc.stop(st + 0.2);
    }
  }

  thud(pos, power = 0.5) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const o = this.out(pos, 0.4 + power * 0.6);
    const osc = c.createOscillator();
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const g = c.createGain();
    osc.connect(g).connect(o);
    this.env(g, t, 0.003, 1, 0, 0.2);
    osc.start(t); osc.stop(t + 0.25);
    const n = this.noiseSrc();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const ng = c.createGain();
    n.connect(lp).connect(ng).connect(o);
    this.env(ng, t, 0.002, 0.6, 0, 0.08);
    n.start(t, Math.random()); n.stop(t + 0.12);
  }

  step(pos, foot = 0) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const o = this.out(pos, 0.16);
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = foot % 2 ? 420 : 360;
    bp.Q.value = 1.2;
    const g = c.createGain();
    n.connect(bp).connect(g).connect(o);
    this.env(g, t, 0.002, 1, 0.01, 0.06);
    n.start(t, Math.random()); n.stop(t + 0.1);
  }

  whoosh(pos, dur = 0.5) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const o = this.out(pos, 0.5);
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.6);
    bp.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = c.createGain();
    n.connect(bp).connect(g).connect(o);
    this.env(g, t, dur * 0.3, 0.8, 0, dur * 0.7);
    n.start(t, Math.random()); n.stop(t + dur + 0.05);
  }

  boing(pos) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.15);
    const g = c.createGain();
    osc.connect(g).connect(this.out(pos, 0.22));
    this.env(g, t, 0.005, 1, 0.02, 0.15);
    osc.start(t); osc.stop(t + 0.25);
  }

  gulp(pos) {
    [0, 0.28].forEach((d) => setTimeout(() => {
      if (!this.ready) return;
      const c = this.ctx, t = c.currentTime;
      const osc = c.createOscillator();
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.1);
      const g = c.createGain();
      osc.connect(g).connect(this.out(pos, 0.35));
      this.env(g, t, 0.005, 1, 0, 0.1);
      osc.start(t); osc.stop(t + 0.15);
    }, d * 1000));
  }

  cough(pos) {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!this.ready) return;
        const c = this.ctx, t = c.currentTime;
        const n = this.noiseSrc();
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 700 + Math.random() * 300;
        bp.Q.value = 2.5;
        const g = c.createGain();
        n.connect(bp).connect(g).connect(this.out(pos, 0.5));
        this.env(g, t, 0.01, 1, 0.04, 0.12);
        n.start(t, Math.random()); n.stop(t + 0.2);
      }, i * 230 + Math.random() * 60);
    }
  }

  flaps(n = 10) { for (let i = 0; i < n; i++) setTimeout(() => this.blip(2400 + Math.random() * 800, 0.012, 'square', 0.05), i * 35); }

  can(pos) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const g = c.createGain();
    n.connect(hp).connect(g).connect(this.out(pos, 0.4));
    this.env(g, t, 0.001, 1, 0.02, 0.3);
    n.start(t, Math.random()); n.stop(t + 0.4);
  }

  glass(pos) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const o = this.out(pos, 0.9, { ref: 4 });
    for (let i = 0; i < 14; i++) {
      const st = t + Math.random() * 0.5;
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 2500 + Math.random() * 5000;
      const g = c.createGain();
      osc.connect(g).connect(o);
      this.env(g, st, 0.001, 0.2, 0, 0.25 + Math.random() * 0.4);
      osc.start(st); osc.stop(st + 0.8);
    }
    const n = this.noiseSrc();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const g = c.createGain();
    n.connect(hp).connect(g).connect(o);
    this.env(g, t, 0.002, 1, 0.05, 0.6);
    n.start(t, Math.random()); n.stop(t + 0.8);
  }

  thunder(power = 1, delay = 0) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = this.out(null, 0.9 * power, { bus: this.ambBus });
    // crack
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(4000, t);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.6);
    const g = c.createGain();
    n.connect(bp).connect(g).connect(o);
    this.env(g, t, 0.01, 0.6, 0.05, 0.6);
    n.start(t, Math.random()); n.stop(t + 1);
    // rumble
    const b = this.noiseSrc(false, true);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 120;
    const bg = c.createGain();
    b.connect(lp).connect(bg).connect(o);
    this.env(bg, t + 0.05, 0.3, 1.4, 0.8, 2.6);
    b.start(t, Math.random()); b.stop(t + 4.2);
  }

  // rain on the windows + HVAC hum + distant keyboard chatter
  ambience() {
    if (!this.ready) return { stop() {}, setRain() {} };
    const c = this.ctx, t = c.currentTime;
    const hum = this.noiseSrc(true, true);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const hg = c.createGain();
    hg.gain.value = 0.16;
    hum.connect(lp).connect(hg).connect(this.ambBus);
    hum.start(t);
    const osc = c.createOscillator();
    osc.frequency.value = 60;
    const og = c.createGain();
    og.gain.value = 0.01;
    osc.connect(og).connect(this.ambBus);
    osc.start(t);
    // rain through the glass: band-limited, with the top end rolled off so it is
    // a soft wash instead of white-noise hiss
    const rain = this.noiseSrc(true);
    const rbp = c.createBiquadFilter();
    rbp.type = 'bandpass';
    rbp.frequency.value = 1000;
    rbp.Q.value = 0.7;
    const rlp = c.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 2600;
    const rg = c.createGain();
    rg.gain.value = 0;
    rain.connect(rbp).connect(rlp).connect(rg).connect(this.ambBus);
    rain.start(t);
    let rainLevel = 0;
    // keyboard chatter and drops are ambience too (its slider, its ducking)
    const clicks = setInterval(() => {
      if (Math.random() < 0.55) this.blip(1800 + Math.random() * 1600, 0.01, 'square', 0.012, null, this.ambBus);
      if (rainLevel > 0 && Math.random() < rainLevel * 0.8) this.blip(4000 + Math.random() * 3000, 0.004, 'sine', 0.02 * rainLevel, null, this.ambBus);
    }, 90);
    return {
      stop: () => { hum.stop(); osc.stop(); rain.stop(); clearInterval(clicks); },
      setRain: (v) => { rainLevel = v; rg.gain.setTargetAtTime(v * 0.14, c.currentTime, 0.5); },
    };
  }
}
