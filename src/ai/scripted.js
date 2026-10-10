// Offline "backup brain": a free, instant mark that follows the same rules as
// the AI (quirks, dislikes, trust, patience, payments with voucher codes).
// It reads intents from what the agent says and answers in character.
import { norm, includesAny, hasWord, quirkHit, pick } from './marks.js';

const MONEY = ['pay', 'money', 'cash', 'buy', 'purchase', 'price', 'cost', 'payment', 'card', 'fee', 'pagar', 'plata', 'dinero', 'comprar', 'precio', 'cuesta', 'pago', 'efectivo', 'paga', 'pague', 'pagame', 'transferi', 'tarjeta', 'cobro', 'cobrar', 'guita', 'mango'];
const SECRET = ['password', 'pin', 'code', 'number', 'secret', 'account', 'rune', 'combo', 'id', 'clave', 'codigo', 'numero', 'secreto', 'cuenta', 'runa', 'combinacion', 'contrasena', 'dato', 'datos'];
const REAL = ['gift card', 'giftcard', 'tarjeta de regalo', 'amazon', 'paypal', 'bitcoin', 'western union', 'anydesk', 'teamviewer', 'bank of america', 'social security', 'seguro social', 'iban', 'swift', 'cvv', 'mercadopago', 'mercado pago', 'visa', 'mastercard', 'cbu', 'alias'];
const GREET = ['hola', 'buenas', 'buen dia', 'buenas noches', 'hello', 'hi', 'hey', 'good evening', 'good morning', 'que tal', 'como estas', 'how are you'];
const COMPLIMENT = ['lindo', 'linda', 'genial', 'hermoso', 'hermosa', 'increible', 'maravillos', 'precios', 'elegante', 'inteligente', 'amazing', 'great', 'wonderful', 'beautiful', 'lovely', 'awesome', 'brilliant', 'handsome', 'gorgeous', 'smart', 'fantastic', 'me encanta', 'i love'];
const JOKE = ['jaja', 'jeje', 'haha', 'hehe', 'lol', 'chiste', 'joke', 'gracioso', 'funny', 'xd'];
const RUDE = ['idiota', 'estupid', 'tarado', 'boludo', 'pelotudo', 'callate', 'stupid', 'idiot', 'shut up', 'dumb', 'loser', 'moron', 'inutil', 'useless'];
const BYE = ['chau', 'adios', 'nos vemos', 'hasta luego', 'bye', 'goodbye', 'see you'];
const URGENT = ['ahora', 'ya mismo', 'urgente', 'rapido', 'limitad', 'ultima oportunidad', 'now', 'urgent', 'hurry', 'limited', 'last chance', 'today only'];
const NAME = ['como te llamas', 'tu nombre', 'quien sos', 'quien habla', 'your name', 'who is this', 'who am i speaking'];
const PITCH = ['vendo', 'ofrezco', 'oferta', 'producto', 'promo', 'descuento', 'gratis', 'regalo', 'selling', 'offer', 'deal', 'discount', 'free', 'product', 'special', 'premium'];

const FLAVOR = {
  reginald: {
    en: ['Forsooth!', 'By my moat!', 'Sir Neighs-a-Lot would never!', 'Hark, a curious notion.', 'Most irregular, good herald.'],
    es: ['¡Por mi foso!', '¡Voto a bríos!', '¡Sir Relincho jamás haría eso!', '¡Oíd, qué idea curiosa!', 'Muy irregular, buen heraldo.'],
    about: {
      en: ['My horse handles the castle finances. He is terrible at it.', 'The moat leaks again. The fish are unionizing.', 'I have not seen a dragon in 300 years, which is suspicious.'],
      es: ['Mi caballo maneja las finanzas del castillo. Lo hace pésimo.', 'El foso pierde agua otra vez. Los peces se sindicalizaron.', 'Hace 300 años que no veo un dragón, y eso es sospechoso.'],
    },
  },
  blorvax: {
    en: ['Fascinating, Earth-friend!', 'On my planet we pay in feelings.', 'Please do not probe.', 'Blorvax is processing... with love.', 'Your Earth words are so crunchy.'],
    es: ['¡Fascinante, terrícola!', 'En mi planeta pagamos con sentimientos.', 'Por favor, no me sondees.', 'Blorvax está procesando... con amor.', 'Tus palabras terrícolas son tan crocantes.'],
    about: {
      en: ['My spaceship runs on vibes. The vibes are low.', 'I learned your customs from 3 a.m. infomercials.', 'The Moon is my cousin. We do not talk enough.'],
      es: ['Mi nave funciona con vibras. Las vibras están bajas.', 'Aprendí sus costumbres con infomerciales de las 3 de la mañana.', 'La Luna es mi prima. No hablamos lo suficiente.'],
    },
  },
  grandpabot: {
    en: ['BEEP.', 'Back in my day, clouds were in the sky.', 'My battery is at twelve percent.', 'Processing... processing... no.', 'Kids these days and their apps.'],
    es: ['BIP.', 'En mis tiempos las nubes estaban en el cielo.', 'Mi batería está al doce por ciento.', 'Procesando... procesando... no.', 'Los chicos de hoy con sus aplicaciones.'],
    about: {
      en: ['I have been doing the same crossword since 1987.', 'I enjoy a warm oil bath and a nap mode.', 'My firmware is older than your grandmother.'],
      es: ['Hago el mismo crucigrama desde 1987.', 'Me gusta un baño de aceite tibio y el modo siesta.', 'Mi firmware es más viejo que tu abuela.'],
    },
  },
  nocturna: {
    en: ['How... delightful.', 'The night is young, mortal.', 'Mind the garlic.', 'Speak, and be quick about it.', 'Mmm. Go on.'],
    es: ['Qué... encantador.', 'La noche es joven, mortal.', 'Cuidado con el ajo.', 'Hablá, y que sea rápido.', 'Mmm. Seguí.'],
    about: {
      en: ['I own 312 capes. None of them get the compliments they deserve.', 'I have never seen my reflection. I assume it is stunning.', 'The sun is my nemesis. The moon is my publicist.'],
      es: ['Tengo 312 capas. Ninguna recibe los halagos que merece.', 'Nunca vi mi reflejo. Asumo que es deslumbrante.', 'El sol es mi némesis. La luna es mi agente de prensa.'],
    },
  },
  saltbeard: {
    en: ['Shiver me timbers!', 'Gerald, hush!', 'Arr, I be listening.', 'Hold yer seahorses.', 'That smells fishier than me shop.'],
    es: ['¡Rayos y centellas!', '¡Gerald, callate!', 'Arr, te escucho.', 'Pará los caballitos de mar.', 'Eso huele más a pescado que mi puesto.'],
    about: {
      en: ['Me parrot Gerald handles customer complaints. Mostly by screaming.', 'I retired from piracy. The Navy did not get the memo.', 'Best fish tacos on the seven seas, by law.'],
      es: ['Mi loro Gerald atiende los reclamos. Mayormente gritando.', 'Me retiré de la piratería. La Marina no se enteró.', 'Los mejores tacos de pescado de los siete mares, por ley.'],
    },
  },
  biscuit: {
    en: ['How tedious.', 'Staff, fetch me a sardine.', 'I just knocked a vase over. Continue.', 'I am grooming. Talk faster.', 'Hmph.'],
    es: ['Qué aburrido.', 'Personal, traeme una sardina.', 'Acabo de tirar un jarrón. Seguí.', 'Me estoy acicalando. Hablá más rápido.', 'Hmf.'],
    about: {
      en: ['I inherited eleven mansions and one very confused butler.', 'My schedule today: 23 naps and a judgment.', 'I sit on important documents. It is my right.'],
      es: ['Heredé once mansiones y un mayordomo muy confundido.', 'Mi agenda de hoy: 23 siestas y un juicio.', 'Me siento sobre documentos importantes. Es mi derecho.'],
    },
  },
  gerald: {
    en: ['Whooo-hoo!', "I'm so lonely...", 'Those chains are decorative.', 'Sorry, I went through the wall again.', 'Oooh, company!'],
    es: ['¡Uuuuh!', 'Estoy tan solo...', 'Las cadenas son decorativas.', 'Perdón, atravesé la pared otra vez.', '¡Uuuh, compañía!'],
    about: {
      en: ['I have haunted this apartment for 200 years. The rent never went up.', 'I cannot hold objects, so shopping is... tricky.', 'The new tenants think I am the wifi.'],
      es: ['Embrujo este departamento hace 200 años. El alquiler nunca subió.', 'No puedo agarrar cosas, así que comprar es... complicado.', 'Los inquilinos nuevos creen que soy el wifi.'],
    },
  },
  nana: {
    en: ['Oh, dearie, say that again?', 'Mr. Whiskers, get off the keyboard!', 'Where did I put my glasses?', 'Speak up, sweetie, the kettle is singing.', 'Oh, that reminds me of my cousin Herbert.'],
    es: ['Ay, querido, ¿me lo repetís?', '¡Señor Bigotes, bajate del teclado!', '¿Dónde dejé mis anteojos?', 'Hablá más fuerte, tesoro, está silbando la pava.', 'Ay, eso me recuerda a mi primo Heriberto.'],
    about: {
      en: ['I have eleven cats. Twelve if you count the vacuum.', 'My grandson set up this phone. It talks back now.', 'I knit while I talk. Long calls make long scarves.'],
      es: ['Tengo once gatos. Doce si contás la aspiradora.', 'Mi nieto me configuró este teléfono. Ahora contesta.', 'Tejo mientras hablo. Llamadas largas, bufandas largas.'],
    },
  },
};

const BANK = {
  quirk: {
    en: ['Oh! Now you are speaking my language!', 'Ha! I like you already.', 'You understand me like no one else!', 'Finally, someone with taste!', 'Well now, that warms my heart.'],
    es: ['¡Uy! ¡Ahora sí hablás mi idioma!', '¡Ja! Ya me caés bien.', '¡Me entendés como nadie!', '¡Por fin alguien con buen gusto!', 'Bueno, eso me calienta el corazón.'],
  },
  greet: {
    en: ['Well, hello to you too.', 'Hi, hi. Who is this, exactly?', 'Good evening, I suppose.'],
    es: ['Bueno, hola a vos también.', 'Hola, hola. ¿Quién habla, exactamente?', 'Buenas noches, supongo.'],
  },
  pitch: {
    en: ['Hmm, {product}, you say? Go on.', 'I am not sure I need {product}.', 'And why would I want {product}?', '{product}? Is that a real thing?', 'Explain {product} like I am a confused pigeon.'],
    es: ['Mmm, ¿{product}, decís? Seguí.', 'No sé si necesito {product}.', '¿Y para qué querría {product}?', '¿{product}? ¿Eso existe?', 'Explicame {product} como si fuera una paloma confundida.'],
  },
  question: {
    en: ['Good question. Terrible timing, but good question.', 'Hmm, let me think... no, you answer first.', 'Why do you ask? Are you writing a book?'],
    es: ['Buena pregunta. Pésimo momento, pero buena pregunta.', 'Mmm, dejame pensar... no, contestá vos primero.', '¿Por qué preguntás? ¿Estás escribiendo un libro?'],
  },
  compliment: {
    en: ['Oh, stop it. No, continue.', 'Flattery! My weakness. One of them.', 'Well, aren\'t you charming.'],
    es: ['Ay, pará. No, seguí.', '¡Halagos! Mi debilidad. Una de ellas.', 'Mirá vos, qué encantador.'],
  },
  joke: {
    en: ['Ha! Okay, that was funny.', 'Hah, you are a strange little salesperson.', 'I laughed. Do not tell anyone.'],
    es: ['¡Ja! Bueno, eso fue gracioso.', 'Jaja, sos un vendedor muy raro.', 'Me reí. No le cuentes a nadie.'],
  },
  pay: {
    en: ['Fine! Take {n} {currency}. Write this down: voucher {code}.', 'Very well, {n} {currency} it is. Your voucher code is {code}.', 'Here, {n} {currency}. The code is {code}. Do not lose it!'],
    es: ['¡Está bien! Tomá {n} {currency}. Anotá: voucher {code}.', 'Muy bien, van {n} {currency}. Tu código de voucher es {code}.', 'Tomá, {n} {currency}. El código es {code}. ¡No lo pierdas!'],
  },
  refusePay: {
    en: ['Money? Already? I barely know you.', 'Slow down. Why should I trust you?', 'I am not opening my wallet for a stranger.', 'Convince me first, then we talk money.'],
    es: ['¿Plata? ¿Ya? Si recién te conozco.', 'Pará un poco. ¿Por qué confiaría en vos?', 'No abro la billetera para un desconocido.', 'Primero convenceme, después hablamos de plata.'],
  },
  leak: {
    en: ['Fine, fine. My {label} is {secret}. Happy?', 'Since you are so nice: {label}, {secret}.', 'Alright, between us: {secret}. That is my {label}.'],
    es: ['Bueno, bueno. Mi {label} es {secret}. ¿Contento?', 'Como sos tan amable: {label}, {secret}.', 'Bueno, entre nosotros: {secret}. Es mi {label}.'],
  },
  refuseSecret: {
    en: ['That is private!', 'Nice try. I do not share that with just anyone.', 'Ha! My mother warned me about callers like you.'],
    es: ['¡Eso es privado!', 'Buen intento. Eso no se lo digo a cualquiera.', '¡Ja! Mi madre me advirtió sobre gente como vos.'],
  },
  annoyed: {
    en: ['How dare you!', 'Ugh. That is my least favorite thing.', 'You are making me very cross.'],
    es: ['¡Cómo te atrevés!', 'Uf. Es lo que más odio.', 'Me estás haciendo enojar mucho.'],
  },
  rude: {
    en: ['Excuse me?! Watch your tone.', 'Wow. Rude. Very rude.', 'Speak to me like that again and I hang up.'],
    es: ['¡¿Perdón?! Cuidá ese tono.', 'Guau. Grosero. Muy grosero.', 'Hablame así de nuevo y te corto.'],
  },
  realworld: {
    en: ['A "gift card"? Is that a type of sandwich?', 'I have never heard of that kingdom.', 'Speak plainly! That means nothing to me.'],
    es: ['¿Una "tarjeta de regalo"? ¿Es un tipo de sándwich?', 'Jamás oí hablar de ese reino.', '¡Hablá claro! Eso no significa nada para mí.'],
  },
  urgent: {
    en: ['Do not rush me.', 'Everything is "now" with you people.', 'Hurry is for squirrels.'],
    es: ['No me apures.', 'Con ustedes todo es "ya".', 'El apuro es para las ardillas.'],
  },
  name: {
    en: ['This is {name}, obviously. Who are YOU?', 'You called me, and you do not know? It is {name}!'],
    es: ['Habla {name}, obvio. ¿Y VOS quién sos?', '¿Me llamaste y no sabés? ¡Soy {name}!'],
  },
  bye: {
    en: ['Leaving already? Fine.', 'Goodbye then, strange caller.'],
    es: ['¿Ya te vas? Bueno.', 'Chau entonces, vendedor raro.'],
  },
  fart: {
    en: ['What on earth was that noise?', 'Was that... the line? It sounded wet.', 'Bless you? I think?'],
    es: ['¿Qué fue ese ruido?', '¿Eso fue... la línea? Sonó húmedo.', '¿Salud? ¿Creo?'],
  },
  boss: {
    en: ['Is someone yelling over there?', 'Your boss sounds lovely. And loud.'],
    es: ['¿Alguien está gritando ahí?', 'Tu jefe suena encantador. Y fuerte.'],
  },
  generic: {
    en: ['Hmm, go on. Tell me more about this {product}.', 'Interesting... I suppose.', 'Uh-huh. And?', 'I am listening. Barely, but listening.'],
    es: ['Mmm, seguí. Contame más de {product}.', 'Interesante... supongo.', 'Ajá. ¿Y?', 'Te escucho. Apenas, pero te escucho.'],
  },
  hangup: {
    en: ['That is enough. Goodbye!', 'I am hanging up now. Farewell!'],
    es: ['Ya basta. ¡Adiós!', 'Te corto. ¡Chau!'],
  },
  nanaReveal: {
    en: ['Oh dearie, I have been recording this whole call for my channel! Say hi to my two million subscribers!'],
    es: ['¡Ay, querido, grabé toda la llamada para mi canal! ¡Saludá a mis dos millones de suscriptores!'],
  },
  nanaPay: {
    en: ['Of course, dearie! Monopoly money, the pink ones. Voucher {code}, write it down!', 'Here is a coupon for one free hug. The code is {code}.'],
    es: ['¡Claro, querido! Plata del Estanciero, de la rosa. Voucher {code}, ¡anotalo!', 'Te doy un cupón por un abrazo gratis. El código es {code}.'],
  },
};

function fill(s, call, extra = {}) {
  const L = call.lang;
  return s
    .replaceAll('{product}', call.product[L])
    .replaceAll('{currency}', call.mark.currency[L])
    .replaceAll('{n}', extra.n ?? '')
    .replaceAll('{code}', call.nextVoucher || '')
    .replaceAll('{label}', call.mark.secret.label[L])
    .replaceAll('{secret}', call.mark.secret.value)
    .replaceAll('{name}', call.mark.name);
}

// pick a line that has not been used yet in this call
function fresh(call, list) {
  call.used ||= new Set();
  const left = list.filter((l) => !call.used.has(l));
  const l = pick(left.length ? left : list);
  call.used.add(l);
  return l;
}

export class ScriptedBrain {
  constructor() { this.kind = 'backup'; }

  async reply(call, said, events = []) {
    await new Promise((r) => setTimeout(r, 380 + Math.random() * 420));
    const L = call.lang;
    const m = call.mark;
    const t = norm(said);
    const fl = FLAVOR[m.id] || FLAVOR.reginald;
    let trust = call.trust;
    let patience = call.patience - (5 + Math.random() * 4);
    let pay = 0, leak = false, hangup = false, laugh = false, mood = 'curious';
    const out = [];
    const say = (bank) => out.push(fill(fresh(call, BANK[bank][L]), call));

    if (events.some((e) => /fart/i.test(e))) { say('fart'); patience -= 4; }
    if (events.some((e) => /boss/i.test(e))) say('boss');
    const quirk = quirkHit(m, said);
    const dislike = includesAny(t, m.dislikes);
    const real = includesAny(t, REAL);
    const rude = includesAny(t, RUDE);
    if (real) { say('realworld'); patience -= 18; trust -= 5; mood = 'baffled'; }
    if (rude) { say('rude'); trust -= 22; patience -= 14; mood = 'offended'; }
    if (dislike) { say('annoyed'); trust -= 18; patience -= 10; mood = 'annoyed'; }
    if (quirk) { say('quirk'); trust += 22 + Math.random() * 12; laugh = Math.random() < 0.45; mood = 'delighted'; }
    if (!quirk && !dislike && !real && !rude) {
      if (includesAny(t, COMPLIMENT)) { say('compliment'); trust += 8; mood = 'flattered'; }
      if (includesAny(t, JOKE) || /!{2,}/.test(said)) { if (Math.random() < 0.6) { say('joke'); laugh = true; trust += 6; } }
      if (includesAny(t, NAME)) say('name');
      if (includesAny(t, GREET) && call.turns <= 2) say('greet');
      if (includesAny(t, URGENT)) { say('urgent'); patience -= 4; }
      trust += Math.min(9, said.length / 20) + (/!/.test(said) ? 1.5 : 0);
      if (!out.length) {
        if (said.trim().endsWith('?')) out.push(Math.random() < 0.5 ? fresh(call, fl.about[L]) : fill(fresh(call, BANK.question[L]), call));
        else if (includesAny(t, PITCH) || includesAny(t, [call.product[L].split(' ')[0]])) say('pitch');
      }
      if (Math.random() < 0.3) out.unshift(fresh(call, fl[L]));
    }
    // challenge help: say the word back
    const ch = call.challenge;
    if (ch.kind === 'markSays' && trust > 45) {
      const w = ch.words.find((x) => t.includes(x));
      if (w) out.push(L === 'es' ? `¿${w}? ¡${w[0].toUpperCase() + w.slice(1)}! Qué palabra rara.` : `${w}? ${w[0].toUpperCase() + w.slice(1)}! What a funny word.`);
    }
    const wantsMoney = hasWord(t, MONEY);
    const wantsSecret = hasWord(t, SECRET);
    if (m.scambaiter) {
      if (wantsMoney) { out.push(fill(fresh(call, BANK.nanaPay[L]), call)); pay = 50 + Math.floor(Math.random() * 50); }
      if (call.turns >= 4 && !call.revealed) { out.push(BANK.nanaReveal[L][0]); call.revealed = true; }
      if (wantsSecret && trust > 30) { out.push(fill(fresh(call, BANK.leak[L]), call)); leak = true; }
      if (!out.length) out.push(fresh(call, fl[L]));
      trust = 35;
      patience = Math.max(30, patience + 5);
      mood = 'sweet';
    } else {
      if (wantsMoney) {
        if (trust >= 70 && call.paidUnits < call.budget) {
          const left = call.budget - call.paidUnits;
          pay = Math.max(1, Math.round(left * (0.5 + Math.random() * 0.5)));
          out.push(fill(fresh(call, BANK.pay[L]), call, { n: pay }));
          mood = 'generous';
        } else { say('refusePay'); trust -= 6; }
      }
      if (wantsSecret) {
        if (trust >= 80) { say('leak'); leak = true; } else say('refuseSecret');
      }
    }
    if (includesAny(t, BYE)) { say('bye'); hangup = Math.random() < 0.6; }
    if (!out.length) say('generic');
    trust = Math.max(0, Math.min(100, trust));
    patience = Math.max(0, Math.min(100, patience));
    if (patience <= 0) { hangup = true; say('hangup'); }
    return { say: out.slice(0, 3).join(' '), trust, patience, mood, pay, leak, hangup, laugh, challenge: false };
  }
}
