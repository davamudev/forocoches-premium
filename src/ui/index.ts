import { log } from '../toast';
import { getUsers, saveUsers } from '../storage';
import { removeFromFCIgnore } from '../ignore-fc';
import { toast } from '../toast';
import { getShowScrollUp, getShowScrollDown, getShowPoleButton, getPoleMessage, getPoleSearchPages } from '../config';
import { buildUsersTab, renderUserList } from './tab-users';
import { buildWordsTab } from './tab-words';
import { buildConfigTab } from './tab-config';
import { buildHighlightTab } from './tab-highlight';
import { run } from '../runner';
import { findThreads } from '../threads';
import { QUICK_REPLY_SELECTOR } from '../selectors';
import { STYLE, COLORS } from './styles';

function smoothScroll(targetY: number): void {
  const startY = window.scrollY;
  const dist = targetY - startY;
  if (Math.abs(dist) < 10) { window.scrollTo(0, targetY); return; }
  const duration = Math.max(300, Math.min(800, Math.abs(dist) * 0.3));
  const start = performance.now();
  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    window.scrollTo(0, startY + dist * ease);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ============================================================
//  GLOBAL STATE
// ============================================================

let content: HTMLElement | null = null;
let panelListDiv: HTMLElement | null = null;

// ============================================================
//  UPDATE PANEL LIST
// ============================================================

export function updatePanelList(): void {
  const titleEl = document.getElementById('fcp-users-title');
  if (titleEl) titleEl.textContent = `Ignorados del foro (${getUsers().length})`;
  renderUserList(panelListDiv, getUsers(), (u) => {
    log('PANEL', `Eliminando usuario @${u} desde el panel`);
    saveUsers(getUsers().filter((x) => x !== u));
    updatePanelList();
    toast(`Eliminado @${u} de FC Premium`);
    removeFromFCIgnore(u);
    run();
  });
}

// ============================================================
//  TOGGLE PANEL
// ============================================================

export function togglePanel(): void {
  let panel = document.getElementById('fcp-panel');
  if (panel) { log('PANEL', 'Cerrando panel'); panel.remove(); return; }
  log('PANEL', 'Abriendo panel');

  panel = document.createElement('div');
  panel.id = 'fcp-panel';
  panel.style.cssText = STYLE.PANEL;

  const tabBar = document.createElement('div');
  tabBar.style.cssText = STYLE.TAB_BAR;

  const tabUsers = document.createElement('div'); tabUsers.textContent = 'Usuarios';
  tabUsers.style.cssText = STYLE.TAB_ACTIVE;
  const tabWords = document.createElement('div'); tabWords.textContent = 'Palabras';
  tabWords.style.cssText = STYLE.TAB_INACTIVE;
  const tabHighlight = document.createElement('div'); tabHighlight.textContent = 'Resaltado';
  tabHighlight.style.cssText = STYLE.TAB_INACTIVE;
  const tabConfig = document.createElement('div'); tabConfig.textContent = 'Config';
  tabConfig.style.cssText = STYLE.TAB_INACTIVE;

  tabBar.appendChild(tabUsers);
  tabBar.appendChild(tabWords);
  tabBar.appendChild(tabHighlight);
  tabBar.appendChild(tabConfig);

  content = document.createElement('div');
  content.id = 'fcp-content';
  content.style.cssText = STYLE.PANEL_CONTENT;

  function resetTabs(): void {
    tabUsers.style.cssText = STYLE.TAB_INACTIVE;
    tabWords.style.cssText = STYLE.TAB_INACTIVE;
    tabHighlight.style.cssText = STYLE.TAB_INACTIVE;
    tabConfig.style.cssText = STYLE.TAB_INACTIVE;
  }

  tabUsers.addEventListener('click', () => {
    log('PANEL', 'Tab: Usuarios'); resetTabs();
    tabUsers.style.cssText = STYLE.TAB_ACTIVE;
    if (content) panelListDiv = buildUsersTab(content);
  });
  tabWords.addEventListener('click', () => {
    log('PANEL', 'Tab: Palabras'); resetTabs();
    tabWords.style.cssText = STYLE.TAB_ACTIVE;
    if (content) buildWordsTab(content);
  });
  tabHighlight.addEventListener('click', () => {
    log('PANEL', 'Tab: Resaltar'); resetTabs();
    tabHighlight.style.cssText = STYLE.TAB_ACTIVE;
    if (content) buildHighlightTab(content);
  });
  tabConfig.addEventListener('click', () => {
    log('PANEL', 'Tab: Config'); resetTabs();
    tabConfig.style.cssText = STYLE.TAB_ACTIVE;
    if (content) buildConfigTab(content);
  });
  panel.appendChild(tabBar);
  panel.appendChild(content);

  const footer = document.createElement('div');
  footer.style.cssText = 'padding:8px 4px 4px;text-align:center;font-size:11px;color:#777;';
  footer.innerHTML = '<a href="https://github.com/Skjolberg/forocoches-premium" target="_blank" style="color:#FD5D4D;text-decoration:none;">GitHub</a><br><span style="color:#777;">v' + __FC_VERSION__ + '</span>';
  panel.appendChild(footer);

  panelListDiv = buildUsersTab(content);
  document.body.appendChild(panel);
}

// ============================================================
//  BUILD UI (floating button)
// ============================================================

export function buildUI(): void {
  if (document.getElementById('fcp-ui')) { log('UI', 'buildUI ya existia, salteando'); return; }
  log('UI', 'Creando botones flotantes');

  const wrap = document.createElement('div');
  wrap.id = 'fcp-ui';
  wrap.style.cssText = STYLE.FLOAT_WRAP;

  // Scroll-to-top button
  const upBtn = document.createElement('button');
  upBtn.id = 'fcp-up-btn';
  upBtn.title = 'Subir arriba';
  upBtn.style.cssText = STYLE.FLOAT_BTN;
  upBtn.textContent = '\u25B2';
  upBtn.addEventListener('click', () => { log('UI', 'Scroll UP'); smoothScroll(0); });
  upBtn.addEventListener('mouseenter', () => { upBtn.style.background = COLORS.PRIMARY; upBtn.style.borderColor = COLORS.PRIMARY; });
  upBtn.addEventListener('mouseleave', () => { upBtn.style.background = COLORS.DARK_BG; upBtn.style.borderColor = COLORS.DARK_BG; });
  if (!getShowScrollUp()) { upBtn.style.display = 'none'; }
  wrap.appendChild(upBtn);

  // Scroll-to-bottom button
  const downBtn = document.createElement('button');
  downBtn.id = 'fcp-down-btn';
  downBtn.title = 'Bajar abajo';
  downBtn.style.cssText = STYLE.FLOAT_BTN;
  downBtn.textContent = '\u25BC';
  downBtn.addEventListener('click', () => {
    log('UI', 'Scroll DOWN');
    let targetY: number | null = null;
    const qr = document.querySelector<HTMLTextAreaElement>(QUICK_REPLY_SELECTOR) || document.querySelector<HTMLTextAreaElement>('textarea[name="message"]');
    if (qr) {
      targetY = qr.getBoundingClientRect().top + window.scrollY - 20;
    }
    if (!targetY || targetY <= window.scrollY) {
      const allPosts = document.querySelectorAll<HTMLElement>('div[id^="edit"], li.postbit');
      const lastPost = allPosts.length > 0 ? allPosts[allPosts.length - 1] : null;
      if (lastPost) {
        targetY = lastPost.getBoundingClientRect().bottom + window.scrollY + 20;
      } else {
        targetY = document.body.scrollHeight;
      }
    }
    if (targetY > window.scrollY) {
      smoothScroll(targetY);
      if (qr) setTimeout(() => { qr.focus(); }, 600);
    }
  });
  downBtn.addEventListener('mouseenter', () => { downBtn.style.background = COLORS.PRIMARY; downBtn.style.borderColor = COLORS.PRIMARY; });
  downBtn.addEventListener('mouseleave', () => { downBtn.style.background = COLORS.DARK_BG; downBtn.style.borderColor = COLORS.DARK_BG; });
  if (!getShowScrollDown()) { downBtn.style.display = 'none'; }
  wrap.appendChild(downBtn);

  // Pole button
  const poleBtn = document.createElement('button');
  poleBtn.id = 'fcp-pole-btn';
  poleBtn.title = 'Pole: responder al primer hilo sin respuestas';
  poleBtn.style.cssText = 'width:44px;height:44px;border-radius:22px;border:2px solid #FD5D4D;background:#FD5D4D;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;padding:0;font-size:20px;color:white;line-height:1;';
  const poleIcon = document.createElement('span');
  poleIcon.textContent = '\uD83C\uDFCE\uFE0F';
  poleIcon.style.cssText = 'display:block;line-height:1;margin-top:-6px;';
  poleBtn.appendChild(poleIcon);
  poleBtn.addEventListener('click', () => {
    log('UI', 'POLE');
    if (window.location.pathname.indexOf('forumdisplay.php') === -1) {
      toast('Solo disponible en listado de hilos'); return;
    }
    const threads = findThreads();
    let target: string | null = null;
    for (let pi = 0; pi < threads.length; pi++) {
      if (threads[pi].messageCount === 0 && threads[pi].a?.href) {
        target = threads[pi].a!.href;
        break;
      }
    }
    if (!target && getPoleSearchPages()) {
      const pageMatch = window.location.href.match(/page=(\d+)/);
      const curPage = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      const baseUrl = url.href;
      const searchData = JSON.stringify({ baseUrl, page: curPage });
      try { localStorage.setItem('fc_pole_search', searchData); } catch { toast('Error al guardar datos de busqueda', 3000); }
      const params = new URLSearchParams(url.search);
      params.set('page', String(curPage + 1));
      const nextUrl = `${url.origin}${url.pathname}?${params.toString()}`;
      const msg = getPoleMessage();
      try { localStorage.setItem('fc_pole_msg', msg); } catch { toast('Error al guardar el mensaje', 3000); }
      log('POLE', `Sin hilos en p\u00E1gina ${curPage}, buscando en ${nextUrl}`);
      toast(`Buscando en p\u00E1gina ${curPage + 1}...`, 3000);
      window.location.href = nextUrl;
      return;
    }
    if (!target) { toast('No hay hilos sin respuestas'); return; }
    const msg = getPoleMessage();
    try { localStorage.setItem('fc_pole_msg', msg); } catch { toast('Error al guardar el mensaje', 3000); }
    log('POLE', `Navegando a: ${target}`, `Mensaje: ${msg}`);
    window.location.href = target;
  });
  poleBtn.addEventListener('mouseenter', () => { poleBtn.style.background = '#E04A3A'; poleBtn.style.borderColor = '#E04A3A'; });
  poleBtn.addEventListener('mouseleave', () => { poleBtn.style.background = '#FD5D4D'; poleBtn.style.borderColor = '#FD5D4D'; });
  if (!getShowPoleButton()) { poleBtn.style.display = 'none'; }
  wrap.appendChild(poleBtn);

  const btn = document.createElement('button');
  btn.id = 'fcp-btn';
  btn.title = 'FC Premium';
  btn.style.cssText = STYLE.FC_BTN;
  const ico = document.createElement('img');
  ico.src = 'https://forocoches.com/favicon.ico';
  ico.style.cssText = STYLE.FC_ICON;
  ico.alt = 'FC';
  btn.appendChild(ico);
  btn.addEventListener('click', () => { togglePanel(); });
  wrap.appendChild(btn);
  document.body.appendChild(wrap);
}
