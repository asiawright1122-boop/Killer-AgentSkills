#!/bin/bash

# ==========================================
# Killer-Skills Automated Pipeline
# ------------------------------------------
# A script to orchestrate the skill harvesting, building, and syncing process.
# Usage: ./scripts/run-pipeline.sh [--once]
# ==========================================

# Configuration
LOG_DIR="logs"
LOCK_FILE=".pipeline.lock"
HARVEST_TARGET=${HARVEST_TARGET:-500}  # Default: 500
SLEEP_INTERVAL=${SLEEP_INTERVAL:-3600} # Default: 1 hour

# Create logs directory if not exists
mkdir -p "$LOG_DIR"

# Helper for logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Lock mechanism
if [ -f "$LOCK_FILE" ]; then
    # Check if process is actually running
    PID=$(cat "$LOCK_FILE")
    if ps -p $PID > /dev/null; then
        log "⚠️  Pipeline is already running (PID: $PID). Aborting."
        exit 1
    else
        log "⚠️  Found stale lock file. Cleaning up."
        rm "$LOCK_FILE"
    fi
fi

# Set lock
echo $$ > "$LOCK_FILE"

# Trap exit to clean lock
cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# Main pipeline function
run_pipeline() {
    TODAY=$(date '+%Y-%m-%d')
    LOG_FILE="$LOG_DIR/pipeline-$TODAY.log"
    
    log "🚀 Starting pipeline execution..." | tee -a "$LOG_FILE"

    # Step 1: Harvest
    log "🌾 Step 1: Harvesting GitHub Skills (Target: $HARVEST_TARGET)..." | tee -a "$LOG_FILE"
    if npx tsx scripts/harvest-github-skills.ts --target=$HARVEST_TARGET >> "$LOG_FILE" 2>&1; then
        log "✅ Harvest completed." | tee -a "$LOG_FILE"
    else
        log "❌ Harvest failed. Check logs." | tee -a "$LOG_FILE"
        # We might want to continue even if harvest fails (to process existing), or abort.
        # For now, let's continue.
    fi

    # Step 2: Build Cache (Incremental)
    log "🏗️  Step 2: Building Skills Cache (Incremental)..." | tee -a "$LOG_FILE"
    if npx tsx scripts/build-skills-cache.ts --mode=discover >> "$LOG_FILE" 2>&1; then
        log "✅ Build completed." | tee -a "$LOG_FILE"
    else
        log "❌ Build failed. Aborting sync." | tee -a "$LOG_FILE"
        return 1
    fi

    # Step 3: Sync to KV
    log "☁️  Step 3: Syncing to Cloudflare KV..." | tee -a "$LOG_FILE"
    if npx tsx scripts/sync-to-kv.ts >> "$LOG_FILE" 2>&1; then
        log "✅ Sync completed successfully." | tee -a "$LOG_FILE"
    else
        log "❌ Sync failed." | tee -a "$LOG_FILE"
        return 1
    fi

    log "🎉 Pipeline run finished." | tee -a "$LOG_FILE"
    return 0
}

# Run mode
if [ "$1" == "--once" ]; then
    run_pipeline
else
    # Daemon mode (simple loop, though PM2 is preferred for management)
    log "🔄 Starting Daemon Mode (Interval: ${SLEEP_INTERVAL}s)"
    while true; do
        run_pipeline
        log "💤 Sleeping for ${SLEEP_INTERVAL} seconds..."
        sleep $SLEEP_INTERVAL
    done
fi
