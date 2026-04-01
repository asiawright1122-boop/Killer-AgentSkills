# Architecture

## System Design & Patterns
Killer-Skills utilizes a modern edge-first architecture leaning heavily on SSR and static caching for fast global read accessibility.

### Hydration and Rendering
- **Islands Architecture**: Employs Astro's islands architecture where the shell is statically generated or server-rendered, and interactive elements (like `SubmitSkillModal.tsx` and `WebTerminal.tsx`) are lazy-hydrated React components.
- **Pre-rendering**: A mix of pre-rendered static routes for directories and dynamic SSR for complex interactions or dynamic slugs, configured organically via Astro SSR.

### Data Flow
- **Offline to Online Pipeline**: The application data is harvested by heavy-duty Node scripts from raw GitHub repositories, enriched by AI (Nvidia/SiliconFlow), and generated as JSON caches.
- **Edge Distribution**: These JSONs and delta updates are submitted natively to Cloudflare KV or D1 edge databases. The Astro edge functions query KV/D1 directly without cold starts.
- **I18n Router**: Injected translations dictate locale routing patterns. Paths generally follow `/[locale]/[page]` with rigorous fallback routing.

### Abstractions
- **Data abstraction (`src/lib`)**: Wraps Cloudflare specific `env` bindings (KV, D1, fetchers) into mockable local interfaces to decouple the Astro views from the underlying D1 driver.
- **I18n abstraction (`src/i18n.ts`)**: Manages strong typings globally for supported locales and manages `loadMessages` and fallback logics efficiently on server-load.
