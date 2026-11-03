import type { ProviderStatus, TranslationOutcome, TranslationRequest } from '~/shared/types';
import type { CloudProviderId, Settings } from '~/shared/settings';
import { rootLogger } from '~/shared/logger';
import { createMetrics } from '~/shared/metrics';
import { decodeHtmlEntities } from '~/shared/decode';
import { isDeeplPremium, routeForBudget } from '~/shared/langTiers';
import { normalizeLang } from '~/shared/languages';
import { isTransliteration } from '~/shared/transliterationGuard';
import { ConcurrencyQueue } from '../queue';
import { googleProvider } from './google';
import { deeplProvider } from './deepl';
import { myMemoryProvider } from './mymemory';
import { lingvaProvider } from './lingva';
import { ProviderError, type ProviderContext, type TranslationProvider } from './types';

const log = rootLogger.child('translator');
const metrics = createMetrics('sw');

// On-device ('local') runs in the content script (localEngine.ts) — the SW chain
// is cloud-only.
const PROVIDERS: Record<CloudProviderId, TranslationProvider> = {
  google: googleProvider,
  deepl: deeplProvider,
  mymemory: myMemoryProvider,
  lingva: lingvaProvider,
};

interface ProviderHealth {
  lastError?: string;
  lastErrorMs?: number;
  lastUsedMs?: number;
  consecutiveFailures: number;
  cooldownUntilMs: number;
}

const health: Record<CloudProviderId, ProviderHealth> = {
  google: { consecutiveFailures: 0, cooldownUntilMs: 0 },
  deepl: { consecutiveFailures: 0, cooldownUntilMs: 0 },
  mymemory: { consecutiveFailures: 0, cooldownUntilMs: 0 },
  lingva: { consecutiveFailures: 0, cooldownUntilMs: 0 },
};

function buildContext(settings: Settings, signal?: AbortSignal): ProviderContext {
  return {
    deeplApiKey: settings.deeplApiKey,
    deeplPlan: settings.deeplPlan,
    deeplBudgetPct: settings.deeplBudgetPct,
    lingvaInstance: settings.lingvaInstance,
    myMemoryEmail: settings.myMemoryEmail,
    signal,
    concurrency: settings.concurrency,
  };
}

function markFailure(id: CloudProviderId, code: string, message: string): void {
  // 'unsupported' = the provider can't translate to this target — not a health
  // problem. Skip it for this request without cooling the provider down.
  if (code === 'unsupported') return;
  const h = health[id];
  h.lastError = message;
  h.lastErrorMs = Date.now();
  h.consecutiveFailures += 1;
  const cf = h.consecutiveFailures;
  let backoffMs: number;
  if (code === 'rate_limit') {
    // Transient throttle — recover fast (seconds), never black out for minutes.
    backoffMs = Math.min(10_000, 1500 * 2 ** (cf - 1));
  } else if (code === 'quota' || code === 'auth' || code === 'no_key') {
    // Configuration / monthly-quota problems won't fix themselves soon.
    backoffMs = 5 * 60_000;
  } else {
    // Network / unknown — moderate exponential, capped at 1 min.
    backoffMs = Math.min(60_000, 2000 * 2 ** (cf - 1));
  }
  h.cooldownUntilMs = Date.now() + backoffMs;
  // Which provider cools down, on what code, and for how long. Those are the
  // three numbers the backoff ladder above was guessed from, and none of them
  // has ever been read back.
  if (__KT_METRICS__) metrics.count(`cooldown.trip.${id}.${code}`);
  if (__KT_METRICS__) metrics.timing(`cooldown.ms.${id}`, backoffMs);
}

function markSuccess(id: CloudProviderId): void {
  const h = health[id];
  h.consecutiveFailures = 0;
  h.cooldownUntilMs = 0;
  h.lastError = undefined;
  h.lastUsedMs = Date.now();
  if (stickyProvider !== id) {
    stickyProvider = id;
    stickySinceMs = Date.now();
  }
}

function ok(req: TranslationRequest, id: CloudProviderId, translatedText: string, detectedLang: string): TranslationOutcome {
  return {
    ok: true,
    result: {
      messageId: req.messageId,
      translatedText: decodeHtmlEntities(translatedText),
      // Providers answer in their own codes: Google says 'zh-CN' and 'iw', DeepL
      // 'NB'. The badge, the stats and the same-language check all look codes up
      // in the product's own table, where those three are not keys.
      detectedLang: normalizeLang(detectedLang),
      provider: id,
      cached: false,
    },
  };
}

// DeepL budget pacing: the SW sets this from the usage cache so the translator
// can skip DeepL when the user's monthly budget % is reached.
let deeplUsagePct = 0;
export function setDeeplUsagePct(pct: number): void {
  deeplUsagePct = pct;
}

function isDeeplBudgetExhausted(ctx: ProviderContext): boolean {
  if (ctx.deeplBudgetPct <= 0) return false; // 0 = no limit
  return deeplUsagePct >= ctx.deeplBudgetPct;
}

// Provider sticky: prefer the last provider that succeeded to avoid unnecessary
// switching (and toast spam). Only overridden when that provider enters cooldown.
//
// It expires. Unbounded, one fallback was forever: Google answering `clutch` to
// ja in katakana handed the line to MyMemory, MyMemory became sticky, resolved
// everything after it, and Google was never asked again, for any target, until
// MyMemory itself failed. The clock starts when the sticky provider changes, not
// on each success, or a fallback that keeps answering would never expire.
// shortcut: 60 s is the longest network cooldown below, not a measured optimum;
// revisit with the cooldown.trip metrics once a real session reads them.
const STICKY_TTL_MS = 60_000;
let stickyProvider: CloudProviderId | undefined;
let stickySinceMs = 0;

/** Configured + not budget-blocked (ignores transient cooldown). */
function isConfiguredAndAllowed(id: CloudProviderId, ctx: ProviderContext): boolean {
  const p = PROVIDERS[id];
  if (!p) return false;
  if (p.requiresKey && !p.isConfigured(ctx)) return false;
  if (id === 'deepl' && isDeeplBudgetExhausted(ctx)) return false;
  return true;
}

function eligibleOrder(settings: Settings, ctx: ProviderContext, targetLang?: string): CloudProviderId[] {
  const smart = settings.deeplSmartRouting;
  // Budget-aware: for targets DeepL doesn't measurably win at, push it to the end
  // so the free engines spend first and the DeepL quota lasts.
  const baseOrder = routeForBudget(settings.providerOrder, targetLang, smart);
  const deeplDemoted = smart && !isDeeplPremium(targetLang);

  const live = baseOrder.filter(
    (id) => isConfiguredAndAllowed(id, ctx) && health[id].cooldownUntilMs <= Date.now(),
  );
  if (live.length === 0) {
    // Everyone cooling down: try the one recovering soonest (still respects config).
    return baseOrder
      .filter((id) => isConfiguredAndAllowed(id, ctx))
      .sort((a, b) => health[a].cooldownUntilMs - health[b].cooldownUntilMs);
  }
  // Sticky: keep the last good provider first to avoid churn — but never re-promote
  // DeepL when budget routing has deliberately demoted it for this target.
  if (
    stickyProvider &&
    Date.now() - stickySinceMs < STICKY_TTL_MS &&
    !(deeplDemoted && stickyProvider === 'deepl') &&
    live.includes(stickyProvider) &&
    live[0] !== stickyProvider
  ) {
    return [stickyProvider, ...live.filter((id) => id !== stickyProvider)];
  }
  return live;
}

/**
 * Translate a group of requests that share the same target language.
 * Returns outcomes aligned by index. Uses batch calls where the provider
 * supports it, otherwise per-item with a concurrency cap. Unresolved items
 * cascade to the next provider in the chain.
 */
export async function translateGroup(
  reqs: TranslationRequest[],
  settings: Settings,
  concurrency: number,
): Promise<TranslationOutcome[]> {
  const ctx = buildContext(settings);
  const results = new Array<TranslationOutcome | undefined>(reqs.length);
  const unresolved = new Set<number>(reqs.map((_, i) => i));
  let lastError: ProviderError | undefined;

  // How deep the chain had to go before something answered. `byProvider` in
  // stats.ts only ever counted the winner, so a first choice that fails on every
  // call and a first choice that always answers look identical there.
  let depth = 0;

  // A provider that spelled the input's sounds in the target's script answered
  // successfully and answered nothing. The item stays unresolved so the next
  // provider gets a turn, and the spelling is kept here so that all-providers-
  // transliterate returns a bad translation rather than a failure.
  //
  // Its ceiling, measured, because this layer looks stronger than it is. It can
  // only see Japanese: pure katakana out of Latin input is visible, while a
  // phonetic spelling in hangul, hanzi, Cyrillic or Arabic looks exactly like a
  // word, so 14 of the 18 transliterations found on 90 pairs are invisible to it.
  // On 50 short Latin lines outside the override table it fires 3 times and one
  // of those is repaired by the next provider; the other two are `clutch` and
  // `sheesh`, whose katakana is the correct Japanese. The cost of a false
  // positive is one round trip and never a worse answer.
  const translitFallback = new Map<number, TranslationOutcome>();

  for (const id of eligibleOrder(settings, ctx, reqs[0]?.targetLang)) {
    if (unresolved.size === 0) break;
    const provider = PROVIDERS[id];
    if (!provider) continue;
    const indices = [...unresolved];
    depth += 1;
    if (__KT_METRICS__) metrics.count(`chain.attempt.${id}`);

    const batchFn = provider.translateBatch?.bind(provider);
    if (provider.supportsBatch && batchFn && indices.length > 1) {
      const batchReqs = indices.map((i) => reqs[i]!);
      // BATCH_WINDOW_MS and BATCH_MAX_ITEMS are guesses. This is the distribution
      // that says whether the window is closing too early or too late.
      if (__KT_METRICS__) metrics.timing('batch.items', batchReqs.length);
      try {
        const runBatch = (): ReturnType<typeof batchFn> => batchFn(batchReqs, ctx);
        const out = __KT_METRICS__ ? await metrics.measure(`provider.${id}.batch`, runBatch) : await runBatch();
        markSuccess(id);
        if (__KT_METRICS__) metrics.count(`chain.depth.${depth}`);
        out.forEach((r, k) => {
          const idx = indices[k]!;
          const outcome = ok(reqs[idx]!, id, r.translatedText, r.detectedLang);
          if (isTransliteration(reqs[idx]!.text, r.translatedText, reqs[idx]!.targetLang)) {
            if (!translitFallback.has(idx)) translitFallback.set(idx, outcome);
            return;
          }
          results[idx] = outcome;
          unresolved.delete(idx);
        });
        continue;
      } catch (err: unknown) {
        lastError = asProviderError(id, err);
        log.warn(`batch ${id} failed:`, lastError.code, lastError.message);
        markFailure(id, lastError.code, lastError.message);
        // fall through to next provider with the same unresolved set
        continue;
      }
    }

    // Per-item path with concurrency cap.
    const pool = new ConcurrencyQueue(Math.max(1, concurrency));
    let anySuccess = false;
    let anyFail = false;
    await Promise.all(
      indices.map((idx) =>
        pool.add(async () => {
          try {
            const runItem = (): ReturnType<typeof provider.translate> => provider.translate(reqs[idx]!, ctx);
            const r = __KT_METRICS__ ? await metrics.measure(`provider.${id}.item`, runItem) : await runItem();
            if (!r.translatedText.trim()) throw new ProviderError(id, 'empty', 'empty');
            // Marked before the guard: the provider did answer, so its health is
            // not in question, only the usefulness of what it said.
            anySuccess = true;
            const outcome = ok(reqs[idx]!, id, r.translatedText, r.detectedLang);
            if (isTransliteration(reqs[idx]!.text, r.translatedText, reqs[idx]!.targetLang)) {
              if (!translitFallback.has(idx)) translitFallback.set(idx, outcome);
              return;
            }
            results[idx] = outcome;
            unresolved.delete(idx);
          } catch (err: unknown) {
            lastError = asProviderError(id, err);
            anyFail = true;
          }
        }),
      ),
    );
    if (anySuccess) {
      markSuccess(id);
      if (__KT_METRICS__) metrics.count(`chain.depth.${depth}`);
    } else if (anyFail) {
      markFailure(id, lastError?.code ?? 'unknown', lastError?.message ?? 'failed');
    }
  }

  // A kept transliteration beats a failure: the reader sees something, and the
  // retry arrow on the row is still there.
  return reqs.map((req, i) => results[i] ?? translitFallback.get(i) ?? failOutcome(req, lastError));
}

function asProviderError(id: CloudProviderId, err: unknown): ProviderError {
  return err instanceof ProviderError
    ? err
    : new ProviderError(id, 'unknown', err instanceof Error ? err.message : String(err));
}

function failOutcome(_req: TranslationRequest, lastError?: ProviderError): TranslationOutcome {
  return {
    ok: false,
    error: {
      code: lastError?.code ?? 'no_provider',
      message: lastError?.message ?? 'All providers failed',
      provider: lastError?.provider,
    },
  };
}

/** Single-request convenience wrapper. */
export async function translateWithFallback(
  req: TranslationRequest,
  settings: Settings,
): Promise<TranslationOutcome> {
  const [outcome] = await translateGroup([req], settings, 1);
  return outcome ?? failOutcome(req);
}

export function getProviderStatus(settings: Settings): ProviderStatus[] {
  const ctx = buildContext(settings);
  const now = Date.now();
  return settings.providerOrder.map((id) => {
    const provider = PROVIDERS[id];
    const h = health[id];
    const configured = provider ? !provider.requiresKey || provider.isConfigured(ctx) : false;
    const budgetPaused = id === 'deepl' && isDeeplBudgetExhausted(ctx);
    const cooldownLeft = h.cooldownUntilMs > now ? Math.ceil((h.cooldownUntilMs - now) / 1000) : 0;
    return {
      id,
      available: Boolean(provider) && configured && h.cooldownUntilMs <= now && !budgetPaused,
      lastError: budgetPaused ? `Budget paused (${deeplUsagePct}% used)` : h.lastError,
      lastUsedMs: h.lastUsedMs,
      cooldownLeftSec: cooldownLeft,
    };
  });
}

export function anyProviderReady(settings: Settings): boolean {
  const ctx = buildContext(settings);
  return eligibleOrder(settings, ctx).length > 0;
}
