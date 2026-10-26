import { log } from './toast';
import { getThreadsPerPage } from './config';
import { detectAdapter } from './dom-adapter';

const PAGE_REGEX = /[?&]page=(\d+)/;
// Forum pagination only: thread rows also carry showthread.php?t=N&page=K mini-pagination
const FORUM_PAGE_LINKS = 'a[href*="forumdisplay.php"][href*="page="]';
const TITLE_RANGE = /Mostrar\s+resultados?\s+del\s+([\d.]+)\s+al\s+([\d.]+)\s+de\s+([\d.]+)/i;
const TITLE_RANGE2 = /Mostrando\s+(resultados|temas)\s+del\s+([\d.]+)\s+al\s+([\d.]+)\s+de\s+([\d.]+)/i;

function fmt(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function unfmt(s: string): number {
  return parseInt(s.replace(/\./g, ''), 10);
}

function getUrlPage(): number {
  const m = window.location.href.match(PAGE_REGEX);
  return m ? parseInt(m[1], 10) : 1;
}

function buildPageUrl(href: string, page: number): string {
  const clean = href.replace(PAGE_REGEX, '');
  const sep = clean.indexOf('?') === -1 ? '?' : '&';
  return clean + sep + 'page=' + page;
}

function getThreadIdFromHref(href: string): string {
  const m = href.match(/t=(\d+)/);
  return m ? m[1] : href;
}

function getRealTotalPages(): number {
  let max = 0;
  document.querySelectorAll<HTMLAnchorElement>(FORUM_PAGE_LINKS).forEach((a) => {
    const m = a.href.match(PAGE_REGEX);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return max;
}

function isArrowLink(a: HTMLAnchorElement): boolean {
  const txt = (a.textContent || '').trim();
  return txt === '' || /[<>«»‹›◀▶▲▼←→↑↓]/.test(txt) || a.querySelector('span[style*="background-image"]') !== null;
}

function removePaginationLink(a: HTMLAnchorElement): void {
  const parent = a.parentNode;
  a.remove();
  const parentEl = parent as HTMLElement | null;
  if (parentEl && (parentEl.tagName === 'TD' || parentEl.tagName === 'LI' || parentEl.tagName === 'SPAN')) {
    const txt = (parentEl.textContent || '').trim();
    if (!txt) parentEl.remove();
  }
}

function rewriteLinkTitle(a: HTMLAnchorElement, virtualPage: number, tpp: number): void {
  const title = a.getAttribute('title');
  if (!title) return;
  const titleTotal = title.match(/de\s+([\d.]+)/i);
  if (!titleTotal) return;
  const total = unfmt(titleTotal[1]);
  const newFrom = (virtualPage - 1) * tpp + 1;
  const newTo = Math.min(virtualPage * tpp, total);
  a.setAttribute('title', title.replace(/del\s+[\d.]+\s+al\s+[\d.]+/, 'del ' + fmt(newFrom) + ' al ' + fmt(newTo)));
}

function rewriteLinks(mult: number, tpp: number, currentRealPage: number, realTotalPages: number): void {
  const seenVirtual = new Set<number>();
  const currentVirtual = Math.ceil(currentRealPage / mult);
  const virtualTotal = Math.ceil(realTotalPages / mult);

  document.querySelectorAll<HTMLAnchorElement>(FORUM_PAGE_LINKS).forEach((a) => {
    const m = a.href.match(PAGE_REGEX);
    if (!m) return;
    const realPage = parseInt(m[1], 10);
    const virtualPage = Math.ceil(realPage / mult);

    // Arrow links → point to adjacent virtual page
    if (isArrowLink(a)) {
      const isFirst = realPage === 1 && realPage < currentRealPage;
      const isLast = realPage === realTotalPages && realPage > currentRealPage;
      const isPrev = !isFirst && realPage < currentRealPage;
      const isNext = !isLast && realPage > currentRealPage;

      if (isFirst) {
        a.setAttribute('href', a.getAttribute('href')!.replace(/page=(\d+)/gi, 'page=1'));
        rewriteLinkTitle(a, 1, tpp);
      } else if (isLast) {
        const lastVirtual = (virtualTotal - 1) * mult + 1;
        a.setAttribute('href', a.getAttribute('href')!.replace(/page=(\d+)/gi, 'page=' + lastVirtual));
        rewriteLinkTitle(a, virtualTotal, tpp);
      } else if (isPrev && currentVirtual > 1) {
        const targetReal = (currentVirtual - 2) * mult + 1;
        a.setAttribute('href', a.getAttribute('href')!.replace(/page=(\d+)/gi, 'page=' + targetReal));
        rewriteLinkTitle(a, currentVirtual - 1, tpp);
      } else if (isNext && currentVirtual < virtualTotal) {
        const targetReal = currentVirtual * mult + 1;
        a.setAttribute('href', a.getAttribute('href')!.replace(/page=(\d+)/gi, 'page=' + Math.min(targetReal, realTotalPages)));
        rewriteLinkTitle(a, currentVirtual + 1, tpp);
      }
      return;
    }

    // Same virtual page as current → remove entirely (it's within current page's range)
    if (virtualPage === currentVirtual) {
      removePaginationLink(a);
      return;
    }

    // Duplicate virtual page → remove entirely
    if (seenVirtual.has(virtualPage)) {
      removePaginationLink(a);
      return;
    }
    seenVirtual.add(virtualPage);

    // Rewrite href to first real page of this virtual page
    const realBase = (virtualPage - 1) * mult + 1;
    const href = a.getAttribute('href') || a.href;
    a.setAttribute('href', href.replace(/page=(\d+)/gi, 'page=' + realBase));

    // Update visible text to virtual page number (if it's a plain number)
    const txt = (a.textContent || '').trim();
    if (/^\d+$/.test(txt)) {
      a.textContent = String(virtualPage);
    }

    // Rewrite title to show virtual page range
    rewriteLinkTitle(a, virtualPage, tpp);
  });
}

function rewriteTitles(tpp: number): void {
  document.querySelectorAll<HTMLElement>('[title*="Mostrar"], [title*="Mostrando"]').forEach((el) => {
    const t = el.getAttribute('title');
    if (!t) return;

    let m = t.match(TITLE_RANGE);
    if (m) {
      const from = unfmt(m[1]);
      const vp = Math.ceil(from / 40);
      const newFrom = (vp - 1) * tpp + 1;
      const newTo = Math.min(vp * tpp, unfmt(m[3]));
      el.setAttribute('title', t.replace(TITLE_RANGE, 'Mostrar resultados del ' + fmt(newFrom) + ' al ' + fmt(newTo) + ' de $3'));
      return;
    }

    m = t.match(TITLE_RANGE2);
    if (m) {
      const from = unfmt(m[2]);
      const vp = Math.ceil(from / 40);
      const newFrom = (vp - 1) * tpp + 1;
      const newTo = Math.min(vp * tpp, unfmt(m[4]));
      el.setAttribute('title', t.replace(TITLE_RANGE2, 'Mostrando ' + m[1] + ' del ' + fmt(newFrom) + ' al ' + fmt(newTo) + ' de $4'));
    }
  });
}

function rewriteNavText(mult: number, totalPages: number): void {
  const virtualTotal = Math.ceil(totalPages / mult);

  const navContainers = document.querySelectorAll('.pagenav-desktop, .pagenav-mobile, .pagenav, [class*="pagenav"], ul.ulpagenav');
  navContainers.forEach((nav) => {
    const walker = document.createTreeWalker(nav, 4, null);
    const nodesToFix: { node: Text; newVal: string }[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const val = node.textContent || '';

      // "1 / 37" pattern (single text node)
      const slashMatch = val.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
      if (slashMatch) {
        nodesToFix.push({ node, newVal: val.replace(/\d+\s*\/\s*\d+/, Math.ceil(parseInt(slashMatch[1], 10) / mult) + ' / ' + virtualTotal) });
        continue;
      }

      // " / " separator (mobile pagenav: " 1 ", " / ", " 37 " in 3 sibling spans)
      const sepSlash = val.match(/^\s*\/\s*$/);
      if (sepSlash) {
        const parent = node.parentNode;
        const grand = parent?.parentNode;
        if (grand) {
          const spans = Array.from(grand.children).filter((c) => c.tagName === 'SPAN');
          for (let si = 1; si < spans.length - 1; si++) {
            if (spans[si] === parent && spans[si - 1] && spans[si + 1]) {
              // Fix left number
              const leftNum = spans[si - 1].textContent?.match(/(\d+)/);
              if (leftNum) {
                spans[si - 1].textContent = spans[si - 1].textContent!.replace(/\d+/, String(Math.ceil(parseInt(leftNum[1], 10) / mult)));
              }
              // Fix right number (total pages)
              spans[si + 1].textContent = String(virtualTotal);
              break;
            }
          }
        }
        continue;
      }

      // "Pág 1 de 35"
      const pagMatch = val.match(/P[aá]g\s*\.?\s*(\d+)\s+de\s+(\d+)/i);
      if (pagMatch) {
        nodesToFix.push({ node, newVal: val.replace(pagMatch[0], 'P\u00E1g ' + Math.ceil(parseInt(pagMatch[1], 10) / mult) + ' de ' + virtualTotal) });
        continue;
      }

    }
    nodesToFix.forEach(({ node, newVal }) => {
      node.textContent = newVal;
    });
  });
}

let paginatedFor = '';

export function enhancePagination(): void {
  const tpp = getThreadsPerPage();
  if (tpp <= 40) return;

  const mult = Math.round(tpp / 40);
  if (mult < 2) return;

  // run() fires on every DOM mutation: enhance each page load only once
  if (paginatedFor === window.location.href) return;
  paginatedFor = window.location.href;

  const urlPage = getUrlPage();

  // urlPage is always a REAL server page number
  // Calculate which virtual page this real page belongs to
  const virtualPage = Math.ceil(urlPage / mult);
  const realStart = (virtualPage - 1) * mult + 1;

  // If URL points to a non-base page within a virtual group, redirect to the base
  if (realStart !== urlPage) {
    const newUrl = buildPageUrl(window.location.href, realStart);
    log('PAGINATION', 'Redirect page ' + urlPage + ' -> base page ' + realStart + ' (virtual ' + virtualPage + ')');
    window.location.href = newUrl;
    return;
  }

  const ad = detectAdapter();
  const parent = ad.getThreadListParent();
  if (!parent) { log('PAGINATION', 'No thread list parent found'); return; }

  // Read real total pages before rewriting
  const realTotalPages = getRealTotalPages();
  if (realTotalPages <= 1) return;

  // Build set of existing thread IDs from current DOM
  const existingIds = new Set<string>();
  document.querySelectorAll<HTMLAnchorElement>('a[href*="showthread.php?t="]').forEach((a) => {
    const id = getThreadIdFromHref(a.href);
    if (id) existingIds.add(id);
  });

  // Extra pages to merge (realStart+1 ... realStart+mult-1)
  const baseUrl = window.location.href.replace(PAGE_REGEX, '').replace(/[?&]$/, '');
  const pageNums: number[] = [];
  for (let i = 1; i < mult; i++) {
    const p = realStart + i;
    if (p <= realTotalPages) pageNums.push(p);
  }
  if (pageNums.length === 0) return;

  // Rewrite titles on non-link elements (current page indicator) first
  rewriteTitles(tpp);
  // Then rewrite links (hrefs, texts, and their titles)
  rewriteLinks(mult, tpp, realStart, realTotalPages);
  rewriteNavText(mult, realTotalPages);

  const forUrl = paginatedFor;
  const requests = pageNums.map((pageNum) =>
    fetch(buildPageUrl(baseUrl, pageNum), { credentials: 'include' })
      .then((r) => {
        if (!r.ok) { log('PAGINATION', 'Fetch page ' + pageNum + ' failed: ' + r.status); return ''; }
        return r.text();
      })
      .catch((e) => { log('PAGINATION', 'Error fetching page ' + pageNum + ': ' + e); return ''; }));

  // Append in page order; the resulting mutations make the observer re-run the filters on them
  Promise.all(requests).then((pages) => {
    if (paginatedFor !== forUrl || !parent.isConnected) return;
    let totalAdded = 0;
    pages.forEach((html) => {
      if (!html) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll<HTMLAnchorElement>('a[href*="showthread.php?t="], a[id^="thread_title_"]').forEach((link) => {
        const href = link.getAttribute('href') || link.href;
        const id = getThreadIdFromHref(href);
        if (!id || existingIds.has(id)) return;
        existingIds.add(id);

        const container = ad.getThreadContainer(link);
        if (!container) return;
        parent.appendChild(container.cloneNode(true));

        const sep = ad.getSeparator(container);
        if (sep) parent.appendChild(sep.cloneNode(true));

        totalAdded++;
      });
    });
    if (totalAdded > 0) log('PAGINATION', 'Added ' + totalAdded + ' threads from pages ' + pageNums.join(', '));
  });
}
