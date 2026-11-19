import { useEffect, useState } from 'preact/hooks';
import type { CloudProviderId, Settings } from '~/shared/settings';
import { send } from '~/shared/messages';
import type { ProviderStatus } from '~/shared/types';
import { useT } from '~/shared/i18nContext';
import { Check } from '../components/Check';
import { EngineCard } from './EngineCard';

const PROVIDER_LABELS: Record<CloudProviderId, string> = {
  google: 'Google Translate (free, no key)',
  deepl: 'DeepL (best quality, needs key)',
  mymemory: 'MyMemory (free, ~1000/day)',
  lingva: 'Lingva (Google Translate front end, configurable)',
};

interface Props {
  settings: Settings;
  providers: ProviderStatus[];
  onPatch: (p: Partial<Settings>) => void;
}

/**
 * Ce qu'il reste du quota DeepL ce mois-ci.
 *
 * Demande une fois a l'ouverture : c'est un appel reseau vers l'API de DeepL,
 * pas une valeur locale, et le rafraichir en continu depenserait du quota pour
 * mesurer du quota.
 */
function DeeplQuota({ configured }: { configured: boolean }) {
  const t = useT();
  const [usage, setUsage] = useState<{ count: number; limit: number } | undefined>(undefined);

  useEffect(() => {
    if (!configured) return;
    void (async () => {
      const res = await send({ type: 'deepl.usage' });
      if (res.type === 'deepl.usage' && res.payload.configured) setUsage(res.payload);
    })().catch(() => undefined);
  }, [configured]);

  if (!configured) {
    return <p class="kt-hint">{t('No key yet, so DeepL is skipped and the chain moves on.')}</p>;
  }
  if (usage === undefined) return null;

  const pct = usage.limit > 0 ? Math.round((usage.count / usage.limit) * 100) : 0;
  return (
    <div role="status">
      <div class="mb-1 flex items-baseline justify-between text-[12px]">
        <span class="text-kick-muted">{t('used this month')}</span>
        <span class="tabular-nums text-kick-text">
          {usage.count.toLocaleString()} / {usage.limit.toLocaleString()} ({pct}%)
        </span>
      </div>
      {/* La barre double le chiffre, elle ne le remplace pas : une jauge seule
          ne se lit ni au clavier ni au lecteur d'ecran. */}
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-kick-border/60">
        <div class="h-full rounded-full bg-kick-primary" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

export function ProviderSection({ settings, providers, onPatch }: Props) {
  const t = useT();

  function move(id: CloudProviderId, dir: -1 | 1) {
    const order = [...settings.providerOrder];
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= order.length) return;
    const tmp = order[idx];
    const other = order[swap];
    if (tmp === undefined || other === undefined) return;
    order[idx] = other;
    order[swap] = tmp;
    onPatch({ providerOrder: order });
  }

  function toggle(id: CloudProviderId) {
    const order = [...settings.providerOrder];
    const idx = order.indexOf(id);
    if (idx >= 0) order.splice(idx, 1);
    else order.push(id);
    onPatch({ providerOrder: order });
  }

  const all: CloudProviderId[] = ['google', 'deepl', 'mymemory', 'lingva'];

  // What the list is for follows the strategy above. It used to say "used when
  // on-device is off" while the default, cloud first, sends every line to it
  // first. Same rule as the pipeline (engineMode.combos.test.ts).
  const local = settings.localEnabled && 'Translator' in self;
  const cloudRole =
    settings.engineMode === 'local-only'
      ? t('Not used: the strategy above is on-device only.')
      : !local
        ? t('Tried in this order. One that fails is skipped for a while.')
        : settings.engineMode === 'cloud-first'
          ? t('Tried first, in this order. One that fails is skipped for a while. On-device steps in when they all fail.')
          : t('Used when on-device cannot translate a line, in this order. One that fails is skipped for a while.');

  return (
    <>
      <EngineCard settings={settings} onPatch={onPatch} />

      <section class="kt-card">
        <h2 class="kt-section mb-3">{t('Cloud engines')}</h2>
        <p class="text-xs text-kick-muted mb-3">{cloudRole}</p>
        {/* Unused under "on-device only": greyed out rather than hidden, so the
            order is still there when the strategy changes back. */}
        <fieldset disabled={settings.engineMode === 'local-only'} class="m-0 min-w-0 border-0 p-0 disabled:opacity-60">
        <ul class="flex flex-col gap-1.5">
          {settings.providerOrder.map((id, i) => {
            const status = providers.find((p) => p.id === id);
            return (
              <li key={id} class="flex items-center gap-2 kt-setting">
                <span class="font-mono text-xs text-kick-muted w-5">{i + 1}.</span>
                <span class="min-w-0 flex-1 truncate text-sm" title={t(PROVIDER_LABELS[id])}>
                  {t(PROVIDER_LABELS[id])}
                </span>
                {status && (
                  <span
                    class={`shrink-0 text-[10px] font-medium uppercase ${status.available ? 'text-kick-primary' : 'text-red-300'}`}
                  >
                    {status.available ? t('ok') : t('down')}
                  </span>
                )}
                <button
                  class="kt-btn-ghost kt-btn-icon text-xs"
                  aria-label={`${t('Move up')}: ${t(PROVIDER_LABELS[id])}`}
                  onClick={() => move(id, -1)}
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  class="kt-btn-ghost kt-btn-icon text-xs"
                  aria-label={`${t('Move down')}: ${t(PROVIDER_LABELS[id])}`}
                  onClick={() => move(id, +1)}
                >
                  <span aria-hidden="true">↓</span>
                </button>
                <button
                  class="kt-btn-ghost kt-btn-icon text-xs"
                  aria-label={`${t('Remove')}: ${t(PROVIDER_LABELS[id])}`}
                  onClick={() => toggle(id)}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div class="mt-3 flex flex-wrap gap-2">
          {all
            .filter((id) => !settings.providerOrder.includes(id))
            .map((id) => (
              <button key={id} class="kt-btn-ghost text-xs" onClick={() => toggle(id)}>
                + {t(PROVIDER_LABELS[id])}
              </button>
            ))}
        </div>
        </fieldset>
      </section>

      <section class="kt-card space-y-3">
        <h2 class="kt-section">DeepL</h2>
        {/* LE QUOTA, ICI. Il etait demande par le popup et par lui seul, donc
            invisible sur la page ou se reglent la cle, le plan et le budget.
            Regler un pourcentage de quota sans voir le quota est le meme
            aveuglement que plafonner un cache sans voir ce qu'il contient. */}
        <DeeplQuota configured={settings.deeplApiKey !== ''} />
        <div class="kt-row">
          <label class="kt-label">{t('API key')}</label>
          <input
            aria-label={t('API key')}
            class="kt-input font-mono"
            type="password"
            value={settings.deeplApiKey}
            placeholder="••••••••-••••-••••-••••-••••••••••••:fx"
            onInput={(e) => onPatch({ deeplApiKey: (e.target as HTMLInputElement).value.trim() })}
          />
          <p class="text-[11px] text-kick-muted">
            {t('Free keys end with :fx.')} {t('Get a key:')}{' '}
            <a
              class="text-kick-primary underline"
              href="https://www.deepl.com/pro#developer"
              target="_blank"
              rel="noreferrer"
            >
              deepl.com/pro#developer
            </a>
            .
          </p>
        </div>
        <div class="kt-row">
          <label class="kt-label">{t('Plan')}</label>
          <select
            aria-label={t('Plan')}
            class="kt-select"
            value={settings.deeplPlan}
            onChange={(e) =>
              onPatch({ deeplPlan: (e.target as HTMLSelectElement).value as 'free' | 'pro' })
            }
          >
            <option value="free">{t('Free (api-free.deepl.com)')}</option>
            <option value="pro">{t('Pro (api.deepl.com)')}</option>
          </select>
        </div>
        <Check
          checked={settings.deeplSmartRouting}
          onChange={(v) => onPatch({ deeplSmartRouting: v })}
          label={t('Smart budget routing')}
        />
        <p class="text-[11px] text-kick-muted -mt-2">
          {t(
            'Spend DeepL only on the European languages it clearly wins at; other targets (Japanese, Arabic, Hindi…) use the free engines first, so your DeepL quota lasts much longer.',
          )}
        </p>
      </section>

      <section class="kt-card space-y-3">
        <h2 class="kt-section">{t('Lingva instance')}</h2>
        <div class="kt-row">
          <label class="kt-label" for="kt-lingva-url">
            {t('Custom URL (optional)')}
          </label>
          <input
            id="kt-lingva-url"
            class="kt-input font-mono"
            type="url"
            value={settings.lingvaInstance}
            placeholder="https://lingva.lunar.icu"
            onInput={(e) =>
              onPatch({ lingvaInstance: (e.target as HTMLInputElement).value.trim() })
            }
          />
          <p class="text-[11px] text-kick-muted">
            {t('Leave blank to use the default public instance.')}
          </p>
        </div>
      </section>
    </>
  );
}
