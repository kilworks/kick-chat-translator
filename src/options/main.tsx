import { render } from 'preact';
import { App } from './App';
import { loadUiMessages, resolveUiLocale } from '~/shared/i18n';
import { send } from '~/shared/messages';
import './styles.css';

// The interface language's catalogue first, so the first paint is already in
// it: the chosen one, and the browser's for the frame before settings arrive.
async function start(): Promise<void> {
  const res = await send({ type: 'settings.get' }).catch(() => undefined);
  const uiLang = res?.type === 'settings' ? res.payload.uiLang : undefined;
  await Promise.all([loadUiMessages(resolveUiLocale(uiLang)), loadUiMessages(resolveUiLocale('auto'))]).catch(
    () => undefined,
  );
  const root = document.getElementById('root');
  if (root) render(<App />, root);
}
void start();
