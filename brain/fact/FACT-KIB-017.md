---
id: FACT-KIB-017
type: fact
client: kib
tags: [team, style, brain, client-kib]
status: live
date: 2026-11-24
source: "marketing/brain/index.html:1-5"
summary: The Brain page posts by itself: Send writes the post into publish_posts through Mikey's Supabase connector and the site's 5-minute timer posts Instagram and YouTube; Facebook is by hand on his profile. A video posts only if its file is in PKEY.
---
- Send (step 7) inserts a row into publish_posts (created_by "Brain page") and runs the publish-tick cron command once; step 8 reads the row every 20 s. Take it back cancels a row that is still scheduled.
- Refresh (How posts are doing) runs the tick command with ?fresh=1 (needs the tick route change on branch ccr-e4ceba58-g6sz6t merged to main), then copies the numbers into the page's stats collection.
- Facebook: Meta only lets apps post to Pages. Mikey's audience is on his personal profile "Knowit Balljr", so the page gives him the video and caption to post by hand. The Page "Knowitballjr" got 0 views; do not post there.
- Every new library video must be uploaded to the Publish storage (scripts/publish/upload-library.mjs, needs Secret B, FACT-KIB-016) and its key added to PKEY in marketing/brain/index.html, or Send shows "not in your posting storage yet".
- Not in storage yet (24 Nov): the first-style explainers ex01 to ex14 (only in the artifact's files).
