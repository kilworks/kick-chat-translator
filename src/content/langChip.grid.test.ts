import { describe, expect, it } from 'vitest';
import { gridLines, gridMove } from './langChip';

// auto, one favourite, separator, then six languages: what CSS draws is
// [auto] [fav] [a b c] [d e f], option indices 0 | 1 | 2 3 4 | 5 6 7.
const lines = gridLines(['full', 'tile', 'break', 'tile', 'tile', 'tile', 'tile', 'tile', 'tile'], 3);

describe('language grid arrows', () => {
  it('lays the lines out like the CSS grid', () => {
    expect(lines).toEqual([[0], [1], [2, 3, 4], [5, 6, 7]]);
  });

  it('Down from the lone favourite lands on the first language, not the third', () => {
    expect(gridMove(lines, 1, 'ArrowDown', 0).to).toBe(2);
  });

  it('keeps the column through the one-entry auto line', () => {
    let r = gridMove(lines, 6, 'ArrowUp', 1); // e -> b
    expect(r.to).toBe(3);
    r = gridMove(lines, r.to, 'ArrowUp', r.col); // b -> fav
    r = gridMove(lines, r.to, 'ArrowUp', r.col); // fav -> auto
    r = gridMove(lines, r.to, 'ArrowUp', r.col); // auto wraps to the last line
    expect(r.to).toBe(6);
  });

  it('Left/Right step one option and wrap', () => {
    expect(gridMove(lines, 7, 'ArrowRight', 2)).toEqual({ to: 0, col: 0 });
    expect(gridMove(lines, 2, 'ArrowLeft', 0)).toEqual({ to: 1, col: 0 });
  });

  it('a filtered list with no separator flows as one grid', () => {
    expect(gridLines(['full', 'tile', 'tile', 'tile', 'tile'], 3)).toEqual([[0], [1, 2, 3], [4]]);
  });
});
