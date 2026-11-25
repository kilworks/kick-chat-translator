import { describe, expect, it } from 'vitest';
import { extraHan } from './hanScript';

describe('extraHan', () => {
  const zh = /[你吧]/u;
  it('reads a Chinese function character as zh', () => {
    expect(extraHan('你好', { zh })).toBe('zh');
  });
  it('says nothing without a hit', () => {
    expect(extraHan('天地', { zh })).toBeUndefined();
  });
  it('says nothing with no list at all', () => {
    expect(extraHan('你好', {})).toBeUndefined();
  });
});
