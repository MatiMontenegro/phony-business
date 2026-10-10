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

export class Ears {
  constructor() {
    const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
    this.SR = SR;
    this.supported = !!SR;
    this.listening = false;
    this.denied = false;
    this.paused = false;
    this.wanted = false;
    this.rec = null;
    this.finalText = '';
    this.interim = '';
    this.sendTimer = null;
    this.handlers = {};
  }

  // continuous listening; onPartial(text) while talking, onSend(text) after a pause
  start(lang, handlers = {}) {
    if (!this.supported || this.denied) return false;
    this.handlers = handlers;
    this.lang = lang;
    this.wanted = true;
    this.paused = false;
    return this.open();
  }

  open() {
    if (this.listening || !this.wanted || this.paused) return true;
    const r = new this.SR();
    r.lang = this.lang === 'es' ? 'es-AR' : 'en-US';
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
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
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.denied = true; this.wanted = false; }
      if (this.handlers.onError) this.handlers.onError(e.error);
    };
    r.onend = () => {
      this.listening = false;
      this.rec = null;
      // Chrome ends sessions after a while: keep the open mic open
      if (this.wanted && !this.paused && !this.denied) setTimeout(() => this.open(), 250);
    };
    try { r.start(); } catch { return false; }
    this.rec = r;
    this.listening = true;
    return true;
  }

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

  // stop listening while the mark talks so it does not hear itself
  pause() {
    if (this.paused) return;
    this.paused = true;
    clearTimeout(this.sendTimer);
    this.finalText = '';
    this.interim = '';
    if (this.rec) { try { this.rec.abort(); } catch { /* ignore */ } }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.wanted) setTimeout(() => this.open(), 120);
  }

  stop(send = false) {
    this.wanted = false;
    if (send) this.flush();
    clearTimeout(this.sendTimer);
    if (this.rec) { try { this.rec.stop(); } catch { /* ignore */ } }
  }
}
