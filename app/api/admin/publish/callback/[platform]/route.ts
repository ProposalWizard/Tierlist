/**
 * GET /api/admin/publish/callback/meta | youtube — where Meta and Google send the browser back after "Allow".
 * Checks the state cookie and the admin, swaps the code for tokens, stores them encrypted (publish_accounts)
 * and returns to Marketing → Publish with a line saying what was connected.
 *
 * Meta: picks the Page named in META_PAGE_ID if set, else the first Page with an Instagram account linked, else
 * the first Page. Facebook posts go to that Page; Instagram posts to the Instagram account linked to it.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callbackUrl, whoIs } from "@/lib/publish/auth";
import { seal } from "@/lib/publish/crypto";
import { saveAccount } from "@/lib/publish/db";
import { metaFinishLogin } from "@/lib/publish/meta";
import { youtubeFinishLogin } from "@/lib/publish/youtube";

export const dynamic = "force-dynamic";
const STATE_COOKIE = "kib_publish_state";

export async function GET(req: Request, { params }: { params: { platform: string } }) {
  const back = (msg: string, ok: boolean) => {
    const res = NextResponse.redirect(new URL(`/admin/marketing/publish?${ok ? "connected" : "problem"}=${encodeURIComponent(msg)}`, req.url));
    res.cookies.set(STATE_COOKIE, "", { path: "/api/admin/publish", maxAge: 0 });
    return res;
  };
  const who = await whoIs(req, ["admin"]);
  if (!who || who.kind !== "admin") return back("Sign in as an admin, then press Connect again.", false);
  const p = params.platform;
  const q = new URL(req.url).searchParams;
  if (q.get("error")) return back(`${p === "meta" ? "Meta" : "Google"} said: ${q.get("error_description") || q.get("error")}`, false);
  const want = cookies().get(STATE_COOKIE)?.value ?? "";
  const code = q.get("code");
  if (!code || want !== `${p}.${q.get("state")}`) return back("The login took too long or came from somewhere else. Press Connect again.", false);

  try {
    if (p === "meta") {
      const pages = await metaFinishLogin(code, callbackUrl(req, "meta"));
      if (!pages.length) return back("No Facebook Page came back. Tick the Knowitball Page (and its Instagram) when Meta asks.", false);
      const pinned = process.env.META_PAGE_ID?.trim();
      const page = pages.find((x) => x.id === pinned) ?? pages.find((x) => x.ig) ?? pages[0];
      const list = pages.map((x) => ({ id: x.id, name: x.name, instagram: x.ig?.username ?? null }));
      await saveAccount({ platform: "facebook", account_id: page.id, account_name: page.name, token_enc: seal(page.token), refresh_enc: null, expires_at: null, extra: { pages: list }, connected_by: who.id });
      if (page.ig) await saveAccount({ platform: "instagram", account_id: page.ig.id, account_name: page.ig.username, token_enc: seal(page.token), refresh_enc: null, expires_at: null, extra: { page: page.id }, connected_by: who.id });
      return back(page.ig ? `Facebook: ${page.name} and Instagram: @${page.ig.username}` : `Facebook: ${page.name}. No Instagram is linked to this Page yet.`, true);
    }
    if (p === "youtube") {
      const y = await youtubeFinishLogin(code, callbackUrl(req, "youtube"));
      await saveAccount({ platform: "youtube", account_id: y.channel.id, account_name: y.channel.title, token_enc: seal(y.access), refresh_enc: seal(y.refresh), expires_at: y.expiresAt, extra: {}, connected_by: who.id });
      return back(`YouTube: ${y.channel.title}`, true);
    }
    return back("Unknown platform.", false);
  } catch (e) {
    return back((e as Error).message.slice(0, 300), false);
  }
}
