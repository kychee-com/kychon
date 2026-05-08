export const KYCHON_TOAST_EVENT = 'kychon:toast';

export type KychonToastType = 'success' | 'error' | 'info' | 'warning';

export interface KychonToast {
  message: string;
  type?: KychonToastType;
  description?: string;
  duration?: number;
}

export function normalizeToastType(type: unknown): KychonToastType {
  if (type === 'success' || type === 'error' || type === 'warning' || type === 'info') return type;
  return 'info';
}

export function showToast(toast: KychonToast): void;
export function showToast(message: string, type?: KychonToastType): void;
export function showToast(input: KychonToast | string, type?: KychonToastType): void {
  const detail =
    typeof input === 'string'
      ? { message: input, type: normalizeToastType(type) }
      : { ...input, type: normalizeToastType(input.type) };

  document.dispatchEvent(new CustomEvent<KychonToast>(KYCHON_TOAST_EVENT, { detail }));
}
