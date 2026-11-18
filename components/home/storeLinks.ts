/**
 * WHERE "GET THE GAME" POINTS (the public home, Harry, 12 Nov 2026).
 *
 * There is NO store page yet, so both are `null` and the home shows them as a
 * plain "Coming soon" tag that cannot be tapped. When a real store page
 * exists, paste its address here and the tag becomes a link by itself.
 * Never put a made-up address here.
 */
export interface StoreLink {
  id: "appStore" | "steam";
  name: string;
  /** null = no store page yet: shown as "Coming soon", not a link. */
  href: string | null;
}

export const STORE_LINKS: StoreLink[] = [
  { id: "appStore", name: "App Store", href: null },
  { id: "steam", name: "Steam", href: null },
];
