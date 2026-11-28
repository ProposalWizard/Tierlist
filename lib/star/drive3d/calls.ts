/**
 * CALLS ON THE DASH (driving phase 1, 28 Nov 2026; docs/plans/DRIVING_PLAN.md §4). One call a
 * drive at most, 8-15 s in, on the phone in its dash mount: a yes/no, written as a real person
 * talks. Data in the same spirit as lib/star/dilemmas.ts (a question, two answers, what each
 * does), so writers can add more without touching the scene.
 *
 * Phase 1 changes nothing in a career: each answer only says what it WOULD do (`effect`) and
 * leaves a MEMORY (callMemory) for the people plan (docs/plans/STORY_WORLD_PLAN.md) to pick up
 * later: who rang, about what, what you said, and the day. The hook is `onMemory` in the scene.
 */

export type CallerKind = "mate" | "agent" | "manager" | "friend";

export interface DriveCall {
  id: string;
  kind: CallerKind;
  /** Who it is on the phone's screen ("{mate}" = a team-mate's first name). */
  caller: string;
  /** What he says when you pick up: two or three short lines. */
  lines: string[];
  yes: { label: string; reply: string; effect: string };
  no: { label: string; reply: string; effect: string };
  /** Only on the way in / the way back. */
  leg: "in" | "back" | "any";
}

/** {mate} = a team-mate's name, {car} = your car's name, {club} = a club asking. */
export const DRIVE_CALLS: DriveCall[] = [
  {
    id: "borrow-car", kind: "mate", caller: "{mate}", leg: "in",
    lines: ["You on your way in?", "Listen, mine's in the garage till Friday.", "Could I borrow the {car} for the weekend? I'll fill it up."],
    yes: { label: "Go on then", reply: "Legend. Not a scratch on it, promise.", effect: "{mate} likes you more. Small chance it comes back with a dent." },
    no: { label: "Not the car", reply: "Fair enough. Worth a try.", effect: "{mate} is a bit cooler with you at training today." },
  },
  {
    id: "borrow-watch", kind: "mate", caller: "{mate}", leg: "in",
    lines: ["Quick one.", "Got the awards do on Saturday and nothing on my wrist.", "Lend us your watch for the night?"],
    yes: { label: "Yours for the night", reply: "You're a good man. Back Monday, first thing.", effect: "{mate} likes you more. It might come back late." },
    no: { label: "Sorry, mate", reply: "No worries. I'll sort something.", effect: "{mate} is a bit cooler with you today." },
  },
  {
    id: "agent-interest", kind: "agent", caller: "Your agent", leg: "any",
    lines: ["Morning. Can't say much on the phone.", "{club} have been asking about you. Properly asking.", "Want me to keep the door open?"],
    yes: { label: "Keep it open", reply: "Leave it with me. Not a word to anyone at the club.", effect: "{club} keep watching you. Your club may hear about it." },
    no: { label: "I'm happy here", reply: "Understood. I'll tell them you're settled.", effect: "Your manager hears you turned it down." },
  },
  {
    id: "agent-photo", kind: "agent", caller: "Your agent", leg: "in",
    lines: ["Good news. A sponsor wants a photo of you with the car.", "Ten minutes at the car park, before training.", "Easy money. Yes?"],
    yes: { label: "Set it up", reply: "Done. Smile, look like you mean it.", effect: "A small sponsor fee. You're five minutes late to the warm-up." },
    no: { label: "Not today", reply: "No problem. I'll push it to next week.", effect: "Nothing changes. The offer stays open." },
  },
  {
    id: "mate-casino", kind: "friend", caller: "{mate}", leg: "back",
    lines: ["Few of the lads are heading to the casino.", "Nothing mad. One drink, a couple of hands.", "You coming?"],
    yes: { label: "I'm in", reply: "Get in. See you there.", effect: "The fork's Casino sign lights up." },
    no: { label: "Early night", reply: "Boring. Next time, then.", effect: "Nothing changes." },
  },
];

export interface CallMemory {
  /** For the people plan: who, about what, your answer, and when. */
  who: string;
  kind: CallerKind;
  about: string;
  answer: "yes" | "no" | "missed";
  day: number;
}

/** Fill a call's names in (a team-mate, your car, a club). */
export function fillCall(c: DriveCall, names: { mate: string; car: string; club: string }): DriveCall {
  const f = (s: string) => s.replace(/\{mate\}/g, names.mate).replace(/\{car\}/g, names.car).replace(/\{club\}/g, names.club);
  return { ...c, caller: f(c.caller), lines: c.lines.map(f), yes: { label: f(c.yes.label), reply: f(c.yes.reply), effect: f(c.yes.effect) }, no: { label: f(c.no.label), reply: f(c.no.reply), effect: f(c.no.effect) } };
}

/** Which call (if any) rings on this drive: one in three drives, seeded so the same day rings the same. */
export function pickCall(seed: number, leg: "in" | "back", force?: string): DriveCall | null {
  if (force) return DRIVE_CALLS.find((c) => c.id === force) ?? null;
  const r = ((seed * 2654435761) >>> 0) / 4294967296;
  if (r > 0.34) return null;
  const pool = DRIVE_CALLS.filter((c) => c.leg === leg || c.leg === "any");
  return pool[Math.floor((r / 0.34) * pool.length) % pool.length];
}

/** The memory a call leaves (the people plan's hook; phase 1 only hands it to `onMemory`). */
export function callMemory(c: DriveCall, answer: "yes" | "no" | "missed", day: number): CallMemory {
  return { who: c.caller, kind: c.kind, about: c.id, answer, day };
}

/** When the call rings (seconds into the drive): 8-15 s, seeded. */
export const callTime = (seed: number) => 8 + (((seed * 48271) >>> 0) % 70) / 10;
/** Unanswered for this long: a missed call. */
export const CALL_RING_S = 9;
