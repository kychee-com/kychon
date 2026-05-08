'use client';

import { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast, Toaster } from '@/components/kychon/ui';
import type { KychonToast } from '@/lib/toast-events';

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

export function mountToastIsland(element: HTMLElement): void {
  if (root) return;
  root = createRoot(element);
  root.render(<ToastRenderer />);
}

function notify({ message, type = 'info', description, duration }: KychonToast): void {
  const options = { description, duration };

  if (type === 'success') {
    toast.success(message, options);
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
