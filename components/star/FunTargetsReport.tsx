"use client";

/**
 * FUN TARGETS v0 (DRAFT) — phone report. The same numbers as
 * tests/star/funTargets.mts: the real unseen match played 200 times per
 * position per strength gap, ours against Harry's table (lib/star/funTargets.ts).
 * The radar has no league input yet (step 2), so each number sits against the
 * National League and the Premier League target side by side.
 * Reads and writes nothing.
 */
import { useState } from "react";
import { reportAll, rowsFor, impliedConversion, guardrailProblems, GAPS, type PositionReport } from "@/lib/star/funTargetsMeasure";
import { formatBand, formatValue, GUARDRAILS } from "@/lib/star/funTargets";

const INK = "#f2f5f9";
const MUTED = "#8a97aa";
const GOOD = "#4ade80";
const BAD = "#f87171";
const MATCHES = 200;

function Mark({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "baseline", fontSize: 11, fontWeight: 800, color: ok ? GOOD : BAD }}>
      {ok ? "✓" : "✗"} <span style={{ color: MUTED, fontWeight: 700 }}>{text}</span>
    </span>
  );
}

export default function FunTargetsReport() {
  const [reports, setReports] = useState<PositionReport[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);

  const run = () => {
    setBusy(true);
    // Let the button repaint before the matches run.
    window.setTimeout(() => {
      const t0 = performance.now();
      setReports(reportAll(MATCHES));
      setSecs((performance.now() - t0) / 1000);
      setBusy(false);
    }, 30);
  };
  const problems = reports ? guardrailProblems(reports) : [];

  return (
    <div style={{ marginTop: 18, padding: "12px 12px 14px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>Fun targets</h2>
        <span style={{ fontSize: 10, fontWeight: 900, color: "#fbbf24", border: "1px solid #fbbf24", borderRadius: 6, padding: "1px 5px" }}>DRAFT</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginTop: 4 }}>
        What the match hands each position, against Harry&apos;s table. The radar has no league input yet, so each number is checked against the National League and the Premier League side by side. A broken guardrail fails the test; a missed target only reports.
      </div>
      <button onClick={run} disabled={busy} style={{
        marginTop: 10, padding: "9px 14px", borderRadius: 12, border: "none", background: busy ? "#334155" : "#2563eb",
        color: "#fff", fontWeight: 800, fontSize: 13,
      }}>{busy ? "Playing matches…" : reports ? `Run again (${MATCHES} matches each)` : `Run it (${MATCHES} matches each)`}</button>

      {reports && (
        <>
          <div style={{ marginTop: 10, fontSize: 11, fontWeight: 800, color: problems.length ? BAD : GOOD }}>
            {problems.length ? `Guardrails broken: ${problems.join("; ")}` : `Guardrails hold (shots a match 21–28 even, 20–32 in a mismatch; table never above ${GUARDRAILS.premSeasonGoalsMax.high} season goals).`}
            <span style={{ color: MUTED, fontWeight: 700 }}> Ran in {secs.toFixed(1)}s.</span>
          </div>
          {reports.map((r) => {
            const rows = rowsFor(r.pos, r.gaps.even);
            const imp = impliedConversion(r.pos, r.gaps.even.chances);
            return (
              <div key={r.pos} style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{r.pos === "W" ? "W (LW + RW)" : r.pos} <span style={{ color: MUTED, fontWeight: 700, fontSize: 11 }}>even game</span></div>
                {rows.map((x) => (
                  <div key={x.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 8px", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{x.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{formatValue(x.ours, x.unit)}</div>
                    <div style={{ gridColumn: "1 / span 2", display: "flex", flexWrap: "wrap", gap: "2px 14px" }}>
                      <Mark ok={x.okNational} text={`Nat. League ${formatBand(x.national, x.unit)}`} />
                      <Mark ok={x.okPremier} text={`Premier ${formatBand(x.premier, x.unit)}`} />
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginTop: 6 }}>
                  Season goals are not judged (the radar cannot play your shots). They ask your shooting for: {imp.map((i) => `${i.level === "national" ? "NL" : "Prem"} ${i.rating}: ${(i.needs * 100).toFixed(1)}% of chances`).join(" · ")}.
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginTop: 4 }}>
                  Shots a match, both sides: {r.gaps.even.shots.toFixed(1)}. By gap:
                </div>
                {GAPS.map((g) => {
                  const m = r.gaps[g.id];
                  return (
                    <div key={g.id} style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginTop: 2 }}>
                      <span style={{ color: INK, fontWeight: 900 }}>{g.label}</span> chances {m.chances.toFixed(1)} · fallback {(m.fallback * 100).toFixed(0)}% · longest wait {m.longestWait.toFixed(0)}&apos; · nothing by 20&apos; {(m.nothingBy20 * 100).toFixed(0)}%
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
