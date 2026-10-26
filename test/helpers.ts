// Test environment: one fresh JSDOM per setupDom() call exposed as globals,
// fresh src/ modules per test, and no real network (fetch/XHR always mocked).
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import type { ThreadInfo } from '../src/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FC = 'https://forocoches.com/foro/';
export const THEMES = ['mobile/v1', 'mobile/v2', 'desktop/v1', 'desktop/v2'] as const;
export type ThemeDir = (typeof THEMES)[number];
export const tag = (theme: ThemeDir) => theme.replace('/', '-');

export function fixture(rel: string): string {
  return fs.readFileSync(path.join(ROOT, 'dom', rel), 'utf8');
}

export interface NetCall { api: 'fetch' | 'xhr'; url: string; method: string; body?: Record<string, string>; blocked?: boolean }
export const net = { calls: [] as NetCall[], navigations: [] as string[] };

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<unknown>;

export const blockedFetch: FetchFn = async (u) => {
  net.calls.push({ api: 'fetch', url: String(u), method: 'GET', blocked: true });
  throw new TypeError('network blocked in tests');
};

export class BlockedXHR {
  open(method: string, url: string) { net.calls.push({ api: 'xhr', method, url, blocked: true }); }
  send() { throw new Error('XHR blocked in tests'); }
  setRequestHeader() {}
}

export function setGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

// Timers created by src/ code (it uses the global setTimeout). Cleared after
// each test so a debounce or deferred run never fires into the next test.
const realSetTimeout = globalThis.setTimeout;
const realSetInterval = globalThis.setInterval;
const timers = new Set<ReturnType<typeof setTimeout>>();
const intervals = new Set<ReturnType<typeof setInterval>>();
export const sleep = (ms: number) => new Promise<void>((r) => realSetTimeout(r, ms));

function trackTimers(): void {
  setGlobal('setTimeout', (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    const id = realSetTimeout((...a: unknown[]) => { timers.delete(id); fn(...a); }, ms, ...args);
    timers.add(id);
    return id;
  });
  setGlobal('setInterval', (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    const id = realSetInterval(fn, ms, ...args);
    intervals.add(id);
    return id;
  });
}

let windows: JSDOM[] = [];
const observers = new Set<MutationObserver>();

export function resetEnvironment(): void {
  // Disconnect first: closing a window mutates its DOM and would wake them.
  observers.forEach((o) => o.disconnect());
  observers.clear();
  timers.forEach((id) => clearTimeout(id));
  intervals.forEach((id) => clearInterval(id));
  timers.clear();
  intervals.clear();
  windows.forEach((d) => d.window.close());
  windows = [];
  net.calls.length = 0;
  net.navigations.length = 0;
  setGlobal('fetch', blockedFetch);
  setGlobal('XMLHttpRequest', BlockedXHR);
  setGlobal('setTimeout', realSetTimeout);
  setGlobal('setInterval', realSetInterval);
}

const DOM_GLOBALS = ['window', 'document', 'localStorage', 'sessionStorage', 'location', 'history', 'navigator',
  'Node', 'NodeFilter', 'DOMParser', 'MutationObserver', 'HTMLElement', 'HTMLAnchorElement', 'HTMLInputElement',
  'HTMLTextAreaElement', 'HTMLIFrameElement', 'HTMLFormElement', 'Element', 'FormData', 'Blob', 'FileReader',
  'getComputedStyle', 'requestAnimationFrame', 'Event', 'MouseEvent', 'KeyboardEvent', 'CSS'];

export interface DomOptions {
  fetch?: FetchFn;
  XHR?: unknown;
  storage?: Record<string, unknown>;
}

export function setupDom(html: string, url: string, opts: DomOptions = {}): JSDOM {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e: Error) => {
    if (/navigation/i.test(String(e?.message ?? e))) net.navigations.push(String(e.message));
  });
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, virtualConsole: vc });
  windows.push(dom);
  const w = dom.window as unknown as Record<string, unknown>;
  for (const n of DOM_GLOBALS) setGlobal(n, w[n]);
  setGlobal('MutationObserver', class extends dom.window.MutationObserver {
    constructor(cb: MutationCallback) { super(cb); observers.add(this); }
  });
  // jsdom lacks layout APIs that real browsers provide
  dom.window.Element.prototype.scrollIntoView = function () {};
  setGlobal('confirm', () => true);
  setGlobal('XMLHttpRequest', opts.XHR ?? BlockedXHR);
  setGlobal('fetch', opts.fetch ?? blockedFetch);
  trackTimers();
  for (const [k, v] of Object.entries(opts.storage ?? {})) {
    dom.window.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  return dom;
}

type Responder = (url: string, init?: RequestInit) => { status?: number; body: string } | Error;
type Route = [(url: string, init?: RequestInit) => boolean, Responder];

export function mockFetch(routes: Route[]): FetchFn {
  return async (u, init) => {
    const url = String(u);
    const entry: NetCall = { api: 'fetch', url, method: init?.method ?? 'GET' };
    const body = init?.body as FormData | undefined;
    if (body && typeof body.entries === 'function') {
      entry.body = {};
      for (const [k, v] of body.entries()) entry.body[k] = String(v);
    }
    net.calls.push(entry);
    for (const [pred, resp] of routes) {
      if (!pred(url, init)) continue;
      const r = resp(url, init);
      if (r instanceof Error) throw r;
      const status = r.status ?? 200;
      return { ok: status < 400, status, text: async () => r.body, url };
    }
    net.calls[net.calls.length - 1].blocked = true;
    throw new TypeError('unmocked URL blocked: ' + url);
  };
}

// Fresh copies of the real src/ modules (module-level caches reset per test).
export async function loadApp() {
  vi.resetModules();
  return import('./app');
}
export type App = Awaited<ReturnType<typeof loadApp>>;

// ── showthread helpers ──
export const POST_SEL = 'li.postbit, div[id^="edit"]';
export const posts = () => [...document.querySelectorAll<HTMLElement>(POST_SEL)];
export const tidOf = (html: string) => (html.match(/name="t" value="(\d+)" id="qr_threadid"/) || [])[1];

// Largest ancestor that contains only this post (and its nested duplicates).
function postUnit(p: HTMLElement): HTMLElement {
  const inner = p.querySelectorAll(POST_SEL).length + 1;
  let u = p;
  while (u.parentElement && u.parentElement !== document.body && u.parentElement.querySelectorAll(POST_SEL).length <= inner) u = u.parentElement;
  return u;
}

// Simulates a page N>1: drop leading posts until the first one is not the OP's.
export function removeLeadingOPPosts(app: App, op: string): number {
  let n = 0;
  while (posts()[0] && app.findPostAuthor(posts()[0]) === op && n < 50) { postUnit(posts()[0]).remove(); n++; }
  return n;
}

export function highlightedAuthors(app: App): string[] {
  const set = new Set<string>();
  posts().forEach((p) => {
    if (p.querySelector('.fc-op-badge') || p.closest('.fc-op-highlight')) set.add(String(app.findPostAuthor(p)));
  });
  return [...set];
}

export function opOf(app: App, theme: ThemeDir): string {
  setupDom(fixture(`${theme}/showthread.html`), FC + 'showthread.php?t=1');
  app.resetAdapter();
  return app.detectAdapter().getOPAuthor(document);
}

// Counts run() invocations: each run reads the ignored-users list once.
export function countRuns(): { n: number } {
  const S = window.Storage.prototype;
  const orig = S.getItem;
  const box = { n: 0 };
  S.getItem = function (this: Storage, k: string) { if (k === 'fc_ignored_users') box.n++; return orig.call(this, k); };
  return box;
}

// ── forumdisplay helpers ──
type LinkedThread = ThreadInfo & { a: HTMLAnchorElement; container: HTMLElement };
export const threadsWithLink = (app: App) => app.findThreads().filter((t): t is LinkedThread => !!t.a && !!t.container);
