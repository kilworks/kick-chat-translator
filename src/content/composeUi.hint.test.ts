import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// P3-2: the glyph alone did not say Tab inserts the translation. The key's name
// sits beside it (the verb is in the tooltip) until the reader has inserted
// once or seen five previews, then it is remembered and gone.
// And the panel no longer hides the last chat line: it reserves room under
// Kick's list while it is up, measured on kick.com.

import { getHint, setHint } from '~/background/pageStore';

vi.mock('./injector', () => ({ showToast: vi.fn() }));

const stored: Record<string, unknown> = {};
const local = {
  get: vi.fn(async (k: string) => (k in stored ? { [k]: stored[k] } : {})),
  set: vi.fn(async (o: Record<string, unknown>) => void Object.assign(stored, o)),
};

beforeEach(() => {
  vi.resetModules();
  for (const k of Object.keys(stored)) delete stored[k];
  local.get.mockClear();
  local.set.mockClear();
  // The content script asks the worker, whose pageStore owns the key.
  vi.stubGlobal('chrome', {
    storage: { local },
    runtime: {
      lastError: undefined,
      sendMessage: (m: { type: string; value: boolean | number }, cb: (r: unknown) => void) => {
        // Called at once, not after an import: the write must land before the next line of a test.
        if (m.type === 'hint.set') void setHint(m.value).then(() => cb({ type: 'ack' }));
        else void getHint().then((payload) => cb({ type: 'value', payload }));
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const flush = () => new Promise((r) => setTimeout(r, 0));

async function mounted() {
  const ui = await import('./composeUi');
  document.body.innerHTML =
    '<div id="channel-chatroom"><div id="chatroom-messages"></div><div class="composer" contenteditable="true"></div></div>';
  const composer = document.querySelector<HTMLElement>('.composer')!;
  ui.mountComposePreview(composer, 'en', { onInsert: () => {} });
  await flush();
  ui.updateComposePreview({ kind: 'ready', text: 'hello', provider: 'google' });
  return { ui, composer, hint: () => document.querySelector('.kt-compose-hint') };
}

describe('first-use hint', () => {
  it('names the key until the first insert, then goes for good', async () => {
    const { ui, hint } = await mounted();
    expect(hint()?.textContent).toBe('Tab');
    expect(document.querySelector<HTMLElement>('.kt-compose-insert')?.title).toContain('Insert');
    ui.noteComposeInserted();
    expect(hint()).toBeNull();
    expect(stored['kt.composeInsertHintDone']).toBe(true);
    // The glyph stays: only the words go.
    expect(document.querySelector('.kt-compose-insert')?.textContent).toBe('⇥');
  });

  // The panel is never focusable (it would steal the composer's focus), so the
  // preview is announced as it changes and the keys are in the cue's name.
  it('is announced and says which keys insert it', async () => {
    const { ui } = await mounted();
    const text = document.querySelector('.kt-compose-text')!;
    expect(text.getAttribute('role')).toBe('status');
    expect(text.getAttribute('aria-live')).toBe('polite');
    const cue = document.querySelector('.kt-compose-insert')!;
    expect(cue.getAttribute('aria-label')).toContain('Esc');
    ui.setComposeInsertKey('ctrl-enter');
    expect(document.querySelector('.kt-compose-insert')!.getAttribute('aria-label')).toContain('Ctrl/Cmd+Enter');
  });

  it('is not shown again to a reader who already inserted', async () => {
    stored['kt.composeInsertHintDone'] = true;
    const { hint } = await mounted();
    expect(hint()).toBeNull();
  });

  it('names Ctrl/Cmd+Enter when that is the key', async () => {
    const { ui, hint } = await mounted();
    ui.setComposeInsertKey('ctrl-enter');
    expect(hint()?.textContent).toBe('Ctrl+Enter');
    // The tooltip still names both keyboards.
    expect(document.querySelector<HTMLElement>('.kt-compose-insert')?.title).toContain('Ctrl/Cmd+Enter');
  });

  it('names only the keyboard in use, in the language set', async () => {
    const { insertKeyName } = await import('./composeUi');
    const de = 'Einf\u00fcgen \u00b7 Strg/Cmd+Eingabe \u00b7 Esc zum Schlie\u00dfen';
    expect(insertKeyName(de, '', false)).toBe('Strg+Eingabe');
    expect(insertKeyName(de, '', true)).toBe('Cmd+Eingabe');
    expect(insertKeyName('Insert \u00b7 Tab \u00b7 Esc to dismiss', '', true)).toBe('Tab');
  });

  // A reader who reads the preview and types their own reply never inserts.
  it('retires after five previews without an insert', async () => {
    const { ui, hint } = await mounted(); // first preview
    for (let i = 2; i <= 5; i++) {
      ui.updateComposePreview({ kind: 'hidden' });
      ui.updateComposePreview({ kind: 'ready', text: `m${i}`, provider: 'google' });
      expect(hint()).not.toBeNull();
    }
    expect(stored['kt.composeInsertHintDone']).toBe(5);
    ui.updateComposePreview({ kind: 'hidden' });
    ui.updateComposePreview({ kind: 'ready', text: 'm6', provider: 'google' });
    expect(hint()).toBeNull();
    expect(stored['kt.composeInsertHintDone']).toBe(true);
  });

  // Control: refreshing the same preview while typing is not a new showing.
  it('does not count a preview refreshed while typing', async () => {
    const { ui } = await mounted();
    for (let i = 0; i < 8; i++) ui.updateComposePreview({ kind: 'ready', text: `t${i}`, provider: 'google' });
    expect(stored['kt.composeInsertHintDone']).toBe(1);
  });

  it('takes the key name from the tooltip of every catalogue', async () => {
    const { insertKeyName } = await import('./composeUi');
    const { CHAT_MESSAGES } = await import('./i18n');
    for (const [locale, table] of Object.entries(CHAT_MESSAGES)) {
      for (const k of ['composeInsertTip', 'composeInsertTipTab']) {
        const name = insertKeyName(table[k]!, '');
        expect({ locale, k, ok: name.length > 0 && !name.includes('Esc') }).toEqual({ locale, k, ok: true });
      }
    }
    expect(insertKeyName('no dots here', 'Tab')).toBe('Tab');
  });
});

describe('the last chat line stays visible', () => {
  it('pads the chat list by what the panel covers, and gives it back when hidden', async () => {
    // Kick's boxes at 1280x720: composer top 624, list bottom 590, panel 38px.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(38);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = this.classList.contains('composer') ? 624 : 0;
      const bottom = this.id === 'chatroom-messages' ? 590 : top + 42;
      return { top, bottom, left: 0, right: 219, width: 219, height: bottom - top, x: 0, y: top, toJSON() {} } as DOMRect;
    });
    vi.stubGlobal('innerHeight', 720);
    const { ui } = await mounted();
    const list = document.getElementById('chatroom-messages')!;
    expect(list.style.paddingBottom).toBe('10px');
    ui.updateComposePreview({ kind: 'hidden' });
    expect(list.style.paddingBottom).toBe('');
  });
});
