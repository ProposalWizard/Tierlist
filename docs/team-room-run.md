# Team room: a run of all bots and all channels (12 Nov 2026)

Harry asked: "have you done a run of all bots, and all channels having their own tabs/way of working?"
Before today: no. This page is that run.

**How it was run.** Two ways, both with made-up rows and no live database:

1. **Bots, the site's own code.** `npx tsx tests/star/teamRoomBots.mts` runs each bot's real server code twice against a pretend database held in memory. 56 checks, all pass.
2. **Channels and bot pages, on screen.** `node scripts/team-room/run-stills.mjs` opens the Team room with sample rows, does each channel's main action, presses Run now on each bot twice, in both looks at 390x844 and 1440x900. 124 checks, all pass, 0 page errors. 98 pictures: `docs/stills/team-room-v2-run/`.

**What "result" means.** *works* = the real code did the job in the run. *works with fake data only* = the code ran, but a part of it needs something only the live site has, so the live site must confirm it. *not built* = it is not there.

## Bots

| Bot | What was done | Result | What the live site must confirm |
|---|---|---|---|
| Patch bot | Run 1 announced 1 pretend note in #general, naming the two who did not write it (Harry and Mikey for Leo's note). Run 2 posted 0. A day later it sent its one reminder; the run after that posted 0. | works | That a real patch note published from 12 Nov is announced. None has been yet: the newest note in the code is older than 12 Nov, and the live table of bot posts held 0 rows when read today. |
| Bug bot | Run 1 posted 1 card in #bugs for a 40-minute-old report and none for a 6-day-old one. Run 2 posted 0. A card the database rule had already made was left alone; a double is removed. | works | That a real report makes a card. The rule inside the live database IS there (read today: 1 trigger, 3 tables). But no player has sent a report since 24 Oct (19 reports in total, 0 in the last 14 days), so no card has ever been made live. Send one test report from the site's feedback form to see it. |
| Health bot | The 08:00 job's code posted 4 coloured lines in #health (database 74% green, Storage 40% green, R2 not read, backup not found = red). Run now posted a second one marked "asked for by Harry". Switched off: no morning post. | works with fake data only | The real sizes (the `ops_limits()` database function, the R2 keys) and the 08:00 timer. The live table held 0 Health posts today, so the morning post has never gone out live: either CRON_SECRET is not set in Vercel or this code is not on main yet. Its page says which once it is live. Run now needs neither the timer nor CRON_SECRET. |
| Today bot (new) | At 09:10 on a Thursday it asked Harry and Leo in #today (Mikey had checked in). Run 2 posted 0: already asked today. Nothing before 09:00, after 14:00, at the weekend, when all three have checked in, or when switched off. | works | That the 15-minute timer (or one of us opening an admin page between 09:00 and 14:00) triggers it. |
| Jobs bot | 2 pushed jobs drawn as 2 posts in #todo (one for everyone, one for Mikey). It writes no rows, so it cannot double. It has no Run now and says why. | works | Nothing new: it reads the jobs file as it did before. |

No other bot is in the list. ~~A "Claude" bot you can @ is not built~~: built 13 Nov 2026, see the next part. Build-your-own bots (new bots beyond these nine) are **not built**: later.

## Bots you can @, Claude, and a bot each (13 Nov 2026)

Harry: "still no claude bots in admin and can't @ any bots like I should be able to @patch notes bot in general and ask for x patch notes".

**How it was run.** The same two ways, with made-up rows, no live database and **no real AI call** (a pretend AI stands in):

1. **The site's own code.** `npx tsx tests/star/teamRoomAtBots.mts`: 96 checks, all pass. The real server code against a pretend database and a pretend AI.
2. **On screen.** `node scripts/team-room/at-bots-stills.mjs`: 32 checks, all pass, 0 page errors, both looks at 390x844. Every picture is also measured for text contrast: 1,950 texts, lowest 4.53:1, none under 4.5:1. 32 pictures: `docs/stills/team-room-at-bots/`. The full contrast run over 27 screens: 6,870 texts, lowest 4.5:1, 0 under.

| What | What was done | Result | What the live site must confirm |
|---|---|---|---|
| Typing @ | The list showed Mikey and Leo, then nine bots with their round badges and a BOT tag. "@pat" narrowed it to Patch bot; picking it wrote "@Patch bot ". | works | Nothing. |
| @Patch bot | "latest", "0.137", "v0.137", "last 3", "since Monday", "what did Leo ship", "free kicks": each gave the matching notes (version, author, date, title, 3 to 5 lines, an Open button). "9.99": "I can't find v9.99. The three newest are…". On screen it answered in a thread under the message, which showed "1 reply". | works | That the asker's browser reaches the site's route when signed in (it needs the site's database key, which a dev build does not have). |
| @Bug bot | "open", "latest", "fixed" listed the matching reports with a button to #bugs. | works with fake data only | A real report (none has been sent since 24 Oct). |
| @Health bot | Answered with the limits, read by the same code as its Run now. | works with fake data only | The real sizes. |
| @Today bot | "Checked in today (2 of 3)… Not yet: Harry." Asking it in #today did not count as Harry's check-in. | works | Nothing. |
| @Jobs bot | "mine": the asker's open jobs (pushed and typed, never a ticked one). "Leo": Leo's. | works | The pushed jobs come from GitHub on the live site. |
| Words a bot does not know | "@Bug bot sing me a song": one line, "I didn't follow that. You can ask me, for example: …" with two examples. Never silence. | works | Nothing. |
| Never twice, never a bot, never old | A second run answered nothing. Three triggers at the same moment (two browsers and the timer) made one answer. The Today bot's own post containing "@Patch bot latest" was not answered. A 30-minute-old message was not answered. | works | Nothing. |
| Ask me | Each bot's page lists examples; tapping "last 3" put "@Patch bot last 3" in the message box in #general. | works | Nothing. |
| Claude, off | With no key: its page says "Claude is not switched on yet: one Vercel setting" with the three steps, and an @Claude got that one line. No AI call. | works | Nothing: this is how it will look on the live site today. |
| Claude, on | With a pretend AI: it answered in the thread and gave the Brain code it used (RUL-TEAM-021). It was shown the matching Brain note, not an unrelated one, plus the 5 newest patch notes. It was handed no tools. Asked to delete notes and add a task: it said what it would do and "I can't change anything myself. A person has to do that."; no task was made. | works with a pretend AI only | **A real answer.** No real AI call has been made. Needs ANTHROPIC_API_KEY in Vercel. |
| Claude's limits | Cost per reply worked out from the token counts (2,000 in, 300 out = $0.00035) and kept on the reply. At £20 for the month: "I've hit this month's limit", no AI call. A new month starts at £0. Same person within 20 seconds: one line, no AI call. 60 a day: the 61st refused. Switched off on its page: one line, no AI call. | works with a pretend AI only | That the live prices match the price table in the code (CLAUDE_BOT). |
| Harry bot, Mikey bot, Leo bot | Each is in the list with its owner's crest in a bot badge and its own page. A quick question was answered in the thread as "Leo bot". | works with a pretend AI only | A real answer. |
| A person's bot: settings | Harry tried to change Leo bot: refused, nothing saved. Leo saved his own (the note cut to 600 characters). On screen Harry's page was live and Leo's was greyed with "only Leo can change these". | works | That the live site knows who is signed in (it uses the same check as the other bots' switches). |
| A bigger ask (tier 2) | "@Leo bot fix the keeper dive on corners": a card, "This needs Leo's Claude. Send it?", no AI call, no change, no task. Harry pressing Accept: refused. Leo pressing Accept: exactly one job in Leo's to-do; pressed twice, still one. Decline: none. Bot switched off: one line, no card. | works | Nothing new. |
| After Accept | The card said "Sent to Harry's Claude · waiting" and kept the text for Harry's Claude. A pretend chat took the job once (a second chat got nothing), replied once, and the reply landed in the thread as "Leo's Claude". | works with fake data only | **The pipe to a real Claude chat is not switched on.** The chat hook is written (scripts/hooks/bot-jobs-hook.mjs) but needs one line in the chat settings file, which needs a person's yes. Until then: the job is in the owner's to-do and "Copy for my Claude" copies it. |

**Not done.** Build-your-own bots. A truly private room with a bot (the "Ask Claude here" box is kept off the channel list but is not locked). The old run script (`run-stills.mjs`) stops at the Team board step since the Team board tab was rebuilt on 13 Nov (its notes box moved); its 23 steps before that pass.

## Channels

| Channel | Its tabs | What was done on screen | Result | What the live site must confirm |
|---|---|---|---|---|
| #general | Messages, Pinned | Sent a message; opened Pinned (2 pinned). | works | Nothing new. |
| #today (new) | Today, This week, Messages | Checked in: my card went from "Not checked in yet today" to my line. This week showed 7 rows with today's line. `/today filming the run` typed in Messages became a #today message. | works | Nothing: a check-in is an ordinary message, no table. |
| #ideas | Ideas board, Messages | Posted an idea; voted 👍 0 → 1. | works | Nothing new. |
| #todo | Tasks, Messages | Added a task; accepted Leo's proposal (it became a job); Everyone showed 3 people side by side. | works | Nothing new. |
| #bugs | Open reports, Fixed, Messages | Marked a report fixed: Open went 2 → 1 and the card showed in Fixed. | works with fake data only | A real card (see Bug bot above). |
| #health | Limits, Messages | Limits showed the newest post as 4 coloured lines and a history of 2. Messages showed the post as Health bot with the same lines. | works with fake data only | A real morning post (see Health bot above). |
| #patch-notes | Archive, Messages | Archive listed every note with who has read it; pressed Read on one. | works | Nothing new. |
| #marketing | Production board, Messages | The card counted 10 videos over the 7 steps (6 at Final check, 4 Posted). | works | The counts are from the board as it was at the last deploy, not live. The live board is the first link under the card. |
| #context | Brain, Messages | Opened: one line and the link to the Brain's index. | works | Nothing. |
| #connectors | Messages only | Opened empty: one line says what it is for and that nothing posts there by itself yet. | not built (chat only) | Out of scope for this job. |
| Team board (tab) | - | 3 people with pushes a day and current work; added a note. | works with fake data only | The real pushes and bars come from the same source as Admin → Team board (GitHub and the progress updates). |
| Me | - | Tapped Filming: status set. | works | Nothing new. |
| Notifications question | - | A fresh device was asked once; after "Not now" and a reload it was not asked again. | works with fake data only | "Turn on" on a real phone and computer: the browser's own Allow box cannot be pressed in an automated run. Phone buzzes also need TEAM_PUSH_PRIVATE_KEY in Vercel. |

## The looks

Dark = Midnight slate, Light = Light C. Text contrast measured with `node scripts/team-room/contrast.mjs`: 5,604 pieces of text over 23 screens x 2 looks x 2 sizes. Lowest 4.5:1. Under 4.5:1: 0.

## Not done

- Real profile pictures: there is no picture field for a person yet, so everyone has a drawn crest.
- Calls, a live shared game, agentic search, the connectors channel, draw-a-box, build-your-own-bot: later, as agreed.
