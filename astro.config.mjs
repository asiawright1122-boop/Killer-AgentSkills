// @ts-check
import { defineConfig } from 'astro/config';
import process from 'node:process';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config/locales.mjs';

const isAstroCheck = process.env.npm_lifecycle_event === 'check:astro';
const isCiAstroDev = process.env.CI === 'true' && process.env.npm_lifecycle_event === 'dev';
const srcAlias = new URL('./src', import.meta.url).pathname;

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://killer-skills.com',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },

  ...(isAstroCheck || isCiAstroDev
    ? {}
    : {
        adapter: cloudflare(),
      }),

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['node:crypto', 'node:fs', 'node:path'],
    },
    resolve: {
      alias: {
        '~': srcAlias,
        ...(import.meta.env.PROD
          ? {
              'react-dom/server': 'react-dom/server.edge',
            }
          : {}),
      },
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
    syntaxHighlight: 'prism',
  },
  // Image optimization handled by Cloudflare Images binding (IMAGES).
  // Previously used passthroughImageService which served unoptimized originals.
  // The @astrojs/cloudflare adapter auto-detects the IMAGES binding.
  // Prefetch strategy: `hover` avoids the bandwidth/KV-read amplification that
  // `viewport`+`prefetchAll` caused on skill listing pages (hundreds of
  // in-viewport cards triggered hundreds of SSR fetches). `hover` preserves
  // the instant-navigation feel for users who actually intend to click.
  // Opt individual links back in with `data-astro-prefetch="viewport"` when
  // a page legitimately needs aggressive prefetching.
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },

  // Content Security Policy (Astro 6 — promoted from experimental to security.csp).
  //
  // This emits a per-page <meta http-equiv="content-security-policy"> with
  // SHA-256 hashes of every Astro-generated inline script, including hydration
  // scripts. Combined with the HTTP-header CSP we plan to add via middleware,
  // this gives us defence-in-depth against XSS without requiring nonces on
  // every page (Cloudflare full-page caching makes nonces impractical because
  // the cached HTML would freeze a single nonce across all visitors).
  //
  // External origins explicitly allowed below:
  //   - fonts.googleapis.com → Google Fonts CSS (style-src)
  //   - fonts.gstatic.com    → Google Fonts WOFF2 binaries (font-src)
  //   - avatars.githubusercontent.com / *.githubusercontent.com → repo
  //     owner avatars rendered on every skill card (img-src)
  //   - github.com           → outbound repo links only (form-action / link)
  //
  // We intentionally allow `'unsafe-inline'` ONLY for style-src for now —
  // Tailwind 4 + many third-party React islands inject inline <style> tags
  // that have no stable hash, and the XSS risk via CSS is bounded. Script
  // execution is hash-only.
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'self'",
        "form-action 'self' https://github.com",
        "img-src 'self' data: https://avatars.githubusercontent.com https://*.githubusercontent.com https://github.com https://killer-skills.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self' https://api.github.com https://raw.githubusercontent.com",
        "object-src 'none'",
        "manifest-src 'self'",
      ],
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      },
      scriptDirective: {
        resources: ["'self'"],
      },
    },
  },
});
