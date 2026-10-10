// Voice cloning client (downloadable build only): speaks text with the user's
// own cloned voice through an OpenAI-compatible /audio/speech endpoint they
// configure in Settings. The key stays in their browser. If it is not
// configured or a request fails, the caller falls back to the browser voice.
import { settings } from '../settings.js';

export class CloneTTS {
  constructor(audioCtx = null) {
    this.ctx = audioCtx;
    this.cache = new Map(); // text -> AudioBuffer
    this.current = null;
    this.failed = false;
  }

  cfg() { return settings.get('voices.clone') || {}; }
  get ready() {
    const c = this.cfg();
    return !this.failed && !!(c.on && c.base && c.voiceId);
  }

  setCtx(ctx) { this.ctx = ctx; }

  async fetchBuffer(text) {
    const c = this.cfg();
    const base = c.base.replace(/\/$/, '');
    const res = await fetch(base + '/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(c.key ? { Authorization: 'Bearer ' + c.key } : {}) },
      body: JSON.stringify({ model: c.model || 'tts-1', voice: c.voiceId, input: text.slice(0, 400), response_format: 'mp3' }),
    });
    if (!res.ok) { const e = new Error('clone_' + res.status); e.code = res.status; throw e; }
    const buf = await res.arrayBuffer();
    if (!this.ctx) throw new Error('no_audio_ctx');
    return await this.ctx.decodeAudioData(buf);
  }

  // speak and resolve when finished (so the open mic can stay paused meanwhile)
  async speak(text, { volume = 1, onstart, onend } = {}) {
    if (!this.ready || !this.ctx) { if (onend) onend(); return false; }
    try {
      let ab = this.cache.get(text);
      if (!ab) { ab = await this.fetchBuffer(text); if (this.cache.size > 40) this.cache.clear(); this.cache.set(text, ab); }
      this.stop();
      const src = this.ctx.createBufferSource();
      src.buffer = ab;
      const g = this.ctx.createGain();
      g.gain.value = Math.max(0, Math.min(1, volume));
      src.connect(g).connect(this.ctx.destination);
      this.current = src;
      if (onstart) onstart();
      src.onended = () => { if (this.current === src) this.current = null; if (onend) onend(); };
      src.start();
      return true;
    } catch (e) {
      if (e && (e.code === 401 || e.code === 403 || e.code === 404)) this.failed = true;
      console.warn('clone tts failed', e);
      if (onend) onend();
      return false;
    }
  }

  stop() { if (this.current) { try { this.current.stop(); } catch { /* ignore */ } this.current = null; } }
  refresh() { this.failed = false; this.cache.clear(); }
}
