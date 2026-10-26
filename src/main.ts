import { log } from './toast';
import { buildUI } from './ui/index';
import { run } from './runner';
import { startObserver } from './observer';
import { syncIgnored } from './ignore-fc';
import { getUsers } from './storage';
import { resetAdapter } from './dom-adapter';

declare const __FC_VERSION__: string;
const FCVERSION = __FC_VERSION__;
const FCAUTHOR = 'skjolberg';
const TELEGRAM = '@x265Always';

let lastUrl = window.location.href;

const KEY_LAST_AUTO_SYNC = 'fc_last_auto_sync';
const AUTO_SYNC_INTERVAL = 24 * 3600 * 1000;

// Empty local list → pull from FC at most once a day, not on every page load
function shouldAutoSync(): boolean {
  try {
    const last = Number(localStorage.getItem(KEY_LAST_AUTO_SYNC) || 0);
    if (Date.now() - last < AUTO_SYNC_INTERVAL) return false;
    localStorage.setItem(KEY_LAST_AUTO_SYNC, String(Date.now()));
  } catch (_) { /* ignore */ }
  return true;
}

function handleUrlChange(): void {
  if (window.location.href !== lastUrl) {
    log('NAVEGACION', `URL cambio: ${lastUrl} -> ${window.location.href}`);
    lastUrl = window.location.href;
    resetAdapter();
    startObserver();
    setTimeout(run, 500);
  }
}

// Monkey-patch history API to detect SPA navigation
function patchHistory(): void {
  const origPushState = history.pushState.bind(history);
  const origReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    origPushState.apply(this, args);
    handleUrlChange();
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    origReplaceState.apply(this, args);
    handleUrlChange();
  };
}

function init(): void {
  log('INIT', `FC Premium v${FCVERSION} by ${FCAUTHOR}`, `Telegram: ${TELEGRAM}`, `URL: ${window.location.href}`, `Path: ${window.location.pathname}`);
  buildUI();
  run();
  startObserver();
  if (getUsers().length === 0 && shouldAutoSync()) {
    log('INIT', 'Lista de usuarios vacia, sincronizando con FC...');
    syncIgnored(true);
  }
  // Detect URL changes via popstate (back/forward) and pushState/replaceState (SPA)
  window.addEventListener('popstate', handleUrlChange);
  patchHistory();

  // Deferred run to catch late-rendered content
  setTimeout(() => { log('INIT', 'Run diferido 1s'); run(); }, 1000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
