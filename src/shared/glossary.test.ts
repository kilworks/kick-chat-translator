import { describe, expect, it } from 'vitest';
import { applyUserGlossary, isSlangOnly, protectNames, restoreNames } from './glossary';

describe('isSlangOnly', () => {
  it('flags pure streaming slang', () => {
    expect(isSlangOnly('poggers')).toBe(true);
    expect(isSlangOnly('KEKW KEKW')).toBe(true);
    expect(isSlangOnly('copium ngl')).toBe(true);
    expect(isSlangOnly('based fr fr')).toBe(true);
  });
  it('does NOT flag real sentences', () => {
    expect(isSlangOnly('vamos a la playa')).toBe(false);
    expect(isSlangOnly('poggers que jogada')).toBe(false); // has real words
    expect(isSlangOnly('元気ですか')).toBe(false);
  });
  it('returns false on empty', () => {
    expect(isSlangOnly('')).toBe(false);
  });
});

describe('applyUserGlossary', () => {
  it('replaces a whole ASCII word only', () => {
    expect(applyUserGlossary('kusa is here', ['kusa→lol'])).toBe('lol is here');
    expect(applyUserGlossary('kusabi', ['kusa→lol'])).toBe('kusabi');
  });

  it('replaces non-ASCII terms, which word boundaries used to block', () => {
    expect(applyUserGlossary('草', ['草→lol'])).toBe('lol');
    expect(applyUserGlossary('привет all', ['привет→hi'])).toBe('hi all');
    expect(applyUserGlossary('le café', ['café→coffee'])).toBe('le coffee');
  });

  it('keeps the leading boundary on a term that starts with a word character', () => {
    expect(applyUserGlossary('decafé', ['café→coffee'])).toBe('decafé');
  });

  it('is case-insensitive and replaces every occurrence', () => {
    expect(applyUserGlossary('GG and gg', ['gg→good game'])).toBe('good game and good game');
  });

  it('ignores malformed entries instead of throwing', () => {
    expect(applyUserGlossary('text', [])).toBe('text');
    expect(applyUserGlossary('text', ['no-separator'])).toBe('text');
    expect(applyUserGlossary('text', ['→orphan'])).toBe('text');
  });

  it('treats regex metacharacters in the source as literals', () => {
    expect(applyUserGlossary('a+b', ['a+b→sum'])).toBe('sum');
    expect(applyUserGlossary('(o)', ['(o)→circle'])).toBe('circle');
  });
});

// Chat stretches slang as it stretches everything. The fold is for this test
// only: the text sent to the engine is never changed.
describe('isSlangOnly, stretched slang', () => {
  it('reads stretched slang as slang', () => {
    expect(isSlangOnly('poggg')).toBe(true);
    expect(isSlangOnly('sheeeesh')).toBe(true);
    expect(isSlangOnly('kekwww')).toBe(true);
    expect(isSlangOnly('ggggg ezzzz')).toBe(true);
  });
  it('does not fold a real double letter away', () => {
    expect(isSlangOnly('lull')).toBe(false);
    expect(isSlangOnly('good')).toBe(false);
  });
});

describe('protectNames / restoreNames', () => {
  it('takes the name in any case, and only as a whole word', () => {
    expect(protectNames('FaceIt jest zły')).toBe('⟦1⟧ jest zły');
    expect(protectNames('xfaceit faceitowy')).toBe('xfaceit faceitowy');
  });

  it('puts the name back, and removes a placeholder it cannot read', () => {
    expect(restoreNames('odeio ⟦1⟧')).toBe('odeio FACEIT');
    expect(restoreNames('odeio ⟦ 1 ⟧ e ⟦9⟧')).toBe('odeio FACEIT e ');
  });
});
