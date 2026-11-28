/**
 * THE ROOMS OF YOUR HOME — the plan of each room: its size, its doors (and
 * which room each leads to), what you can stop at in it, and what of yours
 * stands in it. Pure: no three.js. The 3D for one room is ./roomBuild.ts; the
 * walking, the camera and the walk from room to room are ./scene.ts.
 *
 * Harry, 9 Oct 2026: "the house being 1 room is a bit dead, the bigger the
 * house the bigger the space/rooms etc." Which rooms a home has is
 * homes.ts TIER_ROOMS. Only one room is ever built at a time: you walk to a
 * doorway, the screen fades for a moment, the old room goes and the next one
 * is built, and you arrive at its matching door.
 *
 *   room          what is in it
 *   main          the one-room home (starter, flat, and the Old look)
 *   hallway       the front door out to the garden, a console table, your
 *                 home shirt framed, a doorway to each room
 *   lounge        sofa, TV (bigger if you bought one), games console, a drinks
 *                 fridge with your KIB cans, your art, the window onto the drive
 *                 (the penthouse lounge also keeps the trophy cabinet)
 *   dressing      wardrobe and full-length mirror, your boots, a glass island
 *                 with your watches and jewellery, your suit on a stand
 *   trophy        the full cabinet, both kits framed, the Ballon d'Or plinth
 *   terrace       the penthouse's glass terrace over the city
 *   garage        your cars as models, your motorbike, a model of your jet
 *   games         pool table, arcade cabinet, the games console
 *   cinema        a big screen and rows of seats
 *   gym           a treadmill, a rack of weights, a bench, your KIB cans
 *   gardenTerrace the estate's terrace onto the grounds
 *   nook          the flat's hallway: a boot bench, your kits on hooks, keys
 *
 * Anything you have not bought stands as an empty plinth.
 * Tested in tests/star/home3d.mts.
 */
import type { CareerState } from "../types";
import { baseIdOf } from "../shopDefaults";
import { roomPreset, cabinetSize, type HomeTier, type RoomId } from "./homes";

/** Something in a room you can stop at (a card opens). */
export type HomeSpot = "wardrobe" | "cabinet" | "drive";

/** A wall of a room: north is -z (the back), south is +z (where you came in). */
export type Wall = "n" | "s" | "e" | "w";

/** What the room chip says. */
export const ROOM_LABEL: Record<RoomId, string> = {
  main: "Home", hallway: "Hallway", lounge: "Lounge", dressing: "Dressing room", trophy: "Trophy room",
  terrace: "Terrace", garage: "Garage", games: "Games room", cinema: "Cinema", gym: "Gym", gardenTerrace: "Garden terrace",
  nook: "Hallway",
  studio: "Home", kitchen: "Kitchen", bedroom: "Bedroom", bathroom: "Bathroom", poolTerrace: "Pool terrace",
};

/**
 * Where each room's doorway to another room sits: the wall, and how far along
 * it (a fraction of the wall, 0 = the middle; x for n/s walls, z for e/w).
 * The pairs are laid out so you go the way you would expect: west out of the
 * hallway, you come in on the lounge's east side.
 */
const DOOR_AT: Record<RoomId, Partial<Record<RoomId | "garden", [Wall, number]>>> = {
  main: { garden: ["s", 0], nook: ["s", 0] },
  nook: { garden: ["s", 0], main: ["n", 0] },
  hallway: { garden: ["s", 0], lounge: ["w", 0.18], gym: ["w", -0.24], dressing: ["e", 0.18], garage: ["e", -0.24], trophy: ["n", 0] },
  lounge: { hallway: ["e", 0.3], dressing: ["e", 0.3], garden: ["s", 0], terrace: ["n", 0.36], games: ["n", -0.22], cinema: ["n", 0.22], gardenTerrace: ["s", -0.25] },
  dressing: { hallway: ["s", 0.24], lounge: ["s", 0.24] },
  trophy: { hallway: ["s", 0] },
  terrace: { lounge: ["s", 0.25] },
  garage: { hallway: ["w", 0.3] },
  games: { lounge: ["s", 0] },
  cinema: { lounge: ["s", 0] },
  gym: { hallway: ["e", 0.24] },
  gardenTerrace: { lounge: ["n", -0.2] },
  studio: { garden: ["s", 0] },
  kitchen: {}, bedroom: {}, bathroom: {}, poolTerrace: {},
};

/**
 * The living houses' doorways (homes.ts LIVING_ROOMS, recognised by their bedroom). The
 * hallway is the hub of a house (kitchen and lounge west, bedroom, gym and garage east, the
 * trophy room ahead); the bedroom leads on to its bathroom (north) and, on the grand tiers,
 * the dressing room (east). The flat and the penthouse have no hallway: the lounge is the hub.
 */
const DOOR_LIVING: Record<RoomId, Partial<Record<RoomId | "garden", [Wall, number]>>> = {
  main: { garden: ["s", 0] },
  studio: { garden: ["s", 0.22] },
  nook: { garden: ["s", 0], lounge: ["n", 0] },
  hallway: { garden: ["s", 0], lounge: ["w", 0.26], kitchen: ["w", -0.26], bedroom: ["e", 0.28], gym: ["e", 0], garage: ["e", -0.28], trophy: ["n", 0] },
  lounge: { hallway: ["e", 0.3], nook: ["s", 0], garden: ["s", 0.3], bedroom: ["e", 0.3], terrace: ["n", 0.36], games: ["n", -0.22], cinema: ["n", 0.22], poolTerrace: ["s", 0.25], gardenTerrace: ["s", -0.25] },
  kitchen: { hallway: ["e", 0] },
  // the wardrobe has the west wall and the bed the north: in from the south, on through the east
  bedroom: { hallway: ["s", -0.1], lounge: ["s", -0.1], bathroom: ["e", -0.25], dressing: ["e", 0.25] },
  bathroom: { bedroom: ["s", -0.2] },
  dressing: { bedroom: ["s", 0.3] },
  trophy: { hallway: ["s", 0] },
  terrace: { lounge: ["s", 0.25] },
  garage: { hallway: ["w", 0.3] },
  games: { lounge: ["s", 0] },
  cinema: { lounge: ["s", 0] },
  gym: { hallway: ["w", 0] },
  poolTerrace: { lounge: ["n", 0.2] },
  gardenTerrace: { lounge: ["n", -0.2] },
};
/** A living house (its rooms come from homes.ts LIVING_ROOMS: they always have a bedroom). */
export const isLiving = (rooms: RoomId[]) => rooms.includes("bedroom") || rooms.includes("studio");

/** Which room each room's doorway leads to, per tier. The first room holds the front door. */
const LINKS: [RoomId, RoomId][] = [
  ["hallway", "lounge"], ["hallway", "dressing"], ["hallway", "trophy"], ["hallway", "garage"], ["hallway", "gym"],
  ["lounge", "games"], ["lounge", "cinema"], ["lounge", "gardenTerrace"],
  // the penthouse has no hallway: its lounge is the hub
  ["lounge", "dressing"], ["lounge", "terrace"],
  // the flat: its nook by the front door, then the one room
  ["nook", "main"],
  // the living houses
  ["hallway", "kitchen"], ["hallway", "bedroom"], ["nook", "lounge"], ["lounge", "bedroom"],
  ["bedroom", "bathroom"], ["bedroom", "dressing"], ["lounge", "poolTerrace"],
];

/** Room size at the house tier, metres (w along x, d along z). Grand tiers grow them. */
const BASE: Record<RoomId, [number, number]> = {
  main: [0, 0], // the tier's own preset
  hallway: [3.4, 6.4], lounge: [6.6, 6.2], dressing: [4.8, 5.6], trophy: [5.6, 6.0], terrace: [6.4, 4.4],
  garage: [9.4, 6.8], games: [8.6, 7.4], cinema: [5.6, 6.6], gym: [5.8, 6.0], gardenTerrace: [7.2, 6.0],
  nook: [2.6, 3.4],
  studio: [6.6, 7.4], kitchen: [5.4, 5.2], bedroom: [5.6, 5.8], bathroom: [3.6, 3.8], poolTerrace: [9.6, 8.4],
};

export interface DoorPlan {
  /** The room it leads to, or the garden (the front door). */
  to: RoomId | "garden";
  wall: Wall;
  /** The doorway's middle, on the wall line. */
  x: number;
  z: number;
  /** Half its width. */
  half: number;
  /** Pointing into the room. */
  nx: number;
  nz: number;
}

export interface RoomPlan {
  id: RoomId;
  label: string;
  w: number;
  d: number;
  h: number;
  doors: DoorPlan[];
  spots: HomeSpot[];
}

/** The doorway half-width (the old room's front door). */
export const DOOR_HALF = 0.55;

const NORMAL: Record<Wall, [number, number]> = { n: [0, 1], s: [0, -1], e: [-1, 0], w: [1, 0] };

/** How much bigger a grand tier's rooms are than the house's. */
function grow(tier: HomeTier): number {
  return tier === "estate" ? 1.18 : tier === "villa" ? 1.08 : tier === "penthouse" ? 1.0 : 1.0;
}

/** Which rooms a room has doorways to, in this home. */
export function linksOf(id: RoomId, rooms: RoomId[]): (RoomId | "garden")[] {
  const out: (RoomId | "garden")[] = [];
  if (rooms[0] === id) out.push("garden");
  const hub = rooms.includes("hallway") ? "hallway" : "lounge";
  for (const [a, b] of LINKS) {
    if (!rooms.includes(a) || !rooms.includes(b)) continue;
    // with a hallway, the dressing room is off the hallway, not the lounge
    if (hub === "hallway" && a === "lounge" && b === "dressing") continue;
    // a living house: the dressing room is off the bedroom; the bedroom is off the hub
    if (rooms.includes("bedroom") && b === "dressing" && a !== "bedroom") continue;
    if (hub === "hallway" && a === "lounge" && b === "bedroom") continue;
    if (a === id) out.push(b);
    else if (b === id) out.push(a);
  }
  return out;
}

/** Which spots a room has. The penthouse lounge keeps the cabinet (it has no trophy room). */
export function spotsOf(id: RoomId, rooms: RoomId[]): HomeSpot[] {
  if (id === "main") return ["wardrobe", "cabinet", "drive"];
  if (id === "dressing") return ["wardrobe"];
  if (id === "studio") return ["wardrobe", "cabinet"];
  if (id === "bedroom") return rooms.includes("dressing") ? [] : ["wardrobe"];
  if (id === "trophy") return ["cabinet"];
  if (id === "lounge") return rooms.includes("trophy") ? ["drive"] : ["cabinet", "drive"];
  return [];
}

/** The room that holds the trophy cabinet. */
export function cabinetRoom(rooms: RoomId[]): RoomId | null {
  return rooms.find((r) => spotsOf(r, rooms).includes("cabinet")) ?? null;
}

/** How many cabinet spots each room shows (they add up to the tier's cabinet). */
export function trophySlotsByRoom(tier: HomeTier, rooms: RoomId[]): Partial<Record<RoomId, number>> {
  const r = cabinetRoom(rooms);
  return r ? { [r]: cabinetSize(tier) } : {};
}

/** The plan of one room of a home. */
export function roomPlan(tier: HomeTier, id: RoomId, rooms: RoomId[]): RoomPlan {
  const P = roomPreset(tier);
  const k = grow(tier);
  const [bw, bd] = BASE[id];
  const living = isLiving(rooms);
  // the living houses' own sizes: the penthouse's open plan, the flat's smaller rooms, the estate's trophy hall
  const [lw, ld] = living && id === "lounge" && tier === "penthouse" ? [9.6, 7.8] : living && tier === "flat" && (id === "lounge" || id === "bedroom") ? [bw * 0.92, bd * 0.92] : living && id === "trophy" && tier === "estate" ? [bw * 1.12, bd * 1.1] : [bw, bd];
  const w = id === "main" ? P.w : Math.round(lw * k * 100) / 100;
  const d = id === "main" ? P.d : Math.round(ld * k * 100) / 100;
  const h = id === "garage" ? Math.max(3.0, P.h) : id === "hallway" ? P.h + 0.3 : id === "bathroom" || id === "studio" ? Math.min(P.h, 2.7) : P.h;
  const doors: DoorPlan[] = linksOf(id, rooms).map((to) => {
    const [wall, f] = (living ? DOOR_LIVING : DOOR_AT)[id][to] ?? ["s", 0];
    const len = wall === "n" || wall === "s" ? w : d;
    const at = f * len;
    const [nx, nz] = NORMAL[wall];
    const x = wall === "e" ? w / 2 : wall === "w" ? -w / 2 : at;
    const z = wall === "n" ? -d / 2 : wall === "s" ? d / 2 : at;
    return { to, wall, x, z, half: DOOR_HALF, nx, nz };
  });
  return { id, label: id === "main" ? P.label : ROOM_LABEL[id], w, d, h, doors, spots: spotsOf(id, rooms) };
}

/** Where you stand on arriving through a door (1 m inside it), and facing which way. */
export function arrivalAt(door: DoorPlan, inside = 1.0): { x: number; z: number; yaw: number } {
  return { x: door.x + door.nx * inside, z: door.z + door.nz * inside, yaw: Math.atan2(door.nx, door.nz) };
}

/**
 * THE LOBBY BEYOND A DOORWAY (28 Nov 2026: a visitor vanished in the doorway, because the floor stopped at the
 * wall). Every doorway of a room opens onto a short lit space: a bit of hallway (another room) or the porch (the
 * front door). People walk through it and out of sight; roomBuild.ts shellOf draws it, world3d/houseLife.ts walks it.
 * `depth` out from the wall line, `half` its half-width (narrower where two doors share a wall, so the lobbies never
 * cross), `side` where a person stands out of sight in it (lateral, out): off the line from the doorway.
 */
export const LOBBY_DEPTH = 2.3;
export const LOBBY_H = 2.5;
export function lobbyOf(plan: RoomPlan, door: DoorPlan): { half: number; depth: number; side: [number, number] } {
  const along = door.wall === "n" || door.wall === "s";
  const c = along ? door.x : door.z;
  let gap = Infinity;
  for (const o of plan.doors) if (o !== door && o.wall === door.wall) gap = Math.min(gap, Math.abs((along ? o.x : o.z) - c));
  const half = Math.max(door.half + 0.32, Math.min(1.3, gap / 2 - 0.03));
  // out of the line of the doorway: to one side, past the jamb (the front door: the side its door does not swing to)
  return { half, depth: LOBBY_DEPTH, side: [Math.min(half - 0.4, door.half + 0.35), 1.45] };
}
/** A point of a door's lobby (or the room, inside > 0): `lat` along the wall (the door's own left-right), `out` beyond it. */
export function lobbyPoint(door: DoorPlan, lat: number, out: number): [number, number] {
  const tx = -door.nz, tz = door.nx;
  return [door.x + tx * lat - door.nx * out, door.z + tz * lat - door.nz * out];
}

/** The door you come in by from `from` (the one that leads back), else the room's first door. */
export function arrivalDoor(plan: RoomPlan, from: RoomId | "garden" | null): DoorPlan | null {
  return plan.doors.find((d) => d.to === from) ?? plan.doors[0] ?? null;
}

// ── Your things ──────────────────────────────────────────────────────────

/** What you own that a room shows (else an empty plinth). */
export interface HomeStuff {
  watches: ("smart" | "gold" | "luxury")[];
  jewellery: ("silver" | "diamond")[];
  /** KIB cans in the fridge (all three kinds). */
  cans: number;
  bike: boolean;
  jet: boolean;
  /** A horse of your own (the garden terrace looks out on him). */
  horse: boolean;
  tv: boolean;
  console: boolean;
  art: boolean;
  suit: boolean;
}

export const NO_STUFF: HomeStuff = { watches: [], jewellery: [], cans: 0, bike: false, jet: false, horse: false, tv: false, console: false, art: false, suit: false };

/** Your things, from the shop items you own and your cans. */
export function homeStuffOf(career: Pick<CareerState, "ownedItems"> & { kibCans?: CareerState["kibCans"]; horse?: CareerState["horse"] }): HomeStuff {
  const ids = new Set((career.ownedItems ?? []).map((it) => baseIdOf(it)));
  const k = career.kibCans;
  return {
    watches: ([["smartwatch", "smart"], ["gold", "gold"], ["rolex", "luxury"]] as const).filter(([id]) => ids.has(id)).map(([, w]) => w),
    jewellery: ([["silver", "silver"], ["diamond", "diamond"]] as const).filter(([id]) => ids.has(id)).map(([, j]) => j),
    cans: k ? Math.max(0, (k.basic ?? 0) + (k.premium ?? 0) + (k.elite ?? 0)) : 0,
    bike: ids.has("bike"),
    jet: ids.has("jet"),
    horse: !!career.horse,
    tv: ids.has("tv"),
    console: ids.has("console") || ids.has("gaming-pc"),
    art: ids.has("art"),
    suit: ids.has("suit"),
  };
}

/** How many cars a room parks: the drive through the lounge window, or the garage. */
export function carsIn(id: RoomId, tier: HomeTier): number {
  if (id === "garage") return 4;
  if (id === "terrace") return 1; // the penthouse terrace: your best car, through the glass
  if (id === "main" || id === "lounge") return roomPreset(tier).cars;
  if (id === "studio") return 1;
  return 0;
}

/**
 * The garage shows your cars close up, so it loads the shop's full models
 * (Harry, 9 Oct 2026: the light copies look crumpled and blotchy up close),
 * best car first, while they fit GARAGE_HF_TRIS; the rest stay light copies.
 * Triangles measured from the files.
 */
export const CAR_HF: Record<string, { model: string; tris: number }> = {
  "car-1": { model: "/star/shop3d/items/car-family-hf.glb", tris: 36413 },
  "car-2": { model: "/star/shop3d/items/car-hatch-hf.glb", tris: 23280 },
  suv: { model: "/star/shop3d/items/car-suv-hf.glb", tris: 23279 },
  "car-3": { model: "/star/shop3d/items/car-sports-hf.glb", tris: 23278 },
  classic: { model: "/star/shop3d/items/car-classic-hf.glb", tris: 23279 },
  "car-4": { model: "/star/shop3d/items/car-super-hf.glb", tris: 23279 },
};
/** The garage's car triangles at most (full models while they fit; light copies about 4k each). */
export const GARAGE_HF_TRIS = 50000;
/** The garage's cars: full models for the best while they fit the budget, light copies after. */
export function garageCars<T extends { id: string; model: string }>(cars: T[]): T[] {
  let used = 0;
  return cars.slice(0, 4).map((c, i, all) => {
    const hf = CAR_HF[c.id];
    const restLight = (all.length - i - 1) * 4000;
    if (hf && used + hf.tris + restLight <= GARAGE_HF_TRIS) { used += hf.tris; return { ...c, model: hf.model }; }
    used += 4000;
    return c;
  });
}

/** The motorbike, the jet and the garden props, light copies for the home (tools/home3d). */
export const BIKE_LOD = "/star/home3d/bike-lod.glb";
export const JET_LOD = "/star/home3d/jet-lod.glb";
export const TERRACE_PROPS = "/star/home3d/terrace-props.glb";
export const HORSE_MODEL = "/star/garden3d/horse.glb";
/** The house furniture: Kenney Furniture Kit pieces (CC0), one file (tools/home3d/make_furniture.py). */
export const FURNITURE = "/star/home3d/furniture.glb";

/** The model files a room loads (so they can be fetched while you walk to its door). */
export function roomFiles(id: RoomId, tier: HomeTier, cars: { model: string }[], boots: { model: string | null }[], bikeModel: string | null, stuff: HomeStuff = NO_STUFF): string[] {
  const out = (id === "garage" ? garageCars(cars.slice(0, carsIn(id, tier)).map((c) => ({ id: (c as { id?: string }).id ?? "", model: c.model }))) : cars.slice(0, carsIn(id, tier))).map((c) => c.model);
  if (id === "main" || id === "dressing" || id === "nook" || id === "studio" || id === "bedroom") for (const b of boots.slice(0, 2)) if (b.model) out.push(b.model);
  if (id !== "main") out.push(FURNITURE);
  if (id === "garage" && bikeModel) out.push(bikeModel);
  if (id === "gardenTerrace") {
    out.push(TERRACE_PROPS);
    if (stuff.jet) out.push(JET_LOD);
    if (stuff.horse) out.push(HORSE_MODEL);
  }
  return out.filter((f, i) => out.indexOf(f) === i);
}
