import { describe, expect, it } from 'vitest';
import { FC, countRuns, fixture, loadApp, mockFetch, net, setupDom, sleep, threadsWithLink } from './helpers';

describe('MutationObserver', () => {
  it('forumdisplay without threads does not loop run() (PERF-001)', async () => {
    const app = await loadApp();
    setupDom('<html><head></head><body><div id="main">Este foro no tiene temas</div></body></html>', FC + 'forumdisplay.php?f=2');
    app.resetAdapter();
    const runs = countRuns();
    // init() sequence: run(); startObserver(); deferred run()
    app.run(); app.startObserver(); app.run();
    await sleep(1500);
    expect(runs.n).toBeLessThanOrEqual(3);
  });

  it('forumdisplay with hidden threads settles', async () => {
    const app = await loadApp();
    setupDom(fixture('desktop/v1/forumdisplay.html'), FC + 'forumdisplay.php?f=2', { storage: { fc_ignored_words: ['zzzuno'] } });
    app.resetAdapter();
    threadsWithLink(app)[0].a.textContent = 'zzzuno';
    const runs = countRuns();
    app.run(); app.startObserver(); app.run();
    await sleep(1500);
    expect(runs.n).toBeLessThanOrEqual(6);
  });

  it('stays stable and still filters threads FC inserts later (PERF-001, BUG-008)', async () => {
    const app = await loadApp();
    setupDom(fixture('desktop/v1/forumdisplay.html'), FC + 'forumdisplay.php?f=2');
    app.resetAdapter();
    app.run(); // ad blocker removes promo rows first
    const th = threadsWithLink(app);
    th[0].a.textContent = 'zzzuno';
    th[1].a.textContent = 'zzzuno bis';
    localStorage.setItem('fc_ignored_words', JSON.stringify(['zzzuno', 'zzznuevo']));
    const runs = countRuns();
    app.run(); app.startObserver(); app.run();
    await sleep(1500);
    const settled = runs.n;
    expect(settled).toBeLessThanOrEqual(3);

    // FC inserts a new thread row (e.g. AJAX): filtered without reload
    const row = th[2].container.cloneNode(true) as HTMLElement;
    const link = row.querySelector('a[id^="thread_title_"]')!;
    link.textContent = 'zzznuevo';
    link.setAttribute('href', 'showthread.php?t=123456789');
    th[2].container.parentNode!.appendChild(row);
    await sleep(600);
    expect(runs.n - settled).toBeLessThanOrEqual(2);
    expect(row.style.display).toBe('none');
    expect(document.querySelectorAll('#fc-hidden-summary > div').length - 1).toBe(3);
  });
});

describe('Virtual pagination (threadsPerPage = 80)', () => {
  it('one async request, threads appended and filtered, thread links untouched (PERF-002, BUG-009)', async () => {
    const app = await loadApp();
    const html = fixture('desktop/v1/forumdisplay.html');
    let page2 = html.replace(/t=(\d+)/g, 't=9$1').replace(/thread_title_(\d+)/g, 'thread_title_9$1');
    page2 = page2.replace(/(id="thread_title_9\d+"[^>]*>)([^<]*)/, '$1zzzpagina2');
    setupDom(html, FC + 'forumdisplay.php?f=2', {
      storage: { fc_config: { threadsPerPage: 80 }, fc_ignored_words: ['zzzpagina2'] },
      fetch: mockFetch([[(u) => /forumdisplay\.php\?f=2&page=2$/.test(u), () => ({ body: page2 })]]),
    });
    app.resetAdapter();
    const sig = (a: Element) => a.getAttribute('href') + '|' + a.textContent!.trim();
    const before = [...document.querySelectorAll('a[href*="showthread.php"][href*="page="]')].map((a) => ({ a, s: sig(a) }));
    const nBefore = app.findThreads().length;

    app.run(); app.startObserver(); app.run();
    await sleep(2000);

    // no synchronous XHR (BlockedXHR records any use), exactly one fetch
    expect(net.calls.filter((c) => c.api === 'xhr')).toEqual([]);
    expect(net.calls.filter((c) => c.url.includes('forumdisplay.php'))).toHaveLength(1);
    expect(app.findThreads().length).toBeGreaterThanOrEqual(nBefore + 35);
    // links removed together with ad rows are not pagination's doing; connected ones must be untouched
    expect(before.filter((x) => x.a.isConnected && sig(x.a) !== x.s)).toEqual([]);
    const forumPages = [...document.querySelectorAll<HTMLAnchorElement>('a[href*="forumdisplay.php"][href*="page="]')]
      .map((a) => +(a.href.match(/page=(\d+)/) || [0, 0])[1]);
    expect(Math.max(...forumPages)).toBe(37);
    const p2 = [...document.querySelectorAll('a[id^="thread_title_9"]')].find((a) => a.textContent === 'zzzpagina2');
    expect(p2).toBeTruthy();
    expect(app.findThreads().find((t) => t.a === p2)?.container?.style.display).toBe('none');
  });
});

describe('Author regex cost', () => {
  it('pathological input stays fast (no ReDoS)', async () => {
    const app = await loadApp();
    setupDom('<html><body><section><div id="c"></div></section></body></html>', FC + 'forumdisplay.php?f=2');
    const c = document.getElementById('c')!;
    app.resetAdapter();
    const ad = app.detectAdapter();
    c.textContent = '@' + 'a.'.repeat(100000) + ' -';
    let t0 = performance.now();
    ad.getThreadAuthor(c, null, '');
    expect(performance.now() - t0).toBeLessThan(200);
    c.textContent = ('@a' + ' '.repeat(20)).repeat(5000);
    t0 = performance.now();
    ad.getThreadAuthor(c, null, '');
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
