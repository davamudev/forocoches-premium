import { STYLE } from './ui/styles';

function ts(): string {
  var d = new Date();
  return d.toLocaleString('es-ES', { hour12: false }) + '.' +
    String(d.getMilliseconds()).padStart(3, '0');
}

// GM_log is unavailable with @grant none. Enable with localStorage.fc_debug = '1'.
let debugEnabled: boolean | null = null;

function isDebug(): boolean {
  if (debugEnabled === null) {
    try { debugEnabled = localStorage.getItem('fc_debug') === '1'; } catch (_) { debugEnabled = false; }
  }
  return debugEnabled;
}

export function log(module: string, ...messages: string[]): void {
  if (!isDebug()) return;
  console.debug(`${ts()} [FCP ${module}]`, messages.join(' | '));
}

let toastId: ReturnType<typeof setTimeout> | null = null;

export function toast(msg: string, dur?: number): void {
  dur = dur || 4000;
  let div = document.getElementById('fc-toast') as HTMLDivElement | null;
  if (!div) {
    div = document.createElement('div');
    div.id = 'fc-toast';
    div.style.cssText = STYLE.TOAST;
    document.body.appendChild(div);
  }
  div.textContent = msg;
  div.style.opacity = '1';
  if (toastId !== null) clearTimeout(toastId);
  toastId = setTimeout(function () {
    div!.style.opacity = '0';
    toastId = setTimeout(function () {
      if (div!.parentNode) div!.parentNode.removeChild(div!);
      toastId = null;
    }, 300);
  }, dur);
}
