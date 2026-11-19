import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import './switch.css';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: JSX.Element | string;
  /** Accessible name, when the visible label alone cannot tell two switches apart. */
  srLabel?: string;
  /** Secondary line under the label. */
  hint?: string;
  disabled?: boolean;
  /** A change is in flight: announced, and the input stays focusable but refuses changes. */
  busy?: boolean;
  invalid?: boolean;
  /** Control after the label rather than before it. */
  reverse?: boolean;
  /** Extra classes on the outer label. */
  class?: string;
  /** Classes on the label text, so each surface keeps its own type size. */
  labelClass?: string;
}

/**
 * On/off switch, the one boolean control of the popup and the options page.
 * Settings apply at once, which is what a switch says and a checkbox does not.
 *
 * A real `<input type="checkbox" role="switch">` carries the keyboard (Space),
 * the name and the state; the rail and knob are drawn after it so CSS can reach
 * them from the input's state. The whole `<label>` is the click target.
 */
export function Switch({
  checked,
  onChange,
  label,
  srLabel,
  hint,
  disabled = false,
  busy = false,
  invalid = false,
  reverse = false,
  class: extra,
  labelClass = 'text-sm',
}: Props) {
  const hintId = useId();
  return (
    <label
      class={extra ? `kt-switch ${extra}` : 'kt-switch'}
      data-disabled={disabled && !busy ? '' : undefined}
      data-busy={busy ? '' : undefined}
      data-reverse={reverse ? '' : undefined}
    >
      <input
        type="checkbox"
        role="switch"
        class="kt-switch-input"
        checked={checked}
        disabled={disabled}
        aria-disabled={busy || undefined}
        aria-label={srLabel}
        aria-describedby={hint ? hintId : undefined}
        aria-invalid={invalid || undefined}
        aria-busy={busy || undefined}
        // busy keeps the input focusable (aria-disabled), so the change is refused here.
        onClick={(e) => busy && e.preventDefault()}
        onChange={(e) => !busy && onChange((e.target as HTMLInputElement).checked)}
      />
      <span class="kt-switch-rail" aria-hidden="true">
        <span class="kt-switch-knob" />
      </span>
      {(label || hint) && (
        <span class="kt-switch-text">
          {label && <span class={labelClass}>{label}</span>}
          {hint && <span class="kt-switch-hint" id={hintId} aria-hidden="true">{hint}</span>}
        </span>
      )}
    </label>
  );
}
