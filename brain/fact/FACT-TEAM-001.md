---
id: FACT-TEAM-001
type: fact
client: team
tags: [deploy, team]
status: live
date: 2026-10-27
source: "docs/brain-sources/leo-build-memory-2026-10-27.md:3-9"
summary: next build needs about 6.5 GB; package.json gives it 6 GB of heap (node --max-old-space-size=6144). A Vercel deploy that fails with no other clue may be out of memory again: build locally with no NODE_OPTIONS to check.
---
Found 27 Oct 2026 when PR #810 failed to deploy: the build ran out of memory at Node's default heap, before and after that merge. Vercel's build machine has 8 GB, so there is little room left; keep big pages from growing without need.
