# Harry's feedback on the Supabase / Cloudflare / Team room pages (25 Oct 2026)

Summary of his message, his words in quotes. Closing line: "Make all those updates needed."

## Split the pages
- One "Supabase explained" page on its own, separate from Supabase + Cloudflare. A separate "Cloudflare explained" page too.

## Supabase page: explain more, simply, WHY each thing is useful
- Live updates: he assumes these could power online multiplayer modes.
- Timed jobs: which ones would help Road to Ballon d'Or. Draft rooms are irrelevant; focus is RtBd.
- Small servers (edge functions): "should be elite for messaging just the Claude bots in the channels".
- Job queue: does it mean a joint to-do list, or a team Claude channel where you say "Upload 500 player faces" as a queue?
- Search by meaning: easier explanation of where and why.
- Row rules: what they are and why useful.
- Free plan computer: what it means and why it matters.
- Live-update fan-out ("past 3,000 ... broadcast"): explain more.
- Sentry: explain what it is.

## Decisions he made
- FIFA stats shrink: do it, 100%. Drop indexes nobody uses.
- Nightly draft-room tidy: "sounds fine".
- Looking inside career saves: useful, to find bugs and compare against normal games.
- Create a bug-fixing skill that uses Supabase as a layer.
- The two login checks "obviously need to be dealt with". Missing indexes "sound cool".
- Stay on the free plan. He likes daily backups, logs and point-in-time restore.
- Morning health check / daily health channel: wanted. Weekly health post: wanted.
- Anonymous guest accounts that upgrade later: "massive, massive idea that needs to be applied". Also custom landing pages and custom accounts straight from TikTok/Instagram ads.

## Move to the Team room + bots page
- Everything from the Supabase page useful for the Team room and bots, including the connectors channel and /show.
- Bug reports: a new bug-report row -> notification into a bugs channel in the Team room. Wanted.
- Connectors channel: he dislikes static cards. A channel where any of the three can talk to any connector through its own bot ("Tell me what is happening on Supabase", "Push to Vercel").
- Feedback on each other's patch notes via bots: a drag-a-box comment on artifacts in the admin pages, then "@Leo bot / @Mikey bot / @Harry bot / @claude analyse my changes and push them to Leo's Claude" or "have Leo bot look over the changes". List other uses.
- Notifications: phone notifications for EVERY message, not just @mentions, optional per chat with an on/off toggle. Desktop pop-ups on Mac/PC like WhatsApp. Phone notifications are already set up.
- Higgsfield is NOT parked: it's on/off around credits. Each connector should report which account is connected and how many credits. Connectors differ per person.
