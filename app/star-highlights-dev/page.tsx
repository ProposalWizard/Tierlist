"use client";

/**
 * INFINITE HIGHLIGHTS — a hundred real chances, as fast as you can press Next.
 *
 * Asked for directly: "infinite highlight mode, where I can toggle out of all
 * the highlights in the game. I can toggle which ones I want on — one-on-ones,
 * long shots, free kicks — and then it will choose between just those."
 *
 * WHY IT EXISTS. A camera change shipped broken because it was signed off on a
 * measurement of the wrong code path. A test that measures the wrong path
 * passes; a person flicking through a hundred real chances catches it in a
 * minute. So the only thing this screen optimises for is how fast somebody can
 * SEE chances and flag the bad ones — one big Next, arrow keys, swipe, one tap
 * to flag.
 *
 * NOTHING HERE GENERATES A CHANCE. Every picture comes off the match's own path
 * — `selectChance` → `buildScenario` → `fixBaseScenario` → `applyChancePlan` —
 * through `nextHighlight` (lib/star/gallerySim.ts), and is drawn by the same
 * `paintMarked` the gallery draws with (lib/star/scenarioFrame.ts). A second
 * generator or a second renderer would quietly disagree with the game, and the
 * disagreement would be invisible, which is the exact failure this tool exists
 * to catch.
 *
 * Everything is SEEDED. A chance is `{ kind, seed, planId }`, so a flagged one
 * rebuilds to the identical picture on any device, any day.
 */

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
  marksForFaults,
  splitFaults,
  type Frame,
  type Mark,
} from "@/lib/star/scenarioFrame";
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
const KIND_ORDER: ScenarioKind[] = [
  "one_on_one", "tight_angle", "volley", "header", "cutback", "byline_cross",
  "long_range", "through_ball", "midfield_pass", "buildup",
  "penalty", "free_kick", "corner",
];

// ─────────────────────────────────────────────────────────────────────────
//  ONE CHANCE — built, judged and framed. Exactly the gallery's own path.
// ─────────────────────────────────────────────────────────────────────────

interface Shot {
  spec: SimSpec;
  frame: Frame;
  marks: Mark[];
  /** What is genuinely wrong, in plain English. Red. */
  faults: string[];
  /** A through ball's early runner — the chance, not a fault. Amber. */
  intended: string[];
  /** Every body on the pitch to the metre, for the repeat check. */
  picture: string;
}

function buildShot(spec: SimSpec): Shot {
  const sc = buildSimScenario(spec);
  const split = splitFaults(spec.kind, simFaults(sc, spec.planId));
  return {
    spec,
    frame: frameFromScenario(sc),
    marks: [
      ...marksForFaults(sc, split.faults, "red"),
      ...marksForFaults(sc, split.intended, "amber"),
    ],
    faults: split.faults,
    intended: split.intended,
    picture: pictureKey(sc),
  };
}

/** A canvas is painted at a fixed CSS width; on a narrow phone it has to come
 *  down to fit, keeping its own aspect (the attributes carry it). */
function fitCanvas(c: HTMLCanvasElement): void {
  c.style.maxWidth = "100%";
  c.style.height = "auto";
  c.style.display = "block";
}

function ShotCanvas({ shot, onSwipe }: { shot: Shot; onSwipe?: (dir: 1 | -1) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    paintMarked(ref.current, shot.frame, shot.marks);
    fitCanvas(ref.current);
  }, [shot]);

  return (
    <canvas
      ref={ref}
      style={{ borderRadius: 16, touchAction: "pan-y" }}
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        if (!d || !onSwipe) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) onSwipe(dx < 0 ? 1 : -1);
      }}
    />
  );
}

/** The flagged list's small picture. Same paint, scaled down by the browser. */
function FlagThumb({ shot }: { shot: Shot }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    paintMarked(ref.current, shot.frame, shot.marks);
    ref.current.style.width = "72px";
    ref.current.style.height = "auto";
    ref.current.style.display = "block";
  }, [shot]);
  return <canvas ref={ref} style={{ borderRadius: 10, flex: "none" }} />;
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

  // A full-screen dev tool: the site's own nav and footer get out of the way,
  // exactly as /star-gallery-dev does it (globals.css's immersive class).
  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
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
    if (idx < hist.length - 1) { setIdx(idx + 1); return; }
    const shot = draw();
    if (!shot) return;
    setHist((h) => [...h, shot]);
    setIdx(hist.length);
  }, [idx, hist.length, draw]);

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

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
      data-hl-faults={shot ? shot.faults.length : ""}
      data-hl-count={hist.length}
    >
      {children}
    </main>
  );

  const bar = (title: string, back: (() => void) | null, right?: React.ReactNode) => (
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
      <div style={{ fontSize: 18, fontWeight: 800, flex: 1, minWidth: 0, letterSpacing: "-0.01em" }}>{title}</div>
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
            {kinds.length}/{SCENARIO_KINDS.length}
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
            {flags.map((f) => {
              const s = buildShot(specOf(f));
              return (
                <div
                  key={f.id}
                  style={{
                    display: "flex", gap: 12, alignItems: "center", padding: 10,
                    borderRadius: 16, background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <FlagThumb shot={s} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 800, textTransform: "capitalize" }}>
                      {kindLabel(f.kind)}
                    </div>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: MUTED, marginTop: 2 }}>
                      #{f.seed} · {f.planId ?? "base"}
                    </div>
                    {s.faults.length > 0 && (
                      <div style={{ color: "#f87171", fontSize: 12.5, fontWeight: 700, marginTop: 3 }}>
                        {s.faults[0]}
                      </div>
                    )}
                  </div>
                  <button
                    style={{ ...roundBtn, flex: "none" }}
                    aria-label="Show this one"
                    onClick={() => {
                      setHist((h) => [...h, s]);
                      setIdx(hist.length);
                      setScreen("run");
                    }}
                  >
                    &#8250;
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </>,
    );
  }

  // ── RUN ──
  return shell(
    <>
      {bar(
        "Infinite Highlights",
        null,
        <div style={{ display: "flex", gap: 8 }}>
          <button style={smallBtn} aria-label="Choose highlights" onClick={() => setScreen("kinds")}>
            {kinds.length}/{SCENARIO_KINDS.length}
          </button>
          <button
            aria-label="Flagged list"
            style={{ ...smallBtn, color: flags.length ? FLAG : MUTED, borderColor: flags.length ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)" }}
            onClick={() => setScreen("flags")}
          >
            &#9873; {flags.length}
          </button>
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
        <div style={{ padding: "10px 12px 12px", display: "grid", justifyItems: "center", gap: 8 }}>
          {shot && <ShotCanvas shot={shot} onSwipe={(d) => (d === 1 ? next() : prev())} />}

          <div style={{ textAlign: "center", minHeight: 42 }}>
            <div style={{ fontSize: 17, fontWeight: 800, textTransform: "capitalize", letterSpacing: "-0.01em" }}>
              {shot ? kindLabel(shot.spec.kind) : "…"}
            </div>
            {shot && shot.faults.length > 0 && (
              <div style={{ color: "#f87171", fontSize: 13.5, fontWeight: 800, marginTop: 2, lineHeight: 1.35 }}>
                {shot.faults[0]}
              </div>
            )}
            {shot && shot.faults.length === 0 && (
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: MUTED, marginTop: 3 }}>
                #{shot.spec.seed}
              </div>
            )}
          </div>

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
