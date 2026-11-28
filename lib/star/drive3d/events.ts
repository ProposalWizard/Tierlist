/**
 * THINGS THAT HAPPEN ON THE ROAD (driving phase 2, 28 Nov 2026; docs/plans/DRIVING_PLAN.md §4, LIVING_WORLD_IDEAS.md
 * "every event has an effect … like the Sims"). Besides a call (./calls.ts), a drive may have ONE of these, seeded by
 * the day so the same day plays the same: a fan at a crossing, a speed camera, a team-mate wanting a race, a
 * broken-down car, or rain coming on. Each one is short, shown on a card like the calls, and its effect is small
 * and real: money through the career's own money (a fine is a share of your weekly wage), the fans, the
 * dressing room, your mood or your reputation, all through dilemmas.ts applyEffects (the game's one way to
 * change those). Names are invented ("{mate}" is a team-mate's name, as on the calls); no real brands.
 *
 * Pure: when it starts (a place on the road), the card, the answer, the outcome. ./drive.ts runs it; ./scene.ts
 * draws the crossing, the camera, the other car, the broken-down car and the rain.
 */
import type { DilemmaEffect } from "../dilemmas";
import type { PieceKind, Route } from "./route";

export type DriveEventId = "fan-crossing" | "speed-camera" | "mate-race" | "breakdown" | "rain";
export const DRIVE_EVENT_IDS: DriveEventId[] = ["fan-crossing", "speed-camera", "mate-race", "breakdown", "rain"];

/** The effects an event may have (a subset of a dilemma's: the same fields, the same apply). */
export type DriveEffect = Pick<DilemmaEffect, "money" | "fans" | "team" | "happiness" | "reputation">;

export interface DriveEvent {
  id: DriveEventId;
  /** choice: two buttons; brake: one button you must press in time; notice: no button, it just tells you. */
  kind: "choice" | "brake" | "notice";
  icon: string;
  title: string;
  lines: string[];
  yes?: string;
  no?: string;
  /** Where it starts: the first stretch of this kind of road on this leg, this many metres in. */
  where: { kind: PieceKind; m: number };
}

export const DRIVE_EVENTS: Record<DriveEventId, DriveEvent> = {
  "fan-crossing": {
    id: "fan-crossing", kind: "choice", icon: "🧣", title: "A fan at the crossing",
    lines: ["A lad in a club scarf stops on the crossing.", "He knows the car. He's waving like mad."],
    yes: "Honk and wave", no: "Eyes on the road", where: { kind: "street", m: 30 },
  },
  "speed-camera": {
    id: "speed-camera", kind: "brake", icon: "📸", title: "Speed camera ahead",
    lines: ["40 limit on this stretch. The camera is just round the bend."],
    yes: "Slow down", where: { kind: "lane", m: 36 },
  },
  "mate-race": {
    id: "mate-race", kind: "choice", icon: "🏁", title: "{mate} pulls up alongside",
    lines: ["A horn behind you. It's {mate}, grinning.", "\"Last one to the car park buys the coffees?\""],
    yes: "Race him", no: "Not today", where: { kind: "lane", m: 8 },
  },
  breakdown: {
    id: "breakdown", kind: "choice", icon: "⚠️", title: "A car broken down",
    lines: ["Hazards on, a warning triangle out. An old couple by the verge.", "Stop and give them a hand?"],
    yes: "Pull over and help", no: "Drive on", where: { kind: "lane", m: 40 },
  },
  rain: {
    id: "rain", kind: "notice", icon: "🌧️", title: "Here comes the rain",
    lines: ["The sky goes grey and it pours.", "Wipers on. It'll be a heavy pitch today."],
    where: { kind: "link", m: 4 },
  },
};

/** How often a drive has an event (besides any call): about three drives in five. */
export const EVENT_CHANCE = 0.6;

/** The event on this drive (or none): seeded by the day, so the same day has the same one. `force`: a test or the test page. */
export function pickEvent(seed: number, leg: "in" | "back", force?: string): DriveEvent | null {
  if (force === "none") return null;
  if (force) return (DRIVE_EVENTS as Record<string, DriveEvent>)[force] ?? null;
  const r = (((seed + 7919) * 2246822519) >>> 0) / 4294967296;
  if (r >= EVENT_CHANCE) return null;
  // the way back has no fan crossing at its start (you leave the compound): the same five, the same odds
  void leg;
  return DRIVE_EVENTS[DRIVE_EVENT_IDS[Math.floor((r / EVENT_CHANCE) * DRIVE_EVENT_IDS.length) % DRIVE_EVENT_IDS.length]];
}

/** Where on this route the event starts (s), or −1 when the route has no such stretch. */
export function eventStartS(route: Route, ev: DriveEvent): number {
  const p = route.pts.find((q) => q.kind === ev.where.kind);
  if (!p) return -1;
  let end = p.s;
  for (const q of route.pts) if (q.s >= p.s) { if (q.kind !== ev.where.kind) break; end = q.s; }
  return Math.min(p.s + ev.where.m, end - 5);
}

/** The zebra crossing is this far on from where the fan's card opens (m); you stop STOP_SHORT before it. The
 *  broken-down car is BREAKDOWN_AHEAD on; helping, you stop alongside it for HELP_S. */
export const CROSS_AHEAD = 34;
export const STOP_SHORT = 7;
export const BREAKDOWN_AHEAD = 95;
export const HELP_S = 2;
/** After you answer the fan he takes this long to walk off the crossing before you move. */
export const FAN_CLEAR_S = 1.8;

/** The speed camera: it is this far on from where the card opens (m), and its limit (m/s: 40 mph). */
export const CAMERA_AHEAD = 80;
export const CAMERA_LIMIT = 17.9;
/** Slowing for the camera: you are held to this (m/s, about 37 mph) until you are past it. */
export const CAMERA_SLOW = 16.4;
/** The race: how long the burst lasts (s) and how much quicker than the road you both go. */
export const RACE_S = 4;
export const RACE_BOOST = 1.22;
/** Your car's pace in a burst (the shop's order): the better the car, the likelier you win. */
export const RACE_ODDS: Record<string, number> = { hatch: 0.3, family: 0.3, classic: 0.4, suv: 0.45, sports: 0.65, super: 0.85 };

/** A fine is a small share of a week's wage (never under £100), rounded to £10. */
export function fineFor(weeklyWage: number): number {
  return Math.max(100, Math.round((weeklyWage * 0.015) / 10) * 10);
}

export interface EventOutcome {
  /** What happened (a short line on the card). */
  line: string;
  /** What it changed, in words (the yellow line). */
  effect: string;
  /** The change itself (applied to the career by dilemmas.ts applyEffects). */
  apply: DriveEffect;
}

/**
 * The outcome of an event. `answer`: yes/no for a choice ("no" also when nothing was pressed); for the camera,
 * `fast` = you went through it over the limit; for the race, `won`.
 */
export function eventOutcome(ev: DriveEvent, a: { answer: "yes" | "no"; fast?: boolean; won?: boolean; wage: number; mate: string; money?: (n: number) => string }): EventOutcome {
  const m = (s: string) => s.replace(/\{mate\}/g, a.mate);
  const fmt = a.money ?? ((n: number) => `£${n.toLocaleString("en-GB")}`);
  switch (ev.id) {
    case "fan-crossing":
      return a.answer === "yes"
        ? { line: "Two beeps and a thumbs up. He'll tell everyone.", effect: "Fans +2 · Mood +1", apply: { fans: 2, happiness: 1 } }
        : { line: "You keep your eyes front. He waves anyway.", effect: "Nothing changes.", apply: {} };
    case "speed-camera": {
      if (!a.fast) return { line: "36 on the dial as you pass it. Clean.", effect: "Nothing changes.", apply: {} };
      const f = fineFor(a.wage);
      return { line: "Flash. That'll be in the post.", effect: `A ${fmt(f)} fine from your money.`, apply: { money: -f } };
    }
    case "mate-race":
      if (a.answer === "no") return { line: m("\"Boring!\" {mate} roars off ahead."), effect: "Nothing changes.", apply: {} };
      return a.won
        ? { line: m("You get the jump on {mate}. He's buying the coffees."), effect: "Dressing room +2 · Mood +2", apply: { team: 2, happiness: 2 } }
        : { line: m("{mate} edges it. He won't let you forget it."), effect: "Dressing room +1 (a laugh) · Mood −1", apply: { team: 1, happiness: -1 } };
    case "breakdown":
      return a.answer === "yes"
        ? { line: "Ten minutes, a jump start, two very happy pensioners. Someone took a photo.", effect: "Reputation +1 · Fans +1 · Mood +1", apply: { reputation: 1, fans: 1, happiness: 1 } }
        : { line: "Someone else will stop. Probably.", effect: "Nothing changes.", apply: {} };
    case "rain":
      return { line: "Wipers on full. The lane is a river.", effect: "Mood −1", apply: { happiness: -1 } };
  }
}

/** Fill {mate} in an event's own words (the title, the lines). */
export function fillEvent(ev: DriveEvent, mate: string): DriveEvent {
  const f = (s: string) => s.replace(/\{mate\}/g, mate);
  return { ...ev, title: f(ev.title), lines: ev.lines.map(f), yes: ev.yes && f(ev.yes), no: ev.no && f(ev.no) };
}

/** The race's result, seeded (the same day, the same race) and weighted by your car. */
export function raceWon(seed: number, carId: string): boolean {
  const r = (((seed + 104729) * 2654435761) >>> 0) / 4294967296;
  return r < (RACE_ODDS[carId] ?? 0.4);
}
