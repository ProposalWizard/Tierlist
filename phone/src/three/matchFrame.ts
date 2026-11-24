/**
 * THE REAL MATCH, READ FRAME BY FRAME, for the 3D match view (the website's CanvasMatch "Hand the frame to a reader",
 * lib/star/engineFrame.ts). Pure and read only: it reads the phone's one match driver (src/match/driver.ts) and the
 * list of men the pitch draws (src/match/menNow.ts, the same list the 2D picture draws) and returns an `EngineFrame`:
 * every man where the 2D picture puts him, the keeper and his dive, the ball with its height, the aim arrow, the
 * camera. It never decides, simulates or writes anything back, and it makes no random number (the match's parity
 * check does not move). No React and no phone-only imports besides the match's own, so the headless check builds
 * the very same frames (tools/match-view-check.ts).
 *
 * Not carried over (the website's frame has them, the phone's match has no such part or they are off by default):
 * the lead-in, the golden run-up's trail, your goal-celebration clip (Leo's update "celebrations" is off by default).
 */
import { goalInView, orderableRunners, acceptsCaptainOrders, OUTCOME_TEXT, type Runner } from "@/lib/star/canvasEngine";
import { keeperFrame, frameHasKeeper, type EngineFrame, type EngineFrameFigure, type EngineFrameOrders } from "@/lib/star/engineFrame";
import { keeperKit, type MatchKits } from "@/lib/star/kits";
import { autoKickOf } from "@/lib/star/penaltyTaking";
import { footSign } from "@/lib/star/kickFoot";
import { camFor } from "../match/drawPitch";
import { actorAct } from "../match/figures";
import { drawnMen } from "../match/menNow";
import { grabMetres } from "../match/view";
import type { MatchDriver } from "../match/driver";

/** How long your kick pose shows after the strike (figures.ts KICK_POSE_S). */
const KICK_POSE_S = 0.28;

/** The phases the 3D picture is drawn for: a chance in play. The feed (the commentary), full time and the top-down dribble are the app's own screens. */
export function viewDrawsPhase(phase: string): boolean {
  return phase !== "feed" && phase !== "done" && phase !== "tdDribble";
}

let strikeBall: unknown = null;
let strikeAt = 0;

/** The captain's orders, as CanvasMatch's captainOrdersFrame builds them (the drag in the thumb is not carried). */
function ordersOf(d: MatchDriver): EngineFrameOrders | null {
  if (!d.isCaptain || d.phase !== "aim" || !acceptsCaptainOrders(d.sc.kind)) return null;
  const s = d.sc;
  const runners = orderableRunners(s);
  const all = [s.runner, ...s.secondaryRunners].filter(Boolean) as Runner[];
  const pickable = runners.map((r) => `run${all.indexOf(r)}`).filter((id) => id !== "run-1");
  if (goalInView(s.kind)) pickable.push("follower");
  const runs: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  for (const r of runners) if (r.commandedTo) runs.push({ from: { x: r.pos.x, y: r.pos.y }, to: { x: r.commandedTo.x, y: r.commandedTo.y } });
  if (s.follower.commandedTo) runs.push({ from: { x: s.follower.x, y: s.follower.y }, to: { x: s.follower.commandedTo.x, y: s.follower.commandedTo.y } });
  const relay = s.relayTo ? { x: s.relayTo.pos.x, y: s.relayTo.pos.y } : s.relayToFollower ? { x: s.follower.x, y: s.follower.y } : null;
  return { pickable, runs, relay, drag: null };
}

/** What the 3D view needs of this frame. Call it after the frame is drawn (the men's animations are read from the figures). */
export function engineFrameOf(d: MatchDriver, kits: MatchKits, W: number, H: number): EngineFrame {
  const sc = d.sc;
  const cam = camFor(d, W, H);
  const b = d.ball;
  if (b !== strikeBall) { strikeBall = b; strikeAt = d.now; }
  const kickAge = b ? (d.now - strikeAt) / 1000 : null;
  const foot = footSign(d.setup.career?.player.preferredFoot);
  const home = d.setup.fixture.home !== false;
  const ours = home ? kits.home : kits.away, theirs = home ? kits.away : kits.home;
  const auto = autoKickOf(sc);

  const figures: EngineFrameFigure[] = drawnMen(d).map((m) => {
    const kit = m.role === "opp" ? theirs : ours;
    const you = m.id === "you";
    return {
      sid: m.id, x: m.p.x, y: m.p.y, shirt: kit.shirt, shorts: kit.trim, team: m.role === "opp" ? "them" : "us",
      kick: you && kickAge !== null && kickAge < KICK_POSE_S, kickFoot: you ? foot : 1,
      act: you ? undefined : actorAct(m.id), star: m.hi, label: m.label, drawn: true,
    };
  });

  const scene = d.feature?.scene;
  const goalOnCamera = cam.facing === "up" && cam.vp.y1 < 1.5;
  const keeperDrawn = (goalInView(sc.kind) || goalOnCamera) && scene?.keeper !== false;
  let keeper: EngineFrame["keeper"] = null;
  if (frameHasKeeper(scene?.keeper)) {
    // Their penalty at YOUR keeper (a shootout): he wears your keeper's kit.
    const gk = auto?.side === "them" ? keeperKit(ours.shirt, kits.keeper.shirt) : kits.keeper;
    keeper = keeperFrame(sc.keeper, gk, undefined, actorAct("keeper"), keeperDrawn);
  }

  // The aim arrow (CanvasMatch drawAimArrow's tip): the drag, or the run-up's line.
  let aim: EngineFrame["aim"] = null;
  if (d.drag && d.phase === "aim") {
    const ball = sc.ball;
    const power = d.dragPower((drag, bl) => {
      // screenPull is the touch layer's; the arrow's length needs only the share of full power
      return Math.min(1, Math.hypot(drag.x - bl.x, drag.y - bl.y) / Math.max(1, grabMetres(cam, 1)));
    });
    const dx = ball.x - d.drag.x, dy = ball.y - d.drag.y, len = Math.hypot(dx, dy) || 1;
    const lineLen = power * grabMetres(cam, 1) * 0.132;
    aim = { from: { x: ball.x, y: ball.y }, to: { x: ball.x + (dx / len) * lineLen, y: ball.y + (dy / len) * lineLen }, power };
  }

  // Which side's men celebrate (drawPitch celebrating / CanvasMatch goalSideRef): a goal in the result phase.
  const goalSide: "us" | "them" | null = d.phase === "result" && d.outcome && OUTCOME_TEXT[d.outcome].kind === "goal" ? (auto?.side === "them" ? "them" : "us") : null;
  const ru = d.runup;
  return {
    t: d.now / 1000,
    phase: d.phase,
    kind: sc.kind,
    cam: { viewport: { ...cam.vp }, facing: cam.facing, tilt: cam.tilt, W, H },
    ball: b
      ? { x: b.pos.x, y: b.pos.y, z: b.z, vx: b.vel.x, vy: b.vel.y, vz: b.vz, live: true, inNet: !!b.inNet }
      : { x: sc.ball.x, y: sc.ball.y, z: 0, vx: 0, vy: 0, vz: 0, live: false, inNet: false },
    landing: b && d.phase === "flight" && !b.inNet && b.z > 0.15 && b.landAt ? { ...b.landAt } : null,
    keeper,
    figures,
    aim,
    ring: null,
    goalSide,
    celebrating: false,
    goalInView: goalInView(sc.kind) || goalOnCamera,
    orders: ordersOf(d),
    runup: d.phase === "runup" && ru ? { t: ru.t, runS: ru.runS } : null,
    goldTrail: null,
    leadIn: null,
  };
}
