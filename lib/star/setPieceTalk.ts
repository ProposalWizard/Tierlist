/**
 * THE MANAGER TELLS YOU, ONCE (Harry, 1 Oct 2026, P78): "I don't know about
 * PK, FK. I just don't think it needs to be said. I think at one point your
 * manager will come up to you, have a conversation with you and say 'I'm
 * making you the penalty taker', and then you'll just know that."
 *
 * The duty itself is unchanged (setPieces.ts). What is gone is every place
 * that wrote the numbers on screen. This is the one moment that says it: the
 * first time you hold a duty — after your first match, so it never lands in
 * the middle of the tutorial — and never again.
 */
import type { CareerState } from "./types";
import { setPieceDuties } from "./setPieces";
import { selectionFor } from "./selection";

export type SetPieceDuty = "penalties" | "freeKicks";

export interface SetPieceTalk {
  /** Every duty this one conversation covers (both, when both are new). */
  duties: SetPieceDuty[];
  /** What he says, one line a tap. */
  lines: string[];
}

/** The talk due right now, or null. Penalties first when both are new. */
export function setPieceTalkDue(career: CareerState): SetPieceTalk | null {
  if (!career.fixtures.some((f) => f.played)) return null;
  const told = career.setPieceTold ?? [];
  const duties = setPieceDuties(career, selectionFor(career).status);
  const first = career.player.firstName;
  const pen = duties.penalties && !told.includes("penalties");
  const fk = duties.freeKicks && !told.includes("freeKicks");
  if (pen && fk) return { duties: ["penalties", "freeKicks"], lines: [`${first}, a word.`, "Penalties and free kicks — I want you on both.", "Don't let me down."] };
  if (pen) return { duties: ["penalties"], lines: [`${first}, a word.`, "I'm making you our penalty taker.", "Keep calm. Pick your spot."] };
  if (fk) return { duties: ["freeKicks"], lines: [`${first}, a word.`, "Free kicks are yours now.", "Make them count."] };
  return null;
}

export function markSetPieceTold(career: CareerState, duties: SetPieceDuty[]): CareerState {
  const told = career.setPieceTold ?? [];
  const add = duties.filter((d) => !told.includes(d));
  return add.length ? { ...career, setPieceTold: [...told, ...add] } : career;
}
