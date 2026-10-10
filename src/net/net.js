// Multiplayer over "presence": every player publishes one small state object
// (position, animation, desk, ...) plus a short log of recent events. Works
// over the claude.ai room capability, a WebSocket relay, or P2P (trystero).
export class Net {
  constructor(transport) {
    this.transport = transport;
    this.selfId = transport.selfId || 'me';
    this.state = {};
    this.log = [];
    this.seq = 0;
    this.handlers = {};
    this.seen = new Map();
    this.sendT = 0;
    this.dirty = true;
    this.peerCache = [];
  }

  get connected() { return this.transport.connected ? this.transport.connected() : false; }
  get solo() { return this.transport.kind === 'solo'; }
  get kind() { return this.transport.kind; }

  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  set(patch) { Object.assign(this.state, patch); this.dirty = true; }

  emit(ev, data) {
    this.seq++;
    this.log.push([this.seq, ev, data]);
    while (this.log.length > 8) this.log.shift();
    this.dirty = true;
    this.flush(true);
  }

  flush(force = false) {
    if (!force && !this.dirty) return;
    this.dirty = false;
    const p = { ...this.state, v: 2, ev: this.log, sq: this.seq };
    let s = JSON.stringify(p);
    // the room caps presence at 4 KiB: keep a margin for multi-byte characters
    const size = (x) => new TextEncoder().encode(x).length;
    while (size(s) > 3700 && p.ev.length > 0) { p.ev = p.ev.slice(1); s = JSON.stringify(p); }
    this.transport.setPresence(p);
  }

  update(dt) {
    this.sendT -= dt;
    if (this.sendT <= 0) { this.sendT = 1 / 15; this.flush(); }
    const peers = this.transport.peers();
    this.peerCache = peers;
    for (const p of peers) {
      if (p.isMe || !p.presence || p.presence.v !== 2) continue;
      const evs = Array.isArray(p.presence.ev) ? p.presence.ev : [];
      // first sight: skip what happened before we arrived
      const last = this.seen.get(p.id) ?? p.presence.sq ?? 0;
      let max = last;
      for (const e of evs) {
        if (!Array.isArray(e) || typeof e[0] !== 'number' || e[0] <= last) continue;
        max = Math.max(max, e[0]);
        const hs = this.handlers[e[1]];
        if (hs) for (const fn of hs) { try { fn(e[2] || {}, p.id, p.presence); } catch (err) { console.warn(err); } }
      }
      this.seen.set(p.id, max);
    }
  }

  peers() { return this.peerCache.filter((p) => !p.isMe && p.presence && p.presence.v === 2); }
  hostId() { return [this.selfId, ...this.peers().map((p) => p.id)].sort()[0]; }
  isHost() { return this.hostId() === this.selfId; }
  hostPresence() {
    const h = this.hostId();
    if (h === this.selfId) return this.state;
    const p = this.peers().find((x) => x.id === h);
    return p ? p.presence : null;
  }
  leave() { if (this.transport.leave) this.transport.leave(); }
}

export class SoloTransport {
  constructor() { this.kind = 'solo'; this.selfId = 'me-' + Math.random().toString(36).slice(2, 7); }
  setPresence(p) { this.me = p; }
  peers() { return []; }
  connected() { return false; }
}

// claude.ai artifact room (presence capability)
export class RoomTransport {
  constructor(room, selfId) {
    this.kind = 'room';
    this.room = room;
    this.selfId = selfId;
    this._peers = [];
    this.unsub = room.onPeers((e) => { this._peers = e.peers; });
  }

  static async join(room, code) {
    const r = await room.join('pb-' + code);
    let me = null;
    for (let i = 0; i < 40 && !me; i++) {
      const p = r.peers().find((x) => x.isMe && x.sameTab);
      if (p) me = p.peer; else await new Promise((res) => setTimeout(res, 100));
    }
    return new RoomTransport(r, me || 'me-' + Math.random().toString(36).slice(2, 7));
  }

  setPresence(p) { this.room.presence(p).catch(() => {}); }
  peers() { return this.room.peers().map((p) => ({ id: p.peer, isMe: p.isMe && p.sameTab, presence: p.presence, guest: p.guest })); }
  connected() { return this.room.connected(); }
  leave() { try { if (this.unsub) this.unsub(); this.room.leave(); } catch { /* ignore */ } }
}

// tiny WebSocket relay (server/relay.mjs)
export class WsTransport {
  constructor(url, room) {
    this.kind = 'ws';
    this.selfId = 'p' + Math.random().toString(36).slice(2, 9);
    this.map = new Map();
    this.open = false;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => { this.open = true; this.ws.send(JSON.stringify({ t: 'join', room, id: this.selfId })); };
    this.ws.onclose = () => { this.open = false; };
    this.ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'p' && m.id !== this.selfId) this.map.set(m.id, m.p);
      if (m.t === 'leave') this.map.delete(m.id);
    };
  }
  setPresence(p) { if (this.open) this.ws.send(JSON.stringify({ t: 'p', p })); }
  peers() { const out = [{ id: this.selfId, isMe: true, presence: null }]; for (const [id, p] of this.map) out.push({ id, isMe: false, presence: p }); return out; }
  connected() { return this.open; }
  leave() { try { this.ws.close(); } catch { /* ignore */ } }
}

// serverless P2P for the downloadable build (WebRTC through public signalling)
export class P2PTransport {
  static async join(code) {
    const { joinRoom, selfId } = await import('trystero/nostr');
    const room = joinRoom({ appId: 'phony-business-v2' }, 'pb-' + code);
    return new P2PTransport(room, selfId);
  }

  constructor(room, selfId) {
    this.kind = 'p2p';
    this.room = room;
    this.selfId = selfId;
    this.map = new Map();
    // trystero >= 0.22: actions are objects with send() and an onMessage property
    const act = room.makeAction('p');
    this.send = (d) => Promise.resolve(act.send(d)).catch(() => {});
    act.onMessage = (data, meta) => { const peer = meta && meta.peerId ? meta.peerId : meta; this.map.set(peer, { p: data, t: performance.now() }); };
    room.onPeerLeave = (peer) => this.map.delete(peer);
    room.onPeerJoin = () => { if (this.last) this.send(this.last); };
  }

  setPresence(p) { this.last = p; try { this.send(p); } catch { /* not connected yet */ } }
  peers() {
    const out = [{ id: this.selfId, isMe: true, presence: null }];
    const now = performance.now();
    for (const [id, e] of this.map) if (now - e.t < 8000) out.push({ id, isMe: false, presence: e.p });
    return out;
  }
  connected() { return this.map.size > 0; }
  leave() { try { this.room.leave(); } catch { /* ignore */ } }
}
