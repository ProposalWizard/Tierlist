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
import Link from "next/link";
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
import { outliersOf } from "@/lib/star/scenarioRules";
import { ruleSetFor, showSavedScenarios } from "@/lib/star/authoredChance";
import { statusOf } from "@/lib/star/scenarioStatus";
import {
  loadCorrections, saveCorrection, makeCorrection, proposalsFrom, fetchSharedCorrections,
  FAULT_LABEL, type Correction,
} from "@/lib/star/scenarioCorrections";
import ScenarioPlay from "@/components/star/ScenarioPlay";
import { usePlayWidth, useTestKits } from "@/components/star/EnginePlay";
import { revealOnScreen } from "@/lib/revealOnScreen";
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

const BG = "#05070d";
const INK = "#f2f5f9";
const MUTED = "#8a97aa";
const ACCENT = "#38bdf8";
const FLAG = "#f59e0b";

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
}

function buildShot(spec: SimSpec): Shot {
  const sc = buildSimScenario(spec);
  return { spec, base: frameFromScenario(sc), picture: pictureKey(sc) };
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
function FlagThumb({ frame, marks }: { frame: Frame; marks: Mark[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    paintMarked(ref.current, frame, marks);
    ref.current.style.width = "72px";
    ref.current.style.height = "auto";
    ref.current.style.display = "block";
  }, [frame, marks]);
  return <canvas ref={ref} style={{ borderRadius: 10, flex: "none" }} />;
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
    <div
      style={{
        display: "flex", gap: 12, alignItems: "center", padding: 10,
        borderRadius: 16, background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
      }}
    >
      <FlagThumb frame={frame} marks={analysis.marks} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, textTransform: "capitalize" }}>
          {kindLabel(flag.kind)}
        </div>
        <div
          style={{
            fontFamily: "ui-monospace, monospace", fontSize: 11, color: MUTED, marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
          title={flag.planId ?? "base"}
        >
          #{flag.seed} · {flag.planId ?? "base"}
        </div>
        {analysis.faults.length > 0 && (
          <div style={{ color: "#f87171", fontSize: 12.5, fontWeight: 700, marginTop: 3 }}>
            {analysis.faults[0]}
          </div>
        )}
        {saved && (
          <div style={{ color: "#4ade80", fontSize: 12, fontWeight: 800, marginTop: 3 }}>Saved</div>
        )}
      </div>
      <button style={{ ...roundBtn, flex: "none" }} aria-label="Show this one" onClick={() => onShow(shot)}>
        &#8250;
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  THE PAGE
// ─────────────────────────────────────────────────────────────────────────

type Screen = "run" | "kinds" | "flags";

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
      style={{
        background: BG, color: INK, minHeight: "100dvh",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
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

  const bar = (title: React.ReactNode, back: (() => void) | null, right?: React.ReactNode) => (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky", top: 0, zIndex: 6,
        background: "rgba(5,7,13,0.94)", backdropFilter: "blur(10px)",
      }}
    >
      {back ? (
        <button onClick={back} aria-label="Back" style={roundBtn}>&#8249;</button>
      ) : (
        <Link href="/star-gallery-dev" aria-label="Back to the gallery" style={{ ...roundBtn, display: "grid", placeItems: "center", textDecoration: "none" }}>
          &#8249;
        </Link>
      )}
      <div style={{ fontSize: 18, fontWeight: 800, flex: 1, minWidth: 0, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
      {right}
    </div>
  );

  // ── KINDS ──
  if (screen === "kinds") {
    return shell(
      <>
        {bar("Which highlights", () => setScreen("run"))}
        <div style={{ display: "flex", gap: 8, padding: "12px 14px 4px" }}>
          <button style={smallBtn} onClick={() => setKindsAnd(allKinds())}>All</button>
          <button style={smallBtn} onClick={() => setKindsAnd([])}>None</button>
          <div style={{ flex: 1 }} />
          <span style={{ color: MUTED, fontSize: 13, fontWeight: 700, alignSelf: "center" }}>
            {kinds.length}/{allKinds().length}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 14px 100px" }}>
          {KIND_ORDER.map((k) => {
            const on = selected.has(k);
            return (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                style={{
                  padding: "11px 15px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${on ? "rgba(56,189,248,0.6)" : "rgba(255,255,255,0.1)"}`,
                  background: on ? "rgba(14,116,144,0.4)" : "rgba(255,255,255,0.04)",
                  color: on ? "#e0f2fe" : MUTED,
                  fontSize: 14.5, fontWeight: 800, textTransform: "capitalize",
                }}
              >
                {kindLabel(k)}
              </button>
            );
          })}
        </div>
        <div style={{ position: "fixed", left: 12, right: 12, bottom: 12 }}>
          <button
            onClick={() => setScreen("run")}
            disabled={kinds.length === 0}
            style={{ ...bigBtn, opacity: kinds.length === 0 ? 0.4 : 1 }}
          >
            Watch these
          </button>
        </div>
      </>,
    );
  }

  // ── FLAGS ──
  if (screen === "flags") {
    return shell(
      <>
        {bar(
          `Flagged (${flags.length})`,
          () => setScreen("run"),
          flags.length ? (
            <button
              style={{ ...smallBtn, color: "#fca5a5", borderColor: "rgba(239,68,68,0.35)" }}
              onClick={() => { setFlags([]); saveFlags([]); }}
            >
              Clear
            </button>
          ) : undefined,
        )}
        {flags.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 14.5, fontWeight: 700, padding: "26px 16px", textAlign: "center" }}>
            Nothing flagged yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10, padding: "12px 14px 24px" }}>
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
      </>,
    );
  }

  // ── RUN ──
  return shell(
    <>
      {bar(
        // Shorter on a narrow phone so Next fits in the bar: "Highlights"
        // under 420 px, nothing under 360 (it read "H…" at 320).
        <span className="max-[359px]:hidden"><span className="max-[419px]:hidden">Infinite </span>Highlights</span>,
        null,
        <div style={{ display: "flex", gap: 8 }}>
          <button style={smallBtn} aria-label="Choose highlights" onClick={() => setScreen("kinds")}>
            {kinds.length}/{allKinds().length}
          </button>
          <button
            aria-label="Flagged list"
            style={{ ...smallBtn, color: flags.length ? FLAG : MUTED, borderColor: flags.length ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)" }}
            onClick={() => setScreen("flags")}
          >
            &#9873; {flags.length}
          </button>
          {/* Next, pinned in the sticky bar: the big one under the picture is
              below the fold on a phone (picture 586 px on a 664 px screen). */}
          {kinds.length > 0 && (
            <button
              onClick={next}
              style={{ ...smallBtn, minHeight: 40, color: "#e0f2fe", borderColor: "rgba(56,189,248,0.55)", background: "rgba(14,116,144,0.38)" }}
            >
              Next &#8594;
            </button>
          )}
        </div>,
      )}

      {kinds.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <p style={{ color: MUTED, fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
            Nothing selected.
          </p>
          <button style={{ ...bigBtn, maxWidth: 260, margin: "0 auto" }} onClick={() => setScreen("kinds")}>
            Pick highlights
          </button>
        </div>
      ) : (
        <div ref={pictureRef} style={{ padding: "10px 12px 14px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", justifyItems: "center", gap: 8 }}>
          {/* minmax(0, 1fr): without it the column grew to the button row's
              full width (433px on a 390px phone), so the picture sat
              off-centre and Delete was cut off the right edge. */}
          {/* Playing swaps the PICTURE for the live match and leaves every
              control below it exactly where it was, so a chance can be
              played, corrected and saved without changing screen. */}
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
          ) : shot && baseFrame && (
            <EditableFrame
              editKey={editKey}
              baseFrame={baseFrame}
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
              size={{ baseW: pictureW, maxW: pictureW, maxH: 4000 }}
              kits={kits}
            />
          )}

          <div style={{ textAlign: "center", minHeight: 42 }}>
            <div style={{ fontSize: 17, fontWeight: 800, textTransform: "capitalize", letterSpacing: "-0.01em" }}>
              {shot ? kindLabel(shot.spec.kind) : "…"}
            </div>
            {shot && analysis.faults.length > 0 && (
              <div style={{ color: "#f87171", fontSize: 13.5, fontWeight: 800, marginTop: 2, lineHeight: 1.35 }}>
                {analysis.faults[0]}
              </div>
            )}
            {shot && analysis.faults.length === 0 && (
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: MUTED, marginTop: 3 }}>
                #{shot.spec.seed}
              </div>
            )}
          </div>

          {/* The editor tools. Same three the gallery's version screen has, in
              the same order, doing the same thing — tap a figure on the
              picture, then take him out; or put a new one in. */}
          {/* Wraps onto a second row rather than cutting words: at 360 px
              "Remove" was cut, at 320 px "+ Mate", "Remove" and "Delete". */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, width: "100%", maxWidth: 460 }} className="[&>button]:!basis-[54px] [&>button]:!grow">
            <button style={editBtn(false)} onClick={() => addFigure("teammate")}>+ Mate</button>
            <button style={editBtn(false)} title="Add an opponent" onClick={() => addFigure("opponent")}>+ Opp</button>
            <button
              style={editBtn(!canRemove)}
              disabled={!canRemove}
              onClick={() => selectedId && removeFigure(selectedId)}
            >
              Remove
            </button>
            {/* Play this exact chance, edits and all — see ScenarioPlay. */}
            <button
              style={{ ...editBtn(false), color: playing ? "#7dd3fc" : "#4ade80" }}
              onClick={togglePlay}
            >
              {playing ? "\u25FC Stop" : "\u25B6 Play"}
            </button>
            <button
              style={{ ...editBtn(false), color: MUTED }}
              title="Save this picture as a PNG"
              onClick={downloadShot}
            >
              PNG
            </button>
            {/* Everywhere everything else is, a saved scenario can be taken
                out of the database AND the code. This screen only had Revert,
                which leaves a committed copy still being served. */}
            <button
              style={{ ...editBtn(!savedScenario), color: savedScenario ? "#f87171" : undefined }}
              disabled={!savedScenario || !!busy}
              title={savedScenario
                ? "Delete this scenario everywhere — database and code"
                : "Nothing saved for this chance"}
              onClick={() => void deleteShot()}
            >
              {busy === "deleting" ? "Deleting…" : "Delete"}
            </button>
            {/* Tune: record WHY this generation was bad, without saving it as
                a drawing. Only offered when there is a drag to learn from —
                the same condition the gallery uses. */}
            {edited && (
              <button
                style={{ ...editBtn(false), color: "#c4b5fd" }}
                title="Record what was wrong with this generation — not saved as a base scenario"
                onClick={tuneShot}
              >
                Tune
              </button>
            )}
          </div>

          {/* ── WHERE THIS ONE ACTUALLY IS ──
              Draft / Saved / Committed, and whether it is feeding the
              auto-tuner. The same two pills the gallery card carries, from
              the same `statusOf` — it was possible to save a fix here and
              have no idea whether it was in the code or only in a database. */}
          {shot && (() => {
            const st = statusOf(savedScenario ?? null);
            const tone = edited || st.state === "draft"
              ? { fg: "#fcd34d", bg: "rgba(245,158,11,0.15)", br: "rgba(245,158,11,0.45)" }
              : st.state === "committed"
                ? { fg: "#86efac", bg: "rgba(34,197,94,0.14)", br: "rgba(34,197,94,0.45)" }
                : { fg: "#7dd3fc", bg: "rgba(56,189,248,0.14)", br: "rgba(56,189,248,0.45)" };
            const tunes = edited ? false : st.tuning;
            return (
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
                  color: tone.fg, background: tone.bg, border: `1px solid ${tone.br}`,
                }}>
                  {edited
                    ? "Unsaved changes — this browser only"
                    // `statusOf(null)` is "draft", which is right for a card
                    // somebody has started on and wrong for a chance the
                    // generator just rolled and nobody has touched.
                    : savedScenario ? st.label : "Straight from the generator"}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
                  color: tunes ? "#c4b5fd" : MUTED,
                  background: tunes ? "rgba(167,139,250,0.14)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${tunes ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.09)"}`,
                }}>
                  {tunes ? "In the game" : "Not in the game yet"}
                </span>
              </div>
            );
          })()}

          {/* A drawing that disagrees with one of its own kind's laws. Named
              rather than silently absorbed — the rules survive one slip, but
              nobody should have to guess that a slip happened. */}

          {ruleOutliers.length > 0 && (
            <div style={{
              width: "100%", maxWidth: 460, borderRadius: 12, padding: "9px 12px",
              background: "rgba(245,158,11,0.13)", border: "1px solid rgba(245,158,11,0.4)",
              color: "#fcd34d", fontSize: 12.5, fontWeight: 700, lineHeight: 1.4,
            }}>
              {ruleOutliers.length} saved {ruleOutliers.length === 1 ? "scenario breaks" : "scenarios break"} a rule
              of {shot ? kindLabel(shot.spec.kind) : "this kind"} and {ruleOutliers.length === 1 ? "is" : "are"} not
              being used: {ruleOutliers.slice(0, 3).map((o) => o.breaks.toLowerCase()).join("; ")}
            </div>
          )}


          <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 460 }}>
            <button
              onClick={prev}
              disabled={idx <= 0}
              aria-label="Previous"
              style={{
                ...bigBtn, flex: "none", width: 60, fontSize: 22,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                color: idx <= 0 ? "rgba(138,151,170,0.4)" : INK,
                cursor: idx <= 0 ? "default" : "pointer",
              }}
            >
              &#8249;
            </button>
            <button
              onClick={toggleFlag}
              aria-label="Flag this one"
              style={{
                ...bigBtn, flex: "none", width: 74, fontSize: 20,
                background: flaggedNow ? "rgba(245,158,11,0.22)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${flaggedNow ? FLAG : "rgba(255,255,255,0.09)"}`,
                color: flaggedNow ? FLAG : MUTED,
              }}
            >
              &#9873;
            </button>
            <button onClick={next} style={{ ...bigBtn, flex: 1 }}>
              Next &#8594;
            </button>
          </div>

          {/* Save and Commit are always here, edited or not — see commitShot. */}
          <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 460 }}>
            {(edited || !savedScenario) && (
              <button
                style={{ ...editBtn(false), flex: 2, height: 48, background: "rgba(22,163,74,0.24)", border: "1px solid rgba(34,197,94,0.55)", color: "#bbf7d0", fontSize: 15 }}
                disabled={!!busy}
                onClick={() => void saveShot()}
              >
                {busy === "saving" ? "Saving…" : edited ? "Save this fix" : "Save"}
              </button>
            )}
            <button
              style={{ ...editBtn(false), flex: 1.4, height: 48, background: "rgba(14,116,144,0.3)", border: "1px solid rgba(56,189,248,0.55)", color: "#e0f2fe", fontSize: 15 }}
              disabled={!!busy}
              onClick={() => void commitShot()}
            >
              {busy === "committing" ? "Committing…" : "Commit"}
            </button>
            {edited ? (
              <button style={{ ...editBtn(false), height: 48 }} onClick={() => { clearOverride(editKey); setSelectedId(null); }}>
                Discard
              </button>
            ) : savedScenario ? (
              <button
                style={{ ...editBtn(false), flex: 2, height: 48, color: MUTED }}
                disabled={!!busy}
                onClick={() => void revertShot()}
              >
                {busy === "reverting" ? "Reverting…" : "Saved — revert"}
              </button>
            ) : null}
          </div>

          {(flash || migrationMissing) && (
            <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: "center", maxWidth: 460, lineHeight: 1.4, color: flash ? (flash.ok ? "#4ade80" : "#fca5a5") : "#fca5a5" }}>
              {flash
                ? flash.text
                : "Saving is off — run supabase/migrations/star_scenarios.sql in the Supabase SQL Editor."}
            </div>
          )}
        </div>
      )}
    </>,
  );
}

const roundBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 999, flex: "none",
  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
  color: INK, fontSize: 17, fontWeight: 800, cursor: "pointer", lineHeight: 1,
};

const smallBtn: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 999, cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
  color: MUTED, fontSize: 13, fontWeight: 800,
};

const bigBtn: React.CSSProperties = {
  width: "100%", height: 56, borderRadius: 16, cursor: "pointer",
  border: `1px solid ${ACCENT}55`, background: "rgba(14,116,144,0.38)",
  color: "#e0f2fe", fontSize: 17, fontWeight: 800,
  display: "grid", placeItems: "center",
};

/** The gallery's own edit-row button, same size and same disabled look. */
const editBtn = (off: boolean): React.CSSProperties => ({
  // Up to seven of these share one row since Delete and Tune joined it, so
  // they shrink rather than wrap onto a second line.
  flex: 1, minWidth: 0, height: 42, borderRadius: 13, cursor: off ? "default" : "pointer",
  padding: "0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.05)",
  color: off ? "rgba(138,151,170,0.45)" : INK, fontSize: 11, fontWeight: 700,
});
