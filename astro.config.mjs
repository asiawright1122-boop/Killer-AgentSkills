// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://killer-skills.com',

  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['node:crypto', 'node:fs', 'node:path']
    },
    resolve: {
      alias: import.meta.env.PROD ? {
        'react-dom/server': 'react-dom/server.edge',
      } : {},
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  image: {
    service: {
      entrypoint: 'astro/assets/services/noop'
    }
  },
});