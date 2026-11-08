# Knowitball short v02 (49 s cut): Salah's statistical twin

- File: `knowitball-v02-salah-twin-45s.mp4`. 1080×1920 (9:16), 30 fps, H.264, AAC 48 kHz stereo. Length: 49.3 s. Cover: `cover.png` (the intro card at 4.5 s, with the two blurred twins).
- Version 5 (8 Nov 2026): the Poster style (full page, each player in his club colour; engine video_full.html), Salah's own seasons removed with an animation and the list re-ranked to a top 5, each 'this season' place its own line, end card in club colours. Version 4 = version 3 plus Mikey's picks: 4-s intro, '100% = identical' on screen only, 'You'd think Saka? 31st', 'guess the twin' sticker at #4, a pop-up fact per player, cards slide in from alternating sides; the intro card shows the two twins blurred (LAST 5 YEARS, CURRENT). Version 3: voice Hugo on ElevenLabs (FACT-KIB-012); the target's own seasons shown first and greyed out, then the countdown from the bottom, a repeated player's places shown together; "first in x% of tests"; end card with both = pairs; ending line "Follow for more." (RUL-KIB-005). Faces, club badges and flags (RUL-KIB-007), "% match" (100% = identical), "#1 in x of 10 tests" in place of "2,000 runs", real per-90 numbers on screen (never ranks).
- Fast cut (Mikey, 9 Nov 2026): the hook pill slams on with 'not', the face pushes in and the blurred twins pulse; each place appears the moment its number is said, no pauses between places (about 1.6 s each); each club colour wipes in from the side the player slides from; this season's full top 5 is back.
- Model: Premier League attackers (wingers, 10s, strikers), 900+ minutes (450+ for 26/27, about 10 games in). Every stat per 90 minutes, ranked 0–100 against that player's own season; weighted gap; match % = 100 minus the gap; 2,000 tests with the weights shuffled ±50%. Data: FotMob's public stat pages (Opta), read 7 Nov 2026. Pictures: FotMob headshots, club badges (the club that season) and flags.
- Voice: Hugo (ElevenLabs, eleven_multilingual_v2), gaps trimmed to 0.16 s, as tools/video-factory/make.py. Sound made in numpy. Made with `tools/video-render/twin/` (engine `video2.html`, numbers `model/v2data.py`).

| Time (s) | Voiceover | On screen | Source |
|---|---|---|---|
| 0.15–3.21 | "Mo Salah's statistical twin is not who you think." | Intro card: face, badge, flag, SALAH 2024/25; ; two blurred faces: LAST 5 YEARS, CURRENT | v2data.json |
| 3.21–5.41 | "His own seasons don't count. That leaves five." | Countdown #1 · #2 · #7: Mohamed Salah 2022/23 · 2023/24 · 2025/26 (greyed out, not counted) | v2data.json |
| 5.41–7.03 | "Five: Son Heung-min." | Countdown #5: Heung-Min Son 2023/24, 76% match; pop-up 0.61 big chances made per 90 (4th of 101 PL attackers) | v2data.json |
| 7.03–8.68 | "Four: Harvey Barnes." | Countdown #4: Harvey Barnes 2024/25, 76% match; pop-up 0.46 goals per 90 (no pens) (14th of 96 PL attackers) | v2data.json |
| 8.68–10.21 | "Saka? Twenty-eighth." | Aside: Bukayo Saka 2023/24, #28, 70% match, 'Not even top 25'; pop-up 2.79 chances created per 90 (2nd of 101 PL attackers) | v2data.json |
| 10.21–13.17 | "Three: Kelechi Iheanacho. Yes, really." | Countdown #3: Kelechi Iheanacho 2022/23, 76% match; pop-up 0.40 assists per 90 (5th of 94 PL attackers) | v2data.json |
| 13.17–16.45 | "Two: Roberto Firmino. Guess the twin in the comments." | Countdown #2: Roberto Firmino 2022/23, 78% match; pop-up 0.82 goals per 90 (no pens) (2nd of 94 PL attackers); sticker GUESS THE TWIN IN THE COMMENTS | v2data.json |
| 16.45–20.57 | "And number one... Cole Palmer. A seventy-nine percent match." | Countdown #1: Cole Palmer 2023/24, 79% match, becomes SALAH'S STATISTICAL TWIN; pop-up 22+11 goals + assists (Premier League 2023/24) | v2data.json |
| 20.57–24.13 | "They create the same. Same chances, same shots on target." | They create the same. (per 90): Chances created 2.37 vs 2.47; Shots on target 1.6 vs 1.6 | v2data.json |
| 24.13–28.82 | "The difference? Palmer passes way more. Salah scores more, and makes more big chances." | Not the same player. (per 90): Passes 22.7 vs 37.4; Goals (no pens) 0.53 vs 0.45; Big chances made 0.72 vs 0.58 | v2data.json |
| 28.82–29.85 | "And this season only?" | countdown card | v2data.json |
| 29.85–31.50 | "Five: Julio Enciso." | Countdown #5: spotlight Julio Enciso 2026/27, 66% match | v2data.json |
| 31.50–32.95 | "Four: João Pedro." | Countdown #4: spotlight João Pedro 2026/27, 69% match | v2data.json |
| 32.95–34.71 | "Three: Bryan Mbeumo." | Countdown #3: spotlight Bryan Mbeumo 2026/27, 69% match | v2data.json |
| 34.71–36.05 | "Two: Evanilson." | Countdown #2: spotlight Evanilson 2026/27, 71% match | v2data.json |
| 36.05–40.65 | "And number one, after about ten games... Rayan Cherki. seventy-six percent." | Countdown #1: spotlight Rayan Cherki 2026/27, 76% match | v2data.json |
| 40.65–45.53 | "He creates even more. Over three chances every ninety minutes. And more goals, so far." | Salah vs Cherki. (per 90): Chances created 2.37 vs 3.41; Goals (no pens) 0.53 vs 0.76 | v2data.json |
| 45.53–49.34 | "Salah's twin is Cole Palmer. Follow for more." | End card: Last 5 seasons: SALAH 24/25 = PALMER 23/24 / This season: SALAH 24/25 = CHERKI; KNOWITBALL, WHO'S NEXT? COMMENT BELOW, knowitball.co.uk | v2data.json |
