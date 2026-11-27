# The posting tool: how it was set up, and how to give Knowitball its own

Mikey, 23 Nov 2026: "create a step by step plan without any missing information on exactly what someone could do
to replicate exactly what we've done … a working version of the same thing that I have but for Knowitball videos
linked to all the Knowitball accounts", while Mikey keeps his own personal one.

- **Part 1:** what the tool is.
- **Part 2:** how to set up one copy from scratch, in the order that works, with every trap we hit.
- **Part 3:** the plan for a second, shared **Knowitball** copy next to Mikey's personal one.
- **Part 4:** everyday use.
- **Part 5:** when something goes wrong.

---

## Part 1. What it is (as built, 20–23 Nov 2026)

| Piece | Where | What it does |
|---|---|---|
| Publish page | knowitball.co.uk → Admin → Marketing → **Publish** | Connect accounts, upload a video, post now or later, see each post's status and numbers |
| The queue | Supabase tables `publish_posts`, `publish_accounts` | Posts waiting / done, and the saved (locked) logins |
| The timer | Supabase pg_cron job `publish-tick`, every 5 minutes | Posts anything due, finishes Instagram/Facebook processing, re-reads numbers every 3 hours for 30 days |
| Video storage | Cloudflare R2 bucket (Mikey's own: `PUBLISH_R2_*` keys) | Holds the video files. Each app is given a 6-hour private link to fetch it |
| Chat posting | `scripts/publish/post.mjs` | A Claude chat uploads and posts for you, and reads live numbers (`--stats`) |
| Mikey's Brain | artifact H4TN92qzcgodheJNJxs7TJ | Pick a video, approve words, "Send to Claude"; "Every post, every app" numbers |

What it posts: **Instagram Reels**, **Facebook Reels** (3–90 s) and **YouTube Shorts** (vertical, 3 min max). Nothing
else. A Short's title is 100 characters at most, hashtags included (Brain note FACT-KIB-015).

---

## Part 2. Set up one copy from scratch

Do the parts **in this order**. Each part says where to click. Keep a private note of every value you make; Vercel
hides secrets once saved.

### 2.0 Before you start
- You need logins for: Vercel (the `tierlist` project), Supabase (the project), Cloudflare, the Facebook account that
  **admins the Facebook Page**, the Instagram account, and the Google account that **owns the YouTube channel**.
- Make **three random passwords** (a password generator, 40+ letters and numbers). Name them in your notes:
  - **Secret A**: the timer's password
  - **Secret B**: the chat's password
  - **Secret C**: locks the saved logins. **Never change it** later, or every account must be connected again.
- Never paste any secret into a chat.

### 2.1 Vercel: the first keys
1. vercel.com → **Projects → tierlist → Settings → Environment Variables** (the project page, not the team page).
2. For each row below: type the **Key** exactly, paste the **Value**, tick **Production**, choose **Secret**, **Save**.

| Key | Value |
|---|---|
| `PUBLISH_TOKEN_KEY` | Secret C |
| `PUBLISH_CRON_SECRET` | Secret A |
| `PUBLISH_AGENT_TOKEN` | Secret B |
| `PUBLISH_OWNER_EMAIL` | the email the owner signs in to knowitball.co.uk with (locks the page to them). Type: Config |

### 2.2 Supabase: tables and the timer (one time)
1. Copy the file: https://github.com/proposalwizard/tierlist/blob/main/supabase/migrations/publishing.sql
2. supabase.com → the project → **SQL Editor → + New query** → paste.
3. Find `PASTE_PUBLISH_CRON_SECRET` (Ctrl+F) and replace just those words with **Secret A**, keeping the quote marks.
4. **Run**. A result like `schedule = 3` means it worked (that's the timer's number).
5. Check (optional): `select jobname, schedule from cron.job where jobname = 'publish-tick';` → one row, `*/5 * * * *`.

### 2.3 Cloudflare: video storage (about 15 minutes)
1. dash.cloudflare.com → sign up / log in → **R2 Object Storage**. If asked, **Add R2 subscription** (free up to 10 GB;
   it asks for a card but charges only above the free amounts).
2. **Create bucket** → name it in lowercase, no spaces (e.g. `mikey-videos`) → **Create**.
3. Copy the **Account ID** (32 characters, numbers and a–f, on the right of the R2 page).
4. **Manage API tokens → Create API token** → permission **Object Read & Write** → apply to **that bucket only** →
   **Create**. Copy the **Access Key ID** and the **Secret Access Key** at once: they are shown only once, and they
   are a **pair** (never mix keys from two different tokens).
5. Bucket → **Settings → CORS Policy → Add/Edit** → paste and **Save**:
   ```json
   [{"AllowedOrigins":["https://knowitball.co.uk","https://www.knowitball.co.uk"],
     "AllowedMethods":["PUT","GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]
   ```
6. Vercel (as in 2.1, **Production** only):

| Key | Value | Type |
|---|---|---|
| `PUBLISH_R2_ACCOUNT_ID` | Account ID | Config |
| `PUBLISH_R2_BUCKET` | the bucket name, exactly | Config |
| `PUBLISH_R2_ACCESS_KEY_ID` | Access Key ID | Secret |
| `PUBLISH_R2_SECRET_ACCESS_KEY` | Secret Access Key | Secret |

### 2.4 Facebook Page and Instagram (on the phone, 10 minutes)
1. Instagram app → Profile → ☰ → **Account type and tools → Switch to professional account** (Creator or Business).
2. **A Facebook Page is required.** Instagram can only be posted to through one. If there is none: facebook.com (as a
   person, not as a Page) → ☰ **Menu → Pages → Create new Page**.
3. Link them: the Page → **Settings → Linked accounts → Instagram → Connect** → log in as the Instagram account.

### 2.5 Meta app, for Facebook and Instagram (20–30 minutes)
1. Use a **private window** (Ctrl/Cmd+Shift+N), go to **developers.facebook.com/apps**, and log in as the Facebook
   **person** who admins the Page. (Meta for Developers has no log-out button; it uses whoever is logged in.)
   First time: **Continue** through Register → verify code → contact → About you: **Developer**.
2. **Create App** → name (any; it only shows on the "allow" screen) → **Use cases**: on the left pick
   **Content management**, tick **Manage everything on your Page** and **Manage messaging & content on Instagram** →
   Business: your portfolio or "I don't want to connect a business portfolio yet" → **Create app**.
3. **Use cases → (each one) → Customize → Permissions**: press **+ Add** next to each until it says
   **Ready for testing**:
   - Page: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `read_insights`, `business_management`
   - Instagram (choose **API setup with Facebook login**): `instagram_basic`, `instagram_content_publish`,
     `instagram_manage_insights`
   - **Never** press **Actions → Add to app review**, and never **Become a Tech Provider** (it cannot be undone).
4. **Facebook Login for Business → Settings → Valid OAuth Redirect URIs**: add **both**, then **Save**:
   - `https://knowitball.co.uk/api/admin/publish/callback/meta`
   - `https://www.knowitball.co.uk/api/admin/publish/callback/meta`
5. **App settings → Basic**: App domains `knowitball.co.uk`; Privacy policy URL
   `https://knowitball.co.uk/legal#privacy`; an app icon (1024×1024); a category → **Save changes**.
   Copy **App ID** and **App secret** (Show).
6. Vercel: `META_APP_ID` (Config) and `META_APP_SECRET` (Secret).
7. **Publish the app**: left menu **Publish** (it says *Unpublished*) → fix anything it lists → **Publish**.
   **Trap we hit:** while it is Unpublished, Facebook hides every Reel the app posts from everyone but the app's own
   people (our first Reel: "published" with 1 view, invisible on the Page).

### 2.6 Google, for YouTube (20 minutes)
1. console.cloud.google.com, logged in as the Google account that **owns the channel** → new project (any name).
2. Search and **Enable**: **YouTube Data API v3** and **YouTube Analytics API**.
3. **Google Auth Platform**:
   - **Branding**: app name, your support email, developer contact email → Save.
   - **Audience**: External → **Publish app** (In production). In "Testing" Google logs you out every 7 days.
   - **Clients → + Create client** → **Web application** → Authorised redirect URIs, **both**:
     - `https://knowitball.co.uk/api/admin/publish/callback/youtube`
     - `https://www.knowitball.co.uk/api/admin/publish/callback/youtube`
     → **Create**. Copy **Client ID** (ends `.apps.googleusercontent.com`) and **Client secret** (starts `GOCSPX-`).
4. Vercel: `GOOGLE_CLIENT_ID` (Config) and `GOOGLE_CLIENT_SECRET` (Secret). These are **not** the existing
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (that one is the Videos recorder's).

### 2.7 Redeploy
Vercel → **Deployments** → the row marked **Production / Current** (not a Preview row) → **⋯ → Redeploy** → wait
for **Ready**. The site only reads new keys after a redeploy. Do this after any key change.

### 2.8 Connect the accounts
1. Open **https://knowitball.co.uk/admin/marketing/publish**, signed in with the owner's email.
2. The top line lists any missing setting; fix it in Vercel and redeploy.
3. **Connect Facebook + Instagram** → on Meta's screen press **Edit settings** (not Continue) → Pages:
   **Opt in to current Pages only** → tick the Page → Instagram: tick the account → allow all → **Save → Got it**.
   Back on the page the top line should be green: "Facebook: … and Instagram: @…".
4. **Connect YouTube** → the channel's Google account → if it says "Google hasn't verified this app":
   **Advanced → Go to (app name)** → allow all three.

### 2.9 First test post
Publish page → **⬆ Upload a video** (vertical mp4, 3–90 s for Facebook) → tick all three → Title + Caption →
**Post now**. Facebook and YouTube take a minute or two; Instagram shows "processing" for a few minutes; Facebook shows
"processing" until Meta says the Reel is published. Each gets an **open** link.
- **YouTube**: until Google approves the app's audit, every upload is **private** → switch it to Public in YouTube
  Studio. To lift this, apply for the YouTube API audit from the Google Cloud project (days to weeks).

### 2.10 Let a Claude chat post and read live numbers (optional)
1. In the chat, Claude opens a secure box for host **knowitball.co.uk**: paste **Secret B**, keep **Bearer token**,
   **Save**. (It is stored on that chat's cloud setup, not in the chat. Anyone sharing that setup could post.)
2. Claude runs, from the repo:
   `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/publish/post.mjs <video> --title "…" --ig "…" --fb "…" --yt "…"`
   and `… post.mjs --stats` for live numbers (without the two settings in front, Node skips the proxy and the key
   never arrives).

---

## Part 3. A second, shared Knowitball copy next to Mikey's

### What the team gets
- On the Publish page, a switch at the top: **Mine** | **Knowitball**.
  - **Mine**: exactly what Mikey has now. Only Mikey can open it (`PUBLISH_OWNER_EMAIL`), his own storage, his
    connected accounts. Nothing about it changes.
  - **Knowitball**: Harry, Mikey and Leo can all open it. It uses the team's storage (Harry's `kib-marketing` bucket,
    the one Marketing → Uploads already uses) and the **Knowitball** Instagram, Facebook Page and YouTube channel.
- Each copy has its own connected accounts, queue, posts and numbers. A post made in one can never go to the other's
  accounts.
- Posting from a chat works for both: `post.mjs --space kib …` or `--space mine …`.

### Why it needs a code change (and how big)
Today the tool holds **one** login per app (the `publish_accounts` table keys on the app name alone), so connecting
the Knowitball Instagram would replace Mikey's. The change adds a **space** to everything:

| Step | What changes | Size |
|---|---|---|
| A | Database: `space` column on `publish_accounts` (key becomes space + app) and on `publish_posts`; existing rows become `mine`. A new migration file, run once in the SQL Editor | small |
| B | Who may use which space: `mine` → only `PUBLISH_OWNER_EMAIL`; `kib` → every admin (or a list in `PUBLISH_KIB_EMAILS`) | small |
| C | Storage per space: `mine` → `PUBLISH_R2_*`; `kib` → the team's `R2_*` | small (the split already exists) |
| D | Connect buttons carry the space through Meta's and Google's login and back (in the login "state") | small |
| E | The timer posts and reads numbers for both spaces, each with its own logins | small |
| F | Publish page: the Mine / Knowitball switch; the accounts, queue and upload follow it | medium |
| G | `post.mjs --space`; Mikey's Brain keeps posting to `mine` | small |
| H | Tests for every step; page guide (ⓘ) and Brain note updated | small |

Same Meta app and same Google app serve both spaces: no new apps, no new redirect addresses.

### What each person does once the code is live

**Harry (or whoever owns the `kib-marketing` Cloudflare bucket) — fix the team storage first**
The team bucket answered "401: wrong login" on 23 Nov: `R2_ACCESS_KEY_ID` was changed on 20 Nov but
`R2_SECRET_ACCESS_KEY` was not, so the pair no longer matches.
1. Cloudflare (the account that owns `kib-marketing`) → **R2 → Manage API tokens → Create API token** → Object Read &
   Write on `kib-marketing` → copy **both** keys.
2. Vercel: edit `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` with the new pair; check `R2_ACCOUNT_ID` is that same
   account's ID.
3. Add the same CORS rule as 2.3 step 5 to `kib-marketing`.
4. Redeploy Production. (This also brings back Marketing → Uploads, the Studio and patch-note pictures.)

**Mikey (owner of the Meta app "Socials") — let Harry and Leo use the app**
1. developers.facebook.com → the app → **App roles → Roles → Add people** → add Harry's and Leo's Facebook accounts as
   **Developer** (or Administrator). They accept in their Facebook notifications.
2. Nothing else: the app is already Published and has every permission.

**Whoever admins the Knowitball Facebook Page and Instagram**
1. Make sure the Knowitball Instagram is **professional** and **linked** to the Knowitball Facebook Page (2.4).
2. That person must have a **role on the app** (step above) if they are not Mikey.

**Connecting the Knowitball accounts (any of the three, once)**
1. Publish page → switch to **Knowitball**.
2. **Connect Facebook + Instagram** → log in as the person who admins the **Knowitball** Page → **Edit settings** →
   current Pages only → tick the **Knowitball** Page → tick the **Knowitball** Instagram → Save.
3. **Connect YouTube** → the Google account that owns the **Knowitball** channel. If that account is not Mikey's, add
   it in Google Cloud → **Google Auth Platform → Audience → Test users** only if Google refuses (the app is In
   production, so it normally just shows the "unverified" warning).
4. Check the three names at the top of the Knowitball space. They must be the **team** accounts, not Mikey's.

**Daily use (team)**
Publish page → **Knowitball** → **⬆ Upload a video** (or pick one from Marketing → Uploads, listed as Knowitball) →
tick apps → title and caption → Post now or schedule. Numbers on the same page (↻ Check now = live).

### Not covered yet
- **TikTok** is in neither copy (no TikTok posting is built).
- The Knowitball "content" accounts (cutcutthings etc.) would be a third space, the same way, if wanted.
- YouTube stays private-by-default for both until Google approves the audit.

---

## Part 4. Everyday use (Mikey's own copy)

- **Post**: Mikey's Brain → pick a video → tick steps 1–6 → **Send to Claude** → say **"post my videos"** in the chat.
  Or upload straight on the Publish page.
- **Numbers**: say **"update my stats"** (live from all three apps), or **↻ Check now** on the Publish page.
- **YouTube**: switch each Short to Public in YouTube Studio until the audit is approved.

## Part 5. When something goes wrong

| What you see | Cause | Fix |
|---|---|---|
| Google: `Error 400: redirect_uri_mismatch` | The address with or without `www` is missing | Add both addresses (2.6 step 3); wait 5 minutes |
| Meta: "Invalid Scopes: …" | A permission isn't added to the app's use cases | 2.5 step 3, **+ Add** until "Ready for testing" |
| Meta pops "Become a Tech Provider" | You pressed *Add to app review* | **Go back**. Use the row's **+ Add**, not Actions |
| "No Facebook Page came back" | The account has no Page, or Pages weren't ticked | Create/link the Page (2.4); **Edit settings** → tick it |
| "Continue as …" shows the wrong person | Meta reuses the browser's Facebook login | Private window, log in as the right person |
| Facebook Reel "posted" but not on the Page | The Meta app is Unpublished | 2.5 step 7; then post again if still hidden |
| Publish page: "R2 storage settings" missing | A storage key is empty | Fill the four keys (2.3), redeploy Production |
| Storage "answered 401" | Access Key ID and Secret are from different tokens or accounts | New token, paste **both** (Part 3) |
| Upload "blocked" | No CORS rule on the bucket | 2.3 step 5 |
| A key change "did nothing" | Redeployed a Preview row, or didn't redeploy | Redeploy the **Production / Current** row |
| Numbers didn't change | The site re-reads every 3 hours | "update my stats" / ↻ Check now (live) |
| Chat gets "Only the Publish owner can use this" | The chat's key isn't reaching the site | Save Secret B in the chat's secure box; run post.mjs with the two proxy settings |
