// Where the game runs: inside a claude.ai artifact (Claude voices the marks
// through `sample`, friends meet through `room`) or as the downloadable /
// self-hosted page (microphone, free AI providers, P2P multiplayer).
import { Net, SoloTransport, RoomTransport, WsTransport, P2PTransport } from './net/net.js';
import { ClaudeBrain } from './ai/claude.js';
import { OpenAIBrain } from './ai/openai.js';
import { NanoBrain, nanoState } from './ai/nano.js';
import { ScriptedBrain } from './ai/scripted.js';
import { settings } from './settings.js';

export function detectPlatform() {
  const inArtifact = typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function';
  const secure = typeof window !== 'undefined' && (window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const p = {
    kind: inArtifact ? 'artifact' : 'web',
    sample: null,
    room: null,
    user: null,
    viewerName: '',
    // the claude.ai page runs in a sandboxed frame without microphone access
    mic: !inArtifact && secure && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && !!SR,
    ready: null,
  };
  if (inArtifact) {
    const use = (n) => window.claude.use(n).catch(() => null);
    p.ready = Promise.all([use('sample'), use('room'), use('user')]).then(async ([sample, room, user]) => {
      p.sample = sample;
      p.room = room || false;
      p.user = user;
      if (user) { try { const me = await user.me(); p.viewerName = me && me.name ? me.name.split(' ')[0] : ''; } catch { /* optional */ } }
      return p;
    });
  } else {
    p.room = false;
    p.ready = Promise.resolve(p);
  }
  return p;
}

export async function makeNet(p, code) {
  const q = new URLSearchParams(location.search);
  if (q.get('relay')) return new Net(new WsTransport(q.get('relay'), code));
  if (p.kind === 'artifact' && p.room) {
    try { return new Net(await RoomTransport.join(p.room, code)); } catch (e) { console.warn('room join failed', e); }
  }
  if (p.kind === 'web' && !q.has('solo')) {
    try { return new Net(await P2PTransport.join(code)); } catch (e) { console.warn('p2p unavailable', e); }
  }
  return new Net(new SoloTransport());
}

export function makeBrain(p) {
  const a = settings.data.ai;
  if (a.provider === 'none') return new ScriptedBrain();
  if (p.kind === 'artifact') return p.sample ? new ClaudeBrain(p.sample) : new ScriptedBrain();
  // the browser's own built-in model (Chrome): free, no key, nothing to set up
  if (a.provider === 'nano' && nanoState() === 'available') return new NanoBrain();
  if (a.provider && a.provider !== 'auto' && a.base && a.model) return new OpenAIBrain({ base: a.base, model: a.model, key: a.key, provider: a.provider });
  return new ScriptedBrain();
}
