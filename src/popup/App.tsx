import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Settings } from '~/shared/settings';
import { defaultSettings } from '~/shared/settings';
import { sortedLanguages } from '~/shared/languages';
import { send, type RuntimeMessage } from '~/shared/messages';
import { extractChannelSlug } from '~/content/kickApi';
import { LANG_BLOCKED_ASK, START_ASK, START_SET, channelBlockedBy } from '~/content/filters';
import { memoriserLangueChaine, vueDeChaine } from '~/shared/channelLang';
import { I18nProvider, useLoadedLocale } from '~/shared/i18nContext';
import { DiscordLink } from '~/shared/discord';
import { makeT, resolveUiLocale, isRtlLocale } from '~/shared/i18n';
import type { ProviderStatus, UsageStats } from '~/shared/types';
import type { UpdateStatus } from '~/shared/version';
import { Toggle } from './components/Toggle';
import { ProviderPill } from './components/ProviderPill';
import { StatsBar } from './components/StatsBar';

interface DeeplUsage {
  configured: boolean;
  count: number;
  limit: number;
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [stats, setStats] = useState<UsageStats | undefined>(undefined);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [deepl, setDeepl] = useState<DeeplUsage | undefined>(undefined);
  const [update, setUpdate] = useState<UpdateStatus | undefined>(undefined);
  const [savedAt, setSavedAt] = useState<number | undefined>(undefined);
  // The worker did not answer, or refused a change: said in the footer's status line.
  const [failed, setFailed] = useState<string | undefined>(undefined);
  // Clear cache is an icon with nothing to show for a press: said for 2 s in
  // the footer's status line, which is already a polite live region.
  const [cleared, setCleared] = useState(false);
  // La chaine de l'onglet actif. Le bandeau met en pause par chaine ; sans ca,
  // l'interrupteur ci-dessous disait "active" sur un onglet qui ne traduisait
  // rien. host_permissions couvre kick.com, donc l'URL est lisible sans la
  // permission "tabs", qui ferait re-approuver la mise a jour a chacun.
  const [channel, setChannel] = useState<string | undefined>(undefined);
  const [onKick, setOnKick] = useState(false);
  // Recent lines of this tab's chat the language allowlist left untranslated,
  // as the chat's own bar counts them. 0 when none, or when the tab cannot say.
  const [langBlocked, setLangBlocked] = useState(0);
  // Manual start: this tab's channel waits for the reader. The page knows, so the popup asks it.
  const [tabId, setTabId] = useState<number>();
  const [waiting, setWaiting] = useState(false);

  const locale = useLoadedLocale(resolveUiLocale(settings.uiLang));
  // Named for the reader and sorted with their locale's collation. Keyed on the
  // extension's own UI locale, NOT the browser's: someone who set the interface
  // to Japanese must get Japanese names, whatever their system language says.
  const langs = useMemo(() => sortedLanguages(locale), [locale]);
  const t = useMemo(() => makeT(locale), [locale]);

  useEffect(() => {
    refresh();
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (!tab?.url) return;
        const url = new URL(tab.url);
        if (!/(^|\.)kick\.com$/.test(url.hostname)) return;
        setOnKick(true);
        setChannel(extractChannelSlug(url.pathname));
        if (tab.id === undefined) return;
        void chrome.tabs
          .sendMessage(tab.id, { type: LANG_BLOCKED_ASK })
          .then((res: { count?: number } | undefined) => setLangBlocked(res?.count ?? 0))
          // No content script in that tab (not reloaded since an update): say nothing.
          .catch(() => undefined);
        setTabId(tab.id);
        void chrome.tabs
          .sendMessage(tab.id, { type: START_ASK })
          .then((res: { waiting?: boolean } | undefined) => setWaiting(res?.waiting === true))
          .catch(() => undefined);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  // Five questions to the worker, asked together and each painted as it lands:
  // deepl.usage and update.status can wait on the network and used to hold up the rest.
  function refresh(): void {
    const ask = (m: RuntimeMessage) => send(m).catch(() => undefined);
    void ask({ type: 'settings.get' }).then((r) => {
      if (r?.type === 'settings') setSettings(r.payload);
      else setFailed(t('unavailable'));
    });
    void ask({ type: 'stats.get' }).then((r) => r?.type === 'stats' && setStats(r.payload));
    void ask({ type: 'providers.status' }).then((r) => r?.type === 'providers' && setProviders(r.payload));
    void ask({ type: 'deepl.usage' }).then((r) => r?.type === 'deepl.usage' && setDeepl(r.payload));
    void ask({ type: 'update.status' }).then((r) => r?.type === 'update.info' && setUpdate(r.payload));
  }

  async function patch<K extends keyof Settings>(key: K, value: Settings[K]) {
    await patchMany({ [key]: value } as Partial<Settings>);
  }

  async function patchMany(next: Partial<Settings>) {
    const res = await send({ type: 'settings.set', payload: next }).catch(() => undefined);
    if (res?.type === 'settings') {
      setFailed(undefined);
      setSettings(res.payload);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(undefined), 1500);
    } else {
      setFailed(t('Not saved.'));
    }
  }

  const waitingHere = settings.enabled && !!channel && settings.startMode === 'manual' && waiting;
  const pausedHere = settings.enabled && !!channel && settings.pausedChannels.includes(channel);
  // A channel list that keeps this channel out, said here with the way to it:
  // the Advanced tab's own advice was "reset everything" when this happened.
  const blockedHere = settings.enabled && !!channel && !pausedHere ? channelBlockedBy(settings, channel) : undefined;
  // The language half of the same question. Only on a channel and while an
  // allowlist is set, so clearing it in Options and reopening the popup clears
  // the line too. A line, not a card: the allowlist is doing what was asked of
  // it, where a blocked channel translates nothing.
  const langBlockedHere =
    settings.enabled && !!channel && !pausedHere && !blockedHere && settings.sourceLangAllowlist.length > 0 && langBlocked > 0;
  // Quelqu'un qui n'a encore rien traduit, et qui ouvre le popup ailleurs que
  // sur Kick : des reglages ne lui disent pas quoi faire. Un historique vide
  // distingue un nouvel installe d'un habitue un jour calme.
  const firstRun =
    !onKick && !!stats && stats.totalRequests === 0 && !(stats.history?.length ?? 0);

  // An offered update is a state of its own: its link takes the place of the
  // engines and day cards, and the stats question waits for the next opening.
  // Added on top, it put the popup at 612 to 642px (Tamil, measure-popup).
  const updating = !!update?.updateAvailable;
  const asking =
    !settings.usageStatsAsked && !pausedHere && !waitingHere && !firstRun && !blockedHere && !updating;
  // One green button per state: the action this state is about takes it, and
  // Options steps down to a ghost while that action is on screen. The stats
  // question has no green of its own (equal answers), so Options steps down
  // there too and the question is the one thing in focus.
  const otherPrimary = firstRun || pausedHere || waitingHere || !!blockedHere;

  function openOptions() {
    void chrome.runtime.openOptionsPage();
  }

  return (
    <I18nProvider value={t}>
      {/* Spacing in three steps, outer to inner: 12px between cards (and above
          and below the stack), 10px inside a card's top and bottom, 8px between
          the controls of a card. One 12px for both read as one flat size, and
          the 4px each card and the 8px of page edge gave back are the popup's
          margin under its 600px budget (Tamil sat at exactly 600). */}
      <div class="flex flex-col gap-3 px-4 py-3">
        <header class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded bg-kick-primary text-kick-dark font-black text-sm">
            K
          </div>
          {/* The version line moved to the footer: "ready" told nothing, and
              the row cost 16px in a popup measured to the pixel. 16px, a step
              above the 14px of the selects; its 24px line is the logo's height,
              so the header row does not grow. */}
          <h1 class="text-base font-semibold text-kick-text">Kick Chat Translator</h1>
          <div class="ms-auto">
            <Toggle
              checked={settings.enabled}
              onChange={(v) => void patch('enabled', v)}
              label={t('Enable')}
              // Starts with the visible word: voice control says "click Enable".
              srLabel={`${t('Enable')}: ${t('Translate the chat')}`}
            />
          </div>
        </header>

        {/* A tab that is not Kick says so, whatever the stats: the settings below
            look the same everywhere and nothing else says this tab is not translated. */}
        {!onKick && !firstRun && (
          <p class="text-xs text-kick-muted">{t('Open a Kick channel: its chat is translated as it arrives.')}</p>
        )}

        {waitingHere && !pausedHere && (
          <section class="kt-card flex items-center justify-between gap-2" role="status">
            <span class="text-xs text-kick-text">{t('Paused on this channel')}</span>
            <button
              class="kt-btn"
              onClick={() => {
                if (tabId === undefined) return;
                void chrome.tabs.sendMessage(tabId, { type: START_SET }).then(() => setWaiting(false)).catch(() => undefined);
              }}
            >
              {t('Resume')}
            </button>
          </section>
        )}

        {pausedHere && (
          <section class="kt-card flex items-center justify-between gap-2">
            <span class="text-xs text-kick-text">{t('Paused on this channel')}</span>
            <button
              class="kt-btn"
              onClick={() =>
                void patch(
                  'pausedChannels',
                  settings.pausedChannels.filter((c) => c !== channel),
                )
              }
            >
              {t('Resume')}
            </button>
          </section>
        )}

        {blockedHere && (
          <section class="kt-card flex items-center justify-between gap-2" role="status">
            <span class="text-xs text-kick-text">
              {blockedHere === 'channel_blacklisted'
                ? t('Not translated: this channel is on your blocked list.')
                : t('Not translated: this channel is not on your allowed list.')}
            </span>
            <button
              type="button"
              class="kt-btn shrink-0"
              onClick={() =>
                void chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html#filters') })
              }
            >
              {t('Filters')}
            </button>
          </section>
        )}

        {/* Asked once, opt-in. Firefox asks in its own install prompt, and the
            worker records that answer as usageStatsAsked, so this never shows there. */}
        {/* Compact on purpose: the popup has a 600px budget (measure-popup) and
            this takes the stats block's place. Not asked while paused, where
            there is no block to give up; it waits for the next opening. */}
        {/* Not on a first run either: "Open Kick" is the one thing to do then,
            and the two cards together overflowed 600px (649 to 681px). */}
        {asking && (
          <section
            class="kt-card flex flex-col gap-2 !py-2"
            aria-label={t('Help improve Kick Chat Translator?')}
          >
            <span class="text-xs text-kick-text">
              {t('Once a day, anonymous counts: engines used, errors, speed. Never your messages, names or channels.')}
            </span>
            {/* Same weight for both answers: a filled "Share" next to a ghost
                "No thanks" pushed the reader toward yes. Under the text, not
                beside it: beside it, Tamil wrapped the sentence over 12 lines
                (760px popup). */}
            <div class="flex flex-wrap gap-2">
              <button class="kt-btn-ghost" onClick={() => void patchMany({ usageStats: true, usageStatsAsked: true })}>
                {t('Share')}
              </button>
              <button class="kt-btn-ghost" onClick={() => void patchMany({ usageStats: false, usageStatsAsked: true })}>
                {t('No thanks')}
              </button>
            </div>
          </section>
        )}

        {firstRun && (
          <section class="kt-card flex items-center justify-between gap-2">
            <span class="text-xs text-kick-text">{t('Open a Kick channel: its chat is translated as it arrives.')}</span>
            <button class="kt-btn shrink-0" onClick={() => void chrome.tabs.create({ url: 'https://kick.com/' })}>
              {t('Open Kick')}
            </button>
          </section>
        )}

        {updating && update && (
          <a
            class={`${otherPrimary ? 'kt-btn-ghost' : 'kt-btn'} flex items-center justify-center gap-1.5 text-xs font-semibold no-underline`}
            href={update.releaseUrl}
            target="_blank"
            rel="noreferrer"
            title={t('Version {current} installed, {latest} available')
              .replace('{current}', update.current)
              .replace('{latest}', update.latest ?? '?')}
          >
            {/* lucide "arrow-up": drawn, not a glyph inside the sentence each
                language had to carry. */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
            {t('Update available')} · {update.latest}
          </a>
        )}

        <section class="kt-card flex flex-col gap-2">
          <span class="kt-label">{t('Target language')}</span>
          <select
            aria-label={t('Target language')}
            class="kt-select"
            value={vueDeChaine(settings, channel).targetLang}
            onChange={(e) => {
              const targetLang = (e.target as HTMLSelectElement).value;
              // On a channel whose language is remembered, the tab reads that
              // memory, so the pick goes there too, as on the chat bar.
              void patchMany({
                targetLang,
                ...(settings.rememberChannelLang && channel
                  ? { channelLangs: memoriserLangueChaine(settings.channelLangs, channel, targetLang) }
                  : {}),
              });
            }}
          >
            <option value="auto">{t('Auto (your language)')}</option>
            {langs.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>

          {/* 16px above, 8px below: the label belongs to the select under it,
              not to the language picker it used to sit midway from. */}
          <div class="pt-2">
            <label class="kt-label mb-2 block">{t('Display')}</label>
              <select
                aria-label={t('Display')}
                class="kt-select"
                value={settings.displayStyle}
                onChange={(e) =>
                  void patch(
                    'displayStyle',
                    (e.target as HTMLSelectElement).value as Settings['displayStyle'],
                  )
                }
              >
                <option value="below">{t('Below')}</option>
                <option value="inline">{t('Inline')}</option>
                <option value="replace">{t('Replace')}</option>
                <option value="hover">{t('On hover')}</option>
              </select>
          </div>

          <div class="flex items-center gap-2">
            <Toggle
              checked={settings.showOriginal}
              onChange={(v) => void patch('showOriginal', v)}
              label={t('Keep original')}
              // Replace puts the translation where the message was, so there is
              // no original left for this to keep. The picker it contradicts is
              // the row directly above.
              disabled={settings.displayStyle === 'replace'}
            />
            <Toggle
              checked={settings.showSourceBadge}
              onChange={(v) => void patch('showSourceBadge', v)}
              label={t('Language badge')}
            />
          </div>
        </section>

        <section class="kt-card flex flex-col gap-2">
          <div class="flex items-center justify-between">
            {/* The heading is the switch's visible name: a second "Enable" next
                to the header's own one said nothing new and wrapped the
                heading onto two lines in bg, el and ta. */}
            <span class="kt-label">{t('Translate what I type')}</span>
            <Toggle
              checked={settings.composeEnabled}
              onChange={(v) => void patch('composeEnabled', v)}
              srLabel={t('Translate what I type')}
            />
          </div>
          {settings.composeEnabled && (
            <>
              {/* No visible label of its own: it belongs to the "translate what
                I type" heading above, which a screen reader does not connect
                to it. Named explicitly so it is not announced as a bare
                combo box. */}
              <select
                aria-label={t('Write my messages in')}
                class="kt-select"
                value={settings.composeTargetLang}
                onChange={(e) =>
                  void patch('composeTargetLang', (e.target as HTMLSelectElement).value)
                }
              >
                <option value="auto">{t('Auto (channel language)')}</option>
                {langs.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
              {/* The help line that used to sit here explained a behaviour nobody
                configures, and cost two rows in a popup that has none to spare.
                The Options page carries the full explanation. */}
            </>
          )}
        </section>

        {/* Not on a first run: nothing has been translated yet, so the engines
            have no status to report, and the card pushed the popup past its
            600px budget (measure-popup, first-run state). Not while the stats
            question is asked either, a one-time state that already gives up
            the day's numbers: with both, Tamil measured 648px. Not beside the
            update link either, which hides only the day's numbers. It gives
            its place to the allowlist line: that line is the answer to "why
            are lines missing" then, and the two together measured 608 to
            620px in six languages (measure-popup, langblocked). */}
        {!firstRun && !asking && !langBlockedHere && (
        <section class="kt-card flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="kt-label">{t('Providers')}</span>
            <button
              type="button"
              class="kt-link"
              onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html#providers') })}
            >
              {t('order in options')}
            </button>
          </div>
          <div class="flex flex-wrap gap-x-3 gap-y-2">
            {providers.map((p) => (
              <ProviderPill key={p.id} status={p} />
            ))}
          </div>
          {deepl?.configured && deepl.limit > 0 && (
            <div class="pt-1">
              <div class="flex items-center justify-between text-xs text-kick-muted">
                <span>{t('DeepL quota')}</span>
                <span>
                  {fmtK(deepl.count)} / {fmtK(deepl.limit)} (
                  {Math.round((deepl.count / deepl.limit) * 100)}%)
                </span>
              </div>
              <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-kick-border">
                <div
                  class="h-full rounded-full bg-kick-primary"
                  style={{ width: `${Math.min(100, (deepl.count / deepl.limit) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </section>
        )}

        {/* A la place de la ligne de pause, pas en plus : avec les deux, le popup
          par defaut mesure 654px contre 600 de plafond et defile. Les chiffres
          du jour reviennent a la reprise. */}
        {/* The usage question takes the stats block's place the one time it is
            asked: added on top it pushed the popup past its 600px budget in
            every language (measure-popup, 685 to 752px). */}
        {/* The update link takes it too (see `updating`), until installed. */}
        {settings.popupShowsStats && stats && !pausedHere && !blockedHere && !firstRun && settings.usageStatsAsked && !updating && (
          <section class="kt-card">
            <span class="kt-label">{t('Today')}</span>
            <StatsBar stats={stats} />
          </section>
        )}

        {/* The allowlist, named as its Options card is, and the way to it. */}
        {langBlockedHere && (
          <p class="text-xs text-kick-muted" role="status">
            <LangBlockedLine
              text={t('{list}: some recent lines were not translated.')}
              link={t('Source languages allowlist')}
            />
          </p>
        )}

        <footer class="flex items-center gap-2">
          {/* Maintenance, so an icon beside Discord rather than a labelled
              button on the main row. The Advanced tab carries it too. */}
          <button
            type="button"
            class="kt-btn-ghost flex shrink-0 items-center justify-center !px-1.5"
            aria-label={t('Clear cache')}
            title={t('Clear cache')}
            onClick={() => {
              send({ type: 'cache.clear' })
                .then((res) => {
                  if (res.type !== 'ack') return;
                  setCleared(true);
                  setTimeout(() => setCleared(false), 2000);
                })
                .catch(() => undefined);
            }}
          >
            {/* Same 18px box for both icons: the footer does not move. */}
            <svg width="18" height="18" aria-hidden="true">
              <use href={cleared ? '#i-check' : '#i-trash'} />
            </svg>
          </button>
          {/* 16px from the trash: a cache wipe next to a link invites a mis-tap. */}
          <DiscordLink class="kt-btn-ghost ms-2 flex shrink-0 items-center justify-center !px-1.5 hover:text-[#5865F2]" />
          {/* min-w-0: without it a flex item never shrinks below its text, so
              a long "saved" pushed Options instead of truncating. */}
          {/* The confirmation alone while it shows: appended to the version
              line it was cut in Greek and Tamil. Two lines rather than an
              ellipsis if a language still runs long, for the 2 s it is up. */}
          <span
            class={`min-w-0 text-xs ${failed ? 'text-red-400' : 'text-kick-muted'} ${cleared ? 'line-clamp-2' : 'truncate'}`}
            role="status"
            title={cleared ? t('Cache cleared') : failed}
          >
            {failed ? (
              failed
            ) : cleared ? (
              t('Cache cleared')
            ) : (
              <>
                v{chrome.runtime.getManifest().version}
                {savedAt ? ` · ${t('saved')}` : ''}
              </>
            )}
          </span>
          <button class={`ms-auto shrink-0 ${otherPrimary || asking || updating ? 'kt-btn-ghost' : 'kt-btn'}`} onClick={openOptions}>
            {t('Options')}
          </button>
        </footer>
        {/* lucide "trash", verbatim from the kit's icons.js. */}
        <svg width="0" height="0" class="absolute" aria-hidden="true">
          <symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </symbol>
          {/* lucide "check": the trash's place for 2 s after a clear. */}
          <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </symbol>
        </svg>
      </div>
    </I18nProvider>
  );
}

/**
 * "{list}: ..." with {list} as a link to the allowlist card itself, not to the
 * top of the Filters tab. The name sits before a colon, in the nominative, so
 * no language has to inflect it.
 */
function LangBlockedLine({ text, link }: { text: string; link: string }) {
  const [before, after = ''] = text.split('{list}');
  return (
    <>
      {before}
      <button
        type="button"
        class="kt-link"
        onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html#filters-langs') })}
      >
        {link}
      </button>
      {after}
    </>
  );
}
