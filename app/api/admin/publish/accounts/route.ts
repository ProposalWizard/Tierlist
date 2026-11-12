/**
 * DELETE /api/admin/publish/accounts?platform=instagram|facebook|youtube — admins only. Forgets a connected
 * account (its stored tokens are deleted). To cut the app off completely, also remove it in the platform's own
 * settings (Facebook: Business integrations; Google: Third-party access).
 */
import { NextResponse } from "next/server";
import { whoIs } from "@/lib/publish/auth";
import { removeAccount } from "@/lib/publish/db";
import { isPlatform } from "@/lib/publish/types";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const who = await whoIs(req, ["admin"]);
  if (!who) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const p = new URL(req.url).searchParams.get("platform");
  if (!isPlatform(p)) return NextResponse.json({ error: "Unknown platform." }, { status: 400 });
  try { await removeAccount(p); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
