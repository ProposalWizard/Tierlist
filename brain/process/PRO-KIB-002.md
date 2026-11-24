---
id: PRO-KIB-002
type: process
client: kib
tags: [team, style, brain]
status: live
date: 2026-11-20
source: "lib/publish/live.ts:30-45"
summary: "Update my stats" (Mikey) = read publish_posts results from Supabase and write one doc per post into Mikey's Brain artifact database (collection stats); "post my videos" = post what he sent from Mikey's Brain with scripts/publish/post.mjs.
---
Mikey's Brain (artifact H4TN92qzcgodheJNJxs7TJ) shows "Every post, every app" from its own database, collection
`stats`, doc id = publish_posts.id: {title, video, posted, updated, p: {ig|fb|yt: {views, likes, comments, shares,
saves, reach, watch (s), link}}}. Map: Instagram saved -> saves; Facebook reactions -> likes,
post_video_avg_time_watched (ms) / 1000 -> watch; YouTube views/likes/comments. The site refreshes each post's numbers
every 3 hours for 30 days (publish timer).
"Post my videos": read the Brain's drafts collection (sent: set), post each with
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/publish/post.mjs <file> ... (the
saved network secret for knowitball.co.uk sends the key as Authorization: Bearer), then write live/<video id> with
each destination's link so step 8 turns green.
