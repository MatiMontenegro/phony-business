// Touch controls: a virtual joystick (left or right, adjustable size and
// opacity), context buttons (use, jump, pee, fart, flop, PC, hang up, talk)
// and drag-to-look on the rest of the screen.
import { $, icon } from './dom.js';
import { settings } from '../settings.js';
import { t } from '../i18n.js';

export class Touch {
  constructor(ui, root) {
    this.ui = ui;
    this.game = ui.game;
    const inp = this.game.input;
    this.el = $('div', { class: 'touch', hidden: true });
    this.knob = $('i');
    this.stick = $('div', { class: 'stick' }, this.knob);
    this.btns = $('div', { class: 'tbtns' });
    this.el.append(this.stick, this.btns);
    root.append(this.el);
    // joystick: appears where you touch inside its zone
    let pid = null, cx = 0, cy = 0;
    const R = () => (settings.get('touch.size') || 130) * 0.42;
    this.stick.addEventListener('pointerdown', (e) => {
      pid = e.pointerId;
      const r = this.stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      this.stick.setPointerCapture(pid);
      inp.touch.active = true;
      this.buzz(8);
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== pid) return;
      let x = (e.clientX - cx) / R(), y = (e.clientY - cy) / R();
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      inp.touch.moveX = x;
      inp.touch.moveY = -y;
      // push past the rim to run
      if (len > 1.25) inp.press('run'); else inp.release('run');
      this.knob.style.transform = `translate(${x * R() * 0.8}px, ${y * R() * 0.8}px)`;
    };
    this.stick.addEventListener('pointermove', move);
    const end = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      inp.touch.active = false;
      inp.touch.moveX = 0;
      inp.touch.moveY = 0;
      inp.release('run');
      this.knob.style.transform = '';
    };
    this.stick.addEventListener('pointerup', end);
    this.stick.addEventListener('pointercancel', end);
    // drag anywhere else on the canvas to look around
    const cv = this.game.renderer.renderer.domElement;
    let lid = null, lx = 0, ly = 0;
    cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && lid === null) { lid = e.pointerId; lx = e.clientX; ly = e.clientY; } });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid) return;
      inp.mouseDX += (e.clientX - lx) * 2.2;
      inp.mouseDY += (e.clientY - ly) * 2.2;
      inp.dragging = true;
      lx = e.clientX; ly = e.clientY;
    });
    const lend = (e) => { if (e.pointerId === lid) { lid = null; inp.dragging = false; } };
    cv.addEventListener('pointerup', lend);
    cv.addEventListener('pointercancel', lend);
    this.ctxKey = '';
    this.layout();
  }

  buzz(ms) { if (settings.get('touch.haptics') && navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* ignore */ } } }

  get wanted() { return this.ui.isTouch || !!settings.get('touch.force'); }

  refresh() { this.show(this.shown); }

  show(on) {
    this.shown = on;
    this.el.hidden = !(on && this.wanted);
  }

  layout() {
    const size = settings.get('touch.size') || 130;
    const side = settings.get('touch.side') || 'left';
    const op = settings.get('touch.opacity') ?? 0.75;
    this.el.style.setProperty('--stick', size + 'px');
    this.el.style.setProperty('--op', op);
    this.el.classList.toggle('flip', side === 'right');
  }

  button(label, ic, action, cls = '', hold = false) {
    const inp = this.game.input;
    const b = $('button', { class: 'tbtn ' + cls, 'aria-label': label }, icon(ic), $('span', { text: label }));
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); inp.press(action); this.buzz(hold ? 12 : 6); });
    const up = (e) => { e.preventDefault(); inp.release(action); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    return b;
  }

  // buttons follow what you are doing
  context() {
    const g = this.game, me = g.me;
    if (!me) return 'none';
    if (this.ui.desktop.active) return 'pc';
    if (me.mode === 'seated') return 'seat' + (g.calls.active ? '-call' : '') + (settings.get('mic.mode') === 'ptt' && g.platform.mic ? '-ptt' : '');
    if (me.mode === 'toilet' || me.mode === 'couch') return 'sit';
    return 'walk';
  }

  update() {
    if (this.el.hidden) return;
    const ctx = this.context() + this.game.lang;
    if (ctx === this.ctxKey) return;
    this.ctxKey = ctx;
    const L = this.game.lang;
    this.btns.replaceChildren();
    const c = this.context();
    this.stick.hidden = c !== 'walk';
    if (c === 'walk') {
      this.btns.append(
        this.button(L === 'es' ? 'Usar' : 'Use', 'hand', 'use', 'big'),
        this.button(L === 'es' ? 'Saltar' : 'Jump', 'jump', 'jump'),
        this.button(t('pee', L), 'pee', 'pee', 'pee', true),
        this.button(L === 'es' ? 'Pedo' : 'Fart', 'fart', 'fart', 'fart', true),
        this.button(L === 'es' ? 'Tirarse' : 'Flop', 'flop', 'flop'),
      );
    } else if (c.startsWith('seat')) {
      const b = [this.button('PC', 'monitor', 'pc', 'big')];
      if (c.includes('-call')) b.push(this.button(t('hangUp', L), 'hangup', 'hangup', 'hot'));
      if (c.includes('-ptt')) b.push(this.button(L === 'es' ? 'Hablar' : 'Talk', 'mic', 'talk', 'talk', true));
      b.push(this.button(t('stand', L), 'back', 'use'));
      this.btns.append(...b);
    } else if (c === 'sit') {
      this.btns.append(this.button(t('stand', L), 'back', 'use', 'big'));
    }
  }
}
