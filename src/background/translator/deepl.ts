import { PROVIDER_ENDPOINTS } from '~/shared/constants';
import { enhanceContextForShortInput } from '~/shared/transliterationGuard';
import type { TranslationRequest } from '~/shared/types';
import { ProviderError, type ProviderContext, type ProviderResult, type TranslationProvider } from './types';

interface DeeplResponse {
  translations: { detected_source_language: string; text: string }[];
}

const DEEPL_TARGETS: Record<string, string> = {
  en: 'EN-US',
  pt: 'PT-PT',
  'pt-br': 'PT-BR',
  zh: 'ZH-HANS',
  'zh-tw': 'ZH-HANT',
  no: 'NB',
};

// Target languages DeepL can produce — anything else must fall through to Google/MyMemory.
const DEEPL_SUPPORTED = new Set([
  'en', 'fr', 'es', 'pt', 'pt-br', 'de', 'it', 'nl', 'pl', 'sv', 'cs', 'sk', 'ro', 'ru',
  'uk', 'tr', 'ar', 'ja', 'ko', 'zh', 'zh-tw', 'fi', 'no', 'da', 'el', 'hu', 'bg', 'sl',
  'et', 'lt', 'lv', 'id',
]);

// Targets where DeepL supports the `formality` parameter (politeness register).
const DEEPL_FORMALITY = new Set(['de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'pt-br', 'ja', 'ru']);

function deeplTargetCode(code: string): string {
  const lower = code.toLowerCase();
  return DEEPL_TARGETS[lower] ?? lower.toUpperCase().split('-')[0] ?? lower.toUpperCase();
}

// DeepL's source list is the target list with the regional suffixes dropped: it
// reads EN, PT, ZH and rejects EN-US, PT-BR, ZH-HANT.
const DEEPL_SOURCES = new Set([...DEEPL_SUPPORTED].map((c) => c.split('-')[0] ?? c));

/**
 * The source hint DeepL will accept, or undefined when it has no such language.
 *
 * Undefined is the whole point. The detector can now name a language DeepL has
 * never heard of (Cantonese is the first, and it will not be the last), and
 * sending it as `source_lang` is an HTTP 400. A 400 is a provider failure: it
 * counts against DeepL's health and pushes it out of rotation, over a message
 * DeepL could have translated perfectly well by detecting the language itself.
 * So an unknown hint is dropped rather than sent.
 */
function deeplSourceCode(code: string): string | undefined {
  const base = code.toUpperCase().split('-')[0] ?? code.toUpperCase();
  // Norwegian is NB on both sides of DeepL; NO is not a language code it knows.
  // shortcut: from the DeepL language list as recalled, never sent with a real key.
  if (base === 'NO') return 'NB';
  return DEEPL_SOURCES.has(base.toLowerCase()) ? base : undefined;
}

function assertDeeplTarget(code: string): void {
  if (!DEEPL_SUPPORTED.has(code.toLowerCase())) {
    throw new ProviderError('deepl', 'unsupported', `DeepL has no target language ${code}`);
  }
}

function endpointFor(ctx: ProviderContext): string {
  return ctx.deeplPlan === 'pro' ? PROVIDER_ENDPOINTS.deeplPro : PROVIDER_ENDPOINTS.deeplFree;
}

function checkStatus(status: number): void {
  if (status === 403) throw new ProviderError('deepl', 'auth', 'DeepL: invalid key');
  if (status === 456) throw new ProviderError('deepl', 'quota', 'DeepL: monthly quota exceeded');
  if (status === 429) throw new ProviderError('deepl', 'rate_limit', 'DeepL: rate-limited');
  if (status < 200 || status >= 300) {
    throw new ProviderError('deepl', `http_${status}`, `DeepL HTTP ${status}`);
  }
}

async function postForm(
  form: URLSearchParams,
  ctx: ProviderContext,
): Promise<DeeplResponse> {
  const res = await fetch(endpointFor(ctx), {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${ctx.deeplApiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    signal: ctx.signal,
  });
  checkStatus(res.status);
  return (await res.json()) as DeeplResponse;
}

async function translate(req: TranslationRequest, ctx: ProviderContext): Promise<ProviderResult> {
  if (!ctx.deeplApiKey) throw new ProviderError('deepl', 'no_key', 'DeepL API key missing');
  assertDeeplTarget(req.targetLang);
  const form = new URLSearchParams();
  form.set('text', req.text);
  form.set('target_lang', deeplTargetCode(req.targetLang));
  const sourceLang = req.sourceLangHint ? deeplSourceCode(req.sourceLangHint) : undefined;
  if (sourceLang) form.set('source_lang', sourceLang);
  // Untranslated context improves disambiguation on short chat lines. On a short
  // message aimed at a non-Latin script an anti-transliteration hint rides in the
  // same free field, which DeepL does not bill.
  //
  // This lives here rather than in the content script, where the rescued wiring
  // put it. `context` is a DeepL parameter, so the knowledge belongs next to the
  // request that carries it; the version that built the hint in `compose.ts` cost
  // 380 bytes on every Kick page for a field only this provider reads, and
  // covered outgoing messages only.
  //
  // Never observed working: DeepL needs a key this machine does not have.
  const context = enhanceContextForShortInput(req.text, req.targetLang, req.context);
  if (context) form.set('context', context);
  // Compose (formal) → prefer the polite register where DeepL supports it (keigo for JA).
  if (req.formal && DEEPL_FORMALITY.has(req.targetLang.toLowerCase())) {
    form.set('formality', 'prefer_more');
  }

  const data = await postForm(form, ctx);
  const first = data.translations[0];
  if (!first) throw new ProviderError('deepl', 'empty', 'DeepL: empty response');
  return { translatedText: first.text, detectedLang: first.detected_source_language.toLowerCase() };
}

async function translateBatch(
  reqs: TranslationRequest[],
  ctx: ProviderContext,
): Promise<ProviderResult[]> {
  if (!ctx.deeplApiKey) throw new ProviderError('deepl', 'no_key', 'DeepL API key missing');
  if (reqs.length === 0) return [];
  const target = reqs[0]!.targetLang;
  assertDeeplTarget(target);
  const form = new URLSearchParams();
  form.set('target_lang', deeplTargetCode(target));
  // One source_lang covers the whole call, so it only goes out when every line
  // shares the same looked-up hint. Mixed or missing hints leave DeepL to detect.
  const hint = reqs[0]!.sourceLangHint;
  const sourceLang = hint && reqs.every((r) => r.sourceLangHint === hint) ? deeplSourceCode(hint) : undefined;
  if (sourceLang) form.set('source_lang', sourceLang);
  // DeepL preserves order and returns exactly one translation per `text` param.
  for (const r of reqs) form.append('text', r.text);

  const data = await postForm(form, ctx);
  if (data.translations.length !== reqs.length) {
    throw new ProviderError('deepl', 'count_mismatch', 'DeepL: result count mismatch');
  }
  return data.translations.map((t) => ({
    translatedText: t.text,
    detectedLang: t.detected_source_language.toLowerCase(),
  }));
}

export const deeplProvider: TranslationProvider = {
  id: 'deepl',
  requiresKey: true,
  supportsBatch: true,
  isConfigured: (ctx) => ctx.deeplApiKey.length > 0,
  translate,
  translateBatch,
};
