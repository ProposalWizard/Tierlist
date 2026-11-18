/**
 * THREE SAVES (the website's Load Game, lib/star/storage.ts MAX_SAVE_SLOTS).
 *
 * The career being played is game/store.ts's one career. The other two saves
 * wait in the phone's storage under their own keys; loading one swaps it in
 * and puts the one you were playing back in its own slot. Nothing is lost:
 * a retired career also stays in the Hall of Fame (world/hall.ts).
 */
import type { CareerState } from "@/lib/star/types";
import { hasClub } from "@/lib/star/calendar";
import { starsNow } from "@/lib/star/starPoints";
import { getCareer, setCareer } from "../game/store";
import { resetSession } from "../game/session";
import { loadJson, saveJson } from "../game/save";
import { addToPhoneHall } from "./hall";

export const MAX_SLOTS = 3;
const ACTIVE = "career-active-slot";
const slotKey = (n: number) => `career-slot-${n}`;

export interface SlotSummary { slot: number; empty: boolean; playerName?: string; club?: string; season?: number; stars?: number; retired?: boolean; signed?: boolean }

export function activeSlot(): number { return loadJson<number>(ACTIVE) ?? 1; }

function careerIn(slot: number): CareerState | null {
  if (slot === activeSlot()) return getCareer();
  return loadJson<CareerState | null>(slotKey(slot)) ?? null;
}

/** storage.ts summariseSave. */
export function listSlots(): SlotSummary[] {
  const out: SlotSummary[] = [];
  for (let slot = 1; slot <= MAX_SLOTS; slot++) {
    const c = careerIn(slot);
    out.push(c ? {
      slot, empty: false, playerName: `${c.player.firstName} ${c.player.lastName}`, club: c.player.club,
      season: c.season, stars: starsNow(c), retired: !!c.retired, signed: hasClub(c),
    } : { slot, empty: true });
  }
  return out;
}

/** Park the career being played in its own slot (before another one comes in). */
function parkCurrent() {
  const c = getCareer();
  saveJson(slotKey(activeSlot()), c ?? null);
}

/** Load a slot (handleSwitchSave). Returns false when it is empty. */
export function loadSlot(slot: number): boolean {
  if (slot === activeSlot()) return !!getCareer();
  const c = loadJson<CareerState | null>(slotKey(slot)) ?? null;
  if (!c) return false;
  parkCurrent();
  saveJson(ACTIVE, slot);
  resetSession();
  setCareer(c);
  return true;
}

/** A new game in a slot (handleStartNewInSlot): the screens then open the new career. */
export function newInSlot(slot: number) {
  if (slot !== activeSlot()) { parkCurrent(); saveJson(ACTIVE, slot); }
  resetSession();
  setCareer(null);
}

/** Delete a save (handleDeleteSave). A retired one is kept in the Hall first. */
export function deleteSlot(slot: number) {
  const c = careerIn(slot);
  if (c?.retired) addToPhoneHall(c);
  if (slot === activeSlot()) { resetSession(); setCareer(null); }
  saveJson(slotKey(slot), null);
}
