import { Switch } from '../../shared/Switch';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  /**
   * Accessible name, when the visible one is not enough to tell two switches
   * apart. Two of these read "enable" on the popup, one for the chat and one
   * for what you type, so a screen reader announced the same control twice
   * with no way to know which was which. The visible text is unchanged.
   */
  srLabel?: string;
  disabled?: boolean;
}

/**
 * On/off switch of the popup: the shared switch with the popup's small muted
 * label. Rail, knob and focus ring are measured in src/shared/switch.css.
 */
export function Toggle({ label, ...rest }: Props) {
  return <Switch {...rest} label={label} labelClass="text-xs text-kick-muted" />;
}
