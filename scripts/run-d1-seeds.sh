#!/bin/bash

echo "🛠️ Initializing FTS5 Virtual Table..."
npx wrangler d1 execute killer-skills-db --remote --command="CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(id UNINDEXED, name, owner, repo, category, search_text, tokenize='unicode61 remove_diacritics 1');"

SUCCESS=0
FAILED=0

echo "🌀 Executing seed 0/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_0.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 0 failed, continuing..."
fi

echo "🌀 Executing seed 1/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_1.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 1 failed, continuing..."
fi

echo "🌀 Executing seed 2/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_2.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 2 failed, continuing..."
fi

echo "🌀 Executing seed 3/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_3.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 3 failed, continuing..."
fi

echo "🌀 Executing seed 4/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_4.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 4 failed, continuing..."
fi

echo "🌀 Executing seed 5/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_5.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 5 failed, continuing..."
fi

echo "🌀 Executing seed 6/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_6.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 6 failed, continuing..."
fi

echo "🌀 Executing seed 7/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_7.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 7 failed, continuing..."
fi

echo "🌀 Executing seed 8/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_8.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 8 failed, continuing..."
fi

echo "🌀 Executing seed 9/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_9.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 9 failed, continuing..."
fi

echo "🌀 Executing seed 10/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_10.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 10 failed, continuing..."
fi

echo "🌀 Executing seed 11/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_11.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 11 failed, continuing..."
fi

echo "🌀 Executing seed 12/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_12.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 12 failed, continuing..."
fi

echo "🌀 Executing seed 13/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_13.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 13 failed, continuing..."
fi

echo "🌀 Executing seed 14/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_14.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 14 failed, continuing..."
fi

echo "🌀 Executing seed 15/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_15.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 15 failed, continuing..."
fi

echo "🌀 Executing seed 16/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_16.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 16 failed, continuing..."
fi

echo "🌀 Executing seed 17/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_17.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 17 failed, continuing..."
fi

echo "🌀 Executing seed 18/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_18.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 18 failed, continuing..."
fi

echo "🌀 Executing seed 19/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_19.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 19 failed, continuing..."
fi

echo "🌀 Executing seed 20/20..."
if npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_20.sql; then
  SUCCESS=$((SUCCESS + 1))
else
  FAILED=$((FAILED + 1))
  echo "⚠️ Seed 20 failed, continuing..."
fi

echo ""
echo "📊 D1 Seed Results: $SUCCESS succeeded, $FAILED failed (total: 21)"

if [ "$FAILED" -gt 0 ]; then
  echo "⚠️ Some seeds failed, but $SUCCESS/21 were applied successfully"
  exit 1
fi

echo "✅ All 21 seeds executed successfully!"
