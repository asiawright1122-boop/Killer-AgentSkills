#!/bin/bash

# Killer Skills - Full Automation Script
# Runs the entire content pipeline: Skills, Blog, and UI Translations.

set -e # Exit on error

echo "🚀 Starting Full Automation Pipeline..."

# 1. Update Skills Cache
echo "---------------------------------------------------"
echo "📦 Phase 1: Skills Cache Update"
echo "---------------------------------------------------"
# Updates cache from GitHub & Official Repos, translates metadata
npm run build:cache -- --mode=update

# 2. Sync Blog Content
echo "---------------------------------------------------"
echo "📝 Phase 2: Blog Translation & Sync"
echo "---------------------------------------------------"
# Translates new English blog posts to all locales
# (Skips existing files unless FORCE_TRANSLATE=true is set)
npm run translate:blog

# Syncs metadata (heroImage, etc.) and fixes internal links across locales
npx tsx scripts/sync-blog-everything.ts

# 3. Update UI Translations
echo "---------------------------------------------------"
echo "🌐 Phase 3: UI Strings Translation"
echo "---------------------------------------------------"
# Checks src/messages/en.json and fills missing keys in other locales
npx tsx scripts/translate-locales.ts

# 4. Sync to Cloudflare KV
echo "---------------------------------------------------"
echo "☁️ Phase 4: Sync to Cloudflare KV"
echo "---------------------------------------------------"
# Pushes the updated skills-cache.json to Cloudflare Edge Storage
npm run sync:kv

echo "---------------------------------------------------"
echo "✅ Full Automation Complete!"
echo "---------------------------------------------------"
