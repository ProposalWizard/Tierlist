// Join takes, shrink to a phone clip (390 wide, H.264, no sound), make the still.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const FF = process.env.FFMPEG || "ffmpeg";
export function finish(takes, outMp4, { crf = 26, stillAt = 0.5 } = {}) {
  const dir = path.dirname(outMp4);
  const list = path.join(dir, path.basename(outMp4) + ".txt");
  fs.writeFileSync(list, takes.map((t) => `file '${path.resolve(t)}'`).join("\n"));
  const r = spawnSync(FF, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", "fps=30,scale=390:-2:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf),
    "-movflags", "+faststart", "-an", outMp4]);
  fs.rmSync(list, { force: true });
  if (r.status !== 0) throw new Error("ffmpeg: " + r.stderr);
  const still = outMp4.replace(/\.mp4$/, ".jpg");
  spawnSync(FF, ["-y", "-loglevel", "error", "-ss", String(stillAt), "-i", outMp4, "-frames:v", "1", "-q:v", "3", still]);
  const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outMp4]);
  return { mp4: outMp4, seconds: Number(p.stdout.toString()), mb: fs.statSync(outMp4).size / 1e6 };
}
