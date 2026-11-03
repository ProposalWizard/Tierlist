# What makes a good football goal video (31 Oct 2026)

Leo: "BETTER! MORE VARIETY! … BETTER! EDITS! … BETTER VIDEOS! BETTER SOCIAL MEDIA!"

Sources: two web searches (CapCut/edit tutorials, broadcast replay pieces; thin and
vendor-heavy) plus general knowledge of how Sky/TNT/BBC, X clip accounts and TikTok
edit pages cut goals. Where a point is knowledge, not a source, it says "known".

## 1. TV broadcast (club and league accounts, TV channels)

- **Live first, then replays.** The director stays on the wide "main" camera for the
  goal, cuts tight to the scorer for the celebration, then a replay operator gives
  2–3 replay angles in a few seconds (CBS: about 3 s to pick an angle). Known order:
  the angle that explains the goal first (reverse or behind the goal), then the
  close super-slow-motion of the strike, then a "beauty" angle (spider-cam, behind
  the net).
- **Super slow-mo** cameras run at 3–10× speed (Phantom at ~300 fps shown at 30 fps
  = 10× slow). On TV a strike replay plays at roughly 25–40 % speed.
- **Graphics.** A score bug top left (team codes, score, clock) that flashes on the
  goal; a lower third with the scorer's name (and the assist) a moment after; a
  "REPLAY" wipe with the channel's logo at the start and end of each replay.
- **Reverse angle** = the camera on the opposite touchline (the picture is flipped
  left–right compared with the main camera).

## 2. X clip accounts (aggregators, scores apps, stats pages)

- The TV pictures re-posted, trimmed: start 2–4 s before the strike, end soon
  after the net ripples, one quick replay. Short = it loops; X autoplays muted.
- The channel's watermark in a corner, the TV score bug left in.
- Highlights threads: every goal of the match back to back with fast cuts, and a
  full-time card (score, scorers, minutes) at the end.

## 3. TikTok / Reels edits ("velocity edits")

- **Speed ramp** is the hallmark: speed up the build-up, slow to about 10–20 %
  just before the key moment, back to normal or faster after (fluxnote guide).
- **Freeze frame on contact** with a **zoom punch** (a quick zoom into the ball),
  then release. Shake and a white **flash** on the goal, on the beat.
- **Big bold captions** in the top third (out of the bottom UI and the right-hand
  buttons): a hook in the first second ("WAIT FOR IT", "watch the keeper"), a
  reaction at the goal ("COLD", "HE'S HIM"). Words pop in one by one.
- **Vertical 9:16**, the frame follows the ball (editors keyframe the crop).
- **Ending**: a "one more time" replay and the player's name card, so it loops.
- CapCut is the tool almost everyone uses; "Green Goal" and loading effects are
  popular in the football edit community.

## 4. Fan phone videos (supporters, team-mates, fan channels)

- Filmed from the stand: a heads-and-arms edge along the bottom, the phone
  drifting, pinch zoom (digital, steps in), the picture jolting when it goes in and
  the fan jumps. No graphics. Portrait. One take, no replay.

## What was built from this (lib/star/goalClip, switch part "betterVideos")

| Style | From research point | What it does |
|---|---|---|
| Broadcast | 1 | live TV + 2–3 replays (reverse angle, super slow-mo on the strike, behind the goal, spider-cam), score bug, lower third with the assist, channel watermark, replay wipes |
| Highlights | 2 | trimmed live + one fast replay per goal, flash cuts, full-time stats card |
| TikTok edit | 3 | 9:16, speed ramp, freeze + zoom punch on contact, flash + shake on the goal, word-by-word captions, "one more time" replay, name card |
| Fan phone | 4 | three spots in the stand, hand shake, pinch zoom, arms up on the goal |

Sources:
- [fluxnote football edits guide](https://fluxnote.io/guides/football-edits-guide)
- [Mastering TikTok velocity edits](https://oembed.org/blog/mastering-tiktok-velocity-edits-a)
- [Editing techniques for viral content](https://editingbox.pages.dev/blog/video-editing-techniques-viral-content)
- [CBS: Let's go to the instant replay](https://www.cbsnews.com/news/lets-go-to-the-instant-replay-a-quick-look-behind-the-scenes)
- [Phantom super slow-mo at Super Bowl XLII](https://www.tvtechnology.com/news/vision-research-phatom-captures-super-bowl-xlii-replays-in-ultra-slomo)
- [World Rugby TMO angle selection](https://passport.world.rugby/match-day-staff/television-match-official-tmo-operator/3-what-you-do-and-how-you-do-it/technical-and-operations/angle-selection/)
