#!/bin/bash
# Cache Artifact Manager
# Uploads/downloads skills-cache.json to/from GitHub Release assets
# This replaces Git LFS for storing the large cache file.
#
# Usage:
#   ./scripts/cache-artifact.sh upload   # Upload current cache to GitHub Release
#   ./scripts/cache-artifact.sh download # Download cache from GitHub Release
#
# Requires: GITHUB_TOKEN environment variable

set -euo pipefail

REPO="asiawright1122-boop/Killer-AgentSkills"
CACHE_FILE="data/skills-cache.json"
COMPRESSED_FILE="data/skills-cache.json.gz"
RELEASE_TAG="cache-data"
ASSET_NAME="skills-cache.json.gz"

upload() {
    echo "📦 Compressing $CACHE_FILE..."
    gzip -k -9 -f "$CACHE_FILE"
    local SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
    echo "   Compressed: $SIZE"

    # Check if release exists
    local RELEASE_ID=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO/releases/tags/$RELEASE_TAG" \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")

    if [ -z "$RELEASE_ID" ]; then
        echo "📝 Creating release '$RELEASE_TAG'..."
        RELEASE_ID=$(curl -s -X POST \
            -H "Authorization: token $GITHUB_TOKEN" \
            -H "Content-Type: application/json" \
            "https://api.github.com/repos/$REPO/releases" \
            -d "{\"tag_name\":\"$RELEASE_TAG\",\"name\":\"Cache Data\",\"body\":\"Auto-managed cache data for CI/CD pipelines. Do not delete.\",\"draft\":false,\"prerelease\":true}" \
            | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
        echo "   Release created: $RELEASE_ID"
    else
        echo "   Release exists: $RELEASE_ID"
        # Delete existing asset if present
        local EXISTING_ASSET=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
            "https://api.github.com/repos/$REPO/releases/$RELEASE_ID/assets" \
            | python3 -c "import sys,json; assets=json.load(sys.stdin); [print(a['id']) for a in assets if a['name']=='$ASSET_NAME']" 2>/dev/null || echo "")
        if [ -n "$EXISTING_ASSET" ]; then
            echo "   Deleting old asset $EXISTING_ASSET..."
            curl -s -X DELETE -H "Authorization: token $GITHUB_TOKEN" \
                "https://api.github.com/repos/$REPO/releases/assets/$EXISTING_ASSET" > /dev/null
        fi
    fi

    echo "⬆️  Uploading $ASSET_NAME ($SIZE)..."
    curl -s -X POST \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Content-Type: application/gzip" \
        "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=$ASSET_NAME" \
        --data-binary "@$COMPRESSED_FILE" \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   ✅ Uploaded: {d[\"name\"]} ({d[\"size\"]} bytes)')"

    rm -f "$COMPRESSED_FILE"
    echo "🎉 Upload complete!"
}

download() {
    echo "⬇️  Downloading $ASSET_NAME from release '$RELEASE_TAG'..."

    local DOWNLOAD_URL=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO/releases/tags/$RELEASE_TAG" \
        | python3 -c "
import sys,json
d=json.load(sys.stdin)
for a in d.get('assets',[]):
    if a['name']=='$ASSET_NAME':
        print(a['url'])
        break
" 2>/dev/null || echo "")

    if [ -z "$DOWNLOAD_URL" ]; then
        echo "⚠️  No cache artifact found in release '$RELEASE_TAG'"
        echo "   The build will proceed without local cache (slower first run)"
        exit 0
    fi

    curl -sL -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/octet-stream" \
        "$DOWNLOAD_URL" -o "$COMPRESSED_FILE"

    echo "📦 Decompressing..."
    gzip -d -f "$COMPRESSED_FILE"

    local SIZE=$(du -h "$CACHE_FILE" | cut -f1)
    echo "✅ Cache restored: $CACHE_FILE ($SIZE)"
}

case "${1:-}" in
    upload)  upload ;;
    download) download ;;
    *)
        echo "Usage: $0 {upload|download}"
        echo "  upload   - Compress and upload skills-cache.json to GitHub Release"
        echo "  download - Download and decompress skills-cache.json from GitHub Release"
        exit 1
        ;;
esac
