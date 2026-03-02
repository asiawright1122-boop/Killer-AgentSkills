#!/bin/bash

set -e

SUCCESS=0
FAILED=0

# Loop over all generated seed files
for file in db/seeds/initial_*.sql; do
  echo "🌀 Executing $file..."
  if npx wrangler d1 execute killer-skills-db --remote --file=$file --yes; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAILED=$((FAILED + 1))
    echo "⚠️ Seed $file failed, continuing..."
  fi
  sleep 0.5
done

echo "\n📊 D1 Seed Results: $SUCCESS succeeded, $FAILED failed"
if [ "$FAILED" -gt 0 ]; then
  echo "⚠️ Some seeds failed, but $SUCCESS succeeded"
  exit 1
fi

echo "✅ All seeds executed successfully!"
