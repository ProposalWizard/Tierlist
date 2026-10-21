"use client";

/**
 * PC MATCH + RADAR — the real eleven-a-side match on the left, the whole pitch
 * from above on the right (Harry, 20 Oct 2026, on the five-a-side test area:
 * "The five-a-side area is a cool PC layout — try it for the game, as a test
 * area first, ideally in 3D. The way the ball's moving across the pitch is
 * very cool.").
 *
 * THE MATCH IS THE REAL ONE: EnginePlay (the one way a test screen plays
 * football), in full-match mode, with the Play Area's dials. This page adds
 * nothing to the football. It only reads:
 *   - between chances, the unseen match's minutes, exactly as the match hands
 *     them to its own small radar in the commentary (MatchRadar's LiveRadarTap);
 *   - during a chance, every frame the match has just drawn (EngineFrameContext);
 *   - onChanceServed / onChanceResolved, for the list of this match's chances.
 *
 * 2D | 3D: the career's own "Match view 3D" picture (the same 3D view and
 * camera angle as Match3DLayer), switched on this page only. It never writes
 * the phone's Settings.
 *
 * Nothing is saved anywhere.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label } from "@/components/admin/broadcast/BroadcastPage";
import EnginePlay from "@/components/star/EnginePlay";
import type { ChanceResolved } from "@/components/star/CanvasMatch";
import { LiveRadarTap, describeArea, type LiveRadarReading } from "@/components/star/MatchRadar";
import { MatchRadarLookOverride } from "@/lib/star/matchRadarLook";
import { EngineFrameContext, type EngineFrame, type EngineFrameObserver } from "@/lib/star/engineFrame";
import type { EngineView } from "@/lib/star/style3d/engineView";
import { resolveStyle } from "@/lib/star/style3d/styles";
import { loadPlaySettings } from "@/lib/star/playArea";
import type { RadarTick } from "@/lib/star/hiddenMatch";
import type { Scenario, ScenarioKind } from "@/lib/star/canvasEngine";
import { autoKickOf } from "@/lib/star/penaltyTaking";
import ElevenRadar, { MomentumBar, US, THEM, YOU_RING, toRadar, type ChancePicture, type RadarMan } from "./ElevenRadar";
import "./pcmatch.css";

/** The career's 3D camera angle (Match3DLayer's CAREER_3D_TILT). */
const TILT_3D = 45;

const KIND_NAME: Record<string, string> = {
  one_on_one: "one-on-one", through_ball: "through ball", cutback: "cutback", byline_cross: "byline cross",
  tight_angle: "tight angle", long_range: "long shot", midfield_pass: "midfield pass", buildup: "build-up pass",
  penalty: "penalty", free_kick: "free kick", corner: "corner", volley: "volley", header: "header", dribble: "run at the defence",
};
const kindName = (k: string) => KIND_NAME[k] ?? k.replace(/_/g, " ");

function outcomeWords(o: string): string {
  if (o === "goal" || o === "rebound") return "Goal";
  if (o === "saved" || o === "caught" || o === "tipped") return "Saved";
  if (o === "blocked" || o === "tackled") return "Blocked";
  if (o === "post") return "Off the post";
  if (o === "wide" || o === "over" || o === "out") return "Off target";
  if (o === "delivered") return "Pass on";
  if (o === "offside") return "Offside";
  if (o === "short") return "Ran out";
  return o;
}

/**
 * What the match has told the page, kept out of React so the match itself is
 * never re-drawn by the radar (the radar reads it ~30 times a second).
 */
class LiveStore {
  mode: "between" | "chance" = "between";
  side: "us" | "them" = "us";
  kind = "";
  reading: LiveRadarReading | null = null;
  frame: EngineFrame | null = null;
  trail: { x: number; y: number }[] = [];
  chances: { minute: number; kind: string; side: "us" | "them"; outcome?: string }[] = [];
  version = 0;

  served(info: { kind: ScenarioKind | "dribble"; minute: number; scenario?: Scenario }) {
    this.mode = "chance";
    this.side = autoKickOf(info.scenario)?.side === "them" ? "them" : "us";
    this.kind = info.kind;
    this.frame = null;
    this.trail = [];
    this.chances.push({ minute: info.minute, kind: info.kind, side: this.side });
    this.version++;
  }
  resolved(r: ChanceResolved) {
    const last = this.chances[this.chances.length - 1];
    if (last && !last.outcome) last.outcome = r.autoKick === "them" ? `them:${r.outcome}` : r.outcome;
    this.version++;
  }
  read(r: LiveRadarReading) {
    // The small radar only draws while the commentary runs: the chance is over.
    const changed = this.mode !== "between" || !this.reading || this.reading.minute !== r.minute || this.reading.stepMs !== r.stepMs;
    this.mode = "between";
    this.reading = r;
    if (changed) this.version++;
  }
  onFrame(f: EngineFrame) {
    // Development only: the latest frame, for a test bot to read.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __pcFrame?: EngineFrame }).__pcFrame = f;
    if (this.mode !== "chance" || this.kind === "dribble" || f.phase === "feed" || f.phase === "postmatch") return;
    this.frame = f;
    if (f.ball) {
      const b = toRadar(f.ball, this.side);
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(last.x - b.x, last.y - b.y) > 0.6) this.trail = [...this.trail.slice(-9), b];
    }
    this.version++;
  }
  /** The chance as the radar draws it. */
  picture(): ChancePicture | null {
    // A run at the defence is drawn by its own screen and hands over no frames:
    // the radar keeps the unseen match's last minute for it.
    if (this.mode !== "chance" || this.kind === "dribble") return null;
    const f = this.frame, side = this.side;
    if (!f) return { kind: this.kind, men: [], ball: null, trail: [], cam: null, side };
    const men: RadarMan[] = f.figures.map((g) => ({ ...toRadar(g, side), team: g.team, you: g.sid === "you" || !!g.star }));
    if (f.keeper) men.push({ ...toRadar(f.keeper, side), team: side === "us" ? "them" : "us", keeper: true });
    const v = f.cam.viewport;
    const a = toRadar({ x: v.x1, y: v.y1 }, side), b = toRadar({ x: v.x2, y: v.y2 }, side);
    return {
      kind: this.kind, men, side,
      ball: f.ball ? { ...toRadar(f.ball, side), z: f.ball.z } : null,
      trail: this.trail.slice(0, -1),
      cam: { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) },
    };
  }
}

/** The unseen match's minutes the clock has reached, oldest first. */
function ticksUpTo(r: LiveRadarReading | null): RadarTick[] {
  if (!r) return [];
  const out: RadarTick[] = [];
  for (let m = 0; m <= Math.floor(r.minute); m++) { const t = r.trace.get(m); if (t) out.push(t); }
  return out;
}

export default function PcMatchPage() {
  const [seed, setSeed] = useState(1);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [over, setOver] = useState(false);
  const storeRef = useRef<LiveStore>(new LiveStore());

  // A full-screen test page: the radar beside the match stays pinned while the
  // page scrolls to the pitch (see globals.css on `knowitball-immersive`).
  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = Number(q.get("seed"));
    if (s > 0) setSeed(Math.floor(s));
    if (q.get("view") === "3d") setView("3d");
  }, []);

  const fullTime = useCallback(() => setOver(true), []);
  const newMatch = () => {
    storeRef.current = new LiveStore();
    setOver(false);
    setSeed((s) => s + 1);
  };

  return (
    <BroadcastPage title="PC match + radar" sub="The real match and the whole pitch from above: side by side on a computer, the radar under the match on a phone.">
      <div className="pm-bar">
        <Btn main onClick={newMatch}>↻ New match</Btn>
        <span className="pm-muted">Match {seed}</span>
        <span className="pm-gap" />
        <Label>View</Label>
        <Pill on={view === "2d"} onClick={() => setView("2d")}>2D</Pill>
        <Pill on={view === "3d"} onClick={() => setView("3d")}>3D</Pill>
        <Link className="pm-link" href="/star-play-dev">Club and dials: Play Area ›</Link>
      </div>
      <div className="pm-play">
        <div className="pm-pitch">
          <MatchMount key={seed} seed={seed} view={view} store={storeRef.current} onOver={fullTime} />
        </div>
        <div className="pm-side" data-side-column>
          <RadarColumn key={seed} store={storeRef.current} over={over} onAgain={newMatch} part="radar" view3d={view === "3d"} />
        </div>
      </div>
      <div className="pm-under">
        <RadarColumn key={seed} store={storeRef.current} over={over} onAgain={newMatch} part="list" />
      </div>
      <PageGuide page="/star-pc-match-dev" />
    </BroadcastPage>
  );
}

/**
 * The real match, mounted once per match. Memoised: the radar reads ~30 times
 * a second and must never make the match draw again.
 */
const MatchMount = memo(function MatchMount({ seed, view, store, onOver }: {
  seed: number; view: "2d" | "3d"; store: LiveStore; onOver: () => void;
}) {
  // ── The 3D picture (the career's Match view 3D), this page only ──
  const box = useRef<{ wrap: HTMLDivElement; canvas: HTMLCanvasElement } | null>(null);
  const ev = useRef<EngineView | null>(null);
  const kill = useRef<(() => void) | null>(null);
  const [boxN, setBoxN] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "off">("idle");
  const viewRef = useRef(view);
  viewRef.current = view;

  const build = useCallback(() => {
    const b = box.current;
    if (!b || kill.current) return;
    const holder = document.createElement("div");
    holder.setAttribute("data-real3d", "");
    Object.assign(holder.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    b.canvas.insertAdjacentElement("afterend", holder);
    let dead = false;
    setStatus("loading");
    void import("@/lib/star/style3d/engineView")
      .then(({ createEngineView }) => createEngineView(holder, { def: resolveStyle("real", "play"), tod: "golden", tilt: TILT_3D, canvas2d: b.canvas }))
      .then((v) => {
        if (dead) { v.dispose(); return; }
        ev.current = v;
        v.setVisible(viewRef.current === "3d");
        setStatus("ready");
      })
      .catch((e) => { console.error("PC match: the 3D view failed to load — showing 2D", e); if (!dead) setStatus("off"); });
    kill.current = () => { dead = true; try { ev.current?.dispose(); } catch { /* already gone */ } ev.current = null; holder.remove(); };
  }, []);

  const attach = useCallback((wrap: HTMLDivElement, canvas: HTMLCanvasElement) => {
    box.current = { wrap, canvas };
    setBoxN((n) => n + 1);
    return () => { kill.current?.(); kill.current = null; box.current = null; };
  }, []);

  useEffect(() => {
    if (view === "3d" && !kill.current) build();
    ev.current?.setVisible(view === "3d");
  }, [view, boxN, build, status]);

  const errRun = useRef(0);
  const onFrame = useCallback((f: EngineFrame) => {
    store.onFrame(f);
    const v = ev.current;
    if (!v || viewRef.current !== "3d") return;
    try { v.frame(f); errRun.current = 0; } catch (e) {
      if (++errRun.current === 1) console.error("PC match: a 3D frame failed to draw", e);
      if (errRun.current >= 3) { v.setVisible(false); setStatus("off"); }
    }
  }, [store]);

  const obs = useMemo<EngineFrameObserver>(() => ({ hide2D: view === "3d" && status === "ready", attach, onFrame }), [view, status, attach, onFrame]);
  // The commentary's own small radar is left out: this page's radar is the one under test,
  // and the small one's dot can sit outside its own area (see ElevenRadar's tickSpot).
  const tap = useMemo(() => ({ onReading: (r: LiveRadarReading) => store.read(r), hideInline: true }), [store]);
  const served = useCallback((info: { kind: ScenarioKind | "dribble"; minute: number; scenario?: Scenario }) => store.served(info), [store]);
  const resolved = useCallback((r: ChanceResolved) => store.resolved(r), [store]);
  const complete = useCallback(() => onOver(), [onOver]);
  // The Play Area's dials (club, position, keeper, weather…), but a real
  // ninety minutes: the Play Area's own match length is Infinite Match's 10,000.
  const settings = useMemo(() => ({ ...loadPlaySettings(), matchMinutes: 90 }), []);

  return (
    <div className="pm-match" data-pc-view={view === "3d" ? status : "2d"}>
      {view === "3d" && status === "loading" && <div className="pm-muted pm-loading">Building the 3D view… the 2D match plays until it is ready.</div>}
      {view === "3d" && status === "off" && <div className="pm-muted pm-loading">3D can&apos;t run here — showing 2D.</div>}
      <MatchRadarLookOverride.Provider value="new">
        <LiveRadarTap.Provider value={tap}>
          <EngineFrameContext.Provider value={obs}>
            <EnginePlay settings={settings} seed={seed} onChanceServed={served} onChanceResolved={resolved} onComplete={complete} />
          </EngineFrameContext.Provider>
        </LiveRadarTap.Provider>
      </MatchRadarLookOverride.Provider>
    </div>
  );
});

/** The radar ("radar") or this match's list ("list"). Redraws on its own clock, never the match's. */
function RadarColumn({ store, over, onAgain, part, view3d = false }: {
  store: LiveStore; over: boolean; onAgain: () => void; part: "radar" | "list"; view3d?: boolean;
}) {
  const [, force] = useState(0);
  const seen = useRef(-1);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (store.version !== seen.current) { seen.current = store.version; force((n) => n + 1); }
    }, 33);
    return () => window.clearInterval(id);
  }, [store]);

  const r = store.reading;
  const ticks = ticksUpTo(r);
  // The clock comes back to a chance's minute once it has been played: don't flash YOUR CHANCE again.
  const lastTick = ticks[ticks.length - 1];
  if (lastTick?.yours && store.chances.some((c) => Math.floor(c.minute) === lastTick.minute && c.outcome)) {
    ticks[ticks.length - 1] = { ...lastTick, yours: false };
  }
  const chance = store.picture();
  const now = ticks[ticks.length - 1] ?? null;
  const usShort = r?.us.short ?? "You", themShort = r?.them.short ?? "Them";
  const minute = r ? Math.floor(r.minute) : 0;
  const dribbling = store.mode === "chance" && store.kind === "dribble";
  const status = chance
    ? `Live chance: ${kindName(chance.kind)}${chance.side === "them" ? " (theirs)" : ""} — every man on the match screen and the ball.`
    : dribbling
      ? "Live: a run at the defence. Its screen draws its own men, so the radar holds the last minute here."
      : now
      ? `${now.possession === "user" ? usShort : themShort} on the ball: ${describeArea(now.zone, now.lane)}.`
      : "Kick-off soon.";

  // This match, newest first: goals, shots and corners the unseen match plays, and every chance you were handed.
  type Row = { minute: number; who: "us" | "them" | "you"; text: string; key: string };
  const rows: Row[] = [];
  for (const t of ticks) {
    if (t.goal) rows.push({ minute: t.minute, who: t.goal === "user" ? "us" : "them", text: `Goal — ${t.goal === "user" ? usShort : themShort}`, key: `g${t.minute}` });
    else if (t.shot && !t.yours) rows.push({ minute: t.minute, who: t.shot === "user" ? "us" : "them", text: `Shot — ${t.shot === "user" ? usShort : themShort}`, key: `s${t.minute}` });
    if (t.corner) rows.push({ minute: t.minute, who: t.corner === "user" ? "us" : "them", text: `Corner — ${t.corner === "user" ? usShort : themShort}`, key: `c${t.minute}` });
  }
  store.chances.forEach((c, i) => {
    const out = c.outcome ? (c.outcome.startsWith("them:") ? `${outcomeWords(c.outcome.slice(5))} (theirs)` : outcomeWords(c.outcome)) : "playing…";
    rows.push({ minute: Math.floor(c.minute), who: c.side === "them" ? "them" : "you", text: `${c.side === "them" ? "Their" : "Your"} ${kindName(c.kind)} · ${out}`, key: `y${i}` });
  });
  rows.sort((a, b) => b.minute - a.minute);
  const yours = store.chances.filter((c) => c.side === "us");
  const goals = yours.filter((c) => c.outcome === "goal" || c.outcome === "rebound").length;

  if (part === "list") {
    return (
      <Panel title="This match" note={`${yours.length} chance${yours.length === 1 ? "" : "s"} for you`}>
        <div className="pm-feed" data-pc-feed>
          {rows.length === 0 && <div className="pm-muted">Nothing yet.</div>}
          {rows.slice(0, 14).map((row) => (
            <div key={row.key}>
              <b>{row.minute}&apos;</b>
              <span><i style={{ background: row.who === "them" ? THEM : row.who === "you" ? YOU_RING : US }} />{row.text}</span>
            </div>
          ))}
        </div>
      </Panel>
    );
  }
  return (
    <>
      {over && (
        <Panel title="Full time" note="the match's own scoreboard has the score">
          <div className="pm-muted">You were handed {yours.length} chance{yours.length === 1 ? "" : "s"} and scored {goals}.</div>
          <div><Btn main onClick={onAgain}>↻ Play another</Btn></div>
        </Panel>
      )}
      <Panel title="Radar" note={chance || dribbling ? `${minute}' · live chance` : r ? `${minute}'` : "waiting for kick-off"}>
        <div data-pc-radar-wrap>
          <ElevenRadar ticks={ticks} minute={r?.minute ?? 0} stepMs={r?.stepMs ?? 1000} chance={chance} usShort={usShort} themShort={themShort} />
        </div>
        <MomentumBar ticks={ticks} fullTime={r?.fullTime ?? 90} />
        <div className="pm-status" data-pc-status>{status}</div>
        <div className="pm-legend">
          <span style={{ ["--c" as string]: US }}>{usShort}</span>
          <span style={{ ["--c" as string]: THEM }}>{themShort}</span>
          <span style={{ ["--c" as string]: YOU_RING }}>You (ringed)</span>
          <span style={{ ["--c" as string]: "#ffffff" }}>Ball</span>
          {chance && <span className="pm-dash">{view3d ? "The 2D match's frame" : "What the match screen shows"}</span>}
        </div>
      </Panel>
    </>
  );
}
