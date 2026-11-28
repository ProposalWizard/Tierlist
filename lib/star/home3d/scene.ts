/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * YOUR HOME, IN 3D — one room you walk round, built like the 3D shop and the
 * garden (Harry, 9 Oct 2026: "imagine you actually had your current house with
 * all your stuff and that's where you change clothes").
 *
 * ROOMS (9 Oct 2026): a bigger home has more rooms (./rooms.ts plans them,
 * ./roomBuild.ts builds ONE at a time). This file keeps the renderer, the
 * lights, you, the camera and the walking; walk through a doorway and the
 * screen fades, the old room is freed, the next is built, and you arrive at
 * its matching door. Settings → Look → "House: Old" keeps the one room below.
 *
 * One parametric room (./homes.ts RoomPreset): the home you own in the shop
 * sets its size, floor, walls and what the windows look out on (a starter
 * flat before you buy one). In it:
 *   - the WARDROBE (west wall): your casual sets, your club kits and your boots
 *     on a rail and a shelf, and a full-length MIRROR beside it. Walk up (or
 *     tap it) and the page opens the wardrobe card; pick an outfit and you
 *     change into it, and see it in the mirror (./wear.ts makes the body).
 *   - the TROPHY CABINET (back wall): your real trophies and awards
 *     (./trophies.ts), each a stylised model made here in code, with a brass
 *     name plate; the big ones you have not won are faint shapes that say
 *     "Win it to fill this".
 *   - the DRIVE WINDOW (east wall): your cars on the drive outside (the
 *     shop's generated cars, light copies: tools/home3d/make_lods.mjs).
 *   - the front door leads out to the 3D garden (cb.onDoor).
 *
 * Speed (Harry's rules, docs/3D_HANDBOOK.md section 5): the light is baked in
 * (painted wall shade, floor shade, the sun's patch and lamp pools are
 * glows); live lights are one sky light and ONE sun that casts the shadows,
 * its shadow map drawn again only while you move. Still pieces are joined
 * into a few draws (freezeStatic); the trophies, plates and garments are
 * built as one mesh each. The mirror draws only you and the room's far side
 * (a layer of its own) at a small size, and only while you are near it.
 * The governor (three3d/governor.ts) and the quality tier work as in the shop.
 */
import { installAssetVersions } from "../three3d/assetUrl";
import type { Person3D } from "../people3d";
import { turnTo } from "../three3d/animBlend";
import { TIER_PROFILES, quality3dTier, stepDownTier, shadowSizeFor, type Quality3d } from "../three3d/quality";
import { Governor, sessionStartTier } from "../three3d/governor";
import { DynamicResolution, rememberGpu, noteSceneFiles, acquireRenderer, awaitSmoothFrame, abandonedSceneError, abandonedContainer } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { strideFor, type GaitBlend } from "../three3d/gaitBlend";
import { STROLL_SPEEDS, approach, stickTarget } from "../three3d/gait";
import { OrbitCam, CAM_MIN_Y } from "../three3d/orbitCam";
import { buildGrid, findPath, TapWalker, makeTapMarker, type WalkGrid, type XZ } from "../tapWalk";
import { stepDwell } from "../shop3d/dwell";
import { makeWalkClip } from "../walkClip";
import { numberCanvas, blobCanvas } from "../shop3d/textures";
import type { HomeTier, RoomId } from "./homes";
import type { CabinetSlot } from "./trophies";
import type { Worn, BootChoice, Kit2, CasualSet } from "./outfits";
import { buildWearer, repaintKit, type WearInput } from "./wear";
import { roomPlan, roomFiles, arrivalAt, arrivalDoor, type DoorPlan, type HomeSpot, type HomeStuff } from "./rooms";
import { buildRoom, disposeGroup, roomFree, MIRROR_LAYER, MIRROR_PX, type BuiltRoom, type RoomEnv, type RoomInput } from "./roomBuild";
import { safeCompileAsync } from "../three3d/safeCompile";
import type { InteractCard } from "../world3d/interact";
import type { HouseLife, LifeMate } from "../world3d/houseLife";
import type { HouseVisit } from "../life/dayPlan";
import { roomPeople } from "../life/houseRoutines";
import { FURNITURE, isLiving } from "./rooms";
import { editCamera, editFov, makeLightEditor, type WalkSceneEdit } from "../sceneEdits/walkEdit";
import { ViewCam, headWorld, loadViewMode, showBody, type ViewMode } from "../three3d/viewCam";
import { FOLLOW_CAM_D, FollowBoom, FollowCarry, FollowZoom, FOLLOW_HEAD_Y, attachFollowZoom, boxRoom, capOnLine, followFade, loadFollowZoom, riseForMin, settledArrival, zoomedFollowCam, type FollowCam } from "../three3d/followCam";

export type { HomeSpot } from "./rooms";

/** The room camera (Harry, 9 Oct 2026: "pull it back and up so the room reads"). */
export const ROOM_CAM = {
  /** How far behind him, metres (was 3.3, and clamped to the walls by axis, so it jammed). */
  back: 4.4,
  /** How high (was 2.35). */
  height: 2.9,
  /** The point on him it looks past (was 1.0), and how far ahead of him. */
  lookY: 0.95,
  lookAhead: 2.2,
  /** Kept off the walls and under the ceiling. */
  wallGap: 0.3,
  ceilingGap: 0.18,
  /** For each metre the walls take off the boom, the camera rises this much. */
  riseIfShort: 0.45,
};

/**
 * The walking camera, four ways (Harry, 20 Nov 2026: "the over the shoulder angle
 * when walking in the house felt a bit weird"). D is the game's camera since
 * 20 Nov 2026 ("should camera D go into the real game?" "yes"); A (the game's
 * before, ROOM_CAM), B and C stay for comparing on the 3D phone test page
 * (HomeOptions.houseCam, ?cam=A|B|C there).
 *   A  as the game: high (2.9 m), 4.4 m back, looking steeply down past him,
 *      a little to one side, swinging up to 70° round him near walls.
 *   B  "calm follow": lower (2.3 m) and centred, looking at his chest so the
 *      room ahead reads, a softer and slower follow, a smaller swing (±35°).
 *   C  "over the shoulder": the third-person game camera, at head height
 *      (1.7 m) 2.4 m behind his right shoulder, looking ahead past him, a
 *      narrower lens; it stays straight behind him (no swing round).
 *   D  Harry's pick (20 Nov 2026: "a mix of A and C ... more zoomed, the central
 *      shot but a slightly higher angle from A"): C's distance and lens, centred
 *      straight behind him, at 2.2 m looking a little down at him, a smooth
 *      follow, a small swing (±23°) off walls. The test page's default. Its
 *      numbers and its zoom (pinch / wheel, out to about A's distance) live in
 *      ../three3d/followCam.ts, the base for every 3D area's camera.
 */
export const HOUSE_CAMS: Record<"A" | "B" | "C" | "D", FollowCam> = {
  A: { height: ROOM_CAM.height, back: ROOM_CAM.back, lookY: ROOM_CAM.lookY, lookAhead: ROOM_CAM.lookAhead, side: 0.2, lookSide: 0.1, riseIfShort: ROOM_CAM.riseIfShort, minBoom: 0.6, posK: 5, lookK: 6, yawK: 1.6, swing: 6, fov: 0 },
  B: { height: 2.3, back: 4.2, lookY: 1.15, lookAhead: 1.6, side: 0, lookSide: 0, riseIfShort: 0.3, minBoom: 1.4, posK: 2.6, lookK: 3.2, yawK: 1.0, swing: 3, fov: 60 },
  D: FOLLOW_CAM_D,
  C: { height: 1.72, back: 2.4, lookY: 1.4, lookAhead: 3.2, side: 0.55, lookSide: 0.3, riseIfShort: 0.15, minBoom: 1.0, posK: 6, lookK: 7, yawK: 2.4, swing: 0, fov: 56 },
};
export type HouseCam = keyof typeof HOUSE_CAMS;

/**
 * How long the boom can be from (px, pz) along (dx, dz) before it meets a wall
 * (the room's inside, less a gap): the camera shortens along its own line
 * instead of sliding sideways round him. Pure (tests/star/home3d.mts).
 */
export function roomCamBoom(px: number, pz: number, dx: number, dz: number, want: number, w2: number, d2: number): number {
  return Math.max(0.6, boxRoom(px, pz, dx, dz, -w2, w2, -d2, d2, want));
}

/**
 * Backed onto a wall (just through a doorway, by a wall), the camera swings
 * round him, up to about 70°, to where it has the most room behind him AND
 * the most room in front to look into: a three-quarter view across the room
 * instead of the back of his head or a near wall. The camera's yaw
 * (it stands along (sin yaw, cos yaw) from him). Pure (tests/star/home3d.mts).
 */
export function openCamYaw(px: number, pz: number, yaw: number, want: number, w2: number, d2: number, swing = 6): number {
  let best = yaw, bestScore = -1;
  for (let i = -swing; i <= swing; i++) {
    const a = i * 0.2, y = yaw + a;
    // room behind him for the camera, and room in front of him for the camera to look into
    const ahead = roomCamBoom(px, pz, -Math.sin(y), -Math.cos(y), 6, w2, d2);
    const score = roomCamBoom(px, pz, Math.sin(y), Math.cos(y), want, w2, d2) + 0.6 * ahead - Math.abs(a) * 0.35;
    if (score > bestScore + 1e-6) { bestScore = score; best = y; }
  }
  return best;
}

/**
 * A living house's arrival shot (held until he moves): from just inside the doorway he came in
 * by, up near the ceiling, looking over him into the room, so the room reads and he stands in the
 * lower third, never filling the frame.
 */
export function arrivalShot(door: { x: number; z: number; nx: number; nz: number }, H: number, w2: number, d2: number, you?: { x: number; z: number }, free?: (x: number, z: number) => boolean): { cam: [number, number, number]; look: [number, number, number]; fov: number } {
  // (21 Nov 2026: the old shot stood just outside the doorway at head height, straight behind him: in a
  // kitchen or a garage his back filled the frame and the island or a car hid the room.) Now: inside,
  // in a corner beside the door he came in by, up near the ceiling, looking down past him into the
  // room, so the room reads and he stands in the lower part of the frame. Of the two corners, the one
  // whose line down to him is clear of furniture (a car, an island) and nearer the wall's middle.
  const tx = -door.nz, tz = door.nx; // along the door's wall
  const clamp = (v: number, m: number) => Math.max(-m + 0.3, Math.min(m - 0.3, v));
  const camY = Math.max(2.1, H - 0.25);
  const deep = (Math.abs(door.nx) > 0.5 ? w2 : d2) * 2; // the room's depth from this door
  const me = you ?? { x: door.x + door.nx * 2.2, z: door.z + door.nz * 2.2 };
  let best: { cam: [number, number, number]; s: number; score: number } | null = null;
  // (0: straight behind him over the doorway, when furniture crowds both corners: a garage's cars)
  for (const s of [1, -1, 0]) {
    const cam: [number, number, number] = [clamp(door.x + door.nx * 0.3 + tx * s * 1.2, w2), camY, clamp(door.z + door.nz * 0.3 + tz * s * 1.2, d2)];
    // the sight line from the camera down to his chest: count the low points over furniture
    let blocked = 0;
    for (let i = 1; i < 12; i++) {
      const t = i / 12, y = camY + (1.2 - camY) * t;
      const x = cam[0] + (me.x - cam[0]) * t, z = cam[2] + (me.z - cam[2]) * t;
      // low over furniture: in the way; high over it (right under the camera): it fills the foreground
      if (free && !free(x, z)) blocked += y > 1.6 ? 0.5 : 1;
    }
    // the foreground: the floor in the wedge from under the camera out to him (a car's bonnet there fills the bottom of the frame)
    if (free) {
      const dx = me.x - cam[0], dz = me.z - cam[2], L = Math.hypot(dx, dz) || 1, px = -dz / L, pz = dx / L;
      for (let i = 1; i <= 5; i++) for (const w of [-1, -0.5, 0, 0.5, 1]) {
        const t = i / 6, half = 0.9 * t;
        if (!free(cam[0] + dx * t + px * w * half, cam[2] + dz * t + pz * w * half)) blocked += 0.3;
      }
    }
    const along = (cam[0] - door.x) * tx + (cam[2] - door.z) * tz;
    const score = -blocked * 10 + Math.abs(along) - Math.abs(cam[0] * tx + cam[2] * tz) * 0.3 - (s === 0 ? 1.5 : 0);
    if (!best || score > best.score) best = { cam, s, score };
  }
  const { cam, s } = best!;
  // look between him and the far side of the room: he sits low in the frame, the room above him
  const rx = door.x + door.nx * deep * 0.62 - tx * s * 0.45, rz = door.z + door.nz * deep * 0.62 - tz * s * 0.45;
  return { cam, look: [clamp(me.x * 0.6 + rx * 0.4, w2), 0.55, clamp(me.z * 0.6 + rz * 0.4, d2)], fov: 66 };
}

export interface HomeData {
  tier: HomeTier;
  /** The club's kits (home, away) and your shirt number. */
  kits: { home: Kit2; away: Kit2 };
  number: number;
  /** What you are wearing as the home opens. */
  worn: Worn;
  skin: string;
  hair: string;
  hairStyle?: "short" | "long" | "buzz" | "none";
  /** The cabinet's spots (./trophies.ts cabinetSlots, sized for the tier). */
  slots: CabinetSlot[];
  /** Your cars on the drive (./outfits.ts carsOnDrive). */
  cars: { id: string; model: string; length: number }[];
  /** The boots on the wardrobe shelf (./outfits.ts bootChoices). */
  boots: BootChoice[];
  /** The rail: every casual set, then the two kits. */
  casual: CasualSet[];
  /** The rooms you walk through (./homes.ts roomsFor). Unset: the one room. */
  rooms?: RoomId[];
  /** Your watches, jewellery, cans, bike, jet... (./rooms.ts homeStuffOf). */
  stuff?: HomeStuff;
  /** The motorbike's model (the garage). */
  bikeModel?: string | null;
  /** Your club (its name on the cinema screen). */
  club?: string;
  /** Your club's drawn badge, an SVG picture (on the cinema screen). */
  badge?: string;
}

export interface HomeCallbacks {
  /** He is standing at a spot (its card should open), or left it. */
  onNear: (spot: HomeSpot | null) => void;
  onFps?: (fps: number) => void;
  /** He walked out of the front door (to the 3D garden). Absent: the door is shut. */
  onDoor?: () => void;
  /** The phone took the 3D away. */
  onContextLost?: () => void;
  /** He is in a room now (on opening, and after each doorway). */
  onRoom?: (id: RoomId, label: string) => void;
  /** A living house: the card of a thing or a team-mate (lib/star/world3d/interact.ts), or null. */
  onCard?: (card: InteractCard | null) => void;
}

export interface HomeOptions {
  /** The screen was closed while this was still building (3D places audit P1): stop at the next step, never take the canvas. */
  isDead?: () => boolean;
  quality?: Quality3d;
  /** Look H (the broadcast pass) or the plain look. Unset: Settings → Look → "3D look". */
  lookH?: boolean;
  fixedStep?: number;
  /** The 3D Scene Editor's edit (/star-scene-editor-dev), or an approved one in the
   *  game (lib/star/sceneEdits). Absent = the house exactly as before. */
  edit?: WalkSceneEdit | null;
  /** The 3D phone (RUL-UI-008, /star-phone3d-dev): open in his eyes (he is
   *  hidden), for a phone held up in front of them; setPov eases back out to
   *  the normal camera. Absent = the house exactly as before. */
  pov?: boolean;
  /** The 3D phone test page only: try walking camera A, B or C (HOUSE_CAMS). Absent = D, the game's camera (with its zoom). */
  houseCam?: HouseCam;
  /** A living house (homes.ts LIVING_TIERS, the world-kit test page): things you use, team-mates round. Absent = as before. */
  living?: { mates: LifeMate[]; club?: string; chat?: (id: string) => { line: string; change?: string } | null;
    /** You used a thing: the career's answer (lib/star/life/houseActs.ts: time, energy, mood within the day's caps) for its card. */
    onEffect?: (thing: string, e: { mood?: number; energy?: number; text?: string }) => { text: string; sub?: string } | void;
    /** "Sleep till morning" in your bed: called in the dark, once the night has passed; returns the card's words (home3d/sleep.ts). */
    onSleep?: () => string;
    /** The career clock (lib/star/life/liveClock.ts): minutes since day 0 of this gap, now. Absent: the house's own clock (15:00). */
    clock?: () => number;
    /** Tick the career clock by the house's own frame time (s). */
    tick?: (dt: number) => void;
    /** "Start a workout" at the home gym's kit (gym/homeGym.ts): the page opens the gym of this house's level. */
    onGym?: () => void;
    /** Who is in the house on a day of the gap (lib/star/life/dayPlan.ts). Absent: the old fixed team-mates. */
    visits?: (day: number) => HouseVisit[] };
}

export interface HomeController {
  setStick: (x: number, y: number) => void;
  orbit: (dx: number, dy?: number) => void;
  pick: (clientX: number, clientY: number) => HomeSpot | null;
  /** Tap to move: on a spot, walk up to it (its card opens as he arrives); on the floor, walk there. */
  tap: (clientX: number, clientY: number) => { spot: HomeSpot | null } | null;
  /** Walk up to a spot (its card opens as he arrives). */
  walkToSpot: (spot: HomeSpot) => boolean;
  /** A card is open: the camera frames that spot (the wardrobe: he steps to the mirror). */
  setCardOpen: (spot: HomeSpot | null) => void;
  /** Change clothes. Resolves once he is wearing it. */
  wear: (worn: Worn) => Promise<void>;
  /** For checking: stand him at (x, z) facing yaw. */
  place: (x: number, z: number, yaw?: number) => void;
  where: () => { x: number; z: number; yaw: number; t: number; changing: boolean };
  /** For checking: a fixed test camera (null: back to the follow camera). */
  debugCamera: (pos: [number, number, number] | null, look?: [number, number, number], fov?: number) => void;
  /** The room's plan, for checking: spots and their places. */
  plan: () => Record<string, unknown>;
  stats: () => { calls: number; triangles: number; pixelRatio: number; quality: string; merged?: { before: number; after: number }; mirror: boolean; room?: string; swapMs?: number };
  /** The room he is in. */
  room: () => RoomId;
  /** Every room of the home, in order (the dots). */
  rooms: () => { id: RoomId; label: string }[];
  /** Jump to a room (a dot): the fade, then he stands inside its door. */
  goToRoom: (id: RoomId) => Promise<boolean>;
  /** 3D Scene Editor (and approved edits in the game): the edit to play with (null = as written). */
  setEdit: (e: WalkSceneEdit | null) => void;
  /** Editor only: stand him for a view ("follow", or a card in this room: wardrobe, cabinet, drive) and frame it. False: not in this room. */
  showView: (id: string) => boolean;
  /** Editor only: where the camera stands and looks at the last frame. */
  cameraPose: () => { pos: [number, number, number]; look: [number, number, number]; fov: number };
  /** Editor only: the room from above for the mini-map. */
  layout: () => { people: { id: string; x: number; z: number }[]; sunDir: [number, number, number]; bounds: { min: [number, number, number]; max: [number, number, number] } };
  /** First person (the 3D phone): 1 = his eyes (he is hidden), 0 = the normal
   *  camera, between = on the straight line from one to the other (he fades in
   *  once the camera is clear of his head); null = off, as before. */
  setPov: (k: number | null) => void;
  /** First person | third person (the eye button; ../three3d/viewCam.ts), remembered per device. */
  setView: (m: ViewMode) => void;
  viewMode: () => ViewMode;
  /** The 3D phone in the game (components/star/HousePhone.tsx): ease the pov to `to` over `ms` inside the
   *  house's own loop (it runs while easing, at the moving frame rate); `done` after the last frame. setPov cancels it. */
  easePov?: (to: number | null, ms: number, done?: () => void) => void;
  /** Hold the picture: draw one frame, then no loop at all until hold(false). */
  hold: (on: boolean) => void;
  /** Draw one frame now (a held house, or filming frame by frame). */
  renderOnce: () => void;
  /** A living house: press a card's button (use, leave, chat, close). */
  act?: (id: string) => void;
  /** A living house: tap a thing or a team-mate by id (filming). */
  tapThing?: (id: string) => boolean;
  /** A living house: what is going on (the seat check, who is where). */
  lifeDebug?: () => Record<string, unknown>;
  dispose: () => void;
}

/** Opens the home; on any failure the half-built renderer is let go before the error goes up. */
export async function startHome(container: HTMLElement, cb: HomeCallbacks, data: HomeData, opts: HomeOptions = {}): Promise<HomeController> {
  const own: { release?: (root?: any) => void; root?: any } = {};
  try {
    const t0 = performance.now();
    const c = await buildHome(container, cb, data, opts, own);
    noteSceneFiles("home", t0); // what it asked for: Home's next preload fetches exactly these (three3d/perf.ts)
    return c;
  } catch (e) {
    // the shared renderer stays alive (three3d/perf.ts acquireRenderer); only this half-built scene goes
    if (own.release) { try { own.release(own.root); } catch { /* gone */ } }
    throw e;
  }
}

async function buildHome(container: HTMLElement, cb: HomeCallbacks, data: HomeData, opts: HomeOptions, own: { release?: (root?: any) => void; root?: any }): Promise<HomeController> {
  /** The screen closed while this was still building (3D places audit P1): stop at the next step. */
  const gone = () => !!opts.isDead?.() || abandonedContainer(container);
  // the scene's own tier (Settings, else Auto); built lower if this session's
  // governor already settled lower (three3d/governor.ts sessionStartTier), so a
  // door never opens a place too heavy for the phone and then steps it down
  const ownTier: Quality3d = opts.quality ?? quality3dTier();
  let tier: Quality3d = sessionStartTier(ownTier);
  let prof = TIER_PROFILES[tier];
  const rooms: RoomId[] = data.rooms?.length ? data.rooms : ["main"];
  const plan0 = roomPlan(data.tier, rooms[0], rooms);
  /** The room you are in now: half its width and depth, its height. */
  let W2 = plan0.w / 2, D2 = plan0.d / 2, H = plan0.h;
  const THREE: any = await import("three");
  await installAssetVersions(); // every file this place asks for by its versioned address (three3d/assetUrl.ts)
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { RoomEnvironment }: any = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const { mergeGeometries }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  const { Reflector }: any = await import("three/examples/jsm/objects/Reflector.js");
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const lookH = opts.lookH ?? (await import("../look3dStyle")).look3dStyle() === "h";

  // ── Renderer (as the shop: one tier chosen first, the governor, still/moving pixels) ──
  // ONE renderer for every 3D place (three3d/perf.ts): no new WebGL context, shaders kept, at each door
  // closed while its files loaded (3D places audit P1, 28 Nov 2026): never take the canvas from the place on screen
  if (gone()) throw abandonedSceneError();
  const { renderer, release, isOwner } = acquireRenderer(THREE, container, prof);
  own.release = release;
  rememberGpu(renderer);
  const dpr = window.devicePixelRatio || 1;
  let capAlways = false;
  const gov = new Governor({ start: tier, ceiling: ownTier, name: "home", slowSeconds: 2, onChange: (r, _i, why) => {
    if (why === "start") return;
    if (why === "down" && r.tier !== tier) { if (!stepDown()) capAlways = true; }
    pr = stillPR(); renderer.setPixelRatio(pr);
  } });
  let govCap = 60;
  const STILL_H: Record<string, number> = { low: 1.25, medium: 2, high: 2.5 };
  const stillPR = () => Math.min(dpr, lookH ? Math.max(prof.maxPixelRatio, STILL_H[tier] ?? 1.5) : prof.maxPixelRatio);
  let dynPR = Math.min(dpr, prof.movePixelRatio);
  const makeDyn = () => new DynamicResolution(
    { setPixelRatio: (v: number) => { dynPR = v; } },
    { maxPixelRatio: prof.movePixelRatio, minPixelRatio: prof.minPixelRatio, fpsCap: prof.fpsCap },
    { step: 0.125, devicePixelRatio: dpr },
  );
  let dyn = makeDyn();
  const movePR = () => Math.min(dpr, gov.rung.pixelRatio, prof.movePixelRatio, dynPR);
  let pr = stillPR();
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // drawn again only when something under the sun moves
  let disposed = false;
  const onLost = (e: Event) => { e.preventDefault(); if (!disposed) cb.onContextLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  const scene = new THREE.Scene();
  own.root = scene;
  scene.background = new THREE.Color("#1a1612");
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.4;
  // Look H: the indoor broadcast pass (no baked set for the home: its shade is painted in, below)
  const hEnh = lookH ? (await import("../style3d/real/enhance")).enhanceH(THREE, renderer, scene, tier, "indoor", { exposure: opts.living ? 0.92 : 1.05, bake: null }) : null;
  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 80);

  // ── Light: one sky light, one sun through the drive window (the only shadow) ──
  const hemi = new THREE.HemisphereLight("#fff3e2", "#6a5440", 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffe0b0", 1.7);
  sun.position.set(W2 + 5, 5.5, -1.5);
  sun.target.position.set(-0.5, 0, 0.5);
  scene.add(sun, sun.target);
  const SUN_MAP = 1024;
  sun.castShadow = prof.shadows;
  {
    const n = shadowSizeFor(prof, SUN_MAP) || SUN_MAP;
    sun.shadow.mapSize.set(n, n);
    const s = Math.max(W2, D2) + 1;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 20 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
  }
  // the mirror sees by the same light
  for (const l of [hemi, sun]) l.layers.enable(MIRROR_LAYER);
  // a living house: less flat fill, a warmer, stronger sun, so shapes read (the research demo's "real light" step)
  if (opts.living) { hemi.intensity = 0.7; hemi.groundColor.set("#4a3828"); sun.intensity = 2.1; sun.color.set("#ffd7a0"); scene.environmentIntensity = 0.45; renderer.toneMappingExposure = 0.92; }

  // ── The house clock's light: as built (day), night, the next morning (sleeping in your bed) ──
  // Only the two live lights, the sky reflections and the painted window views and sun patches change: 0 ms a frame when still.
  type DayLight = { hemi: number; sun: number; env: number; hemiC: any; sunC: any; view: any; patch: number; lamp: number; exp: number };
  const DAY0 = { hemi: hemi.intensity, sun: sun.intensity, env: scene.environmentIntensity, exp: renderer.toneMappingExposure };
  const LIGHTS: Record<"day" | "night" | "morning", DayLight> = {
    day: { hemi: 1, sun: 1, env: 1, hemiC: hemi.color.clone(), sunC: sun.color.clone(), view: new THREE.Color("#ffffff"), patch: 1, lamp: 1, exp: 1 },
    // night: the lamps off, a cold blue moonlight through the window, the view outside dark
    night: { hemi: 0.2, sun: 0.22, env: 0.22, hemiC: new THREE.Color("#8fa2d8"), sunC: new THREE.Color("#7f9ce0"), view: new THREE.Color("#141b30"), patch: 0, lamp: 0.08, exp: 0.82 },
    // the next morning: warm, low sun through the same window, the lamps off
    // (the room's reflections are neutral white: turned down so the warm sky light shows)
    morning: { hemi: 1.35, sun: 1.45, env: 0.6, hemiC: new THREE.Color("#ffc98e"), sunC: new THREE.Color("#ffb468"), view: new THREE.Color("#ffd8a6"), patch: 1.5, lamp: 0.2, exp: 1.12 },
  };
  let lightFrom: DayLight = LIGHTS.day, lightTo: DayLight = LIGHTS.day, lightK = 1;
  /** Painted things that follow the clock (roomBuild tags them: window views, skies, sun patches). */
  let dayMats: any[] = [];
  const scratchC = new THREE.Color();
  const applyDayLight = () => {
    const k = lightK, A = lightFrom, B = lightTo, mix = (a: number, b: number) => a + (b - a) * k;
    hemi.intensity = DAY0.hemi * mix(A.hemi, B.hemi);
    sun.intensity = DAY0.sun * mix(A.sun, B.sun);
    scene.environmentIntensity = DAY0.env * mix(A.env, B.env);
    hemi.color.copy(A.hemiC).lerp(B.hemiC, k);
    sun.color.copy(A.sunC).lerp(B.sunC, k);
    scratchC.copy(A.view).lerp(B.view, k);
    const patch = mix(A.patch, B.patch), lamp = mix(A.lamp, B.lamp);
    renderer.toneMappingExposure = DAY0.exp * mix(A.exp, B.exp);
    for (const m of dayMats) {
      const kind = m.userData.daylight, base = m.userData.dayBase;
      if (kind === "emit") m.emissiveIntensity = base * lamp;
      else if (kind === "patch") m.color.copy(base).multiplyScalar(patch);
      else if (kind === "lamp") m.color.copy(base).multiplyScalar(lamp);
      else m.color.copy(base).multiply(scratchC);
    }
  };
  /** After a room is built: find its painted things and put them in the light of the hour. */
  const collectDayMats = (g: any) => {
    dayMats = [];
    g.traverse((o: any) => {
      const m = o.material;
      if (!m || Array.isArray(m) || !m.userData?.daylight) return;
      if (m.userData.dayBase === undefined) m.userData.dayBase = m.userData.daylight === "emit" ? m.emissiveIntensity : m.color.clone();
      if (!dayMats.includes(m)) dayMats.push(m);
    });
    applyDayLight();
  };
  /** The light to `to` (k 0..1 of the way from what it is now). */
  const lightTowards = (to: DayLight) => {
    // from where it is now (mid-change: frozen as it stands)
    const now: DayLight = {
      hemi: hemi.intensity / DAY0.hemi, sun: sun.intensity / DAY0.sun, env: scene.environmentIntensity / DAY0.env,
      hemiC: hemi.color.clone(), sunC: sun.color.clone(), view: lightFrom.view.clone().lerp(lightTo.view, lightK), patch: lightFrom.patch + (lightTo.patch - lightFrom.patch) * lightK,
      lamp: lightFrom.lamp + (lightTo.lamp - lightFrom.lamp) * lightK, exp: renderer.toneMappingExposure / DAY0.exp,
    };
    lightFrom = now; lightTo = to; lightK = 0;
  };

  // ── Helpers (the shell's own: your number, your shadow blob) ──
  const tex = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = prof.anisotropy;
    return t;
  };
  const seen = (o: any) => { o.traverse((c: any) => c.layers.enable(MIRROR_LAYER)); return o; };
  const blobT = tex(blobCanvas());
  const blob = (w: number, d: number, x: number, z: number, opacity = 0.9) => {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity }));
    me.position.set(x, 0.012, z);
    me.rotation.set(-Math.PI / 2, 0, 0);
    me.renderOrder = 1;
    scene.add(me);
    return me;
  };

  // ── Loaders (a model is fetched once, then cloned into each room that shows it) ──
  const loader = new GLTFLoader();
  await withMeshopt(loader);
  const glbCache = new Map<string, Promise<any>>();
  const glb = (url: string): Promise<any> => {
    const had = glbCache.get(url);
    if (had) return had;
    const pr: Promise<any> = loader.loadAsync(url);
    pr.catch(() => glbCache.delete(url));
    glbCache.set(url, pr);
    return pr;
  };

  // ── The room you are in: one at a time (./roomBuild.ts; which rooms, ./rooms.ts) ──
  const roomIn: RoomInput = { tier: data.tier, rooms, kits: data.kits, slots: data.slots, cars: data.cars, boots: data.boots, casual: data.casual, stuff: data.stuff, bikeModel: data.bikeModel ?? null, club: data.club, badge: data.badge };
  const env: RoomEnv = { THREE, mergeGeometries, Reflector, prof, quality: tier, envTex, doorOpen: !!cb.onDoor, glb, cloneSkinned: (o: any) => SkeletonUtils.clone(o) };
  // a living house: its furniture (one file, ./furniture.ts) before the first room is built
  if (isLiving(rooms)) env.creased = (await import("three/examples/jsm/utils/BufferGeometryUtils.js") as any).toCreasedNormals;
  if (isLiving(rooms)) env.furniture = (await glb(FURNITURE).catch((e: unknown) => { console.error("home: furniture", e); return null; }))?.scene ?? undefined;
  let room: BuiltRoom = buildRoom(env, roomIn, rooms[0]);
  scene.add(room.group);
  collectDayMats(room.group);
  /** The editor's key-light edit, put back after each room's sun is placed (set below). */
  let reLight = () => {};
  const fitSun = () => {
    W2 = room.w2; D2 = room.d2; H = room.h;
    sun.position.set(W2 + 5, 5.5, -1.5);
    const sz = Math.max(W2, D2) + 1;
    Object.assign(sun.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz });
    sun.shadow.camera.updateProjectionMatrix();
    reLight();
  };
  fitSun();

  // ── You ──
  const numberTex = tex(numberCanvas(data.number, "#ffffff"));
  const wearIn = (worn: Worn): WearInput => ({
    worn, kits: data.kits, number: numberTex, skin: data.skin, hair: data.hair, hairStyle: data.hairStyle,
    outline: prof.outlines ? 0.006 : 0, castShadow: true,
  });
  type Me = { person: Person3D; worn: Worn; gait: GaitBlend | null; idle: any; walk: any; jog: any };
  const dressUp = async (worn: Worn): Promise<Me> => {
    const person = await buildWearer(THREE, SkeletonUtils, loader, wearIn(worn));
    const idle = person.actions.idle;
    const walk = person.mixer.clipAction(makeWalkClip(THREE, person.actions.jog.getClip(), person.actions.idle.getClip()));
    walk.play(); walk.setEffectiveWeight(0);
    const jog = person.actions.jog;
    for (const a of [idle, walk, jog]) a.setEffectiveWeight(0);
    idle.setEffectiveWeight(1);
    const gait = await strideFor(THREE, person, person.mixer, { idle, walk, jog }).catch((e) => { console.error("home: gait clips", e); return null; });
    seen(person.root);
    return { person, worn, gait, idle, walk, jog };
  };
  let me = await dressUp(data.worn);
  if (disposed || gone()) throw new Error("disposed");
  // camera D opens settled: he starts far enough inside the front door for its whole boom (followCam.ts settledArrival)
  const START = (() => {
    const door = room.plan.doors[0];
    if (!door || (opts.houseCam ?? "D") !== "D" || opts.pov) return room.start;
    const back = zoomedFollowCam(loadFollowZoom(), FOLLOW_CAM_D).back;
    if (opts.living) for (const dIn of [2.6, 2.3, 2.0]) { const a = arrivalAt(door, dIn); if (roomFree(room, a.x, a.z) && Math.abs(a.x) < room.w2 - 0.5 && Math.abs(a.z) < room.d2 - 0.5) return a; }
    return settledArrival(door, (x, z) => roomFree(room, x, z) && Math.abs(x) < room.w2 - 0.6 && Math.abs(z) < room.d2 - 0.6, back) ?? room.start;
  })();
  me.person.root.position.set(START.x, 0, START.z);
  me.person.root.rotation.y = START.yaw;
  scene.add(me.person.root);
  const meBlob = blob(0.85, 0.85, START.x, START.z, 0.75);

  // look H draws into its pass's picture: build the shaders for THAT (enhance.ts compile), not the screen
  try { await (hEnh ? hEnh.compile(scene, camera) : safeCompileAsync(renderer, scene, camera)); } catch { /* compiled on first use */ }
  if (disposed || gone()) throw new Error("disposed");

  // ── State ──
  let stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  /** The walking camera (D = the game's, unless the test page asks for A, B or C). */
  const camKey: HouseCam = opts.houseCam ?? "D";
  let CS: FollowCam = HOUSE_CAMS[camKey];
  // D zooms (pinch / wheel) between D and about A's distance, remembered per device (three3d/followCam.ts)
  const zoom = camKey === "D" ? new FollowZoom(loadFollowZoom()) : null;
  /** The boom behind him, eased on its own off the walls (the doorway jam: three3d/followCam.ts). */
  const boom = new FollowBoom();
  const carry = new FollowCarry();
  /** How far (flat) the camera stood from him last frame. */
  let lastFlat = 9;
  const zoomCam: FollowCam = { ...FOLLOW_CAM_D };
  const detachZoom = zoom ? attachFollowZoom(container, zoom) : null;
  /** First person | third person (the eye button), eased; using something steps back out to third (../three3d/viewCam.ts). */
  // (the 3D phone held up in first person is simply his eyes: the phone's pull-back is skipped)
  const view = new ViewCam(opts.fixedStep ? "third" : loadViewMode());
  const viewHead = new THREE.Vector3();
  if (zoom) CS = zoomedFollowCam(zoom.now, FOLLOW_CAM_D, zoomCam);
  let speed = 0, yaw = Math.PI, camYaw = openCamYaw(START.x, START.z, START.yaw + Math.PI, CS.back, room.w2 - ROOM_CAM.wallGap, room.d2 - ROOM_CAM.wallGap, CS.swing), orbitHold = 0;
  /** The shown facing's turn speed (three3d/animBlend.ts turnTo: turns ease in and out). */
  const yawTurn = { yaw: 0, vel: 0 };
  const orb = new OrbitCam();
  let near: HomeSpot | null = null;
  let dwellZone: HomeSpot | null = null;
  let dwell = { timer: 0, open: false };
  /** Just walked in (a living house): no spot's card until he moves, so the arrival shot holds (the garage's drive spot took it over). */
  let quietArrival = false;
  let arrivedAt: HomeSpot | null = null, spotWalk: HomeSpot | null = null;
  let framed: HomeSpot | null = null, frame = 0;
  let gameT = 0, frames = 0, fpsT0 = performance.now();
  let changing = false;
  let shadowDirty = true, shadowT = 0;
  let dbgCam: { pos: [number, number, number]; look: [number, number, number] } | null = null;
  /** The room's opening shot, held until he moves (a room frames its hero: the garage's cars, the games room). */
  let lastIntroFov = false;
  let intro: BuiltRoom["intro"] | null = room.intro ?? (opts.living && room.plan.doors[0] ? arrivalShot(room.plan.doors[0], room.h, room.w2, room.d2, START, (x, z) => roomFree(room, x, z)) : null);
  const walker = new TapWalker();
  const marker = makeTapMarker(THREE, scene);
  let grid: WalkGrid | null = null;
  let faceTo: XZ | null = null;
  const stopWalk = () => { if (walker.active) { walker.cancel(); marker.fade(); } faceTo = null; };
  const onKey = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) return;
    if (down) { keys.add(k); stopWalk(); } else keys.delete(k);
    if (k.startsWith("arrow")) e.preventDefault();
  };
  const kd = (e: KeyboardEvent) => onKey(e, true);
  const ku = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  let lastOff = -1;
  /** The editor's edit (none = as written), and the screen's own lens it starts from. */
  let edit: WalkSceneEdit | null = opts.edit ?? null;
  let baseFov = 56;
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = CS.fov && w / h < 0.7 ? CS.fov : w / h < 0.7 ? 64 : 56;
    baseFov = camera.fov;
    lastOff = -1;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  const RR = 0.3;
  let leftByDoor = false;
  /** Through a doorway: the garden (a career leaves the house) or the next room. */
  const throughDoor = (d: DoorPlan) => {
    if (d.to === "garden") { if (!leftByDoor) { leftByDoor = true; cb.onDoor?.(); } return; }
    void goToRoom(d.to, room.id);
  };
  const collide = (x: number, z: number): [number, number] => {
    // the room's walls, opened where he stands in a doorway (he can step through it)
    let x0 = -W2 + RR, x1 = W2 - RR, z0 = -D2 + RR, z1 = D2 - RR;
    const open: DoorPlan[] = [];
    for (const d of room.doors) {
      const inGap = d.wall === "n" || d.wall === "s" ? Math.abs(x - d.x) < d.half - 0.1 : Math.abs(z - d.z) < d.half - 0.1;
      if (!inGap) continue;
      if (d.wall === "s") z1 = D2 + 0.9; else if (d.wall === "n") z0 = -D2 - 0.9; else if (d.wall === "e") x1 = W2 + 0.9; else x0 = -W2 - 0.9;
      open.push(d);
    }
    x = Math.max(x0, Math.min(x1, x));
    z = Math.max(z0, Math.min(z1, z));
    // (two doors can face each other across a room: the one he is stepping through is the one he is past)
    if (!swapping) for (const d of open) {
      const past = d.wall === "s" ? z - D2 : d.wall === "n" ? -D2 - z : d.wall === "e" ? x - W2 : -W2 - x;
      if (past > 0.25) { throughDoor(d); break; }
    }
    for (const [sx0, sx1, sz0, sz1] of room.solids) {
      if (x > sx0 - RR && x < sx1 + RR && z > sz0 - RR && z < sz1 + RR) {
        const push = [x - (sx0 - RR), sx1 + RR - x, z - (sz0 - RR), sz1 + RR - z];
        const m = Math.min(...push);
        if (m === push[0]) x = sx0 - RR; else if (m === push[1]) x = sx1 + RR; else if (m === push[2]) z = sz0 - RR; else z = sz1 + RR;
      }
    }
    return [x, z];
  };
  const isFree = (x: number, z: number) => roomFree(room, x, z);
  /** Where each spot is stood at, and what he looks at there. */
  const standFor = (s: HomeSpot): { at: XZ; face: XZ } => {
    const p = me.person.root.position;
    return room.standFor(s, [p.x, p.z]);
  };
  const walkTo = (to: XZ, face: XZ | null, then?: () => void) => {
    grid ??= buildGrid(-W2, W2, -D2, D2, 0.2, isFree);
    const p = me.person.root.position;
    const path = findPath(grid, [p.x, p.z], to);
    if (!path) return false;
    faceTo = null;
    spotWalk = null;
    // already there (the start and the goal in one cell): no walk, straight on (an empty path used to throw here)
    if (!path.length) { faceTo = face; then?.(); return true; }
    // the last point exactly (a seat's stand point sits at the edge of the free floor)
    if (then && Math.hypot(path[path.length - 1][0] - to[0], path[path.length - 1][1] - to[1]) < 0.8) path[path.length - 1] = to;
    walker.go(path, { onArrive: () => { marker.fade(); faceTo = face; arrivedAt = spotWalk; spotWalk = null; then?.(); } });
    const g = path[path.length - 1];
    marker.show(g[0], g[1], 0.02);
    orbitHold = 0;
    return true;
  };
  /** Which spot he is in, and the nearest point of its front. */
  const zoneAt = (x: number, z: number) => room.zoneAt(x, z);
  /** The camera's shot of a spot with its card open. */
  const shotOf = (s: HomeSpot) => room.shotOf(s);

  // ── Walking from room to room: a short fade, the old room freed, the next one built ──
  let swapping = false;
  const fade = document.createElement("div");
  Object.assign(fade.style, { position: "absolute", inset: "0", background: "#120e0b", opacity: "0", transition: "opacity 0.2s ease", pointerEvents: "none" });
  container.appendChild(fade);
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const preloaded = new Set<RoomId>();
  /** Fetch a room's models before he gets there (walking to its door). */
  const preloadRoom = (id: RoomId) => {
    if (preloaded.has(id)) return;
    preloaded.add(id);
    for (const f of roomFiles(id, data.tier, data.cars, data.boots, data.bikeModel ?? null, data.stuff)) glb(f).catch(() => { /* the room shows without it */ });
  };
  let lastSwapMs = 0;
  async function goToRoom(to: RoomId, from: RoomId | null): Promise<boolean> {
    if (swapping || disposed || !rooms.includes(to) || to === room.id) return false;
    swapping = true;
    stopWalk();
    stick = { x: 0, y: 0 };
    speed = 0;
    if (near) { near = null; cb.onNear(null); }
    fade.style.opacity = "1";
    await wait(200);
    if (disposed) return false;
    const t0 = performance.now();
    room.dispose();
    room = buildRoom(env, roomIn, to);
    scene.add(room.group);
    collectDayMats(room.group);
    fitSun();
    grid = null;
    framed = null; frame = 0; dwellZone = null; dwell = { timer: 0, open: false }; arrivedAt = null; spotWalk = null;
    quietArrival = !!opts.living;
    const door = arrivalDoor(room.plan, from);
    // far enough in that the camera has room behind him: camera D's whole boom where the floor is
    // clear (the doorway jam: 1.5 m in left it 1.2 m, right on the back of his head), else 1.5 m
    let at = door ? arrivalAt(door, 1.5) : room.start;
    if (door && camKey === "D") at = settledArrival(door, (x, z) => roomFree(room, x, z) && Math.abs(x) < room.w2 - 0.6 && Math.abs(z) < room.d2 - 0.6, CS.back) ?? at;
    // a living house: further in (the arrival shot from the doorway then has him small, the room around him)
    if (door && opts.living) for (const dIn of [2.6, 2.3, 2.0]) { const a = arrivalAt(door, dIn); if (roomFree(room, a.x, a.z) && Math.abs(a.x) < room.w2 - 0.5 && Math.abs(a.z) < room.d2 - 0.5) { at = a; break; } }
    me.person.root.position.set(at.x, 0, at.z);
    yaw = at.yaw; yawTurn.vel = 0; me.person.root.rotation.y = yaw;
    camYaw = openCamYaw(at.x, at.z, yaw + Math.PI, CS.back, room.w2 - ROOM_CAM.wallGap, room.d2 - ROOM_CAM.wallGap, CS.swing); orb.reset(); first = true;
    // (a living house's garage: from its door, the row of cars and him in view; its own low shot sat on a bonnet)
    intro = (opts.living && room.id === "garage" ? null : room.intro) ?? (opts.living && door ? arrivalShot(door, room.h, room.w2, room.d2, at, (x, z) => roomFree(room, x, z)) : null);
    meBlob.position.set(at.x, 0.012, at.z);
    try { await (hEnh ? hEnh.compile(scene, camera) : safeCompileAsync(renderer, scene, camera)); } catch { /* first use */ }
    shadowDirty = true;
    lastSwapMs = performance.now() - t0;
    void room.loadProps().then(() => { shadowDirty = true; });
    life?.enterRoom(room);
    cb.onRoom?.(room.id, room.plan.label);
    fade.style.opacity = "0";
    swapping = false;
    return true;
  }

  // ── Changing clothes ──
  let wearQueue: Promise<void> = Promise.resolve();
  const disposePerson = (p: Person3D, wasCasual: boolean) => {
    p.root.parent?.remove(p.root);
    p.mixer.stopAllAction();
    p.root.traverse((o: any) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) m.dispose?.();
      // cloth geometry (and the cut body under it) is shared by everyone of that head and outfit: never freed here
      if (wasCasual && o.isSkinnedMesh && o.name !== "Outline" && o.name !== "Cloth" && o.name !== "ClothInk" && !o.userData?.cloth) o.geometry?.dispose?.();
      // his watch, chain and the rest are his own (style3d/toon/accessories.ts)
      else if (o.name === "Accessories") o.geometry?.dispose?.();
    });
  };
  const wear = (worn: Worn): Promise<void> => {
    wearQueue = wearQueue.then(async () => {
      if (disposed) return;
      const cur = me.worn;
      // same body, new colours: a repaint (a kit for a kit)
      if (cur.kind === "kit" && worn.kind === "kit" && repaintKit(THREE, me.person, wearIn(worn))) { me.worn = worn; return; }
      if (cur.kind === "casual" && worn.kind === "casual" && cur.set.id === worn.set.id && JSON.stringify(cur.extras ?? []) === JSON.stringify(worn.extras ?? [])) return;
      changing = true;
      try {
        const next = await dressUp(worn);
        if (disposed) { disposePerson(next.person, worn.kind === "casual"); return; }
        life?.rebody();
        const old = me;
        next.person.root.position.copy(old.person.root.position);
        next.person.root.rotation.y = yaw;
        scene.add(next.person.root);
        me = next;
        findHead();
        disposePerson(old.person, old.worn.kind === "casual");
        try { await (hEnh ? hEnh.compile(scene, camera) : safeCompileAsync(renderer, scene, camera)); } catch { /* first use */ }
        shadowDirty = true;
      } finally { changing = false; }
    });
    return wearQueue;
  };

  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const want = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let first = true;
  let acc = 0, busy = true, busyT = 0, stillT = 0;
  const stepDown = (): boolean => {
    const next = stepDownTier(tier);
    if (!next) return false;
    tier = next; prof = TIER_PROFILES[tier];
    dyn = makeDyn(); dynPR = Math.min(dpr, prof.movePixelRatio);
    pr = stillPR(); renderer.setPixelRatio(pr);
    if (!prof.shadows) { sun.castShadow = false; renderer.shadowMap.enabled = false; }
    env.quality = tier; env.prof = prof;
    if (!MIRROR_PX[tier]) room.dropMirror();
    if (!prof.outlines) me.person.outline.visible = false;
    resize();
    return true;
  };
  void room.loadProps().then(() => { shadowDirty = true; });
  cb.onRoom?.(room.id, room.plan.label);
  // ── a living house: things to use, team-mates round (lib/star/world3d/houseLife.ts) ──
  let life: HouseLife | null = null;
  if (opts.living && isLiving(rooms)) {
    const { startLife } = await import("../world3d/houseLife");
    life = await startLife({
      THREE, SK: SkeletonUtils, loader, scene, tier: data.tier, rooms, quality: tier, kit: data.kits.home, club: opts.living.club,
      mates: opts.living.mates, outline: prof.outlines ? 0.006 : 0,
      me: () => me.person,
      walkTo: (to, face, then) => walkTo(to, face, then),
      stopWalk: () => stopWalk(),
      you: () => ({ x: me.person.root.position.x, z: me.person.root.position.z, yaw }),
      setYaw: (y) => { yaw = y; yawTurn.vel = 0; me.person.root.rotation.y = y; },
      onCard: (c) => cb.onCard?.(c),
      chat: opts.living.chat, onEffect: opts.living.onEffect, clockNow: opts.living.clock, tickClock: opts.living.tick,
      // visitors on the day plan; how many your room may draw: Android (the mid phone) and Low 2, Medium 3, High 5
      visits: opts.living.visits, roomCap: roomPeople(tier, typeof navigator !== "undefined" && /Android|Mobi/i.test(navigator.userAgent) && !/iPhone|iPad/i.test(navigator.userAgent)),
      onSleep: () => { sleepSeq = { t: 0, text: "", morning: false }; },
      onGym: opts.living.onGym,
      dip: (text, mid) => { dipSeq = { t: 0, text, mid }; },
    }).catch((e) => { console.error("home: living", e); return null; });
    life?.enterRoom(room);
    // the career clock: walked in at night (20:00 to 06:00), the night's light
    const m0 = opts.living.clock ? ((opts.living.clock() % 1440) + 1440) % 1440 : 15 * 60;
    if (m0 >= 20 * 60 || m0 < 6 * 60) { lightFrom = LIGHTS.night; lightTo = LIGHTS.night; lightK = 1; applyDayLight(); }
  }

  // ── Sleeping (lib/star/home3d/sleep.ts): the light goes to night, the screen to black, the clock to
  // 07:00 next day (the career's night counted here), the morning light, the screen back, he gets up.
  // Stepped on game time in the loop (the same on a phone and frame by frame when filming).
  let sleepSeq: { t: number; text: string; morning: boolean } | null = null;
  let sunOnBed: any = null;
  /** A short dip to dark with a caption (the bath's soak): 0.6 s down, `mid`, held, 0.6 s up. */
  let dipSeq: { t: number; text: string; mid: () => void } | null = null;
  const stepDip = (dt: number) => {
    const q = dipSeq!, was = q.t;
    if (was === 0) { fade.style.transition = "none"; caption.innerHTML = q.text; }
    q.t += dt;
    const t = q.t;
    if (t < 0.6) fade.style.opacity = String(t / 0.6);
    else if (was < 0.6) { fade.style.opacity = "1"; caption.style.opacity = "1"; q.mid(); }
    else if (t >= 1.8 && t < 2.4) { caption.style.opacity = "0"; fade.style.opacity = String(1 - (t - 1.8) / 0.6); }
    else if (t >= 2.4) { fade.style.opacity = "0"; fade.style.transition = "opacity 0.2s ease"; caption.innerHTML = NEXT_MORNING; dipSeq = null; }
  };
  const caption = document.createElement("div");
  Object.assign(caption.style, { position: "absolute", left: "0", right: "0", top: "44%", textAlign: "center", color: "#f7f1e8", font: "600 22px system-ui, sans-serif", letterSpacing: "0.02em", opacity: "0", transition: "opacity 0.4s ease" });
  const NEXT_MORNING = 'Next morning<div style="font:500 15px system-ui,sans-serif;opacity:.7;margin-top:6px">07:00</div>';
  caption.innerHTML = NEXT_MORNING;
  fade.appendChild(caption);
  // the night, in game seconds from sitting on the bed: the light falls; black; he is in bed in the dark
  // room; black; "Next morning" (the career's night counted here); up in the morning light, still in
  // bed; a blink; standing at the foot of the bed with the card
  const SLEEP = { dusk: 1.2, toBlack1: 1.8, nightUp: 2.6, night: 4.4, toBlack2: 5.2, morningUp: 6.6, morning: 7.4, blink: 8.8, end: 9.2 };
  const stepSleep = (dt: number) => {
    const q = sleepSeq!, S = SLEEP;
    if (q.t === 0) { lightTowards(LIGHTS.night); fade.style.transition = "none"; }
    const was = q.t;
    q.t += dt;
    const t = q.t, crossed = (k: number) => was < k && t >= k;
    const ramp = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    if (t < S.dusk) { lightK = t / S.dusk; applyDayLight(); }
    else if (lightK < 1 && !q.morning) { lightK = 1; applyDayLight(); }
    if (t < S.toBlack1) fade.style.opacity = String(ramp(S.dusk, S.toBlack1) * (t >= S.dusk ? 1 : 0));
    if (crossed(S.toBlack1)) life?.lie(true);
    if (t >= S.toBlack1 && t < S.nightUp) fade.style.opacity = String(1 - 0.94 * ramp(S.toBlack1, S.nightUp));
    if (t >= S.night && t < S.toBlack2) fade.style.opacity = String(0.06 + 0.94 * ramp(S.night, S.toBlack2));
    if (crossed(S.toBlack2)) {
      q.morning = true;
      fade.style.opacity = "1";
      caption.style.opacity = "1";
      lightFrom = LIGHTS.morning; lightTo = LIGHTS.morning; lightK = 1; applyDayLight();
      q.text = opts.living?.onSleep?.() ?? "A good night.";
      life?.newDay();
      // the morning sun through the window, falling across the bed (one glow, gone when he gets up)
      const b = life?.bedNow();
      if (b) {
        const cv = document.createElement("canvas"); cv.width = cv.height = 64;
        const g = cv.getContext("2d")!, gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
        gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.6, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
        const t = new THREE.CanvasTexture(cv);
        sunOnBed = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.5), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color("#ffb060").multiplyScalar(0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        sunOnBed.rotation.set(-Math.PI / 2, 0, b.head, "YXZ");
        sunOnBed.position.set(b.at[0] - Math.sin(b.head) * 0.15, b.top + 0.32, b.at[1] - Math.cos(b.head) * 0.15);
        sunOnBed.renderOrder = 3;
        scene.add(sunOnBed);
      }
    }
    if (t >= S.morningUp - 0.4 && t < S.morningUp) caption.style.opacity = "0";
    if (t >= S.morningUp && t < S.morning) fade.style.opacity = String(1 - ramp(S.morningUp, S.morning));
    if (t >= S.blink && t < S.end) fade.style.opacity = String(Math.sin(Math.PI * ramp(S.blink, S.end)));
    if (crossed((S.blink + S.end) / 2)) {
      life?.wake(q.text);
      if (sunOnBed) { scene.remove(sunOnBed); sunOnBed.geometry.dispose(); sunOnBed.material.map.dispose(); sunOnBed.material.dispose(); sunOnBed = null; }
    }
    if (t >= S.end) { fade.style.opacity = "0"; fade.style.transition = "opacity 0.2s ease"; sleepSeq = null; }
  };

  const scratchCf = new THREE.Vector3(), scratchCr = new THREE.Vector3(), scratchShot = new THREE.Vector3(); // the loop makes no garbage
  // the shared renderer's loop is set and stopped only by its owner: a build thrown away while a
  // newer one is starting (React's double effects in dev, a quick switch) never stops the live one
  // ── First person (the 3D phone, opts.pov): his eyes, eased out to the normal camera (setPov) ──
  let pov: number | null = opts.pov ? 1 : null;
  if (opts.pov) {
    // a step into the room from where he starts, so the camera he pulls back to has its full boom and frames him
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    for (const d of [1.4, 1.0, 0.6]) {
      const x = START.x + fx * d, z = START.z + fz * d;
      if (roomFree(room, x, z)) { me.person.root.position.set(x, 0, z); meBlob.position.set(x, 0.012, z); break; }
    }
  }
  let held = false;
  /** easePov's move, stepped in tick (null: none). */
  let povEase: { from: number; to: number | null; t: number; t0: number; ms: number; done?: () => void } | null = null;
  let headBone: any = null;
  const findHead = () => { headBone = null; me.person.root.traverse((o: any) => { if (!headBone && o.isBone && /head$/i.test(o.name)) headBone = o; }); };
  findHead();
  const povHead = new THREE.Vector3(), povEye = new THREE.Vector3(), povLook = new THREE.Vector3(), povF = new THREE.Vector3();
  /** His materials as they were, while he is faded (null: as built). */
  type Faded = { m: any; transparent: boolean; opacity: number; depthWrite: boolean };
  let faded: Faded[] | null = null;
  const blobOpacity = 0.75;
  const setMeAlpha = (a: number) => {
    if (a >= 1) {
      if (faded) { for (const f of faded) { f.m.transparent = f.transparent; f.m.opacity = f.opacity; f.m.depthWrite = f.depthWrite; f.m.needsUpdate = true; } faded = null; }
      meBlob.material.opacity = blobOpacity;
      return;
    }
    if (!faded) {
      // drawn (at nothing) from the start, so his see-through shaders are built while he is hidden, not mid-move
      const list: Faded[] = [];
      faded = list;
      const had = new Set<unknown>();
      me.person.root.traverse((o: any) => {
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          if (had.has(m)) continue;
          had.add(m);
          list.push({ m, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite });
          m.transparent = true; m.needsUpdate = true;
        }
      });
    }
    for (const f of faded) { f.m.opacity = f.opacity * a; f.m.depthWrite = a > 0.98; }
    meBlob.material.opacity = blobOpacity * a;
  };
  /** The camera at his eyes, k of the way back from the normal camera (camPos/camLook, already placed). */
  const applyPov = (P: any) => {
    const k = Math.max(0, Math.min(1, pov ?? 0));
    if (headBone) headBone.getWorldPosition(povHead); else povHead.set(P.x, 1.62, P.z);
    // he looks the way the normal camera looks, so the pull-back is one straight line
    povF.set(camLook.x - camPos.x, 0, camLook.z - camPos.z);
    if (povF.lengthSq() < 1e-6) povF.set(Math.sin(yaw), 0, Math.cos(yaw));
    povF.normalize();
    povEye.copy(povHead).addScaledVector(povF, 0.12); povEye.y += 0.05;
    povLook.copy(povEye).addScaledVector(povF, 3); povLook.y -= 0.5;
    const eyeY = povEye.y, s = 1 - k;
    povEye.lerp(camPos, s); povLook.lerp(camLook, s);
    // up and over his head, not through it: the camera rises faster than it moves back (plus a small arc)
    povEye.y = Math.min(H - 0.15, Math.max(povEye.y, eyeY + (camPos.y - eyeY) * Math.sqrt(s) + 0.35 * Math.sin(Math.PI * s)));
    camera.position.copy(povEye); camera.lookAt(povLook);
    // he shows once the camera is clear of his head, fading in over the next 0.6 m
    const a = Math.max(0, Math.min(1, (camera.position.distanceTo(povHead) - 0.75) / 0.6));
    setMeAlpha(a);
    // fully faded: not drawn at all (the toon body's shader ignores opacity, so with the camera inside his head
    // his skin showed as shards across the room: the 3D phone in the game, 21 Nov 2026)
    me.person.root.visible = a > 0.001;
  };

  const tick = (force = false) => {
    if (disposed) return;
    let dt: number;
    if (opts.fixedStep) dt = opts.fixedStep;
    else {
      acc += Math.min(0.25, clock.getDelta());
      const cap = busy && !capAlways ? prof.fpsCap : prof.stillFps;
      govCap = cap;
      if (!force && cap < 60 && acc < 1 / (cap + 1)) return;
      dt = Math.min(0.05, acc);
      gov.frame(performance.now(), govCap);
      acc = 0;
    }
    gameT += dt;
    const P = me.person.root.position;

    // a living house: while you use something, the world kit moves you (houseLife.ts)
    life?.update(dt);
    if (sleepSeq) stepSleep(dt);
    if (dipSeq) stepDip(dt);
    const lifeHas = !!life?.controlsYou();
    // input: the stick, else the keys, else a tap-walk
    let ix = lifeHas ? 0 : stick.x, iy = lifeHas ? 0 : stick.y;
    if (keys.size && !lifeHas) {
      ix = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      iy = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const m = Math.hypot(ix, iy) || 1;
      const run = keys.has("shift") ? 1 : 0.4;
      ix = (ix / m) * run; iy = (iy / m) * run;
    }
    let mag = Math.min(1, Math.hypot(ix, iy));
    let wantYaw: number | null = null;
    if (mag >= 0.08) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      wantYaw = Math.atan2(fx * iy + rx * ix, fz * iy + rz * ix);
    } else if (walker.active) {
      const st = walker.step(P.x, P.z, dt);
      if (st) { wantYaw = st.yaw; mag = st.push * Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(angDiff(yaw, st.yaw))))); }
      else if (!walker.active && marker.visible) marker.fade();
    }
    // indoors: walk and jog only (a small room has no sprint)
    speed = approach(speed, Math.min(STROLL_SPEEDS.jog, stickTarget(mag, keys.has("shift"), STROLL_SPEEDS)), dt, STROLL_SPEEDS);
    if (changing) speed = 0;
    if (wantYaw !== null && !changing) yaw = turnTo(yawTurn, yaw, wantYaw, dt);
    else if (faceTo && speed < 0.4) {
      const d = angDiff(yaw, Math.atan2(faceTo[0] - P.x, faceTo[1] - P.z));
      yaw += d * Math.min(1, dt * 5);
      if (Math.abs(d) < 0.03) faceTo = null;
    }
    marker.update(dt);
    let moved = false;
    if (lifeHas) { speed = 0; moved = true; meBlob.position.set(P.x, 0.012, P.z); }
    else {
      const [nx, nz] = collide(P.x + Math.sin(yaw) * speed * dt, P.z + Math.cos(yaw) * speed * dt);
      moved = Math.abs(nx - P.x) + Math.abs(nz - P.z) > 1e-4;
      P.x = nx; P.z = nz;
      me.person.root.rotation.y = yaw;
      meBlob.position.set(nx, 0.012, nz);
      if (me.gait) me.gait.update(speed, dt, 1);
      else {
        const wWalk = Math.min(1, speed / 1.5), wIdle = Math.max(0, 1 - speed / 1.5);
        me.idle.setEffectiveWeight(wIdle); me.walk.setEffectiveWeight(wWalk); me.jog.setEffectiveWeight(0);
        me.walk.timeScale = Math.max(0.6, speed / 1.45);
      }
      me.person.mixer.update(dt);
    }

    // which spot is he at? (the card opens only when he stops at it or turns to it: shop3d/dwell.ts)
    if (quietArrival && (speed > 0.3 || walker.active)) quietArrival = false;
    const zn = quietArrival ? null : zoneAt(P.x, P.z);
    const zone = zn?.spot ?? null;
    if (zone !== dwellZone) { dwellZone = zone; dwell = { timer: 0, open: false }; }
    {
      const [fx, fz] = zn?.front ?? [0, 0];
      const dist = Math.hypot(fx - P.x, fz - P.z);
      const faceOff = angDiff(yaw, Math.atan2(fx - P.x, fz - P.z));
      dwell = stepDwell(dwell.timer, dwell.open, { inZone: !!zone, dist, speed, faceOff, arrived: !!zone && arrivedAt === zone }, dt);
      if (arrivedAt && arrivedAt === zone) arrivedAt = null;
    }
    const now: HomeSpot | null = dwell.open && !lifeHas ? zone : null;
    if (now !== near) { near = now; cb.onNear(near); }

    // camera: behind him; a card open frames its spot
    if (zoom) {
      zoom.step(dt);
      CS = zoomedFollowCam(zoom.now, FOLLOW_CAM_D, zoomCam);
      if (!edit?.views && container.clientWidth / (container.clientHeight || 1) < 0.7 && Math.abs(camera.fov - CS.fov) > 1e-3) { camera.fov = baseFov = CS.fov; camera.updateProjectionMatrix(); }
    }
    camYaw += orb.step(dt);
    if (orbitHold > 0) orbitHold -= dt;
    else if (speed > 0.3) {
      // camera D backed onto a wall (walking back towards the door he came in by): it may swing
      // further round him, like the old camera, to where there is room, instead of closing in on his head
      const blocked = camKey === "D" && boxRoom(P.x, P.z, Math.sin(camYaw), Math.cos(camYaw), -W2 + ROOM_CAM.wallGap, W2 - ROOM_CAM.wallGap, -D2 + ROOM_CAM.wallGap, D2 - ROOM_CAM.wallGap) < CS.back * 0.6;
      // walking straight at the camera (turned round), D holds its side and backs off, so the camera
      // never swings over his head; it swings round only once a wall stops it backing off
      const toCam = camKey === "D" && !blocked ? Math.max(0, Math.min(1, (Math.cos(angDiff(yaw, camYaw)) - 0.3) / 0.5)) : 0;
      camYaw += angDiff(camYaw, view.inEyes ? yaw + Math.PI : openCamYaw(P.x, P.z, yaw + Math.PI, CS.back, W2 - ROOM_CAM.wallGap, D2 - ROOM_CAM.wallGap, blocked ? 6 : CS.swing)) * Math.min(1, dt * CS.yawK * (blocked ? 1.6 : 1)) * (1 - toCam);
    }
    const shot0 = framed ? shotOf(framed) : null;
    // the editor's card-shot edit (none = as written; the room's own shot is never changed in place)
    const shot = shot0 && framed && edit?.views?.[framed] ? { cam: editCamera(shot0.cam, shot0.look, edit.views[framed]), look: shot0.look } : shot0;
    frame += ((shot && orbitHold <= 0 ? 1 : 0) - frame) * Math.min(1, dt * 2.6);
    // Harry, 9 Oct 2026: the camera sat jammed behind his head in every room. Now it stands
    // back and up, like a room view in a third-person game, looking down past him into the
    // room; where a wall is closer than that, the boom shortens and the camera rises instead
    // (it never goes through a wall), so the room still reads.
    const back = Math.min(CS.back, Math.max(W2, D2) * 2 * 0.55);
    const cf = scratchCf.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const crr = scratchCr.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const ceil = H - ROOM_CAM.ceilingGap;
    const [camUp0, camBack0] = orb.lift(Math.min(ceil, CS.height), back, CS.lookY);
    const wx = W2 - ROOM_CAM.wallGap, wz = D2 - ROOM_CAM.wallGap;
    // the room free behind him along the camera's line: the boom eases in off a wall and back out,
    // never past it (just through a doorway it used to lag into the wall and slide onto his head)
    const freeAt = (dx: number, dz: number) => boxRoom(P.x, P.z, dx, dz, -wx, wx, -wz, wz);
    if (first) boom.reset();
    const room2 = camKey === "D" ? boom.step(camBack0, freeAt(-cf.x, -cf.z), dt) : Math.max(CS.minBoom, roomCamBoom(P.x, P.z, -cf.x, -cf.z, camBack0, wx, wz));
    const short = camBack0 - room2;
    const camUp = camKey === "D" ? riseForMin(room2, Math.min(ceil, camUp0 + short * CS.riseIfShort), ceil) : Math.min(ceil, camUp0 + short * CS.riseIfShort);
    want.set(P.x, camUp, P.z).addScaledVector(cf, -room2).addScaledVector(crr, CS.side);
    if (camKey === "D") {
      // close in (a wall behind him), D looks down at him rather than past him, so he stays in the picture
      const closeK = Math.max(0, Math.min(1, (1.6 - lastFlat) / 1.2));
      wantLook.set(P.x, CS.lookY + (1.2 - CS.lookY) * closeK, P.z).addScaledVector(cf, (CS.lookAhead + short * 0.3) * (1 - closeK)).addScaledVector(crr, CS.lookSide);
    } else wantLook.set(P.x, CS.lookY, P.z).addScaledVector(cf, CS.lookAhead + short * 0.5).addScaledVector(crr, CS.lookSide);
    // the editor's walking-camera edit (none = as written); inRoom below still keeps it inside the walls
    if (edit?.views) {
      if (edit.views.follow) want.set(...editCamera([want.x, want.y, want.z], [wantLook.x, wantLook.y, wantLook.z], edit.views.follow));
      const fov = editFov(baseFov, edit, shot ? framed : null, frame);
      if (Math.abs(fov - camera.fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    }
    if (intro && (speed > 0.3 || walker.active || orbitHold > 0 || shot || view.first)) intro = null; // he moved: the follow camera takes over
    if (intro) { want.set(...intro.cam); wantLook.set(...intro.look); }
    // a living house: using something frames it (houseLife.ts useShot); talking frames you both
    const useShot = life?.useShot() ?? null;
    if (useShot && !intro) { want.set(...useShot.cam); wantLook.set(...useShot.look); }
    const mate = !useShot && !intro ? life?.talkTo() ?? null : null;
    if (mate) {
      // from beside you, back a little: you on one side, him on the other
      const mx = (P.x + mate[0]) / 2, mz = (P.z + mate[1]) / 2, dx = mate[0] - P.x, dz = mate[1] - P.z, dl = Math.hypot(dx, dz) || 1;
      want.set(mx - (dz / dl) * 2.4 - (dx / dl) * 0.6, Math.min(H - 0.2, 1.75), mz + (dx / dl) * 2.4 - (dz / dl) * 0.6);
      wantLook.set(mx, 1.1, mz);
      // on the other side if that one is outside the room
      if (Math.abs(want.x) > W2 - 0.3 || Math.abs(want.z) > D2 - 0.3) want.set(mx + (dz / dl) * 2.4 - (dx / dl) * 0.6, Math.min(H - 0.2, 1.75), mz - (dx / dl) * 2.4 - (dz / dl) * 0.6);
    }
    // a living house's arrival shot: a wider lens, from the doorway (outside the room's walls)
    const introFov = (intro as { fov?: number } | null)?.fov;
    if (introFov && Math.abs(camera.fov - introFov) > 1e-3) { camera.fov = introFov; camera.updateProjectionMatrix(); }
    else if (!introFov && !edit?.views && !dbgCam && camera.fov !== baseFov && Math.abs(camera.fov - (zoom ? CS.fov : baseFov)) > 1e-3 && lastIntroFov) { camera.fov = zoom && container.clientWidth / (container.clientHeight || 1) < 0.7 ? CS.fov : baseFov; camera.updateProjectionMatrix(); }
    lastIntroFov = !!introFov;
    if (shot) { want.lerp(scratchShot.set(...shot.cam), frame); wantLook.lerp(scratchShot.set(...shot.look), frame); }
    const inRoom = (v: any) => { v.x = Math.max(-W2 + 0.25, Math.min(W2 - 0.25, v.x)); v.z = Math.max(-D2 + 0.25, Math.min(D2 - 0.25, v.z)); v.y = Math.max(CAM_MIN_Y, Math.min(H - 0.15, v.y)); };
    if (!(intro as { outside?: boolean } | null)?.outside) inRoom(want);
    carry.step(P.x, P.z, camPos, camLook, camKey === "D" && !first && !intro && frame < 0.5 && !dbgCam);
    if (first) { camPos.copy(want); camLook.copy(wantLook); first = false; }
    else { camPos.lerp(want, Math.min(1, dt * CS.posK)); camLook.lerp(wantLook, Math.min(1, dt * CS.lookK)); }
    let meA = 1;
    if (camKey === "D" && frame < 0.5 && !intro && !useShot && !mate) {
      // the eased camera too: shortened along its own line off a wall (never slid round onto his head),
      // risen over him if that brings it near, and if a ceiling stops the rise he fades a little
      const flat = capOnLine(camPos, P.x, P.z, freeAt);
      lastFlat = flat;
      camPos.y = riseForMin(flat, camPos.y, H - 0.15);
      meA = followFade(Math.hypot(flat, camPos.y - FOLLOW_HEAD_Y));
    }
    if (!(intro as { outside?: boolean } | null)?.outside) inRoom(camPos);
    // first person: his eyes; a card, a seat, a talk or the night step back out to third person for it
    view.step(dt, frame > 0.02 || !!useShot || !!mate || !!sleepSeq || !!dipSeq || changing);
    let seen = true;
    if (dbgCam) { camera.position.set(...dbgCam.pos); camera.lookAt(...dbgCam.look); }
    else seen = view.place(camera, camPos, camLook, headWorld(headBone, me.person.root, viewHead), -Math.sin(camYaw), -Math.cos(camYaw), H - 0.15, dt);
    if (povEase) {
      const e = povEase;
      // on the wall clock (a slow frame never makes the move longer); the film clock when filming
      e.t = opts.fixedStep ? e.t + dt * 1000 : performance.now() - e.t0;
      const p = Math.min(1, e.t / e.ms), q = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      pov = e.from + ((e.to ?? 0) - e.from) * q;
      if (p >= 1) { povEase = null; pov = e.to; if (e.to === null) { setMeAlpha(1); me.person.root.visible = true; } if (e.done) setTimeout(e.done, 0); }
    }
    if (pov !== null && !dbgCam && !view.first) applyPov(P);
    else {
      if (camKey === "D") setMeAlpha(meA);
      showBody(me.person.root, seen); // in his eyes: not drawn at all (one fewer draw)
    }
    // a card open: the picture slides up so the spot sits above the card
    const vw = container.clientWidth || 1, vh = container.clientHeight || 1;
    const offY = dbgCam ? 0 : Math.round(frame * (framed === "wardrobe" ? 0.24 : 0.17) * vh);
    if (offY !== lastOff) { lastOff = offY; if (offY > 0) camera.setViewOffset(vw, vh, 0, offY, vw, vh); else camera.clearViewOffset(); }

    // the mirror: live only near it, or with the wardrobe open
    if (room.mirror) room.mirror.visible = framed === "wardrobe" || room.mirrorNear(P.x, P.z) || !!dbgCam;
    // fetch the next room's models while he walks to its door
    if (!swapping) for (const d of room.doors) if (d.to !== "garden" && !preloaded.has(d.to) && Math.hypot(P.x - d.x, P.z - d.z) < 2.6) preloadRoom(d.to);
    // the sun's shadow: drawn again only while something moves under it
    if (sun.castShadow) {
      shadowT -= dt;
      if (shadowDirty || ((moved || speed > 0.05) && shadowT <= 0)) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowT = 0.1; }
    }
    // counted over the whole frame (look H's passes, the mirror), for stats(); the flag set again each frame, as a
    // shared renderer's earlier home (dev's double mount) turns it back on when it is disposed
    renderer.info.autoReset = false;
    renderer.info.reset();
    if (hEnh) hEnh.render(scene, camera); else renderer.render(scene, camera);

    busy = view.moving || !!povEase || !!sleepSeq || !!dipSeq || !!zoom?.moving || speed > 0.05 || mag > 0.05 || walker.active || orbitHold > 0 || orb.moving || !!faceTo || changing || Math.abs(frame - (shot && orbitHold <= 0 ? 1 : 0)) > 0.01 || camPos.distanceToSquared(want) > 1e-4;
    if (busy) { busyT += dt; stillT = 0; } else { stillT += dt; busyT = 0; }
    if (!opts.fixedStep) {
      if (busy && !capAlways) dyn.frame(performance.now()); else dyn.pause();
      const wantPR = busyT > 0.25 ? movePR() : stillT > 0.5 ? stillPR() : pr;
      if (wantPR !== pr) { pr = wantPR; renderer.setPixelRatio(pr); lastOff = -1; }
    }
    frames++;
    const nowMs = performance.now();
    if (nowMs - fpsT0 >= 1000) { cb.onFps?.(Math.round((frames * 1000) / (nowMs - fpsT0))); frames = 0; fpsT0 = nowMs; }
  };
  renderer.info.autoReset = false;
  const loop = () => tick(false);
  if (isOwner()) renderer.setAnimationLoop(loop);

  const ray = new THREE.Raycaster();
  const ndc = (px: number, py: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
  };
  // the editor's key light (the sun through the drive window) and exposure; none = as written
  const lightEdit = makeLightEditor({ key: sun, renderer, lookH: !!hEnh, scene, keyBase: () => ({ x: W2 + 5, y: 5.5, z: -1.5 }) });
  reLight = () => { if (edit) { lightEdit(edit); shadowDirty = true; } };
  reLight();
  const ctrl: HomeController = {
    setEdit: (e) => {
      edit = e;
      lightEdit(e);
      shadowDirty = true;
      if (!e?.views) { camera.fov = baseFov; camera.updateProjectionMatrix(); }
    },
    showView: (id) => {
      stopWalk();
      if (id === "follow") {
        ctrl.setCardOpen(null);
        const door = arrivalDoor(room.plan, null);
        const a = door ? arrivalAt(door, 1.5) : room.start;
        ctrl.place(a.x, a.z, a.yaw);
        return true;
      }
      const spot = id as HomeSpot;
      if (!room.plan.spots.includes(spot)) return false;
      const t = standFor(spot);
      ctrl.place(t.at[0], t.at[1], Math.atan2(t.face[0] - t.at[0], t.face[1] - t.at[1]));
      ctrl.setCardOpen(spot);
      return true;
    },
    cameraPose: () => ({ pos: [camera.position.x, camera.position.y, camera.position.z], look: [camLook.x, camLook.y, camLook.z], fov: camera.fov }),
    layout: () => {
      const d = sun.position.clone().sub(sun.target.position).normalize();
      const p = me.person.root.position;
      return { people: [{ id: "you", x: p.x, z: p.z }], sunDir: [d.x, d.y, d.z], bounds: { min: [-W2, 0, -D2], max: [W2, H, D2] } };
    },
    setStick: (x, y) => { stick = { x, y }; if (Math.hypot(x, y) > 0.05) stopWalk(); },
    orbit: (dx, dy = 0) => { orb.drag(dx, view.first ? 0 : dy); view.drag(dy); orbitHold = 1.5; },
    setView: (m) => { view.set(m); if (held && isOwner()) tick(true); },
    viewMode: () => view.mode,
    pick: (px, py) => {
      ray.setFromCamera(ndc(px, py), camera);
      const hit = ray.intersectObjects(room.pickables, false)[0];
      return (hit?.object?.userData?.spot as HomeSpot | undefined) ?? null;
    },
    tap: (px, py) => {
      if (sleepSeq) return null; // asleep: the screen is the night
      const s = ctrl.pick(px, py);
      if (s) { ctrl.walkToSpot(s); return { spot: s }; }
      ray.setFromCamera(ndc(px, py), camera);
      if (life?.tap(ray.ray.origin, ray.ray.direction)) return { spot: null };
      if (life?.controlsYou()) { life.act("leave"); return { spot: null }; }
      const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      if (!hit || Math.abs(hit.x) > W2 || Math.abs(hit.z) > D2) return null;
      return walkTo([hit.x, hit.z], null) ? { spot: null } : null;
    },
    walkToSpot: (s) => { const t = standFor(s); const ok = walkTo(t.at, t.face); if (ok) spotWalk = s; return ok; },
    setCardOpen: (s) => {
      framed = s;
      if (s) orbitHold = 0;
      // the wardrobe: step across to the mirror and face it
      if (s === "wardrobe") {
        const p = me.person.root.position;
        const ms = room.mirrorSpot, mf = room.mirrorFace;
        if (ms && mf) {
          if (Math.hypot(p.x - ms[0], p.z - ms[1]) > 0.35) walkTo(ms, mf);
          else faceTo = mf;
        }
      }
    },
    wear,
    place: (x, z, y = yaw) => { stopWalk(); me.person.root.position.set(x, 0, z); yaw = y; camYaw = y + Math.PI; orb.reset(); first = true; shadowDirty = true; },
    where: () => ({ x: me.person.root.position.x, z: me.person.root.position.z, yaw, t: gameT, changing }),
    debugCamera: (pos, look = [0, 1, 0], fov) => {
      dbgCam = pos ? { pos, look } : null; lastOff = -1;
      const f = pos && fov ? fov : baseFov;
      if (Math.abs(camera.fov - f) > 1e-3) { camera.fov = f; camera.updateProjectionMatrix(); }
    },
    plan: () => ({ tier: data.tier, room: room.id, rooms, w: W2 * 2, d: D2 * 2, h: H, mirror: room.mirrorSpot, doors: room.doors, spots: room.plan.spots, slots: data.slots.length }),
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), quality: tier, merged: room.frozen, mirror: !!room.mirror?.visible, room: room.id, swapMs: Math.round(lastSwapMs) }),
    room: () => room.id,
    rooms: () => rooms.map((id) => ({ id, label: roomPlan(data.tier, id, rooms).label })),
    goToRoom: (id) => goToRoom(id, null),
    setPov: (k) => {
      povEase = null;
      pov = k;
      if (k === null) { setMeAlpha(1); me.person.root.visible = true; }
      else { stick = { x: 0, y: 0 }; stopWalk(); }
    },
    easePov: (to, ms, done) => {
      if (disposed) return;
      if (to !== null) { stick = { x: 0, y: 0 }; stopWalk(); }
      povEase = { from: pov ?? 0, to, t: 0, t0: performance.now(), ms: Math.max(1, ms), done };
      if (pov === null) pov = 0;
      if (held && isOwner()) { held = false; clock.getDelta(); renderer.setAnimationLoop(loop); }
    },
    hold: (on) => {
      if (!isOwner() || disposed) return;
      if (on) { held = true; renderer.setAnimationLoop(null); tick(true); }
      else if (held) { held = false; clock.getDelta(); renderer.setAnimationLoop(loop); }
    },
    renderOnce: () => tick(true),
    act: (id) => { if (!sleepSeq) life?.act(id); },
    tapThing: (id) => life?.tapId(id) ?? false,
    lifeDebug: () => life?.debug() ?? {},
    dispose: () => {
      disposed = true;
      life?.dispose();
      renderer.info.autoReset = true;
      detachZoom?.();
      gov.dispose();
      hEnh?.dispose();
      if (isOwner()) renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      marker.dispose();
      room.dispose();
      fade.remove();
      glbCache.forEach((pr) => pr.then((g: any) => disposeGroup(g.scene)).catch(() => { /* never loaded */ }));
      // skinned bodies' geometry stays (as before: shared with the people cache)
      const keep = new Set<unknown>();
      scene.traverse((o: any) => { if (o.isSkinnedMesh && o.geometry) keep.add(o.geometry); });
      envTex.dispose();
      pmrem.dispose();
      // the shared renderer stays; the scene is freed after the next place built its shaders (perf.ts release)
      release(scene, keep);
    },
  };
  // the loading cover stays up until the real first frames are drawn and the
  // page runs at ~30 a second again (perf.ts awaitSmoothFrame): the first
  // draws' leftover building (shadow shaders, uploads) happens behind it
  await awaitSmoothFrame(renderer, { isDead: () => disposed || gone(), isOwner });
  return ctrl;
}
