/**
 * lib/publish/meta.ts — SERVER ONLY. Facebook Page and Instagram (Business or Creator account linked to that
 * Page) through Meta's Graph API, with the app in Vercel: META_APP_ID, META_APP_SECRET (and optionally
 * META_LOGIN_CONFIG_ID when the app uses "Facebook Login for Business", META_GRAPH_VERSION to pin a version).
 *
 * Posting to accounts the app's own admins manage works without Meta's App Review (Standard access).
 * One Page token does both: it never expires when it comes from a long-lived user token.
 */
export const GRAPH = () => process.env.META_GRAPH_VERSION?.trim() || "v23.0";
const SCOPES = [
  "pages_show_list", "pages_read_engagement", "pages_manage_posts", "read_insights", "business_management",
  "instagram_basic", "instagram_content_publish", "instagram_manage_insights",
];

export function metaConfig(): { appId: string; secret: string } | null {
  const appId = process.env.META_APP_ID?.trim(), secret = process.env.META_APP_SECRET?.trim();
  return appId && secret ? { appId, secret } : null;
}

export function metaLoginUrl(redirect: string, state: string): string {
  const cfg = metaConfig(); if (!cfg) throw new Error("META_APP_ID and META_APP_SECRET are not set in Vercel.");
  const q = new URLSearchParams({ client_id: cfg.appId, redirect_uri: redirect, state, response_type: "code" });
  const configId = process.env.META_LOGIN_CONFIG_ID?.trim();
  if (configId) q.set("config_id", configId); else q.set("scope", SCOPES.join(","));
  return `https://www.facebook.com/${GRAPH()}/dialog/oauth?${q}`;
}

type Json = Record<string, unknown>;
async function graph(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET", host = "graph.facebook.com"): Promise<Json> {
  const url = `https://${host}/${GRAPH()}/${path.replace(/^\//, "")}`;
  const body = new URLSearchParams(params);
  const res = await fetch(method === "GET" ? `${url}?${body}` : url, { method, body: method === "POST" ? body : undefined, cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as Json;
  const err = j.error as { message?: string; error_user_msg?: string } | undefined;
  if (!res.ok || err) throw new Error(`Meta: ${err?.error_user_msg || err?.message || `answered ${res.status}`}`);
  return j;
}

export interface MetaPage { id: string; name: string; token: string; ig: { id: string; username: string } | null }

/** After the login: the Pages this person manages, with long-lived Page tokens and any linked Instagram. */
export async function metaFinishLogin(code: string, redirect: string): Promise<MetaPage[]> {
  const cfg = metaConfig(); if (!cfg) throw new Error("META_APP_ID and META_APP_SECRET are not set in Vercel.");
  const short = await graph("oauth/access_token", { client_id: cfg.appId, client_secret: cfg.secret, redirect_uri: redirect, code });
  const long = await graph("oauth/access_token", { grant_type: "fb_exchange_token", client_id: cfg.appId, client_secret: cfg.secret, fb_exchange_token: String(short.access_token) });
  const pages = await graph("me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "50", access_token: String(long.access_token) });
  return ((pages.data as Json[]) ?? []).map((p) => {
    const ig = p.instagram_business_account as { id?: string; username?: string } | undefined;
    return { id: String(p.id), name: String(p.name ?? ""), token: String(p.access_token), ig: ig?.id ? { id: ig.id, username: ig.username ?? "" } : null };
  });
}

/* ── Facebook Page video ─────────────────────────────────────────────── */
/** Facebook fetches the file from the link itself, so the video never passes through the site. */
export async function facebookPostVideo(pageId: string, token: string, videoUrl: string, title: string, caption: string): Promise<{ id: string; link: string }> {
  const r = await graph(`${pageId}/videos`, { file_url: videoUrl, title: title.slice(0, 255), description: caption, access_token: token }, "POST", "graph-video.facebook.com");
  const id = String(r.id);
  return { id, link: `https://www.facebook.com/${pageId}/videos/${id}` };
}

export async function facebookStats(videoId: string, token: string): Promise<Record<string, number>> {
  const r = await graph(`${videoId}/video_insights`, { metric: "total_video_views,total_video_impressions,total_video_reactions_by_type_total", access_token: token });
  const out: Record<string, number> = {};
  for (const m of (r.data as Json[]) ?? []) {
    const v = ((m.values as Json[]) ?? [])[0]?.value;
    const name = String(m.name).replace("total_video_", "");
    if (typeof v === "number") out[name] = v;
    else if (v && typeof v === "object") out.reactions = Object.values(v as Record<string, number>).reduce((a, b) => a + (Number(b) || 0), 0);
  }
  return out;
}

/* ── Instagram Reel: container → Instagram processes it → publish ─────── */
export async function instagramStartReel(igId: string, token: string, videoUrl: string, caption: string): Promise<string> {
  const r = await graph(`${igId}/media`, { media_type: "REELS", video_url: videoUrl, caption: caption.slice(0, 2200), share_to_feed: "true", access_token: token }, "POST");
  return String(r.id);
}

/** "FINISHED" = ready to publish; "IN_PROGRESS" = keep waiting; "ERROR"/"EXPIRED" = give up (with Instagram's reason). */
export async function instagramContainerState(containerId: string, token: string): Promise<{ code: string; why: string }> {
  const r = await graph(containerId, { fields: "status_code,status", access_token: token });
  return { code: String(r.status_code ?? ""), why: String(r.status ?? "") };
}

export async function instagramPublish(igId: string, token: string, containerId: string): Promise<{ id: string; link: string }> {
  const r = await graph(`${igId}/media_publish`, { creation_id: containerId, access_token: token }, "POST");
  const id = String(r.id);
  let link = "";
  try { link = String((await graph(id, { fields: "permalink", access_token: token })).permalink ?? ""); } catch { /* the post exists; the link is a nicety */ }
  return { id, link };
}

export async function instagramStats(mediaId: string, token: string): Promise<Record<string, number>> {
  const r = await graph(`${mediaId}/insights`, { metric: "views,reach,likes,comments,shares,saved", access_token: token });
  const out: Record<string, number> = {};
  for (const m of (r.data as Json[]) ?? []) {
    const v = ((m.values as Json[]) ?? [])[0]?.value ?? (m.total_value as Json | undefined)?.value;
    if (typeof v === "number") out[String(m.name)] = v;
  }
  return out;
}
