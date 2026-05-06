type RuntimeLocals = {
  runtime?: {
    env?: unknown;
  };
};

function hasRuntimeBindings(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

export async function getRuntimeEnv<TEnv = Record<string, unknown>>(locals?: RuntimeLocals): Promise<TEnv | undefined> {
  try {
    const legacyEnv = locals?.runtime?.env;
    if (hasRuntimeBindings(legacyEnv)) return legacyEnv as TEnv;
  } catch {
    // Astro 6 Cloudflare intentionally throws for locals.runtime.env.
  }

  try {
    const { env: cloudflareEnv } = await import('cloudflare:workers');
    return hasRuntimeBindings(cloudflareEnv) ? (cloudflareEnv as TEnv) : undefined;
  } catch {
    return undefined;
  }
}
