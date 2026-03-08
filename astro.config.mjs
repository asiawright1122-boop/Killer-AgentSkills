// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';

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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('react-markdown') || id.includes('remark-') || id.includes('unified') || id.includes('mdast') || id.includes('micromark') || id.includes('hast')) {
              return 'markdown-vendor';
            }
            if (id.includes('react-syntax-highlighter') || id.includes('refractor') || id.includes('prismjs')) {
              return 'syntax-vendor';
            }
          },
        },
      },
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
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      }
    }
  },
  image: {
    service: passthroughImageService()
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});