"use client";

/**
 * FULL HIGHLIGHTS REBUILD — the test page (Harry, 19 Oct 2026; plan page
 * "The Full Highlights Rebuild", phases 0–2).
 *
 * Three things on it:
 *   · the switch (Settings → Harry changes → "Full highlights rebuild:
 *     Off | On (test)"), so it can be flipped here too;
 *   · THE RULER: today's numbers, measured here and now from the real unseen
 *     match, the real chance maker and the real engine (lib/star/fhr/ruler.ts)
 *     over N whole matches — the line every later phase is held to. Off is
 *     today (Chances: Old); On is what the switch turns on (Chances: New).
 *     "Players reacting" needs the engine's physics, which only the real match
 *     may run in shipped code (one-engine guard), so it is measured in the
 *     terminal (scripts/fhr/ruler.mts --write) and shown from that snapshot;
 *   · PHASE 2: a generated build-up (lib/star/fhr/buildUp.ts) played by the
 *     real match (EnginePlay's leadIn replay), drawn from above beside it,
 *     with "Generate another" (BuildUpPanel.tsx).
 *
 * Nothing here is saved, and nothing reaches a career.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BroadcastPage, Panel, PanelGrid, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import { useFhrMode } from "@/lib/star/fhr/toggle";
import { setLookRow } from "@/lib/star/lookRows";
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { measureRuler, PLAN_REFERENCE, REACT_MOVE_M, REACT_EARLY_S, type Ruler } from "@/lib/star/fhr/ruler";
import snap from "@/lib/star/fhr/reactSnapshot.json";
import BuildUpPanel from "./BuildUpPanel";
import "./fhr.css";

const SIZES = [50, 200, 500];
const f2 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "–" : v.toFixed(2));
const f1 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "–" : v.toFixed(1));
const kindName = (k: string) => k.replace(/_/g, " ");

export default function FhrDev() {
  const fhr = useFhrMode();
  const [n, setN] = useState(200);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ off: Ruler; on: Ruler } | null>(null);

  const run = useCallback((matches: number) => {
    setBusy(true);
    // No per-visit drawing offset (chanceMaker.ts visit salt): the same seeds
    // give the same numbers here as in the terminal, every visit.
    setVisitSalt(0);
    // A tick first, so "Measuring…" is on screen before the work starts.
    window.setTimeout(() => {
      const off = measureRuler({ matches, chances: "old" });
      const on = measureRuler({ matches, chances: "new" });
      setRes({ off, on });
      setBusy(false);
    }, 30);
  }, []);
  useEffect(() => { run(200); }, [run]);

  const kinds = res
    ? Array.from(new Set([...res.off.byKind.map((k) => k.kind), ...res.on.byKind.map((k) => k.kind)]))
    : [];
  const row = (r: Ruler, kind: string) => r.byKind.find((k) => k.kind === kind);
  const reactOf = (side: "off" | "on", kind: string): number | undefined =>
    (snap[side].byKind as Record<string, { reacting: number }>)[kind]?.reacting;

  return (
    <BroadcastPage title="Full highlights rebuild" sub="The switch, and today's numbers: the ruler every phase is held to." width={1100}>
      <PanelGrid min={300}>
        <Panel title="The switch" note="Settings → Harry changes">
          <div className="fhr-switch">
            <Pill on={fhr === "off"} onClick={() => setLookRow("fhr", "off")}>Off</Pill>
            <Pill on={fhr === "on"} onClick={() => setLookRow("fhr", "on")}>On (test)</Pill>
          </div>
          <Note>Off: the game as it is today. On: Chances turns New, and every open-play chance in a match starts with a generated 4–8 s build-up (phase 2, below). Stored on this phone only. Infinite Highlights now draws its still with the match&apos;s own camera whatever this says (?still=builder for the old frame).</Note>
          <Btn href="/star-highlights-dev">Infinite Highlights →</Btn>
        </Panel>
        <Panel title="Measure" note={busy ? "Measuring…" : res ? `${res.off.matches} matches each, ${((res.off.ms + res.on.ms) / 1000).toFixed(1)} s` : ""}>
          <Label>Matches</Label>
          <div className="fhr-switch">
            {SIZES.map((s) => <Pill key={s} on={n === s} onClick={() => setN(s)}>{s}</Pill>)}
          </div>
          <Btn main onClick={() => run(n)} disabled={busy}>{busy ? "Measuring…" : "Measure again"}</Btn>
          <Note>An even game (70 v 70), you a striker. The same seeds every time, so the numbers only move when the game does.</Note>
        </Panel>
      </PanelGrid>

      <Panel title="The ruler" note="Off = today">
        {!res ? <Note>Measuring…</Note> : (
          <div className="fhr-scroll">
            <table className="fhr-table" data-fhr-ruler>
              <thead><tr><th>What</th><th>Off (today)</th><th>On (Chances: New)</th><th>Plan quotes</th></tr></thead>
              <tbody>
                <tr><td>Your chances a match</td><td>{f2(res.off.chancesPerMatch)}</td><td>{f2(res.on.chancesPerMatch)}</td><td>–</td></tr>
                <tr><td>Goals a match (both sides)</td><td>{f2(res.off.goalsPerMatch)}</td><td>{f2(res.on.goalsPerMatch)}</td><td>~{PLAN_REFERENCE.goalsEvenGame}</td></tr>
                <tr><td>Players reacting a chance *</td><td>{f2(snap.off.reactingPerChance)}</td><td>{f2(snap.on.reactingPerChance)}</td><td>{PLAN_REFERENCE.reactingDrawn} (other count)</td></tr>
                <tr><td>…of them team-mates *</td><td>{f2(snap.off.matesReactingPerChance)}</td><td>{f2(snap.on.matesReactingPerChance)}</td><td>–</td></tr>
                <tr><td>…moving within {REACT_EARLY_S} s *</td><td>{f2(snap.off.reactingEarlyPerChance)}</td><td>{f2(snap.on.reactingEarlyPerChance)}</td><td>–</td></tr>
                <tr><td>Chance start distance (median)</td><td>{f1(res.off.startMedianM)} m</td><td>{f1(res.on.startMedianM)} m</td><td>–</td></tr>
                <tr><td>One-on-one start distance</td><td>{f1(res.off.oneOnOneStartM)} m</td><td>{f1(res.on.oneOnOneStartM)} m</td><td>{PLAN_REFERENCE.oneOnOneStartDrawnM} m (real {PLAN_REFERENCE.oneOnOneStartRealM})</td></tr>
              </tbody>
            </table>
            <Note>* From the terminal, {snap.matches} matches, {snap.measured}: <code>npx tsx scripts/fhr/ruler.mts {snap.matches} --write</code>. The rest is measured here, now.</Note>
          </div>
        )}
      </Panel>

      <Panel title="Your chances by kind" note="a match · start distance · players reacting (*)">
        {!res ? <Note>Measuring…</Note> : (
          <div className="fhr-scroll">
            <table className="fhr-table" data-fhr-kinds>
              <thead><tr><th>Kind</th><th>Off: a match</th><th>start</th><th>react</th><th>On: a match</th><th>start</th><th>react</th></tr></thead>
              <tbody>
                {kinds.map((k) => {
                  const a = row(res.off, k), b = row(res.on, k);
                  return (
                    <tr key={k}>
                      <td>{kindName(k)}</td>
                      <td>{f2(a?.n ?? 0)}</td><td>{f1(a?.startM)}</td><td>{f1(reactOf("off", k))}</td>
                      <td>{f2(b?.n ?? 0)}</td><td>{f1(b?.startM)}</td><td>{f1(reactOf("on", k))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Phase 2: a generated build-up" note="the real match plays it · with the switch On, every open-play chance gets one">
        <BuildUpPanel />
      </Panel>

      <Panel title="How it is measured">
        <Note>Each match runs the real unseen match minute by minute. Every chance it hands you is made by the real chance maker, then struck once in the real engine: a firm low shot at the middle of the goal, or a firm pass to the runner when there is no goal in view.</Note>
        <Note>Reacting: a man (not you, not the keeper) who moves {REACT_MOVE_M} m or more before the chance ends. The plan&apos;s 1.17 used another count, so compare this table with itself.</Note>
        <Note>Your finishing is a stand-in rate (24% in the box), so goals follow the stand-in, not your feet. Not in here: the dribble deal, team-mates&apos; penalties, the build-up, real squads. Same numbers in the terminal: <code>npx tsx scripts/fhr/ruler.mts 200</code>.</Note>
        <Note><Link href="/star-highlights-dev">Infinite Highlights</Link>: the still is framed by the match&apos;s camera. Checked press by press with <code>node scripts/fhr/still-vs-play.mjs 100 on</code>.</Note>
      </Panel>
      <PageGuide page="/star-fhr-dev" />
    </BroadcastPage>
  );
}
