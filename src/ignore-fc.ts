import { getUsers, saveUsers } from './storage';
import { toast, log } from './toast';
import { autoMinimizePanel } from './config';
import { run } from './runner';
import { updatePanelList } from './ui/index';
import {
  fetchIgnoreList,
  enviarFormSi,
  fetchProfileForIgnore,
  findUserIdInIgnoreList,
  fetchIgnoreListResult,
} from './fc-api';

// ============================================================
//  SYNC IGNORED LIST FROM FOROCOCHES
// ============================================================

// Merges FC's list into the local one; never drops local users (a failed FC add
// or a bad response must not wipe them). Removals go through removeFromFCIgnore.
export async function syncIgnored(silent = false): Promise<void> {
  const forumUsers = await fetchIgnoreList();
  if (forumUsers === null) {
    if (!silent) toast('No se pudo sincronizar con FC (¿sesion caducada?)', 5000);
    return;
  }
  const local = getUsers();
  const added = forumUsers.filter((u) => local.indexOf(u) === -1);
  if (added.length > 0) saveUsers(local.concat(added));
  if (!silent || added.length > 0) toast(`Sincronizado: ${local.length + added.length} usuarios (${added.length} nuevos)`);
  run();
  updatePanelList();
}

export function openFCIgnoreList(): void {
  window.open('https://forocoches.com/foro/profile.php?do=ignorelist', '_blank');
}

// ============================================================
//  ADD USER TO FC IGNORE LIST
// ============================================================

async function anadirAIgnoradosFC(username: string): Promise<void> {
  toast(`Ignorando a @${username}...`, 15000);
  autoMinimizePanel();

  const result = await fetchProfileForIgnore(username);
  if (!result) {
    log('ERROR', `No se encontro link "Ignorar a" en el perfil de @${username}`);
    toast('No se encontro opcion Ignorar. Abre tu perfil de FC', 6000);
    return;
  }

  log('IGNORE-FC', `Paso 1 OK | Usuario: @${username}`, `Link Ignorar: ${result.ignLink}`, `UserID: ${result.userId}`);

  try {
    const response2 = await fetch(result.ignLink, { credentials: 'include' });
    const htmlConfirm = await response2.text();
    const success = await enviarFormSi(htmlConfirm);
    if (success) {
      verificarIgnorado(username);
    } else {
      toast('Error al confirmar. Abre tu perfil de FC', 5000);
    }
  } catch {
    toast('Error al obtener confirmacion', 5000);
  }
}

async function verificarIgnorado(username: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 3000));
  const success = await fetchIgnoreListResult(username);

  try {
    const response = await fetch('https://forocoches.com/foro/profile.php?do=ignorelist', { credentials: 'include' });
    const html = await response.text();
    const parser = new DOMParser().parseFromString(html, 'text/html');
    const altLinks = parser.querySelectorAll('li a[href*="member.php"]');
    const altTexts: string[] = [];
    altLinks.forEach((anchor) => { altTexts.push(anchor.textContent.trim()); });
    log('IGNORE-FC', `@${username} anadido? ${success ? 'SI' : 'NO'}`, `Otros member links: ${altTexts.join(', ')}`);
    if (success) toast(`El usuario @${username} ha sido anadido a ignorados`);
    else toast('NO anadido. Abre tu perfil de FC', 8000);
  } catch { /* ignore */ }
}

export function addToFCIgnore(username: string): void { anadirAIgnoradosFC(username); }

// ============================================================
//  REMOVE USER FROM FC IGNORE LIST
// ============================================================

export async function removeFromFCIgnore(username: string): Promise<void> {
  toast(`Eliminando @${username} de ignorados...`, 12000);
  autoMinimizePanel();
  log('IGNORE-FC', `Buscando @${username} en ignorelist...`);

  const userId = await findUserIdInIgnoreList(username);
  if (!userId) {
    toast(`@${username} no esta en tu lista de FC`, 5000);
    return;
  }

  const removeUrl = `https://forocoches.com/foro/profile.php?userlist=ignore&do=removelist&u=${userId}`;
  try {
    const response2 = await fetch(removeUrl, { credentials: 'include' });
    const htmlConfirm = await response2.text();
    const success = await enviarFormSi(htmlConfirm);
    if (success) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const stillThere = await fetchIgnoreListResult(username);
      if (!stillThere) toast(`El usuario @${username} ha sido removido de ignorados`);
      else toast('No se pudo eliminar. Abre tu perfil de FC', 5000);
    } else {
      toast('Error al eliminar. Abre tu perfil de FC', 5000);
    }
  } catch {
    toast('Error de red. Abre tu perfil de FC', 5000);
  }
}
