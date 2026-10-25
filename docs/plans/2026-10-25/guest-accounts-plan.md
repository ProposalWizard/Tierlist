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
2. **One button.** "Start my career →". No form, no Google.
3. **Straight into the game.** They skip the set-up screen. A ready-made
   16-year-old striker (from the ad) walks into his trial.
4. **From the game itself.** Someone who opens `/star-dev` signed out sees
   "Play now — no sign-up" above the "Sign in" button.
5. **Save your career.** After their first match, a card says "Save your
   career" with a "Save with Google" button. "Later" closes it. It comes back
   once more, after their first season.
6. **One tap with Google.** Google asks which account. They come back to the
   same career. They then pick a username, like any new account.
7. **Google account already used?** The card says "That Google account is
   taken" and offers "Sign in to that account". Their guest career moves into
   a free save slot on that account.

Pictures: the test page `/star-guest-dev` shows both landing pages and all
three versions of the card at phone size.

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
5. **Bot check (strongly advised before any ad money):** make a free
   Cloudflare Turnstile widget. Put its site key in Vercel as
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Put its secret key in Supabase →
   Authentication → Attack Protection → "Enable Captcha protection"
   (provider: Turnstile).
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
| **Clearing the browser** | A guest who clears their browser data loses the login, so they lose the career. This is why the card asks them to save after the first match. |

**Keeping guests out — the three layers:**

1. **Database rules** (the SQL, part 1). Every table a player can write to
   directly gets an extra rule: "and not a guest". Covers tierlists, likes,
   tic-tac-toe, draft rooms and leaderboards, profile pictures and usernames,
   the Team room, admin content, the gem wallet and the casino. Guests keep
   their own career saves, Hall of Fame and shared career links. Things
   signed-out visitors can already do (vote, feedback) stay open.
2. **Server checks.** Some server routes use the master key, which skips
   database rules. Guests are now refused on: making a tierlist
   (`/api/tierlists`, `/api/tierlist/save`), choosing a username
   (`/api/profile`), buying with gems and the wallet (`/api/star/wallet`,
   `/api/star/wallet/buy`), tester codes (`/api/tester/claim`).
3. **Pages.** The site's middleware treats a guest as signed out for
   `/tierlist` and `/create`, never sends a guest to "choose a username", and
   the top menu still shows "Sign in".

**Already safe, checked:** the admin pages and the Team room check
`user_roles.is_admin` (a guest is never an admin). The career save route
works for guests on purpose.

**Still to check before guests are on for long (follow-up):** about 90
server routes read the signed-in user. The six above are the risky ones. The
rest (draft records, objectives, XP, blind rankings, tic-tac-toe) should get
the same one-line guest check in a follow-up pass, route by route.

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
  `lib/guest/campaignCareer.ts` (the ready-made player).
- **Ad campaigns as data:** `lib/campaigns.ts`, two examples:
  `league-two-striker` (TikTok) and `wonderkid` (Instagram). A new ad = a new
  entry there.
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
  account".
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

## 10. Open questions

1. **Guests WITH a save:** keep them forever, or delete after, say, 180 idle
   days? Today the tidy never deletes a guest who has a save.
2. **The ready-made player's name:** fixed per ad (Jay Carter, Leon Hart), or
   let the player type a name on the landing page (one more step)?
3. **"League Two" in the ad:** the trial still decides the club, so a great
   trial can bring a bigger club. Should the ad's career be steered to a
   League Two club? That is a change to the trial offers.
4. **When the card shows:** after the first match and the first season. More
   often? A small "Guest" badge on the home screen as well?
5. **Old UI:** guests work in the New UI (the default). The frozen Old UI
   shows its own sign-in screen. Leave it?
