---
id: FACT-DAT-015
type: fact
client: dat
tags: [career, data]
status: live
date: 2026-11-28
source: "lib/star/saveClash.ts:230-252"
summary: The server keeps a cloud career save unless an upload was built on it (HTTP 409 otherwise); STAR_SAVE_CHECK=observe or off is the way back; the Load Game list refreshes from the cloud.
---
27 Nov 2026: Mikey's computer opened an old Leicester save and uploaded it over the phone's newer Season 3 one, with no question. Cause at load not proven (the decision sits in the computer's browser). Fix is on the server: every upload carries its lineage (saveClash.ts nextStamp); `mayReplaceCloud` accepts it only if nothing is stored, it has no stamp (old game copy), it is the same upload again, it lists the stored version, or its lineage is cut at LINEAGE_CAP below the stored version. Else 409 and nothing is written. The device then drops that upload from "pending", holds uploads for that save, and shows StaleSaveBanner (Reload and choose; the normal load asks which progress to keep). Env STAR_SAVE_CHECK: enforce (default) | observe (log only) | off. Server log line: "[star/career] stale upload". The Load Game list: `GET /api/star/career?stamps=1` returns one small line per slot; `syncSlotsFromCloud` (storage.ts) runs the normal load decision for each slot whose cloud version this device has not seen, so both devices show the same seasons; Play on the last-played save checks too. Each load writes why it chose a copy to localStorage `star-load-log-v1` (console: `__starLoadLog()`). Test: tests/star/saveStale.mts. Still asks (clash prompt) when both copies moved on: not "always take the cloud".
