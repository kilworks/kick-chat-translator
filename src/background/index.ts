import { defaultSettings, loadSettings, resetSettings, saveSettings, watchSettings, withoutKey, type Settings } from '~/shared/settings';
import { onMessage, SETTINGS_CHANGED, type RuntimeMessage, type RuntimeResponse } from '~/shared/messages';
import { rootLogger } from '~/shared/logger';
import { createMetrics } from '~/shared/metrics';
import { TranslationCache, warmTargets } from './cache';
import { resolveTargetLang } from '~/shared/languages';
import { TokenBucket } from './queue';
import { StatsTracker } from './stats';
import { TranslationCoalescer } from './coalescer';
import { anyProviderReady, getProviderStatus, setDeeplUsagePct } from './translator';
import { armKeepalive, installKeepalive, listenKeepalive } from './keepalive';
import { getUpdateStatus, installUpdateCheck } from './updateChecker';
import { DEEPL_USAGE_FREE, DEEPL_USAGE_PRO, MAX_TEXT_LENGTH } from '~/shared/constants';
import { getSemanticOverride } from '~/shared/transliterationGuard';
import { ecrireAutourDesEmotes } from './lexicalWrite';
import { CHAT_MESSAGES } from '~/content/i18n';
import { lockStorage } from './lockStorage';
import { getHint, getLastLang, setHint, setLastLang } from './pageStore';
import { addUsage, dropUsage, installUsage, recordProviderError, recordTranslation, syncUsageAlarm } from './usage';
import type { ProviderId, TranslationOutcome, TranslationRequest } from '~/shared/types';

const log = rootLogger.child('sw');
const metrics = createMetrics('sw');

let settings: Settings = defaultSettings();
const cache = new TranslationCache(settings.cacheMaxEntries, settings.cacheTtlHours * 3_600_000);
const stats = new StatsTracker();
const channelBuckets = new Map<string, TokenBucket>();
const coalescer = new TranslationCoalescer({ getSettings: () => settings, cache, stats });

/** Buckets kept at once. A reader opens a handful of channels, not hundreds. */
const CHANNEL_BUCKETS_MAX = 200;
/** What a request from a page may carry: the content script never exceeds these. */
const CHANNEL_RE = /^[\w.-]{1,64}$/;
const CONTEXT_MAX = 6000;

/** A message from a page is data, not a promise: check the shape before spending anything on it. */
export function validTranslateRequest(r: unknown): r is TranslationRequest {
  const q = r as Partial<Record<keyof TranslationRequest, unknown>> | null;
  return (
    typeof q === 'object' &&
    q !== null &&
    typeof q.messageId === 'string' &&
    q.messageId.length <= 200 &&
    typeof q.text === 'string' &&
    q.text.length <= MAX_TEXT_LENGTH &&
    typeof q.targetLang === 'string' &&
    q.targetLang.length <= 20 &&
    (q.channel === undefined || (typeof q.channel === 'string' && CHANNEL_RE.test(q.channel))) &&
    (q.context === undefined || (typeof q.context === 'string' && q.context.length <= CONTEXT_MAX)) &&
    (q.sourceLangHint === undefined || (typeof q.sourceLangHint === 'string' && q.sourceLangHint.length <= 20))
  );
}

function bucketFor(channel: string): TokenBucket {
  let b = channelBuckets.get(channel);
  if (!b) {
    if (channelBuckets.size >= CHANNEL_BUCKETS_MAX) {
      const oldest = channelBuckets.keys().next();
      if (!oldest.done) channelBuckets.delete(oldest.value);
    }
    b = new TokenBucket(settings.perChannelBudgetPerMin, settings.perChannelBudgetPerMin);
    channelBuckets.set(channel, b);
  }
  return b;
}

function applySettings(next: Settings): void {
  // Consent withdrawn: the day counted so far goes with it.
  if (settings.usageStats && !next.usageStats) void dropUsage();
  settings = next;
  syncUsageAlarm(next);
  cache.setConfig(next.cacheMaxEntries, next.cacheTtlHours * 3_600_000);
  for (const b of channelBuckets.values()) {
    b.setRate(next.perChannelBudgetPerMin, next.perChannelBudgetPerMin);
  }
  rootLogger.setEnabled(next.debug);
}

async function handleTranslate(req: TranslationRequest): Promise<TranslationOutcome> {
  if (!validTranslateRequest(req)) return { ok: false, error: { code: 'bad_request', message: 'Invalid request' } };
  if (!settings.enabled) {
    return { ok: false, error: { code: 'disabled', message: 'Extension disabled' } };
  }

  // There used to be a same-language short-circuit here: with an English target,
  // any text more than 85% basic Latin was declared already English and never
  // sent to a provider. An ASCII ratio cannot tell English from any other language
  // written in the Latin alphabet, so it refused Spanish, Turkish, Finnish,
  // French and the rest, while Japanese and Korean went through untouched because
  // of their script. Measured on saved chat with an English target it dropped 66
  // of 76 Spanish lines, 40 of 51 Turkish, and 0 of 43 Korean.
  // Deciding what is already in the user's language belongs to the content script,
  // which runs a real detector and honours the ignoreEnglish setting before it
  // ever calls in here.

  // Semantic override, ahead of the cache because it is a synchronous map lookup
  // and the cache is IndexedDB. Nothing is written back: the answer is a pure
  // function of (text, target), so a cache entry would only buy a stale copy of a
  // table that ships with the build.
  //
  // Measured against the shipped provider on 90 pairs of a short expression and a
  // non-Latin target: it repairs 26, replaces 35 already-correct answers with the
  // table's own chat register, matches on 29, and answers all 90 without touching
  // the network. The saved calls are the larger half of what it buys, and the
  // file's header does not say so.
  const override = getSemanticOverride(req.text, req.targetLang);
  if (override) {
    const detected = req.sourceLangHint ?? 'auto';
    // 'local' and not 'google': nothing was asked of a provider, and 'local'
    // already means answered on this device everywhere else in the stats.
    stats.recordRequest('local', detected, req.text.length, false, req.channel);
    return {
      ok: true,
      result: {
        messageId: req.messageId,
        translatedText: override,
        detectedLang: detected,
        provider: 'local',
        cached: false,
      },
    };
  }

  const key = cache.key(req.text, req.targetLang);
  if (!req.noCache) {
    // IndexedDB, on the path of every single line. A hit is the fastest possible
    // answer, but a miss still pays this before anything else starts, and the
    // measured hit rate is 10%.
    const lookup = (): Promise<Awaited<ReturnType<typeof cache.get>>> => cache.get(req.text, req.targetLang, key);
    const cached = __KT_METRICS__ ? await metrics.measure('leg.cache.lookup', lookup) : await lookup();
    if (cached) {
      const provider = cached.provider as ProviderId;
      stats.recordRequest(provider, cached.detectedLang, req.text.length, true, req.channel);
      return {
        ok: true,
        result: {
          messageId: req.messageId,
          translatedText: cached.translatedText,
          detectedLang: cached.detectedLang,
          provider,
          cached: true,
        },
      };
    }
  }

  if (req.channel && !bucketFor(req.channel).tryTake()) {
    // Compte le refus : sans lui, le reglage qui plafonne ce seau ne peut pas
    // dire s'il a deja servi a quelque chose, et le lecteur regle un nombre a
    // l'aveugle.
    stats.recordThrottled();
    return { ok: false, error: { code: 'channel_budget', message: 'Channel budget exhausted' } };
  }

  // Skip-silent: if every cloud provider is cooling down, fail fast (no queue buildup).
  if (!anyProviderReady(settings)) {
    return { ok: false, error: { code: 'saturated', message: 'No provider available' } };
  }

  return coalescer.submit(req, key);
}

interface DeeplUsage {
  configured: boolean;
  count: number;
  limit: number;
}
let deeplUsageCache: { at: number; value: DeeplUsage } | undefined;

async function fetchDeeplUsage(): Promise<DeeplUsage> {
  if (!settings.deeplApiKey) return { configured: false, count: 0, limit: 0 };
  // Throttle: DeepL counts usage calls lightly, but no need to hammer.
  if (deeplUsageCache && Date.now() - deeplUsageCache.at < 30_000) {
    return deeplUsageCache.value;
  }
  const url = settings.deeplPlan === 'pro' ? DEEPL_USAGE_PRO : DEEPL_USAGE_FREE;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `DeepL-Auth-Key ${settings.deeplApiKey}` },
    });
    if (!res.ok) return { configured: true, count: 0, limit: 0 };
    const j = (await res.json()) as { character_count?: number; character_limit?: number };
    const value: DeeplUsage = {
      configured: true,
      count: j.character_count ?? 0,
      limit: j.character_limit ?? 0,
    };
    deeplUsageCache = { at: Date.now(), value };
    // Feed the translator's budget pacing.
    if (value.limit > 0) setDeeplUsagePct(Math.round((value.count / value.limit) * 100));
    return value;
  } catch {
    return { configured: true, count: 0, limit: 0 };
  }
}

// Auto-refresh DeepL usage every 5 min so budget pacing reacts in near-real-time.
function scheduleDeeplUsageRefresh(): void {
  setInterval(() => {
    if (settings.deeplApiKey && settings.providerOrder.includes('deepl')) {
      void fetchDeeplUsage();
    }
  }, 5 * 60_000);
}

const CACHE_PRUNE_ALARM = 'kt.cachePrune';

/** Settled once the settings are read: what a cold worker answers first, before the cache warms. */
let settingsLoaded: () => void = () => undefined;
const settingsReady = new Promise<void>((r) => (settingsLoaded = r));

async function init(): Promise<void> {
  try {
    settings = await loadSettings();
    applySettings(settings);
  } finally {
    settingsLoaded();
  }
  await stats.load();
  await cache.warm(200, warmTargets(resolveTargetLang(settings.targetLang), stats.current().byLang));
  log.info('Service worker initialized');
  void installKeepalive();
  installUpdateCheck();
  scheduleDeeplUsageRefresh();
  // Seed the budget pacing on startup.
  if (settings.deeplApiKey) void fetchDeeplUsage();
  // Daily, and never on this path: a large readwrite pass would hold up the first
  // cache reads after a start. Alarms do not survive an update, hence the check.
  if (!(await chrome.alarms.get(CACHE_PRUNE_ALARM).catch(() => undefined))) {
    void chrome.alarms.create(CACHE_PRUNE_ALARM, { delayInMinutes: 1, periodInMinutes: 1440 });
  }
}

// Counts are written every few seconds, not on every line: this is the last chance
// before the browser stops an idle worker.
chrome.runtime.onSuspend?.addListener(() => void stats.flush());
// Top level, before anything awaits: see listenKeepalive.
listenKeepalive();
chrome.alarms.onAlarm.addListener((alarm) => {
  // Pruning before init would apply the default size and lifetime, not the reader's.
  if (alarm.name === CACHE_PRUNE_ALARM) void ready.then(() => cache.prune());
});
installUsage(
  () => settings,
  (on) => void saveSettings({ usageStats: on, usageStatsAsked: true }).then(applySettings),
);
// Dev builds only, see the content side in content/index.ts.
if (__KT_DEV__) {
  chrome.runtime.onMessage.addListener((m) => {
    if (m === 'kt-dev-reload') chrome.runtime.reload();
  });
}
// An event can wake the worker and arrive before init() has read storage:
// every handler waits for it, or it would act on the defaults.
const ready = init().catch((e: unknown) => log.error('init failed', e));
watchSettings((next) => {
  applySettings(next);
  void tellTabs();
});
// First thing at load, before any handler runs: see lockStorage.
void lockStorage();

/** Content scripts cannot watch storage any more: say it, they ask for the settings. */
async function tellTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: chrome.runtime.getManifest().content_scripts?.[0]?.matches ?? [] }).catch(() => []);
  for (const tab of tabs) {
    if (tab.id !== undefined) void chrome.tabs.sendMessage(tab.id, { type: SETTINGS_CHANGED }).catch(() => undefined);
  }
}

/**
 * What a Kick tab may ask. A page is the least trusted context that reaches
 * this router: a renderer compromised through kick.com can send whatever the
 * content script can. So it gets exactly what the content script uses, every
 * settings answer comes without the DeepL key, and it may write only the
 * settings the chat bar and the composer write. Dev builds let a test page
 * patch any other setting, never the key. The extension's own pages keep
 * every right.
 */
const PAGE_MESSAGES = new Set<RuntimeMessage['type']>([
  'translate',
  'stats.local',
  'usage.add',
  'i18n.chat',
  'settings.get',
  'settings.set',
  'open.options',
  'compose.write',
  'lastlang.get',
  'lastlang.set',
  'hint.get',
  'hint.set',
  'ping',
]);
const PAGE_SETTINGS = new Set<string>([
  'targetLang',
  'enabled',
  'pausedChannels',
  'channelLangs',
  'favoriteLangs',
  'composeTargetLang',
]);
const pageMayWrite = (patch: Partial<Settings>): boolean =>
  Object.keys(patch).every((k) => k !== 'deeplApiKey' && (__KT_DEV__ || PAGE_SETTINGS.has(k)));
const NOT_ALLOWED: RuntimeResponse = { type: 'error', payload: { message: 'not allowed' } };

/** Answerable from the settings alone: they no longer wait for the stats and the cache warm (10 to 30 ms on a cold worker). */
const SETTINGS_ONLY = new Set<RuntimeMessage['type']>([
  'settings.get',
  'i18n.chat',
  'open.options',
  'lastlang.get',
  'lastlang.set',
  'hint.get',
  'hint.set',
  'ping',
]);

onMessage(async (msg, sender): Promise<RuntimeResponse | void> => {
  await (SETTINGS_ONLY.has(msg.type) ? settingsReady : ready);
  // Chrome gives chrome-extension://<id>/, Firefox moz-extension://<uuid>/.
  const fromPage = !sender.url?.startsWith(chrome.runtime.getURL(''));
  if (fromPage && !PAGE_MESSAGES.has(msg.type)) return NOT_ALLOWED;
  // A message from a page means a Kick tab is open, which is what the
  // keepalive waits for after it cleared itself. The popup and the options
  // page have no tab and do not need the worker kept warm.
  if (sender.tab) armKeepalive();
  switch (msg.type) {
    case 'translate': {
      // The worker's own share of the round trip. `leg.roundtrip` on the content
      // side covers the same request plus transport and, in MV3, whatever it cost
      // to wake this worker up. The difference between the two is that cost, and
      // nothing has ever put a number on it.
      const run = (): Promise<TranslationOutcome> => handleTranslate(msg.payload);
      const started = Date.now();
      const outcome = __KT_METRICS__ ? await metrics.measure('leg.sw.total', run) : await run();
      // Opt-in usage statistics (no-ops without consent). Budget refusals and a
      // disabled extension are choices, not failures, so they are not counted.
      if (outcome.ok) {
        void recordTranslation(outcome.result.provider, outcome.result.cached, Date.now() - started);
      } else if (!['disabled', 'channel_budget'].includes(outcome.error.code)) {
        void recordProviderError();
      }
      return { type: 'translate.result', payload: outcome };
    }
    case 'stats.local':
      stats.recordRequest('local', msg.payload.lang, msg.payload.chars, false);
      void recordTranslation('local', false);
      return { type: 'ack' };
    case 'usage.add':
      await addUsage(msg.counts, msg.env);
      return { type: 'ack' };
    case 'i18n.chat':
      // An own key only: "constructor" or "__proto__" are not catalogues.
      return { type: 'i18n.chat', payload: Object.hasOwn(CHAT_MESSAGES, msg.locale) ? CHAT_MESSAGES[msg.locale] : undefined };
    case 'settings.get':
      return { type: 'settings', payload: fromPage ? withoutKey(settings) : settings };
    case 'settings.set': {
      if (fromPage && !pageMayWrite(msg.payload)) return NOT_ALLOWED;
      const next = await saveSettings(msg.payload);
      applySettings(next);
      return { type: 'settings', payload: fromPage ? withoutKey(next) : next };
    }
    case 'settings.reset': {
      const fresh = await resetSettings();
      applySettings(fresh);
      return { type: 'settings', payload: fresh };
    }
    case 'stats.get':
      return { type: 'stats', payload: stats.current() };
    case 'stats.reset': {
      const fresh = await stats.reset();
      return { type: 'stats', payload: fresh };
    }
    case 'providers.status':
      return { type: 'providers', payload: getProviderStatus(settings) };
    case 'deepl.usage':
      return { type: 'deepl.usage', payload: await fetchDeeplUsage() };
    case 'cache.clear':
      await cache.clear();
      return { type: 'ack' };
    case 'cache.stats':
      return { type: 'cache.stats', payload: await cache.stats() };
    case 'open.options':
      await chrome.runtime.openOptionsPage();
      return { type: 'ack' };
    case 'update.status':
      return { type: 'update.info', payload: await getUpdateStatus(msg.force) };
    case 'compose.write': {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return { type: 'error', payload: { message: 'no tab' } };
      const [res] = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [sender.frameId ?? 0] },
        world: 'MAIN',
        func: ecrireAutourDesEmotes,
        args: [msg.parts],
      });
      return res?.result === true ? { type: 'ack' } : { type: 'error', payload: { message: 'no editor' } };
    }
    case 'lastlang.get':
      return { type: 'value', payload: await getLastLang(msg.slug) };
    case 'lastlang.set':
      return (await setLastLang(msg.slug, msg.lang)) ? { type: 'ack' } : NOT_ALLOWED;
    case 'hint.get':
      return { type: 'value', payload: await getHint() };
    case 'hint.set':
      return (await setHint(msg.value)) ? { type: 'ack' } : NOT_ALLOWED;
    case 'ping':
      return { type: 'ack' };
    default:
      return undefined;
  }
});

/**
 * Les raccourcis clavier.
 *
 * Le worker et non le content script : un raccourci doit marcher quel que soit
 * l'onglet au premier plan, y compris quand aucune page Kick n'est ouverte, et
 * il ecrit un reglage plutot qu'il ne pilote une page. Le chemin est celui de
 * la page d'options, mot pour mot : saveSettings valide, applySettings rediffuse,
 * et tous les onglets ouverts suivent par watchSettings.
 *
 * Optionnel a l'appel : chrome.commands n'existe pas dans les contextes de test
 * ni dans un navigateur ou l'API est absente, et une extension qui refuse de
 * demarrer pour un raccourci serait un mauvais echange.
 */
chrome.commands?.onCommand.addListener((command) => {
  void (async () => {
    await ready;
    const patch =
      command === 'toggle-translation'
        ? { enabled: !settings.enabled }
        : command === 'toggle-compose'
          ? { composeEnabled: !settings.composeEnabled }
          : undefined;
    if (!patch) return;
    applySettings(await saveSettings(patch));
  })();
});

chrome.runtime.onInstalled.addListener(() => {
  log.info('Installed / updated');
  // No init() here: the module already ran it when this worker started.
  void reinjecterOngletsOuverts();
});

/**
 * Chrome n'injecte un script de contenu que dans les pages chargees apres
 * l'installation, et une mise a jour coupe celui des pages deja ouvertes. Sans
 * ceci, un onglet Kick ouvert pendant une installation ne faisait rien, et
 * pendant une mise a jour il cessait de traduire en continuant d'afficher
 * "Translating". Le script tolere de trouver un predecesseur dans la page.
 */
async function reinjecterOngletsOuverts(): Promise<void> {
  const [cs] = chrome.runtime.getManifest().content_scripts ?? [];
  if (!cs?.js?.length || !cs.matches?.length) return;
  const tabs = await chrome.tabs.query({ url: cs.matches }).catch(() => []);
  for (const tab of tabs) {
    if (tab.id === undefined || tab.discarded) continue;
    void chrome.scripting.executeScript({ target: { tabId: tab.id }, files: cs.js }).catch(() => undefined);
  }
}
