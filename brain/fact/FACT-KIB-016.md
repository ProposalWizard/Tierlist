---
id: FACT-KIB-016
type: fact
client: kib
tags: [admin, team, process, client-kib]
status: live
date: 2026-11-24
source: "lib/publish/auth.ts:1-12"
summary: "Secret B" is Mikey's name for the Publish key (PUBLISH_AGENT_TOKEN) that lets a chat post through Admin → Marketing → Publish; ask for "Secret B" by that name.
---
When a chat needs the Publish key (FACT-KIB-013), ask Mikey for "Secret B". It is PUBLISH_AGENT_TOKEN in Vercel (Sensitive, so it cannot be read back there).
The site accepts it as x-publish-agent or as "Authorization: Bearer", so it can be saved as a Bearer network secret for knowitball.co.uk.
Never write the value in the repo, a note, a commit or an artifact.
