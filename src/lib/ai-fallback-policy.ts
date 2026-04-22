export type AIFallbackRoutingPolicy = 'cold' | 'guarded' | 'always';

export function parseAIFallbackPolicy(raw: string | undefined | null): AIFallbackRoutingPolicy {
  const normalized = String(raw || 'cold')
    .trim()
    .toLowerCase();
  if (normalized === 'guarded' || normalized === 'always') return normalized;
  return 'cold';
}

export function resolveAIFallbackActivation(options: {
  policy: AIFallbackRoutingPolicy;
  primaryConfigured: boolean;
  primaryAvailable: boolean;
  alwaysReason?: string | null;
}): { backupsAllowed: boolean; activationReason: string | null } {
  const alwaysReason = String(options.alwaysReason || 'policy_always').trim() || 'policy_always';

  if (options.policy === 'always') {
    return {
      backupsAllowed: true,
      activationReason: alwaysReason,
    };
  }

  if (options.policy === 'guarded') {
    if (!options.primaryConfigured) {
      return {
        backupsAllowed: true,
        activationReason: 'no_nvidia_configured',
      };
    }

    if (!options.primaryAvailable) {
      return {
        backupsAllowed: true,
        activationReason: 'nvidia_unavailable',
      };
    }
  }

  return {
    backupsAllowed: false,
    activationReason: null,
  };
}
