/**
 * WHAT THE SCREEN SHOWS FOR THE TEN NEW GAMES (gym phase 2): one meter each, as plain numbers, so the screen
 * (components/star/GymHud.tsx) only draws and the test can read it. Pure.
 *
 *   meter     a bar, upright or across: the marker (0..1), a zone (green, gold) and the danger end (red)
 *   dots      marks travelling along the meter (the ladder's rungs, the line to trace ahead, the push-up beats)
 *   ring      a ring closing on the target (the beat, the landing): 1 wide open, 0 on the target
 *   bar2      a second small bar under the meter (grip left, the shake, your hamstrings, the hold)
 *   big       the count in the title ("4/10", "12 s")
 *   cue       the one word under the meter ("PULL", "LET GO", "ON THE BEAT")
 *   flash     the moment's word ("Rep 3", "Too deep!") and its colour; `age` how long ago
 */
import type { Gym2State } from "./games2";
import { PULLUP, SQUAT, NORDIC, COPEN, BOXJUMP, LADDER, LANDING, MOBILITY, pushupBeat, boxjumpPeriod, mobilityPath, PUSHUP, PLANK } from "./games2";

export interface HudView {
  meter?: { vertical: boolean; marker: number; zone?: [number, number]; zoneColour?: string; danger?: "low" | "high" };
  dots?: number[];
  ring?: number;
  bar2?: { share: number; colour: string; label: string };
  big: string;
  cue: string;
  flash?: { text: string; colour: string; age: number };
}

const G = "rgba(34,197,94,.8)", GOLD = "rgba(250,204,21,.9)", RED = "#ef4444", AMBER = "#f59e0b", OK = "#86efac", PINK = "#f472b6";
const f = (text: string, colour: string, age: number) => ({ text, colour, age });

export function hudView(g: Gym2State): HudView {
  const fl = g.flash;
  switch (g.kind) {
    case "pullup": {
      const v: HudView = { meter: { vertical: true, marker: g.y, zone: [0.94, 1], zoneColour: GOLD }, bar2: { share: g.grip, colour: g.grip > 0.4 ? OK : g.grip > 0.2 ? AMBER : RED, label: "GRIP" }, big: `${g.reps}/${PULLUP.reps}`, cue: g.phase === "up" ? "TAP TO PULL" : "DROP TO A DEAD HANG" };
      if (fl.what === "rep") v.flash = f(`Rep ${g.reps}`, "#facc15", fl.age);
      if (fl.what === "drop") v.flash = f("Lost your grip!", RED, fl.age);
      return v;
    }
    case "squat": {
      const v: HudView = { meter: { vertical: true, marker: 1 - g.d, zone: [1 - (SQUAT.band + g.half), 1 - (SQUAT.band - g.half)], zoneColour: G, danger: "low" }, big: `${g.reps}/${SQUAT.reps}`, cue: g.phase === "down" ? "LET GO IN THE GREEN" : g.phase === "top" ? "HOLD TO SINK" : "DRIVE UP", bar2: { share: g.strikes / SQUAT.strikesOut, colour: RED, label: "STUCK" } };
      const w: Record<string, [string, string]> = { perfect: ["Spot on!", "#facc15"], good: ["Depth ✓", OK], shallow: ["Half rep", AMBER], deep: ["Too deep!", RED], stuck: ["Stuck in the hole!", RED] };
      if (fl.what && w[fl.what]) v.flash = f(w[fl.what][0], w[fl.what][1], fl.age);
      return v;
    }
    case "pushup": {
      const gap = pushupBeat(g.t);
      const v: HudView = { ring: Math.max(0, Math.min(1, (g.next - g.t) / gap)), big: `${g.perfect + g.good}`, cue: "TAP ON THE BEAT", bar2: { share: Math.min(1, g.t / PUSHUP.secs), colour: "#60a5fa", label: `RUN ${g.combo}` } };
      const w: Record<string, [string, string]> = { perfect: ["Perfect", "#facc15"], good: ["Good", OK], miss: ["Missed", AMBER], off: ["Off the beat", AMBER], flat: ["Flat on the mat!", RED] };
      if (fl.what && w[fl.what]) v.flash = f(w[fl.what][0], w[fl.what][1], fl.age);
      return v;
    }
    case "plank": {
      const v: HudView = { meter: { vertical: false, marker: g.shake, zone: [0, 0.75], zoneColour: G, danger: "high" }, big: `${Math.floor(g.braced)} s`, cue: g.prev ? (g.shake > 0.75 ? "BREATHE: LET GO, QUICKLY" : "HOLD TO BRACE") : g.off > PLANK.breath * 0.6 ? "BRACE NOW!" : "BREATHE…", bar2: { share: Math.min(1, g.sag), colour: AMBER, label: "HIPS" } };
      const w: Record<string, [string, string]> = { breath: ["Breathe ✓", OK], sag: ["Hips dropped!", RED], collapse: ["Collapsed!", RED] };
      if (fl.what && w[fl.what]) v.flash = f(w[fl.what][0], w[fl.what][1], fl.age);
      return v;
    }
    case "nordic": {
      const tempo = Math.min(1, g.v / (NORDIC.crash * 1.05));
      const v: HudView = { meter: { vertical: true, marker: 1 - g.a }, bar2: { share: tempo, colour: g.v > NORDIC.safe ? (g.v > NORDIC.crash * 0.85 ? RED : AMBER) : OK, label: `LEGS ${Math.round(g.ham * 100)}%` }, big: `${g.reps}/${NORDIC.reps}`, cue: g.phase === "down" ? (g.v > NORDIC.safe ? "BRAKE!" : "LOWER SLOWLY") : "BACK UP" };
      const w: Record<string, [string, string]> = { clean: ["Under control ✓", OK], rep: ["Bit quick", AMBER], crash: ["Collapsed!", RED] };
      if (fl.what && w[fl.what]) v.flash = f(w[fl.what][0], w[fl.what][1], fl.age);
      return v;
    }
    case "copenhagen": {
      const v: HudView = { meter: { vertical: true, marker: g.h, zone: [COPEN.lo, COPEN.hi], zoneColour: G, danger: "low" }, big: g.swapping > 0 ? "Swap" : `${g.side ? "Right" : "Left"} ${Math.max(0, Math.ceil(COPEN.side - g.sideT))} s`, cue: g.swapping > 0 ? "OTHER SIDE" : "HOLD TO LIFT YOUR HIPS", bar2: { share: Math.min(1, g.drops / 3), colour: RED, label: "DROPS" } };
      if (fl.what === "drop") v.flash = f("Hips dropped!", RED, fl.age);
      if (fl.what === "swap") v.flash = f("Other side", "#e2e8f0", fl.age);
      return v;
    }
    case "boxjump": {
      const [g0, g1] = BOXJUMP.gold;
      const v: HudView = { meter: { vertical: false, marker: g.phase === "ready" ? g.needle : g.power, zone: [g0, g1], zoneColour: GOLD }, big: `${g.jumps}/${BOXJUMP.jumps}`, cue: g.phase === "ready" ? "TAP IN THE GOLD" : "…", bar2: { share: (g.height + 1) / 3, colour: PINK, label: `BOX ${g.height + 1}` } };
      const w: Record<string, [string, string]> = { gold: ["Stuck it!", "#facc15"], short: ["Just made it", AMBER], over: ["Overcooked it", AMBER], clip: ["Clipped the box!", RED] };
      if (fl.what && w[fl.what]) v.flash = f(w[fl.what][0], w[fl.what][1], fl.age);
      void boxjumpPeriod;
      return v;
    }
    case "ladder": {
      // the rungs coming at you: 1 = far (LADDER.lead s away), 0 = at your feet
      const dots = g.rungs.map((r) => (r - g.t) / LADDER.lead).filter((d) => d > -0.1 && d <= 1);
      const v: HudView = { meter: { vertical: false, marker: 0, zone: [0, 0.07], zoneColour: G }, dots, big: `${g.hit}`, cue: "TAP AS EACH RUNG REACHES YOU", bar2: { share: Math.min(1, g.combo / 20), colour: "#60a5fa", label: `RUN ${g.combo}` } };
      const w: Record<string, [string, string]> = { perfect: ["Perfect", "#facc15"], miss: ["Missed", AMBER], off: ["Too early", AMBER], trip: ["Tripped!", RED] };
      if (fl.what && w[fl.what]) v.flash = f(w[fl.what][0], w[fl.what][1], fl.age);
      return v;
    }
    case "landing": {
      const v: HudView = { big: `${g.stuck + g.soft}/${LANDING.hops}`, cue: g.phase === "ready" ? "TAP TO HOP" : g.phase === "air" ? "TAP AS THE RING CLOSES" : g.phase === "still" ? "HOLD STILL" : "…" };
      if (g.phase === "air") v.ring = Math.max(0, 1 - g.phaseT / LANDING.air);
      if (g.phase === "still") v.bar2 = { share: Math.min(1, g.held / LANDING.still), colour: g.wobble > 0.5 ? AMBER : OK, label: "HOLD" };
      const w: Record<string, [string, string]> = { stuck: ["Stuck it!", "#facc15"], soft: ["Bit soft", AMBER], heavy: ["Heavy landing!", RED], wobble: ["Wobbled off", AMBER], held: ["Held ✓", OK], "held-soft": ["Held", OK] };
      if (fl.what && w[fl.what]) v.flash = f(w[fl.what][0], w[fl.what][1], fl.age);
      return v;
    }
    case "mobility": {
      // the line ahead: where it will be over the next 2 s (drawn as dots up the meter's side)
      const ahead = [0, 0.4, 0.8, 1.2, 1.6, 2.0].map((dt) => mobilityPath(g.seed, g.t + dt));
      const half = MOBILITY.half + 0.01 * (g.level - 1), c = ahead[0];
      const v: HudView = { meter: { vertical: true, marker: g.y, zone: [c - half, c + half], zoneColour: "rgba(167,139,250,.8)" }, dots: ahead.slice(1), big: `${Math.ceil(Math.max(0, MOBILITY.secs - g.t))} s`, cue: "STAY IN THE LINE", bar2: { share: Math.min(1, g.out / MOBILITY.outMax), colour: RED, label: "STRAIN" } };
      if (fl.what === "pulled") v.flash = f("Felt that pull!", RED, fl.age);
      return v;
    }
  }
}
