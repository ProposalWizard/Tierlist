import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicReadClient } from "@/lib/supabase/publicRead";
import { rowToPatchNote, type PatchNoteRow } from "@/lib/patchNotes";

/**
 * THE PATCH NOTES ARCHIVE.
 *
 * One row per shipped version — see the migration
 * (supabase/migrations/patch_notes.sql) for why this exists: the notes used
 * to live only in an artifact link, which is private by default, sits in
 * whoever's chat produced it, and goes missing the moment a newer page
 * replaces it.
 *
 * GET is public — there is nothing private in a changelog, and the page
 * that reads it gates itself (app/admin/patch-notes/page.tsx). POST is
 * admin-only: one archive means one place it can be written, not whoever
 * last had a page open. Same shape as /api/star/lineups.
 *
 * ── Degrading gracefully before the migration is run ──
 *
 * Supabase fails the WHOLE query when the table doesn't exist. Rather than
 * 500 (which reads, from the page, as "the server is broken"), a missing
 * table is reported as a real, named state: GET returns an empty list with
 * `migrationMissing: true`, and POST returns a plain-English message naming
 * the migration file. The page banners that, so an empty archive is never
 * mistaken for "nothing has shipped yet".
 */

export const dynamic = "force-dynamic";

const SELECT = "version, title, published_at, summary, stats, sections, artifact_url, updated_at";

/** Postgres `undefined_table` (42P01), plus PostgREST's own schema-cache
 *  miss (PGRST205), which is what you actually get first through the REST
 *  layer. Message-matched too, because the code field has not been
 *  populated consistently across PostgREST versions. */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table");
}

const MIGRATION_HINT =
  "The patch_notes table doesn't exist yet — run " +
  "supabase/migrations/patch_notes.sql in the Supabase SQL Editor, then " +
  "supabase/migrations/patch_notes_v0_1.sql to load the first version.";

export async function GET(req: NextRequest) {
  const version = new URL(req.url).searchParams.get("version")?.trim();
  const supabase = createPublicReadClient();

  let query = supabase.from("patch_notes").select(SELECT);
  query = version
    ? query.eq("version", version)
    : query.order("published_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ notes: [], migrationMissing: true, message: MIGRATION_HINT });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notes = ((data ?? []) as unknown as PatchNoteRow[]).map(rowToPatchNote);
  return NextResponse.json({ notes, migrationMissing: false });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    version?: string;
    title?: string;
    publishedAt?: string;
    summary?: string;
    stats?: unknown;
    sections?: unknown;
    artifactUrl?: string;
  } | null;

  if (!body || typeof body.version !== "string" || !body.version.trim()
    || typeof body.title !== "string" || !body.title.trim()
    || !Array.isArray(body.sections)) {
    return NextResponse.json(
      { error: "version, title and sections (an array) are required" },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { error } = await service.from("patch_notes").upsert({
    version: body.version.trim(),
    title: body.title,
    published_at: typeof body.publishedAt === "string" && body.publishedAt
      ? body.publishedAt
      : new Date().toISOString(),
    summary: typeof body.summary === "string" ? body.summary : null,
    stats: Array.isArray(body.stats) ? body.stats : [],
    sections: body.sections,
    artifact_url: typeof body.artifactUrl === "string" && body.artifactUrl.trim()
      ? body.artifactUrl.trim()
      : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "version" });

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
