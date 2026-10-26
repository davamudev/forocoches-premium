import { log } from './toast';
import { run } from './runner';

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Nodes the script itself creates; their mutations must not re-trigger run()
const OWN_SELECTOR = '#fc-toast, #fcp-ui, #fcp-panel, #fc-hidden-summary, #fc-note-popup, .fc-note, .fc-ignore-btn, .fc-op-badge, [data-fcp-own]';

function isOwnNode(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return !!el && !!el.closest(OWN_SELECTOR);
}

function isOwnMutation(record: MutationRecord): boolean {
  if (isOwnNode(record.target)) return true;
  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
  return nodes.length > 0 && nodes.every(isOwnNode);
}

export function startObserver(): void {
  if (observer) { observer.disconnect(); log('OBSERVER', 'Reconectando observer'); }
  else { log('OBSERVER', 'Observer iniciado'); }

  observer = new MutationObserver((records) => {
    if (records.every(isOwnMutation)) return;
    if (debounceTimer === null) log('OBSERVER', 'Mutaciones detectadas, programando run...');
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      run();
      debounceTimer = null;
    }, 150);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
