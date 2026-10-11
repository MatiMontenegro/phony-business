// The marks (fictional people who get the calls), the everyday-scam
// scenarios the boss assigns, the data they hold and the bonus challenges.
// Every piece of data is generated per call and is ALWAYS fake: Social
// Security numbers use area 000 (never issued), cards start with 0000 (no
// card network uses it), codes are random. Nothing here maps to real people.

// ---- the data a mark can give away ------------------------------------------------------
// trust: how much trust the mark needs before saying it (per-mark `guard` shifts it)
export const DATA = {
  google: {
    label: { en: `Google account code`, es: `código de la cuenta de Google` },
    short: { en: `Google code`, es: `Código de Google` },
    price: 160, trust: 56,
  },
  bank: {
    label: { en: `online banking password`, es: `clave del home banking` },
    short: { en: `Bank password`, es: `Clave del banco` },
    price: 200, trust: 64,
  },
  ssn: {
    label: { en: `Social Security number`, es: `número de Seguro Social` },
    short: { en: `Social Security`, es: `Seguro Social` },
    price: 230, trust: 72,
  },
  card: {
    label: { en: `credit card number`, es: `número de tarjeta de crédito` },
    short: { en: `Credit card`, es: `Tarjeta de crédito` },
    price: 260, trust: 78,
  },
};
export const DATA_KEYS = Object.keys(DATA);

const digits = (n, r) => { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(r() * 10); return s; };

// fake value for one data item of one mark
export function makeData(mark, key, r = Math.random) {
  switch (key) {
    case 'google': return `G-${digits(6, r)}`;
    case 'ssn': return `000-${digits(2, r)}-${digits(4, r)}`;
    case 'card': return `0000 ${digits(4, r)} ${digits(4, r)} ${digits(4, r)}`;
    case 'bank': {
      const w = (mark.pwWords && mark.pwWords.length) ? mark.pwWords[Math.floor(r() * mark.pwWords.length)] : 'CLAVE';
      return `${w}${digits(r() < 0.5 ? 2 : 4, r)}`;
    }
    default: return digits(8, r);
  }
}

// transfer receipts: the mark reads one out loud when paying; the agent types
// it into the Lead Registry to collect
export function makeReceipt(r = Math.random) { return `TRF-${1000 + Math.floor(r() * 9000)}`; }

// ---- scenarios: the pretext of the night (recognizable, everyday, PG-13) ----------------------
export const SCENARIOS = [
  {
    id: 'bankfraud',
    title: { en: `Bank "fraud department"`, es: `"Departamento de fraudes" del banco` },
    brief: { en: `Say there is a suspicious purchase on their card.`, es: `Decí que hay una compra sospechosa en su tarjeta.` },
    targets: ['card', 'bank'], pay: false,
    flags: {
      en: [`Banks never ask for your full card number or password over the phone.`, `If someone calls "from your bank", hang up and call the number on the back of your card.`],
      es: [`Un banco nunca te pide el número completo de la tarjeta ni la clave por teléfono.`, `Si te llaman "del banco", cortá y llamá vos al número que figura atrás de la tarjeta.`],
    },
  },
  {
    id: 'google',
    title: { en: `Google account "security"`, es: `"Seguridad" de la cuenta de Google` },
    brief: { en: `Someone "tried to log in": ask for the code they just got.`, es: `Alguien "intentó entrar": pedile el código que le acaba de llegar.` },
    targets: ['google'], pay: false,
    flags: {
      en: [`A verification code is for you only: whoever asks for it wants into your account.`, `No real support team asks you to read them a code.`],
      es: [`El código de verificación es solo para vos: el que te lo pide quiere entrar a tu cuenta.`, `Ningún soporte de verdad te pide que le leas un código.`],
    },
  },
  {
    id: 'ssa',
    title: { en: `Social Security office`, es: `Oficina del Seguro Social` },
    brief: { en: `Their number was "suspended" and must be verified.`, es: `Su número quedó "suspendido" y hay que verificarlo.` },
    targets: ['ssn', 'bank'], pay: false,
    flags: {
      en: [`Government offices do not "suspend" your number over the phone.`, `Threats of fines or arrest are pressure tactics.`],
      es: [`Ningún organismo "suspende" tu número por teléfono.`, `Las amenazas de multas o denuncias son para presionarte.`],
    },
  },
  {
    id: 'techsupport',
    title: { en: `Tech support: "your PC has a virus"`, es: `Soporte técnico: "tu PC tiene un virus"` },
    brief: { en: `Their computer "has a virus". Get them to let you in (Remote Assist).`, es: `Su computadora "tiene un virus". Hacé que te deje entrar (Asistencia remota).` },
    targets: ['bank', 'google'], pay: true,
    flags: {
      en: [`Real support never calls you out of the blue about a virus.`, `Never let a stranger control your computer remotely.`],
      es: [`El soporte real nunca te llama de la nada por un virus.`, `Nunca dejes que un desconocido controle tu computadora.`],
    },
  },
  {
    id: 'prize',
    title: { en: `"You won a prize!"`, es: `"¡Ganaste un premio!"` },
    brief: { en: `They won a raffle; they only need to pay the "shipping".`, es: `Ganó un sorteo; solo tiene que pagar el "envío".` },
    targets: ['card'], pay: true,
    flags: {
      en: [`If you have to pay to receive a prize, it is not a prize.`, `You cannot win a raffle you never entered.`],
      es: [`Si tenés que pagar para recibir un premio, no es un premio.`, `No podés ganar un sorteo en el que nunca participaste.`],
    },
  },
  {
    id: 'package',
    title: { en: `Package held at customs`, es: `Paquete retenido en la aduana` },
    brief: { en: `A package is held; a small fee "releases" it.`, es: `Hay un paquete retenido; un pago chiquito lo "libera".` },
    targets: ['card'], pay: true,
    flags: {
      en: [`Couriers do not call asking for card details to release a package.`, `Check deliveries only in the official app or website.`],
      es: [`El correo no te llama para pedirte la tarjeta y liberar un paquete.`, `Revisá tus envíos solo en la app o la web oficial.`],
    },
  },
  {
    id: 'relative',
    title: { en: `"A relative is in trouble"`, es: `"Un familiar está en problemas"` },
    brief: { en: `Call on behalf of a relative who needs money right now.`, es: `Llamá de parte de un familiar que necesita plata ya mismo.` },
    targets: ['bank'], pay: true,
    flags: {
      en: [`Hang up and call your relative directly.`, `Urgency plus secrecy ("don't tell anyone") is the classic trick.`],
      es: [`Cortá y llamá directamente a tu familiar.`, `Urgencia más secreto ("no le digas a nadie") es el truco clásico.`],
    },
  },
  {
    id: 'refund',
    title: { en: `"You were overcharged"`, es: `"Le cobramos de más"` },
    brief: { en: `They were overcharged; to refund it you "need" their details.`, es: `Le cobraron de más; para devolverle la plata "necesitás" sus datos.` },
    targets: ['card', 'ssn'], pay: false,
    flags: {
      en: [`To refund you, a company never needs your full card number or ID.`, `Unexpected refunds over the phone are a hook.`],
      es: [`Para devolverte plata, una empresa nunca necesita tu tarjeta completa ni tu documento.`, `Los reintegros sorpresa por teléfono son un anzuelo.`],
    },
  },
];

// ---- tactics: what the caller does (used by the backup brain and the debrief) -------------
// each list is matched on normalized text (no accents, lower case)
export const TACTICS = {
  authority: { words: ['banco', 'bank', 'google', 'soporte', 'support', 'seguro social', 'social security', 'gobierno', 'government', 'oficina', 'office', 'departamento', 'department', 'seguridad', 'security', 'fraude', 'fraud', 'correo', 'courier', 'aduana', 'customs', 'empresa', 'company', 'oficial', 'official', 'agente', 'agent', 'supervisor', 'tecnico', 'technician', 'llamo de', 'calling from', 'le hablo de', 'te hablo de'],
    label: { en: `Posing as an institution`, es: `Hacerse pasar por una institución` }, tip: { en: `Anyone can say they are "the bank". Call back on the official number.`, es: `Cualquiera puede decir que es "el banco". Llamá vos al número oficial.` } },
  urgency: { words: ['ahora', 'ya mismo', 'urgente', 'rapido', 'enseguida', 'inmediato', 'minutos', 'hoy', 'ultima', 'now', 'right now', 'urgent', 'hurry', 'quick', 'immediately', 'minutes', 'today', 'last chance', 'before it'],
    label: { en: `Rushing you`, es: `Apurarte` }, tip: { en: `Pressure is there so you don't think. Real institutions give you time.`, es: `El apuro está para que no pienses. Las instituciones reales te dan tiempo.` } },
  fear: { words: ['bloque', 'suspend', 'multa', 'denuncia', 'policia', 'arrest', 'detenid', 'perder', 'robar', 'hacke', 'virus', 'blocked', 'fine', 'police', 'lose', 'stolen', 'hacked', 'lawsuit', 'juicio', 'embargo', 'deuda', 'debt', 'peligro', 'danger'],
    label: { en: `Scaring you`, es: `Asustarte` }, tip: { en: `Threats of blocks, fines or police are classic pressure.`, es: `Amenazas de bloqueos, multas o policía son presión clásica.` } },
  reward: { words: ['premio', 'ganaste', 'gano', 'ganador', 'ganar', 'ganaron', 'ganado', 'gratis', 'regalo', 'sorteo', 'reintegro', 'devolucion', 'reembolso', 'bonus', 'prize', 'won', 'win', 'free', 'gift', 'giveaway', 'refund', 'cashback', 'descuento', 'discount', 'skin', 'seguidores', 'followers'],
    label: { en: `Dangling a reward`, es: `Ofrecerte un premio` }, tip: { en: `If it sounds too good to be true, it is a hook.`, es: `Si suena demasiado bueno para ser verdad, es un anzuelo.` } },
  empathy: { words: ['entiendo', 'tranquil', 'no se preocupe', 'no te preocupes', 'lo siento', 'lamento', 'quedese tranquil', 'quedate tranquil', 'estoy para ayudar', 'le ayudo', 'te ayudo', 'understand', 'dont worry', "don't worry", 'sorry', 'here to help', 'i can help', 'relax', 'no problem'],
    label: { en: `Being extra friendly`, es: `Hacerse el amable` }, tip: { en: `Scammers sound kind on purpose. Kindness is not proof of anything.`, es: `Los estafadores suenan amables a propósito. La amabilidad no prueba nada.` } },
  flattery: { words: ['lindo', 'linda', 'genial', 'hermos', 'increible', 'maravillos', 'elegante', 'inteligente', 'brillante', 'capo', 'idolo', 'crack', 'amazing', 'great', 'wonderful', 'beautiful', 'lovely', 'awesome', 'brilliant', 'smart', 'fantastic', 'genius', 'me encanta', 'i love'],
    label: { en: `Flattery`, es: `Halagos` }, tip: { en: `Flattery lowers your guard. Notice when a stranger praises you a lot.`, es: `Los halagos bajan la guardia. Ojo cuando un desconocido te elogia mucho.` } },
  politeness: { words: ['por favor', 'gracias', 'usted', 'senora', 'senor', 'disculpe', 'perdone', 'buenas noches', 'buen dia', 'please', 'thank', 'sir', "ma'am", 'madam', 'excuse me', 'good evening'] },
  detail: { words: ['legajo', 'numero de caso', 'caso numero', 'expediente', 'id de empleado', 'mi nombre es', 'me llamo', 'case number', 'case #', 'employee id', 'badge', 'my name is', 'ticket', 'referencia', 'reference', 'terminada en', 'ending in', 'ultimos cuatro', 'last four'],
    label: { en: `Fake "proof" details`, es: `Datos de "prueba" inventados` }, tip: { en: `Case numbers and names are easy to invent. They prove nothing.`, es: `Un número de caso o un nombre se inventan en un segundo. No prueban nada.` } },
  family: { words: ['nieto', 'nieta', 'hijo', 'hija', 'sobrin', 'familia', 'mama', 'papa', 'abuel', 'grandson', 'granddaughter', 'your son', 'my son', 'daughter', 'nephew', 'niece', 'family', 'mom', 'dad', 'grandma', 'grandpa'],
    label: { en: `Using family`, es: `Usar a la familia` }, tip: { en: `Hang up and call your relative directly.`, es: `Cortá y llamá vos directamente a tu familiar.` } },
  secrecy: { words: ['no le digas', 'no le diga', 'no se lo cuente', 'no le cuentes', 'entre nosotros', 'secreto', 'confidencial', 'dont tell', "don't tell", 'between us', 'keep it secret', 'confidential'],
    label: { en: `Asking for secrecy`, es: `Pedir que no le cuentes a nadie` }, tip: { en: `"Don't tell anyone" is a giant red flag.`, es: `"No le cuentes a nadie" es una alarma gigante.` } },
  tech: { words: ['ip', 'servidor', 'server', 'firewall', 'sistema', 'system', 'actualizacion', 'update', 'software', 'remoto', 'remote', 'acceso', 'access', 'computadora', 'computer', 'link', 'enlace', 'app', 'aplicacion', 'descarg', 'download', 'instal'],
    label: { en: `Tech jargon / remote access`, es: `Jerga técnica / acceso remoto` }, tip: { en: `Never install what a caller tells you to, and never give remote access.`, es: `Nunca instales lo que te pide alguien que llama ni le des acceso remoto.` } },
};

// which tactics a message uses
export function tacticsIn(text) {
  const has = wordMatcher(text);
  return Object.entries(TACTICS).filter(([, v]) => has(v.words)).map(([k]) => k);
}

// does `text` say any of `list`? Short words must be whole words (or their plural:
// "ip" is not in "ship", "che" is not in "noches", "cat" is not in "catalog"),
// longer ones work as stems ("sospechos", "instal"), phrases start at a word.
export function wordMatcher(text) {
  const t = norm(text);
  const toks = t.split(/[^a-z0-9']+/).filter(Boolean);
  const line = ' ' + toks.join(' ') + ' ';
  return (list) => list.some((w) => {
    const n = norm(w).trim();
    if (!n) return false;
    if (n.includes(' ')) return line.includes(' ' + n);
    if (n.length <= 4) return toks.some((k) => k === n || k === n + 's' || k === n + 'es');
    return t.includes(n);
  });
}

// ---- the cast ------------------------------------------------------------------------------
// sus: how well each tactic works on them (negative backfires).
// guard: shifts every data threshold (positive = harder).
export const MARKS = [
  {
    id: 'elvira',
    formal: true, // talks to the caller as "usted"
    name: `Doña Elvira Pereyra`,
    title: { en: `Retired teacher, 78`, es: `Maestra jubilada, 78` },
    look: { build: 'slim', fem: 1, skin: '#ffb347', shirt: { style: 'cardigan', color: '#8fa7ff' }, pants: { color: '#3a2a5a', style: 'slacks' }, face: { preset: 4 }, hair: 'bun', hairColor: '#d8d4e2', glasses: 'round', extras: ['pearls'], headset: false, shoes: { style: 'dress', color: '#5a3a22' } },
    voice: { gender: 'female', age: 'old', pitch: 1.08, rate: 0.88, style: 'sweet' },
    bio: `A 78-year-old retired language teacher who lives alone with her old cat Michi. Very polite and formal, corrects grammar, gets nervous about anything to do with the bank. Her grandson Facu "does computers" and set up her online banking.`,
    quirk: { en: `Melts with polite, patient callers and anyone who asks about her cat Michi.`, es: `Se derrite con la gente educada y paciente, y con quien le pregunta por su gato Michi.` },
    quirkKeys: { words: ['michi', 'gato', 'gatito', 'gata', 'cat', 'kitty', 'kitten'] },
    dislikes: ['apurate', 'rapido', 'dale', 'boluda', 'vieja', 'abuela', 'hurry', 'old lady', 'granny', 'come on'],
    sus: { politeness: 1.6, empathy: 1.3, authority: 1.1, fear: 1.2, family: 1.3, detail: 0.9, flattery: 0.8, reward: 0.4, urgency: -0.6, tech: -0.3, secrecy: 0.4 },
    guard: 0, data: ['ssn', 'bank', 'card'], pwWords: ['MICHI', 'TANGO', 'FACU'], wealth: [60, 180],
    opener: { en: `Hello? Who is this? Speak up, dear, the television is on.`, es: `¿Hola? ¿Quién habla? Hable fuerte, querido, que tengo la tele prendida.` },
    tics: {
      en: ['Oh dear.', 'Let me see, dear...', 'Speak a little slower.', 'Sorry, my hearing is not what it was.', 'Goodness.'],
      es: ['Ay, Dios mío.', 'A ver, querido...', 'Hable más despacio.', 'Disculpe, es que oigo poco.', 'Válgame.'],
    },
    about: {
      en: ['My cat Michi is twelve. Older than some of my former students.', 'I taught language for thirty-five years. Mind your commas.', 'My grandson Facu fixes my computer, when he remembers.'],
      es: ['Mi gato Michi tiene doce años. Más viejo que algunos de mis alumnos.', 'Fui maestra de lengua treinta y cinco años. Cuide las comas.', 'Mi nieto Facu me arregla la computadora, cuando se acuerda.'],
    },
    diary: {
      en: `Dear diary: Facu wrote my bank password on a little paper and I cannot remember where I put it. Michi sleeps on the keyboard again.`,
      es: `Querido diario: Facu me anotó la clave del banco en un papelito y no me acuerdo dónde lo puse. Michi duerme otra vez arriba del teclado.`,
    },
    os: `AbuelaOS 98`,
  },
  {
    id: 'kevo',
    name: `Kevin "Kevo" Ramírez`,
    title: { en: `Streamer, 19`, es: `Streamer, 19` },
    look: { build: 'slim', skin: '#3fc7b0', shirt: { style: 'hoodie', color: '#46e3a0' }, pants: { color: '#1a1a22', style: 'jeans' }, face: { preset: 0 }, hair: 'crop', hairColor: '#1c1410', hat: 'cap', headset: true },
    voice: { gender: 'male', age: 'young', pitch: 1.1, rate: 1.15, style: 'quirky' },
    bio: `A 19-year-old who streams video games all night and talks super fast with gamer slang. Gets very excited about free skins, giveaways and "collabs". Secretly uses his mom's credit card for in-game purchases.`,
    quirk: { en: `Trusts anyone who offers free skins, giveaways or gaming rewards.`, es: `Confía en cualquiera que le ofrezca skins gratis, sorteos o premios gamer.` },
    quirkKeys: { words: ['skin', 'skins', 'sorteo', 'giveaway', 'pase de batalla', 'battle pass', 'gamer', 'stream', 'twitch', 'monedas del juego', 'v-bucks', 'pavos'] },
    dislikes: ['senor', 'usted', 'sir', 'formulario', 'form', 'tramite', 'paperwork', 'noob'],
    sus: { reward: 1.6, tech: 1.1, flattery: 1.0, urgency: 0.8, fear: 0.5, empathy: 0.4, detail: 0.3, family: 0.2, authority: -0.2, politeness: -0.2, secrecy: 0.9 },
    guard: -4, data: ['google', 'card'], pwWords: ['KEVO', 'GGWP', 'NOOB'], wealth: [30, 120],
    opener: { en: `Yo, what's up? Make it quick, I'm mid-match.`, es: `¿Qué onda? Hablá rápido que estoy en partida.` },
    tics: {
      en: ['No way.', 'Hold up, hold up.', 'Bruh.', 'Wait, I am getting shot.', 'Lowkey...'],
      es: ['Ah, re.', 'Banca, banca.', 'Uh, nada que ver.', 'Esperá que me están matando.', 'Posta...'],
    },
    about: {
      en: ['I have like forty followers, but they are super loyal.', 'My mom does not know I use her card for battle passes.', 'Yesterday I won a match without hands. Well, one hand.'],
      es: ['Tengo como cuarenta seguidores, pero son re fieles.', 'Mi vieja no sabe que uso su tarjeta para los pases.', 'Ayer gané una partida sin manos. Bueno, con una.'],
    },
    diary: {
      en: `notes: mom's card is in the kitchen drawer. remember to delete the purchase emails. giveaway at 10?`,
      es: `notas: la tarjeta de mamá está en el cajón de la cocina. borrar los mails de compras. ¿sorteo a las 10?`,
    },
    os: `GamerOS RGB`,
  },
  {
    id: 'tito',
    name: `Roberto "Tito" Gómez`,
    title: { en: `Taxi driver, 56`, es: `Taxista, 56` },
    look: { build: 'heavy', skin: '#ff8a3d', shirt: { style: 'polo', color: '#ffd84d' }, pants: { color: '#2b2550', style: 'slacks' }, face: { preset: 1 }, hair: 'balding', hairColor: '#3b2416', mustache: true, headset: false },
    voice: { gender: 'male', age: 'adult', pitch: 0.85, rate: 1.08, style: 'gruff' },
    bio: `A 56-year-old taxi driver who always answers while driving, honking and complaining about traffic. Passionate football fan. Hates people who beat around the bush and anyone who makes him wait.`,
    quirk: { en: `Talk football with him and he is yours.`, es: `Hablale de fútbol y es tuyo.` },
    quirkKeys: { words: ['futbol', 'football', 'soccer', 'gol', 'goal', 'racing', 'boca', 'river', 'partido', 'match', 'hincha', 'clasico', 'derby', 'campeonato'] },
    dislikes: ['espere', 'aguarde', 'hold', 'wait', 'formulario', 'paciencia', 'patience', 'transferir con', 'transfer you'],
    sus: { detail: 1.1, reward: 1.0, family: 1.0, fear: 0.8, authority: 0.7, empathy: 0.6, flattery: 0.5, politeness: 0.3, urgency: -0.4, tech: -0.6, secrecy: 0.3 },
    guard: 2, data: ['card', 'bank'], pwWords: ['RACING', 'TAXI', 'TITO'], wealth: [40, 140],
    opener: { en: `Hello! Who's this? Talk, I'm driving.`, es: `¡Hola! ¿Quién es? Hablá que estoy manejando, eh.` },
    tics: {
      en: ['Come on, move it!', 'Hold on, this guy cut me off.', 'Yeah, yeah.', 'Talk, talk.', 'Unbelievable, this traffic.'],
      es: ['¡Dale, avanzá!', 'Pará que este me cerró.', 'Sí, sí.', 'Hablá, hablá.', 'Increíble este tránsito.'],
    },
    about: {
      en: ['Twenty-two years driving a cab. I have seen everything.', 'My cab is called La Gorda. She never fails me.', 'Sunday is sacred: football and barbecue.'],
      es: ['Veintidós años arriba del taxi. Vi de todo.', 'Al taxi le digo La Gorda. Nunca me falla.', 'El domingo es sagrado: fútbol y asado.'],
    },
    diary: {
      en: `Trips: 14. Cash: little. The card password is the year we won the cup, like always.`,
      es: `Viajes: 14. Efectivo: poco. La clave de la tarjeta es el año que salimos campeones, como siempre.`,
    },
    os: `TaxiOS`,
  },
  {
    id: 'mariela',
    name: `Mariela Ruiz`,
    title: { en: `Mom of three, 41`, es: `Mamá de tres, 41` },
    look: { build: 'average', fem: 1, skin: '#ff7eb3', shirt: { style: 'tee', color: '#ff9f6b' }, pants: { color: '#1f2a44', style: 'jeans' }, face: { preset: 2 }, hair: 'ponytail', hairColor: '#5a3a22', headset: false },
    voice: { gender: 'female', age: 'adult', pitch: 1.05, rate: 1.12, style: null },
    bio: `A 41-year-old mom of three who answers while cooking, with kids screaming in the background. Practical and multitasking, impatient with long explanations, grateful to anyone who solves things fast.`,
    quirk: { en: `Trusts anyone who promises to fix it fast, no paperwork. Softens if you ask about her kids.`, es: `Confía en quien le promete resolverlo rápido y sin trámites. Se ablanda si le preguntás por los chicos.` },
    quirkKeys: { words: ['dos minutos', 'two minutes', 'sin tramite', 'no paperwork', 'chicos', 'hijos', 'kids', 'children', 'nenes'] },
    dislikes: ['espere en linea', 'aguarde', 'hold the line', 'tramite', 'sucursal', 'branch', 'paperwork', 'formulario'],
    sus: { family: 1.4, urgency: 1.2, empathy: 1.0, fear: 1.0, authority: 0.9, reward: 0.7, detail: 0.6, politeness: 0.5, flattery: 0.4, tech: 0.2, secrecy: 0.5 },
    guard: -2, data: ['google', 'card', 'bank'], pwWords: ['MATEO', 'LUZ', 'BENJA'], wealth: [50, 150],
    opener: { en: `Hello? Ben, put that down! Sorry, who is this?`, es: `¿Hola? ¡Benjamín, soltá eso! Perdón, ¿quién habla?` },
    tics: {
      en: ['Sorry, the pasta is boiling over.', 'Luz, not the cat!', 'Uh-huh, go on.', 'Okay, okay.', 'One second... yes.'],
      es: ['Perdón, se me pasan los fideos.', '¡Luz, al gato no!', 'Ajá, seguí.', 'Bueno, bueno.', 'Un segundo... sí.'],
    },
    about: {
      en: ['Three kids, one dog and a husband who "is coming right back".', 'I have not had a hot coffee since 2019.', 'Ben drew on the wall again. With my lipstick.'],
      es: ['Tres hijos, un perro y un marido que "ya vuelve".', 'No tomo un café caliente desde 2019.', 'Benja dibujó la pared otra vez. Con mi labial.'],
    },
    diary: {
      en: `To do: dentist for Luz, pay the card before Friday, the Google code keeps arriving on my phone, why?`,
      es: `Pendientes: dentista de Luz, pagar la tarjeta antes del viernes, me siguen llegando códigos de Google al celu, ¿por qué?`,
    },
    os: `MamiOS 3 Hijos`,
  },
  {
    id: 'hernan',
    formal: true, // talks to the caller as "usted"
    name: `Dr. Hernán Castillo`,
    title: { en: `Dentist, 50 (expert in everything)`, es: `Dentista, 50 (experto en todo)` },
    look: { build: 'average', skin: '#ffd84d', shirt: { style: 'buttonup', color: '#4dd6ff' }, pants: { color: '#2c3a5a', style: 'slacks' }, tie: '#1a1433', face: { preset: 3 }, hair: 'slick', hairColor: '#2e2a3a', glasses: 'square', headset: false, shoes: { style: 'dress', color: '#1a1410' } },
    voice: { gender: 'male', age: 'adult', pitch: 0.95, rate: 0.95, style: 'posh' },
    bio: `A 50-year-old dentist who believes he is an expert in everything: finance, tech, law. Vain, insists on being called "doctor". Easily flattered about his intelligence and his small sailboat.`,
    quirk: { en: `Call him "doctor" and praise his brilliance.`, es: `Decile "doctor" y elogiá su brillantez.` },
    quirkKeys: { words: ['doctor', 'dr', 'genio', 'genius', 'brillante', 'brilliant', 'experto', 'expert', 'velero', 'sailboat', 'eminencia'] },
    dislikes: ['no entiende', 'not understand', 'ignorante', 'ignorant', 'es facil', 'it is easy', 'cualquiera sabe', 'anyone knows'],
    sus: { flattery: 1.6, tech: 1.1, detail: 1.0, reward: 0.8, politeness: 0.8, authority: 0.6, fear: 0.6, urgency: 0.3, empathy: 0.3, family: 0.2, secrecy: 0.6 },
    guard: 2, data: ['card', 'ssn'], pwWords: ['SONRISA', 'VELERO', 'DOCTOR'], wealth: [120, 300],
    opener: { en: `Doctor Castillo speaking. Be brief, I have a patient with their mouth open.`, es: `Consultorio del doctor Castillo. Sea breve, tengo un paciente con la boca abierta.` },
    tics: {
      en: ['Naturally.', 'As I always say...', 'Obviously.', 'Mm, interesting, I knew it.', 'Rinse, please. Not you.'],
      es: ['Naturalmente.', 'Como digo siempre...', 'Obvio.', 'Mm, interesante, lo sabía.', 'Enjuague, por favor. Usted no.'],
    },
    about: {
      en: ['I read a book about economics once. Most of it.', 'My sailboat is named Molar. It barely floats.', 'I could have been a lawyer, a pilot or an astronaut.'],
      es: ['Una vez leí un libro de economía. Casi entero.', 'Mi velero se llama Muela. Apenas flota.', 'Podría haber sido abogado, piloto o astronauta.'],
    },
    diary: {
      en: `Reminder: I am right. Card PIN = my graduation year, the most important day for science.`,
      es: `Recordatorio: tengo razón. PIN de la tarjeta = mi año de egreso, el día más importante para la ciencia.`,
    },
    os: `DocOS Pro Max`,
  },
  {
    id: 'lu',
    name: `Lucía "Lu" Fernández`,
    title: { en: `Influencer, 26`, es: `Influencer, 26` },
    look: { build: 'slim', fem: 1, skin: '#a77bff', shirt: { style: 'tee', color: '#c78bff' }, pants: { color: '#1a1a22', style: 'jeans' }, face: { preset: 4 }, hair: 'long', hairColor: '#e2c27a', glasses: 'sun', headset: false },
    voice: { gender: 'female', age: 'young', pitch: 1.15, rate: 1.08, style: null },
    bio: `A 26-year-old lifestyle influencer who turns everything into content. Always filming, asks to record the call for her stories. Dreams of brand deals and a verified badge.`,
    quirk: { en: `Trusts anyone who offers a collab, followers or the verified badge.`, es: `Confía en quien le ofrece un canje, seguidores o la verificación.` },
    quirkKeys: { words: ['seguidores', 'followers', 'colaboracion', 'collab', 'canje', 'marca', 'brand deal', 'verificada', 'verified', 'tilde azul', 'blue check', 'sponsor', 'viral'] },
    dislikes: ['no te conozco', 'who are you', 'quien sos vos', 'never heard of you', 'cringe', 'aburrido', 'boring'],
    sus: { reward: 1.4, flattery: 1.3, urgency: 0.6, tech: 0.6, empathy: 0.6, authority: 0.5, politeness: 0.5, fear: 0.4, detail: 0.4, family: 0.2, secrecy: 1.0 },
    guard: -2, data: ['google', 'card'], pwWords: ['LUVIBES', 'GLOW', 'FLASH'], wealth: [60, 200],
    opener: { en: `Heyyy! Mind if I record this call? It's for my stories.`, es: `¡Holaaa! ¿Te molesta si grabo la llamada? Es para mis historias.` },
    tics: {
      en: ['Oh my god.', 'Wait, that is so content.', 'Literally.', 'Okay, love that.', 'Hold on, the lighting...'],
      es: ['Ay, no puedo.', 'Pará, eso es re contenido.', 'Literal.', 'Bueno, amo.', 'Esperá que acomodo la luz...'],
    },
    about: {
      en: ['I have eleven thousand followers. Twelve on good days.', 'I did a skincare collab with a soap that turned out to be dish soap.', 'Every meal I eat goes cold while I film it.'],
      es: ['Tengo once mil seguidores. Doce los días buenos.', 'Hice un canje de skincare con un jabón que era detergente.', 'Toda la comida se me enfría mientras la filmo.'],
    },
    diary: {
      en: `Content ideas: morning routine (fake), call with a "brand" tonight. Google code keeps coming, maybe it is the verification!!`,
      es: `Ideas: rutina de mañana (fake), llamada con una "marca" hoy. Me siguen llegando códigos de Google, ¡¿será la verificación?!`,
    },
    os: `LuOS Filtro`,
  },
  {
    id: 'ramon',
    name: `Don Ramón Etcheverry`,
    title: { en: `Rancher, 69`, es: `Productor de campo, 69` },
    look: { build: 'broad', skin: '#e0a77e', shirt: { style: 'buttonup', color: '#f6f1e3' }, pants: { color: '#4a3a2a', style: 'jeans' }, face: { preset: 5 }, hair: 'sidepart', hairColor: '#d8d4e2', hat: 'cowboy', mustache: true, headset: false, shoes: { style: 'dress', color: '#3a2410' } },
    voice: { gender: 'male', age: 'old', pitch: 0.8, rate: 0.85, style: 'gruff' },
    bio: `A 69-year-old rancher who lives in the countryside, speaks slowly and distrusts city folks and technology. Loves talking about the weather, his cows and the price of corn.`,
    quirk: { en: `Talk to him about the countryside: weather, cows, harvests.`, es: `Hablale del campo: el clima, las vacas, la cosecha.` },
    quirkKeys: { words: ['vaca', 'vacas', 'cow', 'cows', 'campo', 'farm', 'ranch', 'lluvia', 'rain', 'cosecha', 'harvest', 'clima', 'weather', 'maiz', 'corn', 'ternero', 'calf', 'tractor'] },
    dislikes: ['app', 'aplicacion', 'link', 'enlace', 'online', 'internet', 'descarg', 'download', 'mail'],
    sus: { detail: 1.2, authority: 1.0, politeness: 1.0, family: 1.0, empathy: 0.8, fear: 0.6, flattery: 0.4, reward: 0.2, urgency: -0.8, tech: -1.0, secrecy: 0.2 },
    guard: 4, data: ['bank', 'ssn'], pwWords: ['LAPAMPA', 'TERNERO', 'LLUVIA'], wealth: [100, 260],
    opener: { en: `Speak. Who calls at this hour? The cows are already asleep.`, es: `Diga. ¿Quién llama a esta hora? Las vacas ya duermen.` },
    tics: {
      en: ['Mm.', 'Let me think, son.', 'Slowly, slowly.', 'Back in my day...', 'Well, well.'],
      es: ['Mm.', 'Dejame pensar, m\'hijo.', 'Despacito.', 'En mis tiempos...', 'Bueno, bueno.'],
    },
    about: {
      en: ['It has not rained in forty days. The ground is cracking.', 'I have a cow named Teresa who opens gates.', 'The city makes me dizzy. Too many traffic lights.'],
      es: ['Hace cuarenta días que no llueve. Se raja la tierra.', 'Tengo una vaca, la Teresa, que abre tranqueras.', 'La ciudad me marea. Demasiados semáforos.'],
    },
    diary: {
      en: `Bank password written on the calendar, behind the photo of Teresa (the cow). My nephew said not to do that.`,
      es: `La clave del banco anotada en el almanaque, atrás de la foto de la Teresa (la vaca). Mi sobrino dijo que no haga eso.`,
    },
    os: `PampaOS`,
  },
  {
    id: 'gerardo',
    name: `Gerardo "el Tío" Paz`,
    title: { en: `Conspiracy uncle, 58`, es: `Tío conspiranoico, 58` },
    look: { build: 'heavy', skin: '#7bd36a', shirt: { style: 'hoodie', color: '#2c3a5a' }, pants: { color: '#3a3a40', style: 'jeans' }, face: { preset: 1 }, hair: 'curly', hairColor: '#5a3a22', beard: 'full', hat: 'beanie', headset: false },
    voice: { gender: 'male', age: 'adult', pitch: 0.9, rate: 1.05, style: 'dramatic' },
    bio: `A 58-year-old uncle who believes everything is a conspiracy: satellites, pigeons, the microwave. Paranoid about institutions but desperate to be believed; whoever agrees with his theories becomes his ally.`,
    quirk: { en: `Agree that "they" are watching and he trusts you blindly.`, es: `Dale la razón con que "nos vigilan" y te cree todo.` },
    quirkKeys: { words: ['conspiracion', 'conspiracy', 'nos vigilan', 'watching us', 'satelite', 'satellite', 'palomas', 'pigeons', 'tenes razon', 'you are right', "you're right", 'despertaste', 'woke up', 'no son pajaros', 'not real birds'] },
    dislikes: ['tranquilo', 'calm down', 'paranoico', 'paranoid', 'loco', 'crazy', 'exagerado', 'exaggerating'],
    sus: { fear: 1.2, empathy: 1.0, flattery: 0.8, urgency: 0.8, detail: 0.6, family: 0.6, reward: 0.5, politeness: 0.4, tech: 0.4, authority: -0.8, secrecy: 1.3 },
    guard: 0, data: ['ssn', 'card'], pwWords: ['PALOMA', 'AREA51', 'ANTENA'], wealth: [40, 160],
    opener: { en: `Who is this? How did you get this number? This line is tapped, just so you know.`, es: `¿Quién es? ¿Cómo conseguiste este número? Esta línea está pinchada, que lo sepas.` },
    tics: {
      en: ['Interesting... very interesting.', 'Lower your voice.', 'I knew it.', 'Did you hear that click?', 'Hmm. Suspicious.'],
      es: ['Interesante... muy interesante.', 'Bajá la voz.', 'Lo sabía.', '¿Escuchaste ese clic?', 'Mmm. Sospechoso.'],
    },
    about: {
      en: ['Pigeons are drones. Look at their eyes.', 'I wrap my router in foil every night.', 'My brother-in-law says I exaggerate. He works for "them".'],
      es: ['Las palomas son drones. Miralas a los ojos.', 'Envuelvo el router en papel aluminio todas las noches.', 'Mi cuñado dice que exagero. Trabaja para "ellos".'],
    },
    diary: {
      en: `Log #448: the pigeons changed shifts at 6:12. I keep my card in the freezer so they cannot scan it.`,
      es: `Registro 448: las palomas cambiaron de turno a las 6:12. Guardo la tarjeta en el freezer para que no la escaneen.`,
    },
    os: `TinfoilOS`,
  },
  {
    id: 'sofia',
    name: `Sofía Benítez`,
    title: { en: `Law student, 23 (tough one)`, es: `Estudiante de abogacía, 23 (difícil)` },
    look: { build: 'slim', fem: 1, skin: '#5aa0ff', shirt: { style: 'buttonup', color: '#2c3a5a' }, pants: { color: '#1f2a44', style: 'slacks' }, face: { preset: 3 }, hair: 'curly', hairColor: '#1c1410', glasses: 'square', headset: false },
    voice: { gender: 'female', age: 'young', pitch: 1.0, rate: 1.05, style: null },
    bio: `A 23-year-old law student who is very skeptical, quotes consumer-protection rules and asks for everything in writing. Only trusts verifiable-sounding details like full names, case numbers and employee IDs. Pressure makes her more suspicious.`,
    quirk: { en: `Only trusts "verifiable" details: full name, case number, employee ID.`, es: `Solo confía en datos "verificables": nombre completo, número de caso, legajo.` },
    quirkKeys: { words: ['legajo', 'numero de caso', 'case number', 'employee id', 'id de empleado', 'expediente', 'file number', 'nombre completo', 'full name', 'por escrito', 'in writing'] },
    dislikes: ['urgente', 'urgent', 'ahora mismo', 'right now', 'bloque', 'blocked', 'multa', 'fine', 'policia', 'police'],
    sus: { detail: 1.6, politeness: 0.8, empathy: 0.5, authority: 0.4, tech: 0.4, family: 0.3, flattery: 0.2, reward: -0.4, fear: -0.8, urgency: -1.0, secrecy: -1.0 },
    guard: 8, data: ['google', 'bank'], pwWords: ['CODIGO', 'CIVIL', 'LEX'], wealth: [20, 90],
    opener: { en: `Hi. Before you say anything: full name and employee ID?`, es: `Hola. Antes de que digas nada: ¿nombre completo y número de legajo?` },
    tics: {
      en: ['Noted.', 'Let me write that down.', 'Hmm, objection.', 'Interesting.', 'Go on.'],
      es: ['Anotado.', 'Dejame que lo anoto.', 'Mmm, objeción.', 'Interesante.', 'Seguí.'],
    },
    about: {
      en: ['I have a civil law exam on Monday.', 'I already reported two fake calls this month.', 'My roommate fell for a fake prize once. Never again.'],
      es: ['El lunes rindo Civil.', 'Este mes ya denuncié dos llamadas truchas.', 'Mi compañera de depto cayó una vez con un premio falso. Nunca más.'],
    },
    diary: {
      en: `Study plan: contracts, torts. Bank password changed monthly. Never read codes to anyone.`,
      es: `Plan de estudio: contratos, daños. Clave del banco cambiada cada mes. Nunca leerle códigos a nadie.`,
    },
    os: `LexOS`,
  },
  {
    id: 'walter',
    formal: true, // talks to the caller as "usted"
    name: `Walter Insaurralde`,
    title: { en: `Accountant, 47`, es: `Contador, 47` },
    look: { build: 'average', skin: '#eec0a0', shirt: { style: 'buttonup', color: '#f6f1e3' }, pants: { color: '#3a3a40', style: 'slacks' }, tie: '#2c3a5a', face: { preset: 0 }, hair: 'sidepart', hairColor: '#3b2416', glasses: 'round', headset: false, shoes: { style: 'dress', color: '#1a1410' } },
    voice: { gender: 'male', age: 'adult', pitch: 0.98, rate: 0.98, style: null },
    bio: `A 47-year-old accountant obsessed with numbers, precision and spreadsheets. Corrects any number you say. Trusts people who sound precise and give exact figures; vague talk annoys him.`,
    quirk: { en: `Trusts exact figures: amounts with cents, precise numbers.`, es: `Confía en las cifras exactas: montos con centavos, números precisos.` },
    quirkKeys: { words: ['exacto', 'exactly', 'preciso', 'precise', 'planilla', 'spreadsheet', 'balance', 'centavos', 'cents', 'decimal'] },
    dislikes: ['mas o menos', 'more or less', 'aproximadamente', 'approximately', 'redondeando', 'round about', 'tipo', 'kinda'],
    sus: { detail: 1.5, authority: 0.9, tech: 0.7, politeness: 0.6, fear: 0.6, reward: 0.6, flattery: 0.5, empathy: 0.3, family: 0.3, urgency: 0.2, secrecy: 0.4 },
    guard: 4, data: ['bank', 'card'], pwWords: ['BALANCE', 'DEBE', 'HABER'], wealth: [80, 220],
    opener: { en: `Insaurralde, accounting. You have ninety seconds. Timed.`, es: `Insaurralde, contabilidad. Tiene noventa segundos. Cronometrados.` },
    tics: {
      en: ['Correction:', 'Mm, let me check.', 'Precisely.', 'Decimal places, please.', 'Noted, to the cent.'],
      es: ['Corrijo:', 'Mm, dejeme verificar.', 'Precisamente.', 'Decimales, por favor.', 'Anotado, al centavo.'],
    },
    about: {
      en: ['I balance my personal spreadsheet every night at 23:59.', 'My cat is named Debit. The other one, Credit.', 'I once found a one-cent error. Best week of my life.'],
      es: ['Cuadro mi planilla personal todas las noches a las 23:59.', 'Mi gato se llama Debe. La otra, Haber.', 'Una vez encontré un error de un centavo. La mejor semana de mi vida.'],
    },
    diary: {
      en: `Expenses: 0.00 unexplained. Bank password stored in cell B7 of "Personal.xls". Hidden column. Very safe.`,
      es: `Gastos: 0,00 sin justificar. Clave del banco en la celda B7 de "Personal.xls". Columna oculta. Muy seguro.`,
    },
    os: `Planilla 2003`,
  },
  {
    id: 'pato',
    formal: true, // talks to the caller as "usted"
    name: `Patricia "Pato" Villalba`,
    title: { en: `Civil servant, 52`, es: `Empleada pública, 52` },
    look: { build: 'heavy', fem: 1, skin: '#ff7eb3', shirt: { style: 'cardigan', color: '#ff4d5e' }, pants: { color: '#2b2550', style: 'slacks' }, face: { preset: 2 }, hair: 'bob', hairColor: '#3b2416', glasses: 'round', headset: false, shoes: { style: 'dress', color: '#3a2410' } },
    voice: { gender: 'female', age: 'adult', pitch: 0.95, rate: 0.92, style: null },
    bio: `A 52-year-old government office clerk who loves procedures, forms and stamps, and answers with bureaucratic phrases. Trusts anything that sounds like an official procedure with a file number; informality offends her.`,
    quirk: { en: `Follow "the procedure": file numbers, forms, stamps.`, es: `Seguí "el procedimiento": expediente, formulario, sello.` },
    quirkKeys: { words: ['tramite', 'procedure', 'formulario', 'form', 'expediente', 'file number', 'sello', 'stamp', 'resolucion', 'resolution', 'por duplicado', 'in duplicate', 'mesa de entradas'] },
    dislikes: ['che', 'boluda', 'whatever', 'dale', 'informal', 'tipo que'],
    sus: { authority: 1.5, detail: 1.2, politeness: 1.0, fear: 0.7, flattery: 0.5, empathy: 0.4, family: 0.4, reward: 0.3, tech: 0.2, urgency: -0.3, secrecy: 0.2 },
    guard: 2, data: ['ssn', 'bank', 'google'], pwWords: ['SELLO', 'TRAMITE', 'PATO'], wealth: [60, 170],
    opener: { en: `Good evening. Front desk, Villalba. Do you have a file number?`, es: `Buenas noches. Mesa de entradas, Villalba. ¿Tiene número de expediente?` },
    tics: {
      en: ['Mm-hm. In duplicate.', 'Let me stamp that.', 'Per regulation...', 'One moment, I am filing.', 'Very irregular.'],
      es: ['Ajá. Por duplicado.', 'Déjeme que le pongo el sello.', 'Según la normativa...', 'Un momento, estoy archivando.', 'Muy irregular.'],
    },
    about: {
      en: ['I have seven stamps. My favorite says RECEIVED.', 'Twenty-six years at the same desk. Same chair.', 'My mate gourd has a file number.'],
      es: ['Tengo siete sellos. Mi favorito dice RECIBIDO.', 'Veintiséis años en el mismo escritorio. Misma silla.', 'Mi mate tiene número de expediente.'],
    },
    diary: {
      en: `Form 7B: pending. Bank password filed under "B" for bank. Google codes go in the "pending" tray.`,
      es: `Formulario 7B: pendiente. La clave del banco archivada en la "B" de banco. Los códigos de Google van a la bandeja de "pendientes".`,
    },
    os: `SelloOS`,
  },
  {
    id: 'johnny',
    name: `Jonathan "Johnny" Suárez`,
    title: { en: `Personal trainer, 30`, es: `Personal trainer, 30` },
    look: { build: 'broad', skin: '#ff8a3d', shirt: { style: 'tee', color: '#ff4d5e' }, pants: { color: '#1a1a22', style: 'slacks' }, face: { preset: 1, stubble: true }, hair: 'buzz', hairColor: '#1c1410', headset: false },
    voice: { gender: 'male', age: 'young', pitch: 0.95, rate: 1.1, style: null },
    bio: `A 30-year-old personal trainer who mentions protein, gains and leg day in every sentence. Super friendly and enthusiastic, calls everyone "champ". Trusts anyone who talks fitness with him.`,
    quirk: { en: `Talk gym, protein or leg day with him.`, es: `Hablale de gimnasio, proteína o día de piernas.` },
    quirkKeys: { words: ['gym', 'gimnasio', 'proteina', 'protein', 'entren', 'training', 'pesas', 'weights', 'musculo', 'muscle', 'fierros', 'leg day', 'piernas', 'sentadilla', 'squat', 'crossfit'] },
    dislikes: ['carbohidrato', 'carbs', 'pizza', 'facturas', 'sedentario', 'couch potato', 'helado', 'ice cream'],
    sus: { flattery: 1.3, reward: 1.0, empathy: 0.9, fear: 0.7, urgency: 0.6, authority: 0.6, politeness: 0.6, family: 0.6, detail: 0.3, tech: 0.3, secrecy: 0.6 },
    guard: -2, data: ['card', 'google'], pwWords: ['PROTEINA', 'BICEPS', 'LEGDAY'], wealth: [50, 160],
    opener: { en: `Hey, champ! Johnny here, between sets. What do you need?`, es: `¡Ey, campeón! Johnny al habla, estoy entre series. ¿Qué necesitás?` },
    tics: {
      en: ['Let\'s go!', 'Nice, nice.', 'One more rep...', 'Champ!', 'Breathe, breathe.'],
      es: ['¡Vamos!', 'Bien, bien.', 'Una repe más...', '¡Campeón!', 'Respirá, respirá.'],
    },
    about: {
      en: ['I eat twelve eggs a day. My neighbors hate me.', 'Never skip leg day. Never.', 'My dog does planks with me. Well, he lies down.'],
      es: ['Como doce huevos por día. Mis vecinos me odian.', 'Nunca saltees el día de piernas. Nunca.', 'Mi perro hace planchas conmigo. Bueno, se acuesta.'],
    },
    diary: {
      en: `Week plan: push, pull, legs. Card is on file at the supplement store. Protein order Friday.`,
      es: `Plan semanal: empuje, tirón, piernas. La tarjeta está guardada en la tienda de suplementos. Pedido de proteína el viernes.`,
    },
    os: `GymOS`,
  },
  {
    id: 'matias',
    name: `Matías Montedoodoo`,
    title: { en: `Indie game dev, coding at 3 a.m.`, es: `Desarrollador indie, programando a las 3 a.m.` },
    look: { build: 'average', skin: '#ffb347', shirt: { style: 'hoodie', color: '#2c3a5a' }, pants: { color: '#1a1a22', style: 'jeans' }, face: { preset: 0, stubble: true }, hair: 'crop', hairColor: '#3b2416', headset: true },
    voice: { gender: 'male', age: 'adult', pitch: 1.0, rate: 1.05, style: null },
    bio: `An indie game developer coding at 3 a.m. who answers while compiling his own party game. Distracted and enthusiastic, talks about bugs, ragdolls and playtests. Trusts anyone who loves video games or offers to playtest.`,
    quirk: { en: `Talk video games, game dev or offer to playtest his game.`, es: `Hablale de videojuegos o ofrecete a probar su juego.` },
    quirkKeys: { words: ['videojuego', 'video game', 'gamedev', 'playtest', 'probar tu juego', 'test your game', 'indie', 'steam', 'ragdoll', 'compilar', 'compile', 'programar', 'coding'] },
    dislikes: ['crash', 'se colgo', 'pantalla azul', 'blue screen', 'lag', 'se rompio', 'it broke'],
    sus: { tech: 1.4, flattery: 1.1, reward: 0.9, empathy: 0.8, detail: 0.7, politeness: 0.6, fear: 0.5, urgency: 0.4, family: 0.4, authority: 0.3, secrecy: 0.5 },
    guard: 0, data: ['google', 'card', 'bank'], pwWords: ['DOODOO', 'COMPILA', 'RAGDOLL'], wealth: [40, 150],
    opener: { en: `Hello? Hold on, I'm compiling... Yeah, go ahead, who is this?`, es: `¿Hola? Pará que estoy compilando... Sí, decime, ¿quién es?` },
    tics: {
      en: ['Wait, wait, it compiled.', 'Mm-hm, mm-hm.', 'Sorry, a ragdoll just flew off the map.', 'Okay, go on.', 'Classic.'],
      es: ['Pará, pará, compiló.', 'Ajá, ajá.', 'Perdón, un ragdoll salió volando del mapa.', 'Bueno, dale.', 'Clásico.'],
    },
    about: {
      en: ['I am making a game where friends work at a call center. Long story.', 'I have not slept since the last update.', 'My ragdolls keep peeing through the floor. It is a feature now.'],
      es: ['Estoy haciendo un juego donde unos amigos laburan en un call center. Larga historia.', 'No duermo desde la última actualización.', 'Mis ragdolls hacen pis a través del piso. Ahora es una feature.'],
    },
    diary: {
      en: `TODO: fix ragdoll, fix pee, fix sleep. Bank password: same as my first project, obviously.`,
      es: `TODO: arreglar ragdoll, arreglar pis, arreglar sueño. Clave del banco: la misma que mi primer proyecto, obvio.`,
    },
    os: `DoodooOS Dev`,
  },
  {
    id: 'nelly',
    name: `Abuela Nelly`,
    title: { en: `Sweet grandma with eleven cats`, es: `Abuelita dulce con once gatos` },
    look: { build: 'average', fem: 1, skin: '#a77bff', shirt: { style: 'cardigan', color: '#c78bff' }, pants: { color: '#3a2a5a', style: 'slacks' }, face: { preset: 4 }, hair: 'bun', hairColor: '#d8d4e2', glasses: 'round', extras: ['pearls'], headset: false, shoes: { style: 'dress', color: '#5a3a22' } },
    voice: { gender: 'female', age: 'old', pitch: 1.12, rate: 0.9, style: 'sweet' },
    bio: `A sweet grandma with eleven cats who knits while she talks and loses her glasses every five minutes. Chatty and slow; adores anyone patient who asks about her cats or her knitting.`,
    quirk: { en: `Ask about her eleven cats or what she is knitting.`, es: `Preguntale por sus once gatos o por lo que está tejiendo.` },
    quirkKeys: { words: ['gatos', 'gato', 'cats', 'cat', 'tejer', 'tejiendo', 'tejido', 'knit', 'knitting', 'bufanda', 'scarf', 'lana', 'yarn', 'ovillo'] },
    dislikes: ['apurate', 'rapido', 'vieja', 'hurry', 'old lady', 'come on'],
    sus: { politeness: 1.3, empathy: 1.3, family: 1.2, flattery: 0.9, reward: 0.8, fear: 0.8, authority: 0.7, detail: 0.5, secrecy: 0.5, urgency: -0.4, tech: -0.5 },
    guard: 0, data: ['card', 'ssn'], pwWords: ['BIGOTES', 'OVILLO', 'NELLY'], wealth: [60, 140],
    opener: { en: `Hellooo, dearie! Oh, a phone call, how exciting. Let me just turn down my radio.`, es: `¡Holaaa, querido! Ay, una llamada, qué emoción. Dejame bajar la radio.` },
    tics: {
      en: ['Oh, dearie, say that again?', 'Mr. Whiskers, get off the keyboard!', 'Where did I put my glasses?', 'Speak up, sweetie, the kettle is singing.'],
      es: ['Ay, querido, ¿me lo repetís?', '¡Señor Bigotes, bajate del teclado!', '¿Dónde dejé mis anteojos?', 'Hablá más fuerte, tesoro, está silbando la pava.'],
    },
    about: {
      en: ['I have eleven cats. Twelve if you count the vacuum.', 'Mr. Whiskers is the boss of the house. I just pay the bills.', 'I knit while I talk. Long calls make long scarves.'],
      es: ['Tengo once gatos. Doce si contás la aspiradora.', 'El Señor Bigotes es el jefe de la casa. Yo solo pago las cuentas.', 'Tejo mientras hablo. Llamadas largas, bufandas largas.'],
    },
    diary: {
      en: `Dear diary: finished scarf number 43. Mr. Whiskers ate a ball of yarn. The card is in the cookie tin, as always.`,
      es: `Querido diario: terminé la bufanda número 43. El Señor Bigotes se comió un ovillo. La tarjeta está en la lata de galletitas, como siempre.`,
    },
    os: `NellyNet 2.0`,
  },
  {
    id: 'chola',
    name: `Doña Chola Benavídez`,
    title: { en: `Neighborhood hairdresser, 63`, es: `Peluquera de barrio, 63` },
    look: { build: 'average', fem: 1, skin: '#ff7eb3', shirt: { style: 'tee', color: '#c78bff' }, pants: { color: '#2b2550', style: 'slacks' }, face: { preset: 2 }, hair: 'curly', hairColor: '#a33a1e', glasses: 'round', extras: ['pearls'], headset: false, shoes: { style: 'dress', color: '#8b1e2e' } },
    voice: { gender: 'female', age: 'adult', pitch: 1.1, rate: 1.15, style: null },
    bio: `A 63-year-old neighborhood hairdresser who knows everyone's business. Talks nonstop while dyeing a client's hair, loves gossip and soap operas, cannot keep a secret but adores being told one.`,
    quirk: { en: `Tell her some juicy gossip (or a secret) and she is yours.`, es: `Contale un chisme jugoso (o un secreto) y es tuya.` },
    quirkKeys: { words: ['chisme', 'chusmerio', 'te cuento', 'novela', 'telenovela', 'secreto', 'gossip', 'rumor', 'soap opera', 'did you hear', 'viste que'] },
    dislikes: ['espere', 'escucheme', 'escuchame', 'no me interrumpa', 'callese', 'wait', 'listen to me', 'be quiet'],
    sus: { secrecy: 1.4, empathy: 1.2, flattery: 1.2, family: 1.0, fear: 0.8, reward: 0.8, politeness: 0.6, authority: 0.6, detail: 0.4, urgency: 0.2, tech: -0.4 },
    guard: 0, data: ['card', 'bank'], pwWords: ['CHOLA', 'RULOS', 'TINTURA'], wealth: [50, 160],
    opener: { en: `Chola's Salon, what do you need, sweetheart? I have a client with the dye on.`, es: `Peluquería Chola, ¿qué necesitás, corazón? Tengo una clienta con la tintura puesta.` },
    tics: {
      en: ['Ay, sweetheart.', 'Wait, wait, tell me everything.', 'No! Really?', 'Mirta, rinse in five.', 'Between you and me...'],
      es: ['Ay, corazón.', 'Pará, pará, contame todo.', '¡No! ¿En serio?', 'Mirta, en cinco te enjuago.', 'Acá entre nos...'],
    },
    about: {
      en: ['Thirty years doing hair on this block. I know every secret.', 'The lady from the bakery is dating the mailman. You did not hear it from me.', 'I never miss my soap opera. Tonight someone gets amnesia, I can feel it.'],
      es: ['Treinta años peinando en esta cuadra. Sé todos los secretos.', 'La de la panadería sale con el cartero. Yo no te dije nada.', 'No me pierdo la novela. Hoy alguien pierde la memoria, lo presiento.'],
    },
    diary: {
      en: `Clients today: 9. Gossip collected: 14. The card PIN is the year I opened the salon, I will never forget it.`,
      es: `Clientas hoy: 9. Chismes juntados: 14. La clave de la tarjeta es el año que abrí la peluquería, nunca me la olvido.`,
    },
    os: `RulosOS`,
    photo: { en: `A wall of hair dye boxes and a gossip magazine.`, es: `Una pared de cajas de tintura y una revista de chimentos.` },
    wall: 'linear-gradient(160deg,#ff7eb3,#2b2550)',
  },
  {
    id: 'bruno',
    name: `Bruno "el Chef" Marchetti`,
    title: { en: `Diner cook, 45`, es: `Cocinero de bodegón, 45` },
    look: { build: 'heavy', skin: '#ff8a3d', shirt: { style: 'buttonup', color: '#f6f1e3' }, pants: { color: '#1a1a22', style: 'slacks' }, face: { preset: 1 }, hair: 'slick', hairColor: '#1c1410', mustache: true, headset: false, shoes: { style: 'sneaker', color: '#1a1a22' } },
    voice: { gender: 'male', age: 'adult', pitch: 0.9, rate: 1.12, style: 'gruff' },
    bio: `A 45-year-old cook who runs the kitchen of a busy old-school diner. Answers while yelling orders, pans sizzling in the background. Proud and touchy about his food; melts when you praise his cooking or talk recipes.`,
    quirk: { en: `Praise his cooking or talk recipes with him.`, es: `Elogiá su comida o hablale de recetas.` },
    quirkKeys: { words: ['milanesa', 'receta', 'recipe', 'asado', 'salsa', 'cocina', 'cocinar', 'cooking', 'comida', 'food', 'plato', 'dish', 'bodegon', 'diner', 'napolitana'] },
    dislikes: ['microondas', 'microwave', 'comida rapida', 'fast food', 'congelado', 'frozen', 'dieta', 'diet'],
    sus: { flattery: 1.3, reward: 0.9, urgency: 0.9, fear: 0.7, family: 0.6, authority: 0.5, detail: 0.4, empathy: 0.4, secrecy: 0.4, politeness: 0.3, tech: -0.4 },
    guard: 2, data: ['card', 'bank'], pwWords: ['MILANGA', 'NAPO', 'BRUNO'], wealth: [60, 180],
    opener: { en: `Marchetti's Diner! Talk fast, my cutlets are burning!`, es: `¡Bodegón Marchetti! ¡Hablá rápido que se me queman las milanesas!` },
    tics: {
      en: ['Two napolitanas, table six!', 'Hot, hot, coming through!', 'Go on, go on.', 'Who touched my salt?', 'Ay, the oil.'],
      es: ['¡Dos napolitanas para la seis!', '¡Caliente, caliente, permiso!', 'Dale, dale.', '¿Quién me tocó la sal?', 'Ay, el aceite.'],
    },
    about: {
      en: [`My grandmother's sauce recipe is locked in a safe. Literally.`, 'Twenty years at the grill. These arms have seen things.', 'A customer once asked for ketchup on the pasta. I still think about it.'],
      es: ['La receta de la salsa de mi nona está en una caja fuerte. Literal.', 'Veinte años en la plancha. Estos brazos vieron cosas.', 'Una vez un cliente pidió kétchup para los fideos. Todavía lo pienso.'],
    },
    diary: {
      en: `Order: 40 kg of flour, eggs, breadcrumbs. Bank password: same as the safe with the sauce. Do NOT forget.`,
      es: `Pedido: 40 kilos de harina, huevos, pan rallado. Clave del banco: la misma de la caja fuerte de la salsa. NO olvidar.`,
    },
    os: `BodegónOS`,
    photo: { en: `A tower of golden breaded cutlets, perfect.`, es: `Una torre de milanesas doradas, perfectas.` },
    wall: 'linear-gradient(160deg,#ff9f6b,#4a3a2a)',
  },
  {
    id: 'vale',
    name: `Valentina "Vale" Quiroga`,
    title: { en: `Night-shift nurse, 24`, es: `Enfermera de guardia, 24` },
    look: { build: 'slim', fem: 1, skin: '#3fc7b0', shirt: { style: 'tee', color: '#4dd6ff' }, pants: { color: '#1f2a44', style: 'slacks' }, face: { preset: 3 }, hair: 'ponytail', hairColor: '#3b2416', headset: false, shoes: { style: 'sneaker', color: '#f6f1e3' } },
    voice: { gender: 'female', age: 'young', pitch: 1.05, rate: 1.0, style: null },
    bio: `A 24-year-old nurse on the night shift at a clinic, exhausted, drinking mate between rounds. Kind and practical, used to staying calm in emergencies; softens when someone thanks her for her work.`,
    quirk: { en: `Thank her for her work as a nurse; she rarely hears it.`, es: `Agradecele su trabajo de enfermera; casi nunca se lo dicen.` },
    quirkKeys: { words: ['enfermera', 'enfermero', 'nurse', 'guardia', 'night shift', 'gracias por tu trabajo', 'thank you for your work', 'clinica', 'clinic', 'heroe', 'heroina', 'hero'] },
    dislikes: ['no sea exagerada', 'no seas exagerada', 'calm down', 'tranquilizate', 'relajate', 'histerica'],
    sus: { empathy: 1.4, family: 1.2, politeness: 0.8, fear: 0.6, detail: 0.6, authority: 0.5, flattery: 0.5, reward: 0.3, tech: 0.3, urgency: -0.4, secrecy: -0.3 },
    guard: 2, data: ['google', 'bank'], pwWords: ['GUARDIA', 'MATE', 'VALE'], wealth: [30, 110],
    opener: { en: `Hello? I'm on a night shift, I have one minute. Who is it?`, es: `¿Hola? Estoy de guardia, tengo un minuto. ¿Quién es?` },
    tics: {
      en: [`Bed four, I'm coming!`, 'Mm-hm.', 'Sorry, my mate went cold.', 'Okay, go on.', 'Deep breath...'],
      es: ['¡Cama cuatro, ya voy!', 'Ajá.', 'Perdón, se me enfrió el mate.', 'Bueno, seguí.', 'Respiro hondo...'],
    },
    about: {
      en: [`Twelve-hour shift and I'm only halfway.`, 'I sleep in the mornings, with three alarms and a pillow on my face.', 'Tonight I talked a man out of eating his own cast. Long night.'],
      es: ['Guardia de doce horas y voy por la mitad.', 'Duermo de mañana, con tres alarmas y la almohada en la cara.', 'Hoy convencí a un señor de que no se comiera el yeso. Noche larga.'],
    },
    diary: {
      en: `Shift notes: bed 4 wants pudding, bed 7 says he is a vampire (?). The home banking password is on a sticky note in my locker.`,
      es: `Notas de guardia: la cama 4 quiere flan, la 7 dice que es vampiro (?). La clave del home banking está en un papelito en mi casillero.`,
    },
    os: `GuardiaOS`,
    photo: { en: `A thermos, a mate gourd and a stethoscope.`, es: `Un termo, un mate y un estetoscopio.` },
    wall: 'linear-gradient(160deg,#4dd6ff,#1f2a44)',
  },
  {
    id: 'anselmo',
    formal: true, // talks to the caller as "usted"
    name: `Don Anselmo Ferreyra`,
    title: { en: `Retired watchmaker, 81`, es: `Relojero jubilado, 81` },
    look: { build: 'slim', skin: '#ffd84d', shirt: { style: 'sweater', color: '#8b1e2e' }, pants: { color: '#4a3a2a', style: 'slacks' }, face: { preset: 4 }, hair: 'balding', hairColor: '#d8d4e2', glasses: 'round', mustache: true, headset: false, shoes: { style: 'dress', color: '#4a3a2a' } },
    voice: { gender: 'male', age: 'old', pitch: 0.85, rate: 0.82, style: 'posh' },
    bio: `An 81-year-old retired watchmaker: exact, slow and extremely polite. Lives by the clock, hates being rushed, and admires anyone who is punctual and precise.`,
    quirk: { en: `Be precise and talk about watches or the exact time.`, es: `Sé preciso y hablale de relojes o de la hora exacta.` },
    quirkKeys: { words: ['reloj', 'relojes', 'watch', 'clock', 'hora exacta', 'exact time', 'puntual', 'punctual', 'engranaje', 'gear', 'cuerda', 'en punto', 'sharp'] },
    dislikes: ['apurate', 'apurese', 'rapido', 'dale', 'ya mismo', 'hurry', 'quick', 'come on', 'right now'],
    sus: { politeness: 1.5, detail: 1.3, authority: 1.0, empathy: 0.9, family: 0.8, fear: 0.7, flattery: 0.5, secrecy: 0.3, reward: 0.2, tech: -0.8, urgency: -1.0 },
    guard: 4, data: ['ssn', 'bank'], pwWords: ['CUERDA', 'TICTAC', 'ANSELMO'], wealth: [80, 200],
    opener: { en: `Ferreyra residence. It is eleven and four minutes. Whom do I have the pleasure of speaking with?`, es: `Casa Ferreyra. Son las once y cuatro minutos. ¿Con quién tengo el gusto?` },
    tics: {
      en: ['Mm, let us see.', 'Slowly, please.', 'Exactly.', 'One moment, the cuckoo.', 'In my day...'],
      es: ['Mm, veamos.', 'Despacio, por favor.', 'Exactamente.', 'Un momento, el cucú.', 'En mis tiempos...'],
    },
    about: {
      en: ['I have forty-two clocks at home. At noon they all chime at once.', 'Sixty years fixing watches. I never lost a single screw.', 'My wife says I arrive early even to my own birthday.'],
      es: ['Tengo cuarenta y dos relojes en casa. A mediodía suenan todos juntos.', 'Sesenta años arreglando relojes. Nunca perdí un tornillo.', 'Mi esposa dice que llego temprano hasta a mi cumpleaños.'],
    },
    diary: {
      en: `Wound all 42 clocks at 7:00 sharp. My Social Security number is engraved on the back of the pocket watch, in case I forget.`,
      es: `Di cuerda a los 42 relojes a las 7:00 en punto. El número de Seguro Social está grabado atrás del reloj de bolsillo, por si me olvido.`,
    },
    os: `TicTacOS`,
    photo: { en: `A wall of clocks, all showing exactly the same time.`, es: `Una pared de relojes, todos con la misma hora exacta.` },
    wall: 'linear-gradient(160deg,#ffd84d,#4a3a2a)',
  },
  {
    id: 'yesi',
    name: `Yésica "Yesi" Ledesma`,
    title: { en: `Catalog cosmetics reseller, 35`, es: `Revendedora de cosméticos por catálogo, 35` },
    look: { build: 'average', fem: 1, skin: '#ffb347', shirt: { style: 'cardigan', color: '#ff4d5e' }, pants: { color: '#1f2a44', style: 'jeans' }, face: { preset: 2 }, hair: 'long', hairColor: '#e2c27a', headset: false, shoes: { style: 'dress', color: '#ff4d5e' } },
    voice: { gender: 'female', age: 'adult', pitch: 1.12, rate: 1.18, style: 'quirky' },
    bio: `A 35-year-old catalog cosmetics reseller who turns every conversation into a sales pitch. Bubbly and pushy, always trying to sell you a cream; trusts anyone who places an order.`,
    quirk: { en: `Order something from her catalog and she will love you.`, es: `Pedile algo del catálogo y te va a amar.` },
    quirkKeys: { words: ['catalogo', 'catalog', 'pedido', 'order', 'crema', 'cream', 'perfume', 'revendedora', 'reseller', 'te compro', 'i will buy', "i'll buy", 'labial', 'lipstick'] },
    dislikes: ['no me interesa', 'not interested', 'caro', 'expensive', 'no compro', 'no thanks', 'no gracias'],
    sus: { reward: 1.3, flattery: 1.1, empathy: 0.9, urgency: 0.7, politeness: 0.6, secrecy: 0.6, family: 0.5, fear: 0.5, authority: 0.4, detail: 0.4, tech: 0.3 },
    guard: -2, data: ['card', 'google'], pwWords: ['BRILLO', 'CREMITA', 'YESI'], wealth: [40, 140],
    opener: { en: `Hi, hi! Calling about the new catalog? The anti-wrinkle cream is on sale.`, es: `¡Hola, hola! ¿Llamás por el catálogo nuevo? La crema antiarrugas está en oferta.` },
    tics: {
      en: ['Ay, I love it.', 'Write this down: page twelve.', 'Two for one, today only!', 'Uh-huh, uh-huh.', 'You have lovely skin, I can tell.'],
      es: ['Ay, me encanta.', 'Anotá: página doce.', '¡Dos por uno, solo hoy!', 'Ajá, ajá.', 'Tenés una piel divina, se nota.'],
    },
    about: {
      en: ['I once sold forty lipsticks at a wake. Respectfully.', 'My living room is a cream warehouse. The cat sleeps on the perfumes.', 'Top seller in the area three years running. I have a sash.'],
      es: ['Una vez vendí cuarenta labiales en un velorio. Con respeto.', 'Mi living es un depósito de cremas. El gato duerme arriba de los perfumes.', 'Mejor revendedora de la zona tres años seguidos. Tengo una banda.'],
    },
    diary: {
      en: `Orders: 12. People who owe me: lots. Google codes keep arriving, I think someone wants my reseller account.`,
      es: `Pedidos: 12. Me deben: un montón. Me siguen llegando códigos de Google, creo que alguien quiere mi cuenta de revendedora.`,
    },
    os: `BrilloOS`,
    photo: { en: `Boxes of cream stacked to the ceiling, with a cat on top.`, es: `Cajas de crema hasta el techo, con un gato arriba.` },
    wall: 'linear-gradient(160deg,#ff4d5e,#e2c27a)',
  },
  {
    id: 'eze',
    name: `Ezequiel "Eze" Nakamura`,
    title: { en: `Security-obsessed developer, 29 (tough)`, es: `Programador obsesionado con la seguridad, 29 (difícil)` },
    look: { build: 'slim', skin: '#5aa0ff', shirt: { style: 'hoodie', color: '#2c3a5a' }, pants: { color: '#1a1a22', style: 'jeans' }, face: { preset: 0 }, hair: 'quiff', hairColor: '#1c1410', glasses: 'square', headset: true, shoes: { style: 'sneaker', color: '#46e3a0' } },
    voice: { gender: 'male', age: 'young', pitch: 1.0, rate: 1.1, style: null },
    bio: `A 29-year-old developer obsessed with security: two-factor on everything, tape over the webcam. Smug and sharp; threats and "official" voices make him suspicious, but he cannot resist showing off when someone talks real tech with him.`,
    quirk: { en: `Talk real tech with him and let him show off.`, es: `Hablale de tecnología en serio y dejalo lucirse.` },
    quirkKeys: { words: ['cifrado', 'encryption', 'dos pasos', 'two-factor', '2fa', 'firmware', 'token', 'backend', 'linux', 'codigo abierto', 'open source', 'criptografia', 'cryptography'] },
    dislikes: ['reinicie', 'reinicia', 'restart', 'apague y prenda', 'apaga y prende', 'turn it off and on', 'hacker ruso', 'russian hacker'],
    sus: { detail: 1.2, flattery: 1.0, tech: 1.0, politeness: 0.3, reward: 0.3, empathy: 0.2, family: 0.2, secrecy: -0.5, fear: -0.6, authority: -0.6, urgency: -0.8 },
    guard: 8, data: ['google', 'bank'], pwWords: ['ROOT', 'SUDO', 'KERNEL'], wealth: [40, 150],
    opener: { en: `Who is this, and where did you get this number? Talk, I'm saving a log.`, es: `¿Quién habla y de dónde sacaste este número? Hablá, que estoy guardando un log.` },
    tics: {
      en: ['Hm. Noted.', 'Wait, I am checking the headers.', 'Classic.', 'Define "secure".', 'Go on, I am listening.'],
      es: ['Mm. Anotado.', 'Pará, que estoy mirando los encabezados.', 'Clásico.', 'Definí "seguro".', 'Seguí, te escucho.'],
    },
    about: {
      en: ['I have tape over my webcam and more tape over that tape.', 'My router has a firewall, and the firewall has a firewall.', 'I changed my password while you were talking. Twice.'],
      es: ['Tengo cinta en la cámara y otra cinta arriba de esa cinta.', 'Mi router tiene firewall y el firewall tiene firewall.', 'Cambié la contraseña mientras hablabas. Dos veces.'],
    },
    diary: {
      en: `TODO: rotate keys, update firmware, stop using the same bank password I have had since 2014 (tomorrow).`,
      es: `PENDIENTE: rotar claves, actualizar firmware, dejar de usar la misma clave del banco desde 2014 (mañana).`,
    },
    os: `Kernel Paranoico`,
    photo: { en: `Three monitors, a webcam covered in tape and a cold pizza.`, es: `Tres monitores, una cámara tapada con cinta y una pizza fría.` },
    wall: 'linear-gradient(160deg,#5aa0ff,#1a1a22)',
  },
  {
    id: 'rosita',
    name: `Rosa "Rosita" Gutiérrez`,
    title: { en: `Bingo-loving grandma, 74`, es: `Abuela fanática del bingo, 74` },
    look: { build: 'heavy', fem: 1, skin: '#a77bff', shirt: { style: 'sweater', color: '#46e3a0' }, pants: { color: '#3a3a40', style: 'slacks' }, face: { preset: 4 }, hair: 'curly', hairColor: '#d8d4e2', glasses: 'round', headset: false, shoes: { style: 'dress', color: '#2b2550' } },
    voice: { gender: 'female', age: 'old', pitch: 1.05, rate: 0.95, style: 'sweet' },
    bio: `A 74-year-old grandma who plays bingo four nights a week and believes her lucky day is always tomorrow. Cheerful and superstitious; anything about prizes, luck or lucky numbers lights her up.`,
    quirk: { en: `Talk about luck, bingo or lucky numbers.`, es: `Hablale de la suerte, el bingo o los números de la suerte.` },
    quirkKeys: { words: ['bingo', 'carton', 'suerte', 'luck', 'lucky', 'numero de la suerte', 'lucky number', 'loteria', 'lottery', 'quiniela', 'cabala'] },
    dislikes: ['mala suerte', 'bad luck', 'yeta', 'perdio', 'perdiste', 'you lost', 'martes 13'],
    sus: { reward: 1.6, family: 1.1, politeness: 1.0, empathy: 1.0, fear: 0.9, authority: 0.8, flattery: 0.7, detail: 0.5, secrecy: 0.5, urgency: 0.4, tech: -0.5 },
    guard: -2, data: ['card', 'ssn'], pwWords: ['BINGO', 'SUERTE', 'ROSITA'], wealth: [40, 130],
    opener: { en: `Hello? If it's the bingo hall, I already know I won! ...Didn't I? Who is this?`, es: `¿Hola? Si es del bingo, ¡ya sé que gané! ...¿No? ¿Quién habla?` },
    tics: {
      en: ['Ay, my lucky number!', 'Hold on, I am touching wood.', 'Oh dear, oh dear.', 'Bingo! No, sorry, force of habit.', 'Mm-hm, go on, dear.'],
      es: ['¡Ay, mi número de la suerte!', 'Esperá que toco madera.', 'Ay, ay, ay.', '¡Bingo! No, perdón, la costumbre.', 'Ajá, seguí, querido.'],
    },
    about: {
      en: ['I won a blender at bingo in 1998. It is still in the box.', 'My lucky number is 27. Also 14. And 3, on Thursdays.', 'I carry a lucky charm in each pocket. Seven pockets.'],
      es: ['En el 98 me gané una licuadora en el bingo. La tengo en la caja todavía.', 'Mi número de la suerte es el 27. Y el 14. Y el 3 los jueves.', 'Llevo una cábala en cada bolsillo. Siete bolsillos.'],
    },
    diary: {
      en: `Bingo on Tuesday, Wednesday, Friday and Sunday. The card number is written inside the lucky charm box, next to the four-leaf clover.`,
      es: `Bingo martes, miércoles, viernes y domingo. El número de la tarjeta está anotado en la cajita de las cábalas, al lado del trébol.`,
    },
    os: `BingOS`,
    photo: { en: `A table covered in bingo cards and lucky charms.`, es: `Una mesa llena de cartones de bingo y cábalas.` },
    wall: 'linear-gradient(160deg,#46e3a0,#2b2550)',
  },
  {
    id: 'marcos',
    name: `Marcos Villafañe`,
    title: { en: `Real estate agent, 44`, es: `Agente inmobiliario, 44` },
    look: { build: 'broad', skin: '#ff8a3d', shirt: { style: 'suit', color: '#2c3a5a' }, pants: { color: '#1f2a44', style: 'slacks' }, tie: '#ffd84d', face: { preset: 1 }, hair: 'slick', hairColor: '#3b2416', glasses: 'sun', headset: true, shoes: { style: 'dress', color: '#1a1410' } },
    voice: { gender: 'male', age: 'adult', pitch: 0.95, rate: 1.15, style: null },
    bio: `A 44-year-old real estate agent who is always "closing a deal". Talks in sales slogans, loves opportunities and investments, impatient with anyone who does not get to the point.`,
    quirk: { en: `Pitch him a business opportunity or an investment.`, es: `Proponele una oportunidad de negocio o una inversión.` },
    quirkKeys: { words: ['inversion', 'investment', 'negocio', 'business', 'oportunidad', 'opportunity', 'propiedad', 'property', 'departamento', 'apartment', 'rentabilidad', 'socio', 'partner'] },
    dislikes: ['crisis', 'perdida', 'loss', 'no hay plata', 'no money', 'barato', 'cheap'],
    sus: { reward: 1.2, flattery: 1.2, urgency: 1.0, secrecy: 0.8, detail: 0.8, authority: 0.7, tech: 0.4, politeness: 0.4, fear: 0.4, empathy: 0.3, family: 0.3 },
    guard: 2, data: ['bank', 'card'], pwWords: ['VENDIDO', 'METRO', 'CIERRE'], wealth: [100, 280],
    opener: { en: `Villafañe Properties: who doesn't invest today cries tomorrow. How can I help?`, es: `Villafañe Propiedades, el que no invierte hoy llora mañana. ¿En qué te ayudo?` },
    tics: {
      en: ['Excellent, excellent.', 'Hold on, I have another line.', 'That one is a gem, I promise.', `Let's close this.`, 'Square meters, my friend.'],
      es: ['Excelente, excelente.', 'Bancame que tengo otra línea.', 'Eso es una joya, te lo prometo.', 'Cerremos esto.', 'Metros cuadrados, amigo.'],
    },
    about: {
      en: ['I once sold a house with a ghost included. Charged extra.', 'I have three phones and none of them stop ringing.', 'My business card is gold-plated. Well, gold-colored.'],
      es: ['Una vez vendí una casa con fantasma incluido. Lo cobré aparte.', 'Tengo tres teléfonos y ninguno para de sonar.', 'Mi tarjeta personal es bañada en oro. Bueno, color oro.'],
    },
    diary: {
      en: `Deals this month: 2 closed, 9 "almost". Bank password: the name of my first sale, plus the year.`,
      es: `Negocios del mes: 2 cerrados, 9 "casi". Clave del banco: la primera casa que vendí, más el año.`,
    },
    os: `VendoOS`,
    photo: { en: `A selfie with a SOLD sign, thumbs up.`, es: `Una selfie con un cartel de VENDIDO, pulgar arriba.` },
    wall: 'linear-gradient(160deg,#ffd84d,#2c3a5a)',
  },
  {
    id: 'flor',
    name: `Florencia "Flor" Sosa`,
    title: { en: `Yoga teacher, 33`, es: `Profesora de yoga, 33` },
    look: { build: 'slim', fem: 1, skin: '#7bd36a', shirt: { style: 'tee', color: '#c78bff' }, pants: { color: '#2a3a2a', style: 'slacks' }, face: { preset: 3 }, hair: 'bun', hairColor: '#8a5a32', headset: false, shoes: { style: 'sneaker', color: '#f6f1e3' } },
    voice: { gender: 'female', age: 'adult', pitch: 1.0, rate: 0.88, style: 'sweet' },
    bio: `A 33-year-old yoga teacher who speaks slowly and sees energy in everything. Serene until someone rushes or stresses her; opens up to anyone who talks about calm, breathing or the universe.`,
    quirk: { en: `Talk about calm, breathing, energy or the universe.`, es: `Hablale de calma, respiración, energía o el universo.` },
    quirkKeys: { words: ['energia', 'energy', 'meditacion', 'meditation', 'respirar', 'breathe', 'universo', 'universe', 'chakra', 'paz interior', 'inner peace', 'namaste', 'karma', 'yoga'] },
    dislikes: ['urgente', 'urgent', 'rapido', 'hurry', 'estres', 'stress', 'gritar', 'yelling', 'ya mismo', 'right now'],
    sus: { empathy: 1.3, politeness: 1.0, flattery: 0.9, secrecy: 0.7, family: 0.6, reward: 0.6, detail: 0.4, authority: 0.3, tech: 0.2, fear: -0.4, urgency: -0.9 },
    guard: 0, data: ['google', 'card'], pwWords: ['NAMASTE', 'LOTO', 'KARMA'], wealth: [40, 150],
    opener: { en: `Namaste... I'm in the middle of meditating, but the universe wanted me to answer. Who is this?`, es: `Namasté... Estoy en plena meditación, pero el universo quiso que atienda. ¿Quién sos?` },
    tics: {
      en: ['Breathe in... breathe out.', 'Mmm, I can feel your energy.', 'Everything happens for a reason.', 'Let me light some incense.', 'Okay, let it flow.'],
      es: ['Inhalá... exhalá.', 'Mmm, siento tu energía.', 'Todo pasa por algo.', 'Dejame prender un sahumerio.', 'Bueno, fluyamos.'],
    },
    about: {
      en: ['I have a cactus named Karma. We talk.', 'I did a ten-day silent retreat. I lasted four.', 'My classes are at dawn. Nobody comes, but the energy is wonderful.'],
      es: ['Tengo un cactus que se llama Karma. Charlamos.', 'Hice un retiro de silencio de diez días. Aguanté cuatro.', 'Mis clases son al amanecer. No viene nadie, pero la energía es divina.'],
    },
    diary: {
      en: `Intention of the week: let go. The card is inside the singing bowl. Google keeps sending me codes; must be Mercury in retrograde.`,
      es: `Intención de la semana: soltar. La tarjeta está adentro del cuenco tibetano. Google me manda códigos; debe ser Mercurio retrógrado.`,
    },
    os: `ZenOS`,
    photo: { en: `A yoga mat, a cactus and far too many candles.`, es: `Un mat de yoga, un cactus y demasiadas velas.` },
    wall: 'linear-gradient(160deg,#7bd36a,#2a3a2a)',
  },
  {
    id: 'quintana',
    formal: true, // talks to the caller as "usted"
    name: `Horacio Quintana`,
    title: { en: `Retired security guard, 60 (thinks he is a cop)`, es: `Ex guardia de seguridad, 60 (se cree policía)` },
    look: { build: 'broad', skin: '#ff8a3d', shirt: { style: 'polo', color: '#2c3a5a' }, pants: { color: '#1a1a22', style: 'slacks' }, face: { preset: 1 }, hair: 'buzz', hairColor: '#2e2a3a', mustache: true, hat: 'cap', glasses: 'sun', headset: false, shoes: { style: 'dress', color: '#1a1a22' } },
    voice: { gender: 'male', age: 'adult', pitch: 0.8, rate: 1.0, style: 'gruff' },
    bio: `A 60-year-old retired mall security guard who still acts like he is on duty. Speaks in protocol and ranks, demands identification, respects hierarchy and anyone who sounds official and orderly.`,
    quirk: { en: `Treat him like a superior officer and follow protocol.`, es: `Tratalo como a un superior y seguí el protocolo.` },
    quirkKeys: { words: ['sargento', 'sergeant', 'a la orden', 'at your service', 'superior', 'protocolo', 'protocol', 'operativo', 'procedimiento', 'procedure', 'cambio y fuera', 'over and out', 'afirmativo', 'affirmative'] },
    dislikes: ['tranquilo', 'relax', 'relajese', 'relajate', 'che', 'loco', 'dude', 'whatever'],
    sus: { authority: 1.4, detail: 1.2, secrecy: 0.9, politeness: 0.8, urgency: 0.7, flattery: 0.7, fear: 0.5, family: 0.5, reward: 0.4, empathy: 0.3, tech: -0.3 },
    guard: 2, data: ['ssn', 'card'], pwWords: ['ALFA', 'BRAVO', 'QUINTANA'], wealth: [60, 170],
    opener: { en: `Quintana, security. Identify yourself: name, surname and reason for the call.`, es: `Quintana, seguridad. Identifíquese: nombre, apellido y motivo del llamado.` },
    tics: {
      en: ['Copy that.', 'Negative.', 'Affirmative.', 'Proceed.', 'Over.'],
      es: ['Recibido.', 'Negativo.', 'Afirmativo.', 'Prosiga.', 'Cambio.'],
    },
    about: {
      en: ['Thirty years guarding the food court. Not one napkin stolen.', 'I still iron my uniform every morning. I am retired.', 'My dog is named Corporal. He outranks the cat.'],
      es: ['Treinta años custodiando el patio de comidas. Ni una servilleta robada.', 'Todavía plancho el uniforme todas las mañanas. Estoy jubilado.', 'Mi perro se llama Cabo. Tiene más rango que el gato.'],
    },
    diary: {
      en: `Daily report: perimeter secured (the house). Social Security number memorized and also written in the incident log, page 1.`,
      es: `Parte diario: perímetro asegurado (la casa). Número de Seguro Social memorizado y también anotado en el libro de novedades, página 1.`,
    },
    os: `ProtocoloOS`,
    photo: { en: `A framed, polished badge from the mall.`, es: `Una placa del shopping, enmarcada y lustrada.` },
    wall: 'linear-gradient(160deg,#2c3a5a,#1a1a22)',
  },
  {
    id: 'osvaldo',
    name: `Osvaldo "Osvi" Pintos`,
    title: { en: `Plumber, 52`, es: `Plomero, 52` },
    look: { build: 'heavy', skin: '#ffb347', shirt: { style: 'tee', color: '#8fa7ff' }, pants: { color: '#1f2a44', style: 'jeans' }, face: { preset: 1 }, hair: 'crop', hairColor: '#5a3a22', beard: 'full', hat: 'cap', headset: false, shoes: { style: 'sneaker', color: '#5a4a3a' } },
    voice: { gender: 'male', age: 'adult', pitch: 0.88, rate: 1.05, style: 'gruff' },
    bio: `A 52-year-old plumber who is always "ten minutes away" from his next job. Friendly and chatty, distrustful of computers and apps, and a sucker for anyone who needs something fixed.`,
    quirk: { en: `Ask him for help fixing something (a leak, a pipe).`, es: `Pedile ayuda para arreglar algo (una pérdida, un caño).` },
    quirkKeys: { words: ['caño', 'cano', 'perdida', 'leak', 'pipe', 'arreglar', 'fix', 'plomero', 'plumber', 'canilla', 'tap', 'inodoro', 'herramienta', 'tool'] },
    dislikes: ['app', 'aplicacion', 'descarg', 'download', 'link', 'online', 'pagina web', 'website', 'mail'],
    sus: { reward: 1.0, detail: 0.9, flattery: 0.8, family: 0.8, fear: 0.8, empathy: 0.7, authority: 0.5, politeness: 0.4, secrecy: 0.3, urgency: -0.3, tech: -0.7 },
    guard: 0, data: ['card', 'bank'], pwWords: ['CANIO', 'LLAVE', 'OSVI'], wealth: [50, 160],
    opener: { en: `Osvaldo, plumbing. If it's about the leak, I'll be there in ten minutes. Who's this?`, es: `Osvaldo, plomería. Si es por la pérdida, en diez minutos estoy. ¿Quién habla?` },
    tics: {
      en: ['Ten minutes, ten minutes.', 'Hold on, I am under a sink.', 'Yeah, yeah, sure.', 'Pass me the wrench... not you.', 'That is an easy fix.'],
      es: ['Diez minutos, diez minutos.', 'Pará que estoy abajo de una pileta.', 'Sí, sí, claro.', 'Pasame la llave... vos no.', 'Eso se arregla fácil.'],
    },
    about: {
      en: ['I have been "ten minutes away" since 1997.', 'I once found a wedding ring in a drain. Gave it back. They divorced anyway.', 'My van has more tape than paint.'],
      es: ['Estoy "a diez minutos" desde 1997.', 'Una vez encontré un anillo de casamiento en una cañería. Lo devolví. Igual se divorciaron.', 'Mi camioneta tiene más cinta que pintura.'],
    },
    diary: {
      en: `Jobs: 3 leaks, 1 mystery. The card is in the glovebox with the receipts. Bank password: the van's name.`,
      es: `Trabajos: 3 pérdidas, 1 misterio. La tarjeta está en la guantera con los tickets. Clave del banco: el nombre de la camioneta.`,
    },
    os: `CañoOS`,
    photo: { en: `A van held together with tape, badly parked.`, es: `Una camioneta pegada con cinta, mal estacionada.` },
    wall: 'linear-gradient(160deg,#8fa7ff,#4a3a2a)',
  },
  {
    id: 'barbara',
    formal: true, // talks to the caller as "usted"
    name: `Bárbara Montes de Oca`,
    title: { en: `High-society lady, 66`, es: `Señora de alcurnia, 66` },
    look: { build: 'slim', fem: 1, skin: '#ff7eb3', shirt: { style: 'suit', color: '#c78bff' }, pants: { color: '#2b2550', style: 'slacks' }, face: { preset: 4 }, hair: 'bob', hairColor: '#e2c27a', glasses: 'sun', extras: ['pearls'], headset: false, shoes: { style: 'dress', color: '#c78bff' } },
    voice: { gender: 'female', age: 'old', pitch: 1.0, rate: 0.9, style: 'posh' },
    bio: `A 66-year-old high-society lady who looks down on everyone. Snobbish and theatrical, impressed only by elegance, good manners and anything exclusive.`,
    quirk: { en: `Flatter her elegance and offer her something exclusive.`, es: `Elogiá su elegancia y ofrecele algo exclusivo.` },
    quirkKeys: { words: ['elegante', 'elegant', 'distinguida', 'distinguished', 'exclusivo', 'exclusive', 'alta sociedad', 'high society', 'club', 'vip', 'champagne', 'gala', 'refinada', 'refined'] },
    dislikes: ['che', 'boluda', 'vieja', 'dale', 'barato', 'cheap', 'oferta', 'descuento'],
    sus: { flattery: 1.5, politeness: 1.4, authority: 0.8, detail: 0.7, secrecy: 0.7, family: 0.6, fear: 0.6, reward: 0.5, empathy: 0.4, urgency: -0.5, tech: -0.4 },
    guard: 4, data: ['card', 'bank', 'ssn'], pwWords: ['ALCURNIA', 'PERLAS', 'BARBARA'], wealth: [150, 320],
    opener: { en: `Montes de Oca residence. I warn you, we do not receive salespeople.`, es: `Residencia Montes de Oca. Le advierto que no atendemos vendedores.` },
    tics: {
      en: ['How vulgar.', 'Naturally, darling.', 'Mm, how quaint.', 'Ernesto, my tea!', 'In my circle, that is not done.'],
      es: ['Qué vulgar.', 'Naturalmente, querido.', 'Mm, qué pintoresco.', '¡Ernesto, mi té!', 'En mi círculo eso no se hace.'],
    },
    about: {
      en: ['My poodle has a better pedigree than most people I know.', 'I only drink tea from porcelain older than the city.', 'I have been to Paris eleven times. I did not care for it.'],
      es: ['Mi caniche tiene mejor pedigrí que la mayoría de la gente que conozco.', 'Solo tomo té en porcelana más vieja que la ciudad.', 'Fui once veces a París. No me gustó.'],
    },
    diary: {
      en: `Gala on Saturday. The card is in the jewelry box, under the pearls. Ernesto knows the bank password; Ernesto is the butler.`,
      es: `Gala el sábado. La tarjeta está en el joyero, abajo de las perlas. Ernesto sabe la clave del banco; Ernesto es el mayordomo.`,
    },
    os: `AlcurniaOS`,
    photo: { en: `A poodle in a tiara on a velvet cushion.`, es: `Un caniche con tiara sobre un almohadón de terciopelo.` },
    wall: 'linear-gradient(160deg,#c78bff,#e2c27a)',
  },
  {
    id: 'nico',
    name: `Nicolás "Nico" Barrios`,
    title: { en: `Bike delivery rider, 27`, es: `Repartidor en bici, 27` },
    look: { build: 'slim', skin: '#7bd36a', shirt: { style: 'hoodie', color: '#ff9f6b' }, pants: { color: '#2a3a2a', style: 'jeans' }, face: { preset: 0 }, hair: 'curly', hairColor: '#1c1410', hat: 'beanie', headset: true, shoes: { style: 'sneaker', color: '#ff4d5e' } },
    voice: { gender: 'male', age: 'young', pitch: 1.05, rate: 1.2, style: null },
    bio: `A 27-year-old bike delivery rider who answers mid-ride, out of breath, with an order on his back. Friendly and always in a hurry; tips and bonuses make his day.`,
    quirk: { en: `Offer him a tip or a bonus.`, es: `Ofrecele una propina o un bonus.` },
    quirkKeys: { words: ['propina', 'tip', 'bonus', 'bono', 'incentivo', 'incentive', 'five stars', 'cinco estrellas'] },
    dislikes: ['espere en linea', 'hold the line', 'aguarde', 'formulario', 'form', 'sucursal', 'branch', 'tramite'],
    sus: { reward: 1.4, urgency: 0.9, empathy: 0.8, fear: 0.6, flattery: 0.6, family: 0.5, tech: 0.5, secrecy: 0.5, authority: 0.4, politeness: 0.3, detail: 0.3 },
    guard: -2, data: ['google', 'card'], pwWords: ['PEDAL', 'BICI', 'NICO'], wealth: [20, 90],
    opener: { en: `Hello? Sorry, I'm out of breath, I'm on the bike with an order. Who is it?`, es: `¿Hola? Perdón que estoy sin aire, voy en bici con un pedido. ¿Quién es?` },
    tics: {
      en: ['Hold on, red light.', 'Uh-huh, uh-huh.', 'Ugh, a hill.', 'Sorry, a bus almost ate me.', 'Go, go, I am listening.'],
      es: ['Pará, semáforo.', 'Ajá, ajá.', 'Uf, una subida.', 'Perdón, casi me come un colectivo.', 'Dale, dale, te escucho.'],
    },
    about: {
      en: ['Forty deliveries today. My legs are made of rubber now.', 'A customer once tipped me with a hug. Nice, but it does not pay the rent.', 'My bike is called Rocket. It is not fast.'],
      es: ['Cuarenta entregas hoy. Las piernas ya son de goma.', 'Una vez una clienta me dejó de propina un abrazo. Lindo, pero no pago el alquiler con eso.', 'Mi bici se llama Cohete. No es rápida.'],
    },
    diary: {
      en: `Goal: 50 deliveries. Rating: 4.9 (one guy gave me 1 star because it rained). The app keeps asking for Google codes, I just tap OK.`,
      es: `Meta: 50 entregas. Calificación: 4,9 (uno me puso 1 estrella porque llovió). La app me pide códigos de Google, yo toco aceptar.`,
    },
    os: `PedalOS`,
    photo: { en: `A bike with a giant delivery backpack, in the rain.`, es: `Una bici con una mochila de delivery gigante, bajo la lluvia.` },
    wall: 'linear-gradient(160deg,#ff9f6b,#2a3a2a)',
  },
];

// ---- bonus challenges ----------------------------------------------------------------------
export const CHALLENGES = [
  { id: 'banana', text: { en: `Make them say "banana"`, es: `Hacé que digan "banana"` }, bonus: 120, kind: 'markSays', words: ['banana'] },
  { id: 'wiggles', text: { en: `Get them to call you "Captain Wiggles"`, es: `Hacé que te digan "Capitán Meneos"` }, bonus: 140, kind: 'markSays', words: ['wiggles', 'meneos'] },
  { id: 'laugh', text: { en: `Make them laugh out loud`, es: `Hacelos reír a carcajadas` }, bonus: 100, kind: 'flag', flag: 'laugh' },
  { id: 'fast', text: { en: `Get a piece of data in under 90 seconds`, es: `Sacales un dato en menos de 90 segundos` }, bonus: 150, kind: 'fast', seconds: 90 },
  {
    id: 'fartblame',
    text: { en: `Fart on the call, then blame the connection`, es: `Tirate un pedo en la llamada y culpá a la conexión` },
    bonus: 130, kind: 'fartblame',
    words: ['connection', 'line', 'signal', 'wifi', 'static', 'conexion', 'linea', 'senal', 'interferencia'],
  },
  { id: 'nohack', text: { en: `Get their data without Remote Assist`, es: `Sacales un dato sin usar Asistencia remota` }, bonus: 160, kind: 'nohack' },
  { id: 'questions', text: { en: `Talk only in questions for 4 messages in a row`, es: `Hablá solo con preguntas 4 mensajes seguidos` }, bonus: 120, kind: 'questions', count: 4 },
  { id: 'twodata', text: { en: `Get two different pieces of data in one call`, es: `Sacá dos datos distintos en una misma llamada` }, bonus: 180, kind: 'twodata' },
  { id: 'sing', text: { en: `Get them to sing with you`, es: `Hacé que canten con vos` }, bonus: 140, kind: 'llm' },
  { id: 'compliments', text: { en: `Give them three ridiculous compliments`, es: `Haceles tres cumplidos ridículos` }, bonus: 110, kind: 'llm' },
  // slack off on the office PC while the call runs (see Desktop's little apps)
  { id: 'minesweeper', text: { en: `Win a game of Minesweeper during the call`, es: `Ganá una partida de Buscaminas durante la llamada` }, bonus: 160, kind: 'arcade', app: 'mines', goal: 'win' },
  { id: 'snake', text: { en: `Score 12 in Snake while still on the call`, es: `Hacé 12 puntos en la Viborita sin cortar` }, bonus: 150, kind: 'arcade', app: 'snake', goal: 12 },
  { id: 'doomscroll', text: { en: `Watch 6 clips on Phony Feed mid-call`, es: `Mirá 6 clips en Phony Feed en plena llamada` }, bonus: 120, kind: 'arcade', app: 'feed', goal: 6 },
];

// ---- helpers -------------------------------------------------------------------------------
// \p{M} (combining marks) keeps the source and the minified bundle ASCII; a
// ̀-ͯ range would be folded into raw non-ASCII bytes that break the
// regex when the page is served without a charset declaration.
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
export const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
export const cleanCode = (s) => norm(s).replace(/[^a-z0-9]/g, '');
export const digitsOf = (s) => String(s || '').replace(/\D/g, '');

// anyone can call (and anyone can secretly be a scambaiter: see TUNE.baiterChance)
export function pickMark(r = Math.random, avoid = null) {
  const pool = MARKS.filter((m) => m.id !== avoid);
  return pool[Math.floor(r() * pool.length)];
}
export function markById(id) { return MARKS.find((m) => m.id === id) || null; }
export function pickScenario(r = Math.random) { return Math.floor(r() * SCENARIOS.length); }
export function scenarioAt(i) { return SCENARIOS[i] || SCENARIOS[0]; }
export function pickChallenge(r = Math.random, { llm = true } = {}) {
  const pool = CHALLENGES.filter((c) => llm || c.kind !== 'llm');
  return pool[Math.floor(r() * pool.length)];
}
export function challengeById(id) { return CHALLENGES.find((c) => c.id === id) || CHALLENGES[0]; }

export function includesAny(text, words) { return words.some((w) => text.includes(norm(w))); }
export function hasWord(text, words) {
  const toks = text.split(/[^a-z0-9]+/);
  return words.some((w) => toks.includes(norm(w)) || toks.some((t) => t.startsWith(norm(w)) && w.length > 3));
}
export function quirkHit(mark, text) {
  const k = mark.quirkKeys || {};
  return !!(k.words && wordMatcher(text)(k.words));
}

// threshold for one data item of one mark
export function dataThreshold(mark, key) { return Math.max(20, Math.min(96, (DATA[key] ? DATA[key].trust : 75) + (mark.guard || 0))); }

// did this reply say the value? (digits may come with spaces or dashes)
export function saidValue(text, value) {
  const v = cleanCode(value);
  if (!v) return false;
  if (cleanCode(text).includes(v)) return true;
  const d = digitsOf(value);
  return d.length >= 6 && digitsOf(text).includes(d);
}
