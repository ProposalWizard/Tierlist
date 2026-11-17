# Handoff: Team room, bots, public home (17 Nov 2026)

## For
Harry's next chat (branch `Harry`).

## The goal in one line
Harry's 33-minute Team room / admin recording, 11 Nov: "It's time to act, time to build." Plus the public home ("Road to the Golden Ball is the main thing on the site, play now") and bots that "genuinely work", including Harry/Mikey/Leo bots.

## Where it stands
| | What | State |
|---|---|---|
| ✓ | Public home (cream, phone screen, games 3 a row, green bar/footer) + All games tab `/games` | LIVE, seen locally |
| ✓ | Beta sign-up table `beta_signups` | LIVE in database (checked) |
| ✓ | Patch notes 0.138 + Patch bot first live post (16:00, 13 Nov) | LIVE, seen in database |
| ✓ | @ any bot (Patch, Bug, Health, Today, Jobs), Claude bot, Harry/Mikey/Leo bots, bot settings pages | LIVE 13 Nov 16:55; not tried live by anyone yet |
| ✓ | Team board tab "Active now", push count by branch, pop-ups stay until closed | LIVE |
| ✗ | Plain name = @ mention (`515f4d85`), @all fixed (`d7fe3520`) | On Harry only, tested; **waiting for Harry's "push"** |
| ✗ | Nightly backup to Cloudflare | Failing live: site sees `R2_ACCOUNT_ID` as EMPTY (see Watch out) |
| ✗ | Footage hub, video library, marketing studio port, marketing ideas for the new name, connectors channel, /show, build-your-own bots | Not started |

## Decisions already made
- Home: look D "Cream phone", tiles 3 a row (v=2), green top bar + footer on home only; no beta/store band on phone (Harry, 12–13 Nov: "on phone use the white phone play now… then all the games friv style without the beta stuff"). Pitch idea and cartoon font dropped ("too roblox/gamey").
- Claude bot: answers only, never changes things; £20/month hard cap shared by Claude + 3 personal bots (code counts $1 = £1). Bigger asks → "Send to <owner>'s Claude?" card, owner-only Accept.
- Only a real @ offers a task; a plain name rings but does not offer a task.
- Push to main only on Harry's explicit "push". Database changes only with a yes and a READ ONLY / CHANGES THE DATABASE line first (RUL-DAT-002).
- Never mention or use the "Sean / Zocialgen" part of the recording (Harry: "remove that from this chat's memory").
- Higgsfield budget: 200 credits for the whole task, 0 used.

## Open questions (with my recommendation)
1. Push the plain-name + @all fixes? → Yes; both tested. Main has moved (Mikey merges), so merge `origin/main` into Harry first, then tsc + `npm run build`.
2. Turn on the chat hook so "send to my Claude" jobs reach Claude chats automatically (`scripts/hooks/bot-jobs-hook.mjs` under UserPromptSubmit in `.claude/settings.json`)? → Not yet; use "Copy for my Claude" first. Needs Harry's yes (config change).
3. Lock `/api/dev-bot-jobs/claim` and `/api/dev-recordings/claim` with a password? → Yes, cheap.
4. Update 0.138's "pop-ups next push" line? → Leave unless asked.
5. Next big piece? → Footage hub + video library together (R2 + Supabase), then marketing studio.

## Next steps
1. Ask Harry for "push"; then merge main → Harry, check, push `Harry:main`, watch a new page go live.
2. Ask Harry to press the eye on `R2_ACCOUNT_ID` in Vercel: blank/spaces → paste the 32-character Cloudflare Account ID, redeploy. If it shows 32 chars, add a Health-bot line saying what the site saw (empty / N characters, never the value).
3. Ask Harry for the first live bot tries: `@Patch bot latest`, `@Claude …`, Health bot "Run now". Fix whatever doesn't answer.
4. Mac pop-ups: Harry was told to set System Settings → Notifications → "Google Chrome (Alerts)" to Persistent. If still quick, build an in-room card that stays until closed.
5. Harry said the Team room "UI could work better and flow better", feedback coming: wait for it.
6. Then the next big piece (see Open question 5).

## Where things are
- Branch `Harry` @ `d7fe3520`; `main` @ `27256556` (has Mikey work not on Harry).
- Home: `app/page.tsx`, `app/games/page.tsx`, `components/home/` (test page `/home-new-dev?look=a|b|c|d`).
- Bots: `lib/teamRoom/atBots.ts`, `atBotsServer.ts`, `claudeBot.ts` (model + price + cap constant), `claudeClient.ts`; run table `docs/team-room-run.md`.
- Mentions: `lib/teamRoom/extras.ts` (`mentionsIn`, `atMentionsIn`, `mentionsAll`), highlight `components/teamRoom/bits.tsx`.
- Active now: `lib/teamRoom/activeNow.ts`; push count `lib/teamBoard.ts` (`BRANCH_PERSON`).
- Stills: `docs/stills/public-home-d/`, `team-room-at-bots/`, `team-board-tab-v2/`, `team-room-v2-run/`.
- Patch notes 0.138: https://claude.ai/artifact/1fG5jWkYiRbUs7CwrYQz1z · recording report https://claude.ai/artifact/T6ZkorkGtzNDPZ2pnxBrWv
- Recording transcript: `.recordings/teamroom-feedback/transcript.txt` (not in git).

## Watch out for
- `R2_ACCOUNT_ID` is ticked for Production and dated 22 Oct, yet the live code reads it as empty (the 3 other R2 settings are found). So recordings to R2 and the patch-note picture move have probably never worked live either.
- `tsc` needs `NODE_OPTIONS=--max-old-space-size=8192`. Full test suite takes 16 min; 5 old failures not ours (buildupLanding, fhr, fiveASide, longRangeRules, realGoals). Builders reported `adminMarketing.mts` 2 failing checks, not ours.
- Patch-note version numbers: check both main and Harry (`lib/patchNotesData.ts`); last is 0.138.
- Cleanup branch `harry-patch-media-cleanup`: merge only once the live media-sync says finished (blocked by R2 above).
- Leftover folder `/tmp/kib-pn-ship-202611012146-2299` (old 0.137 ship) can be removed.
- Commit sign-off is now "Co-Authored-By: Claude Opus 5.5"; builders sometimes keep the old line.

## Still running
Nothing. No builders or timers open.
