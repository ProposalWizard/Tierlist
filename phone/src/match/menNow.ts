/**
 * WHO IS ON THE PITCH THIS FRAME: the one list the pitch draws (drawPitch.ts) and the
 * pop-in check reads (tools/match-popin.ts), in CanvasMatch's order and with its names
 * (sids: def0…, mate0…, run0…, follower, you). The keeper is not on it (he has his own drawing).
 */
import { autoKickOf } from "@/lib/star/penaltyTaking";
import { goalInView } from "@/lib/star/canvasEngine";
import type { MatchDriver } from "./driver";

export interface DrawnMan {
  id: string;
  p: { x: number; y: number };
  role: "you" | "mate" | "opp";
  /** The gold star over him. */
  hi: boolean;
  /** A taker's name over his head (a penalty someone else takes). */
  label?: string;
}

export function drawnMen(d: MatchDriver): DrawnMan[] {
  const out: DrawnMan[] = [];
  if (d.phase === "tdDribble" && d.td) {
    const run = d.td;
    run.mates.forEach((m, i) => out.push({ id: `mate${i}`, p: m, role: "mate", hi: false }));
    run.defenders.forEach((df, i) => { if (df.phase !== "beaten") out.push({ id: `chase${i}`, p: df, role: "opp", hi: false }); });
    out.push({ id: "you", p: { x: run.x, y: run.y }, role: "you", hi: true });
    return out;
  }
  const sc = d.sc;
  const scene = d.feature?.scene;
  sc.defenders.forEach((df, i) => out.push({ id: `def${i}`, p: df, role: "opp", hi: false }));
  sc.teammates.forEach((m, i) => out.push({ id: `mate${i}`, p: m, role: "mate", hi: false }));
  // CanvasMatch's sids (and the engine's actors, canvasEngine runnerActor): run0 the runner, then the others.
  [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners].forEach((r, i) => out.push({ id: `run${i}`, p: r.pos, role: "mate", hi: sc.relayTo === r }));
  // The poacher: on every chance with the goal in the picture, from its first frame, and on no other
  // (CanvasMatch: `goalInView(sc.kind) && scene.teammates !== false`). He was drawn only once the engine
  // woke him ("active"), so on a pass in midfield a man came up out of nowhere while the ball was in flight.
  if (sc.follower && goalInView(sc.kind) && scene?.teammates !== false) out.push({ id: "follower", p: sc.follower, role: "mate", hi: !!sc.relayToFollower });
  if (scene?.you !== false) {
    // A penalty someone else takes (a shootout, the trial's takers): he wears his own side's kit,
    // named over his head, no star (CanvasMatch: takerKit, label, labelBig).
    const auto = autoKickOf(sc);
    if (auto) out.push({ id: "you", p: sc.player, role: auto.side === "them" ? "opp" : "mate", hi: false, label: auto.taker.shortName });
    else out.push({ id: "you", p: sc.player, role: "you", hi: true });
  }
  return out;
}
