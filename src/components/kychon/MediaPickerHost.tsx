'use client';

import { useCallback, useEffect, useState } from 'react';

import { getRole } from '@/lib/auth';

import { MediaPicker, type MediaAssetRef } from './MediaPickerIsland';

/**
 * MediaPickerHost — top-level mount of the MediaPicker dialog so any admin UI
 * can request an image via a `kychon:media-picker-open` event without having
 * to mount its own dialog instance.
 *
 * Event contract:
 *   - request:  `kychon:media-picker-open` (cancellable; call preventDefault()
 *                to signal the host has consumed it — otherwise the caller may
 *                fall back to a legacy file input).
 *   - response: `kychon:media-picker-select` with detail `{ ref, url, target }`
 *                where `target` is the DOM element the original open event
 *                pointed at (if any).
 *
 * The host self-hides for non-admins so the underlying Dialog never renders
 * in member / visitor sessions.
 */

interface OpenRequestDetail {
  target?: HTMLElement | null;
}

const OPEN_EVENT = 'kychon:media-picker-open';
const SELECT_EVENT = 'kychon:media-picker-select';

export default function MediaPickerHost() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setIsAdmin(getRoleIsAdmin());
    function refresh() {
      setIsAdmin(getRoleIsAdmin());
    }
    document.addEventListener('wl-auth-changed', refresh);
    return () => document.removeEventListener('wl-auth-changed', refresh);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    function onOpen(event: Event) {
      const custom = event as CustomEvent<OpenRequestDetail>;
      const detail = custom.detail ?? {};
      const requested = detail.target instanceof HTMLElement ? detail.target : null;
      setTarget(requested);
      setOpen(true);
      // Mark the event as handled so callers can detect via defaultPrevented
      // and skip the legacy file-input fallback.
      if (typeof custom.preventDefault === 'function') custom.preventDefault();
    }
    document.addEventListener(OPEN_EVENT, onOpen);
    return () => document.removeEventListener(OPEN_EVENT, onOpen);
  }, [isAdmin]);

  const handleSelect = useCallback(
    (ref: MediaAssetRef) => {
      document.dispatchEvent(
        new CustomEvent(SELECT_EVENT, {
          detail: { ref, url: ref.cdn_url, target },
        }),
      );
    },
    [target],
  );

  if (!isAdmin) return null;

  return (
    <MediaPicker
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTarget(null);
      }}
      onSelect={handleSelect}
    />
  );
}

function getRoleIsAdmin(): boolean {
  const role = getRole();
  if (!role) return false;
  const lower = role.toLowerCase();
  return lower === 'admin' || lower === 'project_admin';
}
