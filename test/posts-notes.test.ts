import { describe, expect, it } from 'vitest';
import { FC, THEMES, fixture, loadApp, posts, setupDom, sleep, threadsWithLink } from './helpers';

describe.each(THEMES)('showthread features (%s)', (theme) => {
  it('adds Ignore buttons and notes, hides an ignored author', async () => {
    const app = await loadApp();
    setupDom(fixture(`${theme}/showthread.html`), FC + 'showthread.php?t=88000001');
    app.resetAdapter();
    const op = app.detectAdapter().getOPAuthor(document);
    const target = posts().map((p) => app.findPostAuthor(p)).find((a) => a && a !== op);
    expect(target).toBeTruthy();
    app.addIgnorePostButtons();
    app.injectPostNotes();
    expect(document.querySelectorAll('.fc-ignore-btn').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.fc-note').length).toBeGreaterThan(0);
    app.hidePosts([target!]);
    const hidden = posts().filter((p) => p.style.display === 'none' || /Mensaje de usuario ignorado/.test(p.textContent || ''));
    expect(hidden.length).toBeGreaterThanOrEqual(1);
  });
});

describe('User notes', () => {
  it('names matching Object.prototype keys are plain notes (BUG-010)', async () => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php');
    expect(app.getNote('constructor')).toBe('');
    app.saveUserNote('__proto__', 'nota');
    expect(app.getNote('__proto__')).toBe('nota');
  });

  it('notes are saved case-insensitively, read and deleted (BUG-010)', async () => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php');
    app.saveUserNote('Pepe', 'majo');
    app.saveUserNote('constructor', 'c');
    expect(app.getNote('pepe')).toBe('majo');
    expect(app.getNote('constructor')).toBe('c');
    app.saveUserNote('pepe', '');
    expect(app.getNote('pepe')).toBe('');
  });

  function instrumentClickListeners() {
    const active = new Set<unknown>();
    const counts = { added: 0, removed: 0 };
    const oa = document.addEventListener.bind(document);
    const orm = document.removeEventListener.bind(document);
    document.addEventListener = ((t: string, f: EventListener, o?: AddEventListenerOptions) => {
      if (t === 'click') { counts.added++; active.add(f); }
      return oa(t, f, o);
    }) as typeof document.addEventListener;
    document.removeEventListener = ((t: string, f: EventListener, o?: EventListenerOptions) => {
      if (t === 'click') { counts.removed++; active.delete(f); }
      return orm(t, f, o);
    }) as typeof document.removeEventListener;
    return { active, counts };
  }

  it('closing the popup removes its click-outside listener (PERF-003)', async () => {
    const app = await loadApp();
    setupDom(fixture('desktop/v1/showthread.html'), FC + 'showthread.php?t=88000001');
    app.resetAdapter();
    app.injectPostNotes();
    const { active } = instrumentClickListeners();
    const w = document.querySelector('.fc-note')!;
    for (let i = 0; i < 20; i++) {
      w.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(5);
      document.querySelector('#fc-note-popup button[title="Cerrar"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    expect(active.size).toBe(0);
  });

  it('closing with Escape or immediately leaves no listeners (PERF-003)', async () => {
    const app = await loadApp();
    setupDom(fixture('desktop/v1/showthread.html'), FC + 'showthread.php?t=1');
    app.resetAdapter();
    app.injectPostNotes();
    const { active } = instrumentClickListeners();
    const w = document.querySelector('.fc-note')!;
    for (let i = 0; i < 5; i++) {
      w.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(5);
      document.querySelector('#fc-note-popup textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    for (let i = 0; i < 5; i++) {
      w.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.querySelector('#fc-note-popup button[title="Cerrar"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(5);
    }
    expect(active.size).toBe(0);
    expect(document.getElementById('fc-note-popup')).toBeNull();
  });
});

describe('Escaping (INFO-001)', () => {
  it('names and titles containing HTML are rendered as text', async () => {
    const payload = '<img src=x onerror=window.__x=1>';
    const app = await loadApp();
    setupDom(fixture('mobile/v2/showthread.html'), FC + 'showthread.php?t=88000001');
    app.resetAdapter();
    const a = [...document.querySelectorAll('a[href*="member.php?u="]')].find((x) => x.textContent!.trim())!;
    a.textContent = payload;
    app.addIgnorePostButtons();
    app.injectPostNotes();
    document.querySelector('.fc-ignore-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.querySelector('.fc-note')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(50);
    expect(document.querySelectorAll('img[onerror*="__x"]')).toHaveLength(0);

    setupDom(fixture('desktop/v1/forumdisplay.html'), FC + 'forumdisplay.php?f=2');
    app.resetAdapter();
    threadsWithLink(app)[0].a.textContent = 'zzz ' + payload;
    app.hideThreads([], ['zzz']);
    expect(document.querySelectorAll('img[onerror*="__x"]')).toHaveLength(0);
    expect(document.getElementById('fc-hidden-summary')?.textContent).toContain('<img');
  });
});
