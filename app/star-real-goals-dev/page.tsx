"use client";

/**
 * REAL GOALS (test page) — Leo, 18 Oct 2026: "we should one HUNDRED percent
 * have a real shots mode … u gotta try get 100% accuracy from real irl goal …
 * maybe like score hero system of going up the levels getting harder and
 * stars". His dad: "ghost thing like mariokart where u see the real goal".
 *
 * A level map of real World Cup 2018 / Euro 2016 goals (5 stages × 10, easiest
 * first, stars unlock the next), and a search of all 232. Each goal is played
 * in the real match (EnginePlay, the one engine): the real move replayed first,
 * then the shot is yours, with the real goal's ball as a ghost. Score it, and
 * the closer it crosses the line to where the real one did, the more stars.
 *
 * The real sides, names and kits (CanvasMatch's `realGoal`), and the real lane
 * (Scenario.realLane: a strike on the real line is not blocked or saved, as the
 * real one was not) are test-only, off everywhere else.
 *
 * Data (Harry, 19 Oct 2026: rebuilt on free-licensed data): the Wyscout public
 * dataset, CC BY 4.0 — the scorer, minute, sides, score, where it was struck,
 * where it went in and the real passes before it. Wyscout has nobody's
 * position off the ball, so the defenders and keeper are placed by the game's
 * own rules (lib/star/realMoments, "placed"). Credit: REAL_CREDIT.wyscout.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./real-goals.css";
import EnginePlay from "@/components/star/EnginePlay";
import Match3DLayer from "@/components/star/Match3DLayer";
import type { ChanceResolved } from "@/components/star/CanvasMatch";
import type { Scenario } from "@/lib/star/canvasEngine";
import type { LeadIn } from "@/lib/star/leadIn";
import { DEFAULT_PLAY_SETTINGS, type PlaySettings } from "@/lib/star/playArea";
import { CX, POST_L, POST_R } from "@/lib/star/pitch";
import { REAL_CREDIT, PICTURE_WORDS, leadinTrack, fetchRealFile, type WyscoutShotFile } from "@/lib/star/realMoments";
import {
  joinGoals, buildLevels, levelOpen, totalStars, recordResult, loadProgress, saveProgress,
  accuracyPct, starsFor, realEnd, scenarioForGoal, viewForGoal, realMoveLeadin, moveWindow, realBallKeys,
  scorerShort, concededBy, minuteOf, knownAs, sideKits, stageOf, isTournament, LEAGUES, FEATURED, STAR_TWO, STAR_THREE,
  type RealGoal, type RgFile, type Progress, type Stage, type Level,
} from "@/lib/star/realGoals";

/** The striker you play as: an elite real scorer (Leo: "if im yamal'in it top bins"). Clear weather, no closing down. */
const SETTINGS: PlaySettings = {
  ...DEFAULT_PLAY_SETTINGS, power: 85, technique: 95, curve: true, weather: "clear", realKeeper: false, keeperStrength: 80, pressure: "off",
};

type Camera = "tv" | "behind" | "side";
const CAMERAS: { id: Camera; label: string; lock: { on: boolean; deg: number; tilt: number } }[] = [
  { id: "tv", label: "TV", lock: { on: false, deg: 0, tilt: 0 } },
  { id: "behind", label: "Behind him", lock: { on: true, deg: 0, tilt: -25 } },
  { id: "side", label: "Side-on", lock: { on: true, deg: 75, tilt: -10 } },
];
const LOCK_KEY = "star-cam3d-lock";

const STAR = (n: number, of = 3, size = 16) => (
  <span style={{ fontSize: size, letterSpacing: 1 }}>
    {Array.from({ length: of }, (_, i) => <span key={i} style={{ color: i < n ? "#facc15" : "rgba(255,255,255,0.25)" }}>★</span>)}
  </span>
);

/** "top left corner" — as you look at the goal. */
function spotWords(x: number, z: number): string {
  const across = x < CX - 1.2 ? "left" : x > CX + 1.2 ? "right" : "middle";
  const up = z < 0.7 ? "low" : z > 1.6 ? "top" : "mid-height";
  if (across === "middle") return up === "low" ? "low, down the middle" : up === "top" ? "high, down the middle" : "down the middle";
  return up === "top" ? `top ${across} corner` : up === "low" ? `bottom ${across} corner` : `${across} side, ${up}`;
}

function Swatch({ team, size = 14 }: { team: string; size?: number }) {
  const k = sideKits(team).home;
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: 4, background: k?.shirt ?? "#64748b", border: `2px solid ${k?.trim ?? "#fff"}`, verticalAlign: "-2px" }} />;
}

/** The goal mouth, from the front: where the real one went (green) and yours (blue). */
function GoalMouth({ real, you }: { real: { x: number; z: number }; you: { x: number; z: number } | null }) {
  const W = 320, pad = 18, s = (W - 2 * pad) / (POST_R - POST_L + 1.6), H = 2.44 * s + pad + 30;
  const px = (x: number) => pad + (x - (POST_L - 0.8)) * s;
  const py = (z: number) => H - 30 - z * s;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", background: "#14532d", borderRadius: 10 }}>
      <rect x={px(POST_L)} y={py(2.44)} width={(POST_R - POST_L) * s} height={2.44 * s} fill="rgba(255,255,255,0.08)" stroke="#fff" strokeWidth={3} />
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1={px(POST_L + (i + 1) * 0.56)} y1={py(2.44)} x2={px(POST_L + (i + 1) * 0.56)} y2={py(0)} stroke="rgba(255,255,255,0.12)" />)}
      <line x1={0} y1={py(0)} x2={W} y2={py(0)} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
      {you && <line x1={px(real.x)} y1={py(real.z)} x2={px(you.x)} y2={py(Math.max(0, you.z))} stroke="#fff" strokeDasharray="4 3" strokeWidth={1.5} />}
      <circle cx={px(real.x)} cy={py(real.z)} r={9} fill="#22c55e" stroke="#052e16" strokeWidth={2} />
      <text x={px(real.x)} y={py(real.z) - 13} fill="#bbf7d0" fontSize={12} fontWeight={900} textAnchor="middle">REAL</text>
      {you && <>
        <circle cx={px(you.x)} cy={py(Math.max(0, you.z))} r={9} fill="#38bdf8" stroke="#082f49" strokeWidth={2} />
        <text x={px(you.x) + (Math.abs(you.x - real.x) < 0.5 && Math.abs(you.z - real.z) < 0.5 ? 26 : 0)} y={py(Math.max(0, you.z)) + 22} fill="#e0f2fe" fontSize={12} fontWeight={900} textAnchor="middle">YOU</text>
      </>}
    </svg>
  );
}

interface Attempt { scored: boolean; pct: number; stars: number; you: { x: number; z: number } | null; outcome: string; best: boolean }

function PlayGoal({ goal, level, onClose, onResult, onNext }: {
  goal: RealGoal; level: Level | null;
  onClose: () => void; onResult: (stars: number, pct: number) => void; onNext?: () => void;
}) {
  const [ghostOn, setGhostOn] = useState(true);
  const [buildUp, setBuildUp] = useState(true);
  const [camera, setCamera] = useState<Camera>("tv");
  const [run, setRun] = useState(0);
  const [caption, setCaption] = useState<{ text: string; done: boolean }>({ text: "", done: false });
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [tries, setTries] = useState(0);
  const real = useMemo(() => realEnd(goal), [goal]);
  const crossRef = useRef<{ x: number; z: number } | null>(null);
  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const bestRef = useRef(0);

  // The camera choice is the 3D camera lock (Settings-free, this phone): set
  // while this page plays, and put back as it was when it closes.
  useEffect(() => {
    let was: string | null = null;
    try { was = localStorage.getItem(LOCK_KEY); } catch { /* private */ }
    return () => { try { if (was === null) localStorage.removeItem(LOCK_KEY); else localStorage.setItem(LOCK_KEY, was); } catch { /* private */ } };
  }, []);
  const pickCamera = (c: Camera) => {
    try { localStorage.setItem(LOCK_KEY, JSON.stringify(CAMERAS.find((q) => q.id === c)!.lock)); } catch { /* private */ }
    setCamera(c);
    setRun((r) => r + 1);
  };

  const view = useMemo(() => viewForGoal(goal, ghostOn), [goal, ghostOn]);
  const openOn = useMemo(() => () => scenarioForGoal(goal), [goal]);
  const realLead = useMemo(() => realMoveLeadin(goal), [goal]);
  const win = useMemo(() => moveWindow(goal), [goal]);
  const leadIn = useCallback((sc: Scenario): LeadIn | null => {
    if (!realLead) return null;
    const track = leadinTrack(goal.shot, realLead, sc, { ballKeys: (end) => realBallKeys(goal, win, end) });
    let last = "";
    return {
      ...track,
      onTick: (t, done) => {
        const text = track.captionAt?.(t) ?? "";
        if (done || text !== last) { last = text; setCaption({ text, done }); }
      },
    };
  }, [goal, realLead, win]);

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
    setAttempt({ scored, pct, stars, you, outcome: r.outcome, best });
    setTries((n) => n + 1);
    onResult(stars, pct);
    crossRef.current = null; prevRef.current = null;
  }, [real, onResult]);

  const s = goal.shot, x = goal.x;
  const featured = FEATURED.find((f) => f.id === goal.id);
  const passers = Array.from(new Set(win.filter((e) => e[1] === "P").map((e) => knownAs(goal, e[4])))).slice(-4);

  return (
    <div data-playing={goal.id} className="mb-4 rounded-2xl border border-emerald-400/40 bg-[#0f1a2e]">
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
            {level ? `Level ${level.n + 1} · ${x.comp}` : x.comp} · {stageOf(goal)}
          </div>
          <div data-real-score className="mt-0.5 text-base font-black leading-tight">
            <Swatch team={x.home} /> {x.home} {x.score[0]}–{x.score[1]} {x.away} <Swatch team={x.away} /> <span className="text-emerald-300">· {minuteOf(goal)}&apos;</span>
          </div>
          <div className="mt-0.5 text-sm font-bold">
            You are <b className="text-yellow-300">{knownAs(goal, s.player)}</b> ({s.team}) · {s.body} · xG {Math.round(s.xg * 100)}%
          </div>
          {featured && <div className="text-xs font-bold text-sky-300">{featured.label}</div>}
        </div>
        <button onClick={onClose} className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-black">✕</button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pt-2">
        <button data-ghost-toggle onClick={() => setGhostOn((v) => !v)} className={`rounded-full px-3 py-1 text-xs font-black ${ghostOn ? "bg-sky-400 text-black" : "bg-white/10"}`}>👻 Ghost {ghostOn ? "on" : "off"}</button>
        <button onClick={() => { setBuildUp((v) => !v); setRun((r) => r + 1); setCaption({ text: "", done: false }); }} className={`rounded-full px-3 py-1 text-xs font-black ${buildUp ? "bg-emerald-400 text-black" : "bg-white/10"}`}>▶ Build-up {buildUp ? "on" : "off"}</button>
        {CAMERAS.map((c) => (
          <button key={c.id} onClick={() => pickCamera(c.id)} className={`rounded-full px-3 py-1 text-xs font-black ${camera === c.id ? "bg-white text-black" : "bg-white/10"}`}>🎥 {c.label}</button>
        ))}
      </div>
      <div className="px-3 pt-1 text-[11px] font-bold text-white/80">Cameras turn the 3D view (3D | 2D in the match bar).</div>

      {buildUp && realLead && (
        <div data-caption className="px-3 pt-2 text-sm font-black text-emerald-300">
          {caption.done ? "Your turn — follow the ghost into the net" : caption.text || `The move: ${passers.join(" → ")}`}
        </div>
      )}

      <div className="pt-2">
        <Match3DLayer key={`${goal.id}-${run}`}>
          <EnginePlay
            seed={7}
            settings={SETTINGS}
            openOn={openOn}
            leadIn={buildUp && realLead ? leadIn : undefined}
            scene={{ ownFrame: true }}
            realGoal={view}
            onBallStep={onBallStep}
            onChanceServed={onServed}
            onChanceResolved={onResolved}
          />
        </Match3DLayer>
      </div>

      {attempt && (
        <div data-result className="m-3 rounded-xl border border-white/15 bg-black/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm font-black uppercase ${attempt.scored ? "text-emerald-300" : "text-red-300"}`}>
                {attempt.scored ? "Goal!" : attempt.outcome === "saved" || attempt.outcome === "caught" ? "Saved" : attempt.outcome === "blocked" ? "Blocked" : "No goal"}
                {attempt.best && " · new best"}
              </div>
              <div data-accuracy className="text-5xl font-black leading-none tabular-nums">{Math.round(attempt.pct)}%</div>
              <div className="text-xs font-bold text-white/80">like the real goal</div>
            </div>
            <div className="text-right">
              {STAR(attempt.stars, 3, 30)}
              <div className="text-[11px] font-bold text-white/80">★ goal · ★★ {STAR_TWO}% · ★★★ {STAR_THREE}%</div>
            </div>
          </div>
          <div className="mt-2"><GoalMouth real={real} you={attempt.you} /></div>
          <div className="mt-2 text-sm font-bold">
            <span className="text-emerald-300">Real:</span> {spotWords(real.x, real.z)} ({real.z.toFixed(1)} m up)
            <span className="text-white/50"> | </span>
            <span className="text-sky-300">You:</span> {attempt.you ? `${spotWords(attempt.you.x, attempt.you.z)} (${Math.hypot(attempt.you.x - real.x, attempt.you.z - real.z).toFixed(2)} m off)` : "never reached the line"}
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setAttempt(null)} className="flex-1 rounded-lg bg-white/15 py-2 text-sm font-black">↺ Again</button>
            {onNext && attempt.stars > 0 && <button onClick={onNext} className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-black text-black">Next level →</button>}
          </div>
          <div className="mt-1 text-[11px] font-bold text-white/70">Try {tries}. The pitch serves the same chance again — just shoot.</div>
        </div>
      )}
    </div>
  );
}

/** A small goal mouth with the real goal's spot: the card's picture (drawn from the real data). */
function MiniMouth({ goal }: { goal: RealGoal }) {
  const e = realEnd(goal);
  const W = 160, H = 74, l = 14, r = W - 14, top = 16, line = H - 10;
  const s = (r - l) / (POST_R - POST_L);
  const x = Math.max(l - 6, Math.min(r + 6, l + (e.x - POST_L) * s));
  const y = Math.max(top - 6, line - e.z * ((line - top) / 2.44));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rg-mouth" aria-hidden>
      <rect x={l} y={top} width={r - l} height={line - top} fill="rgba(255,255,255,0.07)" stroke="#fff" strokeWidth={2.5} />
      {Array.from({ length: 7 }, (_, i) => <line key={i} x1={l + ((i + 1) * (r - l)) / 8} y1={top} x2={l + ((i + 1) * (r - l)) / 8} y2={line} stroke="rgba(255,255,255,0.13)" />)}
      <line x1={0} y1={line} x2={W} y2={line} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      <circle cx={x} cy={y} r={6} fill="#22c55e" stroke="#052e16" strokeWidth={2} />
    </svg>
  );
}

/** One goal as a card: tag, picture of where it went in, scorer, stars, ▶. */
function GoalCard({ goal, tag, open, stars, sub, onClick, data }: {
  goal: RealGoal; tag: string; open: boolean; stars: number; sub: string; onClick: () => void;
  data: Record<string, string | number>;
}) {
  return (
    <button {...data} disabled={!open} onClick={onClick} className="rg-card" data-open={open ? "true" : "false"}>
      <span className="rg-tag">{open ? tag : "🔒"}</span>
      <MiniMouth goal={goal} />
      <span className="rg-cname"><Swatch team={goal.shot.team} size={10} /> {scorerShort(goal)} <i>{minuteOf(goal)}&apos;</i></span>
      <span className="rg-csub">{sub}</span>
      <span className="rg-cfoot">{STAR(stars, 3, 13)}{open && <span className="rg-play" aria-hidden>▶</span>}</span>
    </button>
  );
}

/** A stage as a TV rail: a row of level cards, scrolled sideways with ‹ ›. */
function StageRail({ st, stages, progress, onPick }: { st: Stage; stages: Stage[]; progress: Progress; onPick: (lv: Level) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const open = totalStars(progress) >= st.gate;
  const got = st.levels.reduce((a, l) => a + (progress[l.goal.id]?.stars ?? 0), 0);
  const nudge = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="rg-rail" data-stage={st.n} data-open={open ? "true" : "false"}>
      <div className="rg-rh">
        <h2><span>Stage {st.n + 1}</span> {st.name}</h2>
        <div className="rg-rstat">{open ? <>{STAR(1, 1, 15)} {got}/{st.levels.length * 3}</> : <>🔒 {st.gate} ★ to open</>}</div>
        <div className="rg-arrows">
          <button onClick={() => nudge(-1)} aria-label="Scroll back">‹</button>
          <button onClick={() => nudge(1)} aria-label="Scroll on">›</button>
        </div>
      </div>
      <div className="rg-row" ref={ref}>
        {st.levels.map((lv) => (
          <GoalCard key={lv.n} goal={lv.goal} tag={`Level ${lv.n + 1}`} open={levelOpen(stages, progress, lv)}
            stars={progress[lv.goal.id]?.stars ?? 0} sub={`v ${concededBy(lv.goal)}`} onClick={() => onPick(lv)} data={{ "data-level": lv.n }} />
        ))}
      </div>
    </section>
  );
}

function LevelMap({ stages, progress, onPick }: { stages: Stage[]; progress: Progress; onPick: (lv: Level) => void }) {
  return (
    <div data-level-map className="rg-rails">
      {stages.map((st) => <StageRail key={st.n} st={st} stages={stages} progress={progress} onPick={onPick} />)}
    </div>
  );
}

/** The competition chips over the goal list, in this order. */
const COMPS = ["World Cup 2018", "Euro 2016", ...LEAGUES.map((l) => l.comp)];
const COMP_SHORT = (c: string) => c.replace(" 2017/18", "");

function GoalList({ goals, progress, leaguesLoading, onPick }: { goals: RealGoal[]; progress: Progress; leaguesLoading: boolean; onPick: (g: RealGoal) => void }) {
  const [q, setQ] = useState("");
  const [comp, setComp] = useState<string>("all");
  const [shown, setShown] = useState(20);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of goals) m.set(g.x.comp, (m.get(g.x.comp) ?? 0) + 1);
    return m;
  }, [goals]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const feat = new Map(FEATURED.map((f, i) => [f.id, i]));
    const all = goals.filter((g) => comp === "all" || g.x.comp === comp).filter((g) => !t || [g.shot.player, knownAs(g, g.shot.player), g.shot.team, g.shot.match, stageOf(g), g.x.comp].some((s) => s.toLowerCase().includes(t)));
    return all.sort((a, b) => (feat.get(a.id) ?? 999) - (feat.get(b.id) ?? 999));
  }, [goals, q]);
  useEffect(() => setShown(20), [q, comp]);
  return (
    <Panel title="Every goal" note={`${list.length} ${list.length === 1 ? "goal" : "goals"}`}>
      <div data-goal-list className="rg-list">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a player, team or match (Mbappé, Salah, Messi…)" data-search className="rg-search" />
        <div className="rg-comps" data-comps>
          <Pill on={comp === "all"} onClick={() => setComp("all")}>All</Pill>
          {COMPS.map((c) => (
            <Pill key={c} on={comp === c} onClick={() => setComp(c)}>{COMP_SHORT(c)} <span className="rg-ccount">{counts.get(c) ?? (leaguesLoading ? "…" : 0)}</span></Pill>
          ))}
        </div>
        <div className="rg-grid">
          {list.slice(0, shown).map((g) => {
            const f = FEATURED.find((x) => x.id === g.id);
            return (
              <button key={g.id} data-goal={g.id} onClick={() => onPick(g)} className="rg-item">
                <MiniMouth goal={g} />
                <span className="rg-itext">
                  <b>{knownAs(g, g.shot.player)} <em>· {g.shot.team}</em></b>
                  <span>{g.x.home} {g.x.score[0]}–{g.x.score[1]} {g.x.away} · {minuteOf(g)}&apos; · {stageOf(g)}</span>
                  {f && <span className="rg-feat">★ {f.label}</span>}
                </span>
                <span className="rg-iright">{STAR(progress[g.id]?.stars ?? 0, 3, 12)}<span>xG {Math.round(g.shot.xg * 100)}%</span></span>
              </button>
            );
          })}
        </div>
        {shown < list.length && <Btn onClick={() => setShown((n) => n + 20)}>More</Btn>}
      </div>
    </Panel>
  );
}

/** The big card at the top: the next level to play (or the one you are on), with PLAY IT. */
function Hero({ level, progress, onPlay }: { level: Level; progress: Progress; onPlay: () => void }) {
  const g = level.goal;
  const f = FEATURED.find((x) => x.id === g.id);
  const p = progress[g.id];
  return (
    <section className="rg-hero" data-hero={g.id}>
      <div className="rg-hpic">
        <span className="rg-hbadge">{g.x.comp} · {stageOf(g)}</span>
        <MiniMouth goal={g} />
      </div>
      <div className="rg-hinfo">
        <div className="rg-hlabel">{p?.stars ? "Keep going" : "Next level"} · Level {level.n + 1}</div>
        <div className="rg-hname"><Swatch team={g.shot.team} size={16} /> {knownAs(g, g.shot.player)} {minuteOf(g)}&apos;</div>
        <div className="rg-hscore">{g.x.home} <b>{g.x.score[0]} – {g.x.score[1]}</b> {g.x.away}</div>
        {f && <div className="rg-hfeat">★ {f.label}</div>}
        <div className="rg-hstars">{STAR(p?.stars ?? 0, 3, 22)}{p?.best ? <span>best {Math.round(p.best)}%</span> : null}</div>
        <button className="rg-playit" onClick={onPlay} data-play-hero>Play it <span aria-hidden>▶</span></button>
      </div>
    </section>
  );
}

const TAB_KEY = "star-real-goals-tab";

export default function RealGoalsDev() {
  const [goals, setGoals] = useState<RealGoal[] | null>(null);
  // The 2017/18 league goals (Leo, 20 Oct 2026): loaded after the World Cup / Euro ones, for the list only.
  const [leagueGoals, setLeagueGoals] = useState<RealGoal[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTabState] = useState<"levels" | "all">("levels");
  const [progress, setProgress] = useState<Progress>({});
  const [playing, setPlaying] = useState<{ goal: RealGoal; level: Level | null } | null>(null);
  const setTab = (t: "levels" | "all") => { setTabState(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* private */ } };

  useEffect(() => {
    setProgress(loadProgress());
    Promise.all([fetchRealFile<WyscoutShotFile>("shots"), fetchRealFile<RgFile>("goals")])
      .then(([s, g]) => setGoals(joinGoals(s.shots, g.goals)))
      .catch((e) => setError(String(e)));
    Promise.allSettled(LEAGUES.map((l) => fetchRealFile<RgFile & WyscoutShotFile>(l.file)))
      .then((rs) => {
        const out: RealGoal[] = [];
        for (const r of rs) if (r.status === "fulfilled") out.push(...joinGoals(r.value.shots, r.value.goals));
        setLeagueGoals(out);
      })
      .finally(() => setLeaguesLoading(false));
    const q = new URLSearchParams(window.location.search);
    let saved: string | null = null;
    try { saved = localStorage.getItem(TAB_KEY); } catch { /* private */ }
    if (q.get("tab") === "all" || (!q.get("tab") && saved === "all")) setTabState("all");
  }, []);

  // The level map stays on the World Cup / Euro goals (stars already won stay where they are).
  const stages = useMemo(() => (goals ? buildLevels(goals.filter(isTournament)) : []), [goals]);
  const everyGoal = useMemo(() => (goals ? [...goals, ...leagueGoals] : []), [goals, leagueGoals]);
  const allLevels = useMemo(() => stages.flatMap((s) => s.levels), [stages]);

  // ?play=<id> opens a goal straight away (for checking one by eye).
  useEffect(() => {
    if (!goals) return;
    const id = new URLSearchParams(window.location.search).get("play");
    const g = id ? everyGoal.find((q) => q.id === id) : null;
    if (g) setPlaying((p) => p ?? { goal: g, level: allLevels.find((l) => l.goal.id === g.id) ?? null });
  }, [goals, everyGoal, allLevels]);

  const onResult = useCallback((stars: number, pct: number) => {
    if (!playing) return;
    setProgress((p) => { const n = recordResult(p, playing.goal.id, stars, pct); saveProgress(n); return n; });
  }, [playing]);

  const nextLevel = playing?.level ? allLevels[playing.level.n + 1] : undefined;
  // The hero: the first open level without three stars (else the first level).
  const heroLevel = useMemo(
    () => allLevels.find((l) => levelOpen(stages, progress, l) && (progress[l.goal.id]?.stars ?? 0) < 3) ?? allLevels[0],
    [allLevels, stages, progress],
  );
  const play = (goal: RealGoal, level: Level | null) => { setPlaying({ goal, level }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <BroadcastPage
      title="Real Goals"
      sub="Score the real goals — World Cup 2018, Euro 2016 and the 2017/18 Premier League, La Liga, Serie A, Bundesliga and Ligue 1 — the way they really went in."
      actions={<div className="rg-total" data-total-stars>{STAR(1, 1, 22)} <b>{totalStars(progress)}</b><span>/ {allLevels.length * 3 || 150}</span></div>}
    >
      <PageGuide page="/star-real-goals-dev" />
      <div className="rg">
        {error && <Note>Could not load the goals: {error}</Note>}
        {!goals && !error && <Note>Loading the goals…</Note>}

        {goals && playing && (
          <PlayGoal
            key={playing.goal.id}
            goal={playing.goal}
            level={playing.level}
            onClose={() => setPlaying(null)}
            onResult={onResult}
            onNext={nextLevel && levelOpen(stages, progress, nextLevel) ? () => { setPlaying({ goal: nextLevel.goal, level: nextLevel }); window.scrollTo({ top: 0 }); } : undefined}
          />
        )}

        {goals && !playing && heroLevel && <Hero level={heroLevel} progress={progress} onPlay={() => play(heroLevel.goal, heroLevel)} />}

        {goals && (
          <>
            <div className="rg-tabs">
              <Pill on={tab === "levels"} onClick={() => setTab("levels")}>🗺️ Levels</Pill>
              <Pill on={tab === "all"} onClick={() => setTab("all")}>🔎 All {everyGoal.length.toLocaleString("en-GB")}{leaguesLoading ? "…" : ""} goals</Pill>
            </div>
            {tab === "levels"
              ? <LevelMap stages={stages} progress={progress} onPick={(lv) => play(lv.goal, lv)} />
              : <GoalList goals={everyGoal} progress={progress} leaguesLoading={leaguesLoading} onPick={(g) => play(g, allLevels.find((l) => l.goal.id === g.id) ?? null)} />}
          </>
        )}
        <div data-credit className="rg-credit">{REAL_CREDIT.wyscout} {PICTURE_WORDS.placed}.</div>
      </div>
    </BroadcastPage>
  );
}
