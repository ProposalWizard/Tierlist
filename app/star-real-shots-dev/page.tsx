"use client";

/**
 * REAL SHOTS (TEST) — Harry, 13 Oct 2026: "see REAL football shots in our
 * game, on a test page only"; 19 Oct 2026: "We aren't getting licensing, so
 * rebuild Real moments and Real shots (and Real Goals) with free-licensed data".
 *
 * Two kinds of real shot, both cleared for commercial use (lib/star/realMoments):
 *  - FULLY REAL: every shot of 7 Bundesliga / 2. Bundesliga 2022/23 matches
 *    (IDSSE / DFL tracking) and 20 A-League 2024/25 matches (SkillCorner
 *    tracking): all 22 men where they really stood, and the real movement of
 *    the 4 seconds before (the Moving highlight replays it).
 *  - REAL SHOT, PLACED DEFENDERS: every shot of the 2018 World Cup and Euro
 *    2016 (Wyscout events): the real spot, who, how, what happened and the
 *    real passes before it; the others are placed by the game's own rules.
 * Each is drawn top-down on our pitch, playable in the real match engine
 * (EnginePlay, the one engine), and the fully real ones are measured against
 * our own chances of the same kind.
 *
 * Look (Harry, 19 Oct 2026: "real shots opt 2 and 1"): the Broadcast frame, two
 * layouts behind a Pill pair — Shot map and Cards. The playing screen
 * (EnginePlay, MovingHighlight) is unchanged.
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./real-shots.css";
import EnginePlay from "@/components/star/EnginePlay";
import type { ScenarioKind } from "@/lib/star/canvasEngine";
import { PITCH_W, CX, POST_L, POST_R, BOX_L, BOX_R, BOX_DEPTH, SIX_L, SIX_R, SIX_DEPTH, PEN_SPOT_Y, NET_DEPTH } from "@/lib/star/pitch";
import {
  REAL_CREDIT, PICTURE_WORDS, KIND_LABEL, isFullyReal, peopleOf, kindForShot, scenarioForShot, measureReal, ourMeasures, meansOf, playedKeeperOff, fetchRealFile,
  type RealShot, type MeasureMeans, type WyscoutShotFile, type TrackedFile, type TrackFile, type RealTrack,
} from "@/lib/star/realMoments";
import MovingHighlight from "./MovingHighlight";

const PAGE = 20;
/** Play with this page's own camera (every real man within 20 m, the whole goal). */
const OWN_FRAME = { ownFrame: true } as const;
const OUTCOMES = ["All", "Goal", "Saved", "Off T", "Blocked", "Other"] as const;
const TYPES = ["All", "Open Play", "Free Kick", "Penalty", "Corner"] as const;
const PICS = [{ v: "all", t: "Both kinds" }, { v: "full", t: "Fully real (tracking)" }, { v: "placed", t: "Real shot, placed defenders" }] as const;
type Pic = (typeof PICS)[number]["v"];
const BANDS = [
  { label: "Any xG", lo: 0, hi: 2 },
  { label: "under 8%", lo: 0, hi: 0.08 },
  { label: "8–30%", lo: 0.08, hi: 0.3 },
  { label: "over 30%", lo: 0.3, hi: 2 },
];
const COMPARE_KINDS: ScenarioKind[] = ["one_on_one", "volley", "tight_angle", "long_range", "free_kick", "penalty"];
const MAIN_OUTCOMES = new Set(["Goal", "Saved", "Off T", "Blocked"]);
const LINE_COLOUR: Record<string, string> = { Goal: "#22c55e", Saved: "#facc15", Blocked: "#f97316", "Off T": "#94a3b8" };
const OUTCOME_WORD: Record<string, string> = { "Off T": "Off target", Shot: "Shot (no detail)" };
const colourOf = (o: string) => LINE_COLOUR[o] ?? "#e2e8f0";
const LAYOUT_KEY = "star-real-shots-layout";
type Layout = "map" | "cards";
type Tab = "shots" | "move" | "compare";

/** The tag on every shot: which kind of picture it is. */
function PicTag({ s }: { s: RealShot }) {
  const full = isFullyReal(s);
  return (
    <span data-pic={full ? "full" : "placed"} title={full ? PICTURE_WORDS.full : PICTURE_WORDS.placed}
      style={{ display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 11, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase",
        color: "#06140a", background: full ? "#34d399" : "#fbbf24" }}>
      {full ? "Fully real" : "Placed defenders"}
    </span>
  );
}

/** The shot, top-down on our pitch: goal at the top. A placed shot shows the game's placed men as hollow rings. */
function ShotPicture({ s, width }: { s: RealShot; width: number }) {
  const full = isFullyReal(s);
  const p = useMemo(() => {
    const real = peopleOf(s);
    if (full) return real;
    const sc = scenarioForShot(s, { wideFrame: true });
    return {
      ...real,
      keeper: { x: sc.keeper.x, y: sc.keeper.y },
      opps: sc.defenders.map((d) => ({ x: d.x, y: d.y })),
      mates: [...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map((r) => r.pos), ...sc.teammates].filter((q) => q.x > -50 && q.y > -50),
    };
  }, [s, full]);
  const yMax = Math.max(34, p.ball.y + 6);
  const y0 = -NET_DEPTH - 1.5;
  const h = yMax - y0;
  const line = "rgba(255,255,255,0.55)";
  const R = 1.05;
  const fillOr = (c: string) => (full ? c : "none");
  const sw = full ? 0.2 : 0.35;
  return (
    <svg viewBox={`-1 ${y0} ${PITCH_W + 2} ${h}`} width={width} height={(width * h) / (PITCH_W + 2)}
      className="rs-pic" style={{ background: "#166534", borderRadius: 3, display: "block" }}>
      <rect x={0} y={0} width={PITCH_W} height={yMax + 5} fill="none" stroke={line} strokeWidth={0.25} />
      <rect x={BOX_L} y={0} width={BOX_R - BOX_L} height={BOX_DEPTH} fill="none" stroke={line} strokeWidth={0.25} />
      <rect x={SIX_L} y={0} width={SIX_R - SIX_L} height={SIX_DEPTH} fill="none" stroke={line} strokeWidth={0.25} />
      <circle cx={CX} cy={PEN_SPOT_Y} r={0.3} fill={line} />
      <rect x={POST_L} y={-NET_DEPTH} width={POST_R - POST_L} height={NET_DEPTH} fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth={0.3} />
      {p.end && (
        <line x1={p.ball.x} y1={p.ball.y} x2={p.end.x} y2={Math.max(p.end.y, -NET_DEPTH)}
          stroke={colourOf(s.outcome)} strokeWidth={0.45} strokeDasharray="1.2 0.7" />
      )}
      {p.mates.map((m, i) => <circle key={`m${i}`} cx={m.x} cy={m.y} r={R} fill={fillOr("#3b82f6")} stroke={full ? "#0b1220" : "#3b82f6"} strokeWidth={sw} />)}
      {p.opps.map((o, i) => <circle key={`o${i}`} cx={o.x} cy={o.y} r={R} fill={fillOr("#ef4444")} stroke={full ? "#0b1220" : "#ef4444"} strokeWidth={sw} />)}
      {p.keeper && <circle cx={p.keeper.x} cy={p.keeper.y} r={R} fill={fillOr("#a3e635")} stroke={full ? "#0b1220" : "#a3e635"} strokeWidth={sw} />}
      <circle cx={p.ball.x} cy={p.ball.y + 1.3} r={R * 1.1} fill="#fde047" stroke="#0b1220" strokeWidth={0.2} />
      <circle cx={p.ball.x} cy={p.ball.y} r={0.55} fill="#fff" stroke="#0b1220" strokeWidth={0.15} />
    </svg>
  );
}

/** Option 2's big map: every shot that passes the filters, where it was struck, coloured by what happened. */
function ShotMap({ shots, sel, onPick }: { shots: RealShot[]; sel: RealShot | null; onPick: (s: RealShot) => void }) {
  const Y0 = -NET_DEPTH - 1.5, YMAX = 42;
  const line = "rgba(255,255,255,0.4)";
  const at = (s: RealShot) => ({ x: s.ball[0], y: Math.min(YMAX - 1, s.ball[1]) });
  const order = useMemo(() => [...shots].sort((a, b) => (a.outcome === "Goal" ? 1 : 0) - (b.outcome === "Goal" ? 1 : 0)), [shots]);
  const s0 = sel ? at(sel) : null;
  return (
    <svg data-shot-map viewBox={`-1 ${Y0} ${PITCH_W + 2} ${YMAX - Y0}`} className="rs-map" role="img" aria-label="Map of the shots">
      <rect x={0} y={0} width={PITCH_W} height={YMAX + 2} fill="none" stroke={line} strokeWidth={0.25} />
      <rect x={BOX_L} y={0} width={BOX_R - BOX_L} height={BOX_DEPTH} fill="none" stroke={line} strokeWidth={0.25} />
      <rect x={SIX_L} y={0} width={SIX_R - SIX_L} height={SIX_DEPTH} fill="none" stroke={line} strokeWidth={0.25} />
      <path d={`M ${CX - 9.15 * 0.8} ${BOX_DEPTH} A 9.15 9.15 0 0 0 ${CX + 9.15 * 0.8} ${BOX_DEPTH}`} fill="none" stroke={line} strokeWidth={0.25} />
      <circle cx={CX} cy={PEN_SPOT_Y} r={0.3} fill={line} />
      <rect x={POST_L} y={-NET_DEPTH} width={POST_R - POST_L} height={NET_DEPTH} fill="rgba(255,255,255,0.2)" stroke="#fff" strokeWidth={0.3} />
      {order.map((s) => {
        const p = at(s);
        return (
          <circle key={s.id} data-map-shot={s.id} cx={p.x} cy={p.y} r={0.42} fill={colourOf(s.outcome)} fillOpacity={0.8}
            stroke="#03091a" strokeWidth={0.08} onClick={() => onPick(s)} style={{ cursor: "pointer" }}>
            <title>{`${s.player} ${s.minute}' · ${OUTCOME_WORD[s.outcome] ?? s.outcome} · xG ${Math.round(s.xg * 100)}%`}</title>
          </circle>
        );
      })}
      {s0 && <circle cx={s0.x} cy={s0.y} r={1.5} fill="none" stroke="#fff" strokeWidth={0.35} pointerEvents="none" />}
    </svg>
  );
}

function Bar({ label, real, ours, unit, max }: { label: string; real: number; ours: number; unit: string; max: number }) {
  const w = (v: number) => (Number.isNaN(v) ? "0%" : `${Math.max(2, Math.min(100, (100 * v) / max))}%`);
  const row = (who: string, v: number, colour: string) => (
    <div className="rs-brow">
      <div className="rs-bwho">{who}</div>
      <div className="rs-btrack"><div style={{ width: w(v), background: colour }} /></div>
      <div className="rs-bval">{Number.isNaN(v) ? "nobody" : `${v.toFixed(1)}${unit}`}</div>
    </div>
  );
  return (
    <div className="rs-bar">
      <div className="rs-blabel">{label}</div>
      {row("Real", real, "#22c55e")}
      {row("Ours", ours, "#60a5fa")}
    </div>
  );
}

/** Ours vs real: only the fully real shots have real defenders to measure. */
function Compare({ shots }: { shots: RealShot[] }) {
  const [kind, setKind] = useState<ScenarioKind>("one_on_one");
  const full = useMemo(() => shots.filter(isFullyReal), [shots]);
  const { real, ours, kReal, kPlayed, kN } = useMemo(() => {
    const r = meansOf(full.filter((s) => kindForShot(s) === kind).map(measureReal));
    const o = meansOf(ourMeasures(kind, 200));
    const ks = full.filter((s) => kindForShot(s) === kind && peopleOf(s).keeper);
    const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
    const kReal = avg(ks.map((s) => Math.max(0, peopleOf(s).keeper!.y)));
    const kPlayed = avg(ks.map((s) => playedKeeperOff(s) ?? 0));
    return { real: r, ours: o, kReal, kPlayed, kN: ks.length };
  }, [full, kind]);
  const top = (k: keyof MeasureMeans, floor: number) => Math.max(floor, ...[real[k], ours[k]].filter((v) => !Number.isNaN(v))) * 1.1;
  return (
    <Panel title="Ours vs real" note={`${real.n} fully real shots · ${ours.n} of our own chances`}>
      <div data-compare className="rs-compare">
        <div className="rs-pills">
          {COMPARE_KINDS.map((k) => <Pill key={k} on={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</Pill>)}
        </div>
        <div className="rs-bars">
          <Bar label="Shot distance to goal centre" real={real.distance} ours={ours.distance} unit=" m" max={top("distance", 10)} />
          <Bar label="Defenders between ball and goal" real={real.blockers} ours={ours.blockers} unit="" max={top("blockers", 1)} />
          <Bar label="Nearest defender to the ball" real={real.nearest} ours={ours.nearest} unit=" m" max={top("nearest", 3)} />
          <Bar label="Keeper off his line" real={real.keeperOff} ours={ours.keeperOff} unit=" m" max={top("keeperOff", 2)} />
          <div data-keeper-start>
            <Bar label={`The real keeper when you play the shot (after 2 s of aiming, ${kN} shots)`} real={kReal} ours={kPlayed} unit=" m"
              max={Math.max(2, ...[kReal, kPlayed].filter((v) => !Number.isNaN(v))) * 1.1} />
          </div>
        </div>
        <Note>Real: every opponent the tracking saw at the shot (Bundesliga, A-League and Japanese university football, fully real only). Ours: the game&apos;s own chances of this kind, 200 seeds.</Note>
      </div>
    </Panel>
  );
}

/** The filters, shared by both layouts. */
interface Filters {
  comps: string[]; comp: string; setComp: (v: string) => void;
  outcome: (typeof OUTCOMES)[number]; setOutcome: (v: (typeof OUTCOMES)[number]) => void;
  type: (typeof TYPES)[number]; setType: (v: (typeof TYPES)[number]) => void;
  band: number; setBand: (v: number) => void;
  pic: Pic; setPic: (v: Pic) => void;
  search: string; setSearch: (v: string) => void;
}
const activeCount = (f: Filters) => [f.comp !== "All", f.outcome !== "All", f.type !== "All", f.band !== 0, f.pic !== "all", !!f.search.trim()].filter(Boolean).length;

function Select({ label, value, options, onChange, data }: { label: string; value: string; options: { v: string; t: string }[]; onChange: (v: string) => void; data: string }) {
  return (
    <label className="rs-field">
      <span className="bc-label">{label}</span>
      <select className="rs-select" value={value} onChange={(e) => onChange(e.target.value)} {...{ [data]: true }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </label>
  );
}
const picSel = (f: Filters) => <Select label="Picture" data="data-filter-pic" value={f.pic} options={PICS.map((p) => ({ v: p.v, t: p.t }))} onChange={(v) => f.setPic(v as Pic)} />;
const compSel = (f: Filters) => <Select label="Competition" data="data-filter-comp" value={f.comp} options={f.comps.map((c) => ({ v: c, t: c === "All" ? "All competitions" : c }))} onChange={f.setComp} />;
const typeSel = (f: Filters) => <Select label="How it came" data="data-filter-type" value={f.type} options={TYPES.map((t) => ({ v: t, t: t === "All" ? "Any way" : t }))} onChange={(v) => f.setType(v as Filters["type"])} />;
const bandSel = (f: Filters) => <Select label="Chance of a goal (xG)" data="data-filter-xg" value={String(f.band)} options={BANDS.map((b, i) => ({ v: String(i), t: b.label }))} onChange={(v) => f.setBand(Number(v))} />;
const searchBox = (f: Filters) => (
  <label className="rs-field rs-field-wide">
    <span className="bc-label">Player or team</span>
    <input value={f.search} onChange={(e) => f.setSearch(e.target.value)} placeholder="Search a player or team" className="rs-search" data-search />
  </label>
);

/** Option 2's left panel: outcome as a coloured list, the rest as drop-downs. Folds away on a phone. */
function FilterPanel({ f }: { f: Filters }) {
  const [open, setOpen] = useState(false);
  const n = activeCount(f);
  return (
    <section className="bc-panel rs-filters" data-open={open ? "true" : "false"}>
      <button className="rs-ftoggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Filters ({n}) <span aria-hidden>{open ? "▲" : "▼"}</span></button>
      <div className="bc-ph rs-fhead"><h2>Filters</h2>{n > 0 && <span>{n} on</span>}</div>
      <div className="bc-pb rs-fbody">
        {picSel(f)}
        {compSel(f)}
        <div className="rs-field">
          <span className="bc-label">What happened</span>
          <div className="rs-outs">
            {OUTCOMES.map((o) => (
              <button key={o} className="rs-out" aria-pressed={f.outcome === o} onClick={() => f.setOutcome(o)} data-filter-outcome={o}>
                <span className="rs-sw" style={{ background: o === "All" ? "linear-gradient(90deg,#22c55e,#facc15,#f97316,#94a3b8)" : o === "Other" ? "#e2e8f0" : colourOf(o) }} />
                {o === "All" ? "Every shot" : OUTCOME_WORD[o] ?? o}
              </button>
            ))}
          </div>
        </div>
        {typeSel(f)}
        {bandSel(f)}
        {searchBox(f)}
      </div>
    </section>
  );
}

/** Option 1's filter row: drop-downs side by side. */
function FilterRow({ f }: { f: Filters }) {
  return (
    <div className="rs-frow" data-filter-row>
      {picSel(f)}
      {compSel(f)}
      <Select label="What happened" data="data-filter-outcome-select" value={f.outcome}
        options={OUTCOMES.map((o) => ({ v: o, t: o === "All" ? "Every shot" : OUTCOME_WORD[o] ?? o }))} onChange={(v) => f.setOutcome(v as Filters["outcome"])} />
      {typeSel(f)}
      {bandSel(f)}
      {searchBox(f)}
    </div>
  );
}

function Legend() {
  return (
    <div className="rs-legend">
      {(["Goal", "Saved", "Blocked", "Off T"] as const).map((o) => <span key={o}><i style={{ background: colourOf(o) }} />{OUTCOME_WORD[o] ?? o}</span>)}
      <span><i style={{ background: "#e2e8f0" }} />Other</span>
    </div>
  );
}

/** How many seconds of real build-up a shot has (passes or tracking). */
const buildUpWord = (s: RealShot) => (isFullyReal(s) ? "4 s of real movement" : `${s.lead?.passes.length ?? 0} real passes`);
const hasBuildUp = (s: RealShot) => isFullyReal(s) || (s.lead?.passes.length ?? 0) >= 2;

/** The ▶ on a shot: Play it (Shots), or Watch the move (Moving highlight). */
function ShotAction({ s, tab, onPlay, onWatch, big }: { s: RealShot; tab: Tab; onPlay: (s: RealShot) => void; onWatch: (s: RealShot) => void; big?: boolean }) {
  return tab === "move"
    ? <button className="rs-play" data-big={big ? "true" : undefined} onClick={() => onWatch(s)}>▶ Watch the move ({buildUpWord(s)})</button>
    : <button className="rs-play" data-big={big ? "true" : undefined} onClick={() => onPlay(s)}>▶ Play this shot</button>;
}

/** Option 2's right panel: the picked shot, big. */
function Details({ s, tab, onPlay, onWatch }: { s: RealShot | null; tab: Tab; onPlay: (s: RealShot) => void; onWatch: (s: RealShot) => void }) {
  return (
    <Panel title="Shot details">
      {!s ? <Note>No shot matches the filters.</Note> : (
        <div className="rs-det" data-shot-details={s.id}>
          <div className="rs-dname">{s.player}</div>
          <div className="rs-dsub">{s.team} · {s.minute}&apos; · <PicTag s={s} /></div>
          <div className="rs-dsub">{s.comp} · {s.match}</div>
          <ShotPicture s={s} width={280} />
          <div className="rs-dxg">
            <b>xG {Math.round(s.xg * 100)}%</b>
            <span className="rs-badge" style={{ background: colourOf(s.outcome) }}>{OUTCOME_WORD[s.outcome] ?? s.outcome}</span>
          </div>
          <div className="rs-dstats">
            <div><b>{s.type}</b><span>how it came</span></div>
            <div><b>{s.body}</b><span>body part</span></div>
            <div><b>{KIND_LABEL[kindForShot(s)] ?? kindForShot(s)}</b><span>our chance kind</span></div>
          </div>
          <ShotAction s={s} tab={tab} onPlay={onPlay} onWatch={onWatch} big />
        </div>
      )}
    </Panel>
  );
}

export default function RealShotsDev() {
  const [shots, setShots] = useState<RealShot[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("shots");
  const [layout, setLayoutState] = useState<Layout>("map");
  const [comp, setComp] = useState("All");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("All");
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [band, setBand] = useState(0);
  const [pic, setPic] = useState<Pic>("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [playing, setPlaying] = useState<RealShot | null>(null);
  const [tracks, setTracks] = useState<Record<string, RealTrack> | null>(null);
  const [watching, setWatching] = useState<RealShot | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const setLayout = (l: Layout) => { setLayoutState(l); try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* private */ } };

  useEffect(() => {
    Promise.all([fetchRealFile<WyscoutShotFile>("shots"), fetchRealFile<TrackedFile>("tracked")])
      .then(([w, t]) => setShots([...t.moments.filter((m): m is RealShot & { what: "shot" } => m.what === "shot"), ...w.shots]))
      .catch((e) => setError(String(e)));
    const q = new URLSearchParams(window.location.search);
    if (q.get("tab") === "compare") setTab("compare");
    if (q.get("tab") === "move") setTab("move");
    let saved: string | null = null;
    try { saved = localStorage.getItem(LAYOUT_KEY); } catch { /* private */ }
    const want = q.get("layout") ?? saved;
    if (want === "cards" || want === "map") setLayoutState(want);
  }, []);

  // The real movement of the tracked shots, fetched the first time the Moving highlight tab opens.
  useEffect(() => {
    if (tab !== "move" || tracks) return;
    fetchRealFile<TrackFile>("tracks").then((d) => setTracks(d.tracks)).catch((e) => setError(String(e)));
  }, [tab, tracks]);

  // ?play=<id> opens a shot straight away (handy for checking one by eye).
  useEffect(() => {
    if (!shots) return;
    const id = new URLSearchParams(window.location.search).get("play");
    if (id) setPlaying(shots.find((s) => s.id === id) ?? null);
  }, [shots]);
  // ?watch=<id> (with ?tab=move) opens a moving highlight straight away.
  useEffect(() => {
    if (!shots || !tracks) return;
    const id = new URLSearchParams(window.location.search).get("watch");
    if (id) setWatching(shots.find((s) => s.id === id) ?? null);
  }, [shots, tracks]);

  const comps = useMemo(() => ["All", ...Array.from(new Set((shots ?? []).map((s) => s.comp)))], [shots]);
  const list = useMemo(() => {
    if (!shots) return [];
    const b = BANDS[band];
    const q = search.trim().toLowerCase();
    return shots.filter((s) => (comp === "All" || s.comp === comp)
      && (pic === "all" || (pic === "full") === isFullyReal(s))
      && (outcome === "All" || (outcome === "Other" ? !MAIN_OUTCOMES.has(s.outcome) : s.outcome === outcome))
      && (type === "All" || s.type === type)
      && s.xg >= b.lo && s.xg < b.hi
      && (!q || s.player.toLowerCase().includes(q) || s.team.toLowerCase().includes(q))
      && (tab !== "move" || hasBuildUp(s)));
  }, [shots, comp, pic, outcome, type, band, search, tab]);
  useEffect(() => setShown(PAGE), [comp, pic, outcome, type, band, search]);
  const sel = useMemo(() => list.find((s) => s.id === selId) ?? list[0] ?? null, [list, selId]);
  const goals = useMemo(() => list.filter((s) => s.outcome === "Goal").length, [list]);
  const nFull = useMemo(() => (shots ?? []).filter(isFullyReal).length, [shots]);

  const openOn = useMemo(() => (playing ? () => scenarioForShot(playing, { wideFrame: true }) : undefined), [playing]);
  const f: Filters = { comps, comp, setComp, outcome, setOutcome, type, setType, band, setBand, pic, setPic, search, setSearch };
  const onPlay = (s: RealShot) => { setPlaying(s); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const onWatch = (s: RealShot) => { setWatching(s); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const countLine = `${list.length} shots${tab === "move" ? " with a real build-up" : ""}`;
  const more = shown < list.length && <Btn onClick={() => setShown((n) => n + PAGE)}>More</Btn>;
  const key = (
    <Note>
      Picture: yellow = the shooter (YOU in Play), white = ball, red = opponents, green = keeper, blue = team-mates.
      Filled = where they really stood (fully real); rings = placed by the game&apos;s rules (the shot is real, the others are not).
      The dashed line is where the shot went (green goal, yellow saved, orange blocked, grey off target).
    </Note>
  );

  return (
    <BroadcastPage
      title="Real Shots"
      sub="Real shots in our game. Fully real: Bundesliga, A-League and Japanese university football, every player where he stood. Placed: World Cup 2018 and Euro 2016, the real shot with the defenders placed by our rules."
    >
      <PageGuide page="/star-real-shots-dev" />
      <div className="rs">
        <div className="rs-top">
        <div className="rs-tabs">
          <Pill on={tab === "shots"} onClick={() => setTab("shots")}>Shots</Pill>
          <Pill on={tab === "move"} onClick={() => setTab("move")}>Moving highlight</Pill>
          <Pill on={tab === "compare"} onClick={() => setTab("compare")}>Ours vs real</Pill>
        </div>
        <div className="rs-layout" data-layout={layout}>
          <Pill on={layout === "map"} onClick={() => setLayout("map")} title="Option 2: filters, a map of every shot, the picked shot">🗺️ Shot map</Pill>
          <Pill on={layout === "cards"} onClick={() => setLayout("cards")} title="Option 1: a grid of shot cards">▦ Cards</Pill>
        </div>
        </div>

        {error && <Note>Could not load the shots: {error}</Note>}
        {!shots && !error && <Note>Loading the shots…</Note>}
        {shots && <div className="rs-count" data-counts>{nFull.toLocaleString("en-GB")} fully real shots · {(shots.length - nFull).toLocaleString("en-GB")} real shots with placed defenders</div>}

        {shots && tab === "compare" && <Compare shots={shots} />}

        {shots && tab === "move" && !tracks && !error && <Note>Loading the moves…</Note>}
        {shots && (tab === "shots" || (tab === "move" && tracks)) && (
          <>
            {tab === "move" && (
              <Note>
                Fully real: the match replays where the ball and every player really were for the 4 seconds before the shot. Placed: it replays the last real passes (the others start from their team&apos;s shape). Then the shot is yours.
              </Note>
            )}
            {tab === "move" && watching && (
              <MovingHighlight key={watching.id} shot={watching} track={tracks?.[watching.id] ?? null} onClose={() => setWatching(null)} />
            )}
            {tab === "shots" && playing && openOn && (
              <section data-playing className="bc-panel rs-playing">
                <div className="rs-phead">
                  <div>
                    <b>{playing.player} · {playing.minute}&apos; · {KIND_LABEL[kindForShot(playing)] ?? kindForShot(playing)}</b>
                    <span>Real: {OUTCOME_WORD[playing.outcome] ?? playing.outcome}, xG {Math.round(playing.xg * 100)}% · <PicTag s={playing} /></span>
                  </div>
                  <Btn onClick={() => setPlaying(null)}>■ Stop</Btn>
                </div>
                <EnginePlay key={playing.id} seed={7} openOn={openOn} scene={OWN_FRAME} />
              </section>
            )}

            {layout === "map" ? (
              <>
                <div className="rs-three">
                  <FilterPanel f={f} />
                  <Panel title="Shot map" note={countLine}>
                    <ShotMap shots={list} sel={sel} onPick={(s) => setSelId(s.id)} />
                    <Legend />
                    <Note>Tap a dot to see that shot.</Note>
                  </Panel>
                  <Details s={sel} tab={tab} onPlay={onPlay} onWatch={onWatch} />
                </div>
                <Panel title="Every shot" note={countLine}>
                  <div className="rs-rows">
                    {list.slice(0, shown).map((s) => (
                      <div key={s.id} data-shot={s.id} className="rs-rowcard" data-sel={sel?.id === s.id ? "true" : undefined}>
                        <button className="rs-rowpick" onClick={() => setSelId(s.id)} title="Show on the map">
                          <ShotPicture s={s} width={110} />
                        </button>
                        <div className="rs-rtext">
                          <b>{s.player} <PicTag s={s} /></b>
                          <span>{s.team} · {s.minute}&apos; · {s.match}</span>
                          <span><i style={{ color: colourOf(s.outcome) }}>{OUTCOME_WORD[s.outcome] ?? s.outcome}</i> · xG {Math.round(s.xg * 100)}% · {s.type} · {s.body}</span>
                          <ShotAction s={s} tab={tab} onPlay={onPlay} onWatch={onWatch} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {more}
                  {key}
                </Panel>
              </>
            ) : (
              <>
                <section className="rs-total" data-total>
                  <div className="rs-tnum"><span>Total shots</span><b>{list.length.toLocaleString("en-GB")}</b></div>
                  <div className="rs-tgoals">
                    <span>Goals <b>{goals}</b> · {list.length ? Math.round((100 * goals) / list.length) : 0}%</span>
                    <div className="rs-tbar"><div style={{ width: `${list.length ? Math.max(2, (100 * goals) / list.length) : 0}%` }} /></div>
                  </div>
                </section>
                <FilterRow f={f} />
                <div className="rs-count">{countLine}</div>
                <div className="rs-cards">
                  {list.slice(0, shown).map((s) => (
                    <div key={s.id} data-shot={s.id} className="rs-card">
                      <div className="rs-cname">{s.player}</div>
                      <div className="rs-cpic">
                        <ShotPicture s={s} width={240} />
                        <span className="rs-xg">{Math.round(s.xg * 100)}% xG</span>
                      </div>
                      <div className="rs-cline"><i style={{ color: colourOf(s.outcome) }}>{OUTCOME_WORD[s.outcome] ?? s.outcome}</i> · {s.minute}&apos; · {s.type} · <PicTag s={s} /></div>
                      <div className="rs-cline rs-dim">{s.match}</div>
                      <ShotAction s={s} tab={tab} onPlay={onPlay} onWatch={onWatch} />
                    </div>
                  ))}
                </div>
                {more}
                {key}
              </>
            )}
          </>
        )}
        <div data-credit className="rs-credit">
          {REAL_CREDIT.dfl}<br />{REAL_CREDIT.skillcorner}<br />{REAL_CREDIT.soccertrack}<br />{REAL_CREDIT.wyscout}
        </div>
      </div>
    </BroadcastPage>
  );
}
