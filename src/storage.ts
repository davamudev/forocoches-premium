import { log } from './toast';
import type { HighlightGroup } from './types';

const KEY_USERS = 'fc_ignored_users';

// ── Validation (localStorage and imported files may hold anything) ──

const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function isGroup(g: unknown): g is HighlightGroup {
  return isPlainObject(g) && isStr(g.id) && isStr(g.color) && isStrArr(g.items) && (g.desc === undefined || isStr(g.desc));
}

function readJSON(key: string): unknown {
  try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : null; } catch (_) { return null; }
}
const KEY_WORDS = 'fc_ignored_words';

export function getUsers(): string[] {
  const parsed = readJSON(KEY_USERS);
  return Array.isArray(parsed) ? parsed.filter(isStr) : [];
}

export function saveUsers(list: string[]): void {
  try { localStorage.setItem(KEY_USERS, JSON.stringify(list)); } catch (_) { /* ignore */ }
  log('STORAGE', 'saveUsers: ' + list.length + ' usuarios');
}

export function getWords(): string[] {
  const parsed = readJSON(KEY_WORDS);
  return Array.isArray(parsed) ? parsed.filter(isStr) : [];
}

export function saveWords(list: string[]): void {
  try { localStorage.setItem(KEY_WORDS, JSON.stringify(list)); } catch (_) { /* ignore */ }
  log('STORAGE', 'saveWords: ' + list.length + ' palabras');
}

const KEY_CONFIG = 'fc_config';
const KEY_USER_NOTES = 'fc_user_notes';
const KEY_HL_USER_GROUPS = 'fc_hl_user_groups';
const KEY_HL_WORD_GROUPS = 'fc_hl_word_groups';

export interface FCConfig {
  autoMinimize?: boolean;
  autoMinimizeWords?: boolean;
  autoRedirectOP?: boolean;
  autoReloadIgnore?: boolean;
  showScrollUp?: boolean;
  showScrollDown?: boolean;
  showPlaceholder?: boolean;
  disablePostHiding?: boolean;
  hideThreadByAuthor?: boolean;
  highlightZeroMessages?: boolean;
  highlightZeroMessagesColor?: string;
  highlightOP?: boolean;
  highlightOPColor?: string;
  prioritizeHighlightOverHide?: boolean;
  showPoleButton?: boolean;
  poleMessage?: string;
  poleSearchPages?: boolean;
  blockAds?: boolean;
}

const CONFIG_STRING_KEYS = ['highlightZeroMessagesColor', 'highlightOPColor', 'poleMessage'];
const CONFIG_NUMBER_KEYS = ['threadsPerPage'];

// Keeps only fields with the expected type (booleans unless listed above)
function sanitizeConfig(raw: Record<string, unknown>): FCConfig {
  const out: Record<string, unknown> = {};
  Object.keys(raw).forEach((k) => {
    const v = raw[k];
    if (CONFIG_STRING_KEYS.indexOf(k) !== -1) { if (isStr(v)) out[k] = v; }
    else if (CONFIG_NUMBER_KEYS.indexOf(k) !== -1) { if (typeof v === 'number' && isFinite(v)) out[k] = v; }
    else if (typeof v === 'boolean') out[k] = v;
  });
  return out as FCConfig;
}

export function getConfig(): FCConfig {
  const parsed = readJSON(KEY_CONFIG);
  return isPlainObject(parsed) ? sanitizeConfig(parsed) : {};
}

export function saveConfig(config: FCConfig): void {
  try { localStorage.setItem(KEY_CONFIG, JSON.stringify(config)); } catch (_) { /* ignore */ }
  log('STORAGE', 'saveConfig: ' + JSON.stringify(config));
}

// ── Highlight Groups ─────────────────────────────────────

function readGroups(key: string): HighlightGroup[] {
  const parsed = readJSON(key);
  return Array.isArray(parsed) ? parsed.filter(isGroup).map((g) => ({ ...g, desc: g.desc || '' })) : [];
}

export function getHighlightUserGroups(): HighlightGroup[] {
  return readGroups(KEY_HL_USER_GROUPS);
}

export function saveHighlightUserGroups(groups: HighlightGroup[]): void {
  try { localStorage.setItem(KEY_HL_USER_GROUPS, JSON.stringify(groups)); } catch (_) { /* ignore */ }
  log('STORAGE', 'saveHighlightUserGroups: ' + groups.length + ' grupos');
}

export function getHighlightWordGroups(): HighlightGroup[] {
  return readGroups(KEY_HL_WORD_GROUPS);
}

export function saveHighlightWordGroups(groups: HighlightGroup[]): void {
  try { localStorage.setItem(KEY_HL_WORD_GROUPS, JSON.stringify(groups)); } catch (_) { /* ignore */ }
  log('STORAGE', 'saveHighlightWordGroups: ' + groups.length + ' grupos');
}

// ── Export / Import ──────────────────────────────────────

export function exportData(): string {
  const data: Record<string, unknown> = {};
  data[KEY_CONFIG] = getConfig();
  data[KEY_WORDS] = getWords();
  data[KEY_USERS] = getUsers();
  data[KEY_HL_USER_GROUPS] = getHighlightUserGroups();
  data[KEY_HL_WORD_GROUPS] = getHighlightWordGroups();
  try { const raw = localStorage.getItem(KEY_USER_NOTES); if (raw) data[KEY_USER_NOTES] = JSON.parse(raw); } catch (_) { }
  return JSON.stringify(data, null, 2);
}

// All-or-nothing: any present key with the wrong shape rejects the whole file
export function importData(json: string): boolean {
  let data: unknown;
  try { data = JSON.parse(json); } catch (_) { return false; }
  if (!isPlainObject(data)) return false;

  const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);
  const checks: [string, (v: unknown) => boolean][] = [
    [KEY_CONFIG, isPlainObject],
    [KEY_WORDS, isStrArr],
    [KEY_USERS, isStrArr],
    [KEY_HL_USER_GROUPS, (v) => Array.isArray(v) && v.every(isGroup)],
    [KEY_HL_WORD_GROUPS, (v) => Array.isArray(v) && v.every(isGroup)],
    [KEY_USER_NOTES, (v) => isPlainObject(v) && Object.keys(v).every((k) => isStr(v[k]))],
  ];
  const present = checks.filter(([k]) => has(k));
  if (present.length === 0) return false;
  if (!present.every(([k, valid]) => valid(data[k]))) { log('STORAGE', 'importData: formato invalido'); return false; }

  if (has(KEY_CONFIG)) saveConfig(sanitizeConfig(data[KEY_CONFIG] as Record<string, unknown>));
  if (has(KEY_WORDS)) saveWords(data[KEY_WORDS] as string[]);
  if (has(KEY_USERS)) saveUsers(data[KEY_USERS] as string[]);
  if (has(KEY_HL_USER_GROUPS)) saveHighlightUserGroups(data[KEY_HL_USER_GROUPS] as HighlightGroup[]);
  if (has(KEY_HL_WORD_GROUPS)) saveHighlightWordGroups(data[KEY_HL_WORD_GROUPS] as HighlightGroup[]);
  if (has(KEY_USER_NOTES)) { try { localStorage.setItem(KEY_USER_NOTES, JSON.stringify(data[KEY_USER_NOTES])); } catch (_) { } }
  return true;
}
