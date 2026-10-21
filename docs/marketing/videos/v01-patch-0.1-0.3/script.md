# Knowitball short v01: patch notes 0.1 to 0.3

- File: `knowitball-v01-patch-0.1-0.3.mp4`. Size: 1080×1920 (9:16), 30 fps, H.264 High, AAC 48 kHz stereo. Length: 44.7 s. Loudness: -13.4 LUFS.
- Cover: `cover.png` (the hook frame at 0.6 s).
- Voice: Kokoro v1.0 (offline, Apache-2.0), voice `bm_george`, speed 1.2, en-gb. This is the same setup as `scripts/commentary/generate.py`.
- Sound: whooshes and low hits are synthesised (numpy). The whistle, kick, net, keeper-save and crowd sounds are the game's own files from `public/sfx/`. There is no music.
- Pictures: the real v0.1 screenshots from `patch-notes/pages/0.1/img/`. v0.2 and v0.3 have no screenshots in the repo, so their beats use drawn diagrams. Each one is marked "ILLUSTRATION" on screen.
- Safe area: captions and cards stay inside x 64–950 and y 150–1536. That keeps them out of the right 12% and the bottom 20%.

| Time (s) | Voiceover | On screen | Source |
|---|---|---|---|
| 0.12–5.15 | "Three mates, building the best football game ever. Day one? The keeper saved everything." | Headline "3 MATES ARE BUILDING THE BEST FOOTBALL GAME EVER." (shown from frame 0). Real one-on-one gallery still, panning up to the keeper, with a red ring and "SAVED. EVERY TIME." Stamp v0.1. | v0.1 Fixed: "The keeper was never beaten … he just always saved it." |
| 5.15–9.97 | "One-on-ones went in nine point eight percent. Nobody in the way. He just saved it." | Big red "9.8%", "BEFORE · v0.1", ring on the keeper. | v0.1: "9.8% conversion with 0% blocked — nothing in the way, he just always saved it." |
| 9.97–12.76 | "Four bugs later? Forty-seven point six." | Counter 9.8% → 47.6% in green, "AFTER". Simulate still. Kick + net + crowd. | v0.1: "Four separate bugs, each found by measuring". One-on-one 9.8 → 47.6%. |
| 12.76–16.93 | "Sixty-nine percent of chances were framed wrong. So we pinned the goal." | "69%" over real camera option A (BEFORE), then a swipe to option E (AFTER) with "73.6% → 49%" empty grass. | v0.1: "69% of chances used to be framed wrong", "One zoom band, goal in the same spot every chance". The 73.6% and 49% figures are printed on panels A and E of `camera-options.png`. |
| 16.93–21.74 | "Fourteen chance situations became sixty-four. Zero repeats in a row." | Counter 14 → 64, then "0 REPEATS / 1,300 PRESSES OF SIMULATE". Fast montage of the real gallery stills. | v0.1: "14→64 different chance situations"; "1,300 presses: 1,221 different pictures, 0 repeats in a row". |
| 21.74–24.92 | "Version zero point two. Leo built Goalie Mode." | Gold "v0.2" slam, stamp ticks up. "GOALIE MODE / LEO'S NEW MINIGAME", drawn goal. | v0.2 Added: "Goalie Mode — a new minigame, in the Casino. You're the keeper." |
| 24.92–28.68 | "Your aim was half a metre off your cursor. Now it's exact." | "0.42 m" in red. A drawn crosshair sits off the cursor, then snaps on: "0.00 m", "EXACT". | v0.2 Fixed: "about 0.42m off target … on every single aim". After the fix: "max error … about 1e-16m". |
| 28.68–32.21 | "The pitch looked like an ice rink. The grass was never drawn." | "AN ICE RINK" over a pale ground, then green stripes wipe in: "REAL GRASS". | v0.2 Fixed: "looks like an ice rink … the whole fill … silently skipped drawing". Headline "0→real grass". |
| 32.21–37.73 | "Version zero point three. Your own team-mates blocked a third of your long shots. Now? Zero." | "v0.3" slam. "34.4%" in red. Drawn top-down: MATE in the shot line with ✕, then he moves away, the line turns green and the ball goes in. "0%". | v0.3 Fixed: "Your own team-mates were standing in front of your shot". Long range 34.4% → 0%. |
| 37.73–40.52 | "You draw the chances. The game learns the rules." | "15% → 0%: CHANCES THAT DIDN'T MATCH THEIR NAME", "THE AUTO-TUNER", the real editor still with a gold line drawing across it. | v0.3: "You draw chances. It works out the rules you were following." Headline "15%→0% chances that did not match their own name". |
| 40.52–44.64 | "Follow, and watch it become the best football game ever." | "KNOWITBALL", "v0.1 → v0.2 → v0.3 → ?", a green knowitball.co.uk pill, "FOLLOW FOR v0.4". | CTA |

## How it was made
1. The HTML canvas animation is drawn from time t alone, so every frame is the same on every render.
2. Playwright Chromium took a screenshot of each frame at 30 fps. It ran in chunks of 250 frames, with one page per chunk, because one long session crashed the page.
3. ffmpeg encoded it with libx264 and AAC.

The working files are outside the repo, in `/tmp/claude-0/-home-user-Tierlist/06265a1b-84e9-513f-a9d9-be07aadc231e/scratchpad/viral01/`: `video.html`, `timeline.py`, `render.cjs`, `tts.py` and `lines.json`.
