import type { UsageStats } from '~/shared/types';
import { useT } from '~/shared/i18nContext';

interface Props {
  stats: UsageStats;
}

export function StatsBar({ stats }: Props) {
  const t = useT();
  const hitRate =
    stats.totalRequests > 0 ? Math.round((stats.totalCacheHits / stats.totalRequests) * 100) : 0;

  return (
    <div class="flex flex-col gap-2 pt-1">
      {/* Columns sized by their content: equal thirds wrapped a long label
          (Greek "cache", two words) onto a second line and the popup to 604px. */}
      <div class="flex justify-between gap-2 text-center">
        <Stat label={t('requests')} value={stats.totalRequests} />
        <Stat label={t('cache')} value={`${hitRate}%`} />
        <Stat
          label={t('errors')}
          value={stats.totalErrors}
          tone={stats.totalErrors > 0 ? 'warn' : 'mute'}
        />
      </div>
      {/* The 7-day cache graph and the per-language pills used to live here.
          Measured, they cost 36px and 23px in a popup that overflowed its
          600px by 69px, and neither answers the question a popup gets opened
          for — "is it working" is the three numbers above. They moved, tests
          included, to options/sections/UsageTrend.tsx on the Debug tab. */}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: number | string;
  tone?: 'normal' | 'warn' | 'mute';
}) {
  const color =
    tone === 'warn' ? 'text-red-300' : tone === 'mute' ? 'text-kick-muted' : 'text-kick-text';
  return (
    <div class="flex flex-col">
      <span class={`text-base font-semibold ${color}`}>{value}</span>
      <span class="text-xs uppercase text-kick-muted">{label}</span>
    </div>
  );
}
