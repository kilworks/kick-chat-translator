import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

const isFirefox = process.env.BROWSER === 'firefox';

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  short_name: 'Kick Translator',
  version: pkg.version,
  // The name and blurb both stores show in SEARCH RESULTS, served in the
  // reader's browser language from public/_locales. Organic search is where 60%
  // of new users come from, and a Turkish reader looking for "sohbet çevirici"
  // never matches an English sentence. The name keeps the brand first, "Kick" is
  // the query people actually type, then adds the generic query of each
  // language, from store/keywords.json.
  //
  // The English message must stay in step with `description` in package.json,
  // which is what npm and the repo show. locales.test.ts asserts they match.
  default_locale: 'en',
  description: '__MSG_extDescription__',
  icons: {
    16: 'public/icons/icon16.png',
    32: 'public/icons/icon32.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'public/icons/icon16.png',
      32: 'public/icons/icon32.png',
    },
    default_title: 'Kick Chat Translator',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: isFirefox
    ? ({ scripts: ['src/background/index.ts'], type: 'module' } as unknown as { service_worker: string })
    : { service_worker: 'src/background/index.ts', type: 'module' },
  content_scripts: [
    {
      matches: ['https://kick.com/*', 'https://www.kick.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  // DEUX ET PAS QUATRE. Chrome accepte quatre raccourcis suggeres, et chacun
  // pris est un raccourci retire au navigateur et aux autres extensions. Ces
  // deux-la sont les seuls gestes qu'on veut faire sans quitter le champ de
  // saisie pendant qu'un direct defile ; le reste se regle sur une page qu'on
  // ouvre une fois. Alt plutot que Ctrl ou Cmd : Ctrl+T ouvre un onglet et
  // Cmd+W ferme la fenetre, et un raccourci qui se dispute avec le navigateur
  // est un raccourci que personne ne garde.
  commands: {
    'toggle-translation': {
      suggested_key: { default: 'Alt+T' },
      description: 'Turn chat translation on or off',
    },
    'toggle-compose': {
      suggested_key: { default: 'Alt+W' },
      description: 'Turn the compose preview on or off',
    },
  },
  // `scripting` : reinjecter le script de contenu dans les onglets Kick deja
  // ouverts a l'installation et a chaque mise a jour. Sans lui, une mise a jour
  // laissait chaque onglet ouvert muet jusqu'a un rechargement que rien ne
  // demandait. Pas d'avertissement de plus : l'acces a kick.com est deja accorde.
  permissions: ['storage', 'alarms', 'scripting'],
  host_permissions: [
    'https://kick.com/*',
    'https://translate.googleapis.com/*',
    'https://api-free.deepl.com/*',
    'https://api.deepl.com/*',
    'https://api.mymemory.translated.net/*',
    'https://lingva.lunar.icu/*',
  ],
  // Aucune ressource exposee aux pages du site. Le script de contenu est
  // re-bundle en un seul fichier autonome par `scripts/bundle-content.ts`, la
  // feuille de style y est inline par `?inline`, et ses 22 `url()` sont des SVG
  // `data:`. Mesure du 2026-08-30 sur le bundle construit : zero `getURL`, zero
  // `chrome-extension`, zero import dynamique, zero reference a une icone. Rien
  // n'etait donc joignable pour une raison. Ce qui restait listé donnait a
  // n'importe quel script d'une page kick.com une URL stable a interroger pour
  // confirmer que l'extension est installee.
  ...(isFirefox && {
    browser_specific_settings: {
      gecko: {
        id: 'kick-translator@pkkls.dev',
        // FF 121+ : ES-module background scripts (`background.type: module`) and
        // storage.session both require it.
        strict_min_version: '121.0',
        // Required by AMO for new submissions/versions. The extension transmits chat
        // message text (website content) to the user-selected translation provider —
        // nothing else; no analytics, no accounts. On-device mode transmits nothing.
        // technicalAndInteraction: the opt-in daily usage statistics
        // (src/shared/usage.ts). Mozilla requires it optional, and the install
        // prompt shows it as a choice the user can leave unticked.
        data_collection_permissions: { required: ['websiteContent'], optional: ['technicalAndInteraction'] },
      },
    },
  }),
} as Parameters<typeof defineManifest>[0]);
