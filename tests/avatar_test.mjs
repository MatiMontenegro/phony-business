// Node test: time and size of the procedural avatar meshes.
import { bodyGeometry, headGeometry, hairGeometry, handGeometry, shoeGeometry, beardGeometry, HAIR_STYLES, setAvatarDetail } from '../src/actors/avatar.js';

function t(label, fn) {
  const a = performance.now();
  const r = fn();
  const ms = performance.now() - a;
  const g = r && (r.geometry || r);
  const tris = g && g.index ? g.index.count / 3 : 0;
  console.log(label.padEnd(34), (ms.toFixed(0) + ' ms').padStart(8), String(tris).padStart(8), 'tris');
  return r;
}
for (const d of ['high', 'low']) {
  setAvatarDetail(d);
  console.log('--- detail', d);
  t('body average buttonup', () => bodyGeometry({ build: 'average', sleeves: 'rolled', vneck: true }));
  t('body heavy tee', () => bodyGeometry({ build: 'heavy', sleeves: 'short' }));
  t('body fem slim long', () => bodyGeometry({ build: 'slim', fem: 1, sleeves: 'long' }));
  t('head preset 0', () => headGeometry({ preset: 0 }));
  t('head alien', () => headGeometry({ preset: 0, type: 'alien' }));
  t('head robot', () => headGeometry({ preset: 0, type: 'robot' }));
  for (const s of ['crop', 'curly', 'long', 'afro']) t('hair ' + s, () => hairGeometry(s, { preset: 0 }));
  t('beard full', () => beardGeometry({ preset: 0 }, 'full'));
  t('hand L', () => handGeometry('L'));
  t('hand R', () => handGeometry('R'));
  t('shoe sneaker', () => shoeGeometry('sneaker', ['#ffffff', '#222222', '#ff0000']));
  t('shoe dress', () => shoeGeometry('dress', ['#221a12', '#111111']));
}
