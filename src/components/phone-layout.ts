import { useSyncExternalStore } from 'react';

const phoneQuery = '(max-width: 760px), (pointer: coarse) and (orientation: landscape) and (max-width: 1024px) and (max-height: 500px)';

function subscribe(callback: () => void) {
  const media = window.matchMedia(phoneQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

export function usePhoneLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(phoneQuery).matches, () => false);
}

/** Keep a phone sheet inside the visible area while the keyboard is up. */
export function fitPhoneSheet(dialog: HTMLDialogElement) {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const content = dialog.querySelector<HTMLElement>('.dialog-content');
  let frame = 0;

  function fit() {
    if (!viewport || !dialog.open) return;
    if (Math.abs(viewport.scale - 1) > .02) {
      dialog.style.removeProperty('--sheet-height');
      dialog.style.removeProperty('--sheet-bottom');
      return;
    }

    const height = Math.round(viewport.height);
    const bottom = Math.max(0, Math.round(window.innerHeight - viewport.offsetTop - viewport.height));
    dialog.style.setProperty('--sheet-height', `${height}px`);
    dialog.style.setProperty('--sheet-bottom', `${bottom}px`);

    const field = document.activeElement;
    if (!content || !(field instanceof HTMLElement) || !content.contains(field) || !field.matches('input, textarea, select, [contenteditable="true"]')) return;
    const bounds = content.getBoundingClientRect();
    const rect = field.getBoundingClientRect();
    if (rect.bottom > bounds.bottom - 8) content.scrollTop += rect.bottom - bounds.bottom + 8;
    else if (rect.top < bounds.top + 8) content.scrollTop += rect.top - bounds.top - 8;
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  }

  fit();
  viewport.addEventListener('resize', schedule);
  viewport.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  dialog.addEventListener('focusin', schedule);
  return () => {
    cancelAnimationFrame(frame);
    viewport.removeEventListener('resize', schedule);
    viewport.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    dialog.removeEventListener('focusin', schedule);
    dialog.style.removeProperty('--sheet-height');
    dialog.style.removeProperty('--sheet-bottom');
  };
}
