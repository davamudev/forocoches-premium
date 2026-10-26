import { toast, log } from './toast';
import { normalizeStr } from './utils';
import { findThreads } from './threads';
import type { HiddenItem, HighlightGroup } from './types';
import { getHideThreadByAuthor, getHighlightZeroMessages, getHighlightColor, getPrioritizeHighlightOverHide } from './config';
import { getHighlightUserGroups, getHighlightWordGroups } from './storage';
import { detectAdapter } from './dom-adapter';
import { STYLE } from './ui/styles';

function showHiddenSummary(hidden: HiddenItem[]): void {
  const old = document.getElementById('fc-hidden-summary');
  if (old) old.remove();

  const target = detectAdapter().getSummaryTarget();

  const wrap = document.createElement('div');
  wrap.id = 'fc-hidden-summary';
  wrap.style.cssText = STYLE.HIDDEN_SUMMARY;

  const header = document.createElement('div');
  header.style.cssText = STYLE.HIDDEN_HEADER;
  header.textContent = 'Hilos ocultos: ' + hidden.length;
  wrap.appendChild(header);

  hidden.forEach((item) => {
    const row = document.createElement('div');
    row.style.cssText = STYLE.HIDDEN_ROW;

    const el = document.createElement('span');
    if (item.highlightColor) {
      el.style.cssText = 'font-weight:bold;';
    } else {
      el.style.cssText = 'text-decoration:line-through;';
    }
    if (item.link) {
      const anchor = document.createElement('a');
      anchor.href = item.link; anchor.textContent = item.title;
      if (item.highlightColor) {
        anchor.style.cssText = 'color:inherit;font-weight:bold;';
      } else {
        anchor.style.cssText = 'color:inherit;text-decoration:line-through;';
      }
      anchor.target = '_blank';
      el.appendChild(anchor);
    } else { el.textContent = item.title; }

    const info = document.createElement('span');
    info.style.cssText = STYLE.HIDDEN_INFO;
    info.textContent = `(${item.reason})`;

    row.appendChild(el);
    row.appendChild(info);

    if (item.highlightColor) {
      row.style.background = item.highlightColor;
      row.style.borderRadius = '4px';
      row.style.padding = '3px 6px';
      row.style.margin = '2px -6px';
    }

    wrap.appendChild(row);
  });

  target!.parentNode!.insertBefore(wrap, target!.nextSibling);
}

const wordRegexCache = new Map<string, RegExp | null>();

// Whole-word match on normalized text ("culo" does not hit "vehículo").
// "*" is a wildcard for letters/digits: "polit*" matches "politica", "politicos"...
function wordRegex(word: string): RegExp | null {
  let re = wordRegexCache.get(word);
  if (re === undefined) {
    const w = normalizeStr(word).trim();
    if (!w.replace(/\*/g, '')) {
      re = null;
    } else {
      const body = w.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\p{L}\\p{N}]*');
      re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${body}(?=$|[^\\p{L}\\p{N}])`, 'u');
    }
    wordRegexCache.set(word, re);
  }
  return re;
}

export function matchesWord(normalizedText: string, word: string): boolean {
  if (typeof word !== 'string' || !word) return false;
  const re = wordRegex(word);
  return !!re && re.test(normalizedText);
}

function matchWordsInText(text: string, words: string[], prefix?: string): string {
  const normalized = normalizeStr(text);
  for (const word of words) {
    if (matchesWord(normalized, word)) {
      return `${prefix || ''}"${word}"`;
    }
  }
  return '';
}

function matchHighlightWordGroups(title: string, groups: HighlightGroup[]): { color: string; desc: string } | null {
  const normalized = normalizeStr(title);
  for (const group of groups) {
    for (const word of group.items) {
      if (matchesWord(normalized, word)) {
        return { color: group.color, desc: group.desc };
      }
    }
  }
  return null;
}

let lastHiddenCount = -1;
let lastSummaryKey = '';
let noThreadsWarnedFor = '';

// Undo previous hiding so every run recomputes from the current users/words
function restoreHidden(): void {
  document.querySelectorAll<HTMLElement>('[data-fcp-hidden]').forEach((el) => {
    el.style.display = '';
    delete el.dataset.fcpHidden;
  });
}

function markHidden(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.style.display = 'none';
  el.dataset.fcpHidden = '1';
}

export function hideThreads(users: string[], words: string[]): void {
  restoreHidden();
  const threads = findThreads();
  if (threads.length === 0) {
    if (noThreadsWarnedFor !== window.location.href) { noThreadsWarnedFor = window.location.href; toast('No se encontraron hilos'); }
    return;
  }

  const total = threads.length;
  const ad = detectAdapter();

  const hideByAuthor = getHideThreadByAuthor();
  const prioritizeHL = getPrioritizeHighlightOverHide();
  const hlUserGroups = getHighlightUserGroups();
  const hlWordGroups = getHighlightWordGroups();
  const userThemeOk = ad.theme === 'mobile-v2' || ad.theme === 'desktop-v1' || ad.theme === 'desktop-v2';

  const hidden: HiddenItem[] = [];
  const highlightMap = new Map<HTMLElement, string>();

  threads.forEach((thread) => {
    if (!thread.container) return;
    if (thread.container.style.display === 'none') return;

    let hlColor = '';
    let hlDesc = '';

    // 1) Check highlight user groups (highest priority)
    if (hlUserGroups.length > 0 && thread.author && userThemeOk) {
      for (const group of hlUserGroups) {
        if (group.items.indexOf(thread.author) !== -1) {
          hlColor = group.color;
          hlDesc = group.desc;
          break;
        }
      }
    }

    // 2) Check highlight word groups (only if no user highlight)
    if (!hlColor && hlWordGroups.length > 0 && thread.title) {
      const match = matchHighlightWordGroups(thread.title, hlWordGroups);
      if (match) {
        hlColor = match.color;
        hlDesc = match.desc;
      }
    }

    // 3) Check hide by ignored user
    let shouldHide = false;
    let hideReason = '';
    if (users.length > 0 && thread.author && userThemeOk && hideByAuthor) {
      if (users.indexOf(thread.author) !== -1) {
        shouldHide = true;
        hideReason = '@' + thread.author;
      }
    }

    // 4) Check hide by ignored word
    if (!shouldHide && words.length > 0 && thread.title) {
      const wordMatch = matchWordsInText(thread.title, words);
      if (wordMatch) {
        shouldHide = true;
        hideReason = wordMatch;
      }
    }

    // 5) Resolve conflict between hide and highlight
    if (shouldHide && hlColor) {
      if (prioritizeHL) {
        // Highlight wins → don't hide, apply highlight
        highlightMap.set(thread.container, hlColor);
      } else {
        // Hide wins → hide, show highlighted in summary
        const reasonLabel = hideReason + (hlDesc ? ' [' + hlDesc + ']' : '');
        hidden.push({ container: thread.container, extraContainer: thread.extraContainer, title: thread.title, author: thread.author, reason: reasonLabel, highlightColor: hlColor, link: thread.a ? thread.a.href : '' });
      }
    } else if (shouldHide) {
      hidden.push({ container: thread.container, extraContainer: thread.extraContainer, title: thread.title, author: thread.author, reason: hideReason, link: thread.a ? thread.a.href : '' });
    } else if (hlColor) {
      highlightMap.set(thread.container, hlColor);
    }
  });

  // Apply hiding
  hidden.forEach((item) => {
    markHidden(item.container);
    markHidden(item.extraContainer);
    if (item.container) markHidden(ad.getSeparator(item.container));
  });

  // Apply user/word highlights in place
  highlightMap.forEach((color, container) => {
    container.style.background = color;
    container.querySelectorAll<HTMLElement>('td').forEach((td) => { td.style.background = color; });
  });

  // Highlight threads with 0 messages (only if not already highlighted)
  const hzm = getHighlightZeroMessages();
  const hzColor = getHighlightColor();
  if (hzm) {
    threads.forEach((thread) => {
      if (!thread.container) return;
      if (thread.messageCount === 0 && !highlightMap.has(thread.container)) {
        thread.container.style.background = hzColor;
        thread.container.querySelectorAll<HTMLElement>('td').forEach(function (td) { td.style.background = hzColor; });
      }
    });
  }

  const summaryKey = hidden.map((h) => h.title + '|' + h.reason + '|' + (h.highlightColor || '')).join('\n');
  if (summaryKey !== lastSummaryKey || (hidden.length > 0 && !document.getElementById('fc-hidden-summary'))) {
    lastSummaryKey = summaryKey;
    if (hidden.length > 0) showHiddenSummary(hidden);
    else document.getElementById('fc-hidden-summary')?.remove();
  }
  if (hidden.length !== lastHiddenCount) {
    lastHiddenCount = hidden.length;
    log('HIDE', `Ocultados ${hidden.length} de ${total}`);
    if (hidden.length > 0) toast(`Hilos ocultados: ${hidden.length}`);
  }
}
