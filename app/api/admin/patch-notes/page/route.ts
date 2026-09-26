/**
 * GET /api/admin/patch-notes/page?v=0.10 — one version's kept artifact page,
 * as HTML text for the archive's iframe (lib/patchNotePageServe.ts says why
 * srcdoc). Admin only.
 */
import { NextRequest, NextResponse } from "next/server";
import { PATCH_NOTE_PAGES } from "@/lib/patchNotePages";
import { preparePage, readInside, requireAdmin } from "@/lib/patchNotePageServe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const v = req.nextUrl.searchParams.get("v") ?? "";
  const rel = PATCH_NOTE_PAGES[v];
  if (!rel) return NextResponse.json({ error: `No kept page for v${v}.` }, { status: 404 });
  const buf = await readInside(rel);
  if (!buf) return NextResponse.json({ error: `v${v}'s page is listed but the file is missing: patch-notes/${rel}` }, { status: 404 });
  return new NextResponse(preparePage(buf.toString("utf8"), rel), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
