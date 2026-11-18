/**
 * POST /api/dev-bot-jobs/done {id, token, text} — the pipe back. The Claude
 * chat that took a handed-on job says what it did (or proposes), once, and the
 * words land in the Team room thread under the bot's card as
 * "<Name>'s Claude replied" (lib/teamRoom/atBotsServer.ts finishHandoff).
 *
 * The token is the one handed out with the job by /api/dev-bot-jobs/claim, so
 * only the chat that took the job can close it. Sent by
 * scripts/team-room/bot-job-done.mjs.
 */
import { NextResponse } from "next/server";
import { serviceOrNull } from "@/lib/backup/route";
import { finishHandoff } from "@/lib/teamRoom/atBotsServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let j: { id?: unknown; token?: unknown; text?: unknown };
  try { j = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  const id = Number(j.id);
  if (!Number.isSafeInteger(id) || id <= 0 || typeof j.token !== "string" || typeof j.text !== "string") return NextResponse.json({ error: "Send id, token and text." }, { status: 400 });
  const sb = serviceOrNull();
  if (!sb) return NextResponse.json({ error: "The site's database key is not set." }, { status: 503 });
  const r = await finishHandoff(sb, id, j.token, j.text);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
