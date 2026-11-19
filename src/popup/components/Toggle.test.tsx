import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { Toggle } from './Toggle';
import { Switch } from '../../shared/Switch';

let host: HTMLDivElement | undefined;

function mount(el: preact.VNode): HTMLDivElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  render(el, host);
  return host;
}

afterEach(() => {
  if (host) render(null, host);
  host?.remove();
  host = undefined;
});

const input = (el: HTMLElement) => el.querySelector<HTMLInputElement>('input[type=checkbox]')!;
const rail = (el: HTMLElement) => el.querySelector<HTMLElement>('.kt-switch-rail')!;

/** The shared switch's rules, read from its stylesheet. */
const css = readFileSync('src/shared/switch.css', 'utf8');
const rule = (sel: string) => {
  const at = css.indexOf(`\n${sel} {`);
  expect(at, `${sel} is missing`).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf('}', at));
};

/**
 * Space on a focused, enabled native checkbox is a click: the browser's own
 * keyboard path, which happy-dom does not synthesise. So the test proves the
 * preconditions (it takes focus, sits in the tab order, is enabled) and then
 * fires the click Space would.
 */
function space(i: HTMLInputElement) {
  i.focus();
  if (document.activeElement === i && i.tabIndex >= 0 && !i.disabled) i.click();
}

describe('Toggle', () => {
  it('reports the new value', () => {
    const onChange = vi.fn();
    const el = mount(<Toggle checked={false} onChange={onChange} />);
    input(el).click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles with Space once focused', () => {
    const onChange = vi.fn();
    const el = mount(<Toggle checked={false} onChange={onChange} />);
    space(input(el));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire while disabled, by click or by Space', () => {
    const onChange = vi.fn();
    const el = mount(<Toggle checked={false} onChange={onChange} disabled />);
    input(el).click();
    space(input(el));
    expect(onChange).not.toHaveBeenCalled();
  });

  // One component for every boolean: the options page renders the same one.
  it('is the shared switch, announced as a switch', () => {
    const el = mount(<Toggle checked={false} onChange={() => {}} />);
    expect(input(el).getAttribute('role')).toBe('switch');
    expect(el.querySelector('label')!.classList.contains('kt-switch')).toBe(true);
  });

  it('takes its accessible name from srLabel when given one', () => {
    const el = mount(<Toggle checked onChange={() => {}} label="enable" srLabel="Translate chat" />);
    expect(input(el).getAttribute('aria-label')).toBe('Translate chat');
    expect(el.textContent).toContain('enable');
  });

  /**
   * The rail used to be `bg-kick-border`, which flattens to 1.18:1 on a card:
   * an off switch with no visible track. `edge` is the token measured for a
   * control's boundary.
   */
  it('draws a visible rail when off', () => {
    expect(rule('.kt-switch-rail')).toContain('background: var(--kt-edge)');
  });

  /**
   * The knob used to be white in both states. White on the brand green is
   * 1.37:1: the knob disappeared exactly when the switch was on.
   */
  it('darkens the knob when on, so it stays visible against the green', () => {
    expect(rule('.kt-switch-knob')).toContain('background: var(--kt-text)');
    expect(rule('.kt-switch-input:checked + .kt-switch-rail .kt-switch-knob')).toContain(
      'background: var(--kt-ink)',
    );
  });

  // The popup's height budget is measured to the pixel: the shared switch keeps
  // the popup's 36x20 rail, 16px knob inset 2px, and 8px to the label.
  it('keeps the popup geometry', () => {
    expect(rule('.kt-switch-rail')).toMatch(/inline-size: 36px;[\s\S]*block-size: 20px;/);
    expect(rule('.kt-switch-knob')).toMatch(/inline-size: 16px;[\s\S]*block-size: 16px;/);
    expect(rule('.kt-switch')).toContain('gap: 8px');
  });

  /**
   * The input is visually hidden, so the browser has nothing of its own to
   * outline: the ring is drawn on the rail through the sibling selector, which
   * only works while the input precedes the rail in the DOM.
   */
  it('can show a focus ring at all', () => {
    const el = mount(<Toggle checked={false} onChange={() => {}} />);
    expect(rule('.kt-switch-input:focus-visible + .kt-switch-rail')).toContain('outline: 2px solid');
    expect(input(el).compareDocumentPosition(rail(el)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows its label when given one', () => {
    const el = mount(<Toggle checked onChange={() => {}} label="enable" />);
    expect(el.textContent).toContain('enable');
  });

  it('keeps the rail and knob visible in forced colors', () => {
    const at = css.indexOf('@media (forced-colors: active)');
    expect(at).toBeGreaterThanOrEqual(0);
    const block = css.slice(at);
    expect(block).toMatch(/\.kt-switch-rail \{[^}]*border: 1px solid CanvasText/);
    expect(block).toMatch(/\.kt-switch-knob \{[^}]*background: CanvasText/);
    expect(block).toMatch(/:checked \+ \.kt-switch-rail \{[^}]*background: Highlight/);
  });

  it('keeps a focus ring that differs from the invalid ring', () => {
    const inv = rule(".kt-switch-input[aria-invalid='true'] + .kt-switch-rail");
    const both = rule(".kt-switch-input[aria-invalid='true']:focus-visible + .kt-switch-rail");
    expect(both).toContain('var(--kt-green)');
    expect(both).not.toBe(inv);
    expect(both).toContain('outline-offset: 4px');
  });

  it('changes on hover when on, too', () => {
    const on = rule('.kt-switch-input:checked + .kt-switch-rail');
    const hov = rule('.kt-switch:not([data-disabled]):not([data-busy]):hover .kt-switch-input:checked + .kt-switch-rail');
    expect(hov).not.toContain('var(--kt-green);');
    expect(on).toContain('var(--kt-green);');
  });

  it('has no animation while busy', () => {
    expect(css).not.toContain('animation:');
    expect(css).not.toContain('@keyframes');
  });

  it('describes by the hint, out of the name, also with srLabel', () => {
    const el = mount(<Switch checked onChange={() => {}} label="x" srLabel="Name" hint="Why" />);
    const h = el.querySelector('.kt-switch-hint')!;
    expect(input(el).getAttribute('aria-describedby')).toBe(h.id);
    expect(h.id).not.toBe('');
    expect(h.getAttribute('aria-hidden')).toBe('true');
  });

  it('stays focusable and refuses changes while busy', () => {
    const onChange = vi.fn();
    const el = mount(<Switch checked={false} onChange={onChange} label="x" busy />);
    const i = input(el);
    i.focus();
    expect(document.activeElement).toBe(i);
    expect(i.disabled).toBe(false);
    expect(i.getAttribute('aria-disabled')).toBe('true');
    i.click();
    expect(onChange).not.toHaveBeenCalled();
    expect(i.checked).toBe(false);
  });
});
