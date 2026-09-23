"use client";

/**
 * components/star/TuningPanel.tsx
 *
 * THE TUNING & COMMIT PAGE in the scenario gallery.
 *
 * Asked for directly: "where is the commit to repo tab in the scenario
 * gallery and the proposals for tuning? I think remove the scenario builder
 * from the UI and make that a tuning + commit UI page". Both of those did
 * exist — the proposals sat under the home tiles and the commit box at the
 * bottom of a long scrolling gallery — which is the same as not existing.
 * They live here now, in one place, reachable from the home screen.
 *
 * And: "there you can see all of the hard rules and what's contributing to
 * all highlights". So the first section is the rule set itself, per chance
 * kind: the laws currently in force, how many drawings agree, which drawing
 * disagrees, and how many drawings the whole thing was read off.
 *
 * ONE KIND NEVER TOUCHES ANOTHER. Also asked for directly. It was already
 * true — authoredPool, ruleSetFor and deriveRuleSet all take a kind and
 * read only that kind's drawings, and proposalsFrom buckets on kind AND
 * fault — but "already true" is not visible, so this page states the number
 * of drawings behind each kind and shows every kind separately rather than
 * one merged list. A reader can see the separation instead of being told.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchScenario } from "@/lib/star/scenarios";
import { paint, type Frame } from "@/lib/star/scenarioFrame";
import { ruleSetFor, authoredPool } from "@/lib/star/authoredChance";
import { outliersOf, MIN_SAMPLES_FOR_INVARIANT, INVARIANT_AGREEMENT } from "@/lib/star/scenarioRules";
import {
  FAULT_LABEL, PROPOSAL_THRESHOLD,
  type Correction,
} from "@/lib/star/scenarioCorrections";

const INK = "#e8eef5";
const MUTED = "rgba(232,238,245,0.62)";
const FAINT = "rgba(232,238,245,0.42)";

const kindLabel = (k: string) => k.replace(/_/g, " ");

/**
 * A law reads as its OPPOSITE without this.
 *
 * Every hard rule here is a zero: the measure is "Defenders between the ball
 * and the goal" and the law is that the count is none. Printing the measure's
 * own name put "Defenders between the ball and the goal — 22 of 22 drawings
 * agree" on screen, which says the exact opposite of what is enforced. Seen
 * on a screenshot, not reasoned about.
 */
function lawText(label: string): string {
  const l = label.trim();
  return "No " + l.charAt(0).toLowerCase() + l.slice(1);
}

export interface Proposal {
  kind: string;
  fault: string;
  rule: string;
  count: number;
  value?: number;
  range?: [number, number];
  apply?: string;
}

export default function TuningPanel({
  kinds, proposals, corrections, pending, frameOf, busy, commitBlocked,
  onCommitAll, onShowKind, onOpenScenario,
}: {
  kinds: string[];
  proposals: Proposal[];
  corrections: Correction[];
  pending: MatchScenario[];
  /** The picture a pending scenario actually is, rebuilt the same way its
   *  own card rebuilds it. `null` when it cannot be rebuilt (a scenario
   *  saved by a tool that did not record its source). */
  frameOf: (sc: MatchScenario) => Frame | null;
  busy: string | null;
  commitBlocked: string | null;
  /** Commits exactly these — the ones still ticked after the review. */
  onCommitAll: (scenarios: MatchScenario[]) => void;
  onShowKind: (kind: string) => void;
  /** Open this scenario's own card, for a last edit before committing. */
  onOpenScenario: (sc: MatchScenario) => void;
}) {
  return (
    <div style={{ padding: "4px 14px 40px", display: "grid", gap: 16 }}>
      <CommitSection
        pending={pending} frameOf={frameOf} busy={busy} commitBlocked={commitBlocked}
        onCommitAll={onCommitAll} onOpenScenario={onOpenScenario}
      />
      <ProposalsSection
        proposals={proposals} corrections={corrections} onShowKind={onShowKind}
      />
      <RulesSection kinds={kinds} onShowKind={onShowKind} />
    </div>
  );
}

/* ── Card shell ───────────────────────────────────────────────────────── */

function Card({
  tint, title, sub, children,
}: { tint: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <section style={{
      padding: "14px 15px", borderRadius: 14,
      background: `rgba(${tint},0.09)`, border: `1px solid rgba(${tint},0.32)`,
    }}>
      <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: INK }}>{title}</h2>
      {sub && (
        <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: MUTED, lineHeight: 1.5 }}>
          {sub}
        </p>
      )}
      {children}
    </section>
  );
}

/* ── 1. Saved but not in the code ─────────────────────────────────────── */

function CommitSection({
  pending, frameOf, busy, commitBlocked, onCommitAll, onOpenScenario,
}: {
  pending: MatchScenario[];
  frameOf: (sc: MatchScenario) => Frame | null;
  busy: string | null;
  commitBlocked: string | null;
  onCommitAll: (scenarios: MatchScenario[]) => void;
  onOpenScenario: (sc: MatchScenario) => void;
}) {
  // Which ones have been taken OUT of this batch. Ids, not indices, so it
  // survives the list changing underneath it while you review.
  const [left, setLeft] = useState<Record<string, true>>({});
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(false);

  const going = pending.filter((sc) => !left[sc.id]);
  // The list can shrink under you — a save elsewhere, a commit landing — so
  // the cursor is clamped on read rather than corrected by an effect.
  const idx = pending.length === 0 ? 0 : Math.min(at, pending.length - 1);
  const shown = pending[idx];

  if (pending.length === 0) {
    return (
      <Card
        tint="56,189,248"
        title="Nothing waiting to be committed"
        sub="Everything saved is already in the game. Save shares a drawing with the team in the gallery; Commit puts it in the game, for every player."
      />
    );
  }
  const n = pending.length;
  const g = going.length;
  return (
    <Card
      tint="56,189,248"
      title={`${n} ${n === 1 ? "scenario is" : "scenarios are"} saved but not in the code`}
      sub={`The team can see them in the gallery, but the game only plays committed drawings. Committing puts them in the game for every player \u2014 one commit, one deploy, all ${g}.`}
    >
      {/* ── THE LAST CHECK ──
          Asked for directly, twice: "maybe have it as a thing where you can
          scroll through everything that needs a last check and still do a
          final edit, but it doesn't mean that you have to resave it", and
          then "not being able to see them before committing is annoying".

          It was a line of ids. An id is not a picture, so the only way to
          see what you were about to put in the code permanently was to go
          and find each card by hand. This shows the actual drawing, one at a
          time, big enough to judge \u2014 and nothing here writes anything:
          looking is free, leaving one out only changes THIS batch, and Open
          goes to the real card if a picture needs a last drag. */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          marginTop: 10, width: "100%", height: 38, borderRadius: 11, cursor: "pointer",
          border: "1px solid rgba(56,189,248,0.3)", background: "transparent",
          color: "#7dd3fc", fontSize: 13, fontWeight: 800,
        }}
      >
        {open ? "Hide them \u2303" : `Look through all ${n} first \u2304`}
      </button>

      {open && shown && (
        <div style={{ marginTop: 12, display: "grid", gap: 8, justifyItems: "center" }}>
          <PendingPicture frame={frameOf(shown)} dimmed={!!left[shown.id]} />

          <div style={{ textAlign: "center", lineHeight: 1.35 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>
              {shown.name || shown.id}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, textTransform: "capitalize" }}>
              {kindLabel(shown.source?.kind ?? shown.kind)}
              {shown.source?.seed != null ? ` \u00b7 #${shown.source.seed}` : ""}
            </div>
            {/* Its own line, outside the capitalised one — inside it this read
                as "Left Out Of This Commit". */}
            {left[shown.id] && (
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fcd34d", marginTop: 2 }}>
                Left out of this commit
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button
              style={stepBtn}
              disabled={idx === 0}
              onClick={() => setAt(Math.max(0, idx - 1))}
              aria-label="Previous"
            >
              &#8249;
            </button>
            <span style={{
              flex: "none", minWidth: 62, display: "grid", placeItems: "center",
              fontSize: 12, fontWeight: 800, color: MUTED,
            }}>
              {idx + 1} / {n}
            </span>
            <button
              style={stepBtn}
              disabled={idx >= n - 1}
              onClick={() => setAt(Math.min(n - 1, idx + 1))}
              aria-label="Next"
            >
              &#8250;
            </button>
            <button
              style={{ ...rowBtn, flex: 1 }}
              onClick={() => onOpenScenario(shown)}
              title="Open this scenario's own card to change it before committing"
            >
              Open to edit
            </button>
            <button
              style={{
                ...rowBtn, flex: 1,
                color: left[shown.id] ? "#fcd34d" : MUTED,
                borderColor: left[shown.id] ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.09)",
              }}
              onClick={() => setLeft((m) => {
                const next = { ...m };
                if (next[shown.id]) delete next[shown.id]; else next[shown.id] = true;
                return next;
              })}
            >
              {left[shown.id] ? "Put back" : "Leave out"}
            </button>
          </div>
        </div>
      )}

      {!open && (
        <div style={{ fontSize: 11.5, color: FAINT, marginTop: 8, lineHeight: 1.55 }}>
          {pending.slice(0, 8).map((sc) => sc.name || sc.id).join(" \u00b7 ")}
          {n > 8 ? ` \u00b7 +${n - 8} more` : ""}
        </div>
      )}

      <button
        onClick={() => onCommitAll(going)}
        disabled={!!busy || !!commitBlocked || g === 0}
        style={{
          marginTop: 12, width: "100%", height: 46, borderRadius: 12,
          cursor: busy || commitBlocked || g === 0 ? "default" : "pointer",
          border: "1px solid rgba(56,189,248,0.55)",
          background: commitBlocked || g === 0 ? "rgba(255,255,255,0.05)" : "rgba(56,189,248,0.2)",
          color: commitBlocked || g === 0 ? MUTED : "#e0f2fe", fontSize: 14.5, fontWeight: 800,
        }}
      >
        {busy === "committing"
          ? "Committing\u2026"
          : commitBlocked ? "Commit to repo is off"
            : g === 0 ? "All of them are left out"
              : g === n ? `Commit all ${n} to the repo`
                : `Commit ${g} of ${n} to the repo`}
      </button>
      {commitBlocked && (
        <p style={{ margin: "8px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
          {commitBlocked}
        </p>
      )}
    </Card>
  );
}

const stepBtn: React.CSSProperties = {
  flex: "none", width: 38, height: 38, borderRadius: 11, cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.05)",
  color: INK, fontSize: 17, fontWeight: 800, lineHeight: 1,
};

const rowBtn: React.CSSProperties = {
  height: 38, borderRadius: 11, cursor: "pointer", padding: "0 6px", whiteSpace: "nowrap",
  border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.05)",
  color: INK, fontSize: 12, fontWeight: 700,
};

/**
 * A pending scenario, drawn by the SAME painter its own card draws with.
 *
 * Read-only on purpose: this is the last look before something goes into the
 * code, and a drag here would be an edit nobody asked for on a screen whose
 * whole promise is that looking costs nothing.
 */
function PendingPicture({ frame, dimmed }: { frame: Frame | null; dimmed: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current || !frame) return;
    paint(ref.current, frame, { baseW: 260, maxW: 280, maxH: 420 });
  }, [frame]);
  if (!frame) {
    return (
      <div style={{
        width: "100%", padding: "22px 14px", borderRadius: 12, textAlign: "center",
        background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)",
        color: MUTED, fontSize: 12.5, fontWeight: 700, lineHeight: 1.5,
      }}>
        No picture for this one \u2014 it was saved without recording which chance
        and seed it came from, so there is nothing to rebuild it from. It still
        commits fine.
      </div>
    );
  }
  return (
    <canvas
      ref={ref}
      style={{
        display: "block", borderRadius: 12, background: "#14532d",
        opacity: dimmed ? 0.32 : 1,
      }}
    />
  );
}

/* ── 2. What the corrections add up to ────────────────────────────────── */

function ProposalsSection({
  proposals, corrections, onShowKind,
}: { proposals: Proposal[]; corrections: Correction[]; onShowKind: (k: string) => void }) {
  if (corrections.length === 0) {
    return (
      <Card
        tint="167,139,250"
        title="No corrections yet"
        sub={`Drag a player where he should have been and press Tune. Nothing happens on the first one — a single bad chance is not evidence. When ${PROPOSAL_THRESHOLD} corrections of the same kind agree, a proposed rule shows up here.`}
      />
    );
  }
  if (proposals.length === 0) {
    return (
      <Card
        tint="167,139,250"
        title={`${corrections.length} ${corrections.length === 1 ? "correction" : "corrections"} recorded, nothing proposed yet`}
        sub={`None of them agree ${PROPOSAL_THRESHOLD} times on the same chance kind, so nothing is being proposed. A correction stays quiet until a pattern shows up.`}
      />
    );
  }
  return (
    <Card
      tint="167,139,250"
      title={`${proposals.length} ${proposals.length === 1 ? "rule" : "rules"} worth a look`}
      sub={`From ${corrections.length} corrections across the team. Nothing is applied from here — to act on one, ask Claude in the terminal for the tuner proposals and say which to apply. Each one only ever applies to its own chance kind.`}
    >
      {proposals.map((pr) => (
        <div key={`${pr.kind}|${pr.fault}`} style={{
          marginTop: 10, padding: "10px 12px", borderRadius: 10,
          background: "rgba(0,0,0,0.25)", border: "1px solid rgba(167,139,250,0.25)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em",
            textTransform: "uppercase", color: "rgba(233,213,255,0.7)" }}>
            {kindLabel(pr.kind)} only
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#e9d5ff", marginTop: 3 }}>
            {pr.rule}
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(233,213,255,0.7)", marginTop: 3, lineHeight: 1.45 }}>
            {pr.count} corrections fixed {FAULT_LABEL[pr.fault as keyof typeof FAULT_LABEL] ?? pr.fault}
          </div>
          {pr.value !== undefined && (
            <div style={{ fontSize: 11.5, color: "#e9d5ff", marginTop: 3, lineHeight: 1.45 }}>
              Everyone&apos;s drags agree on about <b>{pr.value.toFixed(2)}</b>
              {pr.range && <> (they ranged {pr.range[0].toFixed(2)}–{pr.range[1].toFixed(2)})</>}
            </div>
          )}
          <button
            onClick={() => onShowKind(pr.kind)}
            style={{
              marginTop: 8, height: 32, padding: "0 12px", borderRadius: 9, cursor: "pointer",
              border: "1px solid rgba(167,139,250,0.4)", background: "rgba(167,139,250,0.14)",
              color: "#e9d5ff", fontSize: 12, fontWeight: 800,
            }}
          >
            Show me {kindLabel(pr.kind)}
          </button>
        </div>
      ))}
    </Card>
  );
}

/* ── 3. The hard rules, per chance kind ───────────────────────────────── */

function RulesSection({ kinds, onShowKind }: { kinds: string[]; onShowKind: (k: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);

  // Read once per render of this page. Each kind's rules come from that
  // kind's own drawings and nothing else.
  const rows = useMemo(() => kinds.map((kind) => {
    const pool = authoredPool(kind);
    const set = ruleSetFor(kind);
    const laws = set ? set.rules.filter((r) => r.invariant) : [];
    // The measured ranges that are NOT laws. Asked directly, looking at three
    // "no X" lines: "are there values in there?" There are — every measure is
    // read off the drawings with a min, a median and a max. They are not
    // enforced, which is why a one-on-one can have a defender 1.9m away and
    // still pass: the laws only forbid a defender BETWEEN you and the goal.
    // Showing them is the first step to being able to tighten one.
    const ranges = set
      ? set.rules.filter((r) => !r.invariant && !r.count && Number.isFinite(r.median))
      : [];
    return { kind, drawings: pool.length, set, laws, ranges, outliers: set ? outliersOf(set) : [] };
  }), [kinds]);

  const withDrawings = rows.filter((r) => r.drawings > 0);
  const without = rows.filter((r) => r.drawings === 0);

  return (
    <Card
      tint="74,222,128"
      title="The hard rules, and what they are read off"
      sub={`A law has to hold in ${Math.round(INVARIANT_AGREEMENT * 100)}% of a kind's drawings, and a kind needs at least ${MIN_SAMPLES_FOR_INVARIANT} drawings before anything counts as a law at all. Every kind is read separately — drawings of one chance never affect another.`}
    >
      {withDrawings.length === 0 && (
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
          Nothing is drawn yet, so the generator is running on its built-in shapes alone.
        </p>
      )}

      {withDrawings.map((r) => {
        const isOpen = open === r.kind;
        return (
          <div key={r.kind} style={{
            marginTop: 10, borderRadius: 10, overflow: "hidden",
            background: "rgba(0,0,0,0.25)", border: "1px solid rgba(74,222,128,0.22)",
          }}>
            <button
              onClick={() => setOpen(isOpen ? null : r.kind)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                padding: "10px 12px", background: "transparent", border: 0, textAlign: "left",
              }}
            >
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: INK }}>
                {kindLabel(r.kind)}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: MUTED }}>
                {r.drawings} {r.drawings === 1 ? "drawing" : "drawings"}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                background: r.laws.length ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.07)",
                color: r.laws.length ? "#bbf7d0" : MUTED,
              }}>
                {r.laws.length} {r.laws.length === 1 ? "law" : "laws"}
              </span>
              <span style={{ color: FAINT, fontSize: 12 }}>{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen && (
              <div style={{ padding: "0 12px 12px" }}>
                {r.drawings < MIN_SAMPLES_FOR_INVARIANT && (
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#fde68a", lineHeight: 1.5 }}>
                    Only {r.drawings} drawn. Below {MIN_SAMPLES_FOR_INVARIANT} nothing is treated as a
                    law — a handful agreeing is a coincidence, not a rule.
                  </p>
                )}

                {r.laws.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
                    No laws yet for this kind.
                  </p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                    {r.laws.map((law) => (
                      <li key={law.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: "#4ade80", fontWeight: 800 }}>✓</span>
                        <span style={{ flex: 1, fontSize: 12.5, color: INK, lineHeight: 1.45 }}>
                          {law.count ? lawText(law.label) : law.label}
                          <span style={{ color: FAINT, fontWeight: 600 }}>
                            {" "}— {law.agree} of {law.of} drawings agree
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {r.ranges.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em",
                      textTransform: "uppercase", color: MUTED }}>
                      Measured, but not enforced
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: FAINT, lineHeight: 1.5 }}>
                      What your drawings actually look like. Nothing here is a rule yet — a generated
                      chance can sit outside any of these and still pass.
                    </p>
                    <ul style={{ margin: "7px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 3 }}>
                      {r.ranges.map((m) => (
                        <li key={m.id} style={{
                          display: "flex", gap: 8, fontSize: 11.5, color: MUTED, lineHeight: 1.5,
                        }}>
                          <span style={{ flex: 1 }}>{m.label}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", color: INK, fontWeight: 700 }}>
                            {m.median.toFixed(1)}
                          </span>
                          <span style={{ fontVariantNumeric: "tabular-nums", color: FAINT, minWidth: 82, textAlign: "right" }}>
                            {m.min.toFixed(1)}–{m.max.toFixed(1)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {r.outliers.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em",
                      textTransform: "uppercase", color: "#fde68a" }}>
                      Drawings that disagree
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
                      The law still holds. These are never used as a starting point for a new chance.
                    </p>
                    <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                      {r.outliers.map((o, i) => (
                        <li key={`${o.id}-${i}`} style={{ fontSize: 11.5, color: "#fde68a" }}>
                          {o.id} — breaks “{o.breaks}”
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => onShowKind(r.kind)}
                  style={{
                    marginTop: 11, height: 32, padding: "0 12px", borderRadius: 9, cursor: "pointer",
                    border: "1px solid rgba(74,222,128,0.35)", background: "rgba(74,222,128,0.12)",
                    color: "#bbf7d0", fontSize: 12, fontWeight: 800,
                  }}
                >
                  Show me {kindLabel(r.kind)}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {without.length > 0 && (
        <p style={{ margin: "12px 0 0", fontSize: 11.5, color: FAINT, lineHeight: 1.55 }}>
          <b style={{ color: MUTED }}>Nothing drawn yet:</b>{" "}
          {without.map((r) => kindLabel(r.kind)).join(", ")}. These run on the generator&rsquo;s
          built-in shapes until somebody draws one.
        </p>
      )}
    </Card>
  );
}
