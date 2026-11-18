You are a helper session remaking Knowitball TikTok shorts to Mikey's new "v2" standard. Work on your own and don't ask questions. If something needs a permission or an account you don't have, skip only that part and list it in your final report: Mikey wants every permission question saved for the end. No patch notes, no playtests.

## Setup
1. The repo is checked out. Run `git fetch origin claude/eloquent-bohr-6veqfh && git checkout claude/eloquent-bohr-6veqfh && git pull`.
   - Then create and push your own working branch: `git checkout -b claude/video-v2-4 && git push -u origin claude/video-v2-4`.
   - Push ONLY to that branch, never to any other.
2. Read, in full, before making anything:
   - `tools/video-factory/V2_RULES.md`: Mikey's rules. They override everything else.
   - `tools/video-factory/STORYBOARD.md` and `tools/video-factory/SETUP.md`.
   - `tools/video-factory/ww/README.md`: the Who would win? template.
   - `tools/video-factory/gamecap/README.md`: capturing Knowitball game footage.
   - The approved v2 example `tools/video-factory/stories/rob-henry-2003.json`. Copy its standard.
3. Do the setup:
   - Voice D: a CPU venv with `qwen-tts` and `faster-whisper`; export `QWEN_PY` as SETUP.md says. The model downloads about 2.4 GB on first use and needs about 7 GB of RAM.
   - Run `npm ci` in the repo root, for gamecap.
   - Playwright Chromium is pre-installed. ffmpeg comes from apt if it is missing.
   - The Supabase anon key for real badges and player portraits is public: it is in the live site's JavaScript at https://knowitball.co.uk. The scripts find it themselves, or put it in `.env.local` with NEXT_PUBLIC_SUPABASE_URL=https://cagkgfketucousksgtbk.supabase.co.
   - If a step fails, fix it (a different CPU wheel, for example). Never use cookies, logins or tricks to get around a block.
   - Voice D is slow on CPU, about 8 times the line's length per take. Run only ONE voice process at a time.

## Your videos (batch 4)
- rob-ribery-2013
- rob-sneijder-2010
- rob-vandijk-2019
- rob-xavi-iniesta-2010
- ct-haaland-stoke

Notes for this batch: Ballon d'Or robberies: rebuild them full screen like rob-henry-2003, with gameplay for key moments. ct-haaland-stoke: 'could Haaland do it on a cold rainy night in Stoke?'. Gameplay suits it well (use the gamecap night/weather options if they exist).

For each video:
1. **Rewrite the storyboard from scratch to the v2 standard** (same id unless a note says otherwise).
   - The voiceover tells an ENTERTAINING story: drama, key moments, cool background and a payoff. It is not a list of facts.
   - Check every fact against two sources.
   - Use the full-screen graphics: news headlines, the game-style league table with key rows highlighted, bars, line graphs, compare, timelines, trophies and real badges.
   - Add Knowitball gameplay (gamecap + the `gameclip` scene) for the key moments where it helps, and recreate real goals like for like when they are known.
   - About 60 to 80 seconds.
   - **Names:** every player, club and place name gets a `say` respelling. Use ONE joined word per name word, with no hyphens and no inner capitals (e.g. Soolay, Onree). Research the real pronunciation.
   - After the build, read `work/<id>/voice.json`. Fix any name the transcriber heard badly, then remake that line or video. Add the names you verify to `tools/video-factory/pronounce.json`.
2. **Who would win? videos** use `ww/build.py` with a `match.json` saved as `tools/video-factory/ww/matches/<id>.json`.
   - Copy the approved Man United v Roma format exactly, plus a narrated story `vo`.
   - Use real squads for the era. Take ratings from that season's FIFA/EA database (sofifa covers FIFA 07 on). Predict only for seasons no database covers, and say so.
   - Capture each goal or miss with gamecap in the right kits.
3. **Check by eye before calling a video done.**
   - Make a contact sheet: `sheet.py --video`, or ww's compare/stills.
   - Look at every scene: no overlaps, nothing cut off, no empty-looking screen, no talking man, kits correct and stripes inside the shirt, LINK IN BIO on the end card.
   - Check that no line reads the website.
   - Fix it and remake it if anything is wrong.
4. **Commit and push to `claude/video-v2-4`** after each video:
   - the storyboard JSON or match JSON
   - any pronounce.json additions
   - gamecap specs you wrote, saved under `tools/video-factory/gamecap/specs/`
   - Do NOT commit MP4s or frames.

## Deliver
- **Publish ONE private artifact page "Video batch v2-4"** that plays every finished video.
  - One `<video controls playsinline preload="none" poster=...>` per video, each with its title, series and a one-line description.
  - The MP4s are files in the publish: each a web copy under 15 MB, encoded with `-movflags +faststart`.
  - Publish again to the same artifact as each video finishes, so progress shows early. Split publishes so each one stays under 60 MB.
- **When everything is done,** send one message to session `session_016uZPozdFxyfTnMRJ9kx6PR` (send_message) with:
  - the artifact link
  - which videos are done and which failed, and why
  - anything skipped for permissions
- Your final reply should say the same.
- Never put an email address or personal data in any request header.
