import { cleanUser } from './utils';

export type Theme = 'mobile-v1' | 'mobile-v2' | 'desktop-v1' | 'desktop-v2';

export interface DomAdapter {
  readonly theme: Theme;
  getThreadContainer(anchor: HTMLAnchorElement): HTMLElement | null;
  getExtraContainer(container: HTMLElement): HTMLElement | null;
  getMessageCount(container: HTMLElement | null, extraContainer: HTMLElement | null): number;
  getThreadAuthor(container: HTMLElement | null, extraContainer: HTMLElement | null, title: string): string;
  getSummaryTarget(): HTMLElement | null;
  getPostContainer(element: HTMLElement): HTMLElement | null;
  getLinkRow(post: HTMLElement): HTMLElement | null;
  getSeparator(container: HTMLElement): HTMLElement | null;
  getOPAuthor(doc: Document): string;
  getThreadListParent(): HTMLElement | null;
  getThreadId(container: HTMLElement): string;
}

// "@user - Actualizado ..." → "user". Names may contain spaces, ñ, accents and
// symbols, so capture anything up to the date separator (no '@', bounded length).
const AUTHOR_DATE_RE = /@([^@\n]{1,40}?)\s*-\s*(?:Actualizado|Ayer|Hoy|Anteayer)/i;

function matchAuthorBeforeDate(text: string): string {
  const m = text.match(AUTHOR_DATE_RE);
  return m ? m[1].replace(/\s+/g, ' ').trim().toLowerCase() : '';
}

// ── Detection ────────────────────────────────────────────

function detectTheme(): Theme {
  // desktop-v2: section.without-top-corners (forumdisplay)
  if (document.querySelector('section.without-top-corners')) return 'desktop-v2';
  // desktop-v1: table#threadslist (forumdisplay)
  if (document.querySelector('table#threadslist')) return 'desktop-v1';
  // mobile-v2: div.threads-list (forumdisplay) or postbit_wrapper (showthread)
  if (document.querySelector('div.threads-list, div.postbit_wrapper')) return 'mobile-v2';
  // desktop-v1 showthread (vBulletin post table, no threadlist)
  if (document.querySelector('table[id^="post"]')) return 'desktop-v1';
  // Other pages (member.php, profile.php): generic layout markers
  const isMobileLayout = !!document.querySelector('.page-margin');
  if (document.querySelector('.user-notifications-count-wrapper')) return isMobileLayout ? 'mobile-v2' : 'desktop-v2';
  if (document.querySelector('.tborder') && !isMobileLayout) return 'desktop-v1';
  // mobile-v1 fallback
  return 'mobile-v1';
}

let cachedAdapter: DomAdapter | null = null;

export function detectAdapter(): DomAdapter {
  if (!cachedAdapter) {
    const t = detectTheme();
    if (t === 'mobile-v1') cachedAdapter = createMobileV1Adapter();
    else if (t === 'mobile-v2') cachedAdapter = createMobileV2Adapter();
    else if (t === 'desktop-v1') cachedAdapter = createDesktopV1Adapter();
    else cachedAdapter = createDesktopV2Adapter();
  }
  return cachedAdapter;
}

export function resetAdapter(): void {
  cachedAdapter = null;
}

// ── Mobile-v1 adapter (legacy mobile) ────────────────────

function createMobileV1Adapter(): DomAdapter {
  function getThreadContainer(anchor: HTMLAnchorElement): HTMLElement | null {
    const li = anchor.closest('li');
    if (li) return li;

    let parent: HTMLElement | null = anchor.parentNode as HTMLElement;
    for (let i = 0; i < 15; i++) {
      if (!parent) break;
      if (parent.tagName === 'DIV' && parent.parentNode && (parent.parentNode as HTMLElement).tagName === 'SECTION') return parent;
      if (parent.tagName === 'SECTION') {
        const children = parent.children;
        for (let childIdx = 0; childIdx < children.length; childIdx++) {
          if (children[childIdx].contains(anchor)) return children[childIdx] as HTMLElement;
        }
        break;
      }
      parent = parent.parentNode as HTMLElement;
    }

    const tr = anchor.closest('tr');
    if (tr) return tr;

    return anchor.parentNode as HTMLElement;
  }

  function getExtraContainer(container: HTMLElement): HTMLElement | null {
    if (container.tagName === 'LI') {
      const nextLI = container.nextElementSibling;
      if (nextLI && nextLI.tagName === 'LI') return nextLI as HTMLElement;
    }
    return null;
  }

  function getMessageCount(container: HTMLElement | null, extraContainer: HTMLElement | null): number {
    if (!container) return -1;
    const text = (container.textContent || '').replace(/\xA0/g, ' ');

    const msgMatch = text.match(/(\d+)\s*Mensajes?/i);
    if (msgMatch) return parseInt(msgMatch[1], 10);

    const countMatch = text.match(/(\d+)\s+@\s+[a-zA-Z0-9_\-.]+/i);
    if (countMatch) return parseInt(countMatch[1], 10);

    const respMatch = text.match(/(\d+)\s*Respuestas?/i);
    if (respMatch) return parseInt(respMatch[1], 10);

    if (extraContainer) {
      const extraText = extraContainer.textContent.trim();
      const m = extraText.match(/^\d+\s*Mensajes?\s*,/i);
      if (m) {
        const cm = extraText.match(/^(\d+)/);
        if (cm) return parseInt(cm[1], 10);
      }
    }

    return -1;
  }

  function extractAuthorLegacy(container: HTMLElement | null): string {
    if (!container) return '';

    try {
      const author = matchAuthorBeforeDate(container.textContent || '');
      if (author) return author;
    } catch (_) { /* ignore */ }

    try {
      const elements = container.querySelectorAll('*');
      for (let i = elements.length - 1; i >= 0; i--) {
        const text = elements[i].textContent.trim();
        if (text.indexOf('@') === 0) {
          if (text.indexOf(' - ') !== -1) return text.split(' - ')[0].substring(1).toLowerCase();
          const parts = text.replace('@', '').split(/[\s]+/);
          if (parts.length > 0 && parts[0]) return parts[0].toLowerCase();
        }
      }
    } catch (_) { /* ignore */ }

    try {
      const memberLink = container.querySelector('a[href*="member.php"]') as HTMLAnchorElement | null;
      if (memberLink) return cleanUser(memberLink.textContent);
    } catch (_) { /* ignore */ }

    try {
      const postLinks = container.querySelectorAll('a[href*="showthread.php?p="], a[href*="#post"]');
      for (let linkIdx = 0; linkIdx < postLinks.length; linkIdx++) {
        const linkText = postLinks[linkIdx].textContent.trim();
        const match = linkText.match(/@([a-zA-Z0-9_\-\.]+)/);
        if (match) return match[1].toLowerCase();
      }
    } catch (_) { /* ignore */ }

    return '';
  }

  function getThreadAuthor(container: HTMLElement | null, extraContainer: HTMLElement | null): string {
    if (!container) return '';

    if (extraContainer) {
      const nextText = extraContainer.textContent.trim();
      const m = nextText.match(/^\d+\s*Mensajes?\s*,/i);
      if (m) {
        const userMatch = nextText.match(/\)\s+(.+)$/);
        if (userMatch) return userMatch[1].trim().toLowerCase();
      }
    }

    return extractAuthorLegacy(container);
  }

  function getSummaryTarget(): HTMLElement | null {
    const sections = document.querySelectorAll('section');
    if (sections.length > 0) return sections[sections.length - 1];
    return document.querySelector('div.threads-list') || document.querySelector('main') || document.querySelector('#threadslist') || document.body;
  }

  function getPostContainer(element: HTMLElement): HTMLElement | null {
    let parentEl: HTMLElement | null = element.parentNode as HTMLElement;
    while (parentEl && parentEl !== document.body) {
      if (/^edit\d+$/.test(parentEl.id)) return parentEl;
      if (parentEl.tagName === 'LI' && parentEl.classList.contains('link')) {
        const ul = parentEl.closest('ul');
        if (ul) return ul.querySelector<HTMLElement>('li.postbit');
        return null;
      }
      if (parentEl.tagName === 'LI' && parentEl.classList.contains('postbit')) {
        return parentEl;
      }
      parentEl = parentEl.parentNode as HTMLElement;
    }
    return null;
  }

  function getLinkRow(post: HTMLElement): HTMLElement | null {
    if (post.tagName === 'LI' && post.classList.contains('postbit')) {
      const ul = post.closest('ul');
      if (ul) return ul.querySelector<HTMLElement>('li.link');
    }
    return null;
  }

  function getSeparator(): HTMLElement | null {
    return null;
  }

  function getOPAuthor(doc: Document): string {
    const firstPost = doc.querySelector<HTMLElement>('div[id^="edit"], li.postbit');
    if (firstPost) {
      const memberLinks = firstPost.querySelectorAll<HTMLAnchorElement>('a[href*="member.php?u="]');
      for (let i = 0; i < memberLinks.length; i++) {
        const txt = memberLinks[i].textContent.trim();
        if (txt) return cleanUser(txt);
      }
    }
    return '';
  }

  function getThreadListParent(): HTMLElement | null {
    const sections = document.querySelectorAll('section');
    if (sections.length > 0) return sections[sections.length - 1];
    return document.querySelector('main') || document.querySelector('#threadslist') || document.body;
  }

  function getThreadId(container: HTMLElement): string {
    const a = container.querySelector<HTMLAnchorElement>('a[href*="showthread.php?t="]');
    if (a) {
      const m = a.href.match(/t=(\d+)/);
      if (m) return m[1];
    }
    return container.id || container.className || '';
  }

  return {
    theme: 'mobile-v1' as Theme,
    getThreadContainer,
    getExtraContainer,
    getMessageCount,
    getThreadAuthor,
    getSummaryTarget,
    getPostContainer,
    getLinkRow,
    getSeparator,
    getOPAuthor,
    getThreadListParent,
    getThreadId,
  };
}

// ── Mobile-v2 adapter ────────────────────────────────────

function createMobileV2Adapter(): DomAdapter {
  function getThreadContainer(anchor: HTMLAnchorElement): HTMLElement | null {
    let el: HTMLElement | null = anchor.parentElement;
    for (let i = 0; i < 10 && el; i++) {
      if (el.parentElement && el.parentElement.classList.contains('threads-list')) return el;
      el = el.parentElement as HTMLElement;
    }
    return null;
  }

  function getExtraContainer(): HTMLElement | null {
    return null;
  }

  function getMessageCount(container: HTMLElement | null): number {
    if (!container) return -1;
    const text = (container.textContent || '').replace(/\xA0/g, ' ');

    const msgMatch = text.match(/(\d+)\s*Mensajes?/i);
    if (msgMatch) return parseInt(msgMatch[1], 10);

    const countMatch = text.match(/(\d+)\s+@\s+[a-zA-Z0-9_\-.]+/i);
    if (countMatch) return parseInt(countMatch[1], 10);

    return -1;
  }

  function extractAuthorMobileV2(container: HTMLElement | null): string {
    if (!container) return '';

    const sep = container.nextElementSibling;
    if (sep && sep.tagName === 'SEPARATOR') {
      const sepText = sep.textContent || '';
      const m = sepText.match(/@([a-zA-Z0-9_\-.\xA0]+)/i);
      if (m) return m[1].replace(/\xA0/g, '').toLowerCase();
    }

    const parentArea = container.parentElement;
    if (parentArea) {
      const memberLinks = parentArea.querySelectorAll<HTMLAnchorElement>('a[href*="member.php"]');
      for (let i = 0; i < memberLinks.length; i++) {
        const name = cleanUser(memberLinks[i].textContent);
        if (name) return name;
      }
    }

    const fullText1 = container.textContent || '';
    const arrMatches = fullText1.match(/@([a-zA-Z0-9_\-.\xA0]+)/gi);
    if (arrMatches && arrMatches.length > 0) {
      const first = arrMatches[0].replace('@', '').replace(/\xA0/g, '').toLowerCase();
      if (first) return first;
    }

    const fullText2 = container.textContent || '';
    const m4 = fullText2.match(/(\d+)\s+@\s+([a-zA-Z0-9_\-.]+)/i);
    if (m4 && m4[2]) {
      const user = m4[2].replace(/\xA0/g, '').toLowerCase();
      if (user.length >= 2 && user.length <= 25 && /[a-zA-Z]/.test(user)) return user;
    }

    return '';
  }

  function getThreadAuthor(container: HTMLElement | null): string {
    return extractAuthorMobileV2(container);
  }

  function getSummaryTarget(): HTMLElement | null {
    return document.querySelector('div.threads-list') || document.querySelector('section') || document.querySelector('main') || document.querySelector('#threadslist') || document.body;
  }

  function getPostContainer(element: HTMLElement): HTMLElement | null {
    let parentEl: HTMLElement | null = element.parentNode as HTMLElement;
    while (parentEl && parentEl !== document.body) {
      if (/^edit\d+$/.test(parentEl.id)) return parentEl;
      parentEl = parentEl.parentNode as HTMLElement;
    }
    return null;
  }

  function getLinkRow(): HTMLElement | null {
    return null;
  }

  function getSeparator(container: HTMLElement): HTMLElement | null {
    const sep = container.nextElementSibling;
    if (sep && (sep.tagName === 'SEPARATOR' || sep.tagName === 'SEPARATOR-LARGE')) return sep as HTMLElement;
    return null;
  }

  function getOPAuthor(doc: Document): string {
    const firstPost = doc.querySelector<HTMLElement>('div[id^="edit"], li.postbit');
    if (firstPost) {
      const memberLinks = firstPost.querySelectorAll<HTMLAnchorElement>('a[href*="member.php?u="]');
      for (let i = 0; i < memberLinks.length; i++) {
        const txt = memberLinks[i].textContent.trim();
        if (txt) return cleanUser(txt);
      }
    }
    return '';
  }

  function getThreadListParent(): HTMLElement | null {
    return document.querySelector('div.threads-list');
  }

  function getThreadId(container: HTMLElement): string {
    const a = container.querySelector<HTMLAnchorElement>('a[href*="showthread.php?t="]');
    if (a) {
      const m = a.href.match(/t=(\d+)/);
      if (m) return m[1];
    }
    return container.id || container.className || '';
  }

  return {
    theme: 'mobile-v2' as Theme,
    getThreadContainer,
    getExtraContainer,
    getMessageCount,
    getThreadAuthor,
    getSummaryTarget,
    getPostContainer,
    getLinkRow,
    getSeparator,
    getOPAuthor,
    getThreadListParent,
    getThreadId,
  };
}

// ── Desktop-v1 adapter (old PC design) ───────────────────

function createDesktopV1Adapter(): DomAdapter {
  function getThreadContainer(anchor: HTMLAnchorElement): HTMLElement | null {
    return anchor.closest('tr');
  }

  function getExtraContainer(): HTMLElement | null {
    return null;
  }

  function getMessageCount(container: HTMLElement | null): number {
    if (!container) return -1;
    const titleTd = container.querySelector<HTMLTableCellElement>('td[title*="Respuestas:" i]');
    if (titleTd) {
      const m = titleTd.title.match(/Respuestas:\s*([\d.]+)/i);
      if (m) {
        const count = parseInt(m[1].replace(/\./g, ''), 10);
        if (!isNaN(count)) return count;
      }
    }
    const whoPostedLink = container.querySelector<HTMLAnchorElement>('a[onclick*="who("]');
    if (whoPostedLink) {
      const count = parseInt(whoPostedLink.textContent!.replace(/\./g, ''), 10);
      if (!isNaN(count)) return count;
    }
    const strong = container.querySelector<HTMLElement>('td.alt1 strong');
    if (strong) {
      const count = parseInt(strong.textContent!.replace(/\./g, ''), 10);
      if (!isNaN(count)) return count;
    }
    const text = container.textContent || '';
    const msgMatch = text.match(/(\d+)\s*Mensajes?/i);
    if (msgMatch) return parseInt(msgMatch[1], 10);
    const respMatch = text.match(/(\d+)\s*Respuestas?/i);
    if (respMatch) return parseInt(respMatch[1], 10);
    const countMatch = text.match(/(\d+)\s+@\s+[a-zA-Z0-9_\-.]+/i);
    if (countMatch) return parseInt(countMatch[1], 10);
    return -1;
  }

  function getThreadAuthor(container: HTMLElement | null): string {
    if (!container) return '';
    const authorSpan = container.querySelector<HTMLElement>('span[onclick*="member.php?u="]');
    if (authorSpan) {
      const name = cleanUser(authorSpan.textContent);
      if (name) return name;
    }
    return matchAuthorBeforeDate(container.textContent || '');
  }

  function getSummaryTarget(): HTMLElement | null {
    return document.querySelector('table#threadslist') || document.querySelector('#threadslist') || document.querySelector('section') || document.querySelector('main') || document.body;
  }

  function getPostContainer(element: HTMLElement): HTMLElement | null {
    let parentEl: HTMLElement | null = element.parentNode as HTMLElement;
    while (parentEl && parentEl !== document.body) {
      if (/^edit\d+$/.test(parentEl.id)) return parentEl;
      if (parentEl.tagName === 'LI' && parentEl.classList.contains('postbit')) {
        return parentEl;
      }
      parentEl = parentEl.parentNode as HTMLElement;
    }
    return null;
  }

  function getLinkRow(post: HTMLElement): HTMLElement | null {
    if (post.tagName === 'LI' && post.classList.contains('postbit')) {
      const ul = post.closest('ul');
      if (ul) return ul.querySelector<HTMLElement>('li.link');
    }
    return null;
  }

  function getSeparator(): HTMLElement | null {
    return null;
  }

  function getOPAuthor(doc: Document): string {
    const firstPost = doc.querySelector<HTMLElement>('div[id^="edit"], li.postbit');
    if (firstPost) {
      const memberLinks = firstPost.querySelectorAll<HTMLAnchorElement>('a[href*="member.php?u="]');
      for (let i = 0; i < memberLinks.length; i++) {
        const txt = memberLinks[i].textContent.trim();
        if (txt) return cleanUser(txt);
      }
    }
    return '';
  }

  function getThreadListParent(): HTMLElement | null {
    const tbody = document.querySelector<HTMLElement>('table#threadslist > tbody[id^="threadbits_"]');
    if (tbody) return tbody;
    return document.querySelector<HTMLElement>('table#threadslist');
  }

  function getThreadId(container: HTMLElement): string {
    const a = container.querySelector<HTMLAnchorElement>('a[href*="showthread.php?t="]');
    if (a) {
      const m = a.href.match(/t=(\d+)/);
      if (m) return m[1];
    }
    return container.id || container.className || '';
  }

  return {
    theme: 'desktop-v1' as Theme,
    getThreadContainer,
    getExtraContainer,
    getMessageCount,
    getThreadAuthor,
    getSummaryTarget,
    getPostContainer,
    getLinkRow,
    getSeparator,
    getOPAuthor,
    getThreadListParent,
    getThreadId,
  };
}

// ── Desktop-v2 adapter (new PC design) ───────────────────

function createDesktopV2Adapter(): DomAdapter {
  function getThreadContainer(anchor: HTMLAnchorElement): HTMLElement | null {
    let el: HTMLElement | null = anchor.parentElement;
    for (let i = 0; i < 15 && el; i++) {
      if (el.parentElement?.parentElement?.classList.contains('without-top-corners')) {
        return el;
      }
      el = el.parentElement as HTMLElement;
    }
    return null;
  }

  function getExtraContainer(): HTMLElement | null {
    return null;
  }

  function getMessageCount(container: HTMLElement | null): number {
    if (!container) return -1;
    const whoPostedLink = container.querySelector<HTMLAnchorElement>('a[href*="whoposted"]');
    if (whoPostedLink) {
      const count = parseInt(whoPostedLink.textContent!.replace(/\./g, ''), 10);
      if (!isNaN(count)) return count;
    }
    const text = (container.textContent || '').replace(/\xA0/g, ' ');
    const msgMatch = text.match(/(\d+)\s*Mensajes?/i);
    if (msgMatch) return parseInt(msgMatch[1], 10);
    const countMatch = text.match(/(\d+)\s+@\s+[a-zA-Z0-9_\-.]+/i);
    if (countMatch) return parseInt(countMatch[1], 10);
    return -1;
  }

  function getThreadAuthor(container: HTMLElement | null): string {
    if (!container) return '';
    return matchAuthorBeforeDate(container.textContent || '');
  }

  function getSummaryTarget(): HTMLElement | null {
    return document.querySelector('section.without-top-corners.without-bottom-corners') || document.querySelector('section.without-top-corners') || document.querySelector('div.threads-list') || document.querySelector('section') || document.querySelector('main') || document.querySelector('#threadslist') || document.body;
  }

  function getPostContainer(element: HTMLElement): HTMLElement | null {
    let parentEl: HTMLElement | null = element.parentNode as HTMLElement;
    while (parentEl && parentEl !== document.body) {
      if (/^edit\d+$/.test(parentEl.id)) return parentEl;
      parentEl = parentEl.parentNode as HTMLElement;
    }
    return null;
  }

  function getLinkRow(): HTMLElement | null {
    return null;
  }

  function getSeparator(container: HTMLElement): HTMLElement | null {
    const sep = container.nextElementSibling;
    if (sep && (sep.tagName === 'SEPARATOR' || sep.tagName === 'SEPARATOR-LARGE')) return sep as HTMLElement;
    return null;
  }

  function getOPAuthor(doc: Document): string {
    const firstPost = doc.querySelector<HTMLElement>('div[id^="edit"], li.postbit');
    if (firstPost) {
      const memberLinks = firstPost.querySelectorAll<HTMLAnchorElement>('a[href*="member.php?u="]');
      for (let i = 0; i < memberLinks.length; i++) {
        const txt = memberLinks[i].textContent.trim();
        if (txt) return cleanUser(txt);
      }
    }
    return '';
  }

  function getThreadListParent(): HTMLElement | null {
    const sec = document.querySelector<HTMLElement>('section.without-top-corners.without-bottom-corners');
    if (!sec) return null;
    const flexDiv = sec.querySelector<HTMLElement>('div[style*="display: flex"][style*="flex-direction"]');
    return flexDiv || sec;
  }

  function getThreadId(container: HTMLElement): string {
    const a = container.querySelector<HTMLAnchorElement>('a[href*="showthread.php?t="]');
    if (a) {
      const m = a.href.match(/t=(\d+)/);
      if (m) return m[1];
    }
    return container.id || container.className || '';
  }

  return {
    theme: 'desktop-v2' as Theme,
    getThreadContainer,
    getExtraContainer,
    getMessageCount,
    getThreadAuthor,
    getSummaryTarget,
    getPostContainer,
    getLinkRow,
    getSeparator,
    getOPAuthor,
    getThreadListParent,
    getThreadId,
  };
}
