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
  // the cloned-voice ID assigned to a character (or '' if none)
  voiceFor(charId) {
    const c = this.cfg();
    const map = c.voices || {};
    return (map[charId] || (charId === 'matias' ? c.voiceId : '') || '').trim();
  }
  readyFor(charId) {
    const c = this.cfg();
    return !this.failed && !!(c.on && c.base && this.voiceFor(charId));
  }
  get ready() { const c = this.cfg(); return !this.failed && !!(c.on && c.base); }

  setCtx(ctx) { this.ctx = ctx; }

  async fetchBuffer(text, voiceId) {
    const c = this.cfg();
    const base = c.base.replace(/\/$/, '');
    const res = await fetch(base + '/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(c.key ? { Authorization: 'Bearer ' + c.key } : {}) },
      body: JSON.stringify({ model: c.model || 'tts-1', voice: voiceId, input: text.slice(0, 400), response_format: 'mp3' }),
    });
    if (!res.ok) { const e = new Error('clone_' + res.status); e.code = res.status; throw e; }
    const buf = await res.arrayBuffer();
    if (!this.ctx) throw new Error('no_audio_ctx');
    return await this.ctx.decodeAudioData(buf);
  }

  // speak and resolve when finished (so the open mic can stay paused meanwhile)
  async speak(text, { voiceId, volume = 1, onstart, onend } = {}) {
    if (!this.ready || !voiceId || !this.ctx) { if (onend) onend(); return false; }
    try {
      const ck = voiceId + '|' + text;
      let ab = this.cache.get(ck);
      if (!ab) { ab = await this.fetchBuffer(text, voiceId); if (this.cache.size > 40) this.cache.clear(); this.cache.set(ck, ab); }
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
