// Tiny DOM helpers and inline SVG icons for the UI.
export function $(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const clock = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem('pb:' + key) || 'null');
    localStorage.setItem('pb:' + key, JSON.stringify(value));
  } catch { /* storage is optional */ }
  return null;
}

const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
export const ICONS = {
  phone: P('M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z'),
  mic: P('M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z'),
  micOff: P('M19 11a7 7 0 0 1-1.2 3.9l-1.5-1.5c.4-.7.7-1.5.7-2.4zm-4 .2L9 5.2V5a3 3 0 0 1 6 0zM4.3 3 3 4.3l6 6V11a3 3 0 0 0 4.4 2.7l1.6 1.6A5 5 0 0 1 7 11H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 3.3-1.3L19.7 20l1.3-1.3z'),
  sound: P('M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z'),
  mute: P('M3 10v4h4l5 5V5L7 10H3zm16.6 2 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4z'),
  menu: P('M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z'),
  gear: P('M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z'),
  lock: P('M17 9V7A5 5 0 0 0 7 7v2H5v12h14V9zm-8-2a3 3 0 0 1 6 0v2H9z'),
  file: P('M6 2h8l6 6v14H6zM13 3.5V9h5.5z'),
  trash: P('M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z'),
  photo: P('M4 5h16v14H4zm2 12h12l-4-5-3 4-2-2z'),
  ledger: P('M5 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2zm3 5v2h8V8zm0 4v2h6v-2z'),
  remote: P('M3 4h18v12H3zm2 2v8h14V6zM8 18h8v2H8z'),
  notes: P('M5 3h14v18H5zm3 4v2h8V7zm0 4v2h8v-2zm0 4v2h5v-2z'),
  mail: P('M3 5h18v14H3zm2 2v.5l7 4.5 7-4.5V7zm0 3v7h14v-7l-7 4.5z'),
  power: P('M11 3h2v9h-2zm6.4 2.6 1.4 1.4A8 8 0 1 1 5.2 7l1.4-1.4A6 6 0 1 0 17.4 5.6z'),
  back: P('M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z'),
  pee: P('M12 2c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z'),
  fart: P('M7 14a5 5 0 0 1 4.9-4 4 4 0 0 1 7.6 1.5A3 3 0 0 1 19 17H8a3 3 0 0 1-1-3zM4 9a2 2 0 1 1 0 .1zM8 5a1.6 1.6 0 1 1 0 .1z'),
  jump: P('M12 3 5 10h4v5h6v-5h4zM5 18h14v3H5z'),
  flop: P('M4 16h16v3H4zm3-9a3 3 0 1 1 0 .1zM11 10h8l1 4h-9z'),
  hand: P('M18 7a1.5 1.5 0 0 0-1.5 1.5V12h-1V5.5a1.5 1.5 0 0 0-3 0V12h-1V4.5a1.5 1.5 0 0 0-3 0V12h-1V7.5a1.5 1.5 0 0 0-3 0V15a7 7 0 0 0 14 0V8.5A1.5 1.5 0 0 0 18 7z'),
  monitor: P('M3 4h18v12H3zm7 14h4v2h3v1H7v-1h3z'),
  hangup: P('M12 9c-1.6 0-3.1.3-4.6.7v3.1c0 .4-.2.7-.6.9-1 .5-1.9 1.1-2.7 1.8a1 1 0 0 1-1.4 0L.3 13.1a1 1 0 0 1 0-1.4A16.9 16.9 0 0 1 12 7a17 17 0 0 1 11.7 4.7 1 1 0 0 1 0 1.4l-2.4 2.4a1 1 0 0 1-1.4 0c-.8-.7-1.7-1.3-2.7-1.8a1 1 0 0 1-.6-.9V9.7C15.1 9.3 13.6 9 12 9z'),
  check: P('M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'),
  star: P('M12 2l3 7h7l-5.6 4.4L18.6 21 12 16.8 5.4 21l2.2-7.6L2 9h7z'),
  dice: P('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM7.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z'),
  x: P('M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z'),
};

export function icon(name, cls = 'ico') {
  const s = document.createElement('span');
  s.className = cls;
  s.innerHTML = ICONS[name] || '';
  return s;
}
