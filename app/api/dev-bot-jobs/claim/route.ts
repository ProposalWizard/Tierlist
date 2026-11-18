/**
 * POST /api/dev-bot-jobs/claim {person} — a Claude chat's hook takes the jobs
 * that person's own Team room bot handed on, each once. A job only exists
 * after the person pressed Accept on their bot's card in the Team room
 * (lib/teamRoom/atBotsServer.ts answerProposal).
 *
 * No password, the same as /api/dev-recordings/claim (Harry, 18 Oct 2026:
 * "id rather no passwords"). What a stranger who knew this address could do:
 * read the words of a thread one of us chose to hand on, in the short time
 * before that person's own chat takes it. Harry, Mikey, Leo only; at most 3
 * jobs a call. It changes nothing but "taken".
 */
import { NextResponse } from "next/server";
import { serviceOrNull } from "@/lib/backup/route";
import { TEAM_PEOPLE } from "@/lib/teamRoom/config";
import { claimHandoffs } from "@/lib/teamRoom/atBotsServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let j: { person?: string };
  try { j = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  const person = TEAM_PEOPLE.find((p) => p.toLowerCase() === (j.person ?? "").trim().toLowerCase());
  if (!person) return NextResponse.json({ error: "person must be Harry, Mikey or Leo." }, { status: 400 });
  const sb = serviceOrNull();
  if (!sb) return NextResponse.json({ jobs: [] });
  try { return NextResponse.json({ jobs: await claimHandoffs(sb, person) }); } catch { return NextResponse.json({ jobs: [] }); }
}
