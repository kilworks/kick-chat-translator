import { useEffect, useId, useState } from 'preact/hooks';
import type { Settings } from '~/shared/settings';
import { useT } from '~/shared/i18nContext';
import { flagClass } from '~/shared/flags';
import { getLang, localLangName, resolveTargetLang } from '~/shared/languages';
import { resolveUiLocale } from '~/shared/i18n';
import { Check } from '../components/Check';

interface Props {
  settings: Settings;
  onPatch: (p: Partial<Settings>) => void;
}

interface TranslatorCtor {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<{ translate(t: string): Promise<string> }>;
}
function ctor(): TranslatorCtor | undefined {
  return (self as unknown as { Translator?: TranslatorCtor }).Translator;
}

const COMMON_SOURCES = ['ja', 'ko', 'zh', 'es', 'pt', 'fr', 'de', 'ru', 'ar', 'tr'];

export type ChipView = 'download' | 'busy' | 'ready' | 'unavailable';

/** What a download chip shows, from the probe answer and the click in flight. */
export function chipView(probe: string | undefined, busy: boolean): ChipView {
  if (probe === 'available') return 'ready';
  if (probe === 'unavailable') return 'unavailable';
  return busy ? 'busy' : 'download';
}

const CHIP_ICON: Record<ChipView, string> = {
  download: 'download',
  busy: 'loader',
  ready: 'check',
  unavailable: 'ban',
};

export function EngineCard({ settings, onPatch }: Props) {
  const t = useT();
  const present = ctor() !== undefined;
  const [probe, setProbe] = useState<Record<string, string>>({});
  const dlId = useId();
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const [outcome, setOutcome] = useState<{ failed: boolean; text: string } | undefined>(undefined);
  // "auto" is not a language the on-device API knows: it was probed and printed
  // as is ("-> AUTO"). Resolved the way the chat resolves it, to the browser's.
  const target = resolveTargetLang(settings.targetLang);
  const locale = resolveUiLocale(settings.uiLang);
  const langName = (code: string) => localLangName(code, getLang(code)?.native ?? code.toUpperCase(), locale);

  useEffect(() => {
    const c = ctor();
    if (!c) return;
    let cancelled = false;
    void (async () => {
      const out: Record<string, string> = {};
      for (const s of COMMON_SOURCES) {
        if (s === target) continue;
        try {
          out[s] = await c.availability({ sourceLanguage: s, targetLanguage: target });
        } catch {
          out[s] = 'unavailable';
        }
      }
      if (!cancelled) setProbe(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  async function download(src: string) {
    const c = ctor();
    if (!c) return;
    setBusy(src);
    setOutcome(undefined);
    try {
      // This click is a user gesture → model download is permitted.
      const inst = await c.create({ sourceLanguage: src, targetLanguage: target });
      await inst.translate('test');
      setProbe((p) => ({ ...p, [src]: 'available' }));
      setOutcome({ failed: false, text: t('{lang}, downloaded').replace('{lang}', langName(src)) });
    } catch {
      setProbe((p) => ({ ...p, [src]: 'downloadable' }));
      // The chip silently going back to "Download" said nothing about why.
      setOutcome({ failed: true, text: t('{lang}: download failed, try again').replace('{lang}', langName(src)) });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section class="kt-card space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="kt-section">{t('Engine')}</h2>
        <span
          class={`text-xs font-medium ${present ? 'text-kick-primary' : 'text-kick-muted'}`}
        >
          {present ? t('On-device: ready') : t('On-device: not in this browser')}
        </span>
      </div>

      {/* One concept, two fields: the switch comes first and drives the
          strategy, so "on-device only" with on-device off (which translated
          nothing, engineMode.combos.test.ts) cannot be made here. Browsers
          without the API keep both as they were. */}
      <div class="kt-setting">
        <Check
          checked={settings.localEnabled}
          onChange={(v) => onPatch({ localEnabled: v })}
          label={t('Enable on-device translation')}
          disabled={present && settings.engineMode === 'local-only'}
          hint={
            present && settings.engineMode === 'local-only'
              ? t('Stays on while the strategy is on-device only.')
              : undefined
          }
          reverse
        />
      </div>

      <div class="kt-row">
        <label class="kt-label" for="kt-engine-mode">{t('Strategy')}</label>
        <select
          id="kt-engine-mode"
          aria-label={t('Strategy')}
          class="kt-select"
          value={settings.engineMode}
          disabled={present && !settings.localEnabled}
          onChange={(e) =>
            onPatch({ engineMode: (e.target as HTMLSelectElement).value as Settings['engineMode'] })
          }
        >
          <option value="local-first">{t('On-device first, cloud if needed')}</option>
          <option value="cloud-first">{t('Cloud first, on-device if needed (recommended)')}</option>
          <option value="local-only">{t('On-device only (nothing sent online)')}</option>
        </select>
        <p class="text-xs text-kick-muted">
          {!present
            ? t('This browser cannot translate on your computer, so the cloud engines translate everything.')
            : !settings.localEnabled
              ? t('On-device is off, so the cloud engines translate everything.')
              : t(
                  'On-device translates on your computer: free, fast, private, no daily limit. Each language is a one-time download: pick it below, or "Local" in the chat.',
                )}
        </p>
      </div>

      {present && (
        <div>
          <span id={dlId} class="kt-label mb-2 block">
            {`${t('Download languages →')} ${langName(target)}`}
          </span>
          {/* lucide download, check, loader-circle and ban, from the kit's set. */}
          <svg width="0" height="0" class="absolute" aria-hidden="true">
            <symbol id="i-eng-download" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 15V3" />
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m7 10 5 5 5-5" />
            </symbol>
            <symbol id="i-eng-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </symbol>
            <symbol id="i-eng-loader" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </symbol>
            <symbol id="i-eng-ban" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M4.929 4.929 19.07 19.071" />
            </symbol>
          </svg>
          <div role="group" aria-labelledby={dlId} class="flex flex-wrap gap-2">
            {COMMON_SOURCES.filter((s) => s !== target).map((s) => {
              const v = chipView(probe[s], busy === s);
              const name = langName(s);
              // Literal keys, so the i18n coverage test sees every one of them.
              const label = (
                v === 'ready'
                  ? t('{lang}, downloaded')
                  : v === 'unavailable'
                    ? t('{lang}, not available')
                    : v === 'busy'
                      ? t('Downloading {lang}')
                      : t('Download {lang}')
              ).replace('{lang}', name);
              return (
                // The name and the icon carry the state, not opacity: a muted
                // chip next to an enabled one read the same to many eyes.
                // aria-disabled rather than disabled, so a keyboard still lands
                // on a chip and hears why it does nothing.
                <button
                  key={s}
                  type="button"
                  data-state={v}
                  aria-label={label}
                  title={label}
                  aria-disabled={v !== 'download' || undefined}
                  aria-busy={v === 'busy' || undefined}
                  // Solid edges in every state, and green only on the ready
                  // tick: a green fill read as "selected" in a multi-select,
                  // a dashed edge as "empty" (the composer chip lost it too).
                  class={`inline-flex min-h-8 items-center gap-2 rounded-md border px-2 py-1 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kick-primary ${
                    v === 'ready'
                      ? 'border-kick-stroke text-kick-text cursor-default'
                      : v === 'unavailable'
                        ? 'border-kick-stroke text-kick-muted cursor-not-allowed'
                        : v === 'busy'
                          ? 'border-kick-stroke text-kick-text cursor-progress'
                          : 'border-kick-stroke text-kick-text hover:border-kick-primary'
                  }`}
                  onClick={() => v === 'download' && void download(s)}
                >
                  {flagClass(s) && <span class={flagClass(s)} aria-hidden="true" />}
                  <span>{name}</span>
                  <svg class={`h-4 w-4 shrink-0 ${v === 'busy' ? 'animate-spin' : ''} ${v === 'ready' ? 'text-kick-primary' : ''}`} aria-hidden="true">
                    <use href={`#i-eng-${CHIP_ICON[v]}`} />
                  </svg>
                </button>
              );
            })}
          </div>
          {/* The outcome of the last download, announced: a renamed button is
              not spoken by many screen readers, and a failure showed nothing.
              Visible only when it failed; success is the chip's own tick. */}
          <p role="status" class={outcome?.failed ? 'kt-hint mt-2' : 'sr-only'}>
            {outcome?.text ?? ''}
          </p>
        </div>
      )}
    </section>
  );
}
