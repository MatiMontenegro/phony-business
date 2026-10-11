// The switchboard: phones ring at random desks around the office. The host
// decides where and who is calling; everyone hears the rings where they
// are, and whoever sits at that desk can pick it up (logged in as themselves).
import { TUNE } from '../config.js';
import { MARKS, SCENARIOS, CHALLENGES, pickMark, markById, pickScenario } from '../ai/marks.js';
import { t } from '../i18n.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const uid = () => Math.random().toString(36).slice(2, 8);

export class Switchboard {
  constructor(game) {
    this.game = game;
    this.rings = []; // {id, d, mk, pr, ch, age}
    this.timer = 2.5;
    this.lastMark = null;
    this.taken = new Map(); // ring id -> time it was taken (ignore echoes)
    this.bursts = new Map(); // ring id -> seconds to the next ring burst
    this.mine = new Set(); // ids I picked up (hide them until the host catches up)
  }

  get isHost() { return this.game.net.isHost(); }

  // fewer ringing phones than players, so answering is a scramble:
  // 1 player -> 1, 2 -> 1, 3 -> 2, 4 -> 3, 5+ -> 3 (capped at TUNE.maxRings+1).
  maxRings() {
    const n = this.game.playerCount();
    return Math.max(1, Math.min(TUNE.maxRings + 1, n - 1 || 1));
  }

  ringAt(deskIndex) { return this.rings.find((r) => r.d === deskIndex && !this.mine.has(r.id)) || null; }

  // a desk can ring if nobody there is on a call and it is not already ringing
  freeDesks() {
    const g = this.game;
    const busy = new Set(this.rings.map((r) => r.d));
    if (g.me && g.me.desk && g.calls.state !== 'idle') busy.add(g.me.desk.index);
    for (const r of g.remotes.values()) if (r.deskIndex >= 0 && r.onCall) busy.add(r.deskIndex);
    return g.office.desks.filter((d) => !busy.has(d.index));
  }

  seatedIdle() {
    const g = this.game, out = [];
    if (g.me && g.me.mode === 'seated' && g.calls.state === 'idle') out.push(g.me.desk.index);
    for (const r of g.remotes.values()) if (r.mode === 'seated' && r.deskIndex >= 0 && !r.onCall) out.push(r.deskIndex);
    return out;
  }

  spawnRing() {
    const free = this.freeDesks();
    if (!free.length) return;
    const idle = this.seatedIdle().filter((i) => free.some((d) => d.index === i) && !this.rings.some((r) => r.d === i));
    // half the time a seated, idle agent gets it; otherwise any desk in the office
    const d = idle.length && Math.random() < 0.5 ? idle[Math.floor(Math.random() * idle.length)] : free[Math.floor(Math.random() * free.length)].index;
    const m = pickMark(Math.random, this.lastMark);
    this.lastMark = m.id;
    // decided here (by the host) so the whole office agrees on who is secretly a scambaiter
    const bt = Math.random() < TUNE.baiterChance ? 1 : 0;
    const ring = { id: uid(), d, mk: m.id, sc: pickScenario(), ch: CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)].id, bt, age: 0 };
    this.rings.push(ring);
    this.game.emit('ring', ring);
  }

  hostUpdate(dt) {
    const g = this.game;
    const running = g.mode === 'play' && g.shift.state === 'run';
    for (const [id, at] of this.taken) if (g.time - at > 30) this.taken.delete(id);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age > TUNE.ringTimeout || !running) {
        this.rings.splice(i, 1);
        if (running) this.missed(r);
      }
    }
    if (!running) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.rings.length < this.maxRings() && !g.calls.linesDown) {
        this.spawnRing();
        this.timer = rnd(TUNE.ringEvery[0], TUNE.ringEvery[1]) * (this.rings.length > 1 ? 1.4 : 1);
      } else this.timer = 1;
    }
  }

  // nobody picked it up: blame whoever sits there, or whoever is closest
  missed(r) {
    const g = this.game;
    const desk = g.office.desks[r.d];
    let who = null, best = 1e9;
    const consider = (id, pos) => { const d = pos.distanceTo(desk.seat); if (d < best) { best = d; who = id; } };
    if (g.me) consider(g.net.selfId, g.me.position);
    for (const rp of g.remotes.values()) consider(rp.id, rp.char.position);
    g.emitNet('missed', { d: r.d });
    g.onMissedCall(r.d, who);
  }

  // someone (maybe me) picked up ring `id`
  take(id, by) {
    const i = this.rings.findIndex((r) => r.id === id);
    if (i >= 0) this.rings.splice(i, 1);
    this.taken.set(id, this.game.time);
    this.bursts.delete(id);
    if (by === this.game.net.selfId) this.mine.add(id);
  }

  // local player answers the ring at their desk
  pickUp(ring) {
    const g = this.game;
    this.mine.add(ring.id);
    if (this.isHost) this.take(ring.id, g.net.selfId);
    else g.emitNet('take', { id: ring.id });
    this.bursts.delete(ring.id);
  }

  mirror(rg) {
    if (!Array.isArray(rg)) { this.rings = []; return; }
    const out = [];
    for (const a of rg.slice(0, 8)) {
      if (!Array.isArray(a)) continue;
      const [id, d, mk, sc, ch, age, bt] = a;
      if (typeof id !== 'string' || !Number.isInteger(d) || !this.game.office.desks[d] || !markById(mk)) continue;
      out.push({ id: id.slice(0, 8), d, mk, sc: Math.max(0, Math.min(SCENARIOS.length - 1, sc | 0)), ch: String(ch || ''), age: +age || 0, bt: bt ? 1 : 0 });
    }
    for (const r of out) if (!this.rings.some((x) => x.id === r.id)) this.game.emit('ring', r);
    this.rings = out;
    // forget ids the host has dropped
    for (const id of this.mine) if (!out.some((r) => r.id === id)) this.mine.delete(id);
  }

  netState() { return this.rings.map((r) => [r.id, r.d, r.mk, r.sc, r.ch, Math.round(r.age), r.bt ? 1 : 0]); }

  update(dt) {
    const g = this.game;
    if (this.isHost) this.hostUpdate(dt);
    else {
      const hp = g.net.hostPresence();
      this.mirror(hp && hp.rn);
      for (const r of this.rings) r.age += dt;
    }
    // desk flags + ring bursts from each monitor
    for (const d of g.office.desks) d.ringing = null;
    for (const r of this.rings) {
      if (this.mine.has(r.id)) continue;
      const desk = g.office.desks[r.d];
      desk.ringing = r;
      let b = this.bursts.get(r.id);
      if (b === undefined) b = Math.random() * 0.6;
      b -= dt;
      if (b <= 0) {
        b = 2.6;
        const near = g.me && g.me.desk === desk;
        g.audio.ringBurst(desk.monitorWorld, near ? 0.75 : 0.55);
        desk.ringFlash = 1;
      }
      this.bursts.set(r.id, b);
    }
    for (const id of this.bursts.keys()) if (!this.rings.some((r) => r.id === id)) this.bursts.delete(id);
    for (const d of g.office.desks) if (d.ringFlash) d.ringFlash = Math.max(0, d.ringFlash - dt * 1.5);
  }

  // label for the HUD
  summary(lang) {
    const n = this.rings.filter((r) => !this.mine.has(r.id)).length;
    if (!n) return '';
    return n === 1 ? t('ringing', lang) : t('ringingN', lang, { n });
  }

  reset() {
    this.rings = [];
    this.mine.clear();
    this.bursts.clear();
    this.timer = 3;
  }
}

export { MARKS };
