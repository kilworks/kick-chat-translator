import { useEffect, useId, useRef, useState } from 'preact/hooks';
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

/** What a row says about its provider, in words, so colour is never the only cue. */
function statusText(t: (k: string) => string, s: ProviderStatus, hasKey: boolean): string {
  if (s.available) return t('Ready');
  const left = s.cooldownLeftSec ?? 0;
  if (left > 0) return t('Paused, back in {n} min').replace('{n}', String(Math.ceil(left / 60)));
  if (s.id === 'deepl' && !hasKey) return t('Needs a key');
  return t('Paused');
}

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
  const [showKey, setShowKey] = useState(false);
  const hasKey = settings.deeplApiKey !== '';
  const last = settings.providerOrder.length - 1;
  const keyId = useId();
  const planId = useId();
  const list = useRef<HTMLUListElement>(null);
  const refocus = useRef<string | undefined>(undefined);
  // Show the DeepL card once, then keep it: clearing the key must not unmount
  // the field being edited.
  const deeplWanted = settings.providerOrder.includes('deepl') || hasKey;
  const [deeplShown, setDeeplShown] = useState(deeplWanted);
  if (deeplWanted && !deeplShown) setDeeplShown(true);
  // The row moves in the DOM and the browser may drop focus: put it back on the
  // button that was pressed, which is aria-disabled (still focusable) at an end.
  useEffect(() => {
    if (refocus.current) list.current?.querySelector<HTMLElement>(`[data-move="${refocus.current}"]`)?.focus();
    refocus.current = undefined;
  }, [settings.providerOrder]);

  function move(id: CloudProviderId, dir: -1 | 1) {
    const order = [...settings.providerOrder];
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= order.length) return;
    const tmp = order[idx];
    const other = order[swap];
    if (tmp === undefined || other === undefined) return;
    refocus.current = `${id}:${dir}`;
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
        {/* lucide chevron-up, chevron-down and x, verbatim from the kit's icons.js. */}
        <svg width="0" height="0" class="absolute" aria-hidden="true">
          <symbol id="i-chevron-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m18 15-6-6-6 6" />
          </symbol>
          <symbol id="i-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6" />
          </symbol>
          <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </symbol>
        </svg>
        {/* Unused under "on-device only": greyed out rather than hidden, so the
            order is still there when the strategy changes back. */}
        <fieldset disabled={settings.engineMode === 'local-only'} class="m-0 min-w-0 border-0 p-0 disabled:opacity-60">
        <ul ref={list} class="flex flex-col gap-1.5">
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
                    class={`shrink-0 text-xs font-medium ${status.available ? 'text-kick-primary' : 'text-red-300'}`}
                    title={status.lastError}
                  >
                    {statusText(t, status, hasKey)}
                  </span>
                )}
                {status && !status.available && status.lastError && (
                  <span class="min-w-0 max-w-[9rem] shrink truncate text-xs text-kick-muted">
                    {status.lastError}
                  </span>
                )}
                <button
                  class="kt-btn-ghost kt-btn-icon text-xs aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
                  aria-label={`${t('Move up')}: ${t(PROVIDER_LABELS[id])}`}
                  data-move={`${id}:-1`}
                  aria-disabled={i === 0}
                  onClick={() => move(id, -1)}
                >
                  <svg width="16" height="16" aria-hidden="true"><use href="#i-chevron-up" /></svg>
                </button>
                <button
                  class="kt-btn-ghost kt-btn-icon text-xs aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
                  aria-label={`${t('Move down')}: ${t(PROVIDER_LABELS[id])}`}
                  data-move={`${id}:1`}
                  aria-disabled={i === last}
                  onClick={() => move(id, +1)}
                >
                  <svg width="16" height="16" aria-hidden="true"><use href="#i-chevron-down" /></svg>
                </button>
                <button
                  class="kt-btn-ghost kt-btn-icon text-xs"
                  aria-label={`${t('Remove')}: ${t(PROVIDER_LABELS[id])}`}
                  onClick={() => toggle(id)}
                >
                  <svg width="16" height="16" aria-hidden="true"><use href="#i-x" /></svg>
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

      {/* Only once DeepL is in the chain, or a key was already saved. */}
      {deeplShown && (
      <section class="kt-card space-y-3">
        <h2 class="kt-section">DeepL</h2>
        {/* LE QUOTA, ICI. Il etait demande par le popup et par lui seul, donc
            invisible sur la page ou se reglent la cle, le plan et le budget.
            Regler un pourcentage de quota sans voir le quota est le meme
            aveuglement que plafonner un cache sans voir ce qu'il contient. */}
        <DeeplQuota configured={hasKey} />
        <div class="kt-row">
          <label class="kt-label" for={keyId}>{t('API key')}</label>
          <div class="flex items-center gap-2">
            <input
              id={keyId}
              aria-label={t('API key')}
              class="kt-input font-mono"
              type={showKey ? 'text' : 'password'}
              value={settings.deeplApiKey}
            placeholder="••••••••-••••-••••-••••-••••••••••••:fx"
              onInput={(e) => onPatch({ deeplApiKey: (e.target as HTMLInputElement).value.trim() })}
            />
            {/* Text, not an eye glyph: the kit's icons.js has no eye or eye-off.
                The label says what a press does, so no aria-pressed on top: a
                pressed "Hide key" would read backwards. */}
            <button
              type="button"
              class="kt-btn-ghost shrink-0 text-xs"
              aria-controls={keyId}
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? t('Hide key') : t('Show key')}
            </button>
          </div>
          <p class="text-xs text-kick-muted">
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
          <label class="kt-label" for={planId}>{t('Plan')}</label>
          <select
            id={planId}
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
        {/* Control on the end, like every other switch on the page. */}
        <div class="kt-setting">
          <Check
            checked={settings.deeplSmartRouting}
            onChange={(v) => onPatch({ deeplSmartRouting: v })}
            label={t('Save DeepL for European languages')}
            // The switch's own hint, as on the on-device switch: a sibling
            // paragraph sat as close to the Plan select above as to this.
            hint={t(
              'DeepL is used only for European languages, where it is best. Other languages (Japanese, Arabic, Hindi...) use the free engines first, so your DeepL allowance lasts longer.',
            )}
            reverse
          />
        </div>
      </section>
      )}

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
          <p class="text-xs text-kick-muted">
            {t('Leave blank to use the default public instance.')}
          </p>
          {/* Always in the DOM, so a screen reader hears the sentence when it appears. */}
          <p class="text-xs text-red-400" role="status">
            {settings.lingvaInstance && !settings.lingvaInstance.startsWith('https://')
              ? t('Not used: only an https:// address is accepted, so chat text never travels unencrypted.')
              : ''}
          </p>
        </div>
      </section>
    </>
  );
}
