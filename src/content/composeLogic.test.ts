import { describe, expect, it } from 'vitest';
import {
  COMPOSE_MAX_LEN,
  COMPOSE_PANEL_TOP_MARGIN,
  RateLimiter,
  Sequencer,
  chatReserve,
  computePanelGeom,
  decideComposeAction,
  isLinkOrMentionOnly,
  maskProtected,
  unmaskProtected,
  toucheEchange,
  morceauxAutourDesEmotes,
  morceauxPourEditeur,
  rienAEchanger,
  motsPourMoteur,
  remettreEmotes,
} from './composeLogic';

// L'emote du composer ([emote:id:nom]) traversait la traduction sans masque et
// le traducteur la jetait : "PogU bonjour" ressortait "こんにちは". Puis, en
// placeholder, elle rendait le chinois vide 7 fois sur 36 : le moteur ne la voit
// plus, elle est remise apres coup.
describe('emotes in your own message', () => {
  const P = '[emote:37233:PogU]';
  const K = '[emote:37226:KEKW]';

  it('sends the engine the words only, lines kept', () => {
    expect(motsPourMoteur(`${P}  bonjour ${K} tout le monde`)).toBe('bonjour tout le monde');
    expect(motsPourMoteur(`ligne un ${P}\n${K} ligne deux`)).toBe('ligne un\nligne deux');
    expect(maskProtected(motsPourMoteur(`${P} salut @Pseudo`)).masked).toBe('salut ⟦0⟧');
  });

  it('puts the emotes back: before stays before, after stays after', () => {
    expect(remettreEmotes('hello everyone', `${P}  bonjour tout le monde`)).toBe(`${P} hello everyone`);
    expect(remettreEmotes('hello everyone', `bonjour tout le monde ${P}`)).toBe(`hello everyone ${P}`);
    expect(remettreEmotes("I'm happy", `${P}${K} je suis content`)).toBe(`${P}${K} I'm happy`);
    expect(remettreEmotes('hello', 'bonjour')).toBe('hello');
  });

  it('treats an emote name typed as a word like an emote', () => {
    expect(motsPourMoteur('regarde ce chat PepePls')).toBe('regarde ce chat'); // what 7TV's Tab writes
    expect(motsPourMoteur('pepeLaugh trop drole')).toBe('trop drole');
    expect(remettreEmotes('so funny', 'pepeLaugh trop drole')).toBe('pepeLaugh so funny');
    expect(remettreEmotes('I bought an iPhone', "j'ai acheté un iPhone")).toBe('I bought an iPhone');
    expect(decideComposeAction('catJam monkaS', undefined, undefined, 'fr')).toBe('skip-empty');
  });

  it('moves an emote typed between words after them', () => {
    expect(remettreEmotes('hello friends how are you', `salut les amis ${K} comment allez vous`)).toBe(
      `hello friends how are you ${K}`,
    );
    expect(morceauxAutourDesEmotes('a b', `${P} a ${K} b`)).toEqual(['', ' a b ', '']);
  });

  it('never hands the editor its emotes back as words', () => {
    // The editor keeps the emote nodes; what Tab inserts carries them as markup.
    const src = `${P} bonjour tout le monde`;
    expect(morceauxPourEditeur(remettreEmotes('hello everyone', src), src)).toEqual(['', ' hello everyone']);
    const mid = `salut ${K} les amis`;
    const parts = morceauxPourEditeur(remettreEmotes('hi friends', mid), mid);
    expect(parts.join('')).not.toMatch(/\[emote:/);
    expect(parts).toEqual(['hi friends ', '']);
  });

  it('sees a translation handed back unchanged as nothing to swap', () => {
    expect(rienAEchanger(`hello friends ${K}  how are you`, `Hello friends ${K} how are you`)).toBe(true);
    expect(rienAEchanger('bonjour', 'hello')).toBe(false);
  });

  it('has nothing to translate when the message is only emotes', () => {
    expect(decideComposeAction(' [emote:37233:PogU]  [emote:1:KEKW] ', undefined, undefined, 'ja')).toBe('skip-empty');
  });
});

describe('decideComposeAction', () => {
  it('skips empty / whitespace-only input', () => {
    expect(decideComposeAction('', undefined, undefined, 'en')).toBe('skip-empty');
    expect(decideComposeAction('   ', undefined, undefined, 'en')).toBe('skip-empty');
  });

  it('skips fragments below the minimum length', () => {
    expect(decideComposeAction('a', undefined, undefined, 'en', 2)).toBe('skip-short');
  });

  it('skips chat noise (laughter / emoji spam)', () => {
    expect(decideComposeAction('wwww', undefined, undefined, 'en')).toBe('skip-noise');
    expect(decideComposeAction('jajaja', undefined, undefined, 'en')).toBe('skip-noise');
  });

  it('skips when the detected source already equals the target', () => {
    expect(decideComposeAction('hello there friend', undefined, 'en', 'en')).toBe('skip-same-lang');
    expect(decideComposeAction('hello there friend', undefined, 'EN', 'en')).toBe('skip-same-lang');
  });

  it('still translates when detection is uncertain (let the provider auto-detect)', () => {
    expect(decideComposeAction('some ambiguous text', undefined, undefined, 'en')).toBe('translate');
  });

  it('dedups identical consecutive text', () => {
    expect(decideComposeAction('bonjour tout le monde', 'bonjour tout le monde', 'fr', 'en')).toBe('skip-unchanged');
    // Trailing whitespace must not defeat dedup.
    expect(decideComposeAction('bonjour  ', 'bonjour', 'fr', 'en')).toBe('skip-unchanged');
  });

  it('translates fresh foreign text', () => {
    expect(decideComposeAction('bonjour tout le monde', undefined, 'fr', 'en')).toBe('translate');
  });

  it('skips text longer than the cap', () => {
    expect(decideComposeAction('a'.repeat(COMPOSE_MAX_LEN + 1), undefined, 'fr', 'en')).toBe('skip-long');
  });

  it('skips link/mention-only input', () => {
    expect(decideComposeAction('https://kick.com/foo', undefined, undefined, 'en')).toBe('skip-noise');
    expect(decideComposeAction('@alice @bob', undefined, undefined, 'en')).toBe('skip-noise');
  });

  it('skips pure streaming slang (gg/ez/poggers)', () => {
    expect(decideComposeAction('gg ez poggers', undefined, undefined, 'en')).toBe('skip-noise');
  });
});

describe('maskProtected / unmaskProtected', () => {
  it('shields @handles and URLs, then restores them', () => {
    const { masked, tokens } = maskProtected('hey @cool.user check https://kick.com/x nice');
    expect(masked).not.toContain('@cool.user');
    expect(masked).not.toContain('https://');
    expect(tokens).toEqual(['@cool.user', 'https://kick.com/x']);
    // A translator that keeps the placeholders → handles/links come back intact.
    const translated = masked.replace('hey', 'salut').replace('check', 'regarde').replace('nice', 'sympa');
    const restored = unmaskProtected(translated, tokens);
    expect(restored).toContain('@cool.user');
    expect(restored).toContain('https://kick.com/x');
  });
  // Google's Cantonese answer, verbatim from the free endpoint.
  it('restores a placeholder the engine padded with spaces', () => {
    expect(unmaskProtected('⟦ 0 ⟧ 哈哈，我朋友，呢個動作真係好好', ['@el.toro'])).toBe('@el.toro 哈哈，我朋友，呢個動作真係好好');
  });
  it('is a no-op when there is nothing to protect', () => {
    const { masked, tokens } = maskProtected('bonjour tout le monde');
    expect(masked).toBe('bonjour tout le monde');
    expect(tokens).toEqual([]);
    expect(unmaskProtected('hello everyone', tokens)).toBe('hello everyone');
  });
});

describe('isLinkOrMentionOnly', () => {
  it('detects link/mention-only text', () => {
    expect(isLinkOrMentionOnly('https://example.com')).toBe(true);
    expect(isLinkOrMentionOnly('@user')).toBe(true);
    expect(isLinkOrMentionOnly('@user https://x.io')).toBe(true);
  });
  it('passes text with real words', () => {
    expect(isLinkOrMentionOnly('@user check this https://x.io')).toBe(false);
    expect(isLinkOrMentionOnly('bonjour')).toBe(false);
    expect(isLinkOrMentionOnly('')).toBe(false);
  });
});

describe('Sequencer', () => {
  it('hands out monotonic ids and only the newest is current', () => {
    const s = new Sequencer();
    const a = s.next();
    const b = s.next();
    expect(b).toBeGreaterThan(a);
    expect(s.isCurrent(a)).toBe(false);
    expect(s.isCurrent(b)).toBe(true);
    expect(s.current).toBe(b);
  });
});

describe('RateLimiter', () => {
  it('allows up to max within the window, then denies', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.tryAcquire(0)).toBe(true);
    expect(rl.tryAcquire(0)).toBe(true);
    expect(rl.tryAcquire(0)).toBe(false);
  });

  it('recovers once the window slides past old hits', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.tryAcquire(0)).toBe(true);
    expect(rl.tryAcquire(500)).toBe(false);
    expect(rl.tryAcquire(1001)).toBe(true);
  });
});

describe('computePanelGeom', () => {
  const VP = { innerWidth: 1000, innerHeight: 800, keyboardInset: 0 };

  it('sits just above the composer, matching its width', () => {
    const g = computePanelGeom({ left: 100, top: 700, width: 300 }, VP);
    expect(g.left).toBe(100);
    expect(g.width).toBe(300);
    expect(g.bottom).toBe(106); // 800 - 700 + 6 gap
  });

  it('clamps horizontally so the chip never leaves the viewport', () => {
    expect(computePanelGeom({ left: 950, top: 700, width: 300 }, VP).left).toBe(696); // 1000-300-4
    expect(computePanelGeom({ left: -50, top: 700, width: 300 }, VP).left).toBe(4);
  });

  it('lifts above the on-screen keyboard', () => {
    const g = computePanelGeom({ left: 100, top: 760, width: 300 }, { ...VP, keyboardInset: 300 });
    expect(g.bottom).toBe(304); // keyboard floor 300+4 beats the 46px composer-relative offset
  });

  it('rises above an overlay that opens over the composer', () => {
    const g = computePanelGeom({ left: 100, top: 700, width: 300 }, VP, 500);
    expect(g.bottom).toBe(306); // 800 - 500 + 6
  });

  it('ignores an overlay that is below the composer top', () => {
    const g = computePanelGeom({ left: 100, top: 400, width: 300 }, VP, 600);
    expect(g.bottom).toBe(406); // 800 - 400 + 6, obstacle ignored
  });

  it('keeps the top edge on-screen for a tall stack', () => {
    const g = computePanelGeom({ left: 100, top: 20, width: 300 }, VP);
    expect(g.bottom).toBe(VP.innerHeight - COMPOSE_PANEL_TOP_MARGIN); // 770
  });
});

/**
 * Quelle frappe echange le message contre sa traduction.
 *
 * Tab est la touche qui deplace le focus, donc la prendre a un cout reel. Ces
 * cas sont ce qui le rend acceptable : elle n'est prise qu'avec l'apercu a
 * l'ecran (verifie par l'appelant), Shift+Tab passe toujours, et un lecteur qui
 * navigue au clavier peut la rendre entierement a la navigation.
 */
describe('toucheEchange', () => {
  const frappe = (key: string, mods: Partial<KeyboardEvent> = {}) => ({
    key,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...mods,
  });

  it('takes Tab when Tab is the chosen key', () => {
    expect(toucheEchange(frappe('Tab'), 'tab-and-enter')).toBe(true);
  });

  // La sortie de secours d'un lecteur au clavier : reculer hors de la boite de
  // saisie doit marcher meme quand l'apercu est la.
  it('always leaves Shift+Tab alone', () => {
    expect(toucheEchange(frappe('Tab', { shiftKey: true }), 'tab-and-enter')).toBe(false);
    expect(toucheEchange(frappe('Tab', { shiftKey: true }), 'ctrl-enter')).toBe(false);
  });

  it('gives Tab back entirely in ctrl-enter mode', () => {
    expect(toucheEchange(frappe('Tab'), 'ctrl-enter')).toBe(false);
  });

  // Ctrl/Cmd+Entree etait le seul raccourci et n'avait aucun test. Il doit
  // survivre aux deux modes, sinon ce reglage retire un geste au lieu d'en
  // ajouter un.
  it('keeps Ctrl and Cmd Enter working in both modes', () => {
    for (const mode of ['tab-and-enter', 'ctrl-enter'] as const) {
      expect(toucheEchange(frappe('Enter', { ctrlKey: true }), mode)).toBe(true);
      expect(toucheEchange(frappe('Enter', { metaKey: true }), mode)).toBe(true);
    }
  });

  // Entree nu envoie le message sur Kick : le lui prendre enverrait le message
  // original a chaque fois qu'on voulait sa traduction.
  it('never takes a bare Enter, which is how Kick sends', () => {
    expect(toucheEchange(frappe('Enter'), 'tab-and-enter')).toBe(false);
    expect(toucheEchange(frappe('Enter'), 'ctrl-enter')).toBe(false);
  });

  it('ignores everything else', () => {
    for (const k of ['a', ' ', 'Escape', 'ArrowDown', 'Backspace']) {
      expect(toucheEchange(frappe(k), 'tab-and-enter')).toBe(false);
    }
  });
});

// Measured on kick.com: the chat list ends 34px above the composer and a
// one-line preview reaches 44px above it, so it hid the bottom 10px of the
// last line. The reserve is that overlap, and nothing when there is none.
describe('chatReserve', () => {
  it('is the part of the list the panel covers', () => {
    expect(chatReserve(580, 590)).toBe(10);
    expect(chatReserve(579.4, 590)).toBe(11);
  });

  it('is zero when the panel clears the list', () => {
    expect(chatReserve(600, 590)).toBe(0);
  });
});
