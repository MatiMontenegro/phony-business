// What the desk monitors show: vacant desks, phones ringing, logging in under
// your name, your desktop with the live call, and coworkers' screens. Drawn
// on each monitor's canvas so the call lives on the PC, not in the HUD.
import * as TX from '../engine/textures.js';
import { t } from '../i18n.js';

export const C = {
  bg: '#141032', bg2: '#1f1850', win: '#120e2e', bar: '#31275f', line: '#4a3f86', crt: '#8fa7ff',
  postit: '#ffd84d', hot: '#ff4d5e', cash: '#46e3a0', paper: '#f6f1e3', muted: '#b3a9dc', ink: '#1a1433',
};
const F = TX.FONT;
const clock = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const lineLabel = (d, L) => (L === 'es' ? 'LÍNEA ' : 'LINE ') + String(d.index + 1).padStart(2, '0');

function rr(g, x, y, w, h, r) { TX.roundRect(g, x, y, w, h, r); }

function crt(g, w, h, flicker = 0) {
  g.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, w * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${0.5 + flicker})`);
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}

function wallpaper(g, w, h, time, tint = C.crt) {
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, '#2a1d55');
  grd.addColorStop(1, '#0d0a1f');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.save();
  g.globalAlpha = 0.07;
  g.fillStyle = tint;
  g.font = `120px ${F.display}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.translate(w / 2, h / 2 - 20);
  g.rotate(-0.08);
  g.fillText('Phony', 0, -40);
  g.fillText('Business', 30, 70);
  g.restore();
}

function taskbar(g, w, h, label, time, tray = '') {
  g.fillStyle = 'rgba(12,9,32,0.94)';
  g.fillRect(0, h - 36, w, 36);
  g.fillStyle = C.postit;
  rr(g, 6, h - 31, 92, 26, 6); g.fill();
  g.fillStyle = C.ink;
  g.font = `20px ${F.display}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText('ScamOS', 14, h - 17);
  g.fillStyle = C.crt;
  g.font = `600 14px ${F.mono}`;
  g.fillText(label, 110, h - 17);
  g.textAlign = 'right';
  g.fillStyle = C.paper;
  g.fillText(tray, w - 12, h - 17);
}

function bar(g, x, y, w, h, k, col, label) {
  g.fillStyle = 'rgba(143,167,255,0.18)';
  rr(g, x, y, w, h, h / 2); g.fill();
  g.fillStyle = col;
  rr(g, x, y, Math.max(h, w * Math.max(0, Math.min(1, k))), h, h / 2); g.fill();
  if (label) {
    g.fillStyle = C.muted;
    g.font = `600 12px ${F.mono}`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(label, x, y - 5);
  }
}

function windowFrame(g, x, y, w, h, title, right = '') {
  g.fillStyle = 'rgba(0,0,0,0.35)';
  rr(g, x + 4, y + 6, w, h, 10); g.fill();
  g.fillStyle = C.win;
  rr(g, x, y, w, h, 10); g.fill();
  g.strokeStyle = C.line;
  g.lineWidth = 2;
  rr(g, x, y, w, h, 10); g.stroke();
  g.save();
  rr(g, x, y, w, 30, 10); g.clip();
  g.fillStyle = C.bar;
  g.fillRect(x, y, w, 30);
  g.restore();
  g.fillStyle = C.paper;
  g.font = `700 15px ${F.body}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(title, x + 12, y + 16);
  if (right) { g.textAlign = 'right'; g.fillStyle = C.crt; g.font = `600 13px ${F.mono}`; g.fillText(right, x + w - 12, y + 16); }
}

function wrap(g, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function hints(g, w, y, items) {
  g.font = `600 13px ${F.mono}`;
  g.textBaseline = 'middle';
  let total = 0;
  const parts = items.map(([k, label]) => {
    const kw = g.measureText(k).width + 12;
    const lw = g.measureText(label).width;
    total += kw + lw + 22;
    return { k, label, kw, lw };
  });
  let x = Math.max(8, (w - total) / 2);
  for (const p of parts) {
    g.fillStyle = C.paper;
    rr(g, x, y - 11, p.kw, 22, 5); g.fill();
    g.fillStyle = C.ink;
    g.textAlign = 'center';
    g.fillText(p.k, x + p.kw / 2, y + 1);
    g.fillStyle = C.paper;
    g.textAlign = 'left';
    g.fillText(p.label, x + p.kw + 6, y + 1);
    x += p.kw + p.lw + 22;
  }
}

// ---- states ---------------------------------------------------------------------------
export function drawVacant(d, time, L) {
  const c = d.screenCanvas, g = c.getContext('2d'), w = c.width, h = c.height;
  wallpaper(g, w, h, time);
  const x = 60 + Math.abs(((time * 60 + d.index * 90) % ((w - 260) * 2)) - (w - 260));
  const y = 60 + Math.abs(((time * 40 + d.index * 50) % ((h - 190) * 2)) - (h - 190));
  g.fillStyle = [C.postit, C.hot, C.cash, C.crt][Math.floor(time / 3 + d.index) % 4];
  g.font = `52px ${F.display}`;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText('Phony', x, y);
  taskbar(g, w, h, lineLabel(d, L), time, L === 'es' ? 'puesto libre' : 'desk vacant');
  crt(g, w, h);
}

export function drawRinging(d, time, L, mark, mine) {
  const c = d.screenCanvas, g = c.getContext('2d'), w = c.width, h = c.height;
  const on = Math.floor(time * 4) % 2 === 0;
  g.fillStyle = on ? '#3a0f2a' : C.bg;
  g.fillRect(0, 0, w, h);
  g.save();
  g.translate(w / 2, h / 2 - 60);
  g.rotate(Math.sin(time * 30) * 0.05);
  g.fillStyle = on ? C.hot : C.postit;
  g.font = `86px ${F.display}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(L === 'es' ? '¡Ring!' : 'Ring!', 0, 0);
  g.restore();
  g.textAlign = 'center';
  g.fillStyle = C.paper;
  g.font = `700 28px ${F.body}`;
  g.fillText(mark ? mark.name : '', w / 2, h / 2 + 30);
  g.fillStyle = C.muted;
  g.font = `18px ${F.body}`;
  g.fillText(mark ? mark.title[L] : '', w / 2, h / 2 + 64);
  if (mine) hints(g, w, h - 70, [['Enter', L === 'es' ? 'Atender' : 'Answer']]);
  else {
    g.fillStyle = C.postit;
    g.font = `600 17px ${F.mono}`;
    g.fillText(L === 'es' ? 'SENTATE PARA ATENDER' : 'SIT DOWN TO ANSWER', w / 2, h - 70);
  }
  taskbar(g, w, h, lineLabel(d, L), time, L === 'es' ? 'ENTRANTE' : 'INCOMING');
  crt(g, w, h, on ? 0.1 : 0);
}

export function drawLogin(d, time, L, name, color, k) {
  const c = d.screenCanvas, g = c.getContext('2d'), w = c.width, h = c.height;
  wallpaper(g, w, h, time, color);
  g.fillStyle = 'rgba(12,9,32,0.55)';
  g.fillRect(0, 0, w, h);
  g.fillStyle = color || C.crt;
  g.beginPath(); g.arc(w / 2, h / 2 - 70, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = C.ink;
  g.font = `48px ${F.display}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText((name || '?')[0].toUpperCase(), w / 2, h / 2 - 66);
  g.fillStyle = C.paper;
  g.font = `700 24px ${F.body}`;
  g.fillText(t('loggingIn', L, { name }), w / 2, h / 2 + 10);
  bar(g, w / 2 - 150, h / 2 + 46, 300, 10, k, C.cash);
  g.fillStyle = C.muted;
  g.font = `14px ${F.mono}`;
  g.fillText(`ScamOS 3.1 · ${lineLabel(d, L)}`, w / 2, h - 40);
  crt(g, w, h);
}

// your own desktop as seen from the chair (the full-screen PC has the same look)
export function drawMine(d, time, L, s) {
  const c = d.screenCanvas, g = c.getContext('2d'), w = c.width, h = c.height;
  wallpaper(g, w, h, time, s.color);
  const call = s.call;
  const tray = `${s.clock}  ${s.mic ? '● ' : ''}`;
  if (s.state === 'ringing') {
    windowFrame(g, 70, 60, w - 140, h - 150, t('appPhone', L), lineLabel(d, L));
    const on = Math.floor(time * 4) % 2 === 0;
    g.fillStyle = on ? C.hot : C.postit;
    g.font = `60px ${F.display}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t('incoming', L), w / 2, 150);
    g.fillStyle = C.paper;
    g.font = `700 26px ${F.body}`;
    g.fillText(s.mark.name, w / 2, 215);
    g.fillStyle = C.muted;
    g.font = `17px ${F.body}`;
    g.fillText(s.mark.title[L], w / 2, 246);
    hints(g, w, 300, [['Enter', t('answer', L)]]);
  } else if (call && (s.state === 'connected' || s.state === 'hold')) {
    // big and minimal: readable from the chair (details live in the full-screen PC)
    const x0 = 14, y0 = 12, ww = w - 28, wh = h - 60;
    windowFrame(g, x0, y0, ww, wh, `${t('appPhone', L)} · ${lineLabel(d, L)}`, clock(call.elapsed));
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = C.paper;
    g.font = `800 30px ${F.body}`;
    g.fillText(call.mark.name, x0 + 16, y0 + 70);
    g.fillStyle = C.crt;
    g.font = `17px ${F.mono}`;
    g.fillText(call.product[L].slice(0, 44), x0 + 16, y0 + 96);
    const bw = (ww - 48) / 2;
    bar(g, x0 + 16, y0 + 128, bw, 16, call.trust / 100, C.cash, `${L === 'es' ? 'CONFIANZA' : 'TRUST'} ${Math.round(call.trust)}`);
    bar(g, x0 + 32 + bw, y0 + 128, bw, 16, call.patience / 100, C.postit, `${L === 'es' ? 'PACIENCIA' : 'PATIENCE'} ${Math.round(call.patience)}`);
    // what the customer just said
    const lastMark = [...call.transcript].reverse().find((m) => m.who === 'mark');
    const lastMe = [...call.transcript].reverse().find((m) => m.who === 'me');
    const by = y0 + 162;
    g.fillStyle = s.speaking ? '#2f2470' : '#221a52';
    rr(g, x0 + 14, by, ww - 28, 170, 12); g.fill();
    g.strokeStyle = s.speaking ? C.crt : C.line;
    g.lineWidth = 2;
    rr(g, x0 + 14, by, ww - 28, 170, 12); g.stroke();
    g.fillStyle = C.paper;
    g.font = `600 23px ${F.body}`;
    const ml = s.busy ? [`${call.mark.name.split(' ')[0]} ${t('thinking', L)}`] : wrap(g, lastMark ? lastMark.text : '', ww - 60);
    ml.slice(-5).forEach((l, i) => g.fillText(l, x0 + 30, by + 36 + i * 30));
    // you
    const mine = s.partial ? `${t('you', L)}: ${s.partial}…` : lastMe ? `${t('you', L)}: ${lastMe.text}` : '';
    g.font = `600 19px ${F.body}`;
    g.fillStyle = s.partial ? 'rgba(255,216,77,0.75)' : C.postit;
    wrap(g, mine, ww - 40).slice(-2).forEach((l, i) => g.fillText(l, x0 + 20, by + 202 + i * 24));
    // voice line
    g.strokeStyle = s.speaking ? C.hot : s.listening ? C.cash : 'rgba(255,77,94,0.35)';
    g.lineWidth = 3;
    g.beginPath();
    const wy = y0 + wh - 22;
    for (let x = 0; x <= ww - 220; x += 6) {
      const amp = s.speaking ? 12 : s.listening ? 3 + s.level * 18 : 1.5;
      const y = wy + Math.sin(x * 0.09 + time * 18) * amp * Math.sin(x * 0.014 + time * 3);
      if (x === 0) g.moveTo(x0 + 16 + x, y); else g.lineTo(x0 + 16 + x, y);
    }
    g.stroke();
    if (s.vouchers) {
      g.fillStyle = C.hot;
      rr(g, w - 214, wy - 16, 190, 32, 16); g.fill();
      g.fillStyle = '#fff';
      g.font = `800 16px ${F.body}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(t('pendingV', L, { n: s.vouchers }), w - 119, wy);
    }
    if (s.state === 'hold') {
      g.fillStyle = 'rgba(12,9,32,0.78)';
      g.fillRect(x0, y0 + 30, ww, wh - 30);
      g.fillStyle = C.postit;
      g.font = `52px ${F.display}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(t('onHold', L), w / 2, h / 2);
    }
  } else if (call && s.state === 'wrapup') {
    windowFrame(g, 120, 30, w - 240, h - 90, t('receipt', L), call.mark.name);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = `15px ${F.mono}`;
    let y = 96;
    const items = call.receipt.length ? call.receipt : [{ label: t('noSale', L), amount: 0 }];
    for (const it of items.slice(-8)) {
      g.fillStyle = C.paper;
      g.fillText(it.label.slice(0, 34), 138, y);
      g.textAlign = 'right';
      g.fillStyle = it.amount < 0 ? C.hot : C.cash;
      g.fillText((it.amount < 0 ? '-$' : '$') + Math.abs(it.amount), w - 138, y);
      g.textAlign = 'left';
      y += 24;
    }
    if (call.pendingAmount > 0) {
      g.fillStyle = C.postit;
      g.fillText(L === 'es' ? `Por cobrar: $${call.pendingAmount}` : `To collect: $${call.pendingAmount}`, 138, y + 10);
    }
  } else {
    windowFrame(g, 70, 50, w - 140, h - 140, t('appPhone', L), lineLabel(d, L));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = C.paper;
    g.font = `700 24px ${F.body}`;
    g.fillText(t('welcomeUser', L, { name: s.name }), w / 2, 120);
    g.fillStyle = C.muted;
    g.font = `16px ${F.body}`;
    wrap(g, s.linesDown ? t('linesDownTitle', L) : t('noCall', L), w - 220).forEach((l, i) => g.fillText(l, w / 2, 160 + i * 22));
    if (s.vouchers) {
      g.fillStyle = C.hot;
      g.font = `700 18px ${F.body}`;
      g.fillText(t('pendingV', L, { n: s.vouchers }), w / 2, 250);
      g.fillStyle = C.paper;
      g.font = `14px ${F.mono}`;
      g.fillText(L === 'es' ? 'Abrí la PC para cobrarlos' : 'Open the PC to collect them', w / 2, 276);
    }
    hints(g, w, h - 52, [[s.keys.pc, 'PC'], [s.keys.use, t('stand', L)]]);
  }
  taskbar(g, w, h, s.name, time, tray);
  crt(g, w, h);
}

// a coworker's screen: their name, and a voice line when they are on a call
export function drawOther(d, time, L, name, color, onCall) {
  const c = d.screenCanvas, g = c.getContext('2d'), w = c.width, h = c.height;
  wallpaper(g, w, h, time, color);
  windowFrame(g, 60, 60, w - 120, h - 150, onCall ? (L === 'es' ? 'En llamada' : 'On a call') : t('appPhone', L), name);
  if (onCall) {
    g.strokeStyle = C.hot;
    g.lineWidth = 4;
    g.beginPath();
    for (let x = 0; x <= w - 160; x += 6) {
      const y = h / 2 + Math.sin(x * 0.08 + time * 18) * 26 * Math.sin(x * 0.013 + time * 3);
      if (x === 0) g.moveTo(80 + x, y); else g.lineTo(80 + x, y);
    }
    g.stroke();
  } else {
    g.fillStyle = C.muted;
    g.font = `18px ${F.body}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(L === 'es' ? 'esperando llamada...' : 'waiting for a call...', w / 2, h / 2);
  }
  taskbar(g, w, h, name, time, lineLabel(d, L));
  crt(g, w, h);
}

const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

function flapText(g, text, x, y, w, h, col) {
  const n = text.length, cw = w / n;
  g.font = `600 ${Math.floor(h * 0.62)}px ${F.mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const cx = x + i * cw;
    g.fillStyle = '#211a40';
    rr(g, cx + 2, y, cw - 4, h, 6); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(cx + 2, y + h / 2 - 1, cw - 4, 2);
    g.fillStyle = col;
    g.fillText(text[i], cx + cw / 2, y + h / 2 + 2);
  }
}

export function drawQuotaBoard(board, earned, quota, left, L, rings) {
  const c = board.canvas, g = c.getContext('2d'), w = c.width, h = c.height;
  g.fillStyle = '#0c0920';
  g.fillRect(0, 0, w, h);
  g.fillStyle = C.postit;
  g.font = `34px ${F.display}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(L === 'es' ? 'Cuota' : 'Quota', 22, 56);
  g.fillStyle = rings ? C.hot : C.crt;
  g.font = `600 22px ${F.mono}`;
  g.textAlign = 'right';
  g.fillText(rings ? (L === 'es' ? `☎ ${rings} SONANDO` : `☎ ${rings} RINGING`) : (L === 'es' ? 'FIN DE TURNO ' : 'SHIFT ENDS ') + clock(left), w - 22, 56);
  flapText(g, money(earned).padStart(8, ' ') + ' / ' + money(quota), 22, 112, w - 44, 112, earned >= quota ? C.cash : C.paper);
  const k = Math.max(0, Math.min(1, earned / Math.max(1, quota)));
  g.fillStyle = 'rgba(143,167,255,0.18)';
  g.fillRect(22, 236, w - 44, 10);
  g.fillStyle = earned >= quota ? C.cash : C.hot;
  g.fillRect(22, 236, (w - 44) * k, 10);
  board.tex.needsUpdate = true;
}

// ---- scheduler --------------------------------------------------------------------------
export class Screens {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.next = new Map(); // desk index -> time of next redraw
    this.login = null; // {desk, t}
    this.boardKey = '';
  }

  startLogin(desk) { this.login = { desk, t: 0 }; }
  get loggingIn() { return !!this.login; }

  update(dt) {
    const g = this.game, L = g.lang;
    this.t += dt;
    if (this.login) {
      this.login.t += dt;
      if (this.login.t > 1.25) { const d = this.login.desk; this.login = null; g.onLoggedIn(d); }
    }
    const cam = g.renderer.camera;
    for (const d of g.office.desks) {
      const mine = g.me && g.me.desk === d;
      const dist = d.monitorWorld.distanceTo(cam.position);
      if (!mine && dist > 16) continue;
      // facing away from the camera: nobody can see it
      const toCam = cam.position.clone().sub(d.screenCenter);
      if (!mine && toCam.dot(d.screenNormal) < 0) continue;
      const due = this.next.get(d.index) || 0;
      if (this.t < due) continue;
      const ring = d.ringing;
      let rate;
      if (mine) {
        rate = 1 / 12;
        if (this.login && this.login.desk === d) drawLogin(d, this.t, L, g.profile.name, g.profile.look.shirt.color, Math.min(1, this.login.t / 1.15));
        else drawMine(d, this.t, L, g.screenState(d));
      } else if (ring) {
        rate = 1 / 8;
        const mk = g.markFor(ring);
        drawRinging(d, this.t, L, mk, false);
      } else if (d.owner) {
        const r = g.remotes.get(d.owner);
        rate = r && r.onCall ? 1 / 8 : 0.5;
        drawOther(d, this.t, L, r ? r.name : '', r ? r.color : C.crt, !!(r && r.onCall));
      } else {
        rate = dist < 6 ? 1 / 6 : 0.5;
        drawVacant(d, this.t, L);
      }
      d.screenTex.needsUpdate = true;
      this.next.set(d.index, this.t + rate);
      // brighter flash while ringing
      // your own screen is dimmer so the bloom does not wash out the text
      d.screenMat.color.setScalar((mine && g.isSeated ? 0.8 : 1.2) + (d.ringFlash || 0) * 0.9);
      d.led.material.emissive.set(ring ? '#ff4d5e' : d.owner ? '#ffd84d' : '#46e3a0');
    }
    // quota board
    const earned = g.teamMoney();
    const left = Math.max(0, g.shift.len - g.shift.t);
    const rings = g.switchboard.rings.length;
    const key = `${Math.round(earned)}|${g.shift.quota}|${Math.floor(left)}|${L}|${rings}`;
    if (key !== this.boardKey) { this.boardKey = key; drawQuotaBoard(g.office.quotaBoard, earned, g.shift.quota, left, L, rings); }
  }
}
