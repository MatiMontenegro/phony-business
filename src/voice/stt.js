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
  }

  get available() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

  // must run inside a user gesture (the "clock in" click)
  async request(audioCtx = null) {
    if (this.state === 'granted') return true;
    if (!this.available) { this.state = 'unavailable'; return false; }
    this.state = 'asking';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
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
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.buf = new Uint8Array(this.analyser.fftSize);
      src.connect(this.analyser);
    } catch { /* level meter is optional */ }
  }

  sample() {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / this.buf.length);
    this.level += (Math.min(1, rms * 6) - this.level) * 0.4;
    return this.level;
  }
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
  }

  start(lang, handlers = {}) {
    if (!this.supported || this.denied) return false;
    this.handlers = handlers;
    this.wanted = true;
    this.paused = false;
    this.finalText = '';
    this.interim = '';
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
    r.onresult = (e) => {
      if (this.gated) return; // heard while the mark talks or between calls
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) this.finalText += res[0].transcript + ' ';
        else interim += res[0].transcript;
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
    this.finalText = '';
    this.interim = '';
    if (text && this.handlers.onSend) this.handlers.onSend(text);
  }

  // ignore the mic while the mark talks so it does not hear itself
  pause() {
    if (this.paused) return;
    this.paused = true;
    clearTimeout(this.sendTimer);
    this.finalText = '';
    this.interim = '';
  }

  resume() { this.paused = false; }

  // stop listening to the player (the session itself stays open, no new prompt)
  stop(send = false) {
    if (send) this.flush();
    this.wanted = false;
    clearTimeout(this.sendTimer);
    this.finalText = '';
    this.interim = '';
  }

  // really close it (leaving the shift / page)
  shutdown() {
    this.wanted = false;
    this.alive = false;
    clearTimeout(this.reopenTimer);
    if (this.rec) { try { this.rec.abort(); } catch { /* ignore */ } }
  }
}
