# Cold edits: what real football edits look like (31 Oct 2026)

Leo: "want more variety and video types again, not rlly seeing like cold
football edits ... do better in general."

**How this was found.** Web searches on 31 Oct 2026 (CapCut velocity and
beat-sync guides, "aura" and "aura farming" coverage, phonk and slowed-reverb
write-ups, black-and-white and colour-splash football edit listings). Fetching
the pages themselves was blocked in this session (fluxnote.io and capcut.com
are outside its allowed network), so the notes below come from search
summaries plus what is common knowledge about the format. Many of the pages
are thin template or tutorial sites. Treat the details as conventions, not as
measured facts. Nothing here was measured on real TikTok data.

## The conventions

| # | Convention | What it is | Built? |
|---|---|---|---|
| 1 | **Velocity edit** | Speed ramps per segment: a fast burst between beats, then a slow-down or hold on the impact frame. CapCut's "Curve" speed tool. | Yes: cold. Build-up about 1.6x, ramp to about 0.5x, contact frozen for 1 beat, flight slow. |
| 2 | **Cut on the beat** | Beats are marked (auto beat detection or by hand). Clips are split at each beat. The drop is the big moment. | Yes: every shot is a whole number of beats, and the goal lands on the drop. |
| 3 | **Phonk / hard beats** | Phonk and hard-hitting beats, because "the drops match the speed changes". Slowed and reverbed versions for moody edits. Brazilian phonk is faster (said to be about 140–160 bpm). | Yes: four original loops, not copies. Phonk-style 140 bpm, funk-style 150, ambient 80, lo-fi 96. |
| 4 | **Shake / flash per beat** | A shake effect of 1–2 s copied to every beat. Flashes and motion blur on hits. Guides warn not to stack every effect on every beat. | Yes: a small shake on every beat after the drop, a bigger one on each bar, a flash and RGB split on each bar's downbeat. Aura and stat card use a light version. |
| 5 | **Cold / gritty grade** | Low saturation, sometimes near-monochrome. High contrast. Blacks pushed to true black. | Yes: cold is 92% grey, contrast 1.3, a cool tint. |
| 6 | **Colour splash** | The frame is monochrome and only the team colours stay (shirt, socks). | Yes: the scorer's shirt colour, as worn in the recording, stays. His fans in the stand keep it too. |
| 7 | **Film grain, letterbox** | Heavy grain on black-and-white looks. Black "cinema" bars, even on 9:16. | Yes: seeded grain. Bars of 7–8.5% on cold, aura and angles. |
| 8 | **RGB split / glitch** | Colour channels pulled apart on hits. Optional; some guides prefer motion blur. | Yes: only on the bar hits, and short. |
| 9 | **Aura edits** | Out of "aura" / "aura farming" slang (viral mid-2025): slow-motion posing, glow, slow zooms, clean cuts. Clubs and players joined in. | Yes: aura. Slow throughout, bloom on bright parts, a warm grade, a super slow-mo push-in, "+1000 aura". |
| 10 | **Big minimal captions** | One or two words ("cold.", "different.", "him."), often lowercase serif italics, centred low. | Yes: the cold caption type is serif italic. Aura uses a glowing serif, rewind uses typewriter type. |
| 11 | **Freeze frame + call-out** | The picture stops on contact. The player is ringed or cut out and named. | Yes: the scorer is ringed with a spotlight and named (cold, stat card, rewind's pause). It is not a true cut-out: the renderer draws the scene and cannot separate one figure from it. |
| 12 | **Rewind** | The goal plays, then rewinds with a tape look (◀◀, scan lines), then plays again slow. "wait… run it back." | Yes: rewind. |
| 13 | **Stat-card edits** | The goal, then a card of numbers (distance, speed, xG-style). | Yes: statCard. A row arrives on each beat. Distance and shot speed are measured from the recording. |
| 14 | **Compilations** | "every goal", counters (3/7), each goal cut short, a title and an end card. | Yes: montage (up to 8 goals). |
| 15 | **Every angle** | The same moment from 3–4 cameras back to back, one cut per beat. | Yes: angles (CAM 1–4, plus the celebration when it was recorded). |
| 16 | **POV edits** | "pov: you…" captions over the edit. | Words only: the POV page posts cold and aura edits with "pov:" lines. |
| 17 | "Who's the best" comparisons, "before vs after" | Two players side by side, or then and now. | Not built: needs two players' goals in one post (next round). |
| 18 | 4–6 s loops | Very short loops that replay forever. | Partly: the edits run 7.6–14 s (one goal needs its build-up). The feed already loops them. |

## Sources (search results; thin sites flagged in the text above)

- [CapCut: football edits 4k cold](https://www.capcut.com/explore/football-edits-4k-cold/7520674361331189778)
- [CapCut: phonk edit football](https://www.capcut.com/explore/phonk-edit-football)
- [Your Guide on How to Do Velocity on CapCut](https://www.capcut.com/resource/how-to-do-velocity-on-capcut)
- [CapCut: beat-sync editing for sports highlights](https://www.capcut.com/create/sports-highlight-editing-beat-synced-ai-reels)
- [VideoProc: how to make a velocity edit](https://www.videoproc.com/video-editor/how-to-make-a-velocity-edit.htm)
- [FluxNote: football edits guide](https://fluxnote.io/guides/football-edits-guide)
- [FluxNote: best football edit apps 2026](https://fluxnote.io/guides/best-football-edit-apps-2026)
- [How NFL edits are dominating TikTok](https://resources.oreateai.com/resources/how-nfl-edits-are-dominating-tiktok-and-how-to-master-the-trend)
- [Know Your Meme: Aura (slang)](https://knowyourmeme.com/memes/aura-slang)
- [meme.com: Aura farming](https://meme.com/memes/aura-farming)
- [Front Office Sports: aura farming in the sports world](https://frontofficesports.com/article/aura-farming-viral-boat-dance-sports-world/)
- [imagine.art: AI football fan edit styles (B&W, grain)](https://www.imagine.art/blogs/ai-football-fan-edit)
- [YouMind: monochrome with team colours kept](https://youmind.com/prompts/cinematic-stylized-sports-poster-design-25878)
- [LesFM: what is phonk](https://lesfm.net/blog/what-is-phonk/)
- [Melodigging: slowed and reverb](https://www.melodigging.com/genre/slowed-and-reverb)

## What was built from it

The code is in `lib/star/goalClip/editCold.ts` (the cuts), `coldRender.ts`
(the drawing) and `editMusic.ts` with `public/star/edits/*.mp3` (the beats).
The words are in `lib/star/media/templates/coldEdits.ts`, and who posts what
is in `lib/star/media/clipStyle.ts COLD_BY_PERSONA`. It is all behind Leo's
switch part **"Cold edits"** (`coldEdits`).

Stills: `*-sheet.jpg` here, one frame every 0.25 s. The videos (`*.mp4`) are
the bench renders with the music only. The game also mixes the kicks, the net
and the crowd under the music.
