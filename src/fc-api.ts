import { log } from './toast';
import { cleanUser } from './utils';

// ============================================================
//  LOW-LEVEL FC API (pure HTTP + parse, no UI)
// ============================================================

async function fetchAsDoc(url: string): Promise<Document> {
  log('FC-API', `Fetching: ${url}`);
  const response = await fetch(url, { credentials: 'include' });
  log('FC-API', `Response OK: ${url}`);
  const html = await response.text();
  log('FC-API', `Parseando HTML (${html.length} chars)`);
  return new DOMParser().parseFromString(html, 'text/html');
}

// null = could not read the list (network error, logged out, unexpected page)
export async function fetchIgnoreList(): Promise<string[] | null> {
  log('FC-API', 'Obteniendo lista de ignorados de FC...');
  try {
    const response = await fetch('https://forocoches.com/foro/profile.php?do=ignorelist', { credentials: 'include' });
    if (!response.ok) { log('FC-API', `ignorelist HTTP ${response.status}`); return null; }
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    // The ignore list form is present even when the list is empty; a login page lacks it
    if (!doc.querySelector('form[action*="userlist=ignore"]') && !doc.querySelector('#ignorelist')) {
      log('FC-API', 'ignorelist: respuesta sin lista (sesion caducada?)');
      return null;
    }
    const users: string[] = [];
    doc.querySelectorAll('#ignorelist a[href*="member.php"]').forEach((a) => {
      const n = cleanUser(a.textContent);
      if (n) users.push(n);
    });
    log('FC-API', `Usuarios ignorados en FC: ${users.length}`);
    return users;
  } catch {
    log('FC-API', 'Error al obtener ignorelist');
    return null;
  }
}

function parseFormSi(html: string): { actionUrl: string; fields: Record<string, string> } | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allForms = doc.querySelectorAll('form');
  for (const form of allForms) {
    const submitBtn = form.querySelector<HTMLInputElement>('input[type="submit"][value*="Si" i]');
    if (!submitBtn) continue;

    let actionUrl = form.getAttribute('action') || '';
    actionUrl = actionUrl.replace(/&amp;/g, '&');
    if (actionUrl.indexOf('http') !== 0) {
      if (actionUrl.indexOf('/') === 0) actionUrl = 'https://forocoches.com' + actionUrl;
      else actionUrl = 'https://forocoches.com/foro/' + actionUrl;
    }

    const formFields: Record<string, string> = {};
    form.querySelectorAll('input').forEach((input) => {
      const name = input.getAttribute('name');
      const value = input.getAttribute('value') || '';
      if (name) formFields[name] = value;
    });

    return { actionUrl, fields: formFields };
  }
  return null;
}

export async function enviarFormSi(html: string): Promise<boolean> {
  const parsed = parseFormSi(html);
  if (!parsed) {
    log('FC-API', 'enviarFormSi: no se pudo parsear formulario');
    return false;
  }
  log('FC-API', `Enviando formulario a: ${parsed.actionUrl}`);

  const fd = new FormData();
  const camposPermitidos = ['do', 'userlist', 'userid', 'securitytoken', 'confirm', 'url'];
  camposPermitidos.forEach((fieldName) => { if (parsed.fields[fieldName]) fd.append(fieldName, parsed.fields[fieldName]); });
  if (!fd.has('confirm')) fd.append('confirm', 'Si');

  try {
    await fetch(parsed.actionUrl, { method: 'POST', body: fd, credentials: 'include' });
    log('FC-API', 'Formulario enviado OK');
    return true;
  } catch {
    log('FC-API', 'Error al enviar formulario');
    return false;
  }
}

export async function fetchProfileForIgnore(username: string): Promise<{ ignLink: string; userId: string } | null> {
  log('FC-API', `Buscando perfil de @${username} para ignorar...`);
  try {
    const doc = await fetchAsDoc(`https://forocoches.com/foro/member.php?username=${encodeURIComponent(username)}`);
    // Desktop profiles list "Agregar a Contactos" (userlist=buddy) before the ignore link
    const anchor = doc.querySelector<HTMLAnchorElement>('a[href*="profile.php?do=addlist"][href*="userlist=ignore"]');
    const userId = anchor?.getAttribute('href')?.match(/[?&]u=(\d+)/)?.[1];
    if (!userId) {
      log('FC-API', `No se encontro link addlist ignore para @${username}`);
      return null;
    }

    const ignLink = `https://forocoches.com/foro/profile.php?do=addlist&userlist=ignore&u=${userId}`;
    log('FC-API', `Link ignorar encontrado para @${username}: ${ignLink}`);
    return { ignLink, userId };
  } catch {
    log('FC-API', `Error fetchProfileForIgnore para @${username}`);
    return null;
  }
}

export async function findUserIdInIgnoreList(username: string): Promise<string> {
  log('FC-API', `Buscando userId de @${username} en ignorelist...`);
  const doc = await fetchAsDoc('https://forocoches.com/foro/profile.php?do=ignorelist');
  let userId = '';
  doc.querySelectorAll('#ignorelist a[href*="member.php?u="]').forEach((a) => {
    if (cleanUser(a.textContent) === username) {
      const m = (a as HTMLAnchorElement).href.match(/member\.php\?u=(\d+)/i);
      if (m) userId = m[1];
    }
  });
  log('FC-API', `userId de @${username}: ${userId || 'NO ENCONTRADO'}`);
  return userId;
}

export async function fetchIgnoreListResult(username: string): Promise<boolean> {
  log('FC-API', `Verificando si @${username} esta en ignorelist...`);
  try {
    const doc = await fetchAsDoc('https://forocoches.com/foro/profile.php?do=ignorelist');
    let found = false;
    doc.querySelectorAll('#ignorelist a[href*="member.php"]').forEach((a) => {
      if (cleanUser(a.textContent) === username) found = true;
    });
    log('FC-API', `@${username} en ignorelist: ${found ? 'SI' : 'NO'}`);
    return found;
  } catch {
    log('FC-API', `Error fetchIgnoreListResult para @${username}`);
    return false;
  }
}
