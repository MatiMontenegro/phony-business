// Microphone: permission + level meter (getUserMedia) and speech recognition
// with an open-mic mode that sends what you said after a short pause.
import { settings } from '../settings.js';

export class Mic {
  constructor() {
    this.stream = null;
    this.level = 0;
    this.state = 'idle'; // idle | asking | granted | denied | unavailable
    this.analyser = null;
    this.buf = null;
    this.floorDb = -60; // running estimate of the room's noise floor
    this.voiceAt = 0;   // last time the meter heard something above it
  }

  get available() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

  // must run inside a user gesture (the "clock in" click)
  async request(audioCtx = null) {
    if (this.state === 'granted') return true;
    if (!this.available) { this.state = 'unavailable'; return false; }
    this.state = 'asking';
    try {
      // no AGC: it cranks the OS mic gain up during silence, which turns the
      // room into hiss for the meter and the speech recognizer alike
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 } });
      this.state = 'granted';
      if (audioCtx) this.attach(audioCtx);
      return true;
    } catch (e) {
      this.state = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unavailable';
      return false;
    }
  }

  attach(ctx) {
    if (!this.stream || this.analyser) return;
    try {
      const src = ctx.createMediaStreamSource(this.stream);
      // voice band only, so rumble (fans, desk bumps) and hiss do not move the meter
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 100;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 4000;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.buf = new Float32Array(this.analyser.fftSize);
      src.connect(hp).connect(lp).connect(this.analyser);
    } catch { /* level meter is optional */ }
  }

  // 0..1, gated against an adaptive noise floor: steady background noise reads as silence
  sample() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(sum / this.buf.length);
    const db = 20 * Math.log10(rms + 1e-6);
    // the floor drops fast in quiet moments and creeps up slowly (~4 s) under steady noise
    this.floorDb += (db - this.floorDb) * (db < this.floorDb ? 0.25 : 0.004);
    this.floorDb = Math.max(-90, Math.min(-30, this.floorDb));
    const over = db - this.floorDb - 9; // gate: 9 dB above the floor
    if (over > 3) this.voiceAt = performance.now();
    const target = over > 0 ? Math.min(1, Math.max(rms * 6, Math.min(0.45, 0.1 + over / 50))) : 0;
    this.level += (target - this.level) * (target > this.level ? 0.5 : 0.2);
    return this.level;
  }

  // something voice-like was heard in the last `ms` (always true without a meter)
  heardVoice(ms = 2500) { return !this.analyser || performance.now() - this.voiceAt < ms; }
}

// `text` minus the words of `sent` it starts with (case, accents and punctuation
// may differ between the interim and the final version of the same words)
const wordsOf = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
function afterSent(text, sent) {
  const a = wordsOf(text), b = wordsOf(sent);
  const n = Math.min(a.length, b.length);
  let same = 0;
  for (let i = 0; i < n; i++) if (a[i] === b[i]) same++;
  if (!b.length || same < Math.ceil(b.length * 0.7)) return text; // a different sentence after all
  return text.trim().split(/\s+/).slice(b.length).join(' ');
}

// One long-lived recognition session per shift. Starting a SpeechRecognition
// is what makes the browser ask for the microphone, so we never abort it to
// "pause" or between calls: we just ignore what it hears while gated. When the
// browser ends a session on its own we reopen it with a growing back-off, and
// stop for good on a permission error (no prompt loops).
export class Ears {
  constructor() {
    const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
    this.SR = SR;
    this.supported = !!SR;
    this.listening = false;
    this.denied = false;
    this.paused = false;
    this.wanted = false;   // the game wants to hear the player right now
    this.alive = false;    // keep the session running (until shutdown)
    this.rec = null;
    this.finalText = '';
    this.interim = '';
    this.sendTimer = null;
    this.handlers = {};
    this.restarts = 0;
    this.openedAt = 0;
    this.reopenTimer = null;
    this.vad = null; // () => bool: did the level meter hear a voice just now?
    this.sent = null; // words already sent that the recognizer may still finalize
    this.lastIdx = -1;
  }

  start(lang, handlers = {}) {
    if (!this.supported || this.denied) return false;
    this.handlers = handlers;
    // already listening in this language (tapping the mic, a settings change...): keep what is being said
    if (this.wanted && this.alive && this.lang === lang) { this.paused = false; return true; }
    this.wanted = true;
    this.paused = false;
    this.finalText = '';
    this.interim = '';
    this.sent = null;
    if (this.lang !== lang && this.rec) { this.lang = lang; this.alive = false; try { this.rec.abort(); } catch { /* ignore */ } this.alive = true; this.reopen(400); return true; }
    this.lang = lang;
    this.alive = true;
    return this.open();
  }

  get gated() { return !this.wanted || this.paused; }

  open() {
    if (this.listening || !this.alive || this.denied) return true;
    const r = new this.SR();
    r.lang = this.lang === 'es' ? 'es-AR' : 'en-US';
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    this.sent = null;
    this.lastIdx = -1;
    r.onresult = (e) => {
      if (this.gated) return; // heard while the mark talks or between calls
      // an utterance only starts on a real voice (not words "heard" in background
      // noise); once it started, nothing is dropped
      if (this.vad && !this.finalText && !this.interim && !this.vad()) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        let tx = res[0].transcript;
        // the recognizer finishing words that were already sent: keep only what is new
        if (this.sent && i === this.sent.i) {
          tx = afterSent(tx, this.sent.text);
          if (res.isFinal) this.sent = null;
          if (!tx.trim()) continue;
        }
        if (res.isFinal) {
          // short, low-confidence finals are usually noise the recognizer guessed at
          const c = res[0].confidence;
          if (c > 0 && c < 0.3 && tx.trim().split(/\s+/).length < 3) continue;
          this.finalText += tx + ' ';
        } else interim += tx;
        this.lastIdx = i;
      }
      this.interim = interim;
      const text = (this.finalText + interim).trim();
      if (this.handlers.onPartial) this.handlers.onPartial(text);
      this.scheduleSend();
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        this.denied = true; this.alive = false; this.wanted = false;
      }
      if (e.error !== 'no-speech' && e.error !== 'aborted' && this.handlers.onError) this.handlers.onError(e.error);
    };
    r.onend = () => {
      this.listening = false;
      this.rec = null;
      if (!this.alive || this.denied) return;
      // sessions that die instantly back off (1s, 2s, 4s ... 30s) instead of looping
      const quick = performance.now() - this.openedAt < 3000;
      this.restarts = quick ? this.restarts + 1 : 0;
      if (this.restarts > 6) { this.alive = false; return; }
      this.reopen(quick ? Math.min(30000, 1000 * 2 ** (this.restarts - 1)) : 200);
    };
    try { r.start(); } catch { return false; }
    this.openedAt = performance.now();
    this.rec = r;
    this.listening = true;
    return true;
  }

  reopen(ms) { clearTimeout(this.reopenTimer); this.reopenTimer = setTimeout(() => this.open(), ms); }

  scheduleSend() {
    clearTimeout(this.sendTimer);
    const ms = settings.get('mic.autoSendMs') || 1000;
    this.sendTimer = setTimeout(() => this.flush(), ms);
  }

  flush() {
    clearTimeout(this.sendTimer);
    const text = (this.finalText + this.interim).trim();
    // words still open in the recognizer may come back as a final: remember them
    this.sent = this.interim.trim() ? { i: this.lastIdx, text: this.interim.trim() } : null;
    this.finalText = '';
    this.interim = '';
    if (text && this.handlers.onSend) this.handlers.onSend(text);
    else if (this.handlers.onPartial) this.handlers.onPartial('');
  }

  // the mark is about to talk: send what the player already said (never drop
  // it), then ignore the mic so it does not hear the mark
  pause() {
    if (this.paused) return;
    if (!this.gated && (this.finalText + this.interim).trim()) this.flush();
    this.paused = true;
    clearTimeout(this.sendTimer);
  }

  resume() { this.paused = false; }

  // stop listening to the player (the session itself stays open, no new prompt)
  stop(send = false) {
    if (send) this.flush();
    this.wanted = false;
    clearTimeout(this.sendTimer);
    this.finalText = '';
    this.interim = '';
    this.sent = null;
    if (!send && this.handlers.onPartial) this.handlers.onPartial('');
  }

  // really close it (leaving the shift / page)
  shutdown() {
    this.wanted = false;
    this.alive = false;
    clearTimeout(this.reopenTimer);
    if (this.rec) { try { this.rec.abort(); } catch { /* ignore */ } }
  }
}
