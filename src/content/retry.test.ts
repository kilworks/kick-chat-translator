import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { showError } from './injector';

/**
 * The retry control on a failed line was operable by exactly one input method.
 *
 * Measured in Chrome before this: `opacity: 0` at rest, no `tabindex`, never
 * reached in six tab presses, and on a touch viewport `(hover: hover)` is false
 * so it stayed at zero opacity with nothing to reveal it. It carried
 * `role="button"`, so assistive technology announced a button that answered to
 * a mouse hover and nothing else.
 */
const css = readFileSync('src/content/inject.css', 'utf8');

function fail(): { retry: HTMLElement; calls: () => number } {
  const row = document.createElement('div');
  document.body.appendChild(row);
  let n = 0;
  showError(row, 'Translation unavailable', () => {
    n += 1;
  });
  return { retry: row.querySelector<HTMLElement>('.kt-retry')!, calls: () => n };
}

afterEach(() => {
  document.body.textContent = '';
});

describe('retry control', () => {
  it('is in the tab order', () => {
    const { retry } = fail();
    expect(retry.tabIndex).toBe(0);
    expect(retry.getAttribute('role')).toBe('button');
  });

  it.each(['Enter', ' '])('activates on %s, which a span never does for free', (key) => {
    const { retry, calls } = fail();
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    retry.dispatchEvent(e);
    expect(calls()).toBe(1);
    // Space would scroll the chat out from under the reader otherwise.
    expect(e.defaultPrevented).toBe(true);
  });

  it('ignores keys that are not activation keys', () => {
    const { retry, calls } = fail();
    for (const key of ['a', 'Tab', 'ArrowDown', 'Escape']) {
      retry.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
    expect(calls()).toBe(0);
  });

  it('still answers a click', () => {
    const { retry, calls } = fail();
    retry.click();
    expect(calls()).toBe(1);
  });

  it('does not let the click reach the chat line underneath', () => {
    const row = document.createElement('div');
    document.body.appendChild(row);
    const onRow = vi.fn();
    row.addEventListener('click', onRow);
    showError(row, 'x', () => undefined);
    row.querySelector<HTMLElement>('.kt-retry')!.click();
    expect(onRow).not.toHaveBeenCalled();
  });

  it('is revealed by focus, not only by hover', () => {
    // Asserted on the stylesheet: happy-dom has no :focus-visible matching.
    const reveal = css.slice(css.indexOf('.kt-translation:hover .kt-retry'));
    expect(reveal.slice(0, reveal.indexOf('}'))).toContain('.kt-retry:focus-visible');
  });

  it('is revealed at rest where hovering is impossible', () => {
    expect(css).toMatch(/@media \(hover: none\)\s*\{\s*\.kt-retry\s*\{[^}]*opacity:\s*1/);
  });

  /**
   * Control on the two above: the resting state must still be hidden, or the
   * rules that reveal it are guarding nothing and every chat line carries a
   * permanent glyph.
   */
  it('is still hidden at rest on a pointer device', () => {
    const at = css.indexOf('.kt-retry {');
    expect(css.slice(at, css.indexOf('}', at))).toMatch(/opacity:\s*0;/);
  });
});

describe('error line', () => {
  /**
   * The error was `display: block` with a top margin, so a failed line grew a
   * whole extra row. It never arrives alone: when a provider is down every line
   * in the chat gets one. Measured in a 420px column, 4 repeats of 8 messages:
   * a bare row is 31.4px and 13 fit; with the block error, 47.6px and 8 fit.
   * Inline: 36.5px and 11 fit.
   */
  it('sits on the line it belongs to, not on one of its own', () => {
    const at = css.indexOf('.kt-error {');
    const body = css.slice(at, css.indexOf('}', at));
    expect(body).toMatch(/display:\s*inline;/);
    expect(body).not.toMatch(/margin-top:/);
    // Logical, so a mirrored chat puts the gap on the correct side.
    expect(body).toMatch(/margin-inline-start:/);
  });
});
