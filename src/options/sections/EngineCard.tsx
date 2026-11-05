import { useEffect, useState } from 'preact/hooks';
import type { Settings } from '~/shared/settings';
import { useT } from '~/shared/i18nContext';
import { flagClass } from '~/shared/flags';
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

export function EngineCard({ settings, onPatch }: Props) {
  const t = useT();
  const present = ctor() !== undefined;
  const [probe, setProbe] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | undefined>(undefined);

  useEffect(() => {
    const c = ctor();
    if (!c) return;
    let cancelled = false;
    void (async () => {
      const out: Record<string, string> = {};
      for (const s of COMMON_SOURCES) {
        if (s === settings.targetLang) continue;
        try {
          out[s] = await c.availability({ sourceLanguage: s, targetLanguage: settings.targetLang });
        } catch {
          out[s] = 'unavailable';
        }
      }
      if (!cancelled) setProbe(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.targetLang]);

  async function download(src: string) {
    const c = ctor();
    if (!c) return;
    setBusy(src);
    try {
      // This click is a user gesture → model download is permitted.
      const inst = await c.create({ sourceLanguage: src, targetLanguage: settings.targetLang });
      await inst.translate('test');
      setProbe((p) => ({ ...p, [src]: 'available' }));
    } catch {
      setProbe((p) => ({ ...p, [src]: 'downloadable' }));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section class="kt-card space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="kt-section">{t('Engine')}</h2>
        <span
          class={`text-[11px] font-medium ${present ? 'text-kick-primary' : 'text-kick-muted'}`}
        >
          {`${t('on-device:')} ${present ? t('available ✓') : t('not supported in this browser')}`}
        </span>
      </div>

      <div class="kt-row">
        <label class="kt-label">{t('Strategy')}</label>
        <select
          aria-label={t('Strategy')}
          class="kt-select"
          value={settings.engineMode}
          onChange={(e) =>
            onPatch({ engineMode: (e.target as HTMLSelectElement).value as Settings['engineMode'] })
          }
        >
          <option value="local-first">{t('On-device first, cloud fallback')}</option>
          <option value="cloud-first">{t('Cloud first, on-device fallback (recommended)')}</option>
          <option value="local-only">{t('On-device only (no network, no cloud)')}</option>
        </select>
        <p class="text-[11px] text-kick-muted">
          {t(
            'On-device = local Chromium models: unlimited, instant, private, no rate-limit. Each language needs a one-time model download (click a flag below, or the "Local" chip in chat).',
          )}
        </p>
      </div>

      <div class="kt-setting">
        <Check
          checked={settings.localEnabled}
          onChange={(v) => onPatch({ localEnabled: v })}
          label={t('Enable on-device translation')}
          reverse
        />
      </div>

      {present && (
        <div>
          <label class="kt-label mb-1 block">
            {`${t('Download models →')} ${settings.targetLang.toUpperCase()}`}
          </label>
          <div class="flex flex-wrap gap-1.5">
            {COMMON_SOURCES.filter((s) => s !== settings.targetLang).map((s) => {
              const st = probe[s] ?? 'unknown';
              const ready = st === 'available';
              return (
                <button
                  key={s}
                  disabled={ready || busy === s}
                  title={st === 'unavailable' ? t('unavailable') : undefined}
                  class={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                    ready
                      ? 'border-kick-primary/50 bg-kick-primary/10 text-kick-primary cursor-default'
                      : st === 'unavailable'
                        ? // 50% opacity measured 2.76:1, which WCAG lets pass for a disabled
                          // control — except the label IS the information here: it names
                          // which language pair has no model. 75% keeps AA on both
                          // grounds (4.62 on a card, 4.85 on the page) and still reads
                          // as unavailable next to the enabled ones.
                          'border-kick-stroke text-kick-muted/75 cursor-not-allowed'
                        : 'border-kick-stroke text-kick-text hover:border-kick-primary'
                  }`}
                  onClick={() => void download(s)}
                >
                  {/* The hint above says "click a flag below": there was no flag
                      below, only the code. And a bare ✕ on a chip reads as
                      "remove"; the muted chip and its title say unavailable. */}
                  {flagClass(s) && <span class={flagClass(s)} aria-hidden="true" />}
                  {s.toUpperCase()}
                  {ready ? ' ✓' : busy === s ? ' …' : st === 'unavailable' ? '' : ' ⬇'}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
