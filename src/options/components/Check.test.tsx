import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { Check } from './Check';

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

describe('Check', () => {
  it('keeps a real checkbox underneath, so the browser still owns the keyboard', () => {
    const el = mount(<Check checked={false} onChange={() => {}} label="Ignore bots" />);
    expect(input(el)).not.toBeNull();
    expect(input(el).type).toBe('checkbox');
  });

  // Settings apply at once, like the popup's switches and Kick's own: the
  // options page drew checkboxes for the same kind of setting.
  it('is a switch, the same control as the popup', () => {
    const el = mount(<Check checked={false} onChange={() => {}} label="Ignore bots" />);
    expect(input(el).getAttribute('role')).toBe('switch');
    expect(rail(el)).not.toBeNull();
    expect(el.querySelector('.kt-check-box')).toBeNull();
  });

  it('is named by its label without needing an id', () => {
    const el = mount(<Check checked={false} onChange={() => {}} label="Ignore bots" />);
    // The input lives inside the <label>, which is what names it.
    expect(input(el).closest('label')?.textContent).toContain('Ignore bots');
    expect(input(el).getAttribute('aria-label')).toBeNull();
  });

  it('reports the new value when toggled', () => {
    const onChange = vi.fn();
    const el = mount(<Check checked={false} onChange={onChange} label="x" />);
    input(el).click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles from the label text, not only from the rail', () => {
    const onChange = vi.fn();
    const el = mount(<Check checked={false} onChange={onChange} label="Ignore bots" />);
    el.querySelector<HTMLElement>('.kt-check-label')!.click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles with Space once focused', () => {
    const onChange = vi.fn();
    const el = mount(<Check checked={false} onChange={onChange} label="x" />);
    space(input(el));
    expect(document.activeElement).toBe(input(el));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire while disabled, by click or by Space', () => {
    const onChange = vi.fn();
    const el = mount(<Check checked={false} onChange={onChange} label="x" disabled />);
    input(el).click();
    space(input(el));
    expect(onChange).not.toHaveBeenCalled();
  });

  // `busy` refuses the change but keeps the input focusable (aria-disabled).
  it('does not fire while busy', () => {
    const onChange = vi.fn();
    const el = mount(<Check checked={false} onChange={onChange} label="x" busy />);
    input(el).click();
    expect(onChange).not.toHaveBeenCalled();
    expect(input(el).disabled).toBe(false);
    expect(input(el).getAttribute('aria-disabled')).toBe('true');
  });

  it('announces busy and invalid to assistive technology', () => {
    const busyEl = mount(<Check checked={false} onChange={() => {}} label="x" busy />);
    expect(input(busyEl).getAttribute('aria-busy')).toBe('true');
    render(null, host!);
    const badEl = mount(<Check checked={false} onChange={() => {}} label="x" invalid />);
    expect(input(badEl).getAttribute('aria-invalid')).toBe('true');
  });

  it('leaves those attributes off when the states do not apply', () => {
    const el = mount(<Check checked={false} onChange={() => {}} label="x" />);
    expect(input(el).getAttribute('aria-busy')).toBeNull();
    expect(input(el).getAttribute('aria-invalid')).toBeNull();
  });

  // The drawn rail must never take the input's place in the tree.
  it('hides the drawn rail from assistive technology', () => {
    const el = mount(<Check checked onChange={() => {}} label="x" />);
    expect(rail(el).getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the hint under the label when given one', () => {
    const el = mount(<Check checked onChange={() => {}} label="Pause" hint="Saves quota" />);
    expect(el.textContent).toContain('Saves quota');
    expect(el.querySelector('.kt-switch-hint')?.textContent).toBe('Saves quota');
  });

  it('puts the control after the label on reverse without moving the input', () => {
    const el = mount(<Check checked={false} onChange={() => {}} label="x" reverse />);
    expect(el.querySelector('label')!.hasAttribute('data-reverse')).toBe(true);
    // Still inside the label, so it is still what names and toggles.
    expect(input(el).closest('label')).not.toBeNull();
  });
});

/**
 * Stylesheet floors. Read from the file: the rules are applied with @apply,
 * so they are compiled into the CSS and never appear in className.
 */
describe('options stylesheet', () => {
  const css = readFileSync('src/options/styles.css', 'utf8');
  const rule = (sel: string) => {
    // Line-start match: `.kt-card .kt-hint {` is a different rule.
    const at = css.indexOf(`\n  ${sel} {`);
    expect(at, `${sel} is missing`).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  // Meaningful text never under 12px: th, ta, hi and bn read badly below it.
  it.each(['.kt-hint', '.kt-label', '.kt-chip-toggle'])('%s is at least 12px', (sel) => {
    expect(rule(sel)).not.toMatch(/text-\[(9|10|11)px\]/);
    expect(rule(sel)).toContain('text-xs');
  });

  // gap-1.5 is 6px, measured 7.5px between a .kt-label and its control.
  it('leaves at least 8px between a label and its control', () => {
    expect(rule('.kt-row')).toMatch(/gap-(2|2\.5|3)\b/);
  });

  it('keeps the whole switch row at the 24px target floor', () => {
    expect(rule('.kt-check')).toContain('min-block-size: 24px');
  });

  // Control: the sizes above are read from a rule that is really there.
  it('finds the rules it measures', () => {
    expect(() => rule('.kt-nothing-here')).toThrow();
  });

  it('draws a disabled ghost button', () => {
    const styles = readFileSync('src/options/styles.css', 'utf8');
    expect(styles).toMatch(/\.kt-btn-ghost:disabled[^{]*\{[^}]*opacity: 0\.4[^}]*cursor: not-allowed/);
    expect(styles).toMatch(/\.kt-btn-ghost\[aria-disabled='true'\]/);
    expect(styles).toMatch(/\.kt-btn-ghost:disabled:hover[^{]*\{[^}]*background: transparent/);
  });
});

// The shared switch (src/shared/switch.css) in Windows high contrast and in
// its two held states. Not seen in a real browser here: these read the rules.
describe('switch in forced colors, busy and disabled', () => {
  const css = readFileSync('src/shared/switch.css', 'utf8');
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  const block = (sel: string, from: string) => {
    const at = from.indexOf(`${sel} {`);
    expect(at, `${sel} is missing`).toBeGreaterThanOrEqual(0);
    return from.slice(at, from.indexOf('}', at));
  };

  it('keeps the rail and knob out of the forced repaint', () => {
    expect(forced).toMatch(/\.kt-switch-rail,\s*\.kt-switch-knob \{\s*forced-color-adjust: none;/);
  });

  it('draws every part with system colours only', () => {
    const colours = forced.match(/(?:background|border|border-color|outline|color):[^;]+;/g) ?? [];
    expect(colours.length).toBeGreaterThan(8);
    for (const c of colours) expect(c, c).not.toMatch(/var\(|#|rgb/);
  });

  it('keeps a focus ring apart from a Highlight rail', () => {
    const ring = block('.kt-switch-input:focus-visible + .kt-switch-rail', forced);
    expect(ring).toContain('outline: 2px solid Highlight');
    expect(ring).toContain('outline-offset: 2px');
  });

  it('centres the knob inside the 1px border, on and off', () => {
    // The knob's own rule, not the forced-color-adjust one it shares with the rail.
    const knob = forced.slice(forced.indexOf('forced-color-adjust: none;'));
    expect(block('.kt-switch-knob', knob)).toContain('inset-inline-start: 1px');
    // 36px rail - 2px border - 16px knob - 1px inset.
    expect(block('.kt-switch-input:checked + .kt-switch-rail .kt-switch-knob', forced)).toContain('inset-inline-start: 17px');
  });

  it('says disabled with GrayText at full opacity', () => {
    const d = block('.kt-switch[data-disabled]', forced);
    expect(d).toContain('opacity: 1');
    expect(d).toContain('color: GrayText');
  });

  it('marks busy by shape, not by dimming', () => {
    const busy = block('.kt-switch[data-busy] .kt-switch-rail', css);
    expect(busy).not.toContain('opacity');
    expect(busy).toContain('repeating-linear-gradient');
    // On Canvas, not Highlight: dashes in Highlight on a Highlight fill vanished.
    const fBusy = block('.kt-switch[data-busy] .kt-switch-rail', forced);
    expect(fBusy).toContain('border: 1px dashed CanvasText');
    expect(fBusy).toContain('background: Canvas;');
  });

  // Control: the disabled state is still the dimmed one outside forced colours.
  it('still dims a disabled switch in the normal theme', () => {
    expect(block('.kt-switch[data-disabled]', css)).toContain('opacity: 0.6');
  });

  it('marks a busy switch on the element the CSS reads', () => {
    const el = mount(<Check checked onChange={() => {}} label="x" busy />);
    expect(el.querySelector('.kt-switch')!.hasAttribute('data-busy')).toBe(true);
    expect(el.querySelector('.kt-switch')!.hasAttribute('data-disabled')).toBe(false);
    expect(rail(el)).not.toBeNull();
  });
});
