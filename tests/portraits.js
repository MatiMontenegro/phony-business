import { MARKS } from '../src/ai/marks.js';
import { portrait, portraitPose } from '../src/ui/portrait.js';
import { pumpBuilds, buildsPending } from '../src/actors/avatar.js';
const pump = setInterval(() => pumpBuilds(40), 0);
const q = new URLSearchParams(location.search);
if (q.get('pose')) portraitPose.override = JSON.parse(q.get('pose'));
const list = q.get('ids') ? MARKS.filter((m) => q.get('ids').split(',').includes(m.id)) : MARKS;
for (const m of list) {
  const url = await portrait(m);
  const f = document.createElement('figure');
  f.innerHTML = `<img src="${url}"><figcaption>${m.name}</figcaption>`;
  document.body.append(f);
}
clearInterval(pump);
window.__ready = true;
