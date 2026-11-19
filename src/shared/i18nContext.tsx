import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { TFunc } from './i18n';

/** Identity by default so a component used outside a provider still renders English. */
const TContext = createContext<TFunc>((key) => key);

export const I18nProvider = TContext.Provider;

/** Translate hook: `const t = useT();` then `t('Cloud engines')`. */
export function useT(): TFunc {
  return useContext(TContext);
}
