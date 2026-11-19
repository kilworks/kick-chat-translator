import type { JSX } from 'preact';
import { Switch } from '../../shared/Switch';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: JSX.Element | string;
  disabled?: boolean;
  /** A change is in flight; the rail pulses and the input stops accepting input. */
  busy?: boolean;
  invalid?: boolean;
  /** Secondary line under the label. */
  hint?: string;
  /**
   * Control after the label rather than before it.
   *
   * The settings rows have always put the control on the right, and moving 55
   * of them at once would relocate every switch under existing users without
   * asking. The reading order in the accessibility tree is unaffected: the
   * input keeps carrying the label either way.
   */
  reverse?: boolean;
}

/**
 * A boolean setting on the options page.
 *
 * It was a checkbox while the popup and Kick itself used switches, for the same
 * kind of setting, applied the same way: at once. Now it renders the shared
 * switch, and keeps its own name and props so no section had to change. The
 * mixed state is gone with the box: nothing outside this file ever set it.
 */
export function Check({ label, ...rest }: Props) {
  return <Switch {...rest} label={label} class="kt-check" labelClass="kt-check-label text-sm" />;
}
