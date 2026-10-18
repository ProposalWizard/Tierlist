/**
 * REAL GOALS — a little game made of real goals (TEST PAGE ONLY,
 * /star-real-goals-dev). Leo, 18 Oct 2026: "we should one HUNDRED percent have
 * a real shots mode … u gotta try get 100% accuracy from real irl goal … maybe
 * like score hero system of going up the levels getting harder and stars".
 *
 * Every non-penalty goal of the 2022 World Cup and Euro 2024 that StatsBomb's
 * free data has a freeze frame for (250), with the extra facts in
 * data/statsbomb/goals.json (scripts/statsbomb/fetch_real_goals.py): the score
 * before it, the height it went in at, every frozen man's name, the whole move.
 *
 * Pure: no React, no canvas. tests/star/realGoals.mts checks it.
 * The licence for a paid game is not cleared, so nothing in the real game
 * imports this file (the test greps for it).
 *
 * Data: StatsBomb open data (https://github.com/statsbomb/open-data)
 */
import type { Scenario, Vec2 } from "./canvasEngine";
import type { Kit } from "./kits";
import type { LeadBallKey } from "./leadIn";
import { ballAlong } from "./leadIn";
import type { RealGoalView, RealGoalGhost } from "./realGoalView";
import {
  sbToPitch, peopleOf, blockersOf, scenarioForShot,
  type SbShot, type SbLeadin, type SbPass,
} from "./statsbombShots";
import { CX, POST_L, POST_R } from "./pitch";

// ─────────────────────────────────────────────────────────────────────────
//  THE DATA
// ─────────────────────────────────────────────────────────────────────────

/** One action of the move: [seconds before the shot, P/C/D, from, to | null, player, recipient | null, height 0-2]. */
export type RgMoveEv = [number, "P" | "C" | "D", [number, number], [number, number] | null, string, string | null, number];

/** The extra facts for one goal (goals.json). */
export interface RgExtra {
  id: string;
  matchId: number;
  comp: string;
  home: string;
  away: string;
  stage: string;
  date: string;
  final: [number, number];
  /** The score just before the goal, [home, away]. */
  score: [number, number];
  /** The height it crossed the line at, in StatsBomb yards. */
  endZ: number | null;
  /** The freeze frame's names and positions, in shots.json's ff order. */
  names: string[];
  pos: string[];
  shooterPos: string;
  period: number;
  second: number;
  /** The shot's own flight time, seconds. */
  dur: number | null;
  move: RgMoveEv[];
  /** Full name → [the name he is known by, shirt number]. */
  known?: Record<string, [string, number | null]>;
}

export interface RgFile { credit: string; goals: RgExtra[] }

export interface RealGoal {
  id: string;
  shot: SbShot;
  x: RgExtra;
}

/** The goals the page plays: open play and free kicks, with their extra facts. */
export function joinGoals(shots: SbShot[], extras: RgExtra[]): RealGoal[] {
  const by = new Map(extras.map((e) => [e.id, e]));
  const out: RealGoal[] = [];
  for (const s of shots) {
    if (s.outcome !== "Goal" || s.type === "Penalty") continue;
    const x = by.get(s.id);
    if (x) out.push({ id: s.id, shot: s, x });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
//  NAMES
// ─────────────────────────────────────────────────────────────────────────

const PARTICLES = new Set(["di", "de", "van", "von", "da", "dos", "das", "mac", "el", "al", "ter", "le", "la", "del", "der"]);

/** The name he is known by ("Kylian Mbappé Lottin" → "Kylian Mbappé"). */
export function knownAs(g: RealGoal, full: string): string {
  return g.x.known?.[full]?.[0] ?? full;
}

/** The short name for a shirt ("Kylian Mbappé" → "Mbappé", "Ángel Di María" → "Di María", "Neymar" → "Neymar"). */
export function shortNameOf(known: string): string {
  const w = known.trim().split(/\s+/);
  if (w.length <= 1) return w[0] ?? "";
  const prev = w[w.length - 2];
  if (PARTICLES.has(prev.toLowerCase())) return `${prev[0].toUpperCase()}${prev.slice(1)} ${w[w.length - 1]}`;
  return w[w.length - 1];
}

export const scorerShort = (g: RealGoal) => shortNameOf(knownAs(g, g.shot.player));

/** The side that conceded. */
export const concededBy = (g: RealGoal) => (g.x.home === g.shot.team ? g.x.away : g.x.home);

/** "Argentina 2-1 France" — the score just before the goal, as a scoreboard reads it. */
export function scoreBefore(g: RealGoal): string {
  return `${g.x.home} ${g.x.score[0]}-${g.x.score[1]} ${g.x.away}`;
}

/** The minute as a match clock shows it (StatsBomb's minute is the minute already played). */
export const minuteOf = (g: RealGoal) => g.shot.minute + 1;

export function compBadge(g: RealGoal): string {
  return g.x.comp.startsWith("World Cup") ? "WC" : "EURO";
}

// ─────────────────────────────────────────────────────────────────────────
//  THE NATIONAL KITS — the ~44 sides in the data (home, change)
// ─────────────────────────────────────────────────────────────────────────

const k = (shirt: string, trim: string): Kit => ({ shirt, trim });
export const NATION_KITS: Record<string, { home: Kit; away: Kit }> = {
  Albania: { home: k("#d7141a", "#111111"), away: k("#111111", "#d7141a") },
  Argentina: { home: k("#75aadb", "#ffffff"), away: k("#3b2a6b", "#75aadb") },
  Australia: { home: k("#ffc72c", "#00843d"), away: k("#00843d", "#ffc72c") },
  Austria: { home: k("#e30613", "#ffffff"), away: k("#ffffff", "#e30613") },
  Belgium: { home: k("#c8102e", "#111111"), away: k("#f4f1ea", "#e86a10") },
  Brazil: { home: k("#ffdc02", "#009c3b"), away: k("#1d3f94", "#ffdc02") },
  Cameroon: { home: k("#007a3d", "#ce1126"), away: k("#fcd116", "#007a3d") },
  Canada: { home: k("#d52b1e", "#111111"), away: k("#ffffff", "#d52b1e") },
  "Costa Rica": { home: k("#c8102e", "#002b7f"), away: k("#ffffff", "#c8102e") },
  Croatia: { home: k("#e8323c", "#ffffff"), away: k("#0b1f4b", "#e8323c") },
  "Czech Republic": { home: k("#d7141a", "#11457e"), away: k("#ffffff", "#11457e") },
  Denmark: { home: k("#c8102e", "#ffffff"), away: k("#ffffff", "#c8102e") },
  Ecuador: { home: k("#ffdd00", "#034ea2"), away: k("#034ea2", "#ffdd00") },
  England: { home: k("#ffffff", "#1b2a5c"), away: k("#c8102e", "#1b2a5c") },
  France: { home: k("#1f2a6b", "#ffffff"), away: k("#ffffff", "#1f2a6b") },
  Georgia: { home: k("#ffffff", "#da291c"), away: k("#da291c", "#ffffff") },
  Germany: { home: k("#ffffff", "#111111"), away: k("#d6338c", "#6b2d7c") },
  Ghana: { home: k("#ffffff", "#111111"), away: k("#ce1126", "#fcd116") },
  Hungary: { home: k("#c8102e", "#436f4d"), away: k("#ffffff", "#c8102e") },
  Iran: { home: k("#ffffff", "#da0000"), away: k("#da0000", "#ffffff") },
  Italy: { home: k("#1a5fb4", "#ffffff"), away: k("#ffffff", "#1a5fb4") },
  Japan: { home: k("#0b2a7a", "#ffffff"), away: k("#ffffff", "#0b2a7a") },
  Mexico: { home: k("#006847", "#ffffff"), away: k("#ffffff", "#006847") },
  Morocco: { home: k("#c1272d", "#006233"), away: k("#ffffff", "#c1272d") },
  Netherlands: { home: k("#f36c21", "#1b1b5e"), away: k("#1b1b5e", "#f36c21") },
  Poland: { home: k("#ffffff", "#dc143c"), away: k("#dc143c", "#ffffff") },
  Portugal: { home: k("#b5121b", "#006600"), away: k("#f2f2f2", "#b5121b") },
  Qatar: { home: k("#8a1538", "#ffffff"), away: k("#ffffff", "#8a1538") },
  Romania: { home: k("#fcd116", "#002b7f"), away: k("#002b7f", "#fcd116") },
  "Saudi Arabia": { home: k("#ffffff", "#006c35"), away: k("#006c35", "#ffffff") },
  Scotland: { home: k("#0b2a5b", "#ffffff"), away: k("#ffffff", "#0b2a5b") },
  Senegal: { home: k("#ffffff", "#00853f"), away: k("#00853f", "#fdef42") },
  Serbia: { home: k("#c6363c", "#0c4076"), away: k("#ffffff", "#c6363c") },
  Slovakia: { home: k("#0b4ea2", "#ffffff"), away: k("#ffffff", "#0b4ea2") },
  Slovenia: { home: k("#ffffff", "#005da4"), away: k("#005da4", "#7ac143") },
  "South Korea": { home: k("#c8102e", "#111111"), away: k("#111111", "#c8102e") },
  Spain: { home: k("#c60b1e", "#ffc400"), away: k("#8fc7e8", "#0b2a5b") },
  Switzerland: { home: k("#d52b1e", "#ffffff"), away: k("#ffffff", "#d52b1e") },
  Tunisia: { home: k("#e70013", "#ffffff"), away: k("#ffffff", "#e70013") },
  Turkey: { home: k("#ffffff", "#e30a17"), away: k("#e30a17", "#ffffff") },
  Ukraine: { home: k("#ffd500", "#005bbb"), away: k("#005bbb", "#ffd500") },
  "United States": { home: k("#ffffff", "#0a3161"), away: k("#0a3161", "#b31942") },
  Uruguay: { home: k("#5cbfeb", "#111111"), away: k("#ffffff", "#5cbfeb") },
  Wales: { home: k("#c8102e", "#00b140"), away: k("#111111", "#c8102e") },
};
const FALLBACK: { home: Kit; away: Kit } = { home: k("#64748b", "#ffffff"), away: k("#ffffff", "#64748b") };

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** How far apart two colours are (0..441). */
export function colourGap(a: string, b: string): number {
  const p = rgb(a), q = rgb(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
/** Two shirts this close are hard to tell apart on a small pitch. */
export const KIT_CLASH = 120;

const KEEPER_SHIRTS: Kit[] = [k("#a3e635", "#14532d"), k("#f97316", "#111111"), k("#111111", "#a3e635"), k("#7c3aed", "#ffffff"), k("#06b6d4", "#111111")];

/** The two real sides' shirts: the scorers in their home kit, the others in theirs unless it clashes. */
export function kitsForGoal(g: RealGoal): { us: Kit; them: Kit; keeper: Kit } {
  const us = (NATION_KITS[g.shot.team] ?? FALLBACK).home;
  const t = NATION_KITS[concededBy(g)] ?? FALLBACK;
  const them = colourGap(t.home.shirt, us.shirt) < KIT_CLASH ? t.away : t.home;
  const keeper = KEEPER_SHIRTS.find((kk) => colourGap(kk.shirt, us.shirt) >= KIT_CLASH && colourGap(kk.shirt, them.shirt) >= KIT_CLASH) ?? KEEPER_SHIRTS[0];
  return { us, them, keeper };
}

// ─────────────────────────────────────────────────────────────────────────
//  WHERE THE REAL BALL WENT
// ─────────────────────────────────────────────────────────────────────────

const YD = 0.9144;
/** How far inside the posts and bar the real goal's spot is kept (m): ball (0.11) + post (0.06) + room for a human wobble. */
export const END_ROOM = 0.4;

/** Where the real goal crossed the goal line: x across (our metres), z up (metres). */
export function realEnd(g: RealGoal): { x: number; z: number } {
  const e = g.shot.end ?? [120, 40];
  const x = sbToPitch([120, e[1]]).x;
  // StatsBomb records the height in yards; a goal with none went in along the grass.
  const z = g.x.endZ === null ? 0.15 : g.x.endZ * YD;
  // Kept a ball and a post inside the frame: StatsBomb puts a goal in off the
  // inside of the post ON the post, and the same spot here would hit it.
  return { x: Math.min(POST_R - END_ROOM, Math.max(POST_L + END_ROOM, x)), z: Math.max(0.11, Math.min(2.44 - END_ROOM, z)) };
}

export const realStart = (g: RealGoal): Vec2 => sbToPitch(g.shot.loc);

/**
 * The real ball's flight, sampled (pitch metres, z up): a straight line over
 * the grass from where it was struck to where it crossed, rising to the real
 * height. StatsBomb has no path, only the two ends, so the arc is drawn the
 * shape the strike suggests (a lob or a chip goes up first; a header or a
 * drive barely arcs).
 */
export function ghostPath(g: RealGoal, n = 28): RealGoalGhost {
  const a = realStart(g), e = realEnd(g);
  const dist = Math.hypot(e.x - a.x, a.y);
  const t = g.shot.technique, body = g.shot.body;
  const z0 = body === "Head" ? 1.9 : t === "Volley" || t === "Overhead Kick" || t === "Diving Header" ? 0.7 : 0.11;
  const bulge = t === "Lob" ? Math.max(1.6, dist * 0.14) : body === "Head" ? 0.15 : Math.min(1.1, dist * 0.035);
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push({ x: a.x + (e.x - a.x) * f, y: a.y * (1 - f), z: z0 + (e.z - z0) * f + bulge * 4 * f * (1 - f) });
  }
  const durS = g.x.dur && g.x.dur > 0.15 ? g.x.dur : Math.max(0.4, dist / 22);
  return { pts, durS };
}

// ─────────────────────────────────────────────────────────────────────────
//  ACCURACY AND STARS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How close your ball crossed the line to the real one, 0–100%. A bell curve
 * on the distance in the goal mouth (across and up): 100% on the spot, 85%
 * at 45 cm, 60% at 80 cm, 25% at 1.3 m. Height counts a little less than
 * across (it is harder to judge on a phone): 1 m too high = 0.8 m wide.
 */
export const ACC_SIGMA = 1.116;
export const ACC_HEIGHT_WEIGHT = 0.8;
export function accuracyPct(real: { x: number; z: number }, you: { x: number; z: number } | null): number {
  if (!you) return 0;
  const d = Math.hypot(you.x - real.x, (you.z - real.z) * ACC_HEIGHT_WEIGHT);
  return Math.max(0, Math.min(100, 100 * Math.exp(-((d / ACC_SIGMA) ** 2))));
}

/** ★ a goal, ★★ a goal at 60%+, ★★★ a goal at 85%+. No goal: no stars. */
export const STAR_TWO = 60;
export const STAR_THREE = 85;
export function starsFor(scored: boolean, pct: number): 0 | 1 | 2 | 3 {
  if (!scored) return 0;
  return pct >= STAR_THREE ? 3 : pct >= STAR_TWO ? 2 : 1;
}

// ─────────────────────────────────────────────────────────────────────────
//  ALWAYS SCOREABLE AS THE REAL GOAL (the engine's Scenario.realLane)
// ─────────────────────────────────────────────────────────────────────────

/** How close to the real crossing a strike must be heading to be in the real lane (m). */
export const LANE_TOL_X = 0.6;
export const LANE_TOL_Z = 0.55;

/** The real goal as one of our chances, with its real lane switched on. */
export function scenarioForGoal(g: RealGoal, lane = true): Scenario {
  const sc = scenarioForShot(g.shot, { wideFrame: true });
  if (lane) { const e = realEnd(g); sc.realLane = { x: e.x, z: e.z, tolX: LANE_TOL_X, tolZ: LANE_TOL_Z }; }
  return sc;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE REAL NAMES ON THE REAL MEN
// ─────────────────────────────────────────────────────────────────────────

interface Named { at: Vec2; side: "mate" | "opp" | "keeper"; name: string; pos: string }

export function namedPeople(g: RealGoal): Named[] {
  return g.shot.ff.map(([x, y, mate, gk], i) => ({
    at: sbToPitch([x, y]),
    side: (mate ? "mate" : gk ? "keeper" : "opp") as Named["side"],
    name: knownAs(g, g.x.names[i] ?? ""),
    pos: g.x.pos[i] ?? "",
  }));
}

const idFor = (name: string, pos: string) => ({ id: `rg:${name}`, name, shortName: shortNameOf(name), position: pos });

/**
 * Puts the real names on the chance's men (CanvasMatch calls it after casting
 * its own): the keeper, each defender and team-mate on the real man standing
 * where he stands. A man the real frame has nobody for (the match's own
 * poacher) is left nameless — never one of the test club's players.
 */
export function dressFor(g: RealGoal): (sc: Scenario) => void {
  const people = namedPeople(g);
  return (sc) => {
    const used = new Set<number>();
    const take = (side: Named["side"], p: Vec2, within = 2.5) => {
      let best = -1, bd = within;
      people.forEach((q, i) => {
        if (used.has(i) || q.side !== side) return;
        const d = Math.hypot(q.at.x - p.x, q.at.y - p.y);
        if (d < bd) { bd = d; best = i; }
      });
      if (best < 0) return null;
      used.add(best);
      return idFor(people[best].name, people[best].pos);
    };
    const blank = { id: "rg:none", name: "", shortName: "", position: "" };
    sc.keeper.who = take("keeper", sc.keeper, 6) ?? blank;
    for (const d of sc.defenders) d.who = take("opp", d) ?? blank;
    if (sc.runner) sc.runner.who = take("mate", sc.runner.pos) ?? blank;
    for (const r of sc.secondaryRunners) r.who = take("mate", r.pos) ?? blank;
    for (const t of sc.teammates) t.who = take("mate", t) ?? blank;
    sc.follower.who = take("mate", sc.follower) ?? blank;
  };
}

/** Everything the match is handed for this goal (CanvasMatch's `realGoal`). */
export function viewForGoal(g: RealGoal, ghostOn: boolean): RealGoalView {
  const kits = kitsForGoal(g);
  return {
    us: { name: g.shot.team, kit: kits.us },
    them: { name: concededBy(g), kit: kits.them },
    keeperKit: kits.keeper,
    badge: compBadge(g),
    youName: scorerShort(g),
    showNames: true,
    dress: dressFor(g),
    ghost: ghostOn ? ghostPath(g) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  DIFFICULTY, LEVELS, STARS SAVED ON THE PHONE
// ─────────────────────────────────────────────────────────────────────────

/** Goals named on the page first (Leo's, and other famous ones in the data). */
export const FEATURED: { id: string; label: string }[] = [
  { id: "03fb2918", label: "Mbappé's volley v Argentina — World Cup final" },
  { id: "657ac0ef", label: "Neymar v Croatia — the extra-time one-two" },
  { id: "f49ffee0", label: "Saka v Switzerland — through the gap" },
  { id: "32b4bd54", label: "Güler v Georgia — top corner from 25 m" },
  { id: "fedfb68d", label: "Yamal v France — the curler" },
  { id: "c71a4f0a", label: "Bellingham v Slovakia — the overhead kick" },
  { id: "f32f451c", label: "Richarlison v Serbia — the scissor kick" },
  { id: "54b889ec", label: "Messi v France — World Cup final, 108'" },
  { id: "ef86f4d9", label: "Di María v France — World Cup final" },
  { id: "70e7f361", label: "Messi v Mexico — low from 25 m" },
  { id: "19d5c45f", label: "Oyarzabal v England — Euro 2024 final winner" },
  { id: "bf03dfcf", label: "Nico Williams v England — Euro 2024 final" },
  { id: "07c658a2", label: "Al Dawsari v Argentina — the shock" },
  { id: "d71bc1d5", label: "Asano v Germany — the near-post finish" },
];
const FEATURED_IDS = new Set(FEATURED.map((f) => f.id));

/**
 * How hard the goal is to recreate. Mostly the chance itself (StatsBomb's xG:
 * a 2% shot is far harder than a 50% one), plus bodies in the way, distance,
 * and a finish into a top corner.
 */
export function difficultyOf(g: RealGoal): number {
  const p = peopleOf(g.shot);
  const xg = Math.max(0.005, g.shot.xg);
  const dist = Math.hypot(p.ball.x - CX, p.ball.y);
  const e = realEnd(g);
  const corner = e.z > 1.5 && Math.abs(e.x - CX) > 2.4 ? 0.5 : 0;
  const special = /Volley|Overhead|Diving/.test(g.shot.technique) ? 0.4 : 0;
  return -Math.log(xg) + 0.3 * blockersOf(p.ball, p.opps) + 0.04 * Math.max(0, dist - 11) + corner + special;
}

export interface Level { n: number; stage: number; goal: RealGoal; difficulty: number }
export interface Stage { n: number; name: string; levels: Level[]; gate: number }

export const STAGE_NAMES = ["Group stage", "Round of 16", "Quarter-finals", "Semi-finals", "The final"];
export const LEVELS_PER_STAGE = 10;
/** Stars needed in all to open each stage. */
export const STAGE_GATES = [0, 6, 15, 26, 38];

/**
 * The level map: 5 stages of 10, easiest first. The goals are split into five
 * bands by difficulty; each stage takes its band's featured goals first, then
 * the rest of the band spread evenly. Deterministic.
 */
export function buildLevels(goals: RealGoal[]): Stage[] {
  const ok = goals.filter((g) => peopleOf(g.shot).keeper);
  const sorted = ok.map((g) => ({ g, d: difficultyOf(g) })).sort((a, b) => a.d - b.d || a.g.id.localeCompare(b.g.id));
  const stages: Stage[] = [];
  const band = sorted.length / STAGE_NAMES.length;
  let n = 0;
  for (let s = 0; s < STAGE_NAMES.length; s++) {
    const pool = sorted.slice(Math.round(s * band), Math.round((s + 1) * band));
    const feat = pool.filter((q) => FEATURED_IDS.has(q.g.id));
    const rest = pool.filter((q) => !FEATURED_IDS.has(q.g.id));
    const want = Math.max(0, LEVELS_PER_STAGE - feat.length);
    const step = rest.length / Math.max(1, want);
    const picked = [...feat.slice(0, LEVELS_PER_STAGE)];
    for (let i = 0; i < want && i < rest.length; i++) picked.push(rest[Math.floor(i * step + step / 2)]);
    picked.sort((a, b) => a.d - b.d);
    stages.push({
      n: s, name: STAGE_NAMES[s], gate: STAGE_GATES[s],
      levels: picked.map((q) => ({ n: n++, stage: s, goal: q.g, difficulty: q.d })),
    });
  }
  return stages;
}

/** Per level id: the best stars and the best accuracy. */
export type Progress = Record<string, { stars: number; best: number }>;

export const totalStars = (p: Progress) => Object.values(p).reduce((a, v) => a + v.stars, 0);

/** Is level `lv` open? Stage gate (total stars) and the level before it passed (★1+). */
export function levelOpen(stages: Stage[], p: Progress, lv: Level): boolean {
  if (totalStars(p) < stages[lv.stage].gate) return false;
  if (lv.n === 0) return true;
  const all = stages.flatMap((s) => s.levels);
  const prev = all[lv.n - 1];
  if (prev.stage !== lv.stage) return true;   // the first level of an open stage
  return (p[prev.goal.id]?.stars ?? 0) > 0;
}

/** A result in: keeps the best stars and the best accuracy. */
export function recordResult(p: Progress, id: string, stars: number, pct: number): Progress {
  const was = p[id] ?? { stars: 0, best: 0 };
  return { ...p, [id]: { stars: Math.max(was.stars, stars), best: Math.max(was.best, Math.round(pct)) } };
}

const KEY = "star-real-goals-progress-v1";
export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}
export function saveProgress(p: Progress): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private window: this visit only */ }
}

// ─────────────────────────────────────────────────────────────────────────
//  THE BUILD-UP, CLOSER TO THE REAL MOVE
// ─────────────────────────────────────────────────────────────────────────
//
// The Real shots page replays the last 2-3 completed passes, timed so the
// whole thing fits LEAD_MAX_S, with the carries between them guessed as
// straight runs. goals.json has the whole move (every pass, carry and
// dribble with its real timestamp), so the build-up here plays the real
// actions at the real times: the ball goes where the real ball went, when it
// went there.

/** The longest build-up (seconds of the real move). */
export const MOVE_MAX_S = 14;

/** The window of the move the build-up plays (oldest first). */
export function moveWindow(g: RealGoal, lead?: SbLeadin): RgMoveEv[] {
  const mv = g.x.move.filter((e) => e[2]);
  if (!mv.length) return [];
  // With a 360 frame for the old lead-in's first pass, start there, so the
  // men start where StatsBomb saw them.
  const first = lead?.start && lead.passes.length ? lead.passes[0][0] : null;
  let from = mv.findIndex((e) => e[1] === "P" && first !== null && Math.abs(e[0] - first) < 0.8 && e[0] <= MOVE_MAX_S + 4);
  if (from < 0) from = mv.findIndex((e) => e[0] <= MOVE_MAX_S);
  if (from < 0) from = mv.length - 1;
  return mv.slice(from);
}

/** The window's passes, as the lead-in's pass list ([seconds before, from, to, passer, recipient]). */
export function windowPasses(win: RgMoveEv[]): SbPass[] {
  return win.filter((e) => e[1] === "P" && e[3] && e[5]).map((e) => [e[0], e[2], e[3]!, e[4], e[5]!] as SbPass);
}

/** A lead-in (for leadinTrack) made of the window's real passes; keeps the 360 start only when the window starts on its pass. */
export function realMoveLeadin(g: RealGoal, lead?: SbLeadin): SbLeadin | null {
  const win = moveWindow(g, lead);
  const passes = windowPasses(win);
  if (!passes.length) return null;
  const sameStart = !!lead?.start && lead.passes.length > 0 && Math.abs(lead.passes[0][0] - passes[0][0]) < 0.8;
  return { passes, path: lead?.path ?? [], start: sameStart ? lead!.start : undefined };
}

const HOLD_S = 0.45;
const flightS = (d: number) => Math.min(1.8, Math.max(0.3, d / 18));

/**
 * The ball at the real timing: every pass leaves at its real time and arrives
 * when the next action starts; every carry runs from its real start to its
 * real end. Ends on `end` (the chance's ball) at the shot's real time.
 */
export function realBallKeys(g: RealGoal, win: RgMoveEv[], end: Vec2): LeadBallKey[] {
  if (!win.length) return [{ t: 0, p: { ...end } }, { t: 0.5, p: { ...end } }];
  const T = win[0][0] + HOLD_S;          // seconds of build-up
  const at = (back: number) => T - back;
  const keys: LeadBallKey[] = [];
  const push = (t: number, p: Vec2, pass?: { h: number }) => {
    const last = keys[keys.length - 1];
    if (last && t <= last.t + 1e-3) t = last.t + 0.05;
    keys.push(pass ? { t, p, pass } : { t, p });
  };
  push(0, sbToPitch(win[0][2]));
  win.forEach((e, i) => {
    const from = sbToPitch(e[2]);
    const t0 = Math.max(HOLD_S * (i === 0 ? 1 : 0), at(e[0]));
    const last = keys[keys.length - 1];
    if (Math.hypot(last.p.x - from.x, last.p.y - from.y) > 0.3 || t0 > last.t + 0.05) push(Math.max(t0, last.t + 0.05), from);
    const nextT = i + 1 < win.length ? at(win[i + 1][0]) : T;
    if (e[1] === "P" && e[3]) {
      const to = sbToPitch(e[3]);
      const d = Math.hypot(to.x - from.x, to.y - from.y);
      // It arrives as the next action starts (the receiver's touch), never quicker than a ball can travel.
      const start = keys[keys.length - 1].t;
      push(Math.max(nextT, start + Math.min(flightS(d), 0.6)), to, { h: e[6] === 2 ? Math.min(5, d * 0.1) : e[6] === 1 ? Math.min(1.5, d * 0.05) : 0 });
    } else if (e[1] === "C" && e[3]) {
      push(Math.max(nextT - 0.05, keys[keys.length - 1].t + 0.1), sbToPitch(e[3]));
    }
  });
  push(Math.max(T, keys[keys.length - 1].t + 0.3), { ...end });
  return keys;
}

/** Every real action in the window as (seconds before the shot, where the ball was). */
export function realTouches(win: RgMoveEv[]): { back: number; p: Vec2 }[] {
  const out: { back: number; p: Vec2 }[] = [];
  for (const e of win) out.push({ back: e[0], p: sbToPitch(e[2]) });
  return out;
}

/**
 * How far the replayed ball is from the real ball, metres, averaged over the
 * real actions: each real touch (where and how long before the shot) against
 * where the replay's ball is that long before its own end.
 */
export function replayError(keys: LeadBallKey[], touches: { back: number; p: Vec2 }[]): number {
  if (!touches.length) return NaN;
  const dur = keys[keys.length - 1].t;
  let sum = 0;
  for (const t of touches) {
    const b = ballAlong(keys, Math.max(0, dur - t.back));
    sum += Math.hypot(b.x - t.p.x, b.y - t.p.y);
  }
  return sum / touches.length;
}
