import { describe, expect, it } from 'vitest';
import {
  FC, THEMES, fixture, highlightedAuthors, loadApp, mockFetch, net, opOf, posts, removeLeadingOPPosts, setupDom, sleep, tag, tidOf,
} from './helpers';

describe.each(THEMES)('OP highlight (%s)', (theme) => {
  it(`page 1 highlights only the OP [${tag(theme)}]`, async () => {
    const app = await loadApp();
    setupDom(fixture(`${theme}/showthread.html`), FC + 'showthread.php?t=88000001');
    app.resetAdapter();
    const op = app.detectAdapter().getOPAuthor(document);
    app.highlightOPPosts();
    const hl = highlightedAuthors(app);
    expect(op).not.toBe('');
    expect(hl).toEqual([op]);
  });

  it('?p= permalink with cached OP highlights only the real OP (BUG-001)', async () => {
    const app = await loadApp();
    const op = opOf(app, theme);
    const html = fixture(`${theme}/showthread.html`);
    setupDom(html, FC + 'showthread.php?p=999999999#post999999999', {
      storage: { fc_thread_op: { [tidOf(html)]: { op, ts: 1 } } },
    });
    app.resetAdapter();
    removeLeadingOPPosts(app, op);
    expect(app.findPostAuthor(posts()[0])).not.toBe(op);
    app.highlightOPPosts();
    expect(highlightedAuthors(app).filter((a) => a !== op)).toEqual([]);
    expect(net.calls).toEqual([]);
  });

  it('?p= permalink without cache fetches page 1 once and highlights the real OP (BUG-001)', async () => {
    const app = await loadApp();
    const op = opOf(app, theme);
    const html = fixture(`${theme}/showthread.html`);
    const tid = tidOf(html);
    setupDom(html, FC + 'showthread.php?p=999999999#post999999999', {
      fetch: mockFetch([[(u) => u.endsWith('showthread.php?t=' + tid), () => ({ body: html })]]),
    });
    app.resetAdapter();
    removeLeadingOPPosts(app, op);
    const opVisible = posts().filter((p) => app.findPostAuthor(p) === op).length;
    app.highlightOPPosts();
    app.highlightOPPosts();
    expect(highlightedAuthors(app)).toEqual([]);
    await sleep(100);
    app.highlightOPPosts();
    const hl = highlightedAuthors(app);
    expect(hl.every((a) => a === op)).toBe(true);
    if (opVisible > 0) expect(hl).toContain(op);
    expect(net.calls.filter((c) => c.url.includes('showthread.php?t='))).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fc_thread_op') || '{}')[tid]?.op).toBe(op);
  });
});

describe('OP highlight on page 2', () => {
  it('cache hit (t= & page=) highlights only the real OP', async () => {
    const app = await loadApp();
    const op = opOf(app, 'desktop/v1');
    setupDom(fixture('desktop/v1/showthread.html'), FC + 'showthread.php?t=88000001&page=2', {
      storage: { fc_thread_op: { 88000001: { op, ts: 1 } } },
    });
    app.resetAdapter();
    removeLeadingOPPosts(app, op);
    app.highlightOPPosts();
    expect(highlightedAuthors(app)).toEqual([op]);
  });

  it('cache of another thread: fetches the OP and keeps both entries (BUG-002)', async () => {
    const app = await loadApp();
    const op = opOf(app, 'desktop/v1');
    const html = fixture('desktop/v1/showthread.html');
    setupDom(html, FC + 'showthread.php?t=88000001&page=2', {
      storage: { fc_thread_op: { tid: '77777777', op: 'otro_op' } },
      fetch: mockFetch([[(u) => u.endsWith('showthread.php?t=88000001'), () => ({ body: html })]]),
    });
    app.resetAdapter();
    removeLeadingOPPosts(app, op);
    app.highlightOPPosts();
    await sleep(100);
    expect(highlightedAuthors(app)).toEqual([op]);
    expect(JSON.parse(localStorage.getItem('fc_thread_op') || '{}')['88000001']?.op).toBe(op);
  });

  it('keeps entries of other threads in the cache (BUG-002)', async () => {
    const app = await loadApp();
    const op = opOf(app, 'desktop/v1');
    const html = fixture('desktop/v1/showthread.html');
    setupDom(html, FC + 'showthread.php?t=88000001&page=2', {
      storage: { fc_thread_op: { 77777777: { op: 'otro_op', ts: 1 } } },
      fetch: mockFetch([[(u) => u.endsWith('showthread.php?t=88000001'), () => ({ body: html })]]),
    });
    app.resetAdapter();
    removeLeadingOPPosts(app, op);
    app.highlightOPPosts();
    await sleep(100);
    const cache = JSON.parse(localStorage.getItem('fc_thread_op') || '{}');
    expect(Object.keys(cache).sort()).toEqual(['77777777', '88000001']);
  });

  it('failed page-1 request highlights nothing and is not retried (BUG-001)', async () => {
    const app = await loadApp();
    const op = opOf(app, 'desktop/v2');
    setupDom(fixture('desktop/v2/showthread.html'), FC + 'showthread.php?p=1#post1');
    app.resetAdapter();
    removeLeadingOPPosts(app, op);
    for (let i = 0; i < 5; i++) { app.highlightOPPosts(); await sleep(20); }
    expect(highlightedAuthors(app)).toEqual([]);
    expect(net.calls).toHaveLength(1);
  });

  it('OP cache keeps only the 200 most recent threads', async () => {
    const app = await loadApp();
    const seed: Record<string, { op: string; ts: number }> = {};
    for (let i = 1; i <= 205; i++) seed[String(i)] = { op: 'u' + i, ts: i };
    setupDom(fixture('desktop/v1/showthread.html'), FC + 'showthread.php?t=99999', { storage: { fc_thread_op: seed } });
    app.resetAdapter();
    app.highlightOPPosts();
    const cache = JSON.parse(localStorage.getItem('fc_thread_op') || '{}');
    expect(Object.keys(cache)).toHaveLength(200);
    expect(cache['99999']).toBeTruthy();
    expect(cache['1']).toBeUndefined();
    expect(cache['6']).toBeUndefined();
    expect(cache['7']).toBeTruthy();
    expect(cache['205']).toBeTruthy();
  });
});
