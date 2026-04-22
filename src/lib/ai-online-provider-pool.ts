import { getProviderRotationOrder, type AIProviderRoutingCandidate } from './ai-provider-routing';

export type AIOnlinePrimaryProviderName = 'nvidia';
export type AIOnlineBackupProviderName = 'siliconflow' | 'openrouter';
export type AIOnlineProviderName = AIOnlinePrimaryProviderName | AIOnlineBackupProviderName;

export interface AIOnlineProviderPoolCandidate<
  TProvider extends AIOnlineProviderName = AIOnlineProviderName,
> extends Omit<AIProviderRoutingCandidate<TProvider>, 'rotationOrder' | 'available' | 'groupPriority'> {
  key: string;
  rotationOrder: number;
  available: boolean;
}

export interface AIOnlineBackupProviderPoolCandidate<
  TProvider extends AIOnlineBackupProviderName = AIOnlineBackupProviderName,
> extends AIOnlineProviderPoolCandidate<TProvider> {
  groupPriority: number;
}

export interface AIOnlineProviderPool {
  nvidiaPoolSize: number;
  openRouterPoolSize: number;
  primaryCandidates: AIOnlineProviderPoolCandidate<AIOnlinePrimaryProviderName>[];
  backupCandidates: AIOnlineBackupProviderPoolCandidate[];
}

export interface BuildAIOnlineProviderPoolOptions {
  nvidiaKeys: string[];
  siliconFlowKey?: string | null;
  openRouterKeys: string[];
  nvidiaRotationIndex?: number;
  openRouterRotationIndex?: number;
  isAvailable?: (candidate: AIOnlineProviderPoolCandidate) => boolean;
}

export function splitAIProviderKeys(...sources: Array<string | undefined | null>): string[] {
  return sources
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveProviderRotationStart(currentIndex: number, poolSize: number): number {
  if (poolSize <= 0) return 0;
  return ((currentIndex % poolSize) + poolSize) % poolSize;
}

export function buildAIOnlineProviderPool(options: BuildAIOnlineProviderPoolOptions): AIOnlineProviderPool {
  const isAvailable = options.isAvailable || (() => true);
  const nvidiaPoolSize = options.nvidiaKeys.length;
  const nvidiaRotationStart = resolveProviderRotationStart(options.nvidiaRotationIndex || 0, nvidiaPoolSize);
  const openRouterPoolSize = options.openRouterKeys.length;
  const openRouterRotationStart = resolveProviderRotationStart(
    options.openRouterRotationIndex || 0,
    openRouterPoolSize,
  );

  const primaryCandidates = options.nvidiaKeys.map((key, index) => {
    const candidate: AIOnlineProviderPoolCandidate<'nvidia'> = {
      provider: 'nvidia',
      key,
      label: `N${index}`,
      rotationOrder: getProviderRotationOrder(index, nvidiaRotationStart, nvidiaPoolSize),
      available: false,
    };
    candidate.available = isAvailable(candidate);
    return candidate;
  });

  const backupCandidates: AIOnlineBackupProviderPoolCandidate[] = [];

  if (options.siliconFlowKey) {
    const candidate: AIOnlineBackupProviderPoolCandidate<'siliconflow'> = {
      provider: 'siliconflow',
      key: options.siliconFlowKey,
      label: 'S',
      groupPriority: 0,
      rotationOrder: 0,
      available: false,
    };
    candidate.available = isAvailable(candidate);
    backupCandidates.push(candidate);
  }

  for (let offset = 0; offset < openRouterPoolSize; offset += 1) {
    const index = (openRouterRotationStart + offset) % openRouterPoolSize;
    const candidate: AIOnlineBackupProviderPoolCandidate<'openrouter'> = {
      provider: 'openrouter',
      key: options.openRouterKeys[index],
      label: `O${index}`,
      groupPriority: 1,
      rotationOrder: getProviderRotationOrder(index, openRouterRotationStart, openRouterPoolSize),
      available: false,
    };
    candidate.available = isAvailable(candidate);
    backupCandidates.push(candidate);
  }

  return {
    nvidiaPoolSize,
    openRouterPoolSize,
    primaryCandidates,
    backupCandidates,
  };
}
