# Guest accounts and ad landing pages — plan

25 Oct 2026. For Harry. Built on a branch, switched OFF.

Harry: guest accounts that upgrade later are "a massive, massive idea that
needs to be applied", plus "custom landing pages and custom accounts straight
from TikTok/Instagram ads".

## 1. In one line

A player taps one button and plays Road to Ballon d'Or straight away, with no
sign-in. Their career saves like a real one. Later, one tap with Google keeps
it forever.

## 2. What the player sees

1. **From an ad.** They tap a TikTok or Instagram ad. They land on a page made
   for that ad, for example `knowitball.co.uk/play/league-two-striker`.
2. **Their name, one button.** The page shows the ad's player with his name
   filled in (for example Jay Carter). They can type their own first and last
   name (20 letters each at most, neither blank). Then "Start my career →".
   No Google. An invisible human check (Turnstile) runs on the tap.
3. **Straight into the game.** They skip the set-up screen. Their 16-year-old
   striker walks into his trial. An ad can set a **start point**: the
   League Two ad's trial always ends with a League Two club.
4. **From the game itself.** Someone who opens `/star-dev` signed out sees
   "Play now — no sign-up" above the "Sign in" button.
5. **Save your career.** For the first 6 days: after their first match, a card
   says "Save your career" with a "Save with Google" button. "Later" closes
   it. It comes back once more, after their first season. **From day 7** of the
   guest account, the card shows **once a day**, the first time they open the
   game that day, with a small "Guest · day N" note, until they save. No
   lock-out: "Tomorrow" closes it.
6. **One tap with Google.** Google asks which account. They come back to the
   same career. They then pick a username, like any new account.
7. **Google account already used?** The card says "That Google account is
   taken" and offers "Sign in to that account". Their guest career moves into
   a free save slot on that account.

Pictures: the test page `/star-guest-dev` shows both landing pages, all
four versions of the card and each ad's first club, at phone size.

## 3. How it works (plain words)

- A **guest** is a hidden Supabase account. Supabase calls it an "anonymous
  sign-in". It has a user id like any account, but no email.
- The game already saves every career against the user id (the
  `star_careers` table, one row per save slot). A guest's id works the same
  way. **No change to how careers save.**
- "Save with Google" uses Supabase's **link identity**. It adds Google to the
  same account. The user id does not change, so every save, Hall of Fame entry
  and XP row stays where it is. Nothing is copied.
- The ad's name and its tracking words (the `utm_…` part of the link) are put
  on the account when it is made. A database trigger copies them into a new
  table, `account_campaigns`. PostHog gets them too.

## 4. The switch

One switch: `NEXT_PUBLIC_GUEST_ACCOUNTS=on` in Vercel.

- **Unset (today):** the site works exactly as now. No "Play now" button. The
  `/play/<name>` links go to the tierlist page, exactly as any unknown
  `/play/` link does today. No card. I checked this in a local run
  (section 9).
- **On:** everything in section 2.

It is read when the site is built, so Vercel needs a redeploy after a change.

## 5. Steps to go live (in order)

1. **Run the SQL.** `supabase/migrations/guest_accounts.sql` in the Supabase
   SQL Editor. It keeps guests out of the wrong tables, adds the campaign
   table and the nightly tidy. It changes nothing while there are no guests.
2. **Supabase → Authentication → Sign In / Providers:** switch on
   **"Allow anonymous sign-ins"**.
3. **Supabase → Authentication → Sign In / Providers:** switch on
   **"Allow manual linking"**. "Save with Google" needs it.
4. **Supabase → Database → Extensions:** switch on **pg_cron** (for the
   nightly tidy). Do this before step 1, or run step 1 again after.
5. **The human check: Cloudflare Turnstile** (Harry: "let's make the
   turnstile a human check"; do it before any ad money). Free. Never paste
   either key into a chat. In this order:
   1. **Cloudflare dashboard** (dash.cloudflare.com, sign in or make a free
      account) → **Turnstile** in the left menu → **Add widget**.
   2. **Widget name:** `Knowitball guests`.
   3. **Hostnames:** add `knowitball.co.uk`. Add `www.knowitball.co.uk` too
      if the site answers on www. (Add `localhost` only if you want to test
      it on a computer.)
   4. **Widget mode:** **Managed** (Cloudflare decides; most players see
      nothing). **Invisible** also works. Not "Non-interactive".
   5. **Create.** Cloudflare shows two keys: a **site key** (public) and a
      **secret key** (private).
   6. **Vercel** → the Knowitball project → Settings → Environment Variables
      → add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the **site key**, for
      Production (and Preview if wanted). **Redeploy.** Check: `/star-guest-dev`
      now says "Bot check (Turnstile): Set up".
   7. **Only after that redeploy is live:** **Supabase** → Authentication →
      **Bot and abuse protection** (older name: Attack Protection) → switch
      on **captcha protection** → provider **Turnstile** → paste the **secret
      key** → Save.
   Why the order: once Supabase's switch is on, every guest sign-up AND every
   email sign-in must carry a Turnstile token. The site sends one only when it
   has the site key. Google sign-in needs no token, so it is never affected.
   With no site key the site behaves exactly as today (no widget).
6. **Vercel:** set `NEXT_PUBLIC_GUEST_ACCOUNTS=on` and redeploy.
7. **Test on a phone:** open `/play/league-two-striker`, play one match, tap
   "Save with Google".

To switch off again: remove the Vercel variable and redeploy. Existing guests
keep their accounts; they simply see no new guest features.

## 6. Risks and what handles each

| Risk | What handles it |
|------|-----------------|
| **Bots making thousands of guests** | The guest is made only when someone TAPS the button, never on page load. Turnstile (step 5) checks for robots. Supabase also limits new anonymous sign-ins to 30 an hour per IP address by default. |
| **Guest accounts piling up** | Nightly tidy at 03:17 UTC: deletes guests idle 30+ days who have **no career save** and nothing in the gem wallet. At most 5,000 a night. The campaign row stays, so the ad numbers survive. |
| **A guest gets into places meant for real accounts** | A guest is a real signed-in user to Supabase (role `authenticated`, with `is_anonymous` in its login token). Any rule that says "any signed-in user may…" would let a guest in. Handled three ways, below. |
| **A guest pays real money, then is tidied away** | Guests cannot buy: the shop treats them as signed out. The tidy also skips anyone with a gem wallet. |
| **Losing a career on upgrade** | Link identity keeps the same user id: no copy, nothing to lose. The one exception (Google account already used) moves the career into an EMPTY slot only; never over a save. |
| **Clearing the browser** | A guest who clears their browser data loses the login, so they lose the career. This is why the card asks them to save after the first match, and every day from day 7. |
| **Guests with a save piling up** | Kept, on purpose (Harry). Each is one save row. From day 7 the card asks them every day to save with Google. Watch the database size (section 7). |

**Keeping guests out — the three layers:**

1. **Database rules** (the SQL, part 1). Every table a player can write to
   directly gets an extra rule: "and not a guest". Covers tierlists, likes,
   tic-tac-toe, draft rooms and leaderboards, profile pictures and usernames,
   the Team room, admin content, the gem wallet and the casino, and (added
   25 Oct, Harry's answer 5) XP, objectives, stats, season rewards, the
   team's test-tool tables and the football data tables. Guests keep their
   own career saves, Hall of Fame and shared career links. Things signed-out
   visitors can already do (vote, feedback) stay open.
2. **Server checks.** Some server routes use the master key, which skips
   database rules. Every server route that reads the signed-in user was
   gone through, one by one: the full table is section 11. In short: the
   career routes let a guest in; 45 more routes now treat a guest as signed
   out (`notGuest`, lib/guest/config.ts); the admin and tester routes already
   refuse a guest.
3. **Pages.** The site's middleware treats a guest as signed out for
   `/tierlist` and `/create`, never sends a guest to "choose a username", and
   the top menu still shows "Sign in".

**Already safe, checked:** the admin pages and the Team room check
`user_roles.is_admin` (a guest is never an admin). The career save route
works for guests on purpose.

**Done 25 Oct (was a follow-up):** every route that reads the signed-in user
(130 of the 160 routes ask directly; 8 more ask through an admin helper) is
in the table in section 11.

## 7. Costs

- **Supabase free plan: 50,000 monthly active users, and guests count.** A
  guest counts once in any month they play. 10,000 ad clicks a month that
  start a career ≈ 10,000 of the 50,000.
- **Database size** is the tighter limit: about 120 MB headroom today. A guest
  with a saved career adds one save row (the same size as a real player's).
  Guests with no save are tidied nightly.
- Turnstile is free. PostHog's free tier covers the extra events.
- The Pro plan ($25 a month) raises active users to 100,000.

## 8. What is built (all behind the switch)

- **The switch and guest helpers:** `lib/guest/config.ts`, `lib/guest/start.ts`
  (start a guest, "Save with Google", sign in to an existing account),
  `lib/guest/captcha.ts` (Turnstile), `lib/guest/moveSaves.ts`,
  `lib/guest/campaignCareer.ts` (the ready-made player, with the typed name),
  `lib/guest/promptSchedule.ts` (when the card shows: the two moments, then
  daily from day 7).
- **Ad campaigns as data:** `lib/campaigns.ts`, two examples:
  `league-two-striker` (TikTok) and `wonderkid` (Instagram). A new ad = a new
  entry there. Two options per ad: `lockName: true` fixes the player's name
  (neither example uses it); `startLeague` sets the start point
  (`league-two-striker` uses `"league_two"`).
- **Start point:** `TrialProgress.startDivision` (lib/star/trial.ts, a new
  optional field) and `scoutedOfferForTrial` (lib/star/scoutedPlacement.ts):
  with a start point, the trial's one offer is a club from that division,
  seeded off the trial as before (a reload lands at the same club). Without
  one, the same club as before, checked for 3,000 trials.
- **Turnstile:** `lib/guest/captcha.ts`, used by guest sign-up and by the
  email sign-in form (`components/AuthForm.tsx`).
- **Server routes:** `notGuest` (lib/guest/config.ts) in 45 routes, section 11.
- **Landing page:** `/play/<name>`. The middleware sends it to
  `app/campaign/[campaign]`. Tierlists already live at `/play/<id>`; only a
  name from the campaign list is sent to the landing page, so tierlists are
  untouched.
- **The card:** `components/guest/GuestSavePrompt.tsx`. The "Play now" button:
  `components/guest/GuestPlayButton.tsx`.
- **The game page** (`app/star-dev/page.tsx`, shared file): five small
  additions, no rewrites. The "Play now" button on the sign-in screen; the
  card in the home shell; the ad's ready-made career when there is no career;
  skip the title screen for it; move a guest's saves after "Sign in to that
  account". 25 Oct: `handleProfileComplete` takes one optional extra value
  (the start point), put on the new trial; nothing else changed there.
- **Google's return:** `app/auth/callback/route.ts` sends a refused link back
  to the game with `?guest_link=taken`.
- **Test page:** `/star-guest-dev` (team only), with the eye guide.
- **PostHog events:** `campaign_landing_viewed`, `campaign_play_clicked`,
  `guest_started`, `guest_start_failed`, `guest_upgrade_clicked`,
  `guest_prompt_later`, `guest_signin_existing`, `guest_upgraded`. The guest
  is identified by user id, so the same person carries on after upgrading.

## 9. Checked

- Type check, one-engine guard and admin-look guard pass. Lint on the
  touched files shows no new problems. (`npm run lint` itself is not set up
  in the repo: it asks how to configure ESLint.)
- A local run with the switch ON: both landing pages, the "Start your
  career" screen and all three versions of the card, at phone size
  (390 × 844). Seen by eye.
- A local run with the switch OFF: `/star-dev` shows the same "Sign in to
  play" screen as today. `/play/league-two-striker` is not sent to the landing
  page; it goes to the tierlist page as before. `/campaign/...` is a 404.
- **Not checked:** making a real guest, and "Save with Google". The local
  build talks to the LIVE Supabase, so pressing "Play now" would make a real
  account there. Nothing was pressed. Both need steps 2 and 3, which only
  Harry can switch on. The SQL has not been run anywhere, not even locally.

**Second pass (25 Oct, Harry's five answers):**

- `tests/star/guestCampaign.mts` (new, passes): 3,000 League Two ad trials
  all get a League Two club, every one of the 24 clubs can come up, a reload
  lands at the same club, and the career that follows is a real 24-club,
  46-game League Two season in the FA Cup. 3,000 trials WITHOUT a start point
  get exactly the club they got before. Names and the card's schedule (days
  0 to 6, then daily from day 7) are checked there too.
  `scoutedPlacement`, `scoutOffers`, `trialOffers`, the trial and signing
  tests still pass.
- The real game page, seen by eye, in a local development run (the dev
  build's local-only career, no account made): the League Two ad's note with
  the name "Sam Okafor" → straight into the trial → "Sim whole trial" (the
  team's test button) → "A scout has spotted you: Salford City, League Two",
  "Sam. There is something…". Found and fixed on the way: React runs the
  game's start-up load twice in development, and the second load blanked the
  ad's new career; the page now starts it again (one `useRef`).
- Pictures at 390 × 844, seen by eye: the landing page with the name field
  (as filled in, typed, and blank with its message), the day-9 daily card,
  each ad's first club.
- Type check, both guards, and lint on the touched files: no new problems.

## 10. Decided (Harry, 25 Oct 2026) and still open

Decided, and built:

1. **Turnstile is the human check** ("let's make the turnstile a human
   check"). Guest sign-up and the email sign-in form. Steps: section 5.
2. **Guests with a save are kept.** "We should have a max amount of days
   before they have to sign in or get prompted every day, maybe 7 days."
   From day 7 the card shows once a day. No lock-out.
3. **Names:** "unless it's a very specific reason to keep the name the same,
   I think always let them have it." The landing page has a name field.
   `lockName` exists for the special case; no ad uses it.
4. **Start point:** "If it's a league two ad, we could have a custom start
   point. Why not?" `startLeague`; the League Two ad uses it.
5. **The route pass:** "5 seems right. We need to do that." Section 11.

Still open:

1. **Old UI:** guests work in the New UI (the default). The frozen Old UI
   shows its own sign-in screen, and its trial ignores the start point (it is
   frozen; never edited). Leave it?
2. **The feedback / bug form** has no human check. It writes straight to the
   `feedback` table from the browser (signed-out visitors can too), so a
   Turnstile token there would only mean something with a new server route
   that checks it AND closing the table's open insert rule. Not done: a
   separate small job if spam shows up.
3. **A guest on the tierlist pages:** the routes treat a guest as signed out
   (no likes, no saves, no blind rankings), but some of those pages ask the
   browser who is signed in and may still show a Like button that then
   fails. Harmless; a guest only exists after starting a career.

## 11. Every server route that reads the signed-in user (25 Oct 2026)

160 routes in `app/api`; 130 read the signed-in user directly, 8 more
through an admin helper. "Guest allowed?":
**Yes** = a guest is treated like any signed-in player. **No (signed out)** =
`notGuest(...)` (lib/guest/config.ts) makes the route see a guest as signed
out, so it answers exactly as it does for a visitor with no account (401,
an empty list, or `{ signedOut: true }`). **No (already)** = the route was
already refusing a guest. With guests switched off nobody is a guest, so
none of this changes anything.

| Route | Guest allowed? | Why |
|-------|----------------|-----|
| `/api/star/career` (GET, POST, DELETE) | **Yes** | The career save. This is the whole point of a guest. |
| `/api/star/hall-of-fame` (GET, POST, DELETE) | **Yes** | Career-related, per-user: retired careers. |
| `/api/star/legend` (POST), `/api/star/legend/[code]` (DELETE) | **Yes** | Share a retired career by link, and take the link down. Per-user, harmless. |
| `/api/vote-tierlists/[id]/vote` (POST), `/api/vote-tierlists/[id]/my-votes` (GET) | **Yes** | Signed-out visitors can vote already (one per browser). A guest votes once per account, the same weight. Treating a guest as signed out here would break voting for them (the page sends no browser id when someone is signed in). |
| `/api/profile/admin-check` (GET) | **Yes** | Answers "admin? tester?". For a guest both are false. |
| `/api/tierlists/[id]` (DELETE) | **Yes** (harmless) | Owner or admin only; a guest owns no tierlists (it cannot make one). |
| `/api/star/casino/play` (GET, POST) | **No (signed out)** | The casino is tied to the gem wallet. Signed out = the phone rolls it, as today, so the casino still works for a guest. |
| `/api/xp` (POST) | **No (signed out)** | XP (Harry's list). Starts once they save with Google. |
| `/api/stats` (POST) | **No (signed out)** | Player stats for XP and objectives. |
| `/api/objectives` (GET), `/api/objectives/check`, `/api/objectives/check-login`, `/api/objectives/[id]/claim` (POST), `/api/objectives/unclaimed-count` (GET) | **No (signed out)** | Objectives (Harry's list). GET shows the list with nothing completed; the count is 0. |
| `/api/profile/progression` (GET) | **No (signed out)** | Level and XP page. |
| `/api/profile/equip` (PUT) | **No (signed out)** | Equips XP rewards on a profile; a guest has no profile. |
| `/api/profile/images` (POST), `/api/profile/images/[id]` (DELETE) | **No (signed out)** | Profile pictures; uploads to storage. |
| `/api/profile/team-name` (GET, PUT) | **No (signed out)** | Draft team name on the profile. |
| `/api/profile` (GET, PUT) | **No (already)** | Choosing a username. A guest picks one after Google. |
| `/api/draft/history` (GET, POST), `/api/draft/records` (GET, POST) | **No (signed out)** | Draft records and leaderboards (Harry's list). |
| `/api/draft/rooms` (POST), `/api/draft/rooms/[code]` (GET, PATCH), `…/join`, `…/leave`, `…/ready`, `…/simulate`, `…/next-season`, `…/team-name`, `…/american/pick`, `…/american/stage`, `…/american/start`, `…/american/vacancies` (POST) | **No (signed out)** | Multiplayer draft rooms: community. |
| `/api/draft/american` (POST), `/api/draft/american/[code]/join`, `…/pick`, `…/start` (POST) | **No (signed out)** | American draft rooms: community. |
| `/api/draft-challenge/rooms` (POST), `/api/draft-challenge/rooms/[code]` (GET), `…/join`, `…/pick`, `…/start` (POST) | **No (signed out)** | Challenge draft rooms: community. |
| `/api/blind-rankings` (POST), `/api/blind-rankings/[id]/like` (GET, POST) | **No (signed out)** | Blind rankings (Harry's list): making one and likes. |
| `/api/tictactoe` (POST), `/api/tictactoe/[id]/score` (GET, POST), `/api/tictactoe/[id]/difficulty-rating` (GET, POST) | **No (signed out)** | Tic-tac-toe (Harry's list): puzzles, scores, ratings. |
| `/api/tierlist/[topic]` (GET) | **No (signed out)** | Your own rankings on a topic; needs a real account. |
| `/api/tierlists/[id]/like` (GET, POST), `/api/tierlists/[id]/save` (GET, POST), `/api/vote-tierlists/[id]/like` (GET, POST) | **No (signed out)** | Community likes and saved tierlists. |
| `/api/tierlists` (POST), `/api/tierlist/save` (POST) | **No (already)** | Making a tierlist. |
| `/api/star/wallet` (GET), `/api/star/wallet/buy` (POST) | **No (already)** | Gems and the shop's paid items. |
| `/api/tester/claim` (POST) | **No (already)** | Tester codes. |
| `/api/dev-recordings` (POST), `/api/star/lag-runs` (POST) | **No (already)** | Testers and admins only (`roleOf` / `isTester`); a guest is a "player". |
| `/api/star/corrections`, `/api/star/cutscene-edits` (+ `/commit`), `/api/star/lineups` (POST), `/api/star/real-moment-picks` (+ `/commit`), `/api/star/scenarios` (+ `/commit`), `/api/star/sfx-overrides`, `/api/star/star-pass` (POST), `/api/star/training-levels` (+ `/commit`), `/api/star/tuning-notes` (GET), `/api/star/xp-config` (POST) | **No (already)** | Team tools: `isAdmin`. A guest is never an admin. (Their open GETs and the tuning-notes POST do not read the user.) |
| `/api/draft/debug`, `/api/draft/rooms/[code]/dev-skip`, `/api/draft/rooms/[code]/dev-skip-career` | **No (already)** | Admin only. |
| Every `/api/admin/**` route that reads the user directly (52): blind-rankings (5), card-library, categories/[id], category-settings, custom-clubs (2), export, feedback, football (13), live-share, marketing/board, objectives (2), season-rewards, team (3), tenable (2), testers, tictactoe (2), tierlists (5), upload-image, vote-tierlists (6), wallet/grant, xp/rewards | **No (already)** | Each checks `isAdmin` (user_roles.is_admin). The other `/api/admin/**` routes check admin through a helper (`requireAdmin` for patch notes, `getCaller` for marketing media/upload/studio), or are local-dev only (live-share files). |

**The database rules match.** `supabase/migrations/guest_accounts.sql`
(NOT run) puts a "no guest" rule on every table these routes write for a
player, and the tables a guest can reach straight from the browser. Added on
25 Oct: `user_xp`, `xp_events`, `user_objectives`, `user_stats`,
`user_rewards`, `rewards`, `season_config`, `season_level_rewards`,
`star_tuning_notes`, `star_scenario_corrections`, `star_real_moments_picks`,
`sofifa_players`, `football_players`, `league_logos`, `nationality_flags`.
Left open on purpose: `star_careers`, `star_hall_of_fame`,
`star_legend_shares` (the career), `vote_tierlist_votes` and `feedback`
(anyone can already).
