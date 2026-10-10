// Procedural canvas textures for the office (no image files).
import * as THREE from 'three';

export const FONT = {
  display: '"Shrikhand", "Cooper Black", Georgia, serif',
  body: '"Bricolage Grotesque", "Trebuchet MS", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',
};

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function tex(c, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

let seed = 1337;
export function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
export function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, p) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const w = (a, b) => hash(((a % p) + p) % p, ((b % p) + p) % p);
  const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function fbm(x, y, size, oct = 4, base = 8) {
  let amp = 0.5, sum = 0, norm = 0, p = base;
  for (let i = 0; i < oct; i++) {
    const f = p / size;
    sum += vnoise(x * f, y * f, p) * amp;
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}
function pixels(size, fn) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, gg, b] = fn(x, y);
    const i = (y * size + x) * 4;
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
export function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const clamp = (v) => Math.max(0, Math.min(255, v));

// polished concrete with wet patches (roughness map drives the reflections)
export function concrete() {
  const base = hexRgb('#4a4752');
  const map = pixels(512, (x, y) => {
    const n = fbm(x, y, 512, 5, 4);
    const sp = hash(x, y) * 0.08;
    const st = fbm(x + 91, y + 13, 512, 3, 2);
    const k = 0.82 + n * 0.3 + sp - (st > 0.62 ? (st - 0.62) * 0.6 : 0);
    return [clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k)];
  });
  const rough = pixels(512, (x, y) => {
    const wet = fbm(x + 400, y + 220, 512, 4, 2);
    const v = clamp(70 + fbm(x + 33, y + 71, 512, 4, 4) * 100 + hash(x + 5, y) * 14 - Math.max(0, wet - 0.52) * 260);
    return [v, v, v];
  });
  return { map: tex(map, { repeat: [6, 4] }), roughnessMap: tex(rough, { repeat: [6, 4], srgb: false }) };
}

export function carpet() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const cols = ['#173c45', '#1b4550', '#163a42', '#1e4a55'];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    g.fillStyle = cols[(i * 3 + j * 5) % cols.length];
    g.fillRect(i * 128, j * 128, 128, 128);
    g.save();
    g.beginPath(); g.rect(i * 128, j * 128, 128, 128); g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.035)';
    g.lineWidth = 2;
    const vert = (i + j) % 2 === 0;
    for (let k = 0; k < 128; k += 6) {
      g.beginPath();
      if (vert) { g.moveTo(i * 128 + k, j * 128); g.lineTo(i * 128 + k, j * 128 + 128); }
      else { g.moveTo(i * 128, j * 128 + k); g.lineTo(i * 128 + 128, j * 128 + k); }
      g.stroke();
    }
    for (let k = 0; k < 26; k++) {
      const x = i * 128 + hash(i * 97 + k, j * 31) * 128, y = j * 128 + hash(j * 53 + k, i * 17 + 3) * 128;
      g.fillStyle = k % 3 === 0 ? 'rgba(255,216,77,0.22)' : k % 3 === 1 ? 'rgba(143,167,255,0.18)' : 'rgba(255,77,94,0.16)';
      g.fillRect(x, y, 3, 3);
    }
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 2;
    g.strokeRect(i * 128 + 1, j * 128 + 1, 126, 126);
  }
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] = clamp(img.data[i] + n); img.data[i + 1] = clamp(img.data[i + 1] + n); img.data[i + 2] = clamp(img.data[i + 2] + n);
  }
  g.putImageData(img, 0, 0);
  return { map: tex(c, { repeat: [3, 2] }) };
}

export function tiles(light = '#c9e4df', grout = '#7a9a96', n = 8) {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = grout;
  g.fillRect(0, 0, 512, 512);
  const s = 512 / n;
  const L = hexRgb(light);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = 0.9 + hash(i, j) * 0.14;
    g.fillStyle = `rgb(${clamp(L[0] * k)},${clamp(L[1] * k)},${clamp(L[2] * k)})`;
    g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    const gr = g.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
    gr.addColorStop(0, 'rgba(255,255,255,0.18)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  return { map: tex(c, { repeat: [3, 3] }) };
}

export function wood() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const h = 512 / 6;
  for (let j = 0; j < 6; j++) {
    g.fillStyle = `hsl(${22 + hash(j, 7) * 8} 45% ${26 + hash(j, 3) * 10}%)`;
    g.fillRect(0, j * h, 512, h);
    for (let k = 0; k < 40; k++) {
      const y = j * h + hash(j * 13, k) * h;
      g.strokeStyle = `rgba(0,0,0,${0.05 + hash(k, j) * 0.12})`;
      g.lineWidth = 1 + hash(k, j * 3) * 2;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + k) * 2.5);
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, j * h, 512, 2);
    g.fillRect(hash(j, 99) * 512, j * h, 2, h);
  }
  return { map: tex(c, { repeat: [2, 2] }) };
}

export function fabric(color = '#3c4a7a') {
  const C = hexRgb(color);
  return {
    map: tex(pixels(256, (x, y) => {
      const k = ((x % 4 < 2) ^ (y % 4 < 2) ? 1.04 : 0.95) * (0.9 + hash(x, y) * 0.16);
      return [clamp(C[0] * k), clamp(C[1] * k), clamp(C[2] * k)];
    }), { repeat: [2, 1] }),
  };
}

export function ceiling() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#26213a';
  g.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    g.fillStyle = '#2d2744';
    g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
    for (let k = 0; k < 140; k++) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(i * 128 + hash(k, i * 9 + j) * 128, j * 128 + hash(j * 7 + i, k) * 128, 1.5, 1.5);
    }
  }
  return { map: tex(c, { repeat: [8, 6] }) };
}

export function neon(text, color = '#ff4d5e', w = 1024, h = 256) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let fs = h * 0.62;
  g.font = `${fs}px ${FONT.display}`;
  while (g.measureText(text).width > w * 0.92 && fs > 10) { fs -= 4; g.font = `${fs}px ${FONT.display}`; }
  g.shadowColor = color;
  for (const [blur, a] of [[40, 0.5], [18, 0.8], [6, 1]]) {
    g.shadowBlur = blur;
    g.globalAlpha = a;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + fs * 0.05);
  }
  g.globalAlpha = 1;
  g.shadowBlur = 0;
  g.globalAlpha = 0.55;
  g.fillStyle = '#ffc2cc';
  g.globalCompositeOperation = 'lighter';
  g.fillText(text, w / 2, h / 2 + fs * 0.05);
  g.globalAlpha = 1;
  return tex(c);
}

export function skyline() {
  const W = 2048, H = 768;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b0a24');
  sky.addColorStop(0.55, '#1d1450');
  sky.addColorStop(0.82, '#4a1e5c');
  sky.addColorStop(1, '#7a2f5e');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) {
    const x = rand() * W, y = rand() * H * 0.55, s = rand() < 0.08 ? 2.2 : 1.1;
    g.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.6})`;
    g.fillRect(x, y, s, s);
  }
  const mx = W * 0.78, my = H * 0.2;
  const glow = g.createRadialGradient(mx, my, 32.4, mx, my, 216);
  glow.addColorStop(0, 'rgba(255,240,210,0.35)');
  glow.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = glow;
  g.fillRect(mx - 216, my - 216, 432, 432);
  g.fillStyle = '#fff3d6';
  g.beginPath(); g.arc(mx, my, 54, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(200,180,150,0.35)';
  for (const [dx, dy, r] of [[-14, -10, 12], [18, 8, 9], [-4, 20, 7], [22, -18, 6]]) { g.beginPath(); g.arc(mx + dx, my + dy, r, 0, Math.PI * 2); g.fill(); }
  const layers = [
    { base: H * 0.62, maxH: H * 0.32, color: '#241a4d', win: 0.18, ww: 3 },
    { base: H * 0.78, maxH: H * 0.45, color: '#1a1238', win: 0.3, ww: 4 },
    { base: H, maxH: H * 0.55, color: '#110b26', win: 0.42, ww: 5 },
  ];
  const wc = ['#ffd84d', '#ffe9a8', '#8fa7ff', '#ff9f6b', '#fff6e0'];
  for (const L of layers) {
    let x = -20;
    while (x < W + 20) {
      const bw = 50 + rand() * 120, bh = L.maxH * (0.35 + rand() * 0.65), top = L.base - bh;
      g.fillStyle = L.color;
      g.fillRect(x, top, bw, H - top);
      if (rand() < 0.25) {
        g.fillRect(x + bw * 0.4, top - 30, bw * 0.12, 30);
        g.fillStyle = '#ff4d5e';
        g.fillRect(x + bw * 0.4, top - 34, 4, 4);
        g.fillStyle = L.color;
      }
      const cols = Math.floor(bw / (L.ww * 3.2)), rows = Math.floor(bh / (L.ww * 4.2));
      for (let r = 1; r < rows; r++) for (let k = 1; k < cols; k++) {
        if (rand() < L.win) {
          g.fillStyle = wc[Math.floor(rand() * wc.length)];
          g.globalAlpha = 0.55 + rand() * 0.45;
          g.fillRect(x + k * L.ww * 3.2, top + r * L.ww * 4.2, L.ww * 1.8, L.ww * 2.4);
        }
      }
      g.globalAlpha = 1;
      if (L === layers[1] && rand() < 0.12) {
        g.fillStyle = rand() < 0.5 ? '#ff4d5e' : '#46e3a0';
        g.shadowColor = g.fillStyle;
        g.shadowBlur = 14;
        g.fillRect(x + 6, top - 18, bw - 12, 10);
        g.shadowBlur = 0;
      }
      x += bw + rand() * 8;
    }
  }
  return tex(c);
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function wrapText(g, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  const lines = [];
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  const y0 = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => g.fillText(l, x, y0 + i * lh));
}

function posterArt(g, shape, fg) {
  g.fillStyle = fg;
  if (shape === 'phone') {
    g.beginPath(); g.moveTo(-170, 150); g.lineTo(-120, 40); g.lineTo(120, 40); g.lineTo(170, 150); g.closePath(); g.fill();
    g.fillStyle = '#ffd84d';
    g.beginPath(); g.arc(0, 98, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = fg;
    for (let i = 0; i < 8; i++) { const a = -Math.PI * 0.9 + i * 0.32; g.beginPath(); g.arc(Math.cos(a) * 30, 98 + Math.sin(a) * 30, 7, 0, Math.PI * 2); g.fill(); }
    g.translate(0, -40);
    g.strokeStyle = fg; g.lineCap = 'round'; g.lineWidth = 44;
    g.beginPath(); g.arc(0, 90, 140, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    for (const s of [-1, 1]) { g.save(); g.translate(s * 132, 52); g.rotate(s * 0.55); g.beginPath(); g.ellipse(0, 0, 46, 66, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    g.lineWidth = 7;
    g.beginPath();
    for (let i = 0; i <= 60; i++) { const y = 110 + i * 2.2, x = 150 + Math.sin(i * 0.9) * 16 - i * 1.2; i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
  } else if (shape === 'toilet') {
    roundRect(g, -70, -150, 140, 90, 16); g.fill();
    g.beginPath(); g.ellipse(0, -10, 110, 60, 0, 0, Math.PI * 2); g.fill();
    roundRect(g, -60, 30, 120, 90, 20); g.fill();
  } else if (shape === 'cloud') {
    for (const [x, y, r] of [[-60, 0, 70], [30, -30, 85], [90, 30, 60], [-10, 50, 60]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  } else if (shape === 'chart') {
    g.lineWidth = 24; g.strokeStyle = fg; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-150, 110); g.lineTo(-60, 20); g.lineTo(10, 70); g.lineTo(150, -120); g.stroke();
    g.beginPath(); g.moveTo(150, -120); g.lineTo(100, -120); g.moveTo(150, -120); g.lineTo(150, -70); g.stroke();
  }
}

export function poster(lines, o = {}) {
  const c = canvas(512, 704);
  const g = c.getContext('2d');
  const bg = o.bg || '#ffd84d', fg = o.fg || '#1a1433';
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 704);
  g.save();
  g.translate(256, 253);
  posterArt(g, o.artShape || 'phone', fg);
  g.restore();
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.font = `68px ${FONT.display}`;
  wrapText(g, lines[0], 256, 704 * 0.7, 440, 70);
  g.font = `600 26px ${FONT.body}`;
  wrapText(g, lines[1] || '', 256, 620, 410, 30);
  g.strokeStyle = fg;
  g.lineWidth = 10;
  g.strokeRect(16, 16, 480, 672);
  return tex(c);
}

export function postIt(text, color = '#ffd84d') {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(0,0,0,0.08)');
  gr.addColorStop(0.2, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.06)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#2a2050';
  g.textAlign = 'center';
  g.font = `italic 600 34px ${FONT.body}`;
  g.save();
  g.translate(128, 128);
  g.rotate(-0.06);
  wrapText(g, text, 0, 0, 210, 38);
  g.restore();
  return tex(c);
}

export function wetFloor(lang = 'en') {
  const c = canvas(256, 384);
  const g = c.getContext('2d');
  g.fillStyle = '#ffd84d';
  g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#1a1433';
  g.beginPath(); g.moveTo(128, 40); g.lineTo(216, 190); g.lineTo(40, 190); g.closePath();
  g.lineWidth = 14; g.strokeStyle = '#1a1433'; g.stroke();
  g.font = `bold 90px ${FONT.body}`;
  g.textAlign = 'center';
  g.fillText('!', 128, 175);
  g.font = `44px ${FONT.display}`;
  const t = lang === 'es' ? ['PISO', 'MOJADO'] : ['WET', 'FLOOR'];
  g.fillText(t[0], 128, 260);
  g.fillText(t[1], 128, 312);
  return tex(c);
}

export function softDot() {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return tex(c, { srgb: false });
}

export function keyboard() {
  const c = canvas(512, 160);
  const g = c.getContext('2d');
  g.fillStyle = '#2b2740';
  g.fillRect(0, 0, 512, 160);
  const kw = 492 / 15;
  for (let r = 0; r < 5; r++) for (let k = 0; k < 15; k++) {
    if (r === 4 && k > 3 && k < 11) continue;
    g.fillStyle = '#d9d3c4';
    roundRect(g, 10 + k * kw + 2, 10 + r * 28 + 2, kw - 4, 24, 4);
    g.fill();
  }
  g.fillStyle = '#d9d3c4';
  roundRect(g, 10 + 4 * kw + 2, 10 + 4 * 28 + 2, kw * 7 - 4, 24, 4);
  g.fill();
  return tex(c);
}

export function nameplate(text, color = '#ffd84d') {
  const c = canvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#1a1433';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = color;
  g.fillRect(0, 114, 512, 14);
  g.fillStyle = '#f6f1e3';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let fs = 64;
  g.font = `700 ${fs}px ${FONT.body}`;
  while (g.measureText(text).width > 460 && fs > 14) { fs -= 4; g.font = `700 ${fs}px ${FONT.body}`; }
  g.fillText(text, 256, 60);
  return tex(c);
}

export function whiteboard(lang = 'en') {
  const W = 1024, H = 512;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#eef0f4';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 30; i++) { g.beginPath(); g.moveTo(rand() * W, rand() * H); g.lineTo(rand() * W, rand() * H); g.stroke(); }
  const red = '#d12a3a', ink = '#1d1d2b';
  g.font = `italic 700 54px ${FONT.body}`;
  g.fillStyle = '#2a4fd1';
  g.fillText(lang === 'es' ? 'GUION DE HOY:' : "TODAY'S SCRIPT:", 40, 80);
  g.font = `italic 600 38px ${FONT.body}`;
  g.fillStyle = ink;
  (lang === 'es' ? ['1. Saludá', '2. Sé gracioso', '3. ¿¿¿???', '4. ¡GANANCIA!'] : ['1. Say hi', '2. Be funny', '3. ???', '4. PROFIT']).forEach((l, i) => g.fillText(l, 60, 150 + i * 62));
  g.strokeStyle = red; g.lineWidth = 6;
  g.beginPath(); g.ellipse(170, 340, 140, 40, -0.05, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = ink; g.lineWidth = 5;
  g.beginPath(); g.moveTo(560, 420); g.lineTo(560, 120); g.moveTo(560, 420); g.lineTo(960, 420); g.stroke();
  g.strokeStyle = red; g.lineWidth = 7;
  g.beginPath(); g.moveTo(570, 380); g.lineTo(660, 320); g.lineTo(730, 360); g.lineTo(820, 220); g.lineTo(940, 140); g.stroke();
  g.fillStyle = red;
  g.font = `italic 700 40px ${FONT.body}`;
  g.fillText(lang === 'es' ? '¡ventas!' : 'sales!', 820, 120);
  g.fillStyle = ink;
  g.font = `italic 600 30px ${FONT.body}`;
  g.fillText(lang === 'es' ? 'baños: 40 seg máx. — Phil' : 'bathroom: 40 sec max. —Phil', 560, 480);
  return tex(c);
}

// rain streaks for the windows: tileable normal-ish drop map
export function rainDrops() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,0)';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const x = rand() * 256, y = rand() * 256, r = 1.5 + rand() * 4;
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    gr.addColorStop(0, 'rgb(90,90,255)');
    gr.addColorStop(1, 'rgba(128,128,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2); g.fill();
  }
  return tex(c, { srgb: false, repeat: [1, 1] });
}
