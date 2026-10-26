import { toast } from '../toast';
import {
  getAutoMinimize, setAutoMinimize,
  getAutoMinimizeWords, setAutoMinimizeWords,
  getAutoRedirectOP, setAutoRedirectOP,
  getAutoReloadIgnore, setAutoReloadIgnore,
  getShowScrollUp, setShowScrollUp,
  getShowScrollDown, setShowScrollDown,
  getShowPlaceholder, setShowPlaceholder,
  getDisablePostHiding, setDisablePostHiding,
  getHideThreadByAuthor, setHideThreadByAuthor,
  getHighlightZeroMessages, setHighlightZeroMessages,
  getHighlightColor, setHighlightColor,
  getHighlightOP, setHighlightOP,
  getHighlightOPColor, setHighlightOPColor,
  getPrioritizeHighlightOverHide, setPrioritizeHighlightOverHide,
  getShowPoleButton, setShowPoleButton,
  getPoleSearchPages, setPoleSearchPages,
  getPoleMessage, setPoleMessage,
  getBlockAds, setBlockAds,
  getThreadsPerPage, setThreadsPerPage,
} from '../config';
import { exportData, importData } from '../storage';
import { STYLE } from './styles';

// ============================================================
//  MAKE TOGGLE
// ============================================================

function makeToggle(checked: boolean, onChange: (v: boolean) => void): HTMLLabelElement {
  const label = document.createElement('label');
  label.style.cssText = 'position:relative;display:inline-block;width:40px;height:22px;';
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.checked = checked;
  cb.style.cssText = 'opacity:0;width:0;height:0;';
  const slider = document.createElement('span');
  slider.style.cssText = 'position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#ccc;border-radius:22px;transition:0.3s;';
  const knob = document.createElement('span');
  knob.style.cssText = 'position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:white;border-radius:50%;transition:0.3s;';
  slider.appendChild(knob);
  label.appendChild(cb);
  label.appendChild(slider);
  function upd() {
    slider.style.background = cb.checked ? '#FD5D4D' : '#ccc';
    knob.style.transform = cb.checked ? 'translateX(18px)' : 'translateX(0)';
  }
  upd();
  cb.addEventListener('change', function () { upd(); if (onChange) onChange(cb.checked); });
  return label;
}

// ============================================================
//  ADD OPTION ROW
// ============================================================

function addOption(content: HTMLElement, labelText: string, descText: string, getter: () => boolean, setter: (v: boolean) => void): void {
  const row = document.createElement('div');
  row.style.cssText = STYLE.CONFIG_ROW;
  const lbl = document.createElement('span');
  lbl.textContent = labelText;
  lbl.style.cssText = STYLE.CONFIG_LABEL;
  const tog = makeToggle(getter(), function (v) {
    setter(v);
    toast(labelText + ': ' + (v ? 'ON' : 'OFF'));
  });
  row.appendChild(lbl);
  row.appendChild(tog);
  content.appendChild(row);
  if (descText) {
    const d = document.createElement('div');
    d.textContent = descText;
    d.style.cssText = STYLE.CONFIG_DESC;
    content.appendChild(d);
  }
}

// ============================================================
//  SECTION HEADER
// ============================================================

function addSectionHeader(content: HTMLElement, text: string): void {
  const hdr = document.createElement('div');
  hdr.textContent = text;
  hdr.style.cssText = 'font-size:12px;font-weight:bold;color:#FD5D4D;margin-top:10px;margin-bottom:4px;padding-bottom:2px;border-bottom:1px solid #eee;text-transform:uppercase;letter-spacing:1px;';
  content.appendChild(hdr);
}

// ============================================================
//  BUILD CONFIG TAB
// ============================================================

export function buildConfigTab(content: HTMLElement): void {
  content.innerHTML = '';
  content.style.minHeight = '200px';

  const title = document.createElement('div');
  title.textContent = 'Configuracion';
  title.style.cssText = STYLE.TITLE_MB12;
  content.appendChild(title);

  // ---- HILOS ----
  addSectionHeader(content, 'Hilos');
  addOption(content, 'Auto-minimizar al guardar palabras', 'Al guardar palabras clave, el panel se cierra solo.', getAutoMinimizeWords, setAutoMinimizeWords);
  addOption(content, 'Ocultar hilos por autor', 'Oculta hilos cuyo creador est\u00E9 en tu lista de ignorados. No funciona en Mobile-v1 (móvil antiguo).', getHideThreadByAuthor, setHideThreadByAuthor);

  // Threads per page select
  const tppRow = document.createElement('div');
  tppRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 0;';
  const tppLbl = document.createElement('span');
  tppLbl.textContent = 'Hilos por p\u00E1gina';
  tppLbl.style.cssText = 'font-size:13px;color:#333;flex:1;';
  tppRow.appendChild(tppLbl);
  const tppSelect = document.createElement('select');
  tppSelect.style.cssText = 'padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
  [40, 80, 120, 160].forEach((n) => {
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = String(n);
    if (n === getThreadsPerPage()) opt.selected = true;
    tppSelect.appendChild(opt);
  });
  tppSelect.addEventListener('change', () => {
    setThreadsPerPage(parseInt(tppSelect.value, 10));
    toast('Hilos por p\u00E1gina: ' + tppSelect.value + '. Recarga para aplicar.');
  });
  tppRow.appendChild(tppSelect);
  content.appendChild(tppRow);
  const tppDesc = document.createElement('div');
  tppDesc.textContent = 'Carga hilos de p\u00E1ginas siguientes para mostrar m\u00E1s por p\u00E1gina (requiere recarga).';
  tppDesc.style.cssText = 'font-size:11px;color:#999;margin:-2px 0 6px 0;';
  content.appendChild(tppDesc);

  // ---- RESALTADOS ----
  addSectionHeader(content, 'Resaltados');
  addOption(content, 'Resaltar hilos sin respuestas', 'Marca los hilos con 0 mensajes con un color de fondo.', getHighlightZeroMessages, setHighlightZeroMessages);

  // Color picker for 0 messages
  const hzColorRow = document.createElement('div');
  hzColorRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0 6px 0;';
  const hzColorLbl = document.createElement('span');
  hzColorLbl.textContent = 'Color 0 respuestas';
  hzColorLbl.style.cssText = 'font-size:12px;color:#666;flex:1;';
  hzColorRow.appendChild(hzColorLbl);

  const hzColorPicker = document.createElement('input');
  hzColorPicker.type = 'color';
  hzColorPicker.value = getHighlightColor();
  hzColorPicker.style.cssText = 'width:40px;height:28px;border:1px solid #ccc;border-radius:4px;padding:1px;cursor:pointer;background:none;';
  hzColorPicker.addEventListener('change', () => {
    setHighlightColor(hzColorPicker.value);
    toast('Color cambiado. Recarga la p\u00E1gina para ver el cambio.');
  });
  hzColorRow.appendChild(hzColorPicker);
  content.appendChild(hzColorRow);

  // Highlight OP
  addOption(content, 'Resaltar mensajes del OP', 'Marca los mensajes del autor del hilo con un color de fondo y una etiqueta "OP".', getHighlightOP, setHighlightOP);

  const opColorRow = document.createElement('div');
  opColorRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0 6px 0;';
  const opColorLbl = document.createElement('span');
  opColorLbl.textContent = 'Color resaltado OP';
  opColorLbl.style.cssText = 'font-size:12px;color:#666;flex:1;';
  opColorRow.appendChild(opColorLbl);

  const opColorPicker = document.createElement('input');
  opColorPicker.type = 'color';
  opColorPicker.value = getHighlightOPColor();
  opColorPicker.style.cssText = 'width:40px;height:28px;border:1px solid #ccc;border-radius:4px;padding:1px;cursor:pointer;background:none;';
  opColorPicker.addEventListener('change', () => {
    setHighlightOPColor(opColorPicker.value);
    toast('Color cambiado. Recarga la p\u00E1gina para ver el cambio.');
  });
  opColorRow.appendChild(opColorPicker);
  content.appendChild(opColorRow);

  addOption(content, 'Priorizar resaltado sobre ocultado', 'Si un hilo coincide con un grupo de resaltado y tambi\u00E9n con un criterio de ocultado, prevalece el resaltado (no se oculta). Si se desactiva, prevalece el ocultado.', getPrioritizeHighlightOverHide, setPrioritizeHighlightOverHide);

  // ---- MENSAJES ----
  addSectionHeader(content, 'Mensajes');
  addOption(content, 'Mostrar placeholder al ocultar', 'Muestra "Mensaje de usuario ignorado" en lugar de ocultar completamente.', getShowPlaceholder, setShowPlaceholder);
  addOption(content, 'Desactivar ocultación de mensajes', 'No oculta mensajes de usuarios ignorados. Sobrescribe la opción anterior.', getDisablePostHiding, setDisablePostHiding);

  // ---- USUARIOS ----
  addSectionHeader(content, 'Usuarios');
  addOption(content, 'Auto-minimizar al añadir/eliminar usuarios', 'Al añadir o eliminar un usuario, el panel se cierra solo.', getAutoMinimize, setAutoMinimize);
  addOption(content, 'Redirigir al subforo al ignorar OP', 'Al ignorar al OP, vuelve al listado del subforo.', getAutoRedirectOP, setAutoRedirectOP);
  addOption(content, 'Recargar pagina al ignorar', 'Al ignorar un usuario desde un hilo, recarga la pagina.', getAutoReloadIgnore, setAutoReloadIgnore);

  // ---- PUBLICIDAD ----
  addSectionHeader(content, 'Publicidad');
  addOption(content, 'Bloquear publicidad', 'Elimina banners, anuncios, avisos y noticias promocionadas de la pagina.', getBlockAds, setBlockAds);

  // ---- INTERFAZ ----
  addSectionHeader(content, 'Interfaz');
  addOption(content, 'Boton Subir arriba', 'Muestra u oculta el boton flotante para ir al inicio de la pagina.', getShowScrollUp, setShowScrollUp);
  addOption(content, 'Boton Bajar abajo', 'Muestra u oculta el boton flotante para ir al ultimo comentario.', getShowScrollDown, setShowScrollDown);
  addOption(content, 'Bot\u00F3n Pole', 'Muestra el bot\u00F3n para ir al primer hilo sin respuestas y rellenar mensaje autom\u00E1ticamente.', getShowPoleButton, setShowPoleButton);

  // Pole message textarea
  const poleMsgRow = document.createElement('div');
  poleMsgRow.style.cssText = 'margin-top:6px;';
  const poleMsgLabel = document.createElement('div');
  poleMsgLabel.textContent = 'Mensaje para Pole';
  poleMsgLabel.style.cssText = 'font-size:11px;color:#999;margin-bottom:4px;';
  poleMsgRow.appendChild(poleMsgLabel);
  const poleTextarea = document.createElement('textarea');
  poleTextarea.style.cssText = 'width:100%;height:50px;border:1px solid #ccc;border-radius:4px;padding:4px;font-size:12px;box-sizing:border-box;resize:vertical;';
  poleTextarea.value = getPoleMessage();
  poleTextarea.addEventListener('change', () => { setPoleMessage(poleTextarea.value); });
  poleMsgRow.appendChild(poleTextarea);
  content.appendChild(poleMsgRow);

  addOption(content, 'Buscar en p\u00E1ginas siguientes', 'Si no hay hilos sin respuestas en la p\u00E1gina actual, busca autom\u00E1ticamente en las siguientes p\u00E1ginas (hasta 35).', getPoleSearchPages, setPoleSearchPages);

  // ---- EXPORTAR / IMPORTAR ----
  addSectionHeader(content, 'Exportar / Importar');

  const exportDesc = document.createElement('div');
  exportDesc.textContent = 'Exporta la configuraci\u00F3n, notas y las palabras ignoradas a un archivo .json. Puedes importarlo despu\u00E9s para restaurar los datos. Si borras los datos del navegador antes de hacer esto perderás todo.';
  exportDesc.style.cssText = STYLE.CONFIG_DESC;
  content.appendChild(exportDesc);

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Exportar';
  exportBtn.style.cssText = 'border:none;background:#4A90D9;color:white;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:11px;font-weight:bold;display:block;width:100%;margin-bottom:6px;';
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fc-premium-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Configuraci\u00F3n exportada');
  });
  content.appendChild(exportBtn);

  const importBtn = document.createElement('button');
  importBtn.textContent = 'Importar';
  importBtn.style.cssText = 'border:none;background:#FD5D4D;color:white;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:11px;font-weight:bold;display:block;width:100%;';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (importData(reader.result)) {
          toast('Configuraci\u00F3n importada. Recargando...');
          setTimeout(() => { location.reload(); }, 500);
        } else {
          toast('Error: archivo inv\u00E1lido');
        }
      }
    };
    reader.readAsText(file);
  });
  content.appendChild(fileInput);
  importBtn.addEventListener('click', () => { fileInput.click(); });
  content.appendChild(importBtn);
}
