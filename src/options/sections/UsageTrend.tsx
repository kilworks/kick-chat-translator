import type { UsageStats } from '~/shared/types';
import { useT } from '~/shared/i18nContext';
import { localLangName } from '~/shared/languages';

/**
 * Ce que l'extension a fait, en chiffres lisibles.
 *
 * Elle vivait dans le popup, ou elle coutait 59px d'une surface qui debordait
 * deja de 69. Elle a ensuite passe une version en barres de 40px dont la
 * valeur n'existait que dans un `title` : invisible au clavier, au lecteur
 * d'ecran et au doigt, et deux jours voisins a 90 et 95 % se ressemblaient a
 * deux pixels pres.
 *
 * Ici chaque barre porte son nombre, la colonne de tete porte le total, et les
 * langues portent leur nom plutot que leur code ISO, que cette page sait
 * traduire depuis toujours.
 */
export function UsageTrend({ stats }: { stats: UsageStats }) {
  const t = useT();

  // Un jour sans trafic n'est jamais archive : le sauter vaut mieux que de le
  // dessiner comme une journee a 0 % de reussite.
  const trend = [
    ...(stats.history ?? []),
    { day: stats.todayKey, requests: stats.totalRequests, cacheHits: stats.totalCacheHits },
  ]
    .filter((d) => d.requests > 0)
    .slice(-7);

  const topLangs = Object.entries(stats.byLang)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (trend.length === 0 && topLangs.length === 0) return null;

  const hitRate =
    stats.totalRequests > 0 ? Math.round((stats.totalCacheHits / stats.totalRequests) * 100) : 0;
  const reseau = stats.totalRequests - stats.totalCacheHits;

  return (
    <section class="kt-card-lead space-y-4">
      <h2 class="kt-section">{t('Usage')}</h2>

      {/* Les trois nombres qui repondent "est-ce que ca sert a quelque chose".
          En tete, gros, avant tout graphique : un total se lit, il ne se
          deduit pas d'une serie de barres. */}
      <div class="flex flex-wrap gap-x-8 gap-y-3">
        <Figure value={stats.totalRequests.toLocaleString()} label={t('messages translated')} />
        <Figure value={`${hitRate}%`} label={t('served from cache')} />
        <Figure value={reseau.toLocaleString()} label={t('sent to a provider')} />
      </div>

      {trend.length > 0 && (
        <div>
          <div class="kt-label mb-2">{t('cache hit rate, last 7 days')}</div>
          <div class="flex max-w-lg items-end gap-2">
            {trend.map((d) => {
              const pct = Math.round((d.cacheHits / d.requests) * 100);
              return (
                <div key={d.day} class="flex flex-1 flex-col items-center gap-1">
                  {/* La barre et sa reserve : sans un conteneur a hauteur fixe,
                      une barre a 30 % et une a 90 % ne partagent pas la meme
                      base et la comparaison ne veut rien dire. */}
                  <div class="flex h-24 w-full items-end rounded-sm bg-kick-border/40">
                    <div
                      class="min-h-[2px] w-full rounded-sm bg-kick-primary/70"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <div class="text-xs tabular-nums text-kick-text">{pct}%</div>
                  <div class="text-xs tabular-nums text-kick-muted">
                    {d.day.slice(5).replace('-', '/')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {topLangs.length > 0 && (
        <div>
          <div class="kt-label mb-2">{t('languages seen in chat')}</div>
          <ul class="space-y-1">
            {topLangs.map(([lang, count]) => (
              <li key={lang} class="flex items-baseline gap-2 text-[12px]">
                <span class="w-28 shrink-0 truncate text-kick-text">
                  {localLangName(lang, lang.toUpperCase())}
                </span>
                <span class="tabular-nums text-kick-muted">{count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <p class="kt-hint mt-2">
            {t('These are the languages the allowlist in Filters decides between.')}
          </p>
        </div>
      )}
    </section>
  );
}

/** Un nombre et ce qu'il compte. Le nombre d'abord, parce que c'est lui qu'on vient lire. */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div class="text-2xl font-semibold tabular-nums leading-none text-kick-text">{value}</div>
      <div class="mt-1 text-xs text-kick-muted">{label}</div>
    </div>
  );
}
