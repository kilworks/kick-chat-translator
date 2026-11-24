import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Settings } from '~/shared/settings';
import { defaultSettings } from '~/shared/settings';
import { send } from '~/shared/messages';
import { I18nProvider, useLoadedLocale } from '~/shared/i18nContext';
import { DiscordLink } from '~/shared/discord';
import { makeT, resolveUiLocale, isRtlLocale, UI_LOCALES, UI_LOCALE_NAMES } from '~/shared/i18n';
import type { UiLocale } from '~/shared/i18n';
import { flagClass } from '~/shared/flags';
import type { ProviderStatus, UsageStats } from '~/shared/types';
import { ProviderSection } from './sections/ProviderSection';
import { DisplaySection } from './sections/DisplaySection';
import { FilterSection } from './sections/FilterSection';
import { AdvancedSection } from './sections/AdvancedSection';
import { DebugSection } from './sections/DebugSection';
import { UsageTrend } from './sections/UsageTrend';
import { AboutSection } from './sections/AboutSection';

type Tab = 'providers' | 'display' | 'filters' | 'advanced' | 'activity' | 'about';

const TABS: { id: Tab; label: string }[] = [
  { id: 'providers', label: 'Providers' },
  { id: 'display', label: 'Display' },
  { id: 'filters', label: 'Filters' },
  { id: 'advanced', label: 'Advanced' },
  // Not debugging: the total of translated messages, what the cache saved and
  // the languages seen. Calling it Debug told the reader it was not for them.
  { id: 'activity', label: 'Activity' },
  { id: 'about', label: 'About' },
];

export function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [stats, setStats] = useState<UsageStats | undefined>(undefined);
  // `#filters` and the like open on that tab: the popup links straight to the
  // setting that explains why a channel is not translated. Without a hash the
  // page lands on Display, where the language and the look are: a newcomer's
  // first question, where Providers is the most technical tab.
  // `#filters-langs` opens the tab before the dash, then brings that card's
  // heading (id `filters-langs`) into view once the settings are in.
  const [tab, setTab] = useState<Tab>(() => {
    const asked = location.hash.slice(1).split('-')[0];
    return TABS.some((tb) => tb.id === asked) ? (asked as Tab) : 'display';
  });
  const [savedAt, setSavedAt] = useState<number | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const locale = useLoadedLocale(resolveUiLocale(settings.uiLang));
  const t = useMemo(() => makeT(locale), [locale]);

  useEffect(() => {
    void refresh()
      .catch(() => undefined)
      .then(() => {
        const card = location.hash.includes('-') ? document.getElementById(location.hash.slice(1)) : null;
        if (!card) return;
        requestAnimationFrame(() => {
          card.scrollIntoView({ block: 'start' });
          card.focus({ preventScroll: true });
        });
      });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  async function refresh() {
    // Together: three round trips in a row made the page wait for the sum.
    const [settingsRes, provRes, statsRes] = await Promise.all([
      send({ type: 'settings.get' }),
      send({ type: 'providers.status' }),
      send({ type: 'stats.get' }),
    ]);
    if (settingsRes.type === 'settings') setSettings(settingsRes.payload);
    if (provRes.type === 'providers') setProviders(provRes.payload);
    if (statsRes.type === 'stats') setStats(statsRes.payload);
  }

  /**
   * Arrow keys move between tabs, Home and End jump to the ends.
   *
   * Focus has to follow the selection, not just the state: the tab that was
   * focused is about to get tabIndex -1, and a browser drops focus to the body
   * when that happens. Moved on the next frame, once the new tab has rendered
   * with tabIndex 0.
   */
  function onTabKey(e: KeyboardEvent) {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = TABS.findIndex((x) => x.id === tab);
    // Left and right are mirrored in a right-to-left interface, as in Segmented.
    const fwd = getComputedStyle(e.currentTarget as HTMLElement).direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? TABS.length - 1
          : (i + (e.key === fwd ? 1 : -1) + TABS.length) % TABS.length;
    const id = TABS[next]!.id;
    setTab(id);
    requestAnimationFrame(() => tabRefs.current[id]?.focus());
  }

  async function patch(patchValue: Partial<Settings>) {
    const res = await send({ type: 'settings.set', payload: patchValue });
    if (res.type === 'settings') {
      setSaveError(undefined);
      setSettings(res.payload);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(undefined), 1500);
    } else if (res.type === 'error') {
      // All settings are one chrome.storage.sync item, capped at 8192 bytes.
      setSaveError(
        /quota/i.test(res.payload.message)
          ? t('Not saved: your lists are too long for browser sync. Shorten the blocked words, the glossary or the user lists.')
          : t('Not saved.'),
      );
    }
  }

  return (
    <I18nProvider value={t}>
      <div class="mx-auto max-w-3xl px-6 py-10">
        <header class="mb-6 flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-md bg-kick-primary text-kick-dark font-black text-xl">
            K
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight">Kick Chat Translator</h1>
            <p class="text-xs text-kick-muted">
              v{chrome.runtime.getManifest().version} · {t('options & preferences')}
            </p>
          </div>
          <div class="ms-auto flex items-center gap-3">
            {/* Always in the DOM: a live region announces what lands in it, and
                one that appears with its text is often not announced at all. */}
            <span role="status" class="text-xs text-kick-primary">
              {savedAt ? t('saved') : ''}
            </span>
            <UiLangPicker value={settings.uiLang} onPick={(v) => void patch({ uiLang: v })} />
          </div>
        </header>
        {/* Always in the DOM, so a screen reader hears the message when it appears. */}
        <p role="status" class={saveError ? 'mb-4 text-xs text-red-400' : 'sr-only'}>
          {saveError ?? ''}
        </p>

        {/* The APG tabs pattern, which this was missing entirely: without
            role=tab and aria-selected a screen reader announces six unrelated
            buttons and cannot say which one is showing. Roving tabindex keeps
            the whole bar to a single tab stop (it took five before), and the
            arrows move between tabs, which is where a keyboard user reaches
            for them. */}
        {/* The Discord link sits on the tab row but outside the tablist: a link
            inside role=tablist would break the arrow-key pattern above. The
            tabs wrap rather than scroll: a scrolled-out tab still sat under
            the link at 320 and 414px (verify_overflow). */}
        <div class="mb-5 flex items-center border-b border-kick-border">
          <nav
            role="tablist"
            aria-label={t('Settings sections')}
            class="kt-tabs flex min-w-0 flex-1 flex-wrap gap-2"
            onKeyDown={onTabKey}
          >
            {TABS.map((tb) => (
              <button
                key={tb.id}
                id={`tab-${tb.id}`}
                role="tab"
                aria-selected={tab === tb.id}
                aria-controls={tab === tb.id ? `panel-${tb.id}` : undefined}
                tabIndex={tab === tb.id ? 0 : -1}
                ref={(el) => {
                  tabRefs.current[tb.id] = el as HTMLButtonElement | null;
                }}
                class={`shrink-0 whitespace-nowrap px-4 py-2 text-sm border-b-2 transition ${
                  tab === tb.id
                    ? 'border-kick-primary text-kick-text'
                    : 'border-transparent text-kick-muted hover:text-kick-text'
                }`}
                onClick={() => setTab(tb.id)}
              >
                {t(tb.label)}
              </button>
            ))}
          </nav>
          <DiscordLink class="shrink-0 px-2 py-2 text-kick-muted transition hover:text-[#5865F2]" />
        </div>

        <main>
        <div
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
          class="space-y-6 pb-12"
        >
          {tab === 'providers' && (
            <ProviderSection settings={settings} providers={providers} onPatch={patch} />
          )}
          {tab === 'display' && <DisplaySection settings={settings} onPatch={patch} />}
          {tab === 'filters' && (
            <FilterSection settings={settings} onPatch={patch} stats={stats} />
          )}
          {tab === 'advanced' && <AdvancedSection settings={settings} onPatch={patch} stats={stats} />}
          {tab === 'activity' && (
            <>
              {stats && <UsageTrend stats={stats} />}
              <DebugSection />
            </>
          )}
          {tab === 'about' && (
            <AboutSection stats={stats} providers={providers} settings={settings} onPatch={patch} />
          )}
        </div>
        </main>
      </div>
    </I18nProvider>
  );
}

/** The flag of a UI locale: `pt` is the Brazilian interface, `pt-pt` the European one. */
function uiFlag(l: UiLocale): string | undefined {
  return flagClass(l === 'pt' ? 'pt-br' : l === 'pt-pt' ? 'pt' : l);
}

/**
 * The interface language, as a list with flags: a native <select> cannot draw
 * them. Labels stay in each language's own name, and the control's name stays
 * in English on purpose: it is what you use to leave a language you cannot read.
 */
function UiLangPicker({ value, onPick }: { value: Settings['uiLang']; onPick: (v: Settings['uiLang']) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const choices = ['auto', ...UI_LOCALES] as Settings['uiLang'][];

  useEffect(() => {
    if (!open) return;
    (list.current?.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus();
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const pick = (v: Settings['uiLang']) => {
    onPick(v);
    setOpen(false);
    (box.current?.querySelector('button') as HTMLElement | null)?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role=option]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => items[Math.max(0, Math.min(items.length - 1, i))]?.focus();
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      (box.current?.querySelector('button') as HTMLElement | null)?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      go(at + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      go(at - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(items.length - 1);
    } else if ((e.key === 'Enter' || e.key === ' ') && at >= 0) {
      e.preventDefault();
      pick(choices[at]!);
    }
  };

  const label = (l: Settings['uiLang']) => (l === 'auto' ? 'Auto' : UI_LOCALE_NAMES[l]);
  // Auto shows the flag of the language it resolved to: an empty box in front
  // of "Auto" read as a missing flag.
  const flag = (l: Settings['uiLang']) => {
    const c = uiFlag(l === 'auto' ? resolveUiLocale('auto') : l);
    return c ? <span class={`${c} shrink-0`} aria-hidden="true" /> : <span class="inline-block w-[1.33em] shrink-0" />;
  };

  return (
    // Tab out of the list closes it: it used to stay open over the page.
    <div
      ref={box}
      class="relative"
      onFocusOut={(e) => {
        if (open && !box.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        class="flex items-center gap-1.5 rounded border border-kick-stroke bg-kick-surface px-1.5 py-1 text-xs text-kick-text"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Interface language"
        title="Interface language"
        onClick={() => setOpen(!open)}
      >
        {flag(value)}
        <span lang={value === 'auto' ? undefined : value}>{label(value)}</span>
      </button>
      {open && (
        <ul
          ref={list}
          role="listbox"
          aria-label="Interface language"
          class="absolute end-0 z-30 mt-1 max-h-80 w-52 overflow-y-auto rounded border border-kick-stroke bg-kick-surface py-1 text-xs text-kick-text shadow-lg"
          onKeyDown={onKey}
        >
          {choices.map((l) => (
            <li
              key={l}
              role="option"
              aria-selected={l === value}
              tabIndex={-1}
              class={`flex cursor-pointer items-center gap-2 px-2 py-1 outline-none hover:bg-kick-stroke/40 focus:bg-kick-stroke/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kick-primary ${
                l === value ? 'font-semibold text-kick-primary' : ''
              }`}
              onClick={() => pick(l)}
            >
              {flag(l)}
              <span dir="auto" lang={l === 'auto' ? undefined : l}>
                {label(l)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
