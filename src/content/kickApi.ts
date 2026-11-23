import { KICK_CHANNEL_API } from '~/shared/constants';
import { normalizeLang } from '~/shared/languages';

interface ChannelResponse {
  slug?: string;
  user?: { username?: string };
  // Present only while the channel is live. `lang_iso` is a clean ISO-639-1 code
  // (e.g. "en", "es", "ja") set by the streamer — the language the channel chats in.
  livestream?: { lang_iso?: string; language?: string } | null;
}

export function extractChannelSlug(pathname: string): string | undefined {
  // Avoid known non-channel routes
  const RESERVED = new Set([
    '',
    'browse',
    'categories',
    'category',
    'community',
    'community-guidelines',
    'following',
    'subscriptions',
    'help',
    'jobs',
    'about',
    'tos',
    'privacy',
    'video',
    'videos',
    'clips',
    'search',
    'creator-program',
    'wallet',
    'dashboard',
    'settings',
    'analytics',
    'vods',
  ]);
  const parts = pathname.split('/').filter(Boolean);
  const first = parts[0];
  if (!first) return undefined;
  if (RESERVED.has(first.toLowerCase())) return undefined;
  // /<slug> or /<slug>/<sub>
  return first.toLowerCase();
}

export interface ChannelMeta {
  /** The channel's broadcast language as a supported ISO-2 code, when live. */
  langIso?: string;
}

interface CachedMeta extends ChannelMeta {
  at: number;
}

// Cache TTL: `langIso` only appears once a channel goes live, so re-fetch
// periodically rather than caching "unknown" forever.
const META_TTL_MS = 5 * 60_000;
const metaCache = new Map<string, CachedMeta>();
// Coalesce concurrent fetches for the same slug (rapid route changes / both
// accessors firing at once) into a single network request.
const inflight = new Map<string, Promise<ChannelMeta>>();

// Persisted last-known broadcast language per channel. `lang_iso` only exists while a
// channel is LIVE; remembering it lets compose still target the right language when you
// open the channel offline (instead of falling back to English).
const LASTLANG_KEY = (slug: string): string => `kt.lastlang.${slug}`;

async function fetchChannelMeta(slug: string): Promise<ChannelMeta> {
  const cached = metaCache.get(slug);
  // Serve from cache unless it's stale, or it's missing a language we might now find.
  if (cached && Date.now() - cached.at < META_TTL_MS && cached.langIso) return cached;
  const pending = inflight.get(slug);
  if (pending) return pending;

  const request = (async (): Promise<ChannelMeta> => {
    try {
      const res = await fetch(KICK_CHANNEL_API(slug), {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      // Cloudflare/anti-bot can return 403/503 — never throw, just serve what we have.
      if (!res.ok) return cached ?? {};
      const data = (await res.json()) as ChannelResponse;
      const rawLang = data.livestream?.lang_iso;
      const meta: CachedMeta = {
        langIso: rawLang ? normalizeLang(rawLang) : cached?.langIso,
        at: Date.now(),
      };
      metaCache.set(slug, meta);
      if (meta.langIso) {
        try {
          void chrome.storage.local.set({ [LASTLANG_KEY(slug)]: meta.langIso });
        } catch {
          /* storage unavailable (e.g. unit tests) — non-fatal */
        }
      }
      return meta;
    } catch {
      return cached ?? {};
    } finally {
      inflight.delete(slug);
    }
  })();
  inflight.set(slug, request);
  return request;
}

/**
 * The channel's chat language (ISO-2). When live, the broadcast `lang_iso`; when
 * offline/unknown, the last language we saw this channel broadcast in (persisted),
 * so compose keeps targeting e.g. Japanese instead of defaulting to English.
 */
export async function fetchChannelLangIso(slug: string): Promise<string | undefined> {
  const live = (await fetchChannelMeta(slug)).langIso;
  if (live) return live;
  try {
    const stored = await chrome.storage.local.get(LASTLANG_KEY(slug));
    const last = stored[LASTLANG_KEY(slug)];
    return typeof last === 'string' ? last : undefined;
  } catch {
    return undefined;
  }
}
