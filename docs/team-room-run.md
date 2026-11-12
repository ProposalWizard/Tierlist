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

No other bot is in the list. A "Claude" bot you can @, and build-your-own bots, are **not built** (out of scope for this job).

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
