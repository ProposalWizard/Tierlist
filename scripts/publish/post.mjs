#!/usr/bin/env node
/**
 * scripts/publish/post.mjs — post a finished video from a Claude chat (Marketing → Publish, Mikey 11 Nov 2026).
 *
 *   node scripts/publish/post.mjs <video.mp4> --title "…" --caption "…" [--to instagram,facebook,youtube]
 *        [--at 2026-11-12T18:30:00Z] [--ig "…"] [--fb "…"] [--yt "…"] [--site https://knowitball.co.uk]
 *   node scripts/publish/post.mjs --status          the accounts, the queue and the numbers
 *   node scripts/publish/post.mjs --tick            run the poster now instead of waiting for the 5-minute timer
 *
 * Auth: every request carries the header x-publish-agent. In a cloud chat the network proxy adds it (a network
 * secret for host knowitball.co.uk, header x-publish-agent = PUBLISH_AGENT_TOKEN); locally set PUBLISH_AGENT_TOKEN.
 * The video goes straight from here to storage through a signed link (never through the site), then is queued.
 */
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const has = (n) => args.includes(`--${n}`);
const site = (flag("site") || process.env.PUBLISH_SITE || "https://knowitball.co.uk").replace(/\/$/, "");
const headers = { "Content-Type": "application/json", "x-publish-agent": process.env.PUBLISH_AGENT_TOKEN || "set-by-proxy" };

async function call(path, init = {}) {
  const r = await fetch(site + path, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = { error: text.slice(0, 300) }; }
  if (!r.ok) throw new Error(`${path}: ${j.error || r.status}`);
  return j;
}

function show(d) {
  for (const a of d.accounts || []) console.log(`${a.connected ? "●" : "○"} ${a.platform}: ${a.name || a.id || "not connected"}`);
  for (const p of (d.posts || []).slice(0, 15)) {
    console.log(`\n[${p.status}] ${p.title || p.video_key}  ${p.scheduled_at}  (${p.id})`);
    for (const pl of p.platforms) {
      const r = p.results?.[pl] || {};
      const stats = r.stats ? Object.entries(r.stats).map(([k, v]) => `${v} ${k}`).join(", ") : "";
      console.log(`   ${pl}: ${r.stage || "pending"}${r.link ? " " + r.link : ""}${stats ? " · " + stats : ""}${r.error ? " · " + r.error : ""}`);
    }
  }
}

if (has("status")) { show(await call("/api/admin/publish")); process.exit(0); }
if (has("tick")) { console.log(JSON.stringify(await call("/api/admin/publish/tick", { method: "POST", body: "{}" }), null, 2)); process.exit(0); }

const file = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!file) { console.error("Give a video file, or --status / --tick."); process.exit(1); }
const size = statSync(file).size;
const platforms = (flag("to") || "instagram,facebook,youtube").split(",").map((s) => s.trim()).filter(Boolean);
const title = flag("title") || "";
const caption = flag("caption") || "";
if (platforms.includes("youtube") && !title) { console.error("YouTube needs --title."); process.exit(1); }

console.log(`Uploading ${basename(file)} (${(size / 1e6).toFixed(1)} MB)…`);
const up = await call("/api/admin/publish/upload", { method: "POST", body: JSON.stringify({ name: basename(file), size }) });
const put = await fetch(up.url, { method: "PUT", body: readFileSync(file), headers: { "content-length": String(size) } });
if (!put.ok) { console.error(`Storage refused the upload (${put.status}): ${(await put.text()).slice(0, 300)}`); process.exit(1); }

const captions = { instagram: flag("ig") ?? caption, facebook: flag("fb") ?? caption, youtube: flag("yt") ?? caption };
const at = flag("at");
const { post } = await call("/api/admin/publish", { method: "POST", body: JSON.stringify({ video_key: up.key, title, captions, platforms, scheduled_at: at || new Date().toISOString() }) });
console.log(`Queued ${post.id} for ${post.scheduled_at} → ${platforms.join(", ")}`);
if (!at) { await call("/api/admin/publish/tick", { method: "POST", body: "{}" }).catch((e) => console.log("(tick:", e.message + ")")); }
console.log("Check with: node scripts/publish/post.mjs --status");
