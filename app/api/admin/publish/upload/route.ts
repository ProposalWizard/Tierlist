/**
 * POST /api/admin/publish/upload — how a Claude chat puts a finished video into Marketing storage to post it.
 * Body {name, size}. Answers with a 15-minute signed link the file is PUT to (straight into R2, never through
 * the site) and the key to queue it with. Admins can use it too, but Marketing → Uploads is the usual way.
 * Same file rules as Uploads (videos only here, 500 MB at most); goes in the folder "publish".
 */
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { whoIs } from "@/lib/publish/auth";
import { getStorage } from "@/lib/marketing/storage";
import { CAPS, checkUpload, uploadUrl, videoKey } from "@/lib/marketing/r2";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const who = await whoIs(req, ["admin", "agent"]);
  if (!who) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const store = getStorage();
  if (store.mode !== "r2" || !store.config) return NextResponse.json({ error: "Marketing storage (R2) is not connected here." }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { name?: unknown; size?: unknown };
  const check = checkUpload({ name: b.name, size: b.size, folder: "publish" }, { files: 0, bytes: 0 });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  if (check.kind !== "video") return NextResponse.json({ error: "Only videos can be posted." }, { status: 415 });
  const now = new Date();
  const key = videoKey(check.folder, check.name, now, randomBytes(4).toString("hex"));
  return NextResponse.json({ key, url: uploadUrl(store.config, key, check.size, now), expiresAt: new Date(now.getTime() + CAPS.putSeconds * 1000).toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
