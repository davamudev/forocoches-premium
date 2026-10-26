import { getWords, saveWords } from '../storage';
import { toast, log } from '../toast';
import { normalizeStr } from '../utils';
import { getAutoMinimizeWords, autoMinimizePanel } from '../config';
import { run } from '../runner';
import {
  presetPolitica, presetFutbol, presetAnime,
  presetVideojuegos, presetCripto, preset18,
} from './presets';
import { STYLE } from './styles';

// ============================================================
//  BUILD WORDS TAB
// ============================================================

export function buildWordsTab(content: HTMLElement): void {
  content.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'Palabras clave';
  title.style.cssText = STYLE.TITLE;
  const desc = document.createElement('div');
  desc.textContent = 'Oculta hilos cuyo titulo contenga estas palabras completas (una por linea). Usa * como comodin: polit* = politica, politicos...';
  desc.style.cssText = STYLE.DESC;
  content.appendChild(title); content.appendChild(desc);

  // Acordeon categorias
  const accordionHeader = document.createElement('div');
  accordionHeader.textContent = '\u25B6 Categor\u00EDas';
  accordionHeader.style.cssText = STYLE.ACCORDION_HEADER;
  accordionHeader.title = 'Haz clic para expandir/colapsar categorias preseleccionadas';

  const accordionBody = document.createElement('div');
  accordionBody.style.cssText = 'display:none;';

  const presetContainer = document.createElement('div');
  presetContainer.style.cssText = STYLE.PRESET_CONTAINER;

  function addPresetWords(presetWords: string[]): void {
    const existing = textarea.value.split('\n').map((w) => w.trim().toLowerCase()).filter((w) => w);
    const existingNorm = existing.map((w) => normalizeStr(w));
    presetWords.forEach((presetWord) => {
      const lower = presetWord.trim().toLowerCase();
      if (lower && existingNorm.indexOf(normalizeStr(lower)) === -1) { existing.push(lower); existingNorm.push(normalizeStr(lower)); }
    });
    textarea.value = existing.join('\n');
    toast(`A\u00F1adidas ${presetWords.length} palabras preseleccionadas`);
  }

  function makePresetBtn(text: string, color: string, textColor: string, words: string[]): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `border:none;background:${color};color:${textColor};border-radius:4px;padding:4px 8px;cursor:pointer;font-size:11px;font-weight:bold;flex:1 0 30%;`;
    btn.addEventListener('click', () => { addPresetWords(words); });
    return btn;
  }

  presetContainer.appendChild(makePresetBtn('Pol\u00EDtica', '#C0392B', 'white', presetPolitica));
  presetContainer.appendChild(makePresetBtn('F\u00FAtbol', '#2980B9', 'white', presetFutbol));
  presetContainer.appendChild(makePresetBtn('Anime', '#8E44AD', 'white', presetAnime));
  presetContainer.appendChild(makePresetBtn('Videojuegos', '#D35400', 'white', presetVideojuegos));
  presetContainer.appendChild(makePresetBtn('Cripto', '#F39C12', '#333', presetCripto));
  presetContainer.appendChild(makePresetBtn('+18', '#E74C3C', 'white', preset18));
  presetContainer.appendChild(makePresetBtn('TODO', '#16A085', 'white', presetPolitica.concat(presetFutbol, presetAnime, presetVideojuegos, presetCripto, preset18)));

  accordionBody.appendChild(presetContainer);
  accordionHeader.addEventListener('click', () => {
    const isHidden = accordionBody.style.display === 'none';
    accordionBody.style.display = isHidden ? '' : 'none';
    accordionHeader.textContent = isHidden ? '\u25BC Categor\u00EDas' : '\u25B6 Categor\u00EDas';
  });
  content.appendChild(accordionHeader);
  content.appendChild(accordionBody);

  const textarea = document.createElement('textarea');
  textarea.style.cssText = STYLE.TEXTAREA;
  textarea.value = getWords().join('\n');

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Guardar palabras';
  saveBtn.style.cssText = STYLE.BTN_PRIMARY_LG + 'margin-top:8px;';
  saveBtn.addEventListener('click', () => {
    const raw = textarea.value.split('\n'); const words: string[] = [];
    raw.forEach((rawWord) => { const trimmed = rawWord.trim(); if (trimmed) words.push(trimmed); });
    log('PANEL', `Guardando ${words.length} palabras`); saveWords(words); toast(`Guardadas ${words.length} palabras`); run();
    if (getAutoMinimizeWords()) autoMinimizePanel();
  });
  content.appendChild(textarea);

  // Copiar / Pegar / Limpiar
  const copyPasteRow = document.createElement('div');
  copyPasteRow.style.cssText = STYLE.COPY_ROW;
  const copyWordsBtn = document.createElement('button');
  copyWordsBtn.textContent = 'Copiar';
  copyWordsBtn.title = 'Copiar palabras al portapapeles';
  copyWordsBtn.style.cssText = STYLE.BTN_BLUE;
  copyWordsBtn.addEventListener('click', () => {
    const text = textarea.value;
    if (!text) { toast('No hay palabras que copiar'); return; }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => { toast('Palabras copiadas al portapapeles'); });
    } else {
      const ta = document.createElement('textarea'); ta.value = text;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      toast('Palabras copiadas al portapapeles');
    }
  });
  copyPasteRow.appendChild(copyWordsBtn);
  const pasteWordsBtn = document.createElement('button');
  pasteWordsBtn.textContent = 'Pegar';
  pasteWordsBtn.title = 'Pegar palabras desde el portapapeles (una por linea)';
  pasteWordsBtn.style.cssText = STYLE.BTN_GREEN;
  pasteWordsBtn.addEventListener('click', () => {
    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText().then((text) => {
        const lines = text.split('\n'); let added = 0;
        const existing = textarea.value.split('\n').map((w) => w.trim().toLowerCase()).filter((w) => w);
        const existingNorm = existing.map((w) => normalizeStr(w));
        lines.forEach((rawLine) => {
          const lineWord = rawLine.trim().toLowerCase();
          if (lineWord && existingNorm.indexOf(normalizeStr(lineWord)) === -1) { existing.push(lineWord); existingNorm.push(normalizeStr(lineWord)); added++; }
        });
        if (added > 0) { textarea.value = existing.join('\n'); toast(`Anadidas ${added} palabras`); }
        else toast('No se encontraron palabras nuevas');
      }).catch(() => { toast('Error al leer portapapeles'); });
    } else {
      toast('Pega manualmente en el campo de texto');
    }
  });
  copyPasteRow.appendChild(pasteWordsBtn);
  const clearWordsBtn = document.createElement('button');
  clearWordsBtn.textContent = 'Limpiar';
  clearWordsBtn.title = 'Limpiar todas las palabras';
  clearWordsBtn.style.cssText = 'border:none;background:#c00;color:white;border-radius:4px;padding:6px 8px;cursor:pointer;font-size:11px;font-weight:bold;flex:1;';
  clearWordsBtn.addEventListener('click', () => {
    textarea.value = '';
    toast('Palabras limpiadas');
  });
  copyPasteRow.appendChild(clearWordsBtn);
  content.appendChild(copyPasteRow);

  content.appendChild(saveBtn);
}
