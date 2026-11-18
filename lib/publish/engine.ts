/**
 * lib/publish/engine.ts — SERVER ONLY. One "tick" (every 5 minutes from the database timer, or when someone
 * presses Post now): moves every due post one step on, on each platform, and refreshes recent numbers.
 *
 * Each platform's progress lives in post.results[platform], so a tick can stop anywhere and the next one
 * carries on:
 *   instagram  pending → processing (Instagram is processing the container) → done
 *   facebook   pending → done (Facebook fetches and processes the file itself)
 *   youtube    pending → done (the site streams the file to YouTube in the same tick)
 * A failure on one platform never stops the others. Nothing is retried blindly: a failed platform stays
 * failed with its reason until someone presses Try again.
 *
 * The platform calls come in as `api` so tests can run the whole thing with fakes (tests/star/publishEngine.mts).
 */
import { overallStatus, type Platform, type PlatformResult, type PublishPost } from "./types";

export interface EngineApi {
  now(): Date;
  due(now: Date): Promise<PublishPost[]>;
  recent(now: Date): Promise<PublishPost[]>;
  save(id: string, patch: Partial<PublishPost>): Promise<void>;
  video(key: string): Promise<{ url: string; size: number; type: string }>;
  instagramStart(videoUrl: string, caption: string): Promise<string>;
  instagramState(container: string): Promise<{ code: string; why: string }>;
  instagramPublish(container: string): Promise<{ id: string; link: string }>;
  facebookPost(videoUrl: string, title: string, caption: string): Promise<{ id: string; link: string }>;
  youtubeUpload(video: { url: string; size: number; type: string }, title: string, caption: string): Promise<{ id: string; link: string; privacy?: string }>;
  stats(p: Platform, id: string): Promise<Record<string, number>>;
}

/** Instagram gives up on a container after about an hour; so do we. */
const IG_WAIT_MS = 50 * 60 * 1000;
const STATS_EVERY_MS = 3 * 60 * 60 * 1000;

export interface TickReport { moved: { id: string; platform: Platform; stage: string; note?: string }[]; statsRefreshed: number; errors: string[] }

export async function tick(api: EngineApi): Promise<TickReport> {
  const now = api.now();
  const report: TickReport = { moved: [], statsRefreshed: 0, errors: [] };
  let posts: PublishPost[] = [];
  try { posts = await api.due(now); } catch (e) { report.errors.push((e as Error).message); return report; }

  for (const post of posts) {
    const results: PublishPost["results"] = { ...post.results };
    let video: { url: string; size: number; type: string } | null = null;
    const getVideo = async () => (video ??= await api.video(post.video_key));
    const caption = (p: Platform) => post.captions[p] ?? post.captions.instagram ?? post.captions.youtube ?? post.captions.facebook ?? "";

    for (const p of post.platforms) {
      const r: PlatformResult = { stage: "pending", ...results[p] };
      if (r.stage === "done" || r.stage === "failed") continue;
      try {
        if (p === "instagram") {
          if (r.stage === "pending") {
            r.container = await api.instagramStart((await getVideo()).url, caption(p));
            r.stage = "processing"; r.startedAt = now.toISOString();
          } else if (r.container) {
            const st = await api.instagramState(r.container);
            if (st.code === "FINISHED") {
              const out = await api.instagramPublish(r.container);
              Object.assign(r, { stage: "done", id: out.id, link: out.link, doneAt: now.toISOString() });
            } else if (st.code === "ERROR" || st.code === "EXPIRED") {
              Object.assign(r, { stage: "failed", error: `Instagram could not process the video: ${st.why || st.code}` });
            } else if (r.startedAt && now.getTime() - Date.parse(r.startedAt) > IG_WAIT_MS) {
              Object.assign(r, { stage: "failed", error: "Instagram was still processing after 50 minutes. Press Try again." });
            }
          }
        } else if (p === "facebook") {
          const out = await api.facebookPost((await getVideo()).url, post.title, caption(p));
          Object.assign(r, { stage: "done", id: out.id, link: out.link, startedAt: now.toISOString(), doneAt: now.toISOString() });
        } else if (p === "youtube") {
          const out = await api.youtubeUpload(await getVideo(), post.title, caption(p));
          Object.assign(r, { stage: "done", id: out.id, link: out.link, startedAt: now.toISOString(), doneAt: now.toISOString() });
          if (out.privacy === "private") r.error = "Uploaded, but YouTube made it private (the project's YouTube audit is not approved yet).";
        }
      } catch (e) {
        Object.assign(r, { stage: "failed", error: (e as Error).message.slice(0, 400) });
      }
      results[p] = r;
      report.moved.push({ id: post.id, platform: p, stage: r.stage, note: r.error });
    }
    const status = overallStatus({ platforms: post.platforms, results, status: "posting" });
    try { await api.save(post.id, { results, status, attempts: post.attempts + 1 }); } catch (e) { report.errors.push((e as Error).message); }
  }

  // Numbers for anything posted in the last 30 days, at most every 3 hours each.
  try {
    for (const post of await api.recent(now)) {
      const results: PublishPost["results"] = { ...post.results }; let changed = false;
      for (const p of post.platforms) {
        const r = results[p];
        if (!r || r.stage !== "done" || !r.id) continue;
        if (r.statsAt && now.getTime() - Date.parse(r.statsAt) < STATS_EVERY_MS) continue;
        try { r.stats = await api.stats(p, r.id); r.statsError = undefined; report.statsRefreshed++; }
        catch (e) { r.statsError = (e as Error).message.slice(0, 200); }
        r.statsAt = now.toISOString(); changed = true;
      }
      if (changed) await api.save(post.id, { results });
    }
  } catch (e) { report.errors.push((e as Error).message); }
  return report;
}
