/**
 * lib/publish/youtube.ts — SERVER ONLY. YouTube through Google's APIs, with the OAuth client in Vercel:
 * GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (a "Web application" client in the Google Cloud project that has
 * YouTube Data API v3 and YouTube Analytics API switched on).
 *
 * Until Google approves the project's YouTube audit, every video uploaded this way is locked as PRIVATE by
 * YouTube (a rule on their side, not ours). After approval they go up public.
 * A vertical video of 3 minutes or less shows as a Short.
 */
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export function googleConfig(): { id: string; secret: string } | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim(), secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return id && secret ? { id, secret } : null;
}

export function youtubeLoginUrl(redirect: string, state: string): string {
  const cfg = googleConfig(); if (!cfg) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set in Vercel.");
  const q = new URLSearchParams({ client_id: cfg.id, redirect_uri: redirect, response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type Json = Record<string, unknown>;
async function token(params: Record<string, string>): Promise<Json> {
  const cfg = googleConfig(); if (!cfg) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set in Vercel.");
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: cfg.id, client_secret: cfg.secret, ...params }), cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(`Google: ${String(j.error_description || j.error || res.status)}`);
  return j;
}

async function api(url: string, access: string, init: RequestInit = {}): Promise<Json> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${access}` }, cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(`YouTube: ${String((j.error as Json | undefined)?.message || res.status)}`);
  return j;
}

export interface YouTubeLogin { access: string; refresh: string; expiresAt: string; channel: { id: string; title: string } }

export async function youtubeFinishLogin(code: string, redirect: string): Promise<YouTubeLogin> {
  const t = await token({ code, redirect_uri: redirect, grant_type: "authorization_code" });
  if (!t.refresh_token) throw new Error("Google gave no refresh token. Remove the app's access in your Google account and connect again.");
  const access = String(t.access_token);
  const ch = await api("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", access);
  const first = ((ch.items as Json[]) ?? [])[0];
  if (!first) throw new Error("This Google login has no YouTube channel. Pick the Brand Account that owns the channel.");
  return { access, refresh: String(t.refresh_token), expiresAt: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString(), channel: { id: String(first.id), title: String((first.snippet as Json)?.title ?? "") } };
}

export async function youtubeAccess(refresh: string): Promise<{ access: string; expiresAt: string }> {
  const t = await token({ refresh_token: refresh, grant_type: "refresh_token" });
  return { access: String(t.access_token), expiresAt: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString() };
}

/**
 * Upload by streaming the file from storage straight to YouTube (resumable upload, one request).
 * A 3-minute 1080x1920 video is about 50 MB: well inside the route's 5 minutes.
 */
export async function youtubeUpload(access: string, video: { url: string; size: number; type: string }, title: string, description: string, privacy: "public" | "private" | "unlisted" = "public"): Promise<{ id: string; link: string; privacy: string }> {
  const meta = {
    snippet: { title: title.slice(0, 100) || "Knowitball", description: description.slice(0, 5000), categoryId: "17" /* Sports */ },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  };
  const start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST", cache: "no-store",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(video.size), "X-Upload-Content-Type": video.type },
    body: JSON.stringify(meta),
  });
  if (!start.ok) throw new Error(`YouTube would not start the upload (${start.status}): ${(await start.text()).slice(0, 300)}`);
  const session = start.headers.get("location");
  if (!session) throw new Error("YouTube gave no upload address.");
  const file = await fetch(video.url, { cache: "no-store" });
  if (!file.ok || !file.body) throw new Error(`The video could not be read from storage (${file.status}).`);
  const put = await fetch(session, { method: "PUT", body: file.body, headers: { "Content-Length": String(video.size), "Content-Type": video.type }, duplex: "half" } as RequestInit & { duplex: "half" });
  const j = (await put.json().catch(() => ({}))) as Json;
  if (!put.ok) throw new Error(`YouTube refused the upload (${put.status}): ${String((j.error as Json | undefined)?.message ?? "")}`);
  const id = String(j.id);
  return { id, link: `https://youtu.be/${id}`, privacy: String((j.status as Json | undefined)?.privacyStatus ?? privacy) };
}

export async function youtubeStats(access: string, videoId: string): Promise<{ stats: Record<string, number>; privacy: string }> {
  const r = await api(`https://www.googleapis.com/youtube/v3/videos?part=statistics,status&id=${encodeURIComponent(videoId)}`, access);
  const it = ((r.items as Json[]) ?? [])[0];
  if (!it) throw new Error("YouTube no longer has this video.");
  const s = (it.statistics as Record<string, string>) ?? {};
  const stats: Record<string, number> = {};
  for (const [k, out] of [["viewCount", "views"], ["likeCount", "likes"], ["commentCount", "comments"]] as const) if (s[k] != null) stats[out] = Number(s[k]);
  return { stats, privacy: String((it.status as Json | undefined)?.privacyStatus ?? "") };
}
