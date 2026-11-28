---
id: FACT-KIB-018
type: fact
client: kib
tags: [data, admin, team, process, client-kib]
status: live
date: 2026-11-28
source: "Mikey, chat 28 Nov 2026: put the Mikey's Brain system into the Knowitball marketing area"
summary: Admin → Marketing now has Library, Publish and Results; the library is the video files in Cloudflare (Knowitball space = the team's R2 bucket, football and content = Mikey's own bucket) plus saved captions in the table marketing_videos; a Claude chat adds words with scripts/publish/library.mjs and files with upload-library.mjs (SPACE=kib).
---
- Library (/admin/marketing/library): reads the space's bucket (lib/publish/spaceVideos.ts), joins the saved words (table marketing_videos, supabase/migrations/marketing_library.sql, RUN 28 Nov 2026), shows a "Needs details" tag for a video with no name and captions. Post this opens Publish with the words filled in.
- Publish (/admin/marketing/publish): numbered steps 1 to 5, Facebook by hand (Open the video, Copy the caption, ticked by default on Football), Start again, and a 10-second look while a post is on its way with a 20-second timeout (the Brain page once stuck on "Posting" because a check had no timeout).
- Results (/admin/marketing/results): every post and app side by side, totals, Refresh numbers (tick?fresh=1), What worked (table marketing_lessons).
- Spaces (football, content, kib) were already on main (publishing_spaces.sql): they are the account groups. football and content are Mikey's only (PUBLISH_OWNER_EMAIL); kib is every admin. A fourth group needs the space lists in lib/publish/types.ts and the two CHECK constraints changed.
- A chat: `PUBLISH_AGENT_TOKEN=… node scripts/publish/library.mjs list|save <space> …`; upload a file with `SPACE=kib node scripts/publish/upload-library.mjs …`. TikTok captions are kept for copying; TikTok is not posted from here.
