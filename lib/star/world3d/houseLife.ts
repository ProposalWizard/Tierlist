/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE LIVING HOUSE (world kit in the real house; Harry, 20 Nov 2026: "things like the fridge and
 * couch + tv are genuinely incredible ... we need 3D FOR ALL OF them"). The house scene
 * (lib/star/home3d/scene.ts) keeps you, the walking, the camera, the rooms; this layer adds, for
 * the room you are in:
 *
 *  - the THINGS you can use (the room's BuiltRoom.things from home3d/livingRooms.ts): tap one,
 *    you walk up (the house's own walk), its card opens; "use" hands your body to a world-kit
 *    person (./npc.ts) for the sit / reach / run and back: the same clips, the same seat fit and
 *    seat check as the test page. A can, a cup or the remote shows in your hand. The room's fx
 *    play (the TV comes on, the fridge door swings, the shower runs). A tiny effect on the card.
 *  - TEAM-MATES who dropped round (people presets, ../people/presets.ts castScene), 1 in the
 *    starter flat up to 4 at the estate, each living in a room (on the sofa, at the pool table, on
 *    a lounger); seated ones chat to each other; tap one to talk (the world kit's card and the
 *    living world's chat). The round menu (components/star/life/RoundMenu.tsx) is not mounted
 *    yet: it needs the career's people and a screen anchor (the card is used, as on the test page).
 *
 * Off unless the house opens with `living` (homes.ts LIVING_TIERS / the test page).
 */
import type { Person3D } from "../people3d";
import type { BuiltRoom } from "../home3d/roomBuild";
import { roomFree } from "../home3d/roomBuild";
import type { HomeTier, RoomId } from "../home3d/homes";
import type { Quality3d } from "../three3d/quality";
import { buildGrid, type WalkGrid, type XZ } from "../tapWalk";
import { SmartSet, SlotBook, yawTo, type SmartObject } from "./smartObject";
import { Npc, measureSit, sitRootFor, BODY_R, type NpcWorld, type SitFit } from "./npc";
import { objectCard, personCard, smallTalk, talkSpot, type InteractCard } from "./interact";
import { phaseOf, DAY_MIN, seeded, hashId } from "./routine";
import { arrivalAt } from "../home3d/rooms";
import { whereAt } from "../life/houseRoutines";
import type { HouseVisit } from "../life/dayPlan";
import { houseTalk } from "../life/houseTalk";

/** How many team-mates are round, by home. */
export const GUESTS_BY_TIER: Record<HomeTier, number> = { starter: 1, flat: 1, penthouse: 2, house: 2, villa: 3, estate: 4 };
/** Which rooms they are in, in order (each takes up to its number). */
const GUEST_ROOMS: [RoomId, number][] = [["studio", 1], ["lounge", 2], ["games", 1], ["kitchen", 1], ["poolTerrace", 1], ["gym", 1], ["cinema", 1]];

/** Which room each team-mate is in (pure). */
export function guestRooms(rooms: RoomId[], n: number): RoomId[] {
  const out: RoomId[] = [];
  for (const [r, k] of GUEST_ROOMS) {
    if (!rooms.includes(r)) continue;
    for (let i = 0; i < k && out.length < n; i++) out.push(r);
  }
  return out;
}

export interface LifeMate { id: string; name: string; number: number }

export interface LifeOptions {
  THREE: any;
  SK: any;
  loader: any;
  scene: any;
  tier: HomeTier;
  rooms: RoomId[];
  quality: Quality3d;
  kit: { shirt: string; trim: string };
  club?: string;
  mates: LifeMate[];
  outline: number;
  /** You (the house's own body; changes when you change clothes). */
  me: () => Person3D;
  /** The house walks you: to a point, then faces; `then` when there. False: no way. */
  walkTo: (to: XZ, face: XZ | null, then: () => void) => boolean;
  stopWalk: () => void;
  /** Where you are and face. */
  you: () => { x: number; z: number; yaw: number };
  /** Hand your facing back to the house after a use. */
  setYaw: (yaw: number) => void;
  onCard: (c: InteractCard | null) => void;
  chat?: (id: string) => { line: string; change?: string } | null;
  /** Something used did something (+1 mood…): for the career, later. */
  onEffect?: (thing: string, e: NonNullable<SmartObject["effect"]>) => { text: string; sub?: string } | void;
  /** The career clock (life/liveClock.ts): minutes since day 0 of the gap. Absent: the house's own clock (15:00 on arrival). */
  clockNow?: () => number;
  /** Tick the career clock by this frame's time (s): people and the clock keep step. */
  tickClock?: (dt: number) => void;
  /** "Sleep till morning": you are down on the bed; the house plays the night (scene.ts) and then calls `wake`. */
  onSleep?: () => void;
  /** A short dip to dark with a caption ("Half an hour later"): `mid` runs in the dark. The bath's soak. */
  dip?: (caption: string, mid: () => void) => void;
  /** Who is in the house on a day of the gap (life/dayPlan.ts): visitors come and go on their routines. Absent: the fixed team-mates. */
  visits?: (day: number) => HouseVisit[];
  /** People (not you) drawn in your room at once (life/houseRoutines.ts roomPeople). */
  roomCap?: number;
}

export interface HouseLife {
  /** The room changed (built): its things and its team-mates. */
  enterRoom: (room: BuiltRoom) => void;
  /** A tap: true if it hit a person or a thing (handled). */
  tap: (origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }) => boolean;
  /** A scripted tap by id (filming). */
  tapId: (id: string) => boolean;
  act: (id: string) => void;
  /** You are using something: the house must not move or animate you. */
  controlsYou: () => boolean;
  seated: () => boolean;
  update: (dt: number) => void;
  /** While you use something: the camera's shot of it (seated, the shower, the mirror: from in front; the fridge, a counter: over the shoulder). Null: the follow camera. */
  useShot: () => { cam: [number, number, number]; look: [number, number, number] } | null;
  /** Talking to a team-mate: where he is (the camera frames you both). */
  talkTo: () => [number, number] | null;
  /** Your body was rebuilt (clothes): measure it again. */
  rebody: () => void;
  /** The house clock (game minutes from the first day's midnight): it opens mid-afternoon. */
  clock: () => number;
  /** The night is over: the clock to the next morning, team-mates start their day again. */
  newDay: () => void;
  /** After the night: you get up off the bed and the card says what the night did. */
  wake: (text: string) => void;
  /** The night: you lie in the bed under the duvet (true) or sit back up on it (false). */
  lie: (on: boolean) => void;
  /** The bed you are lying in (the morning's sun patch goes on it), else null. */
  bedNow: () => NonNullable<SmartObject["bed"]> | null;
  debug: () => Record<string, unknown>;
  dispose: () => void;
}

export async function startLife(o: LifeOptions): Promise<HouseLife> {
  const { THREE } = o;
  const { addClips, loadAnims3d } = await import("../three3d/footballAnims");
  const [footG, casinoG] = await Promise.all([loadAnims3d(o.loader, "football"), loadAnims3d(o.loader, "casino").catch(() => null)]);
  let disposed = false;
  let room: BuiltRoom | null = null;
  let objects = new SmartSet([]);
  const book = new SlotBook();
  let grid: WalkGrid | null = null;
  const npcs: Npc[] = [];
  const mateOf = new Map<Npc, LifeMate>();
  const world: NpcWorld = {
    get grid() { return grid!; },
    book,
    bodies: () => [...npcs.filter((n) => n.root.visible), ...(meNpc ? [meNpc] : [])].map((n) => { const [x, z] = n.bodyXZ(); return { id: n.id, x, z, r: BODY_R }; }),
  } as NpcWorld;

  // ── you: a world-kit person round your own body while you use something ──
  const clipped = new WeakSet<any>();
  const sits = new WeakMap<any, SitFit | null>();
  const ready = (p: Person3D) => {
    if (!clipped.has(p)) {
      addClips(THREE, p, footG);
      if (casinoG) addClips(THREE, p, casinoG);
      clipped.add(p);
    }
    if (!sits.has(p)) sits.set(p, measureSit(THREE, p));
    return sits.get(p) ?? null;
  };
  let meNpc: Npc | null = null;
  let using: SmartObject | null = null;
  let pending: { obj: SmartObject; slot: string | null } | null = null;
  let card: InteractCard | null = null;
  /** What the last thing you used did, in the career's words (shown on its card). */
  let lastEffect: { text: string; sub?: string } | null = null;
  let talking: Npc | null = null;
  /** The house clock (game minutes): mid-afternoon when you walk in; a night's sleep moves it to 07:00 next day. */
  let clockMin = 15 * 60;
  /** The minute now: the career clock when the house has one, else its own. */
  const now = () => (o.clockNow ? o.clockNow() : clockMin);
  let sleeping = false;
  /** Lying in bed: the world kit does not move you (your pose is held, under the duvet). */
  let lying: { duvet: any; bed: NonNullable<SmartObject["bed"]>; host: SmartObject } | null = null;
  const show = (c: InteractCard | null) => { card = c; o.onCard(c); };
  const fxOn = (id: string, v: boolean) => room?.fx?.[id]?.on?.(v);

  // things in the hand: a can (fridge), a cup (coffee), the remote (TV)
  const propG = { can: new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12), cup: new THREE.CylinderGeometry(0.04, 0.034, 0.09, 12), remote: new THREE.BoxGeometry(0.045, 0.02, 0.17), phone: new THREE.BoxGeometry(0.075, 0.01, 0.15) };
  const propM = { can: new THREE.MeshStandardMaterial({ color: "#d7263d", roughness: 0.3, metalness: 0.7 }), cup: new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.5 }), remote: new THREE.MeshStandardMaterial({ color: "#16181c", roughness: 0.4 }), phone: new THREE.MeshStandardMaterial({ color: "#0d0f13", roughness: 0.25, metalness: 0.4 }) };
  const hold = (n: Npc, what: keyof typeof propG | null) => {
    const hand = n.person.bones.RightHand;
    if (n.prop) { n.prop.parent?.remove(n.prop); n.prop = null; }
    if (!what || !hand) return;
    const c = new THREE.Mesh(propG[what], propM[what]);
    c.scale.setScalar(1 / n.person.unit);
    c.position.set(0, 0.07 / n.person.unit, 0.03 / n.person.unit);
    if (what === "remote" || what === "phone") c.rotation.x = Math.PI / 2;
    c.castShadow = false;
    hand.add(c);
    n.prop = c;
  };
  const propFor = (ob: SmartObject): keyof typeof propG | null => ob.kind === "fridge" ? "can" : ob.id === "coffee" ? "cup" : ob.kind === "tv" ? "remote" : null;

  /** Your body goes back to the house: the world kit's clips faded off, your facing handed back. */
  const handBack = () => {
    const n = meNpc;
    if (!n) return;
    hold(n, null);
    const p = n.person;
    for (const [name, a] of Object.entries(p.actions as Record<string, any>)) if (name !== "idle" && name !== "jog" && name !== "walk") { a.stop(); a.setEffectiveWeight(0); }
    p.root.position.y = 0;
    o.setYaw(n.yaw);
    meNpc = null;
    using = null;
  };

  const meNow = () => {
    const p = o.me();
    const sit = ready(p);
    const n = new Npc(THREE, p, { id: "you", loco: [{ name: "walk", speed: 1.4 }, { name: "jog", speed: 3.0 }].filter((l) => !!(p.actions as any)[l.name]), sit });
    const y = o.you();
    n.place(y.x, y.z, y.yaw);
    return n;
  };

  // ── team-mates ──
  let peopleReady: Promise<void> | null = null;
  // with a day plan (o.visits) nobody sits in a fixed place: visitors come and go (the section below)
  const where = o.visits ? [] : guestRooms(o.rooms, Math.min(o.mates.length, GUESTS_BY_TIER[o.tier] ?? 1));

  /** One body, dressed: a team-mate (player look, his casual or training wear) or staff (the chef in whites). */
  let kitP: Promise<any> | null = null;
  const peopleKit = () => kitP ??= (async () => {
    const [P3, L3, PR, FI, FACE, HAIR, CL] = await Promise.all([import("../people3d"), import("../look3d"), import("../people/presets"), import("../style3d/toon/faceIdApply"), import("../style3d/toon/face"), import("../style3d/toon/hair"), import("../style3d/toon/clothes")]);
    const animG = await P3.loadPeople3d(o.loader, "anims", L3.people3dLook());
    return { P3, L3, PR, FI, FACE, HAIR, CL, animG, charG: new Map<string, any>() };
  })();
  const makeBody = async (lookId: string, who: "mate" | "chef" | "cleaner", npcId: string, name: string): Promise<Npc | null> => {
    const K = await peopleKit();
    if (disposed) return null;
    const L: any = K.PR.castScene([{ id: lookId, role: "player" as const, club: o.club ?? "Arsenal" }])[0];
    let charG = K.charG.get(L.head);
    if (!charG) { charG = await K.P3.loadPeople3d(o.loader, "player", K.L3.people3dLook(), [L.head] as any); K.charG.set(L.head, charG); }
    if (disposed) return null;
    const p = K.P3.makePerson3d(THREE, o.SK, charG, K.animG, { outline: o.outline, castShadow: o.quality === "high", who: L.id, toonHead: L.head, toonBody: L.build } as any);
    K.P3.dressPerson3d(THREE, p, { ...L.dress, kit: { ...(L.kit ?? {}), ...o.kit }, number: null } as any);
    const ow = K.CL.offPitchWear(L.id, who === "mate" ? "mate" : "family", o.kit);
    // the chef in whites, the cleaner in a plain navy tee
    const cloth = who === "chef" ? { kind: "tee", colours: { ...ow.colours, top: "#f2efe8", trim: "#f2efe8", trousers: "#2b2d33" } } : who === "cleaner" ? { kind: "tee", colours: { ...ow.colours, top: "#2f4566", trim: "#2f4566" } } : ow;
    K.CL.dressCloth(THREE, p, cloth.kind as any, L.id, { colours: cloth.colours, whiteBalance: K.CL.HOME_WB });
    K.FI.applyToonFaceId(THREE, p, L.faceId, { detail: K.FI.FACE_DETAIL[o.quality] });
    const rig = K.FACE.addToonFace(THREE, p);
    rig?.set({ face: K.FACE.toonFaceFor({}), blink: 0 });
    if (L.hairMesh) await K.HAIR.wearToonHair(THREE, o.loader, p, L.hairMesh, { outline: o.outline ? 0.0045 : 0 });
    if (disposed) return null;
    K.P3.relaxHands(THREE, p);
    addClips(THREE, p, footG);
    if (casinoG) addClips(THREE, p, casinoG);
    const loco = [{ name: "walk", speed: 1.4 }, { name: "jog", speed: 3.0 }].filter((l) => !!(p.actions as any)[l.name]);
    const n = new Npc(THREE, p, { id: npcId, loco, sit: measureSit(THREE, p) });
    n.name = name;
    n.show(false);
    o.scene.add(p.root);
    return n;
  };

  const loadPeople = () => peopleReady ??= (async () => {
    if (!where.length) return;
    const P3 = await import("../people3d");
    const { people3dLook } = await import("../look3d");
    const PR = await import("../people/presets");
    const FI = await import("../style3d/toon/faceIdApply");
    const FACE = await import("../style3d/toon/face");
    const HAIR = await import("../style3d/toon/hair");
    const CL = await import("../style3d/toon/clothes");
    const mates = o.mates.slice(0, where.length);
    const looks = PR.castScene(mates.map((m) => ({ id: `world-mate-${m.id}`, role: "player" as const, club: o.club ?? "Arsenal" })));
    const heads = Array.from(new Set(looks.map((l: any) => l.head)));
    const [charG, animG] = await Promise.all([P3.loadPeople3d(o.loader, "player", people3dLook(), heads as any), P3.loadPeople3d(o.loader, "anims", people3dLook())]);
    for (let i = 0; i < mates.length && !disposed; i++) {
      const L: any = looks[i], m = mates[i];
      const p = P3.makePerson3d(THREE, o.SK, charG, animG, { outline: o.outline, castShadow: o.quality === "high", who: L.id, toonHead: L.head, toonBody: L.build } as any);
      // off the pitch: casual or the club's training wear in real cloth, never the match kit or a number (Harry,
      // 21 Nov 2026: "put them in houses"; style3d/toon/clothes/casual.ts picks it from his id, so he always dresses
      // the same). A body the cloth cannot dress keeps the painted kit, without a number.
      P3.dressPerson3d(THREE, p, { ...L.dress, kit: { ...(L.kit ?? {}), ...o.kit }, number: null } as any);
      const ow = CL.offPitchWear(L.id, "mate", o.kit);
      CL.dressCloth(THREE, p, ow.kind, L.id, { colours: ow.colours, whiteBalance: CL.HOME_WB });
      FI.applyToonFaceId(THREE, p, L.faceId, { detail: FI.FACE_DETAIL[o.quality] });
      const rig = FACE.addToonFace(THREE, p);
      rig?.set({ face: FACE.toonFaceFor({}), blink: 0 });
      if (L.hairMesh) await HAIR.wearToonHair(THREE, o.loader, p, L.hairMesh, { outline: o.outline ? 0.0045 : 0 });
      P3.relaxHands(THREE, p);
      addClips(THREE, p, footG);
      if (casinoG) addClips(THREE, p, casinoG);
      const n = new Npc(THREE, p, { id: `mate-${i}`, loco: [{ name: "jog", speed: 3.0 }], sit: measureSit(THREE, p) });
      n.name = m.name;
      n.show(false);
      o.scene.add(p.root);
      npcs.push(n);
      mateOf.set(n, m);
    }
    if (room && !disposed) seatGuests();
  })().catch((e) => console.error("house: team-mates", e));

  /** The team-mates of this room into their places (sat, or at the thing they use). */
  const seatGuests = () => {
    if (!room) return;
    const plans = room.guests ?? [];
    let k = 0;
    npcs.forEach((n, i) => {
      if (n.seated) n.leave();
      book.release(n.id);
      const here = where[i] === room!.id;
      if (!here) { n.show(false); return; }
      const g = plans[k++];
      const ob = g ? objects.get(g.obj) : null;
      if (!ob) { n.show(false); return; }
      n.show(true);
      if (ob.slots[0]?.seat) n.sitNow(world, ob, { slot: g!.slot });
      else {
        const s = ob.slots[0];
        n.place(s.stand[0], s.stand[1], s.facing);
        n.use(world, ob, { secs: Infinity });
      }
    });
  };

  // ── VISITORS WHO COME AND GO (o.visits: lib/star/life/dayPlan.ts + houseRoutines.ts) ──
  // Each visitor follows his day's steps on the career clock. Only the people whose step is in YOUR room
  // are drawn (at most o.roomCap of them); everyone else is hidden and costs nothing. A step that starts
  // while you watch is walked: through the doorway, to the thing, sit or use it, stand up, a look round,
  // on to the next. Walking into a room finds people already mid-step, in place.
  interface Guest {
    v: HouseVisit; n: Npc | null; loading: boolean;
    /** The step he is playing (index), -1 none; `token` cancels a stale walk's callback. */
    stepI: number; token: number;
    /** in: drawn in your room; out: not; leaving: walking out of your room. */
    mode: "in" | "out" | "leaving";
    /** Real seconds since his last move began (the watchdog: nobody walks for ever). */
    walkT: number;
    /** Walking in through the doorway (off the floor grid): nothing else starts until he is in. */
    entering?: boolean;
    /** The step whose walk was given up for a free spot (the watchdog). */
    redirected?: number;
    /** Real seconds in a stand-up (the watchdog). */
    exitT?: number;
  }
  let guests: Guest[] = [];
  let plannedDay = Number.NaN;
  const bodyOf = new Map<string, Npc>();
  /** Which visit a body is on now (for the tap card). */
  const visitOf = new Map<Npc, Guest>();
  const visitDay = () => Math.floor(now() / DAY_MIN);
  const minuteOfDay = () => now() - visitDay() * DAY_MIN;
  const bodyKey = (v: HouseVisit) => v.who === "mate" ? `mate:${v.mateId}` : v.who;

  let planCheckT = 0;
  const planDay = (dt = 0) => {
    if (!o.visits) return;
    const d = visitDay();
    if (d === plannedDay) {
      // every 2 s: a visit added since (you texted someone "come round?") joins the day
      planCheckT += dt;
      if (planCheckT < 2) return;
      planCheckT = 0;
      for (const v of o.visits(d)) if (!guests.some((g) => g.v.id === v.id && g.v.from === v.from)) { guests.push({ v, n: null, loading: false, stepI: -1, token: 0, mode: "out", walkT: 0 }); ensureBody(guests[guests.length - 1]); }
      return;
    }
    plannedDay = d;
    for (const g of guests) if (g.n) { if (g.n.seated) g.n.leave(); book.release(g.n.id); g.n.show(false); visitOf.delete(g.n); }
    guests = o.visits(d).map((v) => ({ v, n: null, loading: false, stepI: -1, token: 0, mode: "out", walkT: 0 }));
    // their bodies now (a body takes seconds to build): nobody pops in late or skips his walk through the door
    for (const g of guests) ensureBody(g);
  };
  const ensureBody = (g: Guest) => {
    if (g.n || g.loading) return;
    const key = bodyKey(g.v);
    const have = bodyOf.get(key);
    if (have) { g.n = have; visitOf.set(have, g); return; }
    // the same person already on his way (lunch and dinner: one chef): that load fills this visit too
    if (guests.some((h) => h !== g && h.loading && bodyKey(h.v) === key)) return;
    g.loading = true;
    const lookId = g.v.who === "mate" ? `world-mate-${g.v.mateId}` : `house-${g.v.who}-${o.club ?? ""}`;
    void makeBody(lookId, g.v.who, `guest-${key}`, g.v.name).then((n) => {
      g.loading = false;
      if (!n) return;
      bodyOf.set(key, n);
      npcs.push(n);
      if (g.v.mateId) { const m = o.mates.find((x) => x.id === g.v.mateId); if (m) mateOf.set(n, m); }
      // the body may be wanted by a later visit of the same person (lunch, then dinner)
      for (const h of guests) if (bodyKey(h.v) === key && !h.n) { h.n = n; }
      visitOf.set(n, g);
    }).catch((e) => { g.loading = false; console.error("house: visitor", e); });
  };

  /** A door of this room: to `to` if there is one, else the front door, else the first. */
  const doorTo = (to: string | null) => {
    const ds = room?.plan.doors ?? [];
    return ds.find((d) => d.to === to) ?? ds.find((d) => d.to === "garden") ?? ds[0] ?? null;
  };
  const inside = (d: NonNullable<ReturnType<typeof doorTo>>, k: number): XZ => { const a = arrivalAt(d, k); return [a.x, a.z]; };
  /** The room he comes from / goes to for this step (for the door he uses). */
  const neighbour = (g: Guest, i: number, dir: -1 | 1): string | null => {
    const s = g.v.steps;
    for (let k = i + dir; k >= 0 && k < s.length; k += dir) if (s[k].room !== "away" && s[k].room !== room?.id) return s[k].room;
    return dir === -1 ? "garden" : "garden";
  };
  /** A free spot in this room, seeded (somewhere to stand on the phone or wipe down). */
  const spotFor = (seed: string, nearWall = true): { at: XZ; face: number } | null => {
    if (!room || !grid) return null;
    const r = seeded(hashId(seed));
    for (let tries = 0; tries < 40; tries++) {
      const x = (r() * 2 - 1) * (room.w2 - 0.7), z = (r() * 2 - 1) * (room.d2 - 0.7);
      // near a wall: pushed out to 0.75 m off the nearest one, facing it (a window, a worktop)
      let px = x, pz = z, face = 0;
      if (nearWall) {
        const dx = room.w2 - Math.abs(x), dz = room.d2 - Math.abs(z);
        if (dx < dz) { px = Math.sign(x || 1) * (room.w2 - 0.75); face = Math.sign(x || 1) > 0 ? Math.PI / 2 : -Math.PI / 2; }
        else { pz = Math.sign(z || 1) * (room.d2 - 0.75); face = Math.sign(z || 1) > 0 ? 0 : Math.PI; }
      }
      if (!roomFree(room, px, pz)) continue;
      // not in a doorway, not on someone
      if ((room.plan.doors ?? []).some((d) => Math.hypot(d.x - px, d.z - pz) < 1.4)) continue;
      if (world.bodies().some((b) => Math.hypot(b.x - px, b.z - pz) < 0.8)) continue;
      return { at: [px, pz], face };
    }
    return null;
  };
  /** The thing a step uses, in this room (by id, then by kind). */
  const thingFor = (target: string | undefined): SmartObject | null => {
    if (!target) return null;
    const id = target === "hob" ? "coffee" : target === "seatsL" ? "seatsL" : target;
    const ob = objects.get(id);
    if (ob) return objects.host(ob);
    if (target === "sofa") return objects.ofKind("seat").find((x) => x.id !== "bed") ?? null;
    if (target === "fridge") return objects.ofKind("fridge")[0] ?? null;
    return null;
  };
  const LOOPS: Record<string, any[]> = {
    cook: [{ clip: "bartender_idle", or: ["lean_table", "idle"], secs: 6 }, { clip: "lean_table", or: ["idle"], secs: 4 }],
    clean: [{ clip: "bartender_idle", or: ["idle"], secs: 8 }],
    call: [{ clip: "idle", secs: 5 }, { clip: "idle", secs: 5, gesture: "look" }],
    talk: [{ clip: "idle", secs: 3 }, { clip: "nod", or: ["idle"], secs: 2 }],
    stand: [{ clip: "idle", secs: 6 }],
  };

  /** Play step i for this guest, from where he is (walks). `snap`: put him straight there (you just walked in). */
  const doStep = (g: Guest, i: number, snap: boolean) => {
    const n = g.n!, s = g.v.steps[i];
    const tok = ++g.token;
    const alive = () => g.token === tok && g.mode === "in";
    g.stepI = i;
    g.walkT = 0;
    hold(n, null);
    const standAt = (spot: { at: XZ; face: number } | null, loop: any[], prop: keyof typeof propG | null = null) => {
      if (!spot) { if (!n.busy) n.act(loop[0], 9999); return; }
      // on the phone: stood, the phone up to his ear (the drink gesture lifts the hand to his face); else the step's clip
      const go = () => { if (!alive()) return; hold(n, prop); if (prop === "phone") { n.stop(); n.sip(true); } else n.act(loop[0], 9999); };
      if (snap) { n.place(spot.at[0], spot.at[1], spot.face); go(); }
      else if (!n.walkTo(world, spot.at, { face: spot.face, onArrive: go })) go();
    };
    const useThing = (ob: SmartObject | null, loop?: any[], prop: keyof typeof propG | null = null) => {
      if (!ob || !book.free(ob).length) { standAt(spotFor(`${g.v.id}|${i}`), LOOPS.stand); return; }
      if (snap && ob.slots[0]?.seat) { if (n.sitNow(world, ob, { loop })) return; }
      if (snap) { const sl = book.free(ob)[0]; const at = sitRootFor(sl, n.sit).at; n.place(at[0], at[1], sl.facing); }
      const opts = { secs: Infinity, loop, onIn: () => { if (alive()) hold(n, prop ?? (ob.kind === "fridge" ? "can" : ob.id === "coffee" && g.v.who === "mate" ? "cup" : null)); } };
      if (snap) { if (!n.use(world, ob, opts)) standAt(spotFor(`${g.v.id}|${i}`), LOOPS.stand); return; }
      // as you do (houseLife tapObject): walk to a step in front of it (a seat's own spot is inside the seat,
      // past the floor a walk reaches), then turn and ease the last bit in as he sits or reaches
      const sl = book.free(ob).slice().sort((a, b) => Math.hypot(a.stand[0] - n.x, a.stand[1] - n.z) - Math.hypot(b.stand[0] - n.x, b.stand[1] - n.z))[0];
      const at = sitRootFor(sl, n.sit).at, back = sl.seat ? 0.34 : 0.05;
      const front: XZ = [at[0] + Math.sin(sl.facing) * back, at[1] + Math.cos(sl.facing) * back];
      const go = () => { if (!alive()) return; if (!n.use(world, ob, { ...opts, slot: sl.id, near: 0.6 })) standAt(spotFor(`${g.v.id}|${i}`), LOOPS.stand); };
      if (Math.hypot(front[0] - n.x, front[1] - n.z) < 0.3 || !n.walkTo(world, front, { onArrive: go })) go();
    };
    switch (s.kind) {
      case "use": useThing(thingFor(s.target)); break;
      case "cook": useThing(thingFor("hob"), LOOPS.cook); break;
      case "clean": { const ob = s.target ? thingFor(s.target) : null; if (ob) useThing(ob, LOOPS.clean); else standAt(spotFor(`${g.v.id}|clean|${i}`), LOOPS.clean); break; }
      case "call": standAt(spotFor(`${g.v.id}|call|${i}`), LOOPS.call, "phone"); break;
      case "meet": {
        const other = guests.find((x) => x.v.id === s.target && x.mode === "in" && x.n?.root.visible);
        if (!other?.n) { standAt(spotFor(`${g.v.id}|${i}`), LOOPS.stand); break; }
        const him = other.n.bodyXZ();
        const spot = talkSpot(him, other.n.yaw, [n.x, n.z], 1.1);
        const face = yawTo(spot, him);
        n.lookAt = him;
        if (snap) { n.place(spot[0], spot[1], face); n.act(LOOPS.talk[0], 9999); }
        else if (!n.walkTo(world, spot, { face, onArrive: () => { if (alive()) n.act(LOOPS.talk[1], 9999); } })) n.act(LOOPS.talk[0], 9999);
        break;
      }
      case "leave": {
        // out through the front door (this room's way towards it)
        const d = doorTo("garden");
        if (!d) { n.show(false); g.mode = "out"; break; }
        walkOut(g, d, tok);
        break;
      }
      default: {
        // arrive / go: he has just come in: a few steps into the room, a look round
        const d = doorTo(neighbour(g, i, -1));
        const at = d ? inside(d, 1.6) : null;
        if (at && !snap) { if (!n.walkTo(world, at, { onArrive: () => { if (alive()) n.act("idle", 9999); } })) n.act("idle", 9999); }
        else if (at) { n.place(at[0], at[1], n.yaw); n.act("idle", 9999); }
      }
    }
  };
  /** Walk to a door and through it, then hide. */
  const walkOut = (g: Guest, d: NonNullable<ReturnType<typeof doorTo>>, tok: number) => {
    const n = g.n!;
    g.mode = "leaving";
    g.walkT = 0;
    const gone = () => { if (g.token !== tok) return; n.show(false); hold(n, null); n.lookAt = null; g.mode = "out"; };
    const through = () => { if (g.token !== tok) return; if (!n.walkLine([inside(d, -0.6)], gone)) gone(); };
    if (!n.walkTo(world, inside(d, 0.35), { onArrive: through })) through();
  };
  /** Come in through a door (from the next room or the front door) and on to the step. */
  const walkIn = (g: Guest, i: number, from: string | null) => {
    const n = g.n!, d = doorTo(from);
    g.mode = "in";
    const tok = ++g.token;
    g.walkT = 0;
    if (!d) { doStep(g, i, true); return; }
    const out = inside(d, -0.6), inn = inside(d, 0.7);
    n.place(out[0], out[1], yawTo(out, inn));
    n.show(true);
    g.stepI = i;
    g.entering = true;
    const inDone = () => { g.entering = false; if (g.token === tok) doStep(g, i, false); };
    if (!n.walkLine([inn], inDone)) inDone();
  };

  /** Each frame (cheap: a few comparisons per visitor). */
  const stepGuests = (dt: number) => {
    if (!o.visits || !room) return;
    planDay(dt);
    const m = minuteOfDay();
    let drawn = 0;
    for (const g of guests) {
      const w = whereAt(g.v.steps, m);
      if (w) ensureBody(g);
      const n = g.n;
      if (!n) continue;
      if (visitOf.get(n) !== g && w) visitOf.set(n, g);
      if (visitOf.get(n) !== g) continue;
      // in your room now, within the room's budget (over it: he is in another room, out of sight)
      const here = !!w && w.step.room === room.id && drawn < (o.roomCap ?? 2);
      if (here) drawn++;
      if (g.mode === "out") {
        if (!here) continue;
        // a step that began a moment ago in a walk: he walks in through the door; else he is already there
        const fresh = (m - w!.step.at) < 1.5 && (w!.step.kind === "arrive" || w!.step.kind === "go" || (w!.i > 0 && g.v.steps[w!.i - 1].room !== room.id));
        const backFromAway = w!.i > 0 && g.v.steps[w!.i - 1].room === "away";
        const innerTo = ((room.plan.doors ?? []).find((x) => x.to === "bathroom") ?? (room.plan.doors ?? []).find((x) => x.to !== "garden"))?.to ?? null;
        if (fresh) walkIn(g, w!.i, w!.step.kind === "arrive" ? "garden" : backFromAway ? innerTo : neighbour(g, w!.i, -1));
        else { g.mode = "in"; n.show(true); doStep(g, w!.i, true); }
        continue;
      }
      g.walkT += dt;
      if (g.mode === "leaving") {
        // out of the doorway: once he is in it (the floor stops at the wall, so the last step can stall) he is gone;
        // the watchdog: a walk out that has not finished in 12 s ends out of sight
        if ((g.walkT > 1 && n.state === "stand") || g.walkT > 12) { g.token++; n.show(false); hold(n, null); n.lookAt = null; g.mode = "out"; }
        continue;
      }
      // mode in
      if (g.entering) {
        // the watchdog: a doorway walk that has not finished in 8 s ends just inside
        if (g.walkT > 8) { g.entering = false; const d = doorTo(null); if (d) { const p = inside(d, 0.7); n.place(p[0], p[1], n.yaw); } doStep(g, g.stepI, true); }
        continue;
      }
      // the watchdog: standing up from a seat takes about 1.5 s; one still going after 4 s is ended
      if (n.state === "exit") { g.exitT = (g.exitT ?? 0) + dt; if (g.exitT > 4) { g.exitT = 0; n.forceOut(); } } else g.exitT = 0;
      if (!here) {
        const tok = ++g.token;
        const next = w ? (w.step.room === "away" ? null : w.step.room) : "garden";
        // off screen (the toilet, out the back): an inside door (the bathroom, else any but the front door); else towards his next room
        const inner = (room?.plan.doors ?? []).find((x) => x.to === "bathroom") ?? (room?.plan.doors ?? []).find((x) => x.to !== "garden") ?? null;
        const d = w && w.step.room === "away" && inner ? inner : doorTo(next ?? neighbour(g, g.stepI, 1));
        const off = () => { if (g.token !== tok) return; if (d) walkOut(g, d, tok); else { n.show(false); g.mode = "out"; } };
        if (n.seated) n.leave(off); else { n.stop(); off(); }
        continue;
      }
      if (w!.i !== g.stepI) {
        // the next step, in this room: stand up (if sat), a short look round, then on
        const i = w!.i, tok = ++g.token;
        const on = () => { if (g.token !== tok) return; n.lookAt = null; n.act("idle", 1.2 + ((i * 7) % 10) / 10, () => { if (g.token === tok) doStep(g, i, false); }); };
        if (n.seated) n.leave(on); else { n.stop(); on(); }
        g.stepI = i;
        continue;
      }
      // a walk that is getting nowhere (you are standing in his way, say): after 8 s he gives up on that
      // thing and goes to stand somewhere free instead; never a jump to the spot
      if ((n.state === "walk" || n.state === "turn") && g.walkT > 8 && g.redirected !== g.stepI) {
        g.redirected = g.stepI;
        const spot = spotFor(`${g.v.id}|re|${g.stepI}`), tok = g.token;
        n.stop();
        if (spot && n.walkTo(world, spot.at, { face: spot.face, onArrive: () => { if (g.token === tok) n.act("idle", 9999); } })) g.walkT = 0;
        else n.act("idle", 9999);
      }
      // the step began: he looks at you now and then (not while you talk to someone else)
      if (n !== talking && n.state === "act" && !n.lookAt) { const ph = Math.floor((t + g.v.from) / 4.2) % 4; if (ph === 0) n.lookAt = [o.you().x, o.you().z]; }
      else if (n !== talking && n.state === "act" && Math.floor((t + g.v.from) / 4.2) % 4 !== 0 && g.v.steps[g.stepI]?.kind !== "meet") n.lookAt = null;
    }
  };

  const buildRoomGrid = (r: BuiltRoom) => buildGrid(-r.w2, r.w2, -r.d2, r.d2, 0.2, (x, z) => roomFree(r, x, z) && Math.abs(x) < r.w2 - BODY_R && Math.abs(z) < r.d2 - BODY_R);

  // ── tapping ──
  const endTalk = () => { if (talking) { talking.lookAt = null; talking = null; } };
  const tapPerson = (n: Npc) => {
    endTalk(); pending = null; show(null);
    const y = o.you();
    const him = n.bodyXZ();
    const spot = talkSpot(him, n.yaw, [y.x, y.z]);
    talking = n;
    const arrive = () => {
      if (talking !== n) return;
      n.lookAt = [o.you().x, o.you().z];
      if (!n.seated && n.state === "stand") n.face(yawTo([n.x, n.z], [o.you().x, o.you().z]));
      // a visitor says what fits what he is doing in YOUR house (life/houseTalk.ts); the old fixed team-mates, as before
      const g = visitOf.get(n);
      if (g) {
        const st = g.v.steps[g.stepI];
        const ht = houseTalk({ who: g.v.who, step: st?.kind ?? "arrive", target: st?.target, phase: phaseOf(now() % DAY_MIN), why: g.v.why, seed: `${g.v.id}|${g.stepI}|${Math.floor(now() / DAY_MIN)}` });
        show({ ...personCard({ id: n.id, name: n.name, lines: ht.lines, chat: g.v.who === "mate" && !!o.chat }), sub: ht.role });
        return;
      }
      show(personCard({ id: n.id, name: n.name, lines: smallTalk(n.id, n.seated ? "sat" : "stand", phaseOf(now() % DAY_MIN), Math.floor(now() / DAY_MIN) + 1), chat: !!o.chat }));
    };
    if (Math.hypot(spot[0] - y.x, spot[1] - y.z) < 0.4 || !o.walkTo(spot, him, arrive)) arrive();
  };
  const tapObject = (ob: SmartObject) => {
    endTalk(); show(null);
    const host = objects.host(ob);
    if (using === host) { pending = { obj: ob, slot: null }; show(objectCard(ob, { using: true })); return; }
    const free = book.free(host);
    if (!free.length && host.slots.length) { show(objectCard(ob, { taken: true })); return; }
    const y = o.you();
    const slot = free.slice().sort((a, b) => Math.hypot(a.stand[0] - y.x, a.stand[1] - y.z) - Math.hypot(b.stand[0] - y.x, b.stand[1] - y.z))[0];
    pending = { obj: ob, slot: slot?.id ?? null };
    if (!slot) { show(objectCard(ob)); return; }
    const at = sitRootFor(slot, ready(o.me())).at;
    // a seat: walk to a step in front of it (the house's walk keeps a body's width off anything solid,
    // so a seat's own spot right at a bed's foot was never reached and the card never came); "use" then
    // takes the last few centimetres (21 Nov 2026)
    const back = slot.seat ? 0.32 : 0;
    const spot: XZ = [at[0] + Math.sin(slot.facing) * back, at[1] + Math.cos(slot.facing) * back];
    const f: XZ = [spot[0] + Math.sin(slot.facing), spot[1] + Math.cos(slot.facing)];
    const ok = o.walkTo(spot, f, () => { if (pending?.obj === ob) show(objectCard(ob)); });
    // a walk that stalls short of the thing (the house's walker gives up quietly): the card comes anyway after
    // a few seconds, and "use" walks the last bit (the world kit's own walk, which finds its way round)
    if (ok) setTimeout(() => { if (!disposed && pending?.obj === ob && !card && !meNpc) show(objectCard(ob)); }, 6000);
    if (!ok) show(objectCard(ob));
  };
  const ray = (origin: any, d: any) => {
    let best: { t: number; n: Npc } | null = null;
    for (const n of npcs) {
      if (!n.root.visible) continue;
      const [px, pz] = n.bodyXZ();
      const t = rayCyl(origin, d, px, pz, 0.38, n.seated ? 1.35 : 1.9);
      if (t !== null && (!best || t < best.t)) best = { t, n };
    }
    let bestO: { t: number; o: SmartObject } | null = null;
    for (const ob of objects.list) {
      const t = rayCyl(origin, d, ob.pick.at[0], ob.pick.at[1], ob.pick.r, ob.pick.h);
      if (t !== null && (!bestO || t < bestO.t)) bestO = { t, o: ob };
    }
    return { best, bestO };
  };

  const act = (a: string) => {
    if (a === "close") { endTalk(); pending = null; show(null); return; }
    if (a === "chat" && talking) {
      const res = o.chat?.(mateOf.get(talking)?.id ?? talking.id) ?? null;
      show(personCard({ id: talking.id, name: talking.name, lines: res ? [res.line] : ["You already had a proper chat this week."], chat: false, change: res?.change }));
      return;
    }
    if (a === "leave") {
      const ob = pending?.obj ?? using;
      pending = null;
      if (!meNpc) { show(null); return; }
      meNpc.leave(() => { if (ob) fxOn(objects.host(ob).id === ob.id ? ob.id : ob.id, false); handBack(); show(null); });
      return;
    }
    if ((a === "use" || a === "sleep") && pending) {
      const ob = pending.obj, host = objects.host(ob);
      sleeping = a === "sleep";
      o.stopWalk();
      meNpc = meNow();
      // the last few centimetres: the house's walk stops a body's width off anything solid
      {
        const slot = host.slots.find((x) => x.id === pending!.slot) ?? host.slots[0];
        if (slot) {
          const at = sitRootFor(slot, meNpc.sit).at;
          if (Math.hypot(at[0] - meNpc.x, at[1] - meNpc.z) < 1.3) meNpc.place(at[0], at[1], meNpc.yaw);
        }
      }
      const quick = ob.kind === "fridge" || ob.id === "coffee";
      const timed = ob.stay[0] === ob.stay[1] && host.kind !== "seat";
      const ok = meNpc.use(world, host, {
        slot: pending.slot ?? undefined, loop: ob.loop,
        secs: quick || timed ? ob.stay[0] : Infinity,
        onStart: () => { if (ob.kind === "fridge") fxOn(ob.id, true); },
        onIn: () => {
          using = host;
          if (ob.kind !== "fridge") fxOn(ob.id, true);
          const pr = propFor(ob);
          if (pr && ob.kind !== "fridge" && ob.id !== "coffee") hold(meNpc!, pr);
          if (ob.kind === "fridge" || ob.id === "coffee") hold(meNpc!, pr);
          if (sleeping) { show(null); o.onSleep?.(); return; }
          if (ob.id === "bath") { o.dip?.("Half an hour later", () => fxOn("bath", true)); }
          // the career's answer (life/houseActs.ts: the time it took, the energy or mood within the day's caps)
          lastEffect = ob.effect ? o.onEffect?.(ob.id, ob.effect) || null : null;
          if (quick || timed) show(null);
          else { const c = objectCard(ob, { using: true }); show(lastEffect ? { ...c, sub: lastEffect.sub, lines: [lastEffect.text] } : c); }
        },
        onOut: () => {
          if (quick || timed) {
            fxOn(ob.id, false);
            const keepProp = quick;
            const n = meNpc;
            const prop = n?.prop;
            if (keepProp && prop && n) n.prop = null; // the can / cup stays in your hand a while
            handBack();
            if (keepProp && prop) setTimeout(() => prop.parent?.remove(prop), 6000);
            show({ key: `obj:${ob.id}`, title: ob.label, ...(lastEffect ? { sub: lastEffect.sub } : null), lines: [lastEffect?.text ?? ob.effect?.text ?? "Done."], actions: [{ id: "close", label: "OK", primary: true }] });
          }
        },
      });
      if (!ok) { handBack(); show(objectCard(ob, { taken: true })); }
      else show(null);
      pending = { obj: ob, slot: null };
    }
  };

  let t = 0;
  /** The routines' cost per frame (ms, smoothed): the frame meter's "routines" line. */
  let routineMs = 0;
  const life: HouseLife = {
    enterRoom: (r) => {
      if (meNpc) { meNpc.leave(); handBack(); }
      endTalk(); pending = null; show(null);
      room = r;
      objects = new SmartSet(r.things ?? []);
      grid = buildRoomGrid(r);
      // visitors: out of sight; the next frame puts those whose step is in this room in place (mid-step)
      for (const g of guests) { g.token++; g.mode = "out"; g.stepI = -1; g.entering = false; if (g.n) { g.n.show(false); hold(g.n, null); g.n.lookAt = null; } }
      for (const n of npcs) { if (visitOf.has(n)) { book.release(n.id); continue; } if (n.seated) n.leave(); book.release(n.id); }
      if (where.length) { void loadPeople(); if (npcs.length) seatGuests(); }
    },
    tap: (origin, d) => {
      const { best, bestO } = ray(origin, d);
      if (best && (!bestO || best.t <= bestO.t + 0.3)) { tapPerson(best.n); return true; }
      if (bestO) { tapObject(bestO.o); return true; }
      return false;
    },
    tapId: (id) => {
      const n = npcs.find((x) => x.id === id);
      if (n) { tapPerson(n); return true; }
      const ob = objects.get(id);
      if (ob) { tapObject(ob); return true; }
      return false;
    },
    act,
    controlsYou: () => !!meNpc,
    seated: () => !!meNpc?.seated,
    update: (dt) => {
      t += dt;
      if (meNpc && !lying) meNpc.update(dt, world, true);
      const t0 = typeof performance !== "undefined" ? performance.now() : 0;
      o.tickClock?.(dt);
      stepGuests(dt);
      if (t0) routineMs = routineMs * 0.95 + (performance.now() - t0) * 0.05;
      // seated team-mates chat: each looks at a neighbour now and then (seeded by the clock)
      for (let i = 0; i < npcs.length; i++) {
        const n = npcs[i];
        if (!n.root.visible) continue;
        if (n !== talking && !visitOf.has(n)) {
          const nb = npcs.filter((m) => m !== n && m.root.visible);
          const ph = Math.floor((t + i * 2.3) / 3.1) % 3;
          n.lookAt = ph === 2 ? [o.you().x, o.you().z] : nb.length ? nb[ph % nb.length].bodyXZ() : null;
        }
        n.update(dt, world, true);
      }
      if (room?.fx) for (const f of Object.values(room.fx)) f.tick?.(dt);
    },
    rebody: () => { if (meNpc) handBack(); },
    clock: () => now(),
    newDay: () => {
      clockMin = (Math.floor(clockMin / DAY_MIN) + 1) * DAY_MIN + 7 * 60;
      t = 0;
      endTalk();
      if (room && npcs.length) seatGuests();
    },
    lie: (on) => {
      const n = meNpc, host = using;
      if (on) {
        const b = host?.bed;
        if (!n || !host || !b || lying) return;
        const p = n.person;
        hold(n, null);
        // the standing pose laid flat on its back, feet to the foot, head on the pillow
        for (const a of Object.values(p.actions as Record<string, any>)) { a.stop(); a.setEffectiveWeight(0); }
        const idle = (p.actions as any).idle;
        if (idle) { idle.reset(); idle.setEffectiveWeight(1); idle.play(); }
        p.mixer.update(0.016);
        const hd = [Math.sin(b.head), Math.cos(b.head)];
        p.root.position.set(b.at[0] - hd[0] * 0.85, b.top + 0.12, b.at[1] - hd[1] * 0.85);
        p.root.rotation.set(-Math.PI / 2, b.head + Math.PI, 0, "YXZ");
        // the duvet over him, chest to feet (a soft raised slab in the bed's own colour)
        const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.3, 1.5), new THREE.MeshStandardMaterial({ color: b.duvet, roughness: 0.92 }));
        duvet.position.set(b.at[0] - hd[0] * 0.3, b.top + 0.13, b.at[1] - hd[1] * 0.3);
        duvet.rotation.y = b.head;
        duvet.castShadow = false; duvet.receiveShadow = true;
        o.scene.add(duvet);
        lying = { duvet, bed: b, host };
        return;
      }
      if (!lying || !n) return;
      const L = lying;
      lying = null;
      L.duvet.parent?.remove(L.duvet); L.duvet.geometry.dispose(); L.duvet.material.dispose();
      // sat back up on the edge of the bed, as before the night (the clip's held seated pose)
      const p = n.person;
      p.root.rotation.set(0, n.yaw, 0, "XYZ");
      n.update(0, world, true);
      void p;
    },
    bedNow: () => lying?.bed ?? null,
    wake: (text) => {
      sleeping = false;
      const card = () => show({ key: "obj:bed", title: "Good morning", sub: "07:00", lines: [text], actions: [{ id: "close", label: "OK", primary: true }] });
      const n = meNpc;
      if (lying && n) {
        // up and standing at the bed's foot, facing the room (done in the dark: no stand-up clip from lying)
        const L = lying;
        lying = null;
        L.duvet.parent?.remove(L.duvet); L.duvet.geometry.dispose(); L.duvet.material.dispose();
        const slot = L.host.slots[0];
        n.person.root.rotation.set(0, slot.facing, 0, "XYZ");
        n.person.root.position.set(slot.stand[0], 0, slot.stand[1]);
        n.place(slot.stand[0], slot.stand[1], slot.facing);
        book.release(n.id);
        fxOn(L.host.id, false);
        handBack(); pending = null; card();
        return;
      }
      const done = () => { handBack(); pending = null; card(); };
      if (n) n.leave(done); else done();
    },
    useShot: () => {
      const n = meNpc;
      if (!n || !room) return null;
      if (lying) {
        const b = lying.bed, hd = [Math.sin(b.head), Math.cos(b.head)], rt = [hd[1], -hd[0]];
        // a high three-quarter view: off the foot corner, up by the ceiling, the whole bed and the window side of the room
        const cx = b.at[0] - hd[0] * 1.9 + rt[0] * 1.9, cz = b.at[1] - hd[1] * 1.9 + rt[1] * 1.9;
        const clampX = (x: number) => Math.max(-room!.w2 + 0.25, Math.min(room!.w2 - 0.25, x)), clampZ = (z: number) => Math.max(-room!.d2 + 0.25, Math.min(room!.d2 - 0.25, z));
        return { cam: [clampX(cx), room.h - 0.15, clampZ(cz)], look: [b.at[0] + hd[0] * 0.2, b.top, b.at[1] + hd[1] * 0.2] };
      }
      const ob = using ?? pending?.obj ?? null;
      const front = !ob || ob.kind === "seat" || ob.kind === "tv" || ob.kind === "spot" || ob.kind === "mirror";
      const f = [Math.sin(n.yaw), Math.cos(n.yaw)], r = [Math.cos(n.yaw), -Math.sin(n.yaw)];
      const d = front ? 2.3 : -2.0, side = front ? 0.5 : 0.75;
      const clampX = (x: number) => Math.max(-room!.w2 + 0.3, Math.min(room!.w2 - 0.3, x)), clampZ = (z: number) => Math.max(-room!.d2 + 0.3, Math.min(room!.d2 - 0.3, z));
      const cy = n.seated ? 1.55 : 1.75;
      return { cam: [clampX(n.x + f[0] * d + r[0] * side), Math.min(room.h - 0.2, cy), clampZ(n.z + f[1] * d + r[1] * side)], look: [n.x + (front ? 0 : f[0] * 0.6), n.seated ? 0.85 : 1.15, n.z + (front ? 0 : f[1] * 0.6)] };
    },
    talkTo: () => (talking && card ? talking.bodyXZ() : null),
    debug: () => ({
      room: room?.id, clock: now(), sleeping, lying: !!lying, things: objects.list.map((x) => x.id), using: using?.id ?? null, card: card?.title ?? null,
      you: meNpc?.info() ?? null, people: npcs.map((n) => ({ ...n.info(), visible: n.root.visible })), book: book.all(), where,
      // visitors (life/dayPlan.ts): who, what step, drawn or not; the routines' cost per frame
      day: o.visits ? visitDay() : null, minute: o.visits ? Math.round(minuteOfDay()) : null, routineMs: +routineMs.toFixed(4),
      guests: guests.map((g) => { const w = whereAt(g.v.steps, minuteOfDay()); return { id: g.v.id, name: g.v.name, mode: g.mode, step: w?.step.label ?? null, room: w?.step.room ?? null, state: g.n?.state ?? "loading", clip: g.n?.play.current ?? null, clipT: g.n ? +g.n.play.time().toFixed(2) : null, visible: !!g.n?.root.visible, from: g.v.from, to: g.v.to }; }),
      // the seat check (RUL-3D-005): every skin point of each seated person inside his seat's top 8 cm (cm, 0 = clear)
      seats: [...npcs, ...(meNpc ? [meNpc] : [])].filter((p) => p.state === "use" && p.using?.slots[0]?.seat && !(lying && p === meNpc)).map((p) => seatCheck(THREE, p, book)),
    }),
    dispose: () => {
      disposed = true;
      if (meNpc) handBack();
      for (const n of npcs) { n.root.parent?.remove(n.root); n.person.mixer.stopAllAction(); }
    },
  };
  return life;
}

/** The seat check: how deep (cm) any skin point of a seated person is inside the top 8 cm of his seat. */
function seatCheck(THREE: any, p: Npc, book: SlotBook) {
  const host = p.using!;
  const slot = host.slots.find((x) => book.holderOf(host.id, x.id) === p.id) ?? host.slots[0];
  const s = slot.seat!;
  const f = [Math.sin(slot.facing), Math.cos(slot.facing)], r = [Math.cos(slot.facing), -Math.sin(slot.facing)];
  const body: any = p.person.body;
  body.skeleton?.update?.();
  // the cloth clothes (style3d/toon/clothes) are what sit on the seat when he wears them: checked as well
  const cloth: any = body.parent?.getObjectByName?.("Cloth") ?? null;
  const v = new THREE.Vector3();
  let deep = 0, n = 0, clothDeep = 0;
  for (const m of cloth ? [body, cloth] : [body]) {
    for (let k = 0; k < m.geometry.attributes.position.count; k += 2) {
      m.getVertexPosition(k, v); v.applyMatrix4(m.matrixWorld);
      const dx = v.x - s.at[0], dz = v.z - s.at[1];
      const along = dx * f[0] + dz * f[1], side = dx * r[0] + dz * r[1];
      if (along < -0.2 || along > (s.front ?? 0.3) || Math.abs(side) > 0.32) continue;
      if (v.y < s.y && v.y > s.y - 0.08) { deep = Math.max(deep, s.y - v.y); n++; if (m === cloth) clothDeep = Math.max(clothDeep, s.y - v.y); }
    }
  }
  return { id: p.id, obj: host.id, pierceCm: +(deep * 100).toFixed(1), clothCm: cloth ? +(clothDeep * 100).toFixed(1) : null, points: n, liftCm: +(p.y * 100).toFixed(1) };
}

/** Where a ray first meets a standing cylinder (centre x,z, radius r, from the floor to h), or null. */
function rayCyl(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, cx: number, cz: number, r: number, h: number): number | null {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return null;
  const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
    if (t < 0) continue;
    const y = o.y + d.y * t;
    if (y >= 0 && y <= h) return t;
  }
  if (Math.abs(d.y) > 1e-6) {
    const t = (h - o.y) / d.y;
    if (t > 0) { const x = ox + d.x * t, z = oz + d.z * t; if (x * x + z * z <= r * r) return t; }
  }
  return null;
}
