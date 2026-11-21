---
id: FACT-KIB-015
type: fact
client: kib
tags: [client-kib]
status: live
date: 2026-11-20
source: "lib/publish/meta.ts:52-70"
summary: Publish posts short-form only - Instagram Reels, Facebook Reels (3-90 s), YouTube Shorts (vertical, 3 min max, #Shorts added to the description); a Short's title is 100 characters at most, hashtags included.
---
Mikey, 20 Nov 2026: "I only post on Facebook Reels, YouTube Shorts and Instagram Reels." Facebook uses the Reels API
(start, upload from the signed link, finish PUBLISHED); Instagram uses media_type REELS; YouTube makes any vertical
upload of 3 minutes or less a Short, and the tool appends #Shorts to the description. Mikey: the YouTube title (the
line people see on a Short) is capped at 100 characters including any hashtags in it; aim for under 70. The
Publish page's title box stops at 100. Videos live in Mikey's own Cloudflare bucket (PUBLISH_R2_* in Vercel);
the page is locked to PUBLISH_OWNER_EMAIL.
