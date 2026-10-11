// Text to speech with voice casting: every character gets its own installed
// voice (preferring natural/neural ones), with light pitch/rate shaping.
import { settings } from '../settings.js';

const FEMALE = /female|woman|samantha|victoria|karen|moira|tessa|fiona|paulina|monica|mónica|helena|laura|lucia|lucía|sabina|zira|susan|catherine|kate|serena|allison|ava|joanna|salli|camila|penelope|lupe|francisca|mia|elena|elvira|dalia|maria|maría|isabel|ximena|valentina|sofia|sofía|jenny|aria|emma|libby|sonia|clara|natasha|hazel|linda|heather|nuria|salome|salomé|tania|abril|dolores|beatriz|renata|larissa|lourdes/i;
const MALE = /\bmale\b|man\b|daniel|alex|fred|jorge|diego|juan|carlos|pablo|enrique|david|mark|james|george|tom|rishi|miguel|andres|andrés|alvaro|álvaro|tomas|tomás|gonzalo|jorge|raul|raúl|federico|mateo|guy|ryan|eric|christopher|davis|tony|brian|liam|elias|gerardo|alonso|arnau|dario|darío|emilio|esteban|nicolas|nicolás|santiago|lorenzo/i;

function quality(v) {
  let s = 0;
  if (/natural|neural|online/i.test(v.name)) s += 6;
  if (/premium|enhanced|wavenet|studio/i.test(v.name)) s += 4;
  if (/google/i.test(v.name)) s += 3;
  if (/microsoft/i.test(v.name) && !/online|natural/i.test(v.name)) s -= 1;
  if (!v.localService) s += 1;
  if (/compact|espeak|robot/i.test(v.name)) s -= 4;
  return s;
}

function region(v, lang) {
  const l = (v.lang || '').toLowerCase();
  if (lang === 'es') {
    if (/es[-_](ar|uy)/.test(l)) return 3;
    if (/es[-_](419|us|mx|co|cl|pe)/.test(l)) return 2;
    if (l.startsWith('es')) return 1;
    return -10;
  }
  if (/en[-_](us)/.test(l)) return 2;
  if (l.startsWith('en')) return 1;
  return -10;
}

function genderOf(v) {
  if (FEMALE.test(v.name) && !/\bmale\b/i.test(v.name.replace(/female/i, ''))) return 'female';
  if (MALE.test(v.name)) return 'male';
  return 'any';
}

export class Voice {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.enabled = !!this.synth;
    this.busyPriority = -1;
    this.alive = [];
    this.casting = new Map(); // character id -> voice
    this.speaking = false;
    this.listeners = new Set();
    if (this.synth) {
      const load = () => { this.voices = this.synth.getVoices() || []; this.casting.clear(); };
      load();
      try { this.synth.addEventListener('voiceschanged', load); } catch { this.synth.onvoiceschanged = load; }
    }
  }

  onSpeaking(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  setSpeaking(on) { this.speaking = on; for (const fn of this.listeners) fn(on); }

  // voices usable for a language, best first
  ranked(lang) {
    return this.voices
      .filter((v) => region(v, lang) > 0)
      .map((v) => ({ v, s: quality(v) * 2 + region(v, lang) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.v);
  }

  hasNatural(lang) { return this.ranked(lang).some((v) => quality(v) >= 5); }

  // stable, distinct voice per character (preloaded; not user-selectable)
  cast(id, lang, gender = 'any') {
    const key = id + '|' + lang;
    if (this.casting.has(key)) return this.casting.get(key);
    const pool = this.ranked(lang);
    if (!pool.length) return null;
    const used = new Set([...this.casting.entries()].filter(([k]) => k.endsWith('|' + lang)).map(([, v]) => v));
    const fits = (v) => gender === 'any' || genderOf(v) === gender || genderOf(v) === 'any';
    let v = pool.find((x) => fits(x) && !used.has(x)) || pool.find((x) => fits(x)) || pool.find((x) => !used.has(x)) || pool[0];
    this.casting.set(key, v);
    return v;
  }

  // style -> pitch/rate shaping; natural voices are kept close to neutral
  shape(voice, p = {}) {
    const natural = voice && quality(voice) >= 5;
    let pitch = p.pitch ?? 1, rate = p.rate ?? 1;
    if (natural && !['robot', 'quirky', 'wail'].includes(p.style)) {
      pitch = 1 + (pitch - 1) * 0.35;
      rate = 1 + (rate - 1) * 0.6;
    }
    rate *= settings.get('voices.rate') || 1;
    return { pitch: Math.max(0.1, Math.min(2, pitch)), rate: Math.max(0.5, Math.min(2, rate)) };
  }

  speak(text, { id = 'narrator', lang = 'en', gender = 'any', pitch = 1, rate = 1, style = null, volume = 1, priority = 2, onstart, onend, onboundary } = {}) {
    if (!this.enabled || !text) { if (onend) setTimeout(onend, 300); return null; }
    const s = this.synth;
    if (s.speaking || s.pending) {
      if (priority < this.busyPriority) { if (onend) setTimeout(onend, 0); return null; }
      if (priority > this.busyPriority) s.cancel();
    }
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 400));
    const v = this.cast(id, lang, gender);
    if (v) u.voice = v;
    u.lang = v ? v.lang : lang === 'es' ? 'es-AR' : 'en-US';
    const sh = this.shape(v, { pitch, rate, style });
    u.pitch = sh.pitch;
    u.rate = sh.rate;
    u.volume = Math.max(0, Math.min(1, volume * (settings.get('audio.voices') ?? 1) * (settings.get('audio.master') ?? 1)));
    this.busyPriority = priority;
    const done = () => {
      this.alive = this.alive.filter((x) => x !== u);
      if (!s.speaking) { this.busyPriority = -1; this.setSpeaking(false); }
      if (onend) onend();
    };
    u.onstart = () => { this.setSpeaking(true); if (onstart) onstart(); };
    u.onend = done;
    u.onerror = done;
    if (onboundary) u.onboundary = onboundary;
    this.alive.push(u);
    try { s.speak(u); } catch { done(); }
    return u;
  }

  preview(id, lang, gender, p) {
    this.speak(lang === 'es' ? '¡Hola! Así sueno en la llamada.' : 'Hi! This is how I sound on the call.', { id, lang, gender, ...p, priority: 3 });
  }
}
