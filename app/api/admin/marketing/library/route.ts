/**
 * /api/admin/marketing/library — Marketing → Library (Mikey, 28 Nov 2026). Every call names its space
 * (?space= on GET and DELETE, "space" in the PUT body: football | content | kib; default kib here, the team's).
 *   GET     the videos in that space's storage, each with its saved words (or null = "needs details").
 *   PUT     {space, video_key, details}: save a video's words (name, why, titles, captions, hashtags).
 *   DELETE  ?space=&key=  forget a video's saved words (the video file is not touched).
 * Admins (football and content: only the Publish owner), or a chat with the agent token.
 */
import { NextResponse } from "next/server";
import { NOT_YOURS, mayUse, whoIs } from "@/lib/publish/auth";
import { detailsMap, removeDetails, saveDetails } from "@/lib/publish/libdb";
import { cleanDetails } from "@/lib/publish/library";
import { listSpaceVideos } from "@/lib/publish/spaceVideos";
import { isPublishVideo } from "@/lib/publish/storage";
import { isSpace, type Space } from "@/lib/publish/types";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const spaceOr = (s: unknown): Space => (isSpace(s) ? s : "kib");

export async function GET(req: Request) {
  const who = await whoIs(req, ["admin", "agent"]);
  const space = spaceOr(new URL(req.url).searchParams.get("space"));
  if (!mayUse(who, space)) return json({ error: NOT_YOURS }, 403);
  const out: Record<string, unknown> = { space };
  const listed = await listSpaceVideos(space);
  out.storage = listed.storage;
  if (listed.error) out.storageError = listed.error;
  let details: Awaited<ReturnType<typeof detailsMap>> = {};
  try { details = await detailsMap(space); } catch (e) { out.error = (e as Error).message; }
  out.videos = listed.videos.map((v) => ({ key: v.key, file: v.name, size: v.size, uploaded: v.uploaded, source: v.source, details: details[v.key] ?? null }));
  // Words saved for a video that is no longer in storage (moved or deleted): listed apart so they are not lost.
  const have = new Set(listed.videos.map((v) => v.key));
  out.orphans = Object.values(details).filter((d) => !have.has(d.video_key)).map((d) => ({ key: d.video_key, details: d }));
  return json(out);
}

export async function PUT(req: Request) {
  const who = await whoIs(req, ["admin", "agent"]);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ error: "Send the details as JSON." }, 400);
  const space = spaceOr(b.space);
  if (!mayUse(who, space)) return json({ error: NOT_YOURS }, 403);
  if (!isPublishVideo(b.video_key)) return json({ error: "That is not a video key." }, 400);
  const details = cleanDetails(b.details);
  if (!details.name) return json({ error: "Give the video a name." }, 400);
  try { await saveDetails(space, b.video_key, details, who!.name); return json({ ok: true, details }); }
  catch (e) { return json({ error: (e as Error).message }, 500); }
}

export async function DELETE(req: Request) {
  const who = await whoIs(req, ["admin", "agent"]);
  const q = new URL(req.url).searchParams;
  const space = spaceOr(q.get("space"));
  if (!mayUse(who, space)) return json({ error: NOT_YOURS }, 403);
  const key = q.get("key") ?? "";
  if (!isPublishVideo(key)) return json({ error: "That is not a video key." }, 400);
  try { await removeDetails(space, key); return json({ ok: true }); }
  catch (e) { return json({ error: (e as Error).message }, 500); }
}
