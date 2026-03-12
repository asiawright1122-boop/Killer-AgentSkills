#!/bin/bash

set -u

retryable_error() {
  local output="$1"
  [[ "$output" == *"D1_RESET_DO"* ]] || [[ "$output" == *"Not currently importing anything."* ]]
}

run_seed() {
  local index="$1"
  local cmd="$2"
  local attempt=1
  local max_attempts=3

  echo "🌀 Executing seed ${index}/${TOTAL_SEEDS}..."

  while [ "$attempt" -le "$max_attempts" ]; do
    local output
    if output=$(eval "$cmd" 2>&1); then
      echo "$output"
      SUCCESS=$((SUCCESS + 1))
      return 0
    fi

    echo "$output"
    if retryable_error "$output" && [ "$attempt" -lt "$max_attempts" ]; then
      echo "⚠️ Seed ${index} hit a transient D1 import error on attempt ${attempt}, retrying..."
      sleep $((attempt * 5))
      attempt=$((attempt + 1))
      continue
    fi

    FAILED=$((FAILED + 1))
    echo "⚠️ Seed ${index} failed after ${attempt} attempt(s), continuing..."
    return 1
  done
}

echo "🛠️ Initializing FTS5 Virtual Table..."
npx wrangler d1 execute killer-skills-db --remote --command="CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(id UNINDEXED, name, owner, repo, category, search_text, tokenize='unicode61 remove_diacritics 1');"

SUCCESS=0
FAILED=0
TOTAL_SEEDS=116

run_seed 0 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_0.sql"
run_seed 1 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_1.sql"
run_seed 2 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_2.sql"
run_seed 3 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_3.sql"
run_seed 4 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_4.sql"
run_seed 5 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_5.sql"
run_seed 6 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_6.sql"
run_seed 7 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_7.sql"
run_seed 8 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_8.sql"
run_seed 9 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_9.sql"
run_seed 10 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_10.sql"
run_seed 11 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_11.sql"
run_seed 12 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_12.sql"
run_seed 13 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_13.sql"
run_seed 14 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_14.sql"
run_seed 15 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_15.sql"
run_seed 16 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_16.sql"
run_seed 17 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_17.sql"
run_seed 18 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_18.sql"
run_seed 19 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_19.sql"
run_seed 20 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_20.sql"
run_seed 21 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_21.sql"
run_seed 22 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_22.sql"
run_seed 23 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_23.sql"
run_seed 24 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_24.sql"
run_seed 25 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_25.sql"
run_seed 26 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_26.sql"
run_seed 27 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_27.sql"
run_seed 28 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_28.sql"
run_seed 29 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_29.sql"
run_seed 30 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_30.sql"
run_seed 31 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_31.sql"
run_seed 32 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_32.sql"
run_seed 33 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_33.sql"
run_seed 34 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_34.sql"
run_seed 35 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_35.sql"
run_seed 36 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_36.sql"
run_seed 37 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_37.sql"
run_seed 38 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_38.sql"
run_seed 39 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_39.sql"
run_seed 40 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_40.sql"
run_seed 41 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_41.sql"
run_seed 42 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_42.sql"
run_seed 43 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_43.sql"
run_seed 44 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_44.sql"
run_seed 45 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_45.sql"
run_seed 46 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_46.sql"
run_seed 47 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_47.sql"
run_seed 48 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_48.sql"
run_seed 49 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_49.sql"
run_seed 50 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_50.sql"
run_seed 51 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_51.sql"
run_seed 52 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_52.sql"
run_seed 53 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_53.sql"
run_seed 54 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_54.sql"
run_seed 55 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_55.sql"
run_seed 56 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_56.sql"
run_seed 57 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_57.sql"
run_seed 58 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_58.sql"
run_seed 59 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_59.sql"
run_seed 60 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_60.sql"
run_seed 61 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_61.sql"
run_seed 62 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_62.sql"
run_seed 63 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_63.sql"
run_seed 64 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_64.sql"
run_seed 65 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_65.sql"
run_seed 66 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_66.sql"
run_seed 67 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_67.sql"
run_seed 68 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_68.sql"
run_seed 69 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_69.sql"
run_seed 70 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_70.sql"
run_seed 71 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_71.sql"
run_seed 72 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_72.sql"
run_seed 73 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_73.sql"
run_seed 74 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_74.sql"
run_seed 75 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_75.sql"
run_seed 76 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_76.sql"
run_seed 77 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_77.sql"
run_seed 78 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_78.sql"
run_seed 79 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_79.sql"
run_seed 80 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_80.sql"
run_seed 81 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_81.sql"
run_seed 82 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_82.sql"
run_seed 83 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_83.sql"
run_seed 84 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_84.sql"
run_seed 85 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_85.sql"
run_seed 86 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_86.sql"
run_seed 87 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_87.sql"
run_seed 88 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_88.sql"
run_seed 89 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_89.sql"
run_seed 90 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_90.sql"
run_seed 91 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_91.sql"
run_seed 92 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_92.sql"
run_seed 93 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_93.sql"
run_seed 94 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_94.sql"
run_seed 95 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_95.sql"
run_seed 96 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_96.sql"
run_seed 97 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_97.sql"
run_seed 98 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_98.sql"
run_seed 99 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_99.sql"
run_seed 100 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_100.sql"
run_seed 101 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_101.sql"
run_seed 102 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_102.sql"
run_seed 103 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_103.sql"
run_seed 104 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_104.sql"
run_seed 105 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_105.sql"
run_seed 106 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_106.sql"
run_seed 107 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_107.sql"
run_seed 108 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_108.sql"
run_seed 109 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_109.sql"
run_seed 110 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_110.sql"
run_seed 111 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_111.sql"
run_seed 112 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_112.sql"
run_seed 113 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_113.sql"
run_seed 114 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_114.sql"
run_seed 115 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_115.sql"
run_seed 116 "npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_116.sql"

echo ""
echo "📊 D1 Seed Results: $SUCCESS succeeded, $FAILED failed (total: 117)"

if [ "$FAILED" -gt 0 ]; then
  echo "⚠️ Some seeds failed, but $SUCCESS/117 were applied successfully"
  exit 1
fi

echo "✅ All 117 seeds executed successfully!"
