/**
 * The proof that a clip's sound is there and lined up: loudness every 0.25 s and the
 * loudest moments, beside the moments the scene logged (seconds into the clip).
 *
 *   node scripts/film/scenes/peaks.mjs <clip.mp4> [label=seconds ...]
 *   e.g. node scripts/film/scenes/peaks.mjs big-moment.mp4 strike=6.2 goal=8.9
 */
import { spawnSync } from "node:child_process";

/** Loudness every 0.05 s (dB RMS): fine enough to check a sound against a frame (±0.1 s). */
function loudness(file, step = 0.05) {
  const n = Math.round(48000 * step);
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-vn", "-af", `aresample=48000,asetnsamples=${n},astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level`, "-f", "null", "-"], { encoding: "utf8" });
  const out = []; let t = null;
  for (const line of (r.stderr || "").split("\n")) {
    const mt = /pts_time:([\d.]+)/.exec(line); if (mt) t = Number(mt[1]);
    const mv = /RMS_level=(-?[\d.inf]+)/.exec(line); if (mv && t !== null) out.push({ t, db: mv[1] === "-inf" ? -120 : Number(mv[1]) });
  }
  return out;
}

const [file, ...marks] = process.argv.slice(2);
const L = loudness(file);
if (!L.length) { console.log(file, "NO AUDIO"); process.exit(1); }
const bar = (db) => "█".repeat(Math.max(0, Math.round((db + 60) / 3)));
// the curve in 0.25 s rows (the loudest 0.05 s step in each)
for (let t = 0; t < L[L.length - 1].t; t += 0.25) {
  const w = L.filter((p) => p.t >= t && p.t < t + 0.25); if (!w.length) continue;
  const m = w.reduce((a, b) => (b.db > a.db ? b : a));
  console.log(t.toFixed(2).padStart(6), String(m.db.toFixed(1)).padStart(7), bar(m.db));
}
const top = [...L].sort((a, b) => b.db - a.db).slice(0, 5).sort((a, b) => a.t - b.t);
console.log("loudest:", top.map((p) => `${p.t.toFixed(2)}s ${p.db.toFixed(1)} dB`).join(" · "));
for (const m of marks) {
  const [k, v] = m.split("="); const t = Number(v);
  const near = L.filter((p) => Math.abs(p.t - t) <= 0.3).sort((a, b) => b.db - a.db)[0];
  console.log(`${k} at ${t.toFixed(2)}s → loudest within ±0.3 s: ${near ? `${near.t.toFixed(2)}s ${near.db.toFixed(1)} dB` : "none"}`);
}
