/**
 * /api/admin/live-share/files/live/<code>/<file> — LOCAL DEV ONLY. A dev copy
 * with no storage key keeps live share files on this machine
 * (lib/liveShareStore.ts); this hands them to the viewer page and to
 * scripts/live-watch.mts --base. On the real site the files are in public
 * storage and this answers 404.
 */
import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { liveStore, localFile } from "@/lib/liveShareStore";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  if (liveStore()?.kind !== "local") return NextResponse.json({ error: "Not here." }, { status: 404 });
  const full = localFile(params.path.join("/"));
  if (!full) return NextResponse.json({ error: "Not here." }, { status: 404 });
  try {
    const body = await fs.readFile(full);
    const type = full.endsWith(".jpg") ? "image/jpeg" : "application/json";
    return new NextResponse(body, { headers: { "content-type": type, "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
