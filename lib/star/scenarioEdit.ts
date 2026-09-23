/**
 * SCENARIO EDITING — the one way a picture is corrected by hand.
 *
 * Lifted out of `app/star-gallery-dev/page.tsx` UNCHANGED, for the same reason
 * `scenarioFrame.ts` was: a second screen (Infinite Highlights,
 * `app/star-highlights-dev/page.tsx`) now drags, adds, removes and saves
 * figures too, and a copy-pasted second copy of this would drift from the
 * gallery's the first time either was touched.
 *
 * `scenarioFrame.ts` is how a `Scenario` becomes a picture. This is how a
 * person's changes go ON TOP of that picture, and back out as a real
 * `MatchScenario`. Nothing here changes game behaviour.
 *
 * ── The override ──
 *
 * Everything is keyed by `Item.id` — `"0"`, `"1"`, … for a figure the builder
 * made, `"add1"`, `"add2"`, … for one put in by hand. Keying by identity
 * rather than array position is what lets a figure be removed without shifting
 * every later figure's edit onto the wrong man.
 */

import { goalInView, type Scenario, type Vec2, type Viewport } from "./canvasEngine";
import type { FigureLook } from "./fiveASide/render";
import type {
  MatchScenario,
  ScenarioMomentKind,
  ScenarioSide,
} from "./scenarios";
import {
  YOU, OPP, MATE,
  marksForFaults,
  splitFaults,
  type Frame,
  type Item,
  type Mark,
} from "./scenarioFrame";

// ─────────────────────────────────────────────────────────────────────────
//  THE OVERRIDE
// ─────────────────────────────────────────────────────────────────────────

/** A per-picture set of editor changes. */
export interface PosOverride {
  items: Record<string, Vec2>;
  ball?: Vec2;
  /** Item ids hidden — a defender taken out of the picture. */
  removed?: string[];
  /** Figures put INTO the picture. Their position lives in `items`, same as
   *  everyone else's, so a new figure is dragged and saved by exactly the
   *  same path a built-in one is. */
  added?: { id: string; side: ScenarioSide }[];
  /** The picture's framing, when it is not the base picture's own — a card
   *  made from a live chance keeps the match's camera (lib/star/liveEdit.ts),
   *  so everyone who was on screen in the match is on screen on the card. */
  camera?: Viewport;
}

export type EditStore = Record<string, PosOverride>;

/** Does this override actually move anything? An empty one is "untouched". */
export function hasEdits(ov: PosOverride | undefined): boolean {
  return !!ov && (
    Object.keys(ov.items).length > 0
    || !!ov.ball
    || !!ov.removed?.length
    || !!ov.added?.length
    || !!ov.camera
  );
}

export function cloneOverride(ov: PosOverride | undefined): PosOverride {
  const items: Record<string, Vec2> = {};
  if (ov) for (const k of Object.keys(ov.items)) items[k] = { ...ov.items[k] };
  return {
    items,
    ball: ov?.ball ? { ...ov.ball } : undefined,
    removed: ov?.removed ? [...ov.removed] : undefined,
    added: ov?.added ? ov.added.map((a) => ({ ...a })) : undefined,
    camera: ov?.camera ? { ...ov.camera } : undefined,
  };
}

/**
 * Two sets of changes as one.
 *
 * The saved scenario and a live drag on top of it are separate overrides, and
 * `applyOverrideToScenario` walks the scenario's own arrays as it goes — so
 * applying them one after another would have the SECOND walk counting a back
 * line the FIRST had already added to or spliced, and putting every edit after
 * that on the wrong man. Merged first, there is only ever one walk.
 */
export function mergeOverrides(ovs: (PosOverride | undefined)[]): PosOverride | undefined {
  const real = ovs.filter((o): o is PosOverride => hasEdits(o));
  if (real.length === 0) return undefined;
  if (real.length === 1) return real[0];
  const items: Record<string, Vec2> = {};
  const removed = new Set<string>();
  const added: { id: string; side: ScenarioSide }[] = [];
  let ball: Vec2 | undefined;
  let camera: Viewport | undefined;
  for (const ov of real) {
    if (ov.camera) camera = { ...ov.camera };
    for (const k of Object.keys(ov.items)) items[k] = { ...ov.items[k] };
    for (const r of ov.removed ?? []) removed.add(r);
    for (const a of ov.added ?? []) if (!added.some((x) => x.id === a.id)) added.push({ ...a });
    if (ov.ball) ball = { ...ov.ball };
  }
  return {
    items,
    ball,
    removed: removed.size ? Array.from(removed) : undefined,
    added: added.length ? added : undefined,
    camera,
  };
}

/** The next free `add…` id for a picture, given everything already on it. */
export function nextAddedId(ovs: (PosOverride | undefined)[]): string {
  let max = 0;
  for (const ov of ovs) {
    for (const a of ov?.added ?? []) {
      const n = Number(a.id.replace(/^add/, ""));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `add${max + 1}`;
}

export const lookFor = (side: ScenarioSide): Omit<FigureLook, "label" | "star"> =>
  side === "opponent" ? OPP : side === "you" ? YOU : MATE;

/**
 * A paint-ready frame with the editor's changes applied over the builder's.
 *
 * Applied in one pass, by id: a removed figure drops out, a moved one moves,
 * and an added one is appended. Composes — the saved scenario is applied
 * first and a live drag on top of it, and because everything is keyed by id
 * the second pass can move or remove a figure the first pass added.
 */
export function applyOverride(frame: Frame, ov: PosOverride | undefined): Frame {
  if (!hasEdits(ov)) return frame;
  const gone = new Set(ov!.removed ?? []);
  const items: Item[] = [];
  for (const it of frame.items) {
    if (gone.has(it.id)) continue;
    items.push(ov!.items[it.id] ? { ...it, at: { ...ov!.items[it.id] } } : it);
  }
  const present = new Set(items.map((it) => it.id));
  for (const a of ov!.added ?? []) {
    if (gone.has(a.id) || present.has(a.id)) continue;
    const at = ov!.items[a.id];
    if (!at) continue;
    items.push({
      id: a.id,
      at: { ...at },
      look: { ...lookFor(a.side), label: a.side === "opponent" ? "OPP" : "MATE" },
      side: a.side,
      removable: true,
    });
  }
  const ball = ov!.ball ? { ...ov!.ball } : frame.ball;
  return ov!.camera ? { ...frame, items, ball, camera: { ...ov!.camera } } : { ...frame, items, ball };
}

/**
 * Push a frame's edited positions BACK onto a real `Scenario`, in the exact
 * order `frameFromScenario` pushed them out — so the fault rules (and the
 * formation transform) are applied to the scenario you are actually looking
 * at, not the raw build.
 */
/** Where a figure that cannot be spliced out of the scenario is walked to
 *  instead — far enough off that nothing measures him. See the removal block
 *  in `applyOverrideToScenario`.
 *
 *  BEHIND the ball, not beyond the goal line. It was (-400, -400): 400m past
 *  the goal is ahead of the ball and past every defender, so a removed
 *  poacher was OFFSIDE — "attacker offside" on a picture where every
 *  attacker you could see was behind the ball (reported by Leo; measured, 3
 *  of 65 saved scenarios, every one with the poacher taken out). Nobody is
 *  offside behind the ball. */
export const OFF_PITCH: Vec2 = { x: -400, y: 400 };

export function applyOverrideToScenario(sc: Scenario, ov: PosOverride | undefined): void {
  if (!hasEdits(ov)) return;
  if (ov!.camera) sc.viewport = { ...ov!.camera };
  const at = (i: number) => ov!.items[String(i)];
  const gone = new Set(ov!.removed ?? []);
  const isGone = (i: number) => gone.has(String(i));

  // Which base index each part of the scenario occupies — the same walk
  // `frameFromScenario` does, recorded as it goes so a removal knows which
  // array to splice.
  const defIdx: number[] = [];
  const secIdx: number[] = [];
  const mateIdx: number[] = [];
  let runnerIdx = -1;
  let followerIdx = -1;

  let i = 0;
  for (const d of sc.defenders) { defIdx.push(i); const p = at(i++); if (p) { d.x = p.x; d.y = p.y; } }
  { const p = at(i++); if (p) { sc.keeper.x = p.x; sc.keeper.y = p.y; } }
  if (sc.runner) { runnerIdx = i; const p = at(i++); if (p) { sc.runner.pos.x = p.x; sc.runner.pos.y = p.y; } }
  for (const r of sc.secondaryRunners) { secIdx.push(i); const p = at(i++); if (p) { r.pos.x = p.x; r.pos.y = p.y; } }
  if (goalInView(sc.kind)) { followerIdx = i; const p = at(i++); if (p) { sc.follower.x = p.x; sc.follower.y = p.y; } }
  for (const t of sc.teammates) { mateIdx.push(i); const p = at(i++); if (p) { t.x = p.x; t.y = p.y; } }
  { const p = at(i++); if (p) { sc.player.x = p.x; sc.player.y = p.y; } }
  if (ov!.ball) { sc.ball.x = ov!.ball.x; sc.ball.y = ov!.ball.y; }

  // ── Figures taken OUT ──
  // Descending, so an earlier splice never shifts a later one. The keeper and
  // YOU are the only two the editor never offers, so they are never here.
  //
  // The poacher is the odd one out: `Scenario.follower` is a single
  // non-nullable field, not an array, so there is no slot to splice and no
  // null to assign — and canvasEngine.ts is never to be edited. Taking him
  // out therefore means walking him far outside the camera, where no fault
  // rule, shot lane or offside line can reach him. That is only ever done to
  // the THROWAWAY scenario this function judges a picture against; the SAVE
  // drops him outright (`frameToMatchScenario` writes `frame.items`, which
  // `applyOverride` has already filtered him out of), so a saved scenario
  // genuinely has no poacher in it rather than one parked in the car park.
  if (followerIdx >= 0 && isGone(followerIdx)) { sc.follower.x = OFF_PITCH.x; sc.follower.y = OFF_PITCH.y; }
  for (let k = mateIdx.length - 1; k >= 0; k--) if (isGone(mateIdx[k])) sc.teammates.splice(k, 1);
  for (let k = secIdx.length - 1; k >= 0; k--) if (isGone(secIdx[k])) sc.secondaryRunners.splice(k, 1);
  if (runnerIdx >= 0 && isGone(runnerIdx)) { sc.runner = null; sc.passTarget = null; }
  for (let k = defIdx.length - 1; k >= 0; k--) if (isGone(defIdx[k])) sc.defenders.splice(k, 1);

  // ── Figures put IN ──
  // An opponent becomes a real defender, so the offside line and every fault
  // rule genuinely count him. A team-mate becomes a support runner (below).
  for (const a of ov!.added ?? []) {
    const p = ov!.items[a.id];
    if (!p || gone.has(a.id)) continue;
    if (a.side === "opponent") sc.defenders.push({ x: p.x, y: p.y, role: "hold", baseRole: "hold" });
    // A team-mate you add is a real SUPPORT runner — he reacts to a ball
    // played near him, can take a pass, can be given an order — not scenery.
    // He used to become one of `sc.teammates`, the decorative bodies, and in
    // Play he stood there while the ball went past him: "in the play thing,
    // teammates don't do anything". A support runner is still not the pass
    // TARGET, so the chance is the same chance; he just plays in it.
    else if (a.side === "teammate") {
      sc.secondaryRunners.push({
        pos: { x: p.x, y: p.y }, to: { x: p.x, y: p.y },
        speed: 7.0 * 0.95, moving: false, role: "support", sprint: false,
      });
    }
  }
}

/**
 * Where a newly added figure goes: the emptiest sensible spot inside the frame.
 *
 * Candidates are a fixed grid inset from the camera's own edges (so nobody is
 * ever dropped half off screen), scored on how far they are from everyone
 * already standing there, with a pull toward the part of the pitch that side
 * belongs in — an opponent between the ball and the goal he is defending, a
 * team-mate alongside the ball. Deterministic: the same picture and the same
 * side always put him in the same place.
 */
export function freeSpotFor(frame: Frame, side: ScenarioSide): Vec2 {
  const vp = frame.camera;
  // Enough room that his NAME, drawn above his head, is inside the frame too.
  const inset = 3.2;
  const x1 = vp.x1 + inset, x2 = vp.x2 - inset;
  const y1 = vp.y1 + inset, y2 = vp.y2 - inset;
  const goalY = frame.goalAtY ?? y1;
  const wantY = side === "opponent"
    ? (frame.ball.y + goalY) / 2
    : frame.ball.y - (frame.ball.y - goalY) * 0.25;

  let best: Vec2 = { x: (x1 + x2) / 2, y: wantY };
  let bestScore = -Infinity;
  const COLS = 7, ROWS = 9;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const at = {
        x: x1 + ((x2 - x1) * (c + 0.5)) / COLS,
        y: y1 + ((y2 - y1) * (r + 0.5)) / ROWS,
      };
      let near = Math.hypot(at.x - frame.ball.x, at.y - frame.ball.y);
      for (const it of frame.items) {
        near = Math.min(near, Math.hypot(at.x - it.at.x, at.y - it.at.y));
      }
      // Room first, then the right part of the pitch for his own shirt.
      const score = Math.min(near, 6) * 2 - Math.abs(at.y - wantY) * 0.35;
      if (score > bestScore) { bestScore = score; best = at; }
    }
  }
  return best;
}

/**
 * Put one figure IN, returning the override that does it.
 *
 * Both screens' "+ Team-mate"/"+ Opponent" go through here, so an added figure
 * gets the same id, the same side and the same landing spot on either.
 */
export function addFigureTo(
  frame: Frame,
  side: ScenarioSide,
  override: PosOverride | undefined,
  alsoInPlay: (PosOverride | undefined)[] = [],
): { override: PosOverride; id: string } {
  const id = nextAddedId([...alsoInPlay, override]);
  const ov = cloneOverride(override);
  ov.items[id] = freeSpotFor(frame, side);
  ov.added = [...(ov.added ?? []), { id, side }];
  return { override: ov, id };
}

/** Take one figure OUT, returning the override that does it. */
export function removeFigureFrom(id: string, override: PosOverride | undefined): PosOverride {
  const ov = cloneOverride(override);
  if ((ov.added ?? []).some((a) => a.id === id)) {
    // Added and removed in the same sitting — drop him outright rather than
    // leaving a figure on the books that is also on the hidden list.
    ov.added = (ov.added ?? []).filter((a) => a.id !== id);
    delete ov.items[id];
  } else {
    ov.removed = [...(ov.removed ?? []), id];
  }
  return ov;
}

// ─────────────────────────────────────────────────────────────────────────
//  WHAT IS WRONG WITH IT, AS IT NOW STANDS
// ─────────────────────────────────────────────────────────────────────────

export interface Analysis {
  /** What is genuinely wrong, in plain English. Red. */
  faults: string[];
  /** A through ball's early runner — the chance, not a fault. Amber. */
  intended: string[];
  marks: Mark[];
}

export const NO_FAULTS: Analysis = { faults: [], intended: [], marks: [] };

/**
 * The faults of a picture AS IT CURRENTLY STANDS — builder output, corrected,
 * with whatever has been saved or dragged on top. RE-DERIVED from a rebuilt
 * `Scenario` rather than captured once, which is what makes a ring move the
 * moment the figure it names does.
 *
 * `build` hands back a fresh scenario (never a shared one — this mutates it),
 * `faultsOf` is whichever judgement that picture is held to: `scenarioFaults`
 * for a base version, `simFaults` for a simulated one.
 */
export function analyseEdited(
  kind: string,
  build: () => Scenario,
  faultsOf: (sc: Scenario) => string[],
  overrides: (PosOverride | undefined)[],
): Analysis {
  const sc = build();
  applyOverrideToScenario(sc, mergeOverrides(overrides));
  const split = splitFaults(kind, faultsOf(sc));
  return {
    faults: split.faults,
    intended: split.intended,
    marks: [
      ...marksForFaults(sc, split.faults, "red"),
      ...marksForFaults(sc, split.intended, "amber"),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  SAVING — into the SAME pool the Scenario Builder writes
// ─────────────────────────────────────────────────────────────────────────

/** MatchScenario.kind names dead-ball/kickoff MOMENTS — a different list from
 *  the engine's chance kinds on purpose. Only three of them line up. */
export function momentKindFor(chanceKind: string): ScenarioMomentKind {
  if (chanceKind === "corner") return "corner";
  if (chanceKind === "free_kick" || chanceKind === "penalty") return "free_kick";
  return "open_play";
}

// +0 turns a rounded -0 back into 0 so the JSON never reads "-0".
export const round2 = (v: number) => Math.round(v * 100) / 100 + 0;
export const roundVec = (v: Vec2) => ({ x: round2(v.x), y: round2(v.y) });

/** Who is saving, and under what id. The two screens address a saved picture
 *  differently — a gallery cell by its cell key, a highlight by the chance's
 *  own `kind-seed-plan` — so the id is passed in rather than derived here. */
export interface SaveTarget {
  id: string;
  name: string;
  /** The canvasEngine chance kind, for `source` and the moment mapping. */
  kind: string;
  seed: number | null;
  planId: string | null;
  tool: "gallery" | "highlights";
}

export function frameToMatchScenario(target: SaveTarget, frame: Frame): MatchScenario {
  const vp = frame.camera;
  return {
    id: target.id,
    name: target.name,
    kind: momentKindFor(target.kind),
    camera: {
      centerX: round2((vp.x1 + vp.x2) / 2),
      centerY: round2((vp.y1 + vp.y2) / 2),
      viewHeight: round2(vp.y2 - vp.y1),
      facing: "up",
    },
    ball: roundVec(frame.ball),
    // `i0`, `i1`, … for the builder's own figures (the exact ids this has
    // always written, so a scenario saved before the editor could add or
    // remove anyone still loads), `iadd1`, `iadd2`, … for added ones. A
    // builder figure that was REMOVED is simply not in the list, which is how
    // a removal survives a save.
    players: frame.items.map((it) => ({
      id: `i${it.id}`,
      side: it.side,
      x: round2(it.at.x),
      y: round2(it.at.y),
      label: it.look.label,
    })),
    updatedAt: Date.now(),
    source: { tool: target.tool, kind: target.kind, seed: target.seed, planId: target.planId },
  };
}

/** The saved positions, back as the index-keyed override — so a saved
 *  scenario is applied through the exact same path a live drag is. */
export function overrideFromMatchScenario(ms: MatchScenario, baseCount: number, baseCamera?: Viewport): PosOverride {
  const items: Record<string, Vec2> = {};
  const added: { id: string; side: ScenarioSide }[] = [];
  const seenBase = new Set<string>();
  ms.players.forEach((p, i) => {
    const id = p.id.startsWith("i") ? p.id.slice(1) : String(i);
    items[id] = { x: p.x, y: p.y };
    if (/^\d+$/.test(id)) seenBase.add(id);
    else added.push({ id, side: p.side });
  });
  // Any builder figure the saved picture does not contain was taken out in
  // the editor — the absence IS the removal.
  const removed: string[] = [];
  for (let i = 0; i < baseCount; i++) if (!seenBase.has(String(i))) removed.push(String(i));
  // The framing, only where the saved picture's differs from the base's —
  // so every card saved on its own base's camera reads exactly as before.
  let camera: Viewport | undefined;
  if (baseCamera) {
    const bw = baseCamera.x2 - baseCamera.x1, bh = baseCamera.y2 - baseCamera.y1;
    const cx = (baseCamera.x1 + baseCamera.x2) / 2, cy = (baseCamera.y1 + baseCamera.y2) / 2;
    const c = ms.camera;
    if (Math.abs(c.centerX - cx) > 0.05 || Math.abs(c.centerY - cy) > 0.05 || Math.abs(c.viewHeight - bh) > 0.05) {
      const w = c.viewHeight * (bw / bh);
      camera = { x1: c.centerX - w / 2, x2: c.centerX + w / 2, y1: c.centerY - c.viewHeight / 2, y2: c.centerY + c.viewHeight / 2 };
    }
  }
  return {
    items,
    ball: { x: ms.ball.x, y: ms.ball.y },
    removed: removed.length ? removed : undefined,
    added: added.length ? added : undefined,
    camera,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  WHERE THE EDITS LIVE BETWEEN VISITS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Unsaved drags, per screen.
 *
 * The key is passed in: the gallery keeps its own `star-gallery-edits-v1`
 * (every edit already on disk still reads), Infinite Highlights keeps its own
 * — they address a picture differently, so sharing one bucket would have one
 * screen's keys landing in the other's.
 */
export function loadEditStore(storageKey: string): EditStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as EditStore) : {};
  } catch {
    return {};
  }
}

export function saveEditStore(storageKey: string, store: EditStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(store));
  } catch {
    /* a dev tool is not worth crashing over a full quota */
  }
}
