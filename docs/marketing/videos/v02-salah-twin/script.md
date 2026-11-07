# Knowitball short v02: Salah's statistical twin

- File: `knowitball-v02-salah-twin.mp4`. Size: 1080×1920 (9:16), 30 fps, H.264, AAC 48 kHz stereo. Length: 87.2 s. Cover: `cover.png` (the hook frame at 1.6 s).
- Format: copies @more_tactics_board's "Who is the next Kevin De Bruyne?" (statistical twin). No presenter: chart card on top, word-by-word captions below.
- Voice: Kokoro v1.0 (offline), `bm_george`, speed 1.15, en-gb. Sound: whooshes, hits, ticks and a soft bed, all made in numpy. No music files.
- Data: Premier League player stats from FotMob's public stat pages (Opta), read 7 Nov 2026. No player photos or club badges (RUL-KIB-003).
- Model: every PL attacker season (wingers, 10s, strikers) with 900+ minutes; 23 stats per 90, each ranked 0–100 against that season's attackers; weighted distance; 2,000 runs with every weight shuffled ±50%. The full working: the "Why these twins" page (claude.ai/artifact/6s28uMpTRjpGm3rAiyRxUj).
- Made with `tools/video-render/twin/` (lines.json + scenes.json → tts.py → timeline.py → render.cjs).

| Time (s) | Voiceover | On screen | Source |
|---|---|---|---|
| 0.15–2.81 | "Who is Mo Salah's statistical twin?" | title card: WHO IS / SALAH'S / STATISTICAL / TWIN? | Question |
| 2.81–9.72 | "To find out, I took every Premier League attacker season since 2020. Six hundred and one of them." | count card: Every season. | Pool: PL attacker seasons 2020/21–2025/26 with 900+ mins (99+98+94+101+96+113) |
| 9.72–17.23 | "Twenty-three stats each, per ninety minutes, ranked against everyone that season. Goals and expected goals count the most." | bars card: 23 stats, per 90. | Model weights (W_SALAH) |
| 17.23–22.62 | "Then we measure who's closest to Salah. Two thousand times, shuffling the weights every run." | web card: Nearest neighbour. | Method: weighted distance on 0–100 season ranks; 2,000 runs, weights ±50% |
| 22.62–32.23 | "And his 24/25 was ridiculous. Twenty-nine goals, eighteen assists. The most goals plus assists per ninety of any attacker that season." | bars card: Salah, 24/25. | Salah 2024/25 ranks among 96 attackers: G+A/90 1.01 #1, A/90 0.48 #2, big chances made 0.72 #4, on target 1.6 #4, npG/90 0.53 #5 |
| 32.23–38.60 | "Here's the top eight. And unsurprisingly, number one is Salah himself, in 21/22." | rank card: The top eight. | All-season top 8 (salah_all) |
| 38.60–44.23 | "But take out Salah's own seasons, and the closest player is... Harry Kane. A striker." | rank card: Without Salah. | Others-only top 5; Kane 21/22 closest in 1,283 of 2,000 runs (salah_oth_wins) |
| 44.23–51.13 | "Because they shoot the same. Same shots, same shots on target, same expected goals, same big chances made." | versus card: They shoot the same. | 0–100 ranks Salah vs Kane: shots 91/97, on target 96/97, xG 92/91, big chances made 96/94 |
| 51.13–54.71 | "The difference? Salah created way more. And he finished better." | versus card: Not the same player. | Chances created 94/56, assists 98/83, conversion 94/57 |
| 54.71–65.12 | "So who's the most similar winger of the last two seasons? Harvey Barnes, 24/25. In one thousand nine hundred and seventy-four of two thousand runs." | runs card: Most similar winger. | Wingers only, 24/25 + 25/26: Barnes 24/25 1,974 of 2,000, Trossard 25/26 26 |
| 65.12–68.94 | "And this season, after about ten games? Rayan Cherki." | rank card: Right now. | 26/27 (450+ mins) blended 65/35 with 25/26: Cherki 27.3, Mbeumo 28.9, João Pedro 30.2, Saka 31.9, Rogers 32.0 |
| 68.94–73.44 | "Closest in thirteen hundred and seventy-two of two thousand runs." | runs card: Every run. | Cherki 1,372, Mbeumo 446, João Pedro 182 of 2,000 |
| 73.44–79.10 | "But they're not the same player. Cherki passes way more. Salah gets far more of the big chances." | versus card: Not the same player. | Passes 58/99, xG 92/62, chances 94/99 |
| 79.10–87.20 | "So Salah's twin is Harry Kane. Right now, it's Cherki. Who should I find the twin of next? Comment below." | end card: WHO'S NEXT? / COMMENT BELOW | CTA |
