/**
 * Unified Cloudflare KV Service
 * 
 * Consolidates all KV operations used across:
 * - sync-to-kv.ts (bulk sync)
 * - warmup-cache.ts (cache warming)
 * - build-skills-cache.ts (live push)
 */

import 'dotenv/config';
import { KV_NAMESPACE_ID } from './constants';
import { fetchWithTimeout } from './utils';

export interface KVConfig {
    apiToken: string;
    accountId: string;
    namespaceId: string;
}

export class KVService {
    private config: KVConfig;

    constructor(config?: Partial<KVConfig>) {
        this.config = {
            apiToken: config?.apiToken || process.env.CLOUDFLARE_API_TOKEN || '',
            accountId: config?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '',
            namespaceId: config?.namespaceId || KV_NAMESPACE_ID,
        };
    }

    get isConfigured(): boolean {
        return !!(this.config.apiToken && this.config.accountId);
    }

    private get baseUrl(): string {
        return `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/storage/kv/namespaces/${this.config.namespaceId}`;
    }

    private get headers(): Record<string, string> {
        return {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Write a single key-value pair to KV
     */
    async writeOne(key: string, value: string): Promise<boolean> {
        const url = `${this.baseUrl}/values/${encodeURIComponent(key)}`;
        try {
            const response = await fetchWithTimeout(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.config.apiToken}`,
                    'Content-Type': 'text/plain',
                },
                body: value,
            });

            if (!response.ok) {
                const error = await response.text();
                console.error(`❌ KV write failed for ${key}: ${error}`);
                return false;
            }
            return true;
        } catch (error) {
            console.error(`❌ KV network error for ${key}:`, error);
            return false;
        }
    }

    /**
     * Bulk write key-value pairs to KV (Cloudflare Bulk API)
     * Automatically batches in chunks of batchSize (default: 100)
     */
    async writeBulk(
        items: Array<{ key: string; value: string }>,
        options: { batchSize?: number; delayMs?: number; expiration_ttl?: number } = {}
    ): Promise<boolean> {
        const { batchSize = 100, delayMs = 500, expiration_ttl } = options;
        const url = `${this.baseUrl}/bulk`;
        let allSuccess = true;

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize).map(e => {
                const entry: any = { key: e.key, value: e.value };
                if (expiration_ttl) entry.expiration_ttl = expiration_ttl;
                return entry;
            });

            try {
                const response = await fetchWithTimeout(url, {
                    method: 'PUT',
                    headers: this.headers,
                    body: JSON.stringify(batch),
                }, 60000);

                if (!response.ok) {
                    const error = await response.text();
                    console.error(`❌ KV bulk write failed (${i}-${i + batch.length}): ${error}`);
                    allSuccess = false;
                } else {
                    console.log(`✅ KV bulk wrote ${i + 1} - ${i + batch.length} / ${items.length}`);
                }
            } catch (error) {
                console.error(`❌ KV bulk write network error:`, error);
                allSuccess = false;
            }

            // Rate limit delay between batches
            if (i + batchSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        return allSuccess;
    }

    /**
     * Fetch all keys in the KV namespace (with pagination)
     */
    async fetchAllKeys(): Promise<string[]> {
        const allKeys: string[] = [];
        let cursor: string | undefined;
        let page = 0;

        do {
            page++;
            const params = new URLSearchParams({ limit: '1000' });
            if (cursor) params.set('cursor', cursor);

            try {
                const response = await fetchWithTimeout(`${this.baseUrl}/keys?${params}`, {
                    method: 'GET',
                    headers: this.headers,
                });

                if (!response.ok) {
                    console.error(`❌ Failed to fetch keys (page ${page}): ${response.status}`);
                    break;
                }

                const data = await response.json() as any;
                const keys = data.result || [];
                allKeys.push(...keys.map((k: any) => k.name));

                cursor = data.result_info?.cursor;
                // If no more results, stop
                if (!cursor || keys.length === 0) break;
            } catch (error) {
                console.error(`❌ Error fetching keys:`, error);
                break;
            }
        } while (cursor);

        return allKeys;
    }

    /**
     * Delete keys from KV (in batches of 10000)
     */
    async deleteKeys(keys: string[]): Promise<number> {
        if (keys.length === 0) return 0;

        const BATCH_SIZE = 10000;
        let deletedCount = 0;

        for (let i = 0; i < keys.length; i += BATCH_SIZE) {
            const batch = keys.slice(i, i + BATCH_SIZE);

            try {
                const response = await fetchWithTimeout(`${this.baseUrl}/bulk`, {
                    method: 'DELETE',
                    headers: this.headers,
                    body: JSON.stringify(batch),
                });

                if (response.ok) {
                    deletedCount += batch.length;
                    console.log(`🗑️ Deleted ${batch.length} keys (${deletedCount}/${keys.length})`);
                } else {
                    console.error(`❌ Failed to delete keys: ${response.status}`);
                }
            } catch (error) {
                console.error(`❌ Error deleting keys:`, error);
            }
        }

        return deletedCount;
    }

    /**
     * Push a single skill to KV for real-time frontend updates
     * Non-blocking: failures are logged but don't interrupt the caller
     */
    async pushSkill(skill: { id: string;[key: string]: any }): Promise<void> {
        if (!this.isConfigured) {
            console.warn('[LIVE] ⚠️ Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID, skipping KV push');
            return;
        }

        // Slim the skill data to match bulk sync format (strip body/bodyPreview/raw)
        const slimmed = { ...skill };
        if (slimmed.skillMd) {
            const { body, bodyPreview, raw, ...keep } = slimmed.skillMd as any;
            slimmed.skillMd = keep;
        }
        delete (slimmed as any).readme;
        delete (slimmed as any).content;

        const key = `skill:${skill.id}`;
        const url = `${this.baseUrl}/bulk`;

        try {
            const response = await fetchWithTimeout(url, {
                method: 'PUT',
                headers: this.headers,
                body: JSON.stringify([{ key, value: JSON.stringify(slimmed) }]),
            }, 30000);

            if (response.ok) {
                console.log(`[LIVE] ✅ Synced ${key} to KV`);
            } else {
                console.warn(`[LIVE] ❌ Failed to sync ${key}: ${response.status} ${await response.text().catch(() => '')}`);
            }
        } catch (e) {
            console.warn(`[LIVE] ❌ Network error syncing ${key}:`, (e as Error).message);
        }
    }
}
