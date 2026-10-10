// Your phone line: the conversation with the mark, the fake data you coax out
// and the transfer receipts you type into the Lead Registry, bonus challenges,
// hold, the red-flags debrief, and what happens when the AI runs out.
import { TUNE } from '../config.js';
import { t } from '../i18n.js';
import {
  markById, pickMark, scenarioAt, pickScenario, CHALLENGES, challengeById,
  makeReceipt, makeData, dataThreshold, cleanCode, norm, saidValue, tacticsIn, TACTICS, DATA,
} from '../ai/marks.js';
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
    this.vouchers = []; // {code, amount, markId, markName, ttl, callId, fake, used}
    this.heard = []; // {key, value, label, price, markName, fake, registered, sold, callId}
    this.ledger = []; // {label, amount}
    this.history = [];
    this.stats = { calls: 0, closed: 0, earned: 0, data: 0, challenges: 0, scambaited: 0, expired: 0 };
    this.notify();
  }

  get lang() { return this.game.lang; }
  setBrain(b) { this.brain = b || this.backup; }
  get brainKind() { return this.brain.kind; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify() { for (const fn of this.listeners) { try { fn(this); } catch (e) { console.warn(e); } } }
  get active() { return this.state === 'connected' || this.state === 'hold'; }

  // build the fake data items this call is about
  makeLeads(mark, scenario) {
    const want = (scenario.targets || []).filter((k) => mark.data.includes(k));
    const keys = want.length ? want : [mark.data[0]];
    const chosen = keys.slice(0, 2);
    return chosen.map((key) => ({
      key, value: makeData(mark, key), label: DATA[key].label, short: DATA[key].short,
      price: DATA[key].price, threshold: dataThreshold(mark, key), known: false, registered: false,
    }));
  }

  // ---- picking up -----------------------------------------------------------------
  answer(ring) {
    if (this.active || this.linesDown) return false;
    const L = this.lang;
    const mark = markById(ring.mk) || pickMark();
    const scenario = scenarioAt(ring.sc);
    let challenge = challengeById(ring.ch);
    if (this.brain.kind === 'backup' && challenge.kind === 'llm') challenge = CHALLENGES.filter((c) => c.kind !== 'llm')[ring.sc % 8];
    const trust = Math.round(rnd(18, 30));
    this.call = {
      id: ring.id,
      mark,
      lang: L,
      scenario,
      challenge,
      leads: this.makeLeads(mark, scenario),
      budget: scenario.pay && mark.wealth ? Math.round(rnd(mark.wealth[0], mark.wealth[1])) : 0,
      paidUnits: 0,
      earned: 0,
      pendingAmount: 0,
      trust,
      startTrust: trust,
      patience: 100,
      mood: 'wary',
      opener: mark.opener[L],
      history: [],
      transcript: [],
      elapsed: 0,
      silence: 0,
      turns: 0,
      questionStreak: 0,
      hacked: false,
      dataCount: 0,
      firstDataAt: -1,
      challengeDone: false,
      fartAt: -99,
      events: [],
      receipt: [],
      tacticsSeen: new Set(),
      revealed: false,
      nextVoucher: makeReceipt(),
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
    // transfer receipts expire if nobody types them in
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
    for (const k of tacticsIn(said)) c.tacticsSeen.add(k);
    const events = c.events.splice(0);
    const ch = c.challenge;
    if (!c.challengeDone && ch.kind === 'fartblame' && c.elapsed - c.fartAt < 25 && ch.words.some((w) => norm(said).includes(norm(w)))) this.completeChallenge();
    if (!c.challengeDone && ch.kind === 'questions' && c.questionStreak >= ch.count) this.completeChallenge();
    c.nextVoucher = makeReceipt();
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
    // a payment always comes with a transfer code the agent has to write down
    if (r.pay > 0 && !cleanCode(line).includes(cleanCode(c.nextVoucher))) line += L === 'es' ? ` Confirmación: ${c.nextVoucher}.` : ` Confirmation: ${c.nextVoucher}.`;
    c.transcript.push({ who: 'mark', text: line });
    if (!r.spokeEarly) this.game.speakMark(c.mark, line);
    else if (c.earlyLine && line.length > c.earlyLine.length + 4 && !line.startsWith(c.earlyLine)) this.game.speakMark(c.mark, line.slice(c.earlyLine.length).trim() || line);
    c.earlyLine = null;
    const ch = c.challenge;
    if (!c.challengeDone && ((ch.kind === 'markSays' && ch.words.some((w) => norm(r.say).includes(norm(w)))) || (ch.kind === 'flag' && r[ch.flag]) || (ch.kind === 'llm' && r.challenge))) this.completeChallenge();
    // data the mark just gave up (detected by value, or flagged by a brain)
    const gave = Array.isArray(r.gave) ? r.gave : [];
    for (const lead of c.leads) {
      if (lead.known) continue;
      if (gave.includes(lead.key) || saidValue(line, lead.value)) this.gotData(c, lead);
    }
    if (r.pay > 0) {
      const fake = !!c.mark.scambaiter;
      const units = fake ? r.pay : Math.min(r.pay, c.budget - c.paidUnits);
      if (units > 0) {
        if (!fake) c.paidUnits += units;
        c.pendingAmount += fake ? 0 : units;
        this.vouchers.unshift({ code: c.nextVoucher, amount: units, markId: c.mark.id, markName: c.mark.name, ttl: TUNE.voucherTTL, callId: c.id, fake, used: false, expired: false });
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

  // the mark leaked one fake data item
  gotData(c, lead) {
    const L = this.lang;
    lead.known = true;
    c.dataCount++;
    if (c.firstDataAt < 0) c.firstDataAt = c.elapsed;
    const ch = c.challenge;
    if (!c.challengeDone && ch.kind === 'nohack' && !c.hacked) this.completeChallenge();
    if (!c.challengeDone && ch.kind === 'fast' && c.elapsed <= ch.seconds) this.completeChallenge();
    if (!c.challengeDone && ch.kind === 'twodata' && c.dataCount >= 2) this.completeChallenge();
    this.hear(c, lead);
    this.game.toast(t('secretGot', L, { label: lead.short[L] }), 'good');
  }

  hear(c, lead) {
    if (this.heard.some((h) => h.callId === c.id && h.key === lead.key)) return;
    const L = this.lang;
    this.heard.unshift({ key: lead.key, value: lead.value, label: lead.short[L], price: lead.price, markName: c.mark.name, fake: !!c.mark.scambaiter, registered: false, sold: false, callId: c.id });
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
    const label = `${v.code} · ${v.markName}`;
    this.ledger.push({ label, amount: v.amount });
    if (c) {
      c.earned += v.amount;
      c.pendingAmount = Math.max(0, c.pendingAmount - v.amount);
      c.receipt.push({ label: `${c.scenario.title[L]}`, amount: v.amount });
      if (!c.closed) { c.closed = true; this.stats.closed++; }
    }
    this.game.addMoney(v.amount, 'sale');
    this.notify();
    return { ok: true, msg: t('voucherOk', L, { amount: money(v.amount) }) };
  }

  registerData(input) {
    const L = this.lang;
    const code = cleanCode(input);
    const h = code && this.heard.find((x) => cleanCode(x.value) === code || saidValue(input, x.value));
    if (!h) { this.game.audio.uiError(); return { ok: false, msg: t('dataWrong', L) }; }
    if (h.registered) return { ok: true, msg: t('registered', L, { label: h.label }), entry: h };
    h.registered = true;
    this.stats.data++;
    this.game.audio.notify();
    this.notify();
    return { ok: true, msg: t('registered', L, { label: h.label }), entry: h };
  }

  sellData(h) {
    if (!h || !h.registered || h.sold) return;
    const L = this.lang;
    h.sold = true;
    const c = this.findCall(h.callId);
    if (h.fake) {
      this.ledger.push({ label: t('brokerFake', L), amount: -50 });
      if (c) c.receipt.push({ label: t('brokerFake', L), amount: -50 });
      this.game.addMoney(-50, 'scambaited');
      this.game.toast(t('brokerFakeToast', L), 'bad');
    } else {
      const label = t('brokerSold', L, { label: h.label });
      this.ledger.push({ label, amount: h.price });
      if (c) c.receipt.push({ label, amount: h.price });
      this.game.addMoney(h.price, 'secret');
    }
    this.notify();
  }

  findCall(id) { return this.call && this.call.id === id ? this.call : this.history.find((c) => c.id === id) || null; }

  // the educational debrief: which tactics the player used, with the real lesson
  flags(c) {
    const L = this.lang;
    const out = [];
    for (const k of c.tacticsSeen) { const tt = TACTICS[k]; if (tt && tt.tip) out.push({ label: tt.label[L], tip: tt.tip[L] }); }
    for (const f of (c.scenario.flags[L] || [])) out.push({ tip: f });
    return out.slice(0, 5);
  }

  // ---- remote assist ---------------------------------------------------------------
  hackSucceeded() {
    const c = this.call;
    if (!c) return;
    c.hacked = true;
    const lead = c.leads.find((l) => !l.known) || c.leads[0];
    if (lead) this.gotData(c, lead);
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
    c.debrief = this.flags(c);
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
    if (code === 'rate_limited' || code === 'no_credit') {
      this.linesDown = true;
      this.game.emit('linesDown', code);
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

  // pending receipts worth typing in
  get openVouchers() { return this.vouchers.filter((v) => !v.used && !v.expired); }
}
