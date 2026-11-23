import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';
import { COMPOSE_DEBOUNCE_MS } from './composeLogic';

const ui = vi.hoisted(() => ({
  state: 'hidden',
  inserted: [] as string[],
  onInsert: undefined as (() => void) | undefined,
}));
const net = vi.hoisted(() => ({ asked: [] as string[] }));

// The panel and the network are faked; what is under test is when the
// controller decides to insert, and what.
vi.mock('./composeUi', () => ({
  insertIntoComposer: (_el: HTMLElement, text: string) => void ui.inserted.push(text),
  isComposePreviewMounted: () => true,
  isComposePreviewVisible: () => ui.state === 'ready',
  isKickSuggestionOpen: () => false,
  mountComposePreview: (_el: HTMLElement, _lang: string, h: { onInsert: () => void }) => void (ui.onInsert = h.onInsert),
  readComposerText: (el: HTMLElement) => el.textContent ?? '',
  setComposeTargetLang: () => undefined,
  setComposeThrottle: () => undefined,
  unmountComposePreview: () => undefined,
  updateComposePreview: (s: { kind: string }) => void (ui.state = s.kind),
  setComposeInsertKey: () => undefined,
  noteComposeInserted: () => undefined,
}));
vi.mock('./langChip', () => ({
  mountLangChip: () => undefined,
  unmountLangChip: () => undefined,
  updateLangChip: () => undefined,
}));
vi.mock('./platform', () => ({ refresh7TV: () => false }));
vi.mock('./usage', () => ({ countUsage: () => undefined }));
vi.mock('./selectors', async (orig) => ({
  ...(await orig<typeof import('./selectors')>()),
  findComposer: () => document.querySelector<HTMLElement>('#composer'),
}));
vi.mock('~/shared/messages', () => ({
  send: async (m: { payload: { text: string } }) => {
    net.asked.push(m.payload.text);
    return {
      type: 'translate.result',
      payload: { ok: true, result: { translatedText: `EN[${m.payload.text}]`, provider: 'google', cached: false } },
    };
  },
}));

const { ComposeController } = await import('./compose');

let controller: InstanceType<typeof ComposeController> | undefined;

function typeInto(el: HTMLElement, text: string): void {
  el.textContent = text;
  el.dispatchEvent(new Event('input'));
}

function pressTab(el: HTMLElement): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
}

async function previewFor(el: HTMLElement, text: string): Promise<void> {
  typeInto(el, text);
  await vi.advanceTimersByTimeAsync(COMPOSE_DEBOUNCE_MS + 10);
  expect(ui.state).toBe('ready');
}

beforeEach(() => {
  vi.useFakeTimers();
  ui.state = 'hidden';
  ui.inserted = [];
  net.asked = [];
  document.body.innerHTML = '<div id="composer" contenteditable="true"></div>';
  controller = new ComposeController({
    ...defaultSettings(),
    composeEnabled: true,
    composeTargetLang: 'en',
    showComposerChip: false,
  });
  controller.start();
});

afterEach(() => {
  controller?.stop();
  vi.useRealTimers();
});

const composer = (): HTMLElement => document.querySelector<HTMLElement>('#composer')!;

describe('accepting the compose preview', () => {
  // The preview stays on screen through the debounce after a keystroke. Tab in
  // that window used to replace everything typed with the translation of the
  // older text.
  it('never inserts the translation of an older text', async () => {
    const el = composer();
    await previewFor(el, 'hola amigo como estas');
    typeInto(el, 'hola amigo como estas y mañana');
    pressTab(el);
    expect(ui.inserted).toEqual([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(net.asked.at(-1)).toContain('mañana');
  });

  it('the panel button follows the same rule', async () => {
    const el = composer();
    await previewFor(el, 'buenas noches a todos');
    typeInto(el, 'buenas noches a todos los amigos');
    ui.onInsert?.();
    expect(ui.inserted).toEqual([]);
  });

  it('inserts the translation once it matches the text', async () => {
    const el = composer();
    await previewFor(el, 'que tal la partida de hoy');
    pressTab(el);
    expect(ui.inserted).toHaveLength(1);
    expect(ui.inserted[0]).toContain('que tal la partida de hoy');
  });
});
