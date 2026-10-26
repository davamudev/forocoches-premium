import { describe, expect, it } from 'vitest';
import { FC, fixture, loadApp, setupDom, sleep } from './helpers';

describe('Pole (SEC-001)', () => {
  function preventSubmit() {
    let clicked = 0;
    document.querySelectorAll('input[type="submit"], button[type="submit"]')
      .forEach((b) => b.addEventListener('click', (e) => { clicked++; e.preventDefault(); }));
    return () => clicked;
  }
  const editorBody = () => (document.getElementById('vB_Editor_QR_iframe') as HTMLIFrameElement).contentDocument!.body;

  it('imported pole message reaches the editor as text, not HTML', async () => {
    const app = await loadApp();
    setupDom(fixture('desktop/v2/showthread.html'), FC + 'showthread.php?t=88000001');
    app.resetAdapter();
    const payload = '<img src="x" onerror="window.parent.__fcpXss=1">';
    expect(app.importData(JSON.stringify({ fc_config: { poleMessage: payload } }))).toBe(true);
    localStorage.setItem('fc_pole_msg', app.getPoleMessage()); // same as the Pole button
    preventSubmit();
    app.run();
    await sleep(300);
    expect(editorBody().querySelector('img')).toBeNull();
  });

  it('multiline message: literal text with <br>, no HTML elements', async () => {
    const app = await loadApp();
    setupDom(fixture('desktop/v2/showthread.html'), FC + 'showthread.php?t=1');
    app.resetAdapter();
    localStorage.setItem('fc_pole_msg', 'Pole!\n<b>negrita</b> & más');
    preventSubmit();
    app.run();
    await sleep(100);
    const body = editorBody();
    expect(body.querySelector('b')).toBeNull();
    expect(body.querySelectorAll('br')).toHaveLength(1);
    expect(body.textContent).toBe('Pole!<b>negrita</b> & más');
  });
});

describe('Import / storage validation (BUG-007)', () => {
  it('rejects structurally invalid imports and still persists config', async () => {
    const app = await loadApp();
    setupDom(fixture('desktop/v1/forumdisplay.html'), FC + 'forumdisplay.php?f=2');
    app.resetAdapter();
    expect(app.importData(JSON.stringify({ fc_hl_word_groups: [{ id: 'g', desc: '', color: '#fff', items: null }] }))).toBe(false);
    expect(() => app.hideThreads([], [])).not.toThrow();
    expect(app.importData(JSON.stringify({ fc_config: [] }))).toBe(false);
    app.setHighlightOP(false);
    expect(localStorage.getItem('fc_config')).toMatch(/highlightOP/);
  });

  it('export → import round-trips valid data', async () => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php', {
      storage: {
        fc_ignored_users: ['a', 'b'], fc_ignored_words: ['x'],
        fc_config: { highlightOP: false, poleMessage: 'hola', threadsPerPage: 80, highlightOPColor: '#fff' },
        fc_hl_user_groups: [{ id: '1', desc: 'd', color: '#f00', items: ['a'] }],
        fc_hl_word_groups: [{ id: '2', desc: '', color: '#0f0', items: ['y'] }],
        fc_user_notes: { a: 'nota' },
      },
    });
    const exported = app.exportData();
    localStorage.clear();
    expect(app.importData(exported)).toBe(true);
    expect(JSON.parse(app.exportData())).toEqual(JSON.parse(exported));
  });

  it('an import with one invalid key writes nothing', async () => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php', { storage: { fc_ignored_words: ['original'] } });
    expect(app.importData(JSON.stringify({ fc_ignored_words: ['nueva'], fc_user_notes: { a: 1 } }))).toBe(false);
    expect(app.importData(JSON.stringify({ otra_cosa: 1 }))).toBe(false);
    expect(app.getWords()).toEqual(['original']);
  });

  it('corrupt stored data is sanitized on read', async () => {
    const app = await loadApp();
    setupDom(fixture('desktop/v1/forumdisplay.html'), FC + 'forumdisplay.php?f=2', {
      storage: {
        fc_config: { highlightOP: 'no', poleMessage: 5, threadsPerPage: 80, blockAds: false },
        fc_hl_word_groups: [{ id: 'g', color: '#fff', items: null }, { id: 'h', color: '#fff', items: ['ok'] }],
        fc_ignored_words: ['a', 3, null],
      },
    });
    app.resetAdapter();
    expect(() => app.hideThreads([], app.getWords())).not.toThrow();
    expect(app.getConfig()).toEqual({ threadsPerPage: 80, blockAds: false });
    expect(app.getWords()).toEqual(['a']);
  });
});
