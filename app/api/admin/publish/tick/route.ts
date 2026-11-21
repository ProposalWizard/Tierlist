/**
 * POST (or GET) /api/admin/publish/tick — post whatever is due and refresh recent numbers (lib/publish/engine.ts).
 * Called every 5 minutes by the database timer (supabase/migrations/publishing.sql, header x-publish-cron),
 * and by the page's "Post now" / "Check now" buttons (admin) or a chat (agent token).
 * Up to 5 minutes: a YouTube upload streams the whole file through this one request.
 */
import { NextResponse } from "next/server";
import { whoIs } from "@/lib/publish/auth";
import { tick } from "@/lib/publish/engine";
import { liveApi } from "@/lib/publish/live";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(req: Request) {
  const who = await whoIs(req, ["cron", "admin", "agent"]);
  if (!who) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  // ?fresh=1 (a person or a chat asking for live numbers): re-read every recent post's numbers now.
  const fresh = who.kind !== "cron" && new URL(req.url).searchParams.get("fresh") === "1";
  const report = await tick(liveApi(), { fresh });
  return NextResponse.json({ ok: true, by: who.kind, ...report }, { headers: { "Cache-Control": "no-store" } });
}

export const POST = run;
export const GET = run;
