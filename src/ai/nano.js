// Brain on the browser's own built-in model (Chrome's Prompt API, Gemini Nano):
// free, no account and no key, and nothing leaves the player's computer. Only
// desktop Chrome on capable hardware has it; the model is downloaded once (the
// first create() has to come from a click) and is then shared by every site.
// It is just another transport for the same conversation the cloud brains get
// (buildTurns / turnMessage / parseReply in prompt.js): one session per call.
import { buildTurns, turnMessage, parseReply } from './prompt.js';
import { usage } from './usage.js';

const LM = () => globalThis.LanguageModel;
const io = (lang) => ({
  expectedInputs: [{ type: 'text', languages: ['en', lang] }],
  expectedOutputs: [{ type: 'text', languages: [lang] }],
});

// 'unsupported' (no API in this browser) | 'unavailable' (hardware/OS) |
// 'downloadable' | 'downloading' | 'available'
let state = LM() ? 'checking' : 'unsupported';
export const nanoState = () => state;

export async function probeNano(lang = 'es') {
  if (!LM()) return (state = 'unsupported');
  try { state = await LM().availability(io(lang === 'es' ? 'es' : 'en')); } catch { state = 'unavailable'; }
  return state;
}

// first-time download (call it from a click); onProgress gets 0..1
export async function activateNano(lang = 'es', onProgress = () => {}) {
  if (!LM()) throw new Error('unsupported');
  state = 'downloading';
  try {
    const s = await LM().create({ ...io(lang === 'es' ? 'es' : 'en'), monitor(m) { m.addEventListener('downloadprogress', (e) => onProgress(e.loaded)); } });
    s.destroy();
    state = 'available';
  } catch (e) { await probeNano(lang); throw e; }
  return state;
}

export class NanoBrain {
  constructor() {
    this.kind = 'nano';
    this.sessions = new Map(); // call id -> session
  }

  // a session per call, seeded with the same opening turns the cloud brains get
  async open(call, said, events, signal) {
    for (const [id, s] of this.sessions) if (id !== call.id) { try { s.destroy(); } catch { /* gone */ } this.sessions.delete(id); }
    const turns = buildTurns(call, said, events);
    // the cloud brains carry the rules as the first user turn; Gemini Nano wants
    // them as the system prompt, which must be the one and only system message
    const seed = turns.slice(0, -1).map((turn, i) => (i === 0 ? { role: 'system', content: turn.content } : turn));
    const s = await LM().create({ ...io(call.lang === 'es' ? 'es' : 'en'), initialPrompts: seed, signal });
    this.sessions.set(call.id, s);
    return { s, first: turns[turns.length - 1].content };
  }

  async reply(call, said, events = []) {
    if (!LM()) { const e = new Error('not_granted'); e.code = 'not_granted'; throw e; }
    const ac = new AbortController();
    call.abort = ac;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ac.abort(); }, 20000);
    const inChars = (said || '').length + 400;
    try {
      const { s, first } = this.sessions.has(call.id)
        ? { s: this.sessions.get(call.id), first: turnMessage(call, said, events) }
        : await this.open(call, said, events, ac.signal);
      const text = await s.prompt(first, { signal: ac.signal });
      clearTimeout(timer);
      usage.record({ provider: 'nano', inChars, outChars: text.length });
      const r = parseReply(text, call);
      call.history.push({ role: 'user', content: first });
      call.history.push({ role: 'assistant', content: String(text).trim() });
      return r;
    } catch (e) {
      clearTimeout(timer);
      usage.record({ provider: 'nano', inChars, outChars: 0, ok: false });
      // the model fell over for this turn: the offline brain covers it (handled upstream)
      const err = new Error(timedOut ? 'timeout' : e && e.name === 'AbortError' ? 'cancelled' : 'nano_error');
      err.code = err.message;
      throw err;
    }
  }

  dispose() { for (const s of this.sessions.values()) { try { s.destroy(); } catch { /* gone */ } } this.sessions.clear(); }
}
