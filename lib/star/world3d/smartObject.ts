/**
 * SMART OBJECTS — the things in a 3D place a person can use (world kit,
 * phase 1; docs/research/world-3d-2026-11-20.md "Shared world kit").
 *
 * The Sims idea: the people are simple, the OBJECTS know how they are used.
 * A sofa says where you stand to sit on it, which way you face, how many can
 * sit, the clips to play going in, while there and coming out, the words on
 * its card, and what using it does. A person (./npc.ts) only books a slot and
 * plays what the object says. Pure data and maths: no three.js here.
 *
 * Ground plan: metres, x across, z towards the camera's start, north is -z.
 * A facing (yaw) is the way he looks: 0 = +z, π/2 = +x (as tapWalk.ts).
 */
import type { XZ } from "../tapWalk";

export type SmartKind =
  | "seat" | "lean" | "counter" | "tv" | "fridge" | "door" | "gate"
  | "mirror" | "gym" | "barberChair" | "car" | "spot";

/** One clip to play: the name a body has, stand-ins after it. */
export interface ClipStep {
  clip: string;
  /** Stand-ins, in order, if the body lacks `clip`. */
  or?: string[];
  speed?: number;
  /** Hold a still frame at this time (s) instead of playing. */
  hold?: number;
  /** Start here (s); with a negative speed the clip plays backwards from it. */
  from?: number;
  /** How long a loop step lasts (s). Unset: the clip's own length. */
  secs?: number;
  /** A small move the scene adds over the clip (no clip of its own yet). */
  gesture?: "drink" | "remote";
}

/** A place on the object one person uses. */
export interface SmartSlot {
  id: string;
  /** Where his feet are while he uses it (for a seat: where he stands before he sits). */
  stand: XZ;
  /** The way he faces while using it. */
  facing: number;
  /** A seat: where his hips go and the seat's top (m). The person fits himself to it. */
  seat?: { at: XZ; y: number };
}

/** What using it does (shown on the card; a career hook later). */
export interface SmartEffect {
  mood?: number;
  energy?: number;
  bond?: number;
  text?: string;
}

export interface SmartObject {
  id: string;
  kind: SmartKind;
  /** Its name on the card ("Sofa", "Drinks fridge"). */
  label: string;
  slots: SmartSlot[];
  enter?: ClipStep;
  /** Played in turn, round and round, while he uses it. */
  loop: ClipStep[];
  exit?: ClipStep;
  /** The card: its main button and a line or two. */
  prompt: { verb: string; lines?: string[] };
  effect?: SmartEffect;
  /** How long a person stays when the routine does not say (s, min..max). */
  stay: [number, number];
  /** Who may use it. */
  who: "anyone" | "you" | "people";
  /** Where a tap hits it: a standing cylinder. */
  pick: { at: XZ; r: number; h: number };
  /** Used FROM another object (the TV from the sofa's seats). */
  via?: string;
}

/** Forward and right on the floor for a facing. */
export const fwdOf = (yaw: number): XZ => [Math.sin(yaw), Math.cos(yaw)];
export const rightOf = (yaw: number): XZ => [Math.cos(yaw), -Math.sin(yaw)];
/** The facing that looks from a to b. */
export const yawTo = (a: XZ, b: XZ) => Math.atan2(b[0] - a[0], b[1] - a[1]);

/** How far in front of his seat his feet stand before he sits (the capture's
 *  own sit_down travel, CMU 143_18: about 0.31 m). A person measures his own. */
export const SIT_STEP = 0.31;

/**
 * Sitting, standing up and staying sat are ONE capture (CMU 143_18's
 * sit_down), so his feet never move: the seated loop holds its last frames
 * and standing up plays it backwards. (The capture's sit_idle and stand_up
 * are cut round the hips, 0.28 m off sit_down's feet: switching to them
 * would make him jump. Measured 20 Nov 2026 on the Style A body.)
 */
export const SIT_ENTER: ClipStep = { clip: "sit_down", or: ["sitdown"] };
export const SIT_HOLD: ClipStep = { clip: "sit_down", or: ["sitidle"], hold: 1.55, secs: 6 };
export const SIT_EXIT: ClipStep = { clip: "sit_down", or: ["sitdown"], from: 1.6, speed: -1.15 };

/**
 * A seat for `seats` people side by side: `at` is the middle of the seat,
 * `facing` the way a sitter looks, `y` the seat's top, `spacing` between hips.
 */
export function seatObject(o: {
  id: string; label: string; at: XZ; facing: number; seats: number; y: number; spacing?: number;
  depth?: number; verb?: string; lines?: string[]; loop?: ClipStep[]; stay?: [number, number]; who?: SmartObject["who"];
}): SmartObject {
  const sp = o.spacing ?? 0.62;
  const f = fwdOf(o.facing), r = rightOf(o.facing);
  const slots: SmartSlot[] = [];
  for (let i = 0; i < o.seats; i++) {
    const off = (i - (o.seats - 1) / 2) * sp;
    const at: XZ = [o.at[0] + r[0] * off, o.at[1] + r[1] * off];
    slots.push({ id: `s${i}`, stand: [at[0] + f[0] * SIT_STEP, at[1] + f[1] * SIT_STEP], facing: o.facing, seat: { at, y: o.y } });
  }
  const depth = o.depth ?? 0.9;
  return {
    id: o.id, kind: "seat", label: o.label, slots,
    enter: SIT_ENTER,
    loop: o.loop ?? [SIT_HOLD],
    exit: SIT_EXIT,
    prompt: { verb: o.verb ?? "Sit down", lines: o.lines },
    stay: o.stay ?? [20, 40], who: o.who ?? "anyone",
    pick: { at: o.at, r: Math.max(depth, (o.seats * sp) / 2) * 0.6, h: 1.0 },
  };
}

/** A TV, watched from a seat object (`via`). Using it = sitting there with it on. */
export function tvObject(o: { id: string; at: XZ; via: string; label?: string; lines?: string[] }): SmartObject {
  return {
    id: o.id, kind: "tv", label: o.label ?? "TV", slots: [], via: o.via,
    loop: [{ ...SIT_HOLD, secs: 8, gesture: "remote" }],
    prompt: { verb: "Watch TV", lines: o.lines ?? ["Highlights from the weekend."] },
    effect: { mood: 1, text: "Feet up. Mood +1" },
    stay: [30, 60], who: "anyone", pick: { at: o.at, r: 0.7, h: 1.8 },
  };
}

/**
 * Something you stand at and face: a fridge, a counter, a mirror, a gate.
 * `front` is where his feet go, `face` what he looks at.
 */
export function standObject(o: {
  id: string; kind: SmartKind; label: string; front: XZ; face: XZ; verb: string; lines?: string[];
  enter?: ClipStep; loop?: ClipStep[]; exit?: ClipStep; effect?: SmartEffect; stay?: [number, number];
  who?: SmartObject["who"]; pickR?: number; pickH?: number;
}): SmartObject {
  return {
    id: o.id, kind: o.kind, label: o.label,
    slots: [{ id: "s0", stand: o.front, facing: yawTo(o.front, o.face) }],
    enter: o.enter, loop: o.loop ?? [{ clip: "idle", secs: 2 }], exit: o.exit,
    prompt: { verb: o.verb, lines: o.lines }, effect: o.effect,
    stay: o.stay ?? [3, 6], who: o.who ?? "anyone",
    pick: { at: o.face, r: o.pickR ?? 0.5, h: o.pickH ?? 1.6 },
  };
}

/** The objects of one place, by id. */
export class SmartSet {
  readonly list: SmartObject[];
  private by = new Map<string, SmartObject>();
  constructor(list: SmartObject[]) {
    this.list = list;
    for (const o of list) this.by.set(o.id, o);
  }
  get(id: string): SmartObject | undefined { return this.by.get(id); }
  ofKind(kind: SmartKind): SmartObject[] { return this.list.filter((o) => o.kind === kind); }
  /** The object a tap at floor point p (and height y) is on, nearest first. */
  pickAt(p: XZ, y = 1): SmartObject | null {
    let best: SmartObject | null = null, bd = Infinity;
    for (const o of this.list) {
      const d = Math.hypot(p[0] - o.pick.at[0], p[1] - o.pick.at[1]);
      if (d <= o.pick.r && y <= o.pick.h + 0.2 && d < bd) { bd = d; best = o; }
    }
    return best;
  }
  /** The object a person really books (a TV books its sofa). */
  host(o: SmartObject): SmartObject { return o.via ? this.by.get(o.via) ?? o : o; }
}

/**
 * Who is in which slot. One person, one slot; one slot, one person. Pure.
 */
export class SlotBook {
  private holder = new Map<string, string>();
  private mine = new Map<string, { obj: string; slot: string }>();
  private key = (obj: string, slot: string) => `${obj}#${slot}`;

  /** Who holds this slot (null: free). */
  holderOf(obj: string, slot: string): string | null { return this.holder.get(this.key(obj, slot)) ?? null; }
  /** The slot this person holds. */
  slotOf(who: string): { obj: string; slot: string } | null { return this.mine.get(who) ?? null; }
  /** The free slots of an object. */
  free(o: SmartObject): SmartSlot[] { return o.slots.filter((s) => !this.holder.has(this.key(o.id, s.id))); }

  /**
   * Book a slot for `who` (letting go of any he had): `slot` exactly if free,
   * else the free one nearest `near`, else the first free. Null: all taken.
   */
  book(o: SmartObject, who: string, opts: { slot?: string; near?: XZ } = {}): SmartSlot | null {
    const had = this.mine.get(who);
    if (had && had.obj === o.id && (!opts.slot || had.slot === opts.slot)) return o.slots.find((s) => s.id === had.slot) ?? null;
    let pick: SmartSlot | undefined;
    const free = this.free(o);
    if (opts.slot) pick = free.find((s) => s.id === opts.slot);
    else if (opts.near) {
      const n = opts.near;
      pick = free.slice().sort((a, b) => Math.hypot(a.stand[0] - n[0], a.stand[1] - n[1]) - Math.hypot(b.stand[0] - n[0], b.stand[1] - n[1]))[0];
    } else pick = free[0];
    if (!pick) return null;
    this.release(who);
    this.holder.set(this.key(o.id, pick.id), who);
    this.mine.set(who, { obj: o.id, slot: pick.id });
    return pick;
  }
  release(who: string) {
    const had = this.mine.get(who);
    if (!had) return;
    this.holder.delete(this.key(had.obj, had.slot));
    this.mine.delete(who);
  }
  /** Every booking, for a debug readout or a test. */
  all(): { who: string; obj: string; slot: string }[] {
    return Array.from(this.mine.entries()).map(([who, s]) => ({ who, ...s }));
  }
}
