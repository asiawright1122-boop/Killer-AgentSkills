// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config/locales.mjs';

const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const enablePlatformProxy = !isCi && process.env.CF_PLATFORM_PROXY !== 'false';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://killer-skills.com',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },

  adapter: cloudflare({
    // Wrangler platform proxy can fail in non-interactive CI runners.
    // Keep it enabled for local dev, disable it in CI by default.
    platformProxy: { enabled: enablePlatformProxy },
  }),

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['node:crypto', 'node:fs', 'node:path'],
    },
    resolve: {
      alias: import.meta.env.PROD
        ? {
            'react-dom/server': 'react-dom/server.edge',
          }
        : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('react-markdown') ||
              id.includes('remark-') ||
              id.includes('unified') ||
              id.includes('mdast') ||
              id.includes('micromark') ||
              id.includes('hast')
            ) {
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
    defaultLocale: DEFAULT_LOCALE,
    locales: [...SUPPORTED_LOCALES],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
  image: {
    service: passthroughImageService(),
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
