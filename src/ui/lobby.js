// The lobby: a punch-in time card with a full look editor (build, shape,
// face, skin, eyes, hair, clothes, glasses, hat), language, shift code and
// graphics. Clocking in asks for the microphone (downloadable version).
import { $, clear, icon, store } from './dom.js';
import { t } from '../i18n.js';
import { settings, keyLabel } from '../settings.js';
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS, SHIRT_COLORS, PANTS_COLORS, SHIRT_STYLES, HAT_STYLES, BUILD_STYLES, randomLook, normalizeLook } from '../actors/rig.js';
import { FACES, HAIR_STYLES } from '../actors/avatar.js';

const NAMES = ['Gary', 'Dolores', 'Tiffany', 'Chad', 'Brenda', 'Kevin', 'Marge', 'Dwayne', 'Pam', 'Rocco', 'Nuria', 'Facundo', 'Lucía', 'Tito', 'Mirta'];
const HAT_NAMES = {
  en: { none: 'None', cap: 'Cap', beanie: 'Beanie', propeller: 'Propeller', crown: 'Crown', cowboy: 'Cowboy', party: 'Party' },
  es: { none: 'Nada', cap: 'Gorra', beanie: 'Gorro', propeller: 'Hélice', crown: 'Corona', cowboy: 'Vaquero', party: 'Cumple' },
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export class Lobby {
  constructor(ui, root, { onStart }) {
    this.ui = ui;
    this.game = ui.game;
    this.onStart = onStart;
    const saved = store('profile') || {};
    const look = saved.look ? normalizeLook(saved.look) : saved.shirt ? normalizeLook({ skin: saved.skin, shirt: saved.shirt, hat: saved.hat }) : randomLook();
    this.p = {
      name: saved.name || NAMES[Math.floor(Math.random() * NAMES.length)],
      look: this.slim(look),
      code: saved.code || 'main',
    };
    this.section = 'body';
    this.el = $('div', { class: 'lobby' });
    root.append(this.el);
    this.render();
    this.game.previewLook(this.p.look);
    this.game.on('qualityChanged', () => this.render());
  }

  // only the fields the editor owns (normalizeLook fills the rest)
  slim(n) {
    return {
      build: n.build, fem: n.fem, skin: n.skin, face: { preset: n.face.preset || 0, stubble: !!n.face.stubble }, eyes: n.eyes,
      hair: n.hair, hairColor: n.hairColor, beard: n.beard, shirt: { ...n.shirt }, pants: { ...n.pants }, shoes: { ...n.shoes },
      tie: n.tie, hat: n.hat, glasses: n.glasses, headset: true,
    };
  }

  get L() { return this.game.lang; }

  set(fn) {
    fn(this.p.look);
    this.render();
    clearTimeout(this.previewT);
    this.previewT = setTimeout(() => this.game.previewLook(this.p.look), 120);
    this.game.audio.uiClick();
  }

  swatches(list, get, setv) {
    const cur = get();
    return $('div', { class: 'swatches', role: 'group' }, ...list.map((c) =>
      $('button', { class: 'swatch', type: 'button', 'aria-pressed': String(cur === c), 'aria-label': c, style: { background: c }, onclick: () => this.set(() => setv(c)) })));
  }

  chips(items, get, setv) {
    const cur = get();
    return $('div', { class: 'chips', role: 'group' }, ...items.map(([v, label]) =>
      $('button', { class: 'chip', type: 'button', 'aria-pressed': String(cur === v), text: label, onclick: () => this.set(() => setv(v)) })));
  }

  render() {
    const L = this.L, p = this.p, lk = p.look;
    clear(this.el);
    // left: brand + controls
    const b = settings.data.controls.bindings;
    const k = (a) => keyLabel(b[a] && b[a][0]);
    const keys = [
      [`${k('moveF')}${k('moveL')}${k('moveB')}${k('moveR')}`, t('kMove', L)], [k('run'), t('kRun', L)], [k('jump'), t('kJump', L)], [k('use'), t('kUse', L)],
      [k('pc'), t('aPc', L)], [k('hangup'), t('aHangup', L)], [k('fart'), t('kFart', L)], [k('pee'), t('aPee', L)], [k('flop'), t('kFlop', L)], [k('wave'), t('kWave', L)], [k('dance'), t('kDance', L)], ['Esc', t('kMenu', L)],
    ];
    const left = $('div', { class: 'lobby-left' },
      $('div', { class: 'brand' }, $('h1', {}, 'Phony', $('span', { text: 'Business' })), $('p', { text: t('tagline', L) })),
      $('div', { class: 'keys' }, $('h2', {}, t('controls', L), ' ', $('button', { class: 'linkbtn', type: 'button', onclick: () => this.ui.openSettings('controls') }, icon('gear'), ' ', t('settings', L))),
        ...keys.map(([kk, label]) => $('div', { class: 'key-row' }, $('span', { class: 'kbd', text: kk }), $('span', { text: label })))));
    // right: the time card
    const name = $('input', { type: 'text', id: 'pb-name', maxlength: '18', value: p.name, autocomplete: 'off' });
    name.addEventListener('input', () => { p.name = name.value; });
    name.addEventListener('keydown', (e) => e.stopPropagation());
    const tabs = $('div', { class: 'looktabs', role: 'tablist' }, ...[['body', t('body', L)], ['face', t('face', L)], ['hair', t('hairStyle', L)], ['clothes', t('clothes', L)]].map(([id, label]) =>
      $('button', { type: 'button', role: 'tab', 'aria-selected': String(this.section === id), onclick: () => { this.section = id; this.render(); } }, label)));
    const sec = $('div', { class: 'looksec' });
    if (this.section === 'body') {
      sec.append(
        this.field(t('build', L), this.chips(BUILD_STYLES.map((x) => [x, t('b' + cap(x), L)]), () => lk.build, (v) => { lk.build = v; })),
        this.field(t('sex', L), this.chips([[0, t('male', L)], [1, t('female', L)]], () => (lk.fem ? 1 : 0), (v) => { lk.fem = v; if (v) { lk.beard = null; lk.face.stubble = false; } })),
        this.field(t('skin', L), this.swatches(SKIN_TONES, () => lk.skin, (v) => { lk.skin = v; })));
    } else if (this.section === 'face') {
      sec.append(
        this.field(t('face', L), this.chips(FACES.map((_, i) => [i, String(i + 1)]), () => lk.face.preset, (v) => { lk.face.preset = v; })),
        this.field(t('eyes', L), this.swatches(EYE_COLORS, () => lk.eyes, (v) => { lk.eyes = v; })),
        this.field(t('glasses', L), this.chips([[null, t('none', L)], ['round', t('round', L)], ['square', t('square', L)], ['sun', t('sun', L)]], () => lk.glasses || null, (v) => { lk.glasses = v; })),
        lk.fem ? null : this.field(L === 'es' ? 'Barba' : 'Beard', this.chips([['none', t('none', L)], ['stubble', L === 'es' ? 'De tres días' : 'Stubble'], ['full', L === 'es' ? 'Completa' : 'Full']], () => (lk.beard ? 'full' : lk.face.stubble ? 'stubble' : 'none'), (v) => { lk.beard = v === 'full' ? 'full' : null; lk.face.stubble = v === 'stubble'; })));
    } else if (this.section === 'hair') {
      sec.append(
        this.field(t('hairStyle', L), this.chips(HAIR_STYLES.map((x) => [x, t('h' + cap(x), L)]), () => lk.hair, (v) => { lk.hair = v; })),
        this.field(t('hairColor', L), this.swatches(HAIR_COLORS, () => lk.hairColor, (v) => { lk.hairColor = v; })),
        this.field(t('hat', L), this.chips(HAT_STYLES.map((x) => [x, (HAT_NAMES[L] || HAT_NAMES.en)[x]]), () => lk.hat, (v) => { lk.hat = v; })));
    } else {
      sec.append(
        this.field(t('topStyle', L), this.chips(SHIRT_STYLES.map((x) => [x, t('s' + cap(x), L)]), () => lk.shirt.style, (v) => { lk.shirt.style = v; })),
        this.field(t('topColor', L), this.swatches(SHIRT_COLORS, () => lk.shirt.color, (v) => { lk.shirt.color = v; })),
        this.field(t('pantsColor', L), this.swatches(PANTS_COLORS, () => lk.pants.color, (v) => { lk.pants.color = v; })),
        this.field(L === 'es' ? 'Corbata' : 'Tie', this.chips([[null, t('none', L)], ['#1a1433', L === 'es' ? 'Oscura' : 'Dark'], ['#ff4d5e', L === 'es' ? 'Roja' : 'Red'], ['#f2c14e', L === 'es' ? 'Dorada' : 'Gold']], () => lk.tie || null, (v) => { lk.tie = v; })));
    }
    const rand = $('button', { type: 'button', class: 'chip dice', onclick: () => this.set((l) => { const r = this.slim(normalizeLook(randomLook())); Object.assign(l, r); }) }, icon('dice'), ' ', t('randomize', L));
    const lang = this.chips([['en', 'English'], ['es', 'Español']], () => L, (v) => { this.game.setLang(v); });
    const code = $('input', { type: 'text', id: 'pb-code', maxlength: '20', value: p.code, autocomplete: 'off', spellcheck: 'false' });
    code.addEventListener('input', () => { p.code = code.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20); });
    code.addEventListener('keydown', (e) => e.stopPropagation());
    const q = settings.get('quality');
    const qual = $('div', { class: 'chips', role: 'group' }, ...[[null, t('auto', L)], ['low', t('low', L)], ['medium', t('medium', L)], ['high', t('high', L)], ['ultra', t('ultra', L)]].map(([v, label]) =>
      $('button', { class: 'chip', type: 'button', 'aria-pressed': String(q === v), text: v ? label : `${label} (${t(this.game.renderer.qualityName, L)})`, onclick: () => { settings.set('quality', v); this.game.setQuality(v || this.game.renderer.qualityName, !v); this.render(); } })));
    const plat = this.game.platform;
    const aiNote = plat.kind === 'artifact' ? (plat.sample ? t('aiClaude', L) : t('aiBackup', L)) : this.aiLine(L);
    const micNote = plat.mic ? t('micAsk', L) : plat.kind === 'artifact' ? t('micArtifact', L) : t('micNo', L);
    this.stamp = $('div', { class: 'stamp', 'aria-live': 'polite' });
    this.punchBtn = $('button', { class: 'punch', type: 'submit' }, t('clockIn', L));
    const form = $('form', { class: 'timecard', onsubmit: (e) => { e.preventDefault(); this.punch(); } },
      $('div', { class: 'tc-head' }, $('b', { text: L === 'es' ? 'TARJETA DE ASISTENCIA' : 'EMPLOYEE TIME CARD' }), $('span', { text: 'No. ' + (4000 + (p.name.length * 377) % 5000) })),
      this.field(t('yourName', L), name, 'pb-name'),
      $('div', { class: 'lookhead' }, $('span', { class: 'lbl', text: t('look', L) }), rand),
      tabs, sec,
      $('div', { class: 'row2' }, this.field(t('language', L), lang), this.field(t('shiftCode', L), code, 'pb-code')),
      $('div', { class: 'help', text: t('shiftCodeHelp', L), style: { margin: '-8px 0 12px' } }),
      this.field(t('graphics', L), qual),
      $('div', { class: 'ai-note' }, $('div', { text: aiNote }), $('div', { class: 'mic' }, icon(plat.mic ? 'mic' : 'micOff'), ' ', micNote)),
      this.punchBtn, this.stamp);
    this.el.append(left, form);
  }

  aiLine(L) {
    const pr = settings.get('ai.provider');
    if (pr && pr !== 'none' && pr !== 'auto' && settings.get('ai.base')) return (L === 'es' ? 'IA de los clientes: ' : 'AI for the marks: ') + pr + ' · ' + (settings.get('ai.model') || '');
    return t('aiBackup', L) + ' ' + (L === 'es' ? '(Configuración → IA para conectar una gratis)' : '(Settings → AI to connect a free one)');
  }

  field(label, control, forId = null) {
    return $('div', { class: 'field' }, forId ? $('label', { for: forId, text: label }) : $('span', { class: 'lbl', text: label }), control);
  }

  async punch() {
    if (this.punching) return;
    this.punching = true;
    const p = this.p, L = this.L;
    p.name = (p.name || '').replace(/[<>]/g, '').trim().slice(0, 18) || 'Agent ' + Math.floor(Math.random() * 90 + 10);
    p.code = p.code || 'main';
    store('profile', { name: p.name, look: p.look, code: p.code });
    this.punchBtn.disabled = true;
    const g = this.game;
    g.audio.unlock();
    g.audio.thud(null, 0.8);
    g.audio.blip(1200, 0.05, 'square', 0.15);
    this.stamp.textContent = (L === 'es' ? 'ENTRADA ' : 'IN ') + '11:00 PM';
    try {
      // the microphone prompt must come from this click
      if (g.platform.mic && settings.get('mic.mode') !== 'off') {
        this.stamp.textContent = t('micAsk', L);
        const ok = await g.mic.request(g.audio.ctx);
        this.stamp.textContent = ok ? t('micGranted', L) : t('micDenied', L);
      }
      await this.onStart({ name: p.name, look: normalizeLook(p.look), code: p.code, lang: L });
      this.el.remove();
    } catch (e) {
      console.error(e);
      this.stamp.textContent = String(e.message || e);
      this.punchBtn.disabled = false;
      this.punching = false;
    }
  }
}
