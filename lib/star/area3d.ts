/**
 * The 3D Test Area's list of cutscenes and 3D areas (Harry, 2 Oct 2026: "a 3D
 * Test Area page on the site: a list of every cutscene / 3D area being built
 * … plus an organised store of all the 3D Blender assets").
 *
 * One row per scene. `href` is where it can be seen today; a planned scene
 * has none. Keep `status` honest — it is what Harry reads first.
 */

export type Scene3dStatus = "Prototype" | "Test page" | "Pictures" | "Planned" | "Proposal";

export interface Scene3d {
  id: string;
  title: string;
  /** One short line: what you see or do. */
  line: string;
  status: Scene3dStatus;
  /** Where to see it now (a page on the site). */
  href?: string;
  /** A picture for the card (a file in public/). */
  thumb?: string;
  /** Where its files live, for whoever builds it next. */
  files: string;
}

export const SCENES_3D: Scene3d[] = [
  {
    id: "shop3d",
    title: "Walk-around shop",
    line: "Walk a footballer round a shop and pretend-buy boots, a car and cans.",
    status: "Test page",
    href: "/star-shop3d-dev",
    thumb: "/star/area3d/shop3d.jpg",
    files: "app/star-shop3d-dev · lib/star/shop3d · public/star/shop3d · tools/shop3d",
  },
  {
    id: "footballer",
    title: "Blender footballer",
    line: "The 3D player in any club's kit: stills, hair and three short clips.",
    status: "Test page",
    href: "/star-blender-dev",
    thumb: "/star/blender/clips/celebrate.jpg",
    files: "app/star-blender-dev · public/star/blender · tools/blender-footballer",
  },
  {
    id: "look3d",
    title: "3D look in every mode",
    line: "One of every mode with the shaded \"3D\" players, next to today's look.",
    status: "Test page",
    href: "/star-3d-dev",
    files: "app/star-3d-dev · lib/star/{figureSkin,figure3d}.ts",
  },
  {
    id: "store",
    title: "Store pictures",
    line: "Coins, boosts and accessories, rendered in the shop's studio.",
    status: "Pictures",
    href: "/star-store-dev",
    thumb: "/shop/store/coins-chest.webp",
    files: "public/shop/store · tools/blender-shop/scripts/store.py",
  },
  {
    id: "home",
    title: "Your home and garage",
    line: "Your house and the car you own, in 3D, in place of \"My stuff\".",
    status: "Planned",
    thumb: "/shop/house-1-L3.webp",
    files: "plan: scratchpad v024/PLAN-3d.md §3b",
  },
  {
    id: "boss",
    title: "Boss meeting and phone unboxing",
    line: "Rendered pictures for the boss cards; a short clip when you buy the phone.",
    status: "Planned",
    thumb: "/shop/phone-L1.webp",
    files: "plan: scratchpad v024/PLAN-3d.md §3c",
  },
];
