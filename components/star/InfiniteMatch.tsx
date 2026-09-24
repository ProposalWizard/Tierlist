"use client";

/**
 * INFINITE MATCH — a real match that does not stop, and a running count of
 * what it actually served you.
 *
 * Asked for twice. First: "as well as the infinite highlights we need an
 * infinite match, an in game match that can last like 10,000 minutes that
 * actually just shows what happens in a game and helps us tune it, or just a
 * replayable random match from any division and level of player." And the
 * reason, in the same message: "right now I've played like 5 games and seen
 * ZERO of these one on ones, mainly seeing cutbacks."
 *
 * That sentence could not be checked against anything. Infinite Highlights
 * shows what the GENERATOR can produce; it says nothing about what a match
 * hands you, because a match picks a zone first and the chance second. The
 * only way to answer it was to play whole matches and count — which is what
 * this is, with the counting done for you.
 *
 * IT IS THE REAL MATCH. Not a simulation of one and not a fork: the same
 * `CanvasMatch` a career plays, in career-match mode (a fixture and an
 * onComplete), against a real synthetic career. Two things are different and
 * both are opt-in props that a career never passes:
 *
 *   matchLengthMinutes  the FA rule book's own field, which the game already
 *                       reads (CanvasMatch.tsx's MATCH_DURATION). No new
 *                       mechanism, just a bigger number in an existing one.
 *   neverHooked         `hookCheck` can take you off from minute 60. Right
 *                       for a career, fatal here — a 10,000-minute match was
 *                       measured ending around minute 75.
 *
 * The tally comes off `onChanceServed`, which reports every chance including
 * a dribble (which has no ScenarioKind of its own), so the counts add up to
 * the chances actually played rather than to most of them.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import EnginePlay from "./EnginePlay";
import { buildTestCareer } from "@/lib/star/engineProfile";
import LiveChanceEditor from "./LiveChanceEditor";
import { liveMatchScenario } from "@/lib/star/liveEdit";
import { saveScenarioShared } from "@/lib/star/scenarioStore";
import type { Scenario, ScenarioKind } from "@/lib/star/canvasEngine";
import type { PlaySettings } from "@/lib/star/playArea";

const INK = "#f2f5f9";
const MUTED = "#8a97aa";

const kindLabel = (k: string) => k.replace(/_/g, " ");

/** What the match has handed you so far. */
interface Served {
  kind: string;
  minute: number;
}

/**
 * The match is built by the shared test-screen setup (lib/star/engineProfile.ts
 * `buildTestCareer`), played through EnginePlay — the one way a test screen
 * plays the game — with the real squads, the real weather and fresh legs
 * every ninety minutes.
 */
export default function InfiniteMatch({ settings, onBack }: {
  settings: PlaySettings;
  onBack: () => void;
}) {
  /** Bumped to start a fresh match. Also the component key, because
   *  CanvasMatch takes its career, fixture and match length once at mount. */
  const [run, setRun] = useState(0);
  const [served, setServed] = useState<Served[]>([]);
  const [done, setDone] = useState<string | null>(null);
  // Counts arrive one chance at a time from inside the match's own loop, so
  // they are accumulated in a ref and flushed to state — setState from every
  // chance is fine, but the ref is what keeps the list stable if React
  // batches two together.
  const servedRef = useRef<Served[]>([]);
  /** The chance on screen now, as it stood before the kick — what Edit opens. */
  const [current, setCurrent] = useState<{ scenario: Scenario; minute: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"saving" | "committing" | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  /** Save the chance on screen as it stands — no editing needed. */
  const saveCurrent = async () => {
    if (!current) return;
    setBusy("saving");
    const res = await saveScenarioShared(liveMatchScenario(current.scenario, current.minute));
    setBusy(null);
    setFlash(res.ok
      ? { ok: true, text: `Saved as a ${kindLabel(current.scenario.kind)} scenario — it is in the gallery now.` }
      : { ok: false, text: `Not saved — ${res.message}` });
  };
  /** Commit it straight into the game's code. */
  const commitCurrent = async () => {
    if (!current) return;
    setBusy("committing");
    try {
      const r = await fetch("/api/star/scenarios/commit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: liveMatchScenario(current.scenario, current.minute) }),
      });
      const d = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };
      setFlash(r.ok && d.ok
        ? { ok: true, text: d.message ?? "Committed — it is in the game." }
        : { ok: false, text: `Not committed — ${d.error ?? r.status}` });
    } catch {
      setFlash({ ok: false, text: "Not committed — couldn't reach the server." });
    }
    setBusy(null);
  };

  const built = useMemo(() => buildTestCareer(settings, 1000 + run), [settings, run]);

  const onChanceServed = useCallback((info: { kind: ScenarioKind | "dribble"; minute: number; scenario?: Scenario }) => {
    servedRef.current = [...servedRef.current, { kind: info.kind, minute: info.minute }];
    setServed(servedRef.current);
    setCurrent(info.scenario ? { scenario: info.scenario, minute: info.minute } : null);
    setFlash(null);
  }, []);

  const restart = () => {
    servedRef.current = [];
    setServed([]);
    setDone(null);
    setRun((r) => r + 1);
  };

  const rows = useMemo(() => {
    const by = new Map<string, number>();
    for (const s of served) by.set(s.kind, (by.get(s.kind) ?? 0) + 1);
    return Array.from(by, ([kind, n]) => ({ kind, n, share: n / served.length }))
      .sort((a, b) => b.n - a.n);
  }, [served]);

  const lastMinute = served.length ? served[served.length - 1].minute : 0;
  // Per 90 is the number that means something to a person: "six chances a
  // match" is readable, "0.0007 chances a minute" is not.
  const per90 = lastMinute > 0 ? (served.length / lastMinute) * 90 : 0;

  if (!built) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: MUTED, fontSize: 14, fontWeight: 700 }}>
        Couldn&apos;t build a match for that division — nothing was played.
        <div style={{ marginTop: 14 }}>
          <button style={btn} onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 12px 30px", display: "grid", gap: 12, justifyItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, display: "flex", gap: 8, alignItems: "center" }}>
        <button style={{ ...btn, flex: "none" }} onClick={onBack}>&#8249; Back</button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: MUTED, lineHeight: 1.35 }}>
          {built.career.player.club} vs {built.fixture.opponent}
          <br />
          {settings.position} · {settings.matchMinutes.toLocaleString()} minutes
        </div>
        <button style={{ ...btn, flex: "none" }} onClick={restart}>New match</button>
      </div>

      {/* THE CHANCE ON SCREEN — Edit, Save, Commit. Reported directly: "there is
          no save and commit buttons inside a match highlight". It was one Edit
          button that scrolled away above the scoreboard; now all three stay
          pinned to the top of the screen for as long as the match runs. */}
      <div style={{
        position: "sticky", top: 0, zIndex: 30, width: "100%", maxWidth: 460,
        padding: "6px 0", background: "#05070d", display: "grid", gap: 4,
      }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textAlign: "center", textTransform: "capitalize" }}>
          {current ? `This chance: ${kindLabel(current.scenario.kind)} · ${current.minute}'` : "Waiting for a chance…"}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ ...btn, flex: 1, height: 42, opacity: current ? 1 : 0.4 }} disabled={!current} onClick={() => setEditing(true)}>
            &#9998; Edit
          </button>
          <button
            style={{ ...btn, flex: 1, height: 42, color: "#bbf7d0", borderColor: "rgba(34,197,94,0.45)", opacity: current ? 1 : 0.4 }}
            disabled={!current || !!busy} onClick={() => void saveCurrent()}
          >
            {busy === "saving" ? "Saving…" : "Save"}
          </button>
          <button
            style={{ ...btn, flex: 1, height: 42, color: "#e0f2fe", borderColor: "rgba(56,189,248,0.45)", opacity: current ? 1 : 0.4 }}
            disabled={!current || !!busy} onClick={() => void commitCurrent()}
          >
            {busy === "committing" ? "Committing…" : "Commit"}
          </button>
        </div>
        {flash && (
          <div style={{ fontSize: 12, fontWeight: 700, textAlign: "center", color: flash.ok ? "#4ade80" : "#fca5a5" }}>
            {flash.text}
          </div>
        )}
      </div>
      {editing && current && (
        <LiveChanceEditor scenario={current.scenario} minute={current.minute} onClose={() => setEditing(false)} />
      )}

      <div style={{ width: "100%", maxWidth: 460 }}>
        <EnginePlay
          key={run}
          settings={settings}
          seed={1000 + run}
          onChanceServed={onChanceServed}
          onComplete={() => setDone("Full time.")}
        />
      </div>

      {/* ── WHAT IT ACTUALLY SERVED ──
          The whole reason this screen exists. Counts, shares and a per-90,
          from the real match, updating as you play it. */}
      <div style={{
        width: "100%", maxWidth: 460, borderRadius: 14, padding: "12px 14px",
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>What it served</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: MUTED }}>
            {served.length} in {lastMinute}&apos; · {per90.toFixed(1)} per 90
          </span>
        </div>

        {served.length === 0 ? (
          <p style={{ margin: "8px 0 0", fontSize: 12.5, fontWeight: 600, color: MUTED, lineHeight: 1.5 }}>
            Nothing yet. Every chance the match hands you gets counted here — including
            a dribble, which is not a chance kind but is still a thing it gave you
            instead of one.
          </p>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 5 }}>
            {rows.map((r) => (
              <div key={r.kind} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  flex: "none", width: 116, fontSize: 12, fontWeight: 700, color: INK,
                  textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {kindLabel(r.kind)}
                </span>
                <span style={{ flex: 1, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.07)" }}>
                  <span style={{
                    display: "block", height: "100%", borderRadius: 999,
                    width: `${Math.max(2, r.share * 100)}%`,
                    background: r.kind === "dribble" ? "rgba(167,139,250,0.75)" : "rgba(56,189,248,0.75)",
                  }} />
                </span>
                <span style={{
                  flex: "none", width: 62, textAlign: "right", fontSize: 11.5,
                  fontWeight: 700, color: MUTED, fontFamily: "ui-monospace, monospace",
                }}>
                  {r.n} · {(r.share * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {done && (
        <div style={{ fontSize: 13, fontWeight: 800, color: "#4ade80" }}>{done}</div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  height: 38, padding: "0 12px", borderRadius: 12, cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.05)",
  color: INK, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
};
