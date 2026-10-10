// ScamOS: the full-screen PC you get when you lean into your monitor. During
// the camera move the page is projected onto the 3D screen (CSS matrix3d), so
// the monitor turns into the real desktop. Apps: Phone, Lead Registry (type
// in voucher codes and customer data), Remote Assist, Notes and Mail.
import { $, clear, icon, money, clock, store } from './dom.js';
import { t } from '../i18n.js';
import { keyLabel, settings } from '../settings.js';
import { setPortrait } from './portrait.js';
import { usage } from '../ai/usage.js';
import { TUNE } from '../config.js';

// ---- projective mapping of the desktop onto the monitor ----------------------------------
function adj(m) {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}
function mm(a, b) {
  const c = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c[3 * i + j] = s; }
  return c;
}
function mv(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
function basis(x1, y1, x2, y2, x3, y3, x4, y4) {
  const m = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  const v = mv(adj(m), [x4, y4, 1]);
  return mm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}
// rectangle (0,0)-(w,h) onto quad [tl, tr, br, bl] in CSS pixels
export function quadMatrix(w, h, p) {
  const s = basis(0, 0, w, 0, 0, h, w, h);
  const d = basis(p[0].x, p[0].y, p[1].x, p[1].y, p[3].x, p[3].y, p[2].x, p[2].y);
  const m = mm(d, adj(s));
  for (let i = 0; i < 9; i++) m[i] /= m[8];
  return `matrix3d(${m[0]},${m[3]},0,${m[6]},${m[1]},${m[4]},0,${m[7]},0,0,1,0,${m[2]},${m[5]},0,${m[8]})`;
}

export const PC_W = 1024, PC_H = 768;

const MAIL = {
  en: [
    ['Big Phil', 'READ THIS. Phones ring at ANY desk', 'Phones ring all over the floor. Run to the one that rings, sit, and your login follows you: whatever desk you sit at is YOUR line. Missed calls make me sad. When I am sad I throw staplers.'],
    ['Accounting', 'Vouchers or it did not happen', 'Customers do not hand you cash. When they pay they READ OUT a voucher code (like MOON-4821). Write it down and type it into Lead Registry within 90 seconds or the money evaporates. Nana Gigabyte\'s BINGO vouchers are fake. Do not type those.'],
    ['Data Broker', 'Buying customer records, $150 each', 'If a customer tells you their absurd secret data (Galactic Security Numbers, castle vault runes...), register it in Lead Registry and sell it to me. If you remote into their PC it is usually in passwords.txt. I check, so type it right.'],
    ['HR', 'Bathroom policy (updated)', 'Toilets and urinals are in the bathroom. Peeing on the carpet costs $25 per incident. Watering the plants is... technically allowed. Accidents cost $50 and your dignity.'],
    ['IT', 'Remote Assist', 'Remote Assist connects to the customer\'s computer while you are on a call. Hit the green zone three times. Miss twice and they notice and get angry.'],
  ],
  es: [
    ['Big Phil', 'LEAN ESTO. Los teléfonos suenan en CUALQUIER escritorio', 'Los teléfonos suenan por todo el piso. Corran al que suena, siéntense y su sesión los sigue: el escritorio donde se sienten es SU línea. Las llamadas perdidas me ponen triste. Cuando estoy triste tiro abrochadoras.'],
    ['Contaduría', 'Sin voucher no pasó', 'Los clientes no te dan efectivo. Cuando pagan te DICTAN un código de voucher (tipo MOON-4821). Anotalo y escribilo en el Registro de clientes en menos de 90 segundos o la plata se evapora. Los vouchers BINGO de Nana Gigabyte son truchos. No los cargues.'],
    ['Comprador de datos', 'Compro fichas de clientes, $150 cada una', 'Si un cliente te dice su dato secreto absurdo (Números de Seguridad Galáctica, runas de bóveda...), registralo en el Registro de clientes y vendémelo. Si entrás a su PC suele estar en claves.txt. Lo chequeo, así que escribilo bien.'],
    ['RR. HH.', 'Política del baño (actualizada)', 'Los inodoros y mingitorios están en el baño. Mear la alfombra cuesta $25 por incidente. Regar las plantas está... técnicamente permitido. Los accidentes cuestan $50 y tu dignidad.'],
    ['Sistemas', 'Asistencia remota', 'La Asistencia remota se conecta a la compu del cliente mientras estás en llamada. Pegale a la zona verde tres veces. Si fallás dos, se da cuenta y se enoja.'],
  ],
};

const PHOTOS = {
  en: { reginald: 'Sir Neighs-a-Lot wearing a tiny crown.', blorvax: 'A selfie with the Moon (it is a lamp).', grandpabot: 'Grandpa-Bot at his 40th birthday. The cake is a battery.', nocturna: 'An empty mirror. Captioned "me??"', saltbeard: 'Gerald the parrot, mid-scream.', biscuit: 'A vase, seconds before Sir Biscuit pushed it.', gerald: 'A blurry orb. "Best friend (maybe)."', nana: 'Nana with a headset and three monitors. Suspicious.' },
  es: { reginald: 'Sir Relincho con una coronita.', blorvax: 'Una selfie con la Luna (es una lámpara).', grandpabot: 'Abuelo-Bot en su cumple 40. La torta es una batería.', nocturna: 'Un espejo vacío. Dice "¿¿yo??"', saltbeard: 'Gerald el loro, gritando.', biscuit: 'Un jarrón, segundos antes de que Sir Biscuit lo tire.', gerald: 'Una esfera borrosa. "Mejor amigo (tal vez)."', nana: 'Nana con auriculares y tres monitores. Sospechoso.' },
};
const WALL = {
  reginald: 'linear-gradient(160deg,#5d6475,#2c3346)', blorvax: 'linear-gradient(160deg,#46e3a0,#3b2a6b)', grandpabot: 'linear-gradient(160deg,#4a5a7a,#1a2030)', nocturna: 'linear-gradient(160deg,#5a0f2a,#120612)',
  saltbeard: 'linear-gradient(160deg,#1f6b8a,#2a1d14)', biscuit: 'linear-gradient(160deg,#ffb36b,#c74f2a)', gerald: 'linear-gradient(160deg,#c7d2f0,#4a5378)', nana: 'linear-gradient(160deg,#c78bff,#3a2a5a)',
};

const kb = (a) => keyLabel((settings.data.controls.bindings[a] || [])[0]);

// ---- window chrome ---------------------------------------------------------------------
class Win {
  constructor(pc, id, iconName, geo) {
    this.pc = pc;
    this.id = id;
    this.geo = { ...geo };
    this.titleEl = $('span', { class: 'wt' });
    this.extra = $('span', { class: 'wx' });
    const close = $('button', { class: 'wbtn', 'aria-label': 'Close', onclick: (e) => { e.stopPropagation(); this.hide(); } });
    close.append(icon('x'));
    this.bar = $('div', { class: 'wbar' }, icon(iconName), this.titleEl, this.extra, close);
    this.body = $('div', { class: 'wbody' });
    this.el = $('section', { class: 'win', hidden: true }, this.bar, this.body);
    this.el.addEventListener('pointerdown', () => pc.focus(this));
    this.drag();
    this.place();
  }

  place() {
    const g = this.geo;
    Object.assign(this.el.style, { left: g.x + '%', top: g.y + '%', width: g.w + '%', height: g.h + '%' });
  }

  drag() {
    let sx = 0, sy = 0, gx = 0, gy = 0, id = null;
    this.bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || this.pc.compact) return;
      id = e.pointerId;
      sx = e.clientX; sy = e.clientY; gx = this.geo.x; gy = this.geo.y;
      this.bar.setPointerCapture(id);
    });
    this.bar.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const r = this.pc.screen.getBoundingClientRect();
      this.geo.x = Math.max(-this.geo.w + 10, Math.min(95, gx + ((e.clientX - sx) / r.width) * 100));
      this.geo.y = Math.max(0, Math.min(88, gy + ((e.clientY - sy) / r.height) * 100));
      this.place();
    });
    const up = (e) => { if (e.pointerId === id) id = null; };
    this.bar.addEventListener('pointerup', up);
    this.bar.addEventListener('pointercancel', up);
  }

  setTitle(s, extra = '') { this.titleEl.textContent = s; this.extra.textContent = extra; }
  show() { this.el.hidden = false; this.pc.focus(this); this.pc.renderTaskbar(); }
  hide() { this.el.hidden = true; this.pc.renderTaskbar(); }
  get open() { return !this.el.hidden; }
}

// ---- the PC -------------------------------------------------------------------------------
export class Desktop {
  constructor(ui, root) {
    this.ui = ui;
    this.game = ui.game;
    this.calls = this.game.calls;
    this.phase = 'closed';
    this.el = $('div', { class: 'pc', hidden: true });
    this.screen = $('div', { class: 'pc-screen' });
    this.el.append(this.screen);
    root.append(this.el);
    this.z = 10;
    this.wins = {};
    this.dirty = true;
    this.typing = false;
    this.build();
    this.calls.onChange(() => { this.dirty = true; });
    this.game.on('restoreDraft', (s) => { if (this.input) { this.input.value = s; this.input.focus(); } });
    this.keyHandler = (e) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler, true);
  }

  get L() { return this.game.lang; }
  get visible() { return this.phase === 'open'; }
  get active() { return this.phase !== 'closed'; }
  get compact() { return window.innerWidth < 900 || window.innerHeight < 520; }

  build() {
    const L = this.L;
    clear(this.screen);
    this.wall = $('div', { class: 'pc-wall' });
    this.icons = $('div', { class: 'pc-icons' });
    this.winLayer = $('div', { class: 'pc-wins' });
    this.task = $('div', { class: 'pc-task' });
    this.startMenu = $('div', { class: 'pc-start', hidden: true });
    this.screen.append(this.wall, this.icons, this.winLayer, this.task, this.startMenu);
    const apps = [['phone', 'phone'], ['leads', 'ledger'], ['remote', 'remote'], ['notes', 'notes'], ['mail', 'mail'], ['settings', 'gear']];
    this.appIcons = {};
    for (const [id, ic] of apps) {
      const b = $('button', { class: 'dicon', onclick: () => this.openApp(id) }, icon(ic), $('span', { text: this.appName(id) }));
      this.appIcons[id] = b;
      this.icons.append(b);
    }
    this.wins.phone = new Win(this, 'phone', 'phone', { x: 10.5, y: 3, w: 56, h: 85 });
    this.wins.leads = new Win(this, 'leads', 'ledger', { x: 67.5, y: 3, w: 31, h: 85 });
    this.wins.remote = new Win(this, 'remote', 'remote', { x: 20, y: 8, w: 56, h: 72 });
    this.wins.notes = new Win(this, 'notes', 'notes', { x: 60, y: 46, w: 30, h: 42 });
    this.wins.mail = new Win(this, 'mail', 'mail', { x: 21, y: 9, w: 58, h: 72 });
    for (const w of Object.values(this.wins)) this.winLayer.append(w.el);
    this.buildPhone();
    this.buildLeads();
    this.buildRemote();
    this.buildNotes();
    this.buildMail();
    this.buildTaskbar();
    this.relabel();
    void L;
  }

  appName(id) {
    return t({ phone: 'appPhone', leads: 'appLeads', remote: 'appRemote', notes: 'appNotes', mail: 'appMail', settings: 'appSettings' }[id], this.L);
  }

  relabel() {
    for (const [id, b] of Object.entries(this.appIcons)) b.lastChild.textContent = this.appName(id);
    for (const [id, w] of Object.entries(this.wins)) if (id !== 'phone') w.setTitle(this.appName(id));
    this.renderMail();
    this.renderTaskbar();
    this.dirty = true;
  }

  focus(w) {
    w.el.style.zIndex = String(++this.z);
    for (const x of Object.values(this.wins)) x.el.classList.toggle('focused', x === w);
    this.focused = w;
    this.renderTaskbar();
  }

  openApp(id) {
    if (id === 'settings') { this.ui.openSettings(); return; }
    const w = this.wins[id];
    if (!w) return;
    w.show();
    if (id === 'phone' && this.input && !this.input.disabled) setTimeout(() => this.input.focus({ preventScroll: true }), 30);
    if (id === 'leads') setTimeout(() => (this.voucherIn && this.voucherIn.focus({ preventScroll: true })), 30);
    if (id === 'remote') this.renderRemote();
    this.game.audio.uiClick();
  }

  // ---- transitions (driven by the game's camera move) ------------------------------------
  beginEnter() {
    this.phase = 'entering';
    this.el.hidden = false;
    this.el.className = 'pc mapped' + (this.compact ? ' compact' : '');
    this.screen.style.opacity = '0';
    if (!this.everOpened) {
      this.everOpened = true;
      this.wins.leads.show();
      this.wins.phone.show();
      // first time: the boss's memo explains vouchers and data on top of everything
      if (!store('mailRead')) { this.wins.mail.show(); store('mailRead', true); }
    }
    this.dirty = true;
    this.update(0);
  }

  mapTo(pts, fade = 1) {
    this.screen.style.transform = quadMatrix(PC_W, PC_H, pts);
    this.screen.style.opacity = String(fade);
  }

  settle() {
    this.phase = 'open';
    this.el.className = 'pc open' + (this.compact ? ' compact' : '');
    this.screen.style.transform = '';
    this.screen.style.opacity = '1';
    this.game.input.exitLock();
    if (this.calls.state === 'connected' && this.wins.phone.open && this.input) setTimeout(() => this.input.focus({ preventScroll: true }), 40);
  }

  beginLeave() {
    this.phase = 'leaving';
    this.el.className = 'pc mapped' + (this.compact ? ' compact' : '');
    this.startMenu.hidden = true;
    if (document.activeElement && this.el.contains(document.activeElement)) document.activeElement.blur();
    this.typing = false;
    this.hackStop();
  }

  finishLeave() {
    this.phase = 'closed';
    this.el.hidden = true;
    this.el.className = 'pc';
  }

  onKey(e) {
    if (this.phase !== 'open') return;
    if ((this.ui.settings && this.ui.settings.open) || (this.ui.overlays && this.ui.overlays.anyOpen)) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (!this.startMenu.hidden) { this.startMenu.hidden = true; return; }
      if (this.hack && this.hack.phase === 'game') { this.hackStop(); this.renderRemote(); return; }
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.value) { document.activeElement.blur(); return; }
      this.game.closePC();
      return;
    }
    if (e.code === 'Space' && this.hack && this.hack.phase === 'game' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      e.stopPropagation();
      this.hackHit();
    }
  }

  // ---- taskbar ---------------------------------------------------------------------------
  buildTaskbar() {
    this.startBtn = $('button', { class: 'pc-startbtn', onclick: () => { this.startMenu.hidden = !this.startMenu.hidden; this.renderStart(); } }, 'ScamOS');
    this.taskApps = $('div', { class: 'pc-taskapps' });
    this.trayBrain = $('span', { class: 'tray-brain' });
    this.trayMic = $('span', { class: 'tray-mic' }, icon('mic'));
    this.trayClock = $('span', { class: 'tray-clock' });
    this.backBtn = $('button', { class: 'pc-back', onclick: () => this.game.closePC() }, icon('back'), $('span'));
    this.task.append(this.startBtn, this.taskApps, $('div', { class: 'pc-tray' }, this.trayBrain, this.trayMic, this.trayClock), this.backBtn);
  }

  renderTaskbar() {
    if (!this.taskApps) return;
    clear(this.taskApps);
    for (const [id, w] of Object.entries(this.wins)) {
      if (!w.open) continue;
      const b = $('button', { class: 'pc-taskapp' + (this.focused === w ? ' on' : ''), onclick: () => (this.focused === w && this.compact ? w.hide() : w.show()) }, this.appName(id));
      if (id === 'leads' && this.calls.openVouchers.length) b.append($('b', { class: 'badge', text: String(this.calls.openVouchers.length) }));
      this.taskApps.append(b);
    }
    this.backBtn.lastChild.textContent = `${t('pcBack', this.L)} (Esc)`;
  }

  renderStart() {
    const L = this.L, g = this.game;
    clear(this.startMenu);
    const dot = $('i');
    dot.style.background = g.profile.look.shirt.color;
    this.startMenu.append($('div', { class: 'who' }, dot, $('b', { text: g.profile.name }), $('span', { text: g.me && g.me.desk ? (L === 'es' ? 'Línea ' : 'Line ') + (g.me.desk.index + 1) : '' })));
    for (const id of ['phone', 'leads', 'remote', 'notes', 'mail', 'settings']) {
      this.startMenu.append($('button', { onclick: () => { this.startMenu.hidden = true; this.openApp(id); } }, this.appName(id)));
    }
    this.startMenu.append($('hr'));
    this.startMenu.append($('button', { onclick: () => { this.startMenu.hidden = true; this.game.closePC(); } }, t('pcBack', L)));
    this.startMenu.append($('button', { class: 'logoff', onclick: () => { this.startMenu.hidden = true; this.game.closePC(() => this.game.me && this.game.me.standUp()); } }, icon('power'), ' ', t('logOff', L)));
  }

  // ---- Phone -----------------------------------------------------------------------------
  buildPhone() {
    this.phoneBody = $('div', { class: 'phone' });
    this.wins.phone.body.append(this.phoneBody);
    this.lastKey = '';
  }

  phoneKey() {
    const c = this.calls.call, me = this.game.me;
    const ring = me && me.desk ? this.game.switchboard.ringAt(me.desk.index) : null;
    return `${this.calls.state}|${c ? c.id : ''}|${ring ? ring.id : ''}|${this.calls.linesDown}|${this.L}`;
  }

  renderPhone() {
    const key = this.phoneKey();
    const c = this.calls.call;
    if (key === this.lastKey) { if (c && this.calls.active) this.updateConnected(c); return; }
    this.lastKey = key;
    const L = this.L, st = this.calls.state, g = this.game;
    clear(this.phoneBody);
    this.input = null;
    const me = g.me;
    const ring = me && me.desk ? g.switchboard.ringAt(me.desk.index) : null;
    this.wins.phone.setTitle(t('appPhone', L), me && me.desk ? (L === 'es' ? 'LÍNEA ' : 'LINE ') + String(me.desk.index + 1).padStart(2, '0') : '');
    if (this.calls.linesDown && st === 'idle') {
      this.phoneBody.append($('div', { class: 'state-center' }, $('h2', { text: t('linesDownTitle', L) }), $('p', { text: t('linesDownBody', L) }),
        $('div', { class: 'btnrow' }, $('button', { class: 'btn yellow', onclick: () => this.calls.continueWithBackup() }, t('keepBackup', L)))));
    } else if (st === 'idle' && ring) {
      const mk = g.markFor(ring);
      const img = $('img', { alt: '' });
      setPortrait(img, mk);
      this.phoneBody.append($('div', { class: 'state-center ringing' }, $('h2', { text: t('incoming', L) }),
        $('div', { class: 'callerid' }, $('div', { class: 'portrait' }, img), $('div', {}, $('h3', { text: mk.name }), $('div', { class: 'sub', text: mk.title[L] }))),
        $('div', { class: 'btnrow' }, $('button', { class: 'btn cash', onclick: () => g.answerAtMyDesk() }, t('answer', L), ' ', $('span', { class: 'kbd', text: kb('pc') })))));
    } else if (st === 'idle') {
      const ph = icon('phone', 'waitphone');
      const rings = g.switchboard.rings.filter((r) => !g.switchboard.mine.has(r.id));
      const list = $('div', { class: 'ringlist' });
      for (const r of rings.slice(0, 4)) {
        const d = g.office.desks[r.d];
        const dist = me ? Math.round(d.seat.distanceTo(me.position)) : 0;
        list.append($('div', {}, icon('phone'), $('b', { text: (L === 'es' ? 'Línea ' : 'Line ') + (r.d + 1) }), $('span', { text: `${g.markFor(r).name} · ${dist} m` })));
      }
      this.phoneBody.append($('div', { class: 'state-center' }, ph, $('h2', { text: t('waiting', L) }), $('p', { text: t('noCall', L) }), rings.length ? list : null));
    } else if ((st === 'connected' || st === 'hold') && c) {
      this.buildConnected(c);
    } else if (st === 'wrapup' && c) {
      this.phoneBody.append(this.receipt(c));
    }
  }

  buildConnected(c) {
    const L = this.L;
    this.portraitImg = $('img', { alt: '' });
    setPortrait(this.portraitImg, c.mark);
    this.trustBar = $('i');
    this.patBar = $('i');
    this.trustVal = $('b');
    this.patVal = $('b');
    this.moodEl = $('div', { class: 'mood' });
    this.timerEl = $('span', { class: 'calltime' });
    const caller = $('div', { class: 'caller' },
      $('div', { class: 'portrait' }, this.portraitImg),
      $('div', {}, $('h3', { text: c.mark.name }), $('div', { class: 'sub', text: c.mark.title[L] }), this.timerEl),
      $('div', { class: 'gauges' },
        $('div', { class: 'gauge trust' }, $('div', { class: 'row' }, $('span', { text: t('trust', L) }), this.trustVal), $('div', { class: 'bar' }, this.trustBar)),
        $('div', { class: 'gauge patience' }, $('div', { class: 'row' }, $('span', { text: t('patience', L) }), this.patVal), $('div', { class: 'bar' }, this.patBar))),
      this.moodEl);
    this.transcript = $('div', { class: 'transcript', role: 'log', 'aria-live': 'polite' });
    this.input = $('input', { type: 'text', maxlength: '300', placeholder: t('typeHere', L), autocomplete: 'off', enterkeyhint: 'send' });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.send(); }
      e.stopPropagation();
    });
    this.input.addEventListener('input', () => { this.typing = this.input.value.length > 0; if (this.typing) this.game.audio.key(); });
    this.input.addEventListener('blur', () => { this.typing = false; });
    this.micBtn = $('button', { class: 'micbtn', 'aria-label': 'Mic', title: 'Mic' });
    this.micBtn.append(icon('mic'));
    this.micBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.game.micPress(); });
    this.micBtn.addEventListener('pointerup', (e) => { e.preventDefault(); this.game.micRelease(); });
    this.micBtn.addEventListener('pointerleave', () => this.game.micRelease());
    const send = $('button', { class: 'btn yellow', onclick: () => this.send() }, t('send', L));
    this.micNote = $('div', { class: 'micnote' });
    const composer = $('div', { class: 'composer' }, this.micBtn, this.input, send);
    const convo = $('div', { class: 'convo' }, this.transcript, this.micNote, composer);
    this.challengeNote = $('div', { class: 'note' }, $('div', { class: 'lbl', text: t('challenge', L) }), $('div', { text: c.challenge.text[L] }), $('div', { class: 'bonus', text: '+' + money(c.challenge.bonus) }));
    this.vChip = $('button', { class: 'vchip', hidden: true, onclick: () => this.openApp('leads') });
    this.holdBtn = $('button', { class: 'btn small', onclick: () => (this.calls.state === 'hold' ? this.calls.resume() : this.calls.hold()) });
    const hang = $('button', { class: 'btn hot', onclick: () => this.calls.hangUp() }, icon('hangup'), ' ', t('hangUp', L));
    const intel = $('div', { class: 'intel' },
      $('div', { class: 'card' }, $('div', { class: 'lbl', text: t('pitch', L) }), $('div', { class: 'val', text: c.product[L] })),
      this.challengeNote, this.vChip,
      $('div', { class: 'card' }, $('div', { class: 'lbl', text: c.mark.secret.label[L] }), $('div', { class: 'secret locked', text: '•••• •••• ••••' })),
      $('div', { class: 'btncol' }, this.holdBtn, hang));
    this.secretEl = intel.querySelector('.secret');
    this.phoneBody.append($('div', { class: 'callgrid' }, caller, convo, intel));
    this.lastLen = -1;
    this.updateConnected(c);
    if (this.visible) setTimeout(() => this.input && this.input.focus({ preventScroll: true }), 50);
  }

  updateConnected(c) {
    const L = this.L, g = this.game;
    this.trustBar.style.width = Math.round(c.trust) + '%';
    this.patBar.style.width = Math.round(c.patience) + '%';
    this.trustVal.textContent = Math.round(c.trust);
    this.patVal.textContent = Math.round(c.patience);
    this.moodEl.textContent = (L === 'es' ? 'humor: ' : 'mood: ') + (c.mood || '');
    this.timerEl.textContent = clock(c.elapsed);
    const partial = g.partial || '';
    const key = `${c.transcript.length}|${this.calls.busy}|${this.calls.state}|${partial}|${this.calls.pending}`;
    if (key !== this.lastLen) {
      this.lastLen = key;
      clear(this.transcript);
      for (const m of c.transcript) this.transcript.append($('div', { class: 'msg ' + m.who, text: m.who === 'event' ? `[${m.text}]` : m.text }));
      if (this.calls.pending) this.transcript.append($('div', { class: 'msg me queued', text: this.calls.pending }));
      if (partial) this.transcript.append($('div', { class: 'msg me partial', text: partial + '…' }));
      if (this.calls.busy) this.transcript.append($('div', { class: 'msg typing', text: `${c.mark.name} ${t('thinking', L)}` }));
      if (this.calls.state === 'hold') this.transcript.append($('div', { class: 'msg event', text: t('onHold', L) }));
      this.transcript.scrollTop = this.transcript.scrollHeight;
    }
    this.challengeNote.classList.toggle('done', c.challengeDone);
    if (c.secretKnown) { this.secretEl.textContent = c.mark.secret.value; this.secretEl.classList.remove('locked'); }
    const open = this.calls.openVouchers.length;
    this.vChip.hidden = !open;
    this.vChip.textContent = t('pendingV', L, { n: open }) + ' →';
    this.holdBtn.textContent = this.calls.state === 'hold' ? (L === 'es' ? 'Retomar' : 'Resume') : t('hold', L);
    this.input.disabled = this.calls.state !== 'connected';
    const ms = g.micStatus();
    this.micBtn.className = 'micbtn ' + ms.kind;
    this.micBtn.hidden = ms.kind === 'none';
    this.micNote.textContent = ms.kind === 'none' ? '' : ms.text;
    this.micNote.className = 'micnote ' + ms.kind;
  }

  send() {
    if (!this.input) return;
    const s = this.input.value.trim();
    if (!s) return;
    this.input.value = '';
    this.typing = false;
    this.calls.queue(s);
    this.game.audio.uiClick();
  }

  receipt(c) {
    const L = this.L, g = this.game;
    const total = c.receipt.reduce((n, r) => n + r.amount, 0);
    const time = g.shiftClock ? `${g.shiftClock.h % 12 || 12}:${String(g.shiftClock.m).padStart(2, '0')} ${g.shiftClock.h >= 12 ? 'PM' : 'AM'}` : '';
    const lines = c.receipt.length ? c.receipt.map((r) => $('div', { class: 'li' }, $('span', { text: r.label }), $('span', { text: money(r.amount) })))
      : [$('div', { class: 'li' }, $('span', { text: t('noSale', L) }), $('span', { text: '$0' }))];
    const pend = c.pendingAmount > 0 ? $('div', { class: 'li pend' }, $('span', { text: L === 'es' ? 'Vouchers por cobrar' : 'Vouchers to collect' }), $('span', { text: money(c.pendingAmount) })) : null;
    return $('div', { class: 'receiptwrap' }, $('div', { class: 'slot' }), $('div', { class: 'receipt' },
      $('h4', { text: 'Phony Business' }),
      $('div', { class: 'meta' }, (L === 'es' ? 'Turno noche ' : 'Night shift ') + g.shift.n, $('br'), time, $('br'), (L === 'es' ? 'Cliente: ' : 'Customer: ') + c.mark.name),
      $('hr'), ...lines, pend, $('hr'),
      $('div', { class: 'li tot' }, $('span', { text: t('total', L) }), $('span', { text: money(total) })),
      $('div', { class: 'foot', text: L === 'es' ? 'Sin reembolsos. Sin remordimientos.' : 'No refunds. No regrets.' })));
  }

  // ---- Lead Registry ---------------------------------------------------------------------
  buildLeads() {
    const L = this.L;
    const b = this.wins.leads.body;
    this.voucherIn = $('input', { type: 'text', maxlength: '24', autocomplete: 'off', spellcheck: 'false', class: 'code' });
    this.voucherMsg = $('div', { class: 'formmsg' });
    const collect = () => {
      const r = this.calls.collectVoucher(this.voucherIn.value);
      this.voucherMsg.textContent = r.msg;
      this.voucherMsg.className = 'formmsg ' + (r.ok ? 'ok' : 'bad');
      if (r.ok || r.fake) this.voucherIn.value = '';
      this.voucherIn.focus();
    };
    this.voucherIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); collect(); } e.stopPropagation(); });
    this.voucherIn.addEventListener('input', () => { this.voucherIn.value = this.voucherIn.value.toUpperCase(); this.game.audio.key(); });
    this.collectBtn = $('button', { class: 'btn cash', onclick: collect });
    this.vList = $('div', { class: 'vlist' });
    this.dataIn = $('input', { type: 'text', maxlength: '32', autocomplete: 'off', spellcheck: 'false', class: 'code' });
    this.dataMsg = $('div', { class: 'formmsg' });
    const reg = () => {
      const r = this.calls.registerData(this.dataIn.value);
      this.dataMsg.textContent = r.msg;
      this.dataMsg.className = 'formmsg ' + (r.ok ? 'ok' : 'bad');
      if (r.ok) this.dataIn.value = '';
      this.dataIn.focus();
    };
    this.dataIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); reg(); } e.stopPropagation(); });
    this.dataIn.addEventListener('input', () => { this.dataIn.value = this.dataIn.value.toUpperCase(); this.game.audio.key(); });
    this.regBtn = $('button', { class: 'btn yellow', onclick: reg });
    this.dList = $('div', { class: 'dlist' });
    this.ledgerEl = $('div', { class: 'ledger' });
    this.leadsHead = {
      v: $('h3'), vh: $('p', { class: 'help' }), d: $('h3'), dh: $('p', { class: 'help' }), l: $('h3'),
    };
    b.append($('div', { class: 'leads' },
      $('div', { class: 'lsec' }, this.leadsHead.v, this.leadsHead.vh, $('div', { class: 'formrow' }, this.voucherIn, this.collectBtn), this.voucherMsg, this.vList),
      $('div', { class: 'lsec' }, this.leadsHead.d, this.leadsHead.dh, $('div', { class: 'formrow' }, this.dataIn, this.regBtn), this.dataMsg, this.dList),
      $('div', { class: 'lsec' }, this.leadsHead.l, this.ledgerEl)));
    void L;
  }

  renderLeads() {
    const L = this.L, c = this.calls;
    const h = this.leadsHead;
    h.v.textContent = t('voucherTitle', L);
    h.vh.textContent = t('voucherHelp', L);
    h.d.textContent = t('dataTitle', L);
    h.dh.textContent = t('dataHelp', L);
    h.l.textContent = t('ledger', L);
    this.voucherIn.placeholder = t('voucherInput', L);
    this.dataIn.placeholder = t('dataInput', L);
    this.collectBtn.textContent = t('collect', L);
    this.regBtn.textContent = t('register', L);
    const key = JSON.stringify([c.vouchers.map((v) => [v.code, v.used, v.expired, Math.ceil(v.ttl)]), c.heard.map((x) => [x.value, x.registered, x.sold]), c.ledger.length, L]);
    if (key === this.leadsKey) return;
    this.leadsKey = key;
    clear(this.vList);
    for (const v of c.vouchers.slice(0, 8)) {
      const state = v.used ? (v.fake ? '✗' : '✓') : v.expired ? t('voucherExpired', L) : t('expiresIn', L, { s: Math.ceil(v.ttl) });
      const masked = v.used ? v.code : v.code.replace(/\d/g, '•');
      const row = $('div', { class: 'vrow' + (v.used ? ' used' : '') + (v.expired ? ' dead' : '') + (!v.used && !v.expired && v.ttl < 20 ? ' soon' : '') },
        $('b', { text: masked }), $('span', { text: v.markName }), $('span', { class: 'st', text: state }));
      this.vList.append(row);
    }
    if (!c.vouchers.length) this.vList.append($('div', { class: 'empty', text: L === 'es' ? 'Todavía nadie te dictó un voucher.' : 'Nobody has read you a voucher yet.' }));
    clear(this.dList);
    for (const x of c.heard.filter((y) => y.registered)) {
      const sell = $('button', { class: 'btn cash small', disabled: x.sold, onclick: () => this.calls.sellData(x) }, x.sold ? t('sold', L) : `${t('sell', L)} +${money(TUNE.secretPrice)}`);
      this.dList.append($('div', { class: 'drow' }, $('div', {}, $('b', { text: x.label }), $('code', { text: x.value }), $('span', { text: x.markName })), sell));
    }
    const heardOnly = c.heard.filter((y) => !y.registered).length;
    if (heardOnly) this.dList.append($('div', { class: 'empty', text: L === 'es' ? `${heardOnly} dato(s) escuchado(s) sin registrar` : `${heardOnly} record(s) heard but not registered` }));
    clear(this.ledgerEl);
    let total = 0;
    for (const e of c.ledger.slice(-12)) {
      total += e.amount;
      this.ledgerEl.append($('div', { class: 'li' + (e.amount < 0 ? ' neg' : '') }, $('span', { text: e.label }), $('span', { text: e.amount ? money(e.amount) : '—' })));
    }
    this.ledgerEl.append($('div', { class: 'li tot' }, $('span', { text: t('total', L) }), $('span', { text: money(c.ledger.reduce((n, e) => n + e.amount, 0)) })));
    void total;
  }

  // ---- Remote Assist (needle minigame + their files) -------------------------------------
  buildRemote() {
    this.remoteBody = $('div', { class: 'remote' });
    this.wins.remote.body.append(this.remoteBody);
    this.hack = null;
  }

  renderRemote() {
    const L = this.L, c = this.calls.call;
    clear(this.remoteBody);
    if (!c || !this.calls.active) {
      this.remoteBody.append($('div', { class: 'state-center' }, icon('remote', 'waitphone'), $('h2', { text: t('appRemote', L) }),
        $('p', { text: L === 'es' ? 'No hay sesión. La asistencia remota funciona mientras estás en una llamada.' : 'No session. Remote Assist works while you are on a call.' })));
      return;
    }
    if (c.hacked) { this.renderVictim(c, null); return; }
    if ((c.hackFails || 0) >= 2) {
      this.remoteBody.append($('div', { class: 'state-center' }, $('h2', { text: t('denied', L) })));
      return;
    }
    this.remoteBody.append($('div', { class: 'state-center' }, icon('lock', 'waitphone'), $('h2', { text: t('hackTitle', L, { os: c.mark.os }) }), $('p', { text: t('hackHelp', L) }),
      $('div', { class: 'btnrow' }, $('button', { class: 'btn yellow', onclick: () => this.hackStart() }, t('remoteIn', L)))));
  }

  hackStart() {
    const c = this.calls.call;
    if (!c) return;
    this.hack = { phase: 'game', hits: 0, misses: 0, pos: 0, dir: 1, speed: 0.75, zone: null };
    this.hackZone();
    this.renderHack();
    this.calls.addEvent('a faint clicking of keys from the caller\'s side');
  }

  hackZone() {
    const w = Math.max(0.09, 0.2 - this.hack.hits * 0.045);
    this.hack.zone = { a: 0.1 + Math.random() * (0.8 - w), w };
  }

  renderHack() {
    const L = this.L, h = this.hack, c = this.calls.call;
    clear(this.remoteBody);
    this.needle = $('div', { class: 'needle' });
    const track = $('div', { class: 'track', onpointerdown: (e) => { e.preventDefault(); this.hackHit(); } },
      $('div', { class: 'zone', style: { left: h.zone.a * 100 + '%', width: h.zone.w * 100 + '%' } }), this.needle);
    const pips = $('div', { class: 'pips' });
    for (let i = 0; i < 3; i++) pips.append($('span', { class: 'pip' + (i < h.hits ? ' ok' : '') }));
    for (let i = 0; i < h.misses; i++) pips.append($('span', { class: 'pip bad' }));
    this.remoteBody.append($('div', { class: 'hackbody' }, $('h3', { text: t('hackTitle', L, { os: c ? c.mark.os : '' }) }), $('p', { text: t('hackHelp', L) }), track, pips));
  }

  hackHit() {
    const h = this.hack;
    if (!h || h.phase !== 'game') return;
    const g = this.game;
    const inZone = h.pos >= h.zone.a && h.pos <= h.zone.a + h.zone.w;
    if (inZone) {
      h.hits++;
      g.audio.blip(880 + h.hits * 220, 0.08, 'square', 0.12);
      if (h.hits >= 3) {
        h.phase = 'done';
        this.calls.hackSucceeded();
        g.toast(t('granted', this.L), 'good');
        this.renderVictim(this.calls.call, 'pw');
        return;
      }
      h.speed += 0.35;
      this.hackZone();
    } else {
      h.misses++;
      g.audio.uiError();
      if (h.misses >= 2) {
        h.phase = 'done';
        this.calls.hackFailed();
        g.toast(t('denied', this.L), 'bad');
        this.renderRemote();
        return;
      }
    }
    this.renderHack();
  }

  hackStop() { if (this.hack && this.hack.phase === 'game') this.hack.phase = 'done'; }

  renderVictim(c, open) {
    const L = this.L;
    if (!c) { this.renderRemote(); return; }
    clear(this.remoteBody);
    const files = [['diary', 'file', L === 'es' ? 'diario.txt' : 'diary.txt'], ['pw', 'file', L === 'es' ? 'claves.txt' : 'passwords.txt'], ['photo', 'photo', 'IMG_0042.jpg'], ['trash', 'trash', t('recycle', L)]];
    const desk = $('div', { class: 'desktop', style: { background: WALL[c.mark.id] || WALL.nana } });
    for (const [id, ic, name] of files) desk.append($('button', { class: 'dicon', onclick: () => this.renderVictim(c, id) }, icon(ic), $('span', { text: name })));
    let text = null;
    if (open === 'diary') text = c.mark.diary[L];
    if (open === 'pw') text = `${c.mark.secret.label[L]}:\n${c.mark.secret.value}\n\n${L === 'es' ? '(no se lo digas a nadie)' : '(do not tell anyone)'}`;
    if (open === 'photo') text = (PHOTOS[L] || PHOTOS.en)[c.mark.id];
    if (open === 'trash') text = L === 'es' ? 'plan_para_hacerme_rico_v7.doc\nfoto_fea_mia.jpg\nreceta_secreta_de_milanesa.txt' : 'get_rich_plan_v7.doc\nugly_photo_of_me.jpg\nsecret_meatloaf_recipe.txt';
    this.remoteBody.append($('div', { class: 'victim' }, $('div', { class: 'vbar' }, $('b', { text: c.mark.os }), $('span', { text: t('files', L) })), desk, text ? $('div', { class: 'filewin', text }) : null));
  }

  // ---- Notes and Mail ----------------------------------------------------------------------
  buildNotes() {
    this.notes = $('textarea', { class: 'notes', spellcheck: 'false' });
    this.notes.value = store('notes') || '';
    this.notes.addEventListener('input', () => { store('notes', this.notes.value.slice(0, 4000)); this.typing = true; this.game.audio.key(); });
    this.notes.addEventListener('blur', () => { this.typing = false; });
    this.notes.addEventListener('keydown', (e) => e.stopPropagation());
    this.wins.notes.body.append(this.notes);
  }

  buildMail() {
    this.mailList = $('div', { class: 'maillist' });
    this.mailView = $('div', { class: 'mailview' });
    this.wins.mail.body.append($('div', { class: 'mail' }, this.mailList, this.mailView));
    this.mailOpen = 0;
  }

  renderMail() {
    if (!this.mailList) return;
    const L = this.L;
    const box = MAIL[L] || MAIL.en;
    clear(this.mailList);
    box.forEach(([from, subj], i) => this.mailList.append($('button', { class: 'mitem' + (i === this.mailOpen ? ' on' : ''), onclick: () => { this.mailOpen = i; this.renderMail(); } }, $('b', { text: from }), $('span', { text: subj }))));
    const [from, subj, body] = box[this.mailOpen] || box[0];
    clear(this.mailView);
    this.mailView.append($('div', { class: 'mhead' }, $('b', { text: subj }), $('span', { text: (L === 'es' ? 'De: ' : 'From: ') + from })), $('p', { text: body }));
    this.notes.placeholder = t('notesPh', L);
  }

  // ---- per frame ------------------------------------------------------------------------------
  update(dt) {
    if (this.phase === 'closed') return;
    const g = this.game, L = this.L;
    if (this.el.classList.contains('compact') !== this.compact) this.el.classList.toggle('compact', this.compact);
    if (this.dirty) { this.dirty = false; this.renderPhone(); this.renderLeads(); this.renderTaskbar(); }
    else {
      const c = this.calls.call;
      if (c && this.calls.active && this.trustBar) this.updateConnected(c);
      if (this.phoneKey() !== this.lastKey) this.renderPhone();
      this.leadsT = (this.leadsT || 0) - dt;
      if (this.leadsT <= 0) { this.leadsT = 0.5; this.renderLeads(); this.renderTaskbar(); }
    }
    if (this.hack && this.hack.phase === 'game' && this.needle) {
      const h = this.hack;
      h.pos += h.dir * h.speed * dt;
      if (h.pos > 1) { h.pos = 1; h.dir = -1; }
      if (h.pos < 0) { h.pos = 0; h.dir = 1; }
      this.needle.style.left = (h.pos * 100).toFixed(2) + '%';
      if (!this.calls.active) { this.hackStop(); this.renderRemote(); }
    }
    // tray
    const s = usage.shift;
    this.trayBrain.textContent = `${this.calls.brainKind === 'claude' ? 'Claude' : this.calls.brainKind === 'openai' ? 'AI' : L === 'es' ? 'Repuesto' : 'Backup'} · ${s.requests} · ~${Math.round((s.inTok + s.outTok) / 100) / 10}k tok`;
    const ms = g.micStatus();
    this.trayMic.className = 'tray-mic ' + ms.kind;
    if (g.shiftClock) this.trayClock.textContent = `${g.shiftClock.h % 12 || 12}:${String(g.shiftClock.m).padStart(2, '0')} ${g.shiftClock.h >= 12 ? 'PM' : 'AM'}`;
  }

  isTyping() { return this.visible && this.typing; }
}
