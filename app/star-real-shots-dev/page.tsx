"use client";

/**
 * REAL SHOTS (TEST) — Harry, 13 Oct 2026: "use StatsBomb's free open data to
 * see REAL football shots in our game, on a test page only."
 *
 * Every shot of the 2022 World Cup and Euro 2024 that has a freeze frame
 * (where every player near it stood), drawn top-down on our pitch, playable
 * in the real match engine (EnginePlay, the one engine), and measured against
 * our own chances of the same kind. Test only: the licence for a paid game is
 * not cleared, so nothing here reaches the real game.
 *
 * Look (Harry, 19 Oct 2026: "real shots opt 2 and 1"): the Broadcast frame, two
 * layouts of the same functions behind a Pill pair at the top — Shot map
 * (option 2: filters | map of every shot | the picked shot) and Cards
 * (option 1: a total, filter row, a grid of shot cards). The playing screen
 * (EnginePlay, MovingHighlight) is unchanged.
 *
 * Data: StatsBomb open data (https://github.com/statsbomb/open-data),
 * data/statsbomb/shots.json (scripts/statsbomb/fetch_shots.py).
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./real-shots.css";
import EnginePlay from "@/components/star/EnginePlay";
import type { ScenarioKind } from "@/lib/star/canvasEngine";
import { PITCH_W, CX, POST_L, POST_R, BOX_L, BOX_R, BOX_DEPTH, SIX_L, SIX_R, SIX_DEPTH, PEN_SPOT_Y, NET_DEPTH } from "@/lib/star/pitch";
import {
  STATSBOMB_CREDIT, KIND_LABEL, peopleOf, kindForShot, scenarioForShot, measureReal, ourMeasures, meansOf, playedKeeperOff,
  type SbShot, type SbFile, type MeasureMeans, type SbLeadin, type SbLeadinFile,
} from "@/lib/star/statsbombShots";
import MovingHighlight from "./MovingHighlight";

const PAGE = 20;
/** Play with this page's own camera (every real man within 20 m, the whole goal). */
const OWN_FRAME = { ownFrame: true } as const;
const OUTCOMES = ["All", "Goal", "Saved", "Off T", "Blocked", "Other"] as const;
const TYPES = ["All", "Open Play", "Free Kick", "Penalty", "Corner"] as const;
const BANDS = [
  { label: "Any xG", lo: 0, hi: 2 },
  { label: "under 8%", lo: 0, hi: 0.08 },
  { label: "8–30%", lo: 0.08, hi: 0.3 },
  { label: "over 30%", lo: 0.3, hi: 2 },
];
const COMPARE_KINDS: ScenarioKind[] = ["one_on_one", "volley", "tight_angle", "long_range", "free_kick", "penalty"];
const MAIN_OUTCOMES = new Set(["Goal", "Saved", "Off T", "Blocked"]);
const LINE_COLOUR: Record<string, string> = { Goal: "#22c55e", Saved: "#facc15", Blocked: "#f97316", "Off T": "#94a3b8" };
const OUTCOME_WORD: Record<string, string> = { "Off T": "Off target" };
const colourOf = (o: string) => LINE_COLOUR[o] ?? "#e2e8f0";
const LAYOUT_KEY = "star-real-shots-layout";
type Layout = "map" | "cards";
type Tab = "shots" | "move" | "compare";

/** The shot, top-down on our pitch: goal at the top, as in our own view. */
function ShotPicture({ s, width }: { s: SbShot; width: number }) {
  const p = peopleOf(s);
  const yMax = Math.max(34, p.ball.y + 6);
  const y0 = -NET_DEPTH - 1.5;
  const h = yMax - y0;
  const line = "rgba(255,255,255,0.55)";
  const R = 1.05;
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
      {p.mates.map((m, i) => <circle key={`m${i}`} cx={m.x} cy={m.y} r={R} fill="#3b82f6" stroke="#0b1220" strokeWidth={0.2} />)}
      {p.opps.map((o, i) => <circle key={`o${i}`} cx={o.x} cy={o.y} r={R} fill="#ef4444" stroke="#0b1220" strokeWidth={0.2} />)}
      {p.keeper && <circle cx={p.keeper.x} cy={p.keeper.y} r={R} fill="#a3e635" stroke="#0b1220" strokeWidth={0.2} />}
      <circle cx={p.ball.x} cy={p.ball.y + 1.3} r={R * 1.1} fill="#fde047" stroke="#0b1220" strokeWidth={0.2} />
      <circle cx={p.ball.x} cy={p.ball.y} r={0.55} fill="#fff" stroke="#0b1220" strokeWidth={0.15} />
    </svg>
  );
}

/** Option 2's big map: every shot that passes the filters, where it was struck, coloured by what happened. */
function ShotMap({ shots, sel, onPick }: { shots: SbShot[]; sel: SbShot | null; onPick: (s: SbShot) => void }) {
  const Y0 = -NET_DEPTH - 1.5, YMAX = 42;
  const line = "rgba(255,255,255,0.4)";
  const at = (s: SbShot) => { const b = peopleOf(s).ball; return { x: b.x, y: Math.min(YMAX - 1, b.y) }; };
  // Goals last, so they sit on top of the misses.
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

function Compare({ shots }: { shots: SbShot[] }) {
  const [kind, setKind] = useState<ScenarioKind>("one_on_one");
  const { real, ours, kReal, kPlayed, kN } = useMemo(() => {
    const r = meansOf(shots.filter((s) => kindForShot(s) === kind).map(measureReal));
    const o = meansOf(ourMeasures(kind, 200));
    // The real keeper, played: where he stands after 2 s of you aiming at the
    // real shot in our engine (he used to walk to our own set spot).
    const ks = shots.filter((s) => kindForShot(s) === kind && peopleOf(s).keeper);
    const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
    const kReal = avg(ks.map((s) => Math.max(0, peopleOf(s).keeper!.y)));
    const kPlayed = avg(ks.map((s) => playedKeeperOff(s) ?? 0));
    return { real: r, ours: o, kReal, kPlayed, kN: ks.length };
  }, [shots, kind]);
  const top = (k: keyof MeasureMeans, floor: number) => Math.max(floor, ...[real[k], ours[k]].filter((v) => !Number.isNaN(v))) * 1.1;
  return (
    <Panel title="Ours vs real" note={`${real.n} real shots · ${ours.n} of our own chances`}>
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
        <Note>Real: every opponent StatsBomb froze near the shot. Ours: the game&apos;s own chances of this kind, 200 seeds.</Note>
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
  search: string; setSearch: (v: string) => void;
}
const activeCount = (f: Filters) => [f.comp !== "All", f.outcome !== "All", f.type !== "All", f.band !== 0, !!f.search.trim()].filter(Boolean).length;

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

/** The ▶ on a shot: Play it (Shots), or Watch the move (Moving highlight). */
function ShotAction({ s, tab, passes, onPlay, onWatch, big }: { s: SbShot; tab: Tab; passes?: number; onPlay: (s: SbShot) => void; onWatch: (s: SbShot) => void; big?: boolean }) {
  return tab === "move"
    ? <button className="rs-play" data-big={big ? "true" : undefined} onClick={() => onWatch(s)}>▶ Watch the move ({passes} passes)</button>
    : <button className="rs-play" data-big={big ? "true" : undefined} onClick={() => onPlay(s)}>▶ Play this shot</button>;
}

/** Option 2's right panel: the picked shot, big. */
function Details({ s, tab, passes, onPlay, onWatch }: { s: SbShot | null; tab: Tab; passes?: number; onPlay: (s: SbShot) => void; onWatch: (s: SbShot) => void }) {
  return (
    <Panel title="Shot details">
      {!s ? <Note>No shot matches the filters.</Note> : (
        <div className="rs-det" data-shot-details={s.id}>
          <div className="rs-dname">{s.player}</div>
          <div className="rs-dsub">{s.team} · {s.minute}&apos;</div>
          <div className="rs-dsub">{s.match}</div>
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
          <ShotAction s={s} tab={tab} passes={passes} onPlay={onPlay} onWatch={onWatch} big />
        </div>
      )}
    </Panel>
  );
}

export default function StatsbombShotsDev() {
  const [shots, setShots] = useState<SbShot[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("shots");
  const [layout, setLayoutState] = useState<Layout>("map");
  const [comp, setComp] = useState("All");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("All");
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [band, setBand] = useState(0);
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [playing, setPlaying] = useState<SbShot | null>(null);
  const [leadins, setLeadins] = useState<Record<string, SbLeadin> | null>(null);
  const [watching, setWatching] = useState<SbShot | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const setLayout = (l: Layout) => { setLayoutState(l); try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* private */ } };

  useEffect(() => {
    fetch("/api/star/statsbomb-shots")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: SbFile) => setShots(d.shots))
      .catch((e) => setError(String(e)));
    const q = new URLSearchParams(window.location.search);
    if (q.get("tab") === "compare") setTab("compare");
    if (q.get("tab") === "move") setTab("move");
    let saved: string | null = null;
    try { saved = localStorage.getItem(LAYOUT_KEY); } catch { /* private */ }
    const want = q.get("layout") ?? saved;
    if (want === "cards" || want === "map") setLayoutState(want);
  }, []);

  // The passes before each shot, fetched the first time the Moving highlight tab opens.
  useEffect(() => {
    if (tab !== "move" || leadins) return;
    fetch("/api/star/statsbomb-shots?file=leadins")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: SbLeadinFile) => setLeadins(d.leadins))
      .catch((e) => setError(String(e)));
  }, [tab, leadins]);

  // ?play=<id> opens a shot straight away (handy for checking one by eye).
  useEffect(() => {
    if (!shots) return;
    const id = new URLSearchParams(window.location.search).get("play");
    if (id) setPlaying(shots.find((s) => s.id === id) ?? null);
  }, [shots]);
  // ?watch=<id> (with ?tab=move) opens a moving highlight straight away.
  useEffect(() => {
    if (!shots || !leadins) return;
    const id = new URLSearchParams(window.location.search).get("watch");
    if (id) setWatching(shots.find((s) => s.id === id) ?? null);
  }, [shots, leadins]);

  const comps = useMemo(() => ["All", ...Array.from(new Set((shots ?? []).map((s) => s.comp)))], [shots]);
  const list = useMemo(() => {
    if (!shots) return [];
    const b = BANDS[band];
    const q = search.trim().toLowerCase();
    return shots.filter((s) => (comp === "All" || s.comp === comp)
      && (outcome === "All" || (outcome === "Other" ? !MAIN_OUTCOMES.has(s.outcome) : s.outcome === outcome))
      && (type === "All" || s.type === type)
      && s.xg >= b.lo && s.xg < b.hi
      && (!q || s.player.toLowerCase().includes(q) || s.team.toLowerCase().includes(q))
      && (tab !== "move" || (leadins?.[s.id]?.passes.length ?? 0) >= 2));
  }, [shots, comp, outcome, type, band, search, tab, leadins]);
  useEffect(() => setShown(PAGE), [comp, outcome, type, band, search]);
  // The picked shot (option 2's details): the one clicked, else the first that passes the filters.
  const sel = useMemo(() => list.find((s) => s.id === selId) ?? list[0] ?? null, [list, selId]);
  const goals = useMemo(() => list.filter((s) => s.outcome === "Goal").length, [list]);

  const openOn = useMemo(() => (playing ? () => scenarioForShot(playing, { wideFrame: true }) : undefined), [playing]);
  const f: Filters = { comps, comp, setComp, outcome, setOutcome, type, setType, band, setBand, search, setSearch };
  const onPlay = (s: SbShot) => { setPlaying(s); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const onWatch = (s: SbShot) => { setWatching(s); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const passesOf = (s: SbShot) => leadins?.[s.id]?.passes.length;
  const countLine = `${list.length} shots${tab === "move" ? " with 2+ passes before them" : ""}`;
  const more = shown < list.length && <Btn onClick={() => setShown((n) => n + PAGE)}>More</Btn>;
  const key = (
    <Note>
      Picture: yellow = the shooter (YOU in Play), white = ball, red = opponents, green = keeper, blue = team-mates.
      The dashed line is where the shot went (green goal, yellow saved, orange blocked, grey off target).
    </Note>
  );

  return (
    <BroadcastPage
      title="Real Shots"
      sub="Real World Cup 2022 and Euro 2024 shots, with where everyone stood. Test only: none of this is in the game."
    >
      <PageGuide page="/star-statsbomb-dev" />
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

        {shots && tab === "compare" && <Compare shots={shots} />}

        {shots && tab === "move" && !leadins && !error && <Note>Loading the moves…</Note>}
        {shots && (tab === "shots" || (tab === "move" && leadins)) && (
          <>
            {tab === "move" && (
              <Note>
                The match radar follows the move; the real match replays the last 2–3 real passes in its own picture (2D or 3D), you receive the last one, then the shot is yours.
              </Note>
            )}
            {tab === "move" && watching && leadins?.[watching.id] && (
              <MovingHighlight key={watching.id} shot={watching} lead={leadins[watching.id]} onClose={() => setWatching(null)} />
            )}
            {tab === "shots" && playing && openOn && (
              <section data-playing className="bc-panel rs-playing">
                <div className="rs-phead">
                  <div>
                    <b>{playing.player} · {playing.minute}&apos; · {KIND_LABEL[kindForShot(playing)] ?? kindForShot(playing)}</b>
                    <span>Real: {playing.outcome}, xG {Math.round(playing.xg * 100)}%</span>
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
                  <Details s={sel} tab={tab} passes={sel ? passesOf(sel) : undefined} onPlay={onPlay} onWatch={onWatch} />
                </div>
                <Panel title="Every shot" note={countLine}>
                  <div className="rs-rows">
                    {list.slice(0, shown).map((s) => (
                      <div key={s.id} data-shot={s.id} className="rs-rowcard" data-sel={sel?.id === s.id ? "true" : undefined}>
                        <button className="rs-rowpick" onClick={() => setSelId(s.id)} title="Show on the map">
                          <ShotPicture s={s} width={110} />
                        </button>
                        <div className="rs-rtext">
                          <b>{s.player}</b>
                          <span>{s.team} · {s.minute}&apos; · {s.match}</span>
                          <span><i style={{ color: colourOf(s.outcome) }}>{OUTCOME_WORD[s.outcome] ?? s.outcome}</i> · xG {Math.round(s.xg * 100)}% · {s.type} · {s.body}</span>
                          <ShotAction s={s} tab={tab} passes={passesOf(s)} onPlay={onPlay} onWatch={onWatch} />
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
                      <div className="rs-cline"><i style={{ color: colourOf(s.outcome) }}>{OUTCOME_WORD[s.outcome] ?? s.outcome}</i> · {s.minute}&apos; · {s.type}</div>
                      <div className="rs-cline rs-dim">{s.match}</div>
                      <ShotAction s={s} tab={tab} passes={passesOf(s)} onPlay={onPlay} onWatch={onWatch} />
                    </div>
                  ))}
                </div>
                {more}
                {key}
              </>
            )}
          </>
        )}
        <div data-credit className="rs-credit">{STATSBOMB_CREDIT}</div>
      </div>
    </BroadcastPage>
  );
}
