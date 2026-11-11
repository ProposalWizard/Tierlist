/**
 * PATCH /api/admin/publish/<post id> — change one queued post. Body {action}:
 *   cancel                       stop it (only before anything was posted)
 *   retry                        failed platforms start again from the beginning, at once
 *   reschedule {scheduled_at}    a new time (only while nothing was posted)
 *   now                          post at the next tick (within 5 minutes)
 */
import { NextResponse } from "next/server";
import { whoIs } from "@/lib/publish/auth";
import { getPost, updatePost } from "@/lib/publish/db";
import { overallStatus } from "@/lib/publish/types";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const who = await whoIs(req, ["admin", "agent"]);
  if (!who) return json({ error: "Admins only." }, 403);
  const b = (await req.json().catch(() => ({}))) as { action?: string; scheduled_at?: string };
  try {
    const post = await getPost(params.id);
    if (!post) return json({ error: "No such post." }, 404);
    const started = post.platforms.some((p) => post.results[p] && post.results[p]!.stage !== "pending");
    if (b.action === "cancel") {
      if (started) return json({ error: "Already posted (in part). Delete it on the platform itself." }, 409);
      await updatePost(post.id, { status: "cancelled" });
    } else if (b.action === "retry") {
      const results = { ...post.results };
      for (const p of post.platforms) if (results[p]?.stage === "failed") results[p] = { stage: "pending" };
      await updatePost(post.id, { results, status: overallStatus({ platforms: post.platforms, results, status: "posting" }), scheduled_at: new Date().toISOString() });
    } else if (b.action === "reschedule") {
      if (started) return json({ error: "Already posted (in part): it cannot move now." }, 409);
      const t = b.scheduled_at && Date.parse(b.scheduled_at);
      if (!t) return json({ error: "Give a time." }, 400);
      await updatePost(post.id, { scheduled_at: new Date(t).toISOString(), status: "scheduled" });
    } else if (b.action === "now") {
      if (post.status === "cancelled") return json({ error: "This post was cancelled." }, 409);
      await updatePost(post.id, { scheduled_at: new Date().toISOString() });
    } else return json({ error: "Unknown action." }, 400);
    return json({ ok: true, post: await getPost(post.id) });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
}
