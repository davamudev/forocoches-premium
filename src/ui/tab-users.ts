import { getUsers, saveUsers } from '../storage';
import { toast, log } from '../toast';
import { cleanUser, getCurrentThreadId } from '../utils';
import { getAutoRedirectOP, getAutoMinimize, autoMinimizePanel } from '../config';
import { syncIgnored, addToFCIgnore, removeFromFCIgnore } from '../ignore-fc';
import { run } from '../runner';
import { resolveThreadOP } from '../hide-posts';
import { STYLE, COLORS } from './styles';

let searchFilter = '';

// ============================================================
//  RENDER USER LIST
// ============================================================

export function renderUserList(container: HTMLElement | null, users: string[], onDelete?: (u: string) => void): void {
  if (!container) return;
  container.innerHTML = '';
  if (users.length === 0) {
    const e = document.createElement('div');
    e.textContent = '(vacio)';
    e.style.cssText = STYLE.EMPTY;
    container.appendChild(e);
    return;
  }
  users.forEach(function (u) {
    const row = document.createElement('div');
    row.style.cssText = STYLE.USER_ROW;
    const span = document.createElement('span'); span.textContent = '@' + u;
    const delBtn = document.createElement('button'); delBtn.textContent = 'X';
    delBtn.style.cssText = 'border:none;background:transparent;color:' + COLORS.DANGER + ';cursor:pointer;font-size:12px;font-weight:bold;padding:2px 4px;';
    const uCopy = u;
    delBtn.addEventListener('click', function () { if (onDelete) onDelete(uCopy); });
    row.appendChild(span); row.appendChild(delBtn);
    container.appendChild(row);
  });
}

// ============================================================
//  BUILD USERS TAB
// ============================================================

export function buildUsersTab(content: HTMLElement): HTMLElement | null {
  content.innerHTML = '';
  searchFilter = '';
  let listDivRef: HTMLElement | null = null;

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
  const title = document.createElement('span');
  title.id = 'fcp-users-title';
  function updateTitle() {
    var total = getUsers().length;
    if (searchFilter) title.textContent = 'Ignorados del foro (b\u00FAsqueda)';
    else title.textContent = 'Ignorados del foro (' + total + ')';
  }
  updateTitle();
  title.style.cssText = STYLE.TITLE;
  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = 'Sincronizar';
  refreshBtn.style.cssText = STYLE.BTN_SYNC;
  refreshBtn.addEventListener('click', function () { searchFilter = ''; refreshBtn.textContent = '...'; syncIgnored(); setTimeout(function () { refreshBtn.textContent = 'Sincronizar'; }, 2000); });
  header.appendChild(title); header.appendChild(refreshBtn);
  content.appendChild(header);

  // OP ignore button on showthread
  if (window.location.pathname.indexOf('showthread.php') !== -1) {
    const opRow = document.createElement('div');
    opRow.style.cssText = STYLE.OP_ROW;
    const opLabel = document.createElement('span');
    opLabel.textContent = 'OP: buscando...';
    opLabel.style.cssText = STYLE.OP_LABEL;
    const opBtn = document.createElement('button');
    opBtn.textContent = 'Ignorar';
    opBtn.style.cssText = 'border:none;background:' + COLORS.PRIMARY + ';color:white;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:11px;font-weight:bold;display:none;';
    opRow.appendChild(opLabel);
    opRow.appendChild(opBtn);
    content.appendChild(opRow);

    const threadId = getCurrentThreadId();

    function setOP(username: string) {
      if (username) {
        opLabel.textContent = 'OP: @' + username;
        opLabel.style.cssText = STYLE.OP_LABEL_FOUND;
        opBtn.style.display = '';
        opBtn.onclick = function () {
          const cur = getUsers();
          if (cur.indexOf(username) === -1) {
            cur.push(username);
            saveUsers(cur);
            toast('Anadido @' + username + ' a FC Premium');
            addToFCIgnore(username);
            run();
            if (listDivRef) renderUsers();
            if (getAutoRedirectOP()) {
              const backLink = document.querySelector<HTMLAnchorElement>('a[href*="forumdisplay.php?f="]');
              if (backLink) setTimeout(function () { window.location.href = backLink.href; }, 2000);
            }
          } else {
            toast('@' + username + ' ya esta en tu lista');
          }
        };
      } else {
        opLabel.textContent = '(no se pudo identificar el OP)';
        opBtn.style.display = 'none';
      }
    }

    if (threadId) {
      opLabel.textContent = 'OP: consultando...';
      resolveThreadOP(threadId).then(setOP);
    } else {
      setOP('');
    }
  }

  const listDiv = document.createElement('div');
  listDiv.style.cssText = STYLE.USER_LIST;
  listDivRef = listDiv;

  function renderUsers() {
    updateTitle();
    let users = getUsers();
    if (searchFilter) users = users.filter((u) => u === searchFilter);
    renderUserList(listDivRef, users, (u) => {
      saveUsers(getUsers().filter((x) => x !== u));
      searchFilter = '';
      renderUsers();
      toast(`Eliminado @${u} de FC Premium`);
      removeFromFCIgnore(u);
      run();
    });
  }
  renderUsers();
  content.appendChild(listDiv);

  const inputRow = document.createElement('div');
  inputRow.style.cssText = STYLE.INPUT_ROW;
  const inp = document.createElement('input');
  inp.type = 'text'; inp.placeholder = 'nombre usuario...';
  inp.style.cssText = STYLE.INPUT;
  const addBtn = document.createElement('button'); addBtn.textContent = '+'; addBtn.title = 'Anadir';
  addBtn.style.cssText = STYLE.BTN_PRIMARY_SM;
  addBtn.addEventListener('click', () => {
    const name = cleanUser(inp.value);
    if (!name) { toast('Escribe un nombre'); return; }
    const cur = getUsers();
    if (cur.indexOf(name) !== -1) { toast(`@${name} ya existe`); return; }
    log('PANEL', `Anadiendo usuario @${name} desde el panel`);
    cur.push(name); saveUsers(cur); updateTitle(); renderUsers();
    toast(`Anadido @${name} a FC Premium`);
    addToFCIgnore(name);
    run(); inp.value = '';
  });
  inp.addEventListener('keypress', (e) => { if (e.key === 'Enter') addBtn.click(); });
  inputRow.appendChild(inp); inputRow.appendChild(addBtn);

  const searchBtn = document.createElement('button');
  searchBtn.textContent = '\uD83D\uDD0D';
  searchBtn.title = 'Buscar en ignorados';
  searchBtn.style.cssText = 'border:none;background:#2ECC71;color:white;border-radius:5px;padding:6px 10px;cursor:pointer;font-size:14px;font-weight:bold;';
  searchBtn.addEventListener('click', () => {
    const name = cleanUser(inp.value);
    if (!name) { toast('Escribe un nombre de usuario'); return; }
    const cur = getUsers();
    if (cur.indexOf(name) !== -1) {
      searchFilter = name;
      renderUsers();
      toast(`@${name} S\u00ED est\u00E1 en ignorados`);
    } else {
      searchFilter = '';
      renderUsers();
      toast(`@${name} NO est\u00E1 en ignorados`);
    }
  });
  inputRow.appendChild(searchBtn);

  content.appendChild(inputRow);

  // Delete all button
  const deleteAllBtn = document.createElement('button');
  deleteAllBtn.textContent = 'Eliminar todos';
  deleteAllBtn.title = 'Borra todos los usuarios ignorados de FC Premium y Forocoches';
  deleteAllBtn.style.cssText = STYLE.BTN_DEL_ALL;
  deleteAllBtn.addEventListener('click', () => {
    const users = getUsers();
    if (users.length === 0) { toast('No hay usuarios que eliminar'); return; }
    if (!confirm(`Remover a TODOS los usuarios ignorados (${users.length}) de Forocoches? Esta acci\u00f3n puede llevar un tiempo y si sales de la pagina se cancelar\u00e1...`)) return;

    log('PANEL', `Eliminando TODOS los usuarios (${users.length})`);
    saveUsers([]);
    updateTitle();
    renderUsers();
    toast(`Eliminando ${users.length} usuarios de Forocoches...`, 30000);

    if (getAutoMinimize()) autoMinimizePanel();

    let idx = 0;
    const eliminarSiguiente = () => {
      if (idx >= users.length) {
        toast(`Eliminados todos (${users.length}) de Forocoches`);
        log('PANEL', 'Eliminados todos los usuarios');
        run();
        return;
      }
      const u = users[idx];
      idx++;
      log('PANEL', `Eliminando de FC: @${u} (${idx}/${users.length})`);
      removeFromFCIgnore(u);
      setTimeout(eliminarSiguiente, 3000);
    };
    eliminarSiguiente();
  });
  content.appendChild(deleteAllBtn);

  return listDivRef;
}
