#!/usr/bin/env npx tsx
/**
 * scripts/enrich-collections-apply.ts
 * Apply Enriched Drafts to Source Collections
 */

import * as fs from 'fs';
import * as path from 'path';

function main() {
  const workspaceRoot = process.cwd();
  const draftsPath = path.resolve(workspaceRoot, 'data/enrichment-drafts.json');
  const collectionsDir = path.resolve(workspaceRoot, 'src/content/collections');

  if (!fs.existsSync(draftsPath)) {
    console.log('No drafts found at data/enrichment-drafts.json. Nothing to apply.');
    return;
  }

  let drafts: Record<string, any> = {};
  try {
    drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
  } catch (e) {
    console.error(`Error: Failed to parse drafts JSON: ${e}`);
    process.exit(1);
  }

  const filenames = Object.keys(drafts);
  if (filenames.length === 0) {
    console.log('Drafts file is empty. Nothing to apply.');
    return;
  }

  console.log(`Applying ${filenames.length} draft(s) back to collection source files...`);

  let appliedCount = 0;

  for (const filename of filenames) {
    const filePath = path.join(collectionsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[WARN] Target collection file not found: ${filename}, skipping.`);
      continue;
    }

    try {
      const colData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const draft = drafts[filename];

      // Merge description
      if (draft.description) {
        colData.description = {
          ...colData.description,
          ...draft.description,
        };
      }

      // Merge longDescription
      if (draft.longDescription) {
        colData.longDescription = {
          ...colData.longDescription,
          ...draft.longDescription,
        };
      }

      // Merge editorial (selectionReason and reviewSummary)
      if (draft.editorial) {
        if (!colData.editorial) {
          colData.editorial = {};
        }
        if (draft.editorial.selectionReason) {
          colData.editorial.selectionReason = {
            ...colData.editorial.selectionReason,
            ...draft.editorial.selectionReason,
          };
        }
        if (draft.editorial.reviewSummary) {
          colData.editorial.reviewSummary = {
            ...colData.editorial.reviewSummary,
            ...draft.editorial.reviewSummary,
          };
        }
      }

      // Write back with 2 spaces formatting
      fs.writeFileSync(filePath, JSON.stringify(colData, null, 2) + '\n', 'utf8');
      console.log(`✓ Applied enrichment changes to ${filename}`);
      appliedCount++;

      // Delete applied draft from the object
      delete drafts[filename];
    } catch (e) {
      console.error(`❌ Failed to apply draft ${filename}: ${e}`);
    }
  }

  // Update drafts.json (write back remaining drafts, if any)
  fs.writeFileSync(draftsPath, JSON.stringify(drafts, null, 2) + '\n', 'utf8');
  console.log(`\nSuccessfully applied ${appliedCount} draft(s). drafts.json updated.`);
}

main();
