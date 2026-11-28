/**
 * WHAT PEOPLE DO IN YOUR HOUSE: routines as data (docs/plans/PEOPLE_AND_MEMORY_PLAN.md section 3b;
 * Harry, 27 Nov 2026: "he should not be sitting there all day, he needs to leave / do a different
 * action / make food / do something").
 *
 * A visit (lib/star/life/dayPlan.ts says who comes and when) is planned into STEPS, each in a room,
 * with a start and an end in game minutes. Step kinds:
 *   arrive  in at the front door             go     walk to another room (put in by the planner)
 *   use     sit or stand at a thing          pick   one of several things, never the same twice running
 *   away    off screen (the toilet, out)     call   on the phone at the window
 *   cook    at the hob                       meet   go up to another person and talk
 *   clean   wipe down a room                 leave  out by the front door
 * Two rules, tested on 1,000 seeded days (tests/star/houseRoutines.mts): NOBODY spends more than
 * MAX_STEP_MINS on one thing, and EVERY visit ends with `leave`.
 * `whereAt(steps, minute)` says where a person is at any minute, so walking into a room mid-afternoon
 * finds people already mid-action. Pure: no three.js. The 3D side is world3d/houseLife.ts.
 */
import type { RoomId } from "../home3d/homes";
import { seeded, hashId } from "../world3d/routine";

/** The 45-minute rule. */
export const MAX_STEP_MINS = 45;

export type VisitKind = "arrive" | "go" | "use" | "pick" | "away" | "call" | "cook" | "meet" | "clean" | "leave";

/** A planned step: `room` "away" = not in the house's rooms (off screen). */
export interface VStep {
  kind: VisitKind;
  room: RoomId | "away";
  /** The thing (an object id: sofa, fridge, pool...) or, for meet, the other person's visit id. */
  target?: string;
  at: number;
  until: number;
  /** What it looks like, in words (debug, the Today list). */
  label: string;
}

/** A step of a template. `options` makes it a pick. */
interface TStep {
  kind: Exclude<VisitKind, "go" | "pick">;
  target?: string;
  mins: [number, number];
  chance?: number;
  label: string;
}
interface TPick { kind: "pick"; options: (TStep & { w: number })[] }
type TItem = TStep | TPick;

export interface VisitTemplate {
  id: string;
  /** Steps, in order; `loopFrom` the index to go round again from until the visit's end. */
  steps: TItem[];
  loopFrom?: number;
}

/** Which rooms have each thing (livingRooms.ts), best first. */
const TARGET_ROOMS: Record<string, RoomId[]> = {
  sofa: ["lounge", "studio"],
  fridge: ["kitchen", "lounge", "studio"],
  coffee: ["kitchen", "studio", "lounge"],
  hob: ["kitchen", "studio"],
  pool: ["games"], darts: ["games"], arcade: ["games"],
  mat: ["gym"], treadmill: ["gym"],
  lounger1: ["poolTerrace"],
  seatsL: ["cinema"],
  window: ["lounge", "studio", "kitchen"],
};
/** Rooms with a coffee machine: the penthouse lounge only (livingRooms.ts buildLivingLounge). */
const COFFEE_LOUNGE = new Set(["penthouse"]);

export function roomFor(target: string, rooms: RoomId[], tier?: string): RoomId | null {
  for (const r of TARGET_ROOMS[target] ?? []) {
    if (!rooms.includes(r)) continue;
    if (target === "coffee" && r === "lounge" && !COFFEE_LOUNGE.has(tier ?? "")) continue;
    return r;
  }
  return null;
}

/** Where people come in: the hallway, else the lounge, else the studio. */
export function entryRoom(rooms: RoomId[]): RoomId {
  return (["hallway", "lounge", "studio", "nook"] as RoomId[]).find((r) => rooms.includes(r)) ?? rooms[0];
}

// ── The templates ─────────────────────────────────────────────────────

/** A team-mate round (dropped in, or you texted him). Mockup people-plan/3-visitor-day.png, middle lane. */
export const MATE_VISIT: VisitTemplate = {
  id: "mate",
  loopFrom: 1,
  steps: [
    { kind: "arrive", mins: [1, 2], label: "Comes in" },
    { kind: "use", target: "sofa", mins: [20, 45], label: "Sofa, the TV on" },
    { kind: "use", target: "fridge", mins: [2, 4], label: "A can from the fridge" },
    { kind: "pick", options: [
      { kind: "use", target: "pool", mins: [15, 30], w: 3, label: "Pool" },
      { kind: "use", target: "darts", mins: [10, 20], w: 2, label: "Darts" },
      { kind: "use", target: "arcade", mins: [10, 20], w: 2, label: "The arcade" },
      { kind: "call", target: "window", mins: [5, 12], w: 2, label: "A call at the window" },
      { kind: "use", target: "lounger1", mins: [15, 30], w: 2, label: "A lounger by the pool" },
      { kind: "meet", target: "chef", mins: [3, 6], w: 3, label: "A word with the chef" },
      { kind: "use", target: "coffee", mins: [4, 6], w: 1, label: "A coffee" },
    ] },
    { kind: "away", mins: [4, 7], chance: 0.5, label: "The toilet" },
    { kind: "pick", options: [
      { kind: "call", target: "window", mins: [5, 12], w: 2, label: "A call at the window" },
      { kind: "use", target: "pool", mins: [15, 30], w: 2, label: "Pool" },
      { kind: "use", target: "sofa", mins: [15, 30], w: 2, label: "Back on the sofa" },
    ] },
  ],
};

/** The chef (Villa and Estate): a meal, start to finish. Mockup lane 3. */
export const CHEF_SHIFT: VisitTemplate = {
  id: "chef",
  steps: [
    { kind: "arrive", mins: [1, 2], label: "Arrives" },
    { kind: "cook", target: "hob", mins: [35, 45], label: "Cooks" },
    { kind: "cook", target: "hob", mins: [30, 45], label: "Cooks" },
    { kind: "use", target: "fridge", mins: [3, 5], label: "From the fridge" },
    { kind: "cook", target: "hob", mins: [8, 12], label: "Plates up" },
    { kind: "clean", target: "hob", mins: [20, 30], label: "Cleans the kitchen" },
  ],
};

/** The cleaner (House tier and up): room by room. */
export const CLEANER_SHIFT: VisitTemplate = {
  id: "cleaner",
  loopFrom: 1,
  steps: [
    { kind: "arrive", mins: [1, 2], label: "Arrives" },
    { kind: "clean", mins: [20, 40], label: "Cleans" },
    { kind: "away", mins: [3, 6], chance: 0.4, label: "Fetches the hoover" },
  ],
};

export const TEMPLATES: Record<string, VisitTemplate> = { mate: MATE_VISIT, chef: CHEF_SHIFT, cleaner: CLEANER_SHIFT };

/** Another person in the house that day (for `meet`): where he is at a minute. */
export type OtherAt = (id: string, minute: number) => VStep | null;

/**
 * Plan a visit from `from` to `to` (game minutes of the day). Seeded: the same seed, the same visit.
 * Every step ≤ MAX_STEP_MINS; the last step is always `leave`, ending at `to`.
 */
export function planVisit(tplId: string, who: string, from: number, to: number, rooms: RoomId[], seed: number, o: { tier?: string; others?: { id: string; kind: string; at: OtherAt }[] } = {}): VStep[] {
  const tpl = TEMPLATES[tplId];
  const r = seeded(seed ^ hashId(`${who}|${tplId}`));
  const between = (a: [number, number]) => Math.round(a[0] + (a[1] - a[0]) * r());
  const entry = entryRoom(rooms);
  const LEAVE = 2;
  const steps: VStep[] = [];
  let t = from, room: RoomId | "away" = entry;
  let lastPick = "";
  /** The rooms a cleaner goes round, in order. */
  const cleanRooms = rooms.filter((x) => x !== "garage" && x !== "gardenTerrace");
  let cleanK = Math.floor(r() * cleanRooms.length);
  const push = (s: TStep, rm: RoomId | "away", target: string | undefined, mins: number) => {
    // a walk to another room first: "go" (1 min through the doorway)
    if (rm !== room && rm !== "away" && room !== "away" && s.kind !== "arrive") {
      steps.push({ kind: "go", room: rm, at: t, until: t + 1, label: `To the ${rm}` });
      t += 1;
    }
    const len = Math.max(1, Math.min(MAX_STEP_MINS, mins));
    steps.push({ kind: s.kind, room: rm, target, at: t, until: t + len, label: s.label });
    t += len;
    if (rm !== "away") room = rm;
  };
  const place = (s: TStep): { rm: RoomId | "away"; target?: string } | null => {
    if (s.kind === "arrive") return { rm: entry };
    if (s.kind === "away") return { rm: "away" };
    if (s.kind === "clean") {
      if (s.target) { const rm = roomFor(s.target, rooms, o.tier); return rm ? { rm, target: s.target } : null; }
      const rm = cleanRooms[cleanK++ % cleanRooms.length];
      return rm ? { rm } : null;
    }
    if (s.kind === "meet") {
      // only if that person is in the house then (and not off screen)
      const other = o.others?.find((x) => x.kind === s.target);
      const at = other?.at(other.id, t + 2);
      if (!other || !at || at.room === "away" || at.kind === "leave" || at.kind === "arrive") return null;
      return { rm: at.room, target: other.id };
    }
    if (s.kind === "call" && room !== "away") return { rm: room, target: "window" };
    const rm = s.target ? roomFor(s.target, rooms, o.tier) : null;
    return rm ? { rm, target: s.target } : null;
  };
  const end = to - LEAVE - 1; // the walk to the door fits before `to`
  let i = 0, guard = 0;
  while (guard++ < 400) {
    if (i >= tpl.steps.length) { if (tpl.loopFrom === undefined) break; i = tpl.loopFrom; }
    const item = tpl.steps[i++];
    let s: TStep | null = null;
    if (item.kind === "pick") {
      const ok = item.options.filter((x) => x.target !== lastPick && place(x));
      const tot = ok.reduce((a, x) => a + x.w, 0);
      let k = r() * tot;
      for (const x of ok) { k -= x.w; if (k <= 0) { s = x; break; } }
      if (!s && ok.length) s = ok[ok.length - 1];
      if (s) lastPick = s.target ?? s.kind;
    } else {
      if (item.chance !== undefined && r() >= item.chance) continue;
      s = item;
    }
    if (!s) continue;
    const p = place(s);
    if (!p) continue;
    let mins = between(s.mins);
    const goCost = p.rm !== room && p.rm !== "away" && s.kind !== "arrive" ? 1 : 0;
    if (t + goCost + mins > end) {
      // the last thing is cut short to fit; under 3 minutes it is not worth starting
      mins = end - t - goCost;
      if (mins < 3) break;
      push(s, p.rm, p.target, mins);
      break;
    }
    push(s, p.rm, p.target, mins);
  }
  // fill what is left (a shift that ends early): out of sight, in ≤45-minute pieces
  while (end - t >= 3) {
    const len = Math.min(MAX_STEP_MINS, end - t);
    steps.push({ kind: "away", room: "away", at: t, until: t + len, label: "Out of sight" });
    t += len;
  }
  // back to the front door, then out
  const lastRoom = room as RoomId | "away"; // (changed inside push: TS cannot see it)
  if (lastRoom !== entry && lastRoom !== "away") { steps.push({ kind: "go", room: entry, at: t, until: t + 1, label: "To the door" }); t += 1; }
  steps.push({ kind: "leave", room: entry, at: t, until: Math.max(t + 1, to), label: "Leaves" });
  return steps;
}

/** Where a person is at `minute`: his step (and its index), or null (not in the house). */
export function whereAt(steps: VStep[], minute: number): { i: number; step: VStep; k: number } | null {
  if (!steps.length || minute < steps[0].at || minute >= steps[steps.length - 1].until) return null;
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.at <= minute) return { i, step: s, k: (minute - s.at) / Math.max(1e-6, s.until - s.at) };
  }
  return null;
}

// ── How many people your room may draw (the speed budget, plan section 7b risk 1) ──

/** People other than you drawn in your room: Mid Android and Low 2, Medium 3, High 5. */
export const ROOM_PEOPLE = { low: 2, medium: 3, high: 5 } as const;

/** The cap for this device: a phone on Medium is the mid Android (2). */
export function roomPeople(tier: "low" | "medium" | "high", phone: boolean): number {
  return phone && tier !== "high" ? ROOM_PEOPLE.low : ROOM_PEOPLE[tier];
}
