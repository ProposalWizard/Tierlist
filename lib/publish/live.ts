/**
 * lib/publish/live.ts — SERVER ONLY. The real EngineApi: the tables, the storage and the three platforms, with
 * the stored tokens opened only for the call that needs them.
 */
import { open, seal } from "./crypto";
import { duePosts, getAccount, recentPosted, saveAccount, updatePost } from "./db";
import type { EngineApi } from "./engine";
import { facebookPostVideo, facebookReelState, facebookStats, instagramContainerState, instagramPublish, instagramStartReel, instagramStats } from "./meta";
import type { Platform, Space } from "./types";
import { videoForPosting } from "./video";
import { youtubeAccess, youtubeStats, youtubeUpload } from "./youtube";

async function account(p: Platform, space: Space = "football") {
  const a = await getAccount(space, p);
  if (!a) throw new Error(`${p[0].toUpperCase()}${p.slice(1)} is not connected in the ${space} space. Connect it on Marketing → Publish.`);
  return a;
}

/** A YouTube access token, refreshed and stored again when it is close to running out. */
async function youtubeToken(space: Space = "football"): Promise<string> {
  const a = await account("youtube", space);
  if (a.expires_at && Date.parse(a.expires_at) - Date.now() > 5 * 60 * 1000) return open(a.token_enc);
  if (!a.refresh_enc) throw new Error("YouTube needs connecting again (no refresh token).");
  const t = await youtubeAccess(open(a.refresh_enc));
  await saveAccount({ ...a, space, token_enc: seal(t.access), expires_at: t.expiresAt });
  return t.access;
}

export function liveApi(): EngineApi {
  return {
    now: () => new Date(),
    due: duePosts,
    recent: recentPosted,
    save: updatePost,
    video: (key) => videoForPosting(key),
    async instagramStart(url, caption, sp) { const a = await account("instagram", sp); return instagramStartReel(a.account_id, open(a.token_enc), url, caption); },
    async instagramState(c, sp) { const a = await account("instagram", sp); return instagramContainerState(c, open(a.token_enc)); },
    async instagramPublish(c, sp) { const a = await account("instagram", sp); return instagramPublish(a.account_id, open(a.token_enc), c); },
    async facebookPost(url, title, caption, sp) { const a = await account("facebook", sp); return facebookPostVideo(a.account_id, open(a.token_enc), url, title, caption); },
    async facebookState(id, sp) { const a = await account("facebook", sp); return facebookReelState(id, open(a.token_enc)); },
    async youtubeUpload(video, title, caption, sp) { return youtubeUpload(await youtubeToken(sp), video, title, caption, "public"); },
    async stats(p, id, sp) {
      if (p === "youtube") return (await youtubeStats(await youtubeToken(sp), id)).stats;
      const a = await account(p, sp);
      return p === "instagram" ? instagramStats(id, open(a.token_enc)) : facebookStats(id, open(a.token_enc));
    },
  };
}
