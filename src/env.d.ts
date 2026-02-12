/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type KVNamespace = import("@cloudflare/workers-types").KVNamespace;
type ENV = {
    TRANSLATIONS: KVNamespace;
    SKILLS_CACHE: KVNamespace;
    AI: any;
    WORKFLOWS_SERVICE: Fetcher;
    ASSETS: Fetcher;
    ADMIN_USER?: string;
    ADMIN_PASSWORD?: string;
    NVIDIA_API_KEY?: string;
    NVIDIA_API_KEYS?: string;
    NVIDIA_API_KEYS_2?: string;
    NVIDIA_API_KEYS_3?: string;
};

// Extend the runtime environment
declare namespace App {
    interface Locals extends Record<string, any> {
        runtime: {
            env: ENV;
            cf: any;
            caches: any;
        }
    }
}

interface ImportMetaEnv {
    readonly PUBLIC_OG_SERVER_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
