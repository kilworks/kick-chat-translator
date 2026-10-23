import { describe, expect, it } from 'vitest';
import { defaultSettings } from '~/shared/settings';
import {
  hasBlockedKeyword,
  isKeyboardSmash,
  isNoise,
  isSameLanguageAsTarget,
  shouldDropBySourceLang,
  shouldDropByUserOrChannel,
} from './filters';

describe('shouldDropByUserOrChannel', () => {
  it('drops the Kick bots when ignoreBots is on, whatever the case', () => {
    const s = { ...defaultSettings(), ignoreBots: true };
    expect(shouldDropByUserOrChannel({ username: 'BotRix', channel: 'foo', isBot: false }, s)).toBe('bot');
    expect(shouldDropByUserOrChannel({ username: 'sery_bot', channel: 'foo', isBot: false }, s)).toBe('bot');
  });

  // Twitch bots: never on Kick, and a viewer named like one was silenced for nothing.
  it('no longer treats Twitch bot names as bots', () => {
    const s = { ...defaultSettings(), ignoreBots: true };
    expect(shouldDropByUserOrChannel({ username: 'nightbot', channel: 'foo', isBot: false }, s)).toBeUndefined();
  });

  it("drops the user's own bots, and nothing when the option is off", () => {
    const s = { ...defaultSettings(), ignoreBots: true, extraBots: ['mybot'] };
    expect(shouldDropByUserOrChannel({ username: 'MyBot', channel: 'foo', isBot: false }, s)).toBe('bot');
    expect(shouldDropByUserOrChannel({ username: 'MyBot', channel: 'foo', isBot: false }, { ...s, ignoreBots: false })).toBeUndefined();
  });

  it('drops blacklisted users', () => {
    const s = { ...defaultSettings(), blacklistUsers: ['spammer'] };
    expect(shouldDropByUserOrChannel({ username: 'spammer', channel: 'foo', isBot: false }, s)).toBe('user_blacklisted');
  });

  it('enforces whitelist when non-empty', () => {
    const s = { ...defaultSettings(), whitelistChannels: ['adin'] };
    expect(shouldDropByUserOrChannel({ username: 'someone', channel: 'foo', isBot: false }, s)).toBe(
      'channel_not_whitelisted',
    );
  });

  it('passes by default', () => {
    expect(
      shouldDropByUserOrChannel({ username: 'someone', channel: 'foo', isBot: false }, defaultSettings()),
    ).toBeUndefined();
  });
});

describe('shouldDropBySourceLang', () => {
  it('returns undefined when allowlist empty', () => {
    expect(shouldDropBySourceLang('ja', defaultSettings())).toBeUndefined();
  });
  it('drops langs not in allowlist', () => {
    const s = { ...defaultSettings(), sourceLangAllowlist: ['ja', 'ko'] };
    expect(shouldDropBySourceLang('fr', s)).toBe('lang_not_allowed');
    expect(shouldDropBySourceLang('ja', s)).toBeUndefined();
  });
});

describe('isSameLanguageAsTarget', () => {
  it('compares case-insensitively', () => {
    expect(isSameLanguageAsTarget('EN', 'en')).toBe(true);
    expect(isSameLanguageAsTarget('ja', 'en')).toBe(false);
  });
  it('treats regional variants as the same base language', () => {
    expect(isSameLanguageAsTarget('pt', 'pt-br')).toBe(true);
    expect(isSameLanguageAsTarget('zh', 'zh-tw')).toBe(true);
    expect(isSameLanguageAsTarget('pt', 'es')).toBe(false);
  });
  it('is false when detection is undefined', () => {
    expect(isSameLanguageAsTarget(undefined, 'en')).toBe(false);
  });
});

describe('isNoise', () => {
  it('flags emoji-only', () => {
    expect(isNoise('🤣🤣🤣')).toBe(true);
    expect(isNoise('😂')).toBe(true);
  });
  it('flags laughter / w-spam (multi-language)', () => {
    expect(isNoise('wwwww')).toBe(true);
    expect(isNoise('WWWWWWWW')).toBe(true);
    expect(isNoise('jajajaja')).toBe(true);
    expect(isNoise('lolol')).toBe(true);
    expect(isNoise('kkkkkk')).toBe(true); // BR
    expect(isNoise('rsrs')).toBe(true); // BR
    expect(isNoise('huehue')).toBe(true); // BR
    expect(isNoise('xddd')).toBe(true);
    expect(isNoise('hehe')).toBe(true);
    expect(isNoise('uwu')).toBe(true);
  });
  it('flags single repeated char and punctuation', () => {
    expect(isNoise('ーーーー')).toBe(true);
    expect(isNoise('!!!')).toBe(true);
    expect(isNoise('123')).toBe(true);
  });
  it('does NOT flag real messages', () => {
    expect(isNoise('その意味は')).toBe(false);
    expect(isNoise('hola amigo')).toBe(false);
    expect(isNoise('下ネタきも')).toBe(false);
  });
});

describe('isNoise, la syllabe de rire repetee', () => {
  // `x+d+` attrapait xd, xdd et xddd, et laissait passer xdxd. Toutes les autres
  // formes a syllabe repetee etaient deja couvertes, ce qui rendait la lacune
  // difficile a voir : mesure sur la fonction livree, jaja, haha, rsrs, huehue,
  // lolol, hehe et hihi etaient ecartes sous leur forme repetee, xdxd non.
  it.each(['xd', 'xdd', 'xddd', 'xdxd', 'xdxdxd', 'xdxdxdxd', 'XDXDXD'])(
    'ecarte %s',
    (forme) => {
      expect(isNoise(forme)).toBe(true);
    },
  );

  // Le temoin de la limite : un mot qui commence par les memes lettres reste du
  // texte. Sans lui, elargir le motif jusqu'a tout avaler passerait le test.
  it.each(['xdesign', 'jajapan', 'hahaha ha que risa', 'lo mas raro'])(
    'ne touche pas a %s',
    (texte) => {
      expect(isNoise(texte)).toBe(false);
    },
  );
});

describe('username matching across letter case', () => {
  const drop = (name: string, blacklisted: string) =>
    shouldDropByUserOrChannel(
      { username: name.trim().toLowerCase(), channel: 'c', isBot: false },
      // Stored exactly as the options page stores it.
      { ...defaultSettings(), blacklistUsers: [blacklisted.trim().toLowerCase()] },
    );

  it('blocks an ASCII name whatever case it was typed in', () => {
    expect(drop('Bob', 'bob')).toBe('user_blacklisted');
    expect(drop('Bob', 'BOB')).toBe('user_blacklisted');
  });

  // Lowercasing Turkish İ in JS yields "i" plus a combining dot, and the number of
  // those dots depends on how the name was capitalised, so the same name typed in
  // a different case stopped matching itself.
  it('blocks a Turkish name whatever case it was typed in', () => {
    expect(drop('İbrahim', 'İbrahim')).toBe('user_blacklisted');
    expect(drop('İbrahim', 'İBRAHİM')).toBe('user_blacklisted');
    expect(drop('İBRAHİM', 'İbrahim')).toBe('user_blacklisted');
  });

  it('does not block a different name', () => {
    expect(drop('İbrahim', 'mehmet')).toBeUndefined();
  });
});

describe('isKeyboardSmash', () => {
  // Quinze formes attestees, dont le turc askfhsjkd et l espagnol asdasdasd.
  // Mesure avant ce filtre : zero sur quinze etait ecarte, les quinze partaient
  // au moteur, et trois en ressortaient avec une langue inventee.
  it.each([
    'askfhsjkd', 'dksajdksajdosad', 'asdasdasd', 'asdfghjkl', 'sdfsdfsdf',
    'kjhgfdsa', 'qwertyuiop', 'fjdkslafj', 'aksjdhaksjd', 'zxcvbnm',
    'hjkhjkhjk', 'lkjhgfdsa', 'ashdkjashd', 'dfghjkl', 'sdjfhskjdfh',
  ])('reconnait %s', (forme) => {
    expect(isKeyboardSmash(forme)).toBe(true);
  });

  // Les temoins de frontiere. Ce sont eux qui interdisent d elargir la regle :
  // le critere evident, l absence de voyelles, avale krk, prst et smrt, qui sont
  // de vrais mots tcheques. Ils sont ici pour que ce chemin reste ferme.
  it.each([
    'krk', 'prst', 'smrt', 'vlk', 'zmrzlina', 'ctvrtek', 'strc', 'trh',
    'wszystko', 'przypadek', 'szczescie', 'brzmi', 'pstrag', 'wzglad',
    'strength', 'rhythms', 'sphinx', 'schmutz', 'angstschreeuw',
    'hola', 'increible', 'jugada', 'bonsoir', 'magnifique',
    'aksamlar', 'nasilsiniz', 'tebrikler', 'gorusuruz',
    'obrigado', 'saudade', 'geschwindigkeit', 'goedenavond', 'alsjeblieft',
  ])('laisse passer %s', (mot) => {
    expect(isKeyboardSmash(mot)).toBe(false);
  });

  // Les mots etires. Ce sont eux qui ont casse la premiere version : une lettre
  // tenue vit forcement sur une seule rangee, donc `siiiiiiii` et `NOOOOOO`
  // portaient la signature d'un martelement et etaient ecartes comme du bruit.
  // Ce qui les separe est le nombre de lettres differentes, ou bien un GROUPE
  // repete plutot qu'une lettre tenue.
  it.each([
    'siiiiiiii', 'noooooo', 'holaaaaa', 'ouiiiii', 'siiii', 'yesssss',
    'claroooo', 'vamosss', 'goooool', 'nooooo', 'eyyyyy', 'ahhhhh', 'ouahhhh',
  ])('laisse passer le mot etire %s', (mot) => {
    expect(isKeyboardSmash(mot)).toBe(false);
  });

  // Les mots sur une seule rangee. Tous pris par la regle des rangees seule,
  // releves le 2026-10-17 : 62 dans les 27 297 mots Tatoeba de langCorpus.ts,
  // 6 sur le vrai chat Kick. Un message fait d'un seul d'entre eux etait jete.
  it.each([
    'regals', 'ritual', 'xiquet', 'europa', 'skjorter', 'bageriet', 'politiet', 'antworte',
    'karotten', 'airport', 'quiero', 'muerto', 'quejarte', 'yorkshire', 'quiera', 'quieres',
    'porque', 'naljakad', 'peaksite', 'toredad', 'nuoret', 'euroopan', 'saadakseen',
    'puuhaamassa', 'supporte', 'courrier', 'peinture', 'seperti', 'spirito', 'portarti',
    'proteggerti', 'aperto', 'aktore', 'neturiu', 'kompiuterio', 'popierius', 'triskart',
    'pasakyti', 'dariet', 'itulah', 'perlahan', 'perasaan', 'paspoort', 'rotterdam',
    'foretrekker', 'flerlags', 'papierowy', 'klasie', 'quieto', 'primeiro', 'leitores',
    'direto', 'oprostite', 'sprehajal', 'skorajda', 'utopila', 'slaget', 'tillsagd', 'djupet',
    'nagdasal', 'pasaporte', 'hayrete', 'equipo', 'portugal', 'inshallah', 'DENTROOOOOOOO',
    'PIJAMADAAAAA', 'PREDICTIONNNNNNNNNNNN', 'gaaaaaaybruuuuuu',
  ])('laisse passer le mot sur une rangee %s', (mot) => {
    expect(isKeyboardSmash(mot)).toBe(false);
  });

  it('reconnait le martelement vu sur le vrai chat', () => {
    expect(isKeyboardSmash('DJASKLJDASKJD')).toBe(true);
  });

  it('ne touche pas a une phrase, meme si un mot y ressemble', () => {
    expect(isKeyboardSmash('asdfghjkl mais je rigole')).toBe(false);
    expect(isKeyboardSmash('regarde asdfghjkl')).toBe(false);
  });

  it('ne juge pas sous six lettres, ou le signal ne veut rien dire', () => {
    expect(isKeyboardSmash('asdf')).toBe(false);
    expect(isKeyboardSmash('asdfg')).toBe(false);
    expect(isKeyboardSmash('asdfgh')).toBe(true);
  });

  it('ecarte le martelement au titre du bruit, comme le rire', () => {
    expect(isNoise('asdfghjkl')).toBe(true);
    expect(isNoise('hola amigos')).toBe(false);
  });
});

describe('hasBlockedKeyword', () => {
  const s = (blockedKeywords: string[]) => ({ ...defaultSettings(), blockedKeywords });
  it('matches case-insensitively as a substring', () => {
    expect(hasBlockedKeyword('!FISH', s(['!fish']))).toBe(true);
    expect(hasBlockedKeyword('!fish 3', s(['!fish']))).toBe(true);
    expect(hasBlockedKeyword('hi covfefe', s(['!fish']))).toBe(false);
    expect(hasBlockedKeyword('anything', s(['']))).toBe(false);
  });
});
