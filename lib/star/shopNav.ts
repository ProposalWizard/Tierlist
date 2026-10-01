/**
 * Which view the Style shop should open on next — "My stuff" when you came
 * from the "My stuff" card on the Shop page, the shop itself otherwise.
 *
 * A one-shot handoff rather than a new screen phase, so app/star-dev/page.tsx
 * (shared by the whole team) needs no change: the Shop page sets it, then
 * opens the Style screen as it always has; the Style screen reads it once.
 */
export type StyleView = "shop" | "mine";

let pending: StyleView | null = null;

export function openStyleOn(view: StyleView): void {
  pending = view;
}

export function takeStyleView(): StyleView {
  const v = pending ?? "shop";
  pending = null;
  return v;
}
