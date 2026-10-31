# Football Twitter: research note (31 Oct 2026)

For Leo's ask: make the in-game feed read like real football Twitter/X, with
invented accounts only. Built behind Leo's update switch, part
**"Football Twitter feed"** (`footballTwitter`).

## How it was researched

- Two web searches (slang, engagement benchmarks). They turned up little
  that is current and reliable: a 2022 *When Saturday Comes* piece on
  "ratio" and reply culture, a Zikoko explainer on "FT" and "hold this L",
  and vendor blogs with X engagement benchmarks that disagree with each
  other (sports teams' median engagement ~0.07% of followers per post;
  smaller accounts much higher per follower).
- The rest is from knowledge of how football X reads in 2024–26. It is
  **reasoned, not measured**: no live account was read for this build.

Sources: [WSC: Reply guys](https://www.wsc.co.uk/stories/reply-guys-from-ratios-to-pessi-inside-the-baffling-world-of-football-twitter/),
[Zikoko on football Twitter slang](https://www.zikoko.com/?p=279416),
[Apaya X benchmarks](https://apaya.com/blog/social-media-benchmarks-x-twitter),
[SocialRails engagement calculator](https://socialrails.com/free-tools/twitter-engagement-benchmark-calculator).

## The account types (all invented in the game)

| Type | In the game | What it posts | Its words |
|---|---|---|---|
| Transfer insider | Diego Ferrante @DiegoFerranteHQ | deals at each stage: "verbal agreement", "medical booked", "done" | his own sign-off "SEALED AND STAMPED ✍️🔒" (not the real "here we go") |
| TV breaking-news desk | SportsDesk @SportsDeskTV (gold tick) | BREAKING, results, sackings, trophies | "BREAKING:", "🚨", "More on SportsDesk News 📺" |
| Live-scores app | ScoreBuzz @ScoreBuzzApp (gold) | score cards | "FT \| Home 2-1 Away", "⚽️ Name 89'", "GOAL \|" |
| Copy-paste news page | Transfer SZN @TransferSZN_ | re-posts others' news | "🚨🚨\|", "(via @…)", "Thoughts? 👇" |
| Journalist who quote-posts | Tom Barrowcliffe | measured lines, quotes other posts | "Understand…", "Worth saying:", "Told you in August." |
| Tier-5 ITK | ITK \| Inside The Boot Room | made-up exclusives | "🚨 EXCLUSIVE", "Sources tell me", "Trust the process 🤫" |
| The agent | Vincenzo Rocca | cryptic one-liners about his client | "Respect my client.", "New chapter. 🤝" |
| Gossip page | Pitchside Gossip | off-pitch nights, houses, suits | "spotted 👀", "the tea is HOT 🍿" |
| Shouty fan channel | Big Dave Unleashed (YouTube) | furious caps, streams | "I'M NOT HAVING IT", "BOTTLE JOB", "STREAM IS LIVE NOW" |
| Ratio / hater page | Ratio FC | dunks on bad days | "ratio + L + 0-3", "the disrespect 😭", "cooked", "fraud watch 🚨", "who's telling them" |
| Meme page | Footy Meme Lab | captions, "tag yourself" lists, emoji pictures | "me after X scores one goal:", "absolute cinema", "🚪 open ×4" |
| Ball-knowledge quiz page | Ball Knowledge HQ | quizzes, polls, "name a better…" | "ball knowledge check 🧠", "wrong answers only 👇", "Rate X's game 👇" |
| Hype page | He's HIM | worship after good days | "he's HIM", "different breed", "levels 🥶", "that's the tweet." |
| Video edits (TikTok) | kai edits | goal edits with music | "sound on 🎧", "#fyp", "aura" |
| Goal clips account | Clipped FC | the goal video | "WHAT A GOAL FROM…", "Watch this. 🚀" |
| Your club's fan channel | {Club} Fan TV | live reaction streams | "FULL REACTION LIVE NOW 📺", "FANS ARE FUMING" |
| Woman away-day fan | Anna \| Away End | travel, songs, the away end | lower case, "4 hours on a train for this" |
| Woman analyst fan | Priya \| Reads The Game | movement, structure | "Watch it back.", "I said what I said." |
| Kid's account | JJ ⚽ (U12s) | pure joy | caps, "my dad says", "im getting his shirt for christmas" |
| Rival banter account | {Rival} Banter | your bad days only | "same old…", "rent free", "stay humble lads 🤡" |
| Neutral | Nige (neutral) | chaos | "no dog in this fight", "just here for the chaos 🍿" |
| Groundhopper | Gav \| 412 grounds | lower-league trips | "ground number 431", "pie 7/10" |
| xG nerd | xG Whisperer | xG scorelines | "xG: 1.82 – 0.48", "regression is coming" |
| Facts account | Footy Facts Daily | records and runs | "Just a reminder that…", "Fact:" |
| Fantasy account | The Fantasy Gaffer | captaincy, returns, blanks | "differential alert", "green arrow 📈", "©️" |
| Hot-take account | Hot Take Hal | contrarian takes | "Unpopular opinion:", "Hot take:", "Say it with your chest." |
| Tactics threads | The Inverted Full-Back | threads | "🧵 Thread: … 1/7", "Half-spaces, people." |
| Grumpy ex-pro | Ray Hollinsworth | "in my day" | "Simple as that.", "Basics." |
| VAR moaners | VAR Watch | decisions | "Check complete ✅", "Clear and obvious?" |
| Podcast | Two Lads, One Ball | episode plugs | "NEW EP OUT NOW 🎙️", "link in bio" |
| Nostalgia page | Footy Nostalgia | "where were you" | "this will age well 📼", "simpler times 🥲" |
| Wonderkid scout | Wonderkid Radar | debuts and kids | "💎 alert", "remember the name" |
| Odds account (18+) | PricedUp (gold) | prices moving | "was 10/1, now 4/1", "18+ \| Play it safe" |
| Club accounts | the game's clubs (gold tick) | a cheeky admin about a third of the time | "that's it. that's the tweet.", "ours. 🤫", "the admin needs a lie down." |
| Reply guys | 12 small accounts | only in replies | "who's telling him", "deleted?", "ratio", "big if true" |

Five old accounts whose names were close to real people or outlets get
invented ones with the switch on (Marco Bellandi, Declan Furey, Numbers FC,
The Data Room, Neil Bramwell), and the one old insider line that ended
"Here we go." says "Deal done ✅".

## How posting behaves on real football X (what the code copies)

- **Big moments trend; small ones don't travel.** A hat-trick or a sacking
  gets every type posting within an hour; a 1-0 gets the scores app and fans.
- **Haters show up for bad days.** Ratio pages and rival fans post far more
  after a loss, a miss or a poor game; hype pages and kids after goals.
- **Quote-posting is the main way news spreads.** Journalists add a line to
  news; hype and quiz pages quote the goal video; ratio pages quote the club's
  post after a defeat.
- **Replies are short and repetitive**: "ratio", "who's telling him",
  "deleted?", "W", emoji walls. Hot takes get "ratioed" (more replies than
  likes would suggest).
- **Typing habits are identity**: lower case for fans and edit pages, CAPS for
  ranters and the kid, clean sentences for the journalist and stats, emoji
  habits per account.

## Engagement (the numbers on each post)

- **Reach** is a share of followers that shrinks as an account grows: about
  90% of a tiny account's followers see a post, 3–5% of a 5M account's.
- **Viral roll**: usually about ×1, with a long tail (log-normal); about half of
  the posts that roll high snowball a further ×2–6. Importance ≥ 80 gets ×1.5.
- **Ratios** (per post): views ≫ likes (1–6% of views) ≫ reposts (5–30% of
  likes) ≥ quotes (8–25% of reposts). Hot-take accounts get 2.5–5.5× replies
  and 2.5× quotes. Posts about you get ×1.5 views; videos ×1.4.

## The feed order ("For you")

Score = engagement on a log scale (likes, reposts, replies, quotes) × 1.6 if
about you × 1.15 if your club's news, divided by age counted from the newest
post shown (a fifth of its pull after a day, a fortieth after a week). Then
variety: never three in a row from one kind of account. Your match's
highlights still go in places 3–6 (Leo's earlier rule).
