// Your phone line: the conversation with the mark, payment vouchers you must
// type into the Lead Registry, customer data to register and sell, bonus
// challenges, hold, and what happens when the AI runs out.
import { TUNE } from '../config.js';
import { t } from '../i18n.js';
import { markById, pickMark, PRODUCTS, CHALLENGES, challengeById, makeVoucher, cleanCode, norm } from '../ai/marks.js';
import { ScriptedBrain } from '../ai/scripted.js';
import { usage } from '../ai/usage.js';

const rnd = (a, b) => a + Math.random() * (b - a);
export const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

export class Calls {
  constructor(game) {
    this.game = game;
    this.state = 'idle'; // idle | connected | hold | wrapup
    this.call = null;
    this.timer = 0;
    this.backup = new ScriptedBrain();
    this.brain = this.backup;
    this.busy = false;
    this.listeners = new Set();
    this.linesDown = false;
    this.pending = '';
    this.reset();
  }

  reset() {
    if (this.call && this.call.abort) { try { this.call.abort.abort(); } catch { /* ignore */ } }
    this.state = 'idle';
    this.call = null;
    this.busy = false;
    this.pending = '';
    this.vouchers = []; // {code, units, amount, markId, markName, ttl, callId, fake, used}
    this.heard = []; // {value, label, markName, fake, registered, sold, callId}
    this.ledger = []; // {label, amount}
    this.history = [];
    this.stats = { calls: 0, closed: 0, earned: 0, secrets: 0, challenges: 0, scambaited: 0, expired: 0 };
    this.notify();
  }

  get lang() { return this.game.lang; }
  setBrain(b) { this.brain = b || this.backup; }
  get brainKind() { return this.brain.kind; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify() { for (const fn of this.listeners) { try { fn(this); } catch (e) { console.warn(e); } } }
  get active() { return this.state === 'connected' || this.state === 'hold'; }

  // ---- picking up -----------------------------------------------------------------
  answer(ring) {
    if (this.active || this.linesDown) return false;
    const L = this.lang;
    const mark = markById(ring.mk) || pickMark();
    let challenge = challengeById(ring.ch);
    if (this.brain.kind === 'backup' && challenge.kind === 'llm') challenge = CHALLENGES.filter((c) => c.kind !== 'llm')[ring.pr % 7];
    const trust = Math.round(rnd(24, 36));
    this.call = {
      id: ring.id,
      mark,
      lang: L,
      product: PRODUCTS[ring.pr] || PRODUCTS[0],
      challenge,
      budget: mark.budget[1] ? Math.round(rnd(mark.budget[0], mark.budget[1])) : 0,
      paidUnits: 0,
      earned: 0,
      pendingAmount: 0,
      trust,
      startTrust: trust,
      patience: 100,
      mood: 'curious',
      opener: mark.opener[L],
      history: [],
      transcript: [],
      elapsed: 0,
      silence: 0,
      turns: 0,
      questionStreak: 0,
      hacked: false,
      leaked: false,
      secretKnown: false,
      challengeDone: false,
      fartAt: -99,
      events: [],
      receipt: [],
      revealed: false,
      nextVoucher: makeVoucher(mark),
      deskIndex: ring.d,
    };
    this.state = 'connected';
    this.stats.calls++;
    usage.callStarted();
    this.game.audio.pickup();
    this.markSay(this.call.opener);
    this.notify();
    this.game.emit('answer', this.call);
    return true;
  }

  // sat back down with someone on hold
  resume() {
    if (this.state !== 'hold' || !this.call) return;
    this.state = 'connected';
    this.call.silence = 0;
    this.markSay(t('backFromHold', this.lang));
    this.notify();
  }

  // got up mid-call
  hold() {
    if (this.state !== 'connected') return;
    this.state = 'hold';
    this.call.holdT = 0;
    this.notify();
  }

  update(dt) {
    const c = this.call;
    switch (this.state) {
      case 'connected':
        c.elapsed += dt;
        c.silence += dt;
        if (c.silence > TUNE.silenceNudge && !this.busy) {
          c.silence = 0;
          c.patience = Math.max(0, c.patience - 12);
          this.markSay(t('nudge', this.lang));
          if (c.patience <= 0) this.endCall('mark');
          this.notify();
        }
        break;
      case 'hold':
        c.patience -= dt * 4;
        c.holdT += dt;
        if (c.patience <= 0) {
          this.game.toast(t('holdHangup', this.lang, { name: c.mark.name }), 'warn');
          this.endCall('mark');
        }
        break;
      case 'wrapup':
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'idle'; this.call = null; this.notify(); }
        break;
      default: break;
    }
    // vouchers expire if nobody types them in
    let changed = false;
    for (const v of this.vouchers) {
      if (v.used || v.expired) continue;
      v.ttl -= dt;
      if (v.ttl <= 0) {
        v.expired = true;
        changed = true;
        if (!v.fake) {
          this.stats.expired++;
          this.ledger.push({ label: `${v.code} · ${t('voucherExpired', this.lang)}`, amount: 0 });
          this.game.toast(`${v.code}: ${t('voucherExpired', this.lang)}`, 'warn');
        }
      }
    }
    if (changed) this.notify();
  }

  markSay(text) {
    const c = this.call;
    if (!c) return;
    c.transcript.push({ who: 'mark', text });
    this.game.speakMark(c.mark, text);
    this.notify();
  }

  addEvent(e) {
    if (this.state !== 'connected' || !this.call) return;
    this.call.events.push(e);
    if (/fart/i.test(e)) this.call.fartAt = this.call.elapsed;
    this.call.transcript.push({ who: 'event', text: e });
    this.notify();
  }

  // ---- talking ---------------------------------------------------------------------
  // speech that arrives while the mark is still answering is queued
  queue(text) {
    const s = String(text || '').trim();
    if (!s) return;
    if (this.busy) { this.pending = (this.pending ? this.pending + ' ' : '') + s; this.notify(); return; }
    this.say(s);
  }

  async say(text) {
    const c = this.call;
    if (this.state !== 'connected' || !c || this.busy) return false;
    const said = String(text || '').trim().slice(0, 300);
    if (!said) return false;
    c.transcript.push({ who: 'me', text: said });
    c.silence = 0;
    c.turns++;
    c.questionStreak = said.endsWith('?') ? c.questionStreak + 1 : 0;
    const events = c.events.splice(0);
    const ch = c.challenge;
    if (!c.challengeDone && ch.kind === 'fartblame' && c.elapsed - c.fartAt < 25 && ch.words.some((w) => norm(said).includes(norm(w)))) this.completeChallenge();
    if (!c.challengeDone && ch.kind === 'questions' && c.questionStreak >= ch.count) this.completeChallenge();
    c.nextVoucher = makeVoucher(c.mark);
    this.busy = true;
    this.notify();
    this.game.emit('playerSaid', said);
    let r;
    try {
      r = await this.brain.reply(c, said, events, {
        onFirstLine: (l) => { c.earlyLine = l; this.game.speakMark(c.mark, l); },
      });
    } catch (e) {
      this.busy = false;
      const alt = await this.handleBrainError(e, c, said, events);
      if (!alt) { this.notify(); return false; }
      r = alt;
    }
    this.busy = false;
    if (this.call === c) this.apply(c, r);
    if (this.pending && this.state === 'connected') { const p = this.pending; this.pending = ''; setTimeout(() => this.say(p), 50); }
    return true;
  }

  apply(c, r) {
    const L = this.lang;
    c.trust = r.trust;
    c.patience = r.patience;
    c.mood = r.mood;
    let line = r.say;
    // a payment always comes with a voucher code the agent has to write down
    if (r.pay > 0) {
      const code = c.nextVoucher;
      if (!cleanCode(line).includes(cleanCode(code))) line += L === 'es' ? ` Anotá el voucher: ${code}.` : ` Write down the voucher: ${code}.`;
    }
    c.transcript.push({ who: 'mark', text: line });
    if (!r.spokeEarly) this.game.speakMark(c.mark, line);
    else if (c.earlyLine && line.length > c.earlyLine.length + 4 && !line.startsWith(c.earlyLine)) this.game.speakMark(c.mark, line.slice(c.earlyLine.length).trim() || line);
    c.earlyLine = null;
    const ch = c.challenge;
    if (!c.challengeDone && ((ch.kind === 'markSays' && ch.words.some((w) => norm(r.say).includes(w))) || (ch.kind === 'flag' && r[ch.flag]) || (ch.kind === 'llm' && r.challenge))) this.completeChallenge();
    if (r.leak && !c.leaked) {
      c.leaked = true;
      c.secretKnown = true;
      if (!c.challengeDone && ch.kind === 'nohack' && !c.hacked) this.completeChallenge();
      this.hear(c);
      this.game.toast(t('secretGot', L, { label: c.mark.secret.label[L] }), 'good');
    }
    if (r.pay > 0) {
      const fake = !!c.mark.scambaiter;
      const units = fake ? r.pay : Math.min(r.pay, c.budget - c.paidUnits);
      if (units > 0) {
        if (!fake) c.paidUnits += units;
        const amount = fake ? 0 : units * c.mark.currency.rate;
        c.pendingAmount += amount;
        this.vouchers.unshift({ code: c.nextVoucher, units, amount, markId: c.mark.id, markName: c.mark.name, currency: c.mark.currency[L], ttl: TUNE.voucherTTL, callId: c.id, fake, used: false, expired: false });
        this.vouchers = this.vouchers.slice(0, 12);
        if (!fake && !c.challengeDone && ch.kind === 'fast' && c.elapsed <= ch.seconds) this.completeChallenge();
        this.game.audio.notify();
        this.game.toast(t('voucherHeard', L, { code: c.nextVoucher }), 'info');
        this.game.emit('voucher', c.nextVoucher);
      }
    }
    if (r.hangup || c.patience <= 0) setTimeout(() => { if (this.call === c && this.state === 'connected') this.endCall('mark'); }, 2600);
    this.notify();
  }

  hear(c) {
    if (this.heard.some((h) => h.callId === c.id)) return;
    const L = this.lang;
    this.heard.unshift({ value: c.mark.secret.value, label: c.mark.secret.label[L], markName: c.mark.name, fake: !!c.mark.scambaiter, registered: false, sold: false, callId: c.id });
    this.notify();
  }

  completeChallenge() {
    const c = this.call;
    if (!c || c.challengeDone) return;
    c.challengeDone = true;
    this.stats.challenges++;
    const label = t('bonus', this.lang) + ': ' + c.challenge.text[this.lang];
    c.receipt.push({ label, amount: c.challenge.bonus });
    this.ledger.push({ label, amount: c.challenge.bonus });
    this.game.addMoney(c.challenge.bonus, 'bonus');
    this.game.toast(t('challengeDone', this.lang, { n: c.challenge.bonus }), 'good');
    this.notify();
  }

  // ---- data entry (the Lead Registry app) ---------------------------------------------
  collectVoucher(input) {
    const L = this.lang;
    const code = cleanCode(input);
    if (!code) return { ok: false, msg: t('voucherBad', L) };
    const v = this.vouchers.find((x) => cleanCode(x.code) === code);
    if (!v) { this.game.audio.uiError(); return { ok: false, msg: t('voucherBad', L) }; }
    if (v.used) return { ok: false, msg: t('voucherUsed', L) };
    if (v.expired) { this.game.audio.uiError(); return { ok: false, msg: t('voucherExpired', L) }; }
    v.used = true;
    const c = this.findCall(v.callId);
    if (v.fake) {
      this.stats.scambaited++;
      this.ledger.push({ label: `${v.code} · ${t('declined', L)}`, amount: -100 });
      if (c) c.receipt.push({ label: t('declined', L), amount: -100 });
      this.game.addMoney(-100, 'scambaited');
      this.game.toast(t('voucherFake', L), 'bad');
      this.game.emit('scambaited');
      this.notify();
      return { ok: false, msg: t('voucherFake', L), fake: true };
    }
    this.stats.earned += v.amount;
    const label = `${v.code} · ${v.markName} (${v.units} ${v.currency})`;
    this.ledger.push({ label, amount: v.amount });
    if (c) {
      c.earned += v.amount;
      c.pendingAmount = Math.max(0, c.pendingAmount - v.amount);
      c.receipt.push({ label: `${c.product[L]} (${v.units} ${v.currency})`, amount: v.amount });
      if (!c.closed) { c.closed = true; this.stats.closed++; }
    }
    this.game.addMoney(v.amount, 'sale');
    this.notify();
    return { ok: true, msg: t('voucherOk', L, { amount: money(v.amount) }) };
  }

  registerData(input) {
    const L = this.lang;
    const code = cleanCode(input);
    const h = code && this.heard.find((x) => cleanCode(x.value) === code);
    if (!h) { this.game.audio.uiError(); return { ok: false, msg: t('dataWrong', L) }; }
    if (h.registered) return { ok: true, msg: t('registered', L, { label: h.label }), entry: h };
    h.registered = true;
    this.game.audio.notify();
    this.notify();
    return { ok: true, msg: t('registered', L, { label: h.label }), entry: h };
  }

  sellData(h) {
    if (!h || !h.registered || h.sold) return;
    const L = this.lang;
    h.sold = true;
    this.stats.secrets++;
    const c = this.findCall(h.callId);
    if (h.fake) {
      this.ledger.push({ label: t('brokerFake', L), amount: -50 });
      if (c) c.receipt.push({ label: t('brokerFake', L), amount: -50 });
      this.game.addMoney(-50, 'scambaited');
      this.game.toast(t('brokerFakeToast', L), 'bad');
    } else {
      const label = t('brokerSold', L, { label: h.label });
      this.ledger.push({ label, amount: TUNE.secretPrice });
      if (c) c.receipt.push({ label, amount: TUNE.secretPrice });
      this.game.addMoney(TUNE.secretPrice, 'secret');
    }
    this.notify();
  }

  findCall(id) { return this.call && this.call.id === id ? this.call : this.history.find((c) => c.id === id) || null; }

  // ---- remote assist ---------------------------------------------------------------
  hackSucceeded() {
    const c = this.call;
    if (!c) return;
    c.hacked = true;
    c.secretKnown = true;
    this.hear(c);
    this.notify();
  }

  hackFailed() {
    const c = this.call;
    if (!c) return;
    c.hackFails = (c.hackFails || 0) + 1;
    c.patience = Math.max(0, c.patience - 20);
    this.addEvent("the caller's cursor is moving by itself on your computer screen and you noticed");
    this.notify();
  }

  // ---- ending ------------------------------------------------------------------------
  hangUp() { if (this.active) this.endCall('me'); }

  endCall(by) {
    const c = this.call;
    if (!c) return;
    if (c.abort) { try { c.abort.abort(); } catch { /* ignore */ } }
    const L = this.lang;
    if (c.mark.scambaiter && by === 'me' && c.turns <= 4 && !c.receipt.some((x) => x.amount < 0)) {
      c.receipt.push({ label: t('baiterDodged', L), amount: 50 });
      this.ledger.push({ label: t('baiterDodged', L), amount: 50 });
      this.game.addMoney(50, 'bonus');
      this.game.toast(t('baiterDodgedToast', L), 'good');
    }
    c.endedBy = by;
    this.history.unshift(c);
    this.history = this.history.slice(0, 20);
    this.state = 'wrapup';
    this.timer = 5;
    this.busy = false;
    this.pending = '';
    this.game.audio.hangup();
    this.game.voice.cancel();
    if (this.game.music) this.game.music.setPhoneMode(false);
    this.notify();
    this.game.emit('callEnded', c);
  }

  async handleBrainError(e, c, said, events) {
    const L = this.lang;
    const code = e && e.code;
    if (code === 'cancelled') return null;
    if (code === 'rate_limited') {
      this.linesDown = true;
      this.game.emit('linesDown');
      c.transcript.push({ who: 'event', text: t('lineDead', L) });
      this.endCall('mark');
      return null;
    }
    if (['not_granted', 'sampling_disabled', 'capability_disabled', 'capability_removed', 'not_declared', 'session_expired'].includes(code)) {
      this.game.toast(t('backupBrain', L), 'warn');
      this.setBrain(this.backup);
      this.game.emit('brainChanged', 'backup');
      return this.backup.reply(c, said, events);
    }
    if (code === 'refused' || code === 'empty_completion' || code === 'invalid_request') return this.backup.reply(c, said, events);
    this.game.toast(t('static', L), 'warn');
    c.transcript.pop();
    c.turns--;
    this.game.emit('restoreDraft', said);
    return null;
  }

  continueWithBackup() {
    this.linesDown = false;
    this.setBrain(this.backup);
    this.notify();
  }

  // pending vouchers worth typing in
  get openVouchers() { return this.vouchers.filter((v) => !v.used && !v.expired); }
}
