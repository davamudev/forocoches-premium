import { log } from './toast';
import { getBlockAds } from './config';

const AD_CSS_ID = 'fcp-adblock';

function getAdCSS(): string {
  return `
[id^="optidigital-adslot-"] { display: none !important; }
.optidigital-wrapper-div, .optidigital-text-ads { display: none !important; }
.optidigital-brand, .optidigital-brand-logo { display: none !important; }
.float_banner, .ad-center { display: none !important; }
iframe[name="googlefcPresent"] { display: none !important; }
iframe[name="__tcfapiLocator"], iframe[name="__sdcmpapiLocator"] { display: none !important; }
.fc-custom-promo-wrap, .fc-custom-promo-wrap-mobile { display: none !important; }
.fixed_adslot { display: none !important; }
section[style*="min-width: 300px"] { display: none !important; }
#scrollToTopButton { display: none !important; }
`;
}

function injectAdCSS(): void {
  // run() fires often; the stylesheet only needs injecting once
  if (document.getElementById(AD_CSS_ID)) return;

  let css = getAdCSS();
  css += 'form#vbnotices { display: none !important; }\n#notices-container, .notices-container { display: none !important; }\n';

  if (!css) return;
  const style = document.createElement('style');
  style.id = AD_CSS_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

function removeMobileAdIframes(): void {
  const h1iframe = document.querySelector<HTMLIFrameElement>('iframe#h1[name="h1"]');
  if (h1iframe) {
    const wrapper = h1iframe.closest('div[style*="margin-top"]') || h1iframe.parentElement;
    if (wrapper) wrapper.remove();
  }

  const fcthreads = document.querySelectorAll<HTMLIFrameElement>('iframe#fcthread[name="fcthread"]');
  for (let i = 0; i < fcthreads.length; i++) {
    const ul = fcthreads[i].closest('ul');
    if (ul) ul.remove();
  }
}

function removeAdListItems(): void {
  const ads = document.querySelectorAll<HTMLDivElement>('[id^="optidigital-adslot-"]');
  for (let i = 0; i < ads.length; i++) {
    let el: HTMLElement | null = ads[i];
    while (el) {
      if (el.tagName === 'LI' && el.parentElement?.tagName === 'UL') {
        el.remove();
        break;
      }
      el = el.parentElement;
    }
  }
}

function removeFixedAdslots(): void {
  const wrappers = document.querySelectorAll<HTMLElement>('.fixed_adslot');
  for (let i = 0; i < wrappers.length; i++) wrappers[i].remove();
}

function removeScrollToTop(): void {
  const btn = document.getElementById('scrollToTopButton');
  if (btn) btn.remove();
}

function removeEmptySidebarSections(): void {
  const sections = document.querySelectorAll<HTMLElement>('section[style*="min-width: 300px"]');
  for (let i = 0; i < sections.length; i++) sections[i].remove();
}

function removeOptidigitalWrappers(): void {
  const wrappers = document.querySelectorAll<HTMLElement>('.optidigital-wrapper-div');
  for (let i = 0; i < wrappers.length; i++) wrappers[i].remove();
}

function removeCustomPromos(): void {
  const promos = document.querySelectorAll<HTMLElement>('.fc-custom-promo-wrap-mobile, .fc-custom-promo-wrap');
  for (let i = 0; i < promos.length; i++) {
    let el: HTMLElement | null = promos[i];
    while (el) {
      if (el.tagName === 'LI' && el.parentElement?.tagName === 'UL') {
        const ul = el.parentElement;
        el.remove();
        if (ul.children.length === 0) ul.remove();
        break;
      }
      if (el.tagName === 'TABLE' && el.classList.contains('cajasprin')) {
        const prev = el.previousElementSibling;
        if (prev && prev.tagName === 'BR') prev.remove();
        const next = el.nextElementSibling;
        if (next && next.tagName === 'BR') next.remove();
        el.remove();
        break;
      }
      el = el.parentElement;
    }
  }
}

function removeNoticeForm(): void {
  const form = document.querySelector<HTMLFormElement>('form#vbnotices');
  if (form) form.remove();
}

function removeSidebarAdTables(): void {
  const tables = document.querySelectorAll<HTMLTableElement>('table[id^="AutoNumber"]');
  for (let i = 0; i < tables.length; i++) {
    if (tables[i].querySelector('[id*="optidigital"], [id*="Skyscraper"]')) {
      tables[i].remove();
    }
  }
  const sky = document.querySelector<HTMLDivElement>('#optidigital-adslot-Skyscraper_1');
  if (sky) {
    const c = sky.closest('[id="160x600"]');
    if (c) c.remove();
  }
}

function removeNoticesContainer(): void {
  const nc = document.querySelector<HTMLElement>('#notices-container, .notices-container');
  if (nc) nc.remove();
}

export function hideAds(): void {
  if (!getBlockAds()) return;
  log('ADS', 'Bloqueando publicidad...');
  injectAdCSS();
  removeMobileAdIframes();
  removeFixedAdslots();
  removeScrollToTop();
  removeEmptySidebarSections();
  removeOptidigitalWrappers();
  removeAdListItems();
  removeCustomPromos();
  removeSidebarAdTables();
  removeNoticeForm();
  removeNoticesContainer();
}
