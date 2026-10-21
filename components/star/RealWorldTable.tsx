"use client";
/**
 * REAL WORLD COLUMN (sim rebuild, 21 Oct 2026). Harry: replace the licensed
 * numbers with free ones, "first shown as a real-world column beside today's
 * numbers". Plays the radar's own match (playRadarMatch → hiddenMatch.tick)
 * N times with the page's setup, Match flow Old and New, and puts each total
 * beside the real-football target from lib/star/sim/realTargets.json (free
 * Wyscout data, made by scripts/opendata/reduce_resource.py).
 *
 * Reads only: it never changes the match, a setting or a save. The unseen
 * match does not model shots on target, blocks, fouls, cards or offsides yet
 * (the formula rebuild adds them), so those rows say "not in the match yet".
 */
import { useState } from "react";
import { playRadarMatch, radarSummary } from "@/lib/star/matchRadar";
import type { HiddenMatchInputs } from "@/lib/star/hiddenMatch";
import REAL from "@/lib/star/sim/realTargets.json";

const MUTED = "#8a97aa";

interface Totals { shots: number; goals: number; conversion: number; corners: number; cornersUs: number; cornersThem: number; possession: number }

function measure(inputs: HiddenMatchInputs, n: number): Totals {
  let shots = 0, goals = 0, corners = 0, cu = 0, ct = 0, poss = 0;
  for (let s = 1; s <= n; s++) {
    const m = playRadarMatch(s * 7919 + 11, inputs);
    const sum = radarSummary(m);
    shots += sum.chancesUs + sum.chancesThem;
    goals += sum.userScore + sum.oppScore;
    poss += sum.possessionUs;
    for (const f of m.frames) for (const e of f.events) {
      if (e.kind === "corner-us") { corners++; cu++; }
      if (e.kind === "corner-them") { corners++; ct++; }
    }
  }
  return { shots: shots / n, goals: goals / n, conversion: shots ? (100 * goals) / shots : 0, corners: corners / n, cornersUs: cu / n, cornersThem: ct / n, possession: poss / n };
}

const realOf = (key: string) => REAL.rows.find((r) => r.key === key);
const fmtReal = (key: string) => { const r = realOf(key); return r ? `${r.value}${r.unit}` : "–"; };

export default function RealWorldTable({ inputs, label }: { inputs: HiddenMatchInputs; label: string }) {
  const [n, setN] = useState(200);
  const [res, setRes] = useState<{ old: Totals; flow: Totals; secs: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    window.setTimeout(() => {
      const t0 = performance.now();
      const old = measure({ ...inputs, matchFlow: false }, n);
      const flow = measure({ ...inputs, matchFlow: true }, n);
      setRes({ old, flow, secs: (performance.now() - t0) / 1000 });
      setBusy(false);
    }, 30);
  };
  const f = (v: number, d = 1) => v.toFixed(d);
  const NOT = "not in the match yet";
  const rows: [string, string, string, string][] = res ? [
    ["Shots a match (chances, both sides)", f(res.old.shots), f(res.flow.shots), fmtReal("shots")],
    ["Goals a match", f(res.old.goals, 2), f(res.flow.goals, 2), fmtReal("goals")],
    ["Shots that score", `${f(res.old.conversion)}%`, `${f(res.flow.conversion)}%`, fmtReal("conversion")],
    ["Corners a match", f(res.old.corners), f(res.flow.corners), fmtReal("corners")],
    ["Corners, us v them", `${f(res.old.cornersUs)} v ${f(res.old.cornersThem)}`, `${f(res.flow.cornersUs)} v ${f(res.flow.cornersThem)}`, `${fmtReal("cornersEach")} each (even)`],
    ["Our possession", `${f(res.old.possession, 0)}%`, `${f(res.flow.possession, 0)}%`, `50% even · ${fmtReal("possessionTopBottom")} top v bottom`],
    ["Shots on target", NOT, NOT, fmtReal("onTarget")],
    ["Shots blocked", NOT, NOT, fmtReal("blocked")],
    ["Keeper saves, of on target", NOT, NOT, fmtReal("saves")],
    ["Fouls / yellows / reds", NOT, NOT, `${fmtReal("fouls")} / ${fmtReal("yellows")} / ${fmtReal("reds")}`],
    ["Offsides", NOT, NOT, fmtReal("offsides")],
    ["Headers, share of shots", NOT, NOT, fmtReal("headersShare")],
  ] : [];
  return (
    <div data-real-world>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>
        {label}: the unseen match played {n} times, Match flow Old (live today) and New, beside real football (free Wyscout data, {REAL.meta.matches} matches).
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {[100, 200, 500].map((v) => (
          <button key={v} onClick={() => setN(v)} style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", background: n === v ? "#2563eb" : "transparent", color: n === v ? "#fff" : "inherit", fontSize: 12, fontWeight: 800 }}>{v}</button>
        ))}
        <button onClick={run} disabled={busy} style={{ padding: "4px 12px", borderRadius: 999, border: "none", background: busy ? "#334155" : "#16a34a", color: "#fff", fontSize: 12, fontWeight: 800 }}>
          {busy ? "Playing…" : res ? "Measure again" : "Measure"}
        </button>
      </div>
      {res && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: MUTED, textAlign: "left" }}><th style={{ padding: "4px 6px" }}>What</th><th style={{ padding: "4px 6px" }}>Old (live)</th><th style={{ padding: "4px 6px" }}>New</th><th style={{ padding: "4px 6px" }}>Real world</th></tr>
            </thead>
            <tbody>
              {rows.map(([w, a, b, r]) => (
                <tr key={w} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: "4px 6px", fontWeight: 700 }}>{w}</td>
                  <td style={{ padding: "4px 6px", color: a === NOT ? MUTED : "inherit" }}>{a}</td>
                  <td style={{ padding: "4px 6px", color: b === NOT ? MUTED : "inherit" }}>{b}</td>
                  <td style={{ padding: "4px 6px", fontWeight: 800 }}>{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>Ran in {res.secs.toFixed(1)} s. Real world: lib/star/sim/realTargets.json (credit: Settings → Data credits, or /credits).</div>
        </div>
      )}
    </div>
  );
}
