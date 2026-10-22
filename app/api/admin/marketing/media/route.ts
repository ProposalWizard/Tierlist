/** GET /api/admin/marketing/media — admins only. Every upload (read from the bucket itself), today's use and the caps. */
import { NextResponse } from "next/server";
import { listMedia } from "@/lib/marketing/mediaApi";
import { getStorage } from "@/lib/marketing/storage";
import { getCaller } from "@/lib/marketing/caller";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await listMedia(await getCaller(), getStorage(), new Date());
    return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Storage could not be read." }, { status: 502 });
  }
}
