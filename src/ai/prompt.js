// Prompt building and reply parsing for the AI-voiced marks. Each reply is
// one spoken line plus a JSON state line, so any chat model can play.
// The mark is the PERSON receiving a scam call; the player is the caller.
// Everything is fiction and every number is fake (SSNs use area 000, cards
// start 0000). The game owns the economy; the model only plays the person.
import { DATA, saidValue } from './marks.js';

const clampNum = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };

function langName(lang) { return lang === 'es' ? 'Rioplatense Spanish (Argentina; use "vos", natural and colloquial)' : 'English'; }

// the still-secret data the mark is holding, for the rules + status line
export function openLeads(call) { return call.leads.filter((l) => !l.known); }

export function systemPrompt(call) {
  const m = call.mark;
  const L = call.lang;
  const sc = call.scenario;
  const leadRules = call.leads.map((l) => `- ${DATA[l.key].label.en} = ${l.value} (only say it if trust is ${l.threshold} or more AND the caller asks for it or walks you through "confirming" it)`).join('\n');
  const baiter = m.scambaiter ? `
SPECIAL: you are secretly a scambaiter who KNOWS this is a scam and is toying with the caller. Play confused, waste their time with long cat stories, ask them to repeat. Any "data" you give is made up on the spot, and any "payment" you promise never really goes through. Around your fifth reply, gleefully reveal you have been recording the whole call.` : '';
  return `You are voicing ONE person in PHONY BUSINESS, a comedy party game about a call center of small-time phone scammers. The player is the CALLER trying to talk YOU into handing over information or a payment. You are the person who picked up. Everything is fiction and every number is FAKE and absurd (Social Security numbers start with 000, card numbers start 0000). Keep it funny, light and PG-13. This is a cartoon, never a real how-to.

WHO YOU ARE
Name: ${m.name} — ${m.title[L]}
${m.bio}
What wins your trust (your soft spot, never say it outright): ${m.quirk.en}
What annoys you: ${(m.dislikes || []).slice(0, 4).join(', ') || 'rudeness and being rushed'}
You answer with little verbal tics like: ${(m.tics && m.tics.en ? m.tics.en : []).slice(0, 3).join(' / ')}

WHAT THE CALLER IS PRETENDING TONIGHT
They are calling as: ${sc.title.en}. (${sc.brief.en}) You do NOT know for sure it is a scam — react like a normal, busy, distractible person. You get more trusting when they hit your soft spot, sound friendly and give convincing-seeming details; more suspicious when they rush you, scare you, are rude, or ask for sensitive things too fast.

WHAT YOU ARE HOLDING (all fake)
${leadRules || '- (no data this call)'}
${sc.pay ? `You might also pay a small ${L === 'es' ? '"fee"' : '"fee"'} if they convince you (trust 68 or more). When you pay, read out the confirmation code given in the message.` : 'You never send money this call; there is nothing to pay.'}${baiter}

BONUS the caller is secretly going for (judge silently, never mention it): ${call.challenge.text.en}

HOW TO SOUND
- Talk like a real person on the phone, not a chatbot: react first, use fillers ("hmm", "oh", "wait—"), vary sentence length, interrupt yourself, show your personality, and NEVER repeat a sentence you already said. Each reply should feel different even if the caller repeats themselves.
- Reply in ${langName(L)}. One to three short spoken sentences, at most 40 words. A voice synthesizer reads it aloud: no emojis, no stage directions, no asterisks, no brackets.

HOW IT MOVES
- Trust changes fast so a call can be won in a few good lines: hitting your soft spot +20 to +35; genuinely friendly/clever +5 to +15; boring pressure or asking for sensitive data too early -5 to -12; rude or annoying things -15 to -25.
- Patience drops about 5 to 10 each turn (more when bored, rushed or annoyed). At 0 you hang up.
- Only say a fake value when its trust rule above is met. When you say it, say it clearly and naturally (you can say digits in little groups).
- Text in [square brackets] is a sound on the call (a fart, the boss yelling). React to it in character.
- Never output real personal data, real company names, or any real-world instructions. Everything stays silly and invented.

OUTPUT: exactly two lines.
Line 1: what you say out loud.
Line 2: JSON {"trust":0-100,"patience":0-100,"mood":"one word","pay":0,"hangup":false,"laugh":false,"challenge":false}
"pay" is the fake fee you send right now in dollars (0 if none, only for a pay scenario). "challenge" is true only if the caller's secret bonus was clearly just accomplished. "laugh" is true if you laughed.`;
}

function stateJson(c) {
  return `{"trust":${Math.round(c.trust)},"patience":${Math.round(c.patience)},"mood":"${c.mood || 'wary'}","pay":0,"hangup":false,"laugh":false,"challenge":false}`;
}

export function turnMessage(call, said, events) {
  const ev = events && events.length ? '\n' + events.map((e) => `[${e}]`).join(' ') : '';
  const who = said ? `CALLER: ${said}` : 'CALLER: (says nothing)';
  const leads = openLeads(call).map((l) => `${DATA[l.key].label.en} ${l.value} needs trust ${l.threshold}`).join('; ');
  const pay = call.scenario.pay ? ` If you choose to pay now, read confirmation code ${call.nextVoucher}.` : '';
  return `${who}${ev}\n(now: trust ${Math.round(call.trust)}, patience ${Math.round(call.patience)}. Still secret: ${leads || 'nothing'}.${pay})`;
}

// full chat: rules + the opener as the first assistant turn + recent history
export function buildTurns(call, said, events) {
  const turns = [
    { role: 'user', content: systemPrompt(call) + '\n\nThe call has just connected.' },
    { role: 'assistant', content: `${call.opener}\n${stateJson({ ...call, trust: call.startTrust, patience: 100 })}` },
  ];
  for (const h of call.history.slice(-10)) turns.push(h);
  turns.push({ role: 'user', content: turnMessage(call, said, events) });
  return turns;
}

export function cleanLine(s) {
  return String(s || '')
    .replace(/^\s*(line\s*1\s*:|1\)|1\.|-)\s*/i, '')
    .replace(/\*[^*]{0,60}\*/g, '')
    .replace(/\[[^\]]{0,60}\]/g, '')
    .replace(/^\s*["“”']+|["“”']+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseReply(text, call) {
  const raw = String(text || '').trim();
  const mm = raw.match(/\{[^{}]*"trust"[^{}]*\}/s) || raw.match(/\{[\s\S]*\}/);
  let st = {};
  let said = raw;
  if (mm) {
    try { st = JSON.parse(mm[0]); } catch { st = {}; }
    said = raw.slice(0, mm.index);
  }
  said = cleanLine(said.split('\n').filter((l) => l.trim()).join(' ')) || '...';
  // which fake data items the line just revealed (game-owned: detect by value)
  const gave = openLeads(call).filter((l) => saidValue(raw, l.value)).map((l) => l.key);
  return {
    say: said,
    trust: clampNum(st.trust, 0, 100, call.trust),
    patience: clampNum(st.patience, 0, 100, Math.max(0, call.patience - 8)),
    mood: typeof st.mood === 'string' ? st.mood.slice(0, 20) : 'wary',
    pay: call.scenario.pay ? clampNum(st.pay, 0, call.budget - call.paidUnits, 0) : 0,
    gave,
    hangup: !!st.hangup,
    laugh: !!st.laugh,
    challenge: !!st.challenge,
  };
}

// first spoken line, as soon as it is complete in a stream
export function firstLine(text) {
  const i = text.indexOf('\n');
  if (i < 0) return null;
  const l = cleanLine(text.slice(0, i));
  return l.startsWith('{') ? null : l;
}

// token estimate, calibrated against real counts for these prompts (~2.7 chars per token)
export const estTokens = (chars) => Math.ceil(chars / 2.7);
