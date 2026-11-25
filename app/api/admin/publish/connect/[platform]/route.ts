/**
 * GET /api/admin/publish/connect/meta | youtube — admins only. Starts the platform's login ("Allow") and comes
 * back to /api/admin/publish/callback/<platform>. One Meta login connects both Facebook and Instagram.
 * A random state rides in a 10-minute cookie and must match on the way back.
 */
import { NextResponse } from "next/server";
import { NOT_YOURS, callbackUrl, mayUse, whoIs } from "@/lib/publish/auth";
import { spaceOf } from "@/lib/publish/types";
import { newState } from "@/lib/publish/crypto";
import { metaLoginUrl } from "@/lib/publish/meta";
import { youtubeLoginUrl } from "@/lib/publish/youtube";

export const dynamic = "force-dynamic";
const STATE_COOKIE = "kib_publish_state";

export async function GET(req: Request, { params }: { params: { platform: string } }) {
  const who = await whoIs(req, ["admin"]);
  if (!who) return NextResponse.json({ error: "Sign in as an admin first." }, { status: 403 });
  // ?space= : which set of accounts this login is for. It rides in the state cookie and comes back with the login.
  const space = spaceOf(new URL(req.url).searchParams.get("space"));
  if (!mayUse(who, space)) return NextResponse.json({ error: NOT_YOURS }, { status: 403 });
  const p = params.platform;
  if (p !== "meta" && p !== "youtube") return NextResponse.json({ error: "Unknown platform." }, { status: 404 });
  const state = newState();
  let url: string;
  try { url = p === "meta" ? metaLoginUrl(callbackUrl(req, "meta"), state) : youtubeLoginUrl(callbackUrl(req, "youtube"), state); }
  catch (e) { return NextResponse.redirect(new URL(`/admin/marketing/publish?space=${space}&problem=${encodeURIComponent((e as Error).message)}`, req.url)); }
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, `${p}.${space}.${state}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/admin/publish", maxAge: 600 });
  return res;
}
