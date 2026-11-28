// Marketing → Library from a Claude chat (Mikey, 28 Nov 2026). Needs PUBLISH_AGENT_TOKEN ("Secret B") in the environment.
//   node scripts/publish/library.mjs list <space>                      what is in that library (key, name, ready or needs details)
//   node scripts/publish/library.mjs save <space> <details.json>       save words for one or many videos
// details.json is one object or an array: { "video_key": "...", "name": "...", "why": "...", "series": "...", "len_label": "0:29",
//   "titles": {"youtube": "...", "facebook": "..."}, "captions": {"instagram": "...", "facebook": "...", "youtube": "...", "tiktok": "..."},
//   "tags": {"instagram": "#a #b"} }. space = football | content | kib (the team's Cloudflare library).
import { readFileSync } from "node:fs";
const site = process.env.SITE || "https://knowitball.co.uk";
const token = process.env.PUBLISH_AGENT_TOKEN;
if (!token) { console.error("Set PUBLISH_AGENT_TOKEN (Secret B)."); process.exit(1); }
const headers = { "Content-Type": "application/json", "x-publish-agent": token };
const [cmd, space, file] = process.argv.slice(2);
if (!["football", "content", "kib"].includes(space)) { console.error("Say the space: football, content or kib."); process.exit(1); }

if (cmd === "list") {
  const r = await fetch(`${site}/api/admin/marketing/library?space=${space}`, { headers }); const j = await r.json();
  if (!r.ok) { console.error(j.error || r.status); process.exit(1); }
  for (const v of j.videos) console.log(`${v.details?.name ? "ready        " : "needs details"}  ${v.key}  ${v.details?.name ?? v.file}`);
  console.log(`${j.videos.length} videos, ${j.videos.filter((v) => !v.details?.name).length} need details`);
} else if (cmd === "save" && file) {
  const raw = JSON.parse(readFileSync(file, "utf8")); const list = Array.isArray(raw) ? raw : [raw];
  for (const d of list) {
    const { video_key, ...details } = d;
    const r = await fetch(`${site}/api/admin/marketing/library`, { method: "PUT", headers, body: JSON.stringify({ space, video_key, details }) }); const j = await r.json().catch(() => ({}));
    console.log(r.ok ? "saved" : `FAILED (${j.error || r.status})`, video_key);
  }
} else { console.error("Usage: library.mjs list <space> | save <space> <details.json>"); process.exit(1); }
