/** POST /api/admin/marketing/upload/done — admins only. Body {key}. Checks the file arrived; over the cap = deleted. */
import { NextResponse } from "next/server";
import { uploadDone } from "@/lib/marketing/mediaApi";
import { getStorage } from "@/lib/marketing/storage";
import { getCaller } from "@/lib/marketing/caller";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const r = await uploadDone(await getCaller(), await req.json().catch(() => null), getStorage());
    return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Storage could not be reached." }, { status: 502 });
  }
}
