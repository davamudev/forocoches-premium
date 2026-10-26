import { getUsers, saveUsers } from './storage';
import { toast, log } from './toast';
import { cleanUser, getCurrentThreadId } from './utils';
import { getAutoReloadIgnore, getShowPlaceholder, getDisablePostHiding, getHighlightOP, getHighlightOPColor } from './config';
import { addToFCIgnore } from './ignore-fc';
import { run } from './runner';
import { detectAdapter } from './dom-adapter';
import { STYLE } from './ui/styles';

let lastHiddenPosts = -1;
let lastCitarLinks = -1;
let lastIgnorarAdded = -1;

const PLACEHOLDER_TEXT = 'Mensaje de usuario ignorado';

function hidePostElement(post: HTMLElement, usePlaceholder: boolean): void {
  if (usePlaceholder) {
    post.innerHTML = '';
    post.style.display = '';
    const placeholder = document.createElement('div');
    placeholder.textContent = PLACEHOLDER_TEXT;
    placeholder.style.cssText = STYLE.POST_PLACEHOLDER;
    post.appendChild(placeholder);
  } else {
    post.style.display = 'none';
  }
}

export function findPostAuthor(post: HTMLElement): string | null {
  const links = post.querySelectorAll<HTMLAnchorElement>('a[href*="member.php?u="], a.bigusername[href*="member.php"]');
  for (let i = 0; i < links.length; i++) {
    const name = cleanUser(links[i].textContent);
    if (name) return name;
  }
  return null;
}

export function hidePosts(users: string[]): void {
  if (users.length === 0) { return; }
  if (getDisablePostHiding()) return;

  const ad = detectAdapter();
  const usePlaceholder = getShowPlaceholder();
  const posts = document.querySelectorAll<HTMLElement>('li.postbit, div[id^="edit"]');
  let count = 0;
  posts.forEach((post) => {
    if (post.style.display === 'none') return;
    const name = findPostAuthor(post);
    if (name && users.indexOf(name) !== -1) {
      hidePostElement(post, usePlaceholder);
      const linkRow = ad.getLinkRow(post);
      if (linkRow) linkRow.style.display = 'none';
      count++;
    }
  });
  if (count > 0 && count !== lastHiddenPosts) { lastHiddenPosts = count; log('HIDE-POSTS', `Ocultados ${count} de ${posts.length}`); toast(`Mensajes ocultados: ${count}`); }
  else if (count === 0 && lastHiddenPosts === -1) { lastHiddenPosts = 0; log('HIDE-POSTS', `Ocultados 0 de ${posts.length}`); }
}

export function addIgnorePostButtons(): void {
  if (window.location.pathname.indexOf('showthread.php') === -1) return;
  if (getDisablePostHiding()) return;

  const citarLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="newreply.php?do=newreply"]')).filter((anchor) => {
    if ((anchor.textContent || '').trim().toLowerCase() === 'citar') return true;
    const img = anchor.querySelector('img');
    if (img && (img.alt || '').toLowerCase().indexOf('cita') !== -1) return true;
    return false;
  });
  if (citarLinks.length === 0) return;
  if (citarLinks.length !== lastCitarLinks) { lastCitarLinks = citarLinks.length; log('IGNORE-BTN', `Links "Citar": ${citarLinks.length}`); }

  let added = 0;
  citarLinks.forEach((citarLink) => {
    if (citarLink.parentNode!.querySelector('.fc-ignore-btn')) return;

    // Find author link walking up the DOM
    let currentEl: HTMLElement | null = citarLink.parentNode as HTMLElement;
    let authorLink: HTMLAnchorElement | null = null;
    while (currentEl && currentEl !== document.body) {
      const authorAnchors = currentEl.querySelectorAll<HTMLAnchorElement>('a[href*="member.php?u="]');
      const foundAuthor = Array.from(authorAnchors).find((anchor) => anchor.textContent.trim());
      if (foundAuthor) { authorLink = foundAuthor; break; }
      currentEl = currentEl.parentNode as HTMLElement;
    }
    if (!authorLink) return;
    const username = cleanUser(authorLink.textContent);
    if (!username) return;

    const btn = document.createElement('a');
    btn.className = 'fc-ignore-btn';
    btn.textContent = 'Ignorar';
    btn.href = '#';
    btn.style.cssText = STYLE.IGNORE_BTN;
    const isDesktopV1 = !document.querySelector('div.page-margin') && !document.querySelector('section.without-bottom-corners');
    const isMobileV2 = !!document.querySelector('div.page-margin') && !!document.querySelector('div.postbit_wrapper');
    const isDesktopV2 = !!document.querySelector('section.without-bottom-corners');
    if (isDesktopV1) { btn.style.display = 'inline-block'; btn.style.marginTop = '-12px'; btn.style.setProperty('vertical-align', 'middle', 'important'); }
    if (isMobileV2 || isDesktopV2) btn.style.marginTop = '2px';

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const users = getUsers();
      if (users.indexOf(username) === -1) {
        log('IGNORE-BTN', `Ignorar click: @${username}`);
        users.push(username);
        saveUsers(users);
        toast(`Ignorado @${username}`);
        addToFCIgnore(username);

        // Hide post immediately
        const ad = detectAdapter();
        const usePlaceholder = getShowPlaceholder() && !getDisablePostHiding();
        const container = ad.getPostContainer(citarLink);
        if (container) {
          hidePostElement(container, usePlaceholder);
          const linkRow = ad.getLinkRow(container);
          if (linkRow) linkRow.style.display = 'none';
        }

        run();
        btn.textContent = '\u2713';
        btn.style.color = '#2ECC71';
        if (getAutoReloadIgnore()) { log('IGNORE-BTN', 'Recargando pagina en 1.5s...'); setTimeout(() => { location.reload(); }, 1500); }
      } else {
        toast(`@${username} ya esta ignorado`);
      }
    });

    const sepEl = isDesktopV1 ? document.createElement('span') : document.createTextNode('|');
    if (isDesktopV1) {
      (sepEl as HTMLSpanElement).textContent = ' | ';
      (sepEl as HTMLSpanElement).style.display = 'inline-block';
      (sepEl as HTMLSpanElement).style.marginTop = '-12px';
      (sepEl as HTMLSpanElement).style.setProperty('vertical-align', 'middle', 'important');
    }
    citarLink.parentNode!.appendChild(sepEl);
    citarLink.parentNode!.appendChild(btn);
    added++;
  });
  if (added > 0 && added !== lastIgnorarAdded) { lastIgnorarAdded = added; log('IGNORE-BTN', `Ignorar a\u00F1adidos: ${added}`); }
}

// tid -> OP, most recent OP_CACHE_MAX threads
const OP_CACHE_KEY = 'fc_thread_op';
const OP_CACHE_MAX = 200;
type OpCache = Record<string, { op: string; ts: number }>;

function readOpCache(): OpCache {
  try {
    const data = JSON.parse(localStorage.getItem(OP_CACHE_KEY) || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    // Legacy single-entry format { tid, op }
    if (typeof data.tid === 'string' && typeof data.op === 'string') return { [data.tid]: { op: data.op, ts: 0 } };
    return data;
  } catch (_) { return {}; }
}

function getCachedOP(tid: string): string {
  const cache = readOpCache();
  if (!Object.prototype.hasOwnProperty.call(cache, tid)) return '';
  const entry = cache[tid];
  return entry && typeof entry.op === 'string' ? entry.op : '';
}

function cacheOP(tid: string, op: string): void {
  if (!tid || !op) return;
  const cache = readOpCache();
  cache[tid] = { op, ts: Date.now() };
  Object.keys(cache).sort((a, b) => (cache[b]?.ts || 0) - (cache[a]?.ts || 0)).slice(OP_CACHE_MAX).forEach((k) => { delete cache[k]; });
  try { localStorage.setItem(OP_CACHE_KEY, JSON.stringify(cache)); } catch (_) { /* ignore */ }
}

// Only page 1 reached by ?t= (no permalink/goto) is known to start with the OP's post
function isVerifiedFirstPage(): boolean {
  const q = new URLSearchParams(window.location.search);
  if (q.has('p') || q.has('goto')) return false;
  return (q.get('page') || '1') === '1';
}

const opRequests = new Map<string, Promise<string>>();

// Reads the OP from page 1 of the thread. One request per thread and page load.
export function fetchThreadOP(tid: string): Promise<string> {
  let req = opRequests.get(tid);
  if (!req) {
    req = fetch(`https://forocoches.com/foro/showthread.php?t=${tid}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((html) => {
        const op = html ? detectAdapter().getOPAuthor(new DOMParser().parseFromString(html, 'text/html')) : '';
        if (op) cacheOP(tid, op);
        log('OP', `OP del hilo ${tid}: ${op || 'NO ENCONTRADO'}`);
        return op;
      })
      .catch(() => '');
    opRequests.set(tid, req);
  }
  return req;
}

export function resolveThreadOP(tid: string): Promise<string> {
  const cached = getCachedOP(tid);
  return cached ? Promise.resolve(cached) : fetchThreadOP(tid);
}

export function highlightOPPosts(): void {
  if (!getHighlightOP()) return;
  if (window.location.pathname.indexOf('showthread.php') === -1) return;

  const tid = getCurrentThreadId();
  let op = tid ? getCachedOP(tid) : '';
  if (!op && isVerifiedFirstPage()) {
    op = detectAdapter().getOPAuthor(document);
    if (op) cacheOP(tid, op);
  }
  if (op) { applyOPHighlight(op); return; }
  if (!tid || isVerifiedFirstPage()) return;
  fetchThreadOP(tid).then((fetched) => { if (fetched && getHighlightOP()) applyOPHighlight(fetched); });
}

function applyOPHighlight(op: string): void {
  const ad = detectAdapter();
  const bgColor = getHighlightOPColor();
  const allPosts = document.querySelectorAll<HTMLElement>('li.postbit, div[id^="edit"]');
  if (allPosts.length === 0) return;

  allPosts.forEach((post) => {
    if (post.style.display === 'none') return;
    if (post.querySelector('.fc-op-badge')) return;

    const author = findPostAuthor(post);
    if (!author || author !== op) return;

    if (ad.theme === 'mobile-v1') {
      const parentUl = post.closest('ul');
      if (parentUl) {
        const linkRows = Array.from(parentUl.querySelectorAll<HTMLElement>('li.link'));
        const postbits = Array.from(parentUl.querySelectorAll<HTMLElement>('li.postbit'));
        const idx = postbits.indexOf(post);
        const linkRow = linkRows[idx];

        post.style.setProperty('background-color', bgColor, 'important');
        post.style.setProperty('background-image', 'none', 'important');

        const styleId = 'fcp-op-highlight-style';
        if (!document.getElementById(styleId)) {
          const s = document.createElement('style');
          s.id = styleId;
          s.textContent = '.fc-op-highlight{position:relative!important}.fc-op-highlight::before{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 4px #FF6B35,0 2px 8px rgba(255,107,53,0.3);border-radius:inherit;pointer-events:none;z-index:2}';
          document.head.appendChild(s);
        }
        parentUl.classList.add('fc-op-highlight');
        parentUl.style.setProperty('border-width', '0px', 'important');
        parentUl.style.setProperty('padding', '1px', 'important');
        parentUl.style.setProperty('border-color', '#FF6B35', 'important');
        parentUl.style.setProperty('border-radius', '10px', 'important');
        parentUl.style.setProperty('overflow', 'hidden', 'important');

        if (linkRow) {
          linkRow.style.setProperty('background-color', bgColor, 'important');
          linkRow.style.setProperty('background-image', 'none', 'important');
        }

        const posthead = post.querySelector('.posthead');
        if (posthead) {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:stretch;gap:6px;';
          const badgeCol = document.createElement('span');
          badgeCol.className = 'fc-op-badge';
          badgeCol.textContent = '\uD83D\uDCCC OP';
          badgeCol.style.cssText = 'display:flex;align-items:center;background:#FF6B35;color:white;font-size:10px;font-weight:bold;padding:2px 5px;border-radius:3px;flex-shrink:2;margin-bottom:12px;margin-top:12px;margin-left:2px;';
          const infoCol = document.createElement('div');
          infoCol.style.cssText = 'display:flex;flex-direction:column;flex:1;';
          const topRow = document.createElement('div');
          topRow.style.cssText = 'display:flex;align-items:center;';
          const xsaid = posthead.querySelector('.xsaid');
          const avatarLink = posthead.querySelector('a.fpostuseravatarlink');
          const postdate = posthead.querySelector('.postdate');
          posthead.innerHTML = '';
          if (xsaid) topRow.appendChild(xsaid);
          if (avatarLink) {
            (avatarLink as HTMLElement).style.marginLeft = 'auto';
            topRow.appendChild(avatarLink);
          }
          infoCol.appendChild(topRow);
          if (postdate) {
            infoCol.appendChild(postdate);
            (postdate as HTMLElement).style.marginTop = '-2px';
          }
          row.appendChild(badgeCol);
          row.appendChild(infoCol);
          posthead.appendChild(row);
        }
      } else {
      post.style.background = bgColor;
      const postTable = post.querySelector<HTMLElement>('table[id^="post"]');
      if (postTable) {
        postTable.style.border = '4px solid #FF6B35';
        postTable.style.borderRadius = '8px';
        postTable.style.boxShadow = '0 2px 12px rgba(255,107,53,0.25)';
        postTable.querySelectorAll('td, th').forEach(el => {
          (el as HTMLElement).style.setProperty('background-color', bgColor, 'important');
        });
      }

      const firstAuthorLink = post.querySelector<HTMLAnchorElement>('a[href*="member.php?u="], a.bigusername[href*="member.php"]');
      if (firstAuthorLink) {
        const badge = document.createElement('span');
        badge.className = 'fc-op-badge';
        badge.textContent = '\uD83D\uDCCC OP';
        badge.style.cssText = `display:inline-block;background:#FF6B35;color:white;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:4px;margin-right:8px;line-height:1.5;`;
        firstAuthorLink.parentNode?.insertBefore(badge, firstAuthorLink);
      }
      }
    } else {
    let target: HTMLElement = post;
    if (post.classList.contains('postbit_wrapper')) {
      const innerUl = post.querySelector('ul');
      if (innerUl) {
        target = innerUl;
        innerUl.querySelectorAll('[style*="background-color"]').forEach(el => {
          if (el !== innerUl) (el as HTMLElement).style.setProperty('background-color', 'transparent', 'important');
        });
        const borderDiv = innerUl.querySelector<HTMLElement>('div[style*="border-left"]');
        if (borderDiv) borderDiv.style.borderLeft = 'none';
        innerUl.querySelectorAll('.quote').forEach(el => {
          (el as HTMLElement).style.background = '#fff';
        });
      }
    } else if (ad.theme === 'desktop-v1') {
      const postTable = post.querySelector<HTMLElement>('table[id^="post"]');
      if (postTable) {
        post.style.setProperty('background', 'transparent', 'important');
        target = postTable;
        postTable.querySelectorAll('td, th').forEach(el => {
          (el as HTMLElement).style.setProperty('background-color', bgColor, 'important');
          (el as HTMLElement).style.setProperty('background-image', 'none', 'important');
        });
        const quoteDiv = postTable.querySelector<HTMLElement>('div[style*="margin:20px"]');
        if (quoteDiv) {
          quoteDiv.style.borderRadius = '8px';
          quoteDiv.style.border = '1px solid black';
          quoteDiv.style.background = '#fff';
          const innerQuote = quoteDiv.querySelector<HTMLElement>('td.alt2');
          if (innerQuote) innerQuote.style.background = '#fff';
        }
        let next = postTable.nextElementSibling;
        while (next) {
          (next as HTMLElement).style.display = 'none';
          next = next.nextElementSibling;
        }
      }
    } else if (ad.theme === 'desktop-v2') {
      const section = post.querySelector<HTMLElement>('section');
      if (section) {
        target = section;
        section.querySelectorAll('.quote').forEach(el => {
          (el as HTMLElement).style.background = '#fff';
        });
      }
    }
    target.style.setProperty('box-sizing', 'border-box', 'important');
    target.style.setProperty('background', bgColor, 'important');
    target.style.setProperty('border', '4px solid #FF6B35', 'important');
    target.style.setProperty('border-radius', '8px', 'important');
    target.style.setProperty('box-shadow', '0 2px 12px rgba(255,107,53,0.25)', 'important');

    const firstAuthorLink = post.querySelector<HTMLAnchorElement>('a[href*="member.php?u="], a.bigusername[href*="member.php"]');
    if (firstAuthorLink) {
      const badge = document.createElement('span');
      badge.className = 'fc-op-badge';
      badge.textContent = '\uD83D\uDCCC OP';
      badge.style.cssText = 'display:inline-block;background:#FF6B35;color:white;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:4px;margin-right:8px;line-height:1.5;';
      firstAuthorLink.parentNode?.insertBefore(badge, firstAuthorLink);
    }
    }
  });
}
