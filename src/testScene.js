// Deterministic scenes for screenshots and automated checks (?test=...).
import * as THREE from 'three';
import { Character } from './actors/character.js';
import { pumpBuilds, buildsPending } from './actors/avatar.js';
import { normalizeLook } from './actors/rig.js';
import { Net, SoloTransport } from './net/net.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function setupTestScene(game, ui, mode, platform) {
  game.step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) game.frame(dt); };
  game.tick = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) { game.time += dt; game.update(dt); game.input.endFrame(); } };
  game.settle = async (maxMs = 60000) => {
    const end = performance.now() + maxMs;
    while (buildsPending() && performance.now() < end) { pumpBuilds(50); await new Promise((r) => setTimeout(r, 0)); }
  };
  game.addDummy = (look, pos, yaw, state = 'idle', o = {}) => {
    const c = new Character(game.scene, game.physics, look, { capsule: false, async: true });
    c.setTransform(pos, yaw);
    c.animState = { state, speed: o.speed || 0, typing: !!o.typing, talking: !!o.talking };
    game.extras.push(c);
    return c;
  };
  if (mode === 'lobby') {
    ui.showLobby(async () => {});
    await game.settle();
    game.tick(30);
    game.step(2);
    return;
  }
  const q = new URLSearchParams(location.search);
  const profile = {
    name: q.get('name') || 'Matias',
    look: normalizeLook({ build: 'average', skin: '#eec0a0', hair: 'quiff', hairColor: '#3b2416', shirt: { style: 'buttonup', color: '#8fa7ff' }, tie: '#1a1433', face: { preset: 0 } }),
    code: 'test',
    lang: game.lang,
  };
  await game.joinShift(profile, new Net(new SoloTransport()));
  ui.enterGame();
  game.music.stop();
  const desks = game.office.desks;
  if (mode === 'busy' || mode === 'ring') {
    [2, 5, 7].forEach((i, k) => {
      const d = desks[i];
      game.addDummy({ build: ['slim', 'heavy', 'broad'][k], fem: k === 0 ? 1 : 0, shirt: { style: ['cardigan', 'hoodie', 'polo'][k], color: ['#c78bff', '#46e3a0', '#ffd84d'][k] }, hair: ['bob', 'buzz', 'afro'][k] }, d.seat, d.facing, 'sit', { typing: true, talking: k % 2 === 0 });
      game.props.holdChair(d.chair, d.seat, d.facing);
      d.owner = 'npc';
    });
  }
  const sb = game.switchboard;
  const ringAt = (d, mk = 'elvira', sc = 0) => { const r = { id: 'r' + d, d, mk, sc, ch: 'banana', age: 0 }; sb.rings.push(r); return r; };
  game.sitMe = (i = 0) => {
    const d = desks[i];
    game.me.controller.teleport(d.seat);
    game.me.char.position.copy(d.seat);
    game.me.sitAt(d);
  };
  game.forceRing = ringAt;
  sb.timer = 1e9; // no random rings in tests
  if (mode === 'ring') {
    game.me.spawn(V(0.5, 0, 4.2), Math.PI);
    ringAt(6, 'tito', 4);
    ringAt(3, 'lu', 1);
  }
  if (mode === 'seated' || mode === 'pc' || mode === 'call') {
    game.sitMe(+(q.get('desk') || 1));
    ringAt(+(q.get('desk') || 1), q.get('mark') || 'elvira', +(q.get('sc') || 2));
    await game.settle();
    game.tick(110);
    if (mode !== 'seated' || q.has('answer')) {
      game.answerAtMyDesk();
      const c = game.calls.call;
      const L = game.lang;
      c.transcript.push({ who: 'me', text: L === 'es' ? 'Hola doña Elvira, le hablo del banco. ¿Cómo anda Michi?' : 'Hi Mrs. Pereyra, I am calling from the bank. How is Michi the cat?' });
      c.transcript.push({ who: 'mark', text: L === 'es' ? 'Ay, ¡Michi está divino! Qué amable. Mire, mi clave es... MICHI12. ¿Está bien así?' : 'Oh, Michi is lovely! How kind. Well, my password is... MICHI12. Is that right?' });
      c.trust = 74; c.patience = 81; c.mood = 'trusting';
      if (c.leads[0]) { c.leads[0].known = true; c.leads[0].value = 'MICHI12'; }
      game.calls.vouchers.unshift({ code: 'TRF-4821', amount: 120, markId: 'elvira', markName: 'Doña Elvira', ttl: 71, callId: c.id, fake: false, used: false, expired: false });
      game.calls.notify();
    }
    if (mode === 'pc') {
      game.openPC();
      game.tick(70);
    }
  }
  await game.settle();
  game.tick(60);
  game.step(2);
}
