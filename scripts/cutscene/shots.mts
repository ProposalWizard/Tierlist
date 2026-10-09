// Print a script's shot list and its film-rules score, for a hand-made scene or a generated one.
//   npx tsx scripts/cutscene/shots.mts signing          (a hand-made scene)
//   npx tsx scripts/cutscene/shots.mts scored 0.8 joy 3   (event, stakes, feeling, seed)
import { FIXTURES } from "../../lib/star/cutscene/fixtures";
import { generateScript, scoreScript } from "../../lib/star/cutscene/generate";
import type { CameraTrack, Emotion, EventKind } from "../../lib/star/cutscene/types";

const [a, stakes, emo, seed] = process.argv.slice(2);
const s = FIXTURES[a] ? FIXTURES[a]() : generateScript({ kind: a as EventKind, stakes: Number(stakes ?? 0.7), emotion: (emo ?? "joy") as Emotion, intensity: 0.6 }, Number(seed ?? 1));
const q = scoreScript(s);
console.log(`${s.title}  ${s.duration.toFixed(1)} s  ${s.set.location} / ${s.set.mood}  shot rules ${(q.score * 100).toFixed(0)}%  ${q.notes.join("; ")}`);
if (s.text?.notes) console.log(`plan: ${s.text.notes}`);
for (const b of s.beats ?? []) console.log(`  beat ${b.at.toFixed(1)}–${(b.at + b.dur).toFixed(1)}  ${b.act}: ${b.name}`);
for (const c of s.tracks.filter((t): t is CameraTrack => t.type === "camera")) console.log(`  shot ${c.at.toFixed(1)}+${c.dur.toFixed(1)}  ${c.shot.preset}${c.shot.move ? ` (${c.shot.move})` : ""}  ${c.name ?? ""}`);
