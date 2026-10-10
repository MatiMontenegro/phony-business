// Tiny WebSocket relay for LAN parties and automated tests.
// Usage: node server/relay.mjs [port]   then open the game with ?relay=ws://HOST:PORT
import { WebSocketServer } from 'ws';

const port = Number(process.argv[2] || 8787);
const wss = new WebSocketServer({ port });
const rooms = new Map(); // room -> Map(id -> {ws, last})

wss.on('connection', (ws) => {
  let room = null, id = null;
  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(buf); } catch { return; }
    if (msg.t === 'join') {
      room = String(msg.room || 'main').slice(0, 48);
      id = String(msg.id || '').slice(0, 24);
      if (!rooms.has(room)) rooms.set(room, new Map());
      const r = rooms.get(room);
      for (const [pid, peer] of r) if (peer.last) ws.send(JSON.stringify({ t: 'p', id: pid, p: peer.last }));
      r.set(id, { ws, last: null });
      return;
    }
    if (msg.t === 'p' && room && id) {
      const r = rooms.get(room);
      const me = r.get(id);
      if (me) me.last = msg.p;
      const out = JSON.stringify({ t: 'p', id, p: msg.p });
      for (const [pid, peer] of r) if (pid !== id && peer.ws.readyState === 1) peer.ws.send(out);
    }
  });
  ws.on('close', () => {
    if (!room) return;
    const r = rooms.get(room);
    r.delete(id);
    for (const peer of r.values()) if (peer.ws.readyState === 1) peer.ws.send(JSON.stringify({ t: 'leave', id }));
    if (!r.size) rooms.delete(room);
  });
});
console.log(`relay listening on ws://localhost:${port}`);
