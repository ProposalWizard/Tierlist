import type { PlayableEvent } from "./matchEngine";
import type { Skills } from "./types";

export interface FlightPoint {
  x: number;
  y: number;
  h: number;
}

export interface KickInput {
  dir: { x: number; y: number };
  power: number;
  contact: { cx: number; cy: number };
}

export interface SecondaryShot {
  path: FlightPoint[];
  outcome: "goal" | "saved" | "wide" | "post";
  narrative: string;
}

export interface KickResult {
  path: FlightPoint[];
  outcomeKind:
    | "goal"
    | "saved"
    | "wide"
    | "post"
    | "over"
    | "bar"
    | "blocked"
    | "intercepted"
    | "teammate"
    | "out"
    | "offside";
  narrative: string;
  goal: boolean; // user scored directly
  assist: boolean; // teammate scored from the pass (set from secondary)
  passCompleted: boolean;
  savePoint?: { x: number; y: number }; // where keeper dives to (for animation)
  secondary?: SecondaryShot; // teammate follow-up shot, animate after primary
}

// ---------- helpers ----------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

const PASS_KINDS = ["PASS", "CROSS", "THROUGH_BALL"];

// Find where a path crosses the goal line (y = goalY) travelling "up" (y decreasing).
// Returns the interpolated crossing info + the sample index at which the crossing segment ends.
function findGoalCrossing(
  path: FlightPoint[],
  goalY: number,
): { xCross: number; hCross: number; index: number } | null {
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const cur = path[i];
    if (prev.y > goalY && cur.y <= goalY) {
      const frac = (prev.y - goalY) / (prev.y - cur.y);
      return {
        xCross: prev.x + (cur.x - prev.x) * frac,
        hCross: prev.h + (cur.h - prev.h) * frac,
        index: i,
      };
    }
  }
  return null;
}

export function simulateKick(
  event: PlayableEvent,
  input: KickInput,
  skills: Skills,
  teamRelationship: number,
  oppStrength: number,
  rng: () => number,
): KickResult {
  const tech = skills.technique;
  const pow = skills.power;
  const { cx, cy } = input.contact;
  const goalY = event.goal.y; // 0
  const isPassKind = PASS_KINDS.includes(event.kind);

  // --- Direction noise (approx-normal) ---
  const sigma = (1 - tech / 100) * 5 + input.power * (1 - tech / 100) * 4;
  const noiseDeg = ((rng() + rng() + rng()) / 3 - 0.5) * 2 * sigma;
  const noiseRad = deg2rad(noiseDeg);
  const dlen = Math.hypot(input.dir.x, input.dir.y) || 1;
  const ux = input.dir.x / dlen;
  const uy = input.dir.y / dlen;
  const cosN = Math.cos(noiseRad);
  const sinN = Math.sin(noiseRad);
  const dir = {
    x: ux * cosN - uy * sinN,
    y: ux * sinN + uy * cosN,
  };

  // --- Loft angle (degrees) ---
  const theta = clamp(4 + ((cy + 1) / 2) * 62 + input.power * 4, 2, 72);

  // --- Distance ---
  const distFactor = 0.35 + 0.65 * Math.sin(deg2rad(clamp(2 * theta, 10, 178)));
  const D = input.power * (28 + pow * 0.45) * distFactor;

  // --- Curl ---
  const maxLateral = Math.abs(cx) * (2.5 + tech * 0.11);
  // n̂ = dir rotated -90°; striking the RIGHT side (cx>0) curves LEFT relative to travel.
  const nhat = { x: dir.y, y: -dir.x };
  const curlSign = Math.sign(cx);

  // --- Peak height ---
  const H = Math.min(25, (Math.tan(deg2rad(theta)) * D) / 4);

  const ball = event.ball;

  // --- Sample the aerial flight ---
  const SAMPLES = 48;
  const path: FlightPoint[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const lateral = curlSign * maxLateral * t * t;
    path.push({
      x: ball.x + dir.x * D * t + nhat.x * lateral,
      y: ball.y + dir.y * D * t + nhat.y * lateral,
      h: 4 * H * t * (1 - t),
    });
  }

  // --- Roll-out if the flight ends in-field back on the ground ---
  const last = path[path.length - 1];
  const inField = last.x >= 0 && last.x <= 100 && last.y >= 0 && last.y <= 100;
  if (inField) {
    const p0 = path[path.length - 2];
    const tdx = last.x - p0.x;
    const tdy = last.y - p0.y;
    const tlen = Math.hypot(tdx, tdy) || 1;
    const tx = tdx / tlen;
    const ty = tdy / tlen;
    const rollDist = 0.12 * D;
    for (let k = 1; k <= 8; k++) {
      const frac = 1 - Math.pow(1 - k / 8, 2); // ease-out (decelerating)
      path.push({ x: last.x + tx * rollDist * frac, y: last.y + ty * rollDist * frac, h: 0 });
    }
  }

  // --- Is the raw trajectory goal-bound? (for blocked vs intercepted) ---
  const rawCross = findGoalCrossing(path, goalY);
  const goalBound = !!rawCross && rawCross.xCross >= 38 && rawCross.xCross <= 62;

  const post1 = event.goal.x1; // 40
  const post2 = event.goal.x2; // 60

  // --- Walk the path in order, resolving the first event that occurs ---
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const cur = path[i];

    // Goal-line crossing on this segment takes precedence.
    if (prev.y > goalY && cur.y <= goalY) {
      const frac = (prev.y - goalY) / (prev.y - cur.y);
      const xCross = prev.x + (cur.x - prev.x) * frac;
      const hCross = prev.h + (cur.h - prev.h) * frac;
      const truncated = path.slice(0, i);
      return resolveGoalLine(
        event,
        input,
        truncated,
        xCross,
        hCross,
        D,
        dir,
        oppStrength,
        post1,
        post2,
        rng,
      );
    }

    // Out of bounds.
    if (cur.x < 0 || cur.x > 100 || cur.y > 100) {
      return {
        path: path.slice(0, i + 1),
        outcomeKind: "out",
        narrative: "Out of play!",
        goal: false,
        assist: false,
        passCompleted: false,
      };
    }

    // Defender interception (low enough to reach).
    for (const d of event.defenders) {
      if (Math.hypot(d.x - cur.x, d.y - cur.y) < 1.6 && cur.h < 2.1) {
        const progress = i / (SAMPLES - 1);
        const blocked = progress < 0.35 && goalBound;
        return {
          path: path.slice(0, i + 1),
          outcomeKind: blocked ? "blocked" : "intercepted",
          narrative: blocked ? "Blocked by a defender!" : "Cut out by a defender!",
          goal: false,
          assist: false,
          passCompleted: false,
        };
      }
    }

    // Goalkeeper claims a lofted pass/cross.
    if (isPassKind && cur.h < 2.6 && Math.hypot(event.goalkeeper.x - cur.x, event.goalkeeper.y - cur.y) < 2.2) {
      return {
        path: path.slice(0, i + 1),
        outcomeKind: "intercepted",
        narrative: "The keeper claims it!",
        goal: false,
        assist: false,
        passCompleted: false,
      };
    }
  }

  // --- Ended in-field untouched: look for a receiving teammate ---
  const end = path[path.length - 1];
  let mate: PlayableEvent["teammates"][0] | null = null;
  let mateDist = Infinity;
  for (const m of event.teammates) {
    const dd = Math.hypot(m.x - end.x, m.y - end.y);
    if (dd < mateDist) {
      mateDist = dd;
      mate = m;
    }
  }

  if (!mate || mateDist > 5.5) {
    return {
      path,
      outcomeKind: "out",
      narrative: "Possession lost.",
      goal: false,
      assist: false,
      passCompleted: false,
    };
  }

  // Offside for through balls / crosses played beyond the last defender.
  if ((event.kind === "THROUGH_BALL" || event.kind === "CROSS") && mate.y < event.offsideLine - 1) {
    return {
      path,
      outcomeKind: "offside",
      narrative: "Flag's up — offside!",
      goal: false,
      assist: false,
      passCompleted: false,
    };
  }

  // Pass completed. If the teammate is in shooting range, they always shoot.
  if (mate.y < 35) {
    const secondary = buildSecondaryShot(event, mate, teamRelationship, rng);
    return {
      path,
      outcomeKind: "teammate",
      narrative: "Slipped through to a teammate…",
      goal: false,
      assist: secondary.outcome === "goal",
      passCompleted: true,
      secondary,
    };
  }

  return {
    path,
    outcomeKind: "teammate",
    narrative: "Pinged to a teammate.",
    goal: false,
    assist: false,
    passCompleted: true,
  };
}

function resolveGoalLine(
  event: PlayableEvent,
  input: KickInput,
  truncated: FlightPoint[],
  xCross: number,
  hCross: number,
  D: number,
  dir: { x: number; y: number },
  oppStrength: number,
  post1: number,
  post2: number,
  rng: () => number,
): KickResult {
  const goalY = event.goal.y;

  const inFrame = xCross >= post1 && xCross <= post2;

  if (inFrame) {
    if (hCross > 2.74) {
      return {
        path: [...truncated, { x: xCross, y: goalY, h: hCross }],
        outcomeKind: "over",
        narrative: "Sails over the bar!",
        goal: false,
        assist: false,
        passCompleted: false,
      };
    }
    if (hCross > 2.44) {
      // 2.44 < h <= 2.74 → crossbar 50/50
      if (rng() < 0.5) {
        return {
          path: [...truncated, { x: xCross, y: goalY, h: hCross }],
          outcomeKind: "bar",
          narrative: "Crashes off the crossbar!",
          goal: false,
          assist: false,
          passCompleted: false,
        };
      }
      return goalResult(truncated, xCross, hCross, goalY, dir, D, "In off the underside of the bar!");
    }

    // On target — keeper save model.
    let reach = clamp(4.2 + (oppStrength - 60) * 0.045, 3.5, 6) * (1 - input.power * 0.35);
    if (hCross > 1.9 || hCross < 0.4) reach *= 0.85;
    const dist = Math.abs(xCross - event.goalkeeper.x);
    const pSave = dist >= reach ? 0.05 : clamp((reach - dist) / reach, 0, 0.92) * (0.9 - input.power * 0.25);
    if (rng() < pSave) {
      return {
        path: [...truncated, { x: xCross, y: goalY, h: hCross }],
        outcomeKind: "saved",
        narrative: rng() < 0.5 ? "Great save!" : "Palmed away!",
        goal: false,
        assist: false,
        passCompleted: false,
        savePoint: { x: xCross, y: 2 },
      };
    }
    const bigStrike = D > 30 || Math.abs(xCross - 50) > 7;
    return goalResult(truncated, xCross, hCross, goalY, dir, D, bigStrike ? "GOAL! What a strike!" : "GOAL!");
  }

  // Just outside a post.
  const nearPost =
    (xCross >= post1 - 2 && xCross < post1) || (xCross > post2 && xCross <= post2 + 2);
  if (nearPost) {
    if (rng() < 0.4) {
      return {
        path: [...truncated, { x: xCross, y: goalY, h: hCross }],
        outcomeKind: "post",
        narrative: "Rattles the post!",
        goal: false,
        assist: false,
        passCompleted: false,
      };
    }
    return {
      path: [...truncated, { x: xCross, y: goalY, h: hCross }],
      outcomeKind: "wide",
      narrative: "Inches wide!",
      goal: false,
      assist: false,
      passCompleted: false,
    };
  }

  return {
    path: [...truncated, { x: xCross, y: goalY, h: hCross }],
    outcomeKind: "wide",
    narrative: "Off target.",
    goal: false,
    assist: false,
    passCompleted: false,
  };
}

function goalResult(
  truncated: FlightPoint[],
  xCross: number,
  hCross: number,
  goalY: number,
  dir: { x: number; y: number },
  _D: number,
  narrative: string,
): KickResult {
  return {
    path: [
      ...truncated,
      { x: xCross, y: goalY, h: hCross },
      { x: xCross + dir.x, y: goalY + dir.y, h: Math.max(0, hCross * 0.4) }, // +1 unit into the net
    ],
    outcomeKind: "goal",
    narrative,
    goal: true,
    assist: false,
    passCompleted: false,
  };
}

function buildSecondaryShot(
  event: PlayableEvent,
  mate: PlayableEvent["teammates"][0],
  teamRelationship: number,
  rng: () => number,
): SecondaryShot {
  const goalY = event.goal.y;
  const targetX = 44 + rng() * 12;
  const H = 0.5 + rng() * 1.7; // modest arc between 0.5 and 2.2
  const N = 20;
  const shotPath: FlightPoint[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    shotPath.push({
      x: mate.x + (targetX - mate.x) * t,
      y: mate.y + (goalY - mate.y) * t,
      h: 4 * H * t * (1 - t),
    });
  }

  const pGoal = clamp(0.18 + (1 - mate.y / 35) * 0.38 + (teamRelationship - 50) / 250, 0.05, 0.7);
  if (rng() < pGoal) {
    const finishes = [
      "Buries it!",
      "Slots it home!",
      "Smashes it in!",
      "Tucks it away coolly!",
    ];
    return {
      path: shotPath,
      outcome: "goal",
      narrative: "ASSIST! " + finishes[Math.floor(rng() * finishes.length)],
    };
  }

  const roll = rng();
  if (roll < 0.4) {
    return { path: shotPath, outcome: "saved", narrative: "The keeper saves the follow-up!" };
  }
  if (roll < 0.8) {
    return { path: shotPath, outcome: "wide", narrative: "Teammate drags it wide!" };
  }
  return { path: shotPath, outcome: "post", narrative: "Off the post — so close!" };
}
