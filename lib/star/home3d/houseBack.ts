/**
 * WHERE THE HOUSE'S BACK GOES (3D places audit P4, 28 Nov 2026).
 *
 * You walk into your 3D house from the garden's back door (or pick the phone up in the garden, which
 * puts the house behind it). Its Back then says "Garden" and leads there. That memory must last
 * exactly as long as you stay in the garden, the house or the phone held up in it, and be forgotten
 * the moment you go anywhere else (the phone's HOME button, the bottom bar, a match). Before, it was
 * only forgotten by three buttons, and the phone's "put away" forgot it even when you came from the
 * garden. Pure, so tests/star/home3d.mts can check it.
 */

/** The screens the house-from-the-garden memory survives: the garden, the house, the phone held up in it. */
export const HOUSE_FROM_GARDEN_KEEPS = ["garden", "home-3d", "media"] as const;

/** Does the house still remember that you came in from the garden, on this screen? */
export function keepsHouseFromGarden(phase: string): boolean {
  return (HOUSE_FROM_GARDEN_KEEPS as readonly string[]).includes(phase);
}

/** The house's Back: its label and where it leads. */
export function houseBack(fromGarden: boolean): { label: "Garden" | "Home"; to: "garden" | "home" } {
  return fromGarden ? { label: "Garden", to: "garden" } : { label: "Home", to: "home" };
}
