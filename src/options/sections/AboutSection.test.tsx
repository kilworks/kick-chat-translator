import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { AboutSection } from './AboutSection';

let host: HTMLDivElement | undefined;

function mount() {
  vi.stubGlobal('chrome', {
    runtime: { getURL: () => 'chrome-extension://abc/', getManifest: () => ({ version: '1.0.0' }) },
    permissions: { getAll: () => Promise.resolve({}) },
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  render(<AboutSection />, host);
  return host;
}

afterEach(() => {
  if (host) render(null, host);
  host?.remove();
  host = undefined;
  vi.unstubAllGlobals();
});

describe('About tab, research card', () => {
  it('says what the research is for and links the related public repositories', () => {
    const el = mount();
    expect(el.textContent).toContain('The research behind it');
    const hrefs = [...el.querySelectorAll<HTMLAnchorElement>('a')].map((a) => a.href);
    for (const r of ['kct-detection-langue', 'kick-chat-translator-request', 'kick-translator-research'])
      expect(hrefs).toContain(`https://github.com/kilworks/${r}`);
    expect(hrefs).toContain('https://github.com/kilworks/kick-chat-translator/blob/master/docs/han-detection.md');
  });
});
