// AI usage meter: counts requests and estimates tokens so players can see
// what the marks cost them (shift report + settings).
import { estTokens } from './prompt.js';

const KEY = 'pb:usage';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') || null; } catch { return null; }
}

class Usage {
  constructor() {
    const saved = load();
    this.total = saved && saved.total ? saved.total : { requests: 0, inTok: 0, outTok: 0, errors: 0, since: Date.now() };
    this.shift = { requests: 0, inTok: 0, outTok: 0, errors: 0, calls: 0 };
    this.byProvider = {};
    this.listeners = new Set();
  }

  record({ provider = 'claude', inChars = 0, outChars = 0, ok = true }) {
    const i = estTokens(inChars), o = estTokens(outChars);
    for (const b of [this.total, this.shift]) {
      b.requests++;
      b.inTok += i;
      b.outTok += o;
      if (!ok) b.errors++;
    }
    const p = (this.byProvider[provider] ||= { requests: 0, inTok: 0, outTok: 0 });
    p.requests++; p.inTok += i; p.outTok += o;
    this.save();
    for (const fn of this.listeners) fn(this);
  }

  callStarted() { this.shift.calls++; }
  resetShift() { this.shift = { requests: 0, inTok: 0, outTok: 0, errors: 0, calls: 0 }; }
  resetTotal() { this.total = { requests: 0, inTok: 0, outTok: 0, errors: 0, since: Date.now() }; this.save(); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ total: this.total })); } catch { /* optional */ } }

  perCall() {
    const s = this.shift;
    const calls = Math.max(1, s.calls);
    return { requests: s.requests / calls, tokens: (s.inTok + s.outTok) / calls };
  }
}

export const usage = new Usage();
