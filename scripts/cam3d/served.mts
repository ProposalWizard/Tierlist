// The chances the real game SERVES (lib/star/chanceMaker.ts makeChance, as CanvasMatch calls it),
// framed as CanvasMatch frames them in the new view, each checked against its kind's own rules
// (baseScenario.ts scenarioFaults). The 3D stills and tests/star/match2dCam.mts use these, never a raw build.
// Usage: npx tsx scripts/cam3d/served.mts   (prints, per kind, how many of 60 served chances break their rules)
import { initDefenders, goalInView, standOff, type Scenario } from "../../lib/star/canvasEngine";
import { makeChance, servesDrawings } from "../../lib/star/chanceMaker";
import { scenarioFaults } from "../../lib/star/baseScenario";
import { mulberry32 } from "../../lib/star/season";
import { frameForNewView, turnWideChance, sideOnFacing } from "../../lib/star/matchView";
import { hasRunup } from "../../lib/star/penaltyRunup";
import { tiltFor } from "../../lib/star/cameraTilt";
import { EVEN_KINDS } from "../../lib/star/kindMix";
import type { Frame2D } from "../../lib/star/style3d/match2dCam";
import type { BcFigure } from "../../lib/star/style3d/broadcastCam";

/** Every kind a match serves: the open-play mix (volley and header are off) and the set pieces. */
export const SERVED_KINDS: string[] = [...EVEN_KINDS, "corner", "free_kick", "penalty"];

export interface Served {
  sc: Scenario; f: Frame2D; figs: (BcFigure & { keeper?: boolean })[]; keeper: { x: number; y: number; drawn: boolean };
  gv: boolean; tiltDeg: number; faults: string[]; drawn: boolean; how: string;
}

/** One served chance of `kind` (seeded), on a W × H pitch box (the 3D match's box on a 390×844 phone: 372×704). */
/** `forceSideOn`: comparison stills only. Turn the chance side-on the way Wide chances "new" would, even where
 *  turnWideChance refuses (it only turns when side-on is the tighter picture). Never used by the game. */
export function servedChance(kind: string, seed: number, W = 372, H = 704, forceSideOn = false): Served {
  const rng = mulberry32(seed * 977 + kind.length * 13);
  const made = makeChance({ source: { from: "kind", kind: kind as Scenario["kind"] }, rng, strength: { keeper: 40 + (seed * 7) % 55, team: 60, vision: 55 } });
  const sc = made.sc;
  initDefenders(sc, rng);
  if (forceSideOn) { sc.facing = sideOnFacing(sc); standOff(sc); } else turnWideChance(sc, !hasRunup(sc.kind), H / W);
  const facing = sc.facing ?? "up";
  const tiltDeg = sc.kind === "corner" || sc.kind === "byline_cross" || facing !== "up" ? 0 : 20;
  const vp = frameForNewView(sc, H / W, false, tiltDeg);
  const f: Frame2D = { viewport: vp, facing, tilt: tiltFor(tiltDeg, W, H), W, H };
  const gv = goalInView(sc.kind);
  const figs: (BcFigure & { keeper?: boolean })[] = [
    { sid: "you", x: sc.player.x, y: sc.player.y, team: "us" },
    ...sc.defenders.map((d, i) => ({ sid: `def${i}`, x: d.x, y: d.y, team: "them" as const })),
    ...sc.teammates.map((t, i) => ({ sid: `mate${i}`, x: t.x, y: t.y, team: "us" as const })),
    ...(sc.runner ? [{ sid: "run0", x: sc.runner.pos.x, y: sc.runner.pos.y, team: "us" as const }] : []),
    ...((sc as unknown as { secondaryRunners?: { pos: { x: number; y: number } }[] }).secondaryRunners ?? []).map((r, i) => ({ sid: `run${i + 1}`, x: r.pos.x, y: r.pos.y, team: "us" as const })),
    { sid: "follower", x: sc.follower.x, y: sc.follower.y, team: "us" },
  ];
  return { sc, f, figs, keeper: { x: sc.keeper.x, y: sc.keeper.y, drawn: gv }, gv, tiltDeg, faults: scenarioFaults(sc), drawn: servesDrawings(kind), how: made.how };
}

/** The first `n` served chances of `kind` that pass the kind's rules (seeds 1, 2, … skipping any that fail). */
export function cleanServed(kind: string, n: number, W = 372, H = 704): (Served & { seed: number })[] {
  const out: (Served & { seed: number })[] = [];
  for (let seed = 1; out.length < n && seed < 400; seed++) {
    const c = servedChance(kind, seed, W, H);
    if (c.faults.length === 0 && c.sc.kind === kind) out.push({ ...c, seed });
  }
  return out;
}

if (process.argv[1]?.includes("served")) {
  for (const kind of SERVED_KINDS) {
    let bad = 0;
    const why: Record<string, number> = {}, hows: Record<string, number> = {};
    for (let s = 1; s <= 60; s++) {
      const c = servedChance(kind, s);
      hows[c.how] = (hows[c.how] ?? 0) + 1;
      if (c.faults.length) { bad++; for (const x of c.faults) why[x] = (why[x] ?? 0) + 1; }
    }
    console.log(kind, "drawn:", servesDrawings(kind), "how", JSON.stringify(hows), "failing rules:", bad, "/ 60", JSON.stringify(why));
  }
}
