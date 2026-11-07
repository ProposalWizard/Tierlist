# Knowitball short v03: Who was Cole Palmer 10 years ago? (Stat Twins · Ep 2)

- File: `knowitball-v03-palmer-10-years.mp4`. Size: 1080×1920 (9:16), 30 fps, H.264 High, AAC 48 kHz stereo. Length: 78.4 s.
- Cover: `cover.png` (the hook frame at 1.6 s).
- Format: copied from the @more_tactics_board "Who is the next Kevin De Bruyne?" TikTok. Charts on a cream card, black with one red highlight, built up one bar at a time. A voice reads the script. Big word-by-word captions. No face. Same engine and look as Ep 1 (Salah's twin).
- Voice: Kokoro v1.0 (offline), voice `bm_george`, speed 1.15, en-gb. "Coutinho" is spoken as "Koo-cheen-yo" and "De Bruyne" as "De Broyna"; the captions show the real spelling.
- Sound: whooshes, hits, ticks and a quiet low music bed, all synthesised (numpy). No samples.
- Pictures: none. No club badges, no player photos. Names and text only.
- Data: Opta via FotMob, every Premier League attacker season (wingers, 10s, strikers) with 900+ minutes. All numbers come from `palmer_final.json` (in the working folder, see below).
- Model: 19 stats per 90 minutes, each ranked 0–100 against that season's attackers. Weights: chances created ×3, big chances made ×2.5, goals (no pens) / shots / assists / passes ×2, dribbles ×1.5, and lower weights for the rest. No xG (FotMob has none before 2019/20). Target = Palmer's 2023/24 and 2024/25 Chelsea seasons averaged. Pool = 2016/17 (88) + 2017/18 (93) = 181 seasons. Nearest by weighted distance, then 2,000 runs with every weight shuffled ±50%.
- Safe area: captions and cards stay inside x 64–950 and y 150–1536.

| Time (s) | Voiceover | On screen | Source |
|---|---|---|---|
| 0.15–2.58 | "Who was Cole Palmer ten years ago?" | Title card "WHO WAS / COLE PALMER / 10 YEARS / AGO?" (name in red). Kicker "Palmer · Chelsea · 23/24 + 24/25". | Hook |
| 2.58–10.09 | "I took every Premier League attacker season from sixteen-seventeen and seventeen-eighteen. One hundred and eighty-one of them." | "Ten years ago." 181 counts up. Two bars: 2016/17 88, 2017/18 93. | `pool` |
| 10.09–17.06 | "Nineteen stats each, per ninety minutes, ranked against that season's attackers. Chances created count the most." | "19 stats, per 90." Weight bars: chances created ×3 (red), big chances made ×2.5, goals (no pens) ×2, shots ×2, assists ×2, passes ×2, dribbles ×1.5, defending ×0.5. | `weights` |
| 17.06–24.82 | "Then we find who's closest to Palmer's 23/24 and 24/25. Two thousand times, shuffling every weight." | "Nearest neighbour." 181 dots around "PALMER 23/24 + 24/25"; the 8 nearest light red; "2,000" badge. | `pool`, method |
| 24.82–35.48 | "And Palmer's 24/25? Fourth for chances created, out of ninety-six attackers. Third for long balls. Sixth for big chances made. Sixth for shots." | "Palmer, 24/25." Rank out of 96: chances created #4 (2.51 per 90), long balls #3 (2.6), big chances made #6 (0.68), shots #6 (3.5). | `palmer2425_ranks`, `palmer2425_rank_of`, `palmer_raw_2425` |
| 35.48–41.85 | "Here's the top eight. Hazard. Firmino. Even De Bruyne. But number one is... Philippe Coutinho." | Top-8 countdown, #1 hidden as "?" until "Philippe": Coutinho 16/17 13.7, Willian 17/18 14.6, Sánchez 17/18 14.6, Sánchez 16/17 15.8, Hazard 17/18 17.2, Firmino 16/17 17.9, Martial 17/18 18.6, De Bruyne 17/18 19.4. | `top8` (distances) |
| 41.85–45.74 | "Liverpool, sixteen-seventeen. Thirteen goals, seven assists." | Reveal card "COUTINHO", "Liverpool · 2016/17", "2,243 minutes", 13 goals, 7 assists. | `top8[0]` (goals, assists, minutes) |
| 45.74–50.68 | "Closest in one thousand five hundred and ninety-six of two thousand runs." | 2,000-cell grid fills: Coutinho 16/17 1,596 (red), Sánchez 17/18 234, Willian 17/18 165, Sánchez 16/17 5. | `wins` |
| 50.68–55.91 | "Why? They create the same. Chances, passes, long balls, shots. Nearly identical." | Versus (0–100): chances created 94 v 93, passes 88 v 91, long balls 96 v 94, shots 92 v 98. | `vs_coutinho_pct` |
| 55.91–61.84 | "Now use only Palmer's 24/25. And number two is... Ross Barkley." | "Just 24/25." vs 2016/17: Coutinho 16.8, #2 appears on "Ross": Ross Barkley 17.8 (red), Firmino 18.1, Sánchez 19.7. Note: "Coutinho still #1: closest in 1,635 of 2,000 runs". | `p2425_vs_1617`, `p2425_wins` |
| 61.84–70.39 | "But they're not the same player. Coutinho dribbled twice as much. Palmer makes way more big chances. And Coutinho scored more without penalties." | "Not the same player." Dribbles 71 v 86 (per 90: Palmer 1.4 in 24/25, Coutinho 2.8). Big chances made 94 v 85 (per 90: 0.68 in 24/25 v 0.28). Goals (no pens) 70 v 89 (per 90: Palmer 0.31 / 0.45, Coutinho 0.52). | `vs_coutinho_pct`, `palmer_raw_2425`, `palmer_raw_2324`, `coutinho_raw` |
| 70.39–78.42 | "So ten years ago, Cole Palmer was Philippe Coutinho. Who should I find the twin of next? Comment below." | End card: "KNOWITBALL", "WHO'S NEXT? / COMMENT BELOW", green knowitball.co.uk pill. | CTA |

## How it was made
1. `lines.json` (voice lines and caption words) and `scenes.json` (one chart card per line) feed the shared Stat Twins engine in `tools/video-render/twin/`.
2. `tts.py` voices each line with Kokoro. `timeline.py` times every caption word and mixes the sound. `render.cjs` draws each frame from time t alone in Playwright Chromium and encodes with ffmpeg.

The working files are outside the repo, in `/tmp/claude-0/-home-user-Tierlist/84a0c395-3776-5543-b933-7d1eba9d58ff/scratchpad/v03/`, with the data in `palmer_final.json` one folder up.
