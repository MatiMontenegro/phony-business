// Heads-up display: quota board, bladder and gas meters, prompts, subtitles,
// toasts, teammates and the live microphone pill.
import { $, clear, icon, money, clock } from './dom.js';
import { t } from '../i18n.js';
import { keyLabel, settings } from '../settings.js';

function jugSvg() {
  return `<svg width="34" height="54" viewBox="0 0 34 54" aria-hidden="true">
    <defs><clipPath id="jug"><path d="M11 2h12v6c6 2 9 6 9 12v28a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V20c0-6 3-10 9-12z"/></clipPath></defs>
    <path d="M11 2h12v6c6 2 9 6 9 12v28a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V20c0-6 3-10 9-12z" fill="#120e2e" stroke="#4a3f86" stroke-width="2"/>
    <rect class="fill" clip-path="url(#jug)" x="0" y="54" width="34" height="54" fill="#8fd6ff"/>
    <path d="M6 26h22M6 36h22" stroke="rgba(255,255,255,.12)" stroke-width="1.5"/>
  </svg>`;
}
function gaugeSvg() {
  return `<svg width="64" height="40" viewBox="0 0 64 40" aria-hidden="true">
    <path d="M6 36a26 26 0 0 1 52 0" fill="none" stroke="#2a2259" stroke-width="8" stroke-linecap="round"/>
    <path class="arc" d="M6 36a26 26 0 0 1 52 0" fill="none" stroke="#b9d36a" stroke-width="8" stroke-linecap="round" stroke-dasharray="82" stroke-dashoffset="82"/>
    <line class="needle" x1="32" y1="36" x2="32" y2="14" stroke="#f6f1e3" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="36" r="4" fill="#f6f1e3"/>
  </svg>`;
}

const kb = (action, slot = 0) => keyLabel((settings.data.controls.bindings[action] || [])[slot]);

export class Hud {
  constructor(ui, root) {
    this.ui = ui;
    this.game = ui.game;
    const L = () => this.game.lang;
    this.el = $('div', { class: 'hud', hidden: true });
    root.append(this.el);
    this.clockEl = $('div', { class: 'clock' }, $('b', { text: '11:00' }), $('span', { text: 'PM' }));
    this.flaps = $('div', { class: 'flaps', 'aria-label': 'quota' });
    this.bar = $('div', { class: 'bar' }, $('i', { style: { width: '0%' } }));
    this.leftEl = $('div', { class: 'left' }, $('b', { text: '6:00' }), $('span', { text: t('shiftEnds', L()) }));
    this.ringEl = $('div', { class: 'ringchip', hidden: true }, icon('phone'), $('span'));
    this.board = $('div', { class: 'board', role: 'status' }, this.clockEl, $('div', { class: 'flapwrap' }, this.flaps, this.bar), this.leftEl);
    this.el.append($('div', { class: 'top' }, this.board, this.ringEl));
    // top-right buttons
    this.micBtn = $('button', { class: 'iconbtn', 'aria-label': 'Microphone', onclick: () => this.ui.micButton() });
    this.micBtn.append(icon('mic'));
    this.soundBtn = $('button', { class: 'iconbtn', 'aria-label': 'Sound', onclick: () => this.ui.toggleSound() });
    this.soundBtn.append(icon('sound'));
    this.gearBtn = $('button', { class: 'iconbtn', 'aria-label': 'Settings', onclick: () => this.ui.openSettings() });
    this.gearBtn.append(icon('gear'));
    this.menuBtn = $('button', { class: 'iconbtn', 'aria-label': 'Menu', onclick: () => this.ui.openMenu() });
    this.menuBtn.append(icon('menu'));
    this.fpsEl = $('span', { class: 'fps', hidden: true });
    this.el.append($('div', { class: 'tr' }, this.fpsEl, this.micBtn, this.soundBtn, this.gearBtn, this.menuBtn));
    this.team = $('div', { class: 'team' });
    this.el.append(this.team);
    // meters
    this.bladder = $('div', { class: 'meter', title: t('bladder', L()) });
    this.bladder.innerHTML = jugSvg();
    this.bladderLbl = $('div', { class: 'lbl', text: t('bladder', L()) });
    this.bladder.append(this.bladderLbl);
    this.gasEl = $('div', { class: 'meter', title: t('gas', L()) });
    this.gasEl.innerHTML = gaugeSvg();
    this.gasLbl = $('div', { class: 'lbl', text: t('gas', L()) });
    this.gasEl.append(this.gasLbl);
    this.peeKey = $('div', { class: 'peekey' });
    // pee and gas are free now (no build-up), so the meters are hidden
    this.bladder.hidden = true;
    this.gasEl.hidden = true;
    this.meters = $('div', { class: 'meters' }, this.bladder, this.gasEl, this.peeKey);
    this.el.append(this.meters);
    // prompts
    this.prompt = $('div', { class: 'prompt', hidden: true });
    this.charge = $('div', { class: 'charge', hidden: true }, $('span', { text: 'PFFFT' }), $('div', { class: 'bar' }, $('i', { style: { width: '0%' } })));
    this.subs = $('div', { class: 'subs', 'aria-live': 'polite' });
    this.toasts = $('div', { class: 'toasts', 'aria-live': 'polite' });
    this.hint = $('div', { class: 'hint', hidden: true });
    // microphone pill (on a call)
    this.micLevel = $('i');
    this.micText = $('span', { class: 'txt' });
    this.micPill = $('div', { class: 'micpill', hidden: true }, icon('mic'), $('div', { class: 'lvl' }, this.micLevel), this.micText);
    this.el.append(this.prompt, this.charge, this.subs, this.toasts, this.hint, this.micPill);
    this.lastMoneyStr = '';
    this.teamKey = '';
    this.promptKey = '';
    this.subT = 0;
    this.fpsT = 0;
    this.frames = 0;
  }

  show(on) { this.el.hidden = !on; }

  toast(text, kind = 'info') {
    const n = $('div', { class: 'toast ' + kind, text });
    n.style.setProperty('--r', (Math.random() * 3 - 1.5).toFixed(1) + 'deg');
    this.toasts.append(n);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 320); }, 3200 + text.length * 25);
  }

  subtitle(who, text, kind = 'mark') {
    if (settings.get('game.subtitles') === false) return;
    clear(this.subs);
    this.subs.append($('div', { class: kind }, $('b', { text: who + ':' }), $('span', { text })));
    this.subs.style.opacity = '1';
    this.subT = 2.5 + text.length / 16;
  }

  moneyPop(n) {
    const el = $('div', { class: 'moneypop' + (n < 0 ? ' neg' : ''), text: (n >= 0 ? '+' : '') + money(n) });
    this.el.append(el);
    setTimeout(() => el.remove(), 1700);
  }

  showHint(text, sec = 6) {
    this.hint.textContent = text;
    this.hint.hidden = false;
    this.hint.style.opacity = '1';
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => { this.hint.style.opacity = '0'; setTimeout(() => { this.hint.hidden = true; }, 600); }, sec * 1000);
  }

  setFlaps(s) {
    if (s === this.lastMoneyStr) return;
    const prev = this.lastMoneyStr;
    this.lastMoneyStr = s;
    const [a, b] = s.split('|');
    const cur = a.padStart(Math.max(a.length, 5), ' ');
    const old = (prev.split('|')[0] || '').padStart(cur.length, ' ');
    const kids = [];
    for (let i = 0; i < cur.length; i++) kids.push($('span', { class: 'flap' + (old[i] !== cur[i] && prev ? ' flip' : ''), text: cur[i] === ' ' ? '' : cur[i] }));
    clear(this.flaps);
    this.flaps.append(...kids, $('span', { class: 'of', text: '/ ' + b }));
  }

  setPrompt(items) {
    const key = items ? items.map((i) => `${i.key}:${i.label}:${i.disabled ? 1 : 0}:${i.hot ? 1 : 0}`).join('|') : '';
    if (key === this.promptKey) return;
    this.promptKey = key;
    clear(this.prompt);
    this.prompt.hidden = !items || !items.length;
    if (!items) return;
    for (const it of items) {
      this.prompt.append($('span', { class: 'pitem' + (it.disabled ? ' off' : '') + (it.hot ? ' hot' : '') }, $('span', { class: 'kbd', text: it.key }), $('span', { text: it.label })));
    }
  }

  update(dt) {
    const g = this.game, L = g.lang, me = g.me;
    if (!me) return;
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT > 0.5) {
      this.fpsEl.hidden = !settings.get('graphics.showFps');
      this.fpsEl.textContent = `${Math.round(this.frames / this.fpsT)} FPS · ${g.renderer.qualityName}`;
      this.fpsT = 0;
      this.frames = 0;
    }
    const team = g.teamMoney();
    this.setFlaps(money(team) + '|' + money(g.shift.quota));
    const k = Math.max(0, Math.min(1, team / Math.max(1, g.shift.quota)));
    this.bar.firstChild.style.width = (k * 100).toFixed(1) + '%';
    this.bar.classList.toggle('met', team >= g.shift.quota);
    const left = Math.max(0, g.shift.len - g.shift.t);
    this.leftEl.firstChild.textContent = clock(left);
    this.leftEl.lastChild.textContent = t('shiftEnds', L);
    if (g.shiftClock) {
      const h = g.shiftClock.h % 12 || 12;
      this.clockEl.firstChild.textContent = `${h}:${String(g.shiftClock.m).padStart(2, '0')}`;
      this.clockEl.lastChild.textContent = g.shiftClock.h >= 12 ? 'PM' : 'AM';
    }
    // rings
    const rs = g.switchboard.summary(L);
    this.ringEl.hidden = !rs;
    if (rs) this.ringEl.lastChild.textContent = rs;
    // meters
    const fill = this.bladder.querySelector('.fill');
    const b = me.bladder;
    fill.setAttribute('y', String(54 - b * 50));
    fill.setAttribute('fill', b > 0.8 ? '#ff4d5e' : b > 0.55 ? '#ffd84d' : '#8fd6ff');
    this.bladder.classList.toggle('urgent', b > 0.85);
    this.gasEl.querySelector('.arc').setAttribute('stroke-dashoffset', String(82 - me.gas * 82));
    this.gasEl.querySelector('.needle').setAttribute('transform', `rotate(${(-90 + me.gas * 180).toFixed(1)} 32 36)`);
    this.bladderLbl.textContent = t('bladder', L);
    this.gasLbl.textContent = t('gas', L);
    const pk = `${kb('pee')}|${kb('fart')}|${L}`;
    if (this.peeKey.dataset.k !== pk) {
      this.peeKey.dataset.k = pk;
      clear(this.peeKey);
      this.peeKey.append(
        $('div', {}, $('span', { class: 'kbd', text: kb('pee') }), $('span', { text: t('pee', L) })),
        $('div', {}, $('span', { class: 'kbd', text: kb('fart') }), $('span', { text: L === 'es' ? 'Pedo' : 'Fart' })),
      );
    }
    // prompt
    const pcOpen = this.ui.desktop && this.ui.desktop.active;
    let items = null;
    if (!pcOpen && !this.ui.capturesKeys()) {
      if (me.mode === 'seated') {
        if (g.screens.loggingIn) items = [];
        else {
          const ring = g.switchboard.ringAt(me.desk.index);
          items = [];
          if (ring && g.calls.state === 'idle') items.push({ key: kb('pc'), label: t('answer', L), hot: true });
          else items.push({ key: kb('pc'), label: L === 'es' ? 'PC a pantalla completa' : 'Full-screen PC' });
          if (g.calls.active) items.push({ key: kb('hangup'), label: t('hangUp', L) });
          items.push({ key: kb('use'), label: t('stand', L) });
        }
      } else if (me.prompt) items = [me.prompt];
    }
    this.setPrompt(items);
    this.charge.hidden = !me.charging;
    if (me.charging) this.charge.querySelector('i').style.width = (me.charge * 100).toFixed(0) + '%';
    this.subs.classList.toggle('hide', !!pcOpen);
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.subs.style.opacity = '0'; }
    // mic pill
    const onCall = g.calls.state === 'connected';
    const ms = g.micStatus();
    this.micPill.hidden = !onCall || pcOpen;
    if (onCall) {
      this.micPill.className = 'micpill ' + ms.kind;
      this.micLevel.style.width = Math.round(ms.level * 100) + '%';
      this.micText.textContent = ms.text;
    }
    this.micBtn.classList.toggle('live', ms.kind === 'listening');
    this.micBtn.classList.toggle('off', ms.kind === 'off' || ms.kind === 'denied');
    // teammates
    const rem = [...g.remotes.values()];
    const key = rem.map((r) => `${r.id}:${r.name}:${r.mode}:${r.onCall ? 1 : 0}`).join('|') + L;
    if (key !== this.teamKey) {
      this.teamKey = key;
      clear(this.team);
      for (const r of rem) {
        const dot = $('span', { class: 'dot' });
        dot.style.background = r.color;
        const st = r.onCall ? t('onCall', L) : r.mode === 'toilet' || r.mode === 'urinal' ? t('inToilet', L) : r.mode === 'ragdoll' ? t('ragdolled', L) : r.mode === 'seated' ? t('atDesk', L) : t('wandering', L);
        this.team.append($('div', { class: 'mate' }, dot, $('span', { class: 'nm', text: r.name }), $('span', { class: 'st' + (r.onCall ? ' call' : ''), text: st })));
      }
    }
  }
}
