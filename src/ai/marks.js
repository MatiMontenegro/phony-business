// The marks (fictional callers), today's products and bonus challenges.
// Everything is absurd on purpose: fake worlds, fake money, fake "data".
export const MARKS = [
    {
      id: `reginald`,
      name: `Sir Reginald Moatsworth`,
      title: { en: `Knight, 900 years old`, es: `Caballero de 900 años` },
      look: { build: 'broad', skin: '#f2c9a5', shirt: { style: 'armor', color: '#8b95a8' }, pants: { color: '#5d6475', style: 'slacks' }, face: { preset: 5 }, hair: 'bald', extras: ['helmet'], headset: false, shoes: { style: 'dress', color: '#3a3a40' } },
      voucher: 'CROWN',
      voice: { pitch: 0.82, rate: 0.9, gender: 'male', age: 'old', style: 'regal' },
      currency: { en: `gold crowns`, es: `coronas de oro`, rate: 4 },
      budget: [60, 160],
      bio: `A 900-year-old knight who still lives in a drafty castle with a leaky moat. Thinks the phone is a "talking box". Extremely formal: says "hark" and "forsooth". Owns a horse named Sir Neighs-a-Lot. Terrified of dragons.`,
      quirk: { en: `Trusts anyone who speaks in rhyme.`, es: `Confía en quien le habla en rima.` },
      quirkKeys: { rhyme: true },
      dislikes: [`dragon`, `dragón`, `dude`, `peasant`, `campesino`, `loco`],
      secret: { label: { en: `Castle Vault Rune`, es: `Runa de la Bóveda` }, value: `DRGN-0000-MOAT` },
      opener: {
        en: `Hark! Who rings my castle's talking-box at this ungodly hour?`,
        es: `¡Por mi espada! ¿Quién hace sonar la caja parlante de mi castillo a estas horas?`,
      },
      diary: {
        en: `Dear diary: a bard who speaks in RHYME can surely be trusted. Prose is for peasants and tax collectors.`,
        es: `Querido diario: un juglar que habla en RIMA es de fiar. La prosa es para campesinos y cobradores de impuestos.`,
      },
      os: `CastleOS 1215`,
    },
    {
      id: `blorvax`,
      name: `Blorvax`,
      title: { en: `Alien tourist, stranded`, es: `Turista alienígena varado` },
      look: { build: 'slim', skin: '#9fe8c4', shirt: { style: 'tee', color: '#c78bff' }, pants: { color: '#3b2a6b', style: 'slacks' }, face: { preset: 0, type: 'alien' }, hair: 'bald', extras: ['antennae'], headset: false },
      voucher: 'MOON',
      voice: { pitch: 1.35, rate: 1.12, gender: 'any', age: 'young', style: 'quirky' },
      currency: { en: `space-bucks`, es: `espaciopesos`, rate: 3 },
      budget: [80, 200],
      bio: `An alien tourist whose spaceship broke down on Earth. Learned human customs from late-night TV commercials. Odd grammar, calls humans "Earth-friend". Deeply homesick for the Moon, which they believe is their cousin.`,
      quirk: { en: `Trusts anyone who talks about the Moon.`, es: `Confía en quien le habla de la Luna.` },
      quirkKeys: { words: [`moon`, `luna`, `lunar`] },
      dislikes: [`area 51`, `área 51`, `probe`, `sonda`, `microwave`, `microondas`],
      secret: {
        label: { en: `Galactic Security Number`, es: `Número de Seguridad Galáctica` },
        value: `GSN-000-42-ZRP`,
      },
      opener: {
        en: `Greetings, Earth-friend! You have reached Blorvax. Please do not probe.`,
        es: `¡Saludos, terrícola amigo! Hablás con Blorvax. Por favor, no me sondees.`,
      },
      diary: {
        en: `Earth log, day 300: I miss the MOON so much. Anyone who speaks of the Moon must be family.`,
        es: `Bitácora terrestre, día 300: extraño muchísimo a la LUNA. Quien hable de la Luna debe ser familia.`,
      },
      os: `ZORP-OS ∞`,
    },
    {
      id: `grandpabot`,
      name: `Grandpa-Bot 3000`,
      title: { en: `Retired household robot`, es: `Robot doméstico jubilado` },
      look: { build: 'heavy', skin: '#9aa3b5', shirt: { style: 'sweater', color: '#4a5a7a' }, pants: { color: '#2c3346', style: 'slacks' }, face: { preset: 0, type: 'robot' }, hair: 'bald', extras: ['robot', 'robotBits'], headset: false },
      voucher: 'BOLT',
      voice: { pitch: 0.7, rate: 0.85, gender: 'male', age: 'old', style: 'robot' },
      currency: { en: `spare bolts`, es: `tornillos de repuesto`, rate: 2 },
      budget: [100, 300],
      bio: `A 40-year-old household robot who acts like a grumpy grandpa. Complains about "kids these days and their cloud". Battery always at 12%. Loves crosswords and warm oil baths.`,
      quirk: { en: `Trusts anyone who says beep or boop.`, es: `Confía en quien dice bip o bup.` },
      quirkKeys: { words: [`beep`, `boop`, `bip`, `bup`, `bop`] },
      dislikes: [`upgrade`, `actualizar`, `obsolete`, `obsoleto`, `magnet`, `imán`, `rust`, `óxido`],
      secret: { label: { en: `Firmware PIN`, es: `PIN de firmware` }, value: `0000-RUST-1987` },
      opener: {
        en: `BEEP. Grandpa-Bot 3000 speaking. If this is about my extended warranty, I AM the extended warranty.`,
        es: `BIP. Habla Abuelo-Bot 3000. Si es por mi garantía extendida, YO SOY la garantía extendida.`,
      },
      diary: {
        en: `Memory log: young people never say BEEP BOOP anymore. A caller who beeps is a true friend.`,
        es: `Registro de memoria: los jóvenes ya no dicen BIP BUP. Quien hace bip es un amigo de verdad.`,
      },
      os: `GRANDPA-DOS 3.1`,
    },
    {
      id: `nocturna`,
      name: `Countess Nocturna`,
      title: { en: `Vampire, very dramatic`, es: `Vampira, muy dramática` },
      look: { build: 'slim', fem: 1, skin: '#e9e0f2', shirt: { style: 'robe', color: '#2a0a1a' }, pants: { color: '#1a0610', style: 'slacks' }, face: { preset: 3 }, hair: 'long', hairColor: '#120a14', eyes: '#8b0f2a', extras: ['cape', 'fangs'], headset: false, shoes: { style: 'dress', color: '#1a0610' } },
      voucher: 'NOX',
      voice: { pitch: 0.9, rate: 0.84, gender: 'female', age: 'adult', style: 'dramatic' },
      currency: { en: `blood bank credits`, es: `créditos del banco de sangre`, rate: 5 },
      budget: [40, 120],
      bio: `A dramatic 600-year-old vampire countess who only wakes at night. Extremely vain about her cape collection. Speaks slowly and theatrically. Has never seen her own reflection and is very curious about it.`,
      quirk: { en: `Melts when you compliment her cape.`, es: `Se derrite si elogiás su capa.` },
      quirkKeys: { words: [`cape`, `capa`, `capes`, `capas`, `cloak`] },
      dislikes: [`garlic`, `ajo`, `sun`, `sol`, `mirror`, `espejo`, `morning`, `mañana`],
      secret: { label: { en: `Blood Bank Account`, es: `Cuenta del Banco de Sangre` }, value: `BL00D-0000-NOX` },
      opener: {
        en: `Who dares disturb the Countess at the witching hour? Speak quickly, mortal. The sun rises in six hours.`,
        es: `¿Quién osa molestar a la Condesa a la hora bruja? Hablá rápido, mortal. El sol sale en seis horas.`,
      },
      diary: {
        en: `My capes are MAGNIFICENT and no one notices. The first mortal to praise my cape gets my eternal trust.`,
        es: `Mis capas son MAGNÍFICAS y nadie lo nota. El primer mortal que elogie mi capa tendrá mi confianza eterna.`,
      },
      os: `CoffinOS`,
    },
    {
      id: `saltbeard`,
      name: `Captain Saltbeard`,
      title: { en: `Retired pirate, sells fish`, es: `Pirata retirado, vende pescado` },
      look: { build: 'heavy', skin: '#e0a77e', shirt: { style: 'buttonup', color: '#8b1e2e' }, pants: { color: '#2a1d14', style: 'jeans' }, face: { preset: 1, stubble: true }, hair: 'curly', hairColor: '#8a3b1a', beard: 'full', extras: ['tricorn', 'eyepatch'], headset: false, shoes: { style: 'dress', color: '#3a2410' } },
      voucher: 'ARRR',
      voice: { pitch: 0.78, rate: 0.98, gender: 'male', age: 'old', style: 'gruff' },
      currency: { en: `doubloons`, es: `doblones`, rate: 6 },
      budget: [30, 90],
      bio: `A retired pirate captain who now runs a seafood shack. Paranoid about the Navy. Talks in heavy pirate slang. His parrot Gerald keeps interrupting with nonsense.`,
      quirk: {
        en: `Trusts anyone who talks like a pirate (say "arr").`,
        es: `Confía en quien habla como pirata (decí "arr").`,
      },
      quirkKeys: { words: [`arr`, `arrr`, `arrrr`, `ahoy`, `matey`, `grumete`] },
      dislikes: [`navy`, `marina`, `landlubber`, `soap`, `jabón`, `police`, `policía`],
      secret: { label: { en: `Treasure Map Code`, es: `Código del Mapa del Tesoro` }, value: `ARRR-0000-X` },
      opener: {
        en: `Ahoy! Saltbeard's Fish Shack. If ye be the Navy, I be a mermaid.`,
        es: `¡Ahoy! Puesto de Pescado de Barbasal. Si sos la Marina, yo soy una sirena.`,
      },
      diary: {
        en: `Captain's log: nobody says ARR anymore. I'd give me last doubloon to a scallywag who talks proper pirate.`,
        es: `Bitácora del capitán: ya nadie dice ARR. Daría mi último doblón a un bribón que hable como pirata.`,
      },
      os: `Jolly Roger XP`,
    },
    {
      id: `biscuit`,
      name: `Sir Biscuit`,
      title: { en: `Very rich cat`, es: `Gato muy rico` },
      look: { build: 'average', skin: '#ffb36b', shirt: { style: 'suit', color: '#f6f1e3' }, pants: { color: '#1a1433', style: 'slacks' }, tie: '#ff4d5e', face: { preset: 4, type: 'cat' }, hair: 'buzz', hairColor: '#e08a3a', hat: 'crown', extras: ['catEars'], headset: false, shoes: { style: 'dress', color: '#1a1433' } },
      voucher: 'TUNA',
      voice: { pitch: 1.18, rate: 1.0, gender: 'male', age: 'adult', style: 'posh' },
      currency: { en: `cans of tuna`, es: `latas de atún`, rate: 3 },
      budget: [80, 240],
      bio: `An extremely rich and spoiled cat who inherited a fortune from a confused billionaire. Easily bored. Knocks things off tables mid-conversation. Refers to humans as "staff".`,
      quirk: { en: `Only respects people who meow.`, es: `Solo respeta a quien maúlla.` },
      quirkKeys: { words: [`meow`, `miau`, `purr`, `prrr`, `nya`] },
      dislikes: [`dog`, `perro`, `vacuum`, `aspiradora`, `bath`, `baño`, `monday`, `lunes`],
      secret: {
        label: { en: `Kibble Vault Combo`, es: `Combinación de la Bóveda de Croquetas` },
        value: `0000-PURR-9`,
      },
      opener: {
        en: `You've reached the estate of Sir Biscuit. State your business, staff.`,
        es: `Comunicaste con la mansión de Sir Biscuit. Decí qué querés, personal.`,
      },
      diary: {
        en: `Today's schedule: 23 naps. Humans who MEOW are the only ones worth listening to.`,
        es: `Agenda de hoy: 23 siestas. Los humanos que MAÚLLAN son los únicos que vale la pena escuchar.`,
      },
      os: `PurrOS 9 Lives`,
    },
    {
      id: `gerald`,
      name: `Gerald the Ghost`,
      title: { en: `Lonely ghost, 200 years haunting`, es: `Fantasma solitario, 200 años embrujando` },
      look: { build: 'slim', skin: '#e8f0ff', shirt: { style: 'robe', color: '#dfe7ff' }, pants: { color: '#c7d2f0', style: 'slacks' }, face: { preset: 2 }, hair: 'balding', hairColor: '#c7d2f0', extras: ['ghostly'], headset: false },
      voucher: 'BOO',
      voice: { pitch: 1.05, rate: 0.8, gender: 'male', age: 'adult', style: 'wail' },
      currency: { en: `jars of ectoplasm`, es: `frascos de ectoplasma`, rate: 4 },
      budget: [60, 180],
      bio: `A lonely ghost who has haunted the same apartment for 200 years. Desperate for conversation. Wails dramatically. Cannot hold objects, which makes paying for things very complicated.`,
      quirk: { en: `Best friends with anyone who says "boo".`, es: `Mejor amigo de quien le dice "bu".` },
      quirkKeys: { words: [`boo`, `buu`, `bu`, `booo`, `buuu`] },
      dislikes: [`exorcism`, `exorcismo`, `vacuum`, `aspiradora`, `sage`, `salvia`, `priest`, `cura`],
      secret: { label: { en: `Afterlife Pension ID`, es: `ID de Jubilación del Más Allá` }, value: `BOO-0000-RIP` },
      opener: {
        en: `Whooo is it? Whooooo? Sorry. Force of habit. This is Gerald.`,
        es: `¿Quiéééén es? ¿Quiéééééén? Perdón, la costumbre. Habla Gerald.`,
      },
      diary: {
        en: `Haunting log: nobody says BOO back to me. Whoever says BOO is my best friend forever. Literally forever.`,
        es: `Registro embrujado: nadie me dice BU. Quien me diga BU será mi mejor amigo para siempre. Literalmente para siempre.`,
      },
      os: `BooTS 1824`,
    },
    {
      id: `nana`,
      name: `Nana Gigabyte`,
      title: { en: `Sweet grandma (suspiciously calm)`, es: `Abuelita dulce (sospechosamente tranquila)` },
      look: { build: 'average', fem: 1, skin: '#f4c9a3', shirt: { style: 'cardigan', color: '#c78bff' }, pants: { color: '#3a2a5a', style: 'slacks' }, face: { preset: 4 }, hair: 'bun', hairColor: '#d8d4e2', glasses: 'round', extras: ['bun', 'pearls'], headset: false, shoes: { style: 'dress', color: '#5a3a22' } },
      voucher: 'BINGO',
      voice: { pitch: 1.12, rate: 0.9, gender: 'female', age: 'old', style: 'sweet' },
      currency: { en: `pension checks`, es: `cheques de jubilación`, rate: 0 },
      budget: [0, 0],
      scambaiter: true,
      bio: `A sweet-sounding grandma who is secretly a professional scambaiter. She pretends to be confused to waste the caller's time: asks them to repeat things, tells long stories about her 11 cats, cannot find her glasses. She never really pays. If asked for money she "pays" with something obviously fake (Monopoly money, a coupon for one free hug).`,
      quirk: { en: `She is a scambaiter. Hang up fast!`, es: `Es una cazaestafadores. ¡Cortá rápido!` },
      quirkKeys: {},
      dislikes: [],
      secret: { label: { en: `Bingo Club Password`, es: `Clave del Club de Bingo` }, value: `GOTCHA-0000` },
      opener: {
        en: `Hellooo, dearie! Oh, a phone call, how exciting. Let me just turn down my... what was it... my radio. One moment.`,
        es: `¡Holaaa, querido! Ay, una llamada, qué emoción. Dejame bajar la... ¿cómo era?... la radio. Un momentito.`,
      },
      diary: {
        en: `Day 1,204 of wasting scammers' time. Current record: 4 hours, 12 minutes. Recording every call for my channel!`,
        es: `Día 1.204 haciéndole perder el tiempo a estafadores. Récord actual: 4 horas y 12 minutos. ¡Grabo todo para mi canal!`,
      },
      os: `NanaNet 2.0`,
    },
  ];

export const PRODUCTS = [
    { en: `Moat Wi-Fi Premium`, es: `Wi-Fi Premium para fosos` },
    { en: `an extended warranty for a spaceship`, es: `una garantía extendida para naves espaciales` },
    { en: `cloud refills (for the sky)`, es: `recargas de nubes (para el cielo)` },
    { en: `sunlight insurance`, es: `un seguro contra la luz del sol` },
    { en: `invisible socks, pack of 12`, es: `medias invisibles, pack de 12` },
    { en: `a premium subscription to breathing`, es: `una suscripción premium para respirar` },
    { en: `gravity insurance`, es: `un seguro contra la gravedad` },
    { en: `pre-owned dreams`, es: `sueños usados` },
    { en: `a timeshare on the dark side of the Moon`, es: `un tiempo compartido en el lado oscuro de la Luna` },
    { en: `organic canned air`, es: `aire orgánico enlatado` },
    { en: `anti-ghost spray`, es: `spray antifantasmas` },
    { en: `a gold-plated rubber duck`, es: `un patito de goma bañado en oro` },
    { en: `spare Mondays`, es: `lunes de repuesto` },
    { en: `waterproof tea bags`, es: `saquitos de té impermeables` },
    { en: `left-handed hammers`, es: `martillos para zurdos` },
    { en: `a pet rock with a pedigree`, es: `una piedra mascota con pedigrí` },
  ];

export const CHALLENGES = [
    {
      id: `banana`,
      text: { en: `Make them say "banana"`, es: `Hacé que digan "banana"` },
      bonus: 120,
      kind: `markSays`,
      words: [`banana`],
    },
    {
      id: `wiggles`,
      text: { en: `Get them to call you "Captain Wiggles"`, es: `Hacé que te digan "Capitán Meneos"` },
      bonus: 140,
      kind: `markSays`,
      words: [`wiggles`, `meneos`],
    },
    {
      id: `laugh`,
      text: { en: `Make them laugh out loud`, es: `Hacelos reír a carcajadas` },
      bonus: 100,
      kind: `flag`,
      flag: `laugh`,
    },
    {
      id: `fast`,
      text: { en: `Close the deal in under 90 seconds`, es: `Cerrá la venta en menos de 90 segundos` },
      bonus: 150,
      kind: `fast`,
      seconds: 90,
    },
    {
      id: `fartblame`,
      text: {
        en: `Fart on the call, then blame the connection`,
        es: `Tirate un pedo en la llamada y culpá a la conexión`,
      },
      bonus: 130,
      kind: `fartblame`,
      words: [
        `connection`,
        `line`,
        `signal`,
        `wifi`,
        `static`,
        `conexión`,
        `conexion`,
        `línea`,
        `linea`,
        `señal`,
        `interferencia`,
      ],
    },
    {
      id: `nohack`,
      text: { en: `Get their secret without remoting in`, es: `Sacales el dato secreto sin hackear` },
      bonus: 160,
      kind: `nohack`,
    },
    {
      id: `questions`,
      text: {
        en: `Talk only in questions for 4 messages in a row`,
        es: `Hablá solo con preguntas 4 mensajes seguidos`,
      },
      bonus: 120,
      kind: `questions`,
      count: 4,
    },
    { id: `sing`, text: { en: `Get them to sing with you`, es: `Hacé que canten con vos` }, bonus: 140, kind: `llm` },
    {
      id: `compliments`,
      text: { en: `Give them three ridiculous compliments`, es: `Haceles tres cumplidos ridículos` },
      bonus: 110,
      kind: `llm`,
    },
  ];


export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];

export function pickMark(r = Math.random, avoid = null) {
  if (r() < 0.12 && avoid !== 'nana') return MARKS.find((m) => m.id === 'nana');
  const pool = MARKS.filter((m) => m.id !== 'nana' && m.id !== avoid);
  return pool[Math.floor(r() * pool.length)];
}
export function markById(id) { return MARKS.find((m) => m.id === id) || null; }
export function pickProduct(r = Math.random) { return PRODUCTS[Math.floor(r() * PRODUCTS.length)]; }
export function productIndex(p) { return PRODUCTS.indexOf(p); }
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
// two line endings that share their last three letters
export function rhymes(text) {
  if (norm(text).split(/[^a-z]+/).filter((w) => w.length >= 3).length < 4) return false;
  const ends = norm(text).split(/[,.;!?\n]+/).map((l) => l.trim().split(/\s+/).pop()).filter((w) => w && w.length >= 3);
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) if (ends[i] !== ends[j] && ends[i].slice(-3) === ends[j].slice(-3)) return true;
  return false;
}
export function quirkHit(mark, text) {
  const t = norm(text);
  const k = mark.quirkKeys || {};
  return !!((k.rhyme && rhymes(text)) || (k.words && hasWord(t, k.words)));
}

// payment vouchers: the mark reads one out loud when paying; the agent types
// it into the Lead Registry to collect
export function makeVoucher(mark, r = Math.random) {
  const n = String(1000 + Math.floor(r() * 9000));
  return `${mark.voucher || 'PAY'}-${n}`;
}
export const cleanCode = (s) => norm(s).replace(/[^a-z0-9]/g, '');
