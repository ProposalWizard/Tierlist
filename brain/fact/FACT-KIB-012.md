---
id: FACT-KIB-012
type: fact
client: kib
tags: [team, client-kib]
status: live
date: 2026-11-08
source: "tools/video-factory/make.py:65-73"
summary: Football-story videos are voiced by Hugo (ElevenLabs Voice Library, young modern London accent) on Mikey's ElevenLabs Starter plan; pauses trimmed to about 0.1 s (breath counts as silence) and the read sped up 13% with pitch kept, so it matches voice E's pace.
---
Mikey, 8 Nov 2026: picked Hugo, bought Starter ("free users cannot use library voices via the API"). Story JSON: "voice": {"provider": "elevenlabs", "voiceId": "WAppqUXeqDqXjNTaQxG9"}. The API key is a network secret on the cloud environment (header xi-api-key), never in the repo. About 2,100 credits for a 3-minute CH video; Starter has about 30,000 a month.
Defaults in make.py (maxGap 0.09, tempo 1.13), so a story only needs the voice line. Another chat needs this branch's make.py (merge claude/football-tiktok-format-vfefd8, or main once merged).
