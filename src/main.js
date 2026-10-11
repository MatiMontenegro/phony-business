// Boot: fonts, WebAssembly physics, the game, the UI, then the lobby.
import '@fontsource/shrikhand/latin-400.css';
import '@fontsource/bricolage-grotesque/latin-400.css';
import '@fontsource/bricolage-grotesque/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './styles.css';
import * as THREE from 'three';
import { initPhysics } from './engine/physics.js';
import { Game } from './game.js';
import { UI } from './ui/ui.js';
import { detectPlatform, makeNet } from './platform.js';
import { settings } from './settings.js';
import { t, detectLang } from './i18n.js';
import { store } from './ui/dom.js';

const params = new URLSearchParams(location.search);

async function fonts() {
  const list = ['48px "Shrikhand"', '600 32px "Bricolage Grotesque"', '800 32px "Bricolage Grotesque"', '400 20px "IBM Plex Mono"', '600 20px "IBM Plex Mono"'];
  try { await Promise.race([Promise.all(list.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 3000))]); } catch { /* fonts are optional */ }
}

function bootScreen(lang) {
  const el = document.createElement('div');
  el.className = 'boot';
  el.innerHTML = '<div><div class="logo">Phony<br>Business</div><div class="status"></div></div>';
  el.querySelector('.status').textContent = t('loading', lang);
  document.body.append(el);
  return el;
}

function pickQuality() {
  const q = params.get('q') || settings.get('quality');
  if (q) return { q, auto: false };
  // phones and tablets start on the light mobile path (no post-processing, lite
  // lights); the auto-tuner only ever steps down from here
  const coarse = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  return { q: coarse ? 'low' : cores >= 8 ? 'high' : 'medium', auto: true };
}

async function main() {
  const lang = params.get('lang') || settings.get('lang') || detectLang();
  settings.data.lang = lang;
  const app = document.getElementById('app');
  app.innerHTML = '<div class="stage" id="stage"></div>';
  const boot = bootScreen(lang);
  const platform = detectPlatform();
  await fonts();
  try {
    await initPhysics();
  } catch (e) {
    boot.querySelector('.status').textContent = lang === 'es'
      ? 'Este navegador bloqueó WebAssembly, que mueve la física del juego. Probá con Chrome, Edge o Firefox actualizados.'
      : 'This browser blocked WebAssembly, which runs the game physics. Try an up-to-date Chrome, Edge or Firefox.';
    throw e;
  }
  const { q, auto } = pickQuality();
  const game = new Game(document.getElementById('stage'), { platform, quality: q, lang, test: params.has('test') });
  game.init();
  game.qualityAuto = auto;
  window.__game = game;
  window.THREE = THREE;
  const ui = new UI(game);
  window.__ui = ui;
  if (params.has('test')) {
    const { setupTestScene } = await import('./testScene.js');
    await setupTestScene(game, ui, params.get('test'), platform);
    boot.classList.add('done');
    window.__ready = true;
    return;
  }
  game.start();
  ui.showLobby(async (profile) => {
    await platform.ready;
    const net = await makeNet(platform, profile.code || 'main');
    await game.joinShift(profile, net);
    ui.enterGame();
  });
  platform.ready.then(() => {
    const saved = store('profile');
    if (platform.viewerName && !(saved && saved.name) && ui.lobby) { ui.lobby.p.name = platform.viewerName.slice(0, 18); }
    if (ui.lobby) ui.lobby.render();
  });
  setTimeout(() => boot.classList.add('done'), 200);
  setTimeout(() => boot.remove(), 1000);
  window.__ready = true;
}

main().catch((e) => {
  console.error(e);
  const pre = document.createElement('pre');
  pre.className = 'boot-error';
  pre.textContent = String((e && e.stack) || e);
  document.body.append(pre);
});
