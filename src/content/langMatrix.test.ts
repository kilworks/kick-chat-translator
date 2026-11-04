import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { confidentRun, detectRun, type Cell } from './langMatrix';
import { confidentLanguage } from './langDetect';
import { LANG_CORPUS } from './langCorpus';
import { LANGUAGES } from '~/shared/languages';

/**
 * The cross-language baseline, asserted so the next change has to move it on
 * purpose. What the numbers mean and why they are never added together is in
 * `langMatrix.ts`; the human report is `test/e2e/lang-matrix.md`,
 * rebuilt with `node --import tsx test/e2e/lang-matrix.mjs`.
 *
 * These are a record of what the code does today, not a target. Moving them is
 * expected. Moving them without saying which way and why is not, and that is the
 * whole job of this file: `langDetect.latin.test.ts` has been holding 33 right /
 * 7 silent / 11 wrong on 51 lines for the same reason, and this is that
 * discipline on 5040 lines and 42 languages.
 */

const CONFIDENT = confidentRun();
const DETECT = detectRun();

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('baseline, 2026-09-21, Tatoeba corpus', () => {
  // Doing its job: it answers on two lines in five and is almost never wrong.
  // The engine detects the rest itself, which is the safe outcome.
  it('confidentLanguage stays quiet and is rarely wrong', () => {
    // 3731 avant le 2026-11-03. Les quinze lignes perdues sont sept phrases
    // hongroises qui ne portaient que `nem` et huit bulgares qui ne portaient que
    // `го` ou `ще` : retirees parce qu'elles nommaient a tort le portugais, le
    // russe de chat et l'ukrainien. Silencieuses, pas fausses : wrong reste a 3.
    // 3716 avant le 2026-11-04 : `No, no, no!` ne sort plus en, `no` etant aussi
    // espagnol, italien et portugais.
    expect(plain(CONFIDENT.total)).toEqual({ right: 3715, silent: 1322, wrong: 3 });
  });

  it('confidentLanguage on short lines, the regime a chat lives in', () => {
    expect(plain(CONFIDENT.shortOnly)).toEqual({ right: 1071, silent: 606, wrong: 3 });
  });

  // The expensive one. This is the answer that deletes a message in silence when
  // it believes the line is already in the reader's language, and that is handed
  // to the on-device engine as a source language on Chrome, where the on-device
  // engine is the default.
  it('detectLanguage is wrong on a fifth of all lines', () => {
    // 4154/498 avant le 2026-11-03 : deux des huit phrases bulgares devenues
    // silencieuses sur le chemin sur tombent sur franc, qui les dit uk et ru.
    // 4152/388 avant le 2026-11-04 : la meme `No, no, no!`, que franc ne nomme pas.
    expect(plain(DETECT.total)).toEqual({ right: 4151, silent: 389, wrong: 500 });
  });

  it('detectLanguage is wrong on a quarter of short lines', () => {
    expect(plain(DETECT.shortOnly)).toEqual({ right: 1215, silent: 235, wrong: 230 });
  });
});

const zeroRight = (run: typeof DETECT): string[] =>
  [...run.byLang.entries()]
    .filter(([, b]) => b.short.right + b.medium.right + b.long.right === 0)
    .map(([lang]) => lang)
    .sort();

describe('the languages the detector cannot name at all', () => {
  // EMPTY, and it took four passes to get there. Ten of forty-two scored zero at
  // the start of phase 2: never right, on any line, at any length. `zh-tw` left
  // on the two Chinese character sets, `ca lt lv sk` on the exclusive-letter
  // table, `da no` on the pair rule that reads ø and æ then picks with a word,
  // and the last three, `et fi sl`, on the chat lexicon, which was the only
  // thing that could reach them because they share every letter they use with a
  // neighbour and have no pair marker either.
  //
  // The list staying empty is now the assertion. A language falling back into it
  // is a regression, not a starting point.
  it('leaves no language scoring zero', () => {
    expect(zeroRight(DETECT)).toEqual([]);
  });

  // The other half of the same problem, and the reason phase 1 cannot simply
  // swap the raw guess for the safe one: the safe one now names all forty-two
  // languages of this corpus, where it named sixteen. Sixteen before the exclusive
  // letters, twenty-nine after them.
  //
  // Read this one with a caveat, because it flatters nothing and misleads in
  // both directions. Tatoeba is written sentences, and the short-word lexicon
  // that feeds `confidentLanguage` is a chat vocabulary: hola, merci, danke,
  // selam. A Spanish Tatoeba sentence contains none of them, so `es` scores zero
  // here while it would score on a real chat line. That is no longer a supposition:
  // `langChat.test.ts` measures it, and on chat register the two score 3 and 1 of
  // 15. They are an artefact of the corpus, not of the detector.
  it('leaves no language the confident path cannot name', () => {
    expect(zeroRight(CONFIDENT)).toEqual([]);
  });

  // Two scripts that were simply not counted. Every Bengali and Tamil line, at
  // every length, on both paths: 120 of 120. The gain is on the confident path,
  // which was mute on both and now hands the engine a source language it can
  // read straight off the alphabet.
  it('reads Bengali, Tamil and Greek off their alphabets', () => {
    // Greek was the same hole again, found two passes later: eleven scripts are
    // counted now and it was the eleventh. franc already named it, so the raw
    // path never moved and nothing looked broken; the confident path was mute,
    // so the engine was never told the source language of a Greek line although
    // the alphabet says it with no ambiguity at all. 0 to 120 on the confident
    // path, and the raw path is byte for byte what it was.
    for (const lang of ['bn', 'ta', 'el']) {
      for (const run of [DETECT, CONFIDENT]) {
        const b = run.byLang.get(lang)!;
        expect(b.short.right + b.medium.right + b.long.right, lang).toBe(120);
      }
    }
  });

  // The Scandinavian case: a real language with no rule of its own, absorbed by
  // a bigger neighbour franc does model. Catalan used to sit here too and is
  // down by one line, which is the honest size of `l·l`: the middle dot is a
  // certainty when it appears and it appears twice in 120 lines.
  it('still hands most of the Nordic languages to Swedish, and Catalan to Spanish', () => {
    // 48 and 44 before the pair rule. It scores both languages without closing
    // either pair, which is the same shape as Catalan below it: leaving the
    // zero list and fixing the confusion are two different things, and only the
    // first has happened.
    //
    // CATALAN IS THE ONE THAT MOVED LAST AND MOVED MOST, 42 to 31 to 29 and now
    // to 17, with `ca->fr` at 11 from 19. The gates were never going to close it:
    // `porte-partagee-diagnostic.mjs` counted 63 of its 155 lines opening NO gate
    // at all, because they carry no accented letter for a gate to fire on. Ten
    // unaccented function words in the exclusive table, five of them promoted out
    // of the gate set where they could never be reached, took `ca` from 36 of 120
    // to 65.
    //
    // THE NORDIC PAIR DID NOT MOVE UNDER ANY OF THE THREE LETTER ROUNDS, for a
    // structural reason: neither language writes a letter the table covers. It
    // moved on the fourth, when the Nordic gate stopped requiring a Scandinavian
    // letter at all and opened on `jeg` and `ikke`, which only these two write.
    // 41 and 39 down to 39 and 34, then to 38 and 32 when the inner sort got
    // the Danish g against the Norwegian k, `øj` against `øy`, then to 36 when
    // `gje` and `æl` started naming the two languages outright, then to 34 and
    // 31 on `jø` and `hun`. Eight rounds, 41 and 39 down to 34 and 31.
    //
    // THE NINTH ROUND IS THE ONE THAT PAID, and it did not touch the gate at
    // all. `porte-diagnostic.mjs` separates two causes of silence, and for
    // Norwegian the answer had moved: 34 lines did not open the gate, but
    // FORTY-SIX opened it with nothing behind to decide. Fourteen spelling
    // sequences later, `no` is 49 of 120 and `da` is 51, from 37 and 31, and
    // the two pairs are 28 and 24. `da->nl` fell from 28 to 22 with them,
    // which nothing in this round was aiming at.
    //
    // TENTH ROUND, the trigger side: four words both write and Swedish does not,
    // `bare` against `bara`, `selv` against `själv`, `mange` against `många`,
    // `hvem` against `vem`. 28 and 24 to 26 and 22, and `no` 49 of 120 to 51,
    // `da` 51 to 55.
    expect(DETECT.confusions.get('no->sv')).toBe(26);
    expect(DETECT.confusions.get('da->sv')).toBe(22);
    expect(DETECT.confusions.get('ca->es')).toBe(17);
  });
});

describe('a letter only one of the forty-three writes, added 2026-09-21', () => {
  // The whole case for putting this on the confident path: a letter no other
  // offered language writes is a lookup, not a guess, so it is the same kind of
  // fact as a whole script. The measurement that had to come back clean is this
  // one: the rule hands the engine ten more source languages and takes nothing
  // from the other thirty-two. It did not raise either wrong count: 91 and 54
  // before it, 90 and 53 after, the extra line coming from reading a letter
  // ahead of the lexicon. The counts are lower again now for a reason that has
  // nothing to do with this rule, and it is the block below.
  const NAMED = ['ca', 'cs', 'hu', 'lt', 'lv', 'pl', 'ro', 'sk', 'tr', 'vi'];

  it('never takes a line from a language that is not its own', () => {
    const into = [...CONFIDENT.confusions.keys()].filter((p) => NAMED.includes(p.split('->')[1]!));
    expect(into).toEqual([]);
  });

  it('names ten languages the confident path was mute on', () => {
    for (const lang of NAMED) {
      const b = CONFIDENT.byLang.get(lang)!;
      expect(b.short.right + b.medium.right + b.long.right, lang).toBeGreaterThan(0);
    }
  });

  // The one correction the bench forced on the table as designed. Polish was
  // meant to be found by ł, which no other offered language writes; but a letter
  // being exclusive to a language is not the same as a line carrying it being in
  // that language. This Slovak sentence is about the children of Łazarz and
  // holds no exclusive Slovak letter, so the unanimous vote does not save it.
  // żźćśń replaces ł and is strictly better: 70 Polish lines instead of 48, and
  // nothing taken. Putting ł back costs this line.
  it('does not read a Polish name in a Slovak sentence as Polish', () => {
    const line = 'Łazarzove deti si myslia, že ich mama Felicja je najkrajšia žena na svete.';
    expect(confidentLanguage(line)).not.toBe('pl');
  });

  // The pair the design flagged as the trap, kept here because the two sets are
  // one keystroke apart and a future edit merging them would be silent.
  it('keeps the Polish nasals out, which Lithuanian also writes', () => {
    expect(confidentLanguage('Ar tu eini į parduotuvę šiandien vakare?')).not.toBe('pl');
  });

  // The rule reads before the short-word lexicon, and that order is measured
  // rather than assumed: this line is the whole of the difference on 5040 lines.
  // It is Lithuanian, its ė settles it, and the lexicon used to see `mano` and
  // answer Portuguese. Putting the lexicon back in front costs exactly this.
  it('lets a letter beat a chat word that is a word in two languages', () => {
    expect(confidentLanguage('Ar ji mano draugė?')).toBe('lt');
  });

  // CONSTRUCTED, not measured, and the distinction matters enough to write down:
  // no line of the corpus carries two exclusive sets at once, so the bench says
  // nothing at all about this branch. It is kept because the register the corpus
  // does not have is the one that mixes languages in a single line, quoting a
  // name or a pseudonym, and that is what phase 0b is for. Until then this is a
  // guard with a hand-written check rather than a measurement.
  it('declines when two exclusive sets meet, which is a quote or a nickname', () => {
    expect(confidentLanguage('řeka')).toBe('cs');
    expect(confidentLanguage('ľad')).toBe('sk');
    expect(confidentLanguage('řeka ľad')).toBeUndefined();
  });
});

describe('the two Chinese scripts, fixed 2026-09-21', () => {
  // Before the rule: 120 of 120 traditional lines answered `zh`, flag of China
  // included. Read the recall with its caveat, spelled out in langDetect.ts: the
  // corpus is split from Tatoeba's single `cmn` export by character set and the
  // rule reads the same character set, so recall here is one statement said
  // twice. The distinction IS a character set, so there is nothing else to read.
  it('no longer answers every traditional line as simplified', () => {
    // 120 of 120 before, 15 now, and those 15 are not a rule failure: they carry
    // no marker from either script, so the rule declines, and franc then answers
    // the way it always has, `cmn` for the whole of Han, which FRANC_MAP sends
    // to `zh`. Closing those needs franc out of this path, not a longer list.
    expect(DETECT.confusions.get('zh-tw->zh')).toBe(15);
    expect(zeroRight(DETECT)).not.toContain('zh-tw');
  });

  // This is the half that is a measurement rather than a definition, and the
  // half that could have gone wrong: nothing outside Chinese trips the rule.
  it('never leaks into a language that is not Chinese', () => {
    const intoChinese = [...DETECT.confusions.entries()]
      .filter(([pair]) => /->zh(-tw)?$/.test(pair))
      .map(([pair, n]) => `${pair}=${n}`)
      .sort();
    // yue is expected and is the price of the rule: Cantonese is written in
    // traditional characters, so a yue line with every Cantonese word gone can
    // only be read by its script. zh-tw->zh is the franc fallback above.
    expect(intoChinese).toEqual(['yue->zh-tw=1', 'yue->zh=5', 'zh-tw->zh=15']);
  });

  // The confident path is the one that matters for this trade, because it is
  // what reaches the engine. There, the same leak is two lines out of 120.
  it('costs two Cantonese lines on the path that reaches the engine', () => {
    const leak = [...CONFIDENT.confusions.entries()].filter(([p]) => /->zh(-tw)?$/.test(p));
    expect(leak.reduce((s, [, n]) => s + n, 0)).toBe(2);
  });
});

describe('when a letter names a pair instead of a language, added 2026-09-21', () => {
  // The case the exclusive-letter table had to leave out. ø and æ belong to
  // Danish AND Norwegian, so they name nobody; but measured across all 5040
  // lines they touch those two languages and nothing else, 55 Danish lines and
  // 34 Norwegian. That is a strong signal on a set of two, and one more round
  // picks inside it.
  it('reads the pair marker on nothing but Danish and Norwegian', () => {
    const carriers = Object.entries(LANG_CORPUS)
      .filter(([, lines]) => lines.some((t) => /[øæ]/iu.test(t)))
      .map(([l]) => l)
      .sort();
    expect(carriers).toEqual(['da', 'no']);
  });

  // What the gate hands over for free, and the reason the rule works at all:
  // Swedish is already excluded, so mig/dig/sig and av become clean markers
  // behind it although they are unusable in the open. A word that is ambiguous
  // among forty-three can be decisive inside a pair of two.
  it('picks inside the pair on words that are ambiguous outside it', () => {
    expect(confidentLanguage('Han tog sit tøj af.')).toBe('da');
    expect(confidentLanguage('Kalven lærer av kua.')).toBe('no');
  });

  // Un cran de plus : `å` est ecrit par les TROIS langues, donc il nomme le trio
  // et il faut sortir le suedois avant de se servir de mots qui lui sont
  // ambigus. C'est ce qui a fait passer le suedois de 3 a 20 lignes sur la
  // moitie tenue a l'ecart.
  it('sort le suedois quand la lettre ne nomme que le trio', () => {
    expect(confidentLanguage('Jag är bra på spel.')).toBe('sv');
    expect(confidentLanguage('Jeg ser du står på, men ikke overanstreng deg.')).toBe('no');
    // Et le cas qui rend l'ordre necessaire : une ligne suedoise avec å seul,
    // sur laquelle mig, dig et sig ne seraient pas surs si on les consultait.
    expect(confidentLanguage('Snart är det vår.')).toBe('sv');
  });

  // Both sets or neither declines, same unanimous vote as everywhere else here.
  it('declines when the line carries both sets', () => {
    expect(confidentLanguage('Han tog sit tøj af, og han ville se meg.')).toBeUndefined();
  });

  // Nothing taken from the other forty, which is the protocol this repo applies
  // to any addition on the confident path.
  it('takes no line from any other language', () => {
    const into = [...CONFIDENT.confusions.keys()].filter((p) => /->(da|no)$/.test(p));
    expect(into).toEqual([]);
  });
});

describe('Malay written in the Arabic script, added 2026-09-21', () => {
  // Six of the 120 Malay lines are in Jawi, which is Arabic script, and the
  // script check read them correctly and concluded Arabic. Same shape as Persian
  // right above it: Jawi adds letters to the Arabic set, so those letters name
  // it. Three of the six carry one and are now read as Malay.
  it('reads Jawi letters as Malay rather than Arabic', () => {
    expect(confidentLanguage('دي سدڠ بلاجر بهاس ايڠڬريس.')).toBe('ms');
  });

  // The order inside the rule is what makes it work: Jawi is tested before
  // Persian because it uses چ, which is in the Persian set. Testing it after
  // would leave a Jawi line carrying a cheh reading as Persian, which is exactly
  // the ms->fa error that remains on the line that carries no Jawi letter.
  //
  // 113 to 116 since the Persian WORDS were added after the Persian letters,
  // for the lines written entirely with the Arabic set. The order is the same
  // argument one step further: Urdu, then Jawi, then a Persian letter, then a
  // Persian word, each one a weaker claim than the one above it.
  it('does not take Persian lines, which share the cheh', () => {
    const intoMalay = [...CONFIDENT.confusions.keys()].filter((p) => p.endsWith('->ms'));
    expect(intoMalay).toEqual([]);
    expect(CONFIDENT.byLang.get('fa')!.short.right
      + CONFIDENT.byLang.get('fa')!.medium.right
      + CONFIDENT.byLang.get('fa')!.long.right).toBe(116);
  });
});

describe('the Cyrillic fallback, fixed 2026-09-21', () => {
  // The biggest single defect the matrix ever found, and it was not a missing
  // rule: it was a guess wearing a lookup's clothes. `cyrilliqueQuelleLangue`
  // answered `ru` for any Cyrillic line it could not name, and it lives inside
  // `detectByScript`, so `confidentLanguage` took that guess for a reading and
  // handed it to the engine as a source language. 50 Bulgarian lines and 22
  // Ukrainian ones were called Russian: four fifths of the whole error budget of
  // the path that reaches the engine.
  it('no longer calls Bulgarian and Ukrainian lines Russian on the safe path', () => {
    expect(CONFIDENT.confusions.get('bg->ru')).toBeUndefined();
    expect(CONFIDENT.confusions.get('uk->ru')).toBeUndefined();
  });

  // What is left, in full, because ten is small enough to name and naming it is
  // what stops the next session from re-deriving it.
  //
  // NOT ONE LATIN CONFUSION LEFT, which is where forty-two of the forty-three
  // languages live. `mano` took the last two out. Everything remaining is a
  // line whose SCRIPT is read correctly and whose language behind that script
  // is the part a letter cannot see.
  //
  // `fa->ar` WAS SEVEN, THEN FOUR, AND IS NOW ZERO. Persian words took three;
  // the last four carried neither a Persian letter nor a Persian function
  // word, and no seventh word was going to reach them. What closed them is
  // that Arabic now has to name itself instead of being the default answer
  // when nothing else speaks up.
  //
  // `ms->ar` is the one line left in the Arabic script, `هيدو اين.`, whose
  // only usable word is `اين`, which Arabic also writes. `yue->zh` twice is
  // two Tatoeba lines that are standard Chinese under a yue label, one of them
  // in simplified characters, so no marker can reach them either.
  //
  // NOTHING IN A LATIN OR CYRILLIC SCRIPT IS WRONG ANY MORE, and of the three
  // that are left, two are a corpus defect rather than a detector defect.
  it('is down to three wrong answers, and they are these', () => {
    const rows = [...CONFIDENT.confusions.entries()].map(([p, n]) => `${p}=${n}`).sort();
    expect(rows).toEqual(['ms->ar=1', 'yue->zh-tw=1', 'yue->zh=1']);
  });

  // The half of the result that was not the point and matters more than the
  // point. Removing the fallback was expected to buy silence with recall; it
  // bought recall too, because franc models rus, ukr and bul and separates them
  // better than a hardcoded constant did. A rule that answers instead of a
  // better-informed component is worse than no rule.
  it('made the raw path better on both axes at once, not just quieter', () => {
    expect(DETECT.total.right).toBeGreaterThan(3325);
    expect(DETECT.total.wrong).toBeLessThan(1024);
  });

  // The fragile part, written down because it is invisible: the Russian
  // infinitive marker -ть also ends eleven Ukrainian lines of this corpus, and
  // it is harmless only because the Ukrainian test runs before it. Moving that
  // test below this one turns those eleven into Russian.
  it('keeps Ukrainian lines that end in the Russian infinitive marker', () => {
    for (const line of ['Дні стають довшими.', 'Птахи літають.', 'Я візьму участь.']) {
      expect(confidentLanguage(line), line).toBe('uk');
    }
  });

  // The Bulgarian article suffix, which neither Russian nor Ukrainian has. The
  // candidates that did not survive full exposure are named in langDetect.ts,
  // and -ите is the one to remember: it is the Russian plural imperative.
  it('reads Bulgarian off its suffixed definite article', () => {
    expect(confidentLanguage('Крушката изгоря.')).toBe('bg');
  });
});

describe('the corpus itself', () => {
  it('covers every offered language except the one Tatoeba cannot split', () => {
    const offered = LANGUAGES.map((l) => l.code);
    // pt-br is the only expected gap: Tatoeba publishes one Portuguese export
    // and does not mark the Brazilian/European split.
    expect(offered.filter((c) => !(c in LANG_CORPUS))).toEqual(['pt-br']);
    expect(Object.keys(LANG_CORPUS).filter((c) => !offered.includes(c))).toEqual([]);
  });

  it('never answers with a language the product does not offer', () => {
    const offered = new Set(LANGUAGES.map((l) => l.code));
    const bad = [...new Set([...CONFIDENT.confusions.keys(), ...DETECT.confusions.keys()])]
      .map((k) => k.split('->')[1]!)
      .filter((to) => !offered.has(to));
    expect([...new Set(bad)]).toEqual([]);
  });
});

describe('neither the corpus nor the matrix reaches the shipped extension', () => {
  // 206 KB of Tatoeba sentences inside a content script injected on every
  // kick.com page would be a real regression, and an accidental import is the
  // easy way to cause it. The guard is static so it does not need a build:
  // nothing outside a test or this module may name either file.
  it('is imported by tests only', () => {
    const src = resolve(process.cwd(), 'src');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
        if (
          entry === 'langMatrix.ts' ||
          entry === 'langCorpus.ts' ||
          entry === 'langChatCorpus.ts' ||
          entry === 'langChatCorpus2.ts' ||
          entry === 'langChatCorpus3.ts' ||
          entry === 'langChatPaireCorpus.ts' ||
          entry === 'langChatPaireReglageCorpus.ts' ||
          entry === 'langChatNonLatin.ts' ||
          entry === 'langChatDixCorpus.ts' ||
          entry === 'langMixedCorpus.ts'
        ) {
          continue;
        }
        if (/from '\.{0,2}[^']*lang(\w*Corpus|Matrix)'/.test(readFileSync(full, 'utf8'))) {
          offenders.push(full.slice(src.length + 1));
        }
      }
    };
    walk(src);
    expect(offenders).toEqual([]);
  });
});

describe('aucune entree de lexique ne peut etre masquee par une lettre exclusive', () => {
  // UNE CLASSE ENTIERE DE CODE MORT, et elle se prouve sans corpus.
  //
  // `detectByLookup` lit la table des lettres exclusives AVANT le lexique,
  // commit `528c3af`. Donc une entree de lexique dont l'orthographe contient une
  // lettre exclusive de SA PROPRE langue ne peut jamais se declencher : la
  // lettre a deja repondu, et la meme reponse. Elle ne coute pas une erreur,
  // elle coute des octets et une ligne que quelqu'un relira un jour.
  //
  // Quatorze entrees etaient dans ce cas, et elles y etaient arrivees par en
  // haut : elles ont ete ecrites quand la table des lettres etait plus courte,
  // et c'est la table qui les a rattrapees. `teşekkür` et `kardeşim` sont mortes
  // le jour ou le s cedille est entre, dans cette meme passe.
  //
  // Le garde est statique et lit la source, comme celui du bundle au-dessus : ni
  // `SHORT_WORD_LANG` ni `LETTRES_EXCLUSIVES` n'est exporte, et les exporter
  // pour un test serait payer en surface publique ce qu'on gagne en confort.
  it('ne laisse aucune entree ombragee dans SHORT_WORD_LANG', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/content/langDetect.ts'), 'utf8');
    /** langue -> lettres que la table lui donne en propre, une par une. */
    const exclusives = new Map<string, Set<string>>();
    for (const m of src.matchAll(/\[\/\[([^\]]+)\]\/[a-z]*, '([a-z-]+)'\],/g)) {
      const classe = m[1]!;
      const lang = m[2]!;
      const vu = exclusives.get(lang) ?? new Set<string>();
      for (const c of classe) vu.add(c.toLowerCase());
      exclusives.set(lang, vu);
    }
    // Une lettre seule hors classe, `[/ñ/iu, 'es']`, compte pareil.
    for (const m of src.matchAll(/\[\/(\p{L})\/[a-z]*, '([a-z-]+)'\],/gu)) {
      const lettre = m[1]!;
      const lang = m[2]!;
      const vu = exclusives.get(lang) ?? new Set<string>();
      vu.add(lettre.toLowerCase());
      exclusives.set(lang, vu);
    }
    const ombragees: string[] = [];
    for (const m of src.matchAll(/\['([^']+)', '([a-z-]+)'\],/g)) {
      const mot = m[1]!;
      const lang = m[2]!;
      const propres = exclusives.get(lang);
      if (!propres) continue;
      const touche = [...mot.toLowerCase()].filter((c) => propres.has(c));
      if (touche.length > 0) ombragees.push(`${mot} (${lang}, ${[...new Set(touche)].join('')})`);
    }
    expect(ombragees).toEqual([]);
  });
});

describe('aucun declencheur de porte n est aussi un mot qui tranche derriere elle', () => {
  // LE DEFAUT, paye deux fois, et il ne fait pas tomber un test tout seul.
  //
  // Une porte a deux etages : un declencheur qui dit "cette ligne appartient a
  // l'une de ces deux langues", puis un jeu de mots par langue qui choisit
  // dedans. Si un mot est dans le declencheur ET dans un des deux jeux, il fait
  // les deux tout seul : il ouvre la porte sur une ligne de l'AUTRE langue, puis
  // il decide en faveur de la sienne. Les deux indices censes etre independants
  // n'en font qu'un.
  //
  // Premiere fois : `dz` comme porte pl/lv/sk, ou `bardzo` porte la sequence ET
  // est le mot polonais du jeu. Trois lignes melangees nommees polonaises.
  // Deuxieme fois : `hvor` ajoute au declencheur dano-norvegien alors qu'il est
  // dans `MOTS_NORVEGIENS`. Deux lignes danoises parties au norvegien.
  //
  // Les deux ont ete attrapes par le diff a cinq bancs, donc apres coup. Ce
  // garde-ci les attrape a l'ecriture, et il coute une lecture de la source.
  it('ne partage aucun mot entre un declencheur et ses jeux', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/content/langDetect.ts'), 'utf8');
    /**
     * Les mots de l'alternance d'une constante nommee.
     *
     * La regex porte TROIS groupes, `(^|[^\p{L}])(les|mots|ici)([^\p{L}]|$)`,
     * et c'est celui du milieu qu'on veut. On les prend tous et on garde le plus
     * long en nombre d'alternatives : les deux bornes en ont deux, la liste en a
     * une dizaine. Plus robuste que compter les parentheses.
     */
    const motsDe = (nom: string): string[] => {
      const bloc = new RegExp(`const ${nom} =\\s*(/[^;]+/[a-z]*)`).exec(src);
      if (!bloc) return [];
      const groupes = [...bloc[1]!.matchAll(/\(([^()]*)\)/g)].map((g) => g[1]!.split('|'));
      if (groupes.length === 0) return [];
      const plusLong = groupes.reduce((a, b) => (b.length > a.length ? b : a));
      return plusLong.filter((w) => w.length > 0 && !w.includes('^') && !w.includes('['));
    };
    const paires: ReadonlyArray<readonly [string, readonly string[]]> = [
      ['MOTS_MALAIS_INDONESIENS', ['MOTS_MALAIS', 'MOTS_INDONESIENS']],
      ['MOTS_DANO_NORVEGIENS', ['MOTS_NORVEGIENS', 'MOTS_DANOIS']],
    ];
    const fautes: string[] = [];
    for (const [declencheur, jeux] of paires) {
      const ouvre = new Set(motsDe(declencheur));
      expect(ouvre.size, `${declencheur} introuvable ou vide`).toBeGreaterThan(0);
      for (const jeu of jeux) {
        const tranche = motsDe(jeu);
        expect(tranche.length, `${jeu} introuvable ou vide`).toBeGreaterThan(0);
        for (const mot of tranche) {
          if (ouvre.has(mot)) fautes.push(`${mot} est dans ${declencheur} et dans ${jeu}`);
        }
      }
    }
    expect(fautes).toEqual([]);
  });
});
