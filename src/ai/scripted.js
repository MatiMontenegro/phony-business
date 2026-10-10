// Offline "backup brain": a free, instant mark that follows the same rules as
// the AI. It reads the caller's tactics, moves trust using how susceptible THIS
// character is to each tactic, builds rapport over the call, and gradually
// leaks its (fake) data once it trusts the caller. Replies never repeat and
// vary even for the same input, so a call feels like a conversation.
import { norm, includesAny, hasWord, quirkHit, tacticsIn, TACTICS, DATA, pick } from './marks.js';

const MONEY = ['pay', 'money', 'cash', 'fee', 'transfer', 'send', 'deposit', 'shipping', 'pagar', 'plata', 'dinero', 'transferi', 'transferir', 'deposit', 'envio', 'abonar', 'pague', 'pago'];
const ASK = ['password', 'pin', 'code', 'number', 'card', 'account', 'ssn', 'social', 'confirm', 'verify', 'read me', 'tell me', 'give me', 'what is your', 'clave', 'contrasena', 'codigo', 'numero', 'tarjeta', 'cuenta', 'confirma', 'confirme', 'verifica', 'decime', 'dame', 'leeme', 'pasame', 'cual es tu'];
const GREET = ['hola', 'buenas', 'buen dia', 'buenas noches', 'buenas tardes', 'hello', 'hi', 'hey', 'good evening', 'good morning'];
const RUDE = ['idiota', 'estupid', 'tarad', 'boludo', 'pelotud', 'callate', 'imbecil', 'stupid', 'idiot', 'shut up', 'dumb', 'moron', 'useless', 'inutil'];
const BYE = ['chau', 'adios', 'nos vemos', 'hasta luego', 'bye', 'goodbye', 'see you', 'corto', 'te dejo'];
const JOKE = ['jaja', 'jeje', 'haha', 'hehe', 'lol', 'chiste', 'joke', 'xd'];

// generic reactions keyed by the dominant tactic, in the mark's register
const REACT = {
  authority: { en: [`And you're calling from where, exactly?`, `From the bank, you said? Hm.`, `Official, official. Everyone's official these days.`], es: [`¿Y me llamás de dónde, exactamente?`, `Del banco, dijiste. Mmm.`, `Oficial, oficial. Todos son oficiales ahora.`] },
  urgency: { en: [`Why the rush?`, `Slow down, I can't keep up.`, `Everything's "right now" with you.`], es: [`¿Por qué tanto apuro?`, `Pará, que no te sigo.`, `Con vos todo es "ya mismo".`] },
  fear: { en: [`Blocked? Suspended? Oh no.`, `You're scaring me a little.`, `Is it really that serious?`], es: [`¿Bloqueada? ¿Suspendida? Ay, no.`, `Me estás asustando un poco.`, `¿Tan grave es?`] },
  reward: { en: [`A prize? For me?`, `Free, you say? Hm, go on.`, `I do like the sound of that.`], es: [`¿Un premio? ¿Para mí?`, `¿Gratis, decís? Mmm, seguí.`, `Me gusta cómo suena eso.`] },
  empathy: { en: [`Well, you seem nice enough.`, `That's kind of you to say.`, `Finally, someone patient.`], es: [`Bueno, parecés buena gente.`, `Qué amable de tu parte.`, `Por fin alguien con paciencia.`] },
  flattery: { en: [`Oh, stop it. Well, don't stop.`, `Flattery, my weakness.`, `You've got a silver tongue.`], es: [`Ay, pará. Bueno, no pares.`, `Los halagos, mi debilidad.`, `Tenés una labia...`] },
  detail: { en: [`A case number, good. Which one again?`, `Mm, that does sound official.`, `At least you have your facts.`], es: [`Un número de caso, bien. ¿Cuál era?`, `Mmm, suena oficial eso.`, `Al menos tenés los datos.`] },
  tech: { en: [`Computers, ugh. Explain it simple.`, `My grandson handles the tech stuff.`, `Remote what? I don't like the sound of that.`], es: [`Computadoras, uf. Explicámelo fácil.`, `De la tecnología se encarga mi nieto.`, `¿Remoto qué? No me gusta eso.`] },
  family: { en: [`Is this about my family?`, `Oh no, is everyone alright?`, `You had me worried for a second.`], es: [`¿Es por mi familia?`, `Ay, no, ¿están todos bien?`, `Me preocupaste por un segundo.`] },
  secrecy: { en: [`Don't tell anyone? Why not?`, `A secret, is it.`, `That's an odd thing to ask.`], es: [`¿Que no le diga a nadie? ¿Por qué?`, `Un secreto, ¿eh?`, `Qué cosa rara de pedir.`] },
  politeness: { en: [`Well, you're polite, I'll give you that.`, `Good manners. Rare these days.`, `Please and thank you, I like that.`], es: [`Bueno, educado sos, te doy eso.`, `Buenos modales. Raro hoy en día.`, `Por favor y gracias, me gusta.`] },
};

const BANK = {
  quirk: { en: [`Oh! Now you're speaking my language.`, `Ha, I like you already.`, `Now THAT I want to hear about.`, `Finally, someone who gets it!`], es: [`¡Uy! Ahora sí hablás mi idioma.`, `Ja, ya me caés bien.`, `Eso sí me interesa.`, `¡Por fin alguien que entiende!`] },
  warmUp: { en: [`Hm. Go on, I'm listening.`, `Alright, alright. And then?`, `I suppose that makes sense.`, `Okay, you have my attention.`], es: [`Mmm. Seguí, te escucho.`, `Bueno, bueno. ¿Y entonces?`, `Supongo que tiene sentido.`, `Dale, tenés mi atención.`] },
  askTooEarly: { en: [`Whoa, that's private. Earn it first.`, `I don't hand that out to just anyone.`, `We barely spoke and you want THAT?`, `Easy now. Convince me.`], es: [`Pará, eso es privado. Ganátelo.`, `Eso no se lo doy a cualquiera.`, `Apenas hablamos y ya querés ESO.`, `Tranqui. Convenceme primero.`] },
  leak: { en: [`Alright, between us: {label} is {value}. Don't lose it.`, `Since you've been so patient: {value}. That's my {label}.`, `Fine, fine. {label}, it's {value}. Happy?`], es: [`Bueno, entre nosotros: {label} es {value}. No lo pierdas.`, `Como fuiste tan paciente: {value}. Es mi {label}.`, `Está bien, está bien. {label}, es {value}. ¿Contento?`] },
  pay: { en: [`Ugh, fine, I'll pay the ${'{n}'}. Confirmation {code}.`, `Alright, sending the fee. Code {code}, write it down.`, `Here, {n} dollars. The code is {code}.`], es: [`Uf, bueno, pago los {n}. Confirmación {code}.`, `Dale, mando la tarifa. Código {code}, anotá.`, `Tomá, {n} dólares. El código es {code}.`] },
  refusePay: { en: [`Pay? Already? I don't think so.`, `I'm not sending money to a voice on the phone.`, `Convince me first, then we'll talk money.`], es: [`¿Pagar? ¿Ya? No creo.`, `No le mando plata a una voz del teléfono.`, `Convenceme primero y después hablamos de plata.`] },
  rude: { en: [`Excuse me?! Watch your tone.`, `Wow. Rude. Very rude.`, `Talk to me like that again and I hang up.`], es: [`¡¿Perdón?! Cuidá ese tono.`, `Guau. Grosero. Muy grosero.`, `Hablame así de nuevo y te corto.`] },
  annoyed: { en: [`Ugh, that's exactly what I hate.`, `Don't do that.`, `You're testing me.`], es: [`Uf, es justo lo que odio.`, `No hagas eso.`, `Me estás colmando.`] },
  joke: { en: [`Ha! Okay, that got me.`, `Hah, you're a funny one.`, `I laughed. Don't tell anyone.`], es: [`¡Ja! Bueno, esa me causó.`, `Jaja, sos gracioso vos.`, `Me reí. No le cuentes a nadie.`] },
  bye: { en: [`Leaving already? Fine.`, `Goodbye then, strange caller.`], es: [`¿Ya te vas? Bueno.`, `Chau entonces, qué raro todo.`] },
  fart: { en: [`What on earth was that noise?`, `Was that... the line? It sounded wet.`, `Bless you? I think?`], es: [`¿Qué fue ese ruido?`, `¿Eso fue... la línea? Sonó húmedo.`, `¿Salud? ¿Creo?`] },
  boss: { en: [`Is someone yelling over there?`, `Your boss sounds lovely. And loud.`], es: [`¿Alguien está gritando ahí?`, `Tu jefe suena encantador. Y fuerte.`] },
  hangup: { en: [`That's enough. Goodbye!`, `I'm hanging up now. Don't call back!`], es: [`Ya basta. ¡Adiós!`, `Te corto. ¡No llames más!`] },
  baiterPay: { en: [`Of course, dearie! It's... oh, 0000 something. The pink Monopoly one. Code {code}.`, `Here's a coupon for one free hug. Code {code}, write it down!`], es: [`¡Claro, querido! Es... ay, 0000 algo. La del Estanciero, la rosa. Código {code}.`, `Te doy un cupón por un abrazo gratis. ¡Código {code}, anotalo!`] },
  baiterReveal: { en: [`Oh dearie, I've recorded this whole call for my channel! Say hi to the subscribers!`], es: [`¡Ay, querido, grabé toda la llamada para mi canal! ¡Saludá a los suscriptores!`] },
};

function fill(s, call, extra = {}) {
  return s
    .replaceAll('{n}', extra.n ?? '')
    .replaceAll('{code}', call.nextVoucher || '')
    .replaceAll('{label}', extra.label || '')
    .replaceAll('{value}', extra.value || '');
}

// a line from a list that has not been used yet this call
function fresh(call, list) {
  call.used ||= new Set();
  const left = list.filter((l) => !call.used.has(l));
  const l = pick(left.length ? left : list);
  call.used.add(l);
  return l;
}

// a dominant tactic to react to (the one this mark cares about most)
function topTactic(mark, tactics) {
  let best = null, bestW = 0;
  for (const k of tactics) {
    const w = Math.abs((mark.sus && mark.sus[k]) || 0) + (REACT[k] ? 0.1 : 0);
    if (w > bestW) { bestW = w; best = k; }
  }
  return best;
}

export class ScriptedBrain {
  constructor() { this.kind = 'backup'; }

  async reply(call, said, events = []) {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 360));
    const L = call.lang;
    const m = call.mark;
    const t = norm(said);
    let trust = call.trust;
    let patience = call.patience - (4 + Math.random() * 4);
    let pay = 0, hangup = false, laugh = false, mood = 'wary';
    const gave = [];
    const out = [];
    const line = (s) => { if (s) out.push(s); };
    const say = (bank, extra) => line(fill(fresh(call, BANK[bank][L]), call, extra));

    // sound events on the line
    if (events.some((e) => /fart/i.test(e))) { say('fart'); patience -= 4; }
    if (events.some((e) => /boss|yell/i.test(e))) say('boss');

    const rude = includesAny(t, RUDE);
    const quirk = quirkHit(m, said);
    const tactics = tacticsIn(said);

    // move trust by how susceptible THIS mark is to each tactic used
    let delta = 0;
    for (const k of tactics) delta += ((m.sus && m.sus[k]) || 0) * (6 + Math.random() * 4);
    if (quirk) delta += 20 + Math.random() * 14;
    if (rude) { delta -= 18 + Math.random() * 8; patience -= 12; }
    // small reward for effort / conversation
    delta += Math.min(6, said.length / 28);
    trust += delta;

    if (m.scambaiter) {
      // she is toying with the caller: trust never really builds, data is fake
      const wantsMoney = hasWord(t, MONEY);
      const wantsData = includesAny(t, ASK);
      if (wantsMoney) { say('baiterPay'); pay = 40 + Math.floor(Math.random() * 60); }
      else if (wantsData && call.leads[0]) { const l = call.leads[0]; line(fill(fresh(call, BANK.leak[L]), call, { label: DATA[l.key].short[L], value: l.value })); gave.push(l.key); }
      if (call.turns >= 4 && !call.revealed) { line(BANK.baiterReveal[L][0]); call.revealed = true; }
      if (!out.length) line(fresh(call, m.tics[L]));
      trust = 34; patience = Math.max(34, patience + 6); mood = 'sweet';
      return { say: out.slice(0, 3).join(' '), trust, patience, mood, pay, gave, hangup: false, laugh: false, challenge: false };
    }

    // reaction body
    if (rude) { say('rude'); mood = 'offended'; }
    else if (quirk) { say('quirk'); mood = 'delighted'; laugh = Math.random() < 0.4; }
    else {
      const dom = topTactic(m, tactics);
      const susV = dom ? (m.sus[dom] || 0) : 0;
      if (dom && REACT[dom]) { line(fresh(call, REACT[dom][L])); mood = susV < 0 ? 'suspicious' : susV > 0.9 ? 'warming' : 'wary'; if (susV < -0.4) { say('annoyed'); } }
      else { say('warmUp'); mood = trust > 55 ? 'warming' : 'wary'; }
      if (includesAny(t, JOKE) || /!{2,}/.test(said)) { if (Math.random() < 0.6) { say('joke'); laugh = true; trust += 5; } }
      if (includesAny(t, GREET) && call.turns <= 1) line(fresh(call, m.tics[L]));
    }
    // a little personality sprinkled in, varied so repeats never feel identical
    if (!quirk && !rude && Math.random() < 0.4) line(fresh(call, m.about[L]));

    trust = Math.max(0, Math.min(100, trust));

    // asking for data
    if (includesAny(t, ASK)) {
      const openLeads = call.leads.filter((l) => !l.known);
      const ready = openLeads.find((l) => trust >= l.threshold);
      if (ready) { line(fill(fresh(call, BANK.leak[L]), call, { label: DATA[ready.key].short[L], value: ready.value })); gave.push(ready.key); mood = 'trusting'; }
      else if (openLeads.length) { say('askTooEarly'); trust = Math.max(0, trust - 4); }
    }
    // asking for money (pay scenarios only)
    if (call.scenario.pay && hasWord(t, MONEY)) {
      if (trust >= 68 && call.paidUnits < call.budget) {
        const leftB = call.budget - call.paidUnits;
        pay = Math.max(1, Math.round(leftB * (0.5 + Math.random() * 0.5)));
        say('pay', { n: pay });
        mood = 'generous';
      } else { say('refusePay'); trust = Math.max(0, trust - 4); }
    }

    if (includesAny(t, BYE)) { say('bye'); hangup = Math.random() < 0.5; }
    if (!out.length) say('warmUp');

    patience = Math.max(0, Math.min(100, patience));
    if (patience <= 0) { hangup = true; say('hangup'); }
    // a challenge word echoed back when they are warm
    const ch = call.challenge;
    if (ch.kind === 'markSays' && trust > 45) {
      const w = ch.words.find((x) => t.includes(norm(x)));
      if (w) line(L === 'es' ? `¿${w}? Ja, ${w}. Qué palabra.` : `${w}? Ha, ${w}. What a word.`);
    }
    return { say: out.slice(0, 3).join(' '), trust, patience, mood, pay, gave, hangup, laugh, challenge: false };
  }
}
