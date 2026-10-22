/**
 * POST /api/admin/marketing/upload — admins only. Body {name, size, folder?}.
 * Checks the caps (500 MB a file, video/picture types, 30 files / 5 GB per
 * admin per UK day) and answers with a 15-minute signed link the browser PUTs
 * the file to, straight into R2 (the site never carries the file: its limit
 * is 4.5 MB). The rules: lib/marketing/{r2,mediaApi}.ts.
 */
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { askUpload } from "@/lib/marketing/mediaApi";
import { getStorage } from "@/lib/marketing/storage";
import { getCaller } from "@/lib/marketing/caller";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const r = await askUpload(await getCaller(), body, getStorage(), new Date(), randomBytes(4).toString("hex"));
    return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Storage could not be reached." }, { status: 502 });
  }
}
