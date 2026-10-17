import { describe, expect, it } from 'vitest';
import { isBareCommand, trimForEngine } from './filters';
import { parseKickContent } from './emoteParser';
import { isLaughter } from '~/shared/laughter';

// Every input below is a line captured on live Kick chat (2026-10-17), or a
// line built to sit right next to one and must come through untouched.

describe('bare bot commands', () => {
  it.each(['!points', '!slots 332', '!gamble all', '!watchtime', '!zar', '/me'])('%s is skipped', (t) => {
    expect(isBareCommand(t)).toBe(true);
  });

  it.each(['!jacinta eso te pasa por bocon', 'no vas a jugar?', '!!! wow que golazo', 'hola !points'])(
    '%s is not a bare command',
    (t) => expect(isBareCommand(t)).toBe(false),
  );

  it('a command carrying a sentence sends the sentence, not the command', () => {
    expect(trimForEngine('!jacinta eso te pasa por bocon')).toBe('eso te pasa por bocon');
  });
});

describe('a phrase pasted over and over', () => {
  it.each([
    ['SEM TP SEM TP SEM TP SEM TP SEM TP', 'SEM TP'],
    ['TAPA NA CARA PELOS TP TAPA NA CARA PELOS TP TAPA NA CARA PELOS TP TA', 'TAPA NA CARA PELOS TP'],
    ["I'm a BBW Lover I'm a BBW Lover I'm a BBW Lover", "I'm a BBW Lover"],
    ['BOOYAH BOOYAH booyah', 'BOOYAH'],
    ['FUGA FUGA FUGA FUGAAAAAA FUGAA FUGA', 'FUGA'],
    ['さよならそくそさよならそくそさよならそくそ', 'さよならそくそ'],
  ])('%s -> %s', (input, out) => expect(trimForEngine(input)).toBe(out));

  it.each(['Oye hoye hoye hoye hoye hoye', 'evet evet', 'grazie grazie', 'SEM TP SEM TP SEM TP and then hi', 'sí, sí, ya lo sé'])(
    '%s is left alone',
    (t) => expect(trimForEngine(t)).toBe(t),
  );
});

describe('laughter and emoji at the ends of a real line', () => {
  it.each([
    ['z gorączką na sor karetką xddd', 'z gorączką na sor karetką'],
    ['jajajaja como te explico que es Roblox', 'como te explico que es Roblox'],
    ['สบายเลยดิคิม 555555', 'สบายเลยดิคิม'],
    ['الي يكتب ٦٧ ههه', 'الي يكتب ٦٧'],
    ['hyy devathe 👋🏻', 'hyy devathe'],
    ['GATA ONLY🔥', 'GATA ONLY'],
    ['🔥vamos equipo', 'vamos equipo'],
    ['cual copia? es inspirado en xD', 'cual copia? es inspirado en'],
  ])('%s -> %s', (input, out) => expect(trimForEngine(input)).toBe(out));

  it.each(['NO VAS A JUGAR AL NUEVO COD ????', '10 ضغط', 'Такую мне на дом ))', 'xd', 'jajaja', 'yo y tu'])(
    '%s is left alone',
    (t) => expect(trimForEngine(t)).toBe(t),
  );

  it('keeps laughter in the middle, where it is part of the sentence', () => {
    expect(trimForEngine('el jajaja de antes')).toBe('el jajaja de antes');
  });
});

describe('emoji runs', () => {
  it('a run inside a line goes to the engine as one emoji', () => {
    expect(trimForEngine('MMM WhO IS ShE?🧐🧐🧐 en serio')).toBe('MMM WhO IS ShE?🧐 en serio');
    expect(trimForEngine('vamos 🔥 🔥 🔥 equipo')).toBe('vamos 🔥 equipo');
  });

  it('keeps a lone emoji and a ZWJ sequence whole', () => {
    expect(trimForEngine('te amo ❤️ mucho')).toBe('te amo ❤️ mucho');
    expect(trimForEngine('la familia 👨‍👩‍👧 hoy')).toBe('la familia 👨‍👩‍👧 hoy');
  });
});

describe('mistyped laughter', () => {
  it.each(['hahhahahahahahha', 'AHAHAAHAH', 'HAHAHAHHA', 'jJAAJAJJA', 'ahhahahah'])('%s is laughter', (t) => {
    expect(isLaughter(t)).toBe(true);
  });

  it.each(['aaaaaa', 'hhhhhh', 'haha', 'jaja', 'Harsha', 'kawawa'])('%s is not this form', (t) => {
    expect(isLaughter(t) && !/^(?:ha|ja|ah){2,}/i.test(t)).toBe(false);
  });
});

describe('links without a scheme', () => {
  it.each([
    ['Sur www.nordtvs.com tu peux écouter', 'Sur tu peux écouter'],
    ['🔥Eldorado.gg é o marketplace', '🔥 é o marketplace'],
    ['entra a discord.gg/abc ya', 'entra a ya'],
  ])('%s never reaches the engine', (input, real) => {
    expect(parseKickContent(input).realText.replace(/\s+/g, ' ').trim()).toBe(real);
  });

  it.each(['ok.so', 'e.g. this', 'son las 3.30', 'instagram.'])('%s stays text', (t) => {
    expect(parseKickContent(t).realText.trim()).toBe(t);
  });
});

describe('never turns noise into a word', () => {
  it.each(['jajaja', 'hahaha', 'kkkkkk', 'lalala', 'no no no'])('%s comes back whole', (t) => {
    expect(trimForEngine(t)).toBe(t);
  });
});

describe('Brazilian laughter seen live', () => {
  it.each(['kkkj', 'MKKKKKKKKKKKKKKKK', 'kkkkkkkkkkkkkkkkkkm', 'kkkkkkkkkkkkkkkkkkkkkkkkko', 'KAKAKAAKAKAKAKAKAKA', 'OAKAKAKAKKKAKAK', 'kkjkkk', 'klkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk', 'kkjkkkkl'])(
    '%s is laughter',
    (t) => expect(isLaughter(t)).toBe(true),
  );

  it.each(['kaka', 'kakao', 'ok', 'skate', 'kick', 'Kaká', 'akka', 'kakak', 'kukuk', 'kokok'])('%s is not', (t) => {
    expect(isLaughter(t)).toBe(false);
  });
});

describe('mostly the same few words over again', () => {
  it.each([
    ['yo quiero remiix yo quiero yo quiero remiix yo quiero yo quiero remiix', 'yo quiero remiix'],
    ['TELEGRAM TELEGRAM TELEGRAM TELEGRAM :POLICE TELEGRAM : TELEGRAM TELEGRAM TELEGRAM TELEGRAM', 'TELEGRAM :POLICE'],
  ])('%s -> %s', (input, out) => expect(trimForEngine(input)).toBe(out));

  it('keeps a real sentence whose words repeat, negation included', () => {
    const pl = 'NIE JEST W CIĄŻY BO GRUBAS JEJ NIE DYMAŁ OD ROKU ALE NIE WIE, ŻE KTOŚ INNY JĄ POMPUJE';
    expect(trimForEngine(pl)).toBe(pl);
  });
});

describe('junk appended to get past the duplicate check', () => {
  it.each([
    ['fala pro salve kosky krlh 👺 qqqq', 'fala pro salve kosky krlh'],
    ['fala pro salve kosky krlh 👺 q', 'fala pro salve kosky krlh'],
    ['fala pro salve kosky krlh 👺 qaqa', 'fala pro salve kosky krlh'],
    ['FALA PRO KOSKY MANDAR SALVE FIEL AQUI 🚨 bbbbbb', 'FALA PRO KOSKY MANDAR SALVE FIEL AQUI'],
  ])('%s -> %s', (input, out) => expect(trimForEngine(input)).toBe(out));

  it.each(['te amo ❤️ mucho', 'vienes? 🙏 no', 'listo 👍 ok', 'vamos 🔥 ya', 'qqqq sin emoji antes'])(
    '%s keeps its last word',
    (t) => expect(trimForEngine(t)).toBe(t),
  );

  it.each(['kqkqkqkkqqkkqqqkqq', 'KKKKKKKKKKKKLLL'])('%s is laughter', (t) => expect(isLaughter(t)).toBe(true));
});

// The guard on every rule above: 5040 human-labelled sentences in 42 languages,
// none of them chat noise, must reach the engine byte for byte.
describe('real sentences', () => {
  it('every Tatoeba sentence of the bench comes through untouched', async () => {
    const { LANG_CORPUS } = await import('./langCorpus');
    const changed = Object.values(LANG_CORPUS)
      .flat()
      .filter((l) => trimForEngine(l) !== l.trim());
    expect(changed).toEqual([]);
  });
});
