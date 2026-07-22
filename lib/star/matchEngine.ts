import type { CareerState, Skills, MatchStats, Fixture } from "./types";
import { mulberry32 } from "./season";

export type EventKind = "SHOOT" | "PASS" | "CROSS" | "LONG_SHOT" | "HEADER" | "THROUGH_BALL";

export interface PlayableEvent {
  kind: EventKind;
  minute: number;
  ball: { x: number; y: number };
  player: { x: number; y: number };
  teammates: { x: number; y: number; id: string; run: boolean }[];
  defenders: { x: number; y: number }[];
  goalkeeper: { x: number; y: number };
  goal: { x1: number; x2: number; y: number };
  prompt: string;
  difficulty: number;
  offsideLine: number;
}

export interface EventResult {
  success: boolean;
  goal: boolean;
  assist: boolean;
  keyPass: boolean;
  offside: boolean;
  intended: EventKind;
  actual: EventKind;
  narrative: string;
}

export interface MatchScript {
  events: (PlayableEvent | { minute: number; commentary: string })[];
  oppStrength: number;
  fixture: Fixture;
  seed: number;
}

// ---------- SCENE GENERATION ----------
// Goal is at y=0 (top of pitch). Attacking direction is upward.
// Coords: x 0-100 (left-right), y 0-100 (goal at top -> user's own half at bottom)

function generateScene(kind: EventKind, rng: () => number): {
  ball: { x: number; y: number };
  teammates: PlayableEvent["teammates"];
  defenders: PlayableEvent["defenders"];
  goalkeeper: { x: number; y: number };
  offsideLine: number;
} {
  const goalkeeper = { x: 46 + rng() * 8, y: 4 };

  switch (kind) {
    case "SHOOT": {
      // Ball 15-25% from top, in shooting range
      const ball = { x: 30 + rng() * 40, y: 18 + rng() * 8 };
      // 2 defenders between ball and goal
      const defenders = [
        { x: Math.max(30, ball.x - 8 + rng() * 4), y: Math.max(8, ball.y - 6 - rng() * 4) },
        { x: Math.min(70, ball.x + 8 - rng() * 4), y: Math.max(8, ball.y - 8 - rng() * 4) },
      ];
      // 1-2 supporting teammates in the box
      const teammates = [
        { id: "t0", x: 30 + rng() * 40, y: Math.max(10, ball.y - 4 - rng() * 6), run: rng() < 0.4 },
      ];
      if (rng() < 0.5) teammates.push({ id: "t1", x: 30 + rng() * 40, y: Math.max(8, ball.y - 6 - rng() * 4), run: rng() < 0.3 });
      const offsideLine = Math.min(...defenders.map((d) => d.y));
      return { ball, teammates, defenders, goalkeeper, offsideLine };
    }

    case "HEADER": {
      // Very close to goal — in the six-yard area
      const ball = { x: 40 + rng() * 20, y: 10 + rng() * 6 };
      const defenders = [
        { x: 38 + rng() * 8, y: 7 + rng() * 4 },
        { x: 54 + rng() * 8, y: 7 + rng() * 4 },
      ];
      const teammates = [
        { id: "t0", x: 32 + rng() * 12, y: 14 + rng() * 6, run: false },
        { id: "t1", x: 56 + rng() * 12, y: 14 + rng() * 6, run: false },
      ];
      const offsideLine = Math.min(...defenders.map((d) => d.y));
      return { ball, teammates, defenders, goalkeeper, offsideLine };
    }

    case "LONG_SHOT": {
      // Outside the box
      const ball = { x: 30 + rng() * 40, y: 32 + rng() * 10 };
      const defenders = [
        { x: 40 + rng() * 8, y: 20 + rng() * 8 },
        { x: 52 + rng() * 8, y: 20 + rng() * 8 },
        { x: 38 + rng() * 8, y: 15 + rng() * 5 },
      ];
      const teammates = [
        { id: "t0", x: 32 + rng() * 36, y: 22 + rng() * 8, run: rng() < 0.3 },
      ];
      const offsideLine = Math.min(...defenders.map((d) => d.y));
      return { ball, teammates, defenders, goalkeeper, offsideLine };
    }

    case "PASS": {
      // Central midfield — teammates spread out as options
      const ball = { x: 30 + rng() * 40, y: 45 + rng() * 15 };
      const teammates = [
        { id: "t0", x: 12 + rng() * 18, y: ball.y - 10 - rng() * 10, run: rng() < 0.5 },    // wide left
        { id: "t1", x: 70 + rng() * 18, y: ball.y - 10 - rng() * 10, run: rng() < 0.5 },    // wide right
        { id: "t2", x: 40 + rng() * 20, y: ball.y - 15 - rng() * 10, run: rng() < 0.4 },    // ahead central
        { id: "t3", x: 25 + rng() * 50, y: ball.y + 5 + rng() * 10, run: false },           // back option
      ];
      const defenders = [
        { x: ball.x - 8 + rng() * 4, y: ball.y - 5 - rng() * 5 },
        { x: ball.x + 8 - rng() * 4, y: ball.y - 5 - rng() * 5 },
      ];
      const offsideLine = 25 + rng() * 10;
      return { ball, teammates, defenders, goalkeeper, offsideLine };
    }

    case "CROSS": {
      // Ball wide on either wing
      const leftSide = rng() < 0.5;
      const ball = { x: leftSide ? 6 + rng() * 12 : 82 + rng() * 12, y: 18 + rng() * 12 };
      // Teammates crashing the box
      const teammates = [
        { id: "t0", x: 35 + rng() * 8, y: 14 + rng() * 8, run: true },
        { id: "t1", x: 48 + rng() * 6, y: 12 + rng() * 6, run: true },
        { id: "t2", x: 58 + rng() * 8, y: 15 + rng() * 8, run: true },
      ];
      // Defenders marking
      const defenders = [
        { x: 37 + rng() * 6, y: 10 + rng() * 6 },
        { x: 50 + rng() * 6, y: 8 + rng() * 6 },
        { x: 60 + rng() * 6, y: 10 + rng() * 6 },
      ];
      const offsideLine = Math.min(...defenders.map((d) => d.y));
      return { ball, teammates, defenders, goalkeeper, offsideLine };
    }

    case "THROUGH_BALL": {
      // Central mid, teammates making runs behind the defence
      const ball = { x: 35 + rng() * 30, y: 40 + rng() * 12 };
      // Offside line — defenders in a line
      const defLineY = 22 + rng() * 8;
      const defenders = [
        { x: 32 + rng() * 6, y: defLineY + rng() * 3 },
        { x: 46 + rng() * 6, y: defLineY + rng() * 3 },
        { x: 60 + rng() * 6, y: defLineY + rng() * 3 },
      ];
      const offsideLine = Math.min(...defenders.map((d) => d.y));
      // Some teammates onside, some potentially offside
      const teammates = [
        { id: "t0", x: 32 + rng() * 16, y: offsideLine - 2 + rng() * 6, run: true },  // near onside
        { id: "t1", x: 52 + rng() * 16, y: offsideLine - 6 - rng() * 6, run: true },  // possibly offside
        { id: "t2", x: 40 + rng() * 20, y: offsideLine + 2 + rng() * 4, run: true },  // onside behind line
      ];
      return { ball, teammates, defenders, goalkeeper, offsideLine };
    }
  }
}

// ---------- SCRIPT ----------

export function buildMatchScript(
  career: CareerState,
  fixture: Fixture,
  oppStrength: number,
): MatchScript {
  const seed = (fixture.week * 7919) ^ Math.floor(career.starRating * 100) ^ oppStrength;
  const rng = mulberry32(seed);

  const baseEvents = 8;
  const teamBonus = Math.floor(career.relationships.team / 20);
  const totalPlayable = baseEvents + teamBonus + Math.floor(rng() * 3);

  const minutes: number[] = [];
  for (let i = 0; i < totalPlayable; i++) {
    minutes.push(5 + Math.floor(rng() * 83));
  }
  minutes.sort((a, b) => a - b);

  const events: (PlayableEvent | { minute: number; commentary: string })[] = [];

  const isAttacker = ["ST", "CAM", "LW", "RW"].includes(career.player.position);
  const isMid = ["CM", "CDM", "LM", "RM"].includes(career.player.position);

  for (const minute of minutes) {
    let kindPool: EventKind[];
    if (isAttacker) {
      kindPool = ["SHOOT", "SHOOT", "PASS", "HEADER", "LONG_SHOT", "THROUGH_BALL", "CROSS"];
    } else if (isMid) {
      kindPool = ["PASS", "PASS", "SHOOT", "LONG_SHOT", "THROUGH_BALL", "CROSS"];
    } else {
      kindPool = ["PASS", "PASS", "PASS", "CROSS", "LONG_SHOT"];
    }
    const kind = kindPool[Math.floor(rng() * kindPool.length)];

    const scene = generateScene(kind, rng);
    const goal = { x1: 40, x2: 60, y: 0 };

    const difficulty = 0.25 + rng() * 0.4 + (oppStrength - 65) / 250;

    events.push({
      kind,
      minute,
      ball: scene.ball,
      player: scene.ball,
      teammates: scene.teammates,
      defenders: scene.defenders,
      goalkeeper: scene.goalkeeper,
      goal,
      prompt: promptForKind(kind),
      difficulty: Math.max(0.1, Math.min(0.9, difficulty)),
      offsideLine: scene.offsideLine,
    });

    if (rng() < 0.55) {
      events.push({ minute: minute - 1, commentary: randomCommentary(rng, career, fixture) });
    }
  }

  events.sort((a, b) => ("minute" in a ? a.minute : 0) - ("minute" in b ? b.minute : 0));
  return { events, oppStrength, fixture, seed };
}

function promptForKind(kind: EventKind): string {
  return { SHOOT: "SHOOT!", PASS: "PASS", CROSS: "CROSS", LONG_SHOT: "LONG SHOT", HEADER: "HEADER!", THROUGH_BALL: "THROUGH BALL" }[kind];
}

function randomCommentary(rng: () => number, career: CareerState, fixture: Fixture): string {
  const home = fixture.home ? career.player.club : fixture.opponent;
  const away = fixture.home ? fixture.opponent : career.player.club;
  const options = [
    `${home} start on the front foot.`,
    `A cagey opening from both sides.`,
    `${away} threaten but the shot is deflected.`,
    `A tight midfield battle unfolds.`,
    `Good pressing from ${away}.`,
    `${home} work it wide, looking for space.`,
    `Chance turned away by the defence.`,
    `A rare mistake gives ${away} a sniff.`,
    `The tempo is picking up.`,
    `A promising move breaks down.`,
    `The referee shows a yellow card.`,
    `Great save from the keeper!`,
    `The crowd is getting behind their team.`,
  ];
  return options[Math.floor(rng() * options.length)];
}

// ---------- RESOLUTION ----------

const NEAR_TEAMMATE_RADIUS = 6;

export function resolveEvent(
  event: PlayableEvent,
  target: { x: number; y: number },
  power: number,
  skills: Skills,
  rng: () => number,
): EventResult {
  // First check: did the user tap on a teammate?
  let nearestMate: PlayableEvent["teammates"][0] | null = null;
  let nearestDist = 999;
  for (const m of event.teammates) {
    const d = Math.hypot(m.x - target.x, m.y - target.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearestMate = m;
    }
  }
  const tappedTeammate = nearestMate && nearestDist < NEAR_TEAMMATE_RADIUS ? nearestMate : null;

  // Is the tap point inside the goal frame?
  const tappedGoal =
    target.x >= event.goal.x1 &&
    target.x <= event.goal.x2 &&
    target.y >= -2 &&
    target.y <= 6;

  // Determine actual event kind. If SHOOT/LONG_SHOT/HEADER but user tapped a teammate: convert to PASS
  const isNominallyShot = event.kind === "SHOOT" || event.kind === "LONG_SHOT" || event.kind === "HEADER";
  const isNominallyPass = event.kind === "PASS" || event.kind === "CROSS" || event.kind === "THROUGH_BALL";

  let actual: EventKind = event.kind;
  if (isNominallyShot && tappedTeammate && !tappedGoal) actual = "PASS";
  if (isNominallyPass && tappedGoal) actual = "SHOOT"; // less common but possible

  const actIsShot = actual === "SHOOT" || actual === "LONG_SHOT" || actual === "HEADER";
  const actIsPass = actual === "PASS" || actual === "CROSS" || actual === "THROUGH_BALL";

  // Skill affects deviation from intended target
  const tech = actIsPass ? (skills.vision + skills.technique) / 2 : skills.technique;
  const shotPower = skills.power;
  const distFromBall = Math.hypot(target.x - event.ball.x, target.y - event.ball.y);
  const distancePenalty = Math.min(1, distFromBall / 80);          // longer aim = more deviation

  // Deviation is much tighter now — a 40-tech player only wobbles ~3-4 units
  const deviation = (1 - tech / 100) * 4 * (0.5 + rng() * 0.6) * (0.6 + distancePenalty * 0.8);
  const angle = rng() * Math.PI * 2;
  const actualX = target.x + Math.cos(angle) * deviation;
  const actualY = target.y + Math.sin(angle) * deviation;

  // ---------- SHOT RESOLUTION ----------
  if (actIsShot) {
    const inGoalX = actualX >= event.goal.x1 - 2 && actualX <= event.goal.x2 + 2;
    const inGoalY = actualY <= 4;
    const onTarget = inGoalX && inGoalY;

    // Block: any defender between ball and target
    let blocked = false;
    for (const d of event.defenders) {
      const t = closestPointOnLineParam(event.ball, target, d);
      if (t > 0.1 && t < 0.9) {
        const px = event.ball.x + (target.x - event.ball.x) * t;
        const py = event.ball.y + (target.y - event.ball.y) * t;
        const dist = Math.hypot(d.x - px, d.y - py);
        if (dist < 3.5) { blocked = true; break; }
      }
    }
    if (blocked) return {
      success: false, goal: false, assist: false, keyPass: false, offside: false,
      intended: event.kind, actual, narrative: "Blocked by a defender!",
    };

    if (!onTarget) {
      const overBar = actualY < 0;
      return {
        success: false, goal: false, assist: false, keyPass: false, offside: false,
        intended: event.kind, actual,
        narrative: overBar ? "Over the bar!" : "Wide of the post.",
      };
    }

    // On target — keeper save check
    const keeperReach = 10 + shotPower / 20;   // range keeper can reach
    const keeperDist = Math.hypot(actualX - event.goalkeeper.x, actualY - event.goalkeeper.y);
    const powerBonus = 0.15 + power * 0.25;    // stronger shot = harder to save
    const saveChance = Math.max(0, Math.min(0.7, (keeperReach - keeperDist) / keeperReach * 0.55 - powerBonus));
    if (rng() < saveChance) {
      return {
        success: false, goal: false, assist: false, keyPass: false, offside: false,
        intended: event.kind, actual, narrative: "Saved by the keeper!",
      };
    }

    return {
      success: true, goal: true, assist: false, keyPass: false, offside: false,
      intended: event.kind, actual, narrative: "GOAL!",
    };
  }

  // ---------- PASS RESOLUTION ----------
  if (actIsPass) {
    // Find target teammate
    let mate: PlayableEvent["teammates"][0] | null = null;
    let d = 999;
    for (const m of event.teammates) {
      const dist = Math.hypot(m.x - actualX, m.y - actualY);
      if (dist < d) { d = dist; mate = m; }
    }
    if (!mate || d > 12) {
      return {
        success: false, goal: false, assist: false, keyPass: false, offside: false,
        intended: event.kind, actual, narrative: "Overhit — out of play.",
      };
    }

    // Interception check — defender crossing the pass line
    for (const def of event.defenders) {
      const t = closestPointOnLineParam(event.ball, { x: mate.x, y: mate.y }, def);
      if (t > 0.15 && t < 0.85) {
        const px = event.ball.x + (mate.x - event.ball.x) * t;
        const py = event.ball.y + (mate.y - event.ball.y) * t;
        const interceptDist = Math.hypot(def.x - px, def.y - py);
        const interceptChance = interceptDist < 3 ? 0.5 : interceptDist < 5 ? 0.2 : 0;
        if (rng() < interceptChance) {
          return {
            success: false, goal: false, assist: false, keyPass: false, offside: false,
            intended: event.kind, actual, narrative: "Intercepted!",
          };
        }
      }
    }

    // Offside — for through balls (and crosses to a striker beyond the line)
    if ((actual === "THROUGH_BALL" || actual === "CROSS") && mate.y < event.offsideLine - 1) {
      return {
        success: false, goal: false, assist: false, keyPass: false, offside: true,
        intended: event.kind, actual, narrative: "Flag's up — offside!",
      };
    }

    // Chance the teammate scores from a great pass
    const scoreChance = actual === "THROUGH_BALL" ? 0.42 : actual === "CROSS" ? 0.30 : 0.14;
    // Bonus if it's a proper pass conversion from a shot event (user picked a smart pass over a shot)
    const conversionBonus = event.kind !== actual ? 0.1 : 0;
    if (rng() < scoreChance + conversionBonus) {
      return {
        success: true, goal: false, assist: true, keyPass: true, offside: false,
        intended: event.kind, actual, narrative: "ASSIST! Your teammate finishes it!",
      };
    }

    return {
      success: true, goal: false, assist: false, keyPass: false, offside: false,
      intended: event.kind, actual, narrative: "Neat pass to a teammate.",
    };
  }

  return { success: false, goal: false, assist: false, keyPass: false, offside: false, intended: event.kind, actual, narrative: "" };
}

// Helper: parametric position of the perpendicular foot from p onto segment a-b
function closestPointOnLineParam(a: { x: number; y: number }, b: { x: number; y: number }, p: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

// ---------- MATCH STATS ----------

export function finaliseMatch(
  chances: number,
  goals: number,
  assists: number,
  passes: number,
  minutes: number,
  userScore: number,
  oppScore: number,
  career: CareerState,
): MatchStats {
  const result = userScore > oppScore ? 0.4 : userScore < oppScore ? -0.3 : 0.1;
  let rating = 6.0
    + goals * 1.2
    + assists * 0.8
    + passes * 0.05
    + result;
  rating = Math.max(1, Math.min(10, rating));

  const starMan = rating >= 8.5 || goals >= 2;
  const wage = career.contract.wage;
  const goalBonus = goals * career.contract.goalBonus;
  const assistBonusPay = assists * career.contract.assistBonus;
  const sponsorPay = Math.floor(career.relationships.sponsors / 20);
  const totalCash = wage + goalBonus + assistBonusPay + sponsorPay;

  let boss = 0, team = 0, fans = 0;
  if (rating >= 8) { boss += 6; fans += 8; team += 3; }
  else if (rating >= 7) { boss += 3; fans += 4; team += 2; }
  else if (rating >= 6) { boss += 1; fans += 1; team += 1; }
  else if (rating >= 5) { boss -= 2; fans -= 2; team -= 1; }
  else { boss -= 5; fans -= 4; team -= 3; }
  if (goals > 0) fans += goals * 3;
  if (assists > 0) { team += assists * 3; fans += assists; }
  if (starMan) { boss += 4; fans += 5; team += 2; }

  return {
    chances,
    goals,
    assists,
    passes,
    rating: Math.round(rating * 10) / 10,
    starMan,
    bossChange: boss,
    teamChange: team,
    fansChange: fans,
    wage,
    goalBonus: goalBonus + assistBonusPay,
    sponsorPay,
    totalCash,
    homeScore: userScore,
    awayScore: oppScore,
  };
}
