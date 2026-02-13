---
description: Add a new blog post and automatically translate it to all languages
---

1. Create a new English blog post in `src/content/blog/en/[slug].md` with the following frontmatter template:
   ```markdown
   ---
   title: "Your Post Title"
   description: "A short description for SEO (150-160 chars)"
   pubDate: 2024-XX-XX
   author: "Killer-Skills Team"
   tags: ["Tag1", "Tag2"]
   lang: "en"
   featured: false
   category: "updates"
   heroImage: ""
   ---
   
   # Your Content Here
   ```

2. Run the translation script to generate all 9 other languages:
   ```bash
   npx tsx scripts/translate-blog.ts
   ```

3. Sync metadata (heroImage, internal links) across all locales:
   ```bash
   npx tsx scripts/sync-blog-everything.ts
   ```

4. Verify the generated files in `src/content/blog/*/` and check for any translation issues.

5. Preview the changes locally:
   ```bash
   npm run dev
   ```

6. Commit and push the changes:
   ```bash
   git add src/content/blog/
   git commit -m "feat(blog): add new post [slug]"
   git push
   ```

7. Notify search engines (IndexNow):
   ```bash
   node scripts/submit-indexnow.mjs
   ```
