# Cloudflare R2: the folder layout

One bucket: `kib-marketing` (Vercel setting `R2_BUCKET`). Private: everything is
served through short-lived signed links the site hands out. The keys are in
Vercel only. Brain note: FACT-DAT-009. Agreed with Harry, 12 Nov 2026.

| Folder | What goes in it | Written by |
|---|---|---|
| `videos/<card or inbox>/<stamp>-<name>.<ext>` | Marketing cuts. A `.suite.json` beside a cut holds its Studio notes. | Marketing uploads, the editing suite (`lib/marketing/r2.ts`, `lib/studio/store.ts`) |
| `ledger/<YYYY-MM-DD>/<who>/<stamp>-<bytes>` | One empty file per upload link handed out (the daily cap). | `lib/marketing/r2.ts` |
| `patch-notes/<path under the repo's patch-notes/>` | Every patch-note picture and clip, in the same folders as the repo: `patch-notes/pages/<version>/...`, `patch-notes/mikey/...`, `patch-notes/reviews/...`. Pages (.html) stay in the code. | The media-sync route, by itself every 5 minutes (`vercel.json` crons, `lib/patchNoteMedia.ts`) |
| `library/` | Reserved: the shared picture and clip library. | Not built yet |
| `footage/kib/<code>/` | Reserved: the footage hub, one folder per video code. Harry may use Frame.io instead. | Not built yet |
| `backups/db/<YYYY-MM-DD>/<table>.jsonl.gz` + `manifest.json` | The nightly database backup (03:00 UK). 14 nightly + 8 Sunday copies kept. How to restore: `docs/backup.md`. | `/api/cron/backup` (`lib/backup/`) |

Rules
- A new kind of file gets a new top folder here first, then code.
- Keys never change once written: a page may link to them.
- `patch-notes/` keys are the repo path, so a picture's place in R2 is the same as in the repo.
