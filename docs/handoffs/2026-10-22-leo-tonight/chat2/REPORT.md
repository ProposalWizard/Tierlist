# Chat 2 · The social feed — report (22 Oct 2026)

Branch `leo-feed`. Plan parts 2 (feed speed), 10 (Goal of the Month, option B) and 12 (two old goal-video bugs). Speed only: no new look.

## The headline

On a phone slowed 6× (a cheap phone), 390×844, a 150-post feed:

- **Opening the feed:** 4.7 s → **0.4 s** to the first post (production build). Opening it again: **0.25–0.3 s**.
- **Freezes while scrolling:** longest 5.3 s → **0.17 s**. Freezes over 0.1 s: 124 in 40 steps → about 16–21 in 82 steps.
- **Videos:** on a fresh open, none was ready within 90 s. Now the still shows in **0.7–1.2 s** and the video is ready in **11–14 s**. Seen before on this phone: ready in **0.5 s** (same visit) or **1.3–1.4 s** (after closing the game).

## Timing table

Measured with `scripts/feed-bench/` (see "How to re-run"). The timer taps Phone → Social and records when the first post is painted, the long tasks while it opens, the long tasks while it scrolls the whole feed (120 px steps), and when the first goal video is ready.

| What | Before (dev) | After (dev) | After (production build) |
|---|---|---|---|
| Tap → first post painted | 4,739 ms | 433–721 ms | **371–413 ms** |
| Posts built at once | 71 | 4 | 4 |
| Longest freeze while opening | 3,368 ms | 166–201 ms | **148–190 ms** |
| Scrolling: steps / time taken | 40 steps / 225 s | 82 steps / 10 s | 82 steps / 11–12 s |
| Scrolling: freezes over 100 ms | 124 | 6 | 16–21 |
| Scrolling: longest freeze | 5,284 ms | 168 ms | **167–175 ms** |
| First video ready, fresh | never (90 s wait) | 12–20 s | **11.6–13.7 s** |
| Still picture shown | 25 s | 1.2–1.8 s | **0.7–1.2 s** |
| Open again, same visit: first post / video | 1,466 / 1,470 ms | 361 / 696 ms | **292 / 469–520 ms** |
| New visit (reload), first post / video | 4,517 ms / never | 459 / 1,488 ms | **246–383 / 1,263–1,440 ms** |

Notes on the numbers:
- "Before (dev)" is the code before tonight on the dev server. Dev mode is slower than the live site. The production "before" column is in `prod-before-*.txt` if that build finished (see the end of this file).
- The production numbers have 2 runs: the team's view (admin tab on) and a player's view (`--player`, admin tab off). Files: `prod-after-admin.txt`, `prod-after-player.txt`.
- The 6× slow-down applies to the video worker too, so 11–14 s is the cheap-phone time to make a 21 s video from nothing. In the game the worker starts during the match (fix 5), so it is a little sooner there. The bench opens the feed with nothing warmed up.
- **Targets:** "feed open < 300 ms": met when the feed is opened again (250–300 ms), **not quite met** on the first open (370–410 ms). "No freeze over 100 ms while scrolling": **not met**; the worst is now 0.17 s (was 5.3 s). What is left is the phone building each post (text, picture, buttons) as it comes near; posts are now built one per frame, nearest first.

## What was built

### A. Feed speed
1. **Only posts near the screen are drawn** (`components/star/media/FeedWindow.tsx`, used by `MediaFeed.tsx`). A post more than about 1.5 screens away is an empty box of its height, so the scroll bar and position stay right. Posts coming near are drawn one per frame, nearest first.
2. **Goal videos are made in a background worker** (`lib/star/goalClip/clip.worker.ts`, `makeVideo.ts`, `workerShim.ts`). Same drawing and same encoder as before, so the same video. The still is drawn in the worker too. A browser that cannot (no OffscreenCanvas or no encoder in a worker) makes it on the page as before, but only once the post is on screen, never while scrolling, one frame at a time in idle time (`encodeEdit`'s new `gate`).
3. **Made videos are kept on the phone** (IndexedDB `star-goal-videos`, newest 40), keyed by the clip ids + style + cut + moves + who posted it. Reopening, even after closing the game, plays at once.
4. **One database read for the feed** instead of an open + read + close per goal per post (`store.ts getClips` batches what is asked together).
5. **Figures load during the match:** the video worker starts 8 s into a match and loads the player drawings then (`page.tsx`, small additive effect).
6. **Two other things found by measuring**, both fixed:
   - **The admin tab** (`components/AdminNavPanel.tsx`, team only, not players) hit-tested about 700 points every 0.5 s. On a slow phone that alone froze the page for up to 2 s at a time. It now checks about 45 points (is its spot still clear?), runs only in idle time and never while scrolling, and does the full search at most every 8 s. **Outside my lane (small, clear fix); Harry/Mikey: please know about it.**
   - **The crowd noise under each video's sound** was made from scratch for every video (about 1 s on a slow phone). It is now made once, in slices (`lib/star/goalClip/audio.ts`).

### B. Goal of the Month (built by a helper; checked here)
- Each month a poll post from the league account: your 3 hardest goals of the month against 2 goals by other players in your league (made like the other-match videos). Hardest = kind of goal + distance + chip/curler (the game records no top-corner or chance value, so those don't count).
- Fans vote (fixed per month, weighted by goal quality and your fame); you can vote once (worth 6% of the fans' total). It closes at your next match; the winner gets a post; if it is yours, fans +3 (the 0–100 fans bar).
- Fixed tonight: a poll needs at least 2 goals, and when no other player's goal is in it (no squad data), the text no longer says "up against the best of the rest".
- Voting is wired through MediaFeed → PostCard (`onVote`) and page.tsx (`handleVote`).

### C. The two bugs (built by a helper; checked here)
- **(a) Video stopped 1–2 s after the goal.** The recording was cut when the result screen handed back to the commentary (1.8 s after the goal). It now keeps recording to the full 2.2 s while the same chance is loaded (one condition in `CanvasMatch.tsx`). **Limit:** during that commentary the match engine moves nothing, so the last 0.4 s is the real picture held still, not players still moving. Chat 1's longer celebrations (+2.5 s) will need the engine to keep moving the players there; not done here. Test: `tests/star/goalClipTail.mts` (last real frame 1.80 s → 2.20 s).
- **(b) "The League" labelled lower-league goals as Premier League.** Reproduced with a full League One season (and National League North): the league account was already right (fixed 11 Oct). Two other wrong labels did show, and are fixed: cup accounts posting other competitions' news (an "@FACup" post about a League One table move), and "into/out of Europe" stories outside the Premier League. Two fallbacks that said "Premier League" now name your division. Old posts already saying @PremierLeague are left as they are. Test: `tests/star/leagueAccountLabel.mts`.

## Seen in a browser
- Phone-size stills in this folder: `feed-top.jpg`, `feed-video-still.jpg`, `feed-video-playing.jpg`, `feed-gotm.jpg`, `feed-end.jpg` (playtest helper), `gotm-real-feed-voted.jpg` (the poll in the real feed after a vote), `gotm-poll-*.jpg`, `gotm-winner.jpg` (the helper's component stills).
- Playtest: scrolled top to bottom and back: no empty boxes on screen, no jumps, the end line shows. A video's still shows at once, the video plays (time moving, 640 wide), and it is ready at once after leaving and coming back, and after a reload. The poll vote shows "You voted" and is saved in the career. No page errors.
- **Not seen:** the post-match "moment" feed after a real match (a reload does not return to that screen, and no match was played in the browser). Not seen on a real phone or in Safari; the worker's fallback path (no OffscreenCanvas) was not run in a browser.
- The score label in the bench videos ("EVE 0-0 IPS") comes from the two stored recordings the bench reuses, not from the game.

## Checks
- `npx tsc --noEmit`: clean. One-engine guard: no new copies. Admin-look guard: OK.
- Tests: finishing, keeper (all), aiming, outcomes, goalClip, goalClipTail, goalClipAudio, media, goalVideoFeed, league*, potm*, goalOfMonth, leagueAccountLabel: **24 passed, 0 failed**.
- Production `next build` of this branch: built and served (used for the production column).
- The match file was touched (bug a, one condition): the engine-warn hook applies; the match suites pass.

## Known issues
- First open is 0.37–0.41 s, not under 0.3 s; scroll still has some 0.15–0.18 s hiccups (see Targets).
- A fresh video on a very slow phone takes 11–14 s to be ready (the still shows at once; ▶ plays when it is).
- Kept videos use phone storage (newest 40, about 0.3–1 MB each).
- Bug (a): the extra 0.4 s is a held picture (see above).
- The 🗳️ emoji shows as a box in the test browser's font; real phones have it.

## How to re-run
```
npx tsx scripts/feed-bench/seed.mts 20 /tmp/feed-seed.json      # a 20-match career, 150 posts
npm run dev                                                       # or a production build with NEXT_PUBLIC_STAR_OFFLINE_DEV=1
node scripts/feed-bench/measure.mjs --seed /tmp/feed-seed.json [--player] [--url http://localhost:3000]
node scripts/feed-bench/look.mjs --seed /tmp/feed-seed.json --shot out.jpg [--scroll -1] [--poll]
```

## Files touched
New: `components/star/media/FeedWindow.tsx`, `lib/star/goalClip/{clip.worker,makeVideo,workerShim}.ts`, `scripts/feed-bench/{seed.mts,measure.mjs,look.mjs}`, `components/star/media/GoalOfMonthPoll.tsx`, `lib/star/media/goalOfMonth.ts`, `lib/star/media/detect/goalOfMonth.ts`, `tests/star/{goalOfMonth,goalClipTail,leagueAccountLabel}.mts`.
Changed: `components/star/MediaFeed.tsx`, `components/star/PhoneHome.tsx`, `components/star/media/{GoalVideo,PostCard,Graphics}.tsx`, `lib/star/goalClip/{encode,store,audio}.ts`, `lib/star/media/{feed,types,select,graphics}.ts`, `lib/star/media/detect/table.ts`, `components/AdminNavPanel.tsx`, `components/star/CanvasMatch.tsx` (one condition), `app/star-dev/page.tsx` (additive: vote handler, worker warm-up), tests `goalVideoFeed`, `leagueMedia`, `media` (save-size limit 90 → 95 KB for the poll posts).
