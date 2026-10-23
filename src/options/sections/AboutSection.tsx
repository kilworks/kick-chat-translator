import { useEffect, useState } from 'preact/hooks';
import type { ProviderStatus, UsageStats } from '~/shared/types';
import { useT } from '~/shared/i18nContext';
import { LANGUAGES } from '~/shared/languages';
import type { Settings } from '~/shared/settings';
import { Check } from '../components/Check';

const estFirefox = (): boolean => {
  try {
    return chrome.runtime.getURL('').startsWith('moz-extension:');
  } catch {
    return false;
  }
};

/**
 * Ce que cette copie de l'extension est, et ce qu'elle fait chez toi.
 *
 * L'ancienne version decrivait une extension qui n'existe plus : elle parlait
 * de traduire les messages "non-English", d'un seul sens de lecture, et
 * s'arretait la. Depuis, il y a 43 langues, un moteur embarque, la traduction
 * de ce qu'on ecrit, et rien de tout cela n'y figurait.
 *
 * Elle ne portait pas non plus sa version, alors que c'est la premiere chose
 * qu'on vient chercher ici quand on signale un probleme, et le numero affiche
 * en haut de la page vient du manifeste, pas d'ici.
 */
export function AboutSection({
  stats,
  providers,
  settings,
  onPatch,
}: {
  stats?: UsageStats;
  providers?: ProviderStatus[];
  settings?: Settings;
  onPatch?: (p: Partial<Settings>) => void;
}) {
  const t = useT();
  const [version, setVersion] = useState('');
  // Firefox decide par sa propre permission de collecte ; avant Firefox 140 elle
  // n'existe pas et rien n'est envoye, donc l'interrupteur n'a rien a regler.
  const [statsOffered, setStatsOffered] = useState(!estFirefox());

  useEffect(() => {
    try {
      setVersion(chrome.runtime.getManifest().version);
    } catch {
      // Hors extension, par exemple dans un banc de rendu.
    }
    if (estFirefox()) {
      void chrome.permissions
        .getAll()
        .then((p) => setStatsOffered((p as { data_collection?: string[] }).data_collection !== undefined))
        .catch(() => setStatsOffered(false));
    }
  }, []);

  async function changerStats(on: boolean): Promise<void> {
    if (estFirefox()) {
      const p = { data_collection: ['technicalAndInteraction'] } as unknown as chrome.permissions.Permissions;
      const ok = on ? await chrome.permissions.request(p) : await chrome.permissions.remove(p);
      if (!ok) return;
    }
    onPatch?.({ usageStats: on, usageStatsAsked: true });
  }

  const dispo = (providers ?? []).filter((p) => p.available);
  const langues = LANGUAGES.length;

  return (
    <>
      <section class="kt-card-lead space-y-4">
        <div>
          <h2 class="kt-section mb-1">{t('About')}</h2>
          <p class="text-sm leading-relaxed text-kick-muted">
            {t(
              'Kick Chat Translator reads chat as it arrives and puts a translation under each message in the language you read. It also translates what you type before you send it. No account, no tracking, open source.',
            )}
          </p>
        </div>

        {/* L'etat de CETTE copie. Une page "a propos" qui ne dit pas sa version
            oblige a aller la chercher dans chrome://extensions au moment ou on
            veut signaler un probleme. */}
        <dl class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Fait terme={t('Version')} valeur={version || '—'} />
          <Fait terme={t('Languages')} valeur={String(langues)} />
          <Fait
            terme={t('Providers ready')}
            valeur={providers === undefined ? '—' : `${dispo.length}/${providers.length}`}
          />
          <Fait
            terme={t('Messages translated')}
            valeur={stats ? stats.totalRequests.toLocaleString() : '—'}
          />
        </dl>
      </section>

      <section class="kt-card space-y-3">
        <h3 class="kt-section">{t('How a message becomes a translation')}</h3>
        {/* Reecrit sur le chemin reel. L'ancienne liste sautait la detection de
            langue, qui est l'etape qui decide de tout le reste : c'est elle qui
            dit a quel moteur envoyer, et c'est elle qui decide si un message est
            saute parce qu'il est deja dans ta langue. */}
        <ol class="list-inside list-decimal space-y-2 text-sm text-kick-muted">
          <li>{t('The message is read from the page, emotes and links set aside.')}</li>
          <li>
            {t(
              'Its language is worked out on the spot, from the script and the words it uses. This answer decides everything after it.',
            )}
          </li>
          <li>
            {t(
              'Filters run: already in your language, too short, a bot, a language you did not pick.',
            )}
          </li>
          <li>{t('The cache is asked first, so the same message is never paid for twice.')}</li>
          <li>
            {t(
              'Otherwise the first available provider in your chain answers, or the on-device engine if you enabled it.',
            )}
          </li>
        </ol>
        <p class="kt-hint">{t('The Activity tab shows what each of these steps did for you.')}</p>
      </section>

      {settings && statsOffered && (
        <section class="kt-card space-y-3">
          <div class="kt-setting">
            <Check
              checked={settings.usageStats}
              onChange={(v) => void changerStats(v)}
              label={t('Share anonymous usage statistics')}
              hint={t(
                'Once a day, anonymous counts: engines used, errors, speed. Never your messages, names or channels.',
              )}
              reverse
            />
          </div>
        </section>
      )}

      <section class="kt-card space-y-3">
        <h3 class="kt-section">{t('Links')}</h3>
        <ul class="space-y-2 text-sm">
          <Lien
            href="https://github.com/Pkkls/kick-chat-translator/blob/master/CHANGELOG.md"
            label={t('What changed in this version')}
          />
          <Lien
            href="https://github.com/Pkkls/kick-chat-translator"
            label={t('GitHub repository')}
          />
          <Lien
            href="https://github.com/Pkkls/kick-chat-translator/blob/master/PRIVACY.md"
            label={t('Privacy policy')}
          />
          <Lien
            href="https://github.com/Pkkls/kick-chat-translator/issues"
            label={t('Report an issue')}
          />
          {/* Nom propre, pas de cle i18n : le meme projet pour Twitch. */}
          <Lien
            href="https://github.com/kilworks/twitch-chat-translator"
            label="Twitch Chat Translator"
          />
        </ul>
      </section>
    </>
  );
}

function Fait({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div>
      <dt class="text-[11px] text-kick-muted">{terme}</dt>
      <dd class="mt-0.5 text-lg font-semibold tabular-nums leading-none text-kick-text">
        {valeur}
      </dd>
    </div>
  );
}

function Lien({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <a
        class="kt-link-target text-kick-primary underline"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
    </li>
  );
}
