import { describe, expect, it } from 'vitest';
import { FC, THEMES, fixture, loadApp, mockFetch, net, setupDom, sleep, tag } from './helpers';

// Synthetic vBulletin "add to list" confirmation page (fake security token).
const confirmHtml = (u: string) => {
  const list = (u.match(/userlist=(\w+)/) || [])[1] ?? '?';
  return `<html><body><form action="profile.php?do=doaddlist&amp;userlist=${list}&amp;u=1" method="post">`
    + `<input type="hidden" name="securitytoken" value="TEST-TOKEN"><input type="hidden" name="do" value="doaddlist">`
    + `<input type="hidden" name="userlist" value="${list}"><input type="submit" value="Si"></form></body></html>`;
};

describe('Ignore on FC', () => {
  it.each(THEMES)('fetchProfileForIgnore picks the ignore-list link [%s] (BUG-003)', async (theme) => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php', {
      fetch: mockFetch([[(u) => u.includes('member.php?username='), () => ({ body: fixture(`${theme}/member.html`) })]]),
    });
    const r = await app.fetchProfileForIgnore('usuario_prueba');
    expect(r?.ignLink, tag(theme)).toMatch(/userlist=ignore/);
  });

  it.each(['desktop/v1', 'desktop/v2'] as const)('addToFCIgnore GETs and POSTs userlist=ignore [%s] (BUG-003)', async (theme) => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php', {
      fetch: mockFetch([
        [(u) => u.includes('member.php?username='), () => ({ body: fixture(`${theme}/member.html`) })],
        [(u) => u.includes('do=addlist'), (u) => ({ body: confirmHtml(u) })],
        [(_u, i) => i?.method === 'POST', () => ({ body: 'ok' })],
        [(u) => u.includes('do=ignorelist'), () => ({ body: '<div id="ignorelist"></div>' })],
      ]),
    });
    app.addToFCIgnore('usuario_prueba');
    await sleep(300);
    expect(net.calls[1]?.url).toMatch(/userlist=ignore/);
    expect(net.calls.find((c) => c.method === 'POST')?.body?.userlist).toBe('ignore');
    expect(net.calls.some((c) => /buddy/.test(c.url))).toBe(false);
  });
});

describe('Sync ignored users', () => {
  it('logged-out page (no #ignorelist) keeps the local list (BUG-004)', async () => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php', {
      storage: { fc_ignored_users: ['usuario_a', 'usuario_b'] },
      fetch: mockFetch([[() => true, () => ({ body: '<html><body><form action="login.php"><input name="vb_login_username"></form></body></html>' })]]),
    });
    await app.syncIgnored();
    expect(app.getUsers()).toEqual(['usuario_a', 'usuario_b']);
  });

  it('network error keeps the local list (BUG-004)', async () => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php', { storage: { fc_ignored_users: ['usuario_a', 'usuario_b'] } });
    await app.syncIgnored();
    expect(app.getUsers()).toEqual(['usuario_a', 'usuario_b']);
  });

  it('HTTP 500 keeps the local list (BUG-004)', async () => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php', {
      storage: { fc_ignored_users: ['usuario_a'] },
      fetch: mockFetch([[() => true, () => ({ status: 500, body: '<div id="ignorelist"></div>' })]]),
    });
    expect(await app.fetchIgnoreList()).toBeNull();
    await app.syncIgnored();
    expect(app.getUsers()).toEqual(['usuario_a']);
  });

  it('empty FC list is not an error and keeps the local list (BUG-004)', async () => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php', {
      storage: { fc_ignored_users: ['usuario_a', 'usuario_b'] },
      fetch: mockFetch([[() => true, () => ({ body: '<html><body><form action="profile.php?do=updatelist&amp;userlist=ignore" id="ignorelist_add_form"></form></body></html>' })]]),
    });
    expect(await app.fetchIgnoreList()).toEqual([]);
    await app.syncIgnored();
    expect(app.getUsers()).toHaveLength(2);
    expect(document.getElementById('fc-toast')?.textContent).toMatch(/Sincronizado/);
  });

  it('merges FC users and keeps local ones (BUG-004)', async () => {
    const app = await loadApp();
    setupDom('<html><body></body></html>', FC + 'index.php', {
      storage: { fc_ignored_users: ['solo_local'] },
      fetch: mockFetch([[() => true, () => ({ body: fixture('mobile/v1/ignore_list.html') })]]),
    });
    const remote = (await app.fetchIgnoreList()) ?? [];
    await app.syncIgnored();
    const after = app.getUsers();
    expect(after).toContain('solo_local');
    expect(after).toEqual(expect.arrayContaining(remote));
    expect(after).toHaveLength(remote.length + 1);
  });

  it.each(THEMES)('parses the real ignore-list page [%s]', async (theme) => {
    const app = await loadApp();
    const html = fixture(`${theme}/ignore_list.html`);
    // independent oracle: one listbits[ignore][id] checkbox per ignored user
    const oracle = new Set(html.match(/name="listbits\[ignore\]\[\d+\]"/g) || []).size;
    setupDom('<html><body></body></html>', FC + 'index.php', { fetch: mockFetch([[() => true, () => ({ body: html })]]) });
    expect(oracle).toBeGreaterThan(0);
    expect(await app.fetchIgnoreList()).toHaveLength(oracle);
  });
});
