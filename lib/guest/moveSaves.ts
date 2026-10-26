/**
 * lib/guest/moveSaves.ts — bringing a guest's careers into an older account.
 *
 * Only for the one case linkIdentity can't handle: the player taps "Save your
 * career", picks a Google account that ALREADY has a Knowitball account, and
 * signs in to that one instead. The guest's careers are on this device (that's
 * where they were played), so before leaving for Google we note the guest's id;
 * when the game opens on the real account it copies each guest career into the
 * real account's first EMPTY save slot. Nothing is ever overwritten: with no
 * empty slot, the guest career stays where it is and the player is told.
 *
 * The copy then reaches the cloud the normal way (the game uploads a save this
 * device holds that the cloud hasn't seen, lib/star/storage.ts
 * hasUnsyncedProgress). If the real account has a cloud save in that slot this
 * device never downloaded, the game's usual "which save do you keep?" screen
 * appears, so nothing is lost silently.
 */

import { listSaveSlots, peekSlotCareer, writeMovedSave, loadStarPhase, slotScope, MAX_SAVE_SLOTS } from "@/lib/star/storage";

const MOVE_NOTE = "kib-guest-move-from-v1";

export function rememberGuestForMove(guestId: string): void {
  try { localStorage.setItem(MOVE_NOTE, guestId); } catch { /* nothing to move later */ }
}

/** Slots the guest careers landed in (empty = nothing to move, or no room). */
export function moveGuestSavesInto(realUserId: string): { moved: number[]; leftBehind: number } {
  let guestId: string | null = null;
  try { guestId = localStorage.getItem(MOVE_NOTE); } catch { return { moved: [], leftBehind: 0 }; }
  if (!guestId || guestId === realUserId) return { moved: [], leftBehind: 0 };
  try { localStorage.removeItem(MOVE_NOTE); } catch { /* ignore */ }

  const free = listSaveSlots(realUserId).filter((s) => s.empty).map((s) => s.slot);
  const moved: number[] = [];
  let leftBehind = 0;
  for (let slot = 1; slot <= MAX_SAVE_SLOTS; slot++) {
    const career = peekSlotCareer(guestId, slot);
    if (!career) continue;
    const target = free.shift();
    if (target === undefined) { leftBehind++; continue; }
    if (writeMovedSave(realUserId, target, career, loadStarPhase(slotScope(guestId, slot)))) moved.push(target);
    else leftBehind++;
  }
  return { moved, leftBehind };
}
