/**
 * THE STANDING OVATION — where everyone stands and when things happen.
 *
 * Mikey, 8 Oct 2026 (farewell playtest): "a 360 camera degree angle ... going
 * around spinning slowly around me ... me clapping to the fans and fans all on
 * their feet clapping back and me slowly walking off the pitch. And there's a
 * substitute coming on and he hugs me. And on the way towards that substitute
 * ... some teammates and rivals ... giving me like dap ups and hugs."
 *
 * Pure numbers, no three.js: the 3D scene (lib/star/ovation3d.ts) and the
 * drawn version (components/star/Ovation.tsx) both read this, and
 * tests/star/ovation.mts checks it.
 *
 * Metres. You start in midfield at z = START_Z and walk towards +z, the
 * touchline at z = LINE_Z. The stands ring the pitch. The camera circles you
 * once, slowly, over the whole scene.
 */

export type Greeting = "hug" | "dap" | "pat";

export interface OvationPerson {
  id: string;
  name: string;
  team: "ours" | "rivals";
}

export interface OvationStop {
  who: OvationPerson;
  kind: Greeting;
  /** Your position (z) when you stop for him. */
  z: number;
  /** He stands this side of your path: -1 left (−x), 1 right (+x). */
  side: -1 | 1;
  /** Seconds: when you reach him, and when you walk on. */
  from: number;
  to: number;
  /** The last stop is the substitute on the touchline. */
  sub: boolean;
}

export interface OvationPlan {
  stops: OvationStop[];
  /** Seconds: the whole scene, from the first step to the fade. */
  end: number;
  /** When you cross the touchline and the substitute runs on. */
  offAt: number;
}

export const OVATION = {
  startZ: -8,
  lineZ: 6.6,
  /** You walk slowly: it is a goodbye, not a substitution. */
  speed: 1.15,
  /** A short beat before the first step, the ground already on its feet. */
  walkFrom: 1.2,
  /** Seconds you stop for each greeting. */
  hold: { hug: 1.7, dap: 1.3, pat: 1.3 } as Record<Greeting, number>,
  /** Where the well-wishers wait, in order along your path. */
  stopZ: [-5.2, -2.4, 0.4, 3.1],
  /** The substitute waits a step inside the line. */
  subZ: 5.8,
  /** After you are off: the substitute runs on, you walk to the bench. */
  tail: 2.6,
  /** How far beyond the line you walk before the scene ends. */
  offBy: 2.2,
  /** The camera: one full circle over the scene, this far out, this high. */
  camRadius: 4.4,
  camHeight: 1.7,
  /** The camera starts in front of you, a little to one side. */
  camStart: 0.35,
} as const;

/** Who greets you, and how: two team-mates and two rivals, then the sub. */
export function ovationPlan(mates: OvationPerson[], rivals: OvationPerson[], sub: OvationPerson | null): OvationPlan {
  // Alternate: a team-mate, a rival, a team-mate, a rival. A side with
  // nobody left gives its place to the other.
  const m = mates.slice(0, 2), r = rivals.slice(0, 2);
  const order: OvationPerson[] = [];
  for (let i = 0; i < 2; i++) {
    if (m[i]) order.push(m[i]);
    if (r[i]) order.push(r[i]);
  }
  const people = order.slice(0, OVATION.stopZ.length);
  // A team-mate hugs you, a rival daps you up, the second team-mate pats
  // your back, the second rival daps you up too: the mix stays the same.
  const kinds: Greeting[] = [];
  let mateN = 0, rivalN = 0;
  for (const p of people) {
    if (p.team === "ours") kinds.push(mateN++ === 0 ? "hug" : "pat");
    else kinds.push(rivalN++ === 0 ? "dap" : "dap");
  }

  const stops: OvationStop[] = [];
  let t: number = OVATION.walkFrom;
  let z: number = OVATION.startZ;
  const walkTo = (toZ: number) => { t += Math.max(0, toZ - z) / OVATION.speed; z = toZ; };
  people.forEach((who, i) => {
    walkTo(OVATION.stopZ[i]);
    const kind = kinds[i];
    stops.push({ who, kind, z, side: i % 2 === 0 ? -1 : 1, from: t, to: t + OVATION.hold[kind], sub: false });
    t += OVATION.hold[kind];
  });
  if (sub) {
    walkTo(OVATION.subZ);
    stops.push({ who: sub, kind: "hug", z, side: 1, from: t, to: t + OVATION.hold.hug, sub: true });
    t += OVATION.hold.hug;
  }
  walkTo(OVATION.lineZ);
  const offAt = t;
  walkTo(OVATION.lineZ + OVATION.offBy);
  return { stops, end: Math.max(t, offAt + OVATION.tail), offAt };
}

/** Where you are at time t (metres along your path), and which stop you are at. */
export function youAt(plan: OvationPlan, t: number): { z: number; stop: OvationStop | null; walking: boolean } {
  if (t <= OVATION.walkFrom) return { z: OVATION.startZ, stop: null, walking: false };
  let z: number = OVATION.startZ;
  let clock: number = OVATION.walkFrom;
  const legs: { toZ: number; stop: OvationStop | null }[] = [
    ...plan.stops.map(s => ({ toZ: s.z, stop: s })),
    { toZ: OVATION.lineZ + OVATION.offBy, stop: null },
  ];
  for (const leg of legs) {
    const walkTime = Math.max(0, leg.toZ - z) / OVATION.speed;
    if (t < clock + walkTime) return { z: z + (t - clock) * OVATION.speed, stop: null, walking: true };
    clock += walkTime;
    z = leg.toZ;
    if (leg.stop) {
      if (t < leg.stop.to) return { z, stop: leg.stop, walking: false };
      clock = leg.stop.to;
    }
  }
  return { z, stop: null, walking: false };
}

/** 0 → 1 → 0 over a stop: how far into the greeting the two of you are. */
export function greetWeight(stop: OvationStop, t: number): number {
  const d = stop.to - stop.from;
  const k = (t - stop.from) / d;
  if (k <= 0 || k >= 1) return 0;
  const inn = Math.min(1, k / 0.28), out = Math.min(1, (1 - k) / 0.22);
  const w = Math.min(inn, out);
  return w * w * (3 - 2 * w);
}

/** The camera's angle round you (radians; 0 = in front, looking back at you). */
export function cameraAngle(plan: OvationPlan, t: number): number {
  const k = Math.max(0, Math.min(1, t / plan.end));
  // Ease in and out so the circle starts and ends gently.
  const e = k * k * (3 - 2 * k);
  return OVATION.camStart + e * Math.PI * 2;
}

/** The line under the picture while a greeting happens. */
export function greetingCaption(stop: OvationStop): string {
  const n = stop.who.name;
  if (stop.sub) return `${n} comes on. A hug on the line.`;
  if (stop.kind === "hug") return `${n} wraps you in a hug.`;
  if (stop.kind === "pat") return `${n}: a pat on the back.`;
  return stop.who.team === "rivals" ? `${n} daps you up. Respect.` : `${n} daps you up.`;
}
