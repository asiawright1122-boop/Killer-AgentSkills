#!/bin/bash

set -e

npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_0.sql
npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_1.sql
npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_2.sql
npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_3.sql

echo "✅ All seeds executed successfully!"
