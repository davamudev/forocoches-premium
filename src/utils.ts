export function cleanUser(n: string): string {
  if (!n) return '';
  return n.replace('@', '').trim().toLowerCase();
}

// Thread id of the current showthread page. Permalinks (?p=, ?goto=) carry no t=,
// so fall back to the quick-reply hidden input.
export function getCurrentThreadId(): string {
  const t = new URLSearchParams(window.location.search).get('t');
  if (t && /^\d+$/.test(t)) return t;
  const qr = document.querySelector<HTMLInputElement>('#qr_threadid, form input[name="t"]');
  return qr && /^\d+$/.test(qr.value) ? qr.value : '';
}

export function normalizeStr(s: string): string {
  return s.toLowerCase()
    .replace(/ñ/g, '\0')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\0/g, 'ñ');
}
