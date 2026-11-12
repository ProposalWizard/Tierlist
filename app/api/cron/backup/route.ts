/**
 * /api/cron/backup — the nightly database backup (Harry, 12 Nov 2026).
 *
 * GET from Vercel's timed job (vercel.json crons) at 02:00 and 03:00 UTC;
 * only the call that lands on 03:00 UK time works (GMT in winter, BST in
 * summer). Needs CRON_SECRET: without it the job refuses and says so in
 * #health (lib/backup/plan.ts cronGate). Vercel sends the secret by itself.
 *
 * Copies the tables in lib/backup/plan.ts BACKUP_TABLES into R2:
 *   backups/db/<UK date>/<table>.jsonl.gz   one row per line, gzip
 *   backups/db/<UK date>/manifest.json      rows, bytes, time per table
 * then keeps 14 nightly + 8 Sunday copies and deletes older day folders
 * (only inside backups/db/, and only after a complete night).
 * Never sofifa_players. Restore: docs/backup.md.
 */
import { NextResponse, type NextRequest } from "next/server";
import { BACKUP_UK_HOUR, buildManifest, isUkHour, sizeWord, ukClock } from "@/lib/backup/plan";
import { postHealth, r2Config, runBackup } from "@/lib/backup/server";
import { gateOrRefuse, ringRed, serviceOrNull } from "@/lib/backup/route";

export const dynamic = "force-dynamic";
/** Vercel Pro allows 300 s here. The copy stops starting new pages at 250 s. */
export const maxDuration = 300;
const BUDGET_MS = 250_000;

export async function GET(req: NextRequest) {
  const refused = await gateOrRefuse(req.headers.get("authorization"), "backup");
  if (refused) return refused;

  const started = new Date();
  if (!isUkHour(started, BACKUP_UK_HOUR)) return NextResponse.json({ ok: true, skipped: `not ${BACKUP_UK_HOUR}:00 UK time` });
  const day = ukClock(started).day;

  const sb = serviceOrNull();
  const { config, missing } = r2Config();
  if (!sb || !config) {
    const why = !sb ? "the Supabase service key is not set" : `R2 is not connected (${missing.join(", ")})`;
    if (sb) await postHealth(sb, { title: `Nightly backup FAILED · ${day}`, body: `Nothing was copied: ${why}.`, meta: { kind: "backup", red: true, day } }).catch(() => null);
    return NextResponse.json({ ok: false, error: `Backup not run: ${why}.` }, { status: 503 });
  }

  try {
    const manifest = await runBackup(sb, config, day, started.getTime() + BUDGET_MS,
      (results, removed) => buildManifest(day, started, new Date(), results, removed));
    if (!manifest.ok) {
      const bad = manifest.tables.filter((t) => t.state === "failed" || t.state === "not-reached");
      const title = `Nightly backup FAILED · ${day}`;
      const body = `${bad.length} table(s) not saved: ${bad.map((t) => `${t.table} (${t.error ?? t.state})`).join("; ")}`.slice(0, 1900)
        + `\nSaved: ${sizeWord(manifest.totalBytes)}. Old copies were kept.`;
      await postHealth(sb, { title, body, meta: { kind: "backup", red: true, day } }).catch(() => null);
      await ringRed(sb, title, body);
    }
    // Totals only go back to the caller: no rows, no keys beyond the folder.
    return NextResponse.json({ ok: manifest.ok, day, tables: manifest.tables.length, rows: manifest.totalRows, bytes: manifest.totalBytes, durationMs: manifest.durationMs, removedDays: manifest.removedDays });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "The backup failed.";
    await postHealth(sb, { title: `Nightly backup FAILED · ${day}`, body: msg.slice(0, 500), meta: { kind: "backup", red: true, day } }).catch(() => null);
    await ringRed(sb, `Nightly backup FAILED · ${day}`, msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
