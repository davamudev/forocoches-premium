import { toast, log } from './toast';
import { cleanUser } from './utils';

const KEY_USER_NOTES = 'fc_user_notes';

export function getUserNotes(): Record<string, string> {
  try {
    const data = localStorage.getItem(KEY_USER_NOTES);
    if (data) { const parsed = JSON.parse(data); if (typeof parsed === 'object' && parsed !== null) return parsed; }
  } catch (_) { }
  return {};
}

function saveNotes(notes: Record<string, string>): void {
  try { localStorage.setItem(KEY_USER_NOTES, JSON.stringify(notes)); } catch (_) { }
}

export function saveUserNote(username: string, note: string): void {
  const notes = getUserNotes();
  const key = username.toLowerCase();
  if (note) notes[key] = note;
  else delete notes[key];
  saveNotes(notes);
  log('NOTES', `Nota ${note ? 'guardada' : 'eliminada'} para @${username}`);
}

export function deleteUserNote(username: string): void {
  saveUserNote(username, '');
}

export function getNote(username: string): string {
  return getUserNotes()[username.toLowerCase()] || '';
}

function showNotePopup(anchor: HTMLElement, username: string): void {
  const existing = document.getElementById('fc-note-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'fc-note-popup';
  popup.style.cssText = 'position:fixed;z-index:9999999;background:white;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.25);padding:14px;font-family:Helvetica,Arial,sans-serif;color:#333;width:260px;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
  const title = document.createElement('span');
  title.style.cssText = 'font-size:13px;font-weight:bold;color:#8E44AD;';
  const note = getNote(username);
  title.textContent = note ? `Nota para @${username}` : `Añadir nota para @${username}`;
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.title = 'Cerrar';
  closeBtn.style.cssText = 'border:none;background:transparent;color:#999;cursor:pointer;font-size:14px;font-weight:bold;padding:0;line-height:1;';
  header.appendChild(closeBtn);
  popup.appendChild(header);

  const textarea = document.createElement('textarea');
  textarea.value = note;
  textarea.placeholder = 'Escribe tu nota aquí...';
  textarea.style.cssText = 'width:100%;height:80px;border:1px solid #ddd;border-radius:6px;padding:8px;font-size:12px;font-family:Helvetica,Arial,sans-serif;box-sizing:border-box;resize:vertical;outline:none;';
  textarea.style.borderColor = '#8E44AD';
  popup.appendChild(textarea);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Guardar';
  saveBtn.style.cssText = 'flex:1;border:none;background:#8E44AD;color:white;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;font-weight:bold;';

  const delBtn = document.createElement('button');
  delBtn.textContent = 'Eliminar nota';
  delBtn.style.cssText = 'border:none;background:#f5f5f5;color:#c00;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;font-weight:bold;';

  btnRow.appendChild(saveBtn);
  if (note) btnRow.appendChild(delBtn);
  popup.appendChild(btnRow);

  function close() {
    popup.remove();
  }

  function save() {
    const val = textarea.value.trim();
    saveUserNote(username, val);
    toast(val ? `Nota guardada para @${username}` : `Nota eliminada de @${username}`);
    updateAllNoteWidgets(username);
    close();
  }

  saveBtn.addEventListener('click', save);
  delBtn.addEventListener('click', () => {
    saveUserNote(username, '');
    toast(`Nota eliminada de @${username}`);
    updateAllNoteWidgets(username);
    close();
  });
  closeBtn.addEventListener('click', close);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  });

  const rect = anchor.getBoundingClientRect();
  const popW = 260;
  const popH = 200;
  const isProfile = !!document.getElementById('aboutme');
  let left: number;
  let top: number;
  if (isProfile) {
    left = rect.left + rect.width / 2 - popW / 2;
    top = rect.bottom + 4;
  } else {
    left = rect.right + 8;
    top = rect.top - 10;
    if (left + popW > window.innerWidth - 10) left = rect.left - popW - 8;
  }
  left = Math.max(10, Math.min(left, window.innerWidth - popW - 10));
  if (top + popH > window.innerHeight) top = window.innerHeight - popH - 10;
  top = Math.max(10, top);
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';

  document.body.appendChild(popup);
  textarea.focus();
  if (note) textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  function onClickOutside(e: MouseEvent) {
    if (!popup.contains(e.target as Node) && e.target !== anchor && !anchor.contains(e.target as Node)) {
      close();
    }
  }
  setTimeout(() => document.addEventListener('click', onClickOutside), 0);
}

function updateAllNoteWidgets(username: string): void {
  const widgets = document.querySelectorAll('.fc-note');
  const note = getNote(username);
  for (let i = 0; i < widgets.length; i++) {
    const w = widgets[i] as HTMLElement;
    const uname = w.getAttribute('data-fc-username');
    if (uname !== username) continue;
    if (w.tagName === 'SPAN') {
      renderNoteDisplay(w, note);
    } else {
      renderProfileBlock(w, username);
    }
  }
}

function renderProfileBlock(block: HTMLElement, username: string): void {
  const note = getNote(username);
  block.innerHTML = '';
  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;align-items:center;gap:4px;font-weight:bold;font-size:12px;color:#8E44AD;margin-bottom:4px;';

  const iconSpan = document.createElement('span');
  iconSpan.textContent = note ? '✏️' : '📝';
  iconSpan.style.cssText = 'font-size:14px;';
  headerRow.appendChild(iconSpan);

  const textSpan = document.createElement('span');
  textSpan.textContent = 'Notas FC Premium';
  headerRow.appendChild(textSpan);

  if (note) {
    const editHint = document.createElement('span');
    editHint.textContent = '(click para editar)';
    editHint.style.cssText = 'font-size:10px;color:#999;font-weight:normal;';
    headerRow.appendChild(editHint);
  }
  block.appendChild(headerRow);

  if (note) {
    const content = document.createElement('div');
    content.textContent = note;
    content.style.cssText = 'padding:6px 8px;background:#f5f0fa;border-radius:4px;font-size:13px;color:#333;line-height:1.4;white-space:pre-wrap;word-break:break-word;';
    block.appendChild(content);
  } else {
    const hint = document.createElement('div');
    hint.textContent = 'Haz click para añadir una nota...';
    hint.style.cssText = 'font-size:12px;color:#bbb;font-style:italic;';
    block.appendChild(hint);
  }
}

function renderNoteDisplay(wrap: HTMLElement, note: string): void {
  wrap.innerHTML = '';
  if (note) {
    wrap.textContent = '✏️';
    wrap.style.opacity = '1';
  } else {
    wrap.textContent = '📝';
    wrap.style.opacity = '0.4';
  }
}

function createNoteWidget(username: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'fc-note';
  wrap.setAttribute('data-fc-username', username);
  wrap.title = 'Click para añadir/editar nota';
  wrap.style.cssText = 'margin-left:4px;font-size:17px;color:#999;cursor:pointer;user-select:none;display:inline-flex;align-items:center;gap:2px;';

  renderNoteDisplay(wrap, getNote(username));

  wrap.addEventListener('click', (e) => {
    e.stopPropagation();
    showNotePopup(wrap, username);
  });

  return wrap;
}

// ── Inject notes into showthread posts ────────────────────

export function injectPostNotes(): void {
  if (window.location.pathname.indexOf('showthread.php') === -1) return;

  const pageMargin = document.querySelector('div.page-margin');
  const postbitWrapper = document.querySelector('div.postbit_wrapper');
  const isMobile = !!pageMargin;
  const isMobileV1 = isMobile && !postbitWrapper;
  const isDesktopV2 = !!document.querySelector('section.without-bottom-corners');

  const reportLinks = document.querySelectorAll<HTMLAnchorElement>('a[href*="report.php?p="]');
  for (let i = 0; i < reportLinks.length; i++) {
    const reportLink = reportLinks[i];
    if (reportLink.parentNode?.querySelector('.fc-note')) continue;

    let currentEl: HTMLElement | null = reportLink.parentNode as HTMLElement;
    let authorLink: HTMLAnchorElement | null = null;
    while (currentEl && currentEl !== document.body) {
      const authorAnchors = currentEl.querySelectorAll<HTMLAnchorElement>('a[href*="member.php?u="]');
      const found = Array.from(authorAnchors).find((a) => a.textContent.trim());
      if (found) { authorLink = found; break; }
      currentEl = currentEl.parentNode as HTMLElement;
    }
    if (!authorLink) continue;
    const username = cleanUser(authorLink.textContent);
    if (!username) continue;

    const noteWidget = createNoteWidget(username);
    if (isMobileV1) noteWidget.style.fontSize = '14px';
    else if (isMobile) noteWidget.style.fontSize = '14px';
    else if (isDesktopV2) noteWidget.style.fontSize = '18px';
    if (!isMobile && !isDesktopV2) noteWidget.style.verticalAlign = '-2px';
    if (isMobileV1) {
      const sep = document.createTextNode(' | ');
      reportLink.parentNode?.insertBefore(sep, reportLink.nextSibling);
      reportLink.parentNode?.insertBefore(noteWidget, sep.nextSibling);
    } else {
      reportLink.parentNode?.insertBefore(noteWidget, reportLink.nextSibling);
    }
  }
}

// ── Inject notes into member.php profile ──────────────────

function getProfileUsername(): string {
  const allH2 = document.querySelectorAll('h2');
  for (let i = 0; i < allH2.length; i++) {
    const txt = allH2[i].textContent.trim();
    if (txt && txt.length < 30 && !txt.includes('/') && !txt.includes('http') && !txt.includes(' ') && !txt.includes(':')) return cleanUser(txt);
  }

  const allH3 = document.querySelectorAll('h3');
  for (let i = 0; i < allH3.length; i++) {
    const txt = allH3[i].textContent.trim();
    if (txt && txt.length < 30 && !txt.includes('/') && !txt.includes('http') && !txt.includes(' ') && !txt.includes(':')) return cleanUser(txt);
  }

  const bigName = document.querySelector('div.bigusername');
  if (bigName) {
    for (let i = 0; i < bigName.childNodes.length; i++) {
      if (bigName.childNodes[i].nodeType === Node.TEXT_NODE) {
        const txt = (bigName.childNodes[i].textContent || '').trim();
        if (txt) return cleanUser(txt);
      }
    }
  }

  const mainH1 = document.querySelector('#main_userinfo h1');
  if (mainH1) {
    for (let i = 0; i < mainH1.childNodes.length; i++) {
      if (mainH1.childNodes[i].nodeType === Node.TEXT_NODE) {
        const txt = (mainH1.childNodes[i].textContent || '').trim();
        if (txt) return cleanUser(txt);
      }
    }
  }

  const m = window.location.href.match(/member\.php\?(?:.*\bu=(\d+))/i);
  if (m) {
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="member.php?u=' + m[1] + '"]');
    for (let i = 0; i < links.length; i++) {
      const txt = links[i].textContent.trim();
      if (txt && txt.length < 30 && !txt.includes('/') && !txt.includes('http') && !links[i].querySelector('img')) return cleanUser(txt);
    }
  }

  return '';
}

export function injectProfileNote(): void {
  if (window.location.pathname.indexOf('member.php') === -1) return;
  if (document.querySelector('.fc-note')) return;

  const username = getProfileUsername();
  if (!username) return;

  const hasPM = !!document.querySelector('div.page-margin');
  const hasAI = !!document.getElementById('additionalinfo_list');
  const hasTabs = !!document.querySelector('.tab');
  const hasAboutMe = !!document.getElementById('aboutme');
  const hasMainInfo = !!document.getElementById('main_userinfo');

  if (!hasPM) {
    if (hasAboutMe) injectDesktopV2Note(username);
    else if (hasMainInfo) injectDesktopV1Note(username);
  } else if (hasAI) {
    injectMobileV1Note(username);
  } else if (hasTabs) {
    injectMobileV2Note(username);
  }
}

function injectMobileV1Note(username: string): void {
  const list = document.getElementById('additionalinfo_list');
  if (!list || list.querySelector('.fc-note')) return;

  const sep = document.createElement('separator');
  sep.style.cssText = 'display:block;height:1px;background:#ddd;margin:8px 0 4px;';

  const catLi = list.querySelector('li.profilefield_category');
  if (catLi) {
    const innerDl = catLi.querySelector('dl.profilefield_list, .profilefield_list');
    if (innerDl) {
      innerDl.appendChild(sep);
      const dd = document.createElement('dd');
      dd.style.cssText = 'margin-bottom:4px;';
      dd.appendChild(createProfileNoteBlock(username));
      innerDl.appendChild(dd);
      return;
    }
  }

  list.appendChild(sep);
  const dd = document.createElement('dd');
  dd.style.cssText = 'margin-bottom:6px;';
  dd.appendChild(createProfileNoteBlock(username));
  list.appendChild(dd);
}

function injectMobileV2Note(username: string): void {
  const tabs = document.querySelector('.tab');
  if (!tabs || document.querySelector('.fc-note')) return;

  const block = document.createElement('div');
  block.style.cssText = 'padding:12px 18px;margin:0;background:var(--background-color,#fff);border-bottom:1px solid var(--separator-color,#eee);';
  block.appendChild(createProfileNoteBlock(username));
  tabs.parentNode?.insertBefore(block, tabs);
}

function injectDesktopV1Note(username: string): void {
  const linkBar = document.getElementById('link_bar');
  if (!linkBar || document.querySelector('.fc-note')) return;

  const block = document.createElement('div');
  block.style.cssText = 'padding:8px 12px;margin:0 12px 6px;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;font-size:12px;';
  block.appendChild(createProfileNoteBlock(username));
  linkBar.parentNode?.insertBefore(block, linkBar.nextSibling);
}

function injectDesktopV2Note(username: string): void {
  const aboutme = document.getElementById('aboutme');
  if (!aboutme || aboutme.querySelector('.fc-note')) return;

  const target = aboutme.querySelector('.block_content > div') || aboutme.querySelector('.block_content') || aboutme;
  const noteDiv = document.createElement('div');
  noteDiv.style.cssText = 'margin-top:12px;padding-top:8px;border-top:1px solid var(--separator-color,#e0e0e0);';
  noteDiv.appendChild(createProfileNoteBlock(username));
  target.appendChild(noteDiv);
}

function createProfileNoteBlock(username: string): HTMLElement {
  const block = document.createElement('div');
  block.className = 'fc-note';
  block.setAttribute('data-fc-username', username);
  block.style.cssText = 'cursor:pointer;';

  renderProfileBlock(block, username);

  block.addEventListener('click', (e) => {
    e.stopPropagation();
    showNotePopup(block, username);
  });

  return block;
}
