# Marketing & Production: the plan (21 Oct 2026)

Status: PLAN ONLY. Nothing is built yet (RUL-TEAM-009: plan first, then one piece at a time).
Asked by: Harry. Source of the method: his other app (a private copy, read only). No client material comes across.
Stills: `docs/plans/2026-10-21-marketing-production/` (the other app's editing suite, loaded with OUR v01 video only).

---

## 1. What it is (one paragraph)

Marketing & Production is a new area of the admin where the three of us make Knowitball's videos.
Knowitball is set up as a "client", the same way Harry's other app treats a paying brand.
The client record holds our voice, our audience, our rules and what has worked.
The area has a production calendar (what goes out when), a production board (every video and the step it is at), an editing suite (watch a cut, leave notes, ask Claude for changes), and a place to upload videos straight in.
Claude keeps the board up to date as it makes each video, using a new "creation" skill.
Videos are kept outside the game's code, so the site never gets bigger because of them.

---

## 2. Admin tab or a separate app?

**Pick: a new tab in the admin, called "Marketing".** It sits beside "Ballon d'Or", "Website" and "Studio" across the top.

| | New admin tab | Separate app |
|---|---|---|
| Sign-in | Already done (Google sign-in, admin check) | Build again, or copy the other app's own log-in |
| Team room, chat, inbox bell, phone alerts | Reused as they are | None; build again or do without |
| Deploy | Same as the game: Harry says push | A second site, a second deploy, a second bill |
| Site size | About 6,000 to 9,000 new lines of code. No video in the code. | Zero for the game |
| Public-repo risk | Real: Knowitball's code is PUBLIC. Only our own method and our own videos may go in. | Low if the new repo is private |
| Work to get going | Small: the shell takes one line per new tab | Large: a new repo, a new database, a new log-in |

Reasons for the tab:
1. Mikey and Leo already live in the admin. A second app means a second place to look.
2. The team room, inbox and phone alerts are about 4,200 lines we already have. A new app starts with none of it.
3. The admin was built for this: "we may be a production company that makes a lot of games" (Harry, 19 Oct). A new tab is one line in the list of games.
4. Note: the other app already IS a separate app with clients. Adding Knowitball there would cost nothing to build. But Mikey and Leo would then see the other clients' private work. So that route is out.

The one thing the tab costs us: care. The repo is public. Section 6 says how we keep it clean.

---

## 3. Knowitball as a "client"

How the other app does it (measured): one short file per client (`client.md`), about 40 lines. It holds the name, a short code, live or not, and "homes": links to the client's research, winning scripts, product facts and rules. It never copies them. Its Brain has one index per client (about 90 to 160 lines each) plus a shared one (167 lines).

**What the Knowitball record holds:**
1. **Who we are:** three mates building the best football game ever. Code: KIB.
2. **Voice:** short, cheeky, football-mad, numbers first ("9.8% to 47.6%"). Real game footage only, or marked "ILLUSTRATION".
3. **Audience:** football fans 16 to 30 on TikTok, Reels and Shorts. (Harry to confirm.)
4. **Rules:** no real club badges or player photos in ads unless we have the right; never claim a feature that is not live; every number comes from a patch note.
5. **Brand:** colours, fonts, logo, end card ("FOLLOW FOR v0.4"), the safe area for captions.
6. **Learnings:** what each video taught us (views, watch time, what the comments said).
7. **Winning scripts:** the scripts that did best, kept word for word.

**Where it lives:** as Brain notes, the way the team already keeps rules.
- A new tag `client-kib` (Harry, Mikey or Leo must OK a new tag first).
- New note kinds stay the same: FACT for brand facts, RUL for rules, a "winning script" goes in `reference`.
- One short record file: `marketing/clients/knowitball/client.md`, with links to the notes. Never copies.
- Numbers that change every day (views, likes) go in the database later, not in notes.
- Why not only the database: notes are searchable by Claude in every chat, and checked by the team. The database is only for things the page writes.

---

## 4. The pieces, in build order

Sizes are lines of code, measured in the other app, then a guess after we strip what we do not need.

### Piece 1. The Marketing tab and the Knowitball client page
- **Does:** a new top tab. Its side menu: Board, Calendar, Suite, Uploads, Scripts, Client. The Client page shows the record from section 3.
- **Ported vs new:** NEW. Uses our own admin shell and the "eye" page guide.
- **Size:** about 400 lines.

### Piece 2. The production board, and the "creation" skill
- **Does:** one card per video. Columns: Idea, Script, Script OK, Making, In edit, Final check, Posted. Each card shows the script, the cuts, who owns it, the date it goes out, and links.
- **The creation skill:** whenever Claude starts or moves a video, it writes that card's change into a file `marketing/board.json` and pushes its branch. The board reads it about once a minute, like the team jobs do (RUL-TEAM-007: "just use pushes", no SQL). Harry can also move a card by hand; that tick is saved like a to-do tick.
- **Ported vs new:** the seven columns and the "one home for the stages" idea are ported (about 320 lines). The board itself is new, built from our Team board look. The skill is new (about 120 lines of instructions).
- **Size:** about 1,400 lines plus the skill.

### Piece 3. The production calendar
- **Does:** a month view and a "next 14 days" strip. Shows each video's post date, shoot or build days, and our patch-note releases (a video usually follows a patch note).
- **Ported vs new:** ported from the other app's timeline (about 1,640 lines there). We drop the client batches and the daily journal.
- **Size:** about 900 lines.

### Piece 4. The editing suite, as an admin page AND as an artifact
- **Does:** one cut on a timeline, with a filmstrip and sound wave. Two modes:
  - **Review:** notes pinned to moments (fix / keep / check).
  - **Edit:** instructions for Claude (cut this bit, change this at 0:07, a note for the whole video). Claude applies them when you press Done.
  - Later: tap a lane (voice, music, captions) and change it; an automatic check lane (shots under 1 second, silence, loudness).
- **As an artifact:** the same page, published to claude.ai with its own small database for notes. Harry already edits this way from a terminal chat. Limits: 15 MB per file, 256 MB per version, so about 15 cuts per artifact at 540p.
- **Ported vs new:** PORTED, and stripped. In the other app it is 12,500 lines (site) plus a 3,500-line artifact page plus 3,500 lines of helper scripts. We drop: Frame.io sending and pulling, the client reviewer's pass, client offer and price checks, the revision checker, the Notion links.
- **Size after stripping:** site page about 6,000 lines; artifact page about 2,800 lines; helper scripts about 1,800 lines.
- **Stills:** `01-phone-list.png`, `02-phone-cut.png`, `03-desktop-cut.png`. These are the other app's artifact page, loaded with our own v01 patch-notes video and made-up Knowitball notes. No client footage or name is in them.

### Piece 5. Upload videos straight into the area
- **Does:** drop a file (or record one with the existing recorder) on the Uploads page. It goes straight to video storage (section 5), never through the site. A small 540p copy and a filmstrip are made for the suite.
- **Ported vs new:** NEW for storage. The existing recorder (`/admin/videos`, 236 + 375 lines) is reused and gets a "send to Marketing" button.
- **Size:** about 600 lines, plus one small server piece that hands out upload links.
- **Why not through the site:** the site host refuses uploads over 4.5 MB in one go. A phone video is 50 to 500 MB.

### Piece 6. Scriptwriting and creative research for Knowitball
- **Does:** a Scripts page: write a script against the Knowitball record, grade it, keep versions. Research: find what football-game videos are working (TikTok, YouTube, our own comments) and turn it into ideas on the board.
- **Ported vs new:** the METHOD is ported (skills `scriptwriting` 127 lines, `creative-research` 84 lines). Every client example is taken out and replaced by Knowitball ones. The other app's script page (about 2,200 lines) is a later, optional port.
- **Size:** skills only at first (about 250 lines). The page later: about 1,200.

### Piece 7. The ported skills

| Skill (lines in the other app) | What it becomes | What is stripped | State |
|---|---|---|---|
| review-timeline (345) | How to load a cut into the suite and apply edits | Frame.io, Notion, client batch names | Port with piece 4 |
| suite-inbox (55) | Work through notes left in the suite | Frame.io refresh | Port with piece 4 |
| editor-feedback (118) | Notes on a cut, against Knowitball's learnings | Client edit lessons | Port |
| scriptwriting (127) | Write a Knowitball script | Client voices, the client reviewer's bar (becomes "Harry's bar") | Port with piece 6 |
| creative-research (84) | Research for Knowitball | Client research banks | Port with piece 6 |
| creative-ops (87) | Reference video in, script and shot list out | Client loop | Port, folded into scriptwriting |
| batch-planner (62) | Plan a month of videos on one page | Notion layout | Port |
| brief-artifact (288) | A shot list as a phone page | Creator names | Port |
| mashup-build (154) | Build a cut from our own game clips plus a voice | Footage Hub of client shoots | Port; our "footage" = game captures |
| call-sheet (120) | Shoot-day sheet | Talent details | Park (we have no shoots yet) |
| screen-video (209) | Already in Knowitball (244 lines) | Nothing | Merge any new bits only |
| ai-video-build (168) | AI clips into a finished cut | Client examples | **PARKED: off** until Higgsfield is allowed again (RUL-3D-002) |
| ai-video-references (118) | Sketches and Blender guides for AI clips | Client examples | **PARKED: off**, same rule |

A parked skill sits in the repo with "PARKED, do not use" as its first line and a trigger that never fires. One line to switch it on later.

**Total size, all pieces:** about 13,500 to 15,000 lines of code, plus about 1,700 lines of skills. For scale: the admin today has about 4,200 lines of team room alone.

---

## 5. Where the videos are kept

Rule: no video ever goes in the game's code. The site already carries about 175 MB of patch-note pictures in its server bundle (`patch-notes/` is 181 MB on disk).

| Option | Free amount | Cost past that | Good | Bad |
|---|---|---|---|---|
| Supabase storage (what we use now) | 1 GB for the whole project, shared with tierlist pictures | Needs the $25 a month plan (100 GB) | Already set up | 1 GB is about 65 cuts at 15 MB. 50 MB limit per file on the free plan. |
| Google Drive (the recorder uses it now) | 15 GB per Google account | About £1.59 a month for 100 GB | Already wired, free | The site can only see files it made, per person. Mikey cannot play Harry's file unless it is shared. Playing a clip inside our page is fiddly. |
| A separate repo | GitHub warns at 50 MB per file, blocks at 100 MB | Large-file storage costs extra | Simple | Repos are not for video; slow; the other app holds 430 MB of cuts in its repo, which shows the problem |
| Cloudflare R2 | 10 GB stored, 1 million uploads, 10 million plays a month | About 1.2p per GB a month. Watching is free (no "egress" fee). 50 GB = about 50p a month. | One shared place for all three of us; uploads go straight from the phone; plays inside the suite | A new Cloudflare account, and it wants a card on file |
| The artifact itself | 256 MB per version, 15 MB per file | Free | Already how Harry edits | A copy for viewing, not a store |

**Pick: Cloudflare R2 for every video, Google Drive stays for raw screen recordings.**
- 10 GB free holds about 650 cuts at 540p, or about 100 full-size originals.
- Past that it is pennies a month, and plays never cost money.
- If Harry does not want a card on a new account: start on Google Drive with one shared "Knowitball Marketing" folder. Move later.
- These limits are as I know them on 21 Oct 2026. Check the sign-up page before signing up. I have spent nothing and opened no account.

---

## 6. Risks

1. **Client material leaking into a public repo.** The Knowitball repo is public. The other app holds its clients' scripts, footage, calls and Brain notes.
   - Fix: nothing is copied in bulk. Each skill is re-typed by hand, with every client word removed.
   - Fix: a guard in the build that fails if it finds any of the other app's client names or codes anywhere in the repo. The word list lives outside the repo (an environment setting), so the list itself never leaks.
   - Fix: never copy the other app's Brain notes, data folder or reviews folder.
2. **Our own plans being public.** Scripts and the board in the repo are readable by anyone, including unreleased features. Decision 3 covers this.
3. **Storage running out.** Supabase is at about 0.37 of 0.5 GB for the database and shares 1 GB of files with tierlists. Video there would fill it in a week. So no video in Supabase.
4. **Site size.** Video files, filmstrips and sound waves must never land in `public/` or the code. The suite reads them from storage.
5. **Size of the port.** The suite alone is about 12,500 lines in the other app. We take about half. Bugs in the other app come across too; we port in small pieces and check each one.
6. **Two copies of the suite drift apart.** The other app already keeps the site page and the artifact page in step by hand ("change both"). We will have the same problem. Fix: one shared set of rules for both, as they do.
7. **AI video switched on by accident.** The two parked skills stay off until Harry lifts RUL-3D-002.
8. **Upload size on phones.** Big files over a phone network fail half-way. Uploads must resume after a drop.

---

## 7. Decisions for Harry

1. **Where does it live?**
   a) A new "Marketing" tab in the admin. b) Inside the existing "Studio" tab. c) A separate private app.
   **Pick: a).** Its own tab, as you said ("its own whole tab"), with all the team room reused.
2. **Where are videos kept?**
   a) Cloudflare R2 (free to 10 GB, card on file). b) A shared Google Drive folder (free, already wired, clunky to play in the page). c) Pay Supabase $25 a month.
   **Pick: a).** Start on b) if you do not want a new account yet.
3. **Can our scripts and board be public?** (The repo is public.)
   a) Yes, they are our own; patch notes are public anyway. b) No: keep scripts and the board in the private database; only the method goes in the repo.
   **Pick: a) for now.** Hide any one video that spoils a feature by keeping its script in Drive until it is out.
4. **Who can see the area?**
   a) Admins only (Harry, Mikey, Leo). b) Testers too.
   **Pick: a).**
5. **First thing to build?**
   a) Tab + client page + board + creation skill. b) The editing suite first.
   **Pick: a).** The board is small and shows every video in one place. The suite is the big port and needs storage decided first.

---

## 8. The first slice (one round)

**Build:**
1. The "Marketing" tab, admins only, with the page guide.
2. The Knowitball client page, read from `marketing/clients/knowitball/client.md` and the `client-kib` Brain notes.
3. The production board, reading `marketing/board.json` (pushed, like team jobs).
4. The creation skill, `.claude/skills/video-board/`: how Claude adds and moves a card each time it makes a video.
5. The first card: v01 (patch notes 0.1 to 0.3), "Posted", with its script and the existing file.
6. The leak guard (risk 1) in the build.

**Not in this slice:** storage, uploads, the suite, the calendar.
**Size:** about 1,800 lines plus one skill.
**Check:** the tab opens on a phone and a computer; a pushed card shows within about 2 minutes; the guard fails on a planted client word.

---

## Facts behind this plan (measured 21 Oct 2026)

- Other app, editing suite: site parts 13 files / 7,885 lines (cut editor 2,966 of them); rules 15 files / 3,962 lines; server routes 14 files / 437 lines; pages 239 lines; artifact page 3,528 lines; helper scripts 3,504 lines (suite 1,416, auto-check 978, page builder 501, lanes 334, apply edits 275).
- Other app, clients: 6 files / 409 lines; each client is one `client.md`.
- Other app, board and calendar: stages 319, concepts 629, timeline 115, deadlines 404, calendar parts 1,000, board parts 1,038 lines.
- Other app, video storage: cuts on the maker's computer, review copies (540p) committed in the repo: 430 MB. Notes for the editor go to Frame.io.
- Knowitball: admin shell 220 lines; team board 448; team room 2,129 (rules) + 2,045 (screens); recorder 236 + 375; Drive scope "drive.file" (the site sees only files it made).
- Knowitball: `docs/marketing/` is 8.2 MB (one video, v01). `patch-notes/` is 181 MB.
- The stills were made by filling the other app's artifact page with our v01 video and five made-up Knowitball notes, served on this machine. It needed no secrets. "Saving is off in this view" shows because it was not on claude.ai.
