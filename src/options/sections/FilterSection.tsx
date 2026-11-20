import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import type { Settings } from '~/shared/settings';
import type { UsageStats } from '~/shared/types';
import { sortedLanguages } from '~/shared/languages';
import { resolveUiLocale } from '~/shared/i18n';
import { useT } from '~/shared/i18nContext';
import { Check } from '../components/Check';
import { flagClass } from '~/shared/flags';
import { KICK_BOTS } from '~/shared/constants';
import { ignoredGlossaryLines } from '~/shared/glossary';

interface Props {
  settings: Settings;
  onPatch: (p: Partial<Settings>) => void;
  /** Ce que l'extension a vu. Absent tant que le worker n'a pas repondu. */
  stats?: UsageStats;
}

/**
 * Names (channels, users, bots): no spaces in a Kick name, so space, comma and
 * line break all separate; "@" pasted from chat is dropped; case folded.
 */
export function toNames(v: string): string[] {
  return v
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean);
}

/**
 * Keywords and glossary rules: one per LINE, spaces and case kept. Splitting
 * on spaces too made "good game" two keywords and a glossary rule with a space
 * unwritable, and lowercasing ate the case of every replacement.
 */
export function toLines(v: string): string[] {
  return v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function FilterSection({ settings, onPatch, stats }: Props) {
  const t = useT();
  const namesNote = useId();
  const [langQuery, setLangQuery] = useState('');
  // Localised and collated for the interface language the user chose,
  // not the one their browser happens to run in.
  const langs = useMemo(() => sortedLanguages(resolveUiLocale(settings.uiLang)), [settings.uiLang]);
  // Les comptes par langue, et l'ordre qu'ils imposent. Une liste de 43 cases
  // rangees par alphabet demande de connaitre la reponse avant de chercher ;
  // rangee par ce qui est reellement passe dans le chat, elle la donne.
  // Les comptes, sans toucher a l'ordre. Le tri par usage a ete essaye et
  // retire : il remontait les deux ou trois langues vues en tete puis laissait
  // l'alphabet reprendre au milieu, si bien qu'on ne pouvait plus trouver une
  // langue ni par usage ni par alphabet. L'alphabet est le seul ordre dans
  // lequel on CHERCHE ; le compte vert signale ce qui a ete vu, et le champ de
  // filtre juste au-dessus est ce qui sert a aller vite.
  const vues = stats?.byLang ?? {};

  const shown = useMemo(() => {
    const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = fold(langQuery.trim());
    if (!q) return langs;
    return langs.filter((l) => fold(l.name).includes(q) || fold(l.code).includes(q));
  }, [langs, langQuery]);
  return (
    <>
      <section class="kt-card space-y-3">
        <h2 class="kt-section">{t('General')}</h2>
        <ToggleRow
          checked={settings.ignoreEnglish}
          onChange={(v) => onPatch({ ignoreEnglish: v })}
          label={t('Skip messages already in target language')}
        />
        <ToggleRow
          checked={settings.ignoreBots}
          onChange={(v) => onPatch({ ignoreBots: v })}
          label={t('Ignore chat bots')}
        />
        {/* The built-in list is the field's helper line now: above the label it
            sat 7.9px from it, and it reads as part of the field anyway. */}
        {settings.ignoreBots && (
          <ListField
            id="kt-extra-bots"
            label={t('Other bots to ignore')}
            placeholder={t('one bot name per line')}
            help={`${t('Always ignored:')} ${KICK_BOTS.join(', ')}`}
            value={settings.extraBots}
            parse={toNames}
            onCommit={(v) => onPatch({ extraBots: v })}
          />
        )}
        <div class="grid grid-cols-[1fr,140px] gap-3 items-start">
          <div>
            <div class="text-sm">{t('Minimum message length')}</div>
            <div class="text-xs text-kick-muted">
              {t(
                'Shorter messages are left alone. Raise it to spend less provider quota on busy chats.',
              )}
            </div>
          </div>
          {/* The heading beside it is a plain div, so nothing connects the two
              for a screen reader: axe reports the field as unlabelled. */}
          <input
            aria-label={t('Minimum message length')}
            type="number"
            class="kt-input"
            min={1}
            max={50}
            value={settings.minTextLength}
            onInput={(e) => {
              const v = Number((e.target as HTMLInputElement).value);
              if (Number.isInteger(v) && v >= 1 && v <= 50) onPatch({ minTextLength: v });
            }}
          />
        </div>
      </section>

      <section class="kt-card space-y-3">
        {/* The popup's allowlist line links here (#filters-langs). */}
        <h2 id="filters-langs" tabIndex={-1} class="kt-section scroll-mt-4 focus:outline-none">
          {t('Source languages allowlist')}
        </h2>
        <p class="text-xs text-kick-muted">
          {t(
            'Leave empty to translate every detected language. Pick specific ones to ONLY translate those (e.g. only JA + KO).',
          )}
        </p>
        {/* L'etat courant, en clair. Une liste vide et une liste de trois se
            ressemblent quand rien ne dit ce que chacune donne. */}
        <p class="kt-hint" role="status">
          {settings.sourceLangAllowlist.length === 0
            ? t('Nothing picked: every language is translated.')
            : `${settings.sourceLangAllowlist.length} ${t('picked: everything else is left alone.')}`}
        </p>
        {/* 42 languages behind a scrollbar is the same problem the chip's list
            had, and it takes the same answer: type two letters instead of
            walking the list. Matching covers the ISO code as well as the name,
            since the names render in the interface language. */}
        <input
          type="text"
          class="kt-input"
          aria-label={t('Filter languages')}
          placeholder={t('Filter languages')}
          value={langQuery}
          onInput={(e) => setLangQuery((e.target as HTMLInputElement).value)}
        />
        {/* lucide check, verbatim from the kit's icons.js. */}
        <svg width="0" height="0" class="absolute" aria-hidden="true">
          <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </symbol>
        </svg>
        {/* A set, not a list of settings: toggle chips read as "include this
            one", where a row of OFF switches read as "not translated". */}
        <div class="grid grid-cols-3 gap-2">
          {shown.length === 0 && (
            <p role="status" class="col-span-3 py-2 text-xs text-kick-muted">
              {t('No language matches')}
            </p>
          )}
          {shown.map((l) => {
            const checked = settings.sourceLangAllowlist.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                aria-pressed={checked}
                class={`flex min-h-8 min-w-0 items-center gap-2 rounded border px-2 py-1 text-start text-xs transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kick-primary ${
                  checked
                    ? 'border-kick-primary bg-kick-primary/15 text-kick-text'
                    : 'border-kick-stroke text-kick-muted hover:bg-kick-dark/40'
                }`}
                onClick={() => {
                  const next = new Set(settings.sourceLangAllowlist);
                  if (next.has(l.code)) next.delete(l.code);
                  else next.add(l.code);
                  onPatch({ sourceLangAllowlist: [...next] });
                }}
              >
                {flagClass(l.code) ? (
                  <span class={`${flagClass(l.code)!} shrink-0`} aria-hidden="true" />
                ) : (
                  <span class="shrink-0 font-mono text-xs tracking-wider">{l.code.toUpperCase()}</span>
                )}
                <span class="truncate">{l.name}</span>
                {/* What this language actually amounted to in the chat. */}
                {(vues[l.code] ?? 0) > 0 && (
                  <span class="ms-auto shrink-0 tabular-nums text-xs text-kick-primary">{vues[l.code]}</span>
                )}
                {checked && (
                  <svg class={`h-4 w-4 shrink-0 text-kick-primary ${(vues[l.code] ?? 0) > 0 ? '' : 'ms-auto'}`} aria-hidden="true">
                    <use href="#i-check" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section class="kt-card space-y-3">
        <h2 class="kt-section">{t('Channels & users')}</h2>
        {/* Said once for the three name lists, not three times word for word
            under each, where it read as the caption of the next field. */}
        <p id={namesNote} class="text-xs text-kick-muted">
          {t('Spaces and commas also separate names.')}
        </p>
        {/* 24px between fields, 4px from a field to its own helper: the
            helper belongs to the field above it, not the label below. */}
        <div class="space-y-6">
          <ListField
            id="kt-whitelist-channels"
            describedBy={namesNote}
            label={t('Channel allowlist (only translate on these)')}
            placeholder={t('one channel name per line')}
            value={settings.whitelistChannels}
            parse={toNames}
            onCommit={(v) => onPatch({ whitelistChannels: v })}
          />
          <ListField
            id="kt-blacklist-channels"
            describedBy={namesNote}
            label={t('Channel blocklist')}
            placeholder={t('one channel name per line')}
            value={settings.blacklistChannels}
            parse={toNames}
            onCommit={(v) => onPatch({ blacklistChannels: v })}
          />
          <ListField
            id="kt-blacklist-users"
            describedBy={namesNote}
            label={t('User blocklist')}
            placeholder={t('one username per line')}
            value={settings.blacklistUsers}
            parse={toNames}
            onCommit={(v) => onPatch({ blacklistUsers: v })}
          />
          <ListField
            id="kt-blocked-keywords"
            label={t('Hide messages containing')}
            placeholder={t('one keyword per line, e.g. !fish')}
            help={t('Each line is one word or phrase.')}
            value={settings.blockedKeywords}
            parse={toLines}
            onCommit={(v) => onPatch({ blockedKeywords: v })}
          />
        </div>
      </section>

      <section class="kt-card space-y-3">
        <h2 class="kt-section">{t('Glossary')}</h2>
        <p class="text-xs text-kick-muted">
          {t(
            'Words the engines keep getting wrong for your channels. Each line replaces the left side with the right side, after translating.',
          )}
        </p>
        <ListField
          id="kt-glossary"
          label={t('Glossary')}
          hideLabel
          placeholder={`${t('one rule per line, in the form word→replacement')}\n草→lol\nkusa->lol`}
          value={settings.glossary}
          parse={toLines}
          onCommit={(v) => onPatch({ glossary: v })}
        />
        {/* A line without an arrow used to be dropped without a word. */}
        {ignoredGlossaryLines(settings.glossary).length > 0 && (
          <p role="status" class="text-xs text-red-300">
            {t('Ignored, write them as word -> replacement:')}{' '}
            <span class="font-mono">{ignoredGlossaryLines(settings.glossary).join(', ')}</span>
          </p>
        )}
      </section>
    </>
  );
}

/**
 * A list typed one entry per line.
 *
 * Read as a list rather than a code box: proportional text, the entry count
 * beside the label (what will actually be saved, so "a, b" counts two), and a
 * plain helper line, both tied to the field with aria-describedby. The stored
 * format is unchanged: the parsed array, one entry per line.
 *
 * The text areas used to be rebuilt from the saved list on every keystroke, so
 * the line break Enter makes was dropped at once (empty line filtered out) and
 * no second entry could be typed, a space split "good game" in two, and the
 * glossary lost its case. The draft now stays as typed while the field has
 * focus; the parsed list is saved shortly after typing stops and on blur.
 */
function ListField({
  id,
  label,
  placeholder,
  value,
  parse,
  onCommit,
  hideLabel,
  help,
  describedBy,
}: {
  id: string;
  label: string;
  placeholder: string;
  /** Plain helper line under the field. */
  help?: string;
  /** A note outside the field that also describes it (a card's intro line). */
  describedBy?: string;
  value: string[];
  parse: (v: string) => string[];
  onCommit: (v: string[]) => void;
  hideLabel?: boolean;
}) {
  const t = useT();
  const countId = useId();
  const helpId = useId();
  const saved = value.join('\n');
  const [draft, setDraft] = useState(saved);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A change from elsewhere (another tab, a reset) shows up, but never under
  // the cursor of someone typing.
  useEffect(() => {
    if (!focused.current) setDraft(saved);
  }, [saved]);
  const commit = (text: string): void => {
    const next = parse(text);
    if (next.join('\n') !== saved) onCommit(next);
  };
  // No count on an empty list (4 of 6 in a default install), and none on the
  // glossary, whose label is hidden: the count sat alone on its own row there.
  const entries = parse(draft).length;
  const counted = entries > 0 && !hideLabel;
  const describedIds = [counted && countId, help && helpId, describedBy].filter(Boolean).join(' ');
  return (
    <div class="kt-row">
      {hideLabel ? (
        <label class="sr-only" for={id}>
          {label}
        </label>
      ) : (
        <div class="flex items-baseline justify-between gap-2">
          <label class="kt-label" for={id}>
            {label}
          </label>
          {counted && (
            <span id={countId} data-kt-count class="ms-auto shrink-0 text-xs tabular-nums text-kick-muted">
              {t('Entries:')} {entries}
            </span>
          )}
        </div>
      )}
      <textarea
        id={id}
        class="kt-textarea"
        aria-describedby={describedIds || undefined}
        value={draft}
        placeholder={placeholder}
        onFocus={() => {
          focused.current = true;
        }}
        onInput={(e) => {
          const text = (e.target as HTMLTextAreaElement).value;
          setDraft(text);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(text), 600);
        }}
        onBlur={(e) => {
          focused.current = false;
          clearTimeout(timer.current);
          commit((e.target as HTMLTextAreaElement).value);
        }}
      />
      {help && (
        <p id={helpId} class="kt-hint">
          {help}
        </p>
      )}
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div class="kt-setting">
      <Check checked={checked} onChange={onChange} label={label} reverse />
    </div>
  );
}
