// Things pinned to the 3D world: coworkers' name tags, speech bubbles and
// markers over desks whose phone is ringing (with arrows at the screen edge
// when they are behind you).
// Runs every frame, so it never reads layout while writing styles (that forced
// the browser to re-layout the page several times per frame): the viewport
// size is cached on resize, element sizes once per text change, and styles are
// only written when they actually change.
import * as THREE from 'three';
import { $, icon } from './dom.js';
import { settings } from '../settings.js';

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

// write a style only if it changed (cached on the element)
function setOpacity(el, v) { if (el._op !== v) { el._op = v; el.style.opacity = v; } }
function setTransform(el, v) { if (el._tf !== v) { el._tf = v; el.style.transform = v; } }

export class Labels {
  constructor(root, game) {
    this.game = game;
    this.el = $('div', { class: 'labels', 'aria-hidden': 'true' });
    root.append(this.el);
    this.tags = new Map();
    this.bubbles = [];
    this.rings = new Map();
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    window.addEventListener('resize', () => { this.w = this.el.clientWidth || window.innerWidth; this.h = this.el.clientHeight || window.innerHeight; });
  }

  // element size, measured once (and again after its text changes)
  size(el) {
    if (!el._sz) el._sz = { w: el.offsetWidth, h: el.offsetHeight };
    return el._sz;
  }

  addTag(r) {
    const dot = $('i');
    dot.style.background = r.color;
    const ph = icon('phone');
    ph.hidden = true;
    const nm = $('span', { text: r.name });
    const el = $('div', { class: 'tag' }, dot, nm, ph);
    this.el.append(el);
    this.tags.set(r.id, { el, r, ph, nm, dot });
  }

  removeTag(r) {
    const t = this.tags.get(r.id);
    if (t) { t.el.remove(); this.tags.delete(r.id); }
  }

  bubble(pos, who, text, kind = 'coworker') {
    for (const b of this.bubbles) if (b.pos.distanceTo(pos) < 0.3) b.life = 0;
    const el = $('div', { class: 'bubble ' + kind }, $('b', { text: who }), $('span', { text }));
    this.el.append(el);
    this.bubbles.push({ el, pos: pos.clone(), life: 3.5 + Math.min(5, text.length / 22) });
  }

  // project a world point to screen px (`behind` when it is behind the camera)
  project(pos, lift = 0) {
    const cam = this.game.renderer.camera;
    _p.copy(pos);
    _p.y += lift;
    _q.copy(_p).project(cam);
    const w = this.w, h = this.h;
    const behind = _q.z > 1;
    return { x: (_q.x * 0.5 + 0.5) * w, y: (-_q.y * 0.5 + 0.5) * h, behind, nx: _q.x, ny: _q.y, w, h };
  }

  place(el, pos, lift = 0) {
    const s = this.project(pos, lift);
    if (s.behind || s.nx < -1.2 || s.nx > 1.2 || s.ny < -1.2 || s.ny > 1.2) { setOpacity(el, '0'); return false; }
    const sz = this.size(el);
    setTransform(el, `translate3d(${Math.round(s.x - sz.w / 2)}px, ${Math.round(s.y - sz.h)}px, 0)`);
    return true;
  }

  updateRings(hidden) {
    const g = this.game;
    const live = new Set();
    const myDesk = g.me && g.me.desk;
    for (const r of g.switchboard.rings) {
      if (g.switchboard.mine.has(r.id)) continue;
      const desk = g.office.desks[r.d];
      if (desk === myDesk) continue; // your own monitor already shows it
      live.add(r.id);
      let m = this.rings.get(r.id);
      if (!m) {
        m = { el: $('div', { class: 'ringmark' }, icon('phone'), $('em')) };
        this.el.append(m.el);
        this.rings.set(r.id, m);
      }
      if (hidden) { setOpacity(m.el, '0'); continue; }
      const cam = g.renderer.camera;
      const dist = `${Math.round(cam.position.distanceTo(desk.monitorWorld))} m`;
      if (m.dist !== dist) { m.dist = dist; m.el.lastChild.textContent = dist; }
      const s = this.project(desk.monitorWorld, 0.55);
      const onScreen = !s.behind && Math.abs(s.nx) < 0.92 && Math.abs(s.ny) < 0.88;
      let x = s.x, y = s.y;
      if (m.edge !== !onScreen) { m.edge = !onScreen; m.el.classList.toggle('edge', !onScreen); }
      if (!onScreen) {
        // clamp to the screen edge in the direction of the desk
        let nx = s.nx, ny = s.ny;
        if (s.behind) { nx = -nx; ny = -ny; }
        const k = 0.86 / Math.max(Math.abs(nx), Math.abs(ny), 1e-3);
        nx *= k; ny *= k;
        x = (nx * 0.5 + 0.5) * s.w;
        y = (-ny * 0.5 + 0.5) * s.h;
        const a = `${Math.atan2(-ny, nx).toFixed(2)}rad`;
        if (m.a !== a) { m.a = a; m.el.style.setProperty('--a', a); }
      }
      setOpacity(m.el, '1');
      setTransform(m.el, `translate3d(${Math.round(x - 24)}px, ${Math.round(y - 24)}px, 0)`);
    }
    for (const [id, m] of this.rings) if (!live.has(id)) { m.el.remove(); this.rings.delete(id); }
  }

  update(dt, hidden = false) {
    const g = this.game;
    const cam = g.renderer.camera.position;
    const showTags = settings.get('game.nameTags') !== false && !hidden;
    for (const tg of this.tags.values()) {
      const r = tg.r;
      if (!showTags) { setOpacity(tg.el, '0'); continue; }
      if (tg.name !== r.name) { tg.name = r.name; tg.nm.textContent = r.name; tg.el._sz = null; }
      if (tg.color !== r.color) { tg.color = r.color; tg.dot.style.background = r.color; }
      if (tg.call !== !!r.onCall) { tg.call = !!r.onCall; tg.ph.hidden = !r.onCall; tg.el._sz = null; }
      // off-screen characters are culled before this runs; skip their tags early
      if (!r.char.rig.root.visible && r.char.wantVisible) { setOpacity(tg.el, '0'); continue; }
      const head = r.char.headWorld(_p);
      const d = cam.distanceTo(head);
      if (d > 22) setOpacity(tg.el, '0');
      else if (this.place(tg.el, head, 0.32 * r.char.scale)) setOpacity(tg.el, (Math.max(0.3, 1 - d / 24)).toFixed(2));
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life -= dt;
      if (b.life <= 0) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      if (hidden) { setOpacity(b.el, '0'); continue; }
      const d = cam.distanceTo(b.pos);
      if (d > 16) setOpacity(b.el, '0');
      else if (this.place(b.el, b.pos, 0.55)) setOpacity(b.el, (Math.min(1, b.life * 2) * Math.max(0.35, 1 - d / 18)).toFixed(2));
    }
    this.updateRings(hidden);
  }
}
