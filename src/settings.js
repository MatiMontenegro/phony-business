// Player settings: persisted per browser, observable.
const KEY = 'pb:settings';

export const ACTIONS = [
  // [id, rebindable]
  ['moveF', true], ['moveB', true], ['moveL', true], ['moveR', true],
  ['run', true], ['jump', true], ['use', true], ['pc', true], ['hangup', true],
  ['fart', true], ['pee', true], ['flop', true], ['wave', true], ['dance', true],
  ['talk', true], ['menu', false],
];

export const DEFAULT_BINDINGS = {
  moveF: ['KeyW', 'ArrowUp'],
  moveB: ['KeyS', 'ArrowDown'],
  moveL: ['KeyA', 'ArrowLeft'],
  moveR: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space', null],
  use: ['KeyE', null],
  pc: ['Enter', 'KeyC'],
  hangup: ['KeyX', null],
  fart: ['KeyF', null],
  pee: ['KeyP', null],
  flop: ['KeyR', null],
  wave: ['KeyQ', null],
  dance: ['KeyG', null],
  talk: ['KeyV', null],
  menu: ['Escape', null],
};

export const DEFAULTS = {
  v: 2,
  lang: null, // null: follow the browser
  quality: null, // null: pick from the device, then auto-tune
  graphics: { reflections: true, rain: true, shake: true, fov: 60, showFps: false },
  audio: { master: 0.9, music: 0.45, sfx: 0.9, voices: 1, ambience: 0.6, musicOn: true },
  voices: { rate: 1, coworkers: true, own: true }, // own: Matías speaks with "Mi Voz" via Voicebox
  mic: { enabled: true, mode: 'open', autoSendMs: 1000 },
  controls: { bindings: DEFAULT_BINDINGS, sensitivity: 1, invertY: false, gamepad: true },
  touch: { side: 'left', size: 140, opacity: 0.8, haptics: true, force: false },
  ai: { provider: 'auto', key: '', model: '', base: '', claudeTier: 'quick' },
  game: { subtitles: true, nameTags: true, shiftMin: 6 }, // shiftMin: shift length when you open the office
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(base)) return over === undefined ? base : over;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && base[k] && !Array.isArray(base[k])) out[k] = merge(base[k], v);
    else out[k] = v;
  }
  return out;
}

class Settings {
  constructor() {
    this.data = clone(DEFAULTS);
    this.listeners = new Set();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && saved.v === 2) this.data = merge(this.data, saved);
    } catch { /* storage is optional */ }
    // bindings: make sure every action exists (new actions after an update)
    const b = this.data.controls.bindings;
    for (const [id] of ACTIONS) if (!Array.isArray(b[id])) b[id] = [...DEFAULT_BINDINGS[id]];
    b.menu = ['Escape', null];
  }

  get(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this.data);
  }

  set(path, value) {
    const keys = path.split('.');
    let o = this.data;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] ||= {};
    o[keys[keys.length - 1]] = value;
    this.save();
    for (const fn of this.listeners) { try { fn(path, value); } catch (e) { console.warn(e); } }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  resetBindings() {
    this.set('controls.bindings', clone(DEFAULT_BINDINGS));
  }

  // assign `code` to action slot; a key belongs to one action only
  bind(action, slot, code) {
    const b = clone(this.data.controls.bindings);
    if (code) for (const id of Object.keys(b)) b[id] = b[id].map((c) => (c === code ? null : c));
    b[action][slot] = code;
    this.set('controls.bindings', b);
  }
}

export const settings = new Settings();

// Human-readable key names for the UI
export function keyLabel(code) {
  if (!code) return '—';
  const map = {
    Space: 'Space', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab', Backspace: '⌫',
    ShiftLeft: 'Shift', ShiftRight: 'Shift R', ControlLeft: 'Ctrl', ControlRight: 'Ctrl R', AltLeft: 'Alt', AltRight: 'Alt R',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=',
    BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
    MouseLeft: 'Mouse 1', MouseRight: 'Mouse 2', MouseMiddle: 'Mouse 3',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
