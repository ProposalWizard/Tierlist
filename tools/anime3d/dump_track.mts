import { readFileSync, writeFileSync } from "fs";
import { trackFromStored, frameAt, trackDuration } from "../../lib/star/goalClip/track";
for (const name of ["lay-off", "scramble"]) {
  const t = trackFromStored(JSON.parse(readFileSync(new URL(`../../tests/star/fixtures/goalClips/${name}.json`, import.meta.url), "utf8")))!;
  const dur = trackDuration(t); const frames = [];
  for (let i = 0; i < t.n; i++) frames.push(frameAt(t, i / t.fps));
  writeFileSync(`${process.argv[2]}/${name}.track.json`, JSON.stringify({ meta: t.meta, fps: t.fps, bodies: t.bodies, goalT: t.goalT, strikeT: t.strikeT, firstKickT: t.firstKickT, events: t.events, dur, frames }));
  console.log(name, dur.toFixed(2), "strike", t.strikeT, "goal", t.goalT, t.bodies.map(b => b.id + ":" + b.role).join(" "), t.events.map(e => e.kind + "@" + e.t.toFixed(2) + ":" + (e.who ?? "")).join(" "));
}
