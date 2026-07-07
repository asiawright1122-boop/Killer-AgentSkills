// NOTE: The 'skills' content collection has been REMOVED.
// Loading 84MB of skills-cache.json via Astro Content Layer caused the
// Cloudflare Worker bundle to exceed the 3MiB free-tier size limit.
// All skill data is now loaded at runtime from D1/KV via src/lib/skills.ts.
//
// NOTE: The 'collections' content collection has been REMOVED.
// Collections JSON files are now loaded at runtime from KV via
// src/lib/collections-runtime.ts to avoid bloating the Worker bundle.

// NOTE: The 'blog' content collection has also been REMOVED.
// Blog routes now load markdown through src/lib/blog-glob-loader.ts and
// sitemap generation uses src/lib/blog-buildtime.ts. Keeping blog in the
// Content Layer serialized every localized article body into the SSR Worker.

export const collections = {};
