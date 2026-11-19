import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The About page said "no tracking" right above a switch that shares usage
// counts. Both cannot be shown at once.
const keys: string[] = JSON.parse(readFileSync(join(__dirname, 'i18n/keys.json'), 'utf8'));

describe('interface claims', () => {
  it('finds the usage statistics switch, so the check below is not vacuous', () => {
    expect(keys).toContain('Share anonymous usage statistics');
  });

  it('never claims "no tracking" while usage statistics exist', () => {
    expect(keys.filter((k) => /no tracking/i.test(k))).toEqual([]);
  });
});
