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

import { useMemo, useState } from "react";
import type { MatchScenario } from "@/lib/star/scenarios";
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
}

export default function TuningPanel({
  kinds, proposals, corrections, pending, busy, commitBlocked,
  onCommitAll, onShowKind,
}: {
  kinds: string[];
  proposals: Proposal[];
  corrections: Correction[];
  pending: MatchScenario[];
  busy: string | null;
  commitBlocked: string | null;
  onCommitAll: () => void;
  onShowKind: (kind: string) => void;
}) {
  return (
    <div style={{ padding: "4px 14px 40px", display: "grid", gap: 16 }}>
      <CommitSection
        pending={pending} busy={busy} commitBlocked={commitBlocked} onCommitAll={onCommitAll}
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
  pending, busy, commitBlocked, onCommitAll,
}: {
  pending: MatchScenario[]; busy: string | null; commitBlocked: string | null; onCommitAll: () => void;
}) {
  if (pending.length === 0) {
    return (
      <Card
        tint="56,189,248"
        title="Nothing waiting to be committed"
        sub="Everything saved is already in the code. Save puts a scenario in the database, where it works for everyone straight away; Commit puts it in the code, where it survives anything happening to the database."
      />
    );
  }
  const n = pending.length;
  return (
    <Card
      tint="56,189,248"
      title={`${n} ${n === 1 ? "scenario is" : "scenarios are"} saved but not in the code`}
      sub={`They already work everywhere and already tune the generator. Committing puts them in the code permanently — one commit, one deploy, all ${n}.`}
    >
      <div style={{ fontSize: 11.5, color: FAINT, marginTop: 8, lineHeight: 1.55 }}>
        {pending.slice(0, 8).map((sc) => sc.name || sc.id).join(" · ")}
        {n > 8 ? ` · +${n - 8} more` : ""}
      </div>
      <button
        onClick={onCommitAll}
        disabled={!!busy || !!commitBlocked}
        style={{
          marginTop: 12, width: "100%", height: 46, borderRadius: 12,
          cursor: busy || commitBlocked ? "default" : "pointer",
          border: "1px solid rgba(56,189,248,0.55)",
          background: commitBlocked ? "rgba(255,255,255,0.05)" : "rgba(56,189,248,0.2)",
          color: commitBlocked ? MUTED : "#e0f2fe", fontSize: 14.5, fontWeight: 800,
        }}
      >
        {busy === "committing"
          ? "Committing…"
          : commitBlocked ? "Commit to repo is off" : `Commit all ${n} to the repo`}
      </button>
      {commitBlocked && (
        <p style={{ margin: "8px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
          {commitBlocked}
        </p>
      )}
    </Card>
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
      sub={`From ${corrections.length} corrections. Nothing has been applied — these are what the corrections agree on, and each one only ever applies to its own chance kind.`}
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
    return { kind, drawings: pool.length, set, laws, outliers: set ? outliersOf(set) : [] };
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
