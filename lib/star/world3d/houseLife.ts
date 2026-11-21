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
import { phaseOf, DAY_MIN } from "./routine";

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
  onEffect?: (thing: string, e: NonNullable<SmartObject["effect"]>) => void;
  /** "Sleep till morning": you are down on the bed; the house plays the night (scene.ts) and then calls `wake`. */
  onSleep?: () => void;
  /** A short dip to dark with a caption ("Half an hour later"): `mid` runs in the dark. The bath's soak. */
  dip?: (caption: string, mid: () => void) => void;
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
  let talking: Npc | null = null;
  /** The house clock (game minutes): mid-afternoon when you walk in; a night's sleep moves it to 07:00 next day. */
  let clockMin = 15 * 60;
  let sleeping = false;
  /** Lying in bed: the world kit does not move you (your pose is held, under the duvet). */
  let lying: { duvet: any; bed: NonNullable<SmartObject["bed"]>; host: SmartObject } | null = null;
  const show = (c: InteractCard | null) => { card = c; o.onCard(c); };
  const fxOn = (id: string, v: boolean) => room?.fx?.[id]?.on?.(v);

  // things in the hand: a can (fridge), a cup (coffee), the remote (TV)
  const propG = { can: new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12), cup: new THREE.CylinderGeometry(0.04, 0.034, 0.09, 12), remote: new THREE.BoxGeometry(0.045, 0.02, 0.17) };
  const propM = { can: new THREE.MeshStandardMaterial({ color: "#d7263d", roughness: 0.3, metalness: 0.7 }), cup: new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.5 }), remote: new THREE.MeshStandardMaterial({ color: "#16181c", roughness: 0.4 }) };
  const hold = (n: Npc, what: keyof typeof propG | null) => {
    const hand = n.person.bones.RightHand;
    if (n.prop) { n.prop.parent?.remove(n.prop); n.prop = null; }
    if (!what || !hand) return;
    const c = new THREE.Mesh(propG[what], propM[what]);
    c.scale.setScalar(1 / n.person.unit);
    c.position.set(0, 0.07 / n.person.unit, 0.03 / n.person.unit);
    if (what === "remote") c.rotation.x = Math.PI / 2;
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
  const where = guestRooms(o.rooms, Math.min(o.mates.length, GUESTS_BY_TIER[o.tier] ?? 1));
  const loadPeople = () => peopleReady ??= (async () => {
    if (!where.length) return;
    const P3 = await import("../people3d");
    const { people3dLook } = await import("../look3d");
    const PR = await import("../people/presets");
    const FI = await import("../style3d/toon/faceIdApply");
    const FACE = await import("../style3d/toon/face");
    const HAIR = await import("../style3d/toon/hair");
    const { numberCanvas } = await import("../shop3d/textures");
    const mates = o.mates.slice(0, where.length);
    const looks = PR.castScene(mates.map((m) => ({ id: `world-mate-${m.id}`, role: "player" as const, club: o.club ?? "Arsenal" })));
    const heads = Array.from(new Set(looks.map((l: any) => l.head)));
    const [charG, animG] = await Promise.all([P3.loadPeople3d(o.loader, "player", people3dLook(), heads as any), P3.loadPeople3d(o.loader, "anims", people3dLook())]);
    for (let i = 0; i < mates.length && !disposed; i++) {
      const L: any = looks[i], m = mates[i];
      const p = P3.makePerson3d(THREE, o.SK, charG, animG, { outline: o.outline, castShadow: o.quality === "high", who: L.id, toonHead: L.head, toonBody: L.build } as any);
      const nt = new THREE.CanvasTexture(numberCanvas(m.number, "#ffffff")); nt.colorSpace = THREE.SRGBColorSpace;
      P3.dressPerson3d(THREE, p, { ...L.dress, kit: { ...(L.kit ?? {}), ...(i % 2 ? { shirt: "#f2f2f2", trim: o.kit.shirt } : o.kit) }, number: nt } as any);
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
      show(personCard({ id: n.id, name: n.name, lines: smallTalk(n.id, n.seated ? "sat" : "stand", phaseOf(clockMin % DAY_MIN), Math.floor(clockMin / DAY_MIN) + 1), chat: !!o.chat }));
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
    const spot = sitRootFor(slot, ready(o.me())).at;
    const f: XZ = [spot[0] + Math.sin(slot.facing), spot[1] + Math.cos(slot.facing)];
    const ok = o.walkTo(spot, f, () => { if (pending?.obj === ob) show(objectCard(ob)); });
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
          if (ob.effect) o.onEffect?.(ob.id, ob.effect);
          show(quick || timed ? null : objectCard(ob, { using: true }));
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
            show({ key: `obj:${ob.id}`, title: ob.label, lines: [ob.effect?.text ?? "Done."], actions: [{ id: "close", label: "OK", primary: true }] });
          }
        },
      });
      if (!ok) { handBack(); show(objectCard(ob, { taken: true })); }
      else show(null);
      pending = { obj: ob, slot: null };
    }
  };

  let t = 0;
  const life: HouseLife = {
    enterRoom: (r) => {
      if (meNpc) { meNpc.leave(); handBack(); }
      endTalk(); pending = null; show(null);
      room = r;
      objects = new SmartSet(r.things ?? []);
      grid = buildRoomGrid(r);
      for (const n of npcs) { if (n.seated) n.leave(); book.release(n.id); }
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
      // seated team-mates chat: each looks at a neighbour now and then (seeded by the clock)
      for (let i = 0; i < npcs.length; i++) {
        const n = npcs[i];
        if (!n.root.visible) continue;
        if (n !== talking) {
          const nb = npcs.filter((m) => m !== n && m.root.visible);
          const ph = Math.floor((t + i * 2.3) / 3.1) % 3;
          n.lookAt = ph === 2 ? [o.you().x, o.you().z] : nb.length ? nb[ph % nb.length].bodyXZ() : null;
        }
        n.update(dt, world, true);
      }
      if (room?.fx) for (const f of Object.values(room.fx)) f.tick?.(dt);
    },
    rebody: () => { if (meNpc) handBack(); },
    clock: () => clockMin,
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
      room: room?.id, clock: clockMin, sleeping, lying: !!lying, things: objects.list.map((x) => x.id), using: using?.id ?? null, card: card?.title ?? null,
      you: meNpc?.info() ?? null, people: npcs.map((n) => ({ ...n.info(), visible: n.root.visible })), book: book.all(), where,
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
  const v = new THREE.Vector3();
  let deep = 0, n = 0;
  for (let k = 0; k < body.geometry.attributes.position.count; k += 2) {
    body.getVertexPosition(k, v); v.applyMatrix4(body.matrixWorld);
    const dx = v.x - s.at[0], dz = v.z - s.at[1];
    const along = dx * f[0] + dz * f[1], side = dx * r[0] + dz * r[1];
    if (along < -0.2 || along > (s.front ?? 0.3) || Math.abs(side) > 0.32) continue;
    if (v.y < s.y && v.y > s.y - 0.08) { deep = Math.max(deep, s.y - v.y); n++; }
  }
  return { id: p.id, obj: host.id, pierceCm: +(deep * 100).toFixed(1), points: n, liftCm: +(p.y * 100).toFixed(1) };
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
