import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// P2-7: 9 to 11px body text reads badly in th, ta, hi and bn; 12px is the floor.
const FILES = [
  'AdvancedSection.tsx',
  'FilterSection.tsx',
  'AboutSection.tsx',
  'DebugSection.tsx',
  'UsageTrend.tsx',
];

describe('options sections text size', () => {
  it.each(FILES)('%s sets no text below 12px', (file) => {
    const src = readFileSync(join(process.cwd(), 'src/options/sections', file), 'utf8');
    expect(src.match(/text-\[(9|10|11)px\]/g) ?? []).toEqual([]);
  });
});
