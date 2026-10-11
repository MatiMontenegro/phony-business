// Brain backed by Claude through the artifact's `sample` capability (the
// player's own Claude plan). Streams so the first line can be spoken early.
import { buildTurns, parseReply, firstLine } from './prompt.js';
import { usage } from './usage.js';
import { settings } from '../settings.js';

export class ClaudeBrain {
  constructor(sample) {
    this.sample = sample;
    this.kind = 'claude';
  }

  async reply(call, said, events = [], { onFirstLine } = {}) {
    const turns = buildTurns(call, said, events);
    const inChars = turns.reduce((n, t) => n + t.content.length, 0);
    let spoke = false;
    const ac = new AbortController();
    call.abort = ac;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ac.abort(); }, 30000);
    try {
      const res = await this.sample(turns, {
        modelTier: settings.get('ai.claudeTier') || 'quick',
        cache: false,
        signal: ac.signal,
        onText: ({ text }) => {
          if (spoke || !onFirstLine) return;
          const l = firstLine(text);
          if (l) { spoke = true; onFirstLine(l); }
        },
      });
      clearTimeout(timer);
      usage.record({ provider: 'claude', inChars, outChars: res.text.length });
      const r = parseReply(res.text, call);
      call.history.push({ role: 'user', content: turns[turns.length - 1].content });
      call.history.push({ role: 'assistant', content: res.text.trim() });
      r.spokeEarly = spoke;
      return r;
    } catch (e) {
      clearTimeout(timer);
      usage.record({ provider: 'claude', inChars, outChars: 0, ok: false });
      const code = timedOut ? 'timeout' : e && e.code ? e.code : 'upstream_error';
      const err = new Error(code);
      err.code = code;
      err.partial = e && e.text;
      throw err;
    }
  }
}
