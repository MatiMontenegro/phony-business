// Little time-wasting apps on the office PC, so you can goof off while a call
// is going (there are bonus challenges for it). Minesweeper and Snake are fully
// playable; Phony Feed is an endless scroll of made-up office clips. Each app
// reports progress to the game (g.emit('arcade', ...)) for the bonus goals.
import { $, clear, icon, store } from './dom.js';
import { t } from '../i18n.js';

// ---- Minesweeper -------------------------------------------------------------------------------
export class Minesweeper {
  constructor(game, onEvent) {
    this.game = game;
    this.onEvent = onEvent || (() => {});
    this.cols = 9; this.rows = 9; this.mines = 10;
    this.el = $('div', { class: 'mines' });
    this.statusEl = $('div', { class: 'mstatus' });
    this.gridEl = $('div', { class: 'mgrid' });
    this.el.append(this.statusEl, this.gridEl);
    this.reset();
  }

  reset() {
    this.started = false;
    this.over = false;
    this.won = false;
    this.flagMode = false; // touch: tap places flags instead of opening
    this.flags = 0;
    this.revealed = 0;
    this.cells = []; // {mine, near, open, flag}
    for (let i = 0; i < this.cols * this.rows; i++) this.cells.push({ mine: false, near: 0, open: false, flag: false });
    this.render();
  }

  idx(x, y) { return y * this.cols + x; }
  neighbors(x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) out.push([nx, ny]);
    }
    return out;
  }

  // mines are placed after the first click so the first cell is always safe
  place(sx, sy) {
    const safe = new Set([this.idx(sx, sy), ...this.neighbors(sx, sy).map(([x, y]) => this.idx(x, y))]);
    let placed = 0;
    while (placed < this.mines) {
      const i = Math.floor(Math.random() * this.cells.length);
      if (safe.has(i) || this.cells[i].mine) continue;
      this.cells[i].mine = true;
      placed++;
    }
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      if (this.cells[this.idx(x, y)].mine) continue;
      this.cells[this.idx(x, y)].near = this.neighbors(x, y).filter(([nx, ny]) => this.cells[this.idx(nx, ny)].mine).length;
    }
    this.started = true;
  }

  open(x, y) {
    if (this.over) return;
    const c = this.cells[this.idx(x, y)];
    if (c.flag || c.open) return;
    if (!this.started) this.place(x, y);
    this.flood(x, y);
    this.game.audio.blip(520, 0.03, 'square', 0.06);
    if (this.cells[this.idx(x, y)].mine) { this.boom(); return; }
    if (this.revealed === this.cells.length - this.mines) this.win();
    this.render();
  }

  flood(x, y) {
    const c = this.cells[this.idx(x, y)];
    if (c.open || c.flag) return;
    c.open = true;
    if (!c.mine) this.revealed++;
    if (c.mine) return;
    if (c.near === 0) for (const [nx, ny] of this.neighbors(x, y)) this.flood(nx, ny);
  }

  flag(x, y) {
    if (this.over) return;
    const c = this.cells[this.idx(x, y)];
    if (c.open) return;
    c.flag = !c.flag;
    this.flags += c.flag ? 1 : -1;
    this.game.audio.blip(c.flag ? 760 : 420, 0.03, 'sine', 0.06);
    this.render();
  }

  boom() {
    this.over = true;
    for (const c of this.cells) if (c.mine) c.open = true;
    this.game.audio.uiError();
    this.onEvent('lose');
    this.render();
  }

  win() {
    this.over = true; this.won = true;
    for (const c of this.cells) if (c.mine) { c.flag = true; }
    this.game.audio.login();
    this.onEvent('win');
    this.render();
  }

  render() {
    const L = this.game.lang;
    clear(this.statusEl);
    const face = this.over ? (this.won ? ':D' : 'X(') : ':)';
    const flagBtn = $('button', { class: 'mflag' + (this.flagMode ? ' on' : ''), text: this.flagMode ? '>' : '*', title: L === 'es' ? 'Modo bandera' : 'Flag mode' });
    flagBtn.addEventListener('click', () => { this.flagMode = !this.flagMode; this.game.audio.uiClick(); this.render(); });
    this.statusEl.append(
      $('span', { class: 'mcount', text: '* ' + Math.max(0, this.mines - this.flags) }),
      $('button', { class: 'mface', onclick: () => { this.reset(); this.game.audio.uiClick(); } }, face),
      flagBtn,
      $('span', { class: 'mmsg', text: this.over ? (this.won ? (L === 'es' ? '¡Campo limpio!' : 'Field cleared!') : (L === 'es' ? '¡Boom!' : 'Boom!')) : (L === 'es' ? 'Clic: abrir · Der/bandera: marcar' : 'Click: open · Right-click/flag: mark') }));
    clear(this.gridEl);
    this.gridEl.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const c = this.cells[this.idx(x, y)];
      const cls = 'mcell' + (c.open ? ' open' : '') + (c.open && c.mine ? ' mine' : '') + (c.flag ? ' flag' : '') + (c.open && c.near ? ' n' + c.near : '');
      const label = c.open ? (c.mine ? '*' : c.near || '') : c.flag ? '>' : '';
      const b = $('button', { class: cls, text: String(label) });
      b.addEventListener('click', () => (this.flagMode ? this.flag(x, y) : this.open(x, y)));
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); this.flag(x, y); });
      this.gridEl.append(b);
    }
  }
}

// ---- Snake -------------------------------------------------------------------------------------
export class Snake {
  constructor(game, onEvent) {
    this.game = game;
    this.onEvent = onEvent || (() => {});
    this.size = 15;
    this.el = $('div', { class: 'snake' });
    this.scoreEl = $('div', { class: 'sscore' });
    this.canvas = $('canvas', { class: 'scanvas', width: '300', height: '300' });
    this.hint = $('div', { class: 'shint' });
    this.el.append(this.scoreEl, this.canvas, this.hint);
    this.ctx = this.canvas.getContext('2d');
    this.key = (e) => this.onKey(e);
    this.reset();
  }

  reset() {
    this.body = [{ x: 7, y: 7 }];
    this.dir = { x: 1, y: 0 };
    this.nextDir = this.dir;
    this.grow = 2;
    this.score = 0;
    this.best = store('snakeBest') || 0;
    this.dead = false;
    this.running = false;
    this.acc = 0;
    this.food = this.spawnFood();
    this.renderStatus();
    this.draw();
  }

  spawnFood() {
    let f;
    do { f = { x: Math.floor(Math.random() * this.size), y: Math.floor(Math.random() * this.size) }; }
    while (this.body.some((s) => s.x === f.x && s.y === f.y));
    return f;
  }

  start() { if (this.dead) this.reset(); this.running = true; this.hint.textContent = ''; }

  onKey(e) {
    const map = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
    const d = map[e.code];
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    if (!this.running) this.start();
    // no reversing straight into yourself
    if (d[0] === -this.dir.x && d[1] === -this.dir.y) return;
    this.nextDir = { x: d[0], y: d[1] };
  }

  step() {
    this.dir = this.nextDir;
    const head = { x: this.body[0].x + this.dir.x, y: this.body[0].y + this.dir.y };
    if (head.x < 0 || head.x >= this.size || head.y < 0 || head.y >= this.size || this.body.some((s) => s.x === head.x && s.y === head.y)) {
      this.die();
      return;
    }
    this.body.unshift(head);
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score++;
      this.grow += 1;
      this.food = this.spawnFood();
      this.game.audio.blip(660 + this.score * 30, 0.05, 'square', 0.09);
      this.onEvent('food', this.score);
      if (this.score > this.best) { this.best = this.score; store('snakeBest', this.best); }
      this.renderStatus();
    }
    if (this.grow > 0) this.grow--; else this.body.pop();
  }

  die() {
    this.dead = true;
    this.running = false;
    this.game.audio.uiError();
    this.onEvent('dead', this.score);
    const L = this.game.lang;
    this.hint.textContent = (L === 'es' ? `Perdiste con ${this.score}. Flecha para reintentar.` : `Dead at ${this.score}. Arrow key to retry.`);
    this.draw();
  }

  renderStatus() {
    const L = this.game.lang;
    clear(this.scoreEl);
    this.scoreEl.append($('span', { text: (L === 'es' ? 'Puntos: ' : 'Score: ') + this.score }), $('span', { class: 'sbest', text: (L === 'es' ? 'Récord: ' : 'Best: ') + this.best }));
    if (!this.running && !this.dead) this.hint.textContent = (L === 'es' ? 'Flechas o WASD para jugar' : 'Arrows or WASD to play');
  }

  update(dt) {
    if (!this.running) return;
    this.acc += dt;
    const period = 0.12;
    while (this.acc >= period) { this.acc -= period; this.step(); if (this.dead) break; }
    this.draw();
  }

  draw() {
    const ctx = this.ctx, px = this.canvas.width / this.size;
    ctx.fillStyle = '#0b2a12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#ff5566';
    ctx.fillRect(this.food.x * px + 2, this.food.y * px + 2, px - 4, px - 4);
    this.body.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#9fffb0' : this.dead ? '#5a7a60' : '#46e3a0';
      ctx.fillRect(s.x * px + 1, s.y * px + 1, px - 2, px - 2);
    });
  }
}

// ---- Phony Feed: an endless scroll of made-up office clips -------------------------------------
const FEED = {
  en: [
    ['@bigphil_boss', 'POV: your quota is due in 3 minutes', '38.2k', 'office'],
    ['@ragdoll_moments', 'He peed through the FLOOR again 💀', '902k', 'pee'],
    ['@grandma_nelly', 'Scammer called me. I knitted him a scarf. 🧶', '1.2M', 'baiter'],
    ['@the_switchboard', 'Three phones. Two hands. Zero chill.', '55k', 'phone'],
    ['@coffee.break', 'Day 400 of no hot coffee at this job', '12k', 'coffee'],
    ['@fart.symphony', 'Blamed it on the connection. Flawless.', '610k', 'fart'],
    ['@toon_office', 'When the boss walks in and you are dancing', '244k', 'dance'],
    ['@cubicle.life', 'My headset is older than my intern', '8.1k', 'office'],
    ['@moneyrain', 'Hit quota. Made it rain. Got fired anyway.', '420k', 'money'],
    ['@storm.window', 'Rain on the office glass is kinda relaxing tbh', '77k', 'rain'],
  ],
  es: [
    ['@bigphil_jefe', 'POV: la cuota vence en 3 minutos', '38.2k', 'office'],
    ['@momentos_ragdoll', 'Hizo pis A TRAVÉS del piso otra vez 💀', '902k', 'pee'],
    ['@abuela_nelly', 'Me llamó un estafador. Le tejí una bufanda. 🧶', '1.2M', 'baiter'],
    ['@el_conmutador', 'Tres teléfonos. Dos manos. Cero paz.', '55k', 'phone'],
    ['@pausa.cafe', 'Día 400 sin un café caliente en este laburo', '12k', 'coffee'],
    ['@sinfonia.pedo', 'Le eché la culpa a la conexión. Impecable.', '610k', 'fart'],
    ['@oficina_toon', 'Cuando entra el jefe y estás bailando', '244k', 'dance'],
    ['@vida.cubiculo', 'Mi vincha es más vieja que mi pasante', '8.1k', 'office'],
    ['@lluviaplata', 'Llegué a la cuota. Llovió plata. Me echaron igual.', '420k', 'money'],
    ['@ventana.tormenta', 'La lluvia en el vidrio de la oficina relaja, posta', '77k', 'rain'],
  ],
};
const FEED_BG = {
  office: 'linear-gradient(160deg,#4a5378,#1a2030)', pee: 'linear-gradient(160deg,#ffd84d,#5a4a10)',
  baiter: 'linear-gradient(160deg,#c78bff,#3a2a5a)', phone: 'linear-gradient(160deg,#ff4d5e,#2b2550)',
  coffee: 'linear-gradient(160deg,#8a5a32,#2a1a10)', fart: 'linear-gradient(160deg,#7bd36a,#2a3a1a)',
  dance: 'linear-gradient(160deg,#4dd6ff,#2c3a5a)', money: 'linear-gradient(160deg,#46e3a0,#0f2b20)',
  rain: 'linear-gradient(160deg,#5aa0ff,#1a2030)',
};

export class PhonyFeed {
  constructor(game, onEvent) {
    this.game = game;
    this.onEvent = onEvent || (() => {});
    this.el = $('div', { class: 'feed' });
    this.watched = new Set();
    this.order = [];
    this.build();
  }

  build() {
    clear(this.el);
    const L = this.game.lang;
    const list = FEED[L] || FEED.en;
    // a long shuffled reel so it feels endless
    this.order = [];
    for (let r = 0; r < 4; r++) this.order.push(...[...list.keys()].sort(() => Math.random() - 0.5));
    this.order.forEach((i, pos) => {
      const [who, caption, likes, bg] = list[i];
      const card = $('div', { class: 'feedcard', 'data-pos': String(pos), style: { background: FEED_BG[bg] || FEED_BG.office } },
        $('div', { class: 'feedtop', text: t('appFeed', L) }),
        $('div', { class: 'feedplay' }, icon('phone')),
        $('div', { class: 'feedmeta' },
          $('b', { text: who }),
          $('p', { text: caption }),
          $('div', { class: 'feedstats' }, $('span', { text: '♥ ' + likes }), $('span', { text: '▶ ' + (L === 'es' ? 'mirando' : 'watching') }))));
      this.el.append(card);
    });
    this.el.addEventListener('scroll', () => this.onScroll(), { passive: true });
  }

  onScroll() {
    const h = this.el.clientHeight;
    const pos = Math.round(this.el.scrollTop / h);
    if (pos === this.lastPos) return;
    this.lastPos = pos;
    if (!this.watched.has(pos)) {
      this.watched.add(pos);
      this.game.audio.blip(900, 0.02, 'sine', 0.05);
      this.onEvent('watch', this.watched.size);
    }
  }
}
