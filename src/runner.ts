import { log, toast } from './toast';
import { getUsers, getWords } from './storage';
import { hideThreads } from './hide-threads';
import { hidePosts, addIgnorePostButtons, highlightOPPosts } from './hide-posts';
import { hideAds } from './hide-ads';
import { findThreads } from './threads';
import { injectPostNotes, injectProfileNote } from './user-notes';
import { QUICK_REPLY_SELECTOR } from './selectors';
import { enhancePagination } from './pagination';
let lastLogKey = '';

function handlePole(): void {
  try {
    const msg = localStorage.getItem('fc_pole_msg');
    if (!msg) return;
    localStorage.removeItem('fc_pole_msg');
    let qr = document.querySelector<HTMLTextAreaElement>(QUICK_REPLY_SELECTOR);
    if (!qr) {
      qr = document.querySelector<HTMLTextAreaElement>('textarea[name="message"]');
    }
    if (qr) {
      qr.value = msg;
      qr.focus();
      setTimeout(function () {
        var target = document.getElementById('vB_Editor_QR') || document.getElementById('qrform') || qr;
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      const qrIframe = document.getElementById('vB_Editor_QR_iframe') as HTMLIFrameElement | null;
      if (qrIframe) {
        try {
          const iframeDoc = qrIframe.contentDocument || qrIframe.contentWindow?.document;
          // Plain text into the WYSIWYG editor: never parse the message as HTML
          if (iframeDoc) {
            iframeDoc.body.textContent = '';
            msg.split('\n').forEach((line, i) => {
              if (i > 0) iframeDoc.body.appendChild(iframeDoc.createElement('br'));
              iframeDoc.body.appendChild(iframeDoc.createTextNode(line));
            });
          }
        } catch (_) { /* ignore cross-origin */ }
      }
      log('POLE', `Texto rellenado: "${msg}"`);
      toast('Pole! Enviando mensaje...', 2000);
      setTimeout(() => {
        try {
          const form = qr!.closest('form');
          if (!form) { toast('No se encontr\u00F3 el formulario'); return; }
          const allBtns = form.querySelectorAll<HTMLElement>('input[type="submit"], button[type="submit"]');
          let submitBtn: HTMLElement | null = null;
          for (let bi = 0; bi < allBtns.length; bi++) {
            const txt = (allBtns[bi].getAttribute('value') || allBtns[bi].textContent || '').toLowerCase();
            if (txt.indexOf('enviar') !== -1) { submitBtn = allBtns[bi]; break; }
          }
          if (!submitBtn && allBtns.length > 0) submitBtn = allBtns[0];
          if (submitBtn) {
            log('POLE', 'Enviando formulario...');
            submitBtn.click();
          } else {
            toast('No se encontr\u00F3 el bot\u00F3n de env\u00EDo. Env\u00EDalo manualmente.', 4000);
          }
        } catch (_) { /* ignore */ }
      }, 500);
    } else {
      toast(`No se encontr\u00F3 el campo de respuesta. Pega manualmente: ${msg}`, 6000);
    }
  } catch (_) { /* ignore */ }
}

function handlePoleSearch(): void {
  try {
    const raw = localStorage.getItem('fc_pole_search');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || !data.baseUrl || !data.page) { localStorage.removeItem('fc_pole_search'); return; }
    const threads = findThreads();
    let target: string | null = null;
    for (let pi = 0; pi < threads.length; pi++) {
      if (threads[pi].messageCount === 0 && threads[pi].a?.href) {
        target = threads[pi].a!.href;
        break;
      }
    }
    let curPage = data.page;
    const pageUrlMatch = window.location.href.match(/page=(\d+)/);
    if (pageUrlMatch) curPage = parseInt(pageUrlMatch[1], 10);

    if (target) {
      localStorage.removeItem('fc_pole_search');
      log('POLE', `Encontrado en p\u00E1gina ${curPage}, navegando a: ${target}`);
      window.location.href = target;
      return;
    }
    if (threads.length === 0 || curPage >= 35) {
      localStorage.removeItem('fc_pole_search');
      localStorage.removeItem('fc_pole_msg');
      toast('No hay hilos sin respuestas en las p\u00E1ginas siguientes', 5000);
      log('POLE', `B\u00FAsqueda terminada sin resultados, p\u00E1gina ${curPage}`);
      return;
    }
    const nextUrl = data.baseUrl + (data.baseUrl.indexOf('?') === -1 ? '?' : '&') + 'page=' + (curPage + 1);
    data.page = curPage + 1;
    try { localStorage.setItem('fc_pole_search', JSON.stringify(data)); } catch { toast('Error al guardar datos de busqueda', 3000); }
    log('POLE', `P\u00E1gina ${curPage} sin resultados, yendo a p\u00E1gina ${curPage + 1}`);
    window.location.href = nextUrl;
  } catch (_) { localStorage.removeItem('fc_pole_search'); }
}

export function run(): void {
  hideAds();
  const users = getUsers();
  const words = getWords();
  const path = window.location.pathname;
  const key = path + '|u' + users.length + '|w' + words.length;
  if (key !== lastLogKey) {
    lastLogKey = key;
    if (path.indexOf('forumdisplay.php') !== -1) {
      log('RUN', 'forumdisplay', 'Ignorados: ' + users.length, 'Palabras: ' + words.length);
    } else if (path.indexOf('showthread.php') !== -1) {
      log('RUN', 'showthread', 'Ignorados: ' + users.length, 'Palabras: ' + words.length);
    }
  }
  if (path.indexOf('forumdisplay.php') !== -1) { enhancePagination(); hideThreads(users, words); handlePoleSearch(); }
  else if (path.indexOf('showthread.php') !== -1) { hidePosts(users); addIgnorePostButtons(); highlightOPPosts(); injectPostNotes(); handlePole(); }
  else if (path.indexOf('member.php') !== -1) { injectProfileNote(); }
}
