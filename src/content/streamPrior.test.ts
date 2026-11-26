import { describe, expect, it } from 'vitest';
import { StreamPrior, familyOf } from './streamPrior';

const feed = (p: StreamPrior, answers: (string | undefined)[]) => answers.forEach((a) => p.observe(a));
const many = (a: string, n: number) => Array.from({ length: n }, () => a);

describe('families', () => {
  it('maps Japanese and the three Chinese answers, nothing else', () => {
    expect(familyOf('ja')).toBe('ja');
    for (const c of ['zh', 'zh-tw', 'yue']) expect(familyOf(c)).toBe('zh');
    expect(familyOf('en')).toBeUndefined();
    expect(familyOf(undefined)).toBeUndefined();
  });
});

describe('stream prior', () => {
  it('has no prior before 30 answers of the two families', () => {
    const p = new StreamPrior();
    feed(p, many('ja', 29));
    expect(p.family()).toBeUndefined();
    p.observe('ja');
    expect(p.family()).toBe('ja');
  });

  it('is Chinese on a Chinese stream, whatever the Chinese answer', () => {
    const p = new StreamPrior();
    feed(p, [...many('zh-tw', 15), ...many('yue', 10), ...many('zh', 10)]);
    expect(p.family()).toBe('zh');
  });

  it('stays undecided on a mixed stream', () => {
    const p = new StreamPrior();
    feed(p, [...many('ja', 30), ...many('zh-tw', 30)]);
    expect(p.family()).toBeUndefined();
  });

  it('ignores other languages and unanswered lines', () => {
    const p = new StreamPrior();
    feed(p, [...many('en', 500), ...many(undefined as unknown as string, 500)]);
    expect(p.family()).toBeUndefined();
    feed(p, many('ja', 30));
    expect(p.family()).toBe('ja');
  });

  it('forgets: a long Japanese run then a longer Chinese run turns Chinese', () => {
    const p = new StreamPrior();
    feed(p, many('ja', 100));
    feed(p, many('zh', 400));
    expect(p.family()).toBe('zh');
  });

  it('reset clears everything', () => {
    const p = new StreamPrior();
    feed(p, many('ja', 100));
    p.reset();
    expect(p.family()).toBeUndefined();
  });
});
