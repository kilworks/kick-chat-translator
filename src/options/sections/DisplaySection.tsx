import { useEffect, useRef, useMemo, useId } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Settings } from '~/shared/settings';
import { sortedLanguages } from '~/shared/languages';
import { resolveUiLocale } from '~/shared/i18n';
import { useT } from '~/shared/i18nContext';
import { Check } from '../components/Check';
import { Segmented } from '../components/Segmented';
import {
  applyAccent,
  applyChatScheme,
  applyShowOriginal,
  applyTypography,
  ensureStyles,
  inject,
  armHoverTranslate,
} from '~/content/injector';

interface Props {
  settings: Settings;
  onPatch: (p: Partial<Settings>) => void;
}

export function DisplaySection({ settings, onPatch }: Props) {
  const t = useT();
  // Localised and collated for the interface language the user chose,
  // not the one their browser happens to run in.
  const langs = useMemo(() => sortedLanguages(resolveUiLocale(settings.uiLang)), [settings.uiLang]);
  const targetId = useId();
  const composeId = useId();
  return (
    <>
      <section class="kt-card space-y-3">
        <h2 class="kt-section">{t('Translation target')}</h2>
        <div class="kt-row">
          <label class="kt-label" for={targetId}>
            {t('Translate everything to')}
          </label>
          <select
            id={targetId}
            aria-label={t('Translate everything to')}
            class="kt-select"
            value={settings.targetLang}
            onChange={(e) => onPatch({ targetLang: (e.target as HTMLSelectElement).value })}
          >
            <option value="auto">{t('Auto (your language)')}</option>
            {langs.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <p class="text-[12px] text-kick-muted">
          {t('Auto reads incoming chat in your own language, detected from the browser.')}
        </p>
      </section>

      {/* The scroll margin keeps a control that takes focus from landing under
          the pinned preview (WCAG 2.4.11). */}
      <section class="kt-card space-y-3 [&_button]:scroll-mt-36 [&_input]:scroll-mt-36">
        <h2 class="kt-section">{t('Display style')}</h2>

        {/* Pinned inside this card, so every setting below changes in view. */}
        <StylePreview settings={settings} />
        {/* Two by two rather than a single row. A fourth column would put each
            card at 60px on the 280px window the page is checked against, and
            the descriptions are what make the cards worth having. */}
        <div class="grid grid-cols-2 gap-2">
          <svg width="0" height="0" class="absolute" aria-hidden="true">
            <symbol id="i-card-check" viewBox="0 0 24 24">
              <path d="M20 6 9 17l-5-5" />
            </symbol>
          </svg>
          <StyleCard
            active={settings.displayStyle === 'below'}
            label={t('Below')}
            desc={t('On a new line under the message.')}
            onClick={() => onPatch({ displayStyle: 'below' })}
            recommended
          />
          <StyleCard
            active={settings.displayStyle === 'inline'}
            label={t('Inline')}
            desc={t('In a pill after the original text.')}
            onClick={() => onPatch({ displayStyle: 'inline' })}
          />
          <StyleCard
            active={settings.displayStyle === 'replace'}
            label={t('Replace')}
            desc={t('In place of the original text. Emotes stay.')}
            onClick={() => onPatch({ displayStyle: 'replace' })}
          />
          {/* Shipped and wired through the pipeline since before this refit,
              and selectable from nowhere: the picker offered three of the
              schema's four values, so the one that spares the quota was
              reachable only by writing storage by hand. */}
          <StyleCard
            active={settings.displayStyle === 'hover'}
            label={t('On hover')}
            desc={t('Only when you point at the line. Spares your quota.')}
            onClick={() => onPatch({ displayStyle: 'hover' })}
          />
        </div>

        {/* Three groups under small heads: 13 rows of one weight gave no sign
            of where the text settings end and the in-chat switches begin. */}
        <SettingGroup title={t('Text')}>
          <RangeRow
            label={t('Text size')}
            value={settings.translatedFontScale}
            min={0.8}
            max={1.4}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onPatch({ translatedFontScale: v })}
          />
          <RangeRow
            label={t('Line spacing')}
            value={settings.translatedLineHeight}
            min={1.2}
            max={2}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => onPatch({ translatedLineHeight: v })}
          />
          <Segmented
            label={t('Font')}
            value={settings.translatedFont}
            options={[
              { value: 'inherit', label: t("Kick's own") },
              { value: 'system', label: t('System') },
              { value: 'serif', label: t('Serif') },
              { value: 'mono', label: t('Monospace') },
              { value: 'readable', label: t('High legibility') },
            ]}
            onChange={(v) => onPatch({ translatedFont: v as Settings['translatedFont'] })}
          />

          <Segmented
            label={t('Density')}
            value={settings.translatedDensity}
            options={[
              { value: 'compact', label: t('Compact') },
              { value: 'normal', label: t('Normal') },
              { value: 'roomy', label: t('Roomy') },
            ]}
            onChange={(v) => onPatch({ translatedDensity: v as Settings['translatedDensity'] })}
          />
        </SettingGroup>

        <SettingGroup title={t('Colour and theme')}>
          {/* The dark-scheme accent values of src/shared/theme.css. */}
          <Segmented
            swatch
            label={t('Accent colour')}
            value={settings.accent}
            options={[
              { value: 'kick', label: t('Kick green'), color: 'rgb(83 252 24)' },
              { value: 'cyan', label: t('Cyan'), color: 'rgb(5 179 214)' },
              { value: 'violet', label: t('Violet'), color: 'rgb(190 146 252)' },
              { value: 'amber', label: t('Amber'), color: 'rgb(229 147 6)' },
            ]}
            onChange={(v) => onPatch({ accent: v as Settings['accent'] })}
          />
          <Segmented
            label={t('Chat theme')}
            value={settings.chatScheme}
            options={[
              { value: 'auto', label: t('Follow Kick') },
              { value: 'dark', label: t('Always dark') },
              { value: 'light', label: t('Always light') },
            ]}
            onChange={(v) => onPatch({ chatScheme: v as Settings['chatScheme'] })}
          />
        </SettingGroup>

        <SettingGroup title={t('In the chat')}>
          {/* Eteint par defaut : allume, la langue change toute seule en changeant
              de chaine, ce qui est ce qu'on veut quand on l'a demande et une
              surprise sinon. Sur une chaine inconnue rien ne bouge, sans quoi
              chaque nouvelle chaine effacerait le choix qu'on vient de faire. */}
          <ToggleRow
            checked={settings.rememberChannelLang}
            onChange={(v) => onPatch({ rememberChannelLang: v })}
            label={t('Remember a reading language per channel')}
          />
          <ToggleRow
            checked={settings.startMode === 'manual'}
            onChange={(v) => onPatch({ startMode: v ? 'manual' : 'auto' })}
            label={t('Translate a channel only after I switch it on in the bar')}
          />
          <ToggleRow
            checked={settings.showFloatingBar}
            onChange={(v) => onPatch({ showFloatingBar: v })}
            label={t('Show the floating bar at the top of chat')}
          />
          <ToggleRow
            checked={settings.showComposerChip}
            onChange={(v) => onPatch({ showComposerChip: v })}
            label={t('Show the quick language button in chat')}
          />
          <ToggleRow
            checked={settings.showOriginal}
            onChange={(v) => onPatch({ showOriginal: v })}
            label={t('Keep original text visible')}
            disabled={settings.displayStyle === 'replace'}
            hint={
              settings.displayStyle === 'replace'
                ? t('The Replace style always hides it.')
                : undefined
            }
          />
          <ToggleRow
            checked={settings.showSourceBadge}
            onChange={(v) => onPatch({ showSourceBadge: v })}
            label={t('Show source language badge')}
          />
          <ToggleRow
            checked={settings.showProviderBadge}
            onChange={(v) => onPatch({ showProviderBadge: v })}
            label={t('Show which provider was used')}
          />
        </SettingGroup>
      </section>

      <section class="kt-card space-y-3">
        <h2 class="kt-section">{t('Compose preview')}</h2>
        <p class="text-[12px] text-kick-muted">
          {t(
            'Translate what you type before sending. A live preview appears above the chat box; click it to drop the translation in. Uses the same engine and providers as incoming chat.',
          )}
        </p>
        <ToggleRow
          checked={settings.composeEnabled}
          onChange={(v) => onPatch({ composeEnabled: v })}
          label={t('Enable compose preview')}
        />
        <div class="kt-row">
          <label class="kt-label" for={composeId}>
            {t('Write my messages in')}
          </label>
          <select
            id={composeId}
            aria-label={t('Write my messages in')}
            class="kt-select"
            value={settings.composeTargetLang}
            onChange={(e) => onPatch({ composeTargetLang: (e.target as HTMLSelectElement).value })}
          >
            <option value="auto">{t("Auto (the channel's language)")}</option>
            {langs.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <p class="text-[12px] text-kick-muted">
          {t("Auto detects the channel's broadcast language from Kick. No manual picking.")}
        </p>
        <Segmented
          label={t('Clicking the preview')}
          value={settings.composeInsertMode}
          options={[
            { value: 'insert', label: t('Puts it in the chat box') },
            { value: 'copy', label: t('Copies it') },
          ]}
          onChange={(v) => onPatch({ composeInsertMode: v as Settings['composeInsertMode'] })}
        />
        {/* Tab est pris uniquement tant que l'apercu est a l'ecran, jamais sur
            une boite vide, et Shift+Tab reste libre. Ce reglage existe pour qui
            navigue au clavier et veut Tab inchange en toute circonstance :
            Ctrl/Cmd+Entree marche dans les deux cas. */}
        <Segmented
          label={t('Key that swaps in the translation')}
          value={settings.composeInsertKey}
          options={[
            { value: 'tab-and-enter', label: t('Tab or Ctrl/Cmd+Enter') },
            { value: 'ctrl-enter', label: t('Ctrl/Cmd+Enter only') },
          ]}
          onChange={(v) => onPatch({ composeInsertKey: v as Settings['composeInsertKey'] })}
        />
      </section>
    </>
  );
}

/** A made-up viewer, so nothing here reads as a real person. */
const SAMPLE_USER = 'viewer_23';
const SAMPLE_TEXT = '¿alguien más está viendo esto?';

/**
 * A fake chat line rendered by the content script's own inject(), under the
 * content script's own stylesheet. Nothing is reimplemented here on purpose: an
 * imitation would start lying the next time inject.css is touched, and the whole
 * point of this preview is to answer "what does this style actually look like".
 */
function StylePreview({ settings }: { settings: Settings }) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    ensureStyles();
    applyShowOriginal(settings.showOriginal);
    // Sans ceci l'apercu montrerait la taille d'origine pendant que le chat
    // montre celle du lecteur, et un reglage de lisibilite qu'il faut aller
    // verifier ailleurs ne sera pas regle.
    applyTypography(settings);
    // The accent is a pair of attributes on the root, and its colours only match
    // under a scheme. The options page is dark, so that is the preview's scheme:
    // "Always light" is not shown here (it would turn this whole page light).
    applyChatScheme(document.body, 'dark');
    applyAccent(settings.accent);

    el.textContent = '';
    const row = document.createElement('div');
    const who = document.createElement('span');
    who.className = 'font-bold';
    who.textContent = `${SAMPLE_USER}: `;
    const said = document.createElement('span');
    said.className = 'font-normal';
    // The sample is Spanish; in an Arabic interface the page is rtl and its
    // closing "?" jumped to the start of the line.
    said.dir = 'auto';
    said.textContent = SAMPLE_TEXT;
    row.append(who, said);
    el.appendChild(row);

    // `hover` shows nothing until you point at the line, so rendering it with
    // inject() drew a finished translation and the card described something
    // else entirely. The preview exists to answer "what does this look like",
    // and for this style the honest answer is the message, unchanged. Armed
    // rather than left bare, so the preview is the real code path.
    if (settings.displayStyle === 'hover') {
      armHoverTranslate(row, () => undefined);
      return;
    }

    inject(
      row,
      {
        messageId: 'preview',
        translatedText: t('is anyone else seeing this?'),
        detectedLang: 'es',
        provider: 'google',
        cached: false,
      },
      settings,
      () => undefined, // the retry button is part of the look; it has nothing to retry here
    );
  }, [settings, t]);

  return (
    // Sticky, not animated, so reduced motion has nothing to cut. The fill hides
    // the rows scrolling beneath it.
    <div data-kt-preview class="sticky top-0 z-10 border-b border-kick-stroke bg-kick-surface pb-2 [@media(max-height:500px)]:static">
      <div class="text-[12px] text-kick-muted mb-1">{t('Preview')}</div>
      <div ref={host} class="kt-setting text-sm" />
    </div>
  );
}

/**
 * Un curseur et sa valeur lue.
 *
 * Pas de `for`/`id` : le libelle est traduit, et un identifiant derive d'une
 * chaine arabe ou japonaise n'est pas un identifiant. aria-label porte le meme
 * texte et relie les deux sans passer par le DOM.
 *
 * onInput et non onChange : le reglage doit se voir pendant qu'on tire le
 * curseur, sinon il faut le lacher pour savoir ou on en est.
 */
/** A run of settings under a small head, set apart from the next run by space. */
function SettingGroup({ title, children }: { title: string; children: ComponentChildren }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} class="space-y-3 pt-3">
      <h3 id={id} class="kt-label">
        {title}
      </h3>
      {children}
    </div>
  );
}

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div class="kt-row-inline">
      <label class="text-sm text-kick-text" for={id}>
        {label}
      </label>
      <div class="ms-auto flex items-center gap-2">
        {/* Unstyled, a range is Chrome's blue, the only blue in the product,
            and 16 pixels tall where WCAG 2.5.8 asks for 24. */}
        <input
          type="range"
          id={id}
          class="h-6 accent-kick-primary"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          // "0.85" is what the screen reader read where the screen shows 85%.
          aria-valuetext={format(value)}
          onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        />
        <span class="text-[12px] text-kick-muted tabular-nums w-10 text-end">
          {format(value)}
        </span>
      </div>
    </div>
  );
}

function StyleCard({
  active,
  label,
  desc,
  onClick,
  recommended = false,
}: {
  active: boolean;
  label: string;
  desc: string;
  onClick: () => void;
  /** Marks the one style that is finished. The other three are still moving. */
  recommended?: boolean;
}) {
  const t = useT();
  return (
    <button
      aria-pressed={active}
      class={`text-start rounded-md border p-3 transition ${
        active
          ? 'border-kick-primary bg-kick-primary/10'
          : 'border-kick-stroke bg-kick-dark/40 hover:border-kick-stroke-strong'
      }`}
      onClick={onClick}
    >
      {/* Wraps: at 320px the badge ran out of its card over the next one. */}
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="text-sm font-semibold">{label}</span>
        {/* Not colour alone: the chosen card carries a tick. */}
        {active && (
          <svg class="h-4 w-4 text-kick-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <use href="#i-card-check" />
          </svg>
        )}
        {recommended && (
          <span class="rounded bg-kick-primary/15 px-1.5 py-0.5 text-[12px] font-semibold text-kick-primary">
            {t('recommended')}
          </span>
        )}
      </div>
      <div class="text-[12px] text-kick-muted mt-0.5">{desc}</div>
    </button>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  disabled,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div class="kt-setting">
      <Check
        checked={checked}
        onChange={onChange}
        label={label}
        disabled={disabled}
        hint={hint}
        reverse
      />
    </div>
  );
}
