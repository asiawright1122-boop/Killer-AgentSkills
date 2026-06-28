# Content Removal & Takedown Policy

## Overview

Killer-Skills indexes open-source AI agent skills from public GitHub repositories. We respect the rights of content creators and repository owners. If your content appears on Killer-Skills and you wish to have it removed, this document describes the process.

## How to Request Removal

You may request removal of your content by any of the following methods:

1. **GitHub Issue**: Open an issue on [killer-skills-com/killer-skills](https://github.com/killer-skills-com/killer-skills) with the title "Content Removal Request: [owner/repo]" and include the specific URL(s) to be removed.
2. **Email**: Send a removal request to the maintainer contact listed in the repository's CODEOWNERS or README.

Please include:
- The URL(s) on killer-skills.com that should be removed
- Your GitHub username or proof of ownership of the source repository
- The reason for removal (e.g., private repository, license incompatibility, outdated content)

## What Happens After a Removal Request

Upon receiving a valid removal request, we will:

1. **Add a 410 Gone rule** for the affected URL across all supported locales, ensuring the page returns HTTP 410 (Gone) with `noindex, nofollow` headers to all visitors and crawlers.
2. **Purge skill data** from governance, lookup, and index data files.
3. **Add to the sitemap blocklist** (if not already present) to prevent the skill from re-entering the sitemap or route map.
4. **Purge CDN cache** for the affected URL(s).
5. **Submit a GSC removal request** (if the URL is still indexed) to accelerate de-indexing.
6. **Confirm completion** by responding to the issue or email within **7 business days**.

## Opt-Out Signal

To prevent your repository from being indexed by Killer-Skills in the future, add the GitHub topic `killer-skills-ignore` to your repository. Our ingestion pipeline respects this topic tag and will skip any repository carrying it.

## Scope

This policy covers:
- Skill detail pages (e.g., `/en/skills/{owner}/{repo}/{skill}`)
- Any cached content, structured data, or metadata derived from the source repository
- All locale variants of the above (10 supported languages)

## Re-Indexing

If a removal was requested due to a repository being private, and the repository is later made public under a compatible license, you may request re-indexing by opening a GitHub issue. We will evaluate the request against our current quality criteria before re-including the skill.

## Contact

For questions about this policy, open a GitHub issue or refer to the project README.

---

*Last updated: 2026-06-28*
