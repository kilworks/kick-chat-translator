import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runMatrix, type Cell } from './langMatrix';
import { confidentLanguage, detectLanguage } from './langDetect';
import { parseKickContent } from './emoteParser';
import { trimForEngine } from './filters';

/**
 * The real chat bench, heldout half: live Kick lines annotated by two
 * independent annotators (test/e2e/real-bench.mjs), never read line by line.
 *
 * Third-party chat, so it lives outside git: point KCT_BENCH at the folder
 * holding heldout.jsonl. Without it the suite skips, and a public clone or the
 * CI loses nothing but these numbers.
 *
 * Gold is a line's language where both annotators gave the same code; neutral,
 * mixed, other and disputed lines are not in the matrix. The detector reads
 * what the pipeline reads (emotes parsed out, the line trimmed), and its
 * traditional Chinese answer counts as Chinese, the annotators' `zh` covering
 * both scripts.
 */

const DIR = process.env.KCT_BENCH;
const FILE = DIR ? join(DIR, 'heldout.jsonl') : '';
const present = !!DIR && existsSync(FILE);

interface Row {
  text: string;
  lang?: string | null;
}

const rows = (): Row[] =>
  readFileSync(FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);
const realText = (t: string) => trimForEngine(parseKickContent(t).realText);
const base = (det: (t: string) => string | undefined) => (t: string) => {
  const a = det(t);
  return a === 'zh-tw' ? 'zh' : a;
};
const NOT_A_LANGUAGE = new Set(['neutral', 'mixed', 'other']);
const corpus = (): Record<string, string[]> => {
  const c: Record<string, string[]> = {};
  for (const r of rows()) if (r.lang && !NOT_A_LANGUAGE.has(r.lang)) (c[r.lang] ??= []).push(realText(r.text));
  return c;
};
const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });
const neutralNamed = (det: (t: string) => string | undefined) =>
  rows().filter((r) => r.lang === 'neutral' && det(realText(r.text)) !== undefined).length;

describe.skipIf(!present)('the real chat bench, heldout', () => {
  it('is the one that was frozen, byte for byte', () => {
    expect(createHash('sha256').update(readFileSync(FILE)).digest('hex')).toBe(
      'e6393060612cd79b400e791f486aba3a8f8862d0df3a81e3452caca3a5b24a02',
    );
  });

  it('measures the confident path in totals', () => {
    expect(plain(runMatrix(base(confidentLanguage), corpus()).total)).toEqual({ right: 359, silent: 338, wrong: 3 });
    expect(neutralNamed(confidentLanguage)).toBe(0);
  });

  it('measures the raw path in totals', () => {
    expect(plain(runMatrix(base(detectLanguage), corpus()).total)).toEqual({ right: 428, silent: 156, wrong: 116 });
    expect(neutralNamed(detectLanguage)).toBe(55);
  });
});
