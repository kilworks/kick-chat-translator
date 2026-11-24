import { useEffect, useState } from 'preact/hooks';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (v: number) => void;
}

/**
 * A whole number, saved when the reader is done with it.
 *
 * It used to save on every keystroke: clearing the box posted 0, which the schema
 * refuses ("Not saved."), and typing 15000 saved 1, 15, 150 and 1500 on the way.
 * The text is held here, shown invalid while it is out of range or empty, saved on
 * change (blur, Enter, the spinner) and put back to the saved value when it cannot be.
 */
export function NumberInput({ label, value, min, max, step, onCommit }: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const n = Number(text);
  const valid = text.trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
  return (
    <input
      aria-label={label}
      type="number"
      class="kt-input"
      min={min}
      max={max}
      step={step}
      value={text}
      aria-invalid={valid ? undefined : true}
      onInput={(e) => setText((e.target as HTMLInputElement).value)}
      onChange={() => (valid ? onCommit(n) : setText(String(value)))}
      onBlur={() => {
        if (!valid) setText(String(value));
      }}
    />
  );
}
