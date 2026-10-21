/**
 * B10 MEASUREMENTS — headers and volleys back on.
 *
 *   npx tsx scripts/b10/measure.mts [conversion|others|mix] [--n=600] [--json=out.json]
 *
 * conversion  your header / volley conversion by finisher quality:
 *               before = the engine's own pictures (buildScenario), struck as
 *                        the 24 Sep game struck them (a plain shot off the grass);
 *               strike = the same pictures, struck the B10 way (from the air,
 *                        where you met it and when count: airContactRead);
 *               after  = the pictures the game now serves (the team's cross
 *                        drawings, airDrawings.ts), struck the B10 way.
 * others      one-on-one / tight angle / long range conversion by quality
 *             (run on the old and the new code: it must not move).
 * mix         how often a header or a volley is served per match (40 matches
 *             of the real unseen match, the real chance maker), Chances Old
 *             (the default) and New (= Full highlights rebuild On).
 *
 * The "finisher": a seeded bot thumb (tests/star/shotLab.ts's flight loop).
 * It aims inside the post the keeper is further from, with a 2.5° drag error.
 * A header is met on top (60%) or in the middle; a volley through the middle.
 * Its tap lands round that spot (sd tapSd ball radii) and, for a volley, its
 * timing round the middle of the green band (sd timeSd). Quality sets those
 * and its power/technique.
 */
import { shoot, type Thumb, type LabOptions } from "../../tests/star/shotLab";
import { applyAirborne } from "../../lib/star/airborneChance";
import { buildScenario, type Scenario, type ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";
import { writeFileSync } from "node:fs";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const N = Number(arg("n", "600"));
const mode = process.argv[2] ?? "conversion";
const out: Record<string, unknown> = {};

const QUALITY = {
  poor: { skill: 45, tapSd: 0.42, timeSd: 0.32 },
  average: { skill: 65, tapSd: 0.3, timeSd: 0.22 },
  elite: { skill: 88, tapSd: 0.18, timeSd: 0.1 },
} as const;
type Q = keyof typeof QUALITY;

function gauss(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/** Meeting a ball in the air: aim inside the far post, meet it on top / through the middle. */
const airThumb = (kind: "header" | "volley", q: Q) => (sc: Scenario, r: () => number): Thumb => {
  const farSide = sc.keeper.x < CX ? 1 : -1;
  const side = r() < 0.75 ? farSide : -farSide;
  const inset = 0.35 + r() * 0.6;
  const targetX = side > 0 ? POST_R - inset : POST_L + inset;
  const meant = kind === "header" ? (r() < 0.6 ? { cx: 0, cy: -0.35 } : { cx: 0, cy: 0 }) : { cx: 0, cy: -0.1 };
  const power = kind === "header" ? 0.7 + r() * 0.3 : 0.75 + r() * 0.25;
  const sd = QUALITY[q].tapSd;
  let cx = meant.cx + gauss(r) * sd, cy = meant.cy + gauss(r) * sd;
  const d = Math.hypot(cx, cy); if (d > 1) { cx /= d; cy /= d; }
  return { aimErrDeg: gauss(r) * 2.5, power, contact: { cx, cy }, intent: "placed", targetX, aimX: targetX };
};

/** When it was met: a header anywhere on its float (0.84-1 of the top), a volley round 0.55 of its bounce. */
function liftFor(kind: "header" | "volley", q: Q, seed: number): number {
  const r = mulberry32((seed ^ 0x1f7a3) >>> 0);
  if (kind === "header") return 0.84 + 0.16 * r();
  return Math.max(0, Math.min(1, 0.55 + gauss(r) * QUALITY[q].timeSd));
}

interface Tally { shots: number; goals: number; onTarget: number; blocked: number }
const pct = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;

function run(kind: ScenarioKind, q: Q, how: "before" | "strike" | "after" | "plain"): Tally {
  const t: Tally = { shots: 0, goals: 0, onTarget: 0, blocked: 0 };
  const sk = QUALITY[q].skill;
  for (let i = 1; i <= N; i++) {
    const seed = (i * 7919 + kind.length * 104729) >>> 0;
    const o: LabOptions = { skills: { power: sk, technique: sk } };
    const air = kind === "header" || kind === "volley" ? kind : null;
    if (air) o.thumbFor = airThumb(air, q);
    if (how === "before" || how === "strike") o.scenario = buildScenario(kind, mulberry32(seed ^ 0xb10), 62, 60, 55);
    if (air && (how === "strike" || how === "after")) {
      o.afterLaunch = (ball, sc, thumb) => {
        applyAirborne(ball, sc, { kind: air, lift: liftFor(air, q, seed), cx: thumb.contact.cx, cy: thumb.contact.cy, tech: sk });
      };
    }
    const res = shoot(kind, seed, o);
    t.shots++;
    if (res.goal) t.goals++;
    if (res.onTarget) t.onTarget++;
    if (res.blocked) t.blocked++;
  }
  return t;
}

if (mode === "conversion") {
  for (const kind of ["header", "volley"] as ScenarioKind[]) {
    console.log(`\n${kind.toUpperCase()} — goals (on target, blocked) of ${N} shots`);
    console.log(`quality   before                  strike only             after`);
    const rows: Record<string, unknown> = {};
    for (const q of Object.keys(QUALITY) as Q[]) {
      const b = run(kind, q, "before"), s = run(kind, q, "strike"), a = run(kind, q, "after");
      const f = (x: Tally) => `${pct(x.goals, x.shots).padStart(6)} (${pct(x.onTarget, x.shots)}, ${pct(x.blocked, x.shots)})`.padEnd(24);
      console.log(`${q.padEnd(9)} ${f(b)}${f(s)}${f(a)}`);
      rows[q] = { before: b, strike: s, after: a };
    }
    out[kind] = rows;
  }
}

if (mode === "others") {
  for (const kind of ["one_on_one", "tight_angle", "long_range"] as ScenarioKind[]) {
    const rows: Record<string, unknown> = {};
    const line: string[] = [];
    for (const q of Object.keys(QUALITY) as Q[]) { const t = run(kind, q, "plain"); rows[q] = t; line.push(`${q} ${pct(t.goals, t.shots)}`); }
    console.log(`${kind.padEnd(12)} ${line.join("  ")}`);
    out[kind] = rows;
  }
}

if (mode === "mix") {
  const { startRadar, stepRadar, radarOver, resolveHighlight } = await import("../../lib/star/matchRadar");
  const { noteServedKind } = await import("../../lib/star/hiddenMatch");
  const { makeChance, PictureMemory } = await import("../../lib/star/chanceMaker");
  const { newSelectionMemory } = await import("../../lib/star/scenarioSelect");
  const { forceChancesMode } = await import("../../lib/star/newChances");
  const POS = ["ST", "LW", "RW", "CAM", "ST", "CM", "RW", "LW"];
  for (const m of [null, "new"] as const) {
    forceChancesMode(m);
    const MATCHES = 40;
    let total = 0, open = 0, head = 0, vol = 0;
    const kinds = new Map<string, number>();
    for (let mi = 0; mi < MATCHES; mi++) {
      const r = mulberry32(0xabc + mi * 31);
      const inputs = {
        teamStrength: 55 + Math.floor(r() * 35), oppStrength: 55 + Math.floor(r() * 35), home: mi % 2 === 0, playerSkill: 60 + Math.floor(r() * 30),
        pace: 70, freeKick: 70, position: POS[mi % POS.length],
        context: { playstyle: "balanced", teamRelationship: 60, fanRelationship: 50, skills: { pace: 70, power: 65, technique: 65, vision: 60 } },
      };
      const radar = startRadar(7000 + mi * 13, inputs as never);
      const rng = mulberry32((0xc4a7ce ^ (mi * 2654435761)) >>> 0);
      const memory = new PictureMemory(`b10-${m}`, false);
      const selection = newSelectionMemory();
      for (let g = 0; g < 400 && !radarOver(radar); g++) {
        if (!radar.pending) { stepRadar(radar); continue; }
        const req = radar.pending.request!;
        if (!req.dribble) {
          const made = makeChance({ source: { from: "request", request: req, position: inputs.position }, rng, strength: { keeper: 62, team: inputs.teamStrength, vision: 60 }, memory, selection });
          noteServedKind(radar.state, made.sc.kind);
          total++;
          if (req.pattern !== "set_piece" && req.kinds.length > 1) open++;
          kinds.set(made.sc.kind, (kinds.get(made.sc.kind) ?? 0) + 1);
          if (made.sc.kind === "header") head++;
          if (made.sc.kind === "volley") vol++;
        }
        resolveHighlight(radar, "bench-rate");
      }
    }
    const label = m ?? "old (default)";
    console.log(`\nChances ${label}: ${total} chances in ${MATCHES} matches (${(total / MATCHES).toFixed(1)} a match), open play ${open}`);
    console.log(`  headers ${head} (${(head / MATCHES).toFixed(2)} a match, ${pct(head, total)} of chances)  volleys ${vol} (${(vol / MATCHES).toFixed(2)} a match, ${pct(vol, total)})`);
    console.log(`  by kind: ${[...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
    out[label] = { total, open, head, vol, kinds: Object.fromEntries(kinds) };
  }
  forceChancesMode(null);
}

const js = arg("json", "");
if (js) writeFileSync(js, JSON.stringify(out, null, 2));
