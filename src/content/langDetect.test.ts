import { describe, expect, it } from 'vitest';
import { confidentLanguage, detectLanguage, isLikelyEnglish } from './langDetect';

describe('detectLanguage', () => {
  it('returns en for short chat tokens like lol/gg', () => {
    expect(detectLanguage('gg ez')).toBe('en');
    expect(detectLanguage('lol')).toBe('en');
  });

  it('detects French in a clear sentence', () => {
    expect(detectLanguage('Bonjour, comment ça va aujourd’hui ?')).toBe('fr');
  });

  it('detects Japanese script', () => {
    expect(detectLanguage('こんにちは、元気ですか？')).toBe('ja');
  });

  it('detects Korean script', () => {
    expect(detectLanguage('안녕하세요 만나서 반갑습니다')).toBe('ko');
  });

  it('detects Chinese (pure Han) as zh, not Japanese', () => {
    const r = detectLanguage('我们今天天气很好一起出去玩吧朋友们');
    expect(r).not.toBe('ja');
    expect(['zh', undefined]).toContain(r);
  });

  it('keeps Japanese with kana as ja', () => {
    expect(detectLanguage('これはテストです')).toBe('ja');
  });

  it('identifies short foreign chat words instead of calling them English', () => {
    expect(detectLanguage('hola')).toBe('es');
    expect(detectLanguage('gracias')).toBe('es');
    expect(detectLanguage('merci')).toBe('fr');
    expect(detectLanguage('danke')).toBe('de');
    expect(detectLanguage('grazie')).toBe('it');
    expect(detectLanguage('obrigado')).toBe('pt');
    expect(detectLanguage('tamam')).toBe('tr');
  });

  it('stays unsure when short words disagree rather than guessing', () => {
    expect(detectLanguage('merci danke')).not.toBe('fr');
    expect(detectLanguage('merci danke')).not.toBe('de');
  });

  it('still resolves a short message mixing English filler with a foreign word', () => {
    expect(detectLanguage('ok merci')).toBe('fr');
  });

  it('leaves long messages to franc', () => {
    expect(detectLanguage('hello, how are you doing today my friend')).toBe('en');
  });

  it('falls back to English only for ASCII-only text franc cannot place', () => {
    expect(detectLanguage('...!!')).toBe('en');
    expect(detectLanguage('9 9 9')).toBe('en');
    // Same fallback, non-ASCII input: must not be claimed as English.
    expect(detectLanguage('日本')).toBeUndefined();
  });

  it('returns undefined or en for empty/very ambiguous inputs', () => {
    const r = detectLanguage('xx');
    expect([undefined, 'en']).toContain(r);
  });
});

describe('isLikelyEnglish', () => {
  it('flags clear English', () => {
    expect(isLikelyEnglish('hello, how are you doing today my friend')).toBe(true);
  });
  it('does not flag clear Japanese', () => {
    expect(isLikelyEnglish('今日は良い天気ですね')).toBe(false);
  });
});

// Korean chat writes laughter and short replies with bare jamo. They live in a
// different Unicode block from syllables, so counting only syllables let two
// jamo cancel out two syllables and drop the line below the majority threshold.
describe('bare Korean letters count as Korean', () => {
  it.each(['시발 ㅋㅋ', 'ㅇㅇ 안녕', 'ㅠㅠ 진짜'])('reads %s off its writing system', (line) => {
    expect(confidentLanguage(line)).toBe('ko');
  });

  it('leaves a Latin line to the guesser', () => {
    expect(confidentLanguage('Ese que te dijo eso es ateo')).toBeUndefined();
  });

  it('still reads Japanese off its writing system', () => {
    expect(confidentLanguage('これはテストメッセージです')).toBe('ja');
  });
});

describe('les langues proposees que rien ne detectait', () => {
  // Deux des 42 langues du produit rentraient en "langue inconnue" et le
  // pipeline ecartait le message. Mesure avant correction, sur une phrase
  // complete de chaque : malais, franc rend `zlm` et la table ne connaissait que
  // `msa` et `zsm`, donc undefined ; hebreu, franc-min ne le couvre pas du tout
  // et rend `und`, et le pre-controle par ecriture n'avait pas sa plage alors
  // qu'il a celle de l'arabe.
  it('detecte le malais, dont franc emet le code zlm', () => {
    expect(detectLanguage('selamat petang semua apa khabar hari ini di siaran ini')).toBe('ms');
  });

  // L'inverse du malais, et voulu : franc rend `arb` sur `ممنون`, qui est
  // persan. La raison et la mesure sont a cote de la table, dans languages.ts.
  it('ne nomme pas arabe ce que franc seul appelle arb', () => {
    expect(detectLanguage('ممنون')).toBeUndefined();
    expect(detectLanguage('نترس')).toBeUndefined();
  });

  it('detecte l hebreu par son ecriture, que franc-min ne couvre pas', () => {
    expect(detectLanguage('ערב טוב לכולם מה שלומכם היום בשידור החי הזה')).toBe('he');
  });

  // Le temoin de la plage : le bloc hebreu s'arrete a U+05FF, l'arabe commence a
  // U+0600. Elargir l'un jusqu'a manger l'autre passerait les deux tests
  // ci-dessus et casserait celui-ci.
  it('ne prend pas l arabe pour de l hebreu', () => {
    expect(detectLanguage('مساء الخير للجميع كيف حالكم اليوم في هذا البث')).toBe('ar');
  });
});

describe('l arabizi dans la detection ordinaire', () => {
  // La fonction `isArabizi` a sa propre batterie. Ce bloc teste la REPARATION,
  // qui est autre chose : sans lui, retirer le cablage de langDetect ne cassait
  // aucun test, et une regle qu on peut retirer sans rien casser ne sert a rien.
  it('rend ar pour un message ecrit en lettres latines', () => {
    expect(detectLanguage('ya 3ammi shu hal 7aki')).toBe('ar');
    expect(detectLanguage('kifak ya 7abibi kif el 7al')).toBe('ar');
  });

  // Le point qui compte : `confidentLanguage` alimente le `sl` envoye au moteur,
  // et annoncer l arabe sur du texte latin n a pas ete mesure. L arabizi doit
  // donc rester en dehors de la reponse sure, pour que le moteur continue de
  // deviner seul.
  it('ne devient pas une langue source sure, le moteur garde la main', () => {
    expect(confidentLanguage('ya 3ammi shu hal 7aki')).toBeUndefined();
  });

  it('ne touche pas au texte latin ordinaire', () => {
    expect(detectLanguage('hola amigos como estan todos')).toBe('es');
    expect(detectLanguage('c9 andy')).not.toBe('ar');
    expect(detectLanguage('that was gr8')).not.toBe('ar');
  });
});

// Le vote de la table porte sur les JETONS, et `detectByShortWords` decoupe sur
// les non-lettres. Une entree jugee non ambigue sur le message entier peut donc
// l'etre sur un jeton. Mesure : la forme de rire japonaise `www` portait `ja`
// avec la note "trois w ou plus, donc ce ne peut pas etre un hote www nu", et
// `www.kick.com` sortait ja AVEC sl=ja. Trois vrais noms d hotes sur quatre.
describe('un nom d hote n est pas du rire japonais', () => {
  it('ne declare pas une URL comme source japonaise', () => {
    expect(confidentLanguage('www.kick.com')).toBeUndefined();
    expect(confidentLanguage('www.example.com')).toBeUndefined();
    expect(confidentLanguage('www.twitch.tv')).toBeUndefined();
  });

  // Ce que la pleine chasse recupere en face, et pourquoi elle a le droit de
  // marquer la langue : aucun nom d hote ne s ecrit en ｗ. Seul, ou pour le
  // drapeau : a cote d un mot inconnu le rire ne nomme plus la source sure
  // (2026-11-04), sinon `helal ｗｗｗ` partait en ja.
  it('lit le rire japonais tape en pleine chasse', () => {
    expect(detectLanguage('sugoi ｗｗｗ')).toBe('ja');
    expect(confidentLanguage('ｗｗｗ')).toBe('ja');
    expect(confidentLanguage('sugoi ｗｗｗ')).toBeUndefined();
  });

  // Le prix, ecrit plutot que cache : le japonais en romaji suivi d un rire
  // demi-chasse perd sa marque. Il part au moteur avec `sl` vide, donc le moteur
  // detecte seul, ce qui est la sortie sure.
  it('et laisse le romaji plus www au moteur', () => {
    expect(confidentLanguage('sugoi www')).toBeUndefined();
  });
});

// Signale par kil en testant sur une chaine mongole. Le cyrillique rendait `ru`
// pour tout, et le rendait comme reponse SURE : vingt lignes mongoles sur vingt
// partaient au moteur en `sl=ru`, c'est-a-dire en demandant de traduire du
// mongol depuis le russe. franc ne peut rien y faire, franc-min ne porte pas le
// mongol du tout.
describe('l ecriture cyrillique se partage entre plusieurs langues', () => {
  // Le mongol n'est pas dans les 42 langues du produit, donc il rend undefined
  // et pas un code. Ce qui compte est qu'il cesse d'etre annonce russe : avec
  // `sl` vide, le moteur detecte seul et rend une vraie traduction.
  it('cesse d annoncer le mongol comme du russe', () => {
    expect(detectLanguage('энэ тоглоом хэцүү байна')).not.toBe('ru');
    expect(detectLanguage('хэн энд байна вэ')).not.toBe('ru');
    expect(confidentLanguage('юу болоод байгаа юм бэ')).toBeUndefined();
  });

  // Le temoin de frontiere : le russe ne perd rien. Douze sur douze a la mesure,
  // et aucune de ces lignes ne porte de lettre ou de particule mongole.
  it('ne prend pas le russe pour du mongol', () => {
    expect(detectLanguage('что тут происходит')).toBe('ru');
    expect(detectLanguage('спасибо за стрим')).toBe('ru');
    expect(confidentLanguage('он играет очень плохо')).toBe('ru');
  });

  // L'ukrainien EST dans les 42, donc il prend son code. Ses lettres propres
  // sont absentes du russe.
  it('lit l ukrainien a ses lettres propres', () => {
    expect(detectLanguage('що тут відбувається')).toBe('uk');
    expect(confidentLanguage('привіт усім')).toBe('uk');
  });

  // Le bulgare n'a pas de lettre exclusive : ce qui le separe est une ABSENCE,
  // le russe ecrit ы, э et ё et lui aucun des trois, plus deux signaux positifs,
  // le ъ voyelle et la copule au present que le russe n'a pas.
  it('lit le bulgare a son absence de lettres russes', () => {
    expect(detectLanguage('какво става тук')).toBe('bg');
    expect(detectLanguage('аз съм тук')).toBe('bg');
    expect(confidentLanguage('защо не работи звука')).toBe('bg');
  });

  // Le temoin qui compte le plus ici : aucune de ces lignes russes n'a servi a
  // batir la regle, et aucune ne doit basculer. Vingt-huit a la mesure.
  it('ne prend pas le russe pour du bulgare', () => {
    expect(detectLanguage('где ты')).toBe('ru');
    expect(detectLanguage('почему не работает')).toBe('ru');
    expect(detectLanguage('кто здесь')).toBe('ru');
    expect(detectLanguage('сколько времени')).toBe('ru');
  });

  // Cette ligne-la a change de camp, et c'est un progres. Elle etait ici comme
  // LIMITE : du bulgare sans marqueur, rendu russe faute de mieux. L'article
  // defini suffixe la prend maintenant, мивката porte -ата, que ni le russe ni
  // l'ukrainien n'ont. La mesure d'origine, 7 sur 12, ne portait que sur `ъ` et
  // la liste de mots.
  it('lit du bulgare sur son article defini suffixe', () => {
    expect(detectLanguage('падна ми мивката')).toBe('bg');
  });

  // La limite est maintenant ici, et elle est d'une autre nature : une ligne
  // cyrillique qui ne porte AUCUN marqueur des trois langues n'est plus rendue
  // russe par defaut, elle est rendue undefined. C'est le correctif principal de
  // cette passe : le repli `ru` etait une devinette posee sur le chemin sans
  // devinette, et il coutait 72 des 90 erreurs de ce chemin.
  it('se tait sur une ligne cyrillique sans aucun marqueur', () => {
    expect(confidentLanguage('падна ми')).toBeUndefined();
  });
});

// L'ecriture arabe n'est pas une langue. Mesure avant correction : douze lignes
// persanes sur douze rendues `ar`, et rendues comme langue source SURE, donc
// envoyees au moteur en `sl=ar`. Le persan est une des 42 langues proposees et
// la fiche des stores vend le sens droite-a-gauche par "arabe, hebreu, persan".
describe('l ecriture arabe se partage entre plusieurs langues', () => {
  it('lit le persan a ses lettres propres', () => {
    expect(detectLanguage('چه خبر')).toBe('fa');
    expect(detectLanguage('این بازی خیلی سخته')).toBe('fa');
    expect(confidentLanguage('ممنون از استریم')).toBe('fa');
  });

  // Le temoin de frontiere : l'arabe ne doit rien perdre. Aucune de ces lignes
  // ne porte de lettre persane, et douze sur douze restent `ar` a la mesure.
  it('ne prend pas l arabe pour du persan', () => {
    expect(detectLanguage('ما هذا يا رجل')).toBe('ar');
    expect(detectLanguage('شكرا على الاشتراك')).toBe('ar');
    expect(confidentLanguage('مساء الخير للجميع')).toBe('ar');
  });

  // L'ourdou porte les lettres persanes PLUS les siennes, donc il se teste en
  // premier. Il n'est pas dans les 42 langues du produit : ce qui compte est
  // qu'il cesse d'etre annonce comme arabe, pas qu'il recoive un code.
  it('n annonce pas l ourdou comme de l arabe', () => {
    expect(detectLanguage('یہ کیا ہو رہا ہے')).not.toBe('ar');
    expect(detectLanguage('بہت اچھا کھیل')).not.toBe('ar');
  });

  // CETTE LIGNE A CHANGE DE CAMP, et c'est la meme histoire que le repli
  // cyrillique juste au-dessus. Elle etait ici comme LIMITE : du persan ecrit
  // entierement avec le jeu arabe, rendu `ar` faute de mieux, et rendu comme
  // langue source SURE.
  //
  // Depuis que l'arabe doit se nommer lui-meme, plus rien ne repond sur cette
  // ligne, donc franc reprend la main et il la lit correctement. Le repli
  // codeen dur repondait A LA PLACE d'un composant mieux informe, exactement
  // comme le `ru` cyrillique, et il se trompait pour la meme raison.
  //
  // Le chemin sur, lui, se tait, ce qui est l'issue correcte : rien dans le
  // texte ne permet de trancher, donc rien n'est impose au moteur.
  it('laisse franc lire une ligne persane sans lettre persane, au lieu de repondre arabe', () => {
    expect(detectLanguage('سلام به همه')).toBe('fa');
    expect(confidentLanguage('سلام به همه')).toBeUndefined();
  });
});

// Le pre-controle par ecriture est le seul mecanisme qui sert ar, ja, ko, ru et
// zh, soit cinq des dix langues que le produit parle. Il decidait a la majorite
// de TOUT le non-ASCII, emoji compris, et un emoji ne nourrit aucune ecriture.
describe('un emoji ne dilue pas l ecriture d une ligne', () => {
  // Mesure avant correction : "да" plus deux emoji tombait a 2 sur 4, donc pas
  // de majorite stricte, donc undefined ; "رائع" plus quatre emoji tombait pareil
  // et franc reprenait la main pour repondre PERSAN sur de l'arabe. Rendre son
  // ancien denominateur a `detectByScript` rend ces deux lignes rouges.
  // L'echantillon russe etait `да`, et il a ete change pour `это`. `да` n'est pas
  // du russe : c'est aussi du bulgare, sur vingt-neuf des cent vingt lignes
  // bulgares du banc, et du serbe, et le reste. Il ne rendait `ru` que parce que
  // tout le cyrillique rendait `ru`, donc il testait le defaut plutot que
  // l'emoji. `это` est russe seul et garde le point de ce test intact.
  it('lit une ligne courte noyee sous les emoji', () => {
    expect(detectLanguage('это 😂😂')).toBe('ru');
    expect(detectLanguage('やばい 😂😂😂😂')).toBe('ja');
    expect(detectLanguage('대박 😂😂😂😂')).toBe('ko');
    expect(detectLanguage('رائع 😂😂😂😂')).toBe('ar');
  });

  // Le plancher de deux caracteres d'ecriture reste, et voici ce qu'il paie.
  // Mesure a un caractere : "Amazing play" ecrit avec un A cyrillique devient
  // russe, et "so good" avec un o cyrillique aussi. L'homoglyphe est du
  // quotidien dans un chat. Le prix accepte en face est juste en dessous.
  it('ne laisse pas un seul caractere etranger voler une ligne latine', () => {
    expect(detectLanguage('Аmazing play')).not.toBe('ru');
    expect(detectLanguage('sо good')).not.toBe('ru');
  });

  it('et paie ce plancher par le message CJK d un seul caractere', () => {
    expect(detectLanguage('は')).toBeUndefined();
    expect(detectLanguage('네')).toBeUndefined();
  });
});

describe('la portee de la table de mots courts s arrete a 20 caracteres', () => {
  // Ce test est le temoin d'une mesure, pas d'une intuition. Monter
  // SHORT_TEXT_MAX a 30 fait gagner deux lignes etrangeres sur treize et coute
  // le message qui change de langue : sur huit lignes melangees, les lignes
  // tuees avant l'appel passent de 3 a 6 et les `sl` declares sur une seule
  // moitie de 0 a 4. Ces deux-la sont a 25 et 21 caracteres : un seul mot
  // etranger dans une phrase anglaise, ce que le vote a l'unanimite ne peut pas
  // voir puisque l'anglais n'est pas dans la table.
  //
  // Le `sl` est ce qui rend le cas grave : "merci bro that was insane" partirait
  // au moteur en `sl=fr` et disparaitrait pour un lecteur francophone.
  it('ne declare pas une langue sure sur un seul mot etranger', () => {
    expect(confidentLanguage('merci bro that was insane')).toBeUndefined();
    expect(confidentLanguage('tamam kanka good game')).toBeUndefined();
  });
});

describe('les langues romanisees dans la detection ordinaire', () => {
  // La fonction a sa propre batterie. Ce bloc teste la REPARATION, sans quoi
  // retirer le cablage ne casserait rien, et une regle qu on peut retirer sans
  // rien casser ne sert a rien.
  it('rend la langue au lieu d une devinette latine', () => {
    // Avant : id pour le russe, rien pour le grec et le japonais.
    expect(detectLanguage('privet kak dela segodnya')).toBe('ru');
    expect(detectLanguage('ti kaneis re file einai kalo')).toBe('el');
    expect(detectLanguage('konnichiwa minna genki desu ka')).toBe('ja');
  });

  it('ne devient pas une langue source sure, le moteur garde la main', () => {
    expect(confidentLanguage('privet kak dela segodnya')).toBeUndefined();
  });
});

describe('detection memo', () => {
  it('answers the same after its entries have been evicted', () => {
    const line = 'je ne sais pas pourquoi il fait ca';
    const first = [detectLanguage(line), confidentLanguage(line)];
    for (let i = 0; i < 2000; i++) detectLanguage(`filler line number ${i}`);
    expect([detectLanguage(line), confidentLanguage(line)]).toEqual(first);
    expect(first[0]).toBe('fr');
  });
});

// The confident answer becomes the provider's source language and drives the
// same-language skip, so a wrong one costs more than silence. Each line below
// was named wrongly by one rule before 2026-11-03; each keep-line is the rule's
// own language, so the fix cannot have been bought by deleting the rule.
describe('confidentLanguage does not name a language on common chat words', () => {
  const wrong: [string, string][] = [
    ['buenisimo el clutch', 'it'],
    ['nem fodendo', 'hu'],
    ['arigatou gozaimasu', 'pt'],
    ['zashto ne govori', 'sl'],
    ['kya baat hai bhai', 'nl'],
    ['yaar mast stream', 'nl'],
    ['kitne saal ka hai', 'nl'],
    ['wait for it', 'fr'],
    ['that was bait', 'fr'],
    ['heyyy guys', 'fi'],
    ['heyy guys', 'fi'],
    ['okayy then', 'fi'],
    ['lich king', 'de'],
    ['го еще катку', 'bg'],
    ['давай ще одну', 'bg'],
    ['kkkk no way bro', 'pt'],
    ['wkwkwk what', 'id'],
  ];
  for (const [line, was] of wrong) {
    it(`no longer says ${was} for "${line}"`, () => {
      expect(confidentLanguage(line)).not.toBe(was);
    });
  }

  it('says nothing rather than ru when only the shared ще decides', () => {
    expect(confidentLanguage('давай ще одну')).toBeUndefined();
  });

  it('keeps the languages those rules exist for', () => {
    expect(confidentLanguage('bellissimo questo gioco')).toBe('it');
    expect(confidentLanguage('che bella partita')).toBe('it');
    expect(confidentLanguage('pyydän anteeksi')).toBe('fi');
    // Le rire a cote d un mot que la table ne connait pas ne nomme plus la source
    // sure : `kkkk was zum` sortait pt. Il garde le drapeau et les filtres.
    expect(confidentLanguage('kkkk mano')).toBeUndefined();
    expect(detectLanguage('kkkk mano')).toBe('pt');
    expect(detectLanguage('wkwk anjir')).toBe('id');
    expect(detectLanguage('jajaja que buena')).toBe('es');
    expect(confidentLanguage('kkkk was zum')).toBeUndefined();
    expect(confidentLanguage('que golazo ㅋㅋㅋ')).toBeUndefined();
    expect(confidentLanguage('ㅋㅋㅋ 진짜')).toBe('ko');
    expect(confidentLanguage('това е много добре')).toBe('bg');
  });
});

// Lues sur les corpus 4 et 5 devenus bancs de reglage (2026-11-04) : chacune
// nommait une langue sure fausse.
describe('les regles lues sur les corpus 4 et 5', () => {
  it('ne prend pas le fuer allemand pour de l espagnol', () => {
    expect(confidentLanguage('was fuer ein clip')).not.toBe('es');
    expect(confidentLanguage('fuera de aqui')).toBe('es');
  });

  it('reconnait le hinglish de tous les jours avant le -aar neerlandais', () => {
    expect(confidentLanguage('sab kuch haar gaya lol')).toBeUndefined();
    expect(confidentLanguage('phir se sab slots me haar gaya')).toBeUndefined();
  });

  it('ne lit pas -aat neerlandais sur une ligne finnoise a ii', () => {
    expect(confidentLanguage('kiitti kun streamaat')).not.toBe('nl');
    expect(confidentLanguage('hij gaat naar huis')).toBe('nl');
  });

  it('tient le russe en lettres latines a ch et -noe pour russe', () => {
    expect(confidentLanguage('eys byl chistyy')).toBeUndefined();
    expect(confidentLanguage('stavi vse na krasnoe')).toBeUndefined();
  });

  it('laisse pfv au portugais devant som slovaque', () => {
    expect(confidentLanguage('abaixa o som da música pfv')).not.toBe('sk');
  });
});
