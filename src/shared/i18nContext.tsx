import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { loadUiMessages, type TFunc, type UiLocale } from './i18n';

/** Identity by default so a component used outside a provider still renders English. */
const TContext = createContext<TFunc>((key) => key);

export const I18nProvider = TContext.Provider;

/**
 * The locale a page shows: the one asked for, once its catalogue has loaded.
 * Until then the page stays in the language it had, rather than falling back
 * to English for a frame. main.tsx loads the first one before rendering.
 */
export function useLoadedLocale(wanted: UiLocale): UiLocale {
  const [shown, setShown] = useState(wanted);
  useEffect(() => {
    let live = true;
    void loadUiMessages(wanted)
      .catch(() => undefined)
      .then(() => live && setShown(wanted));
    return () => {
      live = false;
    };
  }, [wanted]);
  return shown;
}

/** Translate hook: `const t = useT();` then `t('Cloud engines')`. */
export function useT(): TFunc {
  return useContext(TContext);
}
