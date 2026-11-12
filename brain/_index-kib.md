# Brain index kib
ID | summary | tags
FACT-KIB-001 | Knowitball as a client: three mates building the best football game ever; client code KIB. | client-kib
FACT-KIB-002 | Audience: football fans 16 to 30 on TikTok, Reels and Shorts (Harry to confirm). | client-kib
FACT-KIB-003 | Video format: 1080×1920 (9:16), 30 fps, H.264, AAC stereo; v01 ran 44.7 s at -13.4 LUFS. | client-kib
FACT-KIB-004 | Safe area: captions and cards stay inside x 64–950 and y 150–1536. | client-kib
FACT-KIB-005 | End card: KNOWITBALL, the versions so far, a green knowitball.co.uk pill and "FOLLOW FOR v0.4". | client-kib
FACT-KIB-006 | [SUPERSEDED] Voice-over: Kokoro v1.0 offline, voice bm_george, speed 1.2, en-gb; the same setup as the game's commentary. | media,client-kib
FACT-KIB-007 | Learning from v01: v0.2 and v0.3 had no screenshots in the repo, so their beats had to be drawn diagrams. | client-kib
FACT-KIB-008 | Learning from v01: render frames in chunks of 250, one page per chunk; one long session crashed the page. | client-kib
FACT-KIB-009 | The one list of video ideas and the reference TikToks they came from (link, @account, what it is, style, what we made) is docs/marketing/video-ideas.md; add new references and ideas there. | client-kib
FACT-KIB-010 | Base voice for Knowitball videos is voice E: Chatterbox TTS's own built-in voice, finished with humanise.sh (mic-in-a-room). Mikey, 3 Nov 2026; replaces Kokoro bm_george and the George clone. | team,process,client-kib
FACT-KIB-011 | "Analysed like chess" videos (CH) are football first: a real pitch, every player a drawn icon with his name, the chess grades, eval bar and typed card laid on top. Never a chessboard with pieces (Mikey, 7 Nov 2026). | team,rule,client-kib
FACT-KIB-012 | Football-story videos are voiced by Hugo (ElevenLabs Voice Library, young modern London accent) on Mikey's ElevenLabs Starter plan; pauses trimmed to about 0.1 s (breath counts as silence) and the read sped up 13% with pitch kept, so it matches voice E's pace. | team,client-kib
FACT-KIB-013 | Our own posting tool (Admin → Marketing → Publish) posts a video from R2 storage to Instagram, Facebook and YouTube now or at a set time, and reads views/likes/comments; a chat posts with scripts/publish/post.mjs. YouTube posts stay private until Google approves the API audit; TikTok is not in it yet. | admin,process,client-kib
PRO-KIB-001 | Stat Twins episode for any player-season: write episodes/<player>.json, run make_episode.py, tts.py (Hugo), timeline.py, render.cjs; the format is locked to the Salah v02 cut 5 (Poster style). | career,style
REF-KIB-001 | Script v01, patch notes 0.1 to 0.3: the first Knowitball short, word for word with its sources. | process,client-kib
RUL-KIB-001 | Voice: short, cheeky, football-mad, numbers first ("9.8% to 47.6%"). | client-kib
RUL-KIB-002 | Real game footage only, or marked "ILLUSTRATION" on screen. | client-kib
RUL-KIB-003 | No real club badges or player photos in ads unless we have the right to use them. | client-kib
RUL-KIB-004 | Never claim a feature that is not live; every number comes from a patch note. | process,rule,style,client-kib
RUL-KIB-005 | Video endings: keep the end card on screen as it is, but the voice-over says only "Follow for more." (Mikey, 7 Nov 2026). | team,client-kib
RUL-KIB-006 | Football-story videos (like CH, analysed like chess) may use real match footage, real manager faces and real club badges; Mikey and Harry OK'd posting it (7 Nov 2026). Game ads still follow RUL-KIB-002/003. | team,client-kib
RUL-KIB-007 | Exception to RUL-KIB-003 for Mikey's Stat Twins videos only: real player faces, club badges and nation flags are allowed. | team,client-kib
RUL-KIB-008 | Stat Twins comparison cards keep the "player v his twin" framing and show the MOST IMPORTANT stats for the twin pick; never swap them for a generic "what matters for a striker" card. | rule,client-kib
