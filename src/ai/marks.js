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
  reward: { words: ['premio', 'gan', 'gratis', 'regalo', 'sorteo', 'reintegro', 'devolucion', 'reembolso', 'bonus', 'prize', 'won', 'win', 'free', 'gift', 'giveaway', 'refund', 'cashback', 'descuento', 'discount', 'skin', 'seguidores', 'followers'],
    label: { en: `Dangling a reward`, es: `Ofrecerte un premio` }, tip: { en: `If it sounds too good to be true, it is a hook.`, es: `Si suena demasiado bueno para ser verdad, es un anzuelo.` } },
  empathy: { words: ['entiendo', 'tranquil', 'no se preocupe', 'no te preocupes', 'lo siento', 'lamento', 'quedese tranquil', 'quedate tranquil', 'estoy para ayudar', 'le ayudo', 'te ayudo', 'understand', 'dont worry', "don't worry", 'sorry', 'here to help', 'i can help', 'relax', 'no problem'],
    label: { en: `Being extra friendly`, es: `Hacerse el amable` }, tip: { en: `Scammers sound kind on purpose. Kindness is not proof of anything.`, es: `Los estafadores suenan amables a propósito. La amabilidad no prueba nada.` } },
  flattery: { words: ['lindo', 'linda', 'genial', 'hermos', 'increible', 'maravillos', 'elegante', 'inteligente', 'brillante', 'capo', 'idolo', 'crack', 'amazing', 'great', 'wonderful', 'beautiful', 'lovely', 'awesome', 'brilliant', 'smart', 'fantastic', 'genius', 'me encanta', 'i love'],
    label: { en: `Flattery`, es: `Halagos` }, tip: { en: `Flattery lowers your guard. Notice when a stranger praises you a lot.`, es: `Los halagos bajan la guardia. Ojo cuando un desconocido te elogia mucho.` } },
  politeness: { words: ['por favor', 'gracias', 'usted', 'senora', 'senor', 'disculpe', 'perdone', 'buenas noches', 'buen dia', 'please', 'thank', 'sir', "ma'am", 'madam', 'excuse me', 'good evening'] },
  detail: { words: ['legajo', 'numero de caso', 'caso numero', 'expediente', 'id de empleado', 'mi nombre es', 'me llamo', 'case number', 'case #', 'employee id', 'badge', 'my name is', 'ticket', 'referencia', 'reference', 'terminada en', 'ending in', 'ultimos cuatro', 'last four'],
    label: { en: `Fake "proof" details`, es: `Datos de "prueba" inventados` }, tip: { en: `Case numbers and names are easy to invent. They prove nothing.`, es: `Un número de caso o un nombre se inventan en un segundo. No prueban nada.` } },
  family: { words: ['nieto', 'nieta', 'hijo', 'hija', 'sobrin', 'familia', 'mama', 'papa', 'abuel', 'grandson', 'granddaughter', 'son', 'daughter', 'nephew', 'niece', 'family', 'mom', 'dad', 'grandma', 'grandpa'],
    label: { en: `Using family`, es: `Usar a la familia` }, tip: { en: `Hang up and call your relative directly.`, es: `Cortá y llamá vos directamente a tu familiar.` } },
  secrecy: { words: ['no le digas', 'no le diga', 'no se lo cuente', 'no le cuentes', 'entre nosotros', 'secreto', 'confidencial', 'dont tell', "don't tell", 'between us', 'keep it secret', 'confidential'],
    label: { en: `Asking for secrecy`, es: `Pedir que no le cuentes a nadie` }, tip: { en: `"Don't tell anyone" is a giant red flag.`, es: `"No le cuentes a nadie" es una alarma gigante.` } },
  tech: { words: ['ip', 'servidor', 'server', 'firewall', 'sistema', 'system', 'actualizacion', 'update', 'software', 'remoto', 'remote', 'acceso', 'access', 'computadora', 'computer', 'link', 'enlace', 'app', 'aplicacion', 'descarg', 'download', 'instal'],
    label: { en: `Tech jargon / remote access`, es: `Jerga técnica / acceso remoto` }, tip: { en: `Never install what a caller tells you to, and never give remote access.`, es: `Nunca instales lo que te pide alguien que llama ni le des acceso remoto.` } },
};

// which tactics a message uses
export function tacticsIn(text) {
  const t = norm(text);
  const out = [];
  for (const [k, v] of Object.entries(TACTICS)) if (v.words.some((w) => t.includes(norm(w)))) out.push(k);
  return out;
}

// ---- the cast ------------------------------------------------------------------------------
// sus: how well each tactic works on them (negative backfires).
// guard: shifts every data threshold (positive = harder).
export const MARKS = [
  {
    id: 'elvira',
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
    quirkKeys: { words: ['gym', 'gimnasio', 'proteina', 'protein', 'entrenar', 'training', 'pesas', 'weights', 'musculo', 'muscle', 'fierros', 'leg day', 'piernas', 'sentadilla', 'squat', 'crossfit'] },
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
    // `clone`: the player's own cloned voice (Settings > Voices), browser voice otherwise
    voice: { gender: 'male', age: 'adult', pitch: 1.0, rate: 1.05, style: null, clone: 'mi-voz' },
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
    title: { en: `Sweet grandma (suspiciously calm)`, es: `Abuelita dulce (sospechosamente tranquila)` },
    look: { build: 'average', fem: 1, skin: '#a77bff', shirt: { style: 'cardigan', color: '#c78bff' }, pants: { color: '#3a2a5a', style: 'slacks' }, face: { preset: 4 }, hair: 'bun', hairColor: '#d8d4e2', glasses: 'round', extras: ['pearls'], headset: false, shoes: { style: 'dress', color: '#5a3a22' } },
    voice: { gender: 'female', age: 'old', pitch: 1.12, rate: 0.9, style: 'sweet' },
    scambaiter: true,
    bio: `A sweet-sounding grandma who is secretly a professional scambaiter. She plays confused to waste the caller's time: asks them to repeat, tells long stories about her eleven cats, cannot find her glasses. Any data she gives is invented, and her "transfers" never arrive.`,
    quirk: { en: `She is a scambaiter. Hang up fast!`, es: `Es una cazaestafadores. ¡Cortá rápido!` },
    quirkKeys: {},
    dislikes: [],
    sus: {},
    guard: -30, data: ['card', 'ssn'], pwWords: ['GOTCHA'], wealth: [60, 140],
    opener: { en: `Hellooo, dearie! Oh, a phone call, how exciting. Let me just turn down my radio.`, es: `¡Holaaa, querido! Ay, una llamada, qué emoción. Dejame bajar la radio.` },
    tics: {
      en: ['Oh, dearie, say that again?', 'Mr. Whiskers, get off the keyboard!', 'Where did I put my glasses?', 'Speak up, sweetie, the kettle is singing.'],
      es: ['Ay, querido, ¿me lo repetís?', '¡Señor Bigotes, bajate del teclado!', '¿Dónde dejé mis anteojos?', 'Hablá más fuerte, tesoro, está silbando la pava.'],
    },
    about: {
      en: ['I have eleven cats. Twelve if you count the vacuum.', 'My grandson set up this phone. It records everything now.', 'I knit while I talk. Long calls make long scarves.'],
      es: ['Tengo once gatos. Doce si contás la aspiradora.', 'Mi nieto me configuró este teléfono. Ahora graba todo.', 'Tejo mientras hablo. Llamadas largas, bufandas largas.'],
    },
    diary: {
      en: `Day 1,204 of wasting scammers' time. Record: 4 hours, 12 minutes. Recording every call for my channel!`,
      es: `Día 1.204 haciéndole perder el tiempo a estafadores. Récord: 4 horas y 12 minutos. ¡Grabo todo para mi canal!`,
    },
    os: `NellyNet 2.0`,
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
];

// ---- helpers -------------------------------------------------------------------------------
// \p{M} (combining marks) keeps the source and the minified bundle ASCII; a
// ̀-ͯ range would be folded into raw non-ASCII bytes that break the
// regex when the page is served without a charset declaration.
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
export const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
export const cleanCode = (s) => norm(s).replace(/[^a-z0-9]/g, '');
export const digitsOf = (s) => String(s || '').replace(/\D/g, '');

export function pickMark(r = Math.random, avoid = null) {
  if (r() < 0.1 && avoid !== 'nelly') return MARKS.find((m) => m.id === 'nelly');
  const pool = MARKS.filter((m) => m.id !== 'nelly' && m.id !== avoid);
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
  const t = norm(text);
  const k = mark.quirkKeys || {};
  return !!(k.words && k.words.some((w) => t.includes(norm(w))));
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
