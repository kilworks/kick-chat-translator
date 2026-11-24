import { useEffect, useRef, useState } from 'preact/hooks';
import { NumberInput } from '../components/NumberInput';
import { exportSettings, importSettings, type Settings } from '~/shared/settings';
import { send } from '~/shared/messages';
import { useT } from '~/shared/i18nContext';
import { Check } from '../components/Check';

import type { CacheStats, UsageStats } from '~/shared/types';

interface Props {
  settings: Settings;
  onPatch: (p: Partial<Settings>) => void;
  /** Ce que l'extension a fait. Absent tant que le worker n'a pas repondu. */
  stats?: UsageStats;
}

export function AdvancedSection({ settings, onPatch, stats }: Props) {
  const t = useT();
  // Ce que contient le cache. Demande une fois a l'ouverture : c'est un compte
  // de cles, pas un flux, et le relire en continu couterait un appel IndexedDB
  // par seconde pour un nombre qui bouge lentement.
  const [cacheStats, setCacheStats] = useState<CacheStats | undefined>(undefined);
  useEffect(() => {
    void (async () => {
      const res = await send({ type: 'cache.stats' });
      if (res.type === 'cache.stats') setCacheStats(res.payload);
    })().catch(() => undefined);
  }, []);

  /** "Entrees : 3 412 · plafond atteint a 23 %". Rien tant que la reponse n'est pas la.
   * Libelle puis nombre : un nombre suivi d'un nom ne s'accorde pas en polonais,
   * tcheque ou arabe sans regles de pluriel, ce qu'une table cle a cle n'a pas. */
  const remplissage =
    cacheStats === undefined
      ? undefined
      : `${t('Entries:')} ${cacheStats.entries.toLocaleString()} · ${t('Cap used:')} ${Math.round(
          (cacheStats.entries / Math.max(1, settings.cacheMaxEntries)) * 100,
        )}%`;

  /** L'age de la plus vieille entree gardee en memoire, en heures. */
  const plusVieille =
    cacheStats?.oldestMs === undefined
      ? undefined
      : `${t('oldest kept in memory:')} ${Math.max(1, Math.round(cacheStats.oldestMs / 3_600_000))} h`;

  const reseau = stats ? stats.totalRequests - stats.totalCacheHits : undefined;
  const bloques = stats?.throttled ?? 0;
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [importFailed, setImportFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function runExport(): Promise<void> {
    const url = URL.createObjectURL(
      new Blob([await exportSettings()], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kick-chat-translator-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport(file: File): Promise<void> {
    try {
      await importSettings(await file.text());
      location.reload();
    } catch {
      setImportFailed(true);
    }
  }

  return (
    <>
      <section class="kt-card space-y-3">
        <h2 class="kt-section">{t('Connection')}</h2>
        <p class="text-xs text-kick-muted">
          {t('Whether a Kick tab keeps translating once you look away.')}
        </p>
        {/* A div, not a label: Check renders its own <label>, and nesting one
            inside another is invalid and leaves the outer one naming nothing. */}
        <div class="kt-setting">
          <Check
            checked={settings.pauseWhenHidden}
            onChange={(v) => onPatch({ pauseWhenHidden: v })}
            label={t('Pause when tab is hidden')}
            hint={t("Background Kick tabs won't translate (saves DeepL quota while you're away).")}
            reverse
          />
        </div>
      </section>

      <section class="kt-card space-y-4">
        <h2 class="kt-section">{t('Cache & performance')}</h2>
        <p class="text-xs text-kick-muted">
          {t(
            'Reusing past translations, and how hard the engines are pushed on a busy chat. The defaults suit most channels.',
          )}
        </p>
        <Row
          label={t('Cache max entries')}
          hint={t('Larger = more hits across sessions, more disk space.')}
          live={remplissage}
          input={
            <NumberInput label={t('Cache max entries')} min={100} max={20000} step={100} value={settings.cacheMaxEntries} onCommit={(v) => onPatch({ cacheMaxEntries: v })} />
          }
        />
        <Row
          label={t('Keep translations for (hours)')}
          hint={t('Older translations are dropped and fetched again when needed.')}
          live={plusVieille}
          input={
            <NumberInput label={t('Keep translations for (hours)')} min={1} max={720} value={settings.cacheTtlHours} onCommit={(v) => onPatch({ cacheTtlHours: v })} />
          }
        />
        <Row
          label={t('Concurrent translations')}
          hint={t('How many messages are translated at the same time.')}
          live={
            reseau === undefined
              ? undefined
              : `${t('Requests sent through this limit:')} ${reseau.toLocaleString()}`
          }
          input={
            <NumberInput label={t('Concurrent translations')} min={1} max={16} value={settings.concurrency} onCommit={(v) => onPatch({ concurrency: v })} />
          }
        />
        <Row
          label={t('Per-channel budget (req/min)')}
          hint={t(
            'Upper limit for one channel, so a fast chat does not overload the translation service.',
          )}
          live={
            stats === undefined
              ? undefined
              : bloques === 0
                ? t('never reached so far')
                : `${t('Messages held back by this cap:')} ${bloques.toLocaleString()}`
          }
          input={
            <NumberInput label={t('Per-channel budget (req/min)')} min={10} max={2000} value={settings.perChannelBudgetPerMin} onCommit={(v) => onPatch({ perChannelBudgetPerMin: v })} />
          }
        />
      </section>

      <section class="kt-card space-y-3">
        <h2 class="kt-section">{t('Backup')}</h2>
        <p class="text-xs text-kick-muted">
          {t('Save your configuration to a JSON file, or restore it on another browser.')}
        </p>
        <div class="flex gap-2">
          <button class="kt-btn-ghost" onClick={() => void runExport()}>
            {t('Export settings')}
          </button>
          <button class="kt-btn-ghost" onClick={() => fileRef.current?.click()}>
            {t('Import settings')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            class="hidden"
            onChange={(e) => {
              const input = e.target as HTMLInputElement;
              const file = input.files?.[0];
              input.value = '';
              setImportFailed(false);
              if (file) void runImport(file);
            }}
          />
        </div>
        {importFailed && <p class="text-xs text-red-400">{t('Invalid settings file')}</p>}
      </section>

      <section class="kt-card space-y-3">
        <h2 class="kt-section">{t('Maintenance')}</h2>
        <div class="kt-setting">
          <Check
            checked={settings.debug}
            onChange={(v) => onPatch({ debug: v })}
            label={t('Verbose console logs')}
            reverse
          />
        </div>
        <div class="flex flex-wrap gap-2 pt-1">
          <button
            class="kt-btn-ghost"
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true);
                setTimeout(() => setConfirmClear(false), 2500);
                return;
              }
              void send({ type: 'cache.clear' });
              setConfirmClear(false);
            }}
          >
            {confirmClear ? t('click again to confirm') : t('Clear translation cache')}
          </button>
          <button
            class="kt-btn-ghost"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 2500);
                return;
              }
              void send({ type: 'stats.reset' });
              setConfirmReset(false);
            }}
          >
            {confirmReset ? t('click again to confirm') : t('Reset usage stats')}
          </button>
          <button
            class="kt-btn-ghost"
            onClick={() => {
              if (!confirmResetAll) {
                setConfirmResetAll(true);
                setTimeout(() => setConfirmResetAll(false), 2500);
                return;
              }
              setConfirmResetAll(false);
              void send({ type: 'settings.reset' }).then(() => location.reload());
            }}
          >
            {confirmResetAll ? t('click again to confirm') : t('Reset all settings to defaults')}
          </button>
        </div>
        <p class="text-xs text-kick-muted">
          {t(
            '"Reset all settings" puts every setting back to its default.',
          )}
        </p>
      </section>
    </>
  );
}

/**
 * Un reglage, son explication, et CE QU'IL FAIT EN CE MOMENT.
 *
 * La troisieme ligne est la raison d'etre de ce composant. Un champ qui porte
 * 15000 sans dire qu'il y a 3412 entrees dedans demande au lecteur de regler
 * un nombre a l'aveugle, et c'est ce qui rendait cette page creuse.
 *
 * role="status" pour que la valeur, qui arrive apres le premier rendu, soit
 * annoncee au lieu d'apparaitre en silence.
 */
function Row({
  label,
  hint,
  input,
  live,
}: {
  label: string;
  hint: string;
  input: preact.ComponentChildren;
  live?: string;
}) {
  return (
    <div class="grid grid-cols-[1fr,140px] gap-3 items-start">
      <div>
        <div class="text-sm">{label}</div>
        <div class="text-xs text-kick-muted">{hint}</div>
        {live !== undefined && (
          <div role="status" class="mt-1 text-xs tabular-nums text-kick-primary">
            {live}
          </div>
        )}
      </div>
      <div>{input}</div>
    </div>
  );
}
