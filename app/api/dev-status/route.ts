/**
 * POST /api/dev-status — a chat's progress bars, for the team board.
 *
 * Sent by scripts/post-status.mjs (the Stop hook calls it). Needs the shared
 * password in the x-dev-status-token header (env DEV_STATUS_TOKEN). Writes
 * with the service key; no browser can write the table (dev_status.sql has no
 * insert policy). At most one update a minute per person; 6,000 characters.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MAX_STATUS_CHARS, STATUS_PEOPLE, parseBars, scrub, tokenMatches } from "@/lib/devStatus";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.DEV_STATUS_TOKEN?.trim();
  if (!expected) return NextResponse.json({ error: "Live bars aren't switched on yet (DEV_STATUS_TOKEN not set in Vercel)." }, { status: 503 });
  if (!tokenMatches(req.headers.get("x-dev-status-token")?.trim(), expected)) return NextResponse.json({ error: "Wrong token." }, { status: 401 });

  let j: { person?: string; body?: string; session?: string; branch?: string };
  try { j = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  const person = STATUS_PEOPLE.find((p) => p.toLowerCase() === (j.person ?? "").trim().toLowerCase());
  if (!person) return NextResponse.json({ error: "person must be Harry, Mikey or Leo." }, { status: 400 });
  const body = scrub(String(j.body ?? "")).slice(0, MAX_STATUS_CHARS);
  if (!parseBars(body).length) return NextResponse.json({ error: "No progress bars in that update." }, { status: 400 });

  const sb = createServiceClient();
  const { data: last } = await sb.from("dev_status").select("created_at, body").eq("person", person)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last && last.body === body) return NextResponse.json({ ok: true, skipped: "same as last" });
  if (last && Date.now() - Date.parse(last.created_at) < 60_000) return NextResponse.json({ ok: true, skipped: "one a minute" });

  const { error } = await sb.from("dev_status").insert({
    person, body,
    session: typeof j.session === "string" ? j.session.slice(0, 200) : null,
    branch: typeof j.branch === "string" ? j.branch.slice(0, 120) : null,
  });
  if (error) return NextResponse.json({ error: "Could not save (has dev_status.sql been run?)." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
