// The settings menu: key bindings, touch joystick, audio, voices, graphics,
// AI provider and usage, language. Everything applies live and is saved.
import { $, clear, icon } from './dom.js';
import { t } from '../i18n.js';
import { settings, ACTIONS, keyLabel } from '../settings.js';
import { MARKS } from '../ai/marks.js';
import { PROVIDERS } from '../ai/openai.js';
import { usage } from '../ai/usage.js';

const TABS = ['controls', 'touch', 'audio', 'voices', 'graphics', 'ai', 'game'];
const TAB_KEYS = { controls: 'tabControls', touch: 'tabTouch', audio: 'tabAudio', voices: 'tabVoices', graphics: 'tabGraphics', ai: 'tabAI', game: 'tabGame' };
const ACTION_KEY = { moveF: 'aMoveF', moveB: 'aMoveB', moveL: 'aMoveL', moveR: 'aMoveR', run: 'aRun', jump: 'aJump', use: 'aUse', pc: 'aPc', hangup: 'aHangup', fart: 'aFart', pee: 'aPee', flop: 'aFlop', wave: 'aWave', dance: 'aDance', talk: 'aTalk', menu: 'aMenu' };

export class SettingsMenu {
  constructor(ui, root) {
    this.ui = ui;
    this.game = ui.game;
    this.el = $('div', { class: 'modal settings', hidden: true, role: 'dialog', 'aria-modal': 'true' });
    root.append(this.el);
    this.tab = 'controls';
    this.capturing = null;
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    window.addEventListener('keydown', (e) => {
      if (this.el.hidden || this.capturing) return;
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); }
    }, true);
  }

  get open() { return !this.el.hidden; }
  get L() { return this.game.lang; }

  show(tab = null) {
    if (tab) this.tab = tab;
    this.el.hidden = false;
    this.game.input.exitLock();
    this.render();
  }

  close() {
    this.cancelCapture();
    this.el.hidden = true;
    if (this.onClose) this.onClose();
  }

  render() {
    const L = this.L;
    clear(this.el);
    const tabs = $('div', { class: 'stabs', role: 'tablist' });
    for (const id of TABS) {
      tabs.append($('button', { role: 'tab', 'aria-selected': String(this.tab === id), onclick: () => { this.tab = id; this.render(); } }, t(TAB_KEYS[id], L)));
    }
    const body = $('div', { class: 'sbody' });
    this['tab_' + this.tab](body, L);
    const done = $('button', { class: 'btn yellow', onclick: () => this.close() }, t('done', L));
    this.el.append($('div', { class: 'window swin' },
      $('div', { class: 'titlebar' }, $('span', { class: 'os', text: 'ScamOS' }), $('span', { class: 'line', text: t('settings', L) }), $('span', { class: 'sp' }), done),
      tabs, body));
  }

  // ---- widgets --------------------------------------------------------------------------------
  row(label, control, help = null) {
    return $('div', { class: 'srow' }, $('div', { class: 'slabel' }, $('span', { text: label }), help ? $('small', { text: help }) : null), $('div', { class: 'sctl' }, control));
  }

  toggle(path, onChange) {
    const L = this.L;
    const v = !!settings.get(path);
    return $('div', { class: 'seg' }, ...[[true, t('on', L)], [false, t('off', L)]].map(([val, label]) =>
      $('button', { 'aria-pressed': String(v === val), onclick: () => { settings.set(path, val); if (onChange) onChange(val); this.render(); } }, label)));
  }

  choice(path, options, onChange) {
    const v = settings.get(path);
    return $('div', { class: 'seg' }, ...options.map(([val, label]) =>
      $('button', { 'aria-pressed': String(v === val), onclick: () => { settings.set(path, val); if (onChange) onChange(val); this.render(); } }, label)));
  }

  slider(path, min, max, step, fmt = (x) => x, onInput) {
    const out = $('output', { text: fmt(settings.get(path)) });
    const r = $('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(settings.get(path)) });
    r.addEventListener('input', () => { settings.set(path, +r.value); out.textContent = fmt(+r.value); if (onInput) onInput(+r.value); });
    return $('div', { class: 'slider' }, r, out);
  }

  // ---- tabs --------------------------------------------------------------------------------------
  tab_controls(b, L) {
    b.append($('p', { class: 'shelp', text: t('rebindHelp', L) }));
    const table = $('div', { class: 'binds' }, $('div', { class: 'bh' }, $('span'), $('span', { text: t('key1', L) }), $('span', { text: t('key2', L) })));
    const binds = settings.data.controls.bindings;
    for (const [id, rebind] of ACTIONS) {
      const row = $('div', { class: 'brow' }, $('span', { text: t(ACTION_KEY[id] || id, L) }));
      for (const slot of [0, 1]) {
        const code = binds[id] && binds[id][slot];
        const btn = $('button', { class: 'bkey' + (code ? '' : ' empty'), disabled: !rebind, text: keyLabel(code) });
        if (rebind) btn.addEventListener('click', () => this.capture(id, slot, btn));
        row.append(btn);
      }
      table.append(row);
    }
    b.append(table);
    b.append($('div', { class: 'btnrow left' }, $('button', { class: 'btn small', onclick: () => { settings.resetBindings(); this.render(); } }, t('resetKeys', L))));
    b.append(this.row(t('sensitivity', L), this.slider('controls.sensitivity', 0.3, 2.5, 0.05, (x) => x.toFixed(2) + '×')));
    b.append(this.row(t('invertY', L), this.toggle('controls.invertY')));
    b.append(this.row(t('gamepad', L), this.toggle('controls.gamepad')));
    b.append($('h4', { text: t('micMode', L) }));
    const micOk = this.game.platform.mic;
    if (!micOk) b.append($('p', { class: 'shelp warn', text: this.game.platform.kind === 'artifact' ? t('micArtifact', L) : t('micNo', L) }));
    b.append(this.row(t('micMode', L), this.choice('mic.mode', [['open', t('micOpen', L)], ['ptt', t('micPtt', L)], ['off', t('micNone', L)]], () => this.game.onMicSettings())));
    b.append(this.row(t('autoSend', L), this.slider('mic.autoSendMs', 500, 2500, 100, (x) => (x / 1000).toFixed(1) + ' s')));
  }

  capture(action, slot, btn) {
    this.cancelCapture();
    btn.textContent = t('pressKey', this.L);
    btn.classList.add('wait');
    this.capturing = { action, slot, btn };
    const onMouse = (e) => {
      if (!this.capturing) return;
      if (e.target === btn) return;
      const map = { 0: 'MouseLeft', 1: 'MouseMiddle', 2: 'MouseRight' };
      e.preventDefault();
      this.finishCapture(map[e.button]);
    };
    this.capturing.onMouse = onMouse;
    setTimeout(() => window.addEventListener('mousedown', onMouse, true), 0);
    this.game.input.capture = (code) => {
      if (code === 'Escape') { this.cancelCapture(); this.render(); return; }
      if (code === 'Backspace' || code === 'Delete') { this.finishCapture(null); return; }
      this.finishCapture(code);
    };
  }

  finishCapture(code) {
    const c = this.capturing;
    if (!c) return;
    this.cancelCapture();
    settings.bind(c.action, c.slot, code);
    this.game.audio.uiClick();
    this.render();
  }

  cancelCapture() {
    if (this.capturing && this.capturing.onMouse) window.removeEventListener('mousedown', this.capturing.onMouse, true);
    this.capturing = null;
    this.game.input.capture = null;
  }

  tab_touch(b, L) {
    b.append($('p', { class: 'shelp', text: t('mobileHint', L) }));
    b.append(this.row(t('joySide', L), this.choice('touch.side', [['left', t('left', L)], ['right', t('right', L)]], () => this.ui.touch.layout())));
    b.append(this.row(t('joySize', L), this.slider('touch.size', 90, 190, 5, (x) => x + ' px', () => this.ui.touch.layout())));
    b.append(this.row(t('btnOpacity', L), this.slider('touch.opacity', 0.3, 1, 0.05, (x) => Math.round(x * 100) + '%', () => this.ui.touch.layout())));
    b.append(this.row(t('haptics', L), this.toggle('touch.haptics')));
    b.append(this.row(t('forceTouch', L), this.toggle('touch.force', () => this.ui.touch.refresh())));
  }

  tab_audio(b, L) {
    const pct = (x) => Math.round(x * 100) + '%';
    for (const [path, key] of [['audio.master', 'vMaster'], ['audio.music', 'vMusic'], ['audio.sfx', 'vSfx'], ['audio.voices', 'vVoices'], ['audio.ambience', 'vAmbience']]) {
      b.append(this.row(t(key, L), this.slider(path, 0, 1, 0.05, pct)));
    }
    b.append(this.row(t('music', L), $('div', { class: 'seg' }, ...[[true, t('on', L)], [false, t('off', L)]].map(([on, label]) =>
      $('button', { 'aria-pressed': String(this.game.music.playing === on), onclick: () => { if (on) this.game.music.start(); else this.game.music.stop(); settings.set('audio.musicOn', on); this.render(); } }, label)))));
  }

  tab_voices(b, L) {
    const v = this.game.voice;
    b.append($('p', { class: 'shelp', text: t('voicesPreloaded', L) }));
    b.append(this.row(t('voiceRate', L), this.slider('voices.rate', 0.7, 1.4, 0.05, (x) => x.toFixed(2) + '×')));
    b.append(this.row(t('coworkerVoices', L), this.toggle('voices.coworkers')));
    // the preloaded cast (read-only): listen to each character's voice
    const list = v.ranked(L);
    if (!list.length) { b.append($('p', { class: 'shelp warn', text: t('noVoices', L) })); return; }
    b.append($('h4', { text: t('theCast', L) }));
    const grid = $('div', { class: 'voices' });
    const people = [...MARKS.filter((m) => !m.scambaiter).map((m) => ({ id: m.id, name: m.name, gender: m.voice.gender, p: m.voice })), { id: 'boss', name: t('boss', L), gender: 'male', p: { pitch: 0.6, rate: 1.05 } }];
    for (const who of people) {
      const cur = v.cast(who.id, L, who.gender);
      const play = $('button', { class: 'btn small', onclick: () => v.preview(who.id, L, who.gender, who.p) }, t('previewVoice', L));
      grid.append($('div', { class: 'vrow2 ro' }, $('div', {}, $('b', { text: who.name }), $('small', { text: cur ? cur.name : '' })), play));
    }
    b.append(grid);
  }

  tab_graphics(b, L) {
    const r = this.game.renderer;
    const q = settings.get('quality');
    b.append(this.row(t('quality', L), $('div', { class: 'seg' }, ...[[null, t('auto', L)], ['low', t('low', L)], ['medium', t('medium', L)], ['high', t('high', L)], ['ultra', t('ultra', L)]].map(([val, label]) =>
      $('button', { 'aria-pressed': String(q === val), onclick: () => { settings.set('quality', val); this.game.setQuality(val || r.qualityName, !val); this.render(); } }, label)))));
    b.append(this.row(t('reflections', L), this.toggle('graphics.reflections', (on) => r.setReflections(on))));
    b.append(this.row(t('rainFx', L), this.toggle('graphics.rain', (on) => { this.game.office.weather.rain = on ? 1 : 0; })));
    b.append(this.row(t('shakeFx', L), this.toggle('graphics.shake')));
    b.append(this.row(t('fov', L), this.slider('graphics.fov', 45, 90, 1, (x) => x + '°')));
    b.append(this.row(t('showFps', L), this.toggle('graphics.showFps')));
  }

  tab_ai(b, L) {
    const g = this.game, p = g.platform;
    if (p.kind === 'artifact') {
      b.append($('p', { class: 'shelp', text: p.sample ? t('aiClaude', L) : t('aiBackup', L) }));
      b.append($('p', { class: 'shelp', text: t('aiStandaloneOnly', L) }));
      b.append(this.row(t('aiProvider', L), this.choice('ai.provider', [['auto', t('aiAuto', L)], ['none', t('aiNone', L)]], () => g.refreshBrain())));
      b.append(this.row(t('claudeTier', L), this.choice('ai.claudeTier', [['quick', t('tierQuick', L)], ['default', t('tierDefault', L)]])));
    } else {
      const sel = $('select', { 'aria-label': t('aiProvider', L) }, $('option', { value: 'none', text: t('aiNone', L) }), ...Object.entries(PROVIDERS).map(([id, x]) => $('option', { value: id, text: x.label })));
      sel.value = settings.get('ai.provider') === 'auto' ? 'none' : settings.get('ai.provider') || 'none';
      const key = $('input', { type: 'password', placeholder: t('aiKey', L), value: settings.get('ai.key') || '', autocomplete: 'off', spellcheck: 'false' });
      const model = $('input', { type: 'text', placeholder: t('aiModel', L), value: settings.get('ai.model') || '', spellcheck: 'false' });
      const base = $('input', { type: 'text', placeholder: t('aiBase', L), value: settings.get('ai.base') || '', spellcheck: 'false' });
      const sync = (fromSelect) => {
        const pr = PROVIDERS[sel.value];
        if (fromSelect && pr) { model.value = pr.model; base.value = pr.base; key.placeholder = `${t('aiKey', L)} ${pr.keyHint}`; }
        key.hidden = sel.value === 'none' || sel.value === 'ollama';
        model.hidden = base.hidden = sel.value === 'none';
        settings.set('ai.provider', sel.value);
        settings.set('ai.key', key.value.trim());
        settings.set('ai.model', model.value.trim());
        settings.set('ai.base', base.value.trim());
        g.refreshBrain();
      };
      sel.addEventListener('change', () => sync(true));
      for (const i of [key, model, base]) { i.addEventListener('change', () => sync(false)); i.addEventListener('keydown', (e) => e.stopPropagation()); }
      key.hidden = sel.value === 'none' || sel.value === 'ollama';
      model.hidden = base.hidden = sel.value === 'none';
      b.append(this.row(t('aiProvider', L), $('div', { class: 'aicfg' }, sel, key, model, base)));
      // top-up store: buy convenience token packs (+5%). Checkout opens your site.
      b.append($('h4', { text: t('tokenStore', L) }));
      b.append($('p', { class: 'shelp', text: t('storeNote', L) }));
      b.append($('div', { class: 'btnrow left' }, $('button', { class: 'btn cash', onclick: () => { this.close(); this.ui.showStore(); } }, icon('coin'), ' ', t('buyTokens', L))));
    }
    // usage meter
    const s = usage.shift, tot = usage.total;
    const tok = (x) => Math.round(x.inTok + x.outTok).toLocaleString('en-US');
    b.append($('h4', { text: t('usageTitle', L) }));
    b.append($('div', { class: 'usage' },
      $('div', {}, $('span', { text: t('usageShift', L) }), $('b', { text: `${s.requests} ${t('requests', L)}` }), $('small', { text: `~${tok(s)} ${t('tokensEst', L)}` })),
      $('div', {}, $('span', { text: t('usageTotal', L) }), $('b', { text: `${tot.requests} ${t('requests', L)}` }), $('small', { text: `~${tok(tot)} ${t('tokensEst', L)}` }))));
    const pc = usage.perCall();
    if (s.calls) b.append($('p', { class: 'shelp', text: L === 'es' ? `Promedio por llamada: ${pc.requests.toFixed(1)} respuestas, ~${Math.round(pc.tokens).toLocaleString('en-US')} tokens.` : `Average per call: ${pc.requests.toFixed(1)} replies, ~${Math.round(pc.tokens).toLocaleString('en-US')} tokens.` }));
    b.append($('div', { class: 'btnrow left' }, $('button', { class: 'btn small', onclick: () => { usage.resetTotal(); this.render(); } }, t('resetUsage', L))));
  }

  tab_game(b, L) {
    b.append(this.row(t('language', L), this.choice('lang', [['en', 'English'], ['es', 'Español']], (v) => this.game.setLang(v))));
    b.append(this.row(t('subtitles', L), this.toggle('game.subtitles')));
    b.append(this.row(t('nameTags', L), this.toggle('game.nameTags')));
    b.append(this.row(t('forceTouch', L), this.toggle('touch.force', () => this.ui.touch.refresh())));
  }
}

export { icon };
