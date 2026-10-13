// Brain for any OpenAI-compatible chat endpoint (free tiers, local Ollama).
// Only usable in the standalone build: the claude.ai page blocks other hosts.
import { buildTurns, parseReply } from './prompt.js';
import { usage } from './usage.js';

export const PROVIDERS = {
  groq: { label: 'Groq (free tier)', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', keyHint: 'gsk_...' },
  gemini: { label: 'Google Gemini (free tier)', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', keyHint: 'AIza...' },
  openrouter: { label: 'OpenRouter (free models)', base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', keyHint: 'sk-or-...' },
  ollama: { label: 'Ollama on this computer', base: 'http://localhost:11434/v1', model: 'llama3.2', keyHint: '(no key needed)' },
  custom: { label: 'Custom OpenAI-compatible', base: '', model: '', keyHint: '' },
};

export class OpenAIBrain {
  constructor({ base, model, key, provider = 'custom' }) {
    this.base = base.replace(/\/$/, '');
    this.model = model;
    this.key = key;
    this.kind = 'openai';
    this.provider = provider;
  }

  async reply(call, said, events = []) {
    const turns = buildTurns(call, said, events);
    const messages = [{ role: 'system', content: turns[0].content }, ...turns.slice(1)];
    const inChars = messages.reduce((n, t) => n + t.content.length, 0);
    const ac = new AbortController();
    call.abort = ac;
    // free tiers sometimes hang: give up after 15 s and let the backup brain answer this line
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ac.abort(); }, 15000);
    let res;
    try {
      res = await fetch(this.base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.key ? { Authorization: 'Bearer ' + this.key } : {}) },
        body: JSON.stringify({ model: this.model, messages, temperature: 0.9, max_tokens: 220 }),
        signal: ac.signal,
      });
      // a connected OpenRouter free model can retire or be busy: fall back once
      // to the free router, which auto-picks a working free model
      if (this.provider === 'openrouter' && (res.status === 404 || res.status === 400 || res.status === 429) && this.model !== 'openrouter/free') {
        this.model = 'openrouter/free';
        res = await fetch(this.base + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(this.key ? { Authorization: 'Bearer ' + this.key } : {}) },
          body: JSON.stringify({ model: this.model, messages, temperature: 0.9, max_tokens: 220 }),
          signal: ac.signal,
        });
      }
    } catch (e) {
      clearTimeout(timer);
      usage.record({ provider: this.provider, inChars, ok: false });
      const err = new Error(timedOut ? 'timeout' : e.name === 'AbortError' ? 'cancelled' : 'upstream_error');
      err.code = err.message;
      throw err;
    }
    clearTimeout(timer);
    const fail = (code) => { usage.record({ provider: this.provider, inChars, ok: false }); const e = new Error(code); e.code = code; return e; };
    if (res.status === 402) throw fail('no_credit');
    if (res.status === 429) throw fail('rate_limited');
    if (res.status === 401 || res.status === 403) throw fail('not_granted');
    if (!res.ok) throw fail('upstream_error');
    const data = await res.json().catch(() => { throw fail('upstream_error'); });
    const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content || '' : '';
    usage.record({ provider: this.provider, inChars, outChars: text.length });
    const r = parseReply(text, call);
    call.history.push({ role: 'user', content: turns[turns.length - 1].content });
    call.history.push({ role: 'assistant', content: String(text).trim() });
    return r;
  }
}
