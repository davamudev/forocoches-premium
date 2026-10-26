import { log } from './toast';
import { getConfig, saveConfig } from './storage';

// ============================================================
//  GENERIC CONFIG FIELDS
// ============================================================

export type ConfigKey = 'autoMinimize' | 'autoMinimizeWords' | 'autoRedirectOP' | 'autoReloadIgnore' | 'showScrollUp' | 'showScrollDown' | 'showPlaceholder' | 'disablePostHiding' | 'hideThreadByAuthor' | 'highlightZeroMessages' | 'highlightOP' | 'prioritizeHighlightOverHide' | 'showPoleButton' | 'poleSearchPages' | 'blockAds';

const DEFAULTS: Record<ConfigKey, boolean> = {
  autoMinimize: true,
  autoMinimizeWords: false,
  autoRedirectOP: true,
  autoReloadIgnore: true,
  showScrollUp: true,
  showScrollDown: true,
  showPlaceholder: true,
  disablePostHiding: false,
  hideThreadByAuthor: true,
  highlightZeroMessages: true,
  highlightOP: true,
  prioritizeHighlightOverHide: false,
  showPoleButton: true,
  poleSearchPages: true,
  blockAds: true,
};

const LABELS: Record<ConfigKey, string> = {
  autoMinimize: 'Auto-minimizar usuarios',
  autoMinimizeWords: 'Auto-minimizar palabras',
  autoRedirectOP: 'Redirigir al ignorar OP',
  autoReloadIgnore: 'Recargar al ignorar',
  showScrollUp: 'Boton Subir',
  showScrollDown: 'Boton Bajar',
  showPlaceholder: 'Mostrar placeholder',
  disablePostHiding: 'Desactivar ocultación mensajes',
  hideThreadByAuthor: 'Ocultar hilos por autor',
  highlightZeroMessages: 'Resaltar hilos sin respuestas',
  highlightOP: 'Resaltar mensajes del OP',
  prioritizeHighlightOverHide: 'Priorizar resaltado sobre ocultado',
  showPoleButton: 'Bot\u00F3n Pole',
  poleSearchPages: 'Buscar en p\u00E1ginas siguientes',
  blockAds: 'Bloquear publicidad',
};

function getConfigField(key: ConfigKey): boolean {
  const c = getConfig();
  return (c[key] !== undefined ? c[key] : DEFAULTS[key]) as boolean;
}

function setConfigField(key: ConfigKey, v: boolean): void {
  const c = getConfig();
  (c as Record<string, boolean | undefined>)[key] = v;
  saveConfig(c);
  log('CONFIG', LABELS[key] + ': ' + (v ? 'ON' : 'OFF'));
}

// ============================================================
//  PUBLIC API
// ============================================================

export function getAutoMinimize(): boolean { return getConfigField('autoMinimize'); }
export function setAutoMinimize(v: boolean): void { setConfigField('autoMinimize', v); }

export function getAutoMinimizeWords(): boolean { return getConfigField('autoMinimizeWords'); }
export function setAutoMinimizeWords(v: boolean): void { setConfigField('autoMinimizeWords', v); }

export function getAutoRedirectOP(): boolean { return getConfigField('autoRedirectOP'); }
export function setAutoRedirectOP(v: boolean): void { setConfigField('autoRedirectOP', v); }

export function getAutoReloadIgnore(): boolean { return getConfigField('autoReloadIgnore'); }
export function setAutoReloadIgnore(v: boolean): void { setConfigField('autoReloadIgnore', v); }

export function getShowScrollUp(): boolean { return getConfigField('showScrollUp'); }
export function setShowScrollUp(v: boolean): void { setConfigField('showScrollUp', v); }

export function getShowScrollDown(): boolean { return getConfigField('showScrollDown'); }
export function setShowScrollDown(v: boolean): void { setConfigField('showScrollDown', v); }

export function getShowPlaceholder(): boolean { return getConfigField('showPlaceholder'); }
export function setShowPlaceholder(v: boolean): void { setConfigField('showPlaceholder', v); }

export function getDisablePostHiding(): boolean { return getConfigField('disablePostHiding'); }
export function setDisablePostHiding(v: boolean): void { setConfigField('disablePostHiding', v); }

export function getHideThreadByAuthor(): boolean { return getConfigField('hideThreadByAuthor'); }
export function setHideThreadByAuthor(v: boolean): void { setConfigField('hideThreadByAuthor', v); }

export function getHighlightZeroMessages(): boolean { return getConfigField('highlightZeroMessages'); }
export function setHighlightZeroMessages(v: boolean): void { setConfigField('highlightZeroMessages', v); }

export function getHighlightColor(): string {
  const c = getConfig();
  return c.highlightZeroMessagesColor || '#FFF3CD';
}
export function setHighlightColor(v: string): void {
  const c = getConfig();
  c.highlightZeroMessagesColor = v;
  saveConfig(c);
  log('CONFIG', 'Color resaltado: ' + v);
}

export function getHighlightOP(): boolean { return getConfigField('highlightOP'); }
export function setHighlightOP(v: boolean): void { setConfigField('highlightOP', v); }

export function getHighlightOPColor(): string {
  const c = getConfig();
  return c.highlightOPColor || '#FFE0B2';
}
export function setHighlightOPColor(v: string): void {
  const c = getConfig();
  c.highlightOPColor = v;
  saveConfig(c);
  log('CONFIG', 'Color resaltado OP: ' + v);
}

export function getPrioritizeHighlightOverHide(): boolean { return getConfigField('prioritizeHighlightOverHide'); }
export function setPrioritizeHighlightOverHide(v: boolean): void { setConfigField('prioritizeHighlightOverHide', v); }

export function getShowPoleButton(): boolean { return getConfigField('showPoleButton'); }
export function setShowPoleButton(v: boolean): void { setConfigField('showPoleButton', v); }

export function getPoleSearchPages(): boolean { return getConfigField('poleSearchPages'); }
export function setPoleSearchPages(v: boolean): void { setConfigField('poleSearchPages', v); }

export function getBlockAds(): boolean { return getConfigField('blockAds'); }
export function setBlockAds(v: boolean): void { setConfigField('blockAds', v); }


export function getPoleMessage(): string {
  const c = getConfig();
  return c.poleMessage || 'Pole';
}
export function setPoleMessage(v: string): void {
  const c = getConfig();
  c.poleMessage = v;
  saveConfig(c);
  log('CONFIG', 'Mensaje Pole: ' + v);
}

// ============================================================
//  AUTO-MINIMIZE PANEL
// ============================================================

export function autoMinimizePanel(): void {
  if (!getAutoMinimize()) return;
  const p = document.getElementById('fcp-panel');
  if (p) { p.remove(); log('PANEL', 'Auto-minimizado: panel cerrado'); }
}
