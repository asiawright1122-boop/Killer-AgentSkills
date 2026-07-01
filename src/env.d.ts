/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

// Cloudflare Workers CacheStorage has a .default property (the global edge cache)
// that is not in the standard TypeScript CacheStorage interface.
declare global {
  interface CacheStorage {
    default: Cache;
  }
}

type KVNamespace = import('@cloudflare/workers-types').KVNamespace;
type D1Database = import('@cloudflare/workers-types').D1Database;
type Fetcher = import('@cloudflare/workers-types').Fetcher;
type VectorizeIndex = import('@cloudflare/workers-types').VectorizeIndex;

type ENV = {
  TRANSLATIONS: KVNamespace;
  SKILLS_CACHE: KVNamespace;
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: any; // Type 'Ai' from @cloudflare/workers-types if available
  WORKFLOWS_SERVICE: Fetcher;
  ASSETS: Fetcher;
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_API_KEYS?: string;
  NVIDIA_API_KEYS_2?: string;
  NVIDIA_API_KEYS_3?: string;
  NVIDIA_API_KEYS_4?: string;
  NVIDIA_API_KEYS_5?: string;
  NVIDIA_MODEL?: string;
  SILICONFLOW_API_KEY?: string;
  SILICONFLOW_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_API_KEYS?: string;
  OPENROUTER_MODEL?: string;
  AI_FALLBACK_POLICY?: string;
  AI_FALLBACK_ALWAYS_REASON?: string;
  TRANSLATE_WORKLOAD_PROFILE?: string;
  TRANSLATE_MODEL_NVIDIA?: string;
  TRANSLATE_MODEL_SILICONFLOW?: string;
  TRANSLATE_MODEL_OPENROUTER?: string;
  SKILL_TRY_DAILY_LIMIT?: string;
  SKILL_TRY_WORKLOAD_PROFILE?: string;
  SKILL_TRY_MODEL_NVIDIA?: string;
  SKILL_TRY_MODEL_SILICONFLOW?: string;
  SKILL_TRY_MODEL_OPENROUTER?: string;
};

// Extend the runtime environment
declare namespace App {
  interface Locals extends Record<string, any> {
    runtime: {
      env: ENV;
      cf: any;
      caches: any;
    };
  }
}

interface ImportMetaEnv {
  // Add other public env vars here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'cloudflare:workers' {
  export const env: ENV;
}
