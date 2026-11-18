/**
 * tests/star/publishEngine.mts — Marketing → Publish (11 Nov 2026): the posting engine (lib/publish/engine.ts)
 * with fake platforms, a fake clock and a fake queue. Never the network.
 * Also the token encryption round trip (lib/publish/crypto.ts).
 */
import { tick, type EngineApi } from "@/lib/publish/engine";
import { overallStatus, type PublishPost } from "@/lib/publish/types";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

let clock = new Date("2026-11-11T18:00:00Z");
const post = (over: Partial<PublishPost> = {}): PublishPost => ({
  id: "p1", video_key: "videos/publish/20261111-180000-ab12-ch03.mp4", title: "Mourinho v Guardiola",
  captions: { instagram: "IG caption", facebook: "FB caption", youtube: "YT description" },
  platforms: ["instagram", "facebook", "youtube"], scheduled_at: clock.toISOString(), status: "scheduled",
  results: {}, attempts: 0, created_by: "test", created_at: clock.toISOString(), updated_at: clock.toISOString(), ...over,
});

function fake(rows: PublishPost[], opts: { igStates?: string[]; fbFails?: boolean } = {}) {
  const calls: string[] = []; const igStates = [...(opts.igStates ?? ["IN_PROGRESS", "FINISHED"])];
  const api: EngineApi = {
    now: () => clock,
    due: async (now) => rows.filter((r) => ["scheduled", "posting"].includes(r.status) && Date.parse(r.scheduled_at) <= now.getTime()),
    recent: async () => rows.filter((r) => ["done", "partial"].includes(r.status)),
    save: async (id, patch) => { const r = rows.find((x) => x.id === id)!; Object.assign(r, patch); },
    video: async (key) => { calls.push(`video ${key}`); return { url: "https://signed.example/v.mp4", size: 1000, type: "video/mp4" }; },
    instagramStart: async (url, caption) => { calls.push(`ig start ${caption}`); return "container1"; },
    instagramState: async () => { calls.push("ig state"); return { code: igStates.shift() ?? "FINISHED", why: "" }; },
    instagramPublish: async () => { calls.push("ig publish"); return { id: "igm1", link: "https://instagram.com/reel/x" }; },
    facebookPost: async (url, title, caption) => { calls.push(`fb ${title} ${caption}`); if (opts.fbFails) throw new Error("Meta: (#100) bad video"); return { id: "fbv1", link: "https://facebook.com/p/videos/fbv1" }; },
    youtubeUpload: async (v, title, caption) => { calls.push(`yt ${title} ${caption}`); return { id: "yt1", link: "https://youtu.be/yt1", privacy: "public" }; },
    stats: async (p) => ({ views: p === "youtube" ? 120 : 50 }),
  };
  return { api, calls };
}

console.log("Publish engine");
{
  const rows = [post({ scheduled_at: new Date(clock.getTime() + 3600e3).toISOString() })];
  const { api, calls } = fake(rows);
  await tick(api);
  ok(calls.length === 0 && rows[0].status === "scheduled", "a post that is not due yet is left alone");
}
{
  const rows = [post()];
  const { api, calls } = fake(rows);
  await tick(api);
  ok(rows[0].results.facebook?.stage === "done" && rows[0].results.youtube?.stage === "done", "tick 1: Facebook and YouTube go up at once");
  ok(rows[0].results.instagram?.stage === "processing" && rows[0].results.instagram?.container === "container1", "tick 1: Instagram is handed the video and starts processing");
  ok(rows[0].status === "posting", "the post shows as posting while Instagram works");
  ok(calls.filter((c) => c.startsWith("video")).length === 1, "the signed video link is made once per tick, not per platform");
  ok(calls.includes("ig start IG caption") && calls.includes("fb Mourinho v Guardiola FB caption") && calls.includes("yt Mourinho v Guardiola YT description"), "each platform gets its own caption, YouTube and Facebook get the title");
  clock = new Date(clock.getTime() + 5 * 60e3); await tick(api);
  ok(rows[0].results.instagram?.stage === "processing", "tick 2: Instagram still processing, so it waits");
  ok(!calls.includes("fb Mourinho v Guardiola FB caption x2") && calls.filter((c) => c.startsWith("fb")).length === 1, "Facebook is never posted twice");
  clock = new Date(clock.getTime() + 5 * 60e3); await tick(api);
  ok(rows[0].results.instagram?.stage === "done" && rows[0].results.instagram?.link === "https://instagram.com/reel/x", "tick 3: Instagram finished, so it is published with its link");
  ok(rows[0].status === "done", "all three done → the post is done");
  ok(rows[0].results.youtube?.stats?.views === 120, "numbers are read for posted videos");
}
{
  const rows = [post()];
  const { api } = fake(rows, { fbFails: true, igStates: ["ERROR"] });
  await tick(api); clock = new Date(clock.getTime() + 5 * 60e3); await tick(api);
  ok(rows[0].results.facebook?.stage === "failed" && /bad video/.test(rows[0].results.facebook?.error ?? ""), "a platform's refusal is kept with its reason");
  ok(rows[0].results.youtube?.stage === "done", "one platform failing does not stop the others");
  ok(rows[0].results.instagram?.stage === "failed" && rows[0].status === "partial", "Instagram ERROR → failed; some done, some failed → partial");
}
{
  const rows = [post({ platforms: ["instagram"] })];
  const { api } = fake(rows, { igStates: Array(30).fill("IN_PROGRESS") });
  await tick(api);
  for (let i = 0; i < 12; i++) { clock = new Date(clock.getTime() + 5 * 60e3); await tick(api); }
  ok(rows[0].results.instagram?.stage === "failed" && /50 minutes/.test(rows[0].results.instagram?.error ?? ""), "Instagram stuck processing for 50 minutes is given up with a clear reason");
}
ok(overallStatus({ platforms: ["instagram"], results: {}, status: "cancelled" }) === "cancelled", "a cancelled post stays cancelled");

process.env.PUBLISH_TOKEN_KEY = "test-key-0123456789-abcdefghijkl";
const { seal, open } = await import("@/lib/publish/crypto");
const s = seal("EAAG-secret-token");
ok(!s.includes("EAAG") && open(s) === "EAAG-secret-token", "tokens are stored encrypted and open again with the key");
let bad = false; try { open(s.replace(/.$/, s.endsWith("A") ? "B" : "A")); } catch { bad = true; }
ok(bad, "a tampered token is refused");

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log("all passed");
