import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { Segmented, type SegmentedOption } from './Segmented';

const OPTS: SegmentedOption[] = [
  { value: 'a', label: 'Alpha', color: 'rgb(1 2 3)' },
  { value: 'b', label: 'Bravo', color: 'rgb(4 5 6)' },
  { value: 'c', label: 'Charlie', color: 'rgb(7 8 9)' },
];

let host: HTMLDivElement | undefined;

/** Stateful wrapper, so a keypress re-renders the way the options page does. */
function Harness({ start, swatch, spy }: { start: string; swatch?: boolean; spy: (v: string) => void }) {
  const [v, setV] = useState(start);
  return (
    <Segmented
      label="Pick one"
      value={v}
      options={OPTS}
      swatch={swatch}
      onChange={(x) => {
        spy(x);
        setV(x);
      }}
    />
  );
}

function mount(start = 'a', swatch = false, spy = vi.fn()) {
  host = document.createElement('div');
  document.body.appendChild(host);
  void act(() => render(<Harness start={start} swatch={swatch} spy={spy} />, host!));
  return { el: host, spy };
}

const radios = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[role=radio]')];
const key = (target: HTMLElement, k: string, init: KeyboardEventInit = {}) =>
  void act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  });

afterEach(() => {
  if (host) render(null, host);
  host?.remove();
  host = undefined;
});

describe('Segmented', () => {
  it('is a radio group named by its visible label', () => {
    const { el } = mount();
    const group = el.querySelector('[role=radiogroup]')!;
    const name = document.getElementById(group.getAttribute('aria-labelledby')!);
    expect(name?.textContent).toBe('Pick one');
    expect(radios(el)).toHaveLength(3);
  });

  it('marks the checked option and gives it the only tab stop', () => {
    const { el } = mount('b');
    expect(radios(el).map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios(el).map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('selects on click', () => {
    const { el, spy } = mount();
    void act(() => radios(el)[2]!.click());
    expect(spy).toHaveBeenCalledWith('c');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(radios(el)[2]!.getAttribute('aria-checked')).toBe('true');
  });

  it('moves and selects with the arrows, wrapping at the ends', () => {
    const { el, spy } = mount('a');
    key(radios(el)[0]!, 'ArrowRight');
    expect(spy).toHaveBeenLastCalledWith('b');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(radios(el)[1]!);
    key(radios(el)[1]!, 'ArrowDown');
    expect(spy).toHaveBeenLastCalledWith('c');
    expect(spy).toHaveBeenCalledTimes(2);
    key(radios(el)[2]!, 'ArrowRight');
    expect(spy).toHaveBeenLastCalledWith('a');
    key(radios(el)[0]!, 'ArrowLeft');
    expect(spy).toHaveBeenLastCalledWith('c');
    expect(radios(el).map((r) => r.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('jumps with Home and End', () => {
    const { el, spy } = mount('b');
    key(radios(el)[1]!, 'End');
    expect(spy).toHaveBeenLastCalledWith('c');
    key(radios(el)[2]!, 'Home');
    expect(spy).toHaveBeenLastCalledWith('a');
    expect(document.activeElement).toBe(radios(el)[0]!);
  });

  it('leaves browser chords alone', () => {
    const { el, spy } = mount('a');
    for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      const ev = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true, ...init });
      void act(() => {
        radios(el)[0]!.dispatchEvent(ev);
      });
      expect(ev.defaultPrevented).toBe(false);
    }
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it('steps from the focused option when nothing is checked', () => {
    const { el, spy } = mount('none');
    key(radios(el)[1]!, 'ArrowRight');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith('c');
  });

  it('mirrors the arrows in rtl', () => {
    const { el, spy } = mount('a');
    el.style.direction = 'rtl';
    key(radios(el)[0]!, 'ArrowRight');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith('c');
  });

  it('gives checked and unchecked the same weight, so widths do not shift', () => {
    const { el } = mount('b');
    for (const r of radios(el)) expect(r.className).not.toMatch(/font-(semibold|bold)/);
  });

  it('ignores other keys', () => {
    const { el, spy } = mount();
    key(radios(el)[0]!, 'a');
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it('names each swatch by its colour and ticks the checked one', () => {
    const { el } = mount('c', true);
    const r = radios(el);
    expect(r.map((x) => x.getAttribute('aria-label'))).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(r[0]!.style.backgroundColor).not.toBe('');
    // Colour is not the only cue: the checked swatch carries the lucide tick.
    expect(r[2]!.querySelector('use')?.getAttribute('href')).toBe('#i-check');
    expect(r[0]!.querySelector('use')).toBeNull();
    expect(el.querySelector('symbol#i-check path')?.getAttribute('d')).toBe('M20 6 9 17l-5-5');
  });
});
