/**
 * POST /api/dev-recordings — Admin → Videos adds a recording here after it
 * reaches Drive, so the recorder's own chats read it next time they are
 * messaged (scripts/hooks/recordings-hook.mjs; Harry, 19 Oct 2026).
 * Signed-in admins and testers only (same people the Videos tab lets in).
 * Writes with the service key; dev_recordings.sql keeps 100 rows a person.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { roleOf } from "@/lib/admin";
import { STATUS_PEOPLE } from "@/lib/devStatus";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (await roleOf(user.id)) === "player") return NextResponse.json({ error: "Admins and testers only." }, { status: 403 });

  let j: { person?: string; title?: string; link?: string };
  try { j = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  const person = STATUS_PEOPLE.find((p) => p.toLowerCase() === (j.person ?? "").trim().toLowerCase());
  if (!person) return NextResponse.json({ error: "person must be Harry, Mikey or Leo." }, { status: 400 });
  const link = String(j.link ?? "").trim();
  if (!link.startsWith("https://drive.google.com/") || link.length > 300) return NextResponse.json({ error: "link must be a Drive link." }, { status: 400 });
  const title = String(j.title ?? "").trim().slice(0, 200) || "screen recording";

  const { error } = await createServiceClient().from("dev_recordings").insert({ person, title, link });
  if (error) return NextResponse.json({ error: "Could not save (has dev_recordings.sql been run?)." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
