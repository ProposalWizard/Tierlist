# Video factory v2: Mikey's rules (4 Nov 2026)

These rules apply to every Knowitball short from now on. They come from Mikey's review of the first 88 drafts.
Where this file and STORYBOARD.md disagree, this file wins.

## Never
- **No talking man / narrator** on screen. The animation fills the WHOLE 1080x1920 screen: no top-half card over a bottom-half presenter.
- **No change of format without asking Mikey first.** If a series has an approved look (below), copy it.
- **No "you" (the player's own footballer)** inside the story videos for now. That includes "X with you up front" and "the Ballon d'Or and you".
- **The voice never reads the website or "link in bio".**

## Voice
- **Voice D:** Qwen3-TTS 0.6B Base, cloning Tadhg Hynes (LibriVox *Oliver Twist*, public domain). Reference clip: `voice/hynes.wav` plus its transcript `voice/hynes.txt`.
- **Pronunciation:** every player, club, place and manager name must be said correctly.
  - Look up how each name is said: Wikipedia IPA, a "how to pronounce" source, or club/broadcast usage.
  - Write a sound-alike spelling in the line's `say` field, e.g. `"say": "Soolay"` while `text` keeps "Soulé". Write each name as ONE joined word, no hyphens, no inner capitals: voice D pauses at hyphens and spells out capitals ("tee-AIR-ee" came out as "TARE").
  - Keep the shared dictionary `pronounce.json` up to date. Check by transcribing and by reading the respelling aloud in your head; it must be unambiguous English.
- **Last spoken line:** "Follow for more, and play Road to Ballon d'Or."
- **End card on screen:** it still shows KNOWITBALL / ROAD TO BALLON D'OR / KNOWITBALL.CO.UK / FOLLOW FOR THE NEXT ONE / **LINK IN BIO**, the same as the approved United v Roma end card.

## Look
- **Graphics:** proper, polished graphics, like good informative football videos, not basic cards. Use whatever fits the story:
  - real-looking **league tables**: use the game's own league-table look, highlight the key rows and show the points or goal-difference gaps
  - **news headlines** (a headline with a proper standfirst under it; never the plain white notepad with a red margin line)
  - bar charts, line graphs, timelines, stat comparisons, maps
  - better trophies
- **Real club badges are allowed in videos** (not in the game). Use `club_logos` (Supabase, public-read) when a badge exists; otherwise use the drawn crest.
- **Kits with stripes or hoops:** the pattern is PART of the shirt, clipped to the shirt's shape. It is never loose lines drawn over the shoulders.
- **Knowitball gameplay:** use the game's own animated match footage (the goal-clip renderer, as in Who would win? United v Roma) wherever it makes a moment better, e.g. Kompany's header against United in 2012, or Henry scoring for Arsenal. Recreate the real goal like for like where it is known: who passed, where from, header or shot. Use the right kits and skin and hair looks. Kit: `gamecap/`.

## Story
- The voiceover tells an **entertaining story**, not a list of facts: key moments, drama, cool background (e.g. "MSN"), and a payoff.
- Every fact is checked against two sources. Unsure means leave it out.
- About 60 to 80 seconds.

## Series notes
- **Ballon d'Or robberies:** the structure is good. Rebuild it full screen, add gameplay for the key moments where it fits, and use real badges.
- **What if Man City…? / The Negreira case / Biggest scandals:** use proper graphics, real league tables at the time with the key rows highlighted, news-style headlines, and gameplay recreations of famous goals where it helps.
- **Who would win?:** use EXACTLY the approved Man United v Roma format (`ww/`), with grid, title, team sheets, versus, globe, star-man ratings, gameplay match with goal pop-ups, full time, player of the match and end card, **plus a voiceover** telling the story.
  - Old teams take ratings from old FIFA databases; predict them only when no database covers that season.
  - Matchups must be relevant: an upcoming or topical game, or a famous "what if". No random big-club pairings.
- **Best season ever, settled / Age-match / Country swaps / Three rules / Power rankings / Everyone by age:** the same upgrades apply. Use real tables, charts, timelines and gameplay for key moments.
