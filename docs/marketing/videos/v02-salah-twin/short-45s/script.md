# Knowitball short v02 (45 s cut): Salah's statistical twin

- File: `knowitball-v02-salah-twin-45s.mp4`. 1080×1920 (9:16), 30 fps, H.264, AAC 48 kHz stereo. Length: 46.6 s. Cover: `cover.png` (the intro card at 4.5 s, with the two blurred twins).

- 45-second cut with a stronger hook (Mikey, 9 Nov 2026), after the first Instagram stats: 60% skipped in the first 3 s, average watch 11 s. Opens on 'Mo Salah's statistical twin is not who you think.' with the two blurred twins on screen from frame 0; no tests card, no this-season countdown.
- Model: Premier League attackers (wingers, 10s, strikers), 900+ minutes (450+ for 26/27, about 10 games in). Every stat per 90 minutes, ranked 0–100 against that player's own season; weighted gap; match % = 100 minus the gap; 2,000 tests with the weights shuffled ±50%. Data: FotMob's public stat pages (Opta), read 7 Nov 2026. Pictures: FotMob headshots, club badges (the club that season) and flags.
- Voice: Hugo (ElevenLabs, eleven_multilingual_v2), gaps trimmed to 0.16 s, as tools/video-factory/make.py. Sound made in numpy. Made with `tools/video-render/twin/` (engine `video2.html`, numbers `model/v2data.py`).

| Time (s) | Voiceover | On screen | Source |
|---|---|---|---|
| 0.15–3.21 | "Mo Salah's statistical twin is not who you think." | Intro card: face, badge, flag, SALAH 2024/25; ; two blurred faces: LAST 5 YEARS, CURRENT | v2data.json |
| 3.21–6.09 | "His own seasons don't count. That leaves five." | Countdown #1 · #2 · #7: Mohamed Salah 2022/23 · 2023/24 · 2025/26 (greyed out, not counted) | v2data.json |
| 6.09–8.89 | "Five: Son Heung-min." | Countdown #5: Heung-Min Son 2023/24, 76% match; pop-up 0.61 big chances made per 90 (4th of 101 PL attackers) | v2data.json |
| 8.89–11.72 | "Four: Harvey Barnes." | Countdown #4: Harvey Barnes 2024/25, 76% match; pop-up 0.46 goals per 90 (no pens) (14th of 96 PL attackers) | v2data.json |
| 11.72–14.40 | "Saka? Twenty-eighth." | Aside: Bukayo Saka 2023/24, #28, 70% match, 'Not even top 25'; pop-up 2.79 chances created per 90 (2nd of 101 PL attackers) | v2data.json |
| 14.40–18.41 | "Three: Kelechi Iheanacho. Yes, really." | Countdown #3: Kelechi Iheanacho 2022/23, 76% match; pop-up 0.40 assists per 90 (5th of 94 PL attackers) | v2data.json |
| 18.41–22.44 | "Two: Roberto Firmino. Guess the twin in the comments." | Countdown #2: Roberto Firmino 2022/23, 78% match; pop-up 0.82 goals per 90 (no pens) (2nd of 94 PL attackers); sticker GUESS THE TWIN IN THE COMMENTS | v2data.json |
| 22.44–27.16 | "And number one... Cole Palmer. A seventy-nine percent match." | Countdown #1: Cole Palmer 2023/24, 79% match, becomes SALAH'S STATISTICAL TWIN; pop-up 22+11 goals + assists (Premier League 2023/24) | v2data.json |
| 27.16–31.32 | "They create the same. Same chances, same shots on target." | They create the same. (per 90): Chances created 2.37 vs 2.47; Shots on target 1.6 vs 1.6 | v2data.json |
| 31.32–36.06 | "The difference? Palmer passes way more. Salah scores more, and makes more big chances." | Not the same player. (per 90): Passes 22.7 vs 37.4; Goals (no pens) 0.53 vs 0.45; Big chances made 0.72 vs 0.58 | v2data.json |
| 36.06–38.26 | "And right now? Rayan Cherki." | Countdown #1: spotlight Rayan Cherki 2026/27, 76% match | v2data.json |
| 38.26–42.84 | "He creates even more. Over three chances every ninety minutes. And more goals, so far." | Salah vs Cherki. (per 90): Chances created 2.37 vs 3.41; Goals (no pens) 0.53 vs 0.76 | v2data.json |
| 42.84–46.64 | "Salah's twin is Cole Palmer. Follow for more." | End card: Last 5 seasons: SALAH 24/25 = PALMER 23/24 / This season: SALAH 24/25 = CHERKI; KNOWITBALL, WHO'S NEXT? COMMENT BELOW, knowitball.co.uk | v2data.json |
