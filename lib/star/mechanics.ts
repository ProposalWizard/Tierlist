/**
 * WHAT YOU CAN DO IN A MATCH, AND WHEN IT OPENS (Mikey, 25 Oct 2026).
 *
 * A new career (the story order, `unlocks.story`) starts with the basics: the
 * shot (drag, tap the ball: curl and chip are part of that tap), the pass, and
 * the play style picker. Everything else opens at a moment or a skill number,
 * and the first time it opens a guide shows how it works.
 *
 *   Headers and volleys   after game 3; game 4 brings one of each, guided
 *   Steer your run        Pace 60 (before that your run is automatic)
 *   Sprint + stamina bar  Pace 65
 *   Moving with the ball  game 5
 *
 * Waiting for a future update (`released: false`): built, with their guides,
 * but not in the game yet. A story career does not get them at all; flip
 * `released` to bring one in.
 *
 *   Power shot            Power 60
 *   Knuckleball           Power 70 and Technique 60
 *   Skill moves           Technique 65
 *   One-twos              Vision 60
 *
 * Every save from before the story order keeps everything open, as it was.
 * Skills start at 40 (Mikey: "we start every stat at 40 out of 100"). Pure.
 */
import type { CareerState } from "./types";

export type Mechanic = "aerial" | "steer" | "sprint" | "dribble" | "powerShot" | "knuckle" | "skillMoves" | "oneTwo";

type C = Pick<CareerState, "unlocks" | "skills" | "careerStats">;

export interface MechanicDef {
  id: Mechanic;
  /** In the game now. false = a future update: built and guided, switched off. */
  released: boolean;
  /** When it opens, in words (for a lock line or a list). */
  when: string;
  opens: (c: C) => boolean;
  /** The guide: shown once, the first time it opens. */
  guide: { icon: string; title: string; line: string };
  /** The in-match line the first time you can use it (null: the guide is enough). */
  firstUse: string | null;
}

const games = (c: C) => c.careerStats?.appearances ?? 0;
const skill = (c: C, k: keyof CareerState["skills"]) => c.skills?.[k] ?? 0;

/** Games played before headers and volleys open (they come in game 4). */
export const AERIAL_AFTER_GAMES = 3;
/** Games played before moving with the ball opens (it comes in game 5). */
export const DRIBBLE_AFTER_GAMES = 4;

export const MECHANICS: MechanicDef[] = [
  {
    id: "aerial", released: true, when: "After your third game",
    opens: (c) => games(c) >= AERIAL_AFTER_GAMES,
    guide: { icon: "🤸", title: "Headers and volleys", line: "Crosses can come to you in the air now. When one does, tap the ball before the ring runs out. Its left side sends it right. Your Aerial drill is open in Training." },
    firstUse: null, // the header and the volley each have their own line (CanvasMatch)
  },
  {
    id: "steer", released: true, when: "Pace 60",
    opens: (c) => skill(c, "pace") >= 60,
    guide: { icon: "🧭", title: "Steer your run", line: "After you pass, you can steer where you run. Hold your thumb on the left of the screen and push, or use W A S D on a computer. Let go and you run on your own." },
    firstUse: "Steer your run: thumb on the left and push, or W A S D",
  },
  {
    id: "sprint", released: true, when: "Pace 65",
    opens: (c) => skill(c, "pace") >= 65,
    guide: { icon: "💨", title: "Sprint", line: "Push the stick all the way, or hold Shift, to sprint. It drains the stamina bar, and the bar never fills past your match energy." },
    firstUse: "Push all the way, or hold Shift, to sprint. Watch your stamina",
  },
  {
    id: "dribble", released: true, when: "After your fourth game",
    opens: (c) => games(c) >= DRIBBLE_AFTER_GAMES,
    guide: { icon: "⚽", title: "Moving with the ball", line: "Sometimes the ball comes to you with space to run into. Flick to run with it, tap a team-mate to pass, and shoot when you're through." },
    firstUse: "Space to run into! Flick to run with the ball, tap a team-mate to pass",
  },
  {
    id: "powerShot", released: false, when: "Power 60",
    opens: (c) => skill(c, "power") >= 60,
    guide: { icon: "⚡", title: "Power shot", line: "Tap ⚡ Power shot on the aim screen. You wind up, then hit the green circle fast for up to one and a half times the pace. The defence closes while you wind up." },
    firstUse: "New: ⚡ Power shot. Tap it, then hit the circle fast",
  },
  {
    id: "knuckle", released: false, when: "Power 70 and Technique 60",
    opens: (c) => skill(c, "power") >= 70 && skill(c, "technique") >= 60,
    guide: { icon: "🌀", title: "Knuckleball", line: "Hit a hard shot through the dead centre of the ball and it wobbles late. Keepers hate it." },
    firstUse: "Knuckleball: a hard shot through the dead centre of the ball",
  },
  {
    id: "skillMoves", released: false, when: "Technique 65",
    opens: (c) => skill(c, "technique") >= 65,
    guide: { icon: "🪄", title: "Skill moves", line: "When a defender backs off, swipe down on a side to sell a step-over, then go the other way." },
    firstUse: "Swipe down on a side: step-over",
  },
  {
    id: "oneTwo", released: false, when: "Vision 60",
    opens: (c) => skill(c, "vision") >= 60,
    guide: { icon: "🔁", title: "One-twos", line: "Pass, then call for it back: tap Call for it while your team-mate has the ball and he plays it straight back into your run." },
    firstUse: "Call for it to get the ball straight back",
  },
];

const BY_ID = Object.fromEntries(MECHANICS.map((m) => [m.id, m])) as Record<Mechanic, MechanicDef>;
export const mechanicDef = (id: Mechanic): MechanicDef => BY_ID[id];

const isStory = (c: Pick<CareerState, "unlocks">) => !!c.unlocks?.story;

/** Can you use it now? A career from before the story order: always. */
export function mechanicOpen(c: C | null | undefined, id: Mechanic): boolean {
  if (!c || !isStory(c)) return true;
  const m = BY_ID[id];
  return m.released && m.opens(c);
}

/** Everything at once, for the match screen. */
export type MechanicSet = Record<Mechanic, boolean>;
export function mechanicsFor(c: C | null | undefined): MechanicSet {
  const out = {} as MechanicSet;
  for (const m of MECHANICS) out[m.id] = mechanicOpen(c, m.id);
  return out;
}

/** Game 4 of a story career: one header and one volley, guaranteed. */
export function aerialIntroGame(c: C | null | undefined): boolean {
  return !!c && isStory(c) && games(c) === AERIAL_AFTER_GAMES;
}

/** The guide to show now on Home: a released mechanic that has opened and was
 *  never shown. null when there is none. */
export function mechanicGuideDue(c: C): Mechanic | null {
  if (!isStory(c)) return null;
  for (const m of MECHANICS) if (m.released && m.opens(c) && !c.unlocks!.seen.includes(`mech-${m.id}`)) return m.id;
  return null;
}
