"use client";

/**
 * LIVE CHANCES — the test area (Leo, 29 Oct 2026).
 *
 * The real match (EnginePlay, the one engine) plays the chances the match
 * serves, each after its real build-up, with live chances on for THIS page
 * only (lib/star/liveChance.ts setLiveTest): the last pass keeps coming, you
 * time the swing, and where the ball is when you swing decides the strike.
 * The dials are this page's only (never saved; the game plays the defaults).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EnginePlay from "@/components/star/EnginePlay";
import Match3DLayer from "@/components/star/Match3DLayer";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import type { Scenario } from "@/lib/star/canvasEngine";
import type { LeadIn } from "@/lib/star/leadIn";
import { fhrBuildUpFor, fhrWantsBuildUp } from "@/lib/star/fhr/buildUp";
import { servedChances, type ServedChance } from "@/lib/star/fhr/servedChances";
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { LIVE_DEFAULTS, LIVE_DIAL_INFO, LIVE_LIMITS, liveKindOK, setLiveTest, type LiveDials } from "@/lib/star/liveChance";

const copy = (sc: Scenario): Scenario => JSON.parse(JSON.stringify(sc));
const KIND = (k: string) => k.replace(/_/g, " ");
type Swing = { hit: boolean; why?: string; timing?: string; along?: number; power?: number; bentDeg?: number; contact?: { cx: number; cy: number } };

const DIALS = LIVE_DIAL_INFO;
/** Where on the ball it was struck, in words. */
const struck = (c?: { cx: number; cy: number }) => !c ? "?"
  : [c.cy > 0.4 ? "under it (chip)" : c.cy < -0.4 ? "top (driven)" : "middle", Math.abs(c.cx) > 0.35 ? "side (curl)" : ""].filter(Boolean).join(", ");

export default function LiveChancesDev() {
  const [on, setOn] = useState(true);
  const [buildUps, setBuildUps] = useState(true);
  const [strike, setStrike] = useState(true);
  // After a chance: a new one, or the same one again from its build-up (never the static picture).
  const [after, setAfter] = useState<"new" | "again">("new");
  const [dials, setDials] = useState<LiveDials>({ ...LIVE_DEFAULTS });
  const [pool, setPool] = useState<ServedChance[]>([]);
  const [kind, setKind] = useState<string>("all");
  const [at, setAt] = useState(0);
  const [run, setRun] = useState(0);
  const [swing, setSwingState] = useState<Swing | null>(null);
  const swingRef = useRef<Swing | null>(null);
  const setSwing = useCallback((s: Swing | null) => { swingRef.current = s; setSwingState(s); }, []);
  const [log, setLog] = useState<{ kind: string; swing: Swing | null; outcome: string }[]>([]);

  // This page's own switch and dials (in memory; cleared when you leave).
  useEffect(() => { setLiveTest({ on, strike, dials }); }, [on, strike, dials]);
  useEffect(() => () => setLiveTest(null), []);
  useEffect(() => {
    setVisitSalt(0);
    setPool(servedChances({ count: 160, seed: 29 }).filter((c) => liveKindOK(c.sc.kind) && fhrWantsBuildUp(c.sc.kind, c.moment)));
  }, []);
  useEffect(() => {
    const f = (e: Event) => setSwing((e as CustomEvent).detail as Swing);
    window.addEventListener("kib-live-swing", f);
    return () => window.removeEventListener("kib-live-swing", f);
  }, [setSwing]);

  const kinds = useMemo(() => Array.from(new Set(pool.map((c) => c.sc.kind))), [pool]);
  const list = useMemo(() => (kind === "all" ? pool : pool.filter((c) => c.sc.kind === kind)), [pool, kind]);
  const chance = list.length ? list[at % list.length] : null;
  const openOn = useMemo(() => () => copy((chance ?? pool[0]).sc), [chance, pool]);
  const leadIn = useCallback((sc: Scenario): LeadIn | null => (chance && buildUps ? fhrBuildUpFor(sc, chance.moment) : null), [chance, buildUps]);

  const next = () => { setSwing(null); setAt((a) => a + 1); };
  const again = () => { setSwing(null); setRun((r) => r + 1); };
  // The match serves the same picture again after a chance (one-picture screens do); here it
  // never plays that static copy: the moment it is served a second time, the next one starts
  // (a new chance, or this one again from its build-up, live).
  // Counted per match on screen (its key), so a fresh match always starts at its first serve.
  const mountKey = `${kind}-${at}-${run}-${buildUps}-${on}`;
  const keyRef = useRef(mountKey); keyRef.current = mountKey;
  // Which match on screen has finished its chance (its key): the next picture it opens is the copy.
  const resolvedKey = useRef("");
  const afterRef = useRef(after); afterRef.current = after;
  const onServed = useCallback(() => {
    if (resolvedKey.current !== keyRef.current) return;
    resolvedKey.current = "";
    setSwing(null);
    if (afterRef.current === "again") setRun((r) => r + 1); else setAt((a) => a + 1);
  }, [setSwing]);
  useEffect(() => {
    window.addEventListener("kib-picture-opened", onServed);
    return () => window.removeEventListener("kib-picture-opened", onServed);
  }, [onServed]);
  const verdict = (s: Swing | null) => !s ? "No swing yet"
    : !s.hit ? (s.why === "past" ? "Let it run past: chance gone" : s.why === "early" ? "Too early: fresh air" : "Too late: fresh air")
    : `${s.timing === "sweet" ? "Clean" : s.timing === "early" ? "Early (stabbed)" : "Late (got under it)"} · ${(s.along ?? 0) >= 0 ? "+" : ""}${(s.along ?? 0).toFixed(2)} m from the spot · ${struck(s.contact)} · power ${Math.round((s.power ?? 0) * 100)} · pace bent it ${(s.bentDeg ?? 0).toFixed(1)}°`;

  return (
    <BroadcastPage title="Live chances" sub="Test area: the pass keeps coming, you time the strike. On this page only; the game is unchanged unless you turn it on in Settings → Updates." width={1100}>
      <PageGuide page="/star-live-chances-dev" />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }} data-live-switch>
        <Pill on={on} onClick={() => setOn(true)}>Live: On</Pill>
        <Pill on={!on} onClick={() => setOn(false)}>Live: Off (the game as now)</Pill>
        <span style={{ width: 10 }} />
        <Pill on={buildUps} onClick={() => setBuildUps(true)}>With build-up</Pill>
        <Pill on={!buildUps} onClick={() => setBuildUps(false)}>No build-up (a made-up pass)</Pill>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }} data-live-strike>
        <Pill on={strike} onClick={() => setStrike(true)}>Kick screen: On (then tap where on the ball)</Pill>
        <Pill on={!strike} onClick={() => setStrike(false)}>Kick screen: Off (letting go = the kick)</Pill>
        <span style={{ width: 10 }} />
        <Pill on={after === "new"} onClick={() => setAfter("new")}>After a chance: a new one</Pill>
        <Pill on={after === "again"} onClick={() => setAfter("again")}>After a chance: the same one, live</Pill>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }} data-live-kinds>
        <Pill on={kind === "all"} onClick={() => { setKind("all"); setAt(0); }}>Every kind</Pill>
        {kinds.map((k) => <Pill key={k} on={kind === k} onClick={() => { setKind(k); setAt(0); }}>{KIND(k)}</Pill>)}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ width: "min(100%, 390px)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <Btn main onClick={next}>Next chance</Btn>
            <Btn onClick={again}>↺ Again</Btn>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
            {chance ? `#${(at % list.length) + 1} of ${list.length} · ${KIND(chance.sc.kind)}` : "Loading chances…"}
          </div>
          <div data-live-verdict style={{ fontSize: 12, fontWeight: 700, color: !swing ? "#fde68a" : swing.hit && swing.timing === "sweet" ? "#6ee7b7" : swing.hit ? "#fbbf24" : "#fca5a5", marginBottom: 6 }}>{verdict(swing)}</div>
          {chance && (
            // In 2D or 3D as this phone's Settings have the match (the career's 3D layer).
            <Match3DLayer key={`3d-${kind}-${at}-${run}-${buildUps}-${on}`}>
            <EnginePlay key={`${kind}-${at}-${run}-${buildUps}-${on}`} seed={11} openOn={openOn} leadIn={buildUps ? leadIn : undefined}
              onChanceResolved={(r) => {
                const sw = swingRef.current;
                resolvedKey.current = keyRef.current;
                setLog((l) => [{ kind: r.kind, swing: sw, outcome: r.outcome }, ...l].slice(0, 12));
                // Read by scripts/film/live/livecheck.mjs.
                const w = window as unknown as { __liveOutcomes?: unknown[] };
                (w.__liveOutcomes ??= []).push({ at: Date.now(), kind: r.kind, outcome: r.outcome, youShot: r.youShot, swing: sw });
              }} />
            </Match3DLayer>
          )}
        </div>
        <div style={{ flex: "1 1 300px", minWidth: 0, maxWidth: 520 }}>
          <Panel title="How it plays" note="The ring on the grass is where you meet the pass: white = not yet, yellow = in reach, green = sweet.">
            <ol style={{ fontSize: 12, margin: "0 0 0 18px", padding: 0, lineHeight: 1.5 }}>
              <li>The build-up plays. Before the last pass reaches you, the chance is yours and the clock slows.</li>
              <li>Drag from the ring to aim, as always. Let go as the ball reaches the ring: that moment is early, clean or late. Kick screen On: then the normal kick screen opens; tap where on the ball (sides curl, bottom chips, top drives). Off: letting go is the kick.</li>
              <li>Ring green: a clean strike. Early: you stab the top of it (low, weaker, skews). Late: you get under it (it rises, weaker).</li>
              <li>Out of reach: fresh air. Never swing: it runs past you. Either way the chance is gone.</li>
              <li>The ball&apos;s own pace carries into the shot.</li>
            </ol>
          </Panel>
          <Panel title="Dials (this page only)">
            {DIALS.map((d) => (
              <div key={d.k} style={{ marginBottom: 8 }} data-live-dial={d.k}>
                <Label>{d.name}: {dials[d.k].toFixed(2)} {d.unit}{dials[d.k] === LIVE_DEFAULTS[d.k] ? " (game)" : ""}</Label>
                <input type="range" min={LIVE_LIMITS[d.k][0]} max={LIVE_LIMITS[d.k][1]} step={d.step} value={dials[d.k]}
                  onChange={(e) => setDials((o) => ({ ...o, [d.k]: Number(e.target.value) }))} style={{ width: "100%" }} />
                <Note>{d.help}</Note>
              </div>
            ))}
            <Btn onClick={() => setDials({ ...LIVE_DEFAULTS })}>Reset to the game&apos;s</Btn>
            <Note>A dial change takes effect on the next chance.</Note>
          </Panel>
          <Panel title="Your last chances">
            {log.length === 0 ? <Note>None yet.</Note> : (
              <ol style={{ fontSize: 12, margin: "0 0 0 18px", padding: 0 }}>
                {log.map((l, i) => <li key={i}>{KIND(l.kind)}: {l.outcome} · {verdict(l.swing)}</li>)}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </BroadcastPage>
  );
}
