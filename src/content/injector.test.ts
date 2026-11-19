import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';
import type { Settings } from '~/shared/settings';
import type { TranslationResult } from '~/shared/types';
import { HANDLED_SELECTOR, applyDisplayStyle, applyShowOriginal, armHoverTranslate, incrementFloatingCount, inject, markSkipped, mountFloatingBar, updateActiveProvider, removeAllArtifacts, showError, showLoading, unmountFloatingBar, updateFloatingBar } from './injector';
// Read from disk: vitest runs with CSS processing off, so `?inline` imports
// resolve to an empty string and would make these assertions pass on anything.
const injectCss = readFileSync('src/content/inject.css', 'utf8');

const result = (translatedText: string): TranslationResult => ({
  messageId: '1',
  translatedText,
  detectedLang: 'es',
  provider: 'deepl',
  cached: false,
});

function settingsWith(displayStyle: Settings['displayStyle']): Settings {
  return { ...defaultSettings(), displayStyle, showSourceBadge: false, showProviderBadge: false };
}

/** Everything the injector adds under a chat line. */
function artifacts(el: Element): Element[] {
  return [...el.children];
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('kt-hide-original');
});

describe('injector artifacts', () => {
  it('shows the translated text', () => {
    const target = document.createElement('div');
    inject(target, result('hola'), settingsWith('below'));
    expect(target.textContent).toContain('hola');
  });

  // Re-injecting happens on every retry, so a second translation must replace the
  // first rather than stack under the message.
  it.each(['below', 'inline', 'replace', 'hover'] as const)(
    'replaces a previous translation in %s mode',
    (style) => {
      const target = document.createElement('div');
      inject(target, result('first'), settingsWith(style));
      inject(target, result('second'), settingsWith(style));

      expect(artifacts(target)).toHaveLength(1);
      expect(target.textContent).toContain('second');
      expect(target.textContent).not.toContain('first');
    },
  );

  it('clears a translation when an error replaces it', () => {
    const target = document.createElement('div');
    inject(target, result('hola'), settingsWith('replace'));
    showError(target, 'nope');

    expect(artifacts(target)).toHaveLength(1);
    expect(target.textContent).toContain('nope');
    expect(target.textContent).not.toContain('hola');
  });

  it('removes a loading indicator once the translation lands', () => {
    const target = document.createElement('div');
    showLoading(target);
    inject(target, result('hola'), settingsWith('below'));

    expect(artifacts(target)).toHaveLength(1);
    expect(target.textContent).toContain('hola');
  });

  it('removes every artifact it added', () => {
    const target = document.createElement('div');
    inject(target, result('hola'), settingsWith('replace'));
    removeAllArtifacts(target);
    expect(artifacts(target)).toHaveLength(0);
  });

  // A suffixed class is a *different* class: `.kt-translation` never matches
  // `.kt-translation-replace`. That is how the fourth style ended up with no
  // green cue, no copy cursor and a retry button that could never be revealed.
  describe('every display style carries the same cue', () => {
    const styleClasses = ['kt-translation', 'kt-translation-inline', 'kt-translation-replace'] as const;
    // `replace` stands in the message's place, so it is the line's body text.
    // The two that sit beside the original are the ones that owe a green cue.
    const pillClasses = ['kt-translation', 'kt-translation-inline'] as const;

    /**
     * Body of the rule whose selector list is exactly `selector`.
     *
     * Anchoring on `^.cls {` looked equivalent and was not: reformatting puts
     * each selector of a multi-selector rule on its own line, so the
     * copy-cursor list began a line with `.kt-translation-compact {` and the
     * anchor cheerfully returned the cursor rule instead. Splitting the
     * selector list is what the assertion actually means.
     */
    const soleRule = (css: string, selector: string) => {
      for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        // Comments sit in front of the selector and carry commas of their own,
        // so they have to go before the list is split.
        // An at-rule STATEMENT (`@import ...;`) sits in front of the first
        // selector in the file and is part of the same match, so skipping any
        // head that starts with `@` skipped the first rule entirely. Drop the
        // statement and keep what follows it; a head that still starts with `@`
        // after that is a block at-rule (@media, @keyframes) and has no
        // selector of its own.
        const head = m[1]!
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^[\s\S]*;/, '')
          .trim();
        if (head.startsWith('@')) continue;
        if (
          head
            .split(',')
            .map((x) => x.trim())
            .join(',') === selector
        )
          return m[2]!;
      }
      return '';
    };

    // The wash used to be written out as `rgba(83, 252, 24, …)` in each rule and
    // this asserted that literal. It comes from one token now, so what has to
    // hold is that all of them draw from the same one rather than that they each
    // happen to spell the same colour.
    it.each(pillClasses)('%s has the green background', (cls) => {
      // The class must own the rule, not merely appear in a shared selector
      // list such as the copy-cursor one.
      expect(soleRule(injectCss, `.${cls}`)).toMatch(/background:\s*rgb\(var\(--kt-green-rgb\)/);
    });

    // ...and that the token is still Kick's own green, read from the art
    // direction the repository states rather than from this stylesheet.
    it('builds that wash from the green the art direction names', () => {
      const theme = readFileSync('src/shared/theme.css', 'utf8');
      expect(theme).toMatch(/--kt-green-rgb:\s*83 252 24/);
      expect(readFileSync('.agent/PROMPT.md', 'utf8')).toContain('#53FC18');
    });

    // Control on the rule above. `replace` must own no pill rule at all: it
    // takes the message's place, so a green tile there would be a highlight
    // painted over the only text the line has left. It shares the
    // "the translation IS the message" declarations instead.
    it('gives replace no pill rule of its own', () => {
      expect(soleRule(injectCss, '.kt-translation-replace')).toBe('');
    });

    /**
     * The rule the three styles share.
     *
     * This used to be found by matching a body of exactly `cursor: copy;`,
     * which made the assertion depend on the rule declaring nothing else. The
     * day wrapping moved into it - one place deciding for all three instead of
     * `below` carrying its own - the probe stopped finding the rule and
     * reported an empty selector list rather than a changed one. Found by its
     * selector list now, which is what the test is actually about.
     */
    const shared = (() => {
      for (const m of injectCss.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const head = m[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim();
        const list = head.split(',').map((x) => x.trim());
        if (list.length === 3 && styleClasses.every((c) => list.includes(`.${c}`))) return m[2]!;
      }
      return '';
    })();

    it('lists every style in the shared rule', () => {
      expect(shared).not.toBe('');
      expect(shared).toMatch(/cursor:\s*copy/);
    });

    // Wrapping lives there too: a single unbreakable token used to take the
    // translation to 530px inside a 356px column and scroll the chat sideways.
    it('gives all three styles the same break behaviour', () => {
      expect(shared).toMatch(/overflow-wrap:\s*anywhere/);
    });

    it('reveals the retry button on every style', () => {
      for (const cls of styleClasses) expect(injectCss).toContain(`.${cls}:hover .kt-retry`);
    });
  });

  // The same suffixed-class trap, this time in the "has this line been translated
  // already?" guards. Missing a style there does not just look wrong: the row reads
  // as untranslated, so it gets re-submitted and paid for again.
  describe('the already-translated guard', () => {
    it.each(['below', 'inline', 'replace', 'hover'] as const)('finds a %s translation', (style) => {
      const target = document.createElement('div');
      inject(target, result('hola'), settingsWith(style));
      expect(target.querySelector(HANDLED_SELECTOR)).not.toBeNull();
    });

    // A line whose engine gave up carries an error marker and a retry button.
    // The sweeps ask this selector whether a line is already dealt with, so if
    // it does not answer yes here, every failed line is handed back to the
    // engine on the next scroll pause, for as long as the provider stays down.
    it('counts a failed line as already dealt with', () => {
      const target = document.createElement('div');
      showError(target, 'quota', () => undefined);
      expect(target.querySelector(HANDLED_SELECTOR)).not.toBeNull();
    });

    // Control: an untouched line must still read as free, or the assertion
    // above would pass on a selector that matches anything.
    it('still counts an untouched line as free', () => {
      const target = document.createElement('div');
      target.innerHTML = '<span class="font-normal">hola</span>';
      expect(target.querySelector(HANDLED_SELECTOR)).toBeNull();
    });

    // The guard against a fourth recurrence. The three that happened all took
    // the same shape: a `*_CLASS` constant declared here and left out of the
    // list a caller consults. This fails the moment a sixth one is declared
    // without being added to ARTIFACT_CLASSES, which is what the selector is
    // built from.
    it('covers every per line class this module declares', () => {
      const source = readFileSync('src/content/injector.ts', 'utf8');
      const declared = [...source.matchAll(/const\s+\w+_CLASS\s*=\s*'(kt-[^']+)'/g)].map((m) => m[1]);
      expect(declared.length).toBeGreaterThan(3); // the probe must see something
      for (const cls of declared) expect(HANDLED_SELECTOR).toContain(`.${cls}`);
    });

    it('is not re-spelled by hand at any call site', () => {
      for (const file of ['src/content/index.ts', 'src/content/pipeline.ts']) {
        expect(readFileSync(file, 'utf8')).not.toContain("'.kt-translation, ");
      }
    });
  });

  // A line whose engine gave up lost its translation AND the retry button living
  // inside it, so it became indistinguishable from a line that was never
  // translated, with no way to ask again.
  describe('a line whose engine gave up', () => {
    it('keeps a way to try again', () => {
      const target = document.createElement('div');
      let retried = 0;
      showError(target, 'quota', () => { retried++; });
      const btn = target.querySelector<HTMLElement>('.kt-retry');
      expect(btn).not.toBeNull();
      btn?.click();
      expect(retried).toBe(1);
    });

    // Callers that offer no retry keep the old, quieter marker.
    it('offers no button when the caller passes no retry', () => {
      const target = document.createElement('div');
      showError(target, 'quota');
      expect(target.querySelector('.kt-retry')).toBeNull();
    });

    // The button is opacity:0 until its own box is hovered. Forgetting the
    // error box in that rule ships a button nothing can reveal, which is
    // exactly how the Replace style lost its own retry.
    it('can reveal that button on hover', () => {
      expect(injectCss).toContain('.kt-error:hover .kt-retry');
    });
  });

  // Kick leaves a SECOND chat panel carrying the same id, hidden behind a
  // suspense placeholder, and it comes first in document order. That is what
  // buried the bar once already. Anything that looks the bar up across the whole
  // document answers about that dead copy.
  describe('the bar an update reaches is the one on screen', () => {
    const barHandlers = () => ({
      onToggle: vi.fn(),
      onTargetLang: vi.fn(),
      onOpenOptions: vi.fn(),
      onEnableLocal: vi.fn(),
    });

    /** The stale panel first, exactly as Kick orders them, with a decoy bar in it. */
    function twoPanels(): HTMLElement {
      document.body.innerHTML =
        '<div id="channel-chatroom">'
        + '<div id="kt-floating-bar"><span class="kt-float-label">STALE</span></div>'
        + '</div>'
        + '<div id="channel-chatroom"><div data-index="0"></div><div id="live-host"></div></div>';
      return document.querySelector<HTMLElement>('#live-host')!;
    }

    it('updates the live bar and never the stale copy', () => {
      const host = twoPanels();
      mountFloatingBar(host, { ...defaultSettings(), enabled: true, targetLang: 'fr' }, barHandlers());
      updateFloatingBar({ ...defaultSettings(), enabled: false, targetLang: 'fr' });

      const bars = document.querySelectorAll('#kt-floating-bar');
      expect(bars).toHaveLength(2);
      // Control: the update must land somewhere, or both assertions would pass
      // on a lookup that simply found nothing.
      expect(bars[1]?.querySelector('.kt-float-label')?.textContent).toBe('Translation off');
      expect(bars[0]?.querySelector('.kt-float-label')?.textContent).toBe('STALE');
    });

    // Redrawn by the mount's own painter. A positional lookup used to take the
    // direction arrow for the flag, repaint the arrow and leave the old flag.
    it('redraws the language button when the language changes elsewhere', () => {
      const host = twoPanels();
      mountFloatingBar(host, { ...defaultSettings(), enabled: true, targetLang: 'fr' }, barHandlers());
      updateFloatingBar({ ...defaultSettings(), enabled: true, targetLang: 'ja' });

      const pick = document.querySelectorAll('#kt-floating-bar')[1]!.querySelector('.kt-float-lang')!;
      expect(pick.querySelector('.kt-float-dir')?.className).toBe('kt-float-dir');
      expect(pick.querySelector('.kt-flag-jp')).not.toBeNull();
      expect(pick.querySelector('.kt-flag-fr')).toBeNull();
      expect(pick.querySelector('.kt-float-lang-tag')?.textContent).toBe('JA');
    });

    // The counter and the provider tooltip are updated on every translated
    // line. Finding the panel on screen means asking for boxes, which forces a
    // layout right after the line was written: one per message on a fast chat.
    it('reaches the bar on every line without measuring the page', () => {
      const host = twoPanels();
      mountFloatingBar(host, { ...defaultSettings(), enabled: true, targetLang: 'fr' }, barHandlers());
      const rects = vi.spyOn(Element.prototype, 'getClientRects');
      const boxes = vi.spyOn(Element.prototype, 'getBoundingClientRect');
      for (let i = 0; i < 5; i++) {
        incrementFloatingCount();
        updateActiveProvider('google');
      }
      expect(rects).not.toHaveBeenCalled();
      expect(boxes).not.toHaveBeenCalled();
      rects.mockRestore();
      boxes.mockRestore();
      // Control: the updates did land, on the live bar.
      const live = document.querySelectorAll('#kt-floating-bar')[1]!;
      expect(live.querySelector('.kt-float-count')?.textContent).toBe('· 5');
      expect((live as HTMLElement).dataset.provider).toBe('google');
    });

    // A bar Kick's re-render threw away is not the live one any more.
    it('finds the bar again once the one it knew is gone', () => {
      const host = twoPanels();
      mountFloatingBar(host, { ...defaultSettings(), enabled: true, targetLang: 'fr' }, barHandlers());
      document.querySelectorAll('#kt-floating-bar')[1]!.remove();
      mountFloatingBar(host, { ...defaultSettings(), enabled: false, targetLang: 'fr' }, barHandlers());
      incrementFloatingCount();
      const live = document.querySelectorAll('#kt-floating-bar')[1]!;
      expect(live.querySelector('.kt-float-count')?.textContent).toBe('· 1');
    });

    // A forgotten allowlist left the bar reading "Translating" over a chat
    // where no line was translated.
    it('says when a channel list keeps this channel out, and where to change it', () => {
      history.pushState(null, '', '/kt-test-channel');
      try {
        const host = twoPanels();
        mountFloatingBar(host, { ...defaultSettings(), enabled: true, whitelistChannels: ['kt-other'] }, barHandlers());
        const label = document.querySelectorAll('#kt-floating-bar')[1]!.querySelector<HTMLElement>('.kt-float-label')!;
        expect(label.textContent).toBe('Not translated here');
        expect(label.title).toContain('not on your allowed list');
        // Control: the same bar on an allowed channel says it translates.
        updateFloatingBar({ ...defaultSettings(), enabled: true, whitelistChannels: ['kt-test-channel'] });
        expect(label.textContent).toBe('Translating');
      } finally {
        history.pushState(null, '', '/');
      }
    });

    // `· 12` alone said nothing, to the eye or to a screen reader.
    it('names what the counter counts', () => {
      const host = twoPanels();
      mountFloatingBar(host, { ...defaultSettings(), enabled: true, targetLang: 'fr' }, barHandlers());
      incrementFloatingCount();
      incrementFloatingCount();
      const count = document.querySelectorAll('#kt-floating-bar')[1]!.querySelector<HTMLElement>('.kt-float-count')!;
      expect(count.title).toBe('Translated on this page: 2');
      expect(count.getAttribute('aria-label')).toBe('Translated on this page: 2');
    });

    // Teardown is the one place that stays document wide, so it cannot strand a
    // copy in the panel that is off screen.
    it('takes every copy away when it unmounts', () => {
      const host = twoPanels();
      mountFloatingBar(host, { ...defaultSettings(), enabled: true, targetLang: 'fr' }, barHandlers());
      expect(document.querySelectorAll('#kt-floating-bar')).toHaveLength(2);
      unmountFloatingBar();
      expect(document.querySelectorAll('#kt-floating-bar')).toHaveLength(0);
    });
  });

  // Measured in a live Kick page: the chat panel is 340px, the bar wanted 365,
  // and the child hanging outside was the gear, at left 340 right 365. The
  // language menu was holding its full 130px because a select will not shrink
  // below its widest option unless min-width says it may.
  //
  // No layout engine here, so these read the stylesheet rather than measuring
  // boxes. They pin the ordering, not the pixels.
  describe('the bar survives a narrow chat panel', () => {
    const ruleFor = (selector: string) =>
      new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(injectCss)?.[1] ?? '';

    // The gear is the only route to the options page from Kick. If it goes, the
    // user is locked out of their own settings.
    it.each(['.kt-float-opts', '.kt-float-power'])('never lets %s be squeezed out', (sel) => {
      expect(ruleFor(sel)).toMatch(/flex-shrink:\s*0/);
    });

    it('lets the language menu shrink instead', () => {
      expect(ruleFor('.kt-float-lang')).toMatch(/min-width:\s*0/);
    });

    it('gives up the label first, with an ellipsis rather than a wrap', () => {
      const label = ruleFor('.kt-float-label');
      expect(label).toMatch(/min-width:\s*0/);
      expect(label).toMatch(/text-overflow:\s*ellipsis/);
      expect(label).toMatch(/white-space:\s*nowrap/);
    });

    // Control: the probe can tell the two apart, so the assertions above are not
    // passing on any rule at all.
    it('does not claim the label is pinned', () => {
      expect(ruleFor('.kt-float-label')).not.toMatch(/flex-shrink:\s*0/);
    });
  });

  // The list a select opens is painted by the browser. Without a declared scheme
  // it paints light, and our light option text vanishes into it: white on white
  // in the chat bar, pale grey on white in the options page. Reported on both
  // surfaces, so both are asserted here.
  describe('every select we style declares a colour scheme', () => {
    const onDisk = (p: string) => readFileSync(p, 'utf8');
    /** The rule body for a selector, read from the file rather than a bundle.
     *  Escapes properly rather than prefixing a backslash: that trick works on a
     *  class selector but turns "select option" into the \s class followed by
     *  "elect option", which matches nothing and hands back an empty body, so an
     *  assertion fails on a rule that is right there in the file. */
    const ruleFor = (css: string, selector: string) =>
      new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

    // The bar picker is no longer a <select>, so there is no browser painted
    // list left to declare a scheme for. Measured on a live channel, that list
    // covered 845 of the chat panel's 890 pixels and nothing in CSS could reach
    // it. What replaced it is painted here, so this asserts the replacement
    // rather than the workaround it made unnecessary.
    it('opens a panel this stylesheet paints, not a browser list', () => {
      expect(ruleFor(injectCss, '.kt-float-lang')).not.toMatch(/color-scheme/);
      expect(ruleFor(injectCss, '.kt-lang-panel')).toMatch(/background:/);
    });

    // The bar is the only one of the three with a light theme, so there the
    // scheme has to follow it instead of being frozen dark.
    //
    // Keyed on the stamp the content script writes, not on the OS media query
    // it used to sit behind: Kick owns its theme, and a light desktop reading a
    // dark chat was handed the light palette on a dark ground.
    //
    // CE QUE CE TEST TIENT A CHANGE, et c'est le point : il exigeait un bloc
    // html[data-kt-scheme='light'] .kt-lang-panel, donc il tenait un mecanisme.
    // Ce bloc redeclarait douze jetons dont onze etaient identiques a ceux du
    // bloc sombre, puisque ce sont les triplets de theme.css qui basculent, et
    // le douzieme, --kt-lp-accent, est couvert par --kt-green-ink, que
    // theme.css bascule deja lui aussi. Le supprimer ne change aucun pixel.
    // L'invariant a tenir est celui que le bloc servait a obtenir : le panneau
    // n'ecrit aucune couleur en dur, donc il ne peut pas geler un theme.
    it('follows the light theme on the chat bar rather than freezing dark', () => {
      expect(ruleFor(injectCss, "html[data-kt-scheme='light'] .kt-float-lang")).toMatch(
        /background:/,
      );
      const panneau = ruleFor(injectCss, '.kt-lang-panel');
      expect(panneau).toMatch(/--kt-lp-accent:\s*var\(--kt-green-ink\)/);
      expect(panneau).not.toMatch(/#[0-9a-fA-F]{3}|rgba?\(/);
    });

    // Control for the one above: the desktop must no longer decide anything.
    it('no longer keys any injected style on the OS scheme', () => {
      expect(injectCss).not.toContain('@media (prefers-color-scheme');
    });

    it.each(['src/options/styles.css', 'src/popup/styles.css'])('does so in %s', (path) => {
      expect(ruleFor(onDisk(path), '.kt-select')).toMatch(/color-scheme:\s*dark/);
    });

    // The scheme alone was not enough, seen on screen in both surfaces: the list
    // stayed white with near white text and only the highlighted row could be
    // read. The browser paints that list from the control's own colours, so the
    // colours have to be named on the options. The earlier rule here forbade
    // exactly that; it was reasoned from the stylesheet and the screenshots
    // disproved it.
    it.each([
      ['src/options/styles.css', 'select option'],
      ['src/popup/styles.css', 'select option'],
    ])('names the option colours in %s', (path, selector) => {
      const block = ruleFor(onDisk(path), selector);
      expect(block).toMatch(/background-color:/);
      expect(block).toMatch(/color:/);
    });

    // A transparent control is what let the list paint white in the first place.
    it('leaves the chat bar picker opaque', () => {
      expect(ruleFor(injectCss, '.kt-float-lang')).not.toMatch(/background:\s*transparent/);
    });

    // The header language picker carries its own classes and never had
    // .kt-select, which is why the first attempt never reached it.
    it.each(['src/options/App.tsx', 'src/popup/App.tsx'])('opens no transparent select in %s', (path) => {
      const selects = onDisk(path).match(/<select[\s\S]{0,400}?>/g) ?? [];
      for (const s of selects) expect(s).not.toMatch(/bg-transparent/);
    });
  });

  // The bar was read only apart from the gear. These are the two settings people
  // reach for most, and both used to mean opening a whole page.
  describe('the bar can be acted on', () => {
    const handlers = () => ({
      onToggle: vi.fn(),
      onTargetLang: vi.fn(),
      onOpenOptions: vi.fn(),
      onEnableLocal: vi.fn(),
    });
    const mount = (h: ReturnType<typeof handlers>, over: Partial<Settings> = {}) => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      mountFloatingBar(host, { ...defaultSettings(), enabled: true, targetLang: 'auto', ...over }, h);
      return host.querySelector<HTMLElement>('#kt-floating-bar')!;
    };

    it('offers the reading language, starting on the one in use', () => {
      const bar = mount(handlers(), { targetLang: 'fr' });
      const pick = bar.querySelector<HTMLElement>('.kt-float-lang');
      expect(pick).not.toBeNull();
      expect(pick?.querySelector('.kt-float-lang-tag')?.textContent).toBe('FR');
    });

    it('reports a new reading language', () => {
      const h = handlers();
      const bar = mount(h);
      const pick = bar.querySelector<HTMLElement>('.kt-float-lang')!;
      pick.click();
      // Le panneau pend du document, plus de la barre : un backdrop-filter sur
      // la barre lui volait son bloc conteneur et un position:fixed y rendait
      // 489px plus bas que son propre `top`. Les tests le cherchent la ou il
      // est, sinon ils testent une version qui n'existe plus.
      const row = document.querySelector<HTMLElement>('.kt-lang-row[data-code="ja"]');
      expect(row).not.toBeNull();
      row!.click();
      expect(h.onTargetLang).toHaveBeenCalledWith('ja');
      // The button has to say what was picked, or the bar disagrees with itself.
      expect(pick.querySelector('.kt-float-lang-tag')?.textContent).toBe('JA');
    });

    // The panel is the whole point of the change: bounded, filterable, and it
    // shuts after a pick instead of staying over the chat.
    it('shuts the panel once a language is picked', () => {
      const h = handlers();
      const bar = mount(h);
      const pick = bar.querySelector<HTMLElement>('.kt-float-lang')!;
      pick.click();
      const panel = document.querySelector<HTMLElement>('.kt-lang-panel')!;
      expect(panel.hidden).toBe(false);
      // Et il n'est pas dans la barre : c'est la moitie du correctif, donc
      // c'est une assertion et pas un detail d'implementation.
      expect(bar.contains(panel)).toBe(false);
      document.querySelector<HTMLElement>('.kt-lang-row[data-code="ja"]')!.click();
      expect(panel.hidden).toBe(true);
    });

    // The favourites are what the streamer switching between three or four
    // languages actually clicks, so they have to be on top and reachable.
    it('puts the favourites above the list', () => {
      const h = handlers();
      const bar = mount(h, { favoriteLangs: ['ja', 'tr'] });
      bar.querySelector<HTMLElement>('.kt-float-lang')!.click();
      const tiles = [...document.querySelectorAll<HTMLElement>('.kt-lang-fav')];
      // By code, not by visible text: the tile used to print the ISO code under
      // the flag at 9px, which nobody read and which repeated the accessible
      // name. The flag has that room now, so the assertion follows the identity
      // rather than the label that carried it.
      expect(tiles.map((t) => t.dataset.code)).toEqual(['ja', 'tr']);
      expect(tiles.map((t) => t.getAttribute('aria-label'))).not.toContain(null);
      tiles[0]!.click();
      expect(h.onTargetLang).toHaveBeenCalledWith('ja');
    });

    // The bar toggles when clicked, so touching the picker must not also pause it.
    it('does not pause when the language picker is used', () => {
      const h = handlers();
      const bar = mount(h);
      const pick = bar.querySelector<HTMLSelectElement>('.kt-float-lang')!;
      pick.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(h.onToggle).not.toHaveBeenCalled();
    });

    it('pauses and resumes from its own button', () => {
      const h = handlers();
      const bar = mount(h);
      const power = bar.querySelector<HTMLElement>('.kt-float-power')!;
      power.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(h.onToggle).toHaveBeenCalledWith(false);
      power.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(h.onToggle).toHaveBeenLastCalledWith(true);
    });

    // opacity:0 until revealed was how the Replace style lost its retry button.
    it('can be seen in a light theme too', () => {
      expect(injectCss).toContain('.kt-float-lang');
      expect(injectCss).toContain('.kt-float-power');
    });
  });

  // Why a line was left alone used to be knowable only by instrumenting the
  // pipeline by hand. It now sits in the line's own tooltip.
  describe('the reason a line was left alone', () => {
    it('goes in the tooltip', () => {
      const target = document.createElement('div');
      markSkipped(target, 'it is only chat slang');
      expect(target.getAttribute('title')).toBe('Not translated: it is only chat slang');
    });

    // The chat reuses its rows, so a reason has to be removable, or it ends up
    // explaining a message it was never about.
    it('is dropped again when there is no reason to give', () => {
      const target = document.createElement('div');
      markSkipped(target, 'it is only chat slang');
      markSkipped(target, '');
      expect(target.hasAttribute('title')).toBe(false);
    });
  });

  // `showOriginal` shipped as a stored setting no content-script code ever read.
  describe('hiding the original text', () => {
    it('marks the document root only when the original must be hidden', () => {
      applyShowOriginal(false);
      expect(document.documentElement.classList.contains('kt-hide-original')).toBe(true);
      applyShowOriginal(true);
      expect(document.documentElement.classList.contains('kt-hide-original')).toBe(false);
    });

    // The rule keys off the element that HOLDS the translation, so a row the
    // virtual scroller recycled without one shows its text again with no
    // per-row bookkeeping to undo.
    //
    // Note on what this test can and cannot prove: it reads the rule as text.
    // The DOM this suite runs on cannot evaluate `:has()` at all (a relative
    // `~` throws, a relative `>` silently matches nothing), so no test here can
    // exercise the selector against a row. The shapes it has to cover were
    // measured in a browser instead, see the round 16 journal entry.
    it('hides Kick text only on lines that carry a translation', () => {
      const rule = /\.kt-hide-original[^{]*\{[^}]*\}/.exec(injectCss)?.[0] ?? '';
      // Zeroed rather than `display: none`, which took the emotes with it: Kick
      // renders them as images INSIDE these same spans. Measured in a browser
      // across an emote-only span, a mixed one and a 7TV token, the image was
      // gone in all three.
      expect(rule).toMatch(/font-size:\s*0/);
      expect(rule, 'display:none would take the emotes too').not.toMatch(/display:\s*none/);
      for (const cls of ['kt-translation', 'kt-translation-inline', 'kt-translation-replace']) {
        // The holder is matched by its child, never by a sibling of the text:
        // in a reply Kick nests the message a level deeper and a sibling rule
        // cannot reach it.
        expect(rule).toContain(`div:has(> .${cls})`);
      }
      expect(rule).not.toContain('~ .kt-translation');
      // Two renderings of the same original have to go: the span Kick writes,
      // and the container a chat emote extension puts beside it and shows
      // instead, after hiding Kick's own.
      expect(rule).toContain('span.font-normal');
      expect(rule).toContain('.seventv-text-token');
    });

    /**
     * Zeroing the type is only half of it. Kick sizes some emotes in em, and an
     * em against a zero font-size is zero, so the image needs a size handed
     * back or it collapses just as thoroughly as the words did.
     */
    it('hands the emote its own size back', () => {
      const exempt = injectCss
        .split('\n')
        .filter((l) => l.includes('img') && l.includes('div:has('));
      expect(exempt.length, 'nothing exempts the emote from the zeroed type').toBeGreaterThan(0);
      for (const cls of ['kt-translation', 'kt-translation-inline', 'kt-translation-replace']) {
        expect(exempt.some((l) => l.includes(`div:has(> .${cls})`))).toBe(true);
      }
      const body = /:is\(img, svg, video\)\s*\{([^}]*)\}/.exec(injectCss)?.[1] ?? '';
      expect(body).toMatch(/font-size:\s*1rem/);
    });

    // With the text gone there is nothing on the pill's left for the gap to
    // separate it from, so it reads as a stray indent.
    it('closes the gap in front of a pill that no longer follows anything', () => {
      // `margin-inline-start`, because "in front of" is a reading direction and
      // not a side of the screen. Written as margin-left it put the gap on the
      // wrong end of an Arabic line.
      expect(injectCss).toMatch(
        /\.kt-hide-original[^{]*\.kt-translation-inline[^{]*\{[^}]*margin-inline-start:\s*0/,
      );
    });

    // `replace` hides the original whether or not "keep original" is on, so its
    // rule must NOT be gated on that class — that gate is exactly what made the
    // style a duplicate of `inline` for everyone who never went looking for the
    // toggle.
    it('hides the original for replace without waiting for the toggle', () => {
      const line = injectCss
        .split('\n')
        .find((l) => l.includes('div:has(> .kt-translation-replace)'));
      expect(line, 'no hide rule reaches the replace style').toBeDefined();
      expect(line).not.toContain('.kt-hide-original');
    });

    // A `div:has()` rule with nothing above it is re-checked on every mutation
    // of Kick's page. Each one is scoped to something on the root, so it costs
    // nothing until a line could match it.
    it('scopes every div:has() rule to the root', () => {
      const lines = injectCss.split('\n').filter((l) => l.includes('div:has('));
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) expect(l).toMatch(/^(\.kt-hide-original|html\[data-kt-display='replace'\]) /);
    });

    it('stamps the root when a replace line is drawn, whoever draws it', () => {
      applyDisplayStyle('below');
      inject(document.createElement('div'), result('hola'), settingsWith('replace'));
      expect(document.documentElement.getAttribute('data-kt-display')).toBe('replace');
      applyDisplayStyle('below');
    });

    it('stamps the root only while the style is replace', () => {
      applyDisplayStyle('replace');
      expect(document.documentElement.getAttribute('data-kt-display')).toBe('replace');
      applyDisplayStyle('below');
      expect(document.documentElement.hasAttribute('data-kt-display')).toBe(false);
    });
  });

  it('leaves the original message content alone', () => {
    const target = document.createElement('div');
    const original = document.createElement('span');
    original.textContent = 'mensaje';
    target.appendChild(original);

    inject(target, result('message'), settingsWith('below'));
    removeAllArtifacts(target);

    expect(artifacts(target)).toEqual([original]);
    expect(target.textContent).toBe('mensaje');
  });
});

/**
 * Every rule that reaches Kick's own message text has to name 7TV's token span
 * as well as Kick's. 7TV replaces `span.font-normal` with
 * `span.seventv-text-token`, so a selector that only knows the former silently
 * stops working for everyone running it — measured in a browser: the original
 * stayed visible next to its translation while the native path hid it.
 */
describe('7TV', () => {
  it('hides the original for 7TV as well as for native Kick', () => {
    // Filtered on what the rule REACHES, not on the class that gates it. The
    // filter used to require `.kt-hide-original`, and the replace style's own
    // hide rule carries no such ancestor, so widening it is what keeps that
    // rule inside this check instead of silently outside it.
    const rules = injectCss
      .split('\n')
      .filter((l) => l.includes('font-normal') && l.includes('div:has('));
    expect(rules.length, 'no rule reaches the message text').toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule, `this rule ignores 7TV: ${rule.trim()}`).toContain('seventv-text-token');
    }
  });

  // Control: the check must fail on a selector that forgot 7TV, or it proves
  // nothing about the ones that remember it.
  it('rejects a rule that names only Kick own class', () => {
    const bad = '.kt-hide-original div:has(> .kt-translation) span.font-normal {';
    expect(bad.includes('seventv-text-token')).toBe(false);
  });
});

/**
 * The bar is on screen the whole time someone reads chat, on a panel measured
 * at 420px. Anything permanent in it has to earn its width.
 */
describe('floating bar, width discipline', () => {
  it('states what it is doing without repeating the language menu', () => {
    const bar = mountBarInto(document.body);
    const label = bar.querySelector<HTMLElement>('.kt-float-label')!;
    // "Translating → EN" was 133px of 420 and the "→ EN" duplicated the picker.
    expect(label.textContent).toBe('Translating');
    expect(label.textContent).not.toMatch(/→|EN/);
  });

  it('keeps the resolved language reachable, in the tooltip', () => {
    const bar = mountBarInto(document.body);
    const label = bar.querySelector<HTMLElement>('.kt-float-label')!;
    expect(label.title).toMatch(/Reading chat in [A-Z]{2}/);
  });

  it('does not print the provider name in the bar', () => {
    const bar = mountBarInto(document.body);
    updateActiveProvider('google');
    expect(bar.querySelector('.kt-float-provider')).toBeNull();
    expect(bar.dataset.provider).toBe('google');
  });

  it('still says which provider answered, one hover away', () => {
    const bar = mountBarInto(document.body);
    updateActiveProvider('deepl');
    expect(bar.querySelector<HTMLElement>('.kt-float-label')!.title).toContain('via deepl');
  });

  // Control: a second provider must replace the first in the tooltip, not
  // append to it — otherwise the title grows without bound over a session.
  it('replaces the provider rather than appending to it', () => {
    const bar = mountBarInto(document.body);
    updateActiveProvider('google');
    updateActiveProvider('lingva');
    const title = bar.querySelector<HTMLElement>('.kt-float-label')!.title;
    expect(title).toContain('via lingva');
    expect(title).not.toContain('google');
    expect(title.match(/via/g)).toHaveLength(1);
  });
});

function mountBarInto(host: HTMLElement): HTMLElement {
  host.innerHTML = '<div id="channel-chatroom"><div data-index="0"></div></div>';
  const panel = host.querySelector('#channel-chatroom')!;
  mountFloatingBar(panel, defaultSettings(), {
    onToggle: () => {}, onTargetLang: () => {}, onOpenOptions: () => {}, onEnableLocal: () => {},
  });
  return panel.querySelector<HTMLElement>('#kt-floating-bar')!;
}

/**
 * Hover-to-translate, after the label came off.
 *
 * It used to append a green "Hover to translate" under every message, and that
 * is what it cost, measured in a real browser against an untouched row: 31.4px
 * became 50.6px, +61%, and a 420px window went from 13 messages to 8. The style
 * whose entire purpose is to spend less was the most expensive one on screen,
 * and it charged that on lines nobody had asked to translate.
 *
 * The row is the target now, which is a far bigger one than a line of small
 * text, so a pointer crossing the chat on its way to the message box would
 * translate everything it passed over. Hence the dwell.
 */
describe('hover to translate', () => {
  const armed = (): { row: HTMLElement; fired: number[] } => {
    const row = document.createElement('div');
    const said = document.createElement('span');
    said.className = 'font-normal';
    said.textContent = 'hola a todos';
    row.appendChild(said);
    document.body.appendChild(row);
    const fired: number[] = [];
    armHoverTranslate(row, () => fired.push(Date.now()));
    return { row, fired };
  };

  afterEach(() => {
    vi.useRealTimers();
    document.body.textContent = '';
  });

  it('leaves no text behind, only a marker the sweep can see', () => {
    const { row } = armed();
    const mark = row.querySelector('.kt-hover-armed');
    expect(mark).not.toBeNull();
    expect(mark!.textContent).toBe('');
    // The whole point: the line reads exactly as it did before we touched it.
    expect(row.textContent).toBe('hola a todos');
  });

  it('counts as a line already dealt with, so no sweep re-arms it', () => {
    const { row } = armed();
    expect(row.querySelector(HANDLED_SELECTOR)).not.toBeNull();
  });

  it('arms a row once, however many times it is offered', () => {
    const { row } = armed();
    armHoverTranslate(row, () => undefined);
    expect(row.querySelectorAll('.kt-hover-armed')).toHaveLength(1);
  });

  /**
   * Why that guard walks children instead of asking for `:scope > .marker`.
   *
   * happy-dom 15 returned null for a `:scope` selector that a browser matches,
   * so a guard written that way was right in production and invisible here: the
   * row above armed itself twice and nothing in the suite could say so. It was
   * asserted rather than left as a comment, and happy-dom 20 answers it: the
   * shorter form would now be seen by the suite, and the walk stays because it
   * is just as short.
   *
   * `showLoading` carried the same shape and now walks children too, so its
   * guard is asserted below rather than trusted.
   */
  it('does not stack a second loading marker on a line that already has one', () => {
    const row = document.createElement('div');
    showLoading(row);
    showLoading(row);
    showLoading(row);
    expect(row.querySelectorAll('.kt-loading')).toHaveLength(1);
  });

  // Control: the guard must be looking at THIS line's own children, not at any
  // marker anywhere beneath it, or a nested quote carrying one would silence
  // the real line.
  it('still marks a line whose marker belongs to something nested', () => {
    const row = document.createElement('div');
    const quoted = document.createElement('div');
    const stale = document.createElement('span');
    stale.className = 'kt-loading';
    quoted.appendChild(stale);
    row.appendChild(quoted);
    showLoading(row);
    expect(row.querySelectorAll('.kt-loading')).toHaveLength(2);
    expect([...row.children].filter((c) => c.classList.contains('kt-loading'))).toHaveLength(1);
  });

  it('records that this DOM answers a scope selector', () => {
    const row = document.createElement('div');
    const mark = document.createElement('span');
    mark.className = 'kt-hover-armed';
    row.appendChild(mark);
    expect(row.querySelector('.kt-hover-armed')).not.toBeNull();
    expect(row.querySelector(':scope > .kt-hover-armed')).toBe(mark);
  });

  it('translates when the pointer rests on the line', () => {
    vi.useFakeTimers();
    const { row, fired } = armed();
    row.dispatchEvent(new MouseEvent('mouseenter'));
    expect(fired, 'fired before the dwell was up').toHaveLength(0);
    vi.advanceTimersByTime(200);
    expect(fired).toHaveLength(1);
    expect(row.querySelector('.kt-hover-armed')).toBeNull();
  });

  // The reason the dwell exists. A row is a big target and the pointer crosses
  // the whole chat to reach the message box.
  it('does not translate a line the pointer merely passed over', () => {
    vi.useFakeTimers();
    const { row, fired } = armed();
    row.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(80);
    row.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(500);
    expect(fired).toHaveLength(0);
    expect(row.querySelector('.kt-hover-armed'), 'the line is still armed').not.toBeNull();
  });

  /**
   * Kick recycles its rows, so the listener can outlive the message it was
   * armed for. The marker cannot: anything that re-processes the line takes it
   * out. Firing on a stale closure would put one viewer's translation on
   * another viewer's line.
   */
  it('stays quiet once its marker is gone', () => {
    vi.useFakeTimers();
    const { row, fired } = armed();
    removeAllArtifacts(row);
    row.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(500);
    expect(fired).toHaveLength(0);
  });

  it('re-arms a recycled row without the old listener speaking up', () => {
    vi.useFakeTimers();
    const { row, fired } = armed();
    removeAllArtifacts(row);
    const second: number[] = [];
    armHoverTranslate(row, () => second.push(1));
    row.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(500);
    expect(fired, 'the previous message translated itself onto a recycled row').toHaveLength(0);
    expect(second).toHaveLength(1);
  });
});
