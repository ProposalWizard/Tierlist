import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { parseLegendCode } from "@/lib/star/legendShare";

/**
 * ONE SHARED CAREER, BY ITS CODE (Leo, 6 Oct 2026). See lib/star/legendShare.ts.
 *
 * GET     anyone, no sign-in: { entry, sharedAt }, or 404. Read through the
 *         get_legend_share function, so a code is the only way in — nothing
 *         lists every share, and the sharer's account is never sent.
 * DELETE  the sharer only: stops sharing (the link stops working).
 */

export const dynamic = "force-dynamic";

const MIGRATION_HINT = "Sharing is not set up in the database yet (run supabase/migrations/star_legend_shares.sql).";

function missingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205" || err.code === "PGRST202") return true;
  return /does not exist|could not find the (table|function)/i.test(err.message ?? "");
}

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const code = parseLegendCode(params.code);
  if (!code) return NextResponse.json({ error: "That is not a code." }, { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_legend_share", { p_code: code });
  if (error) {
    if (missingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: "Could not read it." }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.entry) return NextResponse.json({ error: "No career has that code." }, { status: 404 });
  return NextResponse.json({ code, entry: row.entry, sharedAt: row.created_at ?? null });
}

export async function DELETE(_req: Request, { params }: { params: { code: string } }) {
  const code = parseLegendCode(params.code);
  if (!code) return NextResponse.json({ error: "That is not a code." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { error } = await supabase.from("star_legend_shares").delete().eq("code", code).eq("user_id", user.id);
  if (error) {
    if (missingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: "Could not stop sharing it." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
