// UI root: wires the HUD, labels, PC desktop, settings, overlays, touch
// controls and the lobby together, and tells the game when keys belong to
// the interface.
import { $ } from './dom.js';
import { Hud } from './hud.js';
import { Labels } from './labels.js';
import { Desktop } from './desktop.js';
import { SettingsMenu } from './settingsMenu.js';
import { Overlays } from './overlays.js';
import { Touch } from './touch.js';
import { Lobby } from './lobby.js';
import { t } from '../i18n.js';
import { icon } from './dom.js';
import { settings, keyLabel } from '../settings.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.root = $('div', { class: 'ui-root' });
    document.body.append(this.root);
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    // phones are asked to rotate to landscape (CSS shows/hides this)
    this.rotate = $('div', { class: 'rotate-gate' },
      $('div', { class: 'rot-inner' }, $('div', { class: 'rot-phone' }), $('p', { text: t('rotate', game.lang) })));
    document.body.append(this.rotate);
    game.on('lang', () => { const p = this.rotate.querySelector('p'); if (p) p.textContent = t('rotate', game.lang); });
    this.labels = new Labels(this.root, game);
    this.hud = new Hud(this, this.root);
    this.desktop = new Desktop(this, this.root);
    this.touch = new Touch(this, this.root);
    this.overlays = new Overlays(this, this.root);
    this.settings = new SettingsMenu(this, this.root);
    this.settings.onClose = () => { if (this.lobby) this.lobby.render(); };
    game.setUI(this);
    game.renderer.renderer.domElement.addEventListener('click', () => {
      // seated: clicking the monitor answers or opens the PC
      if (game.mode === 'play' && game.isSeated && !this.desktop.active && !this.capturesKeys() && !game.screens.loggingIn) {
        if (!game.answerAtMyDesk()) game.openPC();
        return;
      }
      if (game.mode === 'play' && !game.isSeated && !this.desktop.active && !this.capturesKeys() && !this.isTouch) game.input.requestLock();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || this.settings.open || this.desktop.visible || this.desktop.active) return;
      if (!this.overlays.menu.hidden) { this.overlays.closeMenu(); return; }
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (game.mode === 'play' && !game.input.locked) this.openMenu();
    });
    game.on('lang', () => {
      if (this.lobby) this.lobby.render();
      this.desktop.relabel();
      if (this.settings.open) this.settings.render();
    });
  }

  showLobby(onStart) { this.lobby = new Lobby(this, this.root, { onStart }); }

  enterGame() {
    this.lobby = null;
    this.hud.show(true);
    this.touch.show(true);
    const L = this.game.lang;
    const b = settings.data.controls.bindings;
    const keys = { use: keyLabel(b.use && b.use[0]), pc: keyLabel(b.pc && b.pc[0]) };
    if (this.isTouch) { keys.use = L === 'es' ? 'Usar' : 'Use'; keys.pc = 'PC'; }
    setTimeout(() => this.hud.showHint(this.isTouch ? t('welcome', L, keys) : t('startHint', L) + ' ' + t('welcome', L, keys), 8), 600);
    if (this.game.platform.room === false) setTimeout(() => this.toast(t('soloNote', L), 'info'), 9000);
    if (this.game.platform.kind === 'artifact' && !this.game.platform.mic) setTimeout(() => this.toast(t('micArtifact', L), 'info'), 14000);
  }

  capturesKeys() { return !!this.lobby || this.settings.open || this.overlays.anyOpen || this.desktop.visible; }
  isTyping() { return this.desktop.isTyping(); }

  micButton() {
    const g = this.game;
    if (!g.platform.mic) { this.toast(g.platform.kind === 'artifact' ? t('micArtifact', g.lang) : t('micNo', g.lang), 'info'); return; }
    if (g.mic.state === 'denied') { this.toast(t('micDenied', g.lang), 'warn'); return; }
    if (g.mic.state !== 'granted') { g.mic.request(g.audio.ctx).then((ok) => { this.toast(ok ? t('micGranted', g.lang) : t('micDenied', g.lang), ok ? 'good' : 'warn'); g.onMicSettings(); }); return; }
    g.toggleMicMute();
  }

  toggleSound() {
    const a = this.game.audio;
    a.setMuted(!a.muted);
    this.hud.soundBtn.replaceChildren(icon(a.muted ? 'mute' : 'sound'));
    if (a.muted) this.game.voice.cancel();
    this.game.voice.enabled = !a.muted;
  }

  openMenu() { this.overlays.openMenu(); }
  openSettings(tab = null) { this.settings.show(tab); }
  toast(s, k) { this.hud.toast(s, k); }
  subtitle(w, s, k) { this.hud.subtitle(w, s, k); }
  bubble(p, w, s, k) { this.labels.bubble(p, w, s, k); }
  moneyPop(n) { this.hud.moneyPop(n); }
  addNameTag(r) { this.labels.addTag(r); }
  removeNameTag(r) { this.labels.removeTag(r); }
  showEnd(r) { this.desktop.active && this.game.closePC(); this.overlays.showEnd(r); }
  hideEnd() { this.overlays.hideEnd(); }
  showLinesDown(code) { this.overlays.showLinesDown(code); }
  showStore() { this.overlays.showStore(); }

  update(dt) {
    const pcCover = this.desktop.visible;
    this.hud.update(dt);
    this.labels.update(dt, pcCover || this.desktop.active);
    this.desktop.update(dt);
    this.touch.update();
    void settings;
  }
}
