import { afterEach, describe, expect, it, vi } from 'vitest';
import { localEngine } from './localEngine';

// The engine is a module singleton with no reset, so each test uses its own
// language pair rather than trying to clear shared state.
function stubTranslator(availability: string, translate?: (t: string) => Promise<string>) {
  vi.stubGlobal('Translator', {
    availability: () => Promise.resolve(availability),
    create: () => Promise.resolve({ translate: translate ?? ((t: string) => Promise.resolve(`[${t}]`)) }),
  });
}

describe('localEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports absent when the browser has no Translator API', () => {
    vi.unstubAllGlobals();
    expect(localEngine.present()).toBe(false);
  });

  it('treats regional variants as the same pair', async () => {
    stubTranslator('available');
    await localEngine.probe('pt-BR', 'EN-US');
    expect(localEngine.stateOf('pt', 'en')).toBe('available');
    expect(localEngine.isReady('PT', 'en')).toBe(true);
  });

  it('ignores pairs that cannot be translated on device', () => {
    stubTranslator('available');
    localEngine.noteSeen('auto', 'de');
    localEngine.noteSeen('und', 'de');
    localEngine.noteSeen('de', 'de');
    localEngine.noteSeen('', 'de');
    // No probe was issued for any of them.
    expect(localEngine.stateOf('auto', 'de')).toBe('unknown');
    expect(localEngine.stateOf('und', 'de')).toBe('unknown');
    expect(localEngine.hasReadyForTarget('de')).toBe(false);
  });

  it('marks a pair unavailable when availability throws', async () => {
    vi.stubGlobal('Translator', {
      availability: () => Promise.reject(new Error('boom')),
      create: () => Promise.reject(new Error('boom')),
    });
    await localEngine.probe('sv', 'fi');
    expect(localEngine.stateOf('sv', 'fi')).toBe('unavailable');
  });

  // Only pairs actually seen in chat are offered, so probing a pair is not enough
  // on its own to put it in front of the user.
  it('lists only pairs seen in chat that a user gesture could enable', async () => {
    stubTranslator('downloadable');
    await localEngine.probe('is', 'mt');
    expect(localEngine.downloadablePairs()).not.toContainEqual({ src: 'is', tgt: 'mt' });

    localEngine.noteSeen('nl', 'da');
    await localEngine.probe('nl', 'da');
    expect(localEngine.downloadablePairs()).toContainEqual({ src: 'nl', tgt: 'da' });
  });

  it('refuses to translate a pair that is not downloaded, so the caller can use the cloud', async () => {
    stubTranslator('downloadable');
    await localEngine.probe('el', 'hu');
    await expect(localEngine.translate('el', 'hu', 'x')).rejects.toThrow('not_ready');
  });

  it('translates once the pair is available', async () => {
    stubTranslator('available');
    await localEngine.probe('ro', 'sk');
    await expect(localEngine.translate('ro', 'sk', 'buna')).resolves.toBe('[buna]');
  });

  it('rejects a blank on-device result instead of showing an empty translation', async () => {
    stubTranslator('available', () => Promise.resolve('   '));
    await localEngine.probe('lt', 'lv');
    await expect(localEngine.translate('lt', 'lv', 'x')).rejects.toThrow('empty');
  });

  it('notifies listeners when a probe changes state', async () => {
    stubTranslator('available');
    const seen = vi.fn();
    const off = localEngine.onChange(seen);
    await localEngine.probe('et', 'bg');
    off();
    expect(seen).toHaveBeenCalled();
  });

  // Chrome's Translator lists `zh-Hant` beside `zh`. Cut at the hyphen, a zh-tw
  // reader got simplified characters from the device where the cloud answers zh-TW.
  it('asks the API for traditional Chinese by its own tag', async () => {
    const asked: string[] = [];
    vi.stubGlobal('Translator', {
      availability: (o: { sourceLanguage: string; targetLanguage: string }) => {
        asked.push(`${o.sourceLanguage}>${o.targetLanguage}`);
        return Promise.resolve('available');
      },
      create: () => Promise.resolve({ translate: (t: string) => Promise.resolve(t) }),
    });
    await localEngine.probe('ja', 'zh-TW');
    await localEngine.probe('zh-tw', 'uk');
    await localEngine.probe('ja', 'zh');
    expect(asked).toEqual(['ja>zh-Hant', 'zh-Hant>uk', 'ja>zh']);
  });

  it('treats simplified to traditional as a pair, not as the same language', async () => {
    stubTranslator('downloadable');
    localEngine.noteSeen('zh', 'zh-tw');
    await localEngine.probe('zh', 'zh-tw');
    expect(localEngine.downloadablePairs()).toContainEqual({ src: 'zh', tgt: 'zh-tw' });
  });

  // The bar filters the offer with `p.tgt === settings.targetLang`, so the pair
  // has to come back in the caller's codes or a zh-tw reader is never offered it.
  it('offers a pair in the codes it was seen with', async () => {
    stubTranslator('downloadable');
    localEngine.noteSeen('ko', 'zh-tw');
    await localEngine.probe('ko', 'zh-tw');
    expect(localEngine.downloadablePairs()).toContainEqual({ src: 'ko', tgt: 'zh-tw' });
  });

  // A burst arriving while the first create() loads the model used to start one
  // creation per line.
  it('creates the model of a pair once, however many lines arrive meanwhile', async () => {
    let creates = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    vi.stubGlobal('Translator', {
      availability: () => Promise.resolve('available'),
      create: async () => {
        creates++;
        await gate;
        return { translate: (t: string) => Promise.resolve(`[${t}]`) };
      },
    });
    await localEngine.probe('nl', 'da');
    const lines = Promise.all(['een', 'twee', 'drie', 'vier'].map((w) => localEngine.translate('nl', 'da', w)));
    release();
    await lines;
    expect(creates).toBe(1);
  });
});
