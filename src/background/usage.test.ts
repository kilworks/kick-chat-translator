import { describe, expect, it } from 'vitest';
import { defaultSettings } from '~/shared/settings';
import { USAGE_COUNTERS, addCounts, percentile } from '~/shared/usage';
import { buildEvent, type Day } from './usage';

// Ce qui part chez GA, champ par champ. PRIVACY.md promet cette liste et rien
// d'autre : un champ ajoute ici sans y etre ecrit fait rougir ce test.
const PROMIS = [
  'ext_version', 'browser', 'ui_lang', 'target_lang', 'engine_mode', 'has_7tv', 'local_api',
  'lat_p50', 'lat_p95', 'engagement_time_msec', 'session_id', ...USAGE_COUNTERS,
].sort();

const jour: Day = {
  day: '2026-10-15',
  counts: { tr_google: 40, tr_cache: 5, skipped: 12, compose_insert: 2 },
  lat: [300, 900, 1200, 1500, 4000],
  seen: 5,
  env: { has7tv: true, localApi: false },
};

describe('the daily usage event', () => {
  const ev = buildEvent(jour, defaultSettings(), '3.3.0', 'brave', 'fr');

  it('carries exactly the fields the privacy policy lists', () => {
    expect(Object.keys(ev).sort()).toEqual(PROMIS);
  });

  it('stays within what GA4 accepts: 25 params, short values', () => {
    expect(Object.keys(ev).length).toBeLessThanOrEqual(25);
    for (const v of Object.values(ev)) expect(String(v).length).toBeLessThanOrEqual(100);
  });

  it('counts, and nothing that could carry a message', () => {
    expect(ev.tr_google).toBe(40);
    expect(ev.err_provider).toBe(0);
    expect(ev.has_7tv).toBe(1);
    expect(ev.lat_p50).toBe(1200);
    expect(ev.lat_p95).toBe(4000);
    expect(ev.ui_lang).toBe('fr'); // 'auto' resolved to the browser's language
    expect(ev.session_id).toBe(20261015);
  });
});

describe('usage helpers', () => {
  it('adds counts without inventing keys', () => {
    expect(addCounts({ skipped: 1 }, { skipped: 2, tr_local: 1 })).toEqual({ skipped: 3, tr_local: 1 });
    expect(addCounts({}, { nope: 3 } as never)).toEqual({});
  });

  it('takes a nearest-rank percentile', () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([5], 95)).toBe(5);
    expect(percentile([1, 2, 3, 4, 100], 50)).toBe(3);
  });
});

// A count arrives from a page. A string "5" used to be concatenated into the sum
// and shipped to GA as text; a huge number skewed the day.
describe('counts from a page', () => {
  it('ignores what is not a positive finite number and bounds the rest', () => {
    const out = addCounts({ tr_google: 1 }, {
      tr_google: '5' as unknown as number,
      skipped: -3,
      tr_cache: Number.NaN,
      compose_insert: 1e12,
    });
    expect(out).toEqual({ tr_google: 1, compose_insert: 10_000 });
  });
});
