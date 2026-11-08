# Knowitball short v02: Salah's statistical twin (Stat Twins · Ep 1)

- File: `knowitball-v02-salah-twin.mp4`. 1080×1920 (9:16), 30 fps, H.264, AAC 48 kHz stereo. Length: 95.2 s. Cover: `cover.png` (the intro card at 3 s).
- Version 3 (8 Nov 2026), Mikey's notes: voice Hugo on ElevenLabs (FACT-KIB-012); the target's own seasons shown first and greyed out, then the countdown from the bottom, a repeated player's places shown together; "first in x% of tests"; end card with both = pairs; ending line "Follow for more." (RUL-KIB-005). Faces, club badges and flags (RUL-KIB-007), "% match" (100% = identical), "#1 in x of 10 tests" in place of "2,000 runs", real per-90 numbers on screen (never ranks).
- Answer: Cole Palmer 23/24 (79% match, first in 79% of tests) from every PL attacker season 22/23–26/27, Salah's own 22/23, 23/24 and 25/26 shown and not counted; this season only: Rayan Cherki (76%).
- Model: Premier League attackers (wingers, 10s, strikers), 900+ minutes (450+ for 26/27, about 10 games in). Every stat per 90 minutes, ranked 0–100 against that player's own season; weighted gap; match % = 100 minus the gap; 2,000 tests with the weights shuffled ±50%. Data: FotMob's public stat pages (Opta), read 7 Nov 2026. Pictures: FotMob headshots, club badges (the club that season) and flags.
- Voice: Hugo (ElevenLabs, eleven_multilingual_v2), gaps trimmed to 0.16 s, as tools/video-factory/make.py. Sound made in numpy. Made with `tools/video-render/twin/` (engine `video2.html`, numbers `model/v2data.py`).

| Time (s) | Voiceover | On screen | Source |
|---|---|---|---|
| 0.15–7.47 | "Who is Mo Salah's statistical twin? Last five seasons. Every Premier League attacker. Twenty-three stats." | Intro card: face, badge, flag, SALAH 2024/25; 5 seasons · 22/23 to 26/27; 465 Premier League attacker seasons; 23 stats, all per 90 minutes | v2data.json |
| 7.47–13.24 | "First, Salah himself. Three of his own seasons made the top eight. They don't count." | Countdown #1 · #2 · #7: Mohamed Salah 2022/23 · 2023/24 · 2025/26 (greyed out, not counted) | v2data.json |
| 13.24–22.12 | "Now from the bottom. A hundred percent would be identical. Number eight: Son Heung-min. Tottenham. seventy-six percent." | Countdown #8: Heung-Min Son 2023/24, 76% match | v2data.json |
| 22.12–27.39 | "Six: Harvey Barnes. Newcastle. seventy-six percent." | Countdown #6: Harvey Barnes 2024/25, 76% match | v2data.json |
| 27.39–33.31 | "Five: Kelechi Iheanacho. Leicester. Yes, really." | Countdown #5: Kelechi Iheanacho 2022/23, 76% match | v2data.json |
| 33.31–39.43 | "Four: his old Liverpool team-mate, Roberto Firmino. seventy-eight percent." | Countdown #4: Roberto Firmino 2022/23, 78% match | v2data.json |
| 39.43–48.27 | "And three... Cole Palmer. His first season at Chelsea. seventy-nine percent. That makes him Salah's statistical twin." | Countdown #3: Cole Palmer 2023/24, 79% match, becomes SALAH'S STATISTICAL TWIN | v2data.json |
| 48.27–55.35 | "We changed how much each stat counts, two thousand times. Palmer came first in seventy-nine percent of them." | COLE PALMER · 23/24 / FIRST IN 79% OF TESTS / each test counts the stats differently | v2data.json |
| 55.35–62.17 | "Why? They create the same. Nearly two and a half chances every ninety minutes. The same shots on target." | They create the same. (per 90): Chances created 2.37 vs 2.47; Shots on target 1.6 vs 1.6 | v2data.json |
| 62.17–67.47 | "The difference? Palmer passes way more. Salah scores more, and makes more big chances." | Not the same player. (per 90): Passes 22.7 vs 37.4; Goals (no pens) 0.53 vs 0.45; Big chances made 0.72 vs 0.58 | v2data.json |
| 67.47–77.52 | "And this season only? Five, Julio Enciso. Four, João Pedro. Three, Bryan Mbeumo. Two, Evanilson." | Countdown: #5 Julio Enciso 66%, #4 João Pedro 69%, #3 Bryan Mbeumo 69%, #2 Evanilson 71% | v2data.json |
| 77.52–82.94 | "And number one, after about ten games... Rayan Cherki. seventy-six percent." | Countdown #1: spotlight Rayan Cherki 2026/27, 76% match | v2data.json |
| 82.94–88.37 | "He creates even more. Over three chances every ninety minutes. And more goals, so far." | Salah vs Cherki. (per 90): Chances created 2.37 vs 3.41; Goals (no pens) 0.53 vs 0.76 | v2data.json |
| 88.37–95.17 | "So Salah's twin is Cole Palmer. And right now, it's Rayan Cherki. Follow for more." | End card: Last 5 seasons: SALAH 24/25 = PALMER 23/24 / This season: SALAH 24/25 = CHERKI; KNOWITBALL, WHO'S NEXT? COMMENT BELOW, knowitball.co.uk | v2data.json |
