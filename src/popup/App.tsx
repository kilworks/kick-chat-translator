import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Settings } from '~/shared/settings';
import { defaultSettings } from '~/shared/settings';
import { sortedLanguages } from '~/shared/languages';
import { send } from '~/shared/messages';
import { extractChannelSlug } from '~/content/kickApi';
import { channelBlockedBy } from '~/content/filters';
import { I18nProvider } from '~/shared/i18nContext';
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
  // La chaine de l'onglet actif. Le bandeau met en pause par chaine ; sans ca,
  // l'interrupteur ci-dessous disait "active" sur un onglet qui ne traduisait
  // rien. host_permissions couvre kick.com, donc l'URL est lisible sans la
  // permission "tabs", qui ferait re-approuver la mise a jour a chacun.
  const [channel, setChannel] = useState<string | undefined>(undefined);
  const [onKick, setOnKick] = useState(false);

  const locale = resolveUiLocale(settings.uiLang);
  // Named for the reader and sorted with their locale's collation. Keyed on the
  // extension's own UI locale, NOT the browser's: someone who set the interface
  // to Japanese must get Japanese names, whatever their system language says.
  const langs = useMemo(() => sortedLanguages(locale), [locale]);
  const t = useMemo(() => makeT(locale), [locale]);

  useEffect(() => {
    void refresh().catch(() => undefined);
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (!tab?.url) return;
        const url = new URL(tab.url);
        if (!/(^|\.)kick\.com$/.test(url.hostname)) return;
        setOnKick(true);
        setChannel(extractChannelSlug(url.pathname));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  async function refresh() {
    const settingsRes = await send({ type: 'settings.get' });
    if (settingsRes.type === 'settings') setSettings(settingsRes.payload);
    const statsRes = await send({ type: 'stats.get' });
    if (statsRes.type === 'stats') setStats(statsRes.payload);
    const provRes = await send({ type: 'providers.status' });
    if (provRes.type === 'providers') setProviders(provRes.payload);
    const deeplRes = await send({ type: 'deepl.usage' });
    if (deeplRes.type === 'deepl.usage') setDeepl(deeplRes.payload);
    const upRes = await send({ type: 'update.status' });
    if (upRes.type === 'update.info') setUpdate(upRes.payload);
  }

  async function patch<K extends keyof Settings>(key: K, value: Settings[K]) {
    await patchMany({ [key]: value } as Partial<Settings>);
  }

  async function patchMany(next: Partial<Settings>) {
    const res = await send({ type: 'settings.set', payload: next });
    if (res.type === 'settings') {
      setSettings(res.payload);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(undefined), 1500);
    }
  }

  const pausedHere = settings.enabled && !!channel && settings.pausedChannels.includes(channel);
  // A channel list that keeps this channel out, said here with the way to it:
  // the Advanced tab's own advice was "reset everything" when this happened.
  const blockedHere = settings.enabled && !!channel && !pausedHere ? channelBlockedBy(settings, channel) : undefined;
  // Quelqu'un qui n'a encore rien traduit, et qui ouvre le popup ailleurs que
  // sur Kick : des reglages ne lui disent pas quoi faire. Un historique vide
  // distingue un nouvel installe d'un habitue un jour calme.
  const firstRun =
    !onKick && !!stats && stats.totalRequests === 0 && !(stats.history?.length ?? 0);

  const asking = !settings.usageStatsAsked && !pausedHere && !firstRun && !blockedHere;
  // One green button per state: the action this state is about takes it, and
  // Options steps down to a ghost while that action is on screen. The stats
  // question has no green of its own (equal answers), so Options steps down
  // there too and the question is the one thing in focus.
  const otherPrimary = firstRun || pausedHere || !!blockedHere;

  function openOptions() {
    void chrome.runtime.openOptionsPage();
  }

  return (
    <I18nProvider value={t}>
      <div class="flex flex-col gap-3 p-4">
        <header class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded bg-kick-primary text-kick-dark font-black text-sm">
            K
          </div>
          {/* The version line moved to the footer: "ready" told nothing, and
              the row cost 16px in a popup measured to the pixel. */}
          <h1 class="text-sm font-semibold text-kick-text">Kick Chat Translator</h1>
          <div class="ms-auto">
            <Toggle
              checked={settings.enabled}
              onChange={(v) => void patch('enabled', v)}
              label={t('Enable')}
              srLabel={t('Translate the chat')}
            />
          </div>
        </header>

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

        {update?.updateAvailable && (
          <a
            class={`${otherPrimary ? 'kt-btn-ghost' : 'kt-btn'} flex items-center justify-center gap-1.5 text-xs font-semibold no-underline`}
            href={update.releaseUrl}
            target="_blank"
            rel="noreferrer"
            title={`Installed v${update.current} · ${update.latest ?? '?'} available`}
          >
            {t('⬆ Update available')} · {update.latest}
          </a>
        )}

        <section class="kt-card flex flex-col gap-2">
          <span class="kt-label">{t('Target language')}</span>
          <select
            aria-label={t('Target language')}
            class="kt-select"
            value={settings.targetLang}
            onChange={(e) => void patch('targetLang', (e.target as HTMLSelectElement).value)}
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
                <option value="below">{t('Below original')}</option>
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
              {/* No visible label of its own — it belongs to the "translate what
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
            the day's numbers: with both, Tamil measured 648px. */}
        {!firstRun && !asking && (
        <section class="kt-card flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="kt-label">{t('Providers')}</span>
            <button type="button" class="kt-link" onClick={openOptions}>
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
        {settings.popupShowsStats && stats && !pausedHere && !blockedHere && !firstRun && settings.usageStatsAsked && (
          <section class="kt-card">
            <span class="kt-label">{t('Today')}</span>
            <StatsBar stats={stats} />
          </section>
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
              send({ type: 'cache.clear' }).catch(() => undefined);
            }}
          >
            <svg width="18" height="18" aria-hidden="true">
              <use href="#i-trash" />
            </svg>
          </button>
          {/* 16px from the trash: a cache wipe next to a link invites a mis-tap. */}
          <DiscordLink class="kt-btn-ghost ms-2 flex shrink-0 items-center justify-center !px-1.5 hover:text-[#5865F2]" />
          <span class="truncate text-xs text-kick-muted" role="status">
            v{chrome.runtime.getManifest().version}
            {savedAt ? ` · ${t('saved')}` : ''}
          </span>
          <button class={`ms-auto ${otherPrimary || asking || update?.updateAvailable ? 'kt-btn-ghost' : 'kt-btn'}`} onClick={openOptions}>
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
        </svg>
      </div>
    </I18nProvider>
  );
}
