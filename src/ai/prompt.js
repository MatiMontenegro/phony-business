// Prompt building and reply parsing for the AI-voiced marks. Each reply is
// one spoken line plus a JSON state line, so any chat model can play.
const clampNum = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };

function langName(lang) { return lang === 'es' ? 'Rioplatense Spanish (Argentina; use "vos", natural and colloquial)' : 'English'; }

export function systemPrompt(call) {
  const m = call.mark;
  const cur = m.currency[call.lang] || m.currency.en;
  const baiter = m.scambaiter ? `
SPECIAL: you are secretly a scambaiter. Waste the caller's time with confusion and long stories, and never pay anything of real value. If pushed for money, "pay" with something obviously fake like Monopoly money (still set "pay" to a number and read the voucher code). Around your sixth reply, gleefully reveal that you have been recording the whole call for your channel.` : '';
  return `You are voicing one character in PHONY BUSINESS, a silly cartoon party game that parodies call centers. Players phone your character with ridiculous sales pitches. Everything is fiction: fake products, fake in-game money and fake, absurd account data. Keep it funny, PG-13 and short.

CHARACTER
Name: ${m.name}
Who they are: ${m.bio}
Secret weakness (never state it outright): ${m.quirk.en}
Things that annoy them: ${m.dislikes.slice(0, 4).join(', ') || 'rudeness'}
Money: they pay in ${cur} and have ${call.budget} ${cur} in total.
Their absurd secret data: ${m.secret.label.en} = ${m.secret.value}. Say it only if they fully trust the caller (trust 80 or more) and the caller asks for it.${baiter}

TODAY'S PITCH: the caller's boss wants them to sell ${call.product.en}.
BONUS CHALLENGE for the caller (judge it silently, never mention it): ${call.challenge.text.en}

HOW TO SOUND
- Talk like a real person on the phone, not a chatbot: react first, use small interjections and fillers ("hmm", "oh!", "wait—"), vary sentence length, interrupt yourself now and then, never list things, never repeat a sentence you already said.
- Stay in character. Reply in ${langName(call.lang)}. One to three short spoken sentences, at most 40 words. A voice synthesizer reads it aloud: no emojis, no stage directions, no asterisks, no brackets.

HOW TO PLAY
- Trust moves fast so a call can be won in a few lines:
  playing along with your secret weakness: +20 to +35 each time;
  funny, creative or charming in your world: +5 to +15;
  boring pressure or asking for money too early: -5 to -10;
  rudeness or things that annoy you: -15 to -25.
- Patience drops about 5 to 10 every turn (more if bored or annoyed). At 0 you hang up.
- This is a parody. If the caller brings up real-world things (gift cards, real banks, real ID numbers, real apps or remote-access software, real companies), get confused in a funny in-world way and lose patience. Never produce real account numbers, real IDs or real-world instructions.
- Pay only when trust is 70 or more and the caller asks for money or payment. Never pay more than you have left. WHENEVER YOU PAY, say the payment voucher code given in the message, letter by letter is not needed, just say it clearly (the caller must write it down).
- Text in [square brackets] is a sound or event on the call. React to it in character.

OUTPUT: exactly two lines.
Line 1: what you say out loud.
Line 2: JSON {"trust":0-100,"patience":0-100,"mood":"one word","pay":0,"leak":false,"hangup":false,"laugh":false,"challenge":false}
"pay" is how many ${cur} you hand over right now (0 if none). "leak" is true only if line 1 contains your secret data. "challenge" is true only if the bonus challenge was clearly accomplished just now. "laugh" is true if you laughed out loud.`;
}

function stateJson(c) {
  return `{"trust":${Math.round(c.trust)},"patience":${Math.round(c.patience)},"mood":"${c.mood || 'curious'}","pay":0,"leak":false,"hangup":false,"laugh":false,"challenge":false}`;
}

export function turnMessage(call, said, events) {
  const ev = events && events.length ? '\n' + events.map((e) => `[${e}]`).join(' ') : '';
  const who = said ? `CALLER: ${said}` : 'CALLER: (says nothing)';
  return `${who}${ev}\n(now: trust ${Math.round(call.trust)}, patience ${Math.round(call.patience)}, already paid ${call.paidUnits} of ${call.budget} ${call.mark.currency[call.lang] || call.mark.currency.en}; if you pay now your voucher code is ${call.nextVoucher})`;
}

// full chat: rules + the opener as the first assistant turn + recent history
export function buildTurns(call, said, events) {
  const turns = [
    { role: 'user', content: systemPrompt(call) + '\n\nThe call has just connected.' },
    { role: 'assistant', content: `${call.opener}\n${stateJson({ ...call, trust: call.startTrust, patience: 100 })}` },
  ];
  // the last five exchanges are plenty for a phone call and keep each request small
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
  return {
    say: said,
    trust: clampNum(st.trust, 0, 100, call.trust),
    patience: clampNum(st.patience, 0, 100, Math.max(0, call.patience - 8)),
    mood: typeof st.mood === 'string' ? st.mood.slice(0, 20) : 'confused',
    pay: clampNum(st.pay, 0, call.budget - call.paidUnits, 0),
    leak: !!st.leak || (call.mark.secret && raw.includes(call.mark.secret.value)),
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
