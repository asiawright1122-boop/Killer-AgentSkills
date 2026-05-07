// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config/locales.mjs';

const enableRemoteBindings = process.env.CF_REMOTE_BINDINGS === 'true';
const isAstroCheck = process.env.npm_lifecycle_event === 'check:astro';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://killer-skills.com',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },

  ...(isAstroCheck
    ? {}
    : {
        adapter: cloudflare({
          // Avoid duplicating Pages bindings into the adapter's auxiliary prerender worker.
          prerenderEnvironment: 'node',
          // Remote bindings can fail in non-interactive CI runners and offline local checks.
          // Opt in with CF_REMOTE_BINDINGS=true when live Cloudflare resources are needed.
          remoteBindings: enableRemoteBindings,
          inspectorPort: false,
        }),
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

  // Content Security Policy (Astro 5 experimental).
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
  experimental: {
    csp: {
      algorithm: 'SHA-256',
      // `directives` accepts every CSP keyword EXCEPT script-src / style-src,
      // which are configured via the dedicated objects below so Astro can
      // merge in the auto-generated hashes for hydration and inline scripts.
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
        // Allow Tailwind 4 / island-injected inline styles by including
        // 'unsafe-inline'. Per the W3C CSP3 spec, when 'unsafe-inline' and
        // hashes coexist, browsers ignore 'unsafe-inline' — but older browsers
        // fall back to it, so we keep both for graceful degradation.
        resources: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      },
      scriptDirective: {
        // Hash-only mode: Astro injects sha256 hashes for every inline script
        // it generates (hydration helpers, view transitions, etc.). External
        // scripts must be loaded from 'self'. Add more origins here only if
        // you intentionally bring in a third-party SDK.
        resources: ["'self'"],
      },
    },
  },
});
