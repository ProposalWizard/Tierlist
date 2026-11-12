# Knowitball short v04: Erling Haaland 22/23's statistical twin (Stat Twins · Ep 3)

- File: `knowitball-v04-haaland-twin.mp4`. 1080×1920 (9:16), 30 fps, H.264, AAC 48 kHz stereo. Length: 79.9 s. Cover: `cover.png` (the intro card at 3 s, with the two blurred twins).
- Format: the locked Stat Twins format (PRO-KIB-001): Poster style (engine video_full.html), Hugo's voice (FACT-KIB-012), the player's own seasons removed and the list re-ranked, a famous name outside the list, 'guess the twin' at #2, 'first in x% of 2,000 tests', this season's top 5, end card in club colours. Faces, badges and flags: RUL-KIB-007.
- Made with make_episode.py from episodes/haaland-2223.json (no hand edits). Answer: Callum Wilson 22/23 (90% match, first in 100% of 2,000 tests), #1 of a top 6 once Haaland's own 23/24 and 25/26 are removed; this season only: João Pedro (73%). Harry Kane's best season is 29th (72%).
- Model: Premier League attackers (wingers, 10s, strikers), 900+ minutes (450+ for 26/27, about 10 games in). Every stat per 90 minutes, ranked 0–100 against that player's own season; weighted gap; match % = 100 minus the gap; 2,000 tests with the weights shuffled ±50%. Data: FotMob's public stat pages (Opta), read 7 Nov 2026. Pictures: FotMob headshots, club badges (the club that season) and flags.
- Voice: Hugo (ElevenLabs, eleven_multilingual_v2), gaps trimmed to 0.16 s, as tools/video-factory/make.py. Sound made in numpy. Made with `tools/video-render/twin/` (engine `video2.html`, numbers `model/v2data.py`).

| Time (s) | Voiceover | On screen | Source |
|---|---|---|---|
| 0.15–4.27 | "Who is prime Erling Haaland's statistical twin? From the last five seasons." | Intro card: face, badge, flag, HAALAND 2022/23; 5 seasons · 22/23 to 26/27; 465 Premier League attacker seasons; 23 stats, all per 90 minutes; two blurred faces: LAST 5 YEARS, CURRENT | v2data.json |
| 4.27–10.87 | "First, Haaland himself. Two of his own seasons made the top eight. They don't count. So that leaves six." | Countdown #2 · #4: Erling Haaland 2025/26 · 2023/24 (greyed out, not counted) | v2data.json |
| 10.87–16.14 | "Number six: Darwin Noonyez. Liverpool. Seventy-nine percent." | Countdown #6: Darwin Núñez 2023/24, 79% match; pop-up 4.80 shots per 90 (1st of 101 PL attackers) | v2data.json |
| 16.14–20.68 | "Five: Nicolas Jackson. Chelsea. Eighty percent." | Countdown #5: Nicolas Jackson 2024/25, 80% match; pop-up 0.49 xG per 90 (no pens) (7th of 96 PL attackers) | v2data.json |
| 20.68–24.18 | "You'd think Harry Kane would be up here? He's twenty-ninth." | Aside: Harry Kane 2022/23, #29, 72% match, 'Not even top 25'; pop-up 0.66 goals per 90 (no pens) (4th of 94 PL attackers) | v2data.json |
| 24.18–28.57 | "Four: Alexander Isak. Newcastle. Eighty percent." | Countdown #4: Alexander Isak 2024/25, 80% match; pop-up 0.62 goals per 90 (no pens) (3rd of 96 PL attackers) | v2data.json |
| 28.57–35.81 | "Three and two: Ollie Watkins. Villa. Twice. Eighty-five percent. Guess the twin in the comments." | Countdown #2 · #3: Ollie Watkins 2024/25 · 2023/24, 85% match; pop-up 0.48 goals per 90 (no pens) (10th of 96 PL attackers); sticker GUESS THE TWIN IN THE COMMENTS | v2data.json |
| 35.81–42.55 | "And number one... Callum Wilson. Newcastle. Ninety percent. That makes him Haaland's statistical twin." | Countdown #1: Callum Wilson 2022/23, 90% match, becomes SALAH'S STATISTICAL TWIN; pop-up 0.72 xG per 90 (no pens) (2nd of 94 PL attackers) | v2data.json |
| 42.55–47.58 | "We changed how much each stat counts, two thousand times. Wilson came first in every single one." | CALLUM WILSON · 22/23 / FIRST IN 100% OF TESTS / each test counts the stats differently | v2data.json |
| 47.58–51.48 | "Why? Almost the same expected goals and assists, every ninety minutes." | Almost the same. (per 90): Expected goals 0.74 vs 0.72; Assists 0.26 vs 0.24 | v2data.json |
| 51.48–54.93 | "The difference? Haaland passes more. Wilson dribbles more." | Not the same player. (per 90): Passes 11.6 vs 7.6; Dribbles 0.4 vs 0.6 | v2data.json |
| 54.93–56.22 | "And this season only?" | countdown card | v2data.json |
| 56.22–58.20 | "Five: Evanilson." | Countdown #5: spotlight Evanilson 2026/27, 69% match | v2data.json |
| 58.20–60.32 | "Four: Bryan Mbeumo." | Countdown #4: spotlight Bryan Mbeumo 2026/27, 71% match | v2data.json |
| 60.32–62.39 | "Three: Brian Brobbey." | Countdown #3: spotlight Brian Brobbey 2026/27, 72% match | v2data.json |
| 62.39–64.39 | "Two: Thierno Barry." | Countdown #2: spotlight Thierno Barry 2026/27, 73% match | v2data.json |
| 64.39–69.18 | "And number one, after about ten games... João Pedro. Seventy-three percent." | Countdown #1: spotlight João Pedro 2026/27, 73% match | v2data.json |
| 69.18–73.60 | "João Pedro against Haaland: goals and chances created, every ninety minutes." | Haaland vs João Pedro. (per 90): Goals 0.94 vs 0.86; Chances created 0.97 vs 1.21 | v2data.json |
| 73.60–79.89 | "So Haaland's twin is Callum Wilson. And right now, it's João Pedro. Follow for more." | End card: Last 5 seasons: HAALAND 22/23 = WILSON 22/23 / This season: HAALAND 22/23 = JOÃO PEDRO; KNOWITBALL, WHO'S NEXT? COMMENT BELOW, knowitball.co.uk | v2data.json |
