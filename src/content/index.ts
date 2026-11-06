import type { Settings } from '~/shared/settings';
// Deliberately NOT ~/shared/settings: that module carries zod, and importing a
// value from it puts the whole schema runtime on every Kick page. See the header
// of settingsClient.ts for the measurement.
import { fetchSettings, patchSettings, watchSettings } from '~/shared/settingsClient';
import { rootLogger } from '~/shared/logger';
import { TranslationPipeline } from './pipeline';
import {
  HANDLED_SELECTOR,
  applyChatScheme,
  applyShowOriginal,
  applyDisplayStyle,
  applyTypography,
  applyAccent,
  ensureStyles,
  mountFloatingBar,
  removeAllArtifacts,
  showToast,
  unmountFloatingBar,
  updateFloatingBar,
  updateLocalChip,
  type LocalChipState,
} from './injector';
import { ChatObserver, INSTANCE } from './observer';
import { mountMetricsBridge } from './metricsBridge';
import { ComposeController } from './compose';
import { setUsageEnabled } from './usage';
import { localChipState } from './localChip';
import {
  SELECTORS,
  findChatPanel,
  findComposer,
  pickFirst,
  pickInjectionTarget,
} from './selectors';
import { extractChannelSlug, fetchChannelLangIso } from './kickApi';
import { localEngine } from './localEngine';
import { logPlatform, refresh7TV } from './platform';
import { resolveBrowserLang, withFavorite } from '~/shared/languages';
import { memoriserLangueChaine } from '~/shared/channelLang';
import { PAUSED_CHANNELS_MAX, ROUTE_POLL_MS } from '~/shared/constants';
import { msg as localised, setChatTable, setContentLocale } from './msg';
import { send } from '~/shared/messages';

/** The chat catalogue for one locale, from the worker (see i18n/codes.ts). */
async function loadChatTable(locale: string): Promise<void> {
  if (locale === 'en') return;
  const r = await send({ type: 'i18n.chat', locale }).catch(() => undefined);
  if (r?.type === 'i18n.chat') setChatTable(r.payload);
}

const log = rootLogger.child('content');

// Dev builds only (KT_DEV=1): the page asks for an extension reload, so a
// local test run can pick up a fresh build without brave://extensions.
// The page can also read which build is running (data-kt-build), so a test
// never runs against a stale one.
if (__KT_DEV__) {
  document.documentElement.dataset.ktBuild = __KT_BUILD__;
  // Read or patch settings from a test: the reply lands in data-kt-settings,
  // so a run can save the real values first and put them back after.
  window.addEventListener('kt-dev-settings', (e) => {
    const patch = (e as CustomEvent<string | undefined>).detail;
    const done = (s: unknown): void => {
      document.documentElement.dataset.ktSettings = JSON.stringify(s);
    };
    if (patch) void send({ type: 'settings.set', payload: JSON.parse(patch) }).then((r) => done(r.type === 'settings' ? r.payload : r));
    else void send({ type: 'settings.get' }).then((r) => done(r.type === 'settings' ? r.payload : r));
  });
  // Probe the catalogue path end to end: worker message, table installed, msg().
  window.addEventListener('kt-dev-locale', (e) => {
    const asked = (e as CustomEvent<string>).detail;
    void loadChatTable(setContentLocale(asked)).then(() => {
      document.documentElement.dataset.ktMsgProbe = `${asked}:${localised('barOn', 'Translating')}`;
    });
  });
  window.addEventListener('kt-dev-reload', () => {
    chrome.runtime.sendMessage('kt-dev-reload').catch((e: unknown) => {
      document.documentElement.dataset.ktReload = String(e);
    });
  });
}
/** Le nom de la copie du script qui tient la page. */
const ATTR_INSTANCE = 'data-kt-instance';
// One-shot guard so the "Kick DOM changed" warning toast shows at most once per page.
let domWarned = false;

async function main(): Promise<void> {
  // Integration builds only. `__KT_METRICS__` is the constant false in a release,
  // so esbuild folds this branch away and tree-shaking takes the module and the
  // metrics sink with it. check-strip.ts fails the build if it does not.
  if (__KT_METRICS__) mountMetricsBridge();

  // La copie la plus recente du script tient la page, et elle se nomme sur la
  // racine avant tout. Les autres s'arretent au premier tour ou elles lisent un
  // autre nom que le leur (`estOrphelin`).
  //
  // Une copie coupee par une mise a jour s'arretait deja, `chrome.runtime.id`
  // disparu. Restait une copie VIVANTE de trop, et Firefox en fait une a chaque
  // mise a jour : il injecte lui-meme le nouveau script dans les onglets ouverts,
  // ce que Chrome ne fait pas, puis `onInstalled` l'injecte une seconde fois.
  // Mesure sur la porte `mise-a-jour` en rejouant cette seconde injection : deux
  // copies prenaient chaque message, chacune le traduisait et la seconde
  // remplacait la premiere, sans rien de visible au decompte des pieces.
  document.documentElement.setAttribute(ATTR_INSTANCE, INSTANCE);

  let settings: Settings = await fetchSettings();
  setUsageEnabled(settings.usageStats);
  // Une copie plus recente s'est nommee pendant que celle-ci attendait ses
  // reglages : Firefox et `onInstalled` injectent a quelques millisecondes
  // d'intervalle. Rien n'est encore monte, il n'y a qu'a s'effacer.
  if (document.documentElement.getAttribute(ATTR_INSTANCE) !== INSTANCE) return;
  // Un predecesseur peut etre la : le script coupe par une mise a jour, dans un
  // onglet ou le service worker vient de reinjecter celui-ci. Ses pieces ont
  // perdu leurs ecouteurs, et le montage ci-dessous prendrait le bandeau pour le
  // sien. Le menu de langue, attache a la page, restait en double sous le meme id.
  for (const mort of document.querySelectorAll('#kt-floating-bar, #kt-lang-menu')) mort.remove();
  rootLogger.setEnabled(settings.debug);
  // Before anything is drawn. Every label the chat and the bar put on screen
  // reads this, and so do the language names in the chip menu.
  // Awaited: nothing is mounted yet, so the chat never shows English first.
  await loadChatTable(setContentLocale(settings.uiLang));

  ensureStyles();
  applyChatScheme(document.body, settings.chatScheme);
  applyShowOriginal(settings.showOriginal);
  applyDisplayStyle(settings.displayStyle);
  applyTypography(settings);
  applyAccent(settings.accent);

  // Kick's theme switch repaints the page without reloading it, so the stamp
  // has to follow. Watching the root's class and style attributes is enough:
  // every theme system on the site flips one of the two, and the probe is a
  // handful of getComputedStyle calls.
  const themeWatch = new MutationObserver(() =>
    applyChatScheme(document.body, settings.chatScheme),
  );
  for (const node of [document.documentElement, document.body]) {
    themeWatch.observe(node, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });
  }

  let currentSlug: string | undefined;

  /**
   * Les reglages tels que CETTE chaine les voit.
   *
   * `enabled` est l'interrupteur general, celui du popup et de la page d'options.
   * Le bouton du bandeau est une PAUSE sur un chat : il n'ecrit plus `enabled`,
   * il ajoute ou retire la chaine courante de `pausedChannels`. Avant, mettre en
   * pause sur un stream eteignait le produit sur tous les autres, dans tous les
   * onglets, et durablement.
   *
   * Tout ce qui lit `enabled` recoit cette vue : le pipeline, la composition et
   * le bandeau. Aucun de ces modules n'a eu a changer.
   */
  function vueLocale(base: Settings = settings, slug = currentSlug): Settings {
    if (!slug || !base.pausedChannels.includes(slug)) return base;
    return { ...base, enabled: false };
  }

  const pipeline = new TranslationPipeline(vueLocale());
  const compose = new ComposeController(vueLocale(), (patch) => void patchSettings(patch));

  /**
   * Vrai, une fois pour toutes, quand l'extension a ete mise a jour sous ce
   * script : `chrome.runtime.id` disparait et tout appel leve. Ou quand une copie
   * plus recente s'est nommee sur la racine. Le script s'arrete
   * alors de lui-meme, sans toucher au DOM, ou son successeur reinjecte a deja
   * pose son propre bandeau sous le meme id.
   */
  let orphelin = false;
  // Declare ici et pose plus bas : `estOrphelin` peut tourner pendant le montage,
  // avant la ligne du sondage, et un `const` y leverait.
  const sondage: { route?: ReturnType<typeof setInterval> } = {};
  function estOrphelin(): boolean {
    if (orphelin) return true;
    if (chrome.runtime?.id && document.documentElement.getAttribute(ATTR_INSTANCE) === INSTANCE)
      return false;
    orphelin = true;
    observer.stop();
    compose.stop();
    clearInterval(sondage.route);
    barWatcher?.disconnect();
    themeWatch.disconnect();
    return true;
  }

  const observer = new ChatObserver((msg) => {
    if (estOrphelin()) return;
    // Les lignes de la nouvelle chaine peuvent arriver avant que le sondage de
    // l'URL ait vu le changement, jusqu'a ROUTE_POLL_MS plus tard. Traitees avec
    // la vue de la chaine quittee, elles etaient traduites sur une chaine en
    // pause : la ligne est marquee avant d'arriver ici, donc la remise a zero du
    // sondage ne la reprenait jamais. Rattraper la route d'abord.
    if (extractChannelSlug(location.pathname) !== currentSlug) attachForRoute();
    void pipeline.onDomMessage({
      rowElement: msg.rowElement,
      injectionTarget: msg.injectionTarget,
      id: msg.id,
      text: msg.text,
      channel: currentSlug ?? '',
      username: msg.usernameGuess ?? '',
      isBot: false,
    });
  });

  // ── On-device chip state ───────────────────────────────────────────
  function computeLocalChip(): LocalChipState {
    const tgt = settings.targetLang === 'auto' ? resolveBrowserLang() : settings.targetLang;
    return localChipState(settings.localEnabled, tgt, localEngine);
  }

  function refreshChip(): void {
    updateLocalChip(computeLocalChip());
  }
  localEngine.onChange(refreshChip);

  let barPolling = false;
  function mountBar(): void {
    if (!settings.showFloatingBar) return;
    if (barPolling) return; // a host-search loop is already running
    barPolling = true;
    const tryMount = (attempt = 0): void => {
      const host = findChatPanel();
      if (host) {
        // A bar left behind in the hidden copy of the panel is not a mounted bar.
        // Drop it, otherwise the presence check below keeps reporting success while
        // the user sees nothing.
        for (const stale of document.querySelectorAll('#kt-floating-bar')) {
          if (!host.contains(stale)) stale.remove();
        }
        if (host.querySelector('#kt-floating-bar')) {
          barPolling = false;
          return;
        }
        mountFloatingBar(host, vueLocale(), {
          onToggle: (enabled) => {
            const slug = currentSlug;
            // Hors d'une chaine il n'y a rien a mettre en pause localement, donc
            // le bouton retombe sur l'interrupteur general.
            if (!slug) return void patchSettings({ enabled });
            const sansElle = settings.pausedChannels.filter((c) => c !== slug);
            void patchSettings({
              pausedChannels: enabled
                ? sansElle
                : [slug, ...sansElle].slice(0, PAUSED_CHANNELS_MAX),
            });
          },
          // Picking on the bar seeds the favourites, the same way picking in
          // the composer already did. That is the whole configuration step for
          // the flag tiles: the three or four languages someone actually
          // switches between rise to the top by being used, and nobody has to
          // go and declare them on a settings page.
          onTargetLang: (targetLang) =>
            void patchSettings({
              targetLang,
              ...(settings.rememberChannelLang && currentSlug
                ? {
                    channelLangs: memoriserLangueChaine(
                      settings.channelLangs,
                      currentSlug,
                      targetLang,
                    ),
                  }
                : {}),
              favoriteLangs:
                targetLang === 'auto'
                  ? settings.favoriteLangs
                  : withFavorite(settings.favoriteLangs, targetLang),
            }),
          onOpenOptions: () => void chrome.runtime.sendMessage({ type: 'open.options' }),
          onEnableLocal: () => {
            const tgt = settings.targetLang === 'auto' ? resolveBrowserLang() : settings.targetLang;
            const pairs = localEngine.downloadablePairs().filter((p) => p.tgt === tgt);
            void localEngine.download(pairs.length ? pairs : localEngine.downloadablePairs());
          },
        });
        refreshChip();
        barPolling = false;
        return;
      }
      if (attempt < 30) setTimeout(() => tryMount(attempt + 1), 400);
      else barPolling = false;
    };
    tryMount();
  }

  // Kick's SPA re-renders the chat subtree, which can wipe the floating bar even
  // when #channel-chatroom itself stays mounted (the message observer keeps
  // working via its own re-attach watcher, but the bar would silently vanish and
  // the user loses the on/off toggle). Re-add it whenever it goes missing.
  // Bar re-mount guard: debounce with 500ms timeout instead of rAF.
  // On a fast chat rAF fires every frame (16ms), creating noise. 500ms is calm and
  // still fast enough to re-mount the bar before the user notices.
  let barGuardTimer: ReturnType<typeof setTimeout> | undefined;
  let barWatcher: MutationObserver | undefined;
  function watchBar(): void {
    barWatcher = new MutationObserver(() => {
      if (estOrphelin()) return;
      if (barGuardTimer) return;
      barGuardTimer = setTimeout(() => {
        barGuardTimer = undefined;
        // Presence has to be asked of the panel on screen, not of the document:
        // the id survives inside the hidden copy Kick leaves behind.
        if (settings.showFloatingBar && !findChatPanel()?.querySelector('#kt-floating-bar'))
          mountBar();
      }, 500);
    });
    barWatcher.observe(document.body, { childList: true, subtree: true });
  }

  // If the chat panel is present but neither the message list nor the composer can
  // be found after a grace period, Kick almost certainly changed its DOM — surface
  // it once instead of failing silently (so the user knows to update the extension).
  function scheduleHealthCheck(slug: string): void {
    setTimeout(() => {
      if (currentSlug !== slug) return; // navigated away
      if (!document.querySelector('#channel-chatroom')) return; // no chat view at all
      const containerFound = pickFirst(document, SELECTORS.containers) !== null;
      const composerFound = findComposer() !== null;
      if (!containerFound && !composerFound && !domWarned) {
        domWarned = true;
        log.warn('chat container & composer not found — Kick DOM likely changed');
        showToast(
          localised(
            'toastChatNotFound',
            'Kick Chat Translator: chat not found. An update may be needed.',
          ),
        );
      }
    }, 12_000);
  }

  /**
   * `force` sert quand le slug n'a pas bouge mais que son verdict, si : sortir
   * la chaine courante de pause. Sans lui, la sortie anticipee sur
   * `slug === currentSlug` avalait la reprise.
   */
  function attachForRoute(force = false): void {
    const slug = extractChannelSlug(location.pathname);
    if (slug === currentSlug && !force) return;
    currentSlug = slug;
    log.debug('route change, channel slug:', slug);

    // Une chaine en pause et une qui ne l'est pas ne donnent pas le meme
    // `enabled` : le pipeline comme le bandeau doivent l'apprendre avant que la
    // premiere ligne arrive.
    const vue = vueLocale(settings, slug);
    pipeline.updateSettings(vue);
    compose.updateSettings(vue);
    updateFloatingBar(vue);

    if (!slug) {
      observer.stop();
      unmountFloatingBar();
      compose.stop();
      compose.setChannelLang(undefined);
      return;
    }

    // La langue de cette chaine, si on en connait une. Avant de monter la
    // barre, pour qu'elle s'affiche deja sur la bonne plutot que de sauter.
    const memoire = settings.rememberChannelLang ? settings.channelLangs[slug] : undefined;
    if (memoire && memoire !== settings.targetLang) void patchSettings({ targetLang: memoire });

    refresh7TV();
    logPlatform();
    observer.reset();
    observer.start();
    pipeline.reapplyBlocked();
    mountBar();
    // Compose preview self-gates on composeEnabled and finds the composer itself.
    compose.start();
    scheduleHealthCheck(slug);

    // Auto-detect the channel's chat language (Kick API) → the compose target in
    // 'auto' mode, so the user writes in the channel's language with no setup.
    void fetchChannelLangIso(slug).then((lang) => {
      compose.setChannelLang(lang);
      pipeline.setChannelLang(slug, lang);
    });
  }

  // Compose preview is independent of the incoming-translation master switch, so
  // attach the route machinery when either feature is on.
  if (settings.enabled || settings.composeEnabled) attachForRoute();
  if (settings.showFloatingBar) mountBar();
  watchBar();

  // Le changement de chaine, et pourquoi le patch qui etait ici ne pouvait pas
  // marcher.
  //
  // Il y avait deux declencheurs : un patch de `history.pushState` et un
  // ecouteur `popstate`. `popstate` ne se declenche pas sur un `pushState`, il
  // ne sert qu'au retour arriere du navigateur. Restait le patch, et un script
  // de contenu vit dans un MONDE ISOLE : son `history` est un autre objet
  // JavaScript au-dessus du meme historique, donc patcher la n'intercepte rien
  // de ce que le routeur du site appelle chez lui. Mesure depuis le monde
  // principal, celui du site : `String(history.pushState)` rend
  // `function pushState() { [native code] }`.
  //
  // Consequence, mesuree sur trois chaines visitees sans rechargement : l'API de
  // Kick n'a ete interrogee que pour la premiere, donc l'apercu de composition
  // continuait d'ecrire dans la langue d'une chaine quittee. Les traductions
  // entrantes, elles, survivaient par un autre chemin, le `containerWatcher` de
  // l'observateur, ce qui est exactement pourquoi la porte `translate-navigation`
  // etait verte sur un produit casse.
  //
  // Un sondage de l'URL n'a pas ce probleme : il ne depend d'aucun monde,
  // d'aucun evenement que le site voudrait bien emettre, et il marche pareil sur
  // Firefox, qui n'a pas d'API de navigation. `attachForRoute` compare le slug et
  // sort tout de suite quand il n'a pas bouge, donc le prix est une comparaison
  // de chaines deux fois par seconde. `popstate` reste pour que le retour arriere
  // soit immediat au lieu d'attendre le prochain tour.
  let dernierChemin = location.pathname;
  sondage.route = setInterval(() => {
    if (estOrphelin()) return;
    if (location.pathname === dernierChemin) return;
    dernierChemin = location.pathname;
    attachForRoute();
  }, ROUTE_POLL_MS);
  window.addEventListener('popstate', () => {
    if (estOrphelin()) return;
    dernierChemin = location.pathname;
    attachForRoute();
  });

  /**
   * Hand back to the observer every line it marked but never translated.
   *
   * A row is marked as soon as the observer sees it, whatever the pipeline then
   * decides, so a line that arrived while the tab was hidden keeps its mark and
   * nothing else would look at it again.
   *
   * Left alone: a line that carries an artifact, which was dealt with; a line
   * the pipeline gave a reason for (its tooltip, `markSkipped`), which would get
   * the same answer again; and a row hidden for a blocked word. What is left is
   * exactly the lines skipped for the state of the tab, which the pipeline marks
   * with an empty reason. The sweeps this replaces re-ran every line without an
   * artifact, so each return to the tab sent the whole visible chat back
   * through language detection, every English or same-language line included,
   * to reach the same verdict.
   */
  function retryUntranslated(root: ParentNode, why: string): void {
    let retried = 0;
    for (const row of root.querySelectorAll<HTMLElement>('div[data-index][data-kt-id]')) {
      if (row.style.display === 'none') continue;
      if (row.querySelector(HANDLED_SELECTOR)) continue;
      if (pickInjectionTarget(row).hasAttribute('title')) continue;
      row.removeAttribute('data-kt-id');
      retried++;
    }
    if (retried === 0) return;
    log.debug(`${why}: retrying ${retried} untranslated rows`);
    observer.reset();
    observer.start();
    pipeline.reapplyBlocked();
  }

  // Back on the tab: what arrived while it was hidden was skipped, not lost.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !vueLocale().enabled || !settings.pauseWhenHidden || estOrphelin())
      return;
    retryUntranslated(document, 'tab visible again');
  });

  // Scroll-stop: rows the reader scrolls back to that were never translated.
  //
  // Listened for on the document, in the capture phase, because scroll does
  // not bubble and the list is not a stable element: the first
  // `#channel-chatroom .no-scrollbar` on current Kick is not the message list,
  // and the list is replaced on a channel switch. The listener this replaces
  // was bound once, at startup, to that first match, and so never fired.
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener(
    'scroll',
    (e) => {
      const list = e.target instanceof Element ? e.target : null;
      if (!list?.closest('#channel-chatroom')) return;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (estOrphelin() || !vueLocale().enabled) return;
        retryUntranslated(list, 'scroll-stop');
      }, 800);
    },
    { capture: true, passive: true },
  );

  // Note: the "pause when hidden" quota guard lives in the pipeline, which reads
  // document.hidden live per message. The observer stays running (cheap when the
  // tab is hidden since translation bails immediately) — this avoids any
  // stuck-paused state from missed visibilitychange events.

  /**
   * Settings baked into a line at injection time.
   *
   * A line carries the answer that was true when it was drawn: the language it
   * was translated into, the shape it was drawn in, and which badges were on.
   * Nothing re-reads any of them afterwards, so changing one leaves every line
   * already on screen showing the previous answer until the page is reloaded.
   *
   * `showOriginal` is deliberately absent. It is applied through a class on the
   * document root, so it already follows the setting live and re-running rows for
   * it would be work with no effect.
   *
   * `uiLang` is here for exactly the reason the others are: a line's flag
   * tooltip names the source language in the reader's own language, and a line
   * left alone says why in a sentence. Both are written once, at injection.
   * Re-running is cheap, since the translations themselves come back from the
   * cache.
   */
  const RERENDER_KEYS = [
    'targetLang',
    'displayStyle',
    'showSourceBadge',
    'showProviderBadge',
    'uiLang',
  ] as const satisfies readonly (keyof Settings)[];

  /**
   * Re-run every row we already handled, for when the answer would now differ.
   *
   * The row mark (`data-kt-id`) is built from index + username + text and never
   * from any of the settings above, so a line already drawn still matches its own
   * mark and `ChatObserver.process` drops it as seen.
   *
   * Clearing the mark AND the artifact under it is what makes a row eligible
   * again; `reset()` rescans the container, the same two steps the scroll-stop
   * prefetch above already relies on.
   *
   * Only a target change costs a request. The pipeline hits the in-tab cache
   * first, keyed by text and target, so a style or badge change re-draws every
   * line from memory and reaches no engine.
   */
  function retranslateHandledRows(): void {
    const rows = document.querySelectorAll('div[data-index][data-kt-id]');
    for (const row of rows) {
      removeAllArtifacts(pickInjectionTarget(row));
      row.removeAttribute('data-kt-id');
    }
    log.debug(`display settings changed: re-running ${rows.length} rows`);
    observer.reset();
    observer.start();
    pipeline.reapplyBlocked();
  }

  watchSettings((next) => {
    // Une copie remplacee recoit encore les reglages, et sans ceci un
    // changement relancerait son observateur et son bandeau.
    if (estOrphelin()) return;
    // Le verdict qui compte est celui de la chaine courante, pas l'interrupteur
    // general : c'est lui qui decide si l'observateur tourne et ce que le
    // bandeau affiche.
    const wasEnabled = vueLocale().enabled;
    const prev = settings;
    settings = next;
    setUsageEnabled(next.usageStats);
    const vue = vueLocale(next);
    pipeline.updateSettings(vue);
    compose.updateSettings(vue);
    // Les trois reglages de lisibilite sont des proprietes sur la racine : les
    // reposer suffit, rien n'est a redessiner ligne par ligne.
    applyTypography(next);
    applyAccent(next.accent);
    applyChatScheme(document.body, next.chatScheme);
    rootLogger.setEnabled(next.debug);
    // Ahead of everything that redraws below, so the bar and the chip come back
    // in the language that was just chosen rather than one change late.
    void loadChatTable(setContentLocale(next.uiLang));
    updateFloatingBar(vue);
    applyShowOriginal(next.showOriginal);
    applyDisplayStyle(next.displayStyle);
    refreshChip();

    // Ordered after updateSettings on purpose: the rows are re-run through the
    // pipeline, which must already hold the new settings when they arrive.
    if (vue.enabled && RERENDER_KEYS.some((k) => prev[k] !== next[k])) retranslateHandledRows();

    if (vue.enabled && !wasEnabled) attachForRoute(true);
    if (!vue.enabled && wasEnabled) {
      observer.stop();
    }
    if (next.showFloatingBar) mountBar();
    else unmountFloatingBar();
  });

  // The Debug tab lives in the options page, another context entirely, and the
  // decisions are made here. It asks, we answer: no subscription, no polling,
  // and nothing leaves this page unless someone opens that tab.
  chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
    if (msg?.type !== 'debug.decisions' || estOrphelin()) return false;
    sendResponse({ type: 'debug.decisions', payload: pipeline.recentDecisions() });
    return false;
  });

  log.info('Content script ready');
}

void main().catch((err: unknown) => {
  console.error('[KickTranslator] init error', err);
});
