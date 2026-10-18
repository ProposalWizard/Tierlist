# Team board (`/admin/team`) — deep plan

15 Oct 2026. Planning only: no code was kept or committed. Two draft files I
had started (`lib/devStatus.ts`, `lib/teamPushes.ts`) were deleted when the
brief changed; the worktree is clean.

Each claim says how I know it: **measured** (I ran it), **read** (I read the
code), or **reasoned** (worked out, not tested).

---

## 1. What exists now

### GitHub reads

| Check | Result | How known |
|---|---|---|
| Vercel's `GITHUB_TOKEN` works on this repo | Yes. It made real commits on 14 Oct (`be2b54b` 21:50 "save 37 scenarios into the code", `ee0a7ad`, `053768d`, `835815d`, committer `ProposalWizard`). | measured (commit list for `lib/star/authoredScenarios.json`) |
| That token can read branches, commits, PRs, commit statuses | Very likely. The repo is **public** (anonymous `GET /repos/ProposalWizard/Tierlist` = 200), and a fine-grained token can always read public repos. | reasoned — I can't hold the real token here |
| The `GITHUB_TOKEN` in this cloud session | **Not the real one.** It is a 14-character stand-in; sent from Node straight to GitHub it gets `401 Bad credentials`. So I could not test the Vercel token itself. | measured |
| Anonymous GitHub (no token) | **Unusable.** The cloud's shared IPs were already at 0 of 60 calls/hour (`403 rate limit exceeded`). A no-token fallback would fail most of the time. | measured |
| Data shapes, via this session's own GitHub access (`gh api`, 15,000/hour) | All four branches exist. Latest: Harry `5ca671e` 00:02, Mikey `82ddfde` 13 Oct 16:50, Leo `8e02341` 14 Oct 12:08, main `5ca671e`. PRs list fine (#735–#740). | measured |
| "Last deployed" | `GET /commits/main/status` has one status, context `Vercel`, `success`, "Deployment has completed", updated 15 Oct 10:23:57. `GET /deployments?environment=Production` also works (latest `5ca671e`, created 00:24, by `vercel[bot]`). Branch heads have a `Vercel` preview status too. | measured |

**Two traps found:**

1. **Every commit's author is "Claude"** (login `claude`), not the person. So
   "who pushed" must come from the **branch name** or the **PR opener**
   (`LeoVassiliou` opened #740). measured
2. **Not every push is on a named branch.** PR #740 (Leo's v0.16) came from
   `claude/recover-tierlist-website-3BajA`, not `Leo`. A board that only
   watches `Harry` / `Mikey` / `Leo` / `main` would miss that work until it
   merged. measured
3. Bonus: every Claude commit carries a `Claude-Session: https://claude.ai/code/session_…`
   line. That can group pushes by session ("2 sessions pushed today"). measured

### Realtime

- Used in `components/draft/MultiplayerLobby.tsx`: browser client
  (`lib/supabase/client.ts`), `supabase.channel(...).on("postgres_changes", { table, filter }, cb).subscribe()`,
  plus a 2-second poll as a safety net, `removeChannel` on unmount. read
- Tables join Realtime with `ALTER PUBLICATION supabase_realtime ADD TABLE …`
  (`american_draft.sql`). That line errors if run twice, so the new migration
  must wrap it in a `pg_publication_tables` check to stay idempotent. read
- Supabase Realtime only sends a row to a signed-in browser that the table's
  RLS lets read it. So "admins read" RLS also limits who gets live rows. reasoned (Supabase docs behaviour; not tested here)

### Admin gates

- `lib/admin.ts` `isAdmin(userId)` reads `user_roles.is_admin` with the service key. read
- Pages: server component, `getUser()` → redirect to `/auth?next=…` → `isAdmin` → redirect `/` (e.g. `app/admin/testers/page.tsx`), then `<PageGuide page="…"/>`. read
- API routes: same `getUser()` + `isAdmin()`, 403 otherwise (e.g. `app/api/star/scenarios/commit/route.ts`). read
- Admin-only RLS pattern already in use: `EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.is_admin = true)` (`star_tuning_notes.sql`). read

### Can sessions reach the site?

- From this cloud session: `GET https://knowitball.co.uk/...` = 200 (1.9 s), `POST /api/xp` = 401 (the POST reached the app). Supabase REST also reachable. measured
- Cloud env values may be **stand-ins swapped in by the proxy** ("Network
  secrets"), as `GITHUB_TOKEN` is here. A `DEV_STATUS_TOKEN` added that way
  only works on requests to the host it is tied to. It must be tied to
  `knowitball.co.uk`, or added as a plain environment variable. reasoned (from the stand-in seen + the environment docs)

### Hooks

- `.claude/settings.json` already runs project hooks: `PreToolUse` (guard-lock,
  engine-warn) and `Stop` (one-engine guard, 120 s). A new `Stop` hook fits
  next to them. read
- A `Stop` hook gets the session's `transcript_path` on stdin, so it can read
  the last message Claude wrote. reasoned (Claude Code hook contract)

---

## 2. Three designs

### A. Sessions POST to a table — Claude runs a command (the brief as written)

The skill tells Claude: after every update, run
`node scripts/post-status.mjs --dev Harry --stdin` with the bars.

### B. Sessions POST to a table — a Stop hook sends it, nobody has to remember

Same table and route as A. But a small `Stop` hook reads the last message.
If it has progress bars (`█`/`░` lines with a %), the hook sends just that
block. Claude does nothing extra.

### C. GitHub only

No table, no secret. The board shows pushes, PRs, deploy state, and
"working on" guessed from each branch's last commits and open PRs.

### Compared

| | A. Claude runs a command | B. Stop hook | C. GitHub only |
|---|---|---|---|
| Live progress bars | ✓ | ✓ | ✗ (only what is pushed) |
| Works if Claude forgets | ✗ — it will forget, the skill already had to be re-told twice ("why have you stopped using the progress skill") | ✓ | n/a |
| Extra tokens per update | ~300–600 per update (one Bash call + reading its output). 5-min updates × 8 h ≈ 100 calls ≈ 50k tokens/day/dev | 0 | 0 |
| Delay added to a turn | 1–3 s (command) | ~0 (hook sends in the background, 5 s cap) | 0 |
| Migration | `dev_status.sql` | `dev_status.sql` | none |
| Secret | `DEV_STATUS_TOKEN` in Vercel + each person's sessions | same | none (uses existing `GITHUB_TOKEN`) |
| Reaches local sessions | only if the repo there has the script | only if the repo there has the hook (see §4) | n/a |
| Risk of posting something private | low (Claude chooses the text) | medium → low: hook sends only bar/time/waiting lines, scrubs key-shaped text | none |
| Build size | ~2.5 h | ~3 h | ~1.5 h |

Rejected, for the record:
- **Write straight to Supabase from the session** (anon key + a secret-checking
  database function). Puts the secret check in SQL, harder to change, no
  rate limit. No gain over a route.
- **Read sessions from the Claude Code session list.** Each person only sees
  their own account's sessions, and the Vercel server can't call it at all.

---

## 3. Recommendation: C now, then B on top (one page)

Build it in two steps on one page:

1. **Pushes (C)** — works the day it ships, no setup. Fixes both traps: watch
   `Harry`, `Mikey`, `Leo`, `main` **and** any open PR, naming each PR by its
   opener (`LeoVassiliou` → Leo). Deploy state from main's `Vercel` status.
2. **Live bars (B)** — the Stop hook, the table and the route. The
   `post-status.mjs` script from design A still exists (the hook calls it, and
   a person can run it by hand), so A comes free.

Why not A alone: it costs tokens on every update and depends on Claude
remembering, which this team has already seen fail.

### Page sketch at 390 px

```
┌──────────────────────────────────────┐
│ Team                          ↻ 12s  │
│ ● LIVE  main deployed 10:23 · 5ca671e│  ← green: success / amber: building / red: failed
│         "Merge main into Harry…"     │
├──────────────────────────────────────┤
│ HARRY  · Harry branch · 2 min ago  ● │  ← dot: live <10 min, grey >30 min
│ Keeper dive fix    ████████░░  80%   │
│ Patch notes v0.57  ███░░░░░░░  30%   │
│ Waiting on: you, to merge → main     │
│ ▸ last 10 updates                    │
│ Pushes                               │
│  5ca671e 00:02 Merge main into Harry │
│  5194451 23:52 Patch notes v0.55 …   │
├──────────────────────────────────────┤
│ MIKEY  · Mikey branch · 2 days ago ○ │
│ No live updates yet                  │
│ Pushes                               │
│  82ddfde 13 Oct Patch notes v0.16 …  │
├──────────────────────────────────────┤
│ LEO    · Leo branch · 1 day ago    ○ │
│ …                                    │
├──────────────────────────────────────┤
│ Pull requests                        │
│  #740 Leo  → main  merged 23:07      │
│  #739 Harry→ main  merged 17:14      │
├──────────────────────────────────────┤
│ ⚠ Live progress isn't switched on    │  ← only until migration + secret
│   yet. Pushes still work.            │
└──────────────────────────────────────┘
                                  (eye)
```

- One card per person, newest-active first. Bars drawn from the text as sent
  (monospace, so the blocks line up), with the headline as the card title on
  a narrow phone.
- "▸ last 10 updates" opens the history (tap, not a new page).
- Pushes refresh every 60 s (server cache 60 s); bars arrive live by Realtime,
  with a 30 s poll as a safety net (the lobby pattern).
- The token-usage block is folded under a "Usage" toggle, not shown by
  default.

---

## 4. How each person's sessions send updates

### The pieces

- `scripts/post-status.mjs` — reads the update text (file or stdin), who
  (`--dev`, else env `DEV_NAME`, else the git branch name if it is Harry /
  Mikey / Leo), the branch, the session id (env, else from the
  `Claude-Session` line). Reads `DEV_STATUS_TOKEN` from env; **if it is not
  set it exits quietly**. Sends to `https://knowitball.co.uk/api/dev-status`
  (`DEV_STATUS_URL` to override). Never prints the token. 5 s timeout, never
  fails the caller.
- `scripts/hooks/post-status-hook.mjs` — the Stop hook. Reads the last
  assistant message from `transcript_path`. Only if it contains ≥1 bar line
  (`█`/`░` + `%`): keeps the bar lines, `Started …`, `Speed check`, `Waiting
  on`, and the usage block; drops everything else; skips it if identical to
  the last one sent (a small file in the temp folder); then starts
  `post-status.mjs` detached and returns at once.
- One line in the progress-update skill: "Updates are sent to /admin/team
  automatically when `DEV_STATUS_TOKEN` is set. To send one by hand: …".

### Cloud sessions (claude.ai/code)

1. Each person opens their own cloud environment → Edit → add two
   **environment variables** (not "Network secrets", or the value is a
   stand-in that only works if tied to `knowitball.co.uk`):
   `DEV_STATUS_TOKEN = <the shared secret>`, `DEV_NAME = Harry` (or Mikey / Leo).
2. New sessions pick them up. The hook is in the repo, so it is there after
   the next merge into each branch.

### Local sessions (desktop app / CLI on their own computer)

- The hook and script live in the repo. CLAUDE.md says local `git pull`
  doesn't work for them, so a local clone may never get the hook. reasoned
- Safe path: add `DEV_STATUS_TOKEN` and `DEV_NAME` to the user's own
  `~/.claude/settings.json` under `"env"`. If their local copy of the repo
  is current, the hook works. If not, the update simply isn't sent — nothing
  breaks.
- Open question 6 asks whether anyone really works locally.

### What can go wrong

| Problem | What happens | Guard |
|---|---|---|
| Secret not set | Nothing is sent, silently | Card says "No live updates yet"; page notice names the env var |
| Proxy stand-in value (Network secrets) | Server gets the wrong secret → 401 | Use plain env vars; route says "wrong token" in the response; script logs only "status not sent (401)" |
| Site down / slow | Update lost | 5 s cap, detached; next update replaces it |
| Claude writes no bars | Nothing sent | Design B only sends when bars exist; that's correct |
| Wrong person name (a `claude/*` branch, no `DEV_NAME`) | Sent as "Unknown" or dropped | Require `DEV_NAME`; route rejects names outside the 3 |
| Subagents posting their own bars | Noise | Hook on `Stop` only, not `SubagentStop` |
| Same text every 5 min | Spam | Hook dedupes; route rate-limits to 1 a minute per person |
| Secret leaks | Someone can post fake bars | Low harm: admins-only page, shown as plain text, 50-row cap; rotate by changing the env var |

---

## 5. Security

| | Who | How |
|---|---|---|
| **Read the page** | Admins only | `/admin/team` server gate (`isAdmin`, redirect) |
| **Read pushes** | Admins only | `/api/admin/team` checks `isAdmin`; GitHub token stays on the server |
| **Read status rows** | Admins only | RLS `SELECT` for admins; Realtime follows RLS |
| **Write status rows** | Holders of `DEV_STATUS_TOKEN` | Only `POST /api/dev-status`, which checks the `x-dev-status-token` header (constant-time compare) and writes with the service key. **No insert policy** on the table, so no browser can write it |
| **Update / delete rows** | Nobody (except the prune trigger) | No policies |

Also:
- Bars are shown as text, never as HTML.
- The route caps size (6,000 chars), checks the name is Harry / Mikey / Leo,
  and the hook scrubs key-shaped strings (`eyJ…`, `ghp_…`, `github_pat_…`,
  `sk-…`, `phc_…`) before sending.
- The secret is never printed, logged, or put in a command line (env only).
- Storage: 50 rows × 3 people × ~1.5 KB ≈ 0.2 MB. No effect on the 500 MB limit.

---

## 6. Build steps, sized

| # | Step | Size | Needs |
|---|---|---|---|
| 1 | `lib/teamPushes.ts`: branch commits, open PRs (opener → person), main's `Vercel` status, 60 s cache, injectable fetch | 40 min | nothing |
| 2 | `GET /api/admin/team` (admin gate) — pushes + status rows + "switched on?" flags | 20 min | nothing |
| 3 | `/admin/team` page + `TeamBoard.tsx`, phone-first, PageGuide entry | 60 min | nothing |
| 4 | Test: PR→person mapping, deploy-state pick, cache (`tests/star/teamPushes.mts`) | 20 min | nothing |
| — | **Ship point 1: pushes live, no setup** | ~2.5 h | — |
| 5 | `supabase/migrations/dev_status.sql`: table, admin-read RLS, guarded Realtime add, prune-to-50 trigger, verify queries | 25 min | — |
| 6 | `lib/devStatus.ts` (parse bars, validate, token check) + `POST /api/dev-status` (rate limit) | 35 min | — |
| 7 | `scripts/post-status.mjs` + `scripts/hooks/post-status-hook.mjs` + `.claude/settings.json` Stop entry | 45 min | — |
| 8 | Realtime on the page + history toggle | 30 min | — |
| 9 | Tests: parser, validation, token check, hook's extract + scrub (`tests/star/devStatus.mts`) | 25 min | — |
| 10 | Skill section, CLAUDE.md migration row + env line, still at 390×844 | 20 min | — |
| — | **Ship point 2: live bars once Mikey runs the SQL and the secret is set** | ~3 h more | migration + secret |

Total ≈ 5.5 h of building (one top-model builder ≈ 1–2M tokens, rough).

### Setup steps for Mikey (plain words) — after ship point 2

1. Supabase → SQL Editor → paste `supabase/migrations/dev_status.sql` → Run.
   Then run the check query at the bottom; it should list the table's policy.
2. Make up a long random password (a password manager's "generate" is fine).
   This is the shared secret. Do not paste it into any chat.
3. Vercel → Tierlist project → Settings → Environment Variables → add
   `DEV_STATUS_TOKEN` = that password (Production) → Save → Redeploy.
4. Give the same password to Harry and Leo in person or by private message.
5. Each person: claude.ai/code → cloud environment menu → Edit → environment
   variables → add `DEV_STATUS_TOKEN` (the password) and `DEV_NAME` (your
   name). Start a new session.
6. Open knowitball.co.uk/admin/team: the "isn't switched on yet" notice goes,
   and your card fills after your next progress update.

---

## 7. Open questions for Harry (each with my recommended answer)

1. **Automatic (hook) or Claude runs a command each update?**
   Recommend **automatic**: no extra tokens, can't be forgotten.
2. **Ship pushes first, live bars second?**
   Recommend **yes**: pushes work the same day with no setup.
3. **Watch only the Harry / Mikey / Leo / main branches, or also other branches
   with an open PR?** Recommend **also open PRs** — Leo's v0.16 came from a
   `claude/…` branch and would otherwise be invisible.
4. **Who can see the page?** Recommend **admins only**. Not testers.
5. **Send every 5-minute update, or only when a bar changes stage?**
   Recommend **every update, skipping exact repeats**: the card shows "2 min
   ago", which is what tells you it's alive.
6. **Does anyone actually run Claude Code on their own computer?**
   Recommend **cloud only for now**; local works only if that copy of the
   repo is current (local pull doesn't work for you).
7. **How long before a card goes "quiet"?** Recommend grey dot after
   **30 min** with no update, "offline" after **3 h**.
8. **Show the token-usage block?** Recommend **folded under a toggle**.
9. **Show each update's session link?** Recommend **yes** — only the owner
   can open it, but it says which session sent it.
10. **History length?** Recommend **last 50 kept, last 10 shown**.
