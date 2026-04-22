#!/usr/bin/env npx tsx

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { splitAIProviderKeys } from '../src/lib/ai-online-provider-pool';
import { AIService, parseWorkersAiMode } from './lib/ai';
import { renderAiTelemetryReport, type TelemetryCheckpoint } from './lib/ai-telemetry-report';
import type { CacheData, SkillCache } from './lib/types';

const DEFAULT_SKILL_ID = 'affaan-m/everything-claude-code/prompt-optimizer';
const DEFAULT_CHECKPOINT_PATH = 'reports/seo/phase-40-runtime-probe.json';
const DEFAULT_RUNTIME_JSON_PATH = 'reports/seo/latest-ai-runtime-summary.json';
const DEFAULT_RUNTIME_MD_PATH = 'reports/seo/latest-ai-runtime-summary.md';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

function resolveSkill(cache: CacheData, skillId: string): SkillCache {
  const skill = cache.skills.find((entry) => entry.id === skillId);
  if (!skill) {
    throw new Error(`Skill ${skillId} not found in data/skills-cache.json`);
  }
  return skill;
}

function getSkillDescription(skill: SkillCache): string {
  if (typeof skill.description === 'string' && skill.description.trim().length > 0) {
    return skill.description;
  }
  const localizedDescription = skill.description?.en;
  if (typeof localizedDescription === 'string' && localizedDescription.trim().length > 0) {
    return localizedDescription;
  }
  const skillMdDescription = skill.skillMd?.description;
  if (typeof skillMdDescription === 'string' && skillMdDescription.trim().length > 0) {
    return skillMdDescription;
  }
  return skill.name;
}

function getSkillBodyPreview(skill: SkillCache): string {
  if (typeof skill.skillMd?.bodyPreview === 'string' && skill.skillMd.bodyPreview.trim().length > 0) {
    return skill.skillMd.bodyPreview;
  }
  if (typeof skill.skillMd?.body === 'string' && skill.skillMd.body.trim().length > 0) {
    return skill.skillMd.body.slice(0, 4000);
  }
  return getSkillDescription(skill);
}

function hasConfiguredRuntimeProviders(): boolean {
  const nvidiaCount = splitAIProviderKeys(
    process.env.NVIDIA_API_KEYS,
    process.env.NVIDIA_API_KEY,
    process.env.NVIDIA_API_KEYS_2,
    process.env.NVIDIA_API_KEYS_3,
    process.env.NVIDIA_API_KEYS_4,
    process.env.NVIDIA_API_KEYS_5,
  ).length;
  const openRouterCount = splitAIProviderKeys(process.env.OPENROUTER_API_KEYS, process.env.OPENROUTER_API_KEY).length;
  const siliconFlowConfigured = Boolean((process.env.SILICONFLOW_API_KEY || '').trim());
  const workersAiMode = parseWorkersAiMode(process.env.WORKERS_AI_MODE);
  const workersAiConfigured =
    workersAiMode !== 'disabled' &&
    Boolean((process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()) &&
    Boolean((process.env.CLOUDFLARE_API_TOKEN || '').trim());

  return nvidiaCount > 0 || openRouterCount > 0 || siliconFlowConfigured || workersAiConfigured;
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const skillId = readArg('--skill-id') || DEFAULT_SKILL_ID;
  const checkpointPath = resolve(process.cwd(), readArg('--checkpoint-file') || DEFAULT_CHECKPOINT_PATH);
  const runtimeJsonPath = resolve(process.cwd(), readArg('--runtime-json') || DEFAULT_RUNTIME_JSON_PATH);
  const runtimeMdPath = resolve(process.cwd(), readArg('--runtime-md') || DEFAULT_RUNTIME_MD_PATH);

  if (!hasConfiguredRuntimeProviders()) {
    console.log('Skipping AI runtime probe: no AI provider credentials are configured for this environment.');
    return;
  }

  const cachePath = resolve(process.cwd(), 'data/skills-cache.json');
  const cache = JSON.parse(readFileSync(cachePath, 'utf-8')) as CacheData;
  const skill = resolveSkill(cache, skillId);
  const aiService = new AIService();

  let status: TelemetryCheckpoint['status'] = 'completed';
  let errorMessage: string | null = null;

  try {
    await aiService.generateAgentAnalysis(skill.name, getSkillDescription(skill), getSkillBodyPreview(skill));
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const lastUpdated = new Date().toISOString();
  const checkpoint: TelemetryCheckpoint = {
    status,
    startedAt,
    lastUpdated,
    completedAt: status === 'completed' ? lastUpdated : undefined,
    selectedCount: 1,
    completedIds: status === 'completed' ? [skill.id] : [],
    failedIds: status === 'failed' ? [{ id: skill.id, error: errorMessage || 'AI runtime probe failed' }] : [],
    pendingIds: [],
    skippedIds: [],
    aiTelemetry: aiService.getTelemetrySnapshot(),
  };

  const summary = renderAiTelemetryReport(checkpoint, checkpointPath, lastUpdated);

  for (const outputPath of [checkpointPath, runtimeJsonPath, runtimeMdPath]) {
    mkdirSync(dirname(outputPath), { recursive: true });
  }

  writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  writeFileSync(runtimeJsonPath, JSON.stringify(checkpoint, null, 2));
  writeFileSync(runtimeMdPath, summary);

  console.log(`Runtime probe saved checkpoint: ${checkpointPath}`);
  console.log(`Runtime probe refreshed JSON summary: ${runtimeJsonPath}`);
  console.log(`Runtime probe refreshed Markdown summary: ${runtimeMdPath}`);
  console.log(`Probe skill: ${skill.id}`);
  console.log(`Probe status: ${status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
