# Phase 70 Backlink Outreach Checklist

## Goal
Acquire 3+ quality organic backlinks to break the chicken-and-egg problem:
scorecard proof-readiness gate requires organic clicks, which require external visibility.

## Assets Ready for Outreach

| Asset | Location | Purpose |
|-------|----------|---------|
| Badge API | `https://killer-skills.com/api/badge?type=skills` | GitHub README embedding |
| IDE Comparison Matrix | `data/ide-comparison-matrix.json` | External article data source |
| dev.to Article Draft | `data/drafts/dev-to-ide-comparison.md` | Ready to publish |
| Docs Badge Guide | `/en/docs/integrations` | Reference for badge usage |

---

## Backlink 1: GitHub README Badge

**Target:** Any open-source repo that uses Killer-Skills CLI

**Action:**
```markdown
[![Killer-Skills](https://killer-skills.com/api/badge?type=skills)](https://killer-skills.com)
```

**Steps:**
1. Identify 2-3 repos that list Killer-Skills in their README or use the CLI
2. Submit a PR adding the badge to their README
3. Badge image request creates a backlink via HTTP Referer

**Verification:** Check GSC for `api/badge` referrer appearances

---

## Backlink 2: dev.to Article

**Target:** https://dev.to (Domain Authority ~90)

**Action:** Publish the IDE comparison article from `data/drafts/dev-to-ide-comparison.md`

**Steps:**
1. Copy draft content to dev.to editor
2. Add canonical URL: `https://killer-skills.com/en/blog/ide-comparison`
3. Tag with: `ai`, `coding`, `claudcode`, `cursor`, `windsurf`, `mcp`
4. Publish and share on social

**Verification:** Confirm article live at `dev.to/[username]/claude-code-vs-cursor-vs-windsurf-*`

---

## Backlink 3: Social / Community Share

**Target:** X/Twitter, Hacker News, or Reddit r/ChatGPT or r/coding

**Action:** Share homepage or IDE comparison article with OG card preview

**Steps:**
1. Share `https://killer-skills.com` on X/Twitter — verify OG card renders
2. Post to relevant subreddit with value-focused description
3. Optionally submit to Hacker News

**Verification:** Check GSC for social referrer traffic within 7 days

---

## Post-Outreach: Re-run Scorecard

After any organic click appears on home-root:
```bash
npx tsx scripts/seo-authority-uplift-scorecard.ts \
  --authority-surfaces-json data/authority-surfaces.json \
  --delta-json reports/seo/latest-recovery-delta-board.json \
  --traffic-json reports/gsc/latest-ctr-report.json
```

Check if:
- `home-root` visibility gate passes (>=1 click)
- `proof-readiness` gate upgrades from `warning` to `ready`
- Any surface promotes from `hold` to `active`
