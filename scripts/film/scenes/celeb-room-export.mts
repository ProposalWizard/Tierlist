/**
 * One recording's celebration, seen from above, before and with room (chat 1, 25 Oct 2026).
 *   npx tsx scripts/film/scenes/celeb-room-export.mts <clips.json> <clipId> <out.json>
 */
import fs from "node:fs";
import { trackFromStored, frameAt } from "../../../lib/star/goalClip/track";
import { planCelebration, roomFor, type CelebrationMove } from "../../../lib/star/celebration";
const [file, id, out] = process.argv.slice(2);
const row = JSON.parse(fs.readFileSync(file, "utf8")).find((r: { id: string }) => r.id === id);
const tr = trackFromStored(row.track)!; const cel = tr.meta.celebration!;
const plan = planCelebration({ x: cel.from[0], y: cel.from[1] }, cel.move as CelebrationMove);
const t0 = tr.goalT + cel.at, you = tr.bodies.findIndex((b) => b.id === "you");
const frames = [];
for (let k = 0; k < 8; k++) {
  const dt = 0.2 + k * 0.5, f = frameAt(tr, t0 + dt);
  frames.push({ dt, you: f.bodies[you], men: tr.bodies.map((b, i) => ({ id: b.id, side: b.side, raw: f.bodies[i], room: i === you || b.id === "keeper" ? f.bodies[i] : roomFor(plan, f.bodies[i], dt) })).filter((m) => m.id !== "you") });
}
fs.writeFileSync(out, JSON.stringify({ id, move: cel.move, from: plan.from, end: { x: plan.from.x + plan.dir.x * 20, y: plan.from.y + plan.dir.y * 20 }, frames }));
