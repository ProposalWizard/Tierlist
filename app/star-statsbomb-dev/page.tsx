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
 * Data: StatsBomb open data (https://github.com/statsbomb/open-data),
 * data/statsbomb/shots.json (scripts/statsbomb/fetch_shots.py).
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import EnginePlay from "@/components/star/EnginePlay";
import type { ScenarioKind } from "@/lib/star/canvasEngine";
import { PITCH_W, CX, POST_L, POST_R, BOX_L, BOX_R, BOX_DEPTH, SIX_L, SIX_R, SIX_DEPTH, PEN_SPOT_Y, NET_DEPTH } from "@/lib/star/pitch";
import {
  STATSBOMB_CREDIT, KIND_LABEL, peopleOf, kindForShot, scenarioForShot, measureReal, ourMeasures, meansOf,
  type SbShot, type SbFile, type MeasureMeans, type SbLeadin, type SbLeadinFile,
} from "@/lib/star/statsbombShots";
import MovingHighlight from "./MovingHighlight";

const PAGE = 20;
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
      style={{ background: "#166534", borderRadius: 6, display: "block" }}>
      <rect x={0} y={0} width={PITCH_W} height={yMax + 5} fill="none" stroke={line} strokeWidth={0.25} />
      <rect x={BOX_L} y={0} width={BOX_R - BOX_L} height={BOX_DEPTH} fill="none" stroke={line} strokeWidth={0.25} />
      <rect x={SIX_L} y={0} width={SIX_R - SIX_L} height={SIX_DEPTH} fill="none" stroke={line} strokeWidth={0.25} />
      <circle cx={CX} cy={PEN_SPOT_Y} r={0.3} fill={line} />
      <rect x={POST_L} y={-NET_DEPTH} width={POST_R - POST_L} height={NET_DEPTH} fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth={0.3} />
      {p.end && (
        <line x1={p.ball.x} y1={p.ball.y} x2={p.end.x} y2={Math.max(p.end.y, -NET_DEPTH)}
          stroke={LINE_COLOUR[s.outcome] ?? "#e2e8f0"} strokeWidth={0.45} strokeDasharray="1.2 0.7" />
      )}
      {p.mates.map((m, i) => <circle key={`m${i}`} cx={m.x} cy={m.y} r={R} fill="#3b82f6" stroke="#0b1220" strokeWidth={0.2} />)}
      {p.opps.map((o, i) => <circle key={`o${i}`} cx={o.x} cy={o.y} r={R} fill="#ef4444" stroke="#0b1220" strokeWidth={0.2} />)}
      {p.keeper && <circle cx={p.keeper.x} cy={p.keeper.y} r={R} fill="#a3e635" stroke="#0b1220" strokeWidth={0.2} />}
      <circle cx={p.ball.x} cy={p.ball.y + 1.3} r={R * 1.1} fill="#fde047" stroke="#0b1220" strokeWidth={0.2} />
      <circle cx={p.ball.x} cy={p.ball.y} r={0.55} fill="#fff" stroke="#0b1220" strokeWidth={0.15} />
    </svg>
  );
}

function Bar({ label, real, ours, unit, max }: { label: string; real: number; ours: number; unit: string; max: number }) {
  const w = (v: number) => (Number.isNaN(v) ? "0%" : `${Math.max(2, Math.min(100, (100 * v) / max))}%`);
  const row = (who: string, v: number, colour: string) => (
    <div className="flex items-center gap-2">
      <div className="w-10 text-[11px] font-black text-white">{who}</div>
      <div className="h-4 flex-1 rounded bg-white/10">
        <div className="h-4 rounded" style={{ width: w(v), background: colour }} />
      </div>
      <div className="w-14 text-right text-xs font-black text-white">{Number.isNaN(v) ? "nobody" : `${v.toFixed(1)}${unit}`}</div>
    </div>
  );
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-bold text-white">{label}</div>
      {row("Real", real, "#22c55e")}
      <div className="h-1" />
      {row("Ours", ours, "#60a5fa")}
    </div>
  );
}

function Compare({ shots }: { shots: SbShot[] }) {
  const [kind, setKind] = useState<ScenarioKind>("one_on_one");
  const { real, ours } = useMemo(() => {
    const r = meansOf(shots.filter((s) => kindForShot(s) === kind).map(measureReal));
    const o = meansOf(ourMeasures(kind, 200));
    return { real: r, ours: o };
  }, [shots, kind]);
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-xs font-black ${on ? "bg-white text-black" : "bg-white/10 text-white"}`;
  const top = (k: keyof MeasureMeans, floor: number) => Math.max(floor, ...[real[k], ours[k]].filter((v) => !Number.isNaN(v))) * 1.1;
  return (
    <div data-compare className="rounded-lg border border-white/15 bg-white/5 p-3">
      <div className="mb-2 text-sm font-black text-white">Ours vs real</div>
      <div className="mb-3 flex flex-wrap gap-1">
        {COMPARE_KINDS.map((k) => <button key={k} className={chip(kind === k)} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>)}
      </div>
      <div className="mb-3 text-xs font-bold text-white">{real.n} real shots · {ours.n} of our own chances</div>
      <Bar label="Shot distance to goal centre" real={real.distance} ours={ours.distance} unit=" m" max={top("distance", 10)} />
      <Bar label="Defenders between ball and goal" real={real.blockers} ours={ours.blockers} unit="" max={top("blockers", 1)} />
      <Bar label="Nearest defender to the ball" real={real.nearest} ours={ours.nearest} unit=" m" max={top("nearest", 3)} />
      <Bar label="Keeper off his line" real={real.keeperOff} ours={ours.keeperOff} unit=" m" max={top("keeperOff", 2)} />
      <div className="text-[11px] font-bold text-white">
        Real: every opponent StatsBomb froze near the shot. Ours: the game&apos;s own chances of this kind, 200 seeds.
      </div>
    </div>
  );
}

export default function StatsbombShotsDev() {
  const [shots, setShots] = useState<SbShot[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"shots" | "move" | "compare">("shots");
  const [comp, setComp] = useState("All");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("All");
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [band, setBand] = useState(0);
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [playing, setPlaying] = useState<SbShot | null>(null);
  const [leadins, setLeadins] = useState<Record<string, SbLeadin> | null>(null);
  const [watching, setWatching] = useState<SbShot | null>(null);

  useEffect(() => {
    fetch("/api/star/statsbomb-shots")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: SbFile) => setShots(d.shots))
      .catch((e) => setError(String(e)));
    const q = new URLSearchParams(window.location.search);
    if (q.get("tab") === "compare") setTab("compare");
    if (q.get("tab") === "move") setTab("move");
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

  const openOn = useMemo(() => (playing ? () => scenarioForShot(playing) : undefined), [playing]);
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-xs font-black ${on ? "bg-white text-black" : "bg-white/10 text-white"}`;

  return (
    <div className="min-h-screen bg-[#0b1220] px-3 py-3 text-white">
      <PageGuide page="/star-statsbomb-dev" />
      <div className="mb-1 text-lg font-black">Real shots (test)</div>
      <div className="mb-2 text-xs font-bold text-white">
        Real shots from the 2022 World Cup and Euro 2024, with where everyone stood. Test only: none of this is in the game.
      </div>
      <div data-credit className="mb-3 rounded bg-white/10 px-2 py-1 text-[11px] font-bold text-white">
        {STATSBOMB_CREDIT}
      </div>

      <div className="mb-3 flex gap-2">
        <button className={chip(tab === "shots")} onClick={() => setTab("shots")}>Shots</button>
        <button className={chip(tab === "move")} onClick={() => setTab("move")}>Moving highlight</button>
        <button className={chip(tab === "compare")} onClick={() => setTab("compare")}>Ours vs real</button>
      </div>

      {error && <div className="mb-3 rounded bg-red-900/60 p-2 text-sm font-bold">Could not load the shots: {error}</div>}
      {!shots && !error && <div className="text-sm font-bold">Loading the shots…</div>}

      {shots && tab === "compare" && <Compare shots={shots} />}

      {shots && tab === "move" && !leadins && !error && <div className="text-sm font-bold">Loading the moves…</div>}
      {shots && (tab === "shots" || (tab === "move" && leadins)) && (
        <>
          {tab === "move" && (
            <div className="mb-2 text-xs font-bold">
              The match radar follows the move; the real match replays the last 2–3 real passes in its own picture (2D or 3D), you receive the last one, then the shot is yours.
            </div>
          )}
          {tab === "move" && watching && leadins?.[watching.id] && (
            <MovingHighlight key={watching.id} shot={watching} lead={leadins[watching.id]} onClose={() => setWatching(null)} />
          )}
          {tab === "shots" && playing && openOn && (
            <div data-playing className="mb-4 rounded-lg border border-emerald-400/50 bg-white/5 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-xs font-black">
                  {playing.player} · {playing.minute}&apos; · {KIND_LABEL[kindForShot(playing)] ?? kindForShot(playing)}
                  <br />
                  <span className="font-bold">Real: {playing.outcome}, xG {Math.round(playing.xg * 100)}%</span>
                </div>
                <button onClick={() => setPlaying(null)} className="rounded bg-white/15 px-3 py-1 text-xs font-black">■ Stop</button>
              </div>
              <EnginePlay key={playing.id} seed={7} openOn={openOn} />
            </div>
          )}

          <div className="mb-2 flex flex-wrap gap-1">
            {comps.map((c) => <button key={c} className={chip(comp === c)} onClick={() => setComp(c)}>{c}</button>)}
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {OUTCOMES.map((o) => <button key={o} className={chip(outcome === o)} onClick={() => setOutcome(o)}>{o}</button>)}
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {TYPES.map((t) => <button key={t} className={chip(type === t)} onClick={() => setType(t)}>{t}</button>)}
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {BANDS.map((b, i) => <button key={b.label} className={chip(band === i)} onClick={() => setBand(i)}>{b.label}</button>)}
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a player or team"
            className="mb-2 w-full rounded bg-white/10 px-3 py-2 text-sm font-bold text-white placeholder:text-white/60" />
          <div className="mb-2 text-xs font-bold">{list.length} shots{tab === "move" ? " with 2+ passes before them" : ""}</div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.slice(0, shown).map((s) => (
              <div key={s.id} data-shot={s.id} className="flex gap-2 rounded-lg border border-white/15 bg-white/5 p-2">
                <ShotPicture s={s} width={150} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-black">{s.player}</div>
                  <div className="text-[11px] font-bold">{s.team} · {s.minute}&apos;</div>
                  <div className="truncate text-[11px] font-bold">{s.match}</div>
                  <div className="mt-1 text-[11px] font-bold">
                    <span style={{ color: LINE_COLOUR[s.outcome] ?? "#fff" }}>{s.outcome}</span> · xG {Math.round(s.xg * 100)}%
                  </div>
                  <div className="text-[11px] font-bold">{s.type} · {s.body}</div>
                  {tab === "move" ? (
                    <button onClick={() => { setWatching(s); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className="mt-1 rounded bg-emerald-600 px-2 py-1 text-xs font-black text-white">
                      ▶ Watch the move ({leadins?.[s.id]?.passes.length} passes)
                    </button>
                  ) : (
                    <button onClick={() => { setPlaying(s); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className="mt-1 rounded bg-emerald-600 px-2 py-1 text-xs font-black text-white">
                      ▶ Play this shot
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {shown < list.length && (
            <button onClick={() => setShown((n) => n + PAGE)} className="mt-3 w-full rounded bg-white/10 py-2 text-sm font-black">More</button>
          )}
          <div className="mt-3 text-[11px] font-bold">
            Picture: yellow = the shooter (YOU in Play), white = ball, red = opponents, green = keeper, blue = team-mates.
            The dashed line is where the shot went (green goal, yellow saved, orange blocked, grey off target).
          </div>
        </>
      )}
    </div>
  );
}
