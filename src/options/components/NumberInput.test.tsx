import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { NumberInput } from './NumberInput';

let host: HTMLDivElement | undefined;
afterEach(() => {
  if (host) render(null, host);
  host?.remove();
});

function mount(onCommit: (v: number) => void, value = 100) {
  host = document.createElement('div');
  document.body.appendChild(host);
  void act(() => render(<NumberInput label="Cache" min={100} max={20000} value={value} onCommit={onCommit} />, host!));
  return host.querySelector('input')!;
}

const type = (input: HTMLInputElement, text: string) =>
  act(() => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const done = (input: HTMLInputElement) => act(() => void input.dispatchEvent(new Event('change', { bubbles: true })));

// Typing 15000 used to save 1, 15, 150 and 1500 on the way, and clearing the box
// posted 0, which the schema refuses with a red "Not saved."
describe('NumberInput', () => {
  it('saves once, when the reader is done, not on every keystroke', async () => {
    const onCommit = vi.fn();
    const input = mount(onCommit);
    for (const text of ['1', '15', '150', '1500', '15000']) await type(input, text);
    expect(onCommit).not.toHaveBeenCalled();
    await done(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(15000);
  });

  it('flags an empty or out-of-range box and never saves it', async () => {
    const onCommit = vi.fn();
    const input = mount(onCommit);
    await type(input, '');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await done(input);
    await type(input, '5');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await done(input);
    expect(onCommit).not.toHaveBeenCalled();
    // Put back to what is saved, not left showing a number that is not.
    expect(input.value).toBe('100');
  });
});
