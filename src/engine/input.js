// Keyboard + mouse + touch + gamepad, mapped to rebindable actions.
import { settings } from '../settings.js';

const PAD_MAP = { 0: 'jump', 1: 'flop', 2: 'use', 3: 'wave', 4: 'dance', 5: 'pc', 6: 'pee', 7: 'fart', 8: 'talk', 9: 'menu', 10: 'run' };

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.vDown = new Set(); // virtual (touch/gamepad) actions held
    this.vPressed = new Set();
    this.vReleased = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.locked = false;
    this.dragging = false;
    this.touch = { moveX: 0, moveY: 0, active: false };
    this.pad = { x: 0, y: 0, lx: 0, ly: 0, connected: false, prev: {} };
    this.capture = null; // rebinding: next key goes here
    this.lockSupported = 'requestPointerLock' in canvas && !matchMedia('(pointer: coarse)').matches;

    this._onKeyDown = (e) => {
      if (this.capture) {
        e.preventDefault();
        e.stopPropagation();
        const cb = this.capture;
        this.capture = null;
        cb(e.code);
        return;
      }
      if (isTyping(e)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this._onKeyUp = (e) => {
      if (this.down.has(e.code)) this.released.add(e.code);
      this.down.delete(e.code);
    };
    this._onBlur = () => {
      for (const c of this.down) this.released.add(c);
      this.down.clear();
      for (const a of this.vDown) this.vReleased.add(a);
      this.vDown.clear();
    };
    this._onMouseMove = (e) => {
      if (this.locked || this.dragging) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    };
    const MB = ['MouseLeft', 'MouseMiddle', 'MouseRight'];
    this._onMouseDown = (e) => {
      if (e.target !== canvas) return;
      // mouse buttons can be bound like keys (left click only while the pointer is locked)
      const code = MB[e.button];
      if (code && (this.locked || e.button !== 0)) { if (!this.down.has(code)) this.pressed.add(code); this.down.add(code); }
      if (e.button === 2 || !this.lockSupported) this.dragging = true;
    };
    this._onMouseUp = (e) => {
      const code = MB[e.button];
      if (code && this.down.has(code)) { this.released.add(code); this.down.delete(code); }
      this.dragging = false;
    };
    this._onWheel = (e) => {
      if (e.target !== canvas) return;
      this.wheel += Math.sign(e.deltaY);
    };
    this._onLockChange = () => { this.locked = document.pointerLockElement === canvas; };
    window.addEventListener('keydown', this._onKeyDown, true);
    window.addEventListener('keyup', this._onKeyUp, true);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this._onLockChange);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  requestLock() {
    if (!this.lockSupported || this.locked) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* pointer lock is optional */ }
  }

  exitLock() {
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch { /* ignore */ }
    }
  }

  codes(action) {
    const b = settings.data.controls.bindings[action];
    return b || [];
  }

  // held
  action(id) {
    if (this.vDown.has(id)) return true;
    for (const c of this.codes(id)) if (c && this.down.has(c)) return true;
    return false;
  }
  actionPressed(id) {
    if (this.vPressed.has(id)) return true;
    for (const c of this.codes(id)) if (c && this.pressed.has(c)) return true;
    return false;
  }
  actionReleased(id) {
    if (this.vReleased.has(id)) return true;
    for (const c of this.codes(id)) if (c && this.released.has(c)) return true;
    return false;
  }

  // raw keys (used by a few UI shortcuts)
  isDown(code) { return this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  wasReleased(code) { return this.released.has(code); }

  // virtual actions for touch buttons
  press(action) { if (!this.vDown.has(action)) this.vPressed.add(action); this.vDown.add(action); }
  release(action) { if (this.vDown.has(action)) this.vReleased.add(action); this.vDown.delete(action); }

  axis() {
    let x = 0, y = 0;
    if (this.action('moveF')) y += 1;
    if (this.action('moveB')) y -= 1;
    if (this.action('moveR')) x += 1;
    if (this.action('moveL')) x -= 1;
    if (this.touch.active) { x += this.touch.moveX; y += this.touch.moveY; }
    if (this.pad.connected) { x += this.pad.x; y += this.pad.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  // poll gamepads once per frame (before game logic)
  pollGamepad(dt) {
    if (!settings.data.controls.gamepad || !navigator.getGamepads) return;
    let gp = null;
    try { for (const g of navigator.getGamepads()) if (g && g.connected) { gp = g; break; } } catch { return; }
    this.pad.connected = !!gp;
    if (!gp) return;
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    this.pad.x = dz(gp.axes[0] || 0);
    this.pad.y = -dz(gp.axes[1] || 0);
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    this.mouseDX += rx * 900 * dt;
    this.mouseDY += ry * 700 * dt;
    for (const [idx, act] of Object.entries(PAD_MAP)) {
      const b = gp.buttons[idx];
      const on = !!(b && (b.pressed || b.value > 0.5));
      const was = !!this.pad.prev[idx];
      if (on && !was) this.press(act);
      if (!on && was) this.release(act);
      this.pad.prev[idx] = on;
    }
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.vPressed.clear();
    this.vReleased.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}

function isTyping(e) {
  const t = e.target;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
