/**
 * tests/star/chanceJudge.mts — THE JUDGE for Settings → Chances: Old | New
 * (lib/star/newChances.ts; Harry, 14 Oct 2026).
 *
 * Plays 40 seeded matches of the real unseen match (lib/star/matchRadar.ts —
 * startRadar/stepRadar, the same loop as playRadarMatch) and serves every
 * chance it hands you through the REAL chance maker (makeChance), the way
 * CanvasMatch does: one memory of pictures, one selection memory a match,
 * noteServedKind after each. Then prints, for Old and New:
 *
 *   side match  — the drawing's ball on the side of the radar's lane
 *                 (left/right lanes only; the centre lane has no side)
 *   zone match  — the kind served is one the zone offers (open play)
 *   lane match  — … one the zone AND lane offer
 *   repeats     — the same kind twice in a row; most of one kind in any 8
 *   builder     — open play NOT made from a drawing (the hand-written builder)
 *   faults      — servedFaults and scenarioFaults on the served picture
 *   conversion  — each shooting kind, shot by the shot lab's human-like
 *                 thumb (tests/star/shotLab.ts, the shotsPro method)
 *
 * And checks:
 *   - Old is byte-identical to the game before the New work: the same 40
 *     matches serve exactly the same chances (OLD_SIGNATURE, measured on the
 *     code at 37412ab, before any New line existed);
 *   - New's targets: side ≥ 90%, zone ≥ 90%, builder share 0%, no kind twice
 *     in a row, at most 2 of a kind in any 8, conversion per kind within
 *     ±4 points of Old (kinds with 150+ shots each side).
 *
 * With JUDGE_WORST=<folder>, writes the 12 worst New pictures (most faults)
 * to <folder>/chanceJudge-worst.json for a sheet.
 */
import { startRadar, stepRadar, resolveHighlight, radarOver } from "../../lib/star/matchRadar";
import { noteServedKind, kindsForZone, type HiddenMatchInputs, type ScenarioRequest, type Zone } from "../../lib/star/hiddenMatch";
import { makeChance, PictureMemory, pictureOf, servedFaults, sideOf, drawnKindFor } from "../../lib/star/chanceMaker";
import { scenarioFaults } from "../../lib/star/baseScenario";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { forceChancesMode, type ChancesMode } from "../../lib/star/newChances";
import { withoutSwitchedOff } from "../../lib/star/switchedOffKinds";
import { guardAllows } from "../../lib/star/kindMix";
import { mulberry32 } from "../../lib/star/season";
import { dealDribble, newDribbleDeal, isOpenPlay, DRIBBLE_SHARE_BY_LEVEL, type DribbleLevel } from "../../lib/star/dribbleDeal";
import { shoot } from "./shotLab";
import type { ScenarioKind } from "../../lib/star/canvasEngine";
import { writeFileSync, mkdirSync } from "node:fs";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const MATCHES = 40;
const POSITIONS = ["ST", "LW", "RW", "CAM", "ST", "CM", "RW", "LW"];
const SHOOTING: ScenarioKind[] = ["one_on_one", "tight_angle", "long_range", "free_kick", "penalty"];
/** Bot shots per served shooting chance (different thumbs, same picture). */
const SHOTS_EACH = 6;

interface Served {
  match: number; i: number; position: string;
  req: ScenarioRequest; kind: ScenarioKind; how: string; sourceId: string | null;
  openPlay: boolean; sideOk: boolean | null; zoneOk: boolean | null; laneOk: boolean | null;
  served: string[]; base: string[];
  pic: ReturnType<typeof pictureOf>;
  goals: number; shots: number;
}

function inputsFor(i: number): HiddenMatchInputs {
  const r = mulberry32(0xabc + i * 31);
  const team = 55 + Math.floor(r() * 35), opp = 55 + Math.floor(r() * 35);
  return {
    teamStrength: team, oppStrength: opp, home: i % 2 === 0, playerSkill: 60 + Math.floor(r() * 30),
    pace: 70, freeKick: 70, position: POSITIONS[i % POSITIONS.length],
    context: { playstyle: "balanced", teamRelationship: 60, fanRelationship: 50, skills: { pace: 70, power: 65, technique: 65, vision: 60 } },
  };
}

/** The zone's own kinds (switched-off kinds out, thin kinds as New serves them). */
function zoneOffers(zone: Zone, lane: "left" | "centre" | "right" | "any"): Set<string> {
  const ks = lane === "any" ? [...kindsForZone(zone, "centre"), ...kindsForZone(zone, "left")] : kindsForZone(zone, lane);
  const out = new Set<string>(withoutSwitchedOff(ks));
  for (const k of [...out]) out.add(drawnKindFor(k as ScenarioKind));
  return out;
}

/** Dribbles served and open-play chances in the last run(). */
const runCount = { dribbles: 0, open: 0 };

function run(mode: ChancesMode | null, withShots: boolean): Served[] {
  forceChancesMode(mode);
  runCount.dribbles = 0; runCount.open = 0;
  const memory = new PictureMemory(`judge-${mode ?? "default"}`, false);
  const out: Served[] = [];
  for (let mi = 0; mi < MATCHES; mi++) {
    const inputs = inputsFor(mi);
    const position = inputs.position!;
    const m = startRadar(7000 + mi * 13, inputs);
    const rng = mulberry32((0xc4a7ce ^ (mi * 2654435761)) >>> 0);
    const selection = newSelectionMemory();
    const deal = newDribbleDeal();
    const dealRng = mulberry32((0xd21bb1e ^ (mi * 40503)) >>> 0);
    let i = 0;
    for (let guard = 0; guard < 400 && !radarOver(m); guard++) {
      if (!m.pending) { stepRadar(m); continue; }
      const raw = m.pending.request!;
      // New: the deal decides the top-down dribble (lib/star/dribbleDeal.ts),
      // as CanvasMatch's loadScenario does. Old: the match's own request.
      const req = mode === "new" ? dealDribble(raw, "premier", deal, dealRng) : raw;
      if (isOpenPlay(req)) runCount.open++;
      if (req.dribble) runCount.dribbles++;
      if (!req.dribble) {
        const made = makeChance({
          source: { from: "request", request: req, position }, rng,
          strength: { keeper: 62, team: inputs.teamStrength, vision: 60 },
          memory, selection,
        });
        const sc = made.sc;
        noteServedKind(m.state, sc.kind);
        const openPlay = req.pattern !== "set_piece" && req.kinds.length > 1;
        const laneSide = req.lane === "left" ? -1 : req.lane === "right" ? 1 : 0;
        const s: Served = {
          match: mi, i: i++, position, req, kind: sc.kind, how: made.how, sourceId: made.sourceId,
          openPlay,
          sideOk: laneSide === 0 ? null : sideOf(sc.ball) === laneSide,
          zoneOk: openPlay ? zoneOffers(req.zone, "any").has(sc.kind) : null,
          laneOk: openPlay ? zoneOffers(req.zone, req.lane ?? "centre").has(sc.kind) : null,
          served: servedFaults(sc), base: scenarioFaults(sc), pic: pictureOf(sc),
          goals: 0, shots: 0,
        };
        if (withShots && SHOOTING.includes(sc.kind)) {
          for (let k = 0; k < SHOTS_EACH; k++) {
            const r = shoot(sc.kind, (mi * 100003 + s.i * 101 + k * 7 + 1) >>> 0, { scenario: sc });
            s.shots++; if (r.goal) s.goals++;
          }
        }
        out.push(s);
      }
      resolveHighlight(m, "bench-rate");
    }
  }
  forceChancesMode(null);
  return out;
}

// A small, stable hash of everything that was served (FNV-1a over the JSON).
function signature(list: Served[]): string {
  const json = JSON.stringify(list.map((s) => [s.match, s.kind, s.how, s.sourceId, s.pic]));
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) { h ^= json.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${list.length}:${h.toString(16)}`;
}

/** Measured on the code at 37412ab (before any New line): the 40 matches'
 *  served chances, Old. Re-measure only if Old is MEANT to change.
 *  Re-measured 20 Oct 2026 (was 239:18eecdc5): the team redrew and deleted
 *  drawings on 14-15 Oct (lib/star/authoredScenarios.json; first change in
 *  merge a474ed8f, then b56b8641 and 5ca671e6), which is what Old serves.
 *  Checked: today's code with the 14 Oct drawings file still gives
 *  239:18eecdc5, so no New code reached Old; only the drawings moved. The
 *  same reason the play-on fingerprints were re-pinned in 185fba28.
 *  Re-measured 20 Oct 2026 (was 239:bf6f261), B10: headers and volleys joined
 *  the even bag (lib/star/kindMix.ts), which Old deals. Checked: the same code
 *  with the two left out of the bag still gives 239:bf6f261.
 *  Re-measured 22 Oct 2026 (was 239:e7c688f6), bug hunt: 712caeb3 (licensed
 *  numbers re-sourced to free data: back-line shape, keeper depth, real mix)
 *  moved it. Checked: its parent 712caeb3^ still gives 239:e7c688f6, and
 *  712caeb3 itself gives 239:9e68dc38, so that data swap is the whole change.
 *  Re-measured 26 Oct 2026 (was 239:9e68dc38): every byline cross gets a short
 *  option (lib/star/bylineShort.ts, Mikey). Checked: the code just before it
 *  (5b5444ff) still gives 239:9e68dc38; adding the short option alone gives
 *  239:34edfb6f. */
const OLD_SIGNATURE = "239:34edfb6f";

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "  —  ");
function stats(list: Served[]) {
  const wide = list.filter((s) => s.sideOk !== null);
  const open = list.filter((s) => s.openPlay);
  let twice = 0, pairs = 0, worst8 = 0, over2 = 0, windows = 0;
  for (let mi = 0; mi < MATCHES; mi++) {
    const seq = list.filter((s) => s.match === mi).map((s) => s.kind);
    for (let j = 1; j < seq.length; j++) { pairs++; if (seq[j] === seq[j - 1]) twice++; }
    for (let j = 0; j + 8 <= seq.length || (j === 0 && seq.length); j++) {
      const w = seq.slice(j, j + 8);
      const c = new Map<string, number>();
      for (const k of w) c.set(k, (c.get(k) ?? 0) + 1);
      const mx = Math.max(...c.values());
      worst8 = Math.max(worst8, mx); windows++; if (mx > 2) over2++;
      if (j + 8 > seq.length) break;
    }
  }
  // The deal's own guard, checked on every open-play chance against what the
  // match served before it (a set piece is the match's call, not the deal's).
  let broken = 0, brokenTwice = 0;
  for (let mi = 0; mi < MATCHES; mi++) {
    const seq = list.filter((s) => s.match === mi);
    seq.forEach((s, j) => {
      if (!s.openPlay) return;
      const prev = seq.slice(0, j).map((x) => x.kind);
      if (!guardAllows(s.kind, prev)) broken++;
      if (j > 0 && prev[j - 1] === s.kind) brokenTwice++;
    });
  }
  const conv: Record<string, { g: number; n: number }> = {};
  for (const s of list) if (s.shots) { const c = (conv[s.kind] ??= { g: 0, n: 0 }); c.g += s.goals; c.n += s.shots; }
  const mix: Record<string, number> = {};
  for (const s of open) mix[s.kind] = (mix[s.kind] ?? 0) + 1;
  return {
    n: list.length, open: open.length,
    side: [wide.filter((s) => s.sideOk).length, wide.length],
    zone: [open.filter((s) => s.zoneOk).length, open.length],
    lane: [open.filter((s) => s.laneOk).length, open.length],
    twice: [twice, pairs], worst8, over2: [over2, windows], broken, brokenTwice,
    builder: [open.filter((s) => s.how !== "drawing").length, open.length],
    served: [list.filter((s) => s.served.length).length, list.length],
    base: [list.filter((s) => s.base.length).length, list.length],
    conv, mix,
  };
}

console.log("\n== Old is byte-identical to before the New work");
const oldA = run("old", true);
const oldDrib = { ...runCount };
const sigOld = signature(oldA);
const sigDefault = signature(run(null, false));
console.log(`  Old signature ${sigOld}`);
ok(sigOld === sigDefault, "forcing Old serves exactly what the default (Old) serves");
ok(sigOld === OLD_SIGNATURE, `Old serves the same ${oldA.length} chances as the code before the New work (${OLD_SIGNATURE})`);

const newA = run("new", true);
const newDrib = { ...runCount };
const O = stats(oldA), N = stats(newA);

console.log("\n== THE JUDGE — 40 matches, every chance served through makeChance");
const row = (name: string, a: string, b: string) => console.log(`  ${name.padEnd(34)} ${a.padStart(16)} ${b.padStart(16)}`);
row("", "Old", "New");
row("chances served (open play)", `${O.n} (${O.open})`, `${N.n} (${N.open})`);
row("side match (wide lanes)", `${pct(O.side[0], O.side[1])} of ${O.side[1]}`, `${pct(N.side[0], N.side[1])} of ${N.side[1]}`);
row("zone match (open play)", pct(O.zone[0], O.zone[1]), pct(N.zone[0], N.zone[1]));
row("zone + lane match (open play)", pct(O.lane[0], O.lane[1]), pct(N.lane[0], N.lane[1]));
row("top-down dribbles (a match)", `${oldDrib.dribbles} (${(oldDrib.dribbles / MATCHES).toFixed(2)})`, `${newDrib.dribbles} (${(newDrib.dribbles / MATCHES).toFixed(2)})`);
row("  … share of open play", pct(oldDrib.dribbles, oldDrib.open), `${pct(newDrib.dribbles, newDrib.open)} (PL)`);
row("same kind twice in a row", pct(O.twice[0], O.twice[1]), pct(N.twice[0], N.twice[1]));
row("most of one kind in any 8", String(O.worst8), String(N.worst8));
row("8-windows with 3+ of one kind", pct(O.over2[0], O.over2[1]), pct(N.over2[0], N.over2[1]));
row("open play breaking the guard", String(O.broken), String(N.broken));
row("  … of them twice in a row", String(O.brokenTwice), String(N.brokenTwice));
row("open play made by the builder", pct(O.builder[0], O.builder[1]), pct(N.builder[0], N.builder[1]));
row("servedFaults (any)", pct(O.served[0], O.served[1]), pct(N.served[0], N.served[1]));
row("scenarioFaults (any)", pct(O.base[0], O.base[1]), pct(N.base[0], N.base[1]));
console.log("\n  open-play mix:");
const kinds = Array.from(new Set([...Object.keys(O.mix), ...Object.keys(N.mix)])).sort();
for (const k of kinds) row(`    ${k}`, pct(O.mix[k] ?? 0, O.open), pct(N.mix[k] ?? 0, N.open));
console.log(`\n  conversion (shot lab thumb, ${SHOTS_EACH} shots a served chance):`);
const convKinds = Array.from(new Set([...Object.keys(O.conv), ...Object.keys(N.conv)])).sort();
for (const k of convKinds) {
  const a = O.conv[k], b = N.conv[k];
  row(`    ${k}`, a ? `${pct(a.g, a.n)} of ${a.n}` : "—", b ? `${pct(b.g, b.n)} of ${b.n}` : "—");
}

if (process.env.JUDGE_DEBUG) {
  for (const s of newA) if (s.sideOk === false) console.log("  side miss", s.kind, s.how, s.req.lane, s.req.pattern, s.pic.ball);
  for (let mi = 0; mi < MATCHES; mi++) {
    const seq = newA.filter((s) => s.match === mi);
    console.log("  seq", mi, seq.map((s) => `${s.kind}${s.openPlay ? "" : "*"}`).join(" "));
  }
}
console.log("\n== New's targets");
ok(N.side[1] > 0 && N.side[0] / N.side[1] >= 0.9, `side match ≥ 90% (${pct(N.side[0], N.side[1])}, Old ${pct(O.side[0], O.side[1])})`);
ok(N.zone[0] / N.zone[1] >= 0.9, `zone match ≥ 90% (${pct(N.zone[0], N.zone[1])}, Old ${pct(O.zone[0], O.zone[1])})`);
ok(N.builder[0] === 0, `no open play made by the builder (${N.builder[0]}, Old ${O.builder[0]})`);
ok(N.brokenTwice === 0, `open play: never the same kind twice in a row (${N.brokenTwice}, Old ${O.brokenTwice})`);
ok(N.broken === 0, `open play: never a third of one kind in any 8 (${N.broken} broke the guard, Old ${O.broken})`);
// The top-down dribble in the New deal (lib/star/dribbleDeal.ts): its share of
// open play by league, over more matches than the judge (radar + deal only).
const LEAGUE_MATCHES = 300;
function dribbleShare(mode: ChancesMode, level: DribbleLevel) {
  let d = 0, open = 0, twice = 0, unfit = 0;
  for (let mi = 0; mi < LEAGUE_MATCHES; mi++) {
    const m = startRadar(91000 + mi * 17, inputsFor(mi));
    const deal = newDribbleDeal();
    const dealRng = mulberry32((0xd21bb1e ^ (mi * 40503)) >>> 0);
    let last = false;
    for (let guard = 0; guard < 400 && !radarOver(m); guard++) {
      if (!m.pending) { stepRadar(m); continue; }
      const raw = m.pending.request!;
      const req = mode === "new" ? dealDribble(raw, level, deal, dealRng) : raw;
      if (isOpenPlay(req)) open++;
      if (req.dribble) {
        d++; if (last) twice++;
        if (req.zone !== "middle" && req.zone !== "attacking") unfit++;
      }
      if (isOpenPlay(req)) last = !!req.dribble;
      resolveHighlight(m, "bench-rate");
    }
  }
  return { d, open, twice, unfit };
}
console.log(`\n== top-down dribble share of open play by league (${LEAGUE_MATCHES} matches each)`);
const oldShare = dribbleShare("old", "premier");
console.log(`  Old (every league): ${pct(oldShare.d, oldShare.open)} — ${(oldShare.d / LEAGUE_MATCHES).toFixed(2)} a match`);
for (const level of Object.keys(DRIBBLE_SHARE_BY_LEVEL) as DribbleLevel[]) {
  const s = dribbleShare("new", level), want = DRIBBLE_SHARE_BY_LEVEL[level];
  const got = s.d / s.open;
  ok(Math.abs(got - want) <= 0.02 && s.twice === 0 && s.unfit === 0,
    `New ${level.padEnd(12)} ${pct(s.d, s.open)} (${(s.d / LEAGUE_MATCHES).toFixed(2)} a match; table ${(want * 100).toFixed(1)}%, ±2 points), never twice in a row, only in the middle/attacking third`);
}

// Per kind, with enough shots to see ±4 points: CONV_CHANCES served chances
// of each shooting kind, each shot CONV_SHOTS times by the shot lab's thumb.
// Old serves the kind as the gallery does (the coin-flip mirror); New serves
// it through a request on a lane (left / centre / right in turn), so it gets
// New's side. Same seeds both ways (see below).
const CONV_CHANCES = 400, CONV_SHOTS = 2;
const ZONE_OF: Record<string, Zone> = { one_on_one: "box", tight_angle: "box", long_range: "attacking", free_kick: "attacking", penalty: "box" };
function convFor(mode: ChancesMode, kind: ScenarioKind): { g: number; n: number } {
  forceChancesMode(mode);
  let g = 0, n = 0;
  for (let i = 0; i < CONV_CHANCES; i++) {
    // Common random numbers: New's request path draws one number to pick the
    // kind (the guard's deal, or the set-piece roll); after that both use the
    // same stream, so the same drawing and nudge — only the side differs.
    const base = mulberry32((0x5c0 + i * 7919) >>> 0);
    let first = mode === "new";
    const rng = () => (first ? ((first = false), 0.5) : base());
    const lane = (["left", "centre", "right"] as const)[i % 3];
    const setPiece = kind === "free_kick" || kind === "penalty";
    const sc = mode === "old"
      ? makeChance({ source: { from: "kind", kind }, rng, memory: null }).sc
      : makeChance({
        source: { from: "request", position: POSITIONS[i % POSITIONS.length], request: {
          zone: ZONE_OF[kind], kinds: setPiece ? [kind] : [kind, kind], lane, reason: "judge",
          pattern: setPiece ? "set_piece" : "transition",
        } }, rng, memory: null,
      }).sc;
    for (let k = 0; k < CONV_SHOTS; k++) { n++; if (shoot(kind, (i * 104729 + k * 31 + 7) >>> 0, { scenario: sc }).goal) g++; }
  }
  forceChancesMode(null);
  return { g, n };
}
console.log(`\n== conversion per shooting kind (${CONV_CHANCES} chances × ${CONV_SHOTS} shots each way)`);
for (const k of SHOOTING) {
  const a = convFor("old", k), b = convFor("new", k);
  const d = (100 * b.g) / b.n - (100 * a.g) / a.n;
  ok(Math.abs(d) <= 4, `${k}: Old ${pct(a.g, a.n)} → New ${pct(b.g, b.n)} (${d >= 0 ? "+" : ""}${d.toFixed(1)} points, within ±4)`);
}

// The 12 worst New pictures, for a sheet.
const worst = [...newA].sort((a, b) => (b.served.length + b.base.length) - (a.served.length + a.base.length)).slice(0, 12);
const worstTo = process.env.JUDGE_WORST; // a folder (scratch), or nothing written
if (worstTo) {
  mkdirSync(worstTo, { recursive: true });
  writeFileSync(`${worstTo}/chanceJudge-worst.json`, JSON.stringify(worst.map((s) => ({
    match: s.match, i: s.i, kind: s.kind, lane: s.req.lane ?? "centre", zone: s.req.zone, sourceId: s.sourceId,
    faults: [...new Set([...s.served, ...s.base])], picture: s.pic,
  })), null, 1));
  console.log(`\n  12 worst New pictures → ${worstTo}/chanceJudge-worst.json (most faults: ${worst[0]?.served.length ?? 0} + ${worst[0]?.base.length ?? 0})`);
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
