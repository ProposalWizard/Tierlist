/**
 * /api/admin/marketing/library/lessons — the "What worked" lines on Marketing → Results (table marketing_lessons).
 *   GET     ?space=            the lessons, newest first
 *   POST    {space, body}      add one line (up to 400 characters)
 *   DELETE  ?space=&id=        remove one
 * Admins (football and content: only the Publish owner), or a chat with the agent token.
 */
import { NextResponse } from "next/server";
import { NOT_YOURS, mayUse, whoIs } from "@/lib/publish/auth";
import { addLesson, listLessons, removeLesson } from "@/lib/publish/libdb";
import { isSpace, type Space } from "@/lib/publish/types";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const spaceOr = (s: unknown): Space => (isSpace(s) ? s : "kib");

export async function GET(req: Request) {
  const who = await whoIs(req, ["admin", "agent"]);
  const space = spaceOr(new URL(req.url).searchParams.get("space"));
  if (!mayUse(who, space)) return json({ error: NOT_YOURS }, 403);
  try { return json({ space, lessons: await listLessons(space) }); } catch (e) { return json({ space, lessons: [], error: (e as Error).message }); }
}

export async function POST(req: Request) {
  const who = await whoIs(req, ["admin", "agent"]);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const space = spaceOr(b?.space);
  if (!mayUse(who, space)) return json({ error: NOT_YOURS }, 403);
  const body = typeof b?.body === "string" ? b.body.trim().slice(0, 400) : "";
  if (!body) return json({ error: "Write the lesson first." }, 400);
  try { return json({ lesson: await addLesson(space, body, who!.name) }); } catch (e) { return json({ error: (e as Error).message }, 500); }
}

export async function DELETE(req: Request) {
  const who = await whoIs(req, ["admin", "agent"]);
  const q = new URL(req.url).searchParams;
  const space = spaceOr(q.get("space"));
  if (!mayUse(who, space)) return json({ error: NOT_YOURS }, 403);
  const id = q.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "No such lesson." }, 400);
  try { await removeLesson(space, id); return json({ ok: true }); } catch (e) { return json({ error: (e as Error).message }, 500); }
}
