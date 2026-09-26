/**
 * GET /api/admin/patch-notes/file/<path under patch-notes/> — a kept page's
 * own pictures, fonts and stylesheets. Admin only; nothing outside
 * patch-notes/ and nothing but those file types (lib/patchNotePageServe.ts).
 */
import path from "path";
import { NextResponse } from "next/server";
import { SERVED_TYPES, readInside, requireAdmin } from "@/lib/patchNotePageServe";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const rel = (params.path ?? []).map((p) => decodeURIComponent(p)).join("/");
  const type = SERVED_TYPES[path.extname(rel).toLowerCase()];
  if (!type) return NextResponse.json({ error: "Not a served file type." }, { status: 404 });
  const buf = await readInside(rel);
  if (!buf) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" },
  });
}
