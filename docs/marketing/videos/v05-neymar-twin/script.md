# Knowitball short v05: prime Neymar (17/18)'s statistical twin (Stat Twins · Ep 4)

- File: `knowitball-v05-neymar-twin.mp4`. 1080×1920 (9:16), 30 fps, H.264, AAC 48 kHz stereo. Length: 64.2 s. Cover: `cover.png` (the intro card at 4.5 s, with the two blurred twins).
- First top-5-leagues episode, made with make_episode.py (Twin Finder data and method, fast style). Answer: Michael Olise 25/26 Bayern (89%, first in 80% of 2,000 tests), also #3 with 24/25; right now: Lamine Yamal (86%). Mo Salah's best season is 51st.
- Model: Premier League attackers (wingers, 10s, strikers), 900+ minutes (450+ for 26/27, about 10 games in). Every stat per 90 minutes, ranked 0–100 against that player's own season; weighted gap; match % = 100 minus the gap; 2,000 tests with the weights shuffled ±50%. Data: FotMob's public stat pages (Opta), read 7 Nov 2026. Pictures: FotMob headshots, club badges (the club that season) and flags.
- Voice: Hugo (ElevenLabs, eleven_multilingual_v2), gaps trimmed to 0.16 s, as tools/video-factory/make.py. Sound made in numpy. Made with `tools/video-render/twin/` (engine `video2.html`, numbers `model/v2data.py`).

| Time (s) | Voiceover | On screen | Source |
|---|---|---|---|
| 0.15–2.71 | "Prime Neymar's statistical twin is not who you think." | Intro card: face, badge, flag, NEYMAR 2017/18; ; two blurred faces: LAST 5 YEARS, CURRENT | v2data.json |
| 2.71–8.17 | "Number eight and four: Raphinha. Barcelona. Twice. Eighty-six percent." | Countdown #4 · #8: Raphinha 2024/25 · 2025/26, 86% match; pop-up 0.82 big chances made per 90 (2nd of 70 La Liga attackers) | v2data.json |
| 8.17–12.95 | "Seven and two: Lamine Yamal. Barcelona. Twice. Eighty-eight percent." | Countdown #2 · #7: Lamine Yamal 2025/26 · 2026/27, 88% match; pop-up 1.03 big chances made per 90 (1st of 77 La Liga attackers) | v2data.json |
| 12.95–15.85 | "You'd think Mohamed Salah would be up here? He's fifty-first." | Aside: Mohamed Salah 2024/25, #51, 77% match, 'Not even top 50'; pop-up 0.53 goals per 90 (no pens) (1st of 72 Premier League attackers) | v2data.json |
| 15.85–20.45 | "Six: Lionel Messi. His old PSG team-mate. Eighty-six percent." | Countdown #6: Lionel Messi 2022/23, 86% match; pop-up 4.10 shots per 90 (1st of 64 Ligue 1 attackers) | v2data.json |
| 20.45–26.33 | "Five: Vinícius Júnior. Real Madrid. Eighty-six percent. Guess the twin in the comments." | Countdown #5: Vinícius Júnior 2024/25, 86% match; pop-up 3.30 dribbles per 90 (3rd of 72 La Liga attackers); sticker GUESS THE TWIN IN THE COMMENTS | v2data.json |
| 26.33–33.97 | "And number one... Michael Olise. Bayern Munich. Eighty-nine percent. He's number three too. That makes him Neymar's statistical twin." | Countdown #1 · #3: Michael Olise 2025/26 · 2024/25, 89% match, becomes SALAH'S STATISTICAL TWIN; pop-up 0.74 assists per 90 (1st of 59 Bundesliga attackers) | v2data.json |
| 33.97–38.48 | "Why? Almost the same big chances made and shots on target, every ninety minutes." | Almost the same. (per 90): Big chances made 1.11 vs 1.05; Shots on target 2.1 vs 1.9 | v2data.json |
| 38.48–41.47 | "The difference? Neymar dribbles more, and scores more." | Not the same player. (per 90): Dribbles 7.1 vs 2.5; Goals 0.76 vs 0.58 | v2data.json |
| 41.47–42.51 | "And this season only?" | countdown card | v2data.json |
| 42.51–44.38 | "Five: Antonio Nusa." | Countdown #5: spotlight Antonio Nusa 2026/27, 79% match | v2data.json |
| 44.38–46.08 | "Four: Rayan Cherki." | Countdown #4: spotlight Rayan Cherki 2026/27, 79% match | v2data.json |
| 46.08–47.59 | "Three: Fermín López." | Countdown #3: spotlight Fermín López 2026/27, 80% match | v2data.json |
| 47.59–48.90 | "Two: Raphinha." | Countdown #2: spotlight Raphinha 2026/27, 80% match | v2data.json |
| 48.90–53.25 | "And number one, after about ten games... Lamine Yamal. Eighty-six percent." | Countdown #1: spotlight Lamine Yamal 2026/27, 86% match | v2data.json |
| 53.25–57.88 | "Yamal against Neymar: chances created and assists, every ninety minutes." | Neymar vs Yamal. (per 90): Chances created 3.47 vs 3.58; Assists 0.65 vs 0.7 | v2data.json |
| 57.88–64.20 | "So Neymar's twin is Michael Olise. And right now, it's Lamine Yamal. Follow for more." | End card: Last 5 seasons: NEYMAR 17/18 = OLISE 25/26 / This season: NEYMAR 17/18 = YAMAL; KNOWITBALL, WHO'S NEXT? COMMENT BELOW, knowitball.co.uk | v2data.json |
