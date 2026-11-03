import { describe, expect, it } from 'vitest';
import { normalizeElongation } from './filters';

/**
 * Flattening is a rescue, not a preprocessing step, and these tests pin the reason.
 *
 * Measured against Google on real chat: it already handles some stretching well.
 * "sooo goood" comes back as "tellement bon", and flattening it first produces
 * "alors mon Dieu". So the pipeline only reaches for this after the engine has
 * returned a line unchanged, where there is nothing left to spoil.
 *
 * The other half is what this function must refuse to touch. An isolated Japanese
 * prolongation carries meaning, and an earlier version of this rule stripped it:
 * it turned コーヒー into コヒ, ラーメン into ラメン and スーパー into スパ. Four real
 * words out of four tested, which is why the rule handles repeats only.
 */
describe('normalizeElongation', () => {
  it('flattens the lines an engine hands straight back', () => {
    expect(normalizeElongation('BINNNNNNNGOOOOOOO')).toBe('BINGO');
    expect(normalizeElongation('muuuuy biennnn')).toBe('muy bien');
    expect(normalizeElongation('ESCAPARE BULDYYYYY')).toBe('ESCAPARE BULDY');
  });

  it('leaves real Japanese words alone', () => {
    // The regression that killed the first version of this rule.
    for (const word of ['コーヒー', 'ラーメン', 'スーパー', 'コーヒーメーカー']) {
      expect(normalizeElongation(word), `${word} must survive untouched`).toBe(word);
    }
  });

  it('collapses only repeated prolongation marks', () => {
    expect(normalizeElongation('おわりーーー')).toBe('おわりー');
  });

  it('leaves legitimate doubled letters alone', () => {
    // Two is a word, three is stretching. The boundary is the whole rule.
    for (const word of ['cool', 'schnell', 'goed', 'meeting']) {
      expect(normalizeElongation(word), `${word} must survive untouched`).toBe(word);
    }
  });

  it('changes nothing when there is nothing stretched', () => {
    // The pipeline compares the result against the input to decide whether a
    // retry is even worth a request. An identity result must mean identity.
    const plain = 'que fue con esos amigos';
    expect(normalizeElongation(plain)).toBe(plain);
  });
});

// The retry asked the engine about text nobody typed: `k mano`, `ㅋ 진짜`,
// `w.youtube.com`. Laughter and links stay whole; the rest still flattens.
describe('normalizeElongation leaves laughter and links whole', () => {
  it('keeps laughter tokens', () => {
    expect(normalizeElongation('kkkkk mano que isso')).toBe('kkkkk mano que isso');
    expect(normalizeElongation('ㅋㅋㅋ 진짜 웃기네')).toBe('ㅋㅋㅋ 진짜 웃기네');
    expect(normalizeElongation('kkkkk! muuuuy bien')).toBe('kkkkk! muy bien');
  });
  it('keeps links with or without a scheme', () => {
    expect(normalizeElongation('www.youtube.com/watch?v=x olhaaaa')).toBe('www.youtube.com/watch?v=x olha');
    expect(normalizeElongation('miraaa kick.com/clips/abc')).toBe('mira kick.com/clips/abc');
  });
});
