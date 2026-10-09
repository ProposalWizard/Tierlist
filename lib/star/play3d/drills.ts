/**
 * THE 3D TRAINING DRILLS — one list. The training gate's picker reads it,
 * "Random drill" picks from it, the dev page opens any of it.
 *
 * Adding a drill (Headers & Volleys, Wembley …):
 *   1. write its rules as a `Rules` on a `World` (./world.ts) in its own file,
 *      like ./twoTouch.ts or ./freeRoam.ts — scoring, restarts, any special
 *      touch (Rules.onReach / onAction) or brain (Rules.brain);
 *   2. give it a `start` here returning a DrillSession (HUD lines, result);
 *   3. flip its status to "ready".
 * The screen (components/star/Play3D.tsx) and the 3D picture
 * (./scene.ts) need nothing new unless the drill wants a new camera.
 */
import type { Rng } from "./rng";
import type { Action3, World } from "./world";
import { makeFreeRoam, freeRoamReward, freeRoamScore, FREE_ROAM_TARGET, type Person3 } from "./freeRoam";
import { makeTwoTouch, twoTouchReward, TWO_TOUCH_RALLIES, TWO_TOUCH_TARGET } from "./twoTouch";
import { makeWembley, wembleyLeave, wembleyPlace, wembleyPlayers, wembleyReward, wembleyWatch, ordinal, type WembleyMode } from "./wembley";
import { makeHeadersVolleys, hvReward, crossWord, HV_CROSSES, HV_TARGET, HV_POINTS } from "./headersVolleys";
import { makePaceDrill, paceCountdown, kmhText, PACE_DISTANCE, STAR_SLACK } from "./paceDrill";

export type DrillId = "crossbar" | "two-touch" | "free-roam" | "headers-volleys" | "wembley" | "pace";

/** A drill that trains a skill: the level played and its stars (the career banks them, lib/star/trainingLevels.ts applyLevelResult). */
export interface DrillTrain { skill: "pace"; level: number; stars: number }

export interface DrillContext {
  seed: number;
  you: Person3;
  /** Real team-mates from the career squad (best first is fine). */
  mates: Person3[];
  keeperOverall?: number;
  /** Every outfielder in the career squad, with positions (a drill picks its own: Headers & Volleys' full-backs). */
  squad?: Person3[];
  /** The mode picked on the picker row (Wembley: "normal" | "doubles"). */
  mode?: string;
  /** The pre-screen's choices (Wembley: count). */
  options?: Record<string, string>;
  /** The pace level to run (your next one: the first with no star). */
  paceLevel?: number;
  /** How many points this many stars on this level would add to the skill now (for the result line). */
  previewTrain?(t: DrillTrain): number;
}

/** One row on the HUD's roster (who's safe, who's still to score, who's out). */
export interface RosterLine { name: string; state: "safe" | "todo" | "out"; you?: boolean }

export interface DrillSession {
  world: World;
  /** "chase": behind you, turning with you. "pair": side-on, you and your partner both in shot. */
  camera: "chase" | "pair";
  /** One line, on screen while playing. */
  hint: string;
  /** The same line for a mouse and keyboard (a fine pointer: Play3D picks by pointer type, not screen width). Unset: `hint` for both. */
  hintKeys?: string;
  /** Extra buttons beyond tap / drag (e.g. "Send it back"). Read every frame, so a drill can change them. */
  buttons?: { label: string; action?: Action3; onPress?: () => void }[];
  /** Every side in its own training bib (Wembley). */
  bibs?: boolean;
  /**
   * The scoreboard: a big number, a line under it, seconds left if timed;
   * optional: a big banner (SAFE! / OUT), a roster (who's through), a second line.
   */
  hud(): {
    big: string; small: string; timeLeft?: number; flash?: string;
    banner?: { text: string; tone: "good" | "bad" | "info" } | null;
    roster?: RosterLine[];
    note?: string;
  };
  done(): boolean;
  /** The Team bar move, the crossbar's way (relationships.ts gameReward). */
  result(team: number, roll: number): { won: boolean; gain: number; line: string; train?: DrillTrain };
}

/** A choice on the pre-screen (Wembley: how many players). */
export interface DrillOption { key: string; label: string; choices: { value: string; label: string }[]; default: string }

export interface DrillDef {
  id: DrillId;
  name: string;
  blurb: string;
  status: "ready" | "soon";
  /** Picked on the picker row itself (Wembley: Normal / Doubles). The first is the default (Random). */
  modes?: { id: string; label: string }[];
  /** Asked on a pre-screen before it starts. */
  options?(mode?: string): DrillOption[];
  /** "engine": your shots on the 2D match engine (the crossbar). "play3d": the 3D engine here. */
  kind: "engine" | "play3d";
  start?(ctx: DrillContext): DrillSession;
}

export const DRILLS: DrillDef[] = [
  { id: "crossbar", name: "Crossbar Challenge", blurb: "Five shots each at the bar. A post doesn't count.", status: "ready", kind: "engine" },
  {
    id: "two-touch", name: "Two Touch", blurb: "Keep it up between you. Two touches each, then send it back.", status: "ready", kind: "play3d",
    start(ctx) {
      const mate = ctx.mates[0] ?? { id: "mate", name: "Team-mate", skills: { overall: 65, pace: 65, power: 65, technique: 65 } };
      const { world, state } = makeTwoTouch({ seed: ctx.seed, you: ctx.you, mate });
      return {
        world, camera: "pair",
        hint: "Tap as the ball drops to your foot: 1st tap controls it up, 2nd sends it back.",
        buttons: [{ label: "Send it back first time", action: { kind: "pass" } }],
        hud: () => ({ big: `${state.rally}`, small: `Rally · best ${state.longest} · ${state.ralliesLeft} of ${TWO_TOUCH_RALLIES} left`, flash: state.last }),
        done: () => state.over,
        result(team, roll) {
          const r = twoTouchReward(state, team, roll);
          return { ...r, line: `Longest rally with ${mate.name}: ${state.longest} (${TWO_TOUCH_TARGET} wins it).` };
        },
      };
    },
  },
  {
    id: "free-roam", name: "Free Roam", blurb: "Half a pitch, a keeper and two team-mates. Pass, get it back, score.", status: "ready", kind: "play3d",
    start(ctx) {
      const { world, state } = makeFreeRoam({ seed: ctx.seed, you: ctx.you, mates: ctx.mates.slice(0, 2), keeperOverall: ctx.keeperOverall });
      return {
        world, camera: "chase",
        hint: "Left thumb: move (push the stick all the way to sprint). Tap a team-mate to pass to him (or tap anywhere: the white ring shows who). Drag back and let go: shoot.",
        hintKeys: "WASD or arrows: move. Hold Shift to sprint. Space or click a team-mate: pass. Drag back with the mouse and let go: shoot.",
        hud: () => ({ big: `${freeRoamScore(state)}`, small: `${state.goals} goals · ${state.cleanPasses} clean passes`, timeLeft: state.timeLeft, flash: state.last }),
        done: () => state.over,
        result(team, roll) {
          const r = freeRoamReward(state, team, roll);
          return { won: r.won, gain: r.gain, line: `${state.goals} goals and ${state.cleanPasses} clean passes: ${r.score} (${FREE_ROAM_TARGET} wins it).` };
        },
      };
    },
  },
  {
    id: "headers-volleys", name: "Headers & Volleys", blurb: "Your full-backs cross it in. Head it (2), volley it (3), or finish first time (1). Ten crosses.", status: "ready", kind: "play3d",
    start(ctx) {
      const pick = (want: string[], not?: string) => (ctx.squad ?? []).find((p) => want.includes(p.position ?? "") && p.id !== not);
      const fallback = (i: number): Person3 => ctx.mates[i] ?? { id: `fb${i}`, name: i ? "Right back" : "Left back", skills: { overall: 65, pace: 65, power: 65, technique: 65 } };
      const lb = pick(["LB", "LWB"]) ?? fallback(0);
      const rb = pick(["RB", "RWB"], lb.id) ?? (fallback(1).id === lb.id ? fallback(0) : fallback(1));
      const { world, state } = makeHeadersVolleys({ seed: ctx.seed, you: ctx.you, leftBack: lb, rightBack: rb, keeperOverall: ctx.keeperOverall });
      return {
        world, camera: "chase", bibs: true,
        hint: "Run to the yellow ring. Drag back and let go as it arrives (or tap): head it, volley it, or hit it first time.",
        hud: () => ({
          big: `${state.points}`,
          small: `Points · cross ${Math.min(state.cross, HV_CROSSES)} of ${HV_CROSSES} · ${state.goals} goals`,
          flash: state.last,
          note: state.phase === "setup" || state.phase === "flight" ? crossWord(state.kind) : undefined,
        }),
        done: () => state.over,
        result(team, roll) {
          const r = hvReward(state, team, roll);
          return { ...r, line: `${state.points} points: ${state.headerGoals} headers (${HV_POINTS.header} each), ${state.volleyGoals} volleys (${HV_POINTS.volley}), ${state.otherGoals} others (${HV_POINTS.other}). ${HV_TARGET} wins it.` };
        },
      };
    },
  },
  {
    id: "wembley", name: "Wembley", blurb: "Free for all at one goal. Score and you're through; the last man without a goal is out.", status: "ready", kind: "play3d",
    modes: [{ id: "normal", label: "Normal" }, { id: "doubles", label: "Doubles" }],
    options(mode) {
      return mode === "doubles"
        ? [{ key: "count", label: "Pairs", choices: [{ value: "2", label: "2 pairs (4)" }, { value: "3", label: "3 pairs (6)" }], default: "2" }]
        : [{ key: "count", label: "Players", choices: ["3", "4", "5", "6"].map((v) => ({ value: v, label: v })), default: "4" }];
    },
    start(ctx) {
      const mode: WembleyMode = ctx.mode === "doubles" ? "doubles" : "normal";
      const count = Number(ctx.options?.count ?? (mode === "doubles" ? 2 : 4));
      const { world, state } = makeWembley({ seed: ctx.seed, mode, count, you: ctx.you, mates: ctx.mates, keeperOverall: ctx.keeperOverall });
      const nMen = wembleyPlayers(mode, count);
      const session: DrillSession = {
        world, camera: "chase", bibs: true,
        hint: "Left thumb: move. Tap: tackle / pass. Drag back and let go: shoot. Score to go through.",
        get buttons() {
          if (state.over) return [];
          if (state.youOut && !state.watching) return [
            { label: "Watch to the end", onPress: () => wembleyWatch(world, state) },
            { label: "Leave", onPress: () => wembleyLeave(world, state) },
          ];
          if (state.watching) return [{ label: "Leave", onPress: () => wembleyLeave(world, state) }];
          return [];
        },
        hud: () => {
          const you = state.units.find((u) => u.you)!;
          const left = state.units.filter((u) => !u.out).length;
          return {
            big: `R${state.round}`,
            small: `${mode === "doubles" ? "Wembley doubles" : "Wembley"} · ${left} ${mode === "doubles" ? "pairs" : "left"} of ${state.units.length}${state.watching ? " · watching ×3" : ""}`,
            flash: state.last,
            banner: state.banner && world.t < state.banner.until ? state.banner : null,
            roster: state.units.map((u) => ({ name: u.name, state: u.out ? "out" : u.safe ? "safe" : "todo", you: u.you })),
            note: state.valveLine || (you.out ? `You finished ${ordinal(you.place ?? nMen)}` : ""),
          };
        },
        done: () => state.over,
        result(team, roll) {
          const r = wembleyReward(state, team, roll);
          const place = wembleyPlace(state);
          const of = state.units.length;
          return { won: r.won, gain: r.gain, line: place === 1 ? `You won Wembley${mode === "doubles" ? " with your partner" : ""} (${of} ${mode === "doubles" ? "pairs" : "players"}).` : `You finished ${ordinal(place)} of ${of}${state.left ? " (left early)" : ""}.` };
        },
      };
      return session;
    },
  },
  {
    id: "pace", name: "Pace Sprint", blurb: "30 metres flat out with a defender on your shoulder. Your time earns pace stars.", status: "ready", kind: "play3d",
    start(ctx) {
      const def = ctx.squad?.find((p) => ["CB", "LB", "RB"].includes(p.position ?? "")) ?? ctx.mates[0];
      const { world, state } = makePaceDrill({ seed: ctx.seed, you: ctx.you, level: ctx.paceLevel, chaser: def ? { id: def.id, name: def.name, photo: def.photo } : undefined });
      const starLine = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);
      return {
        world, camera: "chase", bibs: true,
        hint: "Push the stick all the way up to sprint (hold it ready before GO). Run straight for the yellow line. Don't let him catch you.",
        hintKeys: "Hold W (or ↑) and hold Shift to sprint (hold them ready before GO). Run straight for the yellow line. Don't let him catch you.",
        hud: () => {
          const cd = paceCountdown(world);
          const t3 = state.target + STAR_SLACK[0];
          return {
            big: `${state.time.toFixed(2)}`,
            small: `Top speed ${kmhText(state.topSpeed)} · level ${state.level} · 3★ under ${t3.toFixed(2)} s`,
            note: cd ? "" : (state.finished ? `${starLine(state.stars)} · ${PACE_DISTANCE} m in ${state.time.toFixed(2)} s` : ""),
            banner: cd && cd !== "GO!" ? { text: cd, tone: "info" } : cd === "GO!" ? { text: "GO!", tone: "good" } : state.caught ? { text: state.last, tone: "bad" } : state.finished ? { text: starLine(state.stars), tone: "good" } : null,
          };
        },
        done: () => state.over,
        result() {
          const train: DrillTrain = { skill: "pace", level: state.level, stars: state.caught ? 0 : state.stars };
          const plus = ctx.previewTrain?.(train) ?? 0;
          const head = state.caught ? `${state.chaserName} caught you` : `${PACE_DISTANCE} m in ${state.time.toFixed(2)} s`;
          const pace = plus > 0 ? ` Pace +${plus}.` : train.stars > 0 ? " No new stars on this level." : "";
          return { won: train.stars > 0, gain: 0, train, line: `${head} · top speed ${kmhText(state.topSpeed)} · level ${state.level} ${starLine(train.stars)}.${pace}` };
        },
      };
    },
  },
];

export function drillById(id: string): DrillDef | undefined { return DRILLS.find((d) => d.id === id); }

/** "Random drill": any ready one, evenly. */
export function pickRandomDrill(rng: Rng): DrillDef {
  const ready = DRILLS.filter((d) => d.status === "ready");
  return ready[Math.floor(rng() * ready.length) % ready.length];
}

