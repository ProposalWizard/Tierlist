/**
 * WHERE A BUILD-UP'S CAMERA LANDS (Mikey + Harry, 25 Oct 2026: "we need to
 * review the buildup/camera angles and make sure they all land on the same
 * size").
 *
 *   npx tsx scripts/camera/landing-measure.mts [perKind=20] [--json=<out>]
 *
 * For every chance kind a build-up can come before, ~perKind chances as the
 * match serves them, on a phone's match canvas (390x844: 366 px wide):
 *
 *   NO BUILD-UP  the chance's own frame: matchStill (lib/star/fhr/stillCamera.ts),
 *                the steps CanvasMatch's frameScenario runs.
 *   BUILD-UP     the build-up the match would play before it (the career's
 *                builder: lib/star/fhr/builders.ts), its camera played exactly
 *                as CanvasMatch plays it (leadInCamera(...).at(t, chance) at
 *                60 fps), then the frame at the moment the chance is yours
 *                (CanvasMatch stepLeadIn: the chance's frame) and the men's
 *                height on the glass (leadFigSize while it plays, the chance's
 *                own size after).
 *
 * Prints, per kind, the largest difference between the two at control —
 * zoom (%), centre (px), men (px) — and the largest hand-over jump (the last
 * build-up frame against the first chance frame). A called offside has no
 * chance to land on (the match calls it on the build-up's own camera): counted
 * apart. tests/star/buildupLanding.mts pins the same numbers.
 */
import { writeFileSync } from "node:fs";
import { forceFhrMode } from "../../lib/star/fhr/toggle";
import { forceChancesMode } from "../../lib/star/newChances";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { matchStill } from "../../lib/star/fhr/stillCamera";
import { fhrBuildUpOn } from "../../lib/star/fhr/builders";
import { leadInCamera, leadInEntities, type LeadIn } from "../../lib/star/leadIn";
import { figureShrinkFor, NEW_FIGURE_SCALE, NEW_OUTFIELD_SHRINK } from "../../lib/star/matchView";
import { MATCH_FIGURE_HEIGHT_R, MATCH_FIGURE_R_MULT } from "../../lib/star/fiveASide/render";
import type { Scenario, ScenarioKind, Viewport } from "../../lib/star/canvasEngine";

export const LANDING_KINDS: ScenarioKind[] = ["one_on_one", "tight_angle", "cutback", "long_range", "header", "volley", "through_ball", "byline_cross", "free_kick", "penalty"];
const CANVAS = { w: 366, h: 744 };
const FPS = 60;

export interface LandingRow {
  kind: ScenarioKind; seed: number; offside: boolean;
  /** At control: zoom gap (%), centre gap (px), men's height (px). */
  zoomPct: number; centrePx: number; menPx: number;
  /** The hand-over: last build-up frame against the first chance frame. */
  jumpPx: number; jumpPct: number;
  /** The men's height on the last build-up frame (px). */
  menLastPx: number;
}

const across = (v: Viewport, facing: string) => (facing === "up" ? v.x2 - v.x1 : v.y2 - v.y1);
const centre = (v: Viewport) => ({ x: (v.x1 + v.x2) / 2, y: (v.y1 + v.y2) / 2 });
/** A man's drawn height on the glass, CanvasMatch's figPxOnGlass (new view, Zoom keeps the size). */
const menPx = (v: Viewport, facing: string, shrink: number) => (CANVAS.w / across(v, facing)) * shrink * MATCH_FIGURE_R_MULT * NEW_FIGURE_SCALE * NEW_OUTFIELD_SHRINK * MATCH_FIGURE_HEIGHT_R;

/** One chance: its own frame, and where its build-up's camera lands. */
export function measureLanding(sc0: Scenario, moment: Parameters<typeof fhrBuildUpOn>[1]): LandingRow | null {
  const hw = CANVAS.h / CANVAS.w;
  const still = matchStill(sc0, hw, 20);
  const chance = { ...still.frame.camera };
  const facing = still.frame.facing ?? "up";
  const lead: LeadIn | null = fhrBuildUpOn(JSON.parse(JSON.stringify(sc0)), { ...moment, frame: chance });
  if (!lead) return null;
  const base = figureShrinkFor(sc0.kind, across(chance, facing));
  // The build-up played as CanvasMatch plays it: cam.at each frame, men re-sized by leadFigSize.
  const cam = leadInCamera(lead, leadInEntities(sc0).map((e) => e.key));
  let t = 0, last = cam.at(0, chance);
  for (;;) { const nt = t + 1 / FPS; if (nt >= lead.durS) break; t = nt; last = cam.at(t, chance); }
  const lastShrink = Math.min(1, base * (last.x2 - last.x1) / (chance.x2 - chance.x1));
  // The moment it is yours (stepLeadIn): the chance's frame and the chance's own men's size.
  // A called offside: no chance follows, the match stays on the build-up's last frame (endInOffside).
  const offside = !!lead.offside;
  const ctrl = offside ? cam.at(lead.durS, chance) : chance;
  const ctrlShrink = offside ? lastShrink : base;
  const pxPerM = CANVAS.w / across(ctrl, facing);
  const c0 = centre(chance), c1 = centre(ctrl), cl = centre(last);
  return {
    kind: sc0.kind, seed: moment.seed, offside,
    zoomPct: Math.abs(across(chance, facing) / across(ctrl, facing) - 1) * 100,
    centrePx: Math.hypot(c0.x - c1.x, c0.y - c1.y) * pxPerM,
    menPx: menPx(ctrl, facing, ctrlShrink),
    jumpPx: Math.hypot(cl.x - c1.x, cl.y - c1.y) * pxPerM,
    jumpPct: Math.abs(across(last, facing) / across(ctrl, facing) - 1) * 100,
    menLastPx: menPx(last, facing, lastShrink),
  };
}

/** Up to perKind chances of each kind, as the match serves them, measured. */
export function landingRows(perKind = 20): LandingRow[] {
  forceFhrMode("on"); forceChancesMode("new");
  const rows: LandingRow[] = [];
  const got = new Map<ScenarioKind, number>();
  try {
    for (let batch = 0; batch < 12 && LANDING_KINDS.some((k) => (got.get(k) ?? 0) < perKind); batch++) {
      for (const c of servedChances({ count: 400, seed: 41 + batch * 1009 })) {
        const k = c.sc.kind;
        if (!LANDING_KINDS.includes(k) || (got.get(k) ?? 0) >= perKind) continue;
        // Fresh: an open-play chance gets the generated build-up, a free kick or penalty the foul (some of them).
        const r = measureLanding(c.sc, { ...c.moment, fresh: true });
        if (!r) continue;
        rows.push(r);
        got.set(k, (got.get(k) ?? 0) + 1);
      }
    }
  } finally { forceFhrMode(null); forceChancesMode(null); }
  return rows;
}

export function summarise(rows: LandingRow[]) {
  const per: Record<string, { n: number; offsides: number; zoom: number; centre: number; jump: number; jumpPct: number; menMin: number; menMax: number; menLastMin: number; menLastMax: number }> = {};
  for (const r of rows) {
    const k = (per[r.kind] ??= { n: 0, offsides: 0, zoom: 0, centre: 0, jump: 0, jumpPct: 0, menMin: 1e9, menMax: 0, menLastMin: 1e9, menLastMax: 0 });
    if (r.offside) { k.offsides++; continue; }
    k.n++;
    k.zoom = Math.max(k.zoom, r.zoomPct); k.centre = Math.max(k.centre, r.centrePx);
    k.jump = Math.max(k.jump, r.jumpPx); k.jumpPct = Math.max(k.jumpPct, r.jumpPct);
    k.menMin = Math.min(k.menMin, r.menPx); k.menMax = Math.max(k.menMax, r.menPx);
    k.menLastMin = Math.min(k.menLastMin, r.menLastPx); k.menLastMax = Math.max(k.menLastMax, r.menLastPx);
  }
  return per;
}

if (process.argv[1] && /landing-measure\.mts$/.test(process.argv[1])) {
  const perKind = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 20);
  const out = process.argv.slice(2).find((a) => a.startsWith("--json="))?.slice(7);
  const rows = landingRows(perKind);
  const per = summarise(rows);
  console.log(`Build-up landing, phone canvas ${CANVAS.w}x${CANVAS.h}, up to ${perKind} chances a kind (offsides counted apart: no chance follows)`);
  console.log("kind           n  offside  zoom gap  centre gap  hand-over jump    men at control   men last build-up frame");
  for (const k of LANDING_KINDS) {
    const s = per[k];
    if (!s) { console.log(`${k.padEnd(13)}  — no build-up served`); continue; }
    console.log(`${k.padEnd(13)} ${String(s.n).padStart(2)}  ${String(s.offsides).padStart(7)}  ${s.zoom.toFixed(2).padStart(7)}%  ${s.centre.toFixed(2).padStart(7)} px  ${s.jump.toFixed(2).padStart(6)} px ${s.jumpPct.toFixed(2).padStart(5)}%   ${s.menMin.toFixed(1)}-${s.menMax.toFixed(1)} px      ${s.menLastMin.toFixed(1)}-${s.menLastMax.toFixed(1)} px`);
  }
  if (out) writeFileSync(out, JSON.stringify({ rows, per }, null, 1));
}
