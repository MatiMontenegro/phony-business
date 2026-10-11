// The developer's own voice model ("Mi Voz", src/voice/models) spoken through
// the Voicebox app running on this computer. It voices Matías, the dev
// character, only while Voicebox is open with that profile loaded; otherwise
// he keeps his browser voice. Nothing to configure: the dev server bridges
// /voicebox to the app (vite.config.js), other builds try its port directly.
import { settings } from '../settings.js';

export const OWN_VOICE = { profile: 'Mi Voz', character: 'matias' };
const LOCAL = 'http://127.0.0.1:17493';
const TIMEOUT_MS = 20000; // a cold model can take a while on the first line

const norm = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

async function fetchT(url, opts = {}, ms = 2500) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); } finally { clearTimeout(timer); }
}

export class Voicebox {
  // `audio` is the game's Audio (its context is created on the first click)
  constructor(audio) {
    this.audio = audio;
    this.state = 'idle'; // idle | checking | ready | missing | offline
    this.base = '';
    this.profile = null;
    this.cache = new Map(); // lang|text -> AudioBuffer
    this.current = null;    // { src, onend }
    this.seq = 0;
    this.fails = 0;
    this.probing = null;
  }

  // Voicebox lives on the developer's own computer: only look for it when the
  // game runs there (dev server, localhost or the downloaded file), never on
  // the public site, where it would just log failed requests for every player
  get local() {
    return !!import.meta.env.DEV || location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  }

  bases() {
    if (!this.local) return [];
    const out = [];
    if (import.meta.env.DEV || /^https?:$/.test(location.protocol)) out.push(new URL('voicebox', location.href).href.replace(/\/$/, ''));
    out.push(LOCAL);
    return [...new Set(out)];
  }

  // look for Voicebox and the profile; safe to call again (e.g. "check again")
  probe() {
    if (this.probing) return this.probing;
    this.state = 'checking';
    this.probing = (async () => {
      let reached = false;
      for (const base of this.bases()) {
        try {
          const res = await fetchT(base + '/profiles');
          if (res.status === 204) break; // the dev server's bridge: Voicebox is closed
          if (!res.ok) continue;
          const list = await res.json();
          if (!Array.isArray(list)) continue;
          reached = true;
          this.base = base;
          this.profile = list.find((p) => norm(p.name) === norm(OWN_VOICE.profile)) || null;
          break;
        } catch { /* not running there */ }
      }
      this.fails = 0;
      this.state = !reached ? 'offline' : this.profile ? 'ready' : 'missing';
      this.probing = null;
      return this.state === 'ready';
    })();
    return this.probing;
  }

  readyFor(charId) {
    return charId === OWN_VOICE.character && this.state === 'ready' && settings.get('voices.own') !== false && !!this.audio.ctx;
  }

  async clip(text, lang) {
    const key = lang + '|' + text;
    if (this.cache.has(key)) return this.cache.get(key);
    const headers = { 'Content-Type': 'application/json' };
    let res = await fetchT(this.base + '/generate/stream', {
      method: 'POST', headers,
      body: JSON.stringify({ profile_id: this.profile.id, text, language: lang === 'es' ? 'es' : 'en' }),
    }, TIMEOUT_MS);
    // older Voicebox builds: the OpenAI-compatible route (speaks in the profile's language)
    if (res.status === 404 || res.status === 405) {
      res = await fetchT(this.base + '/v1/audio/speech', {
        method: 'POST', headers,
        body: JSON.stringify({ model: 'tts-1', voice: this.profile.name, input: text, response_format: 'wav' }),
      }, TIMEOUT_MS);
    }
    if (!res.ok) throw new Error('voicebox_' + res.status);
    const buf = await this.audio.ctx.decodeAudioData(await res.arrayBuffer());
    if (this.cache.size > 40) this.cache.clear();
    this.cache.set(key, buf);
    return buf;
  }

  // resolves 'done' after playing, 'stale' if a newer line or stop() replaced
  // it while it was being generated, 'failed' if Voicebox could not speak it
  async speak(text, { lang = 'en', volume = 1, onstart, onend } = {}) {
    const my = ++this.seq;
    let buf;
    try {
      buf = await this.clip(String(text).slice(0, 400), lang);
      this.fails = 0;
    } catch (e) {
      console.warn('voicebox failed', e);
      // twice in a row: Voicebox closed or too slow, back to browser voices until "check again"
      if (++this.fails >= 2) this.state = 'offline';
      return my === this.seq ? 'failed' : 'stale';
    }
    if (my !== this.seq) return 'stale';
    this.stop();
    const a = this.audio, c = a.ctx;
    return new Promise((resolve) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = Math.max(0, Math.min(1.5, volume));
      src.connect(g).connect(a.master || c.destination);
      const cur = { src, onend: () => { if (onend) onend(); resolve('done'); } };
      src.onended = () => { if (this.current === cur) { this.current = null; cur.onend(); } };
      this.current = cur;
      if (onstart) onstart();
      src.start();
    });
  }

  // cut the clip that is playing (and drop any line still being generated)
  stop() {
    this.seq++;
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    cur.src.onended = null;
    try { cur.src.stop(); } catch { /* already done */ }
    cur.onend();
  }
}
