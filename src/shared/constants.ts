export const EXT_NAME = 'Kick Chat Translator';
export const EXT_PREFIX = '[KickTranslator]';

export const KICK_API_BASE = 'https://kick.com/api/v2';
export const KICK_CHANNEL_API = (slug: string): string => `${KICK_API_BASE}/channels/${slug}`;

export const PROVIDER_ENDPOINTS = {
  google: 'https://translate.googleapis.com/translate_a/single',
  deeplFree: 'https://api-free.deepl.com/v2/translate',
  deeplPro: 'https://api.deepl.com/v2/translate',
  myMemory: 'https://api.mymemory.translated.net/get',
  lingvaDefault: 'https://lingva.lunar.icu',
} as const;

// Public Lingva instances, rotated round-robin to spread load / dodge per-host 500s.
// Keep in sync with host_permissions in manifest.config.ts.
export const LINGVA_POOL = ['https://lingva.lunar.icu', 'https://lingva.ml'];

// The same host's multi-line endpoint: repeated `q` fields, one answer per line.
export const GOOGLE_MULTI_ENDPOINT = 'https://translate.googleapis.com/translate_a/t';

// Google web-endpoint client params; rotating helps avoid per-(IP,client) throttling.
export const GOOGLE_CLIENTS = ['gtx', 'dict-chrome-ex'];

/**
 * A quelle cadence l'URL est relue pour voir un changement de chaine.
 *
 * Un script de contenu ne peut pas intercepter le `pushState` du site : il vit
 * dans un monde isole et son `history` est un autre objet. Mesure depuis le
 * monde principal, `history.pushState` y est natif malgre le patch. Relire
 * `location.pathname` ne depend d'aucun monde et marche pareil sur Firefox, qui
 * n'a pas d'API de navigation. Le comparateur sort sur un slug inchange, donc le
 * prix est une comparaison de chaines deux fois par seconde.
 */
export const ROUTE_POLL_MS = 500;

export const DEEPL_BATCH_MAX = 40; // DeepL accepts up to 50 text params; stay under.
// Coalescing window: short enough to keep latency low on quiet chats; busy chats
// hit BATCH_MAX_ITEMS well before this elapses, so batching is preserved.
export const BATCH_WINDOW_MS = 180;
/**
 * The floor the coalescer drops to when holding a line collects nothing.
 *
 * A window earns its latency only if another line arrives during it, and
 * expected arrivals are rate x window: 180ms needs about 5.5 lines a second.
 * Measured on an ordinary channel, 40 translations in 90 seconds, the window
 * was 186ms of a 217ms median while 24 of 27 dispatches carried one message.
 * Small enough to still absorb a genuine burst arriving together, short enough
 * that nobody waits on an empty room.
 */
export const MIN_BATCH_WINDOW_MS = 40;
/** Fast chat: batching pays for itself, so hold longer and send fewer calls. */
export const MAX_BATCH_WINDOW_MS = 300;
export const BATCH_MAX_ITEMS = 40; // flush size — aligned with DeepL's batch cap (fewer requests)

// DeepL usage endpoints (quota display in the popup).
export const DEEPL_USAGE_FREE = 'https://api-free.deepl.com/v2/usage';
export const DEEPL_USAGE_PRO = 'https://api.deepl.com/v2/usage';

// MyMemory: a contact email lifts the anon cap (5k → 50k words/day). Optional.
export const MYMEMORY_CONTACT = '';

export const CACHE_DB = 'kt-cache';
export const CACHE_STORE = 'translations';
export const STATS_DB = 'kt-stats';

export const MIN_TEXT_LENGTH = 2;
export const MAX_TEXT_LENGTH = 800;

export const DEFAULT_CACHE_MAX = 2000;
export const DEFAULT_CACHE_TTL_HOURS = 24;
export const DEFAULT_CONCURRENCY = 4;
export const KEEPALIVE_INTERVAL_SEC = 25;

export const STORAGE_KEY_SETTINGS = 'kt.settings.v2';
/**
 * The DeepL key, kept OUT of the synced settings blob and on this device only.
 *
 * chrome.storage.sync replicates to Google and to every Chrome signed into the
 * same account. That is right for preferences and wrong for a credential: a key
 * typed on one machine would land on every other one, including shared or work
 * profiles the user never meant to give it to. storage.local stays put.
 */
export const STORAGE_KEY_DEEPL_KEY = 'kt.deeplKey.v1';
export const STORAGE_KEY_STATS = 'kt.stats.v1';
export const STORAGE_KEY_UPDATE = 'kt.update.v1';
/** The day being counted for the opt-in usage statistics (shared/usage.ts). */
export const STORAGE_KEY_USAGE = 'kt.usage.v1';

// GA4 Measurement Protocol, for the opt-in daily usage event. Both ship inside
// the bundle whatever is done, which is how the Measurement Protocol works: the
// secret only lets someone ADD events to this stream, it reads nothing. Empty
// means nothing is ever sent.
// Property "Kick Chat Translator extension" (account "Kick Chat Translator"),
// web stream 16143972403, secret nicknamed "extension". Created 2026-10-16
// with the ga-usage-stats skill.
export const GA_MEASUREMENT_ID = 'G-M3X9D6KZLP';
export const GA_API_SECRET = 'SeO_Zkk4RKCCB0Iv_SDr1A';
export const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

// Self-update check: compare the installed version to the latest GitHub release.
export const GITHUB_REPO = 'Pkkls/kick-chat-translator';
/**
 * The listing's id on the Chrome Web Store.
 *
 * The store assigns it and it never changes for a listing, so comparing it to
 * `chrome.runtime.id` tells a store install from a zip without asking for the
 * `management` permission, which would send the listing back through a longer
 * review for a single boolean.
 */
export const CHROME_STORE_ID = 'nkkjmbkmacbdkboijmnhjnblcaiclhni';

/** The Firefox build's id, fixed in manifest.config.ts: every AMO install carries it. */
export const FIREFOX_ADDON_ID = 'kick-translator@pkkls.dev';
/** Where the update notice sends a zip install: the store copy updates itself from then on. */
export const CHROME_STORE_URL = `https://chromewebstore.google.com/detail/kick-chat-translator/${CHROME_STORE_ID}`;

/** Permanent invite to the extension's Discord server (shared with Twitch Chat Translator), lands in #welcome. */
export const DISCORD_URL = 'https://discord.gg/x3AvjdmAUk';

export const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const UPDATE_CHECK_TTL_MS = 6 * 60 * 60_000; // 6h

/**
 * Chat bots that run on Kick, always ignored when "Ignore chat bots" is on.
 * This list came from the first version as StreamElements, Nightbot and Moobot,
 * which are Twitch bots and never post on Kick. Kept short on purpose: anything
 * else a channel uses goes in the user's own list (settings.extraBots), not
 * here. Shown in the options page as written.
 */
export const KICK_BOTS = ['BotRix', 'Fossabot', 'KickBot', 'Sery_Bot', 'Kicklet'] as const;
export const COMMON_BOTS = new Set<string>(KICK_BOTS.map((b) => b.toLowerCase()));

/** How many languages the composer chip keeps pinned. Four fits 340px; five does not. */
export const FAVORITE_LANGS_MAX = 4;

/**
 * Combien de chaines gardent leur langue.
 *
 * chrome.storage.sync plafonne a 8 Ko par cle. Une entree pese un slug plus un
 * code, une quarantaine d'octets ; cinquante en font deux mille, ce qui laisse
 * la place au reste des reglages dans la meme cle. Au-dela, la plus ancienne
 * part : quelqu'un qui suit cinquante chaines ne se souvient de toute facon
 * plus de ce qu'il avait choisi sur la premiere.
 */
export const CHANNEL_LANG_MAX = 50;

/**
 * Combien de chaines peuvent rester en pause en meme temps.
 *
 * La pause du bandeau eteignait `enabled`, qui est global : mettre en pause sur
 * une chaine eteignait le produit sur toutes les autres, dans tous les onglets,
 * et durablement, alors que le bouton se lit comme "silence CETTE chaine". La
 * liste est bornee pour la meme raison que les favoris : elle vit dans
 * `storage.sync`, dont le quota par cle est petit.
 */
export const PAUSED_CHANNELS_MAX = 50;
