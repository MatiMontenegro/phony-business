// Generated lo-fi bossa "hold music". In phone mode it is band-passed like a
// cheap phone line.
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const CHORDS = [
  [57, 60, 64, 67, 71], [50, 54, 57, 60, 64], [55, 59, 62, 66, 69], [48, 52, 55, 59, 62],
  [54, 57, 60, 64, 67], [47, 51, 54, 57, 60], [52, 55, 59, 62, 66], [45, 49, 52, 55, 61],
];
const BASS = [45, 38, 43, 36, 42, 35, 40, 33];
const BASS_PAT = [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1];
const CHORD_PAT = [1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0];

export class HoldMusic {
  constructor(audio) {
    this.audio = audio;
    this.playing = false;
    this.tempo = 96;
    this.step = 0;
    this.nextTime = 0;
    this.phoneMode = false;
  }

  start() {
    const a = this.audio;
    if (!a.ready || this.playing) return;
    const c = a.ctx;
    this.out = c.createGain();
    this.out.gain.value = 1e-4;
    this.out.gain.linearRampToValueAtTime(1, c.currentTime + 2);
    this.hp = c.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = 20;
    this.lp = c.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 12000;
    this.out.connect(this.hp).connect(this.lp).connect(a.musicBus);
    this.crackle = setInterval(() => { if (Math.random() < 0.5) a.blip(3000 + Math.random() * 4000, 0.004, 'square', 0.02); }, 120);
    this.playing = true;
    this.nextTime = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  setPhoneMode(on) {
    this.phoneMode = on;
    if (!this.hp) return;
    const t = this.audio.ctx.currentTime;
    this.hp.frequency.setTargetAtTime(on ? 420 : 20, t, 0.1);
    this.lp.frequency.setTargetAtTime(on ? 3000 : 12000, t, 0.1);
  }

  stop() {
    if (!this.playing) return;
    clearInterval(this.timer);
    clearInterval(this.crackle);
    const t = this.audio.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(1e-4, t + 0.8);
    const o = this.out;
    setTimeout(() => o.disconnect(), 1000);
    this.playing = false;
  }

  schedule() {
    const c = this.audio.ctx;
    const sixteenth = 60 / this.tempo / 2;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  playStep(step, t, d) {
    const bar = Math.floor(step / 16) % CHORDS.length;
    const i = step % 16;
    const tt = t + (i % 2 === 1 ? d * 0.12 : 0); // swing
    if (BASS_PAT[i]) this.bass(midi(BASS[bar] + (i >= 8 && i % 4 === 3 ? 7 : 0)), tt, d * 1.6);
    if (CHORD_PAT[i]) this.chord(CHORDS[bar], tt, d * (i % 4 === 0 ? 2.5 : 1.2));
    this.hat(tt, i % 2 === 0 ? 0.05 : 0.03);
    if (i === 3 || i === 6 || i === 10 || i === 12) this.rim(tt);
    if (step % 32 === 4 || step % 32 === 20) {
      const n = CHORDS[bar][2 + Math.floor(Math.random() * 3)] + 12;
      this.lead(midi(n), tt, d * 3);
    }
  }

  voice(f, t, dur, { type = 'sine', gain = 0.06, attack = 0.01, partials = [] } = {}) {
    const c = this.audio.ctx;
    const g = c.createGain();
    g.connect(this.out);
    g.gain.setValueAtTime(1e-4, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
    for (const [mul, amp] of partials) {
      const p = c.createOscillator();
      p.frequency.value = f * mul;
      const pg = c.createGain();
      pg.gain.setValueAtTime(gain * amp, t);
      pg.gain.exponentialRampToValueAtTime(1e-4, t + dur * 0.35);
      p.connect(pg).connect(this.out);
      p.start(t);
      p.stop(t + dur);
    }
  }

  chord(notes, t, d) {
    notes.forEach((n, i) => this.voice(midi(n) * (1 + (i % 2 ? 0.002 : -0.002)), t + i * 0.008, d, { gain: 0.028, partials: [[2, 0.5], [3, 0.18]] }));
  }
  bass(f, t, d) { this.voice(f, t, d, { type: 'triangle', gain: 0.12, attack: 0.005 }); }
  lead(f, t, d) { this.voice(f, t, d, { type: 'sine', gain: 0.04, attack: 0.03, partials: [[2, 0.3]] }); }

  hat(t, v) {
    const a = this.audio, c = a.ctx;
    const n = a.noiseSrc();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = c.createGain();
    n.connect(hp).connect(g).connect(this.out);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 0.05);
    n.start(t, Math.random());
    n.stop(t + 0.07);
  }

  rim(t) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = 1700;
    const g = c.createGain();
    o.connect(g).connect(this.out);
    g.gain.setValueAtTime(0.03, t);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 0.03);
    o.start(t);
    o.stop(t + 0.05);
  }
}
