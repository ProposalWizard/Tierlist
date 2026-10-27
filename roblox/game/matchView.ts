/**
 * What the Roblox match draws this frame, read from the match state
 * (roblox/game/match.ts). Everything is in pitch metres: x across (0..68),
 * y out from the goal line you attack (0 = the line), z up. Roblox turns
 * these into studs and draws; it decides nothing.
 */
import * as M from "./match";
import { shortClub } from "../../lib/star/media/grammar";
import { CX } from "../../lib/star/pitch";

export interface Body {
  /** Stable while the chance lasts, so Roblox can move the same figure. */
  id: string;
  side: "you" | "mate" | "opp" | "keeper";
  x: number;
  y: number;
  name?: string;
  /** A man you can pass to (the dribble's team-mates, the pass target). */
  option?: boolean;
  /** The keeper's lean or dive, metres sideways (+ = towards pitch x). */
  dive?: number;
}

export interface Frame {
  phase: string;
  /** How Roblox frames it: the chance's own camera, behind you (the dribble), or the broadcast view (the commentary). */
  cameraMode: "chance" | "chase" | "broadcast";
  minute: number;
  score: { us: number; them: number; usName: string; themName: string; home: boolean };
  kits: ReturnType<typeof M.matchKits>;
  bodies: Body[];
  ball: { x: number; y: number; z: number } | null;
  /** The camera's framing, pitch metres; `facing` "up" = looking at the goal. */
  camera: { x1: number; x2: number; y1: number; y2: number; facing: string; tilt: number };
  goal: { x1: number; x2: number; crossbar: number };
  aim: { dir: { x: number; y: number }; power: number } | null;
  passTarget: { x: number; y: number } | null;
  feed: string[];
  log: { minute: number | null; text: string; tone: string }[];
  banner: string | null;
  pause: { label: string | null; cta: string; halfTime: boolean; kib: number } | null;
  energy: number;
  stamina: { v: number; cap: number; sprint: boolean } | null;
  speed: number;
  energyMode: string;
  playstyle: string;
  controls: ReturnType<typeof M.controlsOf>;
  shootout: { us: number; them: number; kicks: number } | null;
}

const BANNER_S = 1.4;

export function frameOf(m: M.MatchState): Frame {
  const sc = m.sc;
  const bodies: Body[] = [];
  let ball: Frame["ball"] = null;
  if (m.phase === "tdDribble" && m.td) {
    const run = m.td;
    bodies.push({ id: "you", side: "you", x: run.x, y: run.y, name: m.career.player.lastName });
    run.defenders.forEach((d, i) => bodies.push({ id: `fd${i}`, side: "opp", x: d.x, y: d.y }));
    run.mates.forEach((t, i) => bodies.push({ id: `fm${i}`, side: "mate", x: t.x, y: t.y, option: true }));
    bodies.push({ id: "keeper", side: "keeper", x: CX, y: 0.6 });
    ball = { x: run.x, y: run.y - 0.6, z: 0 };
  } else if (sc) {
    bodies.push({ id: "you", side: "you", x: sc.player.x, y: sc.player.y, name: m.career.player.lastName });
    bodies.push({ id: "keeper", side: "keeper", x: sc.keeper.x, y: sc.keeper.y, name: sc.keeper.who?.shortName, dive: sc.keeper.dive });
    sc.defenders.forEach((d, i) => bodies.push({ id: `d${i}`, side: "opp", x: d.x, y: d.y, name: (d as { who?: { shortName: string } }).who?.shortName }));
    sc.teammates.forEach((t, i) => bodies.push({ id: `t${i}`, side: "mate", x: t.x, y: t.y, name: t.who?.shortName }));
    if (sc.runner) bodies.push({ id: "runner", side: "mate", x: sc.runner.pos.x, y: sc.runner.pos.y, name: sc.runner.who?.shortName, option: true });
    sc.secondaryRunners.forEach((r, i) => bodies.push({ id: `r${i}`, side: "mate", x: r.pos.x, y: r.pos.y, name: r.who?.shortName, option: true }));
    if (sc.follower) bodies.push({ id: "follower", side: "mate", x: sc.follower.x, y: sc.follower.y, name: sc.follower.who?.shortName });
    ball = m.ball ? { x: m.ball.pos.x, y: m.ball.pos.y, z: m.ball.z } : { x: sc.ball.x, y: sc.ball.y, z: 0 };
  }
  const shown = M.displayScore(m);
  const us = m.career.player.club, them = m.fixture.opponent;
  const ls = m.liveShootout;
  const usHome = ls ? ls.yourSide === "home" : true;
  return {
    phase: m.phase,
    cameraMode: m.phase === "feed" ? "broadcast" : m.phase === "tdDribble" ? "chase" : "chance",
    minute: m.minute,
    score: { us: shown.user, them: shown.opp, usName: shortClub(us), themName: shortClub(them), home: m.fixture.home },
    kits: M.matchKits(m),
    bodies,
    ball,
    camera: { ...m.camera, facing: m.facing, tilt: m.tiltDeg },
    goal: { x1: sc ? sc.goal.x1 : M.POST_L, x2: sc ? sc.goal.x2 : M.POST_R, crossbar: sc ? sc.crossbar : 2.44 },
    aim: M.aimPreview(m),
    passTarget: sc?.passTarget ? { x: sc.passTarget.x, y: sc.passTarget.y } : null,
    feed: m.feed.slice(),
    log: m.log.slice(-8).map((l) => ({ minute: l.minute ?? null, text: l.text, tone: l.tone })),
    banner: m.banner && m.now - m.banner.at < BANNER_S ? m.banner.text : null,
    pause: m.pause ? { label: m.pause.label ?? null, cta: m.pause.cta, halfTime: !!m.pause.halfTime, kib: Math.max(0, (m.career.kibCans?.basic ?? 0) - m.kibUsed) } : null,
    energy: M.energyNow(m),
    stamina: M.staminaNow(m),
    speed: m.speed,
    energyMode: m.energyMode,
    playstyle: m.playstyle,
    controls: M.controlsOf(m),
    shootout: ls ? { us: usHome ? ls.state.homeScore : ls.state.awayScore, them: usHome ? ls.state.awayScore : ls.state.homeScore, kicks: ls.state.kicks.length } : null,
  };
}
