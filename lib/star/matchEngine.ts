import type { CareerState, Skills, MatchStats, Fixture } from "./types";
import { mulberry32 } from "./season";

export type EventKind = "SHOOT" | "PASS" | "CROSS" | "LONG_SHOT" | "HEADER" | "THROUGH_BALL";

export interface PlayableEvent {
  kind: EventKind;
  minute: number;
  ball: { x: number; y: number };          // 0-100 pitch coords
  player: { x: number; y: number };         // user's player position
  teammates: { x: number; y: number; id: string }[];
  defenders: { x: number; y: number }[];
  goalkeeper: { x: number; y: number };
  goal: { x1: number; x2: number; y: number }; // goal line at top of pitch
  prompt: string;
  difficulty: number;                       // 0-1
  attackingUp: boolean;                     // true = shooting up toward top goal
}

export interface EventResult {
  success: boolean;
  goal: boolean;
  assist: boolean;
  keyPass: boolean;
  narrative: string;
}

export interface MatchScript {
  events: (PlayableEvent | { minute: number; commentary: string })[];
  oppStrength: number;
  fixture: Fixture;
  seed: number;
}

// Build a match script. Interleaves 8-14 playable events with commentary lines.
export function buildMatchScript(
  career: CareerState,
  fixture: Fixture,
  oppStrength: number,
): MatchScript {
  const seed = (fixture.week * 7919) ^ Math.floor(career.starRating * 100) ^ oppStrength;
  const rng = mulberry32(seed);

  // Number of user moments scales with team relationship + starRating
  const baseEvents = 8;
  const teamBonus = Math.floor(career.relationships.team / 20); // +0-5
  const totalPlayable = baseEvents + teamBonus + Math.floor(rng() * 3);

  // Distribute minutes 5-88
  const minutes: number[] = [];
  for (let i = 0; i < totalPlayable; i++) {
    minutes.push(5 + Math.floor(rng() * 83));
  }
  minutes.sort((a, b) => a - b);

  const events: (PlayableEvent | { minute: number; commentary: string })[] = [];
  const attackingUp = true;

  const isAttacker = ["ST", "CAM", "LW", "RW"].includes(career.player.position);
  const isMid = ["CM", "CDM", "LM", "RM"].includes(career.player.position);

  for (const minute of minutes) {
    // Weight event kinds by position
    let kindPool: EventKind[];
    if (isAttacker) {
      kindPool = ["SHOOT", "SHOOT", "PASS", "HEADER", "LONG_SHOT", "THROUGH_BALL", "CROSS"];
    } else if (isMid) {
      kindPool = ["PASS", "PASS", "SHOOT", "LONG_SHOT", "THROUGH_BALL", "CROSS"];
    } else {
      kindPool = ["PASS", "PASS", "PASS", "CROSS", "LONG_SHOT"];
    }
    const kind = kindPool[Math.floor(rng() * kindPool.length)];

    // Ball/player position based on kind
    const ball = ballPosForKind(kind, rng, attackingUp);
    const player = { x: ball.x, y: ball.y };

    const teammates: PlayableEvent["teammates"] = [];
    const numMates = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < numMates; i++) {
      teammates.push({
        id: `mate-${i}`,
        x: 15 + rng() * 70,
        y: attackingUp ? Math.max(8, ball.y - 8 - rng() * 25) : Math.min(90, ball.y + 8 + rng() * 25),
      });
    }
    const defenders: PlayableEvent["defenders"] = [];
    const numDefs = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < numDefs; i++) {
      defenders.push({
        x: 15 + rng() * 70,
        y: attackingUp ? Math.max(5, ball.y - 10 - rng() * 25) : Math.min(95, ball.y + 10 + rng() * 25),
      });
    }
    const goalkeeper = { x: 45 + rng() * 10, y: attackingUp ? 3 : 97 };
    const goal = { x1: 40, x2: 60, y: attackingUp ? 1 : 99 };

    const difficulty = 0.3 + rng() * 0.55 + (oppStrength - 65) / 200;

    events.push({
      kind,
      minute,
      ball,
      player,
      teammates,
      defenders,
      goalkeeper,
      goal,
      prompt: promptForKind(kind),
      difficulty: Math.max(0.1, Math.min(0.95, difficulty)),
      attackingUp,
    });

    // Add a commentary line before the next event
    if (rng() < 0.55) {
      events.push({ minute: minute - 1, commentary: randomCommentary(rng, career, fixture) });
    }
  }

  // Sort by minute
  events.sort((a, b) => ("minute" in a ? a.minute : 0) - ("minute" in b ? b.minute : 0));
  return { events, oppStrength, fixture, seed };
}

function ballPosForKind(kind: EventKind, rng: () => number, attackingUp: boolean): { x: number; y: number } {
  const top = attackingUp;
  switch (kind) {
    case "SHOOT":
      return { x: 30 + rng() * 40, y: top ? 15 + rng() * 20 : 65 + rng() * 20 };
    case "HEADER":
      return { x: 35 + rng() * 30, y: top ? 8 + rng() * 12 : 80 + rng() * 12 };
    case "LONG_SHOT":
      return { x: 30 + rng() * 40, y: top ? 30 + rng() * 15 : 55 + rng() * 15 };
    case "PASS":
      return { x: 20 + rng() * 60, y: 30 + rng() * 40 };
    case "CROSS":
      return { x: rng() < 0.5 ? 5 + rng() * 15 : 80 + rng() * 15, y: top ? 15 + rng() * 20 : 65 + rng() * 20 };
    case "THROUGH_BALL":
      return { x: 25 + rng() * 50, y: 35 + rng() * 30 };
  }
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
  ];
  return options[Math.floor(rng() * options.length)];
}

// Resolve a user action given tap direction/strength + skills
export function resolveEvent(
  event: PlayableEvent,
  target: { x: number; y: number },
  power: number,           // 0-1
  skills: Skills,
  rng: () => number,
): EventResult {
  const isShot = event.kind === "SHOOT" || event.kind === "LONG_SHOT" || event.kind === "HEADER";
  const isPass = event.kind === "PASS" || event.kind === "CROSS" || event.kind === "THROUGH_BALL";

  // Skill-based accuracy — better technique/vision = tighter deviation
  const tech = isPass ? (skills.vision + skills.technique) / 2 : skills.technique;
  const shotPower = skills.power;

  const deviation = (1 - tech / 100) * 15 * (0.6 + rng() * 0.4); // random offset in pitch units
  const angle = rng() * Math.PI * 2;
  const actualX = target.x + Math.cos(angle) * deviation;
  const actualY = target.y + Math.sin(angle) * deviation;

  if (isShot) {
    // Goal if actualX between goalposts, actualY at goal line, keeper doesn't save
    const inGoal = actualX >= event.goal.x1 && actualX <= event.goal.x2;
    const keeperDist = Math.hypot(actualX - event.goalkeeper.x, actualY - event.goalkeeper.y);
    const keeperSaveChance = Math.max(0, 0.55 - (shotPower / 200) - (power * 0.15) - keeperDist / 100);
    const savedByKeeper = inGoal && rng() < keeperSaveChance;
    // Defender block chance
    const blockChance = 0.15 + event.difficulty * 0.2 - (tech / 400);
    const blocked = rng() < blockChance;

    if (blocked) return { success: false, goal: false, assist: false, keyPass: false, narrative: "Blocked by defender!" };
    if (!inGoal) return { success: false, goal: false, assist: false, keyPass: false, narrative: rng() < 0.5 ? "Wide of the post." : "Over the bar!" };
    if (savedByKeeper) return { success: false, goal: false, assist: false, keyPass: false, narrative: "Saved by the keeper!" };
    return { success: true, goal: true, assist: false, keyPass: false, narrative: "GOAL!" };
  }

  if (isPass) {
    // Find closest teammate to actual landing point
    let closest = 999;
    let bestMate: PlayableEvent["teammates"][0] | null = null;
    for (const m of event.teammates) {
      const d = Math.hypot(m.x - actualX, m.y - actualY);
      if (d < closest) { closest = d; bestMate = m; }
    }
    const interceptChance = event.difficulty * 0.35;
    if (rng() < interceptChance) return { success: false, goal: false, assist: false, keyPass: false, narrative: "Intercepted!" };
    if (!bestMate || closest > 20) return { success: false, goal: false, assist: false, keyPass: false, narrative: "Overhit — out for a throw." };
    // Key pass — teammate scores from it
    const scoreChance = event.kind === "THROUGH_BALL" ? 0.35 : event.kind === "CROSS" ? 0.25 : 0.12;
    if (rng() < scoreChance) return { success: true, goal: false, assist: true, keyPass: true, narrative: "ASSIST! Great pass, goal scored!" };
    return { success: true, goal: false, assist: false, keyPass: true, narrative: "Neat pass to a teammate." };
  }

  return { success: false, goal: false, assist: false, keyPass: false, narrative: "" };
}

// Compute final match stats + rating
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
    + (userScore > 0 ? result : 0);
  rating = Math.max(1, Math.min(10, rating));

  const starMan = rating >= 8.5 || goals >= 2;
  const wage = career.contract.wage;
  const goalBonus = goals * career.contract.goalBonus;
  const sponsorPay = Math.floor(career.relationships.sponsors / 20);
  const totalCash = wage + goalBonus + sponsorPay;

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
    goalBonus,
    sponsorPay,
    totalCash,
    homeScore: userScore,
    awayScore: oppScore,
  };
}
