'use client';

import { preloadHeroImage } from '@/lib/config';
import { useEffect } from 'react';

export default function HomePageApp() {
  useEffect(() => {
    preloadHeroImage();
  }, []);

  return null;
}
