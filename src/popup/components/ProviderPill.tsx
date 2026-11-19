import type { ProviderStatus } from '~/shared/types';
import { useT } from '~/shared/i18nContext';

const LABELS: Record<string, string> = {
  google: 'Google',
  deepl: 'DeepL',
  mymemory: 'MyMemory',
  lingva: 'Lingva',
};

interface Props {
  status: ProviderStatus;
}

export function ProviderPill({ status }: Props) {
  const t = useT();
  // A status, not a control: no border or fill that reads as a button. The
  // dot and the colour of the name carry the state.
  const tone = status.available ? 'text-kick-text' : 'text-red-300';
  const label = LABELS[status.id] ?? status.id;
  return (
    <span
      class={`inline-flex items-center gap-1.5 text-xs ${tone}`}
      title={status.lastError ?? (status.available ? t('available') : t('unavailable'))}
    >
      {/* Not colour alone: a down engine gets a hollow ring, and the state is
          read out, not left to a hover-only title. */}
      <span
        aria-hidden="true"
        class={`h-2 w-2 rounded-full ${status.available ? 'bg-kick-primary' : 'border-2 border-red-400'}`}
      />
      {label}
      <span class="sr-only">{status.available ? t('available') : t('unavailable')}</span>
    </span>
  );
}
