/**
 * POST /api/team-ideas — an idea from a Claude chat onto the Team room's
 * Ideas board (Mikey, 19 Oct 2026: "can I get you to add ideas here? From
 * Claude").
 *
 * Sent by scripts/post-idea.mjs. No password, the same rule as
 * /api/dev-status (Harry, 18 Oct 2026: "id rather no passwords"): the worst a
 * stranger can do is add an idea on an admin-only board. Guards: for Harry,
 * Mikey or Leo only, a title of 1–140 characters, one idea a minute, and
 * never the same title twice. Writes with the service key, marked
 * from_claude (team_room_claude.sql).
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { TEAM_PEOPLE } from "@/lib/teamRoom/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let j: { for?: string; title?: string };
  try { j = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  const person = TEAM_PEOPLE.find((p) => p.toLowerCase() === (j.for ?? "").trim().toLowerCase());
  if (!person) return NextResponse.json({ error: "for must be Harry, Mikey or Leo." }, { status: 400 });
  const title = String(j.title ?? "").replace(/\s+/g, " ").trim();
  if (!title || title.length > 140) return NextResponse.json({ error: "title must be 1–140 characters." }, { status: 400 });

  const sb = createServiceClient();
  const { data: last, error: readErr } = await sb.from("team_ideas").select("created_at, title")
    .eq("from_claude", true).order("created_at", { ascending: false }).limit(20);
  if (readErr) return NextResponse.json({ error: "Could not read ideas (has team_room_claude.sql been run?)." }, { status: 500 });
  if ((last ?? []).some((r) => r.title.toLowerCase() === title.toLowerCase())) return NextResponse.json({ ok: true, skipped: "already there" });
  if (last?.[0] && Date.now() - Date.parse(last[0].created_at) < 60_000) {
    return NextResponse.json({ error: "One idea a minute." }, { status: 429 });
  }

  const { data, error } = await sb.from("team_ideas").insert({ person, title, from_claude: true }).select("id").single();
  if (error) return NextResponse.json({ error: "Could not save (has team_room_claude.sql been run?)." }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
