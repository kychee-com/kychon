'use client';

import { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast, Toaster } from '@/components/kychon/ui';
import { KYCHON_TOAST_EVENT, showToast, type KychonToast } from '@/lib/toast-events';
import { openHistory, revertChangeset } from '@/lib/content-history';
import { takeRecentChangesets } from '@/lib/history-recent';
import { t } from '@/lib/i18n';

let root: Root | null = null;
let ready = false;
const pendingToasts: KychonToast[] = [];

function ToastRenderer() {
  useEffect(() => {
    ready = true;
    while (pendingToasts.length > 0) {
      notify(pendingToasts.shift()!);
    }
  }, []);

  return <Toaster position="top-right" />;
}

interface ToastLauncherState {
  listener?: EventListener;
}

const stateKey = '__kychonToastLauncher';

function bindToastLauncher() {
  const win = window as Window &
    typeof globalThis & {
      [stateKey]?: ToastLauncherState;
      __wl_showToast?: (message: string, type?: KychonToast['type']) => void;
    };
  const state = (win[stateKey] ??= {});

  if (state.listener) document.removeEventListener(KYCHON_TOAST_EVENT, state.listener);

  state.listener = ((event: CustomEvent<KychonToast>) => {
    emitKychonToast(event.detail);
  }) as EventListener;

  document.addEventListener(KYCHON_TOAST_EVENT, state.listener);
  win.__wl_showToast = (message: string, type?: KychonToast['type']) => showToast(message, type);

  return () => {
    if (state.listener) document.removeEventListener(KYCHON_TOAST_EVENT, state.listener);
    state.listener = undefined;
  };
}

export default function ToastIsland() {
  useEffect(bindToastLauncher, []);
  return <ToastRenderer />;
}

export function mountToastIsland(element: HTMLElement): void {
  if (root) return;
  root = createRoot(element);
  root.render(<ToastRenderer />);
}

function notify({ message, type = 'info', description, duration }: KychonToast): void {
  const options = { description, duration };

  if (type === 'success') {
    // A success toast right after an admin save confirms that save: offer
    // Undo for the content-history changesets it recorded.
    const changesetIds = takeRecentChangesets();
    toast.success(message, {
      ...options,
      ...(changesetIds.length ? { action: { label: t('history.undo'), onClick: () => void undoChangesets(changesetIds) } } : {}),
    });
    return;
  }
  if (type === 'error') {
    toast.error(message, options);
    return;
  }
  if (type === 'warning') {
    toast.warning(message, options);
    return;
  }

  toast.info(message, options);
}

export function emitKychonToast(detail: KychonToast): void {
  if (!ready) {
    pendingToasts.push(detail);
    return;
  }

  notify(detail);
}

/** Undo a save: revert its changesets newest first, then reload to show the restored content. */
async function undoChangesets(changesetIds: string[]): Promise<void> {
  for (const id of [...changesetIds].sort((a, b) => Number(b) - Number(a))) {
    const outcome = await revertChangeset(id);
    if (!outcome.ok) {
      toast.error(t('history.undo_failed'), {
        description: outcome.message,
        action: { label: t('history.open'), onClick: () => openHistory() },
      });
      return;
    }
  }
  toast.success(t('history.undone'));
  window.setTimeout(() => window.location.reload(), 600);
}
