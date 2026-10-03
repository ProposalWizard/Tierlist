/**
 * BUILD THE NEW CHANCE LIBRARY — v0.26.
 *
 *   npx tsx scripts/chance-library.mts [perKind=110] [sheetDir]
 *     → lib/star/chanceLibrary.json (+ contact-sheet data in sheetDir)
 *
 * Read lib/star/chanceLibrary.ts first: what the library is and why.
 *
 * For every chance kind that is switched on:
 *   1. The pool: the team's committed drawings (authoredScenarios.json) plus
 *      the New batch (authoredScenariosNew.json), minus any New drawing with a
 *      fault a person would see (overlap, a team-mate in the shot, offside, a
 *      man behind the keeper). The rule set is scanned off that pool, as the
 *      game always does — nothing hand-written places anyone in the chance.
 *   2. Candidates: the gallery Sim's randomiser on a drawing (mirrored half
 *      the time) and, for open play with 10+ drawings, the generator (each
 *      man from the spread of that kind's drawings). Set pieces are drawings
 *      only, as in the game.
 *   3. Each candidate is served exactly as the game serves it
 *      (chanceLibrary.serveEntry) and kept only if:
 *        - the game's own checks find nothing (servedFaults: the kind's laws,
 *          offside, a defender behind his keeper, overlap, off the picture),
 *        - nobody stands on anybody (spacing.ts's own gaps),
 *        - no team-mate in your shot (shooting kinds),
 *        - with the rest of both teams added (contextShape.ts), nobody is
 *          stranded 15 m from everyone,
 *        - it is at least 3 m different from every picture already kept
 *          (a penalty: not the identical picture), mirror included.
 *   4. Contact-sheet data for every kept picture, in the new view's own
 *      frame, so every one can be looked at (THROWN_OUT in chanceLibrary.ts
 *      takes one out).
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
};

const { buildScenario, goalInView } = await import("../lib/star/canvasEngine");
type Scenario = import("../lib/star/canvasEngine").Scenario;
type Vec2 = import("../lib/star/canvasEngine").Vec2;
const { setLiveScenarioPool, ruleSetFor, mateBodiesOf } = await import("../lib/star/authoredChance");
const { drawingShape, generatorShape, canGenerate, servedFaults, pictureOf, pictureGap, memoryRule, drawingOwnFaults } = await import("../lib/star/chanceMaker");
const { serveEntry, samePictureOfKind } = await import("../lib/star/chanceLibrary");
type LibEntry = import("../lib/star/chanceLibrary").LibEntry;
const { addContext, isContext, withoutContext } = await import("../lib/star/contextShape");
const { closestFigures, closestMarking, MIN_GAP, MARKING_GAP } = await import("../lib/star/spacing");
const { isMatchScenario } = await import("../lib/star/authoredScenarios");
const { violations, sampleFromAuthored, MIN_SAMPLES_FOR_INVARIANT } = await import("../lib/star/scenarioRules");
const { formationOf } = await import("../lib/star/formations");
const { freeKickRate } = await import("./lib/freeKickBot.mts");
const { PLAYSTYLES } = await import("../lib/star/playstyle");
const { frameForNewView } = await import("../lib/star/matchView");
const { mulberry32 } = await import("../lib/star/season");
const { CX, PITCH_W } = await import("../lib/star/pitch");
type MatchScenario = import("../lib/star/scenarios").MatchScenario;

const PER_KIND = Number(process.argv[2] ?? 110);
const SHEETS = process.argv[3] ?? "";
const KINDS = ["one_on_one", "tight_angle", "long_range", "cutback", "byline_cross", "through_ball", "midfield_pass", "buildup", "corner", "free_kick", "penalty"] as const;
const SHOOT = new Set(["one_on_one", "tight_angle", "long_range", "free_kick", "penalty"]);
const SET_PIECE = new Set(["corner", "free_kick", "penalty"]);
const FORMS = ["433", "4231", "442", "352", "4321", "4141", "3421"];
const STYLES = ["mid-block", "low-block", "high-press", "possession", "counter"] as const;
/** The phone the sheets are drawn for: option D's 38 m across, 71 m tall. */
const HW = 71 / 38;

const parked = (p: Vec2) => p.x < -50 || p.x > PITCH_W + 50 || p.y > 150 || p.y < -50;
const hyp = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const r2 = (v: number) => Math.round(v * 100) / 100;
const P = (p: Vec2): [number, number] => [r2(p.x), r2(p.y)];

/** A team-mate goal-side of the ball within 2.2 m of the line to goal. */
function mateInShot(sc: Scenario): boolean {
  const b = sc.ball, vx = CX - b.x, vy = -b.y, L = Math.hypot(vx, vy) || 1;
  return mateBodiesOf(sc).some((m) => !parked(m) && m.y < b.y && Math.abs(((m.x - b.x) * vy - (m.y - b.y) * vx) / L) < 2.2);
}

/** Every man's spot by group, mirror-normalised to the ball's side. */
function groups(sc: Scenario): Vec2[][] {
  const flip = sc.ball.x < CX;
  const f = (p: Vec2): Vec2 => ({ x: flip ? PITCH_W - p.x : p.x, y: p.y });
  return [
    [f(sc.ball)], [f(sc.player)], [f(sc.keeper)],
    sc.defenders.filter((d) => !parked(d) && !isContext(d)).map(f),
    mateBodiesOf(sc).filter((m) => !parked(m) && !isContext(m)).map(f),
    sc.defenders.filter((d) => isContext(d)).map(f),
    mateBodiesOf(sc).filter((m) => isContext(m)).map(f),
  ];
}
/** The furthest any man stands from his place in the other build. */
function worstMove(a: Scenario, b: Scenario): number {
  const A = groups(a), B = groups(b);
  let worst = 0;
  for (let g = 0; g < A.length; g++) {
    if (A[g].length !== B[g].length) return Infinity;
    for (const p of A[g]) worst = Math.max(worst, Math.min(...B[g].map((q) => hyp(p, q))));
  }
  return worst;
}

/** A New drawing a person would see is wrong. */
function drawingFaults(ms: MatchScenario, kind: string): string[] {
  const you = ms.players.find((p) => p.side === "you"), gk = ms.players.find((p) => p.label === "GK");
  if (!you || !gk) return ["no you or keeper"];
  const defs = ms.players.filter((p) => p.side === "opponent" && p.label !== "GK");
  const mates = ms.players.filter((p) => p.side === "teammate");
  const all = [you, gk, ...defs, ...mates];
  const out: string[] = [];
  for (let a = 0; a < all.length; a++) for (let c = a + 1; c < all.length; c++) {
    if (hyp(all[a], all[c]) < (kind === "free_kick" ? 0.9 : 1.0)) out.push("overlap");
  }
  const b = ms.ball;
  if (SHOOT.has(kind)) {
    const vx = CX - b.x, vy = -b.y, L = Math.hypot(vx, vy) || 1;
    if (mates.some((m) => m.y < b.y && Math.abs(((m.x - b.x) * vy - (m.y - b.y) * vx) / L) < 2.2)) out.push("mate in shot");
  }
  const line = Math.min(b.y, ...defs.map((d) => d.y));
  if (kind !== "corner" && kind !== "penalty" && mates.some((m) => m.y < line - 0.05)) out.push("offside");
  if ([...defs, ...mates].some((p) => p.y < gk.y - 0.3 && Math.abs(p.x - gk.x) < 1.5)) out.push("behind keeper");
  return [...new Set(out)];
}

// ── 1. The pool ──
// The team's own laws first, scanned off the committed drawings alone. A New
// drawing must keep every one of them: a new drawing is never allowed to
// loosen a law the team's drawings agree on (that is how three saved Sims
// once let team-mates stand in long shots).
const classicLaws = new Map(KINDS.map((k) => [k, ruleSetFor(k)] as const));
const newFile = JSON.parse(readFileSync(new URL("../lib/star/authoredScenariosNew.json", import.meta.url), "utf8"));
const newDrawings: MatchScenario[] = [];
const skipped: string[] = [];
for (const s of Object.values(newFile.scenarios ?? {})) {
  if (!isMatchScenario(s)) continue;
  const f = drawingFaults(s, s.source?.kind ?? "");
  const law = classicLaws.get((s.source?.kind ?? "") as (typeof KINDS)[number]);
  const sample = sampleFromAuthored(s);
  if (law && law.n >= MIN_SAMPLES_FOR_INVARIANT && sample) for (const v of violations(sample, law)) f.push(`breaks the team's law: ${v}`);
  if (f.length) { skipped.push(`${s.id}: ${f.join(", ")}`); continue; }
  newDrawings.push(s);
}
setLiveScenarioPool(newDrawings);
console.log(`New drawings: ${newDrawings.length} used, ${skipped.length} left out${skipped.length ? `\n  ${skipped.join("\n  ")}` : ""}`);

// ── 2–4. The library ──
const lib: { version: number; laws: Record<string, string[]>; kinds: Record<string, LibEntry[]> } = { version: 1, laws: {}, kinds: {} };
const sheets: Record<string, unknown[]> = {};
const report: string[] = [];

// ONLY=free_kick,corner rebuilds just those kinds and keeps the rest of the file.
const ONLY = (process.env.ONLY ?? "").split(",").filter(Boolean);
if (ONLY.length) {
  const old = JSON.parse(readFileSync(new URL("../lib/star/chanceLibrary.json", import.meta.url), "utf8"));
  Object.assign(lib.kinds, old.kinds ?? {}); Object.assign(lib.laws, old.laws ?? {});
}
for (const kind of KINDS) {
  if (ONLY.length && !ONLY.includes(kind)) continue;
  const set = ruleSetFor(kind);
  if (!set) { report.push(`${kind}: no rule set`); continue; }
  lib.laws[kind] = set.rules.filter((r) => r.invariant && r.at === 0).map((r) => r.id);
  const rng = mulberry32(0xc4a1 + kind.length * 104729 + kind.charCodeAt(0));
  const kept: { entry: LibEntry; pic: ReturnType<typeof pictureOf> }[] = [];
  const panels: unknown[] = [];
  const why: Record<string, number> = {};
  const no = (r: string) => { why[r] = (why[r] ?? 0) + 1; };
  const within = memoryRule(kind).within;
  const gen = !SET_PIECE.has(kind) && canGenerate(kind);
  let tries = 0;
  const MAX_TRIES = 9000;
  for (; tries < MAX_TRIES && kept.length < PER_KIND; tries++) {
    const useGen = gen && rng() < 0.55;
    const shape = useGen ? generatorShape(kind, rng) : drawingShape(kind, rng);
    if (!shape) { no("no shape"); continue; }
    const entry: LibEntry = {
      id: `${kind}-${String(kept.length + 1).padStart(3, "0")}`,
      src: shape.sourceId,
      seed: Math.floor(rng() * 2 ** 31),
      b: P(shape.ball), y: P(shape.you), k: P(shape.keeper),
      d: shape.defenders.map(P), m: shape.mates.map(P),
    };
    const sc: Scenario = buildScenario(kind, mulberry32(entry.seed ^ 0x9e3779b9), 62, 60, 55);
    serveEntry(sc, entry);
    // The game's own checks, less two that do not mean what they say here:
    //  - "a player outside the picture" is measured against the OLD 42 m
    //    frame; in the new view the picture is the camera, checked below.
    //  - a fault the source drawing itself has (served exactly) is the
    //    drawing's, as in the game (chanceMaker's drawingOwnFaults): Harry's
    //    byline crosses are drawn further up than the engine's own "within
    //    6 m of the byline" rule, and the drawings decide.
    const own = useGen ? [] : drawingOwnFaults(kind, shape.sourceId, (shape as { mirrored?: boolean }).mirrored ?? false);
    const faults = servedFaults(sc).filter((f) => f !== "a player outside the picture" && !own.includes(f));
    if (faults.length) { no(faults[0].replace(/[0-9.]+m?/g, "#")); continue; }
    const view = frameForNewView({ ...sc } as Scenario, HW);
    const out = (p: Vec2) => p.x < view.x1 - 0.5 || p.x > view.x2 + 0.5 || p.y < view.y1 - 0.5 || p.y > view.y2 + 0.5;
    if ([sc.ball, sc.player, sc.keeper, ...sc.defenders, ...mateBodiesOf(sc)].filter((p) => !parked(p)).some(out)) { no("a man off the new view"); continue; }
    const tight = kind === "free_kick" ? 0.9 : MIN_GAP - 0.01;
    if (closestFigures(sc) < tight) { no("two men on one spot"); continue; }
    if (closestMarking(sc) < MARKING_GAP - 0.01) { no("marker on his man"); continue; }
    if (SHOOT.has(kind) && mateInShot(sc)) { no("team-mate in your shot"); continue; }
    // A free kick's wall is whoever stands within 12.5 m of the ball, built
    // 9.15 m off it; a man between the two would jump with a wall he is not in.
    if (kind === "free_kick" && sc.defenders.some((d) => { const r = hyp(d, sc.ball); return r > 9.7 && r < 12.6; })) { no("a man in wall range, not in the wall"); continue; }
    // Eleven a side, keeper included: never more than ten outfield.
    if (sc.defenders.filter((d) => !parked(d)).length > 10 || 1 + mateBodiesOf(sc).filter((m) => !parked(m)).length > 10) { no("more than eleven a side"); continue; }
    // A KNOT: three men inside 2 m of one of them. Seen on the first sheets
    // (one-on-ones 063, 072, 077, 081, 095, 107): three defenders stacked in
    // a column or shoulder to shoulder beside you, or a scrum round the ball —
    // the generator takes each man from a different drawing, so nothing stops
    // three of them landing together. At a set piece a crowd is the picture.
    if (!SET_PIECE.has(kind)) {
      // The keeper counts too: tight angles 034 and 035 had two men stood on him.
      const men = [sc.player, sc.keeper, ...sc.defenders.filter((d) => !parked(d)), ...mateBodiesOf(sc).filter((m) => !parked(m))];
      if (men.some((p) => men.filter((q) => q !== p && hyp(p, q) < 2.0).length >= 2)) { no("three men in a knot"); continue; }
    }
    const pic = pictureOf(sc);
    // Served on two other builds, the picture must land the same (the build
    // decides only who each man IS) — so what is looked at is what is served.
    const ctx0 = { formation: formationOf(FORMS[kept.length % FORMS.length]), playstyle: PLAYSTYLES[STYLES[kept.length % STYLES.length]] };
    let unstable = false;
    const ref = buildScenario(kind, mulberry32(entry.seed ^ 0x51ed27), 62, 60, 55);
    serveEntry(ref, entry, { context: { ...ctx0, laws: set } });
    for (const alt of [0x1234567, 0x7654321, 0x2468ace, 0x13579bd, 0x0f0f0f0, 0x5a5a5a5]) {
      const other = buildScenario(kind, mulberry32(entry.seed ^ alt), 75, 70, 40);
      serveEntry(other, entry, { keeperStrength: 80, context: { ...ctx0, laws: set } });
      if (worstMove(ref, other) > 0.01) unstable = true;
    }
    if (unstable) { no("lands differently on another build"); continue; }
    if (kept.some((k) => samePictureOfKind(pic, k.pic, pictureGap, within))) { no("same as a kept picture"); continue; }
    // A free kick no easier than the team's own: real direct free kicks go in
    // about 4% of the time (freeKickRules.mts, 2023/24 Premier League), and
    // the drawn ones give a sensible ordinary taker 0-20%. One that gives him
    // more than 1 in 8 over 16 kicks is a gift, not a free kick.
    if (kind === "free_kick" && freeKickRate((i) => {
      const t = buildScenario(kind, mulberry32(entry.seed ^ (i * 7919 + 3)), 62, 60, 55);
      serveEntry(t, entry);
      return t;
    }, 16) > 1 / 8) { no("easier than the team's own free kicks"); continue; }
    // …and a specialist (P85/T85) no more than 1 in 4 (the real best: 12-15%).
    if (kind === "free_kick" && freeKickRate((i) => {
      const t = buildScenario(kind, mulberry32(entry.seed ^ (i * 104729 + 11)), 62, 60, 55);
      serveEntry(t, entry);
      return t;
    }, 16, { power: 85, technique: 85 }) > 1 / 4) { no("easier than the team's own free kicks (specialist)"); continue; }
    // The rest of both teams, as the game adds them, with a formation and
    // playstyle that turn over picture by picture so the sheet shows them all.
    const ctx = { formation: formationOf(FORMS[kept.length % FORMS.length]), playstyle: PLAYSTYLES[STYLES[kept.length % STYLES.length]] };
    const rep = addContext(sc, { ...ctx, laws: set });
    const bodies = [sc.player, sc.keeper, ...sc.defenders.filter((d) => !parked(d)), ...mateBodiesOf(sc).filter((m) => !parked(m))];
    // You are with the ball (a corner's taker stands alone at the flag).
    const stranded = bodies.some((p) => p !== sc.keeper && p !== sc.player && bodies.every((q) => q === p || hyp(p, q) > 15));
    if (stranded) { no("a man stranded 15 m from everyone"); continue; }
    kept.push({ entry, pic });
    const cam = frameForNewView(sc, HW);
    const mark = (p: Vec2 & object) => ({ x: r2(p.x), y: r2(p.y), c: isContext(p) ? 1 : 0 });
    panels.push({
      label: `${entry.id} ${entry.src.replace(/^gen:/, "g:").replace(/gallery-|highlight-|new-/g, "").slice(0, 16)}`,
      facing: sc.facing ?? "up", cam, ball: mark(sc.ball), you: mark(sc.player), keeper: mark(sc.keeper),
      defs: sc.defenders.filter((d) => !parked(d)).map(mark),
      mates: [...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map((r) => r.pos), ...(goalInView(sc.kind) ? [sc.follower] : []), ...sc.teammates].filter((m) => !parked(m)).map((m) => mark(m as Vec2 & object)),
      ctx: rep,
    });
    void withoutContext;
  }
  lib.kinds[kind] = kept.map((k) => k.entry);
  sheets[kind] = panels;
  const top = Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join("; ");
  report.push(`${kind.padEnd(14)} ${String(kept.length).padStart(3)} kept from ${tries} tries${gen ? " (drawings + generator)" : " (drawings)"}   thrown: ${top}`);
}

writeFileSync(new URL("../lib/star/chanceLibrary.json", import.meta.url), JSON.stringify(lib) + "\n");
console.log(report.join("\n"));
if (SHEETS) {
  mkdirSync(SHEETS, { recursive: true });
  for (const [kind, panels] of Object.entries(sheets)) {
    writeFileSync(`${SHEETS}/library-${kind}.json`, JSON.stringify({ title: `NEW LIBRARY — ${kind.replace(/_/g, " ")}: ${panels.length} pictures (new view 38 x 71 m; white ring = rest of the team)`, panels }));
  }
}
