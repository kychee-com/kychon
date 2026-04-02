import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: {
    format: 'file',
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
