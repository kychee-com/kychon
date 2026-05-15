'use client';

import { useEffect } from 'react';
import { applyA11yPrefs, init } from '@/lib/config';

export default function ConfigProviderIsland() {
  useEffect(() => {
    let cancelled = false;

    async function initializeConfig() {
      applyA11yPrefs();
      await init();
    }

    void initializeConfig();

    const onAfterSwap = () => {
      if (!cancelled) void initializeConfig();
    };
    document.addEventListener('astro:after-swap', onAfterSwap);
    return () => {
      cancelled = true;
      document.removeEventListener('astro:after-swap', onAfterSwap);
    };
  }, []);

  return null;
}
