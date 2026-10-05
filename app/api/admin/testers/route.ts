/**
 * /api/admin/testers — tester links and the tester list, for /admin/testers.
 *
 * GET  → { links, testers, migrationMissing }
 * POST { action: "create", note? }                → { link }
 * POST { action: "set-active", code, active }     → { ok }
 * POST { action: "remove-tester", userId }        → { ok }
 *
 * Admin only (isAdmin), service key for every read and write: the browser
 * can't touch tester_links or user_roles directly (tester_access.sql).
 *
 * Before tester_access.sql is run, GET answers migrationMissing: true with
 * empty lists, and POST answers 503 with a plain message — never a 500.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { newTesterCode, normaliseTesterCode } from "@/lib/testerLinks";

export const dynamic = "force-dynamic";

const NOT_READY = "Tester links aren't set up yet. Run supabase/migrations/tester_access.sql in the Supabase SQL Editor first.";

async function adminId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !(await isAdmin(user.id))) return null;
    return user.id;
  } catch {
    return null;
  }
}

interface TesterLinkRow {
  code: string;
  created_at: string;
  active: boolean;
  uses: number;
  note: string | null;
}

interface TesterRow {
  userId: string;
  username: string | null;
  email: string | null;
  isAdmin: boolean;
}

export async function GET() {
  if (!(await adminId())) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const service = createServiceClient();

  const links = await service
    .from("tester_links")
    .select("code, created_at, active, uses, note")
    .order("created_at", { ascending: false });
  const roles = await service
    .from("user_roles")
    .select("user_id, is_admin, is_tester")
    .eq("is_tester", true);

  if (links.error || roles.error) {
    return NextResponse.json({ links: [], testers: [], migrationMissing: true });
  }

  const ids = (roles.data ?? []).map((r: { user_id: string }) => r.user_id);
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: profiles } = await service.from("user_profiles").select("id, username").in("id", ids);
    for (const p of (profiles ?? []) as { id: string; username: string | null }[]) if (p.username) names[p.id] = p.username;
  }
  const emails: Record<string, string> = {};
  await Promise.all(ids.map(async (id) => {
    try {
      const { data } = await service.auth.admin.getUserById(id);
      if (data?.user?.email) emails[id] = data.user.email;
    } catch { /* no email shown */ }
  }));

  const testers: TesterRow[] = (roles.data ?? []).map((r: { user_id: string; is_admin: boolean }) => ({
    userId: r.user_id,
    username: names[r.user_id] ?? null,
    email: emails[r.user_id] ?? null,
    isAdmin: r.is_admin === true,
  }));

  return NextResponse.json({ links: (links.data ?? []) as TesterLinkRow[], testers, migrationMissing: false });
}

export async function POST(req: Request) {
  const me = await adminId();
  if (!me) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }
  const service = createServiceClient();

  if (body.action === "create") {
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 80) || null : null;
    // A clash with an existing code is very unlikely; try a few times anyway.
    for (let i = 0; i < 4; i++) {
      const code = newTesterCode();
      const { data, error } = await service
        .from("tester_links")
        .insert({ code, created_by: me, note, active: true, uses: 0 })
        .select("code, created_at, active, uses, note")
        .maybeSingle();
      if (!error && data) return NextResponse.json({ link: data });
      if (error && error.code !== "23505") return NextResponse.json({ error: NOT_READY }, { status: 503 });
    }
    return NextResponse.json({ error: "Couldn't make a new code. Try again." }, { status: 500 });
  }

  if (body.action === "set-active") {
    const code = normaliseTesterCode(body.code);
    if (!code || typeof body.active !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 });
    const { error } = await service.from("tester_links").update({ active: body.active }).eq("code", code);
    if (error) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "remove-tester") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    // Only the tester mark comes off. An admin stays an admin.
    const { error } = await service.from("user_roles").update({ is_tester: false }).eq("user_id", userId);
    if (error) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
