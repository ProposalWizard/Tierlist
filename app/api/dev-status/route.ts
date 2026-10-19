/**
 * POST /api/dev-status — a chat's progress bars, for the team board.
 *
 * Sent by scripts/post-status.mjs (the Stop hook calls it). No password
 * (Harry, 18 Oct 2026: "id rather no passwords"): the worst a stranger can do
 * is post fake bars on an admin-only page. Guards: Harry/Mikey/Leo only, the
 * text must have bars, 6,000 characters, one update a minute per person, and
 * the table keeps 50 rows a person (dev_status.sql). Writes with the service
 * key; no browser can write the table (no insert policy).
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MAX_STATUS_CHARS, STATUS_PEOPLE, parseBars, scrub } from "@/lib/devStatus";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
