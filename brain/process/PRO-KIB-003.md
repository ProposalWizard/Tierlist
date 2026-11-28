---
id: PRO-KIB-003
type: process
client: kib
tags: [team, brain]
status: live
date: 2026-11-24
source: "lib/publish/types.ts:9-19"
summary: Publish has spaces - football (Mikey's Brain), content (Mikey's Brain: Content, artifact Enn1Dd9KwhEkJjvZSJNsxW), kib (team, later); each its own accounts, videos, posts; post.mjs --space; "post my content videos" / "update my content stats" use space content.
---
Mikey, 24 Nov 2026: separate pages for football content, other content and Knowitball. One site tool underneath with
a space on every account and post (supabase/migrations/publishing_spaces.sql). football and content: Mikey only
(PUBLISH_OWNER_EMAIL); kib: every admin. Videos: own bucket videos/football/ (and older videos/publish/),
videos/content/; kib uses the team bucket. The Content page reads its video bank from its own database (collection
videos: {name, len, made, cover?, preview?, why, title:{yt}, cap:{ig,fb,yt,tt}, tags:{...}}), written by Claude when
Mikey says "add it to my content brain"; drafts/live/stats work as on Mikey's Brain (PRO-KIB-002) but post with
--space content. TikTok is not built.
