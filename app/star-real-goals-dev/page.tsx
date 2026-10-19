"use client";

/**
 * REAL GOALS (test page) — Leo, 18-19 Oct 2026: "a real shots mode … u gotta
 * try get 100% accuracy from real irl goal … score hero system … I want ALL
 * the goals from wc22 and euros24 … wc18, euros21 … the most iconic goals …
 * revamp ui and look, looks way too much like a tester page".
 *
 * A game mode: 888 real goals in 8 collections (six tournaments played round
 * by round, Legends, Club worldies). Pick a goal, watch the real move (the real
 * men where StatsBomb's camera saw them, lib/star/realGoalTrack.ts), then the
 * shot is yours with the real goal's ball as a ghost. Score it like the real
 * one for 3 stars; 70%+ like it and nobody can stop it (Scenario.realLane).
 *
 * Every goal is played in the real match (EnginePlay, the one engine). The
 * real sides, names, kits, ghost and lane are test-only, off everywhere else.
 * Data: StatsBomb open data (https://github.com/statsbomb/open-data). Test
 * only: the licence for a paid game is not cleared, so none of this is in the game.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import EnginePlay from "@/components/star/EnginePlay";
import Match3DLayer from "@/components/star/Match3DLayer";
import type { ChanceResolved } from "@/components/star/CanvasMatch";
import { pitchFont } from "@/components/star/ui/pitchFont";
import { useMatchView3d, setMatchView3d } from "@/lib/star/matchView3d";
import type { Scenario } from "@/lib/star/canvasEngine";
import type { LeadIn } from "@/lib/star/leadIn";
import { DEFAULT_PLAY_SETTINGS, type PlaySettings } from "@/lib/star/playArea";
import { STATSBOMB_CREDIT, sbToPitch } from "@/lib/star/statsbombShots";
import {
  goalsOf, chaptersFor, chapterOpen, chapterNeeds, starsIn, recordResult, loadProgress, saveProgress, totalStars,
  accuracyPct, starsFor, realEnd, scenarioForGoal, viewForGoal, trackForGoal, scorerShort, concededBy, minuteOf, knownAs,
  difficultyTier, isTracked, FEATURED, STAR_TWO, STAR_THREE, LANE_PCT,
  type RealGoal, type RgCollection, type RgIndex, type Progress, type Chapter,
} from "@/lib/star/realGoals";
import { LOOK, lookOf, DISPLAY, Stars, Difficulty, KitDot, Dial, GoalMouth, code3, spotWords, RG_CSS } from "./_ui/look";

/** The striker you play as: an elite real scorer (Leo: "if im yamal'in it top bins"). Clear weather, no closing down. */
const SETTINGS: PlaySettings = {
  ...DEFAULT_PLAY_SETTINGS, power: 85, technique: 95, curve: true, weather: "clear", realKeeper: false, keeperStrength: 80, pressure: "off",
};

type Camera = "tv" | "behind" | "side";
const CAMERAS: { id: Camera; label: string; lock: { on: boolean; deg: number; tilt: number } }[] = [
  { id: "tv", label: "TV", lock: { on: false, deg: 0, tilt: 0 } },
  { id: "behind", label: "Behind", lock: { on: true, deg: 0, tilt: -25 } },
  { id: "side", label: "Side-on", lock: { on: true, deg: 75, tilt: -10 } },
];
const LOCK_KEY = "star-cam3d-lock";
const LAST_KEY = "star-real-goals-last";
const OPTS_KEY = "star-real-goals-opts";
const api = <T,>(q: string) => fetch(`/api/star/statsbomb-shots?${q}`).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`HTTP ${r.status}`))));

const label = (g: RealGoal) => g.x.label ?? FEATURED.find((f) => f.id === g.id)?.label ?? null;
const distM = (g: RealGoal) => { const p = sbToPitch(g.shot.loc); return Math.round(Math.hypot(p.x - 34, p.y)); };
function kindWord(g: RealGoal): string {
  const s = g.shot;
  if (s.type === "Penalty") return "Penalty";
  if (s.type === "Free Kick") return "Free kick";
  const t: Record<string, string> = { "Overhead Kick": "Overhead kick", Volley: "Volley", "Half Volley": "Half-volley", Lob: "Chip", Backheel: "Back-heel", "Diving Header": "Diving header" };
  if (t[s.technique]) return t[s.technique];
  if (s.body === "Head") return "Header";
  return distM(g) > 22 ? "From range" : "Finish";
}
function dateWords(d: string): string {
  const t = new Date(`${d}T12:00:00Z`);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
const roundOf = (g: RealGoal) => (g.col === "legends" || g.col === "worldies" ? g.x.comp : `${lookOf(g.col).title} · ${g.x.stage}`);

// ─────────────────────────────────────────────────────────────────────────
//  HOME
// ─────────────────────────────────────────────────────────────────────────

function Home({ index, progress, goalsByCol, last, onOpen, onSearch, onPlay }: {
  index: RgIndex; progress: Progress; goalsByCol: Record<string, RealGoal[]>; last: RealGoal | null;
  onOpen: (key: string) => void; onSearch: () => void; onPlay: (g: RealGoal) => void;
}) {
  const all = index.collections.reduce((a, c) => a + c.count, 0);
  return (
    <div className="rg-in px-4 pb-10 pt-5">
      <div className="flex items-end justify-between">
        <div>
          <div style={{ ...DISPLAY, fontSize: 46, lineHeight: 0.9, fontStyle: "italic" }}>
            <span style={{ color: "#4ade80" }}>REAL</span> GOALS
          </div>
          <div className="mt-1 text-[13px] font-bold text-white/90">{all} real goals. Score them like they really went in.</div>
        </div>
        <button onClick={onSearch} aria-label="Search every goal" className="rg-press grid h-11 w-11 place-items-center rounded-full bg-white/15 text-lg">🔎</button>
      </div>
      <div className="mt-3 flex items-center gap-2 border-y border-white/12 py-2">
        <Stars n={1} of={1} size={22} />
        <span style={{ ...DISPLAY, fontSize: 24 }}>{totalStars(progress)}</span>
        <span className="text-[13px] font-bold text-white/75">/ {all * 3} stars</span>
      </div>

      {last && (
        <button onClick={() => onPlay(last)} className="rg-press mt-3 flex w-full items-center gap-3 rounded-2xl border border-emerald-300/50 bg-emerald-400/10 p-3 text-left">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-400 text-xl text-black">▶</div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black uppercase tracking-wider text-emerald-300">Carry on</div>
            <div className="truncate text-[15px] font-black">{knownAs(last, last.shot.player)} v {concededBy(last)}</div>
            <div className="truncate text-[12px] font-bold text-white/80">{lookOf(last.col).title} · {minuteOf(last)}&apos;</div>
          </div>
          <Stars n={progress[last.id]?.stars ?? 0} size={14} />
        </button>
      )}

      <div className="mt-4 space-y-3">
        {index.collections.map((c) => {
          const lk = lookOf(c.key);
          const goals = goalsByCol[c.key];
          const got = goals ? starsIn(goals, progress) : 0;
          return (
            <button key={c.key} data-collection={c.key} onClick={() => onOpen(c.key)}
              className="rg-press relative block w-full overflow-hidden rounded-2xl text-left"
              style={{ background: `linear-gradient(120deg, ${lk.from} 0%, ${lk.from} 45%, ${lk.to} 140%)`, boxShadow: "0 6px 18px rgba(0,0,0,0.35)" }}>
              <div className="absolute -right-3 -top-4 select-none opacity-20" style={{ ...DISPLAY, fontSize: 88, color: lk.ink, fontStyle: "italic" }}>{lk.mark}</div>
              <div className="relative p-3.5">
                <div className="flex items-center gap-2">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-black tracking-wider text-black" style={{ background: lk.ink }}>{lk.mark}</span>
                  {c.tracked > c.count / 2 && <span className="rounded bg-black/35 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-emerald-300">REAL TRACKING</span>}
                </div>
                <div className="mt-1.5" style={{ ...DISPLAY, fontSize: 27, lineHeight: 1, color: "#fff" }}>{lk.title}</div>
                <div className="mt-0.5 text-[12px] font-bold" style={{ color: lk.ink }}>{lk.where} · {c.count} goals</div>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/40">
                    <div className="h-full rounded-full" style={{ width: `${(100 * got) / Math.max(1, c.count * 3)}%`, background: "#fcd34d" }} />
                  </div>
                  <span className="text-[12px] font-black"><span style={{ color: "#fcd34d" }}>★</span> {got}/{c.count * 3}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-6 text-center text-[11px] font-bold text-white/60">{STATSBOMB_CREDIT} · test page, not in the game</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  A COLLECTION — the level map
// ─────────────────────────────────────────────────────────────────────────

function LevelMap({ col, goals, progress, onBack, onPick }: {
  col: string; goals: RealGoal[]; progress: Progress; onBack: () => void; onPick: (g: RealGoal) => void;
}) {
  const lk = lookOf(col);
  const chs = useMemo(() => chaptersFor(goals), [goals]);
  const got = starsIn(goals, progress);
  // The first goal you have not starred, in an open chapter: glows.
  const nextId = useMemo(() => {
    for (const ch of chs) { if (!chapterOpen(chs, ch.n, progress)) break; const g = ch.goals.find((q) => !(progress[q.id]?.stars)); if (g) return g.id; }
    return null;
  }, [chs, progress]);
  useEffect(() => {
    if (!nextId) return;
    const t = setTimeout(() => document.querySelector(`[data-level="${nextId}"]`)?.scrollIntoView({ block: "center" }), 60);
    return () => clearTimeout(t);
  }, [nextId]);
  let n = 0;
  return (
    <div className="rg-in pb-16">
      <div className="sticky top-0 z-20 px-4 pb-3 pt-4" style={{ background: `linear-gradient(180deg, ${lk.from} 0%, ${lk.from}ee 70%, ${lk.from}00 100%)` }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} aria-label="Back" className="rg-press grid h-10 w-10 place-items-center rounded-full bg-black/30 text-xl">‹</button>
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ ...DISPLAY, fontSize: 26, lineHeight: 1 }}>{lk.title}</div>
            <div className="text-[12px] font-bold" style={{ color: lk.ink }}>{goals.length} goals · <span style={{ color: "#fcd34d" }}>★</span> {got}/{goals.length * 3}</div>
          </div>
        </div>
      </div>
      {chs.map((ch) => <ChapterPath key={ch.n} ch={ch} chs={chs} progress={progress} lk={lk} nextId={nextId} start={(n += ch.goals.length) - ch.goals.length} onPick={onPick} />)}
    </div>
  );
}

function ChapterPath({ ch, chs, progress, lk, nextId, start, onPick }: {
  ch: Chapter; chs: Chapter[]; progress: Progress; lk: { from: string; to: string; ink: string }; nextId: string | null; start: number; onPick: (g: RealGoal) => void;
}) {
  const open = chapterOpen(chs, ch.n, progress);
  const need = chapterNeeds(chs, ch.n, progress);
  const got = starsIn(ch.goals, progress);
  const COLS = [16, 50, 84, 50];
  const ROW = 104;
  return (
    <section className="mt-2 px-4" data-chapter={ch.n}>
      <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: open ? `linear-gradient(90deg, ${lk.to}cc, ${lk.from}cc)` : "rgba(255,255,255,0.08)" }}>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: open ? lk.ink : "rgba(255,255,255,0.75)" }}>Chapter {ch.n + 1}</div>
          <div style={{ ...DISPLAY, fontSize: 21, lineHeight: 1.05 }}>{ch.name}</div>
        </div>
        <div className="text-right text-[12px] font-black">
          {open ? <><span style={{ color: "#fcd34d" }}>★</span> {got}/{ch.goals.length * 3}</> : <span>🔒 Star {need} more in {chs[ch.n - 1]?.name}</span>}
        </div>
      </div>
      <div className="relative" style={{ height: ch.goals.length * ROW + 12 }}>
        <svg className="pointer-events-none absolute inset-0" width="100%" height="100%" preserveAspectRatio="none" viewBox={`0 0 100 ${ch.goals.length * ROW + 12}`}>
          <polyline fill="none" stroke={open ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)"} strokeWidth={0.9} strokeDasharray="2 2"
            points={ch.goals.map((_, i) => `${COLS[(start + i) % 4]},${i * ROW + 40}`).join(" ")} vectorEffect="non-scaling-stroke" />
        </svg>
        {ch.goals.map((g, i) => {
          const st = progress[g.id]?.stars ?? 0;
          const isNext = g.id === nextId;
          const x = COLS[(start + i) % 4];
          return (
            <button key={g.id} data-level={g.id} disabled={!open} onClick={() => onPick(g)}
              className="rg-press absolute flex -translate-x-1/2 flex-col items-center text-center disabled:opacity-40"
              style={{ left: `${x}%`, top: i * ROW + 12, width: 118 }}>
              <div className={`grid h-14 w-14 place-items-center rounded-full ${isNext ? "rg-next" : ""}`}
                style={{
                  background: st ? "radial-gradient(circle at 35% 30%, #fde68a, #f59e0b 70%)" : open ? `radial-gradient(circle at 35% 30%, ${lk.to}, ${lk.from})` : "#334155",
                  boxShadow: `0 0 0 3px ${isNext ? "#fcd34d" : "rgba(255,255,255,0.75)"}, 0 4px 10px rgba(0,0,0,0.45)`,
                }}>
                <span style={{ ...DISPLAY, fontSize: 22, color: st ? "#1c1917" : "#fff" }}>{open ? start + i + 1 : "🔒"}</span>
              </div>
              <div className="mt-0.5"><Stars n={st} size={13} /></div>
              <div className="flex max-w-full items-center gap-1 text-[12px] font-black leading-tight"><KitDot team={g.shot.team} size={10} /><span className="truncate">{scorerShort(g)}</span></div>
              <div className="max-w-full truncate text-[10px] font-bold text-white/80">v {code3(concededBy(g))} · {minuteOf(g)}&apos;</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  THE GOAL CARD (before you play it)
// ─────────────────────────────────────────────────────────────────────────

function GoalCard({ g, progress, opts, setOpts, onPlay, onClose }: {
  g: RealGoal; progress: Progress; opts: { buildUp: boolean; ghost: boolean }; setOpts: (o: { buildUp: boolean; ghost: boolean }) => void;
  onPlay: () => void; onClose: () => void;
}) {
  const lk = lookOf(g.col);
  const best = progress[g.id];
  const lab = label(g);
  const pen = g.shot.type === "Penalty";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 rg-in" onClick={onClose}>
      <div className="rg-up w-full max-w-[480px] overflow-hidden rounded-t-3xl" onClick={(e) => e.stopPropagation()}
        style={{ background: `linear-gradient(180deg, ${lk.from} 0%, #08110c 75%)`, boxShadow: "0 -10px 30px rgba(0,0,0,0.5)" }} data-goal-card={g.id}>
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/30" />
        <div className="px-5 pb-6 pt-3">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider" style={{ color: lk.ink }}>
            <span className="truncate">{roundOf(g)}</span><span className="shrink-0">{dateWords(g.x.date)}</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 rounded-2xl bg-black/35 px-3 py-2.5">
            <KitDot team={g.x.home} size={22} />
            <span style={{ ...DISPLAY, fontSize: 24 }}>{code3(g.x.home)}</span>
            <span className="rounded-md bg-white px-2 text-black" style={{ ...DISPLAY, fontSize: 26 }}>{g.x.score[0]}–{g.x.score[1]}</span>
            <span style={{ ...DISPLAY, fontSize: 24 }}>{code3(g.x.away)}</span>
            <KitDot team={g.x.away} size={22} />
            <span className="ml-1 rounded bg-emerald-400 px-1.5 text-[13px] font-black text-black">{minuteOf(g)}&apos;</span>
          </div>
          <div className="mt-4 text-[12px] font-black uppercase tracking-wider text-white/75">You are</div>
          <div style={{ ...DISPLAY, fontSize: 36, lineHeight: 1 }}>{knownAs(g, g.shot.player)}</div>
          <div className="mt-0.5 text-[13px] font-bold text-white/85">for {g.shot.team}</div>
          {lab && <div className="mt-2 border-l-4 pl-2 text-[14px] font-bold" style={{ borderColor: lk.to, color: lk.ink }}>{lab}</div>}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] font-black">
            <span className="rounded-full bg-white/15 px-2.5 py-1">{kindWord(g)}</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1">{distM(g)} m out</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1">xG {Math.max(1, Math.round(g.shot.xg * 100))}%</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">Hard <Difficulty tier={difficultyTier(g)} /></span>
            {isTracked(g) && <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-emerald-300">Real tracking</span>}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-black/30 px-3 py-2">
            <span className="text-[12px] font-bold text-white/85">★ goal · ★★ {STAR_TWO}% · ★★★ {STAR_THREE}%</span>
            <span className="flex items-center gap-2"><Stars n={best?.stars ?? 0} size={18} />{best?.best ? <span className="text-[12px] font-black">{best.best}%</span> : null}</span>
          </div>
          {!pen && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setOpts({ ...opts, buildUp: !opts.buildUp })} className={`rg-press rounded-xl py-2.5 text-[13px] font-black ${opts.buildUp ? "bg-white text-black" : "bg-white/10 text-white"}`}>▶ Build-up {opts.buildUp ? "on" : "off"}</button>
              <button onClick={() => setOpts({ ...opts, ghost: !opts.ghost })} className={`rg-press rounded-xl py-2.5 text-[13px] font-black ${opts.ghost ? "bg-white text-black" : "bg-white/10 text-white"}`}>👻 Ghost {opts.ghost ? "on" : "off"}</button>
            </div>
          )}
          <button data-play onClick={onPlay} className="rg-press mt-3 w-full rounded-2xl py-3.5 text-black" style={{ ...DISPLAY, fontSize: 28, background: "linear-gradient(180deg, #86efac, #22c55e)", boxShadow: "0 6px 0 #15803d" }}>PLAY</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  PLAYING A GOAL
// ─────────────────────────────────────────────────────────────────────────

interface Attempt { scored: boolean; pct: number; stars: number; you: { x: number; z: number } | null; outcome: string; best: boolean; lane: boolean }

function PlayGoal({ goal, opts, onClose, onResult, onNext, nextName }: {
  goal: RealGoal; opts: { buildUp: boolean; ghost: boolean };
  onClose: () => void; onResult: (stars: number, pct: number) => void; onNext?: () => void; nextName?: string;
}) {
  const [ghostOn, setGhostOn] = useState(opts.ghost);
  const [camera, setCamera] = useState<Camera>("tv");
  const [run, setRun] = useState(0);
  const [caption, setCaption] = useState<{ text: string; done: boolean }>({ text: "", done: false });
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [tries, setTries] = useState(0);
  const [buildUp, setBuildUp] = useState(opts.buildUp && goal.shot.type !== "Penalty");
  const real = useMemo(() => realEnd(goal), [goal]);
  const crossRef = useRef<{ x: number; z: number } | null>(null);
  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const bestRef = useRef(0);
  const lk = lookOf(goal.col);
  const view3d = useMatchView3d();

  // The camera choice is the 3D camera lock (this phone): set while this page plays, put back when it closes.
  useEffect(() => {
    let was: string | null = null;
    try { was = localStorage.getItem(LOCK_KEY); } catch { /* private */ }
    return () => { try { if (was === null) localStorage.removeItem(LOCK_KEY); else localStorage.setItem(LOCK_KEY, was); } catch { /* private */ } };
  }, []);
  const cycleCamera = () => {
    const nx = CAMERAS[(CAMERAS.findIndex((c) => c.id === camera) + 1) % CAMERAS.length];
    try { localStorage.setItem(LOCK_KEY, JSON.stringify(nx.lock)); } catch { /* private */ }
    setCamera(nx.id);
    setRun((r) => r + 1);
  };

  const view = useMemo(() => viewForGoal(goal, ghostOn), [goal, ghostOn]);
  const openOn = useMemo(() => () => scenarioForGoal(goal), [goal]);
  const leadIn = useCallback((sc: Scenario): LeadIn | null => {
    const track = trackForGoal(goal, sc);
    if (!track) return null;
    let last = "";
    return {
      ...track,
      onTick: (t, done) => {
        const text = track.captionAt?.(t) ?? "";
        if (done || text !== last) { last = text; setCaption({ text, done }); }
      },
    };
  }, [goal]);

  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    const p = prevRef.current;
    if (!crossRef.current && p && p.y > 0 && b.y <= 0) {
      const f = p.y / (p.y - b.y || 1);
      crossRef.current = { x: p.x + (b.x - p.x) * f, z: p.z + (b.z - p.z) * f };
    }
    prevRef.current = b;
  }, []);
  const onServed = useCallback(() => { crossRef.current = null; prevRef.current = null; }, []);
  const onResolved = useCallback((r: ChanceResolved) => {
    const scored = (r.outcome === "goal" || r.outcome === "rebound") && r.youShot;
    const you = crossRef.current;
    const pct = r.youShot ? accuracyPct(real, you) : 0;
    const stars = starsFor(scored, pct);
    const best = stars > 0 && pct > bestRef.current;
    if (best) bestRef.current = pct;
    setAttempt({ scored, pct, stars, you, outcome: r.outcome, best, lane: scored && pct >= LANE_PCT });
    setTries((n) => n + 1);
    onResult(stars, pct);
    crossRef.current = null; prevRef.current = null;
  }, [real, onResult]);

  const s = goal.shot, x = goal.x;
  const missWord = (o: string) => (o === "saved" || o === "caught" ? "SAVED" : o === "blocked" || o === "tackled" ? "BLOCKED" : o === "post" ? "OFF THE POST" : o === "over" ? "OVER THE BAR" : o === "wide" ? "WIDE" : "NO GOAL");

  return (
    <div data-playing={goal.id} className="fixed inset-0 z-30 flex flex-col bg-[#050b07]">
      {/* The scoreboard */}
      <div className="shrink-0 px-3 pb-1.5 pt-2.5" style={{ background: `linear-gradient(180deg, ${lk.from}, #050b07)` }}>
        <div className="flex items-center gap-2">
          <button onClick={onClose} aria-label="Back to the map" className="rg-press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/35 text-lg">✕</button>
          <div data-real-score className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-black/45 px-2 py-1">
            <span className="rounded px-1 text-[10px] font-black text-black" style={{ background: lk.ink }}>{lk.mark}</span>
            <KitDot team={x.home} size={14} />
            <span style={{ ...DISPLAY, fontSize: 18 }}>{code3(x.home)}</span>
            <span className="rounded bg-white px-1.5 text-black" style={{ ...DISPLAY, fontSize: 18 }}>{x.score[0]}–{x.score[1]}</span>
            <span style={{ ...DISPLAY, fontSize: 18 }}>{code3(x.away)}</span>
            <KitDot team={x.away} size={14} />
            <span className="ml-1 text-[12px] font-black text-emerald-300">{minuteOf(goal)}&apos;</span>
          </div>
          <div className="w-9 shrink-0 text-right"><Stars n={bestRef.current ? 1 : 0} of={1} size={16} /></div>
        </div>
        <div data-caption className="mt-1 truncate text-center text-[14px] font-black" style={{ color: caption.done || !buildUp ? "#fcd34d" : "#86efac" }}>
          {!buildUp || caption.done ? `${scorerShort(goal)}: your shot — follow the ghost` : caption.text || "The move…"}
        </div>
      </div>

      {/* The match */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <Match3DLayer key={`${goal.id}-${run}`}>
          <EnginePlay
            bare
            seed={7}
            settings={SETTINGS}
            openOn={openOn}
            leadIn={buildUp ? leadIn : undefined}
            scene={{ ownFrame: true }}
            realGoal={view}
            onBallStep={onBallStep}
            onChanceServed={onServed}
            onChanceResolved={onResolved}
          />
        </Match3DLayer>

        {attempt && (
          <div data-result className="rg-in fixed inset-0 z-40 flex items-end justify-center bg-black/55">
            <div className="rg-up w-full max-w-[480px] rounded-t-3xl px-5 pb-6 pt-4" style={{ background: `linear-gradient(180deg, ${attempt.scored ? "#14532d" : "#4c0519"} 0%, #07110b 70%)` }}>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ ...DISPLAY, fontSize: 40, lineHeight: 1, color: attempt.scored ? "#86efac" : "#fda4af" }}>{attempt.scored ? "GOAL!" : missWord(attempt.outcome)}</div>
                  <div className="mt-1"><Stars n={attempt.stars} size={34} pop /></div>
                  {attempt.best && <div className="mt-1 text-[12px] font-black text-yellow-300">New best</div>}
                </div>
                <Dial pct={attempt.pct} scored={attempt.scored} />
              </div>
              <div className="mt-3 overflow-hidden rounded-xl bg-black/25"><GoalMouth real={real} you={attempt.you} /></div>
              <div className="mt-2 text-[13px] font-bold">
                <span className="text-yellow-300">Real:</span> {spotWords(real.x, real.z)}
                <span className="text-white/40"> · </span>
                <span className="text-sky-300">You:</span> {attempt.you ? `${Math.round(Math.hypot(attempt.you.x - real.x, attempt.you.z - real.z) * 100)} cm off` : "never reached the line"}
              </div>
              {attempt.lane && <div className="mt-1 text-[12px] font-black text-emerald-300">On the real line ({LANE_PCT}%+): nobody could stop it.</div>}
              {!attempt.scored && attempt.you && attempt.pct < LANE_PCT && <div className="mt-1 text-[12px] font-bold text-white/80">Get it {LANE_PCT}%+ like the real one and nobody can stop it.</div>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setAttempt(null)} className="rg-press rounded-2xl bg-white/15 py-3 text-[15px] font-black">↺ Again</button>
                {onNext && attempt.stars > 0
                  ? <button onClick={onNext} className="rg-press rounded-2xl py-3 text-[15px] font-black text-black" style={{ background: "linear-gradient(180deg, #86efac, #22c55e)" }}>Next{nextName ? `: ${nextName}` : ""} ›</button>
                  : <button onClick={onClose} className="rg-press rounded-2xl bg-white/15 py-3 text-[15px] font-black">Map</button>}
              </div>
              <div className="mt-2 text-center text-[11px] font-bold text-white/65">Try {tries} · Again serves the same chance</div>
            </div>
          </div>
        )}
      </div>

      {/* The controls */}
      <div className="flex shrink-0 items-center justify-around border-t border-white/10 bg-black/60 px-2 py-2 text-[12px] font-black">
        <button data-ghost-toggle onClick={() => setGhostOn((v) => !v)} className={`rg-press rounded-full px-3 py-1.5 ${ghostOn ? "bg-sky-400 text-black" : "bg-white/10"}`}>👻 Ghost</button>
        {s.type !== "Penalty" && <button onClick={() => { setBuildUp((v) => !v); setRun((r) => r + 1); setCaption({ text: "", done: false }); }} className={`rg-press rounded-full px-3 py-1.5 ${buildUp ? "bg-white text-black" : "bg-white/10"}`}>▶ Build-up</button>}
        <button onClick={() => { setMatchView3d(view3d === "on" ? "off" : "on"); setRun((r) => r + 1); }} className={`rg-press rounded-full px-3 py-1.5 ${view3d === "on" ? "bg-white text-black" : "bg-white/10"}`}>{view3d === "on" ? "3D" : "2D"}</button>
        {view3d === "on" && <button onClick={cycleCamera} className="rg-press rounded-full bg-white/10 px-3 py-1.5">🎥 {CAMERAS.find((c) => c.id === camera)!.label}</button>}
        <button onClick={() => { setRun((r) => r + 1); setCaption({ text: "", done: false }); setAttempt(null); }} className="rg-press rounded-full bg-white/10 px-3 py-1.5">⟲ Restart</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────────────────────────────────

function Search({ goals, progress, onBack, onPick }: { goals: RealGoal[]; progress: Progress; onBack: () => void; onPick: (g: RealGoal) => void }) {
  const [q, setQ] = useState("");
  const [col, setCol] = useState<string | null>(null);
  const [shown, setShown] = useState(30);
  const fl = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const list = useMemo(() => {
    const t = fl(q.trim());
    return goals.filter((g) => (!col || g.col === col) && (!t || [g.shot.player, knownAs(g, g.shot.player), g.shot.team, concededBy(g), g.x.comp, label(g) ?? ""].some((s) => fl(s).includes(t))));
  }, [goals, q, col]);
  useEffect(() => setShown(30), [q, col]);
  return (
    <div className="rg-in px-4 pb-12 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="rg-press grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl">‹</button>
        <div style={{ ...DISPLAY, fontSize: 28 }}>Every goal</div>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Player, team or match (Mbappé, Bale, Güler…)" data-search autoFocus
        className="mt-3 w-full rounded-2xl bg-white/10 px-4 py-3 text-[16px] font-bold text-white outline-none placeholder:text-white/55 focus:bg-white/15" />
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setCol(null)} className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-black ${!col ? "bg-white text-black" : "bg-white/10"}`}>All</button>
        {Object.keys(LOOK).map((k) => <button key={k} onClick={() => setCol(k)} className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-black ${col === k ? "bg-white text-black" : "bg-white/10"}`}>{LOOK[k].title}</button>)}
      </div>
      <div className="mt-2 text-[12px] font-bold text-white/75">{list.length} {list.length === 1 ? "goal" : "goals"}</div>
      <div className="mt-1 divide-y divide-white/10">
        {list.slice(0, shown).map((g) => (
          <button key={g.id} data-goal={g.id} onClick={() => onPick(g)} className="rg-press flex w-full items-center gap-3 py-2.5 text-left">
            <KitDot team={g.shot.team} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-black">{knownAs(g, g.shot.player)} <span className="text-white/70">v {concededBy(g)}</span></div>
              <div className="truncate text-[12px] font-bold text-white/80">{label(g) ?? `${lookOf(g.col).title} · ${kindWord(g)} · ${minuteOf(g)}'`}</div>
            </div>
            <div className="shrink-0 text-right"><Stars n={progress[g.id]?.stars ?? 0} size={12} /><div className="mt-0.5"><Difficulty tier={difficultyTier(g)} size={5} /></div></div>
          </button>
        ))}
      </div>
      {shown < list.length && <button onClick={() => setShown((n) => n + 30)} className="rg-press mt-2 w-full rounded-xl bg-white/10 py-2.5 text-[13px] font-black">More</button>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  THE PAGE
// ─────────────────────────────────────────────────────────────────────────

type Screen = { at: "home" } | { at: "col"; key: string } | { at: "search" };

export default function RealGoalsDev() {
  const [index, setIndex] = useState<RgIndex | null>(null);
  const [byCol, setByCol] = useState<Record<string, RealGoal[]>>({});
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<Progress>({});
  const [screen, setScreen] = useState<Screen>({ at: "home" });
  const [card, setCard] = useState<RealGoal | null>(null);
  const [playing, setPlaying] = useState<RealGoal | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [opts, setOptsState] = useState({ buildUp: true, ghost: true });

  const setOpts = (o: { buildUp: boolean; ghost: boolean }) => { setOptsState(o); try { localStorage.setItem(OPTS_KEY, JSON.stringify(o)); } catch { /* private */ } };

  useEffect(() => {
    setProgress(loadProgress());
    try {
      setLastId(localStorage.getItem(LAST_KEY));
      const o = JSON.parse(localStorage.getItem(OPTS_KEY) ?? "null");
      if (o && typeof o.buildUp === "boolean") setOptsState({ buildUp: o.buildUp, ghost: o.ghost !== false });
    } catch { /* private */ }
    api<RgIndex>("rg=index").then((idx) => {
      setIndex(idx);
      // Every collection, a few at a time (the biggest is under 1 MB).
      for (const c of idx.collections) api<RgCollection>(`rg=${c.key}`).then((f) => setByCol((m) => ({ ...m, [c.key]: goalsOf(f) }))).catch((e) => setError(String(e)));
    }).catch((e) => setError(String(e)));
  }, []);

  const allGoals = useMemo(() => (index ? index.collections.flatMap((c) => byCol[c.key] ?? []) : []), [index, byCol]);
  const last = useMemo(() => allGoals.find((g) => g.id === lastId) ?? null, [allGoals, lastId]);

  // ?play=<id> opens a goal straight away (for checking one by eye); ?col=<key> opens a collection.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("play");
    const g = id ? allGoals.find((x) => x.id === id) : null;
    if (g && !playing) { setPlaying(g); }
    const col = q.get("col");
    if (col && byCol[col] && screen.at === "home") setScreen({ at: "col", key: col });
  }, [allGoals]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = (g: RealGoal) => {
    setCard(null); setPlaying(g); setLastId(g.id);
    try { localStorage.setItem(LAST_KEY, g.id); } catch { /* private */ }
  };
  const onResult = useCallback((stars: number, pct: number) => {
    if (!playing) return;
    setProgress((p) => { const n = recordResult(p, playing.id, stars, pct); saveProgress(n); return n; });
  }, [playing]);

  // The next goal: the next one in its collection's own order, if its chapter is open.
  const next = useMemo(() => {
    if (!playing) return null;
    const chs = chaptersFor(byCol[playing.col] ?? []);
    const flat = chs.flatMap((c) => c.goals.map((g) => ({ g, ch: c.n })));
    const i = flat.findIndex((q) => q.g.id === playing.id);
    const nx = i >= 0 ? flat[i + 1] : undefined;
    return nx && chapterOpen(chs, nx.ch, progress) ? nx.g : null;
  }, [playing, byCol, progress]);

  return (
    <div className={`${pitchFont.variable} fixed inset-0 z-[60] overflow-y-auto text-white`} style={{ background: "radial-gradient(120% 60% at 50% 0%, #0f2a1a 0%, #050b07 60%)" }}>
      <style>{RG_CSS}</style>
      <PageGuide page="/star-real-goals-dev" />
      <div className="mx-auto max-w-[480px]">
        {error && <div className="m-4 rounded-xl bg-red-900/70 p-3 text-sm font-bold">Could not load the goals: {error}</div>}
        {!index && !error && <div className="grid h-[70vh] place-items-center" style={{ ...DISPLAY, fontSize: 26 }}>Loading the goals…</div>}
        {index && screen.at === "home" && (
          <Home index={index} progress={progress} goalsByCol={byCol} last={last}
            onOpen={(key) => { setScreen({ at: "col", key }); window.scrollTo({ top: 0 }); }}
            onSearch={() => setScreen({ at: "search" })} onPlay={(g) => setCard(g)} />
        )}
        {index && screen.at === "col" && (
          byCol[screen.key]
            ? <LevelMap col={screen.key} goals={byCol[screen.key]} progress={progress} onBack={() => setScreen({ at: "home" })} onPick={setCard} />
            : <div className="grid h-[70vh] place-items-center" style={{ ...DISPLAY, fontSize: 24 }}>Loading {lookOf(screen.key).title}…</div>
        )}
        {index && screen.at === "search" && <Search goals={allGoals} progress={progress} onBack={() => setScreen({ at: "home" })} onPick={setCard} />}
      </div>
      {card && <GoalCard g={card} progress={progress} opts={opts} setOpts={setOpts} onPlay={() => play(card)} onClose={() => setCard(null)} />}
      {playing && (
        <PlayGoal key={playing.id} goal={playing} opts={opts}
          onClose={() => { setScreen({ at: "col", key: playing.col }); setPlaying(null); }}
          onResult={onResult}
          onNext={next ? () => play(next) : undefined} nextName={next ? scorerShort(next) : undefined} />
      )}
    </div>
  );
}
