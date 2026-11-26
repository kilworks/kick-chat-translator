// Share of each answer over a set of lines whose origin is known. Pure, so a test can pin it; the CLI in test/e2e feeds it.
export function shares(
  rows: { t: string }[],
  answer: (t: string) => string | undefined,
): { n: number; shares: Record<string, number> } {
  const count: Record<string, number> = {};
  for (const r of rows) {
    const a = answer(r.t) ?? 'none';
    count[a] = (count[a] ?? 0) + 1;
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(count).sort((x, y) => y[1] - x[1])) out[k] = Math.round((10000 * v) / rows.length) / 100;
  return { n: rows.length, shares: out };
}
