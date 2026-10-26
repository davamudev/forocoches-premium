import { describe, expect, it } from 'vitest';
import { FC, THEMES, fixture, loadApp, setupDom, threadsWithLink } from './helpers';

const PAGES = ['forumdisplay', 'showthread', 'member', 'ignore_list'];

describe('Theme detection', () => {
  it.each(THEMES.flatMap((t) => PAGES.map((p) => [t, p] as const)))('%s/%s (INFO-004)', async (theme, page) => {
    const app = await loadApp();
    setupDom(fixture(`${theme}/${page}.html`), FC + page + '.php');
    app.resetAdapter();
    expect(app.detectAdapter().theme).toBe(theme.replace('/', '-'));
  });
});

describe('Thread authors', () => {
  it.each(['desktop/v1', 'desktop/v2', 'mobile/v2'] as const)('every counted thread has an author [%s] (BUG-006)', async (theme) => {
    const app = await loadApp();
    setupDom(fixture(`${theme}/forumdisplay.html`), FC + 'forumdisplay.php?f=2');
    app.resetAdapter();
    const th = app.findThreads().filter((t) => t.messageCount >= 0);
    expect(th.length).toBeGreaterThan(0);
    expect(th.filter((t) => !t.author)).toHaveLength(0);
  });

  it('desktop-v2: hide by author works with accents and spaces (BUG-006)', async () => {
    const app = await loadApp();
    setupDom(fixture('desktop/v2/forumdisplay.html'), FC + 'forumdisplay.php?f=2');
    app.resetAdapter();
    const th = app.findThreads().filter((t) => /[^\x00-\x7F]|\s/.test(t.author));
    expect(th.length).toBeGreaterThanOrEqual(5);
    app.hideThreads(th.map((t) => t.author), []);
    expect(th.filter((t) => t.container?.style.display !== 'none')).toHaveLength(0);
  });
});

describe('Word filters', () => {
  async function forum() {
    const app = await loadApp();
    setupDom(fixture('desktop/v1/forumdisplay.html'), FC + 'forumdisplay.php?f=2');
    app.resetAdapter();
    return { app, th: threadsWithLink(app) };
  }
  const isHidden = (t: { container: HTMLElement | null }) => t.container?.style.display === 'none';

  it('presets do not hide neutral titles (substring false positives, BUG-005)', async () => {
    const { app, th } = await forum();
    const titles = [
      '¿Cambio automático o manual para ciudad?',
      'Opiniones del vehículo eléctrico de mi cuñado',
      'Artículo interesante sobre la ITV',
      'Definitivamente me cambio de compañía de seguros',
      'Opciones de financiación para un coche usado',
      '¿Qué portátil para informática y programación?',
      'Rodríguez, el mecánico de mi barrio, es un crack',
      'Pelea en el parking del Mercadona',
      'Me han subido +180€ el seguro',
      'Recomendad una buena película de miedo',
    ];
    titles.forEach((t, i) => { th[i].a.textContent = t; th[i].a.title = ''; });
    const p = app.presets;
    app.hideThreads([], [...p.presetPolitica, ...p.presetFutbol, ...p.presetAnime, ...p.presetVideojuegos, ...p.presetCripto, ...p.preset18]);
    expect(titles.filter((_t, i) => isHidden(th[i]))).toEqual([]);
  });

  it('words still hide titles that contain them, with * wildcard (BUG-005)', async () => {
    const { app, th } = await forum();
    const cases: [string, string, boolean][] = [
      ['Bitcoin rompe máximos', 'bitcoin', true], ['Vídeo +18 del finde', '+18', true], ['Menudo culo tiene', 'culo', true],
      ['El Real Madrid gana la liga', 'real madrid', true], ['Política: elecciones ya', 'politica', true], ['Mi PC no arranca', 'pc', true],
      ['La peña del bar', 'peña', true], ['Políticos corruptos', 'polit*', true],
      ['¿Merece la pena?', 'peña', false], // "pena" must not match "peña"
    ];
    cases.forEach(([t], i) => { th[i].a.textContent = t; th[i].a.title = ''; });
    app.hideThreads([], cases.map((c) => c[1]));
    expect(cases.map(([t, w], i) => [t, w, isHidden(th[i])])).toEqual(cases);
  });

  it('highlight word groups use whole-word matching (BUG-005)', async () => {
    const app = await loadApp();
    setupDom(fixture('desktop/v1/forumdisplay.html'), FC + 'forumdisplay.php?f=2', {
      storage: { fc_hl_word_groups: [{ id: 'g', desc: 'test', color: 'rgb(1, 2, 3)', items: ['culo'] }] },
    });
    app.resetAdapter();
    const th = threadsWithLink(app);
    th[0].a.textContent = 'Mi vehículo nuevo';
    th[1].a.textContent = 'Vaya culo';
    app.hideThreads([], []);
    expect(th[0].container?.style.background).not.toMatch(/rgb\(1, 2, 3\)/);
    expect(th[1].container?.style.background).toMatch(/rgb\(1, 2, 3\)/);
  });

  it('hidden summary lists every hidden thread after a second run (BUG-008)', async () => {
    const { app, th } = await forum();
    th[0].a.textContent = 'Hilo zzzuno';
    th[1].a.textContent = 'Hilo zzzdos';
    app.hideThreads([], ['zzzuno']);
    app.hideThreads([], ['zzzuno', 'zzzdos']);
    expect(document.querySelectorAll('#fc-hidden-summary > div').length - 1).toBe(2);
  });

  it('removing a word shows the thread again without reload (BUG-008)', async () => {
    const { app, th } = await forum();
    th[0].a.textContent = 'Hilo zzzuno';
    app.hideThreads([], ['zzzuno']);
    expect(isHidden(th[0])).toBe(true);
    app.hideThreads([], []);
    expect(isHidden(th[0])).toBe(false);
  });
});
