/**
 * THE OCT 13 GAMEPLAY UPDATE as one switch (Leo, 14 Oct 2026: "have it all in a
 * test area, or maybe have it all in just one old new big update setting").
 *
 * The switch lives on its test page (/star-update-dev), not in Settings (Harry,
 * 12 Oct 2026: unfinished work lives on test pages). It is per phone, so it
 * also changes the real career matches on that phone while Leo tests it.
 */
import { setLookRow, type LookRowId } from "./lookRows";

/** The update's own parts. */
export const OCT13_PARTS: LookRowId[] = ["shotPower", "contactField", "keeperFeel", "mateShots", "matchFeel"];
/** The v0.15 rows it was measured with (tests/star/gameplay13.mts): they ride along. */
export const OCT13_WITH: LookRowId[] = ["shotsPro", "keeperPro", "ballPhysics"];
export const OCT13_ALL: LookRowId[] = [...OCT13_PARTS, ...OCT13_WITH];

export function setOct13(v: "new" | "old"): void {
  for (const id of OCT13_ALL) setLookRow(id, v);
}

/** "new" or "old" when every part agrees, else "mixed". */
export function oct13State(look: Record<LookRowId, string>): "new" | "old" | "mixed" {
  const vals = new Set(OCT13_ALL.map((id) => look[id]));
  return vals.size === 1 ? (vals.has("new") ? "new" : "old") : "mixed";
}
