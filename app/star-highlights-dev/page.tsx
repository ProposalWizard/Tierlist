"use client";

/**
 * INFINITE HIGHLIGHTS — a hundred real chances, as fast as you can press Next,
 * and the tools to fix one without leaving the screen.
 *
 * Asked for directly: "infinite highlight mode, where I can toggle out of all
 * the highlights in the game. I can toggle which ones I want on — one-on-ones,
 * long shots, free kicks — and then it will choose between just those." Then,
 * once it existed: "the actual infinite highlights page should also have the
 * editor tools in there." Flagging a bad chance and then having to go and hunt
 * for it in the gallery to move one defender is two screens for one job.
 *
 * WHY IT EXISTS. A camera change shipped broken because it was signed off on a
 * measurement of the wrong code path. A test that measures the wrong path
 * passes; a person flicking through a hundred real chances catches it in a
 * minute. So the only thing this screen optimises for is how fast somebody can
 * SEE chances, flag the bad ones and correct one on the spot.
 *
 * NOTHING HERE GENERATES A CHANCE, DRAWS ONE, OR EDITS ONE ON ITS OWN. Every
 * picture comes off the match's own path — `selectChance` → `buildScenario` →
 * `fixBaseScenario` → `applyChancePlan` — through `nextHighlight`
 * (lib/star/gallerySim.ts); it is drawn by the same `paintMarked` the gallery
 * draws with (lib/star/scenarioFrame.ts); and it is dragged, added to, emptied
 * and saved through the same `EditableFrame` + `scenarioEdit.ts` the gallery's
 * version screen uses. A second generator, renderer or editor would quietly
 * disagree with the game and with the gallery, and the disagreement would be
 * invisible — which is the exact failure this tool exists to catch.
 *
 * Everything is SEEDED. A chance is `{ kind, seed, planId }`, so a flagged one
 * — and every edit made to it — rebuilds to the identical picture on any
 * device, any day.
 */

import { isSwitchedOff } from "@/lib/star/switchedOffKinds";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./highlights.css";
import { BroadcastPage, Panel, Pill, Btn, Note } from "@/components/admin/broadcast/BroadcastPage";
import { SCENARIO_KINDS, type ScenarioKind } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import {
  nextHighlight,
  newSimMemory,
  buildSimScenario,
  simFaults,
  pictureKey,
  type SimSpec,
} from "@/lib/star/gallerySim";
import {
  frameFromScenario,
  paintMarked,
  type Frame,
  type Mark,
} from "@/lib/star/scenarioFrame";
import EditableFrame from "@/components/star/EditableFrame";
import PageGuide from "@/components/admin/PageGuide";
import TuningSessionPanel from "@/components/star/TuningSessionPanel";
import { recordSeen } from "@/lib/star/tuningSession";
import { outliersOf } from "@/lib/star/scenarioRules";
import { ruleSetFor, showSavedScenarios } from "@/lib/star/authoredChance";
import { statusOf } from "@/lib/star/scenarioStatus";
import {
  loadCorrections, saveCorrection, makeCorrection, proposalsFrom, fetchSharedCorrections,
  FAULT_LABEL, type Correction,
} from "@/lib/star/scenarioCorrections";
import ScenarioPlay from "@/components/star/ScenarioPlay";
import HitboxPanel from "@/components/star/HitboxPanel";
import ChanceSheet from "@/components/star/ChanceSheet";
import ShootoutPlay from "@/components/star/ShootoutPlay";
import { usePlayWidth, useTestKits } from "@/components/star/EnginePlay";
import { revealOnScreen, pinnedTopHeight } from "@/lib/revealOnScreen";
import { useFhrMode } from "@/lib/star/fhr/toggle";
import { matchStill, matchCanvasHW, withMatchCamera } from "@/lib/star/fhr/stillCamera";
import {
  addFigureTo,
  analyseEdited,
  applyOverride,
  applyOverrideToScenario,
  mergeOverrides,
  frameToMatchScenario,
  hasEdits,
  loadEditStore,
  overrideFromMatchScenario,
  removeFigureFrom,
  saveEditStore,
  NO_FAULTS,
  type Analysis,
  type EditStore,
  type PosOverride,
} from "@/lib/star/scenarioEdit";
import type { MatchScenario, ScenarioSide } from "@/lib/star/scenarios";
import {
  listScenarios,
  fetchSharedScenarios,
  saveScenarioShared,
  deleteScenarioShared,
} from "@/lib/star/scenarioStore";
import {
  loadKinds, saveKinds, allKinds,
  loadFlags, saveFlags, flagId, specOf,
  nextRun, seedForRun,
  type FlaggedChance,
} from "@/lib/star/highlightStore";

const kindLabel = (k: string) => k.replace(/_/g, " ");

/** The order the chips read in — grouped by where on the pitch they happen,
 *  rather than the engine's own declaration order. */
const KIND_ORDER: ScenarioKind[] = ([
  "one_on_one", "tight_angle", "volley", "header", "cutback", "byline_cross",
  "long_range", "through_ball", "midfield_pass", "buildup",
  "penalty", "free_kick", "corner",
] as ScenarioKind[])
  // Volley and header are switched off for now (lib/star/switchedOffKinds.ts).
  .filter(k => !isSwitchedOff(k));

// ─────────────────────────────────────────────────────────────────────────
//  HOW AN EDIT MADE HERE IS ADDRESSED
// ─────────────────────────────────────────────────────────────────────────

/**
 * A chance on this screen has no "cell" to be the fifth version of — it is a
 * chance the generator rolled, and the only thing that names it is the thing
 * that rebuilds it: kind + seed + plan id, which is exactly `flagId`. So an
 * edit is keyed by that, and a SAVED one lands at `highlight-<that>`.
 *
 * Deliberately a different namespace from the gallery's `gallery-<cellKey>`:
 * the gallery addresses a fixed version of a kind, this addresses one rolled
 * chance, and the same seed can mean different pictures under different plans
 * (a gallery sim key drops the plan id; this one keeps it). Each screen reads
 * back only its own rows — by tool AND by id prefix — so neither can pick up
 * or overwrite the other's work.
 */
const EDIT_KEY = "star-highlights-edits-v1";
/**
 * ONE PLACE FOR A SAVED CHANCE: the gallery's own list for that kind.
 *
 * A save made here used to land in its own `highlight-…` namespace, which the
 * gallery deliberately never read — so a chance saved while playing Infinite
 * Highlights did not become one of that kind's scenarios anywhere you could
 * see it. Asked for directly: "when you press save there, it should save it
 * into the scenario section of that highlight type and then be able to commit
 * as well." It is now saved exactly as the gallery saves a simulated chance
 * (`gallery-sim-<kind>-<seed>`, rebuilt from the same kind + seed + plan), so
 * it shows as a card of its kind, counts in that kind's number and commits
 * like any other. Rows saved the old way are still read — see
 * `indexHighlights` — so nothing already saved is lost.
 */
const highlightSlug = (spec: SimSpec) => `gallery-sim-${spec.kind}-${spec.seed}`;
const legacySlug = (spec: SimSpec) => `highlight-${flagId(spec)}`;

const saveTargetFor = (spec: SimSpec) => ({
  id: highlightSlug(spec),
  name: `${kindLabel(spec.kind)} (sim)`,
  kind: spec.kind as string,
  seed: spec.seed,
  planId: spec.planId,
  tool: "gallery" as const,
});

function indexHighlights(all: MatchScenario[]): Record<string, MatchScenario> {
  const out: Record<string, MatchScenario> = {};
  for (const sc of all) {
    if (sc.id.startsWith("gallery-sim-")) out[sc.id] = sc;
  }
  // An old-style save, under the new address unless a new-style one exists.
  for (const sc of all) {
    if (sc.source?.tool !== "highlights" || !sc.id.startsWith("highlight-") || !sc.source.kind) continue;
    const at = `gallery-sim-${sc.source.kind}-${sc.source.seed}`;
    if (!out[at]) out[at] = sc;
  }
  return out;
}
void legacySlug;

// ─────────────────────────────────────────────────────────────────────────
//  ONE CHANCE — built and framed. Exactly the gallery's own path.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A chance as it came out of the generator.
 *
 * Deliberately holds NO faults and NO rings. Those are re-derived from the
 * current edits every render (`analysisFor`), because the whole point of the
 * editor is that dragging a defender changes what is wrong with the picture —
 * a fault captured once at build time would be a stale answer to a question
 * that has moved.
 */
interface Shot {
  spec: SimSpec;
  /** The builder's own frame, before any edit. */
  base: Frame;
  /** Every body on the pitch to the metre, for the repeat check. */
  picture: string;
  /** Where the ball starts, for the Tuning panel's "how deep / which wing". */
  ball: { x: number; y: number };
}

function buildShot(spec: SimSpec): Shot {
  const sc = buildSimScenario(spec);
  return { spec, base: frameFromScenario(sc), picture: pictureKey(sc), ball: { x: sc.ball.x, y: sc.ball.y } };
}

/** What is wrong with this chance AS IT NOW STANDS — the saved correction and
 *  the unsaved drag both counted. One call, the gallery's own. */
function analysisFor(spec: SimSpec, overrides: (PosOverride | undefined)[]): Analysis {
  return analyseEdited(
    spec.kind,
    () => buildSimScenario(spec),
    (sc) => simFaults(sc, spec.planId),
    overrides,
  );
}

/** The flagged list's small picture. Same paint, scaled down by the browser. */
function FlagThumb({ frame, marks, width = 72 }: { frame: Frame; marks: Mark[]; width?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    paintMarked(ref.current, frame, marks);
    ref.current.style.width = `${width}px`;
    ref.current.style.height = "auto";
    ref.current.style.display = "block";
  }, [frame, marks, width]);
  return <canvas ref={ref} />;
}

/** One chance in the "Previous chances" strip: the chance itself as it now
 *  stands (saved fix and unsaved drag on top), painted by the same paint. */
function StripThumb({
  shot, saved, override, n, current, onPick, kits,
}: {
  shot: Shot;
  kits: ReturnType<typeof useTestKits>;
  saved: MatchScenario | undefined;
  override: PosOverride | undefined;
  n: number;
  current: boolean;
  onPick: () => void;
}) {
  const frame = useMemo(() => {
    const savedOv = saved ? overrideFromMatchScenario(saved, shot.base.items, shot.base.camera, shot.base.facing) : undefined;
    return applyOverride(applyOverride(shot.base, savedOv), override);
  }, [shot, saved, override]);
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    // Small, in the kits the big picture wears; the browser scales it to fit.
    paintMarked(ref.current, frame, [], { baseW: 168, maxW: 168, maxH: 2000 }, kits ?? undefined);
    ref.current.style.width = "100%";
    ref.current.style.height = "auto";
  }, [frame, kits]);
  // The one on screen slides into view along the strip — sideways only, so
  // the page itself never jumps down to the strip.
  const btnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const el = btnRef.current;
    const box = el?.parentElement;
    if (!el || !box || !current) return;
    box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2;
  }, [current]);
  return (
    <button
      className="ih-thumb"
      aria-current={current ? "true" : undefined}
      aria-label={`Chance ${n}: ${kindLabel(shot.spec.kind)}`}
      title={`#${shot.spec.seed}`}
      onClick={onPick}
      ref={btnRef}
    >
      <canvas ref={ref} />
      <span><i>{n}</i>{kindLabel(shot.spec.kind)}</span>
    </button>
  );
}

/** One row of the flagged list — its own component so each rebuilds and
 *  re-judges its own chance, edits and all, rather than the list doing it. */
function FlagRow({
  flag, saved, override, onShow,
}: {
  flag: FlaggedChance;
  saved: MatchScenario | undefined;
  override: PosOverride | undefined;
  onShow: (shot: Shot) => void;
}) {
  const spec = specOf(flag);
  const shot = useMemo(() => buildShot(spec), [flag.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const savedOv = saved ? overrideFromMatchScenario(saved, shot.base.items, shot.base.camera, shot.base.facing) : undefined;
  const frame = applyOverride(applyOverride(shot.base, savedOv), override);
  const analysis = useMemo(
    () => analysisFor(spec, [savedOv, override]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flag.id, saved, override],
  );
  return (
    <div className="ih-frow">
      <FlagThumb frame={frame} marks={analysis.marks} />
      <div className="ih-frow-txt">
        <b>{kindLabel(flag.kind)}</b>
        <small title={flag.planId ?? "base"}>#{flag.seed} · {flag.planId ?? "base"}</small>
        {analysis.faults.length > 0 && <em>{analysis.faults[0]}</em>}
        {saved && <strong>Saved</strong>}
      </div>
      <button aria-label="Show this one" onClick={() => onShow(shot)}>&#8250;</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  THE PAGE
// ─────────────────────────────────────────────────────────────────────────

type Screen = "run" | "kinds" | "flags" | "sheet" | "shootout";

export default function HighlightsPage() {
  const [screen, setScreen] = useState<Screen>("run");
  const [kinds, setKinds] = useState<ScenarioKind[]>(allKinds());
  const [flags, setFlags] = useState<FlaggedChance[]>([]);
  /** Everything served this visit, so you can step back to one you just passed. */
  const [hist, setHist] = useState<Shot[]>([]);
  const [idx, setIdx] = useState(-1);
  const [ready, setReady] = useState(false);
  /** Which figure is tapped, for the add/remove controls. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** The picture's width, and Play's: the real match's on a phone, bigger on
   *  a laptop with the same drag feel (see EnginePlay's `width`). */
  const pictureW = usePlayWidth();
  /** The kits Play will wear, so pressing Play changes no colours. */
  const kits = useTestKits();
  /** The Play overlay is open — see ScenarioPlay. */
  const [playing, setPlaying] = useState(false);
  const pictureRef = useRef<HTMLDivElement>(null);
  const togglePlay = () => setPlaying((v) => !v);
  /** Every correction recorded so far, so Tune can say whether this one just
   *  completed a pattern. Same store the gallery and Tuning & Commit read —
   *  a correction made here counts exactly as much as one made there. */
  const [corrections, setCorrections] = useState<Correction[]>([]);
  // This browser's copy first (instant), then the team's — see
  // fetchSharedCorrections. Three people's corrections now add up.
  useEffect(() => {
    setCorrections(loadCorrections());
    void fetchSharedCorrections().then((r) => setCorrections(r.corrections));
  }, []);

  // A full-screen dev tool: the site's own nav and footer get out of the way,
  // exactly as /star-gallery-dev does it (globals.css's immersive class).
  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  // A dev tool: sees the team's saved drawings on top of the committed ones.
  // The game never does — see showSavedScenarios.
  useEffect(() => {
    showSavedScenarios(true);
    return () => showSavedScenarios(false);
  }, []);

  /** The seeded stream. One per visit, carried across every press — the
   *  anti-repeat is `selectChance`'s own memory and lives in here. */
  const stream = useRef<{ rng: () => number; mem: ReturnType<typeof newSimMemory>; last?: string } | null>(null);

  useEffect(() => {
    setKinds(loadKinds());
    setFlags(loadFlags());
    if (!stream.current) stream.current = { rng: mulberry32(seedForRun(nextRun())), mem: newSimMemory() };
    setReady(true);
  }, []);

  const selected = useMemo(() => new Set(kinds), [kinds]);

  // ── Edits, exactly the gallery's store shape under this screen's own key ──
  const [edits, setEdits] = useState<EditStore>({});
  useEffect(() => {
    const loaded = loadEditStore(EDIT_KEY);
    if (Object.keys(loaded).length) setEdits(loaded);
  }, []);
  const setOverride = useCallback((key: string, ov: PosOverride) => {
    setEdits((prev) => {
      let next: EditStore;
      if (hasEdits(ov)) next = { ...prev, [key]: ov };
      else { next = { ...prev }; delete next[key]; }
      saveEditStore(EDIT_KEY, next);
      return next;
    });
  }, []);
  const clearOverride = useCallback((key: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      saveEditStore(EDIT_KEY, next);
      return next;
    });
  }, []);

  // ── Saved corrections (the same pool the gallery and the Builder write) ──
  const [saved, setSaved] = useState<Record<string, MatchScenario>>({});
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [busy, setBusy] = useState<"saving" | "reverting" | "deleting" | "committing" | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setSaved(indexHighlights(listScenarios()));
    void fetchSharedScenarios().then((r) => {
      setSaved(indexHighlights(listScenarios()));
      if (r.migrationMissing) setMigrationMissing(true);
    });
  }, []);

  const flashFor = (ok: boolean, text: string) => {
    setFlash({ ok, text });
    window.setTimeout(() => setFlash(null), 6000);
  };

  const draw = useCallback((): Shot | null => {
    const st = stream.current;
    if (!st || kinds.length === 0) return null;
    const spec = nextHighlight(kinds, st.rng, st.mem, st.last);
    if (!spec) return null;
    const shot = buildShot(spec);
    st.last = shot.picture;
    // Counted once per chance drawn, not per step back to it (Tuning panel).
    recordSeen({ page: "highlights", kind: spec.kind, ball: shot.ball, seed: spec.seed });
    return shot;
  }, [kinds]);

  /**
   * Next.
   *
   * Deliberately NOT a side effect inside a `setIdx` updater — React runs an
   * updater twice in development's strict mode, which would pull two chances
   * off the seeded stream for one press and quietly drop one of them.
   */
  const next = useCallback(() => {
    setSelectedId(null);
    if (idx < hist.length - 1) { setIdx(idx + 1); return; }
    const shot = draw();
    if (!shot) return;
    setHist((h) => [...h, shot]);
    setIdx(hist.length);
  }, [idx, hist.length, draw]);

  const prev = useCallback(() => {
    setSelectedId(null);
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  // Every new chance comes up with its whole picture on screen, under the
  // sticky bar: a phone's big Next sits under a 586 px picture, so pressing
  // it used to leave the next picture half above the screen.
  useEffect(() => {
    const id = requestAnimationFrame(() => revealOnScreen(pictureRef.current?.firstElementChild));
    return () => cancelAnimationFrame(id);
  }, [idx]);

  // First chance as soon as there is a stream to draw it from. Guarded by a
  // ref for the same strict-mode reason: the effect runs twice on mount.
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current || !kinds.length) return;
    started.current = true;
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, kinds.length]);

  const shot = idx >= 0 ? hist[idx] : null;

  // ── What is on screen right now: the builder's picture, the saved
  //    correction on top of it, and whatever is being dragged on top of that ──
  const editKey = shot ? flagId(shot.spec) : "";
  const savedScenario = shot ? saved[highlightSlug(shot.spec)] : undefined;
  const savedOv = shot && savedScenario
    ? overrideFromMatchScenario(savedScenario, shot.base.items, shot.base.camera, shot.base.facing)
    : undefined;
  const override = shot ? edits[editKey] : undefined;
  const edited = hasEdits(override);
  const baseFrame = shot ? applyOverride(shot.base, savedOv) : null;
  /** Drawings of this kind that disagree with one of its own laws. The rule
   *  set survives a slip (see INVARIANT_AGREEMENT) but the slip is shown. */
  /**
   * Throw this chance away as not worth fixing.
   *
   * Different from the flag (⚑), which means "look at this". A bin means
   * "this should never exist" — it is never served again, and it remembers
   * which authored drawing built it, so a drawing that keeps producing bad
   * chances shows up in `binsByBase` rather than having to be guessed at.
   */

  const ruleOutliers = useMemo(
    () => (shot ? outliersOf(ruleSetFor(shot.spec.kind) ?? { kind: "", n: 0, rules: [] }) : []),
    [shot, saved],
  );
  const liveFrame = baseFrame ? applyOverride(baseFrame, override) : null;

  // ── Full highlights rebuild: On — the still is the match's camera ──
  // (lib/star/fhr/stillCamera.ts). Framed from the scenario Play will build
  // (the same build + edits), at the canvas shape the match will measure
  // (the room under the pinned bars, CanvasMatch's newViewCanvasHeight), so
  // pressing Play moves nothing. Off: today's still, untouched.
  const fhrOnHere = useFhrMode() === "on";
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const on = () => setRoom(window.innerHeight - pinnedTopHeight(pictureRef.current) - 12);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [shot]);
  const still = useMemo(() => {
    if (!fhrOnHere || !shot) return null;
    const sc = buildSimScenario(shot.spec);
    applyOverrideToScenario(sc, mergeOverrides([savedOv, override]));
    return matchStill(sc, matchCanvasHW(pictureW, room));
  }, [fhrOnHere, shot, savedOv, override, pictureW, room]);
  const shownBase = baseFrame && still ? withMatchCamera(baseFrame, still) : baseFrame;
  const shownCam = shownBase?.camera;


  /** A PNG of exactly what is on screen, for sharing a bad picture without
   *  needing anybody to reproduce it. */
  const downloadShot = useCallback(() => {
    if (!shot || !baseFrame) return;
    const c = document.createElement("canvas");
    // No fault rings: this is a picture of the SCENARIO, and a ring is a
    // note about it. Anyone the PNG is sent to wants the chance, not the
    // annotation.
    paintMarked(c, applyOverride(baseFrame, override), []);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${shot.spec.kind}-${shot.spec.seed}.png`;
    a.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, baseFrame, override]);
  const analysis: Analysis = useMemo(
    () => (shot ? analysisFor(shot.spec, [savedOv, override]) : NO_FAULTS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shot, savedScenario, override],
  );

  // ── Adding and removing figures. Identical rules to the gallery's: the
  //    keeper, the poacher and YOU are not removable. ──
  const selectedItem = liveFrame?.items.find((it) => it.id === selectedId);
  const canRemove = !!selectedItem?.removable;

  const addFigure = (side: ScenarioSide) => {
    if (!liveFrame || !shot) return;
    const { override: ov, id } = addFigureTo(liveFrame, side, override, [savedOv]);
    setOverride(editKey, ov);
    setSelectedId(id);
  };
  const removeFigure = (id: string) => {
    setOverride(editKey, removeFigureFrom(id, override));
    setSelectedId(null);
  };

  // ── Saving. "Saved" only ever means the SERVER said so. ──
  const saveShot = async (): Promise<void> => {
    if (!shot || !liveFrame) return;
    setBusy("saving");
    const scenario = frameToMatchScenario(saveTargetFor(shot.spec), liveFrame);
    const res = await saveScenarioShared(scenario);
    setBusy(null);
    if (res.migrationMissing) setMigrationMissing(true);
    if (!res.ok) { flashFor(false, `Not saved — ${res.message}`); return; }
    setSaved((m) => ({ ...m, [scenario.id]: scenario }));
    clearOverride(editKey);
    flashFor(true, "Saved for the team. It goes into the game when you commit it.");
  };

  /**
   * COMMIT — straight into the game, from the highlight you are looking at.
   * Asked for directly: every highlight "should save it into the scenario
   * section of that highlight type and then be able to commit as well" — and
   * reported: "there is no save and commit buttons inside a match highlight".
   * Save only appeared after a drag and there was no Commit here at all. The
   * commit route also saves the same copy to the shared list, so this is a
   * save and a commit in one.
   */
  const commitShot = async (): Promise<void> => {
    if (!shot || !liveFrame) return;
    setBusy("committing");
    const scenario = frameToMatchScenario(saveTargetFor(shot.spec), liveFrame);
    try {
      const r = await fetch("/api/star/scenarios/commit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const d = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };
      if (!r.ok || d.ok !== true) { flashFor(false, `Not committed — ${d.error ?? `the server refused it (${r.status})`}`); return; }
      setSaved((m) => ({ ...m, [scenario.id]: scenario }));
      clearOverride(editKey);
      flashFor(true, d.message ?? "Committed — in the game once the deploy finishes.");
    } catch {
      flashFor(false, "Not committed — couldn't reach the server.");
    } finally {
      setBusy(null);
    }
  };

  const revertShot = async (): Promise<void> => {
    if (!shot) return;
    setBusy("reverting");
    const id = savedScenario?.id ?? highlightSlug(shot.spec);
    const key = highlightSlug(shot.spec);
    const res = await deleteScenarioShared(id);
    setBusy(null);
    if (res.migrationMissing) setMigrationMissing(true);
    if (!res.ok) { flashFor(false, `Not reverted — ${res.message}`); return; }
    setSaved((m) => { const n = { ...m }; delete n[key]; return n; });
    clearOverride(editKey);
    flashFor(true, "Back to the generated chance.");
  };

  /**
   * TUNE — record WHAT WAS WRONG with this chance, without saving it.
   *
   * The gallery has had this since corrections existed; this screen never
   * did, which is most of why "some of the tuning stuff doesn't work so
   * well" — the screen you actually flick through chances on was the one
   * screen that could not record a correction from one.
   *
   * Identical to the gallery's `tuneCell`, on purpose: same `makeCorrection`,
   * same store, same threshold. A correction is a note about a generated
   * chance, not a drawing to serve — so this deliberately does NOT save the
   * picture, and the drag is cleared once it is recorded.
   */
  const tuneShot = (): void => {
    if (!shot || !liveFrame) return;
    const target = saveTargetFor(shot.spec);
    const before = frameToMatchScenario(target, shot.base);
    const after = frameToMatchScenario(target, liveFrame);
    const c = makeCorrection(highlightSlug(shot.spec), shot.spec.kind, before, after);
    setCorrections(saveCorrection(c));
    clearOverride(editKey);
    if (!c.moves.length) { flashFor(false, "Nothing moved — no correction recorded."); return; }
    if (!c.faults.length) {
      flashFor(true, "Recorded. It repaired nothing measurable, so it is not evidence for a rule.");
      return;
    }
    const near = proposalsFrom([...corrections.filter((x) => x.id !== c.id), c])
      .find((pr) => pr.kind === shot.spec.kind && c.faults.includes(pr.fault));
    flashFor(true, near
      ? `Recorded — ${near.count} now agree. A rule is proposed — ask Claude in the terminal for the tuner proposals.`
      : `Recorded: ${FAULT_LABEL[c.faults[0]]}. It stays quiet until a few more agree.`);
  };

  /**
   * DELETE — everywhere, database AND code.
   *
   * Different from Revert, which only takes it out of the database and leaves
   * a committed copy in the build still serving. Asked for directly on the
   * call: "make a delete button... so you press delete and it asks, 'Are you
   * sure?' and it actually gets rid of that scenario, no matter what it is."
   * Same two steps, same wording and the same honest tail when the code half
   * fails, as the gallery's own Delete.
   */
  const deleteShot = async (): Promise<void> => {
    if (!shot) return;
    if (!savedScenario) { flashFor(false, "Nothing saved for this chance — there is nothing to delete."); return; }
    const q = `Delete this ${kindLabel(shot.spec.kind)} scenario everywhere — the database and the code? This cannot be undone here.`;
    if (typeof window !== "undefined" && !window.confirm(q)) return;
    setBusy("deleting");
    const id = savedScenario.id;
    const key = highlightSlug(shot.spec);
    const shared = await deleteScenarioShared(id);
    let repoTail = "";
    try {
      const r = await fetch("/api/star/scenarios/commit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json().catch(() => null) as { error?: string } | null;
      if (!r.ok) repoTail = ` — still in the code (${d?.error ?? r.status})`;
    } catch {
      repoTail = " — couldn't reach the server to remove it from the code";
    }
    setBusy(null);
    if (shared.migrationMissing) setMigrationMissing(true);
    setSaved((m) => { const n = { ...m }; delete n[key]; return n; });
    clearOverride(editKey);
    flashFor(!repoTail, shared.ok ? `Deleted${repoTail}.` : `Not deleted — ${shared.message}`);
  };

  // ── Flagging ──
  const flaggedNow = shot ? flags.some((f) => f.id === flagId(shot.spec)) : false;
  const toggleFlag = useCallback(() => {
    if (!shot) return;
    const id = flagId(shot.spec);
    setFlags((prev) => {
      const next = prev.some((f) => f.id === id)
        ? prev.filter((f) => f.id !== id)
        : [{ id, kind: shot.spec.kind, seed: shot.spec.seed, planId: shot.spec.planId, at: Date.now() }, ...prev];
      saveFlags(next);
      return next;
    });
  }, [shot]);

  // ── Keys. Right/space/enter is Next, left steps back, F flags. ──
  useEffect(() => {
    if (screen !== "run") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFlag(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, next, prev, toggleFlag]);

  const setKindsAnd = (ks: ScenarioKind[]) => {
    setKinds(ks);
    saveKinds(ks);
    // The pool changed, so what is queued ahead of you no longer belongs to it.
    setHist(shot ? [shot] : []);
    setIdx(shot ? 0 : -1);
    setSelectedId(null);
  };
  const toggleKind = (k: ScenarioKind) =>
    setKindsAnd(selected.has(k) ? kinds.filter((x) => x !== k) : [...kinds, k]);

  const shell = (children: React.ReactNode) => (
    <main
      data-hl-kind={shot?.spec.kind ?? ""}
      data-hl-seed={shot?.spec.seed ?? ""}
      data-hl-plan={shot?.spec.planId ?? ""}
      data-hl-picture={shot?.picture ?? ""}
      data-hl-faults={shot ? analysis.faults.length : ""}
      data-hl-fault={analysis.faults[0] ?? ""}
      data-hl-count={hist.length}
      data-hl-selected={selectedId ?? ""}
      data-hl-edited={edited ? "1" : ""}
      data-hl-figures={liveFrame ? liveFrame.items.length : ""}
    >
      {children}
      <PageGuide page="/star-highlights-dev" />
    </main>
  );

  // ── KINDS ──
  if (screen === "kinds") {
    return shell(
      <BroadcastPage title="Which highlights" sub="Tap the kinds of chance to show." back={() => setScreen("run")} width={1100}>
        {/* v0.15 item 7: a whole penalty shootout on the real match — every
            kick live, yours to take when your turn comes. */}
        <button className="ih-shootout" onClick={() => setScreen("shootout")}>⚽ Play a penalty shootout</button>
        <Panel title="Chance types" note={<span className="ih-count">{kinds.length}/{allKinds().length}</span>}>
          <div className="ih-tools">
            <Btn onClick={() => setKindsAnd(allKinds())}>All</Btn>
            <Btn onClick={() => setKindsAnd([])}>None</Btn>
          </div>
          <div className="ih-chips">
            {KIND_ORDER.map((k) => (
              <Pill key={k} on={selected.has(k)} onClick={() => toggleKind(k)}>{kindLabel(k)}</Pill>
            ))}
          </div>
        </Panel>
        <div className="ih-watch">
          <button className="ih-next" onClick={() => setScreen("run")} disabled={kinds.length === 0}>Watch these</button>
        </div>
      </BroadcastPage>,
    );
  }

  // ── SHEET OF 24 ── (components/star/ChanceSheet.tsx) — every generated
  // picture is checked by eye; this puts 24 of one kind on one screen.
  if (screen === "sheet") {
    return shell(
      <BroadcastPage title="Sheet of 24" sub="Twenty-four chances of one kind, to check by eye." back={() => setScreen("run")}>
        <ChanceSheet kinds={kinds.length ? kinds : allKinds()} kits={kits} onBack={() => setScreen("run")} />
      </BroadcastPage>,
    );
  }

  // ── SHOOTOUT (v0.15 item 7) ──
  if (screen === "shootout") {
    return shell(
      <BroadcastPage title="Penalty shootout" sub="Every kick live. Yours to take when your turn comes." back={() => setScreen("kinds")}>
        <div style={{ display: "grid", justifyItems: "center" }}>
          <ShootoutPlay width={pictureW} onExit={() => setScreen("run")} />
        </div>
      </BroadcastPage>,
    );
  }

  // ── FLAGS ──
  if (screen === "flags") {
    return shell(
      <BroadcastPage
        title={`Flagged (${flags.length})`}
        sub="The chances you marked. Tap one to see it again."
        back={() => setScreen("run")}
        actions={flags.length ? <Btn onClick={() => { setFlags([]); saveFlags([]); }}>Clear</Btn> : undefined}
      >
        {flags.length === 0 ? (
          <Panel><div className="ih-empty">Nothing flagged yet.</div></Panel>
        ) : (
          <div className="ih-flags">
            {flags.map((f) => (
              <FlagRow
                key={f.id}
                flag={f}
                saved={saved[highlightSlug(specOf(f))]}
                override={edits[f.id]}
                onShow={(s) => {
                  setHist((h) => [...h, s]);
                  setIdx(hist.length);
                  setSelectedId(null);
                  setScreen("run");
                }}
              />
            ))}
          </div>
        )}
      </BroadcastPage>,
    );
  }

  // ── RUN ──
  const status = shot ? statusOf(savedScenario ?? null) : null;
  const statusTone = !status ? undefined : edited || status.state === "draft" ? "amber" : status.state === "committed" ? "green" : "blue";
  const tunes = status ? (edited ? false : status.tuning) : false;
  /** The strip shows the last 24 chances of this visit, oldest first. */
  const STRIP = 24;
  const stripFrom = Math.max(0, hist.length - STRIP);

  const tools = (
    <div className="ih-tools">
      <Btn onClick={() => setScreen("kinds")} title="Choose highlights">
        Highlights <span className="ih-count">{kinds.length}/{allKinds().length}</span>
      </Btn>
      <Btn onClick={() => setScreen("sheet")} title="Sheet of 24: 24 of one kind on one screen">&#9638; Sheet of 24</Btn>
      <Btn onClick={() => setScreen("flags")} title="Flagged list">&#9873; Flagged <span className="ih-count">{flags.length}</span></Btn>
    </div>
  );

  return shell(
    <BroadcastPage
      title="Infinite Highlights"
      sub="Flick through real chances. Fix a bad one on the spot."
      back="/star-gallery-dev"
    >
      {tools}

      {kinds.length === 0 ? (
        <Panel>
          <div className="ih-empty">Nothing selected.</div>
          <Btn main onClick={() => setScreen("kinds")}>Pick highlights</Btn>
        </Panel>
      ) : (
        <div className="ih-run">
          <section className="bc-panel ih-stagebox">
            {/* THE DOCK: the controls that must never sit below the fold
                (Harry, 19 Oct 2026: "I heavily dislike when ui is off the
                screen"). Pinned to the top of the screen once you scroll, so
                it counts as a pinned bar: the match measures the room under
                it and reveals the pitch below it, never under it. */}
            <div className="ih-dock" data-ih-dock>
              <div className="ih-lower">
                <div className="ih-lower-text">
                  <b>{shot ? kindLabel(shot.spec.kind) : "…"}</b>
                  {shot && <span>#{shot.spec.seed}</span>}
                </div>
                <button
                  className="ih-flag"
                  onClick={toggleFlag}
                  aria-label="Flag this one"
                  aria-pressed={flaggedNow}
                  title={flaggedNow ? "Flagged — tap to unflag (F)" : "Flag this one (F)"}
                >
                  &#9873;
                </button>
              </div>
              <div className="ih-transport">
                <button className="ih-prev" onClick={prev} disabled={idx <= 0} aria-label="Previous">&#8249;</button>
                {/* Play this exact chance, edits and all — see ScenarioPlay. */}
                <button className="ih-play" data-tone={playing ? "stop" : "play"} onClick={togglePlay}>
                  {playing ? "◼ Stop" : "▶ Play"}
                </button>
                <button className="ih-next" onClick={next}>Next &#8594;</button>
              </div>
              {/* Save and Commit live here on a phone, where the fix panel sits
                  below the pitch; on a computer they stay in the fix panel. */}
              <div className="ih-dock-save">
                {(edited || !savedScenario) && (
                  <button className="ih-sbtn" data-tone="save" disabled={!!busy} onClick={() => void saveShot()}>
                    {busy === "saving" ? "Saving…" : edited ? "Save this fix" : "Save"}
                  </button>
                )}
                <button className="ih-sbtn" data-tone="commit" disabled={!!busy} onClick={() => void commitShot()}>
                  {busy === "committing" ? "Committing…" : "Commit"}
                </button>
              </div>
            </div>

            {/* The chance: the real game's own picture, or — on Play — the real
                match at the same size. Playing swaps only the picture, so a
                chance can be played, corrected and saved without moving. */}
            <div
              ref={pictureRef}
              className="ih-stage"
              // Read by scripts/fhr/still-vs-play.mjs: the still's framing.
              data-still-cam={shownCam ? JSON.stringify(shownCam) : undefined}
              data-still-facing={shownBase?.facing ?? "up"}
              data-still-tilt={still?.tilt ?? 0}
              data-still-hw={still?.hw ?? ""}
              data-still-you={still ? (still.youHidden ? "hidden" : "shown") : "shown"}
              data-still-kind={shot?.spec.kind}
              data-fhr={fhrOnHere ? "on" : "off"}
            >
              {playing && shot ? (
                <ScenarioPlay
                  build={() => {
                    const sc = buildSimScenario(shot.spec);
                    applyOverrideToScenario(sc, mergeOverrides([savedOv, override]));
                    return sc;
                  }}
                  onStop={() => setPlaying(false)}
                  width={pictureW}
                />
              ) : shot && shownBase && (
                <EditableFrame
                  editKey={editKey}
                  baseFrame={shownBase}
                  tilt={still?.tilt ?? 0}
                  matchCamera={!!still}
                  override={override}
                  marks={analysis.marks}
                  onCommit={setOverride}
                  edited={edited}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onSwipe={(d) => (d === 1 ? next() : prev())}
                  fit
                  // Play runs at exactly this size, so the picture and the match
                  // are the same size, in the same kits (one engine, 24 Sep).
                  size={still ? { baseW: pictureW, maxW: pictureW, maxH: 4000, h: Math.round(pictureW * still.hw) } : { baseW: pictureW, maxW: pictureW, maxH: 4000 }}
                  kits={kits}
                />
              )}
            </div>

            {hist.length > 1 && (
              <div>
                <div className="ih-strip-head">
                  <b>Previous chances</b>
                  <span className="ih-seen">{hist.length} seen</span>
                </div>
                <div className="ih-strip">
                  {hist.slice(stripFrom).map((h, i) => {
                    const at = stripFrom + i;
                    return (
                      <StripThumb
                        key={`${at}-${flagId(h.spec)}`}
                        shot={h}
                        saved={saved[highlightSlug(h.spec)]}
                        override={edits[flagId(h.spec)]}
                        n={at + 1}
                        current={at === idx}
                        kits={kits}
                        onPick={() => { setSelectedId(null); setIdx(at); }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="ih-keys">
              <span><kbd>[←]</kbd>Prev</span>
              <span><kbd>[→] [Space]</kbd>Next</span>
              <span><kbd>[F]</kbd>Flag</span>
              <span>Swipe the grass: next / prev</span>
            </div>
          </section>

          <div className="ih-side" data-side-column>
            <Panel title="Fix this chance" note="tap a player, drag to move">
              {/* The editor tools. Same as the gallery's version screen, in the
                  same order, doing the same thing. */}
              <div className="ih-edit">
                <button className="ih-ebtn" onClick={() => addFigure("teammate")}>+ Mate</button>
                <button className="ih-ebtn" title="Add an opponent" onClick={() => addFigure("opponent")}>+ Opp</button>
                <button className="ih-ebtn" disabled={!canRemove} onClick={() => selectedId && removeFigure(selectedId)}>Remove</button>
                <button className="ih-ebtn" data-tone="dim" title="Save this picture as a PNG" onClick={downloadShot}>PNG</button>
                {/* A saved scenario can be taken out of the database AND the code. */}
                <button
                  className="ih-ebtn"
                  data-tone={savedScenario ? "red" : undefined}
                  disabled={!savedScenario || !!busy}
                  title={savedScenario ? "Delete this scenario everywhere — database and code" : "Nothing saved for this chance"}
                  onClick={() => void deleteShot()}
                >
                  {busy === "deleting" ? "Deleting…" : "Delete"}
                </button>
                {/* Tune: record WHY this generation was bad, without saving it.
                    Only offered when there is a drag to learn from. */}
                {edited && (
                  <button
                    className="ih-ebtn"
                    data-tone="tune"
                    title="Record what was wrong with this generation — not saved as a base scenario"
                    onClick={tuneShot}
                  >
                    Tune
                  </button>
                )}
              </div>

              {/* Where this one is: Draft / Saved / Committed, and whether the
                  game uses it — the gallery card's two pills, from `statusOf`. */}
              {shot && status && (
                <div className="ih-pills">
                  <span data-tone={statusTone}>
                    {edited
                      ? "Unsaved changes — this browser only"
                      // `statusOf(null)` is "draft": right for a card somebody
                      // started on, wrong for a chance nobody has touched.
                      : savedScenario ? status.label : "Straight from the generator"}
                  </span>
                  <span data-tone={tunes ? "violet" : undefined}>{tunes ? "In the game" : "Not in the game yet"}</span>
                </div>
              )}

              {/* A drawing that breaks one of its own kind's laws, named. */}
              {ruleOutliers.length > 0 && (
                <div className="ih-warn">
                  {ruleOutliers.length} saved {ruleOutliers.length === 1 ? "scenario breaks" : "scenarios break"} a rule
                  of {shot ? kindLabel(shot.spec.kind) : "this kind"} and {ruleOutliers.length === 1 ? "is" : "are"} not
                  being used: {ruleOutliers.slice(0, 3).map((o) => o.breaks.toLowerCase()).join("; ")}
                </div>
              )}

              {/* Save and Commit are always here, edited or not — see commitShot. */}
              <div className="ih-save">
                {(edited || !savedScenario) && (
                  <button className="ih-sbtn ih-pc-only" data-tone="save" disabled={!!busy} onClick={() => void saveShot()}>
                    {busy === "saving" ? "Saving…" : edited ? "Save this fix" : "Save"}
                  </button>
                )}
                <button className="ih-sbtn ih-pc-only" data-tone="commit" disabled={!!busy} onClick={() => void commitShot()}>
                  {busy === "committing" ? "Committing…" : "Commit"}
                </button>
                {edited ? (
                  <button className="ih-sbtn" data-tone="quiet" onClick={() => { clearOverride(editKey); setSelectedId(null); }}>
                    Discard
                  </button>
                ) : savedScenario ? (
                  <button className="ih-sbtn" data-tone="quiet" disabled={!!busy} onClick={() => void revertShot()}>
                    {busy === "reverting" ? "Reverting…" : "Saved — revert"}
                  </button>
                ) : null}
              </div>

              {(flash || migrationMissing) && (
                <div className="ih-flash" data-bad={flash ? (flash.ok ? undefined : "true") : "true"}>
                  {flash
                    ? flash.text
                    : "Saving is off — run supabase/migrations/star_scenarios.sql in the Supabase SQL Editor."}
                </div>
              )}
              <Note>Save puts it in the gallery for the team. Commit puts it in the game.</Note>
            </Panel>

            {/* Hitboxes & jumping (Leo, 14 Oct 2026): New | Old, show every
                body's hitbox on Play, and the dials. */}
            <HitboxPanel />

            {/* What this session's chances add up to, and "Say what feels off". */}
            <TuningSessionPanel
              page="highlights"
              context={() => ({ kind: shot?.spec.kind, seed: shot?.spec.seed })}
            />
          </div>
        </div>
      )}
    </BroadcastPage>,
  );
}
