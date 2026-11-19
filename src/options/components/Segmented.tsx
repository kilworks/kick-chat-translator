import { useId } from 'preact/hooks';
import type { JSX } from 'preact';

export interface SegmentedOption {
  value: string;
  label: string;
  /** Swatch look only: the colour the option stands for, as any CSS colour. */
  color?: string;
}

interface Props {
  label: string;
  value: string;
  options: SegmentedOption[];
  onChange: (v: string) => void;
  /** Colour swatches instead of text segments. Each swatch is named by its label. */
  swatch?: boolean;
}

/**
 * A small set of choices shown all at once: a WAI-ARIA radio group.
 *
 * One tab stop for the whole group (roving tabindex on the checked option),
 * arrows move and select, Home and End jump to the ends. The checked state is
 * carried by aria-checked, a fill and, on swatches, a tick, so colour is never
 * the only cue.
 */
export function Segmented({ label, value, options, onChange, swatch = false }: Props) {
  const id = useId();
  const current = options.findIndex((o) => o.value === value);
  const stop = current < 0 ? 0 : current;

  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    // Alt+Left is browser back; Ctrl and Meta chords belong to the browser too.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const step: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1,
    };
    const n = options.length;
    const radios = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=radio]')];
    // Step from the option that has focus: with nothing checked that is not the roving stop.
    const focused = radios.indexOf((e.target as HTMLElement).closest<HTMLElement>('[role=radio]')!);
    const from = focused < 0 ? stop : focused;
    let next: number;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key in step) next = (from + step[e.key]! + n) % n;
    else return;
    e.preventDefault();
    onChange(options[next]!.value);
    radios[next]?.focus();
  };

  const checkedLabel = options[current]?.label;

  return (
    <div class="kt-row">
      <span id={id} class="kt-label">
        {label}
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-labelledby={id}
          onKeyDown={onKeyDown}
          class={
            swatch
              ? 'flex flex-wrap gap-2'
              : 'flex flex-wrap gap-1 rounded-lg border border-kick-stroke p-1'
          }
        >
          {options.map((o, i) => {
            const on = i === current;
            const ring =
              'transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kick-primary';
            return swatch ? (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={o.label}
                title={o.label}
                tabIndex={i === stop ? 0 : -1}
                onClick={() => onChange(o.value)}
                class={`grid h-8 w-8 place-items-center rounded-lg border-2 text-kick-dark ${ring} ${
                  on ? 'border-kick-text' : 'border-transparent hover:border-kick-stroke-strong'
                }`}
                style={{ backgroundColor: o.color }}
              >
                {on && (
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <use href="#i-check" />
                  </svg>
                )}
              </button>
            ) : (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={i === stop ? 0 : -1}
                onClick={() => onChange(o.value)}
                class={`min-h-8 rounded px-3 py-1 text-sm ${ring} ${
                  on
                    ? 'bg-kick-primary/15 text-kick-primary'
                    : 'text-kick-muted hover:bg-kick-dark/40 hover:text-kick-text'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {swatch && checkedLabel && (
          <span class="text-sm text-kick-muted" aria-hidden="true">
            {checkedLabel}
          </span>
        )}
      </div>
      {swatch && (
        <svg width="0" height="0" class="absolute" aria-hidden="true">
          <symbol id="i-check" viewBox="0 0 24 24">
            <path d="M20 6 9 17l-5-5" />
          </symbol>
        </svg>
      )}
    </div>
  );
}
