# The Knowitball Discord — plan (Leo, 19 Nov 2026)

**Goal, in order:** more people playing → more coming back → feedback that
makes the game better → fans who bring friends.

The server is a tool for the GAME, not a second home. Every channel either
gets someone to play, gets them to come back, or gets their feedback in.

## 1. The server (built by scripts/discord, read its README)
| Section | Channels | Why |
|---|---|---|
| 👋 START HERE | #welcome, #rules, #announcements, #updates | One screen, play link first. #updates posts every new update by itself. |
| ⚽ PLAY | #play-now, #my-career, #goal-of-the-week, #tierlists, #draft-and-daily | Sharing what you did in the game is the #1 reason people talk, and every post is an ad to the others. |
| 💬 COMMUNITY | #general, #introduce-yourself, #football-talk, #memes | Real football talk keeps people in the server between updates. |
| 🛠️ HELP BUILD THE GAME | #suggestions (forum), #bug-reports (forum), #playtesters (role only) | One post per idea/bug, 👍 to vote. Playtesters see updates first. |
| 🏆 EVENTS | #events, #weekly-challenge, Matchday Live (voice) | A reason to come back every week. |
| 🔒 TEAM | #team-chat, #mod-log | Us only. |

Roles: Knowitball Team, Moderator, Playtester, Creator; picked by players on
joining: games (career / tierlists / draft) and pings (updates / events /
daily). Onboarding asks two questions, nothing else (short = more stay).
Start small: Discord's own advice is to add channels only when people ask.

## 2. Getting people IN (the part that grows player numbers)
1. **Buttons where players already are** (built, appear once the invite is
   set): site footer, game Settings. Next: after a match, the end of a season,
   the patch notes page.
2. **Bio and every video**: TikTok/Instagram/YouTube bios and the end card of
   every short say "Discord in bio". Our Publish tool posts the videos.
3. **List the server**: Disboard, Discord's Server Discovery (needs Community,
   and later 1,000 members), top.gg servers. Free.
4. **Football communities**: post careers/tierlists on r/FootballManagerGames,
   r/soccer meme days, r/FIFA-style subs with the Discord link (follow each
   sub's rules).
5. **Creators**: give 5–10 small football YouTubers/TikTokers the Creator role
   and a #my-career spotlight in return for playing on stream.

## 3. Getting people to PLAY (Discord → game)
- Every post we make ends with ▶ Play now.
- **Weekly challenge** (e.g. "win the league with a League Two club"):
  screenshot as proof, winner named in the next update. Ping: Event pings.
- **Goal of the week** from #goal-of-the-week, reposted on our socials.
- **Daily grid ping** for the Daily challenge pings role.
- Later: **link your account** → a role with your career level / Ballon d'Or
  count (needs a small Discord login on the site; plan only).

## 4. Feedback loop (why players stay)
- Forum posts: one per idea/bug; we tag each **Planned / In the game / Not
  doing** and reply. When it ships, #updates names who asked for it.
- Playtesters get a first look and their names in patch notes.
- A monthly 30-minute dev Q&A in Matchday Live.

## 5. Rules for us
- Never @everyone from a bot; pings go to the opt-in roles.
- Invite rewards (prizes for bringing people) are against Discord's rules in
  many forms: don't run them. Giveaways for playing are fine.
- Keep it safe for young fans: AutoMod on (slurs, links in #general), verified
  email to talk.
- Measure: Server Insights (where joins come from) and PostHog
  `discord_click` (which button sent them).

## Week one
| Day | Do |
|---|---|
| 1 | Leo makes the server + bot; a chat runs the setup; invite + webhook into Vercel |
| 1 | Post the invite in every bio; pin a welcome in #general |
| 2 | First weekly challenge; ask the team's friends to join and post a career |
| 3–7 | One post a day in #my-career from us; reply to every bug/idea within a day |
| 7 | Apply to Disboard + top.gg; first Goal of the week |
