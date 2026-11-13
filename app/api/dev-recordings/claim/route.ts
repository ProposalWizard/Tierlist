/**
 * POST /api/dev-recordings/claim {person} — a chat's hook takes that person's
 * unread recordings (last 3 days) and marks them read, so each recording is
 * read once, by whichever of that person's chats is messaged first.
 * No password, like /api/dev-status (Harry, 18 Oct 2026: "id rather no
 * passwords"): the worst a stranger can do is see game-test video links or
 * mark them read. Harry, Mikey, Leo only; at most 5 rows a call.
 *
 * Two places are read (12 Nov 2026):
 *   - team storage (R2, recordings/<who>/…): unread = no "<key>.read" mark
 *     beside it. The link handed out is the site's watch link.
 *   - the dev_recordings table: recordings that only reached Drive.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { STATUS_PEOPLE } from "@/lib/devStatus";
import { RECORDINGS_PREFIX, readKeyFor, unreadFor, watchLink } from "@/lib/recordings/store";
import { recordingStore, siteOrigin } from "@/lib/recordings/server";

export const dynamic = "force-dynamic";

type Claimed = { title: string; link: string; created_at: string };

async function fromStorage(req: Request, person: (typeof STATUS_PEOPLE)[number]): Promise<Claimed[]> {
  const store = recordingStore();
  if (!store) return [];
  try {
    const waiting = unreadFor(await store.list(`${RECORDINGS_PREFIX}${person.toLowerCase()}/`), person, new Date());
    const out: Claimed[] = [];
    for (const r of waiting) {
      await store.putText(readKeyFor(r.key), "");
      out.push({ title: r.title, link: watchLink(siteOrigin(req), store.config, r.key), created_at: r.uploaded });
    }
    return out;
  } catch { return []; }
}

async function fromTable(person: string): Promise<{ recordings: Claimed[]; error?: string }> {
  try {
    const sb = createServiceClient();
    const since = new Date(Date.now() - 3 * 864e5).toISOString();
    const { data, error } = await sb.from("dev_recordings").select("id, title, link, created_at")
      .eq("person", person).is("read_at", null).gte("created_at", since)
      .order("created_at", { ascending: true }).limit(5);
    if (error) return { recordings: [], error: "dev_recordings.sql not run yet?" };
    // Only rows still unread at this moment count as ours (two chats at once).
    const ids = (data ?? []).map((r) => r.id);
    const { data: taken } = ids.length
      ? await sb.from("dev_recordings").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null).select("id")
      : { data: [] as { id: number }[] };
    const mine = new Set((taken ?? []).map((r) => r.id));
    return { recordings: (data ?? []).filter((r) => mine.has(r.id)).map(({ title, link, created_at }) => ({ title, link, created_at })) };
  } catch { return { recordings: [] }; }
}

export async function POST(req: Request) {
  let j: { person?: string };
  try { j = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  const person = STATUS_PEOPLE.find((p) => p.toLowerCase() === (j.person ?? "").trim().toLowerCase());
  if (!person) return NextResponse.json({ error: "person must be Harry, Mikey or Leo." }, { status: 400 });

  const [stored, table] = await Promise.all([fromStorage(req, person), fromTable(person)]);
  const recordings = [...stored, ...table.recordings];
  return NextResponse.json(recordings.length || !table.error ? { recordings } : { recordings, error: table.error });
}
