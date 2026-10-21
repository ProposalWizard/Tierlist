/**
 * Settings → "Pop-up pack: Classic | Broadcast" (Harry, 21 Oct 2026, of
 * Mikey's new pop-ups: "add them as a texture pack"). Chosen the way a texture
 * pack is (a dropdown, a picture and a line for each), not a New | Old row.
 *
 *   classic    the pop-ups as they always were (GOAL, PASS… in big letters).
 *   broadcast  Mikey's TV graphics (components/star/MikeyPopup.tsx): a
 *              scoreboard for every goal, captions for everything else.
 *
 * Only names on top of Mikey's switch (lib/star/mikeyPopups.ts): the same
 * localStorage key and values ("old" = Classic, "new" = Broadcast), so a phone
 * that had "Mikey's new pop-ups: New" on keeps Broadcast. Default Classic.
 */
import { mikeyPopupsLook, setMikeyPopupsLook, useMikeyPopupsLook, type MikeyPopupsLook } from "./mikeyPopups";

export type PopupPack = "classic" | "broadcast";
export const POPUP_PACKS: PopupPack[] = ["classic", "broadcast"];
export const POPUP_PACK_DEFAULT: PopupPack = "classic";
export const POPUP_PACK_NAMES: Record<PopupPack, string> = { classic: "Classic", broadcast: "Broadcast" };
export const POPUP_PACK_LINES: Record<PopupPack, string> = {
  classic: "Big words over the pitch: GOAL, PASS, SAVED.",
  broadcast: "Mikey's TV look: a scoreboard for every goal (scorer and assist), captions for the rest.",
};

const LOOK_OF: Record<PopupPack, MikeyPopupsLook> = { classic: "old", broadcast: "new" };
const packOf = (v: MikeyPopupsLook): PopupPack => (v === "new" ? "broadcast" : "classic");

export const popupPack = (): PopupPack => packOf(mikeyPopupsLook());
export const setPopupPack = (p: PopupPack): void => setMikeyPopupsLook(LOOK_OF[p]);
export const usePopupPack = (): PopupPack => packOf(useMikeyPopupsLook());
