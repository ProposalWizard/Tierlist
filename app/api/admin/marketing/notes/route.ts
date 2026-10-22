/**
 * GET  /api/admin/marketing/notes?key=…  — the editing suite's notes for one video.
 * POST /api/admin/marketing/notes {key, change} — one add / update / delete.
 * Admins only. Saved as <video key>.notes.json in R2 (lib/marketing/suite.ts says why).
 */
import { NextResponse } from "next/server";
import { changeNotes, readNotes } from "@/lib/marketing/mediaApi";
import { getStorage } from "@/lib/marketing/storage";
import { getCaller } from "@/lib/marketing/caller";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  try {
    const r = await readNotes(await getCaller(), new URL(req.url).searchParams.get("key"), getStorage());
    return NextResponse.json(r.body, { status: r.status, headers: H });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502, headers: H }); }
}

export async function POST(req: Request) {
  try {
    const r = await changeNotes(await getCaller(), await req.json().catch(() => null), getStorage(), new Date());
    return NextResponse.json(r.body, { status: r.status, headers: H });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502, headers: H }); }
}
