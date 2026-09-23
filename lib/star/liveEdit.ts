/**
 * EDITING A CHANCE YOU ARE PLAYING — the bridge from a live match to a card.
 *
 * Asked for directly: "in the infinite highlights and play area, you should be
 * able to edit the scenarios that you're in mid-game … when you press save
 * there, it should save it into the scenario section of that highlight type
 * and then be able to commit as well."
 *
 * A chance in a real match is not rebuildable from anything: the match builds
 * it from its own running random stream, then lays a drawing over it. But
 * every card in the gallery is a BASE picture (the builder at a fixed seed)
 * plus a drag on top — that is what lets it be shown, edited and committed.
 *
 * So a live chance becomes a card by choosing a base of the same kind and
 * expressing the live picture as a drag on it: every live figure is put where
 * he actually stood, a base figure the live chance does not have is taken out,
 * and a live figure the base has no one for is added. Applying that drag to
 * the base gives back the live picture exactly — that is the whole contract,
 * and it is what tests/star/liveEdit.mts checks.
 *
 * The seed is chosen from a band the gallery never generates (900000+), and
 * among a handful of candidates the one whose camera already frames the whole
 * live picture, so the saved card opens with everyone on screen.
 */

import { buildScenario, type Scenario, type ScenarioKind, type Vec2 } from "./canvasEngine";
import { mulberry32 } from "./season";
import { fixBaseScenario } from "./baseScenario";
import { frameFromScenario, type Frame, type Item } from "./scenarioFrame";
import type { PosOverride } from "./scenarioEdit";

/** Seeds for cards made from a live chance — clear of every generated card. */
export const LIVE_SEED_BASE = 900_000;

/** Anywhere a figure could really be standing — not a parking spot. */
const onPitch = (p: Vec2) => p.x > -20 && p.x < 90 && p.y > -20 && p.y < 130;

type Group = "keeper" | "you" | "opponent" | "teammate";
const groupOf = (it: Item): Group =>
  it.keeper ? "keeper" : it.side === "you" ? "you" : it.side === "opponent" ? "opponent" : "teammate";

/** The base a card starts from — exactly what the gallery rebuilds for it. */
export function baseFor(kind: ScenarioKind, seed: number): Scenario {
  const sc = buildScenario(kind, mulberry32(seed));
  fixBaseScenario(sc);
  return sc;
}

/**
 * The live picture as a drag on `base`. Figures are paired within their own
 * group (keeper, you, opponents, team-mates), nearest first, so the ids that
 * survive are the ones already standing closest — a drag that moves as little
 * as it can.
 */
export function overrideForLive(live: Frame, base: Frame): PosOverride {
  const sameCam = live.camera.x1 === base.camera.x1 && live.camera.x2 === base.camera.x2
    && live.camera.y1 === base.camera.y1 && live.camera.y2 === base.camera.y2;
  const items: Record<string, Vec2> = {};
  const removed: string[] = [];
  const added: { id: string; side: Item["side"] }[] = [];
  let next = 1;

  for (const g of ["keeper", "you", "opponent", "teammate"] as Group[]) {
    // A figure the match has parked off the pitch (a surplus body walked out
    // of play) is not in the picture, so nobody is put there.
    const want = live.items.filter((it) => groupOf(it) === g && onPitch(it.at));
    const have = base.items.filter((it) => groupOf(it) === g);
    const pairs: { w: number; h: number; d: number }[] = [];
    want.forEach((w, wi) => have.forEach((h, hi) => {
      pairs.push({ w: wi, h: hi, d: Math.hypot(w.at.x - h.at.x, w.at.y - h.at.y) });
    }));
    pairs.sort((a, b) => a.d - b.d);
    const usedW = new Set<number>(), usedH = new Set<number>();
    for (const p of pairs) {
      if (usedW.has(p.w) || usedH.has(p.h)) continue;
      usedW.add(p.w); usedH.add(p.h);
      items[have[p.h].id] = { ...want[p.w].at };
    }
    have.forEach((h, hi) => { if (!usedH.has(hi)) removed.push(h.id); });
    want.forEach((w, wi) => {
      if (usedW.has(wi)) return;
      const id = `add${next++}`;
      items[id] = { ...w.at };
      added.push({ id, side: w.side });
    });
  }
  return {
    items,
    ball: { ...live.ball },
    removed: removed.length ? removed : undefined,
    added: added.length ? added : undefined,
    // The match's own framing, so the card shows what was on screen.
    camera: sameCam ? undefined : { ...live.camera },
  };
}

const inside = (f: Frame, p: Vec2, m = 1.5) =>
  p.x >= f.camera.x1 + m && p.x <= f.camera.x2 - m && p.y >= f.camera.y1 + m && p.y <= f.camera.y2 - m;

/**
 * Pick the card for a live chance: a seed of the same kind whose picture
 * frames everyone, the base frame, and the drag that turns it into the live
 * picture. Deterministic for the same live chance.
 */
export function cardForLive(live: Scenario, tries = 40): { seed: number; base: Frame; override: PosOverride } {
  const liveFrame = frameFromScenario(live);
  const everyone = [...liveFrame.items.map((it) => it.at).filter(onPitch), liveFrame.ball];
  let h = 0;
  for (const p of everyone) h = (h * 31 + Math.round(p.x * 10) * 7 + Math.round(p.y * 10)) >>> 0;
  const start = LIVE_SEED_BASE + (h % 90_000);
  let best: { seed: number; base: Frame; score: number } | null = null;
  for (let i = 0; i < tries; i++) {
    const seed = start + i;
    const base = frameFromScenario(baseFor(live.kind, seed));
    const outside = everyone.filter((p) => !inside(base, p)).length;
    const countGap = Math.abs(base.items.length - liveFrame.items.length);
    const score = outside * 100 + countGap;
    if (!best || score < best.score) best = { seed, base, score };
    if (score === 0) break;
  }
  return { seed: best!.seed, base: best!.base, override: overrideForLive(liveFrame, best!.base) };
}
