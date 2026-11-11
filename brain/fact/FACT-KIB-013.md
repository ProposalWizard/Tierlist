---
id: FACT-KIB-013
type: fact
client: kib
tags: [admin, process, client-kib]
status: live
date: 2026-11-11
source: "lib/publish/engine.ts; app/admin/marketing/publish/page.tsx; scripts/publish/post.mjs"
summary: Our own posting tool (Admin → Marketing → Publish) posts a video from R2 storage to Instagram, Facebook and YouTube now or at a set time, and reads views/likes/comments; a chat posts with scripts/publish/post.mjs. YouTube posts stay private until Google approves the API audit; TikTok is not in it yet.
---
Mikey, 11 Nov 2026: build our own instead of paying Metricool. Videos are files in R2 (never git). A database timer (pg_cron, supabase/migrations/publishing.sql) calls /api/admin/publish/tick every 5 minutes; each tick moves each post one step (Instagram Reels need a few minutes of processing). Numbers refresh every 3 hours for 30 days.
Needs: the migration run, Vercel env vars (PUBLISH_TOKEN_KEY, PUBLISH_CRON_SECRET, PUBLISH_AGENT_TOKEN, META_APP_ID, META_APP_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET), the feature merged to main, then Connect on the page. A chat needs PUBLISH_AGENT_TOKEN saved as a network secret for knowitball.co.uk, header x-publish-agent.
