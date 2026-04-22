#!/usr/bin/env node

// Submit the live sitemap index to Google Search Console.
// Uses the Search Console sitemaps.submit endpoint rather than the Indexing API,
// which is reserved for a narrow set of page types.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { JWT } from 'google-auth-library';

dotenv.config();
const localEnvPath = resolve(process.cwd(), '.env.local');
if (existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: true });
}

const HOST = 'killer-skills.com';
const DEFAULT_SITE_URL = `sc-domain:${HOST}`;
const DEFAULT_SITEMAP_URL = `https://${HOST}/sitemap.xml`;

function resolveConfig() {
  const siteUrl = (process.env.GSC_SITE_URL || DEFAULT_SITE_URL).trim();
  const clientEmail = (process.env.GSC_CLIENT_EMAIL || '').trim();
  const privateKey = (process.env.GSC_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const credentialsPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();

  if (clientEmail && privateKey) {
    return {
      siteUrl,
      clientEmail,
      privateKey,
      source: 'gsc-env',
    };
  }

  if (credentialsPath && existsSync(credentialsPath)) {
    const key = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    const fileClientEmail = String(key.client_email || '').trim();
    const filePrivateKey = String(key.private_key || '').trim();
    if (fileClientEmail && filePrivateKey) {
      return {
        siteUrl,
        clientEmail: fileClientEmail,
        privateKey: filePrivateKey,
        source: 'service-account-json',
      };
    }
  }

  return null;
}

function buildSitemapsEndpoint(siteUrl, sitemapUrl) {
  return `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
}

async function main() {
  const config = resolveConfig();
  if (!config) {
    console.error(
      '❌ Error: Google Search Console credentials are missing. Set GSC_CLIENT_EMAIL + GSC_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS.',
    );
    process.exit(1);
  }

  const client = new JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters'],
  });

  console.log(`🚀 Starting Google sitemap submission for ${HOST}...`);
  console.log(`   → Property: ${config.siteUrl}`);
  console.log(`   → Sitemap: ${DEFAULT_SITEMAP_URL}`);
  console.log(`   → Credential source: ${config.source}`);

  const endpoint = buildSitemapsEndpoint(config.siteUrl, DEFAULT_SITEMAP_URL);

  try {
    await client.request({
      url: endpoint,
      method: 'PUT',
    });
    console.log('✅ Google Search Console accepted the sitemap submission.');
  } catch (error) {
    const status = error?.response?.status;
    const details =
      typeof error?.response?.data === 'string'
        ? error.response.data
        : JSON.stringify(error?.response?.data || {});
    console.error(`❌ Sitemap submission failed${status ? ` (${status})` : ''}: ${details || error.message}`);
    process.exit(1);
  }

  try {
    const verification = await client.request({
      url: endpoint,
      method: 'GET',
    });
    const data = verification?.data || {};
    console.log('🔎 Search Console sitemap status snapshot:');
    console.log(`   → isPending: ${String(data.isPending ?? 'unknown')}`);
    console.log(`   → lastSubmitted: ${String(data.lastSubmitted ?? 'unknown')}`);
    console.log(`   → lastDownloaded: ${String(data.lastDownloaded ?? 'unknown')}`);
    console.log(`   → warnings: ${String(data.warnings ?? 'unknown')}`);
    console.log(`   → errors: ${String(data.errors ?? 'unknown')}`);
  } catch (error) {
    const status = error?.response?.status;
    console.warn(
      `⚠️ Submission succeeded, but sitemap status lookup failed${status ? ` (${status})` : ''}: ${error.message}`,
    );
  }
}

main().catch((error) => {
  console.error(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
