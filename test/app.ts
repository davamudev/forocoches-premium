// Re-exports the real src/ modules under test. main.ts is left out: it auto-runs init().
export { run } from '../src/runner';
export { detectAdapter, resetAdapter } from '../src/dom-adapter';
export { findThreads } from '../src/threads';
export { hideThreads } from '../src/hide-threads';
export { hidePosts, addIgnorePostButtons, highlightOPPosts, findPostAuthor } from '../src/hide-posts';
export { injectPostNotes, getNote, saveUserNote, getUserNotes } from '../src/user-notes';
export { fetchProfileForIgnore, fetchIgnoreList } from '../src/fc-api';
export { syncIgnored, addToFCIgnore } from '../src/ignore-fc';
export { getUsers, saveUsers, getWords, saveWords, getConfig, saveConfig, importData, exportData } from '../src/storage';
export { getPoleMessage, setHighlightOP } from '../src/config';
export { normalizeStr, cleanUser } from '../src/utils';
export { startObserver } from '../src/observer';
export { enhancePagination } from '../src/pagination';
export * as presets from '../src/ui/presets';
