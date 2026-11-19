import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { defaultSettings } from '~/shared/settings';

vi.mock('~/shared/messages', () => ({
  send: vi.fn(() => Promise.resolve({ type: 'noop' })),
}));

const { AdvancedSection } = await import('./AdvancedSection');

let host: HTMLDivElement | undefined;

function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  render(<AdvancedSection settings={defaultSettings()} onPatch={() => {}} />, host);
  return host;
}

afterEach(() => {
  if (host) render(null, host);
  host?.remove();
  host = undefined;
});

/** P2-8: the Advanced tab spoke in engineer terms a reader cannot act on. */
describe('Advanced section wording', () => {
  it('uses no jargon', () => {
    const text = mount().textContent ?? '';
    for (const jargon of ['TTL', 'In-flight', 'hammering']) expect(text).not.toContain(jargon);
  });

  it('names the cache duration in plain words', () => {
    const el = mount();
    expect(el.querySelector('[aria-label="Keep translations for (hours)"]')).not.toBeNull();
  });

  // The chat bar and the popup now say when a channel list blocks the channel,
  // so the reset note no longer has to explain filters left active.
  it('keeps the reset note short', () => {
    const text = mount().textContent ?? '';
    expect(text).not.toContain('stop appearing');
    expect(text).toContain('"Reset all settings" puts every setting back to its default.');
  });
});
