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
  /** The one duty this chat covers. Never both: they are two chats (P86). */
  duties: SetPieceDuty[];
  /** What he says, one line a tap. */
  lines: string[];
}

const matchesPlayed = (career: CareerState) => career.fixtures.filter((f) => f.played).length;

/**
 * The talk due right now, or null.
 *
 * Harry and Mikey, P86: "two chats" — the penalty-taker talk and the
 * free-kick-taker talk are separate, each at its own moment. If both duties
 * arrive together, the penalty chat comes first and the free-kick chat waits
 * for a LATER match; they are never one conversation and never back to back.
 */
export function setPieceTalkDue(career: CareerState): SetPieceTalk | null {
  const played = matchesPlayed(career);
  if (played < 1) return null;
  // The last chat was after `setPieceTalkAt` matches; the next needs another one.
  if (career.setPieceTalkAt !== undefined && played <= career.setPieceTalkAt) return null;
  const told = career.setPieceTold ?? [];
  const duties = setPieceDuties(career, selectionFor(career).status);
  const first = career.player.firstName;
  if (duties.penalties && !told.includes("penalties")) {
    return { duties: ["penalties"], lines: [`${first}, a word.`, "I'm making you our penalty taker.", "Keep calm. Pick your spot."] };
  }
  if (duties.freeKicks && !told.includes("freeKicks")) {
    return { duties: ["freeKicks"], lines: [`${first}, a word.`, "Free kicks are yours now.", "Technique and vision — make them count."] };
  }
  return null;
}

export function markSetPieceTold(career: CareerState, duties: SetPieceDuty[]): CareerState {
  const told = career.setPieceTold ?? [];
  const add = duties.filter((d) => !told.includes(d));
  return add.length ? { ...career, setPieceTold: [...told, ...add], setPieceTalkAt: matchesPlayed(career) } : career;
}
