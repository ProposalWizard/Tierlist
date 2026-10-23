# Handoff — Supabase connected, 4 pages for feedback (23 Oct 2026)

## For
Harry's next chat (branch Harry).

## The goal in one line
"start up the supabase conversation again now the connector's fixed — what can supabase do, what is its limits, how can we use it for what we currently do?" Plus Harry's feedback on the 4 pages below.

## Decisions already made
- SQL always goes out as a page: name, one line, Copy all, full text (RUL-DAT-001, `scripts/supabase/sql-page.py`).
- "I need to know exactly what it does and why in those allow boxes": every Supabase request opens with READ ONLY / CHANGES THE DATABASE + What + Why, and changes wait for a yes (RUL-DAT-002).
- Only main deploys on Vercel (`vercel.json`, PR #772). Side-branch pushes make no build.
- Bots plan: Harry/Mikey/Leo bots on each person's own routine; @claude on a paid key with a cap (not yet agreed — call 4 on the bots page).

## Where it stands
| | What | State |
|---|---|---|
| ✓ | Patch note 0.108h (3D card, skin, sizes, build-ups, circle) | live, Vercel success (seen) |
| ✓ | 3D man on card, even skin, header/drill men size B | live |
| ✗ | Slack-style Team room | built, review only, branch `worktree-agent-abe056dfab1b60454` |
| ✗ | Video library | built, review only, branch `worktree-agent-a4a6f7f669930b071` |
| ✗ | Claude bots | plan only |
| ✗ | star_xp_config, star_tuning_notes tables | missing live (measured 23 Oct) |

## The 4 pages for feedback (+ the SQL page)
1. Patch note 0.108h: https://claude.ai/artifact/PxR9dtNZn6vD2Tc5TPgRHD
2. Team room review: https://claude.ai/artifact/FArWcF4mwSNPbeks8UnCJJ
3. Video library review: https://claude.ai/artifact/XXjG3hVLKmCMuDAYDvnZnn
4. Claude bots plan: https://claude.ai/artifact/49AML8rUFeP5CGbAxo8Wbb
- SQL to run: https://claude.ai/artifact/QYNgdTwNTkxjprps5EpkMH
- Supabase explainer: see the reply that links this file.

## Supabase facts (measured 23 Oct, project cagkgfketucousksgtbk "Tierlist Football")
- Database 382 MB (CLAUDE.md gives the free limit as 500 MB). `sofifa_players` alone is 312 MB.
- Storage 15,291 files, 516 MB of 1 GB free. 121 sign-ups. 76 tables.
- Safety check: `update_login_streak` can be run by anyone for any user id (could reset a streak). `team_room_prune` is flagged but is a trigger, so it can't be called from outside (reasoned). Leaked-password check is off (Google sign-in only, so low value).

## Open questions (recommended answer)
1. Run the 2 missing tables via the connector? Yes, after Harry's yes on the SQL page.
2. Lock `update_login_streak` to the signed-in user? Yes; small, safe.
3. Slim `sofifa_players` (82% of the database)? Yes, plan first: it's the thing that hits the limit.
4. Move Storage images to Cloudflare like the videos? Later; 52% used.

## Next steps
1. Read Harry's comments on the 4 pages; act on all of them together.
2. On "push": merge the Team room and/or video library branch, check, deploy, then run `team_room_v3.sql` via the connector (with a yes).
3. Run the 2 missing tables (with a yes), then confirm they exist.

## Watch out for
- The Supabase connector works in cloud Claude chats since 23 Oct 2026 (project cagkgfketucousksgtbk); the CLAUDE.md "Pending Setup" line saying cloud connectors fail is out of date for Supabase.
- Vercel free plan: 100 deploys a day; only main counts now.
- Disk filled once on 23 Oct: remove finished worktrees.
- `teamBoard.mts` and `patchNoteMedia.mts` each have one old failing check (not from this round).
- RUL-TEAM-023 may clash with a note on the video-library branch; check before merging.
- Brain index has 2 old errors (RUL-TEAM-006, -008), not from this round.

## Still running
Nothing.
