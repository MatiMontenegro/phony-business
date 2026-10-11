// Offline "backup brain": a free, instant mark that holds an actual
// conversation instead of reacting to loose keywords. Per call it remembers
// who the caller said they are, why they are calling and what proof they
// gave; it asks its own questions and notices when they go unanswered; it
// reacts to the scam of the night; and it only hands over its (fake) data
// once trust is high enough. Close to that it hesitates and asks why; far
// from it, it questions the caller and, if they keep pushing, hangs up.
// No line repeats within a call, and sounds on the line (the boss yelling, a
// fart) get one reaction, not one every turn.
import { norm, quirkHit, tacticsIn, wordMatcher, DATA, DATA_KEYS, pick } from './marks.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v) => Math.max(0, Math.min(100, v));

// ---- reading what the caller said ----------------------------------------------------------
// lists are matched on normalized text; words of 4 letters or less must be whole words
const ASK_VERBS = ['confirm', 'verific', 'decime', 'digame', 'diga ', 'dame', 'deme', 'pasame', 'paseme', 'pasarme', 'leeme', 'leame', 'dictame', 'dicteme', 'necesito', 'necesitamos', 'preciso', 'precisamos', 'me podes', 'me puede', 'podria', 'podrias', 'tenes que', 'tiene que', 'cual es', 'me das', 'me da ', 'me dice', 'me decis', 'me lee', 'me lees', 'me pasa', 'me pasas', 'tell me', 'give me', 'read me', 'read it', 'i need', 'we need', 'can you', 'could you', 'what is your', "what's your", 'verify', 'provide', 'share', 'send me'];
const DATA_WORDS = {
  card: ['tarjeta', 'card', 'plastico', 'credito', 'debito', 'credit', 'debit', '16 digitos', 'dieciseis digitos'],
  bank: ['clave', 'contrasena', 'password', 'home banking', 'homebanking', 'pin', 'passcode', 'banking'],
  ssn: ['seguro social', 'social security', 'ssn', 'documento', 'dni', 'cuil', 'cuit'],
  google: ['codigo', 'code', 'sms', 'mensaje de texto', 'verificacion', 'verification', 'cuenta de google', 'google account', '6 digitos', 'seis digitos'],
};
const MONEY = ['pagar', 'pague', 'pagues', 'pago', 'abonar', 'abone', 'plata', 'dinero', 'transferi', 'transferencia', 'deposit', 'tarifa', 'costo', 'cuesta', 'arancel', 'dolares', 'pesos', 'pay', 'payment', 'fee', 'money', 'cash', 'wire', 'dollars', 'cost'];
const REMOTE = ['acceso remoto', 'remote', 'instal', 'descarg', 'download', 'programa', 'link', 'enlace', 'asistencia remota', 'controlar', 'control', 'pantalla', 'screen', 'compartir'];
const GREET = ['hola', 'holis', 'buenas', 'buen dia', 'buenas noches', 'buenas tardes', 'que onda', 'hello', 'hi', 'hey', 'good evening', 'good morning', 'good afternoon'];
const SMALLTALK = ['como esta', 'como estas', 'como anda', 'como andas', 'como le va', 'como te va', 'que tal', 'todo bien', 'como va', 'how are you', 'how you doing', "how's it going", 'how is your', 'how are things', 'que hace', 'que haces', 'que estas haciendo', 'what are you doing', 'how was your'];
const THANKS = ['gracias', 'thank', 'thanks', 'muy amable'];
const RUDE = ['idiota', 'estupid', 'tarad', 'boludo', 'boluda', 'pelotud', 'callate', 'imbecil', 'forro', 'mierda', 'stupid', 'idiot', 'shut up', 'dumb', 'moron', 'useless', 'inutil', 'loser'];
const BYE = ['chau', 'adios', 'nos vemos', 'hasta luego', 'bye', 'goodbye', 'see you', 'te dejo', 'lo dejo', 'la dejo'];
const JOKE = /(ja|je|ji|ha|he){2,}|(lol|xd|chiste|joke)/;
const SCAM = ['estafa', 'estafador', 'scam', 'scammer', 'chamuyo'];
const BLAME = ['conexion', 'linea', 'senal', 'interferencia', 'wifi', 'connection', 'line', 'signal', 'static', 'ruido', 'noise'];
const YES = ['si', 'sii', 'claro', 'exacto', 'obvio', 'correcto', 'dale', 'ok', 'okay', 'okey', 'perfecto', 'yes', 'yeah', 'yep', 'sure', 'right', 'correct', 'exactly', 'absolutely', 'totally'];
const NO = ['no', 'nop', 'nunca', 'nope', 'never', 'nah'];
// "you can't call them / don't hang up": refusing the mark's call-back
const NO_CALLBACK = ['no puede llamar', 'no lo puede llamar', 'no la puede llamar', 'no lo llame', 'no la llame', 'no llames', 'no llame', 'no corte', 'no cortes', 'no hace falta', 'imposible', "can't call", 'cannot call', "don't call", 'do not call', 'no need', "don't hang up", 'do not hang up'];
// "me llamo X" always names someone; "soy X" / "this is X" only when X is capitalized
const INTRO = /(me llamo|mi nombre es|my name is|soy|le habla|te habla|habla|this is|i am|i'm)\s+([\p{L}]+(?:\s+[\p{L}]+){0,2})/iu;
const STRONG_INTRO = /^(me llamo|mi nombre es|my name is)$/i;
// titles skipped before the name; after the others there is no name ("soy del banco")
const TITLES = new Set(['el', 'la', 'the', 'agente', 'agent', 'operador', 'operadora', 'operator', 'representante', 'representative', 'asesor', 'asesora', 'ejecutivo', 'ejecutiva', 'senor', 'senora', 'sr', 'sra', 'mister', 'mr', 'mrs', 'ms', 'licenciado', 'licenciada', 'officer']);
const NO_NAME = new Set(['de', 'del', 'un', 'una', 'su', 'tu', 'yo', 'from', 'a', 'an', 'your', 'calling', 'llamando', 'nuevo', 'nueva', 'quien', 'here', 'aca', 'about', 'sorry', 'just', 'very', 'muy', 'not', 'no', 'con', 'with', 'so', 'tan', 'que', 'it', 'is']);
// where the caller says they are calling from (for "Ah, from the bank?")
const ORGS = [
  ['seguro social', `del Seguro Social`, `Social Security`], ['social security', `del Seguro Social`, `Social Security`],
  ['banco', `del banco`, `the bank`], ['bank', `del banco`, `the bank`], ['google', `de Google`, `Google`],
  ['soporte', `de soporte técnico`, `tech support`], ['support', `de soporte técnico`, `tech support`],
  ['aduana', `de la aduana`, `customs`], ['customs', `de la aduana`, `customs`], ['correo', `del correo`, `the courier`], ['courier', `del correo`, `the courier`],
  ['empresa', `de la empresa`, `the company`], ['company', `de la empresa`, `the company`], ['gobierno', `del gobierno`, `the government`], ['government', `del gobierno`, `the government`],
];
// what each scam of the night sounds like when the caller explains it
const PRETEXT = {
  bankfraud: ['compra', 'consumo', 'cargo', 'movimiento', 'fraude', 'sospechos', 'purchase', 'charge', 'transaction', 'fraud', 'suspicious'],
  google: ['intento', 'intentaron', 'ingres', 'inicio de sesion', 'sesion', 'entrar a su cuenta', 'entrar a tu cuenta', 'hacke', 'login', 'log in', 'sign in', 'signed in', 'tried to'],
  ssa: ['suspend', 'irregular', 'actividad', 'seguro social', 'social security', 'bloquead'],
  techsupport: ['virus', 'infect', 'malware', 'hacker', 'computadora', 'compu', 'lenta', 'computer', 'slow'],
  prize: ['premio', 'gano', 'ganaste', 'ganador', 'sorteo', 'prize', 'won', 'winner', 'raffle', 'giveaway'],
  package: ['paquete', 'envio', 'encomienda', 'aduana', 'retenido', 'package', 'parcel', 'delivery', 'customs', 'held'],
  relative: ['nieto', 'nieta', 'hijo', 'hija', 'sobrin', 'familiar', 'accidente', 'detenid', 'hospital', 'grandson', 'granddaughter', 'your son', 'daughter', 'nephew', 'niece', 'relative', 'accident', 'trouble', 'jail'],
  refund: ['cobr', 'de mas', 'reintegro', 'devolucion', 'reembolso', 'devolver', 'overcharged', 'refund', 'charged', 'money back'],
};

function nameTokens(m) {
  return norm(m.name).replace(/["']/g, ' ').split(/[^a-z]+/).filter((w) => w.length >= 3 && !['dona', 'don', 'abuela', 'tio'].includes(w));
}

function readTurn(call, said) {
  const m = call.mark;
  const t = norm(said);
  const has = wordMatcher(said);
  const toks = t.split(/[^a-z0-9']+/).filter(Boolean);
  const words = toks.length;
  const question = /\?/.test(said) || /^(que|como|donde|cuando|quien|por que|cual|what|how|where|when|who|why|which|do|does|are|is|can|could|tiene|tenes|usted es|sos)\b/.test(t);
  const tactics = tacticsIn(said);
  const keys = DATA_KEYS.filter((k) => has(DATA_WORDS[k]));
  const askVerb = has(ASK_VERBS);
  // a name after "my name is / I am" (not "I am from the bank")
  let name = '';
  const im = said.match(INTRO);
  if (im) {
    const ws = im[2].split(/\s+/);
    let i = 0;
    while (i < ws.length - 1 && TITLES.has(norm(ws[i]))) i++;
    const w = ws[i] || '', n = norm(w);
    const capital = w.charAt(0) !== w.charAt(0).toLowerCase();
    if (n.length >= 2 && !NO_NAME.has(n) && !TITLES.has(n) && !tacticsIn(w).includes('authority') && (STRONG_INTRO.test(im[1]) || capital)) {
      name = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }
  }
  const org = ORGS.find(([w]) => t.includes(w));
  const first = toks[0] || '';
  return {
    t, words, question, tactics, keys,
    // "card number now" is a request too; "there is a charge on your card" is not
    askData: keys.length > 0 && (askVerb || question || tactics.includes('urgency') || (words <= 6 && !has(PRETEXT[call.scenario.id] || []))),
    askMoney: !!call.scenario.pay && has(MONEY),
    remote: has(REMOTE) && (askVerb || question || /instal|descarg|download|entr|acces/.test(t)),
    greet: has(GREET),
    smalltalk: has(SMALLTALK),
    thanks: has(THANKS),
    rude: has(RUDE),
    bye: has(BYE),
    joke: JOKE.test(t) || /!{2,}/.test(said),
    scam: has(SCAM),
    blame: has(BLAME),
    yes: words <= 5 && (YES.includes(first) || t.startsWith('of course') || t.startsWith('por supuesto')),
    noCallback: first === 'no' || has(NO_CALLBACK),
    no: words <= 5 && NO.includes(first),
    name,
    org: org ? { es: org[1], en: org[2] } : null,
    pretext: has(PRETEXT[call.scenario.id] || []),
    proof: tactics.includes('detail') || /\d{3,}/.test(said.replace(/\s/g, '')),
    quirk: quirkHit(m, said),
    dislike: has(m.dislikes || []),
    mentionsMe: nameTokens(m).some((w) => toks.includes(w)),
  };
}

// ---- what the mark can say -----------------------------------------------------------------
// Spanish lines use [vos|usted] for how the mark addresses the caller (mark.formal).
// A bank's `q` is the question the mark is now waiting to have answered.
const B = {
  // its own questions, to keep the call going somewhere
  askWho: { q: 'who', en: [`And who is this?`, `Sorry, who am I talking to?`, `Where are you calling from?`, `What did you say your name was?`, `And you are...?`], es: [`¿Y [vos quién sos|usted quién es]?`, `Perdón, ¿con quién hablo?`, `¿De dónde me [llamás|llama]?`, `¿Cómo [dijiste que te llamabas|dijo que se llamaba]?`, `¿Y [vos sos|usted es]...?`] },
  askWhy: { q: 'why', en: [`And what are you calling about?`, `What do you need?`, `So what happened?`, `Okay, how can I help you?`, `What is this about?`], es: [`¿Y para qué me [llamás|llama]?`, `¿Qué [necesitás|necesita]?`, `¿Y qué pasó?`, `Bueno, ¿en qué [te|le] puedo ayudar?`, `¿Y de qué se trata?`] },
  askProof: { q: 'proof', en: [`Do you have a case number or something?`, `And how do I know that's true?`, `Can you give me anything that proves it?`, `Do you have an employee ID I can write down?`], es: [`¿[Tenés|Tiene] algún número de caso o de legajo?`, `¿Y cómo sé que es verdad lo que me [decís|dice]?`, `¿Me [das|da] algún dato que lo compruebe?`, `¿[Tenés|Tiene] un número de empleado que pueda anotar?`] },
  askHow: { q: 'how', en: [`So what do I have to do?`, `Okay, and now what?`, `How do we fix it?`, `Tell me what to do.`], es: [`¿Y qué tengo que hacer?`, `Bueno, ¿y ahora qué hacemos?`, `¿Cómo lo solucionamos?`, `[Decime|Dígame] qué hago.`] },
  askCallback: { q: 'callback', en: [`Give me a number and I'll call you back.`, `I'd rather hang up and call the official number myself. Is that okay?`], es: [`¿Me [pasás un número y te|pasa un número y lo] llamo yo?`, `Prefiero cortar y llamar yo al número oficial. ¿[Te|Le] parece?`] },
  offer: { q: 'offer', en: [`Do you want me to confirm my {label}?`, `If you need my {label}, I have it right here.`, `Should I read you my {label}?`], es: [`¿[Querés que te|Quiere que le] confirme mi {label}?`, `Si [necesitás|necesita] mi {label}, acá tengo todo.`, `¿[Te|Le] leo mi {label}?`] },
  askDone: { q: 'done', en: [`Is that it? Is it fixed now?`, `Done? Is everything okay now?`], es: [`¿Ya está? ¿Con eso se soluciona?`, `¿Listo? ¿Quedó todo bien?`] },
  // the caller ignored the question
  againWho: { ordered: true, q: 'who', en: [`You didn't answer me: who are you?`, `I still don't know who I'm talking to.`, `Look, if you don't tell me who you are, I'm hanging up.`], es: [`No me [contestaste|contestó]: ¿quién [sos|es]?`, `Sigo sin saber con quién hablo.`, `[Mirá, si no me decís quién sos|Mire, si no me dice quién es], corto.`] },
  againWhy: { ordered: true, q: 'why', en: [`You still haven't told me why you're calling.`, `But what do you want, in the end?`, `I'm losing my patience. What is this about?`], es: [`Todavía no me [dijiste|dijo] para qué me [llamás|llama].`, `¿Pero qué [querés|quiere], al final?`, `Me estoy quedando sin paciencia. ¿De qué se trata?`] },
  againProof: { ordered: true, q: 'proof', en: [`And the case number? You never gave it to me.`, `Without something that proves it, I don't know.`, `You keep dodging. Give me something I can check.`], es: [`¿Y el número de caso? No me lo [diste|dio].`, `Sin algún dato que lo pruebe, no sé, eh.`, `[Me esquivás|Me esquiva] todo el tiempo. [Dame|Deme] algo que pueda chequear.`] },
  // the caller answered
  ackName: { en: [`Ah, {name}. Okay, {name}.`, `Nice to meet you, {name}.`, `{name}, got it.`, `{name}. Writing it down.`], es: [`Ah, {name}. Bueno, {name}.`, `Mucho gusto, {name}.`, `{name}, anotado.`, `{name}. Lo anoto.`] },
  ackOrg: { en: [`Ah, from {org}?`, `{org}, you say. Hm.`, `Oh, {org}. Okay.`], es: [`Ah, ¿[me llamás|me llama] {org}?`, `¿{org}, [decís|dice]? Mmm.`, `Ah, {org}. Bueno.`] },
  ackWhy: { en: [`Ah, now I get it.`, `Well, that explains it.`, `Okay, that makes sense.`], es: [`Ah, ahora entiendo.`, `Bueno, eso explica todo.`, `Ah, bueno, tiene sentido.`] },
  ackProof: { en: [`Okay, I'm writing that down.`, `A case number. Good, that calms me down a bit.`, `Alright, that sounds official.`], es: [`Bueno, lo anoto.`, `Un número de caso. Bien, eso me tranquiliza un poco.`, `Bueno, eso suena oficial.`] },
  ackDone: { en: [`Oh, what a relief.`, `Well, thank goodness.`], es: [`Ay, qué alivio.`, `Bueno, menos mal.`] },
  callbackOk: { en: [`Okay, I'll write it down. Go on.`, `Fine, I'll call later to double-check.`], es: [`Bueno, lo anoto. Sigamos.`, `Dale, después llamo para confirmar.`] },
  callbackNo: { en: [`Odd that you won't let me call you back.`, `If this were real, you'd let me call. Hm.`], es: [`Qué raro que no me [dejes|deje] llamar.`, `Si fuera de verdad, me [dejarías|dejaría] llamar. Mmm.`] },
  offerNo: { en: [`Okay, as you like.`, `Fine, then.`], es: [`Bueno, como [quieras|quiera].`, `Bueno, está bien.`] },
  heardThat: { q: 'how', en: [`Yes, you told me that already. And then?`, `Right, I got that part. So?`], es: [`Sí, eso ya me lo [dijiste|dijo]. ¿Y entonces?`, `Sí, esa parte la entendí. ¿Y?`] },
  // handing over data (the line must contain the value)
  leak: {
    card: { en: [`Let me find the card... Here it is: {value}.`, `Okay, I have it in my hand: {value}.`, `Fine. The number is {value}. Does that fix it?`, `I'll read it: {value}. Got it?`], es: [`A ver, que busco la tarjeta... Acá está: {value}.`, `Bueno, la tengo en la mano: {value}.`, `Está bien. El número es {value}. ¿Con eso se soluciona?`, `[Te|Le] leo: {value}. ¿Lo [anotaste|anotó]?`] },
    bank: { en: [`Okay... the password is {value}. Don't tell anyone, huh.`, `Fine: {value}. All together like that.`, `It's {value}. I always use the same one, I know.`], es: [`Bueno... la clave es {value}. No se la [digas|diga] a nadie, eh.`, `Está bien: {value}. Así, todo junto.`, `Es {value}. Siempre uso la misma, ya sé.`] },
    ssn: { en: [`My number is {value}. I know it by heart.`, `Let me see, I have it written down... {value}.`, `It's {value}. Is that right?`], es: [`Mi número es {value}. Me lo sé de memoria.`, `A ver, lo tengo anotado... {value}.`, `Es {value}. ¿Así está bien?`] },
    google: { en: [`Yes, it just came in. It says {value}.`, `The code is {value}. Is that okay?`, `Hold on, I'm looking at my phone... {value}.`], es: [`Sí, me llegó recién. Dice {value}.`, `El código es {value}. ¿Así está bien?`, `[Esperá|Espere] que lo busco en el celular... {value}.`] },
  },
  // close to trusting: hesitates and asks
  hesitate: { q: 'why', en: [`Hmm, and why do you need my {label}?`, `My {label}? What for?`, `I don't know... can you explain what it's for?`, `I almost believe you. Why do you need it right now?`], es: [`Mmm, ¿y para qué [necesitás|necesita] mi {label}?`, `¿Mi {label}? ¿Y eso por qué?`, `No sé... ¿me [explicás|explica] bien para qué es?`, `Casi [te|le] creo. ¿Por qué lo necesitan justo ahora?`] },
  hesitateWho: { q: 'who', en: [`Before I give you that, what's your name?`, `First tell me who you are, then we'll see.`], es: [`Antes de [darte|darle] nada, ¿me [decís tu|dice su] nombre?`, `Primero [decime|dígame] quién [sos|es], y después vemos.`] },
  hesitateProof: { q: 'proof', en: [`I feel weird giving that over the phone. Do you have a case number or something?`, `Give me some proof first and I'll think about it.`], es: [`Me da cosa darlo por teléfono. ¿[Tenés|Tiene] algún número de caso o algo?`, `[Dame|Deme] alguna prueba primero y lo pienso.`] },
  // far from trusting: refuses and questions the caller
  refuse: { q: 'who', en: [`My {label}? I don't give that to just anyone.`, `We barely talked and you're asking for that? Very odd.`, `Not a chance. First tell me who you are and where you're calling from.`, `That's private. Convince me first.`], es: [`¿Mi {label}? Eso no se lo doy a cualquiera.`, `Apenas hablamos y ya me [pedís|pide] eso. Muy raro.`, `Ni en sueños. Primero [decime|dígame] quién [sos|es] y de dónde [llamás|llama].`, `Eso es privado. [Convenceme|Convénzame] primero.`] },
  refuseProof: { q: 'proof', en: [`No, no, no. How do I know you are who you say you are?`, `And what proves you're not a scammer?`], es: [`No, no, no. ¿Cómo sé que [sos|usted es] quien [decís|dice] ser?`, `¿Y qué me prueba que no [sos|es] un estafador?`] },
  refuseKey: {
    card: { en: [`I don't give my card number to anyone over the phone.`], es: [`El número de la tarjeta no se lo doy a nadie por teléfono.`] },
    cardBank: { en: [`If you're from the bank, you already have my card. Why are you asking for it?`], es: [`Si [sos|es] del banco, ya [tenés|tiene] mi tarjeta. ¿Para qué me la [pedís|pide]?`] },
    bank: { en: [`I don't give my password even to my family.`], es: [`La clave no se la paso ni a mi familia.`] },
    ssn: { en: [`What do you want my Social Security number for?`], es: [`¿Para qué [querés|quiere] mi número de Seguro Social?`] },
    google: { en: [`The message clearly says not to share the code with anyone.`], es: [`El mensaje dice clarito que no comparta el código con nadie.`] },
  },
  insist: { en: [`I already said no. Stop insisting.`, `You're pushing way too hard for that.`, `No means no. Ask me again and I hang up.`], es: [`Ya [te|le] dije que no. [Dejá|Deje] de insistir.`, `Estás insistiendo demasiado con eso.`, `No es no. [Pedímelo|Pídamelo] otra vez y [te|le] corto.`] },
  alreadyGave: { en: [`I already told you: {value}.`, `I gave you that a minute ago: {value}.`], es: [`Ya [te|se] lo dije: {value}.`, `Eso ya [te|se] lo pasé hace un rato: {value}.`] },
  dontHave: { en: [`My {label}? I don't have that at hand.`, `No, I don't have that. What are you talking about?`], es: [`¿Mi {label}? Eso no lo tengo a mano.`, `No, eso no lo tengo. ¿De qué me [hablás|habla]?`] },
  nothingLeft: { en: [`I already gave you everything I had. What else do you want?`, `I have nothing more to give you.`], es: [`Ya [te|le] di todo lo que tenía. ¿Qué más [querés|quiere]?`, `No tengo nada más para [darte|darle].`] },
  // money (pay scenarios)
  pay: { en: [`Fine, I'll send the {n}. The receipt says {code}.`, `Ugh, okay. Done, {n} dollars. Code {code}, write it down.`, `There, I transferred {n}. The confirmation is {code}.`], es: [`Bueno, está bien, [te|le] mando los {n}. El comprobante dice {code}.`, `Uf, dale. Listo, {n} dólares. Código {code}, [anotalo|anótelo].`, `Ya está, transferí {n}. La confirmación es {code}.`] },
  payAgain: { en: [`More money? Fine, but this is the last: {n}. Code {code}.`], es: [`¿Más plata? Bueno, pero es lo último: {n}. Código {code}.`] },
  broke: { en: [`I already sent you everything I had. There's nothing left.`], es: [`Ya [te|le] mandé todo lo que tenía. No me queda nada.`] },
  hesitatePay: { q: 'why', en: [`Pay? How much, and why?`, `Hmm, and why do I have to pay?`, `Money? Explain exactly what it's for.`], es: [`¿Pagar? ¿Cuánto sería y por qué?`, `Mmm, ¿y por qué tengo que pagar yo?`, `¿Plata? [Explicame|Explíqueme] bien para qué es.`] },
  refusePay: { en: [`I'm not sending money to someone I don't know.`, `Pay? Already? I don't think so.`, `Convince me first, then we talk money.`], es: [`No le voy a mandar plata a alguien que no conozco.`, `¿Pagar? ¿Ya? No creo.`, `Primero [convenceme|convénzame], después hablamos de plata.`] },
  refusePayKey: {
    prize: { en: [`If it's a prize, why do I have to pay?`], es: [`Si es un premio, ¿por qué tengo que pagar?`] },
    package: { en: [`Pay to receive a package I didn't order?`], es: [`¿Pagar para recibir un paquete que no pedí?`] },
    relative: { q: 'callback', en: [`Before I send money, I want to talk to them myself.`], es: [`Antes de mandar plata quiero hablar con él.`] },
    techsupport: { en: [`You charge to fix a virus I never reported?`], es: [`¿Cobran por arreglar un virus que yo nunca reporté?`] },
  },
  // remote access (tech support)
  remoteYes: { q: 'how', en: [`Okay, what do I have to click? I'm hopeless with this.`, `And you fix it from over there? Alright.`], es: [`Bueno, ¿qué tengo que tocar? Soy medio negado con esto.`, `¿Y lo [arreglás|arregla] desde ahí? Bueno, dale.`] },
  remoteNo: { en: [`You want to control my computer? Hmm, I don't know.`, `I was told never to let anyone into my computer.`], es: [`¿Que [manejes|maneje] mi computadora? Mmm, no sé.`, `Me dijeron que nunca deje que nadie maneje mi compu.`] },
  // small talk, greetings, plain questions
  smalltalk: { en: [`Fine, fine, getting by.`, `Oh, you know, hanging in there.`, `Good, thanks for asking.`], es: [`Bien, bien, acá ando.`, `Y, tirando.`, `Bien, gracias por preguntar.`] },
  greet: { en: [`Hello, yes.`, `Yes, hi.`, `Hello, hello.`], es: [`Hola, sí.`, `Sí, hola.`, `Hola, hola.`] },
  thanks: { en: [`You're welcome.`, `No, please.`], es: [`De nada.`, `No, por favor.`] },
  yesQ: { en: [`Yes, why?`, `Yes, of course.`, `Uh... yes, I think so.`], es: [`Sí, ¿por?`, `Sí, claro.`, `Eh... sí, creo.`] },
  whyQ: { q: 'why', en: [`And why do you want to know?`, `Why are you asking me that?`], es: [`¿Y para qué [querés|quiere] saber?`, `¿Por qué me [preguntás|pregunta] eso?`] },
  huh: { en: [`Sorry?`, `I didn't catch that.`, `What?`, `Come again?`], es: [`¿Cómo?`, `No [te|le] entendí.`, `¿Perdón?`, `¿Qué [dijiste|dijo]?`] },
  ack: { en: [`Uh-huh.`, `Hmm.`, `I see.`, `Okay...`], es: [`Ajá.`, `Mmm.`, `Ya veo.`, `Bueno...`] },
  // moods
  quirk: { en: [`Oh! Now you're speaking my language.`, `Ha, I like you already.`, `Now THAT I want to hear about.`, `Finally, someone who gets it!`], es: [`¡Uy! Ahora sí [hablás|habla] mi idioma.`, `Ja, ya me [caés|cae] bien.`, `Eso sí me interesa.`, `¡Por fin alguien que entiende!`] },
  quirkAgain: { en: [`Ha, yes, you get me.`, `Exactly, exactly.`], es: [`Ja, sí, [me entendés|me entiende].`, `Eso, eso.`] },
  annoyed: { en: [`Ugh, that's exactly what I can't stand.`, `No, no, not like that.`, `You're testing my patience.`, `I don't like that one bit.`], es: [`Uf, eso es justo lo que me molesta.`, `No, no, así no.`, `[Me estás|Me está] colmando la paciencia.`, `Eso no me gusta nada.`] },
  rude: { en: [`Excuse me?! Watch your tone.`, `Wow. Rude. Very rude.`, `Talk to me like that again and I hang up.`], es: [`¡¿Perdón?! [Cuidá|Cuide] ese tono.`, `Guau. Qué grosería.`, `[Hablame|Hábleme] así de nuevo y [te|le] corto.`] },
  joke: { en: [`Ha! Okay, that one got me. Hahaha!`, `Hahaha, you're a funny one.`, `Hahaha! I laughed. Don't tell anyone.`], es: [`¡Jajaja! Bueno, esa me causó.`, `Jajaja, qué [gracioso sos|gracioso es].`, `¡Jajaja! Me reí. No le cuentes a nadie.`] },
  smile: { en: [`Heh.`, `Very funny.`], es: [`Je.`, `Muy gracioso.`] },
  scamWord: { en: [`What do you mean, scam? Is this a joke?`, `A scam? You're scaring me.`], es: [`¿Cómo que estafa? ¿Es una broma?`, `¿Estafa? Me [estás|está] asustando.`] },
  bye: { en: [`Leaving already? Okay, bye.`, `Alright, goodbye then.`, `Bye, bye.`], es: [`¿Ya [te vas|se va]? Bueno, chau.`, `Bueno, hasta luego entonces.`, `Chau, chau.`] },
  hangup: { en: [`Okay, I've had enough. Bye.`, `Look, I don't have time for this. Goodbye.`, `That's it, I'm hanging up.`], es: [`Bueno, me cansé. Chau.`, `Mire, no tengo tiempo para esto. Adiós.`, `Ya fue. [Te|Le] corto.`] },
  hangupScam: { en: [`This is a scam, isn't it? I'm hanging up.`, `I know what you're after now. Goodbye.`, `I'm calling the official number myself. Bye.`], es: [`Esto es una estafa, ¿no? [Te|Le] corto.`, `Ya me di cuenta de lo que [querés|quiere]. Adiós.`, `Voy a llamar yo al número oficial. Chau.`] },
  hangupRude: { en: [`I don't talk to people with that mouth. Goodbye.`], es: [`Con esa boca no hablo. Adiós.`] },
  // sounds on the line, once each
  boss: { en: [`Is someone yelling back there?`, `What's all that shouting? Is everything okay?`, `Whoa, is that your boss? What a temper.`], es: [`¿Alguien está gritando ahí atrás?`, `¿Qué son esos gritos? ¿Está todo bien?`, `Uy, ¿ese es [tu|su] jefe? Qué carácter.`] },
  bossAgain: { en: [`More yelling... where are you calling from, a call center?`, `With all that shouting it doesn't sound like a serious office.`], es: [`Otra vez los gritos... ¿desde dónde me [llamás|llama], un call center?`, `Con tanto grito, no parece una oficina muy seria.`] },
  fart: { en: [`What on earth was that noise?`, `Was that... the line? It sounded wet.`, `Bless you? I think?`], es: [`¿Qué fue ese ruido?`, `¿Eso fue... la línea? Sonó húmedo.`, `¿Salud? Creo.`] },
  fartAgain: { en: [`That noise again? What's wrong with your line?`, `There it is again... weird, weird.`], es: [`¿Otra vez ese ruido? ¿Qué le pasa a esa línea?`, `Ese ruido de nuevo... raro, raro.`] },
  fartBlamed: { en: [`Ah, the line, that explains it. It sounds awful.`, `Yes, the connection is terrible tonight.`, `Oh, it was the signal. Phew, I thought it was something else.`], es: [`Ah, la línea, con razón. Se escucha horrible.`, `Sí, la conexión anda pésimo hoy.`, `Ah, era la señal. Menos mal, pensé otra cosa.`] },
  bonk: { en: [`What was that bang? Are you okay?`, `Whoa! Did something fall?`], es: [`¿Qué fue ese golpe? ¿Está todo bien?`, `¡Uy! ¿Se cayó algo?`] },
  cursor: { en: [`Hey! My mouse is moving by itself! Is that you?`, `Why is the little arrow moving on its own?`], es: [`¡Epa! ¡El mouse se me mueve solo! ¿[Sos vos|Es usted]?`, `¿Por qué se me mueve la flechita sola?`] },
  cursorAgain: { en: [`The mouse again! I don't like this at all.`, `Stop moving my computer!`], es: [`¡Otra vez el mouse! Esto no me gusta nada.`, `¡[Dejá|Deje] de mover mi computadora!`] },
  keys: { en: [`Are you typing something? I can hear keys.`], es: [`¿Estás escribiendo algo? Escucho teclas.`] },
};

// a tactic this mark really falls for, or that backfires on them
const TACTIC_HIT = {
  authority: { en: [`Oh, official. Okay, okay.`, `Well, if it's from there...`], es: [`Ah, oficial. Bueno, bueno.`, `Bueno, si es de ahí...`] },
  urgency: { en: [`Right now? Okay, okay, let's hurry.`], es: [`¿Ya mismo? Bueno, bueno, apurémonos.`] },
  fear: { en: [`Oh no, you're scaring me.`, `Is it really that serious?`], es: [`Ay, no, me [estás|está] asustando.`, `¿Tan grave es?`] },
  reward: { en: [`Free, you say? Go on.`, `Ooh, I like the sound of that.`], es: [`¿Gratis, [decís|dice]? Seguí.`, `Uh, me gusta cómo suena eso.`] },
  empathy: { en: [`Well, you seem nice.`, `Finally, someone patient.`], es: [`Bueno, [parecés|parece] buena gente.`, `Por fin alguien con paciencia.`] },
  flattery: { en: [`Oh, stop it. Well, don't stop.`, `You've got a silver tongue.`], es: [`Ay, pará. Bueno, no pares.`, `Qué labia [tenés|tiene].`] },
  detail: { en: [`A case number, good. That sounds serious.`], es: [`Un número de caso, bien. Eso suena serio.`] },
  tech: { en: [`Computers, ugh. Explain it simply.`], es: [`Computadoras, uf. [Explicámelo|Explíquemelo] fácil.`] },
  family: { en: [`Is this about my family? Is everyone okay?`], es: [`¿Es por mi familia? ¿Están todos bien?`] },
  politeness: { en: [`Good manners. Rare these days.`], es: [`Buenos modales. Raro hoy en día.`] },
  secrecy: { en: [`A secret, huh. Okay.`], es: [`Un secreto, ¿eh? Bueno.`] },
};
const TACTIC_BACKFIRE = {
  authority: { en: [`An institution? Even worse. I trust them less than you.`], es: [`¿Una institución? Peor todavía. Les creo menos que a [vos|usted].`] },
  urgency: { en: [`Don't rush me.`, `Why the hurry? Real offices give you time.`], es: [`No me [apures|apure].`, `¿Por qué tanto apuro? Las oficinas de verdad te dan tiempo.`] },
  fear: { en: [`Don't try to scare me.`, `Threats? That's a classic.`], es: [`No me [quieras|quiera] asustar.`, `¿Amenazas? Eso es un clásico.`] },
  reward: { en: [`Nobody gives anything away for free.`], es: [`Nadie regala nada.`] },
  tech: { en: [`I don't understand a thing about that and I don't like it.`], es: [`De eso no entiendo nada y no me gusta.`] },
  secrecy: { en: [`Don't tell anyone? That's the most suspicious thing you've said.`], es: [`¿Que no le cuente a nadie? Eso es lo más sospechoso que [dijiste|dijo].`] },
  politeness: { en: [`Skip the "sir", just get to it.`], es: [`[Dejate|Déjese] de formalidades y [andá|vaya] al grano.`] },
  flattery: { en: [`Flattery doesn't work on me.`], es: [`Los halagos conmigo no van.`] },
};

// the mark's first reaction to the scam of the night: `buy` (worried, plays along) or `doubt`
const SCENE = {
  bankfraud: {
    buy: { q: 'how', en: [`A purchase? How much? I didn't buy anything.`, `On my card? Oh no. What do I do now?`, `A strange charge? No wonder I got a weird email. Can you stop it?`, `Someone's using my card?! What do I have to do?`], es: [`¿Una compra? ¿De cuánto? Yo no compré nada.`, `¿En mi tarjeta? Ay, no. ¿Y ahora qué hago?`, `¿Un consumo raro? Con razón me llegó un mail extraño. ¿Se puede frenar?`, `¡¿Me están usando la tarjeta?! ¿Qué tengo que hacer?`] },
    doubt: { q: 'proof', en: [`Strange, my banking app didn't warn me about anything.`, `My bank told me they'd never call me about this.`, `And how do I know you're really from the bank?`], es: [`Qué raro, la app del banco no me avisó nada.`, `Mi banco me dijo que nunca me iban a llamar por esto.`, `¿Y cómo sé que [sos|es] del banco de verdad?`] },
  },
  google: {
    buy: { q: 'how', en: [`Yes, I just got a message with a code. Is that it?`, `Someone tried to get into my account? From where?`, `No wonder I keep getting odd codes on my phone. What do I do?`], es: [`Sí, recién me llegó un mensaje con un código. ¿Es por eso?`, `¿Alguien quiso entrar a mi cuenta? ¿Desde dónde?`, `Con razón me llegan códigos raros al celular. ¿Qué hago?`] },
    doubt: { q: 'proof', en: [`The message says not to give the code to anyone, you know.`, `They call you on the phone for that? Never happened to me.`, `I didn't get any alert about anything.`], es: [`El mensaje dice que no le pase el código a nadie, eh.`, `¿Y llaman por teléfono para eso? Nunca me pasó.`, `Yo no recibí ningún aviso de nada.`] },
  },
  ssa: {
    buy: { q: 'how', en: [`Suspended? What do you mean? I didn't do anything.`, `My number? What irregularity? You scared me.`, `And how do I fix that? I don't want trouble.`], es: [`¿Suspendido? ¿Cómo que suspendido? Si yo no hice nada.`, `¿Mi número? ¿Qué irregularidad? Me asusté.`, `¿Y eso cómo se arregla? No quiero problemas.`] },
    doubt: { q: 'who', en: [`As far as I know, nobody suspends a number over the phone.`, `Then why didn't they send me a letter?`, `That sounds like a tall tale. Which office did you say?`], es: [`Que yo sepa, nadie suspende un número por teléfono.`, `¿Y por qué no me mandaron una carta?`, `Eso suena a cuento. ¿De qué oficina [dijiste|dijo]?`] },
  },
  techsupport: {
    buy: { q: 'how', en: [`A virus? No wonder it's so slow.`, `Oh, really? Will I lose everything?`, `I knew something was wrong. What do I do?`], es: [`¿Un virus? Con razón anda tan lenta.`, `Ay, ¿en serio? ¿Y se me borra todo?`, `Ya me parecía que algo andaba mal. ¿Qué hago?`] },
    doubt: { q: 'proof', en: [`I never called any support. How do you know I have a virus?`, `You call out of nowhere to tell me that? Odd.`, `My computer works just fine, thank you.`], es: [`Yo no llamé a ningún soporte. ¿Cómo [sabés|sabe] que tengo un virus?`, `¿Me [llamás|llama] de la nada para decirme eso? Raro.`, `Mi compu anda lo más bien, eh.`] },
  },
  prize: {
    buy: { q: 'how', en: [`A prize? I never win anything! What did I win?`, `Really? And how do I claim it?`, `I can't believe it! What is it, what is it?`], es: [`¿Un premio? ¡Yo nunca gano nada! ¿Qué gané?`, `¿En serio? ¿Y cómo lo retiro?`, `¡No [te|le] puedo creer! ¿Qué es, qué es?`] },
    doubt: { q: 'proof', en: [`A raffle? I never entered one.`, `Hmm, when it's too good, I get suspicious.`, `And how did you get my number?`], es: [`¿Un sorteo? Si no me anoté en ninguno.`, `Mmm, cuando es demasiado bueno, desconfío.`, `¿Y cómo consiguieron mi número?`] },
  },
  package: {
    buy: { q: 'how', en: [`A package? From who? Maybe it's what I ordered last month.`, `Held? And what do I have to do to get it?`, `Oh, I'm actually waiting for something! What happened?`], es: [`¿Un paquete? ¿De quién? Capaz es lo que pedí el mes pasado.`, `¿Retenido? ¿Y qué tengo que hacer para que me llegue?`, `Ah, ¡justo estoy esperando algo! ¿Qué pasó?`] },
    doubt: { q: 'proof', en: [`I'm not waiting for any package.`, `I track my deliveries in the app, why are you calling me?`, `And what's the tracking number?`], es: [`Yo no estoy esperando ningún paquete.`, `Mis envíos los veo en la app, ¿por qué me [llamás|llama]?`, `¿Y cuál es el número de seguimiento?`] },
  },
  relative: {
    buy: { q: 'how', en: [`What happened? Are they okay?`, `Oh no! Where are they? What do they need?`, `You scared me. Tell me what happened.`], es: [`¿Qué le pasó? ¿Está bien?`, `¡Ay, no! ¿Dónde está? ¿Qué necesita?`, `Me [asustaste|asustó]. [Contame|Cuénteme] qué pasó.`] },
    doubt: { q: 'callback', en: [`Then why don't they call me themselves?`, `Let me call them first and see if they're okay.`, `Which relative? Tell me their name, then.`], es: [`¿Y por qué no me llama él directamente?`, `[Dejame|Déjeme] llamarlo primero a ver si está bien.`, `¿Qué familiar? A ver, ¿cómo se llama?`] },
  },
  refund: {
    buy: { q: 'how', en: [`I was overcharged? I knew the bill looked high.`, `A refund? Now that I like. How does it work?`, `You're giving me money back? What do I have to do?`], es: [`¿Me cobraron de más? Ya me parecía que la cuenta venía alta.`, `¿Una devolución? Eso sí me gusta. ¿Cómo es?`, `¿En serio me devuelven plata? ¿Qué tengo que hacer?`] },
    doubt: { q: 'proof', en: [`Since when do companies call to give money back?`, `I didn't see any strange charge.`, `And which company did you say you were from?`], es: [`¿Desde cuándo las empresas llaman para devolver plata?`, `Yo no vi ningún cobro raro.`, `¿Y de qué empresa me [dijiste|dijo] que era?`] },
  },
};

// a secret scambaiter (any mark, some calls): a bit too eager, stalls, turns
// the tables asking for the caller's details, "pays" with fake receipts, then gloats
const BAITER = {
  stall: { en: [`Could you say that again slower? I'm writing everything down.`, `Sorry, it cut out. From the top?`, `How interesting! Tell me more, I have all night.`, `Hold on, let me find a pen... okay. What were you saying?`, `Uh-huh, uh-huh... and how do you spell that?`], es: [`¿Me lo [repetís|repite] más despacio? Estoy anotando todo.`, `Perdón, se cortó. ¿Desde el principio?`, `¡Qué interesante! [Contame|Cuénteme] más, tengo toda la noche.`, `[Esperá|Espere] que busco una lapicera... listo. ¿Qué me [decías|decía]?`, `Ajá, ajá... ¿y eso cómo se escribe?`] },
  tables: { en: [`And what did you say your name was? With an S or a Z?`, `Which branch are you calling from? I want to write it down properly.`, `What's your employee number? So I can call and say thanks.`, `Can you give me your direct number? I'll call you back later.`], es: [`¿Y cómo [dijiste que te llamabas|dijo que se llamaba]? ¿Con ese o con zeta?`, `¿De qué sucursal me [llamás|llama]? Quiero anotarlo bien.`, `¿Y [tu|su] número de empleado? Para llamar a [felicitarte|felicitarlo].`, `¿Me [das tu|da su] número directo? Así [te|lo] llamo yo después.`] },
  data: { en: [`Of course! My {label} is... {value}. Did you get that?`, `Oh yes, right away: {value}. Anything else? Whatever you need.`, `I'll read it out: {value}. So easy, isn't it?`], es: [`¡Claro! Mi {label} es... {value}. ¿Lo [anotaste|anotó] bien?`, `Ay, sí, ya mismo: {value}. ¿Algo más? Lo que [necesites|necesite].`, `[Te|Se] lo dicto: {value}. Qué fácil todo, ¿no?`] },
  pay: { en: [`Sending it right now! Code {code}. Want more?`, `Done, sent. The receipt is {code}. How exciting!`], es: [`¡Ya mismo [te|le] transfiero! Código {code}. ¿[Querés|Quiere] más?`, `Listo, mandado. El comprobante es {code}. ¡Qué emoción!`] },
  boss: { en: [`What a shouter your boss is! Say hi from me.`], es: [`¡Qué gritón [tu|su] jefe! [Mandale|Mándele] saludos de mi parte.`] },
  bye: { en: [`Bye! Wave at the camera!`], es: [`¡Chau! ¡[Saludá|Salude] a la cámara!`] },
  reveal: { en: [`Let me tell you a secret: I've recorded this whole call for my channel. Say hi to the subscribers!`, `You know what? I'm a scambaiter. I've been wasting your time for a good while now.`], es: [`[Te|Le] cuento un secreto: grabé toda la llamada para mi canal. ¡[Saludá|Salude] a los suscriptores!`, `¿[Sabés|Sabe] qué? Soy cazaestafadores. Hace un rato largo que [te|le] hago perder el tiempo.`] },
  after: { en: [`Keep going, keep going, the chat is going wild.`, `Lots of people are watching. Smile!`, `Leaving already? Just when it was getting good.`], es: [`[Seguí|Siga], que el chat está explotando.`, `Nos está mirando un montón de gente. ¡[Sonreí|Sonría]!`, `¿Ya [te vas|se va]? Justo cuando se ponía bueno.`] },
};

// ---- per-call conversation memory ------------------------------------------------------------
function memory(call) {
  if (call.sb) return call.sb;
  const op = norm(call.opener || '');
  call.sb = {
    who: false, name: '', org: null, why: false, proofN: 0,
    // the opener already asks something ("Who is this?")
    q: /legajo|expediente|file number|employee/.test(op) ? 'proof' : /quien (habla|es|llama|sos)|con quien tengo|identif|who is|who's|who.*calling|identify|whom/.test(op) ? 'who' : null,
    want: null,       // data key the caller asked for and the mark is still deciding on
    wantPay: false,
    asks: 0, dodged: 0, askedWho: 0, rudeN: 0, quirkN: 0, smallN: 0, scene: 0, tacticN: {},
    heard: { boss: 0, fart: 0, bonk: 0, cursor: 0, keys: 0 },
    ticTurn: -9, offered: new Set(), lastBank: '',
  };
  return call.sb;
}

export class ScriptedBrain {
  constructor() { this.kind = 'backup'; }

  async reply(call, said, events = []) {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 360));
    const L = call.lang, m = call.mark, sc = call.scenario;
    const mem = memory(call);
    const r = readTurn(call, said);
    const out = [];
    let q = null; // what the mark asks this turn
    const fill = (s, x = {}) => {
      const t = s.replace(/\[([^|\]]*)\|([^\]]*)\]/g, (_, a, b) => (m.formal ? b : a));
      return t.replaceAll('{n}', x.n ?? '').replaceAll('{code}', call.nextVoucher || '').replaceAll('{label}', x.label || '')
        .replaceAll('{value}', x.value || '').replaceAll('{name}', mem.name).replaceAll('{org}', mem.org ? mem.org[L] : '');
    };
    // a fresh (not yet used this call) line from a bank; the bank's question becomes pending
    const say = (bank, x) => {
      if (!bank) return false;
      call.used ||= new Set();
      const list = bank[L];
      const left = list.filter((l) => !call.used.has(l));
      // escalating banks (the "you didn't answer me" ones) go in order, the rest at random
      const l = bank.ordered ? (left[0] || list[list.length - 1]) : pick(left.length ? left : list);
      call.used.add(l);
      out.push(fill(l, x));
      if (bank.q) q = bank.q;
      return true;
    };
    const fresh = (list) => { call.used ||= new Set(); const left = list.filter((l) => !call.used.has(l)); if (!left.length) return null; const l = pick(left); call.used.add(l); return fill(l); };
    const label = (k) => DATA[k].label[L];

    if (call.baiter) return this.baiter(call, mem, r, events, say, fresh, out);

    let trust = call.trust;
    let patience = call.patience - rnd(3, 5);
    let pay = 0, hangup = false, laugh = false, mood = null;
    const gave = [];
    const open = call.leads.filter((l) => !l.known);
    const fartRecent = call.elapsed - (call.fartAt ?? -99) < 25;

    // ---- sounds on the line: one reaction each, not one per turn ------------------------
    const ev = events.join(' | ');
    if (/cursor/i.test(ev)) { say(mem.heard.cursor++ ? B.cursorAgain : B.cursor); trust -= mem.heard.cursor > 1 ? 15 : 10; }
    else if (/fart/i.test(ev)) {
      mem.heard.fart++;
      if (r.blame) say(B.fartBlamed);
      else if (mem.heard.fart === 1) { say(B.fart); patience -= 4; }
      else if (mem.heard.fart === 2) { say(B.fartAgain); patience -= 6; trust -= 3; }
    } else if (/boss|yell/i.test(ev)) {
      mem.heard.boss++;
      if (mem.heard.boss === 1) say(B.boss);
      else if (mem.heard.boss === 2 && trust < 45 && Math.random() < 0.5) { say(B.bossAgain); trust -= 4; }
    } else if (/bonk/i.test(ev) && !mem.heard.bonk++) say(B.bonk);
    else if (/keys/i.test(ev) && !mem.heard.keys++ && Math.random() < 0.3) say(B.keys);
    else if (r.blame && fartRecent && mem.heard.fart) say(B.fartBlamed); // excuse after the reaction turn

    // ---- how the caller talks moves trust ------------------------------------------------
    let d = Math.min(4, r.words / 6);
    let hit = null, backfire = null;
    for (const k of r.tactics) {
      const s = (m.sus && m.sus[k]) || 0;
      const n = mem.tacticN[k] = (mem.tacticN[k] || 0) + 1;
      d += s * rnd(4, 6) * (s > 0 ? 1 / (1 + 0.5 * (n - 1)) : 1); // the same trick wears off
      if (s >= 1.2 && n === 1 && (!hit || s > m.sus[hit])) hit = k;
      if (s <= -0.5 && (!backfire || s < m.sus[backfire])) backfire = k;
    }
    if (r.mentionsMe) d += 3;
    if (r.dislike) { d -= 10; patience -= 8; }
    if (r.rude) { d -= 20; patience -= 15; }
    if (r.quirk) { mem.quirkN++; d += mem.quirkN === 1 ? rnd(18, 28) : mem.quirkN === 2 ? rnd(7, 11) : rnd(1, 3); patience += 4; }
    if (r.smalltalk && mem.smallN < 2) { d += rnd(3, 5); patience += 2; }

    // ---- what the caller told us, and whether they answered our question ---------------
    const was = mem.q;
    let answered = null;
    const gotWho = !!(r.name || r.org);
    const gotWhy = r.pretext || (r.words >= 7 && !r.question) || r.tactics.some((k) => ['fear', 'reward', 'family', 'tech', 'urgency'].includes(k));
    if (was === 'who') answered = gotWho || (r.proof && r.tactics.includes('detail'));
    else if (was === 'why') answered = gotWhy || r.proof || r.askData || r.askMoney;
    else if (was === 'proof') answered = r.proof || (gotWhy && r.words >= 8);
    else if (was === 'how') answered = r.askData || r.askMoney || r.remote || r.words >= 4;
    else if (was === 'callback') answered = /\d{6,}/.test(said.replace(/\D/g, '')) || r.yes ? true : (r.noCallback || r.tactics.includes('urgency')) ? false : null;
    else if (was === 'offer' || was === 'done') answered = r.yes ? true : r.no ? false : null;
    if (answered === true) d += ({ who: 5 + ((m.sus && m.sus.authority) || 0) * 3, why: 6, proof: 7 + ((m.sus && m.sus.detail) || 0) * 5, callback: 5, how: 3, done: 2 })[was] || 0;
    // dodging = ignoring the question and saying nothing else of substance (a trusting mark stops caring who it is)
    const substantive = r.askData || r.askMoney || r.pretext || r.quirk || r.remote || r.smalltalk || r.question || r.joke || r.words >= 6;
    const dodged = answered === false && ['who', 'why', 'proof'].includes(was) && !substantive && !(r.greet && call.turns <= 2) && !(was === 'who' && trust >= 50);
    if (dodged) { mem.dodged++; d -= 5; patience -= mem.dodged > 2 ? 10 : 4; }
    const newWho = gotWho && !mem.who;
    if (r.name) mem.name = r.name;
    if (r.org) mem.org = r.org;
    if (gotWho) mem.who = true;
    if (r.pretext && !mem.why) d += 5;
    if (r.pretext || (was === 'why' && answered)) mem.why = true;
    if (r.proof) mem.proofN++;
    trust = clamp(trust + d);

    // ---- data: give it, hesitate, or question the caller ----------------------------------
    const leak = (lead) => {
      say(B.leak[lead.key], { value: lead.value });
      gave.push(lead.key);
      mem.want = null;
      mem.asks = 0;
      mood = 'trusting';
    };
    const decide = (lead) => {
      if (trust >= lead.threshold) { leak(lead); return; }
      mem.want = lead.key;
      mem.asks++;
      if (mem.asks >= 3) { say(B.insist); trust -= 8; patience -= 12; mood = 'annoyed'; return; }
      if (trust >= lead.threshold - 16) {
        say(!mem.who ? B.hesitateWho : mem.proofN === 0 && Math.random() < 0.5 ? B.hesitateProof : B.hesitate, { label: label(lead.key) });
        trust -= 2;
        mood = 'hesitant';
      } else {
        // the first refusal of each kind of data explains why it is a red flag
        const edu = B.refuseKey[lead.key === 'card' && (sc.id === 'bankfraud' || (mem.org && mem.org.en === 'the bank')) ? 'cardBank' : lead.key];
        const l = mem.asks === 1 ? fresh(edu[L]) : null;
        if (l) { out.push(l); q = edu.q || 'proof'; } else say(mem.who ? B.refuseProof : B.refuse, { label: label(lead.key) });
        trust -= mem.asks > 1 ? 9 : 5;
        patience -= mem.asks > 1 ? 8 : 3;
        mood = 'suspicious';
      }
    };
    const money = () => {
      if (call.paidUnits >= call.budget) { say(B.broke); return; }
      const need = call.paidUnits > 0 ? 75 : 68;
      if (trust >= need) {
        const leftB = call.budget - call.paidUnits;
        const askedN = +((said.match(/\d+/) || [])[0] || 0);
        pay = askedN > 0 ? Math.min(askedN, leftB) : Math.max(1, Math.round(leftB * rnd(0.5, 1)));
        say(call.paidUnits > 0 ? B.payAgain : B.pay, { n: pay });
        mem.wantPay = false;
        mood = 'generous';
        return;
      }
      mem.wantPay = true;
      mem.asks++;
      if (mem.asks >= 3) { say(B.insist); trust -= 8; patience -= 12; mood = 'annoyed'; }
      else if (trust >= need - 16) { say(B.hesitatePay); mood = 'hesitant'; }
      else {
        const edu = B.refusePayKey[sc.id];
        const l = edu && mem.asks === 1 ? fresh(edu[L]) : null;
        if (l) { out.push(l); if (edu.q) q = edu.q; } else say(B.refusePay);
        trust -= 5; patience -= 4; mood = 'suspicious';
      }
    };

    // ---- the main reply -------------------------------------------------------------------
    const firstScene = r.pretext && mem.scene === 0;
    if (r.pretext) mem.scene++;
    let bf = null; // a backfire line already said this turn
    if (r.dislike && !r.rude) { say(B.annoyed); mood = 'annoyed'; }
    if (r.rude) {
      mem.rudeN++;
      if (mem.rudeN >= 2) { say(B.hangupRude); hangup = true; } else say(B.rude);
      mood = 'offended';
    } else if (r.bye) { say(B.bye); hangup = true; }
    else if (r.scam) { say(B.scamWord); trust -= 8; mood = 'suspicious'; }
    else if (r.askData) {
      const asked = r.keys.map((k) => open.find((l) => l.key === k)).find(Boolean);
      const known = call.leads.find((l) => l.known && r.keys.includes(l.key));
      if (asked) decide(asked);
      else if (known) say(B.alreadyGave, { value: known.value });
      else if (!open.length) say(B.nothingLeft);
      else say(B.dontHave, { label: label(r.keys[0]) });
    } else if (r.askMoney) money();
    else if (was === 'offer' && answered === true && mem.want) { const l = open.find((x) => x.key === mem.want); if (l) leak(l); }
    else if (was === 'offer' && answered === false) { say(B.offerNo); mem.want = null; }
    // they answered why/proof while a request was pending: maybe now it is enough
    else if (answered === true && mem.want && open.some((l) => l.key === mem.want) && ['why', 'proof', 'who', 'callback'].includes(was)) {
      const l = open.find((x) => x.key === mem.want);
      if (trust >= l.threshold) { say(was === 'who' && mem.name ? B.ackName : B.ackWhy); leak(l); } else decide(l);
    } else if (answered === true && mem.wantPay && ['why', 'proof', 'who'].includes(was)) money();
    else if (r.remote) { const ok = trust >= 50 && ((m.sus && m.sus.tech) || 0) > -0.5; say(ok ? B.remoteYes : B.remoteNo); if (!ok) trust -= 3; }
    else if (was === 'callback' && answered === false) { say(B.callbackNo); trust -= 8; mood = 'suspicious'; }
    else if (r.quirk && mem.quirkN <= 2) {
      say(mem.quirkN === 1 ? B.quirk : B.quirkAgain);
      const a = fresh(m.about[L]);
      if (a) out.push(a);
      mood = 'delighted';
      laugh = Math.random() < 0.3;
    } else if (firstScene) {
      const s = SCENE[sc.id];
      const doubt = trust < 32 || (backfire && Math.random() < 0.6);
      say(doubt ? s.doubt : s.buy);
      mood = doubt ? 'suspicious' : 'worried';
    } else if (was === 'callback' && answered === true) say(B.callbackOk);
    else if (was === 'done' && answered === true) say(B.ackDone);
    else if (answered === true && was === 'proof') { mem.ackedProof = true; say(B.ackProof); }
    else if (answered === true && was === 'why') say(B.ackWhy);
    else if (newWho || (answered === true && was === 'who')) say(mem.name ? B.ackName : mem.org ? B.ackOrg : B.ack);
    else if (dodged && was) {
      // after the warning ("tell me who you are or I hang up") comes the hang-up
      if (mem.dodged >= 4) { say(B.hangup); hangup = true; } else say({ who: B.againWho, why: B.againWhy, proof: B.againProof }[was]);
    } else if (r.smalltalk && mem.smallN++ < 2) { say(B.smalltalk); const a = fresh(m.about[L]); if (a) out.push(a); }
    else if (r.joke) {
      if (trust > 30 && Math.random() < 0.45 + trust / 200) { say(B.joke); laugh = true; trust += 5; } else say(B.smile);
    } else if (r.greet && call.turns <= 2) say(B.greet);
    else if (r.thanks) say(B.thanks);
    else if (backfire && (bf = fresh(TACTIC_BACKFIRE[backfire][L]))) { out.push(bf); mood = 'annoyed'; }
    else if (hit && TACTIC_HIT[hit]) say(TACTIC_HIT[hit]);
    else if (r.proof && !mem.ackedProof) { mem.ackedProof = true; say(B.ackProof); }
    else if (r.pretext) say(B.heardThat);
    else if (r.question) say(trust >= 40 ? B.yesQ : B.whyQ);
    else if (!out.length) say(r.words <= 2 ? B.huh : B.ack);

    // a tactic that backfires still gets a word in, even after another reply
    if (backfire && !bf && out.length < 2) {
      bf = fresh(TACTIC_BACKFIRE[backfire][L]);
      if (bf) { out.push(bf); mood = 'annoyed'; }
    }

    trust = clamp(trust);
    patience = clamp(patience);

    // ---- hanging up -------------------------------------------------------------------------
    if (!hangup && trust <= 8 && (mem.asks >= 2 || mem.dodged >= 3 || mem.heard.cursor >= 2)) { say(B.hangupScam); hangup = true; mood = 'suspicious'; }
    else if (!hangup && patience <= 0) { say(B.hangup); hangup = true; }

    // ---- keep the conversation going: the mark's own next question -------------------------
    if (!hangup && !gave.length && !pay && q === null && !/\?\s*$/.test(out[out.length - 1] || '')) {
      const first = open[0];
      if (!mem.who && mem.askedWho < 2 && (trust < 60 || call.turns <= 1)) { mem.askedWho++; say(dodged ? B.againWho : B.askWho); }
      else if (!mem.why && !r.askData && !r.askMoney) say(B.askWhy);
      else if (trust < 35 && mem.proofN === 0 && Math.random() < 0.7) say(B.askProof);
      else if (trust < 35 && ((m.sus && m.sus.urgency) || 0) < 0 && Math.random() < 0.5) say(B.askCallback);
      else if (first && trust >= first.threshold && !mem.offered.has(first.key) && Math.random() < 0.6) { mem.offered.add(first.key); mem.want = first.key; say(B.offer, { label: label(first.key) }); }
      else if (trust >= 40 && open.length && Math.random() < 0.7) say(B.askHow);
    }
    if (gave.length && !hangup && Math.random() < 0.4 && !/\?\s*$/.test(out[out.length - 1] || '')) say(B.askDone);
    // a verbal tic now and then, so each mark sounds like themselves
    if (!hangup && out.length < 3 && call.turns - mem.ticTurn >= 3 && Math.random() < 0.35) {
      const tic = fresh(m.tics[L]);
      if (tic) { out.unshift(tic); mem.ticTurn = call.turns; }
    }

    // the bonus words, echoed back when they are warm enough
    const ch = call.challenge;
    if (ch.kind === 'markSays' && trust > 40 && !hangup) {
      const w = ch.words.find((x) => r.t.includes(norm(x)));
      const W = w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
      if (w) out.push(ch.id === 'wiggles' ? (L === 'es' ? `Bueno, Capitán Meneos.` : `Fine, Captain Wiggles.`) : (L === 'es' ? `¿${W}? Bueno: ${w}. ¿Contento?` : `${W}? Fine: ${w}. Happy?`));
    }

    mem.q = hangup ? null : q;
    if (!mood) mood = trust >= 70 ? 'trusting' : trust >= 50 ? 'warming' : trust >= 30 ? 'wary' : 'suspicious';
    return { say: out.slice(0, 3).join(' '), trust, patience, mood, pay, gave, hangup, laugh, challenge: false };
  }

  // the secret scambaiter toys with the caller: it all looks too easy (trust shoots
  // up), data and payments are fake, and a few turns in they gloat
  baiter(call, mem, r, events, say, fresh, out) {
    const L = call.lang;
    mem.revealAt ??= 4 + Math.floor(Math.random() * 3);
    if (/boss|yell/i.test(events.join(' ')) && !mem.heard.boss++) say(BAITER.boss);
    const gave = [];
    let pay = 0;
    const lead = call.leads.find((l) => !l.known);
    if (r.bye) say(BAITER.bye);
    else if (r.askMoney) { say(BAITER.pay); pay = +((r.t.match(/\d+/) || [])[0] || 0) || 40 + Math.floor(Math.random() * 60); }
    else if (r.askData && lead) { say(BAITER.data, { label: DATA[lead.key].label[L], value: lead.value }); gave.push(lead.key); }
    if (!r.bye && call.turns >= mem.revealAt && !call.revealed) { say(BAITER.reveal); call.revealed = true; }
    else if (call.revealed && !r.bye) { const l = fresh(BAITER.after[L]); if (l) out.push(l); }
    else if (!r.bye && !r.askMoney && !r.askData) {
      say(Math.random() < 0.5 ? BAITER.stall : BAITER.tables);
      // still sounds like themselves
      const extra = Math.random() < 0.5 ? fresh(call.mark.tics[L]) : fresh(call.mark.about[L]);
      if (extra && Math.random() < 0.6) out.unshift(extra);
    }
    if (!out.length) say(BAITER.stall);
    const trust = Math.min(92, call.trust + 10 + Math.random() * 6);
    return { say: out.slice(0, 3).join(' '), trust, patience: Math.min(100, call.patience + 4), mood: 'eager', pay, gave, hangup: false, laugh: false, challenge: false };
  }
}
