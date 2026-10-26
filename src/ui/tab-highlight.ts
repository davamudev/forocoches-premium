import type { HighlightGroup } from '../types';
import { getHighlightUserGroups, saveHighlightUserGroups, getHighlightWordGroups, saveHighlightWordGroups } from '../storage';
import { cleanUser } from '../utils';
import { toast } from '../toast';
import { run } from '../runner';
import { STYLE, COLORS } from './styles';

let uidCounter = Date.now();
function uid(): string { return 'hl_' + (uidCounter++); }

// ── Group card helpers ────────────────────────────────────

function saveUserGroups(groups: HighlightGroup[]): void {
  saveHighlightUserGroups(groups);
  run();
}

function saveWordGroups(groups: HighlightGroup[]): void {
  saveHighlightWordGroups(groups);
  run();
}

function makeGroupCard(
  group: HighlightGroup,
  type: 'user' | 'word',
  allGroups: HighlightGroup[],
  save: (g: HighlightGroup[]) => void,
  onRender: () => void,
): HTMLDivElement {
  const card = document.createElement('div');
  card.style.cssText = 'border:1px solid #ddd;border-radius:6px;padding:8px;margin-bottom:8px;background:#fafafa;';

  // ── Row 1: desc + color + delete ──
  const row1 = document.createElement('div');
  row1.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:6px;';

  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.placeholder = 'Descripci\u00F3n...';
  descInput.value = group.desc;
  descInput.style.cssText = 'flex:1;padding:3px 6px;border:1px solid #ccc;border-radius:4px;font-size:11px;';
  descInput.addEventListener('change', () => {
    group.desc = descInput.value;
    save(allGroups);
  });
  row1.appendChild(descInput);

  const colorPicker = document.createElement('input');
  colorPicker.type = 'color';
  colorPicker.value = group.color;
  colorPicker.style.cssText = 'width:28px;height:24px;border:1px solid #ccc;border-radius:4px;padding:1px;cursor:pointer;background:none;';
  colorPicker.addEventListener('change', () => {
    group.color = colorPicker.value;
    save(allGroups);
  });
  row1.appendChild(colorPicker);

  const delBtn = document.createElement('button');
  delBtn.textContent = 'X';
  delBtn.style.cssText = 'border:none;background:transparent;color:#c00;cursor:pointer;font-size:12px;font-weight:bold;padding:2px 6px;';
  delBtn.addEventListener('click', () => {
    const idx = allGroups.indexOf(group);
    if (idx !== -1) allGroups.splice(idx, 1);
    save(allGroups);
    onRender();
  });
  row1.appendChild(delBtn);
  card.appendChild(row1);

  // ── Row 2: items ──
  if (type === 'user') {
    const itemList = document.createElement('div');
    itemList.style.cssText = 'margin-bottom:4px;';

    function renderItems() {
      itemList.innerHTML = '';
      group.items.forEach((u) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:2px 4px;font-size:11px;';
        const span = document.createElement('span');
        span.textContent = '@' + u;
        const btn = document.createElement('button');
        btn.textContent = 'X';
        btn.style.cssText = 'border:none;background:transparent;color:#c00;cursor:pointer;font-size:10px;font-weight:bold;padding:0 4px;';
        btn.addEventListener('click', () => {
          group.items = group.items.filter((x) => x !== u);
          save(allGroups);
          renderItems();
        });
        row.appendChild(span);
        row.appendChild(btn);
        itemList.appendChild(row);
      });
    }
    renderItems();

    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;gap:4px;';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = 'a\u00F1adir usuario...';
    inp.style.cssText = 'flex:1;padding:3px 6px;border:1px solid #ccc;border-radius:4px;font-size:11px;';
    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.style.cssText = 'border:none;background:' + COLORS.PRIMARY + ';color:white;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:13px;font-weight:bold;';
    addBtn.addEventListener('click', () => {
      const name = cleanUser(inp.value);
      if (!name) { toast('Escribe un nombre'); return; }
      if (group.items.indexOf(name) !== -1) { toast('@' + name + ' ya existe en este grupo'); return; }
      group.items.push(name);
      save(allGroups);
      inp.value = '';
      renderItems();
    });
    inp.addEventListener('keypress', (e) => { if (e.key === 'Enter') addBtn.click(); });
    addRow.appendChild(inp);
    addRow.appendChild(addBtn);

    card.appendChild(itemList);
    card.appendChild(addRow);
  } else {
    // word group
    const textarea = document.createElement('textarea');
    textarea.style.cssText = 'width:100%;height:50px;border:1px solid #ccc;border-radius:4px;padding:4px;font-size:11px;box-sizing:border-box;resize:vertical;';
    textarea.value = group.items.join('\n');
    textarea.placeholder = 'Una palabra por l\u00EDnea';
    textarea.addEventListener('change', () => {
      const raw = textarea.value.split('\n');
      const items: string[] = [];
      raw.forEach((w) => { const t = w.trim(); if (t) items.push(t); });
      group.items = items;
      save(allGroups);
    });
    card.appendChild(textarea);

    const saveWordsBtn = document.createElement('button');
    saveWordsBtn.textContent = 'Guardar palabras';
    saveWordsBtn.style.cssText = 'border:none;background:' + COLORS.BLUE + ';color:white;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:10px;font-weight:bold;margin-top:4px;width:100%;';
    saveWordsBtn.addEventListener('click', () => {
      const raw = textarea.value.split('\n');
      const items: string[] = [];
      raw.forEach((w) => { const t = w.trim(); if (t) items.push(t); });
      group.items = items;
      save(allGroups);
      toast('Grupo guardado');
    });
    card.appendChild(saveWordsBtn);
  }

  return card;
}

function renderSection(
  container: HTMLElement,
  title: string,
  type: 'user' | 'word',
  getGroups: () => HighlightGroup[],
  save: (g: HighlightGroup[]) => void,
): void {
  const header = document.createElement('div');
  header.textContent = title;
  header.style.cssText = 'font-size:12px;font-weight:bold;color:' + COLORS.PRIMARY + ';margin-top:10px;margin-bottom:4px;padding-bottom:2px;border-bottom:1px solid #eee;text-transform:uppercase;letter-spacing:1px;';
  container.appendChild(header);

  const listDiv = document.createElement('div');
  listDiv.style.cssText = 'margin-bottom:4px;';

  function render() {
    listDiv.innerHTML = '';
    const groups = getGroups();
    groups.forEach((g) => {
      const card = makeGroupCard(g, type, groups, save, render);
      listDiv.appendChild(card);
    });
    if (groups.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '(sin grupos)';
      empty.style.cssText = 'font-size:11px;color:#999;font-style:italic;padding:4px 0;';
      listDiv.appendChild(empty);
    }
  }

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ A\u00F1adir grupo';
  addBtn.style.cssText = 'border:none;background:' + COLORS.PRIMARY + ';color:white;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:11px;font-weight:bold;display:block;width:100%;margin-bottom:6px;';
  addBtn.addEventListener('click', () => {
    const groups = getGroups();
    const newGroup: HighlightGroup = {
      id: uid(),
      desc: '',
      items: [],
      color: type === 'user' ? '#CCE5FF' : '#D4EDDA',
    };
    groups.push(newGroup);
    save(groups);
    render();
  });

  container.appendChild(addBtn);
  container.appendChild(listDiv);
  render();
}

// ============================================================
//  BUILD HIGHLIGHT TAB
// ============================================================

export function buildHighlightTab(content: HTMLElement): void {
  content.innerHTML = '';
  content.style.minHeight = '200px';

  const title = document.createElement('div');
  title.textContent = 'Resaltado';
  title.style.cssText = STYLE.TITLE_MB12;
  content.appendChild(title);

  const desc = document.createElement('div');
  desc.textContent = 'Crea grupos de usuarios o palabras para resaltar hilos que te interesen. Cada grupo tiene su propio color.';
  desc.style.cssText = STYLE.DESC;
  content.appendChild(desc);

  renderSection(content, 'Grupos de usuarios', 'user', getHighlightUserGroups, saveUserGroups);
  renderSection(content, 'Grupos de palabras', 'word', getHighlightWordGroups, saveWordGroups);
}
