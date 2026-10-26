# AGENTS.md — Forocoches Premium

> [!IMPORTANT]
> Caveman mode **always**. Never revert. Never disable. Speak like caveman.

## Project

Userscript for Forocoches.com. TS + Vite 6 + vite-plugin-monkey → single `dist/forocoches-premium.user.js`. No runtime deps, no GM_* APIs (`grant: 'none'`). DOM + localStorage only.

## Commands

```bash
npm run build          # tsc --noEmit + vite → dist/forocoches-premium.user.js
npm run typecheck      # tsc --noEmit (src) + tsc -p test (tests)
npm test               # vitest run (jsdom, test/)
npm run dev            # vite build --watch (no dev server)
```

No linter, formatter. CI (`.github/workflows/ci.yml`): `npm ci` → typecheck → test → build.

## Tests

Vitest + jsdom, `test/*.test.ts`. Env `node`; `test/helpers.ts` makes own JSDOM per `setupDom(html, url)` from `dom/` fixtures, sets globals.
- `loadApp()` → fresh `src/` modules per test (`vi.resetModules`, via `test/app.ts`). Add new exports there.
- Network never real: `fetch`/`XMLHttpRequest` blocked by default, `mockFetch(routes)` per test. Calls logged in `net.calls`.
- After each test: src timers cleared, MutationObservers disconnected, windows closed (else stale observer → `run()` leaks into next test).

## Architecture

| File | Role |
|------|------|
| `src/main.ts` | Entry: init, History API/popstate nav, deferred run (1s), daily auto-sync if list empty |
| `src/runner.ts` | Page detection + Pole orchestration |
| `src/dom-adapter.ts` | Theme detection + per-theme DOM ops |
| `src/threads.ts` | Thread extraction from DOM |
| `src/hide-threads.ts` | Hide threads + highlight 0-msg |
| `src/hide-posts.ts` | Hide posts + inject Ignore buttons |
| `src/hide-ads.ts` | Ad blocking: CSS injection + DOM removal |
| `src/config.ts` | Config getters/setters |
| `src/storage.ts` | localStorage (users, words, config) |
| `src/types.ts` | TS interfaces |
| `src/ui/` | Panel UI (index + tabs) |

2 page types: `forumdisplay.php` (thread list), `showthread.php` (thread view).

## Themes (4)

1. `section.without-top-corners` → **desktop-v2**
2. `table#threadslist` → **desktop-v1**
3. `div.threads-list` or `div.postbit_wrapper` → **mobile-v2**
4. fallback → **mobile-v1**

## Config Options

localStorage `fc_config` JSON. Key bools:
- `hideThreadByAuthor` — hide threads by author
- `highlightZeroMessages` / `highlightZeroMessagesColor` — 0-msg highlight
- `showPlaceholder` — placeholder vs full hide
- `disablePostHiding` — skip post hiding
- `autoRedirectOP` / `autoReloadIgnore` — ignore UX
- `showScrollUp` / `showScrollDown` / `showPoleButton` — floating buttons
- `poleMessage` / `poleSearchPages` — Pole button config
- `blockAds` — ad blocking (incl. notices)
- `highlightOP` / `highlightOPColor` / `prioritizeHighlightOverHide` — highlights
- `threadsPerPage` — WIP virtual pagination (number, 40 = off)

All stored data validated on read/import (`storage.ts`). Debug logs: `localStorage.fc_debug = '1'` → `console.debug`.

## DOM Reference

Sanitized HTML snapshots in `dom/` (4 themes × 4 pages = 16 files). Real IDs → `999xxx` range.

| Theme | Pages |
|-------|-------|
| `dom/mobile/v1/` | forumdisplay, showthread, ignore_list, member |
| `dom/mobile/v2/` | same |
| `dom/desktop/v1/` | same |
| `dom/desktop/v2/` | same |

## Quirks

- `npm run dev` = `vite build --watch`, not dev server
- SPA nav: monkey-patched `pushState`/`replaceState` + `popstate`
- MutationObserver for dynamic content (debounced 150ms). Ignores mutations of own nodes (`OWN_SELECTOR` in `observer.ts`) — add new script-created containers there or run() loops
- `hideThreads` recomputes every run: restores `[data-fcp-hidden]`, then re-hides
- Word filter = whole-word regex on `normalizeStr` text, `*` wildcard
- OP cache `fc_thread_op` = `{tid: {op, ts}}` LRU 200. Thread id from `t=` or `#qr_threadid` (permalinks `?p=`). No cache + not page 1 → fetch page 1
- Sync with FC = merge (never drops local users); `fetchIgnoreList()` returns `null` on error
- Deferred runs: 500ms (URL change), 1s (init)
- v2 author: `"N @ username"` or `"@User - Actualizado..."` textContent
- v2 post author: `querySelectorAll` + filter non-empty textContent (1st member.php link empty)
- legacy author: `span[onclick*="member.php?u="]` or `div.asmvinfo`
- v2 ignore list: `div#ignorelist > div` (not `ul > li`)
- Pole: find 0-msg thread, fill textarea, click submit. Search up to 35 pages.
- History API patched before any user nav
- All data in `localStorage` only — no server sync
